# Phase 111 — RESEARCH (baseline + machinery verification)

**Gathered:** 2026-07-27 (orchestrator: live read-only baseline + offline machinery pre-checks)
**Status:** RESEARCH COMPLETE

## Baseline coverage (live read-only PROD, 2026-07-27)

| Scope | Metric | Value | Meaning |
|-------|--------|-------|---------|
| **RUT-01** | parlamentario con RUT | **0 / 186** | 0% REAL (hard blocker of ChileCompra); seed Track B empty |
| **Votos** | total / confirmado / no_confirmado | 549.739 / **283.550** / 266.189 | confirmado = techo determinista actual (Phase 98 cifra); backfills 66/67 lo AMPLÍAN |
| **ChileCompra** | contrato | **0** | needs backfill 70 (blocked by RUT-01) |
| **SERVEL** | aporte | **0** | needs .xlsx placement + backfill 71 (cruce por nombre, no RUT) |

## Machinery pre-checks (runbook 69 §1) — ALL GREEN (offline, no PROD write)

- `@obs/identity` **110/110** — `runBackfillRut` DV-gate módulo-11 + provenance NOT NULL + fail-closed + idempotente por id; `SupabaseMaestraWriter` per-fila update.
- `app` **1428/1428** (107 files) — includes `name-match-rut-guard` (static: `revisionesRut` never an arg to backfill/harvest/updateRut) + `lockdown-guard` (no public route/RPC projects `rut`). (Note: a first run under heavy concurrent load showed 3 timeout-flake failures; clean re-run = 1428/1428 green — the known full-suite 5s-timeout flake, NOT a regression.)
- `@obs/dinero` **167/167** — `harvest-rut` (Track A corrobora only) + name-match behavior companion + `parse-servel` + `parse-chilecompra`/`ingest-run` fixtures.

→ The write machinery is sound. The ONLY missing pieces are operator-supplied: real RUTs (seed) + the remote credential + the LIVE crawl runs.

## Dependency order (HARD) + who does what

1. **RUT-01 (runbook 69)** — OPERATOR write, blocking-human, gates ChileCompra.
   - GAP §0: no CLI exists to run `runBackfillRut` against REMOTE (writer defaults to LOCAL by design). Operator materializes/runs the invoker LOCAL (mold: `packages/identity/src/backfill-entidad-cli.ts`). **The agent MAY build this invoker CLI (it is code, not a RUT write) if the operator will run RUT-01 this cycle** — offered in the checkpoint.
   - Seed `supabase/seeds/parlamentario-rut.seed.json` = empty; operator populates with DV-valid RUTs + provenance. Agent NEVER writes RUT (guard-enforced).
2. **Votos Cámara (66)** + **Senado (67)** — OPERATOR LIVE (`VOTOS_LIVE=1`, rate-limit 2-3s, curl-first WAF, dos-etapas R2). Independent of RUT. Invariants: `dipids_maestra_no_confirmado=0` (Cámara determinista), tokens `<SELECCION>` confirmed (Senado).
3. **ChileCompra (70)** — OPERATOR LIVE, POST RUT-01 (needs RUT universe). Quota 10k/day resumable, ticket `MERCADOPUBLICO_TICKET` in .env, multi-day partition.
4. **SERVEL (71)** — OPERATOR: Etapa 1 = place .xlsx content-addressed in R2 (acto humano); then backfill (cruce por nombre determinista, no RUT).

## Invariants the agent verifies AFTER each operator run (read-only)
- RUT: `pnpm freshness` COBERTURA_RUT N/M rose honestly; counts-only, `rut` not readable by anon (RLS).
- Votos: COBERTURA_VOTO N/M; `dipids_maestra_no_confirmado=0`; Senado tokens confirmed.
- Dinero: contrato/aporte counts; MONEY_PUBLIC_ENABLED stays OFF (flip = Phase 112).

## LOCKED
- Agent JAMÁS writes RUT / touches write db-url / runs LIVE crawls / consumes quota / places .xlsx. RUT never to anon/LLM/public. Backfill = LOCAL operator, never GitHub Actions. Coverage DECLARED (N/M); "sin dato" ≠ "sin vínculos".

## Requirements mapped
- **V7-02** (RUT-01), **V7-03** (votos backfills), **V7-04** (dinero backfills). All operator blocking-human; agent prepares/verifies.

## RESEARCH COMPLETE
