import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";

import { CarrilAccordion } from "./carril-accordion";

afterEach(cleanup);

// ── Fixture ─────────────────────────────────────────────────────────────────
function renderCarril(overrides: {
  titulo?: string;
  conteo?: React.ReactNode;
  defaultOpen?: boolean;
} = {}) {
  return render(
    <CarrilAccordion
      titulo={overrides.titulo ?? "Votaciones"}
      conteo={overrides.conteo ?? "9"}
      defaultOpen={overrides.defaultOpen ?? true}
    >
      <div data-testid="cuerpo">contenido de la sección</div>
    </CarrilAccordion>,
  );
}

// ── LEG-01: header siempre visible + forceMount + toggle ─────────────────────
describe("CarrilAccordion — isla cliente que preserva el <h2> (LEG-01)", () => {
  it("Test 1: abierto por default → el <h2> con el título y el cuerpo están en el DOM", () => {
    renderCarril({ titulo: "Votaciones", defaultOpen: true });

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain("Votaciones");
    expect(screen.getByTestId("cuerpo")).toBeInTheDocument();
  });

  it("Test 2: cerrado por default → el <h2> SIGUE visible y el cuerpo SIGUE en el DOM (forceMount)", () => {
    renderCarril({ titulo: "Reuniones de lobby", defaultOpen: false });

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain("Reuniones de lobby");

    // forceMount: el contenido SSR sigue presente aunque el carril esté colapsado.
    expect(screen.getByTestId("cuerpo")).toBeInTheDocument();

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("data-state", "closed");
  });

  it("Test 3: click en el trigger → aria-expanded / data-state cambian a open", () => {
    renderCarril({ defaultOpen: false });

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("data-state", "open");
  });

  it("Test 4: el conteo pasado como prop aparece dentro del header", () => {
    renderCarril({ titulo: "Patrimonio", conteo: "sin registros", defaultOpen: false });

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toContain("sin registros");
  });
});

// ── LEG-03: no-leak SSR (grep del fuente, espejo del estilo source-scan) ─────
describe("CarrilAccordion — no-leak SSR: el wrapper nunca importa una sección (LEG-03)", () => {
  it("Test 5: el fuente NO contiene Section, createServerSupabase ni @/lib/supabase", () => {
    // vitest corre desde app/ (vitest.config.ts vive ahí); espejo del estilo
    // source-scan de lockdown-guard.test.ts (process.cwd() + path.join).
    const fuente = readFileSync(
      path.join(process.cwd(), "components", "carril-accordion.tsx"),
      "utf8",
    );
    expect(fuente).not.toMatch(/Section/);
    expect(fuente).not.toMatch(/createServerSupabase/);
    expect(fuente).not.toMatch(/@\/lib\/supabase/);
  });
});
