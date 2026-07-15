---
phase: 80
slug: bento-guards-responsive-a11y-dark-candados-de-r-gimen
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 80 — Validation Strategy

> Derived from 80-RESEARCH.md §Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + RTL (jsdom) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test -- --run bento-guards page anti-insinuacion` |
| **Full suite command** | `pnpm --filter ./app test -- --run` + `pnpm --filter ./app exec tsc --noEmit` |

## Sampling Rate

- **Per task commit:** targeted guard/page tests
- **Per wave:** full suite + tsc
- **Phase gate:** suite completa verde (base 885 + nuevos) + los 3 guards DEMOSTRADAMENTE mordiendo (mutation self-check en el propio test)

## Per-Task Verification Map

| Task | Requirement | Behavior | Automated Command | Status |
|------|-------------|----------|-------------------|--------|
| Colapso + orden + landmarks | BENTO-05 | test estructura home: 8 tiles orden DOM hero→cómo-leer→entradas×3→votado→urgencias→frescura; grid-cols-1 md:grid-cols-6; un main; sections con heading | `--run page` | ⬜ |
| A11y fixes | BENTO-05 | aria-label en form SearchBox; focus-visible clases fijadas en BentoTile-links; min-h-11 | `--run search-box bento page` | ⬜ |
| Dark | BENTO-05 | test estructura: tiles usan tokens theme-aware; barra cívica: par dark de --camara/--senado añadido en civic-tokens.css O degradación documentada; accent fill pinned test | `--run bento globals` | ⬜ |
| Candado cero-hex | BENTO-06 | regex hex sobre components/bento/ (+ page.tsx + actualidad-module.tsx) FALLA en rojo; mutation self-check | `--run bento-guards` | ⬜ |
| Guard tipográfico tiles | BENTO-06 | whitelist 13 valores px sancionados en superficies bento .tsx; mutation self-check | `--run bento-guards` | ⬜ |
| Linter extendido | BENTO-06 | SUPERFICIES_HOME (page.tsx + actualidad-module.tsx) en el bucle del linter; verde; self-check existente cubre | `--run anti-insinuacion` | ⬜ |
| BrandIcon | BENTO-06 | default currentColor (ambos callers pasan color explícito — verificado) | `--run brand-icon` o suite | ⬜ |
| No regressions | ambos | suite completa verde + tsc | full | ⬜ |

## Wave 0 Requirements

- [ ] `app/lib/bento-guards.test.ts` (o components/) — hex + tipografía con fixtures mutados
- [ ] Extensión in-place anti-insinuacion-guard.test.ts
- [ ] Test estructura home colapso/orden/landmarks
- Framework install: none

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Sticky header móvil real + colapso visual 390px | jsdom no ve layout | Phase 81 BrowserOS CSS 390px |
| Contraste real barra cívica en dark | jsdom no computa | Phase 81 o cálculo manual documentado |
