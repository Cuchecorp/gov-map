// @obs/agenda — subsistema de Agenda legislativa: citaciones de comisiones
// (Cámara + Senado) y tabla semanal de sala (orden del día del Senado).
//
// La LLAVE DE CRUCE hacia la ficha de proyecto (Fase 5) es el número de boletín
// (`CitacionPunto.boletin` / `SesionTablaItem.boletin` → `proyecto.boletin`).
//
// Barrel ola 1: el modelo común + zod schemas. Las olas 2-4 añaden los parsers
// (parseCamaraCitaciones / parseSenadoCitaciones / parseSenadoTabla), los conectores
// (reusan @obs/ingest, NO BaseConnector.run), el writer idempotente y la
// orquestación de ingesta.
export type {
  Camara,
  CitacionEstado,
  Citacion,
  CitacionInvitado,
  CitacionPunto,
  SesionSala,
  SesionTablaItem,
} from "./model";
export {
  CitacionSchema,
  CitacionInvitadoSchema,
  CitacionPuntoSchema,
  SesionSalaSchema,
  SesionTablaItemSchema,
} from "./model";

// Helper de semana ISO-8601 (enumeración de la cobertura completa de Cámara).
export type { SemanaIso } from "./semana-iso";
export {
  isoWeekOf,
  semanaIsoKey,
  semanasEnAnioIso,
  prmSemanaParam,
  enumerarSemanas,
} from "./semana-iso";

// Parser de citaciones de Cámara (cheerio sobre el HTML real).
export { parseCamaraCitaciones, parseFechaEsCl } from "./parse-camara-citaciones";

// Parsers JSON del Senado (citaciones + tabla semanal de sala).
export { parseSenadoCitaciones, parseFechaDmy } from "./parse-senado-citaciones";
export { parseSenadoTabla } from "./parse-senado-tabla";

// Header-set anti-Cloudflare de Cámara.
export { BROWSER_HEADERS_CAMARA } from "./headers-camara";

// Transporte `curl` anti-Cloudflare para Cámara (WR-03) — se inyecta como `fetchFn`.
export { createCurlTransport, CurlUnavailableError } from "./transport-curl";
export type { CurlTransportOptions } from "./transport-curl";

// Conectores (reusan @obs/ingest en el ORDEN LOCKED, NO BaseConnector.run).
export {
  CitacionesCamaraConnector,
  RobotsDisallowError,
  CamaraBloqueadaError,
  CAMARA_TABLA_PDF_URL,
} from "./connector-camara";
export type { CitacionesCamaraConnectorDeps } from "./connector-camara";
export { SenadoActividadConnector } from "./connector-senado";
export type { SenadoActividadConnectorDeps } from "./connector-senado";

// Writer idempotente (interfaz inyectable + in-memory + Supabase).
export {
  InMemoryAgendaWriter,
  invitadoKey,
  puntoKey,
  itemKey,
} from "./writer";
export type { AgendaWriter } from "./writer";
export { SupabaseAgendaWriter } from "./writer-supabase";
export type { SupabaseAgendaWriterOptions } from "./writer-supabase";

// Orquestación de la ingesta (tolerante a fuentes vacías + degradación honesta).
export { runIngest } from "./ingest-run";
export type { RunIngestOpts, RunIngestResult, Degradacion } from "./ingest-run";

// CLI de ingesta (flags validados antes de red/DB; backfill por rango de semanas).
export {
  parseArgs,
  parseSemanaIso,
  main as ingestMain,
  IngestCliArgsError,
} from "./ingest-cli";
export type { IngestCliOptions, IngestCliResult } from "./ingest-cli";
