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
// CONTRAPARTES (Pitfall 4): los asistentes no-sujeto-pasivo pasan SIN reconciliación — filas
// crudas `{nombre, rol, representadoText}`, `contraparteId` SIEMPRE null. Un tercero NUNCA se
// enlaza a una persona.
//
// `provider`/`writer` son inyectables (mock/espía en tests, MiniMax + RevisionWriter reales en
// LIVE) con defaults seguros: sin provider, un homónimo del sujeto pasivo degrada a
// `no_confirmado` (fail-closed); un determinista resuelve igual (correrPipeline corta antes del LLM).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
} from "@obs/adjudication";

import {
  ROL_SUJETO_PASIVO,
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

/** Contraparte cruda lista para el writer (tercero, SIN enlace a identidad). */
export interface ContraparteParaEscribir {
  nombre: string;
  rol: string;
  representadoText: string | null;
  /** Pitfall 4: SIEMPRE null en P11 (un tercero nunca se enlaza a una persona). */
  contraparteId: string | null;
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
}

/** Resultado de la reconciliación: filas para-escribir + el set de FKs confirmados (marcador). */
export interface ResultadoReconciliacion {
  audiencias: AudienciaParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida (para `marcarIngestado`). */
  parlamentariosConfirmados: string[];
}

/**
 * Mapea la forma para-escribir de las contrapartes (asistentes no-sujeto-pasivo → crudos).
 * Exportable para el writer/tests. Pitfall 4: `contraparteId` SIEMPRE null.
 */
function contrapartesDe(aud: LobbyAudiencia): ContraparteParaEscribir[] {
  return aud.asistentes
    .filter((a) => a.rol !== ROL_SUJETO_PASIVO)
    .map((a) => ({
      nombre: a.nombre,
      rol: a.rol ?? "",
      representadoText: a.representado ?? null,
      contraparteId: null,
    }));
}

/** Devuelve el nombre del sujeto pasivo de la audiencia (el primer asistente `Sujeto Pasivo`). */
function sujetoPasivoDe(aud: LobbyAudiencia): string | null {
  const sp = aud.asistentes.find((a) => a.rol === ROL_SUJETO_PASIVO);
  return sp ? sp.nombre.trim() : null;
}

/**
 * Reconcilia el sujeto pasivo de cada audiencia contra la maestra vía `correrPipeline`.
 * SOLO determinista mintea un `EnlaceConfirmado` y puebla el FK; el resto deja `enlace: null` +
 * mención cruda. Las contrapartes pasan crudas (`contraparteId` null). Idempotente y puro.
 */
export async function reconciliarSujeto(
  audiencias: LobbyAudiencia[],
  maestra: Parlamentario[],
  opts: ReconciliarSujetoOpts = {},
): Promise<ResultadoReconciliacion> {
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const periodo = opts.periodo ?? PERIODO_LOBBY_DEFAULT;
  // ¿Se inyectó un provider real? Si NO, un homónimo del sujeto pasivo que llegue al LLM no debe
  // ABORTAR la corrida entera (a diferencia del voto, donde el provider es obligatorio): degrada
  // ese sujeto a `no_confirmado` (fail-closed, NUNCA fabrica un enlace). Los deterministas
  // resuelven igual (correrPipeline corta antes del LLM, 0 llamadas).
  const proveedorAusente = opts.provider === undefined;

  const out: AudienciaParaEscribir[] = [];
  const confirmados = new Set<string>();

  for (const aud of audiencias) {
    const mencionSujeto = sujetoPasivoDe(aud);

    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: "confirmado" | "no_confirmado" | null = null;
    let mencionTexto = mencionSujeto ?? "";

    if (mencionSujeto && mencionSujeto.length > 0) {
      const { nombre_normalizado, tokens } = normalizarNombre({ libre: mencionSujeto });
      const mencion: MencionForanea = {
        nombreOriginal: mencionSujeto,
        nombreNormalizado: nombre_normalizado,
        tokens,
        // El lobby del congreso cruza contra ambas cámaras; el blocking filtra por periodo.
        // La cámara se deja "senado" como ancla del periodo default (igual que reconciliar-senado);
        // el caller puede afinar vía `periodo`. Column-agnostic: el cruce es por nombre.
        camara: "senado",
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
          out.push(filaParaEscribir(aud, enlace, mencionTexto, estadoVinculo));
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
      // Sin un sujeto pasivo nombrado, no hay a quién cruzar: FK null, sin estado.
      estadoVinculo = null;
      mencionTexto = "";
    }

    out.push(filaParaEscribir(aud, enlace, mencionTexto, estadoVinculo));
  }

  return { audiencias: out, parlamentariosConfirmados: [...confirmados] };
}

/** Arma la fila para-escribir de una audiencia (raíz + contrapartes crudas anidadas). */
function filaParaEscribir(
  aud: LobbyAudiencia,
  enlace: EnlaceConfirmado | null,
  mencionSujeto: string,
  estadoVinculo: "confirmado" | "no_confirmado" | null,
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
    contrapartes: contrapartesDe(aud),
    origen: aud.origen,
    fecha_captura: aud.fecha_captura,
    enlace_url: aud.enlace,
  };
}

/** Re-export para el writer/tests: la forma cruda de una contraparte ya validable con zod. */
export type { LobbyContraparte };
