import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests del GATE A NIVEL DE PÁGINA y la defensa jurídica de la cabecera de
 * /contraparte/[id] (16-UI-SPEC §Page Anatomy, reglas LOCKED). Verifican por
 * comportamiento (no por convención):
 *   - gate OFF (default) → notFound() ANTES de cualquier RPC; sin lectura de DB.
 *   - id inválido (regex) → notFound() ANTES de tocar la DB.
 *   - cabecera: id desconocido → notFound(); tipo_persona no jurídica → notFound()
 *     (defensa en profundidad sobre el filtro jurídica del RPC).
 *
 * `notFound()` lanza (semántica documentada de Next: NEXT_HTTP_ERROR_FALLBACK;404).
 * Lo mockeamos con un sentinel que podamos detectar. `createServerSupabase` se
 * mockea para PROBAR que con el gate OFF la DB NUNCA se toca.
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
const moneyEnabledMock = vi.fn<() => boolean>(() => false);
vi.mock("@/lib/money-gate", () => ({
  moneyPublicEnabled: () => moneyEnabledMock(),
}));

// RPC inyectable; rastrea si la DB se tocó.
const rpcMock = vi.fn();
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks. La cabecera no se exporta; la probamos vía el
// árbol de la página (Suspense) renderizando los hijos async. Para aislar el gate
// y la cabecera testeamos la función default y, por separado, montamos el header.
import ContrapartePage, { HeaderSection } from "./page";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  notFoundMock.mockClear();
  rpcMock.mockReset();
  createServerSupabaseMock.mockClear();
  moneyEnabledMock.mockReset();
});

function makeProps(id: string) {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  };
}

describe("/contraparte/[id] — gate a nivel de página (LOCKED)", () => {
  it("gate OFF (default) → notFound() ANTES de tocar la DB", async () => {
    moneyEnabledMock.mockReturnValue(false);
    await expect(ContrapartePage(makeProps("c:76123456-7"))).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    // La DB NUNCA se tocó: ni cliente ni RPC con el gate OFF.
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("gate ON + id inválido (regex) → notFound() ANTES de tocar la DB", async () => {
    moneyEnabledMock.mockReturnValue(true);
    await expect(
      ContrapartePage(makeProps("../etc/passwd")),
    ).rejects.toBeInstanceOf(NotFoundSignal);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("gate ON + id válido → NO 404 en el nivel de página (renderiza el árbol)", async () => {
    moneyEnabledMock.mockReturnValue(true);
    // La página en sí (gate + validación) no debe lanzar con un id válido; los
    // hijos async (HeaderSection/lanes) corren bajo Suspense, no en esta llamada.
    await expect(
      ContrapartePage(makeProps("c:76123456-7")),
    ).resolves.toBeTruthy();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("HeaderSection — defensa jurídica (T-16-07, LOCKED)", () => {
  it("id desconocido (RPC sin filas) → notFound()", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(HeaderSection({ id: "c:76123456-7" })).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("tipo_persona NO jurídica → notFound() (persona natural nunca se renderiza)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          facet: "contrato",
          contraparte_nombre: "Juan Pérez",
          tipo_persona: "natural",
          conteo: 1,
          filas: [],
        },
      ],
      error: null,
    });
    await expect(HeaderSection({ id: "c:11111111-1" })).rejects.toBeInstanceOf(
      NotFoundSignal,
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("error real de RPC → THROW (no 404, no 'sin datos') (#34)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(HeaderSection({ id: "c:76123456-7" })).rejects.toThrow(/boom/);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("jurídica válida → renderiza h1 con el nombre + badge 'Persona jurídica', SIN voto/causal", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          facet: "contrato",
          contraparte_nombre: "Constructora Andes SpA",
          tipo_persona: "juridica",
          conteo: 2,
          filas: [],
        },
      ],
      error: null,
    });
    const el = await HeaderSection({ id: "c:76123456-7" });
    const html = renderToStaticMarkup(el);
    expect(html).toContain("Constructora Andes SpA");
    expect(html).toContain("Persona jurídica");
    expect(notFoundMock).not.toHaveBeenCalled();
    // Anti-insinuación: la cabecera NUNCA trae voto ni lenguaje causal.
    expect(html).not.toMatch(/votaci|\bvoto\b/i);
    expect(html).not.toMatch(/a cambio de|favoreci|influy|su voto|correlaci/i);
  });
});
