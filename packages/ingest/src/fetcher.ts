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

/** Spec minima de request que el fetcher consume. */
export interface FetchSpec {
  url: string;
  host: string;
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
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export class Fetcher {
  private readonly fetchFn: typeof fetch;
  private readonly ua: string;

  constructor(opts: FetcherOptions = {}) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.ua = opts.ua ?? IDENTIFIED_UA;
  }

  /**
   * GET del recurso. 200 => Uint8Array del body. 429/5xx => RetryableError
   * (sin body, para backoff diferido). Otros !ok => FetchError.
   */
  async get(spec: FetchSpec): Promise<Uint8Array> {
    const res = await this.fetchFn(spec.url, {
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
