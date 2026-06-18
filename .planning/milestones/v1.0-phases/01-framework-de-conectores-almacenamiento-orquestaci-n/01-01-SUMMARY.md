---
phase: 01-framework-de-conectores-almacenamiento-orquestaci-n
plan: 01
subsystem: infra
tags: [pnpm-monorepo, typescript, deno, nextjs, supabase, postgres, pgvector, pgmq, vitest, rls, provenance]

# Dependency graph
requires: []
provides:
  - "Monorepo pnpm instalable y reseteable (app + packages/* + supabase)"
  - "@obs/core: tipo Provenance (FND-08) + tipos de control IngestRun/SourceSnapshot/DriftAlert + isIngestStatus"
  - "Migraciones 0001 (extensiones vector/pg_cron/pg_net/pgmq) y 0002 (tablas de control + RLS deny-by-default)"
  - "Infraestructura de test: vitest (packages) + deno.json (Edge) + supabase test db (pgTAP)"
  - "Contrato DDL de source_snapshot (unique source,resource,date_bucket + provenance inline) que Plan 02 consume"
affects: [framework-de-ingesta, orquestacion, conectores, identidad, busqueda-semantica]

# Tech tracking
tech-stack:
  added: [pnpm-workspaces, typescript@5.9, vitest@3.2, next@16, supabase-cli, pgmq, pg_cron, pg_net, pgvector]
  patterns: [monorepo-workspaces, project-references-tsc, tdd-red-green, raw-immutable-normalized-derived, rls-deny-by-default, migraciones-versionadas]

key-files:
  created:
    - pnpm-workspace.yaml
    - package.json
    - tsconfig.base.json
    - tsconfig.json
    - vitest.config.ts
    - deno.json
    - .env.example
    - .gitignore
    - packages/core/src/provenance.ts
    - packages/core/src/domain.ts
    - packages/core/src/index.ts
    - packages/core/src/provenance.test.ts
    - supabase/config.toml
    - supabase/migrations/0001_extensions.sql
    - supabase/migrations/0002_control_tables.sql
    - supabase/tests/0001_control_plane.test.sql
  modified: []

key-decisions:
  - "verifyDepsBeforeRun: false en pnpm-workspace.yaml para que el gate de build-scripts ignorados (esbuild/sharp/unrs-resolver) no aborte typecheck/test"
  - "passWithNoTests en vitest para que el runner Wave 0 arranque limpio sin tests"
  - "Puertos locales de Supabase remapeados a 544xx para evitar colision con otro proyecto Supabase activo"
  - "check (status in running|ok|error) en ingest_run, espejando IngestStatus de @obs/core"

patterns-established:
  - "TDD RED→GREEN: test commit separado antes de la implementacion (Task 2)"
  - "Raw-immutable / normalized-derived: source_snapshot guarda solo r2_path/content_hash, nunca crudo (FND-02)"
  - "RLS deny-by-default: enable RLS sin policies anon en tablas de control"
  - "Orquestacion versionada: extensiones por migracion, no por click en dashboard"

requirements-completed: [FND-02, FND-08]

# Metrics
duration: 11min
completed: 2026-06-17
---

# Phase 1 Plan 01: Scaffold del monorepo + plano de control Summary

**Monorepo pnpm (Next.js 16 + @obs/core + supabase) instalable/reseteable, con tipo Provenance de primera clase y migraciones que habilitan vector/pg_cron/pg_net/pgmq y crean ingest_run/source_snapshot/drift_alert con RLS deny-by-default.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-17T23:40:36Z
- **Completed:** 2026-06-17T23:51:06Z
- **Tasks:** 3
- **Files modified:** 16 creados (+ scaffold Next.js en /app)

## Accomplishments
- Monorepo pnpm con workspaces (`app`, `packages/*`); `pnpm install` resuelve sin errores; `pnpm -w typecheck` verde (tsc -b con project references); runner de test arranca limpio.
- `@obs/core` exporta el contrato de procedencia (`Provenance` + `makeProvenance`, FND-08) y el plano de control (`IngestRun`/`SourceSnapshot`/`DriftAlert`/`IngestStatus`/`isIngestStatus`), con 3 tests verdes via TDD.
- Migraciones 0001/0002 aplican limpio con `supabase db reset`; `supabase db lint` sin errores; 12 asserts pgTAP verdes (`supabase test db`).
- Secrets fuera de git (`.env` ignorado, `.env.example` con 11 claves vacias); crudo fuera de Postgres (verificado: 0 columnas de payload crudo en el DDL).

## Task Commits

Cada tarea se comiteo atomicamente:

1. **Task 1: Scaffold del monorepo pnpm + tooling de test (Wave 0)** - `4cd23f7` (feat)
2. **Task 2: Tipos compartidos @obs/core (TDD)** - `e14604a` (test RED) → `35dbf29` (feat GREEN)
3. **Task 3: Migraciones del plano de control** - `31076c8` (feat)

_Task 2 siguio TDD: commit de test rojo antes de la implementacion verde._

## Files Created/Modified
- `pnpm-workspace.yaml` - Workspaces (app, packages/*); verifyDepsBeforeRun + ignoredBuiltDependencies
- `package.json` - Raiz privado; scripts test/typecheck/lint; devDeps typescript + vitest
- `tsconfig.base.json` / `tsconfig.json` - Config TS strict compartida + project references a packages/core
- `vitest.config.ts` / `packages/core/vitest.config.ts` - Runner node con passWithNoTests
- `deno.json` - Task test + import map `@obs/core/` (base para codigo Deno de Plan 02/03)
- `.env.example` - 11 claves con valores vacios (V8 ASVS); `.gitignore` excluye `.env`/node_modules/.next/supabase temp
- `app/` - Scaffold Next.js 16 (App Router, TS) por decision LOCKED de layout
- `packages/core/src/provenance.ts` - Tipo Provenance + helper puro makeProvenance (FND-08)
- `packages/core/src/domain.ts` - IngestRun/SourceSnapshot/DriftAlert + IngestStatus + isIngestStatus
- `packages/core/src/index.ts` - Re-exporta provenance + domain
- `packages/core/src/provenance.test.ts` - 3 tests (ISO timestamp, snapshotRef diferido, type-guard)
- `supabase/config.toml` - supabase init; puertos remapeados a 544xx
- `supabase/migrations/0001_extensions.sql` - vector/pg_cron/pg_net/pgmq
- `supabase/migrations/0002_control_tables.sql` - DDL de control + unique diaria + provenance inline + RLS
- `supabase/tests/0001_control_plane.test.sql` - 12 asserts pgTAP

## Decisions Made
- **verifyDepsBeforeRun: false** en pnpm-workspace.yaml — el chequeo pre-run de pnpm v11 abortaba `typecheck`/`test` con `ERR_PNPM_IGNORED_BUILDS` (esbuild/sharp/unrs-resolver son build-scripts nativos no requeridos para typecheck/test).
- **passWithNoTests** en vitest — el criterio de aceptacion Wave 0 pide que el runner arranque; sin tests aun, exit 0 es lo correcto.
- **Puertos Supabase remapeados a 544xx** — el puerto 54322 estaba ocupado por otro proyecto Supabase local (TRIBUTALAB_2.0); remapear evita detener trabajo ajeno del usuario.
- **check constraint (running|ok|error)** en ingest_run — espeja `IngestStatus` de @obs/core a nivel DB.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Gate de build-scripts ignorados abortaba typecheck/test**
- **Found during:** Task 1 (verificacion `pnpm -w typecheck`)
- **Issue:** pnpm v11 corre un deps-status check antes de cada script; `ERR_PNPM_IGNORED_BUILDS` (esbuild/sharp/unrs-resolver) devolvia exit 1, bloqueando la verificacion.
- **Fix:** `verifyDepsBeforeRun: false` + `ignoredBuiltDependencies` explicitos en pnpm-workspace.yaml. Build-scripts nativos no son necesarios para typecheck/test.
- **Files modified:** pnpm-workspace.yaml
- **Verification:** `pnpm -w typecheck` y `pnpm -w test` corren con exit 0.
- **Committed in:** `4cd23f7` (Task 1)

**2. [Rule 2 - Missing Critical] Runner de test fallaba con exit 1 sin tests (Wave 0)**
- **Found during:** Task 1 (verificacion `pnpm -w test`)
- **Issue:** vitest devuelve exit 1 con "No test files found"; el criterio Wave 0 requiere que el runner arranque verde antes de existir tests.
- **Fix:** `passWithNoTests: true` en los configs de vitest (root + packages/core).
- **Files modified:** vitest.config.ts, packages/core/vitest.config.ts
- **Verification:** `pnpm -w test` → "exiting with code 0".
- **Committed in:** `4cd23f7` (Task 1)

**3. [Rule 3 - Blocking] Colision de puerto en `supabase start`**
- **Found during:** Task 3 (`supabase db reset`)
- **Issue:** El puerto 54322 ya estaba asignado por otro proyecto Supabase local activo (TRIBUTALAB_2.0), impidiendo arrancar el stack.
- **Fix:** Remapeo de los puertos 543xx → 544xx en supabase/config.toml (api/db/shadow/pooler/studio/inbucket/analytics).
- **Files modified:** supabase/config.toml
- **Verification:** `supabase start` + `supabase db reset` + `supabase test db` corren limpio.
- **Committed in:** `31076c8` (Task 3)

**4. [Rule 1 - Bug] Error de collation en el assert de RLS (pgTAP)**
- **Found during:** Task 3 (`supabase test db`)
- **Issue:** `results_eq` comparando `relname::text` (tipo `name`) contra literales disparaba "could not determine which collation to use".
- **Fix:** Reemplazado por `is(count(*)::int, 3, ...)` sobre `pg_class.relrowsecurity` — sin comparacion de strings sensible a collation.
- **Files modified:** supabase/tests/0001_control_plane.test.sql
- **Verification:** 12/12 asserts pgTAP verdes.
- **Committed in:** `31076c8` (Task 3)

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 missing critical, 1 bug)
**Impact on plan:** Todas necesarias para que la verificacion automatizada del plan corra verde. Sin scope creep; cero conectores/parsers/adaptadores adelantados.

## Issues Encountered
- `create-next-app` genero un `app/pnpm-workspace.yaml` propio (con `ignoredBuiltDependencies`) que colisionaba con el workspace raiz. Resuelto: removido y consolidado en el workspace raiz.
- Linter del entorno reinyectaba un stub `allowBuilds:` en pnpm-workspace.yaml en cada install; resuelto al fijar `verifyDepsBeforeRun: false` (corta el pre-run install check).

## User Setup Required

**Servicios externos requieren configuracion manual.** El plan declara `user_setup` para Cloudflare R2:
- Crear el bucket R2 para el crudo inmutable (Cloudflare Dashboard → R2 → Create bucket). `.env` ya contiene `R2_BUCKET=observatorio` y credenciales; **verificar que el bucket existe** antes de que Plan 02 escriba objetos (aws4fetch escribe objetos pero no crea el bucket — FND-02).
- Variables R2 ya presentes en `.env` raiz: `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `TOKEN_VALUE_R2`.

## Next Phase Readiness
- **Plan 02 (framework de ingesta)** puede consumir `@obs/core` (Provenance + tipos de control) y el contrato DDL de `source_snapshot` (unique diaria + provenance inline) sin renegociar arquitectura.
- **Plan 03 (orquestacion)** hereda extensiones pg_cron/pg_net/pgmq ya habilitadas; falta la migracion 0003 (queues + util.* + cron schedule) — fuera de scope de este plan.
- `deno.json` raiz queda como base de test/import-map para el codigo Deno; se ampliara en `supabase/functions/deno.json` (Plan 03).
- **Blocker menor:** verificar existencia del bucket R2 antes de los tests de integracion de Plan 02.

## Self-Check: PASSED

Todos los archivos declarados existen y los 4 commits de tarea estan en el historial:
- Archivos: pnpm-workspace.yaml, packages/core/src/{provenance,domain,index}.ts, supabase/migrations/0001_extensions.sql, supabase/migrations/0002_control_tables.sql, supabase/tests/0001_control_plane.test.sql, 01-01-SUMMARY.md — todos FOUND.
- Commits: 4cd23f7 (Task 1), e14604a (Task 2 RED), 35dbf29 (Task 2 GREEN), 31076c8 (Task 3) — todos FOUND.

---
*Phase: 01-framework-de-conectores-almacenamiento-orquestaci-n*
*Completed: 2026-06-17*
