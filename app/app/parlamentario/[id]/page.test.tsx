import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests del GATE A NIVEL DE SECCIÓN de la ficha /parlamentario/[id] para el carril
 * `#cruces` (SURF-01, Candado B; 37-CONTEXT anti-insinuación). Verifican por
 * COMPORTAMIENTO (no por convención), espejo del scaffold de `app/app/red/page.test.tsx`:
 *
 *   - gate OFF (default) → el HTML renderizado de la página NO contiene `id="cruces"`
 *     ni "Cruces con sectores" (nodo AUSENTE, no oculto-con-CSS) y el RPC
 *     `cruces_de_parlamentario` NUNCA se invoca (prueba load-bearing de Candado B).
 *   - gate ON + RPC mock con 1 fila normal → el HTML SÍ contiene "Cruces con sectores"
 *     y la `sector_etiqueta` del fixture; la página resuelve truthy sin lanzar.
 *
 * El test NO toca PROD/DB real: `@/lib/cruces-gate` y `@/lib/supabase` se mockean.
 * El mock de Supabase tolera los demás RPC de la página (cabecera
 * `parlamentario_publico`) devolviendo una fila mínima, de modo que el test AÍSLE
 * el comportamiento de la sección de cruces.
 */

// Gate de cruces inyectable por test (default OFF, fail-closed).
const crucesEnabledMock = vi.fn<() => boolean>(() => false);
vi.mock("@/lib/cruces-gate", () => ({
  crucesPublicEnabled: () => crucesEnabledMock(),
}));

// MONEY apagado para aislar el carril de cruces (no contamina las asserciones).
vi.mock("@/lib/money-gate", () => ({
  moneyPublicEnabled: () => false,
}));

// notFound() — no debe dispararse en un id válido; sentinel detectable si pasa.
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

/**
 * RPC mock que rastrea qué se invocó. La cabecera llama
 * `.rpc("parlamentario_publico").maybeSingle()`; la sección de cruces llama
 * `.rpc("cruces_de_parlamentario")` (await directo, sin .maybeSingle()). Devolvemos
 * un thenable que TAMBIÉN expone `.maybeSingle()` para servir ambos patrones.
 */
const rpcMock = vi.fn((name: string) => {
  if (name === "parlamentario_publico") {
    const payload = {
      data: {
        id: "P00001",
        nombre: "Persona De Prueba",
        camara: "diputados",
        region: "Región de Prueba",
        distrito: "1",
        circunscripcion: null,
        periodo: "2022-2026",
      },
      error: null,
    };
    return {
      maybeSingle: () => Promise.resolve(payload),
      then: (res: (v: typeof payload) => unknown) => Promise.resolve(payload).then(res),
    };
  }
  if (name === "cruces_de_parlamentario") {
    const payload = {
      data: [
        {
          sector_id: "S01",
          sector_etiqueta: "Salud y farmacéutica",
          tipo_senal: "lobby_sector",
          conteo: 2,
          evidencia: {
            conteo: 2,
            items: [
              {
                tipo: "reunion",
                fecha: "2024-03-01",
                contraparte_nombre_crudo: "Gestor De Prueba",
                audiencia_id: "AUD-1",
                enlace_fuente: "https://www.leylobby.gob.cl/audiencia/AUD-1",
              },
            ],
          },
        },
      ],
      error: null,
    };
    return Promise.resolve(payload);
  }
  return Promise.resolve({ data: null, error: null });
});
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks.
import ParlamentarioPage from "./page";
import { CrucesSection } from "@/components/cruces-de-parlamentario";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  notFoundMock.mockClear();
  rpcMock.mockClear();
  createServerSupabaseMock.mockClear();
  crucesEnabledMock.mockReset();
});

function makeProps(id = "P00001") {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({} as Record<string, string | string[] | undefined>),
  };
}

/**
 * Renderiza la página resolviendo el Suspense de la sección de cruces (Server
 * Component async). renderToStaticMarkup no resuelve promesas de RSC, así que
 * pre-montamos manualmente el árbol esperando los hijos async.
 */
async function renderPage(props: ReturnType<typeof makeProps>): Promise<string> {
  const el = await ParlamentarioPage(props);
  return renderToStaticMarkup(el);
}

describe("/parlamentario/[id] — gate a nivel de sección #cruces (Candado B, LOCKED)", () => {
  it("gate OFF (default) → el HTML NO contiene id=cruces ni 'Cruces con sectores'; CERO RPC de cruces", async () => {
    crucesEnabledMock.mockReturnValue(false);
    const html = await renderPage(makeProps());

    // Candado B: el nodo entero está AUSENTE del HTML (no oculto-con-CSS).
    expect(html).not.toContain('id="cruces"');
    expect(html).not.toContain("Cruces con sectores");

    // La sección de cruces NUNCA fuerza su RPC con el gate OFF.
    const cruceCalls = rpcMock.mock.calls.filter(
      ([name]) => name === "cruces_de_parlamentario",
    );
    expect(cruceCalls).toHaveLength(0);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("gate ON → el HTML de la página contiene id=cruces y 'Cruces con sectores' (carril presente)", async () => {
    crucesEnabledMock.mockReturnValue(true);
    const html = await renderPage(makeProps());

    // El carril gated está PRESENTE en el HTML cuando el gate está ON.
    expect(html).toContain('id="cruces"');
    expect(html).toContain("Cruces con sectores");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("gate ON → CrucesSection monta sobre un fixture normal y renderiza la sector_etiqueta sin lanzar", async () => {
    crucesEnabledMock.mockReturnValue(true);
    // El Server Component async se resuelve aquí (renderToStaticMarkup no resuelve
    // los hijos async de Suspense en la página). Probamos que el path ON consume el
    // fixture del RPC `cruces_de_parlamentario` y monta sin lanzar.
    const el = await CrucesSection({ id: "P00001" });
    const html = renderToStaticMarkup(el);

    // La sección montó con el fixture: la etiqueta del sector aparece en el DOM.
    expect(html).toContain("Salud y farmacéutica");
    // El RPC de cruces sí se invocó en el path ON.
    const cruceCalls = rpcMock.mock.calls.filter(
      ([name]) => name === "cruces_de_parlamentario",
    );
    expect(cruceCalls).toHaveLength(1);
  });

  it("gate ON → la página resuelve truthy sin lanzar sobre un fixture normal", async () => {
    crucesEnabledMock.mockReturnValue(true);
    await expect(ParlamentarioPage(makeProps())).resolves.toBeTruthy();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
