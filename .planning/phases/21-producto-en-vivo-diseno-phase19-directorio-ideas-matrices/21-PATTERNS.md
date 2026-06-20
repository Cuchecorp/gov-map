# Phase 21: Producto en vivo — Diseño Phase 19 + directorio de parlamentarios + ideas matrices - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 8 (5 NEW, 3 MODIFY)
**Analogs found:** 8 / 8 (every new file has a strong in-repo analog; GlobalHeader is the only "no structural analog" — see notes)

> This is a **wiring + backfill** phase: almost nothing is invented. Every new file mirrors an existing pattern. The planner should copy the analog excerpts below verbatim and adjust the data shape.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0026_parlamentarios_publico_listado.sql` | migration (RPC) | request-response (read) | `supabase/migrations/0020_parlamentario_publico.sql` | exact (mirror, drop `p_id`) |
| `app/app/parlamentarios/page.tsx` | route (RSC page) | request-response (read) | `app/app/buscar/page.tsx` + `app/app/parlamentario/[id]/page.tsx` | exact (RSC + searchParams + Suspense) |
| `app/components/parlamentario-directory-row.tsx` | component (presentational) | transform (props→JSX) | `app/components/search-result-card.tsx` + `app/components/parlamentario-header.tsx` | role-match (display row + Link) |
| `app/components/global-header.tsx` | component (layout shell) | transform (static nav) | `app/components/parlamentario-header.tsx` (server cmpt shape) + `app/components/search-box.tsx` (client island, if mobile menu) | partial (no existing site-nav header) |
| `app/app/globals.css` | config (design tokens) | n/a | `app/app/globals.css:5-26` (self — extend `:root`/`.dark`) | exact (same file, same format) |
| `app/app/layout.tsx` | config (root shell) | n/a | `app/app/layout.tsx` (self — mount header in `<body>`) | exact (self) |
| `packages/fichas/src/writer-supabase.ts` | service (DB writer/reader) | CRUD (read join) | self, lines 123-148 (`leerPendientes`) + `connector-senado.ts` (Option A re-fetch) | exact (modify in place) |
| `packages/tramitacion/src/writer-supabase.ts` | service (DB writer) | CRUD (upsert) | self, `upsertProyecto` + migration column (Option B only) | exact (modify in place, conditional) |

## Pattern Assignments

### `supabase/migrations/0026_parlamentarios_publico_listado.sql` (migration, RPC) — SC2

**Analog:** `supabase/migrations/0020_parlamentario_publico.sql` (read in full, 52 lines)

The new RPC is a **near-exact mirror** of `parlamentario_publico(p_id)` with two changes: (1) drop the `p_id text` parameter and the `where p.id = p_id` clause; (2) add an `order by` for a stable neutral listing. **It MUST NOT emit `partido`/`rut`/`email`** (LEGAL-03 deny-by-default) and **MUST NOT** add any `create policy` / `grant select` on `parlamentario`.

**Header doc + security contract to copy** (`0020...sql:19-26`):
```sql
-- PROHIBIDO en esta migración (violaría LEGAL-03): NINGUNA `create policy` sobre
-- `parlamentario`, NINGÚN `grant select` que exponga `partido`/`rut`/`email` a anon.
-- El único canal a la maestra es el cuerpo de este `security definer`, y solo emite
-- columnas públicas. `set search_path = ''` (V8): nombres calificados con schema.
```

**Function body to mirror** (`0020...sql:28-51` — drop `p_id`, add order):
```sql
create or replace function parlamentarios_publico()
returns table (
  id text, nombre text, camara text,
  region text, distrito text, circunscripcion text, periodo text
)
language sql stable security definer set search_path = '' as $$
  select p.id,
         coalesce(
           nullif(trim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), ''),
           p.nombre_normalizado
         ) as nombre,
         p.camara, p.region, p.distrito, p.circunscripcion, p.periodo
  from public.parlamentario p
  order by p.apellido_paterno nulls last, p.nombre_normalizado;  -- orden NEUTRAL (§10.5)
$$;
grant execute on function parlamentarios_publico() to anon;
```

**Critical (from RESEARCH Pitfall 5):** `camara` is NOT NULL; `region`/`distrito`/`circunscripcion`/`periodo` are NULLABLE (`0005_parlamentario.sql:27`). The RPC emits them anyway; the filter that excludes nullable columns lives in the RSC, not here. Application of the DDL is an **operator checkpoint** (psql `--db-url`), not part of build/typecheck — same as 0018/0019/0020.

**Test analog:** create `0026_*.test.sql` (pgTAP) — assert anon cannot read `partido`/`rut`/`email` from `parlamentario` directly and that the RPC row shape has exactly the 7 safe columns. (Wave 0 gap per RESEARCH.)

---

### `app/app/parlamentarios/page.tsx` (route, RSC page) — SC2

**Analog (structure):** `app/app/buscar/page.tsx` (read in full, 180 lines) — the canonical "RSC page with `searchParams` Promise + Suspense + inner async data component + skeleton + honest-empty" pattern. **Analog (RPC fetch + error-not-empty):** `app/app/parlamentario/[id]/page.tsx:177-195`.

**Page shell + `searchParams` Promise (Next 16)** — copy from `buscar/page.tsx:25-58`:
```tsx
interface PageProps {
  searchParams: Promise<{ camara?: string | string[]; q?: string | string[] }>;
}

export default async function ParlamentariosPage({ searchParams }: PageProps) {
  const sp = await searchParams;                       // Next 16: ALWAYS a Promise
  const camara = typeof sp.camara === "string" ? sp.camara : undefined;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, MAX_QUERY_CHARS); // reuse cap
  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <h1 className="text-3xl font-semibold leading-tight">Parlamentarios</h1>
      <Suspense key={`${camara}::${q}`} fallback={<DirectorySkeleton />}>
        <DirectoryList camara={camara} q={q} />
      </Suspense>
    </main>
  );
}
```

**RPC fetch — error is NOT empty (honest degradation)** — copy from `parlamentario/[id]/page.tsx:177-195`:
```tsx
async function DirectoryList({ camara, q }: { camara?: string; q?: string }) {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("parlamentarios_publico");
  if (error) {
    // #34: a real DB/network failure is an ERROR banner, never "Sin resultados".
    throw new Error(`parlamentarios_publico falló: ${error.message}`);
  }
  let rows = (data as ParlamentarioListadoRow[] | null) ?? [];
  // Server-side filter over 186 rows (cheap). camara is NOT NULL; nombre is searchable.
  if (camara === "diputados" || camara === "senado") rows = rows.filter((r) => r.camara === camara);
  if (q) rows = rows.filter((r) => r.nombre.toLowerCase().includes(q.toLowerCase()));
  if (rows.length === 0) { /* honest-empty block, copy buscar/page.tsx:77-87 */ }
  // ...map to <ParlamentarioDirectoryRow />
}
```

**Input validation (V5):** validate `camara ∈ {diputados,senado}` (drop otherwise); reuse `MAX_QUERY_CHARS` (`app/lib/buscar.ts:56`) to cap `q`. **Do NOT** filter by `region`/`distrito` as the primary axis (RESEARCH Pitfall 5: nullable → drops senators). Honest-empty block: copy `buscar/page.tsx:77-87`. Skeleton + pagination pattern: copy `buscar/page.tsx:131-180`.

**Imports to copy** (`buscar/page.tsx:1-12`): `Suspense`, `Link` (`next/link`), `createServerSupabase` (`@/lib/supabase`), `MAX_QUERY_CHARS` (`@/lib/buscar`), `Skeleton`/`Card` (`@/components/ui/*`).

**Test analog:** `app/app/parlamentarios/page.test.tsx` (RTL) — render 186 + filter + honest empty. Wave 0 gap.

---

### `app/components/parlamentario-directory-row.tsx` (component, presentational) — SC2

**Analog (display + Link):** `app/components/search-result-card.tsx` (a `<Card>`-wrapped clickable result row). **Analog (parlamentario field rendering: CamaraChip + cargo string):** `app/components/parlamentario-header.tsx:21-64` (read in full).

**Cargo-string composition to copy** (`parlamentario-header.tsx:30-37`):
```tsx
const cargoPartes = [
  parlamentario.distrito ? `Distrito ${parlamentario.distrito}` : null,
  parlamentario.circunscripcion ? `Circunscripción ${parlamentario.circunscripcion}` : null,
  parlamentario.region,
].filter((p): p is string => Boolean(p));
// render: {cargoPartes.length > 0 && <p className="text-sm text-muted-foreground">{cargoPartes.join(" · ")}</p>}
```

**Link target:** each row links to `/parlamentario/${id}` (id is `D####`/`S####`). Reuse `<CamaraChip camara={r.camara} />` (`@/components/camara-chip`). **No photo, no partido** (LEGAL-03; `parlamentario-header.tsx:11-19` documents why). The row consumes the 7-column listado shape — NOT `ParlamentarioPublicoRow` (which has `origen`/`fecha_captura`/`enlace`). Define a new `ParlamentarioListadoRow` interface in `app/lib/types.ts` mirroring `ParlamentarioPublicoRow` (`types.ts:109-120`) minus the provenance fields.

---

### `app/components/global-header.tsx` (component, layout shell) — SC1

**Analog (server-component shape):** `app/components/parlamentario-header.tsx` — a `function` (no `"use client"`) returning a `<header>`. **Analog (client island, ONLY if a mobile hamburger menu is added):** `app/components/search-box.tsx:1-44` — the repo's single `"use client"` island pattern (`useState` + `useRouter`, progressive-enhancement form).

**No existing site-nav header exists** — this is the one genuinely new component. Build it as a **server component by default** (no client JS needed for desktop nav of static `<Link>`s). Spec source: `19-UI-SPEC.md §11.0` + `mockup/landing.html` (LOCKED). Nav items (from CONTEXT/RESEARCH diagram): wordmark→`/` · Buscar (`/buscar`) · Parlamentarios (`/parlamentarios`) · Agenda (`/agenda`) · Sobre/Metodología.

**Pattern to copy (server header skeleton):** `parlamentario-header.tsx:39-62` — plain `<header>` with Tailwind tokens, no client hooks. Use `Link` from `next/link`. If a mobile menu toggle is required, isolate ONLY that toggle into a `"use client"` child island (mirror `search-box.tsx` `useState`), keeping the header itself server-only — same split the repo already uses (server page + `SearchBox` island).

**Token usage:** consume the new tokens via Tailwind classes backed by CSS vars (`bg-background`, `text-foreground`, `border-border`, focus `ring` → petróleo). Do not hardcode hex.

---

### `app/app/globals.css` (config, design tokens) — SC1

**Analog:** the file itself, `globals.css:5-26` (`:root`) and `:28-48` (`.dark`). Read in full (72 lines).

**EXTEND, do not replace** (RESEARCH Pitfall 4): override only `--background`/`--card`/`--muted`/`--muted-foreground`/`--border`/`--foreground`, ADD `--accent-product`, retune `--ring`. **Leave `--primary`/`--secondary`/`--radius`/`--popover`/`--destructive`/`--input` untouched** (shadcn consumes them). The `@import "./styles/civic-tokens.css";` on **line 51 stays INTACT** — `--camara`/`--senado` are data identity, never touched (LOCKED).

**Format is HSL space-separated WITHOUT `hsl()`** (consumed as `hsl(var(--x))`). Mixing formats breaks Tailwind v4. Values are LOCKED in `mockup/landing.html:40-48`:
```css
:root {
  --background: 40 33% 97%;        /* crema — was 0 0% 100% */
  --card: 40 30% 99%;
  --muted: 40 20% 93%;
  --muted-foreground: 222 14% 42%;
  --border: 40 16% 86%;
  --foreground: 222 47% 11%;
  --accent-product: 183 38% 26%;   /* petróleo — NEW */
  --ring: 183 38% 26%;             /* retune to petróleo */
}
.dark {
  --background: 222 28% 7%;
  --card: 222 24% 12%;
  --muted: 222 20% 16%;
  --accent-product: 183 34% 46%;
}
```

The `@layer base` block (`globals.css:53-65`, body bg/color/font) already reads `hsl(var(--background))`/`hsl(var(--foreground))` → it inherits the new tokens with **zero changes**. Existing pages (`max-w-3xl/5xl`, `text-xl`, `mt-12`) inherit automatically.

---

### `app/app/layout.tsx` (config, root shell) — SC1

**Analog:** the file itself (read in full, 40 lines).

**Mount `<GlobalHeader/>` inside `<body>`, above `{children}`.** Do NOT touch `generateMetadata` (the noindex toggle, `layout.tsx:20-28`) — it is LOCKED at the Phase-20 state. Only change: add the import and render the header.
```tsx
import { GlobalHeader } from "@/components/global-header";
// ...
<body>
  <GlobalHeader />
  {children}
</body>
```
The `<html lang="es" className={...font vars}>` shell (`layout.tsx:36`) stays. Optionally add a background className on `<body>` if the spec requires, but the token-driven `@layer base body` rule already paints crema — prefer no className change.

---

### `packages/fichas/src/writer-supabase.ts` (service, DB read) — SC3 (SC3 root cause)

**Analog:** the file itself, `leerPendientes` at **lines 123-148** (read in full). **The bug:** line 143 hardcodes `link_mensaje_mocion: null`, so the pipeline ALWAYS degrades to "título+materia" and `idea_matriz` stays 0/74.

**Current (broken) excerpt** (`writer-supabase.ts:139-147`):
```ts
return ((data ?? []) as unknown as JoinRow[]).map((r) => ({
  boletin: r.boletin,
  titulo: r.proyecto?.titulo ?? "",
  materia: r.proyecto?.materia ?? null,
  link_mensaje_mocion: null,          // ← SC3 ROOT CAUSE (line 143)
  estado: r.estado,
  ...
}));
```

**Fix — Option A (RECOMMENDED for this phase, no DDL):** per pending boletín, re-fetch the Senado XML and extract the real link. Wire the connector + parser already in the repo:
- `SenadoConnector.fetchTramitacion(boletinBase)` — `connector-senado.ts:45` (reuses `@obs/ingest` allowlist + robots + 2-3s rate-limit; `senado.cl` already allowlisted).
- `parseSenadoTramitacion(xml).linkMensajeMocion` — `parse-senado-tramitacion.ts:57-83` (the sidecar; `null` when absent → honest degradation preserved).
- Strip the commission suffix to the BASE boletín before fetching (`parse-senado-tramitacion.ts:79`, `boletin.replace(/-\d+$/, "")`).

The fetch must run through the **same `@obs/ingest` policy** the pipeline already assembles (`pipeline-cli.ts:158-161`: `Fetcher`/`HostRateLimiter`/`RobotsGuard`). Do NOT hand-roll fetch (RESEARCH "Don't Hand-Roll").

**Fix — Option B (persistent, long-term):** add `link_mensaje_mocion text` to `proyecto` (new migration), persist it in `SupabaseTramitacionWriter.upsertProyecto` (see next file), backfill, then `leerPendientes` reads it via the existing join. Heavier (remote DDL + re-ingest). Offer to operator; not required for this phase.

**Test analog:** extend `packages/fichas/src/writer-supabase.test.ts` — assert `leerPendientes` returns the real link (not null). Wave 0 gap (SC3 unit).

---

### `packages/tramitacion/src/writer-supabase.ts` (service, DB upsert) — SC3 Option B ONLY

**Analog:** the file itself, `upsertProyecto` (`writer-supabase.ts:60+`, read first 60 lines). Mirrors `SupabaseFichasWriter`: `createClient` with service key + `upsert(filas, { onConflict: 'boletin' })` idempotent.

**Change (only if Option B chosen):** include `link_mensaje_mocion` in the `proyecto` upsert payload (today the parser extracts it as a sidecar and the writer **discards** it). Requires the new `proyecto.link_mensaje_mocion` column first. If Option A is chosen, **this file is NOT touched.**

---

## Shared Patterns

### Public RPC over the deny-by-default maestra (Access Control, V4)
**Source:** `supabase/migrations/0020_parlamentario_publico.sql` (the canonical `security definer` mirror).
**Apply to:** the new `0026` listado RPC.
- `language sql stable security definer set search_path = ''`
- `grant execute ... to anon` on the EXACT signature.
- NEVER `create policy` / `grant select` on `parlamentario`; NEVER emit `partido`/`rut`/`email`.
- anon never reads `parlamentario` directly — the RPC is the only channel.

### RSC data component: error ≠ empty (honest degradation)
**Source:** `app/app/buscar/page.tsx:60-87` + `app/app/parlamentario/[id]/page.tsx:184-192`.
**Apply to:** `/parlamentarios` `DirectoryList`.
```ts
const { data, error } = await sb.rpc("...");
if (error) throw new Error(`... falló: ${error.message}`);   // → error banner, NOT "Sin resultados"
const rows = (data as Row[] | null) ?? [];                   // [] is ONLY genuine emptiness
```

### Next 16 RSC page contract
**Source:** every existing page (`buscar/page.tsx:29-34`, `parlamentario/[id]/page.tsx:35-40`).
**Apply to:** `/parlamentarios/page.tsx`.
- `searchParams` (and `params`) are **Promises** — `const sp = await searchParams;`
- `max-w-3xl|5xl mx-auto px-4 md:px-8 py-8 md:py-16` shell.
- Inner async data component wrapped in `<Suspense key={...} fallback={<Skeleton/>}>`.
- `import "server-only"` for any module touching keys/DB (`app/lib/supabase.ts:1`).
- Read `app/node_modules/next/dist/docs/01-app/` before new APIs (`app/AGENTS.md`: "This is NOT the Next.js you know").

### Server-only Supabase anon client
**Source:** `app/lib/supabase.ts:20-34` (`createServerSupabase()`).
**Apply to:** all RSC reads in the directory. Reads `SUPABASE_URL`/`SUPABASE_ANON_KEY` (no `NEXT_PUBLIC_` → never ships to browser).

### Connector reuse for source fetch (SSRF/robots/rate-limit) — SC3
**Source:** `packages/tramitacion/src/connector-senado.ts:36-48` (`assertAllowedUrl → robots.isAllowed → rateLimiter.wait → fetcher.get`) + pipeline assembly `packages/fichas/src/pipeline-cli.ts:158-161`.
**Apply to:** Option-A re-fetch of the Senado link. Never hand-roll fetch; reuse `@obs/ingest` policy (allowlist already includes `senado.cl`).

### Input validation (V5)
**Source:** `app/lib/buscar.ts:38` (`PARLAMENTARIO_ID_RE = /^[DSP]\d{3,5}$/`, single source of truth, #36) + `MAX_QUERY_CHARS = 300` (`buscar.ts:56`).
**Apply to:** directory `q` (cap) and `camara` (whitelist `{diputados,senado}`); any `/parlamentario/[id]` link uses the existing regex.

### Backfill run contract (operator, LIVE) — SC3
**Source:** `packages/fichas/src/pipeline-cli.ts:99-125` (flag parsing + `decidirDryRun`).
**Apply to:** the SC3 backfill run.
- `tsx packages/fichas/src/pipeline-cli.ts --reembed --service-key "$SUPABASE_SECRET_KEY"`
- Without `--service-key` (and without `--dry-run`) it **silently degrades to DRY-RUN** (`decidirDryRun`, line 123) — operator must pass the key explicitly. Verify final log `LIVE ... dbLoaded=true` AND psql `count(idea_matriz) > 0`.
- LOCAL operator only (CLAUDE.md: backfill masivo = LOCAL, not GH Actions).

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| `app/components/global-header.tsx` | layout shell (site nav) | static transform | No existing site-navigation header in the repo. Closest shapes: `parlamentario-header.tsx` (server component returning `<header>`) for structure, `search-box.tsx` for the `"use client"` island split if a mobile menu is needed. Spec is fully specified in `19-UI-SPEC.md §11.0` + `mockup/landing.html` → build server-first from spec, copy the component-shape conventions from the two analogs. |

## Metadata

**Analog search scope:** `supabase/migrations/`, `app/app/`, `app/components/`, `app/lib/`, `packages/fichas/src/`, `packages/tramitacion/src/`
**Files scanned (read in full or targeted):** 13
**Key analogs (verbatim-copyable):**
- RPC: `supabase/migrations/0020_parlamentario_publico.sql`
- RSC page: `app/app/buscar/page.tsx`, `app/app/parlamentario/[id]/page.tsx`
- Display row: `app/components/search-result-card.tsx`, `app/components/parlamentario-header.tsx`
- Tokens: `app/app/globals.css:5-48` + `mockup/landing.html:40-48`
- SC3 root cause: `packages/fichas/src/writer-supabase.ts:143`
- SC3 wiring: `packages/tramitacion/src/connector-senado.ts:45`, `parse-senado-tramitacion.ts:83`, `pipeline-cli.ts`
**Pattern extraction date:** 2026-06-20
