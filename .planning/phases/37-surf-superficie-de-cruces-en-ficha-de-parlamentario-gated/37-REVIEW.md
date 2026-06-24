---
phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated
reviewed: 2026-06-24T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - app/lib/cruces-gate.ts
  - app/lib/cruces-gate.test.ts
  - app/lib/types.ts
  - app/components/cruces-de-parlamentario.tsx
  - app/components/cruces-de-parlamentario.test.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/parlamentario/[id]/page.test.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: resolved
resolution:
  WR-01: fixed (commit 5156b17 — unique evidence keys incl. array index + regression test; FND-08)
  WR-02: deferred-documented (commit 5156b17 — code comment; proper fix = project cruce_senal.fecha_captura in RPC 0040, DDL, out of Phase 37 CERO-DDL scope; resolve before Phase 39 enables the gated-OFF surface)
  IN-01/IN-02: acknowledged non-blocking (unused pure-view `id` prop; untested neutral-wording on unknown tipo_senal path)
---

# Phase 37: Code Review Report

**Reviewed:** 2026-06-24
**Depth:** deep (cross-file: gate ↔ page ↔ component ↔ RPC/materializer contract)
**Files Reviewed:** 6 (+2 reference analogs, +2 migrations as read-only contract)
**Status:** issues_found

## Summary

Phase 37 is a build-only, gated-OFF mirror of the shipped lobby/money patterns. Verdict on the six LOCKED constraints: **all six hold.**

1. **Gate fail-closed + server-only** — PASS. `crucesPublicEnabled` is `env.CRUCES_PUBLIC_ENABLED === "true"` with `import "server-only"` on line 1; truth table test covers `undefined`/`"false"`/`"1"`/`"TRUE"`/`"true"`.
2. **Gate OFF ⇒ `<section id="cruces">` absent** — PASS. The gate wraps the entire `<section>` incl. `<h2>` in `page.tsx:103-110`; `page.test.tsx` asserts the rendered HTML contains neither `id="cruces"` nor "Cruces con sectores" and that the cruces RPC is never invoked when OFF.
3. **Anti-insinuación §9.1** — PASS. Factual neutral count only, crude counterparty name + `IdentityMarker`, never linked, never a RUT; honest empty state. Inline `PROHIBIDO`/`PATRON_RUT` negative-match tests present.
4. **Pitfall 1 (no `fecha_captura`/`origen` per item)** — PASS. The component feeds `ProvenanceBadge` with `item.fecha`, `sourceLabel("lobby")`, `item.enlace_fuente`; it never references `.fecha_captura` or `.origen` on a cruces item. `CruceEvidenciaItem` deliberately omits those fields.
5. **CERO DDL / grant / flag flip** — PASS. No file under `supabase/migrations/` is touched; no grant added; `CRUCES_PUBLIC_ENABLED` left unset.
6. **Server Component throws on real `rpcError` (#34)** — PASS. `CrucesSection` does `if (error) throw new Error(...)`; never degrades to empty.

Two correctness/quality WARNINGs remain, both in the data-rendering path that only goes live in Phase 39 (gate ON). They are real defects in shipped code, not blockers for the gated-OFF surface, but they will produce a visibly wrong UI the moment the flag is flipped — i.e. exactly when no further build work is planned. Fix now while the code is in front of you.

## Warnings

### WR-01: Duplicate React keys when one audiencia has ≥2 contrapartes in the same sector

**File:** `app/components/cruces-de-parlamentario.tsx:120`
**Issue:** Evidence items are keyed by `` `${s.sector_id}-${item.audiencia_id}` ``. The materializer (`0039_cruce_senal.sql:99-120`) builds `evidencia.items[]` by `jsonb_agg` over the join `lobby_audiencia a JOIN lobby_contraparte c ON c.identificador = a.identificador`, emitting **one item per (audiencia × contraparte)** and stamping each item with `audiencia_id = a.identificador`. An audiencia with two contrapartes classified into the **same** sector therefore yields two items sharing the same `audiencia_id` within the same signal → two `<li>` with an identical React key. React de-duplicates keys silently in production (dropping/merging a node) and warns in dev; the second contraparte can be lost from the DOM, defeating the per-evidence provenance guarantee (FND-08). This is reachable with real PROD data (multi-contraparte audiencias are common in the Ley del Lobby registry) — it is not a synthetic edge case.
**Fix:** Key by item position (stable within a non-reordered, non-paginated list) or by the full item identity, not by `audiencia_id` alone:
```tsx
{s.evidencia.items.map((item: CruceEvidenciaItem, i: number) => (
  <li
    key={`${s.sector_id}-${item.audiencia_id}-${i}`}
    ...
```
(Index is acceptable here because the list is render-all, never reordered or filtered client-side. Alternatively include `item.contraparte_nombre_crudo` in the key.)

### WR-02: `ProvenanceBadge` renders the meeting date as data-freshness → every badge falsely reads "stale" (amber)

**File:** `app/components/cruces-de-parlamentario.tsx:140-144`
**Issue:** `capturedAt={item.fecha ? new Date(item.fecha) : null}` passes the **audiencia meeting date** into `ProvenanceBadge.capturedAt`. That prop drives two things in `provenance-badge.tsx`: the freshness label "Actualizado {relativeTimeEs}" (`:51-55`) and the `esStale` amber styling (`:33,44-45`), where `esStale` is `now - capturedAt > 48h`. Lobby audiencias are by nature weeks-to-years old, so **every** cruces badge will render amber and say "Actualizado hace N meses", asserting the *dataset is stale* when in fact it is the meeting that is old. RESEARCH Open Question 1 / Assumption A1 flagged this as low-stakes "either is honest", but the chosen path is the misleading one: it conflates "fecha de la reunión" with "frescura del dato", and the universal-amber signal trains users to ignore the staleness cue. Passing `null` (the other option the research offered) is strictly honest — the badge shows "Sin fecha de actualización" and no false stale styling — while `item.enlace_fuente` still carries the load-bearing FND-08 traceability.
**Fix:** Pass `null` for `capturedAt` (the RPC projects no per-item capture timestamp), keeping `sourceUrl`/`sourceName`:
```tsx
<ProvenanceBadge
  capturedAt={null}
  sourceName={sourceLabel("lobby")}
  sourceUrl={item.enlace_fuente}
/>
```
If the meeting date must be visible, render it as its own labelled line ("Reunión del {fechaCorta(...)}") outside the badge, the way the lobby section shows `fechaTexto` separately from `capturedAt`. Do not route a meeting date through the freshness prop.

## Info

### IN-01: Unused `id` field threaded through `CrucesViewData`

**File:** `app/components/cruces-de-parlamentario.tsx:45-48,83-84,170`
**Issue:** `CrucesViewData.id` is set by `CrucesSection` and destructured-but-ignored by `CrucesView` (only `cruces` is read at `:84`). Unlike the lobby analog — where `id` feeds pagination `buildHref` — cruces has no pagination, so `id` is dead weight on the view contract. It is harmless but invites a future reader to assume the view needs the parlamentario id for something (e.g. a link), which would be an anti-insinuación foot-gun.
**Fix:** Either drop `id` from `CrucesViewData` and pass `<CrucesView data={{ cruces }} />`, or keep it but add a one-line comment that it is intentionally unused by the pure view (kept for symmetry with the lobby contract).

### IN-02: `tipo_senal` degradation copy ("registros … en el sector") is correct but untested for the empty-evidence sub-case

**File:** `app/components/cruces-de-parlamentario.tsx:76-79`
**Issue:** The honest-degradation branch for an unknown future `tipo_senal` is good and is exercised by the test at `cruces-de-parlamentario.test.tsx:170-181`. However, that test only asserts the etiqueta appears and no `PROHIBIDO` term matches; it does not assert the neutral "N registros en el sector …" wording specifically, so a regression that re-introduced a fabricated verb on the unknown-token path (as long as it dodged the regex) would pass. Low priority — the DB CHECK constraint (`tipo_senal in ('lobby_sector')`, `0039:50`) makes any other value unreachable today.
**Fix (optional):** Add `expect(texto).toMatch(/\d+ registros? en el sector/i)` to the unknown-token test to pin the neutral wording.

---

_Reviewed: 2026-06-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
