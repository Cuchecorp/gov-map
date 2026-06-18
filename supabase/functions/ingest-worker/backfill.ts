/**
 * backfill.ts — escape hatch para backfill masivo (RESEARCH §6).
 *
 * Corre el MISMO BaseConnector/DummyConnector que el worker Edge Function, pero
 * SIN el limite de ~400s de Edge Functions (T-01-13): se invoca desde GitHub
 * Actions (Deno) para crawls grandes / snapshot inicial. El rate-limit 2-3s
 * serial por host (HostRateLimiter, FND-01) se respeta igual que en el worker,
 * porque el conector es el mismo — la politica vive UNA sola vez en @obs/ingest.
 *
 * Acotado por la env BACKFILL_ITERATIONS (default 1) para no martillar la
 * fuente; en M1 corre el DummyConnector (NO fuentes reales — Camara/Senado/BCN
 * son Fases 5-7).
 *
 * Secrets via Deno.env (repo secrets en CI): R2_* y SUPABASE_* — nunca en claro.
 */
import { createClient } from "@supabase/supabase-js";
import { buildConnector, makeRunLifecycle } from "./worker.ts";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

/** Cap duro de iteraciones: "acotado para no martillar la fuente" (WR-05). */
const MAX_BACKFILL_ITERATIONS = 1000;

/**
 * WR-05: parsea y valida BACKFILL_ITERATIONS. Rechaza NaN, negativos, no-enteros
 * y valores sobre el cap (en vez de no-ops silenciosos o un crawl ilimitado).
 */
export function parseIterations(raw: string | undefined): number {
  const n = Math.trunc(Number(raw ?? "1"));
  if (!Number.isFinite(n) || n < 1 || n > MAX_BACKFILL_ITERATIONS) {
    throw new Error(
      `BACKFILL_ITERATIONS invalido: ${raw} (esperado entero 1..${MAX_BACKFILL_ITERATIONS})`,
    );
  }
  return n;
}

async function main(): Promise<void> {
  const iterations = parseIterations(Deno.env.get("BACKFILL_ITERATIONS"));
  const sb = createClient(
    requireEnv("SUPABASE_API_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
  const connector = buildConnector(sb);
  const lifecycle = makeRunLifecycle(sb);

  console.log(`backfill: ${iterations} iteracion(es) del DummyConnector`);
  for (let i = 0; i < iterations; i++) {
    // WR-06: corrida real con ciclo de vida ingest_run (running -> ok/error),
    // sin el cast fabricado `as unknown as`.
    const run = await lifecycle.start("dummy");
    try {
      // El rate-limit 2-3s por host lo impone HostRateLimiter dentro del run().
      const refs = await connector.run(run);
      const count = Array.isArray(refs) ? refs.length : 0;
      await lifecycle.finish(run.id, "ok", { stats: { snapshots: count } });
      console.log(`  iter ${i + 1}: ${count} snapshot(s)`);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await lifecycle.finish(run.id, "error", { error: msg });
      throw err;
    }
  }
  console.log("backfill: done");
}

if (import.meta.main) {
  await main();
}
