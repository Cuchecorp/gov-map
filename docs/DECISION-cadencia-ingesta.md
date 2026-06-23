# Decisión anotada — cadencia de ingesta (agenda vs proyectos de ley)

**Estado:** ABIERTA (anotada, NO implementada). Revisar antes de subir minutos del cron.
**Fecha:** 2026-06-23 · **Contexto:** post-transfer a Cuchecorp/gov-map (hay minutos de Actions).

## Decisión vigente
Crons **semanales**:
- `agenda-weekly` — lunes 11:00 UTC (citaciones Cámara+Senado + tabla de sala).
- `leyes-weekly` — viernes 20:00 UTC (tramitación + votos).

## Tensión detectada (operador)
Las **citaciones de comisión se MODIFICAN hasta ~martes AM** y algunas se **SUSPENDEN**
(`estado` = "Suspendida" / "Sin efecto"). Un único pase el **lunes** muestra una agenda que
puede quedar **desactualizada toda la semana**: una citación suspendida el martes seguiría
apareciendo como vigente hasta el lunes siguiente. Para una herramienta que la gente consulta
"¿qué pasa esta semana en el Congreso?", eso es un dato incorrecto en vivo.

## Opción considerada — hash-check DIARIO (L–V) para citaciones
Re-fetch diario de las citaciones de la semana vigente, **comparar por hash** contra el último
crudo, y **saltar el upsert si no cambió** (sale temprano). Solo escribe cuando hubo
modificación/suspensión. Alineado con la regla LOCKED del repo: *"hash-check ANTES de descargar;
si no cambió, NO re-ingestar"* y *ingesta en 2 etapas fuente→R2 crudo→Supabase*.

- **Costo:** ~5× los días de corrida, pero cada corrida es barata (fetch + hash; el upsert solo
  ocurre ante cambio). Acotable a la semana vigente (no histórico).
- **Alcance:** SOLO citaciones (lo volátil). La **tabla de sala** y los **proyectos de ley**
  pueden seguir semanales (cambian menos intra-semana; los votos se consolidan al cierre).

## Hallazgos del enjambre de revisión (2026-06-23) — confirmados por validadores Opus
1. **El upsert YA refleja `estado`** (Suspendida/Sin efecto) al re-correr. `upsertCitaciones`
   usa `upsert(..., { onConflict:"id", ignoreDuplicates:false })` → UPDATE en conflicto; el
   parser puebla `estado` (Cámara desde el `<p style=color:red>`, Senado desde `sinEfecto`).
   ⇒ **el problema NO es el writer, es la FRECUENCIA**: un cambio del martes no se refleja hasta
   el lunes siguiente (hasta 6 días stale).
2. **NO existe hash-check para citaciones.** `@obs/agenda` re-fetchea y re-upserta sin etapa R2
   ni ETag/If-Modified (deuda pre-existente, declarada opcional en la fase). Cada corrida pega
   al endpoint de Cámara protegido por WAF.
3. **⚠️ Orden obligatorio (los validadores Opus lo marcaron):** ampliar el cron a diario L–V
   **SIN** un gate de hash-check PRIMERO **empeora** la postura: quintuplica los fetch contra el
   WAF de Cámara (403/curl) y viola la regla LOCKED "hash-check ANTES de descargar / salir
   temprano si no hay novedades". **Hash-check primero, después ampliar el cron.**

## Recomendación (cerrada, lista para implementar como fase aparte)
**Solo citaciones** → cron **diario L–V**, PERO con este orden:
1. Añadir gate de hash-check en `ingest-run` (antes de parse+upsert de citaciones): persistir el
   crudo content-addressed en R2 (etapa 1, como ya hace la tabla Cámara) o un `sha256` por
   `source_key` en una tabla `agenda_fetch_cache`; si el SHA no cambió, **salir temprano** (sin
   parse, sin upsert, sin escritura DB). NO usar `BaseConnector.run` (su caché diaria suprimiría
   re-corridas legítimas) — replicar solo el hash-check manteniendo el orden
   `assertAllowedUrl→robots→rateLimiter→fetcher`.
2. Recién entonces cambiar `agenda-weekly.yml` de `0 11 * * 1` a `0 11 * * 1-5` (o separar las
   citaciones a su propio workflow diario; dejar tabla de sala y leyes semanales).
3. Medir minutos en Cuchecorp tras el cambio.

**Mientras tanto** (no implementado): el cron semanal del lunes sigue, y `workflow_dispatch`
permite un refresh manual a mitad de semana si hace falta capturar una suspensión puntual.

> Decisión: NO se implementa en esta sesión (es una fase con DDL + R2 propios). Queda anotada y
> priorizada. Disparador para retomarla: tras el transfer, cuando haya minutos confirmados.
