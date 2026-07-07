# Phase 54: UXDEMO — Pulido presentacional para demo (centro de estudios) - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Dejar el sitio presentable para mostrarlo a un centro de estudios: nombres presentables (display-only), home que explica el sitio con rutas de entrada guiadas, microcopy "cómo leer esto" en secciones complejas, P1s heredados del informe F53, QA final navegado con set de screenshots de demo, y 1 redeploy final. CERO DDL, CERO flags, cero deps nuevas.

</domain>

<decisions>
## Implementation Decisions

### Nombres presentables (formatter display-only)
- **Solo Title Case** con partículas en minúscula (de/del/la/las/los/van/von/y): "gonzalez sofia" → "González Sofía"… **SIN tildes nuevas** (no hay en el dato fuente; añadirlas = fabricar) y **SIN reordenar tokens** (el orden de `nombre_normalizado` es INCONSISTENTE en los datos — "irarrazaval juan" vs "diego vergara" — e inferir cuál token es apellido sería fabricar identidad). Nota: "González" en el ejemplo es ilustrativo — si el dato dice "gonzalez", el display es "Gonzalez" (sin tilde).
- Un único helper puro `formatNombre()` (p.ej. `app/lib/format.ts` junto a `fechaCorta`) con tests de partículas, tokens vacíos, y guiones/apóstrofes ("o'higgins" → "O'Higgins", "perez-mackenna" → "Perez-Mackenna").
- Aplicado en TODAS las superficies ciudadanas que rendericen nombres de parlamentarios o contrapartes: fichas (header parlamentario, contraparte), listas (directorio /parlamentarios), votos, lobby (incl. carril lobby×tramitación — el TEXTO sigue plano/no-enlazado, solo cambia el case), red (nodos/tooltips), breadcrumbs, resultados de búsqueda si muestran nombres.
- Datos subyacentes INTACTOS: `nombre_normalizado` sigue siendo clave de matching y proyección PII-safe. El formatter es frontend-only. Tildes faltantes se documentan como limitación conocida (1 línea en /metodologia si hay sección de datos).

### Home que explica + microcopy + set demo
- 3 tarjetas de entrada entre el hero (LOCKED, intacto) y el módulo de actualidad: "Proyectos de ley" → /buscar, "Parlamentarios 360" → /parlamentarios, "Agenda de la semana" → /agenda. 1 línea de valor factual por tarjeta. Visibles sin scroll en desktop 1280×800 (junto con el hero). Server-rendered, cero JS.
- Microcopy "cómo leer esto": 1 línea factual al pie del heading en secciones complejas (cruces en ficha parlamentario, rebeldías/"votó distinto", patrimonio, red). NO duplicar caveats existentes — donde ya hay caveat anti-causal, la línea se integra o se omite. Tono: factual, sin promesas, es-CL.
- Set de demo: `docs/demo/` con ≥6 screenshots del sitio FINAL desplegado (home, buscar con resultados, ficha proyecto con carril lobby, ficha parlamentario, agenda, red), capturados con `scripts/rewalk-shot.mjs` (harness iframe), desktop 1280; nombrados por superficie.

### P1s heredados de F53 (todos entran)
- **F-04** grafo /red móvil: fix acotado — altura de canvas adaptativa + leyenda colapsada/compacta en móvil; si sigue apretado, nota honesta "mejor en pantalla ancha" (visible, no bloqueante). NO rediseño.
- Botón submit de /buscar: del azul default al token petróleo del design system (primary action).
- Minors del 53-REVIEW/UI-REVIEW: IN-01 (import `within` sin uso), IN-02 (título de test), IN-03 (skeleton sin fila de breadcrumb → CLS), IN-04 (docstring nav stale), `bg-[--identity-warn-bg]` → sintaxis de token correcta, F-05 woff2 preload warnings (si el fix es de config Next, 1 línea; si no, documentar y diferir).
- **1 redeploy final** (patrón docker-cf-build.sh + wrangler, autorizado 2026-07-06) que arrastra TAMBIÉN los fixes post-deploy de F53 (WR-01 nav gate-aware, px-2 móvil, pl-1 flecha). Smoke post-deploy: ambos estados del gate NET (ON en PROD; OFF se verifica por test, no flipeando PROD), superficies clave 200, set de screenshots capturado DESPUÉS del deploy final.

### Claude's Discretion
- Copy exacto de tarjetas y microcopy (factual, es-CL, sin vocabulario causal).
- Diseño visual de las tarjetas dentro del design system (tokens, sin arbitrary values, min-h-11 en targets).
- Mecánica del fix móvil del grafo (lo que la lib xyflow soporte sin JS nuevo significativo).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/lib/format.ts` (fechaCorta — el formatter de nombres va aquí al lado).
- `scripts/rewalk-shot.mjs` (harness iframe screenshots, endurecido en F53: isError check, SSE robusto).
- `scripts/bros-cli.mjs` (navegación general; gotchas en cabecera).
- Deploy: `docker-cf-build.sh` + docker cp + `cd app && npx wrangler deploy` (OAuth vivo al 2026-07-07; Docker Desktop puede requerir Start-Process).
- Tarjetas: patrón de card existente en actualidad-module/paneles (tokens, border, spacing).

### Established Patterns
- Suite 565/565 + tsc -b desde repo root; lockdown-guard; banned-vocab negative-match.
- Design system: tokens, Mono cifras, 400/600, min-h-11, mt-12 LOCKED, hero LOCKED.
- Carril lobby×tramitación: nombre TEXTO PLANO no-enlazado (LOCKED 52-03) — el Title Case display NO cambia eso.

### Integration Points
- `app/app/page.tsx` (tarjetas entre hero y ActualidadModule), `app/lib/format.ts`, superficies con nombres (parlamentario-header, directorio, votos, lobby, red-graph, breadcrumbs, lobby-en-tramitacion), `app/components/red/red-graph.tsx` (F-04), `app/app/buscar/page.tsx` (botón), skeletons de fichas (IN-03).

</code_context>

<specifics>
## Specific Ideas

- El público objetivo del demo es un centro de estudios: la primera impresión (home) y las dos fichas (proyecto/parlamentario) son las superficies que más pesan.
- La evidencia final (docs/demo/) se usará en la presentación — capturar DESPUÉS del deploy final.

</specifics>

<deferred>
## Deferred Ideas

- Restauración de tildes por diccionario / display-name en la proyección pública (mejora de datos, milestone futuro).
- Rediseño del grafo móvil.
- F-06 /contraparte (GATED por MONEY — sign-off F13 pendiente).

</deferred>
