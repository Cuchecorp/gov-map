import { describe, it, expect, vi, beforeEach } from "vitest";

// `next/navigation`.redirect lanza (Next interrumpe el render). Mockeamos para observar
// que el atajo de boletín redirige ANTES de tocar el RPC, sin el runtime de Next.
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// Cliente Supabase server-only: mockeamos `createServerSupabase().rpc(...)`.
const rpcMock = vi.fn();
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => ({ rpc: rpcMock }),
}));

import { buscarCitaciones } from "./agenda-buscar";

beforeEach(() => {
  redirectMock.mockClear();
  rpcMock.mockReset();
});

const fila = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "senado:cit:1",
  camara: "senado",
  comision: "Comisión de Medio Ambiente",
  fecha: "2026-06-23T10:00:00Z",
  materia: "Proyecto sobre reciclaje",
  semana_iso: "2026-W26",
  estado: null,
  rank: 0.5,
  boletin: "12345-07",
  ...over,
});

describe("buscarCitaciones — query vacía / whitespace", () => {
  it("q vacía → [] sin llamar al rpc ni redirigir", async () => {
    expect(await buscarCitaciones("")).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
  it("q solo-whitespace → []", async () => {
    expect(await buscarCitaciones("   \t\n ")).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("buscarCitaciones — atajo de boletín (cruce a la ficha)", () => {
  it("q que matchea BOLETIN_RE → redirect(/proyecto/{q}) ANTES del rpc", async () => {
    await expect(buscarCitaciones("12345-07")).rejects.toThrow(
      "NEXT_REDIRECT:/proyecto/12345-07",
    );
    expect(redirectMock).toHaveBeenCalledWith("/proyecto/12345-07");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("buscarCitaciones — flujo normal (rpc buscar_citaciones)", () => {
  it("q normal → rpc parametrizado (q jamás interpolado, p_camara null) → filas sin rank", async () => {
    rpcMock.mockResolvedValue({ data: [fila()], error: null });
    const res = await buscarCitaciones("medio ambiente");
    expect(rpcMock).toHaveBeenCalledWith(
      "buscar_citaciones",
      expect.objectContaining({ q: "medio ambiente", limite: 50, p_camara: null }),
    );
    // El `rank` NO se expone al cliente.
    expect(res).toHaveLength(1);
    expect(res[0]).not.toHaveProperty("rank");
    expect(res[0]!.boletin).toBe("12345-07");
  });

  it("empuja el filtro de cámara al RPC (p_camara), NO filtra en JS tras el LIMIT", async () => {
    rpcMock.mockResolvedValue({ data: [fila({ id: "c1", camara: "camara" })], error: null });
    const res = await buscarCitaciones("ley", { camara: "camara" });
    // El filtro va como argumento del RPC (el LIMIT se aplica DESPUÉS de restringir por cámara).
    expect(rpcMock).toHaveBeenCalledWith(
      "buscar_citaciones",
      expect.objectContaining({ p_camara: "camara" }),
    );
    expect(res).toHaveLength(1);
    expect(res[0]!.camara).toBe("camara");
  });

  it("rpc data null → []", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    expect(await buscarCitaciones("algo")).toEqual([]);
  });

  it("rpc error → LANZA (honest degradation: error ≠ vacío)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "permission denied for function buscar_citaciones" },
    });
    await expect(buscarCitaciones("algo que falla")).rejects.toThrow(
      /buscar_citaciones RPC falló/,
    );
  });
});

describe("buscarCitaciones — input validation (trim + cap ≤300)", () => {
  it("trimea y capea a ≤300 antes del rpc", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await buscarCitaciones(`  ${"a".repeat(500)}  `);
    const arg = rpcMock.mock.calls[0]![1] as { q: string };
    expect(arg.q.length).toBe(300);
  });
});
