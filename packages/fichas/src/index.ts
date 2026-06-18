// @obs/fichas — subsistema de Fichas Estructuradas + Búsqueda Semántica de la Fase 7.
//
// Barrel ola 1: los CONTRATOS que las olas 2-3 consumen —
//   - FichaSchema/CuerpoLegalSchema (contrato de salida del LLM, SEM-02)
//   - SYSTEM_EXTRACCION/construirPromptExtraccion (prompt restrictivo literal)
//   - extraer (extracción vía DeepSeek + compuerta zod) + su mock
//   - el golden set + su gate de CI BLOQUEANTE (flag P7 de STATE)
//
// Las olas 2-3 añaden: correrPipeline (extraer→embed→persistir), buscarProyectos
// (RPC match_proyectos) y los componentes de UI. El slice.e2e.test.ts importa esos
// símbolos aún ausentes → RED hasta que las olas 2-3 los implementen.
export {
  FichaSchema,
  CuerpoLegalSchema,
  type Ficha,
  type CuerpoLegal,
} from "./model";

export { SYSTEM_EXTRACCION, construirPromptExtraccion } from "./prompt";

// ── Ola 1: extracción literal vía provider + compuerta zod (SEM-02) ───────────
export { extraer } from "./extraer";
export { MockDeepSeekProvider, type RespuestaMockFicha } from "./mock-provider";

// ── Ola 1: golden set + gate de CI bloqueante (flag P7) ───────────────────────
export {
  type CasoGolden,
  type Esperado,
  GOLDEN_SET,
  GOLDEN_SET_GATE,
  GOLDEN_SET_ADVERSARIO,
  IDS_CASOS_ADVERSARIOS,
  ID_CASO_ADVERSARIO,
  evaluarGolden,
  type MetricasGolden,
} from "./golden/golden-set";
