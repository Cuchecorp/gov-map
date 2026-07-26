import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deriveToken, generarToken, hashToken } from "./token";

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

describe("deriveToken (CR-01/CR-02) — token DERIVADO reproducible round-trip", () => {
  const SECRET = "secreto-de-servidor-de-prueba";
  const SUSC_ID = "11111111-2222-3333-4444-555555555555";

  it("round-trip: hashToken(raw derivado) === el hash que se guardaría (link vivo)", () => {
    // Esto es EXACTAMENTE lo que el bug CR-01 rompía: el link del email lleva `raw`, la
    // página lo re-hashea con hashToken y busca por *_token_hash. La invariante debe casar.
    const baja = deriveToken(SECRET, "baja", SUSC_ID);
    expect(hashToken(baja.raw)).toBe(baja.hash);
    // El `raw` es lo que va en /notificaciones/baja?t=raw; su hashToken() casa con lo
    // almacenado (baja.hash). Antes se ponía el hash en el link → doble-hash → link muerto.
    expect(hashToken(baja.raw)).not.toBe(hashToken(baja.hash));
  });

  it("es DETERMINISTA: mismo (secret, purpose, id) → mismo raw (el CRON lo reproduce)", () => {
    const a = deriveToken(SECRET, "baja", SUSC_ID);
    const b = deriveToken(SECRET, "baja", SUSC_ID);
    expect(a.raw).toBe(b.raw);
    expect(a.hash).toBe(b.hash);
  });

  it("confirm y baja de la MISMA suscripción NO colisionan (namespaced por purpose)", () => {
    const confirm = deriveToken(SECRET, "confirm", SUSC_ID);
    const baja = deriveToken(SECRET, "baja", SUSC_ID);
    expect(confirm.raw).not.toBe(baja.raw);
    expect(confirm.hash).not.toBe(baja.hash);
  });

  it("otro secreto → otro raw (el secreto es lo que hace no-forjable el token)", () => {
    const conA = deriveToken("secreto-A", "baja", SUSC_ID);
    const conB = deriveToken("secreto-B", "baja", SUSC_ID);
    expect(conA.raw).not.toBe(conB.raw);
  });

  it("fórmula = base64url(HMAC-SHA256(secret, `${purpose}:${id}`)) — byte-idéntica al CRON", () => {
    // El CRON del digest (packages/notificaciones deriveRawToken) DEBE reproducir este
    // mismo raw; este assert congela la fórmula compartida entre ambos lados.
    const esperado = createHmac("sha256", SECRET).update(`baja:${SUSC_ID}`).digest("base64url");
    expect(deriveToken(SECRET, "baja", SUSC_ID).raw).toBe(esperado);
  });

  it("sin secreto lanza (fail-loud: no derivar links muertos en silencio)", () => {
    expect(() => deriveToken("", "baja", SUSC_ID)).toThrow(/secreto/i);
  });
});
