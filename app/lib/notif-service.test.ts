import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests del helper service_role de suscripciones por token opaco (notif-service.ts).
 *
 * WR-01 (regresión): `marcarBaja` DEBE BORRAR la fila (no flipear estado='baja'), para
 * ALINEAR con la baja de UI (dejarDeSeguir = DELETE). Con el flip superviviente + el
 * `unique (user_id, tipo, objetivo_id)`, re-seguir chocaba y quedaba roto para siempre.
 * Aquí se prueba a nivel del builder supabase-js mockeado que la ruta email usa .delete().
 */

// ── Mock del builder supabase-js (registra la operación y la cadena .eq) ──────────
type Op = "select" | "update" | "delete";
const calls: { op: Op; table: string; eq: [string, string][]; payload?: unknown }[] = [];

function makeBuilder(table: string) {
  let op: Op = "select";
  const eqs: [string, string][] = [];
  let payload: unknown;
  const rec = () => calls.push({ op, table, eq: eqs, payload });
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.update = (p: unknown) => {
    op = "update";
    payload = p;
    return chain;
  };
  chain.delete = () => {
    op = "delete";
    return chain;
  };
  chain.eq = (col: string, val: string) => {
    eqs.push([col, val]);
    // marcarBaja/marcarConfirmada terminan en .eq → resolver como thenable { error:null }.
    // buscar* terminan en .maybeSingle. Damos ambos.
    return chain;
  };
  chain.maybeSingle = async () => {
    rec();
    return { data: null, error: null };
  };
  chain.then = (resolve: (v: { error: null }) => void) => {
    rec();
    resolve({ error: null });
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => makeBuilder(table) }),
}));

import { marcarBaja, marcarConfirmada } from "./notif-service";

beforeEach(() => {
  calls.length = 0;
  process.env.SUPABASE_URL = "https://proj.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
});

afterEach(() => vi.clearAllMocks());

describe("notif-service — WR-01: la baja por email BORRA la fila (no flip estado)", () => {
  it("marcarBaja emite un DELETE sobre suscripcion por id (alineado con dejarDeSeguir)", async () => {
    await marcarBaja("11111111-2222-3333-4444-555555555555");
    const op = calls.find((c) => c.table === "suscripcion");
    expect(op).toBeDefined();
    expect(op!.op).toBe("delete"); // NO 'update'
    // NUNCA debe existir un update con estado='baja' (el bug WR-01 dejaba la fila).
    const updateBaja = calls.find(
      (c) => c.op === "update" && (c.payload as { estado?: string })?.estado === "baja",
    );
    expect(updateBaja).toBeUndefined();
    // Scoped al id recibido.
    expect(op!.eq).toContainEqual(["id", "11111111-2222-3333-4444-555555555555"]);
  });

  it("marcarConfirmada sigue siendo un UPDATE a estado='confirmada' (no se toca)", async () => {
    await marcarConfirmada("22222222-3333-4444-5555-666666666666");
    const op = calls.find((c) => c.table === "suscripcion");
    expect(op!.op).toBe("update");
    expect((op!.payload as { estado?: string }).estado).toBe("confirmada");
  });
});
