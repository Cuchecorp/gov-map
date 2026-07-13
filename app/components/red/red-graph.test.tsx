import { describe, it, expect, afterEach, beforeAll } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";

import { RedGraph, type Subgrafo } from "./red-graph";

/**
 * Tests de la isla <RedGraph> (RED-LAYOUT-B, 18-CONTEXT anti-insinuación HARD).
 *
 * El layout B es un diagrama DOM puro (seed → columna de vecinos + conectores
 * SVG con fan-out): ya NO usa @xyflow/react. jsdom NO evalúa layout ni produce
 * `getBoundingClientRect` real (todo da 0 / offsetParent null), así que los tests
 * NO asertan coordenadas de las curvas — solo el COMPORTAMIENTO (estructura DOM,
 * paginación, selección, procedencia, estados honestos, filtros, orden
 * alfabético, leyenda anti-insinuación). `drawConn` es defensivo ante rects en
 * cero, de modo que renderizar/paginar/seleccionar nunca lanza en jsdom.
 */

// jsdom no trae ResizeObserver (el componente lo usa para redibujar conectores).
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
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

// ── Nodo/fila sobria: nombre + cámara, sin partido/foto/score ──────────────────
describe("RedGraph — fila sobria (nombre + cámara, sin partido/foto/score)", () => {
  it("la columna muestra el nombre del vecino + la cámara", () => {
    render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    // Seed a la izquierda + vecino en la columna.
    expect(screen.getByText("Ada Aguilar")).toBeInTheDocument();
    expect(screen.getByText("Bruno Bravo")).toBeInTheDocument();
    expect(screen.getAllByText(/diputados/i).length).toBeGreaterThan(0);
  });

  it("no renderiza foto ni vocabulario de partido/valoración", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    const txt = container.textContent ?? "";
    // "partido" AISLADO (afiliación); "compartidos" es texto legítimo del hecho.
    expect(txt).not.toMatch(/\bpartido\b/i);
    expect(txt).not.toMatch(/puntaje|score|ranking/i);
  });

  it("ya no monta el canvas de xyflow (sin rf-canvas)", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    expect(
      within(container).queryByTestId("rf-canvas"),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".net-lienzo")).toBeNull();
  });

  it("borde institucional por cámara: fila de diputados net-b-row--camara, senado --senado", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D1", nombre: "Diputada Uno", camara: "diputados" }, // seed
      { id: "S1", nombre: "Senador Uno", camara: "senado" },
    ];
    const { container } = render(
      <RedGraph
        seedId="D1"
        subgrafo={{ nodos, aristas: [arista({ a: "D1", b: "S1" })] }}
      />,
    );
    const filaSenado = container.querySelector(
      '.net-b-row[data-vecino="S1"]',
    );
    expect(filaSenado).not.toBeNull();
    expect(filaSenado!.className).toContain("net-b-row--senado");
    expect(filaSenado!.className).not.toContain("net-b-row--camara");
  });
});

// ── Arista = hecho tipado (copy del hecho, sin afinidad/causa) ──────────────────
describe("RedGraph — hecho tipado en el detalle inline", () => {
  it("al seleccionar el vecino, el detalle describe el hecho con la contraparte", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ contexto: "Empresa Equis SpA" })],
        }}
      />,
    );
    const fila = container.querySelector(
      '.net-b-row[data-vecino="D2011"]',
    ) as HTMLElement;
    fireEvent.click(fila);
    expect(
      screen.getByText(/Ambos recibieron audiencia de Empresa Equis SpA/i),
    ).toBeInTheDocument();
  });

  it("el detalle expone la ventana temporal (desde/hasta)", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const fila = container.querySelector(
      '.net-b-row[data-vecino="D2011"]',
    ) as HTMLElement;
    fireEvent.click(fila);
    expect(screen.getAllByText(/2024-03-01/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2024-05-01/).length).toBeGreaterThan(0);
  });
});

// ── Provenance por arista (origen + ventana + enlace + licencia) ────────────────
describe("RedGraph — procedencia siempre en el DOM del detalle", () => {
  function seleccionar(container: HTMLElement, id = "D2011") {
    const fila = container.querySelector(
      `.net-b-row[data-vecino="${id}"]`,
    ) as HTMLElement;
    fireEvent.click(fila);
  }

  it("expone origen y enlace a la fuente (target _blank)", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    seleccionar(container);
    expect(screen.getByText(/leylobby/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /fuente/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.leylobby.gob.cl/audiencia/123",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("propaga la atribución cuando la fila trae licencia (CC BY 4.0)", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ licencia: "CC BY 4.0" })],
        }}
      />,
    );
    seleccionar(container);
    expect(screen.getByText(/CC BY 4\.0/)).toBeInTheDocument();
  });

  it("con licencia NULL NO afirma atribución", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista({ licencia: null })] }}
      />,
    );
    seleccionar(container);
    expect(screen.queryByText(/CC BY/)).not.toBeInTheDocument();
  });

  it("un enlace con esquema peligroso (javascript:) NO se enlaza", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{
          nodos: dos_nodos,
          aristas: [arista({ enlace: "javascript:alert(1)" })],
        }}
      />,
    );
    seleccionar(container);
    expect(
      screen.queryByRole("link", { name: /fuente/i }),
    ).not.toBeInTheDocument();
  });

  it("el detalle enlaza a la red del vecino (/red?seed=<id>)", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    seleccionar(container);
    const link = screen.getByRole("link", { name: /Ver la red de esta persona/i });
    expect(link).toHaveAttribute("href", "/red?seed=D2011");
  });

  it("la microcopy anti-insinuación aparece en el detalle", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    seleccionar(container);
    expect(
      screen.getByText(/No indica afinidad, acuerdo ni motivo/i),
    ).toBeInTheDocument();
  });
});

// ── Selección: destaca la fila + expande el detalle ────────────────────────────
describe("RedGraph — selección de fila (clic/Enter)", () => {
  it("clic marca la fila como seleccionada (net-b-row--sel) y expande el detalle", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const fila = container.querySelector(
      '.net-b-row[data-vecino="D2011"]',
    ) as HTMLElement;
    expect(fila.className).not.toContain("net-b-row--sel");
    fireEvent.click(fila);
    const filaSel = container.querySelector(
      '.net-b-row[data-vecino="D2011"]',
    ) as HTMLElement;
    expect(filaSel.className).toContain("net-b-row--sel");
  });

  it("Enter sobre la fila también la selecciona", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const fila = container.querySelector(
      '.net-b-row[data-vecino="D2011"]',
    ) as HTMLElement;
    fireEvent.keyDown(fila, { key: "Enter" });
    expect(
      (
        container.querySelector(
          '.net-b-row[data-vecino="D2011"]',
        ) as HTMLElement
      ).className,
    ).toContain("net-b-row--sel");
  });

  it("el SVG de conectores existe en el DOM cuando hay ≥1 fila (aria-hidden)", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const svg = container.querySelector(".net-b-conn");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });
});

// ── Paginación 10/página cubre TODOS los vecinos ───────────────────────────────
describe("RedGraph — paginación 10/página (ningún vecino descartado)", () => {
  const seedCon24Vecinos = (): { sub: Subgrafo; seedId: string } => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0000", nombre: "Zzz Semilla", camara: "diputados" },
    ];
    const aristas: Subgrafo["aristas"] = [];
    for (let i = 0; i < 24; i++) {
      const id = `V${String(i).padStart(2, "0")}`;
      const letra = String.fromCharCode(65 + i); // A..X (24 letras)
      nodos.push({
        id,
        nombre: `${letra}${String(i).padStart(2, "0")} Vecino`,
        camara: "diputados",
      });
      aristas.push(arista({ a: "D0000", b: id }));
    }
    return { sub: { nodos, aristas }, seedId: "D0000" };
  };

  it("página 1 muestra exactamente 10 filas y el pager es honesto", () => {
    const { sub, seedId } = seedCon24Vecinos();
    const { container } = render(
      <RedGraph seedId={seedId} subgrafo={sub} />,
    );
    expect(container.querySelectorAll(".net-b-row").length).toBe(10);
    expect(
      screen.getByText(
        /Vecinos 1–10 de 24 · página 1 de 3 · orden alfabético/i,
      ),
    ).toBeInTheDocument();
  });

  it("recorrer las 3 páginas cubre los 24 vecinos, sin pérdida", () => {
    const { sub, seedId } = seedCon24Vecinos();
    const { container } = render(
      <RedGraph seedId={seedId} subgrafo={sub} />,
    );
    const vistos = new Set<string>();
    const recolectar = () =>
      container
        .querySelectorAll(".net-b-row")
        .forEach((r) => vistos.add(r.getAttribute("data-vecino")!));

    recolectar(); // pág 1
    fireEvent.click(screen.getByRole("button", { name: /Siguientes/i }));
    recolectar(); // pág 2
    expect(container.querySelectorAll(".net-b-row").length).toBe(10);
    fireEvent.click(screen.getByRole("button", { name: /Siguientes/i }));
    recolectar(); // pág 3
    expect(container.querySelectorAll(".net-b-row").length).toBe(4);
    expect(vistos.size).toBe(24);
  });

  it("los botones de página se deshabilitan en los extremos", () => {
    const { sub, seedId } = seedCon24Vecinos();
    render(<RedGraph seedId={seedId} subgrafo={sub} />);
    expect(screen.getByRole("button", { name: /Anteriores/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Siguientes/i }),
    ).not.toBeDisabled();
  });
});

// ── Orden alfabético invariante al orden del array de entrada ───────────────────
describe("RedGraph — orden alfabético es-locale determinista", () => {
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

  const orden = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".net-b-row")).map((r) =>
      r.getAttribute("data-vecino"),
    );

  it("las filas salen en orden alfabético (Ana < Bruno < Carlos)", () => {
    const { container } = render(
      <RedGraph seedId="D0001" subgrafo={seedYVecinos()} />,
    );
    expect(orden(container)).toEqual(["V_A", "V_B", "V_C"]);
  });

  it("reordenar el array de entrada no cambia el orden de las filas", () => {
    const base = seedYVecinos();
    const reordenado: Subgrafo = {
      nodos: [base.nodos[2], base.nodos[0], base.nodos[3], base.nodos[1]],
      aristas: [base.aristas[2], base.aristas[0], base.aristas[1]],
    };
    const { container } = render(
      <RedGraph seedId="D0001" subgrafo={reordenado} />,
    );
    expect(orden(container)).toEqual(["V_A", "V_B", "V_C"]);
  });
});

// ── Filtros por tipo y ventana temporal + reset a página 1 ─────────────────────
describe("RedGraph — filtros por tipo y por tiempo", () => {
  it("ofrece control de filtro por tipo y ventana (desde/hasta)", () => {
    render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    expect(screen.getByLabelText(/tipo de relaci/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it("destildar un tipo oculta la fila del vecino afectado", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    expect(
      container.querySelector('.net-b-row[data-vecino="D2011"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByLabelText(/tipo de relaci/i));
    expect(
      container.querySelector('.net-b-row[data-vecino="D2011"]'),
    ).toBeNull();
  });

  it("una ventana 'hasta' anterior a la arista oculta la fila", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{
          nodos: dos_nodos,
          aristas: [
            arista({
              desde: "2024-03-01T00:00:00Z",
              hasta: "2024-05-01T00:00:00Z",
            }),
          ],
        }}
      />,
    );
    expect(
      container.querySelector('.net-b-row[data-vecino="D2011"]'),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText(/hasta/i), {
      target: { value: "2024-01-01" },
    });
    expect(
      container.querySelector('.net-b-row[data-vecino="D2011"]'),
    ).toBeNull();
  });

  it("filtrar RESETEA a página 1", () => {
    // 24 vecinos, avanzar a pág 2, luego filtrar por fecha amplia → vuelve a pág 1.
    const nodos: Subgrafo["nodos"] = [
      { id: "D0000", nombre: "Zzz Semilla", camara: "diputados" },
    ];
    const aristas: Subgrafo["aristas"] = [];
    for (let i = 0; i < 24; i++) {
      const id = `V${String(i).padStart(2, "0")}`;
      const letra = String.fromCharCode(65 + i);
      nodos.push({
        id,
        nombre: `${letra}${String(i).padStart(2, "0")} Vecino`,
        camara: "diputados",
      });
      aristas.push(arista({ a: "D0000", b: id }));
    }
    const { container } = render(
      <RedGraph seedId="D0000" subgrafo={{ nodos, aristas }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Siguientes/i }));
    expect(screen.getByText(/página 2 de 3/i)).toBeInTheDocument();
    // Un cambio de filtro (desde vacío→temprano, sigue mostrando todo) resetea.
    fireEvent.change(screen.getByLabelText(/desde/i), {
      target: { value: "2020-01-01" },
    });
    expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument();
    expect(container.querySelectorAll(".net-b-row").length).toBe(10);
  });
});

// ── Estados honestos ───────────────────────────────────────────────────────────
describe("RedGraph — estados honestos", () => {
  it("0 aristas → estado honesto + UN link a /parlamentarios (F-03 byte-idéntico)", () => {
    render(<RedGraph subgrafo={{ nodos: dos_nodos, aristas: [] }} />);
    expect(
      screen.getByText(
        "Aún no hay relaciones para mostrar para este parlamentario. Cuando existan hechos públicos que vinculen a dos parlamentarios —por ejemplo, haber recibido audiencia de la misma contraparte de lobby— aparecerán aquí, cada uno con su fuente y su fecha.",
      ),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: /directorio de parlamentarios/ }),
    ).toHaveAttribute("href", "/parlamentarios");
  });

  it("subgrafo null → estado honesto, sin crash", () => {
    render(<RedGraph subgrafo={null} />);
    expect(screen.getByText(/aún no hay relaciones/i)).toBeInTheDocument();
  });

  it("seed sin vecino visible tras filtro (CR-01) → mensaje 'Ninguna relación coincide'", () => {
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
            arista({
              a: "D0001",
              b: "V1",
              desde: "2024-01-01T00:00:00Z",
              hasta: "2024-01-31T00:00:00Z",
            }),
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
    fireEvent.change(screen.getByLabelText(/desde/i), {
      target: { value: "2024-02-01" },
    });
    expect(container.querySelectorAll(".net-b-row").length).toBe(0);
    expect(
      screen.getByText(/Ninguna relación coincide con los filtros/i),
    ).toBeInTheDocument();
  });

  it("con seedId pero sin seedNodo (rama fallback) muestra la columna sin crash", () => {
    // El seed no está en los nodos del subgrafo → rama fallback sobre nodosVisibles.
    const nodos: Subgrafo["nodos"] = [
      { id: "D1", nombre: "Diputada Uno", camara: "diputados" },
      { id: "D2", nombre: "Diputado Dos", camara: "diputados" },
    ];
    const { container } = render(
      <RedGraph
        seedId="D9999"
        subgrafo={{ nodos, aristas: [arista({ a: "D1", b: "D2" })] }}
      />,
    );
    // Aviso fallback presente; la columna se puebla sobre nodosVisibles.
    expect(container.querySelectorAll(".net-b-row").length).toBeGreaterThan(0);
  });
});

// ── Fallback de nombre vacío al id (WR-05) ─────────────────────────────────────
describe("RedGraph — fallback de nombre vacío al id (WR-05)", () => {
  it("un vecino con nombre='' usa su id como texto de la fila", () => {
    const nodos: Subgrafo["nodos"] = [
      { id: "D0001", nombre: "Ana Alvarado", camara: "diputados" }, // seed
      { id: "V_SIN", nombre: "", camara: "diputados" },
    ];
    const { container } = render(
      <RedGraph
        seedId="D0001"
        subgrafo={{ nodos, aristas: [arista({ a: "D0001", b: "V_SIN" })] }}
      />,
    );
    const fila = container.querySelector(
      '.net-b-row[data-vecino="V_SIN"]',
    ) as HTMLElement;
    expect(fila).not.toBeNull();
    expect(within(fila).getByText("V_SIN")).toBeInTheDocument();
  });
});

// ── Leyenda anti-insinuación (banned-vocab + 'orden alfabético') ───────────────
describe("RedGraph — leyenda anti-insinuación", () => {
  it("declara 'orden alfabético' y 'no cercanía'/'no indican afinidad', sin banned-vocab afirmativo", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    const txt = container.textContent ?? "";
    // Remueve las negaciones LOCKED antes de escanear afirmaciones prohibidas.
    // La copy declara explícitamente "Nunca indica afinidad, acuerdo ni motivo" y
    // "no significan nada" — negaciones que SON el anti-insinuación; se remueven
    // primero para que el scan cace solo AFIRMACIONES de afinidad.
    const sinNegaciones = txt
      .replace(/no significan? nada/gi, "")
      .replace(/nunca indica[n]? afinidad,? acuerdo ni motivo/gi, "")
      .replace(/no indica[n]? afinidad,? acuerdo ni motivo/gi, "")
      .replace(/no indican? afinidad ni relación/gi, "")
      .replace(/la posición no implica afinidad/gi, "")
      .replace(/no cercanía/gi, "");
    expect(sinNegaciones).not.toMatch(/afinidad|cercan[íi]a|aliado|red de poder/i);
    // Sin afiliación (el token "partido" AISLADO; "compartidos" es texto legítimo
    // del hecho compartido, no afiliación).
    expect(txt).not.toMatch(/\bpartido\b/i);
    expect(txt).not.toMatch(/puntaje|score|ranking/i);
    // Copy LOCKED presente.
    expect(txt).toMatch(/orden alfabético/i);
  });

  it("incluye la nota móvil de omisión de líneas en pantallas angostas", () => {
    const { container } = render(
      <RedGraph
        seedId="D1009"
        subgrafo={{ nodos: dos_nodos, aristas: [arista()] }}
      />,
    );
    expect(container.textContent ?? "").toMatch(
      /en pantallas angostas las líneas se omiten/i,
    );
  });
});
