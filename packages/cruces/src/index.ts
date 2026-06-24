// @obs/cruces — núcleo de clasificación parlamentario↔sector (CRUCE-02).
//
// Barrel: la taxonomía (fuente única) + el contrato zod de la clasificación.
// Las piezas de clasificación (prompts split + clasificador con gate de PII) se añaden en
// Task 2; los CLIs y el golden viven en Plan 03.
export {
  SECTOR_CATALOGO,
  SECTOR_CODIGOS,
  type SectorCodigo,
} from "./sector";

export {
  ClasificacionSectorSchema,
  type ClasificacionSector,
} from "./model";

// ── Prompts split: proyecto público (ficha) / contraparte sensible (lobby) ──
export {
  SYSTEM_CLASIFICACION_FICHA,
  construirPromptFicha,
} from "./prompt";
export {
  SYSTEM_CLASIFICACION_CONTRAPARTE,
  construirPromptContraparte,
} from "./prompt-lobby";

// ── Servicio clasificador (gate de PII first en la ruta de contraparte) ──
export {
  clasificarFicha,
  clasificarContraparte,
  type ClasificarFichaInput,
  type ClasificarContraparteInput,
} from "./clasificar";

// ── Mock de provider para tests/golden (sin red) ──
export {
  MockClasificadorProvider,
  type RespuestaMockSector,
} from "./mock-provider";
