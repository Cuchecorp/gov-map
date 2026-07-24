---
phase: 101-relaciones-p2a-audit-brecha-bloque-relaciones-comparar-coali
reviewed: 2026-07-24T21:20:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - app/app/comparar/page.test.tsx
  - app/app/comparar/page.tsx
  - app/app/parlamentario/[id]/page.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/components/comparar-selector.tsx
  - app/components/relaciones-eje-comparar.tsx
  - app/components/relaciones-section.test.tsx
  - app/components/relaciones-section.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/lockdown-guard.test.ts
  - supabase/migrations/0067_militancia_historica_compartida.sql
  - supabase/tests/0067_militancia_historica_compartida.test.sql
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
status: clean
---

# Phase 101: Code Review Report (RE-REVIEW, iteration 3)

**Reviewed:** 2026-07-24T21:20:00Z (WR-06 resolved in iteration 3, commit `fcbf652`)
**Depth:** standard
**Files Reviewed:** 12 (re-review focused on the 8 files touched by fixes `abc1f04..a005207`)
**Status:** clean (0 Critical, 0 Warning — only 5 Info notes remain)

## Summary

Re-review after the fixer pass (commits `abc1f04..a005207`, plus follow-up `4a21f3b`). All three Critical findings and four of five Warnings are **verified fixed in code**, with behavior locked by tests:

- **CR-01 RESOLVED** — `/comparar` no longer decides pair intersections from a single LIMIT-20-truncated list. `interseccionPar` (page.tsx:505-518) reads BOTH directions, declares presence on a match in either, declares absence only when at least one list is provably complete (`listaCompleta`: under-cap length, or `total_n ≤ length`), and otherwise renders a declared "indeterminado" limitation — never a false absence. Column counts use `totalHonesto` (`total_n` before the cap), never the capped `.length`. RTL describe (8) covers: both-truncated → no absence claim + `total_n=25` shown (not 20); under-cap → declared absence; reverse-direction-only match → presente with symmetric `n_proyectos`.
- **CR-02 RESOLVED** — comisiones intersection keys on the composite `${c.camara}::${c.nombre}` (page.tsx:302, 316-321); cross-chamber homonyms ("Hacienda" diputados vs senadores) no longer match. RTL describe (9) covers both the negative and positive cases.
- **CR-03 RESOLVED** — 0067 now carries the full molde 0064: `security definer`, `set search_path = ''`, `set statement_timeout = '5s'` (0067:44-46), `LIMIT 20`, double-revoke re-emitted after drop/recreate (0067:86-87). Re-applied to PROD per commit `de8e328`; pgTAP asserts the proconfig.
- **WR-01 RESOLVED** — the baked `FECHA_COBERTURA` constant is gone. `fechaConsultaHoy()` (page.tsx:52-59) computes the consultation date per request (route is force-dynamic) in tz America/Santiago; the comisiones eje uses the max row-level `fecha_captura` ("según fuente al") with an honest "consultado al" fallback. Regression test forbids any baked `consultadas al 20XX-…` literal.
- **WR-02 PARTIALLY RESOLVED** — the intersection absence copy is now correctly scoped ("no registran militancia histórica compartida **fuera del partido vigente**", page.tsx:277, tested). However, the CR-01 fix introduced a NEW unscoped instance in the column copy — see WR-06 below.
- **WR-03 RESOLVED** — copy softened on both surfaces to what the data supports: "Militaron en un mismo partido (en períodos posiblemente distintos…)" (comparar page.tsx:269-274, 522-533; ficha page.tsx:477-490 heading "Militaron en el mismo partido").
- **WR-04 RESOLVED** — the honest-empty contract now has an owner: `RelacionesConDatos` (ficha page.tsx:363-399) awaits the 5 readers (React.cache dedup) and mounts `<RelacionesSection vacio />` when all `total_n` are 0; `RelacionesSection` renders the declared absence `RELACIONES_VACIO` instead of a mute grid (relaciones-section.tsx:44-46, 62-65). Deliberate, documented trade-off of per-block streaming for contract correctness.
- **WR-05 RESOLVED** — pgTAP 0067 hardened to `plan(9)` with exactly 9 assertions: `authenticated` revoke leg, `search_path` proconfig, `statement_timeout=5s` proconfig, prosecdef scoped by `::regprocedure`, `total_n` presence, PII-negative regex, and an exact returns-table contract (`TABLE(id text, nombre text, camara text, total_n bigint)`).

Remaining: five Info items only (three carried over unfixed — they were not in the fixer's scope — plus two new minor ones observed in the fixed code). The last Warning (WR-06, a WR-02-class semantics leak reintroduced by the CR-01 fix in the militancia column copy) was resolved in iteration 3 (commit `fcbf652`) — 0 Critical, 0 Warning remain.

## Critical Issues

None remaining. CR-01, CR-02, CR-03 verified fixed (see Summary).

## Warnings

None remaining. WR-06 resolved in iteration 3 (see below and the Resolved table).

### WR-06: RESOLVED (iteration 3, commit `fcbf652`) — militancia column copy on /comparar is not scoped to the 0067 net-new semantics (WR-02 leak, second instance)

> **Resolution:** both branches of `ejeColMilitancia` (page.tsx) now carry the net-new scope, mirroring the intersection copy at line 277 — absence: "Sin militancia histórica compartida **fuera del partido vigente** registrada para {nombre}."; positive count: "…(en períodos posiblemente distintos; **sin contar el partido vigente compartido**).". Behavior locked by new RTL describe (11) in page.test.tsx: n=0 asserts the scoped absence AND forbids the old unscoped string; n>0 asserts the scoped count qualifier. Suite 1303 green, tsc -b clean, anti-insinuación guard green.

**File:** `app/app/comparar/page.tsx:522-533` (`ejeColMilitancia`)
**Issue:** The honest-count columns added by the CR-01 fix render, at `n === 0`:

```
Sin militancia histórica compartida registrada para {nombre}.
```

and at `n > 0`: `"{n} parlamentarios militaron en un mismo partido que {nombre} (en períodos posiblemente distintos)."`

The 0067 RPC is net-new-only: it **excludes** every partner who shares the vigente alias, even when that partner *also* shares a historic party. A parlamentario whose only shared-history partners are current co-partisans gets `total_n = 0` from the RPC — and the column then asserts an **unscoped absolute absence** ("Sin militancia histórica compartida registrada") that is false: the shared history IS registered in the sources; the RPC excludes it by design. This is exactly the false-statement class WR-02 named, and exactly why the intersection copy was scoped to "fuera del partido vigente" (page.tsx:277) — the fixer applied the scope to the intersection line but wrote a new unscoped absence in the columns. The positive count has the same (milder) leak: it silently understates by excluding vigente co-partisans with shared history, without the "sin compartir el partido vigente" qualifier the intersection copy carries.
**Fix:** Scope both branches of `ejeColMilitancia` to the RPC's real semantics, mirroring line 277:

```tsx
{n === 0
  ? `Sin militancia histórica compartida fuera del partido vigente registrada para ${nombre}.`
  : `${n} ${n === 1 ? "parlamentario militó" : "parlamentarios militaron"} en un mismo partido que ${nombre} (en períodos posiblemente distintos; sin contar el partido vigente compartido).`}
```

Update the WR-02 regression test (page.test.tsx describe 8, first case) if its `not.toContain` guards need the new strings.

## Info

### IN-01: (carried over, unfixed) Comment claims Suspense makes cross-link failures non-fatal — Suspense does not catch errors

**File:** `app/app/parlamentario/[id]/page.tsx:257-260`
**Issue:** The REL-02 comment still states "Cada bloque conserva su propio `<Suspense fallback={null}>` para streaming independiente (un fallo no tumba la ficha…)". Suspense handles pending promises, not thrown errors; with the WR-04 restructure, a reader error now throws inside `RelacionesConDatos` and propagates to the route error boundary — which is what #34 wants, and what the NEW JSDoc at lines 360-361 correctly documents. The two comments now contradict each other in the same file.
**Fix:** Delete or correct the "un fallo no tumba la ficha" clause in the REL-02 comment; the WR-04 JSDoc already states the true behavior.

### IN-02: (carried over, unfixed) lockdown-guard still anchors on `process.cwd()` while the sibling guard migrated to `import.meta.dirname`

**File:** `app/lib/lockdown-guard.test.ts:43`
**Issue:** Unchanged (`APP_ROOT = process.cwd()`); anti-insinuacion-guard uses `import.meta.dirname` citing the v8.1 pnpm cwd bug. Loud sanity assertions keep this non-exploitable today.
**Fix:** `const APP_ROOT = path.resolve(import.meta.dirname, "..");`

### IN-03: (carried over, unfixed) canonical-order "behavior" test is still a source-regex scan; mock roster still passed with `as never`

**File:** `app/app/comparar/page.test.tsx:198-202, 128`
**Issue:** Unchanged: the orden-canónico test greps for `.filter(...).sort()` instead of rendering `?a=D1002&b=D1001` and asserting normalization; `roster: ROSTER_DEFAULT as never` still erases the fixture's type contract.
**Fix:** Add one behavioral case for slot normalization; replace `as never` with `as ParlamentarioListadoRow[]`.

### IN-05: NEW — "Ver el detalle en cada ficha." in the indeterminado copy is a dead-end instruction (IN-04's pattern re-appears)

**File:** `app/app/comparar/page.tsx:281, 396`
**Issue:** IN-04's original dead-end ("Ver la ficha para el detalle…" as plain text) was removed by the CR-01 fix — **resolved**. But the new indeterminado copy ends with "Ver el detalle en cada ficha." rendered as plain text with no anchor to `/parlamentario/{a}` / `/parlamentario/{b}`, so the instruction is again not actionable (both ids are already regex-validated and available in scope).
**Fix:** Render the two ficha links inside `InterseccionIndeterminada` (pass `a`/`b` and emit validated `<a href={/parlamentario/${id}}>` anchors), or drop the sentence.

### IN-06: NEW — `listaCompleta` checks the hardcoded `CAP_RPC` before `total_n` — latent false-"complete" if a migration ever lowers the DB LIMIT below 20

**File:** `app/app/comparar/page.tsx:483-490`
**Issue:** `listaCompleta` returns `true` whenever `filas.length < CAP_RPC` (20), consulting `total_n` only at exactly 20 rows. Today the DB caps are all `limit 20`, so `length < 20` implies the list is complete. But if a future migration lowers a cross-link RPC's LIMIT (e.g., to 10) without touching this constant, a truncated 10-row list would be classified complete → false absence declared — the exact failure CR-01 fixed, resurrected silently. The rows already carry the ground truth (`total_n`).
**Fix:** Prefer `total_n` when present, independent of the constant:

```tsx
function listaCompleta(filas: CrossLinkRow[]): boolean {
  const total = filas[0]?.total_n;
  if (typeof total === "number") return total <= filas.length;
  return filas.length < CAP_RPC; // fallback only when the RPC omits total_n
}
```

## Resolved in this iteration

| ID | Finding | Resolution (verified in code) |
|----|---------|-------------------------------|
| CR-01 | Intersections/counts from LIMIT-20-truncated lists | `interseccionPar` two-direction + completeness gate + declared "indeterminado"; counts via `total_n` (`totalHonesto`). Tests describe (8). Commit `abc1f04`. |
| CR-02 | Comisiones intersection by nombre only | Composite key `camara::nombre`. Tests describe (9). Commit `573a41a`. |
| CR-03 | 0067 missing `statement_timeout` | `set statement_timeout = '5s'` + double-revoke re-emitted; re-applied to PROD; pgTAP asserts proconfig. Commit `de8e328`. |
| WR-01 | Hardcoded "2026-07-24" date | Request-time `fechaConsultaHoy()` (tz Chile) + row-level `fecha_captura` for comisiones; regression test. Commit `256776c`. |
| WR-02 | Net-new false absence (intersection copy) | Intersection absence scoped "fuera del partido vigente" + tested. Column instance (WR-06) closed in iteration 3. Commit `f13fa9a`. |
| WR-06 | Net-new false absence re-introduced in militancia column copy (iteration 2) | Both `ejeColMilitancia` branches scoped to 0067 net-new semantics ("fuera del / sin contar el partido vigente"), mirror of line 277; locked by RTL describe (11). Commit `fcbf652` (iteration 3). |
| WR-03 | Temporal-overlap copy overclaim | Copy softened to "Militaron en un mismo partido (en períodos posiblemente distintos)" on ficha + /comparar. Commit `5a7eb60`. |
| WR-04 | Empty grid without declared absence | `RelacionesConDatos` owns the contract; `<RelacionesSection vacio />` → `RELACIONES_VACIO`. Commits `1df2a24`, `4a21f3b`. |
| WR-05 | Weak pgTAP (authenticated leg, proconfig, prosecdef overload) | `plan(9)`: authenticated revoke, search_path + statement_timeout proconfig, regprocedure-scoped prosecdef, exact returns contract. Commit `a005207`. |
| IN-04 | Dead-end "Ver la ficha…" column text | Column text replaced by honest counts (CR-01 fix). Residual variant noted as IN-05. |

---

_Reviewed: 2026-07-24T21:20:00Z (re-review, iteration 2)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
