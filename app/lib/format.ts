/**
 * Formato de fechas y tiempo relativo en español (es-CL).
 * UI-SPEC §1.2 / §4 / §9.4. Tono sobrio, sin abreviaturas en inglés.
 */

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 horas (UI-SPEC §4)

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
 * `true` si el dato tiene más de 48h (potencialmente desactualizado).
 * UI-SPEC §4: no se oculta el dato, se marca en amber.
 */
export function esStale(capturedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - capturedAt.getTime() > STALE_THRESHOLD_MS;
}
