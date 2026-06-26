---
phase: 46-viz-chart-de-patrimonio-conteo-de-tems-por-a-o
plan: 01
subsystem: frontend
tags: [viz, recharts, patrimonio, client-island, anti-insinuacion, lockdown]
requires:
  - "PatrimonioSection ya fetchea declaraciones_de_parlamentario + bienes_de_parlamentario (todas: DeclaracionVersionRow[])"
  - "F45 CarrilAccordion (la sección de patrimonio donde vive el chart)"
provides:
  - "recharts@3.9.0 instalado (pin exacto)"
  - "seriePatrimonio(): transform puro DeclaracionVersionRow[] → SeriePunto[] (server-side, serializable)"
  - "PatrimonioChart: isla \"use client\" Recharts (BarChart apilado)"
  - "PatrimonioChartShell: shell server (caveat montos / degrade <2 / footer CC BY 4.0)"
affects:
  - "app/components/patrimonio-de-parlamentario.tsx (PatrimonioView estado (c) ahora monta el chart)"
tech-stack:
  added: [recharts@3.9.0]
  patterns: ["client-viz island fed by serialized RSC array (espejo @xyflow/react red-graph)"]
key-files:
  created:
    - app/components/patrimonio-chart.tsx
    - app/components/patrimonio-chart.test.tsx
  modified:
    - app/package.json
    - pnpm-lock.yaml
    - app/components/patrimonio-de-parlamentario.tsx
    - app/components/patrimonio-de-parlamentario.test.tsx
decisions:
  - "Chart = BarChart APILADO discreto (nunca línea/área): una línea entre versiones incomparables insinuaría una tendencia de riqueza (anti-insinuación HARD)"
  - "Eje X = categoría compuesta `anio · tipo_declaracion`: dos declaraciones del mismo año pero distinto tipo quedan como barras DISTINTAS (render-honesty)"
  - "seriePatrimonio() vive en el server file (puro, serializable); la isla importa solo `type SeriePunto`"
  - "Fills = rampa petróleo→pizarra neutra; cero tokens de identidad institucional"
metrics:
  duration: ~15min
  completed: 2026-06-26
  tasks: 2
  files: 6
---

# Phase 46 Plan 01: VIZ — Chart de patrimonio (conteo de ítems por año) Summary

Stacked Recharts `BarChart` of declared-item COUNTS per year inside the F45 patrimonio accordion, fed by a pure server-side `seriePatrimonio()` transform over already-fetched data — zero new RPC, montos never graphed, honest degrade + CC BY footer, lockdown green.

## What Was Built

**Task 1 — recharts + pure transform (commit `d5368b9`):**
- `pnpm add recharts` → pinned exactly to `3.9.0` in `app/package.json` (mirrors the `@xyflow/react` exact-pin precedent); lockfile reconciled.
- Exported `SeriePunto` (plain `{ anio:number; tipo_declaracion:string; <6 tipo_bien counts> }`) and the pure `seriePatrimonio(versiones): SeriePunto[]` from `patrimonio-de-parlamentario.tsx`, placed next to the existing pure helpers. One version = one point; counts `v.bienes` per `tipo_bien`; year via `fecha_presentacion.slice(0,4)` as a number (no `Date`); carries `v.tipo` as `tipo_declaracion` so incomparable versions never fuse.
- Transform tests (VIZ-01): counts, year-from-ISO, same-year-different-tipo kept distinct, `[]`/1-version, and a JSON-plain (numbers+strings only) assertion for the RSC→client boundary.

**Task 2 — client island + server shell (commit `238eee3`):**
- New `patrimonio-chart.tsx` — `"use client"` Recharts island. Stacked `BarChart` (never `LineChart`/`AreaChart`), X axis keyed on the composite `anio · tipo_declaracion` category, `YAxis allowDecimals={false}`, one stacked `<Bar>` per `tipo_bien` with NOUN labels and a neutral petrol→slate fill ramp (no institutional-identity tokens). `aria-label="N.º de bienes declarados por año"`. No `runtime="edge"`. Imports only `type { SeriePunto }` — never the Supabase client.
- `PatrimonioChartShell` (server, in `patrimonio-de-parlamentario.tsx`): `<2` points → degrade text "Datos insuficientes para una tendencia…" and the island is NOT mounted; `≥2` → mounts `<PatrimonioChart>`. In BOTH cases renders the montos caveat "Montos no disponibles como cifra en la fuente" and the `<AtribucionCcBy />` CC BY 4.0 footer.
- Wired: added `serie: SeriePunto[]` to `PatrimonioViewData`, computed `seriePatrimonio(todas)` (the FULL set, not the paginated `versiones` slice) in `PatrimonioSection`, mounted the shell inside `PatrimonioView` state (c) after the neutral count.
- Tests: shell caveat/degrade/footer/banned-vocab negative-match + source-scan (`"use client"`, imports recharts, never `@/lib/supabase`/`createServerSupabase`, no line/area, no edge runtime, no identity tokens). Mocked `recharts` + `ResizeObserver` polyfill (mirror `red-graph.test.tsx`).

## Verification

- `cd app && pnpm test patrimonio-chart` → 10/10 green (transform + shell + source-scan).
- `cd app && pnpm test` → 375/375 green (41 files).
- `cd app && pnpm test lockdown-guard` → 7/7 green (zero new RPC/`.from`, no `.from('parlamentario')`).
- `cd app && pnpm typecheck` clean; `tsc -b` exit 0.
- The OpenNext/Cloudflare Docker-Linux build + deploy is the **operator checkpoint of Plan 46-02** — NOT run here (per plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lockfile lives at repo root, not `app/`**
- **Found during:** Task 1.
- **Issue:** The plan/frontmatter named `app/pnpm-lock.yaml`, but this is a pnpm workspace — `pnpm add recharts` updated the root `pnpm-lock.yaml`. There is no `app/pnpm-lock.yaml`.
- **Fix:** Committed the root `pnpm-lock.yaml` (recharts resolves there). No behavior change.
- **Commit:** `d5368b9`

**2. [Rule 1 - Stale assertion] Existing CC BY single-match assertion**
- **Found during:** Task 2 full-suite run.
- **Issue:** The new chart footer renders a second `AtribucionCcBy` (required by VIZ-03 — the chart must carry its own source+date+link). An existing test (`ProvenanceBadge por versión + CC BY 4.0 en intro`) used `getByText(/Datos bajo licencia CC BY 4\.0/i)`, which now throws on multiple matches.
- **Fix:** Changed that single assertion to `getAllByText(...).length >= 1`. The duplicate footer is intended behavior, not a regression.
- **Files modified:** `app/components/patrimonio-de-parlamentario.test.tsx`
- **Commit:** `238eee3`

**3. [Rule 1 - Test gate] Doc-comment tokens tripped the source-scan**
- **Found during:** Task 2 chart-test run.
- **Issue:** The island's JSDoc literally contained `@/lib/supabase` and `--camara`/`--senado` (describing what NOT to do), which the source-scan regexes flagged.
- **Fix:** Reworded the comments to prose ("el cliente server-only de Supabase", "tokens de identidad institucional") without the literal tokens.
- **Commit:** `238eee3`

## Known Stubs

None. The chart renders real counts derived from the already-fetched `todas` set. No placeholder/mock data.

## Threat Flags

None. No new network endpoint, auth path, file access, or schema change. Zero new `.rpc`/`.from`; the island receives only a serialized count array.

## Self-Check: PASSED

- Files created: `patrimonio-chart.tsx`, `patrimonio-chart.test.tsx` — FOUND.
- Server file modified with `seriePatrimonio` + shell — FOUND.
- `recharts: "3.9.0"` pin — FOUND.
- Commits `d5368b9`, `238eee3` — FOUND in git log.
