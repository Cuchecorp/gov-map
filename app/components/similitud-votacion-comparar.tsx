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
