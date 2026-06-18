---
phase: 03-tabla-maestra-parlamentario-identidad-determinista
plan: 03
subsystem: identidad
tags: [fast-xml-parser, zod, seeder, idempotencia, provenance, backup, fixtures-reales, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: "normalizarNombre, matchDeterminista, tipo Parlamentario + ParlamentarioSeedSchema (@obs/core/@obs/identity)"
  - phase: 03-02
    provides: "DDL parlamentario + indices unicos parciales (clave natural para upsert idempotente)"
  - phase: 01-02
    provides: "@obs/ingest: Fetcher/RobotsGuard/HostRateLimiter/assertAllowedUrl + makeProvenance"
provides:
  - "parseSenado: XML real Senado -> 31 Parlamentario (camara=senado) con parlid"
  - "parseCamara: XML real Camara -> 155 Parlamentario (camara=diputados) con militancia vigente"
  - "runSeeder: orquesta fetch (reusa @obs/ingest) -> parse -> matchDeterminista, combinando ambos catalogos con provenance"
  - "upsertMaestra: upsert idempotente por clave natural via writer inyectable"
  - "exportMaestra: snapshot JSON determinista (ID-09 git autoritativo) + R2 gateado por r2Enabled"
  - "Fixtures reales senado-real.xml (12.9KB) + camara-real.xml (179KB) capturados live 2026-06-18"
affects: [04-adjudicacion-llm-golden-set, 05-conectores-tramitacion-votaciones]

# Tech tracking
tech-stack:
  added: [fast-xml-parser (ahora EN USO en @obs/identity), "@obs/ingest (dep de @obs/identity)"]
  patterns:
    - "Seeder REUSA colaboradores de @obs/ingest (assertAllowedUrl->robots->rateLimiter.wait->fetcher.get), NO BaseConnector (caceria diaria saltaria re-siembras)"
    - "Idempotencia en la clave natural del upsert (parlid_senado/id_diputado_camara), no en cache de dia"
    - "Backup determinista: filas ordenadas por id + claves ordenadas -> byte-identico + round-trip + diff git estable"
    - "Writers inyectables (MaestraWriter, SeedFileWriter, R2BackupTarget) -> testeable sin Postgres/disco/red; impls reales en Plan 04"
    - "Parsers fuerzan array con [].concat(...) y validan cada fila con ParlamentarioSeedSchema (zod) antes de devolver"

key-files:
  created:
    - packages/identity/test/fixtures/senado-real.xml
    - packages/identity/test/fixtures/camara-real.xml
    - packages/identity/src/parse-senado.ts
    - packages/identity/src/parse-senado.test.ts
    - packages/identity/src/parse-camara.ts
    - packages/identity/src/parse-camara.test.ts
    - packages/identity/src/seeder.ts
    - packages/identity/src/seeder.test.ts
    - packages/identity/src/backup.ts
    - packages/identity/src/backup.test.ts
  modified:
    - packages/identity/src/index.ts
    - packages/identity/package.json
    - packages/identity/tsconfig.json
    - tsconfig.base.json

key-decisions:
  - "periodo senadores = 'senado-vigente-2026' (A2): los vigentes son un solo conjunto; la clave (camara,periodo) solo necesita consistencia DENTRO de la camara"
  - "periodo diputados = '2026-2030' (Id 11 / Leg 374·58 confirmado live)"
  - "partidoVigente filtra por la Militancia que cubre el corte 2026-03-11 (Pitfall 5), NO el nodo DiputadoPeriodo (FechaInicio 2030-03-10 contraintuitivo)"
  - "Seeder NO auto-confirma: corre matchDeterminista pero deja estado=no_confirmado (compuerta humana ID-01)"
  - "Backup git ES el respaldo fuera de Supabase que cumple ID-09 HOY; R2 (r2Enabled=false) y push remoto = pasos de operador diferidos (401)"

requirements-completed: [ID-01, ID-02, ID-09]

# Metrics
duration: 18min
completed: 2026-06-18
---

# Phase 3 Plan 03: Parsers + Seeder idempotente + Backup (rebanada vertical) Summary

**Rebanada end-to-end de identidad con datos REALES: `parseSenado`/`parseCamara` mapean el XML live (31 senadores + 155 diputados con militancia vigente) al modelo `Parlamentario`; `runSeeder` orquesta fetch reusando `@obs/ingest` -> parse -> `matchDeterminista` (sin auto-confirmar) y `upsertMaestra` es idempotente por clave natural; `exportMaestra` produce un snapshot JSON determinista en git (ID-09 autoritativo HOY) con R2 gateado. 34 tests verdes sobre fixtures reales sin red; typecheck exit 0.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-18T08:47:00Z (aprox.)
- **Completed:** 2026-06-18T08:55:00Z (aprox.)
- **Tasks:** 3 (todas tdd: RED -> GREEN)
- **Files:** 14 (10 creados, 4 modificados)
- **Tests:** 34 verdes en 5 archivos (20 nuevos en este plan), sin red

## Accomplishments

- **Fixtures reales capturados live (2026-06-18)** con UA `Bot-Ciudadano/1.0` respetando rate-limit: `senado-real.xml` (HTTP 200, 12897 bytes, 31 senadores) y `camara-real.xml` (HTTP 200, 179061 bytes, 155 diputados). Tamaños y conteos coinciden EXACTAMENTE con 03-RESEARCH. No hubo 403/429: no se necesito fallback hand-written.
- **parseSenado (ID-01):** `<senadores><senador>` -> 31 `Parlamentario` con `camara="senado"`, `parlid_senado` (PARLID), apellidos/nombres, region, circunscripcion, partido, email; `nombre_normalizado` via `normalizarNombre` (excluye el materno); `rut`/`distrito`/`id_diputado_camara` null. Cada fila valida `ParlamentarioSeedSchema`.
- **parseCamara (ID-01):** `<DiputadosPeriodoColeccion><DiputadoPeriodo><Diputado>` -> exactamente 155 `Parlamentario` con `camara="diputados"`, `id_diputado_camara` (Id), `rut`/`distrito` null (Pitfall 4). `partidoVigente(militancias, corte)` elige la `<Militancia>` cuyo rango cubre `2026-03-11` (Pitfall 5: NO el nodo periodo cuya FechaInicio es 2030-03-10). Verificado: Santibáñez (1074) -> IND, Urcullú (1254) -> PREP.
- **runSeeder (ID-01, ID-02):** por cada catalogo hace `assertAllowedUrl` (SSRF deny-by-default, T-03-07) -> `robots.isAllowed` -> `rateLimiter.wait(host)` (2-3s serial, T-03-08) -> `fetcher.get` -> parse, REUSANDO `@obs/ingest` sin reimplementar rate-limit. Combina 31+155=186 filas con provenance (origen/fecha_captura/enlace) por fila, corre `matchDeterminista`, y deja `estado=no_confirmado` (NO auto-confirma — compuerta humana ID-01). NO usa `BaseConnector.run` (su cache diaria saltaria re-siembras del mismo dia — anti-pattern de 03-RESEARCH).
- **upsertMaestra (ID-01):** upsert por clave natural via `MaestraWriter` inyectable; correr 2x con el mismo input deja 186 filas sin duplicados (idempotente). El writer real contra Supabase local lo cablea Plan 04.
- **exportMaestra (ID-09):** serializacion determinista (filas ordenadas por `id`, claves de cada objeto ordenadas) -> dos exports byte-identicos y round-trip export->parse->import preserva la maestra. Destino autoritativo `supabase/seeds/parlamentario.seed.json`. R2 gateado por `r2Enabled` (default false): R2 ausente o que lanza 401 NO rompe el export a git (ID-09 cumplido HOY solo con git).

## Task Commits

Cada tarea siguio TDD (RED -> GREEN):

1. **Task 1: Fixtures reales + parsers** - `43a422b` (test/RED) -> `2006f59` (feat/GREEN)
2. **Task 2: Seeder idempotente** - `534ab4d` (test/RED) -> `9a16081` (feat/GREEN)
3. **Task 3: exportMaestra backup** - `4df26db` (test/RED) -> `8cbf39e` (feat/GREEN)

## Files Created/Modified

- `packages/identity/test/fixtures/senado-real.xml` - Muestra REAL Senado (12.9KB, 31 senadores), capturada live.
- `packages/identity/test/fixtures/camara-real.xml` - Muestra REAL Camara (179KB, 155 diputados), capturada live.
- `packages/identity/src/parse-senado.ts` - `parseSenado` + `SENADO_URL`/`SENADO_PERIODO`; fast-xml-parser@5 + zod.
- `packages/identity/src/parse-camara.ts` - `parseCamara` + `partidoVigente` (militancia vigente) + `CAMARA_URL`/`CAMARA_PERIODO`/`CORTE_VIGENCIA`.
- `packages/identity/src/seeder.ts` - `runSeeder`/`upsertMaestra` + `SeederDeps`/`MaestraWriter`; reusa @obs/ingest.
- `packages/identity/src/backup.ts` - `exportMaestra`/`serializeMaestra` + `SEED_PATH`/`SeedFileWriter`/`R2BackupTarget`.
- `packages/identity/src/*.test.ts` (3) - 20 tests nuevos sobre fixtures reales + mocks, sin red.
- `packages/identity/src/index.ts` - Exporta parsers, seeder, backup.
- `packages/identity/package.json` - Anade `@obs/ingest` como workspace dep.
- `packages/identity/tsconfig.json` - Project reference a `../ingest`.
- `tsconfig.base.json` - Path mapping `@obs/ingest`.

## Decisions Made

- **`periodo` por camara (A2 resuelto):** senadores = `senado-vigente-2026` (etiqueta consistente; los vigentes son un solo conjunto), diputados = `2026-2030` (Id 11 confirmado live). El matcher por (camara, periodo) solo requiere consistencia DENTRO de cada camara.
- **Militancia vigente por corte (Pitfall 5):** `partidoVigente` filtra por la `<Militancia>` cuyo rango cubre `2026-03-11`; `FechaTermino` nil = vigente sin fin. NO se usa la fecha del nodo `<DiputadoPeriodo>` (2030-03-10, contraintuitiva).
- **Seeder no auto-confirma:** corre `matchDeterminista` por fila (auditoria), pero asigna `estado=no_confirmado`; la promocion a `confirmado` es revision humana (ID-01). Coherente con el default DDL de 03-02.
- **`@obs/ingest` como dep de `@obs/identity`:** el seeder reusa la politica de fetch de Fase 1; requirio alta de la dep (workspace + path mapping en tsconfig.base + project reference). Sin esto, el seeder reimplementaria rate-limit/robots/SSRF (anti-pattern).
- **R2 gateado por `r2Enabled` (default false):** las credenciales R2 dan 401 hoy (CONTEXT); el snapshot git es autoritativo. R2 + push remoto = pasos de operador diferidos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Alta de `@obs/ingest` como dependencia de `@obs/identity`**
- **Found during:** Task 2 (seeder, antes del fetch reusando @obs/ingest)
- **Issue:** `@obs/identity` no declaraba `@obs/ingest` como dependencia, ni habia path mapping (`tsconfig.base.json`) ni project reference (`tsconfig.json`). El seeder no podia importar `Fetcher`/`RobotsGuard`/`assertAllowedUrl` sin esto, y `tsc -b` fallaria.
- **Fix:** Anadido `"@obs/ingest": "workspace:*"` a package.json, path mapping `@obs/ingest` en tsconfig.base.json, y `{ "path": "../ingest" }` en references; `pnpm install` para linkear.
- **Files modified:** packages/identity/package.json, packages/identity/tsconfig.json, tsconfig.base.json
- **Verification:** `pnpm -w typecheck` exit 0; seeder importa y usa @obs/ingest.
- **Committed in:** `9a16081` (GREEN de Task 2)

**2. [Rule 1 - Bug] Cast invalido `Parlamentario -> Record<string,unknown>` en backup**
- **Found during:** Task 3 (typecheck tras GREEN de backup)
- **Issue:** `withSortedKeys` casteaba `obj as Record<string, unknown>` directamente; TS2352 ("neither type sufficiently overlaps") porque `Parlamentario` no tiene index signature. Los tests pasaban (vitest no chequea tipos) pero `tsc -b` fallaba.
- **Fix:** Doble cast `obj as unknown as Record<string, unknown>` (patron estandar para iterar claves de un objeto tipado).
- **Files modified:** packages/identity/src/backup.ts
- **Verification:** `pnpm -w typecheck` exit 0; 7 tests de backup verdes.
- **Committed in:** `8cbf39e` (GREEN de Task 3)

**Total deviations:** 2 auto-fixed (1 blocking de scaffold, 1 bug de tipo). Sin scope creep, sin cambios arquitectonicos.

## TDD Gate Compliance

Plan `type: execute` con tareas `tdd="true"`. Secuencia RED -> GREEN verificada en git log para las 3 tareas (cada RED commiteado fallando por modulo ausente antes del GREEN). REFACTOR no necesario.

## Threat Model Coverage

- **T-03-07 (SSRF):** mitigado — `runSeeder` llama `assertAllowedUrl` antes de cada fetch (deny-by-default + bloqueo de IPs internas); reuso de @obs/ingest.
- **T-03-08 (DoS auto-infligido / WAF):** mitigado — reuso de `HostRateLimiter` (serial por host) + `RobotsGuard` + `IDENTIFIED_UA`; el seeder NO reimplementa la politica.
- **T-03-09 (XML malformado):** mitigado — `fast-xml-parser` sin expansion de entidades externas; `ParlamentarioSeedSchema` (zod) valida cada fila antes de devolver; catalogos < 200KB.
- **T-03-10 (Information Disclosure):** mitigado — `rut` sale null de ambos catalogos (no se fabrica dato personal); R2 crudo gateado.
- **T-03-SC (fast-xml-parser):** auditado en 03-RESEARCH ([OK], sin postinstall, latest=5.9.2); ahora en uso real.

## Known Stubs

- **Writers reales diferidos a Plan 04 (por diseno):** `MaestraWriter` (upsert a Supabase local) y `SeedFileWriter` (escritura a disco de `supabase/seeds/parlamentario.seed.json`) son interfaces inyectables; las impls reales y la corrida LIVE (fetch real -> upsert local -> snapshot en git) las cablea Plan 04. No es un stub que bloquee el objetivo de ESTE plan (la logica end-to-end esta testeada con fixtures reales + fakes); es la frontera explicita entre "logica verde sobre fixtures" (Plan 03) y "corrida live + persistencia" (Plan 04).
- **R2 (`r2Enabled=false`):** gateado por credencial 401 (deferred de CONTEXT); el snapshot git cumple ID-09 hoy.

## Issues Encountered

- Ninguno mas alla de las 2 desviaciones documentadas. Ambos fetches live devolvieron 200 al primer intento (sin 403/429), por lo que no se uso el fallback hand-written.

## Next Phase Readiness

- **Plan 04 (corrida live + persistencia + adjudicacion):** instancia `Fetcher`/`HostRateLimiter`/`RobotsGuard` reales, cablea un `MaestraWriter` contra Supabase local (upsert sobre los indices unicos parciales de 03-02), un `SeedFileWriter` que escribe `supabase/seeds/parlamentario.seed.json`, corre `runSeeder` LIVE, y aborda la adjudicacion LLM + golden set + gate humano.
- **Operador:** push de migracion + seed al Supabase REMOTO y respaldo a R2 live siguen pendientes de credencial (DB password/PAT; cred S3 correcta) — deferred de CONTEXT.

## Self-Check: PASSED

Archivos declarados existen y los 6 commits de tarea (3 RED + 3 GREEN) estan en el historial:
- Archivos: parse-senado.ts, parse-camara.ts, seeder.ts, backup.ts, fixtures/{senado,camara}-real.xml, 03-03-SUMMARY.md — todos FOUND.
- Commits: 43a422b/2006f59 (T1), 534ab4d/9a16081 (T2), 4df26db/8cbf39e (T3) — todos FOUND.
- Suite: 34 tests verdes (5 archivos); `pnpm -w typecheck` exit 0.

---
*Phase: 03-tabla-maestra-parlamentario-identidad-determinista*
*Completed: 2026-06-18*
