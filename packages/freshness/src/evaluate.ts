/**
 * evaluate.ts — lógica pura de evaluación de frescura.
 * Sin I/O, sin red, sin llamadas a DB. Testeable en aislamiento.
 */

import { GH_EN_CURSO } from "./catalog.js";
import type {
  CoberturaSenalConfig,
  FuenteConfig,
  PgCronJobConfig,
} from "./catalog.js";
import type { CoberturaCount, PgCronRow, QueryRow } from "./query-runner.js";

export interface FuenteResult {
  fuente: string;
  tabla: string;
  ultimoUpsert: string | null;
  diasDesdeUpsert: number | null;
  umbralDias: number;
  stale: boolean;
  /**
   * POR QUÉ está stale, o null si está fresca. G4 (119-01): sin esto, `stale:true` no
   * distingue "la tabla no se actualiza" de "el workflow se está cayendo".
   *   "sin dato"     → no hay último upsert legible (desconocido = stale, fail-closed)
   *   "dias>umbral"  → hay dato pero es más viejo que el umbral
   *   "gh-failure"   → la tabla está fresca pero el cron que la llena está averiado
   */
  motivoStale: string | null;
  ghRun: string;
  r2Snapshot: string;
}

/**
 * ¿La señal de GH Actions denuncia una avería DEL CRON? (función pura, G4 de 118 §4)
 *
 * Devuelve true SOLO cuando hay evidencia POSITIVA de que el workflow está fallando:
 *   - una `conclusion` distinta de success/skipped (failure, cancelled, timed_out, ...)
 *   - "n/d (sin corridas)" → el workflow EXISTE y nunca corrió (el cron no está disparando)
 *
 * Devuelve false para las dos degradaciones que NO son avería del cron:
 *   - "n/d (sin workflow)" → ausencia DECLARADA de workflow (MONEY/SERVEL gated, G2). Una
 *     decisión no es una avería; si fuera true, MONEY/SERVEL ganarían un stale nuevo y falso.
 *   - "en curso" → el run está `in_progress`/`queued` y aún no tiene `conclusion` (WR-07). Un
 *     cron corriendo con normalidad no es un cron averiado.
 *   - "n/d" → la llamada a `gh` falló (binario ausente, sin auth, timeout). Es una falla del
 *     INSTRUMENTO, no del cron: no se puede afirmar avería desde un medidor roto. El
 *     fail-closed de este módulo aplica sobre el DATO (ultimoUpsert), no sobre el medidor.
 */
export function ghRunEsAveria(ghRun: string): boolean {
  if (ghRun === "n/d (sin corridas)") return true;
  if (ghRun === "n/d (sin workflow)" || ghRun === "n/d") return false;
  // Formato "<conclusion> @ YYYY-MM-DD" producido por ghRunSignal.
  const conclusion = ghRun.split("@")[0]!.trim();
  // WR-07: un run EN CURSO (`in_progress`/`queued`) todavía no tiene `conclusion`. Antes caía en
  // el `!== success && !== skipped` ⇒ avería ⇒ `stale (gh-failure)` mientras el cron corría con
  // normalidad — falso positivo recurrente, justo el ruido que el diseño dice querer evitar. No
  // se puede afirmar avería de algo que aún no terminó: mismo criterio que el medidor roto.
  if (conclusion === GH_EN_CURSO || conclusion === "" || conclusion === "?") return false;
  return conclusion !== "success" && conclusion !== "skipped";
}

/**
 * Evalúa la frescura de cada fuente del catálogo contra los datos de la query.
 *
 * @param rows        - Resultados de queryFreshness (uno por fuente del catálogo)
 * @param catalog     - Catálogo de fuentes configuradas
 * @param now         - Fecha de referencia para calcular días transcurridos
 * @param envOverrides - Variables de entorno para override de umbral (FRESHNESS_UMBRAL_*)
 * @returns Array de resultados con flag stale por fuente
 */
export function evaluate(
  rows: QueryRow[],
  catalog: FuenteConfig[],
  now: Date,
  envOverrides: Record<string, string> = {},
): FuenteResult[] {
  return catalog.map((cfg) => {
    const row = rows.find((r) => r.fuente === cfg.fuente);

    // Override de umbral por env var (FRESHNESS_UMBRAL_<FUENTE>)
    let umbralDias = cfg.umbralDias;
    const overrideRaw = envOverrides[cfg.overrideEnv];
    if (overrideRaw !== undefined) {
      const parsed = Number.parseInt(overrideRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        umbralDias = parsed;
      }
    }

    const ultimoUpsert = row?.ultimoUpsert ?? null;
    let diasDesdeUpsert: number | null = null;

    if (ultimoUpsert !== null) {
      // WR-07: un timestamp que V8 no puede parsear → Invalid Date → getTime() NaN →
      // diasDesdeUpsert NaN, y `NaN > umbral` es false ⇒ ANTES la fuente se reportaba OK
      // (FAIL-OPEN: "monitor" mudo). Guardamos con Number.isNaN → null (= desconocido =
      // stale, MISMA regla que ultimoUpsert null). Fail-CLOSED en la señal central.
      const t = new Date(ultimoUpsert).getTime();
      diasDesdeUpsert = Number.isNaN(t)
        ? null // fecha ilegible = desconocido = stale
        : Math.floor((now.getTime() - t) / (1000 * 60 * 60 * 24));
    }

    // Staleness temporal: null (desconocido, incl. fecha ilegible) o días > umbral → stale
    const staleTemporal =
      diasDesdeUpsert === null || diasDesdeUpsert > umbralDias;

    // G4 (119-01): la señal de GH Actions entra al cálculo. ANTES se MOSTRABA y se IGNORABA
    // → una avería del cron quedaba tapada por la frescura de la tabla ("verde prestado").
    // Ahora un workflow caído (o que nunca corrió) produce stale POR SÍ SOLO, aunque la tabla
    // esté al día. Solo puede AÑADIR stale honesto, nunca quitarlo (es un OR).
    const ghRun = row?.ghRun ?? "n/d";
    const stale = staleTemporal || ghRunEsAveria(ghRun);

    let motivoStale: string | null = null;
    if (diasDesdeUpsert === null) motivoStale = "sin dato";
    else if (diasDesdeUpsert > umbralDias) motivoStale = "dias>umbral";
    else if (stale) motivoStale = "gh-failure";

    return {
      fuente: cfg.fuente,
      tabla: cfg.tabla,
      ultimoUpsert,
      diasDesdeUpsert,
      umbralDias,
      stale,
      motivoStale,
      ghRun,
      r2Snapshot: row?.r2Snapshot ?? "n/d (sin snapshots)",
    };
  });
}

export interface CoberturaResult {
  senal: string;
  etiqueta: string;
  /** numerador N (count de la señal); null si el count no se pudo leer. */
  n: number | null;
  /** denominador M (universo total = count(proyecto)); null si no se pudo leer. */
  m: number | null;
  /** porcentaje N/M redondeado a entero; null si N o M desconocidos, o M=0. */
  pct: number | null;
  esDenominador: boolean;
}

/**
 * Evalúa la cobertura N/M por señal a partir de los counts leídos (pura, sin I/O).
 *
 * M (denominador) = el count de la señal marcada `esDenominador` (proyecto). Cada
 * señal reporta su N y el porcentaje N/M. Degrada honestamente: un count faltante
 * (null) NO se reporta como 0% — se marca null (desconocido). M=0 → pct null (no
 * dividir por cero; corpus vacío no es "0% cubierto" sino "sin universo").
 */
export function evaluateCobertura(
  counts: CoberturaCount[],
  senales: CoberturaSenalConfig[],
): CoberturaResult[] {
  const denomCfg = senales.find((s) => s.esDenominador);
  const mRaw = denomCfg
    ? counts.find((c) => c.senal === denomCfg.senal)?.count ?? null
    : null;

  return senales.map((cfg) => {
    const n = counts.find((c) => c.senal === cfg.senal)?.count ?? null;
    const m = mRaw;
    let pct: number | null = null;
    if (n !== null && m !== null && m > 0) {
      pct = Math.round((n / m) * 100);
    }
    return { senal: cfg.senal, etiqueta: cfg.etiqueta, n, m, pct, esDenominador: cfg.esDenominador };
  });
}

// ─── Señal de pg_cron (G3, 119-02) ────────────────────────────────────────────

/**
 * PISO del umbral derivado, en horas. Un job que corre cada 30 segundos NO se monitorea con
 * precisión de segundos: entre la latencia de la lectura y el jitter del scheduler, exigir
 * 1 minuto produciría falsos positivos constantes. 15 minutos es el grano mínimo con el que
 * el operador puede actuar; por debajo de eso, "atrasado" no es información accionable.
 */
export const PISO_UMBRAL_HORAS = 0.25;

/**
 * Expande un campo cron al conjunto de valores que representa. Formas soportadas:
 * comodín, paso sobre comodín, valor suelto, lista separada por comas, rango, rango con paso.
 * (Las formas se describen en prosa a propósito: escribirlas literales cerraría este bloque
 * de comentario — el gotcha de 102-01.)
 */
function expandirCampo(campo: string, min: number, max: number): number[] | null {
  const out = new Set<number>();
  for (const parte of campo.split(",")) {
    const [rango, pasoRaw] = parte.split("/");
    const paso = pasoRaw === undefined ? 1 : Number.parseInt(pasoRaw, 10);
    if (!Number.isInteger(paso) || paso < 1) return null;
    let desde: number;
    let hasta: number;
    if (rango === "*") {
      desde = min;
      hasta = max;
    } else if (rango!.includes("-")) {
      const [a, b] = rango!.split("-");
      desde = Number.parseInt(a!, 10);
      hasta = Number.parseInt(b!, 10);
    } else {
      desde = Number.parseInt(rango!, 10);
      hasta = desde;
    }
    if (!Number.isInteger(desde) || !Number.isInteger(hasta)) return null;
    if (desde < min || hasta > max || hasta < desde) return null;
    for (let v = desde; v <= hasta; v += paso) out.add(v);
  }
  return out.size ? [...out].sort((a, b) => a - b) : null;
}

const MINUTOS_SEMANA = 7 * 24 * 60;

/**
 * Deriva el umbral de staleness (EN HORAS) de un schedule de pg_cron. Función PURA:
 * sin red, sin DB, sin reloj.
 *
 * REGLA: `umbral = hueco previsto más largo + un intervalo nominal de gracia`, donde el
 * intervalo de gracia es el hueco previsto más CORTO. Se enumeran todas las corridas de una
 * semana completa y se miden los huecos circulares entre corridas consecutivas.
 *
 * POR QUÉ el hueco más largo y no el nominal: un job restringido a días hábiles
 * (`... * * 1-5`) tiene un hueco legítimo de fin de semana; medirlo contra el intervalo
 * intradía marcaría STALE cada lunes por la mañana — una alarma que el operador aprende a
 * ignorar es peor que no tener alarma. POR QUÉ sumar el hueco más corto y no multiplicar:
 * una tolerancia proporcional al hueco largo (×2 o ×3) haría que 3 días de silencio en un
 * job intradía pasaran por sanos. El margen aditivo tolera UNA ventana perdida, no más.
 *
 * Devuelve `null` cuando el schedule no se sabe leer (incluidos los que restringen día del
 * mes o mes: no tienen ciclo semanal). `null` NO es "sin umbral": quien lo consume lo trata
 * como desconocido ⇒ stale. Nunca se inventa un umbral.
 */
export function umbralDesdeSchedule(schedule: string): number | null {
  const s = schedule.trim();

  // Sintaxis de intervalo de pg_cron ≥1.5: "N seconds".
  const seg = s.match(/^(\d+)\s+seconds?$/i);
  if (seg) {
    const n = Number.parseInt(seg[1]!, 10);
    if (n <= 0) return null;
    return Math.max((2 * n) / 3600, PISO_UMBRAL_HORAS);
  }

  const campos = s.split(/\s+/);
  if (campos.length !== 5) return null;
  const [minC, horaC, domC, mesC, dowC] = campos as [
    string,
    string,
    string,
    string,
    string,
  ];
  // Día del mes / mes restringidos ⇒ el ciclo no es semanal ⇒ no se deriva (fail-closed).
  if (domC !== "*" || mesC !== "*") return null;

  const minutos = expandirCampo(minC, 0, 59);
  const horas = expandirCampo(horaC, 0, 23);
  const dows = expandirCampo(dowC, 0, 7);
  if (!minutos || !horas || !dows) return null;
  const dias = [...new Set(dows.map((d) => d % 7))].sort((a, b) => a - b);

  const instantes: number[] = [];
  for (const d of dias) {
    for (const h of horas) {
      for (const m of minutos) instantes.push(d * 1440 + h * 60 + m);
    }
  }
  if (instantes.length === 0) return null;
  instantes.sort((a, b) => a - b);

  let maxGap = 0;
  let minGap = MINUTOS_SEMANA;
  for (let i = 0; i < instantes.length; i++) {
    const actual = instantes[i]!;
    const siguiente =
      i + 1 < instantes.length
        ? instantes[i + 1]!
        : instantes[0]! + MINUTOS_SEMANA;
    const gap = siguiente - actual;
    if (gap > maxGap) maxGap = gap;
    if (gap < minGap) minGap = gap;
  }
  return Math.max((maxGap + minGap) / 60, PISO_UMBRAL_HORAS);
}

export interface PgCronResult {
  jobname: string;
  jobid: number;
  /** schedule declarado en el catálogo (copiado de la migración). */
  scheduleEsperado: string;
  /** schedule leído de `cron.job`; null si el job no aparece. */
  scheduleVivo: string | null;
  /** `active` de `cron.job`; null si el job no aparece. */
  active: boolean | null;
  /** `max(start_time)` de `cron.job_run_details`; null si no hay corridas o no se pudo leer. */
  maxStartTime: string | null;
  /** horas transcurridas desde la última corrida; null si desconocido. */
  horasDesde: number | null;
  /** umbral derivado del schedule esperado, en horas; null si el schedule es ilegible. */
  umbralHoras: number | null;
  stale: boolean;
  /**
   * POR QUÉ está stale, o null si está sano:
   *   "job ausente"        → el job del catálogo no está en `cron.job`
   *   "schedule-drift"     → el schedule vivo difiere del esperado (T-119-06)
   *   "inactivo"           → `active=false`: el job existe pero no está programado
   *   "schedule-ilegible"  → no se pudo derivar umbral ⇒ no se afirma sanidad
   *   "sin corridas"       → `max(start_time)` nulo o ilegible (desconocido = stale)
   *   "horas>umbral"       → hay corrida, pero más vieja que el umbral derivado
   */
  motivoStale: string | null;
}

/**
 * Evalúa la salud de los jobs de `pg_cron` (pura, sin I/O).
 *
 * MISMA regla fail-closed que `evaluate()`: desconocido ⇒ stale. Un job sin filas en
 * `job_run_details` sale con `maxStartTime: null` y `stale: true` — JAMÁS `0` ni una fecha
 * inventada. El override de umbral (`FRESHNESS_UMBRAL_PGCRON_*`) se expresa EN HORAS.
 */
export function evaluatePgCron(
  rows: PgCronRow[],
  jobs: PgCronJobConfig[],
  now: Date,
  envOverrides: Record<string, string> = {},
): PgCronResult[] {
  return jobs.map((cfg) => {
    const row = rows.find((r) => r.jobid === cfg.jobid);

    let umbralHoras = umbralDesdeSchedule(cfg.schedule);
    const overrideRaw = envOverrides[cfg.overrideEnv];
    if (overrideRaw !== undefined) {
      const parsed = Number.parseFloat(overrideRaw);
      if (Number.isFinite(parsed) && parsed > 0) umbralHoras = parsed;
    }

    const maxStartTimeRaw = row?.maxStartTime ?? null;
    let horasDesde: number | null = null;
    if (maxStartTimeRaw !== null) {
      const t = new Date(maxStartTimeRaw).getTime();
      // Fecha ilegible = desconocido = stale (misma guarda WR-07 de evaluate()).
      horasDesde = Number.isNaN(t) ? null : (now.getTime() - t) / 3_600_000;
    }

    let motivoStale: string | null = null;
    if (!row) motivoStale = "job ausente";
    else if (row.schedule !== cfg.schedule) motivoStale = "schedule-drift";
    else if (row.active === false) motivoStale = "inactivo";
    else if (umbralHoras === null) motivoStale = "schedule-ilegible";
    else if (horasDesde === null) motivoStale = "sin corridas";
    else if (horasDesde > umbralHoras) motivoStale = "horas>umbral";

    return {
      jobname: cfg.jobname,
      jobid: cfg.jobid,
      scheduleEsperado: cfg.schedule,
      scheduleVivo: row?.schedule ?? null,
      active: row?.active ?? null,
      maxStartTime: maxStartTimeRaw,
      horasDesde,
      umbralHoras,
      stale: motivoStale !== null,
      motivoStale,
    };
  });
}
