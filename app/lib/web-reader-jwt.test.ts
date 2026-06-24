/**
 * Tests de web-reader-jwt.ts (LOCKDOWN-03).
 *
 * Estilo de app/lib/cruces-gate.test.ts:
 *   - describe + it anidados
 *   - sin red, sin Supabase, sin mocks de modulo complejos
 *   - env inyectado via process.env directo (restaurado en afterEach)
 *
 * Correr: cd app && npx vitest run lib/web-reader-jwt.test.ts
 */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- helpers locales para verificar JWTs en el test --

function b64urlDecode(s: string): string {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function parseJwt(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  sigInput: string;
  sig: string;
} {
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
  vi.resetModules();
});

afterEach(() => {
  process.env.SUPABASE_JWT_SECRET = savedEnv.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_URL = savedEnv.SUPABASE_URL;
  vi.resetModules();
});

describe("mintWebReaderToken (LOCKDOWN-03)", () => {
  it("retorna un JWT de tres partes separadas por punto", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const token = await mintWebReaderToken();
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    parts.forEach((p) => expect(p.length).toBeGreaterThan(0));
  });

  it("header alg=HS256 typ=JWT", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { header } = parseJwt(await mintWebReaderToken());
    expect(header.alg).toBe("HS256");
    expect(header.typ).toBe("JWT");
  });

  it('payload role="web_reader"', async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(await mintWebReaderToken());
    expect(payload.role).toBe("web_reader");
  });

  it('payload iss="supabase"', async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(await mintWebReaderToken());
    expect(payload.iss).toBe("supabase");
  });

  it("payload ref extraido de SUPABASE_URL", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(await mintWebReaderToken());
    expect(payload.ref).toBe("bctyygbmqcvizyplktuw");
  });

  it("exp esta en el futuro (token no expirado al mintar)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(await mintWebReaderToken());
    const now = Math.floor(Date.now() / 1000);
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp as number).toBeGreaterThan(now);
  });

  it("exp ~= iat + 300 s (TTL de 5 min, +-2 s)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const { payload } = parseJwt(await mintWebReaderToken());
    const diff = (payload.exp as number) - (payload.iat as number);
    expect(diff).toBeGreaterThanOrEqual(298);
    expect(diff).toBeLessThanOrEqual(302);
  });

  it("firma HS256 verificable con el mismo secret (roundtrip)", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const token = await mintWebReaderToken();
    const { sigInput, sig } = parseJwt(token);
    expect(verifyHs256(TEST_SECRET, sigInput, sig)).toBe(true);
  });

  it("firma NO verificable con un secret distinto", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const token = await mintWebReaderToken();
    const { sigInput, sig } = parseJwt(token);
    expect(verifyHs256("wrong-secret", sigInput, sig)).toBe(false);
  });

  it("lanza si SUPABASE_JWT_SECRET esta ausente (fail-closed)", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    vi.resetModules();
    const { mintWebReaderToken: fresh } = await import("./web-reader-jwt");
    await expect(fresh()).rejects.toThrow("SUPABASE_JWT_SECRET");
  });

  it("cache: dos llamadas consecutivas retornan el mismo token", async () => {
    const { mintWebReaderToken } = await import("./web-reader-jwt");
    const t1 = await mintWebReaderToken();
    const t2 = await mintWebReaderToken();
    expect(t1).toBe(t2);
  });
});
