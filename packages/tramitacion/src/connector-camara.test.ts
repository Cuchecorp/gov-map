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
  it("descubre boletines de una legislatura recorriendo sesiones (nodo + texto) y respeta robots→wait→fetch", async () => {
    // getSesiones → 2 sesiones; getSesionDetalle → boletines en <Boletin> y texto libre.
    const sesiones = `<?xml version="1.0"?><Sesiones>
      <Sesion><ID>4776</ID></Sesion>
      <Sesion><ID>4777</ID></Sesion>
    </Sesiones>`;
    const det4776 = `<Detalle><Boletin>14309-04</Boletin> y Boletín N° 18296-05</Detalle>`;
    const det4777 = `<Detalle><Boletin>14309-04</Boletin></Detalle>`; // repetido → dedup
    const { deps, calls, urls } = makeDeps({
      responder: (url) => {
        if (url.includes("getSesiones")) return sesiones;
        if (url.includes("prmSesionId=4776")) return det4776;
        if (url.includes("prmSesionId=4777")) return det4777;
        return "";
      },
    });

    const conn = new CamaraConnector(deps);
    const boletines = await conn.descubrirBoletines(58);

    expect(boletines).toEqual(["14309-04", "18296-05"]); // dedup cross-sesión
    expect(urls[0]).toContain("getSesiones");
    expect(urls[0]).toContain("prmLegislaturaId=58");
    // ORDEN LOCKED en el primer fetch: robots ANTES de wait, wait ANTES de fetch.
    expect(calls.slice(0, 3)).toEqual(["robots", "wait", "fetch"]);
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

  it("fetchVotacionDetalle arma la URL con el método REAL getVotacion_Detalle?prmVotacionId", async () => {
    const xml = leer("camara-votacion-detalle.xml");
    const { deps, urls } = makeDeps({ responder: () => xml });
    const conn = new CamaraConnector(deps);

    await conn.fetchVotacionDetalle("89178");
    expect(urls[0]).toContain("getVotacion_Detalle");
    expect(urls[0]).toContain("prmVotacionId=89178");
  });

  it("lanza RobotsDisallowError sin tocar el fetcher si robots prohíbe", async () => {
    const { deps, calls } = makeDeps({ responder: () => "", robotsAllow: false });
    const conn = new CamaraConnector(deps);
    await expect(conn.fetchVotacionesBoletin("14309-04")).rejects.toBeInstanceOf(
      RobotsDisallowError,
    );
    expect(calls).not.toContain("fetch"); // robots prohíbe → no se emite request
  });

  describe("enumerarProyectosXAnno — fallo total AUDIBLE (WR-04)", () => {
    it("AMBAS ops fallan (robots prohíbe) → LANZA, no devuelve [] silencioso", async () => {
      // robotsAllow=false → cada op lanza RobotsDisallowError dentro del try; fallos=2.
      const { deps } = makeDeps({ responder: () => "", robotsAllow: false });
      const conn = new CamaraConnector(deps);
      await expect(conn.enumerarProyectosXAnno(2020)).rejects.toThrow(
        /ambas ops fallaron/,
      );
    });

    it("UNA op falla y la otra devuelve boletines → NO lanza, retorna lo parcial", async () => {
      // Mociones responde con un boletín válido; Mensajes responde XML basura → parse
      // vacío (no lanza). fallos < 2 → best-effort por op, sin throw.
      const mociones =
        `<?xml version="1.0"?><ProyectosLeyColeccion>` +
        `<ProyectoLey><NumeroBoletin>14309-04</NumeroBoletin></ProyectoLey>` +
        `</ProyectosLeyColeccion>`;
      const { deps } = makeDeps({
        responder: (url) =>
          url.includes("retornarMocionesXAnno") ? mociones : "<vacio/>",
      });
      const conn = new CamaraConnector(deps);
      const boletines = await conn.enumerarProyectosXAnno(2020);
      expect(boletines).toContain("14309-04");
    });
  });
});
