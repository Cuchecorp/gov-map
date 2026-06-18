---
phase: 5
phase_name: "Tramitación Core — Ficha + Timeline + Votaciones"
status: draft
created: 2026-06-18
author: gsd-ui-researcher
requirements: [TRAM-04, TRAM-05, TRAM-06, TRAM-09]
---

# UI-SPEC — Phase 5: Tramitación Core

## 0. Design System Bootstrap

**Status:** No design system detected in repository (`components.json` absent; `globals.css` is bare Next.js scaffold; no Tailwind config).

**Required first executor action (before any component work):**

```bash
# From /app directory
pnpm add -D tailwindcss @tailwindcss/typography postcss autoprefixer
pnpm dlx shadcn@latest init
```

When `shadcn init` prompts:
- Style: **Default**
- Base color: **Slate** (neutral, institutional — not blue/green which read as partisan)
- CSS variables: **yes**
- TypeScript: **yes**
- Tailwind config: **yes** (create `tailwind.config.ts`)
- Components alias: `@/components`
- Utils alias: `@/lib/utils`
- RSC (React Server Components): **yes**

Then install required shadcn components:

```bash
pnpm dlx shadcn@latest add badge card separator skeleton tooltip
```

No third-party shadcn registries are used in this phase. Registry safety gate: not applicable.

---

## 1. Design Tokens

### 1.1 Color Palette

Source: shadcn Default/Slate preset CSS variables, extended with two civic semantic tokens.
All values are CSS custom properties set in `globals.css` under `:root` / `.dark`.

#### Base (shadcn Default/Slate)

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--background` | `hsl(0 0% 100%)` | `hsl(222.2 84% 4.9%)` | Page background (60% dominant surface) |
| `--foreground` | `hsl(222.2 47.4% 11.2%)` | `hsl(210 40% 98%)` | Primary text |
| `--card` | `hsl(0 0% 100%)` | `hsl(222.2 84% 4.9%)` | Card surface (30% secondary) |
| `--card-foreground` | `hsl(222.2 47.4% 11.2%)` | `hsl(210 40% 98%)` | Card text |
| `--muted` | `hsl(210 40% 96.1%)` | `hsl(217.2 32.6% 17.5%)` | Subtle backgrounds (timeline connector, empty states) |
| `--muted-foreground` | `hsl(215.4 16.3% 46.9%)` | `hsl(215 20.2% 65.1%)` | De-emphasized text (metadata, labels, frescura text) |
| `--border` | `hsl(214.3 31.8% 91.4%)` | `hsl(217.2 32.6% 17.5%)` | Dividers, card borders |
| `--input` | `hsl(214.3 31.8% 91.4%)` | `hsl(217.2 32.6% 17.5%)` | Form inputs |
| `--ring` | `hsl(221.2 83.2% 53.3%)` | `hsl(224.3 76.3% 48%)` | Focus rings |
| `--primary` | `hsl(221.2 83.2% 53.3%)` | `hsl(217.2 91.2% 59.8%)` | Primary interactive (links, focused CTAs) |
| `--primary-foreground` | `hsl(210 40% 98%)` | `hsl(222.2 47.4% 11.2%)` | Text on primary |
| `--secondary` | `hsl(210 40% 96.1%)` | `hsl(217.2 32.6% 17.5%)` | Secondary button/badge surface |
| `--secondary-foreground` | `hsl(222.2 47.4% 11.2%)` | `hsl(210 40% 98%)` | Text on secondary |
| `--destructive` | `hsl(0 84.2% 60.2%)` | `hsl(0 62.8% 30.6%)` | Reserved: not used in Phase 5 (no destructive actions) |
| `--accent` | `hsl(210 40% 96.1%)` | `hsl(217.2 32.6% 17.5%)` | Hover states |
| `--accent-foreground` | `hsl(222.2 47.4% 11.2%)` | `hsl(210 40% 98%)` | Text on accent |
| `--popover` | `hsl(0 0% 100%)` | `hsl(222.2 84% 4.9%)` | Tooltip/popover surface |
| `--radius` | `0.5rem` | — | Border radius base |

#### Civic Semantic Tokens (extend in `globals.css`)

These two tokens are unique to this project and do not exist in shadcn defaults.
Add them after the shadcn block:

```css
:root {
  /* Camara de Diputadas y Diputados — institutional blue */
  --camara: hsl(213 94% 38%);
  --camara-foreground: hsl(0 0% 100%);
  --camara-muted: hsl(213 60% 94%);
  --camara-muted-foreground: hsl(213 50% 35%);

  /* Senado de la Republica — institutional burgundy/wine */
  --senado: hsl(355 65% 38%);
  --senado-foreground: hsl(0 0% 100%);
  --senado-muted: hsl(355 40% 94%);
  --senado-muted-foreground: hsl(355 45% 35%);

  /* Provenance / frescura badge */
  --provenance-bg: hsl(210 40% 96.1%);
  --provenance-fg: hsl(215.4 16.3% 46.9%);
  --provenance-border: hsl(214.3 31.8% 85%);

  /* Identity warning (no confirmada) */
  --identity-warn-bg: hsl(38 92% 95%);
  --identity-warn-fg: hsl(32 95% 30%);
  --identity-warn-border: hsl(38 80% 75%);
}

.dark {
  --camara-muted: hsl(213 50% 15%);
  --camara-muted-foreground: hsl(213 60% 70%);
  --senado-muted: hsl(355 40% 14%);
  --senado-muted-foreground: hsl(355 50% 70%);
  --provenance-bg: hsl(217.2 32.6% 17.5%);
  --provenance-fg: hsl(215 20.2% 65.1%);
  --provenance-border: hsl(217.2 32.6% 25%);
  --identity-warn-bg: hsl(38 50% 12%);
  --identity-warn-fg: hsl(38 80% 65%);
  --identity-warn-border: hsl(38 60% 30%);
}
```

**Color usage rules:**

- **60% dominant:** `--background` — page, layout shells.
- **30% secondary:** `--card`, `--muted` — ficha card, event cards, votacion cards.
- **10% accent (reserved for):** Cámara chip (`--camara` / `--camara-muted`), Senado chip (`--senado` / `--senado-muted`), frescura badge, identity-warn marker. No other elements use color.
- **No partisan color use:** Cámara blue / Senado burgundy are drawn from official institutional identity, not political parties. Neither color is used to convey "better" or "worse."
- **Voting result bars:** SI = `hsl(142 71% 38%)` (green), NO = `hsl(0 72% 51%)` (red), Abstención = `hsl(38 92% 50%)` (amber), Pareo = `hsl(215 20% 60%)` (slate). These are accessibility-safe colors — do NOT use hue alone; always include a text label.

### 1.2 Typography

Font stack: **Geist Sans** (already loaded via `next/font/google` in `layout.tsx`) for all UI text. **Geist Mono** for boletín numbers, dates in timeline, and source URLs.

Rationale: already loaded in the scaffold; clean, legible at small sizes, designed for data-dense UIs.

#### Size scale (4 sizes only)

| Token | Size | Use |
|-------|------|-----|
| `text-sm` | 14px / 0.875rem | Metadata, badges, frescura text, voto-a-voto names, source labels |
| `text-base` | 16px / 1rem | Body text, descriptions, timeline event text |
| `text-xl` | 20px / 1.25rem | Section headings (Tramitación, Votaciones), card subtitles |
| `text-3xl` | 30px / 1.875rem | Project title (ficha header only) |

No other sizes. Do not use `text-xs` (12px is below civic readability threshold for público general).

#### Weight scale (2 weights only)

| Weight | Tailwind | Use |
|--------|----------|-----|
| Regular | `font-normal` (400) | All body and metadata text |
| Semibold | `font-semibold` (600) | Section headings, badge labels, result totals, CTA labels |

Do not use bold (700) or light (300).

#### Line height

- Body text: `leading-relaxed` (1.625) — PRE-POPULATED from civic readability best practice.
- Headings: `leading-tight` (1.25).
- Mono / metadata: `leading-none` (1.0) — used for boletín numbers, timestamps.

### 1.3 Spacing

8-point scale. Only these values are permitted for margin/padding/gap:

| Tailwind class | px | rem | Use |
|---------------|-----|-----|-----|
| `p-1` / `gap-1` | 4px | 0.25rem | Icon-to-label gap inside badges |
| `p-2` / `gap-2` | 8px | 0.5rem | Badge padding, tight metadata rows |
| `p-3` / `gap-3` | 12px | 0.75rem | — |
| `p-4` / `gap-4` | 16px | 1rem | Card internal padding, section gaps |
| `p-6` / `gap-6` | 24px | 1.5rem | Card-to-card gap, section padding |
| `p-8` / `gap-8` | 32px | 2rem | Page horizontal padding (mobile) |
| `p-12` / `gap-12` | 48px | 3rem | Between major page sections |
| `p-16` / `gap-16` | 64px | 4rem | Page top/bottom padding (desktop) |

Touch targets: minimum 44px height for all interactive elements (WCAG 2.5.5). Timeline event links: `min-h-[44px]` with `py-2`.

---

## 2. Component Inventory

### 2.1 shadcn Components (install via `pnpm dlx shadcn@latest add`)

| shadcn Component | Phase 5 Use | Notes |
|-----------------|-------------|-------|
| `Badge` | Estado/etapa badge, cámara chip, resultado badge | Extend with `--camara` / `--senado` variants |
| `Card` / `CardHeader` / `CardContent` | Ficha header, votación result card, voto-a-voto card | Default variant (bordered) |
| `Separator` | Timeline connector fallback, section dividers | Horizontal only |
| `Skeleton` | Loading state for ficha, timeline, votaciones | Match exact card structure |
| `Tooltip` | Frescura detail on hover (full timestamp + endpoint URL) | Shadcn Tooltip wraps frescura badge |

### 2.2 Project Components (build from scratch)

These are the Phase 5 signature components. Each maps to a file path.

| Component | File | Description |
|-----------|------|-------------|
| `ProvenanceBadge` | `app/components/provenance-badge.tsx` | Frescura + fuente affordance (see §4) |
| `IdentityMarker` | `app/components/identity-marker.tsx` | Identity-confirmation inline marker (see §5) |
| `EtapaBadge` | `app/components/etapa-badge.tsx` | Colored badge for proyecto estado/etapa |
| `CamaraChip` | `app/components/camara-chip.tsx` | Cámara vs Senado visual chip |
| `FichaHeader` | `app/components/ficha-header.tsx` | Full proyecto header block |
| `TimelineEvent` | `app/components/timeline-event.tsx` | Single event row in the timeline |
| `TimelineView` | `app/components/timeline-view.tsx` | Vertical timeline container |
| `VotacionCard` | `app/components/votacion-card.tsx` | Votación result card with bar chart |
| `VotacionBar` | `app/components/votacion-bar.tsx` | SI/NO/Abst/Pareo horizontal bar |
| `VotoDetalle` | `app/components/voto-detalle.tsx` | Expandable voto-a-voto list (Senado only) |
| `VotoRow` | `app/components/voto-row.tsx` | Single parlamentario row in voto-a-voto |

### 2.3 Visualization

- **Votación bar chart:** Pure CSS / Tailwind — NOT Recharts. A horizontal bar composed of 4 colored `div`s with percentage widths, labeled with counts. This is simpler, SSR-safe, and fully accessible with ARIA. Use Recharts only if animated breakdown is requested in a future phase.
- **Timeline:** Pure CSS vertical list — NOT visx for Phase 5. visx is reserved for Phase 6+ if a cross-chamber Gantt view is needed. The Phase 5 timeline is a chronological list with a left-rail connector line, implementable in Tailwind without SVG.

---

## 3. Screens

### 3.1 Ficha de Proyecto — `/proyecto/[boletin]`

**Layout:** Single-column, max-width `max-w-3xl mx-auto`, horizontal padding `px-4 md:px-8`.

#### 3.1.1 Ficha Header

**Structure (top to bottom):**

```
[ EtapaBadge ] [ CamaraChip ]          ← row, gap-2, flex-wrap
[ Project Title ]                       ← text-3xl font-semibold leading-tight, mt-4
[ Boletín N°XXXX-XX ]                  ← text-sm font-normal text-muted-foreground, mt-1, Geist Mono
[ Iniciativa chip ] [ Materia chip ]    ← row, gap-2, mt-3, text-sm
[ Autores ]                             ← text-sm text-muted-foreground, mt-2
[ ProvenanceBadge ]                     ← mt-4, fuente Cámara + fuente Senado (one per source)
```

**EtapaBadge variants:**

| Estado | Label text | Color |
|--------|-----------|-------|
| En tramitación | "En tramitación" | `bg-blue-100 text-blue-800` |
| Aprobado | "Aprobado" | `bg-green-100 text-green-800` |
| Rechazado | "Rechazado" | `bg-red-100 text-red-800` |
| Archivado | "Archivado" | `bg-slate-100 text-slate-600` |
| Promulgado | "Promulgado / Ley" | `bg-emerald-100 text-emerald-800` |
| Unknown | "Estado desconocido" | `bg-slate-100 text-slate-500` |

Use shadcn `Badge` with custom `className` — do not create new variants inside `components.json`.

**CamaraChip:**

| Cámara origen | Label | Style |
|--------------|-------|-------|
| Cámara de Diputadas y Diputados | "Cámara" | `bg-[--camara-muted] text-[--camara-muted-foreground]` |
| Senado | "Senado" | `bg-[--senado-muted] text-[--senado-muted-foreground]` |
| — | "Cámara origen desconocida" | `bg-muted text-muted-foreground` |

**Iniciativa chip:** Pill badge, `bg-secondary text-secondary-foreground`. Values: "Moción" / "Mensaje" / "Indicación".

**Autores:** Comma-separated plain text. If more than 3 authors: show first 3, then "+ N más" as a `<button>` that expands inline (no modal). Each author name is plain text — NOT a link in Phase 5 (parlamentario ficha is a future phase).

**Boletín number:** Always displayed as `N°XXXX-XX` in Geist Mono. This is the canonical project identifier.

#### 3.1.2 Section Navigation (in-page)

Sticky `<nav>` below the header on scroll, `top-0 z-10 bg-background border-b`, containing three anchor links:

- "Tramitación" → `#timeline`
- "Votaciones" → `#votaciones`

`text-sm font-semibold`, active state: `border-b-2 border-primary text-primary`. Horizontal, `gap-6`, `py-3`.

#### 3.1.3 Page Sections

Two sections below the header, each with an `<h2>` heading:

```
<section id="timeline">
  <h2 className="text-xl font-semibold mb-4">Tramitación</h2>
  <TimelineView events={...} />
</section>

<section id="votaciones" className="mt-12">
  <h2 className="text-xl font-semibold mb-4">Votaciones</h2>
  {votaciones.map(v => <VotacionCard key={v.id} votacion={v} />)}
</section>
```

---

### 3.2 Timeline de Tramitación

**Container:** Vertical list, left-rail connector. No SVG. CSS-only:

```
relative pl-8 border-l-2 border-border
```

Each event: `relative mb-6 last:mb-0`.
Connector dot: `absolute -left-[17px] top-2 w-3 h-3 rounded-full border-2 border-background` colored by cámara.

**TimelineEvent anatomy:**

```
[ dot on rail ]
[ CamaraChip ]  [ fecha — Geist Mono text-sm text-muted-foreground ]   ← row, gap-2
[ tipo label — text-sm font-semibold ]
[ descripcion — text-base leading-relaxed, mt-1 ]
[ "Ver fuente oficial ↗" link — text-sm text-primary underline-offset-2, mt-2, min-h-[44px] flex items-center ]
```

**Fecha format:** `DD MMM YYYY` in Spanish, e.g. "14 may 2026". Use `Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })`.

**Cámara chip in timeline:** Same `CamaraChip` component as header. Dot color: `bg-[--camara]` or `bg-[--senado]` respectively.

**"Ver fuente oficial ↗":** Always `target="_blank" rel="noopener noreferrer"`. The `↗` character is the external-link signal — do not use an SVG icon here (to keep the component dependency-free). `aria-label="Ver fuente oficial (abre en nueva pestaña)"`.

**Ordering:** Server-side, by `fecha ASC`, events from both chambers merged. Equal-date events: Cámara before Senado (arbitrary but stable).

**Empty timeline:** See §6.1.

---

### 3.3 Votaciones

**VotacionCard anatomy:**

```
<Card>
  <CardHeader>
    [ CamaraChip ]  [ fecha ]                        ← row, gap-2
    [ etapa — text-sm text-muted-foreground ]
    [ quórum — text-sm text-muted-foreground ]        e.g. "Quórum: mayoría simple"
  </CardHeader>
  <CardContent>
    [ VotacionBar ]                                   ← full-width horizontal bar
    [ totales row ]                                   ← SI X · NO X · Abstención X · Pareo X
    [ ResultadoBadge ]                                ← "Aprobado" / "Rechazado" / "Empate"
    [ if Senado: VotoDetalle (expandable) ]
  </CardContent>
</Card>
```

**VotacionBar:** Four segments in a single `<div className="flex h-4 rounded-full overflow-hidden w-full">`:

```tsx
// segment widths are percentages of total votes
<div style={{ width: `${pctSI}%` }} className="bg-green-500" aria-label={`Sí: ${si}`} />
<div style={{ width: `${pctNO}%` }} className="bg-red-500" aria-label={`No: ${no}`} />
<div style={{ width: `${pctAbst}%` }} className="bg-amber-400" aria-label={`Abstención: ${abst}`} />
<div style={{ width: `${pctPareo}%` }} className="bg-slate-400" aria-label={`Pareo: ${pareo}`} />
```

If total votes = 0: render a full-width `bg-muted` bar with text "Sin datos de votación".

**Totales row:** `text-sm text-muted-foreground`, inline: `Sí: 80 · No: 40 · Abst.: 5 · Pareo: 0`.

**ResultadoBadge:** Same EtapaBadge variants — "Aprobado" (green), "Rechazado" (red), "Empate" (amber). Rendered as a `Badge` below the totales row.

**VotoDetalle (Senado only):** Collapsed by default. Toggle: `<button>` labeled "Ver votos individuales (N)" / "Ocultar votos individuales". `aria-expanded`, `aria-controls`. On expand: renders `<ul>` of `VotoRow`.

**VotoRow anatomy:**

```
[ nombre ]  [ seleccion chip ]
```

- `nombre`: If `parlamentario_id` is set AND identity status is `confirmado`: render as `<Link href="/parlamentario/[id]">nombre</Link>` in `text-primary underline-offset-2`.
- If identity is NOT `confirmado`: render as `<span>nombre_crudo</span>` + `<IdentityMarker />`.
- `seleccion chip`: `Badge` with variants:
  - "Sí" → `bg-green-100 text-green-800`
  - "No" → `bg-red-100 text-red-800`
  - "Abstención" → `bg-amber-100 text-amber-800`
  - "Pareo" → `bg-slate-100 text-slate-600`

List max height: `max-h-96 overflow-y-auto` with scrollbar. If more than 43 senators, scroll is the affordance — no pagination.

---

## 4. Signature Pattern: ProvenanceBadge (Frescura + Fuente)

**Purpose:** Every piece of data shown to the user must surface "actualizado hace X · fuente oficial ↗". This satisfies TRAM-09 and the project's trazabilidad principle.

**Visual:**

```
┌──────────────────────────────────────────────────────┐
│  ● Actualizado hace 3 h · Cámara — fuente oficial ↗  │
└──────────────────────────────────────────────────────┘
```

**Styling:**

```tsx
<div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
                border border-[--provenance-border]
                bg-[--provenance-bg] text-[--provenance-fg] text-sm">
  <span className="w-1.5 h-1.5 rounded-full bg-[--provenance-fg] opacity-60" aria-hidden="true" />
  <span>Actualizado hace {relativeTime}</span>
  <span aria-hidden="true">·</span>
  <span>{sourceName}</span>
  <span aria-hidden="true">—</span>
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="underline underline-offset-2 hover:text-foreground"
    aria-label={`Fuente oficial: ${sourceName} (abre en nueva pestaña)`}
  >
    fuente oficial ↗
  </a>
</div>
```

**Props:**

```ts
interface ProvenanceBadgeProps {
  capturedAt: Date;       // timestamp from provenance record
  sourceName: string;     // "Cámara" | "Senado" | "BCN"
  sourceUrl: string;      // direct URL to the source record
}
```

**Relative time:** `capturedAt` → human-readable Spanish string. Implement with `Intl.RelativeTimeFormat('es-CL')`. Ranges: < 1h → "hace X min", < 24h → "hace X h", < 7d → "hace X días", ≥ 7d → fecha absoluta (`DD MMM YYYY`).

**Placement rules:**

| Context | Placement |
|---------|-----------|
| Ficha header | Below autores row, one badge per source (Cámara + Senado if both) |
| Each timeline event | Below the description, before the source link |
| Each VotacionCard | Below ResultadoBadge |

**Tooltip (on hover/focus):** shadcn `<Tooltip>` wrapping the badge, content: full ISO timestamp + raw endpoint URL. This satisfies advanced users and journalists who want full provenance.

**Staleness threshold:** If `capturedAt` is more than 48 hours ago, add `text-amber-700 border-amber-400` overrides to the badge to visually signal potentially stale data. Do not block display — show with the warning.

---

## 5. Signature Pattern: IdentityMarker

**Purpose:** When a Senado vote record lists a parlamentario by name but the identity link is NOT `confirmado`, the name must never appear as a verified link. The marker makes the uncertainty legible to the user without hiding the information.

**Visual (inline, follows the name):**

```
Juan Pérez  [identidad no verificada ⚠]
```

**Styling:**

```tsx
<span
  className="inline-flex items-center gap-1 px-1.5 py-0.5 ml-1 rounded
             bg-[--identity-warn-bg] text-[--identity-warn-fg]
             border border-[--identity-warn-border]
             text-sm font-normal"
  title="El nombre en la fuente no pudo asociarse de forma confirmada a un parlamentario del registro. Se muestra tal como aparece en la fuente oficial."
  aria-label="identidad no verificada"
>
  identidad no verificada
  <span aria-hidden="true">⚠</span>
</span>
```

**Behavior rules:**

- If `parlamentario_id IS NULL` or identity status is NOT `confirmado`: render raw name as `<span>` + `<IdentityMarker />`. NEVER render as `<Link>`.
- If status is `confirmado`: render as `<Link>` to `/parlamentario/[id]`. NO marker shown.
- The marker text is always "identidad no verificada" — never "dudoso", "posible", or any other phrasing that implies inference.
- Tooltip (the `title` attribute above) gives the full explanation for journalists reading carefully.

**Props:**

```ts
// No props — it is a pure presentational marker.
// Rendered adjacent to the raw name string by VotoRow.
```

---

## 6. States

### 6.1 Empty States

| Screen | Trigger | Copy | Visual |
|--------|---------|------|--------|
| Ficha not found | Boletín does not exist in DB | "No encontramos el proyecto N°{boletin}. Es posible que aún no haya sido ingresado. Puedes buscarlo directamente en el [Senado ↗] o la [Cámara ↗]." | Plain text, centered, with two external links |
| Timeline empty | `tramitacion_evento` returns 0 rows for boletín | "Aún no hay eventos de tramitación registrados para este proyecto." | Muted text, no icon |
| Votaciones empty | `votacion` returns 0 rows for boletín | "Este proyecto no tiene votaciones registradas en la legislatura vigente." | Muted text, no icon |
| VotoDetalle empty | `voto` returns 0 rows for votación | "No hay desglose de votos disponible para esta votación." | Muted text inside collapsed section |

Copy principles: state the fact, give context, offer a next step where possible. Never say "error" for missing data. Never say "Oops".

### 6.2 Loading States

Use shadcn `Skeleton`. Structure mirrors the real content exactly (shape-matched skeletons).

**Ficha header skeleton:**

```tsx
<div className="space-y-3">
  <div className="flex gap-2">
    <Skeleton className="h-6 w-24 rounded-full" />  {/* EtapaBadge */}
    <Skeleton className="h-6 w-16 rounded-full" />  {/* CamaraChip */}
  </div>
  <Skeleton className="h-9 w-3/4" />                {/* Title */}
  <Skeleton className="h-4 w-32" />                  {/* Boletin */}
  <Skeleton className="h-4 w-48 mt-4" />            {/* ProvenanceBadge */}
</div>
```

**Timeline skeleton:** 4 repeated `TimelineEvent`-shaped skeletons.
**VotacionCard skeleton:** Card with bar-shaped skeleton + totales skeleton.

Skeletons are shown during React Suspense boundaries. Each async section (ficha data, timeline, votaciones) is wrapped in its own `<Suspense fallback={<SkeletonX />}>`.

### 6.3 Error States

**Data fetch error** (Supabase query failed):

```
Ocurrió un error al cargar {section}. Si el problema persiste,
puedes consultar la fuente directamente en [fuente oficial ↗].
```

Rendered inside a `border border-destructive/20 bg-destructive/5 rounded-lg p-4 text-sm` container. Include a `<button onClick={retry}>Reintentar</button>` using `text-primary underline`.

**No boletín param** (malformed URL): Redirect to 404 page via Next.js `notFound()`.

**Provenance unavailable:** If `provenance` fields are null, render ProvenanceBadge with `sourceName="fuente desconocida"` and no link. Never hide the badge entirely — its absence would falsely imply data has no source.

---

## 7. Responsive Behavior

| Breakpoint | Layout change |
|-----------|---------------|
| Mobile `< 640px` (sm) | Single column, `px-4`. FichaHeader: title wraps freely. Timeline: connector rail maintained. VotacionBar labels stacked below bar. VotoDetalle: full-width list. |
| Tablet `640px–1024px` (sm–lg) | Single column, `px-6`. Section nav becomes sticky. |
| Desktop `> 1024px` (lg) | `max-w-3xl mx-auto`, `px-8`. No sidebar — this is a single-column content page. |

No two-column layout in Phase 5. The ficha is a document, not a dashboard.

**Touch targets:** All interactive elements (timeline source links, "Ver fuente oficial ↗", VotoDetalle toggle, parliamentarian links) have `min-h-[44px]` and `min-w-[44px]`.

---

## 8. Accessibility

Phase 5 data is civic in nature. The following requirements are non-negotiable.

**Color contrast:** All text on colored backgrounds must meet WCAG AA (4.5:1 for normal text, 3:1 for large text). The civic tokens (`--camara`, `--senado`) are chosen at hsl lightness 38% to achieve this on white.

**Voting bar:** The VotacionBar MUST NOT convey information by color alone. Each segment has `aria-label` with the count. The totales text row below the bar repeats all counts in text form.

**IdentityMarker:** The `⚠` symbol has `aria-hidden="true"`. The surrounding `<span>` has `aria-label="identidad no verificada"`. Screen readers read "identidad no verificada" once, not "⚠ identidad no verificada".

**External links:** All `target="_blank"` links include `aria-label` with "(abre en nueva pestaña)".

**Headings hierarchy:** `h1` = project title (one per page), `h2` = Tramitación / Votaciones sections, `h3` = VotacionCard header (cámara + fecha). No skipped levels.

**Keyboard navigation:** Section nav links are standard `<a>` anchors. VotoDetalle toggle is a `<button>` with `aria-expanded` and `aria-controls`. Skeleton markup does not receive focus (`aria-hidden="true"` on skeleton containers).

**Language:** Set `lang="es"` on `<html>` (update `layout.tsx`). The layout currently has `lang="en"` — this must be corrected in Phase 5.

**Focus ring:** shadcn default `ring` token is used. Do not remove focus outlines.

---

## 9. Copywriting Contract

### 9.1 Primary CTA

This phase has no user-initiated write actions. The only CTAs are informational navigation:

| Element | Label | Notes |
|---------|-------|-------|
| External source link | "Ver fuente oficial ↗" | Used in timeline events and ProvenanceBadge |
| Author list expand | "Ver todos los autores" | Expands collapsed author list |
| VotoDetalle toggle open | "Ver votos individuales ({N})" | N = total vote count |
| VotoDetalle toggle close | "Ocultar votos individuales" | — |
| Error retry | "Reintentar" | Inside error state |

### 9.2 Section Labels

| Section | Label |
|---------|-------|
| Timeline section heading | "Tramitación" |
| Votaciones section heading | "Votaciones" |
| Boletín label | "Boletín N°" (no space between N° and number) |
| Cámara origin label | "Cámara de origen" |
| Iniciativa label | "Iniciativa" |
| Materia label | "Materia" |
| Quórum label | "Quórum" |
| Etapa label | "Etapa" |
| Resultado label | "Resultado" |

### 9.3 Tone Rules (enforced at component level)

1. No adjectives that imply judgment about a vote or stage ("controversial", "histórico", "polémica").
2. No passive constructions that imply causality ("fue forzado a", "logró aprobar"). Use neutral: "fue aprobado en", "fue presentado por".
3. Fuente attribution is mandatory. If source is unknown, say "fuente desconocida" — never omit the field.
4. Identity uncertainty uses "identidad no verificada" — never "posiblemente", "probablemente", or similar hedges that still imply a guess.

### 9.4 Date / Number Formatting

| Data | Format | Example |
|------|--------|---------|
| Fecha evento | `DD MMM YYYY` (Spanish month abbrev.) | "14 may 2026" |
| Boletín | `N°XXXX-XX` | "N°16284-07" |
| Relative time | Spanish, no abbreviations | "hace 3 horas" not "3h ago" |
| Vote count | Integer, no thousands separator needed (< 200) | "80" |
| Percentages in bar | Computed client-side, not rendered as text | — |

---

## 10. Provenance Data Flow (UI contract with backend)

The UI expects these fields from Supabase on every record that carries a ProvenanceBadge:

```ts
interface ProvenanceRecord {
  source_name: "camara" | "senado" | "bcn";
  captured_at: string;  // ISO 8601 UTC
  source_url: string;   // direct URL to the source record/document
}
```

**For `proyecto`:** One provenance record per source that contributed data (Cámara `getBoletin` + Senado `tramitacion.php`).

**For `tramitacion_evento`:** One provenance record per event (each event has a single source).

**For `votacion`:** One provenance record per votación (source = cámara or senado).

The backend must populate `provenance` on all Phase 5 models (this is FND-08, already completed in Phase 1 framework — Phase 5 must apply it to the new tables).

---

## 11. Registry Safety Gate

No third-party shadcn registries declared for Phase 5.

All components used: shadcn official (`Badge`, `Card`, `Separator`, `Skeleton`, `Tooltip`) + project-built primitives.

Safety gate status: **not applicable — official registry only**.

---

## 12. Implementation Notes for Executor

1. **Initialize shadcn first** (see §0) before any component work. Confirm `components.json` and `tailwind.config.ts` exist before proceeding.

2. **Civic token file:** Create `app/styles/civic-tokens.css`, import it in `globals.css` after the shadcn variables block. Do not inline civic tokens in `globals.css` directly — keep them separable.

3. **`lang="es"`:** Update `app/app/layout.tsx` line `<html lang="en"` → `<html lang="es"`. This is a first-order accessibility fix.

4. **Server Components by default:** All data-fetching components (`FichaHeader`, `TimelineView`, `VotacionCard`) are React Server Components. Only `VotoDetalle` (with expand/collapse toggle) and the section sticky nav require `"use client"`.

5. **Suspense boundaries:** Wrap each data section in `<Suspense>`. Recommended structure:

   ```tsx
   // app/app/proyecto/[boletin]/page.tsx (Server Component)
   <Suspense fallback={<FichaHeaderSkeleton />}>
     <FichaHeaderServer boletin={boletin} />
   </Suspense>
   <Suspense fallback={<TimelineSkeleton />}>
     <TimelineServer boletin={boletin} />
   </Suspense>
   <Suspense fallback={<VotacionesSkeleton />}>
     <VotacionesServer boletin={boletin} />
   </Suspense>
   ```

6. **No Recharts / visx in Phase 5.** The votación bar is pure CSS. This avoids a heavy client-side JS bundle for a civic data page that should render well even on low-end devices.

7. **Geist font variables:** Already loaded in `layout.tsx`. Apply to body via Tailwind: add `fontFamily` extension in `tailwind.config.ts`:

   ```ts
   theme: {
     extend: {
       fontFamily: {
         sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
         mono: ['var(--font-geist-mono)', 'monospace'],
       }
     }
   }
   ```

8. **No dark mode toggle UI in Phase 5.** Dark mode tokens are defined (for system preference via `prefers-color-scheme`) but no manual toggle. Add toggle in Phase 6 or later.

---

## Appendix A: Quick Reference Card

```
TOKENS
  Surface:    --background (60%) / --card, --muted (30%) / civic chips (10%)
  Cámara:     --camara (#1a5fac-equivalent) / --camara-muted
  Senado:     --senado (#8b1a2a-equivalent) / --senado-muted
  Provenance: --provenance-bg/fg/border
  Identity:   --identity-warn-bg/fg/border

TYPOGRAPHY
  Title:      text-3xl font-semibold leading-tight (Geist Sans)
  Heading:    text-xl font-semibold leading-tight
  Body:       text-base font-normal leading-relaxed
  Metadata:   text-sm font-normal (muted-foreground)
  Mono:       font-mono (boletín, fecha, source URL)

SPACING
  Page pad:   px-4 md:px-8 / max-w-3xl mx-auto
  Card pad:   p-4 (inner)
  Section gap: mt-12 between major sections
  Element gap: gap-2 (row items) / gap-4 (stack items)

KEY PATTERNS
  ProvenanceBadge: every data section, inline after content
  IdentityMarker:  VotoRow when status != confirmado
  CamaraChip:      Timeline event + VotacionCard header
  EtapaBadge:      FichaHeader + ResultadoBadge in VotacionCard

COPY RULES
  Tone: sobrio, neutral, nunca causalidad
  Empty: describe what's missing, offer next step
  Error: "Ocurrió un error al cargar X. [Reintentar] [fuente ↗]"
  Dates: "DD MMM YYYY" (es-CL), boletín "N°XXXX-XX"
```
