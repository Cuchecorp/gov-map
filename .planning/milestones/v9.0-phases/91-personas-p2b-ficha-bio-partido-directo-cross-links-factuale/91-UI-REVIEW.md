# Phase 91 — UI Review

**Audited:** 2026-07-22
**Baseline:** 91-UI-SPEC.md (design contract, approved: pending) + design system del repo (Tailwind 4 + tokens cívicos hsl-horneados)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only audit)
**Method:** static audit of the 9 phase-91 surfaces vs UI-SPEC + token/guard cross-checks. No visual/interaction verification was possible; 390px wrap behaviour is asserted from markup (`flex flex-wrap`), NOT observed — flagged `needs_human_review`.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Spec compliance (Copywriting) | 3/4 | Copy is verbatim on cross-links/militancias/empty-states, but the LOCKED Senado "comité≠militancia" leyenda (§Component 3, §Copy L119) is NOT implemented anywhere, and the counts leyenda ships literal "N" instead of the interpolated count |
| 2. Tokens / Color | 4/4 | Zero hex in all 7 components; PartidoChip is provably NEUTRO (`bg-muted border-border text-foreground`, identical per party); `text/border/bg/outline-accent-product` all resolve (registered in tailwind.config.ts:46) — the 89 fix holds |
| 3. Typography | 4/4 | Dates/periods/ranges all `font-mono` (militancias, header periodo, chip tooltip); headings text-xl/semibold, subheads text-base/semibold, body text-sm — matches the SPEC role table exactly |
| 4. Layout / Responsive 390px | 3/4 | Chip rows and facet chips use `flex flex-wrap gap-2`; every cross-link `<section>` carries the LOCKED `mt-12`. Unverified visually (no dev server) — cannot confirm 390px wrap or that the sticky rail collapses cleanly |
| 5. Accessibility | 4/4 | `min-h-11` on facet chips + trigger + "ver todos"; `aria-pressed`/`aria-disabled` on chips; `fieldset/legend`; `focus-visible:outline-accent-product`; WR-04 tooltip-in-link resolved (`tooltip={false}` in directory row) |
| 6. Honestidad UI | 3/4 | Empty-states omit honestly (chip→null, bloque→null); truncation never silent ("Mostrando los primeros N de N"); anti-causal leyenda registered in the guard. Docked for the literal-"N" counts label misrepresenting the honest-count contract |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Counts leyenda ships a literal "N" (`parlamentarios-filtro.tsx:33-34`)** — The SPEC copy (§Copy L132) is `Conteos sobre estos {N} parlamentarios cargados…` where `{N}` = the loaded slice size. The island renders the string verbatim including the literal letter "N", so a user filtering 186 parlamentarios reads "estos N parlamentarios cargados". This directly undercuts the honest-count contract this pillar exists to protect. **Fix:** interpolate `slice.length` — `` `Conteos sobre estos ${slice.length} parlamentarios cargados, no sobre todo el Congreso.` `` (WARNING).

2. **Senado "comité≠militancia" leyenda never rendered (spec omission)** — §Component 3 (L210-211) and §Copywriting (L119) declare a LOCKED leyenda: `El comité parlamentario es una agrupación de trabajo legislativo, distinta de la militancia partidaria.` to fire once when a Senado row carries a comité. Grep across `app/` finds zero occurrences of the string. `MilitanciasDeParlamentario` has no comité branch at all. Either the RPC deliberately drops comité (making this dead contract) or the disclosure is missing. **Fix:** confirm with the 0060 RPC shape; if comité is emitted, render the leyenda once in the militancias section; if not, strike L119/L210-211 from the SPEC so the contract stops claiming an unbuilt surface (WARNING).

3. **390px wrap + sticky-rail collapse are unverified (no dev server)** — The SPEC §Mobile 390px mandates iframe same-origin verification (the v8.0/v8.1/89 gate pattern). Markup uses `flex flex-wrap gap-2` and the page grid is `md:grid-cols-[13rem_1fr]` (rail collapses < md), which is structurally correct, but nothing was observed. A long partido name in the header chip row, or 8 facet chips at 390px, could still crowd. **Fix:** run the dev server and capture 390px via the same-origin iframe gate before ship; treat as `needs_human_review` until then (WARNING).

---

## Detailed Findings

### Pillar 1: Spec Compliance / Copywriting (3/4)

Verbatim matches confirmed against §Copywriting:
- Cross-link anti-causal leyenda: exact, and exported as `LEYENDA_CROSS_LINK` (`cross-links-parlamentario.tsx:48`) so the anti-insinuación guard subtracts it from offenders (`anti-insinuacion-guard.test.ts:295`) — the "afinidad" negation is handled correctly.
- Militancias heading/leyenda (`militancias-de-parlamentario.tsx:42-46`), "Vigente" sobria label (L54), "Sólo se registra la militancia vigente…" empty (L84-87) — all verbatim.
- Comisiones empty "Sin comisiones registradas para este parlamentario en la fuente." (`comisiones-de-parlamentario.tsx:48-50`) — verbatim, correctly NOT "no participa".
- Filter empty heading/body (`parlamentarios-filtro.tsx:35-36`) — verbatim.
- Cross-link headings ("Del mismo partido", "De la misma zona", "En la misma comisión", "Han co-firmado proyectos") — all present in `page.tsx:326/342/359/375`.

**BLOCKER-adjacent / WARNING findings:**
- **Literal "N" in `LEYENDA_COUNTS`** (`parlamentarios-filtro.tsx:33`) — see Priority Fix #1. This is the most consequential copy defect: it turns an honesty-affordance into visible boilerplate.
- **Missing Senado comité leyenda** — see Priority Fix #2.
- Undocumented copy addition: `militancias-de-parlamentario.tsx:59-61` renders "No hay militancia vigente registrada en la fuente." for the no-vigente path. Not in the SPEC copy table but a defensible honest-by-absence addition consistent with the SPEC's rectora rule; noted, not docked.
- Cross-link count strings correctly pluralize (1 vs N) and never rank — `conteoTexto` is derived from `total_n` (real axis total), not `filas.length`.

### Pillar 2: Tokens / Color (4/4)

- **Zero hex / rgb / raw hsl()** in all 7 phase-91 components (grep clean).
- **PartidoChip neutrality is provable:** both branches (tooltip and plano) hard-code `bg-muted border-border text-foreground` with no party-derived class (`partido-chip.tsx:84,100`). Color never encodes political identity — the anti-insinuación cornerstone holds. Omits to `null` when partido empty (L56), mirroring CamaraChip.
- **Accent-product utilities resolve:** `accent-product` is registered as a Tailwind color (`tailwind.config.ts:46` → `hsl(var(--accent-product))`), so `text-accent-product` (links), `border-accent-product`/`bg-accent-product-soft` (engaged facet chip), and `outline-accent-product` (focus) all compile to valid CSS. This confirms the UI-REVIEW #89 fix (registered utilities vs the broken v3 arbitrary-var idiom) is intact. `accent-product-soft` is separately registered via `@theme inline` (`globals.css:87`).
- Accent stays inside the SPEC's closed list: petróleo appears only on cross-link/`ver todos` links, engaged facet chip, and focus outlines. CamaraChip retains cívico institutional color; PartidoChip does not — the cívico/partido split is respected.

### Pillar 3: Typography (4/4)

- Every date/period/range is `font-mono`: militancia ranges (`militancias-de-parlamentario.tsx:52,74`), header periodo (`parlamentario-header.tsx:102`), chip tooltip fecha (`partido-chip.tsx:111`), rail periodo (`page.tsx:413`).
- Heading roles match the SPEC table: `text-xl font-semibold` (h2 carriles/militancias/cross-links), `text-base font-semibold` (partido name in militancia, name in cross-link row), `text-sm` body/leyendas, `text-3xl font-semibold leading-tight` (h1).
- No new sizes/weights introduced. Comisiones uses an `h3 text-sm font-semibold` label — consistent with the Subhead role intent.

### Pillar 4: Layout / Responsive 390px (3/4)

- `mt-12` frontier present and unmoved on every sibling `<section>` (militancias L41, each cross-link L100, all carriles in `page.tsx`). The anti-insinuación boundary is intact.
- Chip rows (`parlamentario-header.tsx:83`, `parlamentario-directory-row.tsx:43`, `cross-links-parlamentario.tsx:109`) and facet chips (`parlamentarios-filtro.tsx:149`) all use `flex flex-wrap gap-2`.
- Page grid `md:grid-cols-[13rem_1fr]` → rail collapses below md; lists are vertical `space-y-3` (no horizontal tables).
- **Docked:** no visual verification (no dev server). The SPEC explicitly requires the same-origin iframe gate at 390px; that gate did not run. `needs_human_review`.

### Pillar 5: Accessibility (4/4)

- Touch targets: `min-h-11` on facet chips (`parlamentarios-filtro.tsx:67`), accordion trigger (`detalle-colapsable.tsx:57`), and "Ver los N" anchor (`cross-links-parlamentario.tsx:131`).
- Facet chips: `aria-pressed`, `aria-disabled`, `disabled` gated when count=0 with `opacity-40`, grouped in `fieldset/legend` (`parlamentarios-filtro.tsx:60-64,147-148`).
- Focus never removed without replacement: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-product` on interactive chips/links; directory row uses `focus-visible:ring-2 focus-visible:ring-ring`.
- **WR-04 resolved:** `PartidoChip tooltip={false}` in the directory row (`parlamentario-directory-row.tsx:50`) renders a plain Badge (procedencia in `title`/`aria-label`) — no interactive TooltipTrigger nested inside the anchor. The tooltip variant is only used where the chip is a leaf (header). This is the specific WR-04 defect, correctly fixed.
- PartidoChip `aria-label` carries partido+fuente+fecha (`partido-chip.tsx:72`).
- Cross-link links carry the destination name, not "click aquí"; anti-causal leyenda is a visible `<p>`, not decorative.

### Pillar 6: Honestidad UI (3/4)

- Empty = fact, not virtue: PartidoChip→null, cross-link `<section>`→null (`cross-links-parlamentario.tsx:91`), militancias-total-empty→null (`page.tsx:756`), profesión omitted. No fabricated zeros.
- Counts "N de M": truncation is never silent — `Mostrando los primeros {visibles.length} de {totalN}.` (`cross-links-parlamentario.tsx:139`) using the real axis total from `total_n`, not the capped `filas.length`. This is the WR-01/WR-02 fix and it is correct.
- Anti-causal leyenda: 1× per block, verbatim, guard-registered.
- **Docked:** the counts leyenda literal "N" (Priority #1) is precisely a honest-count contract violation — the surface *claims* to disclose the population size and instead prints a placeholder letter. Small string, but it lands squarely on this pillar's core promise.

---

## Registry Safety

Registry audit: SPEC §Registry Safety declares no third-party registries (only preexisting shadcn `ui/badge`, `ui/tooltip`, `ui/skeleton`, Radix Accordion). Vetting gate not applicable — 0 third-party blocks to check. No flags.

---

## Files Audited

- `.planning/phases/91-.../91-UI-SPEC.md` (contract)
- `app/components/partido-chip.tsx`
- `app/components/comisiones-de-parlamentario.tsx`
- `app/components/militancias-de-parlamentario.tsx`
- `app/components/cross-links-parlamentario.tsx`
- `app/components/parlamentario-header.tsx`
- `app/components/parlamentario-directory-row.tsx`
- `app/components/parlamentarios-filtro.tsx` (the `"use client"` filter island)
- `app/app/parlamentario/[id]/page.tsx`
- `app/app/parlamentarios/page.tsx`
- Cross-checks: `app/components/camara-chip.tsx`, `app/components/detalle-colapsable.tsx`, `app/app/globals.css`, `app/tailwind.config.ts`, `app/lib/anti-insinuacion-guard.test.ts`, `app/app/styles/civic-tokens.css`
