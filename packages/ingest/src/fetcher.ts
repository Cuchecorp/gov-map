/**
 * Fetcher de ingesta (FND-01, FND-05).
 *
 * Setea el User-Agent identificatorio LOCKED en cada request
 * ("Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
 * fuente unica en robots.ts via IDENTIFIED_UA). Ante 429/5xx
 * lanza `RetryableError` (NO devuelve body) para que el no-ack de la cola
 * pgmq dispare el backoff via visibility timeout (reintento diferido). Ante
 * 200 devuelve el body crudo como Uint8Array.
 */
import { IDENTIFIED_UA } from "./robots";
import {
  type AllowlistOptions,
  assertAllowedUrl,
  HostNotAllowedError,
} from "./allowlist";

/**
 * Spec minima de request que el fetcher consume.
 *
 * `host` es derivado/redundante: el fetcher NO confia en el — el host efectivo
 * sale SIEMPRE de `new URL(url)` (ver WR-01). Se conserva opcional por
 * compatibilidad con specs existentes.
 */
export interface FetchSpec {
  url: string;
  host?: string;
  params?: Record<string, unknown>;
}

/**
 * Error que senaliza "reintenta luego" (429/5xx). El worker NO debe hacer ack
 * en la cola: el mensaje reaparece al expirar el visibility timeout (backoff).
 */
export class RetryableError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    // No incluir headers de auth ni credenciales en el mensaje (T-01-06).
    super(`fetch ${url} -> ${status} (retryable)`);
    this.name = "RetryableError";
  }
}

/** Error no recuperable (4xx distinto de 429). */
export class FetchError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`fetch ${url} -> ${status}`);
    this.name = "FetchError";
  }
}

export interface FetcherOptions {
  /** fetch inyectable para tests sin red. Default: fetch global. */
  fetchFn?: typeof fetch;
  /** UA con el que se identifica el bot. Default: IDENTIFIED_UA. */
  ua?: string;
  /** Allowlist de origenes (CR-03). Default: sufijos gubernamentales. */
  allowlist?: AllowlistOptions;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export class Fetcher {
  private readonly fetchFn: typeof fetch;
  private readonly ua: string;
  private readonly allowlist: AllowlistOptions;

  constructor(opts: FetcherOptions = {}) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.ua = opts.ua ?? IDENTIFIED_UA;
    this.allowlist = opts.allowlist ?? {};
  }

  /**
   * GET del recurso. 200 => Uint8Array del body. 429/5xx => RetryableError
   * (sin body, para backoff diferido). Otros !ok => FetchError.
   *
   * Defensa SSRF (CR-03): antes de cualquier red valida la URL contra el
   * allowlist gubernamental + bloqueo de targets internos. Host no permitido =>
   * HostNotAllowedError (no se emite ningun request).
   */
  async get(spec: FetchSpec): Promise<Uint8Array> {
    // CR-03 / WR-01: el host efectivo sale de la URL real, nunca de spec.host.
    const url = assertAllowedUrl(spec.url, this.allowlist);
    const res = await this.fetchFn(url.toString(), {
      method: "GET",
      headers: { "User-Agent": this.ua },
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
    if (isRetryableStatus(res.status)) {
      throw new RetryableError(res.status, spec.url);
    }
    throw new FetchError(res.status, spec.url);
  }
}
