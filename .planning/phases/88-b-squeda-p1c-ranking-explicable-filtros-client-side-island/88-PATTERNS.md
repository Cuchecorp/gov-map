# Phase 88: BÚSQUEDA P1c — Ranking explicable + filtros client-side island - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 5 (2 new, 2 modified, 1 shared type)
**Analogs found:** 5 / 5 (all files have a strong in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/lib/estado-bucket.ts` (NEW) | utility (pure lib, table-driven) | transform | `app/lib/parlamentario-resumen-conteos.ts` (pure derivation + año-from-ISO) · `app/components/etapa-badge.tsx` (keyword→variant table) | exact (role+flow) |
| `app/lib/estado-bucket.test.ts` (NEW) | test | transform | `app/lib/parlamentario-resumen-conteos.test.ts` · `app/lib/format.test.ts` | exact |
| `app/components/buscar-filtros.tsx` (NEW) | component (`"use client"` island) | event-driven (in-memory filter/reorder, zero network) | `app/components/red/red-graph.tsx` (client filters over already-received slice + counts) · `app/components/ficha-rail.tsx` (serialized-slice contract) · `app/components/autores-list.tsx` (minimal useState island) | exact (contract) |
| `app/components/buscar-filtros.test.tsx` (NEW) | test | event-driven | `app/components/red/red-graph.test.tsx` (jsdom structure/state) | exact |
| `app/app/buscar/page.tsx` (MODIFY) | page (server component) | request-response + CRUD read | itself (existing hydration) + `app/components/actualidad-module.tsx` (`.from("tramitacion_evento")` enrichment) | exact |
| `app/lib/types.ts` (MODIFY — add slice type) | model (shared type) | — | existing `ProyectoRow` / `MatchProyectoRow` interfaces in same file | exact |

---

## Pattern Assignments

### `app/lib/estado-bucket.ts` (utility, transform)

**Analog A — table-driven keyword→variant resolver:** `app/components/etapa-badge.tsx` lines 15-44.
The `resolveVariant` function is the exact shape to mirror: lowercase the free text once, walk an ordered set of `.includes(...)` keyword tests, fall through to an explicit honest default. `estado-bucket.ts` must do the SAME but return a `bucket` enum (not a className) and be a **pure exported function** (not JSX). Note the honest-default rule already lives here: null/empty/unmapped → `"Estado desconocido"` (slate). Mirror it as `sin_dato`.

```typescript
// etapa-badge.tsx:16-44 — the pattern to copy (return a bucket enum, not a variant)
function resolveVariant(value: string | null): EtapaVariant {
  const v = (value ?? "").toLowerCase();
  if (v.includes("promulg") || v.includes("ley")) { /* … */ }
  if (v.includes("rechaz")) { /* … */ }
  if (v.includes("archiv")) { /* … */ }
  if (v.includes("tramit")) { /* … */ }
  if (value && value.trim().length > 0) { /* fall-through non-empty */ }
  return { label: "Estado desconocido", className: "bg-slate-100 text-slate-500" }; // ← honest default
}
```

**IMPORTANT — order matters (bug latent in EtapaBadge to AVOID):** EtapaBadge tests `ley` BEFORE `tramit`. A raw estado like `"En tramitación (segundo trámite) — ley en …"` could bucket wrong if the mapping table order is careless. For `estado-bucket.ts` derive the ordered pattern table from the **DISTINCT real PROD values** (read-only during dev), and encode order explicitly so `rechazado`/`archivado`/`retirado`/`publicado_ley` win over the generic `en_tramitacion` where the source text is compound. Table shape: `Array<{ patrones: RegExp | string[]; bucket: Bucket }>`, first-match-wins, else `sin_dato`.

**Enum + labels (from UI-SPEC §Estado normalizer, LOCKED):**
```typescript
export type EstadoBucket =
  | "en_tramitacion" | "publicado_ley" | "archivado"
  | "rechazado" | "retirado" | "sin_dato";
// Display labels (must pass anti-insinuación linter):
// En tramitación · Publicado / Ley · Archivado · Rechazado · Retirado · Sin dato
```

**Analog B — pure lib with tests + año-from-ISO derivation:** `app/lib/parlamentario-resumen-conteos.ts` lines 167-190 (`mapearPatrimonio`). This is the model for BOTH the file's purity (no I/O, fully unit-testable) AND the **year derivation** that `buscar/page.tsx` needs. It parses year from an ISO date and EXCLUDES non-parseable years (never graphs garbage) — the same "honest sin_dato" rule the year facet needs:

```typescript
// parlamentario-resumen-conteos.ts — año-from-ISO with honest exclusion (mirror for derived year)
// deriva `anio` del ISO … año no parseable se EXCLUYE, nunca se grafica basura (^\d{4}$)
```
Reuse this exact discipline for `deriveAnio(fechaIso: string | null): number | null` — `null` (not a fabricated date) when un-parseable. NEVER derive year from `fecha_captura` (capture date) or from the boletín suffix (materia code) — UI-SPEC §Year facet, LOCKED.

---

### `app/components/buscar-filtros.tsx` (`"use client"` island, event-driven)

**Analog A (primary) — client filters over an already-received slice:** `app/components/red/red-graph.tsx`.
This island is the closest structural match: it receives a serialized JSON payload as props and filters it IN MEMORY with `useState`, zero round-trips. Copy its whole shape.

- **Zero-network contract + useState filter state** (lines 1-3, 233-239):
```typescript
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// …
const [tiposOcultos, setTiposOcultos] = useState<Set<string>>(new Set()); // ← facet-toggle state pattern
const [desde, setDesde] = useState<string>("");
```
Use `useMemo` to derive the filtered+reordered list from `(slice, activeFacets, orderMode)` so re-renders are cheap. The island NEVER imports `@/lib/supabase` (FichaRail contract — verified: red-graph imports only presentational helpers).

- **Facet-group container + labels + 44px targets** (lines 502-516) — reuse `.net-filtros` CSS classes (already in `globals.css` lines 165-231, including the mobile 390px column stack `@media (max-width: 47.99rem)`). Group wrapper: `<div className="net-filtros" role="group" aria-label="…">`; each facet fieldset `.net-filtros__tipos` + `<legend className="net-filtros__legend">`; each control `.net-filtros__tipo` (`min-height: 2.75rem` = 44px baked in).

**Analog B — chip/button base + counts + disabled + petróleo active treatment.**
- **Chip button base** (search-box.tsx lines 140-155): real `<button type="button">`, `min-h-11`, `rounded-full border border-border bg-muted px-4`, `focus-visible:*` ring. This is the base for facet chips.
- **Disabled facet (count 0)** — reuse `.net-b-pager__btn:disabled { opacity: 0.4; cursor: default }` (globals.css 521-524) + set `disabled` and `aria-disabled="true"` on the button (UI-SPEC FILT-02). Never remove the chip.
- **aria-pressed does NOT exist yet in the repo** (grep: 0 hits). This phase INTRODUCES it. Mirror the existing `aria-current` active-state idiom from FichaRail lines 60-67 (petróleo active = `bg-accent-product-soft border-accent-product font-semibold text-accent-product` + `focus-visible:outline-accent-product`), but express it as `aria-pressed={engaged ? "true" : "false"}` on toggle/facet buttons (UI-SPEC §Accessibility, LOCKED).

**Facet-value chip components (REUSE, do not rebuild):**
- Estado bucket chip → `EtapaBadge` (`app/components/etapa-badge.tsx`) — palette utilities (`bg-emerald-100 text-emerald-800`, `bg-slate-100 text-slate-500` for `sin_dato`). These are Tailwind palette classes, NOT hex → cero-hex-safe.
- Cámara facet chip → `CamaraChip` (`app/components/camara-chip.tsx` lines 25-47) — civic institutional tokens `bg-[var(--camara-muted)] text-[var(--camara-muted-foreground)]`; returns `null` for unknown (never an alarm chip). NOTE: `CamaraChip` fills-nothing rule (petróleo NEVER on cámara) is LOCKED.
- Iniciativa (Mensaje/Moción) + year → shadcn `Badge variant="outline"` (`@/components/ui/badge`), `border-transparent bg-muted text-muted-foreground` (matches EtapaBadge wrapper line 49) — neutral factual, no semantic color, no score.

**Minimal-island precedent for the counts legend / expand copy:** `autores-list.tsx` lines 36-52 (honest inline text via `text-sm text-muted-foreground`, `<button type="button">` for the interactive bit).

**Optional `partido` field (P2/BIO-03 forward-compat):** the slice row type carries an OPTIONAL `partido?: string | null`. When absent, the party facet group simply does not render (no disabled placeholder). Mirror `CamaraChip`'s "omit when it doesn't apply" discipline (lines 41).

---

### `app/app/buscar/page.tsx` (server component, MODIFY — enrich slice)

**Existing hydration to preserve (the enrichment point):** current `Resultados` function, lines 126-150.
- Hydration read (line 127-132): `createServerSupabase()` → `.from("proyecto").select("*").in("boletin", boletines)`, then re-order to preserve kNN rank via a `Map<string, ProyectoRow>` (lines 145-150). KEEP this exact rank-preserving order — the retrieval rank is the primary sort (RANK-01).
- **Honest error handling to preserve** (lines 133-144): a hydration error is NOT "sin resultados" — it `console.error`s and returns the same destructive banner as the search branch. The new `tramitacion_evento` read MUST follow the same honest-error discipline (never `?? []` to hide a read failure).

**Year-enrichment read — copy the analog:** `app/components/actualidad-module.tsx` lines 376-389.
```typescript
// actualidad-module.tsx:376-389 — .from() a tabla no-PII, .in("boletin",…), .order("fecha"), throw on error
const { data, error } = await sb
  .from("tramitacion_evento")
  .select("*")
  .in("boletin", boletinesCandidatos)
  .order("fecha", { ascending: true });
if (error) { throw new Error(`… no se pudo leer tramitacion_evento: ${error.message}`); }
const eventos = (data as TramitacionEventoRow[] | null) ?? [];
```
Apply: read `tramitacion_evento` for the ≤20-50 boletines of the page slice, order `fecha` ascending, take the **earliest event (min fecha)** per boletín as the filing-date proxy, then `deriveAnio()` (from `estado-bucket.ts`/a sibling pure helper) → the row's year or `null`. `.in("boletin", …)` on a page slice of ≤20-50 will not hit the PostgREST 1k cap (UI-SPEC note) — no `.range()` needed here.

**Assemble the serialized slice per row** (server-side, so the island receives everything computed): `{ boletin, titulo, anio: number|null, iniciativa: "Mensaje"|"Moción"|null, estadoBucket: EstadoBucket, camaraOrigen, fecha }`. `iniciativa` comes from `ProyectoRow.iniciativa` (types.ts line 17); `estadoBucket` from `estadoBucket(p.estado ?? p.etapa)`; `camaraOrigen` from `ProyectoRow.camara_origen`. Pass this array to `<BuscarFiltros slice={…} />`.

**Per-result explanatory chips on the card:** `SearchResultCard` (`app/components/search-result-card.tsx`) REUSE/EXTEND — its header already renders `EtapaBadge` + `CamaraChip` + boletín (lines 40-47). Add the neutral Mensaje/Moción + year `Badge variant="outline"` here. HARD RULE (line 12-18 JSDoc, §5 LOCKED): NEVER surface score/cosine/rank number.

---

### `app/lib/types.ts` (shared model, MODIFY)

Add the serialized slice-row interface next to `ProyectoRow` (line 13) and `MatchProyectoRow` (line 95). Follow the existing house style in this file: snake_case for DB-shaped rows, but this is a UI-derived slice so camelCase is fine (mirror `SearchResultCardProps`). Keep `partido?` optional for BIO-03 forward-compat. Document the honest-null contract in JSDoc (the file's convention — every nullable field explains WHY it can be null).

---

## Shared Patterns

### FichaRail serialized-slice contract (zero-network island)
**Source:** `app/components/ficha-rail.tsx` lines 27-89 (LOCKED contract JSDoc lines 24-26).
**Apply to:** `buscar-filtros.tsx`.
The island receives everything pre-computed as serializable props; it NEVER imports the Supabase client, NEVER re-queries, NEVER derives a count/digit the server didn't hand it. Counts ("de estos N") are computed in-memory over the received slice (that IS the slice, not the corpus) — the legend states this explicitly (UI-SPEC copy: "Conteos sobre estos N resultados, no sobre todo el corpus.").

### Honest read-error discipline (never swallow to empty)
**Source:** `app/app/buscar/page.tsx` lines 133-144 + `actualidad-module.tsx` lines 382-387.
**Apply to:** the new `tramitacion_evento` read in `page.tsx`.
A failed read is `console.error`+banner (page) or `throw` (module), NEVER `?? []` masquerading as "sin resultados"/"sin dato". Distinguish a real failure from an honest absence.

### Petróleo (`--accent-product`) reserved-usage
**Source:** `ficha-rail.tsx` lines 60-67 (active `aria-current`), globals.css `.net-chip` rule (line 286-311, no political/cámara fill).
**Apply to:** every interactive control in `buscar-filtros.tsx`.
Petróleo ONLY on: active toggle/facet (`aria-pressed="true"`) + focus-visible ring. NEVER as chip fill by cámara/partido, NEVER on counts/legends/`sin_dato`.

### Table-driven keyword resolver + honest default
**Source:** `etapa-badge.tsx` lines 15-44, `camara-chip.tsx` lines 13-20.
**Apply to:** `estado-bucket.ts`.
Lowercase once, ordered first-match `.includes`, explicit honest fallback (`sin_dato`) — NEVER silently fold unmapped text into a substantive bucket.

### jsdom structure/state tests (no getComputedStyle)
**Source:** `app/components/red/red-graph.test.tsx`.
**Apply to:** `buscar-filtros.test.tsx`.
Assert DOM structure, filter/reorder state transitions, disabled facets, aria-pressed, empty-after-filter copy — all in jsdom. Visual gates (getComputedStyle, BrowserOS) are deferred to Phase 89. Use `import.meta.dirname` if reading fixtures from disk (MEMORY gotcha: jsdom breaks `new URL(import.meta.url)`).

---

## Guards That Will Bite (planner: wire these explicitly)

| Guard | File | How it bites this phase | Action required |
|-------|------|-------------------------|-----------------|
| **Anti-insinuación linter** | `app/lib/anti-insinuacion-guard.test.ts` | Scans an EXPLICIT hard list (`SUPERFICIES_VOTO`/`_MONEY`/`_HOME`, lines 93-141). New `buscar-filtros.tsx` + `buscar/page.tsx` are **NOT auto-scanned**. The 201 banned terms include `ranking`, `score`, `puntaje`, `índice`, `afinidad` — all tempting in a "ranking explicable" phase. | Add a `SUPERFICIES_BUSQUEDA = ["components/buscar-filtros.tsx", "app/buscar/page.tsx"]` array and include it in the scan loop, so the new ranking/filter copy is linted. Then keep copy factual: "orden por relevancia", "mensajes primero", "más recientes" — never "score"/"ranking del proyecto". |
| **PII / lockdown guard (Camino A)** | `app/lib/lockdown-guard.test.ts` lines 133-144, 351-409 | Auto-scans ALL of `app/` for `.from('<PII_table>')` and non-allowlisted `.rpc()`. **`proyecto` and `tramitacion_evento` are NOT in `PII_TABLES`** (list is `parlamentario`, `donante`, `cruce_senal`, …) → the new `.from("tramitacion_evento")` read is SAFE and needs no allowlist change. The island does zero DB access → trivially clean. | No change needed; just confirm the enrichment stays on `proyecto`/`tramitacion_evento` (non-PII) and adds NO `.rpc()`. |
| **Cero-hex + typography-arbitrary** | `app/lib/bento-guards.test.ts` lines 69+ | Scans an explicit `SUPERFICIES_CERO_HEX`/typography bento list — new files NOT in scope, so it won't fail. BUT the LOCKED design constraint (UI-SPEC) still forbids raw hex + ad-hoc rem. EtapaBadge palette classes (`bg-emerald-100`) are NOT hex → safe. | Follow discipline: token/utility only, `text-[var(--…)]` never re-wrapped in `hsl()`. Optionally extend the bento cero-hex list to cover the new files for defense-in-depth. |
| **Typography guard** | (per UI-SPEC §Typography) | font-size only via `var(--text-*)` or Tailwind `text-*` utilities; no ad-hoc rem. `.net-chip` uses an INTENTIONAL off-step (`0.6875rem`) already whitelisted — do not copy that literal into new arbitrary values. | Use `text-sm`/`text-xs`/`text-base` utilities from the UI-SPEC type ramp. |

---

## No Analog Found

None. Every file has a strong in-repo analog. The only genuinely net-new logic is **deriving a project year from the earliest `tramitacion_evento` fecha** — but its two halves each have an analog: the read pattern (`actualidad-module.tsx`) and the año-from-ISO honest-exclusion derivation (`parlamentario-resumen-conteos.ts`).

## Metadata

**Analog search scope:** `app/components/`, `app/lib/`, `app/app/buscar/`, `app/app/globals.css`, `app/lib/types.ts`
**Files scanned:** ~14 (ficha-rail, red-graph, search-box, autores-list, etapa-badge, camara-chip, search-result-card, buscar/page.tsx, types.ts, parlamentario-resumen-conteos.ts, actualidad-module.tsx, globals.css, anti-insinuacion-guard.test.ts, lockdown-guard.test.ts, bento-guards.test.ts)
**Pattern extraction date:** 2026-07-21
