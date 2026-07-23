---
phase: 97
slug: auth-p0-spike-auth-on-workers-de-risk
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 97 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 97-RESEARCH.md §Validation Architecture; the planner refines the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + packages, existente) |
| **Config file** | app/vitest.config.ts (existente) |
| **Quick run command** | `pnpm --filter app test` |
| **Full suite command** | `pnpm test && pnpm -r exec tsc --noEmit` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter app test`
- **After every plan wave:** Run full suite + `tsc --noEmit` + `pnpm audit`
- **Before `/gsd:verify-work`:** Full suite green + deploy real verificado
- **Max feedback latency:** ~180 seconds (deploy real excluido — gate manual/curl)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (el planner completa) | — | — | AUTH-01 | — | sesión RLS-gated, sin service_role en cliente, anon legacy muerta | curl + suite | ver §Manual-Only | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (vitest ya instalado; el spike añade tests unitarios mínimos si aplica).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Set-Cookie `sb-*` emitido en deploy real | AUTH-01 | requiere deploy OpenNext real + OTP email | curl -c jar contra workers.dev tras verifyOtp; inspeccionar cookies |
| Refresh de sesión sobrevive pipeline | AUTH-01 | requiere expiry real / intercambio refresh_token | segunda request con jar tras expiry corto; verificar nueva access token |
| Sin cache-leak de sesión entre usuarios | AUTH-01 (seguridad) | comportamiento de CDN/worker real | test dos-jars: jar A autenticado, jar B anónimo — respuestas no cruzadas |
| Build OpenNext no roto por middleware | AUTH-01 | Docker build + wrangler deploy | runbook 61-02; build verde + sitio sirve |
