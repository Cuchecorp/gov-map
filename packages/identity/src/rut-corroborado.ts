/**
 * RutCorroborado — el INVARIANTE TIPADO de "un RUT solo se escribe a la maestra si
 * pasó el DV-gate + provenance + corroboración" (RUT-01, CR-01; riesgo existencial
 * #1 = atribución financiera falsa por difamación / brecha PII).
 *
 * Sube la guarda de CONVENCIÓN a TIPO, exactamente como `EnlaceConfirmado` (IDENT-12)
 * hizo con el FK del enlace. Hasta ahora, el corte "un name-match NUNCA escribe el
 * `rut` de la maestra" se defendía con (a) el flujo estructural de
 * `reconciliar-contrato.ts` (dos canales: `cosechas` → writer, `revisionesRut` → cola
 * humana) y (b) un guard-como-test ESTÁTICO (regex sobre el fuente). Un regex NO puede
 * seguir el flujo de datos: un `const alias = revisionesRut; runBackfillRut(alias, w)`,
 * un `.map`, un spread o un helper lo evaden (WR-01/02/03). Este tipo cierra ese hueco:
 * el COMPILADOR — no un regex — rechaza que un RUT no-corroborado llegue al writer.
 *
 * DISEÑO (espejo VERBATIM de `enlace-confirmado.ts`, RESEARCH §Pattern 1, Pitfall 2):
 *  - `RUT_CORROBORADO` es un `unique symbol` PRIVADO al módulo. NUNCA se exporta (ni
 *    desde aquí ni desde el barrel `index.ts`). Exportarlo —o permitir un cast de un
 *    objeto plano al tipo branded en código de conector— rompería el invariante: alguien
 *    podría fabricar un valor sin pasar por el DV-gate.
 *  - `corroborarRutFila()` es la ÚNICA factory legítima. Ejecuta el DV-gate
 *    (`isRutValido`, módulo-11) + provenance NOT NULL DENTRO de sí misma y NUNCA fabrica
 *    un RUT: una fila DV-inválida o sin provenance devuelve `{ ok: false }` — NO produce
 *    el branded type. Así, el ÚNICO camino a un `FilaRutCorroborada` es el gate, y el
 *    ÚNICO input del writer (`updateRut`) es `FilaRutCorroborada` → un RUT derivado por
 *    NOMBRE (un string desnudo, un `CandidatoRevisionRut`, un objeto imitado) NO satisface
 *    el tipo y el `tsc` lo RECHAZA en compilación (ver `rut-corroborado.test-d.ts`).
 *
 * DÓNDE SE MINTEA: SOLO `aceptarRutBackfill` (el DV-gate de `backfill-rut.ts`) llama a
 * `corroborarRutFila`. El canal de CORROBORACIÓN de dinero (`cosechas` → `runHarvestRut`
 * → `construirFilasCosecha` → `runBackfillRut`) pasa por ese mismo gate. El canal de
 * REVISIÓN HUMANA (`revisionesRut`) produce strings crudos que NUNCA obtienen la marca.
 */

import { isRutValido, normRut } from "./deterministic";

declare const RUT_CORROBORADO: unique symbol;

/**
 * Fila cruda candidata a corroborar el `rut` de la maestra: RUT + provenance
 * OBLIGATORIA. Es lo que ENTRA a la factory `corroborarRutFila` (aún SIN la marca).
 */
export interface FilaRutCandidata {
  /** id de la maestra (PK estable) a la que pertenece el RUT. */
  id: string;
  /** RUT crudo (con o sin puntos/guión); se DV-valida y normaliza en la factory. */
  rut: string;
  /** Provenance OBLIGATORIA (0005 NOT NULL): fuente de origen del RUT. */
  origen: string;
  /** Provenance: ISO de captura. */
  fecha_captura: string;
  /** Provenance: enlace a la fuente donde se leyó el RUT. */
  enlace: string;
}

/**
 * Prueba estructural de que un `rut` pasó el DV-gate (`isRutValido`, módulo-11) +
 * provenance NOT NULL, y por tanto es ESCRIBIBLE a la maestra. NO se puede construir un
 * valor de este tipo fuera de `corroborarRutFila()`: el `unique symbol` privado lo hace
 * nominal (branded). El writer (`updateRut`) tipa su input como `FilaRutCorroborada[]`
 * → RECHAZA estructuralmente un objeto plano / un string / un `CandidatoRevisionRut`
 * (name-only) en esa posición. El campo `rut` ya viene NORMALIZADO (`normRut`).
 */
export interface FilaRutCorroborada {
  readonly id: string;
  /** RUT DV-válido YA normalizado (normRut aplicado dentro de la factory). */
  readonly rut: string;
  readonly origen: string;
  readonly fecha_captura: string;
  readonly enlace: string;
  /** Marca nominal privada — imposible de fijar fuera de este módulo. */
  readonly [RUT_CORROBORADO]: true;
}

/** Razón por la que una fila candidata se rechaza (nunca obtiene la marca, nunca se escribe). */
export type RazonRechazoRut = "dv-invalido" | "provenance-faltante";

/** Resultado de la factory: brand minteado (ok) o rechazo (con la razón). */
export type ResultadoCorroboracion =
  | { ok: true; fila: FilaRutCorroborada }
  | { ok: false; id: string; razon: RazonRechazoRut };

/**
 * ÚNICA factory de `FilaRutCorroborada`. Mintea la marca SOLO cuando la fila pasa:
 *   (a) provenance presente y no vacía (origen/fecha_captura/enlace) — 0005 exige NOT NULL;
 *   (b) RUT DV-válido vía `isRutValido` (módulo-11, REUSADO — no se reimplementa).
 * Si (a) o (b) fallan → `{ ok: false, razon }` (rechazo a revisión, NUNCA se fabrica ni
 * escribe). Si pasan → `{ ok: true, fila }` con `normRut` aplicado, lista para el writer.
 *
 * Es el ÚNICO sitio de construcción legítimo del branded type. Un alias local `Branded`
 * evita escribir el cast prohibido por Pitfall 2 (el grep gate lo rechaza fuera de tests).
 */
export function corroborarRutFila(fila: FilaRutCandidata): ResultadoCorroboracion {
  const id = fila?.id;
  // (a) provenance NOT NULL — un string vacío NO satisface NOT NULL semánticamente.
  const provenanceOk =
    typeof fila?.origen === "string" && fila.origen.trim() !== "" &&
    typeof fila?.fecha_captura === "string" && fila.fecha_captura.trim() !== "" &&
    typeof fila?.enlace === "string" && fila.enlace.trim() !== "";
  if (!provenanceOk) {
    return { ok: false, id, razon: "provenance-faltante" };
  }
  // (b) DV módulo-11 — REUSA isRutValido (Don't Hand-Roll). Inválido → rechazo, NUNCA escribir.
  if (typeof fila.rut !== "string" || !isRutValido(fila.rut)) {
    return { ok: false, id, razon: "dv-invalido" };
  }
  // (c) válido → mintea el branded con normRut aplicado. La marca `[RUT_CORROBORADO]`
  // existe SOLO en el espacio de tipos (`declare const ... : unique symbol` no produce
  // valor en runtime). El valor real es un objeto plano; la marca se asienta AQUÍ, el
  // único sitio legítimo de construcción.
  type Branded = FilaRutCorroborada;
  return {
    ok: true,
    fila: {
      id,
      rut: normRut(fila.rut),
      origen: fila.origen,
      fecha_captura: fila.fecha_captura,
      enlace: fila.enlace,
    } as unknown as Branded,
  };
}
