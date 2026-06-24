# Phase 43 — DEBT — Research / Discovery Synthesis

**Date:** 2026-06-24
**Method:** Premortem discovery swarm (6 Sonnet agents, 1/dimension) → adversarial Opus 1-by-1 validation → FIX-NOW only.
**Mandate:** "nada por sentado" — every finding carries file:line + repro; nothing is fixed without its own Opus verdict.

---

## Baseline (verified green BEFORE any change)

| Gate | Result |
|------|--------|
| `cd app && npx vitest run` | **316/316 passed** (32 files) |
| `npx tsc -b` (root) | **clean, exit 0** |
| `pnpm -r --filter "./packages/*" test` | **all green**: core 21, llm 78(+3 skip), ingest 63, cruces 14(+1), agenda 110, identity 110, adjudication 89(+1), tramitacion 104, probidad 46, lobby 48, votos 3(+1), fichas 66(+1) |

This is the regression baseline. Every FIX-NOW commit must keep all three green.

---

## Discovery inventory (raw, pre-validation)

6 discovery files in this dir (`43-discovery-{app,packages,db,tests,config,planning}.md`). Raw finding counts:

| Dimension | File | Findings | Self-flagged false-positives |
|-----------|------|----------|------------------------------|
| 1. app/ | 43-discovery-app.md | APP-01..12 (10 real entries) | APP-09 (verify of APP-01), APP-10 (dup of APP-03) |
| 2. packages/ | 43-discovery-packages.md | PKG-01..13 | PKG-04, PKG-09 (false positives) |
| 3. DB/migrations/pgTAP | 43-discovery-db.md | DB-01..10 | DB-02 (seed neutralized — file lies only) |
| 4. tests/CI | 43-discovery-tests.md | TEST-01..10 | — |
| 5. deps/config/build | 43-discovery-config.md | CFG-01..14 | seed: JWT_SECRET present, dist not committed |
| 6. planning/docs/scratch | 43-discovery-planning.md | PLAN-01..14 | PLAN-07 (likely false), PLAN-14 (expected state) |

**~71 raw findings.** Severity spread (discovery's own grading): critical 4 (APP-01, PKG-01, TEST-01, TEST-02), high ~17, medium ~24, low ~26.

### Cross-cutting clusters (same root, multiple findings)
- **C1 — Admin env-name mismatch:** APP-01 + PLAN-03 + CFG seed-row (`SUPABASE_SERVICE_KEY` vs `SUPABASE_SECRET_KEY`). **CONFLICT to resolve:** APP agent says "broken"; CFG agent says "two distinct roles, intentional." Opus must adjudicate with `.env` + `.env.example` + all readers as evidence.
- **C2 — CI has no quality gate:** TEST-01 (app suite excluded from root test) + TEST-02 (no CI runs tests/typecheck) + CFG-11 (root lint = echo) + CFG-06 (5 packages missing from root tsc references) + CFG-07 (paths drift). The headline structural debt.
- **C3 — agenda onConflict mismatch:** PKG-01 (code uses `citacion_id,nombre,calidad`; migration 0010 has `unique(citacion_id,nombre)`) + PKG-08 (comment documents the wrong constraint) + TEST-04 (no writer test). Possibly a real 42P10 crash on every agenda ingest with invitados.
- **C4 — Deny-by-default revoke asymmetry:** DB-01 (8 public RPCs no `revoke from public`) + DB-03 (`rebeldias` secdef+PII) + DB-07 (`cruces.materializar_cruces` PUBLIC execute) + DB-08 (`grafo.materializar_aristas` PUBLIC execute). Forward-migration 0045 candidate.
- **C5 — Silent error swallow on read paths:** APP-02 (`leerFicha`) + APP-03 (buscar/votos hydration) + APP-08 (buscarProyectos catch no log) + PKG-02 (reconciliar-contrato enqueue) + PKG-07 (drift) + PKG-10 (cruces 0-row) + PKG-12/13 (parse swallow).
- **C6 — .env.example incompleteness:** CFG-02 (ANON_KEY, PUBLIC_INDEXABLE) + CFG-03 (LOCAL_*) + CFG-04 (URL alias) + CFG-05 (DB_URL).
- **C7 — Test coverage holes:** TEST-04/05/06/08 + DB-04/09/10 (missing test files).
- **C8 — ROADMAP/doc drift:** PLAN-01/02/04 (status drift) + PLAN-05/06/08/09 (doc hygiene).
- **C9 — .gitignore + secret hygiene:** CFG-01 (`.claude/` untracked).

---

## Validation Architecture

**Goal:** every raw finding receives an INDIVIDUAL adversarial Opus verdict (gate 3: "uno por uno, prohibido el fix masivo sin validación individual"). Discovery was Sonnet; validation is a FRESH Opus pass that re-verifies each claim against the live repo — adversarial framing "is this actually real, or a false positive?".

**Per-finding verdict fields:**
- **REAL / FALSE-POSITIVE** (re-verified against file:line).
- **Root cause** (not symptom).
- **What breaks** if touched / if left.
- **Protecting test** (does one exist? what would?).
- **Verdict:** one of
  - **FIX-NOW** — safe, autonomous, provable green, no behavior change to shipped features (or behavior change covered by a new test). Pure hygiene, code/test/config/doc.
  - **CHECKPOINT-OPERADOR** — needs PROD DDL apply, deploy, secret, flag flip, dossier signature, or cron. Agent WRITES the artifact (migration 0045+, etc.) but never applies. Apply = operator.
  - **WON'T-FIX** — risk > benefit, intentional, or requires re-architecture (gate 6: hygiene not redesign). Documented with reason.

**Parallelization that still honors "1-a-1":** 6 Opus validators, one per discovery file, each rendering a SEPARATE verdict per finding in its file (not a batch rubber-stamp). Cross-cutting clusters (C1–C9) are reconciled by me at synthesis: when two findings share a root, the FIX-NOW is applied once and the siblings fold into it or become WON'T-FIX-duplicate.

**Hard constraints handed to every validator:**
1. Re-verify each claim by reading the actual file:line. A finding whose evidence doesn't reproduce → FALSE-POSITIVE.
2. Applied migrations 0001–0044 are IMMUTABLE. Schema fix = forward migration 0045+ WRITTEN, apply=operator (CHECKPOINT).
3. The agent never applies to PROD, never flips `*_PUBLIC_ENABLED`, never signs dossiers, never enables crons, never runs the Phase 42 cutover.
4. FIX-NOW requires a provable-green test. If it can't be proven green, it's CHECKPOINT or WON'T-FIX.
5. Don't delete/overwrite operator-created files (esp. Phase 42 scratch — ALL load-bearing per discovery) without explicit validation.
6. Behavior change to a shipped feature without a protecting test is forbidden.

**Output:** each validator writes `43-validation-{dim}.md`. I consolidate into `43-VALIDATION.md` + `43-DEBT-LEDGER.md` (classified). Only FIX-NOW verdicts enter execution.
