---
phase: 86
plan: "03"
subsystem: fichas/spike
tags: [retrieval, hybrid, rrf, golden-set, decision]
dependency_graph:
  requires: ["86-01", "86-02"]
  provides: ["retrieval-decision-rrf", "golden-set-frozen", "regression-gate-retr04"]
  affects: ["87-busqueda-p1b-rpc-hibrida"]
tech_stack:
  added: []
  patterns:
    - "RRF (Reciprocal Rank Fusion) FTS union semantic con short-circuit determinista de boletin"
    - "Golden set congelado como gate de regresion permanente (env-gated describe.skip)"
    - "CLI de scoring con parseArgs + reporte markdown estrategia x categoria"
key_files:
  created:
    - packages/fichas/src/spike/retrieval-cli.ts
    - packages/fichas/src/spike/retrieval-golden.live.test.ts
    - packages/fichas/vitest.live.config.ts
    - packages/fichas/src/spike/embed-cache.json
    - .planning/phases/86-b-squeda-p1a-spike-retrieval-h-brido-golden-set-congelado-ga/86-SCORING.md
  modified:
    - packages/fichas/vitest.config.ts
    - packages/fichas/src/spike/golden-set.ts
decisions:
  - "Estrategia ganadora: RRF (FTS union semantico) con short-circuit boletin — domina las 3 metricas"
  - "Parametros: rrf_k=50, limit=50, pesos w_fts=1 w_sem=1, tsvector A=titulo B=idea_matriz C=normas"
  - "REQUISITO DURO fase 87: CREATE EXTENSION unaccent (ausente en PROD, explica FTS 9.4%)"
  - "REQUISITO DURO fase 87: boletin bare-number via prefix-match (boletin_num) ya funciona en spike"
  - "match_proyectos CONSERVADA intacta; RPC hibrida entra tras flag en 87"
  - "Golden set CONGELADO en d7bb3d3 — cambios futuros requieren decision registrada"
metrics:
  duration: "Task 3 + cierre: ~15 min"
  completed_date: "2026-07-22"
  tasks_completed: 3
  files_changed: 8
---

# Phase 86 Plan 03: Registro de Decisión + Cierre del Spike Summary

RRF (FTS union semantico) con short-circuit determinista de boletin elegido como estrategia de retrieval para `/buscar`; golden set congelado como gate permanente de regresion para fase 87.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CLI de scoring + live regression test + configs vitest | 4893260 | retrieval-cli.ts, retrieval-golden.live.test.ts, vitest.live.config.ts, vitest.config.ts |
| 2 | Corrida LIVE del spike contra PROD + cache committeado | d7bb3d3 | embed-cache.json, golden-set.ts (ajuste LIVE), 86-SCORING.md (tabla) |
| 3 | Registrar la decision + congelar el golden set | 367dd41 | 86-SCORING.md (seccion DECISION completa) |

## Resultado del Spike (evidencia)

| Estrategia | hit@1 | hit@5 | MRR |
|------------|-------|-------|-----|
| FTS-solo | 9.4% | 18.8% | 11.8% |
| Semantico-solo | 34.4% | 53.1% | 40.3% |
| **RRF (ganadora)** | **43.8%** | **68.8%** | **53.6%** |

Golden set: 32 casos, 6 categorias. Corpus PROD: 3.659 proyectos, 3.100 con embedding (84.7%).

## Decision Registrada

**Algoritmo:** RRF (Reciprocal Rank Fusion) FTS union semantico con short-circuit determinista de boletin fuera de la fusion.
- rrf_k=50, limit=50 por rama, w_fts=1, w_sem=1
- Pesos tsvector: A=titulo, B=idea_matriz, C=normas (cuerpos_legales jsonb)
- Boletines: 100% hit@1 (4/4) — short-circuit via boletin exacto OR boletin_num (prefix-match)
- No regresiona NL: parafrasis-nl 80% hit@5, similares 80% hit@5 (igual que semantico-solo)

**Requisitos duros para fase 87:**
1. `CREATE EXTENSION IF NOT EXISTS unaccent` + wrapper IMMUTABLE — ausente en PROD, explica FTS 9.4%
2. Short-circuit boletin en la RPC SQL (boletin='X' OR boletin_num='X') — ya probado en spike

**Plan de flag:** match_proyectos CONSERVADA; RPC hibrida entra tras flag en 87; rewire de /buscar solo cuando golden live-test la muestre dominante sobre la RPC real (gate re-verificado en 87).

## Analisis del caso boletin

El checkpoint mencionaba "~75% (3/4)" como estimacion previa. Los datos LIVE muestran **100% hit@1 (4/4)**:
- bo-01: `14309-04` → boletin exacto → rank 1
- bo-02: `14309` → boletin_num prefix-match → resuelve a `14309-04` → rank 1
- bo-03: `14.309-04` → strip puntos → `14309-04` → boletin exacto → rank 1
- bo-04: `18060-07` → boletin exacto → rank 1

`detectarBoletin` en `boletin.ts` cubre correctamente los 3 formatos. No hay caso fallido. El requisito para fase 87 es implementar el mismo short-circuit en la funcion SQL de la RPC.

## Deviations from Plan

None — plan executed exactly as written. The boletín case analysis (checkpoint item c) confirmed 100% rather than the estimated 75%, no fix needed.

## Self-Check: PASSED

- [x] 86-SCORING.md existe con tabla + DECISION completa: `.planning/phases/86-.../86-SCORING.md`
- [x] golden-set.ts con comentario CONGELADO: `packages/fichas/src/spike/golden-set.ts` (linea 50)
- [x] Commit Task 3: 367dd41
- [x] Suite @obs/fichas verde: 18 archivos, 150 tests passed, 1 skipped (live env-gated)
- [x] live test excluido de suite normal (no aparece en la corrida sin --config vitest.live.config.ts)
