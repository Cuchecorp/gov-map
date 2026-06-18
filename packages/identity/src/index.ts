// @obs/identity — subsistema de identidad de parlamentarios (lógica pura).
// Matcher determinista fail-closed (Etapa 0, ID-02) — único escritor de `estado`.
export { matchDeterminista, normRut } from "./deterministic";
export type { Mention, Resolution } from "./deterministic";

// Parsers de catálogo (XML real → modelo Parlamentario).
export { parseSenado, SENADO_URL, SENADO_PERIODO } from "./parse-senado";
export {
  parseCamara,
  partidoVigente,
  CAMARA_URL,
  CAMARA_PERIODO,
  CORTE_VIGENCIA,
} from "./parse-camara";
export type { MilitanciaRaw } from "./parse-camara";

// Seeder idempotente (fetch reusa @obs/ingest → parse → match → upsert).
export { runSeeder, upsertMaestra, RobotsDisallowError } from "./seeder";
export type { SeederDeps, MaestraWriter } from "./seeder";

// Re-exporta los tipos de dominio de identidad desde @obs/core por conveniencia.
export type {
  Parlamentario,
  ParlamentarioSeed,
  EstadoIdentidad,
  Camara,
} from "@obs/core";
export { ParlamentarioSeedSchema } from "@obs/core";
