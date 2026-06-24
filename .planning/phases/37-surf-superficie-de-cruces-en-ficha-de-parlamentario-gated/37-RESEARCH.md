# Phase 37: SURF — Superficie de cruces en ficha de parlamentario (gated) - Research

**Researched:** 2026-06-24
**Domain:** In-repo frontend pattern mirroring (Next.js 16 App Router Server Component + presentation gate + vitest/RTL section tests)
**Confidence:** HIGH

## Summary

Phase 37 is a **build-only, gated-OFF** UI surface with **zero external/domain unknowns**. Everything needed already exists in the repo as three shipped, tested patterns: the **gate** (`money-gate.ts`/`net-gate.ts` + their unit tests), the **section component** (`lobby-de-parlamentario.tsx` — the closest analog: same crude-counterparty + `IdentityMarker` + per-item `ProvenanceBadge` shape), and the **page gate-wrap** (`page.tsx` MONEY pattern: `{moneyPublicEnabled(process.env) && <section>}`). The RPC `cruces_de_parlamentario` and its `evidencia` jsonb are **already applied to PROD** (migrations 0039/0040) — `[VERIFIED: supabase/migrations/0040_cruces_rpc.sql, 0039_cruce_senal.sql]` — so the data contract is fixed and read directly from the SQL, not assumed.

The single biggest load-bearing finding: **the RPC projects only 5 named columns** (`sector_id, sector_etiqueta, tipo_senal, conteo, evidencia`) and the per-evidence-item jsonb has **only** `{tipo, fecha, contraparte_nombre_crudo, audiencia_id, enlace_fuente}` — there is **NO `fecha_captura` and NO `origen` per item**. This shapes how `ProvenanceBadge` must be called per evidence item (see Pitfall 1). The second finding: there is **no standalone "banned-vocabulary linter"** — the anti-insinuation gate is enforced as **inline negative-match regex tests inside each section's `.test.tsx`** (`lobby-de-parlamentario.test.tsx`, `patrimonio-de-parlamentario.test.tsx`). The new component must carry its own equivalent `PROHIBIDO` regex test. The third finding: there is **no existing test for the parlamentario page's section-level gate** — the `/red` page test gates the WHOLE page via `notFound()`, which is a *different* pattern. The "gate OFF → `<section id="cruces">` absent" test is a **new** test the planner must author (approach below).

**Primary recommendation:** Mirror `lobby-de-parlamentario.tsx` for the component (NOT patrimonio — lobby is the closer shape: crude counterparty + IdentityMarker + per-row provenance), mirror `money-gate.ts` byte-for-byte for the gate, mirror the MONEY `{gate && <section>}` block in `page.tsx`, and author three test files mirroring `lobby-de-parlamentario.test.tsx` (pure view + anti-insinuation negative-match), `money-gate.test.ts` (gate truth table), and a NEW section-absent test using `renderToStaticMarkup` of the page.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read `cruce_senal` signal | API / Backend (Postgres RPC `cruces_de_parlamentario`, security definer) | — | Already shipped in 0040; deny-by-default, no anon grant. Frontend only calls it. |
| Presentation gate decision | Frontend Server (`app/lib/cruces-gate.ts`, `import "server-only"`) | — | Candado B. Never reaches browser bundle; `CRUCES_PUBLIC_ENABLED` has no `NEXT_PUBLIC_` prefix. |
| Render cruces section | Frontend Server (SSR — `CrucesSection` async Server Component) | — | No `"use client"`. Reads RPC server-side, hands a pure `CrucesView` props. |
| Pure view + anti-insinuation copy | Frontend Server (`CrucesView`, pure, RTL-testable) | — | Pure function of props → testable with fixtures, no Supabase/Next runtime. |
| Provenance per evidence item | Browser (rendered `ProvenanceBadge`, existing primitive) | — | Reused verbatim; data comes from `evidencia.items[].enlace_fuente` + `item.fecha`. |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SURF-01 | Construir (no encender) la `CrucesSection` de la ficha del parlamentario: Server Component que llama `cruces_de_parlamentario`, renderiza señales factuales con provenance inline, como carril hermano `mt-12`, detrás de `crucesPublicEnabled()` default OFF. | RPC contract verified from 0040/0039 (Standard Stack + Data Contract sections). Component mirror = `lobby-de-parlamentario.tsx`. Gate mirror = `money-gate.ts`. Page wrap mirror = MONEY block in `page.tsx`. Tests mirror = `lobby-de-parlamentario.test.tsx` + `money-gate.test.ts` + new section-absent test (Validation Architecture). |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gate (`app/lib/cruces-gate.ts`):**
- `crucesPublicEnabled(env = process.env): boolean` returns `env.CRUCES_PUBLIC_ENABLED === "true"` — ONLY the literal `"true"` enables; `undefined`/`""`/`"false"`/`"1"`/`"TRUE"` → `false`. No lax truthiness.
- `import "server-only";` on line 1. The var has NO `NEXT_PUBLIC_` prefix.
- `env` injectable (default `process.env`) for testing without touching the global.
- Absence IS the safe default (OFF), NOT a thrown error.
- Docstring: turning ON requires `signoff: approved` (Phase 39); an agent NEVER flips this flag. Doble candado = Candado A (RPC no anon grant + RLS deny-by-default on `cruce_senal`, 0039) + Candado B (this gate).

**RPC + data shape (already in PROD — DO NOT modify):**
- `cruces_de_parlamentario(p_id text)` (0040, security definer, `search_path=''`) returns NAMED columns: `sector_id` (text), `sector_etiqueta` (text), `tipo_senal` (text), `conteo` (int), `evidencia` (jsonb).
- `evidencia` jsonb (PII-safe, born so in materializer 0039) = `{ "conteo": N, "items": [ { "tipo": "reunion", "fecha": <date>, "contraparte_nombre_crudo": <string>, "audiencia_id": <string>, "enlace_fuente": <url> } ] }`. Counterparty name is CRUDO (D-10), never normalized/inferred; NO rut, NO donante_id, NO partido.
- `tipo_senal` today takes ONLY `'lobby_sector'`. Component must handle `'lobby_sector'` and degrade honestly to any future value without fabricating copy.
- RPC orders by `conteo desc, sector_id asc`.

**Component (`app/components/cruces-de-parlamentario.tsx`) — mirror of `lobby-de-parlamentario.tsx`:**
- `CrucesView` PURE (receives `data`, no Supabase/Next runtime) + `CrucesSection` async Server Component that creates `createServerSupabase()`, calls `sb.rpc("cruces_de_parlamentario", { p_id: id })`, builds the view. NO `"use client"`.
- Error #34: `if (rpcError) throw` — a real DB/network error NEVER degrades to "sin cruces".
- Empty honesto on zero cruces: factual copy that does NOT assert absence of conduct (mirror lobby state (b)).
- Per signal (RPC row): factual header with count + sector label. Wording LOCKED factual: "**N reuniones con gestores del sector {etiqueta}**" (no causal verb, no score, no affinity). Neutral count is the only aggregate.
- Per evidence item: crude counterparty name + `IdentityMarker` (never linked, never confirmed — mirror `ContraparteCruda`) + `ProvenanceBadge` with `sourceUrl = item.enlace_fuente`, item date. Every evidence traceable to the original link (FND-08).
- Reuse `ProvenanceBadge`, `IdentityMarker`, `sourceLabel`, `fechaCorta`.

**Anti-insinuation (§9.1):** Isolated carril `<section id="cruces" className="mt-12">`, sibling, NEVER shares `<article>/<Card>/<li>/<tr>` with a vote/meeting/boletín/declaration. Zero causality, zero affinity/relation, zero score/index/ranking/flag/"conflicto de interés", zero judgment adjective. Identity uncertainty = exactly "identidad no verificada" via `IdentityMarker`. Provenance mandatory per evidence; empty is a FACT not a virtue. Copy must pass the prohibited-vocabulary negative-match.

**Page (`app/app/parlamentario/[id]/page.tsx`):** Insert `<section id="cruces" className="mt-12">` as sibling, wrapped ENTIRELY in `{crucesPublicEnabled(process.env) && ( ... )}` (mirror MONEY: gate wraps the `<section>` including `<h2>`; OFF ⇒ node absent, NOT relying on the component returning null). `<h2>` LOCKED factual: "Cruces con sectores". Suspense + shape-matched skeleton (mirror `LobbySkeleton`). Import `crucesPublicEnabled` from `@/lib/cruces-gate` (NEVER read `CRUCES_PUBLIC_ENABLED` raw — chokepoint WR-02).

### Claude's Discretion
- Exact empty-state text and per-signal header text (within the factual/anti-insinuation rules above).
- Skeleton shape and pagination (probably NO pagination needed — few signals per parlamentario; render all).
- Names of the new TS types (`CruceSenalRpcRow`, `CruceEvidenciaItem`, etc.).
- Exact position of the `#cruces` carril in the page (discretion: after `#patrimonio`, before MONEY gated sections, to avoid reading as a "lobby score").

### Deferred Ideas (OUT OF SCOPE)
- Turning ON `crucesPublicEnabled` + granting the RPC to anon → Phase 39 (human legal sign-off, exclusive).
- Vote signals (`lobby_sector_voto`/`aporte_sector_voto`) in the section → deferred until sign-off.
- Cruces surface on the PROYECTO ficha (`cruces_de_proyecto`) → Phase 38.
</user_constraints>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **GSD workflow enforcement:** all file edits must go through a GSD command (`/gsd:execute-phase`). No direct edits outside the workflow.
- **`app/AGENTS.md`:** "This is NOT the Next.js you know" — Next.js 16 has breaking changes vs training data. **Mitigation:** the analog sections (`lobby`, `patrimonio`, `page.tsx`) already prove the in-repo Next 16 pattern (async Server Components, `params`/`searchParams` as Promises, `import "server-only"`); mirror them rather than relying on training-data Next.js conventions.
- **Tech stack:** TypeScript-only, Next.js 16 App Router, Server Components by default, all source-fetching server-only.
- **Anti-insinuation is a PROJECT-level hard anti-feature** (CLAUDE.md Core Value: "sin afirmar nunca intención ni causalidad"), not just a phase rule.

## Standard Stack

No new packages. Everything is in-repo. `[VERIFIED: app/package.json deps already present — vitest, @testing-library/react, react-dom, server-only, @supabase/supabase-js]`

### Core (existing, reused)
| Module | Path | Purpose | Mirror source |
|--------|------|---------|---------------|
| Gate primitive | `app/lib/money-gate.ts` / `app/lib/net-gate.ts` | `import "server-only"` + `env.X === "true"` | Copy byte-for-byte → `app/lib/cruces-gate.ts` |
| Section component | `app/components/lobby-de-parlamentario.tsx` | PURE view + async Server Component + crude counterparty + per-row provenance | Closest analog → `app/components/cruces-de-parlamentario.tsx` |
| Page shell | `app/app/parlamentario/[id]/page.tsx` (lines 88–135) | MONEY `{gate && <section>}` wrap pattern + `LobbySkeleton` | Add `#cruces` sibling |
| Provenance primitive | `app/components/provenance-badge.tsx` | `capturedAt`/`sourceName`/`sourceUrl` badge | Reuse verbatim |
| Identity primitive | `app/components/identity-marker.tsx` | "identidad no verificada" marker | Reuse verbatim |
| Source label helper | `app/lib/types.ts:517` `sourceLabel(origen)` | maps origen → display name ("Ley del Lobby") | Reuse |
| Date helper | `app/lib/format.ts:17` `fechaCorta(d: Date)` | "14 may 2026" | Reuse |
| Supabase client | `app/lib/supabase.ts` `createServerSupabase()` | server-only anon client | Reuse |

### Supporting (test infra, existing)
| Module | Path | Purpose |
|--------|------|---------|
| Test runner | `app/vitest.config.ts` | jsdom env, globals, `server-only` aliased to `node_modules/server-only/empty.js`, includes `components/**/*.test.{ts,tsx}` + `lib/**` + `app/**` |
| RTL | `@testing-library/react` (`render`, `screen`, `cleanup`) | pure-view component tests |
| SSR render | `react-dom/server` (`renderToStaticMarkup`) | used by `/red` page test to assert rendered HTML — model for the section-absent test |

**Installation:** None. No `npm install`. No new dependency.

## Package Legitimacy Audit

Not applicable — Phase 37 installs zero external packages. All modules are in-repo or already-present devDependencies (vitest, @testing-library/react, react-dom, server-only). No registry verification needed.

## Data Contract (already in PROD — DO NOT modify, DO NOT plan DDL)

`[VERIFIED: supabase/migrations/0040_cruces_rpc.sql lines 29–48]` — the RPC returns exactly:

```sql
create or replace function public.cruces_de_parlamentario(p_id text)
returns table (
  sector_id        text,
  sector_etiqueta  text,
  tipo_senal       text,   -- today ONLY 'lobby_sector'
  conteo           int,
  evidencia        jsonb
)
language sql stable security definer set search_path = ''
-- order by cs.conteo desc, cs.sector_id asc
```

`[VERIFIED: supabase/migrations/0039_cruce_senal.sql lines 99–110]` — the `evidencia` jsonb shape (built by the materializer) is exactly:

```jsonc
{
  "conteo": <int>,                 // same as the row's `conteo`
  "items": [
    {
      "tipo": "reunion",                       // literal 'reunion' today
      "fecha": "<date>",                       // a.fecha (the audiencia date)
      "contraparte_nombre_crudo": "<string>",  // c.nombre, CRUDE (D-10), never normalized
      "audiencia_id": "<string>",              // a.identificador
      "enlace_fuente": "<url>"                 // a.enlace (per-item source link)
    }
    // ordered by a.fecha desc
  ]
}
```

**TypeScript shape to add to `app/lib/types.ts` (mirror of `LobbyAudienciaRpcRow` at `types.ts:243`):**

```typescript
// Fila CRUDA del RPC cruces_de_parlamentario (0040, security definer). PII-safe:
// solo sector_id/etiqueta (catálogo público) + tipo_senal + conteo + evidencia.
// NUNCA rut/donante_id/partido (el RPC no los proyecta).
export interface CruceSenalRpcRow {
  sector_id: string;
  sector_etiqueta: string;
  tipo_senal: string;          // hoy solo 'lobby_sector'; degradar honesto a otros
  conteo: number;
  evidencia: CruceEvidencia;
}

export interface CruceEvidencia {
  conteo: number;
  items: CruceEvidenciaItem[];
}

export interface CruceEvidenciaItem {
  tipo: string;                       // 'reunion' hoy
  fecha: string | null;              // ISO date de la audiencia
  contraparte_nombre_crudo: string;  // CRUDO (D-10), nunca normalizado → IdentityMarker
  audiencia_id: string;
  enlace_fuente: string | null;      // → ProvenanceBadge.sourceUrl
}
```

(Names are Claude's discretion per CONTEXT; these mirror the lobby convention.)

## Architecture Patterns

### System Architecture Diagram

```
                              parlamentario/[id]/page.tsx  (async Server Component)
                                          │
                  ┌───────────────────────┼───────────────────────────────┐
                  │  {crucesPublicEnabled(process.env) && (                  │   ← Candado B (gate-wraps-section)
                  │     <section id="cruces" className="mt-12">             │      OFF (default) ⇒ ENTIRE node
                  │        <h2>Cruces con sectores</h2>                      │      (incl. <h2>) ABSENT from HTML
                  │        <Suspense fallback={<CrucesSkeleton/>}>          │
                  │           <CrucesSection id={id} />                     │
                  │        </Suspense>                                      │
                  │     </section> )}                                       │
                  └───────────────────────┬───────────────────────────────┘
                                          │ (only renders when gate ON — Phase 39)
                                          ▼
                            CrucesSection (async Server Component)
                                          │
                          createServerSupabase()  ──►  sb.rpc("cruces_de_parlamentario", { p_id: id })
                                          │                          │
                          if (rpcError) throw  ◄────────────────────┘  (#34: real error ≠ "sin cruces")
                                          │
                          rows: CruceSenalRpcRow[]   (Candado A: anon has NO grant ⇒ in Phase 37
                                          │            this path is unreachable in prod; gate OFF
                                          ▼            keeps it from mounting at all)
                            <CrucesView data={{ id, cruces: rows }} />   (PURE — RTL-testable)
                                          │
                ┌─────────────────────────┴──────────────────────────┐
          zero rows                                          per row (señal)
                │                                                     │
       empty honesto (FACT, not virtue)        "N reuniones con gestores del sector {etiqueta}"  (neutral count)
                                                                      │
                                                         per evidencia.items[] item:
                                                           contraparte_nombre_crudo + <IdentityMarker/>
                                                           + <ProvenanceBadge sourceUrl={item.enlace_fuente}
                                                                              capturedAt={fechaItem}
                                                                              sourceName={sourceLabel('lobby')} />
```

### Recommended file changes
```
app/
├── lib/
│   ├── cruces-gate.ts            # NEW — byte-for-byte mirror of money-gate.ts
│   ├── cruces-gate.test.ts       # NEW — mirror of money-gate.test.ts (5-row truth table)
│   └── types.ts                  # EDIT — add CruceSenalRpcRow / CruceEvidencia / CruceEvidenciaItem
├── components/
│   ├── cruces-de-parlamentario.tsx       # NEW — CrucesView (pure) + CrucesSection (Server Component)
│   └── cruces-de-parlamentario.test.tsx  # NEW — mirror of lobby-de-parlamentario.test.tsx
└── app/parlamentario/[id]/
    ├── page.tsx                  # EDIT — add gated <section id="cruces"> sibling + CrucesSkeleton
    └── page.test.tsx             # NEW — section-absent (gate OFF) test (no existing parlamentario page test)
```

### Pattern 1: Gate (byte-for-byte mirror of money-gate)
**What:** server-only env flag, fail-closed, injectable env.
**Example:**
```typescript
// Source: app/lib/money-gate.ts (verbatim structure)
import "server-only";

/** ...docstring referencing cruces / Phase 39 / 0039–0040 / doble candado... */
export function crucesPublicEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.CRUCES_PUBLIC_ENABLED === "true";
}
```

### Pattern 2: Page gate-wraps-section (mirror MONEY block)
**What:** the gate wraps the ENTIRE `<section>` incl. `<h2>` so OFF ⇒ node absent (NOT component-returns-null).
**Example:**
```tsx
// Source: app/app/parlamentario/[id]/page.tsx lines 97–106 (MONEY contratos)
{crucesPublicEnabled(process.env) && (
  <section id="cruces" className="mt-12">
    <h2 className="text-xl font-semibold mb-4">Cruces con sectores</h2>
    <Suspense fallback={<CrucesSkeleton />}>
      <CrucesSection id={id} />
    </Suspense>
  </section>
)}
```
Note: `CrucesSection` does NOT need `searchParams` if no pagination (discretion: render all). Lobby/Patrimonio take `searchParams` only for pagination/comparison.

### Pattern 3: Pure view + Server Component split
**What:** `CrucesView({ data })` pure (RTL fixtures) + `async CrucesSection({ id })` reads RPC. No `"use client"`.
**Example skeleton:**
```tsx
// Source: app/components/lobby-de-parlamentario.tsx (LobbySection lines 284–345)
export async function CrucesSection({ id }: { id: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("cruces_de_parlamentario", { p_id: id });
  if (error) throw new Error(`cruces_de_parlamentario falló para ${id}: ${error.message}`);
  const cruces = (data as CruceSenalRpcRow[] | null) ?? [];
  return <CrucesView data={{ id, cruces }} />;
}
```

### Anti-Patterns to Avoid
- **Relying on `CrucesSection` returning `null` to hide the heading.** The gate must wrap the `<section>` incl. `<h2>` in `page.tsx` (mirror MONEY). OFF ⇒ the whole node is absent.
- **Reading `process.env.CRUCES_PUBLIC_ENABLED` raw anywhere.** Always go through `crucesPublicEnabled()` (chokepoint WR-02).
- **Nesting `#cruces` inside `#lobby` or any other section, or sharing a `<li>/<article>/<tr>` with a lobby/vote/declaration.** `mt-12` sibling is the anti-insinuation boundary.
- **Calling `ProvenanceBadge` with a `fecha_captura` field — it does not exist per item** (see Pitfall 1).
- **Linking the counterparty name or treating it as confirmed.** Always crude text + `IdentityMarker`, never a link (mirror `ContraparteCruda`, lobby lines 73–95).
- **Adding any `grant ... to anon`, any migration, or flipping the flag.** All three are Phase 39 / out of scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provenance badge | Custom date/source markup | `ProvenanceBadge` (`provenance-badge.tsx`) | Handles stale (48h amber), `safeExternalHref`, "fuente desconocida" fallback, tooltip |
| Identity disclaimer | Custom "no verificado" span | `IdentityMarker` | Exact LOCKED copy "identidad no verificada" (§9.3 rule 4) |
| Source name | String switch on origen | `sourceLabel(origen)` (`types.ts:517`) | Already maps `'lobby'` → "Ley del Lobby" |
| Date formatting | `Intl.DateTimeFormat` inline | `fechaCorta(new Date(...))` | es-CL "14 may 2026" |
| Supabase client | `createClient(...)` | `createServerSupabase()` | server-only, reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` un-prefixed |
| Gate truthiness | `Boolean(env.X)` | `env.X === "true"` | Lax truthiness lets `"false"` through — security bug |

**Key insight:** Every primitive this phase needs is already shipped and tested. The phase is mechanical mirroring; the only authored logic is the `CrucesView` render and the test assertions.

## Common Pitfalls

### Pitfall 1: `evidencia.items[]` has NO `fecha_captura` and NO `origen` per item
**What goes wrong:** Mirroring lobby's `ProvenanceBadge` call (`capturedAt={a.fecha_captura}`, `sourceName={sourceLabel(a.origen)}`) will fail to typecheck / pass undefined, because the cruces evidencia item only carries `{tipo, fecha, contraparte_nombre_crudo, audiencia_id, enlace_fuente}`.
**Why it happens:** The RPC projects `evidencia` jsonb only; `fecha_captura`/`origen`/`dataset`/`enlace` are columns on `cruce_senal` that the RPC **does not** project (0040 selects only `sector_id, etiqueta, tipo_senal, conteo, evidencia`).
**How to avoid:** Per evidence item call `ProvenanceBadge` with:
- `sourceUrl = item.enlace_fuente`
- `capturedAt = item.fecha ? new Date(item.fecha) : null` (the audiencia date; there is no separate capture timestamp at item granularity — using the meeting date is honest, or pass `null` → badge shows "Sin fecha de actualización", also honest)
- `sourceName = sourceLabel("lobby")` → "Ley del Lobby" (the signal is lobby-pure today; the literal `"lobby"` is the dataset the materializer wrote — `sourceLabel` maps any string containing "lobby" first, `types.ts:522`)
**Warning signs:** TypeScript "Property 'fecha_captura' does not exist on type 'CruceEvidenciaItem'".

### Pitfall 2: `fecha` can be null and `enlace_fuente` can be null
**What goes wrong:** `new Date(null)` → Invalid Date; passing a null URL to a raw `<a href>` would be wrong. `ProvenanceBadge` already tolerates `sourceUrl: null` (shows no link) and `capturedAt: null` (shows "Sin fecha de actualización"). Mirror lobby's null-guard (lobby lines 152–156).
**How to avoid:** Guard `item.fecha` before `new Date(...)`; pass `item.enlace_fuente` straight to `ProvenanceBadge` (it null-checks internally via `safeExternalHref`).

### Pitfall 3: Treating empty (zero rows) as a virtue
**What goes wrong:** Copy like "no tiene cruces" / "limpio" reads as exoneration.
**How to avoid:** Mirror lobby state (b) exactly — factual, e.g. "No se registran cruces de sector para este parlamentario con los datos actuales." The negative-match test (see Validation Architecture) must reject `/limpio|impecable|sin compromisos|transparente|no se reúne/i`. Note: cruces has only ONE empty state (zero rows) — there is NO `noIngestado` marker table for cruces (the lobby/patrimonio (a)-vs-(b) split does not apply; the signal is a materialized aggregate, absent = no confirmed-classified audiencias).

### Pitfall 4: `tipo_senal` other than `'lobby_sector'`
**What goes wrong:** Future tokens (`lobby_sector_aporte`, vote signals) would render with fabricated copy if the header text is hard-bound to "reuniones".
**How to avoid:** The per-signal header wording is tied to `tipo_senal === 'lobby_sector'`. For an unknown token, degrade honestly (render the neutral count + sector etiqueta without a meeting-specific verb, or a generic factual line) — do NOT fabricate. Today the DB CHECK constraint (`tipo_senal in ('lobby_sector')`, 0039 line 50) guarantees only `'lobby_sector'`, but the component must not crash on a future value.

### Pitfall 5: Authoring DDL or a pgTAP test for the RPC
**What goes wrong:** 0039/0040 are ALREADY APPLIED to PROD (Phase 36, per STATE/MEMORY). Re-touching `supabase/migrations/` causes schema_migrations drift.
**How to avoid:** CERO DDL. The phase is frontend-only. The RPC contract is read-only reference.

## Validation Architecture

> `workflow.nyquist_validation` assumed enabled (key absent ⇒ enabled). Test framework confirmed = **vitest + @testing-library/react**, jsdom, `app/vitest.config.ts`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (jsdom, globals) + @testing-library/react |
| Config file | `app/vitest.config.ts` (`server-only` aliased to empty build; includes `lib/**`, `components/**`, `app/**` `*.test.{ts,tsx}`) |
| Quick run command | `cd app && npx vitest run cruces` (runs the 3 new files matching "cruces") |
| Full suite command | `cd app && npx vitest run` |
| Setup | `app/vitest.setup.ts` (jest-dom matchers, already wired) |

### Phase Requirements → Test Map (observable behaviors)
| Req | Behavior | Test Type | Test approach (mirror) | File |
|-----|----------|-----------|------------------------|------|
| SURF-01 | Gate truth table: absent/`"false"`/`"1"`/`"TRUE"` → false; `"true"` → true | unit | Verbatim mirror of `money-gate.test.ts` (5 `it` cases) | `app/lib/cruces-gate.test.ts` (NEW) |
| SURF-01 | **Gate OFF ⇒ `<section id="cruces">` ABSENT from HTML** (node absent, not CSS-hidden) | integration | Mock `@/lib/cruces-gate` → false; mock `@/lib/supabase`; render page via `renderToStaticMarkup`; assert `html` does NOT contain `id="cruces"` and contains no "Cruces con sectores"; assert `createServerSupabase` NOT called. Mirror `app/app/red/page.test.tsx` mock+`renderToStaticMarkup` style (but assert ABSENCE, not `notFound`). | `app/app/parlamentario/[id]/page.test.tsx` (NEW) |
| SURF-01 | Gate ON ⇒ section renders without throwing on a normal fixture (no hydration error) | integration | Same file, gate mock → true, RPC mock returns 1 row; assert `html` contains "Cruces con sectores" and the sector etiqueta; resolves truthy. | `app/app/parlamentario/[id]/page.test.tsx` |
| SURF-01 | Empty-honest: zero cruces → factual copy, NEVER "limpio/impecable/transparente" | RTL | Render `CrucesView` with `cruces: []`; `getByText(/no se registran cruces de sector/i)`; `queryByText(/limpio|impecable|sin compromisos|transparente|no se reúne/i)` is null. Mirror lobby state-(b) test. | `app/components/cruces-de-parlamentario.test.tsx` |
| SURF-01 | Per-evidence provenance: each item renders a `ProvenanceBadge` with link to `enlace_fuente` | RTL | Fixture with N items; `getAllByText(/fuente oficial ↗/i).length` === N. Mirror lobby provenance test. | `cruces-de-parlamentario.test.tsx` |
| SURF-01 | Counterparty is CRUDE text + `IdentityMarker`, NEVER a link, NEVER a RUT | RTL | `getByText(contraparte_nombre_crudo)`; `getAllByLabelText("identidad no verificada").length > 0`; no `link` contains the name; `textContent` does NOT match RUT regex `/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/`. Mirror lobby §3.2 tests. | `cruces-de-parlamentario.test.tsx` |
| SURF-01 | Carril aislado: no composed vote/boletín/proyecto; no causal/affinity/score copy | RTL negative-match | Render `CrucesView` with ≥2 señales; assert `textContent` does NOT match the `PROHIBIDO` regex (see below) and does NOT match `/voto|votación|votacion|boletín|boletin|a favor|en contra/i`; no link `href` matches `^/proyecto/` or `^/parlamentario/`. Mirror `lobby-de-parlamentario.test.tsx` §9.1 + carril-aislado tests. | `cruces-de-parlamentario.test.tsx` |
| SURF-01 | Neutral count is the only aggregate; per-signal header is factual | RTL | `getByText(/\d+ reuniones con gestores del sector/i)` (or the chosen LOCKED wording); no score/index. | `cruces-de-parlamentario.test.tsx` |

### Banned-vocabulary / anti-insinuation enforcement
**Finding:** There is **NO standalone banned-vocabulary linter or shared negative-match module** in the repo. `[VERIFIED: grep across repo — matches are all inline test constants]`. The §9.1 gate is enforced as **inline regex constants inside each section's own `.test.tsx`**:
- `app/components/lobby-de-parlamentario.test.tsx` lines 176–178: `const PROHIBIDO = /se reunió para|a cambio de|antes de votar|que resultó en|cercano a|vinculad[oa] a|aliad[oa] de|su lobista|lobista habitual|se reúne más|afinidad|conflicto de inter|posible conflicto|influencia|influyente|score|ranking|índice de|leaderboard|sospechos|polémic|controversial|oscuro/i;`
- `app/components/patrimonio-de-parlamentario.test.tsx` lines 24–30: `PROHIBIDO_VEREDICTO` + `PROHIBIDO_CONECTIVO` + `PATRON_RUT`.

**Action for Phase 37:** The new `cruces-de-parlamentario.test.tsx` MUST carry its own `PROHIBIDO` regex constant (mirror lobby's, since cruces is lobby-shaped) and assert the rendered `textContent` does not match it, plus the RUT pattern `PATRON_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/`. There is no shared linter to "extend" — the obligation is satisfied by adding the inline negative-match test (this is the established repo convention).

### Sampling Rate
- **Per task commit:** `cd app && npx vitest run cruces`
- **Per wave merge / phase gate:** `cd app && npx vitest run` (full suite green before `/gsd:verify-work`)

### Wave 0 Gaps
- [ ] `app/lib/cruces-gate.test.ts` — gate truth table (mirror money-gate.test.ts)
- [ ] `app/components/cruces-de-parlamentario.test.tsx` — pure view + anti-insinuation negative-match + provenance + identity (mirror lobby-de-parlamentario.test.tsx)
- [ ] `app/app/parlamentario/[id]/page.test.tsx` — **NEW pattern, no existing analog**: section-absent (gate OFF) + section-present (gate ON) via mocked gate/supabase + `renderToStaticMarkup`. The closest mock-and-SSR-render scaffold is `app/app/red/page.test.tsx` (copy its `vi.mock` setup for `@/lib/cruces-gate`, `@/lib/supabase`, and `react-dom/server` import), but assert section ABSENCE rather than `notFound()`.
- Framework install: none — vitest/RTL already present.

## Runtime State Inventory

Not a rename/refactor/migration phase — greenfield component additions only. No stored data, live config, OS state, secrets, or build artifacts are renamed or migrated. The only new env var (`CRUCES_PUBLIC_ENABLED`) is intentionally LEFT UNSET (default OFF); setting it is Phase 39. **None — verified by phase scope (build-only, gated-OFF, CERO DDL).**

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | tests | ✓ (in `app/`, `npx vitest`) | per app/package.json | — |
| @testing-library/react | RTL tests | ✓ | per app/package.json | — |
| Supabase (runtime) | `CrucesSection` RPC call | not needed at build/test time | — | Tests mock `createServerSupabase`; the RPC path is unreachable in prod (gate OFF + no anon grant) until Phase 39 |

**Note:** Phase 37 does NOT require a live DB or applied migrations to complete — the component and its tests are pure/mocked. The RPC is already in PROD (Phase 36) but is irrelevant to building/testing this gated-OFF surface.

## Security Domain

This is a presentation surface behind a **double lock**; the security model is the core of the phase.

| Control | Applies | Standard pattern (in-repo) |
|---------|---------|----------------------------|
| Candado A — data (RLS deny-by-default on `cruce_senal` + RPC `revoke execute from anon, authenticated`, NO grant) | yes | Already shipped in 0039/0040 — Phase 37 must NOT weaken it (no grant, no policy). |
| Candado B — presentation gate (`crucesPublicEnabled`, server-only, fail-closed) | yes | Mirror `money-gate.ts` / `net-gate.ts`. |
| Input validation (V5) | yes | `[id]` validated against `PARLAMENTARIO_ID_RE` in `page.tsx` BEFORE any DB touch (already present). |
| Secret/flag exposure | yes | `CRUCES_PUBLIC_ENABLED` un-prefixed (no `NEXT_PUBLIC_`) + `import "server-only"` ⇒ never in browser bundle. |
| PII leakage (Ley 21.719, LEGAL-03) | yes | RPC is PII-safe by construction (no rut/donante_id/partido); evidencia counterparty is CRUDE name only. RTL test asserts no RUT pattern + no familiar terms in DOM. |

| Threat | STRIDE | Mitigation (Phase 37 obligation) |
|--------|--------|----------------------------------|
| Premature public exposure of cruces before legal sign-off | Information Disclosure | Both locks intact: gate OFF default + no anon grant. Section-absent test proves OFF ⇒ no DOM. |
| Insinuation of causality/affinity (existential risk #1) | Tampering (of meaning) | Anti-insinuation §9.1 negative-match test + carril `mt-12` sibling isolation. |
| Agent flipping the flag / granting RPC | Elevation of Privilege | Out of scope (Phase 39, human-exclusive). RESEARCH flags both as landmines. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-evidence-item provenance should use `item.fecha` as `capturedAt` (or `null`) and `sourceLabel("lobby")` as `sourceName`, since the RPC projects no per-item `fecha_captura`/`origen`. | Pitfall 1 | LOW — both `null` and the meeting date are honest renderings; planner/discuss may pick. Does not affect security. The badge tolerates both. |
| A2 | Cruces has only ONE empty state (zero rows) — no `noIngestado` marker table analogous to `lobby_ingesta_estado`. | Pitfall 3 | LOW — verified by absence of any cruces ingesta-estado table in 0039; if a marker existed it would only add a second honest empty copy, not change the gate behavior. |
| A3 | No pagination needed (render all señales). | Discretion | LOW — explicitly CONTEXT discretion; few sectors per parlamentario. |

**All other claims are [VERIFIED] against the cited migration/component/test files in-repo.**

## Open Questions

1. **Exact `capturedAt` for the cruces ProvenanceBadge.**
   - What we know: the evidencia item has `fecha` (the meeting date) but no separate capture timestamp; the RPC doesn't project `cruce_senal.fecha_captura`.
   - What's unclear: whether to show the meeting date (`item.fecha`) as "Actualizado…" (slightly conflates meeting-date with capture-date) or pass `null` (badge shows "Sin fecha de actualización").
   - Recommendation: pass `item.fecha ? new Date(item.fecha) : null`. The badge copy ("Actualizado {relativeTimeEs}") with a meeting date is defensible as "dato de la reunión del…"; or null is strictly honest. Planner's call — low stakes, both pass the gate. Either way `sourceUrl = item.enlace_fuente` is the load-bearing traceability (FND-08), which is unambiguous.

## Sources

### Primary (HIGH confidence — in-repo, read this session)
- `supabase/migrations/0040_cruces_rpc.sql` — RPC signature + 5 named columns + order-by + no-anon-grant
- `supabase/migrations/0039_cruce_senal.sql` — `evidencia` jsonb item shape (lines 99–110), CHECK `tipo_senal in ('lobby_sector')`, deny-by-default
- `app/lib/money-gate.ts`, `app/lib/net-gate.ts` — gate pattern to mirror byte-for-byte
- `app/lib/money-gate.test.ts`, `app/lib/net-gate.test.ts` — gate unit-test truth table
- `app/components/lobby-de-parlamentario.tsx` — closest section analog (pure view + Server Component + ContraparteCruda + per-row provenance)
- `app/components/lobby-de-parlamentario.test.tsx` — anti-insinuation negative-match + carril-aislado + provenance + identity tests
- `app/components/patrimonio-de-parlamentario.tsx` / `.test.tsx` — second analog + `PROHIBIDO_VEREDICTO`/`PROHIBIDO_CONECTIVO`/`PATRON_RUT` constants
- `app/app/parlamentario/[id]/page.tsx` — MONEY gate-wraps-section pattern (lines 88–135) + `LobbySkeleton`
- `app/app/red/page.test.tsx` — mock + `renderToStaticMarkup` page-gate test scaffold (model for section-absent test)
- `app/components/provenance-badge.tsx`, `app/components/identity-marker.tsx` — reused primitives
- `app/lib/types.ts` (`LobbyAudienciaRpcRow` @243, `sourceLabel` @517), `app/lib/format.ts` (`fechaCorta` @17) — types/helpers to mirror
- `app/lib/supabase.ts` — `createServerSupabase`
- `app/vitest.config.ts` — test framework config
- `.planning/phases/37-.../37-CONTEXT.md` — LOCKED decisions
- `CLAUDE.md`, `app/AGENTS.md` — project constraints

### Secondary / Tertiary
- None — no web research performed (per objective: research surface is entirely in-repo).

## Metadata

**Confidence breakdown:**
- Data contract (RPC + evidencia shape): HIGH — read directly from applied migration SQL
- Component/gate/page patterns: HIGH — three shipped analogs read in full
- Test approach: HIGH for gate + pure-view (verbatim mirrors exist); MEDIUM for the page section-absent test (NEW — no existing parlamentario page test; scaffold adapted from `/red` page test)
- Pitfalls: HIGH — derived from concrete divergences between cruces RPC projection and lobby RPC projection

**Research date:** 2026-06-24
**Valid until:** ~2026-07-24 (stable — in-repo patterns; only invalidated if 0039/0040 are re-migrated, which is out of scope)

## RESEARCH COMPLETE
