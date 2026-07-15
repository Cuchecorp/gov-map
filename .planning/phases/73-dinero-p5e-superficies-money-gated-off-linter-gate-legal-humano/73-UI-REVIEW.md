# Phase 73 — UI Review (superficies MONEY, gated OFF)

**Audited:** 2026-07-14
**Baseline:** 73-UI-SPEC.md (design contract, 6-pillar acceptance; mirrors 68-UI-SPEC voto)
**Screenshots:** not captured — no dev server on :3000/:5173/:8080. MONEY surfaces render ONLY behind `moneyPublicEnabled()` (default OFF); per phase context this is a static code audit. Pixel-level render, focus-ring, and the "comprensible" cold-read verdict are deferred to the BrowserOS operator gate (gated-preview, flag ON local only).
**Verdict:** ADVISORY — non-blocking. **PASS on all 6 pillars.**

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Verbatim MONEY legend single-sourced + mounted 1× above `Intro()` on all 4 surfaces; RUT-vs-name never conflated; zero causal verbs (linter-enforced). |
| 2. Visuals | 4/4 | Zero cómputo (no monto sum, no ranking, no %); monto VERBATIM `font-mono`; `null → "No publicado"` never `$0`; no voto data on `/contraparte`; `mt-12` lane boundary intact. |
| 3. Color | 4/4 | HARD rule met: zero red/green/destructive/hardcoded on any surface; single `amber-700` is the permitted "candidatura anterior" caveat; petróleo reserved for links/nav. |
| 4. Typography | 4/4 | monto/fecha/código/corte in `font-mono` verbatim (22 occurrences); `h2→h3` hierarchy; 44px touch targets on pagination + `fuente oficial ↗`; `ProvenanceBadge` aria-label. |
| 5. Spacing + Gate | 4/4 | 8-point scale; `mt-12` sibling lane boundary (19 in pages); gate deny-by-default verified — OFF ⇒ sections ABSENT + `#financiamiento-pendiente` rail / `notFound()` first-statement on `/contraparte`; anti-flip guard present + biting. |
| 6. Provenance + RUT-vs-name | 4/4 | `ProvenanceBadge` (fuente/fecha/enlace) + fecha de corte per row; `Elección:` per row (defense in depth); "por RUT" only on ChileCompra, "por nombre confirmado" on SERVEL; third-party RUT never rendered (21.719). |

**Overall: 24/24**

---

## Top 3 Priority Fixes

None are blocking. The three items below are the only friction observed — all cosmetic/optional, none violate a LOCKED rule.

1. **`ProvenanceBadge` staleness threshold is hard-coded at 48h in `esStale`, not surfaced per-source** — WARNING (low). MONEY sources (ChileCompra/SERVEL) refresh far slower than the parliamentary sources the badge was built for, so nearly every real MONEY row will render amber ">48h" once data lands. That is honest (not "current") but risks amber fatigue that dilutes the freshness signal. — *Fix (post-flip, optional): allow a per-source freshness window or a neutral "corte al {fecha}" primary with amber reserved for true anomalies. Defer; verify against real data at the BrowserOS gate.*

2. **Cold-read "comprensible" verdict is unverifiable statically** — WARNING (process). Pillar 6's comprehension gate ("a cold reader understands each contract/contribution + provenance + RUT-vs-name basis without any impression of wrongdoing") requires the deployed, gated-preview page. Code strongly supports a pass (legend precedes data, neutral counts, no severity color), but the verdict itself must come from the operator. — *Fix: run the BrowserOS gated-preview cold read (flag ON local only) before the human flip; do not treat this static PASS as the comprehension sign-off.*

3. **`/contraparte` aportes row has no "no data" fallback line for a fully-null row** — WARNING (cosmetic). In `aportes-por-contraparte.tsx` the receptor line renders only `if (a.candidato_nombre_verbatim)`; a row where the RPC returns a null candidato shows the `<dl>` fields but no receptor sentence at all (vs. an explicit "Campaña no publicada"). Consistent with the "never invent" stance, but slightly less honest-explicit than the sibling surfaces' `"… no publicado"` fallbacks. — *Fix (optional): render an explicit muted "Campaña no publicada." when the verbatim is null, matching the `"Proveedor no publicado"` / `"Donante no publicado"` pattern of the other surfaces.*

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **Legend single-source + verbatim.** `app/lib/money-presentacion.ts:23` holds `LEYENDA_ANTI_INSINUACION_MONEY` byte-identical to the contract §Leyenda ("Un contrato o un aporte registrado es un hecho público observable… ni afirmamos que un aporte compre una decisión."). All four surfaces import it and render via a local `LeyendaMoney()` — never inlined/duplicated.
- **Placement correct.** Legend is the FIRST child of every state branch, ABOVE `Intro()`, on all four surfaces (e.g. `contratos-de-parlamentario.tsx:211,229,243`; `financiamiento-de-parlamentario.tsx:339,360,374`; both `/contraparte` surfaces:199/212, 245/259). The honest frame precedes any datum in every branch.
- **Headings non-possessive (LOCKED).** "Contratos del Estado asociados al RUT" / "Aportes de campaña registrados en SERVEL" — no "del parlamentario"/"sus aportes" anywhere.
- **RUT-vs-name never conflated.** Contracts render "Enlazado por RUT al parlamentario." (`contratos-de-parlamentario.tsx:157`); aportes render "Asociado por nombre confirmado al candidato." (`financiamiento-de-parlamentario.tsx:201`) and cut-line "Consultado por nombre del candidato" (`:223`). The SERVEL surface's own copy never says "por RUT"; the shared legend's generic "vínculo por RUT" is a negated concept, subtracted in the RTL asserts (per 73-02-SUMMARY), not suppressed.
- **Zero causal verbs, linter-enforced.** `anti-insinuacion-guard.test.ts:119-167` adds the MONEY prohibited list ("financió", "a cambio de", "compró su voto", "soborno", "coima", "corrupción", "empresa ligada a", "influencia", "captura", "contrato a dedo", "direccionado", …) with exact accents + Spanish word boundaries. Mutation self-check (`:302`) injects `<p>esta empresa financió su voto a cambio de un contrato</p>` and asserts it bites; no-false-positive guards confirm "Enlazado por RUT" (`:378`) and `empresa_ligada_por_rut` snake_case (`:388`) do NOT trip.
- **Empty/error states honest.** Three honest states (contracts/aportes ficha) / two (contraparte, WR-01 — no ingesta marker per contraparte so no false "verified zero"); RPC error THROWS (`throw new Error(...)` in every Section) → route boundary, never degraded to "sin contratos"/"sin aportes". No empty state reads "limpio"/"✓".

### Pillar 2: Visuals (4/4)

- **Zero cómputo.** No monto summation, no ranking, no %. The only aggregate is a neutral count ("{N} contrato(s) registrado(s)."). Contraparte uses the RPC's real `conteo` (not `filas.length`, which may be capped) so the count is truthful even when the row list is bounded.
- **Monto VERBATIM.** `{c.monto ?? "No publicado"}` in `font-mono` on every surface; grep confirms zero `$0` literals. A null monto is "No publicado", never "$0", never an empty cell.
- **No voto on `/contraparte`.** Neither contraparte surface imports or renders any voto data; the page docstring and lane structure enforce it. The `mt-12` sibling boundary means a money datum never shares a `<section>`/`<li>`/`<tr>` with voto/lobby/patrimonio.
- **Subject discipline.** Contracts foreground the proveedor/organismo as a fact; the link to the parlamentario is a muted SEPARATE line — never a possessive that ties the contract to a person. Aportes foreground the donante; the candidato receptor is a muted separate fact.

### Pillar 3: Color (4/4) — HARD rule PASS

- **Zero severity color.** Grep across all four surfaces for `text-red|text-green|bg-red|bg-green|text-destructive|bg-destructive|#hex|rgb(` → **NONE**. A contract/aporte is never painted "bad"/"clean".
- **Amber correctly scoped.** The single `amber` in the surfaces is `financiamiento-de-parlamentario.tsx:398`, the "Aporte de una candidatura anterior … No corresponde al mandato actual." caveat — temporal, not moral, exactly as the contract permits. The other amber path lives in `ProvenanceBadge` (stale >48h freshness only).
- **Empty = neutral.** Empty states use `text-muted-foreground`, never a "green sin contratos ✓".
- **Petróleo reserved.** `text-primary` / `border-[--primary]` only on pagination links, the legend rail, and focus — links/nav/focus, per contract.

### Pillar 4: Typography (4/4)

- **Verbatim in mono.** monto, fecha de orden/aporte, código de orden, fecha de corte, "Página N de M", and the elección group header all in `font-mono` (22 occurrences across the four files).
- **Hierarchy.** `h2` (carril heading, `text-xl font-semibold`) → `h3` (elección group, `text-sm font-semibold font-mono`); no re-leveling. `encabezadoEleccion` avoids the "Elección Elección 2021" duplication defect on verbatim values.
- **a11y.** 44px touch targets (`min-h-[44px]`) on Anteriores/Siguientes and the `fuente oficial ↗` link path; `ProvenanceBadge` carries `aria-label="Fuente oficial: {source} (abre en nueva pestaña)"` and `rel="noopener noreferrer"`; `safeExternalHref` degrades `javascript:`/`data:` to no-link.

### Pillar 5: Spacing + Gate (4/4)

- **Lane boundary intact.** `mt-12 scroll-mt-6` on every MONEY `<section>` (19 across the two pages), each a SIBLING never nested with voto/lobby/patrimonio. 8-point scale throughout (`gap-1/2/3`, `mb-1/2/4`, `mt-4/6`, `py-4`).
- **Gate deny-by-default — VERIFIED (the load-bearing item).**
  - Ficha: `#dinero` and `#financiamiento` are wrapped in `{moneyPublicEnabled(process.env) && (…)}` (`parlamentario/[id]/page.tsx:393,420`) → with OFF the nodes are ABSENT from the HTML. In their place, `{!moneyPublicEnabled(...) && <section id="financiamiento-pendiente" className="mt-12 scroll-mt-6 opacity-60">}` renders "Financiamiento y contratos del Estado — Pendiente de revisión legal (Ley 21.719) antes de publicarse." (`:456-467`). Citizen sees the section exists and why — never silence read as "sin dinero".
  - `/contraparte`: `if (!moneyPublicEnabled(process.env)) { notFound(); }` is the FIRST statement of the page (`contraparte/[id]/page.tsx:50-51`) → entire route 404s, zero contraparte HTML.
  - Defense in depth: every `Section` re-checks the gate and returns `null` even though the page already gated.
- **Gate reads only via the function.** No route reads `MONEY_PUBLIC_ENABLED` raw. `money-gate.ts:33` is `=== "true"` (fail-closed, `import "server-only"`, no `NEXT_PUBLIC_` prefix).
- **Anti-flip guard present + biting.** `money-antiflip-guard.test.ts` (12 tests) freezes three vectors — fail-closed default, `.env.example=false`, no-raw-env-in-route — with an in-memory mutation self-check. `.env.example:64` is `MONEY_PUBLIC_ENABLED=false`; the gate is still OFF. Agent did NOT flip.
- **Linter extended.** `anti-insinuacion-guard.test.ts:102-108` scopes the four surfaces + `contraparte/[id]/page.tsx`; the ficha page is already in scope.

### Pillar 6: Provenance + Freshness + RUT-vs-name (4/4)

- **ProvenanceBadge per row** on all four surfaces (fuente via `sourceLabel(origen)`, `fecha_captura`, `enlace`), reused single-source — no bespoke badge.
- **Per-row cut date, distinct from capture:** "Consultado por RUT, corte al {fecha}" (contracts), "Consultado por nombre del candidato, corte al {fecha}" (aportes ficha), "Consolidado, corte al {fecha}" (contraparte) — always `font-mono`.
- **Elección per row** is load-bearing and always present in both aportes surfaces (defense in depth); the ficha caveat for a prior candidacy is conservative (never labels "anterior" unless the current period is derivable — `esGrupoAnterior`).
- **RUT-exacto vs nombre discipline held:** "empresa ligada"/"por RUT" language lives ONLY on the RUT-exact ChileCompra surface; the SERVEL by-name surface never inherits it. Third-party RUT of donante/proveedor is never rendered (Ley 21.719; the RPC does not project it).
- **Never old-as-current:** null capture → "Sin fecha de actualización"; null monto → "No publicado".

---

## Registry Safety

`components.json` present (shadcn initialized). 73-UI-SPEC §Registry Safety declares **zero third-party registries** — only shadcn official blocks (Badge, Tooltip via `ProvenanceBadge`, Skeleton, Accordion), all pre-installed. No `npx shadcn view/diff` needed.

**Registry audit: 0 third-party blocks checked, no flags.**

---

## Legal Gate (informational — NOT an agent act)

- `docs/legal/13-LEGAL-DOSSIER.md` written by the agent (`signoff: pending`).
- `signoff: approved` — pending human (operator) legal advisory (Ley 21.719).
- Flip `MONEY_PUBLIC_ENABLED=true` — exclusive human act, POST sign-off. NOT this run; anti-flip guard blocks any agent flip.

---

## Files Audited

- `app/lib/money-presentacion.ts` (single-source legend)
- `app/lib/money-antiflip-guard.test.ts` (anti-flip CI guard)
- `app/lib/anti-insinuacion-guard.test.ts` (extended MONEY linter)
- `app/lib/money-gate.ts` (chokepoint — read-only)
- `app/components/contratos-de-parlamentario.tsx`
- `app/components/financiamiento-de-parlamentario.tsx`
- `app/components/contratos-por-contraparte.tsx`
- `app/components/aportes-por-contraparte.tsx`
- `app/components/provenance-badge.tsx`
- `app/app/parlamentario/[id]/page.tsx` (gate OFF `#financiamiento-pendiente` rail)
- `app/app/contraparte/[id]/page.tsx` (gate OFF `notFound()` first statement)
- `docs/legal/13-LEGAL-DOSSIER.md` (signoff: pending)
- `.env.example` (`MONEY_PUBLIC_ENABLED=false`)

**Test evidence:** `pnpm vitest run` on the 4 surfaces + 2 guards → **94/94 pass** (18 contratos-ficha, 27 financiamiento, 10 contratos-contraparte, 11 aportes-contraparte, 16 anti-insinuacion, 12 anti-flip).
