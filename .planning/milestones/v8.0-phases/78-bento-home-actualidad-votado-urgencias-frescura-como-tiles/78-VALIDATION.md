---
phase: 78
slug: bento-home-actualidad-votado-urgencias-frescura-como-tiles
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 78 — Validation Strategy

> Derived from 78-RESEARCH.md §Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react (jsdom) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test -- --run actualidad page` |
| **Full suite command** | `pnpm --filter ./app test -- --run` + `pnpm --filter ./app exec tsc --noEmit` |
| **Estimated runtime** | ~35-55 s |

## Sampling Rate

- **Per task commit:** targeted `--run actualidad page`
- **Per wave:** full app suite + tsc
- **Phase gate:** suite completa verde + anti-insinuación verde

## Per-Task Verification Map

| Task | Requirement | Behavior | Automated Command | Status |
|------|-------------|----------|-------------------|--------|
| Votado tile span-4 | BENTO-03 | barra 3px `bg-[var(--camara)]`/`bg-[var(--senado)]` + label camara ("diputados"→"Cámara"), tally mono en-dash verbatim, "Ver fuente oficial ↗" safeExternalHref, SIN "Ver todo" (no hay ruta honesta), empty state honesto verbatim | `pnpm --filter ./app test -- --run actualidad` | ⬜ |
| Data touch | BENTO-03 | select añade SOLO `camara` a la query votacion existente (no-PII); degradación honesta sin barra/label si null | `pnpm --filter ./app test -- --run actualidad` | ⬜ |
| Urgencias tile span-2 | BENTO-03 | chip pill `bg-accent-product-soft` tipo suma/simple, "desde {fecha}" mono, urgenciaVigente() intacto | `pnpm --filter ./app test -- --run actualidad` | ⬜ |
| Frescura strip span-6 | BENTO-03 | dot 6px petróleo token, fuente+fecha mono, flex-wrap, condicional (omit si 0) | `pnpm --filter ./app test -- --run actualidad` | ⬜ |
| Retiro módulo lineal | BENTO-03 | ActualidadModule wrapper/Panel retirados; tiles montados en BentoGrid; sin duplicación | `pnpm --filter ./app test -- --run page actualidad` | ⬜ |
| Migración tests | BENTO-03 | tests actuales migrados incl. empty states + GATE §9.1 in-file conservado | full suite | ⬜ |
| No regressions | BENTO-03 | suite verde (base 863) + tsc limpio; cero hex; cero bare [--token]; cero doble-hsl | full suite | ⬜ |

## Wave 0 Requirements

- [ ] Migrar tests de `actualidad-module` a los tiles (asserts nuevos: barra por token var, chip soft, dot, spans, empty states verbatim)
- [ ] Extender asserts de page.test.tsx (grid ahora con 8 hijos / tiles nuevos montados, orden DOM)
- Framework install: none

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Layout real spans 4/2/6 + wrap del strip | jsdom no ve layout | BrowserOS Phase 79/81 |
