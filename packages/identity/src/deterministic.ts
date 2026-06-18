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

/**
 * Fila de la maestra que PUEDE exponer su `clave_estricta` (paterno + materno + nombres,
 * vía `normalizarNombre`). El matcher la usa SOLO para desempatar homónimos por materno
 * (WR-01); si está ausente, el matcher degrada de forma segura a `nombre_normalizado`.
 */
export type MaestraRow = Parlamentario & { clave_estricta?: string };

/** Mención foránea (votación/proyecto, Fase 5+) que pide un parlamentario_id. */
export interface Mention {
  /** RUT (cuando exista; los catálogos no lo traen — aplica vs InfoProbidad, Fase 4+). */
  rut?: string;
  /** Clave de comparación producida por `normalizarNombre` (SIN materno). */
  nombreNormalizado: string;
  /**
   * Clave ESTRICTA (paterno + materno + nombres) de `normalizarNombre`. Opcional: presente en
   * el self-match del catálogo (ambos lados traen materno). Cuando se provee Y los candidatos
   * la exponen, desempata homónimos del `nombreNormalizado` (WR-01) — distingue dos personas
   * que comparten paterno + nombres pero difieren en materno. Ausente en el cross-source
   * (votación), donde el materno no converge; ahí solo cuenta `nombreNormalizado`.
   */
  claveEstricta?: string;
  /** Cámara de la mención. */
  camara: Parlamentario["camara"];
  /** Periodo de la mención (clave de blocking junto a `camara`). */
  periodo: string;
}

/** Resultado de la reconciliación determinista. */
export type Resolution =
  | { estado: "confirmado"; metodo: "rut" | "nombre" | "nombre-estricto"; id: string }
  | { estado: "no_confirmado"; razon: "homonimo" | "sin-candidato" };

/**
 * Normaliza un RUT para comparación: elimina puntos, espacios y guión, y hace
 * casefold del dígito verificador (la 'k' del DV puede venir en mayúscula).
 */
export function normRut(rut: string): string {
  return rut.replace(/[.\s-]/g, "").toLowerCase();
}

/**
 * Valida estructuralmente un RUT chileno (cuerpo numérico + DV módulo-11) tras normalizar
 * (IN-04). Devuelve `true` solo si el DV calculado coincide. Esto evita que dos RUTs basura
 * que normalizan igual (p.ej. tras strip de basura) se usen como clave de match equivocada
 * cuando lleguen RUTs reales en Fase 4 (InfoProbidad). Un RUT inválido se trata como "sin RUT"
 * (el matcher cae a la rama nombre).
 */
export function isRutValido(rut: string): boolean {
  const norm = normRut(rut);
  const m = /^(\d{7,8})([0-9k])$/.exec(norm);
  if (m == null) return false;
  const cuerpo = m[1]!;
  const dv = m[2]!;
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? "0" : resto === 10 ? "k" : String(resto);
  return dvEsperado === dv;
}

/**
 * Resuelve la identidad de una mención contra la maestra. Fail-closed por
 * construcción: cada rama confirma únicamente cuando hay EXACTAMENTE una
 * coincidencia (`=== 1`); en cualquier otro caso degrada a `no_confirmado`.
 *
 * WR-01: cuando `nombre_normalizado` (sin materno) produce 2+ candidatos (homónimos por
 * materno-less) PERO la mención trae `claveEstricta` y los candidatos exponen `clave_estricta`,
 * se reintenta el desempate con la clave estricta (paterno + materno + nombres). Esto solo
 * puede CONFIRMAR MENOS (nunca más): si la clave estricta sigue dando 2+ o 0, se mantiene
 * fail-closed. Garantiza que un sobreviviente de homónimos no se confirme bajo un nombre que
 * no es únicamente suyo.
 */
export function matchDeterminista(mention: Mention, maestra: MaestraRow[]): Resolution {
  // 1. RUT exacto único (cuando exista). 2+ coincidencias → NO confirma por RUT.
  // NOTA (IN-04, diferido): la validación estructural módulo-11 (`isRutValido`) está disponible
  // como utilidad para Fase 4 (InfoProbidad), donde llegan RUTs reales. NO se cablea aquí porque
  // los catálogos de esta fase NO traen RUT (rama inactiva hoy) y forzarla cambiaría la semántica
  // de los tests existentes. Se activará cuando el RUT sea una fuente de match real.
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

  // 2b. WR-01: homónimos por nombre materno-less → reintenta con la clave estricta (materno)
  //     SOLO si la mención y TODOS los candidatos la exponen. Estrictamente más seguro.
  if (
    porNombre.length > 1 &&
    mention.claveEstricta != null &&
    porNombre.every((p) => p.clave_estricta != null)
  ) {
    const porEstricta = porNombre.filter(
      (p) => p.clave_estricta === mention.claveEstricta,
    );
    if (porEstricta.length === 1) {
      return { estado: "confirmado", metodo: "nombre-estricto", id: porEstricta[0]!.id };
    }
    // 2+ (verdaderos homónimos incluso con materno) o 0: fail-closed.
  }

  // 3. Fail-closed: homónimo (2+) o sin candidato (0) → no se auto-acepta (Fase 4).
  return {
    estado: "no_confirmado",
    razon: porNombre.length > 1 ? "homonimo" : "sin-candidato",
  };
}
