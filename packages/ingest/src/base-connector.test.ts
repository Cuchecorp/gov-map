import { describe, expect, it, vi } from "vitest";
import { DummyConnector } from "./dummy-connector";
import type { ConnectorDeps, RequestSpec } from "./base-connector";

/** Construye un set de deps mock con spies que registran el orden de llamada. */
function makeDeps(overrides: Partial<{
  hasToday: boolean;
  isAllowed: boolean;
  driftChanged: boolean;
}> = {}) {
  const order: string[] = [];
  const opts = { hasToday: false, isAllowed: true, driftChanged: false, ...overrides };

  const deps: ConnectorDeps = {
    cache: {
      dailyKey: vi.fn(async () => "cache-key-abc"),
      hasToday: vi.fn(async () => {
        order.push("cache.hasToday");
        return opts.hasToday;
      }),
    },
    robots: {
      isAllowed: vi.fn(async () => {
        order.push("robots.isAllowed");
        return opts.isAllowed;
      }),
    },
    rateLimiter: {
      wait: vi.fn(async () => {
        order.push("rateLimiter.wait");
      }),
    },
    fetcher: {
      get: vi.fn(async () => {
        order.push("fetcher.get");
        return new TextEncoder().encode(JSON.stringify({ ok: true, data: [1] }));
      }),
    },
    drift: {
      check: vi.fn(async (_s, _r, fp: string) => {
        order.push("drift.check");
        return { changed: opts.driftChanged, prevFingerprint: "old", newFingerprint: fp };
      }),
      alert: vi.fn(async () => {
        order.push("drift.alert");
      }),
    },
    r2: {
      putImmutable: vi.fn(async (source: string, resource: string, date: string, sha: string) => {
        order.push("r2.putImmutable");
        return `${source}/${resource}/${date}/${sha}.json`;
      }),
    },
    snapshot: {
      write: vi.fn(async (input) => {
        order.push("snapshot.write");
        return { snapshotId: 1, r2Path: input.r2Path, contentHash: input.contentHash };
      }),
    },
    log: { skip: vi.fn(async () => { order.push("log.skip"); }) },
    now: () => new Date("2026-06-17T12:00:00Z"),
  };
  return { deps, order };
}

const RUN_CTX = {
  id: 1,
  source: "dummy",
  startedAt: "2026-06-17T12:00:00Z",
  status: "running" as const,
  stats: {},
};

describe("BaseConnector via DummyConnector", () => {
  it("Test 1: orden invariante cache->robots->rateLimiter->fetcher->drift->r2->snapshot", async () => {
    const { deps, order } = makeDeps();
    const refs = await new DummyConnector(deps).run(RUN_CTX);
    expect(refs.length).toBe(1);
    expect(order).toEqual([
      "cache.hasToday",
      "robots.isAllowed",
      "rateLimiter.wait",
      "fetcher.get",
      "drift.check",
      "r2.putImmutable",
      "snapshot.write",
    ]);
  });

  it("Test 2: cache hit => NO llama robots, rateLimiter ni fetcher (FND-03)", async () => {
    const { deps, order } = makeDeps({ hasToday: true });
    const refs = await new DummyConnector(deps).run(RUN_CTX);
    expect(refs.length).toBe(0);
    expect(order).toEqual(["cache.hasToday"]);
    expect(deps.robots.isAllowed).not.toHaveBeenCalled();
    expect(deps.rateLimiter.wait).not.toHaveBeenCalled();
    expect(deps.fetcher.get).not.toHaveBeenCalled();
  });

  it("Test 3: robots disallow => salta con log y NO hace fetch (FND-01)", async () => {
    const { deps, order } = makeDeps({ isAllowed: false });
    const refs = await new DummyConnector(deps).run(RUN_CTX);
    expect(refs.length).toBe(0);
    expect(deps.fetcher.get).not.toHaveBeenCalled();
    expect(deps.rateLimiter.wait).not.toHaveBeenCalled();
    expect(deps.log.skip).toHaveBeenCalled();
    expect(order).toContain("log.skip");
  });

  it("Test 4: drift changed => igual escribe a R2 y crea snapshot (FND-04)", async () => {
    const { deps, order } = makeDeps({ driftChanged: true });
    const refs = await new DummyConnector(deps).run(RUN_CTX);
    expect(refs.length).toBe(1);
    expect(deps.drift.alert).toHaveBeenCalledTimes(1);
    // La ingesta NO se detiene: r2 + snapshot ocurren despues del alert.
    expect(order).toContain("drift.alert");
    expect(order).toContain("r2.putImmutable");
    expect(order).toContain("snapshot.write");
    expect(order.indexOf("drift.alert")).toBeLessThan(order.indexOf("r2.putImmutable"));
  });

  it("Test 5: E2E dummy retorna SnapshotRef con r2Path y contentHash + provenance", async () => {
    const { deps } = makeDeps();
    const refs = await new DummyConnector(deps).run(RUN_CTX);
    expect(refs[0]!.r2Path).toMatch(/^dummy\/.+\/2026-06-17\/[0-9a-f]{64}\.json$/);
    expect(refs[0]!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    // Provenance capturada al ingestar: el snapshot.write recibio la provenance.
    const writeArg = (deps.snapshot.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(writeArg.provenance.source).toBe("dummy");
    expect(writeArg.provenance.sourceUrl).toContain("http");
    expect(writeArg.provenance.fetchedAt).toBeTruthy();
  });

  it("rateLimiter.wait es parte del flujo invariante (no opcional) en el camino feliz", async () => {
    const { deps } = makeDeps();
    await new DummyConnector(deps).run(RUN_CTX);
    expect(deps.rateLimiter.wait).toHaveBeenCalledWith(expect.any(String));
  });

  it("WR-01: el host de rate-limit se DERIVA de la URL (no de spec.host)", async () => {
    const { deps } = makeDeps();
    await new DummyConnector(deps).run(RUN_CTX);
    // El DummyConnector pide https://dummy.local/echo => host derivado dummy.local.
    expect(deps.rateLimiter.wait).toHaveBeenCalledWith("dummy.local");
  });

  it("CR-02: hostThrottle (gate durable) corre ANTES del rateLimiter en proceso", async () => {
    const { deps, order } = makeDeps();
    deps.hostThrottle = {
      reserve: vi.fn(async (host: string) => {
        order.push(`hostThrottle.reserve:${host}`);
      }),
    };
    await new DummyConnector(deps).run(RUN_CTX);
    expect(order).toContain("hostThrottle.reserve:dummy.local");
    expect(order.indexOf("hostThrottle.reserve:dummy.local")).toBeLessThan(
      order.indexOf("rateLimiter.wait"),
    );
    expect(order.indexOf("rateLimiter.wait")).toBeLessThan(order.indexOf("fetcher.get"));
  });

  it("CR-02: si hostThrottle.reserve lanza (diferir), NO se hace fetch", async () => {
    const { deps } = makeDeps();
    deps.hostThrottle = {
      reserve: vi.fn(async () => {
        throw new Error("ThrottleDefer");
      }),
    };
    await expect(new DummyConnector(deps).run(RUN_CTX)).rejects.toThrow();
    expect(deps.fetcher.get).not.toHaveBeenCalled();
  });
});

// Type-only check: RequestSpec sigue exportado con la forma esperada.
const _spec: RequestSpec = { url: "https://x", host: "x", resource: "r", key: "k" };
void _spec;
