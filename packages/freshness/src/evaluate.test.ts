import { describe, it, expect } from "vitest";
import { evaluate, evaluateCobertura } from "./evaluate.js";
import {
  CATALOG,
  COBERTURA_SENALES,
  COBERTURA_VOTO_SENALES,
  COBERTURA_RUT_PARLAMENTARIO_SENALES,
  COBERTURA_RUT_ENTIDAD_SENALES,
} from "./catalog.js";
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

  it("evaluates all catalog entries (una fila por fuente registrada)", () => {
    // El catálogo crece por diseño (chilecompra=MONEY-01, servel=MONEY-02). El evaluador debe
    // devolver EXACTAMENTE una fila por fuente registrada — se afirma contra CATALOG.length, no
    // contra un número hardcodeado que se desactualiza cada vez que se registra una fuente nueva.
    const rows: QueryRow[] = CATALOG.map((c) => makeRow(c.fuente, 1)); // 1 day → all fresh
    const results = evaluate(rows, CATALOG, NOW);
    expect(results).toHaveLength(CATALOG.length);
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

describe("staleness de ChileCompra (MONEY-01)", () => {
  // La señal ChileCompra mide `contratos_ingesta_estado.ingestado_hasta` (umbral 30d),
  // MISMO patrón declarativo que las 6 fuentes previas: el evaluador `evaluate` se reusa
  // TAL CUAL (la entrada CATALOG basta). Estos 3 casos congelan el comportamiento honesto:
  // stale-null (nunca barrido, el estado HOY) / stale > umbral / fresh <= umbral.
  const chilecompra = () => CATALOG.filter((c) => c.fuente === "chilecompra");

  it("la entrada chilecompra existe sobre contratos_ingesta_estado.ingestado_hasta, umbral 30", () => {
    const cfg = CATALOG.find((c) => c.fuente === "chilecompra");
    expect(cfg).toBeDefined();
    expect(cfg!.tabla).toBe("contratos_ingesta_estado");
    expect(cfg!.columna).toBe("ingestado_hasta");
    expect(cfg!.umbralDias).toBe(30);
    expect(cfg!.overrideEnv).toBe("FRESHNESS_UMBRAL_CHILECOMPRA");
    expect(cfg!.workflowYml).toBe("chilecompra-weekly.yml");
  });

  it("stale-null: ingestado_hasta null (nunca barrido, estado HOY) → stale (desconocido = stale, fail-closed)", () => {
    const rows: QueryRow[] = [makeRow("chilecompra", null)];
    const results = evaluate(rows, chilecompra(), NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.fuente).toBe("chilecompra");
    expect(results[0]!.diasDesdeUpsert).toBeNull();
    expect(results[0]!.stale).toBe(true);
  });

  it("stale > umbral: 45 días desde el último barrido (> 30) → stale", () => {
    const rows: QueryRow[] = [makeRow("chilecompra", 45)];
    const results = evaluate(rows, chilecompra(), NOW);
    expect(results[0]!.diasDesdeUpsert).toBe(45);
    expect(results[0]!.stale).toBe(true);
  });

  it("fresh <= umbral: 20 días desde el último barrido (<= 30) → fresco", () => {
    const rows: QueryRow[] = [makeRow("chilecompra", 20)];
    const results = evaluate(rows, chilecompra(), NOW);
    expect(results[0]!.diasDesdeUpsert).toBe(20);
    expect(results[0]!.stale).toBe(false);
  });

  it("respeta el override FRESHNESS_UMBRAL_CHILECOMPRA (baja el umbral a 15 → 20d ahora es stale)", () => {
    const rows: QueryRow[] = [makeRow("chilecompra", 20)];
    const results = evaluate(rows, chilecompra(), NOW, { FRESHNESS_UMBRAL_CHILECOMPRA: "15" });
    expect(results[0]!.umbralDias).toBe(15);
    expect(results[0]!.stale).toBe(true);
  });
});

describe("staleness de SERVEL (MONEY-02)", () => {
  // La señal SERVEL mide `aportes_ingesta_estado.ingestado_hasta` (umbral 365d), MISMO patrón
  // declarativo que ChileCompra: el evaluador `evaluate` se reusa TAL CUAL. SERVEL es LOCAL por
  // diseño (sin cron → workflowYml "servel-weekly.yml" inexistente → GH "n/d" honesto). Estos casos
  // congelan: la forma de la entrada, stale-null (nunca barrido, estado HOY), stale > umbral,
  // fresh <= umbral, override, y la señal GH "n/d".
  const servel = () => CATALOG.filter((c) => c.fuente === "servel");

  it("la entrada servel existe sobre aportes_ingesta_estado.ingestado_hasta, umbral 365", () => {
    const cfg = CATALOG.find((c) => c.fuente === "servel");
    expect(cfg).toBeDefined();
    expect(cfg!.tabla).toBe("aportes_ingesta_estado");
    expect(cfg!.columna).toBe("ingestado_hasta");
    expect(cfg!.umbralDias).toBe(365);
    expect(cfg!.overrideEnv).toBe("FRESHNESS_UMBRAL_SERVEL");
    // servel-weekly.yml NO existe (LOCAL sin cron) — la señal GH figura "n/d" (honesto).
    expect(cfg!.workflowYml).toBe("servel-weekly.yml");
  });

  it("stale-null: ingestado_hasta null (nunca barrido, estado HOY) → stale (desconocido = stale, fail-closed)", () => {
    const rows: QueryRow[] = [makeRow("servel", null)];
    const results = evaluate(rows, servel(), NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.fuente).toBe("servel");
    expect(results[0]!.diasDesdeUpsert).toBeNull();
    expect(results[0]!.stale).toBe(true);
  });

  it("stale > umbral: 400 días desde el último barrido (> 365) → stale", () => {
    const rows: QueryRow[] = [makeRow("servel", 400)];
    const results = evaluate(rows, servel(), NOW);
    expect(results[0]!.diasDesdeUpsert).toBe(400);
    expect(results[0]!.stale).toBe(true);
  });

  it("fresh <= umbral: 200 días desde el último barrido (<= 365) → fresco", () => {
    const rows: QueryRow[] = [makeRow("servel", 200)];
    const results = evaluate(rows, servel(), NOW);
    expect(results[0]!.diasDesdeUpsert).toBe(200);
    expect(results[0]!.stale).toBe(false);
  });

  it("respeta el override FRESHNESS_UMBRAL_SERVEL (baja el umbral a 100 → 200d ahora es stale)", () => {
    const rows: QueryRow[] = [makeRow("servel", 200)];
    const results = evaluate(rows, servel(), NOW, { FRESHNESS_UMBRAL_SERVEL: "100" });
    expect(results[0]!.umbralDias).toBe(100);
    expect(results[0]!.stale).toBe(true);
  });

  it("GH Actions 'n/d' honesto: sin señal de workflow (LOCAL sin cron) el ghRun cae a 'n/d'", () => {
    // makeRow no adjunta ghRun (default "n/d"); el evaluador lo propaga sin fabricar un 'success'.
    const rows: QueryRow[] = [makeRow("servel", null)];
    const results = evaluate(rows, servel(), NOW);
    expect(results[0]!.ghRun).toBe("n/d");
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

describe("evaluateCobertura de RUT DV-válido (RUT-01)", () => {
  // Dos maestras, cada una con su PROPIO denominador — arrays SEPARADOS evaluados por
  // separado. NO tocan el denominador del corpus (proyecto) ni el del voto (sesiones).
  function parlCounts(map: Record<string, number | null>): CoberturaCount[] {
    return COBERTURA_RUT_PARLAMENTARIO_SENALES.map((c) => ({
      senal: c.senal,
      count: c.senal in map ? map[c.senal]! : null,
    }));
  }
  function entCounts(map: Record<string, number | null>): CoberturaCount[] {
    return COBERTURA_RUT_ENTIDAD_SENALES.map((c) => ({
      senal: c.senal,
      count: c.senal in map ? map[c.senal]! : null,
    }));
  }

  it("cada maestra es un array SEPARADO con su propio denominador (NO proyecto ni sesiones)", () => {
    const dp = COBERTURA_RUT_PARLAMENTARIO_SENALES.filter((s) => s.esDenominador);
    const de = COBERTURA_RUT_ENTIDAD_SENALES.filter((s) => s.esDenominador);
    expect(dp).toHaveLength(1);
    expect(de).toHaveLength(1);
    // Denominadores propios, distintos del corpus/voto.
    expect(dp[0]!.senal).toBe("parl_universo");
    expect(de[0]!.senal).toBe("ent_universo");
    for (const s of [...COBERTURA_RUT_PARLAMENTARIO_SENALES, ...COBERTURA_RUT_ENTIDAD_SENALES]) {
      expect(s.senal).not.toBe("proyecto");
      expect(s.senal).not.toBe("sesiones");
    }
  });

  it("SQL 100% estática (sin interpolación de input) en ambas maestras — T-69-04", () => {
    for (const cfg of [
      ...COBERTURA_RUT_PARLAMENTARIO_SENALES,
      ...COBERTURA_RUT_ENTIDAD_SENALES,
    ]) {
      expect(cfg.sql).not.toMatch(/\$\{/); // sin template interpolation
      expect(cfg.sql.toLowerCase()).toMatch(/select count/);
    }
    // El numerador NUNCA proyecta el rut crudo (solo count) — T-69-06.
    for (const cfg of [
      ...COBERTURA_RUT_PARLAMENTARIO_SENALES,
      ...COBERTURA_RUT_ENTIDAD_SENALES,
    ]) {
      expect(cfg.sql.toLowerCase()).not.toMatch(/select\s+rut/);
    }
  });

  it("feliz: parlamentario N/M y entidad K/L → pcts correctos por maestra", () => {
    const parl = evaluateCobertura(
      parlCounts({ parl_universo: 150, parl_con_rut: 30 }),
      COBERTURA_RUT_PARLAMENTARIO_SENALES,
    );
    const ent = evaluateCobertura(
      entCounts({ ent_universo: 400, ent_con_rut: 100 }),
      COBERTURA_RUT_ENTIDAD_SENALES,
    );
    const parlById = Object.fromEntries(parl.map((r) => [r.senal, r]));
    const entById = Object.fromEntries(ent.map((r) => [r.senal, r]));
    expect(parlById["parl_con_rut"]!.n).toBe(30);
    expect(parlById["parl_con_rut"]!.m).toBe(150);
    expect(parlById["parl_con_rut"]!.pct).toBe(20); // 30/150
    expect(entById["ent_con_rut"]!.n).toBe(100);
    expect(entById["ent_con_rut"]!.m).toBe(400);
    expect(entById["ent_con_rut"]!.pct).toBe(25); // 100/400
  });

  it("techo por causa — no-data: numerador null → n y pct null, NUNCA 0", () => {
    // Causa "no se pudo leer" (psql degradó): distinta de "cero real".
    const parl = evaluateCobertura(
      parlCounts({ parl_universo: 150, parl_con_rut: null }),
      COBERTURA_RUT_PARLAMENTARIO_SENALES,
    );
    const con = parl.find((r) => r.senal === "parl_con_rut")!;
    expect(con.n).toBeNull();
    expect(con.pct).toBeNull();
  });

  it("techo por causa — seed vacío HOY: N=0, M>0 → pct 0 (cero REAL, distinto de n/d)", () => {
    // El estado real HOY (seed filas:[]) es 0/M declarado honestamente como 0%, no n/d.
    const parl = evaluateCobertura(
      parlCounts({ parl_universo: 150, parl_con_rut: 0 }),
      COBERTURA_RUT_PARLAMENTARIO_SENALES,
    );
    const ent = evaluateCobertura(
      entCounts({ ent_universo: 400, ent_con_rut: 0 }),
      COBERTURA_RUT_ENTIDAD_SENALES,
    );
    expect(parl.find((r) => r.senal === "parl_con_rut")!.pct).toBe(0);
    expect(ent.find((r) => r.senal === "ent_con_rut")!.pct).toBe(0);
  });

  it("techo por causa — sin universo: M=0 → pct null (no divide por cero) en ambas maestras", () => {
    const parl = evaluateCobertura(
      parlCounts({ parl_universo: 0, parl_con_rut: 0 }),
      COBERTURA_RUT_PARLAMENTARIO_SENALES,
    );
    const ent = evaluateCobertura(
      entCounts({ ent_universo: 0, ent_con_rut: 0 }),
      COBERTURA_RUT_ENTIDAD_SENALES,
    );
    for (const r of [...parl, ...ent]) {
      expect(r.pct).toBeNull(); // M=0 → sin universo, no 0%
    }
  });
});
