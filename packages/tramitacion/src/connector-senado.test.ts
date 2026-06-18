// connector-senado.test — verifica el reuso de @obs/ingest en el ORDEN LOCKED (mock fetch).
//
// El Senado se consulta con el boletín BASE SIN sufijo (Pitfall 1): la URL debe llevar
// `boletin=18296`, no `18296-05`.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { SenadoConnector } from "./connector-senado";
import { RobotsDisallowError } from "./connector-camara";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

function makeDeps(opts: { responder: (url: string) => string; robotsAllow?: boolean }) {
  const calls: string[] = [];
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
    calls.push("fetch");
    urls.push(url);
    return new Response(opts.responder(url), { status: 200 });
  }) as typeof fetch;

  const fetcher = new Fetcher({ fetchFn });
  const rl = new HostRateLimiter({ minDelayMs: 0, jitterMs: 0 });
  const origWait = rl.wait.bind(rl);
  rl.wait = (host: string) => {
    calls.push("wait");
    return origWait(host);
  };
  const robots = new RobotsGuard({ fetchFn });
  robots.isAllowed = async () => {
    calls.push("robots");
    return opts.robotsAllow ?? true;
  };
  return { deps: { fetcher, rateLimiter: rl, robots }, calls, urls };
}

describe("SenadoConnector — reuso de @obs/ingest (orden LOCKED, boletín base)", () => {
  it("fetchTramitacion usa el boletín BASE sin sufijo (Pitfall 1) y reusa la política", async () => {
    const xml = leer("senado-tramitacion.xml");
    const { deps, calls, urls } = makeDeps({ responder: () => xml });
    const conn = new SenadoConnector(deps);

    const body = await conn.fetchTramitacion("18296");
    expect(body).toContain("<boletin>18296-05</boletin>");
    expect(urls[0]).toContain("tramitacion.php");
    expect(urls[0]).toContain("boletin=18296");
    expect(urls[0]).not.toContain("18296-05"); // base sin sufijo
    expect(calls).toEqual(["robots", "wait", "fetch"]); // ORDEN LOCKED
  });

  it("fetchVotaciones arma la URL de votaciones.php por boletín base", async () => {
    const xml = leer("senado-votacion.xml");
    const { deps, urls } = makeDeps({ responder: () => xml });
    const conn = new SenadoConnector(deps);

    await conn.fetchVotaciones("14309");
    expect(urls[0]).toContain("votaciones.php");
    expect(urls[0]).toContain("boletin=14309");
  });

  it("lanza RobotsDisallowError sin tocar el fetcher si robots prohíbe", async () => {
    const { deps, calls } = makeDeps({ responder: () => "", robotsAllow: false });
    const conn = new SenadoConnector(deps);
    await expect(conn.fetchTramitacion("18296")).rejects.toBeInstanceOf(
      RobotsDisallowError,
    );
    expect(calls).not.toContain("fetch");
  });
});
