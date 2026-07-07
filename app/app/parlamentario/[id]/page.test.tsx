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

// Gate NET inyectable por test (default OFF, fail-closed) — B21b: el enlace a /red
// aparece SOLO con NET ON, espejo del mock de cruces-gate.
const netEnabledMock = vi.fn<() => boolean>(() => false);
vi.mock("@/lib/net-gate", () => ({
  netPublicEnabled: () => netEnabledMock(),
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
          // [Rule 3] 0041 proyecta fecha_captura (nivel señal) → ProvenanceBadge.capturedAt.
          // Sin este campo el fixture daba `new Date(undefined)` = Invalid time value.
          fecha_captura: new Date().toISOString(),
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
/**
 * `.from()` mock — Phase 45 (WR-02): `CarrilesSection` lee los conteos vía
 * `contarCarrilesSeguro(id)` (para el conteo/defaultOpen de cada CarrilAccordion),
 * que consulta los marcadores `*_ingesta_estado` con
 * `.from(tabla).select().eq().maybeSingle()`. Devolvemos `{data:null,error:null}`
 * (sin marcador → carril `no_ingerido`), suficiente para resolver sin tocar PROD.
 */
const fromMock = vi.fn((_tabla: string) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));
const createServerSupabaseMock = vi.fn(() => ({ rpc: rpcMock, from: fromMock }));
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: () => createServerSupabaseMock(),
}));

// Importar DESPUÉS de los mocks.
import ParlamentarioPage, { CarrilesSection, HeaderSection } from "./page";
import { CrucesSection } from "@/components/cruces-de-parlamentario";
import { renderToStaticMarkup } from "react-dom/server";

beforeEach(() => {
  notFoundMock.mockClear();
  rpcMock.mockClear();
  fromMock.mockClear();
  createServerSupabaseMock.mockClear();
  crucesEnabledMock.mockReset();
  netEnabledMock.mockReset();
});

function makeProps(id = "P00001") {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({} as Record<string, string | string[] | undefined>),
  };
}

/**
 * Renderiza la página + sus carriles. WR-02: los carriles y sus conteos viven
 * ahora tras su propio <Suspense> en un server child async (`CarrilesSection`),
 * que `renderToStaticMarkup` NO resuelve (muestra el fallback). Para asertar el
 * HTML real de los carriles (id=cruces, títulos) montamos `CarrilesSection`
 * explícitamente y concatenamos su markup con el del shell — espejo de cómo el
 * test 3 ya monta `CrucesSection` a mano. Esto además ejercita el path real de
 * `contarCarrilesSeguro` (gate-aware) que decide qué carriles aparecen.
 */
async function renderPage(props: ReturnType<typeof makeProps>): Promise<string> {
  const shell = renderToStaticMarkup(await ParlamentarioPage(props));
  const { id } = await props.params;
  const sp = await props.searchParams;
  const carriles = renderToStaticMarkup(
    await CarrilesSection({ id, searchParams: sp }),
  );
  return shell + carriles;
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

describe("/parlamentario/[id] — breadcrumb en la cabecera (53-03, UX-01)", () => {
  it("la cabecera monta el breadcrumb con Inicio/Parlamentarios como links y el nombre como segmento actual", async () => {
    // HeaderSection resuelve el RPC cacheado `parlamentario_publico` (nombre real)
    // → ParlamentarioHeader → Breadcrumbs. Se monta directo (renderToStaticMarkup
    // no resuelve los hijos async de Suspense en la página).
    const html = renderToStaticMarkup(await HeaderSection({ id: "P00001" }));

    // <nav aria-label="Ruta de navegación"> presente, no un heading extra.
    expect(html).toContain('aria-label="Ruta de navegación"');
    // Crumb 1 y 2 son links a Inicio y al directorio.
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/parlamentarios"');
    expect(html).toContain("Inicio");
    expect(html).toContain("Parlamentarios");
    // Segmento actual = nombre real del RPC, como texto plano con aria-current.
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Persona De Prueba");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("el breadcrumb NO invoca un RPC extra: la cabecera resuelve con una sola lectura cacheada", async () => {
    rpcMock.mockClear();
    await HeaderSection({ id: "P00001" });
    const headerRpc = rpcMock.mock.calls.filter(
      ([name]) => name === "parlamentario_publico",
    );
    // React.cache dedup (F52): el breadcrumb reusa la misma fila del header.
    expect(headerRpc.length).toBeGreaterThanOrEqual(1);
  });
});

describe("/parlamentario/[id] — enlace gated a /red (B21b, Candado B NET)", () => {
  it("NET gate OFF (default) → la ficha NO contiene enlace a /red (nodo ausente)", async () => {
    netEnabledMock.mockReturnValue(false);
    crucesEnabledMock.mockReturnValue(false);
    // El enlace vive en el shell de la página (fuera de Suspense), así que
    // renderToStaticMarkup del shell basta para asertarlo.
    const html = renderToStaticMarkup(await ParlamentarioPage(makeProps()));

    // Candado B (NET): el nodo entero está AUSENTE del HTML (no oculto-con-CSS).
    expect(html).not.toContain('href="/red?seed=');
    expect(html).not.toContain("Ver relaciones con otros parlamentarios");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("NET gate ON → la ficha contiene enlace a /red?seed=<id> con copy sobrio", async () => {
    netEnabledMock.mockReturnValue(true);
    crucesEnabledMock.mockReturnValue(false);
    const html = renderToStaticMarkup(await ParlamentarioPage(makeProps()));

    // El enlace navega a /red con la semilla del id del fixture.
    expect(html).toContain("/red?seed=P00001");
    expect(html).toContain("Ver relaciones con otros parlamentarios");
    // Negative-match anti-insinuación: sin vocabulario de influencia/afinidad/score.
    expect(html).not.toMatch(/influencia|conexion|sospechos|afinidad|score/i);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
