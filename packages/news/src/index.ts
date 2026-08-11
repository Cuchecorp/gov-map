// @obs/news — subsistema de NOTICIAS: ingesta de RSS de prensa en DOS ETAPAS
// (Etapa 1 fuentes→R2 vía NewsConnector/BaseConnector, Etapa 2 R2→Supabase vía cargar()),
// con dedup por URL canónica, pre-filtro léxico legislativo, y CLI local que ata ambas etapas
// (132-06, reemplaza el placeholder de scaffolding de 132-01 T1).

// ── Ola 1: feeds congelados + allowlist scoped (132-01) ──────────────────────────────────────
export { FEEDS, NEWS_HOSTS, type FeedDef } from "./feeds";
export { allowlistNews, assertFeedUrl } from "./allowlist-news";

// ── Ola 2: NewsConnector Etapa 1 + fábrica de deps (132-03) ───────────────────────────────────
export {
  NewsConnector,
  buildNewsDeps,
  NewsCacheRequeridaError,
  type RssRaw,
  type BuildNewsDepsOptions,
} from "./connector-news";
export { SupabaseSnapshotLookup, type SupabaseSnapshotLookupOptions } from "./snapshot-lookup-supabase";

// ── Ola 3: modelo + parseo puro + canonicalización + pre-filtro léxico (132-04) ───────────────
export { RssItemSchema, type RssItem } from "./model";
export { parseRss, ParseRssError } from "./parse-rss";
export { canonicalizarUrl, urlHash, UrlInvalidaError, PARAMS_TRACKING } from "./canonicalizar-url";
export {
  esLegislativo,
  terminosQueMatchean,
  despojarHtml,
  fold,
  VOCABULARIO_LEGISLATIVO,
} from "./prefiltro-lexico";

// ── Ola 4: writer idempotente + orquestador de Etapa 2 (132-05) ──────────────────────────────
export {
  type NewsWriter,
  type NoticiaRow,
  type UrlVistaRow,
  InMemoryNewsWriter,
} from "./writer";
export { SupabaseNewsWriter, type SupabaseNewsWriterOptions } from "./writer-supabase";
export { cargar, type CargarOpts, type CargarResult } from "./carga-run";

// ── Ola 4: CLI local Etapa1+Etapa2 (132-06) ───────────────────────────────────────────────────
export {
  main as runNewsCli,
  parseArgs,
  findWorkspaceRoot,
  NewsCliArgsError,
  NewsR2RequeridoError,
  type NewsCliOptions,
  type NewsCliResult,
} from "./run-news-cli";

// ── Phase 134: contrato anti-alucinación (resolver determinista + dead-letter) ────────────────
export { extraerBoletines } from "./resolver/boletin-en-materia";
export {
  assertAllowlistNoVacia,
  resolverBoletin,
  resolverParlamentario,
  normalizarNombre,
  type AllowlistResolver,
} from "./resolver/resolver";
export { construirAllowlist, cargarAllowlist, type PersonaAllowlist, type AliasAllowlist } from "./resolver/allowlist";
export {
  REJECTION_STAGES,
  RejectionStageSchema,
  DeadLetterPayloadSchema,
  DeadLetterRowSchema,
  SupabaseDeadLetterWriter,
  type RejectionStage,
  type DeadLetterRow,
  type DeadLetterWriter,
} from "./resolver/dead-letter";
export {
  UMBRAL_CONFIANZA,
  EmisionSchema,
  construirEmisionRequest,
  aplicarUmbral,
  type Emision,
  type EmisionRequest,
} from "./resolver/emision";
export { procesarLoteAllOrNothing, type ResultadoGate } from "./resolver/gate";
