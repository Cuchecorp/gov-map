/**
 * ficha-header.test.tsx — deep-links humanos en el header de la ficha
 *
 * Cubre el defecto reportado por el operador:
 *   1. El link "fuente oficial ↗" del header NUNCA apunta al WS XML
 *      (wspublico/tramitacion.php) — se reruta a la ficha humana del Senado.
 *   2. El header ofrece "Ver en la Cámara ↗" cuando prm_id_camara != null;
 *      fail-honest (nada) cuando es null.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { FichaHeader } from "./ficha-header";
import type { ProyectoRow } from "@/lib/types";

afterEach(cleanup);

function makeProyecto(overrides: Partial<ProyectoRow> = {}): ProyectoRow {
  return {
    boletin: "16456-35",
    boletin_num: "16456",
    titulo: "Proyecto de prueba",
    iniciativa: "Moción",
    camara_origen: "senado",
    autores: null,
    materia: "Trabajo",
    estado: "En tramitación",
    etapa: "Primer trámite constitucional",
    subetapa: null,
    origen: "senado",
    fecha_captura: "2026-07-15T12:00:00Z",
    enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
    prm_id_camara: null,
    ...overrides,
  };
}

describe("FichaHeader — deep-links humanos (fuente oficial + Cámara)", () => {
  it("el link 'fuente oficial' NUNCA apunta a wspublico; se reruta a appsenado (boletin_ini)", () => {
    render(<FichaHeader proyecto={makeProyecto()} />);
    const fuente = screen.getByRole("link", {
      name: /Fuente oficial.*abre en nueva pestaña/i,
    });
    const href = fuente.getAttribute("href") ?? "";
    expect(href).not.toContain("/wspublico/");
    expect(href).toContain("boletin_ini=16456-35");
    expect(href).toContain("appsenado");
  });

  it("con prm_id_camara != null renderiza 'Ver en la Cámara ↗' con prmID y prmBOLETIN", () => {
    render(<FichaHeader proyecto={makeProyecto({ prm_id_camara: "17024" })} />);
    const camara = screen.getByRole("link", {
      name: /Ver en la Cámara.*abre en nueva pestaña/i,
    });
    const href = camara.getAttribute("href") ?? "";
    expect(href).toContain("prmID=17024");
    expect(href).toContain("prmBOLETIN=16456-35");
    expect(camara).toHaveAttribute("target", "_blank");
    expect(camara).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("con prm_id_camara null NO renderiza el link Cámara (fail-honest)", () => {
    render(<FichaHeader proyecto={makeProyecto({ prm_id_camara: null })} />);
    expect(
      screen.queryByRole("link", { name: /Ver en la Cámara/i }),
    ).not.toBeInTheDocument();
  });

  it("enlace no-wspublico (ficha humana ya válida) se respeta verbatim", () => {
    const enlace =
      "https://www.senado.cl/appsenado/index.php?boletin_ini=16456-35";
    render(<FichaHeader proyecto={makeProyecto({ enlace })} />);
    const fuente = screen.getByRole("link", {
      name: /Fuente oficial.*abre en nueva pestaña/i,
    });
    expect(fuente).toHaveAttribute("href", enlace);
  });
});
