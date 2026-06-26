---
phase: 46
slug: viz-chart-de-patrimonio-conteo-de-tems-por-a-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `46-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 + @testing-library/react 16.3.2 (jsdom) |
| **Config file** | `app/vitest.config.ts` (globs `components/**/*.test.tsx`, `lib/**`, `app/**`) |
| **Quick run command** | `cd app && pnpm test <file>` |
| **Full suite command** | `cd app && pnpm test && pnpm typecheck` |
| **Estimated runtime** | ~30–60 s |

> GOTCHA: root `pnpm test` no corre `app/` — ejecutar dentro de `app/`. Mock `recharts` en jsdom (mirror `red-graph.test.tsx` `vi.mock`).

---

## Sampling Rate

- **After every task commit:** `cd app && pnpm test <changed-file>` + `pnpm typecheck`
- **After every plan wave:** `cd app && pnpm test && pnpm typecheck`
- **Before `/gsd:verify-work`:** full suite green + `tsc -b` green; THEN operator Docker Linux `cf-build` + deploy (checkpoint).
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| VIZ-01 | `seriePatrimonio(versiones)` → `{anio, tipo_declaracion, <tipo_bien counts>}`; counts match per version; year from `fecha_presentacion` | unit (pure fn) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-01 | <2 declaraciones → "datos insuficientes para una tendencia", NO chart | unit (RTL) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-01 | montos caveat "Montos no disponibles como cifra en la fuente" presente; NINGÚN monto numérico graficado | unit (RTL) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-01 | tipos de declaración NO fusionados en una serie comparable (transform mantiene `tipo_declaracion` distinto) | unit (pure fn) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-02 | `recharts` en `app/package.json` dependencies | unit / implicit | `cd app && pnpm test` / `pnpm typecheck` | ❌ W0 |
| VIZ-02 | chart es isla `"use client"`; shell sigue server (source grep, estilo `carril-accordion.test.tsx`) | unit (source scan) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-02 | build OpenNext/Cloudflare NO se rompe | **manual / operator (Docker Linux)** | `cd app && pnpm cf-build` (Docker Linux) | n/a — human |
| VIZ-03 | copy del chart pasa `PROHIBIDO_VEREDICTO` + `PROHIBIDO_CONECTIVO` negative-match | unit (RTL textContent) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-03 | footer fuente+fecha+enlace (CC BY 4.0, CPLT) presente | unit (RTL) | `cd app && pnpm test patrimonio-chart` | ❌ W0 |
| VIZ-03 | guard verde: sin RPC nueva fuera del allowlist, sin `.from('parlamentario')` | unit (existente) | `cd app && pnpm test lockdown-guard` | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/components/patrimonio-chart.test.tsx` — transform tests (VIZ-01) + shell copy (caveat, degrade, footer, banned-vocab negative-match VIZ-03) + `"use client"` source scan (VIZ-02). Mock `recharts`.
- [ ] Reusar las regexes banned-vocab ya definidas en `patrimonio-de-parlamentario.test.tsx` (`PROHIBIDO_VEREDICTO`, `PROHIBIDO_CONECTIVO`, `PATRON_RUT`).
- [ ] Framework install: ninguno. Única dep nueva: `recharts@3.9.0`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Build OpenNext/Cloudflare no se rompe con Recharts | VIZ-02 | Build requiere Docker Linux (Windows rompe el worker); precedente `@xyflow` ya en `/red` de-riskea | Operador: `pnpm cf-build` en Docker Linux; deploy wrangler local. NO `runtime="edge"` |
| Render visual del chart + `prefers-reduced-motion` | VIZ-01 | No observable en jsdom | Revisión visual con app desplegada |
