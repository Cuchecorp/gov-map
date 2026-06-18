/**
 * Allowlist de origenes gubernamentales + defensa SSRF (CR-03).
 *
 * El framework es deny-by-default: solo se permite pedir a hosts
 * gubernamentales explicitamente aprobados (camara.cl, senado.cl, bcn.cl,
 * leychile.cl, leylobby.gob.cl, datos.cplt.cl, infoprobidad.cl,
 * api.mercadopublico.cl y sus subdominios). Cualquier otro host —y en
 * particular targets internos (loopback, link-local, metadata cloud
 * 169.254.169.254, rangos RFC1918, IPv6 ULA)— se rechaza ANTES de cualquier
 * fetch. Solo https (y http SOLO para hosts de test no enrutables como
 * dummy.local, habilitados via `extraHosts`).
 *
 * Esto cierra la superficie SSRF que abre un handler sin auth (CR-01) + URLs
 * provistas por el conector: aunque un caller logre inyectar una URL, no puede
 * alcanzar la metadata del cloud ni servicios internos (kong:8000, localhost).
 */

/** Sufijos de dominio gubernamentales permitidos (host == sufijo o subdominio). */
export const DEFAULT_ALLOWED_SUFFIXES: readonly string[] = [
  "camara.cl",
  "senado.cl",
  "bcn.cl",
  "leychile.cl",
  "leylobby.gob.cl",
  "cplt.cl",
  "infoprobidad.cl",
  "mercadopublico.cl",
] as const;

export interface AllowlistOptions {
  /** Sufijos permitidos. Default: DEFAULT_ALLOWED_SUFFIXES. */
  suffixes?: readonly string[];
  /**
   * Hosts exactos extra permitidos sobre http (NO https), p.ej. "dummy.local"
   * para tests E2E. Default: ninguno (produccion = solo https gubernamental).
   * Habilitar via env INGEST_ALLOW_TEST_HOSTS=dummy.local en dev/CI.
   */
  extraHosts?: readonly string[];
}

/** Error de host/scheme no permitido (deny-by-default). */
export class HostNotAllowedError extends Error {
  constructor(readonly rawUrl: string, reason: string) {
    // No incluir credenciales ni querystring sensible: solo el host/scheme.
    super(`host no permitido (${reason}): ${rawUrl}`);
    this.name = "HostNotAllowedError";
  }
}

function isPrivateOrReservedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Hostnames que nunca deben pedirse (loopback / metadata por nombre).
  if (h === "localhost" || h === "metadata" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal") return true;

  // IPv4 literal?
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // IPv6 literal (URL.hostname para "[::1]" devuelve "[::1]").
  if (h.startsWith("[") || h.includes(":")) {
    const ip = h.replace(/^\[|\]$/g, "");
    if (ip === "::1" || ip === "::") return true; // loopback / unspecified
    if (ip.startsWith("fe80")) return true; // link-local
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // ULA fc00::/7
    if (ip.startsWith("::ffff:")) return true; // IPv4-mapped (evita bypass)
    return true; // cualquier otro IPv6 literal: deny por conservadurismo
  }

  return false;
}

function hostMatchesSuffix(hostname: string, suffix: string): boolean {
  const h = hostname.toLowerCase();
  const s = suffix.toLowerCase();
  return h === s || h.endsWith(`.${s}`);
}

/**
 * Valida la URL contra el allowlist y la defensa SSRF. Devuelve la URL parseada
 * si pasa; lanza HostNotAllowedError si no.
 *
 * Reglas:
 *   1. Debe ser URL valida (lanza si malformada).
 *   2. Scheme https (o http SOLO para extraHosts de test).
 *   3. Host no puede ser IP privada/loopback/link-local/metadata.
 *   4. Host debe ser sufijo gubernamental aprobado (o extraHost exacto).
 */
export function assertAllowedUrl(rawUrl: string, opts: AllowlistOptions = {}): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new HostNotAllowedError(rawUrl, "url-malformada");
  }

  const suffixes = opts.suffixes ?? DEFAULT_ALLOWED_SUFFIXES;
  const extraHosts = opts.extraHosts ?? [];
  const hostname = u.hostname;

  // SSRF: nunca permitir targets internos, aunque caigan bajo un sufijo.
  if (isPrivateOrReservedHostname(hostname)) {
    throw new HostNotAllowedError(rawUrl, "host-interno");
  }

  // extraHosts (test): exactos, permiten http; saltan la regla de sufijo.
  const isExtra = extraHosts.some((h) => h.toLowerCase() === hostname.toLowerCase());
  if (isExtra) {
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new HostNotAllowedError(rawUrl, "scheme-no-http");
    }
    return u;
  }

  // Produccion: solo https.
  if (u.protocol !== "https:") {
    throw new HostNotAllowedError(rawUrl, "scheme-no-https");
  }

  if (!suffixes.some((s) => hostMatchesSuffix(hostname, s))) {
    throw new HostNotAllowedError(rawUrl, "host-no-allowlisted");
  }

  return u;
}

/** Lee extraHosts de la env INGEST_ALLOW_TEST_HOSTS (coma-separados). */
export function extraHostsFromEnv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
