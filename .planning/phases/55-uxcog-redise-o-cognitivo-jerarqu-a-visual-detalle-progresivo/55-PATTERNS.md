# Phase 55: UXCOG — Rediseño cognitivo (jerarquía visual + detalle progresivo) - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 12 new/modified (4 NEW islands/hooks, 1 NEW capa-1 dir, 6 MODIFY, 1 token registration)
**Analogs found:** 12 / 12 (every new file mirrors an existing in-repo pattern — this is a pure IA refactor)

> Reading note for the planner: ~80% of what this phase needs already exists as
> server-fetch + pure-view components. The NEW code is only: the rail, the scrollspy
> hook, the capa-1 summaries, one detail-disclosure island, and one color token. Every
> one of those has a byte-level analog below. Do NOT rebuild sections — pass them as
> `children` (F45 no-leak contract).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/components/detalle-colapsable.tsx` (NEW) | component (client island) | event-driven (toggle) | `app/components/carril-accordion.tsx` | exact (inverts body/capa-1 split) |
| `app/components/ficha-rail.tsx` (NEW) | component (client island) | event-driven (scrollspy) | `app/components/parlamentario-resumen.tsx` (`construirChips`/`ResumenView`) | role-match (nav prototype) |
| `app/lib/use-scrollspy.ts` (NEW) | hook (client) | event-driven | RESEARCH Code Example + native IntersectionObserver | new (no repo analog — greenfield hook) |
| `app/components/capa1/*.tsx` (NEW: votos, lobby, patrimonio, stepper) | component (server) | transform (aggregate→CSS visual) | `parlamentario-resumen.tsx` (`ResumenView` pure) + `estado-actual-block.tsx` (derivation) | role-match |
| `app/lib/parlamentario-resumen-conteos.ts` (MODIFY) | service (server-only) | CRUD (read RPC) | itself — extend `ConteoCarriles` to expose votos breakdown | exact (same file, same RPC) |
| `app/app/parlamentario/[id]/page.tsx` (MODIFY) | route (server) | request-response | itself (`CarrilesSection`) — widen grid, invert `abrePorDefecto`, wrap detail | exact |
| `app/app/proyecto/[boletin]/page.tsx` (MODIFY) | route (server) | request-response | `parlamentario` page (rail) + `timeline-view.tsx` (stepper/grouping) | role-match |
| `app/app/agenda/page.tsx` (MODIFY) | route (server) | request-response | itself (existing day-grouping `grupos` Map) | exact |
| `app/components/red/red-graph.tsx` (MODIFY) | component (client island) | transform (graph framing) | itself — thread `seedId`, add `fitViewOptions.nodes` | exact |
| `app/app/red/page.tsx` (MODIFY) | route (server) | request-response | itself — pass `seedId` prop | exact |
| `app/app/globals.css` + `styles/civic-tokens.css` (MODIFY) | config (tokens) | — | identity-warn `@theme inline` block (globals.css:59-69) | exact |
| Tests (NEW/EXTEND) | test | — | `carril-accordion.test.tsx` (island+forceMount+source-scan) | exact |

---

## Pattern Assignments

### `app/components/detalle-colapsable.tsx` (NEW — client island, PRIMARY new component)

**Analog:** `app/components/carril-accordion.tsx` (F45)

**Why this analog:** identical Radix `type="single" collapsible` + `forceMount` disclosure over server `children`. The ONE difference: `CarrilAccordion` collapses the WHOLE body (including the `<h2>` header as the trigger); `DetalleColapsable` must render capa-1 OUTSIDE the collapsible and wrap ONLY the detail. This is the "inverse" the research flags as the single most important structural nuance.

**Copy the island contract verbatim** (`carril-accordion.tsx` lines 1-6, 33-69):
```tsx
"use client";
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";
// ...
<AccordionPrimitive.Root type="single" collapsible defaultValue={defaultOpen ? "c" : undefined}>
  <AccordionPrimitive.Item value="c">
    <AccordionPrimitive.Header asChild>
      {/* Trigger: "Ver detalle (N)" ↔ "Ocultar detalle" — group-data-[state=open] driven */}
      <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-4 min-h-11 text-left">
    </AccordionPrimitive.Header>
    <AccordionPrimitive.Content
      forceMount
      className={cn("accordion-content overflow-hidden data-[state=closed]:hidden pt-4")}
    >
      {children}
    </AccordionPrimitive.Content>
  </AccordionPrimitive.Item>
</AccordionPrimitive.Root>
```

**Critical inversions vs the analog:**
- `defaultOpen` DEFAULT is `false` (detail starts CLOSED — UI-SPEC §Progressive-Disclosure). The F45 `abrePorDefecto` auto-open heuristic is REMOVED/inverted for the ~5.000px target.
- The `<h2>` heading is NOT the trigger anymore — the trigger is a secondary "Ver detalle (N)" button rendered below capa-1. The `<h2>` + count + capa-1 are always-visible siblings the page renders OUTSIDE this island.
- Toggle copy: `min-h-11` trigger; label template `"Ver detalle (N)"` ↔ `"Ocultar detalle"` driven by `group-data-[state=open]`.

**No-leak contract (LOCKED, copy the header comment intent from lines 8-19):** this island NEVER imports a `*Section` or `@/lib/supabase`; sections arrive as `children` from the server page. Asserted by the source-scan test (below).

---

### `app/components/ficha-rail.tsx` (NEW — client island: sticky `<aside>` + nav + scrollspy)

**Analog:** `app/components/parlamentario-resumen.tsx` — `construirChips` (lines 120-162) + `ResumenView` (lines 61-107)

**Why this analog:** `ParlamentarioResumen` IS the prototype of the rail nav — one entry per PRESENT carril, honest 3-state count, `#anchor` jump, gate-aware order. The rail GENERALIZES this into a sticky column with scrollspy.

**Reuse the gate-aware ordered chip builder verbatim** (`parlamentario-resumen.tsx` lines 120-162): the rail nav entries = `construirChips(c, env)` output. Order is LOCKED (votos → lobby → patrimonio → cruces-gated → money/pendiente). Keep the exact gate branches (`crucesPublicEnabled(env)` / `moneyPublicEnabled(env)`).

**Reuse the 3-state honest count renderer** (`ChipConteo`, lines 34-52) — `dato`→Mono number, `vacio`→"sin registros", `no_ingerido`→"—", `pendiente`→"pendiente". Never fabricate a digit.

**Reuse the anchor-link styling** (lines 89-96) for rail nav links; adapt to vertical list. Keep `min-h-11`, `focus-visible:outline-[var(--accent-product)]`.

**NEW parts (no analog — greenfield, but constrained):**
- Sticky `<aside>` (`sticky top-N`, `w-52`/grid track `13rem`). **PITFALL 3 (research):** the real `GlobalHeader` is NON-sticky, `min-h-14` (56px) — it scrolls away. UI-SPEC says `top-16`; planner must reconcile → default to a small offset (`top-4`/`top-8`) matching the scrolling header, or flag to operator (Assumption A2, MEDIUM risk).
- Scrollspy current-item state comes from `useScrollspy` (below). Current item = soft petróleo background + 2px left border petróleo + petróleo text/600 — uses the NEW `--accent-product-soft` token (see token pattern below).
- Cruces rail entry = diamond `◆` marker (UI-SPEC §Color reserved-list item 3).
- Rail caveat 1× (LOCKED copy, UI-SPEC §Copywriting): "Cada dato con fuente, fecha y enlace. La coincidencia temporal no implica relación."

**No-leak (LOCKED):** islands NEVER import a `*Section` or `@/lib/supabase`. Counts are computed server-side (`contarCarrilesSeguro`) and passed as serializable props (the same `ConteoCarriles`/`ResumenChip[]` shapes already crossing the boundary in `ParlamentarioResumen`).

---

### `app/lib/use-scrollspy.ts` (NEW — client hook, IntersectionObserver)

**Analog:** none in-repo (greenfield); RESEARCH §Code Examples has the reference impl (lines 296-317).

**Reference (from research, adopt verbatim):**
```tsx
"use client";
import { useEffect, useState } from "react";
export function useScrollspy(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }, // "current" = crossing top third
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}
```
Zero deps (native IntersectionObserver). Test mocks IntersectionObserver → asserts active id (Wave 0).

---

### `app/components/capa1/*.tsx` (NEW — server components: per-section capa-1 mini-visuals)

**Analogs:** `parlamentario-resumen.tsx` `ResumenView` (pure-view split, lines 54-107) + `estado-actual-block.tsx` (server derivation, lines 51-118).

**Pattern to copy — pure-view / server-fetch split:** every capa-1 is a PURE view over already-fetched aggregates (RTL-testable with fixtures, no Supabase runtime), exactly like `ResumenView`/`CrucesView`/`VotosView`. Figures come from `contarCarrilesSeguro` (extended, below) — NO new fetch inside capa-1.

**Capa-1 mini-visuals = CSS on tokens (NO chart lib)** — UI-SPEC §Design System. Specific:
- **Votos capa-1:** 5 Mono facts (`text-2xl`/600/Mono: 72 a favor / 66 en contra / 2 abst / 1 ausente / 99,3% asistencia) + existing "Cómo votó" stacked bar. Semantic colors ONLY (`--color-favor`/`--color-contra`/`--color-abstencion`/`--color-ausente`, UI-SPEC §Color table) — never petróleo.
- **Lobby capa-1:** top-N materia horizontal bars using NEUTRAL `--muted-foreground`/border (petróleo reserved), + count.
- **Patrimonio capa-1:** per-declaration mini-column strip (counts only, NEVER montos — F46 rule), + "10 declaraciones · 2019–2026".
- **Tramitación stepper (proyecto):** see stepper assignment below.

**Copy the honest-omission idiom** from `estado-actual-block.tsx` (lines 19-29, 100-118): each derived field is optional; omit the line when the datum is not derivable; NEVER fabricate. Mirror `fechaValida` (lines 37-42) for any date rendering.

**Anti-CLS:** the Suspense skeletons must be reshaped to match the new capa-1 (see skeletons assignment).

---

### `app/lib/parlamentario-resumen-conteos.ts` (MODIFY — extend to expose votos breakdown)

**Analog:** itself (exact — extend `ConteoCarriles`, no new file, no new RPC).

**The rows are ALREADY read** at lines 135-159 (`votos_de_parlamentario`, `p_limit:1000`). Today only `votosTotal` + `asistencia` are returned. **Extend** to also return the seleccion breakdown for capa-1 figures:
```tsx
// rows already fetched (line 144-145); add breakdown alongside asistencia (line 152-159):
const conteos = { si: 0, no: 0, abstencion: 0, pareo: 0, ausente: 0 };
for (const v of votosRows) conteos[v.seleccion]++;   // same rows, no second read
// add `votosBreakdown: conteos` to the returned ConteoCarriles (lines 255-263)
```

**Constraints (LOCKED — keep the guard green):**
- Same RPC, same `p_limit:1000` — the WR-03 cap comment (lines 128-134) must stay byte-parity with `VotosSection` so chip/capa-1/section never desync.
- `import "server-only"` (line 1) stays — service key never reaches browser.
- NO new RPC, NO `.from(PII)`. `lockdown-guard.test.ts` Block B scans this module (Assumption A1, LOW risk).
- Lobby top-materias for capa-1 derive from the `lobby_de_parlamentario` rows ALREADY read (lines 165-175) — same rule.

---

### `app/app/parlamentario/[id]/page.tsx` (MODIFY — grid + rail + invert default)

**Analog:** itself (`CarrilesSection`, lines 182-280).

**Changes:**
1. Container widens `max-w-3xl` → `max-w-5xl` (line 116) for the rail (GlobalHeader is already `max-w-5xl`). Add grid `md:grid-cols-[13rem_1fr] gap-8 items-start` (geometry track, permitted — NOT an arbitrary color).
2. Render `<FichaRail>` (client island) in the rail column; counts from `contarCarrilesSeguro(id)` (line 189, already deduped via `cache()`).
3. **Invert `abrePorDefecto`** (lines 77-79): currently `estado.tipo === "dato"` auto-opens data carriles. Detail must start CLOSED. Either remove the heuristic (pass `defaultOpen={false}`) or repurpose it. Keep `conteoLabel` (lines 57-68) verbatim for the header count suffix.
4. Each carril keeps its own `<section id className="mt-12">` sibling (frontier LOCKED, lines 195-199 comment). Render capa-1 OUTSIDE the disclosure, wrap only the `*Section` in `<DetalleColapsable>` instead of `CarrilAccordion`.
5. Preserve the gate branches verbatim (cruces lines 268-280; money lines 282+).

**MEMORY gotcha (STATE):** `export const dynamic`/`force-dynamic` and gate-first ordering are load-bearing on gated routes — do not reorder the `notFound()`/gate/searchParams sequence (lines 111-113).

---

### `app/app/proyecto/[boletin]/page.tsx` (MODIFY — rail + stepper + grouped urgencia)

**Analogs:** `parlamentario` page (rail pattern, above) + `timeline-view.tsx` (urgencia grouping) + `estado-actual-block.tsx` (stepper derivation).

**Tramitación capa-1 = stepper — DON'T hand-roll grouping.** Reuse the EXISTING urgencia run-grouping in `timeline-view.tsx` verbatim:
- `esEventoUrgencia` (lines 43-48), `esRetiroUrgencia` (lines 56-58), `tipoUrgenciaKey` (lines 65-69), `construirItems` (lines 105-166), `paresDeUrgencia` (lines 172-178).
- It already collapses contiguous same-type urgencia runs ≥2 into one line ("N eventos ... ver todas" via `?urgencias=<id>`, lines 198-205, 251-267), excludes retiros, handles invalid dates (`fechaValida` lines 31-35). This is the "42 trámites de urgencia · ver todos" grouping — already built.
- Grouped-line copy per UI-SPEC: "{N} trámites de urgencia · ver todos" (neutral count).

**Stepper "¿Dónde está hoy?" — DON'T re-derive.** Elevate `EstadoActualBlock` (`estado-actual-block.tsx`): reuse `urgenciaVigente` (lines 51-74), `citacionVigente` (lines 100-118), and the `EstadoActual` optional-field shape (lines 19-29). KEY hitos always visible (ingreso, cambios de etapa/comisión, informes, votaciones con desenlace, urgencia vigente); repetitive urgencia grouped; full timeline = collapsed `<DetalleColapsable>`.

**Rail sections (UI-SPEC):** Dónde está / Tramitación / Votaciones / Lobby del período / Idea matriz / Similares. Lobby×tramitación name stays PLAIN non-linked (LOCKED 52-03).

**AGENTS.md HARD CONSTRAINT:** touching `searchParams`/routing here → read `node_modules/next/dist/docs/` first (`app/AGENTS.md`).

---

### `app/app/agenda/page.tsx` (MODIFY — día→comisión grouping + collapsible day)

**Analog:** itself — the day-grouping scaffolding already exists (`grupos` Map keyed by `fecha.slice(0,10)`, `<h3>` per día; search mode already groups by comisión).

**Change:** add a deeper comisión sub-group INSIDE each day, and wrap each day block in a collapsible (reuse `CarrilAccordion` whole-body collapse OR `DetalleColapsable` — day header is the trigger, so `CarrilAccordion` fits here). Cross-links to boletín intact. No new query (Assumption A4, LOW).

---

### `app/components/red/red-graph.tsx` + `app/app/red/page.tsx` (MODIFY — ego framing)

**Analog:** itself (exact).

**red-graph.tsx changes** (over the existing `<ReactFlow>` block, lines 293-309):
- Thread a new `seedId` prop into `RedGraphProps` (lines 74-77).
- Frame the ego neighborhood using the INSTALLED API `fitViewOptions.nodes` (VERIFIED `@xyflow/system@0.0.77`):
```tsx
const egoIds = [seedId, ...aristasVisibles.flatMap(a => [a.a, a.b])].filter(Boolean);
<ReactFlow
  fitView
  fitViewOptions={{ padding: 0.2, nodes: egoIds.map((id) => ({ id })), minZoom: 0.2 }}
  /* keep existing props: nodes, edges, nodeTypes, edgeTypes, proOptions */
/>
```
- Mark the seed node distinctly via `data.esSeed` in `NodoParlamentario` (sober border/emphasis, NON-ranking — anti-insinuación LOCKED, see the layout comment lines 95-114). The deterministic per-cámara grid layout (`posicion`, lines 104-114) stays — NEVER a physics sim.
- Keep the honest-empty states (lines 164-186, 277-281) and the mobile note (lines 287-290) intact.

**red/page.tsx changes:** pass `seedId` (the `?seed=` param, already parsed) into `<RedGraph seedId subgrafo />`. RPC `subgrafo_red(p_id, p_depth:1)` is ALREADY seed-scoped (Assumption A3, LOW) — this is client framing/marker only, no query change. `export const dynamic="force-dynamic"` and gate-first ordering are load-bearing (STATE gotcha) — do not touch.

**Usage-note copy (LOCKED, UI-SPEC):** seed → "Centrado en {nombre} y su vecindario inmediato."; no seed → "Mostrando toda la red. Abre una ficha y usa 'Ver relaciones' para centrar el grafo en un parlamentario."

---

### Token registration: `--accent-product-soft` (MODIFY `civic-tokens.css` + `globals.css`)

**Analog:** the identity-warn `@theme inline` block — `globals.css` lines 59-69 + `civic-tokens.css` lines 27-29 / 40-42.

**PITFALL 2 (research):** the sketch/UI-SPEC scrollspy-current uses `--color-primary-soft` (≈`hsl(183 30% 93%)`) which does NOT exist in the site tokens. Add a new `--accent-product-soft` following the identity-warn pattern EXACTLY.

**Step 1 — define the token as a COMPLETE `hsl()` value** in `civic-tokens.css` (mirror lines 27-29 for `:root`, 40-42 for dark):
```css
/* :root */   --accent-product-soft: hsl(183 30% 93%);
/* dark */    --accent-product-soft: hsl(183 30% 18%);  /* planner picks a dark-mode-legible value */
```

**Step 2 — register the Tailwind v4 utility** in `globals.css` inside the existing `@theme inline` block (lines 65-69), referenced WITHOUT a wrapping `hsl()` (Pitfall 4 / gotcha 54-04: double-`hsl()` = invalid color, silently dropped):
```css
@theme inline {
  --color-identity-warn-bg: var(--identity-warn-bg);
  /* ...existing... */
  --color-accent-product-soft: var(--accent-product-soft);  /* → utility bg-accent-product-soft */
}
```
This yields the flat utility `bg-accent-product-soft` (no arbitrary `bg-[hsl(var(--...))]`). Layout grid tracks like `md:grid-cols-[13rem_1fr]` are geometry, NOT colors → permitted.

---

### Tests (NEW + EXTEND)

**Analog:** `app/components/carril-accordion.test.tsx` (exact — island behavior + `forceMount` + source-scan no-leak).

**Copy the test shape** (`carril-accordion.test.tsx`):
- Fixture render with overrides (lines 11-25).
- `defaultOpen` open/closed → heading + `forceMount` body in DOM (Tests 1-2, lines 29-51); assert `aria-expanded`/`data-state`.
- Click trigger → state flips (Test 3, lines 53-63).
- **Source-scan no-leak** (Test 5, lines 74-85): `readFileSync(path.join(process.cwd(), "components", "<island>.tsx"))` then `expect(fuente).not.toMatch(/Section/)` / `/createServerSupabase/` / `/@\/lib\/supabase/`. Apply to `detalle-colapsable.tsx` AND `ficha-rail.tsx`.

**Wave 0 (NEW):**
- `components/detalle-colapsable.test.tsx` — default-CLOSED, toggle copy "Ver detalle (N)"↔"Ocultar detalle", `forceMount` SSR-in-DOM, source-scan.
- `components/ficha-rail.test.tsx` — one nav entry per PRESENT carril, honest 3-state count, gate-aware order, scrollspy-active marking (mirror `parlamentario-resumen.test.tsx`).
- `lib/use-scrollspy.test.ts` — mock IntersectionObserver → active id.
- `components/capa1/*.test.tsx` — capa-1 figures/mini-visuals match section aggregates (pure-view fixtures).

**EXTEND (existing):**
- `app/app/parlamentario/[id]/page.test.tsx` — UPDATE (old auto-open/accordion assertions will fail with inverted default).
- `timeline-view.test.tsx`, `estado-actual-block.test.tsx` — extend for stepper/capa-1.
- `red-graph.test.tsx`, `red/page.test.tsx` — extend for `seedId` + `fitViewOptions.nodes` + seed marker.
- `agenda/page.test.tsx` — día→comisión grouping + collapsible day.
- Per-component banned-vocab content-gates (`lobby-de-parlamentario.test.tsx`, `cruces-de-parlamentario.test.tsx`) — extend, don't weaken.

**Commands:** `cd app && pnpm test` (594 baseline green) + `pnpm tsc -b` (use `references` not `paths` — 43-DEBT gotcha) + `lib/lockdown-guard.test.ts` (7/7).

---

## Shared Patterns

### Pattern A — F45 no-leak client/server boundary (LOCKED, applies to EVERY new island)
**Source:** `carril-accordion.tsx` lines 8-19 (contract comment) + `carril-accordion.test.tsx` lines 74-85 (source-scan test).
**Apply to:** `detalle-colapsable.tsx`, `ficha-rail.tsx`, and the `red-graph.tsx` change.
Islands NEVER import a `*Section` or `@/lib/supabase`; server sections arrive as `children`; server data crosses as serializable props. `service_role` (Camino A) never reaches the browser. Enforced by the grep/source-scan test — keep green.

### Pattern B — pure-view / server-fetch split (applies to every capa-1 + rail data)
**Source:** `parlamentario-resumen.tsx` (`ResumenView` pure lines 61-107 / `ParlamentarioResumen` server lines 165-170); mirrored in `cruces-de-parlamentario.tsx` (`CrucesView`/`CrucesSection` lines 85-195) and `votos`/`lobby`.
**Apply to:** all `capa1/*.tsx` and the rail. Pure view = RTL fixtures, no Supabase runtime; server wrapper does the (deduped, `cache()`) read.

### Pattern C — 3-state honest count (never fabricate a digit)
**Source:** `parlamentario-resumen.tsx` `ChipConteo` (lines 34-52) + `conteoLabel` in page.tsx (lines 57-68) + `derivarEstado` in conteos lib (lines 84-94).
**Apply to:** rail nav counts, capa-1 count suffixes. `dato`→Mono number, `vacio`→"sin registros", `no_ingerido`→"—", `pendiente`→"pendiente". A real RPC error THROWS (#34); it never degrades to `vacio`.

### Pattern D — honest omission / no fabricated dates
**Source:** `estado-actual-block.tsx` (`fechaValida` lines 37-42, optional-field derivation lines 19-29, 100-118) + `timeline-view.tsx` (`fechaValida` lines 31-35, null-range on invalid dates lines 141-145, 198-205).
**Apply to:** stepper, capa-1 date/period rendering. Omit the line when not derivable; never render epoch/"ene 1970".

### Pattern E — anti-insinuación invariants (project-existential, LOCKED)
**Source:** `cruces-de-parlamentario.tsx` gate comment (lines 18-42), page.tsx `mt-12` frontier comments (lines 195-199, 212-216), `red-graph.tsx` layout comment (lines 34-47).
**Apply to:** ALL new copy + structure. Every domain carril = sibling `<section className="mt-12">`, never nested. Caveat anti-causal 1×/page (rail) + 1× cruces. Neutral counts, no ranking/score/verdict. Petróleo reserved for cruces + drill-down + scrollspy-current ONLY. No montos (F46), no rut/partido, contraparte names plain non-linked (52-03). banned-vocab negative-match stays green.

### Pattern F — Tailwind v4 token registration (no double-hsl)
**Source:** `globals.css` `@theme inline` (lines 59-69) + `civic-tokens.css` complete-hsl token defs (lines 27-29, 40-42).
**Apply to:** the new `--accent-product-soft`. Token = complete `hsl()`; `@theme inline` references it bare → flat utility. Never `bg-[hsl(var(--...))]`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/lib/use-scrollspy.ts` | hook (client) | event-driven | No IntersectionObserver hook exists in the repo yet. Greenfield, but fully specified by RESEARCH §Code Examples (lines 296-317) — native API, zero deps. Not a risk. |

*(The capa-1 mini-visuals are "new" as files but are pure CSS-on-tokens views with a strong pure-view analog — classified as role-match, not no-analog.)*

---

## Metadata

**Analog search scope:** `app/components/`, `app/lib/`, `app/app/parlamentario/[id]/`, `app/app/proyecto/[boletin]/`, `app/app/agenda/`, `app/app/red/`, `app/app/globals.css`, `app/app/styles/civic-tokens.css`.
**Files scanned (read in full or targeted):** 12 (carril-accordion, parlamentario-resumen, timeline-view, estado-actual-block, cruces-de-parlamentario, red-graph, parlamentario-resumen-conteos, parlamentario page.tsx, globals.css, civic-tokens.css, carril-accordion.test.tsx + Grep across app).
**Pattern extraction date:** 2026-07-07
