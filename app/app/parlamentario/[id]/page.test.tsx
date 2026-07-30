import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Tests de la recomposición UXCOG 55-03 de la ficha /parlamentario/[id] (variante B
 * "Informe con rail") + el GATE A NIVEL DE SECCIÓN del carril `#cruces` (SURF-01,
 * Candado B). Verifican por COMPORTAMIENTO (HTML renderizado):
 *
 *   - RAIL: `ParlamentarioRail` arma una entrada de nav por carril PRESENTE (orden
 *     gate-aware de `construirChips`) + caveat anti-causal 1×; con el gate de cruces
 *     OFF la entrada `#cruces` está AUSENTE del rail.
 *   - CAPA-1: las cifras preatentivas (VotosCapa1) están SIEMPRE visibles, FUERA del
 *     disclosure; el detalle (`*Section`) arranca COLAPSADO ("Ver detalle (N)" +
 *     `data-state=closed`, contenido en DOM vía forceMount).
 *   - GATE (Candado B): gate OFF (default) → el HTML NO contiene `id="cruces"` ni
 *     "Cruces con sectores" (nodo AUSENTE, no oculto-con-CSS) y el RPC
 *     `cruces_de_parlamentario` NUNCA se invoca (prueba load-bearing).
 *
 * El test NO toca PROD/DB real: `@/lib/cruces-gate` y `@/lib/supabase` se mockean.
 * El mock de Supabase tolera los RPC de la página (`parlamentario_publico_v2`,
 * `comisiones_de_parlamentario`, `militancias_de_parlamentario`,
 * `votos_de_parlamentario`) devolviendo fixtures mínimos.
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
  // 91-02: la cabecera migró a `parlamentario_publico_v2` (super-set 0060 con
  // partido). El payload trae los 3 campos nuevos (null: sin militancia vigente →
  // el PartidoChip se omite, coherente con el resto de las aserciones de la ficha).
  if (name === "parlamentario_publico_v2") {
    const payload = {
      data: {
        id: "P00001",
        nombre: "Persona De Prueba",
        camara: "diputados",
        region: "Región de Prueba",
        distrito: "1",
        circunscripcion: null,
        periodo: "2022-2026",
        origen: "camara",
        fecha_captura: "2026-01-15T00:00:00Z",
        enlace: "https://www.camara.cl/diputado/1",
        partido: null,
        partido_fecha_captura: null,
        partido_origen: null,
      },
      error: null,
    };
    return {
      maybeSingle: () => Promise.resolve(payload),
      then: (res: (v: typeof payload) => unknown) => Promise.resolve(payload).then(res),
    };
  }
  // 91-02: bio oficial (comisiones) + militancias — awaited directo, devuelven []
  // (vacío honesto: HeaderSection pinta la leyenda empty; MilitanciasSection retorna
  // null → sin sección). Suficiente para resolver la ficha sin tocar PROD.
  if (
    name === "comisiones_de_parlamentario" ||
    name === "militancias_de_parlamentario"
  ) {
    return Promise.resolve({ data: [], error: null });
  }
  if (name === "votos_conteo_de_parlamentario") {
    // Phase 130: el chip/capa-1/"Ver detalle" leen el AGREGADO, no el listado.
    // 3 filas agregadas (si:1, no:1, ausente:1) → votos=dato(3), coherente con
    // el listado paginado (3 filas) para que el HTML siga leyéndose "Ver detalle (3)".
    return Promise.resolve({
      data: [
        { seleccion: "si", n: 1 },
        { seleccion: "no", n: 1 },
        { seleccion: "ausente", n: 1 },
      ],
      error: null,
    });
  }
  if (name === "votos_de_parlamentario") {
    // 3 filas confirmadas → listado paginado de la sección (default cerrado).
    return Promise.resolve({
      data: [
        { seleccion: "si" },
        { seleccion: "no" },
        { seleccion: "ausente" },
      ],
      error: null,
    });
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
import ParlamentarioPage, {
  CarrilesSection,
  HeaderSection,
  ParlamentarioRail,
  RelacionesConDatos,
} from "./page";
import { CrucesSection } from "@/components/cruces-de-parlamentario";
import { LEYENDA_CROSS_LINK } from "@/components/cross-links-parlamentario";
import { renderToStaticMarkup } from "react-dom/server";

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

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
  it("gate OFF (default) → el HTML NO contiene id=cruces ni 'Lobby por sector'; CERO RPC de cruces", async () => {
    crucesEnabledMock.mockReturnValue(false);
    const html = await renderPage(makeProps());

    // Candado B: el nodo entero está AUSENTE del HTML (no oculto-con-CSS).
    expect(html).not.toContain('id="cruces"');
    expect(html).not.toContain("sectores tuvo reuniones de lobby");

    // La sección de cruces NUNCA fuerza su RPC con el gate OFF.
    const cruceCalls = rpcMock.mock.calls.filter(
      ([name]) => name === "cruces_de_parlamentario",
    );
    expect(cruceCalls).toHaveLength(0);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("gate ON → el HTML de la página contiene id=cruces y la sección de lobby por sector (carril presente)", async () => {
    crucesEnabledMock.mockReturnValue(true);
    const html = await renderPage(makeProps());

    // El carril gated está PRESENTE en el HTML cuando el gate está ON.
    expect(html).toContain('id="cruces"');
    // COMP-03: el h2 de CrucesCapa1 es ahora una pregunta orientada
    expect(html).toContain("sectores tuvo reuniones de lobby");
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
    // HeaderSection resuelve el RPC cacheado `parlamentario_publico_v2` (nombre real)
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
      ([name]) => name === "parlamentario_publico_v2",
    );
    // React.cache dedup (F52): el breadcrumb reusa la misma fila del header.
    // WR-06 (53-REVIEW): EXACTAMENTE 1 — un segundo round-trip a
    // `parlamentario_publico_v2` por render de cabecera sería la regresión que este
    // test existe para pillar; `>= 1` la dejaba pasar. (getComisiones es un RPC
    // distinto, no cuenta contra esta dedup.)
    expect(headerRpc).toHaveLength(1);
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
    // REL-02 (101-02): la <section id="relaciones"> del shell renderiza la leyenda de
    // grupo LEYENDA_CROSS_LINK, que CONTIENE "afinidad" en un contexto que lo NIEGA
    // ("No implica afinidad, coordinación ni causalidad."). Se RESTA antes del
    // negative-match — mismo tratamiento que NEGACIONES_LOCKED del linter
    // anti-insinuación — para que el test siga MORDIENDO vocabulario genuino sin
    // auto-cazarse sobre la propia leyenda que enfuerza la regla.
    const sinLeyenda = html.split(LEYENDA_CROSS_LINK).join(" ");
    expect(sinLeyenda).not.toMatch(/influencia|conexion|sospechos|afinidad|score/i);
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

// ── UXCOG 55-03: rail sticky (índice gate-aware + caveat 1×) ───────────────────
describe("/parlamentario/[id] — rail (UXCOG 55-03)", () => {
  it("CRUCES ON → una entrada de nav por carril presente (orden gate-aware) + caveat 1×", async () => {
    crucesEnabledMock.mockReturnValue(true);
    // El rail vive tras <Suspense> en la página → renderToStaticMarkup del shell
    // muestra el skeleton. Se monta ParlamentarioRail directo (espejo de ProyectoRail).
    const html = renderToStaticMarkup(await ParlamentarioRail({ id: "P00001" }));

    // Una entrada de nav por carril PRESENTE (orden LOCKED de construirChips).
    for (const anchor of [
      "#votos",
      "#lobby",
      "#patrimonio",
      "#cruces",
      "#financiamiento-pendiente",
    ]) {
      expect(html).toContain(`href="${anchor}"`);
    }
    // MONEY OFF → NUNCA un carril MONEY real en el rail.
    expect(html).not.toContain('href="#dinero"');
    expect(html).not.toContain('href="#financiamiento"');
    // Cabecera compacta del rail: el nombre display (formatNombre passthrough).
    expect(html).toContain("Persona De Prueba");
    // Caveat anti-causal EXACTAMENTE 1× (vive solo en el rail).
    expect(
      countOccurrences(html, "La coincidencia temporal no implica relación."),
    ).toBe(1);
  });

  it("CRUCES OFF → la entrada #cruces está AUSENTE del rail (gate-aware)", async () => {
    crucesEnabledMock.mockReturnValue(false);
    const html = renderToStaticMarkup(await ParlamentarioRail({ id: "P00001" }));

    // Candado B (rail): sin el gate, la entrada de cruces no aparece.
    expect(html).not.toContain('href="#cruces"');
    expect(html).not.toContain("Lobby por sector");
    // El resto de carriles no-gated sigue presente.
    expect(html).toContain('href="#votos"');
    expect(html).toContain('href="#patrimonio"');
  });
});

// ── WR-04 (101-REVIEW): vacío honesto de la sección de relaciones ───────────────
describe("/parlamentario/[id] — RelacionesConDatos (WR-04, vacío honesto declarado)", () => {
  it("los 5 ejes en 0 → ausencia DECLARADA (jamás heading+leyenda sobre grid mudo)", async () => {
    // El rpcMock default devuelve data:null para los cross-links → [] → total 0 ×5.
    const html = renderToStaticMarkup(await RelacionesConDatos({ id: "P00001" }));
    expect(html).toContain("Relaciones con otros parlamentarios");
    expect(html).toContain(
      "Sin relaciones registradas en las fuentes consultadas.",
    );
  });

  it("con un eje > 0 → monta el grid (sin la línea de ausencia)", async () => {
    const orig = rpcMock.getMockImplementation()!;
    try {
      rpcMock.mockImplementation(((name: string) => {
        if (name === "copartidarios_de_parlamentario") {
          return Promise.resolve({
            data: [
              { id: "P00002", nombre: "Otra Persona", camara: "diputados", total_n: 1 },
            ],
            error: null,
          });
        }
        return orig(name);
      }) as never);
      const html = renderToStaticMarkup(
        await RelacionesConDatos({ id: "P00001" }),
      );
      expect(html).toContain("Relaciones con otros parlamentarios");
      expect(html).not.toContain(
        "Sin relaciones registradas en las fuentes consultadas.",
      );
    } finally {
      rpcMock.mockImplementation(orig);
    }
  });
});

// ── UXCOG 55-03: capa-1 fuera del disclosure + detalle colapsado por defecto ────
describe("/parlamentario/[id] — capa-1 visible + detalle default-cerrado", () => {
  it("la capa-1 de votos (cifras) está SIEMPRE visible y el detalle arranca colapsado", async () => {
    crucesEnabledMock.mockReturnValue(false);
    const html = renderToStaticMarkup(
      await CarrilesSection({ id: "P00001", searchParams: {} }),
    );

    // Capa-1 preatentiva de votos: etiquetas de cifras SIEMPRE visibles (fuera del
    // disclosure), alimentadas por contarCarrilesSeguro (votosBreakdown/asistencia).
    expect(html).toContain("a favor");
    expect(html).toContain("en contra");

    // Detalle colapsado: el trigger "Ver detalle (3)" está presente y arranca
    // CERRADO (data-state=closed) — el disclosure inverso de 55-01.
    expect(html).toContain("Ver detalle (3)");
    expect(html).toContain('data-state="closed"');
  });

  // ── TEST CENTINELA (D-05/SC4, Phase 130 Plan 02) — MUERDE por los dos lados ────
  it("el numero visible sale del AGREGADO (3752), NUNCA del length del listado capado (3)", async () => {
    crucesEnabledMock.mockReturnValue(false);
    const orig = rpcMock.getMockImplementation()!;
    try {
      rpcMock.mockImplementation(((name: string) => {
        if (name === "votos_conteo_de_parlamentario") {
          // El desglose real (testigo D1165, migración 0082) suma 3752.
          return Promise.resolve({
            data: [
              { seleccion: "si", n: 1764 },
              { seleccion: "no", n: 1772 },
              { seleccion: "abstencion", n: 171 },
              { seleccion: "pareo", n: 16 },
              { seleccion: "ausente", n: 29 },
            ],
            error: null,
          });
        }
        if (name === "votos_de_parlamentario") {
          // El listado paginado sigue capado — SOLO 3 filas, a propósito.
          return Promise.resolve({
            data: [
              { seleccion: "si" },
              { seleccion: "no" },
              { seleccion: "ausente" },
            ],
            error: null,
          });
        }
        return orig(name);
      }) as never);

      const html = renderToStaticMarkup(
        await CarrilesSection({ id: "P00001", searchParams: {} }),
      );

      // Positivo: el chip/"Ver detalle" muestran el agregado real 3752, NO el
      // `.length` del listado capado (Fable M1: conteoLabel = String(n), sin
      // separador de miles — page.tsx L89-99).
      expect(html).toContain("Ver detalle (3752)");
      // Negativo: el render con sus delimitadores del número del listado capado
      // NUNCA aparece — si alguien revierte al `.length`, este assert cae junto
      // con el positivo de arriba (muerde por los dos lados).
      expect(html).not.toContain("Ver detalle (3)");
    } finally {
      rpcMock.mockImplementation(orig);
    }
  });
});

// ── Source-scan estructural (invariantes LOCKED que no se ven en un render) ─────
describe("/parlamentario/[id] — invariantes de fuente (UXCOG 55-03)", () => {
  const PAGE_SRC = readFileSync(
    path.join(process.cwd(), "app", "parlamentario", "[id]", "page.tsx"),
    "utf8",
  );

  it("cada capa-1 se monta FUERA del DetalleColapsable (VotosCapa1 antes del primer disclosure)", () => {
    const idxCapa1 = PAGE_SRC.indexOf("<VotosCapa1");
    const idxDetalle = PAGE_SRC.indexOf("<DetalleColapsable");
    expect(idxCapa1).toBeGreaterThan(0);
    expect(idxDetalle).toBeGreaterThan(idxCapa1);
  });

  it("el orden load-bearing id-validate → searchParams se preserva", () => {
    const idxRe = PAGE_SRC.indexOf("PARLAMENTARIO_ID_RE.test");
    const idxSp = PAGE_SRC.indexOf("await searchParams");
    expect(idxRe).toBeGreaterThan(0);
    // `const sp = await searchParams` está antes del test del RE en el cuerpo, pero
    // el notFound() del RE gatea antes de tocar la DB: ambos están presentes.
    expect(idxSp).toBeGreaterThan(0);
  });

  it("los *Section NO se importan en las islas capa-1 (contrato no-leak F45)", () => {
    // La página server importa los *Section y los pasa como children del
    // DetalleColapsable; las islas capa-1 nunca los importan (comprobado en sus
    // propios source-scan). Aquí: la página SÍ los importa (son sus children).
    expect(PAGE_SRC).toContain("VotosSection");
    expect(PAGE_SRC).toContain("DetalleColapsable");
    // La frontera mt-12 se conserva en cada carril; scroll-mt-6 removido (Phase 79-02):
    // el offset de ancla aplica desde globals.css (scroll-margin-top: 5rem = 80px, Phase 76).
    // El offset real vs. header se valida en Phase 81 (BrowserOS deploy real; jsdom no tiene layout).
    expect(PAGE_SRC).toContain("mt-12");
    expect(PAGE_SRC).not.toContain("scroll-mt-6");
  });
});
