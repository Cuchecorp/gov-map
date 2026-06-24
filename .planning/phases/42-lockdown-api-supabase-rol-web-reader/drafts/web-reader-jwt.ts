/**
 * LOCKDOWN-03 — Módulo server-only para minting de tokens JWT `web_reader`.
 *
 * Genera un HS256 JWT con `role: "web_reader"` firmado con el secreto del
 * proyecto Supabase (legacy JWT secret, simétrico). PostgREST valida la
 * firma y ejecuta `SET ROLE web_reader` en lugar de `SET ROLE anon`.
 *
 * IMPORTANTE (orden de cutover — ver _FACTS-live-prod.md §Cutover order):
 *   1. LOCKDOWN-01 (DDL) aplicado → `web_reader` existe en PROD.
 *   2. Este módulo deployado a Cloudflare con SUPABASE_JWT_SECRET en env.
 *   3. LOCKDOWN-02 (revoke anon) aplicado ÚLTIMO — JAMÁS antes del paso 2.
 *
 * Dependencias: solo `node:crypto` (HMAC-SHA256 nativo en Node ≥ 18 / CF
 * Workers). No se agrega `jose` ni ninguna librería externa porque el
 * proyecto no la incluye en app/package.json y la operación es trivial.
 *
 * Cacheo en proceso: el token se reutiliza hasta 60 segundos antes de su
 * expiración para evitar firma en cada request (el módulo es singleton en el
 * worker de Cloudflare Pages / Node). Thread-safety: Node.js es single-
 * threaded; no se necesita mutex.
 */

import { createHmac } from "node:crypto";

// TTL del token en segundos (5 min). PostgREST valida `exp`; el servidor
// renueva el token si faltan menos de REFRESH_BUFFER_S segundos para expirar.
const TOKEN_TTL_S = 5 * 60; // 300 s
const REFRESH_BUFFER_S = 60; // renovar 60 s antes de expirar

// Ref del proyecto Supabase — se extrae de SUPABASE_URL para evitar otra var.
// SUPABASE_URL tiene la forma https://<ref>.supabase.co
function extractRef(supabaseUrl: string): string {
  const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (match) return match[1];
  // URL de proyecto custom o local: usar la URL completa truncada como ref
  // (solo importa que el payload sea consistente con lo que generó el anon key).
  // En PROD la URL siempre tiene el formato estándar; este fallback es para local.
  return "local";
}

/** Codifica un objeto como base64url sin padding. */
function b64url(obj: object | string): string {
  const str = typeof obj === "string" ? obj : JSON.stringify(obj);
  return Buffer.from(str).toString("base64url");
}

/** Firma HS256: HMAC-SHA256 sobre `header.payload`. */
function hs256(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Minta un JWT HS256 con `role: "web_reader"`. */
function mintToken(secret: string, ref: string): { token: string; exp: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_S;

  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({
    iss: "supabase",
    ref,
    role: "web_reader",
    iat: now,
    exp,
  });

  const sig = hs256(secret, `${header}.${payload}`);
  return { token: `${header}.${payload}.${sig}`, exp };
}

// Caché en proceso: singleton válido mientras no haya expirado menos el buffer.
let _cache: { token: string; exp: number } | null = null;

/**
 * Retorna un token JWT válido para el rol `web_reader`.
 *
 * Re-minta automáticamente cuando el token está a menos de REFRESH_BUFFER_S
 * segundos de expirar. Lanza si `SUPABASE_JWT_SECRET` no está en el entorno.
 *
 * @returns JWT firmado listo para usar como `Authorization: Bearer <token>`.
 */
export function mintWebReaderToken(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Falta SUPABASE_JWT_SECRET en el entorno del servidor. " +
        "Agrega el JWT secret del proyecto (Dashboard → Settings → API → JWT Secret) " +
        "a .env (local) y a las variables de entorno de Cloudflare Pages (prod). " +
        "NUNCA uses SUPABASE_SECRET_KEY (sb_secret_…) aquí — esa es la service key, " +
        "no el secreto de firma JWT."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (_cache && _cache.exp - now > REFRESH_BUFFER_S) {
    return _cache.token;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const ref = extractRef(supabaseUrl);
  _cache = mintToken(secret, ref);
  return _cache.token;
}
