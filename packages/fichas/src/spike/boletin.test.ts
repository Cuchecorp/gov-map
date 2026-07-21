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
});
