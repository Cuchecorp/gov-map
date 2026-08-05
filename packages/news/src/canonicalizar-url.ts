// canonicalizar-url.ts — canonicalización de URL para dedup de noticias (D-13, 132-04).
//
// `urlHash` es la PK de `noticia` y de `noticia_url_vista` (D-13): cambiar la
// canonicalización invalida el ledger existente (dos URLs que antes producían hashes
// distintos podrían colisionar, o viceversa) ⇒ un cambio aquí exige migración de datos,
// NUNCA es refactor libre.

import { sha256Hex } from "@obs/ingest";

/**
 * Parámetros de tracking eliminados de la URL canónica. Congelado: sumar/quitar un
 * término aquí cambia el `url_hash` de TODAS las URLs futuras que lo contengan
 * (impacto en el ledger de dedup, ver cabecera del archivo).
 */
export const PARAMS_TRACKING: readonly string[] = Object.freeze([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "source",
]);

function esParamTracking(nombre: string): boolean {
  return nombre.startsWith("utm_") || PARAMS_TRACKING.includes(nombre);
}

/** Error tipado: la URL cruda no es una URL válida. */
export class UrlInvalidaError extends Error {
  constructor(raw: string, cause: unknown) {
    super(`canonicalizarUrl: URL inválida "${raw}": ${String(cause)}`);
    this.name = "UrlInvalidaError";
  }
}

/**
 * Produce la forma canónica de una URL para dedup (D-13):
 * - elimina parámetros de tracking (`utm_*` + el set congelado `PARAMS_TRACKING`)
 * - elimina el fragmento (`#...`)
 * - elimina la barra final redundante
 * - pasa el host a minúsculas (el esquema se conserva tal cual)
 * - ordena alfabéticamente los parámetros restantes (para que el orden de origen
 *   no altere el `url_hash`)
 *
 * Lanza `UrlInvalidaError` si `raw` no es una URL válida (nunca devuelve la cadena
 * original en silencio).
 */
export function canonicalizarUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch (cause) {
    throw new UrlInvalidaError(raw, cause);
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  const nombresParam = [...url.searchParams.keys()];
  for (const nombre of nombresParam) {
    if (esParamTracking(nombre)) {
      url.searchParams.delete(nombre);
    }
  }

  const entradas = [...url.searchParams.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  url.search = "";
  for (const [k, v] of entradas) {
    url.searchParams.append(k, v);
  }

  // Barra final redundante del pathname (nunca sobre la raíz "/" sola).
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/**
 * SHA-256 (64 hex) de la URL CANÓNICA (nunca de la original) codificada en UTF-8.
 * Es el `url_hash` PK de `noticia` / `noticia_url_vista` (D-13).
 */
export async function urlHash(raw: string): Promise<string> {
  const canonica = canonicalizarUrl(raw);
  const bytes = new TextEncoder().encode(canonica);
  return sha256Hex(bytes);
}
