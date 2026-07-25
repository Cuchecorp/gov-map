---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
reviewed: 2026-07-24T00:00:00Z
re_reviewed: 2026-07-24T23:40:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - app/app/comparar/page.test.tsx
  - app/app/comparar/page.tsx
  - app/components/co-votacion-red-guard.test.ts
  - app/components/red/arista-hecho.tsx
  - app/components/red/red-graph.tsx
  - app/components/similitud-votacion-comparar.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/lockdown-guard.test.ts
  - app/lib/vsim-antiflip-guard.test.ts
  - app/lib/vsim-gate.test.ts
  - app/lib/vsim-gate.ts
  - docs/legal/102-LEGAL-DOSSIER-VSIM.md
  - supabase/migrations/0068_coincidencia_votos_par.sql
  - supabase/tests/0068_coincidencia_votos_par.test.sql
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 102: Code Review Report — RE-REVIEW (fix verification)

**Reviewed:** 2026-07-24 (initial) · **Re-reviewed:** 2026-07-24 (post-fix, commits b1f69cb..75c402a)
**Depth:** standard
**Files Reviewed:** 14
**Status:** clean (no Critical/Warning remain; 3 Info open)

## Summary

Re-review of the fixer's 7 claimed fixes. **All 7 are real and correct**; no fix
introduced a regression. Evidence gathered independently, not from fixer claims:

- **RTL + guard suites green:** `vitest run app/comparar/page.test.tsx components/co-votacion-red-guard.test.ts` → 2 files, **44/44 passed** (includes the new WR-02 3-state block, WR-03 mutation self-checks, WR-04 full-paragraph assertion).
- **pgTAP 14/14 against the APPLIED PROD schema** (`psql -tA -f supabase/tests/0068_coincidencia_votos_par.test.sql`, rollback-wrapped): tests 11-13 (dedupe/conflict exclusion) and 14 (self-pair 0/0/null) can only pass against the *fixed* function body — the WR-01/IN-01 migration is applied to PROD, not merely committed.

Two new minor Info items surfaced during re-review (both non-blocking): a stale
"pgTAP 10/10" count left in dossier §1/§8 after §5 was updated to 14/14, and a
deterministic edge in the 0068 dedupe where a mixed substantive/pareo duplicate is
not treated as a conflict. IN-02 remains open by explicit operator decision.

## Resolved Findings (verified in re-review)

### CR-01: /red legend "misma votación" — RESOLVED (b1f69cb)

`red-graph.tsx:479-481` legend step 4 now reads only "audiencia de la misma
contraparte de lobby"; `:488-491` fuente line is "Fuente: Ley del Lobby (Ley
20.730) · datos ingestados por este observatorio" — no vote references. The new
WR-03 prose tripwire scans `app/red/` + `components/red/` post-comment-strip and
passes, independently confirming zero vote idioms remain on the surface
(`arista-hecho.tsx` also verified clean; its `co_votacion` mention lives in a
comment, correctly stripped).

### WR-01: 0068 duplicate-row inflation — RESOLVED (45077b2)

Both CTEs now `group by v.votacion_id` with `min(v.seleccion)` and
`having count(distinct v.seleccion) = 1`: a concordant duplicate collapses to one
row; a contradictory duplicate excludes the votación from N, M **and**
`fecha_captura_max` (the subselect intersects the already-filtered CTEs).
pgTAP 11-13 exercise both cases against the applied schema and pass.

### WR-02: comisiones axis false absence from capped lists — RESOLVED (818abc3)

`page.tsx:313-314` — `comisionesCompletas = comA.length < CAP_RPC_COMISIONES && comB.length < CAP_RPC_COMISIONES`
(fail-closed: `length === cap` treated as possibly-truncated). Capped-no-match now
renders `InterseccionIndeterminada` (`:383-386`); each column declares "Lista
posiblemente truncada" at the cap (`:346-352`, `:363-369`). The block comment
(`:561-583`) now documents the real caps: 20 for 0061/0067 (`CAP_RPC`), 50 for
0060/0064 (`CAP_RPC_COMISIONES`, no `total_n`). RTL block (9b) covers both the
indeterminate and the below-cap-absence paths; green.

### WR-03: guards blind to rendered vote prose — RESOLVED (cbe00f7)

`co-votacion-red-guard.test.ts:62-63` adds `PROSA_VOTO_RE`
(`votaci|\bvota\b|…|votó`) + `tieneProsaVotoEnCodigo` (`:156-158`) scanning all
`RED_DIRS` source post-comment-strip (strings/JSX included). Mutation self-checks
bite on the exact CR-01 copy ("misma votación" in JSX, "votaciones de sala" in a
string, "votan"/"votaron"), ignore comment-only mentions, and reject the "pivota"
false-positive. All 14 guard tests green.

### WR-04: neutral-figure assertion window — RESOLVED (e12fa1d)

`page.test.tsx:532-541` now locates the enclosing `<p …>…</p>` around the figure
(`lastIndexOf("<p", figuraIdx)` → `indexOf("</p>", figuraIdx)`) and asserts the
full paragraph — including its own opening tag — contains neither
`text-accent-product` nor `font-semibold`. The bypass described in the original
finding (a span wrapping "75%" opening after `figuraIdx`) is now caught. Verified
the figure in `similitud-votacion-comparar.tsx:119-121` renders inside its own
`<p>` with no nested `<p`/`<path` that could mislocate the bracket.

### IN-01: self-pair trivial 100% — RESOLVED (426fd94)

`0068:60` — `and p_a <> p_b` in CTE `a` → empty join → single aggregate row
`(0, 0, null)`. pgTAP 14 asserts it against the applied schema; green.

### IN-03: dossier prose vs. actual denylist — RESOLVED (75c402a)

§5 now quotes the real `TERMINOS_PROHIBIDOS` semantics ("afín" cubre "más afín";
"cercano a" — explicitly noting bare "cercano" is NOT in the list; "bloque de"
cubre "bloque de votación"); §3 now says "escaneo estático PERMANENTE del árbol
completo de /red (no un chequeo de diff)" and documents the prose scan. One new
staleness introduced by this fix — see IN-04.

## Info (open)

### IN-02: Component renders "({pct}%)" without guarding pct === null when m > 0

**File:** `app/components/similitud-votacion-comparar.tsx:119-121`
**Issue:** The props contract allows `{ m: 4, pct: null }`; the component would render "Coinciden en n de 4 votaciones compartidas (%)." Impossible from the current caller (pct is derived from m), but the prop type invites drift.
**Fix:** Either derive nothing and accept only `pct: number` when `m > 0` (discriminated union), or fall back to omitting the parenthetical when `pct == null`.
**Status:** OPEN — skipped by explicit operator decision (props contract change deferred).

### IN-04 (new): Dossier pgTAP count internally inconsistent (10/10 vs 14/14)

**File:** `docs/legal/102-LEGAL-DOSSIER-VSIM.md:56-58` (§1) and `docs/legal/102-LEGAL-DOSSIER-VSIM.md:245` (§8)
**Issue:** The IN-03 fix updated §5 to "pgTAP 14/14 contra el schema aplicado (Plan 02 + fix WR-01/IN-01…)", but §1 still says "migración 0068 aplicada a PROD en Plan 02, pgTAP 10/10" and §8 still cites "(Plan 02, 10/10)". The suite is now `plan(14)` and passes 14/14 against PROD (verified this re-review). The dossier is the artifact a human signs; its evidence counts should agree with themselves and with reality.
**Fix:** Update §1 and §8 to "pgTAP 14/14" (or "14/14 tras los fixes WR-01/IN-01 de la review 102").

### IN-05 (new): 0068 dedupe treats a mixed substantive/pareo duplicate as non-conflicting

**File:** `supabase/migrations/0068_coincidencia_votos_par.sql:56-73`
**Issue:** The substantive filter (`seleccion in ('si','no','abstencion')`) is applied in the WHERE, *before* `group by`/`having count(distinct seleccion) = 1`. If identity resolution ever produces, for the same (votación, parlamentario), a confirmed `'si'` row AND a confirmed `'pareo'` row (different `fuente_voter_id`s), the pareo row is dropped pre-grouping and the votación counts as `'si'` — even though the raw data is contradictory (one channel says "voted yes", the other "paired / didn't vote"). The migration's own stated principle ("duplicado contradictorio = dato no confiable → fuera") would arguably exclude it. Deterministic, never inflates N/M, and requires a doubly-rare data condition — hence Info, not Warning.
**Fix:** Either document the choice in the migration header ("conflicto = solo entre selecciones sustantivas; una fila sustantiva prevalece sobre pareo/ausente"), or detect the conflict pre-filter, e.g. a first CTE grouping confirmed rows per (votacion_id) with `having count(distinct seleccion) = 1` BEFORE applying the substantive filter, plus a pgTAP case with a `'si'`+`'pareo'` duplicate.

---

_Reviewed: 2026-07-24 · Re-reviewed: 2026-07-24 (post-fix b1f69cb..75c402a)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Evidence: vitest 44/44 (page.test.tsx + co-votacion-red-guard.test.ts) · pgTAP 14/14 vs PROD applied schema (rollback-wrapped)_
