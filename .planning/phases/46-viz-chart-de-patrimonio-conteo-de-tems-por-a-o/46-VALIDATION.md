---
phase: 46
slug: viz-chart-de-patrimonio-conteo-de-tems-por-a-o
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-26
validated: 2026-07-08
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
| **Quick run command** | `cd app && npx vitest run <file>` |
| **Full suite command** | `cd app && npx vitest run && npx tsc -b` |
| **Estimated runtime** | ~4 s (3 files) |

> GOTCHA: root `pnpm test` no corre `app/` — ejecutar dentro de `app/`. Mock `recharts` en jsdom (mirror `red-graph.test.tsx` `vi.mock`) + polyfill `ResizeObserver`.

---

## Sampling Rate

- **After every task commit:** `cd app && npx vitest run <changed-file>` + `npx tsc -b`
- **After every plan wave:** `cd app && npx vitest run && npx tsc -b`
- **Before `/gsd:verify-work`:** full suite green + `tsc -b` green; THEN operator Docker Linux `cf-build` + deploy (checkpoint).
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| VIZ-01 | `seriePatrimonio(versiones)` → `{anio, tipo_declaracion, <tipo_bien counts>}`; counts match per version; year from `fecha_presentacion`; tipos NO fusionados | unit (pure fn) | `cd app && npx vitest run components/patrimonio-chart.test.tsx` | ✅ | ✅ green |
| VIZ-01 | <2 declaraciones → "datos insuficientes para una tendencia", NO chart | unit (RTL) | idem (12/12) | ✅ | ✅ green |
| VIZ-01 | caveat "Montos no disponibles como cifra en la fuente" presente; NINGÚN monto numérico graficado | unit (RTL) | idem | ✅ | ✅ green |
| VIZ-02 | `recharts@3.9.0` en `app/package.json`; chart isla `"use client"`, shell server (source scan) | unit (source scan) | idem | ✅ | ✅ green |
| VIZ-02 | build OpenNext/Cloudflare NO se rompe | **manual / operator (Docker Linux)** | `pnpm cf-build` (Docker Linux) | — | ✅ manual (deploy 3ade68b8, 2026-07-02) |
| VIZ-03 | copy pasa `PROHIBIDO_VEREDICTO` + `PROHIBIDO_CONECTIVO` negative-match; footer fuente+fecha+enlace CC BY 4.0 CPLT | unit (RTL textContent) | `cd app && npx vitest run components/patrimonio-de-parlamentario.test.tsx` (49/49) | ✅ | ✅ green |
| VIZ-03 | guard verde: sin RPC nueva fuera del allowlist, sin `.from('parlamentario')` | guard | `cd app && npx vitest run lib/lockdown-guard.test.ts` (8/8) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/components/patrimonio-chart.test.tsx` — transform (VIZ-01) + shell copy (caveat, degrade, footer, banned-vocab VIZ-03) + `"use client"` source scan (VIZ-02). FILLED (12/12), mock `recharts`.
- [x] Regexes banned-vocab reusadas de `patrimonio-de-parlamentario.test.tsx` (`PROHIBIDO_VEREDICTO`, `PROHIBIDO_CONECTIVO`, `PATRON_RUT`).
- [x] `recharts@3.9.0` instalado (pin exacto).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Build OpenNext/Cloudflare no se rompe con Recharts | VIZ-02 | Build requiere Docker Linux (Windows rompe el worker) | Operador: `pnpm cf-build` Docker Linux + deploy. **RESUELTO**: deploy 2026-07-02 (3ade68b8) — chart en vivo |
| Render visual del chart + `prefers-reduced-motion` | VIZ-01 | No observable en jsdom | Revisión visual con app desplegada (checkpoint operador, no-load-bearing) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (filled durante ejecución)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-08

---

## Validation Audit 2026-07-08
| Metric | Count |
|--------|-------|
| Gaps found | 1 (Wave 0: patrimonio-chart.test.tsx) |
| Resolved | 1 (filled durante ejecución de F46) |
| Escalated | 0 |

VIZ-01/02/03 COVERED por 69 tests verdes en 3 archivos (`patrimonio-chart` 12 · `patrimonio-de-parlamentario` 49 · `lockdown-guard` 8), verificados esta corrida. El gap Wave 0 (patrimonio-chart.test.tsx) ya estaba filled en ejecución. Build Docker Linux es manual-only (RESUELTO por deploy 3ade68b8, chart en vivo desde 2026-07-02). Cero gaps automatizables pendientes. Nyquist-compliant.
