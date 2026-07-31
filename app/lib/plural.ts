/**
 * plural — concordancia de número para los moldes del panel (es-CL).
 *
 * Phase 129 / D-06. Regla única: el singular se usa si y SOLO si `n === 1`;
 * cualquier otro valor (incluido el 0, que en español es plural) toma la forma
 * plural.
 *
 * DELIBERADAMENTE sin heurística morfológica: ambas formas se pasan explícitas
 * porque `citación → citaciones` y `abstención → abstenciones` pierden la tilde
 * al pluralizar, y ninguna regla de sufijo genérica acierta ese caso. Un helper
 * que "adivine" el plural fabricaría copy incorrecto en producción.
 *
 * NO es un stem de `idioms-panel.ts`: los sustantivos contados no son fórmulas
 * de fecha ni de procedencia, y este helper no participa del guard de idiomas.
 */
export function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}
