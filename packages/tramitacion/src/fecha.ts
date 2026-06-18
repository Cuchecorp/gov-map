// fecha — parseo robusto de fechas chilenas.
//
// Las fuentes del Senado entregan `dd/mm/yyyy` (p.ej. "03/06/2026"); la Cámara
// entrega ISO local sin zona (`2026-05-11T19:21:07`). `new Date("03/06/2026")` es
// AMBIGUO/erróneo en JS (lo interpreta como mm/dd o Invalid) — Pitfall 3. Este
// helper parsea cada forma EXPLÍCITAMENTE y devuelve `null` ante cualquier otra.

const RE_DDMMYYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2})?/;

/**
 * Parsea una fecha chilena a `Date`, o `null` si no reconoce el formato.
 *
 * Construcción en UTC de forma DETERMINISTA, independiente del TZ del runtime (#4/#21):
 *  - `dd/mm/yyyy`  → `Date.UTC(yyyy, mm-1, dd)` (medianoche UTC). Antes usaba medianoche
 *    LOCAL y `toIso()` (UTC) corría el día en TZ negativos (Chile: `T04:00Z`, o el día
 *    anterior según el offset).
 *  - ISO `yyyy-mm-dd[Thh:mm:ss]` sin zona → se interpreta como UTC (date-time sin offset
 *    es LOCAL por la spec ECMAScript; aquí se ancla a UTC añadiendo `Z`). La forma
 *    date-only ya es UTC por spec. Con zona explícita se respeta.
 *  - cualquier otro / inválido → `null`.
 */
export function parseFechaCL(s: string | null | undefined): Date | null {
  if (s == null) return null;
  const v = String(s).trim();
  if (v.length === 0) return null;

  const m = RE_DDMMYYYY.exec(v);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    // Rechaza overflow silencioso (p.ej. 31/02 → 03/03).
    if (
      d.getUTCFullYear() !== yyyy ||
      d.getUTCMonth() !== mm - 1 ||
      d.getUTCDate() !== dd
    ) {
      return null;
    }
    return d;
  }

  if (RE_ISO.test(v)) {
    const hasTime = /[T ]\d{2}:\d{2}:\d{2}/.test(v);
    const hasZone = /([zZ])$|[+-]\d{2}:?\d{2}$/.test(v);
    let iso = v;
    if (hasTime) {
      iso = v.replace(" ", "T");
      if (!hasZone) iso += "Z"; // ancla a UTC el date-time sin offset
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** ISO 8601 de un `Date`. */
export function toIso(d: Date): string {
  return d.toISOString();
}
