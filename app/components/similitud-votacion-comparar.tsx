/**
 * Similitud de votación (VSIM) — leyenda-contrato (Phase 102, Plan 01).
 *
 * Este archivo, POR AHORA, exporta SOLO la constante `LEYENDA_SIMILITUD_VOTO`: el
 * caveat VERBATIM (UI-SPEC Copy table) que acompaña obligatoriamente a la cifra de
 * coincidencia de votos. El cuerpo presentacional del componente
 * `<SimilitudVotacionComparar>` (display neutro, cero petróleo/bold, degrade honesto
 * M=0) lo llena Plan 03; este plan fija el CONTRATO de la constante para que el
 * linter anti-insinuación la importe verbatim y la reste de NEGACIONES_LOCKED.
 *
 * Por qué se exporta como constante única (Pitfall 3, lección BLOCKER 91): la leyenda
 * honesta USA los términos que NIEGA ("afinidad", "señal") — sin restarla verbatim de
 * NEGACIONES_LOCKED el propio linter se auto-cazaría sobre la superficie que la
 * renderiza. Espejo de `LEYENDA_CROSS_LINK` (cross-links-parlamentario.tsx) y la
 * leyenda MONEY (money-presentacion.ts).
 *
 * ANTI-DW-NOMINATE (LOCKED, VSIM-01/CONTEXT): la coincidencia de votos NO es una señal
 * de afinidad, coordinación ni bancada. La base es alta (la mayoría de las votaciones
 * se aprueban por amplia mayoría/unanimidad), así que coincidir en muchas NO indica
 * nada y discrepar en pocas TAMPOCO. El caveat pesa MÁS que la cifra.
 */

/**
 * Caveat VERBATIM de similitud de votación (UI-SPEC Copy table, LOCKED).
 * La primera oración ("La coincidencia alta es la norma, no una señal") es el verbatim
 * exigido por VSIM-01/CONTEXT; la continuación explicita la base-alta y forma parte de
 * la string de negación (registrada en NEGACIONES_LOCKED del linter anti-insinuación).
 */
export const LEYENDA_SIMILITUD_VOTO =
  "La coincidencia alta es la norma, no una señal: la mayoría de las votaciones se aprueban por amplia mayoría o unanimidad. Coincidir en muchas no indica afinidad, coordinación ni bancada; discrepar en pocas no indica lo contrario.";

/**
 * Props del componente presentacional. TODO viene resuelto por el server:
 * el componente NUNCA toca Supabase, NUNCA re-cuenta, NUNCA re-ordena, NUNCA
 * computa el %. Serializable (Server Component).
 *
 *  - n / m: coincidencias y votaciones sustantivas compartidas (ya calculadas).
 *  - pct: round(n/m·100) YA computado en el server; null cuando m===0.
 *  - fechaConsulta: día chileno de la consulta (YYYY-MM-DD, patrón WR-01).
 *  - fechaCaptura: `fecha_captura_max` que emite la RPC (provenance). null si la
 *    RPC no devolvió filas → se omite la línea de provenance.
 *  - camaraMixta: A y B son de cámaras distintas → nota de asimetría de cobertura.
 */
export interface SimilitudVotacionCompararProps {
  n: number;
  m: number;
  pct: number | null;
  fechaConsulta: string;
  fechaCaptura: string | null;
  camaraMixta: boolean;
}

/** Cobertura de voto declarada (audit Phase 98). La nota de asimetría se APPENDEA
 *  cuando el par cruza cámaras (Copy table 102-UI-SPEC). */
const COBERTURA_BASE = (fecha: string) =>
  `Cobertura del voto: Cámara ~80% confirmado por identificador; Senado ~20% por nombre (probable). El denominador refleja solo votaciones registradas en las fuentes al ${fecha}.`;
const NOTA_ASIMETRIA =
  " Comparan una diputada/o y una senadora/or: la cobertura de voto es asimétrica entre ambas cámaras, por lo que el denominador de votaciones compartidas es más incompleto.";

/**
 * SimilitudVotacionComparar — 5ª sección NEUTRAL de /comparar (VSIM-01, gated legal).
 *
 * Presentacional PURO. Renderiza, en orden de lectura LOCKED (102-UI-SPEC §Interaction):
 * heading → caveat (obligatorio, adyacente, NO colapsable) → figura → cobertura →
 * provenance. El caveat PRECEDE a la figura: un lector no puede ver el número sin el
 * caveat.
 *
 * ANTI-DW-NOMINATE (Color/Typography LOCKS 102-UI-SPEC :86-90):
 *  - La figura "Coinciden en N de M (X%)" va en `text-sm` weight-400 `--foreground`:
 *    NUNCA `font-semibold`, NUNCA `text-accent-product` (petróleo), NUNCA barra/gauge/
 *    meter/progress/dial. El ÚNICO `font-semibold` de la sección es el heading. Un
 *    número resaltado leería como "puntaje de afinidad" — precisamente lo prohibido.
 *  - NO reusa `RelacionesEjeComparar` ni `InterseccionCompartida` (petróleo-highlight).
 *
 * Estado degradado (m===0): SOLO heading + caveat + el copy degradado honesto en
 * `text-muted-foreground` — JAMÁS "0%", sin figura ni provenance. Un M=0 es un vacío
 * honesto declarado; un error de la RPC lo LANZA el server (#34), no llega aquí.
 *
 * FRONTERA mt-12 (§Spacing LOCKED): esta `<section className="mt-12">` es el ÚLTIMO
 * hermano de CompararEjes — el gap declara que "cómo votaron" es una categoría DISTINTA,
 * legalmente-gated y caveat-bound, no el 5º ítem de una lista factual.
 */
export function SimilitudVotacionComparar({
  n,
  m,
  pct,
  fechaConsulta,
  fechaCaptura,
  camaraMixta,
}: SimilitudVotacionCompararProps) {
  const cobertura = camaraMixta
    ? COBERTURA_BASE(fechaConsulta) + NOTA_ASIMETRIA
    : COBERTURA_BASE(fechaConsulta);

  // Estado degradado M=0: heading + caveat + copy honesto. JAMÁS "0%".
  if (m === 0) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-semibold">Similitud de votación</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {LEYENDA_SIMILITUD_VOTO}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Sin votaciones compartidas suficientes en las fuentes consultadas al{" "}
          {fechaConsulta}.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">Similitud de votación</h2>
      {/* Caveat OBLIGATORIO, adyacente y ANTES de la figura (no colapsable). */}
      <p className="mt-2 text-sm text-muted-foreground">
        {LEYENDA_SIMILITUD_VOTO}
      </p>
      {/* Figura NEUTRAL: text-sm weight-400 --foreground. Cero petróleo/bold/gauge. */}
      <p className="mt-4 text-sm">
        Coinciden en {n} de {m} votaciones compartidas ({pct}%).
      </p>
      {/* Cobertura declarada (con nota de asimetría si el par cruza cámaras). */}
      <p className="mt-2 text-sm text-muted-foreground">{cobertura}</p>
      {/* Provenance (fecha de captura de la fuente, mono). Omitida si la RPC no la trae. */}
      {fechaCaptura ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Fuente: votaciones de Cámara y Senado · captura al{" "}
          <span className="font-mono">{fechaCaptura}</span>.
        </p>
      ) : null}
    </section>
  );
}
