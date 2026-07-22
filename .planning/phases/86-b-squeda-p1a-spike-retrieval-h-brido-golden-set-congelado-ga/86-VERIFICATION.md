---
phase: 86-b-squeda-p1a-spike-retrieval-h-brido-golden-set-congelado-ga
verified: 2026-07-21T21:05:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
notes:
  - "at-01/at-04/at-05 (acentos-topónimos) usan expected=[14309-04] como placeholder honesto marcado PENDIENTE (sin proyecto real en PROD por ILIKE vacío / unaccent=false). Documentado, no oculto. WARNING informativo, no blocker."
---

# Phase 86: BÚSQUEDA P1a — SPIKE retrieval híbrido + golden set congelado (GATE de 87) Verification Report

**Phase Goal:** Elegir la estrategia de retrieval híbrido por prueba empírica ANTES de escribir cualquier schema — el bug del producto estrella (falla con palabras literales del título) no se arregla asumiendo un algoritmo, se mide.
**Verified:** 2026-07-21T21:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Golden set CONGELADO ≥30 queries cubriendo las 6 categorías + 3 formatos boletín + ñ/acentos/topónimos | ✓ VERIFIED | `golden-set.ts` = 32 casos (8 titulo-literal, 5 parafrasis-nl, 5 normas, 4 boletin, 5 acentos-toponimos, 5 similares). Boletín cubre `14309-04` (bo-01), `14309` (bo-02), `14.309-04` (bo-03). Acentos: `Ñuñoa` (at-01), `Aysén` (at-02), `medio ambiente` (at-03). Header "CONGELADO al cierre — cambios requieren decisión registrada". `golden-set.test.ts` 9 tests verdes. |
| 2 | FTS-solo / semántico-solo / RRF MEDIDAS con baseline reproducible; parámetros por evidencia | ✓ VERIFIED | `86-SCORING.md` corrida 2026-07-22 sobre 32 casos: tabla × categoría por estrategia + agregados (FTS 9.4/18.8/11.8 · SEM 34.4/53.1/40.3 · RRF 43.8/68.8/53.6 hit@1/hit@5/MRR). DECISIÓN(a): rrf_k=50, limit=50, w=1/1 — grid 20/50/100 × 30/50/70 idéntico → corpus insensible. Cobertura embeddings LIVE 3100/3659 medida, no asumida. |
| 3 | Golden set = test de regresión permanente, env-gated, excluido de suite normal/CI, corrible vía config live | ✓ VERIFIED | `retrieval-golden.live.test.ts` con `(LIVE ? describe : describe.skip)` gate en `SUPABASE_DB_URL && GEMINI_API_KEY`. `vitest.config.ts` `exclude: ["**/*.live.test.ts"]`. `vitest.live.config.ts` `include: ["src/**/*.live.test.ts"]`. Suite normal: 150 pass / 1 skip, live test NO contado. |
| 4 | Decisión registrada: algoritmo, pesos, rrf_k, límite, plan de flag, requisitos duros 87 | ✓ VERIFIED | `86-SCORING.md` §DECISIÓN (a) RRF + pesos A/B/C + w_fts/w_sem=1 + rrf_k=50 + limit=50; (b) requisito duro fase 87 `CREATE EXTENSION unaccent` + `immutable_unaccent`; (c) boletín short-circuit SQL; (d) golden congelado; (e) `match_proyectos` conservada, rewire `/buscar` solo tras dominación en RPC real de 87 (gate explícito). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `spike/golden-set.ts` | GOLDEN_SET ≥30 frozen + normalizarLiteral + tipos | ✓ VERIFIED | 32 casos, 6 categorías, congelado, normalizarLiteral accent-insensitive (293 líneas) |
| `spike/boletin.ts` | detectarBoletin 3 formatos → {base,sufijo}|null | ✓ VERIFIED | strip puntos + `^\d{3,6}(-\d{1,2})?$`; 6 tests verdes |
| `spike/rrf.ts` | rrf por rank, nunca suma de scores | ✓ VERIFIED | `w/(rrfK+i+1)` sobre cada lista, sort desc; sin cosine+ts_rank sum; 3 tests verdes |
| `spike/score.ts` | evaluarRetrieval hit@1/hit@5/MRR + detalle[] | ✓ VERIFIED | fn pura, runner inyectado, sin I/O; 7 tests verdes |
| `spike/psql.ts` | wrapper SELECT-only + assertReadOnly | ✓ VERIFIED | FORBIDDEN_TOKENS + first-token check; params bindeados; dbUrl fuera de logs; 21 tests |
| `spike/strategies.ts` | 3 estrategias con websearch_to_tsquery | ✓ VERIFIED | websearch_to_tsquery (nunca to_tsquery crudo); short-circuit boletín; 19 tests |
| `spike/embed-query.ts` | RETRIEVAL_QUERY/768/L2, key por header | ✓ VERIFIED | taskType RETRIEVAL_QUERY, dims 768, l2normalize, key solo x-goog-api-key |
| `spike/embed-cache.ts` | cache solo floats, sin secrets | ✓ VERIFIED | Record<string,number[]>; embed-cache.json = solo floats, sin api-key/url/token |
| `spike/retrieval-cli.ts` | CLI de scoring | ✓ VERIFIED | 12308 bytes, produce 86-SCORING.md |
| `spike/retrieval-golden.live.test.ts` | live regression test env-gated | ✓ VERIFIED | describe.skip sin creds; 4 gates (literal/boletín/similares/agregado) |
| `vitest.config.ts` | excluye *.live.test.ts | ✓ VERIFIED | `exclude: ["**/node_modules/**","**/*.live.test.ts"]` |
| `vitest.live.config.ts` | corre solo *.live.test.ts | ✓ VERIFIED | `include: ["src/**/*.live.test.ts"]`, timeout 120s |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| score.ts | golden-set.ts | import CasoRetrieval, normalizarLiteral | ✓ WIRED |
| strategies.ts | boletin.ts + rrf.ts | import detectarBoletin, rrf | ✓ WIRED |
| retrieval-golden.live.test.ts | strategies/score/embed-cache/psql | import + evaluarRetrieval | ✓ WIRED |

### LOCKED Rules Verification

| Rule | Status | Evidence |
|------|--------|----------|
| psql wrapper rechaza no-SELECT (assertReadOnly existe + testeado) | ✓ | 15 casos guard en psql.test.ts: INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/VACUUM + INSERT oculto en CTE, todos `.toThrow(/prohibido/i)` |
| websearch_to_tsquery presente, to_tsquery crudo ausente | ✓ | 2 usos SQL de websearch_to_tsquery (líneas 47,80); cero `to_tsquery(` crudo (el único mention crudo es un comentario de advertencia) |
| RRF por rank sin suma de scores | ✓ | rrf.ts solo `w/(rrfK+i+1)`; sin cosine+ts_rank |
| Ninguna migración nueva | ✓ | `supabase/migrations` termina en 0054; git status limpio, sin nuevos .sql |
| embed-cache.json solo floats | ✓ | grep de api-key/secret/url/token/GEMINI = 0 matches; estructura `{"14309":[floats...]}` |
| Ningún secret en artefactos commiteados | ✓ | key Gemini solo por header; dbUrl nunca en logs/argv; cache sin secrets |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite offline del paquete | `pnpm --filter @obs/fichas test` | 150 passed / 1 skipped (18 files) | ✓ PASS |
| Live test excluido de suite normal | conteo de tests | retrieval-golden.live.test.ts NO ejecutado | ✓ PASS |
| Sin migraciones post-0054 | `ls supabase/migrations \| tail` | termina en 0054_leyes_rotacion_estado.sql | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RETR-03 | 86-01/02/03 | Híbrida (RRF) elegida por SPIKE empírico con golden congelado ANTES de schema (≥30 queries, 6 clases) | ✓ SATISFIED | golden 32 casos + 86-SCORING.md decisión por evidencia; cero migración nueva |
| RETR-04 | 86-01/03 | Golden como test de regresión permanente en CI; NL/similares no regresionan; RPC vieja tras flag | ✓ SATISFIED | live test env-gated con gate similares (SEM-05); match_proyectos conservada §(e) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| golden-set.ts | at-01/at-04/at-05 | `expected:["14309-04"]` PENDIENTE (placeholder, sin proyecto real PROD) | ℹ️ Info | Documentado honestamente en `nota`. Debilita levemente la fuerza probatoria de acentos-topónimos (3/5 son placeholders) pero no rompe el contrato del set congelado ni la decisión RRF. La causa (unaccent=false + ILIKE vacío) queda registrada y es un requisito duro para 87. |

No se hallaron debt markers sin referencia (TBD/FIXME/XXX). Los "PENDIENTE" son notas de datos con causa registrada, no deuda de código.

### Human Verification Required

Ninguna. El spike es enteramente verificable por código offline + inspección de la corrida LIVE ya registrada en 86-SCORING.md. La corrida LIVE del gate ya se ejecutó (checkpoint del plan 86-03) y sus números están congelados en el artefacto.

### Gaps Summary

Sin gaps. Los 4 criterios de éxito del ROADMAP están verificados contra código y artefactos, no contra claims de SUMMARY:

1. Golden set 32 casos frozen, 6 categorías, 3 formatos boletín, ñ/acentos/topónimos — VERIFIED.
2. 3 estrategias medidas con baseline reproducible; RRF domina las 3 métricas; parámetros por grid (insensible) — VERIFIED.
3. Test de regresión permanente env-gated, skip honesto sin creds, excluido de suite normal, corrible vía vitest.live.config.ts — VERIFIED.
4. Decisión completa registrada (algoritmo RRF, pesos A/B/C + w=1/1, rrf_k=50, limit=50, flag plan, requisitos duros 87: unaccent + boletín short-circuit) — VERIFIED.

Todas las reglas LOCKED se cumplen en el código: assertReadOnly testeado (rechaza DDL/DML incl. oculto en CTE), websearch_to_tsquery sin to_tsquery crudo, RRF por rank sin suma de scores, cero migración nueva (schema intacto), embed-cache.json solo floats, cero secretos en artefactos. Suite 150 pass / 1 skip.

Observación (informativa, no bloqueante): 3 de 5 casos de acentos-topónimos (at-01 Ñuñoa, at-04 región Metropolitana, at-05 indígenas mapuche) usan `14309-04` como placeholder porque el ILIKE en PROD volvió vacío (unaccent ausente). Está documentado en el campo `nota` de cada caso y la causa raíz (unaccent=false) es precisamente el requisito duro registrado para fase 87. El honesto marcado "PENDIENTE" cumple la disciplina de "decisión registrada" del set congelado.

---

_Verified: 2026-07-21T21:05:00Z_
_Verifier: Claude (gsd-verifier)_
