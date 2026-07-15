# Phase 79 — UI Review

**Audited:** 2026-07-15
**Baseline:** 79-UI-SPEC.md (surgical class-swap contract; D3 firewall)
**Screenshots:** Not re-captured by auditor — archived BrowserOS antes/después evidence exists (`captures/README.md`). Dev server was live on :3000; pixel gate is deferred to Phase 81 (deploy-real `getComputedStyle`). This is a **code-level** audit of swap consistency vs. the spec enumeration.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Zero copy change confirmed; all honest-empty/error strings byte-identical to contract. |
| 2. Visuals | 4/4 | Radius swap applied at first-level call sites only; interiors/skeletons byte-identical as enumerated. |
| 3. Color | 4/4 | Zero new hex across edited files; only new class is the `rounded-[var(--radius-tile)]` token. |
| 4. Typography | 4/4 | No type touched; `<h1>`/`<h2>` scale and weights unchanged. |
| 5. Spacing | 4/4 | Padding rhythm verbatim; only container ceiling widened to `max-w-[1120px]` per contract. |
| 6. Experience Design | 4/4 | `scroll-mt-6` removed from both fichas (Option 1); error≠empty honest-states preserved; `/red` guard intact. |

**Overall: 24/24**

---

## Top 3 Priority Fixes

This is a mechanical swap phase executed to contract; no BLOCKERs and no WARNINGs found at code level. The following are **advisory watch-items** for the Phase 81 pixel gate, not defects:

1. **Anchor-offset must be verified live (advisory)** — `scroll-mt-6` was *removed* (not raised to `scroll-mt-24`), so ficha anchors now inherit the global `scroll-margin-top: 5rem` (globals.css:106). jsdom can't see layout — Phase 81 must confirm the anchor lands clear of the 80px sticky header and that FichaRail scrollspy still highlights.
2. **`/red` width non-regression is guard-tested but not pixel-verified here** — `red/page.test.tsx:225` pins `max-w-3xl`; the deploy-real `getComputedStyle` capture (Phase 81) remains the authoritative non-regression check for the `.net-chip` 11px island.
3. **Ficha exterior panels had nothing to swap** — the per-carril wrappers are bare `<section mt-12>` (no `rounded-*`), matching the spec's contingency. Confirm in the Phase 81 capture that no first-level ficha panel is visually still `rounded-lg` (all remaining `rounded-lg` in ficha sources are aria-hidden skeletons — verified below).

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
Contract: "Zero copy change this phase." Verified. `/buscar` retains "Sin resultados" (buscar/page.tsx:106), the error banner copy at L93/L139, and the empty-state cross-link to `/agenda`. `/parlamentarios` retains "Sin parlamentarios para este filtro." (parlamentarios/page.tsx:129-132). `/agenda` retains "Sin resultados" (agenda/page.tsx:200) and "No hay citaciones… registradas para esta semana." (L299). No generic labels ("Submit"/"OK") introduced; CTAs ("Filtrar", "Buscar", "← Anterior"/"Siguiente →") unchanged. Anti-insinuación scope untouched (no votos/dinero copy). **PASS.**

### Pillar 2: Visuals (4/4)
Radius swap applied exactly at the enumerated first-level call sites:
- `SearchResultCard` root: `<Card className="rounded-[var(--radius-tile)]">` (search-result-card.tsx:39) — overrides the primitive's `rounded-lg` via `cn()` last-writer, **without editing `card.tsx`** (D3 firewall verified: card.tsx:12 still emits `rounded-lg`).
- `ParlamentarioDirectoryRow` root `<Link>`: `rounded-[var(--radius-tile)]` (parlamentario-directory-row.tsx:34).
- `/agenda` search-result `<li>`: `rounded-[var(--radius-tile)]` (agenda/page.tsx:238).
- Empty/error boxes swapped: buscar L93/L105/L139, parlamentarios L128, agenda L191/L199.

Interiors correctly left byte-identical: skeleton `Card` in buscar carries `rounded-[var(--radius-tile)]` (L211) intentionally to shape-match the result card, while filter controls (`rounded-lg` at parlamentarios L76/L84/L93), agenda form (`rounded-md` L87/L92), pills (`rounded-full`), and all ficha skeletons remain untouched. Icon-only elements: arrow glyphs are `aria-hidden` with adjacent text labels. **PASS.**

### Pillar 3: Color (4/4)
Zero-hex sanity: grep for `#[0-9a-fA-F]{3,8}` in buscar/page.tsx → **0 matches**. The only new class token across all edited files is `rounded-[var(--radius-tile)]` (13 occurrences across the 3 data routes + tests). No palette redefinition, no new accent usage; `--destructive` banners (`border-destructive/20 bg-destructive/5`) unchanged. **PASS.**

### Pillar 4: Typography (4/4)
No type classes touched. Page `<h1>` stays `text-3xl font-semibold leading-tight` (parlamentarios:44, agenda:77); section `<h2>` stays `text-xl font-semibold`. Geist/Geist Mono unchanged. Mono metadata (`font-mono` boletín labels) intact. **PASS.**

### Pillar 5: Spacing (4/4)
Every edited `<main>` preserves `mx-auto px-4 md:px-8 py-8 md:py-16` verbatim; only `max-w-3xl`/`max-w-5xl` → `max-w-[1120px]`. Cross-checked all routes:
- Widened to 1120px: `/` (home:87), `/buscar` (60), `/agenda` (76), `/sobre` (20), `/metodologia` (21), `/parlamentarios` (43), `/contraparte/[id]` (64), `/proyecto/[boletin]` (65), `/parlamentario/[id]` (141).
- **Correctly NOT widened:** `/red` (page.tsx:82 & 163 stay `max-w-3xl`), `/admin/revisar-entidades` (161 stays `max-w-3xl`).
No arbitrary spacing (`p-[…px]`) introduced; the two arbitrary values present are the sanctioned `max-w-[1120px]` ceiling and the `rounded-[var(--radius-tile)]` token. **PASS.**

### Pillar 6: Experience Design (4/4)
- **Anchor fix (mandatory):** ficha sources carry **zero** `scroll-mt-6` (parlamentario/page.tsx & proyecto/page.tsx → 0 matches); Option 1 (remove local, inherit global 80px) applied. Tests pin the removal (page-estructura.test.ts:101-102, page.test.tsx:401, page-cruces.test.ts:26-27).
- **Honest states preserved:** error≠empty discipline intact on all routes (buscar L92/L136 throw-vs-empty; parlamentarios L113 throws on DB error; agenda L291/L483/L504 throw). Loading skeletons present and shape-matched on every route.
- **`/red` exclusion guarded:** red/page.test.tsx:224-226 asserts `max-w-3xl`; `.net-chip` 11px island untouched.
- **Registry audit:** shadcn initialized (`components.json` present) but UI-SPEC declares **no third-party registries** and no `shadcn add`/`view` this phase → registry safety not applicable. 0 third-party blocks checked, no flags.

Post-review fixes noted in prompt (guard `/red` count-based, skeleton radius, boundaries 1120px) are consistent with the observed code. **PASS.**

---

## Files Audited
- `app/app/buscar/page.tsx`
- `app/app/parlamentarios/page.tsx`
- `app/app/agenda/page.tsx`
- `app/components/search-result-card.tsx`
- `app/components/parlamentario-directory-row.tsx`
- `app/app/proyecto/[boletin]/page.tsx` (spot: exterior radius + scroll-mt)
- `app/app/parlamentario/[id]/page.tsx` (spot: exterior radius + scroll-mt)
- `app/components/ui/card.tsx` (D3 firewall: confirmed unedited, L12 `rounded-lg`)
- `app/app/red/page.tsx` + `red/page.test.tsx` (exclusion non-regression)
- `app/app/{sobre,metodologia,contraparte/[id],admin/revisar-entidades}/page.tsx` (container map cross-check)
- `.planning/phases/79-*/captures/README.md` (archived antes/después evidence)

---

## Verdict

Contract satisfied. Every swap in the load-bearing per-route enumeration is present and consistent; every "byte-identical" interior/skeleton/exclusion is untouched. Zero new hex, zero re-layout, zero copy/type change. The single residual is deferred by design: the anchor-offset and `/red` width are jsdom-invisible and must be confirmed at the **Phase 81 deploy-real pixel gate**. No code-level BLOCKER or WARNING.
