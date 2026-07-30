/**
 * panel-tile-movimiento.test.tsx — Tile 4 (Phase 128, PANEL-02/03/05/07).
 *
 * Control apareado clave (T-128-12/P2): `velocity` NO trae `descripcion` — el
 * DOM del ítem se compone SOLO de boletín, título, fecha y cámara; título y
 * fecha SÍ aparecen (control positivo).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PanelTileMovimiento, type FilaPanel } from "./panel-tile-movimiento";

afterEach(cleanup);

function itemVelocity(
  boletin: string,
  fecha: string,
  extra?: Partial<{ titulo: string | null; en_corpus: boolean; enlace: string }>,
) {
  return {
    fecha,
    enlace: extra?.enlace ?? `https://camara.cl/pley/${boletin}`,
    titulo: extra?.titulo === undefined ? `Proyecto ${boletin}` : extra.titulo,
    boletin,
    en_corpus: extra?.en_corpus ?? true,
    descripcion: null, // velocity NUNCA trae descripcion (P2)
    enlace_evento: null,
  };
}

function filaVelocity(
  items: ReturnType<typeof itemVelocity>[],
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

describe("PanelTileMovimiento", () => {
  it("cada ítem: <a href=/proyecto/{b}#timeline> con boletín + título, detalle 'Trámite del {d} · {cámara}'", () => {
    const filas = [
      filaVelocity(
        [itemVelocity("16569-25", "2026-07-20")],
        "Cámara de Diputados",
      ),
    ];
    const { container } = render(<PanelTileMovimiento filas={filas} />);
    const a = container.querySelector('a[href="/proyecto/16569-25#timeline"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toContain("16569-25");
    expect(a?.textContent).toContain("Proyecto 16569-25");
    expect(container.textContent).toContain(
      "Trámite del 20 jul 2026 · Cámara de Diputados",
    );
  });

  it("cobertura_camara null → se omite el segmento de cámara y la barra cívica (regla A)", () => {
    const filas = [filaVelocity([itemVelocity("B-1", "2026-07-20")], null)];
    const { container } = render(<PanelTileMovimiento filas={filas} />);
    expect(container.textContent).toContain("Trámite del 20 jul 2026");
    expect(container.textContent).not.toMatch(/Trámite del 20 jul 2026 ·/);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it("el DOM NO contiene ninguna descripción de trámite fabricada (fixture sin 'descripcion')", () => {
    const filas = [
      filaVelocity(
        [itemVelocity("B-1", "2026-07-20", { titulo: "Título real" })],
        "Senado",
      ),
    ];
    const { container } = render(<PanelTileMovimiento filas={filas} />);
    // Control positivo apareado: título y fecha SÍ aparecen.
    expect(container.textContent).toContain("Título real");
    expect(container.textContent).toContain("20 jul 2026");
    // Ningún texto de ejemplo del spike fabricado.
    expect(container.textContent).not.toContain("Informe de Comisión Mixta");
  });

  it("titulo null → se muestra el boletín solo", () => {
    const filas = [
      filaVelocity(
        [itemVelocity("B-1", "2026-07-20", { titulo: null })],
        "Senado",
      ),
    ];
    const { container } = render(<PanelTileMovimiento filas={filas} />);
    const a = container.querySelector('a[href="/proyecto/B-1#timeline"]');
    expect(a?.textContent?.trim()).toBe("B-1");
  });

  it("total:2 con maxItems:4 → no se renderiza 'y N más'", () => {
    const filas = [
      filaVelocity(
        [
          itemVelocity("B-1", "2026-07-20"),
          itemVelocity("B-2", "2026-07-21"),
        ],
        "Senado",
      ),
    ];
    const { container } = render(
      <PanelTileMovimiento filas={filas} maxItems={4} />,
    );
    expect(container.textContent).not.toMatch(/más/);
  });

  it("filas de dos cámaras → ambas se listan, en el orden de llegada de las filas (T-52-13)", () => {
    const filas = [
      filaVelocity([itemVelocity("B-CAM", "2026-07-20")], "Cámara de Diputados"),
      filaVelocity([itemVelocity("B-SEN", "2026-07-21")], "Senado"),
    ];
    const { container } = render(<PanelTileMovimiento filas={filas} />);
    const anchors = Array.from(container.querySelectorAll("a"));
    const idxCam = anchors.findIndex((a) => a.getAttribute("href")?.includes("B-CAM"));
    const idxSen = anchors.findIndex((a) => a.getAttribute("href")?.includes("B-SEN"));
    expect(idxCam).toBeGreaterThanOrEqual(0);
    expect(idxSen).toBeGreaterThan(idxCam);
  });

  it("footer: 'Fuente: Tramitación · según fuente al {d}'; cero 'datos al'", () => {
    const filas = [filaVelocity([itemVelocity("B-1", "2026-07-20")], "Senado")];
    const { container } = render(<PanelTileMovimiento filas={filas} />);
    expect(container.textContent).toContain(
      "Fuente: Tramitación · según fuente al 24 jul 2026",
    );
    expect(container.textContent).not.toContain("datos al");
  });
});
