import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";

import { DetalleColapsable } from "./detalle-colapsable";

afterEach(cleanup);

// ── Fixture ─────────────────────────────────────────────────────────────────
function renderDetalle(
  overrides: { n?: number; defaultOpen?: boolean } = {},
) {
  return render(
    <DetalleColapsable n={overrides.n ?? 3} defaultOpen={overrides.defaultOpen}>
      <div data-testid="detalle">contenido del detalle (server child)</div>
    </DetalleColapsable>,
  );
}

// ── UXCOG 55-01: disclosure inverso (default CERRADO) + forceMount ────────────
describe("DetalleColapsable — disclosure que colapsa SOLO el detalle (UXCOG 55-01)", () => {
  it("Test 1: default CERRADO → trigger 'Ver detalle (3)', child en el DOM (forceMount) con data-state=closed", () => {
    renderDetalle({ n: 3 });

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("data-state", "closed");
    expect(trigger.textContent).toContain("Ver detalle (3)");

    // forceMount: el server child sigue presente aunque el detalle esté colapsado.
    expect(screen.getByTestId("detalle")).toBeInTheDocument();
  });

  it("Test 2: click en el trigger → 'Ocultar detalle' + data-state=open", () => {
    renderDetalle({ n: 3 });

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("data-state", "open");
    expect(trigger.textContent).toContain("Ocultar detalle");
    expect(screen.getByTestId("detalle")).toBeInTheDocument();
  });

  it("Test 3: defaultOpen=true → arranca abierto (data-state=open)", () => {
    renderDetalle({ n: 5, defaultOpen: true });

    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("data-state", "open");
    expect(trigger.textContent).toContain("Ocultar detalle");
  });
});

// ── T-55-01: no-leak SSR (source-scan, espejo de carril-accordion) ───────────
describe("DetalleColapsable — no-leak SSR: nunca importa una sección ni Supabase (T-55-01)", () => {
  it("Test 4: el fuente NO contiene Section, createServerSupabase ni @/lib/supabase", () => {
    const fuente = readFileSync(
      path.join(process.cwd(), "components", "detalle-colapsable.tsx"),
      "utf8",
    );
    expect(fuente).not.toMatch(/Section/);
    expect(fuente).not.toMatch(/createServerSupabase/);
    expect(fuente).not.toMatch(/@\/lib\/supabase/);
  });
});
