// run-votos-masivo-cli — entry-point de OPERADOR de la ingesta masiva de votaciones (Phase 27).
//
// Escala la cobertura de voto individual de la Cámara más allá de los 2 boletines del MVP,
// descubriendo los boletines de la legislatura vigente (Leg-58) y ejerciendo `runCamaraVotos`
// contra `opendata.camara.cl` (sin WAF). El cruce DIPID→id_diputado_camara es DETERMINISTA
// (sin LLM, sin issue de nombre). Idempotente por clave natural (votacion_id, fuente_voter_id).
//
// Credenciales SOLO de `.env` (BOM-safe). `--dry-run` corre fetch/parse/cruce in-memory sin DB.
// `--limit N` acota el número de boletines. El descubrimiento por sesiones de la Cámara es
// best-effort (el WS no enumera por sesión → suele devolver 0); la vía robusta es
// `--boletines-file <ruta>` (un boletín por línea — p.ej. los proyectos ya trackeados en la DB).
//
// Etapa 1 R2 (DEBT-01): construye un `R2Store` desde `.env` R2_* y lo threadea a runCamaraVotos
// → los votos ganan sus PRIMEROS snapshots crudos content-addressed (hoy 0). Sin R2_* la Etapa 1
// se omite con WARN (degrada honesto). `--from-r2 <path>` re-ejecuta la Etapa 2 desde R2 sin fetch.
// Tras una corrida con writer REAL (no dry-run), imprime el reporte de cobertura por estado_vinculo.
//
// Uso: tsx packages/votos/src/run-votos-masivo-cli.ts [--dry-run] [--limit N]
//        [--boletines-file <ruta>] [--from-r2 <r2Path>]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { R2Store } from "@obs/ingest";
import {
  InMemoryTramitacionWriter,
  SupabaseTramitacionWriter,
  cargarMaestra,
  findWorkspaceRoot,
  type TramitacionWriter,
} from "@obs/tramitacion";
import { runCamaraVotos, buildCamaraConnector, buildSenadoConnector } from "./run-camara-votos";
import { derivarGoldenDipid } from "./golden-dipid";
import { reportarCobertura } from "./cobertura";

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
  // WR-04: `--limit` es un control de seguridad (backfill sensible al WAF) → validar explícito.
  // `Number("abc")`→NaN, `Number("")`→0, `Number("50.7")`→50.7 pasarían silenciosos; rechazamos
  // cualquier no-entero o valor ≤0 con un error CLARO en vez de aceptar basura.
  const rawLimit = flagValue("--limit");
  const limite = rawLimit == null ? 1000 : Number(rawLimit);
  if (!Number.isInteger(limite) || limite <= 0) {
    throw new Error(`--limit inválido: '${rawLimit}' (debe ser un entero > 0)`);
  }
  const env = loadEnv(root);
  const log = (m: string) => console.log(m);

  const maestra = cargarMaestra(root, log);
  log(`votos-masivo: maestra cargada (${maestra.length})`);

  // Boletines explícitos (vía robusta) desde archivo (un boletín por línea), o descubrimiento.
  const boletinesFile = flagValue("--boletines-file");
  const boletines = boletinesFile
    ? readFileSync(boletinesFile, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : undefined;
  if (boletines) log(`votos-masivo: ${boletines.length} boletines desde archivo`);

  const fromR2 = flagValue("--from-r2");

  // Etapa 1 R2 (DEBT-01): construir el R2Store desde .env R2_* (espejo de ingest-cli.ts).
  // Sin él, runIngest NO persiste crudo (los votos seguirían con 0 snapshots) y `--from-r2` no
  // puede leer. Requerido para producir los primeros snapshots de votos.
  let r2Store: R2Store | undefined;
  if (env.R2_ACCESS_KEY_ID && env.R2_ENDPOINT_URL) {
    r2Store = new R2Store({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
      endpoint: env.R2_ENDPOINT_URL,
      bucket: env.R2_BUCKET ?? "",
    });
    log("votos-masivo: R2Store construido de .env (Etapa 1 activa) — crudo content-addressed");
  } else {
    log("votos-masivo: [WARN] R2 no configurado (R2_ACCESS_KEY_ID/R2_ENDPOINT_URL) — Etapa 1 omitida");
  }
  if (fromR2 && !r2Store) {
    throw new Error("--from-r2 requiere R2 configurado en .env (R2_ACCESS_KEY_ID + R2_ENDPOINT_URL)");
  }

  let writer: TramitacionWriter;
  let escribeReal = false;
  if (dryRun || !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    writer = new InMemoryTramitacionWriter();
    log("votos-masivo: DRY-RUN (in-memory, no escribe DB)");
  } else {
    writer = new SupabaseTramitacionWriter({
      url: env.SUPABASE_API_URL,
      serviceKey: env.SUPABASE_SECRET_KEY,
    });
    escribeReal = true;
    // Pitfall 5: loguear el destino (LOCAL vs REMOTO) ANTES de escribir.
    log(`votos-masivo: writer Supabase REMOTO (${env.SUPABASE_API_URL}) — upsert idempotente`);
  }

  const res = await runCamaraVotos({
    ...(fromR2 ? { fromR2 } : boletines ? { boletines } : { limite }),
    maestra,
    camara: buildCamaraConnector(),
    senado: buildSenadoConnector(),
    writer,
    log,
    ...(r2Store ? { r2Store } : {}),
  });

  console.log(
    `\nvotos-masivo ${dryRun ? "DRY-RUN" : "LIVE"}${fromR2 ? " (--from-r2)" : ""}: ` +
      `votaciones=${res.votaciones} votos=${res.votos} dbLoaded=${res.dbLoaded} errores=${res.errores.length}`,
  );

  // Reporte de cobertura (SC#4): solo con writer REAL (la in-memory no tiene el estado agregado).
  if (escribeReal) {
    const client = createClient(env.SUPABASE_API_URL!, env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const dipidsMaestra = derivarGoldenDipid(maestra).map((r) => r.dipid);
    const cobertura = await reportarCobertura(client, dipidsMaestra);
    console.log(`\nvotos-masivo cobertura: ${JSON.stringify(cobertura)}`);
    if (cobertura.dipidsMaestraNoConfirmados > 0) {
      console.error(
        `votos-masivo: INVARIANTE ROTO — ${cobertura.dipidsMaestraNoConfirmados} DIPID(s) de la ` +
          `maestra vigente quedaron no_confirmado (esperado 0; revisar reconciliador/golden)`,
      );
    }
  }
}

main().catch((err) => {
  console.error("votos-masivo FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
