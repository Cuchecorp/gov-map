---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
plan: 03
subsystem: tramitacion
tags: [tramitacion, reconciliacion-votos, identidad, guarda-locked, correr-pipeline, determinista-por-id, tdd, riesgo-existencial-1]

# Dependency graph
requires:
  - "05-02: parseCamaraVotoDetalle (voto-a-voto Cámara por Diputado/Id) + parseSenadoVotacion (voto-a-voto Senado por nombre)"
  - "05-01: modelo Voto + VotoSchema (parlamentario_id nullable, estado_vinculo/metodo) + slice.e2e.test.ts Test 4 RED"
  - "04-03: correrPipeline (etapas 0-3, resultado discriminado) + PipelineWriter + MockMiniMaxProvider + MencionForanea"
  - "03-01: normalizarNombre (clave de comparación) + matchDeterminista (vía pipeline) + Parlamentario.id_diputado_camara"
provides:
  - "reconciliarVotosCamara: voto-a-voto Cámara → Voto[] con parlamentario_id determinista por Diputado/Id (sin LLM)"
  - "reconciliarVotosSenado: voto-a-voto Senado por nombre → correrPipeline → Voto[] (guarda LOCKED: solo determinista vincula)"
  - "Slice E2E Test 4 verde → los 4 tests del slice ciudadano end-to-end pasan"
affects: [tramitacion, frontend-ficha, writer-ingesta-ola4]

# Tech tracking
tech-stack:
  added: []
  patterns: [cruce-determinista-por-id-camara, reconciliacion-por-nombre-via-pipeline, guarda-locked-solo-determinista-vincula, fail-closed-id-ausente, provider-writer-inyectables, tdd-red-green]

key-files:
  created:
    - packages/tramitacion/src/reconciliar-camara.ts
    - packages/tramitacion/src/reconciliar-camara.test.ts
    - packages/tramitacion/src/reconciliar-senado.ts
    - packages/tramitacion/src/reconciliar-senado.test.ts
  modified:
    - packages/tramitacion/src/index.ts

key-decisions:
  - "Cámara cruza por Diputado/Id contra id_diputado_camara (identificador oficial, no nombre): determinista, sin LLM, sin riesgo; Id ausente → no_confirmado fail-closed"
  - "Senado pasa por correrPipeline (Fase 4); GUARDA LOCKED: SOLO tipo==='determinista' puebla voto.parlamentario_id; probable/revision/no_confirmado → null + mención cruda"
  - "Firma de reconciliarVotosSenado adaptada al contrato del slice E2E: (votos, maestra, opts?) en vez de (votos, votacionId, maestra, provider, writer) — el slice llama reconciliarVotosSenado(votos, [])"
  - "PROVIDER_AUSENTE lanza si se invoca + NOOP_WRITER descarta: sin provider inyectado, un voto ambiguo degrada fail-closed (los deterministas no tocan el LLM)"
  - "LLMProvider tipado vía Parameters<typeof correrPipeline>[2] para evitar un edge de dependencia directo a @obs/llm (@obs/adjudication ya lo encapsula)"

requirements-completed: [TRAM-06]

# Metrics
duration: 8min
completed: 2026-06-18
---

# Phase 5 Plan 03: Reconciliación del voto-a-voto contra la maestra Summary

**Reconcilia el voto individual de ambas cámaras contra la maestra respetando la guarda de identidad LOCKED (riesgo existencial #1): la Cámara cruza DETERMINÍSTICAMENTE por `Diputado/Id` contra `id_diputado_camara` (sin LLM, identificador oficial), y el Senado cruza por NOMBRE vía `correrPipeline` (Fase 4) donde SOLO un resultado `determinista` puebla `voto.parlamentario_id` — `probable`/`revision`/`no_confirmado` dejan `null` + la mención cruda para mostrar con marca "identidad no verificada". Cierra el Test 4 del slice E2E: los 4 tests ciudadanos end-to-end ya pasan. 59 tests verdes; typecheck exit 0.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-18T16:35:31Z
- **Completed:** 2026-06-18T16:43:00Z
- **Tasks:** 2 (ambas TDD, RED→GREEN)
- **Files:** 4 creados, 1 modificado (barrel)

## Accomplishments

- **`reconciliar-camara.ts` (Task 1, TRAM-06 / T-05-07):** `reconciliarVotosCamara(votosCrudos, votacionId, maestra): Voto[]`. Construye UNA vez un `Map<string, Parlamentario>` por `id_diputado_camara` (saltando null/vacíos). Por cada voto crudo `{ diputadoId, opcion, nombreCrudo }`: si el Id está en el índice → `Voto` con `parlamentario_id=p.id`, `metodo='determinista'`, `estado_vinculo='confirmado'`, `seleccion` preservada (cruce por identificador oficial, MÁS fuerte que por nombre, sin LLM). Si el Id NO está (p.ej. diputado de periodo anterior) → `parlamentario_id=null`, `metodo=null`, `estado_vinculo='no_confirmado'`, conservando `mencion_nombre=nombreCrudo` (fail-closed). Función pura; cada `Voto` validado con `VotoSchema`. 4 tests.
- **`reconciliar-senado.ts` (Task 2, TRAM-06 / T-05-06, guarda LOCKED):** `reconciliarVotosSenado(votosCrudos, maestra, opts?): Promise<Voto[]>`. Por cada voto crudo `{ mencionNombre, seleccion }`: `trim` (Pitfall 3) → `normalizarNombre({ libre })` → `MencionForanea` (`camara:'senado'`, `periodo:'senado-vigente-2026'`, `region:null`) → `correrPipeline(mencion, maestra, provider, writer)`. Mapeo a la guarda LOCKED:
  - `determinista` → `parlamentario_id` poblado, `metodo='determinista'`, `estado_vinculo='confirmado'`.
  - `probable` (auto-aceptar del LLM) → `parlamentario_id=null`, `metodo='llm'`, `estado_vinculo='probable'` (NUNCA vincula a la ficha pública).
  - `revision` / `no_confirmado` → `parlamentario_id=null`, `metodo=null`, `estado_vinculo='no_confirmado'`.
  - En todos los casos `mencion_nombre` crudo conservado para display. `VotoSchema` valida cada fila. 5 tests.
- **Slice E2E Test 4 verde:** `reconciliarVotosSenado(votos, [])` con maestra vacía → todos `parlamentario_id=null` + mención cruda preservada. Los 4 tests del slice ciudadano end-to-end pasan.

## Task Commits

1. **Task 1: reconciliación determinista de Cámara por Diputado/Id** — `20b6cff` (feat)
2. **Task 2: reconciliación del Senado por nombre vía correrPipeline (guarda LOCKED)** — `85e78d4` (feat)

## Files Created/Modified

Ver `key-files` en frontmatter. Destacados:
- `packages/tramitacion/src/reconciliar-camara.ts` — cruce determinista por Id (sin LLM, fail-closed si Id ausente).
- `packages/tramitacion/src/reconciliar-senado.ts` — cruce por nombre vía pipeline; guarda LOCKED (solo determinista vincula).

## Decisions Made

- **Cámara por Id, Senado por nombre (asimetría justificada):** la Cámara entrega un `Diputado/Id` oficial que cruza determinísticamente contra `id_diputado_camara` — sin LLM, sin riesgo de homonimia. El Senado solo entrega el nombre, así que pasa por la maquinaria de identidad asistida (`correrPipeline`) con su compuerta fail-closed. Decisión ADDENDUM del usuario: incluir el voto individual de Cámara ahora.
- **Guarda LOCKED sellada en la capa pública del voto:** aunque `correrPipeline` escriba un vínculo `probable` en `vinculo_identidad` (capa interna), `reconciliarVotosSenado` NO lo refleja como vínculo en `voto.parlamentario_id`. Solo `determinista` cruza a la ficha. Esto es el control del riesgo existencial #1.
- **Firma adaptada al contrato del slice E2E:** el slice (RED de 05-01, locked) llama `reconciliarVotosSenado(votos, [])` — 2.º arg = maestra. El plan describía `(votos, votacionId, maestra, provider, writer)`. Se adoptó `(votos, maestra, opts?)` con `opts.{votacionId,provider,writer}` opcionales (defaults seguros), compatible con AMBOS el slice y los tests ricos.
- **Defaults fail-closed cuando no se inyecta provider/writer:** `PROVIDER_AUSENTE` lanza si un voto ambiguo llegara al LLM (homónimo sin provider real) y `NOOP_WRITER` descarta escrituras; los votos deterministas resuelven sin tocar ninguno (`correrPipeline` corta antes del LLM).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Firma de `reconciliarVotosSenado` reordenada para honrar el contrato del slice E2E**
- **Found during:** Task 2 (integración con `slice.e2e.test.ts`)
- **Issue:** El plan especificaba `reconciliarVotosSenado(votosCrudos, votacionId, maestra, provider, writer)`, pero el slice E2E (contrato RED locked de 05-01) invoca `reconciliarVotosSenado(votos, [])` — el 2.º argumento posicional es la maestra, no el `votacionId`. Las dos firmas son incompatibles en la posición 2.
- **Fix:** Firma `(votosCrudos, maestra, opts?)` con `opts.{votacionId, provider, writer}` opcionales y defaults seguros (`PROVIDER_AUSENTE`/`NOOP_WRITER`/`votacionId=""`). Honra el slice E2E sin debilitar la guarda.
- **Files modified:** packages/tramitacion/src/reconciliar-senado.ts (+ test propio adaptado)
- **Verification:** slice E2E Test 4 + los 5 tests propios verdes; typecheck exit 0.
- **Committed in:** `85e78d4` (Task 2)

**2. [Rule 1 - Bug] Valor `nombre_normalizado` del fixture de test corregido al output real de `normalizarNombre`**
- **Found during:** Task 2 (GREEN inicial: 2 tests rojos)
- **Issue:** El fixture de la maestra de test hardcodeaba `nombre_normalizado: "coloma juan antonio"`, pero `normalizarNombre({ libre: "Coloma C., Juan Antonio" })` produce `"antonio coloma juan"` (tokens ordenados canónicamente). El `matchDeterminista` (dentro del pipeline) no confirmaba porque las claves no coincidían → los tests determinista esperaban `P00500` y recibían `null`.
- **Fix:** Se corrigió el fixture a `"antonio coloma juan"` (el valor real que produciría el seeder con el mismo `normalizarNombre`). Es una corrección del DATO de test, no de la lógica de producción (que ya era correcta: ambos lados se normalizan con la misma función).
- **Files modified:** packages/tramitacion/src/reconciliar-senado.test.ts
- **Verification:** los 5 tests de reconciliar-senado verdes.
- **Committed in:** `85e78d4` (Task 2)

**Total deviations:** 2 auto-fixed (1 blocking de contrato, 1 bug de fixture de test). Sin scope creep, sin cambio de comportamiento de producción.

## Threat Model Coverage

- **T-05-06 (Tampering / falsa afirmación creíble en Senado):** mitigado — SOLO `tipo==='determinista'` puebla `voto.parlamentario_id` en `reconciliarVotosSenado`; `probable` (auto-aceptar LLM) NUNCA vincula a la ficha pública; `revision`/`no_confirmado` → null + mención cruda. Guarda LOCKED sellada por `correrPipeline` (Fase 4). Test "probable → parlamentario_id NULL" lo prueba explícitamente.
- **T-05-07 (Tampering / cruce por Id de Cámara):** aceptado y degradado fail-closed — el cruce por `Diputado/Id` contra `id_diputado_camara` es determinista (Id oficial, no nombre); un Id ausente degrada a `no_confirmado` sin fabricar vínculo. Sin LLM.
- **T-05-08 (Information Disclosure / RUT al LLM en Senado):** mitigado (heredado de Fase 4) — `MencionForanea` por construcción NO transporta RUT; `correrPipeline` reusa `assertNoRutInLlmInput` sobre el prompt exacto antes de `complete`.
- **T-05-SC (npm installs):** N/A — sin paquetes nuevos (`@obs/adjudication`/`@obs/core` ya eran dependencias de `@obs/tramitacion`).

## Known Stubs

- Ninguno. Ambas funciones de reconciliación están completas y testeadas. La persistencia del `Voto[]` resultante a la tabla `voto` (upsert idempotente) la cablea la ola 4 (writer Supabase), consumiendo estas funciones — es trabajo declarado del plan siguiente, no un stub.

## Verification

- `pnpm --filter @obs/tramitacion test`: **59/59 verdes** (incluye los 4 tests del slice E2E completo + 4 de reconciliar-camara + 5 de reconciliar-senado).
- `pnpm -w typecheck`: **exit 0**.
- Slice E2E Test 4 (`reconciliarVotosSenado vincula parlamentario_id solo si determinista/confirmado`): verde con maestra vacía → todos null + mención cruda.

## Next Phase Readiness

- **Ola 4 (writer/ingesta):** consume `reconciliarVotosCamara` (por `parseCamaraVotoDetalle`) y `reconciliarVotosSenado` (por `parseSenadoVotacion(...).votos`) inyectando la maestra real + `MiniMaxProvider` + `RevisionWriter`, y persiste el `Voto[]` resultante con upsert idempotente (clave natural `unique(votacion_id, mencion_nombre)` ya en 0008).
- **Frontend ficha:** `voto.parlamentario_id` poblado SOLO en vínculos confirmados; los demás muestran `mencion_nombre` crudo con marca "identidad no verificada" — la guarda LOCKED es observable en la capa pública.

## Self-Check: PASSED

Archivos declarados existen y los 2 commits de tarea están en el historial:
- Archivos: reconciliar-camara(.test), reconciliar-senado(.test), index.ts — todos FOUND.
- Commits: 20b6cff (T1), 85e78d4 (T2) — verificados abajo.

---
*Phase: 05-tramitaci-n-core-ficha-timeline-votaciones*
*Completed: 2026-06-18*
