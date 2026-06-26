# Phase 45: LEG — Navegación (acordeones por carril + resumen above-fold) - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 6 (4 new + 2 test groups + 1 modified) — `carril-accordion.tsx` (+test), `parlamentario-resumen.tsx` (+test), `parlamentario-resumen-conteos.ts` (+opt test), `page.tsx` (modify)
**Analogs found:** 6 / 6 (every new file has a strong in-repo analog)

> Esta fase es **composición pura** (re-layout). Casi todo el código se copia de analogos que ya existen en `app/`. Los dos riesgos (client-leak SSR y guard de lockdown) ya tienen patrón establecido. No se inventa arquitectura.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/components/carril-accordion.tsx` (NEW, `"use client"`) | component (thin client island / Radix wrapper) | event-driven (toggle, slot children) | `app/components/ui/tooltip.tsx` + `app/components/ui/separator.tsx` | exact (Radix `"use client"` wrapper + `cn`) |
| `app/components/parlamentario-resumen.tsx` (NEW, Server Comp + pure `ResumenView`) | component (server) + pure view | request-response (RPC counts → chips) | `app/components/lobby-de-parlamentario.tsx` (`LobbyView`/`LobbySection` split) | exact (pure-view + server-fetch split) |
| `app/lib/parlamentario-resumen-conteos.ts` (NEW, `server-only`) | service / data-access (counts) | request-response / CRUD-read | `LobbySection` fetch body (lines 287–349) + gates `cruces-gate.ts`/`money-gate.ts` (`import "server-only"`) | role-match (server-only RPC reader) |
| `app/components/carril-accordion.test.tsx` (NEW) | test (RTL unit) | — | `app/components/lobby-de-parlamentario.test.tsx` | exact (RTL fixture pattern) |
| `app/components/parlamentario-resumen.test.tsx` (NEW) | test (RTL unit, pure view) | — | `app/components/lobby-de-parlamentario.test.tsx` (tests `LobbyView` with fixtures) | exact |
| `app/app/parlamentario/[id]/page.tsx` (MODIFY) | route / page shell | orchestration (server passes sections as children) | itself (current `<section className="mt-12">` blocks) | self (in-place wrap) |

---

## Pattern Assignments

### `app/components/carril-accordion.tsx` (component, `"use client"` Radix island)

**Analog:** `app/components/ui/tooltip.tsx` (Radix `"use client"` wrapper) + `app/components/ui/separator.tsx`

**Imports + `"use client"` + Radix namespace + `cn`** — copy from `tooltip.tsx:1-6` / `separator.tsx:1-6`:
```tsx
"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion"; // mismo shape que TooltipPrimitive/SeparatorPrimitive
import { cn } from "@/lib/utils";   // util confirmado en app/lib/utils.ts
```
> The existing Radix wrappers (`tooltip.tsx`, `separator.tsx`) are the canonical proof that `"use client"` + `import * as XPrimitive from "@radix-ui/react-X"` + `cn(...)` is THE repo convention. `@radix-ui/react-{tooltip,separator,slot}` are already in `package.json`; `@radix-ui/react-accordion@1.2.14` is the only new dep.

**Component signature (children slot)** — from RESEARCH Pattern 1; the wrapper takes `children: React.ReactNode` and **never imports a section** (Pitfall 1):
```tsx
export function CarrilAccordion({
  titulo, conteo, defaultOpen, children,
}: {
  titulo: string;
  conteo: React.ReactNode;     // nodo 3-estado ya formateado: "9" | "—" | "sin registros"
  defaultOpen: boolean;
  children: React.ReactNode;   // <Suspense><XSection/></Suspense> — Server Comp pasado como CHILD
}) { /* Accordion.Root type="single" collapsible … */ }
```

**`<h2>` semántico en el header (preserva `h1→h2→h3`)** — replica el `<h2 className="text-xl font-semibold mb-4">` que hoy vive en cada `<section>` de `page.tsx:55,68,82,105,123,145,172`, ahora dentro de `Accordion.Header asChild`:
```tsx
<AccordionPrimitive.Header asChild>
  <h2 className="text-xl font-semibold">
    <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-4 min-h-11 text-left">
      <span>{titulo}</span>
      <span className="text-muted-foreground font-normal text-sm font-mono">{conteo}</span>
    </AccordionPrimitive.Trigger>
  </h2>
</AccordionPrimitive.Header>
<AccordionPrimitive.Content forceMount className="overflow-hidden data-[state=closed]:hidden pt-4">
  {children}
</AccordionPrimitive.Content>
```
> `forceMount` + `data-[state=closed]:hidden` keeps the SSR'd section in the HTML even when collapsed (RESEARCH Pitfall 3 / Open Q1 — recommended). `min-h-11` mirrors the 44px touch-target used in `lobby-de-parlamentario.tsx:216` (`min-h-[44px]`). `text-muted-foreground` is the repo's count/metadata color (used throughout sections).

**No-leak rule (hard):** this file MUST NOT contain `Section`, `createServerSupabase`, or `@/lib/supabase`. Guarded by a grep/negative unit test (LEG-03).

---

### `app/components/parlamentario-resumen.tsx` (server component + pure `ResumenView`)

**Analog:** `app/components/lobby-de-parlamentario.tsx` — the **pure-view + server-fetch split** is the load-bearing pattern to copy.

**The split (copy structurally):**
- `lobby-de-parlamentario.tsx:50-64` declares `interface LobbyViewData` (pure props).
- `lobby-de-parlamentario.tsx:98` `export function LobbyView({ data }: { data: LobbyViewData })` — **pure, no `"use client"`, RTL-testable with fixtures**.
- `lobby-de-parlamentario.tsx:288-349` `export async function LobbySection(...)` — the async Server Component that fetches and renders `<LobbyView data={…} />`.

Apply identically:
```tsx
// app/components/parlamentario-resumen.tsx  (Server Component — NO "use client")
import { contarCarriles } from "@/lib/parlamentario-resumen-conteos";
import { crucesPublicEnabled } from "@/lib/cruces-gate";
import { moneyPublicEnabled } from "@/lib/money-gate";

// PURE view (RTL la testea con fixtures, igual que LobbyView)
export interface ResumenChip { href: string; label: string; estado: CarrilEstado; }
export function ResumenView({ chips }: { chips: ResumenChip[] }) {
  return (
    <nav aria-label="Índice de secciones" className="mt-6 flex flex-wrap gap-2">
      {chips.map((ch) => (
        <a key={ch.href} href={ch.href} className="inline-flex items-center gap-2 min-h-11 …">
          <span>{ch.label}</span>
          <ChipConteo estado={ch.estado} />
        </a>
      ))}
    </nav>
  );
}

// SERVER fetch wrapper (igual rol que LobbySection)
export async function ParlamentarioResumen({ id }: { id: string }) {
  const c = await contarCarriles(id);
  const chips: ResumenChip[] = [
    { href: "#votos", label: "Votaciones", estado: c.votos },
    { href: "#lobby", label: "Reuniones de lobby", estado: c.lobby },
    { href: "#patrimonio", label: "Declaraciones de patrimonio", estado: c.patrimonio },
    ...(crucesPublicEnabled(process.env) ? [{ href: "#cruces", label: "Cruces con sectores", estado: c.cruces }] : []),
    ...(moneyPublicEnabled(process.env)
      ? [{ href: "#dinero", label: "Contratos y financiamiento", estado: c.dinero }]
      : [{ href: "#financiamiento-pendiente", label: "Financiamiento y contratos", estado: { tipo: "pendiente" as const } }]),
  ];
  return <ResumenView chips={chips} />;
}
```

**Gate replication (must mirror `page.tsx` exactly):** the chip list gates on `crucesPublicEnabled(process.env)` and `moneyPublicEnabled(process.env)` EXACTLY as `page.tsx:103,121,143,170` does — so the resumen lists only carriles that are actually present in the HTML (V4 Access Control). The honest `#financiamiento-pendiente` chip mirrors `page.tsx:170-179`.

**3-estado honesto:** `ChipConteo` maps `dato → "9"`, `vacio → "sin registros"/"0"`, `no_ingerido → "—"`, `pendiente → honest copy` — same 3-state discipline as `LobbyView` states (a)/(b)/(c) at `lobby-de-parlamentario.tsx:110-135`. **Never a fabricated number.**

---

### `app/lib/parlamentario-resumen-conteos.ts` (server-only counts service)

**Analog:** `LobbySection` fetch body (`lobby-de-parlamentario.tsx:295-328`) for the RPC + `*_ingesta_estado` reads; `app/lib/cruces-gate.ts:1` / `money-gate.ts:1` for the `import "server-only"` header.

**Header (server-only + React.cache):**
```tsx
import "server-only";                 // espejo de cruces-gate.ts:1 / money-gate.ts:1 / supabase.ts:1
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase";

export type CarrilEstado =
  | { tipo: "dato"; n: number }
  | { tipo: "vacio" }
  | { tipo: "no_ingerido" }
  | { tipo: "pendiente" };

export const contarCarriles = cache(async (id: string) => { … });
```

**RPC + ingesta-estado reads (copy verbatim shape from `LobbySection`):**
```tsx
const sb = createServerSupabase();

// RPCs — TODAS en PUBLIC_RPC_ALLOWLIST (lockdown-guard.test.ts:157-173):
const { data: votosData, error: vErr } = await sb.rpc("votos_de_parlamentario", { p_id: id, p_limit: 1000, p_offset: 0 }); // firma exacta: votos-por-parlamentario.tsx:646-649
const { data: lobbyData, error: lErr } = await sb.rpc("lobby_de_parlamentario", { p_id: id });                            // lobby-de-parlamentario.tsx:303-306
const { data: patrData,  error: pErr } = await sb.rpc("declaraciones_de_parlamentario", { p_id: id });                    // patrimonio-de-parlamentario.tsx:670
// cruces solo si gated-ON (no llamar si el gate está OFF):
// const cruces = await sb.rpc("cruces_de_parlamentario", { p_id: id });                                                  // cruces-de-parlamentario.tsx:180

// no-ingerido: tablas *_ingesta_estado NO están en PII_TABLES → .from() guard-safe
const { data: lobbyEstado } = await sb.from("lobby_ingesta_estado").select("parlamentario_id").eq("parlamentario_id", id).maybeSingle();      // lobby-de-parlamentario.tsx:318-322
const { data: probEstado }  = await sb.from("probidad_ingesta_estado").select("parlamentario_id").eq("parlamentario_id", id).maybeSingle();   // patrimonio-de-parlamentario.tsx:700
```

**3-state derivation rule (copy the section's exact rule, don't reinvent):**
```tsx
// REPLICA EXACTA de la regla de cada sección:
const noIngestado = estadoData === null && total === 0;   // lobby-de-parlamentario.tsx:328 + patrimonio-de-parlamentario.tsx:709
```

**Error handling (#34 — throw, never degrade to empty):** every RPC/`.from()` error throws, copied from `lobby-de-parlamentario.tsx:308-312, 323-327`:
```tsx
if (vErr) throw new Error(`votos_de_parlamentario falló para ${id}: ${vErr.message}`);
```
> A real DB/network error is NOT "sin registros". Throw → honest error UI (project pattern #34, applied across every section). Only the `votos`→`.from("proyecto")` secondary enrichment degrades (logs, not throws) — see `votos-por-parlamentario.tsx:667-675` — but resumen counts do not need that secondary read.

---

### `app/components/carril-accordion.test.tsx` & `parlamentario-resumen.test.tsx` (RTL unit)

**Analog:** `app/components/lobby-de-parlamentario.test.tsx` (the canonical RTL pattern in this repo).

**Boilerplate to copy (`lobby-de-parlamentario.test.tsx:1-7`):**
```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LobbyView, type LobbyViewData } from "./lobby-de-parlamentario";
afterEach(cleanup);
```

**Fixture factory pattern (`lobby-de-parlamentario.test.tsx:10-42`):** `makeViewData(overrides)` — replicate as `makeChips(...)` / `makeAccordionProps(...)`.

**Assertion idioms already proven in jsdom:**
- `screen.getByText(/…/i)` / `screen.queryByText(...).not.toBeInTheDocument()` — for 3-state honest copy (`:104-134`).
- `screen.queryAllByRole("link")` + `getAttribute("href")` — for the chip `href="#votos"` anchors (`:78-81`).
- Negative copy assertions (no fabricated density) — mirror `:113-116` (`queryByText(/limpio|impecable|…/)` not present).
- For `CarrilAccordion`: assert `<h2>` present whether open/closed; assert `aria-expanded`/`data-state` on the trigger after `user-event` click (RESEARCH Wave 0 note prefers asserting `data-state` over mount/unmount in jsdom). Consider `@testing-library/user-event` for the click.

**Test the PURE views, not the async server components** — exactly like the lobby test imports `LobbyView` (pure), never `LobbySection`. So `parlamentario-resumen.test.tsx` imports `ResumenView({chips})` with fixtures; no Supabase runtime needed.

---

### `app/app/parlamentario/[id]/page.tsx` (MODIFY — orchestration shell)

**Analog:** itself. Each carril is already a `<section id="…" className="mt-12">` with an `<h2>` + `<Suspense fallback={…}>` + section (`page.tsx:54-59, 67-72, 81-88, 103-110, 121-130, 143-159, 170-179`). The skeletons (`page.tsx:242-336`) are reused unchanged.

**The wrap (RESEARCH Pattern 2) — page keeps importing the sections; the wrapper does NOT:**
```tsx
// 2. Resumen above-fold, ENTRE el header y el primer carril (UI-SPEC §1.1)
<ParlamentarioResumen id={id} />

// 3. cada carril: SECTION mantiene id + mt-12 (frontera LOCKED, NO se mueve al wrapper)
<section id="votos" className="mt-12">
  <CarrilAccordion titulo="Votaciones" conteo={…} defaultOpen={…}>
    <Suspense fallback={<VotosSkeleton />}>
      <VotosSection id={id} searchParams={sp} />   {/* Server Comp pasado como CHILD */}
    </Suspense>
  </CarrilAccordion>
</section>
```

**Invariants preserved (do NOT regress):**
- The `mt-12` stays on each sibling `<section>` in `page.tsx` (Pitfall 4 / RESEARCH; DESIGN-SYSTEM §3). The `CarrilAccordion` never owns the inter-carril margin.
- The MONEY/CRUCES gates (`page.tsx:103,121,143,170`) keep wrapping the ENTIRE `<section>` (heading included). OFF = node absent from HTML.
- `<h2>` text moves from the `<section>` into `CarrilAccordion titulo=` (the `<h2>` now lives inside `Accordion.Header asChild`).
- The `id`/regex validation (`page.tsx:44-46`, `PARLAMENTARIO_ID_RE`) and `HeaderSection`/`FinanciamientoSectionConPeriodo` server wrappers are untouched.

**Default-open heuristic (Claude's discretion):** conservador — collapse vacíos/ralos, abrir el primer carril con datos sustantivos. `defaultOpen` derives from the same 3-state counts the resumen uses (`contarCarriles(id)`), so call it once at the top of the page and pass both to `ParlamentarioResumen` and the `CarrilAccordion`s. `React.cache()` dedupes the call.

---

## Shared Patterns

### Pure-view + server-fetch split (THE testability pattern)
**Source:** `app/components/lobby-de-parlamentario.tsx:50-64` (`LobbyViewData`), `:98` (`LobbyView` pure), `:288-349` (`LobbySection` async). Mirrored in `patrimonio-de-parlamentario.tsx` (`PatrimonioView`/`PatrimonioSection`), `votos-por-parlamentario.tsx` (`VotosView`/server), `cruces-de-parlamentario.tsx:84` (`CrucesView`).
**Apply to:** `parlamentario-resumen.tsx` (split `ResumenView` pure / `ParlamentarioResumen` server) and the counts module. Test the PURE view only.

### `import "server-only"` chokepoint
**Source:** `app/lib/cruces-gate.ts:1`, `app/lib/money-gate.ts:1`, `app/lib/supabase.ts:1`.
**Apply to:** `app/lib/parlamentario-resumen-conteos.ts` (line 1) — guarantees the counts module never reaches the client bundle (V14 / Pitfall 1).

### Radix `"use client"` wrapper + `cn`
**Source:** `app/components/ui/tooltip.tsx:1-6,22`, `app/components/ui/separator.tsx:1-6,20`.
**Apply to:** `carril-accordion.tsx`. Same `"use client"` + `import * as XPrimitive` + `cn(...)` shape; new dep is the only `@radix-ui/react-accordion`.

### Lockdown guard — allowlist & PII rules (must stay green)
**Source:** `app/lib/lockdown-guard.test.ts` — `PUBLIC_RPC_ALLOWLIST` (`:157-173`) and `PII_TABLES` (`:125-136`).
**Apply to:** the counts module. Allowed RPCs already in the allowlist: `votos_de_parlamentario`, `lobby_de_parlamentario`, `declaraciones_de_parlamentario`, `cruces_de_parlamentario`. `*_ingesta_estado` and `proyecto` are NOT in `PII_TABLES` → `.from()` is guard-safe. **NO new RPC** (that is F46+). Block B scans every `app/` file including the new modules.

### Gate replication for access control
**Source:** `app/app/parlamentario/[id]/page.tsx:103,121,143,170` — `crucesPublicEnabled(process.env)` / `moneyPublicEnabled(process.env)` wrap whole `<section>`s; honest-state fallback `:170-179`.
**Apply to:** `ParlamentarioResumen` — gate the cruces/dinero chips identically; emit the `#financiamiento-pendiente` honest chip when MONEY OFF. Never list a carril absent from the page.

### Error handling #34 (throw, never degrade)
**Source:** `lobby-de-parlamentario.tsx:308-312,323-327`; `patrimonio-de-parlamentario.tsx:676,706`; `votos-por-parlamentario.tsx:651-655`; `page.tsx:203-207,229-233`.
**Apply to:** every RPC/`.from()` call in the counts module. Real error → `throw new Error(...)`; only secondary enrichment may degrade with a `console.error` (see `votos-por-parlamentario.tsx:670-675`).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | None. Every new file has a strong in-repo analog. The only genuinely new element is the `@radix-ui/react-accordion` API surface (`Accordion.Root/Header/Trigger/Content`), and the wrapping convention is already established by `tooltip.tsx`/`separator.tsx`. |

---

## Metadata

**Analog search scope:** `app/components/` (sections + `ui/` Radix wrappers + tests), `app/lib/` (gates, supabase, lockdown-guard test, utils, format), `app/app/parlamentario/[id]/page.tsx`.
**Files scanned (read in full or targeted):** `page.tsx`, `lobby-de-parlamentario.tsx`, `lobby-de-parlamentario.test.tsx`, `lockdown-guard.test.ts`, `cruces-gate.ts`, `money-gate.ts`, `ui/tooltip.tsx`, `ui/separator.tsx`, `patrimonio-de-parlamentario.tsx` (head + fetch body), `votos-por-parlamentario.tsx` (fetch body), `cruces-de-parlamentario.tsx` (grep), plus `lib/utils.ts`/`lib/format.ts` existence.
**Pattern extraction date:** 2026-06-26

## PATTERN MAPPING COMPLETE

**Phase:** 45 - LEG Navegación (acordeones por carril + resumen above-fold)
**Files classified:** 6
**Analogs found:** 6 / 6

### Coverage
- Files with exact analog: 5
- Files with role-match analog: 1 (`parlamentario-resumen-conteos.ts` → `LobbySection` fetch body + server-only gates)
- Files with no analog: 0

### Key Patterns Identified
- **Pure-view + server-fetch split** (`LobbyView`/`LobbySection`) is the testability backbone: `parlamentario-resumen.tsx` must export a pure `ResumenView({chips})` (RTL with fixtures) separate from the async `ParlamentarioResumen` server component.
- **Radix `"use client"` islands** already exist (`ui/tooltip.tsx`, `ui/separator.tsx`): `carril-accordion.tsx` copies the `"use client"` + `import * as AccordionPrimitive` + `cn` shape; `forceMount` + `data-[state=closed]:hidden` keeps SSR content in the HTML.
- **Lockdown discipline**: counts module uses ONLY allowlisted RPCs (`votos/lobby/declaraciones/cruces_de_parlamentario`) + guard-safe `.from('*_ingesta_estado')`; `import "server-only"` (gates pattern); error-throw #34; the wrapper never imports a section (no SSR leak). The `mt-12` frontier and MONEY/CRUCES gates stay on the page's `<section>`s, never on the accordion.

### File Created
`.planning/phases/45-leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol/45-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. The planner can reference each analog (file + line numbers) directly in the PLAN.md action sections.
