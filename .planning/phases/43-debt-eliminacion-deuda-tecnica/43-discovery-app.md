# 43-discovery-app — Premortem Tech-Debt Discovery: `app/` frontend

Scan date: 2026-06-24  
Scope: `app/app/`, `app/components/`, `app/lib/` (source only, not `.next/`)

---

## Findings (ordered by severity)

---

### APP-01: SUPABASE_SERVICE_KEY name mismatch — admin client broken in production

- **File:** `app/lib/supabase-admin.ts:21`
- **Evidence:**
  ```ts
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  ```
  The `.env` file (line 13) and all GitHub Actions workflows (`agenda-weekly.yml:55`, `backfill.yml:39`, `fichas-backfill.yml:65`, `leyes-weekly.yml:58`) AND the packages that read Supabase server-side ALL use `SUPABASE_SECRET_KEY` as the canonical name. The `.env.example` (line 67) lists `SUPABASE_SERVICE_KEY=` as a SEPARATE entry, meaning Cloudflare Pages would need a separate secret under that name.
- **Repro:** Deploy to Cloudflare Pages with only `SUPABASE_SECRET_KEY` set (the documented canonical). `createAdminSupabase()` reads `SUPABASE_SERVICE_KEY` → undefined → throws `"Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY"`. The `/admin/revisar-entidades` route crashes with a 500 whenever `ADMIN_REVISION_ENABLED=true` is flipped ON.
- **Severity:** critical
- **Blast radius:** `/admin/revisar-entidades` (ENT-04 human review queue) is completely broken the moment the admin gate is enabled. The entity resolution pipeline's human promotion gate fails on first use. The error surfaces as an unhandled 500 (throws past the `adminRevisionEnabled` guard).
- **Proposed fix:** Rename the env var read in `supabase-admin.ts` line 21 to `SUPABASE_SECRET_KEY` to match the canonical repo-wide name. Also align `.env.example` (remove the duplicate `SUPABASE_SERVICE_KEY=` entry and replace with a note pointing to `SUPABASE_SECRET_KEY`). Verify Cloudflare Pages secret is set under `SUPABASE_SECRET_KEY`.

---

### APP-02: `leerFicha` silently swallows DB errors — fabricates "no data" from failures

- **File:** `app/app/proyecto/[boletin]/page.tsx:84-94`
- **Evidence:**
  ```ts
  const leerFicha = cache(
    async (boletin: string): Promise<ProyectoFichaRow | null> => {
      const sb = createServerSupabase();
      const { data } = await sb
        .from("proyecto_ficha")
        .select("*")
        .eq("boletin", boletin)
        .maybeSingle<ProyectoFichaRow>();
      return data ?? null;  // error is destructured away
    },
  );
  ```
  The `error` from `.maybeSingle()` is not destructured. A DB failure (network blip, RLS issue, Supabase downtime) returns `{ data: null, error: PostgrestError }` — `error` is discarded, `null` is returned.
- **Repro:** A transient DB error on `proyecto_ficha` causes `IdeaMatrizSection` to render "Idea matriz no disponible aún" and `CuerposLegalesSection` to render an empty list — both fabricating the honest-state "not yet available" from a DB failure. This contradicts principle #34 (explicitly stated in all other sections of the same file). The cached value is also stored as `null`, so all callers in the same render share the false "no data" state.
- **Severity:** high
- **Blast radius:** `/proyecto/[boletin]` — the `#idea-matriz` and `#cuerpos-legales` sections silently degrade to "not available" on any DB error, with no user-visible error signal and no logging.
- **Proposed fix:** Destructure `error` and throw on non-null: `const { data, error } = await sb.from(...).maybeSingle(); if (error) throw new Error(...); return data ?? null;`

---

### APP-03: `proyecto` hydration query in `/buscar` and `VotosSection` silently swallows DB errors

- **File (a):** `app/app/buscar/page.tsx:92-95`
  ```ts
  const { data: proyectos } = await sb
    .from("proyecto")
    .select("*")
    .in("boletin", boletines);
  ```
- **File (b):** `app/components/votos-por-parlamentario.tsx:663-666`
  ```ts
  const { data: proyectos } = await sb
    .from("proyecto")
    .select("boletin, materia")
    .in("boletin", boletines);
  ```
- **Evidence:** In both cases `error` is not destructured. A DB failure on these hydration queries silently returns `[]` results — for `/buscar` this shows "Sin resultados" for a valid query; for `VotosSection` it shows all materia filters as null/empty, breaking the materia filter chips.
- **Repro:** Any transient Supabase error during hydration after kNN (buscar) or after votos (parlamentario) produces a silent degradation that looks like "no projects found" or "no materia available."
- **Severity:** high
- **Blast radius:** `/buscar` search results silently show empty when DB fails during hydration. `/parlamentario/[id]` materia filter chips disappear and all votes show null materia.
- **Proposed fix:** Destructure and throw on `error` in both queries, consistent with the pattern used everywhere else in the codebase (the "honest-error #34" comment is literally present in neighboring lines in both files).

---

### APP-04: `VotosSection` fetches up to 1000 votes in a single RPC call — N+1 query and memory cliff

- **File:** `app/components/votos-por-parlamentario.tsx:646-649`
- **Evidence:**
  ```ts
  const { data: todasData, error: todasError } = await sb.rpc(
    "votos_de_parlamentario",
    { p_id: id, p_limit: 1000, p_offset: 0 },
  );
  ```
  The comment on line 643 acknowledges: "Para volúmenes grandes, mover a un RPC de conteo." A senator with 10+ years of record can have 500–800+ confirmed votes. All are loaded server-side in a single call, then the full proyectos hydration runs on all unique boletines (potentially another 300-400 row `.in()` query), and all data is held in memory during SSR.
- **Repro:** A senior senator's ficha page will load the full 1000-row cap into server memory, run a second query on up to 1000 boletines, then do client-side pagination over the entire dataset in JavaScript. As the DB grows, this hits the 1000 row cap silently truncating the record without any UI indication.
- **Severity:** high
- **Blast radius:** (1) Silent data truncation at 1000 votes — a parlamentario with >1000 confirmed votes shows incomplete data with no honest-state indication. (2) High SSR memory usage per request for active parliamentarians, potential timeout on Edge functions. (3) The "totales de asistencia" conteo becomes inaccurate when truncated.
- **Proposed fix:** Add a count RPC (or use `.count()` on a second query) for the aggregate stats, and implement true server-driven pagination (pass `p_offset` from the page param). The existing pagination UI is already server-driven; the data fetch is the only client.

---

### APP-05: `agruparAudiencias` uses non-null assertion on Map lookup

- **File:** `app/components/lobby-de-parlamentario.tsx:280`
- **Evidence:**
  ```ts
  return orden.map((id) => porId.get(id)!);
  ```
- **Repro:** `orden` is built by pushing `f.identificador` into the array every time a new entry is created in `porId`. By construction, every entry in `orden` exists in `porId` at the time of the return. However, if a future refactor touches the insertion order or filters `orden` independently of `porId`, the `!` suppresses a legitimate undefined at runtime and produces a crash-on-render. This is the only non-null assertion in the codebase's primary data path.
- **Severity:** medium
- **Blast radius:** If the invariant breaks, `LobbyView` receives `undefined` items in its `audiencias` array and crashes during `.map()` in the render, producing a 500 on the parlamentario ficha.
- **Proposed fix:** Replace with a filter: `return orden.map((id) => porId.get(id)).filter((a): a is LobbyAudienciaRow => a !== undefined);`

---

### APP-06: `sourceLabel` match order — "camara-transparencia-lobby" would have been mis-labeled, fix is correct but fragile

- **File:** `app/lib/types.ts:574-586`
- **Evidence:**
  ```ts
  if (o.includes("lobby")) return "Ley del Lobby";
  if (o.includes("probidad") || o.includes("cplt") || o.includes("transparencia"))
    return "InfoProbidad";
  ```
  The comment explicitly documents that `lobby` must come before `transparencia` because the canonical lobby origen string `"camara-transparencia-lobby"` contains "transparencia". The fix is in place, but the function relies on substring matching with no enumeration — adding a new origen string like `"lobby-probidad"` or any origin containing `"transparencia"` in a new context could silently re-route to the wrong label.
- **Repro:** If a future ingestion pipeline introduces an origen like `"senado-lobby-transparencia"`, both the `lobby` and `transparencia` branches match, and the order-dependency means it returns "Ley del Lobby" — correct by accident, fragile by design.
- **Severity:** medium
- **Blast radius:** All `ProvenanceBadge` renderings show wrong source labels, which violates the core "cada dato lleva fuente" principle. Silent — no error, just wrong labels.
- **Proposed fix:** Switch to an exact-match or prefix-match map of canonical origen strings. At minimum, add a test that validates the exact origen strings produced by each connector against the expected label (the test file `source-label.test.ts` should exist but was not found in the glob).

---

### APP-07: `leerFicha` React.cache scope — shared across concurrent requests via module singleton

- **File:** `app/app/proyecto/[boletin]/page.tsx:84`
- **Evidence:**
  ```ts
  const leerFicha = cache(
    async (boletin: string): Promise<ProyectoFichaRow | null> => { ... }
  );
  ```
  `React.cache` (imported as `cache` from `"react"`) deduplicates calls within a single render tree per request. However, `leerFicha` is declared at module scope as a `const`. In Next.js App Router, module-level `cache()` creates a per-request cache only when used within a render. If this is ever called from a context outside a React render (e.g., a future Route Handler or Server Action that imports from this file), the cache may not be request-scoped.
- **Repro:** The pattern is correct for current use (Server Components). The risk is latent: if `leerFicha` is ever imported and called from a Route Handler, it shares the `cache()` singleton in a potentially unscoped way. The current `cache` import at line 1 confirms it is `React.cache`, which IS per-request when in a render tree.
- **Severity:** medium
- **Blast radius:** Latent only. Not currently exploitable. Would manifest as cross-request data leakage (wrong ficha data shown to a different user's request) if called outside a React tree.
- **Proposed fix:** Move `leerFicha` inside the page component or add a comment explicitly locking the "only call from within a render tree" invariant. Document that `React.cache` is NOT a module-level cache.

---

### APP-08: `buscarProyectos` error catch swallows the error type — no logging

- **File:** `app/app/buscar/page.tsx:64`
- **Evidence:**
  ```ts
  } catch {
    // Error = una llamada falló (embed / rpc / DB). Distinto de vacío/degradado.
    return (
      <div ...>Ocurrió un error al realizar la búsqueda...</div>
    );
  }
  ```
  The `catch` clause has no binding (`catch {` — valid TS 4.0+), so the error object is not logged or propagated. Any exception from `buscarProyectos` (Gemini API key missing, Gemini rate limit, RPC failure, network error) is silently consumed. There is no `console.error` or structured logging.
- **Repro:** If `GEMINI_API_KEY` is unset in production, every search shows "Ocurrió un error" with zero observability into why. The same generic message appears for a Gemini 429 rate limit, a Supabase RPC timeout, or a genuine bug in `buscarProyectos`.
- **Severity:** medium
- **Blast radius:** Operability blind spot — the search feature can be broken in production with no signal in logs. Rate limit exhaustion (Gemini free tier) would appear as a permanent "search error" with no actionable alert.
- **Proposed fix:** `catch (err) { console.error("buscarProyectos failed:", err); return <error UI>; }` — log at minimum to server stderr (visible in Cloudflare Pages logs).

---

### APP-09: Seed knob (`KNOWN SEED`) — SUPABASE_SERVICE_KEY vs SUPABASE_SECRET_KEY — VERIFIED FALSE

The premortem brief seeded `app/lib/supabase-admin.ts` reading `SUPABASE_SERVICE_KEY` as the "broken env var." This is **confirmed as real debt** (APP-01 above). The claim that "the whole repo + .env use `SUPABASE_SECRET_KEY`" is verified correct: `.env` line 13 = `SUPABASE_SECRET_KEY=sb_secret_...`; supabase-admin reads `SUPABASE_SERVICE_KEY`. The mismatch is real.

---

### APP-10: `contraparte/[id]` page — `proyectos` hydration in `/buscar` also missing `error` check (duplicate pattern, same blast radius as APP-03)

- **File:** `app/app/buscar/page.tsx:92-95` (same as APP-03 file (a))
- **Note:** Already documented in APP-03. No separate entry needed; the two silent-swallow patterns are co-located.

---

### APP-11: `web-reader-jwt.ts` module-level cache is process-global — shared across requests in same worker

- **File:** `app/lib/web-reader-jwt.ts:70`
- **Evidence:**
  ```ts
  let _cache: { token: string; exp: number } | null = null;
  ```
  This is a module-level mutable singleton. In Cloudflare Pages (V8 isolates), each isolate is effectively per-request — so this is safe in prod. In local Next.js dev (`next dev`) or a Node.js server, the process is shared across concurrent requests, meaning multiple simultaneous requests share the JWT cache. The comment says "Node.js es single-threaded; no se necesita mutex" — this is true for thread safety but not for request isolation.
- **Repro:** In a Node.js server with concurrent requests, two requests could race on the cache check: both see expired, both mint new tokens, both store (last writer wins). This is benign (tokens are equivalent). The real risk: if `SUPABASE_JWT_SECRET` changes (rotation), the cached token from the old secret is served for up to TTL_S (300s) until it expires, causing 401s from PostgREST for up to 5 minutes.
- **Severity:** low
- **Blast radius:** JWT secret rotation causes up to 5 minutes of 401 errors on all read paths until the in-process cache expires. No data loss; self-healing.
- **Proposed fix:** On secret rotation, restart the server process (standard practice). Optionally document the 5-minute grace period.

---

### APP-12: Dead/unreachable `VotoFichaMencion` type — defined but no production path uses it

- **File:** `app/lib/types.ts:186-210`
- **Evidence:**
  ```ts
  export interface VotoFichaMencion { ... }
  ```
  The JSDoc says: "La usan los fixtures de test de los 3 estados." Searching the `app/` source for `VotoFichaMencion` reveals it is only imported in test files (`.test.tsx`), not in any production component or page. The production RPC `votos_de_parlamentario` only returns confirmed rows (`VotoFichaRow`), never unconfirmed mentions.
- **Repro:** Not a runtime risk. Dead export adds confusion — future developers may wonder if unconfirmed mentions actually render in production (they don't). If someone were to wire an unconfirmed mention into `VotoFichaRow` by mistake, there is no production-path guard.
- **Severity:** low
- **Blast radius:** Maintenance confusion only.
- **Proposed fix:** Add a comment explicitly marking this as "test-fixtures only, never rendered in production" — or move it to a `test/fixtures/types.ts` file.

---

## Summary table

| ID | Title | Severity |
|----|-------|----------|
| APP-01 | SUPABASE_SERVICE_KEY vs SUPABASE_SECRET_KEY — admin client broken | critical |
| APP-02 | `leerFicha` swallows DB errors — fabricates "no data" | high |
| APP-03 | `proyecto` hydration queries swallow DB errors (buscar + votos) | high |
| APP-04 | `VotosSection` fetches up to 1000 rows — silent truncation + memory cliff | high |
| APP-05 | Non-null assertion `!` on Map lookup in `agruparAudiencias` | medium |
| APP-06 | `sourceLabel` substring ordering — fragile, order-dependent | medium |
| APP-07 | `leerFicha` module-scope `React.cache` — latent cross-request risk | medium |
| APP-08 | `buscarProyectos` catch swallows error with no logging | medium |
| APP-11 | JWT cache module singleton — 5-min 401 window on secret rotation | low |
| APP-12 | `VotoFichaMencion` dead export — test-only type in production types file | low |

Total: 1 critical, 3 high, 4 medium, 2 low = **10 findings**
