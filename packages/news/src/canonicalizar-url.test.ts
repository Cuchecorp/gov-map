import { describe, it, expect } from "vitest";
import { canonicalizarUrl, urlHash, PARAMS_TRACKING, UrlInvalidaError } from "./canonicalizar-url";

describe("canonicalizarUrl", () => {
  it("elimina utm_source/utm_medium y conserva id", () => {
    expect(canonicalizarUrl("https://x.cl/a?utm_source=rss&utm_medium=feed&id=7")).toBe(
      "https://x.cl/a?id=7",
    );
  });

  it("elimina fbclid, gclid, mc_cid, mc_eid, igshid, ref, source", () => {
    const raw =
      "https://x.cl/a?fbclid=1&gclid=2&mc_cid=3&mc_eid=4&igshid=5&ref=6&source=7&id=9";
    expect(canonicalizarUrl(raw)).toBe("https://x.cl/a?id=9");
  });

  it("el set de tracking está congelado", () => {
    expect(Object.isFrozen(PARAMS_TRACKING)).toBe(true);
    expect(PARAMS_TRACKING).toEqual([
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
      "igshid",
      "ref",
      "source",
    ]);
  });

  it("elimina el fragmento y la barra final redundante; host a minúsculas", () => {
    expect(canonicalizarUrl("https://X.CL/a/#seccion")).toBe("https://x.cl/a");
    expect(canonicalizarUrl("https://x.cl/a/")).toBe("https://x.cl/a");
  });

  it("no toca la raíz sola (path === '/')", () => {
    expect(canonicalizarUrl("https://x.cl/")).toBe("https://x.cl/");
  });

  it("dos URLs que solo difieren en el orden de sus params de tracking producen la MISMA canónica", () => {
    const a = canonicalizarUrl("https://x.cl/a?id=1&utm_source=rss&b=2");
    const b = canonicalizarUrl("https://x.cl/a?b=2&utm_source=rss&id=1");
    expect(a).toBe(b);
    expect(a).toBe("https://x.cl/a?b=2&id=1");
  });

  it("una URL sin query queda idéntica (salvo barra final)", () => {
    expect(canonicalizarUrl("https://x.cl/nota-123")).toBe("https://x.cl/nota-123");
  });

  it("una URL inválida lanza UrlInvalidaError (no devuelve la cadena en silencio)", () => {
    expect(() => canonicalizarUrl("no es una url")).toThrow(UrlInvalidaError);
  });
});

describe("urlHash", () => {
  it("devuelve 64 hex y es estable entre corridas", async () => {
    const h1 = await urlHash("https://x.cl/a?id=7&utm_source=rss");
    const h2 = await urlHash("https://x.cl/a?id=7&utm_source=rss");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
  });

  it("está congelado como literal para una URL fija (regresión anti-cambio-silencioso)", async () => {
    const h = await urlHash("https://x.cl/a?id=7");
    expect(h).toBe(
      "1fa97d6c136fa68e2a38547d4e9bd613344684c7d75623326c8bb85fdf5a7532",
    );
  });

  it("el hash se calcula sobre la canónica, no sobre la original (mismo hash con distinto orden de tracking)", async () => {
    const h1 = await urlHash("https://x.cl/a?id=1&utm_source=rss&b=2");
    const h2 = await urlHash("https://x.cl/a?b=2&utm_source=rss&id=1");
    expect(h1).toBe(h2);
  });
});
