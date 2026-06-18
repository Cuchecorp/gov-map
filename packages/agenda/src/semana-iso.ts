// @obs/agenda — helper de semana ISO-8601 (la "cobertura completa" de Cámara por
// enumeración de semanas).
//
// ISO-8601 ancla la semana al JUEVES: la semana 1 de un año es la que contiene su
// primer jueves (equivalentemente, la que contiene el 4 de enero). Como consecuencia:
//   - 2026-01-01 (jueves) → 2026-W01, pero 2021-01-01 (viernes) → 2020-W53.
//   - Algunos años tienen 53 semanas (cuando el 1 de enero es jueves, o es miércoles
//     en año bisiesto): p.ej. 2020 y 2026.
//
// NO se usa aritmética naïf de fechas (Pitfall 4 del RESEARCH): todo se calcula sobre
// el "jueves de la semana" en UTC para evitar desfases de huso/horario de verano.

export interface SemanaIso {
  year: number;
  week: number;
}

const MS_POR_DIA = 86_400_000;

/** Día de la semana ISO: lunes=1 … domingo=7 (a partir del getUTCDay() 0=domingo). */
function isoDow(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * Semana ISO-8601 de una fecha, anclada al jueves.
 * Devuelve `{ year, week }` donde `year` es el AÑO ISO (puede diferir del año natural
 * en los bordes: 2021-01-01 → { year: 2020, week: 53 }).
 */
export function isoWeekOf(date: Date): SemanaIso {
  // Trabajar a medianoche UTC del día dado (descarta hora).
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Mover al jueves de esta semana ISO: jueves = 4. (target + (4 - dow) días).
  target.setUTCDate(target.getUTCDate() + 4 - isoDow(target));
  const isoYear = target.getUTCFullYear();
  // 1 de enero del año ISO del jueves.
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  // Número de semana = ceil(((jueves - 1ene) / 7 días) + 1).
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / MS_POR_DIA + 1) / 7);
  return { year: isoYear, week };
}

/** Cantidad de semanas ISO de un año (52 o 53), vía el jueves del 28 de diciembre. */
export function semanasEnAnioIso(isoYear: number): number {
  // El 28 de diciembre siempre cae en la última semana ISO del año.
  return isoWeekOf(new Date(Date.UTC(isoYear, 11, 28))).week;
}

/** Lunes (UTC) de una semana ISO dada — base canónica para iterar. */
function lunesDeSemana(year: number, week: number): Date {
  // Jueves de la semana 1 del año = 4 de enero ⇒ el lunes de la W1 = 4 ene − (dow(4ene)−1).
  const cuatroEne = new Date(Date.UTC(year, 0, 4));
  const lunesW1 = new Date(cuatroEne);
  lunesW1.setUTCDate(cuatroEne.getUTCDate() - (isoDow(cuatroEne) - 1));
  const lunes = new Date(lunesW1);
  lunes.setUTCDate(lunesW1.getUTCDate() + (week - 1) * 7);
  return lunes;
}

/** Formatea `YYYY-Www` con padding de 2 dígitos en la semana (`2026-W05`). */
export function semanaIsoKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Parámetro `prmSemana` de Cámara: `"{year}-{week}"` SIN padding (`2026-25`). */
export function prmSemanaParam(year: number, week: number): string {
  return `${year}-${week}`;
}

/**
 * Enumera todas las semanas ISO entre `desde` y `hasta` (ambos inclusive), cruzando el
 * borde de año sin saltar ni duplicar y respetando los años de 53 semanas.
 * Lanza si `hasta` es anterior a `desde`.
 */
export function enumerarSemanas(desde: SemanaIso, hasta: SemanaIso): SemanaIso[] {
  const inicioLunes = lunesDeSemana(desde.year, desde.week).getTime();
  const finLunes = lunesDeSemana(hasta.year, hasta.week).getTime();
  if (finLunes < inicioLunes) {
    throw new RangeError(
      `enumerarSemanas: 'hasta' (${semanaIsoKey(hasta.year, hasta.week)}) es anterior a 'desde' (${semanaIsoKey(desde.year, desde.week)})`,
    );
  }
  const semanas: SemanaIso[] = [];
  // Iterar lunes a lunes (7 días); derivar la clave ISO de cada lunes evita errores de
  // borde (la W1 puede caer en diciembre y los años de 53 semanas se respetan solos).
  for (let t = inicioLunes; t <= finLunes; t += 7 * MS_POR_DIA) {
    semanas.push(isoWeekOf(new Date(t)));
  }
  return semanas;
}
