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

// Orquestación + persistencia (04-03).
export { correrPipeline } from "./pipeline";
export type { ResultadoPipeline, PipelineWriter } from "./pipeline";
export { RevisionWriter } from "./writer-revision";
export type {
  RevisionWriterOptions,
  CasoRevision,
  CasoRevisionRow,
  CandidatoResumen,
  FilaVinculo,
  FilaAudit,
} from "./writer-revision";

// Golden set + evaluador de regresión (gate de deploy, ID-07).
export { GOLDEN_SET, evaluarGolden } from "./golden/golden-set";
export type { CasoGolden, Esperado, MetricasGolden } from "./golden/golden-set";

// ── Adjudicación de TERCEROS (Phase 35, ENT-02/ENT-04) ──
export type { MencionEntidadForanea, DecisionCompuertaEntidad } from "./tipos-entidad";
export {
  AdjudicacionEntidadSchema,
  construirPromptEntidad,
  SYSTEM_ADJUDICACION_ENTIDAD,
} from "./prompt-entidad";
export type { AdjudicacionEntidad } from "./prompt-entidad";
export { aplicarCompuertaEntidad } from "./compuerta-entidad";
export { UMBRAL } from "./compuerta";
export { MockMiniMaxProviderEntidad } from "./mock-provider-entidad";
export type { RespuestaMockEntidad } from "./mock-provider-entidad";

// Orquestación + persistencia de terceros.
export { correrPipelineEntidad, generarCandidatosEntidad } from "./pipeline-entidad";
export type { ResultadoPipelineEntidad, PipelineEntidadWriter } from "./pipeline-entidad";
export { RevisionEntidadWriter, ONCONFLICT_VINCULO_ENTIDAD } from "./writer-revision-entidad";
export type {
  RevisionEntidadWriterOptions,
  CasoRevisionEntidad,
  CasoRevisionEntidadRow,
  CandidatoEntidadResumen,
  FilaVinculoEntidad,
  FilaAuditEntidad,
} from "./writer-revision-entidad";

// CLI revisor humano de terceros (gate humano LOCKED).
export {
  listar as listarEntidad,
  mostrar as mostrarEntidad,
  confirmar as confirmarRevisionEntidad,
  rechazar as rechazarRevisionEntidad,
  corregir as corregirRevisionEntidad,
} from "./revisor-entidad-cli";
