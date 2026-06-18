/**
 * API pública de @obs/adjudication — barrel del subsistema de identidad asistida.
 *
 * El CORAZÓN puro y testeable del riesgo existencial #1: generación de candidatos
 * por blocking (ID-03), schema zod + prompt del adjudicador (ID-03) y la compuerta
 * fail-closed con umbral 0.90 asimétrico (ID-04) que auto-acepta a lo más a
 * `probable` (ID-06 / A4).
 *
 * Los módulos puros (candidatos, prompt, compuerta) se agregan en las tasks
 * siguientes; este barrel re-exporta lo que existe a medida que aparece.
 */
export type { MencionForanea, DecisionCompuerta } from "./tipos";
