---
phase: 09-completitud-de-identidad-backfill-rut-invariante-de-writer-p
plan: 02
subsystem: identity
tags: [typescript, rut, backfill, modulo-11, provenance, golden-set, supabase-writer, track-b-curado, persona-juridica]

# Dependency graph
requires:
  - phase: 03-identidad-determinista
    provides: isRutValido (módulo-11) + normRut + SupabaseMaestraWriter (upsert/promote por id) — REUSADOS, no reimplementados
  - phase: 04-adjudicacion-llm
    provides: correrPipeline + golden set + gate ≥0.95 (GOLDEN_SET_GATE) que aquí se extiende con casos de RUT
  - phase: 09-completitud-de-identidad-backfill-rut-invariante-de-writer-p
    plan: 01
    provides: invariante EnlaceConfirmado ya aterrizado (09-01)
provides:
  - "backfill-rut.ts: aceptarRutBackfill (DV-gate isRutValido + provenance, función pura) + runBackfillRut (orquesta filtro -> writer)"
  - "SupabaseMaestraWriter.updateRut: actualiza solo rut+provenance por id (update por fila .eq(id), chunked) — implementa RutBackfillWriter"
  - "parlamentario-rut.seed.json: Track B curado server-side (filas vacío, documentado) — fallback GARANTIZADO; operador puebla con RUTs DV-válidos + provenance"
  - "Golden set +3 casos de RUT (colisión homónimo, persona jurídica, colisión dura) etiquetados al outcome correcto; gate ≥0.95 intacto"
  - "Cobertura nueva de isRutValido (persona jurídica RUT empresa + DV inválido) en deterministic.test.ts"
affects: [phase-12-probidad, phase-14-money, phase-15-servel, rut-cross]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DV-gate antes de escribir: isRutValido (módulo-11, REUSADO) — un RUT inválido o sin provenance se rechaza a un log de revisión, NUNCA se escribe (regla LOCKED nunca-fabricar)"
    - "updateRut por fila (.update({...}).eq(id)) en vez de .in(id, lote): cada fila lleva su propio rut/provenance; el lote acota IO (espeja PROMOTE_CHUNK de promoteToConfirmado)"
    - "Track B como default seguro: lista curada con provenance por fila; Track A (SERVEL) opcional/gateado (un RUT por nombre es candidato, no hecho)"
    - "Casos de RUT en el golden modelados como homónimos de NOMBRE (MencionForanea NO transporta rut, T-04-02): el RUT nunca cruza al LLM; el escenario de colisión se etiqueta al outcome correcto"

key-files:
  created:
    - packages/identity/src/backfill-rut.ts
    - packages/identity/src/backfill-rut.test.ts
    - supabase/seeds/parlamentario-rut.seed.json
  modified:
    - packages/identity/src/writer-supabase.ts
    - packages/identity/src/index.ts
    - packages/adjudication/src/golden/golden-set.ts
    - packages/adjudication/src/golden/golden-set.test.ts
    - packages/identity/src/deterministic.test.ts

key-decisions:
  - "Track B (curado) es el camino entregado; Track A (SERVEL) NO se persiguió: servel.cl responde 200 pero NO hay dataset bulk de RUTs de los 186 parlamentarios cruzable determinísticamente, y un RUT matcheado por nombre es un CANDIDATO, no un hecho (el rut propio de la maestra es NULL → nada lo valida)"
  - "parlamentario-rut.seed.json queda con filas vacío (documentado) — en este entorno NO se dispone de RUTs reales curados; poblarlos es un paso de OPERADOR. NUNCA se escribieron placeholders fabricados"
  - "updateRut es por fila (.eq(id)), no .in(id, lote): cada fila lleva su propio rut, así que un .in() fijaría el mismo valor a todo el lote (incorrecto)"
  - "Los casos de RUT del golden se etiquetan a revisión/no_match (un homónimo no se auto-acepta; un RUT de empresa no colapsa en atribución personal) y NO se mueven al set adversario — el umbral ≥0.95 sigue significativo (Pitfall 5)"

requirements-completed: [IDENT-10, IDENT-11]

# Metrics
duration: 7min
completed: 2026-06-19
---

# Phase 9 Plan 02: Backfill RUT (Track B curado) + Extensión Golden Set Summary

**Máquina de backfill del `rut` interno (DV-gate `isRutValido` módulo-11 + provenance obligatoria + `updateRut` por id, NUNCA fabrica un RUT) con Track B curado como camino garantizado, y golden set extendido con casos de colisión de RUT/homónimo/persona jurídica manteniendo el gate CI ≥0.95 (IDENT-10, IDENT-11).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-19T04:19:51Z
- **Completed:** 2026-06-19T04:26:41Z
- **Tasks:** 2 auto (TDD) + 1 checkpoint (human_verification — ver abajo)
- **Files:** 8 (3 creados, 5 modificados)

## Accomplishments

- **IDENT-10 — máquina de backfill completa:** `aceptarRutBackfill` (función pura) exige provenance (origen/fecha_captura/enlace, `0005` NOT NULL) y DV-valida cada RUT con `isRutValido` (módulo-11, REUSADO de @obs/identity — no reimplementado). Un RUT con DV inválido o sin provenance se rechaza a un log de revisión y **NUNCA llega al writer** (regla LOCKED nunca-fabricar). `runBackfillRut` orquesta el filtro → `writer.updateRut`, devolviendo `{ escritas, rechazadas }`; idempotente.
- **`SupabaseMaestraWriter.updateRut`:** actualiza SOLO `rut`+provenance de los `id` pasados, por fila (`.update({...}).eq("id", ...)`, chunked por `PROMOTE_CHUNK`), espejando `promoteToConfirmado`. Implementa la nueva interfaz `RutBackfillWriter`.
- **Track B curado (`parlamentario-rut.seed.json`):** fallback GARANTIZADO con provenance por fila; documentado e intencionalmente vacío (ningún RUT fabricado).
- **IDENT-11 — golden set extendido:** +3 casos de RUT (colisión por homónimo → revisión; persona jurídica/RUT empresa → no_match; colisión DURA → revisión), etiquetados al outcome correcto y NO movidos al set adversario. El gate corre sobre `GOLDEN_SET_GATE`, la precisión sigue ≥0.95 (umbral sin cambiar) y la meta-prueba "el gate puede fallar" sigue verde. Cobertura nueva de `isRutValido` (persona jurídica + DV inválido) en `deterministic.test.ts`.

## Task Commits

1. **Task 1: backfill-rut DV-gate + provenance + updateRut (IDENT-10)** — `91ef784` (feat)
2. **Task 2: golden set RUT cases + isRutValido coverage (IDENT-11)** — `16aba73` (test)

_TDD: Task 1 escribió el test primero (RED), luego la implementación (GREEN). Hubo un fix de la propia aserción del test (ver Deviaciones — Rule 1)._

## Files Created/Modified

- `packages/identity/src/backfill-rut.ts` — `aceptarRutBackfill` (DV-gate + provenance, pura) + `runBackfillRut` + tipos (`FilaRutCruda`, `FilaRutEscribir`, `RutBackfillWriter`, `RazonRechazo`).
- `packages/identity/src/backfill-rut.test.ts` — tests: DV válido/inválido, provenance faltante/vacía, idempotencia, el writer nunca ve el RUT inválido.
- `packages/identity/src/writer-supabase.ts` — `updateRut` (por fila `.eq(id)`, chunked); la clase ahora implementa `RutBackfillWriter`.
- `packages/identity/src/index.ts` — re-exporta `runBackfillRut`/`aceptarRutBackfill` y tipos del backfill.
- `supabase/seeds/parlamentario-rut.seed.json` — Track B curado (objeto `{_documentacion, filas: []}`); documentado, sin RUTs fabricados.
- `packages/adjudication/src/golden/golden-set.ts` — +3 casos de RUT (g25/g26/g27) etiquetados al outcome correcto.
- `packages/adjudication/src/golden/golden-set.test.ts` — aserción de presencia/labels de los casos de RUT (no en el set adversario).
- `packages/identity/src/deterministic.test.ts` — cobertura de `isRutValido` para persona jurídica (RUT empresa) y DV inválido.

## Decisions Made

- **Track B entregado, Track A NO perseguido:** `servel.cl` responde 200, pero NO hay un dataset bulk de RUTs de los 186 parlamentarios cruzable determinísticamente en este entorno, y un RUT SERVEL matcheado por nombre es un CANDIDATO, no un hecho (el `rut` propio de la maestra es NULL → nada lo valida). Perseguir Track A habría implicado escribir RUTs no verificados — prohibido por la regla LOCKED.
- **`filas: []` documentado, no placeholders:** no se dispone de RUTs reales curados aquí; poblarlos es un paso de operador (declaraciones InfoProbidad / diario oficial). NUNCA se escribió un RUT fabricado.
- **`updateRut` por fila (`.eq(id)`), no `.in(id, lote)`:** cada fila lleva su propio `rut`; un `.in()` fijaría el mismo valor a todo el lote (incorrecto). El lote acota IO.
- **Casos de RUT en el golden via homónimo de NOMBRE:** `MencionForanea` NO transporta `rut` por diseño (T-04-02 — el RUT nunca cruza al LLM). El escenario de colisión de RUT se modela como homónimo y se etiqueta al outcome correcto (revisión/no_match), manteniendo la métrica viva sin meter el RUT al prompt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Aserción de test incorrecta sobre la forma normalizada del RUT**
- **Found during:** Task 1 (RED→GREEN)
- **Issue:** El test esperaba `normRut("12.345.678-5") === "12345678-5"` (con guión). `normRut` elimina TAMBIÉN el guión (es la clave de comparación contra la maestra) → produce `123456785`.
- **Fix:** Se corrigió la aserción del test a `"123456785"` (la forma real de `normRut`); la implementación es correcta (debe normalizar como `normRut` para comparar/almacenar consistentemente con la rama RUT de `matchDeterminista`).
- **Files modified:** packages/identity/src/backfill-rut.test.ts
- **Commit:** 91ef784

**Total deviations:** 1 auto-fixed (1 test-assertion bug). Sin scope creep.

## Human Verification Required (Task 3 — checkpoint:human-verify)

Task 3 del plan es un paso de OPERADOR (decidir track + aplicar el backfill a la DB + re-exportar el seed snapshot). En este entorno autónomo:

1. **Origen de los RUTs (no disponible aquí):** no hay un dataset SERVEL bulk cruzable determinísticamente ni una lista curada de RUTs reales. **`parlamentario-rut.seed.json` queda con `filas: []`.** El OPERADOR debe poblarlo con RUTs DV-válidos + provenance por fila (p.ej. declaraciones de InfoProbidad / diario oficial) — NUNCA placeholders. La máquina (`runBackfillRut`) DV-validará cada uno antes de escribir.
2. **Aplicación a la DB (blocker v1.0 acarreado):** aplicar al Supabase LOCAL es el blocker arrastrado (0011 no aplicado al local). Con RUTs poblados, el operador corre `runBackfillRut` → `updateRut` contra el local (URL 544xx + service key local), o vía `db push --db-url` al remoto (pooler) según memoria del proyecto. **Build/typecheck NO prueban el estado de la DB** (falso positivo — Pitfall 4).
3. **Re-export del seed (dual-write, Pitfall 3):** tras escribir a la DB, re-exportar el snapshot git (`exportMaestra`/`serializeMaestra` → `SEED_PATH`) para que git quede autoritativo (ID-09).
4. **Aserción de paridad (estado actual):** `parlamentario.seed.json` tiene **186 filas, 186 con `rut: null` (0 poblados)**, consistente con el Track B vacío. La paridad DB↔seed se cumple trivialmente HOY (0 == 0); tras un backfill real, el conteo de `rut` no-null del seed debe igualar el de la DB.

**Esto es un human_verification item (límite de entorno: sin fuente de RUTs reales + DB local no aplicada), NO una falla de fase.** La máquina, el writer, el Track B y los casos golden están completos y verdes.

## Verification

- `pnpm --filter @obs/identity test` → 82 tests verdes (3 nuevos de `isRutValido`).
- `pnpm --filter @obs/adjudication test` → 61 tests verdes; gate ≥0.95 sobre `GOLDEN_SET_GATE`; meta-prueba "el gate puede fallar" verde.
- `pnpm --filter @obs/identity typecheck` y `pnpm --filter @obs/adjudication typecheck` → exit 0.
- Nunca-fabricar: el test demuestra que un DV inválido NO llega al writer (no se escribe).

## Threat Model Coverage

- **T-09-04 (RUT fabricado/adivinado):** mitigado — `isRutValido` (módulo-11) gate antes de escribir; inválido → log de revisión, nunca a la DB (Task 1, verificado por test).
- **T-09-05 (RUT SERVEL por nombre):** mitigado — Track A NO perseguido por esta razón; el golden cubre colisión/homónimo/persona-jurídica (Task 2).
- **T-09-06 (backfill parcial como completo):** mitigado — provenance por fila + aserción de paridad documentada (Task 3 human_verification).
- **T-09-07 (RUT legible por anon):** accept (este plan) / mitigate en 09-03 (RLS deny-by-default ya existe en 0005).

## Self-Check: PASSED

- Archivos creados verificados en disco: `backfill-rut.ts`, `backfill-rut.test.ts`, `parlamentario-rut.seed.json` (FOUND).
- Commits verificados en git log: `91ef784` (Task 1), `16aba73` (Task 2) (FOUND).
- Gates: `@obs/identity` 82 tests + typecheck exit 0; `@obs/adjudication` 61 tests (gate ≥0.95) + typecheck exit 0.

---
*Phase: 09-completitud-de-identidad-backfill-rut-invariante-de-writer-p*
*Completed: 2026-06-19*
