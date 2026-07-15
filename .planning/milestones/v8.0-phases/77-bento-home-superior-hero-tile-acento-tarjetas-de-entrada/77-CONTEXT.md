# Phase 77: BENTO-HOME-SUPERIOR — Hero + tile acento + tarjetas de entrada - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — D1/D2 pre-resueltas por delegación del operador (REQUIREMENTS.md §v8)

<domain>
## Phase Boundary

La mitad superior de la home es el bento del mockup (filas 1-2), con el copy firmado intacto. Entregables: hero como tile span-4, tile acento "¿Cómo leer esto?" span-2, 3 tarjetas de entrada span-2. Consume las primitivas de Phase 76 (`BentoGrid`/`BentoTile`). La mitad inferior (actualidad) es Phase 78 — el `ActualidadModule` lineal actual SE CONSERVA debajo del grid en esta fase (migra en 78). Requirement: BENTO-02.

</domain>

<decisions>
## Implementation Decisions

### Copy del hero (D1 — RESUELTA)
- h1 LOCKED intacto: "Qué pasó con cada proyecto de ley y cada parlamentario."
- Cursiva LOCKED: "Con la fuente a la vista."
- Trust line LOCKED: "Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad."
- 4 pills LOCKED verbatim (strings actuales de la home, sin cambio).
- Se AÑADE kicker Geist Mono uppercase: "OBSERVATORIO DEL CONGRESO". El h1 del mockup NO entra.
- CERO strings/datos del mockup en producción (copy del mockup = placeholder de diseño).

### Marcador de tarjetas de entrada (D2 — RESUELTA)
- Diamante (default del mockup) + flecha →. Títulos/descripciones/destinos ACTUALES sin cambio de copy (Buscar/Parlamentarios/Agenda).

### Hero tile
- Span-4, variante default. SearchBox variante `hero` existente reestilada: input 52px de alto, radio `--radius-control` (11px), botón petróleo (`--accent-product` por token). Pills con touch target 44px (`min-h-11` — el mockup usa 38px, se SUBE), radio 999px (rounded-full), hover borde petróleo.
- Hero sigue server component; `SearchBox` único island; `force-dynamic` de la home se conserva.

### Tile acento "¿Cómo leer esto?"
- Span-2, variante `accent` de BentoTile. BrandIcon en claro. Copy alineado con la fórmula existente de /sobre (invariante 2 — el texto del mockup "correlaciones no indicativas de irregularidades…" NO se copia; pasa el linter anti-insinuación).
- CTA "Ver metodología →" — destino consistente con el link actual del hero (verificar en research si hoy va a /sobre o /metodologia; mantener el destino actual).

### Deuda UI-review 76 a resolver aquí (al consumir accent/grid)
- Variante `accent`: dark mode — foreground correcto (hoy `text-primary-foreground` invierte mal en dark; derivar foreground legible AA de tokens existentes).
- Variante `accent`: definir hover derivado (spec 76 lo pide).

### Claude's Discretion
- Estructura interna de los tiles (composición server components), nombres de archivos, cómo migrar los tests de home existentes.
- Sintaxis Tailwind: SIEMPRE `[var(--token)]` — NUNCA shorthand `[--token]` (CR-01 de 76: genera CSS inválido en Tailwind 4).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BentoGrid`/`BentoTile` (Phase 76, `app/components/bento/`) — cva variants default/accent, span 2/4/6, asChild.
- Tokens `--radius-tile` 16px / `--radius-control` 11px en globals.css.
- `SearchBox` island existente con variante hero; home actual `app/app/page.tsx` con copy LOCKED y 3 tarjetas de entrada.
- Linter anti-insinuación (`app/lib/anti-insinuacion-guard.test.ts`) — el copy nuevo del tile acento debe pasar.

### Established Patterns
- cva + cn; tests source-scan con `process.cwd()`; RTL para componentes.
- Server-only data; islands mínimos.

### Integration Points
- `app/app/page.tsx` (home — hero + entradas), tests de home existentes (page tests), `components/bento/`.

</code_context>

<specifics>
## Specific Ideas

- Mockup: `.planning/design/bento/home-bento.dc.html` — layout de referencia filas 1-2 (hero span-4 + cómo-leer span-2 + 3 entradas span-2). Los colores del mockup = tokens actuales; referenciar SIEMPRE por token.
- Suite al cierre verde (app 846 base actual + ajustes) + tsc limpio; anti-insinuación verde.

</specifics>

<deferred>
## Deferred Ideas

- Tiles de actualidad (votado/urgencias/frescura) → Phase 78 (ActualidadModule se conserva lineal bajo el grid en 77).
- Candados formales (cero-hex mutation self-check, guard tipográfico extendido) → Phase 80.
- Verificación visual real → Phase 79/81 (BrowserOS).

</deferred>
