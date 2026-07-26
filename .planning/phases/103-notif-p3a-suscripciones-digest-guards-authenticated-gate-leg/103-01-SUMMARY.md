---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
plan: 01
subsystem: security-guards
tags: [ci-guard, lockdown, authenticated-role, feature-flag, anti-flip, notif]
requires: []
provides:
  - "authenticatedGrantOffenders (Block D allowlist + Block E queue zero-grant) in lockdown-guard.test.ts"
  - "USER_OWNED_TABLES allowlist (suscripcion/consentimiento)"
  - "NOTIF_SERVICE_TS tolerance path for Plan 03's notif-service.ts"
  - "notifPublicEnabled() chokepoint (app/lib/notif-gate.ts)"
  - "notif-antiflip-guard.test.ts (3-vector guard + mutation self-check)"
  - ".env.example NOTIF_PUBLIC_ENABLED=false + RESEND_API_KEY="
affects:
  - "supabase/migrations/*.sql (Plan 02: Block D bites over-grants to authenticated)"
  - "app/lib/notif-service.ts (Plan 03: explicitly tolerated by the .from() scope)"
  - "packages/notificaciones (Plan 04: RESEND_API_KEY consumer)"
tech-stack:
  added: []
  patterns:
    - "positive allowlist inversion of anonGrantOffenders for the authenticated role"
    - "flag chokepoint + 3-vector anti-flip guard (clone of vsim-gate/vsim-antiflip)"
    - "mutation self-check exercising the real detector in-memory (no green no-op)"
key-files:
  created:
    - app/lib/notif-gate.ts
    - app/lib/notif-antiflip-guard.test.ts
  modified:
    - app/lib/lockdown-guard.test.ts
    - .env.example
decisions:
  - "USER_OWNED_TABLES = {suscripcion, consentimiento} ONLY — notificacion_envio is service_role-only (Block E), never allowlisted for authenticated"
  - "user-table .from() prohibition scoped to app/lib/supabase.ts; notif-service.ts (Plan 03) tolerated via NOTIF_SERVICE_TS allowlist path"
  - "NOTIF flip is operator PRE-AUTHORIZED but stays deploy-time only; .env.example=false, anti-flip strictness identical to VSIM"
metrics:
  duration: ~10 min
  completed: 2026-07-26
  tasks: 2
  files: 4
---

# Phase 103 Plan 01: NOTIF guards (authenticated lockdown + flag anti-flip) Summary

Landed the CI guardrails that must exist BEFORE any user data reaches PROD: extended the lockdown-guard to the `authenticated` role (Block D positive allowlist + Block E queue zero-grant + mutation self-check) as the FIRST commit, and added the NOTIF feature-flag chokepoint + 3-vector anti-flip guard + `.env.example` entries the later plans consume.

## What was built

### Task 1 — Lockdown-guard extended to the `authenticated` role (commit 6cf3bbc)

The existing guard forbade only `to anon`/`to public`; `authenticated` (introduced for the first time this phase) was invisible to it (Pitfall 1 — a silent over-grant hole). Added to `app/lib/lockdown-guard.test.ts`:

- **`USER_OWNED_TABLES = new Set(["suscripcion", "consentimiento"])`** — positive allowlist next to `PII_TABLES`. NOT `notificacion_envio` (service_role-only queue).
- **`authenticatedGrantOffenders(strippedLowerSql, allowlist)`** — clones `anonGrantOffenders` but INVERTS to a positive allowlist: a `grant … to authenticated` OR `create policy … to authenticated` whose target table is not in the allowlist is an offender. Extracts the target table per statement (token after `on [table] public.` for grants; after `on public.` before `for`/`to` for policies). Reuses the `stripSqlComments` + `split(";")` per-statement loop.
- **Block D** — scans every migration >0044 and asserts 0 offenders. RED-capable: bites the migrations Plan 02 will write if they grant `authenticated` outside the allowlist. Today there is no migration >0068 with `to authenticated`, so the scan is green.
- **Block E** — explicit named tests asserting a `grant … on notificacion_envio to authenticated` fixture (select/insert/update/delete/all) is always flagged, plus a real scan of migrations >0044.
- **Mutation self-check** — exercises the REAL `authenticatedGrantOffenders` object on fixtures: `proyecto` → 1 offender, `notificacion_envio` → 1 offender, `suscripcion`/`consentimiento` policies → 0 offenders, comment-only line → 0 offenders (stripSqlComments removes it).
- **`.from()` chokepoint** — kept scoped to `app/lib/supabase.ts` (never `.from()`s suscripcion/consentimiento/notificacion_envio), added an app-tree assertion that `notificacion_envio` is never `.from()`'d anywhere, and a `NOTIF_SERVICE_TS` allowlist path + comment documenting that `app/lib/notif-service.ts` (Plan 03's dedicated service_role helper) is the ONE sanctioned exception any future broadened scan must skip.

Result: 22 tests in the file green (up from the prior set).

### Task 2 — NOTIF flag chokepoint + anti-flip guard + .env.example (commit b4331db)

- **`app/lib/notif-gate.ts`** — clones `vsim-gate.ts`: `import "server-only"` + `notifPublicEnabled(env) => env.NOTIF_PUBLIC_ENABLED === "true"`. Full JSDoc doctrine, with the explicit DISTINCTION documented: the operator PRE-AUTHORIZED the flip this run, but `.env.example` stays `=false` and the flip happens at deploy-time (Worker env var), never committed.
- **`app/lib/notif-antiflip-guard.test.ts`** — clones `vsim-antiflip-guard.test.ts` wholesale: `stripTsComments`, `walkSourceFiles`+`SKIP_DIRS`, `RAW_ENV_ALLOWLIST` (rel `lib/notif-gate.ts`), `detectarRelajacionGate` (V1a-V1d + V2a/V2b), `detectarRawEnvEnRuta`, the three Vector describe blocks (scanning BOTH `app/` and `packages/`), and the §4 mutation self-check. 20 tests green.
- **`.env.example`** — added `NOTIF_PUBLIC_ENABLED=false` (after the VSIM block, with a mirroring comment noting the deploy-time-flip distinction) and `RESEND_API_KEY=` (empty; consumed by Plan 04's dry-run and Plan 05's deploy).

## Verification

- `pnpm exec vitest run lib/lockdown-guard.test.ts` → 22/22 green
- `pnpm exec vitest run lib/notif-antiflip-guard.test.ts` → 20/20 green
- Focused `vitest run lib/lockdown-guard lib/notif-antiflip-guard lib/money-antiflip-guard` → 62/62 green
- `pnpm exec tsc --noEmit` → exit 0
- Raw `NOTIF_PUBLIC_ENABLED` token appears ONLY in `app/lib/notif-gate.ts` (chokepoint) + `app/lib/notif-antiflip-guard.test.ts` (test fixtures, excluded from the walk by construction)
- `.env.example` contains exactly `NOTIF_PUBLIC_ENABLED=false` and `RESEND_API_KEY=` (never `=true`, never a real value)

## Threat register coverage

| Threat ID | Mitigation landed |
|-----------|-------------------|
| T-103-01 (over-grant to authenticated on a non-user table) | Block D positive allowlist + self-check |
| T-103-02 (authenticated grant on notificacion_envio queue) | Block E explicit zero-grant assertion |
| T-103-03 (agent commits NOTIF_PUBLIC_ENABLED=true) | anti-flip Vectors 1-3 + .env.example=false |
| T-103-23 (service_role user-table access sprawl) | user-table .from() prohibition scoped to supabase.ts; only notif-service.ts tolerated (NOTIF_SERVICE_TS) |
| T-103-SC (npm/pip installs) | ZERO new external packages this plan (no install task) |

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes (Rules 1-3) were needed.

## Deferred / Notes

- **Full-suite flake (not a regression):** running the entire app suite (`pnpm test`, ~1362 tests) once produced a 5000ms timeout in the UNRELATED `lib/money-antiflip-guard.test.ts` `WR-03 packages/ walk` test, under heavy parallel load (aggregate ~638s environment setup). Re-run in a focused set the same file passes in 78ms (verified). This is a pre-existing load-dependent timeout in a file this plan did not touch — out of scope (SCOPE BOUNDARY). No source change made.
- `app/lib/notif-service.ts` does not exist yet (Plan 03 creates it) — the tolerance test asserts the allowlist PATH contract, not the file's presence.

## Known Stubs

None. Both deliverables are complete, self-testing guards; no placeholder data or unwired components.

## Self-Check: PASSED

- app/lib/notif-gate.ts — FOUND
- app/lib/notif-antiflip-guard.test.ts — FOUND
- app/lib/lockdown-guard.test.ts (modified) — FOUND
- .env.example (modified) — FOUND
- commit 6cf3bbc — FOUND
- commit b4331db — FOUND
