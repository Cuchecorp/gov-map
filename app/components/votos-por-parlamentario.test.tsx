import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import { VotoFichaRow, VotoFichaMencionRow } from "./voto-ficha-row";
import {
  VotosView,
  type VotosViewData,
  type VotoFichaConMateria,
} from "./votos-por-parlamentario";
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
  it("estado (a) confirmado → enlaza el boletín a /proyecto/[boletin]", () => {
    render(
      <ul>
        <VotoFichaRow voto={makeVoto({ boletin: "16284-07" })} />
      </ul>,
    );
    const link = screen.getByRole("link", { name: /Boletín N°16284-07/ });
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
      makeVoto({ votacion_id: `camara:${i}` }),
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

// Silencia un warning de `within` no usado si el linter es estricto.
void within;
