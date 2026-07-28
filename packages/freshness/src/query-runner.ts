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

import { execFileSync } from "node:child_process";
import {
  CATALOG,
  COBERTURA_SENALES,
  COBERTURA_VOTO_SENALES,
  COBERTURA_RUT_PARLAMENTARIO_SENALES,
  COBERTURA_RUT_ENTIDAD_SENALES,
  GH_EN_CURSO,
} from "./catalog.js";
import type { CoberturaSenalConfig } from "./catalog.js";

export interface QueryRow {
  fuente: string;
  ultimoUpsert: string | null;
  ghRun: string;
  r2Snapshot: string;
}

/** Fila de estado de un job de `pg_cron` (G3, 119-02). Solo campos NO sensibles. */
export interface PgCronRow {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  /** `max(start_time)` de `cron.job_run_details`; null si no hay corridas o falló la lectura. */
  maxStartTime: string | null;
}

export interface CoberturaCount {
  senal: string;
  /** count leído; null si la query degradó (psql falló / valor no numérico). */
  count: number | null;
}

// WR-06: se loguea a stderr la CLASE de fallo de psql UNA sola vez por proceso (psql fuera
// de PATH / auth fallida / DNS caído). Sin esto, cada fallo se ve idéntico a "sin datos" y el
// operador no tiene pista de la causa. NUNCA se imprime `dbUrl` ni el mensaje crudo (embeben la
// password): solo `err.code` / un rótulo acotado.
let psqlFalloLogueado = false;

function psql(dbUrl: string, sql: string): string {
  try {
    // WR-06: execFileSync (NO execSync): argv separado, sin shell → la `dbUrl` con la
    // password NO se re-cita por un shell (un `"`, `$`, backtick o `%`/`&` la rompería o
    // ejecutaría algo indebido) ni queda expuesta en la línea de comando visible en `ps`.
    const out = execFileSync("psql", [dbUrl, "-tAc", sql], {
      env: { ...process.env, PGCLIENTENCODING: "UTF8" },
      encoding: "utf8",
      timeout: 15_000,
    });
    return out.trim();
  } catch (err) {
    if (!psqlFalloLogueado) {
      psqlFalloLogueado = true;
      // Solo la clase de error, jamás la URL/password ni el stderr crudo de psql.
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "desconocido";
      process.stderr.write(
        `freshness: psql falló (code=${code}) — psql no está en PATH, auth/DNS/conexión falló, ` +
          `o timeout. Las señales que no se pudieron leer degradan a "n/d". (URL/credenciales omitidas)\n`,
      );
    }
    return "";
  }
}

function ghRunSignal(workflowYml: string): string {
  try {
    // execFileSync (sin shell) por consistencia con `psql` (WR-06): argv separado, sin
    // riesgo de interpolación por shell del nombre del workflow.
    const out = execFileSync(
      "gh",
      [
        "run",
        "list",
        "--repo",
        "Cuchecorp/gov-map",
        "--workflow",
        workflowYml,
        "--limit",
        "1",
        "--json",
        "conclusion,startedAt,status",
      ],
      { encoding: "utf8", timeout: 5_000 },
    );
    const parsed = JSON.parse(out.trim()) as Array<{
      conclusion: string;
      startedAt: string;
      status: string;
    }>;
    if (!parsed.length) return "n/d (sin corridas)";
    const run = parsed[0]!;
    const date = run.startedAt ? run.startedAt.slice(0, 10) : "?";
    // WR-07 (119-REVIEW): un run `in_progress`/`queued` NO trae `conclusion` (viene "" o null).
    // Rotularlo con `?` hacía que `ghRunEsAveria` lo leyera como avería ⇒ `stale (gh-failure)`
    // MIENTRAS el cron corre con toda normalidad. Se emite un rótulo propio: en curso ≠ caído.
    if (run.status === "in_progress" || run.status === "queued" || run.status === "requested") {
      return `${GH_EN_CURSO} @ ${date}`;
    }
    return `${run.conclusion || GH_EN_CURSO} @ ${date}`;
  } catch {
    return "n/d";
  }
}

/**
 * Rótulos de `source_snapshot.source` conocidos. IN-04 (119-REVIEW): la SQL de este módulo es
 * 100% ESTÁTICA por invariante; interpolar `fuente` -aunque hoy venga del catálogo estático- la
 * rompía. El valor se busca en esta lista cerrada y lo que no esté en ella NO llega a la SQL.
 */
export const SOURCES_SNAPSHOT_CONOCIDOS = [
  "agenda",
  "identity",
  "infoprobidad",
  "leyes",
  "lobby-camara",
  "lobby-leylobby",
] as const;

function r2SnapshotSignal(dbUrl: string, fuente: string): string {
  // WR-05: el rótulo que el CONECTOR escribe puede diferir del nombre de la entrada del catálogo
  // (p.ej. `probidad` → `infoprobidad`); `sourceSnapshot` lo declara explícitamente.
  const literal = SOURCES_SNAPSHOT_CONOCIDOS.find((s) => s === fuente);
  if (!literal) return "n/d (sin snapshots)";
  const sql = `SELECT MAX(fetched_at) FROM source_snapshot WHERE source = '${literal}';`;
  const result = psql(dbUrl, sql);
  if (!result || result === "" || result.toLowerCase() === "null") {
    return "n/d (sin snapshots)";
  }
  return result;
}

export async function queryFreshness(dbUrl: string): Promise<QueryRow[]> {
  return CATALOG.map((cfg) => {
    // (a) Último upsert en Supabase. Agregado por entrada: MAX (default, último upsert)
    // salvo `leyes-min-edad` que usa MIN (proyecto más viejo sin refrescar → SC#4). El
    // valor sale del enum cerrado FuenteConfig.agregado ("MAX"|"MIN"), NO de input externo
    // → sin superficie de inyección (T-68-03 preservado). `cfg.agregado ?? "MAX"` deja las
    // entradas existentes IDÉNTICAS (todas omiten `agregado`).
    const agregado = cfg.agregado ?? "MAX";
    const sql = `SELECT ${agregado}(${cfg.columna}) FROM ${cfg.tabla};`;
    const raw = psql(dbUrl, sql);
    const ultimoUpsert =
      !raw || raw === "" || raw.toLowerCase() === "null" ? null : raw;

    // (b) GH Actions signal. G2 (119-01): `workflowYml === null` = ausencia DECLARADA de
    // workflow (MONEY/SERVEL gated) → NO se invoca `gh run list` (antes producía un HTTP 404
    // en stderr por cada corrida) y la señal es la cadena propia "n/d (sin workflow)".
    // Las tres degradaciones son DISTINTAS y honestas, no se colapsan:
    //   "n/d (sin workflow)" → no hay workflow por decisión (no es avería)
    //   "n/d (sin corridas)" → el workflow existe pero nunca corrió (SÍ es avería)
    //   "n/d"                → la llamada a `gh` falló (falla del instrumento, no del cron)
    const ghRun =
      cfg.workflowYml === null
        ? "n/d (sin workflow)"
        : ghRunSignal(cfg.workflowYml);

    // (c) R2 snapshot signal via source_snapshot
    const r2Snapshot = r2SnapshotSignal(dbUrl, cfg.sourceSnapshot ?? cfg.fuente);

    return { fuente: cfg.fuente, ultimoUpsert, ghRun, r2Snapshot };
  });
}

/**
 * Lee los counts de cobertura del corpus de búsqueda (BUSQ-03).
 *
 * Corre las MISMAS SQL de scripts/verify-cobertura.sql (definidas en COBERTURA_SENALES)
 * vía el mismo `psql` read-only con PGCLIENTENCODING=UTF8. Degrada honestamente: un
 * count que no se pudo leer (psql falló / valor no numérico) → null, NO 0.
 */
export function queryCobertura(dbUrl: string): CoberturaCount[] {
  return COBERTURA_SENALES.map((cfg) => {
    const raw = psql(dbUrl, cfg.sql);
    const parsed = Number.parseInt(raw, 10);
    const count = raw === "" || Number.isNaN(parsed) ? null : parsed;
    return { senal: cfg.senal, count };
  });
}

/**
 * Lee los counts de cobertura del VOTO INDIVIDUAL (VOTO-05) — señal SEPARADA del corpus.
 *
 * Reusa el MISMO `psql` read-only (T-68-04: nunca imprime dbUrl/password) sobre las SQL
 * estáticas de COBERTURA_VOTO_SENALES (denominador = sesiones de sala conocidas; numeradores
 * Cámara confirmado / Senado por nombre). NO toca COBERTURA_SENALES ni su denominador único.
 * Degrada honestamente (T-68-05): un count que no se pudo leer → null, NO 0.
 */
export function queryCoberturaVoto(dbUrl: string): CoberturaCount[] {
  return COBERTURA_VOTO_SENALES.map((cfg) => {
    const raw = psql(dbUrl, cfg.sql);
    const parsed = Number.parseInt(raw, 10);
    const count = raw === "" || Number.isNaN(parsed) ? null : parsed;
    return { senal: cfg.senal, count };
  });
}

/** Corre un array de señales de cobertura vía `psql` read-only; count null si degrada. */
function runCoberturaSenales(
  dbUrl: string,
  senales: CoberturaSenalConfig[],
): CoberturaCount[] {
  return senales.map((cfg) => {
    const raw = psql(dbUrl, cfg.sql);
    const parsed = Number.parseInt(raw, 10);
    const count = raw === "" || Number.isNaN(parsed) ? null : parsed;
    return { senal: cfg.senal, count };
  });
}

/**
 * Lee los counts de cobertura del RUT presente (RUT-01) — señal SEPARADA del corpus/voto.
 * (Presencia de RUT no vacío; la DV-validez es un sub-techo de la capa de identidad, no aquí.)
 *
 * Mide AMBAS maestras (RESEARCH A1): `parlamentario` (estado confirmado, universo cruzable)
 * y `entidad_tercero` (tipo_entidad juridica, cruzable por RUT exacto). Cada maestra tiene
 * su PROPIO denominador → se devuelven dos bloques que el CLI evalúa por separado. Reusa el
 * MISMO `psql` read-only (T-69-05: nunca imprime dbUrl/password) sobre SQL estáticas
 * (T-69-04). Degrada honestamente (T-69-07): count que no se pudo leer → null, NO 0.
 * NUNCA proyecta el `rut` crudo — son counts agregados (T-69-06, minimización).
 */
export function queryCoberturaRut(dbUrl: string): {
  parlamentario: CoberturaCount[];
  entidad: CoberturaCount[];
} {
  return {
    parlamentario: runCoberturaSenales(
      dbUrl,
      COBERTURA_RUT_PARLAMENTARIO_SENALES,
    ),
    entidad: runCoberturaSenales(dbUrl, COBERTURA_RUT_ENTIDAD_SENALES),
  };
}

/**
 * Lee el estado de los jobs de `pg_cron` (G3, 119-02) — SOLO lectura.
 *
 * Dos consultas por el MISMO helper `psql` read-only (T-119-04: el instrumento observa el
 * scheduler, jamás lo altera — cero `cron.schedule`/`cron.unschedule`):
 *   select jobid, jobname, schedule, active from cron.job;
 *   select jobid, max(start_time) from cron.job_run_details group by jobid;
 *
 * MINIMIZACIÓN (T-119-05): se proyectan SOLO esas columnas. `command` y `return_message`
 * quedan FUERA a propósito: pueden embeber URLs y keys de las llamadas `pg_net`.
 *
 * DEGRADACIÓN HONESTA: si la lectura falla o el job no tiene corridas, `maxStartTime` es
 * `null` — NUNCA `0`, NUNCA una fecha inventada. Quien lo evalúa trata null como stale.
 * Si `cron.job` no se puede leer (extensión ausente, permisos), se devuelve array vacío y
 * cada job del catálogo sale como "job ausente" (stale), no como sano.
 */
export function queryPgCron(dbUrl: string): PgCronRow[] {
  const jobsRaw = psql(
    dbUrl,
    "select jobid, jobname, schedule, active from cron.job order by jobid;",
  );
  if (!jobsRaw) return [];

  const runsRaw = psql(
    dbUrl,
    "select jobid, max(start_time) from cron.job_run_details group by jobid;",
  );
  const ultimaCorrida = new Map<number, string | null>();
  for (const linea of runsRaw.split("\n")) {
    if (!linea.trim()) continue;
    const [idRaw, maxRaw] = linea.split("|");
    const id = Number.parseInt(idRaw ?? "", 10);
    if (Number.isNaN(id)) continue;
    const valor = (maxRaw ?? "").trim();
    ultimaCorrida.set(id, valor === "" ? null : valor);
  }

  const out: PgCronRow[] = [];
  for (const linea of jobsRaw.split("\n")) {
    if (!linea.trim()) continue;
    const [idRaw, jobname, schedule, activeRaw] = linea.split("|");
    const jobid = Number.parseInt(idRaw ?? "", 10);
    if (Number.isNaN(jobid)) continue;
    out.push({
      jobid,
      jobname: (jobname ?? "").trim(),
      schedule: (schedule ?? "").trim(),
      active: (activeRaw ?? "").trim() === "t",
      maxStartTime: ultimaCorrida.get(jobid) ?? null,
    });
  }
  return out;
}
