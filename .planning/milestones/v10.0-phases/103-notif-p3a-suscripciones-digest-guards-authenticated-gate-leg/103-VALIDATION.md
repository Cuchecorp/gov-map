---
phase: 103
slug: notif-p3a-suscripciones-digest-guards-authenticated-gate-legal
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-26
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `103-RESEARCH.md` §Validation Architecture — planner maps every task to it.

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
| P01-T1 | 01 | 1 | NOTIF-02 | T-103-01, T-103-02, T-103-23 | lockdown-guard bites `authenticated` over-grants (Block D) + notificacion_envio zero-grant (Block E); tolerates notif-service.ts | guard (static scan + self-check) | `cd app && pnpm test -- --run lockdown-guard` | app/lib/lockdown-guard.test.ts | ⬜ pending |
| P01-T2 | 01 | 1 | NOTIF-05 | T-103-03 | NOTIF flag single strict `=== "true"`; anti-flip Vectors 1-3 + self-check; .env.example=false | guard (3-vector + self-check) | `cd app && pnpm test -- --run notif-antiflip-guard` | app/lib/notif-gate.ts, app/lib/notif-antiflip-guard.test.ts, .env.example | ⬜ pending |
| P02-T1 | 02 | 2 | NOTIF-01, NOTIF-04 | T-103-04, T-103-05, T-103-07 | suscripcion + consentimiento RLS `to authenticated` `(select auth.uid())=user_id`, deny-by-default, cascade | migration (grep gate + pgTAP downstream) | `cd "…/Observatorio" && bash -c "grep -v '^--' supabase/migrations/0069_suscripcion_rls.sql | grep -c 'to authenticated'"` | supabase/migrations/0069_suscripcion_rls.sql, 0071_consentimiento.sql | ⬜ pending |
| P02-T2 | 02 | 2 | NOTIF-02, NOTIF-04 | T-103-06 | notificacion_envio service_role-only queue, ZERO authenticated grant, idempotent cursor column | migration (grep gate) | `cd "…/Observatorio" && bash -c "grep -v '^--' supabase/migrations/0070_notificacion_envio.sql | grep -ci 'to authenticated'"` (=0) | supabase/migrations/0070_notificacion_envio.sql | ⬜ pending |
| P02-T3 | 02 | 2 | NOTIF-01, NOTIF-04 | T-103-04, T-103-05, T-103-06, T-103-07 | two-user pgTAP: A-no-ve-B, B-no-borra-A, anon zero-select, queue zero-grant, consent shape | pgTAP (applied schema) | `cd "…/Observatorio" && bash -c "test -f supabase/tests/0069_suscripcion_rls.test.sql && grep -c 'set local role authenticated' supabase/tests/0069_suscripcion_rls.test.sql"` then `psql -tA -f` each | supabase/tests/0069_*, 0070_*, 0071_*.test.sql | ⬜ pending |
| P03-T1 | 03 | 3 | NOTIF-01, NOTIF-05 | T-103-08, T-103-09, T-103-11 | OTP via /cuenta (validate-before-GoTrue, generic error); seguir derives user_id from getClaims() (Pitfall 5); flag OFF hides surface; NOTIF surfaces in linter | vitest RTL + linter | `cd app && pnpm test -- --run cuenta anti-insinuacion` | app/app/cuenta/{page,actions}.tsx, cuenta.test.tsx, app/lib/anti-insinuacion-guard.test.ts | ⬜ pending |
| P03-T2 | 03 | 3 | NOTIF-04 | T-103-10, T-103-22 | opaque token (randomBytes+sha256, hash-at-rest); login-less confirmar/baja via dedicated notif-service.ts (not supabase.ts); noindex; one-click baja | vitest + guard regression | `cd app && pnpm test -- --run notificaciones lockdown-guard` | app/app/notificaciones/{token.ts,confirmar,baja,notificaciones.test.ts}, app/lib/notif-service.ts | ⬜ pending |
| P03-T3 | 03 | 3 | NOTIF-01, NOTIF-05 | T-103-11 | Seguir button absent from DOM when flag OFF (return null); mounted both fichas; /spike-auth deleted | vitest RTL + fs + tsc | `cd app && pnpm test -- --run seguir-button 2>&1 | tail -15 && test ! -d app/app/spike-auth && cd app && pnpm exec tsc --noEmit` | app/components/seguir-button.{tsx,test.tsx}, proyecto/[boletin]/page.tsx, parlamentario/[id]/page.tsx | ⬜ pending |
| P04-T1 | 04 | 3 | NOTIF-03, NOTIF-04 | T-103-14, T-103-15, T-103-13, T-103-21 | per-type novedad query (proyecto→tramitacion_evento; parlamentario→proyecto_autor confirmado→tramitacion_evento); idempotent cursor; 100/day cap; redactEmail | vitest (fake db) | `cd "…/Observatorio" && pnpm --filter @obs/notificaciones test` | packages/notificaciones/src/digest.ts, digest.test.ts | ⬜ pending |
| P04-T2 | 04 | 3 | NOTIF-03, NOTIF-04 | T-103-13, T-103-14 | Resend send via fetch (List-Unsubscribe One-Click); dry-run when key absent; 429-safe; no raw email in logs | vitest | `cd "…/Observatorio" && pnpm --filter @obs/notificaciones test` | packages/notificaciones/src/resend.ts, run-digest-prod-cli.ts, resend.test.ts | ⬜ pending |
| P04-T3 | 04 | 3 | NOTIF-03 | T-103-16 | digest-daily.yml gated (dispatch-only), EGRESO header, RESEND_API_KEY secret, pinned SHAs | yaml grep gate | `cd "…/Observatorio" && bash -c "grep -c 'workflow_dispatch' .github/workflows/digest-daily.yml && grep -c 'EGRESO' .github/workflows/digest-daily.yml && grep -c 'RESEND_API_KEY' .github/workflows/digest-daily.yml"` | .github/workflows/digest-daily.yml | ⬜ pending |
| P05-T1 | 05 | 4 | NOTIF-05 | T-103-17, T-103-24 | legal dossier signoff:approved; DEPLOY-RUNBOOK incl. first-class Flag-OFF closure (NOTIF-05 fallback) | docs grep gate | `cd "…/Observatorio" && bash -c "test -f docs/legal/103-LEGAL-DOSSIER-NOTIF.md && grep -ci 'signoff' docs/legal/103-LEGAL-DOSSIER-NOTIF.md && grep -ci 'Flag-OFF closure' .planning/phases/103-*/103-DEPLOY-RUNBOOK.md"` | docs/legal/103-LEGAL-DOSSIER-NOTIF.md, 103-DEPLOY-RUNBOOK.md | ⬜ pending |
| P05-T2 | 05 | 4 | NOTIF-01, NOTIF-03 | T-103-19 | migrations applied to PROD; post-apply pgTAP green (RLS isolation on PROD) | checkpoint:human-verify (pgTAP on PROD) | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0069_suscripcion_rls.test.sql` (+0070/0071) | supabase/migrations/0069-0071, supabase/tests/0069-0071 | ⬜ pending (manual) |
| P05-T3 | 05 | 4 | NOTIF-01, NOTIF-05 | T-103-18, T-103-20, T-103-24 | operator provisioning + deploy + flip ON (Worker env, not .env.example) + SC2 evidence; OR Flag-OFF closure | checkpoint:human-action | Manual (97-SPIKE-EVIDENCE SC2 curl block; BrowserOS DOM check) | (runtime) | ⬜ pending (manual) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/lib/lockdown-guard.test.ts` — extensión rol `authenticated` (allowlist USER_OWNED_TABLES + mutation self-check + tolerancia notif-service.ts) escrita RED-first ANTES de cualquier migración 0069+
- [ ] pgTAP dos-usuarios (`set local role authenticated` + `request.jwt.claims` con `sub` distinto) — usuario-A-no-ve-B sobre `suscripcion`
- [ ] Guard anti-flip NOTIF (clon de `vsim-antiflip-guard.test.ts`) — `.env.example` queda `NOTIF_PUBLIC_ENABLED=false`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aplicar migraciones a PROD + pgTAP post-apply | NOTIF-01/03 | Escritura a PROD (checkpoint bloqueante) | 103-DEPLOY-RUNBOOK §(a)/(b); `psql -tA -f` cada test contra el schema aplicado |
| Provisión SUPABASE_PUBLISHABLE_KEY + plantilla OTP + evidencia SC2 | NOTIF-01 | Credencial de operador (dashboard Supabase + wrangler secret) | 97-DEPLOY-RUNBOOK.md §runtime pendiente + 97-SPIKE-EVIDENCE.md §Reproducción SC2 (curl block) |
| Dominio de envío verificado en Resend + RESEND_API_KEY | NOTIF-03 | Cuenta Resend del operador | Checkpoint operador al final de fase; sin dominio → dry-run only; sin credencial → Flag-OFF closure (§f) |
| Email real recibido (doble opt-in + digest + unsubscribe) | NOTIF-03/04 | Requiere bandeja real | UAT operador post-provisión |
| Flip ON o Flag-OFF closure según provisión | NOTIF-05 | Worker env var a deploy-time (no committeado) | 103-DEPLOY-RUNBOOK §(d) flip / §(f) Flag-OFF closure |
