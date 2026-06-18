// @obs/tramitacion — subsistema de Tramitación: modelo común Proyecto/Votacion/Voto/
// TramitacionEvento (boletín = llave de cruce), parsers de Cámara/Senado, fusión de
// timeline y writer idempotente.
//
// Barrel ola 1: el modelo común + zod schemas. Las olas 2-4 añaden parsers
// (parse-camara-votacion / parse-senado-*), timeline (fusionarTimeline),
// reconciliación (reconciliarVotosSenado) y el writer Supabase.
export type {
  Iniciativa,
  Camara,
  Seleccion,
  MetodoVinculo,
  EstadoVinculo,
  TipoEvento,
  Proyecto,
  Votacion,
  Voto,
  TramitacionEvento,
} from "./model";
export {
  ProyectoSchema,
  VotacionSchema,
  VotoSchema,
  TramitacionEventoSchema,
} from "./model";

// ── Ola 2: parseo de fechas + parsers de Cámara ──────────────────────────────
export { parseFechaCL, toIso } from "./fecha";
export {
  parseCamaraVotacion,
  parseCamaraVotoDetalle,
  type CamaraVotoDetalle,
} from "./parse-camara-votacion";
export { parseCamaraSesion, type SesionCamara } from "./parse-camara-sesion";
export { parseSenadoTramitacion } from "./parse-senado-tramitacion";
export {
  parseSenadoVotacion,
  parseSenadoVotaciones,
  type VotoSenadoCrudo,
  type VotacionSenado,
} from "./parse-senado-votacion";

// ── Ola 2: fusión cronológica del timeline ───────────────────────────────────
export { fusionarTimeline, eventoDesdeVotacion } from "./timeline";

// ── Ola 3: reconciliación del voto-a-voto contra la maestra ───────────────────
// Cámara: cruce DETERMINISTA por Diputado/Id (sin LLM, sin riesgo de identidad).
export { reconciliarVotosCamara } from "./reconciliar-camara";
// Senado: cruce por NOMBRE vía correrPipeline (Fase 4); guarda LOCKED — solo
// determinista/confirmado puebla parlamentario_id (T-05-06).
export {
  reconciliarVotosSenado,
  type ReconciliarSenadoOpts,
} from "./reconciliar-senado";

// ── Ola 4: conectores (reusan @obs/ingest, NO BaseConnector.run) ──────────────
export {
  CamaraConnector,
  RobotsDisallowError,
  type CamaraConnectorDeps,
} from "./connector-camara";
export { SenadoConnector, type SenadoConnectorDeps } from "./connector-senado";

// ── Ola 4: writer idempotente por clave natural ───────────────────────────────
export {
  type TramitacionWriter,
  InMemoryTramitacionWriter,
} from "./writer";
export {
  SupabaseTramitacionWriter,
  type SupabaseTramitacionWriterOptions,
} from "./writer-supabase";

// ── Ola 4: orquestación de la corrida acotada + CLI de ingesta ────────────────
export {
  runIngest,
  type RunIngestOpts,
  type RunIngestResult,
} from "./ingest-run";
export {
  main as runIngestCli,
  parseArgs,
  cargarMaestra,
  findWorkspaceRoot,
  IngestCliArgsError,
  type IngestCliOptions,
  type IngestCliResult,
} from "./ingest-cli";
