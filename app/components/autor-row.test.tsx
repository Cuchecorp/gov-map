import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { AutorRow, type ProyectoAutorRow } from "./autor-row";

afterEach(cleanup);

function makeAutor(overrides: Partial<ProyectoAutorRow> = {}): ProyectoAutorRow {
  return {
    id: 1,
    boletin: "14309-04",
    autor_crudo: "Walker Prieto, Patricio",
    autor_crudo_norm: "walker prieto patricio",
    parlamentario_id: null,
    metodo: null,
    estado_vinculo: null,
    origen: "camara",
    fecha_captura: "2026-07-01T00:00:00Z",
    enlace: "https://www.camara.cl/",
    ...overrides,
  };
}

// ── AutoresSection helper (inline render, no server component needed for unit tests)
// The 3-state logic (Mensaje/Moción/con autores) lives in page.tsx which we
// test separately; here we simulate those branches with simple inline renders.

describe("AutorRow — guarda de identidad (AUTOR-02, espejo TRAM-06)", () => {
  it("estado confirmado + parlamentario_id → renderiza link a /parlamentario/[id]", () => {
    render(
      <AutorRow
        autor={makeAutor({
          parlamentario_id: "P001",
          estado_vinculo: "confirmado",
          metodo: "determinista",
          autor_crudo: "Walker Prieto, Patricio",
        })}
      />
    );
    const link = screen.getByRole("link", { name: /Walker Prieto, Patricio/ });
    expect(link).toHaveAttribute("href", "/parlamentario/P001");
    expect(
      screen.queryByLabelText("identidad no verificada")
    ).not.toBeInTheDocument();
  });

  it("parlamentario_id null → nombre crudo + IdentityMarker, NUNCA link a parlamentario", () => {
    render(
      <AutorRow
        autor={makeAutor({
          parlamentario_id: null,
          estado_vinculo: "no_confirmado",
          autor_crudo: "Autor Desconocido, Juan",
        })}
      />
    );
    // No debe haber link a la ficha del parlamentario.
    const links = screen.queryAllByRole("link");
    const parlamentarioLink = links.find((l) =>
      l.getAttribute("href")?.startsWith("/parlamentario/")
    );
    expect(parlamentarioLink).toBeUndefined();
    expect(screen.getByText("Autor Desconocido, Juan")).toBeInTheDocument();
    expect(screen.getByLabelText("identidad no verificada")).toBeInTheDocument();
  });

  it("estado_vinculo probable (aunque traiga id) → NO link a parlamentario, muestra IdentityMarker", () => {
    render(
      <AutorRow
        autor={makeAutor({
          parlamentario_id: "P999",
          estado_vinculo: "probable",
          metodo: "llm",
        })}
      />
    );
    // Debe NO haber link a la ficha del parlamentario (P999).
    // ProvenanceBadge puede rendir un link a "fuente oficial" — no es el parlamentario.
    const links = screen.queryAllByRole("link");
    const parlamentarioLink = links.find((l) =>
      l.getAttribute("href")?.startsWith("/parlamentario/")
    );
    expect(parlamentarioLink).toBeUndefined();
    expect(screen.getByLabelText("identidad no verificada")).toBeInTheDocument();
  });
});

// ── AutoresSection 3-state inline simulation ──────────────────────────────────
// The AutoresSection async component lives in page.tsx (server component).
// We test its branching logic by simulating the JSX it produces per state.

import React from "react";

function AutoresSectionStub({
  autores,
  iniciativa,
}: {
  autores: ProyectoAutorRow[];
  iniciativa: string | null;
}) {
  // Mirrors the 3-state logic in AutoresSection (page.tsx)
  if (autores.length === 0) {
    if (iniciativa === "Mensaje") {
      return (
        <p className="text-sm text-muted-foreground">
          Iniciativa del Ejecutivo (Mensaje presidencial).
        </p>
      );
    }
    return null;
  }
  return (
    <ul>
      {autores.map((a, i) => (
        <AutorRow key={a.id ?? i} autor={a} />
      ))}
    </ul>
  );
}

describe("AutoresSection — 3 estados honestos (AUTOR-02)", () => {
  it("0 filas + iniciativa Mensaje → muestra texto Ejecutivo", () => {
    render(<AutoresSectionStub autores={[]} iniciativa="Mensaje" />);
    expect(screen.getByText(/Iniciativa del Ejecutivo/)).toBeInTheDocument();
    expect(screen.getByText(/Mensaje presidencial/)).toBeInTheDocument();
  });

  it("0 filas + iniciativa Moción → retorna null (sección ausente del DOM)", () => {
    const { container } = render(
      <AutoresSectionStub autores={[]} iniciativa="Moción" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("con autores → renderiza AutorRow por cada autor", () => {
    const autores = [
      makeAutor({ id: 1, autor_crudo: "Autor Uno", parlamentario_id: "P001", estado_vinculo: "confirmado" }),
      makeAutor({ id: 2, autor_crudo: "Autor Dos", parlamentario_id: null, estado_vinculo: "no_confirmado" }),
    ];
    render(<AutoresSectionStub autores={autores} iniciativa="Moción" />);
    expect(screen.getByRole("link", { name: /Autor Uno/ })).toBeInTheDocument();
    expect(screen.getByText("Autor Dos")).toBeInTheDocument();
    expect(screen.getByLabelText("identidad no verificada")).toBeInTheDocument();
  });
});
