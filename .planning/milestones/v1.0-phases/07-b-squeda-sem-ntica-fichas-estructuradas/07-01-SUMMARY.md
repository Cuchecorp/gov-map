---
phase: 07-b-squeda-sem-ntica-fichas-estructuradas
plan: 01
subsystem: ai
tags: [fichas, deepseek, zod, golden-set, pgvector, hnsw, gemini-embeddings, supabase, rls]

# Dependency graph
requires:
  - phase: 02-llm-providers
    provides: DeepSeekProvider.complete + compuerta zod externa + GeminiEmbeddingProvider
  - phase: 05-tramitacion
    provides: parseSenadoTramitacion + ProyectoSchema + modelo común (boletín llave de cruce)
  - phase: 04-adjudicacion
    provides: patrón golden-set-como-gate (mock CI + meta-test fp + LIVE gated)
provides:
  - "@obs/fichas scaffold + FichaSchema/CuerpoLegalSchema (contrato de extracción literal)"
  - "SYSTEM_EXTRACCION + construirPromptExtraccion (prompt restrictivo literal, guardarraíl #2)"
  - "extraer() vía DeepSeek + compuerta zod (sin safeParse propio)"
  - "Golden set de extracción (17 casos gate + 2 adversarios) + gate CI BLOQUEANTE precision>=0.95 (flag P7)"
  - "parseSenadoTramitacion.linkMensajeMocion (sidecar SEM-01)"
  - "GeminiEmbeddingProvider.embed(texts, taskType?) asimétrico (SEM-03)"
  - "Migración 0011: proyecto_ficha + proyecto_embedding(vector(768)) + HNSW + RPC match_proyectos + RLS"
affects: [07-02, 07-03, busqueda-semantica, fichas-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden-set-como-gate de fidelidad literal (substring idea_matriz + F1 cuerpos) espejando @obs/adjudication"
    - "Extracción literal vía provider + compuerta zod externa (SEM-02): nunca safeParse propio"
    - "Sidecar nullable en parser para mínimo blast-radius (no tocar schema/writer existentes)"
    - "taskType aditivo por-request en Gemini (callers sin taskType intactos)"
    - "RPC pgvector: order by distancia cruda <=> (HNSW) + grant execute a anon"

key-files:
  created:
    - packages/fichas/src/model.ts
    - packages/fichas/src/prompt.ts
    - packages/fichas/src/extraer.ts
    - packages/fichas/src/mock-provider.ts
    - packages/fichas/src/golden/golden-set.ts
    - packages/fichas/src/golden/golden-set.test.ts
    - packages/fichas/src/slice.e2e.test.ts
    - supabase/migrations/0011_fichas_embeddings.sql
    - supabase/tests/0011_fichas_embeddings.test.sql
  modified:
    - packages/tramitacion/src/parse-senado-tramitacion.ts
    - packages/llm/src/providers/gemini-embeddings.ts

key-decisions:
  - "extraer usa criticality:'bulk' + sensitivity:'public' (no 'publico'): el contrato real de CompletionRequest"
  - "link_mensaje_mocion devuelto como SIDECAR (no en ProyectoSchema) para no tocar writer/reconciliación de Fase 5"
  - "Gate golden: idea_matriz debe ser substring literal normalizado (NFD+strip diacríticos+whitespace) del texto; F1 por norma+artículos para cuerpos"
  - "2 casos adversarios (idea fabricada + cuerpo fabricado) aislados en IDS_CASOS_ADVERSARIOS para la meta-prueba"

patterns-established:
  - "Extracción literal: provider.complete(SYSTEM_EXTRACCION, FichaSchema), degradación honesta (null) first-class"
  - "Gate CI mockeado SIEMPRE (Pitfall 5): no depende de red ni DEEPSEEK_API_KEY; LIVE gated por FICHAS_GOLDEN_LIVE"

requirements-completed: [SEM-01, SEM-02, SEM-03]

# Metrics
duration: 32min
completed: 2026-06-18
---

# Phase 7 Plan 01: Fundación @obs/fichas + Gate de Extracción + Migración 0011 Summary

**Paquete @obs/fichas con FichaSchema, prompt restrictivo literal, extracción DeepSeek+zod, golden set de fidelidad literal que BLOQUEA CI bajo precision 0.95, parser Senado con link al texto íntegro, Gemini asimétrico y migración 0011 (HNSW + RPC match_proyectos + RLS) — Tasks 1-4 completas; Task 5 (aplicar 0011 al LOCAL) es checkpoint humano pendiente.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-06-18T20:48:00Z (aprox)
- **Completed (Tasks 1-4):** 2026-06-18T21:20:00Z (aprox)
- **Tasks:** 4 de 5 (Task 5 = checkpoint humano bloqueante, pendiente)
- **Files modified:** 13 (11 creados + 2 extendidos)

## Accomplishments

- **@obs/fichas scaffold + contratos**: FichaSchema (idea_matriz nullable + cuerpos_legales[]), SYSTEM_EXTRACCION literal (regla NUNCA), construirPromptExtraccion, barrel.
- **Gate de calidad de extracción (flag P7 sellado)**: golden set de 17 casos del gate + 2 adversarios; `evaluarGolden` mide fidelidad literal (substring idea_matriz + F1 cuerpos); el test `precision >= 0.95` BLOQUEA CI; meta-test prueba que la rama fp es alcanzable (no tautología); bloque LIVE gated por `FICHAS_GOLDEN_LIVE`.
- **extraer()**: extracción vía `DeepSeekProvider.complete(SYSTEM_EXTRACCION, FichaSchema)` sin safeParse propio (SEM-02); criticality bulk + sensitivity public.
- **Parser Senado extendido (SEM-01)**: `parseSenadoTramitacion` ahora devuelve `linkMensajeMocion` (sidecar nullable) — punto de entrada de la ola 2 al texto íntegro.
- **Gemini asimétrico (SEM-03)**: `embed(texts, taskType?)` aditivo (RETRIEVAL_DOCUMENT/QUERY); callers sin taskType intactos; guard de dims + l2normalize sin cambios.
- **Migración 0011**: proyecto_ficha + proyecto_embedding(vector(768)) + índice HNSW vector_cosine_ops + RPC match_proyectos (self-exclusion + threshold, order by distancia cruda) + grant execute a anon + RLS public-read; pgTAP con 20 asserts.
- **slice.e2e.test.ts en RED**: diana walking-skeleton importando correrPipeline/buscarProyectos (olas 2-3 los vuelven verde).

## Task Commits

1. **Task 1: Scaffold @obs/fichas + FichaSchema + prompt + slice E2E RED** - `4fc82f7` (feat)
2. **Task 2: extraer + golden set + gate CI BLOQUEANTE (flag P7)** - `1221cb3` (feat)
3. **Task 3: parser Senado link_mensaje_mocion + Gemini taskType** - `c5c4031` (feat)
4. **Task 4: migración 0011 + pgTAP** - `7100358` (feat)

**Plan metadata:** (commit de docs final tras checkpoint)

## Files Created/Modified

- `packages/fichas/package.json|tsconfig.json|vitest.config.ts` - scaffold workspace @obs/fichas
- `packages/fichas/src/model.ts` - FichaSchema + CuerpoLegalSchema (contrato salida LLM)
- `packages/fichas/src/prompt.ts` - SYSTEM_EXTRACCION literal + construirPromptExtraccion
- `packages/fichas/src/extraer.ts` - extracción vía provider + compuerta zod
- `packages/fichas/src/mock-provider.ts` - MockDeepSeekProvider keyed por texto fuente
- `packages/fichas/src/golden/golden-set.ts` - 17+2 casos + evaluarGolden (fidelidad literal)
- `packages/fichas/src/golden/golden-set.test.ts` - gate CI bloqueante + meta-test + LIVE gated
- `packages/fichas/src/slice.e2e.test.ts` - diana E2E en RED
- `packages/fichas/src/index.ts` - barrel
- `packages/tramitacion/src/parse-senado-tramitacion.ts` - +linkMensajeMocion (sidecar SEM-01)
- `packages/llm/src/providers/gemini-embeddings.ts` - +taskType asimétrico (SEM-03)
- `supabase/migrations/0011_fichas_embeddings.sql` - tablas + HNSW + RPC + RLS
- `supabase/tests/0011_fichas_embeddings.test.sql` - pgTAP (20 asserts)

## Decisions Made

- **`sensitivity: "public"` + `criticality: "bulk"`** (no `"publico"`): el contrato real de `CompletionRequest` en @obs/llm usa `"public" | "personal"` y exige `criticality`. El bloque `<interfaces>` del plan mostraba `"publico"` ilustrativo; se aplicó el tipo real (deviación Rule 3 — type-mismatch bloqueante).
- **link_mensaje_mocion como sidecar** (no en ProyectoSchema): mínimo blast-radius; el writer/reconciliación de Fase 5 no conocen el campo y siguen intactos.
- **Métrica del gate**: idea_matriz por substring literal normalizado (NFD + strip diacríticos + whitespace colapsado) — tolera mayúsculas/acentos sin tolerar paráfrasis; cuerpos por F1 sobre clave norma+artículos.
- **2 casos adversarios** (idea fabricada + cuerpo fabricado) aislados para la meta-prueba de que el gate puede fallar de verdad.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Contrato de CompletionRequest: `sensitivity` y `criticality`**
- **Found during:** Task 2 (extraer.ts)
- **Issue:** El plan (`<interfaces>`) ilustraba `sensitivity: "publico"|...` sin `criticality`. El tipo real `CompletionRequest` (@obs/llm) define `sensitivity: "public" | "personal"` y `criticality: "critical" | "bulk"` (requerido). Usar `"publico"` o omitir `criticality` no tipa.
- **Fix:** `extraer` llama con `criticality: "bulk"` + `sensitivity: "public"` (tier DeepSeek, texto público).
- **Files modified:** packages/fichas/src/extraer.ts
- **Verification:** `pnpm --filter @obs/fichas typecheck` y tests de extraer verdes.
- **Committed in:** `1221cb3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking type-mismatch).
**Impact on plan:** Ajuste de contrato necesario para compilar; sin scope creep.

## Issues Encountered

- El filtro `vitest -t "senado-tramitacion"` no matchea por nombre de archivo (los describe se llaman "parseSenadoTramitacion — ..."); se verificó corriendo por ruta de archivo (`vitest run src/parse-senado-tramitacion.test.ts`) — 11 tests verdes incl. las 2 nuevas aserciones de link_mensaje_mocion.

## Pending Checkpoint (Task 5 — BLOCKING human-action)

**Task 5 NO ejecutada por diseño** (checkpoint:human-action gate="blocking"). La migración 0011 está escrita y validada estáticamente (grep + pgTAP file), pero **aplicarla al Supabase LOCAL (Docker) requiere acción del operador** — el build/typecheck pasan SIN la migración aplicada (falso-positivo de verificación), por eso aplicar al LOCAL es obligatorio antes de que la ola 2 escriba fichas/embeddings y la ola 3 invoque el RPC. El push REMOTO de DDL está bloqueado (service key, no PAT de management — probado 2026-06-18) y es un paso de operador separado, fuera de autonomía.

Ver el bloque "CHECKPOINT REACHED" devuelto al orquestador para los pasos exactos de verificación y la señal de resume ("aplicada").

## Test Verification (Tasks 1-4)

- `pnpm --filter @obs/fichas test` — model (7) + extraer (3) + golden (8, 1 LIVE skip) verdes; slice.e2e en RED (diana, esperado).
- `pnpm --filter @obs/fichas typecheck` — limpio.
- `pnpm --filter @obs/llm test` — 72 verdes (+4 taskType, sin regresión).
- `pnpm --filter @obs/tramitacion` parser — 11 verdes (+2 link_mensaje_mocion).
- Migración 0011: grant execute=1, vector_cosine_ops=1, order-by-distancia=1, public_read=2, sin datos personales.

## Next Phase Readiness

- Contratos en mano para olas 2-3: FichaSchema, SYSTEM_EXTRACCION, extraer, RPC match_proyectos, taskType, linkMensajeMocion.
- **Bloqueador:** Task 5 (aplicar 0011 al LOCAL) debe resolverse antes de la ola 2 (escritura de fichas/embeddings) y la ola 3 (RPC).

## Self-Check: PASSED

- Archivos creados verificados en disco: model.ts, prompt.ts, extraer.ts, golden-set.ts, golden-set.test.ts, slice.e2e.test.ts, 0011_fichas_embeddings.sql, 0011_fichas_embeddings.test.sql — todos FOUND.
- Commits verificados en git log: 4fc82f7 (Task 1), 1221cb3 (Task 2), c5c4031 (Task 3), 7100358 (Task 4) — todos FOUND.

---
*Phase: 07-b-squeda-sem-ntica-fichas-estructuradas*
*Tasks 1-4 completed: 2026-06-18 — Task 5 pending blocking checkpoint*

---

## Checkpoint Task 5 — RESUELTO (2026-06-18): aplicado a la NUBE (no local)

**Decisión del operador:** cutover a Supabase nube en vez de aplicar a local (el operador no quería datos en local). DB password provisto por el operador para esta sesión (a ROTAR post-sesión — quedó en el transcript).

**Acción ejecutada:** las 11 migraciones (0001..0011) aplicadas en orden al proyecto nube `bctyygbmqcvizyplktuw` (región sa-east-1, vía pooler IPv4 `aws-1-sa-east-1.pooler.supabase.com:5432`; el host directo es IPv6-only y la máquina no tiene IPv6). Tracking registrado en `supabase_migrations.schema_migrations`. El proyecto nube estaba vacío (0 tablas) → cutover limpio.

**Verificación 0011 en vivo (nube):** proyecto_ficha + proyecto_embedding existen; embedding = vector(768); índice HNSW `proyecto_embedding_hnsw`; RPC `match_proyectos` con `anon execute=true`; RLS habilitado + 1 policy public-read por tabla; smoke `match_proyectos(vector cero,5)` ejecuta sin permiso denegado (filas=0, corpus vacío).

**Pendientes operativos (follow-up, no bloquean el código de la fase):**
- Wiring de env de la app para nube: `SUPABASE_URL`=https://bctyygbmqcvizyplktuw.supabase.co + anon/publishable key de la nube (hoy el .env tiene `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`). `SUPABASE_DB_URL` (pooler) ya escrita en .env.
- Carga de corpus a la nube: las tablas están vacías; correr los conectores de Fases 5/6 (proyectos/votaciones) apuntando a la nube + backfill de fichas/embeddings (Ola 2) para tener qué buscar.
- Orquestación (0003): cron jobs apuntan a Edge Functions no desplegadas; setear vault secrets (project_url, ingest_worker_secret) + deploy de funciones cuando se quiera ingesta automática en nube.
- **ROTAR el DB password** (quedó expuesto en el chat de esta sesión).

**Estado plan 07-01:** Tasks 1-5 COMPLETAS. SEM-01/02/03 contratos entregados. Listo para Olas 2/3.
