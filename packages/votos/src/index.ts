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

// ── VOTO-03: golden set DIPID→id_maestra derivado del seed + gate fail-closed (Phase 65) ──
export {
  derivarGoldenDipid,
  validarGoldenDipid,
  PERIODO_VIGENTE,
  N_MIN,
  N_MAX,
  type GoldenDipidRow,
} from "./golden-dipid";
