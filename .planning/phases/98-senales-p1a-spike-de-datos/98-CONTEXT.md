# Phase 98: SEÑALES P1a — SPIKE de datos: qué señales son honestas (gate del panel) - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning
**Mode:** Autonomous (data-audit SPIKE — smart discuss minimal context)

<domain>
## Phase Boundary

SPIKE de datos empírico que GATEA 99 y 100. Decide, con evidencia contra la DB viva, QUÉ señales candidatas del panel de actualidad son honestas ANTES de construir cualquier frontend. Entrega un documento de clasificación (honesta / sesgada / imposible) por señal + verdict binario de la señal "leyes recién publicadas" (BCN/Cámara) + verificación de que la similitud de voto es computable HOY (insumo de Phase 102).

NO construye frontend. NO materializa nada (eso es Phase 99). NO toca fuentes con ráfagas (curl-first, rate-limit 2-3s SOLO si evalúa BCN/Cámara). Es lectura/auditoría + un verdict de viabilidad de ingesta.

</domain>

<decisions>
## Implementation Decisions

### Señales candidatas a clasificar (SC1 — LOCKED)
- velocity (movimiento reciente por ventana), nuevos ingresos, urgencias del Ejecutivo, agenda próxima, archivados/retirados, leyes recién publicadas.
- Cada una: honesta / sesgada / imposible, CON evidencia (query + conteo real).
- **`fecha_captura` JAMÁS es "fecha de ingreso"** (backfill masivo la hace mentirosa — reloj real = `tramitacion_evento`). Si una señal requiere fecha de ingreso y no hay `fecha_ingreso` explícito, se clasifica condicional/imposible con la evidencia.

### Auditoría de tramitacion_evento (SC2 — LOCKED, Pitfall #1 y #2)
- Medir frescura (¿hasta qué fecha hay eventos por fuente?) y cobertura por cámara.
- Declarar sesgo Cámara/Senado por señal (Cámara HTML/WAF frágil vs Senado XML limpio → "más movimiento" puede ser artefacto de mejor scraping).
- Principio rector: una fuente STALE debe poder SUPRIMIRSE ("sin datos frescos de esta fuente"), JAMÁS afirmarse como "sin movimiento". Ausencia ≠ hecho.
- Verificar fiabilidad del primer-evento por boletín (¿sirve como proxy de ingreso?).

### Leyes recién publicadas (SC3 — LOCKED)
- Evaluar BCN `portada_ulp` y/o Cámara `leyes_promulgadas.aspx` con verdict BINARIO.
- curl-first ante WAF; rate-limit; NO ráfagas. Solo evaluación de viabilidad, no ingesta.
- viable → documentar que entra por dos-etapas fuente→R2→Supabase en una fase futura (SEN-06); no-viable → DIFERIDA documentada con la razón.

### Similitud de voto computable HOY (SC4 — LOCKED, insumo Phase 102)
- Verificar contra DB viva: `voto.estado_vinculo='confirmado'` cubre ~548.642 votos / 186 parlamentarios (la DB viva desmiente el "backfill pendiente" de memorias viejas — evidencia concluyente pero VERIFICAR, no asumir).
- Confirmar que la reconciliación de identidad NO fabrica votantes (fail-closed).
- Denominador honesto disponible: votaciones sustantivas donde ambos votaron.

### Restricciones de ejecución (LOCKED)
- Queries DB viva SIEMPRE read-only: `set -a; source .env; set +a`; JAMÁS imprimir la URL/keys. Filtro `not exists (pg_depend deptype='e')` sobre pg_proc/grants para evitar falsos positivos.
- PostgREST/psql: paginar si aplica; este spike usa psql directo (no la API).
- Entregable = documento(s) de hallazgos en la carpeta de fase, NO cambios de schema ni migraciones.

### Claude's Discretion
Estructura exacta del documento de clasificación, qué queries concretas correr, cómo medir frescura (max(fecha) por fuente / histograma). Preferir evidencia numérica reproducible (cada afirmación con su query).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tramitacion_evento`, `proyecto.materia`, freshness por fuente YA existen en el schema.
- `voto` con `estado_vinculo` y ~548k filas ya en DB (v7.0 backfill corrió — memoria v10-milestone-preparado lo marca como "votos YA en DB 548k/186").
- `cruce_senal`/0039 + `materializar_cruces()` = patrón espejo para el materializador de Phase 99 (referencia, no se toca aquí).
- `.env` tiene `SUPABASE_DB_URL` (psql directo funciona; DDL vía `db push --db-url` documentado — aquí solo SELECT).

### Established Patterns
- Freshness ya se muestra en el sitio (`UltimaActualizacion`, actualidad-module.tsx tiles de frescura).
- pgTAP idiom con filtro pg_depend extension para no contar objetos de extensiones.

### Integration Points
- Salida de este spike ALIMENTA Phase 99 (qué señales materializar y con qué guardas de supresión) y Phase 102 (similitud de voto confirmada computable).

</code_context>

<specifics>
## Specific Ideas

- Los 4 success criteria del ROADMAP son el contrato. Cada uno cierra con evidencia (query + resultado real contra la DB viva bctyygbmqcvizyplktuw).
- Verificación de votos: `select count(*) from voto where estado_vinculo='confirmado'` + distinct parlamentarios + que no haya votantes sin identidad confirmada creando ruido.
- Frescura: `max(fecha_evento)` (o el campo real de fecha del evento, NO fecha_captura) por cámara/fuente, y antigüedad relativa a hoy.

</specifics>

<deferred>
## Deferred Ideas

- Materializador `actualidad_senal` + RPCs + cron → Phase 99.
- Construir la señal "leyes publicadas" (ingesta real dos-etapas) → fase futura SEN-06 SOLO si el verdict de este spike es viable.
- Similitud de voto con caveat base-alta + flag → Phase 102.

</deferred>
