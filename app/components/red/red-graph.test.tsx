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
    }) =>
      React.createElement(
        "div",
        { "data-testid": "rf-canvas" },
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

describe("RedGraph — nodos huérfanos excluidos (B20a) + layout por carril (B20b)", () => {
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

  it("layout por carril es determinista y separa cámaras", () => {
    const { container } = render(
      <RedGraph
        subgrafo={{
          nodos: [
            { id: "D1", nombre: "Diputada Uno", camara: "diputados" },
            { id: "D2", nombre: "Diputado Dos", camara: "diputados" },
            { id: "S1", nombre: "Senadora Tres", camara: "senado" },
          ],
          // D1↔D2 y D2↔S1 → los tres participan de aristas visibles.
          aristas: [
            arista({ a: "D1", b: "D2" }),
            arista({ a: "D2", b: "S1" }),
          ],
        }}
      />,
    );

    const y = (id: string) =>
      Number(
        within(container)
          .getByTestId(`rf-node-${id}`)
          .getAttribute("data-y"),
      );

    // La banda de senado empieza en ROW*3 = 420; los diputados caen bajo esa cota.
    const BANDA_SENADO = 420;
    expect(y("D1")).toBeLessThan(BANDA_SENADO);
    expect(y("D2")).toBeLessThan(BANDA_SENADO);
    // El senador cae en una banda DISTINTA (>= 420) — separación por cámara.
    expect(y("S1")).toBeGreaterThanOrEqual(BANDA_SENADO);
    // Dos nodos de la misma cámara comparten banda pero difieren de posición
    // (índice-de-carril local): el layout es determinista, no colapsa nodos.
    expect(y("D1")).not.toBe(y("D2"));
  });
});
