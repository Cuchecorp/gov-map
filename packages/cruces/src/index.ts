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
