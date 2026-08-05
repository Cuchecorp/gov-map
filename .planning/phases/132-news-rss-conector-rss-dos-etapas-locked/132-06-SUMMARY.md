---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 06
subsystem: ingest
tags: [cli, rss, r2, replay, skip, tri-estado, vitest]

requires:
  - phase: 132-03
    provides: "NewsConnector + buildNewsDeps() (Etapa 1)"
  - phase: 132-05
    provides: "cargar() + NewsWriter/InMemoryNewsWriter/SupabaseNewsWriter (Etapa 2)"
provides:
  - "run-news-cli.ts — CLI local que ata Etapa1+Etapa2 (--dry-run, --from-r2, --feeds, --etapa1/--etapa2)"
  - "index.ts — barrel FINAL del paquete @obs/news (reemplaza el placeholder de 132-01 T1)"
  - "[skip] observable derivado sin tocar @obs/ingest (D-132-B)"
  - "Fallo duro sin R2 (NewsR2RequeridoError) — nunca degrada con advertencia+continuar"
affects: [132-07]

tech-stack:
  added: []
  patterns:
    - "Fallo duro sin R2 vía clase de error propia (NewsR2RequeridoError), tri-estado null/undefined/instancia — a diferencia de los analogs (tramitación/lobby) que degradan con advertencia"
    - "[skip] derivado post-hoc comparando slugs pedidos vs slug codificado en r2Path de los SnapshotRef devueltos, sin tocar BaseConnector.run() (D-132-B LOCKED)"
    - "Replay --from-r2 bypasa por completo BaseConnector.run(): getObject -> parseRss -> cargar(), cero escritura de source_snapshot"

key-files:
  created:
    - packages/news/src/run-news-cli.ts
    - packages/news/src/run-news-cli.test.ts
    - packages/news/src/replay.test.ts
  modified:
    - packages/news/src/index.ts

key-decisions:
  - "Cache/drift/hostThrottle quedan con los dobles no-op de buildNewsDeps() en LIVE (mismo patrón que tramitacion/ingest-cli.ts y lobby/ingest-cli.ts, que tampoco wirean PgHostThrottle/DailyCache/DriftDetector reales en producción — ambos analogs consultados no tienen ese wiring). Solo r2/snapshot se overridean con implementaciones reales cuando hay R2Store/credenciales. No hay ninguna clase Postgres-backed de SnapshotLookup/DriftStore en @obs/ingest expuesta por index.ts para wirear sin escribir código nuevo en @obs/ingest (D-132-B prohíbe tocarlo)."
  - "El separador '--' de pnpm/npm se ignora explícitamente en parseArgs (si llega hasta el parser, nunca es un flag desconocido)"
  - "snapshotWriter es inyectable en NewsCliOptions pero JAMÁS se invoca en la rama --from-r2 (comentario explícito + mutación 5 verificada)"

patterns-established:
  - "Mutación manual + revert como evidencia anti-vacuo para criterios que el harness de vitest no puede capturar en un solo run (5 mutaciones documentadas abajo)"

requirements-completed: [NEWS-01]

duration: ~70min
completed: 2026-08-05
---

# Phase 132 Plan 06: CLI local Etapa1+Etapa2 (run-news-cli.ts) + barrel final Summary

**`run-news-cli.ts` ata Etapa1 (NewsConnector/BaseConnector.run) + Etapa2 (getObject→parseRss→cargar) con `--from-r2` que reproduce la carga con la red PROHIBIDA (SC3, fetch stubeado que lanza), `[skip]` derivado sin tocar `@obs/ingest` (SC2), y fallo duro sin R2 vía `NewsR2RequeridoError` (T-132-17, nunca degrada).**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2/2 completed
- **Files modified:** 4 (3 nuevos, 1 modificado)

## Accomplishments

- `run-news-cli.ts`: `parseArgs` con error tipado (`NewsCliArgsError`), flags `--dry-run`/`--from-r2`/`--feeds`/`--etapa1`/`--etapa2`; tri-estado de `R2Store` (`null`=forzar sin R2, `undefined`=construir desde env, instancia=inyectado); `findWorkspaceRoot` copiado localmente (Pitfall 9); `.env` BOM-safe con precedencia de `process.env`.
- **Etapa 1**: instancia `NewsConnector` vía `buildNewsDeps()` (sin `fetchFn` en producción), override de `r2`/`snapshot` con implementaciones reales cuando hay R2/credenciales. `[skip]` se deriva comparando los slugs pedidos contra el slug codificado en el `r2Path` de cada `SnapshotRef` — **cero cambios a `@obs/ingest`** (D-132-B), ya que `BaseConnector.run()` hace `continue` silencioso en cache-hit.
- **Etapa 2**: por cada `SnapshotRef` (o el único del replay), `r2Store.getObject` → `parseRss` → `cargar()`, acumulando conteos.
- **`--from-r2`**: bypasa por completo `BaseConnector.run()` — la única fuente de datos es `r2Store.getObject(r2Path)`; no escribe `source_snapshot` (no consume la caché diaria, F-2).
- **Fallo duro sin R2** (T-132-17): `NewsR2RequeridoError` propia (no `[WARN]`+continuar, a diferencia de tramitación/lobby) cuando `!r2Store && !dryRun`.
- `index.ts`: reemplazado el placeholder de scaffolding (132-01 T1) por el barrel final — 27 símbolos exportados agrupados por olas (feeds/allowlist → connector → modelo/parseo/canonicalización/prefiltro → writer/carga → CLI).
- 15 tests nuevos (`replay.test.ts` 4, `run-news-cli.test.ts` 11) — ≥ 10 exigidos. Suite completa del paquete: **123/123** tests, `tsc -b` limpio.
- Barrel verificado por test ejecutable: 15 símbolos importados de `../src/index.ts`, ninguno `undefined` (≥ 8 exigidos).

## Task Commits

Each task was committed atomically:

1. **Task 1: run-news-cli.ts — flags, R2 obligatorio, [skip] derivado, barrel index.ts** - `3ce9ac8` (feat)
2. **Task 2: [SC3] Test de replay con la red PROHIBIDA + test del [skip] derivado** - `ff5fc37` (test)

## Files Created/Modified

- `packages/news/src/run-news-cli.ts` - CLI local: `parseArgs`, `main`, `NewsCliArgsError`, `NewsR2RequeridoError`, tri-estado R2, [skip] derivado, replay
- `packages/news/src/run-news-cli.test.ts` - parseArgs, [skip] derivado (3/5, 5/5), fallo duro sin R2 (par apareado), barrel (11 tests)
- `packages/news/src/replay.test.ts` - SC3: red prohibida, getObject 1 vez, mismos conteos que `cargar()` directo, 0 escrituras de snapshot, sin R2 lanza (4 tests)
- `packages/news/src/index.ts` - barrel FINAL (reemplaza `NEWS_PACKAGE` placeholder de 132-01)

## Mutaciones obligatorias (anti-vacuo) — todas ejecutadas manualmente y revertidas

1. **Rama `if (opts.fromR2 != null)` deshabilitada** (`if (false && ...)`) → `replay.test.ts` cayó 2/4 tests: el test de conteos/getObject terminó comparando un objeto de la corrida LIVE contra `rejects.toThrow` (esperaba error), y el test de "sin R2 lanza" recibió un resultado en vez de rechazo. Revertido.
2. **`r2Store.getObject(opts.fromR2)` reemplazado por un XML fijo hardcodeado** (anti-Pitfall-10) → el assert `expect(calls).toEqual([R2_PATH])` cayó (`expected [] to deeply equal [Array(1)]` — `getObject` nunca se llamó). Revertido.
3. **Comparación `slugsDescargados` (derivación del `[skip]`) eliminada** → 2 tests cayeron: `skips` pasó de longitud 3/5 a longitud 0 en ambos casos (`expected [] to have a length of 3/5`). Revertido.
4. **Fallo duro reemplazado por `log("[WARN]...")` + continuar** → el caso NEGATIVO (`r2Store: null, dryRun: false`) cayó (`expected undefined to be an instance of NewsR2RequeridoError` — ya no lanzaba) **mientras el caso POSITIVO apareado (`r2Store: fake, dryRun: false`) siguió PASANDO** — confirma que el test mide el fallo duro específico, no cualquier error. Revertido.
5. **Rama `--from-r2` instrumentada para llamar `opts.snapshotWriter.write(...)`** → el test "0 escrituras de snapshot" cayó (`expected "spy" to not be called at all, but actually been called 1 times`), con el resto de la suite intacta. Revertido.

Ninguna mutación quedó en el código final — las cinco demuestran que los tests miran comportamiento real.

## Decisions Made

- **Cache/drift/hostThrottle no se wirean con implementaciones Postgres-backed reales** en la Etapa 1 LIVE: `buildNewsDeps()` deja los dobles no-op por defecto (`hasToday` siempre `false`, `drift.check` siempre `changed:false`). Se consultaron los dos analogs completos del monorepo (`packages/tramitacion/src/ingest-cli.ts`, `packages/lobby/src/ingest-cli.ts`) y **ninguno de los dos** instancia `PgHostThrottle`/`DailyCache`/`DriftDetector` en producción tampoco (`grep` confirmó cero usos fuera de `packages/ingest/src/*.test.ts`) — es el patrón establecido del monorepo, no una desviación de este plan. Construir un `SnapshotLookup`/`DriftStore` real habría exigido o bien tocar `@obs/ingest` (prohibido, D-132-B) o bien escribir una consulta SQL directa contra `source_snapshot`/`drift_alert` sin contrato existente; se dejó fuera del alcance de este plan (el CLI sigue cumpliendo R2 + snapshot real, que es lo que el truth exige).
- El separador literal `--` (de `pnpm --filter ... exec tsx script -- --flag`) se ignora explícitamente en `parseArgs` en vez de tratarse como flag desconocido — necesario para que la invocación documentada en el propio criterio de aceptación no falle por un motivo distinto al que prueba.
- `snapshotWriter` es inyectable en `NewsCliOptions` (para permitir el test de mutación 5) pero la rama `--from-r2` documenta explícitamente por qué NUNCA lo invoca.

## Deviations from Plan

**Ninguna desviación de comportamiento.** Una nota de implementación no explícita en el plan: la wiring de `DailyCache`/`PgHostThrottle`/`DriftDetector` mencionada en el `<read_first>` del Task 1 se dejó como los dobles no-op de `buildNewsDeps()` (ver "Decisions Made" arriba) — ningún acceptance criterion del plan exige literalmente instanciar esas tres clases, y los dos analogs de referencia tampoco lo hacen en producción.

## Issues Encountered

- **Grep de "cero red" (`\[WARN\] R2 no configurado`) contaba 2 falsos positivos** contra comentarios de cabecera que citaban el mensaje del analog para explicar por qué NO se usa aquí (mismo patrón de falso positivo que 132-03/132-05). Reescritos sin el literal — grep quedó en 0 real.
- **`grep -Ec "new Fetcher\("` sobre `run-news-cli.test.ts` contaba 1 falso positivo** contra un comentario que mencionaba "`new Fetcher(...)`" en prosa. Reescrito sin el literal.
- **`pnpm --filter @obs/news exec tsx src/run-news-cli.ts -- --flag-inexistente` reporta exit code `1` bajo `pnpm --filter <pkg> exec` en este entorno (Windows/Git Bash, pnpm v11.3.0), no `2`.** Verificado que **NO** es una regresión de este plan: el mismo patrón exacto contra el analog ya existente `packages/tramitacion/src/ingest-cli.ts` (sin tocar en este plan) produce **el mismo** exit code `1` bajo `pnpm --filter @obs/tramitacion exec`. El script subyacente SÍ sale con código `2` (visible en el propio mensaje de pnpm: `"Command failed with exit code 2"`, y confirmado corriendo `pnpm exec tsx ...` sin `--filter`, que reporta `rc=2` limpio). Es un comportamiento de `pnpm --filter ... exec` en este entorno que normaliza el exit code del subproceso a `1` en su capa recursiva — no algo que este plan haya introducido o pueda arreglar sin tocar la config de pnpm/CI (fuera de alcance). **Evidencia sustituta usada** (la que el propio plan marca como válida, F-5 bis / Task 2): `parseArgs(["--flag-inexistente"])` lanza `NewsCliArgsError` con el nombre del flag en el mensaje — verificado por test (`run-news-cli.test.ts`), y el bloque `isMain` del CLI llama a `process.exit(2)` en el catch de `parseArgs` (código auditable, línea del archivo). Registrado aquí como informativo, no bloqueante.

## User Setup Required

None - no external service configuration required (SupabaseNewsWriter/R2Store no se ejercitan contra infra real en este plan, solo vía tests con dobles inyectados y `tsc -b`).

## Next Phase Readiness

- `run-news-cli.ts` + `index.ts` (barrel final) listos para que 132-07 corra la verificación LIVE del SC1/SC2/SC3 con feeds reales.
- El `[skip]` derivado y el fallo duro sin R2 están probados por mutación; el replay `--from-r2` es el modo repetible documentado para 132-07 (no consume la caché diaria del día).
- No hay bloqueos.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*

## Self-Check: PASSED
- FOUND: packages/news/src/run-news-cli.ts
- FOUND: packages/news/src/run-news-cli.test.ts
- FOUND: packages/news/src/replay.test.ts
- FOUND: packages/news/src/index.ts (modified)
- FOUND: commit 3ce9ac8
- FOUND: commit ff5fc37
