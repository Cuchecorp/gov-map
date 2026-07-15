# Phase 79: BENTO-COHERENCIA — Propagación acotada a rutas interiores - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — D3 pre-resuelta por delegación del operador

<domain>
## Phase Boundary

Salir de la home no se siente como cambiar de sitio — sin re-layoutear ninguna página interior. Alcance D3 (acotado): contenedor 1120px + `--radius-tile` en tarjetas de PRIMER NIVEL de /buscar, /parlamentarios, /agenda, /sobre, /metodologia; en fichas (/parlamentario/[id], /proyecto/[boletin], /contraparte/[id]) solo contenedor + radios de paneles exteriores (acordeones/charts/tablas internas byte-idénticas). /red con tratamiento explícito (invariante 4). Requirement: BENTO-04.

</domain>

<decisions>
## Implementation Decisions

### Alcance (D3 — RESUELTA)
- Chrome global + contenedor + radios de primer nivel SOLAMENTE. Re-layout interior queda FUERA (v9).
- Swap de clase de radio (rounded-lg/md → rounded-[var(--radius-tile)] en tarjetas de primer nivel) + contenedor max-w-3xl/5xl → max-w-[1120px] según ruta. Interiores byte-idénticos.

### /red (invariante 4)
- Container map (76-RESEARCH): /red usa `max-w-3xl` propio con island `.net-*` pixel-intocable.
- DECISIÓN: /red queda EXCLUIDO del contenedor 1120px en esta fase (documentado en SUMMARY) — el ancho del island .net-* no se toca; el gate visual getComputedStyle del deploy real (Phase 81) confirma no-regresión. `red-graph.test.tsx` y `.net-chip` 11px deben seguir verdes.
- Racional: mover /red a 1120px cambiaría el ancho disponible del grafo (layout B recién aprobado 2026-07-13) sin beneficio de coherencia comparable; el chrome (header/footer) ya da la coherencia.

### Verificación visual (obligatoria en esta fase)
- Capturas BrowserOS antes/después POR RUTA sobre dev server local, archivadas en la fase. Solo debe cambiar radio/contenedor. El ORQUESTADOR (no el executor) toma las capturas: "antes" ANTES de ejecutar el plan, "después" al terminar.
- Rutas a capturar: /buscar, /parlamentarios, /agenda, /sobre, /metodologia, /parlamentario/[id] (uno real), /proyecto/[boletin] (uno real), /red.

### Admin
- /admin/revisar-entidades NO se toca (admin, sin valor de coherencia pública).

### Claude's Discretion
- Qué clases exactas por ruta (respetando el container map de 76-RESEARCH); orden de commits por ruta o por tipo de cambio.
- Tailwind [var(--token)]; cero hex; scroll-mt ya global (76).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Container map VERIFICADO en 76-RESEARCH.md (§Container Map): /buscar, /agenda, /sobre, /metodologia, /contraparte = max-w-3xl; /parlamentarios, fichas = max-w-5xl; /red = max-w-3xl EXCLUIDO.
- Tokens --radius-tile; patrón de swap ya ejercitado en home.
- Guard tipográfico + red-graph.test.tsx (`.net-chip` 11px) — deben seguir verdes.

### Established Patterns
- Cada página trae su propio `<main>` con container per-page — el swap es por página, no global.
- Fichas: rail sticky `md:top-6` + anchors `scroll-mt-6` (pitfall 76-RESEARCH: el sticky header global ya tiene scroll-mt-20 global desde 76; revisar interacción con scroll-mt-6 local en fichas — ajustar el local si el header lo tapa).

### Integration Points
- app/app/{buscar,parlamentarios,agenda,sobre,metodologia}/page.tsx; fichas parlamentario/proyecto/contraparte; tests por página existentes.

</code_context>

<specifics>
## Specific Ideas

- Suite verde (app 870 base) + tsc; guard tipográfico verde; capturas archivadas en `.planning/phases/79-*/captures/`.
- Dev server local para capturas: `pnpm --filter ./app dev` (verificar puerto).

</specifics>

<deferred>
## Deferred Ideas

- Re-layout interior de rutas (v9). Candados formales (Phase 80). Deploy + verificación en PROD (Phase 81, incl. /red getComputedStyle).

</deferred>
