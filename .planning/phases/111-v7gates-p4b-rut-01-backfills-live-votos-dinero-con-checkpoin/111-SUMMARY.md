# 111 SUMMARY — RUT-01 + backfills (agent prep done; LIVE writes DEFERRED)

**Completed (agent half):** 2026-07-27
**Requirements:** V7-02, V7-03, V7-04 (all operator blocking-human)
**Files modified:** docs only (CONTEXT/RESEARCH/OPERATOR-CHECKPOINT)

## What the agent did (prepare + verify — NO RUT write, NO LIVE crawl)
- **Machinery pre-checks GREEN** (runbook 69 §1): @obs/identity 110/110 (backfill-rut DV-gate + provenance + idempotent), app 1428/1428 (incl. `name-match-rut-guard` static + `lockdown-guard` — no public surface projects `rut`), @obs/dinero 167/167 (harvest Track-A-corrobora + name-match behavior + parse-servel/chilecompra). First app run showed 3 timeout-flakes under load; clean re-run 1428/1428.
- **Baseline captured** (live read-only): RUT 0/186, votos 283.550 confirmado / 266.189 no_confirmado, ChileCompra 0, SERVEL 0.
- **Consolidated `111-OPERATOR-CHECKPOINT.md`** — hard-order steps (RUT-01 → votos 66/67 → ChileCompra 70 → SERVEL 71) with invariants + resume signals, pointing to the existing runbooks.

## Operator decision (2026-07-27)
Operator chose **"Defer all LIVE writes — handoff"**. RUT-01 + all backfills = documented operator debt. Nothing written to PROD; agent wrote NO RUT, ran NO crawl, consumed NO quota, placed NO .xlsx. MONEY stays OFF.

## Deferred operator debt (blocking-human, LOCAL, ready)
1. **RUT-01** (V7-02) — populate `parlamentario-rut.seed.json` (real DV-valid RUTs + provenance) + run LOCAL invoker against REMOTE. GAP: invoker CLI not yet built (agent offered to build on request; operator deferred). Runbook 69.
2. **Votos** (V7-03) — Cámara (66) + Senado (67), `VOTOS_LIVE=1`, rate-limit 2-3s. Invariants: dipids_maestra_no_confirmado=0, `<SELECCION>` tokens.
3. **Dinero** (V7-04) — ChileCompra (70, POST RUT-01, quota 10k/day) + SERVEL (71, .xlsx to R2). 

Resume: report per step coverage N/M + invariants, or describe blocker; "build the invoker CLI" to have the agent materialize the RUT-01 GAP piece.

**Status:** agent-prepared half done; V7-02/03/04 = operator debt deferred (documented handoff, pattern v7/v9/v10).
