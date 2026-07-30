/**
 * panel-tile-sala.test.tsx — Tile 1 "En tabla de sala esta semana" (Phase 128,
 * PANEL-02/05/07). Fixtures copiados verbatim de 128-RESEARCH.md §Contrato REAL
 * del jsonb en PROD, incluida la fila sintética de Cámara (numero/tipo/hora NULL).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PanelTileSala } from "./panel-tile-sala";

afterEach(cleanup);

const filaSenado = {
  cobertura_camara: "Senado",
  evidencia: {
    items: [
      {
        fecha: "2026-08-04",
        tipo: "Ordinaria",
        numero: "47",
        hora_inicio: "16:00",
        enlace: "https://web-back.senado.cl/api/weekly_table?limit=100",
        tabla_total: 5,
        tabla: [
          {
            boletin: "14782-13",
            titulo: "Equipara el derecho de sala cuna…",
            enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
            materia:
              "Proyecto de ley, iniciado en Mensaje… (Boletín Nº 14.782-13)…",
            posicion: 1,
            quorum: "5",
            en_corpus: true,
            parte_sesion: "ORDEN DEL DÍA",
          },
        ],
      },
    ],
    total: 1,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-agenda", dataset: "agenda" },
  },
};

const filaCamara = {
  cobertura_camara: "Cámara de Diputados",
  evidencia: {
    items: [
      {
        tipo: null,
        numero: null,
        hora_inicio: null,
        fecha: "2026-08-03",
        enlace: "https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL",
        tabla_total: 25,
        tabla: [
          {
            boletin: "16569-25",
            titulo: "Modifica el Código Penal…",
            enlace: "https://www.camara.cl/pley/pley_detalle.aspx?prmID=1",
            materia: "Modifica el Código Penal…",
            posicion: 1,
            quorum: "SUMA (04.08.2026)",
            en_corpus: false,
            parte_sesion: "TABLA",
          },
        ],
      },
    ],
    total: 1,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-agenda", dataset: "agenda" },
  },
};

describe("PanelTileSala", () => {
  it('título del tile: "En tabla de sala esta semana"', () => {
    const { getByText } = render(
      <PanelTileSala filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(getByText("En tabla de sala esta semana")).toBeTruthy();
  });

  it("fila de Senado: encabezado con numero/tipo/hora + el día", () => {
    const { container } = render(
      <PanelTileSala filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("47");
    expect(container.textContent).toContain("Ordinaria");
    expect(container.textContent).toContain("16:00");
    expect(container.textContent).toContain("04 ago 2026");
  });

  it('fila de Cámara: CERO "Sesión N" y CERO hora fabricada; el día SÍ aparece (control apareado)', () => {
    const { container } = render(
      <PanelTileSala filas={[filaCamara]} urgencias={new Map()} />,
    );
    expect(container.textContent).not.toMatch(/Sesión\s*\d/);
    expect(container.textContent).not.toContain("a las");
    // control positivo: el día SÍ aparece
    expect(container.textContent).toContain("03 ago 2026");
    expect(container.textContent).toContain("tabla semanal");
  });

  it("punto en_corpus:true → <a href=/proyecto/{b}#estado> con boletín y título", () => {
    const { container } = render(
      <PanelTileSala filas={[filaSenado]} urgencias={new Map()} />,
    );
    const a = container.querySelector('a[href="/proyecto/14782-13#estado"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toContain("14782-13");
  });

  it("punto en_corpus:false → CERO href interno + enlace externo", () => {
    const { container } = render(
      <PanelTileSala filas={[filaCamara]} urgencias={new Map()} />,
    );
    expect(container.querySelectorAll('a[href^="/proyecto"]').length).toBe(0);
    const externo = container.querySelector('a[href^="https://"]');
    expect(externo).not.toBeNull();
  });

  it('tabla_total:25 con maxItems:4 → "y N más →" con href ?semana= ANTES de #tabla-sala', () => {
    const filaCon25 = {
      cobertura_camara: "Cámara de Diputados",
      evidencia: {
        items: [
          {
            tipo: null,
            numero: null,
            hora_inicio: null,
            fecha: "2026-08-03",
            enlace: "https://www.camara.cl/verDoc.aspx",
            tabla_total: 25,
            tabla: Array.from({ length: 1 }, (_, i) => ({
              boletin: `1000${i}-1`,
              titulo: `Título ${i}`,
              enlace: "https://www.camara.cl",
              materia: "materia",
              posicion: i,
              quorum: null,
              en_corpus: true,
              parte_sesion: "TABLA",
            })),
          },
        ],
        total: 1,
        consultado_al: "2026-07-30",
        fuente: { origen: "plataforma-agenda", dataset: "agenda" },
      },
    };
    const { container, getByText } = render(
      <PanelTileSala filas={[filaCon25]} urgencias={new Map()} maxItems={4} />,
    );
    // WR-01 (128-REVIEW): el remanente es "total − MOSTRADOS", no
    // "total − maxItems". Esta fixture declara `tabla_total: 25` y trae UN solo
    // punto: se pinta 1, así que el remanente honesto es 24. El "y 21 más" que
    // este test exigía antes daba por pintados 4 ítems que no existían.
    const link = getByText("y 24 más →");
    expect(link).toBeTruthy();
    const href = (link.closest("a") as HTMLAnchorElement).getAttribute("href");
    expect(href).toMatch(/^\/agenda\?semana=.*#tabla-sala$/);
    const qIdx = href!.indexOf("?");
    const hIdx = href!.indexOf("#");
    expect(qIdx).toBeGreaterThan(-1);
    expect(qIdx).toBeLessThan(hIdx);
  });

  it("tabla_total <= maxItems → NO se renderiza el 'y N más'", () => {
    const filaCorta = {
      cobertura_camara: "Senado",
      evidencia: {
        items: [
          {
            fecha: "2026-08-04",
            tipo: "Ordinaria",
            numero: "47",
            hora_inicio: "16:00",
            enlace: "https://web-back.senado.cl",
            tabla_total: 1,
            tabla: [
              {
                boletin: "14782-13",
                titulo: "t",
                enlace: "https://x",
                materia: "m",
                posicion: 1,
                quorum: "5",
                en_corpus: true,
                parte_sesion: "ORDEN DEL DÍA",
              },
            ],
          },
        ],
        total: 1,
        consultado_al: "2026-07-30",
        fuente: { origen: "plataforma-agenda", dataset: "agenda" },
      },
    };
    const { queryByText } = render(
      <PanelTileSala filas={[filaCorta]} urgencias={new Map()} maxItems={4} />,
    );
    expect(queryByText(/y \d+ más/)).toBeNull();
  });

  it("semana_iso ausente en agenda_sala → se deriva de items[].fecha, href con ?semana=", () => {
    const filaConMuchos = {
      cobertura_camara: "Senado",
      evidencia: {
        items: [
          {
            fecha: "2026-08-04",
            tipo: "Ordinaria",
            numero: "47",
            hora_inicio: "16:00",
            enlace: "https://web-back.senado.cl",
            tabla_total: 6,
            tabla: [
              {
                boletin: "14782-13",
                titulo: "t",
                enlace: "https://x",
                materia: "m",
                posicion: 1,
                quorum: "5",
                en_corpus: true,
                parte_sesion: "ORDEN DEL DÍA",
              },
            ],
          },
        ],
        total: 1,
        consultado_al: "2026-07-30",
        fuente: { origen: "plataforma-agenda", dataset: "agenda" },
      },
    };
    const { getByText } = render(
      <PanelTileSala filas={[filaConMuchos]} urgencias={new Map()} maxItems={4} />,
    );
    const link = getByText(/y \d+ más →/);
    const href = (link.closest("a") as HTMLAnchorElement).getAttribute("href");
    expect(href).toContain("?semana=2026-W32");
  });

  it("chip L5: boletín presente en el Map → 'Urgencia {grado} fechada el {d}'", () => {
    const urgencias = new Map([
      ["14782-13", { grado: "Suma", fecha: "2026-07-28" }],
    ]);
    const { container } = render(
      <PanelTileSala filas={[filaSenado]} urgencias={urgencias} />,
    );
    expect(container.textContent).toContain("Urgencia Suma fechada el 28 jul 2026");
  });

  it("chip L5: boletín ausente en el Map → sin chip (jamás 'sin urgencia')", () => {
    const { container } = render(
      <PanelTileSala filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).not.toContain("Urgencia");
    expect(container.textContent).not.toContain("sin urgencia");
  });

  it('quorum NUNCA se renderiza como "quórum" ni como urgencia (P4)', () => {
    const { container } = render(
      <PanelTileSala filas={[filaSenado, filaCamara]} urgencias={new Map()} />,
    );
    expect(container.textContent?.toLowerCase()).not.toContain("quórum");
  });

  it('footer: "Fuente: Agenda del Congreso · según fuente al {consultado_al}", cero "datos al"', () => {
    const { container } = render(
      <PanelTileSala filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("Fuente: Agenda del Congreso");
    expect(container.textContent).toContain("según fuente al 30 jul 2026");
    expect(container.textContent).not.toContain("datos al");
  });

  it("etiquetaFuente null → el footer omite la fuente pero conserva 'según fuente al'", () => {
    const filaSinFuente = {
      cobertura_camara: "Senado",
      evidencia: {
        items: [
          {
            fecha: "2026-08-04",
            tipo: "Ordinaria",
            numero: "47",
            hora_inicio: "16:00",
            enlace: null,
            tabla_total: 1,
            tabla: [],
          },
        ],
        total: 1,
        consultado_al: "2026-07-30",
        fuente: { origen: null, dataset: null },
      },
    };
    const { container } = render(
      <PanelTileSala filas={[filaSinFuente]} urgencias={new Map()} />,
    );
    expect(container.textContent).not.toContain("Fuente:");
    expect(container.textContent).toContain("según fuente al 30 jul 2026");
  });
});
