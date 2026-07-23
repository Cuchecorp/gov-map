# Phase 92 — UI Review

**Audited:** 2026-07-22
**Baseline:** 92-UI-SPEC.md (approved design contract) + civic design system (Tailwind 4, hsl-baked tokens)
**Screenshots:** NOT captured (no dev server on :3000/:5173/:8080 — code-only audit: Tailwind-class audit, token-registration verification, string/copy audit, state-coverage check, anti-insinuación guard-scope check)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All LOCKED strings verbatim; NEGACIONES_LOCKED subtraction applied (closes Phase-91 BLOCKER); empty/count/truncado copy honest. |
| 2. Visuals | 4/4 | Sibling-section `mt-12` frontier honored; chips below materia in own row; heading/leyenda live inside component (no orphan on degrade). |
| 3. Color | 4/4 | Zero hex. `accent-product` reserved to the closed list; all utilities resolve hsl-wrapped via tailwind.config.ts + `--color-accent-product-soft`. |
| 4. Typography | 4/4 | Only repo roles used (text-xl/base/sm/xs, font-semibold/normal); boletín/fecha/count in `font-mono`; materia `text-sm leading-relaxed`. |
| 5. Spacing | 3/4 | Scale respected (gap-2, mt-1, py-3, mt-12, space-y-*); no arbitrary px. Minor: mencion list uses `space-y-0` on `<ul>` relying on `border-t`/`py-3` — intentional but undocumented in spec's scale table. |
| 6. Experience Design | 4/4 | Fail-closed double gate, 3-path honest degrade (PGRST202→null / 0-rows→empty / real error→throw), min-h-11 on every control, focus-visible everywhere, no nested TooltipTrigger. |

**Overall: 23/24**

---

## Top 3 Priority Fixes

No BLOCKERs. Three WARNING-level polish items:

1. **Contraparte line enriched beyond the LOCKED copy contract** (`lobby-menciones-de-boletin.tsx:115-121`, `149-154`) — Spec §Copywriting line 141 declares `Contraparte: {nombre crudo}` (nombre only). The implementation joins `nombre · rol · representado` with " · ". Impact: harmless (still crudo, no RUT, mirrors the ficha-parlamentario `ContraparteCruda` idiom which DOES show tipo+representado) but it diverges from the literal spec string. Fix: either update the spec to note the enrichment matches the parlamentario idiom, or drop rol/representado to match the contract verbatim. Recommend documenting — the richer line is the better UX and is design-system-consistent.

2. **`space-y-0` on the mencion `<ul>` is spacing-by-negation** (`lobby-menciones-de-boletin.tsx:232`) — The list sets `space-y-0` and relies entirely on each `<li>`'s `border-t first:border-t-0 py-3` for row separation. This is the correct 0048 idiom, but `space-y-0` is a no-op class that reads as accidental. Impact: none functional. Fix: remove `space-y-0` (redundant) so the row-separation intent (border-t + py-3) is unambiguous.

3. **Mono/Sans count wrapping in the truncado variant spans two `font-mono` islands mid-sentence** (`lobby-menciones-de-boletin.tsx:213-218`) — "Se muestran las `{mostradas}` audiencias más recientes de `{total}` que mencionan…" wraps two separate mono numbers inside a Sans paragraph. This is correct per §Typography (numbers always mono) but on 390px the two mono spans plus long Sans copy could produce awkward line breaks. Impact: cosmetic, mobile-only. Fix: verify on a 390px viewport once the dev server is up (was not capturable this pass); no code change if it wraps cleanly.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **Chip label verbatim** (`mencion-boletin-chip.tsx:58-59`): `Menciona boletín ` (Sans) + `{boletin}` (`font-mono`) — matches §Copywriting line 135 exactly.
- **Chip aria-label verbatim** (`:42`): `Esta materia menciona el boletín ${boletin}; abre el proyecto.` — matches line 136 exactly.
- **Section heading verbatim** (`lobby-menciones-de-boletin.tsx:189`): `Audiencias de lobby que mencionan este boletín` — matches line 137.
- **Anti-causal leyenda verbatim** (`:87`, `LEYENDA_MENCIONES_LOBBY`): byte-identical to line 138, kept as a single-line string literal to survive the linter's split/join subtraction (prettier-ignore comment documents the reasoning).
- **Empty state verbatim** (`:95`, `EMPTY_MENCIONES_LOBBY`): matches line 145 — declares "no describe la actividad de lobby" so a zero is a HECHO, never read as exoneration.
- **Honest count** (`:210-225`): neutral singular/plural (`audiencia registrada menciona` / `audiencias registradas mencionan`) via `plural(total,…)`; truncado variant (`total_n` of 0061) matches line 140.
- **Phase-91 BLOCKER closed** (`anti-insinuacion-guard.test.ts:218-220`, `329-338`): the three new surfaces (`lobby-menciones-de-boletin.tsx`, `mencion-boletin-chip.tsx`, `lobby-de-parlamentario.tsx`) are added to the scan glob AND `LEYENDA_MENCIONES_LOBBY` + `EMPTY_MENCIONES_LOBBY` are subtracted in `NEGACIONES_LOCKED` before scanning — the exact remedy the spec mandated (§NEGACIONES_LOCKED, "lección BLOCKER 91").
- WARNING: contraparte line enrichment vs literal spec copy (see Top Fix #1).

### Pillar 2: Visuals (4/4)

- **Sibling frontier honored**: new `<section id="lobby-menciones" className="mt-12">` (`proyecto/[boletin]/page.tsx:183`) is a true sibling of `#lobby-tramitacion` (0048), inserted after it and before `#cruces` — never nested, never fused. The 48px `mt-12` anti-insinuación frontier is preserved even when the section degrades to `null` (the wrapper carries the margin).
- **Heading + leyenda live inside the component** (`lobby-menciones-de-boletin.tsx:187-191`, `179-183`): on the PGRST202 degrade path the Section returns `null` with no orphan heading; on 0-rows it still renders heading + leyenda + honest empty.
- **Chips below materia, own row** (`mencion-boletin-chip.tsx:75`): `flex flex-wrap gap-2 mt-1` — never inline with the long materia text (would break the wrap), per §Component 2.
- **Rail distinction**: `Menciones en lobby` entry added separately from `Lobby del período` in both `ProyectoRail.navEntries` (`page.tsx:304`) and `RailSkeleton` count (`:674`, 9/10 matched to avoid CLS) — the two lobby carriles are listed distinctly.
- Focal clarity: h2 (`text-xl font-semibold`) → leyenda band (`bg-muted`) → count → rows. Clear hierarchy.

### Pillar 3: Color (4/4)

- **Zero hex** in all phase-92 files (grep for `#[0-9a-fA-F]{3,8}` on `mencion-boletin-chip.tsx` → no matches; other files clean).
- **Utilities resolve correctly**: `tailwind.config.ts:46` registers `"accent-product": "hsl(var(--accent-product))"` → `text-/border-/outline-/decoration-accent-product` all resolve hsl-wrapped (the c3bee89 fix). `--color-accent-product-soft` registered in `globals.css:87` (bare, because civic-tokens.css defines it as a full `hsl()` — avoids the 54-04 double-hsl gotcha). `bg-accent-product-soft` valid.
- **Accent reserved to the closed list** (§Color 1-5): chip-link (`mencion-boletin-chip.tsx:54` border/text petróleo + soft fill), parlamentario link (`lobby-menciones-de-boletin.tsx:139`), "Ver fuente oficial ↗" (`:167`), toggle-active (`lobby-de-parlamentario.tsx:246`), and `focus-visible:outline-accent-product` on every control. No color-by-theme, no color-by-boletín — every mencion chip is the identical petróleo (encodes "link", never relevance/risk/affinity), per the LOCKED prohibition.
- Identity-warn (`CaveatIdentidad`, `lobby-de-parlamentario.tsx:299-310`) uses the untouched `bg-identity-warn-*` ámbar idiom.

### Pillar 4: Typography (4/4)

- Only repo roles: h2 `text-xl font-semibold` (heading), parlamentario link `font-semibold` (subhead), materia `text-sm … leading-relaxed`, meta/labels `text-sm`, mono `font-mono` for dates/boletines/counts. No new sizes, no arbitrary `text-[Npx]`.
- **Materia legible = the core of the phase**: both `VistaCronologica` (`lobby-de-parlamentario.tsx:518`) and `VistaAgrupada` (`:444`) render materia as a `<div>` (block, not inline `<span>`) with `whitespace-pre-line leading-relaxed` and NO `line-clamp`/`truncate`/`max-h` — grep confirms zero clamp classes in the file. The mencion section row (`lobby-menciones-de-boletin.tsx:156`) does the same. This is exactly §Component 1's mandated change (span→block, honors `\n`, selectable, no "ver más").
- Boletín number always `font-mono` (`mencion-boletin-chip.tsx:59`); count `total`/`mostradas` in `font-mono` (`lobby-menciones-de-boletin.tsx:215-221`).

### Pillar 5: Spacing (3/4)

- Scale respected: `gap-2` (chip rows), `mt-1` (chips under materia), `py-3` + `border-t first:border-t-0` (audience rows), `mt-12` (section frontier), `space-y-6`/`space-y-2`/`space-y-4` (groups/lists), `mb-4` (leyenda/count). No arbitrary px/rem values in any phase-92 file (grep `\[Npx\]` → no matches).
- `min-w-0` on the materia flex column (`lobby-de-parlamentario.tsx:490`, `lobby-menciones-de-boletin.tsx:125`) permits wrap without horizontal overflow — the §Spacing whitespace rule.
- WARNING (see Top Fix #2): `space-y-0` on the mencion `<ul>` (`:232`) is a redundant no-op; row separation actually comes from per-`<li>` `border-t`/`py-3`. Reads as accidental; the intent would be clearer without it. −1.

### Pillar 6: Experience Design (4/4)

- **Fail-closed DOUBLE gate**: pattern (`extraerBoletines`, deterministic, gatillo-léxico or `-NN` suffix — rejects "Ley 20.730", bare numbers, dinero) AND existence in `proyecto` (`resolverBoletinesMencionados`, batched `.in()` chunked at 500 < PostgREST cap). Pattern-match-but-not-existent → NO chip (never a dead link). Matches §Component 2 states table exactly.
- **3-path honest degrade** (`lobby-menciones-de-boletin.tsx:255-269`): PGRST202 (function-not-found, exact code — NOT a regex-message fallback that would swallow real schema errors) → `return null`; 0 rows → empty honesto; any other DB/red error → `throw` (#34, never a false exoneration). Mirror-perfect vs 0048.
- **Error honesty across the wire**: `LobbySection` throws on `rpcError`, `chipsError`, `estadoError` (`lobby-de-parlamentario.tsx:722-752`) — a transient failure never degrades to "sin reuniones"/"sin chips".
- **Touch targets**: `min-h-11` on chip-link (`mencion-boletin-chip.tsx:44`), parlamentario link (implicit via `inline-flex` + underline is a text link — acceptable), "Ver fuente oficial ↗" (`lobby-menciones-de-boletin.tsx:167`), toggle links, pagination links. All interactive controls covered.
- **focus-visible**: `outline-2 outline-offset-2 outline-accent-product` on chip-link and parlamentario link; text links carry the global focus style. No bare `outline-none`.
- **No nested TooltipTrigger** inside the chip Link (WR-04) — semantics live entirely in `aria-label`. Confirmed: `mencion-boletin-chip.tsx` imports only `Link`, `Badge`, `cn` — no Tooltip.
- Loading: shape-matched skeletons (`LobbyTramitacionSkeleton` reused for the new section, `page.tsx:184`); RailSkeleton bumped to 9/10 entries to prevent CLS.

---

## Registry Safety

`components.json` exists (shadcn initialized). 92-UI-SPEC §Registry Safety declares **no third-party registries** — "reutiliza `ui/badge`, `ui/tooltip` ya instalados", no new blocks. Registry audit: 0 third-party blocks to check, no flags. Skipped per gate.

---

## Files Audited

- `.planning/phases/92-…/92-UI-SPEC.md` (design contract)
- `app/components/lobby-de-parlamentario.tsx` (materia legible both views + chip wire + server fail-closed)
- `app/components/mencion-boletin-chip.tsx` (chip-link + chips layout helper)
- `app/components/lobby-menciones-de-boletin.tsx` (new ficha-proyecto section + 3-path degrade)
- `app/app/proyecto/[boletin]/page.tsx` (section placement + rail entry + skeleton count)
- `app/app/parlamentario/[id]/page.tsx` (lobby wire via LobbySectionConCamara)
- `app/lib/boletin-en-materia.ts` (deterministic extractor, fail-closed #1)
- `app/lib/anti-insinuacion-guard.test.ts` (scan glob + NEGACIONES_LOCKED subtraction)
- `app/app/globals.css`, `app/app/styles/civic-tokens.css`, `app/tailwind.config.ts` (token registration)
- `app/components/ui/badge.tsx` (chip base)
