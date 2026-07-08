---
phase: 47-vchart-chart-de-votos-ausencias-del-parlamentario
reviewed: 2026-07-08T03:58:39Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - app/components/votos-chart.tsx
  - app/components/votos-por-parlamentario.tsx
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: clean
resolved_at: 2026-07-08
resolved_commits:
  - ffddf4e  # IN-01/IN-02 single-source VOTO_PRESENTACION
  - 271b734  # WR-01/IN-03/IN-04 base UTC + guards + magic numbers
---

# Phase 47: Code Review Report

**Reviewed:** 2026-07-08T03:58:39Z
**Depth:** deep
**Files Reviewed:** 2
**Status:** clean (all findings resolved 2026-07-08)

> RESOLUCIÓN (2026-07-08): las 5 observaciones (1 WR + 4 IN) fueron corregidas.
> Suite root 720 verde (baseline 719 + 1 test de borde WR-01), `tsc -b` limpio.
> Los cambios frontend viajan con el próximo deploy (no se desplegó en este pase).
> Commits: ffddf4e (IN-01/IN-02), 271b734 (WR-01/IN-03/IN-04).

## Summary

Reviewed the VCHART surface: the `votos-chart.tsx` client Recharts island and the
`votos-por-parlamentario.tsx` aggregator + wiring. Adversarial focus per the review
brief: key stability, hydration, anti-insinuación (stacked-NO-line), color single-source,
NaN/AT TIME ZONE issues in the quarter aggregation, and the empty-state degrade.

The core honesty invariants hold: the chart is a discrete stacked `BarChart` (never a
line/area), `YAxis allowDecimals={false}`, empty series is guarded by the parent
(`data.periodos.length > 0`) so Recharts never receives an empty `data` array and no
fabricated zero bar is rendered, and `fecha`-less rows are excluded via a regex guard
before `new Date`. Chart keys (`s.dataKey`) are stable strings — no key instability or
hydration hazard. The client island imports only a `type` from the server module, keeping
Recharts out of the server bundle (no-leak F45 respected).

No blockers. One warning (a UTC-slice quarter-bucketing edge that can misbucket a
boundary vote — low materiality but a real correctness nuance) and four info items
(overstated "single-source" docstring, triple-duplicated color map, a dead-code hazard
in `resumenDeArco`'s `new Date(e.fecha)` with no ISO guard, and a magic-number quarter
math clarity nit).

## Warnings

### WR-01: Quarter bucketing uses the UTC calendar date, not the local (es-CL) date

**RESUELTO (271b734):** ambos agregadores derivan ahora del slice ISO UTC vía el helper
compartido `parseFechaVotoSegura`; `resumenDeArco` compara por índice ordinal de mes UTC y
`mesAnio` formatea en TZ UTC (`Date.UTC`). Ya no se mezcla `slice(0,10)` con `new Date()`
local. Test de borde `2026-03-31T23:30:00Z` → T1 consistente en chart y resumen.

**File:** `app/components/votos-por-parlamentario.tsx:207-213`
**Issue:** `agruparVotosPorTrimestre` derives the quarter from `(v.fecha ?? "").slice(0, 10)`
— the first 10 chars of the serialized `timestamptz`, i.e. the **UTC** calendar date. A
vote timestamped near local midnight on a quarter boundary (e.g. `2024-03-31T23:30:00-03:00`
serialized as `2024-04-01T02:30:00Z`) is bucketed into the FOLLOWING quarter (T2 instead
of T1). The `resumenDeArco` path uses `new Date(e.fecha)` (local) and `mesAnio` (es-CL TZ),
so the two surfaces on the same page can disagree about which period a boundary vote belongs
to. Materiality is low (only boundary timestamps, and the chart explicitly denies trend
meaning), but it is an inconsistency between two aggregations of the same rows.
**Fix:** Pick one timezone convention and apply it to both aggregators. Simplest honest
option: keep the UTC slice (deterministic, SSR-stable) but document that quarters are
UTC-calendar, and align `resumenDeArco` to the same basis (slice-derived month rather than
`new Date().getTime()`), OR conversely derive both from a single `Date` in a fixed TZ. Do
not silently mix `slice(0,10)` (UTC) with `new Date()` (runtime-local) across the two
period computations.

## Info

### IN-01: "single-source with VotosCapa1 SEGMENTO" docstring is inaccurate — colors are triplicated, not single-source

**RESUELTO (ffddf4e):** se extrajo `app/lib/voto-presentacion.ts` con un único
`Record<Seleccion,{label,bgClass,fill}>` (`VOTO_PRESENTACION`), consumido por
`votos-chart` (SERIES), `votos-capa1` (SEGMENTO/OPCION_LABEL) y `votos-por-parlamentario`
(BAR_SEGMENT/OPCION_LABEL). El docstring ahora describe la fuente única real (hsl vive
junto a su clase bg-* → imposible desincronizar).

**File:** `app/components/votos-chart.tsx:30-48`
**Issue:** The JSDoc and inline comments claim the `SERIES` fills are "single-source with
`VotosCapa1` SEGMENTO". They are not: the fills are hardcoded `hsl(...)` literals here,
`BAR_SEGMENT` in `votos-por-parlamentario.tsx:48-54` uses `bg-green-500`/etc. Tailwind
classes, and `SELECCION_STYLE` in `voto-row.tsx:19-30` uses `bg-green-100`/`text-green-800`.
The chart's `hsl(142 71% 45%)` does correspond to Tailwind green-500, so they render
consistently today, but nothing enforces the coupling — a future edit to `BAR_SEGMENT`
would silently desync the chart. The "single source" claim is aspirational, not enforced.
**Fix:** Either extract one shared `Record<Seleccion, {fill; bgClass; label}>` map consumed
by all three sites, or soften the docstring to "mirrors the capa-1 SEGMENTO shades (kept in
sync manually — no shared constant)".

### IN-02: Color map duplicated across three modules (maintenance hazard)

**RESUELTO (ffddf4e):** centralizado en `lib/voto-presentacion.ts` (label + bgClass + fill
en un solo objeto); los tres consumidores derivan del mismo mapa. Sin literales duplicados.

**File:** `app/components/votos-chart.tsx:38-48`
**Issue:** Same underlying vote→color mapping is declared three times (`SERIES` here,
`BAR_SEGMENT` and `OPCION_LABEL` in `votos-por-parlamentario.tsx`, `SELECCION_STYLE` in
`voto-row.tsx`). Label text ("A favor"/"En contra"/…) is duplicated between `SERIES.label`
and `OPCION_LABEL`. Drift risk on any future vote-sense change.
**Fix:** Centralize the vote-sense presentation (label + capa-1 bg class + chart hsl fill)
in one module (e.g. `lib/voto-presentacion.ts`) and import from all consumers.

### IN-03: `resumenDeArco` calls `new Date(e.fecha)` without the ISO guard used elsewhere

**RESUELTO (271b734):** `resumenDeArco` usa `parseFechaVotoSegura` (mismo guard ISO+regex);
las filas de detalle (arco y rebeldías) usan `fechaCortaSegura(e.fecha)` en vez de
`fechaCorta(new Date(e.fecha))`. Postura defensiva única en todo el archivo.

**File:** `app/components/votos-por-parlamentario.tsx:294`
**Issue:** The quarter aggregator (line 207-209) carefully guards with a regex before
`new Date`, but `resumenDeArco` calls `new Date(e.fecha).getTime()` directly and relies on
`Number.isNaN(t)` to reject garbage. That works for the min/max range, but it is an
inconsistent defensive posture within the same file — one path treats `fecha` as
possibly-malformed and pre-validates, the other trusts `new Date` to fail cleanly. If a
future `fecha` value is a non-ISO string that `Date` parses leniently (e.g. `"2024"` →
valid Date), `resumenDeArco` would accept it while `agruparVotosPorTrimestre` would reject
it — producing a range with no matching chart bucket.
**Fix:** Apply the same ISO slice+regex guard in `resumenDeArco` (and `ProyectoGrupo`'s
`fechaCorta(new Date(e.fecha))` at line 477), or extract a shared `parseFechaVotoSegura`
helper so all three date paths share one validation.

### IN-04: Quarter math magic numbers (`/ 3`, `+ 1`, `* 10`) are unlabeled

**RESUELTO (271b734):** constantes nombradas `MESES_POR_TRIMESTRE`,
`FACTOR_ORDEN_TRIMESTRE` (con nota de por qué 10 es seguro solo para T1..T4) y
`MESES_POR_ANIO`.

**File:** `app/components/votos-por-parlamentario.tsx:211-225`
**Issue:** `Math.floor(mes0 / 3) + 1` (month→quarter) and the sort key `anio * 10 + trimestre`
are correct but rely on unstated invariants (`3` months per quarter; `* 10` only safe
because trimestre ≤ 9 — fine for T1..T4 but the `* 10` would collide if a "T10+" ever
appeared, which the comment acknowledges cannot happen). Low risk, readability only.
**Fix:** Name the constants (`const MESES_POR_TRIMESTRE = 3`) or add a brief inline note that
`* 10` is safe solely because trimestre ∈ [1,4].

---

_Reviewed: 2026-07-08T03:58:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
