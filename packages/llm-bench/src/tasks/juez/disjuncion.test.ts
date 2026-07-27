/**
 * GUARD-QUE-MUERDE del juez/validación (BENCH-02) — vitest estático, sin red.
 *
 * Invariantes sobre el golden congelado:
 *   1. exemplar-pool ∩ eval-pool = ∅ (anti-leakage).
 *   2. scoring ∩ calibración = ∅ (el held-out de calibración es disjunto del scoring).
 *   3. ningún caso lleva un RUT (NO-PII; T-106-07; golden-1263 de adjudicación OFF-LIMITS).
 *   4. el sha256 del `casos.json` vivo coincide con `casos.freeze.json` (T-106-08).
 * Más los meta-tests que prueban que los guards MUERDEN.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { hashCasos, assertFrozen } from "../../guards/freeze";
import { contieneRut, RUT_RE } from "../../guards/no-rut";
import { GOLDEN_SET_SCORING_JUEZ, GOLDEN_SET_CALIBRACION_JUEZ } from "./scorer";
import freezeMarker from "./casos.freeze.json" with { type: "json" };
import exemplarsRaw from "./prompt_exemplars.json" with { type: "json" };
import casosParsed from "./casos.json" with { type: "json" };

const AQUI = dirname(fileURLToPath(import.meta.url));
const CASOS_PATH = join(AQUI, "casos.json");
const RAW = readFileSync(CASOS_PATH, "utf8");

const evalIds = new Set((casosParsed as { id: string }[]).map((c) => c.id));
const exemplarIds = (exemplarsRaw as { id: string }[]).map((e) => e.id);

describe("juez disjunción — anti-leakage exemplar/eval (∩ = ∅)", () => {
  it("exemplar-pool ∩ eval-pool = ∅ (ningún id compartido)", () => {
    const interseccion = exemplarIds.filter((id) => evalIds.has(id));
    expect(interseccion).toEqual([]);
  });

  it("meta: el guard MUERDE si un exemplar reusa un id de eval", () => {
    const idFiltrado = [...evalIds][0]!;
    const interseccionRota = [idFiltrado].filter((id) => evalIds.has(id));
    expect(interseccionRota).not.toEqual([]);
  });
});

describe("juez disjunción — scoring ∩ calibración = ∅ (held-out disjunto)", () => {
  it("los ids de scoring y calibración no se solapan", () => {
    const scoringIds = new Set(GOLDEN_SET_SCORING_JUEZ.map((c) => c.id));
    const solape = GOLDEN_SET_CALIBRACION_JUEZ.filter((c) => scoringIds.has(c.id));
    expect(solape).toEqual([]);
  });
});

describe("juez no-RUT — NO-PII (adjudicación golden-1263 OFF-LIMITS)", () => {
  it("ningún caso del golden contiene un RUT", () => {
    expect(contieneRut(RAW)).toBe(false);
  });

  it("meta: el escáner detecta un RUT sembrado", () => {
    expect(contieneRut('respuesta "9.876.543-K"')).toBe(true);
    expect(new RegExp(RUT_RE.source).test("12345678-9")).toBe(true);
  });
});

describe("juez freeze — hash congelado", () => {
  it("el sha256 vivo de casos.json coincide con el marcador", () => {
    expect(hashCasos(RAW)).toBe(freezeMarker.hash);
  });

  it("assertFrozen no lanza con el marcador correcto", () => {
    expect(() => assertFrozen(RAW, freezeMarker)).not.toThrow();
  });

  it("meta: assertFrozen LANZA si el hash derivó (guard vivo)", () => {
    const marcadorMalo = { ...freezeMarker, hash: "0".repeat(64) };
    expect(() => assertFrozen(RAW, marcadorMalo)).toThrow(/FREEZE ROTO/);
  });

  it("el marcador declara n_casos y estratos coherentes con el set", () => {
    expect(freezeMarker.n_casos).toBe(casosParsed.length);
    expect(freezeMarker.estratos.length).toBeGreaterThanOrEqual(4);
  });
});
