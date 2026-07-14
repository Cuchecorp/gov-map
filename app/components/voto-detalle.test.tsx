import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { VotoDetalle } from "./voto-detalle";
import { LEYENDA_ANTI_INSINUACION } from "@/lib/voto-presentacion";
import type { VotoRow as VotoRowData } from "@/lib/types";

afterEach(cleanup);

// Leyenda anti-insinuación VERBATIM (LOCKED 68-UI-SPEC §Leyenda). Debe aparecer 1× a
// nivel de la VOTACIÓN, sobre la lista voto-a-voto, en la superficie del proyecto/Senado.
const LEYENDA =
  "Un voto es un hecho observable. Ausente o pareo no equivalen a votar en contra. No medimos disciplina ni motivo.";

function makeVoto(overrides: Partial<VotoRowData> = {}): VotoRowData {
  return {
    votacion_id: "senado:1",
    mencion_nombre: "PÉREZ, Juan",
    parlamentario_id: "p-1",
    seleccion: "si",
    metodo: null,
    estado_vinculo: "confirmado",
    ...overrides,
  };
}

describe("VotoDetalle — leyenda anti-insinuación (68 WARNING #1)", () => {
  it("la constante compartida es byte-idéntica al copy LOCKED del SPEC", () => {
    // Single source of truth: la leyenda vive en lib/voto-presentacion.ts y se reusa
    // verbatim en ambas superficies (ficha parlamentario + este voto-detalle).
    expect(LEYENDA_ANTI_INSINUACION).toBe(LEYENDA);
  });

  it("renderiza la leyenda 1× al abrir el desglose voto-a-voto", () => {
    render(<VotoDetalle votos={[makeVoto(), makeVoto({ seleccion: "no" })]} />);

    // Colapsado por defecto: la leyenda NO se muestra hasta abrir el panel.
    expect(screen.queryByText(LEYENDA)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Ver votos individuales/ }),
    );

    const leyendas = screen.getAllByText(LEYENDA);
    expect(leyendas).toHaveLength(1);
  });

  it("NO renderiza la leyenda cuando no hay votos (empty state honesto)", () => {
    render(<VotoDetalle votos={[]} />);
    expect(screen.queryByText(LEYENDA)).toBeNull();
    expect(
      screen.getByText(/No hay desglose de votos disponible/),
    ).toBeTruthy();
  });
});
