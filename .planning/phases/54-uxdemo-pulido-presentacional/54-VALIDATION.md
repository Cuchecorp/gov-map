---
phase: 54
source: 54-RESEARCH.md §Validation Architecture (gate 8e)
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
validated: 2026-07-08
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
| Req ID | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|--------|
| UX-02/C1 | `formatNombre`: tabla del SPEC + 4 casos de datos reales + idempotencia | unit | `cd app && npx vitest run lib/format.test.ts` (32/32) | ✅ green |
| UX-02/C1 | 11 superficies renderizan formateado; keys/hrefs RAW | unit (RTL) | `cd app && npx vitest run components/parlamentario-header.test.tsx components/lobby-en-tramitacion.test.tsx …` | ✅ green (suite) |
| UX-02/C2 | 3 tarjetas: nav aria-label, 3 Links con hrefs, copy exacto, sin heading, banned-vocab | unit (RTL) | `cd app && npx vitest run app/page.test.tsx` (12/12) | ✅ green |
| UX-02/C3 | Microcopy: cruces (1 frase integrada), rebeldías (string byte-identical relocalizado, nunca ×2), patrimonio (1 frase) | unit (RTL) | `cd app && npx vitest run components/cruces-de-parlamentario.test.tsx components/votos-por-parlamentario.test.tsx components/patrimonio-de-parlamentario.test.tsx` (127/127) | ✅ green |
| UX-02/C4 | RedGraph: clases `h-96 md:h-120` en lienzo, nota `md:hidden`, filtros intactos, empty-state byte-identical | unit (RTL) | `cd app && npx vitest run components/red/red-graph.test.tsx` (25/25) | ✅ green |
| UX-02/C5a | SearchBox no-hero con clases petróleo; hero branch byte-identical | unit (RTL) | `cd app && npx vitest run components/search-box.test.tsx` (3/3) | ✅ green (Wave 0 FILLED, 54-04) |
| UX-02/C5b | IdentityMarker con utilities planas `bg-identity-warn-bg…` (sin arbitrary-var) | unit (RTL) | `cd app && npx vitest run components/identity-marker.test.tsx` (3/3) | ✅ green (Wave 0 FILLED, 54-04) |
| UX-02/C5c | Skeletons con fila breadcrumb (ParlamentarioHeaderSkeleton + HeaderSkeleton de contraparte) | code-review + screenshot | skeletons inline en `parlamentario/[id]/page.tsx` y `contraparte/[id]/page.tsx` (no exportados) | ✅ manual (54-04 review + demo screenshots) |
| UX-02/C6 + smoke | Screenshots ≥6 full-width post-deploy + superficies 200 + gate NET ON live / OFF por test | manual-only | `node scripts/rewalk-shot.mjs …` + curl 200s | ✅ manual (54-05: 7 JPEG docs/demo/, 7 rutas 200, `lib/net-gate.test.ts` cubre OFF) |

### Sampling Rate
- **Per task commit:** vitest run del/los archivo(s) de test co-localizados tocados (<30s c/u).
- **Per wave merge:** `pnpm --filter ./app test` + `pnpm typecheck`.
- **Phase gate:** `pnpm test` completo desde root (≥565 verde, sin regresión) + `tsc -b` limpio + lockdown-guard verde (dentro de la suite) antes de `/gsd:verify-work`; smoke + screenshots DESPUÉS del deploy final.

### Wave 0 Gaps
- [x] `app/components/search-box.test.tsx` — FILLED en 54-04 (commit db3c699): hero byte-identical + no-hero petróleo, 3/3 verde
- [x] Assert de clases identity-warn — FILLED en 54-04 (commit a19644e): nuevo `app/components/identity-marker.test.tsx`, utilities planas / no arbitrary-var, 3/3 verde
- Framework: ninguno que instalar — infraestructura completa (config, setup, jsdom, RTL, 565 tests baseline → 594 al cierre de fase).

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
| Gaps found | 2 (Wave 0: search-box, identity-marker) |
| Resolved | 2 (ambos filled durante ejecución en 54-04) |
| Escalated | 0 |

UX-02 (contratos C1–C6) auditado: C1–C5 COVERED por 202 tests verdes en 8 archivos de contrato (`format` 32 · `page` 12 · `cruces` 13 · `patrimonio` 49 · `votos` 65 · `red-graph` 25 · `search-box` 3 · `identity-marker` 3), verificados esta corrida. Ambos gaps Wave 0 (C5a/C5b) ya estaban filled en 54-04. C5c (skeletons inline no exportados) y C6 (screenshots + smoke post-deploy) son manual-only por naturaleza — cubiertos por el review de 54-04 y el set de 7 JPEG + smoke 200 de 54-05. Cero gaps automatizables pendientes. Nyquist-compliant.
