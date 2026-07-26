import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * Tests del botón Seguir (NOTIF-05, Phase 103): flag OFF ⇒ AUSENTE del DOM (return null,
 * no css-hidden); flag ON ⇒ renderiza con `aria-pressed` reflejando el estado de
 * seguimiento. El cliente user + cookies se mockean.
 */

let notifOn = true;
vi.mock("@/lib/notif-gate", () => ({
  notifPublicEnabled: () => notifOn,
}));

let sesionSub: string | null = "user-A";
let siguiendoFilas: { id: string }[] = [];
const selectChain = () => {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.limit = vi.fn(async () => ({ data: siguiendoFilas, error: null }));
  return chain;
};
vi.mock("@/lib/supabase-user", () => ({
  createUserClient: () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: sesionSub ? { sub: sesionSub } : {} },
      }),
    },
    from: () => ({ select: () => selectChain() }),
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));

// Las Server Actions no se ejercen en el render; mock mínimo.
vi.mock("@/app/cuenta/actions", () => ({
  seguir: vi.fn(),
  dejarDeSeguir: vi.fn(),
}));

import { SeguirButton } from "./seguir-button";

beforeEach(() => {
  notifOn = true;
  sesionSub = "user-A";
  siguiendoFilas = [];
});
afterEach(cleanup);

describe("SeguirButton — gate NOTIF (ausente cuando OFF)", () => {
  it("flag OFF ⇒ renderiza null (NADA en el DOM, no css-hidden)", async () => {
    notifOn = false;
    const el = await SeguirButton({
      tipo: "proyecto",
      objetivoId: "14309-04",
      next: "/proyecto/14309-04",
    });
    expect(el).toBeNull();
  });
});

describe("SeguirButton — flag ON (aria-pressed refleja el estado)", () => {
  it("no siguiendo ⇒ botón 'Seguir' con aria-pressed=false", async () => {
    siguiendoFilas = [];
    const el = await SeguirButton({
      tipo: "proyecto",
      objetivoId: "14309-04",
      next: "/proyecto/14309-04",
    });
    const { container } = render(el);
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-pressed")).toBe("false");
    expect(btn?.textContent).toContain("Seguir");
    // 44px touch target.
    expect(btn?.className).toContain("min-h-[2.75rem]");
    // Anti-insinuación: nunca --camara/--senado como fill.
    expect(btn?.className).not.toContain("camara");
    expect(btn?.className).not.toContain("senado");
  });

  it("siguiendo ⇒ botón 'Siguiendo' con aria-pressed=true", async () => {
    siguiendoFilas = [{ id: "s1" }];
    const el = await SeguirButton({
      tipo: "parlamentario",
      objetivoId: "D101",
      next: "/parlamentario/D101",
    });
    const { container } = render(el);
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    expect(btn?.textContent).toContain("Siguiendo");
  });

  it("logged-out ⇒ link a /cuenta?next=… (no toggle sin sesión)", async () => {
    sesionSub = null;
    const el = await SeguirButton({
      tipo: "proyecto",
      objetivoId: "14309-04",
      next: "/proyecto/14309-04",
    });
    const { container } = render(el);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toContain("/cuenta?next=");
    expect(container.querySelector("button")).toBeNull();
  });
});
