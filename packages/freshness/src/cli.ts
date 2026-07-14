/**
 * cli.ts — CLI de frescura de fuentes para el operador.
 *
 * Uso:
 *   pnpm freshness              # tabla ANSI en stdout; exit 1 si alguna fuente está stale
 *   pnpm freshness --json       # JSON en stdout, tabla en stderr
 *   pnpm freshness --help       # muestra uso y sale con 0
 *
 * Requiere SUPABASE_DB_URL en .env (o process.env).
 * No escribe nada, no dispara ingestas. Solo SELECTs read-only + gh CLI reads.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  queryCobertura,
  queryCoberturaVoto,
  queryCoberturaRut,
  queryFreshness,
} from "./query-runner.js";
import {
  evaluate,
  evaluateCobertura,
  type CoberturaResult,
  type FuenteResult,
} from "./evaluate.js";
import {
  CATALOG,
  COBERTURA_SENALES,
  COBERTURA_VOTO_SENALES,
  COBERTURA_RUT_PARLAMENTARIO_SENALES,
  COBERTURA_RUT_ENTIDAD_SENALES,
} from "./catalog.js";

// ─── loadEnv (BOM-safe, process.env tiene precedencia sobre .env) ─────────────

function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Sin .env (CI): los secrets vienen de process.env (abajo).
  }
  // process.env tiene precedencia (CI/GitHub Actions inyecta los secrets ahí)
  const knownKeys = ["SUPABASE_DB_URL"];
  for (const k of knownKeys) {
    if (process.env[k]) out[k] = process.env[k]!;
  }
  // Cargar todos los overrides FRESHNESS_UMBRAL_*
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("FRESHNESS_UMBRAL_") && v) out[k] = v;
  }
  return out;
}

// ─── Renderizado de tabla ANSI ────────────────────────────────────────────────

const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  // ISO timestamp → mostrar solo fecha y hora (YYYY-MM-DD HH:MM)
  return s.slice(0, 16).replace("T", " ");
}

function renderTable(results: FuenteResult[]): string {
  const cols = {
    fuente: 16,
    ultimoUpsert: 17,
    dias: 5,
    umbral: 7,
    ghRun: 22,
    r2Snapshot: 22,
    estado: 7,
  };

  const header =
    pad("Fuente", cols.fuente) +
    " | " +
    pad("Último upsert", cols.ultimoUpsert) +
    " | " +
    pad("Días", cols.dias) +
    " | " +
    pad("Umbral", cols.umbral) +
    " | " +
    pad("GH última corrida", cols.ghRun) +
    " | " +
    pad("R2 snapshot", cols.r2Snapshot) +
    " | " +
    "Estado";

  const sep = "-".repeat(header.length);

  const rows = results.map((r) => {
    const diasStr = r.diasDesdeUpsert !== null ? String(r.diasDesdeUpsert) : "?";
    const estadoStr = r.stale ? "STALE" : "OK";
    const row =
      pad(r.fuente, cols.fuente) +
      " | " +
      pad(formatDate(r.ultimoUpsert), cols.ultimoUpsert) +
      " | " +
      pad(diasStr, cols.dias) +
      " | " +
      pad(String(r.umbralDias), cols.umbral) +
      " | " +
      pad(r.ghRun, cols.ghRun) +
      " | " +
      pad(r.r2Snapshot.slice(0, cols.r2Snapshot), cols.r2Snapshot) +
      " | " +
      estadoStr;
    return r.stale ? `${RED}${row}${RESET}` : row;
  });

  return [header, sep, ...rows].join("\n");
}

// ─── Cobertura del corpus de búsqueda (BUSQ-03) ───────────────────────────────

function renderCobertura(results: CoberturaResult[]): string {
  // IN-04: cols.m=9 (no 8): "M (total)" tiene 9 chars; con 8 `pad` recortaba el ")" final
  // ("M (total") en cada render.
  const cols = { senal: 22, n: 8, m: 9, pct: 6 };
  const header =
    pad("Señal", cols.senal) +
    " | " +
    pad("N", cols.n) +
    " | " +
    pad("M (total)", cols.m) +
    " | " +
    "N/M";
  const sep = "-".repeat(header.length);
  const rows = results.map((r) => {
    const nStr = r.n !== null ? String(r.n) : "?";
    const mStr = r.m !== null ? String(r.m) : "?";
    const pctStr = r.pct !== null ? `${r.pct}%` : "n/d";
    return (
      pad(r.etiqueta, cols.senal) +
      " | " +
      pad(nStr, cols.n) +
      " | " +
      pad(mStr, cols.m) +
      " | " +
      pctStr
    );
  });
  return ["Cobertura del corpus de búsqueda (BUSQ-03):", "", header, sep, ...rows].join("\n");
}

// ─── Cobertura del voto individual (VOTO-05) ──────────────────────────────────

/**
 * Tabla N/M del voto individual por CÁMARA. Espejo de `renderCobertura` (mismo layout),
 * denominador = sesiones de sala conocidas. Declara HONESTAMENTE: Cámara confirmado
 * (determinista) y Senado por nombre (techo honesto, NO atribución dura). Degrada `n/d`
 * cuando el count no se pudo leer (T-68-05). NO reemplaza la tabla del corpus.
 */
function renderCoberturaVoto(results: CoberturaResult[]): string {
  const cols = { senal: 26, n: 8, m: 9, pct: 6 };
  const header =
    pad("Cámara/Señal", cols.senal) +
    " | " +
    pad("N", cols.n) +
    " | " +
    pad("M (total)", cols.m) +
    " | " +
    "N/M";
  const sep = "-".repeat(header.length);
  const rows = results.map((r) => {
    const nStr = r.n !== null ? String(r.n) : "?";
    const mStr = r.m !== null ? String(r.m) : "?";
    const pctStr = r.pct !== null ? `${r.pct}%` : "n/d";
    return (
      pad(r.etiqueta, cols.senal) +
      " | " +
      pad(nStr, cols.n) +
      " | " +
      pad(mStr, cols.m) +
      " | " +
      pctStr
    );
  });
  return [
    "Cobertura del voto individual (VOTO-05):",
    "  (Cámara = voto confirmado determinista; Senado = voto por nombre, techo honesto)",
    "",
    header,
    sep,
    ...rows,
  ].join("\n");
}

// ─── Cobertura de RUT DV-válido (RUT-01) ──────────────────────────────────────

/**
 * Sub-tabla N/M de una maestra (parlamentario o entidad_tercero). Espejo de
 * `renderCoberturaVoto` (mismo layout), un denominador propio por maestra. Degrada `n/d`
 * cuando el count no se pudo leer (T-69-07). NUNCA imprime el RUT crudo (T-69-06): son
 * counts agregados. No reemplaza las tablas de corpus/voto.
 */
function renderCoberturaRutTabla(
  titulo: string,
  results: CoberturaResult[],
): string {
  const cols = { senal: 36, n: 8, m: 9, pct: 6 };
  const header =
    pad("Maestra/Señal", cols.senal) +
    " | " +
    pad("N", cols.n) +
    " | " +
    pad("M (total)", cols.m) +
    " | " +
    "N/M";
  const sep = "-".repeat(header.length);
  const rows = results.map((r) => {
    const nStr = r.n !== null ? String(r.n) : "?";
    const mStr = r.m !== null ? String(r.m) : "?";
    const pctStr = r.pct !== null ? `${r.pct}%` : "n/d";
    return (
      pad(r.etiqueta, cols.senal) +
      " | " +
      pad(nStr, cols.n) +
      " | " +
      pad(mStr, cols.m) +
      " | " +
      pctStr
    );
  });
  return [`  ${titulo}`, header, sep, ...rows].join("\n");
}

/**
 * Encabezado RUT-01 + las dos sub-tablas de maestra (parlamentario + entidad_tercero).
 * Declara el techo HONESTO: "sin dato de RUT" ≠ "sin vínculos"; el RUT es interno
 * (minimización), nunca público. El % cuenta presencia de RUT no vacío; la DV-validez
 * se resuelve en la capa de identidad (`isRutValido`) — sub-techo declarado aquí.
 */
function renderCoberturaRut(
  parlamentario: CoberturaResult[],
  entidad: CoberturaResult[],
): string {
  return [
    "Cobertura de RUT DV-válido (RUT-01):",
    "  (techo honesto — 'sin dato de RUT' ≠ 'sin vínculos'; el RUT es interno, nunca público.",
    "   El % mide presencia de RUT no vacío; la DV-validez la resuelve la capa de identidad.)",
    "",
    renderCoberturaRutTabla("Parlamentarios (maestra cruzable):", parlamentario),
    "",
    renderCoberturaRutTabla("Entidades terceras jurídicas:", entidad),
  ].join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help")) {
  console.log(`
pnpm freshness — CLI de monitoreo de frescura de fuentes de ingesta

Uso:
  pnpm freshness              Muestra tabla ANSI por fuente; exit 1 si alguna está stale
  pnpm freshness --json       JSON a stdout (tabla a stderr); exit 1 si alguna está stale
  pnpm freshness --help       Muestra este mensaje y sale con código 0

Variables de entorno:
  SUPABASE_DB_URL             Requerida. URL de conexión psql a Supabase.
  FRESHNESS_UMBRAL_<FUENTE>   Opcional. Override de umbral en días para una fuente.
                              Fuentes: LEYES, AGENDA, LOBBY_CAMARA, LOBBY_LEYLOBBY,
                                       PROBIDAD, FICHAS

Fuentes monitoreadas (umbral por defecto):
  leyes (7d), agenda (7d), lobby-camara (14d), lobby-leylobby (7d),
  probidad (30d), fichas (30d)

Salida:
  Tabla con columnas: Fuente | Último upsert | Días | Umbral | GH última corrida | R2 snapshot | Estado
  Filas en rojo = stale (días > umbral o sin datos)
  Exit 0 = todo fresco; Exit 1 = al menos una fuente stale; Exit 2 = error de configuración
`.trim());
  process.exit(0);
}

const jsonMode = args.includes("--json");

async function main(): Promise<void> {
  const root = process.cwd();
  const env = loadEnv(root);

  if (!env["SUPABASE_DB_URL"]) {
    process.stderr.write(
      "ERROR: SUPABASE_DB_URL no está definido en .env ni en process.env\n" +
        "Agregar la variable a .env (ver docs/runbooks/cron-local-fallback.md)\n",
    );
    process.exit(2);
  }

  // Extraer overrides FRESHNESS_UMBRAL_*
  const envOverrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith("FRESHNESS_UMBRAL_") && v) envOverrides[k] = v;
  }

  if (!jsonMode) {
    process.stdout.write("Consultando frescura de fuentes (solo lectura)...\n\n");
  } else {
    process.stderr.write("Consultando frescura de fuentes (solo lectura)...\n");
  }

  const rows = await queryFreshness(env["SUPABASE_DB_URL"]!);
  const results = evaluate(rows, CATALOG, new Date(), envOverrides);

  // Cobertura N/M del corpus de búsqueda (BUSQ-03): el operador la ve sin bucear SQL.
  const coberturaCounts = queryCobertura(env["SUPABASE_DB_URL"]!);
  const cobertura = evaluateCobertura(coberturaCounts, COBERTURA_SENALES);

  // Cobertura N/M del VOTO INDIVIDUAL (VOTO-05): señal SEPARADA (denominador = sesiones de
  // sala), APPEND — no reemplaza la del corpus. Cámara confirmado / Senado por nombre.
  const coberturaVotoCounts = queryCoberturaVoto(env["SUPABASE_DB_URL"]!);
  const coberturaVoto = evaluateCobertura(
    coberturaVotoCounts,
    COBERTURA_VOTO_SENALES,
  );

  // Cobertura N/M del RUT DV-válido (RUT-01): señal SEPARADA (dos maestras, dos
  // denominadores), APPEND — no reemplaza corpus ni voto. Cada maestra se evalúa con
  // su propio array (evaluateCobertura toma un solo denominador). Solo counts, nunca rut.
  const coberturaRutCounts = queryCoberturaRut(env["SUPABASE_DB_URL"]!);
  const coberturaRutParlamentario = evaluateCobertura(
    coberturaRutCounts.parlamentario,
    COBERTURA_RUT_PARLAMENTARIO_SENALES,
  );
  const coberturaRutEntidad = evaluateCobertura(
    coberturaRutCounts.entidad,
    COBERTURA_RUT_ENTIDAD_SENALES,
  );

  const table = renderTable(results);
  const coberturaTable = renderCobertura(cobertura);
  const coberturaVotoTable = renderCoberturaVoto(coberturaVoto);
  const coberturaRutTable = renderCoberturaRut(
    coberturaRutParlamentario,
    coberturaRutEntidad,
  );
  const anyStale = results.some((r) => r.stale);

  const coberturaRut = {
    parlamentario: coberturaRutParlamentario,
    entidad: coberturaRutEntidad,
  };

  if (jsonMode) {
    process.stderr.write(
      table +
        "\n\n" +
        coberturaTable +
        "\n\n" +
        coberturaVotoTable +
        "\n\n" +
        coberturaRutTable +
        "\n",
    );
    process.stdout.write(
      JSON.stringify(
        { frescura: results, cobertura, coberturaVoto, coberturaRut },
        null,
        2,
      ) + "\n",
    );
  } else {
    process.stdout.write(
      table +
        "\n\n" +
        coberturaTable +
        "\n\n" +
        coberturaVotoTable +
        "\n\n" +
        coberturaRutTable +
        "\n",
    );
  }

  process.exit(anyStale ? 1 : 0);
}

main().catch((err: unknown) => {
  process.stderr.write(
    "freshness FALLÓ: " +
      (err instanceof Error ? err.message : String(err)) +
      "\n",
  );
  process.exit(2);
});
