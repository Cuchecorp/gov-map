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
});
