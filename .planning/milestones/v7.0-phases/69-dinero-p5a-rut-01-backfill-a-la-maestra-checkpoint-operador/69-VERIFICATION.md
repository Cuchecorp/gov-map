---
phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
verified: 2026-07-14T03:15:00Z
status: human_needed
score: 4/4 must-haves verified (mechanism); 1 operator write pending
overrides_applied: 0
human_verification:
  - test: "Escritura REMOTA del RUT a la maestra (parlamentario + entidad_tercero) vía db-url: poblar Track B (supabase/seeds/parlamentario-rut.seed.json, hoy 0 filas) con RUTs reales DV-válidos + provenance, correr runBackfillRut contra el REMOTO (DV-gate módulo-11 + provenance NOT NULL), re-leer pnpm freshness para la nueva cobertura N/M."
    expected: "pnpm freshness reporta cobertura N/M concreta (>0/M) para las maestras cruzables; el rut NO es legible por anon en la DB remota (RLS deny-by-default); lockdown-guard verde. RUT-01 pasa a Complete SOLO tras este reporte."
    why_human: "checkpoint:human-verify gate=blocking-human (autonomous:false). PII real (el agente no posee RUTs reales) + credencial db-url ausente por diseño en .env. Bloqueante duro de TODO P5 (Phases 70/71/72). El agente NO ejecutó la escritura remota — correcto."
    source: "operator-checkpoint (69-03 Plan Task 2, PENDING)"
---

# Phase 69: DINERO P5a — RUT-01 backfill a la maestra Verification Report

**Phase Goal:** Poblar físicamente el RUT en la maestra — DATO bloqueante de TODO P5; sin RUT presente, cualquier cruce de dinero rinde `null` (o, peor, falso por name-match).
**Verified:** 2026-07-14T03:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal has TWO layers: (1) the **mechanism** that makes a safe RUT backfill
possible (DV-gate + provenance + name-match guard + honest coverage measurement + LLM/RLS
minimization), and (2) the **actual data population** (remote write). The plans correctly
scoped layer (2) as an operator-only checkpoint (PII + db-url absent by design). Every
mechanism truth is VERIFIED against the code and by running the suites + an independent
mutation self-check. The remote write is genuinely PENDING → `human_needed`.

### Observable Truths

| #   | Truth (ROADMAP Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Maestra tiene RUT backfilleado con DV-gate módulo-11 + provenance NOT NULL | ✓ VERIFIED (mechanism) / ⏸ data pending operator | `backfill-rut.ts` gates every row fail-closed: provenance NOT NULL (`provenance-faltante` reject) + `isRutValido` módulo-11 (`dv-invalido` reject) BEFORE `writer.updateRut`. RUTs never fabricated. DATA population = operator write (seed `filas: 0` today → routed to human_needed). |
| 2 | Cobertura RUT DV-válido MEDIDA + declarada como techo honesto N/M | ✓ VERIFIED | `COBERTURA_RUT_PARLAMENTARIO_SENALES` + `COBERTURA_RUT_ENTIDAD_SENALES` (catalog.ts) → `queryCoberturaRut` → `evaluateCobertura` per maestra → `renderCoberturaRut` appended to `pnpm freshness` (stdout + JSON). Degrades by cause: null→n/d, M=0→n/d, N=0→0%. Today honestly ≈ 0/186 (parlamentario) / n/d (entidad, universo 0). |
| 3 | Name-match NUNCA escribe el `rut`; guard CI lo enforça | ✓ VERIFIED | Static guard `app/lib/name-match-rut-guard.test.ts` (15 tests) + behavioral companion `packages/dinero/src/name-match-rut-guard.behavior.test.ts` (3 tests). Structural cut in `reconciliar-contrato.ts:369-408` intact. Guard BITES — independently confirmed (see Behavioral Spot-Checks). |
| 4 | RUT nunca cruza al LLM ni a tabla/ruta pública (RLS deny-by-default) | ✓ VERIFIED | `assertNoRutInLlmInput` (llm/src/data-routing.ts:52) aborts before any LLM call if a RUT is present; `assertPiiDocumentAllowed` calls it first. lockdown-guard.test.ts:400 asserts `supabase.ts` chokepoint never `.select()`s `rut`. |

**Score:** 4/4 mechanism truths verified. Truth 1's DATA layer is the operator write → human_needed.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/lib/name-match-rut-guard.test.ts` | Static guard + mutation self-check | ✓ VERIFIED | 478 lines (≥120). Pure detector `detectarViolacionesCorteRut` (A: revisionesRut→writer; B: cosechas.push outside corroboration). Runs in app suite. |
| `packages/dinero/src/name-match-rut-guard.behavior.test.ts` | Behavioral fail-closed exercising `reconciliarContrato` | ✓ VERIFIED | 3 tests: name-only → 0 cosechas + 1 revisión; namesake-collision → 0 cosechas + rut real not overwritten; corroboración → 1 cosecha. Real pipeline via MockMiniMaxProvider. |
| `packages/dinero/src/reconciliar-contrato.ts` | Structural cut UNCHANGED | ✓ VERIFIED | Last touched by commit `aeab365` (Phase 43), BEFORE phase 69 start (`84a7a27`). `git diff --stat` empty. Cut at L369-408 (corroboración → cosechas; name-only → revisionesRut + encolarRevisionRut) intact. |
| `packages/freshness/src/catalog.ts` | COBERTURA_RUT arrays, static SQL, counts-only | ✓ VERIFIED | Two separate arrays with own denominators. SQL is `count(*)`, `rut IS NOT NULL AND rut <> ''`, never `SELECT rut`. No `${` interpolation. |
| `packages/freshness/src/query-runner.ts` | `queryCoberturaRut` read-only, no dbUrl leak | ✓ VERIFIED | Reuses `psql` (execFileSync, argv-separated, never prints dbUrl/password). Returns `{parlamentario, entidad}` counts; null on degrade. |
| `packages/freshness/src/cli.ts` | `renderCoberturaRut` wired into freshness | ✓ VERIFIED | Imported + called in `main()`; appended to stdout/stderr + `coberturaRut` in JSON. Corpus + voto untouched. |
| `69-BACKFILL-RUT-RUNBOOK.md` | Operator runbook, ≥80 lines | ✓ VERIFIED | 238 lines. 46 references to runBackfillRut/isRutValido/checkpoint/PENDING/db-url/freshness. Declares write is operator-only, agent did NOT execute. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| name-match-rut-guard.test.ts | reconciliar-contrato.ts | walkSourceFiles + stripTsComments | ✓ WIRED | Guard reads + analyzes the real file; sanity test asserts readability. |
| name-match-rut-guard.test.ts | harvest-rut.ts / writers | detector asserts no revisionesRut→writer | ✓ WIRED | WRITERS_RUT = [runBackfillRut, runHarvestRut, updateRut]; detector fires on all three. |
| cli.ts | catalog.ts | import COBERTURA_RUT + evaluateCobertura + queryCoberturaRut | ✓ WIRED | All three imported and invoked in main(). |
| query-runner.ts | parlamentario.rut / entidad_tercero.rut | SELECT count(*) static | ✓ WIRED | Static SQL, no interpolation, counts only. |
| runbook | runBackfillRut / freshness | operator instructions | ✓ WIRED | Runbook references the real mechanism + COBERTURA_RUT reporting; documents the remote-invoker GAP honestly (fail-closed). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| pnpm freshness COBERTURA_RUT | coberturaRut counts | queryCoberturaRut → psql count(*) | Today N=0 (seed empty) declared honestly as 0/186 not faked | ✓ FLOWING (honest 0/M ceiling — NOT a stub; the empty seed is the truthful state) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Guard suite (static) | `vitest run lib/name-match-rut-guard.test.ts` | 15/15 passed | ✓ PASS |
| Behavioral companion | `pnpm --filter @obs/dinero test` | 100/100 passed (incl. 3 CR-01 behavior) | ✓ PASS |
| Freshness suite | `pnpm --filter @obs/freshness test` | 26/26 passed | ✓ PASS |
| Full app suite (guard in context) | `pnpm --filter ./app test` | 776/776 passed | ✓ PASS |
| **Mutation self-check (independent)** | Injected `cosechas.push` outside corroboration + `runBackfillRut(revisionesRut, writer)` into reconciliar-contrato.ts, ran guard | **3 tests FAILED** (caught both violations), restored → 15/15 green, `git diff` empty | ✓ PASS — guard genuinely BITES, not a no-op |

The mutation self-check is the critical adversarial test: I did not trust the SUMMARY's claim
that "the guard bites." I broke the structural cut in the real file and confirmed the guard
turned red (offenders reported both the unguarded `cosechas.push` and the `revisionesRut`→writer
call), then restored the file byte-identical. The guard is real defense-in-depth.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| RUT-01 | 69-01/02/03 | Maestra tiene RUT backfilleado, cobertura N/M techo honesto, name-match nunca escribe rut, rut nunca público/LLM | ✓ MECHANISM SATISFIED / ⏸ DATA In Progress | REQUIREMENTS.md L22 + L79 honestly mark RUT-01 `[ ]` / "In Progress (write remoto PENDING operador)". NOT marked complete — correct. Mechanism (guard + cobertura + runbook) done offline; remote write = operator checkpoint. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No TBD/FIXME/XXX in any phase-modified file (guard, catalog, query-runner, cli, runbook) | — | None |

The cobertura ≈ 0/M today is NOT a stub: it is the truthful ceiling of an unpopulated seed,
correctly degraded (0% real for parlamentario N=0/M=186; n/d for entidad M=0). No hardcoded
empty-data anti-pattern.

### Human Verification Required

**1. Remote RUT write to the maestra (OPERATOR CHECKPOINT — blocking-human)**

**Test:** Populate `supabase/seeds/parlamentario-rut.seed.json` (today 0 filas) with real
DV-valid RUTs + provenance, run `runBackfillRut` against the REMOTE maestra via db-url
(DV-gate módulo-11 + provenance NOT NULL enforced by the mechanism), then re-read
`pnpm freshness` for the new N/M coverage.

**Expected:** `pnpm freshness` reports concrete N/M (>0/M) for the crossable maestras; `rut`
is NOT anon-readable in the remote DB (RLS deny-by-default); lockdown-guard green. RUT-01
transitions to Complete ONLY after this report.

**Why human:** `checkpoint:human-verify` gate=blocking-human (autonomous:false). PII real
(agent does not possess real RUTs) + db-url write credential absent by design in `.env`.
Bloqueante duro de TODO P5 (Phases 70/71/72). The agent correctly did NOT execute the remote
write, did NOT touch db-url, did NOT fabricate RUTs.

### Gaps Summary

No mechanism gaps. All four ROADMAP success criteria are satisfied at the mechanism level and
verified by running the suites plus an independent mutation self-check:

- **Guard bites (truth 3):** independently falsified the SUMMARY's "no-op verde" risk — broke
  the cut, guard went red (3 fails), restored clean.
- **Structural cut unchanged (artifact):** confirmed by git history — `reconciliar-contrato.ts`
  last touched in Phase 43, untouched by Phase 69; `git diff` empty.
- **Coverage honest + counts-only (truth 2):** static SQL, never `SELECT rut`, degrades by
  cause; today's 0/186 is the truthful ceiling of the empty seed, not a faked 0% or 100%.
- **RUT off LLM + off public routes (truth 4):** `assertNoRutInLlmInput` aborts pre-LLM;
  lockdown-guard B forbids `.select(rut)` on the public chokepoint.

The ONLY outstanding item is the **remote data write**, which is by design an operator
checkpoint (PII + db-url absent). RUT-01 is honestly recorded as In Progress, not Complete.
This is the expected and correct terminal state for this phase: `human_needed`.

---
_Verified: 2026-07-14T03:15:00Z_
_Verifier: Claude (gsd-verifier)_
