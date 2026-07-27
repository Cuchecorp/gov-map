/**
 * GUARD-QUE-MUERDE de la clasificación (BENCH-02) — vitest estático, sin red.
 *
 * Mismas tres invariantes que routing:
 *   1. exemplar-pool ∩ eval-pool = ∅ (anti-leakage: una semilla de cruces reusada como
 *      LABEL es válida; reusada como EXEMPLAR y también como caso de eval está PROHIBIDA).
 *   2. ningún caso lleva un RUT (NO-PII por construcción, T-106-04).
 *   3. el sha256 del `casos.json` vivo coincide con `casos.freeze.json` (freeze).
 *
 * Incluye los meta-tests de los guards (assertFrozen lanza; contieneRut detecta) → muerden.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { hashCasos, assertFrozen } from "../../guards/freeze";
import { contieneRut, RUT_RE } from "../../guards/no-rut";
import freezeMarker from "./casos.freeze.json" with { type: "json" };
import exemplarsRaw from "./prompt_exemplars.json" with { type: "json" };
import casosParsed from "./casos.json" with { type: "json" };

const AQUI = dirname(fileURLToPath(import.meta.url));
const CASOS_PATH = join(AQUI, "casos.json");
const RAW = readFileSync(CASOS_PATH, "utf8");

const evalIds = new Set((casosParsed as { id: string }[]).map((c) => c.id));
const exemplarIds = (exemplarsRaw as { id: string }[]).map((e) => e.id);

describe("clasificación disjunción — anti-leakage (∩ = ∅)", () => {
  it("exemplar-pool ∩ eval-pool = ∅ (ningún id compartido)", () => {
    const interseccion = exemplarIds.filter((id) => evalIds.has(id));
    expect(interseccion).toEqual([]);
  });

  it("meta: la assertion detectaría un exemplar que reusa un id de eval", () => {
    const idFiltrado = [...evalIds][0]!;
    expect([idFiltrado].filter((id) => evalIds.has(id))).not.toEqual([]);
  });
});

describe("clasificación no-RUT — NO-PII por construcción", () => {
  it("ningún caso del golden contiene un RUT", () => {
    expect(contieneRut(RAW)).toBe(false);
  });

  it("meta: el escáner detecta un RUT sembrado", () => {
    expect(contieneRut('contraparte "Sociedad X 9.876.543-K"')).toBe(true);
    expect(new RegExp(RUT_RE.source).test("12.345.678-9")).toBe(true);
  });
});

describe("clasificación freeze — hash congelado", () => {
  it("el sha256 vivo de casos.json coincide con el marcador", () => {
    expect(hashCasos(RAW)).toBe(freezeMarker.hash);
  });

  it("assertFrozen no lanza con el marcador correcto", () => {
    expect(() => assertFrozen(RAW, freezeMarker)).not.toThrow();
  });

  it("meta: assertFrozen LANZA si el hash derivó (guard vivo)", () => {
    const marcadorMalo = { ...freezeMarker, hash: "f".repeat(64) };
    expect(() => assertFrozen(RAW, marcadorMalo)).toThrow(/FREEZE ROTO/);
  });

  it("el marcador declara n_casos coherente con el set", () => {
    expect(freezeMarker.n_casos).toBe(casosParsed.length);
  });
});
