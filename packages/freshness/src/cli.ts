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
import { queryFreshness } from "./query-runner.js";
import { evaluate, type FuenteResult } from "./evaluate.js";
import { CATALOG } from "./catalog.js";

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

  const table = renderTable(results);
  const anyStale = results.some((r) => r.stale);

  if (jsonMode) {
    process.stderr.write(table + "\n");
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    process.stdout.write(table + "\n");
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
