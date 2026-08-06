/**
 * congelado.test.ts — la vara de la congelación (D-133-E2). Patrón copiado de
 * `packages/llm-bench/src/tasks/clasificacion/disjuncion.test.ts:52-70` (freeze por sha256),
 * sin depender de `@obs/llm-bench` para no arrastrar su grafo de dependencias — mismo criterio
 * que ya aplicó `canonicalizar-json.ts` para `hashCasos`/`assertFrozen`.
 *
 * Compara BYTES, jamás objetos parseados: la comparación de sincronía usa el matcher de
 * igualdad estricta de strings. Un matcher de igualdad profunda sobre JSON parseado sería el
 * falso verde nº1 de la fase — no cazaría un reordenamiento de claves que cambia los bytes sin
 * cambiar la semántica.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { TAXONOMIA } from "./taxonomia.js";
import { THRESHOLDS } from "./thresholds.js";
import { canonicalizar, sha256 } from "./canonicalizar-json.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const TAXONOMIA_PATH = join(AQUI, "taxonomia.json");
const THRESHOLDS_PATH = join(AQUI, "thresholds.json");
const CONGELADO_PATH = join(AQUI, "CONGELADO.md");

/** Hashes congelados — impresos literalmente por el CLI en la Task 1 de 133-03. */
const HASH_TAXONOMIA = "90981888979773ec3f483c4bb6f10c26a75f7e248f18a03b662bcb1fcd9f706c";
const HASH_THRESHOLDS = "e428594463ebae3b6b4b1bce0c0ee2c3fd35516b70d2f7b6e9c73e2583938d1e";

const taxonomiaRaw = readFileSync(TAXONOMIA_PATH, "utf8");
const thresholdsRaw = readFileSync(THRESHOLDS_PATH, "utf8");

describe("congelado — hashes vivos", () => {
  it("(a) sha256 vivo de taxonomia.json coincide con HASH_TAXONOMIA", () => {
    expect(sha256(taxonomiaRaw)).toBe(HASH_TAXONOMIA);
  });

  it("(b) sha256 vivo de thresholds.json coincide con HASH_THRESHOLDS", () => {
    expect(sha256(thresholdsRaw)).toBe(HASH_THRESHOLDS);
  });
});

describe("congelado — sincronía byte a byte .ts -> .json", () => {
  it("(c) canonicalizar(TAXONOMIA) es byte a byte idéntico a taxonomia.json en disco", () => {
    expect(canonicalizar(TAXONOMIA)).toBe(taxonomiaRaw);
  });

  it("(d) canonicalizar(THRESHOLDS) es byte a byte idéntico a thresholds.json en disco", () => {
    expect(canonicalizar(THRESHOLDS)).toBe(thresholdsRaw);
  });
});

describe("congelado — meta: el hash muerde", () => {
  it("(e) mutar un byte del string leído produce un hash distinto", () => {
    const mutado = `${taxonomiaRaw.slice(0, -1)}X\n`;
    expect(sha256(mutado)).not.toBe(sha256(taxonomiaRaw));
  });
});

describe("congelado — CONGELADO.md", () => {
  it("(f) la última entrada de CONGELADO.md contiene los dos hashes vigentes", () => {
    const md = readFileSync(CONGELADO_PATH, "utf8");
    const entradas = md.split(/^### /m);
    const ultima = entradas[entradas.length - 1]!;
    expect(ultima).toContain(HASH_TAXONOMIA);
    expect(ultima).toContain(HASH_THRESHOLDS);
  });
});

describe("congelado — bytes limpios", () => {
  it("(g) ambos JSON: cero \\r, cero BOM, terminan en newline", () => {
    for (const raw of [taxonomiaRaw, thresholdsRaw]) {
      expect(raw.includes("\r")).toBe(false);
      expect(raw.charCodeAt(0)).not.toBe(0xfeff);
      expect(raw.endsWith("\n")).toBe(true);
    }
  });

  it("(h) control positivo apareado: el mismo assert sobre un fixture con \\r inyectado falla", () => {
    const fixtureConCr = taxonomiaRaw.replace("\n", "\r\n");
    expect(fixtureConCr.includes("\r")).toBe(true);
  });
});
