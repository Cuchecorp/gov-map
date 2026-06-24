/**
 * backup-entidad — exportMaestraEntidad: snapshot JSON de la maestra `entidad_tercero` en git
 * (custodia ENT-05) + R2 gateado.
 *
 * ESPEJO del PATRÓN de `backup.ts` (parlamentario), NO del tipo `Parlamentario`. El JSON en git
 * ES el respaldo fuera de Supabase que cumple la custodia de la maestra de terceros HOY
 * (autoritativo). R2 es un paso de OPERADOR diferido: `r2Enabled` es false por defecto y la
 * ausencia/fallo de R2 NUNCA rompe el export a git.
 *
 * Determinismo (requisito de custodia): dos exports de la misma maestra son byte-idénticos —
 * filas ordenadas por `id`, claves de cada objeto ordenadas alfabéticamente, indent fijo. Diff
 * estable en git; round-trip (export→parse) preserva la maestra.
 *
 * La ESCRITURA real del archivo la dispara el backfill-cli con un `SeedFileWriter` que toca
 * disco; acá el writer es inyectable (los tests usan un fake) para mantener `backup-entidad.ts`
 * puro/testeable.
 */

/** Destino autoritativo del snapshot de terceros (versionado en git = custodia ENT-05). */
export const SEED_PATH = "supabase/seeds/entidad_tercero.seed.json";

/**
 * Fila de `entidad_tercero` a custodiar. Subconjunto serializable de la maestra (clave de match
 * + estado + provenance). La clave de orden es `id`.
 */
export interface EntidadTercero {
  id: string;
  nombre_normalizado: string;
  tipo_entidad: "natural" | "juridica";
  rut: string | null;
  estado: "confirmado" | "probable" | "no_confirmado";
  origen: string;
  fecha_captura: string;
  enlace: string;
}

/** Writer de archivo inyectable (el real toca disco en el backfill-cli). */
export interface SeedFileWriter {
  write(path: string, content: string): Promise<void>;
}

/**
 * Target de respaldo a R2 (envuelve `R2Store.putImmutable`). Diferido; gateado por `r2Enabled`.
 * Devuelve la key escrita.
 */
export interface R2BackupTarget {
  put(content: string): Promise<string>;
}

export interface ExportEntidadOptions {
  writer: SeedFileWriter;
  /** Ruta destino (default: SEED_PATH). */
  path?: string;
  /** Target R2 opcional (diferido). */
  r2?: R2BackupTarget;
  /** Habilita el intento de respaldo a R2. Default false. */
  r2Enabled?: boolean;
}

export interface ExportEntidadResult {
  /** Ruta donde se escribió el snapshot git (autoritativo). */
  path: string;
  /** Bytes del snapshot. */
  bytes: number;
  /** true si R2 se intentó Y tuvo éxito; false si deshabilitado/ausente/falló. */
  r2Ok: boolean;
  /** Key de R2 si el respaldo a R2 tuvo éxito. */
  r2Key?: string;
}

/** Orden canónico de filas: por `id` ascendente (estable entre corridas). */
function ordenarFilas(maestra: EntidadTercero[]): EntidadTercero[] {
  return [...maestra].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Serializa un objeto con claves ordenadas alfabéticamente (determinista). */
function withSortedKeys(obj: EntidadTercero): Record<string, unknown> {
  const src = obj as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src).sort()) {
    out[k] = src[k];
  }
  return out;
}

/** Serializa la maestra de terceros a un JSON estable y determinista. Pública para reuso/tests. */
export function serializeMaestraEntidad(maestra: EntidadTercero[]): string {
  const ordenadas = ordenarFilas(maestra).map(withSortedKeys);
  return JSON.stringify(ordenadas, null, 2) + "\n";
}

/**
 * Exporta la maestra de terceros al snapshot git (autoritativo, custodia ENT-05) y, si
 * `r2Enabled`, intenta el respaldo a R2 (best-effort: un fallo de R2 NO rompe el export git).
 * Idempotente: el mismo input produce el mismo archivo byte-a-byte.
 */
export async function exportMaestraEntidad(
  maestra: EntidadTercero[],
  opts: ExportEntidadOptions,
): Promise<ExportEntidadResult> {
  const path = opts.path ?? SEED_PATH;
  const content = serializeMaestraEntidad(maestra);

  // 1. Snapshot git AUTORITATIVO (custodia ENT-05).
  await opts.writer.write(path, content);

  // 2. R2 GATEADO: sólo si está habilitado y hay target. Best-effort, no bloquea.
  let r2Ok = false;
  let r2Key: string | undefined;
  if (opts.r2Enabled && opts.r2) {
    try {
      r2Key = await opts.r2.put(content);
      r2Ok = true;
    } catch {
      r2Ok = false;
    }
  }

  return {
    path,
    bytes: new TextEncoder().encode(content).length,
    r2Ok,
    ...(r2Key != null ? { r2Key } : {}),
  };
}
