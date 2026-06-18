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
