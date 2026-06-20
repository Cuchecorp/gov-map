---
phase: 19
plan: 03
subsystem: frontend-design
tags: [per-screen-spec, ui-spec, anti-insinuacion, traceability, money-gate, honest-states, docs]
requires:
  - "19-UI-SPEC.md §11 (approved master design contract — per-screen contracts)"
  - "19-01-SUMMARY.md / DESIGN-SYSTEM.md (tokens, component catalogue, honest states, invariants)"
  - "19-02-SUMMARY.md / BRIEF.md (value per surface, IA, landing/hero)"
  - "Shipped surface pages (app/app/parlamentario/[id]/page.tsx etc.) for grounding only"
provides:
  - "SCREENS.md — CLOSED per-screen contracts for the 5 key screens (landing, /buscar, /proyecto/[boletin], /parlamentario/[id], /contraparte/[id]) + GlobalHeader + NEW /parlamentario directory + /sobre·/metodologia"
affects:
  - "A future implementation phase builds each screen directly from SCREENS.md + DESIGN-SYSTEM.md, no interpretation"
  - "Closes Phase 19 success criterion 4 (5 key screens delivered as executable per-screen UI-SPEC, nothing abierto)"
tech-stack:
  added: []
  patterns:
    - "Per-screen template: Route · Layout · Components · Structure · States · Anti-insinuación+traceability · Copy"
    - "Negative-match-enforced doc: banned anti-feature terms fenced between BANNED-VOCAB markers; prose passes the negative-match"
    - "Spec, not implementation: layouts as inline Tailwind class strings, no fenced applied-source code blocks, no file under app/ touched"
key-files:
  created:
    - ".planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/SCREENS.md"
  modified: []
decisions:
  - "SCREENS.md consolidates UI-SPEC §11 into self-contained per-screen contracts; companion to DESIGN-SYSTEM.md + BRIEF.md"
  - "MONEY gating documented for BOTH states: OFF = node/route absent from HTML (ficha #dinero/#financiamiento sections; /contraparte page-level notFound()), future ON behaviour described per surface"
  - "Banned anti-feature vocabulary (relevance score, ranking-as-verdict) fenced so the doc's own prose passes the anti-insinuación negative-match"
metrics:
  duration: "~5 min"
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 19 Plan 03: Per-Screen Contracts (SCREENS.md) Closure Summary

Closed, implementation-ready per-screen contract set for the Observatorio frontend in a single self-contained `SCREENS.md` (410 lines): the 5 key screens (landing `/`, resultados de búsqueda `/buscar`, ficha de proyecto `/proyecto/[boletin]`, ficha de parlamentario `/parlamentario/[id]`, contraparte `/contraparte/[id]`) plus the `GlobalHeader`, the NEW `/parlamentario` directory, and the light `/sobre`·`/metodologia` surface — each consolidated from approved UI-SPEC §11 into a self-contained contract (Route · Layout · Components · Structure · States · Anti-insinuación+traceability · Copy) with nothing left "abierto" ni "por decidir", built ON the shipped stacked-carriles shell without redesigning.

## What was built

- **Task 1 — GlobalHeader + Landing + Resultados** (commit `0f7dd2e`): the per-screen template + the global invariants block (ProvenanceBadge per datum, carril propio mt-12, never composite, identity guard, no foto/no partido, MONEY gated, no invented data, civic colours as data) + the 3 honest states; §1 `GlobalHeader` (4 nav entries Buscar/Parlamentarios/Agenda/Sobre·Metodología, ≥44px touch targets, petrol active underline, no auth/no required theme toggle, ~56px); §2 Landing `/` (`max-w-3xl` `py-16 md:py-24`, one italic petrol hero accent, SearchBox autofocus + "Buscar proyectos", 4 LOCKED pills incl. boletín `15234-07`, trust line, inline "¿Cómo leer esto?", graph motif DEFERRED, static shell → no loading/error); §3 `/buscar` (`max-w-5xl` two-column with `MapaDeFuentes` sidebar, persistent SearchBox, dismissible hint, optional AiSummaryCallout banner, "N fuentes · ordenadas por relevancia" REAL counts, SourceTypeTabs, SearchResultCard, explicit NO score/no relevance bar, zero/loading/error states).
- **Task 2 — Ficha proyecto + Ficha parlamentario + Contraparte + Directorio + Sobre** (commit `ab9a2d4`): §4 `/proyecto/[boletin]` (`max-w-3xl`, FichaHeader, stacked mt-12 carriles idea matriz→AiSummaryCallout/cuerpos legales/timeline/votaciones/proyectos relacionados with NO score, ProvenanceBadge per datum, 404 + per-section honest states); §5 `/parlamentario/[id]` (shipped `max-w-3xl` shell, ParlamentarioHeader NO foto/NO partido, LOCKED carril order `#votos`/`#lobby`/`#patrimonio`/`#dinero`/`#financiamiento`, #dinero+#financiamiento GATED OFF→absent with future ON described, donor RUT never rendered, "asociado por nombre confirmado al candidato" never por RUT, CC BY 4.0 only on patrimonio); §6 `/contraparte/[id]` (page-level `notFound()` as FIRST statement when OFF, two sibling mt-12 carriles when ON, donor RUT never rendered, attribution per dataset never CC BY 4.0); §7 NEW `/parlamentario` directory (REAL 186-row maestra via public-read RPC, alphabetical neutral default, MethodologyCaveat, ranking-as-verdict fenced+deferred); §8 `/sobre`·`/metodologia` (Beta abierta, per-dataset attribution CC BY 4.0 only where licensed); closure assertion that all screens are CLOSED.

## Verification

- Task 1 automated check: `Task1 OK` — all 7 required strings present (`GlobalHeader`, `max-w-3xl`, `max-w-5xl`, `MapaDeFuentes`, `15234-07`, `Sin resultados para esta búsqueda`, `ordenadas por relevancia`).
- Task 2 automated check: `Task2 OK` — all 9 required strings present (`/proyecto/[boletin]`, `AiSummaryCallout`, `#votos`, `#financiamiento`, `NO partido`, `notFound()`, `MethodologyCaveat`, `Beta abierta`, `CC BY 4.0`); file is 410 lines (min 220).
- Negative-match: banned anti-feature vocabulary (afinidad, puntaje, % de coincidencia, ranking de los, el peor, conflicto de interés, enriquecimiento, a cambio de, para favorecer) does NOT survive outside the `<!-- BANNED-VOCAB-START/END -->` fences — `negative-match OK`.
- Scope: `git status` shows only `SCREENS.md` modified; nothing under `app/` touched. No fenced applied-source code blocks (layouts expressed as inline Tailwind class strings).

## Deviations from Plan

None — plan executed exactly as written. Both tasks committed individually; both automated verifications passed on first run, plus the anti-insinuación negative-match.

## Known Stubs

None. This is a design/product-documentation artifact; it wires no data and renders no UI. Every screen contract references only shipped data + the NEW spec-only components catalogued in DESIGN-SYSTEM.md; "nice but no data" items (graph motif, metric ranking) are marked DEFERRED, never specified as real. No file under `app/` was modified (HARD constraint honoured).

## Threat Flags

None. The plan's threat register (T-19-03) dispositions the only component (SCREENS.md) as `accept` — Markdown screen specs, no runtime, no auth, no input handling, no data egress. No new security-relevant surface introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/SCREENS.md`
- FOUND commit: `0f7dd2e` (Task 1)
- FOUND commit: `ab9a2d4` (Task 2)
