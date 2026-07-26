---
phase: 100-panel-p1c-landing-panel
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - app/components/panel-actualidad.tsx
  - app/app/page.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/bento-guards.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 100: Code Review Report

**Reviewed:** 2026-07-24
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 100 replaces the producto-céntrico landing body with `PanelActualidad`, a
pure RSC that reads the precomputed bounded RPC `actualidad_senales_panel` (0066)
via `createServerSupabase` (service_role, `import "server-only"`). Reviewed
against the honesty-contract and régime-candado invariants.

**Honesty contract: PASS.** The four highest-risk invariants hold:

- **Throw-on-error (#34):** `PanelActualidad` throws on `error`, never `?? []`
  (panel-actualidad.tsx:253-257). `[]` is reached only via `(data ...) ?? []` on
  the *no-error* path (line 260) — the legitimate 0-rows path. Correct.
- **Suppression verbatim (SEN-03):** `f.supresion_causa` renders verbatim as the
  tile body (lines 161-178); the active count/framing branch is skipped entirely,
  so no muted "0" and no empty list. The suppression strings are the exact
  literals emitted by 0065 (e.g. "sin sesiones agendadas en las fuentes
  consultadas").
- **No cross-cámara ranking (T-52-13):** `porTipo` preserves RPC arrival order
  (0066 `order by tipo_senal, cobertura_camara, cluster_id` — never by `conteo`),
  and `tiposPresentes` iterates a fixed `ORDEN_TIPO` (lines 264-273). No
  order-by-count anywhere. Framing is factual ("N trámites en 7 días").
- **`(sin materia)` tolerated (regla F):** rendered verbatim as `<h3>` for
  `agrupacion_materia` (lines 187-207); no fabricated theme.

**PII / secret leak: PASS.** Reads only the non-PII RPC (0066 re-emits 9
non-PII columns, no PII join); `supabase.ts` is `server-only`; `page.tsx` keeps
`force-dynamic`; the RPC is in `PUBLIC_RPC_ALLOWLIST` so the lockdown-guard does
not block the deployed call.

**tz-Chile date-only: PASS.** `agenda_citacion`/`agenda_sala` route through
`diaCalendarioCitacion` (no at-time-zone); all other tipos use `fechaCorta`.

**Régime candados: PASS.** `SUPERFICIES_PANEL` is added to the anti-insinuation
scan union (anti-insinuacion-guard.test.ts:529) and `panel-actualidad.tsx` is in
both bento-guard arrays (cero-hex + tipografía). The try/catch tolerance is
per-file (`continue`/`return`) and does not neuter existing surfaces. Timing
denylist terms carry exact tildes ("exprés", "resucitó"). Component copy contains
no insinuating vocabulary; the `[var(--camara)]`/`[var(--senado)]` classes are
v4-correct (no bare `-[--var]`).

Findings below are all WARNING/INFO — no honesty regression, candado break, or
PII/RPC leak.

## Warnings

### WR-01: Raw window token (`"30d"` / `"futuras"`) leaks into the chip when `cobertura_camara` is null

**File:** `app/components/panel-actualidad.tsx:211-215`
**Issue:** The cobertura chip renders `{f.cobertura_camara ?? f.ventana}`. For
`urgencias` and `archivados`, the RPC always sets `cobertura_camara = null`
(0065 lines 197, 287), so the chip falls back to the raw internal window token
`"30d"`. For a fresh-but-empty path some rows carry `ventana = "futuras"`
likewise. `"30d"` / `"futuras"` are internal contract values (SenalRow.ventana
comment: `'7d' | '30d' | 'futuras' | null`), not citizen-facing copy — they are
not localized ("30d" is not Spanish) and read as a leaked implementation detail
next to already-window-qualified framing ("urgencias fechadas en 30 días"). This
is a copy-quality defect, not an honesty regression, but it is user-visible on
the live landing.
**Fix:** Only render the chip when a real cámara/cobertura is present, or map the
raw window to citizen copy. E.g.:
```tsx
{f.cobertura_camara && (
  <span className="...">{f.cobertura_camara}</span>
)}
```
or a `VENTANA_LABEL: Record<string,string>` mapping `"30d" → "últimos 30 días"`,
`"futuras" → "próximas"`. Do not surface `"30d"`/`"futuras"` verbatim.

### WR-02: Two tiles both titled "Agenda próxima" render as duplicate, unlabeled-distinct headings

**File:** `app/components/panel-actualidad.tsx:51-52, 273-284`
**Issue:** `agenda_citacion` and `agenda_sala` are distinct entries in
`ORDEN_TIPO` and each produces its own `TileSenal`, but both map to the identical
title `"Agenda próxima"` (TITULO lines 51-52). When both señales are active the
panel shows two adjacent `<h2>Agenda próxima</h2>` tiles with no distinguishing
label, differentiated only by the framing line ("citaciones próximas" vs
"sesiones de sala próximas"). The component comment (lines 271-272) claims the
two "comparten el tile 'Agenda próxima'... se fusionan sus filas", but the code
does NOT fuse them — `porTipo` keys by `tipo_senal`, so they are two separate
tiles. The comment is stale/inaccurate relative to the behavior, and the UX is
two same-titled tiles. Duplicate identical headings also degrade the a11y
heading outline.
**Fix:** Either genuinely merge the two agenda tipos into one tile (group
`agenda_citacion` + `agenda_sala` rows under a single "Agenda próxima" tile,
which the comment already describes), or give each a distinct title
("Citaciones próximas" / "Sesiones de sala"). Update the misleading comment
either way.

### WR-03: `react key={idx}` on suppression/active rows is index-based

**File:** `app/components/panel-actualidad.tsx:165, 192`
**Issue:** List rows use `key={idx}` (the array index). The rows within a tipo
come from a full-rebuild RPC and can reorder between renders (0066 orders by
`cobertura_camara nulls last, cluster_id nulls last`; a fresh cámara appearing
shifts indices). Index keys cause React to mis-associate DOM/state across
re-renders. This is low-impact here (pure presentational RSC, no row-local
state), hence WARNING not BLOCKER, but it is a known React anti-pattern in a file
whose sibling `actualidad-module.tsx` is the reference idiom.
**Fix:** Key by a stable identity of the row, e.g.
`key={`${tipo}-${f.cobertura_camara ?? f.ventana}-${f.cluster_id ?? "x"}`}`
(matches the RPC's own uniqueness tuple `(tipo, cobertura_camara, ventana,
cluster_id)` from 0065:69).

## Info

### IN-01: Dead variable `materia` vs redundant conditional

**File:** `app/components/panel-actualidad.tsx:187-188`
**Issue:** `const materia = tipo === "agrupacion_materia" ? f.materia : null;`
duplicates the type guard that is already implicit — `f.materia` is only
non-null for `agrupacion_materia` rows per the RPC contract. Minor; the guard is
defensive and harmless.
**Fix:** Optional — keep as defensive, or simplify to `const materia = f.materia`
if the contract is trusted. No behavior change.

### IN-02: `FRAMING.agrupacion_materia = "proyectos"` can read as a bare count without a window

**File:** `app/components/panel-actualidad.tsx:67`
**Issue:** Every other framing string carries an explicit window or qualifier
("...en 7 días", "...en 30 días", "citaciones próximas"). `agrupacion_materia`
renders "{conteo} proyectos" with no temporal/scope qualifier. Factually honest
(it is a corpus grouping, not a time window), but the asymmetry can read as an
unscoped tally. Not an honesty violation.
**Fix:** Optional — consider "proyectos en el corpus" or similar to match the
scoped phrasing of the other tiles.

### IN-03: Stale comment claims agenda tipos are fused

**File:** `app/components/panel-actualidad.tsx:271-272`
**Issue:** Comment "agenda_citacion + agenda_sala comparten el tile 'Agenda
próxima': se fusionan sus filas" does not match the implementation (see WR-02).
Misleading comment.
**Fix:** Correct the comment to reflect actual behavior (two tiles), or implement
the fusion the comment describes.

### IN-04: `SenalRow.evidencia` is read from the RPC but never rendered

**File:** `app/components/panel-actualidad.tsx:44, 248`
**Issue:** The RPC returns `evidencia` (jsonb, the per-item source links for
traceability, D-09) and the interface declares it, but the component never
surfaces it. Regla E (provenance per tile) is satisfied by the `Fuente:` footer,
but the item-level source links carried in `evidencia` (the trazabilidad-a-la-
fuente principle) are dropped on the floor. Not a defect for this phase's scope,
but the richest provenance payload is fetched-and-discarded.
**Fix:** Optional (future phase) — surface `evidencia` source links per row, or
drop the column from the RPC projection if it will never be rendered, to avoid
paying for an unused jsonb payload on every request.

---

_Reviewed: 2026-07-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
