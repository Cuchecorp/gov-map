---
phase: 103
slug: notif-p3a-suscripciones-digest-guards-authenticated-gate-legal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `103-RESEARCH.md` §Validation Architecture — planner must map every task to it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + packages) · pgTAP (supabase/tests) |
| **Config file** | `app/vitest.config.ts`, per-package vitest configs |
| **Quick run command** | `pnpm --filter <pkg> test` (package touched) |
| **Full suite command** | `pnpm -w test` |
| **Estimated runtime** | ~120 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the touched package's vitest suite (`pnpm --filter <pkg> test`); for migrations, run the matching pgTAP file via `psql -tA -f`
- **After every plan wave:** Run `pnpm -w test`
- **Before verify-work:** Full suite + lockdown-guard + anti-flip guards green
- **Max feedback latency:** ~180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills — every NOTIF-01..05 criterion must map to a row per RESEARCH §Validation Architecture) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/lib/lockdown-guard.test.ts` — extensión rol `authenticated` (allowlist USER_OWNED_TABLES + mutation self-check) escrita RED-first ANTES de cualquier migración 0069+
- [ ] pgTAP dos-usuarios (`set local role authenticated` + `request.jwt.claims` con `sub` distinto) — usuario-A-no-ve-B sobre `suscripcion`
- [ ] Guard anti-flip NOTIF (clon de `vsim-antiflip-guard.test.ts`) — `.env.example` queda `NOTIF_PUBLIC_ENABLED=false`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provisión SUPABASE_PUBLISHABLE_KEY + plantilla OTP + evidencia SC2 | NOTIF-01 | Credencial de operador (dashboard Supabase + wrangler secret) | 97-DEPLOY-RUNBOOK.md §runtime pendiente + 97-SPIKE-EVIDENCE.md §Reproducción SC2 (curl block) |
| Dominio de envío verificado en Resend + RESEND_API_KEY | NOTIF-03 | Cuenta Resend del operador | Checkpoint operador al final de fase; sin dominio → dry-run only |
| Email real recibido (doble opt-in + digest + unsubscribe) | NOTIF-03/04 | Requiere bandeja real | UAT operador post-provisión |
