---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
plan: 02
subsystem: api
tags: [chilecompra, mercadopublico, rest, rut, modulo-11, zod, supabase, pgmq, ssrf]

requires:
  - phase: 09-identity (EnlaceConfirmado / confirmar)
    provides: invariante tipado del enlace confirmado + factory unica confirmar()
  - phase: identity (deterministic.ts)
    provides: isRutValido / normRut / matchDeterminista (rama RUT)
  - phase: ingest (allowlist + Fetcher + RobotsGuard + HostRateLimiter)
    provides: ORDEN LOCKED de fetch + assertAllowedUrl SSRF + mercadopublico.cl allowlisted
provides:
  - "@obs/dinero: conector REST de ChileCompra (flujo 2 pasos), parser VERBATIM, reconciliacion RUT-exacto, writer idempotente, CLI dry-run"
  - "sub-maestra contratista keyed por RUT del proveedor"
  - "MERCADOPUBLICO_TICKET en .env.example (secreto de operador)"
affects: [14-01 migracion 0023 (columnas contrato/contratista/contratos_ingesta_estado), ficha contratos-de-parlamentario, Phase 16 agregacion por contraparte]

tech-stack:
  added: []
  patterns:
    - "Conector REST en el ORDEN LOCKED (assertAllowedUrl -> robots -> rateLimiter -> get), NO BaseConnector.run"
    - "Enlace SOLO por RUT-exacto via matchDeterminista rama RUT + confirmar(); sin pipeline name-only"
    - "Flujo de 2 pasos RUT -> CodigoEmpresa -> ordenes por dia (fecha = un solo dia)"
    - "Drift estructural / RUT invalido -> cuarentena (0 filas), NUNCA fila silenciosa"

key-files:
  created:
    - packages/dinero/package.json
    - packages/dinero/tsconfig.json
    - packages/dinero/src/model.ts
    - packages/dinero/src/query.ts
    - packages/dinero/src/parse-chilecompra.ts
    - packages/dinero/src/reconciliar-contrato.ts
    - packages/dinero/src/connector-chilecompra.ts
    - packages/dinero/src/writer.ts
    - packages/dinero/src/writer-supabase.ts
    - packages/dinero/src/ingest-run.ts
    - packages/dinero/src/ingest-cli.ts
    - packages/dinero/src/live-chilecompra.probe.ts
    - packages/dinero/src/index.ts
    - packages/dinero/src/parse-chilecompra.test.ts
    - packages/dinero/src/reconciliar-contrato.test.ts
    - packages/dinero/src/writer.test.ts
  modified:
    - tsconfig.base.json
    - .env.example

key-decisions:
  - "monto se preserva VERBATIM como string crudo (sin computo); el listado de ChileCompra no expone un total numerico fijo, se preserva el contenido crudo de la orden"
  - "contratista se keya por el RUT de ENTRADA (consultado, ya DV-validado), no por un campo de la respuesta (Open Question 1 del research)"
  - "403 -> FetchError; 429/503 -> RetryableError: ambos se mapean a ChileCompraBloqueadaError para degradacion honesta"
  - "marcarSinContratos solo marca al parlamentario con RUT-exacto unico; sin RUT interno (IDENT-10) nadie queda marcado -> 'no consultado todavia' honesto"

patterns-established:
  - "Conector REST con ticket secreto: ticket SOLO de env, urlSinQuery() corta la querystring de los mensajes de error, jamas interpolado"
  - "Sub-maestra del sujeto (contratista) distinta de cualquier enlace al parlamentario"

requirements-completed: [MONEY-01, MONEY-02]

duration: ~35min
completed: 2026-06-19
---

# Phase 14 Plan 02: Conector @obs/dinero (ChileCompra por RUT) Summary

**Conector REST de ChileCompra que ingiere contratos del Estado por RUT (flujo de 2 pasos con ticket de operador), enlaza al parlamentario UNICAMENTE por RUT-exacto determinista, crea la sub-maestra de contratistas, y degrada a dry-run sin ticket — 24 tests unit verdes, tsc limpio. El probe LIVE queda pendiente como checkpoint de operador.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-19T14:10:00Z (aprox)
- **Completed:** 2026-06-19T14:19:00Z (aprox)
- **Tasks:** 2 autonomas completas; 1 checkpoint (human-action) pendiente
- **Files modified:** 18 (16 creados, 2 modificados)

## Accomplishments

### Task 1 — Nucleo puro (commit cc43975)
- `package.json` `@obs/dinero` SIN `@obs/adjudication` (enlace RUT-only; no arrastra el fallback name-only del LLM).
- `model.ts`: tipos `Contrato` + `Contratista` + Zod schemas de la respuesta de ChileCompra (`BuscarProveedorResponse`, `OrdenesResponse`). Licencia = `"mencion de la fuente"` (NUNCA `'CC BY 4.0'`). Campos literales como string; `tipoPersona` natural/juridica.
- `query.ts`: builders puros `urlBuscarProveedor` / `urlOrdenesDeCompra` + generador de ventanas de dia `fechasEntre`/`ddmmaaaaDe`. Ticket recibido como parametro, nunca hardcodeado.
- `parse-chilecompra.ts`: parser VERBATIM, Zod-validado; forma inesperada -> THROW (cuarentena aguas arriba), nunca 0 filas silenciosas. `tipoPersona(rut)` umbral 50M (fallback documentado MEDIUM).
- `reconciliar-contrato.ts`: enlace SOLO por RUT-exacto via `matchDeterminista` (acepta SOLO `estado==="confirmado" && metodo==="rut"`) -> `confirmar(id,"determinista")`. RUT invalido -> cuarentena; RUT valido sin match unico (incl. IDENT-10 / 2+) -> `enlace: null` + mencion cruda.

### Task 2 — Conector + writer + CLI (commit 538f425)
- `connector-chilecompra.ts`: ORDEN LOCKED exacto (`assertAllowedUrl` -> `robots.isAllowed` -> `rateLimiter.wait` -> `fetcher.get`). `ChileCompraBloqueadaError` mapea 403 (`FetchError`) y 429/503 (`RetryableError`). UA `Bot-Ciudadano/1.0` + `Accept: application/json`. Ticket nunca interpolado (querystring saneada en errores).
- `writer.ts` / `writer-supabase.ts`: `upsertContratos` idempotente por `onConflict: "fuente_id,fecha_corte"`; `upsertContratistas` por `onConflict: "rut_proveedor"` (last-write-wins); `marcarIngestado` por `onConflict: "parlamentario_id"`. Service key solo de env, nunca interpolada en errores.
- `ingest-run.ts`: barrido serial por RUT respetando el delay 2-3s (el rate-limiter serializa por host; NO se paraleliza contra api.mercadopublico.cl). `isRutValido` -> 2 pasos -> parse -> reconcilia -> upsert -> `marcarIngestado`. Bloqueada -> degrada y continua; drift/invalid -> cuarentena. R2 omitido (bloqueado, probado).
- `ingest-cli.ts`: flag `--rut` (+`--dia`); ticket y service key SOLO de env; sin ticket o sin DB -> `InMemoryDineroWriter` (dry-run, nunca fabrica).
- `live-chilecompra.probe.ts`: probe LIVE manual (operador, requiere ticket real).
- `index.ts`: barrel; NO re-exporta el simbolo branded `ENLACE_CONFIRMADO`.

## Verification Results

- **Unit tests:** `pnpm exec vitest run packages/dinero` -> **24 passed (3 files)**: `parse-chilecompra.test.ts` (9), `reconciliar-contrato.test.ts` (6), `writer.test.ts` (9).
- **Typecheck:** `pnpm --filter @obs/dinero exec tsc -b` -> **EXIT 0** (limpio).
- **Barrel:** `index.ts` resuelve 25 simbolos sin error; `ENLACE_CONFIRMADO` ausente.

### Grep-gated hard rules (todas verdes)
- `reconciliar-contrato.ts` NO contiene `correrPipeline` / `@obs/adjudication` / `normalizarNombre` (verificado por grep: CLEAN).
- `package.json` NO declara `@obs/adjudication`.
- `model.ts` usa `LICENCIA_DINERO = "mencion de la fuente"` (sin `'CC BY 4.0'` como valor).
- `connector-chilecompra.ts` contiene `assertAllowedUrl` (3) y `ChileCompraBloqueadaError` (5).
- El ticket NUNCA se interpola en mensajes de error (grep de interpolacion: NONE).
- `.env.example` contiene `MERCADOPUBLICO_TICKET`.

## Allowlist (verify-only, W2 correction)

`mercadopublico.cl` **ya estaba presente** en `DEFAULT_ALLOWED_SUFFIXES` (`packages/ingest/src/allowlist.ts:27`) y cubre `api.mercadopublico.cl` por subdominio (`hostMatchesSuffix`). **No se edito** el allowlist compartido (resultado esperado segun el plan).

## Deviations from Plan

### Auto-fixed / Decisiones de implementacion

**1. [Rule 3 - blocking] tsconfig.base.json: agregada la ruta `@obs/dinero`**
- **Found during:** Task 1 (resolucion de modulos workspace).
- **Issue:** sin la entrada en `paths`, `@obs/dinero` no resolveria como import workspace ni tsc lo veria.
- **Fix:** agregadas `"@obs/dinero"` y `"@obs/dinero/*"` a `tsconfig.base.json` (espejo de las demas entradas `@obs/*`). Tambien se creo `packages/dinero/tsconfig.json` (espejo de probidad, sin la referencia a adjudication).
- **Files modified:** tsconfig.base.json, packages/dinero/tsconfig.json
- **Commit:** cc43975

**2. [Decision] `monto` VERBATIM como contenido crudo de la orden**
- El `Listado` de `ordenesdecompra.json` no expone un total numerico fijo en la forma derivada de docs; se preserva el campo `Nombre` de la orden como contenido crudo en `monto`/`mencion`. La forma EXACTA (incl. si existe un campo de monto) se confirma en el probe LIVE del operador; el parser ya valida con Zod y un campo extra no rompe.

**3. [Decision] Mapeo 403 vs 429/503 a `ChileCompraBloqueadaError`**
- El `Fetcher` de @obs/ingest lanza `FetchError` para 403 y `RetryableError` para 429/5xx. El conector captura ambos para mapear 403/503/429 a `ChileCompraBloqueadaError` (degradacion honesta del RUT), en vez de asumir un solo tipo de error.

## Pending Operator Checkpoint (Task 3 — checkpoint:human-action, BLOCKING)

**Estado: PENDIENTE (sin marcar).** La corrida LIVE acotada NO se ejecuto (requiere `MERCADOPUBLICO_TICKET` real; secreto de operador, host Windows -> Bash/git-bash, NO PowerShell). Pasos para el operador:

1. Exportar `MERCADOPUBLICO_TICKET` (y opcionalmente `SUPABASE_SERVICE_KEY`/`SUPABASE_DB_URL`) en el entorno, nunca por argv.
2. Correr el probe:
   `MERCADOPUBLICO_TICKET=... pnpm --filter @obs/dinero exec tsx src/live-chilecompra.probe.ts "<RUT-de-empresa-conocido>" [DDMMAAAA]`
   (respeta el delay 2-3s LOCKED).
3. Confirmar que la forma real coincide con los Zod schemas (`BuscarProveedor` -> `CodigoEmpresa`; `ordenesdecompra` -> `Cantidad`/`Listado`). Si difiere, ajustar el schema/parser y reportar el delta (Assumption A2 del research).
4. (Opcional, si hay RUT interno poblado) corrida acotada del CLI por uno/dos RUT con writer real para verificar idempotencia (re-correr -> mismos conteos).

**Resume-signal:** "probe OK, schema coincide" o describir el delta de forma.

## Known Stubs

- **`monto` derivado del campo crudo de la orden** (`parse-chilecompra.ts`): la forma EXACTA del monto en `ordenesdecompra.json` esta derivada de docs (A2), no de una respuesta capturada. NO es un stub silencioso (valida con Zod y preserva VERBATIM); el probe LIVE del operador lo confirma. Intencional, resuelto por el checkpoint Task 3.
- **Enlace siempre `null` hoy (IDENT-10):** mientras el RUT interno de la maestra este vacio, todo enlace es `null` y el parlamentario queda "no consultado todavia". Es el comportamiento honesto LOCKED por CONTEXT, no un defecto; el operador puebla `parlamentario.rut` (deuda IDENT-10).

## Threat Flags

Ninguna superficie de seguridad nueva fuera del threat_model del plan. El conector ya esta cubierto por assertAllowedUrl (SSRF, T-14-07), rate-limit serial (DoS, T-14-08), Zod gate (drift, T-14-09), enlace RUT-only (homonimia, T-14-06) y ticket/service key solo de env nunca interpolados (info disclosure, T-14-05).

## Self-Check: PASSED

- 14/14 archivos creados verificados en disco (FOUND).
- 2/2 commits verificados (cc43975, 538f425).
- 24/24 tests unit verdes; tsc -b EXIT 0.
