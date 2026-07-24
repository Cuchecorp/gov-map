import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WR-04 — Cobertura del PRIMER middleware del repo y su guard FAIL-OPEN.
 *
 * `middleware.ts` es el único chokepoint por el que pasa TODO request de la app (el matcher
 * cubre /, /parlamentarios, …). El branch fail-open (env de spike ausente => `NextResponse.next`)
 * es el mecanismo explícito que impide que el middleware nuevo tumbe el sitio existente (Camino
 * A intacto, T-97-08). Una regresión silenciosa a la polaridad del `||` (fácil de invertir)
 * tomaría abajo el sitio público. Estos tests fijan esa polaridad.
 *
 * `updateSession` se mockea para NO tocar Supabase ni la red: solo verificamos QUÉ branch corre.
 */

const updateSessionMock = vi.fn(async (..._args: unknown[]) => "UPDATE_SESSION_RESPONSE");
vi.mock("./supabase-user", () => ({
  updateSession: (...args: unknown[]) => updateSessionMock(...args),
}));

// `NextResponse.next` se mockea para devolver un sentinel identificable.
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn((init?: unknown) => ({ __next: true, init })),
  },
}));

import { middleware } from "../middleware";

const SPIKE_ENV_KEYS = ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_URL"] as const;

function fakeRequest(): Parameters<typeof middleware>[0] {
  // El middleware solo pasa `request` a NextResponse.next / updateSession; no lo inspecciona.
  return {} as Parameters<typeof middleware>[0];
}

describe("middleware (WR-04 — fail-open de Camino A)", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    updateSessionMock.mockClear();
    saved = {};
    for (const k of SPIKE_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of SPIKE_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("FAIL-OPEN: ambas vars ausentes -> NextResponse.next, NO llama updateSession", async () => {
    const res = (await middleware(fakeRequest())) as { __next?: boolean };
    expect(res.__next).toBe(true);
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("FAIL-OPEN: solo SUPABASE_URL presente (falta la publishable key) -> next, sin updateSession", async () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    const res = (await middleware(fakeRequest())) as { __next?: boolean };
    expect(res.__next).toBe(true);
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("FAIL-OPEN: solo SUPABASE_PUBLISHABLE_KEY presente (falta la URL) -> next, sin updateSession", async () => {
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    const res = (await middleware(fakeRequest())) as { __next?: boolean };
    expect(res.__next).toBe(true);
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("AMBAS presentes -> corre updateSession (refresh + Set-Cookie), NO el fail-open", async () => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
    const res = await middleware(fakeRequest());
    expect(updateSessionMock).toHaveBeenCalledTimes(1);
    expect(res).toBe("UPDATE_SESSION_RESPONSE");
  });
});
