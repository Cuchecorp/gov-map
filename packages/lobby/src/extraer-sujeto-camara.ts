// extraer-sujeto-camara — del nombre RAW del sujeto pasivo de la Cámara, extrae el NOMBRE DEL
// PARLAMENTARIO REAL cuando el sujeto pasivo publicado es un asesor.
//
// El portal de la Cámara a veces publica como sujeto pasivo a un ASESOR, con el diputado/senador
// real entre paréntesis: `"<Asesor> (Asesor(a) H.D. <Diputado>)"` (H.D. = Honorable Diputado/a;
// también puede aparecer H.S. = Honorable Senador/a). Para el CRUCE de identidad interesa el
// nombre del honorable, no el del asesor — pero el `mencionSujeto` ALMACENADO sigue siendo el RAW
// (eso lo maneja `reconciliarSujeto`; aquí SOLO se deriva el nombre a buscar).
//
// Si no hay un paréntesis con `H.D.`/`H.S.`, se devuelve el RAW recortado tal cual (un nombre
// normal, o un nombre con paréntesis no relacionados, NO dispara extracción).

/**
 * Regex de extracción del honorable. Captura el nombre tras `H.D.`/`H.S.` (case-insensitive,
 * tolera `H.D` / `H.D.` / espacios entre los componentes) hasta el ÚLTIMO paréntesis de cierre o
 * el fin de la cadena — así el `(a)` interno de `(Asesor(a) ...)` no corta la captura.
 */
const RE_HONORABLE = /H\.?\s*[DS]\.?\s+(.+?)\s*\)?\s*$/i;

/**
 * Dado el nombre RAW de un sujeto pasivo de la Cámara, devuelve el nombre del diputado/senador
 * real si está nombrado como honorable en un paréntesis; si no, el RAW recortado.
 */
export function extraerNombreSujetoCamara(raw: string): string {
  const trimmed = raw.trim();
  // Solo se intenta extraer si el RAW contiene un paréntesis con H.D./H.S.
  if (!/\(/.test(trimmed)) return trimmed;
  const m = trimmed.match(RE_HONORABLE);
  if (!m || !m[1]) return trimmed;
  // Recorta y colapsa el whitespace interno del nombre capturado.
  const nombre = m[1].replace(/\s+/g, " ").trim();
  return nombre.length > 0 ? nombre : trimmed;
}
