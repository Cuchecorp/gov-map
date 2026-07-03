---
phase: 51
slug: leg2-legibilidad-profunda
status: draft
shadcn_initialized: true
preset: "Slate baseline (app/components.json) + Geist + cream/petróleo tokens"
created: 2026-07-02
extends: phases/44-legibilidad-auditoria-plan/UI-SPEC.md
design_system: phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md
---

# Phase 51 — UI Design Contract · LEG2 Legibilidad profunda

> Visual and interaction contract for LEG2. This phase **extends** the F44 UI-SPEC (F45/F46 navigation + patrimonio chart) and obeys `DESIGN-SYSTEM.md` (CLOSED). It re-opens **no** locked decision. Where the tables below repeat a token, it is inherited verbatim for the executor's convenience, not re-decided.
>
> **Zero new dependency.** Everything here is reuse: Radix Accordion, Recharts 3.9.0, lucide-react, and existing domain components are already installed in `app/`. No shadcn init, no third-party registry, no new icon set.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `app/components.json`, Slate baseline) |
| Preset | Slate baseline extended by cream/petróleo tokens (DESIGN-SYSTEM §1, LOCKED) |
| Component library | Radix UI (`@radix-ui/react-accordion@1.2.14`, separator, slot, tooltip — all shipped) |
| Icon library | Inline Unicode glyphs (↗ · en-dash) primary; `lucide-react@^1.20.0` only if an icon is unavoidable |
| Font | Geist Sans (prose/UI) + Geist Mono (dates, boletín, IDs, amounts) |
| Chart library | Recharts `3.9.0` (already shipped for F46; no new chart in this phase) |
| New dependencies | **none** |

---

## Spacing Scale

Inherited verbatim from DESIGN-SYSTEM §3 (8-point, all multiples of 4). No new tokens in this phase.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1` | Icon gap, chip inner padding, en-dash spacing |
| sm | 8px | `gap-2` | Chip gaps in header, summary-line dot separators |
| md | 16px | `gap-4` / `mb-4` | Heading → body, resumen line spacing, card padding rhythm |
| lg | 24px | `p-6` | Patrimonio card padding, "¿dónde está hoy?" block padding |
| xl | 32px | `md:px-8` | Desktop horizontal page padding, footer inner padding |
| **2xl** | **48px** | **`mt-12`** | **Carril boundary between sibling `<section>` — LOCKED anti-insinuación frontier, NEVER collapsed** |
| 3xl | 64px | `py-16` | Page vertical padding |

**Exceptions:** touch-target minimum **44px** (`min-h-11`) on all interactive controls added this phase — the "Comparar" button, the lobby vista toggle, "Ver detalle"/"ver todas" links, and footer links. This is the DESIGN-SYSTEM §3 touch-target exception, not a new value.

**Frontier rule (LOCKED, load-bearing):** every domain section on the ficha (`#votos`, `#lobby`, `#patrimonio`, `#cruces`, MONEY honest-state) stays a sibling `<section class="mt-12">`. Aggregation, collapse, and "ver detalle" all happen **inside** a single carril. Nothing in this phase merges two carriles or collapses the `mt-12` gap.

---

## Typography

Inherited verbatim from DESIGN-SYSTEM §2 (exactly 4 ramp sizes + 1 display, exactly 2 weights). No new role introduced.

| Role | Size | Weight | Line Height | Tailwind | Usage in this phase |
|------|------|--------|-------------|----------|---------------------|
| Heading (h1) | 30px | 600 | 1.2 | `text-3xl font-semibold leading-tight` | Ficha page title (header — enriched, not restyled) |
| Section (h2) | 20px | 600 | 1.3 | `text-xl font-semibold` | Carril headings; **"¿Dónde está hoy?"** block heading |
| Sub-item (h3) | 16px | 600 | 1.4 | `text-base font-semibold` | Patrimonio card title, lobby contraparte-group title, proyecto-arc title |
| Body | 16px | 400 | 1.5 | `text-base leading-relaxed` | Resumen lines, prose, verbatim extracts, footer prose |
| Label / meta | 14px | 400 | 1.4 | `text-sm` | Chips, provenance, caveats, "Ver detalle" affordance, count suffixes |
| Mono (metadata) | 14px | 400 | 1.4 | `font-mono text-sm` | Dates ("Presentada el {fecha}"), boletín, conteo tallies (`28–15`), "hace N días", ranges |

**Mono rule (applies to every new tally this phase):** any count range, date, "N de M" attendance, or vote tally (`72–79`) renders in Geist Mono with an **en-dash** (`–`), never a hyphen-minus, never editorialized. Prose stays Geist Sans.

**Heading hierarchy is sacred:** h1 (page) → h2 (carril / "¿dónde está hoy?") → h3 (arc / card / contraparte group) never skips. The CarrilAccordion `<h2>` lives in the always-visible header (F45 pattern — unchanged).

---

## Color

Inherited verbatim from DESIGN-SYSTEM §1 (60/30/10 cream · warm surface · petróleo). No new color. No destructive action exists (read-only product).

| Role | Value (light) | Usage in this phase |
|------|---------------|---------------------|
| Dominant (60%) | `hsl(40 33% 97%)` `--background` | Page + "¿dónde está hoy?" block canvas |
| Secondary (30%) | `hsl(40 30% 99%)` `--card` / `hsl(40 20% 93%)` `--muted` | Patrimonio card surface, resumen-line band, footer band, accordion header |
| Accent (10%) | `hsl(183 38% 26%)` `--accent-product` | See reserved-for list below |
| Destructive | `hsl(0 72% 42%)` `--destructive` | **Unused** — no irreversible action on any surface this phase |

**Accent (petróleo) reserved-for in this phase (EXPLICIT — never "all interactive elements"):**
1. Text-link underline + hover on "Ver detalle" / "Ocultar detalle", "ver todas", vista toggle, footer links, and per-event "Ver fuente oficial ↗".
2. The global keyboard focus ring (`--ring`, petróleo) on the comparator selects + "Comparar" button.
3. The active state of the lobby vista toggle (which view is current).

**Accent is NOT used for:** section headings, the "¿dónde está hoy?" block, count numbers, tallies, civic/chamber identity, the attendance chip, provenance, or any decorative fill.

**Civic tokens (data identity, never brand — INVARIANT):** `--camara` / `--senado` identify chamber only; the vote-outcome palette (A favor / En contra / Abstención / Pareo / Ausente) is a literal factual palette in existing `VotacionBar`/`VotoRow`. This phase adds no new civic color and never uses a civic color as chrome/link.

**Provenance / caveat colors (unchanged):** `ProvenanceBadge` stale >48h → amber (shown, never hidden). `IdentityMarker` / historical caveat → amber. The lobby identity caveat (SC6) reuses the shipped `--identity-warn-*` amber, once per section.

---

## Copywriting Contract

Chilean Spanish, neutral-factual, sober. Every string below respects the DESIGN-SYSTEM §6 fenced banned-vocabulary (no causal / affinity / score / ranking-as-verdict / conflict-conclusion language) and the anti-insinuación doctrine. Microcopy is Claude's Discretion (CONTEXT.md) — the strings below are the **prescribed** wording; the executor may vary punctuation/placeholders but not register or meaning.

### Global (template fields)

| Element | Copy |
|---------|------|
| Primary CTA (this phase) | **"Comparar"** (patrimonio comparator submit — the only form action added) |
| Empty state — no consultado | "Esta fuente aún no ha sido consultada para este parlamentario." (inherit §7) |
| Empty state — consultado sin resultados | "No hay {votaciones / reuniones de lobby / declaraciones} registradas en las fuentes consultadas." (inherit §7) |
| Error state | "No pudimos cargar este dato. Intenta recargar la página." (inherit §7; throw #34 pattern) |
| Destructive confirmation | Not applicable — no destructive action exists on any surface. |

### SC1 — Votos agregados por proyecto (`#votos`)

| Element | Copy |
|---------|------|
| Arc summary line (collapsed default) | `"Votó en {N} ocasiones sobre este proyecto: {a} a favor · {b} en contra · {c} ausente, entre {mesInicioAAAA} y {mesFinAAAA}."` — counts + range computed in the Server Component from the arc's already-fetched rows (Mono for `{N}`/tallies/range). Omit a sense that is zero (e.g. no "· 0 ausente"). |
| Detail affordance (closed) | "Ver detalle" (link, petróleo underline) → `?votosVer={boletin}` |
| Detail affordance (open) | "Ocultar detalle" → removes `votosVer` for that boletín |
| Honest-state (idea null) | Keep the existing **once-per-section** line in `ProyectoGrupo`; **delete** the per-row "De qué trata: no disponible aún" dead code (B24). Never repeat honesty per row. |

### SC2 — "¿Dónde está hoy?" + timeline dos niveles (`/proyecto/[boletin]`)

| Element | Copy |
|---------|------|
| Block heading | **"¿Dónde está hoy?"** (h2; neutral factual question, allowed) |
| Etapa line | `"Etapa: {etapa} · {estado}"` |
| Último hito line | `"Último hito: {descripción} — {fecha}"` (fecha Mono) |
| Urgencia vigente line | `"Urgencia {tipo} vigente desde el {fecha} (hace {N} días)."` — derived from the last "hace presente" with no later "retira"; `{N}`/`{fecha}` Mono. |
| Omission rule | If any of the three data points is not derivable, **omit that line entirely**. Never fabricate; never show "—" as if it were data. |
| Urgency collapse line (B19) | `"Urgencia {tipo} renovada {N} veces entre {mesX} y {mesY} — ver todas."` → expand server-driven (`?urgencias={periodo}` or equivalent searchParam). Only urgency pairs ("retira"/"hace presente") collapse; every structural milestone stays visible, no pagination. |
| Provenance (SC7) | ONE `ProvenanceBadge` in the timeline section heading. Each event keeps its own **"Ver fuente oficial ↗"** link. Do not render a badge per event. |

### SC3 — Patrimonio tarjeta-resumen (`#patrimonio`)

| Element | Copy |
|---------|------|
| Card title | `"Declaración de {tipoDeclaracion}"` (h3) |
| Card date | `"Presentada el {fecha}"` (Mono, prominent — DESIGN-SYSTEM §6) |
| Card counts | `"{n} {categoría}"` per category (e.g. "12 inmuebles · 3 vehículos · 5 valores") — reuse `seriePatrimonio` transform (same source of truth as the F46 chart), Mono for counts. |
| URI rule | Any field whose value is a CPLT URI is **excluded from both card and detail** — never rendered as a value. Traceability stays via `ProvenanceBadge` / source link. |
| Detail affordance | "Ver detalle" → `?ver={versionId}` (existing pattern). The full `<dl>` never renders inline in the card. |
| Historical caveat | Keep the shipped amber `HistoricalCaveat` on older versions ("Refleja el patrimonio declarado en esa fecha…"). |

### SC4 — Comparador cableado (`#patrimonio`)

| Element | Copy |
|---------|------|
| Form label | **"Elige dos fechas para comparar"** |
| Selects | Two native `<select>` of version presentation-dates (Mono option labels). Native GET form → builds `?comparar=A,B`. Zero client JS. |
| Submit button | **"Comparar"** (petróleo, `min-h-11`) |
| < 2 versions | Omit the form entirely; keep the existing neutral fact **"Se necesita más de una versión para comparar."** — zero contradiction with the label. |
| Comparison table | Unchanged: data-only, CERO veredicto/delta; absent field = "No declarado en esta versión" (F12 pattern). |

### SC5 — Rebeldías honestas (`#votos`)

| Element | Copy |
|---------|------|
| Section framing | `"Votó distinto a su bancada en {N} votaciones."` (Mono for `{N}`). Absences are **excluded** from this count (RPC-side). |
| Per-row | `"{título del proyecto} — {etapa} · {fecha}"` (título hydrated by the adjusted RPC; deduped per votación). |
| Absence disclosure (if separated, not excluded) | If absences are shown separately: `"Ausente en {M} votaciones."` as a distinct line — never blended into "votó distinto". |
| Honest-state | If zero rebeldías: "No se registran votaciones en que haya votado distinto a su bancada, en las fuentes consultadas." |

### SC6 — Lobby agrupado por contraparte (`#lobby`)

| Element | Copy |
|---------|------|
| Default view | Grouped by contraparte, ordered by frequency DESC. Group line: `"{contraparte} — {N} reuniones: {fechas}"` (h3 for contraparte, Mono for `{N}`/fechas). |
| Identity caveat (B11) | ONE note at the top of the section: **"Las contrapartes se muestran tal como las registra la fuente; su identidad no está verificada."** Remove the per-row `IdentityMarker`. Contraparte stays raw text, NEVER linked (RPC emits no contraparte_id). |
| Vista toggle | Two links: **"Agrupar por contraparte"** (default, active) · **"Ver en orden cronológico"** → `?vista=cronologica`. The active view is marked with the petróleo active state. |
| Chronological view | Existing paginated view (`?lobbyPage`), preserved unchanged behind the toggle. |

### SC7 — Provenance por sección

Covered in SC2 (timeline) and per-carril: ONE `ProvenanceBadge` in a section heading where today 100+ identical badges appear; per-datum traceability preserved by keeping the source link on each event/row. No badge deleted from a place that had exactly one.

### SC8 — Footer global (`app/layout.tsx`)

| Element | Copy |
|---------|------|
| Attribution line | `"Datos de fuentes públicas del Congreso de Chile, con fuente, fecha y enlace en cada dato."` |
| License | `"Contenido bajo CC BY 4.0 — atribución a Observatorio del Congreso 360."` **Scope caveat:** this global CC BY line covers the site's own compilation; it must NOT contradict per-dataset attributions that stay in their sections (ChileCompra "mención de la fuente", SERVEL "términos de uso por verificar"). Do not restate those non-CC-BY datasets in the global footer. |
| Links | "Metodología" → `/metodologia` · "Sobre el proyecto" → `/sobre` · "Contacto" → mailto or contact line. Create `/metodologia` and `/sobre` as minimal honest pages if absent. |
| Trust line reuse | Optionally render the LOCKED trust line "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad." (DESIGN-SYSTEM §6). |

### Header enrichment (SC1 §2.1 — `ParlamentarioHeader` + resumen)

| Element | Copy |
|---------|------|
| Territory line | `"{región} · Distrito {distrito}"` (diputado) or `"{circunscripción}"` (senador) — from `parlamentario_publico` (already emitted). |
| Period line | `"Período {periodo}"` (Mono). |
| Attendance chip (resumen above-fold) | **"Presente en {N} de {M}"** (Mono for `{N}`/`{M}`) — derived from vote data / `contarCarriles`, shown as a chip in the resumen, NOT the accordion. |
| Forbidden | NO photo, NO partido chip (LEGAL-03) — unchanged. |

---

## Component Inventory

All components are **shipped** (reuse) or **extended** in place. Nothing new is introduced beyond thin server-side helpers and two minimal pages. Radix, Recharts, and lucide are already installed.

| Component / file | Action | Notes |
|------------------|--------|-------|
| `votos-por-parlamentario.tsx` (`VotosView`, `agruparPorProyecto`, `ProyectoGrupo`, `VotosSection`) | **Extend** | Render one summary line per arc; "Ver detalle" via `?votosVer`; keep honest-state once per section. |
| `voto-ficha-row.tsx:86-89` | **Delete dead code** | Remove per-row "De qué trata: no disponible aún" (B24); refactor mención path if it still consumes `VotoFichaMencionRow`. |
| `timeline-view.tsx` / `timeline-event.tsx` + `proyecto/[boletin]/page.tsx` `TimelineSection` | **Extend** | Two-level: structural milestones always visible; urgency pairs collapsed with server-driven expand; ONE ProvenanceBadge in heading + per-event source link kept. |
| NEW `EstadoActualBlock` (server component) | **Add** | "¿Dónde está hoy?" — first element after project header, before `#idea-matriz`. Derives etapa/último hito/urgencia; omits non-derivable lines. |
| `patrimonio-de-parlamentario.tsx` (`VersionRow`, `BienesDeVersion`, `seriePatrimonio`, `DeclaracionComparacion`) | **Extend** | `VersionRow` → summary card (fecha + tipo + counts from `seriePatrimonio`); URIs excluded; "Ver detalle" via `?ver`; add native GET comparator form. |
| `lobby-de-parlamentario.tsx` (`LobbyView`, `LobbySection`, `agruparAudiencias`, `ContraparteCruda`) | **Extend** | Grouped-by-contraparte default (freq DESC); `?vista=cronologica` toggle; identity caveat once at top; remove per-row `IdentityMarker`. |
| `rebeldias_de_parlamentario` RPC (`0019` → new migration) | **Adjust** | Drop+recreate (42P13): exclude/separate absences, hydrate título, dedupe per votación. Re-emit double revoke + grant (DEFAULT PRIVILEGES gotcha). Stays SECURITY DEFINER `set search_path=''`. Already in `PUBLIC_RPC_ALLOWLIST` — no allowlist change. Apply remoto + pgTAP = operator checkpoint. |
| `ParlamentarioResumen` / `ParlamentarioHeader` | **Extend** | Territory + period in header; attendance chip in resumen. |
| `carril-accordion.tsx` | **Reuse unchanged** | Frame per carril; never imports domain sections; `mt-12` intact. |
| `ProvenanceBadge` / `IdentityMarker` / `EtapaBadge` | **Reuse unchanged** | Canonical traceability/identity primitives. |
| `app/layout.tsx` | **Extend** | Add global `<footer>` after `{children}`; keep `PUBLIC_INDEXABLE` noindex gate untouched. |
| NEW `/metodologia`, `/sobre` pages | **Add if absent** | Minimal honest content pages linked from footer. |

---

## Interaction Contracts (server-driven — no client state)

Every "detalle"/toggle is a `searchParams` round-trip rendered server-side (extends the shipped `?ver=` / `?votosPage` / `?lobbyPage` / `?materia` pattern). Zero new client island; the only client boundary remains the shipped `CarrilAccordion` island. The comparator is a native `<form method="get">`.

| Control | Mechanism | Param | Default state |
|---------|-----------|-------|---------------|
| Votos "Ver detalle" per arc | link | `?votosVer={boletin}` | collapsed (summary line only) |
| Urgency "ver todas" | link | `?urgencias={periodo}` (or equiv.) | collapsed (one line per period) |
| Patrimonio "Ver detalle" | link | `?ver={versionId}` | card only (no inline `<dl>`) |
| Patrimonio comparator | native GET form (2 `<select>` + submit) | `?comparar=A,B` | form shown if ≥2 versions, else omitted |
| Lobby vista toggle | link | `?vista=cronologica` | grouped-by-contraparte (freq DESC) |

**Bounded-fetch note (Claude's Discretion):** lobby grouping and vote-arc summaries compute in the Server Component from all rows for that parlamentario (bounded: hundreds). If the RPC must be paged in batches to fetch "all rows", resolve it server-side without changing the public RPC contract.

---

## Anti-insinuación Invariants (HARD — negative-match enforced)

Inherited from DESIGN-SYSTEM §8; the ones load-bearing for this phase:

1. **Carril frontier LOCKED.** Aggregation/collapse happens *inside* one `<section class="mt-12">`. No unit merges two carriles; the `mt-12` gap is never collapsed, even when a section is empty.
2. **Never composite.** A vote is never placed in the same `<article>`/`<Card>`/`<li>`/`<tr>` as a lobby meeting, declaration, contract, or contribution — no summary line, card, or footer composes money/lobby with a vote.
3. **Neutral counts only.** Every tally added (vote senses, meeting counts, attendance, rebeldías) is a neutral observable fact in Mono. No SUM-as-verdict, no ranking, no "el peor/mejor", no percentage-as-score, no affinity.
4. **Honesty once per section.** The 3 honest states (no consultado / sin resultados / error) stay distinct and appear **once per section**, never per row (this is the whole point of deleting B24 dead code).
5. **Identity guard.** Contrapartes stay raw text + a single section-level identity caveat, never linked. Names link to a ficha only if `estado_vinculo = confirmado`.
6. **PII never rendered.** RUT, partido, email, family data never reach the DOM or the LLM (LEGAL-03). Header enrichment adds region/distrito/period only — never partido, never photo.
7. **Provenance never lost.** Consolidating badges to one-per-section keeps a source link on every datum; traceability moves to the link, it is never removed.
8. **Attribution per dataset.** Global footer CC BY 4.0 covers the compilation only; ChileCompra/SERVEL non-CC-BY attributions stay in their sections and are not contradicted.
9. **Banned vocabulary.** All new copy passes the DESIGN-SYSTEM §6 fenced negative-match (no "porque / a cambio de / influyó / afinidad / puntaje / ranking de los peores / conflicto de interés …").

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (Slate) | none new this phase (Radix Accordion already installed via F45) | not required |
| Third-party registries | **none declared** | not applicable |

No third-party block enters the contract. Vetting gate not triggered.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
