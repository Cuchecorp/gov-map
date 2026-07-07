# Phase 52 — UI Review

**Audited:** 2026-07-06
**Baseline:** 52-UI-SPEC.md (approved design contract, extends F51/F44 + DESIGN-SYSTEM)
**Screenshots:** not captured (no local dev server) — audit combines code review with **live rendered HTML** from the deployed site (`observatorio-congreso.thevalis.workers.dev`, versión 0742841e): home `/` and `/proyecto/16743-04` (the smoke boletín with 5 lobby coincidences).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every LOCKED string verbatim on the live surfaces; plural handling added; empties honest and distinct |
| 2. Visuals | 2/4 | Live lobby rows display raw lowercase `nombre_normalizado` ("gonzalez sofia") as citizen-facing names; Block 2 título not an h3 |
| 3. Color | 3/4 | Accent (petróleo) correctly reserved to links; new `app/app/error.tsx` uses `text-primary` (Slate default blue, off the 60/30/10 palette) |
| 4. Typography | 2/4 | Home block h2 = `text-lg` (contract: `text-xl`) ×3; `text-xs` boletín meta (contract Mono meta: `text-sm`); Block 2 item body at `text-sm` |
| 5. Spacing | 2/4 | All 3 home item links lack the contract-mandated `min-h-11` 44px touch target; `py-3`/`gap-x-3` (12px) off the declared token set |
| 6. Experience Design | 2/4 | **BLOCKER:** all 5 live lobby rows ship WITHOUT "Ver fuente oficial ↗" (enlace null) — violates invariant 7 "a datum without a source link does not ship". Degrade honesto itself is exemplary |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **[BLOCKER] Lobby rows ship without any source link** — On live `/proyecto/16743-04`, all 5 rows render name + materia + Mono date with **zero** "Ver fuente oficial ↗" (`enlace_detalle` is null for Cámara-sourced audiencias, as `lobby-en-tramitacion.tsx:75-77` itself documents). UI-SPEC §SC2 requires the link "Present on every row; traceability per datum" and Anti-insinuación invariant 7 says a datum without a source does not ship. This breaks the product's core value ("según qué fuente") exactly on the phase's most sensitive surface. **Fix:** carry a real per-audiencia source URL through the RPC (Cámara lobby registry detail URL derivable from `audiencia_id`/identificador — the 0048 amendment already added that column), or as interim render a per-row fallback link to the official Ley de Lobby registry search for that audiencia; do NOT ship the bare row.
2. **[WARNING→near-blocker] Raw `nombre_normalizado` rendered as display name** — Live rows show "cristian mella", "gonzalez sofia", "consuelo veloso", "diaz jorge": lowercase, inconsistent name order (the normalization/matching KEY, not a display name). Every other citizen surface shows proper-case names. **Fix:** amend 0048 (next operator checkpoint, `create or replace`, same signature idiom) to emit the parlamentario display-name column instead of `nombre_normalizado`; do not title-case in the UI (fabricates identity casing).
3. **[WARNING] Home item links miss the 44px touch target** — `actualidad-module.tsx:131,138,237` use `mt-1 inline-flex items-center text-sm underline` with **no `min-h-11`**, while UI-SPEC §Spacing explicitly mandates 44px "on every interactive control added this phase — the per-row 'Ver fuente oficial ↗' links on the lobby carril **and home items**". The lobby carril link (line 151) has it; the 3 home links do not. **Fix:** add `min-h-11` to the three link classNames.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Verified against §Copywriting Contract, string by string (code + live HTML):

- **SC2 verbatim PASS:** heading (`lobby-en-tramitacion.tsx:180`), caveat once-per-section on `--muted` band (:169-173, live-confirmed once), summary "se registraron {N} reuniones de lobby" with Mono `{N}` (live: `<span class="font-mono">5</span>`), per-week variant, row meta "Reunión registrada el {fecha} · semana {semanaISO}", empty state verbatim (:192-194). `plural()` handling (reunión/reuniones) is a quality improvement within the allowed variance.
- **SC3 verbatim PASS:** "Citado en {comisión} el {fecha}." (`estado-actual-block.tsx:211-219`), omit-when-not-derivable honored (live 16743-04 correctly omits — its citación is past).
- **SC4 verbatim PASS:** all 3 headings, all 3 empty states (live home shows "Sin votaciones registradas esta semana en las fuentes consultadas." — honest empty, real data in blocks 2-3), Block 1 desenlace + "Votación del {fecha}", Block 2 item, Block 3 "{fuente}: actualizada el {fecha}." with legible fuente labels.
- **Banned vocabulary:** negative-match clean across all new copy (no causal/ranking/score terms; RTL tests enforce it).
- Minor (accepted): Block 1 fallback "Ver proyecto →" when `enlace` is null deviates from the prescribed "Ver fuente oficial ↗" but preserves trace (declared decision in 52-04-SUMMARY); Block 2's "Ver proyecto →" matches the spec's "link to the ficha". `app/app/error.tsx` copy differs from the §7 template but keeps register and adds the honest error-vs-absence distinction.

### Pillar 2: Visuals (2/4)

- **WARNING — display names are the normalization key (live evidence):** `/proyecto/16743-04` lobby rows render `parlamentario_nombre` = `nombre_normalizado` verbatim: lowercase and order-inconsistent ("gonzalez sofia" vs "consuelo veloso"). On a juxtaposition surface where identity is load-bearing (invariant 5: confirmed parlamentarios only), showing the matching key as prose undermines credibility. The RPC contract chose `nombre_normalizado` (52-02); the UI ships it raw. See Priority Fix 2.
- **WARNING — Block 2 project títulos are not h3:** UI-SPEC §Typography: "per-item project titles are h3" on the home. Block 1 complies (`actualidad-module.tsx:108`); Block 2 renders the título inside `<p className="text-sm leading-snug">` (:225-231) — no h3, no 600 weight, so long títulos (live: the sala-cuna urgencia) read as an undifferentiated wall at 14px. Heading hierarchy h1→h2→h3 is declared "sacred".
- PASS: lobby carril hierarchy correct (h2 inside the View so degrade path-1 leaves no orphan heading — verified live: pre-stream section is bare, streamed content carries h2); home focal point remains the hero (module sits below, `max-w-5xl` grid); skeletons `aria-hidden`; icon-free affordances per contract.

### Pillar 3: Color (3/4)

- PASS: accent `text-accent-product` used ONLY on the reserved-for elements — lobby row source link (:151), home item links (3×). Counts/tallies/semana are `font-mono` with no accent; caveat is neutral `bg-muted text-muted-foreground` (NOT amber) per contract; headings uncolored; no civic color used as chrome; no hardcoded hex/rgb in any new file.
- **WARNING — `app/app/error.tsx:38` uses `text-primary`:** `--primary` is the untouched Slate default `hsl(221.2 83.2% 53.3%)` (blue), not petróleo (`globals.css:16` vs `:24`). The new error boundary's "Reintentar" renders off-palette blue. It mirrors the legacy error.tsx idiom, but every component authored since F51 (and all of this phase's surfaces) uses `text-accent-product` — the new file should too. Fix: `text-primary` → `text-accent-product` in `app/app/error.tsx`.

### Pillar 4: Typography (2/4)

Distribution in the phase's files: sizes `text-xs`(1) / `text-sm`(16) / `text-base`(7) / `text-lg`(3) / `text-xl`(3); weights 400/600 only (weights PASS).

- **WARNING — home block h2 off-ramp:** contract Section (h2) = `text-xl font-semibold` ("each home actualidad block heading"). All 3 block headings use `text-lg font-semibold` (`actualidad-module.tsx:92,213,316`). `text-lg` (18px) is not in the 4-size ramp. Live-confirmed. Fix: `text-lg` → `text-xl` ×3.
- **WARNING — `text-xs` boletín meta:** `actualidad-module.tsx:232` renders the boletín as `font-mono text-xs`; contract Mono metadata = `text-sm` (14px), and `text-xs` is not in the ramp. Fix: `text-xs` → `text-sm`.
- **WARNING — Block 2 item at `text-sm`:** the urgencia sentence (título + tipo + fecha) is body copy at `text-sm` (:225); contract body = `text-base leading-relaxed`, and the título should be the h3 role (see Visuals). Block 1's desenlace line at `text-sm` (:115) is likewise below the body role, though defensible as meta.
- PASS: Mono correctly applied to every date, count, tally, semana-ISO across all surfaces; en-dash tally via `conteoVotacion`; lobby row name at `text-base font-semibold` (h3-weight per contract); SC3 line fecha Mono.

### Pillar 5: Spacing (2/4)

- **WARNING — missing 44px touch targets on home links:** explicit contract exception ("touch-target minimum 44px on every interactive control added this phase — … lobby carril **and home items**"). Lobby link has `min-h-11` (:151); the 3 home links (`actualidad-module.tsx:131,138,237`) do not — at `text-sm` they land ≈20px tall. Priority Fix 3.
- PASS — frontier rule (LOCKED) honored: `<section id="lobby-tramitacion" className="mt-12">` is a true sibling between `#votaciones` and `#idea-matriz` (`page.tsx:88-91`), never nested, and the live HTML confirms the section + `mt-12` persist even when the Section degrades (heading lives inside the View, so path-1 leaves no orphan band). Home module `grid gap-6 md:grid-cols-3`, panels `rounded-lg border p-6`, exactly as contracted; no arbitrary `[Npx]` values anywhere.
- Minor: `py-3`/`gap-x-3` (12px) on lobby rows and `mb-3`/`space-y-1.5` (12px/6px) in estado-actual are off the declared token set (xs/sm/md/lg/xl); multiples of 4 except `space-y-1.5` (6px, pre-existing F51 line). Cosmetic, consistent internally.

### Pillar 6: Experience Design (2/4)

- **BLOCKER — provenance lost on live lobby rows:** all 5 rows on `/proyecto/16743-04` render with NO source link (conditional `{href && …}` at `lobby-en-tramitacion.tsx:146`; `enlace_detalle` null for Cámara rows — acknowledged in the file's own WR-07 comment). Contract: per-row provenance "Present on every row; traceability per datum"; invariant 7: "a datum without a source link does not ship". The row shipping link-less is precisely the outcome both clauses forbid, on the phase's most legally sensitive surface. Priority Fix 1.
- PASS — degrade honesto is exemplary: exactly-PGRST202 → null (no message-regex swallowing real schema errors, WR-01), real error → throw #34, 0 rows → distinct honest empty; no blanket catch (:258-273). Post-apply the carril renders live (verified).
- PASS — state coverage: per-block `<Suspense>` skeletons (aria-hidden, no fabricated claims); independent honest empties (live home shows empty Block 1 next to populated Blocks 2-3); `error.tsx` boundary added so a data throw no longer replaces the hero with the generic 500 (CR-01); `force-dynamic` on `/` (F50 gotcha); bounded `.limit()` reads; no destructive actions (correctly none).
- Minor: `error.tsx` relies on `unstable_` prefixed retry API — flagged for watching across Next upgrades (prefix signals instability), not scored.
- Note: `EstadoActualBlock` selects `semana_iso` (`estado-actual-block.tsx:253`) but only `comision, fecha` are used — dead column in the select, harmless.

---

## Registry Safety

`app/components.json` exists (shadcn, Slate) but 52-UI-SPEC §Registry Safety declares **no third-party registries and no new blocks** this phase. Registry audit: 0 third-party blocks to check, no flags. Vetting gate not triggered.

---

## Files Audited

- `app/components/lobby-en-tramitacion.tsx` (new — SC2 carril)
- `app/components/actualidad-module.tsx` (new — SC4 home module)
- `app/components/estado-actual-block.tsx` (extended — SC3 line)
- `app/app/page.tsx` (home wiring + force-dynamic)
- `app/app/proyecto/[boletin]/page.tsx` (carril wiring)
- `app/app/error.tsx` (new — home error boundary)
- `app/app/globals.css`, `app/tailwind.config.ts` (token verification)
- Live rendered HTML: `/` and `/proyecto/16743-04` (deployed worker, curl)
