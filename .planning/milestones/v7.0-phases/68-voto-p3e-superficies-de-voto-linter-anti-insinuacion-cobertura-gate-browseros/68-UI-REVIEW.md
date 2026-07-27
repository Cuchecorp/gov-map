# Phase 68 — UI Review

**Audited:** 2026-07-14
**Baseline:** 68-UI-SPEC.md (6-pillar design contract, anti-insinuación LOCKED)
**Screenshots:** not captured (no dev server on :3000/:5173 — static code audit)
**Verdict:** PASS with attention items. No BLOCKER. 2 WARNINGs (both in sibling surfaces, not the primary carril).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Leyenda anti-insinuación VERBATIM present; guard 9/9 green; empty/error honest (error thrown, not disguised as 0). |
| 2. Visuals | 4/4 | Chart is stacked discrete BarChart (never line/area); LOCKED sentido order; rebeldía + mediana-de-cámara surfaces confirmed ABSENT from render. |
| 3. Color | 3/4 | Sentido tokens correct + single-source; pareo/ausente in slate, never fused with red. WARNING: sibling vote surfaces (`voto-row`, `voto-ficha-row`, `voto-detalle`) use `text-primary` (blue) for links instead of `text-accent-product` (petróleo). |
| 4. Typography | 4/4 | Color-coded counts repeated as text (`aria-label` + `font-mono`); h2→h3 hierarchy intact; touch targets 44px present. |
| 5. Spacing | 4/4 | `mt-12` carril frontier intact across all 6 domains; 8-point scale; disclosure default-closed with capa-1 outside. |
| 6. Experience/Procedencia | 3/4 | ProvenanceBadge per vote; only confirmed votes attributed; N/M unconditional. WARNING: leyenda anti-insinuación NOT rendered on `voto-detalle` (project-ficha / Senado surface), which SPEC §Leyenda requires. |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Anti-insinuación legend missing on the project-ficha / Senado vote surface** (`voto-detalle.tsx`) — SPEC §Leyenda and §Copywriting state the legend must appear "1× a nivel de la votación, sobre la lista voto-a-voto" on the project ficha, not only on the parlamentario ficha. A cold reader arriving at a project's vote-a-vote list sees no honest frame before the vote data. — Fix: render the LEYENDA_ANTI_INSINUACION constant (extract to a shared module) at the top of the `VotoDetalle` expanded panel (or at the votación level in the project ficha), reusing the `text-sm text-muted-foreground border-l-[3px] border-[--accent-product] pl-2.5` treatment.

2. **Vote-link color diverges from the reserved-accent rule** — `voto-row.tsx:44`, `voto-ficha-row.tsx:120/127/200/207`, `voto-detalle.tsx:32` use `text-primary` (shadcn default blue `221 83% 53%`) for links/toggles, while SPEC §Color reserves the petróleo `--accent-product` for "enlaces (a `/proyecto`, a fuente oficial)". The primary carril (`votos-por-parlamentario.tsx`) correctly uses `text-accent-product`; its siblings do not, so the same "link" affordance is two different colors across vote surfaces. — Fix: replace `text-primary` with `text-accent-product` in the three sibling components for link/toggle text, matching `votos-por-parlamentario`.

3. **`techoPorCausa` is an un-wired stub** — the "techo por causa" line (SPEC §Cobertura, VOTO-05) is fully built in the UI and covered by tests, but `VotosSection` never computes the cause, so `techoPorCausa` is always `undefined` and the line never shows in production. This is an intentional data stub (documented in SUMMARY §Known Stubs), not a render defect — flagged so it is not forgotten when the freshness N/M coverage signal lands. — Fix: derive the cause from the ingest-coverage signal in a follow-up plan; no change needed to honor "never fabricate the techo".

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Leyenda anti-insinuación is a VERBATIM LOCKED constant (`votos-por-parlamentario.tsx:274-275`), rendered once as block 0 before any data (`:645-647`). Matches the SPEC §Copywriting string exactly.
- Nota de significado "A favor / En contra se refiere a aprobar o rechazar el proyecto…" present verbatim (`:764-767`).
- Chart no-tendencia note present verbatim (`:660-663`).
- Both empty states honest and distinct: "no ingestado" vs "ingestado, 0 confirmados" (`:594-624`).
- Error is THROWN, not disguised as 0 votes (`:1003-1007`) — matches SPEC §Copywriting "Error state se LANZA".
- Anti-vocabulary linter (`lib/anti-insinuacion-guard.test.ts`) is a real guard with a mutation self-check (Test 2 proves it bites); scans the 7 vote surfaces; 9/9 green in this audit. `rebeldía`/`disciplina`/`score`/`mediana de su cámara` all in the hard-fail list. The LOCKED negation is subtracted before matching so the honest legend doesn't self-trip.

### Pillar 2: Visuals (2 prohibited surfaces removed) (4/4)
- Chart is `BarChart` with stacked `Bar`s (`votos-chart.tsx:63-77`), `stackId="votos"`, `YAxis allowDecimals={false}` — never a line/area. Anti-tendencia rule honored.
- LOCKED sentido stack order `si → no → abstencion → pareo → ausente` enforced via the single `SELECCION_ORDEN` (`voto-presentacion.ts:38-44`), consumed by chart, bar, and counts.
- Poda verified: `git grep` in SUMMARY reports 0 matches for `AusenciasContexto` / `rebeldias_de_parlamentario` / `tasa_ausencia_comparada` / "Votó distinto a su bancada"; `ausencias-contexto.tsx` deleted. The carril ends at the arco-por-proyecto block (5) as SPEC §Composición requires. No judgment/comparison surface remains in the render.

### Pillar 3: Color (regla neutral-slate) (3/4)
- Single source of truth `VOTO_PRESENTACION` (`voto-presentacion.ts:25-35`): `pareo` = `bg-slate-400`/`hsl(215 20% 65%)`, `ausente` = `bg-slate-300`/`hsl(213 27% 84%)` — SLATE, never red. Badge styles `SELECCION_STYLE` (`voto-row.tsx:19-30`) match: pareo `slate-600`, ausente `slate-500`. **Neutral-slate hard rule PASSES** — pareo/ausente are visually separated from the red `no` bucket, and the LOCKED stack keeps both slates together at the end.
- `fill` hsl and Tailwind `bg-*` live in the same object → cannot desync (verified).
- Petróleo `--accent-product` (`183 38% 26%`) is used for links/facet-active/pagination/focus in the primary carril; it is NOT used as a vote sense. Rule honored where it matters most.
- **WARNING (the −1):** the reserved-accent rule is not applied consistently to sibling vote surfaces. `voto-row.tsx:44`, `voto-ficha-row.tsx:120/127/200/207`, `voto-detalle.tsx:32` link/toggle text uses `text-primary` (shadcn blue), not `text-accent-product` (petróleo). Petróleo is never leaking onto a vote sense (the dangerous direction), so this is a consistency/brand defect, not an insinuation defect — hence WARNING, not BLOCKER.
- a11y contrast (petróleo on crema, slate badge fg/bg WCAG ratios) can only be confirmed on the rendered page — defer to the BrowserOS operator gate.

### Pillar 4: Typography + a11y (4/4)
- Color-coded counts are repeated as text: the "Cómo votó" bar has an `aria-label` enumerating each sense + count (`:684-686`) AND a visible `font-mono` line (`:700-704`). a11y hard rule honored.
- Chart wrapper has `role="img"` + `aria-label` (`votos-chart.tsx:57-61`).
- Heading hierarchy: carril `<h2>` "Votaciones" (in page CarrilHeader) → sub-block `<h3>` "¿Cuándo votó?"/"Cómo votó"/"Por tema" — no re-leveling.
- `font-mono`/`tabular-nums` on counts, dates, boletines, N-de-M — consistent with SPEC §Typography.
- Touch targets `min-h-11` / `min-h-[44px]` on every interactive control (facet chips, pagination, detail toggle, empty-state links).

### Pillar 5: Spacing (4/4)
- `mt-12` anti-insinuación carril frontier confirmed on every domain section in `page.tsx` (votos, lobby, patrimonio, cruces, dinero, financiamiento, financiamiento-pendiente) — a vote never shares a container with another domain. The comment blocks reaffirm the frontier is LOCKED and not moved to the wrapper.
- `space-y-10` between sub-blocks, `space-y-6` between arcos, `mt-4`/`mt-2`/`mt-1` per the 8-point scale (`votos-por-parlamentario.tsx:640, 776`).
- Disclosure default-closed with capa-1 outside the `DetalleColapsable` (`page.tsx:271-286`); relationship intact.
- No arbitrary px spacing values in the vote carril (the only `[…]` arbitraries are `border-l-[3px]` for the legend rule and `min-h-[44px]`, both sanctioned by the SPEC).

### Pillar 6: Procedencia + cobertura + identidad (3/4)
- `ProvenanceBadge` (fuente + fecha de captura + enlace "fuente oficial ↗") on every vote in the expanded arco (`:551-556`) and on `voto-ficha-row`. Never omitted — a null provenance renders "fuente desconocida" without a link rather than disappearing.
- Each vote links to the project (`/proyecto/{boletin}`) and to the official votación via `e.enlace`. Reader can always reach the source.
- Only `confirmado` votes are attributed: the RPC returns confirmed-only, and `voto-row`/`voto-ficha-row` degrade a non-confirmed mention to a raw name + `IdentityMarker`, never a link. `probable/no_confirmado` never enters aggregate counts.
- N/M por proyecto is INCONDICIONAL when there are votes (`:801-807`) — never fakes exhaustividad. Asistencia derived from `ausente`, never from vote sense (`:630-631, 706-713`).
- **WARNING (the −1):** the anti-insinuación legend is absent from `voto-detalle.tsx`. SPEC §Leyenda requires it "a nivel de la votación" on the project ficha / Senado surface; the component renders the vote-a-vote list with no honest frame. The guard does not catch this (it checks for prohibited *presence*, not required-legend *absence*). This surface is not the phase's primary carril but is explicitly in the SPEC's legend contract. Note: `techoPorCausa` un-wired stub is documented and intentional (does not lower the score).

---

## Registry Safety

`components.json` present (`app/components.json`); SPEC §Registry Safety lists only shadcn official blocks (Badge, Tooltip, Skeleton, Accordion) and explicitly "terceros: ninguno". No third-party registries to audit. Registry audit: 0 third-party blocks checked, no flags.

---

## Deferred to BrowserOS operator gate (cannot confirm statically)
- Computed WCAG contrast of petróleo links on crema, slate badges, and stale-amber provenance text.
- The "comprensible" cold-read verdict: that a non-expert perceives A favor/En contra as approve/reject (not ideology), pareo/ausente as neutral, sees the legend before data, and finds no impression of alignment/discipline. Code supports all six comprehension criteria; the human read is the gate.

---

## Files Audited
- app/lib/voto-presentacion.ts
- app/components/votos-por-parlamentario.tsx (+ .test.tsx, 70/70 green)
- app/components/votos-chart.tsx
- app/components/voto-row.tsx
- app/components/voto-ficha-row.tsx
- app/components/voto-detalle.tsx
- app/components/provenance-badge.tsx
- app/lib/anti-insinuacion-guard.test.ts (9/9 green)
- app/app/parlamentario/[id]/page.tsx (mount point + mt-12 frontier)
- app/app/globals.css, app/app/styles/civic-tokens.css (design tokens)
