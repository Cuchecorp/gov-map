/**
 * panel-tile-ingresos.test.tsx — Tile 6 (Phase 128, PANEL-02/03/05/07, D-01).
 *
 * Regla C conservada íntegra: supresion_causa != null → causa verbatim como
 * cuerpo. Conteo D-07: "{N} eventos de {M} proyecto(s)" con concordancia.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PanelTileIngresos, type FilaPanel } from "./panel-tile-ingresos";

afterEach(cleanup);

function itemProyecto(
  boletin: string,
  fecha: string,
  extra?: Partial<{ titulo: string; en_corpus: boolean; enlace: string; descripcion: string }>,
) {
  return {
    fecha,
    enlace: extra?.enlace ?? `https://camara.cl/pley/${boletin}`,
    titulo: extra?.titulo ?? `Proyecto ${boletin}`,
    boletin,
    en_corpus: extra?.en_corpus ?? true,
    descripcion: extra?.descripcion ?? null,
    enlace_evento: null,
  };
}

function filaEvidencia(
  items: ReturnType<typeof itemProyecto>[],
  cobertura: string | null,
  consultadoAl = "2026-07-24",
): FilaPanel {
  return {
    cobertura_camara: cobertura,
    conteo: items.length,
    fecha_max: consultadoAl,
    supresion_causa: null,
    evidencia: {
      items,
      total: items.length,
      consultado_al: consultadoAl,
      fuente: { origen: "camara", dataset: "tramitacion" },
    },
  };
}

function filaSuprimida(causa: string, fecha: string): FilaPanel {
  return {
    cobertura_camara: null,
    conteo: 0,
    fecha_max: fecha,
    supresion_causa: causa,
    evidencia: {},
  };
}

describe("PanelTileIngresos", () => {
  it("fila nuevos_ingresos con supresion_causa → causa VERBATIM + sufijo; cero '0' mudo", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaSuprimida("Sin ingresos nuevos en la ventana", "2026-07-24")]}
        archivados={[filaEvidencia([itemProyecto("B-1", "2026-07-20")], "Cámara de Diputados")]}
      />,
    );
    expect(container.textContent).toContain("Sin ingresos nuevos en la ventana");
    expect(container.textContent).toContain(
      "— en las fuentes consultadas al 24 jul 2026",
    );
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(container.textContent).not.toContain("sin movimiento");
  });

  it("fila suprimida con evidencia:{} → parsea sin throw y no lista items", () => {
    expect(() =>
      render(
        <PanelTileIngresos
          ingresos={[filaSuprimida("Ventana sin novedades", "2026-07-24")]}
          archivados={[filaSuprimida("Ventana sin novedades", "2026-07-24")]}
        />,
      ),
    ).not.toThrow();
  });

  it("archivados con 2 eventos del MISMO boletín → '2 eventos de 1 proyecto' (singular); DOM sin '2 movimientos'", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia([], "2022-2026 (piso de corpus)")]}
        archivados={[
          filaEvidencia(
            [
              itemProyecto("B-1", "2026-07-10"),
              itemProyecto("B-1", "2026-07-20"),
            ],
            "Cámara de Diputados",
          ),
        ]}
      />,
    );
    expect(container.textContent).toContain("2 eventos de 1 proyecto");
    expect(container.textContent).not.toContain("2 movimientos");
    expect(container.textContent).toContain("B-1");
  });

  it("3 eventos de 2 boletines → '3 eventos de 2 proyectos' (plural)", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia([], "2022-2026 (piso de corpus)")]}
        archivados={[
          filaEvidencia(
            [
              itemProyecto("B-1", "2026-07-10"),
              itemProyecto("B-1", "2026-07-20"),
              itemProyecto("B-2", "2026-07-15"),
            ],
            "Cámara de Diputados",
          ),
        ]}
      />,
    );
    expect(container.textContent).toContain("3 eventos de 2 proyectos");
  });

  it("cada proyecto: <a href=/proyecto/{b}#timeline> con boletín + título, detalle 'Archivo o retiro fechado el {d}' o descripcion verbatim", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia([], "2022-2026 (piso de corpus)")]}
        archivados={[
          filaEvidencia(
            [itemProyecto("B-1", "2026-07-20")],
            "Cámara de Diputados",
          ),
        ]}
      />,
    );
    const a = container.querySelector('a[href="/proyecto/B-1#timeline"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toContain("B-1");
    expect(container.textContent).toContain("Archivo o retiro fechado el 20 jul 2026");
  });

  it("descripcion verbatim se usa cuando existe (en vez del literal fijo)", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia([], "2022-2026 (piso de corpus)")]}
        archivados={[
          filaEvidencia(
            [itemProyecto("B-1", "2026-07-20", { descripcion: "Retiro por autor" })],
            "Cámara de Diputados",
          ),
        ]}
      />,
    );
    expect(container.textContent).toContain("Retiro por autor fechado el 20 jul 2026");
  });

  it("ambas subsecciones conviven en un solo tile con encabezados internos distinguibles", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia([itemProyecto("B-ING", "2026-07-20")], "2022-2026 (piso de corpus)")]}
        archivados={[filaEvidencia([itemProyecto("B-ARC", "2026-07-15")], "Senado")]}
      />,
    );
    const h3s = Array.from(container.querySelectorAll("h3")).map(
      (h) => h.textContent,
    );
    expect(h3s).toContain("Nuevos ingresos");
    expect(h3s).toContain("Archivos y retiros");
    expect(container.textContent).toContain("B-ING");
    expect(container.textContent).toContain("B-ARC");
  });

  it("cobertura_camara de ingresos ('2022-2026 (piso de corpus)') se rinde como etiqueta de ventana, jamás como cámara — cero chip/barra", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[
          filaEvidencia(
            [itemProyecto("B-ING", "2026-07-20")],
            "2022-2026 (piso de corpus)",
          ),
        ]}
        archivados={[]}
      />,
    );
    expect(container.textContent).not.toContain("2022-2026 (piso de corpus)");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it("footer: 'Fuente: Tramitación · según fuente al {d}'; cero 'datos al'", () => {
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia([itemProyecto("B-1", "2026-07-20")], "2022-2026 (piso de corpus)")]}
        archivados={[]}
      />,
    );
    expect(container.textContent).toContain(
      "Fuente: Tramitación · según fuente al 24 jul 2026",
    );
    expect(container.textContent).not.toContain("datos al");
  });
});
