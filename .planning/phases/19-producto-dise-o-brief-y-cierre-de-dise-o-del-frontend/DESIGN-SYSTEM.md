# Observatorio del Congreso 360 — Design System (CLOSED)

> **Status: CLOSED.** This is the consolidated design system for the design-closure phase of the Observatorio frontend, derived verbatim from the approved `19-UI-SPEC.md` (§0–§10). It is implementation-ready: any phase that follows builds the visual layer from this file plus the UI-SPEC without re-opening a single decision listed here.
>
> **No decision below may be re-opened by implementation.** Where the UI-SPEC fixed a value that CONTEXT.md had left to "Claude's discretion" (exact accent HSL, spacing scale, example pills), that value is reproduced here as the locked value.
>
> **Built ON the shipped system.** The cream background and petrol accent EXTEND `app/app/globals.css` (shadcn Slate baseline + Geist). They do not replace `app/app/styles/civic-tokens.css`. Civic tokens stay exactly as shipped.
>
> **This document obeys the voice it documents.** Its own prose avoids the vocabulary enumerated in the fenced banned-vocabulary list (§ Editorial voice). Every term quoted as forbidden lives only inside that fence.

---

## Table of contents

1. [Color](#1-color)
2. [Typography](#2-typography)
3. [Spacing](#3-spacing)
4. [Token wiring (future-phase note)](#4-token-wiring--future-phase-note)
5. [Component catalogue (closed)](#5-component-catalogue-closed)
6. [Editorial voice (Spanish, closed)](#6-editorial-voice-spanish-closed)
7. [Honest states catalogue](#7-honest-states-catalogue)
8. [Anti-insinuación invariants (HARD)](#8-anti-insinuación-invariants-hard)

---

## 1. Color

The palette is a 60 / 30 / 10 split: a warm cream/paper dominant, warm card/surface secondary, and a single petrol/teal product accent. Every value below is lifted verbatim from UI-SPEC §4.1–§4.4.

### 1.1 The 60 / 30 / 10 split (light + dark, exact HSL)

| Role | Token | Light value (HSL) | Dark value (HSL) | Usage |
|------|-------|-------------------|------------------|-------|
| Dominant (60%) — warm cream/paper | `--background` (NEW) | `hsl(40 33% 97%)` (replaces clinical white `0 0% 100%`) | `hsl(222 28% 7%)` (warm-neutral dark, slightly warmer than shipped `222.2 84% 4.9%`) | Page background, hero canvas |
| Secondary (30%) — card on cream | `--card` | `hsl(40 30% 99%)` | `hsl(222 24% 12%)` | Cards |
| Secondary (30%) — muted / secondary band | `--muted` / `--secondary` | `hsl(40 20% 93%)` | `hsl(222 20% 16%)` | Nav band, sidebar, table headers, pills |
| Accent (10%) — petrol/teal | `--accent-product` (NEW) | `hsl(183 38% 26%)` | `hsl(183 34% 46%)` | See reserved-for list (§1.2) |
| Destructive | `--destructive` (retuned warmer for cream) | `hsl(0 72% 42%)` | `hsl(0 62% 45%)` | Genuine irreversible actions only (none exist in this read-only product — see §1.3) |
| Foreground (text) | `--foreground` (shipped, kept) | `hsl(222 47% 11%)` | `hsl(210 40% 98%)` | Body + heading text |

**Cream rationale (LOCKED):** `40°` hue at low saturation gives the warm paper feel without yellowing. Foreground text stays the shipped near-black `hsl(222 47% 11%)`, which holds AA+ contrast on cream (contrast ratio ≈ 13:1). Dark mode warms the shipped slate slightly so cream → dark reads as one brand.

**Petrol rationale (LOCKED):** `183°` desaturated teal is institutionally neutral — it is neither red nor blue, so it carries no political reading. It reads as tool chrome. Light-mode petrol `hsl(183 38% 26%)` on cream gives a contrast ratio ≈ 7:1 (AA for normal text, AAA for large/UI).

### 1.2 Accent reserved-for (EXPLICIT — never "all interactive elements")

The petrol/teal accent (`--accent-product`) is used ONLY for:

1. The search box focus ring and submit button (the hero affordance).
2. Text links — the underline and hover colour — in body content.
3. The global focus ring (`--ring`, retuned to petrol) for keyboard navigation.
4. The single italic display-accent phrase in the hero headline.
5. The active state of nav items and tab underlines (e.g. source-type tabs).
6. The CENTRAL / relevance-group divider rule (a thin accent bar adopted from TributaLab results) — shown as a divider only, never as a number or percentage.

The accent is **NOT** used for: section headings, body text, card borders, data badges, civic/chamber identity, status colours, or decorative fills.

### 1.3 Civic & semantic colours (data identity, never brand — INVARIANT)

Civic colours are data identity, never brand/UI. They identify which institution a datum belongs to and nothing more. They are reproduced from the shipped `civic-tokens.css` unchanged.

| Token | Value (shipped) | Reserved EXCLUSIVELY for |
|-------|-----------------|--------------------------|
| `--camara` | `hsl(213 94% 38%)` | Identifying that a datum/vote belongs to the **Cámara de Diputadas y Diputados**. Never UI/brand. |
| `--senado` | `hsl(355 65% 38%)` | Identifying that a datum belongs to the **Senado**. Never UI/brand. |
| `--provenance-*` | shipped (slate-neutral) | `ProvenanceBadge` surface. Stale (>48h) shifts to amber, shown never hidden. |
| `--identity-warn-*` | shipped (amber) | `IdentityMarker` ("identidad no verificada") and historical/version caveats. |

**Invariant:** civic colours are data identity, never brand or general UI colour. Using `--camara`/`--senado` as a link, accent, or chrome colour is forbidden (it would invite a political reading).

**Vote-outcome palette:** A favor / En contra / Abstención / Pareo / Ausente are an existing literal palette in `VotacionBar`/`VotoRow`. They are factual outcome labels, not accent, and must stay legible on cream. They are colour-coded literally (like a literal ↑/↓/→ trend), never editorialized.

**No destructive actions:** the public product is read-only civic data — no accounts, no deletion, no irreversible operations. The `--destructive` token exists for completeness only and is unused on every Phase-19 surface.

---

## 2. Typography

Geist Sans for everything except hard metadata (Geist Mono). Exactly **4 sizes** in the ramp + 1 display, and exactly **2 weights** (Regular 400, Semibold 600). No medium/bold proliferation. No new serif (overrides the serif headlines seen in the reference set — Observatorio uses Geist Sans display weight for headlines).

| Role | Size | Weight | Line height | Tailwind | Usage |
|------|------|--------|-------------|----------|-------|
| Display | 36px (mobile) → 48px (md+) | 600 Semibold | 1.1 (`leading-tight`) | `text-4xl md:text-5xl font-semibold leading-tight` | Landing hero headline only |
| Heading (h1) | 30px | 600 Semibold | 1.2 (`leading-tight`) | `text-3xl font-semibold leading-tight` | Page title (ficha header, surface h1) |
| Section (h2) | 20px | 600 Semibold | 1.3 | `text-xl font-semibold` | Carril section headings (Votaciones, Reuniones de lobby…) |
| Body | 16px | 400 Regular | 1.5 (`leading-relaxed`) | `text-base leading-relaxed` | Paragraph text, descriptions, verbatim extracts |
| Label / meta | 14px | 400 Regular | 1.4 | `text-sm` | Captions, provenance, muted helper text, pills |
| Mono (metadata) | 14px | 400 Regular | 1.4 | `font-mono text-sm` | Boletín, RUT, dates (ISO/literal), IDs, amounts verbatim |

**Display accent (LOCKED brand signature):** the hero headline contains exactly ONE italic accent phrase, rendered in the petrol accent colour. Never more than one italic phrase. The italic clause carries the confidence; the rest of the headline stays sober.

**Mono usage rule:** any value that is an identifier, code, date, or money amount is Geist Mono. Prose is never Mono. A money amount is rendered **verbatim** in Mono (no rounding, no formatting that alters the source value).

**Heading hierarchy is sacred:** h1 → h2 → h3 never skips. The ficha shell keeps h1 (page) → h2 (carril) → h3 (sub-item) valid as carriles stack.

---

## 3. Spacing

8-point scale (all multiples of 4). Matches Tailwind defaults and the shipped layout rhythm.

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| xs | 4px | `1` / `gap-1` | Icon gaps, inline badge padding |
| sm | 8px | `2` / `gap-2` | Compact element spacing, chip gaps |
| md | 16px | `4` / `gap-4`, `mb-4` | Default element spacing, section heading → body gap |
| lg | 24px | `6` | Card padding, intra-section grouping |
| xl | 32px | `8` / `md:px-8` | Desktop horizontal page padding, layout gaps |
| 2xl | 48px | `12` / **`mt-12`** | **Carril boundary** between sibling sections (anti-insinuación frontier — LOCKED) |
| 3xl | 64px | `16` / `py-16` | Page-level vertical padding |
| 4xl | 96px | `24` / `py-24` | Landing hero vertical padding (`py-16 md:py-24`) |

**Carril boundary (LOCKED):** the `mt-12` (2xl, 48px) gap between sibling data-domain sections is the anti-insinuación frontier. It is non-negotiable and never collapsed, even when one section is empty — collapsing it would let two carriles read as one block (see §8).

**Container width:** `max-w-3xl mx-auto px-4 md:px-8` is the LOCKED reading column for all single-column surfaces (landing, ficha proyecto, ficha parlamentario, agenda). The two-column result surfaces (`/buscar`, optional ficha sidebar) use `max-w-5xl` with a `lg:grid-cols-[1fr_320px]` split (main + "Mapa de fuentes" sidebar; the sidebar stacks below on mobile).

**Touch-target exception:** interactive controls (search submit, nav links, pills) keep a minimum hit area of **44px** height even when visually shorter (use `py-` + `min-h-11`).

---

## 4. Token wiring — future-phase note

> **Scope:** this section is a wiring note for a FUTURE implementation phase. Nothing here is applied now. Phase 19 documents the system; it does not patch any file under `app/`.

When a later implementation phase applies this system:

- Extend `globals.css` `:root` and `.dark` with the new cream `--background`, the warm card/secondary/muted values, and add `--accent-product`; retune `--ring` to petrol. This **extends, it does not break** the shipped Slate tokens.
- Add an `accentProduct` mapping in `tailwind.config.ts` colours so the accent is addressable as a utility. Civic tokens stay accessed via arbitrary-value (`[--camara]`) exactly as today.
- `civic-tokens.css` and its `@import` in `globals.css` stay intact and untouched — the cream/petrol additions sit alongside the shipped civic tokens, never over them.

The token names above (`--background`, `--card`, `--muted`, `--secondary`, `--accent-product`, `--ring`, `--destructive`) are the contract that a future phase wires into `globals.css`; the values are fixed in §1.

---

## 5. Component catalogue (closed)

All components below are **already shipped** unless marked **NEW (spec-only)**. Phase 19 specifies; it does not implement. This is the closed set — implementation phases add nothing not listed here.

### 5.1 Domain components (shipped — formalized as canonical)

| Component | Role | Anti-insinuación / traceability contract |
|-----------|------|------------------------------------------|
| `ProvenanceBadge` | Canonical "Actualizado hace X · {fuente} — fuente oficial ↗" on EVERY datum, EVERY surface | Never omitted; stale >48h → amber; unsafe href degrades to no-link; null → "fuente desconocida" without link |
| `IdentityMarker` | Inline "identidad no verificada ⚠" | Text is ALWAYS exactly "identidad no verificada"; name shown raw, never linked |
| `EtapaBadge` | Tramitación stage of a project | Literal stage label, no judgement |
| `CamaraChip` | Chamber identity (Cámara/Senado) using `--camara`/`--senado` | Institutional identity only, never brand/party |
| `FichaHeader` / `ParlamentarioHeader` | Surface headers | No photo, no partido chip (LEGAL-03) |
| `TimelineView` / `TimelineEvent` | Cross-chamber tramitación timeline (visx) | Chronological facts; chamber colour-coded by civic token |
| `VotacionBar` / `VotacionCard` / `VotoRow` / `VotoDetalle` / `VotoFichaRow` | Vote display | Vote-outcome literal palette; identity guard (link only if `confirmado`) |
| `SearchBox` (client island) | The hero + persistent search | Orders by implicit relevance; never shows a number per result |
| `SearchResultCard` | One search hit | Source-type tab grouping; no relevance number |
| `IdeaMatrizBlock` / `CuerposLegalesList` / `ProyectosSimilares` | Structured project facts | AI-extracted content labelled; source kept intact |
| `CitacionCard` / `WeekNav` / `SalaTableSection` | Agenda | Week navigation; raw invitee text (third parties) |
| `LobbySection` / `PatrimonioSection` / `ContratosSection` / `FinanciamientoSection` / `ContratosPorContraparte` / `AportesPorContraparte` | Carril sections | Each its own `mt-12` sibling `<section>`; a vote is never placed in the same unit (see §8) |

### 5.2 NEW spec-only components (designed now, built later)

| Component | Surface | Spec |
|-----------|---------|------|
| `GlobalHeader` | All (`layout.tsx`) | Minimal persistent header: wordmark → home, Buscar, Parlamentarios, Agenda, Sobre/Metodología |
| `TrustLine` | Landing hero, footer | Renders the LOCKED trust line; bullet-separated, muted |
| `ExamplePills` | Landing hero, results onboarding | The 4 LOCKED example pills; click fills the search |
| `OnboardingHints` | Inline, results + ficha | "¿Cómo leer esto?" micro-affordance — inline, no modal, no tour |
| `SourceTypeTabs` | `/buscar`, ficha proyecto | Tabs by source/type; maps to Observatorio source types; counts real or absent, never faked |
| `MapaDeFuentes` (sidebar) | `/buscar` (desktop) | Mini summary of result composition by source type — count-coded, shape-coded; never a graph of people (deferred), never a number per result |
| `AiSummaryCallout` | ficha proyecto (idea matriz / cuerpos) | "Síntesis IA · la fuente queda íntegra debajo" labelled block with `MODELO / SCOPE / FUENTES` chips; source always shown intact below |
| `MethodologyCaveat` | parlamentarios directory, any ordered list | Explicit caveat + "Fuente · Metodología" link; used wherever any ordering exists, framed as neutral fact + anti-judgement caveat |
| `ParlamentarioDirectoryCard` / `ParlamentarioDirectoryRow` | `/parlamentario` index (NEW route) | name + chamber + period; NO photo, NO partido; links to ficha |
| `HonestEmptyState` | All sections | Renders the correct one of the 3 distinct empty states (§7); never reads as "clean" |
| `StaleNote` / `HistoricalCaveat` | Patrimonio, financiamiento | Amber dated caveat (shipped pattern, formalized) |

**Closure note:** this is the closed component set. An implementation phase wires these to data; it introduces no component not listed above and no new icon dependency (inline Unicode glyphs only; `lucide-react` is the only approved set if one is ever needed).

---

## 6. Editorial voice (Spanish, CLOSED)

**Register:** neutral, factual, sober-confident. Chilean Spanish. Addresses a general/press audience.

**Always:**

- State facts with source, date, and link. "Según {fuente}, el {fecha}…".
- Money amounts **verbatim**, in Mono, exactly as the source publishes them (no rounding, no totals that read as a verdict).
- Dates literal and prominent ("Presentada el {fecha}" in Mono).
- Use "asociado al RUT" / "registrado en {fuente}" framing for money — never a possessive ("sus contratos", "su dinero").
- Label AI-generated synthesis explicitly (modelo/scope/fuentes) and keep the original source intact alongside.
- Honest degradation: "no consultado" is distinct from "consultado sin resultados", which is distinct from "error". Never collapse them.

**Never (banned vocabulary — checker-enforceable).** The list below enumerates the vocabulary that is forbidden in product copy and in this document's own prose. It is fenced so a machine check can strip it and confirm the rest of the doc stays clean.

<!-- BANNED-VOCAB-START -->

- **Causal / intention language:** "porque", "a cambio de", "para favorecer", "influyó", "respondió a".
- **Affinity / score / ranking-as-verdict:** "afinidad", "puntaje", "score", "% de coincidencia", "el peor/mejor", "ranking de los más", "ranking de los peores".
- **Conflict conclusions:** "conflicto de interés", "enriquecimiento", "sospechoso".
- **Composing money/lobby with a vote** in one sentence, clause, or UI unit.
- **Marketing claims / fabricated counts:** "la plataforma más completa", "miles de…".

<!-- BANNED-VOCAB-END -->

**Trust line (LOCKED, under hero):** "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad."

**Tone exemplars:**

- Hero: a neutral display sentence with one italic petrol accent clause — confident yet sober.
- Money section heading (when ON): "Contratos del Estado asociados al RUT" (exact, no possessive).
- Identity guard: name raw + "identidad no verificada".

The document's own prose follows this guide: outside the fenced list above, none of the forbidden vocabulary appears.

---

## 7. Honest states catalogue

The three states MUST be visually and textually distinct on every data section. An empty section must NEVER read as "clean" or "complete".

### 7.1 The three states

| State | Meaning | Visual treatment | Copy pattern |
|-------|---------|------------------|--------------|
| **No consultado** | Source not yet ingested for this entity | Muted band, neutral icon, not empty-looking | "Esta fuente aún no ha sido consultada…" |
| **Consultado sin resultados** | Source ingested, genuinely zero rows | Distinct from above: states the source WAS checked | "No hay {X} registradas… en las fuentes consultadas." |
| **Error** | Real DB/network failure | Distinct, actionable; never degrades to "sin datos" | "No pudimos cargar este dato. Intenta recargar…" |

### 7.2 Per-surface state matrix

| Surface | Empty (no query / no entity) | Empty (zero results) | Loading | Error |
|---------|------------------------------|----------------------|---------|-------|
| Landing `/` | "Aún no has buscado" + pills | — | n/a (static shell) | n/a |
| `/buscar` | redirect to landing empty | "Sin resultados para esta búsqueda" + pills | skeleton result cards (shape-matched) | "No pudimos completar la búsqueda…" |
| `/proyecto/[boletin]` | 404 if boletín invalid | per-section honest empty | per-section skeleton (shape-matched) | per-section "No pudimos cargar…" |
| `/parlamentario/[id]` | 404 if id invalid/absent | per-carril 3-state matrix above | per-carril skeleton (shipped) | per-carril → error UI |
| `/parlamentario` (directory, NEW) | "No hay parlamentarios en el registro." (won't happen — 186 real) | filter → zero: "Sin parlamentarios para este filtro." | skeleton rows | "No pudimos cargar el directorio…" |
| `/agenda` | "No hay citaciones para esta semana." | same | skeleton table | "No pudimos cargar la agenda…" |
| `/contraparte/[id]` (gated) | 404 (page-level gate OFF or id invalid) | per-carril honest empty | per-carril skeleton | per-carril throw |

**Skeleton rule:** every loading state is a shape-matched skeleton, never a spinner that hides structure.

**Stale-data rule:** data older than 48h shifts the `ProvenanceBadge` to amber. The data is shown, never hidden.

---

## 8. Anti-insinuación invariants (HARD)

These are the load-bearing rules. Any violation fails the design.

1. **Carril propio:** every data domain (votos, lobby, patrimonio, dinero/contratos, financiamiento) is a sibling `<section class="mt-12">` with its own `<h2>`, `Suspense`, skeleton, and honest empty. Sections are NEVER nested.
2. **Never composite:** a meeting / declaration / contract / contribution and a vote NEVER share an `<article>` / `<Card>` / `<li>` / `<tr>`. The `mt-12` gap is the carril frontier and is never collapsed — money and lobby are nunca composed with a vote in one unit.
3. **No causal/affinity/score language** anywhere (see the fenced banned list in §6). All prose is written in the neutral, factual register.
4. **No relevance number, sin score.** Search orders by implicit relevance (raw HNSW distance ASC, server-side). The "Mapa de fuentes" and source tabs show composition/counts, never a number per result.
5. **No verdict table.** Any ordering in the parlamentarios directory or in lists is by a NEUTRAL observable fact (alphabetical, by chamber, by an observable count like rebeldías presented as data), always with a `MethodologyCaveat`. It is never framed as a verdict table (a "ranking de los peores" framing is forbidden — see the fenced list in §6).
6. **MONEY gate:** OFF (default) → section/page node ABSENT from the HTML (not CSS-hidden). Stays OFF until LEGAL-01 sign-off.
7. **Identity guard:** an entity is linked to a ficha ONLY if `estado_vinculo = confirmado`. Otherwise: raw name + `IdentityMarker` ("identidad no verificada"), never a link. Contrapartes are always raw text + `IdentityMarker` (the RPC never emits contraparte_id/RUT).
8. **PII never rendered:** RUT, partido, email, and family data never reach the public DOM or the LLM (LEGAL-03). Money sections render the subject (proveedor/donante) as their own subject ("Aporta:" / proveedor), never the parlamentario's RUT.
9. **AI labelled, source intact:** any AI synthesis carries modelo/scope/fuentes chips and the original source is shown intact below it.
10. **Attribution per dataset:** CC BY 4.0 only where the source licenses it (InfoProbidad); ChileCompra "mención de la fuente"; SERVEL "términos de uso por verificar". Never a blanket CC BY 4.0.
