---
phase: 86-b-squeda-p1a-spike-retrieval-h-brido-golden-set-congelado-ga
plan: "01"
subsystem: fichas/spike
tags: [retrieval, golden-set, rrf, scoring, offline, tdd]
dependency_graph:
  requires: []
  provides: [golden-set-frozen, boletin-detector, rrf-merger, hit-mrr-scorer]
  affects: [86-02, 86-03]
tech_stack:
  added: []
  patterns: [TDD-RED-GREEN, pure-fn-injected-runner, normalizarLiteral-NFD]
key_files:
  created:
    - packages/fichas/src/spike/boletin.ts
    - packages/fichas/src/spike/boletin.test.ts
    - packages/fichas/src/spike/rrf.ts
    - packages/fichas/src/spike/rrf.test.ts
    - packages/fichas/src/spike/golden-set.ts
    - packages/fichas/src/spike/golden-set.test.ts
    - packages/fichas/src/spike/score.ts
    - packages/fichas/src/spike/score.test.ts
  modified:
    - packages/fichas/vitest.config.ts
decisions:
  - "MRR se calcula dentro de la ventana top-5 (rank>5 → 0, consistente con hit@5) — plan spec explícita"
  - "golden-set CONGELADO: cambios requieren decisión registrada, no ediciones silenciosas"
  - "expected[] de golden-set son hipótesis plausibles; se validan LIVE contra PROD en plan 86-03"
metrics:
  duration: "~15 min"
  completed: "2026-07-21"
  tasks: 3
  files: 9
---

# Phase 86 Plan 01: Golden Set Congelado + Núcleo Offline Summary

Núcleo offline del spike de retrieval: detector de boletín 3 formatos, fusión RRF por rank, golden set de 32 queries frozen cubriendo 6 categorías, y scorer hit@1/hit@5/MRR con runner inyectado.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Detector de boletín (3 formatos) + merge RRF | 6c5975e | boletin.ts, boletin.test.ts, rrf.ts, rrf.test.ts |
| 2 | Golden set frozen ≥30 queries + normalizarLiteral | 7da6861 | golden-set.ts, golden-set.test.ts |
| 3 | Scorer hit@1/hit@5/MRR por categoría | 60ba487 | score.ts, score.test.ts, vitest.config.ts |

## Test Results

- @obs/fichas suite: 15 archivos, 104 tests verdes, 1 skipped (pre-existente)
- tsc -b: limpio (0 errores de tipo)
- Suite offline: boletin (6), rrf (3), golden-set (9), score (7) = 25 tests nuevos

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MRR limitado a ventana top-5**
- **Found during:** Task 3 GREEN (test falló con mrr=0.125 en lugar de 0 para rank=8)
- **Issue:** El plan especifica "mrr=0 (fuera del top-5)" para rank=8; la implementación inicial calculaba 1/rank sin límite de ventana
- **Fix:** MRR se calcula solo cuando rank <= 5, consistente con la especificación explícita del plan
- **Files modified:** packages/fichas/src/spike/score.ts
- **Commit:** 60ba487

**2. [Rule 2 - Missing critical] vitest.config.ts excluye *.live.test.ts**
- **Found during:** Task 3 (PATTERNS.md identifica este gap explícitamente)
- **Issue:** El config actual no excluía *.live.test.ts; sin el exclude, los tests live se colectan en CI cuando existan
- **Fix:** Agregado `exclude: ["**/node_modules/**", "**/*.live.test.ts"]` (mirror packages/votos/vitest.config.ts)
- **Files modified:** packages/fichas/vitest.config.ts
- **Commit:** 60ba487

## Known Stubs

- `expected[]` en GOLDEN_SET son hipótesis plausibles del dominio (boletines reales del congreso). Se validan LIVE contra PROD en el plan 86-03 (Task de derivación live). El plan 86-03 puede ajustar boletines dentro de la disciplina "decisión registrada".

## Threat Flags

Ninguna superficie nueva en red/DB/auth. Plan 100% offline — confirmado por acceptance criteria (`grep -c "\.rpc\|fetch\|psql\|spawn" score.ts` == 0).

## Self-Check: PASSED

- packages/fichas/src/spike/boletin.ts: FOUND
- packages/fichas/src/spike/rrf.ts: FOUND
- packages/fichas/src/spike/golden-set.ts: FOUND
- packages/fichas/src/spike/score.ts: FOUND
- Commits 6c5975e, 7da6861, 60ba487: FOUND
