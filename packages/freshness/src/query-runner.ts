/**
 * query-runner.ts — consultas read-only a Supabase Postgres y GH CLI.
 *
 * Estrategia de señales:
 *
 * (a) Último upsert en Supabase:
 *     SELECT MAX(<columna>) FROM <tabla> para cada entrada del catálogo.
 *     PGCLIENTENCODING=UTF8 — obligatorio para nombres con tildes.
 *
 * (b) GH Actions — último run del workflow:
 *     gh run list --repo Cuchecorp/gov-map --workflow <yml> --limit 1 --json conclusion,startedAt
 *     Degrada a "n/d" si gh no está en PATH, no hay auth, o falla (timeout 5s).
 *     T-58-03: timeout 5s para evitar colgar el CLI.
 *
 * (c) R2 snapshot — señal desde source_snapshot (DB read-only, sin API S3):
 *     Esquema real de source_snapshot (inspeccionado 2026-07-09, read-only):
 *       source TEXT   ← discriminador de fuente (no "fuente")
 *       fetched_at TIMESTAMPTZ ← fecha del snapshot
 *     SELECT MAX(fetched_at) FROM source_snapshot WHERE source = '<fuente>'
 *     Si no hay filas para la fuente → "n/d (sin snapshots)".
 *     (Phase 56 audit vio 0 filas; Phase 57 wired Etapa-1 → puede ir poblando.)
 *
 * Mapeo source_snapshot.source → CATALOG.fuente:
 *   Los conectores usan el nombre de fuente como string en SnapshotWriter.
 *   Se prueba con el nombre exacto del catálogo ("leyes", "agenda", etc.).
 *   Degrada honestamente si no hay filas.
 */

import { execSync } from "node:child_process";
import { CATALOG } from "./catalog.js";

export interface QueryRow {
  fuente: string;
  ultimoUpsert: string | null;
  ghRun: string;
  r2Snapshot: string;
}

function psql(dbUrl: string, sql: string): string {
  try {
    const out = execSync(`psql "${dbUrl}" -tAc "${sql}"`, {
      env: { ...process.env, PGCLIENTENCODING: "UTF8" },
      encoding: "utf8",
      timeout: 15_000,
    });
    return out.trim();
  } catch {
    return "";
  }
}

function ghRunSignal(workflowYml: string): string {
  try {
    const out = execSync(
      `gh run list --repo Cuchecorp/gov-map --workflow ${workflowYml} --limit 1 --json conclusion,startedAt`,
      { encoding: "utf8", timeout: 5_000 },
    );
    const parsed = JSON.parse(out.trim()) as Array<{
      conclusion: string;
      startedAt: string;
    }>;
    if (!parsed.length) return "n/d (sin corridas)";
    const run = parsed[0]!;
    const date = run.startedAt ? run.startedAt.slice(0, 10) : "?";
    return `${run.conclusion ?? "?"} @ ${date}`;
  } catch {
    return "n/d";
  }
}

function r2SnapshotSignal(dbUrl: string, fuente: string): string {
  // source_snapshot.source contiene el nombre del conector/fuente.
  // Probamos con el nombre exacto del catálogo; si no hay filas → "n/d (sin snapshots)".
  const sql = `SELECT MAX(fetched_at) FROM source_snapshot WHERE source = '${fuente}';`;
  const result = psql(dbUrl, sql);
  if (!result || result === "" || result.toLowerCase() === "null") {
    return "n/d (sin snapshots)";
  }
  return result;
}

export async function queryFreshness(dbUrl: string): Promise<QueryRow[]> {
  return CATALOG.map((cfg) => {
    // (a) Último upsert en Supabase
    const sql = `SELECT MAX(${cfg.columna}) FROM ${cfg.tabla};`;
    const raw = psql(dbUrl, sql);
    const ultimoUpsert =
      !raw || raw === "" || raw.toLowerCase() === "null" ? null : raw;

    // (b) GH Actions signal
    const ghRun = ghRunSignal(cfg.workflowYml);

    // (c) R2 snapshot signal via source_snapshot
    const r2Snapshot = r2SnapshotSignal(dbUrl, cfg.fuente);

    return { fuente: cfg.fuente, ultimoUpsert, ghRun, r2Snapshot };
  });
}
