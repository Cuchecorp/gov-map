// allowlist-news.ts — allowlist SCOPED a los 5 hosts de prensa (T-132-01).
//
// PROHIBIDO tocar `DEFAULT_ALLOWED_SUFFIXES` de @obs/ingest: eso ampliaría la superficie SSRF
// a TODOS los conectores gubernamentales del monorepo. Los hosts de prensa se agregan SOLO
// como `extraHosts` scoped a este package (patrón `allowlistConServel`,
// packages/dinero/src/connector-servel.ts:107-112).

import { assertAllowedUrl, type AllowlistOptions } from "@obs/ingest";
import { NEWS_HOSTS } from "./feeds";

/** Allowlist efectiva: la base del caller + los 5 hosts de prensa como extraHosts EXACTOS. */
export function allowlistNews(base: AllowlistOptions = {}): AllowlistOptions {
  const extra = new Set([...(base.extraHosts ?? []), ...NEWS_HOSTS]);
  return { ...base, extraHosts: [...extra] };
}

/**
 * Valida una URL de feed contra la allowlist scoped de prensa + fuerza https explícito
 * (extraHosts de @obs/ingest admite también http — los feeds de prensa son https-only).
 */
export function assertFeedUrl(url: string): URL {
  const parsed = assertAllowedUrl(url, allowlistNews());
  if (parsed.protocol !== "https:") {
    throw new Error(`feed de prensa requiere https (recibido ${parsed.protocol}): ${url}`);
  }
  return parsed;
}
