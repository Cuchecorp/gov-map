---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 03
subsystem: ingest
tags: [rss, base-connector, robots, rate-limit, allowlist, fingerprint, vitest]

# Dependency graph
requires:
  - phase: 132-01
    provides: FEEDS congelado (5 feeds), allowlistNews(), NEWS_HOSTS, fixtures __fixtures__/*.xml
provides:
  - "NewsConnector extends BaseConnector<RssRaw> — Etapa 1 completa (endpoints/validateShape/fingerprint)"
  - "buildNewsDeps() — fábrica de ConnectorDeps con allowlist scoped y fetchFn inyectable"
  - "Suite de tests estructurales que prueba SC1 (robots/rate-limit/orden) y la parte unitaria de SC2 (key R2)"
affects: [132-04, 132-05, 132-06, 132-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fábrica buildNewsDeps con fetchFn inyectable compartido entre Fetcher y RobotsGuard, para probar el par positivo/negativo de la allowlist sin red"
    - "Fingerprint estructural (set ordenado de nombres de tag) en vez de hash de bytes crudos, para que campos volátiles (lastBuildDate) no disparen drift ruidoso"

key-files:
  created:
    - packages/news/src/connector-news.ts
    - packages/news/src/connector-news.test.ts
  modified: []

key-decisions:
  - "fingerprint() es estructural sobre nombres de tag (D-132-C), nunca sobre los bytes crudos del XML"
  - "buildNewsDeps construye Fetcher y RobotsGuard con la MISMA allowlistNews() y el MISMO fetchFn, para que la mutación de allowlist sea testeable sin red"
  - "validateShape es un shape-guard suave por regex (sin zod) — el zod estricto queda para Etapa 2 (D-10)"

patterns-established:
  - "Conector de Etapa 1 = 3 hooks + fábrica de deps, jamás override de run()"

requirements-completed: [NEWS-01]

duration: 45min
completed: 2026-08-05
---

# Phase 132 Plan 03: NewsConnector Etapa 1 Summary

**NewsConnector extends BaseConnector<RssRaw> con fingerprint estructural sobre tags XML y buildNewsDeps() que inyecta la allowlist scoped de prensa en Fetcher Y RobotsGuard con fetchFn testeable sin red.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (ambos nuevos)

## Accomplishments
- `NewsConnector` implementa exactamente los 3 hooks del contrato (`endpoints`, `validateShape`, `fingerprint`), sin redefinir `run()` ni reimplementar rate-limit/robots/R2 (greps de acceptance criteria en 0).
- `buildNewsDeps()` ensambla `Fetcher` y `RobotsGuard` con la misma `allowlistNews()` y el mismo `fetchFn` inyectable, cerrando el hueco de régimen del Pitfall 1 (RobotsGuard construido con `{allowlist:{}}` bloquearía los 5 feeds en silencio).
- 15 tests (`≥ 12` exigidos) prueban por comportamiento: orden robots→rate-limit→fetch por feed, host derivado de la URL real (WR-01), skip con log en robots-disallow, cero ráfagas (wait intercalado entre gets), key de R2 `news/rss-<slug>/<fecha>/<sha256>.xml`, caché diaria que apaga el fetch, body byte-idéntico al fetch crudo, forma (5 fixtures reales + 3 rechazos), y fingerprint estable ante `<lastBuildDate>` pero sensible a tags nuevos.
- Par positivo/negativo de la allowlist (SC1-e) verificado íntegramente sin red vía `fetchFn` doble que registra las URLs pedidas — control positivo apareado, no solo el lado bloqueado.

## Task Commits

Each task was committed atomically:

1. **Task 1: NewsConnector con los 3 hooks + buildNewsDeps** - `ec8dd71` (feat)
2. **Task 2: Tests estructurales SC1 + parte unitaria del SC2** - `84e9f55` (test)

_Nota: Task 2 es `tdd="true"` mecánicamente (behavior + files de test), pero al depender de `NewsConnector` (Task 1) el orden ejecutado fue Task 1 (feat) → Task 2 (test) — no un ciclo RED/GREEN clásico, porque el "GREEN" ya existía como implementación completa antes de escribir los tests. Los 4 mutation tests (ver abajo) cumplen el rol anti-vacuo que normalmente cubriría el RED._

## Files Created/Modified
- `packages/news/src/connector-news.ts` - `NewsConnector extends BaseConnector<RssRaw>` (3 hooks) + `buildNewsDeps()` (fábrica de `ConnectorDeps` con allowlist scoped y `fetchFn` inyectable)
- `packages/news/src/connector-news.test.ts` - 15 tests: SC1 (robots+rate-limit+orden+allowlist par positivo/negativo), SC2 unitario (key R2, caché diaria, body crudo), forma, fingerprint, y control positivo del doble de fetcher

## Mutaciones obligatorias (anti-vacuo) — todas ejecutadas y revertidas

1. **`ext: "xml"` → `ext: "json"`** → cayó `SC2-a: r2.putImmutable recibe (...) y el r2Path matchea el patrón` (`expected 'json' to be 'xml'`). Revertido.
2. **`resource: \`rss-${f.slug}\`` → `"rss"` (literal fijo)** → cayeron 3 tests: `SC1-c` (log.skip con resource incorrecto), `SC2-a` (regex `^rss-[a-z]+$` no matchea `"rss"`), `SC2-c` (búsqueda por `rss-<slug>` no encuentra la call). Confirma cobertura de Pattern 2 (resource único por feed). Revertido.
3. **`RobotsGuard` con `{ allowlist: {} }` en vez de la allowlist recibida** → cayó `SC1-e` caso CORRECTO (`isAllowed` pasó de `true` a `false`: `expected false to be true`). Ejecutado íntegramente sin red gracias a `fetchFn`. Revertido.
4. **`fingerprint` → `sha256(raw.xml)` (bytes crudos)** → cayó el test de `<lastBuildDate>` (dos fingerprints distintos donde debían ser iguales). Revertido.

## Decisions Made
- `fingerprint()` estructural (set ordenado y deduplicado de nombres de tag) en vez de hash sobre bytes: documentado en cabecera del archivo con la razón (evitar ruido de `drift.alert` en cada corrida por `<lastBuildDate>`).
- `validateShape` es shape-guard suave por regex, sin zod (D-10 reserva el zod estricto para Etapa 2); `decodeJson` de `BaseConnector` siempre entrega `string` para XML, nunca JSON.
- `buildNewsDeps` NO construye `hostThrottle`/`cache`/`drift`/`r2`/`snapshot` reales — quedan con dobles no-op por defecto, overrideables via `Partial<ConnectorDeps>`; la instanciación real (Supabase/R2) es responsabilidad del worker (plan posterior), consistente con que 132-03 es solo Etapa 1 del conector, no el wiring de infraestructura.

## Deviations from Plan

None - plan ejecutado exactamente como escrito. La única decisión de implementación no explícita en el plan fue la forma exacta de `buildNewsDeps` para los colaboradores no mencionados (`cache`, `drift`, `r2`, `snapshot`, `hostThrottle`) — se usaron dobles no-op razonables, todos overrideables, sin afectar los criterios de aceptación (que solo exigen comportamiento de `fetcher`+`robots`+`rateLimiter`+`allowlist`+`fetchFn`).

## Issues Encountered
- Al correr `grep` de "cero fetch global" contra el propio comentario de cabecera del test (que mencionaba literalmente `globalThis.fetch`/`vi.stubGlobal("fetch")` como ejemplo de lo prohibido), el grep contaba 2 falsos positivos. Reescrito el comentario para no repetir los literales prohibidos — el grep quedó en 0 real.
- La primera corrida de `vitest` con color ANSI activo rompía el parseo de "Tests N passed" por captura de log (los códigos de color partían la cadena). Se verificó con `--no-color` + `CI=true` que el conteo real es 15/15 con exit code 0, siguiendo la compuerta de verificación del plan (conteo impreso + exit code, no solo uno).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `NewsConnector` y `buildNewsDeps` listos para que el worker (planes 132-04+) los instancie con colaboradores reales (Supabase snapshot store, R2Store, PgHostThrottle) y ejecute `run()` sin tocar el orden LOCKED.
- El fingerprint estructural y la key de R2 (`news/rss-<slug>/<fecha>/<sha256>.xml`) quedan fijos como contrato para Etapa 2 (parseo del crudo, planes 132-05+).
- No hay bloqueos.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*

## Self-Check: PASSED
- FOUND: packages/news/src/connector-news.ts
- FOUND: packages/news/src/connector-news.test.ts
- FOUND: commit ec8dd71
- FOUND: commit 84e9f55
