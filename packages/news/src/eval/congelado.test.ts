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
/** Hash del golden-set.json, emitido UNA vez al cierre de 133-b-07 (golden-cli, doble
 * corrida byte-idéntica). Segunda firma: proxy Fable bajo 133-b-ENMIENDA-PROXY.md,
 * ratificación de operador pendiente. */
const HASH_GOLDEN = "47ace935f85ae921c5ca8e2c11133b3a82278b371ba21ba516f498cada33c03c";
/** Hash del veredicto del benchmark 135-03 (bench-135-cli, corrida live 2026-08-10/11).
 * Elección computada: deepseek (empate por solapamiento de IC con minimax ⇒ incumbente).
 * Granite NO-MEDIDO en dominio: 401 de Workers AI (credencial), no calidad. */
const HASH_VEREDICTO_135 = "d6fa8c37aa5ca382df4a46618da1c2c4343a2067639f875f1fdc55a8ae374ca1";

const GOLDEN_PATH = join(AQUI, "golden-set.json");
const VEREDICTO_PATH = join(AQUI, "veredicto-135.json");
const taxonomiaRaw = readFileSync(TAXONOMIA_PATH, "utf8");
const thresholdsRaw = readFileSync(THRESHOLDS_PATH, "utf8");
const goldenRaw = readFileSync(GOLDEN_PATH, "utf8");
const veredictoRaw = readFileSync(VEREDICTO_PATH, "utf8");

describe("congelado — hashes vivos", () => {
  it("(a) sha256 vivo de taxonomia.json coincide con HASH_TAXONOMIA", () => {
    expect(sha256(taxonomiaRaw)).toBe(HASH_TAXONOMIA);
  });

  it("(b) sha256 vivo de thresholds.json coincide con HASH_THRESHOLDS", () => {
    expect(sha256(thresholdsRaw)).toBe(HASH_THRESHOLDS);
  });

  it("(a3) sha256 vivo de golden-set.json coincide con HASH_GOLDEN (133-b-07)", () => {
    expect(sha256(goldenRaw)).toBe(HASH_GOLDEN);
  });

  it("(a4) sha256 vivo de veredicto-135.json coincide con HASH_VEREDICTO_135 y su elección es deepseek con aprueba=true", () => {
    expect(sha256(veredictoRaw)).toBe(HASH_VEREDICTO_135);
    const v = JSON.parse(veredictoRaw) as {
      eleccion: string;
      candidatos: Array<{ provider: string; veredicto: { aprueba: boolean } }>;
    };
    expect(v.eleccion).toBe("deepseek");
    expect(v.candidatos.find((c) => c.provider === "deepseek")!.veredicto.aprueba).toBe(true);
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
  it("(f) la última entrada de CONGELADO.md contiene los TRES hashes vigentes", () => {
    const md = readFileSync(CONGELADO_PATH, "utf8");
    const entradas = md.split(/^### /m);
    const ultima = entradas[entradas.length - 1]!;
    expect(ultima).toContain(HASH_TAXONOMIA);
    expect(ultima).toContain(HASH_THRESHOLDS);
    expect(ultima).toContain(HASH_GOLDEN);
  });
});

describe("congelado — bytes limpios", () => {
  it("(g) los tres JSON: cero \\r, cero BOM, terminan en newline", () => {
    for (const raw of [taxonomiaRaw, thresholdsRaw, goldenRaw]) {
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
