---
phase: 11
plan: 02
subsystem: connector-lobby
tags: [connector, cheerio, leylobby, identidad, EnlaceConfirmado, drift-bloqueante, sub-maestra, idempotente, INT-01, INT-02]
requires:
  - "@obs/ingest (orden LOCKED: assertAllowedUrl→robots→rateLimiter→fetcher; allowlist leylobby.gob.cl; DriftDetector/fingerprint)"
  - "@obs/adjudication correrPipeline (cruce del sujeto pasivo)"
  - "@obs/identity confirmar/EnlaceConfirmado (invariante tipado del FK, IDENT-12)"
  - "@obs/core normalizarNombre + Parlamentario"
  - "packages/agenda (el conector a espejar archivo-por-archivo)"
  - "migración 0021 (Plan 11-01: lobby_audiencia / lobby_contraparte / lobby_ingesta_estado / RPC)"
provides:
  - "@obs/lobby: parseLobbyAudiencias (keyed por Identificador) + parseListadoRowIds (crawl 2 pasos)"
  - "reconciliarSujeto (sujeto pasivo→correrPipeline; FK solo determinista; contrapartes crudas)"
  - "LobbyWriter + InMemoryLobbyWriter + SupabaseLobbyWriter (idempotente por clave natural)"
  - "LeylobbyConnector (orden LOCKED, drift bloqueante vía runIngestLobby)"
  - "runIngestLobby (drift BLOQUEANTE + degradación honesta + nunca fabrica)"
  - "ingest-cli (corrida LIVE acotada / dry-run) + live-leylobby.probe"
affects:
  - "Plan 11-03 (ficha /parlamentario/[id] lee lobby_de_parlamentario + lobby_ingesta_estado escritos por este writer)"
tech-stack:
  added: []
  patterns:
    - "Crawl LOCKED de dos pasos: listado (lista sujetos pasivos) → detalle (trae el Identificador)"
    - "Drift BLOQUEANTE por fingerprint de la FORMA parseada (cuarentena: 0 filas, nunca filas vacías)"
    - "FK del sujeto pasivo branded (EnlaceConfirmado|null), minteado SOLO en determinista; storage plano"
    - "Contraparte = tercero: texto crudo, contraparteId SIEMPRE null (nunca enlace a persona)"
    - "Reconciliación fail-closed sin provider: un homónimo degrada a no_confirmado, no aborta"
key-files:
  created:
    - "packages/lobby/package.json"
    - "packages/lobby/tsconfig.json"
    - "packages/lobby/vitest.config.ts"
    - "packages/lobby/.gitignore"
    - "packages/lobby/src/model.ts"
    - "packages/lobby/src/parse-leylobby.ts"
    - "packages/lobby/src/parse-leylobby.test.ts"
    - "packages/lobby/src/reconciliar-sujeto.ts"
    - "packages/lobby/src/reconciliar-sujeto.test.ts"
    - "packages/lobby/src/writer.ts"
    - "packages/lobby/src/writer.test.ts"
    - "packages/lobby/src/writer-supabase.ts"
    - "packages/lobby/src/connector-leylobby.ts"
    - "packages/lobby/src/ingest-run.ts"
    - "packages/lobby/src/ingest-run.test.ts"
    - "packages/lobby/src/ingest-cli.ts"
    - "packages/lobby/src/live-leylobby.probe.ts"
    - "packages/lobby/src/index.ts"
    - "packages/lobby/test/fixtures/audiencias-congreso.html"
  modified:
    - "pnpm-lock.yaml"
decisions:
  - "El Identificador de leylobby ({INST}AW{N}) es la clave natural; el número de URL del listado NUNCA lo es (Pitfall 1)"
  - "La Cámara/Senado NO publican en leylobby (es la plataforma del Ejecutivo): fuente de congreso = portal propio camara.cl (Open Question 2, verificado LIVE)"
  - "El listado de audiencias NO trae Identificador (lista sujetos pasivos); se requiere crawl de 2 pasos listado→detalle (Rule 2: funcionalidad crítica faltante)"
  - "Drift BLOQUEANTE para esta fuente PII volátil: un drift estructural cuarentena la corrida (0 filas), nunca filas vacías que se lean como 'sin lobby' (Pitfall 3 / C4)"
  - "Sin provider LLM, un homónimo del sujeto pasivo degrada fail-closed a no_confirmado sin abortar (difiere del voto, donde el provider es obligatorio)"
metrics:
  duration: 20min
  tasks: 3
  files: 19
  completed: 2026-06-19
---

# Phase 11 Plan 02: @obs/lobby — conector + parser + reconciliación + writer Summary

Construido el paquete `@obs/lobby` espejando `@obs/agenda`: parser cheerio del HTML de audiencias de leylobby keyed por el `Identificador` estable, reconciliación del sujeto pasivo vía `correrPipeline` (FK solo-determinista vía `EnlaceConfirmado`), sub-maestra de contrapartes (texto crudo, `contraparteId` siempre null), writer idempotente por clave natural y orquestación con **drift BLOQUEANTE** (cuarentena ante drift estructural). Corrida LIVE acotada 2026-06-19 contra leylobby (AA001/2024) confirmó el crawl LOCKED de dos pasos end-to-end: 2 audiencias reales keyed por Identificador, provenance por fila, 0 fabricadas. Suite offline 25/25 verde + typecheck verde.

## What Was Built

- **`model.ts`** — `LobbyAudiencia` (keyed por `identificador`, asistentes anidados) + `LobbyContraparte` + `LobbyAsistente` con zod. `ROL_SUJETO_PASIVO`. Provenance inline NOT NULL.
- **`parse-leylobby.ts`** — parser cheerio del HTML de detalle de audiencias: recorre la `<table>` (Fecha | Identificador | Asistentes(rol,nombre) | Representados | Materia | Detalle) con el patrón rowspan; keya por el cell `Identificador` (`{INST}AW{N}`), NUNCA por el número de URL; parsea la fecha (`2024-06-24 12:30:00-04` → ISO, normalizando el offset `-04`→`-04:00`) preservando `fechaRaw`; descarta filas drift sin fabricar. **`parseListadoRowIds`** extrae los rowIds del listado (paso 1 del crawl de 2 pasos).
- **`reconciliar-sujeto.ts`** — `reconciliarSujeto`: el sujeto pasivo cruza vía `correrPipeline`; SOLO `determinista` llama `confirmar(id,"determinista")` y puebla el FK + `estado_vinculo="confirmado"`; el resto deja `enlace:null` + `no_confirmado` + mención cruda. Contrapartes crudas (`contraparteId` null). Sin provider, un homónimo degrada fail-closed a no_confirmado (no aborta).
- **`writer.ts` / `writer-supabase.ts`** — `LobbyWriter` + `InMemoryLobbyWriter` + `SupabaseLobbyWriter`: upsert idempotente onConflict `identificador` / `(identificador,nombre,rol)` / `parlamentario_id`; dedupe-before-batch; raíz antes que hijos; storage plano del FK branded; service key nunca en errores.
- **`connector-leylobby.ts`** — `LeylobbyConnector` (orden LOCKED, NO BaseConnector.run); `LeylobbyBloqueadaError` 403/503; `fetchAudiencias` (listado) + `fetchDetalle` (detalle).
- **`ingest-run.ts`** — `runIngestLobby`: crawl LOCKED de 2 pasos (listado→detalle), drift BLOQUEANTE (cuarentena), degradación honesta de fuente bloqueada, idempotente, nunca fabrica; marca `lobby_ingesta_estado`.
- **`ingest-cli.ts` + `live-leylobby.probe.ts`** — corrida LIVE acotada (institución/año/páginas/maxDetalles) con dry-run sin key; probe acotado.
- **`test/fixtures/audiencias-congreso.html`** — fixture golden capturado LIVE de leylobby (AA001/audiencias/2024/663021) 2026-06-19, con el rol de contraparte `Gestor de intereses` del acta real.

## Corrida LIVE acotada (checkpoint Task 4): ATTEMPTED — connector verde, DB write = human_verification

La corrida LIVE acotada contra leylobby (AA001/2024, 2 páginas de detalle, delay 2-3s LOCKED) **funcionó end-to-end**:
- 2 audiencias reales parseadas, keyed por `Identificador` (`AA001AW1639516`, `AA001AW1677223`) — NO por el número de URL.
- Provenance por fila: `origen="leylobby-audiencias"`, `fecha_raw="2024-06-24 12:30:00-04"`, `enlace_detalle`, `enlace` del listado, `fecha_captura` 2026-06-19.
- Sujeto pasivo (`Víctor Gutiérrez`) → `no_confirmado` + FK null (maestra vacía en este entorno: fail-closed correcto, nunca fabrica).
- 0 contrapartes en estas filas: el listado de AA001 etiqueta a todos los asistentes como `Sujeto Pasivo`; las contrapartes (`Gestor de intereses`) viven en el **acta** (`.../{rowId}/{actaId}`), que el Plan 11 NO scrapea (solo guarda `enlace_detalle`). El parser es column-agnostic y SÍ produce contrapartes cuando el rol ≠ "Sujeto Pasivo" (probado en el golden).
- 0 errores, 0 degradaciones, drift OK, idempotente.

**human_verification (operador):** la escritura a la Supabase remota usó in-memory dry-run (sin service key ni maestra en este entorno autónomo). El operador debe: (1) correr `ingest-cli` con la maestra cargada + service key en env contra la institución de congreso elegida; (2) verificar las filas en `lobby_audiencia`/`lobby_contraparte`/`lobby_ingesta_estado`; (3) re-correr → conteos idénticos (idempotencia). Ver "Open Question 2" abajo para la fuente de congreso.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Funcionalidad crítica faltante] Crawl LOCKED de dos pasos (listado → detalle)**
- **Found during:** Task 3 (probe LIVE — el listado `/instituciones/{CODE}/audiencias/{year}` NO trae el cell `Identificador`).
- **Issue:** La página de listado lista sujetos pasivos (Nombre | Cargo | link), NO la tabla keyed por `Identificador`. El `Identificador` vive en la página de DETALLE (`.../audiencias/{year}/{rowId}`). Sin el segundo paso, el conector no alcanza la clave natural (parseaba 0 audiencias en vivo).
- **Fix:** Añadidos `parseListadoRowIds` (parser), `urlDetalle`/`fetchDetalle` (conector) y el crawl de 2 pasos acotado (`maxDetallesPorPagina`) en `runIngestLobby`. El research lo describía (`detail con el cell Identificador`); se materializó el segundo salto.
- **Files modified:** `parse-leylobby.ts`, `connector-leylobby.ts`, `ingest-run.ts`
- **Commit:** a38db2d

**2. [Rule 1 - Bug] Offset de fecha sin minutos (`-04` → `-04:00`)**
- **Found during:** Task 1 (test de fecha: `2024-06-24 12:30:00-04` daba `Invalid Date`).
- **Issue:** leylobby emite el offset con 2 dígitos (`-04`); `Date` requiere `±HH:00`.
- **Fix:** Normaliza el offset final de 2 dígitos a `±HH:00` antes de parsear; null si aún no parsea (nunca fabrica).
- **Files modified:** `parse-leylobby.ts`
- **Commit:** b5d92cb

**3. [Rule 1 - Bug] Filas drift de continuación contaminaban la audiencia previa**
- **Found during:** Task 1 (la fila malformada sin Identificador se anexaba como asistente de la audiencia anterior).
- **Issue:** Una fila con ≠2 celdas y sin Identificador no es una continuación válida; anexarla fabricaba un asistente.
- **Fix:** Una continuación debe tener EXACTAMENTE 2 celdas (rol, nombre); el resto se descarta como drift.
- **Files modified:** `parse-leylobby.ts`
- **Commit:** b5d92cb

## Known Stubs

Ninguno que bloquee el objetivo del plan. La página de **acta** (contrapartes ricas con calidad/trabaja-para/representa-a) NO se scrapea en P11 por diseño (`enlace_detalle` raw); las contrapartes provienen de los asistentes no-sujeto-pasivo del listado/detalle. Para AA001 esos son cero (todos sujetos pasivos), pero el parser las produce cuando existen (golden-probado). No es un stub: es el alcance LOCKED del Plan 11 (no scrapear el acta).

## Open Questions resueltas

- **Q1 (robots 403):** RESUELTA en código — `RobotsGuard.loadRobots` trata `!res.ok` (incl. 403) como `robotsParser(url,"")` → fail-OPEN. El 403-robots de leylobby NO bloquea el fetch; sin override por-host. Documentado en `connector-leylobby.ts`.
- **Q2 (código de congreso + layout de contraparte):** RESUELTA LIVE — la Cámara/Senado NO están en leylobby (búsqueda `?search=` devolvió "No se encontraron resultados"; solo "Biblioteca del Congreso Nacional"). La fuente de lobby del congreso es `camara.cl/transparencia/ley_de_lobby.aspx` (HTTP 200, ya allowlisted). El parser es column-agnostic (Assumption A2), por lo que vale para cualquier institución; la corrida de congreso es verificación de operador. Documentado en el conector y el fixture.

## Threat Flags

Ninguna nueva. El conector reusa la allowlist SSRF de @obs/ingest (leylobby.gob.cl ya listado), no abre endpoints nuevos, no almacena RUT de terceros, y `contraparte_id` nunca se puebla (Pitfall 4). La RLS deny-by-default de `lobby_contraparte` la fija la migración 0021 (Plan 01).

## Self-Check: PASSED

- FOUND: packages/lobby/src/{model,parse-leylobby,reconciliar-sujeto,writer,writer-supabase,connector-leylobby,ingest-run,ingest-cli,live-leylobby.probe,index}.ts
- FOUND: packages/lobby/test/fixtures/audiencias-congreso.html
- FOUND commit: b5d92cb (Task 1 scaffold + parser)
- FOUND commit: 3c7766f (Task 2 reconciliación + writer)
- FOUND commit: a38db2d (Task 3 orquestación + crawl 2 pasos)
- Suite offline 25/25 PASS + typecheck verde.
- Corrida LIVE acotada 2026-06-19 (AA001/2024): 2 audiencias reales keyed por Identificador, provenance por fila, 0 fabricadas, idempotente.
