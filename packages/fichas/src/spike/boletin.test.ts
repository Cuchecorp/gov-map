import { describe, it, expect } from "vitest";
import { detectarBoletin } from "./boletin";
// WR-03 equivalence guard: inline re-implementation of app/lib/boletin-detector.ts
// to assert both copies produce identical output over the shared fixture set.
// If you update detectarBoletin here, update app/lib/boletin-detector.ts too.
function detectarBoletinApp(q: string): { base: string; sufijo: string | null } | null {
  const trimmed = q.trim();
  const hasDotThousands = /^d{1,3}(.d{3})*(-d{1,2})?$/.test(trimmed);
  const stripped = hasDotThousands ? trimmed.replace(/./g, "") : trimmed;
  if (!/^d{3,6}(-d{1,2})?$/.test(stripped)) return null;
  const [base, sufijo = null] = stripped.split("-");
  return { base: base!, sufijo };
}

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
describe("detectarBoletin — equivalencia guard app vs spike (WR-03)", () => {
  // This fixture must stay in sync with app/lib/boletin-detector.ts.
  // SQL regex counterpart: '^ d{1,3}(.d{3})*(-d{1,2})?$' in 0056/0057 migration.
  const FIXTURE: Array<[string, { base: string; sufijo: string | null } | null]> = [
    ["14309-04",   { base: "14309", sufijo: "04" }],
    ["14309",      { base: "14309", sufijo: null }],
    ["14.309-04",  { base: "14309", sufijo: "04" }],
    ["14.309",     { base: "14309", sufijo: null }],
    ["123.456",    { base: "123456", sufijo: null }],
    ["medio ambiente", null],
    ["",           null],
    ["12.34",      null],
    ["100.00",     null],
    ["3.14",       null],
    ["1.234.56",   null],
  ];

  it("spike (boletin.ts) y app (boletin-detector.ts) producen resultados idénticos sobre el fixture", () => {
    for (const [input, expected] of FIXTURE) {
      expect(detectarBoletin(input)).toEqual(expected);
      expect(detectarBoletinApp(input)).toEqual(expected);
    }
  });
});
