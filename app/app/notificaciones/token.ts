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
 * Genera un token opaco ALEATORIO: `raw` (base64url, para el email) + `hash` (sha256 hex,
 * para la DB). El `raw` NUNCA se persiste; el `hash` NUNCA viaja en el link.
 *
 * NOTA (CR-01/CR-02, Phase 103): este generador aleatorio NO permite regenerar el `raw`
 * en el momento del envío (el `raw` se pierde al salir de scope). Para el flujo de email
 * (confirm/baja) usar `deriveToken()` — deriva el `raw` de forma DETERMINISTA a partir de
 * un secreto de servidor + el id de la suscripción, de modo que el CRON del digest puede
 * reproducir el mismo `raw` para el link sin persistirlo en claro. Se conserva
 * `generarToken` por compatibilidad con tests/otros usos.
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

/**
 * Propósito del token derivado — namespacea la derivación para que el token de confirmar
 * y el de baja de la MISMA suscripción NUNCA colisionen (dominios de capacidad separados).
 */
export type TokenPurpose = "confirm" | "baja";

/**
 * Deriva un token opaco DETERMINISTA (CR-01/CR-02, Phase 103):
 *   raw  = base64url( HMAC-SHA256(secret, `${purpose}:${suscripcionId}`) )
 *   hash = sha256(raw)   ← lo que se guarda en `*_token_hash` (hash-at-rest, LOCKED)
 *
 * INVARIANTE CLAVE: `hashToken(deriveToken(secret, purpose, id).raw) === storedHash`.
 * El `raw` es reproducible en el momento del envío por el CRON del digest (mismo secreto
 * + el `id` de la fila) SIN persistir el crudo en la DB. El secreto vive solo en el
 * entorno del servidor (NOTIF_TOKEN_SECRET) → una filtración de la DB no permite forjar
 * tokens (el hash no es reversible y el `raw` requiere el secreto).
 *
 * SEGURIDAD: HMAC-SHA256 (no un hash simple del id) evita que conocer el `id` público de
 * la fila permita derivar el token — hace falta el secreto. `id` es un UUID (128 bits) +
 * secreto de servidor ⇒ no adivinable ni enumerable (T-103-10).
 */
export function deriveToken(
  secret: string,
  purpose: TokenPurpose,
  suscripcionId: string,
): { raw: string; hash: string } {
  if (!secret) {
    throw new Error(
      "deriveToken: falta el secreto (NOTIF_TOKEN_SECRET). Sin él los links de " +
        "confirmación/baja del email no pueden derivarse ni reproducirse.",
    );
  }
  const raw = crypto
    .createHmac("sha256", secret)
    .update(`${purpose}:${suscripcionId}`)
    .digest("base64url");
  return { raw, hash: hashToken(raw) };
}

// ── TOKEN DE BAJA A NIVEL USUARIO (CR-03, Phase 103) ──────────────────────────────
// El digest es UN correo por usuario que agrega TODAS sus suscripciones confirmadas. El
// one-click unsubscribe (footer + header RFC 8058 List-Unsubscribe) DEBE detener ESE correo
// completo — no una sola de N suscripciones (violación 21.719: silenciar un tema y seguir
// mandando el resto). El token de baja por-suscripción (deriveToken 'baja') servía para dar
// de baja UNA fila; el digest necesita uno por USUARIO.
//
// FORMATO AUTO-AUTENTICANTE (sin lookup por token en la DB): el token es
//   base64url( `${userId}:${HMAC-SHA256(secret, "baja-user:"+userId).base64url}` )
// La landing lo decodifica, parte en el PRIMER ':' → (userId, firma), RE-DERIVA la firma con
// el secreto y compara en tiempo constante. Si casa → borra TODAS las suscripciones del user.
// El userId es un UUID (no PII, no secreto), pero forjar la firma exige NOTIF_TOKEN_SECRET;
// un atacante con el UUID pero sin el secreto no puede fabricar un token válido.

/** Prefijo de dominio HMAC del token de baja por-usuario (namespacea vs 'baja'/'confirm'). */
const BAJA_USER_MSG = "baja-user:";

/** Firma HMAC (base64url) del token de baja por-usuario para un userId dado. */
function firmaBajaUsuario(secret: string, userId: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${BAJA_USER_MSG}${userId}`)
    .digest("base64url");
}

/**
 * Deriva el token de baja A NIVEL USUARIO (CR-03), auto-autenticante y reproducible por el
 * CRON del digest: base64url(`${userId}:${HMAC(secret,'baja-user:'+userId)}`). No se persiste
 * nada nuevo en la DB — la firma se re-deriva en la landing. Fail-loud sin el secreto.
 */
export function deriveUserBajaToken(secret: string, userId: string): string {
  if (!secret) {
    throw new Error(
      "deriveUserBajaToken: falta el secreto (NOTIF_TOKEN_SECRET). Sin él el link de " +
        "baja del digest no puede derivarse ni reproducirse.",
    );
  }
  const firma = firmaBajaUsuario(secret, userId);
  return Buffer.from(`${userId}:${firma}`, "utf8").toString("base64url");
}

/**
 * Verifica un token de baja por-usuario y devuelve el `userId` si la firma casa, o null si el
 * token es ausente/malformado/forjado. Comparación en TIEMPO CONSTANTE (timingSafeEqual) para
 * no filtrar la firma esperada por canal de tiempo. NO consulta la DB — el token se auto-valida.
 */
export function verifyUserBajaToken(secret: string, token: string): string | null {
  if (!secret || !token) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep <= 0 || sep === decoded.length - 1) return null;
  const userId = decoded.slice(0, sep);
  const firmaRecibida = decoded.slice(sep + 1);
  const firmaEsperada = firmaBajaUsuario(secret, userId);
  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(firmaEsperada);
  // timingSafeEqual exige longitudes iguales — si difieren, la firma no puede casar.
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return userId;
}
