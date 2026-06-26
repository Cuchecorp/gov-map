# Phase 46: VIZ — Chart de patrimonio (conteo de ítems por año) - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4 (all exact or role-match in-repo)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/components/patrimonio-chart.tsx` (NEW) | component (`"use client"` viz island) | transform → render (props-in, SVG-out) | `app/components/red/red-graph.tsx` | exact (same OpenNext→CF client-viz island pattern) |
| `app/components/patrimonio-chart.test.tsx` (NEW) | test | transform-unit + RTL render (viz lib mocked) | `app/components/red/red-graph.test.tsx` + `patrimonio-de-parlamentario.test.tsx` | exact (mock-the-viz-lib) + exact (banned-vocab regexes) |
| `app/components/patrimonio-de-parlamentario.tsx` (MODIFY) | component (RSC + pure transforms) | CRUD-read → aggregate → render shell | itself (extend in place) | exact (own established idioms) |
| `app/package.json` (MODIFY) | config | dependency add | itself (`@xyflow/react` precedent line 25) | exact |

**Where the pure `seriePatrimonio()` transform lives (decision):** export it from `app/components/patrimonio-de-parlamentario.tsx` (the server file), NOT from the `"use client"` island. It is pure and serializable, mirrors the file's existing exported pure helpers (`modelarVersiones`, `agruparBienesPorTipo`, `agruparBienesPorFuente`), and keeping it out of the island means the island imports only the `SeriePunto` *type* — exactly how `red-graph.tsx` keeps its data shaping at the props boundary. The island (`patrimonio-chart.tsx`) imports `type { SeriePunto }` from the server file (type-only import does not pull `@/lib/supabase` into the client graph; confirm with the source-scan test below).

## Pattern Assignments

### `app/components/patrimonio-chart.tsx` (NEW — `"use client"` Recharts island)

**Analog:** `app/components/red/red-graph.tsx` (the deployed `@xyflow/react` island on `/red`)

**Client-island header + viz-lib import** (`red-graph.tsx:1-12`) — copy this shape exactly; swap `@xyflow/react` for `recharts`:
```typescript
"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
```
For Recharts: `import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";` — Recharts ships no required CSS, so omit the `import "...style.css"` line.

**Props interface = plain serialized array** (`red-graph.tsx:48-76`) — the island declares its own data contract and receives only JSON (strings/numbers); never a `Date`, never a Supabase client:
```typescript
export interface RedGraphProps {
  /** JSON plano emitido por el RPC `subgrafo_red` (nodos + aristas). */
  subgrafo: Subgrafo | null;
}
export function RedGraph({ subgrafo }: RedGraphProps) {
```
Apply: `export function PatrimonioChart({ serie }: { serie: SeriePunto[] })` where `SeriePunto = { anio: number; tipo_declaracion: string; <tipo_bien>: number }` (year derived in the transform as `Number(fecha_presentacion.slice(0,4))` — NO `new Date()` across the boundary).

**Honest empty/degrade state returned BEFORE the canvas** (`red-graph.tsx:150-161`) — the island returns a sober text state instead of an empty/0-size SVG. Mirror for `<2 declaraciones`:
```typescript
if (aristas.length === 0) {
  return (
    <section aria-label="Grafo de relaciones" className="mt-8">
      <p className="text-base leading-relaxed text-muted-foreground">
        Aún no hay relaciones para mostrar para este parlamentario. …
      </p>
    </section>
  );
}
```
NOTE: per `seriePatrimonio` living server-side, the `<2 declaraciones` degrade and the montos caveat + CC BY footer should be rendered by the **server shell** in `patrimonio-de-parlamentario.tsx` (grep-testable without SVG), and the island rendered only when there are ≥2 points. This mirrors how `PatrimonioSection` (server) gates `DeclaracionComparacion` and the `<2` degrade lives in pure-view code (`patrimonio-de-parlamentario.tsx:461-472`).

**Series fill colors — anti-insinuación constraint:** do NOT reuse `--camara`/`--senado` identity tokens for bar fills (those carry political reading); use neutral/petrol-adjacent civic tokens (DESIGN-SYSTEM §1). Legend labels = the NOUN group labels already canonicalized in `ORDEN_GRUPOS_BIENES` (`patrimonio-de-parlamentario.tsx:123-130`): "Bienes inmuebles", "Pasivos", "Actividades e intereses", "Acciones y derechos", "Valores", "Bienes muebles". Axis label: "N.º de bienes declarados por año".

---

### `app/components/patrimonio-de-parlamentario.tsx` (MODIFY — add transform + render shell)

**Analog:** itself (extend with its own established idioms)

**Add the pure transform next to `modelarVersiones`** — mirror the existing exported pure-helper style (`patrimonio-de-parlamentario.tsx:186-194`, `agruparBienesPorTipo`), reusing the fixed `TipoBien` set and the `ORDEN_GRUPOS_BIENES` ordering:
```typescript
export function agruparBienesPorTipo(
  bienes: BienRpcRow[],
): Array<{ tipo: TipoBien; label: string; bienes: BienRpcRow[] }> {
  return ORDEN_GRUPOS_BIENES.map(({ tipo, label }) => ({
    tipo, label, bienes: bienes.filter((b) => b.tipo_bien === tipo),
  })).filter((g) => g.bienes.length > 0);
}
```
The new `seriePatrimonio(versiones: DeclaracionVersionRow[]): SeriePunto[]` counts `v.bienes` per `tipo_bien` per version, keyed by `anio` (from `v.fecha_presentacion.slice(0,4)`) + carries `v.tipo` as `tipo_declaracion` (NEVER merge declaration types into one comparable series — VIZ-01). Each `DeclaracionVersionRow.bienes` is already populated by `modelarVersiones` (`:577`, `bienesPorFuente.get(f.fuente_id) ?? []`).

**CC BY 4.0 footer — REUSE the existing component, do not rebuild** (`patrimonio-de-parlamentario.tsx:96-113`):
```typescript
function AtribucionCcBy() {
  return (
    <span>
      Fuente: InfoProbidad — Consejo para la Transparencia. Datos bajo licencia CC
      BY 4.0.{" "}
      <a href={CC_BY_40_URL} target="_blank" rel="noopener noreferrer" …>
        Ver licencia ↗
      </a>
    </span>
  );
}
```
The chart shell's footer renders `<AtribucionCcBy />` (already string-matched by tests via `/Datos bajo licencia CC BY 4\.0/`). The montos caveat ("Montos no disponibles como cifra en la fuente") is a sibling muted `<p>` in the same shell.

**`<2 declaraciones` degrade — copy the neutral-fact framing** (`patrimonio-de-parlamentario.tsx:461-472`, `DeclaracionComparacion`):
```typescript
if (columnas.length < 2) {
  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold mb-2">Comparar versiones</h3>
      <p className="text-sm text-muted-foreground">
        Se necesita más de una versión para comparar. Hay {totalVersiones} …
      </p>
    </div>
  );
}
```
Apply: with `<2` declaraciones, render "datos insuficientes para una tendencia" (neutral fact, never a deficiency) and render NO chart — server-side, before mounting the island.

**Mount point — render the shell inside `PatrimonioView` (state (c), with versions)** (`patrimonio-de-parlamentario.tsx:392-414`). The chart goes in the body that already shows the neutral count `<p>` and the `<ul>` of `VersionRow`. The shell receives `serie={seriePatrimonio(versiones)}` computed in the RSC. `PatrimonioSection` already builds `todas` (`:696`) and slices `versiones` (`:716`) — feed the chart from the full `todas` set (all years), not the paginated slice.

**No new fetch — the data is already in `PatrimonioSection`** (`patrimonio-de-parlamentario.tsx:669-696`): both allowlisted RPCs (`declaraciones_de_parlamentario`, `bienes_de_parlamentario`) are already called and assembled into `todas`. Add ZERO `sb.rpc(...)` / `sb.from(...)` → lockdown guard green by construction.

---

### `app/components/patrimonio-chart.test.tsx` (NEW)

**Analog A:** `app/components/red/red-graph.test.tsx` (mock-the-viz-lib + jsdom polyfill)

**Mock Recharts + polyfill `ResizeObserver`** (`red-graph.test.tsx:24-79`) — Recharts' `ResponsiveContainer` reads `clientWidth`/`clientHeight` via `ResizeObserver` (0 in jsdom). Mirror this `vi.mock` + `beforeAll` shape:
```typescript
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return { ReactFlow: ({ nodes, edges, nodeTypes, edgeTypes }) => …, /* lightweight doubles */ };
});
```
For Recharts, `vi.mock("recharts", …)` returning lightweight passthrough doubles (`ResponsiveContainer`/`BarChart`/`Bar`/`XAxis`/`YAxis`/`Tooltip`/`Legend` → render children or a `data-testid` div), OR (research-preferred) assert on the **pure transform + server shell copy** and leave the SVG canvas to the operator Docker/browser check.

**Honest-state assertion idiom** (`red-graph.test.tsx:291-307`): assert the degrade text is present and the canvas/island is NOT mounted with `<2` declaraciones.

**Analog B:** `app/components/patrimonio-de-parlamentario.test.tsx` (banned-vocab negative-match regexes)

**REUSE the three regexes verbatim** (`patrimonio-de-parlamentario.test.tsx:24-30`) — import or duplicate; run them over the chart shell's `container.textContent`:
```typescript
const PROHIBIDO_VEREDICTO =
  /enriqueci|conflicto de inter|aument|disminuy|incrementó|incremento patrimonial|variaci|delta|Δ|creció|pasó de|más rico|patrimonio total|posible conflicto/i;
const PROHIBIDO_CONECTIVO =
  /a cambio de|antes de votar|que resultó en|en representación de|vinculad[oa] a|asociad[oa] con|cercano a/i;
const PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/;
```
Assert chart axis/legend/caveat copy: `expect(texto).not.toMatch(PROHIBIDO_VEREDICTO)` etc. (the axis title "N.º de bienes declarados por año" passes; "variación"/"patrimonio total"/"aumentó" would fail).

**Fixture idiom — `makeVersion` / `makeBien`** (`patrimonio-de-parlamentario.test.tsx:33-70`): reuse these `Partial<...>`-override factories to build `DeclaracionVersionRow[]` inputs for `seriePatrimonio` unit tests (assert counts per `tipo_bien` per version, year derived, `tipo_declaracion` kept distinct).

**Source-scan idiom for the `"use client"` no-leak assertion** (`carril-accordion.test.tsx:73-86`): grep the island source to prove it never imports the server-only Supabase client:
```typescript
const fuente = readFileSync(
  path.join(process.cwd(), "components", "patrimonio-chart.tsx"), "utf8",
);
expect(fuente).toMatch(/^"use client"/);          // is a client island
expect(fuente).not.toMatch(/createServerSupabase/);
expect(fuente).not.toMatch(/@\/lib\/supabase/);
```

---

### `app/package.json` (MODIFY)

**Analog:** the `@xyflow/react` entry (`package.json:25`, `"@xyflow/react": "12.11.0"`) — a heavy client-viz lib pinned to an exact version. Add `"recharts": "3.9.0"` to `dependencies` the same way (exact pin, alphabetical neighbor of `react`). Install with **pnpm** (`cd app && pnpm add recharts`), never npm (MEMORY.md). Test framework (`vitest` 3.2.6) and RTL are already present (`package.json:41,52`) — no test deps to add.

## Shared Patterns

### CC BY 4.0 / source+date+link footer
**Source:** `app/components/patrimonio-de-parlamentario.tsx:96-113` (`AtribucionCcBy`) + `CC_BY_40_URL` constant (`:66`)
**Apply to:** the chart shell footer (server-rendered, inside `patrimonio-de-parlamentario.tsx`). Reuse the existing component — already test-matched by `/Datos bajo licencia CC BY 4\.0/`.

### Client-viz island fed by a server transform (RSC → serialized props → client SVG)
**Source:** `app/components/red/red-graph.tsx:1-12, 48-76` + page mount idiom (`page.tsx:188-198` mounts `<PatrimonioSection>` inside `<CarrilAccordion>`)
**Apply to:** `patrimonio-chart.tsx`. RSC computes `SeriePunto[]`; island imports only `recharts` + the `SeriePunto` type; receives one plain array. The SVG lib never enters the server/worker bundle (proven by `@xyflow/react` shipping on this CF account).

### Banned-vocabulary negative-match gate (DESIGN-SYSTEM §6 / UI-SPEC §9.1)
**Source:** `app/components/patrimonio-de-parlamentario.test.tsx:24-30` (`PROHIBIDO_VEREDICTO`, `PROHIBIDO_CONECTIVO`, `PATRON_RUT`)
**Apply to:** `patrimonio-chart.test.tsx` — run over the chart shell `textContent`. Counts-only, no montos, no RUT, no trend verb.

### `"use client"` no-leak source-scan
**Source:** `app/components/carril-accordion.test.tsx:73-86` (`readFileSync` + `process.cwd()` + `path.join`, asserts no `createServerSupabase` / `@/lib/supabase`)
**Apply to:** `patrimonio-chart.test.tsx` to prove the island stays client-only and never pulls `service_role` into the browser graph.

### Lockdown guard (no new RPC, no `.from('parlamentario')`)
**Source:** `app/lib/lockdown-guard.test.ts:157-167` (`PUBLIC_RPC_ALLOWLIST` already includes `declaraciones_de_parlamentario` + `bienes_de_parlamentario`)
**Apply to:** all phase code — add ZERO new `sb.rpc`/`sb.from`. Guard stays green by construction; this is a passive constraint, not new code.

## No Analog Found

None. Every new/modified file maps to a strong in-repo analog; the only genuinely new third-party surface (Recharts) is de-risked by the deployed `@xyflow/react` island precedent.

## Metadata

**Analog search scope:** `app/components/` (incl. `red/`), `app/lib/`, `app/app/parlamentario/[id]/`
**Files scanned:** `patrimonio-de-parlamentario.tsx`, `patrimonio-de-parlamentario.test.tsx`, `red/red-graph.tsx`, `red/red-graph.test.tsx`, `carril-accordion.tsx`, `carril-accordion.test.tsx`, `lib/types.ts`, `lib/lockdown-guard.test.ts`, `app/parlamentario/[id]/page.tsx`, `package.json`, `vitest.config.ts`
**Pattern extraction date:** 2026-06-26

## PATTERN MAPPING COMPLETE

**Phase:** 46 - VIZ — Chart de patrimonio (conteo de ítems por año)
**Files classified:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

### Coverage
- Files with exact analog: 4
- Files with role-match analog: 0
- Files with no analog: 0

### Key Patterns Identified
- The `"use client"` viz island fed by a serialized RSC array is already deployed (`red-graph.tsx` + `@xyflow/react` via OpenNext/CF); Recharts copies that boundary 1:1, with the pure `seriePatrimonio()` transform exported from the server file (`patrimonio-de-parlamentario.tsx`) so the island imports only the `SeriePunto` type.
- Zero new data plumbing: `PatrimonioSection` already fetches both allowlisted RPCs and builds `todas: DeclaracionVersionRow[]` (`:696`); the count series derives from `v.bienes`/`v.tipo_bien`/`v.fecha_presentacion` with no new query → lockdown guard green by construction.
- Honesty gate is reusable: the `PROHIBIDO_VEREDICTO`/`PROHIBIDO_CONECTIVO`/`PATRON_RUT` regexes (`patrimonio-de-parlamentario.test.tsx:24-30`), the `<2`-versions neutral-fact degrade, the `AtribucionCcBy` CC BY 4.0 footer, and the `red-graph.test.tsx` mock-the-viz-lib + `ResizeObserver` polyfill all transfer directly.

### File Created
`.planning/phases/46-viz-chart-de-patrimonio-conteo-de-tems-por-a-o/46-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference each analog (with line numbers) in PLAN.md action sections: install Recharts (package.json), add `seriePatrimonio()` + `SeriePunto` + server shell to `patrimonio-de-parlamentario.tsx`, add the `"use client"` `patrimonio-chart.tsx` island, add `patrimonio-chart.test.tsx`, and mark the OpenNext/Cloudflare Docker-Linux build as an operator checkpoint.
