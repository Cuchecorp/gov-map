# Phase 76: BENTO-BASE — Primitivas bento + chrome global - Research

**Researched:** 2026-07-15
**Domain:** Frontend design-system primitives (React 19 / Next.js 16 App Router, Tailwind v4 + shadcn tokens, cva variants) — pure presentation, zero data/schema change
**Confidence:** HIGH (codebase-verified; almost no web dependency — all facts come from reading the repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D4 (tokens de radio):** Token NUEVO `--radius-tile: 16px` + `--radius-control: 11px` en `globals.css`. El `--radius` shadcn (0.5rem/8px) NO se toca — cero regresión de forma en rutas interiores. Comentario del token documenta el mapeo mockup→tokens existentes.
- **Primitivas bento:** `BentoGrid` (grid 6 col, gap 14px, `grid-auto-rows: minmax(0, auto)`); `BentoTile` variants `default` (card + border + radius-tile) y `accent` (petróleo invertido, `--accent-product`); prop `span={2|4|6}`; colapso ≤`md` a span completo, orden DOM = orden visual.
- **CERO hex hardcodeado** en componentes bento — todo color por token existente (candado formal en Phase 80, la regla rige desde ya).
- **Chrome global:** `GlobalHeader` a `sticky top-0` con z sobre contenido; contenedor `max-w-[1120px]`; nav actual intacta (5 ítems, "Red" gated por `netPublicEnabled`). `scroll-margin-top` global en headings ancla. Footer: quitar `bg-muted/40`, añadir border-top, contenedor 1120px, CC BY LOCKED byte-idéntico. Contenedor global de `main` a `max-w-[1120px] px-6` solo donde no rompa layouts internos.
- **Tests de estructura** (jsdom valida estructura/props, no píxeles).

### Claude's Discretion
- Nombres exactos de archivos/props dentro de `components/bento/`, estructura de tests, implementación del colapso responsive (CSS vs clases TW) — siguiendo convenciones existentes del repo.
- Spacing del footer (`mt-10` vs `mt-16`): ambos aceptables, elegir uno y fijarlo.

### Deferred Ideas (OUT OF SCOPE)
- Layout bento de la home → Phases 77-78.
- Propagación de coherencia a rutas interiores → Phase 79 (D3 acotada).
- Candados de régimen (cero-hex regex, guard extendido) → Phase 80.
- Re-layout interno de cualquier página en esta fase (solo primitivas + chrome).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BENTO-01 | Existen las primitivas bento (`BentoGrid` 6-col gap 14px, `BentoTile` variants default/accent spans 2/4/6, tokens `--radius-tile` 16px + `--radius-control` 11px) y el chrome global (header sticky container 1120px, footer border-top sin fondo) — sin cambiar layout interno de ninguna página. | Cada pieza mapeada a su archivo destino y patrón existente abajo. cva ya es dependencia (button.tsx la usa). Tokens se añaden en `:root` de `globals.css` (VERIFIED). Chrome vive en `global-header.tsx` + `app/layout.tsx` (VERIFIED). Container map de todas las rutas resuelto (VERIFIED). |
</phase_requirements>

## Summary

Esta fase es 100% presentación y quirúrgica. Todo lo que toca ya existe en el repo y fue leído directamente: los tokens en `app/app/globals.css`, el chrome en `app/components/global-header.tsx` + `app/app/layout.tsx`, el patrón cva en `app/components/ui/button.tsx`, y las convenciones de test (vitest + jsdom, RTL para render, source-scan para Server Components). El "hallazgo rector" del milestone se confirma leyendo `globals.css`: la paleta del mockup ya son los tokens actuales (`--accent-product: 183 38% 26%` = petróleo `#2A5859`, `--background: 40 33% 97%` = crema `#F9F6F0`), así que las primitivas se construyen referenciando tokens Tailwind ya registrados (`bg-card`, `border-border`, `bg-accent-product`, `text-muted-foreground`) — **ningún hex nuevo**.

Dos hechos de integración cambian el plan de forma no trivial: (1) **`cva` + `cn` ya están disponibles** (`class-variance-authority@^0.7.1`, `clsx`, `tailwind-merge`; `cn` en `app/lib/utils.ts`) — `BentoTile` debe usar el mismo patrón que `button.tsx`, no un `[...].join(" ")` ad-hoc. (2) **El sticky header colisiona con el rail sticky de fichas**: `ficha-rail.tsx` es `md:sticky md:top-6` (24px) y las secciones ancla usan `scroll-mt-6` (24px). Un `GlobalHeader` sticky de ~56px hará que el rail y los anchors queden parcialmente ocultos bajo el header. El `scroll-margin-top` global debe ser ≥ altura del header (72-80px) y el `top-6` del rail debería subir a ~`top-20` — pero **eso último toca la ficha, fuera de scope de 76**: la decisión correcta es fijar `scroll-mt` global suficiente en esta fase y documentar el ajuste del rail-top para la fase de coherencia (79), o subir solo el token global `scroll-mt` sin tocar el rail (el rail sticky-top es cosmético, el anchor-occlusion es el bug real).

**Primary recommendation:** Añadir 2 tokens de radio en `:root` (con comentario del mapa mockup→token); crear `app/components/bento/bento-grid.tsx` y `bento-tile.tsx` con cva (espejo de `button.tsx`) usando `rounded-[--radius-tile]`, `bg-card/border-border` (default) y `bg-accent-product` (accent); modificar `global-header.tsx` (añadir `sticky top-0 z-40`, cambiar `max-w-5xl`→`max-w-[1120px]`) y el footer en `layout.tsx` (quitar `bg-muted/40`, cambiar `max-w-3xl`→`max-w-[1120px]`, mantener strings byte-idénticos); añadir `scroll-mt-20` global a headings ancla en `globals.css`. **NO tocar `/red` con el contenedor de `main` — `/red` ya usa su propio `max-w-3xl` en `page.tsx`, y el `main` container global NO se aplica en esta fase (cada página trae su propio `<main>`; ver §Riesgo /red).**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Radius tokens (`--radius-tile`, `--radius-control`) | Frontend / CSS (`globals.css :root`) | — | Design tokens son CSS puro; theme-agnostic (sin par dark requerido por D4). |
| `BentoGrid` / `BentoTile` primitivas | Frontend / React Server Components | — | Componentes sin estado ni JS de cliente; se renderizan server-side como los demás hand-rolled del repo. |
| `GlobalHeader` sticky + container | Frontend / Server Component | Client island (`HeaderNav` ya `"use client"`) | Header es Server Component; solo `HeaderNav` es cliente (usa `usePathname`). El gate `netPublicEnabled` se lee server-side (chokepoint). |
| Footer restyle | Frontend / `app/layout.tsx` (Server) | — | Footer inline en el layout root; no es componente propio. |
| `scroll-margin-top` global | Frontend / CSS global | — | Regla CSS única en `globals.css`, aplica a todos los headings ancla del sitio. |
| Gate `netPublicEnabled` (nav Red) | API/Server boundary (`lib/net-gate.ts`, server-only) | — | NO cambia en esta fase; se preserva tal cual (invariante 3). |

## Standard Stack

Esta fase NO instala paquetes nuevos. Todo lo necesario ya está en `app/package.json` (VERIFIED).

### Core (ya presente)
| Library | Version (verified in package.json) | Purpose | Why Standard |
|---------|------|---------|--------------|
| `class-variance-authority` | `^0.7.1` | Variants de `BentoTile` (`variant`, `span`) | Ya lo usa `components/ui/button.tsx` — es EL patrón de variants del repo. |
| `clsx` | `^2.1.1` | Base de `cn()` | Dependencia de `cn` en `lib/utils.ts`. |
| `tailwind-merge` | `^3.6.0` | Merge de clases en `cn()` | Idem. |
| `tailwindcss` | v4 (`@import "tailwindcss"` en globals.css) | Utilities + tokens | Config en `app/tailwind.config.ts` (darkMode class, colors mapeados a `hsl(var(--…))`). |
| `vitest` + `@testing-library/react` | (dev, presente — 37 `*.test.tsx` en components/) | Tests de estructura/props | jsdom env, `globals: true`, RTL para render, source-scan para SC. |

**Installation:** ninguna. `npm install`/`pnpm add` NO se corre en esta fase.

## Package Legitimacy Audit

> No aplica: esta fase NO instala paquetes externos. Todas las dependencias usadas (`cva`, `clsx`, `tailwind-merge`, `vitest`, RTL) ya están en `app/package.json` y en uso productivo. Sin superficie de slopsquatting.

## Architecture Patterns

### System Data Flow (chrome + primitivas)

```
                      app/app/layout.tsx  (RootLayout, Server Component)
                      ┌───────────────────────────────────────────────┐
  request ──────────► │ <html><body>                                  │
                      │   <GlobalHeader/>  ◄── sticky top-0 z-40       │
                      │        │              container max-w-[1120px] │
                      │        └─► <HeaderNav showRed={netPublicEnabled(env)}/>  (client island)
                      │   {children}   ◄── cada page trae su propio <main> (container por-página, NO tocado)
                      │   <footer>     ◄── border-t, sin bg-muted/40, container max-w-[1120px]
                      │                     CC BY strings LOCKED byte-idéntico
                      └───────────────────────────────────────────────┘

  globals.css :root ──► --radius-tile:16px  --radius-control:11px   (nuevos; --radius intacto)
                   ──► scroll-margin-top global en h1,h2,h3[id] ancla (≥ header height)

  components/bento/ (NUEVO, consumido por Phases 77-78, NO montado aún en ninguna page)
    bento-grid.tsx  ─► <div> grid 6-col gap-[14px] grid-auto-rows minmax(0,auto), ≤md 1-col
    bento-tile.tsx  ─► cva: variant(default|accent) × span(2|4|6); rounded-[--radius-tile]
```

**Punto clave de scope:** las primitivas `components/bento/*` se CREAN pero NO se montan en ninguna página en esta fase. Son piezas inertes hasta 77-78. El único diff visible es header sticky + anchos de container de header/footer.

### Recommended Project Structure
```
app/components/bento/          # NUEVO (kebab-case, convención repo)
├── bento-grid.tsx             # BentoGrid
├── bento-grid.test.tsx        # RTL: grid classes + DOM order
├── bento-tile.tsx             # BentoTile (cva)
└── bento-tile.test.tsx        # RTL: variant classes, span classes, focus-visible, min-h-11
```

### Pattern 1: cva variants (espejo verbatim de `button.tsx`)
**What:** `BentoTile` usa `cva` para `variant` y `span`, y `cn()` para merge — idéntico al `Button` del repo.
**When to use:** siempre que un componente tenga variantes discretas de estilo (el repo ya estandarizó esto).
**Example:**
```typescript
// Source: patrón verbatim de app/components/ui/button.tsx (VERIFIED, líneas 12-40)
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const bentoTileVariants = cva(
  "rounded-[--radius-tile] transition-colors", // base
  {
    variants: {
      variant: {
        default: "bg-card border border-border",
        accent: "bg-accent-product text-primary-foreground", // texto claro AA sobre petróleo
      },
      span: {
        2: "md:col-span-2",
        4: "md:col-span-4",
        6: "md:col-span-6",
      },
    },
    defaultVariants: { variant: "default", span: 2 },
  },
);
```
Nota: `md:col-span-N` = el span aplica desde `md`; por debajo (≤md) las tiles ocupan la única columna del grid colapsado → colapso a full-width sin CSS extra. Verificar que Tailwind v4 genera `col-span-2/4/6` (arbitrary `[grid-column:span_N]` como fallback si el JIT no las purga).

### Pattern 2: grid colapsable con orden DOM = orden visual
**What:** `BentoGrid` = `grid grid-cols-1 md:grid-cols-6 gap-[14px] [grid-auto-rows:minmax(0,auto)]`. ≤md → 1 columna, hijos en orden DOM.
**When to use:** el wrapper del bento.
**Example:**
```typescript
// gap-[14px] es arbitrary (off-step intencional del mockup — NO redondear a gap-4)
<div className="grid grid-cols-1 gap-[14px] md:grid-cols-6 [grid-auto-rows:minmax(0,auto)]">
  {children}
</div>
```

### Pattern 3: Server Component + client island (chrome)
**What:** `GlobalHeader` es Server Component; `HeaderNav` es el único `"use client"` (usa `usePathname`). El gate `netPublicEnabled(process.env)` se lee en el Server Component y baja como boolean no-sensible. **Este split NO se toca** — solo se añaden clases sticky/container al `<header>`.

### Anti-Patterns to Avoid
- **`[...].join(" ")` para variants de `BentoTile`:** el repo usa cva+cn para componentes con variantes; el `join` de `header-nav.tsx` es para clases estáticas, no para variantes. Usar cva.
- **Hex hardcodeado en `components/bento/`:** prohibido (D-decision + candado Phase 80). Todo color por token: `bg-accent-product`, `bg-card`, `border-border`.
- **Tocar `--radius` (shadcn 8px):** cambia TODOS los botones/inputs/badges de todas las rutas → diff visual gigante. D4 lo prohíbe explícitamente.
- **Aplicar un `<main className="max-w-[1120px]">` global en el layout:** cada página YA trae su propio `<main>` con su container (ver §Container Map). Un `main` global en `layout.tsx` duplicaría `<main>` (dos landmarks — rompe a11y) y no cambiaría anchos internos. El container 1120px se aplicará per-page en Phase 79, NO globalmente aquí.
- **Redondear `gap-[14px]` a `gap-4`/`gap-3`:** off-step intencional del mockup (banned por UI-SPEC §Spacing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variant styling de `BentoTile` | switch/ternario manual de clases | `cva` + `cn` (ya deps) | El repo ya lo estandarizó en `button.tsx`; consistencia + type-safe (`VariantProps`). |
| Merge de className del consumidor | concatenación string | `cn(bentoTileVariants({variant,span}), className)` | `tailwind-merge` resuelve conflictos de clase. |
| Color petróleo/crema | hex literal | tokens Tailwind (`bg-accent-product`, `bg-card`) | Los tokens ya son los hex del mockup (hallazgo rector, VERIFIED en globals.css). |
| Polimorfismo tile-as-link | render condicional `<a>`/`<div>` a mano | patrón `asChild` con `@radix-ui/react-slot` (ya lo usa `button.tsx`) — o `as` prop simple | Radix Slot ya es dependencia; evita duplicar props de accesibilidad. Discreción de Claude si `asChild` o un `as`-prop minimal. |

**Key insight:** casi todo lo "nuevo" de esta fase es composición de patrones ya presentes. El riesgo no es construir, es NO romper lo existente (footer strings, gate nav, ficha anchors).

## Runtime State Inventory

> Fase de restyle/primitivas — NO es rename/migración de datos. Igual se auditan las 5 categorías por rigor:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verificado: la fase no toca DB, RPCs ni schema (UI-SPEC "100% presentación"). | Ninguna. |
| Live service config | None — no toca crons, Edge Functions, ni flags de servicio. El flag `NET_PUBLIC_ENABLED` se LEE (sin cambiar) vía `netPublicEnabled`. | Ninguna. |
| OS-registered state | None. | Ninguna. |
| Secrets/env vars | None — `PUBLIC_INDEXABLE` y `NET_PUBLIC_ENABLED` se preservan tal cual (tests SC5 y gate nav lo verifican). | Ninguna. |
| Build artifacts | Tailwind JIT: las clases nuevas (`col-span-N`, `gap-[14px]`, `rounded-[--radius-tile]`, `scroll-mt-20`) deben ser purgadas correctamente. `content` en `tailwind.config.ts` cubre `./components/**/*.{ts,tsx}` → los archivos de `components/bento/` entran al scan. | Verificar en build que las utilities arbitrary no se purgan (tests jsdom NO lo cazan — es gate de deploy/Phase 81). |

## Common Pitfalls

### Pitfall 1: Sticky header ocluye anchors y rail de fichas (RIESGO #2 del milestone)
**What goes wrong:** con `GlobalHeader` sticky (~56px), al saltar a `#votos`/`#patrimonio` en una ficha larga, el heading queda tapado por el header. Además `ficha-rail.tsx` es `md:sticky md:top-6` (24px) → el rail también queda parcialmente bajo el header.
**Why it happens:** los anchors de ficha usan `scroll-mt-6` (24px, VERIFIED en `parlamentario/[id]/page.tsx` y `proyecto/[boletin]/page.tsx`), insuficiente para un header sticky de 56px.
**How to avoid:** añadir en `globals.css` un `scroll-margin-top` global a headings ancla (`scroll-mt-20` = 80px, o un token `--header-offset: 72px`). El `scroll-mt-6` per-section de las fichas es override local que quedaría corto — evaluar si el global gana o si hay que documentar el ajuste del rail. **Recomendación:** poner el global generoso (`scroll-mt-20`) en `globals.css` sobre `[id]` de headings; NO tocar el `top-6` del rail en esta fase (es cosmético, el occlusion crítico es del anchor destino, no del rail) → documentar el ajuste fino del rail-top para Phase 79/81 (gate visual).
**Warning signs:** al probar en deploy, click en un ítem del rail deja el heading bajo el header.

### Pitfall 2: Footer strings drift (LOCKED byte-idéntico)
**What goes wrong:** al reescribir el footer para cambiar container/bg, se altera una palabra del bloque CC BY / trust line.
**Why it happens:** edición manual del JSX.
**How to avoid:** editar SOLO `bg-muted/40`→(quitar) y `max-w-3xl`→`max-w-[1120px]` en el `<div>` interno; NO tocar el texto. El test `layout.test.tsx` verifica `CC BY 4.0`, links `/metodologia` + `/sobre`, scope-caveat (no ChileCompra/SERVEL) y `PUBLIC_INDEXABLE`. Extender ese test con asserts de los strings LOCKED completos (trust line, licencia) para blindar byte-identidad.
**Warning signs:** `layout.test.tsx` rojo, o diff de git muestra cambio en líneas de copy.

### Pitfall 3: `import.meta.url` / `new URL` roto en jsdom sobre OneDrive
**What goes wrong:** un test de source-scan que use `new URL(import.meta.url)` para resolver rutas falla (no resuelve a `file://` en este vitest sobre OneDrive).
**Why it happens:** gotcha conocida del repo (lección 45-01, citada en `layout.test.tsx` y `global-header.test.ts`).
**How to avoid:** usar `process.cwd()` + `path.join` (los tests source-scan del repo ya lo hacen). Para tests RTL de `BentoGrid`/`BentoTile` no hay rutas → no aplica, pero si un test lee source, usar `process.cwd()`.
**Warning signs:** `ENOENT`/`Invalid URL` en el test.

### Pitfall 4: Segundo `<main>` landmark
**What goes wrong:** añadir `<main className="max-w-[1120px]">` en `layout.tsx` alrededor de `{children}` cuando cada página ya tiene su propio `<main>`.
**Why it happens:** el CONTEXT dice "contenedor global de main" — pero cada page trae su `<main>` (VERIFIED: `page.tsx` línea 68, `buscar/page.tsx` línea 60, etc.).
**How to avoid:** NO envolver `{children}` en `<main>` en el layout. El container 1120px se aplica per-page en Phase 79. En 76 el `main` container queda intocado (solo header/footer cambian de ancho).
**Warning signs:** dos elementos `<main>` en el DOM; axe/a11y warning.

### Pitfall 5: jsdom no ve layout (grid no se valida por píxel)
**What goes wrong:** confiar en que un test jsdom valide que el grid es de 6 columnas 14px.
**Why it happens:** jsdom no computa CSS grid (riesgo #5 milestone, lección v6.1: cascada solo cazable con getComputedStyle en deploy real).
**How to avoid:** los tests aseveran CLASES/props/estructura (`toHaveClass("md:grid-cols-6")`, orden DOM de children, variant→clase, span→clase), NUNCA geometría. La regresión de grid la caza el gate visual humano en Phase 81.
**Warning signs:** test que llama `getComputedStyle` esperando valores reales → siempre pasa/falsos.

## Code Examples

### Tokens en globals.css `:root` (con comentario del mapa)
```css
/* Source: patrón de :root existente en app/app/globals.css (VERIFIED) */
:root {
  /* … tokens existentes … */
  --radius: 0.5rem;         /* shadcn — INTACTO (D4): botones/inputs/badges no cambian */

  /* Bento (v8, D4): tokens NUEVOS, NO tocan --radius. El mockup está dibujado
   * SOBRE la paleta actual (hallazgo rector MILESTONE-v8 §0):
   *   #F9F6F0 fondo   = --background (40 33% 97%)     → bg-background
   *   #FDFBF7 tile    = --card (40 30% 99%)           → bg-card
   *   #E3DDD3 borde   = --border (40 16% 86%)         → border-border
   *   #2A5859 acento  = --accent-product (183 38% 26%)→ bg-accent-product
   *   #5C6373 texto2  = --muted-foreground (222 14% 42%) → text-muted-foreground
   * Cero hex nuevo en componentes: todo color referencia estos tokens. */
  --radius-tile: 16px;      /* esquina de tile bento */
  --radius-control: 11px;   /* input/botón bento; off-step, mockup-exact (cf .net-chip 11px DEBT-05) */
}
```

### scroll-margin-top global
```css
/* Source: patrón @layer base existente en globals.css (VERIFIED) */
@layer base {
  /* Sticky GlobalHeader (v8) ocluye anchors en fichas largas — riesgo #2.
   * scroll-mt ≥ altura header (~56px) + aire. 80px cubre header + margen. */
  :where(h1, h2, h3)[id] {
    scroll-margin-top: 5rem; /* 80px = scroll-mt-20 */
  }
}
```

### GlobalHeader — cambios mínimos
```typescript
// Source: app/components/global-header.tsx (VERIFIED) — SOLO estas 2 líneas cambian:
// <header className="border-b border-border bg-background">
//   → <header className="sticky top-0 z-40 border-b border-border bg-background">
// <div className="mx-auto … max-w-5xl … px-4 py-2 md:px-8">
//   → <div className="mx-auto … max-w-[1120px] … px-6 py-3">
// Todo lo demás (BrandIcon, HeaderNav showRed, gov-map) INTACTO.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--radius` global subido a 16px | Token nuevo `--radius-tile` quirúrgico | D4 (esta fase) | Cero regresión en shadcn de rutas interiores. |
| Header full-width persistente `max-w-5xl` | Header sticky container `max-w-[1120px]` | Fase 76 | Único diff visible + `scroll-mt` global. |
| Footer `bg-muted/40 max-w-3xl` | Footer border-top sin fondo `max-w-[1120px]` | Fase 76 | Container más ancho, sin relleno. |
| Variants ad-hoc con `[...].join(" ")` (header-nav) | cva+cn para componentes con variantes (button, bento) | Ya establecido | `BentoTile` sigue el patrón cva. |

**Deprecated/outdated:** nada nuevo se deprecia; `--radius` shadcn permanece en uso (INTACTO por D4).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4 JIT genera `md:col-span-2/4/6` y `gap-[14px]` sin purgarlas (archivos bento en `content` glob). | Pattern 1/2, Runtime State | BAJO — si purga, fallback `[grid-column:span_N]` arbitrary; se caza en build/Phase 81, no en jsdom. |
| A2 | `scroll-mt-20` (80px) global es suficiente para el header sticky (~56px + aire); el `scroll-mt-6` per-section de fichas no lo contradice de forma dañina. | Pitfall 1 | MEDIO — si el header final es más alto, subir el valor; se valida en gate visual 81. Es override local vs global: verificar cuál gana en la cascada real. |
| A3 | El texto blanco/claro sobre `bg-accent-product` (petróleo `183 38% 26%`) cumple AA (≥4.5:1) para body. | Pattern 1 (accent) | MEDIO — el UI-SPEC pide verificar el rgba(234,242,241,.85); usar `text-primary-foreground` full-alpha (claro) mitiga. Verificación de contraste real es Phase 80. |
| A4 | El `main` container global NO se aplica en 76 (cada page trae su `<main>`); el 1120px per-page es Phase 79. | Anti-Patterns, Pitfall 4 | BAJO — coherente con "ninguna página cambia layout interno" (success criteria #5) y con evitar doble `<main>`. |

## Open Questions

1. **¿El `scroll-mt` global gana sobre el `scroll-mt-6` local de las fichas?**
   - What we know: fichas usan `scroll-mt-6` (24px) en cada `<section id>`; el global iría en `h1,h2,h3[id]`.
   - What's unclear: si el anchor destino es la `<section>` (que tiene `scroll-mt-6`) o el heading interno. Si es la section, el global en `h*` no aplica al target real.
   - Recommendation: aplicar el `scroll-mt` global a `[id]` de forma amplia (`:where([id])` sobre secciones/headings ancla) o subir también el `scroll-mt-6` de las fichas — pero eso toca fichas (fuera de 76). Documentar y verificar en gate visual 81; en 76 poner el global amplio y no romper el local.

2. **¿`BentoTile` polimórfico con `asChild` (Radix Slot) o con `as`-prop?**
   - What we know: `button.tsx` usa `asChild` + `@radix-ui/react-slot` (ya dep).
   - What's unclear: si 77-78 necesitan tile-as-link con full-card click (probable, cf entry cards actuales que son `<Link>` full-card).
   - Recommendation: implementar `asChild` (patrón repo) para que tile pueda envolver un `<Link>` sin perder focus-visible ni min-h-11. Discreción de Claude.

## Environment Availability

> SKIPPED parcial — fase de código/UI puro. Sin dependencias externas nuevas. Toolchain (Node/pnpm/vitest) ya en uso productivo (37 test files corriendo). Deploy (Docker+wrangler) es Phase 81, no 76.

## Validation Architecture

Nyquist habilitado (config no lo desactiva). Cada criterio de éxito mapeado a validación concreta.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + jsdom + @testing-library/react (VERIFIED `app/vitest.config.ts`) |
| Config file | `app/vitest.config.ts` (env jsdom, globals true, include `components/**/*.test.{ts,tsx}` + `app/**` + `lib/**`) |
| Quick run command | `pnpm --filter ./app test -- --run components/bento` |
| Full suite command | `pnpm --filter ./app test -- --run` (+ `pnpm --filter ./app exec tsc --noEmit`) |

### Success Criterion → Validation Map
| # | Success Criterion | Validation Type | Command / Method | File |
|---|-------------------|-----------------|------------------|------|
| SC1 | `--radius-tile` 16px + `--radius-control` 11px en globals.css; `--radius` intacto; comentario mapa | source-scan test (regex sobre globals.css) | `pnpm --filter ./app test globals` | ❌ Wave 0 — nuevo `app/app/globals.test.ts` (asevera presencia de tokens + `--radius: 0.5rem` intacto + comentario mapa) |
| SC2 | `BentoGrid` (6 col, gap 14px, auto-rows) + `BentoTile` (variants, span, colapso) con tests | RTL: clases/props + orden DOM | `pnpm --filter ./app test components/bento` | ❌ Wave 0 — `bento-grid.test.tsx` + `bento-tile.test.tsx` |
| SC3 | `GlobalHeader` sticky top-0 + container 1120px; nav intacta (5 ítems, Red gated); scroll-mt global | RTL (nav) + source-scan (sticky/container/scroll-mt) | `pnpm --filter ./app test global-header header-nav globals` | 🔶 extender `global-header.test.ts` (añadir asserts `sticky`, `top-0`, `max-w-[1120px]`); `header-nav.test.tsx` ya cubre gate — INTACTO |
| SC4 | Footer sin `bg-muted/40`, border-top, container 1120px, CC BY LOCKED byte-idéntico | source-scan (layout.tsx) | `pnpm --filter ./app test layout` | 🔶 extender `layout.test.tsx` (assert `not bg-muted/40`, `max-w-[1120px]`, strings LOCKED completos) |
| SC5 | Ninguna página cambia layout interno; `/red` excluido si el container amenaza, documentado | source-scan (no `<main>` en layout.tsx) + doc | `pnpm --filter ./app test layout` + revisión manual del diff | 🔶 assert en `layout.test.tsx`: `{children}` NO envuelto en `<main>`; container global ausente |
| SC6 | Suite verde + tsc limpio; anti-insinuación + guard tipográfico intactos | full suite + typecheck + guards existentes | `pnpm --filter ./app test -- --run` + `tsc --noEmit` | ✅ guards ya existen (`anti-insinuacion-guard.test.ts`, guard tipográfico) — deben permanecer verdes sin cambio |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app test -- --run components/bento` (rápido, solo primitivas).
- **Per wave merge:** `pnpm --filter ./app test -- --run` (suite completa app).
- **Phase gate:** suite app verde (target 820) + packages 1103 verde + `tsc --noEmit` limpio, antes de `/gsd:verify-work`. Regresión de grid/píxel → gate visual humano Phase 81 (jsdom no la ve).

### Wave 0 Gaps
- [ ] `app/app/globals.test.ts` — source-scan de tokens `--radius-tile`/`--radius-control` presentes, `--radius: 0.5rem` intacto, `scroll-margin-top` global presente (SC1, SC3).
- [ ] `app/components/bento/bento-grid.test.tsx` — RTL: wrapper con clases grid (`md:grid-cols-6`, `gap-[14px]`), children en orden DOM (SC2).
- [ ] `app/components/bento/bento-tile.test.tsx` — RTL: `variant="default"`→`bg-card`+`border-border`+`rounded-[--radius-tile]`; `variant="accent"`→`bg-accent-product`; `span`→clase `md:col-span-N`; tile interactivo → `focus-visible` + `min-h-11`; cero `#` hex en el source (soft check, candado formal es Phase 80) (SC2).
- [ ] Extender `app/components/global-header.test.ts` — asserts `sticky`/`top-0`/`max-w-[1120px]` (SC3).
- [ ] Extender `app/app/layout.test.tsx` — asserts footer (`not bg-muted/40`, `max-w-[1120px]`, strings LOCKED), y no-`<main>`-en-layout (SC4, SC5).
- [ ] Framework install: none — vitest+RTL ya presentes.

## Container Map (VERIFIED — quién trae su propio `<main>` y con qué ancho)

Todas las rutas traen su propio `<main>` con container per-page (grep VERIFIED). Esto confirma que NO hay `<main>` global en `layout.tsx` (solo `<GlobalHeader/>` + `{children}` + `<footer>`).

| Ruta | Container actual | Nota para 76 / 79 |
|------|------------------|-------------------|
| `/` (home) | `max-w-3xl` (hero) + `max-w-5xl` (entry nav) | NO se toca en 76 (es 77-78). |
| `/buscar` | `max-w-3xl` | 79 (coherencia). |
| `/agenda` | `max-w-3xl` | 79. |
| `/metodologia`, `/sobre` | `max-w-3xl` | 79. |
| `/parlamentarios` | `max-w-5xl` | 79. |
| `/parlamentario/[id]` | `max-w-5xl` (grid 2-col + rail sticky `top-6`) | 79 — cuidado rail+sticky (Pitfall 1). |
| `/proyecto/[boletin]` | `max-w-5xl` (grid 2-col, anchors `scroll-mt-6`) | 79 — anchors ocluidos (Pitfall 1). |
| `/red` | `max-w-3xl` (island `.net-*`) | **EXCLUIDO** — pixel-intocable (invariante 4). En 76 NO se toca; container consciente es 79. |
| `/contraparte/[id]` | `max-w-3xl` | 79. |
| `/admin/revisar-entidades` | `max-w-3xl` | 79 (o nunca — admin). |

**Riesgo /red — resolución:** como el `main` container global NO se aplica en 76 (cada page tiene su `<main max-w-3xl>` propio, incluido `/red`), el contenedor global NO amenaza `/red` en esta fase. El diff de 76 en `/red` es NULO (solo el header sticky por encima, que es global y no altera el ancho de `.net-*`). El ajuste consciente de `/red` (si el container 1120px llega a rutas interiores) queda diferido a Phase 79 como manda el invariante 4 — **documentar en el plan que `/red` NO recibe cambio de container en 76 y que su verificación visual propia es 79/81**.

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** edits deben pasar por un comando GSD (esta fase corre bajo `/gsd:execute-phase` o autónomo). No editar fuera del flujo.
- **`app/AGENTS.md`:** "This is NOT the Next.js you know" — Next.js 16 tiene breaking changes; leer `node_modules/next/dist/docs/` antes de escribir código Next. Relevante para: confirmar que `sticky`/Server Component no chocan con nada de Next 16 (no lo hacen — es CSS puro), y que el split Server/Client de `GlobalHeader`/`HeaderNav` (usePathname client-only) sigue vigente.
- **Anti-insinuación (invariante 2):** esta fase NO introduce copy nuevo que roce votos/dinero. El linter `anti-insinuacion-guard.test.ts` (201 términos, mutation self-check) debe seguir verde sin cambio.
- **Server-only intacto:** `netPublicEnabled` es `server-only`; el gate nav se preserva. Ningún dato nuevo desde cliente.
- **Dark theme no regresa:** primitivas referencian tokens dark-aware existentes (`--card`/`--border`/`--accent-product` tienen par dark en `.dark`). Tokens de radio son theme-agnostic (sin par dark). Verificación dark formal es Phase 80.

## Sources

### Primary (HIGH confidence — codebase, VERIFIED)
- `app/app/globals.css` — tokens `:root`/`.dark`, `--radius: 0.5rem`, `@layer base`, island `.net-*` (incl. `.net-chip` 11px).
- `app/app/styles/civic-tokens.css` — `--camara`/`--senado`/`--accent-product-soft` (Phase 78, no 76).
- `app/components/global-header.tsx` — chrome actual (`max-w-5xl`, `border-b`, Server Component + HeaderNav island).
- `app/components/header-nav.tsx` + `header-nav.test.tsx` — gate `showRed`, 5 ítems, RTL con mock `usePathname`.
- `app/components/ui/button.tsx` — patrón cva+cn+Slot (`asChild`).
- `app/components/global-header.test.ts` + `app/app/layout.test.tsx` — idiom source-scan (`process.cwd()`, stripComments), asserts footer/CC BY/gate.
- `app/lib/utils.ts` — `cn()` (clsx+tailwind-merge), `safeExternalHref`.
- `app/lib/net-gate.ts` — `netPublicEnabled` server-only, fail-closed.
- `app/tailwind.config.ts` — colors mapeados a `hsl(var(--…))`, `borderRadius` (lg/md/sm de `--radius`), `content` glob.
- `app/vitest.config.ts` — env jsdom, include globs, alias `@` + `server-only` stub.
- `app/package.json` — cva `^0.7.1`, clsx `^2.1.1`, tailwind-merge `^3.6.0`.
- `app/app/**/page.tsx` (grep) — container map por ruta (max-w-3xl/5xl), `<main>` per-page, `scroll-mt-6` de fichas, ficha-rail `md:sticky md:top-6`.
- `.planning/MILESTONE-v8-bento.md`, `76-CONTEXT.md`, `76-UI-SPEC.md`, `REQUIREMENTS.md §v8` — decisiones D1-D4, invariantes, mapa mockup→token.

### Secondary / Tertiary
- Ninguna búsqueda web necesaria: la fase es enteramente codebase-driven y las decisiones ya están locked en CONTEXT/UI-SPEC.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas las deps verificadas en `package.json` y en uso (button.tsx).
- Architecture: HIGH — chrome, tokens, patrón cva y container-map leídos directamente.
- Pitfalls: HIGH — sticky/anchor collision y footer-drift verificados contra código real (`scroll-mt-6`, `md:top-6`, layout.test asserts).
- Validation: HIGH — framework y idioms de test confirmados; Wave 0 gaps concretos.

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (30 días — stack estable; el único riesgo de deriva es el buildId/Next 16 minor, irrelevante para esta fase CSS/componente).
