/**
 * Detector de número de boletín en tres formatos:
 *   - "14309-04"   → {base:"14309", sufijo:"04"}
 *   - "14309"      → {base:"14309", sufijo:null}
 *   - "14.309-04"  → {base:"14309", sufijo:"04"}  (formato punteado, Pitfall #5)
 *   - "14.309"     → {base:"14309", sufijo:null}
 *
 * La regex actual en app/lib/buscar.ts (/^\d{3,6}(-\d{1,2})?$/) NO cubre el
 * formato punteado. Este detector lo extiende.
 *
 * Devuelve null si la query es texto libre (no es un boletín).
 * El consumidor decide si hace short-circuit antes de FTS/semántico.
 */
export function detectarBoletin(
  q: string,
): { base: string; sufijo: string | null } | null {
  const stripped = q.trim().replace(/\./g, "");
  if (!/^\d{3,6}(-\d{1,2})?$/.test(stripped)) return null;
  const [base, sufijo = null] = stripped.split("-");
  return { base: base!, sufijo };
}
