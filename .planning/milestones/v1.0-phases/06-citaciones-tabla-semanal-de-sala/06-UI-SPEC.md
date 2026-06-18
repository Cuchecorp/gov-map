---
phase: 6
phase_name: "Citaciones + Tabla Semanal de Sala"
status: draft
created: 2026-06-18
author: gsd-ui-researcher
requirements: [TRAM-07, TRAM-08]
extends: "../05-tramitaci-n-core-ficha-timeline-votaciones/05-UI-SPEC.md"
---

# UI-SPEC — Phase 6: Agenda (/agenda)

## 0. Design System Inheritance

**Full Phase 5 design system applies without modification.** This spec extends it; it does not override it.

Tokens, typography, spacing scale, `ProvenanceBadge`, `IdentityMarker`, `CamaraChip`, `EtapaBadge`, accessibility rules, copywriting tone, and responsive breakpoints are all inherited verbatim from `05-UI-SPEC.md`.

**shadcn components already available (from Phase 5):** `Badge`, `Card`/`CardHeader`/`CardContent`, `Separator`, `Skeleton`, `Tooltip`.

**New shadcn add for Phase 6:**

```bash
pnpm dlx shadcn@latest add button
```

`Button` is needed for the `WeekNav` prev/next controls. No other new shadcn components required.

No third-party registries. Registry safety gate: not applicable.

---

## 1. New Components (Phase 6 only)

Three new components. Everything else reuses Phase 5 components directly.

| Component | File | Description |
|-----------|------|-------------|
| `WeekNav` | `app/components/week-nav.tsx` | ISO week navigation header (prev / label / next) |
| `CitacionCard` | `app/components/citacion-card.tsx` | Single citación card (comisión, horario, sala, materia, invitados) |
| `SalaTableSection` | `app/components/sala-table-section.tsx` | Tabla semanal de sala OR honest degraded empty state |

---

## 2. Page Layout — `/agenda`

**Route:** `app/app/agenda/page.tsx` (Server Component).

**URL shape:** `/agenda?semana=2026-W25` — ISO week param. If param is absent, default to current ISO week.

**Layout:** Single column, `max-w-3xl mx-auto px-4 md:px-8`. Same shell as Phase 5 fichas — no sidebar.

**Page structure (top to bottom):**

```
<h1>Agenda legislativa</h1>        ← text-3xl font-semibold leading-tight
<WeekNav />                         ← below h1, mt-4
<section id="citaciones">           ← mt-8
  <h2>Citaciones de comisiones</h2> ← text-xl font-semibold
  [ grouped citaciones ]
</section>
<section id="tabla-sala">           ← mt-12
  <h2>Tabla de sala</h2>            ← text-xl font-semibold
  <SalaTableSection />
</section>
```

---

## 3. WeekNav

**Purpose:** Navigate between ISO weeks. Updates the `semana` query param; page re-renders as Server Component.

**Visual:**

```
← semana anterior   Semana 25 · 16–22 jun 2026   semana siguiente →
```

**Structure:**

```tsx
<nav className="flex items-center justify-between gap-4 py-3 border-b border-border">
  <Button variant="ghost" asChild>
    <Link href={`/agenda?semana=${prevWeek}`} aria-label="Semana anterior">
      ← semana anterior
    </Link>
  </Button>
  <span className="text-base font-semibold text-center">
    Semana {weekNumber} · {startDate}–{endDate}
  </span>
  <Button variant="ghost" asChild>
    <Link href={`/agenda?semana=${nextWeek}`} aria-label="Semana siguiente">
      semana siguiente →
    </Link>
  </Button>
</nav>
```

**Date label format:** `DD MMM YYYY` (es-CL), abbreviated: "16–22 jun 2026". Use `Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' })`. Year shown once at the end.

**Accessibility:** Both nav links are `<a>` via `asChild` — keyboard-navigable, no JS required. `aria-label` values spell out the action.

**Touch target:** Buttons have `min-h-[44px]` (shadcn Button ghost default satisfies this with `py-2 px-4`).

---

## 4. CitacionCard

**Purpose:** Render one citación from either chamber. Reuses `CamaraChip` and `ProvenanceBadge` from Phase 5.

**Anatomy:**

```
<Card>
  <CardHeader className="pb-2">
    [ CamaraChip ]  [ fecha + horario — Geist Mono text-sm muted-foreground ]   ← row gap-2
    [ nombre comisión — text-base font-semibold mt-1 ]
    [ sala — text-sm muted-foreground ]
  </CardHeader>
  <CardContent className="space-y-2">
    [ materia — text-base leading-relaxed ]
    [ invitados block — conditional ]
    [ boletín link — conditional ]
    [ ProvenanceBadge ]
  </CardContent>
</Card>
```

**Invitados block:**

```tsx
{invitados.length > 0 && (
  <div className="text-sm text-muted-foreground">
    <span className="font-semibold">Invitados: </span>
    {invitados.map((inv, i) => (
      <span key={i}>
        {inv.nombre}
        {inv.calidad && (
          <span className="ml-1 text-muted-foreground">({inv.calidad})</span>
        )}
        {i < invitados.length - 1 && ", "}
      </span>
    ))}
  </div>
)}
```

**Identity rules for invitados:** Invitados are gestores de interés (lobby registrants), NOT parlamentarios. Do NOT use `IdentityMarker` here. Show `nombre` and `calidad` (e.g. "representante", "titular") as plain text exactly as they appear in the source. Never assert a legal entity behind the name. Never link to a parlamentario ficha from an invitado entry.

**Boletín link (conditional):** If the citación references a boletín number:

```tsx
<Link
  href={`/proyecto/${boletin}`}
  className="text-sm text-primary underline underline-offset-2"
  aria-label={`Ver proyecto Boletín N°${boletin}`}
>
  Boletín N°{boletin} →
</Link>
```

Internal link — no `target="_blank"`.

**ProvenanceBadge placement:** Bottom of `CardContent`, after all data fields. `sourceName` = "Cámara" or "Senado"; `sourceUrl` = the direct URL for that week's citaciones on the source site.

**Props interface:**

```ts
interface CitacionCardProps {
  comision: string;
  fecha: Date;
  horario: string;          // e.g. "10:00 hrs" — display as-is from source
  sala: string;
  materia: string;
  camara: "camara" | "senado";
  invitados: Array<{ nombre: string; calidad?: string }>;
  boletin?: string;         // link to /proyecto if present
  provenance: ProvenanceRecord;  // reuse Phase 5 interface
}
```

---

## 5. Citaciones Grouping and Section Layout

**Grouping:** Group citaciones by **day** within the week. Within each day, show Cámara citaciones before Senado (alphabetical by comisión within each chamber). Day order: Monday → Friday (skip weekend days with no citaciones).

**Day group header:**

```tsx
<div className="mt-6 mb-3">
  <h3 className="text-base font-semibold capitalize">
    {/* e.g. "Lunes 16 de junio" */}
    {Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(day)}
  </h3>
  <Separator className="mt-1" />
</div>
```

**Cards within a day:** `<div className="space-y-4">` wrapping `CitacionCard` components.

**Both-chambers coverage note:** No UI label needed to indicate "ambas cámaras" — the `CamaraChip` on each card is sufficient. The section heading "Citaciones de comisiones" is chamber-agnostic by design.

---

## 6. SalaTableSection — with Degradation

This is the key new pattern for Phase 6. The component has two mutually exclusive render modes.

### 6.1 Available mode (source confirmed)

If the tabla de sala source is available and data is returned:

```
<section>
  <h2>Tabla de sala</h2>
  [ ProvenanceBadge — source + freshness for the table ]
  <div className="mt-4 overflow-x-auto">
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-border text-muted-foreground font-semibold">
          <th>N°</th><th>Boletín</th><th>Materia</th><th>Etapa</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50">
            <td className="py-2 pr-4 font-mono text-sm">{item.orden}</td>
            <td className="py-2 pr-4">
              {item.boletin
                ? <Link href={`/proyecto/${item.boletin}`} className="text-primary underline underline-offset-2">
                    N°{item.boletin}
                  </Link>
                : <span className="text-muted-foreground">—</span>
              }
            </td>
            <td className="py-2 pr-4 leading-relaxed">{item.materia}</td>
            <td className="py-2"><EtapaBadge estado={item.etapa} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
```

Table is responsive via `overflow-x-auto` on the wrapper. No horizontal scroll indicator needed — browser default is sufficient.

### 6.2 Degraded mode (source not confirmed or unavailable)

When the source is not available — either because the connector could not confirm a clean endpoint (CONTEXT.md: "degradación honesta") or the fetch returned no usable data:

```tsx
<div className="rounded-lg border border-border bg-muted/40 px-6 py-8 text-center space-y-2">
  <p className="text-base font-semibold text-foreground">
    Tabla de sala no disponible
  </p>
  <p className="text-sm text-muted-foreground leading-relaxed">
    El organismo no ha publicado el orden del día de sala para esta semana,
    o la fuente no pudo obtenerse de forma confiable.
  </p>
  <p className="text-sm text-muted-foreground">
    Puedes consultar directamente en{" "}
    <a
      href="https://www.camara.cl/trabajamos/sala_sesion.aspx"
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
      aria-label="Sala de la Cámara (abre en nueva pestaña)"
    >
      Cámara ↗
    </a>{" "}
    o{" "}
    <a
      href="https://www.senado.cl/actividad-legislativa/sala"
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
      aria-label="Sala del Senado (abre en nueva pestaña)"
    >
      Senado ↗
    </a>
    .
  </p>
</div>
```

**No fabrication rule:** This degraded state is the correct response when data is absent. Never show a partial or synthetic tabla. Never say "próximamente" — that implies a commitment. Say "no ha publicado" — factual.

**Props:**

```ts
interface SalaTableSectionProps {
  mode: "available" | "degraded";
  items?: SalaItem[];         // present when mode === "available"
  provenance?: ProvenanceRecord; // present when mode === "available"
}
```

---

## 7. States

### 7.1 Empty States

| Context | Trigger | Copy |
|---------|---------|------|
| Citaciones section — no data for week | DB returns 0 rows for the requested ISO week | "No hay citaciones de comisiones registradas para esta semana." |
| Tabla de sala | Source unavailable | See §6.2 degraded mode verbatim |
| Week with no activity | Both sections empty | Show each section's empty state independently — do not collapse into a single message |

Copy principle (inherited from Phase 5): state the fact, offer a next step (source link). Never say "Oops". Never say "error" for missing data.

### 7.2 Loading States

Suspense boundary per section. Shape-matched skeletons:

**WeekNav skeleton:**
```tsx
<div className="flex items-center justify-between py-3 border-b border-border">
  <Skeleton className="h-9 w-32" />
  <Skeleton className="h-5 w-48" />
  <Skeleton className="h-9 w-32" />
</div>
```

**CitacionCard skeleton** (repeat 3×):
```tsx
<Card>
  <CardHeader className="pb-2">
    <div className="flex gap-2">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-28" />
    </div>
    <Skeleton className="h-5 w-3/4 mt-2" />
    <Skeleton className="h-4 w-24 mt-1" />
  </CardHeader>
  <CardContent className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-5 w-40 mt-2" />
  </CardContent>
</Card>
```

**SalaTableSection skeleton:**
```tsx
<div className="space-y-2 mt-4">
  {[...Array(5)].map((_, i) => (
    <Skeleton key={i} className="h-10 w-full" />
  ))}
</div>
```

Skeleton containers: `aria-hidden="true"`, no focusable children.

### 7.3 Error States

Same pattern as Phase 5:

```
Ocurrió un error al cargar {section}. Si el problema persiste,
puedes consultar la fuente directamente en [fuente oficial ↗].
```

Container: `border border-destructive/20 bg-destructive/5 rounded-lg p-4 text-sm`. Include `<button>Reintentar</button>` as `text-primary underline`.

**Distinction — error vs. degradation:** An error state is a failed fetch (network, parsing, DB). A degraded tabla de sala is NOT an error — it is an intentional state when no source is confirmed. Do not use `border-destructive` for the degraded empty state (§6.2); use `border-border bg-muted/40`.

---

## 8. Copywriting Contract (Phase 6 additions)

Inherits all Phase 5 tone rules. Additions for this phase:

| Element | Label |
|---------|-------|
| Page heading | "Agenda legislativa" |
| Citaciones section heading | "Citaciones de comisiones" |
| Tabla de sala section heading | "Tabla de sala" |
| WeekNav prev | "← semana anterior" |
| WeekNav next | "semana siguiente →" |
| Invitados label | "Invitados:" |
| Calidad label | shown in parentheses, as-is from source |
| Boletín link label | "Boletín N°{boletin} →" |
| Degraded tabla heading | "Tabla de sala no disponible" |
| Degraded tabla body | "El organismo no ha publicado el orden del día de sala para esta semana, o la fuente no pudo obtenerse de forma confiable." |
| Degraded tabla CTA | "Puedes consultar directamente en Cámara ↗ o Senado ↗." |
| Citaciones empty | "No hay citaciones de comisiones registradas para esta semana." |

**Invitado identity rule (copy):** Show `calidad` exactly as it comes from the source (e.g. "representante", "titular", "encargado"). Never infer or expand. If `calidad` is absent, show nothing — do not write "invitado" as a fallback.

**No causalidad:** Materia text is displayed as-is. Do not add editorial context. If materia is long, truncate to 3 lines with `line-clamp-3` and a "ver más" disclosure pattern — do not summarize.

---

## 9. Responsive Behavior

Inherits Phase 5 breakpoints. Agenda-specific notes:

| Breakpoint | Behavior |
|-----------|----------|
| Mobile `< 640px` | WeekNav arrows may wrap to two lines — acceptable. Card full width. Tabla de sala: `overflow-x-auto` allows horizontal scroll on narrow screens. |
| Tablet `640px+` | WeekNav stays single row. Cards maintain full width (no grid). |
| Desktop `1024px+` | `max-w-3xl mx-auto` — same constraint as Phase 5. No multi-column card grid in Phase 6. |

---

## 10. Accessibility

All Phase 5 accessibility rules apply. Additions:

- `<h1>Agenda legislativa</h1>` — one per page, before `WeekNav`.
- Day group headings are `<h3>` (under `<h2>` section headings) — no skipped levels.
- Tabla de sala `<table>` must have `<caption className="sr-only">Orden del día de sala — Semana {weekLabel}</caption>`.
- `<th>` elements have `scope="col"`.
- External links in degraded state: `aria-label` with "(abre en nueva pestaña)".
- WeekNav links: `aria-label="Semana anterior"` / `aria-label="Semana siguiente"` (not just the arrow character).

---

## 11. Provenance Data Flow (Phase 6 additions)

Same `ProvenanceRecord` interface from Phase 5. New source names:

| Data | `source_name` | `source_url` example |
|------|--------------|----------------------|
| Citaciones Cámara | `"camara"` | `https://www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-25` |
| Citaciones Senado | `"senado"` | `https://www.senado.cl/actividad-legislativa/comisiones/citaciones` |
| Tabla de sala (when available) | `"camara"` or `"senado"` | TBD by research — source confirmed at ingest time |

One `ProvenanceBadge` per `CitacionCard` (the card's own record freshness). One `ProvenanceBadge` for the `SalaTableSection` when in available mode (section-level freshness).

Staleness threshold: same as Phase 5 — amber overrides when `captured_at` > 48 hours ago.

---

## 12. Implementation Notes for Executor

1. **Route file:** `app/app/agenda/page.tsx`. Read `searchParams.semana` (string | undefined). Parse as ISO week (`YYYY-Www`). If absent or malformed, default to current ISO week computed server-side. Do NOT redirect on missing param — render with default silently.

2. **ISO week utilities:** Implement `parseISOWeek(semana: string): { year: number; week: number }` and `getWeekBounds(year, week): { start: Date; end: Date }` in `app/lib/week-utils.ts`. Use these in both `WeekNav` and the Supabase query.

3. **Supabase query pattern:** Query `citacion` table with `WHERE iso_week = $1` (store ISO week key as `YYYY-Www` string on the record, or filter by date range from `getWeekBounds`). Order: `fecha ASC, camara ASC, comision ASC`.

4. **Server Components by default:** `WeekNav` is a Server Component (renders links, no state). `CitacionCard` is a Server Component. `SalaTableSection` is a Server Component. No `"use client"` in this phase unless a "ver más" materia disclosure toggle is added — even then, prefer `<details>`/`<summary>` (no JS needed) with `line-clamp-3` on the closed state.

5. **Suspense boundaries:**
   ```tsx
   <Suspense fallback={<WeekNavSkeleton />}>
     <WeekNavServer semana={semana} />
   </Suspense>
   <Suspense fallback={<CitacionesSkeleton />}>
     <CitacionesServer semana={semana} />
   </Suspense>
   <Suspense fallback={<SalaTableSkeleton />}>
     <SalaTableServer semana={semana} />
   </Suspense>
   ```

6. **SalaTableSection mode decision:** Determined at the data layer, not in the UI. The Server Component receives `mode: "available" | "degraded"` based on whether the ingest job populated `tabla_sala` rows for this week. The UI never makes a fetch decision — it renders what the DB has.

7. **`line-clamp-3` for long materia text:** Apply `className="line-clamp-3"` to the materia `<p>`. If full text is needed, use `<details><summary>ver más</summary>{fullText}</details>` pattern — no JS toggle required.

8. **No dark mode toggle UI** — inherited from Phase 5. Dark tokens apply via `prefers-color-scheme` only.

---

## Appendix: Quick Reference Card (Phase 6 delta)

```
NEW COMPONENTS
  WeekNav:          week-nav.tsx — ISO week prev/next, Server Component, <Link> not <button>
  CitacionCard:     citacion-card.tsx — Card + CamaraChip + ProvenanceBadge + invitados
  SalaTableSection: sala-table-section.tsx — available mode (table) OR degraded mode (honest empty)

CITACION CARD RULES
  Invitados: plain text + calidad in parens — no IdentityMarker, no link to parlamentario
  Boletín link: internal /proyecto/[boletin] → when boletin field present
  ProvenanceBadge: one per card, bottom of CardContent

TABLA DE SALA
  Available:  table + ProvenanceBadge + boletín links where present
  Degraded:   border-border bg-muted/40 container — factual copy, two external source links
  NEVER:      fabricate rows, say "próximamente", use destructive styling for degradation

COPY ADDITIONS
  Page h1:    "Agenda legislativa"
  Citaciones: "Citaciones de comisiones"
  Tabla:      "Tabla de sala"
  Degraded:   "Tabla de sala no disponible / El organismo no ha publicado..."
  Empty week: "No hay citaciones de comisiones registradas para esta semana."

INHERITED UNCHANGED
  All tokens (--camara, --senado, --provenance-*, --identity-warn-*)
  Typography (text-sm/base/xl/3xl, font-normal/semibold)
  Spacing (8-point scale, px-4 md:px-8, max-w-3xl)
  ProvenanceBadge, IdentityMarker, CamaraChip, EtapaBadge
  Accessibility rules, tone rules, date formatting
```
