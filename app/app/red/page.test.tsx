import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests del GATE A NIVEL DE PÁGINA de /red (NET-02, candado B; 18-CONTEXT
 * anti-insinuación). Verifican por comportamiento (no por convención):
 *   - gate OFF (default) → notFound() como PRIMERA sentencia, ANTES de cualquier
 *     RPC; la DB NUNCA se toca y CERO DOM de NET se renderiza.
 *   - gate ON + sin semilla → estado honesto (picker), NO seedless whole-graph:
 *     NUNCA se llama subgrafo_red sin semilla.
 *   - gate ON + semilla inválida → notFound() ANTES de tocar la DB.
 *   - gate ON + semilla válida → subgrafo_red(p_id=seed) y monta la isla con el
 *     JSON del RPC; grafo VACÍO (0 aristas) → estado honesto, NUNCA un error.
 *   - error real del RPC → THROW (no 404, no "sin datos").
 *
 * `notFound()` lanza (semántica documentada de Next: NEXT_HTTP_ERROR_FALLBACK;404).
 * Lo mockeamos con un sentinel detectable. `createServerSupabase` se mockea para
 * PROBAR que con el gate OFF la DB NUNCA se toca.
 */

// Sentinel que `notFound()` lanza (mockeado).
class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundSignal";
  }
}

const notFoundMock = vi.fn(() => {
  throw new NotFoundSignal();
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

// Gate inyectable por test.
const netEnabledMock = vi.fn<() => boolean>(() => false);
vi.mock("@/lib/net-gate", () => ({
  netPublicEnabled: () => netEnabledMock(),
}));

// RPC inyectable; rastrea si la DB se tocó.
const rpcMock = vi.fn();
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks.
import RedPage from "./page";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  notFoundMock.mockClear();
  rpcMock.mockReset();
  createServerSupabaseMock.mockClear();
  netEnabledMock.mockReset();
});

function makeProps(seed?: string) {
  return {
    searchParams: Promise.resolve(seed === undefined ? {} : { seed }),
  };
}

describe("/red — gate a nivel de página (candado B, LOCKED)", () => {
  it("gate OFF (default) → notFound() ANTES de tocar la DB; CERO DOM de NET", async () => {
    netEnabledMock.mockReturnValue(false);
    await expect(RedPage(makeProps("D1009"))).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    // La DB NUNCA se tocó: ni cliente ni RPC con el gate OFF.
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("gate ON + sin semilla → estado honesto (picker), NUNCA seedless RPC", async () => {
    netEnabledMock.mockReturnValue(true);
    const el = await RedPage(makeProps(undefined));
    const html = renderToStaticMarkup(el);
    // Sin semilla NO se consulta la DB (no whole-graph enumeration).
    expect(rpcMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    // Estado honesto sobrio: invita a elegir, sin lenguaje insinuante.
    expect(html).toMatch(/parlamentari/i);
  });

  it("gate ON + semilla inválida → notFound() ANTES de tocar la DB", async () => {
    netEnabledMock.mockReturnValue(true);
    await expect(RedPage(makeProps("../etc/passwd"))).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("gate ON + semilla válida → subgrafo_red(p_id=seed) y monta la isla", async () => {
    netEnabledMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({
      data: {
        nodos: [{ id: "D1009", nombre: "Ada Aguilar", camara: "diputados" }],
        aristas: [],
      },
      error: null,
    });
    const el = await RedPage(makeProps("D1009"));
    expect(rpcMock).toHaveBeenCalledTimes(1);
    // Se consulta por la semilla EXACTA, nunca seedless.
    expect(rpcMock).toHaveBeenCalledWith(
      "subgrafo_red",
      expect.objectContaining({ p_id: "D1009" }),
    );
    expect(notFoundMock).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(el);
    // La isla recibió los datos (el placeholder muestra el nombre del nodo semilla).
    expect(html).toContain("Ada Aguilar");
  });

  it("gate ON + semilla válida + grafo VACÍO (0 aristas) → estado honesto, NO error", async () => {
    netEnabledMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({
      data: {
        nodos: [{ id: "D1009", nombre: "Ada Aguilar", camara: "diputados" }],
        aristas: [],
      },
      error: null,
    });
    // No debe lanzar: grafo vacío es un estado honesto, no un error.
    await expect(RedPage(makeProps("D1009"))).resolves.toBeTruthy();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("error real del RPC → THROW (no 404, no 'sin datos')", async () => {
    netEnabledMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(RedPage(makeProps("D1009"))).rejects.toThrow(/boom/);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
