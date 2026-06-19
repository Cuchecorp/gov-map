// connector-infoprobidad — fetch del SPARQL-JSON de InfoProbidad (`datos.cplt.cl/sparql`,
// CPLT/Contraloría) REUSANDO @obs/ingest en el ORDEN LOCKED de Fase 5 — NO `BaseConnector.run`
// (su caché diaria saltaría re-corridas):
//
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host)
//     → fetcher.get({ url, headers: { Accept: application/sparql-results+json } })
//
// `cplt.cl` (cubre `datos.cplt.cl`) ya está en DEFAULT_ALLOWED_SUFFIXES (allowlist.ts líneas 25-26)
// → NO requiere edición. El endpoint responde GET a `${BASE}/sparql?query=${encodeURIComponent(q)}`.
// El CSV bulk (`/catalogos/infoprobidad/csv*`) es backfill-only (timeout en fetch acotado → ruta de
// GitHub Actions, NO Edge) — no se implementa aquí.
//
// NINGÚN import del paquete de modelos de lenguaje (contenido estructurado RDF → sin LLM).

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
 * Error de bloqueo de InfoProbidad/CPLT (HTTP 403/503/timeout). Distinto de un fallo genérico:
 * `runIngestProbidad` lo reconoce para degradar honestamente ese declarante sin abortar la corrida
 * (mirror de `LeylobbyBloqueadaError`).
 */
export class InfoProbidadBloqueadaError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`InfoProbidad bloqueó el fetch (HTTP ${status}): ${url}`);
    this.name = "InfoProbidadBloqueadaError";
  }
}

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface InfoProbidadConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validación SSRF (default: sufijos gubernamentales — cubre cplt.cl). */
  allowlist?: AllowlistOptions;
}

const BASE = "https://datos.cplt.cl";

/**
 * Header-set para el endpoint SPARQL de CPLT (Virtuoso). El UA mantiene el sufijo identificatorio
 * `Bot-Ciudadano/1.0` (ingesta respetuosa, PROJECT.md).
 */
export const SPARQL_HEADERS_INFOPROBIDAD: Readonly<Record<string, string>> = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
  Accept: "application/sparql-results+json",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
});

/**
 * Conector SPARQL de InfoProbidad: arma la URL del endpoint con la query encodeada y fetchea el
 * SPARQL-JSON crudo, reusando @obs/ingest en el ORDEN LOCKED. NUNCA `BaseConnector.run`.
 */
export class InfoProbidadConnector {
  constructor(private readonly deps: InfoProbidadConnectorDeps) {}

  /** URL del endpoint SPARQL con la query encodeada (GET). */
  urlSparql(query: string): string {
    return `${BASE}/sparql?query=${encodeURIComponent(query)}`;
  }

  /**
   * Fetch de UN recurso SPARQL reusando la política de @obs/ingest en el ORDEN LOCKED, enviando el
   * header-set identificatorio + `Accept: application/sparql-results+json`. Devuelve el body como
   * string. Un 403/503 (o timeout mapeado a FetchError) se relanza como `InfoProbidadBloqueadaError`.
   */
  private async fetch(url: string): Promise<string> {
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (cplt.cl)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (LOCKED)
    try {
      const body = await this.deps.fetcher.get({
        url,
        headers: { ...SPARQL_HEADERS_INFOPROBIDAD },
      });
      return new TextDecoder().decode(body);
    } catch (err) {
      if (err instanceof FetchError && (err.status === 403 || err.status === 503)) {
        throw new InfoProbidadBloqueadaError(url, err.status);
      }
      throw err;
    }
  }

  /** Fetch del SPARQL-JSON de una query (la query la arma `sparql.ts`). Devuelve el JSON parseado. */
  async fetchSparql(query: string): Promise<unknown> {
    const url = this.urlSparql(query);
    const txt = await this.fetch(url);
    // `JSON.parse` nativo entrega el documento SPARQL-results (NO una lib RDF). Un JSON inválido
    // propaga como SyntaxError → el orquestador lo trata como error de ese recurso (no fabrica).
    return JSON.parse(txt);
  }
}
