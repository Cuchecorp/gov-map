---
phase: 45
slug: leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-26
validated: 2026-07-08
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `45-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 + @testing-library/react 16 (jsdom) |
| **Config file** | `app/vitest.config.ts` (alias `@`→`app/`, `server-only`→empty; jsdom; globals; setup `app/vitest.setup.ts`) |
| **Quick run command** | `cd app && npx vitest run <file>` |
| **Full suite command** | `cd app && npx vitest run && npx tsc -b` |
| **Estimated runtime** | ~40 s (6 files) |

> GOTCHA (memoria): el `pnpm test` de la RAÍZ no corre `app/` — ejecutar dentro de `app/`. Para `tsc -b` usar `references`, no `paths`. Source-scan tests usan `process.cwd()+path.join` (NO `new URL(import.meta.url)`, que jsdom rompe).

---

## Sampling Rate

- **After every task commit:** `cd app && npx vitest run <archivo afectado>`
- **After every plan wave:** `cd app && npx vitest run && npx tsc -b`
- **Before `/gsd:verify-work`:** suite `app/` completa verde + guard verde + `tsc` limpio; build OpenNext validado en Docker Linux (checkpoint operador para deploy).
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| LEG-01 | `CarrilAccordion`: `<h2>` visible abierto o cerrado; conteo en el header; trigger toggla `aria-expanded`/`data-state`; cuerpo (children) en el DOM (forceMount); no-leak grep del fuente | unit (RTL) | `cd app && npx vitest run components/carril-accordion.test.tsx` (5/5) | ✅ | ✅ green |
| LEG-01 | Frontera `mt-12`: cada carril su propia `<section mt-12>`; un acordeón por dominio; gates envuelven la sección entera | unit (estructural source-scan) | `cd app && npx vitest run "app/parlamentario/[id]/page-estructura.test.ts"` (7/7) | ✅ | ✅ green |
| LEG-02 | `ParlamentarioResumen`/`ResumenView`: un chip por carril, `href="#<carril>"`, 3-estado (dato/vacío-honesto/no-ingerido); MONEY OFF → honest-state nunca número; sin densidad falsa | unit (RTL vista pura + fixtures) | `cd app && npx vitest run components/parlamentario-resumen.test.tsx` (18/18) | ✅ | ✅ green |
| LEG-02 | Mapeo puro conteo→3-estado | unit | `cd app && npx vitest run lib/parlamentario-resumen-conteos.test.ts` (23/23) | ✅ | ✅ green |
| LEG-03 | Guard lockdown: árbol público sin RPC fuera del allowlist ni `.from('<pii>')` (incl. módulos nuevos) | guard | `cd app && npx vitest run lib/lockdown-guard.test.ts` (8/8) | ✅ | ✅ green |
| LEG-03 | SSR intacto + gates OFF = nodo ausente del HTML + RPC cruces nunca invocado | unit (behavioral) | `cd app && npx vitest run "app/parlamentario/[id]/page.test.tsx"` (14/14) | ✅ | ✅ green |
| LEG-03 | Tipos limpios / suite completa | typecheck / regression | `cd app && npx tsc -b` / suite | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `components/carril-accordion.test.tsx` — LEG-01 (header visible, conteo, toggle, forceMount, no-leak). FILLED (5/5).
- [x] `components/parlamentario-resumen.test.tsx` — LEG-02 (vista pura `ResumenView({chips})` con fixtures). FILLED (18/18).
- [x] `app/parlamentario/[id]/page-estructura.test.ts` — LEG-01/03 (frontera mt-12, 1×dominio, gates, resumen, no-leak). FILLED (7/7).
- [x] `lib/parlamentario-resumen-conteos.test.ts` — mapeo puro conteo→3-estado. FILLED (23/23).
- [x] `@radix-ui/react-accordion@1.2.14` instalado.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Build OpenNext/Cloudflare no se rompe con la isla cliente | LEG-03 | Build requiere Docker Linux (Windows rompe el worker) | Operador: build OpenNext Docker Linux + deploy wrangler. **RESUELTO**: deploy 2026-07-02 (3ade68b8) + posteriores redeploys en vivo |
| Animación respeta `prefers-reduced-motion` | LEG-01 | Preferencia de SO no observable en jsdom | Revisión visual con reduce-motion activo (checkpoint operador, no-load-bearing) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (todos filled durante ejecución)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 4 (Wave 0: carril-accordion, parlamentario-resumen, page-estructura, resumen-conteos) |
| Resolved | 4 (todos filled durante ejecución de F45) |
| Escalated | 0 |

LEG-01/02/03 COVERED por 75 tests verdes en 6 archivos (`carril-accordion` 5 · `parlamentario-resumen` 18 · `parlamentario-resumen-conteos` 23 · `lockdown-guard` 8 · `page-estructura` 7 · `page` 14), verificados esta corrida. Los 4 gaps Wave 0 ya estaban filled en ejecución. Build Docker + visual reduced-motion son manual-only (build RESUELTO por deploy; reduced-motion no-load-bearing). Nota: `ParlamentarioResumen`/`ResumenView` quedaron parcialmente huérfanos tras el re-layout F55 (construirChips sigue consumido vía chipToRailEntry→FichaRail), pero los tests siguen verdes — cleanup no-bloqueante registrado en el milestone audit. Cero gaps automatizables pendientes. Nyquist-compliant.
