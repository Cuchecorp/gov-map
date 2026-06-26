# Phase 46: VIZ — Chart de patrimonio (conteo de ítems por año) - Research

**Researched:** 2026-06-26
**Domain:** Data visualization (Recharts) inside a Next.js 16 App Router server tree, deployed via OpenNext → Cloudflare Workers, under the Camino A lockdown.
**Confidence:** HIGH

## Summary

This phase adds ONE descriptive bar chart inside the existing patrimonio accordion of `/parlamentario/[id]`: a per-year COUNT of declared items (bienes/pasivos/inmuebles/…), grouped by `tipo_bien`, labeled by `declaracion.tipo` (declaration version), keyed on `declaracion.fecha_presentacion`. It graphs **counts, never montos** (montos are CPLT URIs `datos.cplt.cl/.../moneda_*`, not numbers — a separate ingestion gap). The library is Recharts; it is NOT yet installed.

The work is unusually low-risk because the codebase already ships a heavier DOM-measuring client-viz library — `@xyflow/react` 12.11.0 (React Flow, ~1.2 MB) — as a `"use client"` island on `/red`, built and deployed through the exact same OpenNext → Cloudflare path. That is a proven precedent: a client-only viz island does not enter the server/worker bundle, and the existing jsdom test strategy for it (mock the DOM-measuring lib) transfers directly to Recharts' `ResponsiveContainer`. Additionally, `PatrimonioSection` **already fetches both required RPCs** (`declaraciones_de_parlamentario` + `bienes_de_parlamentario`) and assembles a per-version `DeclaracionVersionRow[]` (`todas`) that carries `tipo`, `fecha_presentacion`, and `bienes: BienRpcRow[]`. The chart's count series can be derived from that already-fetched data with **zero new queries and zero new RPCs**, so the lockdown guard stays green by construction.

**Primary recommendation:** `pnpm add recharts` (v3.9.0). Add a pure server-side transform `seriePatrimonio(versiones) → SeriePunto[]` (plain serializable array of `{ anio, tipo_declaracion, <tipo_bien counts> }`), and a thin `"use client"` island `patrimonio-chart.tsx` that renders a **stacked `BarChart`** (discrete bars per declaration, NOT a connected line/area — a line across incomparable declaration versions would visually insinuate a wealth "trend"). Wrap it in a server-rendered shell that carries the montos caveat, the `<2 declaraciones` degrade, and the CC BY 4.0 footer. Test the pure transform + the shell copy directly; mock Recharts in jsdom; mark the OpenNext/Cloudflare Docker build as an operator checkpoint.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch declaraciones + bienes | API / Backend (Supabase RPC, security definer) | — | Already done by `PatrimonioSection`; PII-safe allowlisted RPCs |
| Aggregate counts → series | Frontend Server (RSC, server-only) | — | Pure transform over already-fetched data; keeps SVG lib off the server-data path and the data shape serializable |
| Render chart (SVG, axes, tooltip, ResponsiveContainer) | Browser / Client (`"use client"` island) | — | Recharts measures the DOM; must run client-side. Mirrors `@xyflow/react` island on `/red` |
| Caveat / degrade / source footer | Frontend Server (RSC shell around the island) | — | Plain text/HTML; keeps neutral copy server-rendered and grep-testable without the SVG |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | 3.9.0 | The single chart library for v5 standard charts (bar/area). | `[CITED: CLAUDE.md "Recharts … gráficos estándar"]` + LOCKED in 44-UI-SPEC §2 / 46-CONTEXT. React-first, declarative, SSR-friendly shell. Peer-supports React 19. `[VERIFIED: npm registry — version 3.9.0, modified 2026-06-23, 53.5M downloads/week]` |

### Supporting (already installed — reuse, do not add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-accordion` | 1.2.14 | The F45 `CarrilAccordion` the chart lives inside. | Chart shell is rendered as a child of the patrimonio accordion body. |
| `@xyflow/react` | 12.11.0 | (Precedent only) existing heavy client-viz island on `/red`. | Reference pattern for `"use client"` island + jsdom mock; do NOT use for this chart. |
| `vitest` + `@testing-library/react` | 3.2.6 / 16.3.2 | Render + transform tests. | Pure transform tests + shell copy tests + Recharts mock. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | visx (`@visx/*`) | `[CITED: CLAUDE.md]` visx is reserved for the bespoke cross-chamber tramitación timeline (out of v5). For a standard count-bar chart it is more work for no benefit. Do NOT use here. |
| Stacked `BarChart` (discrete) | `AreaChart` / `LineChart` (connected) | A connected line/area across declarations of different `tipo` (periódica vs rectificación vs cese) visually implies a comparable continuous trend in wealth → reads as insinuation (DESIGN-SYSTEM §6 banned framing). Discrete bars state counts without implying a trend. `[ASSUMED]` — final chart type is Claude's discretion per 46-CONTEXT, but this is the honesty-aligned default. |

**Installation:**
```bash
cd app && pnpm add recharts
```
(`pnpm`, not `npm` — repo convention per MEMORY.md "pnpm no npm".)

**Version verification:** `[VERIFIED: npm registry]` `npm view recharts version` → `3.9.0`; `peerDependencies.react` → `^16.8.0 || ^17 || ^18 || ^19` (React 19.2.4 in repo satisfies); `time.modified` → 2026-06-23; no `postinstall` script.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `recharts` | npm | mature (v3.9.0, project since 2015) | 53.5M/week | github.com/recharts/recharts | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck 0.6.1 scanned `recharts` → `1 OK` (the Windows `FileNotFoundError` traceback occurred *after* the scan verdict, in slopcheck's optional auto-`npm install` step — it does not affect the legitimacy verdict). `npm view recharts scripts.postinstall` → empty (no postinstall hook). Registry + downloads + source repo confirm legitimacy: tag `[VERIFIED: npm registry]`.

## Architecture Patterns

### System Architecture Diagram

```
/parlamentario/[id]  (RSC page)
   └─ CarrilesSection (RSC)
        └─ <section id="patrimonio" mt-12>
             └─ CarrilAccordion ("use client" thin wrapper, F45)   ← children passed in, never imported
                  └─ PatrimonioSection (RSC, server-only Supabase)
                       │  sb.rpc("declaraciones_de_parlamentario")  ─┐  (ALREADY fetched today)
                       │  sb.rpc("bienes_de_parlamentario")          ─┤
                       │  → modelarVersiones() → `todas: DeclaracionVersionRow[]`
                       │       (each row has: tipo, fecha_presentacion, bienes[])
                       ▼
                  seriePatrimonio(todas)  ── PURE, server-side ──►  SeriePunto[]  (plain: strings+numbers only)
                       │
                       ├─ if declaraciones < 2  → degrade text, no chart
                       └─ else → <PatrimonioChartShell>  (RSC: caveat + footer CC BY 4.0)
                                    └─ <PatrimonioChart serie={SeriePunto[]} />   ("use client" island)
                                          └─ Recharts ResponsiveContainer → BarChart (measures DOM, client-only)
```

The Server Component owns the data fetch and aggregation; the client island receives **only a serialized array**. The SVG library never enters the server/worker module graph.

### Recommended Project Structure
```
app/components/
├── patrimonio-de-parlamentario.tsx   # EXISTING — add seriePatrimonio() pure fn + render <PatrimonioChartShell> inside PatrimonioView/Section
├── patrimonio-chart.tsx              # NEW — "use client" Recharts island (BarChart only); receives SeriePunto[]
└── patrimonio-chart.test.tsx         # NEW — transform tests + shell copy tests (Recharts mocked)
```
(Component location is Claude's discretion per 46-CONTEXT; this mirrors the existing flat `components/` convention.)

### Pattern 1: Client-viz island fed by a server transform (the `@xyflow/react` precedent)
**What:** A `"use client"` component that imports the DOM-measuring viz lib and receives a plain data array as props. The RSC computes the array and passes it down.
**When to use:** Always for Recharts here — it is the proven, deployed pattern on `/red`.
**Example:**
```typescript
// Source: app/components/red/red-graph.tsx (existing, deployed via OpenNext/CF)
"use client";
import { ReactFlow /* … */ } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
export interface SubgrafoNodo { id: string; nombre: string | null; camara: string | null; }
export function RedGraph({ subgrafo }: { subgrafo: Subgrafo }) { /* renders client-only */ }
```
Apply identically: `patrimonio-chart.tsx` starts with `"use client"`, imports `recharts`, exports `PatrimonioChart({ serie }: { serie: SeriePunto[] })`.

### Pattern 2: Serializable RSC→client boundary
**What:** The array crossing into the client island must be plain JSON — strings and numbers only. **No `Date` objects, no functions, no class instances.**
**Why:** `fecha_presentacion` is already an ISO `string` in `DeclaracionRpcRow`/`DeclaracionVersionRow` (`fecha_presentacion: string`). Derive the year as a `number` or `string` in the transform; never pass `new Date(...)` across the boundary.
**Example shape:**
```typescript
export interface SeriePunto {
  anio: number;            // 2016..2026, derived from fecha_presentacion.slice(0,4)
  tipo_declaracion: string; // declaracion.tipo (periódica / rectificación / cese), literal de la fuente
  inmueble: number;
  pasivo: number;
  mueble: number;
  actividad: number;
  accion_derecho: number;
  valor: number;
}
```

### Pattern 3: Reuse the existing aggregation, add no query
**What:** `PatrimonioSection` already builds `todas = modelarVersiones(filas, id, bienesPorFuente)` where each `DeclaracionVersionRow.bienes` is the array of that version's `BienRpcRow` and each `BienRpcRow.tipo_bien ∈ {inmueble,mueble,actividad,pasivo,accion_derecho,valor}`. The transform counts `bienes` per `tipo_bien` per version, keyed by `anio` + `tipo` (declaration type). The `agruparBienesPorTipo` helper already exists and proves the grouping idiom.
**Why:** No second Supabase call, no new RPC → lockdown guard green by construction.

### Anti-Patterns to Avoid
- **Adding `export const runtime = "edge"`** anywhere in this route: OpenNext/Cloudflare does NOT support the Edge runtime; it must use the Node runtime (the default). `[CITED: opennext.js.org/cloudflare/troubleshooting]`
- **Importing Recharts in a Server Component or in the page tree:** it must stay inside the `"use client"` island so it never enters the worker/server bundle.
- **Connecting counts with a line/area across declaration types:** insinuates a wealth trend (banned framing).
- **Passing `Date` objects or computing montos:** breaks RSC serialization / violates the montos caveat.
- **A second query for chart data:** unnecessary and risks introducing a non-allowlisted call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG axes / ticks / bars / tooltip / responsive sizing | A custom SVG chart | Recharts `BarChart` + `ResponsiveContainer` | Edge cases (DOM measurement, tick spacing, a11y) — that's the whole reason the lib is mandated. |
| Per-version asset grouping | New grouping code | The existing `agruparBienesPorTipo` / `BienRpcRow.tipo_bien` idiom | Already tested; the 6 `TipoBien` values are fixed. |
| CC BY 4.0 / InfoProbidad footer | New attribution markup | The existing `AtribucionCcBy` component (`patrimonio-de-parlamentario.tsx:97`) | Identical source, already string-matched by tests (`/Datos bajo licencia CC BY 4\.0/`). |
| Data fetch | New RPC / second query | `todas` already computed in `PatrimonioSection` | Zero new queries; guard stays green. |

**Key insight:** This phase is ~90% wiring of existing, already-fetched, already-tested data into one new client island. The only genuinely new third-party surface is Recharts itself, and a heavier sibling (React Flow) already proves the deployment path.

## Common Pitfalls

### Pitfall 1: Recharts `ResponsiveContainer` renders nothing (width/height 0) in jsdom
**What goes wrong:** RTL render tests of the island see an empty SVG; assertions on bars/axes fail.
**Why it happens:** `ResponsiveContainer` reads `clientWidth`/`clientHeight` via `ResizeObserver`; jsdom reports 0.
**How to avoid:** Mirror the `@xyflow/react` test exactly — `vi.mock("recharts", …)` with a lightweight double, OR render the chart at a fixed `width`/`height` (skip `ResponsiveContainer` in tests), OR (preferred) **assert behavior on the pure transform + the server shell** (caveat, degrade, footer, neutral copy) and leave the SVG canvas to the operator's browser/Docker check. The repo already does this for `/red` (`red-graph.test.tsx` mocks the lib and polyfills `ResizeObserver`).
**Warning signs:** Test failures referencing 0-width SVG or missing `ResizeObserver`.

### Pitfall 2: Cloudflare Worker bundle size limit
**What goes wrong:** Worker upload rejected (>3 MiB free / >10 MiB paid). `[CITED: opennext.js.org/cloudflare]`
**Why it happens:** Heavy libs bloating the bundle.
**How to avoid:** Recharts is client-only here (`"use client"`), so it lands in the **client JS bundle, not the worker server bundle** — low risk. `@xyflow/react` (1.2 MB) already ships fine on this account (Pro plan). Optional hardening: add `experimental.optimizePackageImports: ['recharts']` to `next.config.ts` to tree-shake unused Recharts exports (`[CITED: Next.js 16 docs / OpenNext deployment guides]`). Not required, but cheap insurance.
**Warning signs:** wrangler deploy size error during the operator build.

### Pitfall 3: Windows OpenNext build is broken (known)
**What goes wrong:** `opennextjs-cloudflare build` on Windows produces a 500-ing worker.
**Why it happens:** Documented in MEMORY.md (Camino A: "build OpenNext en Docker Linux (Windows→worker roto 500ea)").
**How to avoid:** The build/deploy validation MUST be a **Docker Linux** operator checkpoint, never a Windows build. The planner marks `pnpm preview`/`cf-build` as a human/operator verification task.
**Warning signs:** Worker 500s after a Windows-produced bundle.

### Pitfall 4: Mixing declaration types into one comparable series
**What goes wrong:** A bar/line that sums or connects a periódica and a rectificación reads as a single longitudinal trend → false comparison ("peras con manzanas", REQUIREMENTS VIZ-01).
**How to avoid:** Carry `tipo_declaracion` as a dimension; either show declaration types as distinct categories/colors or facet them, and never connect across them. Discrete bars keyed by `fecha_presentacion` with the declaration `tipo` visible.

### Pitfall 5: Chart copy tripping the banned-vocabulary negative-match
**What goes wrong:** A legend/axis/caption uses "aumentó", "variación", "patrimonio total", "conflicto", etc. → the §9.1 test regexes fail.
**How to avoid:** Use neutral nouns only: axis "N.º de bienes declarados por año", legend = the NOUN group labels already in `ORDEN_GRUPOS_BIENES` ("Bienes inmuebles", "Pasivos", …). Run the chart copy through `PROHIBIDO_VEREDICTO`/`PROHIBIDO_CONECTIVO` (see Validation Architecture).

## Code Examples

### Pure server-side transform (no Date across boundary)
```typescript
// Source: derived from existing patrimonio-de-parlamentario.tsx (DeclaracionVersionRow shape)
export function seriePatrimonio(versiones: DeclaracionVersionRow[]): SeriePunto[] {
  return versiones.map((v) => {
    const counts: Record<TipoBien, number> = {
      inmueble: 0, mueble: 0, actividad: 0, pasivo: 0, accion_derecho: 0, valor: 0,
    };
    for (const b of v.bienes) counts[b.tipo_bien]++;
    return {
      anio: Number(v.fecha_presentacion.slice(0, 4)), // ISO string → year number, no Date
      tipo_declaracion: v.tipo,
      ...counts,
    };
  });
}
```

### Client island skeleton
```typescript
// Source: pattern mirrors app/components/red/red-graph.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { SeriePunto } from "./patrimonio-de-parlamentario";

export function PatrimonioChart({ serie }: { serie: SeriePunto[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="N.º de bienes declarados por año">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie}>
          <XAxis dataKey="anio" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="inmueble" stackId="b" name="Bienes inmuebles" />
          <Bar dataKey="pasivo"   stackId="b" name="Pasivos" />
          {/* … remaining tipo_bien series */}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```
(Civic color tokens per DESIGN-SYSTEM §1: do NOT use `--camara`/`--senado` (data identity) for series fills; neutral/petrol-adjacent fills only — series color carries no political reading.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x (React ≤18) | Recharts 3.x (React 19 peer) | Recharts 3 (2024–2025) | v3.9.0 declares React 19 peer; safe with React 19.2.4. |
| Edge runtime for charts on CF | Node runtime only via OpenNext | OpenNext/Cloudflare current | Never add `runtime = "edge"`. |
| Turbopack-only mental model | Next 16 Turbopack default; webpack optional for aggressive tree-shake | Next.js 16 | `optimizePackageImports` covers Recharts under either. |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stacked discrete `BarChart` (not line/area) is the honesty-aligned default chart type | Standard Stack / Patterns | Low — chart type is explicitly Claude's discretion (46-CONTEXT); a line risks the insinuation framing but is not a guard failure. |
| A2 | Recharts client bundle stays well under the CF Worker size limit because it is client-only and React Flow (1.2 MB) already ships | Pitfalls | Low — verify in the operator Docker build; `optimizePackageImports` available as mitigation. |
| A3 | `next.config.ts` `optimizePackageImports` is optional, not required | Pitfalls | Low — only a size-hardening nicety. |

## Open Questions

1. **Two grouping dimensions (`tipo_bien` vs declaration `tipo`) — how to present both without clutter?**
   - What we know: items have a `tipo_bien` (6 kinds); each declaration has a `tipo` (periódica/rectificación/cese). VIZ-01 requires labeling the declaration type and not mixing incomparable versions.
   - What's unclear: whether to facet by declaration type or encode it as an axis label/annotation.
   - Recommendation: stack by `tipo_bien` within each declaration's bar, and surface `tipo_declaracion` as the bar's category label/tooltip. Final call is Claude's discretion (46-CONTEXT).

2. **Which `tipo_bien` series to show (all 6 vs the dense ones)?**
   - What we know: PROD has inmueble=2841, pasivo=1820 (dense); others vary.
   - Recommendation: show all 6 stacked; the legend doubles as an honest inventory. Discretion per 46-CONTEXT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | install recharts | ✓ (repo convention) | — | — |
| Recharts (npm) | the chart island | ✓ on registry | 3.9.0 | — |
| Docker (Linux) | OpenNext/CF build validation | operator machine (per MEMORY.md) | — | none — Windows build is broken (must not use) |
| Cloudflare / wrangler creds | deploy | operator only (not in `.env`/CI) | wrangler 4.102.0 | deploy is operator checkpoint |

**Missing dependencies with no fallback:** Docker Linux build + Cloudflare deploy are operator-only (already the established Camino A flow) — these are checkpoints, not blockers for the code work.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.6 + @testing-library/react 16.3.2 (jsdom) |
| Config file | `app/vitest.config.ts` (globs `components/**/*.test.tsx`, `lib/**`, `app/**`) |
| Quick run command | `cd app && pnpm test` (vitest run) |
| Full suite command | `cd app && pnpm test && pnpm typecheck` (`tsc --noEmit`) + repo `tsc -b` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-01 | `seriePatrimonio(versiones)` produces `{anio, tipo_declaracion, <tipo_bien counts>}`, counts match per version, year derived from `fecha_presentacion` | unit (pure fn) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-01 | <2 declaraciones → "datos insuficientes para una tendencia", NO chart rendered | unit (RTL, shell) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-01 | montos caveat "Montos no disponibles como cifra en la fuente" present; NO numeric monto graphed | unit (RTL) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-01 | declaration types not merged into one comparable series (transform keeps `tipo_declaracion` distinct) | unit (pure fn) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-02 | `recharts` in `app/package.json` dependencies | unit (read package.json) or implicit via import | `pnpm test` / `pnpm typecheck` | ❌ Wave 0 |
| VIZ-02 | chart is a `"use client"` island; shell stays server (source grep, mirror `carril-accordion.test.tsx:75` style) | unit (source scan) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-02 | OpenNext/Cloudflare build does not break | **manual / operator (Docker Linux)** | `cd app && pnpm cf-build` in Docker Linux | n/a — human checkpoint |
| VIZ-03 | chart copy passes `PROHIBIDO_VEREDICTO` + `PROHIBIDO_CONECTIVO` negative-match | unit (RTL textContent) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-03 | source + date + link footer (CC BY 4.0, InfoProbidad/CPLT) present | unit (RTL) | `pnpm test patrimonio-chart` | ❌ Wave 0 |
| VIZ-03 | guard green: no new RPC outside allowlist, no `.from('parlamentario')` | unit (existing guard) | `pnpm test lockdown-guard` | ✅ exists |

### Sampling Rate
- **Per task commit:** `cd app && pnpm test <changed-file>` (e.g. `patrimonio-chart`) + `pnpm typecheck`
- **Per wave merge:** `cd app && pnpm test` (full vitest) + `pnpm typecheck`
- **Phase gate:** full suite green + `tsc -b` green BEFORE `/gsd:verify-work`; then operator Docker Linux `cf-build` + deploy.

### Wave 0 Gaps
- [ ] `app/components/patrimonio-chart.test.tsx` — transform tests (VIZ-01) + shell copy tests (caveat, degrade, footer, banned-vocab negative-match) (VIZ-03) + `"use client"` source scan (VIZ-02). Mock `recharts` (mirror `red-graph.test.tsx` `vi.mock`).
- [ ] Reuse the banned-vocab regexes already defined in `patrimonio-de-parlamentario.test.tsx:24-30` (`PROHIBIDO_VEREDICTO`, `PROHIBIDO_CONECTIVO`, `PATRON_RUT`) — import or duplicate.
- [ ] No framework install needed (vitest present). Recharts install is the only new dep.

## Security Domain

`security_enforcement` treated as enabled (not `false` in config).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public read-only civic data; no accounts. |
| V3 Session Management | no | Stateless public pages. |
| V4 Access Control | yes | Camino A: public tree runs as `service_role` (bypasses RLS). Defense = lockdown guard (no `.from('<PII>')`, only allowlisted RPCs). This phase adds **no RPC, no `.from`** → guard green by construction. |
| V5 Input Validation | minimal | No new user input reaches the chart; data flows server→client as a derived array. The only param (`[id]`) is already validated by `PARLAMENTARIO_ID_RE`. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental PII projection (rut/familiar) into the chart | Information Disclosure | RPCs are PII-safe by contract; counts only — no `contenido` values, no names rendered. Banned-vocab + RUT-regex tests assert no RUT in DOM. |
| New non-allowlisted RPC sneaking in | Elevation of Privilege (service_role can run any RPC) | `lockdown-guard.test.ts` fails CI on any `.rpc()` outside `PUBLIC_RPC_ALLOWLIST`; this phase adds none. |
| service_role data leaking to client via island | Information Disclosure | Island receives only the serialized count array; `CarrilAccordion`/island never import `@/lib/supabase` (source-scan test pattern). |

## Project Constraints (from CLAUDE.md)

- **Recharts is the named library** for "gráficos estándar"; visx reserved for the bespoke timeline (out of scope). Do not introduce another chart lib.
- **Next.js 16 App Router, Server Components by default**; external/data calls server-only. The chart is the explicit client exception (`"use client"` island).
- **Camino A lockdown:** public tree = `service_role`; any new RPC must be in `PUBLIC_RPC_ALLOWLIST` (this phase adds none); `.from('parlamentario')` forbidden in the public tree.
- **pnpm, not npm** (MEMORY.md).
- **Build OpenNext in Docker Linux, never Windows** (MEMORY.md / 46-CONTEXT) — worker breaks on Windows builds.
- **GSD workflow enforcement:** file edits go through a GSD command (this is the research step).

## Sources

### Primary (HIGH confidence)
- Codebase (read in full): `app/components/patrimonio-de-parlamentario.tsx`, `app/app/parlamentario/[id]/page.tsx`, `app/components/carril-accordion.tsx`, `app/components/red/red-graph.tsx` + `red-graph.test.tsx`, `app/lib/lockdown-guard.test.ts`, `app/components/patrimonio-de-parlamentario.test.tsx`, `app/lib/types.ts`, `app/package.json`, `app/vitest.config.ts`, `app/next.config.ts`.
- `.planning` docs: 46-CONTEXT.md, 44-UI-SPEC.md, 44-DATA-INVENTORY.md (chart #2), REQUIREMENTS.md (VIZ-01..03), DESIGN-SYSTEM.md (§1 color, §6 banned vocab).
- npm registry: `recharts` 3.9.0, peerDeps, modified date, downloads, postinstall (none) — `[VERIFIED]`.
- slopcheck 0.6.1: `recharts` → `[OK]`.

### Secondary (MEDIUM confidence)
- [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare) / [Troubleshooting](https://opennext.js.org/cloudflare/troubleshooting) — Node runtime only (no Edge), Next.js 16 supported, Worker size limits.
- [Cloudflare Workers Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) — adapter build flow.
- WebSearch result digest — Recharts requires `"use client"`, `optimizePackageImports: ['recharts']` for tree-shaking, 3 MiB free / 10 MiB paid worker limit.

### Tertiary (LOW confidence)
- General blog posts on Next.js 16 → Cloudflare (bundle-size tactics) — corroborative only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Recharts version/peer/legitimacy verified on registry + slopcheck; library is LOCKED in CONTEXT.
- Architecture: HIGH — derived directly from read source; the `@xyflow/react` island is a deployed precedent and `PatrimonioSection` already fetches the data.
- Pitfalls: HIGH for the codebase-grounded ones (jsdom, Windows build, guard); MEDIUM for CF bundle-size specifics (operator Docker build confirms).

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable; recheck Recharts version if React/Next bump).

## RESEARCH COMPLETE

**Phase:** 46 - VIZ — Chart de patrimonio (conteo de ítems por año)
**Confidence:** HIGH

### Key Findings
- **Zero new data plumbing:** `PatrimonioSection` already fetches both allowlisted RPCs and builds `todas: DeclaracionVersionRow[]` (with `tipo`, `fecha_presentacion`, `bienes[]`). A pure server-side `seriePatrimonio()` derives the count series — no new RPC, no second query → lockdown guard green by construction.
- **Recharts 3.9.0 is safe and legitimate:** React 19 peer support, 53.5M dl/week, slopcheck `[OK]`, no postinstall.
- **Deployment de-risked by precedent:** `@xyflow/react` (1.2 MB, DOM-measuring) already ships as a `"use client"` island via OpenNext/Cloudflare; Recharts follows the identical pattern (client-only → not in worker bundle). Edge runtime must NOT be added; build must run in Docker Linux (Windows worker is broken).
- **Test strategy is established:** test the pure transform + the server shell copy (caveat, degrade, footer, banned-vocab negative-match using the regexes already in `patrimonio-de-parlamentario.test.tsx`); mock Recharts in jsdom (mirror `red-graph.test.tsx`). The OpenNext/Cloudflare Docker build is an operator checkpoint.
- **Honesty steer:** discrete stacked `BarChart` keyed by `fecha_presentacion`, labeled by `tipo_declaracion`, never a connected line/area (which would insinuate a wealth trend). Counts only — montos caveat mandatory.

### File Created
`.planning/phases/46-viz-chart-de-patrimonio-conteo-de-tems-por-a-o/46-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Registry-verified + slopcheck + LOCKED in CONTEXT |
| Architecture | HIGH | Read from source; deployed precedent; data already fetched |
| Pitfalls | HIGH/MEDIUM | Codebase pitfalls HIGH; CF bundle size MEDIUM (operator build confirms) |

### Open Questions
- Presentation of the two grouping dimensions (`tipo_bien` stack vs `tipo_declaracion` facet) — Claude's discretion.
- Which `tipo_bien` series to surface — recommend all 6 stacked.

### Ready for Planning
Research complete. The planner can create PLAN.md: one task to install Recharts, one to add the pure transform + client island + server shell, one for tests, plus an operator Docker-Linux build/deploy checkpoint.
