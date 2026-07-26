import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests del helper service_role de suscripciones por token opaco (notif-service.ts).
 *
 * WR-01 (regresión): `marcarBaja` DEBE BORRAR la fila (no flipear estado='baja'), para
 * ALINEAR con la baja de UI (dejarDeSeguir = DELETE). Con el flip superviviente + el
 * `unique (user_id, tipo, objetivo_id)`, re-seguir chocaba y quedaba roto para siempre.
 * Aquí se prueba a nivel del builder supabase-js mockeado que la ruta email usa .delete().
 */

// ── Mock del builder supabase-js (registra la operación + filtros) ────────────────
type Op = "select" | "update" | "delete";
const calls: {
  op: Op;
  table: string;
  eq: [string, string][];
  or?: string;
  payload?: unknown;
}[] = [];
// Control por-test del resultado del terminal (filas afectadas por update .select).
let updateSelectRows: unknown[] = [{ id: "row" }];

function makeBuilder(table: string) {
  let op: Op = "select";
  const eqs: [string, string][] = [];
  let orFilter: string | undefined;
  let payload: unknown;
  const rec = () => calls.push({ op, table, eq: eqs, or: orFilter, payload });
  const chain: Record<string, unknown> = {};
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
    return chain;
  };
  chain.or = (expr: string) => {
    orFilter = expr;
    return chain;
  };
  // .select() tras update/delete es el TERMINAL (thenable). Tras un select-inicial devuelve
  // el builder para encadenar .eq().maybeSingle() (búsquedas por token).
  chain.select = () => {
    if (op === "update" || op === "delete") {
      rec();
      return Promise.resolve({ data: updateSelectRows, error: null });
    }
    return chain;
  };
  chain.maybeSingle = async () => {
    rec();
    return { data: null, error: null };
  };
  // marcarBaja termina en .eq (delete sin .select) → thenable { error:null }.
  chain.then = (resolve: (v: { data: null; error: null }) => void) => {
    rec();
    resolve({ data: null, error: null });
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => makeBuilder(table) }),
}));

import { marcarBaja, marcarConfirmada } from "./notif-service";

beforeEach(() => {
  calls.length = 0;
  updateSelectRows = [{ id: "row" }]; // default: el update afecta 1 fila (confirmó)
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

  it("marcarConfirmada es un UPDATE a estado='confirmada' con guardia de ventana en el write", async () => {
    const ok = await marcarConfirmada("22222222-3333-4444-5555-666666666666");
    const op = calls.find((c) => c.table === "suscripcion");
    expect(op!.op).toBe("update");
    expect((op!.payload as { estado?: string }).estado).toBe("confirmada");
    // WR-02: la ventana se re-valida EN EL WRITE (filtro or gt/is null sobre confirm_expira_at).
    expect(op!.or).toMatch(/confirm_expira_at\.gt\./);
    expect(op!.or).toMatch(/confirm_expira_at\.is\.null/);
    expect(ok).toBe(true); // 1 fila afectada → confirmó de verdad
  });

  it("WR-02: token vencido ⇒ el update no afecta filas ⇒ marcarConfirmada devuelve false", async () => {
    updateSelectRows = []; // el filtro de ventana descartó la fila (expirada)
    const ok = await marcarConfirmada("22222222-3333-4444-5555-666666666666");
    expect(ok).toBe(false); // NO se confirmó (server-side, sin importar el caller)
  });
});
