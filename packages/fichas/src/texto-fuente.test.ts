// texto-fuente.test — descarga del texto íntegro vía @obs/ingest (orden LOCKED) + R2 gate.
//
// Todo mockeado/offline: ni red, ni R2 real. Verifica:
//   1. link presente + r2Enabled=true → fetch + putImmutable llamado; devuelve el texto + r2Path.
//   2. r2Enabled=false (default, R2 401) → NO toca R2; devuelve el texto en memoria (degrada).
//   3. link ausente / fetch falla → devuelve { texto: null } sin lanzar (degradación honesta).
//   4. assertAllowedUrl rechaza URL fuera del allowlist (SSRF guard) ANTES de fetch.

import { describe, it, expect, vi } from "vitest";
import { obtenerTextoFuente } from "./texto-fuente";

const URL_OK = "https://www.senado.cl/appsenado/index.php?mo=mensaje&id=123";
const TEXTO = "El proyecto tiene por objeto regular el endeudamiento de las personas.";

/** Colaboradores fake: fetcher devuelve TEXTO; robots permite; rate-limiter no espera. */
function fakeDeps(overrides: Record<string, unknown> = {}) {
  const fetcher = {
    get: vi.fn(async () => new TextEncoder().encode(TEXTO)),
  };
  const robots = { isAllowed: vi.fn(async () => true) };
  const rateLimiter = { wait: vi.fn(async () => {}) };
  return { fetcher, robots, rateLimiter, ...overrides };
}

describe("texto-fuente: obtenerTextoFuente — descarga + R2 gate", () => {
  it("1. link presente + r2Enabled → fetch + putImmutable; devuelve texto y r2Path", async () => {
    const { fetcher, robots, rateLimiter } = fakeDeps();
    const r2 = { putImmutable: vi.fn(async () => "fichas/texto/2026-06-18/abc.txt") };

    const res = await obtenerTextoFuente(URL_OK, {
      r2Enabled: true,
      r2: r2 as never,
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBe(TEXTO);
    expect(res.r2Path).toBe("fichas/texto/2026-06-18/abc.txt");
    // Orden LOCKED: robots → rateLimiter.wait → fetcher.get.
    expect(robots.isAllowed).toHaveBeenCalled();
    expect(rateLimiter.wait).toHaveBeenCalled();
    expect(fetcher.get).toHaveBeenCalled();
    expect(r2.putImmutable).toHaveBeenCalledTimes(1);
  });

  it("2. r2Enabled=false (default, R2 401) → NO toca R2; devuelve el texto en memoria", async () => {
    const { fetcher, robots, rateLimiter } = fakeDeps();
    const r2 = { putImmutable: vi.fn(async () => "no-deberia-llamarse") };

    const res = await obtenerTextoFuente(URL_OK, {
      r2: r2 as never,
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBe(TEXTO);
    expect(res.r2Path).toBeNull();
    expect(r2.putImmutable).not.toHaveBeenCalled();
  });

  it("2b. r2Enabled=true pero R2 da 401 → degrada: texto en memoria, r2Path null, NO aborta", async () => {
    const { fetcher, robots, rateLimiter } = fakeDeps();
    const r2 = {
      putImmutable: vi.fn(async () => {
        throw new Error("R2 PUT 401");
      }),
    };

    const res = await obtenerTextoFuente(URL_OK, {
      r2Enabled: true,
      r2: r2 as never,
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBe(TEXTO);
    expect(res.r2Path).toBeNull();
  });

  it("3a. link ausente (null) → { texto: null } sin lanzar ni tocar fetch", async () => {
    const { fetcher, robots, rateLimiter } = fakeDeps();

    const res = await obtenerTextoFuente(null, {
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBeNull();
    expect(res.r2Path).toBeNull();
    expect(fetcher.get).not.toHaveBeenCalled();
  });

  it("3b. fetch falla → { texto: null } sin lanzar (degradación honesta)", async () => {
    const fetcher = {
      get: vi.fn(async () => {
        throw new Error("fetch -> 503 (retryable)");
      }),
    };
    const robots = { isAllowed: vi.fn(async () => true) };
    const rateLimiter = { wait: vi.fn(async () => {}) };

    const res = await obtenerTextoFuente(URL_OK, {
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBeNull();
    expect(res.r2Path).toBeNull();
  });

  it("3c. robots prohíbe la URL → { texto: null } sin fetch", async () => {
    const { fetcher, rateLimiter } = fakeDeps();
    const robots = { isAllowed: vi.fn(async () => false) };

    const res = await obtenerTextoFuente(URL_OK, {
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBeNull();
    expect(fetcher.get).not.toHaveBeenCalled();
  });

  it("4. SSRF: URL fuera del allowlist rechazada ANTES de fetch (devuelve texto null)", async () => {
    const { fetcher, robots, rateLimiter } = fakeDeps();

    const res = await obtenerTextoFuente("https://evil.example.com/x", {
      fetcher: fetcher as never,
      robots: robots as never,
      rateLimiter: rateLimiter as never,
    });

    expect(res.texto).toBeNull();
    // Nunca llegó a robots/fetch: el guard SSRF corta antes.
    expect(robots.isAllowed).not.toHaveBeenCalled();
    expect(fetcher.get).not.toHaveBeenCalled();
  });
});
