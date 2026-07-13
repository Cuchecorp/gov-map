---
phase: 63-busq-b-squeda-de-proyectos-completa
plan: 03
subsystem: data-ingestion
tags: [backfill, tramitacion, r2, pgvector, embeddings, deepseek, gemini, honest-ceiling]

# Dependency graph
requires:
  - phase: 63-01
    provides: "seed-fichas-cli idempotente + verify-cobertura.sql (cierra gap sin_ficha)"
  - phase: 63-02
    provides: "enumeración histórica WSLegislativo (parser+zod+connector+CLI LOCAL)"
provides:
  - "Corpus PROD poblado: 156 → 3.657 proyectos (2022-2026), gap sin_ficha CERRADO (0)"
  - "3.092 fichas embebidas (idea_matriz + embedding 768) — 84,6% cobertura semántica"
  - "Techo honesto documentado: 565 error por causa (478 RUT-blocked LOCKED + 87 schema-fail)"
  - "Driver LOCAL reanudable run-backfill-chunks.sh + run-pipeline-chunks.sh (patrón chunked)"
  - "63-COBERTURA-REPORTE.md cerrado con ecuación de identidad y breakdown por causa"
affects: [busqueda-semantica, /buscar coverage banner, cron leyes-weekly, re-embed futuro]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backfill chunked por año (250 boletines/chunk) bajo tope cmdline Windows ~32KB"
    - "Pipeline por lotes --boletines EXPLÍCITO (evita re-resolver ~1000 links por --limite)"
    - "Techo honesto: estado='error'+causa sobre fabricar dato (RUT LOCKED + zod schema gate)"
    - "DOS ETAPAS LOCKED: R2 content-addressed (If-None-Match) ANTES de Supabase, reanudable"

key-files:
  created:
    - ".planning/phases/63-busq-b-squeda-de-proyectos-completa/run-backfill-chunks.sh"
    - ".planning/phases/63-busq-b-squeda-de-proyectos-completa/run-pipeline-chunks.sh"
    - ".planning/phases/63-busq-b-squeda-de-proyectos-completa/logs/ (driver + 36 iters + reembed)"
  modified:
    - ".planning/phases/63-busq-b-squeda-de-proyectos-completa/63-ALCANCE-HISTORICO.md"
    - ".planning/phases/63-busq-b-squeda-de-proyectos-completa/63-COBERTURA-REPORTE.md"

key-decisions:
  - "Alcance histórico DECIDIDO: 2022-2026 (3.648 únicos, 3.506 net-new) tras enumeración LIVE"
  - "Chunking por año a 250 boletines/chunk — tope de línea de comandos de Windows (~32KB) excedido con años completos"
  - "Lotes --boletines EXPLÍCITO en el pipeline (no auto-pendientes) para no re-resolver ~1000 links del Senado por lote"
  - "exit=1 del CLI ignorado como señal de parada — casi todo lote de 100 contiene ≥1 RUT-bloqueado; loop sobre CONTEO de pendientes"
  - "Techo honesto sobre dato fabricado: RUT LOCKED (assertNoRutInLlmInput) + zod schema gate dejan estado='error'+causa"
  - "Los 8 v1 stale (title-only) en filas 'error' NO se re-embeben ni borran — son vectores válidos title-only, ficha con techo honesto"

patterns-established:
  - "Driver bash chunked reanudable como escape-hatch de límites de plataforma (cmdline Windows, PostgREST 1k cap)"
  - "Ecuación de identidad como cierre honesto: proyecto − embebido = error (techo con causa)"

requirements-completed: [BUSQ-01, BUSQ-02]

# Metrics
duration: ~2 días (corridas LOCAL contra fuentes vivas + PROD)
completed: 2026-07-11
---

# Phase 63 Plan 03: Backfill LOCAL End-to-End Summary

**Corpus de búsqueda poblado de 156 → 3.657 proyectos (2022-2026) con 3.092 fichas embebidas (84,6% cobertura semántica) y un techo honesto de 565 error documentado por causa — 478 RUT-bloqueados (guard LOCKED) + 87 schema-fail — sin fabricar un solo dato.**

## Performance

- **Duration:** ~2 días de corridas LOCAL (ingesta 2026-07-10 03:15→18:34; pipeline 2026-07-10 18:55 → 2026-07-11 13:23)
- **Started:** 2026-07-10 (enumeración live + decisión de alcance)
- **Completed:** 2026-07-11T13:23:16Z (`=== pipeline-chunks DONE ===`)
- **Tasks:** 5/5
- **Files modified:** 2 docs + 2 drivers + logs (39 archivos de log)

## Accomplishments

- **Ingesta histórica completa 2022-2026:** 3.506 net-new boletines ingeridos LOCAL vía `run-tramitacion-prod-cli --boletines`, DOS ETAPAS LOCKED (R2 content-addressed primero, Supabase después), rate-limit 2-3s/host respetado, reanudable por hash-check R2 (`If-None-Match`). Solo ~22 errores puntuales sobre >3.500 boletines (timeout/parse aislado, NO bloqueo WAF).
- **Gap sin_ficha CERRADO:** tras corregir la paginación del seed (commit `6b1ebd8`), `count(proyecto) == count(proyecto_ficha)` = 3.657 == 3.657.
- **Pipeline fichas+embeddings completo:** 36 iteraciones de 100 boletines, cola agotada (`pendientes=0`), pasada `--reembed` → 3.092 fichas embebidas con idea_matriz + embedding Gemini 768.
- **Techo honesto documentado por causa:** 565 error = 478 RUT-bloqueados (84,6%, `assertNoRutInLlmInput` LOCKED, permanente) + 87 schema-fail (15,4%, zod gate rechaza salida LLM inválida en vez de fabricar).
- **Cron verificado acotado:** `leyes-weekly.yml` sigue con `--limite 80` sobre novedades; el histórico fue one-shot LOCAL, NO se re-backfilla en cada corrida semanal.

## Task Commits

Cada tarea/deviación se comiteó atómicamente:

1. **Task 1: Enumerar histórico LIVE + decidir alcance 2022-2026** - `3104ea0` (feat)
2. **Task 2: Ingesta tramitación 2026 + driver chunked (Rule 3 fix cmdline)** - `bfefa50` (feat)
3. **Deviación: fix paginación seedFichasPendientes (PostgREST 1k cap)** - `6b1ebd8` (fix)
4. **Task 3/4: pipeline driver en lotes + reporte post-ingesta** - `7c3b600` (chore)
5. **Task 5: cron verificado acotado (--limite 80, sin re-backfill)** - documentado en reporte §4

**Plan metadata:** este SUMMARY + reporte final + STATE/ROADMAP (commit de cierre `docs(63-03)`)

## Files Created/Modified

- `63-ALCANCE-HISTORICO.md` - decisión de alcance 2022-2026 + volumen por año + porqué
- `63-COBERTURA-REPORTE.md` - reporte final: baseline, ingesta por año, counts finales, ecuación de identidad, breakdown del techo honesto por causa, 8 stale v1, cron acotado
- `run-backfill-chunks.sh` - driver chunked de ingesta (250 boletines/chunk, reanudable R2)
- `run-pipeline-chunks.sh` - driver del pipeline por lotes --boletines (loop hasta pendientes=0 + reembed)
- `logs/driver.log`, `logs/ingesta-*.log`, `logs/pipeline*.log` - evidencia de las corridas

## Counts finales (PROD, 2026-07-11)

| Conteo | Valor |
|--------|------:|
| proyecto | 3.657 |
| proyecto_ficha | 3.657 |
| proyecto_embedding | 3.100 |
| sin_ficha | 0 ✅ |
| estado=embebido | 3.092 |
| estado=error (techo honesto) | 565 |
| estado=pendiente | 0 ✅ |
| con_idea_matriz | 1.504 |
| embedding_version=v1 | 3.034 |
| embedding_version=v1-reembed | 66 |

### Ecuación de identidad (techo honesto exacto)

```
3.657 proyecto − 3.092 embebido = 565 error   (techo honesto con causa)
3.100 embeddings = 3.092 embebidos + 8 stale v1 title-only (en filas 'error')
```

### Breakdown del techo honesto (565 error) por causa

| Causa | Filas | % | Reintentable | Boletines de muestra |
|-------|------:|--:|--------------|----------------------|
| RUT en input (`assertNoRutInLlmInput` LOCKED) | 478 | 84,6% | ❌ NUNCA (guard permanente) | 12712-24, 14775-10, 14795-07, 14796-08, 14797-06, 14805-12, 14808-19, 14810-04 |
| LLM output schema-fail (zod gate) | 87 | 15,4% | ⚠️ reintento agotado (36 iters) | 14824-06, 14842-09, 14931-25, 14955-03, 14961-07, 14962-07, 15011-08, 15023-25 |
| **TOTAL** | **565** | 100% | | |

**PDF escaneado/ilegible** y **fetch 404/timeout** no aparecen como causas propias: los primeros se absorben en schema-fail (sin texto extraíble → LLM devuelve JSON inválido), los segundos quedaron como ~22 errores de INGESTA (§2 del reporte) que nunca llegan a crear ficha.

### 8 embeddings v1 stale en filas 'error' (title-only, no re-embebidos)

`18308-11, 18318-19, 18320-18, 18324-07, 18326-18, 18327-07, 18354-07, 18358-03` — todos `v1`, ficha en `error`. Explican la diferencia `3.100 − 3.092 = 8`. Buscables (vector title-only vigente) pero sin idea_matriz por el techo honesto. No se tocan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tope de línea de comandos de Windows (~32KB) excedido**
- **Found during:** Task 2 (ingesta de años completos)
- **Issue:** pasar años completos (682-890 boletines) como un solo `--boletines` CSV → "La línea de comandos es demasiado larga"; el backfill de 2022-2025 fallaba silenciosamente al arranque.
- **Fix:** driver `run-backfill-chunks.sh` que divide cada año en chunks de 250 boletines (bajo el tope) y los corre EN SERIE, reanudable vía R2 hash-check. El batch 2026 (311, un solo CSV) sí cupo bajo el tope y se corrió directo.
- **Files:** `run-backfill-chunks.sh`
- **Commit:** `bfefa50`

**2. [Rule 1 - Bug] Paginación rota de seedFichasPendientes (PostgREST 1k cap)**
- **Found during:** cierre del gap post-ingesta (Task 3)
- **Issue:** `seedFichasPendientes` paginaba mal los `select` (PostgREST recorta a ~1000 filas) → el Set-diff comparaba páginas desalineadas y el seed no cerraba el gap a >1k proyectos.
- **Fix:** paginación corregida → una fila `proyecto_ficha estado='pendiente'` por CADA proyecto sin ficha.
- **Files:** CLI `seed-fichas-cli` / `seedFichasPendientes`
- **Commit:** `6b1ebd8`

### Design decisions (no permiso requerido — diseño del driver del pipeline)

**3. Lotes --boletines EXPLÍCITO en vez de auto-detección de pendientes**
- `leerPendientes()` sin `--boletines` lee TODOS los pendientes (query PostgREST, tope ~1000) y resuelve el link del Senado por cada uno (re-fetch XML, rate-limit 2-3s) ANTES de que `--limite N` recorte. Con 3.583 pendientes, `--limite 100` resolvería ~1000 links (~50 min) para procesar 100 → derroche masivo.
- **Fix de diseño:** el driver consulta los 100 boletines `pendiente` por psql y los pasa como `--boletines` explícito → el CLI resuelve links SOLO para ese lote. Loop hasta `pendiente=0`.
- **Commit:** `7c3b600`

## Checkpoint Resolutions

- **T3 ("esperar y continuar"):** tras completar la ingesta de 2026 (checkpoint de progreso), el operador autorizó continuar → los 4 años restantes (2022-2025) se ingirieron completos. Marcador `=== backfill-chunks DONE 18:34:49 ===`.
- **Smoke-test del pipeline (3 pendientes):** verde end-to-end antes de lanzar el driver largo — 10986-24 y 11929-13 embebidos, 12712-24 error (RUT LOCKED disparó, estado='error' honesto, NO fabricó). Confirmó la ruta `--boletines` real y el pacing 2-3s/host.
- **Corrida larga del pipeline (36 iters):** lanzada en background, reanudable; cola agotada en ITER 37 (`pendientes=0`), pasada `--reembed` (0 procesados, correcto). Marcador `=== pipeline-chunks DONE 2026-07-11T13:23:16Z ===`.

## Known Stubs

None — el corpus está poblado en PROD con datos reales; el techo honesto (565 error) es resultado deliberado de compuertas de seguridad/contrato, no un stub. Los 3.092 embebidos son datos reales con fuente/fecha.

## Self-Check: PASSED

- `63-03-SUMMARY.md` → FOUND
- `63-COBERTURA-REPORTE.md` (sección 3 completa) → FOUND
- Commits `3104ea0`, `bfefa50`, `6b1ebd8`, `7c3b600` → FOUND en git log
- Counts PROD verificados por psql: proyecto=3657, embebido=3092, error=565, pendiente=0 → CONFIRMADO
