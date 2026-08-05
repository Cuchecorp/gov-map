// allowlist-news.test.ts — prueba que la allowlist de prensa es SCOPED (Pitfall 1: el default
// de @obs/ingest NO cubre hosts de prensa), fuerza https, y rechaza hosts arbitrarios/Google.
import { describe, expect, it } from "vitest";
import { assertAllowedUrl, HostNotAllowedError } from "@obs/ingest";
import { FEEDS } from "./feeds";
import { allowlistNews, assertFeedUrl } from "./allowlist-news";

describe("assertFeedUrl — los 5 hosts de prensa pasan", () => {
  for (const f of FEEDS) {
    it(`${f.slug} (${new URL(f.url).host}) pasa assertFeedUrl`, () => {
      expect(() => assertFeedUrl(f.url)).not.toThrow();
    });
  }
});

describe("allowlist-news — scoping y defensas", () => {
  it("assertAllowedUrl SIN opts lanza para un feed de prensa (default NO los cubre)", () => {
    expect(() => assertAllowedUrl(FEEDS[0].url)).toThrow(HostNotAllowedError);
  });

  it("un host arbitrario lanza con allowlistNews()", () => {
    expect(() => assertAllowedUrl("https://evil.example.com/x", allowlistNews())).toThrow(
      HostNotAllowedError,
    );
  });

  it("http:// de un host de prensa lanza (aserción https explícita)", () => {
    expect(() => assertFeedUrl("http://www.latercera.com/arc/outboundfeeds/rss/")).toThrow();
  });

  it("news.google.com lanza con allowlistNews() (el host descartado no está en la allowlist)", () => {
    expect(() =>
      assertAllowedUrl("https://news.google.com/rss/search?q=x", allowlistNews()),
    ).toThrow(HostNotAllowedError);
  });
});
