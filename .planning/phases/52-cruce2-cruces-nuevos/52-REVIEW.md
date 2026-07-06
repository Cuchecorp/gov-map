---
phase: 52-cruce2-cruces-nuevos
reviewed: 2026-07-06T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
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
  - supabase/migrations/0048_lobby_en_tramitacion.sql
  - supabase/tests/0047_rebeldias_honestas.test.sql
  - supabase/tests/0048_lobby_en_tramitacion.test.sql
findings:
  critical: 2
  warning: 5
  info: 5
  total: 12
status: issues_found
---

# Phase 52: Code Review Report

**Reviewed:** 2026-07-06
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 52 (CRUCE2) adds: the `lobby_en_tramitacion` RPC (0048, ALREADY APPLIED to PROD per checkpoint 52-06) + its pgTAP; the lobby×tramitación juxtaposition rail and SC3 citación line on the ficha; the 3-block ActualidadModule on the home (now `force-dynamic`); the `--solo-confirmadas` incremental load for the lobby classifier CLI; and the `lobby_en_tramitacion` allowlist entry in the lockdown guard.

Load-bearing invariants verified as HELD: migration 0048 has zero grants and the idiomatic double revoke (Camino A); the RPC returns-table exposes no partido/rut/email and only `nombre_normalizado`+`camara` from the maestra; the RPC is in `PUBLIC_RPC_ALLOWLIST`; the parlamentario name is plain text (not linked) in the juxtaposition rail; the caveat is rendered exactly once; counts are neutral Mono facts; no `.from()` on PII tables anywhere in the new code; keys come from env only.

Two Critical findings: (1) the home page now throws on any transient DB error from 6 per-request reads with NO error boundary anywhere above it — a routine transient failure replaces the entire landing (hero + search) with Next's default 500; (2) the RPC's `at time zone 'America/Santiago'` week derivation is provably inconsistent with the Cámara-lobby connector, which stores audiencia dates as UTC-midnight timestamps — every Monday-dated Cámara audiencia lands in the WRONG ISO week (lost real coincidences, fabricated false ones). The pgTAP fixture derives both sides with the RPC's own expression, so it structurally cannot catch this.

## Critical Issues

### CR-01: Home `/` has no error boundary — any transient DB error now 500s the entire landing, hero included

**File:** `app/app/page.tsx:82`, `app/components/actualidad-module.tsx:164-166,263-267,360-364,390-392` (and `app/app/` — missing `error.tsx`)
**Issue:** This phase converts the home from a static hero into a `force-dynamic` page that performs 6+ Supabase reads per request (`votacion`, `tramitacion_evento`, `proyecto`, `citacion`, `lobby_audiencia`, `proyecto_ficha`). Each block correctly throws on a real read error (#34, rule D). But unlike EVERY other data-driven route in the app (`proyecto/[boletin]/error.tsx`, `parlamentario/[id]/error.tsx`, `buscar/error.tsx`, `agenda/error.tsx`, `parlamentarios/error.tsx`, `contraparte/[id]/error.tsx`), the root segment has no `error.tsx`. A `<Suspense>` boundary does NOT catch errors — a thrown RSC error propagates to the nearest error boundary, and there is none above `/`. Result: one transient DB/network hiccup in a below-the-fold freshness block replaces the ENTIRE landing — including the LOCKED hero and search box, the product's primary entry surface — with Next's generic "Application error" page. This also contradicts the module's own contract A ("el módulo NUNCA se oculta entero... cada bloque degrada... independiente", T-52-15): blocks are independent for the 0-rows path but a single-block ERROR takes down all three blocks plus the hero.
**Fix:** Add `app/app/error.tsx` mirroring the existing route-level honest-error pages (e.g., copy the pattern from `app/app/agenda/error.tsx`). This preserves the #34 throw-on-real-error convention while containing the blast radius to an honest error UI instead of a raw 500. (Optionally, follow-up: per-block error containment so the hero survives, but the boundary is the minimum ship-blocker.)

### CR-02: RPC week derivation is inconsistent with the Cámara-lobby connector — Monday audiencias shift to the previous ISO week

**File:** `supabase/migrations/0048_lobby_en_tramitacion.sql:86` (cross-file: `packages/lobby/src/parse-camara-lobby.ts:60-77`, `packages/lobby/src/parse-leylobby.ts:39-50`, `packages/agenda/src/parse-senado-citaciones.ts:33-39`)
**Issue:** The RPC computes the audiencia's week as `to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW')` — assumption A1: `lobby_audiencia.fecha` is a true instant. That holds for the leylobby path (`parseFechaLeylobby` preserves the `-04` offset: `2024-06-24 12:30:00-04`). It does NOT hold for the Cámara path: `parseFechaCamara("26 jun. 2026")` produces `Date.UTC(anio, mes, dia)` → `2026-06-26T00:00:00Z`, i.e., the Chile calendar date stored as UTC MIDNIGHT. `'2026-06-26T00:00:00Z' at time zone 'America/Santiago'` = `2026-06-25 20:00` — the calendar day shifts back one day. For Tuesday–Sunday dates the shifted day stays inside the same Mon–Sun ISO week, but every MONDAY-dated Cámara audiencia lands in the PREVIOUS ISO week: a real same-week coincidence is silently lost, and a false coincidence with the prior week's citaciones is fabricated — the exact wrong-fact class the anti-insinuación rules exist to prevent. Meanwhile `citacion.semana_iso` is derived from the printed Chile date via UTC-neutral `isoWeekOf` (`semanaIsoDeFechaIso`), so the citación side is calendar-day-faithful — the mismatch is entirely on the audiencia side. Note the pgTAP fixture (`0048_lobby_en_tramitacion.test.sql:79-108`) seeds fechas WITH real `-03` offsets and derives `semana_iso` using the RPC's own expression, so the suite structurally cannot detect this divergence.
**Note on apply status:** 0048 is ALREADY APPLIED to PROD (checkpoint 52-06 done, pgTAP 9/9). If PROD `lobby_audiencia` currently contains only leylobby-sourced rows (offset-bearing timestamps), no live data is wrong today — but the Cámara ingestion path exists in the codebase and will corrupt the cross on first use.
**Fix:** Two options (pick one, then verify in PROD with `select count(*) from lobby_audiencia where fecha = date_trunc('day', fecha at time zone 'utc') at time zone 'utc' and fecha::time = '00:00:00'`):
1. Normalize the connector: `parseFechaCamara` should emit the date anchored to Chile (e.g., `${iso}T12:00:00-04:00` noon-anchoring, or store with explicit `-04`/`-03` offset), plus a one-off UPDATE for any already-ingested Cámara rows.
2. Make the RPC robust to date-only UTC-midnight values, e.g. join on `to_char((a.fecha at time zone 'America/Santiago') + interval '0', ...)` replaced by a CASE on `a.fecha::time = '00:00:00+00'` → use `a.fecha at time zone 'utc'` for those rows (requires a follow-up migration `create or replace`, same returns table → no drop needed).

## Warnings

### WR-01: Message-regex fallback in the degrade path swallows REAL DB errors as "function absent"

**File:** `app/components/lobby-en-tramitacion.tsx:214-218`
**Issue:** Camino 1 returns `null` when `error.code === "PGRST202"` **or** when `/does not exist|schema cache/i` matches the message. The message fallback is far broader than function-not-found: any genuine schema regression inside the security-definer body (e.g., a renamed/dropped column → `column a.enlace_detalle does not exist`, or a dropped underlying table → `relation ... does not exist`) matches the regex and silently removes the section instead of throwing — violating the project's own degrade-honesto rule ("error real → throw", camino 3) that this very file documents. Now that 0048 is applied to PROD, the pre-apply rationale for the broad fallback is gone: the only legitimate trigger left is PGRST202 itself.
**Fix:** Restrict camino 1 to the precise signal:
```ts
if (error?.code === "PGRST202") return null;
```
If cache-staleness variants must be tolerated, gate the message regex on the code being a PostgREST routing code (`error?.code?.startsWith("PGRST")`), never on bare Postgres errors.

### WR-02: The same audiencia is duplicated across comisiones — RPC unit is (audiencia × semana × comisión), not the documented (audiencia × semana)

**File:** `supabase/migrations/0048_lobby_en_tramitacion.sql:73-92`; `app/components/lobby-en-tramitacion.tsx:161-198`
**Issue:** The migration comment states the semantic unit is "(audiencia × semana coincidente), no (audiencia × citación)" and adds `select distinct` for that. But `comision` (and `semana_iso`) are projected columns, so when TWO different comisiones cite the same boletín in the same ISO week (e.g., the topical comisión plus Hacienda — a common tramitación pattern), the same audiencia survives DISTINCT twice, once per comisión. The UI then renders the identical reunión (same parlamentario, fecha, materia, enlace) in two week-groups, and the per-group neutral counts sum to more reuniones than actually occurred — a mild count inflation in the exact surface where "conteo neutro" is a hard rule. The pgTAP dedupe test (assert 7) only covers two citaciones of the SAME comisión, so this case is untested.
**Note on apply status:** 0048 is applied; a fix is a follow-up `create or replace` (same returns table, no drop needed).
**Fix:** Decide and pin the unit. If the unit is truly audiencia×semana, aggregate comisiones (e.g., `string_agg(distinct c.comision, ', ')` grouped by audiencia+semana) or pick one row per audiencia via `distinct on (a.identificador, c.semana_iso)`. Alternatively, if audiencia×semana×comisión is the intended unit, fix the migration comment and make the UI summary language per-comisión unambiguous, and add a pgTAP case with two comisiones in the same week.

### WR-03: `text-[--accent-product]` is a Tailwind v3-only shorthand — under Tailwind v4 (and with this token's raw-HSL channels) it produces no styling

**File:** `app/components/lobby-en-tramitacion.tsx:113`; `app/components/actualidad-module.tsx:131,138,237`
**Issue:** The app is on `tailwindcss ^4.3.1`. The v3 arbitrary-value CSS-variable shorthand `text-[--accent-product]` was removed in v4 (v4 syntax is `text-(--var)`), so these classes emit nothing. Even under the v4 syntax it would still be broken: `--accent-product` is defined as raw HSL channels (`app/app/globals.css:24` → `183 38% 26%`), valid only inside `hsl(var(...))` — which is exactly what the configured token `text-accent-product` does (`app/tailwind.config.ts:46`). Every other component in the repo uses `text-accent-product`. Net effect: the "Ver fuente oficial ↗" / "Ver proyecto →" links in the new lobby rail and all three home blocks render WITHOUT the petróleo accent (inherit body color), silently violating the LOCKED design-system color reservation. The `hover:text-[--accent-product]` on line 113 is equally dead.
**Fix:** Replace all four occurrences with the repo token:
```tsx
className="... text-accent-product"
```

### WR-04: `citacionVigente` "hoy" boundary uses server-local (UTC on Workers) midnight — a citación de HOY expires ~4 hours early Chile time

**File:** `app/components/estado-actual-block.tsx:83-104`
**Issue:** `inicioHoy` is midnight in the SERVER's timezone (`setHours(0,0,0,0)`), which on Cloudflare Workers is UTC. `citacion.fecha` is populated from the printed Chile date at UTC midnight (connector convention). During a Chile evening (≥20:00/21:00 CLT, i.e., after 00:00 UTC of the next day), `inicioHoy` advances to the next UTC day and today's citación (stored at today 00:00Z) fails `>= inicioHoy` — the "Citado en {comisión} el {hoy}" line vanishes while the session may still be ongoing in Chile. This directly contradicts the code's own comment ("una citación de HOY sigue vigente — no expira al pasar la medianoche del propio día"). Migration 0048 documents this exact pitfall (Pitfall 2 timezone / America/Santiago) for the SQL side; the TS helper ignores it.
**Fix:** Anchor "hoy" to the Chile calendar day, e.g. compute today's `YYYY-MM-DD` via `Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" })` and compare against `c.fecha.slice(0, 10)` (string date compare), avoiding server-tz arithmetic entirely.

### WR-05: `--solo-confirmadas` incremental load never converges on abstained rows and has no deterministic ordering

**File:** `packages/cruces/src/clasificar-lobby-cli.ts:117-129,186-205` (cross-file: `packages/cruces/src/writer-supabase.ts:105-121`)
**Issue:** The incremental property relies on `sector_id is null` shrinking each run. But when the classifier abstains (`sector_codigo === null`), the writer updates `sector_id = null` — a no-op — so abstained rows remain in the candidate set FOREVER: every subsequent run re-selects and re-pays the MiniMax call for the same perpetual abstainers. Worse, the query has `.limit(limite)` with NO `.order()`, so Postgres returns an arbitrary subset; if abstainers accumulate to ≥ `limite` and happen to fill the returned page, a run performs `limite` LLM calls and advances zero rows, with no signal to the operator. The doc comment's claim "re-correr AVANZA en vez de re-pagar las mismas llamadas" only holds when most rows classify successfully.
**Fix:** (a) Add a deterministic `.order("id")` to the filtered load; (b) persist the abstención as a sentinel instead of `null` (e.g., a `sector_revisado_at` timestamp column, or a reserved `sin_sector` codigo) so processed-but-abstained rows exit the `is null` set; at minimum, log the count of rows that were re-processed without change so a stuck run is visible.

## Info

### IN-01: `semana_iso` fetched in the citación embed but never used

**File:** `app/components/estado-actual-block.tsx:237-278`
**Issue:** The embed selects `citacion:citacion(comision, fecha, semana_iso)` while the adjacent comment claims "Sólo comisión + fecha: lo mínimo", the `PuntoEmbed` type omits `semana_iso`, and the flatten discards it. Dead projection contradicting its own comment.
**Fix:** Drop `semana_iso` from the select (or use it and type it).

### IN-02: `cargarFichas` types the `proyecto` embed as object-only, unlike the sibling normalizer

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:145-160`
**Issue:** `estado-actual-block.tsx:264-278` normalizes the same class of Supabase to-one embed as `object | array` because PostgREST's shape depends on relationship detection; `cargarFichas` assumes object-only (`r.proyecto?.titulo`). If the relationship were ever reported to-many, `titulo`/`materia` silently become `null` and classification quality degrades without any error.
**Fix:** Reuse the array|object normalization (`Array.isArray(c) ? c[0] : c`) or assert the shape and throw on mismatch.

### IN-03: `--service-key` can swallow the next flag as its value

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:97-105`
**Issue:** `parseArgs(["--service-key", "--dry-run"])` accepts `"--dry-run"` as the key (non-empty string passes the guard), so the operator loses dry-run AND runs LIVE with a garbage key — the opposite of the fail-fast intent documented on the case.
**Fix:** Reject values starting with `--`: `if (raw == null || raw.trim().length === 0 || raw.startsWith("--")) throw ...`.

### IN-04: `inicioSemanaIso` computes the ISO week in server-local time (UTC on Workers), not Chile

**File:** `app/components/actualidad-module.tsx:49-56,159`
**Issue:** "Votado esta semana" filters by `>= Monday 00:00` in the server's timezone. On UTC infra, votes cast Sunday 20:00–24:00 Chile time belong to the next UTC ISO week, so late-Sunday votaciones drop out of "esta semana" 3–4 hours early (and the boundary label drifts symmetrically). Hours-wide skew, same family as WR-04.
**Fix:** Derive the Monday from the Chile calendar day (see WR-04 fix) if precision at the boundary matters; otherwise document the UTC anchoring.

### IN-05: `urgenciaVigente` misses the noun phrasing "retiro de (la) urgencia" — now exposed on the home

**File:** `app/components/estado-actual-block.tsx:51-74` (pre-existing helper, F51); newly consumed by `app/components/actualidad-module.tsx:249-302`
**Issue:** The clearing regex is `/retira/i` (verb form only). A tramitación event worded "Retiro de la urgencia" contains "urgencia" but matches neither `retira` nor `hace presente`, so it is skipped and the prior urgencia stays "vigente" — the home's "Urgencias vigentes" block would then publish a withdrawn urgencia as current. Pre-existing logic, but Phase 52 promotes it from one ficha line to the portada.
**Fix:** Broaden to `/retir[ao]/i` (covers retira/retiro) and add a fixture for the noun phrasing.

---

_Reviewed: 2026-07-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
