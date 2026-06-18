// connector-camara.test — verifica el reuso de @obs/ingest en el ORDEN LOCKED + el header-set
// anti-Cloudflare (mock fetch, sin red).
//
// Lo crítico: (a) rateLimiter.wait corre ANTES de fetcher.get (la política nunca se salta);
// (b) la petición a Cámara lleva el header-set BROWSER_HEADERS_CAMARA (Sec-Fetch/Sec-Ch-Ua);
// (c) la URL de la semana usa prmSemana={año}-{semana} sin padding; (d) un 403 del WAF se
// relanza como CamaraBloqueadaError; (e) el PDF de la tabla es solo URL (no emite request).

import { describe, it, expect } from "vitest";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import {
  CitacionesCamaraConnector,
  RobotsDisallowError,
  CamaraBloqueadaError,
  CAMARA_TABLA_PDF_URL,
} from "./connector-camara";

/** Construye deps con espías de orden + captura de headers. */
function makeDeps(opts: {
  status?: number;
  body?: string;
  robotsAllow?: boolean;
}) {
  const calls: string[] = [];
  const urls: string[] = [];
  const headersVistos: Array<Record<string, string>> = [];

  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    calls.push("fetch");
    urls.push(url);
    headersVistos.push((init?.headers ?? {}) as Record<string, string>);
    return new Response(opts.body ?? "<html></html>", { status: opts.status ?? 200 });
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

describe("CitacionesCamaraConnector — reuso de @obs/ingest + header-set CF", () => {
  it("fetchSemana respeta el ORDEN LOCKED (robots→wait→fetch) y arma la URL de la semana", async () => {
    const { deps, calls, urls } = makeDeps({ body: "<article class='citaciones'></article>" });
    const conn = new CitacionesCamaraConnector(deps);

    const html = await conn.fetchSemana(2026, 25);
    expect(html).toContain("citaciones");
    expect(urls[0]).toContain("citaciones_semana.aspx");
    expect(urls[0]).toContain("prmSemana=2026-25"); // sin padding (param de Cámara)
    // ORDEN LOCKED: robots ANTES de wait, wait ANTES de fetch.
    expect(calls.slice(0, 3)).toEqual(["robots", "wait", "fetch"]);
    expect(calls.indexOf("wait")).toBeLessThan(calls.indexOf("fetch"));
  });

  it("envía el header-set de navegador anti-Cloudflare (Sec-Fetch / Sec-Ch-Ua + UA Bot-Ciudadano)", async () => {
    const { deps, headersVistos } = makeDeps({ body: "<html></html>" });
    const conn = new CitacionesCamaraConnector(deps);
    await conn.fetchSemana(2026, 25);

    const h = headersVistos[0]!;
    expect(h["Sec-Fetch-Mode"]).toBe("navigate");
    expect(h["Sec-Ch-Ua-Platform"]).toBe('"Windows"');
    expect(h["Sec-Ch-Ua"]).toContain("Chromium");
    expect(h["Upgrade-Insecure-Requests"]).toBe("1");
    expect(h["Accept-Language"]).toContain("es-CL");
    expect(h["User-Agent"]).toContain("Bot-Ciudadano/1.0"); // identificatorio (PROJECT.md)
  });

  it("relanza un 403 del WAF como CamaraBloqueadaError (para que runIngest degrade)", async () => {
    const { deps } = makeDeps({ status: 403 });
    const conn = new CitacionesCamaraConnector(deps);
    await expect(conn.fetchSemana(2026, 25)).rejects.toBeInstanceOf(CamaraBloqueadaError);
  });

  it("lanza RobotsDisallowError sin tocar el fetcher si robots prohíbe", async () => {
    const { deps, calls } = makeDeps({ robotsAllow: false });
    const conn = new CitacionesCamaraConnector(deps);
    await expect(conn.fetchSemana(2026, 25)).rejects.toBeInstanceOf(RobotsDisallowError);
    expect(calls).not.toContain("fetch");
  });

  it("fetchPdfTabla devuelve solo la URL del PDF + content_type (degradación honesta, sin request)", async () => {
    const { deps, calls } = makeDeps({});
    const conn = new CitacionesCamaraConnector(deps);
    const pdf = conn.fetchPdfTabla();
    expect(pdf.url).toBe(CAMARA_TABLA_PDF_URL);
    expect(pdf.url).toContain("prmTipo=TABLASEMANAL");
    expect(pdf.content_type).toBe("application/pdf");
    expect(calls).not.toContain("fetch"); // NO emite request (no fabrica filas)
  });
});
