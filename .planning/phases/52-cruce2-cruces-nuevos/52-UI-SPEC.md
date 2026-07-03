---
phase: 52
slug: cruce2-cruces-nuevos
status: draft
shadcn_initialized: true
preset: "Slate baseline (app/components.json) + Geist + cream/petróleo tokens"
created: 2026-07-03
extends: phases/51-leg2-legibilidad-profunda/51-UI-SPEC.md
design_system: phases/19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend/DESIGN-SYSTEM.md
---

# Phase 52 — UI Design Contract · CRUCE2 Cruces nuevos con datos ya disponibles

> Visual and interaction contract for CRUCE2 (P3). This phase **extends** the F51 UI-SPEC (which extends F44) and obeys `DESIGN-SYSTEM.md` (CLOSED). It re-opens **no** locked decision. Where the tables below repeat a token, it is inherited verbatim for the executor's convenience, not re-decided.
>
> **Zero new dependency, zero new client JS, zero carousel.** Everything is reuse: existing Server Components, `searchParams`/`.from()` patterns, `ProvenanceBadge`, format helpers, and the shipped cream/petróleo token set. No shadcn init, no third-party registry, no new icon set, no chart.
>
> **Three UI surfaces in scope** — (a) a new `mt-12` sibling carril on the **project** ficha ("Reuniones de lobby registradas en el mismo período"); (b) a new derivable **citación line** inside the shipped F51 `EstadoActualBlock` ("¿Dónde está hoy?"); (c) a **module de actualidad** on the home, 3 server-rendered blocks under the hero. The classifier corrida (SC1) and the RPC/migración 0048 (SC-security) have **no UI surface** except the honest pre-apply degrade of surface (a).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `app/components.json`, Slate baseline) |
| Preset | Slate baseline extended by cream/petróleo tokens (DESIGN-SYSTEM §1, LOCKED) |
| Component library | Radix UI (already shipped: accordion, separator, slot, tooltip). No new Radix primitive this phase. |
| Icon library | Inline Unicode glyphs (↗ source link · en-dash tallies) primary; `lucide-react` only if an icon is unavoidable (none foreseen) |
| Font | Geist Sans (prose/UI) + Geist Mono (dates, boletín, counts, tallies, semana ISO) |
| Chart library | Recharts `3.9.0` shipped — **no chart added this phase** (home shows dated facts, never trend/score) |
| New dependencies | **none** |

---

## Spacing Scale

Inherited verbatim from DESIGN-SYSTEM §3 (8-point, all multiples of 4). No new token.

| Token | Value | Tailwind | Usage in this phase |
|-------|-------|----------|---------------------|
| xs | 4px | `gap-1` | En-dash spacing in tallies, chip inner padding |
| sm | 8px | `gap-2` | Row meta separators, source-link gap |
| md | 16px | `gap-4` / `mb-4` / `space-y-4` | Heading → body, row spacing inside a carril/block |
| lg | 24px | `p-6` / `gap-6` | Lobby carril padding, home actualidad card padding + grid gap |
| xl | 32px | `md:px-8` | Desktop horizontal page padding |
| **2xl** | **48px** | **`mt-12`** | **Carril boundary on the project ficha — LOCKED anti-insinuación frontier, NEVER collapsed** |
| 3xl | 64px | `py-16` | Home vertical rhythm (hero already `py-16`/`md:py-24`) |

**Exceptions:** touch-target minimum **44px** (`min-h-11`) on every interactive control added this phase — the per-row "Ver fuente oficial ↗" links on the lobby carril and home items, and any "ver todas" affordance. DESIGN-SYSTEM §3 touch-target exception, not a new value.

**Frontier rule (LOCKED, load-bearing):** the new lobby×tramitación surface is its **own** `<section class="mt-12">` sibling on the project ficha — it is NOT nested inside `#votaciones`, `#idea-matriz`, or `EstadoActualBlock`. The `mt-12` gap between it and adjacent carriles is never collapsed, even when the section is empty or degraded. The home actualidad blocks live below the hero on `/` (not a ficha) and compose only tramitación facts among themselves — no lobby, no vote, on the home.

---

## Typography

Inherited verbatim from DESIGN-SYSTEM §2 (4 ramp sizes + 1 display, exactly 2 weights: 400 / 600). No new role.

| Role | Size | Weight | Line Height | Tailwind | Usage in this phase |
|------|------|--------|-------------|----------|---------------------|
| Section (h2) | 20px | 600 | 1.3 | `text-xl font-semibold` | Lobby carril heading; each home actualidad block heading; "¿Dónde está hoy?" (unchanged F51) |
| Sub-item (h3) | 16px | 600 | 1.4 | `text-base font-semibold` | Per-item title inside a home block (project titulo), lobby row parlamentario name |
| Body | 16px | 400 | 1.5 | `text-base leading-relaxed` | Summary lines, caveats, prose, estado-actual lines |
| Label / meta | 14px | 400 | 1.4 | `text-sm` | Materia, provenance, caveat, "Ver fuente oficial ↗", count suffixes |
| Mono (metadata) | 14px | 400 | 1.4 | `font-mono text-sm` | Dates ("el {fecha}"), boletín, `{N}` counts, vote tally (`72–79`), semana ISO |

**Mono rule (every new datum this phase):** all dates, boletines, audience counts (`{N}`), vote tallies, and semana-ISO strings render in Geist Mono with an **en-dash** (`–`) for ranges/tallies, never a hyphen-minus, never editorialized. Prose stays Geist Sans.

**Heading hierarchy is sacred:** on the project ficha h1 (page) → h2 (carril / "¿dónde está hoy?") → h3 (row/item) never skips. On the home, the hero `h1` is the display title; each actualidad block heading is an `h2`; per-item project titles are `h3`.

---

## Color

Inherited verbatim from DESIGN-SYSTEM §1 (60/30/10 cream · warm surface · petróleo). No new color. No destructive action exists (read-only product).

| Role | Value (light) | Usage in this phase |
|------|---------------|---------------------|
| Dominant (60%) | `hsl(40 33% 97%)` `--background` | Page canvas, lobby carril canvas, estado-actual block canvas |
| Secondary (30%) | `hsl(40 30% 99%)` `--card` / `hsl(40 20% 93%)` `--muted` | Home actualidad cards, lobby row band, caveat band |
| Accent (10%) | `hsl(183 38% 26%)` `--accent-product` | See reserved-for list below |
| Destructive | `hsl(0 72% 42%)` `--destructive` | **Unused** — no irreversible action on any surface this phase |

**Accent (petróleo) reserved-for in this phase (EXPLICIT — never "all interactive elements"):**
1. Text-link underline + hover on every per-item / per-row "Ver fuente oficial ↗" source link (lobby carril rows, home actualidad items).
2. The global keyboard focus ring (`--ring`, petróleo) on those same links.
3. Any "ver todas" / "ver más" affordance if a home block or the lobby carril paginates (link style only).

**Accent is NOT used for:** section/block headings, count numbers, tallies, vote-outcome identity, the caveat band, provenance badges, semana-ISO, or any decorative fill or "importance" highlight. A lobby audience is NEVER tinted to look connected to a vote or a stage.

**Civic tokens (data identity, never brand — INVARIANT):** the vote-outcome palette (A favor / En contra / Abstención / Pareo / Ausente) in the home "Votado esta semana" block reuses the existing literal factual palette (`VotacionBar`/`conteoVotacion`); this phase adds no new civic color and never uses a civic color as chrome/link. `--camara` / `--senado` identify chamber only.

**Provenance / caveat colors (unchanged):** `ProvenanceBadge` stale >48h → amber (shown, never hidden). The lobby×tramitación temporal caveat is neutral body text on `--muted`, NOT amber (amber is reserved for staleness/identity, not for the coincidence disclaimer).

---

## Copywriting Contract

Chilean Spanish, neutral-factual, sober. Every string respects the DESIGN-SYSTEM §6 fenced banned-vocabulary (no causal / affinity / score / ranking / conflict-conclusion language) and the anti-insinuación doctrine. Microcopy is Claude's Discretion (CONTEXT.md); the strings below are the **prescribed** wording — the executor may vary punctuation/placeholders but not register or meaning.

### Global (template fields)

| Element | Copy |
|---------|------|
| Primary CTA (this phase) | **None.** No form/submit is added. Every affordance is a plain source-link or a `searchParams` "ver todas" link. |
| Empty state — sin resultados | Per-surface below (distinct string per surface, once per surface). |
| Error state | "No pudimos cargar este dato. Intenta recargar la página." (inherit §7; throw #34 pattern — a real DB/network error, distinct from the RPC-not-yet-applied degrade). |
| Destructive confirmation | Not applicable — no destructive action exists on any surface. |

### SC2 — Lobby × tramitación temporal (NEW carril on `/proyecto/[boletin]`)

Carril heading + one caveat + N rows of dated juxtaposition. Anchor = the ISO week in which a comisión saw this boletín (`citacion.semana_iso` × `citacion_punto.boletin` × `lobby_audiencia.fecha`). **Never composed with any vote.**

| Element | Copy |
|---------|------|
| Section heading (h2) | **"Reuniones de lobby registradas en el mismo período"** |
| Caveat (ONCE per section, top, `--muted` band, `text-sm`) | **"Se muestran por coincidencia de fechas: en la misma semana en que una comisión vio este proyecto. La coincidencia temporal no implica relación entre la reunión y la tramitación del proyecto."** (neutral, banned-vocab-safe; no "a cambio de / influyó / gestión / presión") |
| Summary line (h2 sub, Mono for `{N}`) | `"En la misma semana en que la comisión vio este proyecto se registraron {N} reuniones de lobby."` — `{N}` computed from the RPC rows. If the same boletín was seen in more than one ISO week, group per week and repeat the summary line per week: `"Semana {semanaISO} · comisión {comisión}: {N} reuniones."` (semana Mono). |
| Per-row | `"{nombre del parlamentario} — {materia}"` (parlamentario name h3-weight; materia `text-sm`), then a Mono meta line `"Reunión registrada el {fecha} · semana {semanaISO}"`. Only parlamentarios with `estado_vinculo = confirmado` are emitted by the RPC; the name is plain text (NOT linked to a ficha in this carril — juxtaposition context, not attribution). |
| Per-row provenance | **"Ver fuente oficial ↗"** link (petróleo underline, `min-h-11`) → `enlace_detalle` from the RPC. Present on every row; traceability per datum. |
| Empty state — sin coincidencias (RPC present, 0 rows) | **"No se registran reuniones de lobby en las semanas en que una comisión vio este proyecto, según las fuentes consultadas."** (once; honest "consultado sin resultados"). |
| Degrade — RPC not yet applied (pre-checkpoint) | See "Degrade honesto" below. The carril renders **null** (node absent), never a 500, never a fabricated empty band. |

### SC3 — Citación line inside `EstadoActualBlock` ("¿Dónde está hoy?", `/proyecto/[boletin]`)

Adds ONE derivable line to the shipped F51 block. Tramitación fact — composes inside the existing estado-actual block (all tramitación), never in a lobby/vote unit.

| Element | Copy |
|---------|------|
| Citación line (new, Mono for `{fecha}`) | `"Citado en {comisión} el {fecha}."` — rendered only when there is a vigente/futura citación for this boletín (`citacion.fecha >= hoy`). If several, show the nearest upcoming one. |
| Omission rule | If no vigente/futura citación is derivable, **omit the line entirely** (mirror of the existing F51 omit-when-not-derivable rule in `derivarEstadoActual`; never "—", never fabricated). |
| Optional history | A brief past-citación list MAY appear inside the existing agenda carril of the project (same `citacion` join), Mono dates, source link per row — NOT inside `EstadoActualBlock`. Discretionary; if included, honest empty state reuses the agenda section's existing copy. |

### SC4 — Módulo de actualidad (NEW, home `/`, under the hero)

Three compact server-rendered blocks. Each degrades honestly and independently. Dated facts with source — **cero ranking / score / tendencia / "los más …"**.

| Element | Copy |
|---------|------|
| Module framing | No editorial intro. The three blocks stand on their own headings. |
| Block 1 heading (h2) | **"Votado esta semana"** |
| Block 1 item | `"{título del proyecto}"` (h3) + factual desenlace line `"El proyecto fue {resultado} {si}–{no}."` (tally Mono, en-dash, reuse `conteoVotacion`) + Mono date `"Votación del {fecha}"` + "Ver fuente oficial ↗". `{resultado}` null → omit the desenlace phrase, keep the dated fact. NEVER a per-parlamentario slant, NEVER "quién ganó". |
| Block 1 empty | **"Sin votaciones registradas esta semana en las fuentes consultadas."** |
| Block 2 heading (h2) | **"Urgencias vigentes"** |
| Block 2 item | `"{título del proyecto} — urgencia {tipo} vigente desde el {fecha}."` (fecha Mono; reuse the F51 `urgenciaVigente` derivation) + boletín Mono + link to the ficha. Present-tense factual; no "el gobierno apura / presiona". |
| Block 2 empty | **"No hay urgencias vigentes registradas esta semana."** |
| Block 3 heading (h2) | **"Última actualización de datos"** |
| Block 3 item | `"{fuente}: actualizada el {fecha}."` (fecha Mono) — max `fecha_captura` per fuente. One line per fuente. This is data-freshness transparency, NOT activity ranking. |
| Block 3 empty | **"Aún no hay registros de actualización disponibles."** |
| Whole-module fallback | Each block renders its own empty state independently. The module is never hidden wholesale; freshness (block 3) is expected to always have data. |

### Anti-insinuación copy invariants (this phase)

- The lobby carril caveat appears **once per section**; the coincidence disclaimer is mandatory and never softened into implication.
- No home item ranks, scores, or ratios parlamentarios/proyectos ("el más votado", "quien más se reunió", "% de …"). Counts are neutral observable facts in Mono.
- The lobby carril composes lobby with **tramitación dates only**, never with a vote, a tally, a declaration, or a contract. No row places a reunión and a voto in the same `<article>`/`<li>`/`<tr>`.
- Provenance link on every lobby row and every home item; a datum without a source link does not ship.

---

## Component Inventory

All components are **shipped** (reuse) or **added** as thin Server Components. Nothing new is introduced beyond server-side helpers, one new RPC-backed carril, one new home module, and one new derivable line. Zero new client island; zero new dependency.

| Component / file | Action | Notes |
|------------------|--------|-------|
| NEW `LobbyEnTramitacionSection` (server component) | **Add** | Own `<section id="lobby-tramitacion" class="mt-12">` sibling carril on `app/app/proyecto/[boletin]/page.tsx`. Calls RPC `lobby_en_tramitacion(p_boletin)`. Renders caveat + per-week summary + rows + per-row source link. **Degrade honesto** on RPC-not-applied (render null). Placement: a sibling carril after the tramitación/timeline carril; never nested. |
| `estado-actual-block.tsx` (`derivarEstadoActual`, `EstadoActual`, `EstadoActualView`, `EstadoActualBlock`) | **Extend** | Add optional `citacionVigente?: { comision: string; fecha: Date }` to `EstadoActual`; derive it from a `.from("citacion_punto")` × `citacion` query by boletín (nearest `fecha >= hoy`); render the SC3 line only when present (omit otherwise). Query added inside `EstadoActualBlock` (`Promise.all`), a real read error throws #34. |
| NEW `ActualidadModule` (server component) + 3 sub-blocks (`VotadoEstaSemana`, `UrgenciasVigentes`, `UltimaActualizacion`) | **Add** | Rendered in `app/app/page.tsx` below the hero `<section>`, inside `<main>`. Each sub-block a `--card` panel (`rounded-lg border p-6`), laid out `grid gap-6 md:grid-cols-3` (stacked on mobile). Direct `.from()` reads (votacion / tramitacion_evento / proyecto / citacion — all non-PII, guard-permitted) with bounded `.limit()` + `React.cache`. Zero RPC nueva, zero client JS. |
| `app/app/page.tsx` | **Extend** | Add `export const dynamic = "force-dynamic"` (F50 gotcha: static-baked route with live data). Render `<ActualidadModule>` below the hero; hero pills + copy LOCKED unchanged. |
| `ProvenanceBadge` | **Reuse unchanged** | One badge per home block heading where appropriate; per-row/per-item source link kept (traceability moves to the link, never removed — SC7 doctrine from F51). |
| `conteoVotacion` / vote-tally helper + `fechaCorta` / `relativeTimeEs` (`app/lib/format`) | **Reuse unchanged** | En-dash Mono tallies for the home "Votado esta semana" desenlace; Mono dates everywhere. |
| RPC `lobby_en_tramitacion(p_boletin text)` (migración 0048) | **Add (no direct UI)** | SECURITY DEFINER, `set search_path=''`, emits ONLY public fields (fecha, parlamentario nombre confirmado, materia, enlace, semana_iso coincidente, comisión). Double revoke + zero grant (idiom 0047), added to `PUBLIC_RPC_ALLOWLIST` in the same commit. pgTAP acompañante. Apply remoto = operator checkpoint (accumulable with 0047). The UI consumes it via `LobbyEnTramitacionSection` and degrades honestly pre-apply. |
| `carril-accordion.tsx`, `EtapaBadge`, `IdentityMarker` | **Reuse unchanged** | Not restyled. The lobby carril does NOT need an accordion (it is a bounded juxtaposition list); if used, follows the F45 pattern verbatim. |

---

## Interaction Contracts (server-driven — no client state)

Every affordance is a plain `<a>` source-link or a `searchParams` round-trip rendered server-side (extends the shipped `?ver=` / `?votosPage` / `?lobbyPage` pattern). **Zero new client island.** No form, no submit, no client fetch, no carousel, no client state.

| Control | Mechanism | Param | Default state |
|---------|-----------|-------|---------------|
| Lobby carril "Ver fuente oficial ↗" (per row) | plain link | — | always visible |
| Lobby carril "ver todas" (only if rows exceed a bounded cap) | link | `?lobbyTramPage={n}` (or equiv.) | first bounded page |
| Home item "Ver fuente oficial ↗" / ficha link | plain link | — | always visible |
| Home render mode | `export const dynamic = "force-dynamic"` | — | dynamic (live data; F50 gotcha) |

**Bounded-fetch note (Claude's Discretion):** the home blocks read with explicit `.limit()` (e.g. top-N by fecha DESC for votado/urgencias; one row per fuente for freshness). The lobby carril returns bounded rows from the RPC. All computation is server-side; no public RPC contract changes for pagination.

---

## Degrade honesto — RPC `lobby_en_tramitacion` pre-apply (LOAD-BEARING)

The RPC ships in migración 0048 but is applied to PROD only at the operator checkpoint. The UI MUST render on a build where the RPC is absent, without a 500 and without fabricating an empty band. Three distinct paths:

1. **RPC not found** (function-missing — Supabase/PostgREST `PGRST202` or "function ... does not exist"): treat as "not yet available" → `LobbyEnTramitacionSection` returns **null** (node absent from HTML — mirror of the gate-OFF pattern for MONEY/cruces carriles). No heading, no band, no 500.
2. **RPC present, 0 matching rows**: render the section heading + caveat + the honest "sin coincidencias" empty state (once).
3. **Any other DB/network error**: **throw** (#34) — a real read failure is not "sin datos"; it surfaces the honest error UI. Never swallow a real error into path 1.

The executor MUST distinguish path 1 (specific missing-function code) from path 3 (any other error). Do not blanket-catch. Post-apply, path 1 disappears and the carril renders live.

---

## Anti-insinuación Invariants (HARD — negative-match enforced)

Inherited from DESIGN-SYSTEM §8 and F51 §Anti-insinuación; the ones load-bearing for this phase:

1. **Carril frontier LOCKED.** The lobby×tramitación surface is its own `<section class="mt-12">` sibling; never nested in another carril, never merged, `mt-12` never collapsed even when empty/degraded.
2. **Never composite.** A lobby audience is never placed in the same unit as a vote, tally, declaration, or contract. The lobby carril composes lobby with **tramitación dates only** (permitted juxtaposition, like agenda×proyecto). The home never places lobby next to a vote.
3. **Coincidence, not causation.** The lobby carril caveat is mandatory, once per section, and states the temporal coincidence explicitly — no "a cambio de / influyó / gestionó / presionó / afinidad". The summary line is a neutral count.
4. **Neutral counts only.** Every tally (audience counts, vote desenlace, urgency count) is a neutral observable fact in Mono. No SUM-as-verdict, no ranking, no "los más …", no percentage-as-score, on any surface — especially the home.
5. **Identity guard.** Lobby carril names are emitted by the RPC only for `estado_vinculo = confirmado`; shown as plain text in the juxtaposition context (not linked in-carril). Contrapartes are never rendered in this carril (the anchor is the parlamentario side; no contraparte identity claim).
6. **PII never rendered / never to LLM.** The classifier (SC1) runs `assertNoRutInLlmInput` first (load-bearing); the RPC emits no rut/partido/email; the home reads only non-PII tables. Region/period only if a header needs enrichment (none added here).
7. **Provenance never lost.** Every lobby row and every home item carries a source link; a datum without a source does not ship.
8. **Honesty once per surface.** The three honest states (no consultado / sin resultados / error) stay distinct and appear once per surface, never per row. The RPC-not-applied degrade (render null) is distinct from "sin resultados" and from a real error (#34).
9. **Banned vocabulary.** All new copy passes the DESIGN-SYSTEM §6 fenced negative-match (no "porque / a cambio de / influyó / gestionó / presionó / afinidad / puntaje / ranking / los peores / conflicto de interés …").
10. **No flag flipped.** No `*_PUBLIC_ENABLED` is flipped (doctrine LOCKED). The sector crosses are already LIVE; this phase only populates data and adds surfaces. The lobby carril is not gated behind a public-enable flag — it degrades on RPC presence, not on a flag.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (Slate) | none new this phase (all primitives already installed) | not required |
| Third-party registries | **none declared** | not applicable |

No third-party block enters the contract. Vetting gate not triggered. Zero new dependency of any kind.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
