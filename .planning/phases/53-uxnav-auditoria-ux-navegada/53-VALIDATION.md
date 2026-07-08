---
phase: 53
source: 53-RESEARCH.md §Validation Architecture (extraído por revisión del plan-checker, gate 8e)
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
validated: 2026-07-08
---

# Phase 53: UXNAV — Validation Strategy

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (`app/vitest.config.ts`) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `cd app && npx vitest run components/header-nav.test.tsx` (o el archivo tocado) |
| Full suite command | `cd app && npx vitest run` (594 al cierre) + `npx tsc -b` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|--------|
| UX-01 nav | NAV_ITEMS = 5 ítems (incl. Red), label "Sobre", active-state intacto | unit RTL | `cd app && npx vitest run components/header-nav.test.tsx` (8/8) | ✅ green (Wave 0 FILLED) |
| UX-01 breadcrumbs | Breadcrumbs render (links, aria-current, mono, sin heading) | unit RTL | `cd app && npx vitest run components/breadcrumbs.test.tsx` (6/6) | ✅ green (Wave 0 FILLED) |
| UX-01 fichas | páginas renderizan breadcrumb con crumbs correctos | unit RTL | `cd app && npx vitest run "app/parlamentario/[id]/page.test.tsx"` (14/14) | ✅ green |
| UX-01 continuation | shipped empty-copy byte-idéntico + línea nueva con 1 link | unit RTL | vitest run de cada componente tocado (votos/lobby/red-graph/agenda) | ✅ green (suite) |
| UX-01 anti-insinuación | negative-match banned-vocab sobre strings nuevos | unit (sweep existente) | full suite | ✅ green |
| UX-01 no-regresión | lockdown-guard, tsc, suite completa | integración | `cd app && npx vitest run lib/lockdown-guard.test.ts` (8/8) + `tsc -b` | ✅ green |
| UX-01 journeys/evidencia | ≥4 journeys × 2 viewports con screenshots; before/after por P0 | **manual-only** (BrowserOS contra PROD) | 53-UX-AUDIT.md (21 screenshots) + re-walkthrough post-deploy 7b35b99e | ✅ manual |

### Sampling Rate
- **Per task commit:** vitest run del archivo tocado + `tsc -b` si cambió un tipo
- **Per wave merge:** `cd app && npx vitest run`
- **Phase gate:** full suite verde + tsc limpio ANTES del redeploy; re-walkthrough DESPUÉS del redeploy

### Wave 0 Gaps
- [x] `app/components/header-nav.test.tsx` — 5 ítems, hrefs, label "Sobre", active por prefix. FILLED (8/8).
- [x] `app/components/breadcrumbs.test.tsx` — links/current/aria/mono. FILLED (6/6).
- (las líneas de continuación se asertan en los test files existentes de cada componente)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (ambos gaps filled)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 2 (Wave 0: header-nav, breadcrumbs) |
| Resolved | 2 (ambos filled durante ejecución de F53) |
| Escalated | 0 |

UX-01 COVERED por 36 tests verdes (`header-nav` 8 · `breadcrumbs` 6 · `page` 14 · `lockdown-guard` 8), verificados esta corrida. Ambos gaps Wave 0 ya estaban filled en ejecución. La auditoría navegada (≥4 journeys × 2 viewports, 21 screenshots en 53-UX-AUDIT.md) y el re-walkthrough post-deploy (7b35b99e) son manual-only por naturaleza. VERIFICATION previa passed 4/4. Cero gaps automatizables pendientes. Nyquist-compliant.
