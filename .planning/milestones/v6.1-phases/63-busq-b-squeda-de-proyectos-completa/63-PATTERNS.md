# Phase 63: BUSQ — Búsqueda de proyectos completa - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 7 new/modified
**Analogs found:** 7 / 7 (every new file has a strong in-repo analog — this phase is orchestration of existing pieces)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/fichas/src/seed-fichas-cli.ts` (NUEVO) | CLI / service | batch (DB seed) | `packages/fichas/src/pipeline-cli.ts` | role-match (CLI shell) + method into `writer-supabase.ts` |
| `packages/fichas/src/writer-supabase.ts` (MODIFICAR: `+seedFichasPendientes`) | service (DB writer) | CRUD (idempotent upsert) | same file, `upsertFicha`/`marcarError` | exact (extend in place) |
| `packages/tramitacion/src/connector-camara.ts` (MODIFICAR: `+enumerarProyectosXAnno`) | connector | request-response (WS fetch) | same file, `descubrirBoletines`/`fetchVotacionesBoletin` | exact (extend in place) |
| `packages/tramitacion/src/parse-camara-legislativo.ts` (NUEVO) | parser / utility | transform (XML→model) | `packages/tramitacion/src/parse-camara-votacion.ts` | exact (same fast-xml-parser + zod idiom) |
| `packages/tramitacion/src/run-enumerar-historico-cli.ts` (NUEVO, opción) | CLI (operator) | batch (enumerate→list) | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` | exact (prod-cli shell: loadEnv, flags, BOLETIN_RE) |
| `packages/freshness/src/catalog.ts` + `evaluate.ts` (MODIFICAR: señal cobertura) | config + utility | transform (pure eval) | same files, `CATALOG`/`evaluate` | exact (extend in place) |
| `app/lib/coverage.ts` (NUEVO) + `app/app/buscar/page.tsx` (MODIFICAR: banner) | provider (server) + component (SSR) | request-response (count) | `app/lib/buscar.ts` (server-only) + `page.tsx` | exact (same server-only + count idiom) |

Supporting new files (test/SQL, no code analog needed — mirror sibling `.test.ts`):
- `packages/fichas/src/seed-fichas.test.ts` — mirror existing `pipeline.test.ts` structure
- `packages/tramitacion/src/parse-camara-legislativo.test.ts` — mirror `parse-camara-votacion.test.ts` (fixture XML)
- `app/app/buscar/coverage.test.tsx` — RTL, mock count
- `scripts/verify-cobertura.sql` — plain SQL (counts already in RESEARCH §Code Examples)

---

## Pattern Assignments

### `packages/fichas/src/writer-supabase.ts` — ADD `seedFichasPendientes()` (service, CRUD idempotent)

**Analog:** same file — `upsertFicha` (lines 97-107) + `leerPendientes` (lines 145-175).

**Imports / class shape already present** (lines 13-17, 84-95): `createClient` with service key, `auth: { persistSession: false, autoRefreshToken: false }`. Do NOT add new deps.

**Idempotent-upsert pattern to copy** (lines 97-107) — the seed reuses `.upsert(..., { onConflict: "boletin" })` but MUST NOT touch existing rows:
```typescript
async upsertFicha(filas: FichaRow[]): Promise<void> {
  if (filas.length === 0) return;
  const deduped = dedupePorClave(filas, (f) => f.boletin);
  for (const lote of chunk(deduped, CHUNK)) {
    const { error } = await this.client
      .from("proyecto_ficha")
      .upsert(lote, { onConflict: "boletin", ignoreDuplicates: false });
    if (error) throw new Error(`upsert proyecto_ficha falló: ${error.message}`);
  }
}
```

**Seed method (new) — the ONE new behavior. Idempotent, only creates missing rows** (RESEARCH Pattern 1 + Anti-Pattern "no re-abrir 'embebido'/'error'"). Two-step: SELECT boletines sin ficha, then upsert with `ignoreDuplicates: true` (do-nothing on conflict):
```typescript
// New: seed a 'pendiente' proyecto_ficha row for every `proyecto` without one.
// CRITICAL: ignoreDuplicates: true (ON CONFLICT DO NOTHING) — never re-open 'embebido'/'error'.
async seedFichasPendientes(): Promise<{ creados: number }> {
  // 1) detect gap: proyectos sin fila ficha (LEFT JOIN via two reads or an RPC-free select)
  const { data: proyectos } = await this.client.from("proyecto").select("boletin");
  const { data: fichas } = await this.client.from("proyecto_ficha").select("boletin");
  const conFicha = new Set((fichas ?? []).map((f) => f.boletin));
  const faltantes = (proyectos ?? []).map((p) => p.boletin).filter((b) => !conFicha.has(b));
  if (faltantes.length === 0) return { creados: 0 };
  // 2) seed as 'pendiente' (mirror FichaRow shape; cuerpos_legales: [], estado: 'pendiente')
  const filas: FichaRow[] = faltantes.map((boletin) => ({
    boletin, idea_matriz: null, cuerpos_legales: [], texto_r2_path: null,
    estado: "pendiente", origen: "fichas-seed", fecha_captura: new Date().toISOString(),
  }));
  for (const lote of chunk(dedupePorClave(filas, (f) => f.boletin), CHUNK)) {
    const { error } = await this.client
      .from("proyecto_ficha")
      .upsert(lote, { onConflict: "boletin", ignoreDuplicates: true }); // DO NOTHING
    if (error) throw new Error(`seedFichasPendientes falló: ${error.message}`);
  }
  return { creados: faltantes.length };
}
```

**Error-message discipline** (lines 104-105): only `error.message` from PostgREST (never the service key). Reuse verbatim.

---

### `packages/fichas/src/seed-fichas-cli.ts` (NUEVO — CLI, batch)

**Analog:** `packages/fichas/src/pipeline-cli.ts` (whole file) — copy the CLI skeleton, drop the pipeline/providers.

**dry-run gating + env-driven URL/key** (pipeline-cli lines 124-126, 147-157):
```typescript
export function decidirDryRun(opts: { serviceKey?: string; dryRun?: boolean }): boolean {
  return opts.dryRun === true || (opts.serviceKey ?? "").length === 0;
}
// main():
const url = opts.url ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL ?? "";
const serviceKey = opts.serviceKey ?? process.env.SUPABASE_SECRET_KEY ?? "";
const dryRun = decidirDryRun({ serviceKey, dryRun: opts.dryRun });
if (opts.dryRun !== true && serviceKey.length === 0) {
  log("fichas-seed: sin SUPABASE_SECRET_KEY → DRY-RUN (no toca DB)");
}
```

**Flag-parse fail-fast + `--service-key` empty guard** (pipeline-cli lines 68-118): copy `parseArgs` + `FichasCliArgsError`. Seed needs only `--dry-run` and `--service-key` (no `--limite`/`--boletines`/`--reembed`).

**Entry-point isMain guard** (pipeline-cli lines 243-269) — MEMORY gotcha "dos entrypoints CLI": the regex MUST match this file's own name:
```typescript
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  /seed-fichas-cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
```
In dry-run, instantiate no writer (or a noop) and log the would-be count; in LIVE, `new SupabaseFichasWriter({ url, serviceKey })` → `seedFichasPendientes()`.

---

### `packages/tramitacion/src/connector-camara.ts` — ADD `enumerarProyectosXAnno()` (connector, request-response)

**Analog:** same file — `fetch` (lines 59-65), `descubrirBoletines` (lines 78-118), `fetchVotacionesBoletin` (lines 120-124).

**LOCKED fetch order to reuse verbatim** (lines 59-65) — do NOT hand-roll a fetch loop (RESEARCH "Don't Hand-Roll"):
```typescript
private async fetch(url: string): Promise<string> {
  const parsed = assertAllowedUrl(url, this.deps.allowlist); // SSRF + allowlist
  if (!(await this.deps.robots.isAllowed(url))) throw new RobotsDisallowError(url);
  await this.deps.rateLimiter.wait(parsed.host);             // 2-3s serial por host
  const body = await this.deps.fetcher.get({ url });
  return new TextDecoder().decode(body);
}
```

**New method** — mirrors `descubrirBoletines` (dedup Set + best-effort per-op), but targets `WSLegislativo.asmx` and validates the year (V5 input validation) + `encodeURIComponent`:
```typescript
const BASE_LEG = "https://opendata.camara.cl/camaradiputados/WServices/WSLegislativo.asmx";
async enumerarProyectosXAnno(anno: number): Promise<string[]> {
  if (!Number.isInteger(anno) || anno < 1990 || anno > 2100) {
    throw new Error(`anno inválido: ${anno}`);           // V5: no basura al WS gob
  }
  const out = new Set<string>();
  for (const op of ["retornarMocionesXAnno", "retornarMensajesXAnno"]) {
    const xml = await this.fetch(`${BASE_LEG}/${op}?prmAnno=${encodeURIComponent(String(anno))}`);
    // Prefer parse-camara-legislativo.ts (fast-xml-parser + zod). regex fallback for boletines only.
    for (const b of parseCamaraLegislativo(xml)) out.add(b);
  }
  return [...out];
}
```
**Gotcha (RESEARCH A2 / Pitfall 2):** confirm the shape with ONE live fetch before coding the parser. If `WSLegislativo` has a WAF (403), fall back to the curl-transport pattern used in `@obs/agenda` (`createCurlTransport`) — but the votaciones WS on the same host is fetch-native, so likely OK.

---

### `packages/tramitacion/src/parse-camara-legislativo.ts` (NUEVO — parser, transform)

**Analog:** `packages/tramitacion/src/parse-camara-votacion.ts` (lines 1-60) — the canonical fast-xml-parser + zod idiom in this package.

**Parser construction + node-text helpers to copy verbatim** (lines 15-58):
```typescript
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const t = (v as Record<string, unknown>)["#text"];
    if (t == null) return null;
    const s = String(t).trim();
    return s.length === 0 ? null : s;
  }
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
// asArray<T>(v) — fast-xml-parser collapses a single node to an object; force to array.
```

**Single-node-to-array coercion** (`asArray`, votacion line 60; also parse-senado `[].concat` note) — `ProyectoLey` collection collapses to one object when only one exists. Handle it.

**zod validation gate** (votacion header comment "se valida con VotacionSchema antes de devolver"): define a minimal `ProyectoLeySchema` (`NumeroBoletin` string matching `/^\d{3,6}-\d{1,3}$/`, `Nombre` string) and validate before returning boletines. The zod validation is the source-contract gate (CLAUDE.md).

Extract just `NumeroBoletin[]` for the caller; keep `Nombre`/`FechaIngreso`/`CamaraOrigen` parseable if the phase wants richer provenance.

---

### `packages/tramitacion/src/run-enumerar-historico-cli.ts` (NUEVO, opción — CLI operator, batch)

**Analog:** `packages/tramitacion/src/run-tramitacion-prod-cli.ts` (whole file) — the prod-CLI shell.

**BOM-safe loadEnv with process.env precedence** (lines 59-82) — copy verbatim (CI injects secrets into process.env):
```typescript
function loadEnv(root: string): Record<string, string> { /* readFileSync .env, strip BOM, then override from process.env */ }
```

**flagValue + `--limite` validation** (lines 50-53, 142-146):
```typescript
function flagValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1]! : null;
}
```

**BOLETIN_RE defense before touching the WS** (line 85): `const BOLETIN_RE = /^\d{3,6}-\d{1,3}$/;` — filter enumerated boletines so no garbage reaches the gov server.

**Secrets ONLY from .env/process.env, never argv** (header comment lines 17-18): flags are `--desde YYYY --hasta YYYY [--dry-run]`; credentials come from env. This CLI loops years, calls `connector.enumerarProyectosXAnno(anno)`, dedups, prints/writes the boletín list (the operator then pipes it into `run-tramitacion-prod-cli --boletines`).

**Exit code discipline** (lines 219, 222-225): `process.exit(errores ? 1 : 0)` and a top-level `.catch` that logs `err.message` + `process.exit(1)`.

**MEMORY gotcha:** this is a SECOND entrypoint on `@obs/tramitacion` alongside `run-tramitacion-prod-cli`/`ingest-cli` — do NOT wire it into any cron YAML (histórico = one-shot LOCAL, never GH Actions).

---

### `packages/freshness/src/catalog.ts` + `evaluate.ts` — ADD "cobertura búsqueda" signal (config + pure util)

**Analog:** same files — `CATALOG` array (catalog.ts lines 36-85), `evaluate` (evaluate.ts lines 29-70), and the read pattern in `query-runner.ts` (lines 82-98).

**Query pattern to copy** (query-runner.ts lines 39-50, 82-98) — `psql -tAc` with `PGCLIENTENCODING=UTF8`, degrade to "" on failure:
```typescript
function psql(dbUrl: string, sql: string): string {
  try {
    return execSync(`psql "${dbUrl}" -tAc "${sql}"`, {
      env: { ...process.env, PGCLIENTENCODING: "UTF8" }, encoding: "utf8", timeout: 15_000,
    }).trim();
  } catch { return ""; }
}
```

**Coverage signal (new):** N/M counts per señal — `count(proyecto)`, `count(proyecto_ficha)`, `count(idea)`, `count(proyecto_embedding)`. Cheapest option per RESEARCH: add a coverage row/section rather than a full `FuenteConfig` (the freshness catalog is staleness-oriented, not N/M). Follow the `evaluate` pure-function style (no I/O in evaluate; I/O in query-runner). SQL is in RESEARCH §Code Examples:
```sql
select count(*) from proyecto;                                              -- total
select count(*) from proyecto_ficha;                                        -- fichas
select count(*) from proyecto_ficha where idea_matriz is not null and idea_matriz<>'';  -- ideas
select embedding_version, count(*) from proyecto_embedding group by 1;      -- embeds + stale v1
```

**Reuse `scripts/verify-cobertura.sql`** (new) for these same counts so freshness and manual verification share one source.

---

### `app/lib/coverage.ts` (NUEVO) + `app/app/buscar/page.tsx` (MODIFICAR banner) — provider (server) + component (SSR)

**Analog:** `app/lib/buscar.ts` (server-only data layer, lines 1-22, 192-209) + `app/lib/supabase.ts` (`createServerSupabase`, lines 34-53) + `app/app/buscar/page.tsx` (Server Component, lines 29-58).

**server-only + createServerSupabase count idiom** (RESEARCH Pattern 3; mirrors buscar.ts lines 1-6, 192):
```typescript
// app/lib/coverage.ts
import "server-only";
import { createServerSupabase } from "@/lib/supabase";

export async function contarCoberturaBusqueda(): Promise<number> {
  const sb = createServerSupabase();
  const { count } = await sb
    .from("proyecto_embedding")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}
```
**Anti-pattern (RESEARCH Pitfall 7 / LOCKED):** never hardcode N. Read `count(proyecto_embedding)` and cache with Next.js `revalidate` (~1h). Do NOT read a PII table (V4 — this client uses service_role which bypasses RLS; `proyecto_embedding` is public-read, safe).

**Banner insertion point** (page.tsx lines 41-45): add a coverage line under `<SearchBox>`, in the Server Component `BuscarPage`:
```tsx
const n = await contarCoberturaBusqueda();
// ...
<p className="text-sm text-muted-foreground mt-2">
  Busca sobre {n} proyectos de ley (alcance {ALCANCE}).
</p>
```
**Redeploy note** (RESEARCH Runtime State Inventory): touching `app/` requires the OpenNext/wrangler redeploy runbook (61-02, docker Linux). The data backfill itself is visible WITHOUT redeploy (SSR data-driven); only the banner UI needs a deploy.

**App directory constraint:** `app/AGENTS.md` warns Next.js here has breaking changes vs training data — read `node_modules/next/dist/docs/` before writing App Router code (server component / `revalidate` semantics).

---

## Shared Patterns

### Idempotent upsert by boletín (never re-open terminal state)
**Source:** `packages/fichas/src/writer-supabase.ts` lines 97-118 (`upsert onConflict: "boletin"`, `dedupePorClave`, `chunk` at CHUNK=500).
**Apply to:** `seedFichasPendientes` (use `ignoreDuplicates: true` — DO NOTHING), any DB writer in this phase.

### LOCKED respectful-fetch order (SSRF → robots → rate-limit → fetch)
**Source:** `packages/tramitacion/src/connector-camara.ts` lines 59-65 (`assertAllowedUrl` → `robots.isAllowed` → `rateLimiter.wait(host)` → `fetcher.get`).
**Apply to:** `enumerarProyectosXAnno` and any new gov-source fetch. Never hand-roll `setTimeout` (WAF blocks bursts; `@obs/ingest` is LOCKED).

### fast-xml-parser + zod source-contract parse
**Source:** `packages/tramitacion/src/parse-camara-votacion.ts` lines 15-60 (`XMLParser({ ignoreAttributes: false, parseTagValue: false })`, `txt`, `asArray`, zod-validate-before-return).
**Apply to:** `parse-camara-legislativo.ts`.

### Prod-CLI shell (loadEnv BOM-safe, flagValue, dry-run degrade, BOLETIN_RE, exit codes)
**Source:** `packages/tramitacion/src/run-tramitacion-prod-cli.ts` lines 50-82, 141-158, 84-85, 219-225.
**Apply to:** `run-enumerar-historico-cli.ts`. Secrets ONLY from env, never argv (V5 / STRIDE Elevation).

### CLI dry-run gating on service-key presence
**Source:** `packages/fichas/src/pipeline-cli.ts` lines 124-126, 154-157 (`decidirDryRun`; sin key → dry-run con aviso).
**Apply to:** `seed-fichas-cli.ts` and `run-enumerar-historico-cli.ts`.

### server-only DB read (no key to client)
**Source:** `app/lib/buscar.ts` line 1 (`import "server-only"`) + `app/lib/supabase.ts` `createServerSupabase` lines 34-53.
**Apply to:** `app/lib/coverage.ts`. Keys from `process.env` without public prefix; never PII tables.

### read-only psql signal (PGCLIENTENCODING=UTF8, degrade on error)
**Source:** `packages/freshness/src/query-runner.ts` lines 39-50, 82-98.
**Apply to:** coverage signal in freshness + `scripts/verify-cobertura.sql`.

### Honest ceiling via `proyecto_ficha.estado`/`error_msg` (do NOT invent tracking)
**Source:** `packages/fichas/src/writer-supabase.ts` `marcarError` lines 125-131 (estado='error', error_msg sliced to 2000).
**Apply to:** all backfill reporting. 8 RUT-blocked = permanent honest ceiling (NEVER retry to LLM — `assertNoRutInLlmInput` is LOCKED compliance). 3 schema-fail = retryable once.

---

## No Analog Found

None. Every new/modified file has a strong in-repo analog. The only genuinely new *behavior* is:
- `seedFichasPendientes` (the gap-82 fix) — but it reuses the exact `upsert`/`dedupe`/`chunk` machinery already in `writer-supabase.ts`.
- `enumerarProyectosXAnno` targeting `WSLegislativo.asmx` — a new URL/method, but the fetch policy and parse idiom are copied verbatim from `connector-camara.ts` + `parse-camara-votacion.ts`.

| File | Role | Data Flow | Reason (why quasi-novel) |
|------|------|-----------|--------------------------|
| `packages/tramitacion/src/parse-camara-legislativo.ts` | parser | transform | New WS response shape (`ProyectoLey[]`); MUST confirm shape with ONE live fetch before coding (RESEARCH A1/Pitfall 2). Idiom is exact-match to `parse-camara-votacion.ts`. |

---

## Metadata

**Analog search scope:** `packages/fichas/src`, `packages/tramitacion/src`, `packages/freshness/src`, `app/lib`, `app/app/buscar`.
**Files scanned (read in full or targeted):** `writer-supabase.ts`, `pipeline-cli.ts` (fichas); `connector-camara.ts`, `run-tramitacion-prod-cli.ts`, `parse-senado-tramitacion.ts`, `parse-camara-votacion.ts` (tramitacion); `catalog.ts`, `cli.ts`, `evaluate.ts`, `query-runner.ts` (freshness); `buscar/page.tsx`, `lib/buscar.ts`, `lib/supabase.ts` (app).
**Pattern extraction date:** 2026-07-10
**Key risk (from RESEARCH):** omitting the seed step → pipeline reports "0 procesados" for the 82 (silent bug); and choosing the wrong enumeration WS (votaciones `.asmx` returns [] — use `WSLegislativo.asmx`).
