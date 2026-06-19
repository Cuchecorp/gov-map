// @obs/lobby — conector + parser + reconciliación del sujeto pasivo + writer idempotente +
// orquestación de las audiencias de la Ley del Lobby (leylobby.gob.cl). Espeja @obs/agenda
// casi archivo-por-archivo; reusa @obs/ingest en el ORDEN LOCKED y la guarda de identidad de
// Phase 9 (EnlaceConfirmado). El único código nuevo es el parser cheerio de UNA forma HTML, la
// reconciliación del sujeto pasivo y el writer.
//
// Barril Task 1: modelo + parser. Las Tasks 2-3 añaden la reconciliación, el writer y la
// orquestación (se re-exportan abajo a medida que aterrizan).

// Modelo + zod schemas.
export type {
  LobbyAudiencia,
  LobbyAsistente,
  LobbyContraparte,
} from "./model";
export {
  LobbyAudienciaSchema,
  LobbyAsistenteSchema,
  LobbyContraparteSchema,
  ROL_SUJETO_PASIVO,
} from "./model";

// Parser cheerio del HTML de audiencias.
export {
  parseLobbyAudiencias,
  parseListadoRowIds,
  parseFechaLeylobby,
  institucionDeIdentificador,
} from "./parse-leylobby";

// Reconciliación del sujeto pasivo (correrPipeline → EnlaceConfirmado solo-determinista).
export { reconciliarSujeto } from "./reconciliar-sujeto";
export type {
  ReconciliarSujetoOpts,
  AudienciaParaEscribir,
  ContraparteParaEscribir,
  ResultadoReconciliacion,
} from "./reconciliar-sujeto";

// Writer idempotente (interfaz + in-memory + Supabase).
export { InMemoryLobbyWriter, contraparteKey } from "./writer";
export type { LobbyWriter } from "./writer";
export { SupabaseLobbyWriter } from "./writer-supabase";
export type { SupabaseLobbyWriterOptions } from "./writer-supabase";

// Conector (reusa @obs/ingest en el ORDEN LOCKED, NO BaseConnector.run).
export {
  LeylobbyConnector,
  RobotsDisallowError,
  LeylobbyBloqueadaError,
  BROWSER_HEADERS_LEYLOBBY,
} from "./connector-leylobby";
export type { LeylobbyConnectorDeps } from "./connector-leylobby";

// Orquestación (drift BLOQUEANTE + degradación honesta + nunca fabrica).
export { runIngestLobby, formaDe } from "./ingest-run";
export type {
  RunIngestLobbyOpts,
  RunIngestLobbyResult,
  DegradacionLobby,
  TareaInstitucion,
} from "./ingest-run";

// CLI de ingesta (corrida LIVE acotada / degrada a fixture sin key/alcance).
export {
  parseArgs as parseLobbyArgs,
  main as ingestLobbyMain,
  LobbyCliArgsError,
} from "./ingest-cli";
export type { LobbyCliOptions, LobbyCliResult } from "./ingest-cli";
