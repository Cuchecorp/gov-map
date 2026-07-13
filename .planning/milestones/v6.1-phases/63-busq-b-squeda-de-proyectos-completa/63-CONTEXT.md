# Phase 63: BUSQ — Búsqueda de proyectos completa - Context

**Gathered:** 2026-07-09 (diagnóstico en caliente por Fable tras feedback del operador)
**Status:** Ready for planning

<domain>
## Phase Boundary

La búsqueda de proyectos opera sobre un corpus completo y DECLARA su cobertura. Tres frentes: (a) cerrar el gap interno (156 proyectos vs 74 fichas/74 embeddings/60 ideas), (b) ampliar el corpus histórico con alcance definido, (c) honestidad de cobertura en /buscar + visibilidad para el operador. BUSQ-01/02/03.

</domain>

<decisions>
## Implementation Decisions

### Diagnóstico (verificado 2026-07-09 vía psql read-only, no re-investigar)
- `proyecto`: **156** · `proyecto_ficha`: **74** · `proyecto_embedding`: **74** · fichas con `idea_matriz`: **60**. → /buscar (RPC `match_proyectos`, HNSW cosine 768) solo ve 74; el usuario percibe "no encuentra los históricos / faltan ideas".
- Corpus actual = set incremental proyecto∪citacion_punto∪sesion_tabla_item (boletines vistos en agenda/votación/tabla desde jun-2026) — NO hay históricos por diseño previo.
- Techo conocido de v3 (2026-06-23): de los intentos previos quedaron 8 boletines RUT/WAF-bloqueados, 1 PDF escaneado, 5 sin idea literal. `proyecto_ficha` tiene columnas `estado`/`error_msg`/`texto_r2_path` — el pipeline YA registra causa; usarlas, no inventar tracking nuevo.
- Pipeline existente: `@obs/fichas` `pipeline-cli`/`correrPipeline` (fetch texto vía R2 gate → DeepSeek extracción literal con golden gate ≥0.95 → Gemini embed 768 → upsert). Reanudable. HANDOFF-search-coverage-2026-06-23.md documenta cómo correrlo para faltantes.

### (a) Gap interno — BUSQ-01
- Backfill LOCAL con `pipeline-cli` para los 82 proyectos sin ficha + re-intento de los fallidos registrados. R2 primero (convención LOCKED). Reporte final por boletín: ok / techo-honesto(causa). Meta: fichas==embeddings==proyectos o diferencia 100% explicada.

### (b) Corpus histórico — BUSQ-02
- La fase DECIDE el alcance tras research de fuentes de enumeración (candidatos a verificar: Senado `wspublico` ¿enumera por año/legislatura?; Cámara `doGet.asmx` listado de proyectos por fecha; BCN). Alcance recomendado por defecto (ajustable por lo que la fuente permita): **legislatura actual completa (2022→hoy)** — órdenes de magnitud manejables con rate-limit 2-3s en backfill LOCAL reanudable; si la enumeración lo hace barato, extender hacia atrás por años completos.
- Los proyectos nuevos entran por el MISMO camino: proyecto (tramitación) + ficha + embedding + autores (el pipeline de 59 ya cuelga del flujo) + crudo a R2 content-addressed ANTES de parsear.
- El set incremental del cron leyes-weekly NO debe explotar: el cron sigue en novedades acotadas; el histórico es one-shot LOCAL. Verificar que la ampliación no rompa los límites de la corrida semanal (criterio 5).

### (c) Honestidad de cobertura — BUSQ-03
- /buscar declara: "Busca sobre N proyectos de ley (alcance X)" — número REAL desde la DB (contar en server, cachear), no hardcodeado.
- Operador: cobertura N/M por señal (proyectos/fichas/ideas/embeddings) visible sin bucear — extender `pnpm freshness` con una sección "cobertura búsqueda" o reporte equivalente (elegir lo más barato).
- Ideas matrices: los imposibles conservan estado honesto en ficha ("idea matriz no disponible — {causa}" ya existe como patrón).

### Límites duros
- Backfill masivo = LOCAL (jamás GH Actions). Rate-limit 2-3s/host, UA, robots. R2 antes de parsear. Idempotente/reanudable (segunda corrida = solo faltantes). DeepSeek/Gemini con golden gates existentes intactos (extracción literal ≥0.95 sigue bloqueando). Cero flags, cero DDL salvo additivo estrictamente necesario (no se anticipa ninguno). GEMINI/DEEPSEEK keys de .env.
- Corridas largas: checkpoints de progreso en logs + resumible; si una fuente bloquea (WAF), backoff y techo honesto, jamás martillar.

### Claude's Discretion
- Fuente exacta de enumeración histórica y alcance final (documentar el porqué), batching, orden del backfill, dónde vive el contador de cobertura.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/fichas`: pipeline-cli reanudable (HANDOFF-search-coverage-2026-06-23.md = manual de uso), golden gates, degradación encadenada texto→idea→embed título+materia.
- `@obs/tramitacion`: ingest-cli con `--from-r2` + Etapa-1 R2 + hash-check (v6.0); writer idempotente; autores (59).
- `pnpm freshness` (v6.0) — extensible para cobertura.
- `/buscar` server-side con RPC match_proyectos + atajo boletín.

### Established Patterns
- Backfill LOCAL reanudable con flags `--limite/--desde`; provenance por fila; estados honestos.
- Investigación de fuentes: máx pocas fetches live con 2-3s + UA identificatorio para confirmar shape.

### Integration Points
- proyecto nuevo → aparece en /buscar, ficha /proyecto/[boletin], autores, y el cron semanal lo mantiene.
- Phase 62 es independiente; 63 corre después solo por orden.

</code_context>

<specifics>
## Specific Ideas
- Queja literal: "la búsqueda no funciona con todos los históricos, muchas veces no tiene todas las ideas matrices o las leyes". La vara: buscar algo razonable y encontrarlo, o que el sitio DIGA sobre qué está buscando.
</specifics>

<deferred>
## Deferred Ideas
- Ingesta on-demand de boletín buscado ausente (encolar + "disponible pronto").
- Búsqueda full-text sobre el texto íntegro de las leyes.
</deferred>
