---
phase: 46-viz-chart-de-patrimonio-conteo-de-tems-por-a-o
reviewed: 2026-06-26
depth: standard
files_reviewed: 3
files_reviewed_list:
  - app/components/patrimonio-chart.tsx
  - app/components/patrimonio-chart.test.tsx
  - app/components/patrimonio-de-parlamentario.tsx
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: findings
---

# Phase 46: Code Review Report

**Reviewed:** 2026-06-26 · **Depth:** standard · **Files Reviewed:** 3 · **Status:** issues_found

## Summary

The chart island honors the load-bearing HARD constraints: `"use client"`, type-only import of `SeriePunto` (no server runtime, no `@/lib/supabase`), a STACKED `BarChart` (`stackId="bienes"`, never line/area), an X axis keyed on a composite `anio · tipo_declaracion` category (not bare `anio`), a pure `seriePatrimonio()` transform driven from `todas` (no new RPC, no second query, no `new Date()`, year via `slice`), no montos graphed, `tipo_declaracion` kept distinct, plus degrade / montos caveat / CC BY 4.0 footer and neutral vocabulary (passes the banned-vocab negative match).

Defects cluster around render-honesty edge cases and a test-coverage gap relative to the phase's own release requirement. No critical/security issues.

## Warnings

### WR-01: Same-year + same-`tipo_declaracion` declarations collapse into one band (render fusion)
**File:** `app/components/patrimonio-chart.tsx:54-56,69`
Two distinct declarations sharing both year AND tipo (e.g. two "Rectificación" in 2020) produce an identical `categoria` string → Recharts band scale overlaps them into one bar, fusing two distinct declarations. Tested different-tipo case is dodged, same-tipo is not. `SeriePunto` has no per-version discriminator.
**Fix:** Carry a stable per-point discriminator (e.g. `version_id`) into `SeriePunto`/category, or index within the transform (prefer a real version id over array index so the label stays meaningful).

### WR-02: No test asserts the X axis keys on the composite category
**File:** `app/components/patrimonio-chart.test.tsx:36-55,248-266`
The recharts mock stubs `XAxis` to `() => null`; no rendered or grep assertion that `dataKey="categoria"`. A regression back to `dataKey="anio"` would pass every test while breaking the anti-insinuación property.
**Fix:** Source-grep `expect(fuente).toMatch(/dataKey="categoria"/)` + `not.toMatch(/dataKey="anio"/)`, or have the mock record `XAxis` dataKey and assert `"categoria"`.

### WR-03: `seriePatrimonio()` does not guard `fecha_presentacion`
**File:** `app/components/patrimonio-de-parlamentario.tsx:134`
`Number(v.fecha_presentacion.slice(0,4))` — a null/undefined value throws a TypeError that crashes the whole Server Component (500); an empty value yields `NaN`/`0` axis labels. The transform is the one place touching raw RPC strings and has no defense.
**Fix:** `const raw = v.fecha_presentacion ?? ""; const n = Number(raw.slice(0,4)); const anio = Number.isFinite(n) ? n : 0;` — or filter out unparseable-year points.

### WR-04: Degrade copy frames the chart as a "tendencia" (trend)
**File:** `app/components/patrimonio-de-parlamentario.tsx:153-156`
"Datos insuficientes para una **tendencia**…" implies that with ≥2 declarations the chart *would* show a trend — the exact framing the island header forbids. Banned-vocab regex doesn't catch "tendencia"; test hardcodes the string (`:228`).
**Fix:** Reword to the count framing: "Datos insuficientes para mostrar el conteo de ítems por año: se necesitan al menos dos declaraciones." Update assertion at `patrimonio-chart.test.tsx:228`.

## Info

### IN-01: Test reads source via `process.cwd()`-relative path
**File:** `app/components/patrimonio-chart.test.tsx:272-274`
`path.join(process.cwd(), "components", "patrimonio-chart.tsx")` assumes cwd is `app/`. Given documented runner/cwd drift, the VIZ-02 grep test can silently pass or break from repo root.
**Fix:** `path.join(__dirname, "patrimonio-chart.tsx")` or `new URL("./patrimonio-chart.tsx", import.meta.url)`.

### IN-02: Chart `aria-label` says "por año" while bars are per declaration
**File:** `app/components/patrimonio-chart.tsx:65`
`aria-label="N.º de bienes declarados por año"` over-aggregates the per-declaration distinction the composite axis preserves.
**Fix:** "N.º de bienes declarados por declaración (año y tipo)".

---
_Reviewer: Claude (gsd-code-reviewer) · Depth: standard_
