---
phase: 63-busq-b-squeda-de-proyectos-completa
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - app/app/buscar/coverage.test.tsx
  - app/app/buscar/page.tsx
  - app/lib/coverage.ts
  - packages/fichas/src/seed-fichas-cli.ts
  - packages/fichas/src/seed-fichas.test.ts
  - packages/fichas/src/writer-supabase.ts
  - packages/freshness/src/catalog.ts
  - packages/freshness/src/cli.ts
  - packages/freshness/src/evaluate.test.ts
  - packages/freshness/src/evaluate.ts
  - packages/freshness/src/query-runner.ts
  - packages/tramitacion/src/connector-camara.ts
  - packages/tramitacion/src/parse-camara-legislativo.test.ts
  - packages/tramitacion/src/parse-camara-legislativo.ts
  - packages/tramitacion/src/run-enumerar-historico-cli.ts
  - scripts/verify-cobertura.sql
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: fixed
fix:
  fixed_at: 2026-07-11
  fixed: 7            # WR-01..WR-07 (todas las warnings)
  also_fixed: 1      # IN-04 (trivial, mismo paquete freshness)
  skipped: 5         # IN-01, IN-02, IN-03, IN-05, IN-06 (no triviales / fuera de alcance)
  tests_passed: true # app 757/757 + fichas 79 + tramitacion 136 + freshness; typecheck limpio
  commits:
    - a3c27dd  # WR-01
    - dba0596  # WR-02
    - 69e46cf  # WR-03
    - 42aed5e  # WR-04
    - 0aa8161  # WR-05
    - 0e8180f  # WR-06
    - 2557e2a  # WR-07 + IN-04
---

# Phase 63: Code Review Report

**Reviewed:** 2026-07-11
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 63 implementation: idempotent seed of `proyecto_ficha` (with PostgREST pagination fix), WSLegislativo historical enumeration (parser + connector + LOCAL CLI), the /buscar coverage banner (server-only count with `unstable_cache` 1h), the freshness N/M coverage signals, and `verify-cobertura.sql`.

The LOCKED invariants hold: no RUT reaches any LLM input (no LLM calls in these files); the enumeration path reuses the `@obs/ingest` policy in the LOCKED order (`assertAllowedUrl` → robots → `HostRateLimiter` 2–3s serial per host → fetcher, verified against `packages/ingest/src/{allowlist,rate-limiter,robots}.ts`); secrets come only from env (`--service-key` is an override, never logged); DB counts run server-only (`import "server-only"` in `app/lib/coverage.ts` and `app/lib/buscar.ts`). `opendata.camara.cl` is covered by the `camara.cl` allowlist suffix. The parser validates per-element with zod, fail-closed, matching its tests. Extra named exports from `page.tsx` (`Resultados`) follow an established codebase convention (agenda, proyecto, parlamentario pages do the same).

No blockers found. Seven warnings: the seed's pagination reads have no `ORDER BY` (non-deterministic pages), the coverage banner renders and caches a false "0" on count failure, the `page` query param is unbounded into the kNN RPC, total enumeration failure is indistinguishable from an empty year (dead exit-1 path), `--service-key` can swallow a following flag, `psql` is invoked via shell string interpolation of a password-bearing URL with silent error swallowing, and the freshness evaluator fails OPEN on an unparseable timestamp.

## Narrative Findings (AI reviewer)

*(No `<structural_findings>` block was provided; all findings below are narrative.)*

## Warnings

### WR-01: Paginated boletín reads have no `ORDER BY` — page boundaries are non-deterministic

**Status:** FIXED (a3c27dd) — `.order("boletin", { ascending: true })` antes de `.range()`; mock del test actualizado a `.select().order().range()`.

**File:** `packages/fichas/src/writer-supabase.ts:124-137`
**Issue:** `leerTodosBoletines` pages with `.range(from, from + PAGE - 1)` but never calls `.order(...)`. Without `ORDER BY`, Postgres/PostgREST gives no ordering guarantee, and each page is an independent HTTP request: rows can be duplicated or skipped across page boundaries if the plan or heap order shifts between requests (e.g., concurrent writes from a cron ingesta, autovacuum). A skipped `proyecto` row means the seed silently misses it that run; a skipped `proyecto_ficha` row misclassifies a project as "faltante" (harmless only because of `ignoreDuplicates: true`). The pagination fix for the >1k truncation bug is real, but it is incomplete without a stable sort — the unit test fake (`seed-fichas.test.ts:31-37`) slices a fixed array, so it cannot catch this.
**Fix:**
```ts
const { data, error } = await this.client
  .from(tabla)
  .select("boletin")
  .order("boletin", { ascending: true }) // orden estable → páginas deterministas
  .range(from, from + PAGE - 1);
```

### WR-02: Count failure renders "Busca sobre 0 proyectos de ley" — and the 0 is cached for an hour

**Status:** FIXED (dba0596) — `contarEmbeddings` lanza en fallo (no cachea el 0); `contarCoberturaBusqueda` devuelve `number | null` (catch → null); `page.tsx` oculta el banner cuando `cobertura === null || cobertura <= 0`. Tests: banner oculto para null y 0.

**File:** `app/lib/coverage.ts:42-46` (and `app/app/buscar/page.tsx:50-52`)
**Issue:** Two compounding problems. (1) `contarEmbeddings` swallows the error and returns `0`; the comment says the banner "simplemente muestra 0 (o se puede ocultar aguas arriba)", but upstream `page.tsx:50-52` renders unconditionally — the user sees "Busca sobre 0 proyectos de ley" while the search itself still works. For a feature whose entire purpose is HONEST coverage (BUSQ-03), a false "0 projects" claim is the dishonest outcome the phase set out to eliminate. (2) Because the error is handled *inside* the function wrapped by `unstable_cache`, the degraded `0` is cached with `revalidate: 3600`: one transient DB hiccup at revalidation time poisons the banner for a full hour.
**Fix:** Return `null` on error (do not fake a number), and hide the banner upstream when the count is unknown:
```ts
// coverage.ts
async function contarEmbeddings(): Promise<number | null> {
  ...
  if (error) {
    console.error(...);
    throw new Error("count(proyecto_embedding) falló"); // no cachear el fallo
  }
  return count ?? null;
}
// contarCoberturaBusqueda: try { return await contarEmbeddingsCacheado(); } catch { return null; }

// page.tsx
{cobertura !== null && cobertura > 0 && (
  <p ...>Busca sobre {cobertura} proyectos de ley ({ALCANCE_COBERTURA}).</p>
)}
```

### WR-03: `page` query param is unbounded — arbitrary `match_count` reaches the kNN RPC

**Status:** FIXED (69e46cf) — `clampPage(raw)` exportada acota a `1..MAX_PAGE` (50 = 1000 resultados); `page.tsx` la usa. Tests directos: clamp por arriba (`999999999999`→50), por abajo (0/neg/basura→1), y valores válidos.

**File:** `app/app/buscar/page.tsx:35,71`
**Issue:** `page` is parsed with `Math.max(1, Number.parseInt(pageParam, 10) || 1)` — a lower bound only. `?q=pensiones&page=999999999999` yields `matchCount = PAGE_SIZE * page + 1 ≈ 2×10^13`, passed straight into `sb.rpc("match_proyectos", { match_count: ... })`. If the RPC parameter is `int4`, the cast fails and the user gets the error banner for a valid-looking URL; if wider, the huge `LIMIT` can push the planner off the HNSW index into a full scan of `proyecto_embedding`. Either way, each such crafted request also burns one Gemini embed call. Every other path parameter in this codebase is validated early (V5: `BOLETIN_RE`, `PARLAMENTARIO_ID_RE`, `CONTRAPARTE_ID_RE`); `page` is the one input left uncapped.
**Fix:**
```ts
const MAX_PAGE = 50; // 1000 resultados: más que suficiente para un kNN de 20/página
const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(pageParam, 10) || 1));
```

### WR-04: Total enumeration failure is indistinguishable from an empty year — the exit-1 path is effectively dead

**Status:** FIXED (42aed5e) — `enumerarProyectosXAnno` cuenta `fallos` por op y lanza `ambas ops fallaron` cuando `fallos === ops.length`; el `catch → errores++ → exit 1` del CLI ahora se activa. Tests: ambas ops fallan → throw; una falla → retorna lo parcial sin throw.

**File:** `packages/tramitacion/src/connector-camara.ts:145-158` and `packages/tramitacion/src/run-enumerar-historico-cli.ts:97-126`
**Issue:** `enumerarProyectosXAnno` catches the failure of *each* op (`retornarMocionesXAnno`, `retornarMensajesXAnno`) and continues; when BOTH ops fail (network down, WAF block, robots fail-closed) it returns `[]` with only `console.warn` traces. In the CLI, `errores` only increments when `enumerarProyectosXAnno` *throws* — which it can no longer do for fetch failures, and the only remaining throw (invalid `anno`) is already pre-validated by the CLI at lines 65-76. Net effect: a run where every single fetch failed prints `"{anno} → 0 boletines"` per year and exits `0`, and the operator can plausibly read the empty list as "no projects in that range" and skip the backfill. Best-effort per-op is fine; best-effort per-year with a dead failure signal is not.
**Fix:** Make total failure loud. E.g., track per-op failures and throw when all ops failed:
```ts
let fallos = 0;
for (const op of [...] as const) {
  try { ... } catch (e) { fallos++; console.warn(...); }
}
if (fallos === 2) throw new Error(`enumerarProyectosXAnno ${anno}: ambas ops fallaron`);
```
The CLI's existing `catch` → `errores++` → `exit 1` then works as written.

### WR-05: `--service-key` consumes a following flag as its value — the WR-05 fail-fast guard has a hole

**Status:** FIXED (0aa8161) — el guard ahora rechaza también `raw.startsWith("--")` (además de vacío/null). Nuevo `seed-fichas-cli.test.ts` cubre `parseArgs`/`decidirDryRun`, incl. `--service-key --dry-run` → throw.

**File:** `packages/fichas/src/seed-fichas-cli.ts:48-57`
**Issue:** `parseArgs` takes `argv[++i]` as the key value without checking whether it looks like a flag. `seed-fichas-cli --service-key --dry-run` (operator forgot the key) sets `serviceKey = "--dry-run"` and leaves `dryRun` unset → `decidirDryRun` returns `false` → the CLI goes LIVE with a garbage key. This is exactly the "operador creería estar en un modo y está en otro" scenario the inline comment claims to close: the user asked for dry-run and got a LIVE attempt (it fails loudly at PostgREST auth, so no writes occur, but the mode inversion stands and the guard is advertised as fail-fast).
**Fix:**
```ts
const raw = argv[++i];
if (raw == null || raw.trim().length === 0 || raw.startsWith("--")) {
  throw new SeedCliArgsError("--service-key vacío (esperado una key)");
}
```

### WR-06: `psql` invoked via shell string interpolation of a password-bearing URL, with silent error swallowing

**Status:** FIXED (0e8180f) — `psql` usa `execFileSync("psql", [dbUrl, "-tAc", sql])` (sin shell, sin re-cita de la password) y loguea a stderr la CLASE de fallo UNA vez (`code=...`), sin imprimir la URL/credenciales; degradación per-row sigue a `""`/null. `ghRunSignal` también migrado a `execFileSync` por consistencia.

**File:** `packages/freshness/src/query-runner.ts:45-56` (new consumer: `queryCobertura:113-120`)
**Issue:** `execSync(\`psql "${dbUrl}" -tAc "${sql}"\`)` interpolates `SUPABASE_DB_URL` — which embeds the DB password — into a shell command line. The URL is operator-supplied (env, not attacker-controlled), so this is robustness rather than injection: a password containing `"`, `$`, backtick, or (on cmd.exe) `%`/`&` breaks the command or executes something unintended, and the process command line (visible in `ps` / Task Manager) exposes the credential. Additionally, the bare `catch { return ""; }` makes *every* failure mode — psql not on PATH, wrong password, DNS failure — indistinguishable from "no data": all sources render stale, all coverage counts render `?`, and the operator gets zero hint about the actual cause. The helper predates this phase, but `queryCobertura` doubles its blast radius (4 more silent spawns per run).
**Fix:** Use `execFileSync("psql", [dbUrl, "-tAc", sql], ...)` (no shell, no quoting, credential not re-quoted through a shell), and log the failure class once to stderr (e.g., `psql exited/not found: <err.code>`), keeping the per-row degradation to `""`/null.

### WR-07: Unparseable timestamp evaluates as FRESH — freshness fails open on its core signal

**Status:** FIXED (2557e2a) — guard `Number.isNaN(t)` → `diasDesdeUpsert = null` (= desconocido = stale, misma regla que null). Test: `ultimoUpsert: "no-es-una-fecha"` → `stale: true`.

**File:** `packages/freshness/src/evaluate.ts:51-57`
**Issue:** `new Date(ultimoUpsert)` on a string V8 cannot parse yields `Invalid Date`; `now.getTime() - NaN` → `NaN`; `Math.floor(NaN / 86400000)` → `NaN`. Then `stale = diasDesdeUpsert === null || diasDesdeUpsert > umbralDias` evaluates `NaN === null` → false and `NaN > umbral` → false, so **stale = false**: a source whose timestamp the tool cannot even read is reported OK and the CLI exits 0. `queryFreshness` feeds this with raw `psql` output (Postgres `timestamptz` text like `2026-07-09 18:22:33.123456+00`), which V8 happens to parse today — but that is an implementation-defined parser, and any format drift (locale, `DateStyle`, a DATE vs timestamptz column change) silently flips the tool from "monitor" to "false all-clear". The rest of the module is scrupulously fail-honest (null ≠ 0, M=0 → pct null); this is the one fail-open path, and no test covers it.
**Fix:**
```ts
if (ultimoUpsert !== null) {
  const t = new Date(ultimoUpsert).getTime();
  diasDesdeUpsert = Number.isNaN(t)
    ? null // fecha ilegible = desconocido = stale (misma regla que null)
    : Math.floor((now.getTime() - t) / 86400000);
}
```

## Info

### IN-01: `creados` reports attempted rows, not rows actually inserted

**Status:** SKIPPED (fuera de alcance de --fix: Info no trivial; requiere `.select()` sobre el upsert o rename del contrato).

**File:** `packages/fichas/src/writer-supabase.ts:161` (log at `seed-fichas-cli.ts:97`)
**Issue:** `seedFichasPendientes` returns `creados: faltantes.length`, but with `ignoreDuplicates: true` Postgres may DO-NOTHING some of those rows (concurrent seed, or a ficha row missed by the unordered pagination of WR-01). The CLI then logs "N filas 'pendiente' creadas", which can overstate.
**Fix:** Chain `.select("boletin")` on the upsert and count returned rows, or rename the field/log to `intentados` / "filas faltantes enviadas (ON CONFLICT DO NOTHING)".

### IN-02: `loadEnv(root)` result discarded — the call is a no-op

**Status:** SKIPPED (fuera de alcance de --fix: cosmético; el CLI no requiere secretos y el no-op es inocuo).

**File:** `packages/tramitacion/src/run-enumerar-historico-cli.ts:55`
**Issue:** `loadEnv` returns a `Record<string,string>` and never touches `process.env`; the CLI ignores the return value, so line 55 reads and parses `.env` for nothing. The "consistencia" comment invites a future dev to assume env vars got loaded when they did not.
**Fix:** Delete the call and the local `loadEnv` (this CLI needs no secrets, per its own header), or keep the returned record and pass it explicitly when a future need appears.

### IN-03: LIVE seed with missing SUPABASE_URL fails with a generic supabase-js error

**Status:** SKIPPED (fuera de alcance de --fix: Info; el fallo LIVE ya es visible aunque con framing genérico).

**File:** `packages/fichas/src/seed-fichas-cli.ts:81,94`
**Issue:** The service key path degrades/validates explicitly, but `url` can be `""` in LIVE mode and only fails inside `createClient` ("supabaseUrl is required"), without the CLI's operator-friendly framing.
**Fix:** Before instantiating the writer: `if (url.length === 0) throw new SeedCliArgsError("falta SUPABASE_URL / SUPABASE_API_URL en el entorno");`

### IN-04: Coverage table header "M (total)" is truncated to "M (total"

**Status:** FIXED (2557e2a) — `cols.m: 8 → 9` (trivial, mismo paquete freshness que WR-07).

**File:** `packages/freshness/src/cli.ts:118-124`
**Issue:** `pad("M (total)", cols.m)` with `cols.m = 8` slices the 9-char label to `"M (total"` (dropped closing paren) in every render.
**Fix:** `cols.m: 9` (or shorten the label to `"M total"`).

### IN-05: The >1k pagination fix is not exercised by any test

**Status:** SKIPPED (fuera de alcance de --fix: mejora de cobertura de test, no un bug; el mock ya se ajustó a `.order().range()` en WR-01).

**File:** `packages/fichas/src/seed-fichas.test.ts:31-37`
**Issue:** The fake client implements `.range()` slicing and the comments celebrate the >1k fix, but every fixture has ≤3 rows — the multi-page loop (and its termination on an exact multiple of 1000) never runs. The very regression this phase fixed is unguarded.
**Fix:** Add a test with e.g. 1500 proyectos / 200 fichas (PAGE can be made injectable or the fake can use a small page size) asserting all 1300 faltantes are seeded and the loop terminates on an exact-multiple boundary.

### IN-06: `ALCANCE_COBERTURA` is a hardcoded claim that can silently diverge from the corpus

**Status:** SKIPPED (fuera de alcance de --fix: aceptable-como-documentado; derivar el rango de min/max(fecha_ingreso) es trabajo mayor).

**File:** `app/lib/coverage.ts:31`
**Issue:** The banner's N is honestly live, but the scope string "período legislativo 2022–2026" is a constant. `run-enumerar-historico-cli` accepts `--desde 1990`, so one operator backfill outside the period makes the banner claim wrong with no signal. Also date-bound: the period ends this year.
**Fix:** Acceptable as documented (63-ALCANCE-HISTORICO.md), but add a comment in the CLI header and/or `verify-cobertura.sql` reminding that extending the enumerated range requires updating `ALCANCE_COBERTURA`; longer-term derive the range from `min/max(fecha_ingreso)`.

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
