// connector-senado.test — reuso de @obs/ingest en el ORDEN LOCKED (mock fetch) + cobertura de
// la allowlist SSRF para web-back.senado.cl.
//
// Lo crítico: (a) rateLimiter.wait ANTES de fetcher.get; (b) las URLs apuntan a la API backend
// web-back.senado.cl/api/{commissions_citations,weekly_table}; (c) SIN header-set anti-Cloudflare
// (web-back no está tras CF); (d) assertAllowedUrl("https://web-back.senado.cl/...") NO lanza —
// documenta explícitamente que el sufijo senado.cl ya cubre el subdominio (cierra T-06-08 sin
// tocar @obs/ingest).

import { describe, it, expect } from "vitest";
import { Fetcher, HostRateLimiter, RobotsGuard, assertAllowedUrl } from "@obs/ingest";
import { SenadoActividadConnector } from "./connector-senado";
import { RobotsDisallowError } from "./connector-camara";

function makeDeps(opts: { body?: string; robotsAllow?: boolean }) {
  const calls: string[] = [];
  const urls: string[] = [];
  const headersVistos: Array<Record<string, string>> = [];

  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    calls.push("fetch");
    urls.push(url);
    headersVistos.push((init?.headers ?? {}) as Record<string, string>);
    return new Response(opts.body ?? '{"data":[]}', { status: 200 });
  }) as typeof fetch;

  const fetcher = new Fetcher({ fetchFn });

  const rl = new HostRateLimiter({ minDelayMs: 0, jitterMs: 0 });
  const origWait = rl.wait.bind(rl);
  rl.wait = (host: string) => {
    calls.push("wait");
    return origWait(host);
  };

  const robots = new RobotsGuard({ fetchFn });
  robots.isAllowed = async (_url: string) => {
    calls.push("robots");
    return opts.robotsAllow ?? true;
  };

  return { deps: { fetcher, rateLimiter: rl, robots }, calls, urls, headersVistos };
}

describe("SenadoActividadConnector — reuso de @obs/ingest (orden LOCKED)", () => {
  it("fetchCitaciones pega a web-back.senado.cl/api/commissions_citations con orden LOCKED", async () => {
    const { deps, calls, urls } = makeDeps({ body: '{"data":[{"CITACIONES":[]}]}' });
    const conn = new SenadoActividadConnector(deps);

    const body = await conn.fetchCitaciones();
    expect(body).toContain("CITACIONES");
    expect(urls[0]).toContain("web-back.senado.cl/api/commissions_citations");
    expect(urls[0]).toContain("limit=100");
    expect(calls.slice(0, 3)).toEqual(["robots", "wait", "fetch"]);
  });

  it("fetchTablaSala pega a web-back.senado.cl/api/weekly_table", async () => {
    const { deps, urls } = makeDeps({ body: '{"data":[]}' });
    const conn = new SenadoActividadConnector(deps);

    await conn.fetchTablaSala();
    expect(urls[0]).toContain("web-back.senado.cl/api/weekly_table");
    expect(urls[0]).toContain("limit=100");
  });

  it("NO envía el header-set anti-Cloudflare (web-back no está tras CF)", async () => {
    const { deps, headersVistos } = makeDeps({ body: '{"data":[]}' });
    const conn = new SenadoActividadConnector(deps);
    await conn.fetchCitaciones();

    const h = headersVistos[0]!;
    expect(h["Sec-Fetch-Mode"]).toBeUndefined();
    expect(h["Sec-Ch-Ua"]).toBeUndefined();
    expect(h["Upgrade-Insecure-Requests"]).toBeUndefined();
  });

  it("lanza RobotsDisallowError sin tocar el fetcher si robots prohíbe", async () => {
    const { deps, calls } = makeDeps({ robotsAllow: false });
    const conn = new SenadoActividadConnector(deps);
    await expect(conn.fetchCitaciones()).rejects.toBeInstanceOf(RobotsDisallowError);
    expect(calls).not.toContain("fetch");
  });
});

describe("allowlist SSRF — cobertura de web-back.senado.cl (T-06-08)", () => {
  it("assertAllowedUrl NO lanza para web-back.senado.cl (subdominio del sufijo senado.cl)", () => {
    expect(() =>
      assertAllowedUrl("https://web-back.senado.cl/api/commissions_citations?limit=100"),
    ).not.toThrow();
    expect(() =>
      assertAllowedUrl("https://web-back.senado.cl/api/weekly_table?limit=100"),
    ).not.toThrow();
  });

  it("assertAllowedUrl SÍ lanza para un host fuera de la allowlist (deny-by-default)", () => {
    expect(() => assertAllowedUrl("https://evil.example.com/api")).toThrow();
  });
});
