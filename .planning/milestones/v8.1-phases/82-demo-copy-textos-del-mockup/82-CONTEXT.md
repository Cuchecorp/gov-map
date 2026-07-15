# Phase 82: DEMO-COPY — Textos del mockup en la home - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Decisión EXPLÍCITA del operador (AskUserQuestion 2026-07-15: "Adoptar textos del mockup") — ANULA D1 de v8.0. El copy anterior queda archivado como histórico.

<domain>
## Phase Boundary

La home dice lo que el mockup dice (verbatim extraído de `home-bento.dc.html`), sin violar el linter anti-insinuación. Solo textos — el layout bento NO se toca. Requirement: DEMO-01.

</domain>

<decisions>
## Implementation Decisions (textos target VERBATIM del mockup)

### Hero (tile span-4)
- Kicker: "OBSERVATORIO DEL CONGRESO" (sin cambio).
- h1 NUEVO: "Busca cualquier proyecto de ley por tema o número de boletín" (sin punto final — como el mockup).
- La cursiva "Con la fuente a la vista." se RETIRA (el mockup no la tiene).
- El subtítulo/párrafo bajo el h1 se RETIRA (el mockup no lo tiene; su contenido ya vive en el tile verde).
- La trust line del hero ("Fuente, fecha y enlace en cada dato · Sin afirmar intención ni causalidad.") se RETIRA del hero — SE CONSERVA en el footer (donde ya existe, LOCKED del footer intacto).
- Botón de búsqueda: "Buscar proyectos" → "Buscar" (solo variante hero; el aria-label del form se mantiene descriptivo "Buscar proyectos de ley").
- Placeholder del input: el mockup dice "Escribe una idea o un número de boletín…" — adoptar si difiere del actual.
- Pills: sin cambio (las 4 actuales coinciden con el mockup).

### Tile verde "¿Cómo leer esto?" (accent)
- Primera frase del mockup ADOPTADA: "Cada dato lleva su fuente, su fecha y el enlace al documento oficial."
- Segunda frase del mockup PROHIBIDA por linter ("Las correlaciones no son indicativas de irregularidades: analízalas con cuidado."). Variante linter-safe equivalente (fórmula aprobada del repo): "La coincidencia temporal no implica relación: analiza cada dato con cuidado." — VERIFICAR contra los 201 términos del linter antes de fijar; si algo gatilla, usar la fórmula existente de fichas ("La coincidencia temporal no implica relación.") a secas.
- CTA "Ver metodología →" sin cambio.

### Tiles de entrada
- Marcador diamante + → se CONSERVA (la imagen del mockup del operador muestra diamantes; D2 sigue viva).
- Títulos/descripciones sin cambio (coinciden con el mockup).

### Actualidad
- Link de fuente por ítem de votado: "Ver fuente oficial ↗" → "Fuente ↗" (texto del mockup; sigue con safeExternalHref + target/rel).
- "Ver todo →" sigue OMITIDO (no existe ruta honesta — sin cambio; divergencia documentada del mockup).
- Empty states sin cambio (honestos).

### Tests
- page.test.tsx: los asserts del copy anterior se ACTUALIZAN al copy nuevo (el nuevo copy pasa a ser el LOCKED vigente; anotar en el test que la decisión del operador 2026-07-15 anuló el h1 anterior).
- search-box.test.tsx: label botón hero.
- actualidad-module.test.tsx: label "Fuente ↗".
- Linter anti-insinuación (SUPERficies_HOME cubre page.tsx y actualidad-module.tsx) DEBE quedar verde — es el candado de la variante del tile verde.

</decisions>

<code_context>
- `app/app/page.tsx` (hero + accent tile), `app/components/search-box.tsx` (label botón hero + placeholder), `app/components/actualidad-module.tsx` (label fuente), y sus tests.
- Suite base: app 918 + packages 1103, tsc limpio.
</code_context>

<specifics>
- CERO cambios de layout/clases salvo los estrictamente necesarios por retirar nodos de texto (cuidar espaciado del hero al quitar cursiva/subtítulo/trust line: el tile no debe quedar desbalanceado — ajustar márgenes mínimos si hace falta, sin cambiar la retícula).
</specifics>

<deferred>
- Cadencia de datos → Phase 83. Deuda → 84. Deploy → 85.
</deferred>
