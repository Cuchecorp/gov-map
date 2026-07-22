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

// Parser de diputados (XML → bio con allowlist por construcción, SIN PII).
export {
  parseDiputadosBio,
  FechaInvalidaError,
  DIPUTADOS_BIO_URL,
  CORTE_VIGENCIA,
} from "./parse-diputados";
export type { DiputadoBio, MilitanciaBio } from "./parse-diputados";

// Parser de senadores (BCN SPARQL → militancia, enlace fail-closed por nombre) + fallback ficha.
export {
  parseBcnSenadores,
  enlazarSenadores,
  buildSparqlUrl,
  nombreMaestra,
  BCN_SPARQL_URL,
  BCN_UA,
  BCN_MILITANCY_QUERY,
} from "./parse-bcn-senadores";
export type {
  SenadorMilitancia,
  EnlaceSenadoresResult,
  SparqlResults,
} from "./parse-bcn-senadores";
export { parseSenadoFicha } from "./parse-senado-ficha";
export type { FichaSenadorBio } from "./parse-senado-ficha";

// Parser de comisiones (catálogo camara.cl + membresía fail-closed por DIPID).
export {
  parseComisionesCatalogo,
  parseIntegrantes,
  integrantesUrl,
  COMISIONES_CATALOGO_URL,
} from "./parse-comisiones";
export type { ComisionCatalogo, IntegranteComision } from "./parse-comisiones";

// Writer idempotente (interface + InMemory fake) + impl Supabase.
export {
  InMemoryBioWriter,
  comisionKey,
  militanciaKey,
  membresiaKey,
} from "./writer";
export type { BioWriter, PartidoUpdate } from "./writer";
export { SupabaseBioWriter } from "./writer-supabase";
export type { SupabaseBioWriterOptions } from "./writer-supabase";

// Orquestador dos-etapas fail-closed (fetch→R2→parse→match→write; --from-r2 replay).
export { runBio, conectorDeEnvelope } from "./run-bio";
export type { RunBioOpts, RunBioResult, BioEnvelope, BioConector } from "./run-bio";

// CLI (entry-point operador/agente): helpers reutilizables + conector real.
export {
  flagValue,
  flagValues,
  loadEnv,
  findWorkspaceRoot,
  cargarMaestra,
  buildBioConector,
} from "./run-bio-cli";
export type { Fuente } from "./run-bio-cli";
