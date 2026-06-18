/**
 * texto-fuente — descarga del TEXTO ÍNTEGRO del proyecto (mensaje/moción) (SEM-01).
 *
 * Sigue el orden LOCKED de @obs/ingest (política de ingesta respetuosa + SSRF):
 *   assertAllowedUrl → robots.isAllowed → rateLimiter.wait → fetcher.get
 * y, si hay credencial R2, guarda el crudo content-addressed (best-effort).
 *
 * DEGRADACIÓN HONESTA (RESEARCH Pitfall 4 + 5; CONTEXT R2 401):
 *   - link ausente / fetch falla / robots prohíbe / SSRF rechaza  → `{ texto: null }` sin lanzar.
 *   - R2 deshabilitado (default, 401 hoy) o falla                 → texto en memoria, `r2Path: null`,
 *     NUNCA aborta (espeja `identity/src/backup.ts` r2Enabled gate).
 * El pipeline aguas arriba decide qué hacer con `texto === null` (ficha con idea_matriz null,
 * embedding sobre título+materia) — aquí jamás se fabrica texto.
 *
 * Colaboradores INYECTADOS (los reales se ensamblan en el CLI: Fetcher/HostRateLimiter/RobotsGuard
 * de @obs/ingest + R2Store); los tests pasan fakes → sin red ni R2 real.
 */

import { assertAllowedUrl, HostNotAllowedError } from "@obs/ingest";

/** Fetcher mínimo (subconjunto de @obs/ingest Fetcher). */
export interface TextoFetcher {
  get(spec: { url: string }): Promise<Uint8Array>;
}

/** Rate-limiter mínimo (subconjunto de @obs/ingest HostRateLimiter). */
export interface TextoRateLimiter {
  wait(host: string): Promise<void>;
}

/** Robots guard mínimo (subconjunto de @obs/ingest RobotsGuard). */
export interface TextoRobots {
  isAllowed(url: string): Promise<boolean>;
}

/** Target R2 mínimo (envuelve `R2Store.putImmutable`). Devuelve la key escrita. */
export interface TextoR2Target {
  putImmutable(
    source: string,
    resource: string,
    date: string,
    sha: string,
    ext: string,
    body: Uint8Array,
  ): Promise<string>;
}

export interface ObtenerTextoFuenteOpts {
  fetcher: TextoFetcher;
  rateLimiter: TextoRateLimiter;
  robots: TextoRobots;
  /** Target R2 opcional (gateado por r2Enabled). */
  r2?: TextoR2Target;
  /** Habilita el respaldo a R2. Default false (credencial 401 hoy — CONTEXT). */
  r2Enabled?: boolean;
  /** Sink de logs (inyectable). Default: noop. */
  log?: (msg: string) => void;
}

export interface TextoFuenteResult {
  /** El texto íntegro descargado, o null si no se pudo (degradación honesta). */
  texto: string | null;
  /** Key R2 si el respaldo tuvo éxito; null si deshabilitado/ausente/falló. */
  r2Path: string | null;
}

/** sha256 hex del body (Web Crypto nativo, sin libs). */
async function sha256Hex(body: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", body as BufferSource);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Descarga el texto íntegro de `linkMensajeMocion` siguiendo el orden LOCKED, y lo respalda
 * a R2 si hay credencial. Degrada a `{ texto: null }` (sin lanzar) ante cualquier ausencia/fallo.
 */
export async function obtenerTextoFuente(
  linkMensajeMocion: string | null | undefined,
  opts: ObtenerTextoFuenteOpts,
): Promise<TextoFuenteResult> {
  const log = opts.log ?? (() => {});

  // Link ausente → degradación honesta, sin tocar red.
  if (linkMensajeMocion == null || linkMensajeMocion.trim().length === 0) {
    return { texto: null, r2Path: null };
  }

  // 1. SSRF guard ANTES de cualquier red (deny-by-default gobierno). Host no permitido → degrada.
  let url: URL;
  try {
    url = assertAllowedUrl(linkMensajeMocion);
  } catch (err) {
    if (err instanceof HostNotAllowedError) {
      log(`texto-fuente: URL rechazada por allowlist/SSRF → degrada: ${err.message}`);
      return { texto: null, r2Path: null };
    }
    throw err;
  }

  // 2. robots.txt del host. No permitido → skip controlado (degrada).
  let texto: string;
  try {
    if (!(await opts.robots.isAllowed(linkMensajeMocion))) {
      log(`texto-fuente: robots prohíbe ${linkMensajeMocion} → degrada`);
      return { texto: null, r2Path: null };
    }

    // 3. rate-limit serial por host (2-3s) ANTES del fetch.
    await opts.rateLimiter.wait(url.host);

    // 4. fetch del crudo.
    const body = await opts.fetcher.get({ url: linkMensajeMocion });
    texto = new TextDecoder().decode(body);
  } catch (err) {
    // fetch/robots fallaron (red/429/5xx): degrada sin abortar la corrida.
    log(
      `texto-fuente: fetch falló para ${linkMensajeMocion} → degrada: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { texto: null, r2Path: null };
  }

  // 5. R2 GATEADO: best-effort, no bloquea (mirror backup.ts; 401 hoy → r2Path null).
  let r2Path: string | null = null;
  if (opts.r2Enabled && opts.r2) {
    try {
      const body = new TextEncoder().encode(texto);
      const sha = await sha256Hex(body);
      const date = new Date().toISOString().slice(0, 10);
      r2Path = await opts.r2.putImmutable(
        "fichas",
        "texto-fuente",
        date,
        sha,
        "txt",
        body,
      );
    } catch (err) {
      // Credencial 401 / fallo de red: el texto ya está en memoria; R2 se omite.
      log(
        `texto-fuente: respaldo R2 falló → degrada (texto en memoria): ${err instanceof Error ? err.message : String(err)}`,
      );
      r2Path = null;
    }
  }

  return { texto, r2Path };
}
