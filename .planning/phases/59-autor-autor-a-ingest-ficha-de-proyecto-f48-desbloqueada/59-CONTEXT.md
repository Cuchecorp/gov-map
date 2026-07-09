# Phase 59: AUTOR — Autoría ingest + ficha de proyecto (F48) - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Smart discuss autónomo (recomendaciones auto-aceptadas por directiva del operador)

<domain>
## Phase Boundary

Poblar la autoría de proyectos de ley (hoy 0/136) vía pipeline conforme a la convención LOCKED (crudo→R2→Supabase) con reconciliación fail-closed contra la maestra, y montar la sección de autoría en la ficha de proyecto (F48 diferida de v5). AUTOR-01 + AUTOR-02. Nada de similares nuevos (ya existen kNN de v1); nada de flags gated.

</domain>

<decisions>
## Implementation Decisions

### Modelo de datos
- Tabla relacional `proyecto_autor` (NO un campo jsonb en proyecto): boletín FK, `autor_crudo` (mención literal de la fuente), `parlamentario_id` nullable (SOLO match determinista/confirmado — EnlaceConfirmado branded como en votos), `camara_origen` si la fuente lo da, provenance inline (fuente, fecha_captura, url). Clave natural (boletin, autor_crudo normalizado) para upsert idempotente.
- Migración ADDITIVA nueva (siguiente número libre en supabase/migrations) con RLS public-read explícito (espejo de tramitación 0008: anon SÍ lee, PII de maestra intacta) + pgTAP. APPLY a PROD autorizado (precedente v5: DDL additivo público aplicado autónomamente vía psql --db-url + schema_migrations; NUNCA db push). Si el pgTAP falla → rollback y blocker honesto.

### Fuente de autores
- El researcher confirma el mejor origen SIN asumir: candidatos (a) XML Senado `tramitacion.php?boletin` (nodo autores/parlamentarios patrocinantes), (b) Cámara `doGet.asmx` ficha de proyecto, (c) crudo ya existente en R2. Preferencia: lo que ya esté en R2 (convención: R2 primero); si el crudo existente no trae autores, la corrida descarga fuente→R2 (Etapa 1) y luego R2→Supabase (Etapa 2) usando los seams de Phase 57 (`--from-r2`, putImmutable {existed}).
- Mociones tienen autores parlamentarios; MENSAJES (ejecutivo) no tienen autores parlamentarios → estado honesto "Mensaje del Ejecutivo" (no fabricar autoría). El modelo debe distinguir tipo de iniciativa si la fuente lo da.

### Reconciliación (riesgo existencial #1)
- SOLO `matchDeterminista` (nombre único en cámara+periodo o id oficial si la fuente lo trae) puebla `parlamentario_id`; todo lo demás queda `autor_crudo` + NULL. CERO LLM en este pipeline (nombres de parlamentarios = maestra existente, determinista basta). Espejo exacto del patrón de votos Senado (correrPipeline NO se usa si no hay ambigüedad que resolver; preferir matchDeterminista puro como en seeder).
- RUT jamás involucrado.

### Corrida LIVE
- Autorizada y acotada: corpus actual (~74-136 boletines conocidos: set proyecto ∪ citacion_punto ∪ sesion_tabla_item, el mismo set del cron leyes). Rate-limit 2-3s, idempotente, reanudable. Segunda corrida = 0 upserts nuevos (criterio 2, verificar en logs).
- Integrar la autoría al cron leyes-weekly (que la corrida semanal mantenga autores frescos) si el costo es bajo; si no, CLI separado documentado en el runbook.

### Ficha (F48, patrón F55)
- Nueva sección/carril `#autores` en `/proyecto/[boletin]`: acordeón colapsado por defecto con conteo visible en el header (patrón CarrilAccordion/DetalleColapsable de F55), guarda de identidad LOCKED: link a `/parlamentario/[id]` SOLO si confirmado; si no, nombre crudo + IdentityMarker. ProvenanceBadge (fuente+fecha+enlace).
- Estado honesto: sección AUSENTE del DOM si no hay filas de autoría para el boletín (criterio 4); para mensajes del Ejecutivo, si la fuente lo identifica, línea "Iniciativa: Mensaje del Ejecutivo" en el header en vez de sección de autores.
- RPC o SELECT public-read directo: seguir el patrón existente de la ficha (las tablas de tramitación son public-read; una tabla public-read nueva se lee igual que votacion/tramitacion_evento — sin RPC nuevo salvo que el patrón existente lo exija).
- Anti-insinuación: la sección de autores NO compone con votos/dinero/lobby (carril propio mt-12 hermano).

### UI-SPEC
- No se genera UI-SPEC separado: el contrato visual ya está LOCKED por DESIGN-SYSTEM.md + patrón F55 + guarda de identidad TRAM-06. El plan cita esos documentos como contrato.

### Claude's Discretion
- Nombre exacto de columnas, orden de la sección entre carriles existentes, textos de copy (es-CL sobrio, vocabulario no-causal).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/tramitacion`: parsers XML Cámara/Senado + conectores + `SupabaseTramitacionWriter` idempotente + ingest-cli con `--from-r2` (Phase 57) — la ingesta de autores vive aquí.
- `@obs/identity`: `normalizarNombre` + `matchDeterminista` fail-closed + maestra 186 filas.
- Ficha: `app/proyecto/[boletin]/` con carriles, `IdentityMarker`, `ProvenanceBadge`, `VotoRow` (guarda de identidad como analog), F55 `DetalleColapsable`.
- Migraciones espejo: 0008 (tramitación public-read + pgTAP).

### Established Patterns
- Upsert por clave natural; provenance por fila; corrida LIVE acotada con flags; degradación honesta.
- Migración a PROD: psql --db-url --single-transaction + fila en schema_migrations + pgTAP vs PROD (jamás db push). BOM/PGCLIENTENCODING gotchas.

### Integration Points
- leyes-weekly.yml / run-tramitacion-prod-cli (cron ya verde tras 57) — la autoría se cuelga de ese flujo.
- Phase 61 (COMP) barrerá la nueva sección con BrowserOS.

</code_context>

<specifics>
## Specific Ideas
- "Quién presentó este proyecto" es pregunta ciudadana núcleo — el título de la sección debe responderla directamente (patrón de títulos orientados a pregunta de v5/COMP-03).
</specifics>

<deferred>
## Deferred Ideas
- Vista agregada "proyectos por autor" en la ficha de parlamentario (cruce inverso) — milestone futuro.
- Similares v2 (mejoras kNN) — fuera de alcance.
</deferred>
