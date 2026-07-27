---
phase: 70
slug: dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 70 — Validation Strategy

> Pure wire: add Etapa-1 R2 to `dinero/ingest-run.ts` (mirror Phase 66). Everything offline-testable with fakes; the quota-limited LIVE crawl is operator-LOCAL. Built behind MONEY gate OFF.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Quick run** | `pnpm --filter @obs/dinero test` |
| **Freshness** | `pnpm --filter @obs/freshness test` + `pnpm freshness` |
| **Typecheck** | `tsc -b` |
| **LIVE crawl (operator-LOCAL)** | quota 10k/day, `MERCADOPUBLICO_TICKET`, serial per-RUT 2-3s |

---

## Sampling Rate

- After every task commit: `pnpm --filter @obs/dinero test` + typecheck.
- After wave: `pnpm test` + freshness.
- Before verify: wire tests green + redaction proven + gate OFF confirmed.

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| `runIngestDinero` adds Etapa-1 R2 (content-addressed, put-gates-upsert) then Etapa-2; `--from-r2` replay w/ fake connector (no source fetch) — mirror Phase 66 fake-R2Store | MONEY-01, DEBT-01 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Juridica reconciles ONLY by exact RUT fail-closed; no `correrPipeline`/LLM/name-match on that branch (reuse P69 brand); RUT absent → null, never false-by-name | MONEY-01 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Behind `MONEY_PUBLIC_ENABLED` OFF: contracts land in DB but are NOT publicly presented; guard anti-flip intact | MONEY-01 | unit/guard | `pnpm --filter @obs/dinero test` + guard | ⬜ pending |
| `MERCADOPUBLICO_TICKET` REDACTED in logs (never plaintext) via `redactarTicket` | MONEY-01 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Monto stored VERBATIM string (not re-parsed to a number that alters the source datum) | MONEY-01 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| freshness ChileCompra staleness signal | MONEY-01 | unit | `pnpm --filter @obs/freshness test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] Fake R2Store + fake ChileCompra connector for the Etapa-1-first + `--from-r2` tests (mirror Phase 66).

*Existing: connector-chilecompra, reconciliar-contrato (RUT-exact, frozen P69), tables 0023, `redactarTicket`, MONEY gate + anti-flip guard, freshness pattern, `runIngest` two-stage mold in tramitacion.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| At-scale LIVE ChileCompra crawl by RUT | MONEY-01 SC#4 | Quota 10k/day non-modifiable; ticket; operator-LOCAL multi-day resumable; needs RUT-01 populated (Phase 69 pending) | Operator runs the per-RUT crawl LOCAL over multiple days per the runbook, `--from-r2` replay for Stage 2, then freshness staleness. |
| OCDS monthly bulk parser (quota-skipping) | MONEY-01 | Deferred — bulk JSONL parser out of scope | Documented as a future option in the runbook. |

---

## Validation Sign-Off

- [ ] Etapa-1-first proven with a fake R2Store; `--from-r2` skips source fetch
- [ ] RUT-exact fail-closed on juridica branch (no name-match/LLM); reconciler git diff empty
- [ ] MONEY gate OFF; anti-flip guard green
- [ ] Ticket redaction proven; monto VERBATIM
- [ ] freshness ChileCompra signal
- [ ] Operator LIVE crawl runbook; quota documented
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
