---
phase: 87
slug: b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix
status: draft
nyquist_compliant: false
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
| (rellenado por el planner) | | | RETR-01, RETR-02, RETR-05 | migración 0055 aditiva; RPC definer PII-safe sin grant anon | boletín siempre #1; literal siempre encuentra; golden no regresiona | unit + pgTAP + live-gated | `pnpm test` / psql pgTAP / golden CLI | ✅ | ⬜ pending |

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
