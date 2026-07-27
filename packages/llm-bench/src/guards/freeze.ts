/**
 * GUARD DE FREEZE (106-02) — marcador de inmutabilidad sha256 sobre `casos.json`.
 *
 * Precedente "golden congelado ANTES del schema" (golden 32/1263). Cada golden set
 * (routing, clasificación, …) fija su `casos.freeze.json = { hash, fecha, n_casos,
 * estratos }`, donde `hash` es el sha256 de los BYTES de su `casos.json`. El
 * `disjuncion.test.ts` de cada tarea asierta que el hash vivo coincide con el marcador:
 * cualquier edición post-freeze rompe CI hasta que el marcador se re-corte a mano (un
 * acto revisado, no una deriva silenciosa — T-106-05).
 *
 * Puro, sin red, sin dependencias externas (solo `node:crypto`). El barrel
 * `src/index.ts` (owner 106-01) ya re-exporta este módulo; 106-02 solo llena el cuerpo.
 */
import { createHash } from "node:crypto";

/** Marcador de freeze de un golden set: hash de los bytes + metadatos de la corrida. */
export interface FreezeMarker {
  /** sha256 (hex) de los bytes de `casos.json` al momento del freeze. */
  hash: string;
  /** Fecha del freeze (ISO, informativa). */
  fecha: string;
  /** #casos congelados (redundante con el JSON; ayuda a detectar drift de tamaño). */
  n_casos: number;
  /** Estratos cubiertos al momento del freeze. */
  estratos: string[];
}

/**
 * sha256 (hex) de los BYTES crudos de un `casos.json`. NUNCA hash artesanal: usa
 * `node:crypto` `createHash("sha256")` (V6 Cryptography — integridad, no secreto).
 * Se pasa el string leído con `readFileSync(path, "utf8")` para que el hash sea
 * reproducible byte-a-byte con el marcador.
 */
export function hashCasos(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Asierta que los bytes vivos coinciden con el marcador congelado. Lanza si el hash
 * derivó — así cualquier edición post-freeze falla CI hasta el re-corte deliberado
 * del marcador (T-106-05). Pura, testeable sin red.
 */
export function assertFrozen(rawBytes: string, marker: FreezeMarker): void {
  const vivo = hashCasos(rawBytes);
  if (vivo !== marker.hash) {
    throw new Error(
      `FREEZE ROTO: el hash vivo de casos.json (${vivo}) no coincide con el marcador ` +
        `congelado (${marker.hash}). El set se editó tras el freeze. Re-corta el ` +
        `casos.freeze.json a mano (acto revisado) si el cambio es intencional.`,
    );
  }
}
