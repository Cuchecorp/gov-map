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
  parseFechaLeylobby,
  institucionDeIdentificador,
} from "./parse-leylobby";
