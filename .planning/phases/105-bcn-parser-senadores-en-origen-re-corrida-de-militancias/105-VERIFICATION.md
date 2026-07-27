---
phase: 105-bcn-parser-senadores-en-origen-re-corrida-de-militancias
verified: 2026-07-26T20:26:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: null
---

# Phase 105: BCN — Parser senadores en ORIGEN + re-corrida de militancias — Verification Report

**Phase Goal:** Que la militancia de senadores muestre el partido legible en ORIGEN, no un URI RDF — cerrando en la fuente el defecto que 104-03 tapó display-only.
**Verified:** 2026-07-26T20:26:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Parser resuelve `hasPoliticalParty` URI→label en ORIGEN por mapeo determinista, fail-closed ante URI desconocida (omite + reporta, nunca fabrica) | ✓ VERIFIED | `parse-bcn-senadores.ts:160 resolverPartido` — (1) `rdfs:label` verbatim, (2) URI en `PARTIDO_URI_A_LABEL` (27 URIs, `Object.freeze`, líneas 96-150) → label, (3) URI ausente/vacía → `{label:null, uriDesconocida}`. Caller `parseBcnSenadoresConReporte:224` OMITE la militancia y acumula la URI en `partidosDesconocidos`. JAMÁS deriva del slug. Tests A–D + delegación = 15/15 verde |
| 2 | Tras la re-corrida, filas PROD con cero URI-como-partido (verificable por consulta) | ✓ VERIFIED (evidencia registrada) | 105-02-SUMMARY registra conteos CONCRETOS pre/post: `parlamentario_militancia` **3→0** (tablas líneas 75-79, 107, 117-119, verif. 145); `parlamentario` **1→0** (líneas 75-79, 90, 120, verif. 146). `--from-r2` LIVE: `militancias=48 partidosActualizados=31`. DELETE acotado `partido ~* '^https?://'` = DELETE 3 (línea 112). No re-ejecutable por el verificador (query PROD live), pero la evidencia es concreta, no vaga |
| 3 | Decisión `partidoLegible()` DOCUMENTADA con evidencia post-re-corrida | ✓ VERIFIED | 105-02-SUMMARY Task 4 (líneas 129-138): CONSERVAR como defensa en profundidad, justificado con la evidencia cero-URI. `app/lib/format.ts` NO modificado (git: último commit `f3fb0be` es de Phase 104). Deferred: retiro solo si evidencia futura lo justifica |
| 4 | Cruce por partido (facetas/filtros) sigue funcionando — clave RAW preservada, sin regresión | ✓ VERIFIED | `partidoLegible()` intacto (format.ts:153), `format.test.ts` 42/42 verde. 105-02-SUMMARY: `/parlamentarios` = 25 grupos de partido, 0 URI en la clave (líneas 96-101). CONTEXT confirma clave serializada RAW no se toca |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/bio/src/parse-bcn-senadores.ts` | `resolverPartido` fail-closed + `PARTIDO_URI_A_LABEL` (27 URIs) + `parseBcnSenadoresConReporte` | ✓ VERIFIED | Todos presentes y sustantivos; `parseBcnSenadores` delega (retro-compat). tsc EXIT 0 |
| `packages/bio/src/parse-bcn-senadores.test.ts` | Tests A (verbatim), B (URI→label S1344), C (URI desconocida→omite+reporta), D (anti-URI) + delegación | ✓ VERIFIED | Los 5 tests presentes (líneas 110-161), parte de 15/15 verde |
| `packages/bio/src/__fixtures__/bcn-militancy-uri.json` | Fixture con URI conocida (S1344), desconocida (9999), y con label | ✓ VERIFIED | 3 bindings reales del crudo R2, ejercitan los 3 caminos de `resolverPartido` |
| `app/lib/format.ts` (`partidoLegible`) | CONSERVADO sin cambios | ✓ VERIFIED | Presente (línea 153), no modificado en P105 (git history) |
| `105-02-SUMMARY.md` | Evidencia re-corrida + limpieza + query cero URI + decisión BCN-02 | ✓ VERIFIED | Conteos pre/post concretos + decisión documentada |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `run-bio.ts` sección B senadores | `parseBcnSenadores` (resolver fijo) | Delegación a `parseBcnSenadoresConReporte`/`resolverPartido` | ✓ WIRED | `run-bio.ts:212 parseBcnSenadores(json)` → el fix fluye a la re-corrida sin cambio del caller |
| `run-bio --from-r2 <r2Path>` | PROD Supabase (militancia + parlamentario.partido) | Replay R2 → SupabaseBioWriter upsert idempotente | ✓ WIRED | `run-bio.ts:114-122 fromR2` reconstruye envelope desde R2 (CERO red); writer-supabase presente |
| barrel `index.ts` | `resolverPartido`/`parseBcnSenadoresConReporte`/`PARTIDO_URI_A_LABEL` | Reexport | ✓ WIRED | `index.ts:37-39` exporta los símbolos nuevos |
| DELETE `partido ~* '^https?://'` | PROD (reconciliación URI stale) | psql acotado al patrón, tras upsert | ✓ WIRED (evidencia) | 105-02-SUMMARY línea 112: `DELETE 3`, verificación post-borrado = 0 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Parser suite (incl. resolución URI→label fail-closed) | `pnpm --filter @obs/bio test` | 70/70 (parse-bcn-senadores 15/15) | ✓ PASS |
| partidoLegible conservado sin regresión | `vitest run lib/format.test.ts` | 42/42 | ✓ PASS |
| Tipos del paquete bio | `pnpm --filter @obs/bio exec tsc --noEmit` | EXIT 0 | ✓ PASS |

Nota: la verificación PROD cero-URI (criterio 2) NO es re-ejecutable por el verificador (query live a Supabase PROD). Se confirma que la evidencia está registrada con conteos concretos (3→0 militancia, 1→0 parlamentario), no aseverada vagamente.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BCN-01 | 105-01, 105-02 | Parser resuelve URI→label fail-closed + re-corrida deja cero URI en PROD | ✓ SATISFIED | Truths 1+2 verified |
| BCN-02 | 105-02 | `partidoLegible()` conservado/retirado según evidencia — decisión documentada | ✓ SATISFIED | Truth 3 verified |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Ninguno (sin TBD/FIXME/XXX en archivos modificados) | — | — |

### Human Verification Required

Ninguno. Los planes no defirieron `<human-check>` a fin de fase. El único ítem no re-ejecutable (query PROD cero-URI) tiene evidencia concreta registrada en 105-02-SUMMARY (conteos 3→0 y 1→0); el write a PROD es acción de datos permitida al agente (no flag `*_PUBLIC_ENABLED`, no sign-off legal), por lo que no requiere gate humano.

### Gaps Summary

Sin gaps. Los 4 success criteria del ROADMAP están satisfechos con evidencia de código verificada directamente (resolver fail-closed real, mapa de 27 URIs congelado, tests A–D presentes y verdes, wiring completo run-bio→R2→PROD, barrel exportado) y la evidencia PROD concreta registrada en el SUMMARY (militancia 3→0, parlamentario 1→0). `partidoLegible()` conservado sin cambios (git-confirmed) con decisión documentada. Suite verde: @obs/bio 70/70, format.test 42/42, tsc 0.

---

_Verified: 2026-07-26T20:26:00Z_
_Verifier: Claude (gsd-verifier)_
