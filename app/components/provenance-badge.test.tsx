import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ProvenanceBadge } from "./provenance-badge";

afterEach(cleanup);

describe("ProvenanceBadge — frescura + fuente (TRAM-09, UI-SPEC §4)", () => {
  it("dato fresco (<48h) → sin override amber, con enlace a la fuente", () => {
    const capturedAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // hace 3h
    render(
      <ProvenanceBadge
        capturedAt={capturedAt}
        sourceName="Cámara"
        sourceUrl="https://www.camara.cl/fuente"
      />
    );
    expect(screen.getByText(/Cámara/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Fuente oficial: Cámara/ });
    expect(link).toHaveAttribute("href", "https://www.camara.cl/fuente");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // El span del badge NO debe llevar las clases amber de staleness.
    const badge = screen.getByText(/Actualizado/).closest("span");
    expect(badge?.className).not.toMatch(/amber/);
  });

  it("dato stale (>48h) → aplica override amber (text-amber-700 border-amber-400)", () => {
    const capturedAt = new Date(Date.now() - 72 * 60 * 60 * 1000); // hace 72h
    render(
      <ProvenanceBadge
        capturedAt={capturedAt}
        sourceName="Senado"
        sourceUrl="https://www.senado.cl/fuente"
      />
    );
    // El contenedor del badge es el padre directo del span "Senado".
    const outer = screen.getByText("Senado").parentElement;
    expect(outer?.className).toContain("text-amber-700");
    expect(outer?.className).toContain("border-amber-400");
  });

  it("sin procedencia (capturedAt null, sourceUrl null) → 'fuente desconocida', sin enlace, badge presente", () => {
    render(
      <ProvenanceBadge capturedAt={null} sourceName="Cámara" sourceUrl={null} />
    );
    // Nunca se oculta el badge (UI-SPEC §6.3).
    expect(screen.getByText("fuente desconocida")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("#9: un sourceUrl con esquema peligroso (javascript:) NO se enlaza (anti-XSS)", () => {
    const capturedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    render(
      <ProvenanceBadge
        capturedAt={capturedAt}
        sourceName="Cámara"
        // eslint-disable-next-line no-script-url
        sourceUrl={"javascript:alert(1)"}
      />
    );
    // El dato sigue mostrándose, pero degradado a "sin enlace" (no inyecta script).
    expect(screen.getByText(/Cámara/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
