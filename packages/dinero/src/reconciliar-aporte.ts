// reconciliar-aporte — cruce del CANDIDATO (funcionario publico) de cada aporte SERVEL contra la
// maestra de parlamentarios via `correrPipeline` (@obs/adjudication). Espeja
// packages/lobby/src/reconciliar-sujeto.ts archivo-por-archivo (NO reconciliar-contrato.ts):
// el enlace es por NOMBRE del candidato (la fuente NO trae RUT), con homonimos ADJUDICADOS.
//
// GUARDA DE IDENTIDAD LOCKED (riesgo existencial #1, IDENT-12):
//   SOLO `res.tipo === "determinista"` (nombre unico en camara+periodo) mintea un `EnlaceConfirmado`
//   via `confirmar()` y puebla el FK + `estado_vinculo = "confirmado"`. `probable`/`revision`/
//   `no_confirmado` -> `enlace: null` + `estado_vinculo: "no_confirmado"` + `candidato_nombre_verbatim`
//   crudo preservado (NUNCA vincula a la ficha publica). Cada decision ambigua va a la cola de revision
//   humana (`identidad_audit`) via el writer del pipeline.
//
// DATA-ROUTING GATE LOAD-BEARING (T-15-09b):
//   SOLO `candidatoNombreVerbatim` (el funcionario publico) arma la mencion que va a `correrPipeline`.
//   El DONANTE (`donanteNombre`, `tipoPersona`, cualquier RUT de donante) JAMAS se pasa a
//   `correrPipeline` ni se incluye en la mencion ni en el prompt. El gate `assertNoRutInLlmInput` /
//   `assertSensitivityAllowed` vive DENTRO de `correrPipeline`; aqui basta con no rutear el donante.
//
// `provider`/`writer` son inyectables (mock/espia en tests, MiniMax + RevisionWriter reales en LIVE)
// con defaults seguros: sin provider, un candidato homonimo degrada a `no_confirmado` (fail-closed);
// un determinista resuelve igual (correrPipeline corta antes del LLM).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
} from "@obs/adjudication";

import type { Aporte } from "./model-servel";

// El provider LLM se tipa derivando de la firma de `correrPipeline` (3.er parametro), evitando un
// edge directo a `@obs/llm` (como hace reconciliar-sujeto.ts).
type LLMProvider = Parameters<typeof correrPipeline>[2];

/** Periodo del blocking del pipeline por defecto (filtro DURO). Sobreescribible por opts. */
const PERIODO_SERVEL_DEFAULT = "senado-vigente-2026";
/** Camara ancla del periodo default (el cruce es por NOMBRE; el caller puede afinar). */
const CAMARA_SERVEL_DEFAULT: Parlamentario["camara"] = "senado";

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
 * Provider que LANZA si se invoca: fuerza fail-closed cuando no se inyecto uno real y un candidato
 * llegaria al LLM (homonimo). Los deterministas NUNCA lo tocan (0 llamadas).
 */
const PROVIDER_AUSENTE: LLMProvider = {
  id: "sin-provider",
  trainsOnInputs: false,
  async complete() {
    throw new Error(
      "reconciliarAporte: se requiere un provider LLM para resolver un candidato ambiguo (homonimo)",
    );
  },
};

/**
 * Aporte listo para el writer: la fila cruda (donante verbatim, monto verbatim, eleccion) + el FK
 * branded del CANDIDATO (`EnlaceConfirmado | null`) + el estado honesto + el `candidato_nombre_verbatim`
 * crudo. El writer aplana el FK al storage plano (`parlamentario_id: string|null`). El donante viaja
 * VERBATIM (nunca toco el pipeline).
 */
export interface AporteParaEscribir extends Aporte {
  /**
   * FK branded del candidato: minteado SOLO en determinista (un string crudo no compila). Distinto del
   * `enlace` de provenance (URL string) que viene de `Aporte`: este es el enlace de IDENTIDAD.
   */
  enlaceCandidato: EnlaceConfirmado | null;
  /** Estado honesto del enlace del candidato. */
  estadoVinculo: "confirmado" | "no_confirmado" | null;
}

/** Opciones de reconciliacion (provider/writer/periodo/camara inyectables, defaults seguros). */
export interface ReconciliarAporteOpts {
  /** Provider LLM; no se invoca para los candidatos que resuelven deterministicamente. */
  provider?: LLMProvider;
  /** Writer del pipeline (cola/vinculo/audit). */
  writer?: PipelineWriter;
  /** Periodo del blocking (filtro DURO). Default `PERIODO_SERVEL_DEFAULT`. */
  periodo?: string;
  /** Camara ancla del blocking. Default `CAMARA_SERVEL_DEFAULT`. */
  camara?: Parlamentario["camara"];
}

/** Resultado de la reconciliacion: filas para-escribir + el set de FKs confirmados (marcador). */
export interface ResultadoReconciliacionAporte {
  aportes: AporteParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida (para `marcarIngestado`). */
  parlamentariosConfirmados: string[];
}

/**
 * Reconcilia el CANDIDATO de cada aporte contra la maestra via `correrPipeline`. SOLO determinista
 * mintea un `EnlaceConfirmado` y puebla el FK; el resto deja `enlace: null` + `candidato_nombre_verbatim`
 * crudo. El DONANTE viaja VERBATIM y NUNCA toca el pipeline/LLM. Async, idempotente y pura.
 */
export async function reconciliarAporte(
  aportes: Aporte[],
  maestra: Parlamentario[],
  opts: ReconciliarAporteOpts = {},
): Promise<ResultadoReconciliacionAporte> {
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const periodo = opts.periodo ?? PERIODO_SERVEL_DEFAULT;
  const camara = opts.camara ?? CAMARA_SERVEL_DEFAULT;
  // Sin provider real inyectado, un candidato homonimo que llegue al LLM NO debe ABORTAR la corrida:
  // degrada ESE aporte a `no_confirmado` (fail-closed, NUNCA fabrica). Los deterministas resuelven
  // igual (correrPipeline corta antes del LLM, 0 llamadas).
  const proveedorAusente = opts.provider === undefined;

  const out: AporteParaEscribir[] = [];
  const confirmados = new Set<string>();

  for (const aporte of aportes) {
    // DATA-ROUTING GATE: SOLO el nombre del candidato es la llave del enlace. El donante NUNCA entra.
    const candidatoNombre = aporte.candidatoNombreVerbatim?.trim() ?? "";

    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: "confirmado" | "no_confirmado" | null = null;

    if (candidatoNombre.length > 0) {
      const { nombre_normalizado, tokens } = normalizarNombre({ libre: candidatoNombre });
      const mencion: MencionForanea = {
        // Solo el candidato (funcionario publico) viaja al pipeline. NINGUN campo del donante.
        nombreOriginal: candidatoNombre,
        nombreNormalizado: nombre_normalizado,
        tokens,
        camara,
        periodo,
        region: null,
      };
      let res: Awaited<ReturnType<typeof correrPipeline>> | null = null;
      try {
        res = await correrPipeline(mencion, maestra, provider, writer);
      } catch (err) {
        // Sin provider real, un homonimo llega al LLM ausente y lanza. Fail-closed honesto: se degrada
        // ESE aporte a `no_confirmado` (NUNCA se fabrica un enlace) y la corrida sigue.
        if (proveedorAusente) {
          out.push(filaParaEscribir(aporte, null, "no_confirmado"));
          continue;
        }
        // Con un provider real inyectado, un error del LLM SI propaga (no se enmascara).
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
      // Sin un candidato nombrado, no hay a quien cruzar: FK null, sin estado.
      estadoVinculo = null;
    }

    out.push(filaParaEscribir(aporte, enlace, estadoVinculo));
  }

  return { aportes: out, parlamentariosConfirmados: [...confirmados] };
}

/** Arma la fila para-escribir de un aporte (la fila cruda VERBATIM + el FK branded del candidato). */
function filaParaEscribir(
  aporte: Aporte,
  enlaceCandidato: EnlaceConfirmado | null,
  estadoVinculo: "confirmado" | "no_confirmado" | null,
): AporteParaEscribir {
  return { ...aporte, enlaceCandidato, estadoVinculo };
}
