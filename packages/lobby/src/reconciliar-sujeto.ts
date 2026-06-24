// reconciliar-sujeto — cruce del SUJETO PASIVO (el funcionario) de cada audiencia de lobby
// contra la maestra de parlamentarios vía `correrPipeline` (Fase 4). Espeja
// reconciliar-senado.ts archivo-por-archivo.
//
// GUARDA DE IDENTIDAD LOCKED (riesgo existencial #1, IDENT-12):
//   SOLO `tipo === "determinista"` (nombre único en cámara+periodo, o RUT exacto) mintea un
//   `EnlaceConfirmado` vía `confirmar()` y puebla el FK + `estado_vinculo = "confirmado"`.
//   `probable`/`revision`/`no_confirmado` → `enlace: null` + `estado_vinculo: "no_confirmado"` +
//   mención cruda preservada (NUNCA vincula a la ficha pública). Cada decisión deja una fila en
//   `identidad_audit` (vía el writer del pipeline).
//
// CONTRAPARTES (Δ3, ENT-03): los asistentes no-sujeto-pasivo son TERCEROS y AHORA se reconcilian
// contra la maestra de terceros (`opts.maestraEntidad`) vía `matchDeterministaEntidad`. SOLO un
// match confirmado puebla `contraparteId` con un `EnlaceEntidadConfirmado` (branded). Cualquier otro
// caso (jurídica-sin-RUT por Δ2, homónimo, sin candidato, o SIN maestra inyectada) deja
// `contraparteId: null` + la fila cruda preservada (degradación honesta). Un tercero NUNCA se enlaza
// a una PERSONA (parlamentario) — solo a su propia maestra `entidad_tercero`.
//
// `provider`/`writer` son inyectables (mock/espía en tests, MiniMax + RevisionWriter reales en
// LIVE) con defaults seguros: sin provider, un homónimo del sujeto pasivo degrada a
// `no_confirmado` (fail-closed); un determinista resuelve igual (correrPipeline corta antes del LLM).

import type { Parlamentario, Camara } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";
import {
  matchDeterministaEntidad,
  confirmarEntidad,
  type EnlaceEntidadConfirmado,
  type EntidadTerceroRow,
  type TipoEntidad,
} from "@obs/identity";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
} from "@obs/adjudication";

import {
  ROL_SUJETO_PASIVO,
  type LobbyAsistente,
  type LobbyAudiencia,
  type LobbyContraparte,
} from "./model";

// El provider LLM se tipa derivándolo de la firma de `correrPipeline` (3.er parámetro), evitando
// un edge directo a `@obs/llm` (como hace reconciliar-senado).
type LLMProvider = Parameters<typeof correrPipeline>[2];

/** Periodo del blocking del pipeline por defecto (filtro DURO). Sobreescribible por opts. */
const PERIODO_LOBBY_DEFAULT = "senado-vigente-2026";

/** Writer no-op: descarta toda escritura (cuando el caller no inyecta uno). */
const NOOP_WRITER: PipelineWriter = {
  async upsertVinculo() {
    return null;
  },
  async appendAudit() {
    /* descarta */
  },
  async enqueueRevision() {
    /* descarta */
  },
};

/**
 * Provider que LANZA si se invoca: fuerza fail-closed cuando no se inyectó uno real y un sujeto
 * pasivo llegaría al LLM (homónimo). Los deterministas NUNCA lo tocan (0 llamadas).
 */
const PROVIDER_AUSENTE: LLMProvider = {
  id: "sin-provider",
  trainsOnInputs: false,
  async complete() {
    throw new Error(
      "reconciliarSujeto: se requiere un provider LLM para resolver un sujeto pasivo ambiguo (homónimo)",
    );
  },
};

/** Contraparte lista para el writer (tercero, con su FK branded a la maestra de terceros). */
export interface ContraparteParaEscribir {
  nombre: string;
  rol: string;
  representadoText: string | null;
  /**
   * FK branded del tercero a `entidad_tercero` (Δ3, ENT-03): minteado SOLO en un match confirmado
   * (`matchDeterministaEntidad` → `confirmarEntidad`). null si no confirma (jurídica-sin-RUT,
   * homónimo, sin candidato, o sin maestra inyectada). Un string crudo NO compila aquí.
   */
  contraparteId: EnlaceEntidadConfirmado | null;
}

/**
 * Audiencia lista para el writer: la raíz (con el FK branded `EnlaceConfirmado | null`) + las
 * contrapartes anidadas (crudas). El writer aplana al storage plano (`parlamentario_id: string|null`).
 */
export interface AudienciaParaEscribir {
  identificador: string;
  institucionCodigo: string;
  /** FK branded del sujeto pasivo: minteado SOLO en determinista (un string crudo no compila). */
  enlace: EnlaceConfirmado | null;
  mencionSujeto: string;
  estadoVinculo: "confirmado" | "no_confirmado" | null;
  fecha: string | null;
  fechaRaw: string | null;
  materia: string | null;
  enlaceDetalle: string | null;
  contrapartes: ContraparteParaEscribir[];
  origen: string;
  fecha_captura: string;
  enlace_url: string;
}

/** Opciones de reconciliación (provider/writer inyectables, defaults seguros). */
export interface ReconciliarSujetoOpts {
  /** Provider LLM; no se invoca para los sujetos pasivos que resuelven determinísticamente. */
  provider?: LLMProvider;
  /** Writer del pipeline (cola/vínculo/audit). */
  writer?: PipelineWriter;
  /** Periodo del blocking (filtro DURO). Default `PERIODO_LOBBY_DEFAULT`. */
  periodo?: string;
  /**
   * Cámara del blocking (filtro DURO de `MencionForanea.camara`). Default `"senado"` —
   * preserva el comportamiento de leylobby (el cruce real es por nombre + periodo). El runner de
   * la Cámara lo afina a `"diputados"` para cruzar contra los diputados de la maestra.
   */
  camara?: string;
  /**
   * Nombre del sujeto pasivo USADO PARA EL CRUCE (matching). Default = el nombre crudo del
   * sujeto pasivo (`sujetoPasivoDe`). Permite, p.ej. en la Cámara, extraer el diputado real
   * cuando el sujeto pasivo publicado es un asesor (`(... H.D. <Nombre>)`). El `mencionSujeto`
   * ALMACENADO sigue siendo el crudo (trazabilidad); solo cambia con qué nombre se busca.
   */
  nombreParaCruce?: (aud: LobbyAudiencia) => string | null;
  /**
   * Maestra de TERCEROS (`entidad_tercero`) contra la que se reconcilian las contrapartes (Δ3).
   * Si se omite, NINGUNA contraparte resuelve (`contraparteId: null`) — degradación honesta que
   * preserva el comportamiento previo (todos los FK null) cuando el caller no tiene la maestra.
   */
  maestraEntidad?: EntidadTerceroRow[];
  /**
   * Discriminador del tipo de entidad de una contraparte. Default `"natural"` (la mayoría de las
   * contrapartes de LeyLobby son gestores persona-natural). El runner puede inferir `"juridica"`
   * desde el rol crudo (p.ej. "Representante de Persona Jurídica"). Δ2: una jurídica SOLO confirma
   * por RUT exacto; sin RUT (LeyLobby no lo trae) queda `no_confirmado` → `contraparteId: null`.
   */
  tipoEntidadContraparte?: (cp: LobbyAsistente) => TipoEntidad;
  /**
   * RUT de una contraparte cuando la fuente lo trae (LeyLobby NO lo publica → default null).
   * SOLO entra al matcher determinista (RUT exacto); NUNCA cruza a un canal LLM (las contrapartes
   * no van al pipeline). Inyectable para fuentes que sí traen RUT de tercero.
   */
  rutContraparte?: (cp: LobbyAsistente) => string | null;
}

/** Resultado de la reconciliación: filas para-escribir + el set de FKs confirmados (marcador). */
export interface ResultadoReconciliacion {
  audiencias: AudienciaParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida (para `marcarIngestado`). */
  parlamentariosConfirmados: string[];
}

/** Config de resolución de terceros (maestra + discriminadores) derivada de las opts. */
interface ResolucionContraparteCfg {
  maestraEntidad: EntidadTerceroRow[];
  tipoEntidadContraparte: (cp: LobbyAsistente) => TipoEntidad;
  rutContraparte: (cp: LobbyAsistente) => string | null;
}

/**
 * Mapea la forma para-escribir de las contrapartes (asistentes no-sujeto-pasivo) reconciliando cada
 * una contra la maestra de terceros (Δ3, ENT-03). SOLO un match confirmado puebla `contraparteId`
 * con un `EnlaceEntidadConfirmado` (branded); cualquier otro caso deja null + la fila cruda. Un
 * tercero se enlaza SOLO a su propia maestra (`entidad_tercero`), NUNCA a un parlamentario.
 */
function contrapartesDe(
  aud: LobbyAudiencia,
  cfg: ResolucionContraparteCfg,
): ContraparteParaEscribir[] {
  return aud.asistentes
    .filter((a) => a.rol !== ROL_SUJETO_PASIVO)
    .map((a) => ({
      nombre: a.nombre,
      rol: a.rol ?? "",
      representadoText: a.representado ?? null,
      contraparteId: resolverContraparte(a, cfg),
    }));
}

/**
 * Resuelve UNA contraparte contra la maestra de terceros vía `matchDeterministaEntidad`. Fail-closed:
 * mintea el FK branded SOLO cuando el matcher confirma; en cualquier otro estado (incl. jurídica-sin-RUT
 * por Δ2, homónimo, sin candidato, o maestra vacía) devuelve null. DATA-ROUTING: el RUT (cuando exista)
 * SOLO alimenta el matcher determinista; NUNCA cruza a un canal LLM (las contrapartes no van al pipeline).
 */
function resolverContraparte(
  cp: LobbyAsistente,
  cfg: ResolucionContraparteCfg,
): EnlaceEntidadConfirmado | null {
  const nombre = cp.nombre?.trim() ?? "";
  if (nombre.length === 0 || cfg.maestraEntidad.length === 0) {
    return null;
  }
  const { nombre_normalizado } = normalizarNombre({ libre: nombre });
  const rut = cfg.rutContraparte(cp);
  const res = matchDeterministaEntidad(
    {
      nombreNormalizado: nombre_normalizado,
      tipoEntidad: cfg.tipoEntidadContraparte(cp),
      ...(rut != null && rut.trim() !== "" ? { rut } : {}),
    },
    cfg.maestraEntidad,
  );
  // GUARDA LOCKED (ENT-03): SOLO un match confirmado mintea el FK branded.
  return res.estado === "confirmado" ? confirmarEntidad(res.id, "determinista") : null;
}

/** Devuelve el nombre del sujeto pasivo de la audiencia (el primer asistente `Sujeto Pasivo`). */
function sujetoPasivoDe(aud: LobbyAudiencia): string | null {
  const sp = aud.asistentes.find((a) => a.rol === ROL_SUJETO_PASIVO);
  return sp ? sp.nombre.trim() : null;
}

/**
 * Reconcilia el sujeto pasivo de cada audiencia contra la maestra vía `correrPipeline` (SOLO
 * determinista mintea un `EnlaceConfirmado` y puebla el FK del parlamentario) Y cada contraparte
 * contra la maestra de terceros (Δ3: SOLO un match confirmado puebla `contraparteId` con un
 * `EnlaceEntidadConfirmado`). El resto deja el FK respectivo en null + mención cruda. Idempotente y puro.
 */
export async function reconciliarSujeto(
  audiencias: LobbyAudiencia[],
  maestra: Parlamentario[],
  opts: ReconciliarSujetoOpts = {},
): Promise<ResultadoReconciliacion> {
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const periodo = opts.periodo ?? PERIODO_LOBBY_DEFAULT;
  const camara = opts.camara ?? "senado";
  // Config de resolución de TERCEROS (Δ3). Sin maestra inyectada → ninguna contraparte confirma
  // (degradación honesta que preserva el comportamiento previo). Default tipo 'natural' / rut null.
  const cfgContraparte: ResolucionContraparteCfg = {
    maestraEntidad: opts.maestraEntidad ?? [],
    tipoEntidadContraparte: opts.tipoEntidadContraparte ?? (() => "natural"),
    rutContraparte: opts.rutContraparte ?? (() => null),
  };
  // Nombre para el CRUCE: por defecto el crudo del sujeto pasivo (idéntico al almacenado → nada
  // cambia para leylobby). El caller puede inyectar una extracción (p.ej. el diputado real de un
  // asesor en la Cámara). El nombre ALMACENADO (`mencionTexto`) sigue siendo siempre el crudo.
  const nombreParaCruce = opts.nombreParaCruce ?? sujetoPasivoDe;
  // ¿Se inyectó un provider real? Si NO, un homónimo del sujeto pasivo que llegue al LLM no debe
  // ABORTAR la corrida entera (a diferencia del voto, donde el provider es obligatorio): degrada
  // ese sujeto a `no_confirmado` (fail-closed, NUNCA fabrica un enlace). Los deterministas
  // resuelven igual (correrPipeline corta antes del LLM, 0 llamadas).
  const proveedorAusente = opts.provider === undefined;

  const out: AudienciaParaEscribir[] = [];
  const confirmados = new Set<string>();

  for (const aud of audiencias) {
    // ALMACENADO: el nombre crudo del sujeto pasivo (trazabilidad / honest-state — nunca cambia).
    const mencionRaw = sujetoPasivoDe(aud);
    // CRUCE: el nombre con el que se busca en la maestra (por defecto el crudo).
    const mencionCruce = nombreParaCruce(aud);

    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: "confirmado" | "no_confirmado" | null = null;
    // La mención almacenada es SIEMPRE el crudo del sujeto pasivo (independiente del cruce).
    let mencionTexto = mencionRaw ?? "";

    if (mencionCruce && mencionCruce.length > 0) {
      const { nombre_normalizado, tokens } = normalizarNombre({ libre: mencionCruce });
      const mencion: MencionForanea = {
        nombreOriginal: mencionCruce,
        nombreNormalizado: nombre_normalizado,
        tokens,
        // El lobby del congreso cruza contra ambas cámaras; el blocking filtra por cámara+periodo.
        // Default "senado" (ancla del periodo default, igual que reconciliar-senado); el runner de
        // la Cámara afina a "diputados". Column-agnostic: el cruce real es por nombre, pero el tipo
        // de `MencionForanea.camara` es la unión `Camara` ("diputados" | "senado").
        camara: camara as Camara,
        periodo,
        region: null,
      };
      let res: Awaited<ReturnType<typeof correrPipeline>> | null = null;
      try {
        res = await correrPipeline(mencion, maestra, provider, writer);
      } catch (err) {
        // Sin provider real, un homónimo llega al LLM ausente y lanza. Fail-closed honesto:
        // se degrada ESE sujeto a `no_confirmado` (NUNCA se fabrica un enlace) y la corrida sigue.
        if (proveedorAusente) {
          enlace = null;
          estadoVinculo = "no_confirmado";
          out.push(filaParaEscribir(aud, enlace, mencionTexto, estadoVinculo, cfgContraparte));
          continue;
        }
        // Con un provider real inyectado, un error del LLM SÍ propaga (no se enmascara).
        throw err;
      }

      // GUARDA LOCKED (IDENT-12): SOLO determinista mintea un EnlaceConfirmado y puebla el FK.
      switch (res.tipo) {
        case "determinista":
          enlace = confirmar(res.parlamentarioId, "determinista");
          estadoVinculo = "confirmado";
          confirmados.add(res.parlamentarioId);
          break;
        case "probable":
        case "revision":
        case "no_confirmado":
        default:
          enlace = null;
          estadoVinculo = "no_confirmado";
          break;
      }
    } else {
      // Sin un nombre de cruce, no hay a quién cruzar: FK null, sin estado. La mención ALMACENADA
      // sigue siendo el crudo del sujeto pasivo si lo hay (trazabilidad); "" solo si tampoco hay crudo.
      estadoVinculo = null;
      mencionTexto = mencionRaw ?? "";
    }

    out.push(filaParaEscribir(aud, enlace, mencionTexto, estadoVinculo, cfgContraparte));
  }

  return { audiencias: out, parlamentariosConfirmados: [...confirmados] };
}

/** Arma la fila para-escribir de una audiencia (raíz + contrapartes anidadas, ya reconciliadas). */
function filaParaEscribir(
  aud: LobbyAudiencia,
  enlace: EnlaceConfirmado | null,
  mencionSujeto: string,
  estadoVinculo: "confirmado" | "no_confirmado" | null,
  cfgContraparte: ResolucionContraparteCfg,
): AudienciaParaEscribir {
  return {
    identificador: aud.identificador,
    institucionCodigo: aud.institucionCodigo,
    enlace,
    mencionSujeto,
    estadoVinculo,
    fecha: aud.fecha,
    fechaRaw: aud.fechaRaw,
    materia: aud.materia,
    enlaceDetalle: aud.enlaceDetalle,
    contrapartes: contrapartesDe(aud, cfgContraparte),
    origen: aud.origen,
    fecha_captura: aud.fecha_captura,
    enlace_url: aud.enlace,
  };
}

/** Re-export para el writer/tests: la forma cruda de una contraparte ya validable con zod. */
export type { LobbyContraparte };
