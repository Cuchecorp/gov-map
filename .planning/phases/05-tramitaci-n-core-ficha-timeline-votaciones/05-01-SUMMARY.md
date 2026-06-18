---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
plan: 01
subsystem: tramitacion
tags: [tramitacion, modelo-comun, supabase, postgres, migracion, rls, pgtap, fixtures, e2e, walking-skeleton]

# Dependency graph
requires:
  - "Migraciones 0001-0007 + patrón pgTAP de Fases 1-4 (RLS deny-by-default)"
  - "Maestra `parlamentario` (186 filas) — voto.parlamentario_id FK"
  - "@obs/core (Provenance), @obs/ingest, @obs/identity, @obs/adjudication (consumo de olas 2-4)"
provides:
  - "Paquete @obs/tramitacion dado de alta en el workspace (typecheck verde)"
  - "Modelo común Proyecto/Votacion/Voto/TramitacionEvento + zod schemas (boletín = llave de cruce)"
  - "Migración 0008: 4 tablas de datos públicos + RLS public-read EXPLÍCITO para anon"
  - "pgTAP 0007 que prueba que anon SÍ lee las 4 tablas y NO lee parlamentario.rut"
  - "5 fixtures XML reales cross-cámara (boletín 14309/18296) para las olas 2-4"
  - "slice.e2e.test.ts (RED): la diana ciudadana end-to-end de la fase"
affects: [tramitacion, frontend-ficha, busqueda-semantica]

# Tech tracking
tech-stack:
  added: []
  patterns: [rls-public-read-explicito, provenance-inline, modelo-comun-zod, walking-skeleton-red, fixtures-reales-live, claves-naturales-upsert]

key-files:
  created:
    - packages/tramitacion/package.json
    - packages/tramitacion/tsconfig.json
    - packages/tramitacion/vitest.config.ts
    - packages/tramitacion/src/index.ts
    - packages/tramitacion/src/model.ts
    - packages/tramitacion/src/model.test.ts
    - packages/tramitacion/src/slice.e2e.test.ts
    - packages/tramitacion/test/fixtures/camara-votacion-boletin.xml
    - packages/tramitacion/test/fixtures/camara-votacion-detalle.xml
    - packages/tramitacion/test/fixtures/camara-sesiones-58.xml
    - packages/tramitacion/test/fixtures/senado-tramitacion.xml
    - packages/tramitacion/test/fixtures/senado-votacion.xml
    - supabase/migrations/0008_tramitacion.sql
    - supabase/tests/0007_tramitacion.test.sql
  modified:
    - tsconfig.json
    - tsconfig.base.json

key-decisions:
  - "RLS public-read EXPLÍCITO (policy for select to anon using(true)) + GRANT SELECT en las 4 tablas: el deny-by-default heredado dejaría la ficha en blanco (Pitfall 5/T-05-01)"
  - "voto.parlamentario_id nullable + FK a la maestra: NULL salvo vínculo determinista/confirmado; mencion_nombre crudo se conserva siempre para display (T-05-02)"
  - "Proyecto lleva boletin completo (PK, '18296-05') Y boletin_num base ('18296') — el Senado se consulta con el base (Pitfall 1)"
  - "TramitacionEvento.enlace propio (link al documento) distinto de la provenance; provenance inline en las 4 entidades (TRAM-09)"
  - "slice E2E en RED por imports ausentes (no it.todo): contrato observable del valor ciudadano que las olas 2-4 vuelven verde (walking-skeleton-first)"

requirements-completed: [TRAM-03, TRAM-09]

# Metrics
duration: 8min
completed: 2026-06-18
---

# Phase 5 Plan 01: Fundación del slice de Tramitación (scaffold + modelo + RLS + fixtures + E2E RED) Summary

**Da de alta `@obs/tramitacion` en el workspace, materializa el modelo común `Proyecto`/`Votacion`/`Voto`/`TramitacionEvento` (tipos + zod, boletín = llave de cruce) y la migración `0008` con las 4 tablas de datos públicos y RLS public-read EXPLÍCITO para `anon` (probado por pgTAP: anon SÍ lee las 4, NO lee `parlamentario.rut`), captura 5 fixtures XML reales cross-cámara (boletín 14309/18296) y deja el test E2E del slice en RED como diana de la fase.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-18T16:13:29Z
- **Completed:** 2026-06-18T16:21:50Z
- **Tasks:** 3 (Task 2 con ciclo TDD RED→GREEN)
- **Files:** 14 creados, 2 modificados

## Accomplishments

- **Paquete `@obs/tramitacion`** dado de alta espejando `@obs/identity`: `package.json` (type:module, deps workspace `@obs/core`/`ingest`/`identity`/`adjudication` + `fast-xml-parser`/`zod`/`@supabase/supabase-js`), `tsconfig` composite con project references a los 4 paquetes (lib DOM), `vitest.config`, barrel `src/index.ts`. Project reference en `tsconfig.json` raíz + path mapping en `tsconfig.base.json`. `pnpm -w typecheck` exit 0.
- **Modelo común (`model.ts`)** TRAM-03: `Proyecto` (PK `boletin` completo + `boletin_num` base, iniciativa Mensaje/Moción nullable, autores[], estado/etapa/subetapa, provenance inline), `Votacion` (id sintético, boletín FK, totales int, cámara diputados|senado), `Voto` (votacion_id, mencion_nombre crudo, parlamentario_id nullable, seleccion si|no|abstencion|pareo, metodo/estado_vinculo), `TramitacionEvento` (boletín FK, tipo tramite|urgencia|informe|oficio|votacion, enlace del documento). Zod schemas exportados desde el barrel. TRAM-09: provenance inline (`origen`/`fecha_captura`/`enlace`) en las 4 entidades.
- **Migración `0008_tramitacion.sql`**: DDL de las 4 tablas + `voto.parlamentario_id` nullable FK a `parlamentario(id)` + claves naturales (`unique(votacion_id,mencion_nombre)`, `unique(boletin,fecha,camara,tipo,descripcion)`) para upsert idempotente + índices de ficha (`votacion(boletin)`, `voto(votacion_id)`, `tramitacion_evento(boletin,fecha)`) + **RLS public-read EXPLÍCITO** (`enable rls` + `create policy ... for select to anon using(true)` + `grant select to anon` en las 4). `parlamentario` intacta (deny-by-default).
- **pgTAP `0007_tramitacion.test.sql`** (21 asserts): existencia de las 4 tablas, columnas + provenance, `voto.parlamentario_id` nullable + FK, checks (seleccion/camara/tipo), RLS habilitada; **prueba efectiva de RLS** insertando semilla como owner, `set local role anon`, `isnt_empty` en las 4 tablas y `is_empty($$select rut from parlamentario$$)` (guarda T-05-01). `supabase test db` verde (121 tests totales, Result: PASS).
- **5 fixtures XML reales** capturados live (UA `Bot-Ciudadano/1.0`, delay 3s, HTTP 200): `camara-votacion-boletin.xml` (14309 → `<Boletin>14309-04</Boletin>`), `camara-votacion-detalle.xml` (89178 → 155 `<Voto><Diputado><Id>`), `camara-sesiones-58.xml` (40 `<Sesion>`), `senado-tramitacion.xml` (18296 → `<boletin>18296-05</boletin>` + 12 tramites), `senado-votacion.xml` (14309 → 35 votos nominales). **Cross-cámara confirmado:** 14309 tiene votación en ambas cámaras.
- **slice.e2e.test.ts (RED):** importa `parseCamaraVotacion`/`parseSenadoTramitacion`/`parseSenadoVotacion`/`fusionarTimeline`/`reconciliarVotosSenado` (no exportados aún); los 4 tests fallan por símbolos ausentes (no por fixtures), describiendo el objetivo ciudadano end-to-end como diana de la fase.

## Task Commits

1. **Task 1: Scaffold @obs/tramitacion + alta en workspace** — `0d9e11c` (feat)
2. **Task 2 RED: test del modelo común (falla por ./model ausente)** — `665595c` (test)
3. **Task 2 GREEN: modelo común + migración 0008 + pgTAP RLS público** — `ee6f88b` (feat)
4. **Task 3: fixtures XML reales cross-cámara + slice E2E (RED)** — `4abd9a3` (test)

## Files Created/Modified

Ver `key-files` en frontmatter. Destacados:
- `supabase/migrations/0008_tramitacion.sql` — 4 tablas + RLS public-read explícito + grants.
- `supabase/tests/0007_tramitacion.test.sql` — 21 asserts, RLS efectiva como rol anon + guarda rut.
- `packages/tramitacion/src/model.ts` — modelo común + zod (contrato que las olas 2-4 consumen).
- `packages/tramitacion/test/fixtures/*.xml` — 5 capturas reales (la materia prima de los parsers).
- `packages/tramitacion/src/slice.e2e.test.ts` — la diana RED de la fase.

## Decisions Made

- **RLS public-read EXPLÍCITO + GRANT** — el patrón heredado (RLS enable sin policy) es deny-by-default, correcto para la maestra con rut/email pero letal para la ficha pública: `anon` leería 0 filas sin error. Se añadió `create policy ... for select to anon using(true)` Y `grant select to anon` en las 4 tablas (la policy sin el privilegio no expone nada). `parlamentario` queda intacta. (Pitfall 5 / T-05-01).
- **`voto.parlamentario_id` nullable + FK** — solo se puebla con vínculo determinista/confirmado (Cámara por `Diputado/Id`, o Senado tras reconciliación `confirmado`); en otro caso NULL + `mencion_nombre` crudo para display con marca "identidad no confirmada". (T-05-02, guarda LOCKED).
- **Boletín completo (PK) + base (`boletin_num`)** — el display/PK usa `18296-05`, pero `tramitacion.php?boletin=` espera `18296` (Pitfall 1). Se modelan ambos.
- **`TramitacionEvento.enlace` vs provenance** — el `enlace` del evento (LINK_INFORME/LINK_OFICIO, nullable) es distinto de la procedencia inline; el schema mantiene ambos.
- **slice E2E en RED por imports reales** (no `it.todo`) — falla por símbolos ausentes, es el contrato observable del valor ciudadano (walking-skeleton-first del MVP).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Conteo de plan pgTAP off-by-N**
- **Found during:** Task 2 (`supabase test db`)
- **Issue:** El test declaraba `plan(23)` pero corrían 21 asserts → pgTAP reporta "Bad plan" y FAIL aunque las 21 sub-pruebas pasen (mismo patrón que 03-02).
- **Fix:** `plan(23)` → `plan(21)`.
- **Files modified:** supabase/tests/0007_tramitacion.test.sql
- **Verification:** `supabase test db` → "All tests successful" (121 tests, Result: PASS).
- **Committed in:** `ee6f88b` (Task 2 GREEN)

**2. [Rule 2 - Critical] GRANT SELECT a anon añadido junto a la policy**
- **Found during:** Task 2 (diseño de la migración 0008)
- **Issue:** Una policy RLS `to anon` sin el privilegio de tabla (`grant select`) no expone filas: el privilegio Y la policy deben coincidir. El plan describía la policy pero no el grant.
- **Fix:** `grant select on {proyecto,votacion,voto,tramitacion_evento} to anon` en la migración (defensa en profundidad — corrige correctness del objetivo "anon lee la ficha").
- **Files modified:** supabase/migrations/0008_tramitacion.sql
- **Verification:** pgTAP `isnt_empty` como rol `anon` en las 4 tablas verde.
- **Committed in:** `ee6f88b` (Task 2 GREEN)

**Total deviations:** 2 auto-fixed (1 bug, 1 critical). Sin scope creep.

## Checkpoint Handling (autónomo)

El plan es `autonomous: false` con captura de fixtures. Per la directiva de ejecución autónoma, se capturaron los fixtures reales directamente (live fetch con delay 3s + UA identificatorio), se verificaron sus shapes (boletín estructurado, 155/35 votos, 40 sesiones, 12 tramites) y se procedió sin bloquear. Boletín efectivo usado: **14309** (cross-cámara, votos en ambas) para votaciones; **18296** para la tramitación del Senado (primer trámite, sin votos Senado — esperado, Pitfall 2). Todos los endpoints respondieron HTTP 200.

## Threat Model Coverage

- **T-05-01 (Information Disclosure / RLS):** mitigado — policies public-read SOLO en las 4 tablas públicas + grant; `parlamentario` deny-by-default; pgTAP prueba `anon` SÍ lee las 4 y NO lee `parlamentario.rut` (como rol anon real).
- **T-05-02 (Tampering / voto.parlamentario_id):** mitigado — nullable + FK + default null; el poblado vive en olas 2-3 (solo confirmado vincula).
- **T-05-03 (DoS / XML):** diferido a olas siguientes (zod sobre el parse); fixtures < 50 KB.
- **T-05-SC (npm installs):** sin paquetes de runtime nuevos — `fast-xml-parser`/`zod`/`@supabase/supabase-js` ya auditados (Fases 1-4). Sin checkpoint de paquete.

## Known Stubs

- `packages/tramitacion/src/index.ts` exporta solo el modelo común; los parsers/timeline/reconciliación (`parseCamaraVotacion`, `parseSenadoTramitacion`, `parseSenadoVotacion`, `fusionarTimeline`, `reconciliarVotosSenado`) **NO existen aún por diseño** — son la diana RED del `slice.e2e.test.ts` que las olas 2-4 de esta fase implementan. No es un stub de datos que engañe a la UI; es el contrato walking-skeleton declarado del plan.

## Issues Encountered

- `supabase test db` no aplica la migración nueva por sí solo contra el estado actual; fue necesario `supabase db reset` (aplica 0001→0008 limpio) antes de correr los pgTAP. Sin efecto en el resultado.

## Next Phase Readiness

- **Ola 2-3** tienen el contrato del modelo común estable + las 5 fixtures reales para escribir los parsers (`parse-camara-votacion`, `parse-senado-tramitacion`, `parse-senado-votacion`) que vuelven verde Tests 1-3 del slice.
- **Ola 3-4** usan `correrPipeline` (Fase 4) + maestra para `reconciliarVotosSenado` (Test 4) y el writer idempotente Supabase (claves naturales ya en 0008).
- **Frontend** tiene las 4 tablas con RLS public-read → los Server Components leerán como `anon` sin quedar en blanco.

## Self-Check: PASSED

Archivos declarados existen y los 4 commits están en el historial:
- Archivos: package.json/tsconfig/vitest/index/model(.test)/slice.e2e + 5 fixtures + 0008_tramitacion.sql + 0007_tramitacion.test.sql + 05-01-SUMMARY.md — todos FOUND.
- Commits: 0d9e11c (T1), 665595c (T2 RED), ee6f88b (T2 GREEN), 4abd9a3 (T3) — todos FOUND.

---
*Phase: 05-tramitaci-n-core-ficha-timeline-votaciones*
*Completed: 2026-06-18*
