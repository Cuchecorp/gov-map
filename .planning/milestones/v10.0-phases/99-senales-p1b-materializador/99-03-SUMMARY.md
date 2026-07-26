---
phase: 99-senales-p1b-materializador
plan: 03
subsystem: actualidad
tags: [kmeans, clustering, embeddings, pgvector, service-role, cli, determinism, no-llm]

# Dependency graph
requires:
  - phase: 99-01
    provides: "tabla actualidad_senal con CHECK que incluye tipo_senal='agrupacion_materia' (NUNCA tocado por el DELETE del proc SQL) + unique(tipo_senal,cobertura_camara,ventana,cluster_id)"
  - phase: 0011-fichas-embeddings
    provides: "proyecto_embedding(boletin PK, embedding vector(768)), public-read"
  - phase: 0008-tramitacion
    provides: "proyecto.materia (taxonomía oficial, label factual)"
provides:
  - "workspace @obs/actualidad (kmeans + CLI + tests)"
  - "kmeans.ts: Lloyd determinista seed-fija (mulberry32) + labelCluster mode(materia)"
  - "run-actualidad-prod-cli.ts: writer service_role de la capa tipo_senal='agrupacion_materia'"
affects: [phase-100-panel-landing, phase-99-04-apply-checkpoint]

# Tech tracking
tech-stack:
  added:
    - "@obs/actualidad (workspace nuevo; dep @supabase/supabase-js@^2.108.2 + tsx + vitest)"
  patterns:
    - "k-means a mano (~200 líneas con docs) sin dependencia externa → reproducibilidad byte-a-byte + cero superficie de slopcheck"
    - "PRNG mulberry32 seed-fija (KMEANS_SEED=0x9e3779b9) + input ordenado por boletín + init k-means++ determinista → misma entrada = misma asignación"
    - "label factual = mode(materia) con empate alfabético (localeCompare 'es'); JAMÁS texto generado"
    - "full-rebuild ACOTADO por tipo_senal (delete where tipo_senal='agrupacion_materia') → disjunto del proc SQL 99-01, sin race"
    - "dry-run live-read: valida el pipeline completo contra PROD (lee + clusteriza + muestra) SIN escribir"

key-files:
  created:
    - "packages/actualidad/package.json"
    - "packages/actualidad/tsconfig.json"
    - "packages/actualidad/vitest.config.ts"
    - "packages/actualidad/src/kmeans.ts"
    - "packages/actualidad/src/kmeans.test.ts"
    - "packages/actualidad/src/index.ts"
    - "packages/actualidad/src/run-actualidad-prod-cli.ts"
  modified:
    - "pnpm-lock.yaml (glob packages/* recoge @obs/actualidad)"

key-decisions:
  - "SEED_FIJA = KMEANS_SEED = 0x9e3779b9 (2654435769), constante documentada LOCKED. Cambiarla re-baraja TODOS los clusters."
  - "k=10 por defecto, rango discrecional [8,15] clampado, y NUNCA > N (checker warning #2). Con el corpus real N=3100 con embedding → k=10 efectivo."
  - "Distancia coseno = 1 - dot sobre vectores L2-normalizados (consistente con Gemini + operador <=> del HNSW en 0011)."
  - "Init k-means++ DETERMINISTA (muestreo proporcional a D(x)^2 con el mismo PRNG) en vez de primeros-k → mejor separación manteniendo reproducibilidad."
  - "labelCluster ignora null/vacío/whitespace; cluster sin ninguna materia útil → '(sin materia)' literal (nunca fabrica)."
  - "El CLI hace dry-run LIVE-READ: con .env presente lee PROD y clusteriza pero NO escribe salvo LIVE explícito. La escritura real a PROD ocurre vía GH Actions (99-04) o operador tras aplicar 0065."

requirements-completed: [SEN-05]

# Metrics
duration: 8min
completed: 2026-07-24
---

# Phase 99 Plan 03: @obs/actualidad k-means CLI Summary

**Workspace `@obs/actualidad` nuevo: `kmeans.ts` (Lloyd determinista con PRNG mulberry32 seed-fija `0x9e3779b9`, distancia coseno sobre 768d, label = `mode(materia)` factual empate-alfabético, JAMÁS LLM) + su test de determinismo, y `run-actualidad-prod-cli.ts` (service_role writer que lee `proyecto_embedding` paginado y hace full-rebuild ACOTADO de `tipo_senal='agrupacion_materia'`, disjunto del proc SQL de 99-01). Validado por dry-run live-read contra PROD: 3100 embeddings → k=10 clusters deterministas.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-24T14:00:31Z
- **Completed:** 2026-07-24T14:08:00Z
- **Tasks:** 2 (Task 1 en ciclo TDD RED→GREEN)
- **Files:** 7 creados + 1 modificado (lockfile)

## Accomplishments

- **Workspace `@obs/actualidad`** espejando el molde de `packages/tramitacion`: `package.json` (`@obs/actualidad`, dep `@supabase/supabase-js@^2.108.2`, `tsx`, `vitest`), `tsconfig.json` con `references: []` (NO paths-to-src — gotcha Phase 43; el paquete no tiene deps `@obs/*`), y `vitest.config.ts` propio VERBATIM del molde (evita CI-DARK — gotcha Phase 43/90). El glob `packages/*` de `pnpm-workspace.yaml` lo recogió sin edición manual (18 workspace projects tras `pnpm install`).
- **`kmeans.ts` — Lloyd determinista a mano** (sin dependencia externa de k-means → reproducibilidad byte-a-byte + cero superficie de slopcheck): PRNG `mulberry32(KMEANS_SEED=0x9e3779b9)`, init **k-means++ determinista** (muestreo proporcional a D(x)² con el mismo PRNG), distancia **coseno** (1 − dot sobre vectores L2-normalizados), iteración asignación→recentrado hasta convergencia o `MAX_ITER=100`, empates de centroide por índice menor, clusters vacíos conservan su centroide (estable). `k` se clampa a `[1, min(N,k)]` dentro del rango discrecional `[8,15]` (checker warning #2).
- **`labelCluster` — mode(materia) FACTUAL** (threat T-99-11): cuenta frecuencias de `materia`, toma el máximo, empate → orden alfabético (`localeCompare('es')`, determinista). Ignora null/vacío/whitespace; sin materia útil → `'(sin materia)'` literal. **CERO texto generado, CERO LLM.**
- **`kmeans.test.ts` — 7 tests verdes:** determinismo (misma entrada + misma seed → asignaciones idénticas en dos corridas), vectores idénticos al mismo cluster, grupos distintos a clusters distintos, clamp de k, y label factual (mode + empate alfabético + fallback).
- **`run-actualidad-prod-cli.ts` — writer service_role de `agrupacion_materia`:** conexión y `loadEnv` BOM-safe con precedencia `process.env` espejando `run-tramitacion-prod-cli`; credenciales SOLO de env (`SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`, NUNCA argv ni log — threat T-99-13). Lee `proyecto_embedding` PAGINADO (`.select('boletin, embedding, proyecto(materia)').order('boletin').range()`, `PAGE_SIZE=1000` bajo el cap PostgREST) uniendo `proyecto.materia`; corre `kmeans(vectors, k, KMEANS_SEED)`; full-rebuild **ACOTADO** (`delete where tipo_senal='agrupacion_materia'` + `insert` una fila por cluster) — disjunto del set temporal del proc SQL de 99-01 (threat T-99-10, Pitfall 5). Cada fila lleva `cluster_id`, `conteo`, `materia` (label mode), `evidencia jsonb` (boletines + enlaces de fuente + método + cobertura), provenance inline.
- **Validación por dry-run LIVE-READ contra PROD:** el `.env` presente hizo que el dry-run leyera PROD real → **3100 embeddings** leídos paginados, k-means determinista N=3100 k=10 seed=0x9e3779b9, 10 clusters computados, **NO se escribió** (dry-run). Esto ejercita el pipeline completo (lectura + parseo de vector + join materia + clustering + construcción de filas) sin tocar la tabla.
- **Suite completa verde:** `pnpm -r exec tsc --noEmit` = 0 (workspace refs compilan); `pnpm test` = **96 files / 1252 tests** verdes.

## Task Commits

1. **Task 1 (RED): scaffold @obs/actualidad + failing kmeans tests** — `155e145` (test)
2. **Task 1 (GREEN): kmeans.ts determinista + label mode(materia)** — `f3c9713` (feat)
3. **Task 2: run-actualidad-prod-cli.ts writer agrupacion_materia** — `219505b` (feat)

_Gate TDD: `155e145` es RED (test escrito antes de que `kmeans.ts` exista — falla con "Cannot find module ./kmeans"); `f3c9713` es GREEN (7/7 verdes). `219505b` construye el CLI sobre esa API._

## Files Created/Modified

- `packages/actualidad/package.json` — workspace `@obs/actualidad` (dep supabase-js + tsx + vitest).
- `packages/actualidad/tsconfig.json` — `references: []` (no paths-to-src), extiende `tsconfig.base.json`, composite.
- `packages/actualidad/vitest.config.ts` — config propio VERBATIM del molde (anti CI-DARK).
- `packages/actualidad/src/kmeans.ts` — Lloyd k-means determinista + `labelCluster` factual.
- `packages/actualidad/src/kmeans.test.ts` — 7 tests (determinismo + label).
- `packages/actualidad/src/index.ts` — barrel export (`main` del package).
- `packages/actualidad/src/run-actualidad-prod-cli.ts` — CLI service_role writer.
- `pnpm-lock.yaml` — regenerado; el glob `packages/*` recoge el nuevo paquete.

## Decisions Made

- **SEED_FIJA constante y documentada:** `KMEANS_SEED = 0x9e3779b9` (golden-ratio-ish, sin significado especial). Se trata como valor LOCKED del pipeline — cambiarla re-baraja todos los clusters. Documentada en `kmeans.ts` y en el log del CLI (`seed=0x9e3779b9`).
- **k=10, rango [8,15], clamp a N:** con el corpus real (3100 PLs con embedding) N ≫ 15 → k=10 efectivo. El clamp `min(K_MAX, k)` y `min(withinRange, N)` cubre corpus pequeños (checker warning #2) — probado en test con N=2, k=10 → k=2.
- **Init k-means++ determinista** en vez de primeros-k-por-boletín: mejor separación de clusters manteniendo la reproducibilidad (el muestreo D(x)² usa el mismo `mulberry32(seed)`).
- **Dry-run = live-read seguro:** el CLI degrada a dry-run sin credenciales, pero con `.env` presente el dry-run LEE PROD y clusteriza (sin escribir). Es la validación end-to-end del plan sin requerir la migración 0065 aplicada. La escritura real depende de que `actualidad_senal` exista en PROD (checkpoint 99-04).

## Deviations from Plan

None — plan ejecutado tal como está escrito. Los dos `<verify>` pasaron (test grep + tsc/grep del CLI). Esfuerzo extra dentro de alcance (no una desviación): dry-run live-read contra PROD para validar el pipeline completo, y un probe efímero (borrado) para confirmar la cobertura de `materia` y la forma del join.

## Column-name / schema drift vs applied schema

Ninguna deriva de nombre. Verificado contra el schema aplicado en PROD:
- `proyecto_embedding` (0011): `boletin`, `embedding vector(768)` — PostgREST devuelve el vector como string `"[...]"`; `parseEmbedding` maneja string y array.
- `proyecto.materia` (0008 L26): columna presente, embed vía `proyecto(materia)` — shape verificado `{ proyecto: { materia } }`.
- `actualidad_senal` (0065): columnas `tipo_senal/ventana/conteo/cobertura_camara/materia/cluster_id/fecha_max/supresion_causa/evidencia/dataset/origen/fecha_captura/enlace` usadas tal cual; `unique(tipo_senal,cobertura_camara,ventana,cluster_id)` respetado (una fila por cluster_id).

## Known Stubs

Ninguno estructural en el código (kmeans y CLI están completos y wired). Ver "Data-coverage finding" abajo por la realidad del dato `materia`.

## Data-coverage finding (deferred, NO es bug)

**`proyecto.materia` está NULL para las 3.659 filas en PROD** (verificado 2026-07-24: `count(*) where materia is not null` = 0). El pipeline de ingesta nunca pobló la columna. Consecuencia: `labelCluster` devuelve honestamente `'(sin materia)'` para todos los clusters — comportamiento **correcto** (jamás fabrica un label). NO es un bug de 99-03: el join funciona, el k-means es determinista, el label es factual; en cuanto se pueble `materia`, los labels pasan a materia real sin tocar este CLI. Poblar `materia` es trabajo del conector de ingesta (fuera de alcance). Registrado en `deferred-items.md`. Impacto Phase 100: los clusters agrupan por cercanía semántica (correcto) pero se muestran `(sin materia)` hasta poblar la columna.

## Issues Encountered

- **`.insert()` infiere `never[]`** con el cliente supabase-js sin tipos generados de DB. Resuelto con `as unknown as never[]` sobre el payload estructural (mismo patrón `as unknown` que `run-tramitacion-prod-cli`). No hay tipos generados en el repo.
- **`node -e` no resuelve `@supabase/supabase-js`** desde la raíz del monorepo (pnpm hoisting). El probe de verificación se corrió vía `tsx` desde el dir del paquete y se borró.

## User Setup Required

Ninguno en este plan. **La corrida LIVE del CLI (write PROD) es deuda de 99-04 / operador:** requiere que la migración 0065 esté aplicada (tabla `actualidad_senal` existente) y luego correr `pnpm --filter @obs/actualidad exec tsx src/run-actualidad-prod-cli.ts` (con `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` en env) — o vía el cron GH Actions `actualidad-refresh.yml` de 99-04. El agente NO escribió a PROD (dry-run live-read solamente).

## Next Phase Readiness

- **99-04 (apply checkpoint + GH Actions):** el CLI está listo para el YAML `actualidad-refresh.yml` (`pnpm --filter @obs/actualidad exec tsx src/run-actualidad-prod-cli.ts`, solo secrets Supabase, sin R2). La escritura LIVE a `agrupacion_materia` ocurre tras aplicar 0065.
- **Phase 100 (panel):** los clusters `agrupacion_materia` se leen vía `actualidad_senales_panel('agrupacion_materia')` (RPC de 99-02); el panel debe tolerar `materia='(sin materia)'` hasta poblar la columna.

## Threat Flags

Ninguna superficie de seguridad nueva fuera del threat_model del plan. El CLI usa service_role (bypassa RLS) pero acota su delete a su propio `tipo_senal` (T-99-10 mitigado); credenciales solo de env (T-99-13); label factual sin LLM (T-99-11); determinismo por seed fija + input ordenado (T-99-12).

## Self-Check: PASSED

- FOUND: packages/actualidad/package.json
- FOUND: packages/actualidad/tsconfig.json
- FOUND: packages/actualidad/vitest.config.ts
- FOUND: packages/actualidad/src/kmeans.ts
- FOUND: packages/actualidad/src/kmeans.test.ts
- FOUND: packages/actualidad/src/index.ts
- FOUND: packages/actualidad/src/run-actualidad-prod-cli.ts
- FOUND commit 155e145 (test/RED), FOUND commit f3c9713 (feat/GREEN), FOUND commit 219505b (feat/CLI)

---
*Phase: 99-senales-p1b-materializador*
*Completed: 2026-07-24*
