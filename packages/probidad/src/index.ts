// @obs/probidad — conector SPARQL + parser zod (LITERAL, sin LLM) + reconciliación name-only del
// declarante + writer VERSIONADO + orquestación de las declaraciones de patrimonio e intereses de
// InfoProbidad (datos.cplt.cl, CC BY 4.0). Espeja @obs/lobby casi archivo-por-archivo; reusa
// @obs/ingest en el ORDEN LOCKED y la guarda de identidad de Phase 9 (EnlaceConfirmado). El único
// código nuevo es los query builders SPARQL, el parser JSON→rows versionado, la reconciliación del
// declarante (name-only) y el writer versionado por (fuente_id, fecha_presentacion).
//
// Barril Task 1: modelo + sparql + parser. Las Tasks 2-3 añaden la reconciliación, el writer y la
// orquestación (re-exportados abajo a medida que aterrizan).

// Modelo + zod schemas.
export type {
  Declaracion,
  DeclaracionFamiliar,
  Bienes,
  BienInmueble,
  BienMueble,
  Actividad,
  Pasivo,
  AccionDerecho,
  Valor,
} from "./model";
export {
  DeclaracionSchema,
  DeclaracionFamiliarSchema,
  BienesSchema,
  BienInmuebleSchema,
  BienMuebleSchema,
  ActividadSchema,
  PasivoSchema,
  AccionDerechoSchema,
  ValorSchema,
  ORIGEN_PROBIDAD,
  LICENCIA_PROBIDAD,
} from "./model";

// Query builders SPARQL + mapeo SPARQL-JSON → filas (puros).
export {
  queryDeclaracionesPorNombre,
  queryBienesInmuebles,
  queryActividades,
  escaparLiteralSparql,
  bindingsToRows,
  fechaPresentacionDe,
} from "./sparql";
export type { FilaSparql, SparqlJson } from "./sparql";

// Parser zod del SPARQL-JSON → Declaracion[] versionadas (LITERAL, sin LLM).
export { parseDeclaraciones } from "./parse-infoprobidad";
export type { ParseDeclaracionesOpts } from "./parse-infoprobidad";

// Reconciliación NAME-ONLY del declarante (correrPipeline → EnlaceConfirmado solo-determinista).
export { reconciliarDeclarante } from "./reconciliar-declarante";
export type {
  ReconciliarDeclaranteOpts,
  DeclaracionParaEscribir,
  ResultadoReconciliacionProbidad,
} from "./reconciliar-declarante";

// Writer VERSIONADO (interfaz + in-memory + Supabase).
export { InMemoryProbidadWriter, versionKey } from "./writer";
export type { ProbidadWriter } from "./writer";
export { SupabaseProbidadWriter } from "./writer-supabase";
export type { SupabaseProbidadWriterOptions } from "./writer-supabase";

// Conector SPARQL (reusa @obs/ingest en el ORDEN LOCKED, NO BaseConnector.run).
export {
  InfoProbidadConnector,
  RobotsDisallowError,
  InfoProbidadBloqueadaError,
  SPARQL_HEADERS_INFOPROBIDAD,
} from "./connector-infoprobidad";
export type { InfoProbidadConnectorDeps } from "./connector-infoprobidad";

// Orquestación (drift BLOQUEANTE + degradación honesta + nunca fabrica + versionado).
export { runIngestProbidad, formaDe } from "./ingest-run";
export type {
  RunIngestProbidadOpts,
  RunIngestProbidadResult,
  DegradacionProbidad,
  TareaDeclarante,
} from "./ingest-run";

// CLI de ingesta (corrida LIVE acotada / degrada a dry-run sin key/alcance).
export {
  parseArgs as parseProbidadArgs,
  main as ingestProbidadMain,
  ProbidadCliArgsError,
} from "./ingest-cli";
export type { ProbidadCliOptions, ProbidadCliResult } from "./ingest-cli";
