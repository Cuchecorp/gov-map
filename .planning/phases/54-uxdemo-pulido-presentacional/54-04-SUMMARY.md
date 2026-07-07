---
phase: 54-uxdemo-pulido-presentacional
plan: 04
subsystem: frontend-polish
tags: [ux, mobile, xyflow, design-tokens, tailwind-v4, anti-cls, identity-warn]
requires:
  - 54-01 (comparte lobby-de-parlamentario.tsx + contraparte/[id]/page.tsx; wraps formatNombre intactos)
provides:
  - grafo /red usable en móvil (canvas adaptativo + filtros compactos + nota honesta)
  - botón /buscar al token petróleo (bg-accent-product) sin tocar la rama hero
  - visual ámbar del IdentityMarker RESTAURADO (@theme inline + utilities planas)
  - skeletons de ficha sin CLS (fila placeholder de breadcrumb)
affects:
  - app/components/red/red-graph.tsx
  - app/app/globals.css
  - app/components/search-box.tsx
  - app/components/identity-marker.tsx
  - app/components/lobby-de-parlamentario.tsx
  - app/app/parlamentario/[id]/page.tsx
  - app/app/contraparte/[id]/page.tsx
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 @theme inline: registrar tokens hsl()-completos SIN wrapper (evita doble-hsl)"
    - "@xyflow/react 12.11.0 fitViewOptions/minZoom como props de primera clase (cero JS nuevo)"
    - "Altura responsive por token h-96 md:h-120 (spacing dinámico v4), sin inline style ni arbitrary [Npx]"
    - "Compactación móvil CSS-only por media query en el bloque net-* existente"
key-files:
  created:
    - app/components/search-box.test.tsx
    - app/components/identity-marker.test.tsx
  modified:
    - app/components/red/red-graph.tsx
    - app/components/red/red-graph.test.tsx
    - app/app/globals.css
    - app/components/search-box.tsx
    - app/components/identity-marker.tsx
    - app/components/lobby-de-parlamentario.tsx
    - app/app/parlamentario/[id]/page.tsx
    - app/app/contraparte/[id]/page.tsx
    - app/components/header-nav.test.tsx
    - app/components/breadcrumbs.test.tsx
    - app/components/global-header.tsx
decisions:
  - "F-05 (woff2 preload warnings): documentar y diferir — el único knob (preload:false) trocaría ruido invisible por riesgo de FOUT; layout.tsx NO se toca"
  - "identity-warn: el fix RESTAURA el visual ámbar (la clase shippeada compilaba a CSS inválido), no es pixel-identical"
metrics:
  duration: ~7 min
  completed: 2026-07-07
  tasks: 3
  commits: 3
  tests_added: 10
  suite: 594/594 green (baseline 589)
---

# Phase 54 Plan 04: Grafo móvil + petróleo + identity-warn + skeletons anti-CLS Summary

Fix acotado de los P1 heredados de F53 dejando el sitio presentable en móvil y desktop: canvas /red adaptativo con nota honesta, botón /buscar al token petróleo, corrección de sintaxis del token identity-warn que RESTAURA el aviso ámbar, y fila de breadcrumb en los skeletons para eliminar un CLS — sin instalar nada, sin tocar el layout de fonts.

## What Was Built

### Task 1 — F-04 grafo móvil + botón /buscar petróleo (`db3c699`)
- **red-graph.tsx**: reemplazado `style={{ height: 480 }}` por clases token `h-96 md:h-120` (384px móvil / 480px ≥768px, sin inline style ni arbitrary `[Npx]`); agregados `fitViewOptions={{ padding: 0.05 }}` y `minZoom={0.2}` (props de primera clase de @xyflow/react 12.11.0); agregada la nota honesta `<p class="mt-4 text-sm text-muted-foreground md:hidden">` sobre el canvas (visible solo en móvil, nunca overlay, nunca oculta el grafo).
- **globals.css**: media query `@media (max-width: 47.99rem)` que compacta `.net-filtros` (column, gaps/padding reducidos) — ningún filtro se remueve ni oculta; los inputs de fecha conservan `font-mono`.
- **search-box.tsx**: rama no-hero del botón submit de `"h-12"` → `"h-12 bg-accent-product text-background hover:bg-accent-product/90"`; label sigue "Buscar"; rama hero byte-identical (conserva su `font-semibold`).
- **Tests**: 4 asserts nuevos en red-graph.test.tsx (clases del lienzo, nota `md:hidden`, nota ausente en empty-state, filtros intactos) + nuevo search-box.test.tsx (Wave 0: no-hero petróleo, no-hero sin font-semibold, hero byte-identical).

### Task 2 — identity-warn @theme + utilities planas + skeletons anti-CLS (`a19644e`)
- **globals.css**: bloque `@theme inline` que registra `--color-identity-warn-bg/fg/border` como `var(--identity-warn-*)` SIN wrapper `hsl()` (civic-tokens.css ya define valores hsl() completos → doble hsl sería color inválido otra vez, Pitfall 2). Genera las utilities planas `bg-/text-/border-identity-warn-*`.
- **identity-marker.tsx** y **lobby-de-parlamentario.tsx** (CaveatIdentidad): sintaxis arbitrary-var v3 `bg-[--identity-warn-bg]` (que en Tailwind v4 compilaba a `background-color: --identity-warn-bg;` — inválido, marker SIN ámbar) → utilities planas. Los valores HSL en civic-tokens.css quedan intactos (light + dark). NO se tocó el wrap `formatNombre` de `:236` (aplicado por 54-01).
- **Skeletons**: `<Skeleton className="h-4 w-40" />` al tope de `ParlamentarioHeaderSkeleton` (parlamentario/[id]/page.tsx) y `HeaderSkeleton` (contraparte/[id]/page.tsx), matcheando la caja real del `<Breadcrumbs>` que hace stream-in → sin layout shift.
- **Tests**: nuevo identity-marker.test.tsx (Wave 0: usa utilities planas, no usa arbitrary-var, conserva texto/aria-label).

### Task 3 — minors IN-01/IN-02/IN-04 (`833bd26`)
- **IN-01**: quitado el import `within` sin uso en header-nav.test.tsx.
- **IN-02**: renombrado el título del test de breadcrumbs a "dos ítems (contraparte: [Inicio, nombre]) dibujan 1 separador y 1 link" (el fixture tiene DOS items; el título viejo mentía "un solo ítem/0 separadores"). Los asserts NO cambiaron.
- **IN-04**: docstring del nav en global-header.tsx actualizado a la lista de 5 ítems del 53-UI-SPEC §a (incluye "Red" y "Sobre" acortado), reemplazando la lista pre-F53 de 4.

## F-05 — woff2 preload warnings: documentado y DIFERIDO

**Root cause**: `next/font/google` con `preload: true` (default) inyecta un `<link rel="preload">` por subset de font. Ambas fonts (Geist Sans + Geist Mono) SÍ se usan (`body font-family: var(--font-geist-sans)` + `font-mono` en cifras); el warning `…woff2 was preloaded using link preload but not used within a few seconds…` es la heurística de timing de Chrome (~3s post window-load), disparada aun con fonts en uso (caché caliente / paint rápido / consumo tardío del mono). Problema conocido upstream (vercel/next.js discussions #45294, #49607) sin fix userland que conserve el preload.

**Knob disponible**: `preload: false` (1 línea por font, documentado en los docs bundled de Next 16.2.9). **Trade-off**: elimina el `<link rel=preload>` → la font se descubre recién al parsear CSS → riesgo real de FOUT en cold-cache (exactamente el escenario de una demo en una máquina ajena).

**Por qué se difiere**: (1) no es defecto de app — 0 errores; (2) el público de la demo mira el sitio, no la consola; (3) el único knob troca ruido invisible por riesgo visible, prohibido por el propio Contract 5e ("Never a layout/FOUT regression"). Los woff2 son `level:warning`, no `error` → el criterio "cero errores de consola" del ROADMAP se cumple. **`app/app/layout.tsx` NO se tocó** (verificado: diff vacío).

## Deviations from Plan

None - plan executed exactly as written. Los tres tasks se ejecutaron en orden con sus contratos; F-05 diferido según el veredicto del RESEARCH; el wrap `formatNombre` de 54-01 se preservó intacto.

## Verification

- **Task 1**: `vitest run components/red/red-graph.test.tsx components/search-box.test.tsx` → 25/25 verde.
- **Task 2**: `vitest run components/identity-marker.test.tsx components/lobby-de-parlamentario.test.tsx` → 38/38 verde.
- **Task 3**: `vitest run components/header-nav.test.tsx components/breadcrumbs.test.tsx` → 14/14 verde.
- **Phase gate**: `npx tsc -b` limpio (exit 0); `pnpm test` (root) → **594/594 verde** (baseline 589; +5 neto tras 10 tests nuevos y sin regresión), lockdown-guard incluido y verde.
- **Grep**: no queda `bg-[--identity-warn-bg]` como CLASE en el código (solo en comentarios/strings de test); `style={{ height: 480 }}` ya no existe en red-graph.tsx (solo en un comentario de test); `app/app/layout.tsx` sin diff.
- **Diferido a Plan 05 (post-deploy)**: verificación visual con screenshots (grafo 390px, marker ámbar, fold 1280, botón petróleo).

## Self-Check: PASSED

- Archivos creados existen: app/components/search-box.test.tsx, app/components/identity-marker.test.tsx.
- Commits existen: db3c699 (Task 1), a19644e (Task 2), 833bd26 (Task 3).
- Suite completa verde (594) + tsc limpio.
