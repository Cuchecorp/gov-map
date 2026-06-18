---
phase: 06-citaciones-tabla-semanal-de-sala
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/agenda/src/connector-camara.ts
  - packages/agenda/src/connector-senado.ts
  - packages/agenda/src/headers-camara.ts
  - packages/agenda/src/ingest-run.ts
  - packages/agenda/src/writer-supabase.ts
  - packages/agenda/src/parse-camara-citaciones.ts
  - packages/agenda/src/parse-senado-citaciones.ts
  - packages/agenda/src/parse-senado-tabla.ts
  - supabase/migrations/0010_agenda.sql
  - app/app/agenda/page.tsx
  - app/components/citacion-card.tsx
  - app/components/sala-table-section.tsx
  - app/lib/week-utils.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: fixed
fixed_at: 2026-06-18T00:00:00Z
fixed:
  critical: 2   # CR-01, CR-02
  warning: 6    # WR-01..WR-06
  info: 2       # IN-01, IN-02, IN-03 (IN-04 deferred)
deferred:
  info: 1       # IN-04 (smoke test for fetchVia_NextData fallback)
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** fixed (see Resolution below)

> **RESOLUTION (2026-06-18):** All 2 Blockers + 6 Warnings fixed, plus IN-01/IN-02/IN-03.
> Idempotency keys made order-independent and content-derived (WR-01/WR-02, with
> reorder + same-slot-distinct tests). Per-week Cámara 403 isolation (WR-04). Frontend
> single-sources the canonical TABLASEMANAL PDF URL and scopes the degraded state to
> Cámara (CR-01/CR-02). **WR-03 RESOLVED LIVE:** a curl-subprocess transport injected
> behind the Fetcher interface fetched Cámara over the real network — 2026-W25 → HTTP 200
> (237 KB) → 40 citaciones, 2026-W26 → HTTP 200 (143 KB) → 21 citaciones (NOT fixture/
> fallback, NOT a CF challenge). A full live ingest into local Supabase loaded
> Cámara=61 / Senado=27 / 4 sesiones with 0 errors; a re-ingest left the scoped row count
> unchanged (121 → 121) confirming idempotency. Gates: `@obs/agenda` 99 tests pass,
> `tsc -b` clean, `app` build OK. No migration touched (supabase test db N/A).
> **Deferred:** IN-04 (smoke test for the unused `fetchVia_NextData` Senado fallback).

## Summary

Reviewed the agenda slice (citaciones + tabla de sala) across the ingest backend
(`@obs/agenda`), the migration, and the `/agenda` frontend. The identity/privacy
boundary is handled correctly — invitados render as plain text with no IdentityMarker
and no `/parlamentario/` link, and the schema/migration deliberately omit any
`parlamentario_id`. RLS in migration 0010 is correctly scoped (anon read on the 5
agenda tables only; `parlamentario` left deny-by-default). The ISO-week arithmetic and
the `?semana` param fallback are sound and injection-safe.

The two blocking issues are both in the **honest-degradation contract**, which is a
named existential-risk surface for this phase:

1. The "official PDF link" the ingest layer carefully threads through (`CAMARA_TABLA_PDF_URL`)
   is **never surfaced** — the frontend hardcodes a *different, non-PDF* URL and ignores the
   ingest-provided enlace. The degradation is honest in the DB but the user-facing link is
   disconnected from the source-of-truth.
2. `SalaTableServer` renders the "no disponible" degraded block **unconditionally**, even
   when the Senado table IS available — producing a card whose copy ("El organismo no ha
   publicado el orden del día...") directly contradicts the structured table rendered
   immediately above it.

Several idempotency edge cases in the synthetic-key construction can collapse or swap
distinct citaciones on re-ingest. The known Cloudflare/Deno-fetch 403 transport issue is
documented below as a finding.

## Critical Issues

### CR-01: Honest-degradation link is disconnected from source of truth (wrong URL shown, ingest PDF link dead)

**File:** `app/components/sala-table-section.tsx:43-46`, `app/app/agenda/page.tsx:212-214`, `packages/agenda/src/ingest-run.ts:174-180`
**Issue:**
The ingest layer treats `CAMARA_TABLA_PDF_URL` (`https://www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL`, connector-camara.ts:62-63) as the canonical "official PDF" artifact for the Cámara degradation, recording it as `degradaciones[].enlace`. But this enlace never reaches the UI:

- `SalaTableServer` (page.tsx:214) renders `<SalaTableSection mode="degraded" weekLabel={weekLabel} />` with **no link prop**.
- `SalaTableSection` hardcodes its own URLs (sala-table-section.tsx:44-46): `CAMARA_TABLA_PDF = "https://www.camara.cl/trabajamos/sala_sesion.aspx"` — a generic sessions page, **not the TABLASEMANAL PDF**, and the constant name (`..._PDF`) lies about what it points to.

For a phase whose explicit goal (TRAM-08) is "degrade to the official PDF link," the user is given a different, weaker link than the one the system actually validated/recorded, and the ingest-recorded enlace is dead code. This breaks the trazabilidad-a-la-fuente core value (every datum must link to its actual source).
**Fix:**
Thread the real artifact URL from the data layer into the component, and stop hardcoding a divergent URL:
```tsx
// sala-table-section.tsx — accept the link instead of hardcoding a wrong one
type DegradedProps = { weekLabel?: string; camaraPdfUrl: string; senadoUrl?: string };

// page.tsx — pass the ingest-recorded artifact (export it for the app, or read from a
// degradaciones row) so UI and ingest agree:
<SalaTableSection mode="degraded" weekLabel={weekLabel} camaraPdfUrl={CAMARA_TABLA_PDF_URL} />
```
Also rename/repoint the constant so it actually is the TABLASEMANAL PDF, or relabel the link text to match what it really opens.

### CR-02: Degraded "no disponible" block renders even when the Senado table is available — contradictory UI

**File:** `app/app/agenda/page.tsx:202-216`, `app/components/sala-table-section.tsx:125-160`
**Issue:**
`SalaTableServer` always emits the degraded section, regardless of Senado availability:
```tsx
{items.length > 0 && provenance && (<SalaTableSection mode="available" .../>)}
{/* always */}
<SalaTableSection mode="degraded" weekLabel={weekLabel} />
```
When the Senado has rows, the page shows the structured table AND, directly below it, the
`DegradedState` card whose copy reads "Tabla de sala no disponible / El organismo no ha
publicado el orden del día de sala para {semana}, o la fuente no pudo obtenerse de forma
confiable." That statement is false in that case — the Senado order-of-day was just
rendered above. The `DegradedState` is also not Cámara-scoped: its heading and body make a
blanket "not available" claim and link to BOTH Cámara and Senado, so it reads as if the
whole sala section failed. This is dishonest degradation in the opposite direction
(asserting "no data" while showing data), undermining the same trust contract CR-01 touches.
**Fix:**
Make the always-on block explicitly Cámara-scoped (it is the one chamber that has no
structured source), and make its copy say so rather than a generic "no disponible":
```tsx
// Degraded block must name Cámara and not claim the Senado failed:
<SalaTableSection mode="degraded" scope="camara" weekLabel={weekLabel} camaraPdfUrl={...} />
// DegradedState copy: "La Cámara no publica la tabla de sala como dato estructurado —
// consúltala en el PDF oficial." (no blanket 'no disponible', no Senado-failed implication)
```
Only fall back to the generic empty-state when the Senado genuinely returned 0 rows.

## Warnings

### WR-01: Cámara synthetic citacion id is order-dependent → re-ingest can swap/duplicate distinct citaciones

**File:** `packages/agenda/src/parse-camara-citaciones.ts:185-190`
**Issue:**
The natural key is `camara:{semana}:{comision}:{fecha}:{horario}`. Two genuinely distinct
citaciones that share comisión + fecha + horario (e.g. a comisión meeting twice the same
slot, or a subcomisión with an identical label) are disambiguated only by append order:
the first gets the base id, the second gets `#2`. This `#n` suffix is assigned from a
per-page `idsUsados` set, so it depends on the row order in the fetched HTML. If the source
reorders those two rows between runs, the base id and `#2` swap between the two citaciones —
the upsert (onConflict `id`) then overwrites each row with the *other* citación's data.
Idempotency is only preserved while source ordering is stable, which is not guaranteed.
**Fix:**
Incorporate a content-derived discriminator into the key instead of positional `#n` — e.g.
hash the materia/sala or include `sala` and a short materia hash so the key is stable under
reordering:
```ts
const disc = sala ? `:${sala}` : "";
let id = `camara:${semanaIso}:${comision}:${fecha}:${horario}${disc}`;
// if still colliding, append a stable hash of the materia, not an order-based #n
```

### WR-02: Senado fallback id (no ID_CITACION) silently collapses distinct citaciones

**File:** `packages/agenda/src/parse-senado-citaciones.ts:98-101`, `packages/agenda/src/writer-supabase.ts:43-47,76`
**Issue:**
When `ID_CITACION` is null/empty, the id falls back to
`senado:citacion:{comision}:{fecha}:{horario}`. `dedupePorClave` in the writer is
last-write-wins by id, so two distinct same-slot citaciones with no ID_CITACION are merged
into one — one is silently dropped (data loss). Unlike Cámara (WR-01) there is no `#n`
escape here at all, so the collapse is guaranteed, not just order-dependent.
**Fix:**
Add a discriminator (materia hash, or LUGAR) to the fallback key so distinct citaciones
remain distinct; or count/log collisions so silent drops are observable instead of invisible.

### WR-03: Known Cloudflare transport defect — Deno-fetch gets 403 where curl/browser passes; production Cámara ingest will fully degrade

**File:** `packages/agenda/src/connector-camara.ts:85-101`, `packages/agenda/src/headers-camara.ts:14-29`
**Issue:**
The header-set is correct in shape, but the documented LIVE reality (06-CONTEXT, and called
out in this review request) is that the Deno-`fetch` transport still receives HTTP 403 from
Cloudflare while curl/curl-impersonate passes the same headers. Headers alone do not defeat
CF's TLS/JA3 + HTTP/2 fingerprinting. With the current transport, every Cámara week will hit
`CamaraBloqueadaError` on the first slice, `camaraDegradada` flips true, and the loop
`break`s (ingest-run.ts:93) — so in production the entire Cámara citaciones source yields
0 rows every run. The code degrades honestly (good), but the feature is effectively
non-functional for Cámara until the transport changes.
**Fix:**
Production Cámara ingest needs a CF-passing transport (curl-impersonate / browseros /
headless), injected behind the existing `Fetcher` interface so the connector is unchanged.
Document this explicitly as a known limitation and gate any "Cámara citaciones live" claim
on it. Until then, expect Cámara citaciones to be permanently degraded.

### WR-04: `camaraDegradada` aborts ALL remaining Cámara weeks on a single persistent 403, not just the failing week

**File:** `packages/agenda/src/ingest-run.ts:91-93,114`
**Issue:**
A single week reaching a persistent 403 sets `camaraDegradada = true`, and the next loop
iteration does `if (camaraDegradada) break;`. This is intentional ("don't insist the rest of
the corrida") and correctly does NOT abort the Senado — that requirement is met. But it means
one transient-but-retry-exhausted 403 on, say, week 1 discards weeks 2..N for the whole run
even if CF would have served them. Combined with WR-03 this guarantees near-total Cámara loss.
The degradación is also recorded with the *first* failing `clave` only; the report doesn't
convey that the remaining weeks were skipped, not fetched-and-empty.
**Fix:**
Consider continuing to subsequent weeks (or a bounded number) rather than aborting the whole
source on the first persistent 403, and record in the degradación which weeks were skipped vs
attempted, so the report distinguishes "blocked" from "no data."

### WR-05: Senado tabla-de-sala read is not constrained to the navigated week beyond a date range; forward-only window can show stale/over-broad rows

**File:** `app/app/agenda/page.tsx:162-200`, `packages/agenda/src/connector-senado.ts:60-62`
**Issue:**
`fetchTablaSala(limit=100)` pulls a forward-only window with no week parameter; the DB
accumulates whatever each run returned. `SalaTableServer` filters by `fecha` in
[Monday, Sunday] of the selected week — correct for the current week, but for any past week
the `weekly_table` window may never have contained those sessions (forward-only), so past
weeks silently show the empty/degraded state with no signal that data was never captured (vs
genuinely none). Not incorrect, but the UI can't distinguish "never ingested" from "no
session." Worth surfacing so users navigating to a past week aren't misled.
**Fix:**
Either constrain/label the available range (only weeks within the captured window can show
data) or add provenance/`fecha_captura`-based messaging distinguishing "fuera de la ventana
capturada" from "sin sesión."

### WR-06: `endOfDay`/range filter relies on `fecha` being stored at UTC midnight; a non-midnight timestamptz at the week boundary can be excluded

**File:** `app/app/agenda/page.tsx:163-171,219-224`, `packages/agenda/src/parse-senado-tabla.ts:52-63`
**Issue:**
`parseFechaLargaEs` returns a bare `YYYY-MM-DD`, persisted into `timestamptz` → midnight UTC.
The range query uses `gte start.toISOString()` (Monday 00:00:00Z) and `lte endOfDay(end)`
(Sunday 23:59:59.999Z). This is correct *only* while every `sesion_sala.fecha` is exactly UTC
midnight. If any ingest path ever writes a non-midnight or non-UTC `fecha` (e.g. a future
source providing a time, or DB session TZ ≠ UTC), a Sunday-evening session could fall outside
the `lte` boundary and silently drop from the week. The coupling between parser output and the
boundary math is implicit and fragile.
**Fix:**
Filter on a date expression rather than a timestamp range (e.g. compare `fecha::date` to the
week's date bounds), or normalize/assert UTC-midnight storage so the boundary math is robust
to time-bearing values.

## Info

### IN-01: `SalaTableSection` available-mode key uses `item.posicion`, which is not unique across multiple Senado sessions in one week

**File:** `app/app/agenda/page.tsx:176-200`, `app/components/sala-table-section.tsx:85-87`
**Issue:**
`SalaTableServer` flattens items from ALL Senado sessions of the week into one `items[]`, but
the table renders `key={item.posicion}`. Two sessions each have positions 1,2,3… → duplicate
React keys, which can cause reconciliation glitches and a dev warning. The DB unique key is
(sesion_id, posicion), not posicion alone.
**Fix:** Use a composite key, e.g. `key={`${sesionId}:${item.posicion}`}` (carry sesion id into `SalaTablaItem`).

### IN-02: `etapa` is just a duplicate of `parteSesion` — redundant field and a likely semantic mismatch

**File:** `app/app/agenda/page.tsx:192-199`, `app/components/sala-table-section.tsx:21-27,109-115`
**Issue:**
The mapping sets both `parteSesion: it.parte_sesion` and `etapa: it.parte_sesion` (same value),
then the table renders `etapa` through `<EtapaBadge>`. `parte_sesion` ("ORDEN DEL DÍA" /
"TIEMPO DE VOTACIONES") is a session-part label, not a tramitación etapa; feeding it to an
EtapaBadge likely mislabels it. `parteSesion` is otherwise unused in the component.
**Fix:** Drop the duplicate `etapa` field, or map a genuine etapa value; render `parte_sesion` with a neutral label rather than an EtapaBadge if it isn't an etapa.

### IN-03: `materia` line-clamp + `<details>` shows the text twice when expanded

**File:** `app/components/citacion-card.tsx:75-87`
**Issue:**
The `<p className="line-clamp-3">{materia}</p>` always renders; when `materia.length > 220`
the `<details>` adds the full `{materia}` again. Expanding shows the (clamped) paragraph plus
a full duplicate below it. Cosmetic, not a correctness bug.
**Fix:** Hide/replace the clamped paragraph when the details is open, or render only one source of the materia text.

### IN-04: `fetchVia_NextData` is documented fallback but unused/untested in the default path; risk of bit-rot

**File:** `packages/agenda/src/connector-senado.ts:64-73`
**Issue:**
`fetchVia_NextData` is never invoked by `runIngest` (the default uses the API). It's a
deliberately-retained fallback, but as written it has no caller and no exercised code path, so
the `buildId` auto-detection it documents lives only in a comment. If the API backend ever
falls and this is reached for the first time in an incident, it will be unverified.
**Fix:** Add a smoke test (even mocked) for the fallback path, or mark it clearly experimental so an operator doesn't assume it's battle-tested.

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
