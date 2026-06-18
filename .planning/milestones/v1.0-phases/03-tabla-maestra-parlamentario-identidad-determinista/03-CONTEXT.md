# Phase 3: Tabla Maestra Parlamentario + Identidad Determinista - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega el cimiento de identidad: una tabla maestra `Parlamentario` sembrada con datos REALES de Cámara y Senado, con reconciliación determinista (sin LLM) que resuelve los matches no ambiguos, y un respaldo periódico fuera de Supabase. Cubre ID-01 (maestra sembrada con revisión humana), ID-02 (match determinista RUT/nombre-sin-homónimo, sin LLM), ID-09 (respaldo fuera de Supabase). NO incluye la adjudicación LLM de casos dudosos ni el golden set (eso es Fase 4). NO incluye conectores de tramitación/votaciones (Fase 5+).
</domain>

<decisions>
## Implementation Decisions

### Q1 — Siembra (live now, ajustada a credenciales reales)
- **Seeder que usa el framework de Fase 1** (rate-limit, UA, provenance) para traer en VIVO el catálogo real:
  - **Senado**: `https://tramitacion.senado.cl/wspublico/senadores_vigentes.php` — XML CONFIRMADO live (200, 12.9KB). Campos: `PARLID`, `PARLAPELLIDOPATERNO`, `PARLAPELLIDOMATERNO`, `PARLNOMBRE`, `REGION`, `CIRCUNSCRIPCION`, `PARTIDO`, `EMAIL`, `CURRICULUM`.
  - **Cámara**: catálogo de diputados vigentes con su ID. `doGet.asmx` confirmado live (getLegislaturas → Leg.374=ID58). El endpoint exacto del catálogo de diputados (lista con id_diputado, nombre, distrito, bancada) lo fija el research/ejecución (p.ej. un método doGet de diputados o la página de diputados); usar el de la legislatura vigente (ID 58).
- **Estado inicial `confirmado` requiere revisión humana**, no auto-generado: el seeder produce el dataset; la promoción a `confirmado` pasa por una compuerta (en esta fase, el operador acepta el lote sembrado tras una corrida de verificación — los catálogos oficiales son autoritativos para los vigentes).
- **Realidad de credenciales (sondeada 2026-06-18):** el `.env` permite LEER los catálogos en vivo, pero:
  - **Supabase remoto:** `SUPABASE_SECRET_KEY` es `sb_secret_…` (service key API, NO un PAT `sbp_` de management) → no puede aplicar DDL en el remoto; el `.env` no trae DB password/connection string. Las migraciones se aplican al **Supabase local** (docker, ya operativo en Fases 1-2). El push al remoto queda como paso de operador (requiere DB password o `supabase link`).
  - **R2:** las credenciales S3 (`R2_ACCESS_KEY_ID/SECRET`) devuelven 401 contra el bucket `observatorio` → el respaldo a R2 queda listo en código pero NO se ejecuta live hasta tener credenciales válidas. (Esto también mantiene abierto el checkpoint R2 de Fase 1.)
- **Por tanto, el "live now" concreto de esta fase =** correr el fetch real de los catálogos, normalizar, y producir el **dataset maestro real como artefacto versionado en git** (`.planning/seeds/` o `supabase/seeds/` JSON) + cargarlo al Supabase **local**. Ese artefacto en git ES el respaldo fuera de Supabase (cumple ID-09) y es la fuente para el push al remoto cuando haya credencial.

### Q2 — Normalización de nombres (LOCKED)
- Función `normalizarNombre` documentada y con tests: fold de acentos (NFD + strip diacríticos) y de mayúsculas; parsing de formatos del catálogo y de votaciones ("Apellido P., Nombre" del Senado, "Apellido Paterno Apellido Materno, Nombre" de la Cámara); manejo de apellidos compuestos y partículas (de, del, la); registro de variantes/alias. Produce un `nombre_normalizado` estable + tokens para blocking (Fase 4).

### Q3 — Match determinista (LOCKED, ID-02)
- **RUT exacto** (cuando exista) → `confirmado`, sin LLM.
- **Nombre normalizado dentro de (cámara + periodo)** sin homónimo conocido → `confirmado`, sin LLM.
- **Todo lo demás** (homónimos, sin RUT, cross-cámara ambiguo) NO se auto-acepta → se marca `no_confirmado`/candidato y se deja para la adjudicación LLM + revisión humana de **Fase 4**. Fail-closed: ante duda, no confirmar.

### Q4 — Respaldo fuera de Supabase (LOCKED, ID-09)
- **Job de respaldo** que exporta la maestra a (a) **snapshot JSON versionado en git** (autoritativo, siempre disponible) y (b) **R2** (cuando las credenciales funcionen) reusando el `R2Store` de Fase 1. Periodicidad vía pg_cron/GitHub Actions. El activo más caro de reconstruir (la reconciliación curada) nunca depende solo del free tier de Supabase.

### Modelo de datos
- Tabla `parlamentario`: `id` (interno estable, p.ej. P00001), `nombre_normalizado`, `nombres`, `apellido_paterno`, `apellido_materno`, `camara` (diputados|senado), `periodo`/`legislatura`, `region`, `distrito`/`circunscripcion`, `partido`/`bancada`, `rut` (nullable, uso interno), `parlid_senado` (nullable), `id_diputado_camara` (nullable), `estado` (confirmado|probable|no_confirmado), `email`, provenance (origen, fecha_captura, enlace).
- Tabla `parlamentario_alias` para variantes de nombre.
- (La tabla puente de reconciliación de registros foráneos / adjudicación se materializa en Fase 4; aquí basta la maestra + el matcher determinista como función + sus tests.)

### Claude's Discretion
- Endpoint exacto del catálogo de diputados de la Cámara (research lo fija), nombres finos de columnas, formato del JSON de seed, y mecánica del job de respaldo quedan a discreción del planner respetando lo anterior.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/ingest` (Fase 1): `BaseConnector`, `Fetcher` (rate-limit/UA/robots/allowlist), `R2Store`, parsing XML (fast-xml-parser), provenance. El seeder es un connector/uso del framework. La allowlist de Fase 1 ya incluye senado.cl/camara.cl.
- `@obs/core` (Fase 1): tipos + zod. Tipos de `Parlamentario` pueden vivir aquí.
- Migraciones 0001-0004 + control plane + pgTAP en `supabase/` (Fase 1). Patrón de migración + test establecido.

### Established Patterns
- Tests con fetch inyectable + makeMockFetch (sin red). El seeder se testea con fixtures del XML real de Senado (capturado del live) y del catálogo de Cámara.
- `supabase db reset` / `supabase test db` (pgTAP) para migraciones; Supabase local vía docker.

### Integration Points
- Fase 4 consume la maestra + el matcher determinista (Etapa 0) y agrega la adjudicación LLM (MiniMax via `@obs/llm` de Fase 2) + golden set + revisión humana.
- Fases 5-7 atribuyen votos/proyectos a `parlamentario_id`.
</code_context>

<specifics>
## Specific Ideas

- El XML del Senado ya está confirmado en vivo: usar una muestra real como fixture de tests.
- ID-09 se cumple HOY con el snapshot JSON en git (no depende de R2/remoto).
- Riesgo existencial #1 (identidad): esta fase solo hace lo NO-ambiguo y deja explícitamente lo dudoso a Fase 4 — nada incierto se confirma.
</specifics>

<deferred>
## Deferred Ideas

- Adjudicación LLM de casos dudosos, golden set, compuerta de revisión humana con UI → Fase 4.
- Push de migraciones + datos al Supabase REMOTO y respaldo a R2 live → pendiente de credencial válida (DB password/PAT para remoto; cred S3 correcta para R2). Documentar como paso de operador.
- Conectores de votaciones/tramitación → Fase 5+.
</deferred>
