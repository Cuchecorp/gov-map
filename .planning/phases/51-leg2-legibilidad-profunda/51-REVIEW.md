---
phase: 51-leg2-legibilidad-profunda
reviewed: 2026-07-03T15:10:00Z
depth: deep
iteration: 3
files_reviewed: 5
files_reviewed_list:
  - app/components/patrimonio-de-parlamentario.tsx
  - app/components/patrimonio-de-parlamentario.test.tsx
  - app/lib/lockdown-guard.test.ts
  - supabase/migrations/0047_rebeldias_honestas.sql
  - supabase/tests/0047_rebeldias_honestas.test.sql
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

> ORCHESTRATOR NOTE (post-iter-3): WR-08 (year 0000 pasa el round-trip JS pero Postgres lo rechaza) fue corregido por el orquestador tras el cierre del loop --auto: `(?!0000)` en `esFechaISOValida` + 1 test (commit `fix(51): WR-08`). Suite 497/497 verde, tsc limpio. Los 2 Info restantes (IN-09 grant quoted `"anon"` — cubierto por pgTAP post-apply; IN-10 dedupe conservador de filas contradictorias) quedan ACEPTADOS y documentados abajo.

# Phase 51: Code Review Report — RE-REVIEW iteration 3 (--auto)

**Reviewed:** 2026-07-03T15:10:00Z
**Depth:** deep
**Files Reviewed:** 5 (scope = iteration-2 fix commits `c3ccc5b`, `ccedd2b`, `852dc55`)
**Status:** issues_found (1 Warning: WR-06 fix incomplete; CR-04 and WR-07 verified fixed)

## Summary

Verified the three iteration-2 fixes against the five touched files, including
empirical execution of the date-validation and guard-regex logic under Node, and
cross-file tracing of `?a`/`?b`/`?comparar` → `comparar_declaraciones(p_id text,
fechas date[])` (0022/0031) → PostgREST `date[]` cast.

- **CR-04 — VERIFIED FIXED** (`c3ccc5b`). The `mayoria` CTE ranks by
  `count(distinct v.parlamentario_id)`, so a duplicated bancada row (3 raw `si`
  rows / 2 distinct persons vs 2 `no`) no longer breaks a real tie nor flips the
  majority; `having count(*) = 1` still excludes genuine ties. pgTAP `plan(11)`
  matches exactly 11 assertions; the new fixture (PART_EMPDUP: D1 with duplicated
  `si`) exercises precisely the fabrication scenario and asserts 0 rows for
  PTEST_D3. Assertion (2) `proargnames` pin (`p_id` + 7 OUT columns) matches the
  recreated `returns table`. The double revoke (0041 idiom) is intact and the
  migration passes guard A (no `grant … to anon/public` outside comments).
- **WR-07 — VERIFIED FIXED** (`852dc55`). `anonGrantOffenders` regex
  `grant\s+\S[\s\S]*?\bto\s+[\w,\s]*\b(anon|public)\b` verified against 8
  candidate statements: catches `to public`, `to anon`, multi-role lists
  (`to authenticated, anon`) and multi-function lists; does NOT false-positive on
  `revoke … from public`, `grant … on schema public to service_role`, nor
  schema-qualified `public.f(text) to service_role`. Synthetic cases (a)–(g)
  assert the real matrix, not a tautology. One evasion residual noted as IN-09.
- **WR-06 — FIX INCOMPLETE** (`ccedd2b`, see WR-08 below). The round-trip
  correctly rejects `2026-99-99` (NaN) and `2026-02-30` (V8 rollover caught by
  the `toISOString` comparison — rollover empirically confirmed in this Node),
  but **year `0000` round-trips cleanly in JS while Postgres has no year 0** →
  the exact 500 WR-06 was closing survives for `?a=0000-01-01&b=0000-01-02`.

No regressions found: the a/b-vs-comparar precedence, the `length < 2` reset, the
`fechasDisponibles` derivation and the RTL suites are consistent with the fixes;
suite 496/496 and tsc clean corroborated by scope context. Accepted Info items
IN-07/IN-08 remain (see Notes).

## Warnings

### WR-08: `esFechaISOValida` accepts year `0000`, which Postgres rejects → residual 500 on the whole ficha (WR-06 incomplete)

**File:** `app/components/patrimonio-de-parlamentario.tsx:860-864`
**Issue:** JavaScript's `Date` uses the proleptic Gregorian calendar **with** a
year 0, so `esFechaISOValida("0000-01-01")` returns `true` (empirically
verified: `new Date("0000-01-01T00:00:00Z").toISOString()` →
`"0000-01-01T00:00:00.000Z"`, round-trip passes). Postgres has **no year 0**:
`'0000-01-01'::date` raises `date/time field value out of range`. The value
flows unfiltered into `sb.rpc("comparar_declaraciones", { …, fechas })` whose
parameter is `fechas date[]` (0022/0031) — the PostgREST cast fails, `cmpError`
is non-null, and `PatrimonioSection` throws → 500 for the entire ficha. This is
the same cheap, repeatable URL-manipulation failure mode WR-06 set out to close
(`/parlamentario/<id>?a=0000-01-01&b=0000-01-02`); ~366 crafted dates (any valid
JS date in year 0, which JS treats as a leap year — `0000-02-29` also passes)
survive the fix.
**Fix:** reject year 0 in the regex (ISO `YYYY-MM-DD` input otherwise stays
within Postgres's `date` range):
```ts
export function esFechaISOValida(f: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(f)) return false; // Postgres no tiene año 0
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}
```
Add the test case alongside the WR-06 suite:
```ts
it("año 0000 (válido en JS, inexistente en Postgres) → false", () => {
  expect(esFechaISOValida("0000-01-01")).toBe(false);
  expect(esFechaISOValida("0000-02-29")).toBe(false);
});
```

## Info

### IN-09: guard A bypasseable con identificador citado `to "anon"`

**File:** `app/lib/lockdown-guard.test.ts:210`
**Issue:** `grant execute on function public.f(text) to "anon";` is valid SQL
equivalent to `to anon`, but the character class `[\w,\s]*` and the `\b`
boundary don't traverse the double quote — empirically verified as a
non-match. A migration author would have to write the quoted form deliberately,
and the file header already documents that the static scan is not the last line
of defense (the pgTAP post-apply `0044_revoke_anon.test.sql` asserts the
catalog truth). Residual, not a regression of the WR-07 fix.
**Fix:** allow optional quotes around the role:
`\bto\s+["\w,\s]*["]?\b(anon|public)\b`-style widening plus a synthetic case
(h) `to "anon"` → offender; or leave as-is with a one-line comment pointing at
the pgTAP post-apply as the authoritative check.

### IN-10: filas duplicadas CONTRADICTORIAS (misma persona, selecciones distintas) en 0047

**File:** `supabase/migrations/0047_rebeldias_honestas.sql:64-90`
**Issue:** the CR-04 fix (and the `distinct on` dedupe (c)) covers *identical*
duplicates. If dirty data gives the same parliamentarian rows with *different*
selections in one votación: (1) in the `mayoria` CTE the person is counted once
in *each* option — this errs toward creating ties (exclusion, never
fabrication), consistent with the honest-default design; (2) in the final
SELECT the WHERE filters per-row, so a person with one row equal to the
majority and one differing row still surfaces as "votó distinto", and with two
differing selections the surviving `seleccion_propia` is nondeterministic
(`distinct on` ordered only by `votacion_id`). Behavior (1) is acceptable;
(2) is a narrow dirty-data edge outside the CR-04 scope.
**Fix (optional hardening):** exclude the parliamentarian's votación when their
own confirmed non-absent rows are contradictory (pre-CTE on `p_id` with
`having count(distinct v.seleccion) = 1`), or document the edge in the header
alongside (c).

## Notes — accepted Info carried from previous iterations

- **IN-07** (accepted): comment-strip residual — trailing `--` comments on code
  lines are retained by `stripSqlComments`; heuristic `(?<!:)\/\/` in
  `stripTsComments`. Verified 0047's trailing comments contain no
  grant-to-anon text; no false positive in the current tree.
- **IN-08** (accepted): dead export `esRetiroUrgencia` remains exported without
  callers. Not touched by the iteration-2 commits.

---

_Reviewed: 2026-07-03T15:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
