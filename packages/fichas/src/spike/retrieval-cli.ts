/**
 * retrieval-cli.ts — CLI de scoring del spike de retrieval híbrido.
 *
 * Corre las 3 estrategias (FTS-solo, semántico-solo, RRF) sobre el golden set
 * congelado y emite una tabla markdown estrategia × categoría (hit@1/hit@5/MRR).
 *
 * Flags:
 *   --report <path>   dónde escribir la tabla markdown (requerido)
 *   --rrf-k <n>       parámetro k de RRF (default 50)
 *   --limit <n>       candidatos por rama (default 50; grid: 20/50/100)
 *   --w-fts <n>       peso del brazo FTS en RRF (default 1)
 *   --w-sem <n>       peso del brazo semántico en RRF (default 1)
 *
 * READ-ONLY: sin writer, sin upsert, sin DDL/DML.
 * Env-driven: SUPABASE_DB_URL, GEMINI_API_KEY.
 * Entry-point guard con regex retrieval-cli\.(ts|js)$ sobre process.argv[1].
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDEN_SET } from "./golden-set.js";
import { evaluarRetrieval, type MetricasRetrieval } from "./score.js";
import { runFtsOnly, runSemanticOnly, runRrf } from "./strategies.js";
import { getCachedEmbeddings } from "./embed-cache.js";
import { embedQuery } from "./embed-query.js";
import { runSql, probeUnaccent } from "./psql.js";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface SpikeCliOptions {
  report: string;
  rrfK: number;
  limit: number;
  wFts: number;
  wSem: number;
}

/** Error de validación de flags — lanzado ANTES de cualquier red/DB. */
export class SpikeCliArgsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "SpikeCliArgsError";
  }
}

// ── Parseador de flags ────────────────────────────────────────────────────────

/** Parsea argv → SpikeCliOptions, validando ANTES de tocar red/DB. */
export function parseArgs(argv: string[]): SpikeCliOptions {
  const opts: Partial<SpikeCliOptions> = {
    rrfK: 50,
    limit: 50,
    wFts: 1,
    wSem: 1,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--report": {
        const raw = argv[++i];
        if (raw == null || raw.trim().length === 0) {
          throw new SpikeCliArgsError("--report vacío (esperado una ruta)");
        }
        opts.report = raw;
        break;
      }
      case "--rrf-k": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new SpikeCliArgsError(`--rrf-k inválido: ${raw} (esperado entero > 0)`);
        }
        opts.rrfK = n;
        break;
      }
      case "--limit": {
        const raw = argv[++i];
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
          throw new SpikeCliArgsError(`--limit inválido: ${raw} (esperado entero > 0)`);
        }
        opts.limit = n;
        break;
      }
      case "--w-fts": {
        const raw = argv[++i];
        const n = Number(raw);
        if (isNaN(n) || n <= 0) {
          throw new SpikeCliArgsError(`--w-fts inválido: ${raw} (esperado número > 0)`);
        }
        opts.wFts = n;
        break;
      }
      case "--w-sem": {
        const raw = argv[++i];
        const n = Number(raw);
        if (isNaN(n) || n <= 0) {
          throw new SpikeCliArgsError(`--w-sem inválido: ${raw} (esperado número > 0)`);
        }
        opts.wSem = n;
        break;
      }
      default:
        if (a != null && a.startsWith("--")) {
          throw new SpikeCliArgsError(`flag desconocido: ${a}`);
        }
    }
  }

  if (!opts.report) {
    throw new SpikeCliArgsError("--report es requerido");
  }

  return opts as SpikeCliOptions;
}

// ── Formateo del reporte ──────────────────────────────────────────────────────

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function renderTabla(
  nombre: string,
  metricas: MetricasRetrieval,
  parametros: string,
): string {
  const categorias = Object.keys(metricas.porCategoria).sort();
  const rows = categorias.map((cat) => {
    const m = metricas.porCategoria[cat]!;
    return `| ${cat} | ${m.n} | ${pct(m.hit1)} | ${pct(m.hit5)} | ${pct(m.mrr)} |`;
  });

  const ag = metricas.agregado;
  const aggregate = `| **AGREGADO** | **${ag.n}** | **${pct(ag.hit1)}** | **${pct(ag.hit5)}** | **${pct(ag.mrr)}** |`;

  return [
    `### ${nombre}`,
    `\`${parametros}\``,
    "",
    "| Categoría | N | hit@1 | hit@5 | MRR |",
    "|-----------|---|-------|-------|-----|",
    ...rows,
    aggregate,
    "",
    "<details><summary>Detalle por caso</summary>",
    "",
    "| id | categoría | rank | ok |",
    "|----|-----------|------|----|",
    ...metricas.detalle.map(
      (d) => `| ${d.id} | ${d.category} | ${d.rank ?? "—"} | ${d.ok ? "✓" : "✗"} |`,
    ),
    "",
    "</details>",
  ].join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function main(opts: SpikeCliOptions): Promise<void> {
  if (!process.env.SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL no está en el entorno");
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY no está en el entorno");

  console.log("[retrieval-cli] Iniciando scoring del golden set...");
  console.log(`[retrieval-cli] Opciones: rrf-k=${opts.rrfK} limit=${opts.limit} w-fts=${opts.wFts} w-sem=${opts.wSem}`);

  // 1. Probe unaccent
  const unaccentEnabled = await probeUnaccent();
  console.log(`[retrieval-cli] unaccent disponible: ${unaccentEnabled}`);

  // 2. Cobertura de embeddings
  console.log("[retrieval-cli] Midiendo cobertura de embeddings...");
  const coberturaRows = await runSql(
    `SELECT
       (SELECT count(*) FROM proyecto) AS total_proyectos,
       (SELECT count(*) FROM proyecto_embedding) AS proyectos_con_embedding`,
    {},
  );
  const coberturaRow = coberturaRows[0] ?? [];
  const totalProyectos = Number(coberturaRow[0] ?? 0);
  const proyectosConEmbedding = Number(coberturaRow[1] ?? 0);
  const pctCobertura =
    totalProyectos > 0 ? ((proyectosConEmbedding / totalProyectos) * 100).toFixed(1) : "n/d";

  console.log(
    `[retrieval-cli] proyecto: ${totalProyectos} | proyecto_embedding: ${proyectosConEmbedding} (${pctCobertura}%)`,
  );

  // 3. Embeber queries con cache
  const cacheDir = dirname(fileURLToPath(import.meta.url));
  const cachePath = resolve(cacheDir, "embed-cache.json");

  console.log("[retrieval-cli] Cargando/generando embeddings con cache...");
  const queries = GOLDEN_SET.map((c) => c.query);
  const vectorMap = await getCachedEmbeddings(
    queries,
    (texts) => embedQuery(texts),
    cachePath,
  );
  console.log(`[retrieval-cli] Embeddings disponibles: ${vectorMap.size}/${queries.length}`);

  // 4. Correr las 3 estrategias
  console.log("[retrieval-cli] Corriendo estrategia: FTS-solo...");
  const metricasFts = await evaluarRetrieval(GOLDEN_SET, (caso) =>
    runFtsOnly(caso.query, { runSql, limit: opts.limit, useUnaccent: unaccentEnabled }),
  );

  console.log("[retrieval-cli] Corriendo estrategia: semántico-solo...");
  const metricasSem = await evaluarRetrieval(GOLDEN_SET, (caso) => {
    const vector = vectorMap.get(caso.query);
    if (!vector) return Promise.resolve([]);
    return runSemanticOnly(vector, { runSql, limit: opts.limit });
  });

  console.log("[retrieval-cli] Corriendo estrategia: RRF...");
  const metricasRrf = await evaluarRetrieval(GOLDEN_SET, (caso) => {
    const vector = vectorMap.get(caso.query);
    if (!vector) return Promise.resolve([]);
    return runRrf(caso.query, vector, {
      runSql,
      limit: opts.limit,
      useUnaccent: unaccentEnabled,
      rrfK: opts.rrfK,
      wFts: opts.wFts,
      wSem: opts.wSem,
    });
  });

  // 6. Generar reporte
  const fechaRun = new Date().toISOString();
  const parametrosFts = `limit=${opts.limit} unaccent=${unaccentEnabled}`;
  const parametrosSem = `limit=${opts.limit}`;
  const parametrosRrf = `rrf-k=${opts.rrfK} limit=${opts.limit} w-fts=${opts.wFts} w-sem=${opts.wSem} unaccent=${unaccentEnabled}`;

  const reporte = [
    "# 86-SCORING — Resultados del Spike de Retrieval Híbrido",
    "",
    `**Corrida:** ${fechaRun}`,
    `**Golden set:** ${GOLDEN_SET.length} casos`,
    "",
    "## Cobertura de Embeddings (LIVE)",
    "",
    `| Métrica | Valor |`,
    `|---------|-------|`,
    `| proyecto (total) | ${totalProyectos} |`,
    `| proyecto_embedding | ${proyectosConEmbedding} |`,
    `| Cobertura | ${pctCobertura}% |`,
    `| unaccent habilitado | ${unaccentEnabled} |`,
    "",
    "## Tabla Estrategia × Categoría",
    "",
    renderTabla("1. FTS-solo", metricasFts, parametrosFts),
    "",
    renderTabla("2. Semántico-solo (match_proyectos)", metricasSem, parametrosSem),
    "",
    renderTabla("3. RRF (FTS ∪ semántico)", metricasRrf, parametrosRrf),
    "",
    "## Resumen Comparativo",
    "",
    "| Estrategia | hit@1 | hit@5 | MRR |",
    "|------------|-------|-------|-----|",
    `| FTS-solo | ${pct(metricasFts.agregado.hit1)} | ${pct(metricasFts.agregado.hit5)} | ${pct(metricasFts.agregado.mrr)} |`,
    `| Semántico-solo | ${pct(metricasSem.agregado.hit1)} | ${pct(metricasSem.agregado.hit5)} | ${pct(metricasSem.agregado.mrr)} |`,
    `| RRF | ${pct(metricasRrf.agregado.hit1)} | ${pct(metricasRrf.agregado.hit5)} | ${pct(metricasRrf.agregado.mrr)} |`,
    "",
    "## DECISIÓN",
    "",
    "> _(Completar tras revisar los resultados: algoritmo, pesos A/B/C, rrf_k, límite de candidatos, cobertura embeddings LIVE, plan de flag, gate de 87)_",
    "",
    "- **Algoritmo elegido:** _TBD_",
    "- **Pesos FTS/semántico:** _TBD_",
    "- **rrf_k:** _TBD_",
    "- **Límite de candidatos por rama:** _TBD_",
    "- **Cobertura embeddings LIVE:** " + `${proyectosConEmbedding}/${totalProyectos} (${pctCobertura}%)`,
    "- **Plan de flag:** match_proyectos se CONSERVA; la híbrida entra tras flag en fase 87 hasta dominar el golden set; sin dominación no hay rewire (gate de 87 explícito).",
    "- **Criterio de victoria:** arregla literal/boletín Y no regresiona NL/similares",
    "",
  ].join("\n");

  const reportPath = resolve(opts.report);
  writeFileSync(reportPath, reporte, "utf8");
  console.log(`[retrieval-cli] Reporte escrito: ${reportPath}`);
  console.log(
    `[retrieval-cli] Resumen — FTS: hit@1=${pct(metricasFts.agregado.hit1)} hit@5=${pct(metricasFts.agregado.hit5)} MRR=${pct(metricasFts.agregado.mrr)}`,
  );
  console.log(
    `[retrieval-cli] Resumen — SEM: hit@1=${pct(metricasSem.agregado.hit1)} hit@5=${pct(metricasSem.agregado.hit5)} MRR=${pct(metricasSem.agregado.mrr)}`,
  );
  console.log(
    `[retrieval-cli] Resumen — RRF: hit@1=${pct(metricasRrf.agregado.hit1)} hit@5=${pct(metricasRrf.agregado.hit5)} MRR=${pct(metricasRrf.agregado.mrr)}`,
  );
}

// ── Entry-point guard ─────────────────────────────────────────────────────────

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /retrieval-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isMain) {
  let parsed: SpikeCliOptions;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof SpikeCliArgsError) {
      console.error(`[retrieval-cli] Error de argumento: ${err.message}`);
      console.error("Uso: retrieval-cli.ts --report <path> [--rrf-k 50] [--limit 50] [--w-fts 1] [--w-sem 1]");
    } else {
      console.error("[retrieval-cli] Error inesperado al parsear args:", err);
    }
    process.exit(2);
  }

  main(parsed)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[retrieval-cli] Error fatal:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
