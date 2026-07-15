// cursor-leylobby.test — lógica PURA de avance del cursor incremental (DEBT-02, Pitfall 4).
//
// Sin red ni DB: sólo prueba el avance/no-avance determinista del cursor.

import { describe, it, expect } from "vitest";
import {
  avanzarCursor,
  deriveTarea,
  cursorInicial,
  type CursorLeylobby,
} from "./cursor-leylobby";

describe("avanzarCursor — huboDatos=true", () => {
  it("avanza pagina+1 dentro del año cuando no se alcanzó el tope", () => {
    const c: CursorLeylobby = { institucionCodigo: "AA001", anio: 2024, pagina: 1 };
    const sig = avanzarCursor(c, { huboDatos: true, paginaMax: 5 });
    expect(sig).toEqual({ institucionCodigo: "AA001", anio: 2024, pagina: 2 });
  });

  it("al alcanzar el tope de páginas de un año retrocede a anio-1, pagina=1", () => {
    const c: CursorLeylobby = { institucionCodigo: "AA001", anio: 2024, pagina: 5 };
    const sig = avanzarCursor(c, { huboDatos: true, paginaMax: 5 });
    expect(sig).toEqual({ institucionCodigo: "AA001", anio: 2023, pagina: 1 });
  });

  it("no retrocede por debajo de anioMin: se queda en (anioMin, paginaMax) sin loop", () => {
    const c: CursorLeylobby = { institucionCodigo: "AA001", anio: 2015, pagina: 5 };
    const sig = avanzarCursor(c, { huboDatos: true, paginaMax: 5, anioMin: 2015 });
    // agotó el histórico → NO baja de anioMin; permanece en (2015, 5).
    expect(sig).toEqual({ institucionCodigo: "AA001", anio: 2015, pagina: 5 });
  });
});

describe("avanzarCursor — huboDatos=false (degradación/agotamiento, Pitfall 4)", () => {
  it("devuelve un cursor byte-idéntico al de entrada (no avanza)", () => {
    const c: CursorLeylobby = { institucionCodigo: "AA001", anio: 2024, pagina: 3 };
    const sig = avanzarCursor(c, { huboDatos: false, paginaMax: 5 });
    expect(sig).toEqual(c);
    expect(sig).toEqual({ institucionCodigo: "AA001", anio: 2024, pagina: 3 });
  });
});

describe("deriveTarea — TareaInstitucion determinista", () => {
  it("mapea el cursor a una tarea de una sola página", () => {
    const c: CursorLeylobby = { institucionCodigo: "AA001", anio: 2024, pagina: 2 };
    const tarea = deriveTarea(c);
    expect(tarea).toEqual({ institucionCodigo: "AA001", year: 2024, pages: [2] });
  });
});

describe("cursorInicial — primera corrida sin fila previa", () => {
  it("arranca en (año actual, página 1) para la institución dada", () => {
    const anioActual = new Date().getFullYear();
    const c = cursorInicial("AA001");
    expect(c).toEqual({ institucionCodigo: "AA001", anio: anioActual, pagina: 1 });
  });
});
