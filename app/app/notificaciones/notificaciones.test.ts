import { describe, expect, it } from "vitest";

import { generarToken, hashToken } from "./token";

/**
 * Tests de NOTIF-04 (Phase 103): el token opaco (round-trip determinista + hash no
 * reversible) y el modelo login-less. La lógica de confirmar/baja (búsqueda por hash +
 * flip de estado) vive en notif-service.ts (service_role) y se prueba a nivel de la
 * capa de dominio del token aquí; el flujo de página se valida vía tsc + el pgTAP de
 * two-user isolation (Plan 02).
 */

describe("token opaco (NOTIF-04) — round-trip determinista + hash no reversible", () => {
  it("generarToken produce raw base64url + hash sha256 hex de 64 chars", () => {
    const { raw, hash } = generarToken();
    // base64url: solo [A-Za-z0-9_-], sin padding.
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 chars base64url (sin padding).
    expect(raw.length).toBeGreaterThanOrEqual(42);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashToken es DETERMINISTA (mismo raw → mismo hash, para la búsqueda por igualdad)", () => {
    const { raw, hash } = generarToken();
    expect(hashToken(raw)).toBe(hash);
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("dos tokens distintos → hashes distintos (256 bits de entropía, no enumerable)", () => {
    const a = generarToken();
    const b = generarToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("el hash NO revela el raw (no reversible): el raw no aparece en el hash", () => {
    const { raw, hash } = generarToken();
    // El hash hex no contiene el raw (base64url) — la DB guarda solo el hash.
    expect(hash).not.toContain(raw);
    // Un raw distinto NUNCA colisiona al hash de otro (sanity anti-forgery).
    expect(hashToken("otro-token-cualquiera")).not.toBe(hash);
  });
});
