---
phase: 42-lockdown-api-supabase-rol-web-reader
plan: "04"
subsystem: lockdown-ci-guard
tags: [ci, guard, anti-regression, runbook, lockdown]
dependency_graph:
  requires: [42-01, 42-02, 42-03]
  provides: [LOCKDOWN-04]
  affects: [app/lib, docs]
tech_stack:
  added: []
  patterns: [vitest-fs-scan, path-resolve-from-cwd, stripTsComments]
key_files:
  created:
    - app/lib/lockdown-guard.test.ts
    - docs/RUNBOOK-lockdown-cutover.md
  modified: []
decisions:
  - "Use path.resolve(process.cwd()) instead of import.meta.url for migration path resolution — vitest jsdom environment throws 'URL must be of scheme file' on new URL() with relative paths"
  - "stripTsComments (block + line comments) applied to supabase.ts scan so JSDoc prose like `client.auth.signIn` does not trigger the .auth. guard"
  - "Block A trivially passes (0 migrations > 0044) and is documented as the base state — future migrations with number > 0044 will be scanned"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-24"
  tasks_completed: 2
  files_created: 2
---

# Phase 42 Plan 04: LOCKDOWN-04 Guard CI + Runbook Summary

**One-liner:** Vitest static guard (Block A: no new `grant to anon` in migrations > 0044; Block B: no `.auth.` method or PII select in the web_reader chokepoint) plus ordered cutover runbook with reverse-0044 rollback and live curl probe spec.

## Tasks Completed

| # | Task | Commit | Files |
|---|---|---|---|
| 1 | Guard CI anti-regresion (lockdown-guard.test.ts) | (in final commit) | app/lib/lockdown-guard.test.ts |
| 2 | Runbook cutover ordenado (RUNBOOK-lockdown-cutover.md) | (in final commit) | docs/RUNBOOK-lockdown-cutover.md |

## Verification

- `cd app && npx vitest run lib/lockdown-guard.test.ts` → **7/7 green**
- `cd app && npx vitest run` → **316/316 green** (32 test files)
- `cd app && npx tsc -b` → **clean** (no errors)

## Guard behavior confirmation

**Green now (expected):** 0 migrations with number > 0044 exist; `supabase.ts` has no `.auth.` method calls and no PII selects.

**Would fail on a future regression:**
- A migration `0045_foo.sql` containing `GRANT SELECT ON proyecto TO anon` → Block A `GRANT … TO anon` test fails.
- A migration containing `CREATE POLICY foo ON proyecto FOR SELECT TO anon USING(true)` → Block A policy test fails.
- Adding `.from('parlamentario')` to `app/lib/supabase.ts` → Block B PII table test fails.
- Adding `supabase.auth.getSession()` to `app/lib/supabase.ts` → Block B `.auth.` test fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `import.meta.url` not usable in vitest jsdom environment**
- **Found during:** Task 1 (first test run)
- **Issue:** `new URL("../../supabase/migrations", import.meta.url)` → `TypeError: The URL must be of scheme file` in vitest's jsdom environment.
- **Fix:** Replaced with `path.resolve(process.cwd(), ...)` — vitest always runs from `app/` directory per `vitest.config.ts`, so `process.cwd()` is the reliable anchor.
- **Files modified:** `app/lib/lockdown-guard.test.ts`

**2. [Rule 1 - Bug] JSDoc prose triggering `.auth.` guard**
- **Found during:** Task 1 (second test run — 6/7 passed, Block B `.auth.` test red)
- **Issue:** The supabase.ts JSDoc comment `client.auth.*` matched the regex `\.auth\.` — the guard was scanning comment text as if it were code.
- **Fix:** Added `stripTsComments()` helper that removes block comments (`/* */`, `/** */`) and line comments (`//`) before scanning Block B targets. Block A (SQL) continues using `stripSqlComments()` (strips `--` lines).
- **Files modified:** `app/lib/lockdown-guard.test.ts`

## Known Stubs

None. Both deliverables are complete as specified.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced. The guard and runbook are read-only CI artifacts.

## Self-Check: PASSED

- `app/lib/lockdown-guard.test.ts` — EXISTS
- `docs/RUNBOOK-lockdown-cutover.md` — EXISTS
- 316 vitest tests green, tsc clean
