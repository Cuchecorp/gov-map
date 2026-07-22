import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getCachedEmbeddings } from "./embed-cache.js";

// Vector fijo para tests (768 dims de forma simplificada — los tests solo verifican identidad)
const FAKE_VECTOR_A = Array.from({ length: 768 }, (_, i) => i * 0.001);
const FAKE_VECTOR_B = Array.from({ length: 768 }, (_, i) => i * 0.002);

describe("getCachedEmbeddings", () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "embed-cache-test-"));
    cachePath = join(tmpDir, "embed-cache.json");
  });

  // No cleanup necesario para tests de CI — el tmpdir se limpia por el OS

  it("miss: llama al embedder para queries no en cache y persiste el JSON", async () => {
    const embed = vi.fn().mockResolvedValue([FAKE_VECTOR_A]);

    const result = await getCachedEmbeddings(["reforma laboral"], embed, cachePath);

    // Embedder invocado con la query faltante
    expect(embed).toHaveBeenCalledOnce();
    expect(embed).toHaveBeenCalledWith(["reforma laboral"]);

    // Resultado contiene el vector
    expect(result.get("reforma laboral")).toEqual(FAKE_VECTOR_A);

    // Cache escrito en disco
    expect(existsSync(cachePath)).toBe(true);
    const written = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, number[]>;
    expect(written["reforma laboral"]).toEqual(FAKE_VECTOR_A);
  });

  it("hit: no vuelve a invocar el embedder para queries ya en cache", async () => {
    // Primer call: miss → escribe cache
    const embed1 = vi.fn().mockResolvedValue([FAKE_VECTOR_A]);
    await getCachedEmbeddings(["reforma laboral"], embed1, cachePath);
    expect(embed1).toHaveBeenCalledOnce();

    // Segundo call: hit → embedder NO invocado
    const embed2 = vi.fn();
    const result = await getCachedEmbeddings(["reforma laboral"], embed2, cachePath);

    expect(embed2).not.toHaveBeenCalled();
    expect(result.get("reforma laboral")).toEqual(FAKE_VECTOR_A);
  });

  it("miss parcial: embebe solo las queries faltantes, no las ya cacheadas", async () => {
    // Cache inicial con query A
    const embed1 = vi.fn().mockResolvedValue([FAKE_VECTOR_A]);
    await getCachedEmbeddings(["proyecto A"], embed1, cachePath);

    // Segunda llamada con A (hit) + B (miss)
    const embed2 = vi.fn().mockResolvedValue([FAKE_VECTOR_B]);
    const result = await getCachedEmbeddings(["proyecto A", "proyecto B"], embed2, cachePath);

    // Solo invocado con el miss
    expect(embed2).toHaveBeenCalledOnce();
    expect(embed2).toHaveBeenCalledWith(["proyecto B"]);

    // Ambas queries en el resultado
    expect(result.get("proyecto A")).toEqual(FAKE_VECTOR_A);
    expect(result.get("proyecto B")).toEqual(FAKE_VECTOR_B);
  });

  it("cache vacío inicial: funciona sin archivo previo", async () => {
    const embed = vi.fn().mockResolvedValue([FAKE_VECTOR_A, FAKE_VECTOR_B]);

    const result = await getCachedEmbeddings(["q1", "q2"], embed, cachePath);

    expect(result.size).toBe(2);
    expect(result.get("q1")).toEqual(FAKE_VECTOR_A);
    expect(result.get("q2")).toEqual(FAKE_VECTOR_B);
  });

  it("el JSON escrito contiene SOLO floats — sin keys ni URLs", async () => {
    const embed = vi.fn().mockResolvedValue([FAKE_VECTOR_A]);

    // Simular que hay variables de entorno sensibles en process.env
    process.env.GEMINI_API_KEY = "sk-fake-key-12345";
    process.env.SUPABASE_DB_URL = "postgresql://user:pass@host/db";

    await getCachedEmbeddings(["medio ambiente"], embed, cachePath);

    const written = readFileSync(cachePath, "utf8");

    // El JSON no debe contener la key ni la URL
    expect(written).not.toContain("sk-fake-key");
    expect(written).not.toContain("postgresql://");
    expect(written).not.toContain("GEMINI_API_KEY");
    expect(written).not.toContain("SUPABASE_DB_URL");

    // Pero sí contiene la query y los floats
    expect(written).toContain("medio ambiente");

    // Cleanup env
    delete process.env.GEMINI_API_KEY;
    delete process.env.SUPABASE_DB_URL;
  });

  it("devuelve Map vacío para array de queries vacío", async () => {
    const embed = vi.fn().mockResolvedValue([]);
    const result = await getCachedEmbeddings([], embed, cachePath);
    expect(result.size).toBe(0);
    expect(embed).not.toHaveBeenCalled();
  });
});
