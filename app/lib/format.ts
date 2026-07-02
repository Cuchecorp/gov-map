/**
 * Formato de fechas y tiempo relativo en español (es-CL).
 * UI-SPEC §1.2 / §4 / §9.4. Tono sobrio, sin abreviaturas en inglés.
 */

// Umbral de frescura por CADENCE de ingesta (~14 días), no por 48 h fijas.
// La ingesta de la mayoría de las fuentes es semanal ⇒ 2× cadence da un margen
// honesto: un dato de 10-13 días es normal, no una alarma. 48 h dejaba el badge
// en ámbar permanente para datos con ingesta semanal (falso positivo de frescura).
const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 días (cadence de ingesta)

const fechaCortaFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Fecha absoluta corta en español: "14 may 2026".
 */
export function fechaCorta(d: Date): string {
  return fechaCortaFormatter.format(d);
}

/**
 * Tiempo relativo legible en español respecto a `now` (por defecto, ahora).
 * Rangos (UI-SPEC §4):
 *   < 1h  → "hace X min"
 *   < 24h → "hace X h"
 *   < 7d  → "hace X días"
 *   ≥ 7d  → fecha absoluta (DD MMM YYYY)
 */
export function relativeTimeEs(capturedAt: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - capturedAt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 0) {
    // Captura en el futuro (reloj desfasado): tratar como "recién".
    return "hace 0 min";
  }
  if (diffHours < 1) {
    return `hace ${diffMin} min`;
  }
  if (diffDays < 1) {
    return `hace ${diffHours} h`;
  }
  if (diffDays < 7) {
    // Pluralización en español: "1 día" / "3 días".
    return `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
  }
  return fechaCorta(capturedAt);
}

/**
 * `true` si el dato supera el umbral de frescura por cadence de ingesta
 * (por defecto ~14 días, ingesta semanal ⇒ 2× cadence, margen honesto).
 * UI-SPEC §4: no se oculta el dato, se marca en amber.
 *
 * Firma retro-compatible: `staleAfterMs` es opcional (tercer parámetro) para
 * que el único call-site `esStale(capturedAt)` compile sin cambios y el nuevo
 * default propague a todos los consumidores de ProvenanceBadge.
 */
export function esStale(
  capturedAt: Date,
  now: Date = new Date(),
  staleAfterMs: number = STALE_THRESHOLD_MS,
): boolean {
  return now.getTime() - capturedAt.getTime() > staleAfterMs;
}

/**
 * Extracto LITERAL de la idea matriz para la ficha (Phase 22, §9). NUNCA
 * reescribe, resume ni reinterpreta — sólo normaliza espacios y TRUNCA en límite
 * de palabra, agregando "…" cuando corta. La salida es siempre un PREFIJO de la
 * fuente (más la elipsis), de modo que el ciudadano lee texto de la fuente, no
 * texto fabricado. Si la idea es null/vacía, el llamador muestra el honest-state
 * "no disponible aún" — esta función no inventa contenido.
 */
export function extractoIdea(idea: string, max = 160): string {
  const limpio = idea.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  // Corta en el último espacio dentro del presupuesto → no parte una palabra.
  const ventana = limpio.slice(0, max);
  const corte = ventana.lastIndexOf(" ");
  const prefijo = (corte > 0 ? ventana.slice(0, corte) : ventana).trimEnd();
  return `${prefijo}…`;
}

/**
 * Conteo de una votación "58–81" con guion largo (en dash U+2013), listo para
 * render en Mono (UI-SPEC §2). Hecho factual de la votación, sin formateo que
 * altere los valores de la fuente. No fabrica abstención/quórum si no se piden.
 */
export function conteoVotacion(si: number, no: number): string {
  return `${si}–${no}`;
}
