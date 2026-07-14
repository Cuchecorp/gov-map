// @obs/identity — subsistema de identidad de parlamentarios (lógica pura).
// Matcher determinista fail-closed (Etapa 0, ID-02) — único escritor de `estado`.
export { matchDeterminista, normRut, isRutValido } from "./deterministic";
export type { Mention, Resolution, MaestraRow } from "./deterministic";

// Invariante tipado del enlace confirmado (IDENT-12): factory única `confirmar` +
// tipo branded `EnlaceConfirmado`. El `unique symbol` NO se exporta (Pitfall 2).
export { confirmar } from "./enlace-confirmado";
export type { EnlaceConfirmado } from "./enlace-confirmado";

// Matcher determinista de TERCEROS (ENT-02): fail-closed + Δ1 tipo_entidad + Δ2 jurídica-solo-RUT.
export { matchDeterministaEntidad } from "./deterministic-entidad";
export type {
  MentionEntidad,
  ResolutionEntidad,
  EntidadTerceroRow,
  TipoEntidad,
} from "./deterministic-entidad";

// Invariante tipado del enlace confirmado de TERCEROS (ENT-03): factory única `confirmarEntidad`
// + tipo branded `EnlaceEntidadConfirmado`. El `unique symbol` propio NO se exporta (grep-gate).
export { confirmarEntidad } from "./enlace-entidad-confirmado";
export type { EnlaceEntidadConfirmado } from "./enlace-entidad-confirmado";

// Seeder idempotente de TERCEROS (ENT-05): upsert por clave natural; NUNCA auto-confirma.
export { upsertEntidades, prepararSeed } from "./seeder-entidad";
export type { EntidadTerceroWriter, EntidadTerceroSeed } from "./seeder-entidad";

// Writer REAL de terceros contra Supabase (impl del EntidadTerceroWriter inyectable).
export { SupabaseEntidadWriter } from "./writer-entidad-supabase";
export type { SupabaseEntidadWriterOptions } from "./writer-entidad-supabase";

// Custodia JSON determinista de la maestra de terceros (ENT-05): export byte-a-byte a
// supabase/seeds/entidad_tercero.seed.json. SEED_PATH/SeedFileWriter de terceros se exponen
// como `SEED_PATH_ENTIDAD`/`SeedFileWriterEntidad` para no chocar con los de parlamentario.
export {
  exportMaestraEntidad,
  serializeMaestraEntidad,
  SEED_PATH as SEED_PATH_ENTIDAD,
} from "./backup-entidad";
export type {
  EntidadTercero,
  ExportEntidadOptions,
  ExportEntidadResult,
} from "./backup-entidad";

// Backfill LOCAL idempotente/reanudable (ENT-05): matcher → seeder → custodia.
export { runBackfillEntidad, buildWriterFromEnv, loadEnv as loadEnvEntidad } from "./backfill-entidad-cli";
export type { BackfillEntidadOptions, BackfillEntidadResult } from "./backfill-entidad-cli";

// Invariante TIPADO del RUT escribible (RUT-01, CR-01): factory única `corroborarRutFila`
// + tipo branded `FilaRutCorroborada`. El `unique symbol` NO se exporta (Pitfall 2): el
// ÚNICO camino a un RUT escribible es el DV-gate → el compilador rechaza un RUT name-only.
export { corroborarRutFila } from "./rut-corroborado";
export type {
  FilaRutCandidata,
  FilaRutCorroborada,
  RazonRechazoRut,
  ResultadoCorroboracion,
} from "./rut-corroborado";

// Backfill del RUT interno (IDENT-10): DV-gate (isRutValido) + provenance + updateRut.
// NUNCA fabrica un RUT — un DV inválido o sin provenance se rechaza a revisión.
export { aceptarRutBackfill, runBackfillRut } from "./backfill-rut";
export type {
  FilaRutCruda,
  FilaRutEscribir,
  FilaRechazada,
  RazonRechazo,
  ResultadoAceptacion,
  ResultadoBackfill,
  RutBackfillWriter,
} from "./backfill-rut";

// Parsers de catálogo (XML real → modelo Parlamentario).
export { parseSenado, SENADO_URL, SENADO_PERIODO } from "./parse-senado";
export {
  parseCamara,
  partidoVigente,
  FechaInvalidaError,
  CAMARA_URL,
  CAMARA_PERIODO,
  CORTE_VIGENCIA,
} from "./parse-camara";
export type { MilitanciaRaw } from "./parse-camara";

// Seeder idempotente (fetch reusa @obs/ingest → parse → match → upsert).
export {
  runSeeder,
  upsertMaestra,
  reconciliarMaestra,
  vigentesDeCatalogo,
  conClaveEstricta,
  derivarClaveEstricta,
  RobotsDisallowError,
} from "./seeder";
export type { SeederDeps, MaestraWriter } from "./seeder";

// Backup: exportMaestra → snapshot JSON git (ID-09) + R2 gateado.
export { exportMaestra, serializeMaestra, SEED_PATH } from "./backup";
export type {
  SeedFileWriter,
  R2BackupTarget,
  ExportOptions,
  ExportResult,
} from "./backup";

// Writers REALES (impls de los inyectables de Plan 03) + CLI de siembra LIVE (Plan 04).
export { SupabaseMaestraWriter } from "./writer-supabase";
export type { SupabaseMaestraWriterOptions } from "./writer-supabase";
export { FsSeedFileWriter } from "./writer-fs";
export type { FsSeedFileWriterOptions } from "./writer-fs";
export { main as runSeedCli } from "./seed-cli";
export type { SeedCliOptions, SeedCliResult } from "./seed-cli";

// Re-exporta los tipos de dominio de identidad desde @obs/core por conveniencia.
export type {
  Parlamentario,
  ParlamentarioSeed,
  EstadoIdentidad,
  Camara,
} from "@obs/core";
export { ParlamentarioSeedSchema } from "@obs/core";
