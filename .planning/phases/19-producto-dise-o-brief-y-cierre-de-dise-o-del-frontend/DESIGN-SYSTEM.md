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
