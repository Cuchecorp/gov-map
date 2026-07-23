---
phase: 95
slug: seguridad-p3a-guards-extendidos-sobre-rpcs-nuevas-bounded-rp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 95 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`app/`) for guards; pgTAP (psql) for schema |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test` (all `app/lib/*guard*.test.ts`) |
| **Full suite command** | `pnpm test` (root: `packages/*` then `app/`) + `tsc --noEmit` |
| **Estimated runtime** | ~60 seconds (app suite); pgTAP post-apply <10s |

pgTAP runner real: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0064_*.test.sql` (contra schema APLICADO, nunca `supabase test db`).

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter ./app test <guard-name>` (single guard, <10s)
- **After every plan wave:** Run `pnpm --filter ./app test` + `tsc --noEmit`
- **Before `/gsd:verify-work`:** Full `pnpm test` green + pgTAP 0064 "N ok, 0 not ok" contra PROD aplicado
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 95-01-* | 01 | 1 | SEC-01 (bounded) | Pitfall 12 DoS | 10+ RPCs nuevas con statement_timeout + LIMIT + cap match_count | pgTAP | `psql -tA -f supabase/tests/post-apply/0064_*.test.sql` | ❌ W0 | ⬜ pending |
| 95-02-* | 02 | 1 | SEC-01 (allowlist B) | drift | allowlist ⊆ funciones definidas en migraciones | unit | `pnpm --filter ./app test lockdown-guard` | ❌ W0 (assert nuevo) | ⬜ pending |
| 95-02-* | 02 | 1 | SEC-01 (allowlist A) | drift | .rpc() servidas ⊆ allowlist | unit | `pnpm --filter ./app test lockdown-guard` | ✅ | ⬜ pending |
| 95-02-* | 02 | 1 | SEC-01 (anti-insin) | insinuación | superficies 89 enumeradas o factual-clean | unit | `pnpm --filter ./app test anti-insinuacion-guard` | ✅ (verificar 89) | ⬜ pending |
| 95-02-* | 02 | 1 | SEC-01 (SC#4) | guard vacío | mutation self-check muerde sobre lo NUEVO | unit | mismos comandos | Partly ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` — re-emit de las RPCs sin timeout (SC#2)
- [ ] `supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql` — has_function + prosecdef + no-anon-execute + statement_timeout por RPC
- [ ] `app/lib/lockdown-guard.test.ts` — Direction-B assert + mutation self-check
- [ ] `app/lib/anti-insinuacion-guard.test.ts` — superficie 89 si no cubierta + self-check

*Framework install: none — vitest + pgTAP already present.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apply 0064 a PROD | SEC-01 | DDL contra DB remota (precedente 0059-0063: el agente aplica aditivo por psql --single-transaction) | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0064_*.sql` y correr pgTAP post-apply |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
