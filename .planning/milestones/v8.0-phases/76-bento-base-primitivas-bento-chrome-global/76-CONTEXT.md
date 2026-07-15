# Phase 76: BENTO-BASE — Primitivas bento + chrome global - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisiones D1-D4 pre-resueltas por delegación del operador (REQUIREMENTS.md §v8)

<domain>
## Phase Boundary

Existir las piezas con las que se arma cualquier bento y el chrome del mockup, sin cambiar aún el layout interno de ninguna página. Entregables: tokens `--radius-tile` (16px) + `--radius-control` (11px) en `globals.css`; primitivas `BentoGrid`/`BentoTile` en `components/bento/` con tests de estructura; `GlobalHeader` sticky con contenedor `max-w-[1120px]`; footer border-top sin fondo. NINGUNA página cambia de layout interno todavía. Requirement: BENTO-01.

</domain>

<decisions>
## Implementation Decisions

### Tokens de radio (D4 — RESUELTA)
- Token NUEVO `--radius-tile: 16px` + `--radius-control: 11px` en `globals.css`. El `--radius` shadcn (0.5rem) NO se toca — cero regresión de forma en rutas interiores.
- Comentario del token documenta el mapeo mockup→tokens existentes (hallazgo rector MILESTONE-v8-bento.md §0: `#F9F6F0`≈`--background`, `#FDFBF7`≈`--card`, `#E3DDD3`≈`--border`, `#2A5859`=`--accent-product`, `#2D6299`/`#A0343E`≈`--camara`/`--senado`, `#5C6373`≈`--muted-foreground`).
- Par dark: definido si aplica, derivado de tokens dark existentes.

### Primitivas bento
- `BentoGrid`: grid 6 columnas, gap 14px, `grid-auto-rows: minmax(0, auto)`.
- `BentoTile`: variants `default` (card + border + radius-tile) y `accent` (petróleo invertido, `--accent-product`); prop `span={2|4|6}`; colapso ≤`md` a span completo con orden DOM = orden visual.
- CERO hex hardcodeado en componentes bento — todo color se referencia por token existente (candado formal llega en Phase 80, pero la regla rige desde ya).
- Tests de estructura (jsdom valida estructura/props, no píxeles).

### Chrome global
- `GlobalHeader` a `position: sticky; top: 0` con z-index sobre contenido; contenedor `max-w-[1120px]`; nav actual intacta (5 ítems, "Red" gated por `netPublicEnabled`).
- `scroll-margin-top` global en headings ancla (riesgo #2 del milestone: sticky + anchors en fichas largas).
- Footer: quitar `bg-muted/40`, añadir border-top, contenedor 1120px, contenido CC BY LOCKED byte-idéntico.
- Contenedor global de `main` a `max-w-[1120px] px-6` solo donde no rompa layouts internos.

### Riesgo /red (invariante 4)
- Si el contenedor global amenaza el ancho de `/red`: EXCLUIR `/red` del contenedor nuevo en esta fase y diferir a Phase 79, documentado. Island `.net-*` pixel-intocable (incl. `.net-chip` 11px DEBT-05).

### Claude's Discretion
- Nombres exactos de archivos/props dentro de `components/bento/`, estructura de tests, implementación del colapso responsive (CSS vs clases TW) — siguiendo convenciones existentes del repo.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Geist/Geist Mono ya cargadas vía `next/font` en `app/app/layout.tsx`.
- Tokens de color completos en `globals.css` (`--background`, `--card`, `--border`, `--accent-product`, `--camara`, `--senado`, `--muted-foreground`) con pares dark.
- `GlobalHeader` y footer existentes; nav con gate `netPublicEnabled`.

### Established Patterns
- Tailwind + shadcn tokens HSL; guard tipográfico y linter anti-insinuación como tests-fuente (`app/lib/anti-insinuacion-guard.test.ts`, 201 términos).
- Tests con vitest + jsdom; jsdom rompe `new URL(import.meta.url)` → usar `import.meta.dirname`.

### Integration Points
- `globals.css` (tokens), `app/app/layout.tsx` (chrome), `components/bento/` (nuevo).
- Mapa completo del frontend en `.planning/MILESTONE-v8-bento.md` — confiar, verificar con grep puntual solo lo tocado.

</code_context>

<specifics>
## Specific Ideas

- Mockup de referencia: `.planning/design/bento/home-bento.dc.html` (1200px preview). El mockup usa la paleta/tipografía ACTUALES — v8 es LAYOUT + PRIMITIVAS, no migración de colores.
- Diff visual esperado de esta fase: SOLO ancho de contenedor de header/footer + sticky. Nada más cambia.
- Suite al cierre: app 820 + packages 1103 verde + `tsc --noEmit` limpio; anti-insinuación y guard tipográfico intactos.

</specifics>

<deferred>
## Deferred Ideas

- Layout bento de la home → Phases 77-78.
- Propagación de coherencia a rutas interiores → Phase 79 (D3 acotada).
- Candados de régimen (cero-hex, guard extendido) → Phase 80.

</deferred>
