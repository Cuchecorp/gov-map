# Phase 105 — Plan Check (pre-execution)

**Verdict:** CONCERNS
**Phase:** 105 — BCN parser senadores en ORIGEN + re-corrida de militancias
**Plans checked:** 2 (105-01, 105-02)
**Date:** 2026-07-26

**Summary:** 1 BLOCKER, 2 WARNINGS. The parser-fix plan (105-01) is sound and fail-closed
as required. But the re-corrida plan (105-02) rests on an upsert that CANNOT achieve
"cero URI en `parlamentario_militancia`" for the primary (URI→label remapped) case,
because the upsert key includes `partido_alias` which CHANGES when the label changes,
so the old URI row is left behind. Success Criterion #2 will fail as written unless a
stale-row cleanup step is added.

---

## BLOCKER-1 — Re-corrida leaves stale URI militancia rows (SC #2 unmet)

- **dimension:** key_links_planned / requirement_coverage
- **plan:** 105-02, Task 2
- **requirement:** BCN-01 (mitad DATOS), Success Criterion #2 ("cero URI-como-partido en `parlamentario_militancia`")

**Trace (verified against code):**
1. Today a stale PROD row has `partido = "http://datos.bcn.cl/.../partido-democratas-chile"`,
   `partido_alias = aliasDePartido(<URI>)`, `desde = <fecha>`. `aliasDePartido` splits on
   whitespace; a URI has no spaces → the initials fallback yields length < 2 → it returns the
   **whole URI string as the alias** (`parse-bcn-senadores.ts:75-83`).
2. After 105-01, the parser emits `partido = "Partido Demócratas Chile"` and
   `partido_alias = aliasDePartido("Partido Demócratas Chile")` = `"PDC"` — a **different alias**,
   same `desde`.
3. The militancia upsert key is `parlamentario_id,partido_alias,desde`
   (`writer-supabase.ts:109`, `writer.ts:54`). Because `partido_alias` changed, the upsert
   **INSERTS a new (clean) row and the OLD URI row REMAINS** — the writer is upsert-only with
   NO delete/reconcile path (grep confirmed: no delete/reconcile in `packages/bio/src`).
4. Result: `select count(*) from parlamentario_militancia where partido ~* '^https?://'` will
   be **> 0** after the re-corrida for exactly the witness case (S1344). The plan's own
   verification (a) will FAIL.

**Why the plan misses it:** 105-02 Task 2 only anticipates stale rows for the *fail-closed
unknown-URI* branch ("su militancia previa con URI quedó stale"). It does NOT anticipate that
the **happy remap path also leaves a stale row**, because the alias — part of the natural key —
changes with the label. The plan treats the upsert as if it overwrites the URI in place; it does
not. Note the contrast: `parlamentario.partido` IS updated in place via
`actualizarPartidoParlamentario` (`.update().eq(id)`), so verification (b) on the `parlamentario`
table will pass — masking the militancia-table failure if only (b) is checked.

**Fix (add before closing 105-02):** Add an explicit, bounded, read-then-delete cleanup of stale
URI rows in `parlamentario_militancia` — e.g. after the re-corrida, delete rows where
`partido ~* '^https?://'` for the affected senador ids (the upsert already re-created the clean
equivalents). This is a data-cleanup of a KNOWN-bad value, not fabrication. Alternatively, make
the militancia key insensitive to the alias change (not recommended — riskier). The plan must
name the mechanism and add it to Task 2's actions + acceptance criteria, and the verification
query (a) must be run AFTER the cleanup, not only after the upsert.

---

## WARNING-1 — Verify command hard-codes `S1344` as a table id; witness lookup underspecified

- **dimension:** task_completeness
- **plan:** 105-02, Task 2

The action says `select partido from parlamentario where id = 'S1344'` "(o el id/parlid
correspondiente)". `S1344` is the Senate-portal id (`parlid_senado` / caso testigo), not
necessarily the `parlamentario.id` primary key. The maestra join is by `parlid_senado`
(`enlazarSenadoresPorParlid`), and `parlamentario.id` may differ. The executor should resolve the
witness by `parlid_senado = 'S1344'` (or the confirmed maestra id) rather than assuming the PK
equals the portal id, or the witness check silently returns zero rows and gives a false "clean".
Low risk (Task 2 already hedges with "o el id/parlid correspondiente") but tighten the query.

---

## WARNING-2 — Task 1 of 105-01 has no automated verify (Nyquist 8a), relies on live BCN

- **dimension:** nyquist_compliance / task_completeness
- **plan:** 105-01, Task 1

Task 1 is evidence-collection (`<automated>MISSING</automated>`) and depends on a LIVE query to
`datos.bcn.cl`. This is acceptable under the Nyquist rule because the *following* Task 2 in the
same wave carries the real automated gate (`pnpm vitest run ...`), and Task 2's map is what gets
tested — so sampling continuity holds (1 of 2 tasks automated, window < 3). But two residual
risks: (a) if the live BCN query is unreachable at execution time, the map has no evidence source
and Task 1's stated preference-(1) "R2 crudo" is explicitly punted to 105-02 — so there is no
in-plan fallback; (b) the map's completeness is only as good as the DISTINCT set returned that
day. Recommend: Task 1 fall back to enumerating URIs from the R2 envelope (the same crudo 105-02
will replay) if live BCN fails, so the map is grounded in exactly the data being re-parsed. Not
blocking (Test C fail-closed guarantees no fabrication even if the map is incomplete — an
uncovered URI is omitted, not invented), but an incomplete map widens BLOCKER-1's stale-row set.

---

## What PASSES (verified)

- **Fail-closed parser (SC #1):** 105-01 Task 2 behaviors A–D are correct and match the LOCKED
  decision. Test C (unknown URI → omit + report), Test D (no output `partido` starts with
  `http`), and the "never derive from slug in the parser" rule are all explicit. The idiom aligns
  with the existing `sinMatch` fail-closed pattern in `enlazarSenadoresPorParlid`.
- **Two-stage / `--from-r2` (CLAUDE.md LOCKED):** 105-02 correctly uses `--from-r2` replay from
  the R2 envelope; `run-bio-cli.ts:251-266` confirms the replay path exists, reads R2 (not BCN),
  and writes to Supabase when creds present + no `--dry-run`. The dry-run robustness step is a
  good pre-flight. Never re-scrapes BCN. ✓
- **BCN-02 documentation (SC #3):** 105-02 Task 3 documents the LOCKED "conservar partidoLegible()
  as defense-in-depth" decision WITH post-re-corrida evidence, confirms `format.ts` untouched via
  `git status`, and keeps the 6 tests / 3 consumers intact. Matches CONTEXT.md exactly. ✓
- **No facet regression / RAW key (SC #4):** 105-02 Task 2 includes an explicit non-regression
  check of the partido facet and correctly notes only the stored VALUE changes, not the serialized
  RAW grouping key (per 104-03 design). Aligns with the LOCKED "sin regresión" decision. ✓
- **Context compliance:** No deferred ideas pulled in (bio 1:1, partidoLegible removal both stay
  deferred). No scope reduction language ("v1", "simplified", "static") in either plan. Decisions
  honored verbatim.
- **Dependencies:** 105-01 (wave 1, no deps) → 105-02 (wave 2, depends_on 105-01). Correct: the
  corrected parser must be in the tree before the replay re-parses the crudo. Acyclic. ✓
- **Scope:** 2 tasks (105-01) + 3 tasks (105-02), small file footprint. Within budget. ✓

---

## Recommendation

**Return to planner to fix BLOCKER-1** (add explicit stale-URI-row cleanup to 105-02 Task 2 +
move verification query (a) to run after cleanup). WARNING-1 and WARNING-2 should be folded in
during the same revision. Once the stale-row deletion is in the plan and its acceptance criterion
requires `count(*) ... ~* '^https?://' == 0` on `parlamentario_militancia` AFTER cleanup, the plan
set will achieve all four success criteria.
