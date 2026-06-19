// @obs/votos — barrel de PRODUCCIÓN: el runner Cámara-only que enriquece voto/votacion (VOTE-02).
//
// El spike (`spike/spike.ts`) queda OBSOLETO; la producción vive en `src/run-camara-votos.ts`.
export {
  runCamaraVotos,
  buildCamaraConnector,
  buildSenadoConnector,
  RunCamaraVotosArgsError,
  LEGISLATURA_VIGENTE,
  type RunCamaraVotosOpts,
  type RunCamaraVotosResult,
} from "./run-camara-votos";
