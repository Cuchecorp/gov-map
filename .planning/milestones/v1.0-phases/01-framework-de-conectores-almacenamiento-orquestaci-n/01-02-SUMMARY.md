---
phase: 01-framework-de-conectores-almacenamiento-orquestaci-n
plan: 02
subsystem: framework-de-ingesta
tags: [typescript, deno, vitest, tdd, aws4fetch, robots-parser, rate-limit, content-addressed, drift, provenance, template-method]

# Dependency graph
requires:
  - "@obs/core: Provenance/makeProvenance + tipos de control (IngestRun/SourceSnapshot/DriftAlert)"
  - "Contrato DDL de source_snapshot (unique source,resource,date_bucket + provenance inline)"
provides:
  - "@obs/ingest: BaseConnector (Template Method) con el flujo invariante de politica"
  - "Colaboradores instanciables: HostRateLimiter, RobotsGuard, Fetcher, DailyCache, R2Store, DriftDetector, SnapshotWriter"
  - "DummyConnector: walking skeleton E2E del framework sin fuentes reales"
  - "Contratos ConnectorDeps/RequestSpec/SnapshotRef que el worker de Plan 03 ensambla"
  - "sha256Hex + fingerprint estructural reutilizables (Web Crypto, sin libreria externa)"
affects: [orquestacion, conectores, tramitacion, busqueda-semantica]

# Tech tracking
tech-stack:
  added: [aws4fetch@1, robots-parser@3]
  patterns: [template-method, dependency-injection, serial-rate-limit-por-host, content-addressed-immutable, drift-no-bloqueante, tdd-red-green, mock-fetch-sin-red]

key-files:
  created:
    - packages/ingest/package.json
    - packages/ingest/tsconfig.json
    - packages/ingest/vitest.config.ts
    - packages/ingest/test/_helpers.ts
    - packages/ingest/test/fixtures/shape-base.json
    - packages/ingest/test/fixtures/shape-same.json
    - packages/ingest/test/fixtures/shape-changed.json
    - packages/ingest/src/rate-limiter.ts
    - packages/ingest/src/robots.ts
    - packages/ingest/src/fetcher.ts
    - packages/ingest/src/r2-store.ts
    - packages/ingest/src/cache.ts
    - packages/ingest/src/drift.ts
    - packages/ingest/src/snapshot.ts
    - packages/ingest/src/base-connector.ts
    - packages/ingest/src/dummy-connector.ts
    - packages/ingest/src/index.ts
    - packages/ingest/src/rate-limiter.test.ts
    - packages/ingest/src/robots.test.ts
    - packages/ingest/src/fetcher.test.ts
    - packages/ingest/src/r2-store.test.ts
    - packages/ingest/src/cache.test.ts
    - packages/ingest/src/drift.test.ts
    - packages/ingest/src/snapshot.test.ts
    - packages/ingest/src/base-connector.test.ts
  modified:
    - tsconfig.json

key-decisions:
  - "Rate-limiter serial por host via Map host->promesa-cola encadenada; primer request sin espera, subsiguientes minDelay+jitter (2-3s LOCKED)"
  - "lib DOM en tsconfig de @obs/ingest para tipar Web APIs (fetch/URL/setTimeout) del runtime Deno/edge"
  - "robots fail-open: robots.txt 404/error => permitir (no bloquear ingesta por ausencia de robots)"
  - "R2Store usa aws4fetch.sign() + fetch inyectable => testeable sin red; 412 = idempotente OK"
  - "drift.alert() traga errores de insert (no bloquea la ingesta; el crudo ya se capturo)"
  - "DummyConnector decodeJson tolerante: JSON.parse, fallback a texto crudo para XML/HTML"

patterns-established:
  - "Template Method: BaseConnector fija el orden invariante; los hooks (endpoints/validateShape/fingerprint) son lo unico que un conector reescribe"
  - "Dependency injection de colaboradores por constructor => unit tests con mocks, worker real con impls aws4fetch/supabase"
  - "mockFetch configurable (url->status/body) que lee headers/method de Request firmado por aws4fetch"
  - "TDD RED->GREEN: commit de test rojo separado antes de cada implementacion verde"

requirements-completed: [FND-01, FND-02, FND-03, FND-04, FND-08]

# Metrics
duration: 9min
completed: 2026-06-17
---

# Phase 1 Plan 02: Framework de conectores @obs/ingest Summary

**`@obs/ingest`: framework de conectores reutilizable que aplica politica UNA sola vez (rate-limit 2-3s serial por host, robots.txt, fetch con UA identificatorio + backoff-signal, cache diaria, R2 content-addressed inmutable via aws4fetch + If-None-Match, fingerprint de drift no-bloqueante y captura de provenance) orquestado por un BaseConnector Template Method, validado E2E por un DummyConnector sin tocar fuentes gubernamentales reales.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-17T23:56:24Z
- **Tasks:** 3 (todas tdd)
- **Files created:** 25 (8 src de produccion, 8 src de test, 3 fixtures, scaffold + helpers)
- **Tests:** 32 verdes en 8 archivos, sin red

## Accomplishments
- **Politica de fetch centralizada (FND-01):** `HostRateLimiter` serial por host (2-3s + jitter, aislado entre hosts), `RobotsGuard` sobre robots-parser@3 con UA LOCKED y cache por host, `Fetcher` que setea el UA y senaliza retry (RetryableError) ante 429/5xx sin devolver body (FND-05 backoff).
- **Almacenamiento e integridad (FND-02, FND-03, FND-04, FND-08):** `R2Store.putImmutable` content-addressed via aws4fetch + `If-None-Match: *` (412 = idempotente); `DailyCache` con `dailyKey` estable y `hasToday` por (source,resource,dia); `DriftDetector` con fingerprint estructural + alerta no-bloqueante; `SnapshotWriter` que persiste solo referencias + provenance (crudo nunca en Postgres).
- **Framework E2E (Template Method):** `BaseConnector` fija el flujo invariante `cache->robots->rateLimiter.wait->fetcher.get->drift->R2->snapshot`; ningun conector puede saltarse `rateLimiter.wait`. `DummyConnector` lo recorre completo retornando un `SnapshotRef` con r2Path/contentHash y capturando provenance — el walking skeleton de ingesta, sin tocar Camara/Senado/BCN (Fases 5-7).
- **Contratos para Plan 03:** `index.ts` exporta BaseConnector, DummyConnector, ConnectorDeps/RequestSpec/SnapshotRef y todos los colaboradores instanciables para que la Edge Function worker los ensamble con impls reales.

## Task Commits

Cada tarea siguio TDD (test rojo separado antes del verde):

1. **Task 1: Politica de fetch (rate-limiter, robots, fetcher)**
   - `test(01-02)` RED → `feat(01-02)` GREEN
2. **Task 2: Almacenamiento, cache y drift (r2-store, cache, drift, snapshot)**
   - `test(01-02)` RED → `feat(01-02)` GREEN
3. **Task 3: BaseConnector (Template Method) + DummyConnector E2E**
   - `test(01-02)` RED → `feat(01-02)` GREEN

## Files Created/Modified
- `packages/ingest/package.json` / `tsconfig.json` / `vitest.config.ts` - Scaffold de `@obs/ingest` (depende de @obs/core workspace, aws4fetch, robots-parser; lib DOM)
- `packages/ingest/test/_helpers.ts` - mockFetch configurable (url->status/body) que lee Request firmado por aws4fetch
- `packages/ingest/test/fixtures/*.json` - Formas estructurales same/changed para drift
- `packages/ingest/src/rate-limiter.ts` - HostRateLimiter serial por host (FND-01)
- `packages/ingest/src/robots.ts` - RobotsGuard + IDENTIFIED_UA LOCKED (FND-01)
- `packages/ingest/src/fetcher.ts` - Fetcher con UA + RetryableError en 429/5xx (FND-05)
- `packages/ingest/src/r2-store.ts` - R2Store.putImmutable content-addressed + sha256Hex Web Crypto (FND-02)
- `packages/ingest/src/cache.ts` - DailyCache dailyKey + hasToday (FND-03)
- `packages/ingest/src/drift.ts` - fingerprint estructural + DriftDetector no-bloqueante (FND-04)
- `packages/ingest/src/snapshot.ts` - SnapshotWriter con provenance inline (FND-08)
- `packages/ingest/src/base-connector.ts` - Template Method del flujo invariante
- `packages/ingest/src/dummy-connector.ts` - Walking skeleton E2E (no fuente real)
- `packages/ingest/src/index.ts` - API publica + colaboradores para Plan 03
- `packages/ingest/src/*.test.ts` (8) - Tests por requisito, sin red
- `tsconfig.json` (raiz) - Referencia a packages/ingest en project references

## Decisions Made
- **Rate-limiter serial por host** via `Map<host, Promise>` encadenado: el primer request a un host resuelve inmediato; los siguientes esperan `minDelay + jitter`. Hosts distintos no se serializan (colas independientes). La politica vive una sola vez en el framework.
- **lib DOM en el tsconfig de @obs/ingest** — el codigo consume Web APIs (`fetch`, `URL`, `setTimeout`) que son globales en el runtime Deno/edge; el tsconfig base solo declaraba `ES2022`. Sin DOM, `tsc -b` falla con "Cannot find name 'fetch'".
- **robots fail-open** — ante robots.txt ausente (404) o error de red se permite por defecto; no bloquear la ingesta por la ausencia de robots.txt.
- **412 = exito idempotente** en R2Store — content-addressing (key=sha) + `If-None-Match: *` hace el PUT atomico; un 412 significa "ya existia el mismo contenido" (FND-02 inmutabilidad sin race).
- **drift.alert no propaga errores** — registrar la alerta es best-effort; el crudo ya se capturo, asi que un fallo al insertar drift_alert no debe detener la ingesta (FND-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tsc -b` no encuentra Web APIs globales (fetch/URL/setTimeout)**
- **Found during:** Task 1 (verificacion typecheck)
- **Issue:** El tsconfig base declara `lib: ["ES2022"]` (sin DOM). El framework usa `fetch`, `URL` y `setTimeout` — globales del runtime Deno/edge — y `tsc -b` fallaba con TS2304/TS2552.
- **Fix:** `lib: ["ES2022", "DOM"]` en `packages/ingest/tsconfig.json` (solo este paquete, que es el que toca Web APIs).
- **Files modified:** packages/ingest/tsconfig.json
- **Verification:** `pnpm --filter @obs/ingest typecheck` y `pnpm -w typecheck` con exit 0.
- **Committed in:** GREEN de Task 1

**2. [Rule 1 - Bug] mockFetch no leia headers/method del Request firmado por aws4fetch**
- **Found during:** Task 2 (Test 1c If-None-Match)
- **Issue:** `aws4fetch.sign()` devuelve un `Request` con method/headers embebidos; el mockFetch solo leia de `init`, dejando los headers vacios => el assert de `If-None-Match` fallaba.
- **Fix:** El mockFetch detecta `input instanceof Request` y lee method/headers del Request ademas de `init`.
- **Files modified:** packages/ingest/test/_helpers.ts
- **Verification:** Test 1c y el resto de r2-store verdes.
- **Committed in:** GREEN de Task 2

**3. [Rule 1 - Bug, test-fixture] Tests happy-path de R2 no registraban respuesta 200**
- **Found during:** Task 2 (Test 1a/1c)
- **Issue:** `makeMockFetch({})` (sin rutas) devuelve 404 por defecto; el PUT feliz lanzaba en vez de devolver la key. (El default 404 es correcto y necesario para el test fail-open de robots, asi que se ajusto el test de R2, no el mock.)
- **Fix:** Los tests de R2 happy-path registran una ruta con `{ status: 200 }` para la URL del objeto.
- **Files modified:** packages/ingest/src/r2-store.test.ts
- **Verification:** r2-store verde (5 tests).
- **Committed in:** GREEN de Task 2

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs). Sin cambios arquitectonicos. Cero conectores de fuentes reales adelantados.
**Impact on plan:** Todas necesarias para que la suite y el typecheck corran verdes. Sin scope creep.

## Known Stubs

Ninguno que impida el objetivo del plan. El `DummyConnector` apunta a un endpoint de prueba (`https://dummy.local/echo`) **por diseno** — es el walking skeleton que ejercita el flujo invariante sin tocar fuentes reales; los conectores de fuentes gubernamentales (Camara/Senado/BCN) son explicitamente Fases 5-7. No hay datos hardcodeados que fluyan a UI (no hay UI en esta fase).

## Threat Flags

Sin superficie nueva fuera del `<threat_model>` del plan. Las mitigaciones del registro STRIDE quedaron implementadas: aws4fetch para SigV4 (T-01-05), sin secrets en mensajes de error (T-01-06, test lo verifica), `If-None-Match: *` atomico (T-01-07), drift no-bloqueante (T-01-08). El hook de allow-list de hosts (T-01-04 SSRF) queda como contrato: el worker de Plan 03 valida el host antes del fetch; el DummyConnector declara su host explicitamente en `RequestSpec.host`.

## Issues Encountered
- Ninguno mas alla de las 3 desviaciones documentadas. La suite completa (32 tests) corre en <1s sin red.

## Next Phase Readiness
- **Plan 03 (orquestacion)** puede instanciar los colaboradores exportados (`HostRateLimiter`, `RobotsGuard`, `Fetcher`, `DailyCache`, `R2Store`, `DriftDetector`, `SnapshotWriter`) y un conector concreto en la Edge Function worker; el contrato `ConnectorDeps` define el ensamblaje.
- **Pendiente para Plan 03:** migracion 0003 (pgmq queues + util.process_ingest_jobs + pg_cron schedule), el worker `ingest-worker` (Deno) que desencola lotes y corre `BaseConnector.run`, y el cableado de `SnapshotLookup`/`DriftStore`/`SnapshotStore` contra supabase-js.
- **Blocker heredado de Plan 01:** verificar existencia del bucket R2 (checkpoint humano) antes de las pruebas de integracion reales contra R2; los tests de esta fase mockean R2 y no requieren red.

## Self-Check: PASSED

Todos los archivos declarados existen y los 6 commits de tarea (3 RED + 3 GREEN) estan en el historial:
- Archivos: base-connector.ts, dummy-connector.ts, index.ts, rate-limiter.ts, r2-store.ts, drift.ts, cache.ts, snapshot.ts, robots.ts, fetcher.ts, 01-02-SUMMARY.md — todos FOUND.
- Commits: 7dd4f68/0905af4 (T1), ca725ed/a522302 (T2), 3267d3e/5d4a7a3 (T3) — todos FOUND.
- Suite: 32 tests verdes (8 archivos); `pnpm -w typecheck` exit 0.
