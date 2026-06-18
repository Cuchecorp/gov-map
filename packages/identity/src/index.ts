// @obs/identity — subsistema de identidad de parlamentarios (lógica pura).
// El matcher determinista fail-closed (matchDeterminista) se añade en Task 3.
// Re-exporta los tipos de dominio de identidad desde @obs/core por conveniencia.
export type {
  Parlamentario,
  ParlamentarioSeed,
  EstadoIdentidad,
  Camara,
} from "@obs/core";
export { ParlamentarioSeedSchema } from "@obs/core";
