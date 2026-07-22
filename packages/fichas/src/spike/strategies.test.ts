import { describe, it, expect, vi } from "vitest";
import { runFtsOnly, runSemanticOnly, runRrf } from "./strategies.js";
import type { SqlRunner } from "./strategies.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Crea un SqlRunner mock que devuelve filas fijas. */
function mockSql(rows: string[][]): SqlRunner {
  return vi.fn().mockResolvedValue(rows);
}

/** Fila de resultado de FTS: [boletin, rank] */
function ftsRows(boletines: string[]): string[][] {
  return boletines.map((b, i) => [b, String(1 - i * 0.1)]);
}

/** Fila de resultado semántico: [boletin, similarity] */
function semRows(boletines: string[]): string[][] {
  return boletines.map((b, i) => [b, String(0.9 - i * 0.05)]);
}

/** Vector ficticio de 768 dims. */
const FAKE_VECTOR = Array.from({ length: 768 }, () => 0.001);

// ── runFtsOnly ────────────────────────────────────────────────────────────────

describe("runFtsOnly", () => {
  it("devuelve boletin[] parseado desde las filas de la DB", async () => {
    const expected = ["14309-04", "12345-01", "99999-02"];
    const runSql = mockSql(ftsRows(expected));

    const result = await runFtsOnly("reforma laboral", { runSql });

    expect(result).toEqual(expected);
  });

  it("devuelve [] si la DB devuelve filas vacías", async () => {
    const runSql = mockSql([]);
    const result = await runFtsOnly("xyz inexistente", { runSql });
    expect(result).toEqual([]);
  });

  it("pasa el texto de query como param 'q' (V5 — nunca interpolado)", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runFtsOnly("medio ambiente", { runSql });

    const [_sql, params] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, string>];
    expect(params).toHaveProperty("q", "medio ambiente");
  });

  it("pasa el limit como param 'limit'", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runFtsOnly("agua potable", { runSql, limit: 10 });

    const [_sql, params] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, string>];
    expect(params).toHaveProperty("limit", "10");
  });

  it("el SQL usa websearch_to_tsquery (nunca to_tsquery crudo)", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runFtsOnly("salud pública", { runSql });

    const [sql] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toMatch(/websearch_to_tsquery/);
    // NO debe contener to_tsquery sin el prefijo websearch_
    // (acepta websearch_to_tsquery pero rechaza to_tsquery standalone)
    const hasRawToTsquery = /(?<!websearch_)to_tsquery/.test(sql);
    expect(hasRawToTsquery).toBe(false);
  });

  it("el SQL contiene match_proyectos vía cuerpos_legales jsonb (NO normas_afectadas)", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runFtsOnly("constitución", { runSql });

    const [sql] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    // Debe usar jsonb_array_elements(f.cuerpos_legales) y string_agg
    expect(sql).toMatch(/cuerpos_legales/);
    expect(sql).toMatch(/jsonb_array_elements/);
    expect(sql).toMatch(/string_agg/);
    // NO debe usar normas_afectadas (columna inexistente — Pitfall #1)
    expect(sql).not.toMatch(/normas_afectadas/);
  });
});

// ── runSemanticOnly ───────────────────────────────────────────────────────────

describe("runSemanticOnly", () => {
  it("devuelve boletin[] parseado desde filas semánticas", async () => {
    const expected = ["11111-01", "22222-02"];
    const runSql = mockSql(semRows(expected));

    const result = await runSemanticOnly(FAKE_VECTOR, { runSql });

    expect(result).toEqual(expected);
  });

  it("usa match_proyectos como RPC (SELECT * from match_proyectos)", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runSemanticOnly(FAKE_VECTOR, { runSql });

    const [sql] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toMatch(/match_proyectos/);
  });

  it("pasa el vector serializado como param (nunca interpolado)", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runSemanticOnly([0.1, 0.2, 0.3], { runSql });

    const [_sql, params] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, string>];
    expect(params).toHaveProperty("query_embedding");
    expect(params["query_embedding"]).toMatch(/^\[0\.1,0\.2,0\.3\]$/);
  });

  it("usa threshold 0.59 por defecto", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runSemanticOnly(FAKE_VECTOR, { runSql });

    const [_sql, params] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, string>];
    expect(params["match_threshold"]).toBe("0.59");
  });

  it("pasa excludeBoletin cuando se especifica (SEM-05)", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runSemanticOnly(FAKE_VECTOR, { runSql, excludeBoletin: "14309-04" });

    const [_sql, params] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, string>];
    expect(params["exclude_boletin"]).toBe("14309-04");
  });
});

// ── runRrf ────────────────────────────────────────────────────────────────────

describe("runRrf — short-circuit de boletín", () => {
  it("boletín formato completo '14309-04': short-circuit sin llamar FTS ni semántico", async () => {
    let callCount = 0;
    const runSql: SqlRunner = vi.fn().mockImplementation((_sql, _params) => {
      callCount++;
      return Promise.resolve([["14309-04"]]);
    });

    const result = await runRrf("14309-04", null, { runSql });

    // Solo una llamada: la del exact-match de boletín
    expect(callCount).toBe(1);
    expect(result).toEqual(["14309-04"]);

    // El SQL de esa llamada no debe contener websearch_to_tsquery ni match_proyectos
    const [sql] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).not.toMatch(/websearch_to_tsquery/);
    expect(sql).not.toMatch(/match_proyectos/);
  });

  it("boletín formato solo base '14309': short-circuit", async () => {
    const runSql = mockSql([["14309-04"]]);
    const result = await runRrf("14309", null, { runSql });
    expect(result).toEqual(["14309-04"]);
    // Solo 1 call (el exact-match)
    expect((runSql as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("boletín formato punteado '14.309-04': short-circuit (Pitfall #5)", async () => {
    const runSql = mockSql([["14309-04"]]);
    const result = await runRrf("14.309-04", null, { runSql });
    expect(result).toEqual(["14309-04"]);
    expect((runSql as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("boletín short-circuit pasa base y full como params bindeados", async () => {
    const runSql = vi.fn().mockResolvedValue([["14309-04"]]);
    await runRrf("14309-04", null, { runSql });

    const [_sql, params] = (runSql as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, string>];
    expect(params).toHaveProperty("base", "14309");
    expect(params).toHaveProperty("full", "14309-04");
  });
});

describe("runRrf — texto libre llama FTS + semántico y fusiona por RRF", () => {
  it("texto libre: llama dos veces runSql (FTS + semántico) y devuelve fusión RRF", async () => {
    // FTS devuelve [A, B], semántico devuelve [B, C]
    // RRF debería poner B primero (aparece en ambas listas)
    const callResults = [
      ftsRows(["A", "B"]),     // primer call: FTS
      semRows(["B", "C"]),     // segundo call: semántico
    ];
    let callIndex = 0;
    const runSql: SqlRunner = vi.fn().mockImplementation(() => {
      return Promise.resolve(callResults[callIndex++]!);
    });

    const result = await runRrf("reforma laboral", FAKE_VECTOR, { runSql });

    // Debe llamar exactamente 2 veces (FTS + semántico)
    expect((runSql as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);

    // B está en ambas listas → RRF lo pone primero
    expect(result[0]).toBe("B");

    // A y C deben estar en el resultado
    expect(result).toContain("A");
    expect(result).toContain("C");
  });

  it("texto libre: devuelve [] si ambas ramas devuelven vacío", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    const result = await runRrf("xyz inexistente", FAKE_VECTOR, { runSql });
    expect(result).toEqual([]);
  });

  it("texto libre: no confunde un boletín largo con texto libre", async () => {
    // "999999-99" — 6 dígitos máximo del detector
    const runSql = mockSql([["999999-99"]]);
    const result = await runRrf("999999-99", null, { runSql });
    // Es un boletín → short-circuit, 1 call
    expect((runSql as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect(result).toEqual(["999999-99"]);
  });

  it("query con palabras que NO son boletín: no hace short-circuit", async () => {
    const runSql = vi.fn().mockResolvedValue([]);
    await runRrf("salud y educación", FAKE_VECTOR, { runSql });
    // 2 llamadas: FTS + semántico
    expect((runSql as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });
});
