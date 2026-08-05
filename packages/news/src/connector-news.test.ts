// connector-news.test.ts — tests estructurales del SC1 (robots + rate-limit + UA + cero
// ráfagas por construcción) y de la parte unitaria del SC2 (key de R2 + caché diaria).
//
// CERO red: todos los colaboradores son dobles inyectados por ConnectorDeps o por el
// `fetchFn` de `buildNewsDeps`. Ningún test instala un fetch global real ni construye
// un Fetcher sin fetchFn inyectado.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DailyCache, type ConnectorDeps, type RequestSpec } from "@obs/ingest";
import { NewsConnector, buildNewsDeps, NewsCacheRequeridaError } from "./connector-news";
import { FEEDS } from "./feeds";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "__fixtures__");

function fixtureXml(slug: string): string {
  return readFileSync(join(FIXTURES_DIR, `${slug}.xml`), "utf-8");
}

const NOW = () => new Date("2026-08-05T12:00:00Z");

const RUN_CTX = {
  id: 1,
  source: "news",
  startedAt: "2026-08-05T12:00:00Z",
  status: "running" as const,
  stats: {},
};

/** Construye ConnectorDeps con dobles que registran una traza de eventos. */
function makeDeps(
  overrides: Partial<{
    hasTodaySlugs: Set<string>;
    isAllowedSlugs: Set<string> | "all" | "none";
  }> = {},
) {
  const order: string[] = [];
  const opts = { hasTodaySlugs: new Set<string>(), isAllowedSlugs: "all" as const, ...overrides };

  function slugFromSpec(spec: RequestSpec): string {
    const found = FEEDS.find((f) => spec.resource === `rss-${f.slug}`);
    return found?.slug ?? spec.key;
  }

  const fetcherCalls: string[] = [];

  const deps: ConnectorDeps = {
    cache: {
      dailyKey: vi.fn(async () => "cache-key"),
      hasToday: vi.fn(async (_source, spec: RequestSpec) => {
        const slug = slugFromSpec(spec);
        order.push(`cache.hasToday:${slug}`);
        return opts.hasTodaySlugs.has(slug);
      }),
    },
    robots: {
      isAllowed: vi.fn(async (url: string) => {
        const host = new URL(url).host;
        order.push(`robots.isAllowed:${host}`);
        if (opts.isAllowedSlugs === "all") return true;
        if (opts.isAllowedSlugs === "none") return false;
        const slug = FEEDS.find((f) => new URL(f.url).host === host)?.slug;
        return slug ? opts.isAllowedSlugs.has(slug) : true;
      }),
    },
    rateLimiter: {
      wait: vi.fn(async (host: string) => {
        order.push(`wait:${host}`);
      }),
    },
    fetcher: {
      get: vi.fn(async (spec: RequestSpec) => {
        const host = new URL(spec.url).host;
        order.push(`get:${host}`);
        const slug = slugFromSpec(spec);
        fetcherCalls.push(host);
        return new TextEncoder().encode(fixtureXml(slug));
      }),
    },
    drift: {
      check: vi.fn(async (_s, _r, fp: string) => {
        order.push("drift.check");
        return { changed: false, newFingerprint: fp };
      }),
      alert: vi.fn(async () => {
        order.push("drift.alert");
      }),
    },
    r2: {
      putImmutable: vi.fn(
        async (source: string, resource: string, date: string, sha: string, ext: string, body) => {
          order.push("r2.putImmutable");
          return { r2Path: `${source}/${resource}/${date}/${sha}.${ext}`, existed: false, _body: body };
        },
      ),
    },
    snapshot: {
      write: vi.fn(async (input) => {
        order.push("snapshot.write");
        return { snapshotId: 1, r2Path: input.r2Path, contentHash: input.contentHash };
      }),
    },
    log: { skip: vi.fn(async () => { order.push("log.skip"); }) },
    now: NOW,
  };

  return { deps, order, fetcherCalls };
}

describe("NewsConnector — SC1 (robots + rate-limit + orden)", () => {
  it("SC1-a: rateLimiter.wait se llama 5 veces (una por feed), cada una ANTES de su fetcher.get", async () => {
    const { deps, order } = makeDeps();
    const refs = await new NewsConnector(deps).run(RUN_CTX);
    expect(refs.length).toBe(FEEDS.length);
    expect(deps.rateLimiter.wait).toHaveBeenCalledTimes(5);
    expect(deps.fetcher.get).toHaveBeenCalledTimes(5);

    // Cada wait:<host> precede a su get:<host> correspondiente en la traza.
    for (const f of FEEDS) {
      const host = new URL(f.url).host;
      const waitIdx = order.indexOf(`wait:${host}`);
      const getIdx = order.indexOf(`get:${host}`);
      expect(waitIdx).toBeGreaterThanOrEqual(0);
      expect(getIdx).toBeGreaterThan(waitIdx);
    }
  });

  it("SC1-b: el host usado por rateLimiter/robots es new URL(spec.url).host, no spec.host (WR-01)", async () => {
    const { deps, order } = makeDeps();
    // Endpoint manipulado: spec.host distinto del host real de la URL.
    const spy = vi.spyOn(NewsConnector.prototype as any, "endpoints").mockReturnValue([
      { url: FEEDS[0]!.url, host: "host-falso.invalid", resource: `rss-${FEEDS[0]!.slug}`, key: FEEDS[0]!.slug, ext: "xml" },
    ]);
    try {
      await new NewsConnector(deps).run(RUN_CTX);
      const realHost = new URL(FEEDS[0]!.url).host;
      expect(order).toContain(`wait:${realHost}`);
      expect(order).toContain(`robots.isAllowed:${realHost}`);
      expect(order.some((e) => e.includes("host-falso.invalid"))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("SC1-c: robots disallow para un feed => NO se llama fetcher.get para ese feed y log.skip recibe (spec, 'robots-disallow')", async () => {
    const disallowedSlug = FEEDS[0]!.slug;
    const { deps, fetcherCalls } = makeDeps({ isAllowedSlugs: new Set(FEEDS.slice(1).map((f) => f.slug)) });
    const refs = await new NewsConnector(deps).run(RUN_CTX);
    expect(refs.length).toBe(FEEDS.length - 1);
    const disallowedHost = new URL(FEEDS[0]!.url).host;
    expect(fetcherCalls).not.toContain(disallowedHost);
    expect(deps.log.skip).toHaveBeenCalledWith(
      expect.objectContaining({ resource: `rss-${disallowedSlug}` }),
      "robots-disallow",
    );
  });

  it("SC1-d: fetcher.get nunca se llama para dos feeds sin un rateLimiter.wait intercalado (cero ráfagas)", async () => {
    const { deps, order } = makeDeps();
    await new NewsConnector(deps).run(RUN_CTX);
    const getEvents = order.filter((e) => e.startsWith("get:") || e.startsWith("wait:"));
    // Entre dos "get:" consecutivos siempre debe haber al menos un "wait:".
    for (let i = 0; i < getEvents.length; i++) {
      if (getEvents[i]!.startsWith("get:")) {
        // Busca el "get:" anterior (si existe) y verifica que hay un wait entre medio.
        for (let j = i - 1; j >= 0; j--) {
          if (getEvents[j]!.startsWith("get:")) {
            const between = getEvents.slice(j + 1, i);
            expect(between.some((e) => e.startsWith("wait:"))).toBe(true);
            break;
          }
        }
      }
    }
  });

  it("SC1-e: allowlist scoped — par positivo/negativo vía fetchFn doble (T-132-07), cero red", async () => {
    const requestedUrls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      requestedUrls.push(url);
      return new Response("User-agent: *\nAllow: /", { status: 200 });
    }) as unknown as typeof fetch;

    const feedUrl = FEEDS[0]!.url;
    const feedHost = new URL(feedUrl).host;

    // Caso CORRECTO: allowlistNews() (default de buildNewsDeps).
    const depsOk = buildNewsDeps({ fetchFn, cache: { dailyKey: async () => "", hasToday: async () => false } });
    const allowedOk = await depsOk.robots.isAllowed(feedUrl);
    expect(allowedOk).toBe(true);
    expect(requestedUrls).toContain(`https://${feedHost}/robots.txt`);

    // Caso MUTADO: allowlist vacía ({}) — el bloqueo debe ocurrir ANTES del fetch.
    requestedUrls.length = 0;
    const depsMutated = buildNewsDeps({
      fetchFn,
      allowlist: {},
      cache: { dailyKey: async () => "", hasToday: async () => false },
    });
    const allowedMutated = await depsMutated.robots.isAllowed(feedUrl);
    expect(allowedMutated).toBe(false);
    expect(requestedUrls.length).toBe(0);
  });
});

describe("NewsConnector — SC2 (R2 key + caché diaria, parte unitaria)", () => {
  it("SC2-a: r2.putImmutable recibe (news, rss-<slug>, fecha, sha256, xml, body) y el r2Path matchea el patrón", async () => {
    const { deps } = makeDeps();
    await new NewsConnector(deps).run(RUN_CTX);
    expect(deps.r2.putImmutable).toHaveBeenCalledTimes(5);
    for (const call of (deps.r2.putImmutable as any).mock.calls) {
      const [source, resource, date, sha, ext] = call;
      expect(source).toBe("news");
      expect(resource).toMatch(/^rss-[a-z]+$/);
      expect(date).toBe("2026-08-05");
      expect(sha).toMatch(/^[0-9a-f]{64}$/);
      expect(ext).toBe("xml");
    }
    const results = await Promise.all(
      ((deps.r2.putImmutable as any).mock.results as { value: Promise<{ r2Path: string }> }[]).map(
        (r) => r.value,
      ),
    );
    for (const { r2Path } of results) {
      expect(r2Path).toMatch(/^news\/rss-[a-z]+\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{64}\.xml$/);
    }
  });

  it("SC2-b: cache.hasToday true para todos => fetcher.get 0 veces y run() devuelve []", async () => {
    const { deps } = makeDeps({ hasTodaySlugs: new Set(FEEDS.map((f) => f.slug)) });
    const refs = await new NewsConnector(deps).run(RUN_CTX);
    expect(refs).toEqual([]);
    expect(deps.fetcher.get).not.toHaveBeenCalled();
  });

  it("SC2-c: el body que llega a putImmutable es el crudo del fetch (byte-idéntico), no lo que devuelve validateShape", async () => {
    const { deps } = makeDeps();
    await new NewsConnector(deps).run(RUN_CTX);
    const call = (deps.r2.putImmutable as any).mock.calls.find(
      (c: unknown[]) => c[1] === `rss-${FEEDS[0]!.slug}`,
    );
    const body: Uint8Array = call[5];
    const expected = new TextEncoder().encode(fixtureXml(FEEDS[0]!.slug));
    expect(new TextDecoder().decode(body)).toBe(new TextDecoder().decode(expected));
  });
});

describe("NewsConnector — validateShape (forma)", () => {
  const connector = new NewsConnector(makeDeps().deps) as unknown as {
    validateShape(body: unknown): { xml: string };
  };
  // Acceso al hook protegido vía cast — el hook es puro y sin efectos secundarios.

  it("acepta el fixture real de cada uno de los 5 feeds", () => {
    for (const f of FEEDS) {
      const xml = fixtureXml(f.slug);
      expect(() => (connector as any).validateShape(xml)).not.toThrow();
    }
  });

  it("rechaza un string '{}'", () => {
    expect(() => (connector as any).validateShape("{}")).toThrow();
  });

  it("rechaza un JSON object (no string)", () => {
    expect(() => (connector as any).validateShape({ ok: true })).toThrow();
  });

  it("rechaza HTML sin <item>", () => {
    expect(() => (connector as any).validateShape("<html><body>no rss aquí</body></html>")).toThrow();
  });
});

describe("NewsConnector — fingerprint estructural", () => {
  const connector = new NewsConnector(makeDeps().deps) as unknown as {
    fingerprint(raw: { xml: string }): Promise<string>;
  };

  it("dos XML que difieren SOLO en <lastBuildDate> producen el MISMO fingerprint", async () => {
    const base = fixtureXml(FEEDS[0]!.slug);
    const mutated = base.replace(
      /<lastBuildDate>[^<]*<\/lastBuildDate>/,
      "<lastBuildDate>Thu, 06 Aug 2026 00:00:00 +0000</lastBuildDate>",
    );
    expect(mutated).not.toBe(base);
    const fpBase = await (connector as any).fingerprint({ xml: base });
    const fpMutated = await (connector as any).fingerprint({ xml: mutated });
    expect(fpBase).toBe(fpMutated);
  });

  it("un XML con un tag nuevo produce un fingerprint distinto", async () => {
    const base = fixtureXml(FEEDS[0]!.slug);
    const withNewTag = base.replace("<channel>", "<channel><nuevoTagInexistente>x</nuevoTagInexistente>");
    const fpBase = await (connector as any).fingerprint({ xml: base });
    const fpNew = await (connector as any).fingerprint({ xml: withNewTag });
    expect(fpBase).not.toBe(fpNew);
  });
});

describe("buildNewsDeps — cache real, no-op muerto (CR-01, 132-08)", () => {
  it("sin `cache` ni `supabase` ⇒ LANZA NewsCacheRequeridaError (el default de producción ya no es un no-op)", () => {
    expect(() => buildNewsDeps({})).toThrow(NewsCacheRequeridaError);
    expect(() => buildNewsDeps({})).toThrow(/cache/i);
  });

  it("con `supabase: { url, serviceKey }` ⇒ construye un DailyCache real respaldado en SupabaseSnapshotLookup", () => {
    const deps = buildNewsDeps({ supabase: { url: "http://127.0.0.1:0", serviceKey: "test-key" } });
    expect(deps.cache).toBeInstanceOf(DailyCache);
  });

  it("con `cache` override explícito ⇒ se usa tal cual, sin exigir `supabase`", () => {
    const cacheDoble = { dailyKey: vi.fn(async () => ""), hasToday: vi.fn(async () => false) };
    const deps = buildNewsDeps({ cache: cacheDoble });
    expect(deps.cache).toBe(cacheDoble);
  });
});

describe("buildNewsDeps — doble de fetcher lanza ante host inesperado (control positivo del doble)", () => {
  it("el fetcher doble lanza si se le pide un host distinto del esperado", async () => {
    const { deps } = makeDeps();
    const expectedHost = new URL(FEEDS[0]!.url).host;
    const guardedFetcher = {
      get: vi.fn(async (spec: RequestSpec) => {
        const host = new URL(spec.url).host;
        if (host !== expectedHost) {
          throw new Error(`host inesperado: ${host}`);
        }
        return new TextEncoder().encode(fixtureXml(FEEDS[0]!.slug));
      }),
    };
    // Forzar un segundo endpoint con host distinto para probar que el doble lanza.
    const spy = vi.spyOn(NewsConnector.prototype as any, "endpoints").mockReturnValue([
      { url: FEEDS[1]!.url, resource: `rss-${FEEDS[1]!.slug}`, key: FEEDS[1]!.slug, ext: "xml" },
    ]);
    try {
      const depsWithGuard: ConnectorDeps = { ...deps, fetcher: guardedFetcher };
      await expect(new NewsConnector(depsWithGuard).run(RUN_CTX)).rejects.toThrow(/host inesperado/);
    } finally {
      spy.mockRestore();
    }
  });
});
