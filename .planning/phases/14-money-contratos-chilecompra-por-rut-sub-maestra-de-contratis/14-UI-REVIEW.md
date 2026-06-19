# Phase 14 — UI Review

**Audited:** 2026-06-19
**Baseline:** `14-UI-SPEC.md` (design contract) + shipped siblings (`lobby-`, `patrimonio-`, `votos-por-parlamentario.tsx`)
**Screenshots:** not captured (no dev server on :3000/:5173/:8080 — code-only audit)
**Disposition:** ADVISORY / non-blocking. The whole `<section id="dinero">` is gated OFF in production (`MONEY_PUBLIC_ENABLED` default OFF). All findings below apply to the state where the flag is enabled post legal sign-off (F13).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every locked string matches the contract verbatim; three honest states are textually distinct; no possessive, no "limpio", attribution is "mención de la fuente" not CC BY 4.0. |
| 2. Visuals | 3/4 | Subject/lane discipline is correct, but proveedor subject is NOT visually prominent vs siblings — `text-base` body subject sits at the same weight/size as the `<dd>` literal values, so the "subject = proveedor" rule is structural-only, not visual. |
| 3. Color | 4/4 | Zero severity coloring; amber lives only inside `ProvenanceBadge` (frescura); accent (`text-primary`) only on pagination links. Matches the hard color-honesty rules. |
| 4. Typography | 3/4 | Two weights only and the inherited size scale, but the row introduces a `gap-x-1.5` / `text-base` subject pattern that no sibling uses, and the persona-jurídica subject is not differentiated by weight — see Visuals. |
| 5. Spacing | 3/4 | `mt-12` carril boundary present and correct; pagination `min-h-[44px]` present. BUT the `<ul>` drops the siblings' `space-y-4`, and the row uses `py-4` where lobby uses `py-3` — a small but real divergence from the "inherited verbatim, no new values" mandate. |
| 6. Experience Design | 4/4 | Three honest states + thrown error (not silent empty) + gate-before-read + shape-matched skeleton + per-row provenance + fecha de corte. Complete state coverage. |

**Overall: 21/24**

---

## Top 3 Priority Fixes (advisory)

1. **Proveedor subject is not visually the subject (Pillar 2/4 — WARNING).** The contract (§Typography, §Persona jurídica) makes the proveedor "the prominent element of the row," but `Proveedor: {nombre}` renders at plain `text-base font-normal` — identical to every `<dd>` literal value below it (`organismoTexto`, `nombreOrdenTexto` are also `text-base`). Nothing makes the subject scan as the subject. Sibling rows establish prominence (patrimonio: `font-mono text-base leading-none` date bar; lobby: contraparte `text-base` against `text-sm` metadata). **Fix:** give the proveedor name `font-semibold` (the second allowed weight, already in the type scale) so the grammatical subject is also the visual subject, while keeping `(persona jurídica)` muted `text-sm`. This costs nothing in tokens and resolves the load-bearing persona-jurídica rule visually, not just structurally.

2. **Row vertical rhythm and list spacing diverge from siblings (Pillar 5 — WARNING).** `contratos-de-parlamentario.tsx:129` uses `py-4` and the `<ul>` at line 239 has no `space-y-*`, whereas `lobby-de-parlamentario.tsx` uses `py-3` rows inside `<ul className="space-y-4">`. The contract says spacing is "inherited verbatim … do not introduce new spacing values." `py-4` is on the allowed scale but is not the sibling's row value, so two MONEY/INT lanes stacked on the same page will have visibly different row density. **Fix:** align to one sibling pattern — either `py-3` rows (lobby) with no list gap, or keep `py-4` and confirm patrimonio (which also uses `py-4`) as the chosen reference. Pick one and document it; do not leave two rhythms coexisting.

3. **`<dl>` labels collide with intro/state copy at the same `text-sm text-muted-foreground` (Pillar 2/4 — WARNING).** Field labels (`Organismo comprador:`, `Monto:`), the separated link line (`Enlazado por RUT al parlamentario.`), the fecha-de-corte line, and the `(persona jurídica)` tag are all `text-sm text-muted-foreground`. Inside a single dense row this flattens the hierarchy: the anti-insinuación "separate muted line" for the parlamentario link reads at the same visual level as a field label, weakening the structural separation the contract calls load-bearing. **Fix:** keep the link line muted but give it `mt-1` breathing room (or move it directly under the subject with a hairline) so "Enlazado por RUT al parlamentario." is legibly a distinct statement, not just another `<dl>`-adjacent caption.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
No deviations from the locked Copywriting Contract.
- Heading is exactly `Contratos del Estado asociados al RUT` and lives in `page.tsx:98-100` (set on the shell, per contract), never possessive. Forbidden possessives are absent and negatively asserted in tests (`*.test.tsx:99-100, 182`).
- Intro line 1 (`contratos-de-parlamentario.tsx:98-103`) and line 2 (`:104-107`) are verbatim, including "la asociación es por RUT exacto y no implica que el contrato sea del parlamentario."
- Attribution is `mención de la fuente`, NOT CC BY 4.0 (`:106`); test asserts no `CC BY 4.0` string (`*.test.tsx:107`). This is the correct divergence from `patrimonio`'s `AtribucionCcBy`.
- Three states use unmistakably different copy: `no_consultado` (`:199-203`, "Aún no hemos consultado… no significa que no existan"), `consultado_sin_contratos` (`:216-219`, with `{fecha de corte}`), `enlazado` (neutral count `:231-237`). The empty/never-queried states never read as "limpio"/"✓"; negatively tested at `*.test.tsx:132`.
- Neutral count is the only aggregate; singular/plural handled (`:233-235`). No sum of montos, no ranking.
- Pagination labels `Anteriores`/`Siguientes`/`Página N de M` (`font-mono`) identical to siblings (`:251-268`).
- `sourceLabel` ChileCompra branch added (`types.ts:378`) so the badge reads "ChileCompra," not "fuente desconocida."

### Pillar 2: Visuals (3/4)
Hierarchy is the one soft spot. The carril/subject discipline is correct (proveedor is the grammatical subject, parlamentario link is a separate line, contract is its own `<li>`, never composed with a vote/declaration). But the proveedor subject is NOT visually elevated — see Priority Fix 1. `ProvenanceBadge` is pushed right with `ml-auto` (`:178`) matching siblings; the badge is the only chrome, and lucide icons are correctly NOT introduced. `IdentityMarker` is correctly omitted: rows are RUT-exact server-confirmed links, not unconfirmed mentions, so the spec's "only if a row is shown unconfirmed" condition does not trigger here. No icon-only buttons exist (read-only display). One focal-point weakness: with the subject un-emphasized, a dense `enlazado` row has no clear visual anchor.

### Pillar 3: Color (4/4)
Fully compliant with the hard color-honesty rules.
- No red/green/severity on any amount or counterparty. `monto` renders plain `font-mono` (`:159-161`), never colored.
- Amber appears ONLY via `ProvenanceBadge` frescura (`provenance-badge.tsx:44`), never as a "suspicious" signal.
- Accent (`text-primary`) only on pagination `<Link>`s (`:253, :266`). No accent on contract values, state messages, or the proveedor subject.
- No destructive color; section has zero mutations/CTAs.
- The empty states carry no positive-verdict color (no green check) — they are muted prose only.

### Pillar 4: Typography (3/4)
Two weights as mandated (`font-normal` default + the `font-semibold` heading in `page.tsx`). Sizes stay within the inherited scale (`text-base` body, `text-sm` labels/meta). `font-mono` correctly reserved for monto, fecha de la orden, código de la orden, fecha de corte, and "Página N de M." Deduction: the persona-jurídica subject does not use the available `font-semibold` to mark itself as the subject (Fix 1), so the type scale is technically clean but under-utilized for the contract's stated hierarchy. The `(persona jurídica)` tag at `text-sm text-muted-foreground` (`:134-136`) is correct.

### Pillar 5: Spacing (3/4)
- `mt-12` carril boundary present and non-negotiable-compliant (`page.tsx:97`), separating `#dinero` from `#patrimonio`. Confirmed in the gated wrapper and in the test (`*.test.tsx:60`).
- Pagination links carry `min-h-[44px]` touch target (`:253, :266`), matching siblings.
- `<dl>` uses the patrimonio-inherited `grid sm:grid-cols-[max-content_1fr] sm:gap-x-4` (`:153`) — good.
- Divergence (Fix 2): row `py-4` + `<ul>` with no `space-y-*` does not match lobby's `py-3` + `space-y-4`. It DOES match patrimonio's `py-4` list (which also omits `space-y`), so this is internally defensible — but the contract's "inherited verbatim" wording wants one explicit reference. Flagged as WARNING, not BLOCKER, because every value used is on the 4px scale (no arbitrary spacing except the sanctioned `min-h-[44px]`).
- `mb-4` intro→content and `gap-x-3 gap-y-2` row columns are sibling-consistent.

### Pillar 6: Experience Design (4/4)
Complete state coverage, the strongest pillar.
- **Three honest states** derived server-side (`:347-356`): `enlazado` when rows exist; `no_consultado` when the ingesta marker is absent (IDENT-10 / no internal RUT); `consultado_sin_contratos` when marker present + 0 rows. This is the correct 3-outcome generalization of the siblings' 2-state `noIngestado` boolean.
- **Error ≠ empty:** both the RPC error (`:314-318`) and the marker error (`:341-345`) THROW, routing to the error boundary — never silently degrading to "consultado sin contratos." Honors the #34 rule.
- **Gate before read:** `moneyPublicEnabled(process.env)` returns `null` BEFORE any Supabase call (`:297-299`), AND the whole `<section>` incl. `<h2>` is wrapped at the page level (`page.tsx:96-105`) so the heading is absent from server HTML, not CSS-hidden. Double-locked. Tested at `*.test.tsx:71-87`.
- **Loading:** `ContratosSkeleton` (`page.tsx:189-199`) is `aria-hidden`, shape-matched (intro `h-4 w-3/4` + attribution `h-3 w-1/2` + 3 row skeletons), mirroring `LobbySkeleton`/`PatrimonioSkeleton`.
- **Null tolerance (WR-01):** nullable RPC columns get honest fallbacks ("Proveedor no publicado", "No publicado") instead of crashing or empty cells (`:116-126`); tested at `*.test.tsx:267-290`.
- **CR-02 honesty:** `nombre_orden` is labeled "Nombre de la orden," never under "Monto"; "Monto" shows "No publicado" when null — a non-monto is never presented as money. Tested at `*.test.tsx:241-265`.
- **Per-row provenance + fecha de corte:** both present and distinct (`:168-174, :178-184`).

Registry audit: `components.json` present; UI-SPEC declares no third-party registries (only vendored shadcn `table`/`badge`/`skeleton`/`tooltip`). No third-party blocks to scan — no flags. The component imports only `ProvenanceBadge`, `Link`, format helpers, and types; no new installs.

---

## Files Audited
- `app/components/contratos-de-parlamentario.tsx`
- `app/components/contratos-de-parlamentario.test.tsx`
- `app/app/parlamentario/[id]/page.tsx`
- `app/lib/types.ts` (`sourceLabel` ChileCompra branch, `ContratoRpcRow`)
- `app/lib/money-gate.ts` (`moneyPublicEnabled` chokepoint)
- `app/components/provenance-badge.tsx`
- `app/components/identity-marker.tsx`
- Siblings (baseline): `app/components/lobby-de-parlamentario.tsx`, `app/components/patrimonio-de-parlamentario.tsx`
- `.planning/phases/14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis/14-UI-SPEC.md`
