/**
 * Tests de web-reader-jwt.ts (LOCKDOWN-03).
 *
 * Espejo de estilo de app/lib/cruces-gate.test.ts:
 *   - describe + it anidados
 *   - sin red, sin Supabase, sin mocks de módulo complejos
 *   - env inyectado vía process.env directo (restaurado en afterEach)
 *
 * Correr: cd app && npx vitest run
 * (ajustar el import path si el test se mueve a app/lib/)
 */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// -- helpers locales para verificar JWTs en el test (no importar desde el módulo
//    bajo prueba para mantener independencia; reimplementación mínima) --

function b64urlDecode(s: string): string {
  // base64url → base64 → utf-8
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function parseJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown>; sigInput: string; sig: string } {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("token malformado");
  return {
    header: JSON.parse(b64urlDecode(h)) as Record<string, unknown>,
    payload: JSON.parse(b64urlDecode(p)) as Record<string, unknown>,
    sigInput: `${h}.${p}`,
    sig,
  };
}

function verifyHs256(secret: string, sigInput: string, sig: string): boolean {
  const expected = createHmac("sha256", secret).update(sigInput).digest("base64url");
  return expected === sig;
}

// -- setup/teardown de env --

const TEST_SECRET = "super-secret-jwt-signing-key-32chars!!";
const TEST_URL = "https://bctyygbmqcvizyplktuw.supabase.co";

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
  };
  process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  process.env.SUPABASE_URL = TEST_URL;
});

afterEach(() => {
  process.env.SUPABASE_JWT_SECRET = savedEnv.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_URL = savedEnv.SUPABASE_URL;
  // Limpiar la caché interna del módulo entre tests para que cada test
  // parta de estado limpio. El módulo exporta el token fresco si se llama
  // con env diferente; la caché puede retener el valor del test anterior.
  // Estrategia: importar dinámicamente con cache-bust (ver nota abajo).
});

// NOTA sobre caché: `mintWebReaderToken` tiene una caché de proceso (variable
// de módulo `_cache`). Para los tests que verifican el valor fresco, importar
// el módulo con `vi.resetModules()` antes del test o usar un `Date.now` mock.
// Los tests aquí son conservadores: verifican propiedades estructurales (role,
// exp en el futuro, firma), no el valor exacto del token, por lo que la caché
// NO interfiere — un token cacheado con el mismo secret sigue siendo válido.

describe("mintWebReaderToken (LOCKDOWN-03)", () => {
  it("retorna un JWT de tres partes separadas por punto", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const token = mintWebReaderToken();
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("header alg=HS256 typ=JWT", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { header } = parseJwt(mintWebReaderToken());
    expect(header.alg).toBe("HS256");
    expect(header.typ).toBe("JWT");
  });

  it('payload role="web_reader"', async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(mintWebReaderToken());
    expect(payload.role).toBe("web_reader");
  });

  it('payload iss="supabase"', async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(mintWebReaderToken());
    expect(payload.iss).toBe("supabase");
  });

  it("payload ref extraído de SUPABASE_URL", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(mintWebReaderToken());
    expect(payload.ref).toBe("bctyygbmqcvizyplktuw");
  });

  it("exp está en el futuro (token no expirado al mintar)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(mintWebReaderToken());
    const now = Math.floor(Date.now() / 1000);
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp as number).toBeGreaterThan(now);
  });

  it("exp ≈ iat + 300 s (TTL de 5 min)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(mintWebReaderToken());
    const diff = (payload.exp as number) - (payload.iat as number);
    // Permitir ±2 s por latencia de ejecución
    expect(diff).toBeGreaterThanOrEqual(298);
    expect(diff).toBeLessThanOrEqual(302);
  });

  it("firma HS256 verificable con el mismo secret (roundtrip)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const token = mintWebReaderToken();
    const { sigInput, sig } = parseJwt(token);
    expect(verifyHs256(TEST_SECRET, sigInput, sig)).toBe(true);
  });

  it("firma NO verificable con un secret distinto", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const token = mintWebReaderToken();
    const { sigInput, sig } = parseJwt(token);
    expect(verifyHs256("wrong-secret", sigInput, sig)).toBe(false);
  });

  it("lanza si SUPABASE_JWT_SECRET está ausente", async () => {
    // Limpiar para este test específico
    process.env.SUPABASE_JWT_SECRET = undefined as unknown as string;
    // Re-importar para limpiar caché (si la caché retiene un token, el error
    // no se lanzaría — necesitamos módulo fresco). Usar resetModules de vitest.
    const { vi } = await import("vitest");
    vi.resetModules();
    const { mintWebReaderToken: fresh } = await import("./web-reader-jwt");
    expect(() => fresh()).toThrow("SUPABASE_JWT_SECRET");
  });

  it("caché: dos llamadas consecutivas retornan el mismo token (sin remintado)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const t1 = mintWebReaderToken();
    const t2 = mintWebReaderToken();
    expect(t1).toBe(t2);
  });
});
