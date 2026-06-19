// connector-leylobby — fetch del HTML de audiencias de la Ley del Lobby (`www.leylobby.gob.cl`)
// REUSANDO @obs/ingest en el ORDEN LOCKED de Fase 5 — NO `BaseConnector.run` (su caché diaria
// saltaría re-corridas):
//
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host)
//     → fetcher.get({ url, headers: BROWSER_HEADERS })
//
// Open Question 1 (RESUELTA — confirmado en packages/ingest/src/robots.ts): el `robots.txt` de
// leylobby devuelve 403 (página de error Apache, no una política). `RobotsGuard.loadRobots`
// trata cualquier `!res.ok` (incl. 403) como `robotsParser(robotsUrl, "")` → FAIL-OPEN
// (permitido). Por eso el 403-robots de leylobby NO bloquea el fetch; no se requiere override
// por-host. (Un error de RED sí hace fail-closed, que es lo correcto.)
//
// Open Question 2 (RESUELTA — corrida LIVE 2026-06-19): la Cámara de Diputados y el Senado NO
// publican en leylobby.gob.cl (es la plataforma del Ejecutivo). La búsqueda
// `/instituciones?search=Camara+de+Diputados` y `?search=Senado` devolvió "No se encontraron
// resultados"; solo aparece "Biblioteca del Congreso Nacional". La fuente de lobby del congreso
// es el portal propio de la Cámara (`camara.cl/transparencia/ley_de_lobby.aspx`, HTTP 200, ya
// allowlisted). El parser es column-agnostic (Assumption A2): el conector vale para cualquier
// institución leylobby; la corrida LIVE contra el congreso queda como verificación de operador.

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  FetchError,
  type AllowlistOptions,
} from "@obs/ingest";

/** Error de robots.txt que prohíbe el fetch (el caller decide; no se reintenta acá). */
export class RobotsDisallowError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt prohíbe ${url}`);
    this.name = "RobotsDisallowError";
  }
}

/**
 * Error de bloqueo de leylobby (HTTP 403/503). Distinto de un fallo genérico: `runIngestLobby`
 * lo reconoce para degradar honestamente esa institución sin abortar la corrida (mirror de
 * `CamaraBloqueadaError`). leylobby ya mostró 503 (descargas) y 500 (csv-route) — fuente volátil.
 */
export class LeylobbyBloqueadaError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`leylobby bloqueó el fetch (HTTP ${status}): ${url}`);
    this.name = "LeylobbyBloqueadaError";
  }
}

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface LeylobbyConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validación SSRF (default: sufijos gubernamentales — cubre leylobby.gob.cl). */
  allowlist?: AllowlistOptions;
}

const BASE = "https://www.leylobby.gob.cl";

/**
 * Header-set de navegador para leylobby (Laravel + Azure front door). El UA mantiene el sufijo
 * identificatorio `Bot-Ciudadano/1.0` (ingesta respetuosa, PROJECT.md).
 */
export const BROWSER_HEADERS_LEYLOBBY: Readonly<Record<string, string>> = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
});

/**
 * Conector de audiencias de leylobby: por cada (institución, año, página) arma la URL del
 * listado y fetchea el HTML crudo, reusando @obs/ingest en el ORDEN LOCKED. NUNCA `BaseConnector.run`.
 */
export class LeylobbyConnector {
  constructor(private readonly deps: LeylobbyConnectorDeps) {}

  /** URL del LISTADO de audiencias de una institución/año/página (`?page=N`, 1-based). */
  urlAudiencias(institucionCodigo: string, year: number, page = 1): string {
    const base = `${BASE}/instituciones/${encodeURIComponent(institucionCodigo)}/audiencias/${year}`;
    return page > 1 ? `${base}?page=${page}` : base;
  }

  /**
   * URL de la página de DETALLE de un sujeto pasivo (`.../audiencias/{year}/{rowId}`). Esta es la
   * página con la tabla keyed por `Identificador` — el `rowId` es un artefacto del listado, NUNCA
   * la clave natural (Pitfall 1).
   */
  urlDetalle(institucionCodigo: string, year: number, rowId: string): string {
    return `${BASE}/instituciones/${encodeURIComponent(institucionCodigo)}/audiencias/${year}/${encodeURIComponent(rowId)}`;
  }

  /**
   * Fetch de UN recurso reusando la política de @obs/ingest en el ORDEN LOCKED, enviando el
   * header-set de navegador. Devuelve el body como string (HTML). Un 403/503 se relanza como
   * `LeylobbyBloqueadaError` (lo demás propaga el error original).
   */
  private async fetch(url: string): Promise<string> {
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (leylobby.gob.cl)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (LOCKED)
    try {
      const body = await this.deps.fetcher.get({
        url,
        headers: { ...BROWSER_HEADERS_LEYLOBBY },
      });
      return new TextDecoder().decode(body);
    } catch (err) {
      if (err instanceof FetchError && (err.status === 403 || err.status === 503)) {
        throw new LeylobbyBloqueadaError(url, err.status);
      }
      throw err;
    }
  }

  /** Fetch del HTML del LISTADO de audiencias (paso 1 del crawl LOCKED de dos pasos). */
  async fetchAudiencias(institucionCodigo: string, year: number, page = 1): Promise<string> {
    return this.fetch(this.urlAudiencias(institucionCodigo, year, page));
  }

  /** Fetch del HTML de la página de DETALLE (paso 2: la tabla keyed por `Identificador`). */
  async fetchDetalle(institucionCodigo: string, year: number, rowId: string): Promise<string> {
    return this.fetch(this.urlDetalle(institucionCodigo, year, rowId));
  }
}
