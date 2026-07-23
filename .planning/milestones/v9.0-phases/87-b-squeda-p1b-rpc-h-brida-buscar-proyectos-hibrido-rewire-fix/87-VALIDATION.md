---
phase: 87
slug: b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-21
---

# Phase 87 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + packages) + pgTAP (supabase/tests, psql runner) |
| **Config file** | app/vitest.config.ts · packages/fichas/vitest.config.ts (+ vitest.live.config.ts) |
| **Quick run command** | `pnpm --filter <paquete-tocado> test` / `cd app && pnpm test` |
| **Full suite command** | `pnpm test` (app 991+) + packages + `tsc --noEmit` |
| **Estimated runtime** | ~150 seconds |

---

## Sampling Rate

- **After every task commit:** quick command del paquete tocado
- **After every plan wave:** `pnpm test` + tsc
- **Before `/gsd:verify-work`:** full suite green + pgTAP post-apply verdes contra PROD + golden live test corrido
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | RETR-01,02,05 | T-87-01/02/03/04 | RPC definer PII-safe, doble-revoke, LEFT JOIN, config qualified | migración + pgTAP | grep-gate seguridad sobre 0055 | ✅ | ⬜ pending |
| 01-T2 | 01 | 1 | RETR-05 | T-87-01 | 0055 aplicada aditiva, anon denegado en PROD | pgTAP post-apply | `psql -tA -f 0055_...test.sql` (5/5) | ✅ | ⬜ pending |
| 02-T1 | 02 | 1 | RETR-01,05 | T-87-05 | flag fail-closed server-only; detector 3 formatos | unit offline | `cd app && pnpm test busqueda-hibrida-gate boletin-detector` | ✅ | ⬜ pending |
| 02-T2 | 02 | 1 | RETR-01,05 | T-87-06/07/08 | rewire por flag + redirect punteado + allowlist | unit + guard CI | `cd app && pnpm test buscar lockdown-guard` | ✅ | ⬜ pending |
| 03-T1 | 03 | 2 | RETR-05 | T-87-09 | harness mide RPC real, vector parametrizado | unit + live-gated | `cd packages/fichas && pnpm test spike` | ✅ | ⬜ pending |
| 03-T2 | 03 | 2 | RETR-05 | T-87-10 | gate de dominancia LIVE + decisión flip | checkpoint human-verify | golden CLI LIVE vs baseline 86 | ✅ | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers phase requirements (vitest + pgTAP post-apply pattern + golden live harness del spike 86).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aplicación de 0055 a PROD | RETR-05 | psql contra DB viva con creds .env | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0055_*.sql` + pgTAP post-apply |
| Gate de dominancia (golden vs RPC real) | RETR-05 | requiere DB+Gemini creds | CLI spike modo rpc-hibrida; comparar vs baseline 86-SCORING |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
