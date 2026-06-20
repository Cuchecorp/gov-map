---
phase: 19
plan: 04
subsystem: frontend-design
tags: [landing, mockup, throwaway, design-closure, tokens, anti-insinuacion, html]
requires:
  - "19-UI-SPEC.md §11.1 (approved landing contract) + §4.1 (cream + petrol HSL) + §Typography"
  - "19-01-SUMMARY.md / DESIGN-SYSTEM.md (locked token values: cream bg, petrol accent, Geist ramp)"
  - "19-03-SUMMARY.md / SCREENS.md (landing per-screen contract §2)"
  - "refs/tributalab-home.jpg (closest brand reference: cream paper, display + italic accent, search hero, pills, trust line)"
provides:
  - "mockup/landing.html — throwaway static HTML+Tailwind visual anchor of the landing (the only HTML artifact of Phase 19)"
affects:
  - "Closes Phase 19 success criterion 4 (a throwaway HTML/Tailwind mockup of the landing as the visual anchor)"
  - "A future implementation phase realizes this look in the Next.js app using the §4 token-wiring note; this file is disposable and is not that wiring"
tech-stack:
  added: []
  patterns:
    - "Throwaway visual anchor: self-contained static HTML + Tailwind CDN + inline CSS-variable tokens, opens by double-click, no build step"
    - "Locked tokens reproduced verbatim as CSS variables (cream hsl(40 33% 97%), petrol hsl(183 38% 26%), foreground hsl(222 47% 11%)) so the mockup reads as the shipped brand"
    - "Petrol accent confined to the reserved-for list (UI-SPEC §4.2): hero italic clause, search submit, focus ring, links, nav active underline"
key-files:
  created:
    - ".planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/mockup/landing.html"
  modified: []
decisions:
  - "Hero copy: sober display sentence 'Qué pasó con cada proyecto de ley y cada parlamentario.' + EXACTLY ONE italic petrol clause 'Con la fuente a la vista.' (the 'Sin alucinaciones.' pattern, neutral and anti-insinuación)"
  - "Background is flat cream + a subtle typographic dot texture only; NO node/graph motif (deferred per UI-SPEC §11.1)"
  - "No counts/stats rendered at all — the mockup shows zero numbers except the LOCKED boletín 15234-07 (which is an identifier, in Mono), honouring 'no fabricated stats'"
metrics:
  duration: "~7 min"
  completed: "2026-06-20"
  tasks: 1
  files: 1
---

# Phase 19 Plan 04: Landing Mockup (Throwaway) Summary

The single throwaway HTML/Tailwind landing mockup that closes the Phase 19 design: a self-contained static `mockup/landing.html` (170 lines) that opens standalone in a browser and visually realizes the LOCKED landing contract — warm cream paper background, a sober display hero with exactly ONE italic petrol accent clause, the semantic search box as the single protagonist (petrol focus ring + "Buscar proyectos" submit), the 4 LOCKED example pills (3 ideas + boletín `15234-07` in Mono), the trust line, and the inline "¿Cómo leer esto?" affordance — all in the locked brand tokens (cream `hsl(40 33% 97%)`, petrol `hsl(183 38% 26%)`, foreground `hsl(222 47% 11%)`, Geist) so it reads as the same product as the shipped system. It lives ONLY in the phase directory, never under `app/`, and is never built or deployed.

## What was built

- **Task 1 — Throwaway landing mockup** (commit `5d55a11`): `mockup/landing.html`, a complete static HTML document (`<html>/<head>/<body>`) using Tailwind via CDN plus inline CSS-variable tokens. Top-to-bottom it realizes UI-SPEC §11.1:
  - **Header band** — cream with a subtle bottom border: wordmark "Observatorio del Congreso 360" (left) + nav `Buscar · Parlamentarios · Agenda · Sobre / Metodología` (right), the active item underlined in petrol; nav links carry ≥44px touch targets.
  - **Hero** — `max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24` on cream, centered: a `text-4xl md:text-5xl font-semibold leading-tight` display headline with EXACTLY ONE `<em>` italic petrol accent clause ("Con la fuente a la vista."), the rest sober.
  - **Search as the single hero** — a wide input with a petrol focus ring (`box-shadow` ring on `:focus`) and a petrol "Buscar proyectos" submit button; placeholder invites an idea or a boletín.
  - **4 example pills** — `protección de datos personales`, `delitos económicos y medio ambiente`, `40 horas / jornada laboral`, and the boletín `15234-07` rendered in Geist Mono; chips styled clickable.
  - **Trust line** — muted, bullet-separated: "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad."
  - **Inline onboarding** — link-styled "¿Cómo leer esto?" (no modal, no tour).
  - **Footer** — echoes the trust line + "Beta abierta · atribución por fuente".
  - Background is flat cream + a faint typographic dot texture only — NO node/graph motif. A top HTML comment marks the file THROWAWAY / not under `app/` / not for deployment.

## Verification

- Plan automated check passed: `Mockup OK` — all 7 required strings present (`<html`, `40 33% 97%`, `183 38% 26%`, `Buscar proyectos`, `15234-07`, `Fuente, fecha y enlace en cada dato`, `THROWAWAY`) and ≥1 italic accent found.
- Anti-insinuación negative-match passed: `negative-match OK` — none of the banned causal/affinity/ranking-as-verdict terms (porque, a cambio de, para favorecer, influy, afinidad, puntaje, score, % de coincidencia, el peor/mejor, ranking, conflicto de interés, enriquecimiento, sospechoso) appears anywhere in the file. (A first pass tripped on the literal term inside an explanatory comment; the comment was reworded to a positive phrasing so the strict negative-match passes.)
- Structural check: exactly ONE `<em>` tag and exactly ONE `class="…italic…"` use → the single italic petrol hero accent, nothing else italic.
- Scope: `git show --stat 5d55a11` shows only `mockup/landing.html` added (170 lines, min 60). Nothing under `app/` created or modified.

## Deviations from Plan

None — plan executed exactly as written. The single task was committed individually; the plan's automated verification passed (after a one-line wording fix in a comment to also satisfy the stricter anti-insinuación negative-match, which is a tightening within the plan's own constraints, not a deviation from them).

## Known Stubs

None in the product sense. By design this is a throwaway visual anchor: the pills and search submit are non-functional placeholders (`onsubmit="return false;"`, no JS wiring) because the file is a static reference, not the application — the plan's HARD constraint forbids wiring it into `app/`. It renders no data and shows no fabricated counts; the only literal value is the LOCKED boletín identifier `15234-07`. A future implementation phase realizes this look in the Next.js app per the DESIGN-SYSTEM §4 token-wiring note.

## Threat Flags

None. The plan's threat register (T-19-04) dispositions the only component (`mockup/landing.html`) as `accept` — a static, non-deployed throwaway file with no runtime, no auth, no input handling, and no data egress. The Tailwind CDN reference is the only external dependency and is not part of any shipped bundle.

## Self-Check: PASSED

- FOUND: `.planning/phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/mockup/landing.html`
- FOUND commit: `5d55a11` (Task 1)
