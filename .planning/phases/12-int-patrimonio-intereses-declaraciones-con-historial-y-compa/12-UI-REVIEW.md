# Phase 12 — UI Review (Patrimonio/Intereses: historial + comparación)

**Audited:** 2026-06-19
**Baseline:** `12-UI-SPEC.md` (design contract) + inherited v1.0/Phase 10/11 system
**Screenshots:** not captured (no dev server on :3000/:5173/:8080; section is a Server Component reading live RPCs — audited on code/markup)
**Mode:** Advisory / non-blocking, retroactive
**Registry audit:** N/A — only official shadcn `Table` added; no third-party registries (§11)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting (ZERO-verdict gate) | 4/4 | §9.1 hard gate fully honored across list AND comparison; gate-test exercises both surfaces incl. changed value + absent field |
| 2. Visuals | 4/4 | Sober list + sober Table, no diff/valence/viz; v1.0 components reused verbatim |
| 3. Color | 4/4 | No valence hue anywhere; amber reserved for freshness only |
| 4. Typography | 3/4 | Sizes/weights inherited correctly; fecha prominence honored. `tipo` renders raw `version.tipo` (may surface a URI, not the literal source label) |
| 5. Spacing | 4/4 | 8-point scale, `mt-12` lane gutter, 44px touch targets on every interactive anchor |
| 6. Experience Design | 3/4 | 3 honest empty states + error/loading/freshness all present. Comparison reachable only by deep-link `?comparar=A,B` — no selector UI wired from the list |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **WARNING — Comparison selector is not wired from the list.** `DeclaracionComparacion` renders correctly but the only way to reach the populated table is a hand-built `?comparar=A,B` deep-link. The SPEC §3.5/§7 calls for an SSR anchor/checkbox selector ("pick two versions by fecha de presentación", `min-h-[44px]`). The SUMMARY itself flags this as deferred UX. *Impact:* a citizen cannot actually invoke the headline comparison feature from the UI. *Fix:* add per-version selection anchors in `VersionRow` that compose `?comparar=<fechaA>,<fechaB>#patrimonio` (two-step: first selection sets `?comparar=A`, second appends `,B`), reusing the existing `buildVerHref` pattern.

2. **WARNING — `tipo` label may render a raw source URI instead of the literal label.** `VersionRow` renders `{version.tipo}` directly, and `DeclaracionRpcRow.tipo` is documented as "rdfs:label resuelto **o URI cruda**" (types.ts:257). The SPEC §3.2/§9 contract is the human label "Declaración de patrimonio" / "Declaración de intereses". *Impact:* a degraded RPC row could surface `http://datos.cplt.cl/.../Patrimonio` as the visible type label — ugly, not editorialized but not honest-readable either. *Fix:* normalize `tipo` in `modelarVersiones` (map known URIs → literal label; fall back to the raw string only when no mapping exists) so the view never prints a bare URI.

3. **WARNING — Freshness caveat color is a hardcoded Tailwind class, not the inherited amber token.** `VersionRow` uses `text-amber-700` (line 150) and `DeclaracionComparacion` tests forbid `text-red/green` but the caveat amber is `text-amber-700` literal, while the design system's freshness amber lives in `--provenance-*` / the badge's `text-amber-700 border-amber-400`. It is the same hue so it does not break the color contract, but it is an un-tokenized literal that drifts from "reuse the system VERBATIM, add zero tokens" (§0). *Impact:* low — visual is correct today; maintenance risk if the amber token is ever retuned. *Fix:* extract the freshness color to the same token the ProvenanceBadge uses, or accept as a documented deviation.

---

## Detailed Findings

### Pillar 1: Copywriting — ZERO-verdict gate (4/4)

This is the release-blocking pillar and it is met. The §9.1 HARD gate covers **both** surfaces by construction:

- **Verdict/delta vocabulary: absent.** No "enriquecimiento", "conflicto de interés", "aumentó/disminuyó", "variación", "delta/Δ", "%", "pasó de", "patrimonio total". The comparison (`DeclaracionComparacion`, lines 300-390) holds only literal `c.valores[etiqueta]` cells; the UI computes nothing — column union is `Array.from(new Set(...flatMap Object.keys))` (lines 325-327), pure disposition, no diff.
- **Absent field is a literal fact**, not a gap: cell reads "No declarado en esta versión" (line 366), never "—", never a highlighted/colored gap — exactly §6.1/rule 1.
- **Comparison gate is test-enforced**, closing the Phase 11 `representado` hole: the content-gate test (`*.test.tsx` lines 317-363) renders a populated multi-version comparison **with a changed value and an absent field** and asserts `PROHIBIDO_VEREDICTO` + `PROHIBIDO_CONECTIVO` + `PATRON_RUT` + familiar terms are absent from `textContent`, and that CC BY 4.0 is in the caption. The §9.1 gate-test mandate (a)-(e) is satisfied.
- **No causality / no connective prose.** Every field is a muted NOUN label + literal value via `<dt>{c.etiqueta}:</dt><dd>{c.valor}</dd>` (lines 174-175). No product-authored verb/preposition pairs entities. `modelarVersiones` only ever emits noun labels ("Cargo", "Organismo"; SPEC examples "Bienes inmuebles", "Valores").
- **Freshness honesty (INT-04):** the standing caveat copy is verbatim from §6.4 (lines 150-153) and only renders on `es_historica`. An old declaration is explicitly historical, never "actual" — test at lines 116-132 asserts no "patrimonio actual"/"vigente" string.
- **CC BY 4.0 visible in intro AND comparison caption.** `AtribucionCcBy` (lines 95-111) renders contiguous text "Datos bajo licencia CC BY 4.0." + a real license link to `creativecommons.org/licenses/by/4.0`, never tooltip-only; reused in the `<TableCaption>` (line 336). Matches the CONTEXT-LOCKED requirement that derived views repeat attribution.
- **Three honest empty states distinct** (lines 213-238): "no ingestado" ≠ "ingestado, 0 confirmadas" ≠ comparison-needs-2. None reads as virtue/wealth/poverty — test lines 137-176 assert the negative.
- **PII:** RUT/familiar never selected (types.ts §10 contract) and never rendered; test asserts `PATRON_RUT` and cónyuge/hijo/familiar absent from `textContent`.

No findings reduce this score.

### Pillar 2: Visuals (4/4)

- Version list is a sober `<ul>`/`<li>` with the fecha as visual anchor; comparison is a sober shadcn `Table`, explicitly NOT a diff widget. No invented chart/sparkline/trend — §3.6 anti-viz honored (no `VotacionBar`, no CSS bar).
- **No diff/valence styling:** test (lines 302-313) asserts no `text-red|text-green|bg-red|bg-green|line-through|diff-added|diff-removed`. A changed value looks identical to an unchanged one.
- ProvenanceBadge present per version (`ml-auto`, line 139) and per comparison column (lines 378-387) — mandatory, never omitted.
- Reused components (`ProvenanceBadge`, `IdentityMarker`) are verbatim from v1.0; the `Table` is the standard official shadcn block.

### Pillar 3: Color (4/4)

- 60/30/10 inherited; no field value, cell, row, or border conveys valence. No good/bad/up/down hue anywhere — especially in the comparison grid.
- Amber appears only for freshness: the ProvenanceBadge stale state (`text-amber-700 border-amber-400`) and the historical caveat text. Both are the CONTEXT-mandated "old declaration" signal, never applied to declared content. (The hardcoded `text-amber-700` on the caveat is noted as a minor tokenization drift under Fix #3, not a color-contract violation — the hue is correct.)
- `--destructive` reserved/unused; no destructive actions this phase.

### Pillar 4: Typography (3/4)

- 4 sizes / 2 weights inherited; no `text-xs` in body, no bold(700)/light(300) introduced.
- Fecha de presentación prominence honored: `font-mono text-base leading-none` + literal "Presentada el {fecha}" label on both the row (line 133) and the comparison column header (line 343) — prominence is semantic (labeled text), not size-only. `fechaCorta` produces es-CL "DD MMM YYYY" matching §9.2.
- `<h2>` is `text-xl font-semibold`; `<h3>` "Comparar versiones" is `text-sm font-semibold` — matches §4.
- **WARNING (the −1):** `tipo` renders the raw `version.tipo` (line 137) which per `DeclaracionRpcRow` may be a URI rather than the literal label. Typographically and semantically the type label should always be human-readable ("Declaración de patrimonio"). See Fix #2.

### Pillar 5: Spacing (4/4)

- 8-point scale throughout: `gap-2`, `py-4`, `gap-x-3/gap-y-1`, `mb-4`, `mt-8`, `gap-1` (badge). `mt-12` lane gutter applied at the `<section id="patrimonio">` sibling in `page.tsx` (line 76) — correct lane boundary below `#lobby`.
- 44px touch exception applied to every interactive anchor: pagination "Anteriores"/"Siguientes" (`min-h-[44px]`, lines 273/286), "Ver detalle" disclosure (line 187). The only permitted non-8pt value.
- Section never alters the shell container (`max-w-3xl` owned by `<main>`); the `Table` wrapper provides its own `overflow-auto` (table.tsx line 9) for the responsive horizontal scroll required by §7.

### Pillar 6: Experience Design (3/4)

- **States:** loading = shape-matched `PatrimonioSkeleton` with `aria-hidden` (page.tsx 156-170); error path = real DB/network error thrown (lines 507-511, 521-525), distinct from "0 rows" via `.maybeSingle()` discipline — §6.3 honored. Three honest empties (§6.1). Freshness amber + caveat (§6.4). All present.
- **Identity guard:** only `confirmado` versions enter the count and comparison; `modelarVersiones` attributes to `p_id` because the RPC only emits confirmadas (lines 415-417). The unverified-mention branch (`IdentityMarker`) exists in `VersionRow` (lines 157-162) as a defensive path.
- **Accessibility of the comparison table is correct:** real `<table>` with `<caption>` carrying the "solo datos" framing + CC BY 4.0, `<th scope="col">` for dated version columns (line 342), `<th scope="row">` for each field label (line 351). A screen reader announces "{campo}, Presentada el {fecha}: {valor}". `<dl>/<dt>/<dd>` pairs label↔value in the list. Heading order is valid: one `h1` (header) → `h2` siblings (Votaciones / Reuniones de lobby / Declaraciones…) → `h3` "Comparar versiones" — no skipped levels.
- **WARNING (the −1):** the comparison feature is only reachable by a hand-constructed `?comparar=A,B` deep-link. No selection affordance is rendered from the version list, so the headline interaction of the phase is effectively undiscoverable in the UI as shipped. The view works end-to-end by deep-link (and is fully tested), but the user-facing entry point is missing. See Fix #1.
- Note: `IdentityMarker` relies on a `title` attribute for its full explanation, which is not AT-reliable — inherited issue already flagged in Phase 11, out of scope here.

---

## Files Audited

- `.planning/phases/12-.../12-UI-SPEC.md` (contract)
- `.planning/phases/12-.../12-03-SUMMARY.md`
- `app/components/patrimonio-de-parlamentario.tsx`
- `app/components/patrimonio-de-parlamentario.test.tsx`
- `app/app/parlamentario/[id]/page.tsx`
- `app/components/ui/table.tsx`
- `app/components/provenance-badge.tsx`
- `app/components/identity-marker.tsx`
- `app/lib/types.ts` (payload §10 + `sourceLabel`)
- `app/lib/format.ts` (`fechaCorta`, `esStale`, `relativeTimeEs`)
