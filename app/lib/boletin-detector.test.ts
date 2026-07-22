import { describe, expect, it } from "vitest";

import { detectarBoletin } from "./boletin-detector";

describe("detectarBoletin — tres formatos + casos null", () => {
  it('"14309-04" → {base:"14309", sufijo:"04"}', () => {
    expect(detectarBoletin("14309-04")).toEqual({ base: "14309", sufijo: "04" });
  });

  it('"14309" → {base:"14309", sufijo:null}', () => {
    expect(detectarBoletin("14309")).toEqual({ base: "14309", sufijo: null });
  });

  it('"14.309-04" (punteado) → {base:"14309", sufijo:"04"} (RETR-01, Pitfall 5)', () => {
    expect(detectarBoletin("14.309-04")).toEqual({ base: "14309", sufijo: "04" });
  });

  it('"14.309" (punteado sin sufijo) → {base:"14309", sufijo:null}', () => {
    expect(detectarBoletin("14.309")).toEqual({ base: "14309", sufijo: null });
  });

  it('"3.14" (decimal) → null (no es boletín)', () => {
    expect(detectarBoletin("3.14")).toBeNull();
  });

  it('"medio ambiente" (texto libre) → null', () => {
    expect(detectarBoletin("medio ambiente")).toBeNull();
  });

  it('"  14309-04  " (con espacios) → {base:"14309", sufijo:"04"} (trim)', () => {
    expect(detectarBoletin("  14309-04  ")).toEqual({ base: "14309", sufijo: "04" });
  });
});
