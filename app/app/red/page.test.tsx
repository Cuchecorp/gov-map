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

// RPC inyectable; rastrea si la DB se tocó y con qué RPC (picker vs semilla).
const rpcMock = vi.fn();
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Fixture del selector de semilla (parlamentarios_publico, PII-safe): una fila por
// cámara para ejercitar los dos optgroups.
const PARLS_FIXTURE = [
  {
    id: "D1009",
    nombre: "Ada Aguilar",
    camara: "diputados",
    region: "Región de Prueba",
    distrito: "1",
    circunscripcion: null,
    periodo: "2022-2026",
  },
  {
    id: "S3001",
    nombre: "Bruno Bravo",
    camara: "senado",
    region: "Región de Prueba",
    distrito: null,
    circunscripcion: "2",
    periodo: "2022-2030",
  },
];

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

  it("gate ON + sin semilla → selector con optgroups por cámara (form GET), NUNCA subgrafo_red", async () => {
    netEnabledMock.mockReturnValue(true);
    rpcMock.mockImplementation((name: string) =>
      name === "parlamentarios_publico"
        ? Promise.resolve({ data: PARLS_FIXTURE, error: null })
        : Promise.resolve({ data: null, error: null }),
    );
    const el = await RedPage(makeProps(undefined));
    const html = renderToStaticMarkup(el);
    // El picker consulta parlamentarios_publico, NUNCA el grafo por semilla
    // (no whole-graph enumeration).
    const subgrafoCalls = rpcMock.mock.calls.filter(
      ([name]) => name === "subgrafo_red",
    );
    expect(subgrafoCalls).toHaveLength(0);
    expect(notFoundMock).not.toHaveBeenCalled();
    // Selector JS-free: form GET a /red, select name=seed, optgroups por cámara.
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/red"');
    expect(html).toContain('name="seed"');
    expect(html).toContain("<optgroup");
    expect(html).toContain('label="Cámara"');
    expect(html).toContain('label="Senado"');
    expect(html).toContain("Ada Aguilar");
    expect(html).toContain("Bruno Bravo");
    expect(html).toContain('value="D1009"');
    // Nota de uso conservada sin semilla (guía honesta del selector; NUNCA
    // afirma "mostrando toda la red" — no existe vista global en este gated).
    expect(html).toContain("Elige un parlamentario para ver");
  });

  it("error del RPC parlamentarios_publico en el picker → THROW (#34)", async () => {
    netEnabledMock.mockReturnValue(true);
    rpcMock.mockImplementation((name: string) =>
      name === "parlamentarios_publico"
        ? Promise.resolve({ data: null, error: { message: "boom" } })
        : Promise.resolve({ data: null, error: null }),
    );
    await expect(RedPage(makeProps(undefined))).rejects.toThrow(/boom/);
    expect(notFoundMock).not.toHaveBeenCalled();
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
    // La isla recibió los datos del RPC y se montó. Con un subgrafo sin aristas
    // (semilla sin relaciones materializadas todavía) la isla muestra su estado
    // honesto — NO inventa un nodo aislado como si fuera un grafo. Eso prueba que
    // la isla consumió el JSON del RPC (firma de props estable) sin lanzar.
    expect(html).toMatch(/aún no hay relaciones/i);
    // Ego-framing (55-05): nota de uso LOCKED con el nombre del nodo semilla,
    // derivado del subgrafo ya leído (cero query nueva).
    expect(html).toContain(
      "Centrado en Ada Aguilar y su vecindario inmediato.",
    );
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
