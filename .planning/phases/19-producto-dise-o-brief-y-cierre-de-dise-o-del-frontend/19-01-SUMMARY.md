---
phase: 19
plan: 01
subsystem: frontend-design
tags: [design-system, tokens, typography, editorial-voice, anti-insinuacion, docs]
requires:
  - "19-UI-SPEC.md (approved master design contract)"
  - "19-CONTEXT.md (locked user decisions + browseros study)"
  - "app/app/globals.css (shipped Slate baseline)"
  - "app/app/styles/civic-tokens.css (shipped civic tokens)"
provides:
  - "DESIGN-SYSTEM.md — closed design system: tokens, typography, spacing, color, component catalogue, ES editorial voice, honest-states catalogue, anti-insinuacion invariants"
affects:
  - "Plan 19-03 (per-screen specs) and 19-04 (landing mockup) build on this foundation"
  - "Future implementation phase wires globals.css + tailwind.config.ts per the §4 wiring note"
tech-stack:
  added: []
  patterns:
    - "Negative-match-enforced doc: banned vocabulary fenced; prose practices the voice it preaches"
    - "Extend-not-break token wiring (cream/petrol EXTEND globals.css; civic-tokens.css untouched)"
key-files:
  created:
    - ".planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md"
  modified: []
decisions:
  - "Cream --background hsl(40 33% 97%) + petrol --accent-product hsl(183 38% 26%) as the 60/30/10 split, lifted verbatim from UI-SPEC §4"
  - "Banned-vocabulary enumeration fenced between <!-- BANNED-VOCAB-START/END --> so the doc's own prose passes a machine negative-match"
  - "mt-12 (2xl/48px) locked as the anti-insinuacion carril boundary, never collapsed"
metrics:
  duration: "~6 min"
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 19 Plan 01: Design System Closure Summary

Closed, implementation-ready design system for the Observatorio frontend in a single self-contained `DESIGN-SYSTEM.md` (257 lines): cream-paper + petrol-teal tokens with light/dark HSL lifted verbatim from the approved UI-SPEC, Geist Sans/Mono ramp, 8-pt spacing with the `mt-12` carril frontier, the closed component catalogue (shipped + NEW spec-only), the Spanish editorial-voice guide with a machine-enforced fenced banned-vocabulary list, the three honest-states catalogue per surface, and the 10 anti-insinuación invariants — built ON the shipped system without re-opening any decision.

## What was built

- **Task 1 — Tokens, typography, spacing, color** (commit `fc7f33b`): §1 Color (60/30/10 split, exact light+dark HSL for background/card/muted/accent-product/destructive, cream + petrol rationale, accent reserved-for and NOT-used-for lists, civic-tokens table with the "data identity, never brand" invariant, vote-outcome palette, no-destructive-actions note); §2 Typography (Geist Sans/Mono 4-size + 1 display ramp, exactly-one-italic-accent rule, Mono usage rule, sacred heading hierarchy); §3 Spacing (8-pt table with `mt-12` carril boundary, container widths, 44px touch target); §4 future-phase token-wiring note (globals.css + tailwind.config.ts, civic-tokens.css stays intact).
- **Task 2 — Catalogue, voice, states, invariants** (commit `f181d34`): §5 closed component catalogue (shipped domain components + NEW spec-only, each with its anti-insinuación/traceability contract); §6 ES editorial voice (Always list + fenced banned-vocabulary enumeration + trust line + tone exemplars); §7 honest-states catalogue (3-state table + per-surface matrix, skeleton + stale rules); §8 the 10 HARD anti-insinuación invariants.

## Verification

- Task 1 automated check: `Task1 OK` — all 7 locked tokens present (`hsl(40 33% 97%)`, `hsl(183 38% 26%)`, `Geist Mono`, `mt-12`, `--camara`, `globals.css`, `civic-tokens.css`).
- Task 2 automated check: `Task2 OK (presence + negative-match)` — all 12 required strings present (including both fence markers), and the negative-match confirms no banned causal/score/affinity term survives outside the fence.
- Scope: `git diff --name-only HEAD~2 HEAD` shows only `DESIGN-SYSTEM.md`; nothing under `app/` touched. File is 257 lines (min 200).

## Deviations from Plan

None — plan executed exactly as written. Both tasks committed individually; both automated verifications passed on first run.

## Known Stubs

None. This is a design-documentation artifact; it wires no data and renders no UI. The §4 token-wiring note is explicitly scoped to a future implementation phase (by design, per the plan's HARD constraint that no file under `app/` be modified now).

## Self-Check: PASSED

- FOUND: `.planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md`
- FOUND commit: `fc7f33b` (Task 1)
- FOUND commit: `f181d34` (Task 2)
