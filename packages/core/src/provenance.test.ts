import { describe, expect, it } from "vitest";
import { makeProvenance } from "./provenance";
import { isIngestStatus } from "./domain";

describe("makeProvenance (FND-08)", () => {
  it("Test 1: produce fetchedAt en ISO 8601 parseable por Date", () => {
    const before = Date.now();
    const prov = makeProvenance("dummy", "https://example.cl/recurso");
    const after = Date.now();

    expect(prov.source).toBe("dummy");
    expect(prov.sourceUrl).toBe("https://example.cl/recurso");

    // fetchedAt debe ser un ISO timestamp valido y parseable.
    const parsed = Date.parse(prov.fetchedAt);
    expect(Number.isNaN(parsed)).toBe(false);
    // Round-trip ISO (descarta strings no-ISO que Date.parse aceptaria laxamente).
    expect(new Date(prov.fetchedAt).toISOString()).toBe(prov.fetchedAt);
    // Capturado en el momento del fetch.
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it("Test 2: NO incluye snapshotRef hasta asignacion explicita", () => {
    const prov = makeProvenance("dummy", "https://example.cl/recurso");
    expect(prov.snapshotRef).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(prov, "snapshotRef")).toBe(false);
  });
});

describe("isIngestStatus type-guard (control plane)", () => {
  it("Test 3: solo admite 'running'|'ok'|'error'", () => {
    expect(isIngestStatus("running")).toBe(true);
    expect(isIngestStatus("ok")).toBe(true);
    expect(isIngestStatus("error")).toBe(true);

    expect(isIngestStatus("pending")).toBe(false);
    expect(isIngestStatus("")).toBe(false);
    expect(isIngestStatus(42)).toBe(false);
    expect(isIngestStatus(null)).toBe(false);
    expect(isIngestStatus(undefined)).toBe(false);
  });
});
