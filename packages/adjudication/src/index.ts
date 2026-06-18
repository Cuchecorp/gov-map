/**
 * API pública de @obs/adjudication — barrel del subsistema de identidad asistida.
 *
 * El CORAZÓN puro y testeable del riesgo existencial #1: generación de candidatos
 * por blocking (ID-03), schema zod + prompt del adjudicador (ID-03) y la compuerta
 * fail-closed con umbral 0.90 asimétrico (ID-04) que auto-acepta a lo más a
 * `probable` (ID-06 / A4).
 *
 * Re-exporta los módulos puros del subsistema: tipos, blocking de candidatos,
 * schema/prompt del adjudicador, la compuerta fail-closed y el mock de provider
 * (para tests downstream sin red).
 */
export type { MencionForanea, DecisionCompuerta } from "./tipos";
export { generarCandidatos } from "./candidatos";
export {
  AdjudicacionSchema,
  construirPromptAdjudicacion,
  SYSTEM_ADJUDICACION,
} from "./prompt";
export type { Adjudicacion } from "./prompt";
export { aplicarCompuerta } from "./compuerta";
export { MockMiniMaxProvider } from "./mock-provider";
export type { RespuestaMock } from "./mock-provider";
