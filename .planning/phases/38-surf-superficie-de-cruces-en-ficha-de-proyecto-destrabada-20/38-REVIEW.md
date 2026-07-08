---
phase: 38-surf-superficie-de-cruces-en-ficha-de-proyecto
reviewed: 2026-07-07T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - supabase/migrations/0049_cruces_de_proyecto.sql
  - supabase/tests/0049_cruces_de_proyecto.test.sql
  - app/components/cruces-de-proyecto.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/lib/types.ts
  - app/lib/lockdown-guard.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
resolved:
  - WR-01
  - WR-02
  - IN-01
  - IN-02
  - IN-03
deferred:
  - IN-04  # naming/doc decision — no code defect (nombre_normalizado vs parlamentario_publico)
  - IN-05  # legal-review nuance, LOCKED text — flagged for sign-off holder, no code change
status: clean
fix_notes: >
  WR-01/WR-02/IN-01/IN-02/IN-03 fixed (commits 6646f8d, e28c051, 6fcd678).
  Both warnings resolved → clean. Migration 0049 amended in-place (NOT applied to
  PROD, not in schema_migrations); component/page changes ride the next deploy — no
  redeploy triggered by this fix pass. Suite 690 green (baseline 689 + N=1 test),
  typecheck (tsc -b) clean.
---

# Phase 38: Code Review Report

**Reviewed:** 2026-07-07
**Depth:** deep (security-sensitive: new SQL RPC + public-facing surface under signed legal conditions)
**Files Reviewed:** 6
**Status:** clean (fixed 2026-07-07 — WR-01, WR-02, IN-01, IN-02, IN-03 resolved; IN-04, IN-05 deferred as doc/legal decisions)

## Summary

Reviewed the SURF-02 surface: the new `cruces_de_proyecto(text)` RPC (0049), its pgTAP
(0049 test), the `CrucesSection`/`CrucesView` component, the page/rail wiring, the
`CruceProyectoRow` type, and the lockdown-guard allowlist entry. Cross-checked against the
reference idiom (0047/0048/0039/0040), the signed `SIGNOFF-senales-voto.md`, and the
`38-UI-SPEC.md` LOCKED contract.

**Security posture is sound — no blockers.** The RPC is injection-safe (parameter used only
in `=` equality, never concatenated), `security definer set search_path = ''` with all names
schema-qualified, reads PII tables (`parlamentario`, `cruce_senal`) internally but emits only
public-derived columns (no `rut`/`partido`/`email`), and applies the deterministic double
`revoke` with zero grant — a verbatim mirror of 0047:101-102 / 0048:128-132. `cruces_de_proyecto`
is correctly added to `PUBLIC_RPC_ALLOWLIST`, and the Block-A guard will not flag 0049 (it
contains no `grant` statement). The 3-path degrade in the component is exact (PGRST202 → null;
any other error → throw; data → render) and matches the anti-blanket-catch idiom. The pgTAP
seeds its own fixture, asserts contract/security/data invariants (incl. no-PII and the two
negative cases), and rolls back. The component test covers all three degrade paths, the LINK
departure, the 1× caveat, singular/plural, the unknown-`tipo_senal` degrade, and a banned-vocab
+ RUT negative-match. Data-integrity edge (`sec` CTE without `distinct`) is safe because
`proyecto_ficha.boletin` is a PRIMARY KEY (0011:21).

The findings below are quality/robustness and one legal-compliance nuance — none block ship,
but WR-01 touches a HARD sign-off condition and deserves an explicit decision.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `order by conteo desc` ranks parliamentarians by lobby magnitude — tension with sign-off condition 3 ("sin ranking")

> **RESOLVED (2026-07-07, commit 6646f8d):** changed to `order by p.nombre_normalizado asc` (neutral alphabetical). Migration 0049 amended in-place — NOT applied to PROD, not in schema_migrations. pgTAP has no order assertion (filters by `parlamentario_id`), no test change needed.


**File:** `supabase/migrations/0049_cruces_de_proyecto.sql:104`
**Issue:** The final `order by cs.conteo desc, p.nombre_normalizado asc` presents the list of
parliamentarians "most lobby meetings first." Sign-off condition 3 (`SIGNOFF-senales-voto.md`)
and UI-SPEC anti-insinuación invariant 5 both require *"conteo neutro; sin ranking, score ni
porcentaje-como-veredicto."* The analog `cruces_de_parlamentario` (0040:47) also uses
`conteo desc`, but there it ranks ONE person's own sectors; here it ranks DIFFERENT
parliamentarians against each other by lobby volume, which reads much closer to an implicit
"los más reunidos" verdict — the exact framing the sign-off bans. Because the count is also
displayed per row, the descending order compounds a magnitude signal across subjects.
**Fix:** Make the neutral key primary so the surface does not order people by lobby magnitude:
```sql
  order by p.nombre_normalizado asc;   -- neutral ordering; conteo is shown per-row, not ranked
```
If ordering by activity is intentionally desired, get it explicitly re-affirmed against
sign-off condition 3 before ship (this is a signed legal condition, not a style choice).

### WR-02: `RailSkeleton` renders 6 rows but the rail resolves to 7–8 entries → layout shift

> **RESOLVED (2026-07-07, commit e28c051):** `RailSkeleton` now renders `crucesPublicEnabled(process.env) ? 8 : 7` rows, matching `ProyectoRail.navEntries`. Component change — rides the next deploy (no redeploy triggered by this pass).


**File:** `app/app/proyecto/[boletin]/page.tsx:500` (skeleton) vs `:222-244` (real entries)
**Issue:** `ProyectoRail.navEntries` produces 7 entries when the cruces gate is OFF and **8**
when ON (estado, timeline, votaciones, lobby-tramitacion, cruces◆, idea-matriz, cuerpos-legales,
similares). The gate is ON in PROD (2026-07-02). `RailSkeleton` renders `Array.from({ length: 6 })`,
and its own docstring claims it is "Shape-matched a FichaRail para no producir layout shift"
(`:491`). A 6→8 mismatch produces a visible CLS jump when the rail resolves — the exact defect
the skeleton exists to prevent (anti-CLS was an explicit F54 goal).
**Fix:** Match the resolved count, accounting for the gate:
```tsx
const nEntries = crucesPublicEnabled(process.env) ? 8 : 7;
// ...
{Array.from({ length: nEntries }).map((_, i) => (
  <Skeleton key={i} className="h-11 w-full rounded-md" />
))}
```

## Info

### IN-01: Count suffix not pluralized — renders "1 parlamentarios" for N=1

> **RESOLVED (2026-07-07, commit 6fcd678):** `${n} ${n === 1 ? "parlamentario" : "parlamentarios"}`. Added RTL test locking N=1.


**File:** `app/components/cruces-de-proyecto.tsx:168`
**Issue:** `const conteoLabel = n > 0 ? \`${n} parlamentarios\` : "sin registros";` produces the
ungrammatical "1 parlamentarios" when exactly one parliamentarian matches. The per-parlamentario
heading (`encabezadoReuniones`) correctly handles singular ("1 reunión"), so the inconsistency is
visible on the same surface. The UI-SPEC copy row literally says "{N} parlamentarios" (so this is
spec-faithful), and no test exercises the N=1 suffix, so it is uncaught.
**Fix:** `\`${n} ${n === 1 ? "parlamentario" : "parlamentarios"}\``.

### IN-02: `new Date(item.fecha)` bypasses the NaN-safe date helper

> **RESOLVED (2026-07-07, commit 6fcd678):** now uses `fechaCortaSegura(item.fecha)` (format.ts:121), which degrades honestly on non-parseable input instead of rendering "Invalid Date".


**File:** `app/components/cruces-de-proyecto.tsx:140`
**Issue:** `fechaCorta(new Date(item.fecha))` renders directly. If `item.fecha` were a
non-null but malformed string, `new Date(bad)` → Invalid Date → `Intl.format` → the literal
"Invalid Date" is rendered instead of being omitted. Risk is low in practice because
`item.fecha` originates from a `timestamptz` in the materializer (0039:106) → always valid ISO
or null, and null is already guarded by `item.fecha &&`. But the codebase has a purpose-built
safe helper (`fechaCortaSegura`, format.ts:121) for exactly this.
**Fix:** Prefer `fechaCortaSegura(item.fecha)` (omit/fallback on non-parseable), or guard with
`Number.isNaN(d.getTime())`.

### IN-03: Stale rail-entry counts in comments

> **RESOLVED (2026-07-07, commit e28c051):** comments updated to "7–8 entradas (según el gate de cruces)".


**File:** `app/app/proyecto/[boletin]/page.tsx:490` ("6 entradas de nav") and `:199`, `:203`
("las 7 entradas del rail")
**Issue:** Neither figure matches the actual 7 (gate off) / 8 (gate on) entries after the cruces
carril was added. Comment drift only; no runtime effect. (Related to WR-02.)
**Fix:** Update the comments to "7–8 entradas (según el gate de cruces)".

### IN-04: RPC emits `nombre_normalizado`, while the sign-off/UI-SPEC cite the `parlamentario_publico` projection

> **DEFERRED (2026-07-07):** naming/doc decision, not a security or code defect (both are non-PII display names). Left for the sign-off holder to either document `nombre_normalizado` as intended or align to `parlamentario_publico`. No code change this pass.


**File:** `supabase/migrations/0049_cruces_de_proyecto.sql:92`; `app/lib/types.ts:367-386`
**Issue:** Sign-off condition 4 and UI-SPEC §Departure describe the subject as projected "via
`parlamentario_publico`" (which emits the column `nombre`). The RPC instead selects
`p.nombre_normalizado` directly from the master table. Both are non-PII display names (no leak),
so this is not a security defect — but it is a naming inconsistency with the cited projection and
could drift from whatever normalization `parlamentario_publico` applies.
**Fix:** Either document that `nombre_normalizado` is the intended public name field for this
surface, or align to the same column `parlamentario_publico` exposes for consistency.

### IN-05 (nuance, legal-review): the LOCKED caveat says "coincidencia temporal" but this cruce is SECTORAL

> **DEFERRED (2026-07-07):** LOCKED caveat text — no code change without a spec/legal decision. Inherited verbatim from the approved `/parlamentario` cruces surface. Flagged for the sign-off holder / December-2026 legal pass to decide whether a sectoral caveat is more accurate across both surfaces.


**File:** `app/components/cruces-de-proyecto.tsx:59-60`
**Issue:** The caveat "La coincidencia temporal no implica relación entre la reunión y el voto"
is the LOCKED text (UI-SPEC copy row; reused verbatim from `CrucesCapa1`/0040 surface). However,
0049 yuxtaposes a vote with lobby meetings by **SECTOR** (thematic), not by time — the RPC's own
header states "la coincidencia es de SECTOR (temática)". The evidence items may have `null`
fecha and are not time-aligned to the vote, so "coincidencia temporal … entre la reunión y el
voto" describes a relationship the surface does not actually establish (it arguably *implies* a
temporal proximity the data lacks). This is inherited-and-approved verbatim from the analog
`/parlamentario` cruces surface, so it is not a defect introduced by this phase — but given the
phase ships under signed legal conditions with a scheduled December-2026 data-law revision, the
temporal-vs-sectoral wording is worth surfacing for that legal pass.
**Fix:** No code change without a spec/legal decision (the text is LOCKED). Flag for the sign-off
holder to confirm whether a sectoral caveat ("coincidencia temática/de sector") is more accurate
across both cruces surfaces.

---

_Reviewed: 2026-07-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
