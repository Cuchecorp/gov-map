import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";

import { RedGraph, type Subgrafo } from "./red-graph";

/**
 * Tests de la isla <RedGraph> (NET-02, 18-CONTEXT anti-insinuación HARD).
 *
 * @xyflow/react mide el DOM (ResizeObserver) y no produce un layout real en
 * jsdom; por eso aquí NO renderizamos el lienzo de xyflow, sino que verificamos
 * (1) el proyectado de datos a nodo/arista (los componentes custom puros) y
 * (2) los controles de filtro + el estado honesto. El render del lienzo xyflow
 * se prueba sólo en navegador (fuera de jsdom). Mockeamos `@xyflow/react` con un
 * doble ligero que invoca los `nodeTypes`/`edgeTypes` con sus datos, de modo que
 * el copy sobrio del nodo/arista y el tooltip de procedencia sí se ejercitan.
 */

// jsdom no trae ResizeObserver (xyflow lo usa).
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// Doble ligero de @xyflow/react: renderiza cada nodo/arista con su componente
// custom y sus datos, sin el lienzo SVG real (que no funciona en jsdom).
vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    ReactFlow: ({
      nodes,
      edges,
      nodeTypes,
      edgeTypes,
      fitViewOptions,
    }: {
      nodes: {
        id: string;
        type: string;
        data: unknown;
        position: { x: number; y: number };
      }[];
      edges: { id: string; type: string; data: unknown }[];
      nodeTypes: Record<string, React.ComponentType<{ data: unknown }>>;
      edgeTypes: Record<string, React.ComponentType<{ data: unknown }>>;
      fitViewOptions?: { nodes?: { id: string }[] };
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": "rf-canvas",
          // Expone el ego-framing (fitViewOptions.nodes) para poder asertar que
          // con seedId se encuadra el vecindario del seed, no el grafo global.
          "data-fitview-nodes": JSON.stringify(
            (fitViewOptions?.nodes ?? []).map((n) => n.id),
          ),
        },
        // Cada nodo se envuelve en un div que expone su posición inyectada
        // (data-x/data-y) para poder asertar el layout determinista por carril.
        nodes.map((n) => {
          const Cmp = nodeTypes[n.type];
          return React.createElement(
            "div",
            {
              key: n.id,
              "data-testid": `rf-node-${n.id}`,
              "data-x": String(n.position?.x),
              "data-y": String(n.position?.y),
            },
            React.createElement(Cmp, { data: n.data }),
          );
        }),
        edges.map((e) => {
          const Cmp = edgeTypes[e.type];
          return Cmp
            ? React.createElement(Cmp, { key: e.id, data: e.data })
            : null;
        }),
      ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
    BaseEdge: ({ label }: { label?: React.ReactNode }) =>
      React.createElement("div", null, label),
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    getStraightPath: () => ["", 0, 0],
  };
});

afterEach(cleanup);

const dos_nodos: Subgrafo["nodos"] = [
  { id: "D1009", nombre: "Ada Aguilar", camara: "diputados" },
  { id: "D2011", nombre: "Bruno Bravo", camara: "diputados" },
];

function arista(
  over: Partial<Subgrafo["aristas"][number]> = {},
): Subgrafo["aristas"][number] {
  return {
    tipo: "co_lobby_contraparte",
    a: "D1009",
    b: "D2011",
    contexto: "Empresa Equis SpA",
    desde: "2024-03-01T00:00:00Z",
    hasta: "2024-05-01T00:00:00Z",
    dataset: "lobby",
    origen: "leylobby",
    enlace: "https://www.leylobby.gob.cl/audiencia/123",
    licencia: null,
    ...over,
  };
}

describe("RedGraph — nodo sobrio (T-18-08: nombre + cámara, sin partido/foto/score)", () => {
  it("el nodo muestra nombre + cámara", () => {
    render(
      <RedGraph subgrafo={{ nodos: dos_nodos, aristas: [arista()] }} />,
    );
    expect(screen.getByText("Ada Aguilar")).toBeInTheDocument();
    expect(screen.getByText("Bruno Bravo")).toBeInTheDocument();
    expect(screen.getAllByText(/diputados/i).length).toBeGreaterThan(0);
  });

  it("el nodo NO renderiza partido, foto ni insignia de valoración", () => {
    const { container } = render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista()],
        }}
      />,
    );
    // Sin <img> (foto) en el nodo.
    expect(container.querySelector("img")).toBeNull();
    // El DOM proyectado no debe contener vocabulario de afiliación ni valoración.
    const txt = container.textContent ?? "";
    expect(txt).not.toMatch(/partido/i);
    expect(txt).not.toMatch(/puntaje|score|ranking/i);
  });

  // ── 62-02 (RED-02): borde institucional por cámara (no posición, no partido) ──
  it("un nodo de diputados lleva la clase net-nodo--camara y uno de senado net-nodo--senado", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D1", nombre: "Diputada Uno", camara: "diputados" },
      { id: "S1", nombre: "Senador Uno", camara: "senado" },
    ];
    const { container } = render(
      <RedGraph
        subgrafo={{ nodos, aristas: [arista({ a: "D1", b: "S1" })] }}
      />,
    );
    const dip = within(container).getByTestId("rf-node-D1");
    const sen = within(container).getByTestId("rf-node-S1");
    expect(dip.querySelector(".net-nodo--camara")).not.toBeNull();
    expect(dip.querySelector(".net-nodo--senado")).toBeNull();
    expect(sen.querySelector(".net-nodo--senado")).not.toBeNull();
    expect(sen.querySelector(".net-nodo--camara")).toBeNull();
  });

  it("un nodo con cámara null no lleva ninguna clase de borde de cámara", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "X1", nombre: "Sin Cámara", camara: null },
      { id: "D2", nombre: "Diputado Dos", camara: "diputados" },
    ];
    const { container } = render(
      <RedGraph
        subgrafo={{ nodos, aristas: [arista({ a: "X1", b: "D2" })] }}
      />,
    );
    const sinCamara = within(container).getByTestId("rf-node-X1");
    expect(sinCamara.querySelector(".net-nodo--camara")).toBeNull();
    expect(sinCamara.querySelector(".net-nodo--senado")).toBeNull();
  });

  it("ningún nodo pinta color de partido ni accent-product inline", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D1", nombre: "Diputada Uno", camara: "diputados" },
      { id: "S1", nombre: "Senador Uno", camara: "senado" },
    ];
    const { container } = render(
      <RedGraph
        subgrafo={{ nodos, aristas: [arista({ a: "D1", b: "S1" })] }}
      />,
    );
    container.querySelectorAll(".net-nodo").forEach((n) => {
      const style = n.getAttribute("style") ?? "";
      expect(style).not.toMatch(/accent-product/i);
      expect(style).not.toMatch(/background/i);
    });
    expect((container.textContent ?? "").toLowerCase()).not.toMatch(/partido/i);
  });
});

describe("RedGraph — arista = hecho tipado (T-18-09: copy del hecho, sin afinidad/causal)", () => {
  it("la etiqueta describe el hecho con la contraparte, sin lenguaje de afinidad/causa", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ contexto: "Empresa Equis SpA" })],
        }}
      />,
    );
    // El hecho: ambos recibieron audiencia de la misma contraparte. El copy
    // nombra la contraparte y describe la co-ocurrencia, sin valoración.
    expect(
      screen.getByText(/Ambos recibieron audiencia de Empresa Equis SpA/i),
    ).toBeInTheDocument();
  });

  it("la arista expone la ventana temporal (desde/hasta)", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista()],
        }}
      />,
    );
    // Fechas literales de la ventana (formato ISO yyyy-mm-dd visible en algún lugar).
    expect(screen.getAllByText(/2024-03-01/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2024-05-01/).length).toBeGreaterThan(0);
  });
});

describe("RedGraph — provenance por arista (origen + ventana + enlace + licencia)", () => {
  it("expone origen y enlace a la fuente", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista()],
        }}
      />,
    );
    expect(screen.getByText(/leylobby/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /fuente/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.leylobby.gob.cl/audiencia/123",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("propaga la atribución cuando la fila trae licencia (CC BY 4.0)", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ licencia: "CC BY 4.0" })],
        }}
      />,
    );
    expect(screen.getByText(/CC BY 4\.0/)).toBeInTheDocument();
  });

  it("con licencia NULL NO afirma atribución", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ licencia: null })],
        }}
      />,
    );
    expect(screen.queryByText(/CC BY/)).not.toBeInTheDocument();
  });

  it("un enlace con esquema peligroso (javascript:) NO se enlaza", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ enlace: "javascript:alert(1)" })],
        }}
      />,
    );
    expect(screen.queryByRole("link", { name: /fuente/i })).not.toBeInTheDocument();
  });
});

describe("RedGraph — filtros por tipo y por tiempo", () => {
  it("ofrece un control de filtro por tipo de arista", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista()],
        }}
      />,
    );
    // El control de filtro por tipo existe (checkbox o select etiquetado).
    const tipoCtl = screen.getByLabelText(/tipo de relaci/i);
    expect(tipoCtl).toBeInTheDocument();
  });

  it("ofrece controles de ventana temporal (desde/hasta)", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista()],
        }}
      />,
    );
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it("destildar un tipo oculta sus aristas del lienzo", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ contexto: "Empresa Equis SpA" })],
        }}
      />,
    );
    // Arista visible inicialmente.
    expect(screen.getByText(/Empresa Equis SpA/)).toBeInTheDocument();
    // Destildar el tipo de relación.
    const tipoCtl = screen.getByLabelText(/tipo de relaci/i);
    fireEvent.click(tipoCtl);
    // Ya no debe mostrarse la arista (sale del set visible).
    expect(screen.queryByText(/Empresa Equis SpA/)).not.toBeInTheDocument();
  });

  it("una ventana 'hasta' anterior a la arista la oculta", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: dos_nodos,
          aristas: [
            arista({
              contexto: "Empresa Equis SpA",
              desde: "2024-03-01T00:00:00Z",
              hasta: "2024-05-01T00:00:00Z",
            }),
          ],
        }}
      />,
    );
    expect(screen.getByText(/Empresa Equis SpA/)).toBeInTheDocument();
    const hasta = screen.getByLabelText(/hasta/i);
    // Ventana que termina antes de que empiece la arista → fuera de rango.
    fireEvent.change(hasta, { target: { value: "2024-01-01" } });
    expect(screen.queryByText(/Empresa Equis SpA/)).not.toBeInTheDocument();
  });
});

describe("RedGraph — estado honesto (grafo vacío, NUNCA error/nodo falso)", () => {
  it("0 aristas → estado honesto sobrio, sin lienzo de grafo", () => {
    const { container } = render(
      <RedGraph subgrafo={{ nodos: dos_nodos, aristas: [] }} />,
    );
    expect(screen.getByText(/aún no hay relaciones/i)).toBeInTheDocument();
    // No se monta el lienzo de xyflow cuando no hay aristas.
    expect(
      within(container).queryByTestId("rf-canvas"),
    ).not.toBeInTheDocument();
  });

  it("subgrafo null → estado honesto, sin crash", () => {
    render(<RedGraph subgrafo={null} />);
    expect(screen.getByText(/aún no hay relaciones/i)).toBeInTheDocument();
  });

  // ── F-03 (53-04): línea de continuación en el grafo vacío ──────────────────────
  it("F-03: grafo vacío → shipped honesto byte-idéntico + UNA línea de continuación a /parlamentarios", () => {
    render(<RedGraph subgrafo={{ nodos: dos_nodos, aristas: [] }} />);
    // (a) el párrafo honesto shipped sigue presente byte-idéntico.
    expect(
      screen.getByText(
        "Aún no hay relaciones para mostrar para este parlamentario. Cuando existan hechos públicos que vinculen a dos parlamentarios —por ejemplo, haber recibido audiencia de la misma contraparte de lobby— aparecerán aquí, cada uno con su fuente y su fecha.",
      ),
    ).toBeInTheDocument();
    // (b) exactamente UN link (no hay lienzo) → la continuación al directorio.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    const cont = screen.getByRole("link", { name: /directorio de parlamentarios/ });
    expect(cont).toHaveAttribute("href", "/parlamentarios");
  });
});

describe("RedGraph — nodos huérfanos excluidos (B20a)", () => {
  const tres_nodos: Subgrafo["nodos"] = [
    { id: "D1", nombre: "Diputada Uno", camara: "diputados" },
    { id: "D2", nombre: "Diputado Dos", camara: "diputados" },
    { id: "D3", nombre: "Diputada Tres", camara: "diputados" },
  ];

  it("un nodo sin arista visible NO se monta en el lienzo", () => {
    render(
      <RedGraph
        subgrafo={{
          nodos: tres_nodos,
          // Única arista D1↔D2 → D3 queda huérfano.
          aristas: [arista({ a: "D1", b: "D2" })],
        }}
      />,
    );
    // D1/D2 participan de la arista visible → presentes.
    expect(screen.getByText("Diputada Uno")).toBeInTheDocument();
    expect(screen.getByText("Diputado Dos")).toBeInTheDocument();
    // D3 no participa de ninguna arista visible → AUSENTE del lienzo.
    expect(screen.queryByText("Diputada Tres")).not.toBeInTheDocument();
  });

  it("destildar el tipo saca también sus nodos (lienzo ausente)", () => {
    const { container } = render(
      <RedGraph
        subgrafo={{
          nodos: tres_nodos,
          aristas: [arista({ a: "D1", b: "D2" })],
        }}
      />,
    );
    // El lienzo existe con la arista visible.
    expect(within(container).queryByTestId("rf-canvas")).toBeInTheDocument();
    // Destildar el único tipo → aristasVisibles = 0 → el lienzo entero no monta,
    // así que ningún nodo (ni huérfano ni conectado) queda flotando.
    fireEvent.click(screen.getByLabelText(/tipo de relaci/i));
    expect(
      within(container).queryByTestId("rf-canvas"),
    ).not.toBeInTheDocument();
  });

});

// ── CR-01 (62-REVIEW): filtros que dejan al seed sin vecino → estado honesto ──────
describe("RedGraph — seed sin vecino visible = estado honesto, no seed suelto (CR-01)", () => {
  it("filtro de fecha que mata las aristas seed↔vecino (sobrevive vecino↔vecino) NO deja al seed solo y muestra el mensaje honesto", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0001", nombre: "Ana Alvarado", camara: "diputados" }, // seed
      { id: "V1", nombre: "Bruno Barros", camara: "diputados" },
      { id: "V2", nombre: "Carla Cortés", camara: "diputados" },
    ];
    const { container } = render(
      <RedGraph
        seedId="D0001"
        subgrafo={{
          nodos,
          aristas: [
            // Única arista seed↔vecino, en enero.
            arista({
              a: "D0001",
              b: "V1",
              desde: "2024-01-01T00:00:00Z",
              hasta: "2024-01-31T00:00:00Z",
            }),
            // Arista vecino↔vecino en marzo (sobrevive un filtro desde feb).
            arista({
              a: "V1",
              b: "V2",
              desde: "2024-03-01T00:00:00Z",
              hasta: "2024-03-31T00:00:00Z",
            }),
          ],
        }}
      />,
    );
    // Filtrar desde 2024-02-01: la arista de enero (seed↔vecino) sale de rango,
    // la de marzo (vecino↔vecino) sobrevive → aristasVisibles > 0 pero el seed
    // queda sin vecino.
    fireEvent.change(screen.getByLabelText(/desde/i), {
      target: { value: "2024-02-01" },
    });
    // NO se monta el lienzo con el seed suelto.
    expect(
      within(container).queryByTestId("rf-canvas"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="rf-node-D0001"]'),
    ).toBeNull();
    // Se muestra el mensaje honesto en vez del seed flotando.
    expect(
      screen.getByText(/Ninguna relación coincide con los filtros/i),
    ).toBeInTheDocument();
  });
});

// ── WR-04 (62-REVIEW): self-loop del seed no lo mete en su propio anillo ──────────
describe("RedGraph — self-loop del seed excluido (WR-04)", () => {
  it("un self-loop (a===b===seed) NO duplica el seed en el lienzo", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0001", nombre: "Ana Alvarado", camara: "diputados" }, // seed
      { id: "V1", nombre: "Bruno Barros", camara: "diputados" },
    ];
    const { container } = render(
      <RedGraph
        seedId="D0001"
        subgrafo={{
          nodos,
          aristas: [
            // Arista malformada: self-loop del propio seed.
            arista({ a: "D0001", b: "D0001" }),
            // Arista legítima seed↔vecino.
            arista({ a: "D0001", b: "V1" }),
          ],
        }}
      />,
    );
    // El seed aparece EXACTAMENTE una vez (centro), nunca también en el anillo.
    const seedNodos = container.querySelectorAll(
      '[data-testid="rf-node-D0001"]',
    );
    expect(seedNodos.length).toBe(1);
    // El vecino legítimo sí está.
    expect(
      container.querySelector('[data-testid="rf-node-V1"]'),
    ).not.toBeNull();
  });
});

// ── WR-05 (62-REVIEW): nombre "" cae al id (no nombre accesible vacío) ────────────
describe("RedGraph — fallback de nombre vacío al id (WR-05)", () => {
  it("un vecino con nombre='' usa su id como texto (móvil + overflow)", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0001", nombre: "Ana Alvarado", camara: "diputados" }, // seed
      { id: "V_SIN", nombre: "", camara: "diputados" }, // nombre vacío
    ];
    const { container } = render(
      <RedGraph
        seedId="D0001"
        subgrafo={{
          nodos,
          aristas: [arista({ a: "D0001", b: "V_SIN" })],
        }}
      />,
    );
    // El vecino sin nombre cae a su id en la lista móvil (nombre accesible no vacío).
    const lista = container.querySelector(".net-vecinos") as HTMLElement | null;
    expect(lista).not.toBeNull();
    expect(within(lista!).getByText("V_SIN")).toBeInTheDocument();
  });
});

// ── 62-01 (RED-02): layout radial ego-céntrico determinista + orden alfabético ────
describe("RedGraph — layout radial determinista y alfabético (RED-02)", () => {
  // Seed D0001 + 3 vecinos cuyos nombres llegan DESORDENADOS en el array.
  const seedYVecinos = (): Subgrafo => ({
    nodos: [
      { id: "D0001", nombre: "Zulema Zamora", camara: "diputados" }, // seed
      { id: "V_C", nombre: "Carlos Carrasco", camara: "diputados" },
      { id: "V_A", nombre: "Ana Alvarado", camara: "diputados" },
      { id: "V_B", nombre: "Bruno Barros", camara: "diputados" },
    ],
    aristas: [
      arista({ a: "D0001", b: "V_C" }),
      arista({ a: "D0001", b: "V_A" }),
      arista({ a: "D0001", b: "V_B" }),
    ],
  });

  const pos = (container: HTMLElement, id: string) => {
    const el = within(container).getByTestId(`rf-node-${id}`);
    return {
      x: Number(el.getAttribute("data-x")),
      y: Number(el.getAttribute("data-y")),
    };
  };

  it("el seed va al centro (0,0) y el vecino alfabético 0 cae a las 12 en punto", () => {
    const { container } = render(
      <RedGraph seedId="D0001" subgrafo={seedYVecinos()} />,
    );
    // Seed centrado.
    const seed = pos(container, "D0001");
    expect(seed.x).toBe(0);
    expect(seed.y).toBe(0);
    // Orden alfabético de vecinos: Ana (V_A) < Bruno (V_B) < Carlos (V_C).
    // El vecino alfabético 0 (Ana) cae a las 12 en punto: x≈0, y negativo.
    const ana = pos(container, "V_A");
    expect(Math.abs(ana.x)).toBeLessThan(2); // ≈0
    expect(ana.y).toBeLessThan(0); // arriba del centro (12 en punto)
  });

  it("la posición es función pura del índice alfabético, invariante al orden del array de entrada", () => {
    const base = seedYVecinos();
    const { container: c1 } = render(
      <RedGraph seedId="D0001" subgrafo={base} />,
    );
    const snap1 = {
      V_A: pos(c1, "V_A"),
      V_B: pos(c1, "V_B"),
      V_C: pos(c1, "V_C"),
    };
    cleanup();

    // Reordenar el array de nodos de entrada (mismo set) NO debe cambiar posiciones.
    const reordenado: Subgrafo = {
      nodos: [base.nodos[2], base.nodos[0], base.nodos[3], base.nodos[1]],
      aristas: [base.aristas[2], base.aristas[0], base.aristas[1]],
    };
    const { container: c2 } = render(
      <RedGraph seedId="D0001" subgrafo={reordenado} />,
    );
    expect(pos(c2, "V_A")).toEqual(snap1.V_A);
    expect(pos(c2, "V_B")).toEqual(snap1.V_B);
    expect(pos(c2, "V_C")).toEqual(snap1.V_C);
  });
});

// ── 62-01 (RED-01): conteo de nodos ≤ cap+1 + "N vecinos más" honesto ─────────────
describe("RedGraph — cap de vecinos ≤24 + 'N vecinos más' honesto (RED-01)", () => {
  const seedCon30Vecinos = (): Subgrafo => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0000", nombre: "Zzz Semilla", camara: "diputados" },
    ];
    const aristas: Subgrafo["aristas"] = [];
    for (let i = 0; i < 30; i++) {
      const id = `V${String(i).padStart(2, "0")}`;
      // Nombres alfabéticos deterministas: "Aaa 00" … con prefijo por índice.
      const letra = String.fromCharCode(65 + (i % 26));
      nodos.push({
        id,
        nombre: `${letra}${String(i).padStart(2, "0")} Vecino`,
        camara: "diputados",
      });
      aristas.push(arista({ a: "D0000", b: id }));
    }
    return { nodos, aristas };
  };

  it("con 30 vecinos, el DOM tiene exactamente 25 nodos (24 vecinos + seed)", () => {
    const { container } = render(
      <RedGraph seedId="D0000" subgrafo={seedCon30Vecinos()} />,
    );
    const nodos = container.querySelectorAll('[data-testid^="rf-node-"]');
    expect(nodos.length).toBe(25);
  });

  it("aparece 'Ver 6 vecinos más' (30 − 24) con cada nombre un Link a /red?seed=", () => {
    const { container } = render(
      <RedGraph seedId="D0000" subgrafo={seedCon30Vecinos()} />,
    );
    expect(screen.getByText(/Ver\s+6\s+vecinos más/i)).toBeInTheDocument();
    // Los overflow son Links a /red?seed=<id>. Se cuentan DENTRO del bloque de
    // overflow (.net-vecinos-mas): la lista móvil de vecinos (.net-vecinos) también
    // enlaza a /red?seed= por cada vecino renderizado, así que el conteo se acota al
    // control de truncación, no a todo el DOM.
    const overflowBlock = container.querySelector(
      ".net-vecinos-mas",
    ) as HTMLElement | null;
    expect(overflowBlock).not.toBeNull();
    const overflowLinks = Array.from(
      overflowBlock!.querySelectorAll("a"),
    ).filter((a) => /\/red\?seed=/.test(a.getAttribute("href") ?? ""));
    expect(overflowLinks.length).toBe(6);
  });
});

// ── 62-01 (RED-02): banned-vocab en la leyenda + copy alfabética requerida ────────
describe("RedGraph — leyenda anti-insinuación (banned-vocab + 'orden alfabético')", () => {
  it("la leyenda NO contiene vocabulario de afinidad y SÍ declara 'orden alfabético'/'no cercanía'", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const txt = container.textContent ?? "";
    // La copy LOCKED (UI-SPEC §Copywriting, leyenda layout) declara "no cercanía"
    // y "no indican afinidad" — negaciones explícitas que SON el anti-insinuación.
    // El scan de banned-vocab busca esas palabras usadas como AFIRMACIÓN, así que
    // primero removemos las negaciones LOCKED y luego escaneamos el resto.
    const sinNegaciones = txt
      .replace(/orden alfabético, no cercanía/gi, "")
      .replace(/no indican afinidad ni relación/gi, "");
    // Banned-vocab extendido a la leyenda (UI-SPEC §Banned vocabulary): ninguna
    // afirmación de afinidad/cercanía/alianza/red de poder.
    expect(sinNegaciones).not.toMatch(/afinidad|cercan[íi]a|aliado|red de poder/i);
    // Ya existentes: sin afiliación ni valoración.
    expect(txt).not.toMatch(/partido/i);
    expect(txt).not.toMatch(/puntaje|score|ranking/i);
    // La copy LOCKED debe aparecer literal.
    expect(txt).toMatch(/orden alfabético/i);
    expect(txt).toMatch(/no cercanía/i);
  });
});

// ── 55-05 (UX-03): framing ego del seed + marca sobria del nodo semilla ──────────
describe("RedGraph — framing ego del seed (55-05)", () => {
  it("con seedId encuadra el ego: fitViewOptions.nodes = seed + vecinos 1-hop", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const canvas = within(container).getByTestId("rf-canvas");
    const ego = JSON.parse(canvas.getAttribute("data-fitview-nodes") ?? "[]");
    // arista() por defecto vincula D1009↔D2011 → el ego es ambos, centrado en el seed.
    expect(ego).toContain("D1009"); // seed
    expect(ego).toContain("D2011"); // vecino 1-hop
  });

  it("sin seedId conserva el fitView global (sin lista de nodos ego)", () => {
    const { container } = render(
      <RedGraph subgrafo={{ nodos: dos_nodos, aristas: [arista()] }} />,
    );
    const canvas = within(container).getByTestId("rf-canvas");
    // Sin semilla el encuadre es global → fitViewOptions no filtra nodos.
    expect(canvas.getAttribute("data-fitview-nodes")).toBe("[]");
  });

  it("el nodo seed lleva marca sobria (data.esSeed) y los demás no", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const seedNode = within(container).getByTestId("rf-node-D1009");
    const otroNode = within(container).getByTestId("rf-node-D2011");
    // Marca sobria = clase de wayfinding en el nodo semilla; ausente en el resto.
    expect(seedNode.querySelector(".net-nodo--seed")).not.toBeNull();
    expect(otroNode.querySelector(".net-nodo--seed")).toBeNull();
    // No-ranking: la marca no introduce puntaje/score/orden de personas.
    expect(seedNode.textContent ?? "").not.toMatch(/puntaje|score|ranking/i);
  });
});

// ── F-04 / 62-02 (RED-02): grafo usable en móvil — canvas ≥md + lista de vecinos <md ─
describe("RedGraph — grafo móvil (canvas hidden md:block + lista de vecinos + filtros intactos)", () => {
  it("el lienzo usa clases token h-96 md:h-120 (sin inline style ni arbitrary [Npx])", () => {
    const { container } = render(
      <RedGraph subgrafo={{ nodos: dos_nodos, aristas: [arista()] }} />,
    );
    const lienzo = container.querySelector(".net-lienzo") as HTMLElement | null;
    expect(lienzo).not.toBeNull();
    expect(lienzo!.className).toContain("h-96");
    expect(lienzo!.className).toContain("md:h-120");
    // Sin inline style de altura (el fix reemplaza style={{ height: 480 }}).
    expect(lienzo!.getAttribute("style") ?? "").not.toMatch(/height/i);
  });

  it("la nota band-aid 'mejor en pantalla ancha' YA NO existe (reemplazada por la lista)", () => {
    const { container } = render(
      <RedGraph seedId="D1009" subgrafo={{ nodos: dos_nodos, aristas: [arista()] }} />,
    );
    expect(container.textContent ?? "").not.toMatch(
      /se lee mejor en pantalla ancha/i,
    );
  });

  it("el canvas radial vive dentro de un wrapper hidden md:block", () => {
    const { container } = render(
      <RedGraph seedId="D1009" subgrafo={{ nodos: dos_nodos, aristas: [arista()] }} />,
    );
    const lienzo = container.querySelector(".net-lienzo") as HTMLElement | null;
    expect(lienzo).not.toBeNull();
    // Algún ancestro del lienzo tiene hidden + md:block (canvas SOLO ≥768px).
    let anc: HTMLElement | null = lienzo!.parentElement;
    let wrapped = false;
    while (anc) {
      const cn = anc.className ?? "";
      if (typeof cn === "string" && cn.includes("hidden") && cn.includes("md:block")) {
        wrapped = true;
        break;
      }
      anc = anc.parentElement;
    }
    expect(wrapped).toBe(true);
  });

  it("lista de vecinos móvil: heading 'Vecinos de' + filas Link a /red?seed= con hecho + fuente", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0001", nombre: "Ana Alvarado", camara: "diputados" }, // seed
      { id: "V1", nombre: "Bruno Barros", camara: "diputados" },
      { id: "V2", nombre: "Carla Cortés", camara: "senado" },
    ];
    const { container } = render(
      <RedGraph
        seedId="D0001"
        subgrafo={{
          nodos,
          aristas: [
            arista({ a: "D0001", b: "V1", contexto: "Empresa Equis SpA" }),
            arista({ a: "D0001", b: "V2", contexto: "Empresa Equis SpA" }),
          ],
        }}
      />,
    );
    // El contenedor md:hidden con la lista de vecinos.
    const lista = container.querySelector(".net-vecinos") as HTMLElement | null;
    expect(lista).not.toBeNull();
    expect(lista!.className).toContain("md:hidden");
    // Heading "Vecinos de {nombre}".
    expect(within(lista!).getByText(/Vecinos de/i)).toBeInTheDocument();
    // Cada vecino es un Link a /red?seed=<id>.
    const filas = Array.from(lista!.querySelectorAll("a")).filter((a) =>
      /\/red\?seed=/.test(a.getAttribute("href") ?? ""),
    );
    expect(filas.length).toBeGreaterThanOrEqual(2);
    // El hecho compartido aparece en la lista (etiquetaHecho).
    expect(
      within(lista!).getAllByText(/Ambos recibieron audiencia/i).length,
    ).toBeGreaterThan(0);
    // Un enlace "Ver fuente oficial" por fila (procedencia en el DOM).
    expect(
      within(lista!).getAllByText(/Ver fuente oficial/i).length,
    ).toBeGreaterThan(0);
  });

  it("la lista de vecinos NO aparece en el estado vacío (0 aristas)", () => {
    const { container } = render(
      <RedGraph seedId="D0001" subgrafo={{ nodos: dos_nodos, aristas: [] }} />,
    );
    expect(container.querySelector(".net-vecinos")).toBeNull();
  });

  it("los filtros de tipo y ventana temporal siguen intactos con el fix móvil", () => {
    render(<RedGraph subgrafo={{ nodos: dos_nodos, aristas: [arista()] }} />);
    expect(screen.getByLabelText(/tipo de relaci/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });
});
