/**
 * Procedencia de primera clase (FND-08).
 *
 * Se captura en el momento del fetch — NO se agrega despues. `snapshotRef`
 * queda indefinido al construir y se completa una vez que el crudo se escribe
 * en R2 (post-PUT).
 */
export interface Provenance {
  /** Id de la fuente, ej. "dummy". */
  source: string;
  /** ISO 8601 timestamp del momento de captura. */
  fetchedAt: string;
  /** Enlace original consultado. */
  sourceUrl: string;
  /** r2_path una vez escrito el crudo; opcional al construir. */
  snapshotRef?: string;
}

/**
 * Construye una Provenance capturando `fetchedAt = now()` en ISO 8601.
 * Puro y sin dependencias de runtime. No setea `snapshotRef`.
 */
export function makeProvenance(source: string, sourceUrl: string): Provenance {
  return {
    source,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
  };
}
