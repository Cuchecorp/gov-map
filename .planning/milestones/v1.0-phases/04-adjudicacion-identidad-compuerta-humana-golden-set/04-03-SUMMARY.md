---
phase: 04-adjudicacion-identidad-compuerta-humana-golden-set
plan: 03
subsystem: adjudicacion
tags: [pipeline, orquestacion, revisor-cli, golden-set, gate-de-deploy, audit, vitest, tdd]

# Dependency graph
requires:
  - phase: 04-01
    provides: "generarCandidatos, AdjudicacionSchema, construirPromptAdjudicacion, aplicarCompuerta, MockMiniMaxProvider, MencionForanea"
  - phase: 04-02
    provides: "DDL vinculo_identidad / revision_identidad / identidad_audit (append-only por trigger+REVOKE)"
  - phase: 03-01
    provides: "matchDeterminista (Etapa 0), Mention/Resolution"
  - phase: 02
    provides: "LLMProvider, MiniMaxProvider, assertNoRutInLlmInput, assertSensitivityAllowed"
provides:
  - "correrPipeline() — orquesta etapas 0-3 (determinista reuse → blocking → LLM mock → compuerta) + escribe una fila de identidad_audit por decisión"
  - "RevisionWriter — escritor Supabase mockeable de cola/vínculo/audit (appendAudit SOLO insert)"
  - "revisor-cli (ID-05): list/show/confirm/reject/correct con revisor_id + timestamp; confirm/correct promueven el vínculo a 'confirmado' metodo='humano'"
  - "GOLDEN_SET (22 casos) + evaluarGolden() — gate de deploy mockeado (precisión ≥0.95) + bloque LIVE gated por IDENTITY_GOLDEN_LIVE"
affects: [adjudicacion, identidad, compuerta-humana, golden-set, fases-5-7-conectores]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipeline fail-closed por etapas: determinista corta antes del LLM; RUT aborta antes de complete (0 llamadas)"
    - "Promoción a 'confirmado' EXCLUSIVA de humano/determinista; el LLM auto-acepta solo a 'probable' (A4)"
    - "Audit append-only app-side: appendAudit jamás emite update (coherente con el trigger+REVOKE de 04-02)"
    - "Gate de deploy mockeado: precisión ≥0.95 con toBeGreaterThanOrEqual; LIVE gated por env (no quema cuota en CI)"
    - "Resolución de cola atómica contra estado='pendiente'; afectadas===0 → error sin escrituras colaterales"

key-files:
  created:
    - packages/adjudication/src/pipeline.ts
    - packages/adjudication/src/pipeline.test.ts
    - packages/adjudication/src/writer-revision.ts
    - packages/adjudication/src/writer-revision.test.ts
    - packages/adjudication/src/revisor-cli.ts
    - packages/adjudication/src/revisor-cli.test.ts
    - packages/adjudication/src/golden/golden-set.ts
    - packages/adjudication/src/golden/golden-set.test.ts
  modified:
    - packages/adjudication/src/index.ts
    - packages/adjudication/package.json

key-decisions:
  - "correrPipeline devuelve un resultado discriminado ({tipo:'determinista'|'no_confirmado'|'probable'|'revision'}) para que golden/caller lo evalúen sin re-leer la DB"
  - "evaluarGolden vive en golden-set.ts (no en el test) para re-exportarlo desde el barrel; el test solo lo consume"
  - "La región del blocking es fail-open SOLO ante ausencia (un lado null); dos regiones presentes y distintas SÍ descartan (semántica de 04-01) — el caso de golden se ajustó a mención sin región"
  - "revisor-cli espeja seed-cli (entry-point por regex, funciones exportadas testeables con writer inyectable); confirm/correct = único camino a 'confirmado' (A4/T-04-10)"

patterns-established:
  - "PipelineWriter como subconjunto inyectable del RevisionWriter (espía in-memory en tests/golden, Supabase real en prod)"
  - "Mock keyed por nombreOriginal del prompt; casos que no llegan al LLM (blocking 0 / determinista) no consultan el mock"

requirements-completed: [ID-03, ID-04, ID-05, ID-06, ID-07, ID-08]

# Metrics
duration: 12min
completed: 2026-06-18
---

# Phase 4 Plan 03: Pipeline + Revisor CLI + Golden Set Summary

**Cierra el slice vertical de Fase 4: `correrPipeline` orquesta las cuatro etapas (determinista reuse → blocking → LLM mock → compuerta fail-closed) escribiendo una fila de `identidad_audit` por decisión; el `revisor-cli` (ID-05) confirma/rechaza/corrige con `revisor_id`+timestamp y promueve a `confirmado` (único camino humano, A4); y el `golden set` de 22 casos corre como gate de deploy mockeado (precisión ≥0.95 → falla = bloquea CI) con un bloque LIVE gated por `IDENTITY_GOLDEN_LIVE`. 54 tests verdes (+1 LIVE skip), sin red.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-18
- **Tasks:** 3
- **Files modified:** 10 (8 creados en @obs/adjudication, 2 modificados: index.ts + package.json)

## Accomplishments

- **Pipeline (etapas 0-3, ID-03/04/08):** `correrPipeline(mencion, maestra, provider, writer)`:
  - Etapa 0 — `matchDeterminista` (reuse de @obs/identity) 'confirmado' → vínculo confirmado metodo='determinista' + audit, **0 llamadas al LLM**.
  - Etapa 1 — blocking 0 candidatos → vínculo no_confirmado + audit, **0 llamadas al LLM**.
  - Etapa 2 — `assertNoRutInLlmInput(prompt EXACTO)` + `assertSensitivityAllowed` → `provider.complete(..., AdjudicacionSchema, temperature:0)`.
  - Etapa 3 — `aplicarCompuerta`: auto-aceptar → vínculo **'probable'** metodo='llm' (NUNCA 'confirmado', A4) + audit (confidence/modelo_version); revision → `enqueueRevision` (pendiente) con candidatos+salida_modelo + audit.
  - Fail-closed PII: un RUT que se colaría al prompt lanza ANTES de `complete` (0 llamadas; nada confirmado).
- **RevisionWriter (espeja SupabaseMaestraWriter):** `enqueueRevision`/`upsertVinculo`/`appendAudit` + métodos de cola (`listarPendientes`/`obtenerCaso`/`resolverRevision`). `appendAudit` SOLO insert (append-only app-side, coherente con el trigger+REVOKE de 04-02). Errores se propagan sin exponer la service key.
- **revisor-cli (ID-05/06):** list/show/confirm/reject/correct con cliente Supabase mockeado. `confirm`/`correct` promueven el vínculo a `confirmado` metodo='humano' y escriben audit metodo='humano' con `revisor_id`+`resolved_at` (T-04-11). Valida `id` numérico + `revisor` no vacío + `chosen-id` /^P\d{5}$/ **ANTES** de cualquier escritura (V5/T-04-10). `resolverRevision` atómico contra `estado='pendiente'`; id inexistente/ya resuelto → error claro sin escrituras colaterales. Script `revisor` (tsx) en package.json.
- **Golden set (ID-07):** 22 casos etiquetados cubriendo las 5 categorías obligatorias + "Walker P., Matías" + `no_match` + región fail-open. `evaluarGolden` cuenta tp/fp/fn (un auto-aceptar de id equivocado = fp, pesa al máximo). MODO CI mockeado: `PRECISION_MIN=0.95`, `expect(precision).toBeGreaterThanOrEqual(0.95)` → un fallo BLOQUEA el deploy (medido: precisión 1.000, recall 1.000). MODO LIVE gated por `IDENTITY_GOLDEN_LIVE==="1"` con `MiniMaxProvider` real + `it.skipIf(!MINIMAX_API_KEY)` — skip por defecto (no quema cuota, T-04-12).

## Task Commits

1. **Task 1: Pipeline etapas 0-3 + RevisionWriter** - `58db605` (feat)
2. **Task 2: revisor-cli list/show/confirm/reject/correct + audit humano** - `1f619f2` (feat)
3. **Task 3: Golden set + gate de deploy mockeado + LIVE gated** - `0da07dc` (feat)

## Files Created/Modified

- `packages/adjudication/src/pipeline.ts` - `correrPipeline` (etapas 0-3) + `PipelineWriter` + `ResultadoPipeline` discriminado.
- `packages/adjudication/src/pipeline.test.ts` - 5 tests: Etapa 0 (0 LLM), Etapa 1 (0 LLM), happy probable (A4), revisión, fail-closed PII.
- `packages/adjudication/src/writer-revision.ts` - `RevisionWriter` (cola/vínculo/audit + métodos de cola); appendAudit SOLO insert.
- `packages/adjudication/src/writer-revision.test.ts` - 5 tests: enqueue/upsert/append + propagación de error sin secretos.
- `packages/adjudication/src/revisor-cli.ts` - CLI list/show/confirm/reject/correct; validación pre-escritura; promoción humana a confirmado.
- `packages/adjudication/src/revisor-cli.test.ts` - 10 tests: list/show, confirm/reject/correct, validación de input, id inexistente/ya resuelto.
- `packages/adjudication/src/golden/golden-set.ts` - `GOLDEN_SET` (22 casos) + `evaluarGolden` + `MetricasGolden`.
- `packages/adjudication/src/golden/golden-set.test.ts` - cobertura de categorías + gate de precisión/recall + bloque LIVE gated.
- `packages/adjudication/src/index.ts` - re-export de pipeline, writer, golden set + evaluarGolden.
- `packages/adjudication/package.json` - script `revisor` (tsx).

## Decisions Made

- **Resultado discriminado del pipeline:** `correrPipeline` retorna `{tipo, ...}` (determinista/no_confirmado/probable/revision) para que el golden y los callers de Fases 5+ evalúen sin re-leer la DB. La compuerta sigue pura; el pipeline hace el I/O.
- **`evaluarGolden` en golden-set.ts (no en el test):** permite re-exportarlo desde el barrel (`@obs/adjudication`) para reusarlo en jobs/CLI futuros; el test solo lo consume.
- **Región fail-open SOLO ante ausencia:** la semántica de 04-01 descarta cuando ambos lados traen región y difieren; el caso de golden de "región distinta" se modeló como mención SIN región (el escenario fail-open real: no perder al candidato por ausencia de dato).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Caso de golden "región distinta" mal modelado (región presente y distinta)**
- **Found during:** Task 3 (corrida de `evaluarGolden`)
- **Issue:** El caso g02 traía región "Valparaíso" en la mención y "Coquimbo" en el catálogo. El blocking de 04-01 descarta cuando AMBOS lados traen región y difieren (no es fail-open en ese caso), dejando 0 candidatos → el caso se volvía `no_confirmado` (fn) en vez de match. El premise del caso era incorrecto.
- **Fix:** Se cambió la mención a `region: null` (el escenario fail-open genuino: la fuente foránea no siempre trae región y el candidato con región NO debe perderse). Recall pasó de 0.955 a 1.000.
- **Files modified:** packages/adjudication/src/golden/golden-set.ts
- **Verification:** `evaluarGolden` → precision 1.000, recall 1.000, 0 fp/fn.
- **Committed in:** `0da07dc` (Task 3)

**2. [Rule 3 - Blocking] Colisión de clave del mock por `nombreOriginal` duplicado**
- **Found during:** Task 3
- **Issue:** Tres casos compartían `nombreOriginal="Walker, Matías"` (uno match, dos no_match). El mock keyed por nombre colisionaba: el último (no_match) sobrescribía el valor del caso match. Los no_match no consultan el mock (blocking 0), pero el caso match sí, recibiendo la respuesta equivocada.
- **Fix:** Se renombró el caso match a "Walker Prieto, Matías" (único). Los dos no_match conservan "Walker, Matías" sin riesgo (no consultan el mock).
- **Files modified:** packages/adjudication/src/golden/golden-set.ts
- **Committed in:** `0da07dc` (Task 3)

**3. [Rule 3 - Blocking] Import de `PipelineWriter` desde el módulo equivocado**
- **Found during:** Task 3 (typecheck)
- **Issue:** `golden-set.ts` importaba `PipelineWriter` desde `../writer-revision`, pero el tipo se exporta desde `../pipeline`. `tsc -b` fallaba (TS2305).
- **Fix:** Se corrigió el import a `../pipeline`.
- **Files modified:** packages/adjudication/src/golden/golden-set.ts
- **Committed in:** `0da07dc` (Task 3)

**Total deviations:** 3 auto-fixed (1 bug de modelado del golden, 2 bloqueantes de Task 3). Sin scope creep.

## Threat Model Coverage

- **T-04-08 (Tampering / afirmación falsa via gate):** mitigado — `evaluarGolden` cuenta un auto-aceptar de id equivocado como fp (pesa al máximo); `expect(precision).toBeGreaterThanOrEqual(0.95)` mockeado FALLA = bloquea CI; incluye los casos difíciles canónicos.
- **T-04-09 (Information Disclosure / RUT al LLM):** mitigado — `assertNoRutInLlmInput(prompt EXACTO)` + `assertSensitivityAllowed` antes de `complete`; test de RUT con 0 llamadas al provider.
- **T-04-10 (Elevation of Privilege / revisor escribe confirmado):** mitigado — solo confirm/correct (humano) promueven a `confirmado` metodo='humano'; valida revisor_id no vacío + id numérico antes de escribir; tests de input inválido sin escrituras.
- **T-04-11 (Repudiation / resolución sin trazabilidad):** mitigado — cada resolución del CLI escribe `identidad_audit` (append-only de 04-02) con revisor_id + created_at.
- **T-04-12 (DoS/Quota / golden LIVE en CI):** mitigado — CI corre SIEMPRE mockeado; LIVE gated por `IDENTITY_GOLDEN_LIVE`, skip por defecto.
- **T-04-SC (npm/pnpm installs):** N/A — sin paquetes nuevos.

## Issues Encountered

- La semántica fail-open de región (04-01) requiere modelar el caso de golden con mención SIN región (no con regiones distintas). Resuelto en deviation 1.

## User Setup Required

None — la suite corre 100% con mock determinista (sin red, sin cuota MiniMax). El revisor-cli LIVE requiere `SUPABASE_LOCAL_SERVICE_KEY` (Supabase local); el golden LIVE requiere `IDENTITY_GOLDEN_LIVE=1` + `MINIMAX_API_KEY`. Ambos opcionales y gated.

## Next Phase Readiness

- El slice vertical de identidad asistida está COMPLETO: dado un registro ambiguo, el sistema genera candidatos, adjudica, aplica la compuerta, deja en probable/cola, o un revisor lo confirma — auditado inmutablemente; y el golden set bloquea el deploy si la precisión cae. Sello del riesgo existencial #1.
- **Fases 5-7 (conectores):** producirán los registros foráneos (votos por nombre, etc.) que `correrPipeline` reconcilia contra la maestra. El contrato (`MencionForanea` + `PipelineWriter`) está estable.
- **Operación:** correr el golden LIVE una vez (`IDENTITY_GOLDEN_LIVE=1 MINIMAX_API_KEY=… pnpm --filter @obs/adjudication test --run golden-set`) para registrar la precisión real de MiniMax-M3 antes de comprometer el prompt en volumen.
- Sin blockers.

## Self-Check: PASSED

Archivos declarados existen y los 3 commits de tarea están en el historial:
- Archivos: pipeline.ts, pipeline.test.ts, writer-revision.ts, writer-revision.test.ts, revisor-cli.ts, revisor-cli.test.ts, golden/golden-set.ts, golden/golden-set.test.ts — todos FOUND.
- Commits: 58db605 (Task 1), 1f619f2 (Task 2), 0da07dc (Task 3) — todos FOUND.

---
*Phase: 04-adjudicacion-identidad-compuerta-humana-golden-set*
*Completed: 2026-06-18*
