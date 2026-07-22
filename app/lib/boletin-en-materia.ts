/**
 * Extractor de boletines EMBEBIDOS en texto libre (LOB-02, fail-closed #1).
 *
 * A diferencia de `detectarBoletin` (app/lib/boletin-detector.ts), que valida si la
 * QUERY COMPLETA es un boletín, este escanea texto libre (la `materia` raw de una
 * audiencia de lobby) y devuelve TODOS los boletines mencionados EXPLÍCITAMENTE.
 *
 * ── REGLA LOCKED (dirimida por el orquestador — riesgo #1 de Phase 92) ─────────────
 * En texto libre un número pelado NO es evidencia de boletín. El extractor acepta SOLO:
 *   (a) formas CON sufijo `-NN` (p.ej. "14309-04", "14.309-04") en cualquier posición
 *       del texto — el sufijo las hace inequívocas.
 *   (b) números SIN sufijo (pelados o punteados, 3-6 dígitos) SOLO si van precedidos
 *       (hasta 3 tokens antes) por la palabra "boletín"/"boletin"/"bol." (case-insensitive).
 * TODO lo demás se rechaza:
 *   "Ley 20.730" → []   (una ley, no un boletín)
 *   "año 2024"   → []   (año)
 *   "20730" suelto → [] (número pelado sin gatillo)
 *   "$14.309"    → []   (dinero / separador decimal)
 *
 * DIVERGENCIA DELIBERADA vs `detectarBoletin`: aquél trata "20730" o "14.309" como
 * boletín válido PORQUE la query completa ya es (por contexto de búsqueda) un intento
 * de boletín. En texto libre esa señal contextual no existe → exigimos un gatillo léxico
 * ("boletín") o el sufijo `-NN` inequívoco. Misma exclusión de separador decimal.
 *
 * ── FORMATO DE SALIDA ──────────────────────────────────────────────────────────────
 * Cada boletín se emite en forma canónica `base` (sin sufijo) o `base-sufijo` (con guion,
 * puntos de miles colapsados), deduplicado, ordenado ascendente por número base.
 *
 * ── FAIL-CLOSED #2 NO VIVE AQUÍ ────────────────────────────────────────────────────
 * La segunda compuerta (el boletín extraído debe EXISTIR en la tabla `proyecto`) es
 * responsabilidad del consumidor: la RPC `lobby_menciones_de_boletin` (join a proyecto)
 * o una query batched a `proyecto` desde el server component. Este extractor es puro y
 * NO consulta la DB — solo aplica el patrón determinista de formato.
 *
 * Función pura, sin imports de runtime.
 *
 * GUARD DE EQUIVALENCIA TS↔SQL: el regex SQL de la RPC 0062 espeja estas reglas; el
 * fixture compartido `FIXTURE_MATERIA` (boletin-en-materia.test.ts) se aserta en vitest
 * (aquí) Y en el pgTAP de 0062 (filas mencionadas vs no-mencionadas).
 */

// (a) Boletín CON sufijo -NN, en cualquier posición. La base admite forma punteada
//     (separador de miles) o plana; el sufijo es 1-2 dígitos. `\b` delimita palabra.
const BOLETIN_CON_SUFIJO = /\b(\d{1,3}(?:\.\d{3})*|\d{3,6})-(\d{1,2})\b/g;

// (b) Número SIN sufijo. El lookahead rechaza SOLO la continuación que lo volvería
//     otro token: otro dígito (`\d`), un punto-de-miles/decimal (`.` seguido de dígito),
//     o el guion de sufijo (`-` seguido de dígito, ya capturado por (a)). CRÍTICO
//     (WR-01): NO rechaza un punto de FIN DE ORACIÓN ("boletín 14309." → sí matchea),
//     que es puntuación común en `materia` de texto libre y que el regex SQL de la RPC
//     (branch b, `\M(?!-[[:digit:]])`) ya acepta. Rechazar `.`/`-` incondicionalmente
//     (regla vieja `(?![\d.-])`) producía un falso-negativo TS vs el SQL.
const NUMERO_SIN_SUFIJO = /(\d{1,3}(?:\.\d{3})*|\d{3,6})(?![\d]|\.\d|-\d)/g;

// Gatillo léxico que legitima un número pelado como mención de boletín.
const GATILLO = /(bolet[ií]n|bol\.)/i;

export function extraerBoletines(materia: string | null): string[] {
  if (!materia) return [];
  const encontrados = new Set<string>();

  // (a) formas con sufijo -NN → inequívocas por el sufijo.
  BOLETIN_CON_SUFIJO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOLETIN_CON_SUFIJO.exec(materia)) !== null) {
    const base = m[1]!.replace(/\./g, "");
    if (base.length >= 3 && base.length <= 6) {
      encontrados.add(`${base}-${m[2]}`);
    }
  }

  // (b) números sin sufijo SOLO si un gatillo aparece en los ≤3 tokens previos.
  NUMERO_SIN_SUFIJO.lastIndex = 0;
  let n: RegExpExecArray | null;
  while ((n = NUMERO_SIN_SUFIJO.exec(materia)) !== null) {
    const raw = n[0]!;
    if (raw.includes("-")) continue; // ya cubierto por (a)
    const base = raw.replace(/\./g, "");
    if (base.length < 3 || base.length > 6) continue; // fuera de rango de boletín
    const contextoPrevio = materia.slice(0, n.index);
    const tokensPrevios = contextoPrevio.trim().split(/\s+/).filter(Boolean);
    const ventana = tokensPrevios.slice(-3).join(" ");
    if (GATILLO.test(ventana)) encontrados.add(base);
  }

  return [...encontrados].sort((a, b) => {
    const na = parseInt(a.split("-")[0]!, 10);
    const nb = parseInt(b.split("-")[0]!, 10);
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  });
}
