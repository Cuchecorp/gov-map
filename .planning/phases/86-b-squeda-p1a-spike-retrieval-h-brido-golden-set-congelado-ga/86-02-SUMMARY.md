---
phase: 86-b-squeda-p1a-spike-retrieval-h-brido-golden-set-congelado-ga
plan: "02"
subsystem: fichas/spike
tags: [retrieval, psql, embed, cache, strategies, fts, semantic, rrf, offline, security]
dependency_graph:
  requires: [86-01]
  provides: [psql-read-only, embed-query, embed-cache, fts-strategy, semantic-strategy, rrf-strategy]
  affects: [86-03]
tech_stack:
  added: []
  patterns: [psql-At-spawn, BOM-safe-cache, injected-SqlRunner, websearch_to_tsquery, RRF-rank-fusion]
key_files:
  created:
    - packages/fichas/src/spike/psql.ts
    - packages/fichas/src/spike/psql.test.ts
    - packages/fichas/src/spike/embed-query.ts
    - packages/fichas/src/spike/embed-cache.ts
    - packages/fichas/src/spike/embed-cache.test.ts
    - packages/fichas/src/spike/strategies.ts
    - packages/fichas/src/spike/strategies.test.ts
  modified: []
decisions:
  - "psql params vía -v key=value (psql variable substitution) — nunca interpolados en el SQL string (V5)"
  - "embed-cache usa embedder inyectado para testear offline; el JSON en disco es solo floats sin secrets"
  - "runRrf short-circuit de boletín ANTES del Promise.all(FTS+semántico) — hit@1 determinístico"
  - "FTS SQL usa :q/:limit como variables psql (no $1 posicional) — compatible con psql -v binding"
metrics:
  duration: "~25 min"
  completed: "2026-07-22"
  tasks: 3
  files: 7
---

# Phase 86 Plan 02: Capa de Acceso a Datos del Spike (READ-ONLY) Summary

Wrapper psql SELECT-only con guarda de escritura, embedder Gemini RETRIEVAL_QUERY/768/L2 (copia verbatim de buscar.ts), cache committeable de vectores, y las 3 estrategias de retrieval (FTS-solo con websearch_to_tsquery+unaccent, semántico vía match_proyectos, RRF con short-circuit de boletín).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wrapper psql read-only + probeUnaccent | d9a2347 | psql.ts, psql.test.ts |
| 2 | Embedder Gemini RETRIEVAL_QUERY + cache de vectores | 8f9e38c | embed-query.ts, embed-cache.ts, embed-cache.test.ts |
| 3 | Las 3 estrategias (FTS-solo, semántico-solo, RRF) | de9a453 | strategies.ts, strategies.test.ts |

## Test Results

- @obs/fichas suite: 18 archivos, 150 tests verdes, 1 skipped (pre-existente)
- tsc -b: limpio (0 errores de tipo)
- Nuevos tests: psql (21) + embed-cache (6) + strategies (19) = 46 tests nuevos

## Security Verification

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-86-04: psql owner URL → DDL/DML | assertReadOnly lanza en INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT; 21 tests | PASS |
| T-86-05: FTS query SQL injection | websearch_to_tsquery SIEMPRE; query text bindeado vía -v key=value | PASS |
| T-86-06: Gemini key en logs | key SOLO por header x-goog-api-key; mensaje de error no incluye key | PASS |
| T-86-07: secrets en cache | JSON escrito solo con floats (query→vector); test verifica ausencia de keys/URLs | PASS |
| T-86-08: SUPABASE_DB_URL en logs | URL se pasa en env del proceso hijo; nunca en argv ni logs | PASS |

## Acceptance Criteria Verification

- `grep -n "shell:" psql.ts` → shell: process.platform === "win32" presente (Windows-safe spawn)
- `grep -n "RETRIEVAL_QUERY" embed-query.ts` → 1 match (asimetría query-side obligatoria SEM-03)
- `grep -n "x-goog-api-key" embed-query.ts` → 1 match (key solo por header)
- `grep -n "outputDimensionality" embed-query.ts` → presente; assert `=== 768` presente
- `grep -c "import.*buscar" embed-query.ts` → 0 (copia verbatim, no import)
- `grep -c "websearch_to_tsquery" strategies.ts` → 2 (FTS con y sin unaccent)
- `grep -c "to_tsquery(" strategies.ts` → 0 (nunca to_tsquery crudo)
- `grep -c "match_proyectos" strategies.ts` → 1 (RPC semántico)
- `grep -n "cuerpos_legales\|jsonb_array_elements\|string_agg" strategies.ts` → presente
- `grep -c "normas_afectadas" strategies.ts` → 0 (columna inexistente — Pitfall #1)
- `grep -n "from \"./rrf\"\|detectarBoletin" strategies.ts` → presente (reusa 86-01)

## Deviations from Plan

### Auto-fixed Issues

None — plan ejecutado exactamente como escrito.

### Design Notes

1. **SQL binding con psql -v**: el plan menciona tanto `psql -v` como `$1` posicional. Se eligió `-v key=value` + `:key` en el SQL (variable substitution de psql) porque `$1` posicional requiere `psql -f` con un archivo temporal o `STDIN` + protocolo extendido, más complejo para el spawn. La guarda read-only cubre ambos idioms igualmente.

2. **Assumption A3 verificada**: la key `norma` en `cuerpos_legales` jsonb está confirmada en `supabase/migrations/0011_fichas_embeddings.sql` línea 25 (`cuerpos_legales jsonb not null default '[]'` con elementos `{norma, articulos[]}`). El SQL usa `c->>'norma'` correctamente.

## Known Stubs

Ninguno — las 3 estrategias están completamente implementadas. El scoring LIVE contra PROD ocurre en el plan 86-03.

## Threat Flags

Ninguno — sin nuevas superficies de red/auth/schema más allá de las ya documentadas en el threat model del plan.

## Self-Check: PASSED

- packages/fichas/src/spike/psql.ts: FOUND
- packages/fichas/src/spike/psql.test.ts: FOUND
- packages/fichas/src/spike/embed-query.ts: FOUND
- packages/fichas/src/spike/embed-cache.ts: FOUND
- packages/fichas/src/spike/embed-cache.test.ts: FOUND
- packages/fichas/src/spike/strategies.ts: FOUND
- packages/fichas/src/spike/strategies.test.ts: FOUND
- Commits d9a2347, 8f9e38c, de9a453: FOUND
