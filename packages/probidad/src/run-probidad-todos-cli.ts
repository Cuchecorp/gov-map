// run-probidad-todos-cli — entry-point de OPERADOR de la ingesta LIVE de patrimonio/intereses
// (InfoProbidad SPARQL, `datos.cplt.cl/sparql`) para TODOS los parlamentarios de la maestra
// (Phase 26).
//
// Ensambla los colaboradores REALES (Fetcher + HostRateLimiter + RobotsGuard de @obs/ingest en el
// ORDEN LOCKED), carga la maestra del seed autoritativo y corre `runProbidadTodos`: una query
// SPARQL por parlamentario (FILTER coarse por apellidos) + confirmación de identidad DIRIGIDA por
// test de superconjunto determinista (separa hermanos, tolera segundos nombres, nunca fabrica un FK).
//
// Credenciales SOLO de `.env` (BOM-safe, desde cwd). `--dry-run` (o creds Supabase ausentes) corre
// fetch/parse/cruce in-memory sin escribir DB. `--limit N` acota a los primeros N parlamentarios.
// InfoProbidad SPARQL responde por fetch de Node (sin WAF) → no se requiere `--html-file`.
//
// Uso: tsx packages/probidad/src/run-probidad-todos-cli.ts [--dry-run] [--limit N]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  R2Store,
  SnapshotWriter,
  SupabaseSnapshotStore,
  type CreateSupabaseClient,
} from "@obs/ingest";
import type { Parlamentario } from "@obs/core";
import { createClient } from "@supabase/supabase-js";

/**
 * Adapta el `createClient` de supabase-js a la factory estructural `CreateSupabaseClient` que
 * `SupabaseSnapshotStore` espera. El cast aísla aquí el mismatch entre el tipo genérico-profundo
 * del builder de supabase-js y el subconjunto estructural `SupabaseClientLike` de @obs/ingest
 * (que es un supertipo estructural: solo usa `.from(...).insert/select`). Probidad ya declara la
 * lib; @obs/ingest queda desacoplado (T-34-SC).
 */
const createSupabaseClient: CreateSupabaseClient = (url, serviceKey) =>
  createClient(url, serviceKey) as unknown as ReturnType<CreateSupabaseClient>;
import { InfoProbidadConnector } from "./connector-infoprobidad";
import { SupabaseProbidadWriter } from "./writer-supabase";
import { InMemoryProbidadWriter, type ProbidadWriter } from "./writer";
import { runProbidadTodos } from "./run-probidad-todos";

/** Lee el valor de un flag `--x <valor>` de argv, o null. */
function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}

/**
 * Carga variables BOM-safe: parte del `.env` local (operador) y deja que `process.env`
 * tenga PRECEDENCIA (CI/GitHub Actions inyecta los secrets ahí, sin archivo `.env`). Si
 * no hay `.env` (CI), usa solo `process.env`.
 */
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin `.env` (CI): los secrets vienen de process.env (abajo).
  }
  for (const k of [
    "SUPABASE_API_URL",
    "SUPABASE_SECRET_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT_URL",
    "R2_BUCKET",
  ]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

function cargarMaestra(root: string): Parlamentario[] {
  return JSON.parse(
    readFileSync(join(root, "supabase", "seeds", "parlamentario.seed.json"), "utf8"),
  ) as Parlamentario[];
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  const limitRaw = flagValue("--limit");
  const limite = limitRaw != null ? Number.parseInt(limitRaw, 10) : undefined;
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const conector = new InfoProbidadConnector({
    fetcher: new Fetcher({ allowlist: {} }),
    rateLimiter: new HostRateLimiter(),
    robots: new RobotsGuard({ allowlist: {} }),
    allowlist: {},
  });

  const maestra = cargarMaestra(root);
  log(`probidad-todos: maestra cargada (${maestra.length} parlamentarios)`);

  let writer: ProbidadWriter;
  if (dryRun || !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    writer = new InMemoryProbidadWriter();
    log("probidad-todos: DRY-RUN (in-memory, no escribe DB)");
  } else {
    writer = new SupabaseProbidadWriter({
      url: env.SUPABASE_API_URL,
      serviceKey: env.SUPABASE_SECRET_KEY,
    });
    log(`probidad-todos: writer Supabase (${env.SUPABASE_API_URL}) — upsert versionado`);
  }

  // Etapa 1 (R2, crudo content-addressed) — solo LIVE y con creds R2 (doble candado `!dryRun`).
  let r2Store: R2Store | undefined;
  if (!dryRun && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT_URL) {
    r2Store = new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "observatorio",
    });
  }

  // Provenance run-level (source_snapshot) — solo LIVE y con creds Supabase. El store inyecta el
  // `createClient` de @supabase/supabase-js (probidad ya lo declara; @obs/ingest queda desacoplado).
  const snapshotWriter =
    !dryRun && env.SUPABASE_API_URL && env.SUPABASE_SECRET_KEY
      ? new SnapshotWriter(
          new SupabaseSnapshotStore({
            url: env.SUPABASE_API_URL,
            serviceKey: env.SUPABASE_SECRET_KEY,
            createClient: createSupabaseClient,
          }),
        )
      : undefined;

  const res = await runProbidadTodos({
    conector,
    writer,
    maestra,
    ...(limite != null && !Number.isNaN(limite) ? { limite } : {}),
    ...(r2Store ? { r2Store } : {}),
    ...(snapshotWriter ? { snapshotWriter } : {}),
    log,
  });

  log(
    `[ok] probidad consultados=${res.parlamentariosConsultados} declaraciones=${res.declaraciones} ` +
      `errores=${res.errores.length}`,
  );
  console.log(
    `\nprobidad-todos ${dryRun ? "DRY-RUN" : "LIVE"}: consultados=${res.parlamentariosConsultados} ` +
      `declaraciones=${res.declaraciones} bienes=${res.bienes} familiares=${res.familiares} ` +
      `confirmados=${res.confirmados} errores=${res.errores.length} r2Path=${res.r2Path ?? "none"}`,
  );
}

main().catch((err) => {
  console.error("probidad-todos FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
