import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * Tests RTL del HeaderNav (53-02, Wave 0 gap de 53-RESEARCH §Validation Architecture).
 * Contrato: 53-UI-SPEC §(a) — 5 ítems en orden por journey
 * (Buscar · Parlamentarios · Agenda · Red · Sobre), `/red` alcanzable desde el
 * header (F-01), label "Sobre" acortado, y active-state por prefix-match intacto.
 *
 * `usePathname` (Client-only en Next 16) se mockea con un valor inyectable por test
 * — mismo patrón de mock de `next/navigation` que usa el repo (app/app/red/page.test.tsx).
 */

const pathnameMock = vi.fn<() => string | null>(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

import { HeaderNav } from "./header-nav";

const EXPECTED = [
  { href: "/buscar", label: "Buscar" },
  { href: "/parlamentarios", label: "Parlamentarios" },
  { href: "/agenda", label: "Agenda" },
  { href: "/red", label: "Red" },
  { href: "/sobre", label: "Sobre" },
] as const;

afterEach(cleanup);
beforeEach(() => {
  pathnameMock.mockReturnValue("/");
});

describe("HeaderNav — 5 destinos alcanzables desde el header (53-UI-SPEC §a, F-01)", () => {
  it("renderiza exactamente 5 ítems con hrefs y labels en el orden por journey", () => {
    render(<HeaderNav />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(EXPECTED.length);
    EXPECTED.forEach((item, i) => {
      expect(links[i]).toHaveAttribute("href", item.href);
      expect(links[i]).toHaveTextContent(item.label);
    });
  });

  it("el ítem 4 es Red → /red (ruta LIVE, deja de ser huérfana del header)", () => {
    render(<HeaderNav />);
    const links = screen.getAllByRole("link");
    expect(links[3]).toHaveAttribute("href", "/red");
    expect(links[3]).toHaveTextContent("Red");
  });

  it("el ítem 5 usa el label acortado 'Sobre' (NO 'Sobre / Metodología')", () => {
    render(<HeaderNav />);
    const links = screen.getAllByRole("link");
    expect(links[4]).toHaveAttribute("href", "/sobre");
    expect(links[4]).toHaveTextContent("Sobre");
    expect(screen.queryByText(/Metodología/)).toBeNull();
  });

  it("con pathname '/red' el ítem Red queda activo (aria-current='page')", () => {
    pathnameMock.mockReturnValue("/red");
    render(<HeaderNav />);
    const red = screen.getByRole("link", { name: "Red" });
    expect(red).toHaveAttribute("aria-current", "page");
    // Ningún otro ítem queda activo.
    const activos = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(activos).toHaveLength(1);
  });

  it("con pathname '/parlamentario/D1012' NINGÚN ítem queda activo (no hay ítem de ficha; el breadcrumb es el remedio)", () => {
    pathnameMock.mockReturnValue("/parlamentario/D1012");
    render(<HeaderNav />);
    const activos = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(activos).toHaveLength(0);
  });

  it("con pathname '/parlamentarios/D123' (subárbol) el ítem Parlamentarios queda activo (prefix-match)", () => {
    pathnameMock.mockReturnValue("/parlamentarios/D123");
    render(<HeaderNav />);
    const parl = screen.getByRole("link", { name: "Parlamentarios" });
    expect(parl).toHaveAttribute("aria-current", "page");
    const activos = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(activos).toHaveLength(1);
  });
});
