/**
 * backup — exportMaestra: snapshot JSON versionado en git (ID-09) + R2 gateado.
 *
 * El JSON en git ES el respaldo fuera de Supabase que cumple ID-09 HOY (autoritativo).
 * R2 (`R2Store.putImmutable`) y el push remoto son pasos de OPERADOR diferidos: las
 * credenciales R2 dan 401 hoy (CONTEXT), por lo que `r2Enabled` es false por defecto y la
 * ausencia/fallo de R2 NUNCA rompe el export a git.
 *
 * Determinismo (requisito ID-09): dos exports de la misma maestra son byte-idénticos —
 * filas ordenadas por `id`, claves de cada objeto ordenadas alfabéticamente, indent fijo.
 * Esto hace que el diff en git sea estable y el round-trip (export→parse) preserve la maestra.
 *
 * La ESCRITURA real del archivo la dispara Plan 04 con un `SeedFileWriter` que toca disco;
 * acá el writer es inyectable (los tests usan un fake) para mantener `backup.ts` puro/testeable.
 */

import type { Parlamentario } from "@obs/core";

/** Destino autoritativo del snapshot (versionado en git = ID-09). */
export const SEED_PATH = "supabase/seeds/parlamentario.seed.json";

/** Writer de archivo inyectable (el real toca disco en Plan 04). */
export interface SeedFileWriter {
  write(path: string, content: string): Promise<void>;
}

/**
 * Target de respaldo a R2 (envuelve `R2Store.putImmutable`). Diferido por credencial 401;
 * gateado por `r2Enabled`. Devuelve la key escrita.
 */
export interface R2BackupTarget {
  put(content: string): Promise<string>;
}

export interface ExportOptions {
  writer: SeedFileWriter;
  /** Ruta destino (default: SEED_PATH). */
  path?: string;
  /** Target R2 opcional (diferido). */
  r2?: R2BackupTarget;
  /** Habilita el intento de respaldo a R2. Default false (credencial 401). */
  r2Enabled?: boolean;
}

export interface ExportResult {
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
function ordenarFilas(maestra: Parlamentario[]): Parlamentario[] {
  return [...maestra].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Serializa un objeto con claves ordenadas alfabéticamente (determinista). */
function withSortedKeys(obj: Parlamentario): Record<string, unknown> {
  const src = obj as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src).sort()) {
    out[k] = src[k];
  }
  return out;
}

/**
 * Serializa la maestra a un JSON estable y determinista. Pública para reuso/tests.
 */
export function serializeMaestra(maestra: Parlamentario[]): string {
  const ordenadas = ordenarFilas(maestra).map(withSortedKeys);
  return JSON.stringify(ordenadas, null, 2) + "\n";
}

/**
 * Exporta la maestra al snapshot git (autoritativo, ID-09) y, si `r2Enabled`, intenta
 * el respaldo a R2 (best-effort: un fallo de R2 NO rompe el export git). Idempotente:
 * el mismo input produce el mismo archivo.
 */
export async function exportMaestra(
  maestra: Parlamentario[],
  opts: ExportOptions,
): Promise<ExportResult> {
  const path = opts.path ?? SEED_PATH;
  const content = serializeMaestra(maestra);

  // 1. Snapshot git AUTORITATIVO (ID-09 se cumple acá HOY).
  await opts.writer.write(path, content);

  // 2. R2 GATEADO: sólo si está habilitado y hay target. Best-effort, no bloquea.
  let r2Ok = false;
  let r2Key: string | undefined;
  if (opts.r2Enabled && opts.r2) {
    try {
      r2Key = await opts.r2.put(content);
      r2Ok = true;
    } catch {
      // Credencial 401 / fallo de red: el export a git ya ocurrió; R2 se omite.
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
