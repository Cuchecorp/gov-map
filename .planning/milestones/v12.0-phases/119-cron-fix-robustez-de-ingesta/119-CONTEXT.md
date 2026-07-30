# Phase 119: CRON-FIX — Robustez de ingesta - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — recomendaciones auto-aceptadas por directiva del prompt v12.0; insumo rector = gap-list G1-G11 de `118-CRON-VERDICTS.md` §4

<domain>
## Phase Boundary

Cerrar en código cada gap ACCIONABLE de la auditoría 118, o diferirlo como deuda de operador con razón y pasos. La ingesta programada degrada honesto (freshness stale real, `[skip] sin novedades`, error visible) y JAMÁS fabrica filas. Las dos etapas LOCKED (fuente→R2 content-addressed, R2→Supabase) y el hash-check-antes-de-descargar quedan respetados en cada conector tocado; rate-limit 2-3s intacto. `pnpm freshness` refleja el estado real por fuente tras los fixes. MONEY/SERVEL siguen fuera del cron (gated legal — §4.1 de 118 lista los estados esperados que NO son backlog).

</domain>

<decisions>
## Implementation Decisions

### Alcance por gap (la gap-list de 118 ES el backlog — fixes propuestos ya escritos por gap)
- **G1 (P1, cursor lobby)**: upsert de `lobby_ingesta_estado.ingestado_hasta` tras cada lote confirmado en `packages/lobby/src/ingest-cli.ts`, plantilla = conector probidad; decidir y DOCUMENTAR en el archivo por qué conviven dos cursores (o derivar uno del otro); test de regresión de avance de cursor; cierre = `pnpm freshness` con `lobby-leylobby` stale:false.
- **G4 (P1, verde prestado)**: reapuntar `lobby-camara` → tabla propia y `fichas` → `proyecto_ficha`/`proyecto_embedding` en `catalog.ts`; incorporar `ghRun` al cálculo de stale (failure o sin-corridas puede producir stale:true por sí solo); test con tabla fresca + workflow failure → stale:true.
- **G5 (P1, SnapshotWriter)**: montar `SnapshotWriter` en agenda/identity/lobby CLIs copiando `run-tramitacion-prod-cli.ts:215-218`; cierre = `source_snapshot` pasa de 2 a 5 fuentes tras primera corrida.
- **G6 (P1, existed descartado)**: `const { r2Path, existed }` + guard `[skip] sin novedades` calcado de `tramitacion/ingest-run.ts:330` en los 3 llamadores; test unitario: existed:true → parser NO invocado; caso identity: el skip salta la carga, no el commit del snapshot git.
- **G7 (P1, sin --from-r2)**: flag `--from-r2` en agenda/probidad con firma de `tramitacion/ingest-cli.ts:200`; W-9 lobby-camara: `putImmutable` del HTML del curl + parseo desde R2 (fallback local re-procesable); test de idempotencia de doble parseo.
- **G2 (P2)**: opción (a) RECOMENDADA por 118: `workflowYml: null` en chilecompra/servel + cliente omite llamada cuando null — crear YAML vacíos sería fabricar cobertura. Cierre: freshness sin 404 en stderr.
- **G3 (P2, cobertura freshness)**: entrada `actualidad-refresh` (tabla `actualidad_senal`, umbral 2d) + comprobación pg_cron por `max(start_time)` de `cron.job_run_details` con umbral derivado del schedule; W-3/W-7 fuera deliberadamente = comentario declarado en `catalog.ts`.
- **G10 (P2, tsx)**: `tsx` como devDependency raíz O `pnpm --filter exec` cuidando cwd (gotcha v8.1: `.env` se resuelve desde cwd en `cli.ts:296`). Cierre: `pnpm freshness --json` desde raíz emite JSON.
- **G8 (P2, deuda operador CF)**: NO cerrable por agente — solo re-verificar `gh secret list` y, si el operador cargó, re-disparar workflow. Checkpoint YA emitido en 118 (pedido una vez — no re-pedir).
- **G9 (P2)**: PRIMERO verificar si `SUPABASE_URL` es remapeo de `secrets.SUPABASE_API_URL` (plantilla `lobby-leylobby-weekly.yml:57`) — si sí, fix YAML de una línea AQUÍ; `GEMINI_API_KEY` queda como deuda operador (checkpoint 118).
- **G11 (P2, observación abierta)**: re-mirar `cron.job_run_details` jobid=5; NO cerrar por inferencia — si no hay evidencia nueva concluyente, dejar documentado el criterio de cierre (≥2 semanas sin huecos hábiles) para observación futura.

### Reglas LOCKED en todo conector tocado
- Dos etapas fuente→R2→Supabase intactas; hash-check antes de descargar; rate-limit 2-3s/host; UA identificatorio.
- Degradación honesta: cron sin datos deja señal (stale visible, `[skip]`, error) — JAMÁS filas inventadas, JAMÁS fabricar cobertura de señal.
- Estados esperados de §4.1 NO se "arreglan": MONEY/SERVEL gated, lobby-camara sin schedule (WAF), digest/roster comentados (estreno gated), backfills sin schedule (backfill=LOCAL), ci/deploy no-ingesta.
- Secrets: el agente jamás carga valores; nombres solamente. Secrets nuevos solo en `.env` + placeholder `.env.example` (guard env-example verde).

### Verificación
- Suite completa + tsc + guards de régimen verdes al cierre (base 1560, crecerá con tests nuevos).
- Cambios a PROD por conector se validan con corridas locales acotadas (no esperar al cron real); psql read-only para confirmar cursores/snapshot.
- `STRICT=1 check-crons.sh` de 118 sigue verde (el documento de 118 no se reescribe; 119 produce su propio registro de cierre por gap).

### Claude's Discretion
- Orden de los fixes, agrupación en planes/waves, estructura del documento de cierre (ej. `119-GAP-CLOSURES.md`), y si G2/G3/G10 comparten plan con G4 (todos tocan freshness).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Plantillas doradas identificadas por 118: `packages/tramitacion/src/run-tramitacion-prod-cli.ts:215-218` (SnapshotWriter), `packages/tramitacion/src/ingest-run.ts:294,330` (existed→skip), `packages/tramitacion/src/ingest-cli.ts:200` (--from-r2), `packages/probidad/src/run-probidad-todos.ts` (cursor al día).
- Contrato R2: `packages/ingest/src/r2-store.ts:71,79` (If-None-Match + existed en 412) — ya correcto, solo falta consumirlo.
- Evidencia y punteros exactos por gap: `118-CRON-VERDICTS.md` §2 (secciones por unidad) y §4 (detalle con archivo:línea).

### Established Patterns
- Gotcha v8.1 process.cwd/`.env` bajo pnpm --filter (G10 es variante viva).
- `lobby-leylobby-weekly.yml:57` como plantilla de remapeo de secrets en env:.

### Integration Points
- `packages/freshness/src/catalog.ts` (G2/G3/G4 concentrados ahí).
- Salida consumida por Phase 125 (E2E re-verifica) y por el cierre del milestone.

</code_context>

<specifics>
## Specific Ideas

- 0 P0 en el backlog: nada está roto — 119 es robustez, no rescate. Los 5 P1 son el corazón; los P2 accionables (G2/G3/G9-yaml/G10) cierran instrumentación.
- El fix de cada gap ya viene propuesto paso a paso en §4 de 118 — el planner NO re-investiga, convierte esos pasos en tasks con acceptance criteria.

</specifics>

<deferred>
## Deferred Ideas

- G8 carga de secrets CF + G9 GEMINI_API_KEY: actos de operador (checkpoint 118 emitido; no re-pedir).
- G11 cierre definitivo: requiere ≥2 semanas de observación — fuera de la ventana de esta fase.
- Flip escalera Workers AI → Phase 120.

</deferred>
