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
  redactarTicket,
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

// ── SERVEL (conector de financiamiento de campana; enlace del candidato por NOMBRE via pipeline) ──

// Modelo + zod schemas SERVEL (Aporte/Donante VERBATIM; licencia "terminos por verificar").
export type { Aporte, Donante, AporteSheet, TipoPersonaDonante } from "./model-servel";
export {
  AporteSchema,
  DonanteSchema,
  AporteSheetSchema,
  ORIGEN_SERVEL,
  LICENCIA_SERVEL,
  fuenteIdDe,
  donanteIdDe,
} from "./model-servel";

// Parser xlsx VERBATIM (gate de header-text que THROW en drift; sin LLM).
export { parseAportes, EXPECTED_HEADERS, HEADER_ROW } from "./parse-servel";
export type { ParseAportesOpts } from "./parse-servel";

// Reconciliacion de completitud RUN-LEVEL (Content-MD5 + byte-length + TOTAL -> cuarentena).
export { reconciliarCompletitud } from "./reconciliar-completitud";
export type {
  ControlTotal,
  BytesRecibidos,
  ResultadoCompletitud,
} from "./reconciliar-completitud";

// Enlace del candidato por NOMBRE via correrPipeline (SOLO determinista puebla; donante jamas al LLM).
export { reconciliarAporte } from "./reconciliar-aporte";
export type {
  ReconciliarAporteOpts,
  AporteParaEscribir,
  ResultadoReconciliacionAporte,
} from "./reconciliar-aporte";

// Conector del .xlsx de SERVEL (host EXACTO via extraHosts + https forzado).
export {
  ServelConnector,
  ServelBloqueadaError,
  RobotsDisallowError as RobotsDisallowErrorServel,
  HEADERS_SERVEL,
  SERVEL_HOST,
} from "./connector-servel";
export type {
  ServelConnectorDeps,
  DescargaServel,
  AnclasDescarga,
  HeadFn,
} from "./connector-servel";

// Helper de Supabase Storage para el crudo (clave versionada idempotente).
export {
  SupabaseStorageServel,
  DEFAULT_BUCKET_SERVEL,
  claveCrudo,
  sha256Hex,
} from "./storage-supabase";
export type { SupabaseStorageOptions } from "./storage-supabase";

// Writer SERVEL idempotente (interfaz + in-memory + Supabase).
export { InMemoryServelWriter, versionKeyServel } from "./writer-servel";
export type { ServelWriter } from "./writer-servel";
export { SupabaseServelWriter } from "./writer-supabase-servel";
export type { SupabaseServelWriterOptions } from "./writer-supabase-servel";

// Orquestacion SERVEL (drift BLOQUEANTE run-level: cualquier mismatch -> cuarentena, 0 filas).
export { runIngestServel } from "./ingest-run-servel";
export type {
  RunIngestServelOpts,
  RunIngestServelResult,
  TareaEleccion,
  DegradacionDinero as DegradacionServel,
  SubirCrudoFn,
} from "./ingest-run-servel";

// CLI de ingesta SERVEL (corrida LIVE acotada / degrada a dry-run sin key).
export {
  parseArgs as parseServelArgs,
  main as ingestServelMain,
  ServelCliArgsError,
} from "./ingest-cli-servel";
export type { ServelCliOptions, ServelCliResult } from "./ingest-cli-servel";
