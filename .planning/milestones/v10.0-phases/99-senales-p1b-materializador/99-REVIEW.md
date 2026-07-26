---
phase: 99-senales-p1b-materializador
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - supabase/migrations/0065_actualidad_senal.sql
  - supabase/migrations/0066_actualidad_rpc.sql
  - packages/actualidad/src/kmeans.ts
  - packages/actualidad/src/run-actualidad-prod-cli.ts
  - app/lib/lockdown-guard.test.ts
  - .github/workflows/actualidad-refresh.yml
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 99: Code Review Report

**Reviewed:** 2026-07-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 99 materializes precomputed "actualidad" signals for the landing panel via a
SECURITY DEFINER SQL proc (0065), a bounded read RPC (0066), a deterministic k-means
CLI (`packages/actualidad`), and an intraday GH Actions cron. The security envelope is
strong and consistent with the project's LOCKED patterns: deny-by-default table,
double-revoke + zero-grant on the RPC, `search_path=''`, `statement_timeout=5s`,
parametric input (no injection surface), no-PII join, allowlist enrollment, deterministic
mulberry32 seed, factual `mode(materia)` labels (no LLM text), env-only credentials, and
an injection-safe workflow with SHA-pinned actions and minimal permissions.

However, the review found a cluster of **data-honesty contract violations** in the
temporal aggregations of 0065 that directly contradict the phase's own LOCKED contract
("SUPRESIÓN = FILA con supresion_causa; nunca 0-como-hecho"). Three of the six temporal
signals (`nuevos_ingresos`, `urgencias`, `archivados`) can emit a `conteo=0` row with
NULL `supresion_causa` — a "0-as-fact" row the contract explicitly prohibits — and one
signal's `ventana` label materially misrepresents its actual window. These are the
project-critical honesty failures the panel exists to prevent, so they are surfaced as
WARNINGs bordering on blockers.

No Critical (BLOCKER) security defects were found. The security-focus checklist items 1-5
all pass on inspection.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `nuevos_ingresos`, `urgencias`, `archivados` emit a "0-as-fact" row on empty/stale source

**File:** `supabase/migrations/0065_actualidad_senal.sql:138-149` (nuevos_ingresos), `154-161` (urgencias), `219-228` (archivados)
**Issue:** These three inserts use an ungrouped `select 'x', ..., count(*), ...` with no
`GROUP BY`. When the underlying filter matches zero events, SQL still returns **one row**
with `conteo = 0`, `fecha_max = NULL`, and `supresion_causa = NULL`. Per the LOCKED
contract (file header §"SUPRESIÓN", lines 29-30): *"SUPRESIÓN = FILA con `supresion_causa`
(ausencia ≠ hecho). Nunca fila faltante, nunca 0-como-hecho."* A `conteo=0` row with a NULL
`supresion_causa` is exactly the prohibited "0-como-hecho": it asserts "0 nuevos ingresos"
as a positive fact rather than declaring the absence/staleness with a cause. `velocity` and
`agenda_citacion`/`agenda_sala` correctly gate on freshness and emit a suppression row; these
three do not. A stale tramitación source (the very scenario `velocity` guards against with
`c_umbral_stale_dias`) will produce silent `conteo=0` panel rows for these three signals.
**Fix:** Gate each of these three on `v_tram_max` freshness exactly like `velocity`, and in
the else branch emit a suppression row; additionally guard against the zero-count case
(e.g. `having count(*) > 0` on a grouped form, or wrap in an `if exists(...)` and emit a
suppression row otherwise). Illustrative:
```sql
if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias then
  insert into public.actualidad_senal (...)
  select 'urgencias', '30d', count(*), ... from public.tramitacion_evento
   where tipo = 'urgencia' and fecha <= current_date
     and fecha >= current_date - interval '30 days'
  having count(*) > 0;
  if not found then
    insert into public.actualidad_senal (tipo_senal, ventana, conteo, supresion_causa, ...)
    values ('urgencias', '30d', 0, 'sin urgencias fechadas en la ventana', ...);
  end if;
else
  insert into ... values ('urgencias', '30d', 0, v_tram_max, 'sin datos frescos de esta fuente', ...);
end if;
```
Note: the pgTAP suite (12/12) does not catch this because its seed always contains a
recent velocity event, so the tramitación source is never stale and `urgencias`/`archivados`
happen to be empty-but-source-fresh — the test asserts D3 only for `agenda_sala`.

### WR-02: `nuevos_ingresos` `ventana` label misrepresents the actual window (4-year corpus vs 7-day count)

**File:** `supabase/migrations/0065_actualidad_senal.sql:140,147-148`
**Issue:** The row is inserted with `ventana = '2022-2026'`, but the `HAVING` clause
restricts to `min(fecha) >= current_date - interval '7 days'` (line 148). The signal is
actually a **7-day count of new boletín ingresos**, not a "2022-2026 corpus" figure. The
`'2022-2026'` label describes the pre-2022 exclusion floor (line 147), not the reporting
window, so a panel reading `ventana` will mislabel a 7-day count as a 4-year total. This is
a data-honesty/traceability defect (the panel's core value is "qué pasó, cuándo") and it is
inconsistent with the other temporal signals whose `ventana` (`'7d'`, `'30d'`) matches the
actual interval.
**Fix:** Set `ventana = '7d'` (the true reporting window) and move the "2022-2026 corpus
floor" note into a provenance/evidence field or the comment, e.g.:
```sql
select 'nuevos_ingresos', '7d', count(*), '2022-2026 (piso de corpus)', max(pe.primer), ...
```
so `ventana` states the window and `cobertura_camara`/evidencia carries the corpus caveat.

### WR-03: Hardcoded stale threshold can drift silently from its TS origin AND measures a different column than catalog.ts

**File:** `supabase/migrations/0065_actualidad_senal.sql:34-38, 89-92`
**Issue:** `c_umbral_stale_dias constant int := 7` is a hand-copied duplicate of
`packages/freshness/src/catalog.ts` (`leyes`/`agenda` → `umbralDias: 7`). Verified against
catalog.ts: both are indeed 7 today, so the value is currently correct. Two risks remain:
(1) **silent drift** — nothing links the two; if a maintainer changes `umbralDias` in
catalog.ts, this constant will not update and no test fails (the pgTAP seed hardcodes its
own staleness, it does not read catalog.ts). (2) **semantic divergence** — catalog.ts
measures staleness against `MAX(fecha_captura)` (comment lines 8-9 of catalog.ts), while this
proc measures against `MAX(tramitacion_evento.fecha)` / `MAX(citacion.fecha)` (the event date,
per the "regla del reloj"). The divergence is defensible (fecha_captura is the "lying clock")
but it means the "7 = catalog.ts umbralDias" provenance claim in the comment is only half true:
the number matches, the measured column does not. A reader trusting the comment will assume
parity that does not exist.
**Fix:** (a) Add a lightweight guard test asserting `catalog.ts` `leyes`/`agenda`
`umbralDias === 7` so a divergence trips CI (documents the coupling the comment claims). (b)
Tighten the comment to state explicitly that only the *day count* is shared with catalog.ts,
while the *measured column* is `tramitacion_evento.fecha` (event date) by design, not
`fecha_captura`.

### WR-04: RPC `order by ... cobertura_camara` is a cross-cámara ORDER BY (anti-ranking edge)

**File:** `supabase/migrations/0066_actualidad_rpc.sql:51`
**Issue:** The RPC orders by `s.tipo_senal, s.cobertura_camara nulls last, s.cluster_id
nulls last`. This is an alphabetical stable ordering (not `order by conteo`), so it does NOT
violate the anti-ranking rule literally (T-52-13 prohibits *order-by-conteo* cross-cámara).
Flagged as a low-severity WARNING because the ordering still interleaves cámara buckets in a
fixed alphabetical sequence that the frontend could naively render as a ranked list, and the
`LIMIT 200` (line 52) sits on top of this ORDER BY: if the precomputed table ever exceeds 200
rows, the limit will silently truncate whichever cámara/tipo sorts last (`(sin cámara)`,
`Senado`), producing a coverage bias the panel cannot see. Today the table is tiny so the
limit is unreachable, but the combination (`order by label` + `limit`) is a latent
truncation-bias risk.
**Fix:** Confirm the frontend never treats `cobertura_camara` order as ranking (render as
unordered buckets), and either raise/remove the `LIMIT` for this bounded precomputed table or
document why 200 is a safe ceiling for the row count (currently ~7 tipos × few cámaras +
clusters ≪ 200 — safe, but undocumented).

### WR-05: `agenda_citacion` freshness gate can suppress a real future citación (stale-capture false negative)

**File:** `supabase/migrations/0065_actualidad_senal.sql:167-189`
**Issue:** `agenda_citacion` positive rows are gated on `v_cita_max >= current_date -
c_umbral_stale_dias`, where `v_cita_max = max(citacion.fecha <= current_date)` — the max
**past** citación date. If the source is not re-ingested for >7 days but the DB already holds
a genuinely future citación (e.g. a session scheduled 3 weeks out, ingested 10 days ago), the
gate evaluates `v_cita_max` (a past date now >7 days old) as stale and jumps to the else
branch (line 184-188), emitting a suppression row and **discarding the real future citación**
that exists in the table. The "coming up" fact is suppressed because the *most recent past*
citación is old, conflating "source not refreshed" with "no upcoming events" — the exact
absence≠hecho confusion the contract warns against, inverted.
**Fix:** Base the freshness/emptiness decision on the presence of future rows, not on
`max(past)`. Emit positive rows whenever future citaciones exist; only emit the "stale source"
suppression when there are neither future rows nor a recent capture. Reorder so the
`if exists (future)` check dominates the `v_cita_max` staleness check.

## Info

### IN-01: `SUPABASE_URL` is loaded into env map but never used as a fallback consistently

**File:** `packages/actualidad/src/run-actualidad-prod-cli.ts:49, 149`
**Issue:** `loadEnv` copies `SUPABASE_URL` into the map, and line 149 falls back
`SUPABASE_API_URL || SUPABASE_URL`. Harmless, but `SUPABASE_URL` is not passed by the
workflow (`actualidad-refresh.yml` only sets `SUPABASE_API_URL`), so the fallback is dead in
CI. Minor: keep for local dev or drop for clarity.
**Fix:** Leave as-is (local-dev convenience) or document that CI only sets `SUPABASE_API_URL`.

### IN-02: `agenda_sala` else branch emits row even when the table is entirely empty (no rows at all)

**File:** `supabase/migrations/0065_actualidad_senal.sql:204-212`
**Issue:** When `sesion_sala` has zero future rows, the else branch inserts a suppression row
with `fecha_max = (select max(fecha) ... where fecha <= current_date)`. If the table is
completely empty, that subselect is NULL — which is fine and correct (suppression with NULL
fecha_max). Noted only to confirm this path is intentional and does not throw. No fix needed;
behavior is contract-correct (suppression-as-row).
**Fix:** None required. Confirmed correct.

### IN-03: `clampK` silently coerces non-integer/negative `--k` to `DEFAULT_K` without logging the reason

**File:** `packages/actualidad/src/run-actualidad-prod-cli.ts:129-139`
**Issue:** When `--k` is non-integer or `<= 0`, `k` resets to `DEFAULT_K` (line 131) before
the range clamp. The `log` on line 135 only fires when the *final* effective value differs
from the (already-reset) `k`, so an operator passing `--k abc` sees no explicit "ignored
invalid input" message unless the reset value also gets clamped. Minor observability gap.
**Fix:** Log the raw-vs-parsed coercion explicitly when `raw != null && (!Number.isInteger(k)
|| k <= 0)`.

### IN-04: k-means convergence break requires `iter > 0`, forcing a redundant re-center on trivially-converged input

**File:** `packages/actualidad/src/kmeans.ts:155`
**Issue:** `if (!changed && iter > 0) break;` — on the first iteration `changed` is always
true (assignments start at -1), so the `iter > 0` guard is defensive but never load-bearing;
it does mean a dataset that converges immediately still runs one extra recenter pass. No
correctness impact (determinism preserved). Cosmetic.
**Fix:** None required; the guard is harmless. Could simplify to `if (!changed) break;` since
iteration 0 can never be unchanged, but leave for safety.

---

## Security checklist verification (all pass)

1. **RPC 0066 aguja completa** — SECURITY DEFINER ✓ (L43), `search_path=''` ✓ (L44),
   `statement_timeout='5s'` ✓ (L45), explicit `LIMIT 200` ✓ (L52), double-revoke from
   `public` (L55) AND `anon, authenticated` (L56) ✓, zero-grant ✓, no PII join (reads only
   `actualidad_senal`, re-emits counts/labels/dates/evidencia) ✓, enrolled in
   `PUBLIC_RPC_ALLOWLIST` ✓ (lockdown-guard.test.ts L166), parametric input (no injection) ✓
   (L50). The lockdown guard Direction-B (A2) will also verify the definition exists in a
   migration — `create or replace function public.actualidad_senales_panel` matches
   `RPC_DEF_REGEX` ✓.
2. **Proc 0065 DELETE scoping** — DELETE restricted to the six temporal `tipo_senal` values
   (L100-102), never global, never touching `agrupacion_materia` (owned by the CLI) ✓. D1
   (`fecha <= current_date`) applied in every aggregation ✓. D2 (`regexp_replace(camara,
   '\s+','','g')`) applied in velocity/agenda ✓. D3 (`coalesce(nullif(...),'(sin cámara)')`,
   never redistributed) ✓. Signals anchored to `tramitacion_evento.fecha`/`citacion.fecha`,
   never `fecha_captura` ✓. Suppression-as-row present for velocity/agenda (WR-01 notes it is
   MISSING for the other three).
3. **kmeans.ts determinism** — fixed `KMEANS_SEED` mulberry32 ✓ (L20, L130), same input →
   same output (no `Math.random`) ✓, label = `mode(materia)` with deterministic alpha
   tie-break, never generated text ✓ (L193-215), `k` clamped to `[1, min(k,N)]` for small N ✓
   (L128).
4. **CLI** — service_role creds env-only, never printed/logged ✓ (creds read from env map,
   only `KMEANS_SEED`/counts logged), PostgREST 1k pagination via `.order().range()` ✓
   (L103-124), no source scraping (Supabase-only) ✓.
5. **YAML** — no R2 vars ✓, inputs via `K` ENV not shell interpolation ✓ (L60-63),
   SHA-pinned actions ✓ (L37,40,43), minimal `permissions: contents: read` ✓.

**Anti-ranking:** No `order by conteo` cross-cámara found in either migration (WR-04 notes the
label-ORDER-BY + LIMIT truncation edge). **Hardcoded stale threshold:** flagged in WR-03.

---

_Reviewed: 2026-07-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
