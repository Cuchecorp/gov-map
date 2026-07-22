/**
 * Contrato de datos: `citacion.fecha` y `sesion_sala.fecha` — día calendario chileno.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONTRATO (verificado en PROD, 278/278 citaciones con `00:00:00+00`):
 *
 * Estos dos campos NO son timestamps reales con hora — son fechas DATE-ONLY
 * almacenadas como MEDIANOCHE UTC. La hora real de la sesión vive en la columna
 * `horario` (texto, p.ej. "10:30"). Por tanto, la PARTE FECHA UTC de estos campos
 * (`new Date(iso).toISOString().slice(0,10)`) YA ES el día calendario chileno
 * publicado por la fuente — NO se debe convertir de zona.
 *
 * Interpretar esa medianoche UTC en America/Santiago FABRICA el día anterior:
 *   fecha = 2026-07-20T00:00:00Z  (día publicado = lunes 20)
 *   Intl es-CL tz America/Santiago → "19-jul" (offset −03/−04 retrocede a domingo)
 *   → INCORRECTO. El día real publicado es el 20.
 *
 * La regla LOCKED "renderizar en tz America/Santiago" (MEMORY, 0048) aplica a
 * TIMESTAMPS REALES CON HORA (lobby, tramitación, fecha_captura): esos sí se
 * convierten de zona porque llevan una hora de reloj real. Para los campos
 * date-only-midnight-UTC de agenda, la conversión de zona introduce un corrimiento
 * de un día. Este helper es el ÚNICO punto que codifica esa distinción.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Día calendario chileno (YYYY-MM-DD) de un campo date-only-midnight-UTC
 * (`citacion.fecha` / `sesion_sala.fecha`). Devuelve la PARTE FECHA UTC del ISO —
 * que por contrato ES el día publicado por la fuente — SIN convertir de zona.
 *
 * @param fechaIso ISO string del campo (o `Date`). NUNCA se interpreta en tz local.
 * @returns "YYYY-MM-DD" (el día publicado), o `null` si la fecha no es parseable.
 */
export function diaCalendarioCitacion(
  fechaIso: string | Date | null | undefined,
): string | null {
  if (fechaIso == null) return null;
  const d = fechaIso instanceof Date ? fechaIso : new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return null;
  // Parte fecha UTC = día publicado por la fuente (contrato date-only-midnight-UTC).
  // Cero aritmética de zona: no se usa Intl con timeZone America/Santiago.
  return d.toISOString().slice(0, 10);
}

const MESES_ES_CORTO = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const DIAS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const MESES_ES_LARGO = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Rótulo corto "DD-mmm" (p.ej. "20-jul") del día calendario de una citación.
 * Se formatea desde el DÍA CIVIL (parte fecha UTC), NO desde el instante en tz
 * Chile — así el badge dice el día publicado, no el anterior. Devuelve `null` si
 * la fecha no es parseable (el caller omite el badge).
 */
export function badgeFechaCitacion(
  fechaIso: string | Date | null | undefined,
): string | null {
  const dia = diaCalendarioCitacion(fechaIso);
  if (dia === null) return null;
  const [, m, d] = dia.split("-");
  return `${d}-${MESES_ES_CORTO[Number(m) - 1]}`;
}

/**
 * Rótulo largo "Lunes 20 de julio" del día calendario de una citación, capitalizado.
 * Se formatea desde el DÍA CIVIL (parte fecha UTC) usando `Date.UTC` al mediodía —
 * cero conversión de zona — para que el weekday/día/mes correspondan al día
 * publicado. Devuelve `null` si la fecha no es parseable (el caller degrada a "Sin
 * fecha asignada").
 */
export function dayLabelCitacion(
  fechaIso: string | Date | null | undefined,
): string | null {
  const dia = diaCalendarioCitacion(fechaIso);
  if (dia === null) return null;
  const [y, m, d] = dia.split("-").map(Number);
  // Mediodía UTC para leer weekday sin riesgo de cruce de huso.
  const civil = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = DIAS_ES[civil.getUTCDay()];
  const mes = MESES_ES_LARGO[m - 1];
  const label = `${weekday} ${d} de ${mes}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
