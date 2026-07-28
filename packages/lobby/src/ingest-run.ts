// ingest-run — orquestación de la corrida de lobby: enumera (institución, año, página), fetchea
// en el ORDEN LOCKED, aplica DRIFT BLOQUEANTE (cuarentena), parsea, reconcilia el sujeto pasivo
// y persiste — tolerante a fuentes inalcanzables (degradación honesta) y SIN fabricar filas.
//
// Difiere de @obs/agenda (drift NO-bloqueante) en un punto CLAVE (Pitfall 3 / C4): esta es una
// fuente PII volátil (leylobby: Laravel + Azure, 403/503/500 observados). Un drift ESTRUCTURAL
// (la forma del parser cambió) CUARENTENA la corrida de ESE recurso: emite 0 filas y registra
// una `DegradacionLobby`, NUNCA filas vacías/garbage que se lean como "sin lobby".
//
// Flujo por (institución, año, página):
//   1. fetch (orden LOCKED). Una institución inalcanzable (403/503) → degradación honesta, sigue.
//   2. DriftDetector en modo BLOQUEANTE: fingerprint de la forma parseada vs. el último conocido.
//      changed === true → CUARENTENA (0 filas + degradación). NO escribe.
//   3. parseLobbyAudiencias → reconciliarSujeto → writer.upsertAudiencias → writer.marcarIngestado.
//   4. Fuente vacía → 0 filas (NO inventa).

import type { LeylobbyConnector } from "./connector-leylobby";
import { LeylobbyBloqueadaError } from "./connector-leylobby";
import type { LobbyWriter } from "./writer";
import { parseLobbyAudiencias, parseListadoRowIds } from "./parse-leylobby";
import { reconciliarSujeto, type ReconciliarSujetoOpts } from "./reconciliar-sujeto";
import {
  fingerprint,
  structuralPaths,
  sha256Hex,
  type DriftStore,
  type R2Store,
  type SnapshotWriter,
} from "@obs/ingest";
import { makeProvenance, type Parlamentario } from "@obs/core";

/** Una tarea acotada: una institución + un año + un rango de páginas (1-based, inclusive). */
export interface TareaInstitucion {
  institucionCodigo: string;
  year: number;
  /** Páginas a recorrer (default [1]). */
  pages?: number[];
}

/** Marcador de degradación de una fuente (no es un error de datos: es honestidad). */
export interface DegradacionLobby {
  fuente: string;
  motivo: string;
  /** true si la causa fue un drift estructural BLOQUEANTE (cuarentena). */
  driftQuarantine?: boolean;
}

export interface RunIngestLobbyOpts {
  conector: LeylobbyConnector;
  writer: LobbyWriter;
  /** Maestra de parlamentarios para el cruce del sujeto pasivo. */
  maestra: Parlamentario[];
  /** Tareas acotadas (institución/año/páginas). */
  tareas: TareaInstitucion[];
  /** Opciones de reconciliación (provider/writer/periodo) — defaults seguros. */
  reconciliar?: ReconciliarSujetoOpts;
  /**
   * Store de drift (lee el último fingerprint conocido). Si se omite, no se evalúa drift
   * (primera corrida / tests sin store). Cuando se provee, el drift es BLOQUEANTE.
   */
  driftStore?: DriftStore;
  /** Fecha de corte para el marcador de ingesta (`ingestado_hasta`). Default: hoy (ISO date). */
  ingestadoHasta?: string;
  /**
   * Tope de páginas de DETALLE a fetchear por página de listado (corrida ACOTADA; respeta el
   * delay 2-3s del rate-limiter en cada fetch). Default 10. El listado lista sujetos pasivos,
   * cada uno con su página de detalle (la que trae el `Identificador`).
   */
  maxDetallesPorPagina?: number;
  /**
   * Store R2 para Etapa 1 (crudo HTML por tarea, content-addressed). Best-effort, no fatal.
   * Si putImmutable devuelve existed=true → log `[skip] sin novedades — leylobby <clave>` y
   * salta Etapa 2 (Supabase) para esa tarea.
   */
  r2Store?: R2Store;
  /**
   * G5 — writer de `source_snapshot` (provenance del crudo). BEST-EFFORT: un fallo NO aborta
   * la ingesta. Se escribe SOLO tras un `putImmutable` con `existed:false` (T-119-12).
   * `source` es "lobby-leylobby" — el nombre del CATÁLOGO de freshness
   * (`packages/freshness/src/catalog.ts`), que es contra lo que `r2SnapshotSignal` consulta.
   */
  snapshotWriter?: Pick<SnapshotWriter, "write">;
  log?: (msg: string) => void;
}

export interface RunIngestLobbyResult {
  /** Audiencias escritas (suma sobre las tareas no en cuarentena). */
  audiencias: number;
  /** Contrapartes escritas. */
  contrapartes: number;
  /** Parlamentarios marcados como ingestados (confirmados en esta corrida). */
  parlamentariosMarcados: number;
  /**
   * G1 — cobertura DERIVADA DE LOS DATOS que esta corrida marcó, por parlamentario confirmado
   * (`parlamentarioId → ingestado_hasta` en formato date `YYYY-MM-DD`). Vacío cuando la corrida
   * no confirmó a nadie (degradación honesta): NO se marca cobertura que no se ingirió.
   */
  marcadoHasta: Record<string, string>;
  /** Errores por (institución/año/página) — tolerados, no abortan la corrida. */
  errores: { fuente: string; clave: string; mensaje: string }[];
  /** Degradaciones honestas (institución bloqueada y/o cuarentena por drift). */
  degradaciones: DegradacionLobby[];
  /** true si alguna tarea quedó en cuarentena por drift estructural. */
  driftQuarantine: boolean;
}

const ORIGEN_DRIFT = "leylobby-audiencias";

/**
 * Corre la ingesta de lobby. Idempotente (el writer upserta por clave natural). Tolerante: una
 * institución inalcanzable degrada honestamente sin abortar; un drift estructural CUARENTENA esa
 * tarea (0 filas), NUNCA fabrica.
 */
export async function runIngestLobby(opts: RunIngestLobbyOpts): Promise<RunIngestLobbyResult> {
  const log = opts.log ?? (() => {});
  const hasta = opts.ingestadoHasta ?? new Date().toISOString().slice(0, 10);
  const maxDetalles = opts.maxDetallesPorPagina ?? 10;

  const errores: RunIngestLobbyResult["errores"] = [];
  const degradaciones: DegradacionLobby[] = [];
  // G1 / CR-02 — `parlamentarioId → ingestado_hasta`. El valor sale SIEMPRE de la FECHA DE LA
  // AUDIENCIA ingerida (máximo por parlamentario), NUNCA del reloj: un lote histórico jamás puede
  // fingir que la cobertura llega hasta hoy (T-119-17). `hasta` NO participa de este marcador —
  // sólo particiona la key de R2 de la Etapa 1.
  const marcados = new Map<string, string>();
  let audiencias = 0;
  let contrapartes = 0;
  let driftQuarantine = false;

  for (const tarea of opts.tareas) {
    const pages = tarea.pages ?? [1];
    for (const page of pages) {
      const clave = `${tarea.institucionCodigo}/${tarea.year}/p${page}`;
      let html: string;
      try {
        html = await opts.conector.fetchAudiencias(tarea.institucionCodigo, tarea.year, page);
      } catch (err) {
        if (err instanceof LeylobbyBloqueadaError) {
          // Bloqueada (403/503) → degradación honesta: NO escribe, NO fabrica, sigue la próxima.
          log(`ingest-lobby: ${clave} BLOQUEADA (HTTP ${err.status}) → degradación honesta`);
          degradaciones.push({
            fuente: clave,
            motivo: `leylobby bloqueó el fetch (HTTP ${err.status}); sin filas para esta tarea`,
          });
        } else {
          errores.push({
            fuente: "leylobby-audiencias",
            clave,
            mensaje: err instanceof Error ? err.message : String(err),
          });
        }
        continue;
      }

      // Etapa 1 R2 (best-effort): persiste el HTML crudo de audiencias content-addressed.
      // Si existed=true → el contenido no cambió → skip Etapa 2 para esta tarea.
      if (opts.r2Store) {
        try {
          const bytes = new TextEncoder().encode(html);
          const sha = await sha256Hex(bytes);
          const date = hasta.slice(0, 10);
          const { r2Path, existed } = await opts.r2Store.putImmutable(
            "leylobby",
            clave,
            date,
            sha,
            "html",
            bytes,
          );
          if (existed) {
            log(`[skip] sin novedades — leylobby ${clave}`);
            continue;
          }
          log(`leylobby: crudo en R2 → ${r2Path}`);
          // G5: la fila de provenance va DESPUÉS del put con existed:false — jamás se
          // registra un snapshot cuyo objeto no se acabe de escribir (T-119-12).
          // BEST-EFFORT: su fallo no aborta la Etapa 2 (parse + upsert) de esta tarea.
          if (opts.snapshotWriter) {
            try {
              await opts.snapshotWriter.write({
                source: "lobby-leylobby",
                resource: clave,
                cacheKey: `lobby-leylobby:${clave}:${date}`,
                r2Path,
                contentHash: sha,
                fingerprint: sha,
                dateBucket: date,
                provenance: makeProvenance(
                  "lobby-leylobby",
                  opts.conector.urlAudiencias(tarea.institucionCodigo, tarea.year, page),
                ),
              });
              log(`leylobby: fila source_snapshot escrita (${clave})`);
            } catch (snapErr) {
              log(
                `leylobby: source_snapshot falló (no fatal): ` +
                  `${snapErr instanceof Error ? snapErr.message : String(snapErr)}`,
              );
            }
          }
        } catch (err) {
          log(`leylobby: Etapa 1 R2 falló (no fatal): ${(err as Error).message}`);
        }
      }

      // CRAWL LOCKED DE DOS PASOS: el LISTADO lista sujetos pasivos (sin `Identificador`), cada uno
      // con un link a su página de DETALLE (la que trae la tabla keyed por `Identificador`). Se
      // extraen los rowIds del listado y se fetchea cada detalle (rate-limited, acotado a
      // `maxDetalles`). Si el HTML ya ES un detalle (trae audiencias con Identificador), se usa
      // directo (soporta inyectar un detalle en tests).
      let parsed = parseLobbyAudiencias(html, {
        institucionCodigo: tarea.institucionCodigo,
        enlace: opts.conector.urlAudiencias(tarea.institucionCodigo, tarea.year, page),
      });
      if (parsed.length === 0) {
        const rowIds = parseListadoRowIds(html, tarea.year).slice(0, maxDetalles);
        for (const rowId of rowIds) {
          let detalleHtml: string;
          try {
            detalleHtml = await opts.conector.fetchDetalle(
              tarea.institucionCodigo,
              tarea.year,
              rowId,
            );
          } catch (err) {
            if (err instanceof LeylobbyBloqueadaError) {
              degradaciones.push({
                fuente: `${clave}/${rowId}`,
                motivo: `leylobby bloqueó el detalle (HTTP ${err.status}); sin filas`,
              });
            } else {
              errores.push({
                fuente: "leylobby-audiencias",
                clave: `${clave}/${rowId}`,
                mensaje: err instanceof Error ? err.message : String(err),
              });
            }
            continue;
          }
          const det = parseLobbyAudiencias(detalleHtml, {
            institucionCodigo: tarea.institucionCodigo,
            enlace: opts.conector.urlDetalle(tarea.institucionCodigo, tarea.year, rowId),
          });
          parsed = parsed.concat(det);
        }
      }

      // DRIFT BLOQUEANTE (Pitfall 3 / C4): compara la forma parseada contra el último fingerprint
      // conocido de este recurso. Si CAMBIÓ → CUARENTENA: 0 filas + degradación, NUNCA escribe.
      if (opts.driftStore) {
        const recurso = `${tarea.institucionCodigo}/${tarea.year}`;
        // El fingerprint usa la forma de una muestra (la 1.ª audiencia) o, si está vacía, la del
        // documento — `structuralPaths` produce la forma, no los valores.
        const muestra = parsed.length > 0 ? parsed[0] : { __vacio: true };
        const fp = await fingerprint(muestra);
        const prev = await opts.driftStore.lastFingerprint(ORIGEN_DRIFT, recurso);
        if (prev !== undefined && prev !== fp) {
          driftQuarantine = true;
          log(
            `ingest-lobby: ${clave} DRIFT ESTRUCTURAL (forma cambió) → CUARENTENA (0 filas, no escribe)`,
          );
          degradaciones.push({
            fuente: clave,
            motivo:
              "drift estructural: la forma del HTML de audiencias cambió respecto al golden; " +
              "la corrida de este recurso se puso en cuarentena para no emitir filas que se lean como 'sin lobby'",
            driftQuarantine: true,
          });
          // Registra el nuevo fingerprint (la alerta) pero NO escribe filas.
          await opts.driftStore.insertAlert({
            source: ORIGEN_DRIFT,
            resource: recurso,
            prevFingerprint: prev,
            newFingerprint: fp,
          });
          continue;
        }
        // Primera vez (sin previo) o sin cambio → registra/refresca el fingerprint conocido.
        if (prev === undefined) {
          await opts.driftStore.insertAlert({
            source: ORIGEN_DRIFT,
            resource: recurso,
            newFingerprint: fp,
          });
        }
      }

      // Fuente vacía → 0 filas (NO inventa). Reconcilia + escribe.
      try {
        const { audiencias: filas, parlamentariosConfirmados } = await reconciliarSujeto(
          parsed,
          opts.maestra,
          opts.reconciliar ?? {},
        );
        await opts.writer.upsertAudiencias(filas);
        audiencias += filas.length;
        contrapartes += filas.reduce((n, f) => n + f.contrapartes.length, 0);
        // G1 / CR-02 (119-REVIEW): la cobertura de CADA parlamentario confirmado es la fecha
        // MÁXIMA de sus audiencias ingeridas en esta corrida — DATO, NUNCA reloj.
        //
        // NO HAY FALLBACK AL RELOJ. Antes existían dos escapes (`?? hasta` por fila y un bucle de
        // relleno para los confirmados sin fila) que marcaban `ingestado_hasta = HOY` sin un solo
        // dato de esa fecha. La fuente entrega fechas sucias —por eso existe `fechaRaw`—, así que
        // ese fallback NO era teórico: una audiencia con `fecha` no parseable fabricaba cobertura
        // hasta hoy. Hoy, una fila sin fecha del dato simplemente NO empuja el cursor; si NINGUNA
        // fila del parlamentario trae fecha, ese parlamentario NO se marca (degradación honesta:
        // la marca se queda donde estaba, que es la verdad conocida).
        const confirmados = new Set(parlamentariosConfirmados);
        for (const f of filas) {
          const id = f.enlace?.parlamentarioId;
          if (id == null || !confirmados.has(id)) continue;
          if (f.fecha == null) continue; // sin dato de fecha ⇒ no se marca cobertura
          const fechaDato = f.fecha.slice(0, 10);
          const prev = marcados.get(id);
          if (prev === undefined || fechaDato > prev) marcados.set(id, fechaDato);
        }
        log(`ingest-lobby: ${clave} → ${filas.length} audiencias`);
      } catch (err) {
        errores.push({
          fuente: "leylobby-audiencias",
          clave,
          mensaje: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // G1 — Marca a los parlamentarios CONFIRMADOS en esta corrida (un row por id) en el marcador de
  // cobertura `lobby_ingesta_estado`. Se agrupa por `ingestado_hasta` porque distintos
  // parlamentarios pueden tener distinta fecha máxima ingerida, y `marcarIngestado` toma un solo
  // `hasta` por lote. `marcados` vacío ⇒ CERO escrituras: un barrido que no confirmó a nadie NO
  // es "ingestado" para nadie (ver `POR QUÉ DOS CURSORES` en cursor-leylobby.ts).
  const porHasta = new Map<string, string[]>();
  for (const [id, h] of marcados) {
    const lote = porHasta.get(h);
    if (lote) lote.push(id);
    else porHasta.set(h, [id]);
  }
  // WR-09 (119-REVIEW): cada upsert del loop principal vive dentro de un `try` que anota en
  // `errores` y continúa; este cierre NO lo tenía. Un error de PostgREST aquí lanzaba y
  // `runIngestLobby` no devolvía NADA: se perdían `errores`, `degradaciones` y los conteos de las
  // audiencias YA ESCRITAS, y el CLI reportaba un fallo genérico en vez del reporte honesto que la
  // fase promete. El marcador es el ÚLTIMO paso: su fallo no invalida lo ya ingerido.
  for (const [h, ids] of porHasta) {
    try {
      await opts.writer.marcarIngestado(ids, h);
    } catch (err) {
      errores.push({
        fuente: "lobby_ingesta_estado",
        clave: h,
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    audiencias,
    contrapartes,
    parlamentariosMarcados: marcados.size,
    marcadoHasta: Object.fromEntries(marcados),
    errores,
    degradaciones,
    driftQuarantine,
  };
}

/** Helper exportado para tests: el set de paths estructurales de una audiencia parseada. */
export function formaDe(obj: unknown): string[] {
  return structuralPaths(obj);
}
