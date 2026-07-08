# Phase 47: VCHART — Chart de votos/ausencias del parlamentario - Context

**Gathered:** 2026-07-07 (auto-generado en corrida autónoma autorizada — decisiones del ROADMAP §47 + estructura F55)
**Status:** Ready for planning

<domain>
## Phase Boundary

Dar a la ficha de parlamentario su visualización de votos: distribución del sentido de voto (sí/no/abstención/ausente/pareo) y su **evolución en el tiempo**, sobre datos YA ingestados (133 votaciones / 18.700 votos / 17.378 confirmados / 186 parlamentarios — gate verificado 2026-07-02). Patrón F46 (chart Recharts client-wrapper): solo hechos contables con fuente, conteo neutro, sin score ni ranking; degrade honesto. Reusar lecturas existentes; RPC nueva SOLO si imprescindible (idiom 0047, apply = checkpoint operador — EVITAR si es posible).
</domain>

<decisions>
## Implementation Decisions

### Dónde vive (estructura F55)
- El chart se monta DENTRO de la sección Votaciones de la ficha rediseñada: la capa-1 actual (`VotosCapa1`: 5 cifras Mono + stacked bar) se ENRIQUECE con el chart de evolución temporal, o el chart vive al tope del detalle colapsado — decidir por research según densidad (la capa-1 no debe perder escaneabilidad; el primer viewport LOCKED de F55 no se degrada).
- Patrón técnico = F46 chart patrimonio: Recharts client wrapper (SSR intacto), tokens del design system, Mono para cifras, sin arbitrary values.

### Datos
- Preferencia fuerte: derivar del shape que la página YA fetchea (votos por proyecto con fechas). El research DEBE verificar si las filas existentes traen fecha por votación; si falta la dimensión temporal en lo fetcheado, evaluar (a) leer de una tabla/RPC ya allowlisted, (b) RPC nueva como último recurso (checkpoint operador — encarece la fase).
- Evolución temporal: agregación neutra por mes/trimestre (conteos por sentido), jamás "tendencia" con adjetivos.

### Anti-insinuación (LOCKED)
- Cero lenguaje causal o de ranking ("el más ausente" PROHIBIDO — negative-match); pareo explicado factualmente si aparece; empty-state honesto (parlamentario sin votos → texto honesto, jamás barra en cero fabricada); fuente/fecha visibles (ProvenanceBadge patrón existente).

### Gate y cierre
- Suite (baseline 690) + tsc + lockdown-guard + banned-vocab. Redeploy al cierre (arrastra también los fixes pendientes de F38: RailSkeleton, pluralización, fechaCortaSegura). Smoke + evidencia visual. Checkpoint de fase estándar.

### Claude's Discretion
- Tipo de chart de evolución (barras apiladas por período vs área) dentro de Recharts ya instalado; granularidad temporal según densidad real de datos; microcopy factual.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- F46: `patrimonio-chart` (client wrapper Recharts, composite key anti-fusión, SIN montos) — el análogo técnico directo.
- F55: `VotosCapa1` (cifras+stacked bar), `DetalleColapsable`, sección votaciones en `app/app/parlamentario/[id]/page.tsx`, `votosBreakdown` en `parlamentario-resumen-conteos.ts`.
- Colores semánticos de voto existentes (verde/rojo/ámbar/gris — mismos del stacked bar).

### Established Patterns
- Server fetch → props a client island SOLO con datos ya serializados; no-leak F45; suite+guards; deploy docker+wrangler (patrón caliente).

### Integration Points
- `app/app/parlamentario/[id]/page.tsx` (sección votaciones), `app/components/capa1/votos-capa1.tsx`, componente nuevo `votos-chart.tsx` (client), tests RTL.
</code_context>

<specifics>
## Specific Ideas
- Requirement: VIZ-02. La demo del centro de estudios gana con una visual de evolución clara en la ficha — mantener la gramática F55 (preatentivo primero).
</specifics>

<deferred>
## Deferred Ideas
- Comparativo vs cámara (F49 — fase siguiente); charts de proyecto; export de datos.
</deferred>
