// run-probidad-bienes-cli — entry-point de OPERADOR de la ingesta de BIENES de patrimonio (bienes).
//
// Las declaraciones (metadata) ya están en la DB (run-probidad-todos). Este runner trae los BIENES
// (inmuebles/muebles/actividades/pasivos/acciones/valores) de cada declaración CONFIRMADA por lotes
// (VALUES de N URIs por query → ~6 queries por chunk, no por declaración) y los escribe a las 6
// sub-tablas (upsert idempotente por la UNIQUE de cada tabla). datos.cplt.cl SPARQL: sin WAF.
//
// Credenciales SOLO de `.env` (BOM-safe). `--dry-run` no escribe. `--chunk N` (default 50).
//
// Uso: tsx packages/probidad/src/run-probidad-bienes-cli.ts [--dry-run] [--chunk N]

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { InfoProbidadConnector } from "./connector-infoprobidad";
import { SupabaseProbidadWriter } from "./writer-supabase";
import { InMemoryProbidadWriter, type ProbidadWriter } from "./writer";
import { runProbidadBienes } from "./run-probidad-bienes";

/**
 * Resuelve la raíz del workspace subiendo desde `start` hasta hallar `pnpm-workspace.yaml`.
 * Necesario porque `pnpm --filter <pkg> exec` pone el cwd en el directorio del paquete,
 * no en la raíz — idéntico al patrón de run-tramitacion-prod-cli.ts (RC-1 fix).
 */
function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `findWorkspaceRoot: no se encontró pnpm-workspace.yaml subiendo desde ${start}`,
      );
    }
    dir = parent;
  }
}

function loadEnv(root: string): Record<string, string> {
  const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

async function main(): Promise<void> {
  const root = findWorkspaceRoot(process.cwd());
  const dryRun = process.argv.includes("--dry-run");
  const chunkSize = Number(flagValue("--chunk") ?? "50");
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  if (!env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Faltan SUPABASE_API_URL / SUPABASE_SECRET_KEY en .env");
  }

  // Lista de declaraciones CONFIRMADAS (parlamentario_id no nulo) — paginado (PostgREST cap 1000/req).
  const admin = createClient(env.SUPABASE_API_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const declaraciones: { fuenteId: string; fechaPresentacion: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("declaracion")
      .select("fuente_id, fecha_presentacion")
      .not("parlamentario_id", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(`select declaracion falló: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data as { fuente_id: string; fecha_presentacion: string }[]) {
      declaraciones.push({ fuenteId: r.fuente_id, fechaPresentacion: r.fecha_presentacion });
    }
    if (data.length < 1000) break;
  }
  log(`bienes: ${declaraciones.length} declaraciones confirmadas a procesar`);

  const allowlist = {};
  const conector = new InfoProbidadConnector({
    fetcher: new Fetcher({ allowlist }),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist }),
  });

  let writer: ProbidadWriter;
  if (dryRun) {
    writer = new InMemoryProbidadWriter();
    log("bienes: DRY-RUN (in-memory, no escribe DB)");
  } else {
    writer = new SupabaseProbidadWriter({ url: env.SUPABASE_API_URL, serviceKey: env.SUPABASE_SECRET_KEY });
    log(`bienes: writer Supabase (${env.SUPABASE_API_URL}) — upsert idempotente`);
  }

  const res = await runProbidadBienes({ conector, writer, declaraciones, chunkSize, log });

  console.log(
    `\nbienes ${dryRun ? "DRY-RUN" : "LIVE"}: chunks=${res.chunks} inmuebles=${res.inmuebles} ` +
      `muebles=${res.muebles} actividades=${res.actividades} pasivos=${res.pasivos} ` +
      `acciones=${res.accionesDerechos} valores=${res.valores}`,
  );
}

main().catch((err) => {
  console.error("bienes FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
