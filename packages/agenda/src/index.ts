// @obs/agenda — subsistema de Agenda legislativa: citaciones de comisiones
// (Cámara + Senado) y tabla semanal de sala (orden del día del Senado).
//
// La LLAVE DE CRUCE hacia la ficha de proyecto (Fase 5) es el número de boletín
// (`CitacionPunto.boletin` / `SesionTablaItem.boletin` → `proyecto.boletin`).
//
// Barrel ola 1: el modelo común + zod schemas se cablean en Task 2 (TDD). Las olas
// 2-4 añaden los parsers (parseCamaraCitaciones / parseSenadoCitaciones /
// parseSenadoTabla), los conectores (reusan @obs/ingest, NO BaseConnector.run),
// el writer idempotente y la orquestación de ingesta.
export {};
