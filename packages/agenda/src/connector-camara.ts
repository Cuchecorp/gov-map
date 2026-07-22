// connector-camara — fetch de las citaciones de la Cámara (`www.camara.cl`) REUSANDO
// @obs/ingest, con el header-set de navegador anti-Cloudflare (T-06-07).
//
// REUSA la política de @obs/ingest (rate-limit 2-3s + robots + UA + SSRF allowlist) en el
// ORDEN LOCKED de Fase 5 — NO `BaseConnector.run` (su caché diaria saltaría re-corridas):
//
//   assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host)
//     → fetcher.get({ url, headers: BROWSER_HEADERS_CAMARA })
//
// El conector solo FETCHEA (el parser `parseCamaraCitaciones` vive en 06-02). Cobertura
// completa = enumeración de semanas ISO (`prmSemanaParam` de 06-02): cada semana es un GET
// a `citaciones_semana.aspx?prmSemana={año}-{semana}` (el listado anual `citaciones_todas`
// da 403 WAF → NO se usa). La tabla de sala de Cámara NO tiene fuente estructurada: el único
// artefacto es un PDF (`verDoc.aspx?prmTipo=TABLASEMANAL`) → `fetchPdfTabla()` solo expone la
// URL + content_type para la DEGRADACIÓN HONESTA (no parsea el PDF, no fabrica filas).

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  FetchError,
  type AllowlistOptions,
} from "@obs/ingest";
import { prmSemanaParam } from "./semana-iso";
import { BROWSER_HEADERS_CAMARA } from "./headers-camara";

/** Error de robots.txt que prohíbe el fetch (el caller decide; no se reintenta acá). */
export class RobotsDisallowError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt prohíbe ${url}`);
    this.name = "RobotsDisallowError";
  }
}

/**
 * Error de bloqueo del WAF de Cloudflare (HTTP 403) en `www.camara.cl`. Distinto de un fallo
 * genérico: `runIngest` lo reconoce para degradar la fuente Cámara (backoff → marcar no
 * disponible) sin abortar la corrida del Senado.
 */
export class CamaraBloqueadaError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`Cámara bloqueó el fetch (HTTP ${status}): ${url}`);
    this.name = "CamaraBloqueadaError";
  }
}

/** Colaboradores inyectables (reuso de la política de @obs/ingest). */
export interface CitacionesCamaraConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validación SSRF (default: sufijos gubernamentales — cubre camara.cl). */
  allowlist?: AllowlistOptions;
}

const BASE = "https://www.camara.cl/legislacion/comisiones";
/** URL del PDF de la tabla semanal de sala (`prmId=0` = la semanal vigente). Es a la vez
 *  la fuente de la ingesta DeepSeek-desde-PDF y el enlace de procedencia mostrado. */
export const CAMARA_TABLA_PDF_URL =
  "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL";
/** Referer que el WAF de Cloudflare EXIGE para `verDoc.aspx?prmTipo=TABLASEMANAL` (verificado
 *  LIVE 2026-06-23): sin él el verDoc da 403 aunque el header-set de navegador esté completo. */
const CAMARA_TABLA_REFERER =
  "https://www.camara.cl/legislacion/sala_sesiones/tabla.aspx";

/**
 * Conector de citaciones de la Cámara: por cada semana ISO arma la URL de
 * `citaciones_semana.aspx` y fetchea el HTML crudo con el header-set anti-Cloudflare,
 * reusando @obs/ingest en el ORDEN LOCKED. NUNCA `BaseConnector.run`.
 */
export class CitacionesCamaraConnector {
  constructor(private readonly deps: CitacionesCamaraConnectorDeps) {}

  /** URL de citaciones de una semana ISO (`prmSemana={año}-{semana}`, sin padding). */
  urlSemana(year: number, week: number): string {
    return `${BASE}/citaciones_semana.aspx?prmSemana=${encodeURIComponent(
      prmSemanaParam(year, week),
    )}`;
  }

  /**
   * Fetch de UN recurso reusando la política de @obs/ingest en el ORDEN LOCKED, enviando el
   * header-set de navegador anti-Cloudflare (+ headers extra opcionales). Devuelve los bytes
   * crudos. Un 403 del WAF se relanza como `CamaraBloqueadaError` (lo demás propaga el error
   * original). El caller decide si decodificar a texto (HTML) o tratarlos como binario (PDF).
   */
  private async fetchBytes(
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<Uint8Array> {
    const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (T-06-08)
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (T-06-07)
    try {
      return await this.deps.fetcher.get({
        url,
        headers: { ...BROWSER_HEADERS_CAMARA, ...extraHeaders }, // header-set anti-Cloudflare (T-06-07)
      });
    } catch (err) {
      if (err instanceof FetchError && err.status === 403) {
        throw new CamaraBloqueadaError(url, 403);
      }
      throw err;
    }
  }

  /**
   * Fetch de los BYTES crudos del HTML de citaciones de una semana ISO. Se expone aparte de
   * `fetchSemana` para que el caller pueda persistir el crudo content-addressed en R2 (Etapa 1
   * LOCKED, espejo de `fetchTablaSalaPdf`) ANTES de decodificar+parsear (Etapa 2). Un 403 del WAF
   * se relanza como `CamaraBloqueadaError` (igual que `fetchSemana`).
   */
  async fetchSemanaBytes(year: number, week: number): Promise<Uint8Array> {
    return this.fetchBytes(this.urlSemana(year, week));
  }

  /** Fetch del HTML de citaciones de una semana ISO (decodifica los bytes crudos). */
  async fetchSemana(year: number, week: number): Promise<string> {
    const bytes = await this.fetchSemanaBytes(year, week);
    return new TextDecoder().decode(bytes);
  }

  /**
   * Fetch de la tabla semanal de sala de la Cámara como PDF crudo (`verDoc.aspx?prmTipo=
   * TABLASEMANAL`, `prmId=0` = la vigente). Devuelve los BYTES del PDF (no string) para que el
   * caller los persista crudos en R2 (etapa 1) y extraiga su capa de texto (unpdf) en la etapa 2.
   *
   * El verDoc exige el `Referer` de la página de tabla además del header-set anti-Cloudflare
   * (verificado LIVE 2026-06-23); sin él da 403. Un 403 persistente se relanza como
   * `CamaraBloqueadaError` para que el caller DEGRADE honesto al enlace PDF (no fabrica filas).
   */
  async fetchTablaSalaPdf(): Promise<Uint8Array> {
    return this.fetchBytes(CAMARA_TABLA_PDF_URL, { Referer: CAMARA_TABLA_REFERER });
  }

  /**
   * URL del PDF oficial de la tabla de sala + content_type, para la DEGRADACIÓN HONESTA cuando la
   * ingesta DeepSeek-desde-PDF no produce filas (fetch 403 / PDF escaneado / RUT). No emite request.
   */
  fetchPdfTabla(): { url: string; content_type: string } {
    return { url: CAMARA_TABLA_PDF_URL, content_type: "application/pdf" };
  }
}
