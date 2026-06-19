# Phase 9: Completitud de Identidad — Backfill RUT + Invariante de Writer + Piso PII - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Generalizar la guarda de identidad de v1.0 a las nuevas fuentes de v2.0 ANTES de que escriba el primer dataset de atribución (lobby/dinero/probidad). Tres entregables: (1) completar el `rut` interno de la maestra de parlamentarios (backfill server-side, nunca expuesto a `anon`); (2) convertir la guarda de enlace-confirmado en un invariante TIPADO a nivel de writer (estructural, no convención); (3) dejar el piso de RLS/data-routing para toda PII nueva. NO construye conectores de fuentes nuevas ni fichas — solo la infraestructura de identidad/seguridad que todo lo demás reusa.

</domain>

<decisions>
## Implementation Decisions

### Completitud de identidad
- **Fuente del RUT (research-gated):** investigar fuentes oficiales que expongan el RUT de los parlamentarios — Senado `senadores_vigentes.php` (¿incluye RUT?), BCN/Congreso open data, perfiles de `opendata.camara.cl`. Si ninguna fuente estructurada lo entrega, usar una lista curada server-side con provenance por fila. El research de la fase DEBE resolver la fuente concreta antes de planear el conector de backfill. Hallazgo confirmado: la maestra (`supabase/seeds/parlamentario.seed.json`, 186 filas) tiene el campo `rut` pero 0 poblados.
- **Invariante de writer tipado:** un tipo branded (p.ej. `EnlaceConfirmado`) producido SOLO por una factory única que la reconciliación invoca tras un resultado `determinista`/`confirmado`. Los `*Writer` aceptan ese tipo (no un `string`/`number` crudo) para fijar `parlamentario_id`. Resultado: es estructuralmente imposible fijar el FK sin pasar por la reconciliación — `probable`/`revision`/`no_confirmado` dejan NULL + mención cruda + marca de identidad no verificada. Reusa/espeja la guarda LOCKED de v1.0 (TRAM-06) pero la sube de convención a tipo.
- **Extensión del golden set:** agregar validador de DV del RUT (módulo-11), tag persona natural vs jurídica, y casos de homónimos + colisión de RUT propios de SERVEL/ChileCompra. El gate CI ≥0.95 sigue bloqueando (sin tocar el umbral de v1.0).
- **Piso RLS/PII:** una convención + helper de migración para que toda columna PII nueva nazca oculta a `anon` (deny-by-default / sin GRANT SELECT a anon, espejo exacto de `parlamentario.rut` en v1.0). Extender la compuerta `data-routing` del LLM (`assertNoRutInLlmInput` / `assertSensitivityAllowed`) para que ningún RUT/PII nuevo pueda llegar al LLM.

### Aplicación del DDL (operativo)
- El archivo de migración se crea en `supabase/migrations/` como parte de la fase. La APLICACIÓN al Supabase (local/nube) puede ser un paso de operador separado: memoria del proyecto dice que el push remoto de DDL está bloqueado (service key ≠ management PAT, probado 2026-06-18), y v1.0 dejó un blocker de aplicar 0011 al local. El plan debe degradar honestamente: build/typecheck no prueban que el DDL esté aplicado (falso-positivo) → marcar la aplicación como verificación humana/operador si no se puede aplicar en el entorno.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/identity` — `normalizarNombre`, `matchDeterminista` (fail-closed), pipeline de reconciliación.
- `@obs/adjudication` — `correrPipeline` (determinista → blocking → LLM → compuerta UMBRAL 0.90), golden set (22 casos, gate CI ≥0.95), `identidad_audit` inmutable.
- `@obs/llm` — `assertNoRutInLlmInput`, `assertSensitivityAllowed`, `SensitiveRoutingError` (data-routing en código).
- v1.0 patrón TRAM-06: `voto.parlamentario_id` nullable, poblado SOLO en `determinista`/`confirmado`; `VotoRow`/`IdentityMarker` enlazan solo si `confirmado`. Este es el patrón que se sube a invariante tipado.
- `parlamentario` master + `parlamentario.rut` con RLS deny-by-default (anon NO lee rut) — el espejo a replicar para toda PII nueva.
- `supabase/seeds/parlamentario.seed.json` (186 filas, campo `rut` presente pero vacío; tiene `id_diputado_camara` y `parlid_senado`).
- `@obs/ingest` — política LOCKED para el conector de backfill si la fuente del RUT es remota.

### Established Patterns
- Migraciones numeradas en `supabase/migrations/` (última v1.0: 0011); RLS public-read EXPLÍCITO en tablas públicas, deny-by-default en PII.
- Reconciliación: solo `determinista` puebla el FK en cruces por nombre (Senado); Cámara cruza por id oficial.

### Integration Points
- El invariante tipado vivirá donde lo consuman los writers de Phase 11/12/14/15 (probablemente en `@obs/identity` o `@obs/adjudication`).
- El backfill escribe `parlamentario.rut` (uso interno).
- La extensión data-routing vive en `@obs/llm`.

</code_context>

<specifics>
## Specific Ideas

- El invariante debe ser imposible de evadir por un writer nuevo escrito en Phase 11+: la firma del writer NO debe aceptar un `parlamentario_id: string` desnudo.
- RUT siempre uso interno: ninguna columna/endpoint nuevo lo expone a `anon`. La verificación pgTAP debe probar que anon NO lee el RUT ni la PII nueva.
- Si la fuente del RUT no es alcanzable en este entorno, degradar a lista curada con provenance — nunca fabricar un RUT.

</specifics>

<deferred>
## Deferred Ideas

- Conectores de fuentes nuevas (lobby/probidad/dinero) y sus sub-maestras → Phases 11/12/14/15.
- Fichas/UI de parlamentario → Phases 10+.
- La compuerta legal de exposición → Phases 13/17.

</deferred>
