// @obs/dinero — conector REST de ChileCompra (api.mercadopublico.cl) + parser zod (LITERAL, sin
// LLM) + reconciliacion RUT-EXACTO del proveedor + writer idempotente + orquestacion de los
// contratos del Estado por RUT. Espeja @obs/probidad casi archivo-por-archivo, con dos diferencias
// load-bearing: la fuente es REST/JSON con ticket (no SPARQL), y el enlace contrato->parlamentario
// es RUT-only determinista (NUNCA por nombre; sin `@obs/adjudication`).

// Modelo + zod schemas.
export type {
  Contrato,
  Contratista,
  TipoPersona,
  BuscarProveedorResponse,
  OrdenesResponse,
  OrdenCompraRaw,
} from "./model";
export {
  ContratoSchema,
  ContratistaSchema,
  BuscarProveedorResponseSchema,
  OrdenesResponseSchema,
  OrdenCompraRawSchema,
  ORIGEN_DINERO,
  LICENCIA_DINERO,
} from "./model";

// Query builders REST + ventanas de fecha (puros).
export {
  urlBuscarProveedor,
  urlOrdenesDeCompra,
  ddmmaaaaDe,
  fechasEntre,
} from "./query";

// Parser zod del JSON de ChileCompra -> Contrato[] VERBATIM (LITERAL, sin LLM).
export { parseContratos, tipoPersona } from "./parse-chilecompra";
export type { ParseContratosOpts } from "./parse-chilecompra";

// Reconciliacion RUT-EXACTO del proveedor (sin correrPipeline; enlace solo por rama RUT).
export { reconciliarContrato } from "./reconciliar-contrato";
export type {
  ReconciliarContratoOpts,
  ContratoParaEscribir,
  ResultadoReconciliacionDinero,
  EstadoVinculoContrato,
} from "./reconciliar-contrato";

// Writer idempotente (interfaz + in-memory + Supabase).
export { InMemoryDineroWriter, versionKey } from "./writer";
export type { DineroWriter } from "./writer";
export { SupabaseDineroWriter } from "./writer-supabase";
export type { SupabaseDineroWriterOptions } from "./writer-supabase";

// Conector REST (reusa @obs/ingest en el ORDEN LOCKED, NO BaseConnector.run).
export {
  ChileCompraConnector,
  RobotsDisallowError,
  ChileCompraBloqueadaError,
  HEADERS_CHILECOMPRA,
} from "./connector-chilecompra";
export type { ChileCompraConnectorDeps } from "./connector-chilecompra";

// Orquestacion (drift -> cuarentena + degradacion honesta + nunca fabrica + serial por RUT).
export { runIngestDinero } from "./ingest-run";
export type {
  RunIngestDineroOpts,
  RunIngestDineroResult,
  DegradacionDinero,
  TareaRut,
} from "./ingest-run";

// CLI de ingesta (corrida LIVE acotada / degrada a dry-run sin ticket o key).
export {
  parseArgs as parseDineroArgs,
  main as ingestDineroMain,
  DineroCliArgsError,
} from "./ingest-cli";
export type { DineroCliOptions, DineroCliResult } from "./ingest-cli";
