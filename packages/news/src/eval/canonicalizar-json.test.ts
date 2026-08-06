// canonicalizar-json.test.ts — verifica D-133-E2: claves ordenadas ascendentemente por code
// unit UTF-16, recursivo, arrays NO se reordenan, 2 espacios, LF, sin BOM, newline final,
// sha256 de node:crypto.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";

describe("canonicalizar", () => {
  it("mismas claves en distinto orden ⇒ mismo string", () => {
    const a = { b: 1, a: 2, c: 3 };
    const b = { c: 3, a: 2, b: 1 };
    expect(canonicalizar(a)).toBe(canonicalizar(b));
  });

  it("la reordenación es recursiva (≥3 niveles)", () => {
    const a = { z: { y: { d: 1, b: 2, a: 3 }, x: 4 }, w: 5 };
    const b = { w: 5, z: { x: 4, y: { a: 3, d: 1, b: 2 } } };
    expect(canonicalizar(a)).toBe(canonicalizar(b));
  });

  it("arrays no se reordenan: invertir ⇒ hash distinto", () => {
    const a = { arr: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    const aInvertido = { arr: [{ id: 3 }, { id: 2 }, { id: 1 }] };
    expect(canonicalizar(a)).not.toBe(canonicalizar(aInvertido));
    expect(sha256(canonicalizar(a))).not.toBe(sha256(canonicalizar(aInvertido)));
  });

  it("formato: 2 espacios, sin \\r, sin BOM, newline final", () => {
    const out = canonicalizar({ b: 1, a: [1, 2] });
    expect(out).not.toContain("\r");
    expect(out.charCodeAt(0)).not.toBe(0xfeff);
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toContain('  "a"');
  });

  it("sha256 es hex de 64 y coincide con createHash directo", () => {
    const raw = canonicalizar({ x: 1 });
    const h = sha256(raw);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(createHash("sha256").update(raw).digest("hex"));
  });

  it("canonicalizar es idempotente", () => {
    const valor = { z: 1, a: { y: 2, b: [3, 1, 2] } };
    expect(canonicalizar(valor)).toBe(canonicalizar(valor));
  });
});

// ── WR-02 (133-REVIEW.md): la canonicalización debe fallar ruidosamente, no degradar ──
describe("canonicalizar — WR-02: robustez ante entradas no-objeto-literal", () => {
  it("Object.create(null) con claves desordenadas ⇒ SÍ se reordenan (mismo tratamiento que {})", () => {
    const sinProto = Object.create(null) as Record<string, unknown>;
    sinProto.b = 1;
    sinProto.a = 2;
    const out = canonicalizar(sinProto);
    // "a" debe aparecer ANTES que "b" en el string canonicalizado (orden ascendente).
    expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"b"'));
    expect(out).toBe(canonicalizar({ a: 2, b: 1 }));
  });

  it("undefined dentro de un array ⇒ LANZA (nunca se degrada a null en silencio)", () => {
    expect(() => canonicalizar({ x: [1, undefined, 3] })).toThrow(/no canonicalizable/);
  });

  it("un Map ⇒ LANZA (nunca se serializa como {} en silencio)", () => {
    expect(() => canonicalizar({ m: new Map([["k", "v"]]) })).toThrow(/no canonicalizable/);
  });

  it("un Date ⇒ LANZA (no es un primitivo JSON ni un objeto plano)", () => {
    expect(() => canonicalizar({ d: new Date(0) })).toThrow(/no canonicalizable/);
  });

  it("una función ⇒ LANZA", () => {
    expect(() => canonicalizar({ f: () => 1 })).toThrow(/no canonicalizable/);
  });

  it("control positivo apareado: el mismo objeto SIN el campo no-canonicalizable NO lanza", () => {
    expect(() => canonicalizar({ x: [1, 2, 3] })).not.toThrow();
    expect(() => canonicalizar({ m: { k: "v" } })).not.toThrow();
  });
});
