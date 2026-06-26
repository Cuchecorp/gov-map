# Phase 46 — UI Review

**Audited:** 2026-06-26
**Baseline:** 46-UI-SPEC.md (LOCKED §2) + DESIGN-SYSTEM.md (CLOSED §1/§6/§7/§8)
**Screenshots:** NOT captured — static code-only audit (build + deploy is a deferred operator checkpoint; no running app)
**Disposition:** ADVISORY (non-blocking)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | ES neutral, passes banned-vocab negative-match, honest degrade + caveat copy |
| 2. Visuals (incl. honesty/anti-insinuación) | 4/4 | Stacked discrete bars + composite category key — anti-"tendencia" design is exemplary; only default Recharts chrome (legend/tooltip) is unthemed |
| 3. Color | 3/4 | Civic identity tokens correctly avoided (test-enforced); but the 6-stop petrol→slate fill ramp is hardcoded HSL outside the token system, and stop #1 drifts from `--accent-product` |
| 4. Typography | 3/4 | Shell copy uses correct token sizes; chart axis/legend/tooltip inherit default Recharts type, not Geist — needs live verification |
| 5. Spacing | 4/4 | `my-6`/`mt-2`/`mt-1` on the 8-pt scale; carril `mt-12` frontier preserved upstream; chart is a sub-section, not a sibling data domain |
| 6. Experience Design | 3/4 | Three honest states + degrade + always-on caveat/footer; `role="img"`+aria-label present, but no AT data-table fallback and aria-label wording is inconsistent with the wrapper |

**Overall: 21/24** — Good. Nothing blocking.

---

## Top 3 Priority Fixes (all WARNING / advisory)

1. **Tokenize the series fill ramp** — the 6 fills are hardcoded HSL string literals (`patrimonio-chart.tsx:44-49`) living outside the design-token system; stop #1 `hsl(183 38% 24%)` is a near-miss of `--accent-product` `hsl(183 38% 26%)`. Fix: define the ramp as CSS custom properties (e.g. `--viz-bien-1..6`) wired in `globals.css` alongside civic tokens, and reference them via `fill="hsl(var(--viz-bien-1))"`. Keeps the palette auditable and dark-mode-aware in one place.
2. **Theme the Recharts chrome (Legend / Tooltip / axis type)** — `<Legend />` and `<Tooltip />` render Recharts defaults (white box, generic sans), diverging from the Geist + cream/petrol contract (DESIGN-SYSTEM §2 typography, §1 surfaces). Fix: pass a `contentStyle`/`wrapperStyle` bound to `--card`/`--foreground`/Geist, or a custom tooltip component. Verify on cream once a live render exists.
3. **Strengthen chart accessibility** — `role="img"` + summary aria-label is the floor, not the ceiling: the per-year counts reach AT only as a one-line label. Fix: add a visually-hidden data `<table>` (or `<figure>`/`<figcaption>`) mirroring the series, and reconcile the two labels — wrapper says "Bienes declarados por año" (`patrimonio-de-parlamentario.tsx:172`) while the chart says "…por declaración (año y tipo)" (`patrimonio-chart.tsx:79`).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Degrade copy is a neutral fact in a COUNT frame, never a trajectory: "Datos insuficientes para mostrar el conteo de ítems por año…" (`patrimonio-de-parlamentario.tsx:174-177`). Correct per UI-SPEC §2 ("datos insuficientes para una tendencia") and §6 checklist.
- Montos caveat is honest and explicit: "Montos no disponibles como cifra en la fuente. El gráfico muestra el N.º de bienes declarados por año, nunca su valor." (`:182-185`). Directly satisfies the §0/§2 montos-as-URI contract.
- Axis/legend labels are NOUN phrases ("Bienes inmuebles", "Pasivos", "N.º de bienes declarados…") — no causal/verdict language. Mirrors `ORDEN_GRUPOS_BIENES`.
- Banned-vocabulary negative-match is test-enforced over the shell's `textContent` (`patrimonio-chart.test.tsx:275-293`: `PROHIBIDO_VEREDICTO`, `PROHIBIDO_CONECTIVO`, `PATRON_RUT`). No "aumentó/variación/delta/Δ/patrimonio total/conflicto" present. BLOCKER-free.

### Pillar 2: Visuals — honesty / anti-insinuación (4/4)
This is the load-bearing pillar for this phase, and the implementation is exemplary:
- **Stacked discrete `BarChart`, never line/area** (`patrimonio-chart.tsx:82-96`); test asserts the source never contains `LineChart|AreaChart|<Line|<Area` (`:337`). A connected line between incomparable versions would insinuate a wealth "tendencia" — correctly prevented.
- **Composite category key** `${anio} · ${tipo_declaracion} · ${version_id}` (`:57-59`) keeps two same-year/same-type declarations (e.g. two 2020 "Rectificación") as DISTINCT bands; Recharts would otherwise fuse equal category values. Test-enforced (`:297-315`) and the X axis is pinned to `dataKey="categoria"`, never bare `anio` (`:334-335`).
- **No montos graphed** — `SeriePunto` carries only per-`tipo_bien` integer counts (`patrimonio-de-parlamentario.tsx:99-116`); the transform "NUNCA toca un monto" (`:126-159`).
- WARNING: default `<Legend />`/`<Tooltip />` chrome is unstyled Recharts — a visual-consistency divergence from the cream/petrol surface. Needs-live for actual appearance; fix recommended (see Priority #2).

### Pillar 3: Color (3/4)
- Civic identity tokens correctly NOT reused for series fills — test asserts source has no `--camara|--senado` (`patrimonio-chart.test.tsx:340`). Satisfies DESIGN-SYSTEM §1.3 invariant (using chamber colour as chrome invites a political reading).
- Ramp is luminance-differentiated petrol→slate (`24%`→`74%` lightness, `patrimonio-chart.tsx:44-49`), which aids colour-blind separation of a 6-segment stack — a good choice.
- WARNING: the ramp is six hardcoded HSL string literals outside the token system; DESIGN-SYSTEM §4 expects palette values wired through `globals.css`/Tailwind. No hex and no civic-token misuse (good), but stop #1 `hsl(183 38% 24%)` drifts 2% lightness from the locked `--accent-product` `hsl(183 38% 26%)` and there is no dark-mode variant. See Priority #1.
- NEEDS-LIVE: contrast of the two lightest stops (`hsl(210 16% 64%)`, `hsl(215 14% 74%)`) on the cream `--card`, and adjacency contrast between them, is not statically determinable.

### Pillar 4: Typography (3/4)
- Shell prose uses correct ramp tokens: `text-sm text-muted-foreground` for caveat/degrade/footer (`patrimonio-de-parlamentario.tsx:174-188`). On-contract (DESIGN-SYSTEM §2 Label/meta).
- WARNING / NEEDS-LIVE: Recharts axis ticks, legend, and tooltip render with library-default typography, not Geist Sans (DESIGN-SYSTEM §2 "Geist Sans for everything"). Static read cannot confirm inheritance; verify on live render and theme if it falls back to a generic sans.

### Pillar 5: Spacing (4/4)
- All chart-shell spacing is on the 8-pt scale: `my-6` (lg), `mt-2`, `mt-1` (`patrimonio-de-parlamentario.tsx:172-188`). Chart height `h-72` is a standard Tailwind step.
- Carril frontier intact: the chart renders inside `<PatrimonioChartShell>` as a sub-section of the patrimonio carril, NOT as a new sibling `mt-12` data domain — the LOCKED anti-insinuación frontier (DESIGN-SYSTEM §3/§8.1) is untouched.
- Minor (semantics, not spacing): the shell uses a nested `<section aria-label=…>` for what is really a figure; a `<figure>`/`<figcaption>` would read more accurately. Non-blocking.

### Pillar 6: Experience Design (3/4)
- Three honest states preserved upstream: no-ingestado, ingestado-cero, and with-versions (`patrimonio-de-parlamentario.tsx:473-501`) — distinct copy each, never "clean" (DESIGN-SYSTEM §7).
- Honest degrade `<2` declarations renders a grep-testable `<p>` and does NOT mount the SVG island (`:170-191`); caveat + CC BY footer render in BOTH the degrade and the chart path (test `:248-262`).
- Provenance: CC BY 4.0 + named source + external link present at the chart footer via `AtribucionCcBy` (`:206-222`), consistent with the version table and comparison caption. Source = "InfoProbidad — Consejo para la Transparencia". (Minor: the chart-level footer carries no freshness date; per-version `ProvenanceBadge`s carry `capturedAt`, so freshness is covered at the row level — acceptable.)
- SSR/island boundary is clean: `PatrimonioChartShell` is server, `<PatrimonioChart>` is `"use client"` importing only the `type` (`patrimonio-chart.tsx:1-13`); props are flat `SeriePunto[]` (strings+numbers only) — serializability is test-enforced (`patrimonio-chart.test.tsx:219-230`). No Supabase client leak into the bundle (`:329-330`). Recharts kept out of the server bundle, mirroring `red-graph.tsx`.
- WARNING: accessibility ceiling — chart data reaches AT only via the summary `aria-label`; no hidden data-table fallback. Plus the wrapper/chart aria-labels are worded inconsistently ("por año" vs "por declaración (año y tipo)"). See Priority #3.
- NEEDS-LIVE (operator): tooltip keyboard/hover behaviour, reduce-motion on bar animation, responsive tick overlap of the long composite labels on the 375px viewport, and ResponsiveContainer sizing.

---

## Items Requiring Live Verification (operator — deferred build/deploy)
- Colour contrast of the two lightest fill stops on cream `--card`, and stop adjacency contrast.
- Whether Recharts axis/legend/tooltip inherit Geist or fall back to a generic sans.
- Default tooltip/legend appearance on the cream surface (theming gap).
- Responsive behaviour of long X-axis category labels at 375px; tick overlap/rotation.
- Reduce-motion handling of the bar entrance animation; tooltip keyboard accessibility.
- Recharts not breaking the OpenNext/Cloudflare worker build (UI-SPEC §6 checklist — Docker Linux, not Windows).

---

## Files Audited
- `app/components/patrimonio-chart.tsx` (client island: `categoria()`, `SERIES` fill ramp, `<PatrimonioChart>`)
- `app/components/patrimonio-de-parlamentario.tsx` (`seriePatrimonio()` transform, `SeriePunto`, `PatrimonioChartShell`, `PatrimonioView`, `AtribucionCcBy`, `PatrimonioSection`)
- `app/components/patrimonio-chart.test.tsx` (VIZ-01/02/03 unit + negative-match coverage)
- Baselines: `46-UI-SPEC.md`, `19-…/DESIGN-SYSTEM.md`
