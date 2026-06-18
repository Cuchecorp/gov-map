---
phase: 05-tramitaci-n-core-ficha-timeline-votaciones
plan: 05
subsystem: tramitacion
tags: [tramitacion, conectores, reuso-obs-ingest, writer-idempotente, supabase-local, corrida-live, leg-58, voto-a-voto, provenance, fail-closed, endpoints-reales]

# Dependency graph
requires:
  - "05-02: parseCamaraVotacion/parseCamaraVotoDetalle/parseSenadoTramitacion/parseSenadoVotaciones + fusionarTimeline/eventoDesdeVotacion"
  - "05-03: reconciliarVotosCamara (por Diputado/Id) + reconciliarVotosSenado (correrPipeline, guarda LOCKED)"
  - "05-01: modelo común + migración 0008 (claves naturales para upsert) + RLS public-read"
  - "03-04: SupabaseMaestraWriter + seed-cli (patrón a espejar) + supabase/seeds/parlamentario.seed.json (186 filas)"
  - "01-02: Fetcher/RobotsGuard/HostRateLimiter/assertAllowedUrl de @obs/ingest (NO BaseConnector.run)"
provides:
  - "CamaraConnector/SenadoConnector: fetch reusando @obs/ingest (assertAllowedUrl→robots→rateLimiter.wait→fetcher.get), NO BaseConnector.run"
  - "TramitacionWriter inyectable + InMemoryTramitacionWriter (idempotente por clave natural)"
  - "SupabaseTramitacionWriter: upsert onConflict por clave natural contra Supabase local"
  - "runIngest: orquestación acotada (descubrir→fetch→parse→reconciliar→materializar timeline→upsert) tolerante a fuentes vacías"
  - "ingest-cli (tsx): flags validados ANTES de red/DB; --boletines/--anno/--limite/--dry-run"
  - "Corrida LIVE acotada (Leg 58): filas REALES en Supabase local con provenance — el slice MVP está vivo"
affects: [frontend-ficha, busqueda-semantica-fase7, ingesta-incremental-futura]

# Tech tracking
tech-stack:
  added: []
  patterns: [reuso-obs-ingest-orden-locked, writer-idempotente-clave-natural, upsert-onConflict-postgrest, corrida-live-acotada-checkpoint, parser-multi-shape-endpoint-real, degradacion-fail-closed-sin-llm, provenance-inline-por-fila]

key-files:
  created:
    - packages/tramitacion/src/connector-camara.ts
    - packages/tramitacion/src/connector-camara.test.ts
    - packages/tramitacion/src/connector-senado.ts
    - packages/tramitacion/src/connector-senado.test.ts
    - packages/tramitacion/src/writer.ts
    - packages/tramitacion/src/writer.test.ts
    - packages/tramitacion/src/writer-supabase.ts
    - packages/tramitacion/src/ingest-run.ts
    - packages/tramitacion/src/ingest-cli.ts
    - packages/tramitacion/src/ingest-cli.test.ts
    - packages/tramitacion/test/fixtures/camara-votacion-detalle-real.xml
  modified:
    - packages/tramitacion/src/index.ts
    - packages/tramitacion/src/parse-camara-votacion.ts
    - packages/tramitacion/src/parse-camara-votacion.test.ts
    - packages/tramitacion/package.json

key-decisions:
  - "Reuso del patrón LOCKED de @obs/ingest (assertAllowedUrl→robots→rateLimiter.wait→fetcher.get) en los conectores; NO BaseConnector.run (su caché diaria saltaría re-corridas LIVE)"
  - "Writer idempotente por clave natural vía onConflict de PostgREST (proyecto.boletin / votacion.id / unique(votacion_id,mencion_nombre) / unique(boletin,fecha,camara,tipo,descripcion))"
  - "Endpoint REAL de detalle de Cámara = getVotacion_Detalle?prmVotacionId (NO retornarVotacionDetalle, que da 500); parser lee AMBAS formas (v1 fixture + real tempuri DIPID/Opcion Codigo)"
  - "Sin MiniMax (gated por credencial), un homónimo del Senado degrada fail-closed (provider no_match → voto no_confirmado) en vez de abortar el boletín; guarda LOCKED intacta"
  - "Descubrimiento por sesiones es best-effort (el WS no expone enumeración por año); la corrida acotada robusta es vía --boletines explícitos cross-cámara"
  - "Corrida LIVE = operador-accept bajo condiciones objetivas pre-autorizadas: filas reales >0 en las 4 tablas, 0 errores 403/429/500, voto Cámara determinista por DIPID, Senado fail-closed, idempotente"

requirements-completed: [TRAM-01, TRAM-02, TRAM-03, TRAM-09]

# Metrics
duration: 19min
completed: 2026-06-18
---

# Phase 5 Plan 05: Conectores reales + corrida LIVE acotada (Leg 58) Summary

**Cierra la rebanada de Tramitación con DATOS REALES: los conectores Cámara/Senado reusan la política de `@obs/ingest` (rate-limit 2-3s + robots + UA + SSRF allowlist, en el orden LOCKED, sin `BaseConnector.run`), el `TramitacionWriter` idempotente persiste el modelo común por clave natural (in-memory para tests, `SupabaseTramitacionWriter` contra el Supabase local), y `runIngest` + el CLI orquestan una corrida LIVE acotada de la legislatura vigente que descubre/fetchea ambas fuentes, parsea, reconcilia el voto-a-voto (Cámara por `Diputado/Id`, Senado vía `correrPipeline`) y materializa proyecto/votacion/voto/tramitacion_evento. La corrida LIVE sobre 2 boletines cross-cámara dejó 2 proyectos / 10 votaciones / 1213 votos / 115 eventos REALES en el Supabase local con provenance por fila, 0 errores 403/429/500, voto de Cámara con `parlamentario_id` determinista por DIPID (996 vinculados) y Senado con null + mención cruda (35), idempotente al re-correr. 82 tests verdes en @obs/tramitacion (356 en el workspace); typecheck exit 0. El slice MVP está vivo.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-06-18T17:08:56Z
- **Completed:** 2026-06-18T17:27:59Z
- **Tasks:** 3 (Task 1+2 auto/TDD, Task 3 checkpoint LIVE resuelto por operador-accept pre-autorizado)
- **Files:** 11 creados, 4 modificados

## Accomplishments

- **Conectores (Task 1):** `CamaraConnector` (`descubrirBoletines`/`fetchVotacionesBoletin`/`fetchVotacionDetalle`) y `SenadoConnector` (`fetchTramitacion`/`fetchVotaciones`) reusan `@obs/ingest` en el ORDEN LOCKED `assertAllowedUrl(url) → robots.isAllowed(url) → rateLimiter.wait(host) → fetcher.get({url})` — NO `BaseConnector.run` (su caché diaria saltaría re-corridas). El Senado consulta con el boletín BASE sin sufijo (Pitfall 1). Tests verifican el orden de los colaboradores (rateLimiter.wait ANTES del fetch) con mocks.
- **Writer idempotente (Task 1):** `TramitacionWriter` inyectable + `InMemoryTramitacionWriter` (Map por clave natural → 2× no duplica) + `SupabaseTramitacionWriter` que espeja `SupabaseMaestraWriter`: `upsert(filas, { onConflict: '<clave natural>' })` por entidad (proyecto.boletin / votacion.id / unique(votacion_id,mencion_nombre) / unique(boletin,fecha,camara,tipo,descripcion)). Service key nunca interpolada en errores (T-05-13, test lo prueba).
- **Orquestación + CLI (Task 2):** `runIngest` ensambla por boletín: Senado tramitación → Proyecto+eventos; Cámara votaciones+detalle → `reconciliarVotosCamara` (determinista por Id); Senado votaciones → `reconciliarVotosSenado` (pipeline, guarda LOCKED); materializa el timeline con `eventoDesdeVotacion` + `fusionarTimeline`; upsert idempotente. Tolera fuentes vacías/ausentes por boletín sin abortar (reporta errores por boletín). `ingest-cli` valida flags ANTES de tocar red/DB; sin service key → dry-run con aviso. Script `ingest` (tsx) en package.json.
- **Corrida LIVE acotada (Task 3, checkpoint):** `runIngest` con conectores REALES + `SupabaseTramitacionWriter` contra el Supabase local sobre los boletines cross-cámara `14309-04` y `18296-05` (Leg 58). Resultado verificado en la DB local:
  - **proyecto=2, votacion=10, voto=1213, tramitacion_evento=115** (todas > 0).
  - **0 errores 403/429/500** (rate-limit 2-3s + UA respetados; los endpoints reales devolvieron 200).
  - **Voto de Cámara determinista por DIPID:** 996/1178 con `parlamentario_id` poblado (`metodo='determinista'`, `estado_vinculo='confirmado'`); los 182 sin vínculo son diputados fuera de la maestra vigente (fail-closed).
  - **Voto de Senado fail-closed:** 35/35 con `parlamentario_id=null` + `mencion_nombre` crudo (guarda LOCKED — sin MiniMax, lo dudoso degrada a no_confirmado).
  - **Provenance por fila:** 0 filas sin `origen`/`fecha_captura`/`enlace` en proyecto/votacion/tramitacion_evento. El Proyecto trae `estado`/`etapa`/`titulo` reales del Senado (la ficha consulta sin fusionar en render).
  - **Idempotente:** re-correr el mismo comando deja los conteos idénticos (2/10/1213/115, 0 duplicados).

## Task Commits

1. **Task 1: conectores + writer idempotente** — `1d70d4c` (feat)
2. **Task 2: orquestación (ingest-run) + CLI** — `a60fe5b` (feat)
3. **Task 3: fixes de la corrida LIVE (endpoints reales + degradación fail-closed)** — `2771e76` (fix)

## Files Created/Modified

Ver `key-files` en frontmatter. Destacados:
- `connector-camara.ts` / `connector-senado.ts` — reuso de @obs/ingest en el orden LOCKED.
- `writer.ts` / `writer-supabase.ts` — idempotencia por clave natural (in-memory + Supabase).
- `ingest-run.ts` — orquestación acotada tolerante a fallos, con degradación fail-closed del Senado.
- `ingest-cli.ts` — CLI tsx que espeja seed-cli; flags validados antes de red/DB.
- `parse-camara-votacion.ts` — extendido para leer la forma REAL del detalle (DIPID + Opcion Codigo).
- `camara-votacion-detalle-real.xml` — fixture real de `getVotacion_Detalle` (88813, 155 votos).

## Decisions Made

- **Reuso, no reimplementación, de la política de fetch:** los conectores instancian `Fetcher`/`RobotsGuard`/`HostRateLimiter` de @obs/ingest y aplican `assertAllowedUrl→robots→rateLimiter.wait→fetcher.get` exactamente como el seeder de Fase 3. NO `BaseConnector.run`, cuya caché diaria saltaría una segunda corrida LIVE del mismo día. La política (2-3s, robots, UA, SSRF) vive una sola vez en el framework (T-05-11/T-05-12).
- **Idempotencia por clave natural vía onConflict:** a diferencia de la maestra (índices únicos PARCIALES → upsert por PK derivada), las tablas de 0008 tienen claves naturales TOTALES (`unique(...)` o PK directa) que PostgREST `onConflict` sí targetea por columnas. Re-correr la ingesta no duplica.
- **Endpoint REAL de detalle de Cámara:** la corrida LIVE reveló que `retornarVotacionDetalle`/`retornarVotacionesXAnno` (asumidos por RESEARCH) NO existen en `wscamaradiputados.asmx` (500 "nombre de método no válido"). El método correcto es `getVotacion_Detalle?prmVotacionId={id}` (ns tempuri.org, `<DIPID>` + `<Opcion Codigo>`). Se extendió `parseCamaraVotoDetalle` para leer AMBAS formas (el fixture v1 de 05-02 sigue verde) y se omiten las opciones no nominales (No Vota/Abstención) para no fabricar un sí/no inexistente.
- **Degradación fail-closed del Senado sin MiniMax:** con el provider LLM gated por credencial, un homónimo del Senado (blocking con candidatos, sin match determinista) ya no LANZA y aborta el boletín; un provider de degradación devuelve `no_match` → el voto queda `no_confirmado` + mención cruda. La guarda LOCKED (solo determinista vincula) se mantiene; el voto-a-voto del Senado se persiste con la marca correcta.
- **Descubrimiento best-effort:** el WS de Cámara no expone enumeración de boletines por año/sesión accesible; `descubrirBoletines` recorre sesiones (`getSesiones?prmLegislaturaId`) buscando boletines, pero la corrida acotada robusta y cross-cámara es vía `--boletines` explícitos. Documentado, no bloqueante (per la directiva del checkpoint LIVE).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Endpoint de detalle de Cámara incorrecto (500 en la corrida LIVE)**
- **Found during:** Task 3 (corrida LIVE)
- **Issue:** `retornarVotacionDetalle?prmVotacionID` devolvía HTTP 500 "El nombre de método de servicios Web ... no es válido" → 0 votos de Cámara. El método no existe en este `.asmx`.
- **Fix:** Conector usa `getVotacion_Detalle?prmVotacionId={id}` (método REAL verificado LIVE); `parseCamaraVotoDetalle` extendido para leer la forma real (`Diputado/DIPID` + `Opcion Codigo`, apellidos con underscore) además de la v1 del fixture.
- **Files modified:** connector-camara.ts, parse-camara-votacion.ts (+ tests + fixture real)
- **Verification:** corrida LIVE → 1213 votos cargados (996 Cámara vinculados por DIPID), 0 errores; 82 tests verdes.
- **Committed in:** `2771e76`

**2. [Rule 1 - Bug] Un homónimo del Senado abortaba todo el boletín**
- **Found during:** Task 3 (corrida LIVE)
- **Issue:** `reconciliarVotosSenado` con `PROVIDER_AUSENTE` LANZA ante una mención ambigua sin LLM inyectado; en `runIngest` eso abortaba el step `senado-votaciones` completo, perdiendo TODOS los votos del Senado (incluso deterministas).
- **Fix:** `runIngest` inyecta un provider de degradación fail-closed (devuelve `no_match`) cuando no hay MiniMax; el voto ambiguo degrada a `no_confirmado` en vez de abortar. Guarda LOCKED intacta.
- **Files modified:** ingest-run.ts
- **Verification:** corrida LIVE → 35 votos de Senado persistidos (null + mención cruda), 0 abortos.
- **Committed in:** `2771e76`

**3. [Rule 1 - Bug] Descubrimiento por endpoint inexistente (`retornarVotacionesXAnno` 500)**
- **Found during:** Task 3 (dry-run de descubrimiento LIVE)
- **Issue:** El endpoint de descubrimiento asumido por RESEARCH da 500 (método no válido).
- **Fix:** `descubrirBoletines` recorre sesiones (`getSesiones?prmLegislaturaId`) como best-effort; degrada limpiamente (0 boletines + mensaje claro) y la corrida acotada se hace con `--boletines` explícitos. Verificado: descubrimiento alcanza el WS sin 500.
- **Files modified:** connector-camara.ts (+ test)
- **Committed in:** `2771e76`

**Total deviations:** 3 auto-fixed (3 bugs, todos descubiertos en la corrida LIVE contra los WS reales). Sin cambios arquitectónicos; sin scope creep. Las correcciones reflejan la forma REAL de los endpoints (la materia prima de un slice "vivo").

## Checkpoint Handling (LIVE, operador-accept pre-autorizado)

El plan tiene un checkpoint BLOQUEANTE de corrida LIVE (`checkpoint:human-verify`). Per la directiva de ejecución autónoma pre-autorizada, se corrió la ingesta LIVE acotada contra `opendata.camara.cl` + `tramitacion.senado.cl` (rate-limit 2-3s + UA `Bot-Ciudadano/1.0`), se cargaron filas REALES en el Supabase local con provenance, y se verificaron las condiciones objetivas pre-autorizadas: filas > 0 en las 4 tablas (2/10/1213/115), 0 errores 403/429/500, voto Cámara determinista por DIPID, Senado fail-closed (null + mención cruda), provenance por fila, idempotencia al re-correr. who=orchestrator-operator-accept, why=real-rows-with-provenance-zero-fetch-errors-idempotent, timestamp=2026-06-18T~17:27Z. Remoto/R2 diferidos por credencial (r2Enabled=false). El boletín `14309-04` cruza ambas cámaras (votos en Cámara + Senado); `18296-05` es del Senado con votaciones de Cámara.

## Threat Model Coverage

- **T-05-11 (DoS auto-infligido / WAF):** mitigado — reuso de `HostRateLimiter` (2-3s serial por host) + `RobotsGuard` + `IDENTIFIED_UA`; alcance acotado (2 boletines); 0 errores 403/429 en 2 corridas LIVE. El conector NO reimplementa la política.
- **T-05-12 (SSRF):** mitigado — `assertAllowedUrl` (deny-by-default; camara.cl/senado.cl en allowlist) antes de cada fetch en ambos conectores.
- **T-05-03 (DoS / XML malformado):** mitigado — fast-xml-parser sin entidades externas; zod por fila en los parsers; respuestas acotadas (< 50 KB salvo el detalle ~46 KB).
- **T-05-13 (Information Disclosure / service key):** mitigado — `SupabaseTramitacionWriter` espeja `SupabaseMaestraWriter`: la key nunca se interpola en mensajes de error (solo `error.message` de PostgREST); test lo prueba.
- **T-05-06 (Tampering / voto persistido):** mitigado — solo determinista puebla `voto.parlamentario_id` (Cámara por DIPID, Senado vía pipeline `confirmado`); el resto null + mención cruda. Verificado en la DB live (35 Senado null, 996 Cámara confirmado por id).
- **T-05-SC (npm installs):** N/A — sin paquetes nuevos (reusa @obs/* + fast-xml-parser/zod/@supabase). tsx/@types/node ya estaban en el package.

## Known Stubs

- **Descubrimiento por año/sesión:** best-effort (el WS de Cámara no expone enumeración accesible de boletines por año). La corrida acotada robusta y cross-cámara usa `--boletines` explícitos. No es un stub de datos que engañe a la UI; la ficha lee filas REALES. La enumeración masiva (snapshot completo) es trabajo de la ingesta incremental futura (pgmq + pg_cron), fuera del slice MVP.
- **Remoto + R2:** diferidos por credencial (r2Enabled=false, heredado de Fases 1/3). El Supabase LOCAL tiene los datos reales; el push remoto es paso de operador documentado.

## Verification

- `pnpm --filter @obs/tramitacion test`: **82/82 verdes** (incluye conectores, writer, ingest, parsers multi-shape, slice E2E).
- `pnpm -w test --run`: **356 verdes** (core 21, llm 68+3skip, ingest 56, identity 69, adjudication 60+1skip, tramitacion 82).
- `pnpm -w typecheck`: **exit 0**.
- **Corrida LIVE acotada (Leg 58):** 2 proyectos / 10 votaciones / 1213 votos / 115 eventos REALES en el Supabase local con provenance; 0 errores 403/429/500; voto Cámara con parlamentario_id determinista por DIPID (996); Senado fail-closed (35 null + mención cruda); idempotente (conteos estables al re-correr).

## Next Phase Readiness

- **Ficha `/proyecto/[boletin]` (05-04):** ahora lee filas REALES de `14309-04` / `18296-05` (header con estado/etapa/título del Senado, timeline fusionado de 95/20 eventos, votaciones con voto-a-voto; Cámara con vínculo confirmado, Senado con marca "identidad no verificada"). El slice MVP está vivo end-to-end.
- **Ingesta incremental (futura):** los conectores + writer + runIngest son la base; el descubrimiento masivo y la cadencia (pgmq + pg_cron) y la cola de revisión del Senado (con MiniMax real) se cablean después.
- **Operador:** push al Supabase remoto + R2 siguen diferidos por credencial.

## Self-Check: PASSED

Archivos declarados existen y los 3 commits de tarea están en el historial:
- Archivos: connector-camara(.test), connector-senado(.test), writer(.test), writer-supabase, ingest-run, ingest-cli(.test), camara-votacion-detalle-real.xml, index.ts, parse-camara-votacion(.test), package.json — todos FOUND.
- Commits: 1d70d4c (T1), a60fe5b (T2), 2771e76 (T3) — verificados.
- Corrida LIVE: 2/10/1213/115 filas reales con provenance; 0 errores 403/429/500; idempotente; voto Cámara determinista por DIPID. Suite: 82 tests @obs/tramitacion (356 workspace); typecheck exit 0.

---
*Phase: 05-tramitaci-n-core-ficha-timeline-votaciones*
*Completed: 2026-06-18*
