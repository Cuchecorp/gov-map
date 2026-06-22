// connector-camara-lobby — fetch del HTML del listado de audiencias de lobby del portal propio
// de la Cámara de Diputados (`www.camara.cl/transparencia/listadodeaudiencias.aspx`). Fuente
// DISTINTA de leylobby.gob.cl (el Ejecutivo): la Cámara publica su lobby en su propio portal de
// transparencia (Phase 24).
//
// Reusa @obs/ingest en el ORDEN LOCKED de Fase 5 (mirror de connector-leylobby) — NO
// `BaseConnector.run`:
//
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host)
//     → fetcher.get({ url, headers: BROWSER_HEADERS_CAMARA }) → TextDecoder('utf-8')
//
// El listado es UNA sola página (~12 MB, ~17.776 filas, SIN paginación): un único fetch trae
// TODO el dataset de lobby de la Cámara. Un 403/503 se relanza como `CamaraLobbyBloqueadaError`
// (degradación honesta sin abortar la corrida). `camara.cl` ya está en el allowlist por defecto.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  FetchError,
  type AllowlistOptions,
} from "@obs/ingest";
import { RobotsDisallowError } from "./connector-leylobby";

// Re-export para que los callers de la Cámara no dependan del módulo de leylobby.
export { RobotsDisallowError };

/**
 * Error de bloqueo de la Cámara (HTTP 403/503). Distinto de un fallo genérico: el caller lo
 * reconoce para degradar honestamente esta fuente sin abortar la corrida (mirror de
 * `LeylobbyBloqueadaError`).
 */
export class CamaraLobbyBloqueadaError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`Cámara bloqueó el fetch de lobby (HTTP ${status}): ${url}`);
    this.name = "CamaraLobbyBloqueadaError";
  }
}

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface CamaraLobbyConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validación SSRF (default: sufijos gubernamentales — cubre camara.cl). */
  allowlist?: AllowlistOptions;
}

const URL_LISTADO = "https://www.camara.cl/transparencia/listadodeaudiencias.aspx";

/**
 * Header-set de navegador para la Cámara. El UA mantiene el sufijo identificatorio
 * `Bot-Ciudadano/1.0` (ingesta respetuosa, PROJECT.md).
 */
export const BROWSER_HEADERS_CAMARA: Readonly<Record<string, string>> = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
});

/**
 * Conector del listado de audiencias de lobby de la Cámara: un único fetch del HTML crudo
 * (todo el dataset), reusando @obs/ingest en el ORDEN LOCKED. NUNCA `BaseConnector.run`.
 */
export class CamaraLobbyConnector {
  constructor(private readonly deps: CamaraLobbyConnectorDeps) {}

  /** URL del listado completo de audiencias de lobby de la Cámara (fetch único, sin paginación). */
  urlListado(): string {
    return URL_LISTADO;
  }

  /**
   * Fetch del HTML del listado completo reusando la política de @obs/ingest en el ORDEN LOCKED,
   * enviando el header-set de navegador. Devuelve el body decodificado como string (UTF-8). Un
   * 403/503 se relanza como `CamaraLobbyBloqueadaError` (lo demás propaga el error original).
   */
  async fetchListado(): Promise<string> {
    const url = this.urlListado();
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (camara.cl)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (LOCKED)
    try {
      const body = await this.deps.fetcher.get({
        url,
        headers: { ...BROWSER_HEADERS_CAMARA },
      });
      return new TextDecoder("utf-8").decode(body);
    } catch (err) {
      if (err instanceof FetchError && (err.status === 403 || err.status === 503)) {
        throw new CamaraLobbyBloqueadaError(url, err.status);
      }
      throw err;
    }
  }
}
