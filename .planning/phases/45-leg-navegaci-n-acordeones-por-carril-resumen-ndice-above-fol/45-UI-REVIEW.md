# Phase 45 — UI Review

**Audited:** 2026-06-26
**Baseline:** 45-UI-SPEC.md (LOCKED, §1/§6) + DESIGN-SYSTEM.md (§3/§6/§7/§8 CLOSED)
**Mode:** STATIC code+test audit — no running app / no screenshots (build+deploy is a deferred operator checkpoint). Pixel/animation/contrast items flagged "needs live verification (operator)", not failures.
**Status:** ADVISORY (non-blocking).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Voice/honest-states excellent; index-chip labels diverge from accordion-header titles (scannability). |
| 2. Visuals | 4/4 | Clean h1→h2→h3, conteo-in-header, header not sticky → anchors land clean. |
| 3. Color | 4/4 | Accent-product reserved-for respected (chip hover/focus only); civic tokens untouched; no hardcoded hex. |
| 4. Typography | 4/4 | h2 = `text-xl font-semibold`; conteo in `font-mono tabular-nums`; within the 4-size ramp. |
| 5. Spacing | 4/4 | `mt-12` carril frontier intact on every `<section>`; never moved to wrapper; `min-h-11` touch targets. |
| 6. Experience Design | 4/4 | 3 honest states + WR-02 graceful degrade + shape-matched skeletons + reduce-motion + forceMount SSR + gates absent-from-HTML. |

**Overall: 23/24**

---

## Top 3 Priority Fixes (all advisory)

1. **Index-chip labels ≠ accordion-header titles** — the above-fold chip says "Declaraciones de patrimonio" / "Contratos del Estado" / "Aportes de campaña" while the carril header says "...e intereses" / "...asociados al RUT" / "...registrados en SERVEL". A reader scanning the index then the section sees two different names for one carril. *Fix:* make chip label a deliberate truncation of the header (or share one constant) so the index and the section read as the same carril.
2. **Skeleton placeholder count hardcoded to 5 (CRUCES ON + MONEY OFF)** — `ResumenSkeleton`/`CarrilesSkeleton` use `length: 5`. Correct for today's prod gate config; if CRUCES flips OFF (4 carriles) the skeleton→content swap produces a layout shift. *Fix:* derive the count from the same gate predicates (`crucesPublicEnabled`/`moneyPublicEnabled`) the real list uses, or document the coupling as a gate-change checklist item.
3. **`abrePorDefecto` opens EVERY data carril, not "the first with data"** — UI-SPEC §1.2.4 names the conservative default as "todos colapsados salvo el primero con datos". Current heuristic opens all carriles with `tipo === "dato"`, which can leave several panels expanded at once. Defensible (each is genuine data, not fabricated density) but a literal divergence from the stated conservative default. *Fix:* product decision — confirm "open all dense carriles" is intended, or restrict to the first/highest-count carril per the spec wording.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Editorial voice ES neutral throughout; no banned vocabulary (§6 fenced list) in any label or copy.
- Money headers carry NO possessive: "Contratos del Estado asociados al RUT", "Aportes de campaña registrados en SERVEL" — exact, source-framed (DESIGN-SYSTEM §6 / §8.8). PASS.
- MONEY-OFF honest-state copy verbatim and legal: "Pendiente de revisión legal (Ley 21.719) antes de publicarse." (page.tsx:301). PASS.
- 3 honest states textually distinct: `dato`→n, `vacio`→"sin registros", `no_ingerido`→"—", `pendiente`→"pendiente" (parlamentario-resumen.tsx:34-52; conteoLabel page.tsx:56-67 mirrors it). Negative-density test asserts no "limpio/impecable/transparente" leakage. PASS.
- **WARNING (justifies 3/4):** chip labels in `construirChips` (parlamentario-resumen.tsx:106-141) are shorter than the carril header titles in page.tsx (lines 156, 191, 241, 267). Cosmetic, not a contract breach, but it weakens the index↔section scent-of-information.

### Pillar 2: Visuals (4/4)
- `<h2>` lives in the accordion header via `Header asChild` → `<h2><Trigger></h2>` (carril-accordion.tsx:41-55); heading is ALWAYS visible even collapsed. Test 2 confirms heading present with `defaultOpen=false`.
- Conteo rendered in-header so the reader decides what to open without opening it (§1.2.3). Rotation glyph is `aria-hidden="true"`.
- Resumen is a labelled `<nav aria-label="Índice de secciones">` placed after header, before first carril (page.tsx:103-105 → CarrilesSection). PASS §1.1 placement.
- Global header is NOT sticky/fixed (no `sticky`/`fixed top` in the tree) → `href="#..."` jumps land on the visible carril header without being hidden under chrome. No `scroll-mt` needed today.
- Needs live verification (operator): real layout on cream, multi-panel-open page length, focus-ring contrast.

### Pillar 3: Color (4/4)
- Accent (`--accent-product`) used ONLY on chip hover + focus-visible outline (parlamentario-resumen.tsx:75-77) — within §1.2 reserved-for (focus ring / interactive affordance). Not applied to headings, borders, or data.
- No hardcoded hex/rgb; only `var(--accent-product)` token references.
- Civic tokens and section content untouched (sections passed as `children`, never re-styled). PASS §1.3 invariant.

### Pillar 4: Typography (4/4)
- Header: `text-xl font-semibold` = the locked h2 Section role (DESIGN-SYSTEM §2). PASS.
- Conteo number: `font-mono tabular-nums` (parlamentario-resumen.tsx:37) — identifiers/counts in Mono per §2 mono-usage rule; non-data states ("sin registros"/"pendiente") in `text-xs`/`italic`, correctly NOT mono.
- Within the 4-size ramp (`text-xl`, `text-sm`, `text-xs`); 2 weights (semibold header, normal conteo). No proliferation.

### Pillar 5: Spacing (4/4)
- Every carril is `<section id className="mt-12">` (page.tsx:153,170,188,214,239,264,295). `mt-12` stays on the `<section>`, explicitly NOT moved to `CarrilAccordion` (comments lines 31-32, 147-152). Anti-insinuación frontier intact (DESIGN-SYSTEM §3/§8.1-2). PASS — the load-bearing invariant.
- One Radix `Root` per carril, single `Item value="c"` → never two domains in one accordion unit (§1.2.1 / §8.1). PASS.
- Resumen `mt-6`, chip `gap-2`, `min-h-11` 44px touch target on chips and trigger (DESIGN-SYSTEM §3 touch exception). PASS.
- Container `max-w-3xl mx-auto px-4 md:px-8` = locked reading column. PASS.

### Pillar 6: Experience Design (4/4)
- **Honest 3-state, never fabricated density:** `derivarEstado` (conteos:66-76) — total>0→dato; ingestado&0→vacio; !ingestado&0→no_ingerido. `vacio`/`no_ingerido`/`pendiente` NEVER render a digit (asserted by tests). PASS §7.
- **Failure → honest "—", never a number:** `contarCarrilesSeguro` (conteos:259-271) degrades a count failure to `conteosDesconocidos()` (all `no_ingerido` → "—") and logs; sections keep their own `#34` throw for real DB errors under their Suspense. Shell stays up; cabecera isolated in its own Suspense. PASS WR-02.
- **a11y / SSR:** `forceMount` keeps collapsed carril content in SSR HTML (`data-[state=closed]:hidden`), so the carril works without JS and content is crawlable; Test 5 asserts the wrapper never imports a Section or `createServerSupabase` (service_role never reaches client bundle — Camino A). Radix supplies keyboard/ARIA (`aria-expanded`, `data-state`, Test 3).
- **prefers-reduced-motion:** height animation gated under `@media (prefers-reduced-motion: no-preference)` (globals.css:103-111); with reduce-motion only the visibility toggle runs. Animation is non-load-bearing. PASS Pitfall-5.
- **Gates absent-from-HTML (not CSS-hidden):** CRUCES wrapped in `crucesPublicEnabled` (page.tsx:213), both MONEY carriles in `moneyPublicEnabled` (238,263), honest-state pendiente in `!moneyPublicEnabled` (294). `construirChips` mirrors the gates byte-faithfully (tests confirm CRUCES OFF → no `#cruces`; MONEY OFF → single `#financiamiento-pendiente`; MONEY ON → `#dinero`+`#financiamiento` each with its OWN count, never combined). PASS §8.6.
- **Skeletons shape-matched, never spinners** (page.tsx:369-493). PASS §7 skeleton rule.
- WR-03 (documented dormant debt): votos count capped at `p_limit: 1000`; >1000 would show "1000" as exact. Mirrors `VotosSection` byte-for-byte so chip and section never desync; real fix = dedicated count RPC (F46+, out of F45 allowlist scope). Accepted.

---

## Registry Safety
`components.json` exists (shadcn) but UI-SPEC lists no third-party registries; the one new dep (`@radix-ui/react-accordion`) is first-party Radix, consistent with the shipped `@radix-ui/*` set. Registry audit: 0 third-party blocks checked, no flags.

---

## Allowlist / Lockdown (Camino A) verification
- All RPCs the conteos module calls — `votos_de_parlamentario`, `lobby_de_parlamentario`, `declaraciones_de_parlamentario`, `cruces_de_parlamentario`, `contratos_de_parlamentario`, `aportes_de_parlamentario`, `parlamentario_publico` — are present in `PUBLIC_RPC_ALLOWLIST` (lockdown-guard.test.ts:157-173). No new RPC introduced (F45 scope). PASS UI-SPEC §3 rule.
- No `.from('parlamentario')` in the public tree; the only `.from()` calls hit non-PII markers `lobby_ingesta_estado` / `probidad_ingesta_estado`. `import "server-only"` on the conteos module keeps the service key out of the client bundle. PASS.

---

## Needs live verification (operator) — not failures
- Animation feel + reduce-motion visual behaviour (real browser).
- Focus-ring contrast of petrol accent on cream chips (keyboard nav).
- Real single-column layout with multiple carriles open at once (page length).
- Anchor-jump scroll behaviour in a real viewport.
- OpenNext/wrangler build on Docker Linux (F45 adds no charts, so client-island build risk is low; the accordion island is a thin `"use client"` wrapper).

---

## Files Audited
- app/components/carril-accordion.tsx (+ .test.tsx)
- app/components/parlamentario-resumen.tsx (+ .test.tsx)
- app/lib/parlamentario-resumen-conteos.ts (+ .test.ts)
- app/app/parlamentario/[id]/page.tsx
- app/app/globals.css (accordion keyframes + reduce-motion gate)
- app/lib/lockdown-guard.test.ts (PUBLIC_RPC_ALLOWLIST)
