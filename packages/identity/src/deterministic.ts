/**
 * matchDeterminista — reconciliación determinista de identidad (Etapa 0, ID-02).
 *
 * FUNCIÓN PURA y FAIL-CLOSED. Es el ÚNICO escritor de `estado`. Confirma SOLO si:
 *   1. RUT exacto único en la maestra, o
 *   2. nombre_normalizado único dentro de (cámara, periodo).
 * Ante cualquier ambigüedad (homónimo, 2+ por RUT, sin candidato, cross-cámara)
 * NUNCA confirma → `no_confirmado`. Esto mitiga el riesgo existencial #1 (T-03-01):
 * publicar un match equivocado como hecho.
 *
 * SIN LLM, SIN red, SIN DB: opera sobre la maestra ya cargada en memoria.
 */

import type { Parlamentario } from "@obs/core";

/** Mención foránea (votación/proyecto, Fase 5+) que pide un parlamentario_id. */
export interface Mention {
  /** RUT (cuando exista; los catálogos no lo traen — aplica vs InfoProbidad, Fase 4+). */
  rut?: string;
  /** Clave de comparación producida por `normalizarNombre`. */
  nombreNormalizado: string;
  /** Cámara de la mención. */
  camara: Parlamentario["camara"];
  /** Periodo de la mención (clave de blocking junto a `camara`). */
  periodo: string;
}

/** Resultado de la reconciliación determinista. */
export type Resolution =
  | { estado: "confirmado"; metodo: "rut" | "nombre"; id: string }
  | { estado: "no_confirmado"; razon: "homonimo" | "sin-candidato" };

/**
 * Normaliza un RUT para comparación: elimina puntos, espacios y guión, y hace
 * casefold del dígito verificador (la 'k' del DV puede venir en mayúscula).
 */
export function normRut(rut: string): string {
  return rut.replace(/[.\s-]/g, "").toLowerCase();
}

/**
 * Resuelve la identidad de una mención contra la maestra. Fail-closed por
 * construcción: cada rama confirma únicamente cuando hay EXACTAMENTE una
 * coincidencia (`=== 1`); en cualquier otro caso degrada a `no_confirmado`.
 */
export function matchDeterminista(mention: Mention, maestra: Parlamentario[]): Resolution {
  // 1. RUT exacto único (cuando exista). 2+ coincidencias → NO confirma por RUT.
  if (mention.rut != null && mention.rut.trim() !== "") {
    const objetivo = normRut(mention.rut);
    const porRut = maestra.filter((p) => p.rut != null && normRut(p.rut) === objetivo);
    if (porRut.length === 1) {
      return { estado: "confirmado", metodo: "rut", id: porRut[0]!.id };
    }
    // length 0 o 2+: no se confirma por RUT; cae a la rama nombre / fail-closed.
  }

  // 2. nombre_normalizado ÚNICO dentro de (cámara, periodo) — sin homónimo.
  const porNombre = maestra.filter(
    (p) =>
      p.camara === mention.camara &&
      p.periodo === mention.periodo &&
      p.nombre_normalizado === mention.nombreNormalizado,
  );
  if (porNombre.length === 1) {
    return { estado: "confirmado", metodo: "nombre", id: porNombre[0]!.id };
  }

  // 3. Fail-closed: homónimo (2+) o sin candidato (0) → no se auto-acepta (Fase 4).
  return {
    estado: "no_confirmado",
    razon: porNombre.length > 1 ? "homonimo" : "sin-candidato",
  };
}
