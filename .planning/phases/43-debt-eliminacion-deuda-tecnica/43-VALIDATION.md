# Phase 43 — VALIDATION (consolidated)

**Date:** 2026-06-24
**Method:** 6 Opus validators, one per discovery dimension, each re-reading the actual file:line and rendering an INDIVIDUAL verdict per finding (gate 3: "uno por uno"). Adversarial framing: "real or false-positive? safe fix or behavior change?".

Per-finding detail lives in the dimension files (this is the index + cross-cutting reconciliations):
- `43-validation-app.md` — APP-01..12
- `43-validation-packages.md` — PKG-01..13
- `43-validation-db.md` — DB-01..10
- `43-validation-tests.md` — TEST-01..10
- `43-validation-config.md` — CFG-01..14
- `43-validation-planning.md` — PLAN-01..14 + Phase 42 scratch inventory

Classified outcome: see `43-DEBT-LEDGER.md` (sections A FIX-NOW / B CHECKPOINT / C WON'T-FIX / D FOLD-INTO-CLOSURE).

## What validation overturned (the "nada por sentado" yield)

Discovery raised ~71 findings incl. 4 "criticals". Adversarial Opus refuted or downgraded a large share:

| Discovery claim | Validation verdict | Why |
|---|---|---|
| **PKG-01 CRITICAL** — agenda onConflict 3-col index missing → 42P10 every ingest | **FALSE-POSITIVE** | `0016_citacion_invitado_calidad.sql` drops the 2-col key and creates `unique(citacion_id,nombre,calidad)`. Discovery read only `0010`. The proposed "fix" would have *introduced* the crash. |
| **APP-01 CRITICAL** — admin client broken | **REAL → FIX-NOW** | Confirmed: `.env` carries only `SUPABASE_SECRET_KEY`; `supabase-admin.ts` reads `SUPABASE_SERVICE_KEY`. Latent (gated OFF). RUNBOOK already flags it. |
| **TEST-01/02 CRITICAL** — no CI quality gate | **split** | TEST-01 (wire app into root test) = FIX-NOW; TEST-02/07 (new CI workflow + pgTAP infra) = CHECKPOINT (Actions minutes, operator-minimized; no auto-deploy to protect). |
| **DB-07/08** — anon can wipe `cruce_senal`/`entidad` | **blast-radius FALSE-POSITIVE** | `cruces`/`grafo` schemas have NO `grant usage` to anon (grep = 0) → materializers unreachable by the API role. Revoke kept as free defense-in-depth in 0045. |
| **DB-06, DB-10** — plan drift / missing 0036 guard | **RESOLVED** | plan(10)==10 asserts; 0037 test #9 already locks `vinculo_id IS NULL`. |
| **APP-06, APP-12, PKG-04/07/09, PLAN-07/09/10/11/12** | **FALSE-POSITIVE** | Already tested / consumed in prod / already logged / docs current / runbook post-validation. |

## Severity corrections recorded by validators
- PKG-02 high→medium (candidate already in returned audit array; only queue+observability lost).
- PKG-06 medium→low/unproven. PKG-11 fix-path riskier than stated (`z.enum` literal-tuple trap → use a guard test, not `.map()` derive).
- APP-03b: discovery prescribed `throw` for both hydration sites; throwing on the *secondary* materia enrichment would regress resilience → log-and-continue.
- CFG-02 over-stated (server client fails loud, not silent browser fail); CFG-07 over-stated ("module not found" disproven — refs resolve).

## Gate compliance of the validation pass
No edits applied. No PROD connection. Migrations treated immutable. Phase 42 scratch confirmed load-bearing (gate 4) → untouched. No memory edits, no dossier signatures, no flag flips.
