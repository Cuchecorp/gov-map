# 111 — Operator checkpoint: RUT-01 + backfills LIVE (votos + dinero)

**Phase:** 111 · **Requirements:** V7-02/03/04 · **Gate:** blocking-human (LOCAL, never CI)
**Prepared:** 2026-07-27 — machinery verified green; baseline captured. The agent NEVER writes RUT, runs LIVE crawls, consumes quota, or places .xlsx.

Do these in the HARD order below. Each is an operator LOCAL act. After each, the agent verifies coverage N/M + invariants (read-only).

---

## Baseline TODAY (live read-only)
- RUT-01: **0 / 186** parlamentarios (seed empty).
- Votos: 283.550 confirmado / 266.189 no_confirmado (549.739 total).
- ChileCompra contrato: **0**. SERVEL aporte: **0**.

## Machinery: GREEN (agent-verified offline)
- @obs/identity 110/110 · app 1428/1428 (name-match-rut + lockdown guards) · @obs/dinero 167/167.

---

## STEP 1 — RUT-01 (runbook `69-BACKFILL-RUT-RUNBOOK.md`) — GATES ChileCompra
1. Populate `supabase/seeds/parlamentario-rut.seed.json` with real DV-valid RUTs + provenance (`{id,rut,origen,fecha_captura,enlace}`). NEVER fabricate/placeholder — the DV-gate rejects invalids fail-closed.
2. Materialize/run the LOCAL invoker (GAP §0 — mold `packages/identity/src/backfill-entidad-cli.ts`): read seed → `runBackfillRut(filas, SupabaseMaestraWriter pointed at REMOTE via db-url)`. **The agent can build this invoker CLI on request** (code, not a RUT write) — say so at resume.
3. Verify destination log says REMOTE/PROD before writing. Log counts only (`escritas`/`rechazadas`), never a RUT in clear.
4. Confirm coverage via `pnpm freshness` COBERTURA_RUT (N/M rose); `rut` not readable by anon (RLS).

## STEP 2 — Votos Cámara (runbook `66-BACKFILL-RUNBOOK.md`) — independent of RUT
- `VOTOS_LIVE=1` + `--boletines-file`, rate-limit 2-3s, curl-first WAF, dos-etapas R2. Report COBERTURA_VOTO N/M + invariant `dipids_maestra_no_confirmado=0`.

## STEP 3 — Votos Senado (runbook `67-BACKFILL-SENADO-RUNBOOK.md`)
- `VOTOS_LIVE=1`, confirm `<SELECCION>` tokens LIVE. Report N confirmado / M probable / K no_confirmado + SC#4 `senado_no_confirmado_con_fk=0`.

## STEP 4 — ChileCompra por RUT (runbook `70-BACKFILL-CHILECOMPRA-RUNBOOK.md`) — POST RUT-01
- Quota 10k/day resumable (`--ruts-file`/`--dia`/`--from-r2`), ticket `MERCADOPUBLICO_TICKET` (in .env), rate-limit 2-3s. Report contrato count. Needs RUT universe (Step 1) first.

## STEP 5 — SERVEL .xlsx (runbook `71-BACKFILL-SERVEL-RUNBOOK.md`) — no RUT
- Etapa 1 = place election .xlsx content-addressed in R2 (`servel/<eleccion>/<fecha>/<sha>.xlsx`); then backfill (cruce por nombre determinista). Report aporte count.

---

## MONEY stays OFF
`MONEY_PUBLIC_ENABLED` remains OFF through this phase (flip = Phase 112, only after 21.719 legal sign-off).

## RESUME SIGNAL
Report per step: coverage N/M + invariants, OR "mechanism ready, LIVE write deferred" (checkpoint = operator debt, does not block phase closure), OR describe the blocker. For RUT-01 you may also say "build the invoker CLI" and the agent will materialize it.
