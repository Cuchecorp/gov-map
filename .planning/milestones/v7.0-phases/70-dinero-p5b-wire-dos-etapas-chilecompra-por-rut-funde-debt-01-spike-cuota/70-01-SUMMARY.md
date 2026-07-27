---
phase: 70-dinero-p5b-wire-dos-etapas-chilecompra-por-rut-funde-debt-01-spike-cuota
plan: 01
subsystem: dinero
tags: [dinero, chilecompra, dos-etapas, r2, from-r2, DEBT-01, MONEY-01, CR-01]
requires:
  - "R2Store.putImmutable/getObject + sha256Hex + SnapshotWriter (@obs/ingest, ya existente)"
  - "reconciliarContrato RUT-exacto fail-closed (@obs/dinero, Phase 69, congelado)"
  - "redactarTicket + MERCADOPUBLICO_TICKET (@obs/dinero query.ts)"
provides:
  - "runIngestDinero con r2Store/snapshotWriter/fromR2 (Etapa 1 R2 put-gatea-upsert por-RUT)"
  - "run-dinero-masivo-cli: construye R2Store real de .env R2_* + acepta --from-r2 + redacta el ticket"
  - "--from-r2 replay que deriva la tarea del envelope (0 fetch a la fuente)"
affects:
  - "packages/dinero (runner + CLI operador + tests del wire y CR-01)"
  - "Wave 2 (operador-LOCAL): el crawl LIVE cuota-limitado consume este wire"
tech-stack:
  added: []
  patterns:
    - "Envelope POR-RUT { rut, buscarProveedor, ordenes: {[dia]} } content-addressed en dinero/<rut>/<fecha>/<sha>.json (Pitfall 2, NO por-boletin)"
    - "Etapa-1-primero LOCKED: putImmutable no-412 lanza -> errores.push(redactado) + continue, sin upsert (T-70-02)"
    - "--from-r2 deriva tareas del envelope (rut + Object.keys(ordenes)), reusa el writer resuelto (W-1)"
    - "redactarTicket en TODO log/errores.push del nuevo path; envelope solo JSON crudo (T-70-01)"
key-files:
  created:
    - packages/dinero/src/ingest-run.test.ts
    - packages/dinero/src/run-dinero-masivo-cli.ts
    - packages/dinero/src/run-dinero-masivo-cli.test.ts
  modified:
    - packages/dinero/src/ingest-run.ts
    - packages/dinero/src/connector-chilecompra.test.ts
decisions:
  - "El replay --from-r2 DERIVA la tarea del envelope (rut + dias en ordenes), espejando tramitacion que deriva [envelope.boletin] — no requiere --rut/--dia"
  - "Guard --from-r2-sin-r2Store lanza plain Error en el runner (evita ciclo de import con DineroCliArgsError de ingest-cli); el CLI lanza DineroMasivoArgsError"
  - "En replay se desactiva r2Store (no se re-persiste el crudo ya presente en R2)"
  - "Test E prueba byte-identidad via nombre_orden (monto es null por diseño CR-02 del modelo, no tocado)"
metrics:
  duration: "~7 min"
  completed: "2026-07-14"
  tasks: 3
  files: 5
---

# Phase 70 Plan 01: Wire dos-etapas ChileCompra (dinero) Summary

Wire de plumbing que hace que la ingesta de contratos de ChileCompra escriba **PRIMERO el crudo en R2** y **LUEGO R2→Supabase**, re-ejecutables por separado (DEBT-01 + porción MONEY-01). `runIngestDinero` gana `r2Store`/`snapshotWriter`/`fromR2`: en el camino normal persiste un envelope **por-RUT** content-addressed **antes** del upsert (un put fallido no-412 **gatea** la Etapa 2, fail-closed T-70-02), y un modo `--from-r2` reconstruye los contratos desde R2 con un conector fake (0 fetch a la fuente). Un CLI de operador (`run-dinero-masivo-cli.ts`) arma el `R2Store` real de `.env` y redacta el `MERCADOPUBLICO_TICKET` en toda salida. Cero paquetes nuevos, cero migraciones; reconciliador/modelo/0023 intactos.

## What Was Built

**Task 1 (RED, `test(70-01)` `16ffe62`):** `ingest-run.test.ts` con `FakeR2Store` (putImmutable/getObject) + `OrderTrackingWriter` que comparten un **contador monotónico**:
- **Test A** — la 1ª `putImmutable` (Etapa 1) captura un orden ESTRICTAMENTE menor que la 1ª `upsertContratos` (Etapa 2), por orden de captura (no por presencia). DEBT-01.
- **Test B / B-guard** — `--from-r2` puebla desde el envelope con un conector que **lanza si se toca** (0 fetch); guard lanza si `fromR2` sin `r2Store`.
- **Test C** — `putImmutable` que lanza → RUT en `errores` (redactado), `upsertContratos` NO llamado.
- **Test D** — `existed:true` (412) → skip Etapa 2 (0 upsert).
- **Test E** — el string crudo (`nombreOrden`) sobrevive byte-idéntico tras el replay; `monto` sigue null (no re-parseado). Los 6 casos fallaban (RED) por `r2Store`/`fromR2` inexistentes.

**Task 2 (GREEN, `feat(70-01)` `57957a3`):** `RunIngestDineroOpts` ganó `r2Store?`/`snapshotWriter?`/`fromR2?`. Camino normal: tras acumular `contratosTarea` y ANTES del reconcilia+upsert, construye el envelope `{ rut, buscarProveedor: <json paso1>, ordenes: {[dia]: <json paso2>} }` (solo respuestas JSON crudas, NUNCA la URL con `&ticket=`), `sha256Hex` → `putImmutable("dinero", rut, today, sha, "json", bytes)`. `putImmutable` que lanza → `errores.push(redactarTicket(...))` + `continue` (gatea). `existed` → skip. `snapshotWriter.write` best-effort. Camino `--from-r2`: al inicio, exige `r2Store`, lee el envelope, arma un `conectorFake`, y **deriva la tarea del envelope** (rut + `Object.keys(ordenes)`), reusando el `writer` resuelto (W-1).

**Task 3 (`feat(70-01)` `18f1dca`):** `run-dinero-masivo-cli.ts` (espejo de `run-votos-masivo-cli.ts`): construye un `R2Store` real de `.env R2_*`, toma `MERCADOPUBLICO_TICKET` de env (nunca argv), acepta `--rut`/`--dia`/`--ruts-file`/`--from-r2`/`--dry-run`, loguea destino LOCAL/REMOTO y pasa TODO error/degradación por `redactarTicket`. Guard: `--from-r2` sin R2 lanza `DineroMasivoArgsError`. `run-dinero-masivo-cli.test.ts` prueba: construcción del R2Store desde env, degradación con WARN sin R2, threading de `--from-r2` (replay 0-fetch), guard, y que el ticket inyectado NUNCA surface en claro (surfacea como `ticket=***`). `connector-chilecompra.test.ts` extendido con CR-01 al nuevo wire: el envelope guardado no contiene el ticket, y un error del `putImmutable` sale redactado.

## Verification Results

- `pnpm --filter @obs/dinero test` — **115 pass** (100 de Phase 69 + 15 nuevos del wire/CLI/CR-01), 15 archivos.
- `pnpm --filter @obs/dinero typecheck` (`tsc -b`) — **verde**.
- `git diff --exit-code` **VACÍO** en `reconciliar-contrato.ts`, `model.ts`, `supabase/migrations/0023_dinero.sql`.
- Grep de aceptación: `putImmutable("dinero"` (1) + `getObject` (1) en ingest-run.ts; `fromR2` (8) + `R2_ACCESS_KEY_ID` (4) en run-dinero-masivo-cli.ts.
- 100% OFFLINE: FakeR2Store + conector fake; **cero** fetch LIVE, cero consumo de cuota MERCADOPUBLICO, `MONEY_PUBLIC_ENABLED` no tocado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El replay `--from-r2` devolvía 0 contratos cuando no se pasaban `--rut`/`--dia`**
- **Found during:** Task 3 (test de threading `--from-r2` del CLI)
- **Issue:** El loop iteraba `opts.tareas`; en replay puro (`{ fromR2 }` sin ruts) `tareas` quedaba vacío → 0 filas. Tramitación deriva la unidad de replay del envelope (`[envelope.boletin]`); dinero no lo hacía.
- **Fix:** En la rama `--from-r2` se **derivan** las tareas del envelope: `[{ rut: envelope.rut, dias: Object.keys(envelope.ordenes) }]`, y el loop itera una variable local `tareas` (no `opts.tareas`). Espeja el molde de tramitación.
- **Files modified:** packages/dinero/src/ingest-run.ts
- **Commit:** 18f1dca (se incluyó ingest-run.ts en el commit de Task 3 porque el fix habilita el threading del CLI)

**Nota sobre `@supabase/supabase-js`:** el plan preveía añadirlo como dep directa "SOLO si tsc -b no resuelve". Ya era dep directa de `@obs/dinero` (package.json:22) → **cero instalaciones**, `package.json` sin cambios, sin checkpoint de legitimidad.

## Known Stubs

None — el wire threadea símbolos reales (`R2Store`/`SnapshotWriter`/`sha256Hex`); los fakes viven solo en los tests. El crawl LIVE cuota-limitado (que consume este wire) es Wave 2 operador-LOCAL, fuera de alcance de este plan.

## Threat Flags

Ninguno. El wire NO introduce superficie de seguridad nueva: no toca el reconciliador (`git diff` vacío en reconciliar-contrato.ts/model.ts/0023), no fabrica endpoints, no expone contratos públicamente (`MONEY_PUBLIC_ENABLED` intacto), y `--from-r2` reduce la superficie de red (0 fetch en replay). Los mitigate del register se preservan: T-70-01 (ticket redactado + envelope sin URL) probado en Task 3; T-70-02 (Etapa-1-primero gatea) en Test C; T-70-03/04 (reconciliador congelado + monto verbatim) por el diff vacío + Test E.

## Self-Check: PASSED

- FOUND: packages/dinero/src/ingest-run.test.ts
- FOUND: packages/dinero/src/run-dinero-masivo-cli.ts
- FOUND: packages/dinero/src/run-dinero-masivo-cli.test.ts
- FOUND commit 16ffe62 (test RED)
- FOUND commit 57957a3 (feat wire)
- FOUND commit 18f1dca (feat CLI + CR-01)
