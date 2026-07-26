import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests de /cuenta (NOTIF-01, Phase 103): validación OTP sin echo del valor (WR-02),
 * user_id derivado de la sesión SERVER-SIDE (Pitfall 5, T-103-08), y gate fail-closed
 * (flag OFF ⇒ las actions se rehúsan). El cliente user y las cookies se mockean; NO se
 * toca GoTrue ni la DB real.
 */

// ── Mocks compartidos ──────────────────────────────────────────────────────────
const signInWithOtp = vi.fn(async (_arg?: unknown) => ({ error: null as unknown }));
const verifyOtp = vi.fn(async (_arg?: unknown) => ({ error: null as unknown }));
const getClaims = vi.fn(
  async () =>
    ({ data: { claims: {} as Record<string, unknown> } }) as {
      data: { claims: Record<string, unknown> };
    },
);
const insert = vi.fn(
  async (_fila?: Record<string, unknown>) => ({ error: null as unknown }),
);
// delete() encadena .eq().eq().eq() → devolver un thenable que resuelve { error:null }.
const deleteChain = () => {
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.then = (resolve: (v: { error: null }) => void) => resolve({ error: null });
  return chain;
};
const from = vi.fn((_tabla: string) => ({
  insert,
  delete: () => deleteChain(),
}));

const fakeClient = {
  auth: { signInWithOtp, verifyOtp, getClaims, signOut: vi.fn() },
  from,
};

vi.mock("@/lib/supabase-user", () => ({
  createUserClient: () => fakeClient,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// Gate controlable por test (default ON; un test lo pone OFF).
let notifOn = true;
vi.mock("@/lib/notif-gate", () => ({
  notifPublicEnabled: () => notifOn,
}));

// server-only es un no-op en tests (resuelto por vitest.config alias).

import { deriveToken, hashToken } from "../notificaciones/token";
import {
  enviarOtp,
  verificarOtp,
  seguir,
  dejarDeSeguir,
} from "./actions";

beforeEach(() => {
  notifOn = true;
  // CR-01/CR-02: `seguir` deriva los tokens opacos de NOTIF_TOKEN_SECRET (fail-loud sin él).
  process.env.NOTIF_TOKEN_SECRET = "secreto-de-prueba-cuenta";
  vi.clearAllMocks();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-A" } } });
  signInWithOtp.mockResolvedValue({ error: null });
  verifyOtp.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
});

afterEach(() => vi.clearAllMocks());

describe("cuenta/actions — validación OTP (WR-02: nunca echa el valor)", () => {
  it("enviarOtp rechaza un email inválido SIN interpolarlo en el error", async () => {
    await expect(enviarOtp("no-es-un-email")).rejects.toThrow(/email inválido/);
    // El valor recibido NUNCA aparece en el mensaje.
    await expect(enviarOtp("no-es-un-email")).rejects.not.toThrow(/no-es-un-email/);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("verificarOtp rechaza un token no-6-dígitos SIN echarlo", async () => {
    await expect(verificarOtp("a@b.cl", "12ab")).rejects.toThrow(/OTP inválido/);
    await expect(verificarOtp("a@b.cl", "12ab")).rejects.not.toThrow(/12ab/);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("enviarOtp válido llama a signInWithOtp con shouldCreateUser", async () => {
    await enviarOtp("operador@dominio.cl");
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "operador@dominio.cl",
      options: { shouldCreateUser: true },
    });
  });
});

describe("cuenta/actions — user_id SIEMPRE server-derived (Pitfall 5, T-103-08)", () => {
  it("seguir deriva el user_id del sub de getClaims(), nunca del input", async () => {
    await seguir("proyecto", "14309-04");
    expect(getClaims).toHaveBeenCalled();
    // El insert de suscripcion usa el sub de sesión, NO un user_id del cliente.
    const fila = insert.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(fila.user_id).toBe("user-A");
    expect(fila.tipo).toBe("proyecto");
    expect(fila.objetivo_id).toBe("14309-04");
    expect(fila.estado).toBe("pendiente");
    // Tokens guardados HASHEADOS (nunca el raw): 64 hex chars de sha256.
    expect(String(fila.confirm_token_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(fila.baja_token_hash)).toMatch(/^[0-9a-f]{64}$/);
    // CR-01/CR-02 round-trip (subscribe-side): el `id` va en el insert y el hash guardado
    // es el sha256 del raw DERIVABLE por el CRON. Reproducimos la derivación con el mismo
    // secreto + id y confirmamos que casa con lo almacenado → el link del email revivirá.
    const suscId = String(fila.id);
    expect(suscId).toMatch(/^[0-9a-f-]{36}$/); // uuid client-side (para derivar pre-insert)
    const secret = process.env.NOTIF_TOKEN_SECRET!;
    expect(fila.baja_token_hash).toBe(deriveToken(secret, "baja", suscId).hash);
    expect(fila.confirm_token_hash).toBe(deriveToken(secret, "confirm", suscId).hash);
    // Y la invariante que el bug rompía: hashToken(rawEnElLink) === baja_token_hash.
    expect(hashToken(deriveToken(secret, "baja", suscId).raw)).toBe(fila.baja_token_hash);
  });

  it("seguir también registra un consentimiento (21.719)", async () => {
    await seguir("parlamentario", "D101");
    // Dos inserts: suscripcion + consentimiento.
    expect(from).toHaveBeenCalledWith("suscripcion");
    expect(from).toHaveBeenCalledWith("consentimiento");
    const consentimiento = insert.mock.calls.find(
      (c) => (c[0] as unknown as Record<string, unknown>)?.version_texto != null,
    )?.[0] as unknown as Record<string, unknown>;
    expect(consentimiento.user_id).toBe("user-A");
    expect(consentimiento.metodo).toBe("doble_opt_in_email");
  });

  it("seguir rechaza sin sesión (getClaims sin sub) ANTES de insertar", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} } });
    await expect(seguir("proyecto", "14309-04")).rejects.toThrow(/sin sesión/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("seguir rechaza un objetivo con formato inválido", async () => {
    await expect(seguir("proyecto", "no-boletin!!")).rejects.toThrow(/objetivo inválido/);
    await expect(seguir("otro-tipo", "14309-04")).rejects.toThrow(/tipo de suscripción inválido/);
  });

  it("dejarDeSeguir usa el user_id de sesión (no un id de fila del cliente)", async () => {
    await dejarDeSeguir("proyecto", "14309-04");
    expect(getClaims).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("suscripcion");
  });
});

describe("cuenta/actions — gate fail-closed (NOTIF-05)", () => {
  it("con el flag OFF, enviarOtp/seguir se rehúsan como PRIMERA sentencia", async () => {
    notifOn = false;
    await expect(enviarOtp("operador@dominio.cl")).rejects.toThrow(/deshabilitado/);
    await expect(seguir("proyecto", "14309-04")).rejects.toThrow(/deshabilitado/);
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
