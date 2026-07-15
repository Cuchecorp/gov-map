# Phase 78: BENTO-HOME-ACTUALIDAD — Votado/urgencias/frescura como tiles - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

La actualidad vive como tiles del grid bento con los datos reales de hoy — presentación nueva, datos idénticos. Migrar los 3 bloques de `ActualidadModule` (lineal, bajo el grid desde Phase 77) a tiles dentro del `BentoGrid`: "Votado esta semana" span-4, "Urgencias vigentes" span-2, strip "Última actualización de datos" span-6. El módulo lineal viejo se RETIRA (migra, no se duplica). CERO cambios en queries/RPCs — 100% presentación. Requirement: BENTO-03.

</domain>

<decisions>
## Implementation Decisions

### Tile "Votado esta semana" (span-4)
- Barra 3px por cámara usando `--camara`/`--senado` (civic tokens) — NUNCA hex del mockup.
- Desenlace + tally en Geist Mono con en-dash (formato EXISTENTE del módulo actual — no inventar formato).
- Fecha + cámara en mono 12px. Link "Fuente ↗" por ítem vía `safeExternalHref`. "Ver todo →" al destino existente.
- Empty state honesto: "Sin votaciones registradas esta semana" (los backfills v7 66/67 pueden no haber corrido — nunca datos de ejemplo del mockup).

### Tile "Urgencias vigentes" (span-2)
- Chip pill del tipo (`suma`/`simple`) con fondo derivado de `--accent-product-soft` (equivalente del #E3F0EF del mockup — por token).
- "desde {fecha}" en mono. Fuente de datos = `urgenciaVigente()` existente. Empty state honesto.

### Strip "Última actualización de datos" (span-6)
- Dot 6px petróleo (token) + fuente + fecha mono, `flex-wrap`. Mismas fuentes que hoy (solo tablas no-PII). Condicional si no hay datos.

### Migración
- `ActualidadModule` lineal RETIRADO del render y sus tests MIGRADOS a los tiles (incluyendo empty states). Los datos/fetchers/RPCs se conservan idénticos — solo cambia la capa de presentación.
- Los tiles se integran al `BentoGrid` existente de la home (orden colapso ≤md: hero → cómo-leer → entradas → votado → urgencias → frescura, según MILESTONE §fase 80).

### Claude's Discretion
- Si los fetchers viven en ActualidadModule o se extraen: preferir mover la lógica de datos tal cual a los nuevos componentes tile o mantener un módulo contenedor — lo que minimice el diff de la capa de datos (cero cambios de queries).
- Tailwind: [var(--token)] siempre; cero hex.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BentoGrid`/`BentoTile` montados en home (Phase 77). Tokens civic `--camara`/`--senado` y `--accent-product-soft` en `app/app/styles/civic-tokens.css`.
- `ActualidadModule` actual (server component) con 3 paneles y sus queries; `urgenciaVigente()`; `safeExternalHref` en `app/lib/utils.ts`.
- Tests existentes de actualidad (`actualidad-module` tests) — base de la migración.

### Established Patterns
- Server components para datos; formato tally mono en-dash existente; empty states honestos ya implementados en el módulo actual.
- Tests RTL + source-scan `process.cwd()`.

### Integration Points
- `app/app/page.tsx` (BentoGrid — añadir 3 tiles, retirar `<ActualidadModule/>`), `app/components/actualidad-module.tsx` (o donde viva), sus tests.

</code_context>

<specifics>
## Specific Ideas

- Mockup filas 3-4: `.planning/design/bento/home-bento.dc.html`. Los datos de ejemplo del mockup (títulos reales + tallies inventados) son FABRICACIÓN si se copian — PROHIBIDO.
- Suite al cierre verde (app 863 base) + tsc limpio; anti-insinuación verde.

</specifics>

<deferred>
## Deferred Ideas

- Responsive/a11y/dark formales + candados → Phase 80.
- Verificación visual → Phase 79/81.

</deferred>
