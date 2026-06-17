/**
 * Tipos del plano de control. Reflejan el DDL de la migracion 0002
 * (ingest_run / source_snapshot / drift_alert).
 *
 * Solo tipos + helpers puros: @obs/core no tiene dependencias de runtime.
 */

/** Estado de una corrida de ingesta. */
export type IngestStatus = "running" | "ok" | "error";

const INGEST_STATUSES: readonly IngestStatus[] = ["running", "ok", "error"];

/** Type-guard para IngestStatus: rechaza cualquier valor fuera del union. */
export function isIngestStatus(value: unknown): value is IngestStatus {
  return typeof value === "string" && (INGEST_STATUSES as readonly string[]).includes(value);
}

/** Corrida de ingesta (tabla ingest_run). */
export interface IngestRun {
  id: number;
  source: string;
  startedAt: string;
  finishedAt?: string;
  status: IngestStatus;
  stats: Record<string, unknown>;
  error?: string;
}

/**
 * Snapshot crudo registrado (tabla source_snapshot).
 * Postgres guarda solo la referencia (r2Path/contentHash) + provenance,
 * nunca el crudo. La cache diaria se materializa en (source, resource, dateBucket).
 */
export interface SourceSnapshot {
  id: number;
  ingestRunId: number;
  source: string;
  resource: string;
  cacheKey: string;
  r2Path: string;
  contentHash: string;
  fingerprint: string;
  /** Provenance (FND-08) capturada al ingestar. */
  sourceUrl: string;
  fetchedAt: string;
  /** Bucket diario (YYYY-MM-DD) — caché diaria FND-03. */
  dateBucket: string;
}

/** Alerta de drift estructural (tabla drift_alert). */
export interface DriftAlert {
  id: number;
  source: string;
  resource: string;
  prevFingerprint?: string;
  newFingerprint: string;
  detectedAt: string;
  snapshotId?: number;
  acknowledged: boolean;
}
