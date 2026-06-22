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
// Uso: tsx packages/votos/src/run-votos-masivo-cli.ts [--dry-run] [--limit N] [--boletines-file <ruta>]

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  InMemoryTramitacionWriter,
  SupabaseTramitacionWriter,
  cargarMaestra,
  findWorkspaceRoot,
  type TramitacionWriter,
} from "@obs/tramitacion";
import { runCamaraVotos, buildCamaraConnector, buildSenadoConnector } from "./run-camara-votos";

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
  const limite = Number(flagValue("--limit") ?? "1000");
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

  let writer: TramitacionWriter;
  if (dryRun || !env.SUPABASE_API_URL || !env.SUPABASE_SECRET_KEY) {
    writer = new InMemoryTramitacionWriter();
    log("votos-masivo: DRY-RUN (in-memory, no escribe DB)");
  } else {
    writer = new SupabaseTramitacionWriter({
      url: env.SUPABASE_API_URL,
      serviceKey: env.SUPABASE_SECRET_KEY,
    });
    log(`votos-masivo: writer Supabase (${env.SUPABASE_API_URL}) — upsert idempotente`);
  }

  const res = await runCamaraVotos({
    ...(boletines ? { boletines } : { limite }),
    maestra,
    camara: buildCamaraConnector(),
    senado: buildSenadoConnector(),
    writer,
    log,
  });

  console.log(
    `\nvotos-masivo ${dryRun ? "DRY-RUN" : "LIVE"}: votaciones=${res.votaciones} votos=${res.votos} ` +
      `dbLoaded=${res.dbLoaded} errores=${res.errores.length}`,
  );
}

main().catch((err) => {
  console.error("votos-masivo FALLÓ:", err instanceof Error ? err.message : err);
  process.exit(1);
});
