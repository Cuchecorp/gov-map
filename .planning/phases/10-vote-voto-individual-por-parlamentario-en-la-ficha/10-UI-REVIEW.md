# Phase 10 — UI Review

**Audited:** 2026-06-19
**Baseline:** 10-UI-SPEC.md (design contract) + inherited v1.0 §1–§9
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — carried v1.0 cloud-data debt; audit is code/markup only, as scoped)
**Stance:** advisory / non-blocking

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting (incl. §9.1 hard gate) | 4/4 | Anti-causality/anti-affinity gate fully honored; copy matches §9 contract verbatim; partido omitted (LEGAL-03) |
| 2. Visuals / layout + extensible shell | 4/4 | Single-column stackable shell, independent Suspense per section, h1→h2→h3 seam valid for Phase 11+ |
| 3. States (3 honest states) | 3/4 | (a)/(b)/(c) all modeled and tested; but `noIngestado` is hardwired `false` and §6.3 error UI is not implemented as a typed boundary |
| 4. Interaction (pagination, facet) | 3/4 | SSR pagination + facet correct and deep-linkable; facet drops `votosPage` reset and active-chip affordance is weak |
| 5. Accessibility | 3/4 | Heading order valid, 44px targets, bar has per-segment aria-label; attendance bar `role="img"` redundancy + touch-target height not guaranteed |
| 6. Visual consistency w/ v1.0 | 3/4 | Reuses ProvenanceBadge/IdentityMarker/CamaraChip/SELECCION_STYLE verbatim; one divergence: inlined bar instead of the VotacionBar component |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Error state (§6.3) has no honest UI — a Supabase failure throws into the framework default, not the contracted "Ocurrió un error… [fuente oficial ↗] + Reintentar".** Impact: a transient DB/network error renders as a generic Next error page (or nothing), violating the §6.3 rule that distinguishes a real error from "sin votos." The code correctly `throw`s on `error` (good — never masks as empty), but no `error.tsx` boundary catches it with the contracted copy. Fix: add `app/app/parlamentario/[id]/error.tsx` ("use client") rendering the §6.3 `border-destructive/20 bg-destructive/5` block with the exact copy and a Reintentar button (`reset()`).

2. **`noIngestado` is hardwired to `false`, collapsing state (c)-not-ingested into (c)-ingested-zero.** Impact: the existential §3.6 distinction ("no consultado todavía" vs "consultado, sin votos") cannot fire in production — every legislator with zero confirmed rows reads as "No hay votaciones confirmadas… en la legislatura vigente," even before ingestion has ever run. The honest "Aún no hemos ingerido…" path exists and is tested but is unreachable from `VotosSection`. Fix: derive `noIngestado` from a real marker (e.g. an ingestion-status row / RPC flag for this legislator) instead of the literal `false` at `votos-por-parlamentario.tsx:438`.

3. **Materia facet does not reset pagination and uses a low-affordance active state.** Impact: switching tema while on page 3 keeps `votosPage` only on pagination links, but the facet chips themselves (`buildHref(id, { materia: slug })`) drop `votosPage` entirely — so the filtered list silently jumps to page 1 with no "Página 1 de M" recomputation guarantee if the filtered set is shorter; and the active chip relies on `border-b-2 border-primary` wrapped around a `Badge` whose own border/padding visually competes, making the selected tema hard to perceive. Fix: explicitly set `votosPage: "1"` in the facet hrefs, and move the active affordance onto the Badge (e.g. `variant` swap or `ring`) so it reads as selected.

---

## Detailed Findings

### Pillar 1: Copywriting — incl. §9.1 hard gate (4/4)

The most important constraint of the phase is **clean**. No BLOCKER findings.

- **Anti-causality / anti-affinity (§9.1):** No causal, affinity, alignment, score, ranking, or judgment language in any user-facing string. Verified against the prohibited list in the RTL gate (`votos-por-parlamentario.test.tsx:244`), which asserts `container.textContent` does not match `/afinidad|alinead|en línea con|afín a|aliad|rival|díscolo|rebeld|leal|disciplina|score|ranking|índice de|por presión de|a cambio de|favoreciendo a/i`. The §9.1 footgun in the docstring (which once spelled the banned terms) was rewritten to reference the spec instead (SUMMARY deviation #3) — confirmed at `votos-por-parlamentario.tsx:23-30`, no banned term present in source.
- **Neutral rebeldías heading:** user-facing heading is exactly "Votó distinto a su bancada" (`:283`); the internal name "rebeldías" never reaches the DOM. Method footnote present verbatim (§9, `:316-319`). Empty state is a fact, not a virtue: "No se registran votaciones en que haya votado distinto a su bancada." (`:285`) — no "100% alineado"/"leal"/"disciplinado."
- **Vote options:** "A favor / En contra / Abstención / Pareo / Ausente" (`OPCION_LABEL`, `voto-ficha-row.tsx:34-40` and `votos-por-parlamentario.tsx:35-41`). `ausente` is never collapsed to "no votó" (asserted `test:119`).
- **Identity uncertainty** is exactly "identidad no verificada" with no hedge (`identity-marker.tsx:21`, asserted `test:109`).
- **partido omitted (LEGAL-03):** the bancada/partido chip mandated by UI-SPEC §3.1 is deliberately not rendered (`parlamentario-header.tsx:16-19`), and the RPC `parlamentario_publico` does not emit `partido`/`rut`/`email`. This is a justified, documented deviation that strengthens the content contract; the spec's own §5 forbids party-colored chips, and omission is the safer reading of deny-by-default. No causal/affinity exposure.
- Empty/not-found copy matches §6.1 verbatim (`not-found.tsx:12-15`, `votos-por-parlamentario.tsx:124-138`).

### Pillar 2: Visuals / layout + extensible shell (4/4)

- **Stackable shell (extensibility mandate):** `page.tsx:42-62` is a single `max-w-3xl` column; `<section id="votos">` is self-contained with its own `<h2>` and Suspense boundary, and the Phase 11+ seam is documented inline (`:54-61`) with the rule "NO anidar en #votos y NUNCA componer un dato de otro bloque." This is exactly the §0 extensibility contract — INT/MONEY can append `<section>`s without touching VOTE.
- **Sub-block order** matches §3 (asistencia → tema → lista → votó distinto). Note: the spec's stated order is asistencia → list → tema → rebeldías; the implementation places "Por tema" *above* the list (`:185` before `:219`). This is a minor reordering, not a defect — the facet logically precedes the list it filters. Flag as WARNING-cosmetic only.
- **Focal point:** the `<h1>` nombre at `text-3xl` is the clear focal point; CamaraChip above it provides institutional context. Hierarchy reads top-down.
- CSS-pure bar used (no Recharts/visx), honoring §5/Implementation note 5.

### Pillar 3: States — the 3 honest states (3/4)

- **State (a) confirmado:** full row, boletín links to `/proyecto/[boletin]`, ProvenanceBadge present (`voto-ficha-row.tsx:54-73`). Correct.
- **State (b) presente-no-verificado:** `VotoFichaMencionRow` shows raw `mencion_nombre` + `<IdentityMarker/>`, never links to the profile, even when a `probable` row carries an id (`:80-125`, asserted `test:122-140`). Excluded from aggregates by construction (the confirmed RPC never emits mentions). Correct and well-guarded.
- **WARNING — state (c) is unreachable in practice:** `noIngestado: false` is a literal at `votos-por-parlamentario.tsx:438`. The honest "Aún no hemos ingerido…" branch (`:122-129`) exists and is tested (`test:145`) but can never fire from the live Server Component — every zero-row legislator falls through to "No hay votaciones confirmadas… legislatura vigente" (`:131-138`). The §3.6 statement that "(a) vs (c) distinction is existential" is satisfied in the view layer but defeated in the data layer. Acceptable as carried debt for now (no live data), but it must be wired before launch — see Top Fix #2.
- **BLOCKER (advisory) — §6.3 error UI absent:** `VotosSection` and `HeaderSection` correctly `throw` on a real Supabase `error` (`:356`, `:419`, `page.tsx:75`) — they never mask a transient failure as "sin votos," which is the hard part and is done right. But there is no `error.tsx` boundary rendering the contracted §6.3 block ("Ocurrió un error… puedes consultar la fuente directamente en [fuente oficial ↗]" + "Reintentar"). The throw currently surfaces as the framework default. See Top Fix #1.
- Loading: shape-matched skeletons, `aria-hidden="true"`, one per Suspense boundary (`page.tsx:88-111`). Matches §6.2.

### Pillar 4: Interaction — pagination + materia facet (3/4)

- **Pagination is SSR and deep-linkable:** `?votosPage=N` anchors, "Página N de M", `min-h-[44px]`, no infinite scroll (`:243-278`, asserted `test:251`). Pagination links correctly preserve `materia` (`:250-253`, `:266-269`). Correct per §3.2.
- **Facet is server-driven** via `?materia=slug` anchor chips (`:189-215`). Correct per §3.4 / Implementation note 6.
- **WARNING — facet drops `votosPage`:** `buildHref(id, { materia: slug })` (`:202-203`) omits `votosPage`, so changing tema resets to page 1 by absence. This is probably the intended behavior, but it's implicit, not explicit — and `buildHref` strips any null/absent key, so a deep-linked `?materia=salud&votosPage=2` survives navigation but a facet click silently loses it. Make the reset explicit (`votosPage: "1"`).
- **WARNING — weak active affordance:** the active chip uses `border-b-2 border-primary` on the wrapping `<Link>` (`:194`, `:206`) while the inner `Badge variant="secondary"` carries its own background — the underline sits under a pill and reads ambiguously. §3.4 calls for the same active affordance as v1.0 section nav; consider moving the selected state onto the Badge itself.
- No client-only state introduced (stayed RSC), honoring Implementation note 3.

### Pillar 5: Accessibility (3/4)

- **Heading hierarchy valid:** `h1` nombre (one per page, `parlamentario-header.tsx:45`) → `h2` "Votaciones" (`page.tsx:48`) → `h3` Asistencia/Por tema/Votó distinto (`:147`, `:188`, `:283`). No skipped levels; the shell keeps this valid as Phase 11+ append `h2`s. Matches §8.
- **No info by color alone:** attendance bar has a container `aria-label` listing every option:count AND a per-segment `aria-label`, AND the full breakdown is repeated in a text row (`:169-173`). Vote chips always carry a text label (`OpcionChip`). Strong.
- **WARNING — bar a11y redundancy / structure:** the bar uses `role="img"` with a container `aria-label` *and* per-child `aria-label` on decorative `<div>`s (`:150-166`). Under `role="img"` the element is an atomic graphic; child `aria-label`s on non-semantic divs are largely ignored by AT and add noise. The container label + adjacent text already satisfy §8 — the per-segment labels are redundant. Not a failure (over-labeling, not under-labeling), but worth simplifying to match the cleaner `VotacionBar` pattern.
- **WARNING — 44px target not guaranteed on facet/pagination:** classes use `min-h-[44px] inline-flex items-center` (`:193`, `:254`, `:270`) which sets min *height* but the hit area still depends on the inner Badge/anchor width; the underline-only pagination anchors ("Anteriores"/"Siguientes") meet height but are narrow. Verify rendered width ≥44px or add horizontal padding to the anchor.
- IdentityMarker: `⚠` is `aria-hidden`, span `aria-label="identidad no verificada"` (`identity-marker.tsx:22-23`). Correct.
- External link in ProvenanceBadge: `target="_blank" rel="noopener noreferrer"` + aria-label "(abre en nueva pestaña)" (`provenance-badge.tsx:62-67`). Correct.

### Pillar 6: Visual consistency with v1.0 (3/4)

- **Verbatim reuse:** `ProvenanceBadge`, `IdentityMarker`, `CamaraChip`, and `SELECCION_STYLE` are imported and reused as-is (`voto-ficha-row.tsx:1-8`), honoring the §0 reuse mandate. `Seleccion` extended with `"ausente"` (the only contracted type change, `types.ts:10`).
- **Typography compliant:** across the three new component files only `text-3xl` (×1), `text-base` (×1), `text-sm` (×17) appear, with `text-xl` for the `<h2>` in page.tsx — 4 sizes total, exactly the v1.0 scale. Weights: `font-semibold` + `font-normal` only (no bold/light). `font-mono` reserved for boletín/fechas/conteos. No `text-xs`. Fully within §4.
- **Color compliant:** no hardcoded hex/rgb in the new files (grep clean). Accent is reserved-for: CamaraChip tokens, bar segments (green/red/amber/slate, the a11y-safe v1.0 set), provenance/identity tokens. partido chip absent → no risk of party coloring. Honors §5 60/30/10.
- **WARNING — bar is inlined, not the VotacionBar component:** the attendance bar is hand-rolled in `VotosView` (`:150-167`) with its own `BAR_SEGMENT` map (`:43-49`) instead of reusing `votacion-bar.tsx`. The spec says "reuse the `VotacionBar` CSS pattern" (pattern, not necessarily the component), and the attendance bar legitimately needs 5 segments incl. `ausente` where `VotacionBar` has 4 — so a separate implementation is defensible. But it duplicates the segment-color constants and the `role="img"`/segment-label structure, creating two sources of truth for bar styling. Recommend extracting a shared `<CssBar segments={...}/>` so a future token change updates both. Cosmetic/maintainability, not a visual defect.

---

## Registry Safety

`components.json` present (shadcn initialized). UI-SPEC §11 declares **shadcn official only**, zero third-party registries. Registry audit: 0 third-party blocks to check, no flags. No deduction.

---

## Files Audited

- `app/app/parlamentario/[id]/page.tsx` — route, stackable shell, header RPC read, skeletons
- `app/app/parlamentario/[id]/not-found.tsx` — §6.1 honest not-found
- `app/components/parlamentario-header.tsx` — reusable header (partido omitted, LEGAL-03)
- `app/components/voto-ficha-row.tsx` — VotoFichaRow (state a) + VotoFichaMencionRow (state b)
- `app/components/votos-por-parlamentario.tsx` — VotosSection (RSC) + VotosView (pure)
- `app/components/votos-por-parlamentario.test.tsx` — RTL: 3 states, §9.1 gate, pagination
- `app/components/voto-row.tsx` — SELECCION_STYLE source (reused)
- `app/components/provenance-badge.tsx`, `identity-marker.tsx`, `camara-chip.tsx`, `votacion-bar.tsx` — reused v1.0 system
- `app/lib/types.ts` — ParlamentarioPublicoRow, VotoFichaRow, VotoFichaMencion, RebeldiaRow, Seleccion
- `.planning/phases/10-.../10-UI-SPEC.md`, `10-03-SUMMARY.md`
