// @obs/identity — subsistema de identidad de parlamentarios (lógica pura).
// Matcher determinista fail-closed (Etapa 0, ID-02) — único escritor de `estado`.
export { matchDeterminista, normRut } from "./deterministic";
export type { Mention, Resolution } from "./deterministic";

// Re-exporta los tipos de dominio de identidad desde @obs/core por conveniencia.
export type {
  Parlamentario,
  ParlamentarioSeed,
  EstadoIdentidad,
  Camara,
} from "@obs/core";
export { ParlamentarioSeedSchema } from "@obs/core";
