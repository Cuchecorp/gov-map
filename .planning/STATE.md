---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Completed 03-01-PLAN.md (identidad pura: normalizarNombre + matchDeterminista fail-closed)"
last_updated: "2026-06-18T12:41:20.047Z"
last_activity: 2026-06-18
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 10
  completed_plans: 7
  percent: 29
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-17)

**Core value:** La ciudadanía puede responder, sobre cualquier proyecto de ley o parlamentario, "qué pasó, cuándo y según qué fuente" — cada dato con fuente, fecha y enlace, sin afirmar intención ni causalidad.
**Current focus:** Phase 03 — tabla-maestra-parlamentario-identidad-determinista

## Current Position

Phase: 03 (tabla-maestra-parlamentario-identidad-determinista) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-06-18

Progress: [██████████] 100% (3/3 planes de la fase 01 completos)

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

Last session: 2026-06-18T12:41:20.039Z
Stopped at: Completed 03-01-PLAN.md (identidad pura: normalizarNombre + matchDeterminista fail-closed)
Resume file: None
