import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluate,
  evaluateCobertura,
  evaluatePgCron,
  ghRunEsAveria,
  umbralDesdeSchedule,
} from "./evaluate.js";
import {
  CATALOG,
  COBERTURA_SENALES,
  COBERTURA_VOTO_SENALES,
  COBERTURA_RUT_PARLAMENTARIO_SENALES,
  COBERTURA_RUT_ENTIDAD_SENALES,
  PGCRON_JOBS,
  GH_EN_CURSO,
} from "./catalog.js";
import type { PgCronJobConfig } from "./catalog.js";
import type { CoberturaCount, PgCronRow, QueryRow } from "./query-runner.js";

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
    // G2 (119-01): ANTES apuntaba a "chilecompra-weekly.yml", archivo que NO existe → un
    // HTTP 404 en stderr por corrida. Ahora la ausencia se DECLARA con null (el .yml NO se crea).
    expect(cfg!.workflowYml).toBeNull();
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
    // servel-weekly.yml NO existe (LOCAL sin cron). G2 (119-01): la ausencia se DECLARA con
    // null (antes apuntaba al .yml inexistente → HTTP 404); la señal GH figura
    // "n/d (sin workflow)" (honesto). El .yml NO se crea.
    expect(cfg!.workflowYml).toBeNull();
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

describe("señal de edad-mínima de leyes (SC#4 — rotación visible)", () => {
  // SC#4: `leyes` (MAX) se pone verde con UN solo refresh, ocultando que la cola de
  // ~3.657 proyectos puede llevar meses sin tocar (dilución del plan 74-02). La señal
  // `leyes-min-edad` usa MIN(fecha_captura) → el proyecto MÁS VIEJO sin refrescar revela
  // si la rotación round-robin cubrió la cola. `evaluate` se reusa TAL CUAL: la fila
  // MIN se evalúa con la MISMA regla stale (null|días>umbral → stale, fail-closed).
  // makeRow inyecta el `ultimoUpsert` que el runner leería como MIN(fecha_captura).
  const minEdad = () => CATALOG.filter((c) => c.fuente === "leyes-min-edad");

  it("la entrada leyes-min-edad existe sobre proyecto.fecha_captura con agregado MIN, umbral generoso", () => {
    const cfg = CATALOG.find((c) => c.fuente === "leyes-min-edad");
    expect(cfg).toBeDefined();
    expect(cfg!.tabla).toBe("proyecto");
    expect(cfg!.columna).toBe("fecha_captura");
    expect(cfg!.agregado).toBe("MIN");
    expect(cfg!.umbralDias).toBe(45);
    expect(cfg!.overrideEnv).toBe("FRESHNESS_UMBRAL_LEYES_MIN_EDAD");
    expect(cfg!.workflowYml).toBe("leyes-weekly.yml");
  });

  it("MIN por encima del umbral (proyecto más viejo 60d > 45) → stale (dilución visible)", () => {
    // La cola NO rotó: el proyecto más viejo lleva 60 días sin refrescar.
    const rows: QueryRow[] = [makeRow("leyes-min-edad", 60)];
    const results = evaluate(rows, minEdad(), NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.fuente).toBe("leyes-min-edad");
    expect(results[0]!.diasDesdeUpsert).toBe(60);
    expect(results[0]!.stale).toBe(true);
  });

  it("toda la cola fresca (proyecto más viejo 30d <= 45) → no stale (rotación al día)", () => {
    const rows: QueryRow[] = [makeRow("leyes-min-edad", 30)];
    const results = evaluate(rows, minEdad(), NOW);
    expect(results[0]!.diasDesdeUpsert).toBe(30);
    expect(results[0]!.stale).toBe(false);
  });

  it("MIN nulo/ilegible → stale (fail-closed, degradación honesta preservada)", () => {
    const nulo: QueryRow[] = [makeRow("leyes-min-edad", null)];
    expect(evaluate(nulo, minEdad(), NOW)[0]!.stale).toBe(true);
    const ilegible: QueryRow[] = [
      { fuente: "leyes-min-edad", ultimoUpsert: "no-es-fecha", ghRun: "n/d", r2Snapshot: "n/d" },
    ];
    const r = evaluate(ilegible, minEdad(), NOW)[0]!;
    expect(r.diasDesdeUpsert).toBeNull();
    expect(r.stale).toBe(true);
  });

  it("respeta el override FRESHNESS_UMBRAL_LEYES_MIN_EDAD (baja a 20 → 30d ahora es stale)", () => {
    const rows: QueryRow[] = [makeRow("leyes-min-edad", 30)];
    const results = evaluate(rows, minEdad(), NOW, { FRESHNESS_UMBRAL_LEYES_MIN_EDAD: "20" });
    expect(results[0]!.umbralDias).toBe(20);
    expect(results[0]!.stale).toBe(true);
  });

  it("NO-REGRESIÓN: la entrada leyes original conserva agregado MAX (default) y umbral 7", () => {
    const leyes = CATALOG.find((c) => c.fuente === "leyes");
    expect(leyes).toBeDefined();
    // `leyes` NO declara agregado → default MAX (queryFreshness usa cfg.agregado ?? "MAX").
    expect(leyes!.agregado).toBeUndefined();
    expect(leyes!.umbralDias).toBe(7);
    expect(leyes!.overrideEnv).toBe("FRESHNESS_UMBRAL_LEYES");
    // leyes (MAX) y leyes-min-edad (MIN) coexisten: misma tabla/columna, agregados distintos.
    const minEdadCfg = CATALOG.find((c) => c.fuente === "leyes-min-edad");
    expect(minEdadCfg!.tabla).toBe(leyes!.tabla);
    expect(minEdadCfg!.columna).toBe(leyes!.columna);
    expect(minEdadCfg!.agregado).toBe("MIN");
  });

  it("NO-REGRESIÓN: ninguna señal MAX v6.0 cambió de agregado (todas MAX = agregado undefined)", () => {
    // Las señales MAX de los conectores v6.0 + los marcadores no declaran `agregado`
    // (→ MAX por default). SOLO leyes-min-edad usa MIN. Se afirma explícitamente para
    // congelar que la señal MIN es ADITIVA y no viró el agregado de las demás.
    const soloMin = CATALOG.filter((c) => c.agregado === "MIN").map((c) => c.fuente);
    expect(soloMin).toEqual(["leyes-min-edad"]);
    for (const fuente of ["leyes", "agenda", "lobby-camara", "lobby-leylobby", "probidad", "fichas"]) {
      const cfg = CATALOG.find((c) => c.fuente === fuente);
      expect(cfg, `falta ${fuente}`).toBeDefined();
      expect(cfg!.agregado, `${fuente} no debe declarar agregado (MAX default)`).toBeUndefined();
    }
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

describe("G2 (119-01): workflowYml null = ausencia DECLARADA de workflow", () => {
  // 118 §4 G2: `chilecompra-weekly.yml` y `servel-weekly.yml` NO existen y NO deben crearse
  // (crear un .yml vacío para callar el 404 = fabricar cobertura de señal). La ausencia se
  // DECLARA con `workflowYml: null`; el cliente omite `gh run list` y la señal figura
  // "n/d (sin workflow)". La fila sigue reportando stale:true por `ingestado_hasta` null
  // (118 §4.1, estado esperado de MONEY/SERVEL gated) — este cambio NO la pone verde.
  it("servel declara workflowYml null y sigue stale:true con ingestado_hasta null", () => {
    expect(CATALOG.find((c) => c.fuente === "servel")!.workflowYml).toBeNull();

    const catalog = CATALOG.filter((c) => c.fuente === "servel");
    const rows: QueryRow[] = [
      {
        fuente: "servel",
        ultimoUpsert: null, // ingestado_hasta null = nunca barrido
        ghRun: "n/d (sin workflow)",
        r2Snapshot: "n/d (sin snapshots)",
      },
    ];
    const results = evaluate(rows, catalog, NOW);
    expect(results[0]!.stale).toBe(true);
    expect(results[0]!.ghRun).toBe("n/d (sin workflow)");
  });

  it("chilecompra declara workflowYml null y sigue stale:true con ingestado_hasta null", () => {
    expect(CATALOG.find((c) => c.fuente === "chilecompra")!.workflowYml).toBeNull();

    const catalog = CATALOG.filter((c) => c.fuente === "chilecompra");
    const rows: QueryRow[] = [
      {
        fuente: "chilecompra",
        ultimoUpsert: null,
        ghRun: "n/d (sin workflow)",
        r2Snapshot: "n/d (sin snapshots)",
      },
    ];
    expect(evaluate(rows, catalog, NOW)[0]!.stale).toBe(true);
  });

  it("exactamente 2 fuentes con workflowYml null; el resto declara su .yml", () => {
    const nulls = CATALOG.filter((c) => c.workflowYml === null).map((c) => c.fuente);
    expect(nulls.sort()).toEqual(["chilecompra", "servel"]);
  });
});

describe("G4 (119-01): ghRun entra al cálculo de stale (matar el verde prestado)", () => {
  // 118 §4 G4: la tabla mostraba `ghRun: "failure @ 2026-07-07"` y "n/d (sin corridas)" y los
  // IGNORABA al calcular stale → una avería del cron quedaba tapada por la frescura de la tabla.
  // Regla: la avería del CRON produce stale por sí sola; la avería del INSTRUMENTO (`gh` falló)
  // NO — fail-closed sobre el DATO, no sobre el medidor.
  const lobbyCamara = () => CATALOG.filter((c) => c.fuente === "lobby-camara");

  function conGhRun(ghRun: string): QueryRow[] {
    // Tabla FRESCA: upsert de hoy (0 días) — cualquier stale que salga viene del ghRun.
    return [
      {
        fuente: "lobby-camara",
        ultimoUpsert: NOW.toISOString(),
        ghRun,
        r2Snapshot: "n/d (sin snapshots)",
      },
    ];
  }

  it("Test 1: tabla FRESCA + ghRun failure → stale:true (el verde prestado ya no encubre)", () => {
    const r = evaluate(conGhRun("failure @ 2026-07-07"), lobbyCamara(), NOW)[0]!;
    expect(r.diasDesdeUpsert).toBe(0); // la tabla está fresca: el stale NO viene de ahí
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("gh-failure");
  });

  it("Test 2: tabla fresca + ghRun success → stale:false (sin stale espurio)", () => {
    const r = evaluate(conGhRun(`success @ ${NOW.toISOString().slice(0, 10)}`), lobbyCamara(), NOW)[0]!;
    expect(r.stale).toBe(false);
    expect(r.motivoStale).toBeNull();
  });

  it("Test 3: tabla fresca + 'n/d (sin corridas)' → stale:true (workflow existe y nunca corrió)", () => {
    const r = evaluate(conGhRun("n/d (sin corridas)"), lobbyCamara(), NOW)[0]!;
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("gh-failure");
  });

  it("Test 4: tabla fresca + 'n/d (sin workflow)' → stale:false (ausencia DECLARADA no es avería)", () => {
    // MONEY/SERVEL no ganan un stale NUEVO por esta vía: su stale sigue viniendo del dato.
    const r = evaluate(conGhRun("n/d (sin workflow)"), lobbyCamara(), NOW)[0]!;
    expect(r.stale).toBe(false);
    expect(r.motivoStale).toBeNull();
  });

  it("Test 5: tabla fresca + 'n/d' (falló `gh`) → stale:false — no se afirma avería desde el medidor", () => {
    const r = evaluate(conGhRun("n/d"), lobbyCamara(), NOW)[0]!;
    expect(r.stale).toBe(false);
    expect(r.motivoStale).toBeNull();
    expect(r.ghRun).toBe("n/d"); // el motivo queda VISIBLE en la fila
  });

  it("ghRunEsAveria: skipped y success NO son avería; cualquier otra conclusion sí", () => {
    expect(ghRunEsAveria("success @ 2026-07-07")).toBe(false);
    expect(ghRunEsAveria("skipped @ 2026-07-07")).toBe(false);
    expect(ghRunEsAveria("failure @ 2026-07-07")).toBe(true);
    expect(ghRunEsAveria("cancelled @ 2026-07-07")).toBe(true);
    expect(ghRunEsAveria("timed_out @ 2026-07-07")).toBe(true);
    expect(ghRunEsAveria("n/d (sin corridas)")).toBe(true);
    expect(ghRunEsAveria("n/d (sin workflow)")).toBe(false);
    expect(ghRunEsAveria("n/d")).toBe(false);
  });

  it("motivoStale distingue 'sin dato' de 'dias>umbral'", () => {
    const sinDato = evaluate(
      [{ fuente: "lobby-camara", ultimoUpsert: null, ghRun: "n/d", r2Snapshot: "n/d" }],
      lobbyCamara(),
      NOW,
    )[0]!;
    expect(sinDato.motivoStale).toBe("sin dato");

    const viejo = evaluate(
      [{ fuente: "lobby-camara", ultimoUpsert: new Date(NOW.getTime() - 30 * 86400000).toISOString(), ghRun: "n/d", r2Snapshot: "n/d" }],
      lobbyCamara(),
      NOW,
    )[0]!;
    expect(viejo.motivoStale).toBe("dias>umbral"); // umbral 14
  });
});

describe("G4 (119-01): tabla PROPIA por cron (fin del verde prestado en el catálogo)", () => {
  // lobby-camara medía `lobby_audiencia`, que TAMBIÉN llena el conector leylobby (W-5) →
  // una avería de lobby-camara-weekly quedaba tapada. `fichas` medía `proyecto`, que llena
  // el cron de tramitación (W-4) → misma patología. Cada uno pasa a su tabla propia.
  it("lobby-camara mide lobby_contraparte (tabla propia del conector de Cámara)", () => {
    const cfg = CATALOG.find((c) => c.fuente === "lobby-camara")!;
    expect(cfg.tabla).toBe("lobby_contraparte");
    expect(cfg.columna).toBe("fecha_captura");
  });

  it("fichas mide proyecto_ficha (tabla que llena el propio pipeline de fichas)", () => {
    const cfg = CATALOG.find((c) => c.fuente === "fichas")!;
    expect(cfg.tabla).toBe("proyecto_ficha");
    expect(cfg.columna).toBe("fecha_captura");
  });

  it("ninguna entrada del catálogo mide ya lobby_audiencia", () => {
    expect(CATALOG.filter((c) => c.tabla === "lobby_audiencia")).toHaveLength(0);
  });
});

describe("G3 (119-02): actualidad-refresh deja de ser punto ciego (W-1)", () => {
  const cfg = () => CATALOG.find((c) => c.fuente === "actualidad-refresh")!;

  it("está en el catálogo midiendo actualidad_senal.fecha_captura", () => {
    // Columna verificada por psql read-only contra PROD (A2 de 118 §5: NO es `creado_en`).
    expect(cfg().tabla).toBe("actualidad_senal");
    expect(cfg().columna).toBe("fecha_captura");
    expect(cfg().umbralDias).toBe(2);
    expect(cfg().workflowYml).toBe("actualidad-refresh.yml");
  });

  it("ultimoUpsert de hace 3 días → stale (cadencia intradía L-V, umbral 2d)", () => {
    const row = makeRow("actualidad-refresh", 3);
    row.ghRun = "success @ 2026-07-09";
    const r = evaluate([row], [cfg()], NOW)[0]!;
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("dias>umbral");
  });

  it("ultimoUpsert de hace 1 día → NO stale", () => {
    const row = makeRow("actualidad-refresh", 1);
    row.ghRun = "success @ 2026-07-09";
    const r = evaluate([row], [cfg()], NOW)[0]!;
    expect(r.stale).toBe(false);
    expect(r.motivoStale).toBeNull();
  });
});

// ─── G3 (119-02): señal de pg_cron ────────────────────────────────────────────

describe("umbralDesdeSchedule (función PURA, sin red ni DB)", () => {
  it("deriva el umbral del hueco previsto + un intervalo de gracia", () => {
    // `7 11,14,17,20 * * 1-5`: huecos intradía de 3h y hueco de fin de semana de 63h
    // (viernes 20:07 → lunes 11:07) ⇒ 63 + 3 = 66h.
    expect(umbralDesdeSchedule("7 11,14,17,20 * * 1-5")).toBe(66);
    // Diario: único hueco 24h ⇒ 24 + 24 = 48h.
    expect(umbralDesdeSchedule("17 3 * * *")).toBe(48);
    // Cada 15 min ⇒ 0.25 + 0.25 = 0.5h.
    expect(umbralDesdeSchedule("*/15 * * * *")).toBe(0.5);
  });

  it("aplica un PISO para schedules sub-minuto (no exige precisión de segundos)", () => {
    expect(umbralDesdeSchedule("30 seconds")).toBe(0.25);
  });

  it("devuelve null ante un schedule que no sabe leer (desconocido, no inventado)", () => {
    expect(umbralDesdeSchedule("cuando salga el sol")).toBeNull();
    expect(umbralDesdeSchedule("0 0 1 1 *")).toBeNull(); // dom/mes restringidos: no soportado
  });
});

describe("evaluatePgCron (G3, 119-02): los 5 jobs dejan de ser invisibles", () => {
  const AHORA = new Date("2026-07-29T15:00:00Z"); // miércoles

  function job(jobname: string, jobid: number, schedule: string): PgCronJobConfig {
    return {
      jobname,
      jobid,
      schedule,
      overrideEnv: `FRESHNESS_UMBRAL_PGCRON_${jobname.toUpperCase().replace(/-/g, "_")}`,
    };
  }

  function row(
    cfg: PgCronJobConfig,
    horasAtras: number | null,
    over: Partial<PgCronRow> = {},
  ): PgCronRow {
    return {
      jobid: cfg.jobid,
      jobname: cfg.jobname,
      schedule: cfg.schedule,
      active: true,
      maxStartTime:
        horasAtras === null
          ? null
          : new Date(AHORA.getTime() - horasAtras * 3_600_000).toISOString(),
      ...over,
    };
  }

  it("Test 1: `30 seconds` con última corrida hace 1 hora ⇒ stale (umbral derivado, no 7 días)", () => {
    const cfg = job("process-ingest-jobs", 1, "30 seconds");
    const r = evaluatePgCron([row(cfg, 1)], [cfg], AHORA)[0]!;
    expect(r.umbralHoras).toBe(0.25);
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("horas>umbral");
  });

  it("Test 2: intradía L-V con última corrida hace 4 horas en día hábil ⇒ NO stale", () => {
    const cfg = job("actualidad-materializar", 5, "7 11,14,17,20 * * 1-5");
    const r = evaluatePgCron([row(cfg, 4)], [cfg], AHORA)[0]!;
    expect(r.stale).toBe(false);
    expect(r.motivoStale).toBeNull();
  });

  it("Test 3: mismo schedule con última corrida hace 3 días ⇒ stale", () => {
    const cfg = job("actualidad-materializar", 5, "7 11,14,17,20 * * 1-5");
    const r = evaluatePgCron([row(cfg, 72)], [cfg], AHORA)[0]!;
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("horas>umbral");
  });

  it("Test 4: maxStartTime nulo o ilegible ⇒ stale (desconocido = stale, fail-closed)", () => {
    const cfg = job("cruces-materializar", 4, "23 3 * * *");
    const nulo = evaluatePgCron([row(cfg, null)], [cfg], AHORA)[0]!;
    expect(nulo.stale).toBe(true);
    expect(nulo.motivoStale).toBe("sin corridas");
    expect(nulo.horasDesde).toBeNull();

    const ilegible = evaluatePgCron(
      [row(cfg, 1, { maxStartTime: "no-es-una-fecha" })],
      [cfg],
      AHORA,
    )[0]!;
    expect(ilegible.stale).toBe(true);
    expect(ilegible.motivoStale).toBe("sin corridas");
  });

  it("un job AUSENTE de cron.job es señal (no se calla)", () => {
    const cfg = job("net-materializar-aristas", 3, "17 3 * * *");
    const r = evaluatePgCron([], [cfg], AHORA)[0]!;
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("job ausente");
  });

  it("un DRIFT de schedule es señal por sí mismo (no se adopta el vivo en silencio)", () => {
    const cfg = job("cleanup-net-http", 2, "*/15 * * * *");
    const r = evaluatePgCron(
      [row(cfg, 0.1, { schedule: "*/59 * * * *" })],
      [cfg],
      AHORA,
    )[0]!;
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("schedule-drift");
    expect(r.scheduleEsperado).toBe("*/15 * * * *");
    expect(r.scheduleVivo).toBe("*/59 * * * *");
  });

  it("active=false es señal (un job desprogramado no está sano)", () => {
    const cfg = job("cleanup-net-http", 2, "*/15 * * * *");
    const r = evaluatePgCron([row(cfg, 0.1, { active: false })], [cfg], AHORA)[0]!;
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("inactivo");
  });

  it("un schedule ilegible ⇒ stale (nunca un umbral inventado)", () => {
    const cfg = job("raro", 9, "cuando salga el sol");
    const r = evaluatePgCron([row(cfg, 0.1)], [cfg], AHORA)[0]!;
    expect(r.umbralHoras).toBeNull();
    expect(r.stale).toBe(true);
    expect(r.motivoStale).toBe("schedule-ilegible");
  });

  it("PGCRON_JOBS cubre los 5 jobs vivos de PROD con su jobid", () => {
    expect(PGCRON_JOBS.map((j) => j.jobid).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(PGCRON_JOBS.find((j) => j.jobid === 5)!.schedule).toBe(
      "7 11,14,17,20 * * 1-5",
    );
  });
});

describe("G3 (119-02): los huecos de cobertura son DECISIÓN, no relleno", () => {
  it("ninguna entrada del catálogo cubre backup-parlamentario ni digest-daily", () => {
    // W-3 no escribe Supabase (su autoridad es el commit del bot); W-7 está parked.
    // Cubrirlos produciría verde prestado / stale permanente respectivamente.
    expect(
      CATALOG.filter((c) =>
        ["backup-parlamentario", "digest-daily"].includes(c.fuente),
      ),
    ).toHaveLength(0);
    expect(
      CATALOG.filter((c) =>
        ["backup-parlamentario.yml", "digest-daily.yml"].includes(
          c.workflowYml ?? "",
        ),
      ),
    ).toHaveLength(0);
  });
});

describe("G12-119 (119-07): la atribución de lobby-leylobby está declarada, no invertida", () => {
  // Hallazgo de 119-06: el comentario del catálogo afirmaba que
  // `lobby_ingesta_estado.ingestado_hasta` "solo lo escribe el conector leylobby".
  // Es falso: `marcarIngestado` vive en el writer COMPARTIDO y lo invocan los DOS
  // conectores; las 136 filas vigentes las escribió el de la Cámara. Este test
  // congela la corrección para que la afirmación invertida no vuelva.
  const fuente = readFileSync(
    join(import.meta.dirname, "catalog.ts"),
    "utf8",
  );

  it("el catálogo NO afirma que la tabla la escriba solo el conector leylobby", () => {
    // La frase sobrevive UNA vez, entrecomillada y seguida de su refutación explícita:
    // borrarla dejaría el registro sin memoria del error. Lo que el test prohíbe es que
    // vuelva a aparecer como AFIRMACIÓN (sin el "Es FALSO" pegado).
    const ocurrencias = [
      ...fuente.matchAll(/solo lo escribe el conector leylobby/g),
    ];
    expect(ocurrencias).toHaveLength(1);
    for (const m of ocurrencias) {
      expect(fuente.slice(m.index, m.index + 90)).toMatch(/Es FALSO/);
    }
  });

  it("el catálogo declara el CAVEAT de atribución no exclusiva con sus dos escritores", () => {
    expect(fuente).toMatch(/CAVEAT lobby-leylobby/);
    expect(fuente).toMatch(/run-camara-lobby\.ts:164/);
    expect(fuente).toMatch(/writer-supabase\.ts:145/);
  });

  it("la entrada sigue midiendo lobby_ingesta_estado (el CAVEAT declara, no reapunta)", () => {
    const entrada = CATALOG.find((c) => c.fuente === "lobby-leylobby");
    expect(entrada?.tabla).toBe("lobby_ingesta_estado");
    expect(entrada?.columna).toBe("ingestado_hasta");
  });
});

// ---------------------------------------------------------------------------------------------
// WR-07 (119-REVIEW) — `gh run list --json conclusion` devuelve "" (o null) para un run
// `in_progress`. `ghRunSignal` producía " @ <fecha>" y `ghRunEsAveria` leía conclusion="" ⇒ ni
// success ni skipped ⇒ true ⇒ `stale (gh-failure)` MIENTRAS el cron corría con normalidad.
// ---------------------------------------------------------------------------------------------
describe("WR-07 — un workflow EN CURSO no es una avería", () => {
  it("el rótulo `en curso` NO se afirma como avería", () => {
    expect(ghRunEsAveria(`${GH_EN_CURSO} @ 2026-07-28`)).toBe(false);
  });

  it("una conclusion vacía (run sin concluir) tampoco (defensa por si el rótulo no se aplicó)", () => {
    expect(ghRunEsAveria(" @ 2026-07-28")).toBe(false);
    expect(ghRunEsAveria("? @ 2026-07-28")).toBe(false);
  });

  it("no se ablandó nada: failure/cancelled/timed_out siguen siendo avería", () => {
    expect(ghRunEsAveria("failure @ 2026-07-28")).toBe(true);
    expect(ghRunEsAveria("cancelled @ 2026-07-28")).toBe(true);
    expect(ghRunEsAveria("timed_out @ 2026-07-28")).toBe(true);
    expect(ghRunEsAveria("n/d (sin corridas)")).toBe(true);
  });

  it("success/skipped siguen sin ser avería", () => {
    expect(ghRunEsAveria("success @ 2026-07-28")).toBe(false);
    expect(ghRunEsAveria("skipped @ 2026-07-28")).toBe(false);
  });
});
