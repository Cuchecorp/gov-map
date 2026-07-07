---
phase: 54
source: 54-RESEARCH.md §Validation Architecture (gate 8e)
created: 2026-07-07
---

# Phase 54: UXDEMO — Validation Strategy

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.6 + jsdom 29 + @testing-library/react 16.3 (globals: true) |
| Config file | `app/vitest.config.ts` (+ `app/vitest.setup.ts`; alias `@` y shim `server-only` ya resueltos) |
| Quick run command | `cd app && npx vitest run lib/format.test.ts` (o el test del componente tocado) |
| Full suite command | `pnpm test` desde repo root (packages/* + app; baseline **565/565**) + `pnpm typecheck` (`tsc -b`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-02/C1 | `formatNombre`: tabla del SPEC + 4 casos de datos reales + idempotencia | unit | `cd app && npx vitest run lib/format.test.ts` | ✅ `app/lib/format.test.ts` (extender) |
| UX-02/C1 | 11 superficies renderizan formateado; keys/hrefs RAW | unit (RTL) | `cd app && npx vitest run components/parlamentario-header.test.tsx components/lobby-en-tramitacion.test.tsx …` | ✅ todos los componentes del inventario tienen test co-localizado (verificado por ls) |
| UX-02/C2 | 3 tarjetas: nav aria-label, 3 Links con hrefs, copy exacto, sin heading, banned-vocab | unit (RTL) | `cd app && npx vitest run app/page.test.tsx` | ✅ `app/app/page.test.tsx` (extender) |
| UX-02/C3 | Microcopy: cruces (1 frase integrada), rebeldías (string byte-identical relocalizado, nunca ×2), patrimonio (1 frase) | unit (RTL) | `cd app && npx vitest run components/cruces-de-parlamentario.test.tsx components/votos-por-parlamentario.test.tsx components/patrimonio-de-parlamentario.test.tsx` | ✅ los 3 existen (extender; banned-vocab negative-match ya es patrón en ellos) |
| UX-02/C4 | RedGraph: clases `h-96 md:h-120` en lienzo, nota `md:hidden`, filtros intactos, empty-state byte-identical | unit (RTL) | `cd app && npx vitest run components/red/red-graph.test.tsx` | ✅ existe (extender) |
| UX-02/C5a | SearchBox no-hero con clases petróleo; hero branch byte-identical | unit (RTL) | `cd app && npx vitest run components/search-box.test.tsx` | ❌ Wave 0 (nuevo, pequeño) |
| UX-02/C5b | IdentityMarker con utilities planas `bg-identity-warn-bg…` (sin arbitrary-var) | unit (RTL) | `cd app && npx vitest run components/identity-marker.test.tsx` | ❌ Wave 0 (nuevo, pequeño) — o assert dentro de `lobby-de-parlamentario.test.tsx` (✅ existe) |
| UX-02/C5c | Skeletons con fila breadcrumb (ParlamentarioHeaderSkeleton + HeaderSkeleton de contraparte) | unit (RTL) o code-review | — (skeletons viven inline en `app/app/parlamentario/[id]/page.tsx:440-451` y `app/app/contraparte/[id]/page.tsx:161-169`; asertables solo si se exportan — aceptable verificar por review + screenshot) | manual-ok |
| UX-02/C6 + smoke | Screenshots ≥6 full-width post-deploy + superficies 200 + gate NET ON live / OFF por test | manual-only | `node scripts/rewalk-shot.mjs …` + curl 200s | Justificación: requiere PROD desplegado + BrowserOS; el estado OFF del gate se cubre con el test existente `lib/net-gate.test.ts` (✅) — NUNCA flipeando PROD |

### Sampling Rate
- **Per task commit:** vitest run del/los archivo(s) de test co-localizados tocados (<30s c/u).
- **Per wave merge:** `pnpm --filter ./app test` + `pnpm typecheck`.
- **Phase gate:** `pnpm test` completo desde root (≥565 verde, sin regresión) + `tsc -b` limpio + lockdown-guard verde (dentro de la suite) antes de `/gsd:verify-work`; smoke + screenshots DESPUÉS del deploy final.

### Wave 0 Gaps
- [ ] `app/components/search-box.test.tsx` — cubre UX-02/C5a (branch hero byte-identical + no-hero petróleo)
- [ ] Assert de clases identity-warn — nuevo `app/components/identity-marker.test.tsx` O extender `lobby-de-parlamentario.test.tsx` (existe)
- Framework: ninguno que instalar — infraestructura completa (config, setup, jsdom, RTL, 565 tests baseline).
