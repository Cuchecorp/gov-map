import "server-only";

import crypto from "node:crypto";

/**
 * Token opaco de capacidad login-less (NOTIF-04, Phase 103).
 *
 * PATRÓN (RESEARCH §Pattern 6): el link del email de confirmación/baja lleva el token
 * CRUDO (`raw`, 256 bits de aleatoriedad, base64url). La DB almacena SOLO su hash
 * sha256 (hex). Verificar = hashear el `?t=` recibido y buscar la fila por el hash
 * (`confirm_token_hash` / `baja_token_hash`). El token opaco ES la autorización — no
 * hay sesión: quien tiene el link tiene la capacidad (unsubscribe one-click 21.719).
 *
 * SEGURIDAD:
 *   - 32 bytes de `crypto.randomBytes` = 256 bits → no adivinable ni enumerable
 *     (T-103-10). base64url para caber en una URL sin escapes.
 *   - Se guarda SOLO el hash: una filtración de la DB NO revela tokens usables
 *     (el hash no es reversible; hashear es determinista para la búsqueda por igualdad).
 *   - `node:crypto` es builtin (CERO paquete nuevo, T-103-SC).
 *
 * `import "server-only"` (línea 1) garantiza que la generación/hashing del token
 * NUNCA llega al bundle del navegador (el token vive solo server-side y en el email).
 */

/** Longitud en bytes del token crudo (256 bits de entropía). */
const TOKEN_BYTES = 32;

/**
 * Genera un token opaco: `raw` (base64url, para el email) + `hash` (sha256 hex, para
 * la DB). El `raw` NUNCA se persiste; el `hash` NUNCA viaja en el link.
 */
export function generarToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

/**
 * Hash sha256 (hex) de un token crudo — determinista, para la búsqueda por igualdad
 * contra la columna `*_token_hash`. Se aplica al `?t=` recibido antes de la consulta.
 */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
