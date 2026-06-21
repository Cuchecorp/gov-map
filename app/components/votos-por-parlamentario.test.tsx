import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VotoFichaRow, VotoFichaMencionRow } from "./voto-ficha-row";
import {
  VotosView,
  derivarVotosViewData,
  normalizarPagina,
  type VotosViewData,
  type VotoFichaConMateria,
} from "./votos-por-parlamentario";
import { extractoIdea, conteoVotacion } from "@/lib/format";
import type { VotoFichaMencion, RebeldiaRow } from "@/lib/types";

afterEach(cleanup);

// ── Fixtures ───────────────────────────────────────────────────────────────────
function makeVoto(
  overrides: Partial<VotoFichaConMateria> = {},
): VotoFichaConMateria {
  return {
    votacion_id: "camara:1",
    boletin: "16284-07",
    fecha: "2026-05-14T00:00:00Z",
    seleccion: "si",
    etapa: "Primer trámite",
    camara: "diputados",
    origen: "camara",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://opendata.camara.cl/votacion/1",
    // Sustancia + desenlace (0028) — campos additivos del RPC extendido.
    titulo: "Proyecto de prueba",
    idea_matriz: "Idea matriz de prueba.",
    resultado: "Aprobado",
    total_si: 80,
    total_no: 40,
    total_abstencion: 0,
    total_pareo: 0,
    quorum: "Simple",
    materia: "Salud",
    ...overrides,
  };
}

function makeMencion(
  overrides: Partial<VotoFichaMencion> = {},
): VotoFichaMencion {
  return {
    votacion_id: "senado:9",
    boletin: "16284-07",
    fecha: "2026-05-14T00:00:00Z",
    seleccion: "si",
    camara: "senado",
    origen: "senado",
    fecha_captura: "2026-06-18T00:00:00Z",
    enlace: "https://senado.cl/votacion/9",
    mencion_nombre: "Coloma C., Juan Antonio",
    parlamentario_id: null,
    estado_vinculo: "no_confirmado",
    ...overrides,
  };
}

function makeViewData(overrides: Partial<VotosViewData> = {}): VotosViewData {
  return {
    votos: [makeVoto()],
    totalVotos: 1,
    conteos: { si: 1, no: 0, abstencion: 0, pareo: 0, ausente: 0 },
    rebeldias: [],
    materiaActiva: null,
    materias: [],
    page: 1,
    totalPages: 1,
    noIngestado: false,
    ...overrides,
  };
}

// ── Task 1: VotoFichaRow — los 3 estados honestos (§3.6) ────────────────────────
describe("VotoFichaRow — guarda de identidad de la ficha (VOTE-03, §3.6)", () => {
  it("estado (a) confirmado → el titulo enlaza a /proyecto/[boletin]", () => {
    render(
      <ul>
        <VotoFichaRow
          voto={makeVoto({ boletin: "16284-07", titulo: "Proyecto de prueba" })}
        />
      </ul>,
    );
    const link = screen.getByRole("link", { name: "Proyecto de prueba" });
    expect(link).toHaveAttribute("href", "/proyecto/16284-07");
    // Una fila confirmada NO lleva marca de identidad (la subjetividad es el parlamentario).
    expect(
      screen.queryByLabelText("identidad no verificada"),
    ).not.toBeInTheDocument();
  });

  it("estado (b) no_confirmado → muestra mención cruda + IdentityMarker, NUNCA enlaza al parlamentario", () => {
    render(
      <ul>
        <VotoFichaMencionRow voto={makeMencion()} />
      </ul>,
    );
    // El nombre crudo aparece, con la marca de identidad no verificada.
    expect(screen.getByText("Coloma C., Juan Antonio")).toBeInTheDocument();
    expect(
      screen.getByLabelText("identidad no verificada"),
    ).toBeInTheDocument();
    // El ÚNICO enlace permitido es al proyecto (ruta interna), nunca al parlamentario.
    const links = screen.getAllByRole("link");
    for (const l of links) {
      expect(l.getAttribute("href")).not.toMatch(/^\/parlamentario\//);
    }
  });

  it("la marca usa exactamente 'identidad no verificada' (sin hedges, §9.1 regla 5)", () => {
    render(
      <ul>
        <VotoFichaMencionRow voto={makeMencion()} />
      </ul>,
    );
    const marker = screen.getByLabelText("identidad no verificada");
    expect(marker.textContent).toContain("identidad no verificada");
    expect(marker.textContent).not.toMatch(/posible|probable|dudos/i);
  });

  it("soporta los 5 chips incluida 'Ausente' (nunca colapsa a 'no votó')", () => {
    render(
      <ul>
        <VotoFichaRow voto={makeVoto({ seleccion: "ausente" })} />
      </ul>,
    );
    expect(screen.getByText("Ausente")).toBeInTheDocument();
    expect(screen.queryByText(/no votó/i)).not.toBeInTheDocument();
  });

  it("'probable' (aunque traiga id) → NO enlaza al parlamentario, muestra marca", () => {
    render(
      <ul>
        <VotoFichaMencionRow
          voto={makeMencion({
            parlamentario_id: "P00999",
            estado_vinculo: "probable",
          })}
        />
      </ul>,
    );
    const links = screen.getAllByRole("link");
    for (const l of links) {
      expect(l.getAttribute("href")).not.toMatch(/^\/parlamentario\//);
    }
    expect(
      screen.getByLabelText("identidad no verificada"),
    ).toBeInTheDocument();
  });
});

// ── Task 1 (helpers puros): extractoIdea / conteoVotacion ───────────────────────
describe("format.extractoIdea — truncado literal puro (NUNCA reescribe)", () => {
  it("deja intacta una idea corta (≤ max)", () => {
    expect(extractoIdea("Idea breve.", 160)).toBe("Idea breve.");
  });

  it("trunca en límite de palabra y agrega '…' sin reescribir", () => {
    const larga =
      "Modifica la ley para regular el etiquetado de alimentos y la publicidad dirigida a la infancia en establecimientos educacionales del país";
    const out = extractoIdea(larga, 40);
    // Es un PREFIJO literal de la fuente (cero reescritura) + elipsis.
    expect(out.endsWith("…")).toBe(true);
    const sinElipsis = out.slice(0, -1).trimEnd();
    expect(larga.startsWith(sinElipsis)).toBe(true);
    // No corta a media palabra: el prefijo termina justo antes de un espacio en la fuente.
    expect(larga[sinElipsis.length]).toBe(" ");
    expect(out.length).toBeLessThanOrEqual(41);
  });

  it("normaliza espacios internos sin inventar contenido", () => {
    expect(extractoIdea("  hola   mundo  ", 160)).toBe("hola mundo");
  });
});

describe("format.conteoVotacion — '58–81' con guion largo, mono-listo", () => {
  it("compone con guion largo (en dash)", () => {
    expect(conteoVotacion(58, 81)).toBe("58–81");
  });
});

// ── Task 1: VotoFichaRow INSTRUCTIVA (titulo + idea + desenlace, §3.2/§9) ────────
describe("VotoFichaRow — sustancia + desenlace (Phase 22, §9)", () => {
  it("renderiza el titulo del proyecto y un extracto de la idea (no solo el boletín)", () => {
    render(
      <ul>
        <VotoFichaRow
          voto={makeVoto({
            titulo: "Regula el etiquetado de alimentos",
            idea_matriz:
              "Establece normas sobre la composición, etiquetado y publicidad de los alimentos.",
          })}
        />
      </ul>,
    );
    expect(
      screen.getByText("Regula el etiquetado de alimentos"),
    ).toBeInTheDocument();
    expect(screen.getByText(/De qué trata:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Establece normas sobre la composición/),
    ).toBeInTheDocument();
  });

  it("idea_matriz null → honest-state 'no disponible aún', NUNCA fabrica", () => {
    render(
      <ul>
        <VotoFichaRow voto={makeVoto({ titulo: "Proyecto X", idea_matriz: null })} />
      </ul>,
    );
    expect(
      screen.getByText(/De qué trata: no disponible aún/),
    ).toBeInTheDocument();
  });

  it("titulo null → cae al boletín como fallback (cero fabricación)", () => {
    render(
      <ul>
        <VotoFichaRow voto={makeVoto({ titulo: null, boletin: "18296-05" })} />
      </ul>,
    );
    expect(
      screen.getByRole("link", { name: /Boletín N°18296-05/ }),
    ).toBeInTheDocument();
  });

  it("resultado='Rechazado' total 58/81 seleccion='no' → desenlace factual con conteo mono", () => {
    render(
      <ul>
        <VotoFichaRow
          voto={makeVoto({
            seleccion: "no",
            resultado: "Rechazado",
            total_si: 58,
            total_no: 81,
          })}
        />
      </ul>,
    );
    // Enmarca el voto contra el desenlace, como hecho (sin adjetivo de juicio).
    expect(screen.getByText(/Votó En contra/)).toBeInTheDocument();
    expect(screen.getByText(/el proyecto fue Rechazado/)).toBeInTheDocument();
    expect(screen.getByText(/58–81/)).toBeInTheDocument();
  });

  it("resultado null → omite la cláusula de desenlace pero conserva titulo/idea (degrada honesto)", () => {
    render(
      <ul>
        <VotoFichaRow
          voto={makeVoto({
            titulo: "Proyecto sin desenlace",
            idea_matriz: "Una idea cualquiera.",
            resultado: null,
            total_si: null,
            total_no: null,
          })}
        />
      </ul>,
    );
    expect(screen.getByText("Proyecto sin desenlace")).toBeInTheDocument();
    expect(screen.queryByText(/el proyecto fue/)).not.toBeInTheDocument();
  });

  it("GATE §6: el output no contiene términos prohibidos ni juicio sobre el voto", () => {
    const { container } = render(
      <ul>
        <VotoFichaRow
          voto={makeVoto({
            titulo: "Proyecto Y",
            idea_matriz: "Idea.",
            seleccion: "no",
            resultado: "Rechazado",
            total_si: 58,
            total_no: 81,
          })}
        />
      </ul>,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /porque|a cambio de|afinidad|puntaje|score|conflicto de inter|enriquecimiento|sospechos|incoherent|pol[eé]mic|traici|rebeld/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });

  it("VotoFichaMencionRow (estado b) también muestra sustancia/desenlace conservando IdentityMarker", () => {
    render(
      <ul>
        <VotoFichaMencionRow
          voto={makeMencion({
            titulo: "Proyecto mención",
            idea_matriz: "Idea de la mención.",
            resultado: "Aprobado",
            total_si: 90,
            total_no: 30,
          })}
        />
      </ul>,
    );
    expect(screen.getByText("Proyecto mención")).toBeInTheDocument();
    expect(screen.getByText(/De qué trata:/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("identidad no verificada"),
    ).toBeInTheDocument();
  });
});

// ── Task 2: VotosView — asistencia + tema + votó-distinto + estados (c) ─────────
describe("VotosView — sección VOTE (asistencia, tema, votó distinto, §3.3–§3.6)", () => {
  it("estado (c) NO ingestado ≠ ingestado-cero ≠ limpio", () => {
    render(<VotosView id="P00001" data={makeViewData({ noIngestado: true, votos: [], totalVotos: 0 })} />);
    expect(
      screen.getByText(/Aún no hemos ingerido las votaciones/i),
    ).toBeInTheDocument();
    // Un vacío NUNCA se lee como virtud/limpio.
    expect(screen.queryByText(/limpio|sin antecedentes|impecable/i)).not.toBeInTheDocument();
  });

  it("estado (c) ingestado con cero confirmados → copy honesto distinto del 'no ingestado'", () => {
    render(<VotosView id="P00001" data={makeViewData({ votos: [], totalVotos: 0, noIngestado: false })} />);
    expect(
      screen.getByText(/No hay votaciones confirmadas para este parlamentario/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Aún no hemos ingerido/i)).not.toBeInTheDocument();
  });

  it("asistencia: desglose textual con 'Ausente' y conteo (no solo color, a11y §8)", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          votos: [makeVoto(), makeVoto({ votacion_id: "camara:2", seleccion: "ausente" })],
          totalVotos: 2,
          conteos: { si: 1, no: 0, abstencion: 0, pareo: 0, ausente: 1 },
        })}
      />,
    );
    // El conteo de ausente está repetido en texto (no solo en la barra).
    expect(screen.getByText(/Ausente 1/)).toBeInTheDocument();
    expect(screen.getByText(/A favor 1/)).toBeInTheDocument();
  });

  it("votó distinto a su bancada: conteo + lista + footnote del método, SIN juicio", () => {
    const rebeldias: RebeldiaRow[] = [
      {
        votacion_id: "camara:1",
        boletin: "16284-07",
        fecha: "2026-05-14T00:00:00Z",
        seleccion_propia: "no",
        mayoria_bancada: "si",
      },
    ];
    render(<VotosView id="P00001" data={makeViewData({ rebeldias })} />);
    expect(screen.getByText(/Votó distinto a su bancada/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Votó distinto a la mayoría de su bancada 1 vez/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/opción mayoritaria de su bancada en esa misma votación/i),
    ).toBeInTheDocument();
  });

  it("votó distinto — vacío es un HECHO, no una virtud (§9.1 regla 7)", () => {
    render(<VotosView id="P00001" data={makeViewData({ rebeldias: [] })} />);
    expect(
      screen.getByText(/No se registran votaciones en que haya votado distinto a su bancada/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/100% alinead|leal|disciplinad/i)).not.toBeInTheDocument();
  });

  it("voto×tema: faceta por materia (chips) sin score ni afinidad", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          materias: [{ slug: "salud", label: "Salud" }, { slug: "educacion", label: "Educación" }],
        })}
      />,
    );
    expect(screen.getByText("Por tema")).toBeInTheDocument();
    expect(screen.getByText("Salud")).toBeInTheDocument();
    expect(screen.getByText("Educación")).toBeInTheDocument();
  });

  // ── GATE DE CONTENIDO (§9.1, release gate) ───────────────────────────────────
  it("GATE §9.1: el render NO contiene lenguaje de afinidad/score/causal", () => {
    const rebeldias: RebeldiaRow[] = [
      {
        votacion_id: "camara:1",
        boletin: "16284-07",
        fecha: "2026-05-14T00:00:00Z",
        seleccion_propia: "no",
        mayoria_bancada: "si",
      },
    ];
    const { container } = render(
      <VotosView
        id="P00001"
        data={makeViewData({
          votos: [makeVoto(), makeVoto({ votacion_id: "camara:2", seleccion: "ausente" })],
          totalVotos: 2,
          conteos: { si: 1, no: 0, abstencion: 0, pareo: 0, ausente: 1 },
          rebeldias,
          materias: [{ slug: "salud", label: "Salud" }],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /afinidad|alinead|en l[ií]nea con|af[ií]n a|aliad|rival|d[ií]scolo|rebeld|leal(?!es)|disciplina|score|ranking|índice de|por presión de|a cambio de|favoreciendo a/i;
    expect(texto).not.toMatch(PROHIBIDO);
    // El heading neutro EXACTO sí está presente.
    expect(texto).toContain("Votó distinto a su bancada");
  });

  it("paginación SSR: 'Página N de M' + anchors deep-linkables", () => {
    const votos = Array.from({ length: 20 }, (_, i) =>
      makeVoto({ votacion_id: `camara:${i}`, boletin: `9${i}-07` }),
    );
    render(
      <VotosView
        id="P00001"
        data={makeViewData({ votos, totalVotos: 40, page: 1, totalPages: 2 })}
      />,
    );
    expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
    const sig = screen.getByRole("link", { name: /Siguientes/ });
    expect(sig.getAttribute("href")).toContain("votosPage=2");
  });
});

// ── Task 2: VotosView INSTRUCTIVA — Asistencia corregida, agrupación, copy ──────
describe("VotosView — instructiva (asistencia corregida, arco, cobertura, §3.3–§3.5)", () => {
  it("el desglose de SENTIDO va bajo un heading honesto, NUNCA 'Asistencia'", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          conteos: { si: 5, no: 4, abstencion: 0, pareo: 0, ausente: 0 },
          votos: [makeVoto()],
          totalVotos: 9,
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /Cómo votó|Sentido de sus votos/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^Asistencia$/ }),
    ).not.toBeInTheDocument();
  });

  it("asistencia REAL (presente vs ausente) es su propia métrica derivada de 'ausente'", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          votos: [makeVoto(), makeVoto({ votacion_id: "camara:2", seleccion: "ausente" })],
          totalVotos: 2,
          conteos: { si: 1, no: 0, abstencion: 0, pareo: 0, ausente: 1 },
        })}
      />,
    );
    // Presente = total − ausente; lo expresa como métrica propia.
    expect(
      screen.getByText(/Presente en 1 de 2 votaciones/),
    ).toBeInTheDocument();
    expect(screen.getByText(/[Aa]usente en 1/)).toBeInTheDocument();
  });

  it("sin ausentes → NO inventa asistencia; dice 'Emitió N votos registrados'", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          conteos: { si: 5, no: 4, abstencion: 0, pareo: 0, ausente: 0 },
          votos: [makeVoto()],
          totalVotos: 9,
        })}
      />,
    );
    expect(screen.getByText(/Emitió 9 votos registrados/)).toBeInTheDocument();
    expect(screen.queryByText(/Presente en/)).not.toBeInTheDocument();
  });

  it("AGRUPA dos votos del mismo boletín (etapas distintas) bajo una cabecera de proyecto", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          votos: [
            makeVoto({
              votacion_id: "camara:1",
              boletin: "18296-05",
              titulo: "Reforma previsional",
              etapa: "Primer trámite",
              seleccion: "no",
            }),
            makeVoto({
              votacion_id: "camara:2",
              boletin: "18296-05",
              titulo: "Reforma previsional",
              etapa: "Tercer trámite",
              seleccion: "no",
            }),
          ],
          totalVotos: 2,
          conteos: { si: 0, no: 2, abstencion: 0, pareo: 0, ausente: 0 },
        })}
      />,
    );
    // Una sola cabecera de proyecto (el titulo aparece una vez como encabezado de grupo).
    const cabeceras = screen.getAllByText("Reforma previsional");
    expect(cabeceras.length).toBe(1);
    // Las dos etapas votadas se listan bajo ese único proyecto.
    expect(screen.getByText(/Primer trámite/)).toBeInTheDocument();
    expect(screen.getByText(/Tercer trámite/)).toBeInTheDocument();
  });

  it("renderiza la línea explicativa neutra de 'a favor/en contra' (copy LOCKED, sin causalidad)", () => {
    render(<VotosView id="P00001" data={makeViewData()} />);
    expect(
      screen.getByText(
        /A favor \/ En contra se refiere a aprobar o rechazar el proyecto en esa etapa de su tramitación\./,
      ),
    ).toBeInTheDocument();
  });

  it("con pocos proyectos → nota honesta de cobertura, sin aparentar exhaustividad", () => {
    render(
      <VotosView
        id="P00001"
        data={makeViewData({
          votos: [
            makeVoto({ boletin: "18296-05", votacion_id: "camara:1" }),
            makeVoto({ boletin: "14309-04", votacion_id: "camara:2" }),
          ],
          totalVotos: 2,
          conteos: { si: 2, no: 0, abstencion: 0, pareo: 0, ausente: 0 },
        })}
      />,
    );
    expect(
      screen.getByText(/cobertura se está ampliando/i),
    ).toBeInTheDocument();
  });

  it("GATE §6: el render completo no contiene banned-vocab (incluida la nueva copy)", () => {
    const { container } = render(
      <VotosView
        id="P00001"
        data={makeViewData({
          votos: [
            makeVoto({ boletin: "18296-05", titulo: "Reforma A", seleccion: "no", resultado: "Rechazado", total_si: 58, total_no: 81 }),
            makeVoto({ boletin: "14309-04", votacion_id: "camara:2", titulo: "Reforma B" }),
          ],
          totalVotos: 2,
          conteos: { si: 1, no: 1, abstencion: 0, pareo: 0, ausente: 0 },
          materias: [{ slug: "salud", label: "Salud" }],
        })}
      />,
    );
    const texto = container.textContent ?? "";
    const PROHIBIDO =
      /afinidad|alinead|en l[ií]nea con|af[ií]n a|aliad|rival|d[ií]scolo|rebeld|leal(?!es)|disciplina|score|ranking|índice de|por presión de|a cambio de|favoreciendo a|porque|conflicto de inter|enriquecimiento|sospechos/i;
    expect(texto).not.toMatch(PROHIBIDO);
  });
});

// ── WR-01..WR-04: derivación pura (server-side) pinneada con fixtures ───────────
describe("derivarVotosViewData — invariantes de filtro/paginación (WR-01, WR-02, WR-03, WR-04)", () => {
  // 5 proyectos distintos en "Salud" + 3 en "Educación", 1 etapa c/u → 8 arcos.
  function fixtureMultiTema(): VotoFichaConMateria[] {
    const salud = Array.from({ length: 5 }, (_, i) =>
      makeVoto({
        votacion_id: `s:${i}`,
        boletin: `100${i}-07`,
        materia: "Salud",
        seleccion: i === 0 ? "ausente" : "si",
      }),
    );
    const educacion = Array.from({ length: 3 }, (_, i) =>
      makeVoto({
        votacion_id: `e:${i}`,
        boletin: `200${i}-04`,
        materia: "Educación",
        seleccion: "no",
      }),
    );
    return [...salud, ...educacion];
  }

  it("WR-01: con tema activo, el agregado (conteos/totalVotos) refleja SOLO el subconjunto filtrado", () => {
    const data = derivarVotosViewData({
      todasConMateria: fixtureMultiTema(),
      materiaActiva: "salud",
      page: 1,
      rebeldias: [],
    });
    // Salud = 5 votos (1 ausente, 4 sí); NO los 8 globales.
    expect(data.totalVotos).toBe(5);
    expect(data.conteos.si).toBe(4);
    expect(data.conteos.ausente).toBe(1);
    expect(data.conteos.no).toBe(0); // los "no" son de Educación → excluidos.
  });

  it("WR-01: sin tema activo, el agregado es global (los 8 votos)", () => {
    const data = derivarVotosViewData({
      todasConMateria: fixtureMultiTema(),
      materiaActiva: null,
      page: 1,
      rebeldias: [],
    });
    expect(data.totalVotos).toBe(8);
    expect(data.conteos.no).toBe(3);
  });

  it("WR-02: agrupa por proyecto ANTES de paginar — un proyecto que cruza el borde NO se parte", () => {
    // 21 proyectos, 1 etapa c/u, PAGE_SIZE=20 → página 1 = 20 arcos, página 2 = 1 arco.
    // El proyecto #20 (índice 20) cae entero en la página 2; ninguno se duplica.
    const votos = Array.from({ length: 21 }, (_, i) =>
      makeVoto({ votacion_id: `p:${i}`, boletin: `${300 + i}-07`, materia: null }),
    );
    const p1 = derivarVotosViewData({ todasConMateria: votos, materiaActiva: null, page: 1, rebeldias: [] });
    const p2 = derivarVotosViewData({ todasConMateria: votos, materiaActiva: null, page: 2, rebeldias: [] });
    expect(p1.totalPages).toBe(2);
    expect(p1.votos.length).toBe(20);
    expect(p2.votos.length).toBe(1);
    // Sin solapamiento de boletines entre páginas → cero arco partido/duplicado.
    const b1 = new Set(p1.votos.map((v) => v.boletin));
    const b2 = new Set(p2.votos.map((v) => v.boletin));
    for (const b of b2) expect(b1.has(b)).toBe(false);
  });

  it("WR-02: un proyecto con 2 etapas que rodean el borde queda ENTERO en una sola página", () => {
    // 19 proyectos de 1 etapa + 1 proyecto de 2 etapas (que sin agrupar-antes cruzaría
    // el borde de 20). Con agrupación-antes, el arco de 2 etapas no se divide.
    const sueltos = Array.from({ length: 19 }, (_, i) =>
      makeVoto({ votacion_id: `x:${i}`, boletin: `${400 + i}-07`, materia: null }),
    );
    const arco2 = [
      makeVoto({ votacion_id: "y:0", boletin: "999-07", etapa: "Primer trámite", materia: null }),
      makeVoto({ votacion_id: "y:1", boletin: "999-07", etapa: "Tercer trámite", materia: null }),
    ];
    const data = derivarVotosViewData({
      todasConMateria: [...sueltos, ...arco2],
      materiaActiva: null,
      page: 1,
      rebeldias: [],
    });
    expect(data.totalPages).toBe(1); // 20 arcos → 1 página
    // Las 2 etapas del boletín 999-07 están juntas en la misma página.
    const etapas999 = data.votos.filter((v) => v.boletin === "999-07");
    expect(etapas999.length).toBe(2);
  });

  it("WR-03: dos materias que sólo difieren por acento NO se funden — slugs distintos, filtros separados", () => {
    const votos = [
      makeVoto({ votacion_id: "a:0", boletin: "500-07", materia: "Niñez" }),
      makeVoto({ votacion_id: "b:0", boletin: "600-07", materia: "Ninez" }),
    ];
    const data = derivarVotosViewData({ todasConMateria: votos, materiaActiva: null, page: 1, rebeldias: [] });
    // Dos chips distintos (no uno fusionado).
    expect(data.materias.length).toBe(2);
    const slugs = data.materias.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(2);
    // Filtrar por el slug de "Niñez" trae sólo su boletín, no el de "Ninez".
    const slugNinez = data.materias.find((m) => m.label === "Niñez")!.slug;
    const filtrada = derivarVotosViewData({ todasConMateria: votos, materiaActiva: slugNinez, page: 1, rebeldias: [] });
    expect(filtrada.votos.map((v) => v.boletin)).toEqual(["500-07"]);
  });

  it("WR-04: normalizarPagina rechaza basura final y no numérico, clampa por debajo a 1", () => {
    expect(normalizarPagina("3abc")).toBe(1);
    expect(normalizarPagina("abc")).toBe(1);
    expect(normalizarPagina("")).toBe(1);
    expect(normalizarPagina(undefined)).toBe(1);
    expect(normalizarPagina("0")).toBe(1);
    expect(normalizarPagina("-2")).toBe(1);
    expect(normalizarPagina("  4  ")).toBe(4);
    expect(normalizarPagina("99999")).toBe(99999); // el clamp por arriba lo hace el derivador.
  });

  it("WR-04: una página fuera de rango se clampa contra totalPages en el derivador", () => {
    const votos = Array.from({ length: 5 }, (_, i) =>
      makeVoto({ votacion_id: `z:${i}`, boletin: `${700 + i}-07`, materia: null }),
    );
    const data = derivarVotosViewData({ todasConMateria: votos, materiaActiva: null, page: 99999, rebeldias: [] });
    expect(data.totalPages).toBe(1);
    expect(data.page).toBe(1); // clamp: 99999 → 1
    expect(data.votos.length).toBe(5);
  });
});
