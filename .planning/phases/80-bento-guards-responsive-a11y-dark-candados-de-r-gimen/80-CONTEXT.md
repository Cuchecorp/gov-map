# Phase 80: BENTO-GUARDS — Responsive + a11y + dark + candados de régimen - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

El bento no se degrada en móvil, en dark, ni con el tiempo. Cuatro frentes: (1) responsive — colapso ≤md a 1 columna con orden definido; (2) a11y — focus-visible, contraste AA del tile accent, aria-label del form, landmarks; (3) dark — variantes dark de BentoTile derivadas de tokens dark existentes; (4) candados de régimen con mutation self-check — cero-hex en components/bento/, guard tipográfico extendido a tiles, linter anti-insinuación sobre copy nuevo de home. Requirements: BENTO-05, BENTO-06.

</domain>

<decisions>
## Implementation Decisions

### Responsive
- ≤md: 1 columna, orden DOM = orden visual = hero → cómo-leer → entradas(×3) → votado → urgencias → frescura (ya es el orden DOM actual de page.tsx — verificar y testear).
- `sm`-`lg` intermedio 2 col solo si el diseño lo aguanta (discreción — si complica, saltar documentado).
- Sticky header en móvil: verificación visual va en Phase 81 (BrowserOS 390px sobre deploy); en 80 se asegura por código/test que no hay overflow-x ni clases que rompan el sticky.

### A11y
- focus-visible ring en todos los tiles-link (BentoTile asChild → el ring vive en las clases del tile, ya existe en la primitiva — verificar cobertura en los 3 tipos de tile-link).
- Contraste AA tile accent: ya resuelto por tokens 77 (--accent-product-foreground 7:1, fill pinned) — añadir test de estructura que fije el par de clases.
- aria-label en el form de búsqueda (SearchBox); un solo `<main>` por página; secciones del bento con heading.

### Dark
- BentoTile default: bg-card/border-border ya tienen par dark → verificar. Accent: fill pinned --bento-accent-fill (idéntico en ambos temas, decisión 77) + foreground token — test de estructura que fije que las clases usan tokens theme-aware (no valores light hardcodeados).

### Candados (mutation self-check patrón linter existente)
- Cero-hex: test-fuente regex sobre `app/components/bento/**` que detecta `#[0-9a-fA-F]{3,8}` y FALLA en rojo; self-check con fixture mutado. Considerar también page.tsx y actualidad-module.tsx (superficies bento) si es barato.
- Guard tipográfico extendido a tiles: solo tokens/escala TW (sin px arbitrarios fuera de los sancionados: 11px chip, 52px input, 3px barra, 14px gap, 18px strip py, 22px gap-x).
- Anti-insinuación: evaluar añadir `app/app/page.tsx` (tile cómo-leer) al scope del linter — el copy del tile roza la lectura de datos (fórmula /sobre); si el linter es lista-dura de superficies, añadir la home y verificar verde.
- BrandIcon default #2A5859 (deuda 77-UI-REVIEW): cambiar default a `currentColor` o excluir explícitamente del candado con comentario — resolver en esta fase.

### Claude's Discretion
- Detalles de implementación de los guards (archivo único vs varios), fixtures de mutación, breakpoint intermedio.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Patrón mutation self-check: `anti-insinuacion-guard.test.ts` (201 términos) + `bento-coherencia-guard.test.ts` (79, count-based + fixtures mutados).
- Guard tipográfico existente (globals/tipografía). Tokens dark en globals.css `.dark`.
- BentoGrid colapso: `grid-cols-1 md:grid-cols-6` ya en la primitiva; spans `md:col-span-N` sin base span (colapso garantizado).

### Established Patterns
- Tests source-scan con process.cwd(); RTL para estructura; [var(--token)].

### Integration Points
- app/components/bento/, app/app/page.tsx, app/components/actualidad-module.tsx, app/lib/anti-insinuacion-guard.test.ts, guard tipográfico, app/components/brand-icon.tsx.

</code_context>

<specifics>
## Specific Ideas

- Suite base actual: 885 app + 1103 packages. Criterio ROADMAP "~840+" quedó corto — la base ya es 885; cerrar con 885+nuevos verdes + tsc.
- Los 3 guards nuevos deben FALLAR en rojo si se violan (mutation self-check demostrado en el propio test).

</specifics>

<deferred>
## Deferred Ideas

- Verificación visual móvil real (390px) y dark visual → Phase 81 BrowserOS.

</deferred>
