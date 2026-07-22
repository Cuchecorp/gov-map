# Phase 88 — UI Review

**Audited:** 2026-07-21
**Baseline:** 88-UI-SPEC.md (approved, LOCKED contract)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only static audit; visual gate is BrowserOS/phase 89 per notes)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All LOCKED legends + labels byte-match the contract; anti-insinuación clean |
| 2. Visuals | 3/4 | Clear hierarchy + real buttons; latent `(disponible próximamente)` partido placeholder contradicts SPEC |
| 3. Color | 3/4 | Zero-hex, tokens correct; Cámara *facet* control turns petróleo on engage — collides with "cámara never petróleo" prohibition |
| 4. Typography | 4/4 | Only ramp roles used (text-sm/xs/base, weights 400/500/600); font-mono boletín preserved |
| 5. Spacing | 4/4 | `min-h-11` on every control; 4/8/16/24 scale honored; `py-1.5` is the permitted exception |
| 6. Experience Design | 3/4 | Empty state + disabled facets + aria complete; relevancia tie-break is dead code, legend over-promises |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Relevancia tie-break never executes (`buscar-filtros.tsx:69-84`)** — FIXED (commit ef6f012). Removed the dead Mensaje>Moción and recency branches. `applyOrder("relevancia")` now returns `[...rows]` directly (stable copy preserving retrieval rank). `LEYENDA_ORDEN` updated to honest copy: "Orden por relevancia de la búsqueda. Opciones: más recientes primero · mensajes del Ejecutivo primero." Test updated to match new legend string. 1060/1060 pass.

2. **Latent partido placeholder contradicts LOCKED contract (`buscar-filtros.tsx:456-463`)** — FIXED (commit ef6f012). Removed the `(disponible próximamente)` placeholder block entirely. The partido group no longer renders under any condition until P2/BIO-03 delivers real chips. `tienePartido` useMemo retained as forward-compat guard for when P2 adds actual chip rendering. Test updated: "sí renderiza la faceta Partido" → "NO renderiza" until P2. 1060/1060 pass.

3. **Cámara facet control adopts petróleo on engage (`buscar-filtros.tsx:441-447` via shared `FacetChip`)** — RESOLVED by annotation (commit ef6f012). Operator decision: rule 2 (facet-active petróleo) supersedes the cámara prohibition for filter CONTROLS. The prohibition applies to the DATO surface (result-card `CamaraChip`), not to the filter control affordance. Annotated in `buscar-filtros.tsx` at the cámara facet block and recorded in `88-UI-SPEC.md §Color`.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
PASS. Every LOCKED string is a hoisted constant and matches the contract exactly:
- `LEYENDA_COUNTS` (`:31-32`) = "Conteos sobre estos N resultados, no sobre todo el corpus." ✓
- `LEYENDA_ORDEN` (`:33-34`) = "Orden por relevancia de la búsqueda; en empates se priorizan los mensajes del Ejecutivo y lo más reciente." ✓
- Order labels (`:43-47`): "Relevancia (por defecto) · Más recientes · Mensajes primero" ✓
- Empty state (`:35-36`): heading "Ningún resultado con estos filtros" + body "Ajusta o quita filtros para ver más proyectos." ✓
- Bucket labels (`estado-bucket.ts:56-63`): En tramitación · Publicado / Ley · Archivado · Rechazado · Retirado · Sin dato ✓
- Group heading rendered as `aria-label="Filtrar resultados"` (`:361`); disabled facets keep label + `· 0` (the disabled state communicates "existe, no aplica aquí" per contract). No generic "Submit/OK/No data" strings. No anti-insinuación terms (no ranking/score/puntaje/afinidad in any user-facing copy).

### Pillar 2: Visuals (3/4)
Focal hierarchy is present: result title `text-base font-semibold` dominates each card; facets are visually subordinate chips; the counts/rules legends are `text-xs muted`. Every interactive element is a real `<button type="button">` (`:119`, `:158`) — no icon-only buttons needing aria-labels. Chips carry visible text labels + counts, so no ambiguous glyphs.
- **WARNING** (`:456-463`): the partido `(disponible próximamente)` placeholder is a visual dead-end the SPEC explicitly bans. Dormant today (`tienePartido` false) but ships as latent contract debt.

### Pillar 3: Color (3/4)
Zero raw hex in `buscar-filtros.tsx` (grep clean). All color via tokens: `bg-muted`, `border-border`, `text-muted-foreground`, and petróleo via `border-accent-product bg-accent-product-soft text-accent-product` (`:134-136`, `:166-167`). Tokens verified present: `--accent-product` (`globals.css:24`), `--accent-product-soft` (`civic-tokens.css:32`), `--color-accent-product-soft` bridge (`globals.css:87`) — bare `hsl()` reference, no double-wrap (54-04 gotcha avoided). Neutral Mensaje/Moción/año badges use `border-transparent bg-muted text-muted-foreground` (`:511`, `:519`) — factual, no semantic color, matches contract.
- Petróleo appears on exactly the 3 declared surfaces: active order toggle, active facet chip, focus-visible ring. ✓ for the declared list.
- **WARNING**: the Color section's two cámara rules conflict, and the implementation resolves toward petróleo for the cámara *facet control* (shared `FacetChip`). The result-card cámara chip (`renderRow` → `CamaraChip`, `:532` / `search-result-card.tsx:57`) correctly keeps civic tokens, so the substantive display is compliant; only the filter control is ambiguous.

### Pillar 4: Typography (4/4)
Only ramp roles used: `text-base font-semibold` (result title `:534`, empty heading `:489`), `text-sm font-medium`/`font-semibold` (chips `:127`, `:163`), `text-xs font-normal` (counts `:140`, legends `:364`, `:468`). Weights limited to 400/500/600 — none above 600, matching the contract. Boletín renders `font-mono text-sm text-muted-foreground` (`:505`, `search-result-card.tsx:74`) unchanged. No ad-hoc `rem`/arbitrary font-size (typography guard respected).

### Pillar 5: Spacing (4/4)
`min-h-11` (44px touch target) on both `FacetChip` (`:127`) and `OrderChip` (`:163`) — mobile 390px operability satisfied. Scale honored: `gap-1` (chip inner), `gap-2` (chip-to-chip, `:372` etc.), `px-4 py-1.5` (chip padding — `py-1.5` is the SPEC's permitted exception since 44px is enforced by `min-h-11` not padding), `space-y-4` (result list), `space-y-6` (panel rhythm), `mt-4` (order group). Mobile stacking inherited from `.net-filtros @media (max-width: 47.99rem)` (`globals.css:221-231`): flex-column, reduced gaps, nothing hidden/removed — matches the "all facet chips remain operable" LOCK. No arbitrary px spacing values.

### Pillar 6: Experience Design (3/4)
State coverage is strong for a non-fetching island:
- **Empty (post-filter):** `listaVisible.length === 0` renders the LOCKED heading/body (`:487-493`). ✓
- **Disabled facets:** `count === 0 → disabled + aria-disabled="true" + opacity-40 + onClick undefined` (`:117-137`), never removed. ✓ FILT-02.
- **sin_dato visible:** estado bucket, año, and card badge all render explicit "Sin dato" (`:417`, `:529`, `search-result-card.tsx:71`) — never silently folded. ✓
- **Accessibility:** real buttons, `aria-pressed` on facets + order toggles (`:123`, `:160`), `role="group" aria-label="Ordenar resultados"` (`:470-472`), focus-visible petróleo ring on all controls. Island never imports Supabase / re-queries (FichaRail contract honored — no `.from`/`.rpc` in the client file). ✓
- Loading skeleton + honest error/empty owned upstream in `page.tsx` (`ResultadosSkeleton`, destructive banners) — correctly out of the island's scope; island cannot error on network. ✓
- No destructive actions (filters fully reversible in-memory) — no confirmation needed, matches contract. ✓
- **WARNING** (`:60-84`): the `relevancia` order mode's Mensaje>Moción + recency tie-break is unreachable — the positional-index primary key is unique per row, so JS stable-sort returns before the tie branches ever compare. The visible rules legend promises behavior the code never executes. Not a task-breaker (default order is still the correct retrieval rank), but an honesty gap between stated rule and actual behavior. The `recientes` and `mensajes` modes DO work correctly (`:86-102`), with `null` año sinking to the end (never fabricated) per RANK-01.

Registry audit: `components.json` present; UI-SPEC Registry Safety declares **no third-party registries** (only shadcn official: Card/Badge/Button/Skeleton, all pre-installed). No third-party blocks to scan — no flags.

---

## Files Audited
- `app/components/buscar-filtros.tsx` (island — filters/order, primary audit target)
- `app/components/search-result-card.tsx` (result card — Mensaje/Moción + año chips)
- `app/app/buscar/page.tsx` (server component — slice enrichment, año derivation, renderRow wiring)
- `app/lib/estado-bucket.ts` (pure normalizer + deriveAnio — bucket labels + honesty rules)
- `app/components/etapa-badge.tsx` (reused — estado bucket chip variants)
- `app/components/camara-chip.tsx` (reused — civic institutional cámara tokens)
- `app/app/globals.css` + `app/app/styles/civic-tokens.css` (token + `.net-filtros` verification)
