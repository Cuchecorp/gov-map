/**
 * Deteccion de drift por fingerprint estructural (FND-04).
 *
 * El fingerprint es el set ordenado de (path, tipo) de la estructura, hasheado.
 * Al ingestar se compara contra el ultimo fingerprint conocido de (source,
 * resource); si difiere se inserta una fila drift_alert y se loguea — SIN
 * detener la ingesta (el crudo igual se guarda en R2). Validacion zod estricta
 * es para los normalizadores (Fase 5+), no para la capa cruda.
 */

/** Recorre la estructura produciendo paths "path:tipo" (forma, no valores). */
export function structuralPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null) return [`${prefix}:null`];
  if (Array.isArray(obj)) {
    return obj.length
      ? structuralPaths(obj[0], `${prefix}[]`)
      : [`${prefix}[]:empty`];
  }
  if (typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .flatMap((k) => structuralPaths((obj as Record<string, unknown>)[k], `${prefix}.${k}`));
  }
  return [`${prefix}:${typeof obj}`];
}

/** Fingerprint estructural sha256 (Web Crypto — sin libreria externa). */
export async function fingerprint(raw: unknown): Promise<string> {
  const paths = [...new Set(structuralPaths(raw))].sort().join("\n");
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(paths),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Resultado de comparar el fingerprint actual contra el ultimo conocido. */
export interface DriftResult {
  changed: boolean;
  prevFingerprint?: string;
  newFingerprint: string;
}

/** Store inyectable: lee el ultimo fingerprint e inserta drift_alert. */
export interface DriftStore {
  lastFingerprint(source: string, resource: string): Promise<string | undefined>;
  insertAlert(rec: {
    source: string;
    resource: string;
    prevFingerprint?: string;
    newFingerprint: string;
  }): Promise<void>;
}

export class DriftDetector {
  constructor(private readonly store: DriftStore) {}

  /**
   * Compara `fp` contra el ultimo fingerprint conocido de (source, resource).
   * Primera vez (sin previo) => changed=false. Difiere => changed=true.
   */
  async check(source: string, resource: string, fp: string): Promise<DriftResult> {
    const prev = await this.store.lastFingerprint(source, resource);
    const changed = prev !== undefined && prev !== fp;
    return { changed, prevFingerprint: prev, newFingerprint: fp };
  }

  /**
   * Inserta una fila drift_alert. NO lanza: la ingesta continua y el crudo se
   * guarda igual (FND-04). Errores de insert se tragan deliberadamente.
   */
  async alert(source: string, resource: string, result: DriftResult): Promise<void> {
    try {
      await this.store.insertAlert({
        source,
        resource,
        prevFingerprint: result.prevFingerprint,
        newFingerprint: result.newFingerprint,
      });
    } catch (e) {
      // El drift no bloquea la ingesta; el fallo al registrar la alerta no debe
      // propagarse (el crudo ya se capturó). #13: pero SÍ se loguea — antes el catch
      // vacío perdía el evento de drift sin rastro si Supabase estaba degradado (FND-04).
      console.warn(
        `[drift] no se pudo registrar drift_alert (${source}/${resource}):`,
        e instanceof Error ? e.message : e,
      );
    }
  }
}
