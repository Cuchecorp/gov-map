/**
 * @obs/ingest — framework de conectores reutilizable.
 *
 * API publica que Plan 03 (Edge Function worker) consume: el contrato
 * BaseConnector + hooks, el DummyConnector E2E, los tipos, y las
 * implementaciones de colaboradores instanciables (rate-limiter, robots,
 * fetcher, cache, r2-store, drift, snapshot) que el worker real ensambla.
 */

// Contrato + Template Method
export { BaseConnector } from "./base-connector";
export type { ConnectorDeps, RequestSpec } from "./base-connector";

// Connector de prueba E2E (no fuente real)
export { DummyConnector } from "./dummy-connector";
export type { DummyRaw } from "./dummy-connector";

// Colaboradores (politica) — instanciables por el worker de Plan 03
export { HostRateLimiter } from "./rate-limiter";
export type { RateLimiterOptions } from "./rate-limiter";
export { PgHostThrottle, ThrottleDeferError } from "./host-throttle";
export type { ReserveSlotRpc, HostThrottleOptions } from "./host-throttle";
export { RobotsGuard, IDENTIFIED_UA } from "./robots";
export type { RobotsGuardOptions } from "./robots";
export { Fetcher, RetryableError, FetchError } from "./fetcher";
export type { FetchSpec, FetcherOptions } from "./fetcher";
export {
  assertAllowedUrl,
  HostNotAllowedError,
  DEFAULT_ALLOWED_SUFFIXES,
  extraHostsFromEnv,
} from "./allowlist";
export type { AllowlistOptions } from "./allowlist";
export { DailyCache, dateBucket } from "./cache";
export type { CacheSpec, SnapshotLookup } from "./cache";
export { R2Store, sha256Hex } from "./r2-store";
export type { R2Config, R2StoreOptions } from "./r2-store";
export { DriftDetector, fingerprint, structuralPaths } from "./drift";
export type { DriftResult, DriftStore } from "./drift";
export { SnapshotWriter } from "./snapshot";
export type { SnapshotRef, SnapshotWrite, SnapshotStore } from "./snapshot";
export { SupabaseSnapshotStore } from "./snapshot-store-supabase";
export type {
  SupabaseSnapshotStoreOptions,
  SupabaseClientLike,
  CreateSupabaseClient,
} from "./snapshot-store-supabase";
