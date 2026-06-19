---
phase: 15-money-financiamiento-servel-verbatim-sub-maestra-de-donantes
plan: 02
subsystem: ingest
tags: [servel, financiamiento, conector, xlsx, exceljs, verbatim, cuarentena, drift-bloqueante, enlace-por-nombre, pipeline-identidad, data-routing, supabase-storage, money]
status: autonomous-complete-checkpoint-pending
requires:
  - 0024_servel.sql (Plan 01): tablas aporte / donante / aportes_ingesta_estado + RPC
  - "@obs/adjudication correrPipeline (cruce del candidato por NOMBRE, confirmado/auditado)"
  - "@obs/identity confirmar/EnlaceConfirmado (FK branded)"
  - "@obs/core normalizarNombre + Parlamentario"
  - "@obs/ingest Fetcher/HostRateLimiter/RobotsGuard/assertAllowedUrl (orden LOCKED + extraHosts)"
  - patron ChileCompra Phase 14 (connector/parse/writer/ingest-run/cli) espejado archivo-por-archivo
provides:
  - "ServelConnector (fetch .xlsx host EXACTO via extraHosts + https forzado; ETag/Content-MD5/byte-length)"
  - "parseAportes (xlsx VERBATIM + gate de header-text EXPECTED_HEADERS que THROW en drift)"
  - "reconciliarCompletitud (Content-MD5 + byte-length + TOTAL best-effort -> senal de cuarentena run-level)"
  - "reconciliarAporte (enlace del candidato por NOMBRE via correrPipeline; SOLO determinista puebla FK; donante JAMAS al pipeline/LLM)"
  - "SupabaseStorageServel (subida idempotente del crudo a Storage, clave servel/<eleccion>/<fecha>/<hash>.xlsx)"
  - "ServelWriter (InMemory + Supabase, onConflict (fuente_id,fecha_corte)/donante_id/parlamentario_id)"
  - "runIngestServel (drift BLOQUEANTE run-level: cualquier mismatch -> cuarentena, 0 filas)"
  - "ingest-cli-servel (corrida LIVE acotada / degrada a dry-run sin key)"
affects:
  - Plan 03 (ficha: la rebanada de datos ya emite aportes verbatim con enlace honesto solo-determinista)
tech-stack:
  added: [exceljs@4.4.0]
  patterns: [gate de header-text (no posicional), cuarentena run-level (drift BLOQUEANTE), enlace por NOMBRE via pipeline confirmado/auditado, data-routing gate (solo funcionario al LLM), HEAD inyectable para anclas de completitud, Supabase Storage greenfield]
key-files:
  created:
    - packages/dinero/src/model-servel.ts
    - packages/dinero/src/parse-servel.ts
    - packages/dinero/src/reconciliar-aporte.ts
    - packages/dinero/src/reconciliar-completitud.ts
    - packages/dinero/src/connector-servel.ts
    - packages/dinero/src/storage-supabase.ts
    - packages/dinero/src/writer-servel.ts
    - packages/dinero/src/writer-supabase-servel.ts
    - packages/dinero/src/ingest-run-servel.ts
    - packages/dinero/src/ingest-cli-servel.ts
    - packages/dinero/src/parse-servel.test.ts
    - packages/dinero/src/reconciliar-aporte.test.ts
    - packages/dinero/src/reconciliar-completitud.test.ts
    - packages/dinero/src/storage-supabase.test.ts
    - packages/dinero/src/writer-servel.test.ts
    - packages/dinero/src/ingest-run-servel.test.ts
    - packages/dinero/test-fixtures/servel-sample.xlsx
  modified:
    - packages/dinero/package.json
    - packages/dinero/tsconfig.json
    - packages/dinero/src/index.ts
    - .env.example
decisions:
  - "exceljs@4.4.0 (NO bare xlsx CVE-2023-30533, NO @e965/xlsx) - vetting del checkpoint resuelto por el orquestador (MIT, github.com/exceljs/exceljs, ~10M descargas/sem, maintainers guyonroche/siemienik)"
  - "enlace del candidato por NOMBRE via correrPipeline (espeja reconciliar-sujeto.ts, NO reconciliar-contrato.ts); SOLO res.tipo==='determinista' mintea confirmar() + parlamentario_id; probable/revision/no_confirmado/sin-provider -> null + no_confirmado (fail-closed, cola humana via identidad_audit)"
  - "DATA-ROUTING gate LOAD-BEARING: SOLO candidatoNombreVerbatim arma la mencion del pipeline; donante (nombre/tipo/RUT) NUNCA toca correrPipeline ni el prompt; el gate assertNoRutInLlmInput/assertSensitivityAllowed se REUSA dentro de correrPipeline, no se duplica"
  - "drift BLOQUEANTE a nivel de RUN (no per-fila como ChileCompra): drift de header (parse THROW) O mismatch de completitud -> cuarentena de TODA la eleccion, 0 filas, nunca un parcial silencioso"
  - "gate de header por TEXTO (EXPECTED_HEADERS), no por indice posicional; mapeo de columnas por nombre -> reordenar la fuente NO rompe; renombrar/faltar SI THROW"
  - "reconciliarCompletitud fail-closed: sin ningun ancla (ni Content-MD5 ni Content-Length ni TOTAL) -> {ok:false} (cuarentena), NUNCA emitir a ciegas"
  - "crudo a Supabase Storage (greenfield, 0 hits previos de .storage.from) porque R2 da 401 (deuda de operador); clave versionada idempotente; bucket lo crea el operador"
  - "el FK branded del candidato se nombra enlaceCandidato en AporteParaEscribir (el campo enlace de Aporte ya es la URL de provenance) -> se aplana a parlamentario_id string|null en el writer"
  - "connector usa un headFn inyectable para capturar ETag/Content-MD5/byte-length (el Fetcher de @obs/ingest devuelve solo Uint8Array, sin headers); el body sigue por fetcher.get en el orden LOCKED"
  - "host SERVEL via extraHosts EXACTO scoped al conector + assercion u.protocol==='https:' (extraHosts admite http); allowlist.ts SIN cambios (NUNCA windows.net en DEFAULT_ALLOWED_SUFFIXES -> evita SSRF a todo tenant Azure)"
  - "tsconfig de dinero gana la project-reference a ../adjudication (igual que lobby la declara); requerido por el enlace por NOMBRE"
metrics:
  duration: ~75min
  completed: 2026-06-19
  tasks_autonomous: 3
  tasks_pending_checkpoint: 2
  files_created: 17
  files_modified: 4
  tests: 41 SERVEL (64 total en @obs/dinero, todos verdes)
---

# Phase 15 Plan 02: Conector SERVEL (financiamiento verbatim + enlace por NOMBRE) Summary

Conector SERVEL completo dentro de `@obs/dinero`, espejando el patron ChileCompra de Phase 14 archivo-por-archivo, con las TRES divergencias deliberadas del plan: (1) parser `xlsx` VERBATIM (`exceljs@4.4.0`) con gate de header-TEXT que THROW en drift; (2) drift BLOQUEANTE a nivel de RUN con reconciliacion de completitud (cuarentena de toda la corrida, nunca un parcial); (3) crudo a Supabase Storage (R2 esta 401). El enlace candidato->parlamentario reusa el pipeline de identidad confirmado/auditado (`correrPipeline` de `@obs/adjudication`) cruzando por el NOMBRE del candidato (espejo de `reconciliar-sujeto.ts`): SOLO `determinista` puebla `parlamentario_id`, lo ambiguo queda `null`/`no_confirmado` en la cola humana (fail-closed). El data-routing gate (solo el funcionario al LLM, jamas el donante) es test-enforced. Las 3 tareas autonomas estan completas y verificadas (41 tests SERVEL verdes, `tsc -b` limpio, sin BOM, sin unicode invisible). Quedan 2 **checkpoints de operador BLOQUEANTES pendientes** (bucket + LIVE), NO ejecutados por el agente.

## Dependency Vetting (checkpoint resuelto)

El `checkpoint:human-verify` por el dep `xlsx` fue **resuelto por el orquestador**: se aprobo `exceljs@4.4.0` como legitimo — licencia MIT, repo oficial `github.com/exceljs/exceljs`, ~10M descargas/semana, maintainers conocidos (guyonroche/siemienik). El checkpoint existia solo porque la herramienta de slopcheck esta rota en Windows (shell-out a npm -> WinError 2), NO porque exceljs fuese sospechoso. Se instalo `exceljs@4.4.0` (version resuelta confirmada via `require('exceljs/package.json').version` = `4.4.0`). NUNCA se instalo el bare `xlsx` (CVE-2023-30533 + abandonado) ni `@e965/xlsx`.

## What Was Built

### Task 1 - model + parser + enlace por NOMBRE + completitud (commit `065886f`)
- **`model-servel.ts`**: `Aporte` (raiz, keyed por `(fuenteId, fechaCorte)`, `eleccion` NON-NULL, `candidatoNombreVerbatim`, `monto` string VERBATIM, `estadoVinculo` `'confirmado'|'no_confirmado'|null`) + `Donante` (sub-maestra keyed por `donanteId` hash nombre+tipo, `rutDonante` nullable=null hoy) + `AporteSheetSchema` (forma cruda zod, todos `z.string().nullable()`, sin sumas). Constantes `ORIGEN_SERVEL="servel"`, `LICENCIA_SERVEL="terminos por verificar"`. Helpers `fuenteIdDe` / `donanteIdDe` (sha256 hex/`crypto` de plataforma).
- **`parse-servel.ts`**: funcion PURA `parseAportes(bytes, opts)`. GATE DE HEADER-TEXT: lee la fila 4 (`HEADER_ROW`), normaliza `trim().toUpperCase()`, mapea `EXPECTED_HEADERS` (los 11 literales) a indice de columna POR TEXTO; cualquier header faltante/renombrado -> `throw "drift estructural SERVEL: faltan/cambiaron columnas [...]"`. Mapeo VERBATIM (`monto` string crudo, `eleccion` compuesta `ELECCION - TERRITORIO - anio`). Una fila con datos pero sin `eleccion` construible -> THROW (NON-NULL). Sort deterministico por `fuenteId`.
- **`reconciliar-aporte.ts`** (espejo de `reconciliar-sujeto.ts`): por cada aporte toma `candidatoNombreVerbatim` (el SUJETO publico), `normalizarNombre` -> `MencionForanea` -> `correrPipeline(mencion, maestra, provider, writer)` con `PROVIDER_AUSENTE`/`NOOP_WRITER` por defecto + `proveedorAusente` (degrada a `no_confirmado` sin abortar). GUARDA LOCKED IDENT-12: `switch(res.tipo)` -> `case "determinista"` mintea `confirmar(id,"determinista")` + `estadoVinculo="confirmado"`; el resto -> `null` + `"no_confirmado"`. El FK branded se expone como `enlaceCandidato` en `AporteParaEscribir`. DATA-ROUTING: SOLO el candidato arma la mencion; el donante NUNCA se pasa a `correrPipeline`.
- **`reconciliar-completitud.ts`** (sin analogo): funcion PURA `reconciliarCompletitud(parsed, ctrl, bytes)` -> `{ok:true}|{ok:false,motivo}`. Content-MD5 (base64) == md5 de los bytes, Content-Length == bytes.length, TOTAL declarado best-effort == parsed.length. Cualquier mismatch -> `{ok:false}`. Sin ningun ancla -> `{ok:false}` (fail-closed). Es el corazon del drift BLOQUEANTE run-level.
- **`test-fixtures/servel-sample.xlsx`**: .xlsx de 5 filas con los 11 headers VERBATIM en fila 4, generado programaticamente con exceljs.
- **Tests** (16): parse OK/drift-renombrado/drift-faltante/reordenado-OK/sin-eleccion; completitud MD5/length/TOTAL/sin-ancla; reconciliar determinista/homonimo/sin-provider/vacio/**data-routing (donante jamas en vinculo/cola/prompt, via SpyWriter+SpyProvider)**.

### Task 2 - connector + storage + writer + barrel + allowlist + .env (commit `9bca055`)
- **`connector-servel.ts`**: `ServelConnector.descargar(url)` en el ORDEN LOCKED EXACTO: `assertAllowedUrl(url, {extraHosts:[SERVEL_HOST]})` -> assercion `protocol==="https:"` -> `robots.isAllowed` -> `rateLimiter.wait(host)` -> HEAD inyectable (anclas) -> `fetcher.get({url, headers: HEADERS_SERVEL})`. `SERVEL_HOST="repodocgastoelectoral.blob.core.windows.net"`. `ServelBloqueadaError` (403/503/429). URLs saneadas en errores (corta querystring). NUNCA `BaseConnector.run`.
- **`storage-supabase.ts`** (GREENFIELD, 0 hits previos de `.storage.from(`): `SupabaseStorageServel.subirCrudo(bucket, eleccion, fechaCorte, bytes)` -> `client.storage.from(bucket).upload(claveCrudo, bytes, {contentType, upsert:false})`. Clave versionada `servel/<eleccionSlug>/<fechaCorte>/<sha256hex>.xlsx`. Idempotente: un error `/exists|duplicate|409/i` se traga; cualquier otro THROW (sin interpolar la service key). Bucket lo crea el operador.
- **`writer-servel.ts`** + **`writer-supabase-servel.ts`**: `ServelWriter` (`upsertAportes` versionado, `upsertDonantes` last-write-wins por `donante_id`, `marcarIngestado`) + `InMemoryServelWriter` (dry-run/tests) + `SupabaseServelWriter` (onConflict `'fuente_id,fecha_corte'`/`'donante_id'`/`'parlamentario_id'`; compone el storage helper; FK plano `parlamentario_id: f.enlaceCandidato?.parlamentarioId ?? null`).
- **`index.ts`**: barrel re-exports SERVEL. NO re-exporta el simbolo branded `ENLACE_CONFIRMADO`.
- **`allowlist.ts` SIN cambios**: confirmado que NO contiene `windows.net`/`core.windows.net`/`blob.core.windows.net` en `DEFAULT_ALLOWED_SUFFIXES`. El host SERVEL viaja SOLO como `extraHosts` scoped al conector (Pitfall 3: evita ampliar SSRF a todo tenant Azure).
- **`.env.example`**: `SERVEL_CRUDO_BUCKET=crudo-servel` con comentario; SIN credencial SERVEL (fuente publica, GET anonimo); el provider LLM del pipeline ya tiene credenciales desde Phase 4/11.
- **Tests** (14): storage clave-versionada/OK/idempotente-exists/idempotente-409/error-distinto-sin-key; writer idempotente/FK-aplanado/donante-LWW/marcarIngestado; connector OK-con-anclas/http-rechazado/host-no-SERVEL-rechazado/403-bloqueo/503-bloqueo.

### Task 3 - ingest-run (cuarentena run-level) + cli (commit `d724365`)
- **`ingest-run-servel.ts`**: `runIngestServel(opts)`. Quarantine boundary = el RUN. Por eleccion: (1) `connector.descargar` -> bytes+anclas; `ServelBloqueadaError` -> degradacion honesta, continue. (2) `parseAportes`; THROW -> CUARENTENA RUN (`cuarentena:true`, 0 filas, NO upsert, NO subirCrudo). (3) `reconciliarCompletitud` (md5 base64 de los bytes vs Content-MD5); `!ok` -> CUARENTENA RUN. (4) solo si header OK Y completitud OK: `subirCrudo` -> `reconciliarAporte` (async, cruce por NOMBRE) -> `upsertDonantes` (dedup por `donante_id`) -> `upsertAportes` -> acumula confirmados. (5) `marcarIngestado`. Reusa `DegradacionDinero{fuente,motivo,cuarentena?}`.
- **`ingest-cli-servel.ts`**: flags `--eleccion`/`--url`/`--anio`/`--dry-run` validados ANTES de red/DB. Service key + url SOLO de env. Sin key/url (o `--dry-run`) -> `InMemoryServelWriter` (degrada, NUNCA fabrica). Colaboradores REALES de @obs/ingest. En LIVE, si el caller no inyecto un writer del pipeline, construye un `RevisionWriter` real (deterministas/ambiguos -> `identidad_audit`); el provider LLM lo inyecta el operador via `opts.reconciliar` (sin el, el cruce degrada a `no_confirmado`). Guarda `isMain`. Script `pnpm --filter @obs/dinero ingest:servel`.
- **`index.ts`**: re-export `runIngestServel` + CLI.
- **Tests** (6): corrida-OK (upsert + crudo + determinista puebla `parlamentario_id` + 2 donantes); **drift-header -> 0 upserts (test del invariante) + cuarentena + crudo NO subido**; **completitud-MD5 -> 0 upserts + cuarentena**; **completitud-byte-length -> 0 upserts + cuarentena**; bloqueo -> degradacion honesta (no cuarentena); enlace-honesto (homonimo -> `parlamentario_id` null, nunca fabrica).

## Deviations from Plan

### Rule 3 (blocking) - tsconfig project-reference a ../adjudication
- **Found during:** Task 1 (`tsc -b`).
- **Issue:** dinero importa de `@obs/adjudication` pero su `tsconfig.json` no listaba la reference -> errores TS6059/TS6307 (rootDir).
- **Fix:** se agrego `{ "path": "../adjudication" }` a `packages/dinero/tsconfig.json` (exactamente como `packages/lobby/tsconfig.json` ya lo declara para el mismo dep).
- **Commit:** `065886f`.

### Rule 1 (bug) - cast invalido en parse-servel
- **Found during:** Task 1 (`tsc -b`).
- **Issue:** `v as Record<string, unknown>` sobre la union `CellValue` de exceljs no compila (overlap insuficiente).
- **Fix:** `v as unknown as Record<string, unknown>` (cast explicito via unknown), patron seguro para inspeccionar formas de celda (formula/richText/result).
- **Commit:** `065886f`.

### Rule 2 (missing critical functionality) - colision de nombre del FK del candidato
- **Found during:** Task 1.
- **Issue:** el plan nombra el FK branded `enlace`, pero `Aporte` ya tiene `enlace` (la URL de provenance, `string`) -> `AporteParaEscribir extends Aporte` no compila (tipos incompatibles).
- **Fix:** el FK branded se nombra `enlaceCandidato: EnlaceConfirmado | null` en `AporteParaEscribir` (el `enlace` de provenance se preserva intacto). El writer lo aplana a `parlamentario_id`. Documentado en el codigo.
- **Commit:** `065886f`.

### Rule 2 (missing critical functionality) - test de cuarentena run-level
- **Found during:** Task 3.
- **Issue:** el `<done>` de Task 3 exige "test asierta 0 upserts" pero el plan no lista un archivo de test para `ingest-run-servel`.
- **Fix:** se agrego `ingest-run-servel.test.ts` (6 tests) con un `SpyServelWriter` que cuenta llamadas a upsert, asertando 0 upserts en drift-header y en cada mismatch de completitud.
- **Commit:** `d724365`.

### Cleanup - artefactos de build de adjudication
- Al correr `tsc -b` por primera vez con la nueva reference, el build emitio `.js`/`.d.ts` transitorios dentro de `packages/adjudication/src/` (su `dist/` ya existia con los mismos). Se eliminaron los artefactos transitorios del arbol fuente (solo los archivos generados, NUNCA via `git clean`; `dist/` intacto; 0 deletions de archivos rastreados). No es un cambio de codigo; fuera del scope del plan.

## Local Verification Results

- **`tsc -b` (`pnpm --filter @obs/dinero typecheck`):** LIMPIO (sin errores).
- **Tests `@obs/dinero` (full):** 64/64 verdes (10 archivos), de los cuales **41 son SERVEL nuevos**: `parse-servel` (5), `reconciliar-completitud` (6), `reconciliar-aporte` (5), `storage-supabase` (5), `writer-servel` (9), `ingest-run-servel` (6) + los 23 ChileCompra pre-existentes intactos.
- **Smoke dry-run CLI:** `ingest-cli-servel --dry-run` (sin DB, sin provider) degrada a InMemory (`dbLoaded=false`), el `RobotsGuard` real bloqueo el fetch LIVE y NUNCA fabrico datos (`aportes=0`, comportamiento correcto).
- **Higiene:** sin BOM, sin unicode invisible (verificado con grep `-P` en locale UTF-8) en los 10 archivos fuente SERVEL. El `∥` (U+2225) en las version keys es intencional y espeja `writer.ts` de ChileCompra. Nunca se uso "CC BY 4.0" para SERVEL.
- **Grep gates del `<done>`:** `EXPECTED_HEADERS`+`drift estructural SERVEL` (parse), `correrPipeline`+`confirmar(`+`normalizarNombre`+`@obs/adjudication`+`determinista` (reconciliar), `Content-MD5`+`length` (completitud), `terminos por verificar` (model), `@obs/adjudication` (package.json), `assertAllowedUrl`+`extraHosts`+`SERVEL_HOST`+`https`+`ServelBloqueadaError` (connector), `.storage.from(`+`servel/` (storage), `windows.net` AUSENTE de allowlist, `ENLACE_CONFIRMADO` NO re-exportado, `exceljs` (no bare `xlsx`). TODOS verdes.

## Pending Operator Checkpoints (BLOQUEANTES, NO ejecutados)

El agente completo TODO el codigo + tests/tsc locales. Faltan 2 pasos que requieren credenciales/recursos del operador (host Windows -> Bash tool / git-bash, NO PowerShell):

### (a) Crear el bucket de Supabase Storage `crudo-servel`
- Dashboard Storage -> New bucket, **privado**; o `insert into storage.buckets(id,name,public) values('crudo-servel','crudo-servel',false)`. El conector usa la service key (bypassa Storage RLS). El helper NO crea el bucket en runtime.

### (b) Corrida LIVE acotada (operador provee la URL del .xlsx por eleccion)
- Exportar `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` + credenciales del provider LLM (ya en `.env` desde Phase 4/11) en el entorno (nunca argv).
- `pnpm --filter @obs/dinero ingest:servel --eleccion <slug> --url "<blob-url-de-la-eleccion>" --anio <YYYY>` (respeta el delay 2-3s).
- Confirmar: (a) el crudo .xlsx aparece en `crudo-servel` bajo `servel/<eleccion>/<fecha>/<hash>.xlsx`; (b) el gate de header NO disparo cuarentena (11 headers coinciden); (c) la completitud paso (Content-MD5/byte-length OK); (d) el cruce por NOMBRE poblo `parlamentario_id` SOLO en deterministas; homonimos/ambiguos -> null + cola `identidad_audit` (fail-closed, correcto); (e) DATA-ROUTING: ningun nombre/RUT de DONANTE viajo al LLM; (f) re-correr produce los mismos conteos (idempotente) y no duplica el crudo.
- Si el header drifteo (eleccion con columnas cambiadas), la corrida queda en CUARENTENA con 0 filas — comportamiento correcto, reportarlo. Sin service key -> dry-run; sin provider LLM -> `no_confirmado`. NUNCA fabricar.

## Known Stubs

Ninguno que impida el objetivo del plan. Notas honestas (no son stubs ocultos):
- `rut_donante` viaja siempre `null` (la fuente SERVEL no publica RUT de donante hoy; la columna queda lista por si una exportacion futura lo trae — Plan 01 decision). El donante NUNCA es llave de enlace.
- El provider LLM real del cruce por NOMBRE no se construye en el CLI (igual que `ingest-cli.ts` de lobby): lo inyecta el operador/caller via `opts.reconciliar`; sin el, el cruce degrada a `no_confirmado` (fail-closed honesto), nunca fabrica. El `RevisionWriter` SI se wirea en LIVE para auditar deterministas/ambiguos.

## Self-Check: PASSED

- 17 archivos creados: FOUND (10 fuente + 6 tests + 1 fixture).
- 4 archivos modificados: package.json, tsconfig.json, index.ts, .env.example.
- Commits: `065886f`, `9bca055`, `d724365` -> FOUND (git log).
- 41 tests SERVEL + 23 ChileCompra = 64/64 verdes; `tsc -b` limpio.
