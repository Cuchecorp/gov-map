---
phase: 71
slug: dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 71 — Validation Strategy

> SERVEL has NO RUT — the candidate link is by NAME via the deterministic pipeline (determinista→FK, else null). The wire + LOCAL R2 mode + freshness are offline-testable; obtaining the real .xlsx per election is operator toil. Built behind MONEY gate OFF.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ exceljs for a fake .xlsx fixture built in-test) |
| **Quick run** | `pnpm --filter @obs/dinero test` |
| **Freshness** | `pnpm --filter @obs/freshness test` + `pnpm freshness` |
| **Typecheck** | `tsc -b` |
| **LOCAL ingest (operator)** | operator places the real `.xlsx` in R2 per election; `--from-r2` re-runs Stage 2 |

---

## Sampling Rate

- After every task commit: `pnpm --filter @obs/dinero test` + typecheck.
- After wave: `pnpm test` + freshness.
- Before verify: wire tests green + cut-date visible + gate OFF.

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| SERVEL routes through Etapa-1-R2-first (`putImmutable("servel", eleccion, fecha, sha, "xlsx", bytes)`) then Stage-2; LOCAL `--from-r2` reads the operator-placed .xlsx bytes from R2 without re-touching the source | MONEY-02, DEBT-01 | unit (fake R2 + fake xlsx) | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Candidate→parliamentarian link by NAME via the deterministic pipeline: only `determinista` mints the FK, everything else → `parlamentario_id NULL` (never false-by-name); reconciler untouched | MONEY-02 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Cut-date + election/period VISIBLE per datum (`aporte.eleccion` NOT NULL + `fecha_corte`); never old-as-current | MONEY-02 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| `ServelBloqueadaError` degrades THAT election/file without aborting the whole run (fail-soft per election) | MONEY-02 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Behind `MONEY_PUBLIC_ENABLED` OFF; anti-flip guard green; aportes in DB not publicly presented | MONEY-02 | guard | `pnpm --filter @obs/dinero test` | ⬜ pending |
| SERVEL freshness staleness signal (LOCAL, no cron → workflowYml n/d honest) | MONEY-02 | unit | `pnpm --filter @obs/freshness test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] FakeR2Store + a fake `.xlsx` fixture built in-test with exceljs (row-4 headers) for the LOCAL `--from-r2` + parse tests.

*Existing: connector-servel/parse-servel (exceljs), reconciliar-aporte (name/determinista), table aporte 0024 (eleccion + fecha_corte), ServelBloqueadaError, MONEY gate + anti-flip guard, Phase 70 dinero R2 wire mold, freshness pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Obtain + place the real SERVEL `.xlsx` per election in R2, run Stage 2 | MONEY-02 SC#1 | SERVEL LOCAL per election (no stable feed, no cron); operator toil; needs the actual artisanal .xlsx | Operator downloads the SERVEL .xlsx for an election, places it in R2 (content-addressed), runs `--from-r2`; freshness SERVEL moves off n/d. |

---

## Validation Sign-Off

- [ ] Etapa-1-R2-first + LOCAL `--from-r2` proven with fake R2 + fake .xlsx
- [ ] Name/deterministic link fail-closed (determinista→FK, else null); reconciler/model/0024 git diff empty
- [ ] Cut-date + election visible per datum
- [ ] ServelBloqueadaError fail-soft per election
- [ ] MONEY gate OFF; freshness SERVEL signal
- [ ] Operator .xlsx toil runbook
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
