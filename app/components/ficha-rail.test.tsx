import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";

// Mockeamos el hook para forzar un activeId determinista (sin IntersectionObserver).
vi.mock("@/lib/use-scrollspy", () => ({
  useScrollspy: () => "lobby",
}));

import { FichaRail, type RailEntry } from "./ficha-rail";

afterEach(cleanup);

const CAVEAT =
  "Cada dato con fuente, fecha y enlace. La coincidencia temporal no implica relación.";

function fixtureEntries(): RailEntry[] {
  return [
    { id: "votos", label: "Votaciones", count: "9" },
    { id: "lobby", label: "Reuniones de lobby", count: "sin registros" },
    { id: "patrimonio", label: "Declaraciones", count: "—" },
    {
      id: "cruces",
      label: "Cruces con sectores",
      count: "3",
      marker: "diamante",
    },
  ];
}

function renderRail() {
  return render(
    <FichaRail
      header={<div data-testid="rail-header">Nombre Parlamentario</div>}
      navEntries={fixtureEntries()}
      caveat={CAVEAT}
    />,
  );
}

describe("FichaRail — rail sticky con nav gate-aware + scrollspy + caveat (UXCOG 55-01)", () => {
  it("Test 1: una <a href='#id'> por entrada de nav", () => {
    renderRail();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(screen.getByRole("link", { name: /Votaciones/ })).toHaveAttribute(
      "href",
      "#votos",
    );
    expect(screen.getByRole("link", { name: /Cruces/ })).toHaveAttribute(
      "href",
      "#cruces",
    );
  });

  it("Test 2: el conteo honesto se muestra tal cual (no fabrica dígitos)", () => {
    renderRail();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("sin registros")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("Test 3: la entrada de cruces muestra el marcador diamante ◆", () => {
    renderRail();
    const cruces = screen.getByRole("link", { name: /Cruces/ });
    expect(cruces.textContent).toContain("◆");
  });

  it("Test 4: el caveat anti-causal aparece EXACTAMENTE 1×", () => {
    renderRail();
    const matches = screen.getAllByText(CAVEAT);
    expect(matches).toHaveLength(1);
  });

  it("Test 5: la entrada cuyo id == activeId recibe bg-accent-product-soft", () => {
    renderRail();
    // useScrollspy mockeado → "lobby" es la activa.
    const activa = screen.getByRole("link", { name: /Reuniones de lobby/ });
    expect(activa.className).toContain("bg-accent-product-soft");
    // una NO activa no lleva el highlight.
    const inactiva = screen.getByRole("link", { name: /Votaciones/ });
    expect(inactiva.className).not.toContain("bg-accent-product-soft");
  });

  it("Test 6: el header slot se renderiza", () => {
    renderRail();
    expect(screen.getByTestId("rail-header")).toBeInTheDocument();
  });
});

describe("FichaRail — no-leak SSR (T-55-01)", () => {
  it("Test 7: el fuente NO contiene Section ni @/lib/supabase", () => {
    const fuente = readFileSync(
      path.join(process.cwd(), "components", "ficha-rail.tsx"),
      "utf8",
    );
    expect(fuente).not.toMatch(/Section/);
    expect(fuente).not.toMatch(/@\/lib\/supabase/);
  });
});
