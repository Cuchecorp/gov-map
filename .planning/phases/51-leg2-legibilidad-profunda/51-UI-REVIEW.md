# Phase 51 — UI Review

**Audited:** 2026-07-03
**Baseline:** 51-UI-SPEC.md (extends F44 UI-SPEC + DESIGN-SYSTEM.md, LOCKED)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080) — code-only audit

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Neutral-factual Chilean Spanish, banned-vocab clean, honest 3-state once-per-section; only nit is a placeholder contact mailto |
| 2. Visuals | 3/4 | Solid h1→h2→h3 hierarchy + a11y labels, but two-color link system (blue + petróleo) sends the "this is a link" signal in two hues on one ficha |
| 3. Color | 2/4 | Reserved-for petróleo NOT honored on new affordances — `text-primary` renders shadcn-default BLUE (off-palette, absent from DESIGN-SYSTEM) on every "Ver detalle" / "ver todas" / inactive toggle |
| 4. Typography | 3/4 | Ramp respected + Mono en-dash correct, but `font-medium` (500) is a 3rd weight and two prescribed Mono tallies render in Sans |
| 5. Spacing | 3/4 | 8-pt scale + `mt-12` carril frontier intact, but `min-h-[44px]` arbitrary value used where the token is `min-h-11`, inconsistent across sibling components |
| 6. Experience Design | 4/4 | Server-driven searchParams contracts fully honored, honest error/empty/loading coverage, fail-safe param normalization, zero new client island |

**Overall: 19/24**

Registry audit: shadcn initialized (`app/components.json`); UI-SPEC declares zero third-party registries and zero new blocks. 0 third-party blocks checked, no flags. No new dependencies (verified: every phase-51 `tech-stack.added` is `[]`).

---

## Top 3 Priority Fixes

1. **Reserved-for petróleo violated: new link affordances render in blue `--primary`, not `--accent-product`** — WARNING. Every "Ver detalle"/"Ocultar detalle" (votos, patrimonio), "ver todas"/"Ocultar urgencias" (timeline), inactive vista toggle and pagination uses `text-primary`, which globals.css maps to the un-overridden shadcn Slate blue `221.2 83.2% 53.3%` — a hue absent from the cream/warm/petróleo palette. Meanwhile the lobby active toggle, footer, and /metodologia correctly use `text-accent-product` (petróleo `183 38% 26%`). Result: two different link colors on the same ficha, and the UI-SPEC §Color "reserved-for" list (which names exactly these affordances as petróleo) is unmet. Fix: replace `text-primary` with `text-accent-product` on the phase-51 link affordances in `votos-por-parlamentario.tsx` (:358, :366, :436, :634, :650, :686, :693), `patrimonio-de-parlamentario.tsx` (:500, :591, :604), `timeline-view.tsx` (:244, :260), `lobby-de-parlamentario.tsx` inactive/pagination (:201, :446, :459).

2. **Two prescribed Mono tallies render in Sans + a third font-weight sneaks in** — WARNING. UI-SPEC Typography "Mono rule" requires every count/"N de M" attendance/tally in Geist Mono. `votos-por-parlamentario.tsx:527` ("Presente en {presentes} de {totalConteos} votaciones") and `:671` (SC5 "Votó distinto … {rebeldias.length} veces") are plain Sans. Separately, DESIGN-SYSTEM allows exactly 2 weights (600/400) but `lobby-de-parlamentario.tsx:353` renders the contraparte `<h3>` in `font-medium` (500, a 3rd weight) instead of the sacred h3 `font-semibold`, and the active toggle (:199) also uses `font-medium`. Fix: wrap the two counts/`N de M` in `<span className="font-mono">`; change `font-medium` → `font-semibold` (h3) and `font-normal` (toggle).

3. **`min-h-[44px]` arbitrary value used where the token is `min-h-11`** — WARNING. UI-SPEC Spacing exceptions define the 44px touch target as the `min-h-11` token; the comparator selects/button (`patrimonio` :678/:692/:703) and lobby toggle (`min-h-11`) use it correctly, but `votos-por-parlamentario.tsx` (:436, :551, :564, :634, :650), `patrimonio-de-parlamentario.tsx` (:500, :591, :604) and `timeline-view.tsx` (:244) use the arbitrary `min-h-[44px]`. Same rendered height, but off-token and inconsistent within one phase. Fix: replace `min-h-[44px]` with `min-h-11`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Prescribed CTA "Comparar" present (`patrimonio` :703); "Elige dos fechas para comparar" present (:671); <2-versions omits form and keeps the neutral fact (:644-646) — zero contradiction with the label, as SC4 requires.
- Honest 3-state (no ingestado / ingestado-sin-resultados / error) is distinct and once-per-section in votos (:461-478), lobby (:293-317), patrimonio (:528-552); B24 per-row honesty confirmed deleted (`51-02-SUMMARY`, grep 0 "no disponible aún").
- Footer SC8 strings match contract verbatim (`layout.tsx` :51-91): attribution + CC BY 4.0 scope-caveat that does NOT name ChileCompra/SERVEL, trust line at the pie. /metodologia is minimal and honest, declares its own scope (no data-dictionary promise).
- Defensible deviation (more honest, not less): the SC2 urgency collapse line was reworded from the prescribed "Urgencia {tipo} renovada {N} veces …" to "Urgencia {tipo}: {N} eventos …" (`timeline-view.tsx:199`) because "renovada N veces" would count the initial presentation as a renewal — a fabricated claim. UI-SPEC permits punctuation/placeholder variation and forbids fabrication; this is correct. SC5 framing "Votó distinto a la mayoría de su bancada {N} veces" preserves the prescribed meaning.
- Nit (WARNING): contact is a placeholder domain `mailto:contacto@observatoriocongreso.cl` (footer + /metodologia) — ships a non-resolving inbox until the operator confirms the domain (already flagged as operator debt in `51-06-SUMMARY`).

### Pillar 2: Visuals (3/4)
- Clear hierarchy: h1 page title (`parlamentario-header.tsx:51`), h2 carril/"¿Dónde está hoy?" (`estado-actual-block.tsx:124`), h3 card/contraparte/arc titles. Focal points present (state block opens the proyecto ficha; provenance badges anchor each datum).
- a11y is strong: the vote bar carries `role="img"` + composed `aria-label` and repeats each count in text (`votos` :502-523, never color-only); toggle uses `aria-current` (`lobby` :209/:217); decorative timeline dots and em-dash carry `aria-hidden`. No icon-only buttons without labels.
- Finding (WARNING): the blue/petróleo split (see Pillar 3) means an interactive link is signaled in two different colors on a single ficha — a hierarchy/affordance inconsistency, not just a palette issue.

### Pillar 3: Color (2/4)
- Root cause is in `app/globals.css`: the comment states `--primary/--secondary/--accent` are NOT overridden — they stay shadcn Slate defaults. `--primary: 221.2 83.2% 53.3%` (blue); `--accent-product: 183 38% 26%` (petróleo); `--ring: 183 38% 26%` (petróleo, correct on the comparator selects :678/:692).
- `text-primary` (blue) appears in 7 phase-51 spots in votos, 3 in patrimonio, 2 in timeline-view, 1 in timeline-event, 3 in lobby, 1 in resumen — all rendering the reserved-for-petróleo affordances in an off-palette blue. UI-SPEC §Color "Accent (petróleo) reserved-for #1" explicitly lists "Ver detalle / Ocultar detalle, ver todas, vista toggle, footer links" as petróleo. Contract unmet for the new affordances; the lobby active toggle + footer + /metodologia are the only places honoring it → visible inconsistency.
- Correct where it counts elsewhere: civic/vote-outcome palette (`bg-green-500/red-500/amber-400/slate-*`) used only as the literal factual VotacionBar (permitted); amber caveats (`text-amber-700` patrimonio :453, `--identity-warn-*` lobby :256-257) used once per section (permitted); comparator submit is petróleo `bg-accent-product` (:703, correct); `EstadoActualView` canvas is `bg-background`, not petróleo (:122, correct per §0.3). No hardcoded hex introduced.

### Pillar 4: Typography (3/4)
- Ramp respected: `text-3xl` h1, `text-xl` h2, `text-base` h3/body, `text-sm` meta, `text-xs` footer trust line. Mono en-dash correct: `conteoVotacion` returns `${si}–${no}` (en-dash `–`, `lib/format.ts:97`); resumen attendance chip is `font-mono tabular-nums` (`parlamentario-resumen.tsx:76-77`, correct); period, dates, tallies, ranges are Mono across the arc summary line and version cards.
- Findings (WARNING): (a) `votos-por-parlamentario.tsx:527` attendance "N de M" and `:671` SC5 count render in Sans though the Mono rule names both; (b) `lobby-de-parlamentario.tsx:353` contraparte `<h3>` uses `font-medium` (500) instead of the sacred h3 `font-semibold` (600), and `:199` active toggle also uses `font-medium` — a 3rd weight the DESIGN-SYSTEM 2-weight rule forbids.

### Pillar 5: Spacing (3/4)
- 8-pt scale substantially honored: `mt-12` carril frontier untouched (CarrilAccordion reused unchanged, `51` summaries); patrimonio card and "¿Dónde está hoy?" block both `p-6` (lg, correct); footer `px-4 md:px-8 py-8`; page padding `md:py-16`. Comparator selects/button on the `min-h-11` token.
- Findings (WARNING): `min-h-[44px]` arbitrary value in votos (5×), patrimonio (3×), timeline-view (1×) where the declared token is `min-h-11` — same computed height, off-token, inconsistent with lobby/comparator. Minor: `space-y-1.5` (`estado-actual-block.tsx:125`) and `gap-x-1.5` (`lobby` :228) resolve to 6px, off the multiples-of-4 grid; cosmetically negligible but not on-scale.

### Pillar 6: Experience Design (4/4)
- Interaction contracts fully server-driven: `?votosVer` (arc detail), `?urgencias` (urgency expand), `?ver` (patrimonio detail), `?a`/`?b` compat `?comparar=A,B` native GET form, `?vista=cronologica` toggle — all searchParams round-trips, zero new client island (only shipped CarrilAccordion remains a client boundary), comparator is `<form method="get">` with no onClick/onSubmit.
- Honest state coverage complete: every Server Component throws on real DB/red error (#34) rather than rendering an empty section as "no data" (votos :862, lobby :549, patrimonio :948/:961/:989, estado-actual :175-184); empty/no-ingestado distinguished from ingestado-zero via ingesta-estado markers.
- Robust fail-safe input handling: `normalizarVista` (lobby :153), `esFechaISOValida` semantic round-trip guard against Postgres date 500s (patrimonio :860), `votosVer` equality-only comparison (never interpolated in SQL), `normalizarPagina` digit-only. No destructive actions exist (read-only product) — confirmation N/A per contract.
- Registry: no third-party blocks, no new deps — supply-chain surface unchanged.

---

## Files Audited
- `app/components/votos-por-parlamentario.tsx` (SC1/SC5 — arc summary + rebeldías + B24)
- `app/components/voto-ficha-row.tsx` (B24 dead-code removal — via summary)
- `app/components/patrimonio-de-parlamentario.tsx` (SC3/SC4 — resumen card + comparator + esUriCplt)
- `app/components/lobby-de-parlamentario.tsx` (SC6 — grouped-by-contraparte + toggle + identity caveat)
- `app/components/estado-actual-block.tsx` (SC2 — "¿Dónde está hoy?" derivation)
- `app/components/timeline-view.tsx` (SC2/SC7 — two-level timeline + urgency collapse)
- `app/components/parlamentario-header.tsx` (header enrichment — período, LEGAL-03)
- `app/components/parlamentario-resumen.tsx` (attendance chip — via grep)
- `app/app/layout.tsx` (SC8 — global footer)
- `app/app/metodologia/page.tsx` (SC8 — methodology page)
- `app/app/globals.css` (color tokens — root cause of Pillar 3)
- `app/lib/format.ts` (conteoVotacion / relativeTimeEs / fechaCorta — Mono en-dash verification)
- `app/components.json` (registry safety — shadcn baseline, no third-party)
- Plans/summaries 51-01…51-07 + 51-UI-SPEC.md + 51-CONTEXT.md
