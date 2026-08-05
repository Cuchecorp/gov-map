// feeds.test.ts — congela los 5 feeds/hosts de D-132-A por valor literal + prueba por
// comportamiento el descarte de Google News RSS Search (no por inspección visual).
import { describe, expect, it } from "vitest";
import { FEEDS, NEWS_HOSTS } from "./feeds";

describe("FEEDS (D-132-A, congelado)", () => {
  it("tiene exactamente 5 entradas", () => {
    expect(FEEDS.length).toBe(5);
  });

  it("está congelado (Object.freeze)", () => {
    expect(Object.isFrozen(FEEDS)).toBe(true);
  });

  it("biobiochile — URL exacta", () => {
    const f = FEEDS.find((x) => x.slug === "biobiochile");
    expect(f?.url).toBe("https://www.biobiochile.cl/static/feed-rss");
  });

  it("cooperativa — URL exacta", () => {
    const f = FEEDS.find((x) => x.slug === "cooperativa");
    expect(f?.url).toBe(
      "https://www.cooperativa.cl/noticias/site/tax/port/all/rss_3_158__1.xml",
    );
  });

  it("latercera — URL exacta", () => {
    const f = FEEDS.find((x) => x.slug === "latercera");
    expect(f?.url).toBe("https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml");
  });

  it("lacuarta — URL exacta", () => {
    const f = FEEDS.find((x) => x.slug === "lacuarta");
    expect(f?.url).toBe("https://www.lacuarta.com/arc/outboundfeeds/rss/?outputType=xml");
  });

  it("exante — URL exacta", () => {
    const f = FEEDS.find((x) => x.slug === "exante");
    expect(f?.url).toBe("https://www.ex-ante.cl/feed/");
  });

  it("NEWS_HOSTS — los 5 hosts exactos", () => {
    expect([...NEWS_HOSTS]).toEqual([
      "www.biobiochile.cl",
      "www.cooperativa.cl",
      "www.latercera.com",
      "www.lacuarta.com",
      "www.ex-ante.cl",
    ]);
  });

  it("D-132-A: ningún feed apunta a un host google (por comportamiento)", () => {
    expect(FEEDS.every((f) => !new URL(f.url).host.includes("google"))).toBe(true);
  });

  it("D-132-A: NEWS_HOSTS no incluye ningún host google", () => {
    expect(NEWS_HOSTS.some((h) => h.includes("google"))).toBe(false);
  });
});
