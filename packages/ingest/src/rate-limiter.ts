/**
 * Rate-limiter SERIAL POR HOST (FND-01).
 *
 * La politica de "esperar 2-3s entre requests al MISMO origen" vive AQUI, una
 * sola vez. Ningun conector la reescribe (anti-patron: rate-limit copy-pasteado
 * por conector -> divergencia y baneos por WAF gubernamental).
 *
 * Cada host tiene su propia cola: requests a hosts distintos NO se serializan
 * entre si. Dentro de un mismo host, cada `wait(host)` se encadena tras el
 * anterior y espera hasta que hayan pasado >= minDelay (+ jitter) desde el
 * ultimo request a ese host.
 */

export interface RateLimiterOptions {
  /** Delay minimo entre requests al mismo host. Default 2000ms (LOCKED 2-3s). */
  minDelayMs?: number;
  /** Jitter adicional aleatorio [0, jitterMs]. Default 1000ms => rango 2-3s. */
  jitterMs?: number;
}

const DEFAULT_MIN_DELAY = 2000;
const DEFAULT_JITTER = 1000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class HostRateLimiter {
  private readonly minDelayMs: number;
  private readonly jitterMs: number;
  /** Cola por host: promesa que resuelve cuando el host queda libre. */
  private readonly queues = new Map<string, Promise<void>>();

  constructor(opts: RateLimiterOptions = {}) {
    this.minDelayMs = opts.minDelayMs ?? DEFAULT_MIN_DELAY;
    this.jitterMs = opts.jitterMs ?? DEFAULT_JITTER;
  }

  /**
   * Espera el turno para el `host` dado. El primer request a un host resuelve
   * de inmediato; los siguientes esperan minDelay (+ jitter) desde el anterior.
   */
  wait(host: string): Promise<void> {
    // Determina sincronicamente si es el primer request de este host: el
    // primero no espera, los siguientes pagan minDelay + jitter.
    const isFirst = !this.queues.has(host);
    const prev = this.queues.get(host) ?? Promise.resolve();
    const delay = isFirst ? 0 : this.minDelayMs + this.randomJitter();
    // Encadena: el nuevo turno empieza cuando el anterior termino de esperar.
    const next = prev.then(() => sleep(delay));
    this.queues.set(host, next);
    return next;
  }

  private randomJitter(): number {
    return this.jitterMs > 0 ? Math.random() * this.jitterMs : 0;
  }
}
