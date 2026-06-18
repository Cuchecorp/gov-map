/**
 * Helpers de semana ISO-8601 para la /agenda (frontend). Espejan la aritmética
 * de `@obs/agenda` (`semana-iso.ts`) pero viven en el frontend para no acoplar
 * la app al paquete backend (UI-SPEC §12.2).
 *
 * ISO-8601 ancla la semana al JUEVES: la semana 1 de un año es la que contiene
 * su primer jueves (equivalentemente, la que contiene el 4 de enero). Algunos
 * años tienen 53 semanas. Toda la aritmética se hace sobre el "jueves de la
 * semana" en UTC para evitar desfases de huso/horario de verano.
 */

export interface ISOWeek {
  year: number;
  week: number;
}

const MS_POR_DIA = 86_400_000;

/** Día de la semana ISO: lunes=1 … domingo=7. */
function isoDow(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

/** Semana ISO-8601 de una fecha, anclada al jueves (year = AÑO ISO). */
export function isoWeekOf(date: Date): ISOWeek {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  target.setUTCDate(target.getUTCDate() + 4 - isoDow(target));
  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / MS_POR_DIA + 1) / 7
  );
  return { year: isoYear, week };
}

/** Cantidad de semanas ISO de un año (52 o 53). */
export function semanasEnAnioIso(isoYear: number): number {
  return isoWeekOf(new Date(Date.UTC(isoYear, 11, 28))).week;
}

/** Semana ISO actual (server-side, momento de render). */
export function currentISOWeek(now: Date = new Date()): ISOWeek {
  return isoWeekOf(now);
}

/**
 * Parsea `YYYY-Www` (p.ej. "2026-W25"). Tolerante a malformado / ausente:
 * devuelve la semana ISO actual como fallback (UI-SPEC §12.1: sin redirect).
 * También valida que la semana esté en rango [1, semanasEnAnioIso(year)].
 */
export function parseISOWeek(
  semana: string | null | undefined,
  now: Date = new Date()
): ISOWeek {
  if (typeof semana !== "string") return currentISOWeek(now);
  const m = /^(\d{4})-W(\d{2})$/.exec(semana.trim());
  if (!m) return currentISOWeek(now);
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return currentISOWeek(now);
  }
  if (!Number.isInteger(week) || week < 1 || week > semanasEnAnioIso(year)) {
    return currentISOWeek(now);
  }
  return { year, week };
}

/** Lunes (UTC) de una semana ISO dada. */
function lunesDeSemana(year: number, week: number): Date {
  const cuatroEne = new Date(Date.UTC(year, 0, 4));
  const lunesW1 = new Date(cuatroEne);
  lunesW1.setUTCDate(cuatroEne.getUTCDate() - (isoDow(cuatroEne) - 1));
  const lunes = new Date(lunesW1);
  lunes.setUTCDate(lunesW1.getUTCDate() + (week - 1) * 7);
  return lunes;
}

/** Lunes–domingo (UTC) de una semana ISO. */
export function getWeekBounds(
  year: number,
  week: number
): { start: Date; end: Date } {
  const start = lunesDeSemana(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

/** Clave `YYYY-Www` con padding de 2 dígitos (p.ej. "2026-W05"). */
export function semanaIsoKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Semana ISO anterior (cruza el borde de año respetando años de 53 semanas). */
export function prevISOWeek({ year, week }: ISOWeek): ISOWeek {
  if (week > 1) return { year, week: week - 1 };
  return { year: year - 1, week: semanasEnAnioIso(year - 1) };
}

/** Semana ISO siguiente (cruza el borde de año respetando años de 53 semanas). */
export function nextISOWeek({ year, week }: ISOWeek): ISOWeek {
  if (week < semanasEnAnioIso(year)) return { year, week: week + 1 };
  return { year: year + 1, week: 1 };
}

const diaFmt = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const diaMesAnioFmt = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Etiqueta de la semana para el WeekNav: "Semana 25 · 16–22 jun 2026" (es-CL).
 * El año se muestra una sola vez al final.
 */
export function formatWeekLabel(year: number, week: number): string {
  const { start, end } = getWeekBounds(year, week);
  const startLabel = diaFmt.format(start); // "16 jun"
  const endLabel = diaMesAnioFmt.format(end); // "22 jun 2026"
  // "16 jun" – "22 jun 2026" → comprimir si el mes coincide deja ambos meses;
  // mantenemos los dos meses para no ambigüedad en semanas que cruzan mes.
  return `Semana ${week} · ${startLabel}–${endLabel}`;
}
