---
phase: 52-cruce2-cruces-nuevos
reviewed: 2026-07-06T00:00:00Z
re_reviewed: 2026-07-06T23:00:00Z
iteration: 2
depth: standard
files_reviewed: 19
files_reviewed_list:
  - app/app/error.tsx
  - app/app/page.test.tsx
  - app/app/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/actualidad-module.test.tsx
  - app/components/actualidad-module.tsx
  - app/components/estado-actual-block.test.tsx
  - app/components/estado-actual-block.tsx
  - app/components/lobby-en-tramitacion.test.tsx
  - app/components/lobby-en-tramitacion.tsx
  - app/lib/lockdown-guard.test.ts
  - packages/cruces/src/clasificar-fichas-cli.ts
  - packages/cruces/src/clasificar-lobby-cli.test.ts
  - packages/cruces/src/clasificar-lobby-cli.ts
  - packages/lobby/src/parse-camara-lobby.test.ts
  - packages/lobby/src/parse-camara-lobby.ts
  - supabase/migrations/0048_lobby_en_tramitacion.sql
  - supabase/tests/0047_rebeldias_honestas.test.sql
  - supabase/tests/0048_lobby_en_tramitacion.test.sql
findings:
  critical: 0
  warning: 0
  info: 7
  total: 7
status: issues_found
fixed_iteration_3: WR-06 (7374ff0) + WR-07 (48db0d0) — 2026-07-06
---

# Phase 52: Code Review Report

**Reviewed:** 2026-07-06 (iteration 1) · **Re-reviewed:** 2026-07-06 (iteration 2, post-fixer 93d5a24..46f7bfa) · **Fix pass 3:** 2026-07-06 (7374ff0 + 48db0d0)
**Depth:** deep (iter 1) / standard regression re-review (iter 2)
**Files Reviewed:** 19 (cumulative)
**Status:** issues_found (0 Critical, 0 Warning open — 7 Info open, no bloqueantes)

## Summary

**Iteration 2 (re-review of the 7 fixes).** All 7 fixes from iteration 1 are verified correct and complete: CR-01 (root `error.tsx` present, matches the repo's `unstable_retry` boundary pattern), CR-02 (parser anchors Cámara dates to Santiago midnight via tzdb-derived offset; verified DST spring-forward/fall-back edge handling in `instanteMedianocheChile`; exhaustive 365-day 2026 test; PROD data re-anchored per context, so RPC `at time zone 'America/Santiago'` is now consistent end-to-end — and UTC-day derivations elsewhere remain correct because Santiago midnight is 03:00/04:00Z of the *same* calendar day), WR-01 (camino 1 gated on exactly `error?.code === "PGRST202"`, regex removed, source-scan test pins it), WR-02 (component dedupes audiencia×semana across comisiones, aggregates comisiones, count uses deduped rows; RTL test covers the two-comisiones case), WR-03 (all four `text-[--accent-product]` occurrences replaced with the `text-accent-product` token; zero occurrences remain repo-wide), WR-04 (`citacionVigente` anchors "hoy" to the Chile calendar day via `Intl` en-CA; evening-Chile test present; robust whether `citacion.fecha` stays UTC-midnight or moves to Santiago-midnight), WR-05 (deterministic `.order("identificador")` + `--desde` cursor with fail-fast parsing).

Targeted suites pass: app components 35/35, packages 22/22.

**Two new/residual Warnings found during regression review:** (1) the WR-05 cursor is keyed on `lobby_contraparte.identificador`, which is **not unique** (it is the audiencia FK; the natural key is `(identificador, nombre, rol)`) — a page boundary that cuts inside a multi-contraparte audiencia strands the remaining siblings forever under the documented `--desde` workflow (WR-06); (2) the RPC's `select distinct` over the 7 projected columns collapses genuinely distinct Cámara audiencias that share (parlamentario, day, materia) — Cámara rows always have `enlace_detalle = null` and date-only fechas, so two real same-day meetings with different lobbistas become one row: a silent undercount in the "conteo neutro" surface (WR-07, pre-existing in the applied 0048, surfaced by the WR-02 analysis).

Invariants re-verified as HELD after the fixes: zero grants / double revoke intact in 0048; no PII fields projected; parlamentario name still plain text; caveat rendered once; anti-insinuación vocab tests pass; keys env-only; no `.from()` on PII tables in changed files.

**Fix pass 3 (2026-07-06, post-iteration-2):** both open Warnings fixed. WR-06 (`7374ff0`): `--desde` cursor re-keyed on the surrogate PK `lobby_contraparte.id` (0021: `bigint generated always as identity primary key`) — `.order("id")` + `.gt("id", desde)`, run-end log prints the last `id`, tests cover sibling contrapartes sharing an `identificador`. WR-07 (`48db0d0`): 0048 amended in-place (authorized: applied today within the same operator checkpoint, operator re-applies right after) — `drop function` + recreate appending `audiencia_id text` (`a.identificador`) as 8th column so `select distinct` keys on audiencia identity; double revoke / security definer / `search_path=''` / zero grants intact; pgTAP updated to plan(10) with the two-distinct-audiencias Cámara case; component dedupes on `audiencia_id` (composite only as pre-amendment fallback, never rendered). Gates green: `tsc -b`, app 541/541, @obs/cruces 33/33.

## Critical Issues

None open.

### CR-01: Home `/` has no error boundary — RESOLVED (iteration 2, commit 93d5a24)

**File:** `app/app/error.tsx` (new)
**Resolution verified:** Root-segment `error.tsx` added, mirroring the six existing route boundaries (client component, `unstable_retry` prop consistent with this Next version's convention across the repo, honest Spanish copy distinguishing failure from absence, no technical detail leaked). A thrown RSC error from any of the home's 6 reads now renders the honest boundary instead of Next's generic 500. See IN-06 for a minor copy side-effect on other uncovered routes.

### CR-02: RPC week derivation inconsistent with Cámara-lobby connector — RESOLVED (iteration 2, commit 308dc88 + PROD data normalization)

**Files:** `packages/lobby/src/parse-camara-lobby.ts:56-125`, `packages/lobby/src/parse-camara-lobby.test.ts:89-126`
**Resolution verified:** `parseFechaCamara` now anchors the printed Chile calendar date to `America/Santiago` midnight with the real tzdb offset (`instanteMedianocheChile`: two-pass offset correction + bounded guard for the nonexistent-midnight DST day — traced the 2026 spring-forward case, converges to the first existing instant of the day). Golden tests pin winter (`-04` → `T04:00:00Z`), summer (`-03` → `T03:00:00Z`), and an exhaustive all-of-2026 property (wall-clock day in Santiago == printed day). Per iteration-2 context, all 17,730 PROD `lobby_audiencia.fecha` values were re-anchored to Santiago midnight, so the applied RPC's `at time zone 'America/Santiago'` derivation is now correct for both leylobby (offset-bearing) and Cámara rows. Cross-checked consumers: no other code derives day/week from `lobby_audiencia.fecha` in TS; UTC-day derivations (`slice(0,10)`, `::date` in UTC sessions) still yield the printed day because Santiago midnight is 03/04:00Z of the same calendar day. No regression.

## Warnings

### WR-01: Message-regex fallback swallows real DB errors — RESOLVED (iteration 2, commit 0bd5960)

**File:** `app/components/lobby-en-tramitacion.tsx:245-256`
**Resolution verified:** Camino 1 is now exactly `error?.code === "PGRST202"`; any other error throws (camino 3). Source-scan test (`lobby-en-tramitacion.test.tsx:210-216`) asserts the regex fallback is absent and the exact code gate is present.

### WR-02: Same audiencia duplicated across comisiones — RESOLVED (iteration 2, commit ce182f1; see WR-07 for the residual flip side)

**File:** `app/components/lobby-en-tramitacion.tsx:63-102,186-227`
**Resolution verified:** `agruparPorSemana` pins the presentation unit to (audiencia × semana): comisiones are aggregated per week group, the same audiencia (keyed on semana+nombre+fecha+materia+enlace) renders once, and `{N}` counts deduped rows. RTL test covers two comisiones citing the same week (1 row, count 1, comisiones joined). Residual: the dedupe key is lossy for Cámara rows — escalated as WR-07 below.

### WR-03: `text-[--accent-product]` dead under Tailwind v4 — RESOLVED (iteration 2, commit de4e1a8)

**Files:** `app/components/lobby-en-tramitacion.tsx:138`, `app/components/actualidad-module.tsx:131,138,237`
**Resolution verified:** All four occurrences replaced with the configured token `text-accent-product`. Grep confirms zero `[--accent-product]` arbitrary values remain in `app/`.

### WR-04: `citacionVigente` "hoy" boundary at server-UTC midnight — RESOLVED (iteration 2, commit 96049e9)

**File:** `app/components/estado-actual-block.tsx:76-118`
**Resolution verified:** "Hoy" is now the Chile calendar day via cached `Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" })`, compared as string against the citación's UTC calendar day — correct for the connector's UTC-midnight convention and still correct if `citacion.fecha` is ever re-anchored to Santiago midnight (03/04:00Z is the same UTC day). Test covers 21:00 Chile / 01:00Z-next-day: today's citación stays vigente, yesterday's does not.

### WR-05: `--solo-confirmadas` never converges, no deterministic order — RESOLVED (iteration 2, commit 46f7bfa; residual defect in the cursor key → WR-06)

**Files:** `packages/cruces/src/clasificar-lobby-cli.ts:119-155,236-245`, `packages/cruces/src/clasificar-fichas-cli.ts:114-125`
**Resolution verified:** Filtered load now has `.order("identificador", { ascending: true })`; `--desde` cursor parsed fail-fast (rejects empty and `--`-prefixed values, tested); end-of-run log prints the last processed identificador for resumption. The abstention-loop problem is addressed via the operator cursor rather than a persisted sentinel — acceptable, but the cursor key choice introduces WR-06.

### WR-06: `--desde` cursor keyed on non-unique `identificador` strands unclassified contrapartes at page boundaries — RESOLVED (fix pass 3, commit 7374ff0)

**Resolution:** Cursor re-keyed on the surrogate PK `id` (the only total-order key): the filtered load selects `id`, orders by `id`, and `--desde` filters `gt("id", desde)`; the run-end log prints the last processed `id`. Tests updated (`gt` on `id`, never `identificador`) plus a sibling-contrapartes case (same `identificador`, distinct `id`s) proving the cursor stays valid inside a multi-contraparte audiencia. Shared parser docs/error updated. Original finding below.

**File:** `packages/cruces/src/clasificar-lobby-cli.ts:140-145,239-245` (cross-file: `supabase/migrations/0021_lobby.sql:64-82`, `packages/cruces/src/writer-supabase.ts:31-41`)
**Issue:** `lobby_contraparte.identificador` is the **audiencia** FK, not a row key — the natural key is `(identificador, nombre, rol)` (0021: `unique (identificador, nombre, rol)`; one audiencia commonly has multiple contrapartes). Two consequences: (a) `.order("identificador")` alone is not a total order — rows sharing an identificador are returned in arbitrary relative order, so the `limit(limite)` page boundary is unstable across runs; (b) worse, when the page boundary cuts **inside** a multi-contraparte audiencia, the printed cursor is that audiencia's identificador, and the next run's `gt("identificador", desde)` **strictly skips the unprocessed sibling contrapartes of that same audiencia forever**. They keep `sector_id = null` but are unreachable via the documented resume workflow — silent, permanent coverage loss in the exact CRUCE-02 flow whose gate is coverage ≥70%. The test suite only exercises single-row-per-identificador fixtures, so it cannot catch this.
**Fix:** Cursor on the surrogate unique PK instead: select `id` too, `.order("id", { ascending: true })`, cursor `gt("id", desde)`, and print the last `id`. (Alternative if the identificador cursor must stay operator-legible: use `.gte(...)` instead of `.gt(...)` — the `sector_id is null` filter already excludes classified boundary rows, so at most one audiencia's worth of abstained rows is re-paid — and add `.order("id")` as tiebreaker.) Add a test with two contrapartes sharing one identificador cut by `limit`.

### WR-07: RPC `select distinct` collapses genuinely distinct Cámara audiencias — silent undercount in the conteo neutro — RESOLVED (fix pass 3, commit 48db0d0)

**Resolution:** 0048 amended IN-PLACE (authorized — first applied today within the same operator checkpoint; operator re-applies immediately): `drop function if exists` (42P13 gotcha) + recreate appending `audiencia_id text` (`a.identificador`) as the LAST (8th) column, so `select distinct` keys on audiencia identity — real same-day meetings stay separate while citación-multiplicity still dedupes. ACL unchanged (security definer, `search_path=''`, stable, double revoke, zero grants). pgTAP: plan(10), proargnames assert appends `audiencia_id`, new fixture with two distinct Cámara-style audiencias (same parlamentario/day/materia, `enlace_detalle` null) → 2 rows. Component: `audiencia_id` in the row interface, dedupe key = `audiencia_id` within week (composite tuple only as pre-amendment fallback), never rendered; RTL covers the 2-distinct-audiencias and fallback cases. Original finding below.

**File:** `supabase/migrations/0048_lobby_en_tramitacion.sql:73-80` (cross-file: `packages/lobby/src/parse-camara-lobby.ts:189-199`, `app/components/lobby-en-tramitacion.tsx:87-99`)
**Issue:** The 7-field projection has no per-audiencia key, so `select distinct` dedupes on (nombre, camara, materia, fecha, semana, comision, enlace). For Cámara-sourced rows this key degenerates: `enlace_detalle` is **always null** (the Detalles column is HTML-commented out) and `fecha` is date-only (Santiago midnight). Two *real, distinct* audiencias — same diputado, same day, same materia text, **different lobbista/lugar** (distinct `identificador`s in the DB; the parser only collapses rows where all 5 source cells match) — therefore collapse into ONE output row, and the UI's neutral count under-reports actual meetings. This is the mirror image of the WR-02 overcount, in the same surface where "conteo neutro" is a hard rule; the component-level dedupe key inherits the same collision (documented at `lobby-en-tramitacion.tsx:87-89`: "el RPC no expone un id de audiencia"). Pre-existing in the applied 0048 (not introduced by the fixes), but load-bearing once Cámara rows flow through the cross — which is now, post-normalization of the 17,730 rows.
**Fix:** Follow-up migration projecting a stable audiencia key (`a.identificador`) and deduping on it — note this changes the returns table, so it requires the known `drop function` + recreate + double-revoke dance (42P13 gotcha) and a contract amendment to the LOCKED 7-field shape (8th field can be internal-only if the UI omits it from render). The component dedupe key then becomes the identificador instead of the lossy tuple. Add a pgTAP case: two audiencias same diputado/day/materia with different lobbistas → 2 rows.

## Info

### IN-01: `semana_iso` fetched in the citación embed but never used — OPEN

**File:** `app/components/estado-actual-block.tsx:253`
**Issue:** Unchanged in iteration 2: the embed still selects `citacion:citacion(comision, fecha, semana_iso)` while the adjacent comment claims "Sólo comisión + fecha: lo mínimo", `PuntoEmbed` omits it, and the flatten discards it.
**Fix:** Drop `semana_iso` from the select.

### IN-02: `cargarFichas` types the `proyecto` embed as object-only — OPEN

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:164-179`
**Issue:** Unchanged: `r.proyecto?.titulo` assumes object-shape; an array-shaped embed silently degrades titulo/materia to null.
**Fix:** Normalize `Array.isArray(c) ? c[0] : c` as in `estado-actual-block.tsx`.

### IN-03: `--service-key` can swallow the next flag as its value — OPEN

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:104-113`
**Issue:** Unchanged — and now inconsistent: the fixer added exactly this `startsWith("--")` guard to `--desde` (line 118) but not to `--service-key`, so `parseArgs(["--service-key", "--dry-run"])` still eats `--dry-run` as the key and runs LIVE with a garbage key.
**Fix:** Mirror the `--desde` guard: reject `raw.startsWith("--")`.

### IN-04: `inicioSemanaIso` computes the ISO week in server-local (UTC) time — OPEN

**File:** `app/components/actualidad-module.tsx:49-56,159`
**Issue:** Unchanged: "Votado esta semana" boundary drifts 3–4 h at the Sunday/Monday transition on UTC infra. Same family as the fixed WR-04; the Chile-calendar anchoring pattern now exists in `estado-actual-block.tsx` and could be reused.
**Fix:** Derive Monday from the Chile calendar day, or document the UTC anchoring.

### IN-05: `urgenciaVigente` misses the noun phrasing "retiro de (la) urgencia" — OPEN

**File:** `app/components/estado-actual-block.tsx:63`
**Issue:** Unchanged: clearing regex is `/retira/i` only; a "Retiro de la urgencia" event neither clears nor sets, leaving a withdrawn urgencia published as vigente on the home.
**Fix:** Broaden to `/retir[ao]/i` + fixture.

### IN-06 (NEW): Root `error.tsx` copy says "No pudimos cargar la portada" but now serves every route without its own boundary

**File:** `app/app/error.tsx:30`
**Issue:** The new root boundary is the nearest error boundary for `/red`, `/sobre`, `/metodologia` and `/admin/revisar-entidades` (none has a segment `error.tsx`). A data error on `/red` now renders "No pudimos cargar la portada" — an honest error page, but factually the wrong surface name. Minor copy mismatch, not a degrade violation.
**Fix:** Neutralize the heading (e.g., "No pudimos cargar esta página") or add per-segment boundaries for the uncovered data routes (`/red` reads live data).

### IN-07 (NEW): `fechaCorta` formats in the server timezone (UTC on Workers) — evening leylobby audiencias display the next calendar day

**File:** `app/lib/format.ts:12-23` (consumed by `app/components/lobby-en-tramitacion.tsx:127-131`)
**Issue:** `fechaCortaFormatter` has no `timeZone`, so on Workers it formats in UTC. Cámara rows (Santiago midnight = 03/04:00Z same day) are safe, but a leylobby audiencia at ≥20:00/21:00 Chile (e.g., `2026-05-14T21:30:00-03` = `2026-05-15T00:30Z`) renders "Reunión registrada el 15 may" while the Chile date — and the RPC's Santiago-derived `semana` shown on the same line — say the 14th; on a Sunday evening the printed date and printed week can even disagree. Pre-existing helper, but Phase 52 is the first surface pairing this date with a Santiago-derived week label.
**Fix:** Add `timeZone: "America/Santiago"` to `fechaCortaFormatter` (audit other `fechaCorta` call sites for UTC-midnight inputs first: Santiago rendering of a UTC-midnight instant shifts a day back — those inputs would need the `fechaCortaSegura`-style string-day path instead).

---

_Reviewed: 2026-07-06 (iteration 1, deep) · Re-reviewed: 2026-07-06 (iteration 2, standard)_
_Reviewer: Claude (gsd-code-reviewer)_
_Fixer range verified: 93d5a24..46f7bfa (7 commits, 11 files) · Targeted suites: app 35/35, packages 22/22_
