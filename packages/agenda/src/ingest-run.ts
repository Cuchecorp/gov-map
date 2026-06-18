// ingest-run — orquestación de la corrida de agenda: enumera semanas de Cámara, ingesta la
// ventana forward-only del Senado, expone la tabla de sala del Senado y DEGRADA honestamente
// la tabla de Cámara (PDF) — tolerante a fuentes vacías y al bloqueo de Cloudflare.
//
// Flujo:
//   1. CÁMARA citaciones — por cada semana ISO (`enumerarSemanas`): fetch+parse+upsert. Si una
//      semana da 403 (Cloudflare endurecido) → backoff y reintento; si el 403 PERSISTE, marca la
//      fuente Cámara como "temporalmente no disponible" para esta corrida y CONTINÚA (NO aborta:
//      el Senado se ingesta igual). T-06-07.
//   2. SENADO citaciones — fetch (ventana FORWARD-ONLY) + parse + upsert. NO se fabrica histórico.
//   3. SENADO tabla de sala — fetch `weekly_table` + parse + upsert sesion_sala/sesion_tabla_item.
//   4. CÁMARA tabla de sala — DEGRADACIÓN HONESTA: NO se ingestan filas; se expone la URL del PDF
//      oficial (`verDoc.aspx?prmTipo=TABLASEMANAL`) como marcador "no disponible como dato
//      estructurado". NUNCA se persiste una fila inventada (T-06-09).
//
// Devuelve un reporte por fuente (filas escritas, errores por semana, degradaciones). Tolera
// fuentes vacías/ausentes sin abortar la corrida completa.

import type { CitacionesCamaraConnector } from "./connector-camara";
import { CamaraBloqueadaError } from "./connector-camara";
import type { SenadoActividadConnector } from "./connector-senado";
import type { AgendaWriter } from "./writer";
import type { SemanaIso } from "./semana-iso";
import { semanaIsoKey } from "./semana-iso";
import { parseCamaraCitaciones } from "./parse-camara-citaciones";
import { parseSenadoCitaciones } from "./parse-senado-citaciones";
import { parseSenadoTabla } from "./parse-senado-tabla";
import { CAMARA_TABLA_PDF_URL } from "./connector-camara";

export interface RunIngestOpts {
  conectorCamara: CitacionesCamaraConnector;
  conectorSenado: SenadoActividadConnector;
  writer: AgendaWriter;
  /** Semanas ISO de Cámara a cubrir (de `enumerarSemanas`). */
  semanas: SemanaIso[];
  /** Si true, NO ingesta Cámara (solo el Senado). Default false. */
  soloSenado?: boolean;
  /** Reintentos ante 403 de Cámara antes de degradar la fuente. Default 2. */
  reintentos403?: number;
  /** Backoff base (ms) entre reintentos. Default 0 en tests; el CLI usa ~2000. */
  backoffMs?: number;
  /** Sleep inyectable (tests). Default: setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

/** Marcador de degradación de una fuente (no es un error de datos: es honestidad). */
export interface Degradacion {
  fuente: string;
  motivo: string;
  /** Enlace al artefacto disponible (p.ej. el PDF de la tabla de Cámara), si aplica. */
  enlace?: string;
  /** Semanas ISO omitidas por bloqueo persistente (WR-04): "bloqueada" ≠ "vacía". */
  semanasOmitidas?: string[];
}

export interface RunIngestResult {
  /** Citaciones de Cámara escritas (suma sobre las semanas no bloqueadas). */
  camaraCitaciones: number;
  /** Citaciones del Senado escritas. */
  senadoCitaciones: number;
  /** Sesiones de sala del Senado escritas. */
  senadoSesiones: number;
  /** Errores por (fuente/semana) — tolerados, no abortan la corrida. */
  errores: { fuente: string; clave: string; mensaje: string }[];
  /** Degradaciones honestas (Cámara bloqueada y/o tabla de Cámara = PDF). */
  degradaciones: Degradacion[];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Corre la ingesta de agenda. Idempotente (el writer upserta por clave natural). Tolerante:
 * un 403 persistente de Cámara degrada esa fuente sin abortar el Senado; la tabla de Cámara se
 * degrada al PDF sin fabricar filas.
 */
export async function runIngest(opts: RunIngestOpts): Promise<RunIngestResult> {
  const log = opts.log ?? (() => {});
  const sleep = opts.sleep ?? defaultSleep;
  const reintentos = opts.reintentos403 ?? 2;
  const backoffMs = opts.backoffMs ?? 0;

  const errores: RunIngestResult["errores"] = [];
  const degradaciones: Degradacion[] = [];
  let camaraCitaciones = 0;
  let senadoCitaciones = 0;
  let senadoSesiones = 0;

  // ── 1. CÁMARA citaciones (enumeración de semanas ISO; 403 persistente → degrada) ────
  if (opts.soloSenado === true) {
    log("ingest: --solo-senado → se omite la fuente Cámara");
  } else {
    // WR-04: las semanas de Cámara se ingestan de forma AISLADA. Un 403 persistente
    // en una semana DEGRADA/OMITE esa semana y CONTINÚA con la siguiente (con backoff),
    // en vez de abortar toda la fuente Cámara. Se registran las semanas omitidas para
    // que el reporte distinga "bloqueada" de "obtenida-y-vacía".
    const semanasBloqueadas: string[] = [];
    for (const semana of opts.semanas) {
      const clave = semanaIsoKey(semana.year, semana.week);
      let html: string | null = null;
      // Reintento con backoff SOLO ante 403 del WAF (Cloudflare endurecido).
      for (let intento = 0; intento <= reintentos; intento++) {
        try {
          html = await opts.conectorCamara.fetchSemana(semana.year, semana.week);
          break;
        } catch (err) {
          if (err instanceof CamaraBloqueadaError) {
            if (intento < reintentos) {
              log(`ingest: Cámara 403 en ${clave} (intento ${intento + 1}) → backoff`);
              await sleep(backoffMs * (intento + 1));
              continue;
            }
            // 403 PERSISTE en ESTA semana → omite SOLO esta semana y CONTINÚA con la
            // siguiente (WR-04). No aborta el resto de Cámara ni el Senado.
            log(`ingest: Cámara 403 PERSISTENTE en ${clave} → semana omitida (sigue la próxima)`);
            semanasBloqueadas.push(clave);
          } else {
            errores.push({
              fuente: "camara-citaciones",
              clave,
              mensaje: err instanceof Error ? err.message : String(err),
            });
          }
          break;
        }
      }
      if (html == null) continue; // bloqueada o error en esta semana
      try {
        const citaciones = parseCamaraCitaciones(html, clave);
        await opts.writer.upsertCitaciones(citaciones);
        camaraCitaciones += citaciones.length;
        log(`ingest: Cámara ${clave} → ${citaciones.length} citaciones`);
      } catch (err) {
        errores.push({
          fuente: "camara-citaciones",
          clave,
          mensaje: err instanceof Error ? err.message : String(err),
        });
      }
    }
    // WR-04: si alguna semana quedó bloqueada por 403 persistente, se registra UNA
    // degradación que enumera las semanas omitidas (distingue "bloqueada" de
    // "obtenida-y-vacía"); las demás semanas sí se ingestaron.
    if (semanasBloqueadas.length > 0) {
      degradaciones.push({
        fuente: "camara-citaciones",
        motivo:
          `Cloudflare bloqueó (403 persistente) ${semanasBloqueadas.length} semana(s) ` +
          `durante esta corrida; las demás semanas sí se ingestaron`,
        semanasOmitidas: semanasBloqueadas,
      });
    }
  }

  // ── 2. SENADO citaciones (ventana FORWARD-ONLY; no fabrica histórico) ───────────────
  try {
    const json = await opts.conectorSenado.fetchCitaciones();
    const citaciones = parseSenadoCitaciones(json);
    await opts.writer.upsertCitaciones(citaciones);
    senadoCitaciones += citaciones.length;
    log(`ingest: Senado citaciones (forward-only) → ${citaciones.length}`);
  } catch (err) {
    errores.push({
      fuente: "senado-citaciones",
      clave: "forward-only",
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 3. SENADO tabla de sala (orden del día estructurado) ────────────────────────────
  try {
    const json = await opts.conectorSenado.fetchTablaSala();
    const sesiones = parseSenadoTabla(json);
    await opts.writer.upsertSesiones(sesiones);
    senadoSesiones += sesiones.length;
    log(`ingest: Senado tabla de sala → ${sesiones.length} sesiones`);
  } catch (err) {
    errores.push({
      fuente: "senado-tabla",
      clave: "weekly-table",
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 4. CÁMARA tabla de sala (DEGRADACIÓN HONESTA: PDF, NUNCA filas) ─────────────────
  // No hay fuente estructurada para Cámara: se registra el PDF oficial como marcador. NO se
  // llama a upsertSesiones para Cámara → 0 filas de tabla de Cámara en la DB (T-06-09).
  const pdf = opts.conectorCamara.fetchPdfTabla();
  degradaciones.push({
    fuente: "camara-tabla-sala",
    motivo: "Cámara no publica la tabla de sala como dato estructurado (solo PDF)",
    enlace: pdf.url, // === CAMARA_TABLA_PDF_URL
  });
  log(`ingest: Cámara tabla de sala → degradación honesta (PDF: ${CAMARA_TABLA_PDF_URL})`);

  return {
    camaraCitaciones,
    senadoCitaciones,
    senadoSesiones,
    errores,
    degradaciones,
  };
}
