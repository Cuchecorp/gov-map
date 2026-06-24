---
phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default
verified: 2026-06-24T12:00:00Z
status: passed
score: 3/3 requirements verified (CRUCE-01, CRUCE-02, CRUCE-03)
verdict: PASS-WITH-NOTES
overrides_applied: 0
notes:
  - id: SC3-token-wording
    severity: note
    summary: >
      ROADMAP Success Criteria #3 literally says cruce_senal must have rows with
      tipo_senal='lobby_sector_aporte'. The implemented (and operator-LOCKED, Open
      Question 1 / decision B1) token is 'lobby_sector' (lobby-PURE MVP).
      'lobby_sector_aporte' is explicitly RESERVED for Phase 40 (gated by RUT-01).
      The 0039 CHECK constraint allows ONLY 'lobby_sector'. The phase_requirements
      brief given to this verifier confirms the lobby-pure token. This is a deliberate,
      documented scope decision, not a defect — but the ROADMAP SC wording diverges
      from delivery and should be reconciled (cosmetic) when Phase 40 lands the fusion.
  - id: CRUCE-03-prod-not-re-verified-live
    severity: note
    summary: >
      The LIVE PROD state (24 distinct parlamentarios / 30 señales, deny-by-default
      anon probe = 42501, golden LIVE gate cobertura=1.000) was verified by the
      executor in Plan 04, NOT re-verified live by this verifier (paid MiniMax/DeepSeek
      classification cannot be re-run, and PROD anon probes require live keys). The
      quoted SELECT result is internally consistent (24 ≥ 5 with margin; 30 señales
      across 10 sectors summing to the per-sector breakdown) and matches the pgTAP
      contract that IS independently verifiable. PROD reality accepted on executor evidence.
---

# Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default) Verification Report

**Phase Goal:** Construir el valor diferenciador — la capa que cruza carriles modelando relaciones parlamentario↔sector sobre lobby (MVP), materializando señales factuales (conteos de evidencia, nunca score), construida entera deny-by-default y expuesta solo tras gate legal, con etiquetado de sector por LLM gobernado por su propio eval/golden separado de la extracción literal.

**Verified:** 2026-06-24
**Status:** passed
**Verdict:** PASS-WITH-NOTES
**Re-verification:** No — initial verification

## VERDICT: PASS-WITH-NOTES

All three requirements (CRUCE-01, CRUCE-02, CRUCE-03) are achieved in the codebase. The DDL layer encodes deny-by-default with the anon-EXECUTE leak fix present in source; the classifier package has the closed taxonomy, abstention, split prompts, RUT-gate-first ordering, an LLM-free writer, and a passing golden gate; and the LIVE PROD population is documented with internally-consistent evidence (≥5 distinct parlamentarios satisfied with margin). Two non-blocking NOTES are recorded: (1) the ROADMAP SC#3 token wording ('lobby_sector_aporte') diverges from the operator-LOCKED delivered token ('lobby_sector', lobby-pure MVP; the other is reserved for Phase 40); (2) the paid LIVE PROD state was verified by the executor, not re-run here.

## Goal Achievement — Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| CRUCE-01 (DDL layer, deny-by-default, pgTAP) | ✓ VERIFIED | 0038/0039/0040 source + 3 pgTAP suites |
| CRUCE-02 (@obs/cruces classifier package) | ✓ VERIFIED | sector.ts/model.ts/clasificar.ts/prompts/writer/CLIs/golden + passing tests |
| CRUCE-03 (LIVE, ≥5 parlamentarios, deny holds) | ✓ VERIFIED (executor evidence) | 36-04-SUMMARY PROD SELECT (24/30) + pgTAP contract |

**Score:** 3/3 requirements verified.

## CRUCE-01 — DDL layer + deny-by-default + pgTAP

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `sector` catalog exists, public-read, 13 codes, no catch-all | ✓ VERIFIED | `0038_sector.sql:35-62` creates table, seeds 13 codes (salud..gremios_trabajadores), `enable RLS` + `policy sector_public_read for select to anon` + `grant select to anon`. No 'otros'. |
| 2 | `sector_id` columns added to the 3 tables, nullable, FK to sector(codigo) | ✓ VERIFIED | `0038:68-70` ALTER proyecto_ficha / lobby_contraparte / donante ADD sector_id text references sector(codigo). |
| 3 | `cruce_senal` deny-by-default (RLS on, zero policies, revoke from anon+authenticated) | ✓ VERIFIED | `0039:66-67` enable RLS + `revoke all on cruce_senal from anon, authenticated`. No policy created anywhere. Single-row-per (parlamentario, sector, tipo) via UNIQUE (`0039:60`), evidencia jsonb (`0039:53`) — NOT a mirror of `arista`. |
| 4 | `materializar_cruces()` security definer, search_path='', FULL REBUILD, cron offset | ✓ VERIFIED | `0039:81-82` `security definer set search_path = ''`; `0039:85` delete-all + insert (D-11); cron `'23 3 * * *'` (`0039:141`) with pg_cron version guard (`0039:127-144`) + post-migration assertion (`0039:148-154`). |
| 5 | RPC `cruces_de_parlamentario` exists, named-column PII-safe projection, NO grant to anon | ✓ VERIFIED | `0040:29-48` returns named columns (no select *), joins only public `sector` catalog; never joins parlamentario/donante. |
| 6 | **Anon-EXECUTE leak fixed** (revoke from anon,authenticated, not just public) | ✓ VERIFIED | `0040:55` revoke from public AND `0040:61` `revoke execute ... from anon, authenticated`; `0040:62` explicit comment "INTENCIONALMENTE NO HAY grant ... to anon". This is the 36-04 forward-fix (commit 9f3139a). |
| 7 | pgTAP coverage encodes the contract | ✓ VERIFIED | `0038_sector.test.sql` (11 asserts: public-read + 13 codes + FKs + no 'otros'); `0039_cruce_senal.test.sql` (10 asserts: RLS, zero policies, security definer, no partido/rut in body, ≥5 distinct, jsonb enlace_fuente, crudo name, cron, anon→42501); `0040_cruces_rpc.test.sql` (4 asserts: exists, security definer, **anon NOT execute**, no partido/rut/email/donante_id). |

**Body PII-safety:** Both materializar_cruces (`0039`) and the RPC (`0040`) bodies reference only lobby tables + sector; pgTAP asserts the function definitions do not match `partido|rut|email|donante_id` (`0039.test:77-82`, `0040.test:32-37`).

## CRUCE-02 — @obs/cruces classifier package

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sector taxonomy single source synced byte-for-byte to 0038 (13 codes) | ✓ VERIFIED | `sector.ts:23-57` SECTOR_CATALOGO + SECTOR_CODIGOS match all 13 codes/labels in `0038:42-54` verbatim. SECTOR_CODIGOS derived for z.enum. |
| 2 | Closed zod schema with abstention (null first-class) | ✓ VERIFIED | `model.ts:25-28` `z.object({ sector_codigo: z.enum(SECTOR_CODIGOS).nullable() })`. Test rejects out-of-taxonomy output (`clasificar.test.ts:85-95`). |
| 3 | Split prompts (public ficha / sensitive contraparte) | ✓ VERIFIED | `prompt.ts` SYSTEM_CLASIFICACION_FICHA + `prompt-lobby.ts` SYSTEM_CLASIFICACION_CONTRAPARTE (factual, no causal vocab, abstain-on-doubt). |
| 4 | PII-gate-FIRST clasificar (assertNoRutInLlmInput before LLM) | ✓ VERIFIED | `clasificar.ts:87-90` order: assertNoRutInLlmInput → assertSensitivityAllowed → provider.complete. Test confirms RutInLlmInputError with `callCount === 0` (`clasificar.test.ts:19-32`) and error message leaks neither RUT nor name (`:34-44`). |
| 5 | Correct sensitivity routing per route | ✓ VERIFIED | clasificarFicha = public/bulk (DeepSeek); clasificarContraparte = personal/critical (MiniMax). Asserted in `clasificar.test.ts:47-69`. |
| 6 | Batch CLIs (DeepSeek fichas / MiniMax lobby) | ✓ VERIFIED | `clasificar-fichas-cli.ts` uses DeepSeekProvider + clasificarFicha; `clasificar-lobby-cli.ts` uses MiniMaxProvider + clasificarContraparte (RUT-gate noted). Both inject SupabaseCrucesWriter. |
| 7 | Service-role writer that NEVER calls the LLM | ✓ VERIFIED | `writer-supabase.ts` imports only `@supabase/supabase-js` + `./sector`. Grep for `@obs/llm|LLMProvider|provider.|complete(|clasificar*` in writer = **No matches**. Pure UPDATE sector_id (D-13). |
| 8 | Golden top-1 + abstención gate ≥7/10 | ✓ VERIFIED | `golden/golden-set.ts:35` COBERTURA_MIN=0.7; `gatePasa` requires cobertura≥0.7 AND errores===0; scoring is single-label top-1 (abstention = no-cubierto, never error). `casos.json` has exactly 10 muestra:true cases (g01-g10) + 30 more incl. 5 abstention nulls. |

**Schema separated from literal extraction:** @obs/cruces is a distinct package; clasificar.ts header documents the separation from SEM-02 (@obs/fichas literal extraction). Imputation-to-closed-taxonomy is governed by its own golden.

**Package test suite:** `pnpm --filter @obs/cruces test` → **14 passed, 1 skipped** (the LIVE golden block is correctly gated out of CI via env flag). PASS.

## CRUCE-03 — LIVE PROD population + deny holds

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Migrations applied to PROD + registered in schema_migrations | ✓ VERIFIED (executor) | 36-04-SUMMARY: 0038/0039/0040 applied by `psql --db-url --single-transaction`, 3 rows in schema_migrations (INSERT 0 3). pgTAP green vs applied DB (0038 11/11, 0039 10/10, 0040 4/4); zero regression on 6 prior suites. |
| 2 | Classify contrapartes → populate lobby_contraparte.sector_id → materializar | ✓ VERIFIED (executor) | Golden LIVE gate cobertura=1.000 BEFORE populating; `clasificar-lobby-cli --limite 60` → 60 processed / 34 with sector / 26 abstention; `select cruces.materializar_cruces()` run. |
| 3 | ≥1 señal lobby_sector for ≥5 DISTINCT parlamentarios | ✓ VERIFIED (executor) | PROD SELECT: `24 distinct_parls / 30 total_senales`. 24 ≥ 5 with margin. Per-sector breakdown (10 sectors) sums consistently. Token = 'lobby_sector' only (see NOTE on SC wording). |
| 4 | Deny-by-default holds against anon key | ✓ VERIFIED (executor) | anon-key REST probe: GET /cruce_senal → 401/42501; POST /rpc/cruces_de_parlamentario → 401/42501; GET /sector → 200 (public by design). Re-probed POST-populate with real data present → still 42501. |
| 5 | Evidence lobby-pure, factual, traceable, no-PII | ✓ VERIFIED (executor) | Items only 'reunion' (zero aporte); 0 items without enlace_fuente; only tipo_senal='lobby_sector'; 0 rows with rut/partido in evidencia. |

**Internal consistency check (verifier):** 30 señales across 10 distinct sectors; per-sector señal counts (8+7+3+2+2+2+2+2+1+1 = 30) sum to total — consistent. 24 distinct parlamentarios ≤ 30 señales — consistent (some have multiple sector señales). Gate ≥5 satisfied with large margin. Accepted.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (none) | TODO/FIXME/XXX/HACK/PLACEHOLDER scan of packages/cruces/src | — | No debt markers found. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package unit + golden (mock) tests pass | `pnpm --filter @obs/cruces test` | 14 passed / 1 skipped (LIVE gated) | ✓ PASS |
| Writer free of LLM references | grep `@obs/llm\|LLMProvider\|complete(` in writer-supabase.ts | No matches | ✓ PASS |
| Signal token consistency | grep `lobby_sector` across src + read of 0039 CHECK | token lives only in SQL (CHECK allows only 'lobby_sector'); TS produces sector_codigo (correct separation) | ✓ PASS |

### Probe Execution

pgTAP suites are the canonical probes for this phase. They require a live applied Postgres (PROD or local Supabase) and live DB credentials, which are operator checkpoints — not re-run by this verifier. The executor ran them green against the applied PROD schema (0038 11/11, 0039 10/10, 0040 4/4) per 36-04-SUMMARY. The suite **source** was independently read and confirmed to encode the deny-by-default + no-PII + ≥5-distinct contract (see CRUCE-01 truth 7). Status: contract VERIFIED in source; execution accepted on executor evidence.

### Human Verification Required

None blocking. The LIVE PROD facts (anon probe codes, paid classification cobertura) were verified by the executor under operator authorization and cannot be cheaply re-run; they are recorded as accepted-on-executor-evidence NOTES, not open human-verification items.

### Gaps Summary

No blocking gaps. Two non-blocking notes:

1. **SC#3 token wording divergence (cosmetic).** ROADMAP Success Criteria #3 names `lobby_sector_aporte`; the operator-LOCKED MVP delivers lobby-pure `lobby_sector` (the 0039 CHECK allows only this token; the fusion token is reserved for Phase 40, gated by RUT-01). The phase_requirements brief confirms `lobby_sector` is the correct delivery. Recommend reconciling the ROADMAP SC text when Phase 40 lands the fusion. Does not affect achievement.

2. **CRUCE-03 PROD verified by executor, not re-run live.** The paid LIVE classification and PROD anon probes are accepted on executor evidence (internally consistent; matches the independently-verified pgTAP contract).

## Recommendation

**PASS-WITH-NOTES — proceed to Phase 37.** The cruces layer is delivered deny-by-default with the anon-EXECUTE leak fixed in source, the classifier package is substantive and tested, and the LIVE PROD signal exceeds the ≥5-distinct gate. Carry the two notes forward: (a) reconcile the ROADMAP SC#3 token wording, and (b) note that Phase 37's surface must remain behind `crucesPublicEnabled()` (default OFF) since the RPC has no anon grant until the Phase 39 legal sign-off.

---

_Verified: 2026-06-24_
_Verifier: Claude (gsd-verifier)_
