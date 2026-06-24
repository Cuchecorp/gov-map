/**
 * backfill-entidad-cli — backfill LOCAL de la maestra `entidad_tercero` (ENT-05).
 *
 * CLI de OPERADOR (NO CI; backfill masivo = LOCAL por convención del proyecto). Idempotente y
 * reanudable: el núcleo de idempotencia vive en la clave natural del upsert (`seeder-entidad`,
 * probado en Task 2 — 2ª corrida = 0 entidades nuevas).
 *
 * Encadena las piezas TS PURAS de este plan:
 *   menciones de fuente → matchDeterministaEntidad (fail-closed, Δ2 jurídica-solo-RUT)
 *     → seeder-entidad (upsert idempotente, nunca auto-confirma)
 *     → backup-entidad (export JSON determinista de custodia a supabase/seeds/).
 *
 * Credenciales SOLO de `.env` (BOM-safe) con PRECEDENCIA de `process.env` (patrón
 * run-agenda-prod-cli). Reusa `SUPABASE_URL` + service key existentes. NO requiere LIVE en este
 * plan: el operador lo ejercita; aquí basta que compile y su núcleo idempotente esté testeado.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  matchDeterministaEntidad,
  type EntidadTerceroRow,
  type MentionEntidad,
  type ResolutionEntidad,
} from "./deterministic-entidad";
import {
  upsertEntidades,
  type EntidadTerceroWriter,
  type EntidadTerceroSeed,
} from "./seeder-entidad";
import { SupabaseEntidadWriter } from "./writer-entidad-supabase";
import {
  exportMaestraEntidad,
  type EntidadTercero,
  type SeedFileWriter,
} from "./backup-entidad";
import { FsSeedFileWriter } from "./writer-fs";

/**
 * Carga variables BOM-safe: parte del `.env` local (operador) y deja que `process.env` tenga
 * PRECEDENCIA (CI inyecta secrets ahí, sin archivo `.env`). Si no hay `.env`, usa solo
 * `process.env`. Espejo del patrón loadEnv de run-agenda-prod-cli.
 */
export function loadEnv(root: string): Record<string, string> {
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
  for (const k of ["SUPABASE_URL", "SUPABASE_API_URL", "SUPABASE_SECRET_KEY", "SUPABASE_LOCAL_SERVICE_KEY"]) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  return out;
}

export interface BackfillEntidadOptions {
  /** Menciones de fuente a resolver (contrapartes de lobby, proveedores). */
  menciones: MentionEntidad[];
  /** Maestra actual de entidad_tercero (para el matcher determinista). */
  maestra: EntidadTerceroRow[];
  /** Writer a la DB (default: SupabaseEntidadWriter desde env). Inyectable para tests. */
  writer?: EntidadTerceroWriter;
  /** Writer del snapshot de custodia (default: FsSeedFileWriter). Inyectable para tests. */
  seedWriter?: SeedFileWriter;
  /** ISO de captura para filas nuevas (default: now). */
  fechaCaptura?: string;
  /** Sink de logs (inyectable para tests). Default console.log. */
  log?: (msg: string) => void;
}

export interface BackfillEntidadResult {
  /** Menciones procesadas. */
  total: number;
  /** Menciones que el matcher confirmó (RUT o nombre-por-tipo). */
  confirmadas: number;
  /** Menciones que quedaron no_confirmado (incl. toda jurídica-sin-rut). */
  noConfirmadas: number;
  /** Ruta del snapshot de custodia escrito. */
  snapshotPath: string;
}

/**
 * Convierte una fila de la maestra a la fila de seed (con provenance). Las filas custodiadas
 * llevan el estado actual (el seeder lo fuerza a no_confirmado al persistir, ENT-05).
 */
function aSeed(
  row: EntidadTerceroRow,
  fechaCaptura: string,
): EntidadTerceroSeed {
  return {
    ...row,
    estado: "no_confirmado",
    origen: "backfill-entidad",
    fecha_captura: fechaCaptura,
    enlace: "",
  };
}

/**
 * Corre el backfill end-to-end (PURO sobre los inyectables): resuelve cada mención con el matcher
 * fail-closed, upserta la maestra idempotentemente y exporta el snapshot de custodia determinista.
 * Devuelve el resumen de confirmaciones. NO promueve a confirmado por su cuenta (eso es el
 * revisor humano / Plan 04).
 */
export async function runBackfillEntidad(
  opts: BackfillEntidadOptions,
): Promise<BackfillEntidadResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const fechaCaptura = opts.fechaCaptura ?? new Date().toISOString();

  let confirmadas = 0;
  for (const mencion of opts.menciones) {
    const res: ResolutionEntidad = matchDeterministaEntidad(mencion, opts.maestra);
    if (res.estado === "confirmado") confirmadas++;
  }
  const noConfirmadas = opts.menciones.length - confirmadas;
  log(
    `backfill-entidad: ${opts.menciones.length} menciones -> ${confirmadas} confirmadas, ` +
      `${noConfirmadas} no_confirmado (incl. juridica-sin-rut)`,
  );

  // Upsert idempotente de la maestra (2ª corrida = 0 nuevos; el seeder fuerza no_confirmado).
  if (opts.writer != null) {
    const seed = opts.maestra.map((row) => aSeed(row, fechaCaptura));
    await upsertEntidades(seed, opts.writer);
    log(`backfill-entidad: maestra upsert idempotente -> ${seed.length} filas`);
  }

  // Export de custodia determinista byte-a-byte (diff estable en git).
  const seedWriter = opts.seedWriter ?? new FsSeedFileWriter();
  const custodia: EntidadTercero[] = opts.maestra.map((row) => ({
    id: row.id,
    nombre_normalizado: row.nombre_normalizado,
    tipo_entidad: row.tipo_entidad,
    rut: row.rut,
    estado: "no_confirmado",
    origen: "backfill-entidad",
    fecha_captura: fechaCaptura,
    enlace: "",
  }));
  const exp = await exportMaestraEntidad(custodia, { writer: seedWriter });
  log(`backfill-entidad: snapshot custodia escrito -> ${exp.path} (${exp.bytes} bytes)`);

  return {
    total: opts.menciones.length,
    confirmadas,
    noConfirmadas,
    snapshotPath: exp.path,
  };
}

/**
 * Construye el writer real de Supabase desde el entorno (operador). Devuelve null si faltan
 * credenciales → el backfill corre en modo "solo custodia" (export sin tocar DB).
 */
export function buildWriterFromEnv(
  env: Record<string, string>,
): SupabaseEntidadWriter | null {
  const url = env.SUPABASE_URL ?? env.SUPABASE_API_URL ?? "";
  const serviceKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_LOCAL_SERVICE_KEY ?? "";
  if (!url || !serviceKey) return null;
  return new SupabaseEntidadWriter({ url, serviceKey });
}

// Entry-point CLI: el operador inyecta las menciones/maestra reales (Plan 04 cablea la fuente).
// Aquí el módulo expone `runBackfillEntidad` como núcleo testeable; la corrida LIVE es del
// operador y no se auto-dispara con menciones vacías.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /backfill-entidad-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (isMain) {
  const env = loadEnv(process.cwd());
  const writer = buildWriterFromEnv(env);
  console.log(
    writer != null
      ? "backfill-entidad: writer Supabase listo (credenciales presentes)."
      : "backfill-entidad: sin credenciales -> modo solo-custodia (export JSON sin DB).",
  );
  console.log(
    "backfill-entidad: provee menciones+maestra reales via runBackfillEntidad (Plan 04 cablea la fuente).",
  );
}
