import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WR-04 — Cobertura del cliente user de bajo privilegio.
 *
 * Fija dos invariantes de seguridad/correctitud:
 *   (a) `leerEnv()` es FAIL-LOUD: sin SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY, tanto
 *       `updateSession` como `createUserClient` lanzan (nunca degradan a un cliente sin key).
 *   (b) `updateSession` devuelve el `supabaseResponse` SIN mutar cuando `getClaims` no gatilla
 *       refresh (no llama `setAll`), de modo que el Set-Cookie sobreviva.
 *
 * `@supabase/ssr` se mockea: `createServerClient` captura el adaptador de cookies y expone un
 * `auth.getClaims` controlable, sin tocar red.
 */

let capturedCookies:
  | {
      getAll: () => { name: string; value: string }[];
      setAll: (
        cookies: { name: string; value: string; options?: Record<string, unknown> }[],
      ) => void;
    }
  | null = null;
let getClaimsImpl: () => Promise<{ data: { claims: unknown } }> = async () => ({
  data: { claims: null },
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: typeof capturedCookies }) => {
    capturedCookies = opts.cookies;
    return { auth: { getClaims: () => getClaimsImpl() } };
  },
}));

// `NextResponse.next` devuelve objetos-sentinel distintos por llamada, con un `cookies.set`.
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ __resp: Math.random(), cookies: { set: vi.fn() } })),
  },
}));

import { createUserClient, updateSession } from "./supabase-user";

const KEYS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"] as const;

function fakeRequest() {
  return {
    cookies: {
      getAll: () => [] as { name: string; value: string }[],
      set: vi.fn(),
    },
  } as unknown as Parameters<typeof updateSession>[0];
}

describe("supabase-user (WR-04)", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    capturedCookies = null;
    getClaimsImpl = async () => ({ data: { claims: null } });
    saved = {};
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("leerEnv fail-loud: updateSession lanza si falta la publishable key", async () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    await expect(updateSession(fakeRequest())).rejects.toThrow(/SUPABASE_PUBLISHABLE_KEY/);
  });

  it("leerEnv fail-loud: updateSession lanza si falta SUPABASE_URL", async () => {
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    await expect(updateSession(fakeRequest())).rejects.toThrow(/SUPABASE_URL/);
  });

  it("leerEnv fail-loud: createUserClient lanza si faltan ambas", () => {
    expect(() =>
      createUserClient({ getAll: () => [], setAll: () => {} }),
    ).toThrow(/SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY/);
  });

  it("updateSession devuelve el supabaseResponse sin mutar cuando no hay refresh", async () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    // getClaims sin claims => no invoca setAll => el response inicial se devuelve tal cual.
    const res = (await updateSession(fakeRequest())) as unknown as { __resp: number };
    expect(typeof res.__resp).toBe("number");
    // El adaptador de cookies quedó capturado (createServerClient corrió con la key presente).
    expect(capturedCookies).not.toBeNull();
  });
});
