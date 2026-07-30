/**
 * panel-tile-urgencias.test.tsx — Tile 3 (Phase 128, PANEL-02/03/05/07).
 *
 * Control apareado clave (T-128-11): con un fixture de 95 eventos que cubren
 * 5/42/24 boletines distintos, el "95" NUNCA aparece en el DOM — pero "42" SÍ
 * aparece (cero fuerte vs control positivo, gotcha v12.0).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PanelTileUrgencias, type FilaPanel } from "./panel-tile-urgencias";

afterEach(cleanup);

function itemUrgencia(
  boletin: string,
  grado: string,
  fecha: string,
  extra?: Partial<{ titulo: string; en_corpus: boolean; enlace: string }>,
) {
  return {
    fecha,
    enlace: extra?.enlace ?? `https://camara.cl/pley/${boletin}`,
    titulo: extra?.titulo ?? `Proyecto ${boletin}`,
    boletin,
    en_corpus: extra?.en_corpus ?? true,
    descripcion: grado,
    enlace_evento: null,
  };
}

// Fixture: 5 boletines con "Discusión inmediata", 42 con "Suma", 24 con
// "Simple" — 71 boletines distintos, pero CADA boletín recibe exactamente
// 95/71 eventos repetidos redondeados para sumar 95 eventos totales (algunos
// boletines con más de un evento) — el punto es que EVENTOS != BOLETINES.
function fixture95Eventos(): FilaPanel[] {
  const items: ReturnType<typeof itemUrgencia>[] = [];

  const boletinesInmediata = Array.from({ length: 5 }, (_, i) => `B-INM-${i}`);
  const boletinesSuma = Array.from({ length: 42 }, (_, i) => `B-SUMA-${i}`);
  const boletinesSimple = Array.from({ length: 24 }, (_, i) => `B-SIMPLE-${i}`);

  for (const b of boletinesInmediata) {
    items.push(itemUrgencia(b, "Discusión inmediata", "2026-07-20"));
  }
  for (const b of boletinesSuma) {
    items.push(itemUrgencia(b, "Suma", "2026-07-21"));
  }
  for (const b of boletinesSimple) {
    items.push(itemUrgencia(b, "Simple", "2026-07-22"));
  }
  // 71 items so far — sumar 24 eventos repetidos sobre boletines YA vistos
  // (mismo boletín, distinta fecha) para llegar a 95 eventos con SOLO 71
  // boletines distintos.
  for (let i = 0; i < 24; i++) {
    items.push(
      itemUrgencia(boletinesSuma[i % boletinesSuma.length], "Suma", "2026-07-23"),
    );
  }
  expect(items.length).toBe(95);

  return [
    {
      cobertura_camara: null,
      conteo: items.length,
      fecha_max: "2026-07-23",
      supresion_causa: null,
      evidencia: {
        items,
        total: items.length,
        consultado_al: "2026-07-24",
        fuente: { origen: "camara", dataset: "tramitacion" },
      },
    },
  ];
}

describe("PanelTileUrgencias", () => {
  it("cuenta BOLETINES distintos por grado (5/42/24); el '95' no aparece, '42' sí", () => {
    const { container } = render(
      <PanelTileUrgencias filas={fixture95Eventos()} />,
    );
    expect(container.textContent).toContain(
      "5 proyectos con Discusión inmediata",
    );
    expect(container.textContent).toContain("42 con Suma");
    expect(container.textContent).toContain("24 con Simple");
    expect(container.textContent).not.toContain("95");
  });

  it("un mismo boletín con 3 urgencias cuenta UNA vez en el encabezado y UNA vez en la lista (la más reciente)", () => {
    const filas: FilaPanel[] = [
      {
        cobertura_camara: null,
        conteo: 3,
        fecha_max: "2026-07-23",
        supresion_causa: null,
        evidencia: {
          items: [
            itemUrgencia("B-1", "Suma", "2026-07-10"),
            itemUrgencia("B-1", "Suma", "2026-07-20"),
            itemUrgencia("B-1", "Suma", "2026-07-15"),
          ],
          total: 3,
          consultado_al: "2026-07-24",
          fuente: { origen: "camara", dataset: "tramitacion" },
        },
      },
    ];
    const { container } = render(<PanelTileUrgencias filas={filas} />);
    expect(container.textContent).toContain("1 con Suma");
    expect(container.querySelectorAll('a[href^="/proyecto/B-1"]').length).toBe(
      1,
    );
    expect(container.textContent).toContain("fechada el 20 jul 2026");
  });

  it("ítems: <a href=/proyecto/{b}#estado> con boletín + título, detalle 'Urgencia {grado} fechada el {d}'", () => {
    const filas: FilaPanel[] = [
      {
        cobertura_camara: null,
        conteo: 1,
        fecha_max: "2026-07-20",
        supresion_causa: null,
        evidencia: {
          items: [itemUrgencia("16569-25", "Simple", "2026-07-20")],
          total: 1,
          consultado_al: "2026-07-21",
          fuente: { origen: "camara", dataset: "tramitacion" },
        },
      },
    ];
    const { container } = render(<PanelTileUrgencias filas={filas} />);
    const a = container.querySelector('a[href="/proyecto/16569-25#estado"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toContain("16569-25");
    expect(container.textContent).toContain("Urgencia Simple fechada el 20 jul 2026");
  });

  it("descripcion con literal desconocido se muestra verbatim, jamás se omite", () => {
    const filas: FilaPanel[] = [
      {
        cobertura_camara: null,
        conteo: 1,
        fecha_max: "2026-07-20",
        supresion_causa: null,
        evidencia: {
          items: [itemUrgencia("16569-25", "Retirada", "2026-07-20")],
          total: 1,
          consultado_al: "2026-07-21",
          fuente: { origen: "camara", dataset: "tramitacion" },
        },
      },
    ];
    const { container } = render(<PanelTileUrgencias filas={filas} />);
    expect(container.textContent).toContain("con Retirada");
    expect(container.textContent).toContain("Urgencia Retirada fechada el 20 jul 2026");
  });

  it("orden de los grados es fijo: Discusión inmediata, Suma, Simple", () => {
    const filas: FilaPanel[] = [
      {
        cobertura_camara: null,
        conteo: 3,
        fecha_max: "2026-07-20",
        supresion_causa: null,
        evidencia: {
          items: [
            itemUrgencia("B-1", "Simple", "2026-07-20"),
            itemUrgencia("B-2", "Suma", "2026-07-20"),
            itemUrgencia("B-3", "Discusión inmediata", "2026-07-20"),
          ],
          total: 3,
          consultado_al: "2026-07-21",
          fuente: { origen: "camara", dataset: "tramitacion" },
        },
      },
    ];
    const { container } = render(<PanelTileUrgencias filas={filas} />);
    const encabezado = container.querySelector("p")?.textContent ?? "";
    const idxInmediata = encabezado.indexOf("Discusión inmediata");
    const idxSuma = encabezado.indexOf("Suma");
    const idxSimple = encabezado.indexOf("Simple");
    expect(idxInmediata).toBeGreaterThanOrEqual(0);
    expect(idxSuma).toBeGreaterThan(idxInmediata);
    expect(idxSimple).toBeGreaterThan(idxSuma);
  });

  it("O-6: cero <a> con texto 'ver todas'/'y N más' a nivel de tile; el remanente es texto sin link (control positivo)", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      itemUrgencia(`B-${i}`, "Suma", "2026-07-20"),
    );
    const filas: FilaPanel[] = [
      {
        cobertura_camara: null,
        conteo: items.length,
        fecha_max: "2026-07-20",
        supresion_causa: null,
        evidencia: {
          items,
          total: items.length,
          consultado_al: "2026-07-21",
          fuente: { origen: "camara", dataset: "tramitacion" },
        },
      },
    ];
    const { container } = render(
      <PanelTileUrgencias filas={filas} maxItems={4} />,
    );
    // Positivo: el remanente (2 boletines más) se declara como texto.
    expect(container.textContent).toMatch(/2 más/);
    // Negativo: ningún <a> con texto de link agregado de tile.
    const links = Array.from(container.querySelectorAll("a"));
    const linkAgregado = links.find((a) =>
      /ver todas|y \d+ más/i.test(a.textContent ?? ""),
    );
    expect(linkAgregado).toBeUndefined();
  });

  it("footer: 'Fuente: Tramitación · según fuente al {d}'; cero 'datos al'", () => {
    const filas: FilaPanel[] = [
      {
        cobertura_camara: null,
        conteo: 1,
        fecha_max: "2026-07-20",
        supresion_causa: null,
        evidencia: {
          items: [itemUrgencia("B-1", "Suma", "2026-07-20")],
          total: 1,
          consultado_al: "2026-07-21",
          fuente: { origen: "camara", dataset: "tramitacion" },
        },
      },
    ];
    const { container } = render(<PanelTileUrgencias filas={filas} />);
    expect(container.textContent).toContain(
      // WR-15 (128-REVIEW): urgencias es carril de HECHOS PASADOS ⇒ D-05 asigna
      // `fecha_max` (20 jul, el último hecho de la fuente), no `consultado_al`
      // (21 jul). La precedencia anterior mezclaba las dos semánticas.
      "Fuente: Tramitación · según fuente al 20 jul 2026",
    );
    expect(container.textContent).not.toContain("datos al");
  });
});
