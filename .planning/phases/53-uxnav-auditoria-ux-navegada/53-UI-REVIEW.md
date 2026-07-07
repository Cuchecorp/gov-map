# Phase 53 — UI Review

**Audited:** 2026-07-07
**Baseline:** `53-UI-SPEC.md` (approved design contract; extends F52 → F51/F44, DESIGN-SYSTEM CLOSED)
**Screenshots:** not re-captured (no dev server on 3000/5173/8080) — audited against the phase's own archived PROD evidence (`ux-evidence/fix-F0*-after-*.jpg`, deployed version `7b35b99e`) + code review of every touched file. The evidence set is first-party screenshots of the live deployment, so this is effectively a visual audit, not code-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | All contract copy verbatim + banned-vocab clean, but the rendered continuation link collapses the space before `→` on all 6 surfaces ("semana→." vs contracted "semana →.") |
| 2. Visuals | 2/4 | Mobile nav contract breached: at 390px the nav wraps to 2 rows of items ("Sobre" alone on row 3 overall) — SPEC mandates ≤1 wrapped nav row / ≤2 rows total; visible in every 390 after-shot |
| 3. Color | 3/4 | Phase additions use petróleo exactly on the 4 reserved elements; two pre-existing off-contract drifts observed in evidence (blue default-primary submit on `/buscar`, `bg-[--identity-warn-bg]` arbitrary-var syntax) → route to F54 |
| 4. Typography | 4/4 | New chrome uses only `text-sm`/`text-base`, weights 400/600; nav's shipped `font-medium` kept verbatim and NOT propagated; boletín segment in mono as contracted |
| 5. Spacing | 4/4 | Every value on the 8-pt scale (`gap-x-1`, `mt-2`, `mb-4`, `min-h-11`); zero arbitrary values; `mt-12` carril frontiers untouched (grep-verified) |
| 6. Experience Design | 4/4 | 7/7 orientation criteria met live; no new link 404s; honest states byte-identical (test-pinned); 44px touch targets throughout; gate-aware `showRed` hardening (WR-01) — note: committed but not yet deployed |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Nav wraps to 2 rows of items at 390px (WARNING — breaks the SPEC's flagship mobile contract).** All three 390 after-shots (`fix-F01-after-390.jpg`, `fix-F02-after-proyecto-390.jpg`, `fix-F02-after-parlamentario-390.jpg`) show `Buscar Parlamentarios Agenda Red` on one row and `Sobre` alone on a second nav row — 3 header rows total. SPEC §Interaction Contracts: "nav itself must not exceed 1 wrapped row of items"; the "Sobre" shortening existed precisely for this and it was not enough (≈391px needed vs ≈358px available: 5 labels at `text-sm` + `px-3`×5 + gaps). The re-walkthrough marked F-01 "resuelto — cabe en 1 fila", which the evidence contradicts. **Fix:** in `app/components/header-nav.tsx:77` change item padding to `px-2 sm:px-3` (saves ~40px) or `gap-x-1` → `gap-x-0.5` below `sm`; re-verify at 390.
2. **Continuation-link arrow loses its leading space on all 6 surfaces (WARNING — rendered copy deviates from contract).** The link is `inline-flex`; flexbox drops whitespace-only text nodes, so `{" "}` before `<span aria-hidden="true">→</span>` never renders — evidence: `fix-F03-after-390.jpg` shows "la agenda legislativa de la semana→." glued. Contract copy is "…de la semana →". **Fix:** replace `{" "}<span aria-hidden="true">→</span>` with `<span aria-hidden="true" className="pl-1">→</span>` (padding, not whitespace) in `app/app/buscar/page.tsx:94-95`, `app/app/agenda/page.tsx:307-308`, `app/components/lobby-de-parlamentario.tsx:314-315` and `:338-339`, `app/components/votos-por-parlamentario.tsx:474-475`, `app/components/red/red-graph.tsx:179-180`.
3. **PROD/HEAD skew: gate-aware Red item (WR-01, `c014f86..78710a8`) is committed but NOT deployed.** Live `7b35b99e` renders the Red nav item unconditionally; if `NET_PUBLIC_ENABLED` were ever flipped OFF, the header would advertise a guaranteed-404 route — exactly the dead-end class this phase eliminates. Harmless today (flag is ON), latent regression tomorrow. **Fix:** fold into the next deploy (F54 per 53-VERIFICATION.md) and smoke-test both gate states.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Conforms:**
- Nav labels exactly per SPEC §(a): `Buscar / Parlamentarios / Agenda / Red / Sobre` (`header-nav.tsx:36-42`). "Red" is the factual route name; "Red de influencia"/"Conexiones" appear only inside negative-match comments (`header-nav.tsx:31`).
- Breadcrumb labels exactly per SPEC §(b): `Inicio / Proyectos / Boletín {n}` (`proyecto/[boletin]/page.tsx:59-65`), `Inicio / Parlamentarios / {nombre}` (`parlamentario-header.tsx:57-63`), `Inicio / {nombre}` for contraparte with crumb 2 omitted as contracted (`contraparte/[id]/page.tsx:142`).
- Continuation copy matches the SPEC §(c) table verbatim on 5 of 6 surfaces (votos, lobby ×2, agenda, red). Shipped honest strings pinned byte-identical by RTL asserts (suite 563 green pre-deploy; e.g. `buscar/page.tsx:83-87` untouched above the new line).
- Banned vocabulary: zero hits for `limpio|transparente|nada que ocultar` in rendered strings across the 11 touched files (only comments documenting the guard). No causal/affinity framing.

**Findings:**
- **WARNING — rendered copy deviates from contract on all 6 continuation lines.** The space before the `→` glyph is a whitespace-only text node inside an `inline-flex` link, which flex layout discards. Evidence: `fix-F03-after-390.jpg` renders "la agenda legislativa de la semana→." Contract table shows "…de la semana →". Trivial fix (see Priority Fix 2), but it ships on every empty-state surface.
- **INFO (accepted variance):** `/buscar` continuation uses "También puedes revisar la agenda legislativa de la semana →." instead of the SPEC table's "Prueba con otras palabras, o revisa…", because the shipped honest string already ends "Prueba con otras palabras, o ingresa un número de boletín." Documented as Claude's Discretion (RESEARCH OQ1) in 53-04-SUMMARY — an improvement over the contract's duplication, not a defect.

### Pillar 2: Visuals (2/4)

**Findings:**
- **WARNING — mobile nav fit contract breached (the pillar's score driver).** SPEC §Interaction Contracts (Mobile, 390×844 first-class): "5 nav items + wordmark must fit ≤2 rows total … nav itself must not exceed 1 wrapped row of items. The 'Sobre' label shortening exists for this." Every 390 after-shot shows the nav at 2 rows (`Sobre` orphaned) → 3 header rows total. Arithmetic confirms it is not a harness artifact: 390 − 32 (`px-4`) = 358px available; 5 labels at 14px + `px-3`×5 (120px) + 4 gaps ≈ 391px. The Wave-3 re-walkthrough claim "cabe en 1 fila de ítems" (53-UX-AUDIT F-01 verification) is contradicted by its own evidence.
- **WARNING (evidence quality) — desktop after-evidence cannot verify F-01 at 1280.** `fix-F01-after-1280.jpg` is right-cropped by the harness (parent viewport 772px); the nav is cut off before "Red" is visible. The deploy's curl HTML check (`href="/red">Red`) covers the DOM but not the desktop layout. Recommend one uncropped 1280 capture next deploy.
- **PASS:** Visual hierarchy of the new chrome is correct: breadcrumb is a `<nav>` in `text-sm text-muted-foreground` above the `h1`, never competing with it (`breadcrumbs.tsx:32-33`); current segment differentiated with `text-foreground` (+`font-mono` for boletín); active nav item clearly marked with petróleo underline (visible on "Buscar" in `fix-F03-after-390.jpg`). No icon-only buttons added; both glyphs (`/`, `→`) are `aria-hidden` decoration inside labeled elements.
- **PASS:** No heading added/re-leveled; no carril moved (diff-scan in 53-05 confirms `mt-12` matches are comments only).

### Pillar 3: Color (3/4)

**Phase additions — fully conformant (verified by class audit):**
- Accent (petróleo) appears on exactly the 4 reserved elements: active nav underline (`header-nav.tsx:82`), breadcrumb hover (`breadcrumbs.tsx:40`), continuation links (`text-accent-product underline underline-offset-2`, 6 occurrences), and the shared focus ring (`focus-visible:ring-ring`). Accent is NOT used on separators, current segments, the `→` arrow outside links, headings, or counts — as contracted.
- Zero hardcoded hex/rgb values in the 11 touched files. Token rule respected — all new classes are `text-accent-product`-style utilities.

**Findings (pre-existing drift, visible in this phase's own evidence — SPEC routes these to F54, never a P0 here):**
- **WARNING → F54:** `/buscar` submit button renders default shadcn primary (vivid blue in `fix-F03-after-390.jpg`) while the home hero variant uses `bg-accent-product` petróleo (`search-box.tsx:119-125`, non-hero branch is bare `h-12`). Two search surfaces, two CTA colors — 60/30/10 drift on a demo-critical journey (J2).
- **INFO → F54:** `lobby-de-parlamentario.tsx:262` uses `bg-[--identity-warn-bg] text-[--identity-warn-fg]` — the arbitrary-var syntax the design system's token rule forbids ("NEVER `text-[--accent-product]`"). Shipped pre-F53, untouched this phase.

### Pillar 4: Typography (4/4)

- New chrome size distribution: `text-sm` (breadcrumbs, nav labels, continuation lines) + `text-base` (wordmark) — both in the contract table. No new size introduced.
- Weights: 400 default + `font-semibold` (wordmark, pre-existing). The shipped `font-medium` on nav labels is kept verbatim per the SPEC's explicit carve-out and was NOT propagated — grep confirms zero `font-medium` in `breadcrumbs.tsx` or any continuation line.
- Mono correctly scoped: only the boletín current-segment (`breadcrumbs.tsx:47`, via `mono: true` at `proyecto/[boletin]/page.tsx:63`); names stay in Geist Sans as-shipped (Title Case formatter correctly deferred to F54).
- Breadcrumb is `<nav>`+`<ol>`, never a heading; heading hierarchy untouched. No finding.

### Pillar 5: Spacing (4/4)

- All new values on the inherited scale: `gap-x-1` (4px, breadcrumb separators — exactly the contracted token), `mt-2` (8px, continuation line gap), `mb-4` (16px, breadcrumb → h1), `px-3`/`px-4 md:px-8` (inherited header padding), `min-h-11`/`min-h-14` (44px touch-target exception, applied to nav items, breadcrumb links, and all 6 continuation links).
- Zero arbitrary `[Npx]`/`[Nrem]` values in touched files (grep-verified).
- **Carril frontier intact:** no `mt-12` moved/nested (53-05 diff-scan + spot-check; only comments reference it). Anti-insinuación Invariant 1 holds.
- Minor note (not scored down): `inline-flex min-h-11` on an in-paragraph link creates a 44px-tall inline box that slightly inflates the line box of the continuation paragraph — visible as generous leading in `fix-F03-after-390.jpg`, acceptable and contract-driven (44px minimum wins).

### Pillar 6: Experience Design (4/4)

- **Orientation criteria (the phase's purpose) verified live post-deploy:** ≤2 clicks 7/7 surfaces, every ficha announces location via breadcrumb, no dead-end empty state — with before/after evidence per P0 (53-UX-AUDIT Re-walkthrough, deployed `7b35b99e`).
- **State coverage:** loading skeletons present (`FichaHeaderSkeleton`, `ParlamentarioHeaderSkeleton`, Suspense streaming on `/buscar`); honest error states inherited and untouched (`buscar/page.tsx:70-73`); the three honest empty states stay semantically distinct with the continuation line only adding a route (semantic guard held, test-asserted).
- **No new 404 affordance:** every link added targets a curl-verified 200 route; contraparte breadcrumb renders only behind the MONEY gate `notFound()` (no existence leak); the prohibited lobby×tramitación link was correctly NOT added (`lobby-en-tramitacion.tsx` untouched).
- **Gate-mirroring hardening (WR-01):** `GlobalHeader` computes `showRed` server-side via the `netPublicEnabled` chokepoint and `HeaderNav` filters the item from the DOM when OFF (`header-nav.tsx:59-63`) — a justified, review-mandated deviation from the SPEC's "island receives no props" (boolean is non-sensitive, tests cover both states).
- **INFO:** that hardening is committed but not deployed (PROD `7b35b99e` predates `c014f86..78710a8`) — see Priority Fix 3.
- No destructive actions exist (read-only product); no confirmation surfaces needed. Zero new client JS beyond the `NAV_ITEMS` edit + the gate boolean, as contracted.

---

## Registry Safety

shadcn initialized (`app/components.json`, Slate). Registry audit: **0 third-party blocks declared** in 53-UI-SPEC (Registry Safety table: "none") and zero new blocks installed this phase — vetting gate not triggered, no flags.

---

## Files Audited

**Code (phase-touched):**
- `app/components/header-nav.tsx` (+ `header-nav.test.tsx` referenced)
- `app/components/global-header.tsx`
- `app/components/breadcrumbs.tsx`
- `app/components/parlamentario-header.tsx`
- `app/app/proyecto/[boletin]/page.tsx`
- `app/app/parlamentario/[id]/page.tsx`
- `app/app/contraparte/[id]/page.tsx`
- `app/app/buscar/page.tsx`
- `app/app/agenda/page.tsx`
- `app/components/votos-por-parlamentario.tsx`
- `app/components/lobby-de-parlamentario.tsx`
- `app/components/red/red-graph.tsx`
- `app/components/search-box.tsx` (color-drift context)

**Visual evidence (deployed `7b35b99e`):**
- `ux-evidence/fix-F01-after-390.jpg`, `fix-F01-after-1280.jpg`
- `ux-evidence/fix-F02-after-proyecto-390.jpg`, `fix-F02-after-parlamentario-390.jpg`
- `ux-evidence/fix-F03-after-390.jpg`

**Contract/context:** `53-UI-SPEC.md`, `53-CONTEXT.md`, `53-UX-AUDIT.md`, `53-REVIEW.md` (WR-01 provenance), `53-VERIFICATION.md`, `53-01..05-SUMMARY.md`.
