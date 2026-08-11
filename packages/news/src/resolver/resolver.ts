// resolver.ts — resolver determinista OFFLINE del contrato anti-alucinación (Phase 134,
// SC1/SC2, NEWS-04).
//
// PIEZA 2 de las tres: el LLM (135) emite boletín/nombre DE LA LISTA CERRADA inyectada en el
// prompt (SC1, D-133-H); este módulo mapea esa emisión contra la lista SIN red y SIN LLM.
// Ambigüedad ⇒ `null`, JAMÁS best-guess (T-134-02): un vínculo inventado en la ficha de una
// persona identificable es el daño irreversible que todo este contrato existe para impedir.
//
// `null` aquí NO es un error: es la señal de dead-letter (SC3). El llamador escribe el
// rechazo con su `rejection_stage` — nada se fabrica, todo rechazo tiene causa.

import { fold } from "../prefiltro-lexico.js";
import { extraerBoletines } from "./boletin-en-materia.js";

export interface AllowlistResolver {
  /** Boletines en forma canónica `base` o `base-sufijo` (la de `extraerBoletines`). */
  readonly boletines: ReadonlySet<string>;
  /** Parlamentarios en ejercicio: variante de nombre NORMALIZADA → ids internos que la
   * comparten. Dos personas con la misma variante (homónimos) conviven en el array y hacen
   * la variante irresoluble (fail-closed). El id JAMÁS viaja al LLM (SC1: "jamás un id") —
   * vive solo de este lado del contrato. */
  readonly parlamentarios: ReadonlyMap<string, readonly string[]>;
}

/**
 * SC1: allowlist vacía ⇒ el pipeline falla LOUD ANTES de procesar nada. Un clasificador
 * corriendo contra una lista vacía resolvería `null` el 100% de las veces y llenaría el
 * dead-letter con basura "honesta" — el fallo real (la carga de la lista) quedaría mudo.
 */
export function assertAllowlistNoVacia(allowlist: AllowlistResolver): void {
  if (allowlist.boletines.size === 0) {
    throw new Error("resolver: allowlist de boletines VACÍA — pipeline detenido (SC1, jamás procesar con lista vacía)");
  }
  if (allowlist.parlamentarios.size === 0) {
    throw new Error("resolver: allowlist de parlamentarios VACÍA — pipeline detenido (SC1)");
  }
}

/**
 * Resuelve la EMISIÓN de boletín del LLM contra la lista cerrada. Determinista, offline:
 * 1. Formas CON sufijo `-NN` se normalizan con `extraerBoletines` — la MISMA regla LOCKED
 *    del resto del sistema (el sufijo las hace inequívocas en cualquier posición).
 * 2. Un número PELADO solo se acepta si la emisión ENTERA es ese número (con "boletín"/
 *    "bol." opcional delante y nada más). "Ley 20.730" u otro texto acompañante ⇒ null —
 *    NO se fabrica el gatillo léxico que la regla LOCKED exige: una emisión que menciona
 *    una LEY no es una emisión de boletín (la confusión ley/boletín es el falso positivo
 *    exacto que `extraerBoletines` rechaza, y este resolver no lo reintroduce).
 * 3. Ambigüedad en cualquier paso (dos boletines extraídos, base con dos sufijos en la
 *    lista) ⇒ null. El canónico debe pertenecer a la allowlist.
 */
const EMISION_PELADA = /^(?:bolet[ií]n\s+|bol\.\s*)?(\d{1,3}(?:\.\d{3})*|\d{3,6})$/i;

export function resolverBoletin(
  emision: string | null | undefined,
  allowlist: AllowlistResolver,
): string | null {
  assertAllowlistNoVacia(allowlist);
  if (!emision || emision.trim().length === 0) return null;
  const limpio = emision.trim();

  let canonico: string;
  const extraidos = extraerBoletines(limpio);
  if (extraidos.length > 1) return null;
  if (extraidos.length === 1) {
    canonico = extraidos[0]!;
  } else {
    const m = EMISION_PELADA.exec(limpio);
    if (!m) return null;
    const base = m[1]!.replace(/\./g, "");
    if (base.length < 3 || base.length > 6) return null;
    canonico = base;
  }

  if (allowlist.boletines.has(canonico)) return canonico;

  // Emisión sin sufijo: aceptar solo si UNA entrada de la lista comparte la base.
  if (!canonico.includes("-")) {
    const conBase = [...allowlist.boletines].filter(
      (b) => b === canonico || b.startsWith(`${canonico}-`),
    );
    return conBase.length === 1 ? conBase[0]! : null;
  }
  return null;
}

/** Normalización de nombre para el match: fold (minúsculas, sin tildes) + espacios colapsados. */
export function normalizarNombre(nombre: string): string {
  return fold(nombre).replace(/\s+/g, " ").trim();
}

/**
 * Resuelve la EMISIÓN de nombre de parlamentario contra la lista cerrada (A2.3 de 133):
 * match por igualdad EXACTA del nombre normalizado, y si no, por inclusión de TODOS los
 * tokens emitidos en un único candidato (token-set, el patrón de identidad del proyecto).
 * Homónimo, apellido suelto que matchea a dos, o coincidencia parcial repartida ⇒ `null`.
 * Devuelve el ID INTERNO (que el LLM jamás vio) — el vínculo publicable.
 */
export function resolverParlamentario(
  emision: string | null | undefined,
  allowlist: AllowlistResolver,
): string | null {
  assertAllowlistNoVacia(allowlist);
  if (!emision || emision.trim().length === 0) return null;
  const emitido = normalizarNombre(emision);
  if (emitido.length === 0) return null;

  const exactos = allowlist.parlamentarios.get(emitido);
  if (exactos !== undefined) {
    return exactos.length === 1 ? exactos[0]! : null; // homónimos exactos ⇒ ambiguo ⇒ null
  }

  const tokensEmitidos = emitido.split(" ").filter(Boolean);
  if (tokensEmitidos.length < 2) return null; // apellido suelto: JAMÁS resuelve (A2.3)

  const candidatos = new Set<string>();
  for (const [nombre, ids] of allowlist.parlamentarios) {
    const tokensNombre = new Set(nombre.split(" "));
    if (tokensEmitidos.every((t) => tokensNombre.has(t))) {
      for (const id of ids) candidatos.add(id);
    }
  }
  return candidatos.size === 1 ? [...candidatos][0]! : null;
}
