---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - packages/tramitacion/src/connector-camara.ts
  - packages/tramitacion/src/connector-senado.ts
  - packages/tramitacion/src/reconciliar-camara.ts
  - packages/tramitacion/src/reconciliar-senado.ts
  - packages/tramitacion/src/parse-camara-votacion.ts
  - packages/tramitacion/src/parse-senado-votacion.ts
  - packages/tramitacion/src/timeline.ts
  - packages/tramitacion/src/writer-supabase.ts
  - packages/tramitacion/src/ingest-run.ts
  - supabase/migrations/0008_tramitacion.sql
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/voto-row.tsx
  - app/components/voto-detalle.tsx
  - app/components/provenance-badge.tsx
  - app/lib/supabase.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This slice ships the first citizen-facing legislative data path plus the identity-guard at
the public boundary. The five priority areas requested by the workflow were each traced:

- **Identity guard (existential risk #2):** SOLID. `voto-row.tsx` is the only render path that
  emits a `/parlamentario/` link, gated by `estado_vinculo === 'confirmado' && parlamentario_id != null`
  (belt-and-suspenders: even a `probable` row carrying an id will not link). `reconciliar-senado.ts`
  correctly maps the pipeline `probable` result to `parlamentario_id: null` and never leaks the
  `parlamentarioId` returned by `correrPipeline`. `reconciliar-camara.ts` is fail-closed on a missing
  DIPID. Tests cover the dangerous cases. No defect found here.
- **RLS (0008):** anon gets SELECT only on the 4 public tables; `parlamentario` (rut/email) stays
  deny-by-default; no insert/update/delete policy for anon. Correct. One hardening note below (IN-01).
- **Supabase client:** uses `SUPABASE_ANON_KEY` (no `NEXT_PUBLIC_` prefix), `server-only` import,
  no `service_role` anywhere in `app/`. Correct.
- **Connectors:** SSRF allowlist enforced via `assertAllowedUrl` before robots/rate-limit/fetch;
  deny-by-default with IP-literal + metadata coverage; fast-xml-parser does not resolve external
  entities (XXE not reachable). Provenance captured inline. Correct.
- **Trazabilidad sobre interpretación:** UI copy is descriptive, no causal framing.

Two CRITICAL data-integrity defects were found in the persistence layer (synthetic-id collision
and natural-key collision), both of which cause silent data loss OR a hard upsert error that aborts
a boletín. One real timeline ordering bug (Pitfall 3 regression) was also found.

## Critical Issues

### CR-01: Senado votación synthetic `id` collides for two votaciones on the same day → data loss / upsert abort

**File:** `packages/tramitacion/src/parse-senado-votacion.ts:105`
**Issue:** The votación id is built as `"senado:" + boletinKey + ":" + (fechaRaw ?? "")`. The Senate
routinely holds multiple nominal votaciones for the same boletín on the same calendar day (e.g.
votación en general + votación en particular, or several articles). All of them collapse to one
identical `id`. Consequences are both bad:
- Within a single upsert batch, Postgres raises `ON CONFLICT DO UPDATE command cannot affect row a
  second time`, aborting `upsertVotacion` for the whole boletín (the error is caught nowhere inside
  the loop — it propagates out of `runIngest`).
- Across batches/re-runs, one votación silently overwrites the other — the ficha shows a single
  votación where there were several, with whichever totals/votos were written last.

This is a correctness/data-loss defect on the primary citizen-facing artifact.
**Fix:** Make the id unique per votación. The source XML almost always carries a distinct
identifier or sequence; prefer it. If none exists, fold in a stable discriminator such as the
votación's `TEMA`/`TIPOVOTACION`/sequence index within the document:
```ts
// derive a stable per-votación sequence from the parsed list and include it:
const id = `senado:${boletinKey}:${fechaRaw ?? ""}:${seqOrTemaHash}`;
```
Whatever is chosen, two distinct `<votacion>` nodes must never produce the same `id`.

### CR-02: `voto` natural key `(votacion_id, mencion_nombre)` collides on duplicate/empty raw names → vote loss or upsert abort

**File:** `packages/tramitacion/src/writer-supabase.ts:66-77`, `supabase/migrations/0008_tramitacion.sql:65`, `packages/tramitacion/src/parse-camara-votacion.ts:209-216`
**Issue:** The upsert conflict target for `voto` is `(votacion_id, mencion_nombre)`, but
`mencion_nombre` is NOT a reliable discriminator of a voter:
- In `parseCamaraVotoDetalle`, `nombreCrudo` is assembled from optional name parts joined with
  spaces; if the source omits them it is the empty string `""`. Two diputados with empty/identical
  assembled names in the same votación produce the same `(votacion_id, "")` key — even though both
  carry a valid distinct `diputadoId`.
- Same risk for Senate homonyms whose raw `PARLAMENTARIO` strings match.

Effects mirror CR-01: a single upsert batch containing two rows with the same key raises
`ON CONFLICT DO UPDATE command cannot affect row a second time` (aborting `upsertVotos` for the
boletín); across re-runs one real vote silently overwrites another, undercounting the roll-call.
For the Cámara the natural key should have been the official identifier that the reconciliation
already keys on (`diputadoId`), not the display name.
**Fix:** Persist and key the vote on a non-colliding discriminator. For Cámara, store the
`diputado_id` (the cross key already used by `reconciliarVotosCamara`) and include it in the unique
constraint; for Senate, fall back to a sequence index within the votación. Minimum viable fix:
```sql
-- 0008: add the official id and key on it instead of the display name
alter table voto add column fuente_voter_id text; -- DIPID (Cámara) / null+seq (Senado)
-- unique (votacion_id, fuente_voter_id)   -- or (votacion_id, mencion_nombre, seq)
```
and de-duplicate each `votos` array before upsert as defense-in-depth so a batch can never carry
two rows with the same conflict key.

## Warnings

### WR-01: Timeline `dd/mm/yyyy` fallback is dead — `new Date()` mis-parses it as US `mm/dd` (Pitfall 3 regression)

**File:** `packages/tramitacion/src/timeline.ts:28-35`
**Issue:** `tiempo()` calls `new Date(fecha)` FIRST and only falls back to `parseFechaCL` when that
returns NaN. For a Chilean `dd/mm/yyyy` string such as `"03/06/2026"`, V8's `new Date("03/06/2026")`
does NOT return NaN — it parses it as March 6, 2026 (month/day swapped). So the `parseFechaCL`
fallback the comment promises ("tolerar dd/mm/yyyy por robustez") never executes, and any event that
reaches the timeline with a raw `dd/mm/yyyy` value is ordered on the wrong date. This is reachable:
when `parseFechaCL` fails upstream, the parsers fall back to the raw string
(`fecha = fechaDate ? toIso(fechaDate) : (fechaRaw ?? "")`, parse-senado-votacion:96), which then
flows into `Votacion.fecha → eventoDesdeVotacion → fusionarTimeline`. This is exactly the bug the
module claims to defend against.
**Fix:** Try the explicit Chilean parser before the permissive `new Date`:
```ts
function tiempo(fecha: string): number | null {
  if (!fecha) return null;
  const cl = parseFechaCL(fecha);          // dd/mm/yyyy AND iso, explicit
  if (cl) return cl.getTime();
  const d = new Date(fecha);               // last-resort
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}
```

### WR-02: `reconciliar-camara` indexes only `id_diputado_camara` but never validates the matched person's period/chamber

**File:** `packages/tramitacion/src/reconciliar-camara.ts:34-55`
**Issue:** The index maps every `id_diputado_camara` in the master to a `Parlamentario`, regardless
of period or chamber. The guard comment claims a DIPID "de un periodo anterior" stays unlinked, but
that only holds if such people are absent from `maestra`. If the master contains historical diputados
(or a DIPID is reused across periods), a vote could be linked to a person who was not the actual
voter in that votación — a false credible identity claim, the exact existential risk this phase
guards. The cross is "deterministic by official id," but the determinism depends entirely on the
master being scoped to the current period, which this function neither enforces nor documents as a
precondition it can rely on.
**Fix:** Either filter the master to the active chamber/period before indexing, or include the
period/chamber in the index key and confirm it matches the votación's chamber/date before linking.
Fail closed (leave `parlamentario_id = null`) when the DIPID resolves to a person outside the
votación's period.

### WR-03: `mapSeleccion` maps unknown selections to `'abstencion'`, fabricating a counted vote

**File:** `packages/tramitacion/src/parse-senado-votacion.ts:46-53`
**Issue:** Any `SELECCION` that is not si/no/abst/pareo is mapped to `'abstencion'`. The comment calls
this "conservador (no afirma un voto)", but `abstencion` IS an affirmative classification that is
displayed and counted in the per-voter roll call (`VotoRow` renders an "Abstención" badge). Compare
`parse-camara-votacion.ts`, which correctly returns `null` and OMITS the voto for non-nominal options.
A genuinely unknown/garbled source token therefore becomes a stated "Abstención" attributed to a named
person — interpretation presented as recorded fact.
**Fix:** Mirror the Cámara path: return a sentinel for unknown selections and drop the voto rather
than coercing it to `abstencion`. If the row's totals still need to balance, prefer omission over a
fabricated classification.

### WR-04: `intOf` silently coerces non-numeric/negative source totals to 0, hiding bad data

**File:** `packages/tramitacion/src/parse-camara-votacion.ts:40-44`, `packages/tramitacion/src/parse-senado-votacion.ts:35-39`
**Issue:** `intOf` returns `0` for anything non-finite and `Math.trunc`s the rest. A malformed or
unexpectedly-formatted total (e.g. `"1.234"` with a thousands separator → `Number("1.234")` = 1.234 →
truncated to 1, or a non-numeric token → 0) is silently turned into a wrong-but-valid count that the
schema (`int().nonnegative()`) happily accepts and the ficha displays as authoritative. There is no
signal that the source value was unparseable. For a transparency product, a silently-wrong vote total
is worse than a visible parse error.
**Fix:** Distinguish "absent" (→ 0 is fine) from "present but unparseable" (→ surface via the
`errores[]` channel that `runIngest` already collects, or refuse to persist that votación's totals).

### WR-05: Cámara per-voter votos are persisted but never rendered — silent feature gap / wasted writes

**File:** `app/components/votacion-card.tsx:76`, `packages/tramitacion/src/ingest-run.ts:177-193`
**Issue:** `VotacionCard` renders `VotoDetalle` only when `esSenado` is true. The pipeline
nevertheless reconciles and upserts the full Cámara voto-a-voto (`reconciliarVotosCamara` →
`upsertVotos`). The deterministic Cámara roll call — the strongest identity link in the system — is
written to the DB but never shown to citizens. Either the UI is missing a path or the ingest is doing
work that can never surface. This is a correctness/spec mismatch, not a style issue.
**Fix:** Confirm intent. If Cámara per-voter display is in scope, render `VotoDetalle` for both
chambers (the data is present in the `voto(*)` embed). If not, document why Cámara votos are persisted
but hidden.

## Info

### IN-01: RLS policy `using (true)` exposes every column of `voto`, including `metodo`/`estado_vinculo`

**File:** `supabase/migrations/0008_tramitacion.sql:100,107`
**Issue:** The anon SELECT policy on `voto` exposes all columns. `parlamentario_id`, `metodo`, and
`estado_vinculo` are not secrets and the UI uses them for the guard, so this is acceptable — but it
does leak the system's internal linkage confidence (`probable` vs `no_confirmado`) to the public,
which a scraper could misread as an assertion about a person. Low risk, worth a conscious decision.
**Fix:** If the linkage-confidence columns are not needed client-side beyond the boolean guard,
consider a view exposing only `(mencion_nombre, seleccion, parlamentario_id-when-confirmado)` and
granting anon SELECT on the view instead of the raw table.

### IN-02: `descubrirBoletines` swallows every per-session error with a bare empty catch

**File:** `packages/tramitacion/src/connector-camara.ts:107-109`
**Issue:** The `catch {}` discards all errors per session "best-effort." A robots-disallow, an SSRF
rejection, or a systemic 500 is indistinguishable from "session has no detail," so a fully broken
discovery silently returns `[]`. Diagnosability suffers.
**Fix:** Accept a `log` sink (as `runIngest` already has) and emit the swallowed error message, or
collect them into a returned diagnostics array. Do not discard silently.

### IN-03: `voto` embed select uses `select("*, voto(*)")` — pulls columns the client never needs

**File:** `app/app/proyecto/[boletin]/page.tsx:88`
**Issue:** `voto(*)` selects all voto columns including `metodo`. The client only needs
`mencion_nombre, seleccion, parlamentario_id, estado_vinculo`. Tightening the projection reduces the
surface described in IN-01 and the payload.
**Fix:** Enumerate the needed columns: `select("*, voto(mencion_nombre,seleccion,parlamentario_id,estado_vinculo)")`.

### IN-04: `TimelineSection` orders by DB `fecha` ascending, bypassing `fusionarTimeline`'s stable cross-chamber tie-break

**File:** `app/app/proyecto/[boletin]/page.tsx:74-80`
**Issue:** The page reads `tramitacion_evento` and orders by `fecha` ascending in SQL, but the
materialization-time ordering rules in `timeline.ts` (same-date → Cámara before Senado; null dates
last in insertion order) are not reproduced by a plain SQL `order by fecha`. Rows with equal dates,
or null dates, may render in a non-deterministic / different order than the timeline contract
specifies. Cosmetic but inconsistent with the documented spec.
**Fix:** Either persist a monotonic `orden` column computed by `fusionarTimeline` and order by it, or
add the same tie-break (`camara` rank, then a stable secondary key) to the query.

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
