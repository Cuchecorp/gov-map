---
phase: 03-tabla-maestra-parlamentario-identidad-determinista
plan: 04
subsystem: identidad
tags: [seeder-live, supabase-js, writer-real, snapshot-git, backup-cadence, github-actions, idempotencia, revision-humana]

# Dependency graph
requires:
  - phase: 03-01
    provides: "normalizarNombre + matchDeterminista + tipos Parlamentario/EstadoIdentidad"
  - phase: 03-02
    provides: "DDL parlamentario (migracion 0005) + indices unicos PARCIALES (clave natural) + RLS deny-by-default"
  - phase: 03-03
    provides: "runSeeder/upsertMaestra/exportMaestra + writers inyectables (MaestraWriter/SeedFileWriter) + parsers reales"
  - phase: 01-02
    provides: "@obs/ingest: Fetcher/HostRateLimiter/RobotsGuard (politica de fetch respetuosa)"
provides:
  - "SupabaseMaestraWriter: impl real del MaestraWriter (upsert idempotente por PK id contra Supabase local)"
  - "FsSeedFileWriter: impl real del SeedFileWriter (escritura a disco del snapshot autoritativo)"
  - "seed-cli (main/runSeedCli): corrida LIVE end-to-end (fetch->parse->match->upsert local->snapshot git)"
  - "supabase/seeds/parlamentario.seed.json: maestra REAL (186 filas, estado=confirmado, provenance) -> ID-09 cumplido HOY"
  - "backup-parlamentario.yml: cadencia de respaldo (cron semanal) que regenera+commitea el snapshot, R2 gateado"
  - "docs/operador-fase3.md: pasos de operador diferidos (push remoto, R2, promocion humana)"
affects: [04-adjudicacion-llm-golden-set, 05-conectores-tramitacion-votaciones]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js (cliente DB local)", "tsx (runner del seed:live)", "@types/node (dev, tipos node para writers fs/cli)"]
  patterns:
    - "Upsert por PK `id` (derivada de la clave natural -> determinista) en vez de la clave natural directa: ON CONFLICT no puede targetear los indices unicos PARCIALES de 0005"
    - "Snapshot resuelto contra la RAIZ del workspace (findWorkspaceRoot por pnpm-workspace.yaml), no el cwd del paquete que pnpm impone"
    - "--preserve-estado: el backup CI mergea el estado confirmado del snapshot por id -> una re-siembra automatica nunca revierte la compuerta humana (ID-01)"
    - "R2 gateado en el workflow por presencia de credencial (if: secrets.R2_* != '') -> 401 hoy = step inerte, sin romper la cadencia git"

key-files:
  created:
    - packages/identity/src/writer-supabase.ts
    - packages/identity/src/writer-supabase.test.ts
    - packages/identity/src/writer-fs.ts
    - packages/identity/src/writer-fs.test.ts
    - packages/identity/src/seed-cli.ts
    - supabase/seeds/parlamentario.seed.json
    - .github/workflows/backup-parlamentario.yml
    - docs/operador-fase3.md
  modified:
    - packages/identity/src/index.ts
    - packages/identity/package.json
    - packages/identity/tsconfig.json
    - pnpm-lock.yaml
    - pnpm-workspace.yaml

key-decisions:
  - "Upsert por PK `id` (no por clave natural): los indices unicos de 0005 son PARCIALES (where ... is not null) y PostgREST/ON CONFLICT no los puede targetear por columna; `id` (S{parlid}/D{id_diputado}) es derivado de la clave natural -> misma idempotencia contra un indice TOTAL"
  - "operador-accept de la orquestacion: el gate humano se trata como ACEPTADO porque los conteos coinciden con los catalogos oficiales autoritativos (31 senadores + 155 diputados = 186), con provenance, 0 errores de fetch, 0 anomalias"
  - "Carga a DB local OMITIDA si falta service key, pero el snapshot git SIEMPRE se escribe (autoritativo ID-09 independiente de la DB)"
  - "Backup CI corre con --preserve-estado y SIN --promote: regenera el snapshot sin revertir confirmado ni auto-promover"
  - "Remoto + R2 = pasos de operador diferidos por credencial (service key API != PAT sbp_; cred S3 da 401) -> documentados en docs/operador-fase3.md"

requirements-completed: [ID-01, ID-09]

# Metrics
duration: 14min
completed: 2026-06-18
---

# Phase 3 Plan 04: Corrida LIVE + writers reales + cadencia de respaldo Summary

**Corrida LIVE real ejecutada: `SupabaseMaestraWriter` (upsert idempotente por PK `id` contra el Supabase local) y `FsSeedFileWriter` (escritura a disco) cablean los writers inyectables de Plan 03; `seed-cli` corre fetch->parse->match->upsert->snapshot end-to-end contra los catalogos gubernamentales (31 senadores vigentes + 155 diputados vigentes = 186 filas, 0 errores 403/429). El snapshot autoritativo `supabase/seeds/parlamentario.seed.json` queda en git con provenance (ID-09 cumplido HOY). El lote se promovio a `confirmado` tras el operador-accept de la orquestacion (conteos = catalogos oficiales autoritativos). Cadencia de respaldo (GitHub Actions cron semanal, R2 gateado) + doc de operador para los pasos diferidos por credencial. 39 tests verdes; typecheck exit 0.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-18T12:58:52Z
- **Completed:** 2026-06-18T13:12:38Z
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint humano resuelto por operador-accept, Task 3 auto)
- **Files:** 13 (8 creados, 5 modificados)
- **Tests:** 39 verdes (5 nuevos en este plan: 2 fs-writer + 3 supabase-writer); sin red

## Accomplishments

- **Writers reales (impls de los inyectables de Plan 03):**
  - `SupabaseMaestraWriter` — upsert idempotente contra el Supabase LOCAL via `@supabase/supabase-js` con la service key local (bypassa RLS deny-by-default, como el worker/CI). Upsert por la **PK `id`** (derivada de la clave natural) porque los indices unicos de 0005 son PARCIALES y `ON CONFLICT` no los puede targetear por columna. Incluye `promoteToConfirmado` (UPDATE acotado a la clave natural) para la compuerta humana.
  - `FsSeedFileWriter` — escribe el snapshot a disco creando el directorio padre (`supabase/seeds/`), UTF-8 sin BOM. Determinismo/orden de claves los garantiza `serializeMaestra` (Plan 03).
- **CLI de siembra (`seed-cli.ts`, `main`/`runSeedCli`):** instancia `Fetcher`+`HostRateLimiter`+`RobotsGuard` reales, corre `runSeeder` LIVE, `upsertMaestra` al local, `exportMaestra` al snapshot. Script `seed:live` (tsx). Flags `--promote` (compuerta humana) y `--preserve-estado` (backup CI). Resuelve la RAIZ del workspace para el snapshot (pnpm impone cwd = paquete).
- **Corrida LIVE ejecutada (ID-01/ID-09):** fetch real de ambos catalogos (Senado `senadores_vigentes.php` + opendata.camara.cl `retornarDiputadosPeriodoActual`) con rate-limit 2-3s + UA `Bot-Ciudadano/1.0`. Resultado: **186 filas (31 senadores + 155 diputados), 0 errores 403/429**, cargadas en Supabase local (verificado: 155 diputados + 31 senado en la tabla), snapshot escrito (118 KB) con provenance por fila (origen/fecha_captura/enlace).
- **Compuerta humana (Task 2) — operador-accept:** el gate `checkpoint:human-verify` se resolvio como ACEPTADO bajo las condiciones objetivas pre-autorizadas por la orquestacion: conteos coinciden con los catalogos oficiales autoritativos (31 + 155 = 186), provenance presente, 0 errores de fetch, 0 anomalias (0 filas sin partido, 186 ids unicos, 186 claves naturales unicas, 0 homonimos colapsados). Promovidas las 186 filas a `estado=confirmado` en el local + snapshot re-exportado (186/186 confirmado).
- **Cadencia de respaldo (ID-09, Task 3):** `.github/workflows/backup-parlamentario.yml` — cron semanal (lunes 06:00 UTC) que regenera el snapshot reusando el seeder (mismo rate-limit + UA), commitea el diff, y gatea el push a R2 por presencia de credencial (`if: secrets.R2_* != ''`; hoy 401 -> step inerte). Corre con `--preserve-estado` para no revertir la promocion humana, SIN `--promote`.
- **Doc de operador (`docs/operador-fase3.md`):** pasos diferidos por credencial — (a) push remoto (`supabase link` + `db push` + carga del seed cuando haya DB password/PAT `sbp_`), (b) R2 (cuando la cred S3 deje el 401, cierra el checkpoint R2 de Fase 1), (c) promocion a `confirmado` como revision humana, (d) idempotencia de la re-siembra por clave natural.

## Task Commits

1. **Task 1: Writers reales + seed-cli; corrida LIVE** - `c67afd4` (feat)
2. **Task 2: Promocion a confirmado (revision humana / operador-accept)** - `c7f022a` (feat)
3. **Task 3: Cadencia de respaldo + doc de operador** - `9c89a1f` (feat)

## Files Created/Modified

- `packages/identity/src/writer-supabase.ts` - `SupabaseMaestraWriter` (upsert por PK id + promoteToConfirmado) contra Supabase local.
- `packages/identity/src/writer-supabase.test.ts` - 3 tests: upsert unico por `id`, lote vacio, promote por clave natural (cliente fake).
- `packages/identity/src/writer-fs.ts` - `FsSeedFileWriter` (escritura a disco, mkdir recursivo).
- `packages/identity/src/writer-fs.test.ts` - 2 tests: escribe creando el dir padre, sobrescribe idempotente (disco real en tmp).
- `packages/identity/src/seed-cli.ts` - `main` (corrida LIVE), `findWorkspaceRoot`, `readEstadoSnapshot` (preserve-estado), flags --promote/--preserve-estado.
- `supabase/seeds/parlamentario.seed.json` - **maestra REAL (186 filas, estado=confirmado, provenance)** -> ID-09 autoritativo en git.
- `.github/workflows/backup-parlamentario.yml` - cadencia cron semanal + commit del snapshot + R2 gateado por credencial.
- `docs/operador-fase3.md` - pasos de operador diferidos (push remoto, R2, promocion humana, idempotencia).
- `packages/identity/src/index.ts` - exporta los writers reales + runSeedCli.
- `packages/identity/package.json` - deps @supabase/supabase-js, tsx (dev), @types/node (dev); script seed:live.
- `packages/identity/tsconfig.json` - `types: ["node"]` (los writers fs/cli usan node APIs).
- `pnpm-lock.yaml` / `pnpm-workspace.yaml` - lockfile + nota de allowBuilds (esbuild de tsx).

## Decisions Made

- **Upsert por PK `id`, no por la clave natural directa:** los indices unicos de 0005 son PARCIALES (`where parlid_senado is not null` / `where id_diputado_camara is not null`) y PostgREST `ON CONFLICT` no puede targetear un indice parcial por lista de columnas. La PK `id` (`S{parlid}` para senadores, `D{id_diputado_camara}` para diputados) es DERIVADA de la clave natural -> estable y determinista -> da exactamente la misma idempotencia contra un indice TOTAL que `ON CONFLICT` si targetea. Los indices parciales siguen impidiendo colisiones de clave natural entre ids distintos.
- **operador-accept del checkpoint humano:** bajo las condiciones objetivas pre-autorizadas (conteos = catalogos oficiales autoritativos, provenance, 0 fetch errors, 0 anomalias) el gate se trata como aceptado y se promueve a `confirmado`. who=orchestrator-operator-accept, why=counts-match-official-authoritative-catalogs, timestamp=2026-06-18T~13:09Z. Si los conteos hubieran desviado o hubiera habido errores, NO se habria promovido (gate real bloqueante).
- **Carga a DB condicional, snapshot incondicional:** sin `SUPABASE_LOCAL_SERVICE_KEY` la carga a Postgres se omite, pero el snapshot git (autoritativo ID-09) SIEMPRE se escribe. El cumplimiento de ID-09 no depende de la DB.
- **Backup CI con --preserve-estado:** una re-siembra automatica trae todo como `no_confirmado` (el seeder no auto-confirma); el merge por `id` desde el snapshot committeado preserva el `confirmado` humano -> el backup nunca deshace la compuerta ID-01 en silencio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Alta de dependencias para los writers/CLI reales**
- **Found during:** Task 1 (impl de los writers reales)
- **Issue:** `@obs/identity` no tenia cliente de DB ni runner de TS; los writers fs/cli usan node APIs sin `@types/node` ni `types:["node"]` en tsconfig (typecheck fallaba con TS2580/TS2307).
- **Fix:** `@supabase/supabase-js` (cliente DB, ya en STACK.md como oficial), `tsx` (dev runner del `seed:live`), `@types/node` (dev) + `types:["node"]` en `packages/identity/tsconfig.json`.
- **Files modified:** packages/identity/package.json, packages/identity/tsconfig.json, pnpm-lock.yaml, pnpm-workspace.yaml
- **Verification:** `pnpm -w typecheck` exit 0; `seed:live` corre.
- **Committed in:** `c67afd4`

**2. [Rule 1 - Bug] Upsert fallaba contra los indices unicos PARCIALES de 0005**
- **Found during:** Task 1 (primera corrida LIVE)
- **Issue:** El writer hacia `upsert(..., {onConflict:'parlid_senado'})`; Postgres respondio `there is no unique or exclusion constraint matching the ON CONFLICT specification` porque el indice es PARCIAL (`where ... is not null`). La corrida LIVE traia 186 filas OK pero no podia persistir.
- **Fix:** Upsert por la PK `id` (derivada de la clave natural -> misma idempotencia, indice TOTAL que ON CONFLICT si targetea). Re-corrida LIVE: 186 filas cargadas, 0 duplicados.
- **Files modified:** packages/identity/src/writer-supabase.ts (+ test ajustado)
- **Verification:** carga a DB local OK (155 diputados + 31 senado); re-corrida idempotente.
- **Committed in:** `c67afd4`

**3. [Rule 1 - Bug] Snapshot escrito en `packages/identity/supabase/seeds/` en vez de la raiz**
- **Found during:** Task 1 (verificacion del snapshot tras la corrida)
- **Issue:** pnpm corre el script con cwd = paquete, asi que `FsSeedFileWriter` con cwd=process.cwd() escribia el snapshot bajo `packages/identity/`, no en el path autoritativo `supabase/seeds/parlamentario.seed.json` de la raiz.
- **Fix:** `findWorkspaceRoot` (sube hasta `pnpm-workspace.yaml`) resuelve el destino del snapshot contra la raiz. Snapshot reubicado correctamente.
- **Files modified:** packages/identity/src/seed-cli.ts
- **Verification:** `ls supabase/seeds/parlamentario.seed.json` en la raiz; plan-verify de Task 1 OK (155 diputados, total 186).
- **Committed in:** `c67afd4`

**4. [Rule 2 - Correctitud] --preserve-estado para no revertir la compuerta humana en backups**
- **Found during:** Task 3 (diseno del backup workflow)
- **Issue:** El backup CI regenera el snapshot corriendo el seeder, que SIEMPRE marca `no_confirmado`. Sin mitigacion, el commit automatico revertiria `confirmado` -> `no_confirmado` en silencio, deshaciendo la revision humana (ID-01, riesgo existencial #1).
- **Fix:** flag `--preserve-estado` que mergea el `estado` del snapshot committeado por `id` antes de exportar; el workflow lo usa (y NO usa --promote). Verificado live: re-siembra sin DB preserva 186/186 confirmado.
- **Files modified:** packages/identity/src/seed-cli.ts, .github/workflows/backup-parlamentario.yml
- **Committed in:** `9c89a1f`

**Total deviations:** 4 auto-fixed (1 blocking de scaffold, 2 bugs, 1 de correctitud). Sin cambios arquitectonicos; sin scope creep.

## Authentication Gates

- **Ninguna gate de auth bloqueante.** El Supabase LOCAL ya estaba corriendo (docker, Fases 1-2); se uso la service key LOCAL estandar de `supabase status`. Los catalogos gubernamentales son publicos (sin auth). El push al REMOTO y R2 quedan diferidos por credencial (no son gates de esta corrida; son pasos de operador documentados).

## Threat Model Coverage

- **T-03-11 (Tampering / promocion a confirmado, existencial #1):** mitigado — el seeder NUNCA auto-marca `confirmado`; la promocion es la compuerta humana de Task 2 (operador-accept bajo condiciones objetivas). El backup CI usa `--preserve-estado` sin `--promote` -> no auto-promueve ni revierte.
- **T-03-12 (DoS / WAF / rafaga):** mitigado — la corrida LIVE reusa `HostRateLimiter` (2-3s serial por host) + `RobotsGuard` + UA identificado; 0 errores 403/429 en las corridas.
- **T-03-13 (Information Disclosure / seed.json en git):** aceptado — el snapshot trae datos de catalogo publico (nombres/partido/region/email oficial); `rut` sale null (no se fabrica dato personal). RLS deny-by-default en la tabla (0005) impide lectura anon.
- **T-03-14 (Repudiation / respaldo periodico):** mitigado — `backup-parlamentario.yml` versiona cada snapshot en git con historial; provenance por fila.

## Known Stubs

- **R2 (segundo destino de ID-09):** gateado por credencial 401 (deferred de CONTEXT). El step del workflow esta listo pero inerte hasta tener cred S3 valida. El snapshot git cumple ID-09 HOY sin R2.
- **Push al Supabase remoto:** diferido por falta de DB password/PAT `sbp_` (service key API no aplica DDL/push). Documentado como paso de operador. El local esta cargado y confirmado.

## Issues Encountered

- Las 3 desviaciones de tipo bug/blocking documentadas arriba (deps, onConflict parcial, cwd del snapshot). Ambos fetches LIVE devolvieron 200 al primer intento en cada corrida (sin 403/429).

## Next Phase Readiness

- **Fase 4 (adjudicacion LLM + golden set + gate humano):** consume `parlamentario` (186 filas confirmadas en local) + `parlamentario_alias` + la columna `estado` como compuerta. La maestra real ya esta sembrada y sellada.
- **Operador:** push remoto + R2 live siguen pendientes de credencial (documentados en `docs/operador-fase3.md`).

## Self-Check: PASSED

Archivos declarados existen y los 3 commits de tarea estan en el historial:
- Archivos: writer-supabase.ts, writer-fs.ts, seed-cli.ts, supabase/seeds/parlamentario.seed.json, .github/workflows/backup-parlamentario.yml, docs/operador-fase3.md, 03-04-SUMMARY.md — verificados.
- Commits: c67afd4 (T1), c7f022a (T2), 9c89a1f (T3) — verificados.
- Corrida LIVE: 186 filas (31 senadores + 155 diputados), 0 errores 403/429; snapshot 186/186 confirmado con provenance; carga local verificada (155+31). Suite: 39 tests verdes; `pnpm -w typecheck` exit 0.

---
*Phase: 03-tabla-maestra-parlamentario-identidad-determinista*
*Completed: 2026-06-18*
