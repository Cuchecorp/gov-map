# Phase 16 — UI Review

**Audited:** 2026-06-19
**Baseline:** `16-UI-SPEC.md` (approved-pending) + shipped MONEY siblings (`contratos-de-parlamentario.tsx`, `financiamiento-de-parlamentario.tsx`, `provenance-badge.tsx`)
**Screenshots:** NOT captured — no dev server on :3000 / :5173 / :8080. Code-only audit (Tailwind class audit, string/copy audit, state-handling + anti-insinuación composition audit).
**Scope note:** ADVISORY. Route is gated OFF in production (`MONEY_PUBLIC_ENABLED` default false) and shows real rows only after operator LIVE ingest. Findings apply to the enabled/populated state.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Honest-state copy verbatim to spec; zero causal/affinity vocab; attribution strings exact (ChileCompra "mención de la fuente" / SERVEL "términos de uso por verificar", not CC BY 4.0). |
| 2. Visuals | 3/4 | Rows mirror siblings; ProvenanceBadge on every row. But the spec'd confirmed-parlamentario lane (`section#enlaces`) is absent, and the header omits the muted parenthetical the Copywriting Contract declares for the subject badge. |
| 3. Color | 4/4 | Accent confined to links; amber confined to frescura inside ProvenanceBadge; zero severity/red-green on money rows; no hardcoded hex. |
| 4. Typography | 4/4 | Exactly text-xl/base/sm, two weights (normal+semibold), font-mono on every verbatim datum (monto, fechas, código, "Página N de M", elección header). |
| 5. Spacing | 4/4 | `mt-12` lane border present and load-bearing between the two sibling sections; `max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16` container identical to sibling; 44px tap targets on pagination. |
| 6. Experience Design | 2/4 | Gate + honest empty/loading states are correct, but the `#34` honest **error** state has no route `error.tsx` boundary to land in — a thrown RPC error escapes to Next's default error surface, not the sober Spanish UI the spec promises. |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **No route error boundary for the `#34` honest-error contract** (Experience Design) — On a real RPC/DB failure, `HeaderSection` / both lane Sections `throw new Error(...)`. The spec's Honest States §Error and Page Anatomy both route this to "the route error boundary (#34)" rendering sober Spanish ("No pudimos consultar este registro en este momento."). **No `app/app/contraparte/[id]/error.tsx` (or any `error.tsx` under `app/app/`) exists**, so the throw lands on Next's default/global error surface — an English stack-trace-ish fallback in dev and an unstyled generic error in prod, NOT the honest sober-Spanish UI. *Impact:* the one moment the user most needs honest framing (a DB hiccup) silently breaks the honesty contract. *Fix:* add `app/app/contraparte/[id]/error.tsx` (Client Component, `reset`) with the exact spec copy; mirror it for `parlamentario/[id]` since that sibling has the same gap. WARNING (pre-existing system pattern, but the spec explicitly names it for this route).

2. **Confirmed-parlamentario lane (`section#enlaces`) is unimplemented** (Visuals / Anatomy) — Page Anatomy declares an OPTIONAL third lane `section#enlaces.mt-12` → "Vínculos confirmados con parlamentarios" → `ConfirmedLinksSection`, with locked copy and anti-insinuación rules (#4). The page renders only `#contratos` + `#aportes`; no `#enlaces` section, no `ConfirmedLinksSection`, and the RPC's confirmed-link rows (if any) are never surfaced. *Impact:* a confirmed registry vínculo — the one fact that most needs careful, traced, vote-free presentation — has no home; it is silently dropped rather than shown as an independent traced fact. *Fix:* either implement the lane as specced (own `mt-12` section, ProvenanceBadge, no vote/money fused into the sentence) or, if the RPC never returns links in this milestone, record the deferral explicitly in the SPEC so "optional/absent" is a decision, not a silent omission. WARNING.

3. **Subject badge drops the declared muted justification line** (Copywriting / Visuals) — The Copywriting Contract specifies the `Persona jurídica` badge carries a muted clause: "entidad que contrata con el Estado o financia campañas — actividad pública fiscalizable". The page renders the badge pill with only "Persona jurídica" and moves the justification into the intro `<p>` instead. The text survives, but the badge no longer states WHY the entity is public *at the badge*, as Page Anatomy line 124 requires ("states WHY it is public"). *Impact:* minor — the legitimacy framing is one element away from the label it justifies. *Fix:* attach the muted clause to the badge cluster (or accept the relocation and update the SPEC). Advisory.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Strong pass — this is the load-bearing pillar for the phase and it holds.

- **Honest-state copy is verbatim to spec.** Contratos `no_consultado`: "Aún no hemos consolidado los contratos de ChileCompra para esta empresa. Esto no significa que no existan." (`contratos-por-contraparte.tsx:189-192`). Aportes equivalent at `aportes-por-contraparte.tsx:233-236`. Neither reads as "limpio"/"sin contratos ✓".
- **WR-01/04 two-state honesty correctly applied.** The components deliberately collapse to TWO honest states (`no_consultado` | `con_contratos`/`con_aportes`) and document WHY the third `consultado_sin_*` state was removed as dead code that would have falsely asserted a "verified-zero" the RPC can't prove (`contratos-por-contraparte.tsx:49-64`). This is *more* honest than the SPEC's three-state table — a correct divergence, not a defect. The SPEC §Honest States still lists `consultado_sin_contratos`; SPEC is now stale relative to the truer implementation (doc-sync nit, not a code defect).
- **Attribution strings exact and dataset-correct.** "Fuente: ChileCompra — Mercado Público (mención de la fuente)." (`contratos-por-contraparte.tsx:112`); "Fuente: SERVEL — Aportes de campaña (términos de uso por verificar)." (`aportes-por-contraparte.tsx:126`). Neither claims CC BY 4.0. Matches §Copywriting Contract exactly.
- **Anti-insinuación vocabulary: clean.** Grep of the two components + page for "a cambio de / favoreció / influyó / cercano / su voto / correlación / afín / financió su elección" → zero hits. Aportes intro carries the explicit disclaimer "la asociación no implica juicio" (`aportes-por-contraparte.tsx:121-124`).
- **Count line is the only aggregate, neutral, never a money sum** ("{N} contrato(s)/aporte(s) registrado(s).", `:203-209` / `:248-251`). Montos render verbatim or "No publicado" (`:145`, `:167`). Matches anti-insinuación rule #5.
- **Headings are non-possessive** ("...en que aparece esta empresa" / "...registrados a nombre de esta empresa", `page.tsx:72-73,87-88`) — never ties the empresa's money to a person's intent.

### Pillar 2: Visuals (3/4)

- **PASS:** Every contrato and aporte row carries a `ProvenanceBadge` (`contratos-por-contraparte.tsx:162-168`, `aportes-por-contraparte.tsx:182-188`), right-aligned via `ml-auto`, sourceName routed through `sourceLabel(origen)` which has live `chilecompra`/`servel` branches (`lib/types.ts:434-435`). Row `<dl>` discipline mirrors the siblings field-for-field.
- **PASS:** Clear focal hierarchy — h1 (empresa) → h2 per lane → neutral count → rows. Subject foregrounds the counterparty-side fact (Organismo comprador for contratos; Elección group header + candidato muted line for aportes), with the empresa implicit as page subject, exactly as §Row Layout requires.
- **PASS:** `donante` RUT is never rendered in the aporte row (the row maps `donante_nombre` into the type but the `AporteFila` JSX never prints it — Ley 21.719 discipline holds, `aportes-por-contraparte.tsx:133-190`).
- **WARNING — confirmed-link lane absent.** See Priority Fix #2. `section#enlaces` / `ConfirmedLinksSection` / heading "Vínculos confirmados con parlamentarios" do not exist anywhere in `app/`.
- **WARNING — badge justification relocated.** See Priority Fix #3. Badge pill is label-only; the "actividad pública fiscalizable" clause lives in the intro `<p>` (`page.tsx:131-141`) rather than on the badge.
- Minor: aporte `fila_id` uses array index in its composite key (`aportes-por-contraparte.tsx:344`) — acceptable for a server-ordered, non-reordering list; matches the sibling's documented approach.

### Pillar 3: Color (4/4)

- Accent (`text-primary`) appears ONLY on links: pagination `Anteriores`/`Siguientes` (`:225,238` / `:276,289`) and the not-found "Volver al inicio" link. No `text-primary`/`bg-primary` on any row container. Matches §Color "accent reserved for hyperlinks only".
- Amber is fully delegated to `ProvenanceBadge` frescura (`provenance-badge.tsx:44`); neither contraparte component introduces `text-amber-*`. The sibling financiamiento's amber "candidatura anterior" caveat is correctly N/A here (page subject is the empresa, not a candidate) and is absent.
- No severity / red-green / magnitude coloring of money rows. Zero hardcoded hex or `rgb()` in either component.

### Pillar 4: Typography (4/4)

- Sizes in use across both components: `text-xl` (lane h2), `text-base` (dd values), `text-sm` (dt labels, intro, count, captions). Exactly the four roles in §Typography; no stray `text-lg`/`text-2xl`+.
- Weights: `font-semibold` (h2, elección group h3) + default normal. Two weights, as declared.
- `font-mono` on every verbatim datum: monto, fecha de la orden, código de la orden, fecha de corte (`contratos-por-contraparte.tsx:145-156`); monto, fecha del aporte, "Página N de M", and the elección group header (`aportes-por-contraparte.tsx:165-176,256,283`). Verbatim data never reads as authored prose.

### Pillar 5: Spacing (4/4)

- **`mt-12` lane border present and correct** — `<section id="aportes" className="mt-12">` (`page.tsx:86`) is the anti-insinuación carril boundary; the two lanes are true siblings under `<main>`, never nested. Confirms anatomy §9.1.
- Container `max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16` (`page.tsx:62`) is byte-identical to the sibling ficha contract.
- 44px tap targets: pagination links carry `min-h-[44px]` (`:225,238` / `:276,289`) — the one declared arbitrary value, matching §Spacing Exceptions.
- Row rhythm `py-4 border-t first:border-t-0`, header `mb-12`, intro `mb-4`, group `mt-6 first:mt-0` — all multiples-of-4 tokens, consistent with siblings. No off-scale arbitrary spacing.

### Pillar 6: Experience Design (2/4)

- **PASS — page-level gate.** `if (!moneyPublicEnabled(process.env)) notFound();` is the FIRST statement, before `await params`, before any RPC/heading (`page.tsx:48-50`). Defense-in-depth: both lane Sections also short-circuit on the gate (`:262`, `:312`). `page.test.tsx` proves gate-OFF → `notFound()` before any DB read (test "gate OFF (default) → notFound() ANTES de tocar la DB"). No MONEY heading leaks into HTML when OFF — verified by composition (the whole tree is downstream of the gate) and by `not-found.tsx` containing zero MONEY strings.
- **PASS — jurídica-only.** Header 404s on `!tipo_persona.includes("jur")` (`page.tsx:122-125`), tested ("tipo_persona NO jurídica → notFound()"). Persona natural never rendered by name.
- **PASS — honest loading.** Per-lane `LaneSkeleton` shape-matched to row layout (intro + attribution + 3 blocks) wrapped in `Suspense` (`page.tsx:75,90,158-168`).
- **PASS — honest empty.** Zero rows → weak honest "aún no consolidado", never "clean" (see Pillar 1).
- **WARNING — honest error has nowhere to land.** `HeaderSection` and both lane Sections `throw new Error(...)` on RPC error (`page.tsx:106-110`, `contratos-por-contraparte.tsx:279`, `aportes-por-contraparte.tsx:329`) — correctly refusing to degrade to "sin contratos/aportes" (test "error real de RPC → THROW (no 404, no 'sin datos') (#34)"). BUT there is **no `error.tsx` anywhere under `app/app/`**, so the throw is caught only by Next's default/root boundary, not the sober-Spanish honest-error UI the SPEC (§Honest States §Error, §Copywriting "Error state") promises. The throw half of the contract is implemented; the *catch + honest render* half is missing. This is a pre-existing system-wide gap (the `parlamentario/[id]` sibling lacks `error.tsx` too), so it is consistent with the shipped system — hence WARNING, not BLOCKER — but the SPEC names this route's error boundary explicitly, so it should be closed here. See Priority Fix #1.
- Note: no destructive actions / no CTA / no forms exist on this read-only page, as §Copywriting Contract requires — correctly nothing to audit there.

---

## Registry Safety

`components.json` exists (shadcn initialized). Per §Registry Safety, Phase 16 adds **no new shadcn blocks and no third-party registries** — it consumes already-installed `tooltip` + `skeleton` via existing components. No third-party registry rows in the SPEC table.

**Registry audit: 0 third-party blocks to check, no flags.** No network/`process.env`/`eval`/dynamic-import patterns introduced by the two Phase-16 components (both are server components reading Supabase via the shared `createServerSupabase` chokepoint; no raw env reads — gate goes through `moneyPublicEnabled()` per WR-02).

---

## Files Audited

- `app/app/contraparte/[id]/page.tsx` — page gate, header, skeletons, two-lane composition
- `app/app/contraparte/[id]/not-found.tsx` — gate-OFF / unknown-id 404 surface
- `app/app/contraparte/[id]/page.test.tsx` — gate/404/throw behavioral coverage (read for evidence)
- `app/components/contratos-por-contraparte.tsx` — contratos lane (+ `.test.tsx` present)
- `app/components/aportes-por-contraparte.tsx` — aportes lane (+ `.test.tsx` present)
- `app/components/contratos-de-parlamentario.tsx` — sibling baseline (consistency reference)
- `app/components/financiamiento-de-parlamentario.tsx` — sibling baseline (consistency reference)
- `app/components/provenance-badge.tsx` — per-row badge (amber/frescura, accent confinement)
- `app/lib/types.ts` — `sourceLabel()` ChileCompra/SERVEL branches
- `app/lib/buscar.ts` — `CONTRAPARTE_ID_RE` validation
- `app/app/parlamentario/[id]/` — confirmed absence of `error.tsx` (system-wide pattern)
