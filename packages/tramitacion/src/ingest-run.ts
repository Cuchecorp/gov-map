// ingest-run — orquestación de la corrida ACOTADA: descubrir → fetch → parse → reconciliar →
// materializar timeline → upsert idempotente.
//
// Para una lista acotada de boletines (Leg 58), por cada uno:
//   1. Senado tramitación → Proyecto + eventos (el `descripcion` alimenta la ficha).
//   2. Cámara votaciones → Votacion[]; por cada votación, detalle → voto-a-voto por Diputado/Id
//      (reconciliarVotosCamara, determinista, sin LLM).
//   3. Senado votaciones → Votacion[] + voto-a-voto por nombre (reconciliarVotosSenado vía
//      correrPipeline; guarda LOCKED: solo determinista vincula).
//   4. Timeline materializado: eventos del Senado + eventoDesdeVotacion(v) por cada Votacion de
//      ambas cámaras → fusionarTimeline.
//   5. Upsert vía el writer (proyecto/votacion/voto/tramitacion_evento). Provenance inline.
//
// Tolera fuentes vacías/ausentes por boletín sin abortar la corrida completa (un boletín en
// primer trámite Cámara no tiene votos Senado; uno solo del Senado no tiene votaciones Cámara).
// El `provider` LLM es OPCIONAL: las menciones deterministas no lo tocan; las dudosas degradan
// a `no_confirmado` (fail-closed) o, con provider+writer reales, van a la cola de revisión.

import type { Parlamentario } from "@obs/core";
import type { PipelineWriter } from "@obs/adjudication";
import type { CamaraConnector } from "./connector-camara";
import type { SenadoConnector } from "./connector-senado";
import type { TramitacionWriter } from "./writer";
import type {
  Proyecto,
  Votacion,
  Voto,
  TramitacionEvento,
} from "./model";
import { parseCamaraVotacion, parseCamaraVotoDetalle } from "./parse-camara-votacion";
import { parseSenadoTramitacion } from "./parse-senado-tramitacion";
import { parseSenadoVotaciones } from "./parse-senado-votacion";
import { reconciliarVotosCamara } from "./reconciliar-camara";
import {
  reconciliarVotosSenado,
  type ReconciliarSenadoOpts,
} from "./reconciliar-senado";
import { fusionarTimeline, eventoDesdeVotacion } from "./timeline";

/** Provider LLM (derivado de la firma de reconciliarVotosSenado para no atar @obs/llm directo). */
type LLMProvider = NonNullable<ReconciliarSenadoOpts["provider"]>;

export interface RunIngestOpts {
  /** Lista explícita de boletines (con o sin sufijo). Si falta, se descubren por `anno`. */
  boletines?: string[];
  /** Año/legislatura a descubrir si no se pasan `boletines`. Default 2026 (Leg 58). */
  anno?: number;
  /** Recorte del conjunto descubierto (alcance ACOTADO — WAF + tiempo). */
  limite?: number;
  /** Maestra ya cargada (de la DB o el seed). */
  maestra: Parlamentario[];
  camara: CamaraConnector;
  senado: SenadoConnector;
  writer: TramitacionWriter;
  /** Provider LLM opcional (MiniMax en LIVE; sin él, lo dudoso degrada fail-closed). */
  provider?: LLMProvider;
  /** Writer del pipeline de identidad (cola de revisión). Opcional. */
  pipelineWriter?: PipelineWriter;
  /** Sink de logs (inyectable para tests). Default: noop. */
  log?: (msg: string) => void;
}

export interface RunIngestResult {
  proyectos: number;
  votaciones: number;
  votos: number;
  eventos: number;
  /** Boletines que fallaron al fetchear/parsear (no abortan la corrida; se reportan). */
  errores: { boletin: string; etapa: string; mensaje: string }[];
}

/** Quita el sufijo de comisión de un boletín ("18296-05" → "18296"; "18296" → "18296"). */
function baseDe(boletin: string): string {
  return boletin.replace(/-\d+$/, "");
}

/**
 * Corre la ingesta acotada. Devuelve los conteos por entidad + los errores por boletín
 * (tolerados, no abortan). Idempotente: re-correr con el mismo input no duplica (el writer
 * upserta por clave natural).
 */
export async function runIngest(opts: RunIngestOpts): Promise<RunIngestResult> {
  const log = opts.log ?? (() => {});
  const errores: RunIngestResult["errores"] = [];

  // 1. Lista de boletines: explícita o descubierta + recortada al límite.
  let boletines = opts.boletines ?? [];
  if (boletines.length === 0) {
    const anno = opts.anno ?? 2026;
    log(`ingest: descubriendo boletines de ${anno} (Leg 58)…`);
    boletines = await opts.camara.descubrirBoletines(anno);
    log(`ingest: ${boletines.length} boletines descubiertos`);
  }
  if (opts.limite != null && opts.limite > 0) {
    boletines = boletines.slice(0, opts.limite);
  }
  log(`ingest: procesando ${boletines.length} boletines (acotado)…`);

  let nProyectos = 0;
  let nVotaciones = 0;
  let nVotos = 0;
  let nEventos = 0;

  const reconcOpts = (votacionId: string): ReconciliarSenadoOpts => ({
    votacionId,
    ...(opts.provider !== undefined ? { provider: opts.provider } : {}),
    ...(opts.pipelineWriter !== undefined ? { writer: opts.pipelineWriter } : {}),
  });

  for (const boletinFull of boletines) {
    const base = baseDe(boletinFull);
    const votacionesBoletin: Votacion[] = [];
    const votosBoletin: Voto[] = [];
    let proyecto: Proyecto | null = null;
    let eventosSenado: TramitacionEvento[] = [];

    // 2. Senado tramitación → Proyecto + eventos (la ficha lee el descripcion de aquí).
    try {
      const tramXml = await opts.senado.fetchTramitacion(base);
      const parsed = parseSenadoTramitacion(tramXml);
      if (parsed.proyecto.boletin.length > 0) {
        proyecto = parsed.proyecto;
        eventosSenado = parsed.eventos;
      }
    } catch (err) {
      errores.push({
        boletin: boletinFull,
        etapa: "senado-tramitacion",
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }

    // El boletín efectivo para FK: el del proyecto del Senado si lo hay; si no, el de entrada.
    const boletinKey = proyecto?.boletin ?? boletinFull;

    // 3. Cámara votaciones + detalle voto-a-voto (determinista por Diputado/Id).
    try {
      const votXml = await opts.camara.fetchVotacionesBoletin(base);
      const votacionesCam = parseCamaraVotacion(votXml).map((v) => ({
        ...v,
        boletin: boletinKey,
      }));
      for (const v of votacionesCam) {
        votacionesBoletin.push(v);
        // El id del WS es la parte tras "camara:".
        const wsId = v.id.replace(/^camara:/, "");
        try {
          const detXml = await opts.camara.fetchVotacionDetalle(wsId);
          const crudos = parseCamaraVotoDetalle(detXml);
          const votos = reconciliarVotosCamara(crudos, v.id, opts.maestra);
          votosBoletin.push(...votos);
        } catch (err) {
          errores.push({
            boletin: boletinFull,
            etapa: `camara-detalle:${wsId}`,
            mensaje: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      errores.push({
        boletin: boletinFull,
        etapa: "camara-votaciones",
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }

    // 4. Senado votaciones nominales (puede venir vacío — Pitfall 2, no error).
    try {
      const senVotXml = await opts.senado.fetchVotaciones(base);
      const senVotaciones = parseSenadoVotaciones(senVotXml, boletinKey);
      for (const sv of senVotaciones) {
        votacionesBoletin.push(sv.votacion);
        const votos = await reconciliarVotosSenado(
          sv.votos,
          opts.maestra,
          reconcOpts(sv.votacion.id),
        );
        votosBoletin.push(...votos);
      }
    } catch (err) {
      errores.push({
        boletin: boletinFull,
        etapa: "senado-votaciones",
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }

    // Si no hubo proyecto del Senado pero sí votaciones, fabricamos un Proyecto mínimo desde
    // la primera votación (la ficha necesita una fila proyecto para la FK; no inventa datos).
    if (proyecto == null && votacionesBoletin.length > 0) {
      const v0 = votacionesBoletin[0]!;
      proyecto = {
        boletin: boletinKey,
        boletin_num: base,
        titulo: "",
        iniciativa: null,
        camara_origen: null,
        autores: [],
        materia: null,
        estado: null,
        etapa: null,
        subetapa: null,
        origen: v0.origen,
        fecha_captura: v0.fecha_captura,
        enlace: v0.enlace,
      };
    }

    if (proyecto == null) {
      log(`ingest: boletín ${boletinFull} sin datos (Senado+Cámara vacíos) → omitido`);
      continue;
    }

    // 5. Timeline materializado: eventos del Senado + cada Votacion como evento, fusionados.
    const eventosVotacion = votacionesBoletin.map((v) => eventoDesdeVotacion(v));
    const eventos = fusionarTimeline([eventosSenado, eventosVotacion]).map((e) => ({
      ...e,
      boletin: boletinKey,
    }));

    // 6. Upsert idempotente (orden: proyecto antes que votacion/evento por la FK; votacion
    //    antes que voto por la FK voto.votacion_id).
    await opts.writer.upsertProyecto(proyecto);
    await opts.writer.upsertVotacion(votacionesBoletin);
    await opts.writer.upsertVotos(votosBoletin);
    await opts.writer.upsertEventos(eventos);

    nProyectos += 1;
    nVotaciones += votacionesBoletin.length;
    nVotos += votosBoletin.length;
    nEventos += eventos.length;
    log(
      `ingest: ${boletinKey} → ${votacionesBoletin.length} votaciones, ` +
        `${votosBoletin.length} votos, ${eventos.length} eventos`,
    );
  }

  return {
    proyectos: nProyectos,
    votaciones: nVotaciones,
    votos: nVotos,
    eventos: nEventos,
    errores,
  };
}
