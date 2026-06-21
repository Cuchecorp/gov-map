---
phase: 22-votaciones-instructivas-que-voto-cada-uno
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/app/parlamentario/[id]/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/votacion-card.tsx
  - app/components/votacion-card.test.tsx
  - app/components/voto-ficha-row.tsx
  - app/components/votos-por-parlamentario.tsx
  - app/components/votos-por-parlamentario.test.tsx
  - app/lib/format.ts
  - app/lib/types.ts
  - supabase/migrations/0028_votos_instructivos.sql
  - supabase/tests/0029_votos_instructivos.test.sql
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: fixed
resolution: "5/5 warnings fixed (WR-01..05), 4 info deferred. vitest 221 green, tsc clean. Redeploy version 2a478ce7. Commits b0a1675 (WR-05) + 98071e6 (WR-01..04)."
---

# Phase 22: Code Review Report

> **RESUELTO 2026-06-20:** Los 5 Warning se arreglaron (commits `b0a1675` WR-05 honest-state, `98071e6` WR-01..04 vía helper puro `derivarVotosViewData`/`construirMateriasMap`/`normalizarPagina`). vitest 221 verdes, tsc limpio, redeploy en producción (version `2a478ce7`), e2e re-verificado. Los 4 Info quedan diferidos (deuda menor).

**Reviewed:** 2026-06-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 22 makes the votaciones section instructive: the RPC `votos_de_parlamentario`
is extended (DROP + recreate) to carry substance (titulo/idea_matriz) and outcome
(resultado/totals/quorum), and the UI gains substance+outcome lines on both the
parlamentario and proyecto fichas.

Against the project HARD rules the implementation is largely sound:

- **PII floor / LEGAL-03:** The migration keeps the RPC `security INVOKER` (no
  `prosecdef`), adds zero `create policy` / `grant select` on `parlamentario`, and
  touches only public-read tables (`voto`, `votacion`, `proyecto`, `proyecto_ficha`).
  The pgTAP test asserts INVOKER, zero policies on `parlamentario`, and anon-denied
  `partido`. This is clean — no PII regression found.
- **Anti-insinuación:** UI copy is framed as facts ("el proyecto fue {resultado}",
  "Votó {opción}", neutral "Votó distinto a su bancada"); no ranking/score/causal
  language; internal "rebeldías" never reaches the JSX. Banned-vocab GATE tests are
  present. No violation found in shipped copy.
- **Honest-states:** null `idea_matriz`/`resultado` degrade to "no disponible aún" /
  omit the clause; LEFT JOINs preserve vote rows; DB errors throw (not "sin votos").

The defects below are correctness/robustness issues, not rule violations. The most
material are the **aggregate/filter mismatch (WR-01)** and the **project arc split
across page boundaries (WR-02)**, both of which can mislead the citizen about a
parlamentario's record.

## Warnings

### WR-01: "Cómo votó" aggregate ignores the active tema filter (misleading totals)

**File:** `app/components/votos-por-parlamentario.tsx:528-555, 581-595`
**Issue:** `conteos` is computed over `todasConMateria` (the full, **unfiltered** set,
line 555: `for (const v of todasConMateria) conteos[v.seleccion] += 1;`) and
`totalVotos` is passed as `todasConMateria.length` (line 585). But the list below is
rendered from `filtradas`/`votos` (filtered by `materiaActiva`, line 543-545). When a
citizen clicks a tema chip (e.g. "Salud"), the "Cómo votó" bar, the "Emitió N votos
registrados" line, and the presente/ausente metric still reflect **all** votes across
all temas, while the project list shows only the Salud subset. The header and the list
disagree — a citizen reading "Salud" sees a global vote breakdown labeled under the
filtered view. This contradicts the honest-coverage intent (§3.4).
**Fix:** Drive the aggregate from the filtered set when a facet is active, or move the
"Cómo votó" block above the facet so it is unambiguously global. Minimal version:
```ts
const conteoSet = materiaActiva ? filtradas : todasConMateria;
const conteos: Record<Seleccion, number> = { si:0, no:0, abstencion:0, pareo:0, ausente:0 };
for (const v of conteoSet) conteos[v.seleccion] += 1;
// and pass totalVotos: conteoSet.length (or keep global but label it explicitly)
```

### WR-02: `agruparPorProyecto` groups only within the current page → a project's arc splits across pages

**File:** `app/components/votos-por-parlamentario.tsx:134-152, 557-562`
**Issue:** Pagination (`votos = filtradas.slice(start, start + PAGE_SIZE)`, line 562)
slices the flat vote list *before* grouping; `agruparPorProyecto` then groups only the
20-row page. A project whose etapas straddle the 20-row boundary renders as two
separate "project arc" cards — one header on page 1, another identical header on page 2
— breaking the "el titulo aparece UNA vez por arco" invariant (line 163 comment) and
double-counting the project in `totalProyectos` perception. The grouping abstraction
silently leaks the pagination unit.
**Fix:** Paginate by *project* (group first, then slice the groups), or fetch/group the
full set and paginate over `ProyectoArco[]`. E.g. build `agruparPorProyecto(filtradas)`
then `arcos.slice(start, start+PAGE_SIZE)` with `totalPages` derived from arco count.

### WR-03: `slugTema` collisions silently merge distinct materias into one facet

**File:** `app/components/votos-por-parlamentario.tsx:61-68, 534-537`
**Issue:** `slugTema` lowercases, strips diacritics, and collapses non-alphanumerics to
`-`. Two distinct source materias that differ only by punctuation/accent/case (e.g.
"Salud Pública" vs "salud-publica", or "Niñez" vs "Ninez") produce the **same slug**.
`materiasMap` is keyed by slug (line 534), so the last label wins and the two materias
silently merge into one chip; the filter `slugTema(v.materia) === materiaActiva`
(line 544) then mixes votes from both. For a traceability-first product this is a
quiet data conflation. Low probability with current data, but unbounded.
**Fix:** Detect slug collisions (if `materiasMap.has(slug)` with a different label,
disambiguate the slug, e.g. append a short hash) or key the facet on the verbatim
materia and slug only for the URL.

### WR-04: `Number.parseInt` on `votosPage` accepts trailing garbage and large pages without an upper guard

**File:** `app/components/votos-por-parlamentario.tsx:487-496, 560`
**Issue:** `Number.parseInt(rawPage ?? "1", 10)` parses `"3abc"` → `3` and `"99999"` →
`99999`. While `pageClamped = Math.min(page, totalPages)` (line 560) bounds the slice so
no crash occurs, the *canonical URL is not normalized*: `?votosPage=99999` or
`?votosPage=3abc` render page N but keep the bogus query string, and the pagination
links are built from `pageClamped` while the active page label uses `pageClamped` —
deep-links with junk params are silently honored rather than rejected/redirected. Minor,
but inconsistent with the strict input validation applied to `[id]`/`[boletin]`.
**Fix:** Reject non-numeric input explicitly and clamp before use:
```ts
const parsed = Number.parseInt(rawPage ?? "1", 10);
const page = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
```
(The `|| 1` already covers `NaN`; the residual issue is trailing-garbage acceptance and
no canonicalization — consider normalizing the URL when `pageClamped !== page`.)

### WR-05: `TimelineSection` and `VotacionesSection` swallow DB errors → silent empty state

**File:** `app/app/proyecto/[boletin]/page.tsx:144-153, 156-164`
**Issue:** `FichaSection` and `VotosSection` correctly destructure `error` and throw on a
real DB/network failure (the #34 honest-error pattern documented at line 129-132). But
`TimelineSection` (line 146: `const { data } = ...`, no `error`) and `VotacionesSection`
(line 158: `const { data } = ...`, no `error`) discard the error and fall through to
`?? []`. A transient DB failure on the votaciones query renders "Este proyecto no tiene
votaciones registradas en la legislatura vigente." (line 168-170) — fabricating a
factual claim ("no tiene votaciones") from an error. This is exactly the honest-state
violation the rest of the file guards against.
**Fix:** Capture and rethrow `error` consistent with the other sections:
```ts
const { data, error } = await sb.from("votacion").select("*, voto(*)")...
if (error) throw new Error(`No se pudieron leer las votaciones de ${boletin}: ${error.message}`);
```
Apply the same to `TimelineSection`.

## Info

### IN-01: `idea_matriz` doc comments say "extracto" but the RPC returns the full text

**File:** `supabase/migrations/0028_votos_instructivos.sql:3,56`; `app/lib/types.ts:150,167`
**Issue:** Comments describe `idea_matriz` as "idea matriz extracto" / "extracto de idea
matriz" (e.g. migration line 56), but the SQL projects `pf.idea_matriz` whole (line 56),
and truncation happens client-side via `extractoIdea`. The naming implies the DB
truncates; it does not. Harmless but misleading for the next maintainer.
**Fix:** Reword comments to "idea matriz completa (el UI trunca con extractoIdea)".

### IN-02: `pgTAP` `bag_has` over `proargnames` does not assert column *order* or *type*

**File:** `supabase/tests/0029_votos_instructivos.test.sql:32-38`
**Issue:** The test asserts the OUT names *set contains* the new columns, but the
migration's own contract (line 13-15) is that the 8 new columns appear **in a specific
order, after the 9 existing ones**. `bag_has` ignores order, so a future reorder of the
`returns table` (which silently breaks positional client mapping) would pass this test.
**Fix:** Add a `results_eq`/`has_column`-style ordered check, or assert
`array_to_string(proargnames, ',')` equals the exact expected ordered list.

### IN-03: `void within;` and unused `within` import in test file

**File:** `app/components/votos-por-parlamentario.test.tsx:2,573`
**Issue:** `within` is imported but never used; line 573 (`void within;`) is a workaround
to silence the linter. Dead import + dead statement.
**Fix:** Remove `within` from the import and delete line 573.

### IN-04: `RebeldiaRow` import in `votos-por-parlamentario.tsx` and `VotoFichaMencionRow` dead `confirmado` branch

**File:** `app/components/voto-ficha-row.tsx:155-185`
**Issue:** `VotoFichaMencionRow` handles a `confirmado` case (line 156-185) that, per the
type docs, the RPC never emits for the mención path; it is exercised only by fixtures.
Not a bug, but the branch constructs a `VotoFichaRowData` with fields the mención type
marks optional (`?? null` defaults), coupling two shapes. Worth a comment that this is
test-only defensive code, or extract a shared mapper to avoid drift if `VotoFichaRow`
gains a required field (which would silently break this object literal).
**Fix:** Add a `// test-only fallback` note, or centralize the mención→ficha mapping so a
required-field addition fails the type-check in one place.

---

_Reviewed: 2026-06-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
