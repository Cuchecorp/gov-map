---
phase: 75-deuda-typography-island-net-rotar-db-password-operador
plan: 02
subsystem: operations
tags: [secret-rotation, supabase, db-password, operator-note, debt, DEBT-06, B26, checkpoint]
requires:
  - "Supabase DB password lives ONLY in SUPABASE_DB_URL (.env.example:26-29)"
  - "0 GH workflows reference SUPABASE_DB_URL (verified this session)"
  - "74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md as the operator-note structural template"
provides:
  - "75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md: zero-credential-values runbook to rotate the exposed Supabase DB password (B26)"
  - "A blocking operator checkpoint gating phase-75 completion (rotation is operator-exclusive)"
affects:
  - "Operator workflow (Supabase dashboard rotation + local .env reload + Cuchecorp/gov-map secret check)"
tech-stack:
  added: []
  patterns:
    - "Operator-note-with-checkpoint (agent documents, operator executes) — mirrors 74-DEBT-03"
    - "Zero-credential-values guarantee, guard-grep verified before commit"
key-files:
  created:
    - ".planning/phases/75-deuda-typography-island-net-rotar-db-password-operador/75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md"
  modified: []
decisions:
  - "Agent does NOT rotate the DB password: no dashboard access + live rotation breaks active connections (CONTEXT LOCKED, autonomous:false)"
  - "Blast radius scoped to SUPABASE_DB_URL only; CI crons + site keep running on SUPABASE_SECRET_KEY + REST (independent credentials, not re-loaded)"
  - "Q1 forwarded to operator: check Cuchecorp/gov-map Actions secrets for any *_DB_URL (mirror repo not inspectable from workspace)"
  - "Referenced .env.example:28 placeholder form postgresql://postgres:<password>@<host>:5432/postgres by NAME only; guard-grep confirms no populated credential string"
metrics:
  duration: "~8 min"
  completed: "2026-07-15"
  tasks: 2
  files_created: 1
---

# Phase 75 Plan 02: Supabase DB password rotation operator runbook (B26) Summary

Authored `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` — a zero-credential-values runbook (modeled on `74-DEBT-03`) that hands the operator a precise flow to rotate the exposed Supabase DB password (B26) in the dashboard, correctly scoping the blast radius to `SUPABASE_DB_URL` alone (0 CI consumers; the crons + deployed site authenticate with the independent `SUPABASE_SECRET_KEY` over REST and are unaffected). The agent does NOT rotate — the rotation is a blocking operator checkpoint. (DEBT-06)

## What Was Built

- **Task 1 (`docs`, commit `bbf8639`):** Created `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md` mirroring the 6-section structure of `74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md`:
  1. **Hallazgo rector** — the DB password (B26) lives only in `SUPABASE_DB_URL`; rotation is an operator dashboard act (agent has no dashboard access; live rotation breaks active connections).
  2. **Evidencia (read-only)** — `.env.example:26-29` cited as the sole location (by NAME, placeholder only); `grep .github/workflows/ → 0` references; the 9 running workflows use `SUPABASE_SECRET_KEY` + `SUPABASE_API_URL` over REST.
  3. **Qué rompe la rotación / qué NO** — table: only local DDL/bulk CLIs + psql runbooks break; CI crons + site keep running.
  4. **Pasos de OPERADOR (numbered)** — rotate in Dashboard → Settings → Database → Reset database password; re-load new `SUPABASE_DB_URL` into local `.env`; inspect Cuchecorp/gov-map Actions secrets for any `*_DB_URL` (Q1); confirm OLD url FAILS `psql` auth; smoke the NEW credential; confirm CI + site unaffected.
  5. **Aclaración anti-mal-interpretación** — do NOT re-load `SUPABASE_SECRET_KEY`/`SUPABASE_API_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_JWT_SECRET` (independent; Pitfall 2); `.env` stays gitignored.
  6. **Estado** — checklist ending in the unchecked blocking operator checkpoint. Includes the verbatim guarantee "no contiene ningún valor de secret".
- **Task 2 (`checkpoint:human-action`, `gate="blocking-human"`):** NOT executed — recorded as a PENDING blocking operator checkpoint (see below). The agent does not and cannot rotate the credential.

## Verification

- Guard grep (`GUARD_OK`): `test -f` PASS; no populated `postgresql://…:secret@` string; no `password=<value>`; `SUPABASE_DB_URL` present; `SUPABASE_SECRET_KEY` present. → **GUARD_OK** (zero credential values confirmed).
- Structure mirrors `74-DEBT-03` (6 sections + verbatim secret-free guarantee + Estado checklist ending in operator checkpoint).
- Blast radius correctly scoped to `SUPABASE_DB_URL` (0 CI consumers stated + verified); Q1 (Cuchecorp/gov-map `*_DB_URL` check) forwarded to operator.
- Agent did NOT rotate the credential (operator-exclusive, `autonomous:false`).

## Deviations from Plan

None — plan executed exactly as written. The `.env.example:28` line already carries a `<password>`/`<host>` placeholder connection string; the note references it by name only, and the guard grep confirms no real credential value leaked.

## Operator Checkpoint — PENDING (blocking)

**Type:** checkpoint:human-action · **gate:** blocking-human · **Status:** PENDING (not executed — agent has no Supabase dashboard access; live rotation breaks active connections)

Follow `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`:

- **A) Rotate the DB password (DEBT-06):** Supabase Dashboard → Settings → Database → Reset database password → re-load new `SUPABASE_DB_URL` in local `.env` (+ check Cuchecorp/gov-map Actions secrets for any `*_DB_URL`) → confirm OLD url FAILS `psql` auth + NEW works → confirm CI crons + site stay green (independent `SUPABASE_SECRET_KEY`).
- **B) `/red` visual non-regression (Plan 01, jsdom-blind):** load deployed `/red?seed=<id>`, confirm layout B (seed → columna + SVG fan-out connectors) is pixel-identical; optionally `getComputedStyle(...).fontSize` = 16/14/12 for seed/row/band.

**Resume signal:** operator writes "rotado" (with old-url-fails + new-url-works confirmation + `/red` non-regression note), or describes what failed.

## Known Stubs

None. The deliverable is a documentation runbook; the only outstanding item is the operator-exclusive rotation, tracked as the blocking checkpoint above (by design, not a stub).

## Self-Check: PASSED

- FOUND: `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`
- FOUND: `75-02-SUMMARY.md`
- FOUND: commit `bbf8639` (operator note)
