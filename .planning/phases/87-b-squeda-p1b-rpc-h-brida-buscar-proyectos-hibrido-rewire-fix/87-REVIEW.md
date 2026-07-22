---
phase: 87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - supabase/migrations/0055_busqueda_hibrida.sql
  - supabase/migrations/0056_busqueda_hibrida_boletin_norm.sql
  - supabase/tests/post-apply/0055_busqueda_hibrida.test.sql
  - supabase/tests/post-apply/0056_busqueda_hibrida_boletin_norm.test.sql
  - app/lib/busqueda-hibrida-gate.ts
  - app/lib/busqueda-hibrida-gate.test.ts
  - app/lib/boletin-detector.ts
  - app/lib/boletin-detector.test.ts
  - app/lib/buscar.ts
  - app/lib/lockdown-guard.test.ts
  - packages/fichas/src/spike/strategies.ts
  - packages/fichas/src/spike/retrieval-cli.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 87: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the híbrida RPC (0055/0056), its post-apply pgTAP, the app-side rewire
(`buscar.ts`, gate, boletin-detector), the lockdown allowlist entry and the spike
harness wiring. The SQL security posture is sound: `q` is never interpolated (all
FTS/boletín paths run against parametrized function arguments), `security definer set
search_path = ''` with schema-qualified objects/operators, doble-revoke with cero grant,
PII-safe 2-column return. Boletín normalization regexes are anchored and free of
catastrophic backtracking.

Two BLOCKER-level correctness defects arise from the flag being flipped default-ON
**in the same commit** that routes ALL public search — including "proyectos similares"
(SEM-05) — through the new RPC: (1) the hybrid RPC silently drops `excludeBoletin`, so a
project now appears in its own "similares" list; (2) the RPC returns `(boletin, rank)`
but the app casts the rows to `MatchProyectoRow` (`{boletin, similarity}`), leaving
`similarity` `undefined` for every downstream consumer. Neither is caught by the unit
tests. Additional warnings cover a missing `statement_timeout` (the CONTEXT LOCKED it as
a day-1 cap but the migration never sets it), the two divergence-prone `detectarBoletin`
copies, and post-apply tests pinned to boletines that can drift.

## Critical Issues

### CR-01: Hybrid RPC drops `excludeBoletin` — a project appears in its own "proyectos similares"

**File:** `app/lib/buscar.ts:206-221` (+ `app/components/proyectos-similares.tsx:46-49`)
**Issue:** `proyectos-similares.tsx` calls
`buscarProyectos(consulta, { excludeBoletin: boletin, matchCount: TOP_SIMILARES })` to
render the "proyectos similares" section (SEM-05). With the flag now **default ON**
(`busqueda-hibrida-gate.ts:26` → `!== "false"`), `buscarProyectos` routes to
`buscar_proyectos_hibrido`, whose signature is `(q, query_embedding, match_count)` — there
is **no `exclude_boletin` argument**. The `opts.excludeBoletin` is silently ignored on
the hybrid path (only the OFF/`match_proyectos` branch at line 229 honors it). Result: the
source project's own boletín is returned as one of its own "similar" projects (self-match,
typically rank-1 since its title/embedding is closest to itself). This is a visible
regression the moment the flag defaults ON, and no test covers it (the ON-path test at
`buscar.test.ts:178-193` never passes `excludeBoletin`).
**Fix:** Filter the self-boletín in the hybrid branch until the RPC supports exclusion.
Minimal app-side fix:
```ts
if (busquedaHibridaEnabled()) {
  const { data: hybridData, error: hybridError } = await sb.rpc("buscar_proyectos_hibrido", {
    q, query_embedding: emb.vector, match_count: (opts.matchCount ?? 20) + (opts.excludeBoletin ? 1 : 0),
  });
  if (hybridError) throw new Error(`buscar_proyectos_hibrido RPC falló: ${hybridError.message}`);
  const rows = (hybridData as MatchProyectoRow[] | null) ?? [];
  return opts.excludeBoletin
    ? rows.filter((r) => r.boletin !== opts.excludeBoletin).slice(0, opts.matchCount ?? 20)
    : rows;
}
```
(Preferred longer-term: add an `exclude_boletin text default null` arg to the RPC and
filter inside both FTS and semantic arms, mirroring `match_proyectos`.)

### CR-02: Return type mismatch — hybrid rows carry `rank`, cast to `{boletin, similarity}` → `similarity` is `undefined`

**File:** `app/lib/buscar.ts:220`
**Issue:** `buscar_proyectos_hibrido` returns `table (boletin text, rank int)` (0055:61,
0056:28). Line 220 does `return (hybridData as MatchProyectoRow[] | null) ?? []`, and
`MatchProyectoRow` is `{ boletin: string; similarity: number }` (types.ts:95-98). The
rows actually contain `{ boletin, rank }` — the `as` assertion is a lie: every row's
`similarity` is `undefined` and an extra `rank` field rides along. The doc comment on the
function (buscar.ts:24, "El `similarity` que devuelve el RPC se usa solo para el orden
server-side") no longer holds on the hybrid path. Today `buscar/page.tsx:86` only reads
`.boletin`, so the ordering is (accidentally) preserved because the RPC already returns
rows in `order by rank`. But any current or future consumer that reads `.similarity`
(e.g. threshold checks, "proyectos similares" scoring, sorting) gets `undefined` — a
silent NaN/ordering bug. The unit test at `buscar.test.ts:192` even asserts
`res).toEqual([{ boletin: "222-07", rank: 1 }])`, codifying the wrong shape as expected.
**Fix:** Return a shape honest about what the RPC emits. Either extend `MatchProyectoRow`
to a discriminated/optional `rank` and map explicitly, or normalize at the boundary:
```ts
const rows = (hybridData as { boletin: string; rank: number }[] | null) ?? [];
// RPC ya devuelve order by rank asc; el orden se preserva sin campo similarity.
return rows.map((r) => ({ boletin: r.boletin, similarity: 0 /* n/a en híbrida */ }));
```
and correct the test to assert the mapped shape (drop the bare `rank` passthrough).

## Warnings

### WR-01: `statement_timeout` LOCAL cap declared LOCKED but never set in the function

**File:** `supabase/migrations/0055_busqueda_hibrida.sql:62`, `0056:29`
**Issue:** CONTEXT (87-CONTEXT.md:34) and the migration header (0055:18, "T-87-04: caps
de fila desde el día 1") commit to a day-1 DoS cap that includes
`SET statement_timeout` LOCAL in the function. The `match_count` LEAST(…,50) and per-arm
`*2` LIMITs are present, but **no `statement_timeout` is set** anywhere in either 0055 or
0056. A `language sql` function cannot `SET LOCAL` in-body; a `SET statement_timeout` in
the function-definition options list (`... set search_path = '' set statement_timeout =
'...'`) is the idiom that was skipped. Under adversarial input (very long `q`,
pathological tsquery over the LEFT JOIN with the per-row `jsonb_array_elements` subquery),
the query can run unbounded. `security definer` runs as the function owner, so no
per-request timeout from the `service_role` session necessarily applies.
**Fix:** Add the cap to the function options in both migrations:
```sql
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'   -- day-1 DoS cap (T-87-04)
as $$ ... $$;
```

### WR-02: `boletin_num = split_part(q, '-', 1)` — type/format assumption unverified against schema

**File:** `supabase/migrations/0055_busqueda_hibrida.sql:72`, `0056:57`
**Issue:** The short-circuit compares `p.boletin_num = split_part(q_norm, '-', 1)`.
`split_part` returns `text`; the comparison only works if `proyecto.boletin_num` is `text`
(or is implicitly cast). If `boletin_num` is stored `int`/`numeric`, the `=` still works
via cast, but a stored value like `14309` compared to text `'14309'` is fine only under
text semantics — leading-zero boletines (`'01234'` base) would mismatch `split_part`
producing `'01234'` vs a numeric `1234`. The migration header cites "boletin_num (0008:20)"
but the review could not confirm the column type. If numeric, `'14.309'`-style inputs with
preserved leading zeros or non-canonical bases could silently miss the short-circuit
(falling through to FTS/semantic, i.e. NOT #1 — violating success criterion #1).
**Fix:** Confirm `proyecto.boletin_num`'s type. If not `text`, cast explicitly and add a
pgTAP case for a leading-zero / edge boletín, or normalize both sides:
`p.boletin_num::text = split_part(q_norm, '-', 1)`.

### WR-03: Two byte-identical `detectarBoletin` copies with no drift guard

**File:** `app/lib/boletin-detector.ts:17-29` vs `packages/fichas/src/spike/boletin.ts:14-26`
**Issue:** The app detector and the spike detector are byte-identical logic (same two
regexes, same strip). Each header claims "fuente única"/"portada", but they are physically
two copies in two packages with no shared import and no test asserting equivalence. The
SQL normalization in 0056:43 (`^\d{1,3}(\.\d{3})*(-\d{1,2})?$`) is a **third** copy of the
same rule. Any future edit to one (e.g. widening to 6-digit bases, or the `\d{3,6}` bound)
silently diverges the redirect (app), the harness short-circuit (spike), and the RPC
normalization (SQL) — exactly the "can they diverge?" risk the review focus flags. This is
accepted duplication per the comments, but there is no mechanical guard.
**Fix:** Extract to a shared package (`@obs/*`) imported by both TS sites, or add a test
that asserts the two `detectarBoletin` produce identical output over a shared fixture set
(and a comment cross-linking the SQL regex to that fixture).

### WR-04: Post-apply tests hard-pin live boletines (`15627-12`, `14309-04`) → brittle regression gate

**File:** `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql:52-63`, `0056:...:49-75`
**Issue:** Assertions (e), (d), (e) depend on specific boletines existing in PROD
`proyecto` at run time. The comments acknowledge the risk ("Si este row se borrara, el
assert puede fallar; re-pinnear…"), but a deleted/renumbered boletín turns a genuine PASS
into a spurious FAIL, and the fix requires manual editing. More subtly, `14.309` (0056
assert e) asserts the result boletín is `14309-04` — this only holds if `14309-04` is the
*only* project with `boletin_num=14309`; if a companion boletín shares the base
(`14309-05`), the `limit 1` picks an arbitrary row and the assert may flap.
**Fix:** Pin against a boletín the test itself asserts exists first (add a guard
`ok(exists(select 1 from proyecto where boletin='15627-12'))` before the behavioral
assert so a missing row reports as a data-precondition failure, not a logic failure), or
derive the pin dynamically from `select boletin from proyecto ... limit 1`.

### WR-05: `retrieval-cli.ts` accepts `--w-fts`/`--w-sem` but the RPC hard-codes `w=1` — CLI knobs silently ignored on the rpc-real strategy

**File:** `packages/fichas/src/spike/retrieval-cli.ts:231-236`, `strategies.ts:318-332`
**Issue:** The CLI exposes `--w-fts`/`--w-sem`/`--rrf-k` and threads them into `runRrf`
(the ad-hoc strategy). But `runRpcHibrida` takes only `{ runSql, limit }` — the RPC bakes
`rrf_k=50`, `w_fts=w_sem=1` into SQL (0056:104-105). An operator running the CLI with
`--w-fts 2` will see the "rpc-real" row unaffected while "RRF ad-hoc" changes, with no
warning that the weights don't reach the RPC. This is a measurement-integrity trap for the
dominance gate: someone tuning weights could mis-read the comparison table.
**Fix:** Emit a note in the rpc-real `parametros` string that weights/k are fixed in SQL
(e.g. `limit=… (RPC real; rrf_k=50 w=1 fijos en SQL, --w-* ignorados)`), or refuse
non-default weight flags when the rpc-real strategy is included.

## Info

### IN-01: `f_unaccent` wrapper is defined but never used by the migration

**File:** `supabase/migrations/0055_busqueda_hibrida.sql:27-30`
**Issue:** `public.f_unaccent(text)` is created "necesario para índices trgm futuros (fase
88)" but nothing in 0055/0056 references it — the tsvector pipeline uses the
`es_unaccent` config, not the wrapper. Dead-until-fase-88 code shipping now. Harmless, but
worth a `-- unused until 88` marker so a future reader doesn't assume it's load-bearing.
**Fix:** Keep with an explicit "reserved for 88" note, or defer its creation to 88.

### IN-02: Idempotency asymmetry — `es_unaccent` config guarded by DO/exception, but `alter … mapping` is not

**File:** `supabase/migrations/0055_busqueda_hibrida.sql:40-42`
**Issue:** The `create text search configuration` is wrapped in a
`duplicate_object`-swallowing `DO` block for re-runnability, but the subsequent
`alter text search configuration … alter mapping` is unguarded. On a second apply it's
idempotent (re-mapping is a no-op replace), so this is benign, but the asymmetry reads as
an oversight next to the deliberate DO wrapper.
**Fix:** None required; optionally comment that the ALTER MAPPING is naturally idempotent.

### IN-03: `l2normalize` returns the input vector unchanged when norm is 0 (zero vector)

**File:** `app/lib/buscar.ts:95-98`
**Issue:** For a zero embedding, `l2normalize` returns `v` (all zeros) rather than a valid
unit vector. A zero vector fed to `<=>` cosine yields undefined/NaN distance behavior. This
is essentially unreachable for real Gemini output, and the post-apply tests deliberately
feed a zero vector only where the boletín short-circuit fires first — so it never reaches
the semantic arm there. Noted for completeness.
**Fix:** None required for this phase; if defensiveness is wanted, treat norm==0 as an
error rather than passing zeros downstream.

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
