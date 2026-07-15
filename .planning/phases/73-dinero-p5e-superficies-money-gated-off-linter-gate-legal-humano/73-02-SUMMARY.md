---
phase: 73
plan: 02
subsystem: money-surfaces
tags: [money, anti-insinuacion, leyenda, rut-vs-nombre, rtl, single-source]
requires:
  - app/lib/money-presentacion.ts (LEYENDA_ANTI_INSINUACION_MONEY, from 73-01)
provides:
  - MONEY legend mounted 1× per state on all 4 MONEY surfaces
  - RTL per-surface assertions (legend once + RUT-vs-name discipline)
affects:
  - plan 73-03 (linter now scans the 4 surfaces; legend subtracted from NEGACIONES_LOCKED)
  - plan 73-04 (dossier documents the mounted legend as the anti-insinuation mitigation)
tech-stack:
  added: []
  patterns:
    - local LeyendaMoney() per surface renders the single-source imported constant (never inline duplicated)
    - legend as first child of every state branch, above Intro (mirror Phase 68 voto-detalle)
    - RTL subtracts the generic legend from container text before anti-"por RUT"/"RUT" asserts (RUT-vs-name not conflated)
key-files:
  created: []
  modified:
    - app/components/contratos-de-parlamentario.tsx
    - app/components/financiamiento-de-parlamentario.tsx
    - app/components/contratos-por-contraparte.tsx
    - app/components/aportes-por-contraparte.tsx
    - app/components/contratos-de-parlamentario.test.tsx
    - app/components/financiamiento-de-parlamentario.test.tsx
    - app/components/contratos-por-contraparte.test.tsx
    - app/components/aportes-por-contraparte.test.tsx
decisions:
  - "The single-source legend legitimately contains 'vínculo por RUT' as a NEGATED concept, so it is valid on by-name surfaces too. The by-name invariant ('never label THIS aporte's link as por RUT') is preserved by subtracting the legend text before /por RUT/ and /RUT/ negative asserts — not by suppressing the legend."
  - "Tightened financiamiento's empty-state count-line negative assert from /aporte registrado/ to /\\d+ aportes? registrados?\\./ because the legend phrase 'un aporte registrado es un hecho…' otherwise collides with the count-line matcher."
metrics:
  duration: ~25m
  completed: 2026-07-14
  tasks: 2
  files: 8
---

# Phase 73 Plan 02: MONEY legend on 4 surfaces + RTL (RUT-vs-name) Summary

Mounted `LEYENDA_ANTI_INSINUACION_MONEY` (the single-source constant from 73-01) as the
first child — above `<Intro/>` — of every state branch of the four MONEY surfaces, using a
per-file local `LeyendaMoney()` that renders the imported constant with the LOCKED rail
treatment (`border-l-[3px] border-[--primary] pl-2.5 mb-4`). Extended the four `*.test.tsx`
to assert the legend renders EXACTLY once per state and that the RUT-vs-name basis is never
conflated. Full app suite 802 pass (788 → 802, +14 legend tests, no regression); the 73-01
anti-flip guard stays green; `money-gate.ts` and `.env.example` untouched (gate still OFF).

## What was built

### Task 1 — legend on the 2 ficha surfaces (commit `6ca7de5`)
- `contratos-de-parlamentario.tsx`: import the constant; add local `LeyendaMoney()`; render it
  above `<Intro/>` in all 3 branches (`no_consultado` / `consultado_sin_contratos` / `enlazado`).
  Base RUT — the muted line "Enlazado por RUT al parlamentario." is preserved verbatim.
- `financiamiento-de-parlamentario.tsx`: same mount across its 3 branches
  (`no_ingestado` / `verificado_sin_aportes` / `enlazado`). Base NOMBRE — "Asociado por nombre
  confirmado al candidato." preserved; the surface's own copy never says "por RUT".
- RTL: `it.each` over the 3 states asserts `getAllByText(LEYENDA_ANTI_INSINUACION_MONEY).length === 1`
  (catches per-row duplication) plus a multi-row case. The financiamiento anti-"por RUT" / "RUT"
  asserts now subtract the generic legend (`sinLeyenda()`) so they only police the surface's own copy.

### Task 2 — legend on the 2 /contraparte surfaces + RTL for all 4 (commit `80285bd`)
- `contratos-por-contraparte.tsx` and `aportes-por-contraparte.tsx`: same `LeyendaMoney()` mount
  above `<Intro/>` in both state branches (`no_consultado` / `con_contratos`|`con_aportes`).
- RTL: legend-once `it.each` describe added to both `/contraparte` test files. The aportes-por-contraparte
  `/RUT/i` negative assert (Ley 21.719 discipline) now subtracts the generic legend so the by-name
  invariant ("this page never labels its own data 'por RUT'") is verified without the shared legend
  false-tripping it.

## RUT-vs-name discipline (LOCKED, verified)

| Surface | Base | Association copy (preserved) | RTL guard |
|---------|------|------------------------------|-----------|
| contratos-de-parlamentario | RUT-exacto | "Enlazado por RUT al parlamentario." | asserts phrase present per row |
| financiamiento-de-parlamentario | nombre confirmado | "Asociado por nombre confirmado al candidato." | asserts phrase; `not.toMatch(/por RUT/i)` on `sinLeyenda(texto)` |
| contratos-por-contraparte | RUT-exacto | (org-comprador foregrounded) | legend-once |
| aportes-por-contraparte | nombre confirmado | (candidato receptor muted, separate) | legend-once; `not.toMatch(/RUT/i)` on `sinLeyenda(texto)` |

The two bases are never conflated: by-name surfaces never render "ligada por RUT". The shared legend's
generic "vínculo por RUT" is a negated concept ("no es una afirmación de irregularidad"), valid everywhere,
and is subtracted from the surface's own-copy asserts rather than suppressed.

## Preservation (unchanged, asserted)

- `ProvenanceBadge` per row (fuente + fecha_captura + enlace) intact on all 4 surfaces.
- Monto VERBATIM (`x.monto ?? "No publicado"`, `font-mono`) — never "$0", never reformatted.
- Per-datum freshness: contract `fecha_corte` / `Elección:` per row / SERVEL cut-date lines intact.
- No red/green severity on money (amber = freshness only).

## Verification

- `pnpm vitest run` on the 4 surface tests → 66 pass.
- `pnpm --filter ./app test` → 74 files, 802 tests pass (788 → 802; +14 legend tests; no regression;
  73-01 `money-antiflip-guard.test.ts` still green).
- `pnpm --filter ./app typecheck` (tsc --noEmit) → clean.
- `git status --short app/lib/money-gate.ts .env.example` → empty (gate still `=== "true"`; `.env.example`
  still `=false`; MONEY not flipped).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Legend text collides with pre-existing negative asserts**
- **Found during:** Task 1 (surfaced as a test failure on the financiamiento empty state).
- **Issue:** The single-source legend contains "Un vínculo por RUT …" and "… un aporte registrado es un
  hecho público …". Mounting it made three pre-existing `not.toMatch(/por RUT/i)` / `not.toMatch(/RUT/i)`
  asserts (financiamiento) and one `/RUT/i` assert (aportes-por-contraparte) trip on the legend itself, and
  made financiamiento's empty-state count-line matcher `/aporte registrado/` match the legend phrase.
- **Fix:** Added a `sinLeyenda()` helper (subtracts the imported constant) in the two by-name test files and
  applied it before the anti-"por RUT"/"RUT" asserts, so they police only the surface's OWN copy. Tightened
  the count-line matcher to `/\d+ aportes? registrados?\./`. This preserves the exact anti-conflation intent
  (by-name surfaces never label their link "por RUT") while allowing the shared, negated legend.
- **Files modified:** `financiamiento-de-parlamentario.test.tsx`, `aportes-por-contraparte.test.tsx`
- **Commits:** `6ca7de5`, `80285bd`

## Anti-flip invariants confirmed (NOT flipped)

- `MONEY_PUBLIC_ENABLED` still OFF/default; `money-gate.ts` untouched (`=== "true"`).
- `.env.example` still `MONEY_PUBLIC_ENABLED=false`.
- No change to `money-gate.ts` logic; dossier signoff untouched (out of scope for this plan).

## Known Stubs

None. The 4 surfaces render live data behind the gate; this plan added static legend markup + tests only.

## Self-Check: PASSED
- FOUND: app/components/contratos-de-parlamentario.tsx (imports LEYENDA_ANTI_INSINUACION_MONEY)
- FOUND: app/components/financiamiento-de-parlamentario.tsx
- FOUND: app/components/contratos-por-contraparte.tsx
- FOUND: app/components/aportes-por-contraparte.tsx
- FOUND commit: 6ca7de5
- FOUND commit: 80285bd
