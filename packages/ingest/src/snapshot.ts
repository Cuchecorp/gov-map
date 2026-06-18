/**
 * Writer de source_snapshot con provenance (FND-08).
 *
 * Persiste solo la referencia al crudo (r2_path, content_hash) + fingerprint +
 * la Provenance capturada al momento del fetch (source, fetched_at, source_url).
 * El crudo NUNCA entra a Postgres (raw-immutable / normalized-derived).
 */
import type { Provenance } from "@obs/core";

/** Referencia a un snapshot escrito. */
export interface SnapshotRef {
  snapshotId?: number;
  r2Path: string;
  contentHash: string;
}

/** Entrada para escribir un snapshot. */
export interface SnapshotWrite {
  source: string;
  resource: string;
  cacheKey: string;
  r2Path: string;
  contentHash: string;
  fingerprint: string;
  dateBucket: string;
  /** Provenance capturada al ingestar (FND-08). */
  provenance: Provenance;
  ingestRunId?: number;
}

/** Store inyectable a source_snapshot (DB real en el worker, mock en tests). */
export interface SnapshotStore {
  insertSnapshot(row: Record<string, unknown>): Promise<{ id: number }>;
}

export class SnapshotWriter {
  constructor(private readonly store: SnapshotStore) {}

  /** Inserta la fila source_snapshot mapeando a las columnas del DDL. */
  async write(input: SnapshotWrite): Promise<SnapshotRef> {
    const row: Record<string, unknown> = {
      ingest_run_id: input.ingestRunId ?? null,
      source: input.source,
      resource: input.resource,
      cache_key: input.cacheKey,
      r2_path: input.r2Path,
      content_hash: input.contentHash,
      fingerprint: input.fingerprint,
      date_bucket: input.dateBucket,
      // Provenance (FND-08) inline, capturada al ingestar:
      source_url: input.provenance.sourceUrl,
      fetched_at: input.provenance.fetchedAt,
    };
    const { id } = await this.store.insertSnapshot(row);
    return {
      snapshotId: id,
      r2Path: input.r2Path,
      contentHash: input.contentHash,
    };
  }
}
