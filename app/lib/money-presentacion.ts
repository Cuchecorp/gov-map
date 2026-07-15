/**
 * Presentación anti-insinuación de las superficies MONEY — ÚNICA fuente de verdad
 * (MONEY-04, 73-UI-SPEC §Leyenda / §Copywriting Contract).
 *
 * Espejo del patrón `LEYENDA_ANTI_INSINUACION` de `voto-presentacion.ts` (Phase 68):
 * la leyenda vive UNA sola vez aquí, byte-idéntica, y la consumen TODAS las superficies
 * de dinero:
 *   - ficha del parlamentario: `contratos-de-parlamentario.tsx` (ChileCompra, RUT-exacto)
 *     y `financiamiento-de-parlamentario.tsx` (SERVEL, nombre confirmado);
 *   - página `/contraparte`: `contratos-por-contraparte.tsx` y `aportes-por-contraparte.tsx`.
 * NO duplicar el string en ningún componente — importar desde aquí (el plan 02 la renderiza
 * como primer hijo de cada superficie, encima del `Intro()`).
 *
 * OJO (guard/linter): este string NIEGA "influencia"/"intención"/"irregularidad"
 * ("no es una afirmación de irregularidad", "No medimos influencia ni intención…"). El
 * `anti-insinuacion-guard.test.ts` lo RESTA (NEGACIONES_LOCKED) antes de matchear, para
 * que la leyenda que enfuerza la regla no se auto-caze (plan 03). Si se edita el copy aquí,
 * debe editarse verbatim en NEGACIONES_LOCKED del guard también.
 *
 * Es TEXTO renderizable en cliente: sin `import "server-only"` (a diferencia de
 * `money-gate.ts`, que sí es server-only). Sin efectos secundarios; sólo la constante.
 */
export const LEYENDA_ANTI_INSINUACION_MONEY =
  "Un contrato o un aporte registrado es un hecho público observable. Un vínculo por RUT es una coincidencia exacta de identificador, no una afirmación de irregularidad. No medimos influencia ni intención, ni afirmamos que un aporte compre una decisión.";
