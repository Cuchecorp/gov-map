/**
 * Gate de rate-limit DURABLE por host (CR-02).
 *
 * Implementa la AUTORIDAD del "2-3s entre requests al MISMO origen" sobre estado
 * compartido (Postgres), no memoria del isolate. El HostRateLimiter en proceso
 * solo serializa dentro de un batch; este gate serializa CROSS-INVOCACION: cada
 * Edge Function isolate consulta+reserva el slot del host en la tabla
 * util_host_throttle (via la funcion util.reserve_host_slot) antes de pedir.
 *
 * Contrato `reserve(host)`:
 *   - RPC reserva atomicamente el slot y devuelve los ms a esperar.
 *   - Si la espera supera `maxWaitMs`, lanza para que el worker NO-ackee y el
 *     mensaje reaparezca via vt (backoff diferido) en vez de bloquear el isolate
 *     mas alla de los limites de Edge Functions.
 *   - Si la espera es <= maxWaitMs, duerme ese tiempo y reintenta la reserva.
 */

/** RPC inyectable: invoca util.reserve_host_slot y devuelve ms a esperar. */
export interface ReserveSlotRpc {
  reserveHostSlot(host: string, minIntervalMs: number): Promise<number>;
}

export interface HostThrottleOptions {
  /** Intervalo minimo por host. Default 2000ms (LOCKED 2-3s). */
  minIntervalMs?: number;
  /**
   * Espera maxima en proceso antes de diferir via no-ack. Default 5000ms:
   * si el slot esta mas lejos que esto, conviene devolver el mensaje a la cola.
   */
  maxWaitMs?: number;
  /** sleep inyectable para tests. Default setTimeout. */
  sleepFn?: (ms: number) => Promise<void>;
}

/** Senaliza "el host esta ocupado mas alla de maxWait => diferir via cola". */
export class ThrottleDeferError extends Error {
  constructor(readonly host: string, readonly waitMs: number) {
    super(`host ${host} throttled: esperar ${waitMs}ms supera el maximo en proceso`);
    this.name = "ThrottleDeferError";
  }
}

const DEFAULT_MIN_INTERVAL = 2000;
const DEFAULT_MAX_WAIT = 5000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class PgHostThrottle {
  private readonly minIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(
    private readonly rpc: ReserveSlotRpc,
    opts: HostThrottleOptions = {},
  ) {
    this.minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL;
    this.maxWaitMs = opts.maxWaitMs ?? DEFAULT_MAX_WAIT;
    this.sleepFn = opts.sleepFn ?? defaultSleep;
  }

  /**
   * Reserva el slot del host contra el gate durable. Resuelve cuando el slot
   * quedo reservado para este caller. Lanza ThrottleDeferError si la espera
   * necesaria supera maxWaitMs (el worker debe NO-ackear => backoff via vt).
   */
  async reserve(host: string): Promise<void> {
    // Un solo reintento: la primera reserva o devuelve 0 (ya), o devuelve el
    // remanente; tras dormir ese remanente, la segunda debe reservar.
    for (let attempt = 0; attempt < 2; attempt++) {
      const waitMs = await this.rpc.reserveHostSlot(host, this.minIntervalMs);
      if (waitMs <= 0) return;
      if (waitMs > this.maxWaitMs) {
        throw new ThrottleDeferError(host, waitMs);
      }
      await this.sleepFn(waitMs);
    }
    // Tras esperar el remanente, intentar una ultima reserva definitiva.
    const finalWait = await this.rpc.reserveHostSlot(host, this.minIntervalMs);
    if (finalWait > 0) {
      throw new ThrottleDeferError(host, finalWait);
    }
  }
}
