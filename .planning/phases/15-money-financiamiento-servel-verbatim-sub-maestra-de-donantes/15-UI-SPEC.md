---
phase: 15
slug: money-financiamiento-servel-verbatim-sub-maestra-de-donantes
status: draft
shadcn_initialized: true
preset: existing project design system (mirrored, not re-initialized)
created: 2026-06-19
---

# Phase 15 — UI Design Contract

> Visual and interaction contract for the MONEY "Financiamiento de campaña" (SERVEL) section
> on the parlamentario ficha. Component: `app/components/financiamiento-de-parlamentario.tsx`.
> This contract MIRRORS the just-shipped Phase 14 `contratos-de-parlamentario.tsx` and the
> siblings `lobby-de-parlamentario.tsx` / `patrimonio-de-parlamentario.tsx`. It introduces NO
> new design language. Every token below is the project's existing token.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized in repo — `app/components/ui/*`) |
| Preset | not applicable — mirror existing components, do NOT re-init |
| Component library | Radix-based shadcn primitives (Tooltip, Table, Skeleton already in use) |
| Icon library | none new — inline glyphs only (`↗`, `·`, `—`, `⚠`) as siblings do |
| Font | inherited project font; `font-mono` for dates/codes/amounts only |

**Reused components (import, do not recreate):**
- `ProvenanceBadge` (`@/components/provenance-badge`) — per-row provenance + frescura amber.
- `IdentityMarker` (`@/components/identity-marker`) — "identidad no verificada" inline marker.
- `fechaCorta` (`@/lib/format`) — date formatting.
- `sourceLabel` (`@/lib/types`) — extend with a SERVEL branch (see Data Contract).
- `createServerSupabase` (`@/lib/supabase`), `moneyPublicEnabled` (`@/lib/money-gate`).
- Pagination `<nav>` block, `<dl>` field discipline, `Intro()` pattern — copy verbatim shape.

---

## Spacing Scale

Declared values (must be multiples of 4) — identical to siblings:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1` field rows, inline baseline gaps |
| sm | 8px | `gap-2` / `gap-y-2` row internals |
| md | 12px | `gap-x-3` row column gap, `py-3`/`py-4` row vertical rhythm |
| lg | 16px | `mb-4` intro/count spacing, `gap-x-4` `<dl>` columns |
| 2xl | 48px | **`mt-12` carril boundary** — the anti-insinuation lane separator (LOCKED) |

Exceptions: touch targets `min-h-[44px]` on all pagination links (icon/text tap target),
matching siblings exactly. No other exceptions.

---

## Typography

Inherited from siblings; declare the exact roles this section uses (no new sizes/weights):

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Section heading (`<h2>`) | `text-xl` (20px) | `font-semibold` (600) | default |
| Subject / field value | `text-base` (16px) | regular (400) | default ~1.5 |
| Label / muted metadata | `text-sm` (14px) | regular (400) | default |
| Date / amount / code | `text-sm`–`text-base` `font-mono` | regular (400) | default |

Two weights only: 400 (regular) + 600 (semibold, headings). No third weight.

---

## Color

Identical to siblings — semantic CSS vars, NO severity color (LOCKED anti-"máquina de sospechas").

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `background` / `foreground` | surface + primary text |
| Secondary (30%) | `text-muted-foreground` | labels, intro, neutral counts, all metadata |
| Accent (10%) | `text-primary` + `underline` | links only (pagination, "fuente oficial ↗") |
| Frescura-only amber | `text-amber-700` / `border-amber-400` | ONLY inside `ProvenanceBadge` staleness + the "periodo anterior" caveat line |

Accent reserved for: pagination links and the provenance "fuente oficial ↗" link. NOTHING else.

**HARD color rules (LOCKED):**
- NO red/green. NO "verificado = green ✓", NO "no-ingestado = red". The three honest states are
  distinguished by TEXT, not color. A donor is never colored.
- Amber is FRESHNESS ONLY (and the period-anterior caveat), never judgment, never severity.
- Empty/zero states get muted text, never a positive/green "limpio" affordance.

---

## Copywriting Contract

This section has **NO CTA, NO destructive action, NO form** (read-only ficha section). The
copywriting contract is the honesty contract: the three states + the period treatment + the
donor framing. Heading is non-possessive (LOCKED).

| Element | Copy |
|---------|------|
| Section heading (`<h2>`) | `Aportes de campaña registrados en SERVEL` — NEVER possessive ("del parlamentario"/"de {nombre}"/"sus aportes"). Mirrors the contratos non-possessive rule. |
| Intro line 1 | `Aportes a campañas electorales registrados por el Servicio Electoral (SERVEL), asociados por RUT exacto a este candidato. Se muestran tal como los publica la fuente; la asociación es por RUT y no implica juicio sobre el aporte ni sobre quien aporta.` |
| Intro line 2 (attribution) | `Fuente: SERVEL — Aportes de campaña (términos de uso por verificar). Cada aporte se muestra con su elección/periodo, fecha y enlace.` |
| Neutral count | `{N} aporte registrado` / `{N} aportes registrados` (singular/plural). The ONLY aggregate. NO sum of amounts, NO ranking, NO %, NO "total aportado". |
| State — no-ingestado (empty A) | `Aún no hemos ingerido los aportes de campaña de este candidato desde SERVEL. Esto no significa que no existan aportes — los datos de SERVEL se están incorporando.` |
| State — verificado-sin-aportes (empty B) | `Consultamos SERVEL por el RUT de este candidato (corte al {fecha}) y no se registran aportes de campaña asociados a ese RUT a esa fecha.` |
| Per-row period label | `Elección: {nombre/periodo electoral verbatim}` — see Period Treatment. |
| Period-anterior caveat (amber) | `Aporte de una candidatura anterior ({periodo}). No corresponde al mandato actual.` Rendered only when the contribution's election predates the current mandate. |
| Donor row subject | `Aporta: {donante_nombre verbatim}` + `(persona natural)` / `(persona jurídica)` muted tag. |
| Donor→candidate link line (separate, muted) | `Asociado por RUT al candidato.` — NEVER possessive, NEVER fused with the donor into a personal attribution. |
| Error state | NOT a copy string — a real RPC/DB error is THROWN at the route boundary (`throw new Error(...)`), never degraded to "sin aportes". Mirrors contratos `#34`. |
| Destructive confirmation | not applicable — no destructive actions in this section. |

**Forbidden vocabulary (LOCKED — anti-"máquina de sospechas"):**
- NO causal language: "a cambio de", "para", "financió su campaña para", "antes de votar", "que resultó en".
- NO affinity/relation: "cercano a", "vinculado a", "su financista", "aliado de", "donante habitual".
- NO judgment adjectives: "millonario", "cuantioso", "polémico", "sospechoso", "opaco", "elevado".
- NO computed aggregates: "total aportado", "% de su campaña", "monto total", ranking of donors.
- NO insinuation that an aporte reveals the parlamentario's politics — the donor is its own subject.

---

## Layout

Single `<section id="financiamiento" className="mt-12">` SIBLING of `#dinero` (contratos),
NEVER nested. `mt-12` is the lane boundary. An aporte and a vote/contract/lobby/declaración
NEVER share an `<article>`/`<li>`/`<tr>`.

```
<section id="financiamiento" mt-12>          ← rendered ONLY when moneyPublicEnabled (gate in page.tsx)
  <h2>Aportes de campaña registrados en SERVEL</h2>   ← non-possessive, absent from HTML when gate OFF
  <Suspense fallback={<FinanciamientoSkeleton/>}>
    <FinanciamientoSection/>                  ← Server Component: gate re-check → RPC → marcador → View
      Intro (2 muted lines: frame + SERVEL "términos por verificar" attribution)
      ── state branch ──
      [no_ingestado]            → intro + honest empty A line (never "sin aportes ✓")
      [verificado_sin_aportes]  → intro + honest empty B line WITH fecha de corte
      [enlazado]                → intro + neutral count + GROUPED list + pagination
```

**Enlazado list — grouped by election (period treatment, LOCKED constraint #2):**

```
<ul>
  ┌ group: Elección {periodo} ───────────────────────────  ← <h3>/labeled group header, mono periodo
  │   <li> AporteFila                                        ← one contribution
  │   <li> AporteFila
  └ group: Elección {periodo anterior} ──────────────────
      [amber caveat: "Aporte de una candidatura anterior…"]  ← group-level, once per prior-period group
      <li> AporteFila
      <li> AporteFila
</ul>
```

Grouping is by `eleccion`/`periodo` (verbatim from SERVEL), most-recent period first. Within a
group, contributions are ordered by `fecha` DESC. **Every row ALSO carries its own `Elección:`
label** (defense in depth) so a single row lifted out of context still shows its period — a prior
contribution can NEVER appear attributed to the current mandate without its date/period.

**AporteFila (one contribution row)** — mirrors `ContratoFila` structure exactly:

```
<li flex flex-wrap items-start gap-x-3 gap-y-2 py-4 border-t first:border-t-0>
  <div flex flex-col gap-1 min-w-0 flex-1>
    {/* SUBJECT = the donor (verbatim), text-base prominent */}
    <span>Aporta: {donante_nombre}  <muted>(persona natural | persona jurídica)</muted></span>

    {/* Link line — SEPARATE, muted, never possessive, never fused */}
    <span muted>Asociado por RUT al candidato.</span>

    {/* Verbatim literal fields as <dl> NOUN-label + value (NO computation) */}
    <dl grid sm:grid-cols-[max-content_1fr] gap-x-4>
      <dt muted>Elección:</dt>        <dd>{eleccion/periodo verbatim}</dd>   ← LOAD-BEARING, always present
      <dt muted>Fecha del aporte:</dt> <dd font-mono>{fecha_aporte | "Fecha no publicada"}</dd>
      <dt muted>Monto:</dt>            <dd font-mono>{monto verbatim | "No publicado"}</dd>
      <dt muted>Tipo de aporte:</dt>   <dd>{tipo verbatim | "No publicado"}</dd>   ← if SERVEL publishes it
    </dl>

    {/* fecha de corte por fila, muted, distinct from fecha de captura */}
    <span muted>Consultado por RUT, corte al <mono>{fecha_corte}</mono>.</span>
  </div>

  {/* ProvenanceBadge per row, MANDATORY (amber = frescura only) */}
  <span ml-auto><ProvenanceBadge capturedAt sourceName={sourceLabel(origen)} sourceUrl={enlace}/></span>
</li>
```

**Donor identity marker:** if the donor's RUT/identity is NOT internally confirmed (donor is a raw
SERVEL subject, not collapsed to a ficha), the donor name is plain verbatim text — NO link to any
donor page (no dead link to the future Phase 16 aggregation), and `IdentityMarker` MAY be appended
when SERVEL's donor identity is ambiguous. The donor RUT is internal/deny-by-default and is NEVER
rendered (Ley 21.719 sensitive-data: an aporte can reveal political affiliation).

**Amount rendering:** `monto` is shown verbatim as published (`font-mono`). The UI NEVER sums,
ranks, or computes %. If SERVEL does not publish a fixed amount for a row → "No publicado", never
a fabricated or zero amount.

---

## States (all three honest states — visually + textually distinct)

Derived SERVER-SIDE, mirroring `ContratosEstado`. Type:

```ts
type FinanciamientoEstado = "no_ingestado" | "verificado_sin_aportes" | "enlazado";
```

| State | Trigger | Render | Honesty rule |
|-------|---------|--------|-------------|
| `no_ingestado` | no row in `financiamiento_ingesta_estado` for this parlamentario (or internal RUT not populated — IDENT-10 debt) AND 0 aportes | Intro + empty-A copy | "no-ingestado" — absence of query ≠ absence of aportes. NEVER "sin aportes". |
| `verificado_sin_aportes` | marcador present, 0 aportes | Intro + empty-B copy WITH `fecha de corte` | "verificado" — we asked, dated, none found. Distinct from no_ingestado by the presence of a fecha de corte. NEVER green/✓. |
| `enlazado` | ≥1 aporte enlazado por RUT-exacto | Intro + neutral count + grouped list | "verificado" + has data. Each row dated + period-labeled. |

**Mapping to CONTEXT's three labels:** CONTEXT names the states `verificado` / `no-verificado` /
`no-ingestado`. Here `no_ingestado` = CONTEXT "no-ingestado"; `verificado_sin_aportes` + `enlazado`
are both the CONTEXT "verificado" surface (we consulted SERVEL, with fecha de corte). A row whose
RUT match is NOT exact-confirmed is **never emitted** (sin match → sin atribución, per CONTEXT and
the Phase 9 `EnlaceConfirmado` RUT-only invariant), so a "no-verificado" *attributed* row never
reaches the UI — that is the contract that prevents a misattributed aporte. If a donor's identity is
unconfirmed, the DONOR (not the link) carries `IdentityMarker`; the candidate link stays RUT-exact.

**Empty NEVER reads as "clean":** both empty states use muted explanatory prose, no checkmark, no
green, no "0 ✓". The word "verificado" is never paired with a reassuring visual.

---

## Loading State

`FinanciamientoSkeleton` in `page.tsx`, shape-matched to the View (intro line + attribution line +
3 contribution rows), identical pattern to `ContratosSkeleton`:

```tsx
<div className="space-y-4" aria-hidden="true">
  <Skeleton className="h-4 w-3/4" />        {/* intro line */}
  <Skeleton className="h-3 w-1/2" />        {/* attribution line */}
  {Array.from({ length: 3 }).map((_, i) => (
    <Skeleton key={i} className="h-12 w-full rounded-lg" />
  ))}
</div>
```

---

## Exposure Gate (LOCKED constraint #6 — gate-off behavior)

The ENTIRE `<section id="financiamiento">`, **heading included**, is wired in `page.tsx` EXACTLY
like the Phase 14 contratos section. Follow the contratos gate pattern precisely:

```tsx
{moneyPublicEnabled(process.env) && (
  <section id="financiamiento" className="mt-12">
    <h2 className="text-xl font-semibold mb-4">
      Aportes de campaña registrados en SERVEL
    </h2>
    <Suspense fallback={<FinanciamientoSkeleton />}>
      <FinanciamientoSection id={id} searchParams={sp} />
    </Suspense>
  </section>
)}
```

**Gate-off behavior (default, MONEY_PUBLIC_ENABLED unset/"false"):**
- The entire `<section>` node, INCLUDING `<h2>Aportes de campaña…`, is ABSENT from the rendered HTML.
- Do NOT rely on `FinanciamientoSection` returning `null` to hide the heading — the heading lives in
  `page.tsx` inside the `moneyPublicEnabled(...) &&` guard, so it never reaches the DOM when OFF.
- `FinanciamientoSection` ALSO re-checks `moneyPublicEnabled(process.env)` at its top and returns
  `null` (double-candado with RLS deny-by-default), so no Supabase read happens when OFF — mirror of
  `ContratosSection` lines 297–299.
- `moneyPublicEnabled` is server-only; NEVER read `MONEY_PUBLIC_ENABLED` raw (chokepoint WR-02).
- Placement: SIBLING immediately AFTER the `#dinero` (contratos) section block in `page.tsx`.

---

## Data Contract (for planner/executor — RPC + marcador shape)

Mirrors the contratos data flow. Exact table/column/RPC/migration names are Claude's discretion
(CONTEXT §Claude's Discretion); the SHAPE the View consumes is fixed here:

- **RPC** (security-definer, RUT-exact filter, order period DESC then fecha DESC), e.g.
  `financiamiento_de_parlamentario(p_id)` returning rows with at least:
  `eleccion` (verbatim period, **non-null** — the load-bearing field), `donante_nombre` (nullable →
  "Donante no publicado"), `tipo_persona` (nullable), `monto` (nullable verbatim string, never a
  computed number), `fecha_aporte` (nullable), `tipo_aporte` (nullable), `origen`, `fecha_captura`,
  `fecha_corte`, `enlace`. The RPC NEVER projects the donor RUT or any internal/PII column.
- **Marcador**: `financiamiento_ingesta_estado` keyed by `parlamentario_id` with `ingestado_hasta`
  (fecha de corte) + `fecha_captura`; ABSENCE of row = `no_ingestado`. Read via `.maybeSingle()`.
- **`sourceLabel` extension**: add a SERVEL branch to `app/lib/types.ts` →
  `if (o.includes("servel")) return "SERVEL";` so `ProvenanceBadge.sourceName` reads "SERVEL".
- **Attribution string is SERVEL "términos por verificar"** — NOT CC BY 4.0. Do NOT reuse the
  `AtribucionCcBy` helper from patrimonio. Render a plain muted line (see Intro line 2).
- **Pagination**: server-driven `?financiamientoPage=N`, `PAGE_SIZE = 20`, href anchored
  `#financiamiento`, identical `<nav>` block to siblings.
- **Purity**: `FinanciamientoView` is PURE (props) for RTL fixture testing; `FinanciamientoSection`
  is the Server Component (gate → RPC → marcador → derive state → View). NO `"use client"`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Tooltip, Table, Skeleton (already vendored in `app/components/ui/`) | not required — pre-existing in repo |
| third-party | none | not applicable |

No new registry components. No `npx shadcn add`. Everything is composed from existing primitives
and existing project components.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: heading non-possessive; 3 honest states textually distinct; empty never "clean"; forbidden vocab absent; donor framed as own subject
- [ ] Dimension 2 Visuals: row structure mirrors ContratoFila; ProvenanceBadge per row; period grouped + per-row period label; gate-off removes heading from HTML
- [ ] Dimension 3 Color: no red/green; amber = frescura only; accent = links only
- [ ] Dimension 4 Typography: 3–4 sizes, 2 weights; mono for dates/amounts/codes
- [ ] Dimension 5 Spacing: mt-12 carril; 44px tap targets; sibling rhythm
- [ ] Dimension 6 Registry Safety: PASS (no third-party)

**Approval:** pending
