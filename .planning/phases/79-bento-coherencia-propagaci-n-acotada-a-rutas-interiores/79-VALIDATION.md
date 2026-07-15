---
phase: 79
slug: bento-coherencia-propagaci-n-acotada-a-rutas-interiores
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 79 — Validation Strategy

> Derived from 79-UI-SPEC.md (enumeración por ruta verificada) + 76-RESEARCH.md §Container Map.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + RTL (jsdom) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test -- --run <route-filter>` |
| **Full suite command** | `pnpm --filter ./app test -- --run` + `pnpm --filter ./app exec tsc --noEmit` |

## Sampling Rate

- **Per task commit:** targeted tests de la ruta tocada
- **Per wave:** full suite + tsc
- **Phase gate:** suite verde + guard tipográfico verde + `red-graph.test.tsx` (.net-chip 11px) verde + capturas BrowserOS antes/después archivadas

## Per-Task Verification Map

| Task | Requirement | Behavior | Automated Command | Status |
|------|-------------|----------|-------------------|--------|
| /buscar | BENTO-04 | container 1120px; cards primer nivel rounded-[var(--radius-tile)]; interiores intactos | `--run buscar` | ⬜ |
| /parlamentarios | BENTO-04 | container 1120px; directory-row + empty box radius | `--run parlamentario` | ⬜ |
| /agenda | BENTO-04 | container 1120px; li/empty radius | `--run agenda` | ⬜ |
| /sobre + /metodologia | BENTO-04 | container-only (prose) | `--run sobre metodologia` | ⬜ |
| fichas ×3 | BENTO-04 | container + paneles exteriores; interiores byte-idénticos; scroll-mt-6 local reconciliado (≥ header) | `--run "parlamentario/\[id\]" proyecto contraparte` | ⬜ |
| /red exclusión | BENTO-04 | /red sin cambio de container; red-graph.test.tsx verde; .net-* intocado | `--run red` | ⬜ |
| card.tsx firewall | BENTO-04 | card.tsx NO editado (git diff limpio sobre components/ui/card.tsx) | `git diff --stat` | ⬜ |
| No regressions | BENTO-04 | suite verde (base 870) + tsc + guard tipográfico | full | ⬜ |

## Wave 0 Requirements

- [ ] Extender tests por ruta con asserts de container/radius donde existan tests de página (source-scan o RTL según convención por archivo)
- Framework install: none

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Diff visual por ruta = SOLO radio/contenedor | jsdom no ve layout | Capturas BrowserOS antes/después por el ORQUESTADOR sobre dev local (8 rutas), archivadas en `captures/` |
| /red no-regresión px | getComputedStyle solo en deploy | Phase 81 (gate visual, cierra también gate 75) |
