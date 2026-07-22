import { describe, expect, it } from "vitest";

import { busquedaHibridaEnabled } from "./busqueda-hibrida-gate";

describe("busquedaHibridaEnabled (RETR-05, candado búsqueda híbrida)", () => {
  it("var ausente -> false (default fail-closed)", () => {
    expect(busquedaHibridaEnabled({})).toBe(false);
  });

  it('"false" -> false', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "false" })).toBe(false);
  });

  it('"1" -> false (sin truthiness laxa)', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "1" })).toBe(false);
  });

  it('"TRUE" -> false (case-sensitive: solo el literal "true")', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "TRUE" })).toBe(false);
  });

  it('"true" -> true (unico valor que enciende)', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "true" })).toBe(true);
  });
});
