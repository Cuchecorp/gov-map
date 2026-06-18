# Phase 1: Framework de Conectores + Almacenamiento + Orquestación - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega el framework base que todo conector posterior hereda sin reescribir política: ingesta respetuosa (rate-limit, UA, robots.txt), almacenamiento de crudo inmutable con procedencia en R2, caché diaria + snapshots versionados, detección de drift, y orquestación de trabajo pesado por cola (pgmq + pg_cron). NO incluye conectores concretos de fuentes (Cámara/Senado/BCN) — eso es Fase 5+. NO incluye providers LLM/Embeddings (Fase 2). Es greenfield: también establece el scaffolding del repo.

Cubre: FND-01 (ingesta respetuosa), FND-02 (crudo en R2, no Postgres), FND-03 (caché diaria + snapshots), FND-04 (drift), FND-05 (cola pgmq/pg_cron + backoff), FND-08 (procedencia capturada al ingestar).
</domain>

<decisions>
## Implementation Decisions

### Estructura, ejecución y políticas base
- **Layout del repo — Monorepo**: `/app` (Next.js 16, App Router), `/supabase` (migraciones SQL + Edge Functions en Deno), `/packages/ingest` (framework de conectores TS compartido), `/packages/core` (tipos compartidos, esquemas zod, interfaces de providers). Un solo lenguaje (TypeScript) en todo el stack.
- **Ejecución de la ingesta** — Edge Functions (Deno) dirigidas por **pgmq + pg_cron** para jobs incrementales del día a día; **GitHub Actions** como escape hatch para backfill masivo que excede el límite de ~400s de Edge Functions. El patrón de worker/cola se construye una sola vez aquí y se reutiliza.
- **Detección de drift — fingerprint de forma**: por cada fuente×snapshot se computa un fingerprint estructural (set de paths/keys presentes + sus tipos). Al ingestar, se compara contra el último fingerprint conocido de esa fuente; si difiere, se inserta una fila `drift_alert` y se loguea, en lugar de corromper en silencio o fallar duro. La validación zod estricta queda para los normalizadores (Fase 5+), no para la capa de ingesta cruda.
- **Caché / no-re-pedir** — llave de caché = hash de (fuente, endpoint, params normalizados, date-bucket diario). Misma llave dentro del día → se sirve el snapshot cacheado, no se re-pide a la fuente. El crudo se guarda en R2 content-addressed por `sha256` (append-only, inmutable); Postgres guarda solo la referencia (`r2_path`, `hash`) + metadatos de `source_snapshot` / `ingest_run`.

### Políticas no negociables (de PROJECT.md / research)
- Rate-limit 2–3s entre requests al MISMO origen, User-Agent identificatorio (`Bot-Ciudadano/1.0 (consulta ciudadana Chile; contacto@dominio.cl)`), respeto de robots.txt. El WAF gubernamental bloquea ráfagas (sella riesgo WAF).
- Todas las llamadas a fuentes externas corren en backend (CORS), nunca desde el navegador.
- Backoff exponencial + cola ante 429.
- Procedencia (origen, fecha de captura, enlace original) capturada en el momento de ingesta, no agregada después.

### Claude's Discretion
- Forma concreta de la interfaz `Connector` (métodos fetch/parse/normalize), nombres de tablas/columnas de control, librería HTTP cliente en Deno, estructura interna de `/packages/ingest`, y mecánica exacta del fingerprint de drift quedan a discreción durante el planning, respetando las decisiones de arriba.
- Política de retención de snapshots en R2 a largo plazo: no urgente en M1, default razonable (conservar todo) salvo que el plan sugiera lo contrario.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield — no hay código aún. Esta fase crea el scaffolding del monorepo.

### Established Patterns
- Stack y patrones canónicos definidos en `.planning/research/STACK.md` y `ARCHITECTURE.md`: pipeline de procedencia (R2 inmutable → Postgres derivado), orquestación pgmq+pg_cron+pg_net+Edge Functions, caché/chunking desde el día 1.

### Integration Points
- Fase 2 (Providers LLM/Embeddings) consumirá `/packages/core`.
- Fases 3–7 (identidad, conectores concretos) heredarán el framework de `/packages/ingest` y la cola.
</code_context>

<specifics>
## Specific Ideas

- El crudo es la fuente de verdad inmutable y append-only; Postgres es una proyección derivada y reconstruible (re-procesable sin re-scrapear). Esto es lo que hace defendible la trazabilidad y barato el re-procesamiento.
- Verificación clave de aceptación: un backfill completo sin un solo 403/429 por ráfaga.
</specifics>

<deferred>
## Deferred Ideas

- Conectores concretos por fuente (Cámara doGet.asmx, Senado wspublico, BCN obtxml, WebForms, Next.js __NEXT_DATA__) → Fases 5–7.
- Providers LLM/Embeddings → Fase 2.
- Mecanismo concreto de respaldo de la tabla de identidades fuera de Supabase → Fase 3.
</deferred>
