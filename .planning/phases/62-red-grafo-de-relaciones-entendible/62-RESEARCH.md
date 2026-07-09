# Phase 62: RED — Grafo de relaciones entendible - Research

**Researched:** 2026-07-09
**Domain:** Frontend graph visualization (@xyflow/react 12 client island) + deterministic radial layout math + BrowserOS cold-read validation loop
**Confidence:** HIGH (all findings verified against the shipped codebase; zero new packages)

## Summary

`/red` today renders ~136 crammed nodes because the server-side RPC `subgrafo_red(p_id, p_depth=1)` returns the seed's *entire* 1-hop neighborhood **plus every edge among those neighbors** (the `aristas` CTE selects any edge where both endpoints are in the node set, not only edges touching the seed). For a highly-connected seed like "Jorge Alessandri Vergara" that 1-hop set is genuinely ~135 people who share a lobby-contraparte with him. The `p_depth: 1` call is already correct — the graph is not accidentally fetching depth-2; the seed simply has that many direct neighbors. The current `posicion(laneIndex, camara)` grid packs them into two horizontal bands, which is illegible at that scale and produces the "franja apiñada" the operator screenshotted. `[VERIFIED: supabase/migrations/0030_net.sql L186-248, app/app/red/page.tsx L140-143]`

The fix lives **entirely in the client island** `app/components/red/red-graph.tsx` (plus its CSS block and the leyenda copy): (1) cap rendered neighbors at 24 in alphabetical order with an honest "N vecinos más" control, (2) replace the grid `posicion()` with a deterministic **ego-centric radial/orbital layout** (seed at center `(0,0)`, neighbors on ring(s) placed by `angle = 2π · (alphabeticalIndex / neighborCount)` starting at 12 o'clock), (3) degrade to a linked vecinos list below `md` (768px) instead of a shrunken ring, (4) rewrite the leyenda to describe the radial layout. Zero DDL, zero RPC changes, zero new packages — the CONTEXT/UI-SPEC already lock all of this. `[VERIFIED: 62-CONTEXT.md, 62-UI-SPEC.md, app/components/red/red-graph.tsx]`

Radial layout on top of `@xyflow/react` is done by computing `position: {x, y}` per node in plain JS (pure trigonometry) and passing it to `<ReactFlow>` — xyflow does NOT run any physics of its own; it renders nodes at the positions you give it. This is fully compatible with the F18 LOCKED invariant ("never a force-simulation"): the position is a pure function of `(alphabetical index, neighbor count)`, byte-identical every render. Validation is the Phase-61 BrowserOS loop (`scripts/bros-cli.mjs` → MCP 127.0.0.1:9200, hidden pages, save_screenshot before/after) plus the deploy runbook from 61-02 (Docker `node:22-slim` + global wrangler 4 OAuth).

**Primary recommendation:** Rewrite `posicion()` into a radial layout keyed on a pre-sorted, capped neighbor list computed inside `RedGraph`; add the "N vecinos más" expander and the `md`-breakpoint vecinos-list fallback; rewrite the leyenda; validate with the 61 BrowserOS loop and deploy with the 61-02 runbook. Everything is client-side TypeScript in one component + its CSS + copy.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ego-network derivation (seed + neighbors + edges) | Database / RPC (`subgrafo_red`, already shipped) | — | The RPC already returns the correct 1-hop data PII-safe; no change needed. The over-count is real data, not a query bug. |
| Neighbor cap (24) + honest truncation | Frontend Server (`page.tsx`) OR Client island | Client island | CONTEXT scopes this to `app/components/red/` (client). Capping client-side keeps the RPC untouched and the truncation count truthful. `[researcher]` recommend cap in the client so the full neighbor list is available for the "N más" list. |
| Radial layout geometry | Browser / Client (`red-graph.tsx`) | — | Pure `position:{x,y}` computed in JS and handed to xyflow; no server role. |
| Cámara distinction (border cue) | Browser / Client (node component + CSS) | — | Visual-only; institutional tokens already in `civic-tokens.css`. |
| Móvil vecinos-list fallback | Browser / Client (`red-graph.tsx` + CSS `md:` breakpoint) | — | Responsive rendering decision inside the island. |
| Leyenda rewrite | Browser / Client (copy in `red-graph.tsx`) | — | Static copy in the component. |
| Cold-read validation + deploy | Ops (`scripts/bros-cli.mjs`, 61-02 runbook) | — | Out-of-band tooling; no app-tier code. |

## Standard Stack

**No new packages this phase.** Every library is already installed and shipped in `app/`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@xyflow/react` | 12.11.0 `[VERIFIED: app/package.json]` | Client-island graph canvas (nodes/edges/fitView) | Already the graph renderer for `/red`; kept out of other route bundles as a client island. Renders nodes at positions you compute — no built-in physics. |
| `next` | 16.2.9 `[VERIFIED: app/package.json]` | App Router, Server Component `/red` page | Shipped. `searchParams` is a Promise (Next 16). `dynamic = "force-dynamic"` is load-bearing on `/red` (gate throws before first dynamic API). |
| `react` | 19.2.4 `[VERIFIED: app/package.json]` | UI | Shipped with Next 16. |
| `lucide-react` | ^1.20.0 `[VERIFIED: app/package.json]` | `Info` icon for provenance trigger | Already used in `arista-hecho.tsx`. |

> ⚠️ **AGENTS.md directive (app/):** "This is NOT the Next.js you know … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." Next 16 has breaking changes vs training data. Any Next-API touch (params, dynamic, metadata) must be checked against the installed docs, not from memory. `[CITED: app/AGENTS.md]`

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/ui/tooltip` (Radix via shadcn) | shipped | Edge provenance mirror | Already wired in `arista-hecho.tsx`; reuse as-is. |
| vitest + @testing-library/react | shipped | Component tests (jsdom, xyflow mocked) | The existing `red-graph.test.tsx` mocks `@xyflow/react` because xyflow needs real DOM/ResizeObserver. New layout/cap tests follow that mock pattern. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side neighbor cap | Add `p_limit` to `subgrafo_red` | Would require DDL (CONTEXT forbids: "cero DDL"). Reject. |
| Radial layout in xyflow node positions | A layout lib (dagre/elkjs) | Overkill + a new dependency; radial ego geometry is ~10 lines of trig. Reject. |
| Móvil shrunken ring | Vecinos list `[researcher]` | UI-SPEC decides: list is more honest + usable at 390px. Adopt list. |

**Installation:** none — `pnpm install` already satisfies all deps.

**Version verification:** `@xyflow/react@12.11.0`, `next@16.2.9`, `react@19.2.4`, `lucide-react@^1.20.0` all read directly from `app/package.json` on disk `[VERIFIED: app/package.json]`.

## Package Legitimacy Audit

> This phase installs **no external packages**. All libraries are pre-existing, shipped, and in daily production use. slopcheck/registry audit is **not applicable** — no install step exists.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none new) | — | N/A — reuses shipped `@xyflow/react`, `next`, `react`, `lucide-react`, Radix tooltip |

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs).
**Packages flagged as suspicious [SUS]:** none (no installs).

## Architecture Patterns

### System Architecture Diagram

```
                    /red?seed=<id>  (or /red with no seed)
                            │
                            ▼
      ┌─────────────────────────────────────────────┐
      │  app/app/red/page.tsx  (Server Component)     │
      │  1. netPublicEnabled(env)? → notFound() gate  │  ← LOCKED order, force-dynamic
      │  2. await searchParams  → seed?               │
      └───────────────┬─────────────────┬─────────────┘
              no seed │                 │ valid seed (PARLAMENTARIO_ID_RE)
                      ▼                 ▼
      ┌───────────────────────┐   ┌──────────────────────────────────┐
      │ JS-free <select> of    │   │ sb.rpc("subgrafo_red",            │
      │ parlamentarios          │   │   {p_id: seed, p_depth: 1})       │  ← unchanged RPC
      │ (parlamentarios_publico)│   │ returns {nodos[], aristas[]}      │     (PII-safe)
      │ → GET /red?seed=…       │   └───────────────┬──────────────────┘
      └───────────────────────┘                   │ subgrafo JSON
                                                    ▼
                          ┌───────────────────────────────────────────────┐
                          │  <RedGraph subgrafo={…} seedId={seed}/> (client)│  ← THE PHASE
                          │  ┌─────────────────────────────────────────┐   │
                          │  │ NEW: build neighbor list                │   │
                          │  │  • neighbors = 1-hop of seed (from edges)│   │
                          │  │  • sort alphabetical by display name     │   │
                          │  │  • cap at 24 → rendered[]; rest → "N más" │   │
                          │  │ NEW: radial layout                       │   │
                          │  │  • seed at (0,0)                          │   │
                          │  │  • pos(i,n) = (R·cos θ, R·sin θ),         │   │
                          │  │    θ = 2π·i/n from 12 o'clock            │   │
                          │  └──────────────┬──────────────────────────┘   │
                          │        ≥768px   │        <768px                 │
                          │           ▼     │           ▼                   │
                          │  ┌──────────────┐  ┌────────────────────────┐  │
                          │  │ <ReactFlow>  │  │ vecinos list (links to  │  │
                          │  │ radial nodes │  │ /red?seed=<neighbor>)   │  │
                          │  │ + edges      │  │ + shared-fact + prov    │  │
                          │  └──────────────┘  └────────────────────────┘  │
                          └───────────────────────────────────────────────┘
```

### Recommended Project Structure
```
app/
├── app/red/
│   ├── page.tsx           # Server Component — gate + RPC + mount (mostly unchanged;
│   │                      #   possibly move cap here if capping server-side [discretion])
│   └── not-found.tsx      # gate 404 (unchanged)
├── components/red/
│   ├── red-graph.tsx      # ★ PRIMARY EDIT: radial layout, neighbor cap, móvil list, leyenda
│   ├── nodo-parlamentario.tsx  # add cámara border cue (institutional token)
│   ├── arista-hecho.tsx   # add per-pair aggregation when a pair shares >1 fact
│   └── red-graph.test.tsx # ★ new tests: node-count ≤ cap+1, radial determinism, list fallback
└── app/globals.css        # ★ .net-* block: radial-friendly node sizing, cámara border, móvil list
```

### Pattern 1: Deterministic radial layout as pure xyflow node positions
**What:** xyflow renders each node at the `position:{x,y}` you supply — it runs no layout algorithm itself. Compute positions with trigonometry keyed on alphabetical index.
**When to use:** Ego-network with one center + a ring of ordered neighbors.
**Example:**
```typescript
// Pure function — no physics, no randomness (F18 LOCKED). Byte-identical per neighbor set.
// Source: pattern from @xyflow/react docs (nodes take explicit position); trig is standard.
const RING1_R = 260; // px inside SVG canvas (NOT the 4px page scale — UI-SPEC)
const RING2_R = 460;
const CAP = 24;

function radialPos(index: number, total: number): { x: number; y: number } {
  const perRing = 12;                    // ring-1 capacity before overflow to ring-2
  const ring = index < perRing ? 0 : 1;
  const R = ring === 0 ? RING1_R : RING2_R;
  const inRing = ring === 0 ? index : index - perRing;
  const countInRing = ring === 0 ? Math.min(total, perRing) : total - perRing;
  // 12 o'clock start (−90°), clockwise. Alphabetical order → neutral, declared.
  const theta = -Math.PI / 2 + (2 * Math.PI * inRing) / Math.max(countInRing, 1);
  return { x: Math.round(R * Math.cos(theta)), y: Math.round(R * Math.sin(theta)) };
}
// seed node: position {x:0,y:0}, esSeed:true
// neighbors: sort by formatNombre(nombre) alpha, slice(0,CAP), map with radialPos(i, rendered.length)
```
This replaces `posicion(laneIndex, camara)` (`red-graph.tsx` ~L112). Cámara is conveyed by node **border**, never by ring position (F18). `[VERIFIED: current posicion() at app/components/red/red-graph.tsx L112-122]`

### Pattern 2: Honest neighbor cap + "N vecinos más"
**What:** Render ≤24 alphabetical neighbors; if `directNeighbors > 24`, show a non-hover control listing the remaining names, each a `<Link href="/red?seed=<id>">`.
**When to use:** Always when the seed's 1-hop set exceeds the cap (the Alessandri case).
**Key rule:** Visible `.net-nodo` count MUST be ≤ `renderedNeighbors + 1`. This is the RED-01 acceptance assertion, checkable by counting `.net-nodo` in the DOM. `[CITED: 62-UI-SPEC.md §Cap + honest truncation]`

### Pattern 3: Móvil vecinos-list (not a shrunken ring)
**What:** Below `md` (768px), render a heading + a linked list of direct neighbors (name, cámara, shared-fact summary + provenance) instead of the SVG canvas.
**When to use:** `<768px`. Keep the desktop radial for `≥768px`. Replaces the current band-aid note "El grafo se lee mejor en pantalla ancha…". `[CITED: 62-UI-SPEC.md §Móvil 390px]`

### Anti-Patterns to Avoid
- **Force-simulation / physics layout** (dagre force, d3-force, xyflow auto-layout): violates F18 LOCKED — position would read as affinity. NEVER.
- **Ordering neighbors by edge weight / co-occurrence count:** implies importance. Order is **alphabetical only**, and the leyenda must say so.
- **Petróleo (`--accent-product`) on a node fill/border:** reads as a ranked person. Accent is reserved for edges + provenance links only. `[CITED: 62-UI-SPEC.md §Anti-insinuación color rule]`
- **Silently dropping neighbors past the cap:** the "N vecinos más" count must be truthful (`total − rendered`).
- **Hardcoding node positions with `style`/arbitrary `[Npx]` for canvas height:** existing tests assert `.net-lienzo` uses token classes `h-96 md:h-120` with no inline height. Keep that. `[VERIFIED: red-graph.test.tsx L474-484]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ego-network derivation (seed + 1-hop + edges) | A new query / client-side graph walk | Shipped `subgrafo_red` RPC (`p_depth:1`) | Already PII-safe, depth-clamped, provenance-inline. It returns the right data; the fix is presentation, not derivation. `[VERIFIED: 0030_net.sql]` |
| Graph canvas / edges / fitView | A custom SVG renderer | `@xyflow/react` (shipped) | Already handles pan/zoom/edge routing/labels; you only supply node positions. |
| Edge provenance tooltip | New tooltip | `@/components/ui/tooltip` + `arista-hecho.tsx` | Provenance-in-DOM pattern already shipped and tested. |
| Cámara institutional colors | New hex values | `--camara` / `--senado` tokens in `civic-tokens.css` | Already defined as institutional (NOT party) colors, with a documented header. `[VERIFIED: app/app/styles/civic-tokens.css]` |
| Name display casing | Ad-hoc formatting | `formatNombre` from `@/lib/format` | Already used for node labels + the seed subline. |

**Key insight:** This phase is a **presentation refactor of one client component**. The hard parts (PII-safe derivation, provenance, gating, name formatting) are all shipped and tested. Do not reach for new libraries or touch the RPC/DB.

## Runtime State Inventory

> Rename/refactor/migration inventory. This phase is a **UI refactor** (client component + CSS + copy), not a rename. Categories below verified explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no data written. `arista` (7.394 rows) and `entidad`/`parlamentario` are read-only via `subgrafo_red`; no schema/key touched. `[VERIFIED: CONTEXT "cero DDL … las aristas ya existen: 7.394 en arista"]` | none |
| Live service config | **None** — no external service config. `netPublicEnabled` gate flag is human-gated (F17) and NOT flipped by this phase. `[VERIFIED: CONTEXT "Cero flags"]` | none |
| OS-registered state | **None** — no cron/task/scheduler changes. | none |
| Secrets/env vars | **None** — no new env vars. `NET_PUBLIC_ENABLED` read via `netPublicEnabled`, unchanged. | none |
| Build artifacts | **Deploy artifact only:** `.open-next` rebuilt on deploy (61-02 runbook). No stale package/egg-info. `[VERIFIED: 61-02-SUMMARY.md]` | rebuild on deploy (standard) |

**Nothing found in Stored data / Live service config / OS state / Secrets:** verified against CONTEXT ("cero DDL, cero flags") and the read-only RPC path.

## Common Pitfalls

### Pitfall 1: Assuming `p_depth:1` is the bug (it isn't)
**What goes wrong:** Someone "fixes" the RPC call thinking depth is wrong. It's already 1.
**Why it happens:** The ~136 nodes look like depth-2 sprawl, but they're the seed's genuine 1-hop lobby-contraparte neighbors, plus the RPC's `aristas` CTE also returns edges *between neighbors* (both endpoints in the node set).
**How to avoid:** The fix is the **cap + layout**, not the query. Confirm by reading `subgrafo_red` (both endpoints in `nodos` → neighbor-to-neighbor edges included). `[VERIFIED: 0030_net.sql L216-222]`
**Warning signs:** A plan task that edits `page.tsx`'s `p_depth` or adds `p_limit` (DDL — forbidden).

### Pitfall 2: `civic-tokens.css` tokens are full `hsl(...)`, not raw triplets
**What goes wrong:** Writing `hsl(var(--camara-muted))` produces invalid CSS (double-wrapped `hsl(hsl(...))`).
**Why it happens:** Phase-19 tokens in `globals.css` are raw triplets consumed as `hsl(var(--token))`, but `civic-tokens.css` defines `--camara-muted: hsl(213 60% 94%)` already wrapped.
**How to avoid:** Consume civic tokens directly: `border-left-color: var(--camara-muted)`. `[VERIFIED: civic-tokens.css L1-20 vs globals.css var(--border) usage]`
**Warning signs:** Cámara border renders transparent/black in the browser.

### Pitfall 3: xyflow needs real DOM — jsdom tests must mock it
**What goes wrong:** New layout tests crash because xyflow uses ResizeObserver and measures the DOM (no real layout in jsdom).
**Why it happens:** xyflow's canvas doesn't run in jsdom.
**How to avoid:** Follow the existing `vi.mock("@xyflow/react", …)` in `red-graph.test.tsx` — the mock exposes `data-x`/`data-y` per node and `data-fitview-nodes`, so you can assert radial positions + node count deterministically. `[VERIFIED: red-graph.test.tsx L37-104]`
**Warning signs:** `ResizeObserver is not defined` or empty canvas in tests.

### Pitfall 4: `dynamic = "force-dynamic"` on `/red` is load-bearing
**What goes wrong:** Removing it bakes the gate `notFound()` at build time (flag OFF in the container) → 500 in all branches when the flag is ON at runtime.
**Why it happens:** `/red`'s gate throws before the first dynamic API (searchParams), so Next would classify it static.
**How to avoid:** Do not touch `export const dynamic = "force-dynamic"` in `page.tsx`. `[VERIFIED: app/app/red/page.tsx L38-44]`
**Warning signs:** `/red` returns 500 after deploy.

### Pitfall 5: Banned-vocab regression in the rewritten leyenda
**What goes wrong:** The radial leyenda rewrite introduces "cercanía", "afinidad", "vinculado a", etc.
**Why it happens:** Describing a ring naturally tempts closeness language.
**How to avoid:** The leyenda MUST state "la posición en el anillo es orden alfabético, no cercanía". Tests scan node/edge DOM for banned terms (`/puntaje|score|ranking/i`, `/partido/i`); extend the scan to the leyenda copy. Locked banned list in UI-SPEC §Copywriting. `[VERIFIED: red-graph.test.tsx L154-155; CITED: 62-UI-SPEC.md §Banned vocabulary]`

## Code Examples

### Building the capped, sorted neighbor list (client, in RedGraph)
```typescript
// Neighbors = the other endpoint of every VISIBLE edge touching the seed.
// (subgrafo also contains neighbor↔neighbor edges; those are NOT new neighbors of the seed.)
const seedNeighbors = useMemo(() => {
  const ids = new Set<string>();
  for (const a of aristasVisibles) {
    if (a.a === seedId) ids.add(a.b);
    else if (a.b === seedId) ids.add(a.a);
  }
  return nodos
    .filter((n) => ids.has(n.id))
    .sort((x, y) =>
      formatNombre(x.nombre ?? x.id).localeCompare(
        formatNombre(y.nombre ?? y.id), "es",
      ),
    );
}, [aristasVisibles, nodos, seedId]);

const CAP = 24;
const rendered = seedNeighbors.slice(0, CAP);
const overflow = seedNeighbors.slice(CAP); // → "N vecinos más" list, each a Link to /red?seed=id
// DOM invariant (RED-01): visible .net-nodo count === rendered.length + 1 (seed)
```
> Note: this assumes the ego is rendered from the seed's direct edges. If the plan chooses to keep drawing neighbor↔neighbor edges, they stay among the *rendered* nodes only — never re-introduce dropped neighbors. `[VERIFIED: existing aristasVisibles + nodosVisibles logic, red-graph.tsx L156-208]`

### BrowserOS cold-read capture (RED-03 gate)
```bash
# 61-pattern: hidden pages, absolute Windows path w/ forward slashes, wait 4-5s, retry once.
# Source: scripts/bros-cli.mjs header + 61-03-SUMMARY.md
PID=$(node scripts/bros-cli.mjs open "https://observatorio-congreso.thevalis.workers.dev/red?seed=<id>" \
      | grep -oE "Page ID: [0-9]+" | grep -oE "[0-9]+")
sleep 5
node scripts/bros-cli.mjs shot "$PID" "C:/…/62-…/red-evidence/red-seed-desktop-despues.png" \
  || (sleep 3; node scripts/bros-cli.mjs shot "$PID" "C:/…/red-seed-desktop-despues.png")
node scripts/bros-cli.mjs close "$PID"
# Repeat: with seed / no seed × desktop / 390px. "antes" = operator screenshot (already exists).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Grid layout `posicion(laneIndex, camara)` (two horizontal cámara bands) | Ego-centric radial (seed center + alphabetical ring) | This phase (62) | Legible at ≤24 nodes; still F18-compliant (deterministic, order=alphabetical). |
| `fitViewOptions.nodes` ego-framing on top of the full grid (55-05) | True ego subgraph rendered (cap + radial) | This phase | The 55-05 fitView zoom was a partial fix (framed the ego but still mounted 136 nodes). Now the DOM itself is capped. |
| Móvil note "se lee mejor en pantalla ancha" (band-aid) | Vecinos list `<768px` | This phase | Honest, usable at 390px. |

**Deprecated/outdated:**
- `posicion(laneIndex, camara)` grid function — replaced by radial. Its determinism test (`red-graph.test.tsx L393-427, "layout por carril"`) will be replaced by a radial-determinism test.
- The móvil note text + its test (`L486-501`) — replaced by the vecinos-list assertions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The seed's genuine 1-hop count for Alessandri is ~135 (not a depth bug). Inferred from the RPC CTE + operator screenshot; not run against live DB in this session. | Summary / Pitfall 1 | Low — even if the exact count differs, the cap+radial fix is correct for any large 1-hop set. |
| A2 | Ring-1 capacity ~12 and cap 24 keep 160px nodes non-overlapping at `RING1_R≈260` / `RING2_R≈460`. Geometry is `[researcher]`-estimated in UI-SPEC, not pixel-measured. | Pattern 1 | Medium — may need tuning during the BrowserOS loop; that loop is exactly the tuning mechanism. Adjust radius/cap, never shrink 14px name below the floor. |
| A3 | Móvil breakpoint = `md` (768px) is the right cut for switching to the list. | Pattern 3 | Low — UI-SPEC locks 768px; consistent with existing `md:` usage. |

## Open Questions

1. **Cap the neighbor list in the client or in `page.tsx`?**
   - What we know: CONTEXT scopes edits to `app/components/red/`; the full neighbor set is needed for the "N más" list.
   - What's unclear: whether the planner prefers capping server-side (smaller client payload) vs client-side (simpler, all data present).
   - Recommendation: **client-side cap** — keeps the RPC untouched, gives the "N más" list its names for free, and stays inside the CONTEXT-scoped component. `[researcher]`

2. **Do we still draw neighbor↔neighbor edges, or only seed↔neighbor?**
   - What we know: the RPC returns both; showing only seed↔neighbor edges is the cleanest ego-star and matches "vecinos directos".
   - What's unclear: whether operator wants to see that two neighbors also share a contraparte.
   - Recommendation: render **seed↔neighbor edges** as the primary star; treat neighbor↔neighbor edges as out of scope for the legibility fix (they re-crowd the ring). Confirm in plan/cold-read. `[researcher]`

3. **Móvil 390px "before" evidence** — the operator screenshot is desktop-with-seed. A 390px "antes" may not exist.
   - Recommendation: capture a fresh 390px "antes" from the current live `/red?seed=<id>` before deploying the fix, so RED-03 has a true before/after pair on móvil too.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| BrowserOS MCP (127.0.0.1:9200) | RED-03 cold-read loop | ✓ (per 61) `[CITED: 61-03-SUMMARY.md, scripts/bros-cli.mjs]` | desktop app | Manual screenshots if MCP down |
| `scripts/bros-cli.mjs` | screenshot capture | ✓ | in-repo | — |
| Docker + `node:22-slim` | deploy build | ✓ (per 61-02) | 22-slim | GitHub Actions (blocked: CF token secret missing) |
| global wrangler 4 (OAuth) | deploy | ✓ (per 61-02) | 4.109.0 | — |
| Supabase RPC `subgrafo_red` | data (read-only) | ✓ (shipped, live) | 0030 migration | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** GitHub Actions deploy path (CF token secret not set in Cuchecorp/gov-map) → use local Docker + global wrangler per 61-02 runbook. `[VERIFIED: 61-02-SUMMARY.md L73-100]`

## Validation Architecture

> `workflow.nyquist_validation` not disabled → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (`vitest run`) + @testing-library/react (jsdom) `[VERIFIED: app/package.json scripts.test]` |
| Config file | app-level vitest config (existing; `red-graph.test.tsx` runs today) |
| Quick run command | `pnpm --filter ./app test` (or `pnpm test` from `app/` = `vitest run`) |
| Full suite command | `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test` (root `test` script) |
| Typecheck | `pnpm --filter ./app typecheck` (`tsc --noEmit`) |
| Build | `pnpm --filter ./app build` (`next build`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RED-01 | With seed, visible `.net-nodo` count ≤ renderedNeighbors+1 (never ~136); "N vecinos más" when >24 | unit | `pnpm --filter ./app test red-graph` | ✅ extend `red-graph.test.tsx` |
| RED-01 | No-seed state shows selector, never a graph | unit | `pnpm --filter ./app test red` (page test) | ✅ `app/app/red/page.test.tsx` (verify/extend) |
| RED-02 | Radial layout deterministic + alphabetical (assert `data-x`/`data-y` positions via xyflow mock) | unit | `pnpm --filter ./app test red-graph` | ✅ replace "layout por carril" test |
| RED-02 | Móvil `<768px` renders vecinos list (links), not canvas | unit | `pnpm --filter ./app test red-graph` | ❌ Wave 0 — new test |
| RED-02 | Leyenda states "orden alfabético, no cercanía"; banned-vocab scan green | unit | `pnpm --filter ./app test red-graph` | ✅ extend banned-vocab assertion |
| RED-03 | Cold-read "comprensible" desktop+390px, seed+no-seed | manual (BrowserOS) | `node scripts/bros-cli.mjs …` → evidence in `red-evidence/` | manual-only (gate) |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test red-graph` (fast, single-file).
- **Per wave merge:** `pnpm --filter ./app test && pnpm --filter ./app typecheck`.
- **Phase gate:** full suite green + `next build` green + RED-03 cold-read verdict "comprensible" with before/after evidence archived, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `red-graph.test.tsx` — new radial-determinism test (positions are a pure function of alphabetical index; replaces the grid "layout por carril" test).
- [ ] `red-graph.test.tsx` — RED-01 node-count assertion (`.net-nodo` ≤ cap+1; overflow → "N vecinos más" honest count).
- [ ] `red-graph.test.tsx` — móvil vecinos-list test (list of links `<768px`, no canvas).
- [ ] `red-graph.test.tsx` — extend banned-vocab scan to the rewritten leyenda copy.
- [ ] Framework install: none — vitest + RTL already run this file.

## Security Domain

> `security_enforcement` not explicitly `false` → included. This phase is **client-side presentation only**, read-only data, no auth/session/crypto surface. Most ASVS categories N/A.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | RPC is anon-granted, PII-safe by design (0030); no auth touched. |
| V3 Session Management | no | No sessions on `/red`. |
| V4 Access Control | yes (inherited) | `netPublicEnabled` gate (F17 human-gated) + `subgrafo_red` deny-by-default emitting only id/nombre/camara. **Do not weaken.** `[VERIFIED: 0030_net.sql, page.tsx gate]` |
| V5 Input Validation | yes | `PARLAMENTARIO_ID_RE.test(seed)` before any DB call (already shipped); external hrefs via `safeExternalHref` (already shipped in `arista-hecho.tsx`). Preserve both. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leak (partido/rut/email) into node DOM | Information Disclosure | Node projects only nombre+cámara; RPC never emits PII (mirror 0019/0020). Keep node component projecting only public identity. `[VERIFIED: nodo-parlamentario.tsx]` |
| Malicious `enlace` (javascript:) in edge provenance | Tampering/XSS | `safeExternalHref` strips dangerous schemes; tested (`red-graph.test.tsx L234-244`). Do not bypass. |
| Node enumeration via seedless whole-graph | Information Disclosure | No seedless variant; RPC requires `p_id` (WR-03 mirror). Do not add one. |
| Anti-insinuación / defamation-by-layout | (project-specific) | Deterministic alphabetical layout, no affinity, provenance-in-DOM, banned-vocab scan. F18 + 17-LEGAL-DOSSIER. |

## Project Constraints (from CLAUDE.md)

- **Anti-insinuación LOCKED (F18):** deterministic layout, position never encodes affinity; node = public identity only (no partido/face/score); edge = sourced, typed, time-windowed fact; empty graph = honest state; provenance always in DOM. **Never violate.**
- **Server-only external calls:** `/red` reads Supabase server-side; the client island receives already-fetched JSON. No source/DB calls from the browser.
- **Trazabilidad a la fuente:** every datum carries fuente + fecha + enlace (already in `arista-hecho.tsx`).
- **GSD workflow:** edits go through the phase execution flow; no direct edits outside GSD.
- **`app/AGENTS.md`:** Next 16 differs from training data — read `node_modules/next/dist/docs/` before any Next-API code.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Scope: only `/red` surface (`app/components/red/`, page `/red`). **Cero DDL** (7.394 aristas already exist), cero changes to the NET materializer. RED-01/02/03 only.
- **Ego-network real:** server delivers seed + direct neighbors + edges among them; **hard cap** on rendered neighbors (e.g. 24) ordered by a NEUTRAL, DECLARED criterion (alphabetical; never "peso"/weight without explanation) + honest "N vecinos más".
- **Radial ego-centric deterministic layout:** seed center, neighbors in alphabetical clockwise ring; cámara distinguished by node shape/border, not position. Legend states explicitly "la posición en el anillo es orden alfabético, no cercanía".
- **Sin seed:** no full graph — orienting state: brief explanation + prominent parlamentario selector (the JS-free B20/B21 selector is preserved/enhanced).
- **Móvil 390px:** ring scales or degrades to vecinos list with links (decide in plan; list is acceptable and perhaps more honest).
- **Aristas:** on tap/hover keep hecho+fuente+ventana (`arista-hecho.tsx`); if seed↔vecino edge volume saturates, aggregate per pair (one line = N hechos, "ver los N registros").
- **Legend "Cómo leer este grafo" REWRITTEN** for the new layout.
- **Gate (RED-03):** BrowserOS loop of F61 — before captures (operator screenshot = "antes"), fixes, deploy (61-02 runbook: node:22-slim, C:/Temp, wrangler global), re-capture desktop+390px with seed and without seed, cold read → "comprensible". Evidence in `62-*/red-evidence/`.
- **Hard limits:** zero force-simulation / zero affinity implication (F18 LOCKED). Zero DDL. Zero flags. Anti-insinuación intact (banned-vocab green). Suite+tsc+build green.

### Claude's Discretion
- Radius/rings, exact neighbor cap, how to distinguish cámaras, whether móvil uses a reduced ring or a list.

### Deferred Ideas (OUT OF SCOPE)
- More relation types (co-authorship of mociones now that `proyecto_autor` exists — natural future edge, NOT this phase).
- 2+-hop paths / free graph exploration.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RED-01 | `/red` with seed shows ONLY the real ego-network (seed + direct neighbors, edges among them), never ~136 crammed nodes. No seed: orienting state (explanation + prominent selector), never the full graph. | Client-side neighbor cap (24, alphabetical) in `RedGraph` (Pattern 2); no-seed selector already shipped in `page.tsx` L69-131. DOM invariant `.net-nodo ≤ cap+1` is the acceptance test. |
| RED-02 | Legible deterministic layout that does not imply affinity (F18 never force-sim): radial ego-centric, alphabetical ring, labels legible without zoom, honest "ver más", usable at 390px; legend updated. | Radial `position:{x,y}` math (Pattern 1); móvil vecinos-list (Pattern 3); cámara-border cue via `civic-tokens.css`; leyenda rewrite (banned-vocab scan). |
| RED-03 | BrowserOS cold read (F61: capture→fix→re-capture, desktop+390px) → "comprensible" with seed and without; before/after evidence archived. | `scripts/bros-cli.mjs` loop (Code Examples) + 61-02 deploy runbook; evidence dir `red-evidence/`. |

## Sources

### Primary (HIGH confidence)
- `app/components/red/red-graph.tsx` — current `posicion()` grid, filters, ego-framing, empty state, móvil note.
- `app/app/red/page.tsx` — gate, `subgrafo_red(p_depth:1)` call, no-seed selector.
- `app/components/red/nodo-parlamentario.tsx`, `arista-hecho.tsx` — node/edge contracts, provenance, `safeExternalHref`.
- `app/components/red/red-graph.test.tsx` — xyflow mock pattern, layout/filter/empty-state/ego tests, banned-vocab assertions.
- `supabase/migrations/0030_net.sql` L186-254 — `subgrafo_red` CTE (both-endpoints edge selection, PII-safe projection, anon grant).
- `app/app/globals.css` L134-316 — `.net-*` block.
- `app/app/styles/civic-tokens.css` — `--camara`/`--senado` institutional tokens (full `hsl(...)`).
- `app/package.json` — `@xyflow/react@12.11.0`, `next@16.2.9`, `react@19.2.4`, scripts.
- `scripts/bros-cli.mjs` — BrowserOS MCP wrapper, gotchas.
- `.planning/milestones/v6.0-phases/61-…/61-02-SUMMARY.md` — deploy runbook (Docker node:22-slim, wrangler 4 global OAuth, CI blocked).
- `.planning/milestones/v6.0-phases/61-…/61-03-SUMMARY.md` — BrowserOS cold-read methodology + evidence layout.
- `62-CONTEXT.md`, `62-UI-SPEC.md` — locked decisions + design contract.

### Secondary (MEDIUM confidence)
- `@xyflow/react` node-position model (nodes render at supplied `position`; no built-in physics) — consistent with the shipped usage; standard xyflow behavior.

### Tertiary (LOW confidence)
- Radius/cap geometry (`RING1_R≈260`, cap 24, ring-1 ≈12) — `[researcher]` estimates from UI-SPEC; to be tuned in the BrowserOS loop.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read from `app/package.json`; no new packages.
- Architecture: HIGH — root cause (`subgrafo_red` both-endpoints + genuine 1-hop size) verified in SQL; fix scope verified against CONTEXT/UI-SPEC.
- Pitfalls: HIGH — each pitfall traced to a specific shipped file/line.
- Layout geometry: MEDIUM — trig is standard; exact radius/cap tuned during cold-read loop.

**Research date:** 2026-07-09
**Valid until:** 2026-08-08 (stable — internal codebase; no fast-moving external deps introduced)
