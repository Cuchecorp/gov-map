// reconciliar-declarante — cruce del DECLARANTE (el oficial) de cada declaración contra la maestra
// de parlamentarios vía `correrPipeline` (Fase 4). Espeja reconciliar-sujeto.ts archivo-por-archivo.
//
// La fuente InfoProbidad NO expone RUT de persona natural (research: filtro CONTAINS → cero) → el
// cruce es por NOMBRE (igual que el sujeto-pasivo de lobby). Los nombres traen `\t` + dobles-espacios
// (`"\tCARLOS  BIANCHI"`) → DEBE aplicarse `normalizarNombre` antes del cruce.
//
// GUARDA DE IDENTIDAD LOCKED (riesgo existencial #1, IDENT-12):
//   SOLO `tipo === "determinista"` (nombre único en cámara+periodo) mintea un `EnlaceConfirmado`
//   vía `confirmar()` y puebla el FK + `estado_vinculo = "confirmado"`. `probable`/`revision`/
//   `no_confirmado` → `enlace: null` + `estado_vinculo: "no_confirmado"` + mención cruda preservada
//   (NUNCA vincula a la ficha pública). Cada decisión deja una fila en `identidad_audit` (vía el
//   writer del pipeline).
//
// FAMILIARES (Pitfall 4 / deny-by-default): los familiares pasan SIN reconciliación — filas crudas
// `{relacion, nombre}`, NUNCA enlazadas a una persona del padrón.
//
// `provider`/`writer` son inyectables (mock/espía en tests) con defaults seguros: sin provider, un
// homónimo del declarante degrada a `no_confirmado` (fail-closed); un determinista resuelve igual
// (correrPipeline corta antes del LLM, 0 llamadas).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
} from "@obs/adjudication";

import type { Declaracion, Bienes, DeclaracionFamiliar } from "./model";

// El provider LLM se tipa derivándolo de la firma de `correrPipeline` (3.er parámetro), evitando un
// edge directo al paquete de modelos de lenguaje (como hace reconciliar-sujeto/reconciliar-senado).
type LLMProvider = Parameters<typeof correrPipeline>[2];

/** Periodo del blocking del pipeline por defecto (filtro DURO). Sobreescribible por opts. */
const PERIODO_PROBIDAD_DEFAULT = "senado-vigente-2026";

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
 * Provider que LANZA si se invoca: fuerza fail-closed cuando no se inyectó uno real y un declarante
 * llegaría al LLM (homónimo). Los deterministas NUNCA lo tocan (0 llamadas).
 */
const PROVIDER_AUSENTE: LLMProvider = {
  id: "sin-provider",
  trainsOnInputs: false,
  async complete() {
    throw new Error(
      "reconciliarDeclarante: se requiere un provider LLM para resolver un declarante ambiguo (homónimo)",
    );
  },
};

/**
 * Declaración lista para el writer: la raíz (con el FK branded `EnlaceConfirmado | null`) + los
 * bienes y familiares ANIDADOS (crudos). El writer aplana al storage plano
 * (`parlamentario_id: string|null`) y reparte los bienes/familiares a sus sub-tablas.
 */
export interface DeclaracionParaEscribir {
  /** Clave de versión: la URI del nodo Declaracion (única — OQ1). */
  fuenteId: string;
  /** Clave de versión: la fecha de presentación (ip:fechaDeclaracion). */
  fechaPresentacion: string;
  /** FK branded del declarante: minteado SOLO en determinista (un string crudo no compila). */
  enlace: EnlaceConfirmado | null;
  /** Nombre crudo del declarante preservado (mención). */
  mencionDeclarante: string;
  estadoVinculo: "confirmado" | "no_confirmado" | null;
  tipo: string | null;
  cargo: string | null;
  organismo: string | null;
  bienes: Bienes;
  familiares: DeclaracionFamiliar[];
  origen: string;
  fecha_captura: string;
  enlace_url: string;
  licencia: string;
}

/** Opciones de reconciliación (provider/writer inyectables, defaults seguros). */
export interface ReconciliarDeclaranteOpts {
  /** Provider LLM; no se invoca para los declarantes que resuelven determinísticamente. */
  provider?: LLMProvider;
  /** Writer del pipeline (cola/vínculo/audit). */
  writer?: PipelineWriter;
  /** Periodo del blocking (filtro DURO). Default `PERIODO_PROBIDAD_DEFAULT`. */
  periodo?: string;
}

/** Resultado de la reconciliación: filas para-escribir + el set de FKs confirmados (marcador). */
export interface ResultadoReconciliacionProbidad {
  declaraciones: DeclaracionParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida (para `marcarIngestado`). */
  parlamentariosConfirmados: string[];
}

/**
 * Reconcilia el declarante de cada declaración contra la maestra vía `correrPipeline`. SOLO
 * determinista mintea un `EnlaceConfirmado` y puebla el FK; el resto deja `enlace: null` + mención
 * cruda. Los bienes y familiares pasan crudos (los familiares SIN enlace — deny-by-default).
 * Idempotente y puro.
 */
export async function reconciliarDeclarante(
  declaraciones: Declaracion[],
  maestra: Parlamentario[],
  opts: ReconciliarDeclaranteOpts = {},
): Promise<ResultadoReconciliacionProbidad> {
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const periodo = opts.periodo ?? PERIODO_PROBIDAD_DEFAULT;
  // ¿Se inyectó un provider real? Si NO, un homónimo del declarante que llegue al LLM no debe
  // ABORTAR la corrida: degrada ESE declarante a `no_confirmado` (fail-closed, NUNCA fabrica un
  // enlace). Los deterministas resuelven igual (correrPipeline corta antes del LLM, 0 llamadas).
  const proveedorAusente = opts.provider === undefined;

  const out: DeclaracionParaEscribir[] = [];
  const confirmados = new Set<string>();

  for (const decl of declaraciones) {
    // Los nombres de InfoProbidad traen `\t` + dobles-espacios → normalizar ANTES del cruce.
    const mencionDeclarante = decl.declaranteNombre.trim();

    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: "confirmado" | "no_confirmado" | null = null;

    if (mencionDeclarante.length > 0) {
      const { nombre_normalizado, tokens } = normalizarNombre({ libre: mencionDeclarante });
      const mencion: MencionForanea = {
        nombreOriginal: mencionDeclarante,
        nombreNormalizado: nombre_normalizado,
        tokens,
        // El cruce es por nombre contra ambas cámaras; el blocking filtra por periodo.
        camara: "senado",
        periodo,
        region: null,
      };
      let res: Awaited<ReturnType<typeof correrPipeline>> | null = null;
      try {
        res = await correrPipeline(mencion, maestra, provider, writer);
      } catch (err) {
        // Sin provider real, un homónimo llega al LLM ausente y lanza. Fail-closed honesto: se
        // degrada ESE declarante a `no_confirmado` (NUNCA fabrica) y la corrida sigue.
        if (proveedorAusente) {
          out.push(filaParaEscribir(decl, null, mencionDeclarante, "no_confirmado"));
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
      // Sin un declarante nombrado, no hay a quién cruzar: FK null, sin estado.
      estadoVinculo = null;
    }

    out.push(filaParaEscribir(decl, enlace, mencionDeclarante, estadoVinculo));
  }

  return { declaraciones: out, parlamentariosConfirmados: [...confirmados] };
}

/** Arma la fila para-escribir de una declaración (raíz + bienes/familiares crudos anidados). */
function filaParaEscribir(
  decl: Declaracion,
  enlace: EnlaceConfirmado | null,
  mencionDeclarante: string,
  estadoVinculo: "confirmado" | "no_confirmado" | null,
): DeclaracionParaEscribir {
  return {
    fuenteId: decl.fuenteId,
    fechaPresentacion: decl.fechaPresentacion,
    enlace,
    mencionDeclarante,
    estadoVinculo,
    tipo: decl.tipo,
    cargo: decl.cargo,
    organismo: decl.organismo,
    // Los familiares pasan crudos, SIN enlace (deny-by-default — un tercero nunca se enlaza).
    bienes: decl.bienes,
    familiares: decl.familiares,
    origen: decl.origen,
    fecha_captura: decl.fecha_captura,
    enlace_url: decl.enlace,
    licencia: decl.licencia,
  };
}
