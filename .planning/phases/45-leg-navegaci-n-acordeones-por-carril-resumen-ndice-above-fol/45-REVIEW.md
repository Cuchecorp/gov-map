---
phase: 45-leg-navegacion-acordeones-por-carril-resumen-indice-above-fold
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/components/carril-accordion.tsx
  - app/components/carril-accordion.test.tsx
  - app/lib/parlamentario-resumen-conteos.ts
  - app/lib/parlamentario-resumen-conteos.test.ts
  - app/components/parlamentario-resumen.tsx
  - app/components/parlamentario-resumen.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/parlamentario/[id]/page-estructura.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: findings
---

# Phase 45: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The Phase 45 re-layout (accordion-per-carril + above-fold resumen/index) holds up well
on its two highest-stakes invariants:

- **SSR no-leak (T-45-01):** `carril-accordion.tsx` stays `"use client"` and imports
  only `react`, `@radix-ui/react-accordion`, and `@/lib/utils`. No section component,
  no `@/lib/supabase`, no `createServerSupabase`. Verified by grep — the no-leak grep
  tests will pass (no `Section`/Supabase token in the source). Sections are received as
  `children`; the page (server) owns the imports. Invariant satisfied.
- **Lockdown allowlist (Block B):** `parlamentario-resumen-conteos.ts` is
  `import "server-only"` and touches only allowlisted RPCs (`votos_de_parlamentario`,
  `lobby_de_parlamentario`, `declaraciones_de_parlamentario`, `cruces_de_parlamentario`,
  `contratos_de_parlamentario`, `aportes_de_parlamentario`) plus the non-PII
  `lobby_ingesta_estado` / `probidad_ingesta_estado` tables (neither in `PII_TABLES`).
  No `.from('parlamentario')`. The `ingestaCorrio` helper type-restricts the table arg
  to the two ingesta markers. Guard passes.
- **Honest 3-state + gates:** `derivarEstado` never fabricates density; gate replication
  for cruces/money matches `page.tsx` byte-for-byte; `#34` throw-on-error is applied to
  every RPC and `.from()`. The lobby count rule (distinct `identificador`) matches
  `agruparAudiencias` in the section exactly, and the votos cap (`p_limit: 1000`) mirrors
  `VotosSection`.

The defects below are real but mostly **latent** (dormant behind the currently-OFF MONEY
gate) or robustness/UX regressions rather than correctness-in-production-today. No
BLOCKER-class issue: nothing reachable in the current (MONEY OFF, CRUCES ON) configuration
produces incorrect or unsafe output.

## Warnings

### WR-01: MONEY-ON renders both money carriles with the same combined count (latent honesty defect)

**File:** `app/app/parlamentario/[id]/page.tsx:207, 233` (source: `app/lib/parlamentario-resumen-conteos.ts:200-203`)
**Issue:** `conteos.dinero` is the **sum** of contratos + aportes
(`(contratosData?.length ?? 0) + (aportesData?.length ?? 0)`). When MONEY is ON, the page
renders two *separate* carriles — `#dinero` ("Contratos del Estado asociados al RUT") and
`#financiamiento` ("Aportes de campaña registrados en SERVEL") — and **both** accordion
headers display `conteoLabel(conteos.dinero)`, i.e. the combined total. So the Contratos
header would claim e.g. `20` while its body shows only the contracts, and the Aportes
header would also claim `20` while its body shows only the aportes. Each per-carril header
over-states its own carril — a fabricated-density / anti-insinuación violation, on the most
legally sensitive surface. Dormant today (MONEY OFF, gated behind human legal sign-off),
but it ships wrong and fires the moment the flag flips.
**Fix:** Split the money count into two honest states and feed each carril its own. In
`ConteoCarriles` expose `contratos` and `aportes` (or `dineroContratos`/`dineroAportes`)
separately:
```ts
const contratos = derivarEstado({ total: contratosData?.length ?? 0, ingestado: true });
const aportes   = derivarEstado({ total: aportesData?.length ?? 0,  ingestado: true });
return { votos, lobby, patrimonio, cruces, contratos, aportes };
```
then `conteo={conteoLabel(conteos.contratos)}` for `#dinero` and
`conteo={conteoLabel(conteos.aportes)}` for `#financiamiento`. The single combined resumen
chip can keep summing both if desired.

### WR-02: Eager `await contarCarriles(id)` outside Suspense defeats per-section streaming and crashes the whole ficha on any single-carril RPC error

**File:** `app/app/parlamentario/[id]/page.tsx:95`
**Issue:** `const conteos = await contarCarriles(id);` runs in the page body *before* the
JSX returns, so it blocks the entire shell (header + resumen + all accordions) on the
slowest of the votos/lobby+ingesta/patrimonio+ingesta/cruces round-trips. Worse, because
each of those RPCs follows the `#34` throw-on-error pattern, a single transient failure in
*any* carril count throws out of `contarCarriles` and takes down the whole page — including
the `ParlamentarioHeader`, which is otherwise isolated in its own `<Suspense>`. This negates
the per-section Suspense boundaries that exist specifically to let one carril fail/stream
independently of the others.
**Fix:** Move the count fetch behind a Suspense boundary so the header/shell can stream
independently. Either render the accordion headers from a small server child that awaits
`contarCarriles` inside `<Suspense>`, or have each `CarrilAccordion` resolve its own count
via the `React.cache`-deduped `contarCarriles` inside its own Suspense subtree, so a count
failure degrades only that carril’s header rather than the whole ficha.

### WR-03: Votos count caps at 1000 and is presented as an exact number

**File:** `app/lib/parlamentario-resumen-conteos.ts:103-113`
**Issue:** The count is `votosData.length` from `votos_de_parlamentario` with
`p_limit: 1000`. For a parlamentario with more than 1000 confirmed votes, the header/chip
displays `1000` as if it were the exact tally — a silently truncated number presented as a
hard fact, which the project’s honesty/anti-insinuación principle explicitly forbids. This
faithfully mirrors the same cap in `VotosSection` (so chip and section agree), but the
underlying limitation is real and the resumen presents it as precise density. Current data
volume (≈10 votaciones) keeps it dormant.
**Fix:** Use a dedicated count RPC, or detect saturation and degrade honestly (e.g. show
`1000+` when `length === 1000`):
```ts
const votosTotal = (votosData as unknown[] | null)?.length ?? 0;
const saturado = votosTotal === 1000; // surface "1000+" instead of an exact "1000"
```
Track the same fix in `VotosSection` so both stay consistent.

## Info

### IN-01: Accordion-header count for `no_ingerido` loses the screen-reader label that the resumen chip carries

**File:** `app/app/parlamentario/[id]/page.tsx:56-67` vs `app/components/parlamentario-resumen.tsx:40-46`
**Issue:** In the resumen, the `no_ingerido` state renders the em dash with
`aria-label="no ingerido todavía"` (`ChipConteo`). In the accordion header the same state
goes through `conteoLabel`, which returns the bare string `"—"` — a screen reader announces
just "em dash" (or nothing), with no semantic hint. Same honest state, two different
accessible presentations.
**Fix:** Either pass the `CarrilEstado`/`ChipConteo` into `CarrilAccordion` (it already
accepts `conteo: React.ReactNode`, so you can pass the rich node instead of a string), or
add an equivalent visually-hidden label in the header for the `no_ingerido`/`vacio`/
`pendiente` cases.

### IN-02: `ResumenSkeleton` hardcodes 4 chips while the live resumen can render 5

**File:** `app/app/parlamentario/[id]/page.tsx:348-356`
**Issue:** The skeleton always renders 4 chip placeholders, but with CRUCES ON + MONEY OFF
(the current config) the resumen renders 5 chips (votos, lobby, patrimonio, cruces,
financiamiento-pendiente). The fallback-to-content swap causes a visible layout shift / count
mismatch.
**Fix:** Drive the placeholder count from the same gate logic, or render 5 placeholders to
match the current maximal-present configuration.

### IN-03: MONEY-ON resumen has one combined `#dinero` chip but the page renders two money sections

**File:** `app/components/parlamentario-resumen.tsx:112-119` vs `app/app/parlamentario/[id]/page.tsx:204, 229`
**Issue:** With MONEY ON the resumen emits a single chip `#dinero` ("Contratos y
financiamiento"), but the page renders two anchored carriles, `#dinero` and
`#financiamiento`. The index chip therefore can only jump to `#dinero`; the `#financiamiento`
carril has no corresponding index entry. Dormant under MONEY OFF, but the index becomes
incomplete the moment the gate flips. Pairs with WR-01 (both stem from collapsing the two
money carriles into one count/chip).
**Fix:** When MONEY is ON, emit two chips (`#dinero` and `#financiamiento`) so every present
carril has an index entry, consistent with the LEG-02 "one chip per present carril" rule.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
