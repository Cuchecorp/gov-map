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
  // WR-05/CR-02 (129-REVIEW): `total` OVERRIDEABLE. Con `total === items.length`
  // (default) un test de remanente es INDECIDIBLE: no puede distinguir si el N
  // salió del `total` del jsonb o del largo del array. Los tests de densidad lo
  // fuerzan a divergir para que el N sea discriminante.
  total: number = items.length,
): FilaPanel {
  return {
    cobertura_camara: cobertura,
    conteo: items.length,
    fecha_max: consultadoAl,
    supresion_causa: null,
    evidencia: {
      items,
      total,
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

  it("129-04 densidad (archivos y retiros): 7 proyectos > maxItems 4 → 4 visibles y remanente HONESTO '3 más'", () => {
    // La unidad de la subsección "Archivos y retiros" es el PROYECTO agrupado
    // por boletín (no el evento), así que el remanente se cuenta sobre la lista
    // agrupada: 7 boletines distintos − 4 mostrados = 3.
    // WR-05 (129-REVIEW): el fixture ponía `total = items.length`, de modo que el
    // N derivado de la lista (7−4=3) y el derivado del `total` coincidían y el
    // test NO podía distinguir la fuente del número — el comentario afirmaba una
    // discriminación que la fixture no permitía. Aquí `total` = 12 DIVERGE a
    // propósito: si el N saliera del `total` del jsonb daría "8 más".
    //
    // Archivados es la EXCEPCIÓN documentada a la invariante H (ver WR-06 en
    // `panel-tile-ingresos.tsx`): su `total` cuenta EVENTOS y la lista agrupa por
    // BOLETÍN, así que el remanente correcto es el de la lista agrupada, no el del
    // total. Este test fija justamente eso.
    const items = ["B-1", "B-2", "B-3", "B-4", "B-5", "B-6", "B-7"].map((b, i) =>
      itemProyecto(b, `2026-07-${String(10 + i).padStart(2, "0")}`),
    );
    const { container } = render(
      <PanelTileIngresos
        ingresos={[]}
        archivados={[filaEvidencia(items, "Cámara de Diputados", "2026-07-24", 12)]}
        maxItems={4}
      />,
    );
    // Densidad: la subsección de archivados muestra a lo más 4 <li>.
    expect(container.querySelectorAll("ul > li")).toHaveLength(4);
    // Honestidad del N: 7 boletines − 4 mostrados = 3, literal exacto.
    expect(container.textContent).toContain("3 más");
    // El N NO sale del `total` de eventos (12 − 4 = 8) …
    expect(container.textContent).not.toContain("8 más");
    // … ni del largo del array crudo, ni de maxItems.
    expect(container.textContent).not.toContain("7 más");
    expect(container.textContent).not.toContain("4 más");
  });

  it("129-04 densidad (nuevos ingresos): 9 de total > maxItems 4 → 4 visibles y remanente HONESTO '5 más', derivado del total del jsonb", () => {
    // CR-02 (129-REVIEW): esta subsección cortaba a maxItems SIN declarar el
    // remanente, y el test previo CERTIFICABA la omisión
    // (`not.toMatch(/\d+ más/)`). Documentar un defecto no lo vuelve contrato:
    // la invariante H (`panel-actualidad.tsx:49-50`) exige remanente declarado.
    //
    // El `total` (9) DIVERGE del largo del array (6) a propósito: así el N es
    // discriminante y prueba que sale del jsonb, no de `items.length`.
    const items = ["I-1", "I-2", "I-3", "I-4", "I-5", "I-6"].map((b, i) =>
      itemProyecto(b, `2026-07-${String(10 + i).padStart(2, "0")}`),
    );
    const { container } = render(
      <PanelTileIngresos
        ingresos={[filaEvidencia(items, "2022-2026 (piso de corpus)", "2026-07-24", 9)]}
        archivados={[]}
        maxItems={4}
      />,
    );
    expect(container.querySelectorAll("ul > li")).toHaveLength(4);
    // Control positivo apareado: los 4 ítems SÍ se pintaron…
    expect(container.textContent).toContain("Proyecto I-1");
    // …y el remanente se respalda con el total real: 9 − 4 = 5.
    expect(container.textContent).toContain("5 más");
    // Ni el largo del array (6 − 4 = 2) ni maxItems se cuelan como N.
    expect(container.textContent).not.toContain("2 más");
    expect(container.textContent).not.toContain("4 más");
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
