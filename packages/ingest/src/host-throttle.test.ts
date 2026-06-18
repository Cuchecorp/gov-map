import { describe, expect, it, vi } from "vitest";
import { PgHostThrottle, ThrottleDeferError } from "./host-throttle";

/** RPC mock que devuelve una secuencia de ms-a-esperar por llamada. */
function rpcReturning(seq: number[]) {
  const calls: Array<{ host: string; minIntervalMs: number }> = [];
  let i = 0;
  return {
    calls,
    rpc: {
      async reserveHostSlot(host: string, minIntervalMs: number): Promise<number> {
        calls.push({ host, minIntervalMs });
        return seq[i++] ?? 0;
      },
    },
  };
}

describe("PgHostThrottle (CR-02)", () => {
  it("slot libre (RPC=0) => reserva inmediata, sin sleep", async () => {
    const { rpc, calls } = rpcReturning([0]);
    const sleep = vi.fn(async () => {});
    const throttle = new PgHostThrottle(rpc, { sleepFn: sleep });

    await throttle.reserve("www.camara.cl");

    expect(calls.length).toBe(1);
    expect(calls[0]!.minIntervalMs).toBe(2000);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("slot ocupado (RPC=remanente) => duerme ese tiempo y reserva al 2do intento", async () => {
    // 1er reserve: faltan 1200ms; tras dormir, 2do reserve: 0 (ya).
    const { rpc, calls } = rpcReturning([1200, 0]);
    const sleep = vi.fn(async () => {});
    const throttle = new PgHostThrottle(rpc, { sleepFn: sleep });

    await throttle.reserve("www.camara.cl");

    expect(sleep).toHaveBeenCalledWith(1200);
    expect(calls.length).toBe(2);
  });

  it("espera mayor a maxWaitMs => ThrottleDeferError (diferir via cola, no bloquear)", async () => {
    const { rpc } = rpcReturning([9000]); // 9s > maxWait 5s por defecto
    const sleep = vi.fn(async () => {});
    const throttle = new PgHostThrottle(rpc, { sleepFn: sleep });

    await expect(throttle.reserve("www.camara.cl")).rejects.toBeInstanceOf(
      ThrottleDeferError,
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("el gate es la autoridad cross-invocacion: cada reserve consulta el estado durable", async () => {
    // Simula dos 'isolates' compartiendo el mismo estado (la misma RPC mock):
    // el primero reserva (0), el segundo ve el host ocupado (remanente) y difiere.
    const { rpc } = rpcReturning([0, 9000]);
    const sleep = vi.fn(async () => {});
    const throttle = new PgHostThrottle(rpc, { sleepFn: sleep, maxWaitMs: 5000 });

    await throttle.reserve("www.camara.cl"); // isolate 1: ok
    await expect(throttle.reserve("www.camara.cl")).rejects.toBeInstanceOf(
      ThrottleDeferError,
    ); // isolate 2: difiere
  });
});
