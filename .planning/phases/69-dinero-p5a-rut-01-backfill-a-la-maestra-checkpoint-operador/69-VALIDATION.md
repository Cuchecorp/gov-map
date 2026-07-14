---
phase: 69
slug: dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 69 — Validation Strategy

> RUT is PII and defamation-critical (a name-match writing a RUT = false financial attribution). The mechanism exists; this phase adds the guard, the honest coverage measure, and the operator runbook. The remote write is operator-only.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Quick run** | `pnpm --filter @obs/dinero test` + `pnpm --filter ./app test` (guards) |
| **Freshness** | `pnpm --filter @obs/freshness test` + `pnpm freshness` |
| **Typecheck** | `tsc -b` |
| **Remote write (operator-LOCAL)** | `runBackfillRut` via db-url — NOT run by the agent |

---

## Sampling Rate

- After every task commit: touched-package test + typecheck.
- After wave: `pnpm test` + guards green.
- Before verify: guard bites (mutation self-check) + coverage declared.

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| DV-gate módulo-11 (`isRutValido`) enforced before any RUT write; invalid DV never written; provenance NOT NULL | RUT-01 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |
| Name-match NEVER writes maestra `rut`: name-derived RUT → `revisionesRut`/`enqueueRevision` (human queue); `cosechas`/`updateRut` fires only when a matching RUT is ALREADY present (corroboration). Guard test + mutation self-check | RUT-01 | guard test | `pnpm --filter ./app test` | ⬜ pending |
| RUT never in a public RPC/route/projection nor an LLM prompt (`assertNoRutInLlmInput` fail-closed; lockdown-guard scans app/ for rut projection); RLS deny-by-default | RUT-01 | guard test | `pnpm --filter ./app test` | ⬜ pending |
| RUT DV-valid coverage N/M measured + declared as honest ceiling by cause (no-data / invalid-DV / ambiguity), both `entidad_tercero` + `parlamentario` | RUT-01 | unit + freshness | `pnpm --filter @obs/freshness test` + `pnpm freshness` | ⬜ pending |
| Track B (seed) default write; Track A (SERVEL) corroborates, does not blind-overwrite | RUT-01 | unit | `pnpm --filter @obs/dinero test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] `app/lib/name-match-rut-guard.test.ts` — guard-guardian (name-match≠write-rut) + mutation self-check, mirroring `lockdown-guard.test.ts`.
- [ ] `packages/freshness` `COBERTURA_RUT_SENALES` + `queryCoberturaRut` + `renderCoberturaRut` (mirror COBERTURA_VOTO_SENALES).

*Existing: `isRutValido` (módulo-11), `runHarvestRut`/`runBackfillRut`, `SpyRutWriter`, `assertNoRutInLlmInput`, RLS 0005/0018/0034, lockdown-guard.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Remote RUT backfill write to the maestra | RUT-01 | Operator checkpoint (bloqueante duro); remote db-url write; no `.env` cred by design; PII | Operator runs `runBackfillRut` via db-url per `69-BACKFILL-RUT-RUNBOOK.md` (Track B seed default + Track A SERVEL corroboration, DV-gate), then reports coverage N/M. |

---

## Validation Sign-Off

- [ ] Guard bites (mutation self-check proves a name→rut write is caught)
- [ ] DV-gate + provenance-NOT-NULL enforced in the writer path
- [ ] RUT confirmed absent from public routes/RPCs/LLM (guards green)
- [ ] Coverage N/M declared (both maestras) as honest ceiling
- [ ] Operator runbook written; remote write deferred
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
