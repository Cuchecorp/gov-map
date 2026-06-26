---
phase: 46-viz-chart-de-patrimonio-conteo-de-tems-por-a-o
verified: 2026-06-26T17:20:00Z
status: human_needed
score: 9/9 must-haves verified (automated); 2 operator/visual checks pending
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
human_verification:
  - test: "Operador: `pnpm cf-build` (OpenNext) en Docker Linux + deploy wrangler local; abrir /parlamentario/[id]#patrimonio en el worker desplegado."
    expected: "El build del worker NO se rompe con recharts@3.9.0 en el bundle; la sección de patrimonio carga y el chart se monta SSR-shell + isla cliente sin error 500."
    why_human: "El build OpenNext requiere Docker Linux (Windows rompe el worker → 500); no observable en jsdom ni en CI. Es el checkpoint operador de Plan 46-02."
  - test: "Revisión visual del chart desplegado: declaraciones del MISMO año pero distinto tipo (p.ej. 'Declaración periódica' 2020 y 'Rectificación' 2020), y dos del mismo año Y mismo tipo, deben aparecer como BARRAS DISTINTAS (nunca fundidas en una banda). Verificar también `prefers-reduced-motion`."
    expected: "Cada declaración = una barra apilada propia (eje X = categoría compuesta año·tipo·version_id); sin animación agresiva con reduced-motion activado."
    why_human: "El render SVG de Recharts y el respeto a prefers-reduced-motion no son observables en jsdom (ResizeObserver→0); requiere app desplegada."
---

# Phase 46: VIZ — Chart de patrimonio (conteo de ítems por año) Verification Report

**Phase Goal:** Un gráfico descriptivo dentro de la sección de patrimonio (acordeón F45): serie temporal del CONTEO de ítems declarados por `declaracion.fecha_presentacion`, rotulado por tipo de declaración. Solo conteos, NO montos. Recharts isla `"use client"`, resto SSR. Descriptivo/neutro, fuente+fecha+enlace, sin RPC nueva ni `.from('parlamentario')`, guard verde.
**Verified:** 2026-06-26T17:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Chart = serie temporal del CONTEO de ítems por `fecha_presentacion`, rotulado por tipo | ✓ VERIFIED | `seriePatrimonio()` (patrimonio-de-parlamentario.tsx:126-159) cuenta `v.bienes` por `tipo_bien`, año vía `.slice(0,4)`, arrastra `tipo_declaracion`. Chart apila 6 `<Bar>` por `tipo_bien` (patrimonio-chart.tsx:87-95). Tests `seriePatrimonio — transform puro (VIZ-01)` 6/6 green. |
| 2 | Solo conteos, NUNCA montos graficados | ✓ VERIFIED | Transform jamás lee `contenido`/monto; `SeriePunto` solo lleva counts numéricos. Caveat "Montos no disponibles como cifra en la fuente" renderizado siempre (líneas 182-185). |
| 3 | Degrada a "datos insuficientes" con <2 declaraciones | ✓ VERIFIED | `PatrimonioChartShell` (líneas 170-191): `serie.length < 2` → texto degrade, isla NO montada. Test `con <2 declaraciones muestra el degrade y NO monta la isla` green. |
| 4 | Recharts instalado, chart como isla `"use client"`, resto SSR | ✓ VERIFIED | `recharts@3.9.0` pin exacto (package.json:32, `pnpm ls recharts` confirma). patrimonio-chart.tsx:1 `"use client"`; importa solo `type { SeriePunto }`; shell + Server Component sin `"use client"`. Source-scan test green. |
| 5 | BarChart APILADO discreto, nunca línea/área | ✓ VERIFIED | `<BarChart>` con `stackId="bienes"` (línea 91). Source-scan asserts `not.toMatch(/LineChart|AreaChart|<Line|<Area/)` green. |
| 6 | Eje X = categoría compuesta (no `anio` desnudo); versiones incomparables no se fusionan | ✓ VERIFIED | `categoria()` = `${anio} · ${tipo_declaracion} · ${version_id}` (línea 57-59); `dataKey="categoria"` (línea 83). Source-scan asserts `toMatch(/dataKey="categoria"/)` + `not.toMatch(/dataKey="anio"/)` green. Test `categoria() — banda única por declaración` green. |
| 7 | Copy descriptivo/neutro (negative-match vocabulario prohibido) | ✓ VERIFIED | Test `el copy del shell pasa el negative-match de vocabulario prohibido + sin RUT` green (PROHIBIDO_VEREDICTO + PROHIBIDO_CONECTIVO + PATRON_RUT todos negativos). Degrade reescrito a marco de CONTEO (no "tendencia", WR-04 cerrado). |
| 8 | Fuente+fecha+enlace (CC BY 4.0 CPLT) al pie | ✓ VERIFIED | `<AtribucionCcBy />` en el footer del shell (líneas 186-188), renderizado en ambos caminos (chart y degrade). Test `el footer del chart trae la atribución CC BY 4.0` green. |
| 9 | Sin RPC nueva ni `.from('parlamentario')`; guard verde | ✓ VERIFIED | RPCs usados: `declaraciones_de_parlamentario`, `bienes_de_parlamentario`, `comparar_declaraciones` — los 3 en PUBLIC_RPC_ALLOWLIST y pre-existentes. `.from("probidad_ingesta_estado")` no-PII, pre-existente. Cero `.from('parlamentario')`. `pnpm test lockdown-guard` 7/7 green. |

**Score:** 9/9 automated truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/components/patrimonio-chart.tsx` | Isla `"use client"` Recharts, BarChart apilado | ✓ VERIFIED | 100 líneas, `"use client"`, type-only import, stacked BarChart, dataKey="categoria", role=img + aria-label. Wired vía `<PatrimonioChartShell>`. |
| `app/components/patrimonio-de-parlamentario.tsx` | `seriePatrimonio()` + `PatrimonioChartShell` + wiring | ✓ VERIFIED | Transform puro con guarda null (WR-03), shell con caveat/degrade/footer, montado en PatrimonioView estado (c) desde `seriePatrimonio(todas)` (set completo, no paginado). |
| `app/components/patrimonio-chart.test.tsx` | Tests transform + shell + source-scan | ✓ VERIFIED | 12 tests green (transform 6, shell 4, categoria 1, source-scan 1). |
| `app/package.json` | recharts dependency pin | ✓ VERIFIED | `"recharts": "3.9.0"` exacto. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| PatrimonioSection (server) | seriePatrimonio(todas) | computa serie del set COMPLETO | ✓ WIRED | Línea 862: `serie: seriePatrimonio(todas)` — no rebanada paginada, no query nueva. |
| PatrimonioView | PatrimonioChartShell | `<PatrimonioChartShell serie={data.serie} />` | ✓ WIRED | Línea 516, dentro del estado (c). |
| PatrimonioChartShell | PatrimonioChart (isla) | `<PatrimonioChart serie={serie} />` con ≥2 puntos | ✓ WIRED | Línea 179; degrade con <2. |
| PatrimonioChart | recharts | import BarChart/Bar/XAxis/... | ✓ WIRED | Líneas 3-11; serializa solo SeriePunto[]. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| PatrimonioChart | `serie` (SeriePunto[]) | `seriePatrimonio(todas)` ← `modelarVersiones(filas, ...)` ← RPC `declaraciones_de_parlamentario` + `bienes_de_parlamentario` | Sí — conteos reales derivados del set completo de declaraciones confirmadas (no hardcoded, no `[]` estático) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full suite green | `cd app && pnpm test` | 377 passed / 41 files | ✓ PASS |
| Typecheck clean | `cd app && pnpm typecheck` (`tsc --noEmit`) | exit 0 | ✓ PASS |
| Guard verde | `cd app && pnpm test lockdown-guard` | 7 passed | ✓ PASS |
| Chart suite | `cd app && pnpm test patrimonio-chart` | 12 passed (incl. WR-02/WR-03 regression asserts) | ✓ PASS |
| recharts pin | `pnpm ls recharts` | recharts@3.9.0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| VIZ-01 | 46-01 | Serie temporal del conteo por `fecha_presentacion`, rotulado por tipo; sin montos; degrade <2 | ✓ SATISFIED | Truths 1-3, 5-6; transform + categoria tests green |
| VIZ-02 | 46-01 / 46-02 | Recharts instalado, isla `"use client"`, resto SSR; build OpenNext no se rompe; `pnpm test` + `tsc -b` verdes | ◑ PARTIAL (auto SATISFIED; build operador pendiente) | Truth 4 + spot-checks green; Docker Linux build = human_verification #1 |
| VIZ-03 | 46-01 | Descriptivo/neutro; fuente+fecha+enlace; sin RPC nueva ni `.from('parlamentario')`; guard verde | ✓ SATISFIED | Truths 7-9; guard 7/7 green |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Ninguno. Sin TBD/FIXME/XXX; sin stubs; sin datos hardcoded; sin `return null`/`[]` no-derivado | — | El chart renderiza conteos reales del set `todas`. SUMMARY "Known Stubs: None" confirmado en código. |

Nota: las 4 WARNINGs del 46-REVIEW (WR-01 fusión same-year/same-tipo, WR-02 falta assert dataKey, WR-03 guarda null, WR-04 copy "tendencia") están todas CERRADAS en el código verificado: `version_id` discriminador en `categoria()`, asserts `dataKey="categoria"`/`not anio` en el source-scan, guarda `?? ""` + regex `^\d{4}$` en el transform, y degrade reescrito a marco de CONTEO. Las INFO IN-01 (`import.meta.dirname`) e IN-02 (aria-label "por declaración (año y tipo)") también aplicadas.

### Human Verification Required

1. **Build OpenNext/Cloudflare en Docker Linux + deploy** (operador, checkpoint Plan 46-02)
   - Test: `pnpm cf-build` en Docker Linux + deploy wrangler local; abrir `/parlamentario/[id]#patrimonio`.
   - Expected: el worker compila con recharts@3.9.0 sin romper; sección carga sin 500.
   - Why human: build requiere Docker Linux (Windows rompe el worker); no observable en CI/jsdom. NO es un gap — es el checkpoint operador declarado en la fase.

2. **Render visual del chart + prefers-reduced-motion** (operador)
   - Test: confirmar que declaraciones del mismo año/distinto tipo Y del mismo año/mismo tipo aparecen como BARRAS DISTINTAS; verificar reduced-motion.
   - Expected: cada declaración = una barra apilada propia (eje X compuesto); animación respeta reduced-motion.
   - Why human: SVG de Recharts y reduced-motion no observables en jsdom.

### Gaps Summary

Ninguna brecha bloqueante. Los 9 must-haves automatizables están VERIFIED contra el código real (no contra claims del SUMMARY): suite 377/377, typecheck exit 0, guard 7/7, recharts@3.9.0 pin, e inspección de fuente confirma todas las restricciones HARD (isla cliente type-only, BarChart apilado, eje compuesto, sin montos, degrade honesto, caveat, footer CC BY, copy neutro, cero RPC/`.from` nuevos). Las 4 WARNINGs del REVIEW están cerradas en código. El status es `human_needed` únicamente por los dos checks de operador (build Docker Linux/deploy + revisión visual), que la fase declara explícitamente como checkpoint operador — no son gaps.

---

_Verified: 2026-06-26T17:20:00Z_
_Verifier: Claude (gsd-verifier)_
