// connector-chilecompra — fetch del REST/JSON de ChileCompra (api.mercadopublico.cl) REUSANDO
// @obs/ingest en el ORDEN LOCKED — NO `BaseConnector.run` (su cache diaria saltaria re-corridas):
//
//   assertAllowedUrl(url) -> robots.isAllowed(url) -> rateLimiter.wait(host)
//     -> fetcher.get({ url, headers: HEADERS_CHILECOMPRA })
//
// `mercadopublico.cl` ya esta en DEFAULT_ALLOWED_SUFFIXES (allowlist.ts:27) y cubre
// `api.mercadopublico.cl` como subdominio -> NO requiere edicion del allowlist.
//
// FLUJO DE 2 PASOS OBLIGATORIO (la API NO filtra ordenes por RUT):
//   buscarProveedor(rut, ticket)        -> { CodigoEmpresa, NombreEmpresa }
//   ordenesDeCompra(codigo, dia, ticket) -> { Cantidad, Listado }
//
// El `ticket` es un secreto de operador: NUNCA se interpola en mensajes de error (solo se propaga
// el status). NINGUN import del paquete de modelos de lenguaje (JSON estructurado -> sin LLM).

import {
  Fetcher,
  HostRateLimiter,
  RobotsGuard,
  assertAllowedUrl,
  FetchError,
  RetryableError,
  HostNotAllowedError,
  type AllowlistOptions,
} from "@obs/ingest";
import { urlBuscarProveedor, urlOrdenesDeCompra, redactarTicket } from "./query";

/** Error de robots.txt que prohibe el fetch (el caller decide; no se reintenta aca). */
export class RobotsDisallowError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt prohibe ${url}`);
    this.name = "RobotsDisallowError";
  }
}

/**
 * Error de bloqueo de ChileCompra (HTTP 403/503/429 — rate-limit del WAF o ticket agotado).
 * `runIngestDinero` lo reconoce para degradar honestamente ESE RUT sin abortar la corrida (mirror
 * de `InfoProbidadBloqueadaError`). NUNCA incluye el ticket en el mensaje.
 */
export class ChileCompraBloqueadaError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    // No interpolar el ticket: el `url` ya viene saneado por el caller (sin querystring sensible).
    super(`ChileCompra bloqueo el fetch (HTTP ${status})`);
    this.name = "ChileCompraBloqueadaError";
  }
}

/** Colaboradores inyectables (reuso de la politica de @obs/ingest). */
export interface ChileCompraConnectorDeps {
  fetcher: Fetcher;
  rateLimiter: HostRateLimiter;
  robots: RobotsGuard;
  /** Allowlist para la validacion SSRF (default: sufijos gubernamentales — cubre mercadopublico.cl). */
  allowlist?: AllowlistOptions;
}

/**
 * Header-set para el endpoint REST de ChileCompra. El UA mantiene el sufijo identificatorio
 * `Bot-Ciudadano/1.0` (ingesta respetuosa, PROJECT.md). `Accept: application/json`.
 */
export const HEADERS_CHILECOMPRA: Readonly<Record<string, string>> = Object.freeze({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36 Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
  Accept: "application/json",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
});

/** Saneo del URL para los mensajes de error: corta la querystring (lleva el ticket). */
function urlSinQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

/**
 * Conector REST de ChileCompra. Arma las URLs con `query.ts` y fetchea el JSON crudo reusando
 * @obs/ingest en el ORDEN LOCKED. NUNCA `BaseConnector.run`. NUNCA interpola el ticket en errores.
 */
export class ChileCompraConnector {
  constructor(private readonly deps: ChileCompraConnectorDeps) {}

  /**
   * Fetch de UN recurso REST reusando la politica de @obs/ingest en el ORDEN LOCKED, enviando el
   * header-set identificatorio + `Accept: application/json`. Devuelve el JSON parseado. Un
   * 403/503/429 se relanza como `ChileCompraBloqueadaError` (degradacion honesta), sin el ticket.
   */
  private async fetchJson(url: string): Promise<unknown> {
    // SSRF + allowlist. OJO (CR-01): `assertAllowedUrl` lanza `HostNotAllowedError` con la URL
    // CRUDA (incluye `&ticket=<SECRET>`) -> va dentro del try para sanear ANTES de propagar.
    let parsed: URL;
    try {
      parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist (mercadopublico.cl)
    } catch (err) {
      if (err instanceof HostNotAllowedError) {
        // Saneo: nunca propagar la URL cruda con el ticket; solo el host/scheme sin querystring.
        throw new Error(`ChileCompra host no permitido: ${urlSinQuery(url)}`);
      }
      throw err; // URL malformada u otro error sin la URL en el mensaje.
    }
    if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(urlSinQuery(url));
    await this.deps.rateLimiter.wait(parsed.host); // 2-3s serial por host (LOCKED)
    try {
      const body = await this.deps.fetcher.get({ url, headers: { ...HEADERS_CHILECOMPRA } });
      const txt = new TextDecoder().decode(body);
      // `JSON.parse` nativo; un JSON invalido propaga como SyntaxError (no fabrica).
      return JSON.parse(txt);
    } catch (err) {
      // CR-01: TODO error HTTP (no solo 403/429/503) lleva la URL con el ticket en `.message`
      // (FetchError/RetryableError interpolan la URL cruda). Se saneA SIEMPRE antes de propagar.
      // 403 llega como FetchError; 429/503 como RetryableError (rate-limit / ticket agotado).
      if (err instanceof FetchError) {
        throw new ChileCompraBloqueadaError(urlSinQuery(url), err.status);
      }
      // Cualquier otro retryable (5xx, etc.): degradacion honesta sin ticket.
      if (err instanceof RetryableError) {
        throw new ChileCompraBloqueadaError(urlSinQuery(url), err.status);
      }
      // Errores sin URL (p.ej. SyntaxError de JSON.parse) ya son ticket-free, pero saneamos el
      // mensaje de forma defensiva por si alguna capa intermedia hubiese interpolado la URL.
      if (err instanceof Error) {
        err.message = redactarTicket(err.message);
      }
      throw err;
    }
  }

  /** Paso 1: resuelve un RUT de empresa a su `CodigoEmpresa`. Devuelve el JSON crudo. */
  async buscarProveedor(rut: string, ticket: string): Promise<unknown> {
    return this.fetchJson(urlBuscarProveedor(rut, ticket));
  }

  /** Paso 2: ordenes de compra de un `CodigoProveedor` en UN dia (`ddmmaaaa`). JSON crudo. */
  async ordenesDeCompra(codigoProveedor: string, ddmmaaaa: string, ticket: string): Promise<unknown> {
    return this.fetchJson(urlOrdenesDeCompra(codigoProveedor, ddmmaaaa, ticket));
  }
}
