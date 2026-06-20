---
phase: 19
plan: 02
subsystem: frontend-design
tags: [product-brief, information-architecture, landing-hero, reference-study, anti-insinuacion, docs]
requires:
  - "19-UI-SPEC.md (approved master design contract)"
  - "19-CONTEXT.md (locked user decisions + browseros study)"
  - "19-01-SUMMARY.md (DESIGN-SYSTEM.md companion)"
  - "refs/*.jpg (6 browseros screenshots — SC1 evidence)"
provides:
  - "BRIEF.md — closed product brief: core value + audience, IA + global nav, landing/hero (semantic search protagonist), inline onboarding, per-surface value for all 7 surfaces, reference verdicts (with on-disk screenshot evidence), deferred ideas"
affects:
  - "Plan 19-03 (per-screen specs) and 19-04 (landing mockup) realize this product north star"
  - "Future implementation phase follows the brief without re-opening product decisions"
tech-stack:
  added: []
  patterns:
    - "Negative-match-enforced product doc: banned causal/score/affinity vocabulary fenced; prose practices the anti-insinuacion voice it specifies"
    - "Reference verdicts backed by on-disk evidence: each reference row cites its refs/*.jpg, files verified present (SC1 MET, not assumed)"
key-files:
  created:
    - ".planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/BRIEF.md"
  modified: []
decisions:
  - "BRIEF.md is the CLOSED product brief derived from approved UI-SPEC + CONTEXT; companion visual contract stays in DESIGN-SYSTEM.md (19-01)"
  - "All 7 surfaces (incl. NEW /parlamentario directory backed by real 186-row maestra) grounded in shipped data only; zero invented features"
  - "Graph motif + metric ranking marked DEFERRED with reasons; the verdict-table anti-feature term fenced in a BANNED-VOCAB block so prose passes negative-match"
  - "SC1 MET: all six browseros screenshots cited by path AND confirmed on disk under refs/"
metrics:
  duration: "~7 min"
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 19 Plan 02: Product Brief Closure Summary

Closed, implementation-ready product brief for the Observatorio frontend in a single self-contained `BRIEF.md` (210 lines): core value + audience and the two equal-weight frentes; the fixed information architecture and global navigation (Buscar / Parlamentarios / Agenda / Sobre-Metodología) over the real route map (incl. the NEW `/parlamentario` directory); the landing/hero with semantic project search as the single protagonist (4 LOCKED example pills incl. boletín `15234-07`, the LOCKED trust line, graph motif DEFERRED); inline-only onboarding; per-surface value for all 7 surfaces squeezing only shipped data; the browseros reference verdicts (TributaLab / LegalAtlas / ischilesafe → ADOPT/ADAPT/AVOID) each backed by its on-disk screenshot; and the deferred-ideas list with reasons — all grounded in real data and passing the banned-vocabulary negative-match.

## What was built

- **Task 1 — Value, IA + nav, landing/hero, onboarding** (commit `c053778`): §1 core value + audience + the two equal-weight frentes with a shipped-data table and the product invariants; §2 global header (4 entries rationalized) + real surface map (`/`, `/buscar`, `/proyecto/[boletin]`, `/parlamentario/[id]`, NEW `/parlamentario`, `/agenda`, gated `/contraparte/[id]`, `/sobre`+`/metodologia`) + navigation hierarchy (search-first, directory by people, agenda by time); §3 landing/hero (semantic search single protagonist, 4 LOCKED pills, trust line, graph motif DEFERRED, no marketing/fabricated counts); §4 inline-only onboarding (pills + "¿Cómo leer esto?", no modal, no tour).
- **Task 2 — Per-surface value + reference verdicts + deferred ideas** (commit `e4166f1`): §5 per-surface value for all 7 surfaces (`/buscar`, `/proyecto`, `/parlamentario` ficha, `/parlamentario` directory backed by the real ~186-row maestra, `/agenda`, gated `/contraparte`, `/sobre`+`/metodologia`), the LOCKED ficha carril order (#votos/#lobby/#patrimonio + gated #dinero/#financiamiento), each grounded in shipped data with the data-posture invariants restated; §6 reference-verdicts table (3 references × ADOPT/ADAPT/AVOID) with traces to Observatorio decisions and all six `refs/*.jpg` cited; §7 deferred ideas (NET graph + ambient motif, all-screens HTML mockups, metric ranking, production implementation), each marked DEFERRED with reason.

## Verification

- Task 1 automated check: `Task1 OK (presence + negative-match)` — all 8 required strings present (Buscar, Parlamentarios, Agenda, `/proyecto/[boletin]`, `/parlamentario/[id]`, `15234-07`, the trust line, DEFER), and the negative-match confirms no banned causal/score/affinity term survives outside the fence.
- Task 2 automated check: `Task2 OK (verdicts + 6 screenshots cited & exist)` — all 9 required strings present (`/buscar`, `/contraparte`, `186`, `no foto`, `#votos`, TributaLab, LegalAtlas, ischilesafe, ADOPT), and all six screenshots both cited by `refs/...` path AND confirmed present on disk.
- Negative-match re-run after Task 2 append: still green (the only banned term — the verdict-table phrase — is fenced inside `<!-- BANNED-VOCAB-START -->`/`<!-- BANNED-VOCAB-END -->`).
- File is 210 lines (min 180); contains "Parlamentarios". Nothing under `app/` touched (design/docs only).

## SC1 evidence (browseros screenshots) — MET

All six SC1 screenshots verified present on disk under the phase `refs/` directory at execution time:

- `refs/tributalab-home.jpg`
- `refs/tributalab-resultados.jpg`
- `refs/legalatlas-home.jpg`
- `refs/legalatlas-ficha-articulo.jpg`
- `refs/ischilesafe-home.jpg`
- `refs/ischilesafe-rankings.jpg`

**SC1 = MET** (not PARTIAL): all six files exist and are cited by relative path in the reference-verdicts table. SC2 (product brief covering value-per-surface, IA + global nav, landing/hero with semantic search protagonist, onboarding, squeezing real data without invented features) is satisfied by BRIEF.md.

## Deviations from Plan

None — plan executed exactly as written. Two minor self-corrections during execution, both to satisfy the machine checks (not scope changes):

1. Replaced an in-prose use of the banned term "puntaje" in the SearchBox row with "cifra de relevancia por resultado" so the Task 1 negative-match passes (the concept is unchanged: no per-result score is ever shown).
2. Reworded the `/parlamentario` directory line to include the exact literal substring "no foto" the Task 2 check requires (kept "no partido" and LEGAL-03 intact).

Both tasks committed individually; both automated verifications pass.

## Known Stubs

None. This is a product-documentation artifact; it wires no data and renders no UI. Every surface section references only shipped data; "nice but no data" items are in the DEFERRED list (§7), never described as real.

## Threat Flags

None. The plan's threat register (T-19-02) dispositions the only component (BRIEF.md) as `accept` — Markdown product documentation, no runtime, no auth, no input handling, no data egress. No new security-relevant surface introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/BRIEF.md`
- FOUND commit: `c053778` (Task 1)
- FOUND commit: `e4166f1` (Task 2)
- FOUND on disk: all 6 SC1 screenshots under `refs/`
