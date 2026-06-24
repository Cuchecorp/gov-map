/**
 * matchDeterministaEntidad — reconciliación determinista de identidad de TERCEROS (ENT-02).
 *
 * ESPEJO de `matchDeterminista` (deterministic.ts) hacia la maestra `entidad_tercero`, con
 * DOS piezas de lógica nueva:
 *
 *   Δ1 — discriminador `tipo_entidad` ('natural'|'juridica'). La unicidad por nombre se calcula
 *        POR TIPO (un natural y una jurídica con el mismo nombre NO colisionan).
 *
 *   Δ2 — REGLA LOCKED jurídica-solo-RUT: una entidad `tipo_entidad === 'juridica'` SOLO puede
 *        confirmar por RUT exacto único. Sin RUT, o RUT no único → `no_confirmado` razón
 *        'juridica-sin-rut' DIRECTO, sin intentar la rama nombre y SIN NUNCA habilitar el LLM
 *        aguas arriba (pipeline-entidad, Plan 03, lee esta razón y nunca llama al modelo).
 *        LeyLobby no publica RUT de contraparte → la mayoría de gestores jurídicos quedan
 *        `no_confirmado` (degradación honesta, no un match inventado).
 *
 * FUNCIÓN PURA y FAIL-CLOSED. Es el único escritor de `estado` para terceros. Confirma SOLO
 * cuando hay EXACTAMENTE una coincidencia (`=== 1`); cualquier ambigüedad → `no_confirmado`.
 * SIN LLM, SIN red, SIN DB: opera sobre la maestra ya cargada en memoria.
 *
 * REUSA `normRut`/`isRutValido` de ./deterministic (DV módulo-11 probado) — Don't Hand-Roll.
 */

import { normRut } from "./deterministic";

/** Discriminador de tipo de entidad (Δ1). */
export type TipoEntidad = "natural" | "juridica";

/**
 * Fila de la maestra `entidad_tercero` que el matcher necesita. Subconjunto mínimo: la PK
 * estable, la clave de blocking (`nombre_normalizado`), el discriminador (`tipo_entidad`) y el
 * RUT nullable (las contrapartes de lobby no traen RUT; los proveedores sí).
 */
export interface EntidadTerceroRow {
  /** Id estable de la maestra (formato `E00001`, vía entidad_id_seq). */
  id: string;
  /** Clave de blocking (fold de acentos vía `normalizarNombre` de @obs/core). */
  nombre_normalizado: string;
  /** Discriminador 'natural'|'juridica' — gobierna la rama jurídica-solo-RUT (Δ2). */
  tipo_entidad: TipoEntidad;
  /** RUT NULLABLE (uso interno; nunca cruza al LLM). */
  rut: string | null;
}

/** Mención foránea (contraparte de lobby, proveedor de contrato) que pide un entidad_tercero_id. */
export interface MentionEntidad {
  /** RUT (cuando exista; LeyLobby no lo trae para contrapartes). */
  rut?: string;
  /** Clave de comparación producida por `normalizarNombre`. */
  nombreNormalizado: string;
  /** Discriminador de la mención: gobierna la ramificación (Δ1/Δ2). */
  tipoEntidad: TipoEntidad;
}

/** Resultado de la reconciliación determinista de un tercero. */
export type ResolutionEntidad =
  | { estado: "confirmado"; metodo: "rut" | "nombre"; id: string }
  | { estado: "no_confirmado"; razon: "homonimo" | "sin-candidato" | "juridica-sin-rut" };

/**
 * Filtra la maestra por RUT exacto (normalizado). Devuelve las filas cuyo RUT no nulo normaliza
 * igual al objetivo. `length === 1` es la única condición de confirmación por RUT.
 */
function filtrarPorRut(rut: string, maestra: EntidadTerceroRow[]): EntidadTerceroRow[] {
  const objetivo = normRut(rut);
  return maestra.filter((e) => e.rut != null && normRut(e.rut) === objetivo);
}

/**
 * Resuelve la identidad de una mención de tercero contra la maestra. Fail-closed: cada rama
 * confirma únicamente con EXACTAMENTE una coincidencia.
 *
 * RAMIFICACIÓN:
 *   - Δ2 jurídica PRIMERO: si `tipoEntidad === 'juridica'` → SOLO la rama RUT puede confirmar.
 *     Sin RUT o RUT no único → `no_confirmado` razón 'juridica-sin-rut' DIRECTO (no toca nombre,
 *     no habilita LLM).
 *   - natural: RUT-único O nombre-único-POR-TIPO confirman; homónimo (2+) → 'homonimo';
 *     sin candidato (0) → 'sin-candidato'.
 */
export function matchDeterministaEntidad(
  mention: MentionEntidad,
  maestra: EntidadTerceroRow[],
): ResolutionEntidad {
  const tieneRut = mention.rut != null && mention.rut.trim() !== "";

  // ── Δ2: rama JURÍDICA (LOCKED) — SOLO RUT exacto único confirma ────────────────
  // Una jurídica NUNCA cae a la rama nombre y NUNCA habilita el LLM aguas arriba.
  if (mention.tipoEntidad === "juridica") {
    if (tieneRut) {
      const porRut = filtrarPorRut(mention.rut!, maestra);
      if (porRut.length === 1) {
        return { estado: "confirmado", metodo: "rut", id: porRut[0]!.id };
      }
    }
    // Sin RUT, o RUT no único (0 / 2+): fail-closed DIRECTO, sin rama nombre.
    return { estado: "no_confirmado", razon: "juridica-sin-rut" };
  }

  // ── rama NATURAL ───────────────────────────────────────────────────────────────
  // 1. RUT exacto único (cuando exista). 2+ o 0 → cae a la rama nombre.
  if (tieneRut) {
    const porRut = filtrarPorRut(mention.rut!, maestra);
    if (porRut.length === 1) {
      return { estado: "confirmado", metodo: "rut", id: porRut[0]!.id };
    }
  }

  // 2. nombre_normalizado ÚNICO por TIPO (Δ1: unicidad calculada por tipo_entidad,
  //    no por cámara/periodo — N/A para terceros).
  const porNombre = maestra.filter(
    (e) =>
      e.tipo_entidad === mention.tipoEntidad &&
      e.nombre_normalizado === mention.nombreNormalizado,
  );
  if (porNombre.length === 1) {
    return { estado: "confirmado", metodo: "nombre", id: porNombre[0]!.id };
  }

  // 3. Fail-closed: homónimo (2+) o sin candidato (0) → no se auto-acepta.
  return {
    estado: "no_confirmado",
    razon: porNombre.length > 1 ? "homonimo" : "sin-candidato",
  };
}
