---
phase: 94-agenda-p2e-agenda-por-d-a-filtros-periodista-gate-browsero
reviewed: 2026-07-22T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/lib/dia-calendario.ts
  - app/lib/dia-calendario.test.ts
  - app/app/agenda/page.tsx
  - app/components/citacion-card.tsx
  - app/components/agenda-filtros.tsx
  - app/components/agenda-cobertura.tsx
  - app/components/estado-actual-block.tsx
  - app/lib/anti-insinuacion-guard.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: fixed
fixed:
  scope: "WR-01, WR-02, WR-03, IN-01"
  commits:
    WR-01/WR-02: 8c17d4d
    WR-03: 107ad36
    IN-01: 878d586
  deferred: "IN-02, IN-03 (fuera de scope: latente/cosmético)"
  tests: "app suite verde (1220 pass; el único fallo del run completo = timeout ambiental de money-antiflip-guard, pasa aislado 20/20); tsc --noEmit exit 0"
  deploy_note: "El deploy 369f9cbe es PRE-estos-fixes; viajan con el próximo deploy (95/96 o cierre). NO amerita redeploy AHORA — ver §Deploy."
---

# Phase 94: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 94 wires the agenda-por-día view (tz-Chile day grouping via the new
date-only-midnight-UTC contract), a periodista filter island, a declared-coverage
banner, and two ficha wiring fixes (past citations + tabla-de-sala). The core
contract of the phase — the date-only helper `dia-calendario.ts` — is correct and
consistently applied: every point that previously converted `citacion.fecha` /
`sesion_sala.fecha` through `America/Santiago` now uses the UTC date part, while
"hoy" is still computed in tz Chile (`DIA_CALENDARIO_CHILE_HOY`). The vigente/pasada
boundary compares two `YYYY-MM-DD` strings lexicographically, which is coherent. The
island imports zero Supabase, never re-derives dates with local `Date`, and filters
honestly on the server-computed `dayKey`. The banner uses `head`/`limit(1)` queries
with no 1k cap. SSR and the island render the identical `CitacionCard` with identical
props, so no hydration divergence.

The defects found are correctness-at-the-edges (data-dependent double counting in the
two new ficha derivations) and one anti-insinuación linter coverage gap: the two
surfaces that render the NEW user-facing agenda copy in this phase
(`estado-actual-block.tsx`, `citacion-card.tsx`) are not in any scan array. No
Critical issues.

## Warnings

### WR-01: `citacionesPasadas` / `citacionVigente` double-count a citation whose boletín appears in ≥2 of its points

**Status:** ✅ FIXED (`8c17d4d`) — `CitacionCruda` gained optional `id`; the query
selects `citacion(id, …)` and `dedupPorCitacion` collapses by parent identity in
`citacionesPasadas` + `citacionVigente`. Fixture con duplicado añadido (mismo id → 1
línea; ids distintos / sin id → no colapsan).

**File:** `app/components/estado-actual-block.tsx:493-495, 542-548, 178-196`
**Issue:** The citations query reads `citacion_punto` filtered by `.eq("boletin", boletin)`
and embeds the parent `citacion`:
```ts
sb.from("citacion_punto")
  .select("citacion:citacion(comision, fecha, semana_iso)")
  .eq("boletin", boletin)
```
This returns **one row per matching `citacion_punto`**, not per citation. A single
citation whose order of the day lists the same boletín in two different points
(`posicion`) yields two rows, both embedding the *same* `citacion`. The downstream
`citaciones` array therefore contains that citation twice, and `citacionesPasadas`
(no dedup by citation id/date) renders **two identical "Citado el DD mmm en {comisión}
(sesión pasada)" lines**. The user-visible count is inflated. `citacionVigente` is
resilient (it picks the min), but the past-sessions list is not. The gate evidence
(§4, 18193-06 = 1 citation) did not exercise a multi-point boletín, so this is
latent, not observed.
**Fix:** Deduplicate by citation identity before rendering. Select the citation `id`
and dedup:
```ts
.select("citacion:citacion(id, comision, fecha, semana_iso)")
// then, after flattening:
const vistos = new Set<string>();
const citaciones = raw.filter((c) => {
  if (c.id == null) return true;
  if (vistos.has(c.id)) return false;
  vistos.add(c.id);
  return true;
});
```

### WR-02: `enTablaSala` double-counts sessions when a boletín appears in ≥2 tabla items of the same session

**Status:** ✅ FIXED (`8c17d4d`) — `enTablaSala` deduplica por `(cámara, día publicado)`
antes de contar/renderizar. Dos días o dos cámaras distintas del mismo boletín siguen
siendo apariciones legítimas (no se colapsan). Fixture con duplicado añadido.

**File:** `app/components/estado-actual-block.tsx:500-503, 220-235, 439-441`
**Issue:** Symmetric to WR-01. The tabla-de-sala query reads `sesion_tabla_item`
filtered by boletín and embeds `sesion_sala(camara, fecha)`. It returns one row per
*item*, so a session that lists the same boletín in two items (e.g. two `parte_sesion`
entries, or a re-listed project) produces two rows with the same `{camara, fecha}`.
`enTablaSala` maps and sorts them without dedup, so the ficha declares **"En tabla de
sala N veces"** with N inflated and two links to the *same* `/agenda?semana=` week. The
count and the per-week link list are both user-facing (§5 of the gate), so an
over-count is a factual defect in a product whose core value is trazabilidad.
**Fix:** Dedup by `(camara, dayKey)` before counting/rendering:
```ts
const clave = (x) => `${x.f.camara}:${diaCalendarioCitacion(x.d)}`;
const vistos = new Set<string>();
// keep only the first row per session-day
```

### WR-03: New agenda copy surfaces (`estado-actual-block.tsx`, `citacion-card.tsx`) are NOT scanned by the anti-insinuación linter

**Status:** ✅ FIXED (`107ad36`) — ambos archivos añadidos a `SUPERFICIES_AGENDA`. Copy
actual verificado limpio (no contiene ni NIEGA término prohibido → NO requiere
`NEGACIONES_LOCKED`); el guard escanea las 5 superficies en verde.

**File:** `app/lib/anti-insinuacion-guard.test.ts:248-252`
**Issue:** `SUPERFICIES_AGENDA` lists only `agenda-filtros.tsx`, `agenda-cobertura.tsx`
and `app/agenda/page.tsx`. But Phase 94 introduces new user-facing agenda copy in two
components that are absent from *every* scan array:
- `estado-actual-block.tsx` — renders the gap #1/#2 copy: "Citado el … (sesión pasada)"
  and "En tabla de sala N veces". This is exactly the temporal/causal-adjacent copy the
  linter exists to protect, and it is the surface most likely to drift toward
  editorialization ("citado reiteradamente", "insiste", etc.).
- `citacion-card.tsx` — renders the cancellation state verbatim ("Suspendida"/"Sin
  efecto") plus the invitados block.
The JSDoc for `SUPERFICIES_AGENDA` (lines 223-247) explicitly reasons about the agenda
being "un vector de insinuación temporal/causal", yet the two surfaces that render the
phase's new factual claims are unguarded. Current copy is clean, but the linter is a
PREVENTIVE tripwire for future copy — the whole point of the array — and this leaves the
highest-risk new surface uncovered.
**Fix:** Add both files to `SUPERFICIES_AGENDA`:
```ts
const SUPERFICIES_AGENDA: string[] = [
  "components/agenda-filtros.tsx",
  "components/agenda-cobertura.tsx",
  "components/estado-actual-block.tsx",
  "components/citacion-card.tsx",
  "app/agenda/page.tsx",
];
```
(The try/catch tolerance already handles any future rename/removal.)

## Info

### IN-01: `semanasEntre` labels a rolling-7-day count as "N semanas", not distinct ISO weeks

**Status:** ✅ FIXED (`878d586`) — opción honesta+barata: se ALINEÓ el JSDoc (page.tsx) y
el comentario del campo (agenda-cobertura.tsx) para decir "rango en semanas de 7 días
(aprox.)", que es lo que `floor(díasEntre/7)+1` mide. Cero cambio de comportamiento/copy.

**File:** `app/app/agenda/page.tsx:350-357`
**Issue:** The banner cell says "…ingeridas en `{N} semanas`". `semanasEntre` computes
`floor(daysBetween / 7) + 1` from the min→max range, which is a count of 7-day buckets,
not distinct ISO weeks. A range Wed→next-Tue (7 days) returns 2 even though it may touch
only 2 ISO weeks by coincidence; the JSDoc claims it counts "lunes-Chile distintos" but
the code does no such thing. The banner intro declares the figure as a rough derived
range and forbids "cobertura completa", so this is honesty-tolerable, but the JSDoc
overstates the algorithm.
**Fix:** Either align the JSDoc to say "rango en semanas de 7 días (aprox.)", or compute
distinct ISO weeks with `isoWeekOf` over min/max if an exact figure is wanted.

### IN-02: `enTablaSala` renders the parent `<p>` with the count even when `fecha`/link data is present but stale — no visual dedup of same-week links

**File:** `app/components/estado-actual-block.tsx:439-455`
**Issue:** Downstream of WR-02, even after fixing the count, two sessions in the *same*
ISO week (different days) produce two links to the identical `/agenda?semana=` target.
The list "…{semana}, {fecha}, {semana}, {fecha}…" can show two chips pointing at the same
week page. Cosmetic, but a reader clicking two different-looking dates lands on the same
agenda week. Consider grouping the link by `semanaIso` while keeping distinct fecha
labels, or de-emphasizing that both share a week.
**Fix:** Group by `semanaIso` for the href while listing each fecha; or collapse
same-week entries.

### IN-03: `primerBoletin` re-sorts `citacion_punto` by `posicion` but `boletines` array (WR-01 filter path) does not, so `boletin` (primer) and `boletines[0]` may disagree

**File:** `app/app/agenda/page.tsx:435-437, 474-481`
**Issue:** In the slice, `boletines` is built from `citacion_punto` in the order Supabase
returns it (unsorted), while `boletin` (single) comes from `primerBoletin`, which sorts
by `posicion` and takes the first with a boletín. These can differ if the DB returns
points out of `posicion` order. Not a correctness bug for the current UI (the two fields
feed different features — filter vs. cross-link), but the inconsistency is a latent trap
if a future change assumes `boletines[0] === boletin`.
**Fix:** Sort `citacion_punto` once by `posicion` and derive both `boletines` and
`boletin` from the sorted array.

---

## Fix (2026-07-22)

**Scope aplicado:** WR-01, WR-02, WR-03, IN-01. **Diferidos:** IN-02 (dedup visual
de links same-week; cosmético, sobrevive tras WR-02), IN-03 (`boletines[0]` vs
`boletin`; latente, no afecta la UI actual).

**Commits (branch → master vía fast-forward):**
- `8c17d4d` — fix(94): WR-01/WR-02 dedup citaciones/tabla-sala por identidad del padre
- `107ad36` — fix(94): WR-03 añade estado-actual-block y citacion-card al linter
- `878d586` — fix(94): IN-01 alinea el JSDoc de semanasEntre a lo que realmente mide

**Verificación:** `tsc --noEmit` exit 0; suite app 1220 pass. Los dos archivos de test
tocados pasan en verde (77 tests: 51 estado-actual-block + 26 anti-insinuación, con las 5
superficies AGENDA escaneadas). El único fallo del run completo fue un TIMEOUT ambiental
de `money-antiflip-guard.test.ts` (scan de `packages/` bajo contención de FS OneDrive);
pasa aislado 20/20 en 61 ms → NO es regresión de estos fixes (no se tocó MONEY/packages).

### Deploy

El deploy vivo **369f9cbe es PRE-estos-fixes**. Decisión: **NO redeploy AHORA**; los
fixes viajan con el próximo deploy (95/96 o cierre de milestone). Razón:

- **WR-01/WR-02 (counts inflados)** son LATENTES, no observados en PROD: el gate (§4
  18193-06 = 1 citación; §5 13665-07 = 2 apariciones en DÍAS distintos) NO ejercitó un
  boletín multi-punto ni una sesión con el mismo boletín en ≥2 ítems. Los sujetos del
  gate NO exhiben counts inflados con los datos actuales → el fix puede viajar después
  sin exponer un dato incorrecto en PROD hoy.
- **WR-03** es un tripwire preventivo de test (no cambia render).
- **IN-01** es solo JSDoc/comentario (no cambia copy ni comportamiento).

Ninguno altera lo que el gate mostró en 369f9cbe, así que no hay urgencia de redeploy.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-07-22 — Claude (gsd-code-fixer)_
