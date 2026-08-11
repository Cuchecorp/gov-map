import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import {
  NoticiasDeProyectoView,
  EMPTY_PRENSA,
  NOTA_METODO_PRENSA,
  type NoticiaDeProyectoRow,
} from "./noticias-de-proyecto";

afterEach(cleanup);

function makeNoticia(overrides: Partial<NoticiaDeProyectoRow> = {}): NoticiaDeProyectoRow {
  return {
    url_hash: "abc123",
    titular: "Comisión despacha proyecto sobre boletín 14309-04",
    outlet: "La Tercera",
    fecha_pub: "2026-08-05T13:00:00Z",
    url: "https://www.latercera.com/nota/ejemplo",
    ...overrides,
  };
}

describe("NoticiasDeProyectoView — carril Prensa (Phase 137)", () => {
  it("con 2 noticias, renderiza 2 links con rel=noopener noreferrer y SOLO el titular (nunca el texto completo)", () => {
    render(
      <NoticiasDeProyectoView
        noticias={[
          makeNoticia({ url_hash: "a1", titular: "Titular A" }),
          makeNoticia({ url_hash: "a2", titular: "Titular B" }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
    expect(screen.getByText("Titular A")).toBeInTheDocument();
    expect(screen.getByText("Titular B")).toBeInTheDocument();
  });

  it("con 0 noticias, muestra la ausencia honesta (nunca 0 links, nunca relleno)", () => {
    render(<NoticiasDeProyectoView noticias={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(
      screen.getByText(
        "Ningún titular o bajada de la prensa monitoreada menciona textualmente este boletín.",
      ),
    ).toBeInTheDocument(); // literal INLINE (H-1): jamás la constante importada (tautología)
    expect(
      screen.getByRole("heading", { name: "Prensa que menciona este boletín" }),
    ).toBeInTheDocument();
  });

  it("la nota de método está presente en ambos caminos (con filas y empty)", () => {
    const { unmount } = render(
      <NoticiasDeProyectoView noticias={[makeNoticia()]} />,
    );
    expect(
      screen.getByText(
        "Vínculo por mención textual del boletín en titular o bajada (detección determinista). No implica relación entre el medio y el proyecto.",
      ),
    ).toBeInTheDocument(); // literal INLINE (H-1)
    unmount();
    render(<NoticiasDeProyectoView noticias={[]} />);
    expect(
      screen.getByText(
        "Vínculo por mención textual del boletín en titular o bajada (detección determinista). No implica relación entre el medio y el proyecto.",
      ),
    ).toBeInTheDocument(); // literal INLINE (H-1)
  });

  it("omite el link cuando la url no es http(s) segura (safeExternalHref)", () => {
    render(
      <NoticiasDeProyectoView
        noticias={[makeNoticia({ url: "javascript:alert(1)" })]}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/Comisión despacha proyecto/)).toBeInTheDocument();
  });
});
