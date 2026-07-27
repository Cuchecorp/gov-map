/**
 * GUARD-QUE-MUERDE del routing (BENCH-02) — vitest estático, sin red.
 *
 * Tres invariantes que el CI asierta sobre el golden congelado:
 *   1. exemplar-pool ∩ eval-pool = ∅ (anti-leakage: los few-shot NUNCA son casos de eval).
 *   2. ningún caso lleva un RUT (NO-PII por construcción, T-106-04).
 *   3. el sha256 del `casos.json` vivo coincide con el marcador `casos.freeze.json`
 *      (freeze: cualquier edición post-freeze rompe CI hasta el re-corte deliberado).
 *
 * Incluye el meta-test adversario de los guards mismos: `assertFrozen` LANZA ante un hash
 * distinto y `contieneRut` detecta un RUT sembrado → los guards MUERDEN, no son teatro.
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

describe("routing disjunción — anti-leakage (∩ = ∅)", () => {
  it("exemplar-pool ∩ eval-pool = ∅ (ningún id compartido)", () => {
    const interseccion = exemplarIds.filter((id) => evalIds.has(id));
    expect(interseccion).toEqual([]);
  });

  it("meta: el guard MUERDE si un exemplar reusa un id de eval", () => {
    const idFiltrado = [...evalIds][0]!;
    const interseccionRota = [idFiltrado].filter((id) => evalIds.has(id));
    expect(interseccionRota).not.toEqual([]); // demuestra que la assertion detectaría el solape
  });
});

describe("routing no-RUT — NO-PII por construcción", () => {
  it("ningún caso del golden contiene un RUT", () => {
    expect(contieneRut(RAW)).toBe(false);
  });

  it("meta: el escáner detecta un RUT sembrado", () => {
    expect(contieneRut('nombre "Juan Perez 12.345.678-9"')).toBe(true);
    expect(new RegExp(RUT_RE.source).test("12345678-9")).toBe(true);
  });
});

describe("routing freeze — hash congelado", () => {
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
