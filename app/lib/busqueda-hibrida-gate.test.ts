import { describe, expect, it } from "vitest";

import { busquedaHibridaEnabled } from "./busqueda-hibrida-gate";

/**
 * Gate flippeado a default ON tras dominancia confirmada (Plan 87-03, 2026-07-22).
 * Rollback: setear BUSQUEDA_HIBRIDA_ENABLED=false → OFF inmediato (sin redeploy de código).
 * Solo el literal "false" apaga el flag.
 */
describe("busquedaHibridaEnabled (RETR-05, default ON post-gate)", () => {
  it("var ausente -> true (default ON — RPC domina)", () => {
    expect(busquedaHibridaEnabled({})).toBe(true);
  });

  it('"true" -> true', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "true" })).toBe(true);
  });

  it('"1" -> true (cualquier valor distinto de "false" → ON)', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "1" })).toBe(true);
  });

  it('"FALSE" -> true (case-sensitive: solo el literal "false" apaga)', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "FALSE" })).toBe(true);
  });

  it('"false" -> false (rollback explícito)', () => {
    expect(busquedaHibridaEnabled({ BUSQUEDA_HIBRIDA_ENABLED: "false" })).toBe(false);
  });
});
