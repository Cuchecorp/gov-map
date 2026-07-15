---
phase: 78-bento-home-actualidad-votado-urgencias-frescura-como-tiles
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - app/components/actualidad-module.tsx
  - app/components/actualidad-module.test.tsx
  - app/app/page.tsx
  - app/app/page.test.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: fixed
---

# Phase 78: Code Review Report

**Reviewed:** 2026-07-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the Phase 78 bento-home migration: three `ActualidadModule` presentational blocks (`VotadoEstaSemanaView`, `UrgenciasVigentesView`, `UltimaActualizacionView`) plus their async RSC fetchers, and their mounting inside `BentoGrid` on `app/app/page.tsx`. The phase invariants (cero copy/datos mockup, `safeExternalHref` on externals, empty-states honestos, `[var(--token)]` con cero hex, `aria-hidden` en decorativos, `<nav>` landmark, orden DOM = orden colapso, GATE §9.1 banned-vocab, force-dynamic) are all satisfied and well tested. No security issues: the only new data touch is the `camara` enum (non-PII); PII source-scan guard is intact; `Promise.all` frescura reads throw on real errors instead of fabricating empty state.

The findings below are correctness/robustness concerns, not invariant violations. The most material is a **timezone mismatch in the ISO week boundary** and an **unbounded-per-boletín truncation** that can make urgencia vigencia wrong. Two type/schema mismatches (`camara`, `enlace` treated as nullable when the DB column is `NOT NULL`) create dead defensive paths that the tests appear to "prove" but which production data can never exercise.

## Warnings

### WR-01: `inicioSemanaIso` computes the week boundary in server-local time, not Chile time

**File:** `app/components/actualidad-module.tsx:45-52` (consumed at `167-172`)
**Issue:** `inicioSemanaIso` uses `d.setHours(0,0,0,0)` and `d.getDay()` — both operate in the **server's local timezone**. The resulting `Date` is then serialized with `.toISOString()` (UTC) and compared with `.gte("fecha", …)` against `votacion.fecha`, which is a `timestamptz` (UTC) semantically representing Chilean legislative activity. Everywhere else in this codebase the week/day boundary is anchored to `America/Santiago` explicitly (e.g. `DIA_CALENDARIO_CHILE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" })` in `estado-actual-block.tsx`, cited as WR-04 in Phase 52). On the production runtime (UTC) `getDay()`/`setHours` yield the UTC Monday-00:00, which is Sunday 20:00 Chile — so votes cast late Sunday Chile time (or the Monday-boundary edge) are included/excluded incorrectly. "Votado esta semana" can silently show or drop boundary-day votes.
**Fix:** Anchor the week start to Chile time like the rest of the module. Derive the Chilean calendar day with the existing `America/Santiago` formatter, compute the Monday from that, and convert back to an instant. Minimal shape:
```ts
// Compute "now" as Chile-local Y/M/D, find Monday, emit the UTC instant for Chile 00:00.
const chileParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  weekday: "short",
}).formatToParts(hoy);
// …build the Chile-local Monday 00:00 and return its instant (reuse the DIA_CALENDARIO_CHILE idiom).
```
At minimum add a test that pins `inicioSemanaIso` under a fixed TZ so the boundary is asserted, not incidental.

### WR-02: `UrgenciasVigentes` truncates `tramitacion_evento` to 120 rows *before* grouping, so vigencia can be derived from an incomplete per-boletín history

**File:** `app/components/actualidad-module.tsx:269-297`
**Issue:** The query does `.ilike("descripcion","%urgencia%").order("fecha", desc).limit(120)`, then groups by boletín and feeds each group to `urgenciaVigente(evs)`. `urgenciaVigente` (estado-actual-block.tsx) walks the events **chronologically** and treats a later `retira urgencia` as cancelling an earlier `hace presente urgencia`. Because the 120-row cap is applied across *all* boletines by global recency, a given boletín's event set can be truncated mid-history: an older `hace presente` may survive while a still-older `retira` is dropped, or vice-versa. The derived "urgencia vigente" is then computed on a partial timeline and can be wrong (showing a retired urgencia as vigente, or dropping a real one). The `limit(120)` reads like a safety bound but silently corrupts the derivation instead of bounding it honestly.
**Fix:** Bound by *distinct boletín*, not by raw event count, or fetch the full event history for the candidate boletines before deriving vigencia. E.g. first select the recent distinct boletines with an urgencia mention, then fetch all `tramitacion_evento` rows for those boletines (unbounded per boletín) and only then run `urgenciaVigente`. If a hard cap is required, cap the number of boletines processed, never the intra-boletín event stream.

### WR-03: `total_si` / `total_no` rendered without validating they are non-negative integers matching the resultado

**File:** `app/components/actualidad-module.tsx:121-129, 191-206`
**Issue:** `conteoVotacion(it.totalSi, it.totalNo)` is rendered verbatim whenever `it.resultado` is truthy, but `total_si`/`total_no` are copied straight from the row (`totalSi: v.total_si`) with no coherence check against `resultado`. The DB defaults these to `0` (`0008_tramitacion.sql:45-46`), so a votación whose tallies were never populated but which has a non-null `resultado` string will render `El proyecto fue aprobado 0–0.` — a factually empty tally presented as a real count. That is exactly the kind of misleading-but-not-banned surface the module's honesty rules (#34 / anti-fabricación) try to avoid: a `0–0` tally implies "voted, unanimously nothing," which is not a fact. The fixtures (`totalSi:58,totalNo:81`) never exercise the `0–0` path, so tests give false confidence.
**Fix:** Suppress the tally (not the whole desenlace) when `total_si + total_no === 0`, rendering only `El proyecto fue {resultado}.` without a fabricated count. Alternatively guard: only show `conteoVotacion(...)` when `totalSi + totalNo > 0`. Add a fixture with `totalSi:0,totalNo:0,resultado:"aprobado"` asserting no `0–0` string appears.

## Info

### IN-01: `VotadoItem.camara` typed nullable but the DB column is `NOT NULL` — dead defensive branch

**File:** `app/components/actualidad-module.tsx:82, 104-113, 203` (schema: `supabase/migrations/0008_tramitacion.sql:49`)
**Issue:** `votacion.camara` is `text not null check (camara in ('diputados','senado'))` and `VotacionRow.camara` is typed `"diputados" | "senado"` (non-null). Yet `VotadoItem.camara` is `… | null`, the fetcher writes `camara: v.camara ?? null`, and the view branches on `it.camara &&` to omit the civic bar and switch the meta to `Votación del {fecha}`. Production data can never take the null branch, so the "omit bar honestly / `Votación del …` meta" path and the SUMMARY's claim that the bar is "omitted honestly when camara is absent" describe a code path unreachable from real data. Two of the view tests (`camara: null`) only pass because they inject a value the schema forbids.
**Fix:** Either narrow `VotadoItem.camara` to `"diputados" | "senado"` and delete the null branch, or (if a nullable future is intended) document that the null path is speculative and not backed by the schema. Do not let the SUMMARY imply a live data condition that the `NOT NULL` constraint precludes.

### IN-02: `enlace` treated as nullable but `votacion.enlace` is `NOT NULL` — the `<Link>` fallback branch is dead

**File:** `app/components/actualidad-module.tsx:79, 135-151, 202` (schema: `0008_tramitacion.sql:52`)
**Issue:** `votacion.enlace text not null` and `VotacionRow.enlace: string`. `VotadoItem.enlace` is `string | null` and the view falls back to an internal `<Link href={/proyecto/${boletin}}>` when `safeExternalHref(it.enlace)` returns null. Because `enlace` is always present, the fallback only fires if `safeExternalHref` rejects a malformed/non-http URL — a real but narrow case. The nullable typing is broader than the schema warrants.
**Fix:** Keep the `safeExternalHref` guard (that one is legitimate — it defends against non-http URLs), but tighten `VotadoItem.enlace` to `string` to reflect the schema, or add a comment noting the fallback exists only for the `safeExternalHref`-rejects-a-present-URL case, not for a null column.

### IN-03: Duplicated 6-item cap magic number and per-block boilerplate across the two fetchers

**File:** `app/components/actualidad-module.tsx:172, 301`
**Issue:** The `6`/`limit(6)`/`.slice(0,6)` cap is a bare magic number repeated in `VotadoEstaSemana` (`.limit(6)`) and `UrgenciasVigentes` (`.slice(0,6)`), and the `throw new Error("<Block>: no se pudo leer …")` + `?? []` + `leerTitulos` sequence is copy-pasted per block. Not a bug, but the intent ("show at most a handful") is untraceable and drift-prone.
**Fix:** Extract a named constant `const MAX_ITEMS_ACTUALIDAD = 6;` used by both, and consider a small helper for the `error → throw` + title-lookup pattern.

### IN-04: `page.test.tsx` imports `fireEvent` and `React` implicitly relied on but the SUMMARY-noted timezone flakiness pattern recurs in fixtures

**File:** `app/components/actualidad-module.test.tsx:33-45, 164-168`
**Issue:** The urgencia fixture uses `new Date("2026-07-01T00:00:00Z")` and the assertion was deliberately relaxed to `monos.some(t => t && t.length > 0)` (SUMMARY Deviation #2) precisely because `fechaCorta` renders in es-CL/Chile offset and "jul" flips to "jun". The relaxation means the test no longer asserts the *rendered date is correct* — only that some mono text exists — so a regression that formats the wrong date (or an empty date) would still pass. This is a test-reliability gap that hides exactly the TZ class of bug flagged in WR-01.
**Fix:** Pin the timezone in the test (e.g. `process.env.TZ = "America/Santiago"` in a setup file or `vi.stubEnv`) and assert the exact rendered short date, restoring a meaningful date assertion instead of the length>0 escape hatch.

## Fixes Applied

**Fixed at:** 2026-07-15T12:27:00Z
**Commit:** 56a8e57

### WR-01 — fixed
`inicioSemanaIso` ahora usa `Intl.DateTimeFormat("en-CA"/"en-US", { timeZone: "America/Santiago" })` para derivar día-de-semana y fecha calendario en Chile, luego calcula el instante UTC = "lunes 00:00:00 CLST". Mismo patrón que `DIA_CALENDARIO_CHILE` en `estado-actual-block.tsx`. Tests: 4 asserts que pinen la frontera UTC exacta incluyendo verificación de que el resultado sea medianoche en `America/Santiago`.

### WR-02 — fixed
`UrgenciasVigentes` reemplaza el `limit(120)` global por un esquema de dos pasos: (1) buscar hasta `MAX_URGENCIAS_BOLETIN=30` boletines candidatos deduplicados; (2) traer la historia **completa** (sin limit intra-boletín) de esos boletines con `.in("boletin", boletinesCandidatos)`. `urgenciaVigente()` recibe ahora la línea temporal completa. Segunda `.from()` a la misma tabla no-PII documentada como trade-off presentation-safe.

### WR-03 — fixed
Tally suprimido cuando `totalSi + totalNo === 0`: el JSX ahora envuelve `conteoVotacion(...)` en `{it.totalSi + it.totalNo > 0 && ...}`. El desenlace textual (`El proyecto fue {resultado}.`) sigue mostrándose. Test añadido: fixture `totalSi:0, totalNo:0, resultado:"aprobado"` aserta que la cadena `0–0` no aparece en ningún span ni en el DOM completo.

### IN-03 — fixed (trivially safe)
Constante `MAX_ITEMS_ACTUALIDAD = 6` extraída; reemplaza los dos `6` dispersos en `.limit(6)` y `.slice(0, 6)`.

---

_Reviewed: 2026-07-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
