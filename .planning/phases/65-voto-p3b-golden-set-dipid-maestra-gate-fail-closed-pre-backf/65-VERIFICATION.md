---
phase: 65-voto-p3b-golden-set-dipid-maestra-gate-fail-closed-pre-backf
verified: 2026-07-13T23:22:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 65: VOTO P3b — Golden set DIPID→id_maestra (gate fail-closed) Verification Report

**Phase Goal:** Garantizar que el cruce DIPID→id_maestra es correcto para los diputados vigentes ANTES de escalar — un voto mal atribuido es difamatorio y verificable como falso.
**Verified:** 2026-07-13T23:22:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Golden set DIPID→id_maestra derivado + validado para los ~155 diputados vigentes; DIPID reciclados cubiertos vía periodo | ✓ VERIFIED | `derivarGoldenDipid` filtra la maestra REAL del seed (186 rows → 155 diputados con DIPID, periodo único `2026-2030`, todos `confirmado`, DIPIDs únicos). `validarGoldenDipid` gatea 5 invariantes duras (banda [150,160], DIPID único, mono-periodo=recycle-trap, idMaestra no-vacío, A1 confirmado). Test de periodo mismatcheado `2018-2022` → no_confirmado/null. 13/13 tests verdes. |
| 2 | Cruce DIPID-determinista PUNTO: sin name-match/normalizarNombre/LLM en el camino de votos (grep-able) | ✓ VERIFIED | Grep-gate escanea `reconciliar-camara.ts` + `votos/src/*.ts` (no-test) contra `[/normalizarNombre/, /correrPipeline/, /adjudic/i, /LLMProvider/]`, comment-stripped. **Mutation test:** inyecté un uso ejecutable de `normalizarNombre` en `golden-dipid.ts` → el gate FALLÓ (`patrón prohibido /normalizarNombre/ en el CÓDIGO`). El reconciler real (`reconciliar-camara.ts`) linkea SOLO por `idx.get(key)` (Map de DIPID), sin nombres. |
| 3 | DIPID fuera de la maestra → no_confirmado, parlamentario_id=null, contra el reconciler REAL | ✓ VERIFIED | Test llama al `reconciliarVotosCamara` REAL importado de `@obs/tramitacion` (no stub — verificado: mismo símbolo del `packages/tramitacion/src/reconciliar-camara.ts` sin regresión desde phase 09). DIPID `999999` (garantizado ausente del seed) → `estado_vinculo='no_confirmado'`, `enlace=null`, `aplanarVoto().parlamentario_id=null`. |
| 4 | FK del voto sigue `EnlaceConfirmado \| null` branded (raw string no compila) | ✓ VERIFIED | `golden-dipid.test-d.ts` con `@ts-expect-error` sobre `const _crudo: EnlaceFK = "P00042"`. tsc-only gate (vitest no lo recoge; tsconfig lo compila). **Mutation test:** reemplacé el raw string por un valor asignable → `tsc -b` FALLÓ con `TS2578: Unused '@ts-expect-error'`. El gate bite es real. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/votos/src/golden-dipid.ts` | derivarGoldenDipid + validarGoldenDipid derivados del seed | ✓ VERIFIED | 141 lines. Exporta `derivarGoldenDipid`, `validarGoldenDipid`, `GoldenDipidRow`, `PERIODO_VIGENTE`, `N_MIN`, `N_MAX`. Deriva de la maestra pasada — NO hardcodea los 155 DIPIDs. Cabecera documenta A1 + recycle-trap. No recrea el reconciler. |
| `packages/votos/src/golden-dipid.test.ts` | invariantes + fail-closed contra reconciler real + grep-gate | ✓ VERIFIED | 154 lines. Contiene `reconciliarVotosCamara` importado de `@obs/tramitacion`. 13 tests (invariantes SC#1, positivo/fail-closed/recycle-trap SC#3, grep-gate SC#2). |
| `packages/votos/src/golden-dipid.test-d.ts` | aserción tipada branded-FK | ✓ VERIFIED | 28 lines. Contiene `@ts-expect-error` sobre `VotoParaEscribir["enlace"]`; caso positivo `null` compila. |
| `packages/tramitacion/src/reconciliar-camara.ts` | UNCHANGED — importado, no recreado | ✓ VERIFIED | Último commit que lo tocó: `89fa586` (phase 09, 2026-06-19). Los commits de phase 65 (`66ad193`, `6641b43`) NO lo tocan. |
| `packages/votos/src/index.ts` | barrel re-exporta los nuevos símbolos | ✓ VERIFIED | Re-exporta `derivarGoldenDipid`, `validarGoldenDipid`, `PERIODO_VIGENTE`, `N_MIN`, `N_MAX`, `type GoldenDipidRow`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `golden-dipid.ts` / test | `supabase/seeds/parlamentario.seed.json` | `cargarMaestra(findWorkspaceRoot(cwd))` | ✓ WIRED | Test carga la maestra REAL vía `cargarMaestra(findWorkspaceRoot(process.cwd()), () => {})`; deriva 155 filas del seed autoritativo. |
| `golden-dipid.test.ts` | `reconciliarVotosCamara` | import from `@obs/tramitacion` | ✓ WIRED | Import directo del símbolo real; fail-closed asertado contra él, no contra un stub. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `golden-dipid.test.ts` | `maestra`/`golden` | `cargarMaestra` → seed JSON (186 rows) | Yes — 155 diputados reales, periodo único, todos confirmado | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full votos suite green | `pnpm --filter @obs/votos test` | 16/16 passed (13 golden-dipid + 3 run-camara-votos) | ✓ PASS |
| Typecheck compiles test-d branded-FK gate | `pnpm --filter @obs/votos typecheck` | exit 0 | ✓ PASS |
| Reconciler regression | `pnpm --filter @obs/tramitacion test reconciliar-camara` | 8/8 passed | ✓ PASS |
| Branded-FK gate genuinely bites | mutate test-d raw string → assignable value | `tsc -b` FAILED `TS2578 Unused '@ts-expect-error'` | ✓ PASS |
| Grep-gate genuinely catches name-match leak | inject `normalizarNombre` use into vote path | grep-gate test FAILED (`patrón prohibido`) | ✓ PASS |
| Golden derives from seed, not hardcoded | inspect seed | 155 diputados, DIPID único, periodo único, `999999` ausente | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VOTO-03 | 65-01-PLAN.md | Cada voto reconciliado fail-closed contra la maestra (link solo si confirmado); golden set DIPID→maestra validado ANTES del backfill | ✓ SATISFIED | Golden derivado+validado del seed (SC#1); fail-closed contra reconciler real (SC#3); DIPID-determinista sin name-match (SC#2); FK branded (SC#4). Gate CI verde. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none | — | No debt markers (TODO/FIXME/XXX/TBD) in created files; no stub returns; no hardcoded golden list. |

### Human Verification Required

None. This phase is 100% offline, deterministic, and fully verifiable programmatically (unit tests + typecheck + mutation tests). No visual/real-time/external-service behavior.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are VERIFIED against the actual code, not SUMMARY claims:

- The golden set is genuinely DERIVED from the seed (155 rows from real `parlamentario.seed.json`), not a hardcoded list — confirmed by direct seed inspection.
- The fail-closed test exercises the REAL `reconciliarVotosCamara` (git history proves the reconciler is unchanged since phase 09; the test imports the live symbol).
- The anti-name-match grep-gate is a real gate — a mutation injecting an executable `normalizarNombre` use into the vote path made it fail. The comment-stripping (`soloCodigo`) is a justified false-positive defense, not a bypass.
- The branded-FK `@ts-expect-error` is a real compile gate — a mutation making a value assignable to the FK made `tsc -b` fail with `TS2578`.
- The reconciler and branded type were NOT recreated; the two phase-65 commits touch only the 4 declared files.

Phase goal achieved: the DIPID→id_maestra cross is proven deterministic-only, fail-closed, and mutation-resistant BEFORE the Phase 66 backfill. Ready to proceed.

---

_Verified: 2026-07-13T23:22:00Z_
_Verifier: Claude (gsd-verifier)_
