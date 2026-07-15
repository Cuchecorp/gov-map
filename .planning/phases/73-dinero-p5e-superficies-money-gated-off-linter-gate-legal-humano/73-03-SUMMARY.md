---
phase: 73
plan: 03
subsystem: money-surfaces
tags: [money, anti-insinuacion, linter, guard, rut-vs-nombre, mutation-self-check, tildes]
requires:
  - app/lib/anti-insinuacion-guard.test.ts (Phase 68 linter: stripTsComments, buildTermRegex, detectarInsinuaciones, SUPERFICIES_VOTO, TERMINOS_PROHIBIDOS, NEGACIONES_LOCKED)
  - app/lib/money-presentacion.ts (LEYENDA_ANTI_INSINUACION_MONEY, from 73-01)
  - 4 MONEY surfaces + /contraparte page (factual copy, from 73-02)
provides:
  - Anti-insinuation linter extended to the 4 MONEY surfaces + /contraparte page (SUPERFICIES_MONEY)
  - Money causal/insinuation blocklist with exact tildes appended to TERMINOS_PROHIBIDOS
  - MONEY legend subtracted from NEGACIONES_LOCKED (imported verbatim, no self-trip)
  - MONEY mutation self-check + no-false-positive cases (Enlazado por RUT / empresa_ligada_por_rut / legend)
affects:
  - plan 73-04 (dossier documents the extended linter as the anti-insinuation mitigation for MONEY)
tech-stack:
  added: []
  patterns:
    - extend the Phase 68 linter file (reuse helpers verbatim, grow the constant arrays) — no new file
    - separate SUPERFICIES_VOTO / SUPERFICIES_MONEY arrays, loop scans [...voto, ...money] (RESEARCH Pattern 3 (b))
    - import the MONEY legend into NEGACIONES_LOCKED so the legend that enforces the rule does not self-caze (Pitfall 1)
    - block the insinuating "empresa ligada a" (with preposition), never the factual "Enlazado por RUT" / snake_case identifier (Pitfall 3)
key-files:
  created:
    - .planning/phases/73-dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano/73-03-SUMMARY.md
  modified:
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "Kept SUPERFICIES_VOTO and SUPERFICIES_MONEY as separate arrays (RESEARCH Pattern 3 decision (b)) for legibility of the voto/dinero cut; the guard loop concatenates them."
  - "Dropped the duplicate 'financió su voto' from the MONEY block (already present in the voto section); 'financió' alone covers the substring-free case and avoids a double push into hits."
  - "Imported LEYENDA_ANTI_INSINUACION_MONEY into NEGACIONES_LOCKED verbatim (single-source) rather than re-typing the text — a copy change stays in money-presentacion.ts only."
metrics:
  duration: ~10 min
  completed: 2026-07-14
  tasks: 2
  files: 1
---

# Phase 73 Plan 03: Anti-Insinuation Linter Extended to MONEY Surfaces Summary

Extended the Phase 68 anti-insinuation linter (`app/lib/anti-insinuacion-guard.test.ts`) to cover the 4 MONEY surfaces plus the `/contraparte` page with an exact-tilde causal/insinuation blocklist, subtracting the MONEY legend so it does not self-trip, and a MONEY mutation self-check proving the guard bites without false-positiving on the factual "Enlazado por RUT" copy.

## What Was Built

**Task 1 — Linter extension (commit `dd266c4`):**
- Added `SUPERFICIES_MONEY` (relative to `app/`): `components/contratos-de-parlamentario.tsx`, `components/financiamiento-de-parlamentario.tsx`, `components/contratos-por-contraparte.tsx`, `components/aportes-por-contraparte.tsx`, `app/contraparte/[id]/page.tsx`. `app/parlamentario/[id]/page.tsx` is NOT duplicated (already in `SUPERFICIES_VOTO`, mounts the gated MONEY sections).
- Guard loop now scans `[...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY]`; the try/catch that skips absent paths is preserved.
- Appended the MONEY causal/insinuation terms to `TERMINOS_PROHIBIDOS` with exact tildes (Pitfall 2 — `buildTermRegex` is case-insensitive but NOT accent-insensitive): `financió`, `a cambio del voto`, `compró`, `compró su voto`, `pagó por`, `soborno`, `coima`, `corrupción`, `favoreció`, `empresa ligada a`, `conflicto de interés`, `influencia`, `captura`, `lobby a cambio`, `contrato a dedo`, `direccionado`. (`a cambio de` and `financió su voto` already came from the voto rail.)
- Imported `LEYENDA_ANTI_INSINUACION_MONEY` from `@/lib/money-presentacion` and added it to `NEGACIONES_LOCKED` so the legend (which negates "influencia"/"intención"/"irregularidad" / "compre una decisión") is subtracted before matching (Pitfall 1).

**Task 2 — Mutation self-check + no-false-positive (commit `323483a`):**
- MONEY mutation self-checks (in-memory fixtures): `financió su voto a cambio de un contrato` catches `financió`/`financió su voto`/`a cambio de`; `empresa ligada a un caso de corrupción; conflicto de interés evidente` catches `empresa ligada a`/`corrupción`/`conflicto de interés`; `contrato a dedo` catches `contrato a dedo`.
- No-false-positive cases: the factual `Enlazado por RUT al parlamentario.`, `Asociado por nombre confirmado al candidato.`, the snake_case identifier `empresa_ligada_por_rut` (word-boundary), and the full `LEYENDA_ANTI_INSINUACION_MONEY` mounted in a fixture all return `[]`.

## Verification

- `pnpm --filter ./app test lib/anti-insinuacion-guard.test.ts` → 16 tests green (0 offenders on the current 73-02 tree).
- `pnpm --filter ./app test` → 74 files, 809 tests green (no regression on the voto rail).
- Grep-verifiable: `SUPERFICIES_MONEY`, `contratos-por-contraparte`, `app/contraparte/[id]/page.tsx`, `LEYENDA_ANTI_INSINUACION_MONEY` all present in the file.

## Deviations from Plan

None of substance. One minor implementation choice: dropped the duplicate `financió su voto` from the MONEY block since it already exists in the voto section — documented as a decision above (avoids a double push into `hits`; `financió` still covers the term).

## Pitfalls Honored

- **Pitfall 1 (legend self-trip):** MONEY legend imported verbatim into `NEGACIONES_LOCKED`; a no-false-positive test mounts the full legend and expects `[]`.
- **Pitfall 2 (tildes):** all MONEY terms written with exact tildes; mutation self-check proves `financió` bites.
- **Pitfall 3 (RUT vs insinuation):** blocked `empresa ligada a` (with preposition `a`), never the factual `Enlazado por RUT` / `ligada por RUT` / the snake_case identifier — three no-false-positive tests confirm.

## Gate Discipline

No MONEY flip, no gate/default change, no dossier sign-off. Scope was linter (test file) only — a single `*.test.ts` modified; the gate (`money-gate.ts`) and `.env.example` were not touched.

## Self-Check: PASSED
- `app/lib/anti-insinuacion-guard.test.ts` — FOUND (modified)
- Commit `dd266c4` (Task 1) — FOUND
- Commit `323483a` (Task 2) — FOUND
