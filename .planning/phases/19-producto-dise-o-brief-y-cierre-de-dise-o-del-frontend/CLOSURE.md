# Phase 19 — CLOSURE.md · Consolidación y cierre del diseño del frontend

> **Status: this document closes the design phase.** It consolidates the four produced
> artifacts (`BRIEF.md`, `DESIGN-SYSTEM.md`, `SCREENS.md`, `mockup/landing.html`), cross-checks
> each of the 5 Phase-19 success criteria against them with a concrete artifact + section
> citation, verifies SC1's browseros study against the screenshot files actually on disk under
> `refs/`, audits the principios rectores with their enforcement locations, confirms the hard
> constraints were honoured, and signs the consolidated deliverable off.
>
> **This document obeys the voice it audits.** Its own prose follows the editorial guide of
> `DESIGN-SYSTEM.md` §6. Where a forbidden term must be *named* in order to forbid it, the term
> lives only inside a `<!-- BANNED-VOCAB-START --> … <!-- BANNED-VOCAB-END -->` fence so the
> negative-match passes. Outside the fences, the anti-insinuación register is observed
> throughout (no causal / affinity / score / verdict language).

---

## 1. Artifact Index

| # | Deliverable file | One-line description | Status |
|---|------------------|----------------------|--------|
| 1 | `DESIGN-SYSTEM.md` | Closed design system: cream + petrol tokens, Geist typography, 8-pt spacing, closed component catalogue, ES editorial voice with fenced banned-vocabulary list, honest-states catalogue, anti-insinuación invariants | EXISTS · COMPLETE |
| 2 | `BRIEF.md` | Product brief: core value + audience, value-per-surface for all 7 surfaces, IA + global nav, landing/hero (semantic search protagonist), onboarding, browseros reference verdicts with on-disk evidence, deferred ideas | EXISTS · COMPLETE |
| 3 | `SCREENS.md` | Implementation-ready per-screen contracts for the 5 key screens + `GlobalHeader` + `/parlamentario` directory + Sobre/Metodología, with the closure assertion that nothing is left open | EXISTS · COMPLETE |
| 4 | `mockup/landing.html` | Throwaway HTML/Tailwind landing mockup (visual anchor only; in the phase dir, NOT in `app/`): cream/petrol tokens, the 4 example pills, the trust line, one italic accent, the THROWAWAY marker | EXISTS · COMPLETE |

**Supporting inputs (not deliverables, consumed by the above):** `19-CONTEXT.md` (locked user
decisions + browseros study), `19-UI-SPEC.md` (approved master contract §0–§12), `refs/*.jpg`
(the six browseros screenshots — SC1 evidence, audited in §2).

---

## 2. Audit log — existence + required-element checks

Each prior artifact was read in full and checked against the acceptance criteria of Plans 01–04
and the deliverable table of `19-UI-SPEC.md` §0.1.

### 2.1 `DESIGN-SYSTEM.md` (Plan 19-01)

| Required element | Location | Present |
|------------------|----------|---------|
| Tokens — cream dominant + petrol accent (exact HSL) | `DESIGN-SYSTEM.md` → §1 "Color" → §1.1 60/30/10 table (`--background hsl(40 33% 97%)`, `--accent-product hsl(183 38% 26%)`) | yes |
| Typography (Geist Sans + Mono, 4 sizes + display, 2 weights) | `DESIGN-SYSTEM.md` → §2 "Typography" | yes |
| Spacing (8-pt scale, `mt-12` carril boundary) | `DESIGN-SYSTEM.md` → §3 "Spacing" | yes |
| Component catalogue (closed) | `DESIGN-SYSTEM.md` → §5 "Component catalogue (closed)" (§5.1 shipped + §5.2 NEW spec-only) | yes |
| ES editorial voice with banned-vocabulary list | `DESIGN-SYSTEM.md` → §6 "Editorial voice", fenced `<!-- BANNED-VOCAB-START/END -->` list | yes |
| Honest-states catalogue (3 states + per-surface matrix) | `DESIGN-SYSTEM.md` → §7 "Honest states catalogue" | yes |
| Anti-insinuación invariants | `DESIGN-SYSTEM.md` → §8 "Anti-insinuación invariants (HARD)" (10 invariants) | yes |

### 2.2 `BRIEF.md` (Plan 19-02)

| Required element | Location | Present |
|------------------|----------|---------|
| Value-per-surface for all 7 surfaces | `BRIEF.md` → §5 "Per-surface value" (§5.1–§5.7: buscar, proyecto, parlamentario, directorio, agenda, contraparte, sobre/metodología) | yes |
| IA + global navigation | `BRIEF.md` → §2 "Information architecture & global navigation" | yes |
| Landing / hero (semantic search protagonist) | `BRIEF.md` → §3 "Landing / hero" + the 4 LOCKED pills | yes |
| Onboarding / primer uso | `BRIEF.md` → §4 "Onboarding / primer uso" | yes |
| Reference verdicts (browseros) | `BRIEF.md` → §6 "Reference verdicts applied — browseros study (SC1 evidence)" | yes |
| Deferred ideas | `BRIEF.md` → §7 "Deferred ideas" | yes |

### 2.3 `SCREENS.md` (Plan 19-03)

| Required element | Location | Present |
|------------------|----------|---------|
| Executable specs — 5 key screens | `SCREENS.md` → §2 Landing, §3 Resultados, §4 Ficha proyecto, §5 Ficha parlamentario, §6 Contraparte | yes |
| GlobalHeader spec | `SCREENS.md` → §1 "GlobalHeader" | yes |
| Parlamentarios directory spec | `SCREENS.md` → §7 "Directorio `/parlamentario`" | yes |
| Sobre/Metodología spec | `SCREENS.md` → §8 "Sobre / Metodología" | yes |
| Closure assertion (nothing left open) | `SCREENS.md` → "## Closure" | yes |

### 2.4 `mockup/landing.html` (Plan 19-04)

| Required element | Location | Present |
|------------------|----------|---------|
| Lives in `mockup/` (NOT `app/`) | `mockup/landing.html` (phase directory) | yes |
| Cream + petrol tokens | `mockup/landing.html` → `<style> :root` (`--background: 40 33% 97%`, `--accent-product: 183 38% 26%`) | yes |
| The 4 example pills (3 ideas + boletín in Mono) | `mockup/landing.html` → `.pill` block (protección de datos / delitos económicos / 40 horas / `15234-07` in `font-mono`) | yes |
| The trust line | `mockup/landing.html` → "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad." | yes |
| Exactly one italic accent | `mockup/landing.html` → single `<em class="text-accent italic">Con la fuente a la vista.</em>` | yes |
| THROWAWAY marker | `mockup/landing.html` → top comment "THROWAWAY MOCKUP — Phase 19" | yes |

**Gaps found and fixed:** none. Every required element of Plans 01–04 was present on first read;
no source artifact required correction, and none was modified by this closure step.

### 2.5 SC1 evidence — browseros screenshots on disk (`refs/`)

The six screenshots are the evidence for SC1. Each was checked for existence on disk **and** for
citation by relative path in `BRIEF.md` §6.

| Screenshot file | On disk (`refs/`) | Cited in `BRIEF.md` §6 |
|-----------------|-------------------|------------------------|
| `tributalab-home.jpg` | EXISTS | yes |
| `tributalab-resultados.jpg` | EXISTS | yes |
| `legalatlas-home.jpg` | EXISTS | yes |
| `legalatlas-ficha-articulo.jpg` | EXISTS | yes |
| `ischilesafe-home.jpg` | EXISTS | yes |
| `ischilesafe-rankings.jpg` | EXISTS | yes |

**SC1 evidence verdict:** all six screenshots EXIST on disk under `refs/` and each is cited by
relative path in `BRIEF.md` §6. Therefore SC1 is recorded **MET** in §3. (Had any one been
missing, SC1 would be recorded PARTIAL naming the missing file.)

---

## 3. Success-criteria cross-check (with evidence citations)

One row per Phase-19 success criterion (ROADMAP.md → "Phase 19 → Success Criteria"). Each row
cites a specific artifact filename **plus** a section string as evidence. A status is MET only
where the cited section actually carries the proof.

| # | Phase-19 success criterion (abridged) | Status | Evidence (artifact → section / file) |
|---|----------------------------------------|--------|--------------------------------------|
| **SC1** | 3 reference properties studied **visually with browseros** (home + key flows), with an adopt/adapt/avoid verdict | **MET** | `BRIEF.md` → '## 6. Reference verdicts applied — browseros study (SC1 evidence)' (adopt/adapt/avoid table) **+** the six on-disk screenshots `refs/tributalab-home.jpg`, `refs/tributalab-resultados.jpg`, `refs/legalatlas-home.jpg`, `refs/legalatlas-ficha-articulo.jpg`, `refs/ischilesafe-home.jpg`, `refs/ischilesafe-rankings.jpg` (all EXIST per §2.5). Verdict source: `19-UI-SPEC.md` → '## 12. Reference Verdicts Applied' |
| **SC2** | Product brief: value-per-surface + IA/nav + landing/hero + onboarding + each surface squeezes REAL data | **MET** | `BRIEF.md` → '## 5. Per-surface value — squeezing the REAL data' (§5.1–§5.7), '## 2. Information architecture & global navigation', '## 3. Landing / hero', '## 4. Onboarding / primer uso' |
| **SC3** | Closed design system: tokens + ES voice + components + honest states, implementation-ready | **MET** | `DESIGN-SYSTEM.md` → §1 "Color" (tokens), §2 "Typography", §3 "Spacing", §5 "Component catalogue (closed)", §6 "Editorial voice", §7 "Honest states catalogue" |
| **SC4** | Per-screen executable specs for the 5 key screens — nothing left "abierto" | **MET** | `SCREENS.md` → §2 Landing, §3 Resultados, §4 Ficha proyecto, §5 Ficha parlamentario, §6 Contraparte, plus the '## Closure' assertion; visual anchor `mockup/landing.html` realizes the landing contract |
| **SC5** | Principios rectores intact + consolidated deliverable revisado y cerrado | **MET** | This `CLOSURE.md` → §4 "Principios rectores — audit" (each invariant cites its enforcement location) **+** §6 "Sign-off (CERRADO)"; invariants enforced in `DESIGN-SYSTEM.md` → §8 and `SCREENS.md` → "## Invariants that bind EVERY screen" |

**SC1 consistency note:** the SC1 row is MET strictly because §2.5 confirmed all six screenshots
exist on disk. The status is derived from disk state, not from a verdict word.

---

## 4. Principios rectores — audit (with enforcement-location citations)

Each invariant is marked PASS only with a concrete enforcement location (artifact + section).

| # | Principio rector | Status | Enforcement location |
|---|------------------|--------|----------------------|
| P1 | **Trazabilidad** — `ProvenanceBadge` (fuente · fecha · enlace) on every datum, never omitted | PASS | `DESIGN-SYSTEM.md` → §5.1 `ProvenanceBadge` row ("never omitted; stale>48h → amber") + §8 invariant #1; `SCREENS.md` → "## Invariants that bind EVERY screen" #1 "ProvenanceBadge per datum" |
| P2 | **Anti-insinuación: carril `mt-12`** — each data domain a sibling `<section class="mt-12">`, never nested, gap never collapsed | PASS | `DESIGN-SYSTEM.md` → §3 "Carril boundary (LOCKED)" + §8 invariant #1–#2; `SCREENS.md` → §5 "Stacked carriles — LOCKED order" ("the `mt-12` gap between carriles is never collapsed") |
| P3 | **Anti-insinuación: nunca componer dinero/lobby + voto** en una misma unidad | PASS | `DESIGN-SYSTEM.md` → §8 invariant #2 "Never composite"; `SCREENS.md` → §5 "Anti-insinuación invariant: no carril ever composes with `#votos`" + §6 contraparte "zero vote data" |
| P4 | **Anti-insinuación: sin lenguaje causal / score** (the affinity and coincidence-number terms are named only in the fence) <!-- BANNED-VOCAB-START -->afinidad / % de coincidencia<!-- BANNED-VOCAB-END --> | PASS | `DESIGN-SYSTEM.md` → §6 fenced banned list + §8 invariant #3–#4 "No relevance number, sin score"; `SCREENS.md` → §3 "no per-result score and no relevance bar" |
| P5 | **MONEY gated** — OFF (default) = node/route absent from HTML until LEGAL-01 | PASS | `DESIGN-SYSTEM.md` → §8 invariant #6 "MONEY gate"; `SCREENS.md` → §5 `#dinero`/`#financiamiento` ("OFF → the entire node is absent") + §6 page-level `notFound()` first statement |
| P6 | **Sin foto, sin partido** del parlamentario (LEGAL-03) | PASS | `DESIGN-SYSTEM.md` → §5.1 `ParlamentarioHeader` row ("No photo, no partido chip (LEGAL-03)"); `SCREENS.md` → §5 ParlamentarioHeader ("NO foto. NO partido chip") + §7 directory entries |
| P7 | **PII nunca renderizada** — RUT/partido/email/familiares fuera del DOM y del LLM | PASS | `DESIGN-SYSTEM.md` → §8 invariant #8 "PII never rendered"; `SCREENS.md` → §5 ("RUT/partido/email/family never reach the DOM or the LLM, LEGAL-03") + §6 "donor RUT never rendered" |
| P8 | **No invented features/data** — deferred items explicitly marked | PASS | `BRIEF.md` → §7 "Deferred ideas" (grafo NET, motivo ambiental, mockups de todas las pantallas, ordenamiento por métrica del directorio, implementación de producción); `19-CONTEXT.md` → `<deferred>` |
| P9 | **Identity guard** — link a ficha solo si `estado_vinculo = confirmado`, si no nombre crudo + `IdentityMarker` | PASS | `DESIGN-SYSTEM.md` → §8 invariant #7 "Identity guard"; `SCREENS.md` → "## Invariants…" #4 + §5 lobby "contraparte raw text + `IdentityMarker`, never linked" |
| P10 | **Atribución por dataset** — CC BY 4.0 solo InfoProbidad; ChileCompra "mención de la fuente"; SERVEL "términos de uso por verificar" | PASS | `DESIGN-SYSTEM.md` → §8 invariant #10 "Attribution per dataset"; `SCREENS.md` → §6 "Attribution per dataset" + §8 source list; `BRIEF.md` → §5.6/§5.7 |
| P11 | **Civic colours are data, not brand** — `--camara`/`--senado` identify chamber only | PASS | `DESIGN-SYSTEM.md` → §1.3 "Civic & semantic colours" Invariant; `SCREENS.md` → "## Invariants…" #8 "Civic colours are data, not brand" |
| P12 | **AI etiquetada, fuente íntegra** — síntesis con modelo/scope/fuentes y la fuente intacta al lado | PASS | `DESIGN-SYSTEM.md` → §8 invariant #9 "AI labelled, source intact" + §5.2 `AiSummaryCallout`; `SCREENS.md` → §4 Idea matriz "`AiSummaryCallout` carrying `MODELO / SCOPE / FUENTES` chips, source shown intact" |

**Audit result:** all twelve principios rectores PASS, each with a concrete enforcement location.
The audited invariants span trazabilidad a la fuente, anti-insinuación (carril `mt-12`, never
composing money/lobby with a vote, no score), MONEY gated, no foto / no partido, PII never
rendered, identity guard, attribution per dataset (CC BY 4.0 only InfoProbidad; ChileCompra
mención de la fuente; SERVEL términos por verificar), civic colours as data, and AI labelled
with source intact.

---

## 5. Hard-constraints confirmation

- **No `app/` source modified.** This phase produced only Markdown closure/spec artifacts and one
  throwaway HTML mockup that lives in the phase directory (`mockup/landing.html`), explicitly NOT
  in `app/`. No file under `app/` was touched by Plan 19-05. The only HTML artifact in the phase
  is the throwaway mockup.
- **MONEY not turned on.** No gate flag was changed. The design documents the OFF (default) state
  as node/route absence and the future ON state; the gate stays OFF until LEGAL-01.
- **No DB / RLS / conector changes.** No migration, no RPC, no connector, no allowlist, and no
  `.env` change was made. This is a design/product phase only.
- **No invented data or feature.** Every surface in `BRIEF.md` §5 exploits only shipped data;
  everything without data is recorded in `BRIEF.md` §7 "Deferred ideas".

---

## 6. Sign-off (CERRADO)

The consolidated deliverable — **`BRIEF.md` + `DESIGN-SYSTEM.md` + `SCREENS.md` +
`mockup/landing.html`** — is hereby marked **CERRADO**.

- All 5 Phase-19 success criteria are **MET** (§3), each with a concrete artifact + section
  citation. SC1 is MET strictly because all six browseros screenshots exist on disk (§2.5).
- All twelve principios rectores are **PASS**, each with its enforcement location (§4).
- The hard constraints were honoured: no `app/` source modified, MONEY not turned on, no
  DB/RLS/conector change, no invented data (§5).

**Closure statement.** The design contract is frozen. Any later implementation phase **follows
this brief without re-opening decisions**: tokens, typography, spacing, component catalogue,
editorial voice, honest states, anti-insinuación invariants, IA/navigation, the per-screen
contracts, and the deferred-ideas boundary are all fixed by the four artifacts above and the
approved `19-UI-SPEC.md`.

**Next: implementation phase.** A future implementation phase wires the documented system into
`app/` (cream/petrol tokens into `globals.css` per `DESIGN-SYSTEM.md` §4 wiring note, the
`GlobalHeader` into `layout.tsx`, the `/parlamentario` directory route), building each screen
directly from `SCREENS.md` + `DESIGN-SYSTEM.md`. It introduces no decision not already fixed
here and adds no component not already in the closed catalogue.

**Estado del entregable consolidado: CERRADO.**
