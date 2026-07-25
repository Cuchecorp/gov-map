---
phase: 102-relaciones-p2b-similitud-de-votaci-n-gated-legal
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - app/app/comparar/page.test.tsx
  - app/app/comparar/page.tsx
  - app/components/co-votacion-red-guard.test.ts
  - app/components/red/arista-hecho.tsx
  - app/components/red/red-graph.tsx
  - app/components/similitud-votacion-comparar.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/lockdown-guard.test.ts
  - app/lib/vsim-antiflip-guard.test.ts
  - app/lib/vsim-gate.test.ts
  - app/lib/vsim-gate.ts
  - docs/legal/102-LEGAL-DOSSIER-VSIM.md
  - supabase/migrations/0068_coincidencia_votos_par.sql
  - supabase/tests/0068_coincidencia_votos_par.test.sql
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 102: Code Review Report

**Reviewed:** 2026-07-24
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The VSIM regime core is solid: `vsim-gate.ts` is a correct fail-closed chokepoint (`=== "true"`, server-only, injected env); the anti-flip guard's V1d structural check genuinely closes the additive-OR bypass; flag OFF produces DOM absence with zero RPC calls (verified by RTL asserting on `rpcMock.mock.calls`, not just HTML); the 0068 RPC is secdef, `search_path=''`, 5s timeout, double-revoked, aggregate-only 3 columns with the correct sustantiva denominator filter; the neutral figure carries the verbatim caveat before the number and the M=0 state never renders "0%".

However, the review found one regime violation that both guards are structurally blind to: the live `/red` legend still tells citizens that a graph line can represent "misma votación" and cites "votaciones de sala" as a source — stale copy left behind when VSIM-03 excised `co_votacion` from the graph. Additionally, the 0068 join can silently inflate N/M when duplicate confirmed votes exist for the same (votación, parlamentario) pair, and the comisiones axis of /comparar declares source-attributed absence from lists capped at `limit 50` without the CR-01 completeness discipline applied to the other pair axes.

## Critical Issues

### CR-01: /red legend still advertises "misma votación" as a graph relation (VSIM-03 violation, guard-blind)

**File:** `app/components/red/red-graph.tsx:479-481` and `app/components/red/red-graph.tsx:488-491`
**Issue:** VSIM-03 (LOCKED) mandates that co-votación/similitud never appears on the `/red` surface — Plan 01 removed the `co_votacion` branch from `TIPO_LABEL` and `arista-hecho.tsx`. But the rendered "Cómo leer este diagrama" legend (open by default) still says:

> "Una relación es un hecho documentado (audiencia de la misma contraparte de lobby, **misma votación**)."

and the source line still says:

> "Fuente: Ley del Lobby (Ley 20.730) **y votaciones de sala** · datos ingestados por este observatorio."

This is (a) factually false — the `0030_net.sql` CHECK constraint only admits `co_lobby_contraparte`, so no line in the graph can ever be a votación fact; and (b) exactly the spatial vote-proximity reading the anti-DW-NOMINATE regime excludes: the legend tells readers that a line between two persons can encode "voted the same," on the one surface (a person graph) where that reading is prohibited. Neither guard catches it: `co-votacion-red-guard.test.ts` only matches the identifier `/co_?votacion/i`, and the anti-insinuación linter does not scan `app/red/` or `components/red/` at all. The 102 dossier (§3) asserts "`co_votacion` JAMÁS en `/red`" as already delivered — this rendered copy contradicts the dossier handed to the legal reviewer.
**Fix:**
```tsx
// red-graph.tsx legend step 4:
Una relación es un hecho documentado (audiencia de la misma
contraparte de lobby). <strong>Nunca</strong> indica afinidad,
acuerdo ni motivo.
// …and the source line:
Fuente: Ley del Lobby (Ley 20.730) · datos ingestados por este observatorio.
```
Then re-run the operator cold-read claim in the dossier, since §3/§8 cite the /red exclusion as complete.

## Warnings

### WR-01: 0068 join inflates N and M when duplicate confirmed votes exist for the same (votación, parlamentario)

**File:** `supabase/migrations/0068_coincidencia_votos_par.sql:45-65`
**Issue:** The `voto` table's uniqueness is `(votacion_id, fuente_voter_id)` (0009) — NOT `(votacion_id, parlamentario_id)`. Identity resolution can (and with the Senado name-probable channel plausibly will, if a row ever flips to `confirmado` alongside a Cámara-id row for the same person) produce two confirmed rows for one parlamentario in one votación under different `fuente_voter_id`s. The CTEs select raw rows and `a join b using (votacion_id)` then multiplies: 2 A-rows × 1 B-row = 2 counted "shared votes" for a single votación, silently inflating both `m_compartidas` and `n_coinciden`. Because the output is a public-facing percentage under legal gating, a silently wrong denominator is a correctness defect, not a nicety. The pgTAP fixture only exercises one row per (votación, parlamentario), so the suite cannot catch this.
**Fix:** Deduplicate per votación in the CTEs, e.g.:
```sql
with a as (
  select distinct on (v.votacion_id) v.votacion_id, v.seleccion
  from public.voto v
  where v.parlamentario_id = p_a
    and v.estado_vinculo = 'confirmado'
    and v.seleccion in ('si','no','abstencion')
  order by v.votacion_id
),
...
```
(or `group by votacion_id` with a deterministic pick / exclusion of votaciones where the same person has conflicting selecciones), plus a pgTAP case with a duplicate `fuente_voter_id` row asserting `m_compartidas` stays 1.

### WR-02: Comisiones axis declares source-attributed absence from a truncated list (CR-01 discipline not applied; cap misdocumented)

**File:** `app/app/comparar/page.tsx:297-357` (intersection) and `app/app/comparar/page.tsx:539-540` (comment)
**Issue:** The pair axes militancia and co-autoría apply the CR-01 rule (absence only declarable from a complete list; otherwise "indeterminado"). The comisiones axis does not: `comisiones_de_parlamentario` is capped at `limit 50` (0064:109) and emits no `total_n`, yet `page.tsx` computes the intersection from the two capped lists and, on no match, renders the attributed absence "En las fuentes consultadas al {fecha}, no comparten comisiones." If either parliamentarian has more than 50 memberships (historical membresías accumulate across periods; the RPC has no vigencia filter), a shared commission can fall off the cap and the page asserts a false absence with source attribution — the project's stated risk #1. The column lists are likewise silently truncated at 50 with no declaration. Compounding it, the block comment at lines 528-540 claims "las RPCs cross-link (0060/0061/0067) devuelven a lo más CAP_RPC filas (limit 20)" — for comisiones the actual cap is 50, in 0064, so the documented invariant is wrong for one of the three RPCs it names.
**Fix:** Mirror the pair discipline: `const comisionesCompletas = comA.length < 50 && comB.length < 50;` and when a capped list has no intersection, render the `InterseccionIndeterminada` copy instead of absence (or add `count(*) over ()` as `total_n` to the RPC and reuse `listaCompleta`). Fix the comment to state the real caps (20 for 0061/0067, 50 for comisiones/0064).

### WR-03: Both /red guards are blind to rendered prose reintroducing vote-similarity (the hole CR-01 fell through)

**File:** `app/components/co-votacion-red-guard.test.ts:48` and `app/lib/anti-insinuacion-guard.test.ts` (SUPERFICIES arrays)
**Issue:** The permanent tripwire only matches the identifier `/co_?votacion/i` in code, and the anti-insinuación linter's surface arrays never include `app/red/` or `components/red/`. Consequently the DW-NOMINATE-adjacent copy in CR-01 ("misma votación" in the legend of the person graph) passes both guards today and would pass again if reintroduced tomorrow. The dossier (§3) tells the legal reviewer the guard "verifica … que co_votacion/covotacion no reaparece en ningún archivo de /red" — true only for the identifier, not for the concept, which is what the regime actually prohibits.
**Fix:** Add a rendered-copy tripwire to `co-votacion-red-guard.test.ts` — scan the STRING LITERALS / JSX text of `RED_DIRS` (post comment-strip) for idioms like `misma votación`, `votaron`, `votaciones` — and/or add `components/red/red-graph.tsx` + `components/red/arista-hecho.tsx` to a `SUPERFICIES_RED` array in the anti-insinuación guard (registering `MICROCOPY_HECHO`, which negates "afinidad", in `NEGACIONES_LOCKED` first, per Pitfall 1).

### WR-04: RTL neutral-figure assertion only inspects the 120 chars BEFORE the figure

**File:** `app/app/comparar/page.test.tsx:469-473`
**Issue:** The load-bearing anti-DW-NOMINATE check (figure must never carry accent/bold) slices `html.slice(figuraIdx - 120, figuraIdx)` — a window strictly before the text "Coinciden en 3 de 4". A regression that wraps part of the figure itself (e.g., `(<span className="font-semibold text-accent-product">75%</span>)`) opens its tag AFTER `figuraIdx` and passes this test verbatim, while visually rendering the exact "score highlight" the LOCK prohibits. The dossier §8 cites this assertion as the evidence that the figure is neutral, so the evidence is weaker than claimed.
**Fix:** Assert over the whole figure paragraph, e.g. locate the enclosing `<p …>…</p>` around `figuraIdx` (or `html.slice(figuraIdx - 120, html.indexOf("</p>", figuraIdx))`) and check it contains neither `text-accent-product` nor `font-semibold`.

## Info

### IN-01: 0068 has no p_a <> p_b guard (trivial 100% self-pair)

**File:** `supabase/migrations/0068_coincidencia_votos_par.sql:39`
**Issue:** `coincidencia_votos_par('X','X')` returns n = m (100%). The UI prevents it (`ambos` requires `a !== b`), but the RPC contract does not, and any future server caller bypasses the page guard. Low risk (no public execute).
**Fix:** Add `where p_a <> p_b`-style early-out (e.g., `and p_a <> p_b` in one CTE) or document the precondition in the migration header.

### IN-02: Component renders "({pct}%)" without guarding pct === null when m > 0

**File:** `app/components/similitud-votacion-comparar.tsx:119-121`
**Issue:** The props contract allows `{ m: 4, pct: null }`; the component would render "Coinciden en n de 4 votaciones compartidas (%)." Impossible from the current caller (pct is derived from m), but the prop type invites drift.
**Fix:** Either derive nothing and accept only `pct: number` when `m > 0` (discriminated union), or fall back to omitting the parenthetical when `pct == null`.

### IN-03: Dossier §5 describes linter terms that do not match the actual denylist

**File:** `docs/legal/102-LEGAL-DOSSIER-VSIM.md:170-174`
**Issue:** §5 tells the legal reviewer the blocklist includes "más afín", "bloque de votación" and "cercano". The actual `TERMINOS_PROHIBIDOS` entries are "afín", "bloque de" and "cercano a" — the first two are covered by substring/word-boundary behavior, but bare "cercano" (without "a") is NOT caught, so the dossier overstates coverage on that idiom. Same section's "verifica en diff" (§3) mischaracterizes a static full-tree scan.
**Fix:** Align the dossier prose with the real terms (or add "cercano" as a term if the coverage claim is intended), and say "escaneo estático permanente" instead of "en diff". The dossier is the artifact a human signs; its claims should be exact.

---

_Reviewed: 2026-07-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
