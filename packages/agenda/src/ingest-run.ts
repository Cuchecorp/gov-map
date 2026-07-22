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
import { extraerTextoTablaPdf, parseCamaraTabla } from "./parse-camara-tabla";
import { sha256Hex } from "@obs/ingest";
import type { LLMProvider } from "@obs/llm";

/** Target R2 mínimo (envuelve `R2Store.putImmutable`). Devuelve el r2Path y si ya existía. */
export interface TablaR2Target {
  putImmutable(
    source: string,
    resource: string,
    date: string,
    sha: string,
    ext: string,
    body: Uint8Array,
  ): Promise<{ r2Path: string; existed: boolean }>;
}

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
  /**
   * Provider LLM (DeepSeek) para extraer la tabla de sala de la Cámara desde el PDF. Si se omite,
   * el paso 4 mantiene la DEGRADACIÓN HONESTA pura (enlace PDF, sin filas).
   */
  proveedorTablaCamara?: LLMProvider;
  /** Target R2 para persistir el PDF crudo (etapa 1). Gateado por `r2Enabled`. */
  r2?: TablaR2Target;
  /** Habilita la etapa 1 (R2) del PDF de la tabla. Default false (mismo gate que fichas). */
  r2Enabled?: boolean;
  /**
   * Semana ISO a la que se asocia la tabla de sala de Cámara (`prmId=0` = la vigente). Default:
   * la primera de `semanas`. La `SesionSala` se identifica `camara:sesion:<YYYY-Www>`.
   */
  semanaTablaCamara?: SemanaIso;
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
  /** Sesiones de sala de la Cámara escritas (tabla DeepSeek-desde-PDF; 0 si se degradó). */
  camaraSesiones: number;
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
  let camaraSesiones = 0;

  // ── 1. CÁMARA citaciones (enumeración de semanas ISO; 403 persistente → degrada) ────
  if (opts.soloSenado === true) {
    log("ingest: --solo-senado → se omite la fuente Cámara");
  } else {
    // WR-04: las semanas de Cámara se ingestan de forma AISLADA. Un 403 persistente
    // en una semana DEGRADA/OMITE esa semana y CONTINÚA con la siguiente (con backoff),
    // en vez de abortar toda la fuente Cámara. Se registran las semanas omitidas para
    // que el reporte distinga "bloqueada" de "obtenida-y-vacía".
    const semanasBloqueadas: string[] = [];
    // IN-02: el respaldo R2 (Etapa 1) es best-effort, pero un fallo NO puede ser invisible —
    // si R2 cae persistentemente, el dos-etapas LOCKED degrada silenciosamente a una-etapa.
    // Se enumeran las semanas cuyo crudo NO se persistió para reflejarlo como `degradación`
    // (honestidad, no error: no cambia el exit-code; la Etapa 2 siguió).
    const semanasSinRespaldoR2: string[] = [];
    for (const semana of opts.semanas) {
      const clave = semanaIsoKey(semana.year, semana.week);
      let html: string | null = null;
      // Reintento con backoff SOLO ante 403 del WAF (Cloudflare endurecido).
      for (let intento = 0; intento <= reintentos; intento++) {
        try {
          // Flujo LOCKED de 2 etapas (espejo del paso 4 sala-PDF): fetch de los BYTES crudos →
          // Etapa 1 (R2, gateado por r2Enabled, best-effort) content-addressed → decode a HTML
          // (Etapa 2) para parse+upsert. El crudo se persiste ANTES de tocar Supabase.
          const bytes = await opts.conectorCamara.fetchSemanaBytes(semana.year, semana.week);
          if (opts.r2Enabled && opts.r2) {
            try {
              const sha = await sha256Hex(bytes);
              // WR-01: la partición de la key es la SEMANA ISO ingerida (`clave`, p.ej.
              // "2026-W20"), NO la fecha de corrida (wall-clock). Así el objeto es
              // content-addressed Y estable por semana: re-fetch del mismo HTML otro día
              // produce la MISMA key → `If-None-Match: *` colisiona (412 idempotente) en vez
              // de crear un duplicado bajo un `<date>/` distinto. El hash-check pre-descarga
              // del masivo (§5) tiene así un prefijo ACOTADO (`camara/citaciones-semana/<clave>/`)
              // que probar, no un set ilimitado de fechas.
              const { r2Path: key } = await opts.r2.putImmutable(
                "camara",
                "citaciones-semana",
                clave,
                sha,
                "html",
                bytes,
              );
              log(`ingest: Cámara ${clave} → HTML crudo en R2 (${key})`);
            } catch (r2Err) {
              // R2 401/red: los bytes ya están en memoria; la Etapa 2 sigue (no aborta).
              // IN-02: se registra la semana para exponer la degradación en el reporte.
              semanasSinRespaldoR2.push(clave);
              log(
                `ingest: Cámara ${clave} → respaldo R2 falló (sigue parse): ${r2Err instanceof Error ? r2Err.message : String(r2Err)}`,
              );
            }
          }
          html = new TextDecoder().decode(bytes);
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
    // IN-02: si el respaldo R2 (Etapa 1) falló para alguna semana, se refleja como
    // degradación (NO error → no cambia exit-code): el crudo versionado NO se persistió,
    // así que el dos-etapas LOCKED quedó como una-etapa para esas semanas. Un operador
    // ve así una caída persistente de R2 en la línea-resumen en vez de que sea invisible.
    if (semanasSinRespaldoR2.length > 0) {
      degradaciones.push({
        fuente: "camara-citaciones-r2",
        motivo:
          `respaldo R2 (crudo versionado) falló para ${semanasSinRespaldoR2.length} semana(s); ` +
          `la Etapa 2 (parse+upsert) sí corrió, pero el crudo NO quedó en R2`,
        semanasOmitidas: semanasSinRespaldoR2,
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

  // ── 4. CÁMARA tabla de sala (DeepSeek-desde-PDF; degradación honesta si falla) ───────
  // Flujo LOCKED de 2 etapas: fetch PDF (con Referer anti-WAF) → R2 crudo (etapa 1, gateado)
  //   → unpdf (capa de texto) → DeepSeek extrae los ítems (etapa 2) → upsertSesiones(camara).
  // CUALQUIER fallo (soloSenado, sin provider, 403, PDF escaneado, RUT, 0 ítems) cae a la
  // DEGRADACIÓN HONESTA actual (enlace PDF, sin fabricar filas — T-06-09 / CR-01).
  let tablaCamaraEstructurada = false;
  if (opts.soloSenado !== true && opts.proveedorTablaCamara) {
    const semanaTabla = opts.semanaTablaCamara ?? opts.semanas[0];
    if (!semanaTabla) {
      log("ingest: Cámara tabla → sin semana de referencia → degrada al PDF");
    } else {
      try {
        // Etapa 0: fetch del PDF crudo (bytes) con el header-set + Referer anti-Cloudflare.
        const pdfBytes = await opts.conectorCamara.fetchTablaSalaPdf();

        // Etapa 1: persistir el crudo content-addressed en R2 (gateado; best-effort).
        if (opts.r2Enabled && opts.r2) {
          try {
            const sha = await sha256Hex(pdfBytes);
            // WR-01: partición = semana ISO de la tabla (`prmId=0` = la vigente), NO la
            // fecha de corrida. El PDF vigente re-descargado el mismo día en dos corridas
            // colisiona por sha bajo el mismo prefijo `camara/tabla-sala/<clave>/` (412
            // idempotente) en vez de duplicarse bajo `<date>/` distintos.
            const claveTabla = semanaIsoKey(semanaTabla.year, semanaTabla.week);
            const { r2Path: key } = await opts.r2.putImmutable(
              "camara",
              "tabla-sala",
              claveTabla,
              sha,
              "pdf",
              pdfBytes,
            );
            log(`ingest: Cámara tabla → PDF crudo en R2 (${key})`);
          } catch (err) {
            // R2 401/red: el PDF ya está en memoria; la etapa 2 sigue (no aborta).
            log(
              `ingest: Cámara tabla → respaldo R2 falló (sigue extracción): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        // Etapa 2a: capa de texto (unpdf). PDF escaneado/no-PDF → null → degrada honesto.
        const texto = await extraerTextoTablaPdf(pdfBytes, log);
        if (texto != null) {
          // Etapa 2b: extracción estructurada (DeepSeek json_object + zod).
          const sesiones = await parseCamaraTabla(texto, semanaTabla, {
            provider: opts.proveedorTablaCamara,
            log,
          });
          if (sesiones.length > 0) {
            await opts.writer.upsertSesiones(sesiones);
            camaraSesiones += sesiones.reduce((n, s) => n + s.items.length, 0);
            tablaCamaraEstructurada = true;
            log(
              `ingest: Cámara tabla de sala → ${sesiones.length} sesión(es), ` +
                `${camaraSesiones} ítem(s) (DeepSeek-desde-PDF)`,
            );
          }
        }
      } catch (err) {
        // 403 del WAF / fallo de red / unpdf: degrada honesto (no aborta el Senado).
        const motivo = err instanceof CamaraBloqueadaError ? "WAF 403" : "fallo";
        log(
          `ingest: Cámara tabla → ${motivo} → degrada al PDF: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Si la extracción estructurada NO produjo filas, se mantiene la DEGRADACIÓN HONESTA: se
  // registra el PDF oficial como marcador (el frontend cae al enlace). NUNCA filas inventadas.
  if (!tablaCamaraEstructurada) {
    const pdf = opts.conectorCamara.fetchPdfTabla();
    degradaciones.push({
      fuente: "camara-tabla-sala",
      motivo:
        "tabla de sala de la Cámara no disponible como dato estructurado esta corrida (solo PDF)",
      enlace: pdf.url, // === CAMARA_TABLA_PDF_URL
    });
    log(`ingest: Cámara tabla de sala → degradación honesta (PDF: ${CAMARA_TABLA_PDF_URL})`);
  }

  return {
    camaraCitaciones,
    senadoCitaciones,
    senadoSesiones,
    camaraSesiones,
    errores,
    degradaciones,
  };
}
