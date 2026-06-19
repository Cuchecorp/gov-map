---
phase: 9
slug: completitud-de-identidad-backfill-rut-invariante-de-writer-piso-pii
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 9 — Validation Strategy

> Per-phase validation contract. Generalizing the identity guard before any new attribution dataset writes.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS) + pgTAP (DB) |
| **Config file** | workspace vitest config; supabase pgTAP tests |
| **Quick run command** | `pnpm --filter @obs/identity test` / `pnpm --filter @obs/adjudication test` |
| **Full suite command** | `pnpm -w test` |
| **Estimated runtime** | ~30–60 s offline (pgTAP requires applied migration — operator-gated) |

---

## Sampling Rate

- **After every task commit:** run the touched package's vitest
- **After the golden-set change:** run the golden gate (≥0.95 must hold)
- **DDL/pgTAP:** run against an applied migration; gated as operator/human-verify (remote push works via `supabase db push --db-url`, local application is the carried v1.0 blocker)
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 (typed invariant) | 01 | 1 | IDENT-12 | A new `*Writer` CANNOT set `parlamentario_id` without an `EnlaceConfirmado` (compile error on raw string) | unit + type | `pnpm --filter @obs/identity test` + a `tsd`/`@ts-expect-error` compile assertion | ❌ W0 | ⬜ pending |
| 09-02 (RUT backfill) | 02 | 2 | IDENT-10 | RUT backfilled server-side, DV-validated (módulo-11), provenance per row, never fabricated; anon cannot read it | unit + pgTAP | `pnpm --filter @obs/identity test` + pgTAP anon-deny | ❌ W0 | ⬜ pending |
| 09-03 (golden set) | 02/03 | 2 | IDENT-11 | Golden set extended (homonyms, RUT collision, persona natural/jurídica, invalid DV); CI gate ≥0.95 blocks | unit | golden-set test (gate ≥0.95) | ✅ exists | ⬜ pending |
| 09-04 (RLS/PII floor) | 03 | 2 | LEGAL-03 | New PII columns deny-by-default to anon (mirror 0005); `assertNoRutInLlmInput`/`assertSensitivityAllowed` cover new PII | pgTAP + unit | pgTAP RLS-enabled/zero-policy + `@obs/llm` test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Type-level test that a raw-string FK is a compile error (proves the branded invariant structurally)
- [ ] pgTAP asserting `parlamentario.rut` + any new PII column are anon-denied (mirror `0004_parlamentario.test.sql`)
- [ ] Golden-set cases for DV/homonym/persona — reuse existing `isRutValido` (módulo-11, already in `@obs/identity`)

*Reuses existing vitest + golden gate + pgTAP infra; `isRutValido` already exists.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied to the DB (local/remote) so pgTAP can run | LEGAL-03, IDENT-10 | Remote push works via `supabase db push --db-url`; local application is the carried v1.0 blocker; build/typecheck do NOT prove DDL applied (false-positive) | Operator applies the migration, then runs pgTAP; record result |
| RUT source result (SERVEL Track A) | IDENT-10 | Live SERVEL reachability is non-deterministic; Track B (curated list + provenance) is the guaranteed fallback | If Track A unreachable, populate via curated list with provenance; never fabricate a RUT |

---

## Validation Sign-Off

- [ ] Typed invariant proven structurally (compile-time test)
- [ ] RUT backfilled (Track A or B) + DV-validated + anon-hidden (pgTAP, operator-applied)
- [ ] Golden set extended; gate ≥0.95 green
- [ ] New PII anon-hidden + data-routing covers it
- [ ] `nyquist_compliant: true` set at execution

**Approval:** pending
