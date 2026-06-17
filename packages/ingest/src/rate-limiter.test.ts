import { afterEach, describe, expect, it, vi } from "vitest";
import { HostRateLimiter } from "./rate-limiter";

describe("HostRateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Test 1: serializa dos requests al MISMO host con >=2000ms entre resoluciones", async () => {
    vi.useFakeTimers();
    // jitter=0 para un delay determinista de exactamente minDelay.
    const rl = new HostRateLimiter({ minDelayMs: 2000, jitterMs: 0 });

    const resolved: number[] = [];
    const p1 = rl.wait("camara.cl").then(() => resolved.push(Date.now()));
    const p2 = rl.wait("camara.cl").then(() => resolved.push(Date.now()));

    // La primera resuelve inmediato (primer request al host).
    await vi.advanceTimersByTimeAsync(0);
    await p1;
    expect(resolved.length).toBe(1);
    const firstAt = resolved[0]!;

    // La segunda debe esperar >=2000ms desde la primera.
    await vi.advanceTimersByTimeAsync(2000);
    await p2;
    expect(resolved.length).toBe(2);
    const secondAt = resolved[1]!;
    expect(secondAt - firstAt).toBeGreaterThanOrEqual(2000);
  });

  it("Test 2: hosts DISTINTOS no se serializan entre si (cola por host)", async () => {
    vi.useFakeTimers();
    const rl = new HostRateLimiter({ minDelayMs: 2000, jitterMs: 0 });

    const order: string[] = [];
    // Primer request de cada host resuelve sin espera.
    const a = rl.wait("host-a.cl").then(() => order.push("a"));
    const b = rl.wait("host-b.cl").then(() => order.push("b"));

    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([a, b]);

    // Ambos resolvieron en el tick 0: ninguno serializo contra el otro.
    expect(order).toContain("a");
    expect(order).toContain("b");
    expect(order.length).toBe(2);
  });

  it("aplica jitter dentro del rango [minDelay, minDelay+jitter] (LOCKED 2-3s)", async () => {
    vi.useFakeTimers();
    const rl = new HostRateLimiter({ minDelayMs: 2000, jitterMs: 1000 });
    // Primer request consume su slot.
    const first = rl.wait("h.cl");
    await vi.advanceTimersByTimeAsync(0);
    await first;

    let done = false;
    const second = rl.wait("h.cl").then(() => {
      done = true;
    });
    // Antes de 2000ms nunca debe resolver.
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toBe(false);
    // A los 3000ms (max con jitter) ya debe haber resuelto.
    await vi.advanceTimersByTimeAsync(1001);
    await second;
    expect(done).toBe(true);
  });
});
