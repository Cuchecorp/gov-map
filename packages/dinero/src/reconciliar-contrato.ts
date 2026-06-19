// reconciliar-contrato — cruce del PROVEEDOR de cada contrato contra la maestra de parlamentarios.
// Espeja la FORMA de salida de reconciliar-declarante (filas con FK branded `EnlaceConfirmado | null`
// + mencion cruda + estadoVinculo + set de confirmados); el matcher tiene DOS caminos segun el tipo
// de persona del proveedor (retrofit "finalidad del dato", aprobado por operador).
//
// REGLA (MONEY-02, retrofit FINALIDAD DEL DATO):
//   - PERSONA NATURAL: el enlace contrato->parlamentario es RUT-exacto determinista (el match mas
//     fuerte) O, sin match RUT-exacto, por NOMBRE via `correrPipeline` (@obs/adjudication), igual que
//     reconciliar-aporte.ts / reconciliar-sujeto.ts. SOLO un resultado determinista (nombre unico) o
//     humano-confirmado puebla el FK via `confirmar()` (IDENT-12); ambiguo -> null + cola humana
//     (fail-closed). En un match persona-natural CONFIRMADO se COSECHA el `rutProveedor` DV-valido de
//     ChileCompra al `rut` de la maestra (IDENT-10), nunca fabricando, solo en enlace confirmado.
//   - PERSONA JURIDICA: SIGUE RUT-exacto-only; una empresa NUNCA se name-linkea a un parlamentario
//     (la empresa no es el parlamentario). Nunca llama `correrPipeline`, nunca emite cosecha.
//   - DATA-ROUTING: solo el `proveedorNombre` (persona natural) llega a `correrPipeline`/LLM; el
//     `rutProveedor` (ni ningun RUT) JAMAS toca el pipeline/prompt (el gate `assertNoRutInLlmInput`
//     vive DENTRO de `correrPipeline`; aqui basta con no rutear el RUT).
//
// SUPERSEDE EXPLICITO: esto reemplaza la REGLA LOCKED previa ("RUT-exacto, nunca por nombre" en forma
// absoluta) SOLO para PERSONA NATURAL, por decision de operador "finalidad del dato" (enlazar un
// funcionario publico usa el pipeline confirmado/auditado). PERSONA JURIDICA conserva la regla
// original RUT-exacto-only.
//
// Casos de RUT (intactos): RUT invalido (DV modulo-11) -> CUARENTENA (enlace null, nunca confirmado,
// nunca fabrica). RUT valido + match exacto unico -> `confirmar(id,"determinista")`, "confirmado".
//
// La escritura del RUT cosechado a la maestra remota es checkpoint de operador (ver harvest-rut.ts).
// `provider`/`writer` son inyectables (mock/espia en tests, MiniMax + RevisionWriter reales en LIVE)
// con defaults seguros: sin provider, un proveedor persona-natural homonimo degrada a no_confirmado
// (fail-closed); un determinista resuelve igual (correrPipeline corta antes del LLM). Async, idempotente,
// pura (sin red/DB en lo que respecta a la maestra).

import type { Parlamentario } from "@obs/core";
import { normalizarNombre } from "@obs/core";
import { isRutValido, normRut, matchDeterminista } from "@obs/identity";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";
import {
  correrPipeline,
  type PipelineWriter,
  type MencionForanea,
} from "@obs/adjudication";

import type { Contrato } from "./model";

// El provider LLM se tipa derivando de la firma de `correrPipeline` (3.er parametro), evitando un
// edge directo a `@obs/llm` (como hacen reconciliar-aporte / reconciliar-sujeto).
type LLMProvider = Parameters<typeof correrPipeline>[2];

/** Periodo del blocking del matcher determinista por defecto. Sobreescribible por opts. */
const PERIODO_DINERO_DEFAULT = "senado-vigente-2026";

/** Camara del blocking del matcher determinista por defecto. */
const CAMARA_DINERO_DEFAULT: Parlamentario["camara"] = "senado";

/** Writer no-op: descarta toda escritura del pipeline (cuando el caller no inyecta uno). */
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
 * Provider que LANZA si se invoca: fuerza fail-closed cuando no se inyecto uno real y un proveedor
 * persona-natural homonimo llegaria al LLM. Los deterministas NUNCA lo tocan (0 llamadas).
 */
const PROVIDER_AUSENTE: LLMProvider = {
  id: "sin-provider",
  trainsOnInputs: false,
  async complete() {
    throw new Error(
      "reconciliarContrato: se requiere un provider LLM para resolver un proveedor persona-natural ambiguo (homonimo)",
    );
  },
};

/**
 * Estado del vinculo de un contrato:
 *  - "confirmado": RUT-exacto unico O nombre persona-natural determinista contra la maestra (FK poblado).
 *  - "no_confirmado": RUT valido sin match exacto unico ni nombre determinista (incluye IDENT-10 / 0 / 2+ / juridica).
 *  - "cuarentena": RUT del proveedor invalido (DV malo) — nunca una fila confirmada.
 */
export type EstadoVinculoContrato = "confirmado" | "no_confirmado" | "cuarentena";

/**
 * Candidato de cosecha de RUT (IDENT-10): en un match PERSONA-NATURAL CONFIRMADO, el `rutProveedor`
 * DV-valido de ChileCompra ES el RUT del parlamentario enlazado -> se emite este candidato para
 * escribir al `rut` de la maestra, con provenance. NUNCA se fabrica: el RUT se re-valida (isRutValido)
 * antes de emitir y solo se emite en enlace CONFIRMADO. La escritura remota es checkpoint de operador.
 */
export interface CandidatoCosechaRut {
  /** Id de la maestra (PK estable) cuyo `rut` se cosecha. */
  parlamentarioId: string;
  /** RUT del proveedor DV-valido + normalizado (el RUT cosechado). */
  rutHarvested: string;
  /** Provenance OBLIGATORIA (backfill-rut exige NOT NULL): de donde salio el RUT cosechado. */
  provenance: { origen: string; fecha_captura: string; enlace: string };
}

/**
 * Contrato listo para el writer: la raiz con el FK branded `EnlaceConfirmado | null` + la mencion
 * cruda del proveedor + el estadoVinculo. El writer aplana al storage plano
 * (`parlamentario_id: string | null`).
 */
export interface ContratoParaEscribir {
  /** Clave de version: el codigo de la orden de compra. */
  fuenteId: string;
  /** Clave de version: la fecha de corte de la ingesta. */
  fechaCorte: string;
  codigoOrden: string;
  /** FK branded del proveedor->parlamentario: minteado SOLO en determinista (string crudo no compila). */
  enlace: EnlaceConfirmado | null;
  /** RUT del proveedor consultado (keyea la sub-maestra). */
  rutProveedor: string;
  /** Mencion cruda del proveedor (nombre), preservada incluso sin enlace. */
  mencionProveedor: string | null;
  estadoVinculo: EstadoVinculoContrato;
  tipoPersona: Contrato["tipoPersona"];
  organismo: string | null;
  /** Nombre/descripcion crudo de la orden (texto libre), o null. NUNCA un monto (CR-02). */
  nombreOrden: string | null;
  monto: string | null;
  fechaOc: string | null;
  origen: string;
  fecha_captura: string;
  enlace_url: string;
  licencia: string;
}

/** Opciones de reconciliacion (provider/writer/periodo/camara inyectables, defaults seguros). */
export interface ReconciliarContratoOpts {
  /** Provider LLM; no se invoca para los proveedores que resuelven deterministicamente ni para juridica. */
  provider?: LLMProvider;
  /** Writer del pipeline (cola/vinculo/audit). */
  writer?: PipelineWriter;
  /** Periodo del blocking. Default `PERIODO_DINERO_DEFAULT`. */
  periodo?: string;
  /** Camara del blocking. Default `CAMARA_DINERO_DEFAULT`. */
  camara?: Parlamentario["camara"];
}

/** Resultado: filas para-escribir + el set de FKs confirmados + los candidatos de cosecha de RUT. */
export interface ResultadoReconciliacionDinero {
  contratos: ContratoParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida. */
  parlamentariosConfirmados: string[];
  /** Codigos de orden cuyo RUT de proveedor fue invalido (cuarentena). */
  cuarentenados: string[];
  /** Candidatos de cosecha de RUT emitidos (solo en matches persona-natural CONFIRMADOS). */
  cosechas: CandidatoCosechaRut[];
}

/** Etiqueta de provenance de un RUT cosechado (texto load-bearing para el NOT NULL de backfill-rut). */
const ORIGEN_COSECHA = "harvest:chilecompra-persona-natural";

/**
 * Reconcilia el proveedor de cada contrato contra la maestra. PERSONA NATURAL: RUT-exacto determinista
 * O nombre via `correrPipeline` (solo determinista mintea el FK; ambiguo -> null + cola humana). En un
 * match persona-natural confirmado se EMITE un candidato de cosecha del `rutProveedor` DV-valido.
 * PERSONA JURIDICA: RUT-exacto-only (nunca name-linkea). RUT invalido -> cuarentena. El `rutProveedor`
 * NUNCA toca el pipeline/LLM. Async, idempotente y pura (sin escritura a la maestra aqui).
 */
export async function reconciliarContrato(
  contratos: Contrato[],
  maestra: Parlamentario[],
  opts: ReconciliarContratoOpts = {},
): Promise<ResultadoReconciliacionDinero> {
  const provider = opts.provider ?? PROVIDER_AUSENTE;
  const writer = opts.writer ?? NOOP_WRITER;
  const periodo = opts.periodo ?? PERIODO_DINERO_DEFAULT;
  const camara = opts.camara ?? CAMARA_DINERO_DEFAULT;
  // Sin provider real inyectado, un proveedor persona-natural homonimo que llegue al LLM NO debe
  // ABORTAR la corrida: degrada ESE contrato a `no_confirmado` (fail-closed, NUNCA fabrica). Los
  // deterministas resuelven igual (correrPipeline corta antes del LLM, 0 llamadas).
  const proveedorAusente = opts.provider === undefined;

  const out: ContratoParaEscribir[] = [];
  const confirmados = new Set<string>();
  const cuarentenados: string[] = [];
  const cosechas: CandidatoCosechaRut[] = [];

  for (const c of contratos) {
    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: EstadoVinculoContrato;

    // 1. RUT invalido (DV modulo-11) -> CUARENTENA: enlace null, nunca confirmado, nunca fabrica.
    if (!isRutValido(c.rutProveedor)) {
      estadoVinculo = "cuarentena";
      cuarentenados.push(c.codigoOrden);
      out.push(filaParaEscribir(c, enlace, estadoVinculo));
      continue;
    }

    // 2. RUT valido -> matchDeterminista rama RUT (INTACTO). SOLO confirmado+rut mintea el enlace.
    //    Este camino NO emite cosecha (el RUT interno YA estaba poblado; no hay nada que cosechar).
    const res = matchDeterminista(
      { rut: normRut(c.rutProveedor), nombreNormalizado: "", camara, periodo },
      maestra,
    );
    if (res.estado === "confirmado" && res.metodo === "rut") {
      enlace = confirmar(res.id, "determinista");
      estadoVinculo = "confirmado";
      confirmados.add(res.id);
      out.push(filaParaEscribir(c, enlace, estadoVinculo));
      continue;
    }

    // 3. Sin match RUT-exacto y RUT valido -> ramificar por tipo de persona.
    const proveedorNombre = c.proveedorNombre?.trim() ?? "";
    if (c.tipoPersona !== "natural" || proveedorNombre.length === 0) {
      // PERSONA JURIDICA (o nombre vacio): NUNCA name-linkea -> enlace null + mencion cruda. Sin pipeline.
      estadoVinculo = "no_confirmado";
      out.push(filaParaEscribir(c, enlace, estadoVinculo));
      continue;
    }

    // FALLBACK PERSONA-NATURAL: cruce por NOMBRE via correrPipeline (espejo de reconciliarAporte).
    // DATA-ROUTING: SOLO el proveedorNombre arma la mencion. NINGUN campo de RUT entra.
    const { nombre_normalizado, tokens } = normalizarNombre({ libre: proveedorNombre });
    const mencion: MencionForanea = {
      nombreOriginal: proveedorNombre,
      nombreNormalizado: nombre_normalizado,
      tokens,
      camara,
      periodo,
      region: null,
    };
    let pres: Awaited<ReturnType<typeof correrPipeline>> | null = null;
    try {
      pres = await correrPipeline(mencion, maestra, provider, writer);
    } catch (err) {
      // Sin provider real, un homonimo llega al LLM ausente y lanza. Fail-closed honesto: se degrada
      // ESE contrato a `no_confirmado` (NUNCA se fabrica un enlace) y la corrida sigue.
      if (proveedorAusente) {
        out.push(filaParaEscribir(c, null, "no_confirmado"));
        continue;
      }
      // Con un provider real inyectado, un error del LLM SI propaga (no se enmascara).
      throw err;
    }

    // GUARDA LOCKED (IDENT-12): SOLO determinista mintea un EnlaceConfirmado y puebla el FK.
    switch (pres.tipo) {
      case "determinista":
        enlace = confirmar(pres.parlamentarioId, "determinista");
        estadoVinculo = "confirmado";
        confirmados.add(pres.parlamentarioId);
        // COSECHA solo en CONFIRMADO: re-validar el RUT (defensivo; ya valido arriba) ANTES de emitir.
        // NUNCA se fabrica; el candidato es un canal SEPARADO de salida (la fila para-escribir no cambia).
        if (isRutValido(c.rutProveedor)) {
          cosechas.push({
            parlamentarioId: pres.parlamentarioId,
            rutHarvested: normRut(c.rutProveedor),
            provenance: {
              origen: ORIGEN_COSECHA,
              fecha_captura: c.fecha_captura,
              enlace: c.enlace,
            },
          });
        }
        break;
      case "probable":
      case "revision":
      case "no_confirmado":
      default:
        // Ambiguo -> enlace null, cola humana (via el writer del pipeline), SIN cosecha (fail-closed).
        enlace = null;
        estadoVinculo = "no_confirmado";
        break;
    }

    out.push(filaParaEscribir(c, enlace, estadoVinculo));
  }

  return {
    contratos: out,
    parlamentariosConfirmados: [...confirmados],
    cuarentenados,
    cosechas,
  };
}

/** Arma la fila para-escribir de un contrato (raiz + mencion cruda del proveedor). */
function filaParaEscribir(
  c: Contrato,
  enlace: EnlaceConfirmado | null,
  estadoVinculo: EstadoVinculoContrato,
): ContratoParaEscribir {
  return {
    fuenteId: c.fuenteId,
    fechaCorte: c.fechaCorte,
    codigoOrden: c.codigoOrden,
    enlace,
    rutProveedor: c.rutProveedor,
    mencionProveedor: c.proveedorNombre,
    estadoVinculo,
    tipoPersona: c.tipoPersona,
    organismo: c.organismo,
    nombreOrden: c.nombreOrden,
    monto: c.monto,
    fechaOc: c.fechaOc,
    origen: c.origen,
    fecha_captura: c.fecha_captura,
    enlace_url: c.enlace,
    licencia: c.licencia,
  };
}
