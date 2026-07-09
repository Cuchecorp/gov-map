# Phase 58: CRON-FRESH — Monitoreo de frescura por fuente - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva del operador)

<domain>
## Phase Boundary

Herramienta de OPERADOR (no pública) que responde "¿está fresca cada fuente?" en un solo lugar: última corrida exitosa, último snapshot R2, último upsert a Supabase, días transcurridos, y semáforo contra umbral configurable por fuente. Read-only absoluto: no dispara ingestas, no escribe DB. CRON-05 únicamente.

</domain>

<decisions>
## Implementation Decisions

### Forma: CLI primero
- Entregable primario: CLI `pnpm freshness` (paquete nuevo liviano `@obs/freshness` o script en un paquete existente — discreción, preferir lo que menos infra agregue).
- NO superficie /admin nueva en esta fase: la ficha admin existente está env-gated y agregar UI implica deploy; el CLI cubre el criterio 1 con menos superficie. (El criterio dice "CLI o superficie admin" — se elige CLI.)
- Salida: tabla legible en terminal (una fila por fuente) + flag `--json` para consumo programático futuro. Filas en rojo (ANSI) cuando superan umbral; exit code 1 si alguna fuente está stale (útil para un futuro cron de alerta), 0 si todo fresco — pero el reporte SIEMPRE se imprime completo.

### Fuentes monitoreadas y señales
- Fuentes: tramitacion/leyes, agenda, lobby-camara, lobby-leylobby, probidad, fichas (embeddings), votos si tiene corrida propia — derivar el catálogo de lo que 56-CRON-AUDIT lista como cadenas reales.
- Señales por fuente (las 3 del criterio): (a) última corrida = GH Actions vía `gh run list` si gh disponible, si no "n/d desde este entorno" (degradación honesta); (b) último snapshot R2 = MAX fecha en `source_snapshot` (registro DB del crudo — evita listar R2 remoto) con fallback a listado R2 si la tabla no cubre la fuente; (c) último upsert = MAX(fecha relevante) por tabla destino representativa de cada fuente (p.ej. tramitacion_evento, citacion, lobby_audiencia, declaracion) vía SELECTs read-only.
- Conexión: `SUPABASE_DB_URL` de .env (psql/postgres client read-only). PGCLIENTENCODING=UTF8; BOM-gotcha documentado.

### Umbrales
- Config declarativa en código versionado (objeto TS `UMBRAL_POR_FUENTE`, días): leyes 7, agenda 7, lobby-camara 14 (fallback local semanal), lobby-leylobby 7, probidad 30, fichas 30. Override por env var opcional (`FRESHNESS_UMBRAL_<FUENTE>`) — sin tabla de config en DB (menos DDL, esta fase no toca schema).

### Límites duros
- CERO writes (ni ingest_run, ni logs a DB); CERO dispatch de workflows; CERO DDL/migraciones.
- Tests con DB mockeada (query-shape) — sin red en tests; suite + typecheck verdes.

### Claude's Discretion
- Ubicación exacta del código, librería de tabla/colores (o ANSI a mano), nombres de flags.
- Mapa exacto fuente→tabla/columna representativa (documentarlo en el propio código).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `source_snapshot` / `ingest_run` (0001-0003): registro del crudo y corridas — señal (b) y quizá (a) local.
- 56-CRON-AUDIT.md sección "Frescura baseline": el mapa fuente→tabla ya está esbozado ahí.
- Patrón CLI existente (run-*-cli con loadEnv CI-safe); gh CLI autenticado.

### Established Patterns
- Deno/TS workspace pnpm; CLIs con flags validados antes de tocar red/DB; degradación honesta "n/d" sin fabricar.

### Integration Points
- `package.json` raíz: script `freshness`. El runbook cron-local-fallback.md gana una sección "cómo chequear frescura" (1 párrafo + comando).

</code_context>

<specifics>
## Specific Ideas
- Semáforo de un vistazo: verde/rojo por fila con días transcurridos explícitos; el operador no debe interpretar nada.
</specifics>

<deferred>
## Deferred Ideas
- Alertas push/email y dashboard público de frescura (Future Requirements del milestone).
- Superficie /admin/freshness (si algún día se quiere UI).
</deferred>
