---
phase: 53
source: 53-RESEARCH.md §Validation Architecture (extraído por revisión del plan-checker, gate 8e)
created: 2026-07-07
---

# Phase 53: UXNAV — Validation Strategy

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (`app/vitest.config.ts`) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --dir app exec vitest run components/header-nav.test.tsx` (o el archivo tocado) |
| Full suite command | `pnpm --dir app test -- --run` (541 tests hoy) + `pnpm --dir app exec tsc -b` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 nav | NAV_ITEMS = 5 ítems (incl. Red), label "Sobre", active-state intacto | unit RTL | `pnpm --dir app exec vitest run components/header-nav.test.tsx` | ❌ Wave 0 (no existe test del HeaderNav) |
| UX-01 breadcrumbs | Breadcrumbs render (links, aria-current, mono, sin heading) | unit RTL | `pnpm --dir app exec vitest run components/breadcrumbs.test.tsx` | ❌ Wave 0 (componente nuevo) |
| UX-01 fichas | páginas renderizan breadcrumb con crumbs correctos | unit RTL (page tests existentes) | `pnpm --dir app exec vitest run app/parlamentario` | ✅ extender page.test.tsx existentes |
| UX-01 continuation | shipped empty-copy byte-idéntico + línea nueva con 1 link | unit RTL | vitest run de cada componente tocado | ✅ extender tests existentes (votos/lobby/red-graph/agenda) |
| UX-01 anti-insinuación | negative-match banned-vocab sobre strings nuevos | unit (sweep existente) | full suite | ✅ |
| UX-01 no-regresión | lockdown-guard, tsc, suite completa | integración | `pnpm --dir app test -- --run` + `tsc -b` | ✅ |
| UX-01 journeys/evidencia | ≥4 journeys × 2 viewports con screenshots; before/after por P0 | **manual-only** (BrowserOS contra PROD) | protocolo §Mechanics; verificable por presencia de archivos en `ux-evidence/` + tablas del informe | — (naturaleza de auditoría en vivo) |

### Sampling Rate
- **Per task commit:** vitest run del archivo tocado + `tsc -b` si cambió un tipo
- **Per wave merge:** `pnpm --dir app test -- --run`
- **Phase gate:** full suite verde + tsc limpio ANTES del redeploy; re-walkthrough DESPUÉS del redeploy

### Wave 0 Gaps
- [ ] `app/components/header-nav.test.tsx` — 5 ítems, hrefs, label "Sobre", active por prefix
- [ ] `app/components/breadcrumbs.test.tsx` — links/current/aria/mono
- (las líneas de continuación se asertan en los test files existentes de cada componente — no son gap de Wave 0 porque dependen de qué superficies marque la auditoría)
