// connector-camara.test — verifica el reuso de @obs/ingest en el ORDEN LOCKED (mock fetch).
//
// Sin red: mock de fetch (capturando las URLs pedidas) + espías de robots/rateLimiter que
// registran el ORDEN de invocación. Lo crítico es que rateLimiter.wait corra ANTES del
// fetcher.get (la política nunca se salta) y que el descubrimiento extraiga boletines del
// texto libre de <Descripcion> con la regex.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Fetcher, HostRateLimiter, RobotsGuard } from "@obs/ingest";
import { CamaraConnector, RobotsDisallowError } from "./connector-camara";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
const leer = (f: string) => readFileSync(join(FIXTURES, f), "utf8");

/** Construye deps con espías de orden. `robotsAllow` controla el gate de robots. */
function makeDeps(opts: {
  responder: (url: string) => string;
  robotsAllow?: boolean;
}) {
  const calls: string[] = [];
  const urls: string[] = [];

  const fetchFn = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    // robots.txt lo resuelve el RobotsGuard; aquí respondemos 404 → fail-open.
    if (url.endsWith("/robots.txt")) {
      return new Response("", { status: 404 });
    }
    calls.push("fetch");
    urls.push(url);
    return new Response(opts.responder(url), { status: 200 });
  }) as typeof fetch;

  const fetcher = new Fetcher({ fetchFn });

  // rateLimiter espía: registra el wait y delega 0ms (test rápido).
  const rl = new HostRateLimiter({ minDelayMs: 0, jitterMs: 0 });
  const origWait = rl.wait.bind(rl);
  rl.wait = (host: string) => {
    calls.push("wait");
    return origWait(host);
  };

  // robots espía: registra y permite/prohíbe según opts.
  const robots = new RobotsGuard({ fetchFn });
  robots.isAllowed = async (_url: string) => {
    calls.push("robots");
    return opts.robotsAllow ?? true;
  };

  return { deps: { fetcher, rateLimiter: rl, robots }, calls, urls };
}

describe("CamaraConnector — reuso de @obs/ingest (orden LOCKED)", () => {
  it("descubre boletines de Leg 58 desde <Descripcion> y respeta robots→wait→fetch", async () => {
    const xml = leer("camara-votacion-boletin.xml");
    // El fixture de boletín no trae <Descripcion> con regex; simulamos la respuesta del
    // endpoint de descubrimiento con dos boletines en texto libre + un acuerdo sin boletín.
    const descubrimiento = `<?xml version="1.0"?><Votaciones>
      <Votacion><Descripcion>Proyecto de ley. Boletín N° 14309-04 sobre X</Descripcion></Votacion>
      <Votacion><Descripcion>Acuerdo de comité, sin boletín</Descripcion></Votacion>
      <Votacion><Descripcion>Boletín N° 18296-05, segundo trámite</Descripcion></Votacion>
      <Votacion><Descripcion>Boletín N° 14309-04 (repetido)</Descripcion></Votacion>
    </Votaciones>`;
    const { deps, calls, urls } = makeDeps({
      responder: (url) =>
        url.includes("retornarVotacionesXAnno") ? descubrimiento : xml,
    });

    const conn = new CamaraConnector(deps);
    const boletines = await conn.descubrirBoletines(2026);

    expect(boletines).toEqual(["14309-04", "18296-05"]); // dedup, sin el acuerdo
    expect(urls[0]).toContain("prmAnno=2026");
    // ORDEN LOCKED: robots ANTES de wait, wait ANTES de fetch.
    expect(calls).toEqual(["robots", "wait", "fetch"]);
  });

  it("fetchVotacionesBoletin arma la URL con prmBoletin y reusa la política", async () => {
    const xml = leer("camara-votacion-boletin.xml");
    const { deps, calls, urls } = makeDeps({ responder: () => xml });
    const conn = new CamaraConnector(deps);

    const body = await conn.fetchVotacionesBoletin("14309-04");
    expect(body).toContain("<Boletin>14309-04</Boletin>");
    expect(urls[0]).toContain("getVotaciones_Boletin");
    expect(urls[0]).toContain("prmBoletin=14309-04");
    expect(calls.indexOf("wait")).toBeLessThan(calls.indexOf("fetch")); // wait antes de fetch
  });

  it("fetchVotacionDetalle arma la URL con prmVotacionID", async () => {
    const xml = leer("camara-votacion-detalle.xml");
    const { deps, urls } = makeDeps({ responder: () => xml });
    const conn = new CamaraConnector(deps);

    await conn.fetchVotacionDetalle("89178");
    expect(urls[0]).toContain("retornarVotacionDetalle");
    expect(urls[0]).toContain("prmVotacionID=89178");
  });

  it("lanza RobotsDisallowError sin tocar el fetcher si robots prohíbe", async () => {
    const { deps, calls } = makeDeps({ responder: () => "", robotsAllow: false });
    const conn = new CamaraConnector(deps);
    await expect(conn.fetchVotacionesBoletin("14309-04")).rejects.toBeInstanceOf(
      RobotsDisallowError,
    );
    expect(calls).not.toContain("fetch"); // robots prohíbe → no se emite request
  });
});
