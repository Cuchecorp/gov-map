/**
 * panel-tile-comisiones.test.tsx — Tile 2 "Comisiones citadas esta semana"
 * (Phase 128, PANEL-02/05/07). Fixtures copiados verbatim de 128-RESEARCH.md.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { PanelTileComisiones } from "./panel-tile-comisiones";

afterEach(cleanup);

const filaSenado = {
  cobertura_camara: "Senado",
  conteo: 23,
  evidencia: {
    items: [
      {
        fecha: "2026-08-03",
        enlace: "https://web-back.senado.cl/api/commissions_citations?limit=100",
        comision: "de Medio Ambiente, Cambio Climático y Bienes Nacionales",
        horario: "12:30 a 14:00",
        semana_iso: "2026-W32",
        puntos_total: 1,
        puntos: [
          {
            boletin: null,
            titulo: null,
            enlace: null,
            materia: "Recibir al Alcalde de la comuna de Concepción…",
            posicion: 0,
            en_corpus: false,
          },
        ],
      },
      {
        fecha: "2026-08-05",
        enlace: "https://web-back.senado.cl/api/commissions_citations?limit=100",
        comision: "de Hacienda",
        horario: "10:00 a 11:30",
        semana_iso: "2026-W32",
        puntos_total: 1,
        puntos: [
          {
            boletin: "14782-13",
            titulo: "Equipara el derecho de sala cuna…",
            enlace: "https://tramitacion.senado.cl/wspublico/tramitacion.php",
            materia: "materia",
            posicion: 0,
            en_corpus: true,
          },
        ],
      },
    ],
    total: 2,
    consultado_al: "2026-07-30",
    fuente: { origen: "plataforma-agenda", dataset: "agenda" },
  },
};

describe("PanelTileComisiones", () => {
  it('título del tile: "Comisiones citadas esta semana"', () => {
    const { getByText } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(getByText("Comisiones citadas esta semana")).toBeTruthy();
  });

  it("punto boletín + en_corpus:true → <a href=/proyecto/{b}#estado> con boletín + título", () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    const a = container.querySelector('a[href="/proyecto/14782-13#estado"]');
    expect(a).not.toBeNull();
    expect(a?.textContent).toContain("14782-13");
  });

  it("detalle del punto: 'Citado el {d} · Comisión {comision} · {horario}'", () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain(
      "Citado el 05 ago 2026 · Comisión de Hacienda · 10:00 a 11:30",
    );
  });

  it("horario null → se omite el segmento, sin fabricar hora", () => {
    const filaSinHorario = {
      cobertura_camara: "Senado",
      conteo: 1,
      evidencia: {
        items: [
          {
            fecha: "2026-08-05",
            enlace: "https://x",
            comision: "de Hacienda",
            horario: null,
            semana_iso: "2026-W32",
            puntos_total: 1,
            puntos: [
              {
                boletin: "14782-13",
                titulo: "t",
                enlace: "https://x",
                materia: "m",
                posicion: 0,
                en_corpus: true,
              },
            ],
          },
        ],
        total: 1,
        consultado_al: "2026-07-30",
        fuente: { origen: "plataforma-agenda", dataset: "agenda" },
      },
    };
    const { container } = render(
      <PanelTileComisiones filas={[filaSinHorario]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("Citado el 05 ago 2026 · Comisión de Hacienda");
    expect(container.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("punto boletin:null → texto plano de materia truncado + enlace externo; CERO href interno", () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("Recibir al Alcalde de la comuna de Concepción");
    // El punto sin boletín (posición 0 de la primera citación) no genera href interno
    const hrefsInternos = container.querySelectorAll('a[href^="/proyecto"]');
    // Solo el punto CON boletín (14782-13) debe tener href interno; el sin-boletín, no.
    expect(hrefsInternos.length).toBe(1);
  });

  it("chip L5: boletín en el Map → 'Urgencia {grado} fechada el {d}'", () => {
    const urgencias = new Map([
      ["14782-13", { grado: "Suma", fecha: "2026-07-28" }],
    ]);
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={urgencias} />,
    );
    expect(container.textContent).toContain("Urgencia Suma fechada el 28 jul 2026");
  });

  it("cobertura L7: Senado conteo:23 sin fila de Cámara → denominador con ambos números", () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain(
      "23 citaciones del Senado · 0 de la Cámara en las fuentes consultadas",
    );
  });

  it("el cero de Cámara nunca aparece mudo: siempre con 'en las fuentes consultadas'", () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("0 de la Cámara");
    expect(container.textContent).toContain("en las fuentes consultadas");
  });

  it("puntos_total:31 con maxItems:4 → 4 ítems + 'y 27 más →' con href correcto", () => {
    const puntosGenerados = Array.from({ length: 4 }, (_, i) => ({
      boletin: `1000${i}-1`,
      titulo: `Título ${i}`,
      enlace: "https://x",
      materia: "materia",
      posicion: i,
      en_corpus: true,
    }));
    const filaGrande = {
      cobertura_camara: "Senado",
      conteo: 31,
      evidencia: {
        items: [
          {
            fecha: "2026-08-05",
            enlace: "https://x",
            comision: "de Hacienda",
            horario: "10:00",
            semana_iso: "2026-W32",
            puntos_total: 31,
            puntos: puntosGenerados,
          },
        ],
        total: 1,
        consultado_al: "2026-07-30",
        fuente: { origen: "plataforma-agenda", dataset: "agenda" },
      },
    };
    const { getByText } = render(
      <PanelTileComisiones filas={[filaGrande]} urgencias={new Map()} maxItems={4} />,
    );
    const link = getByText("y 27 más →");
    expect(link).toBeTruthy();
    const href = (link.closest("a") as HTMLAnchorElement).getAttribute("href");
    expect(href).toBe("/agenda?semana=2026-W32#citaciones");
  });

  it('footer: "Fuente: Agenda del Congreso · según fuente al {consultado_al}"; cero "datos al"', () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    expect(container.textContent).toContain("Fuente: Agenda del Congreso");
    expect(container.textContent).toContain("según fuente al 30 jul 2026");
    expect(container.textContent).not.toContain("datos al");
  });

  it('cero vocabulario de ranking: DOM no contiene "top"/"los más"/"la más activa"', () => {
    const { container } = render(
      <PanelTileComisiones filas={[filaSenado]} urgencias={new Map()} />,
    );
    const texto = container.textContent?.toLowerCase() ?? "";
    expect(texto).not.toContain("top");
    expect(texto).not.toContain("los más");
    expect(texto).not.toContain("la más activa");
  });
});
