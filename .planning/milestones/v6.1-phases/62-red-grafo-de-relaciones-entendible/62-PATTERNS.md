# Phase 62: RED — Grafo de relaciones entendible - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 5 (4 modified, 1 out-of-band ops)
**Analogs found:** 5 / 5 (all in-file / same-surface — this is a refactor of shipped code)

> **Key framing:** This phase is a **presentation refactor of one client component** (`red-graph.tsx`) plus its CSS block, its tests, and copy. There is **no "new file with no analog"** — every target already exists in `app/components/red/` and `app/app/red/`, and the closest analog is almost always the *current version of the same file*. The patterns to copy are the anti-insinuación invariants, the xyflow-mock test harness, the provenance-in-DOM idiom, and the deploy/cold-read ops loop — all already shipped and tested.

---

## File Classification

| Target File | New/Modified | Role | Data Flow | Closest Analog | Match Quality |
|-------------|--------------|------|-----------|----------------|---------------|
| `app/components/red/red-graph.tsx` | **modified (primary)** | component (client island) | transform (subgrafo JSON → nodes/edges + layout geometry) | itself (current `posicion()` grid + filters + empty-state) | exact (same file) |
| `app/app/globals.css` (`.net-*` block, L134-316) | **modified** | config (stylesheet) | — (static styling) | itself + `civic-tokens.css` for cámara tokens | exact / role-match |
| `app/components/red/red-graph.test.tsx` | **modified** | test | request-response (render → assert DOM) | itself (xyflow mock + `data-x/data-y` assertions) | exact (same file) |
| `app/components/red/nodo-parlamentario.tsx` | modified (minor — cámara border cue) | component (client) | transform (data → DOM) | itself (`.net-nodo--seed` marker precedent) | exact (same file) |
| `app/components/red/arista-hecho.tsx` | modified (minor — per-pair aggregation) | component (client edge) | transform (edge data → label + provenance) | itself (`etiquetaHecho` + provenance dl) | exact (same file) |
| `app/app/red/page.tsx` | **mostly unchanged** (do not touch gate/dynamic/RPC) | route (Server Component) | request-response (gate → RPC → mount) | itself | exact (same file) |
| `red-evidence/` (BrowserOS captures) | new (ops artifact) | ops evidence | file-I/O (screenshots) | `61-*/comp-evidence/` (61-03 methodology) | role-match |

---

## Pattern Assignments

### `app/components/red/red-graph.tsx` (component / transform) — PRIMARY EDIT

**Analog:** itself (the shipped file). The refactor **replaces** the grid `posicion()` with radial geometry, **adds** the neighbor cap + "N vecinos más", and **adds** the móvil vecinos-list — reusing every surrounding idiom unchanged.

**Imports pattern to preserve** (L1-19) — client island header, xyflow style import, `formatNombre`/`safeExternalHref` reuse:
```typescript
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ReactFlow, ReactFlowProvider, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodoParlamentario, type NodoParlamentarioData } from "./nodo-parlamentario";
import { AristaHecho, type AristaHechoData } from "./arista-hecho";
// NEW for the cap/list: import { formatNombre } from "@/lib/format";  (already used in page.tsx + nodo)
```

**Anti-insinuación docblock to update, NOT delete** (L34-46): the LOCKED contract block currently says *"el layout es una rejilla determinista agrupada por cámara — NUNCA una simulación física"*. **Rewrite the layout clause** to describe the radial ego layout ("posición = orden alfabético en el anillo, no cercanía") while keeping the other four invariants byte-identical (node = identity only; edge = sourced typed fact; no aggregate co-occurrence measure; empty graph = honest state).

**Pattern being REPLACED — grid `posicion()`** (L112-122): the function to delete/replace with radial trig:
```typescript
function posicion(laneIndex: number, camara: string | null): { x: number; y: number } {
  const COL = 220; const ROW = 140;
  const fila = camara === "senado" ? 1 : 0; // banda por cámara
  const col = Math.floor(laneIndex / 3);
  const row = laneIndex % 3;
  return { x: col * COL, y: fila * ROW * 3 + row * ROW };
}
```
Replace with the radial `radialPos(index, total)` from RESEARCH.md Pattern 1 (seed at `{x:0,y:0}`, `theta = -π/2 + 2π·inRing/countInRing`, ring-1 R≈260 / ring-2 R≈460, `Math.round`). **Determinism invariant preserved:** position is a pure function of `(alphabetical index, neighbor count)` — no physics, no randomness (F18 LOCKED).

**Core transform pattern to copy — filter → visible-nodes → rfNodes mapping** (L156-230): the neighbor-cap logic slots INTO this exact pipeline. The `aristasVisibles` memo (L156-168), the `nodosVisiblesIds` set (L197-208), and the `rfNodes.map()` (L214-230) stay; insert between them the sorted+capped neighbor computation (RESEARCH.md "Building the capped, sorted neighbor list"):
```typescript
// After aristasVisibles, before rfNodes. Neighbors = other endpoint of every VISIBLE edge touching seed.
const seedNeighbors = useMemo(() => {
  const ids = new Set<string>();
  for (const a of aristasVisibles) {
    if (a.a === seedId) ids.add(a.b); else if (a.b === seedId) ids.add(a.a);
  }
  return nodos.filter((n) => ids.has(n.id))
    .sort((x, y) => formatNombre(x.nombre ?? x.id).localeCompare(formatNombre(y.nombre ?? y.id), "es"));
}, [aristasVisibles, nodos, seedId]);
const CAP = 24;
const rendered = seedNeighbors.slice(0, CAP);
const overflow = seedNeighbors.slice(CAP); // → "N vecinos más" list, each a <Link href={`/red?seed=${id}`}>
// DOM invariant (RED-01): visible .net-nodo count === rendered.length + 1 (seed)
```

**rfNodes/rfEdges mapping idiom to keep** (L214-259): node `data` carries `esSeed: seedId != null && n.id === seedId`; edge id is `` `${a.tipo}-${a.a}-${a.b}-${i}` ``. Keep the shape; only the `position` value changes (radial not grid) and the node set shrinks to `[seed, ...rendered]`.

**Empty-state early-return to keep byte-identical** (L172-194): `if (aristas.length === 0)` renders the honest "Aún no hay relaciones…" + single `<Link href="/parlamentarios">` — a test (F-03, test L334-347) asserts this string byte-for-byte and exactly 1 link. **Do not touch.**

**Leyenda block to REWRITE** (L263-286): currently three `<li>` describing the grid ("la proximidad visual no indica cercanía… el layout es una rejilla por cámara"). Replace the layout `<li>` with the UI-SPEC copy: *"La posición en el anillo es orden alfabético, no cercanía: el parlamentario elegido va al centro y sus vecinos se ordenan alfabéticamente alrededor. La distancia o el ángulo no indican afinidad ni relación entre las personas."* Keep the source line (Ley 20.730) unchanged.

**Filters block to keep intact** (L288-325): `.net-filtros` tipo checkboxes + desde/hasta date inputs — tests L503-508 assert they survive. Do not remove.

**Canvas mount + móvil note to REPLACE** (L334-359): the current band-aid note *"El grafo se lee mejor en pantalla ancha…"* (L337-340, `md:hidden`) is replaced by a **real vecinos-list** rendered `<768px`. Keep the `.net-lienzo mt-4 h-96 md:h-120` token classes (test L474-484 asserts these exact classes + no inline height) — wrap it in `hidden md:block` and add the list in a `md:hidden` sibling. Keep `fitView`, `minZoom={0.2}`, `proOptions={{ hideAttribution: true }}`.

---

### `app/app/globals.css` `.net-*` block (config / styling)

**Analog:** itself (L134-316) + `app/app/styles/civic-tokens.css` for the cámara border cue.

**Token-consumption idiom to copy** (L134-139) — Phase-19 tokens are RAW triplets consumed as `hsl(var(--token))`:
```css
.net-lienzo {
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--card));
}
```

**Seed marker precedent for the cámara border cue** (L226-229) — sober neutral border, NEVER petróleo:
```css
.net-nodo--seed {
  border-width: 2px;
  border-color: hsl(var(--foreground));
}
```
Add cámara cues (`.net-nodo--camara` / `.net-nodo--senado`, a 3px left border). **PITFALL (RESEARCH.md #2):** `civic-tokens.css` tokens are ALREADY-WRAPPED `hsl(...)` — consume them directly `border-left-color: var(--camara-muted)`, NOT `hsl(var(--camara-muted))` (double-wrap = invalid CSS). Available civic tokens: `--camara: hsl(213 94% 38%)`, `--camara-muted: hsl(213 60% 94%)`, `--senado: hsl(355 65% 38%)`, `--senado-muted: hsl(355 40% 94%)` — documented as institutional (NOT party) colors.

**Touch-target idiom to copy** (L166-191) — every interactive control gets `min-height: 2.75rem` (44px). Apply to the new "N vecinos más" expander and móvil list rows.

**Móvil media-query idiom to copy** (L197-207) — CSS-only compaction under `@media (max-width: 47.99rem)` (the `md` breakpoint = 768px). The móvil vecinos-list styling follows this pattern.

**Anti-pattern (from L246-250, LOCKED):** petróleo (`--accent-product`) is applied ONLY to `.net-arista__path` (edge stroke) and `.net-prov__enlace` (source links). NEVER to a node fill/border.

---

### `app/components/red/red-graph.test.tsx` (test)

**Analog:** itself. New tests follow the shipped xyflow-mock harness exactly.

**xyflow mock to reuse VERBATIM** (L37-104) — the `vi.mock("@xyflow/react", …)` double exposes per-node `data-x`/`data-y` and `data-fitview-nodes`; this is the ONLY way to assert layout in jsdom (PITFALL #3 — xyflow needs real DOM/ResizeObserver):
```typescript
nodes.map((n) => React.createElement("div", {
  key: n.id, "data-testid": `rf-node-${n.id}`,
  "data-x": String(n.position?.x), "data-y": String(n.position?.y),
}, React.createElement(nodeTypes[n.type], { data: n.data })))
```

**ResizeObserver shim to keep** (L25-33): `beforeAll` polyfills `globalThis.ResizeObserver`.

**Assertion idiom to copy for the NEW radial-determinism test** — replaces the grid "layout por carril" test (L393-427). The old test read `data-y` via `getByTestId('rf-node-<id>').getAttribute('data-y')`; the new one asserts radial positions are a pure function of alphabetical index (e.g. neighbor 0 at 12 o'clock ≈ `{x:0, y:-R}`), and that reordering the input array does not change any node's position (determinism).

**Node-count assertion for RED-01 (NEW):** count `.net-nodo` in the container ≤ `rendered.length + 1`. Reuse the `within(container).queryAllByTestId(/rf-node-/)` or `container.querySelectorAll(".net-nodo")` counting idiom.

**Banned-vocab scan to EXTEND** (L153-155) — currently scans node DOM for `/partido/i` and `/puntaje|score|ranking/i`; extend the same `container.textContent` scan to the rewritten leyenda copy (add `/afinidad|cercan[íi]a|aliado|red de poder/i` per UI-SPEC banned list, PITFALL #5).

**Tests to DELETE (deprecated by this phase):** "layout por carril" (L393-427) and the móvil-note tests (L486-501) — the grid and the band-aid note are gone.

---

### `app/components/red/nodo-parlamentario.tsx` (component — minor edit)

**Analog:** itself. Add the cámara border cue class; keep everything else.

**Class-selection idiom to copy** (L54-58): the seed already toggles a class conditionally —
```typescript
<div className={esSeed ? "net-nodo net-nodo--seed" : "net-nodo"} role="group"
     aria-label={`Parlamentario: ${nombreDisplay}${esSeed ? " (punto de partida)" : ""}`}>
```
Extend to append a cámara class (`net-nodo--camara` / `net-nodo--senado` from `data.camara`). **LOCKED:** projects ONLY `nombre` (via `formatNombre`, L48) + cámara label — never partido/face/RUT/badge. Keep the invisible `<Handle>` pattern (L60-65, L70-75, `isConnectable={false}`).

---

### `app/components/red/arista-hecho.tsx` (component — minor edit, only if pairs saturate)

**Analog:** itself. Add per-pair aggregation ("N hechos en común" / "ver los N registros") ONLY when a seed↔vecino pair shares >1 fact; single-fact pairs render inline as today.

**Provenance-in-DOM idiom to preserve VERBATIM** (L100-134, L159-163) — the `<dl className="net-prov">` (Fuente / Periodo / Registro / Licencia) is rendered BOTH inside the Radix tooltip AND directly in the DOM (`.net-arista__fuente`). Trazabilidad a la fuente is a rector principle, not hover-only. Tests L191-232 assert origen text, the `Ver fuente oficial` link (`target="_blank"`), and the licencia-only-if-present rule.

**Safe-href idiom to keep** (L17, L98): `safeExternalHref(data.enlace)` strips `javascript:`/dangerous schemes; test L234-244 asserts a `javascript:` enlace produces NO link. **Never bypass.**

**Fact-copy idiom to keep** (L63-73): `etiquetaHecho(tipo, contexto)` returns sober factual copy ("Ambos recibieron audiencia de {quien}") — never affinity/causal. The aggregated-edge copy ("{N} hechos en común") follows the same anti-insinuación voice.

---

### `app/app/red/page.tsx` (route — DO NOT alter the load-bearing parts)

**Analog:** itself. This file is **mostly unchanged**. The researcher recommends capping in the client, so `page.tsx` likely needs **zero edits**.

**LOCKED, DO NOT TOUCH:**
- `export const dynamic = "force-dynamic";` (L44) — removing it bakes the gate 404 at build time → 500 when flag ON (PITFALL #4).
- Gate order (L53-55): `if (!netPublicEnabled(process.env)) notFound();` as FIRST statement, before `await searchParams`.
- `PARLAMENTARIO_ID_RE.test(seed)` validation (L134-136) before any DB call (V5).
- `sb.rpc("subgrafo_red", { p_id: seed, p_depth: 1 })` (L140-143) — **no `p_limit`, no DDL, no depth change** (PITFALL #1: 136 nodes is genuine 1-hop, not a depth bug).
- No-seed JS-free selector (L69-131) — `<form method="get" action="/red">` with `<select name="seed">` optgrouped by cámara. Tests (`page.test.tsx` L100-129) assert this markup. Keep/enhance prominence only.
- Honest-degradation throws (L74-76, L149-151): a real RPC error THROWS, never degrades to empty.

---

## Shared Patterns

### Anti-insinuación (F18 LOCKED) — apply to ALL red/ files
**Source:** docblocks in `red-graph.tsx` L34-46, `arista-hecho.tsx` L27-33, `nodo-parlamentario.tsx` L13-20.
**Apply to:** every edit in `app/components/red/` + the leyenda copy.
- Node = public identity only (nombre + cámara). Never partido/face/RUT/score badge.
- Edge = sourced, typed, time-windowed fact. Copy describes the fact, never valuation/proximity/motive.
- Layout deterministic, position = alphabetical order, **never affinity** (radial replaces grid, invariant intact).
- Empty graph = honest state, never error.
- Provenance (fuente + ventana + enlace + licencia) always in the DOM, not hover-only.
- Petróleo (`--accent-product`) ONLY on edge stroke + provenance links, never on a node.

### Provenance-in-DOM + safe href — apply to edge/list rendering
**Source:** `arista-hecho.tsx` L100-163 (`net-prov` dl rendered twice) + `safeExternalHref` from `@/lib/utils` (L15).
**Apply to:** the desktop edges AND the new móvil vecinos-list rows (each row shows shared-fact summary + provenance, reusing `etiquetaHecho`/`ventanaTexto`/`net-prov`).

### xyflow-in-jsdom mock harness — apply to all new tests
**Source:** `red-graph.test.tsx` L25-104 (`ResizeObserver` shim + `vi.mock("@xyflow/react")` exposing `data-x`/`data-y`/`data-fitview-nodes`).
**Apply to:** radial-determinism test, node-count-cap test, móvil-list test. Never render the real xyflow canvas in jsdom.

### Name display casing — apply to node labels + list + sort
**Source:** `formatNombre` from `@/lib/format` (L173) — used in `nodo-parlamentario.tsx` L48 and `page.tsx` L109/L160.
**Apply to:** neighbor sort key (`localeCompare(..., "es")`), móvil list labels, "N vecinos más" names.

### BrowserOS cold-read loop + deploy runbook (RED-03) — ops, out-of-band
**Source:** `scripts/bros-cli.mjs` (header L1-28: hidden pages, absolute Windows path w/ forward slashes, wait 4-5s, `open`→parse `Page ID: N`, retry `cmd || (sleep 3; cmd)`) + `61-02-SUMMARY.md` deploy runbook.
**Apply to:** capture desktop+390px × seed+no-seed evidence into `62-.../red-evidence/`; deploy via **Docker `node:22-slim`** (NOT alpine — glibc/workerd), pre-copy source to `C:/Temp/obs-build` (OneDrive virtiofs bottleneck), deploy with **global wrangler 4.109.0** via `node "C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js" deploy --config wrangler.jsonc` from `app/`. CI path is blocked (CLOUDFLARE_API_TOKEN missing in Cuchecorp/gov-map).

---

## No Analog Found

None. Every target file already exists and is shipped; the closest analog is the current version of the same file (or a sibling in `app/components/red/`). This phase introduces **no new file type and no new library** — it refactors presentation inside one client island.

| File | Role | Data Flow | Reason analog is "self" |
|------|------|-----------|-------------------------|
| (all targets) | component/config/test/route | transform / styling / request-response | Refactor of shipped `/red` surface; patterns copied from the current file + siblings. |

---

## Metadata

**Analog search scope:** `app/components/red/`, `app/app/red/`, `app/app/globals.css`, `app/app/styles/civic-tokens.css`, `app/lib/{format,utils}.ts`, `scripts/bros-cli.mjs`, `.planning/milestones/v6.0-phases/61-*/61-02-SUMMARY.md`.
**Files scanned:** 9 (all shipped, verified on disk).
**Pattern extraction date:** 2026-07-09
