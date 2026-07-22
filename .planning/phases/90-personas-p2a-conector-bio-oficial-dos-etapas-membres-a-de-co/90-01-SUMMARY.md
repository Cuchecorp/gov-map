---
phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co
plan: 01
subsystem: database
tags: [monorepo, pnpm-workspace, zod, allowlist, minimizacion-pii, rls, deny-by-default, pgtap, supabase, vitest]

# Dependency graph
requires:
  - phase: 21-int-lobby (0021_lobby.sql)
    provides: plantilla deny-by-default (provenance inline + RLS sin policies + revoke anon) espejada en 0059
  - phase: 05 (0005_parlamentario.sql)
    provides: tabla maestra parlamentario(id) — FK target de las 4 tablas nuevas
provides:
  - "Paquete @obs/bio scaffolded (config + barrel), resuelve en el workspace pnpm, suite corre (no CI-DARK)"
  - "model.ts con allowlist por construccion: BioParlamentario/Militancia/Comision/ComisionMembresia sin campos PII, zod .strict() que muerde"
  - "Migracion 0059 + pgTAP: 4 tablas deny-by-default (parlamentario_bio, parlamentario_militancia, comision, comision_membresia), offline, no aplicadas"
affects: [90-02 (parsers/writer/runner consumen el modelo + escriben en 0059), 90-03 (CLI + apply de 0059 a PROD), 91 (RPCs publicas de lectura sobre estas tablas)]

# Tech tracking
tech-stack:
  added: [fast-xml-parser@^5 (dep de @obs/bio, ya en el monorepo desde votos/tramitacion)]
  patterns:
    - "Allowlist por construccion (el modelo tipado NO declara PII → imposible persistirla; zod .strict() muerde con campo extra)"
    - "Deny-by-default VERBATIM de 0021 (RLS sin policies + revoke all from anon,authenticated + cero grant a anon)"

key-files:
  created:
    - packages/bio/package.json
    - packages/bio/tsconfig.json
    - packages/bio/vitest.config.ts
    - packages/bio/src/index.ts
    - packages/bio/src/model.ts
    - packages/bio/src/model.test.ts
    - supabase/migrations/0059_bio_comisiones.sql
    - supabase/tests/0059_bio_comisiones.test.sql
  modified:
    - tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "@obs/bio omite @obs/adjudication (bio no usa provider LLM) y suma fast-xml-parser@^5 (parser del XML de diputados); cero paquetes nuevos al monorepo"
  - "Allowlist = el modelo tipado no declara fechaNacimiento/rut/sexo; defensa por AUSENCIA estructural, no por null; zod .strict() codifica la compuerta en tests"
  - "0059 replica el deny-by-default de 0021 (RLS sin policies + revoke anon/authenticated), CERO grant a anon (lockdown-guard Block A >0044); RPCs publicas se difieren a Phase 91"
  - "parlamentario_bio con region/distrito/circunscripcion NULL honesto (poblables despues, research Open Q2/Q3); parlamentario.partido lo refresca el writer, sin DDL sobre parlamentario"

patterns-established:
  - "Allowlist por construccion: interface + zod .strict() por entidad; test-que-muerde rechaza campo PII extra"
  - "Deny-by-default de 4 tablas nuevas con pgTAP plan(28) que asevera RLS + pg_policies=0 + anon SELECT=0"

requirements-completed: [BIO-01, BIO-05]

# Metrics
duration: ~15min
completed: 2026-07-22
---

# Phase 90 Plan 01: Andamiaje @obs/bio + contratos allowlist + migración 0059 (offline) Summary

**Paquete `@obs/bio` scaffolded (espejo de @obs/lobby, suite viva), `model.ts` con allowlist por construcción (sin PII, zod `.strict()` que muerde), y migración 0059 + pgTAP con 4 tablas deny-by-default escritas offline — todo compilando y verde en su propia superficie.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-22T12:57:14Z (approx, phase execution start)
- **Completed:** 2026-07-22T13:06:15Z
- **Tasks:** 3
- **Files created:** 8 · **Files modified:** 2

## Accomplishments
- Paquete `@obs/bio` levantado como espejo estructural de `@obs/lobby`: `package.json` (deps core/identity/ingest + fast-xml-parser, sin adjudication), `tsconfig.json` con `references` (no `paths` — gotcha Phase 43 que rompe `tsc -b`), `vitest.config.ts` verbatim (evita CI-DARK), barrel `index.ts`. Resuelve en el workspace (17 proyectos) y su suite corre.
- `model.ts` con los 4 contratos (`BioParlamentario`, `Militancia`, `Comision`, `ComisionMembresia`), cada uno con provenance inline y zod `.strict()`. **Allowlist por construcción:** ningún tipo declara `fechaNacimiento`/`rut`/`sexo` → un objeto con PII no compila ni valida. 11 tests que muerden (rechazan campo PII extra + `camara` fuera de enum).
- Migración `0059_bio_comisiones.sql` + pgTAP `plan(28)`: 4 tablas deny-by-default (RLS sin policies + `revoke all from anon, authenticated`, cero `grant … to anon`), provenance NOT NULL, claves naturales para upsert idempotente. Escritas offline, NO aplicadas a PROD (eso es 90-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold packages/bio (config + barrel)** - `4d757e2` (feat)
2. **Task 2: model.ts — contratos con allowlist** - `8617127` (feat)
3. **Task 3: Migración 0059 + pgTAP (offline, 4 tablas deny-by-default)** - `ab9c8ca` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `packages/bio/package.json` - Manifiesto `@obs/bio`: deps del monorepo + fast-xml-parser, scripts test/typecheck.
- `packages/bio/tsconfig.json` - `composite` + `references` a core/ingest/identity (NO `paths`).
- `packages/bio/vitest.config.ts` - Config vitest (include `src/**/*.test.ts`, passWithNoTests) — evita CI-DARK.
- `packages/bio/src/index.ts` - Barrel: re-exporta tipos + zod schemas del modelo.
- `packages/bio/src/model.ts` - 4 contratos con allowlist por construcción (sin PII) + zod `.strict()`.
- `packages/bio/src/model.test.ts` - 11 tests: parsean válidos, rechazan PII extra / enum inválido.
- `supabase/migrations/0059_bio_comisiones.sql` - DDL aditivo de 4 tablas deny-by-default (offline).
- `supabase/tests/0059_bio_comisiones.test.sql` - pgTAP `plan(28)` del deny-by-default + provenance NOT NULL.
- `tsconfig.json` (raíz) - Añadida referencia `./packages/bio`.
- `pnpm-lock.yaml` - Actualizado por `pnpm install` (symlink workspace del paquete nuevo).

## Decisions Made
- **`@obs/bio` sin `@obs/adjudication`, con `fast-xml-parser@^5`:** bio no usa provider LLM; el parser de diputados (90-02) lee XML. Cero paquetes nuevos al monorepo (fast-xml-parser ya lo usan votos/tramitacion).
- **Allowlist por ausencia estructural, no por null:** `.strict()` en cada zod schema convierte la minimización (Ley 21.719) en un invariante verificable — un campo PII extra hace fallar el parse.
- **0059 difiere las RPCs públicas a Phase 91:** solo el deny-by-default (RLS + revoke) aquí; cero `grant … to anon` para no violar el lockdown-guard Block A (>0044).
- **`parlamentario` sin DDL:** `partido` lo actualiza el writer en 90-02; region/distrito/circunscripcion viven en `parlamentario_bio` como NULL honesto (poblables después).

## Deviations from Plan

None - plan executed exactly as written. Los 3 tasks se ejecutaron según lo especificado; todos los criterios de aceptación (incluidos los greps de PII a 0 y el check node de deny-by-default) pasan.

## Issues Encountered

- **Falso negativo de shell-quoting en el `<automated>` del Task 3:** correr el check node inline vía `bash -c "node -e '...[\\s\\S]...'"` colapsaba `\\s\\S` a `sS` por el doble-escape de las comillas de bash, dando un `FAIL` espurio. Se resolvió corriendo el MISMO check desde un archivo `.cjs` temporal (sin re-escape del shell): salió `OK 4 tablas deny-by-default, cero grant anon` (exit 0). El archivo temporal se eliminó. La migración era correcta desde el inicio; era un artefacto de invocación, no del DDL.

## Deferred Issues (out of scope — SCOPE BOUNDARY)

- **`app/lib/buscar.test.ts:193` falla (drift de Phase 89):** el root `pnpm test` reporta 1 test fallando (1070 pasan) — la prueba espera `similarity: 0` pero la producción (`buscar.ts`, commit `2a4a6a9` `fix(89): WR-04 use similarity null`) emite `similarity: null`. Este drift test/código PRECEDE a Phase 90; ninguno de los commits 90-01 toca `app/`. Fuera del alcance del plan (bio + 0059). Registrado en `.planning/phases/90-.../deferred-items.md` con owner sugerido (`/gsd:quick` de Phase 89). La superficie propia de 90-01 (`pnpm --filter @obs/bio test`, `tsc -b`, check 0059) está verde.

## User Setup Required

None - no external service configuration required. La migración 0059 se aplica a PROD en 90-03 (checkpoint de operador), NO en este plan.

## Next Phase Readiness
- **90-02 listo:** los contratos (`model.ts`) y las 4 tablas (0059) existen; los parsers/writer/runner tienen contra qué tipar y dónde escribir (clave natural definida por entidad).
- **90-03 pendiente:** aplicar 0059 a PROD (`PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f ...`, NUNCA db push) + correr el pgTAP contra el schema aplicado.
- **Concern menor:** el fallo pre-existente de `app/lib/buscar.test.ts` mantiene el root `pnpm test` en rojo hasta que un follow-up de Phase 89 alinee la expectativa `similarity`.

## Self-Check: PASSED

- Archivos creados: 8/8 FOUND (packages/bio/* + supabase 0059 migration & test).
- Commits: 3/3 FOUND (`4d757e2`, `8617127`, `ab9c8ca`).
- Verificaciones de plan verdes: `pnpm --filter @obs/bio test` (11 tests), `tsc -b` (exit 0), check node 0059 (exit 0, "OK 4 tablas deny-by-default, cero grant anon"), grep PII en model.ts = 0.

---
*Phase: 90-personas-p2a-conector-bio-oficial-dos-etapas-membres-a-de-co*
*Completed: 2026-07-22*
