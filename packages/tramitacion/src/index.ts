// @obs/tramitacion — subsistema de Tramitación: modelo común Proyecto/Votacion/Voto/
// TramitacionEvento (boletín = llave de cruce), parsers de Cámara/Senado, fusión de
// timeline y writer idempotente.
//
// Barrel inicial (ola 1): vacío por ahora. La Task 2 añade el modelo común + zod
// schemas; las olas 2-4 añaden parsers (parse-camara-votacion / parse-senado-*),
// timeline (fusionarTimeline), reconciliación (reconciliarVotosSenado) y el writer.
export {};
