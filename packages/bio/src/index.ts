// @obs/bio — conector de la bio oficial (dos-etapas R2 → parse+write) + membresía de
// comisiones. Espeja @obs/lobby casi archivo-por-archivo; reusa @obs/ingest en el ORDEN
// LOCKED y la guarda de identidad (EnlaceConfirmado). El modelo tipado ES el allowlist de
// minimización (Ley 21.719): los campos PII (fechaNacimiento/rut/sexo) NO se declaran →
// imposible persistirlos por construcción.
//
// Barril Task 1: esqueleto. La Task 2 aterriza el modelo + zod schemas (allowlist) y los
// re-exporta abajo. Los parsers/writer/runner de 90-02 se irán añadiendo.

// Modelo + zod schemas (allowlist por construcción — SIN campos PII).
export type {
  BioParlamentario,
  Militancia,
  Comision,
  ComisionMembresia,
} from "./model";
export {
  BioParlamentarioSchema,
  MilitanciaSchema,
  ComisionSchema,
  ComisionMembresiaSchema,
} from "./model";
