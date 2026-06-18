import { describe, expect, it } from "vitest";
import { makeMockFetch } from "../test/_helpers";
import { IDENTIFIED_UA, RobotsGuard } from "./robots";

const ROBOTS_TXT = [
  "User-agent: *",
  "Disallow: /privado",
  "Allow: /",
].join("\n");

describe("RobotsGuard", () => {
  it("usa el UA identificatorio LOCKED", () => {
    expect(IDENTIFIED_UA).toBe(
      "Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)",
    );
  });

  it("Test 3: Disallow /privado => isAllowed false; /ok => true", async () => {
    const mock = makeMockFetch({
      "https://host.cl/robots.txt": { status: 200, body: ROBOTS_TXT },
    });
    const robots = new RobotsGuard({ fetchFn: mock.fn });

    expect(await robots.isAllowed("https://host.cl/privado")).toBe(false);
    expect(await robots.isAllowed("https://host.cl/ok")).toBe(true);
  });

  it("cachea robots.txt por host (un solo fetch para multiples checks)", async () => {
    const mock = makeMockFetch({
      "https://host.cl/robots.txt": { status: 200, body: ROBOTS_TXT },
    });
    const robots = new RobotsGuard({ fetchFn: mock.fn });

    await robots.isAllowed("https://host.cl/a");
    await robots.isAllowed("https://host.cl/b");

    const robotsFetches = mock.calls.filter((c) => c.url.endsWith("/robots.txt"));
    expect(robotsFetches.length).toBe(1);
  });

  it("ante robots.txt ausente (404) permite por defecto (fail-open)", async () => {
    const mock = makeMockFetch({});
    const robots = new RobotsGuard({ fetchFn: mock.fn });
    expect(await robots.isAllowed("https://sinrobots.cl/x")).toBe(true);
  });

  // --- WR-03 ---

  it("WR-03: URL malformada => false (skip controlado, no throw generico)", async () => {
    const mock = makeMockFetch({});
    const robots = new RobotsGuard({ fetchFn: mock.fn });
    expect(await robots.isAllowed("no-es-una-url")).toBe(false);
  });

  it("WR-03: error de RED al traer robots.txt => fail-CLOSED (false)", async () => {
    // fetch que lanza (DNS/timeout): NO debe asumirse allow-all.
    const throwingFetch = (async () => {
      throw new TypeError("network error");
    }) as unknown as typeof fetch;
    const robots = new RobotsGuard({ fetchFn: throwingFetch });
    expect(await robots.isAllowed("https://caido.cl/x")).toBe(false);
  });

  // --- #1 (code-review v1.0): gate de allowlist sobre el fetch de robots.txt ---

  it("#1: con allowlist, un origin interno NO emite el fetch de robots.txt (false)", async () => {
    const mock = makeMockFetch({});
    const robots = new RobotsGuard({ fetchFn: mock.fn, allowlist: {} });
    expect(
      await robots.isAllowed("http://169.254.169.254/latest/meta-data"),
    ).toBe(false);
    // Cierra la grieta SSRF: ningún request emitido al host interno.
    expect(mock.calls.length).toBe(0);
  });

  it("#1: con allowlist, un host gubernamental sí consulta robots.txt y permite", async () => {
    const mock = makeMockFetch({
      "https://www.camara.cl/robots.txt": {
        status: 200,
        body: "User-agent: *\nAllow: /",
      },
    });
    const robots = new RobotsGuard({ fetchFn: mock.fn, allowlist: {} });
    expect(await robots.isAllowed("https://www.camara.cl/x")).toBe(true);
  });

  it("#1: sin allowlist, el comportamiento histórico no gatea (hosts ficticios)", async () => {
    const mock = makeMockFetch({});
    const robots = new RobotsGuard({ fetchFn: mock.fn });
    // host.cl no es gubernamental pero sin allowlist se consulta igual (fail-open 404).
    expect(await robots.isAllowed("https://host.cl/x")).toBe(true);
  });

  it("WR-03: tras un error de red NO se cachea allow-all (reintenta la proxima)", async () => {
    let attempts = 0;
    const flaky = (async (input: RequestInfo | URL) => {
      attempts++;
      if (attempts === 1) throw new TypeError("network error");
      // 2da vez: responde 200 con robots que permite todo.
      void input;
      return new Response("User-agent: *\nAllow: /", { status: 200 });
    }) as unknown as typeof fetch;
    const robots = new RobotsGuard({ fetchFn: flaky });

    expect(await robots.isAllowed("https://flaky.cl/x")).toBe(false); // fail-closed
    expect(await robots.isAllowed("https://flaky.cl/x")).toBe(true); // reintenta, ok
    expect(attempts).toBe(2);
  });
});
