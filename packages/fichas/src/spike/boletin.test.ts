import { describe, it, expect } from "vitest";
import { detectarBoletin } from "./boletin";

describe("detectarBoletin", () => {
  it('detecta formato "14309-04" → {base:"14309", sufijo:"04"}', () => {
    expect(detectarBoletin("14309-04")).toEqual({ base: "14309", sufijo: "04" });
  });

  it('detecta formato "14309" → {base:"14309", sufijo:null}', () => {
    expect(detectarBoletin("14309")).toEqual({ base: "14309", sufijo: null });
  });

  it('detecta formato punteado "14.309-04" → {base:"14309", sufijo:"04"} (el caso que hoy falla, Pitfall #5)', () => {
    expect(detectarBoletin("14.309-04")).toEqual({ base: "14309", sufijo: "04" });
  });

  it('detecta formato punteado "14.309" → {base:"14309", sufijo:null}', () => {
    expect(detectarBoletin("14.309")).toEqual({ base: "14309", sufijo: null });
  });

  it('texto libre "medio ambiente" → null', () => {
    expect(detectarBoletin("medio ambiente")).toBeNull();
  });

  it('cadena vacía "" → null', () => {
    expect(detectarBoletin("")).toBeNull();
  });

  // WR-01: regression — punto decimal / dinero NO debe ser boletín
  it('decimal "12.34" → null (punto decimal, no separador de miles)', () => {
    expect(detectarBoletin('12.34')).toBeNull();
  });

  it('decimal "100.00" → null (monto monetario, no boletín)', () => {
    expect(detectarBoletin('100.00')).toBeNull();
  });

  it('decimal "3.14" → null (pi, no boletín)', () => {
    expect(detectarBoletin('3.14')).toBeNull();
  });

  it('decimal "1.234.56" → null (punto mal posicionado)', () => {
    expect(detectarBoletin('1.234.56')).toBeNull();
  });

  // Formatos válidos de boletín punteado siguen funcionando
  it('formato punteado largo "123.456" → {base:"123456", sufijo:null}', () => {
    expect(detectarBoletin('123.456')).toEqual({ base: '123456', sufijo: null });
  });

});
