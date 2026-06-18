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
import { buildConnector } from "./worker.ts";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

async function main(): Promise<void> {
  const iterations = Number(Deno.env.get("BACKFILL_ITERATIONS") ?? "1");
  const sb = createClient(
    requireEnv("SUPABASE_API_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
  const connector = buildConnector(sb);

  console.log(`backfill: ${iterations} iteracion(es) del DummyConnector`);
  for (let i = 0; i < iterations; i++) {
    // El rate-limit 2-3s por host lo impone HostRateLimiter dentro del run().
    const refs = await connector.run(
      { source: "dummy", status: "running" } as unknown as Parameters<typeof connector.run>[0],
    );
    console.log(`  iter ${i + 1}: ${Array.isArray(refs) ? refs.length : 0} snapshot(s)`);
  }
  console.log("backfill: done");
}

if (import.meta.main) {
  await main();
}
