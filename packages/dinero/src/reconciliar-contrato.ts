// reconciliar-contrato — cruce del PROVEEDOR de cada contrato contra la maestra de parlamentarios
// SOLO por RUT-EXACTO determinista. Espeja la FORMA de salida de reconciliar-declarante (filas
// con FK branded `EnlaceConfirmado | null` + mencion cruda + estadoVinculo + set de confirmados),
// pero CAMBIA el matcher: el enlace es RUT-only via matchDeterminista (rama RUT) + confirmar(). NO
// arrastra el pipeline name-only del LLM (sin dependencia de adjudicacion), NO normaliza nombres
// para enlazar. El riesgo mitigado es la atribucion por homonimia.
//
// REGLA LOCKED (MONEY-02): el enlace contrato->parlamentario se fija UNICAMENTE por RUT-exacto
// contra el RUT interno de la maestra:
//   1. RUT del proveedor invalido (DV modulo-11) -> CUARENTENA: enlace null, estadoVinculo "cuarentena",
//      NUNCA fila de contrato confirmada (nunca fabrica).
//   2. RUT valido -> `matchDeterminista` rama RUT; SOLO `estado === "confirmado" && metodo === "rut"`
//      mintea `confirmar(id, "determinista")` -> EnlaceConfirmado, estadoVinculo "confirmado".
//   3. CUALQUIER otro resultado (sin RUT interno en la maestra = caso IDENT-10, 0 match, 2+ match,
//      o caer a la rama nombre) -> enlace null, estadoVinculo "no_confirmado", mencion cruda.
//
// Mientras el RUT interno de la maestra este vacio (IDENT-10), el resultado es SIEMPRE enlace null
// y el parlamentario queda "no consultado todavia" honestamente. Funcion PURA, sin red, sin DB.

import type { Parlamentario } from "@obs/core";
import { isRutValido, normRut, matchDeterminista } from "@obs/identity";
import { confirmar, type EnlaceConfirmado } from "@obs/identity";

import type { Contrato } from "./model";

/** Periodo del blocking del matcher determinista por defecto. Sobreescribible por opts. */
const PERIODO_DINERO_DEFAULT = "senado-vigente-2026";

/** Camara del blocking del matcher determinista por defecto. */
const CAMARA_DINERO_DEFAULT: Parlamentario["camara"] = "senado";

/**
 * Estado del vinculo de un contrato:
 *  - "confirmado": RUT-exacto unico contra la maestra (FK poblado).
 *  - "no_confirmado": RUT valido sin match exacto unico (incluye IDENT-10 / 0 / 2+).
 *  - "cuarentena": RUT del proveedor invalido (DV malo) — nunca una fila confirmada.
 */
export type EstadoVinculoContrato = "confirmado" | "no_confirmado" | "cuarentena";

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
  /** FK branded del proveedor->parlamentario: minteado SOLO en RUT-exacto (string crudo no compila). */
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

/** Opciones de reconciliacion (camara/periodo del blocking determinista). */
export interface ReconciliarContratoOpts {
  /** Periodo del blocking. Default `PERIODO_DINERO_DEFAULT`. */
  periodo?: string;
  /** Camara del blocking. Default `CAMARA_DINERO_DEFAULT`. */
  camara?: Parlamentario["camara"];
}

/** Resultado: filas para-escribir + el set de FKs confirmados (para `marcarIngestado`). */
export interface ResultadoReconciliacionDinero {
  contratos: ContratoParaEscribir[];
  /** Ids de parlamentarios con FK confirmado en esta corrida. */
  parlamentariosConfirmados: string[];
  /** Codigos de orden cuyo RUT de proveedor fue invalido (cuarentena). */
  cuarentenados: string[];
}

/**
 * Reconcilia el proveedor de cada contrato contra la maestra SOLO por RUT-exacto. Idempotente y
 * puro. RUT invalido -> cuarentena (enlace null, nunca confirmado). RUT valido + match exacto unico
 * -> `confirmar()`; cualquier otro caso -> enlace null + mencion cruda.
 */
export function reconciliarContrato(
  contratos: Contrato[],
  maestra: Parlamentario[],
  opts: ReconciliarContratoOpts = {},
): ResultadoReconciliacionDinero {
  const periodo = opts.periodo ?? PERIODO_DINERO_DEFAULT;
  const camara = opts.camara ?? CAMARA_DINERO_DEFAULT;

  const out: ContratoParaEscribir[] = [];
  const confirmados = new Set<string>();
  const cuarentenados: string[] = [];

  for (const c of contratos) {
    let enlace: EnlaceConfirmado | null = null;
    let estadoVinculo: EstadoVinculoContrato;

    // 1. RUT invalido (DV modulo-11) -> CUARENTENA: enlace null, nunca confirmado, nunca fabrica.
    if (!isRutValido(c.rutProveedor)) {
      estadoVinculo = "cuarentena";
      cuarentenados.push(c.codigoOrden);
    } else {
      // 2. RUT valido -> matchDeterminista rama RUT. SOLO confirmado+rut mintea el enlace.
      const res = matchDeterminista(
        { rut: normRut(c.rutProveedor), nombreNormalizado: "", camara, periodo },
        maestra,
      );
      if (res.estado === "confirmado" && res.metodo === "rut") {
        enlace = confirmar(res.id, "determinista");
        estadoVinculo = "confirmado";
        confirmados.add(res.id);
      } else {
        // 3. Sin RUT interno (IDENT-10) / 0 / 2+ / rama nombre -> enlace null + mencion cruda.
        estadoVinculo = "no_confirmado";
      }
    }

    out.push(filaParaEscribir(c, enlace, estadoVinculo));
  }

  return { contratos: out, parlamentariosConfirmados: [...confirmados], cuarentenados };
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
