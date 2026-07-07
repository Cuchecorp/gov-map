import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { VotosCapa1 } from "./votos-capa1";
import type { VotosBreakdown } from "@/lib/parlamentario-resumen-conteos";

afterEach(cleanup);

function breakdown(over: Partial<VotosBreakdown> = {}): VotosBreakdown {
  return { si: 72, no: 66, abstencion: 2, pareo: 1, ausente: 1, ...over };
}

describe("VotosCapa1 — resumen preatentivo de votos (55-02)", () => {
  it("muestra 5 cifras Mono grandes (4 sentidos + asistencia %)", () => {
    const { container } = render(
      <VotosCapa1 breakdown={breakdown()} asistencia={{ presentes: 141, total: 142 }} />,
    );
    // 4 facts de sentido + 1 de asistencia = 5 cifras, todas Mono + text-2xl.
    const cifras = container.querySelectorAll(".font-mono.text-2xl");
    expect(cifras).toHaveLength(5);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("66")).toBeInTheDocument();
    // asistencia 141/142 → 99,3%.
    expect(screen.getByText("99,3%")).toBeInTheDocument();
  });

  it("omite la cifra de asistencia cuando no es derivable (nunca fabrica un %)", () => {
    const { container } = render(
      <VotosCapa1 breakdown={breakdown()} asistencia={null} />,
    );
    expect(screen.queryByText(/asistencia/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%/);
    // sin asistencia quedan solo 4 cifras.
    expect(container.querySelectorAll(".font-mono.text-2xl")).toHaveLength(4);
  });

  it("la barra apilada 'Cómo votó' usa colores semánticos, NUNCA petróleo", () => {
    const { container } = render(
      <VotosCapa1 breakdown={breakdown()} asistencia={{ presentes: 141, total: 142 }} />,
    );
    const html = container.innerHTML;
    // colores semánticos (verde/rojo/ámbar/slate) presentes, petróleo ausente.
    expect(html).toMatch(/bg-green-500/);
    expect(html).toMatch(/bg-red-500/);
    expect(html).not.toMatch(/accent-product/);
    // la barra existe (role img con aria-label del desglose).
    expect(screen.getByRole("img")).toHaveAttribute("aria-label");
  });

  it("es una vista PURA (no importa supabase)", () => {
    // Se ejerce sin runtime Supabase/Next: si importara supabase, el render fallaría.
    const { container } = render(
      <VotosCapa1
        breakdown={{ si: 0, no: 0, abstencion: 0, pareo: 0, ausente: 0 }}
        asistencia={null}
      />,
    );
    expect(container).toBeTruthy();
  });
});
