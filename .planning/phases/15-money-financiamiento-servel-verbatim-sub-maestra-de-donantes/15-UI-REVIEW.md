# Phase 15 — UI Review

**Audited:** 2026-06-19
**Baseline:** `15-UI-SPEC.md` (design contract) + sibling components (`contratos-de-parlamentario.tsx`, `lobby-de-parlamentario.tsx`, `patrimonio-de-parlamentario.tsx`)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only audit)
**Stance:** ADVISORY (non-blocking). Section gated OFF in production (`MONEY_PUBLIC_ENABLED` unset → entire `<section>` + `<h2>` absent from HTML). Findings apply for when the gate is flipped ON.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting (honesty contract) | 3/4 | Heading non-possessive, 3 states distinct, forbidden vocab absent, donor framed as own subject — but `eleccionActual` hardwired `null` means the amber prior-candidacy caveat **never fires in production**; an old aporte's only defense is the per-row `Elección:` label. |
| 2. Visuals | 2/4 | Row mirrors `ContratoFila` faithfully and ProvenanceBadge is per-row — but **doubled "Elección" word** in both group header and row `<dt>` ("Elección Elección 2021", "Elección: Elección 2021") is a real visual defect, confirmed by the component's own test. |
| 3. Color | 4/4 | No red/green; amber confined to `ProvenanceBadge` staleness + the period-anterior caveat (`text-amber-700`); accent (`text-primary underline`) only on pagination + provenance link. Empty states are muted prose, never green/✓. |
| 4. Typography | 4/4 | Two weights (400 + `font-semibold` 600); sizes limited to `text-xl`/`text-base`/`text-sm`; `font-mono` reserved for dates/amounts/periodo/page-counter. Matches SPEC §Typography exactly. |
| 5. Spacing | 4/4 | `mt-12` carril boundary present on `<section>` (page.tsx:120); `min-h-[44px]` tap targets on both pagination links; `gap-x-3 gap-y-2 py-4` row rhythm identical to `ContratoFila`. |
| 6. Experience Design | 3/4 | Three honest states derived server-side; real RPC error thrown at boundary (#34); skeleton shape-matched; null-column fallbacks tested. Minor: `verificado_sin_aportes` falls back to literal string `"la fecha de corte"` if `fechaCorte` is null, an unreachable-but-ugly degenerate. |

**Overall: 20/24**

Registry audit: shadcn initialized (`components.json` present), but UI-SPEC §Registry Safety declares **zero third-party registries** (Tooltip/Table/Skeleton pre-vendored, shadcn official). 0 third-party blocks checked, no flags.

---

## Top 3 Priority Fixes

> **Status (2026-06-19): all 3 resolved on `master`.** See commit hashes per item.

1. **[RESOLVED — commit `069d797`] Doubled "Elección" word in group header and row label** — When the gate is ON, every group header reads "Elección Elección 2021" and every row reads "Elección: Elección 2021", because `g.eleccion`/`a.eleccion` already contains the verbatim string "Elección 2021". The component's own test (`.test.tsx:241`) asserts `"Elección Elección 2021"`, so the defect is baked into the contract, not a slip. **Fix:** either render the bare periodo in the `<h3>` (`{g.eleccion}` without the literal "Elección " prefix) and keep `<dt>Elección:` as the label, or normalize the RPC `eleccion` value to a bare period ("2021") and prefix in the UI consistently — pick one source of the word "Elección" and update the test fixture/assertion.
   - **Applied:** added `encabezadoEleccion()` — when the verbatim value already starts with "elección"/"eleccion" (case- and accent-insensitive) the `<h3>` renders it as-is (no doubling); otherwise it prefixes "Elección " (e.g. for "DIPUTADO - DISTRITO 23 - 2021"). The verbatim value is never mutated. The buggy `.test.tsx` assertion was replaced with one inspecting the `<h3>`s for the non-doubled string, plus a new case for a non-"Elección" verbatim value.

2. **[RESOLVED — commit `e7cbecc`] Amber prior-candidacy caveat is unreachable in production** — `eleccionActual` is hardwired to `null` (component line 446) with an honest rationale (no reliable current-mandate source yet), so `agruparPorEleccion` marks **no** group `esAnterior` and the amber "Aporte de una candidatura anterior…" line never renders against real data. The SPEC's LOCKED period-treatment (group-by-election + per-row label + amber caveat) is therefore only 2/3 realized at runtime. **Fix (when enabling):** wire a current-mandate periodo source (e.g. derive from `ParlamentarioPublicoRow.periodo`, already public) into `eleccionActual` so the caveat can fire; until then, document in the section that the caveat is dormant by design and that the per-row `Elección:` label is the sole active defense.
   - **Applied:** `eleccionActual` is now an explicit prop on `FinanciamientoSection`, populated by `page.tsx` (`FinanciamientoSectionConPeriodo`) from the public `parlamentario_publico.periodo`. Exact-string matching was replaced with `esGrupoAnterior` (exact-match fast path + year-aware comparison: a group year strictly less than the mandate year is "anterior"), so a "2022-2026" periodo correctly flags an "Elección 2017"/"Elección 2021" group. Conservative: never labels "anterior" unless the mandate year is known and comparable; the per-row `Elección:` label stays as defense-in-depth. Tests added for the amber caveat firing on a prior group (and not on the current group), including the mixed year-range format and a same-year non-anterior case. **Logic-bearing change — recommend a human confirm the year-extraction heuristic against real `periodo` values before flipping the gate ON.**

3. **[RESOLVED — commit `05e9728`] SPEC↔implementation drift on the link basis ("por RUT" vs "por nombre confirmado")** — The implementation correctly uses "Asociado por nombre confirmado al candidato." and "Consultado por nombre del candidato" (SERVEL publishes no RUT; the match is by audited name, Plan 15-02 A1). But `15-UI-SPEC.md` still says "asociados por RUT exacto", "la asociación es por RUT", and "Asociado por RUT al candidato." (lines 102, 110, 173, 180, 220, 284). The code is *more* honest than the contract, but the contract was never reconciled. **Fix:** update `15-UI-SPEC.md` Copywriting Contract + Layout + Data Contract sections to "por nombre confirmado" so the contract and the shipped honesty rule agree; otherwise a future checker reading only the SPEC will wrongly flag the (correct) implementation.
   - **Applied:** `15-UI-SPEC.md` reconciled to "por nombre confirmado" across the intro, empty-B copy, donor→candidate link line, layout pseudo-code, fecha-de-corte line, the three-states triggers, the mapping prose, and the RPC data contract. Added a LOCKED "Link basis — A1 re-resolution" note clarifying that the only RUT this section mentions is the **donor's** (deny-by-default, never rendered). Code unchanged — spec brought up to the code.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

PASS:
- Heading "Aportes de campaña registrados en SERVEL" is non-possessive, lives in `page.tsx:121` inside the gate (not in the component) — matches SPEC §Exposure Gate exactly.
- Three states textually distinct and tested (`.test.tsx:123-173`): `no_ingestado` ("Aún no hemos ingerido…"), `verificado_sin_aportes` ("Consultamos SERVEL por este candidato (corte al …) y no se registran aportes…"), `enlazado` (neutral count + list). Empty states are muted prose; the test asserts absence of `/limpio|impecable|sin aportes ✓|✓/i`.
- Donor framed as its own subject: `Aporta: {donante}` is `text-base` (prominent), the candidate link is a **separate muted line**. No fusion into a personal attribution. Test `.test.tsx:176-225` guards this and the RUT-never-rendered invariant.
- Forbidden vocabulary absent (grep on the component: every "por RUT" hit is in comments/anti-pattern docs, never user copy). No causal/affinity/judgment/aggregate language. The only aggregate is the neutral `{N} aporte(s) registrado(s)`.
- Attribution honest: "términos de uso por verificar" (component:121), NOT CC BY 4.0; `AtribucionCcBy` helper correctly not reused.

WATCH:
- **WARNING** — `eleccionActual = null` (line 446) disables the amber caveat copy entirely at runtime (see Top Fix #2). The per-row `Elección:` label remains as defense in depth, so an old contribution can't read as current — but the explicit "No corresponde al mandato actual" reassurance never appears.
- **WARNING (documentation)** — `verificado_sin_aportes` interpolates the literal string `"la fecha de corte"` into the sentence when `fechaCorte` is null (line 268-269): "Consultamos SERVEL por este candidato (corte al la fecha de corte)…" reads ungrammatically. Unreachable in practice (this state requires a marcador, which carries `ingestado_hasta`), but the fallback is sloppy. Mirror is inherited verbatim from contratos.

### Pillar 2: Visuals (2/4)

PASS:
- `AporteFila` structurally mirrors `ContratoFila`: subject span + muted link line + `<dl>` of NOUN-labels + per-row fecha-de-corte + `ProvenanceBadge` pushed `ml-auto`. Identical flex/`<dl>` discipline.
- ProvenanceBadge is per-row and mandatory; `sourceName={sourceLabel(a.origen)}` resolves to "SERVEL" (verified: `types.ts:410` `if (o.includes("servel")) return "SERVEL";`).
- Period grouping renders `<h3>` per election + per-row `Elección:` label (defense in depth) — the SPEC §Layout shape is present.

FAIL:
- **BLOCKER (when ON)** — Doubled word "Elección Elección 2021" (group header, line 298-300) and "Elección: Elección 2021" (row `<dt>`/`<dd>`, lines 170-171). The verbatim RPC value already begins with "Elección", and the UI prefixes "Elección " again. Confirmed load-bearing by `.test.tsx:241` asserting the literal `"Elección Elección 2021"`. This is the single clearest visual defect. See Top Fix #1.
- **WARNING** — No focal-point differentiation between the donor subject (`text-base`) and the `<dd>` field values (also `text-base`). The donor "Aporta: …" is the same size/weight as "Elección 2021", "$ 500.000", etc.; only the label `<dt>`s are muted/smaller. Visual hierarchy of "who is the subject" is weaker than it could be (the SPEC calls the subject "prominent" — it's prominent only by position, not by type). Sibling `ContratoFila` has the same trait, so this is a consistency-preserving weakness, not a regression.

### Pillar 3: Color (4/4)

- No red/green anywhere in the component. Severity color is absent by construction.
- Amber is freshness-only + the period caveat: `text-amber-700` appears once (line 308, the caveat), matching the patrimonio sibling convention (`patrimonio-de-parlamentario.tsx:150`); all other amber lives inside `ProvenanceBadge` staleness (`provenance-badge.tsx:44`). LOCKED rule honored.
- Accent reserved: `text-primary underline underline-offset-2` only on the two pagination `<Link>`s (lines 331, 344); the provenance "fuente oficial ↗" link is the only other accent, inside the badge. Nothing decorative is accented.
- Empty/zero states use `text-muted-foreground` prose, no positive affordance.

### Pillar 4: Typography (4/4)

- Sizes in use: `text-xl` (heading, page.tsx), `text-base` (subject + `<dd>` values), `text-sm` (labels/metadata/intro/count/pagination). Three roles, within the SPEC's 3–4.
- Weights: regular (400) + `font-semibold` (600 on `<h2>` and the group `<h3>`). Two weights only — no third.
- `font-mono` correctly scoped to `fecha_aporte`, `monto`, `fecha_corte`, the group periodo `<h3>`, and "Página N de M". No mono leakage onto prose.

### Pillar 5: Spacing (4/4)

- `mt-12` carril boundary present on `<section id="financiamiento">` (page.tsx:120) — the anti-insinuation lane separator. Section is a SIBLING immediately after `#dinero` (contratos), never nested. An aporte and a contract/vote never share an `<article>`/`<li>`.
- `min-h-[44px]` tap targets on both pagination links (lines 331, 344) — the one declared spacing exception, applied exactly as in siblings.
- Row rhythm `gap-x-3 gap-y-2 py-4 border-t first:border-t-0` identical to `ContratoFila`; `<dl>` uses `gap-x-4` columns; intro/count use `mb-4`; group separation `mt-6 first:mt-0`. All multiples of 4.

### Pillar 6: Experience Design (3/4)

PASS:
- Three honest states derived server-side in `FinanciamientoSection` (lines 429-436): `enlazado` if rows, `no_ingestado` if no marcador, `verificado_sin_aportes` if marcador + 0 rows. Mirrors `ContratosEstado` precisely.
- Real RPC/marcador errors are **thrown** at the route boundary (lines 393-397, 422-426), never degraded to "sin aportes" — #34 honored for both the RPC and the marcador read.
- Loading: `FinanciamientoSkeleton` (page.tsx:226) shape-matched to the view (intro + attribution + 3 rows), identical pattern to `ContratosSkeleton`.
- Null-column resilience: `tipo_persona ?? ""` before `.toLowerCase()`, `donante_nombre ?? "Donante no publicado"`, `monto ?? "No publicado"`, `fecha_aporte ?? "Fecha no publicada"`. Tested (`.test.tsx:346-369`).
- Gate double-candado: `FinanciamientoSection` re-checks `moneyPublicEnabled(process.env)` at top (line 375) and returns `null` so no Supabase read happens when OFF — mirrors `ContratosSection:297-299`.
- Pagination is server-driven (`?financiamientoPage=N`, `PAGE_SIZE=20`, href anchored `#financiamiento`), page clamped to `totalPages`.

WATCH:
- **WARNING** — Pagination paginates the **already-fully-loaded** array (`todos.slice(start, …)`, line 453); the RPC returns all rows and the component slices in memory. Fine at expected volumes, but unlike a true server-paginated RPC it loads every aporte for a candidate on each page view. Inherited from contratos; flag only if a candidate could have hundreds of aportes.
- **WARNING** — `fila_id` is `${eleccion}#${fecha_aporte}#${i}` (line 402): the positional `i` makes the React key stable only within a single render order. Because the RPC order is deterministic (period DESC / fecha DESC) this is safe, but two aportes with identical eleccion+fecha rely on `i` alone — acceptable, noted for completeness.

---

## Files Audited

- `app/components/financiamiento-de-parlamentario.tsx` (primary target)
- `app/components/financiamiento-de-parlamentario.test.tsx` (contract assertions)
- `app/app/parlamentario/[id]/page.tsx` (gate mount + heading + skeleton)
- `app/lib/types.ts` (`AporteRpcRow` + `sourceLabel` SERVEL branch)
- `app/components/provenance-badge.tsx` (per-row provenance + amber freshness)
- `app/components/contratos-de-parlamentario.tsx` (Phase 14 sibling — consistency baseline)
- `app/components/patrimonio-de-parlamentario.tsx` (amber-caveat convention reference)
- `15-UI-SPEC.md` (design contract)

**Recommendation count:** 3 priority fixes (1 visual blocker when enabled, 2 dormant-feature/doc-drift warnings); 5 minor warnings across pillars 1, 2, and 6.
