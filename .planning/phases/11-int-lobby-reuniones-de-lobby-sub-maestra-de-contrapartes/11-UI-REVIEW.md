# Phase 11 — UI Review (Lobby section on /parlamentario/[id])

**Audited:** 2026-06-19
**Baseline:** 11-UI-SPEC.md (anti-insinuation lane, 3 honest empties, §9.1 content gate) + v1.0/Phase 10 inherited system
**Screenshots:** not captured (no dev server on :3000 / :5173 / :8080) — code/markup audit only
**Mode:** retroactive, advisory (non-blocking)
**Scope:** `app/components/lobby-de-parlamentario.tsx` (+ test), `app/app/parlamentario/[id]/page.tsx`, reused `ProvenanceBadge` / `IdentityMarker`, `app/lib/types.ts`

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Layout / hierarchy + own-lane stacking | 4/4 | `<section id="lobby" mt-12>` is a true sibling of `#votos` with its own `<h2>`/Suspense; no cross-lane `<article>`/`<Card>`/`<li>` composition |
| 2. States (3 honest empties) | 4/4 | `noIngestado` (real, from absence of `lobby_ingesta_estado` row) ≠ `totalAudiencias===0` ≠ rendered list; copy textually distinct; error path throws (not masked as empty) |
| 3. Interaction | 3/4 | SSR pagination + `min-h-[44px]` correct; degraded empty side (`<span aria-hidden>`) is sound, but pagination `<nav>` lacks a `Página N de M` mono parity with votos on the no-prev/no-next edge (cosmetic) |
| 4. Accessibility | 3/4 | Heading order valid (h1→h2 siblings, no h3 since "menciones" not rendered); list semantics correct. WARNING: `IdentityMarker` emits a native `title` attribute carrying a full sentence — tooltip text not reliably exposed to all AT and not keyboard-focusable |
| 5. Content / tone (§9.1 HARD gate) | 3/4 | Lane isolation, anti-causality, no score/flag, raw counterpart, no third-party RUT all hold and are test-guarded. WARNING: `representado` renders "en representación de {X}" — a relational phrase not in the §10 payload contract and not gate-tested |
| 6. Visual consistency (v1.0 + Phase 10 votos) | 4/4 | Reuses `ProvenanceBadge`/`IdentityMarker` verbatim, mono dates via `fechaCorta`, `space-y-4` row rhythm, no new tokens, no invented viz (`VotacionBar` correctly unused) |

**Overall: 21/24**

No BLOCKERs. The §9.1 release gate holds in the audited code. Findings below are WARNINGs and polish.

---

## Top 3 Priority Fixes

1. **`representado` renders an un-contracted relational phrase ("en representación de {X}")** — WARNING (highest priority, tone). `representado` is not in the UI-SPEC §10 `LobbyAudienciaRow` payload interface; it was added during implementation (`types.ts` `LobbyAudienciaRpcRow.representado`). The rendered string "en representación de Andes Holding" is raw source data, but the connecting prose "en representación de" is product-authored framing that pairs two named entities — adjacent to the §9.1 rule-3 "no relationship/affinity language" boundary. Fix: either (a) label it like the others — `Representa: {X}` with a muted prefix matching `Contraparte:` / `Asunto:` so the product never authors a relational verb, or (b) add `representado` to the §10 contract and to the content-gate regex so it is explicitly governed. Currently the gate test (line 177) does not exercise `representado` at all.

2. **`IdentityMarker` leans on a native `title` tooltip for its caveat** — WARNING (accessibility). The full explanatory sentence lives only in `title=` (identity-marker.tsx:19). `title` is not announced by many screen readers, never shown on keyboard focus, and invisible on touch. The visible text "identidad no verificada" + `aria-label` is correct and sufficient for the marker itself; the explanatory sentence should not be the only path to the meaning. Fix: this is an inherited-component issue (out of Phase 11 scope to change unilaterally) — flag for the shared component, or render the explanation as a real `Tooltip` (already a dependency) consistent with `ProvenanceBadge`.

3. **Pagination edge markup parity with votos** — WARNING (interaction/visual). On a single-page result `totalPages > 1` is false so the `<nav>` is omitted (correct), but when paginated the empty-edge `<span aria-hidden="true" />` placeholders are fine; the concern is only that the lobby `<nav>` and the votos `<nav>` should stay visually identical as the page grows. They currently match (`justify-between`, mono "Página N de M", `min-h-[44px]` anchors). Fix: none required now — keep them in lockstep when either changes; consider extracting a shared `Paginacion` component to prevent drift across Phases 12/14–16.

---

## Detailed Findings

### Pillar 1: Layout / hierarchy + own-lane stacking (4/4)
- `page.tsx:61-66`: `<section id="lobby" className="mt-12">` is a sibling of `<section id="votos" className="mt-12">` (page.tsx:48), not nested. The 48px `mt-12` gutter is the lane boundary the SPEC §2/§3.0 mandates.
- Each section owns its `<h2 className="text-xl font-semibold mb-4">` and its own `<Suspense>` boundary with a shape-matched skeleton — a slow lobby RPC cannot block votos.
- No `<article>`, `<Card>`, or `<li>` composes a lobby audience next to a vote. The row (`lobby-de-parlamentario.tsx:157-202`) carries only fecha / contraparte / asunto / provenance. Test at lines 46-60 asserts no `/proyecto/` or `/parlamentario/` href and no vote vocabulary in `textContent` — structural, not cosmetic.
- Intro line (lines 102-107) sits under the `<h2>` before the list, as §3.1 requires.

### Pillar 2: States — 3 honest empties (4/4)
- State (a) not-ingested (lines 110-121): gated on `noIngestado`, which is computed REAL from absence of a `lobby_ingesta_estado` row AND zero audiences (lines 313-323) — this resolves the hardcoded `noIngestado: false` debt still present in votos (`votos-por-parlamentario.tsx:438`). Genuinely better than the Phase 10 sibling.
- State (b) ingested-zero (lines 124-134): distinct copy "No se registran reuniones de lobby confirmadas…". Tests (lines 105-126) assert the two copies are mutually exclusive and that neither reads as virtue (`limpio|no se reúne|sin compromisos|transparente`).
- State (c) list renders; counterpart-unverified is NOT an empty state (the meeting is real) — raw string + `IdentityMarker`, correct per §6.1.
- Error path: `rpcError` and `estadoError` both `throw` (lines 303-307, 318-322) so a DB/network failure surfaces the honest error UI rather than masquerading as "sin reuniones" (#34 discipline). `.maybeSingle()` used for the ingesta marker.
- Audience with no counterpart renders "Contraparte no publicada por la fuente." (lines 179-183) rather than fabricating — honest degrade.

### Pillar 3: Interaction (3/4)
- Pagination is fully SSR via `?lobbyPage=N` with `#lobby` anchor (buildHref lines 67-70), `min-h-[44px]` anchors, mono "Página N de M". Deep-linkable, no infinite scroll — matches §3.2/§7.
- Page clamping (`pageClamped`, line 328) prevents out-of-range pages.
- External source link delegated to `ProvenanceBadge` (`target="_blank" rel="noopener noreferrer"`, aria-label includes "(abre en nueva pestaña)", `safeExternalHref` strips `javascript:`/`data:`) — correct.
- Minor: no client interactivity by design (RSC end-to-end, no `"use client"`) — correct per §7.

### Pillar 4: Accessibility (4→3/4)
- Heading hierarchy valid: one `h1` (header), two sibling `h2` ("Votaciones", "Reuniones de lobby"); no `h3` rendered because the "Menciones sin verificar" sub-block is not surfaced this phase — so no skipped level. Compliant with §8.
- List semantics: audiences are `<ul>`/`<li>`, one `<li>` per audience (lines 150-205), readable in order.
- Skeletons `aria-hidden="true"` (page.tsx:129).
- No meaning by color: provenance staleness carries amber AND "Actualizado hace…" text; identity uncertainty is text + `aria-label`, never color.
- The neutral count sentence (lines 142-148) is plain text, singular/plural correct ("reunión"/"reuniones").
- WARNING (the −1): `IdentityMarker`'s explanatory sentence is delivered only via the native `title` attribute (identity-marker.tsx:19), which is not reliably exposed to assistive tech, keyboard, or touch. The marker's own label is fine; the rationale text is effectively hidden from non-mouse users. Inherited-component issue — flag, do not patch in-phase.

### Pillar 5: Content / tone — §9.1 HARD gate (3/4)
- Lane isolation: holds (see Pillar 1). Rule 1 PASS.
- Anti-causality (rule 2): no causal copy; gate regex (test line 177) covers "se reunió para|a cambio de|antes de votar|que resultó en". PASS.
- Anti-affinity (rule 3): no "cercano a|vinculado a|aliado de|su lobista|lobista habitual". PASS in tested copy. See WARNING on `representado` below.
- No score/index/ranking/flag (rule 4): only the neutral count "N reuniones registradas" (lines 142-148); `VotacionBar` not imported. PASS.
- No judgment adjectives (rule 5): none. PASS.
- Identity uncertainty exactly "identidad no verificada" (rule 6): `IdentityMarker` text is exact. PASS.
- Third-party privacy absolute (rule 7): counterpart is `contraparte_nombre` verbatim, never linked (P11 RPC emits no `contraparte_id`), no RUT in payload or DOM. `LobbyContraparteRow` (types.ts:215-222) has no RUT field; test line 89-94 asserts no Chilean RUT pattern in `textContent`. PASS — this is the existential-risk control and it holds.
- Provenance mandatory (rule 8): `ProvenanceBadge` per row, unknown → "fuente desconocida" no link. PASS.
- Empty is a fact not a virtue (rule 9): covered in Pillar 2. PASS.
- WARNING (the −1): `representado` renders product-authored connective prose "en representación de {X}" (lines 82-86), pairing the counterpart with a represented entity. The value is raw, but the connecting verb is authored and is NOT in the §10 payload contract nor exercised by the gate regex. Adjacent to the rule-3 affinity boundary; treat as the highest-priority tone item (fix #1). Not a violation today, but ungoverned.

### Pillar 6: Visual consistency (4/4)
- Reuses `ProvenanceBadge` and `IdentityMarker` verbatim; no new tokens, no new typography (4 sizes / 2 weights respected — `text-base`, `text-sm`, `font-mono`, `font-semibold` on h2 only).
- Row rhythm `space-y-4`, `gap-x-3 gap-y-2`, `border-t first:border-t-0`, `ml-auto` badge — consistent with the votos row idiom and §2 8-point scale.
- Mono dates via `fechaCorta` with honest fallback chain `fecha → fecha_raw → "Fecha no publicada"` (lines 152-155).
- Skeleton shape-matched (page.tsx:127-136) per §6.2.
- No invented aggregate viz; `VotacionBar` correctly unused per §3.4.

---

## Registry Safety
`components.json` present (shadcn initialized). UI-SPEC §11 declares **no third-party registries** and no new components added this phase. Registry audit: 0 third-party blocks to check, no flags. Not applicable.

---

## Files Audited
- `app/components/lobby-de-parlamentario.tsx`
- `app/components/lobby-de-parlamentario.test.tsx`
- `app/app/parlamentario/[id]/page.tsx`
- `app/components/provenance-badge.tsx` (reused)
- `app/components/identity-marker.tsx` (reused)
- `app/components/votos-por-parlamentario.tsx` (Phase 10 sibling, for consistency baseline)
- `app/lib/types.ts` (LobbyAudienciaRow / LobbyContraparteRow / LobbyAudienciaRpcRow / sourceLabel)
- `.planning/phases/11-.../11-UI-SPEC.md` (contract)
- `.planning/phases/11-.../11-03-SUMMARY.md`
