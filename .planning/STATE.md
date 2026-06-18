---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-04-PLAN.md
last_updated: "2026-06-18T17:05:48.347Z"
last_activity: 2026-06-18
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 18
  completed_plans: 17
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-17)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 05 — tramitacion-core-ficha-timeline-votaciones

## Current Position

Phase: 05 (tramitacion-core-ficha-timeline-votaciones) — EXECUTING
Plan: 5 of 5
Status: Ready to execute
Last activity: 2026-06-18

Progress: [██████████] 100% (3/3 planes de la fase 04 completos)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 11min | 3 tasks | 16 files |
| Phase 01 P02 | 9min | 3 tasks | 25 files |
| Phase 01 P03 | 18min | 2 tasks | 9 files |
| Phase 02 P01 | 8min | 3 tasks | 18 files |
| Phase 02 P02 | 3min | 2 tasks | 7 files |
| Phase 02 P03 | 5min | 1 tasks | 2 files |
| Phase 03 P01 | 14min | 3 tasks | 13 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 03 P03 | 18min | 3 tasks | 14 files |
| Phase 03 P04 | 14min | 3 tasks | 13 files |
| Phase 04 P01 | 9min | 3 tasks | 13 files |
| Phase 04 P02 | 4min | 2 tasks | 2 files |
| Phase 04 P03 | 12min | 3 tasks | 10 files |
| Phase 05 P01 | 8min | 3 tasks | 16 files |
| Phase 05 P02 | 7min | 3 tasks | 13 files |
| Phase 05 P03 | 8min | 2 tasks | 5 files |
| Phase 05 P04 | 30min | 4 tasks | 36 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: M1 = Fundaciones + Identidad + P2 Tramitación + P1 Búsqueda semántica; 7 fases en orden de dependencia dura
- [Roadmap]: Identidad dividida en determinista (P3, desbloquea Tramitación) y adjudicación LLM + gate (P4, sella riesgo existencial #1)
- [Roadmap]: Conectores ordenados por fragilidad ascendente — JSON/XML (P5) antes que WebForms/Next.js (P6)
- [Phase ?]: [01-01]: verifyDepsBeforeRun:false en pnpm-workspace.yaml para que el gate de build-scripts no aborte typecheck/test
- [Phase ?]: [01-01]: puertos locales de Supabase remapeados a 544xx para evitar colision con otro proyecto activo
- [Phase ?]: [01-01]: raw-immutable/normalized-derived — source_snapshot guarda solo r2_path/content_hash, crudo nunca en Postgres (FND-02)
- [Phase 01]: [01-02]: rate-limiter serial por host (Map host->cola encadenada); primer request sin espera, subsiguientes 2-3s+jitter (FND-01)
- [Phase 01]: [01-02]: BaseConnector Template Method fija el flujo invariante; ningun conector puede saltarse rateLimiter.wait
- [Phase 01]: [01-02]: R2 inmutable via aws4fetch + If-None-Match:* (412=idempotente); drift no-bloqueante (FND-02/FND-04)
- [Phase ?]: [01-03]: orquestacion clon de automatic embeddings — pg_cron -> dispatcher SQL -> pgmq.read(vt) -> pg_net -> Edge Function; vt=backoff, read_ct>5 -> ingest_dlq (FND-05)
- [Phase ?]: [01-03]: service_key/project_url via helpers util.* (vault/GUC), nunca literal en la migracion (T-01-09/T-01-10)
- [Phase ?]: [01-03]: worker.ts comparte buildConnector entre Edge Function y GitHub Actions (mismo conector); index.ts solo bootstrap Deno.serve
- [Phase ?]: [02-01]: compuerta zod UNICA y externa al adapter (parseAndValidate); ningun provider hace su propio safeParse
- [Phase ?]: [02-01]: router fail-closed sin fallback (personal+trainsOnInputs -> SensitiveRoutingError); barrel index.ts propiedad de 02-01
- [Phase 02]: [02-02]: MiniMax structured output = tool-calling forzado (tool_choice fija emit_result), NO response_format; lee tool_calls[0].function.arguments y valida por la misma compuerta externa
- [Phase 02]: [02-02]: data-routing en codigo — assertNoRutInLlmInput (RUT nunca al LLM, error sin el RUT) + assertSensitivityAllowed reusa SensitiveRoutingError; smoke test live gated por LLM_SMOKE (skip default)
- [Phase ?]: [02-03]: REST directo (batchEmbedContents) con fetchFn inyectable; @google/genai 2.8.0 no expone inyeccion de fetch publica (Assumption A4)
- [Phase ?]: [02-03]: GeminiEmbeddingProvider L2-normaliza manual a 768 (Gemini no normaliza a dims!=3072); todo vector versionado, ninguno anonimo (FND-07)
- [Phase ?]: [03-01]: ñ→n folding solo para la clave de comparación; display usa campos originales (A1)
- [Phase ?]: [03-01]: matchDeterminista fail-closed, único escritor de estado; confirma solo con length===1 (RUT exacto o nombre único en cámara+periodo)
- [Phase ?]: [03-01]: apellido materno fuera del blocking key → catálogo y formato-votación convergen; materno va a alias_capturados
- [Phase ?]: [03-02]: estado default no_confirmado por DDL — promocion a confirmado es revision humana (ID-01)
- [Phase ?]: [03-02]: claves naturales via indices unicos PARCIALES → upsert idempotente sin obligar NOT NULL
- [Phase ?]: [03-03]: seeder reusa @obs/ingest (assertAllowedUrl->robots->rateLimiter.wait->fetcher.get), NO BaseConnector; idempotencia en clave natural del upsert
- [Phase ?]: [03-03]: periodo senadores='senado-vigente-2026', diputados='2026-2030'; partidoVigente filtra la Militancia que cubre el corte 2026-03-11 (Pitfall 5)
- [Phase ?]: [03-03]: exportMaestra determinista -> snapshot git autoritativo (ID-09 HOY); R2 gateado por r2Enabled=false (401 diferido)
- [Phase 03]: [03-04]: upsert por PK `id` (derivada de la clave natural), NO por la clave natural directa — ON CONFLICT no puede targetear los indices unicos PARCIALES de 0005
- [Phase 03]: [03-04]: corrida LIVE real -> maestra de 186 filas (31 senadores + 155 diputados, 0 errores 403/429) cargada en Supabase local + snapshot git autoritativo (ID-09)
- [Phase 03]: [03-04]: lote promovido a confirmado por operador-accept de la orquestacion (conteos = catalogos oficiales autoritativos); el seeder nunca auto-confirma (ID-01)
- [Phase 03]: [03-04]: backup-parlamentario.yml (cron semanal) usa --preserve-estado sin --promote -> nunca revierte la compuerta humana; R2 gateado por presencia de credencial (401 hoy)
- [Phase 04]: [04-01]: UMBRAL=0.90 con < ESTRICTO — confidence===0.90 auto-acepta, 0.8999 revision (bug existencial #1 sellado con test de borde mandatorio)
- [Phase 04]: [04-01]: auto-aceptar mapea SOLO a 'probable', NUNCA 'confirmado' (A4); la compuerta es pura, el orquestador mapea el estado
- [Phase 04]: [04-01]: mencion foranea SIN rut por diseno; assertNoRutInLlmInput sobre el prompt final ensamblado; region fail-open en el blocking
- [Phase 04]: [04-01]: CompletionRequest.temperature? opcional via spread condicional en MiniMax (A1) — 68 tests @obs/llm verdes sin cambios
- [Phase 04]: [04-02]: identidad_audit inmutable por trigger BEFORE UPDATE OR DELETE (RAISE EXCEPTION, errcode restrict_violation=23001) — unica defensa que aplica al service role que bypassa RLS — MAS REVOKE update/delete/truncate (defensa en profundidad, ID-08/Pitfall 4)
- [Phase 04]: [04-02]: vinculo_identidad.estado default no_confirmado + parlamentario_id nullable; indice unico PARCIAL (camara,periodo,mencion_normalizada) where id is not null para idempotencia del vinculo resuelto (ID-06)
- [Phase 04]: [04-02]: candidatos jsonb SIN rut (minimizacion); pgTAP prueba inmutabilidad con throws_ok 23001 sobre UPDATE y DELETE como superuser (peor caso = service role)
- [Phase 04]: [04-03]: correrPipeline orquesta etapas 0-3 (determinista reuse corta antes del LLM; RUT aborta antes de complete con 0 llamadas) y devuelve resultado discriminado; escribe una fila de identidad_audit por decision
- [Phase 04]: [04-03]: auto-aceptar del LLM mapea SOLO a 'probable'; promocion a 'confirmado' es EXCLUSIVA de humano (revisor-cli confirm/correct) o determinista (A4/ID-06)
- [Phase 04]: [04-03]: revisor-cli valida id numerico + revisor no vacio + chosen-id /^P\\d{5}$/ ANTES de tocar la DB; resolverRevision atomico contra estado='pendiente' (afectadas===0 -> error sin colaterales); cada resolucion escribe audit metodo='humano' con revisor_id+timestamp
- [Phase 04]: [04-03]: golden set 22 casos = gate de deploy mockeado (precision>=0.95 toBeGreaterThanOrEqual -> falla bloquea CI; auto-aceptar id equivocado = fp); LIVE gated por IDENTITY_GOLDEN_LIVE no quema cuota; region fail-open SOLO ante ausencia de region (no entre dos regiones distintas)
- [Phase ?]: [Phase 05]: [05-01]: RLS public-read EXPLICITO (policy for select to anon using(true)) + GRANT SELECT en las 4 tablas de tramitacion — el deny-by-default heredado dejaria la ficha en blanco (Pitfall 5/T-05-01); parlamentario intacta
- [Phase ?]: [Phase 05]: [05-01]: voto.parlamentario_id nullable+FK a la maestra — NULL salvo vinculo determinista/confirmado; mencion_nombre crudo se conserva para display (T-05-02, guarda LOCKED)
- [Phase ?]: [Phase 05]: [05-01]: slice.e2e.test.ts en RED por imports ausentes — diana walking-skeleton que olas 2-4 vuelven verde; fixtures reales cross-camara 14309/18296 capturados live
- [Phase ?]: 05-02: parsers leen ambos juegos de nombres de totales (TotalAfirmativos/TotalSi) — fixture = ground truth
- [Phase ?]: 05-02: fusionarTimeline empate estable Cámara-antes-Senado; fechas null al final
- [Phase 05]: 05-03: voto Cámara cruza determinísticamente por Diputado/Id (sin LLM); Senado por nombre vía correrPipeline con guarda LOCKED — solo determinista/confirmado puebla parlamentario_id
- [Phase ?]: Frontend ficha: Server Components leen Supabase con anon key server-only (sin NEXT_PUBLIC_); Tailwind v4 + shadcn oficial; barra y timeline en CSS puro
- [Phase ?]: Guarda de identidad en UI (TRAM-06): VotoRow enlaza al parlamentario SOLO si estado_vinculo=confirmado; si no, nombre crudo + IdentityMarker, nunca link

### Pending Todos

None yet.

### Blockers/Concerns

- [Research flag P5/P6]: conectores WebForms y portal Next.js del Senado son frágiles — spike de validación end-to-end antes de planificar
- [Research flag P7]: calidad de extracción LLM sobre texto legal en español es el cuello de botella — construir golden set y benchmarkear antes de comprometer el prompt
- [v2/anotado]: `opendata.camara.cl` (voto individual) sin validar — bloquea P3/M2, no M1
- [Pre-release bloqueante]: pasada de asesoría legal (framing UI + manejo de datos, Ley 21.719) antes del lanzamiento público

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-18T17:05:48.338Z
Stopped at: Completed 05-04-PLAN.md
Resume file: None
