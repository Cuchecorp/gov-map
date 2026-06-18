---
phase: 06-citaciones-tabla-semanal-de-sala
plan: 03
subsystem: agenda
tags: [agenda, conectores, reuso-obs-ingest, header-set-cloudflare, writer-idempotente, runIngest, degradacion-honesta, cli-backfill, semana-iso, forward-only]

# Dependency graph
requires:
  - "06-01: modelo común + migración 0010 (claves naturales para upsert) + RLS public-read + 3 fixtures reales"
  - "06-02: parseCamaraCitaciones/parseSenadoCitaciones/parseSenadoTabla + helper ISO (enumerarSemanas/prmSemanaParam)"
  - "05-05: patrón conector+writer idempotente+runIngest+CLI (reuso @obs/ingest, NO BaseConnector.run)"
  - "01-02: Fetcher/RobotsGuard/HostRateLimiter/assertAllowedUrl de @obs/ingest"
provides:
  - "CitacionesCamaraConnector: fetch reusando @obs/ingest (orden LOCKED) + header-set anti-Cloudflare; 403→CamaraBloqueadaError; PDF tabla (degradación)"
  - "SenadoActividadConnector: fetchCitaciones/fetchTablaSala desde web-back.senado.cl/api; fallback _next/data documentado (no default)"
  - "AgendaWriter inyectable + InMemoryAgendaWriter + SupabaseAgendaWriter (upsert onConflict por clave natural en las 5 tablas)"
  - "runIngest: enumera semanas Cámara, ingesta Senado forward-only + tabla Senado, degrada Cámara (403 + tabla→PDF) sin abortar"
  - "ingest-cli (tsx): --desde/--hasta (backfill por rango), --solo-senado, --dry-run validados ANTES de red/DB"
  - "Fetcher.get extendido con headers opcionales (fusión sobre UA) para el header-set CF"
affects: [frontend-agenda, ingesta-incremental-futura]

# Tech tracking
tech-stack:
  added: []
  patterns: [reuso-obs-ingest-orden-locked, header-set-anti-cloudflare, writer-idempotente-clave-natural-anidado-aplanado, degradacion-honesta-pdf-sin-fabricar, tolerancia-403-sin-abortar-fuente-hermana, cli-backfill-rango-semanas, conectores-inyectables-para-tests-hermeticos]

key-files:
  created:
    - packages/agenda/src/headers-camara.ts
    - packages/agenda/src/connector-camara.ts
    - packages/agenda/src/connector-camara.test.ts
    - packages/agenda/src/connector-senado.ts
    - packages/agenda/src/connector-senado.test.ts
    - packages/agenda/src/writer.ts
    - packages/agenda/src/writer.test.ts
    - packages/agenda/src/writer-supabase.ts
    - packages/agenda/src/ingest-run.ts
    - packages/agenda/src/ingest-run.test.ts
    - packages/agenda/src/ingest-cli.ts
    - packages/agenda/src/ingest-cli.test.ts
  modified:
    - packages/agenda/src/index.ts
    - packages/ingest/src/fetcher.ts

key-decisions:
  - "Conectores reusan @obs/ingest en el ORDEN LOCKED (assertAllowedUrl→robots→rateLimiter.wait→fetcher.get); NO BaseConnector.run (su caché diaria saltaría re-corridas)"
  - "Cámara envía BROWSER_HEADERS_CAMARA (header-set de navegador completo) para pasar Cloudflare; el Senado (web-back) NO los envía (API limpia)"
  - "Fetcher.get extendido con `headers?` opcional fusionado sobre el UA por defecto — cambio mínimo y backwards-compatible en @obs/ingest para soportar el header-set CF"
  - "403 de Cámara se relanza como CamaraBloqueadaError → runIngest reintenta con backoff y, si persiste, degrada la fuente Cámara sin abortar la del Senado (T-06-07)"
  - "Tabla de sala de Cámara = degradación honesta: runIngest registra el PDF (verDoc.aspx?prmTipo=TABLASEMANAL) como marcador y NUNCA llama upsertSesiones para Cámara → 0 filas de tabla de Cámara (T-06-09)"
  - "Writer aplana los arrays anidados (invitados/puntos/items) a filas de las tablas hijas; la posicion del punto/ítem es el discriminador de la clave natural; de-dup por clave de conflicto antes del lote"
  - "CLI hace backfill por rango de semanas ISO (--desde/--hasta → enumerarSemanas); validación de YYYY-Www + rango cruzado ANTES de tocar red/DB"

requirements-completed: [TRAM-07, TRAM-08]

# Metrics
duration: 9min
completed: 2026-06-18
---

# Phase 6 Plan 03: Conectores + writer + runIngest + CLI Summary

**Cablea la maquinaria de ingesta de la agenda: `CitacionesCamaraConnector` (reusa `@obs/ingest` en el ORDEN LOCKED + el header-set de navegador anti-Cloudflare `BROWSER_HEADERS_CAMARA`, con enumeración de semanas ISO para la cobertura completa) y `SenadoActividadConnector` (API backend limpia `web-back.senado.cl/api/{commissions_citations,weekly_table}`, fallback `_next/data` documentado), el `AgendaWriter` idempotente por clave natural (in-memory + `SupabaseAgendaWriter` con `upsert onConflict` en las 5 tablas de 0010, aplanando los arrays anidados), y `runIngest` + el CLI que orquestan la corrida tolerante: enumera las semanas de Cámara, ingesta la ventana forward-only del Senado + su tabla de sala estructurada, y DEGRADA honestamente la tabla de Cámara al PDF (sin fabricar filas). Si Cámara da 403 persistente, runIngest hace backoff y degrada esa fuente sin abortar la del Senado. El CLI soporta backfill por rango de semanas (`--desde`/`--hasta`) con los flags validados antes de tocar red/DB. 84 tests verdes en `@obs/agenda`; `pnpm -w typecheck` exit 0.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-18T19:09:15Z
- **Completed:** 2026-06-18T19:17:53Z
- **Tasks:** 2 (ambas type=auto)
- **Files:** 12 creados, 2 modificados
- **Tests:** 84 verdes (16 nuevos de conectores+writer en Task 1, 12 nuevos de ingest-run+cli en Task 2, + 56 previos); `pnpm -w typecheck` exit 0; suite @obs/ingest 56/56 verde tras extender Fetcher

## Accomplishments

- **Header-set anti-Cloudflare (`headers-camara.ts`)** — `BROWSER_HEADERS_CAMARA` con el header-set de navegador completo verbatim del RESEARCH (UA Chrome + sufijo `Bot-Ciudadano/1.0`, `Sec-Ch-Ua*`, `Sec-Fetch-*`, `Accept-Language`, `Upgrade-Insecure-Requests`), congelado (`Object.freeze`) en un único módulo para no duplicarlo entre conector y tests.
- **Conector de Cámara (`connector-camara.ts`)** — `CitacionesCamaraConnector` reusa `@obs/ingest` en el ORDEN LOCKED `assertAllowedUrl → robots.isAllowed → rateLimiter.wait(host) → fetcher.get({ url, headers: BROWSER_HEADERS_CAMARA })`. `fetchSemana(year, week)` arma `citaciones_semana.aspx?prmSemana={año}-{semana}` (sin padding, vía `prmSemanaParam`); `fetchPdfTabla()` devuelve solo la URL del PDF + content_type para la degradación (NO emite request). Un 403 del WAF se relanza como `CamaraBloqueadaError` para que `runIngest` degrade. NO `BaseConnector.run`.
- **Conector del Senado (`connector-senado.ts`)** — `SenadoActividadConnector` con `fetchCitaciones()`/`fetchTablaSala()` contra `web-back.senado.cl/api/{commissions_citations,weekly_table}?limit=100`, mismo orden LOCKED SIN header-set CF (la API backend es limpia). `fetchVia_NextData(buildId, ruta)` queda como fallback documentado (NO default) con el `buildId` autodetectable.
- **Writer idempotente (`writer.ts` + `writer-supabase.ts`)** — `AgendaWriter` inyectable (`upsertCitaciones`/`upsertSesiones`), `InMemoryAgendaWriter` (Map por clave natural → 2× no duplica) y `SupabaseAgendaWriter` que espeja el de Fase 5: `upsert onConflict` por clave natural en las 5 tablas de 0010 (`citacion`→id, `citacion_invitado`→citacion_id,nombre, `citacion_punto`→citacion_id,posicion, `sesion_sala`→id, `sesion_tabla_item`→sesion_id,posicion). Aplana los arrays anidados a filas hijas (la `posicion` del punto = índice en el orden), raíz ANTES que hijos (FK), de-dup por clave de conflicto antes del lote. Service key NUNCA interpolada en errores (T-06-06).
- **Orquestación (`ingest-run.ts`)** — `runIngest({ conectorCamara, conectorSenado, writer, semanas, soloSenado? })`: (1) Cámara — por cada semana ISO fetch+parse+upsert; 403 → backoff y reintento; 403 PERSISTENTE → marca la fuente Cámara degradada y CONTINÚA (no aborta el Senado). (2) Senado citaciones forward-only (no fabrica histórico). (3) Senado tabla de sala (`weekly_table` → sesion_sala/items). (4) Cámara tabla = degradación honesta al PDF (NUNCA `upsertSesiones` para Cámara → 0 filas). Devuelve reporte por fuente (filas, errores por semana, degradaciones); tolerante a fuentes vacías.
- **CLI (`ingest-cli.ts`)** — espeja el de Fase 5: `--desde YYYY-Www`/`--hasta YYYY-Www` (backfill por rango → `enumerarSemanas`), `--solo-senado`, `--dry-run`, `--service-key`, todos validados ANTES de red/DB (`parseSemanaIso` + validación cruzada del rango). Sin service key → dry-run con aviso. Conectores inyectables para los tests herméticos (sin red). Script `ingest` (tsx) ya en package.json.

## Task Commits

1. **Task 1: conectores (Cámara header-set CF + Senado API) + writer idempotente** — `6be83f8` (feat)
2. **Task 2: orquestación runIngest (tolerante + degradación) + CLI** — `a0523dc` (feat)

## Decisions Made

- **Reuso, no reimplementación, de la política de fetch** — ambos conectores instancian `Fetcher`/`RobotsGuard`/`HostRateLimiter` de `@obs/ingest` y aplican el orden LOCKED exactamente como Fase 5. La política (2-3s, robots, UA, SSRF) vive una sola vez en el framework; el conector solo arma URLs y ensambla colaboradores.
- **Header-set CF solo en Cámara** — `www.camara.cl` está tras Cloudflare bot-management (403 con UA simple); `web-back.senado.cl` es la API backend limpia. El header-set vive en `headers-camara.ts` y se envía vía el nuevo `Fetcher.get({ url, headers })`.
- **403 ≠ error genérico** — `FetchError.status === 403` se mapea a `CamaraBloqueadaError`, que `runIngest` reconoce para degradar la fuente Cámara con backoff sin abortar el Senado (T-06-07). El resto de los errores se reportan por semana (tolerados).
- **Tabla de Cámara = degradación honesta** — no hay fuente estructurada; `runIngest` registra el PDF oficial como marcador y NUNCA escribe filas de tabla de Cámara. Test afirma que toda sesión escrita es `camara === 'senado'` (T-06-09).
- **Aplanado de los arrays anidados** — el modelo anida invitados/puntos/items en la raíz; el writer los aplana a filas de las tablas hijas con la clave natural derivada (la `posicion` del punto sale del índice), de-duplicando por la clave de conflicto antes de cada lote.
- **Conectores inyectables en el CLI** — `main` acepta `conectores?` para los tests herméticos (sin red); en producción construye los reales. Punto de costura, no un flag del CLI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Fetcher.get` no soportaba headers personalizados**
- **Found during:** Task 1 (conector de Cámara)
- **Issue:** El plan y las notas del entorno requieren enviar `BROWSER_HEADERS_CAMARA` vía `fetcher.get({ url, headers })`, pero `FetchSpec`/`Fetcher.get` de `@obs/ingest` solo enviaba `{ "User-Agent": this.ua }` — no había forma de adjuntar el header-set anti-Cloudflare sin tocar el framework.
- **Fix:** Se extendió `FetchSpec` con `headers?: Record<string,string>` opcional y `Fetcher.get` los fusiona sobre el UA por defecto (`{ "User-Agent": this.ua, ...(spec.headers ?? {}) }`). Cambio mínimo y backwards-compatible (las llamadas sin headers se comportan idénticas). NO se añadió ninguna dependencia.
- **Files modified:** packages/ingest/src/fetcher.ts
- **Verification:** suite `@obs/ingest` 56/56 verde tras el cambio; el test del conector de Cámara afirma que el header-set llega al `fetchFn`.
- **Committed in:** `6be83f8` (Task 1)

**2. [Rule 3 - Blocking] Test del CLi `main` colgaba por fetch real sin red (timeout 5s)**
- **Found during:** Task 2 (test de `main`)
- **Issue:** `main` construía los conectores REALES de `@obs/ingest`, así que el test sin red hacía un fetch live (robots.txt + API) que excedía el timeout de vitest (5s) en vez de fallar rápido.
- **Fix:** Se añadió un punto de costura `conectores?` en `IngestCliOptions`; `main` usa los inyectados si están presentes (tests con fakes que leen los fixtures reales), o construye los reales si no. No es un flag del CLI; el comportamiento en producción no cambia.
- **Files modified:** packages/agenda/src/ingest-cli.ts (+ test)
- **Verification:** test de `main` corre en ~300ms con conectores fake; 7/7 verde en ingest-cli.
- **Committed in:** `a0523dc` (Task 2)

**Total deviations:** 2 auto-fixed (ambas blocking; la primera un cambio mínimo y backwards-compatible en @obs/ingest, la segunda un punto de costura para tests herméticos). Sin cambios arquitectónicos; sin scope creep; sin paquetes nuevos.

## Threat Model Coverage

- **T-06-07 (DoS / WAF de Cámara):** mitigado — reuso de `HostRateLimiter` (2-3s serial por host) + `RobotsGuard` + header-set anti-Cloudflare + backoff ante 403; el conector NO reimplementa la política. `runIngest` degrada Cámara ante 403 persistente sin abortar (alcance acotado).
- **T-06-08 (Spoofing/Tampering / SSRF):** mitigado — `assertAllowedUrl` deny-by-default antes de cada fetch en ambos conectores; `web-back.senado.cl`/`www.camara.cl` cubiertos por los sufijos `senado.cl`/`camara.cl` (test en connector-senado.test.ts lo afirma explícitamente, cerrando el ítem sin tocar @obs/ingest).
- **T-06-06 (Information Disclosure / service key):** mitigado — `SupabaseAgendaWriter` espeja Fase 5: la key nunca se interpola en mensajes de error (solo `error.message` de PostgREST); test lo prueba con una key sentinela.
- **T-06-09 (Tampering / fabricar tabla de Cámara):** mitigado — `runIngest` NUNCA escribe filas de tabla de Cámara; degradación honesta al PDF. Test afirma 0 filas de Cámara en sesion_sala/sesion_tabla_item (toda sesión escrita es `camara === 'senado'`).
- **T-06-SC (npm installs):** N/A — sin paquetes nuevos (reusa @obs/ingest + @supabase + cheerio/zod ya presentes).

## Known Stubs

- **`fetchVia_NextData` (fallback del Senado):** implementado pero NO ejecutado por defecto — la API backend `web-back.senado.cl` es la vía preferida y limpia. Es la ruta de respaldo documentada del RESEARCH (autodetección de buildId), no un stub que engañe a la UI.
- **Corrida LIVE acotada + frontend `/agenda`:** NO en este plan por diseño — son la ola 06-04 de la fase. Este plan entrega el MECANISMO (conectores + writer + runIngest + CLI) verificado por tests con mocks/fixtures reales; la corrida LIVE contra las fuentes reales y la UI ciudadana se cablean en 06-04.

## Next Phase Readiness

- **Corrida LIVE (06-04):** el CLI (`pnpm --filter @obs/agenda ingest --desde 2026-Wxx --hasta 2026-Wyy`) corre el backfill acotado-pero-representativo contra las fuentes reales con el `SupabaseAgendaWriter` local. El header-set CF de Cámara se re-verifica LIVE desde el egreso de ejecución (Assumption A2 del RESEARCH); si Cloudflare endurece, `runIngest` degrada Cámara sin abortar el Senado.
- **Frontend `/agenda` (06-04):** las 5 tablas con RLS public-read + el modelo común (semana_iso para navegación, boletin para el cross-link a `/proyecto/[boletin]` de Fase 5, provenance inline para el ProvenanceBadge) están listas para los Server Components.
- **Ingesta incremental futura:** runIngest + CLI son la base; la cadencia (pgmq + pg_cron) y el backfill histórico masivo (todas las semanas de todos los años, mismo conector) son jobs posteriores.

## Self-Check: PASSED

- Archivos creados verificados en disco: headers-camara, connector-camara(.test), connector-senado(.test), writer(.test), writer-supabase, ingest-run(.test), ingest-cli(.test) — todos FOUND.
- Commits verificados en el historial: 6be83f8 (T1), a0523dc (T2) — ambos FOUND.
- Suite: `pnpm --filter @obs/agenda test` → 84/84 verde; `pnpm --filter @obs/ingest test` → 56/56 verde (Fetcher extendido); `pnpm -w typecheck` → exit 0.

---
*Phase: 06-citaciones-tabla-semanal-de-sala*
*Completed: 2026-06-18*
