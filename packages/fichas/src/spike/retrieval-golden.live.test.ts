/**
 * retrieval-golden.live.test.ts — Gate de regresión permanente env-gated.
 *
 * SKIP HONESTO cuando faltan las credenciales (SUPABASE_DB_URL + GEMINI_API_KEY).
 * El archivo está EXCLUIDO del glob de vitest normal (vitest.config.ts excluye *.live.test.ts);
 * el describe.skip es defensa en profundidad.
 *
 * Corrida explícita (con env cargado):
 *   node scripts/run-with-env.mjs pnpm --filter @obs/fichas exec vitest run --config vitest.live.config.ts
 *
 * Cierra el gate de regresión permanente (RETR-04):
 *   Aserta que la estrategia ganadora (RRF) ≥ baseline (semántico-solo) en
 *   literal/boletín Y no regresiona en NL/similares (SEM-05).
 *
 * El cache committeado (embed-cache.json) evita llamadas a Gemini en re-corridas.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { findWorkspaceRoot } from "@obs/tramitacion";
import { GOLDEN_SET } from "./golden-set.js";
import { evaluarRetrieval, type MetricasRetrieval } from "./score.js";
import { runFtsOnly, runSemanticOnly, runRrf } from "./strategies.js";
import { getCachedEmbeddings } from "./embed-cache.js";
import { embedQuery } from "./embed-query.js";
import { probeUnaccent, runSql } from "./psql.js";

// ── Carga del entorno (BOM-safe, espeja spike-votacion-detalle.live.test.ts) ──

/** loadEnv BOM-safe: igual que run-with-env.mjs y el live test de votos. */
function loadEnv(root: string): Record<string, string> {
  const raw = readFileSync(join(root, ".env"), "utf8").replace(/^﻿/, "");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

// Cargar .env antes de evaluar el gate (para que process.env tenga las vars)
// WR-06: guard existsSync — en CI con secrets via process.env no hay .env file;
// readFileSync lanzaria ENOENT y colapsaria el test file (opuesto al SKIP HONESTO).
const root = findWorkspaceRoot(process.cwd());
const envPath = join(root, ".env");
const env = existsSync(envPath) ? loadEnv(root) : {};
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

// ── Gate de entorno ───────────────────────────────────────────────────────────

const LIVE = !!process.env.SUPABASE_DB_URL && !!process.env.GEMINI_API_KEY;

// ── Suite env-gated ───────────────────────────────────────────────────────────

(LIVE ? describe : describe.skip)(
  "retrieval golden — hybrid dominates baseline",
  () => {
    let metricasFts: MetricasRetrieval;
    let metricasSem: MetricasRetrieval;
    let metricasRrf: MetricasRetrieval;
    let unaccentEnabled: boolean;

    const LIMIT = 50;
    const RRF_K = 50;

    beforeAll(async () => {
      // Probe unaccent
      unaccentEnabled = await probeUnaccent();
      console.log(`[live-test] unaccent disponible: ${unaccentEnabled}`);

      // Embeddings con cache committeado
      const cacheDir = dirname(fileURLToPath(import.meta.url));
      const cachePath = resolve(cacheDir, "embed-cache.json");
      const queries = GOLDEN_SET.map((c) => c.query);
      const vectorMap = await getCachedEmbeddings(
        queries,
        (texts) => embedQuery(texts),
        cachePath,
      );
      console.log(`[live-test] Embeddings disponibles: ${vectorMap.size}/${queries.length}`);

      // Correr FTS-solo
      metricasFts = await evaluarRetrieval(GOLDEN_SET, (caso) =>
        runFtsOnly(caso.query, { runSql, limit: LIMIT, useUnaccent: unaccentEnabled }),
      );

      // Correr semántico-solo
      metricasSem = await evaluarRetrieval(GOLDEN_SET, (caso) => {
        const vector = vectorMap.get(caso.query);
        if (!vector) return Promise.resolve([]);
        return runSemanticOnly(vector, { runSql, limit: LIMIT });
      });

      // Correr RRF
      metricasRrf = await evaluarRetrieval(GOLDEN_SET, (caso) => {
        const vector = vectorMap.get(caso.query);
        if (!vector) return Promise.resolve([]);
        return runRrf(caso.query, vector, {
          runSql,
          limit: LIMIT,
          useUnaccent: unaccentEnabled,
          rrfK: RRF_K,
        });
      });

      // Log de resultados
      console.log(`[live-test] FTS   hit@1=${pct(metricasFts.agregado.hit1)} hit@5=${pct(metricasFts.agregado.hit5)} MRR@5=${pct(metricasFts.agregado.mrr)}`);
      console.log(`[live-test] SEM   hit@1=${pct(metricasSem.agregado.hit1)} hit@5=${pct(metricasSem.agregado.hit5)} MRR@5=${pct(metricasSem.agregado.mrr)}`);
      console.log(`[live-test] RRF   hit@1=${pct(metricasRrf.agregado.hit1)} hit@5=${pct(metricasRrf.agregado.hit5)} MRR@5=${pct(metricasRrf.agregado.mrr)}`);
    });

    it("winner ≥ baseline on literal/boletín AND no regression on NL/similares", () => {
      const semHit5 = metricasSem.agregado.hit5;

      // Gate 1: RRF mejora (o mantiene) el titulo-literal vs semántico solo
      const rrfLiteralHit5 = metricasRrf.porCategoria["titulo-literal"]?.hit5 ?? 0;
      const semLiteralHit5 = metricasSem.porCategoria["titulo-literal"]?.hit5 ?? 0;
      console.log(`[live-test] literal: RRF hit@5=${pct(rrfLiteralHit5)} vs SEM hit@5=${pct(semLiteralHit5)}`);
      expect(
        rrfLiteralHit5,
        `RRF hit@5 en titulo-literal debe ser ≥ semántico-solo (${pct(semLiteralHit5)})`,
      ).toBeGreaterThanOrEqual(semLiteralHit5);

      // Gate 2: RRF mejora (o mantiene) el boletín hit@1 vs semántico solo
      const rrfBoletinHit1 = metricasRrf.porCategoria["boletin"]?.hit1 ?? 0;
      const semBoletinHit1 = metricasSem.porCategoria["boletin"]?.hit1 ?? 0;
      console.log(`[live-test] boletin: RRF hit@1=${pct(rrfBoletinHit1)} vs SEM hit@1=${pct(semBoletinHit1)}`);
      expect(
        rrfBoletinHit1,
        `RRF hit@1 en boletin debe ser ≥ semántico-solo (${pct(semBoletinHit1)})`,
      ).toBeGreaterThanOrEqual(semBoletinHit1);

      // Gate 3: No regresión en similares (SEM-05)
      const rrfSimilaresHit5 = metricasRrf.porCategoria["similares"]?.hit5 ?? 0;
      const semSimilaresHit5 = metricasSem.porCategoria["similares"]?.hit5 ?? 0;
      console.log(`[live-test] similares: RRF hit@5=${pct(rrfSimilaresHit5)} vs SEM hit@5=${pct(semSimilaresHit5)}`);
      expect(
        rrfSimilaresHit5,
        `RRF hit@5 en similares no debe regresar vs semántico-solo (SEM-05)`,
      ).toBeGreaterThanOrEqual(semSimilaresHit5);

      // Gate 4: Agregado RRF ≥ semántico solo (no regresión global)
      console.log(`[live-test] agregado: RRF hit@5=${pct(metricasRrf.agregado.hit5)} vs SEM hit@5=${pct(semHit5)}`);
      expect(
        metricasRrf.agregado.hit5,
        `RRF hit@5 agregado debe ser ≥ semántico-solo`,
      ).toBeGreaterThanOrEqual(semHit5);
    });
  },
);

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
