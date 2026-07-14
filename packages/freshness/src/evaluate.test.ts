import { describe, it, expect } from "vitest";
import { evaluate, evaluateCobertura } from "./evaluate.js";
import { CATALOG, COBERTURA_SENALES, COBERTURA_VOTO_SENALES } from "./catalog.js";
import type { CoberturaCount, QueryRow } from "./query-runner.js";

const NOW = new Date("2026-07-09T12:00:00Z");

function makeRow(fuente: string, diasAtras: number | null): QueryRow {
  let ultimoUpsert: string | null = null;
  if (diasAtras !== null) {
    const d = new Date(NOW.getTime() - diasAtras * 24 * 60 * 60 * 1000);
    ultimoUpsert = d.toISOString();
  }
  return { fuente, ultimoUpsert, ghRun: "n/d", r2Snapshot: "n/d (sin snapshots)" };
}

describe("evaluate", () => {
  it("returns empty array when rows is empty and catalog is empty", () => {
    const results = evaluate([], [], NOW);
    expect(results).toEqual([]);
  });

  it("returns stale: false when diasDesdeUpsert < umbral", () => {
    // leyes umbral = 7; 5 días transcurridos → fresco
    const rows: QueryRow[] = [makeRow("leyes", 5)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.stale).toBe(false);
    expect(results[0]!.diasDesdeUpsert).toBe(5);
  });

  it("returns stale: true when diasDesdeUpsert > umbral", () => {
    // leyes umbral = 7; 8 días transcurridos → stale
    const rows: QueryRow[] = [makeRow("leyes", 8)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.diasDesdeUpsert).toBe(8);
  });

  it("returns stale: true when ultimoUpsert is null (unknown = stale)", () => {
    const rows: QueryRow[] = [makeRow("leyes", null)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.diasDesdeUpsert).toBeNull();
    expect(results[0]!.ultimoUpsert).toBeNull();
  });

  it("returns stale: true when no row matches (fuente not in rows)", () => {
    // No rows for leyes → unknown → stale
    const rows: QueryRow[] = [];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.diasDesdeUpsert).toBeNull();
  });

  it("WR-07: timestamp INPARSEABLE → stale: true (fail-CLOSED, no fail-open)", () => {
    // Un valor que V8 no puede parsear (Invalid Date). ANTES: NaN > umbral = false → OK
    // (fail-open silencioso). AHORA: diasDesdeUpsert=null → stale=true (desconocido=stale).
    const rows: QueryRow[] = [
      { fuente: "leyes", ultimoUpsert: "no-es-una-fecha", ghRun: "n/d", r2Snapshot: "n/d" },
    ];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.diasDesdeUpsert).toBeNull();
    expect(results[0]!.stale).toBe(true);
  });

  it("env override FRESHNESS_UMBRAL_LEYES=3 changes umbral for leyes", () => {
    // With override umbral=3; 5 days → stale (5 > 3)
    const rows: QueryRow[] = [makeRow("leyes", 5)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW, { FRESHNESS_UMBRAL_LEYES: "3" });
    expect(results[0]!.umbralDias).toBe(3);
    expect(results[0]!.stale).toBe(true);
  });

  it("env override with invalid value uses catalog default", () => {
    const rows: QueryRow[] = [makeRow("leyes", 5)];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW, { FRESHNESS_UMBRAL_LEYES: "abc" });
    expect(results[0]!.umbralDias).toBe(7); // catalog default
    expect(results[0]!.stale).toBe(false);
  });

  it("evaluates all 6 catalog entries", () => {
    const rows: QueryRow[] = CATALOG.map((c) => makeRow(c.fuente, 1)); // 1 day → all fresh
    const results = evaluate(rows, CATALOG, NOW);
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.stale).toBe(false);
    }
  });

  it("passes through ghRun and r2Snapshot from QueryRow", () => {
    const rows: QueryRow[] = [
      {
        fuente: "leyes",
        ultimoUpsert: new Date(NOW.getTime() - 2 * 86400000).toISOString(),
        ghRun: "success @ 2026-07-07",
        r2Snapshot: "2026-07-07T10:00:00Z",
      },
    ];
    const catalog = CATALOG.filter((c) => c.fuente === "leyes");
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.ghRun).toBe("success @ 2026-07-07");
    expect(results[0]!.r2Snapshot).toBe("2026-07-07T10:00:00Z");
  });
});

describe("evaluateCobertura (BUSQ-03)", () => {
  function counts(map: Record<string, number | null>): CoberturaCount[] {
    return COBERTURA_SENALES.map((c) => ({ senal: c.senal, count: c.senal in map ? map[c.senal]! : null }));
  }

  it("calcula N/M y pct por señal con M = count(proyecto)", () => {
    const results = evaluateCobertura(
      counts({ proyecto: 200, ficha: 200, idea: 150, embedding: 180 }),
      COBERTURA_SENALES,
    );
    const byId = Object.fromEntries(results.map((r) => [r.senal, r]));
    expect(byId["proyecto"]!.n).toBe(200);
    expect(byId["proyecto"]!.m).toBe(200);
    expect(byId["proyecto"]!.pct).toBe(100);
    expect(byId["embedding"]!.n).toBe(180);
    expect(byId["embedding"]!.m).toBe(200);
    expect(byId["embedding"]!.pct).toBe(90); // 180/200
    expect(byId["idea"]!.pct).toBe(75); // 150/200
  });

  it("count faltante (null) → N y pct null, NUNCA 0 (degradación honesta)", () => {
    const results = evaluateCobertura(
      counts({ proyecto: 100, embedding: null }),
      COBERTURA_SENALES,
    );
    const emb = results.find((r) => r.senal === "embedding")!;
    expect(emb.n).toBeNull();
    expect(emb.pct).toBeNull();
  });

  it("M = 0 → pct null (no divide por cero; corpus vacío no es 0% cubierto)", () => {
    const results = evaluateCobertura(
      counts({ proyecto: 0, ficha: 0, idea: 0, embedding: 0 }),
      COBERTURA_SENALES,
    );
    for (const r of results) {
      expect(r.m).toBe(0);
      expect(r.pct).toBeNull();
    }
  });

  it("marca la señal denominador (proyecto) con esDenominador=true", () => {
    const results = evaluateCobertura(counts({ proyecto: 10 }), COBERTURA_SENALES);
    const denom = results.filter((r) => r.esDenominador);
    expect(denom).toHaveLength(1);
    expect(denom[0]!.senal).toBe("proyecto");
  });

  it("evalúa las 4 señales de cobertura", () => {
    const results = evaluateCobertura(
      counts({ proyecto: 50, ficha: 40, idea: 30, embedding: 35 }),
      COBERTURA_SENALES,
    );
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.senal)).toEqual(["proyecto", "ficha", "idea", "embedding"]);
  });
});

describe("evaluateCobertura del voto (VOTO-05)", () => {
  // El array de voto tiene su PROPIO denominador (sesiones de sala conocidas),
  // DISTINTO de `proyecto`. La misma función evaluateCobertura se reusa porque el
  // array marca su propio esDenominador. NO se toca la semántica del corpus.
  function votoCounts(map: Record<string, number | null>): CoberturaCount[] {
    return COBERTURA_VOTO_SENALES.map((c) => ({
      senal: c.senal,
      count: c.senal in map ? map[c.senal]! : null,
    }));
  }

  it("el array de voto es SEPARADO y tiene su propio denominador (NO proyecto)", () => {
    const denom = COBERTURA_VOTO_SENALES.filter((s) => s.esDenominador);
    expect(denom).toHaveLength(1);
    // El denominador del voto NO es 'proyecto' (ese es el del corpus).
    expect(denom[0]!.senal).not.toBe("proyecto");
    // Existe una fila Cámara y una fila Senado.
    const senales = COBERTURA_VOTO_SENALES.map((s) => s.senal);
    expect(senales).toContain("camara");
    expect(senales).toContain("senado");
  });

  it("SQL 100% estático (sin interpolación de input) en todas las señales de voto", () => {
    for (const cfg of COBERTURA_VOTO_SENALES) {
      expect(cfg.sql).not.toMatch(/\$\{/); // sin template interpolation
      expect(cfg.sql.toLowerCase()).toMatch(/select/);
    }
  });

  it("feliz: Cámara N y Senado K contra M sesiones → pcts correctos por cámara", () => {
    // M = 100 sesiones de sala conocidas; Cámara 40 confirmadas; Senado 25 por nombre.
    const results = evaluateCobertura(
      votoCounts({ sesiones: 100, camara: 40, senado: 25 }),
      COBERTURA_VOTO_SENALES,
    );
    const byId = Object.fromEntries(results.map((r) => [r.senal, r]));
    expect(byId["sesiones"]!.m).toBe(100);
    expect(byId["sesiones"]!.pct).toBe(100);
    expect(byId["camara"]!.n).toBe(40);
    expect(byId["camara"]!.m).toBe(100); // divide contra sesiones, NO contra proyecto
    expect(byId["camara"]!.pct).toBe(40);
    expect(byId["senado"]!.n).toBe(25);
    expect(byId["senado"]!.pct).toBe(25);
  });

  it("degrade: numerador null → n y pct null, NUNCA 0 (degradación honesta)", () => {
    const results = evaluateCobertura(
      votoCounts({ sesiones: 100, camara: null, senado: 10 }),
      COBERTURA_VOTO_SENALES,
    );
    const camara = results.find((r) => r.senal === "camara")!;
    expect(camara.n).toBeNull();
    expect(camara.pct).toBeNull();
  });

  it("denominador 0/ausente → pct null (no divide por cero)", () => {
    const results = evaluateCobertura(
      votoCounts({ sesiones: 0, camara: 0, senado: 0 }),
      COBERTURA_VOTO_SENALES,
    );
    for (const r of results) {
      expect(r.pct).toBeNull(); // M=0 → sin universo, no 0%
    }
  });
});
