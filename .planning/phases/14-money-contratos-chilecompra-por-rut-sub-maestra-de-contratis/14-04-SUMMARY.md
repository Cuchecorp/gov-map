---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
plan: 04
subsystem: dinero / identity
tags: [money, identidad, finalidad-del-dato, cosecha-rut, retrofit]
requires:
  - "@obs/adjudication correrPipeline (name-link via pipeline confirmado/auditado)"
  - "@obs/identity confirmar / matchDeterminista / isRutValido / normRut"
  - "@obs/identity runBackfillRut / RutBackfillWriter / FilaRutCruda (DV-gate + provenance)"
  - "@obs/core normalizarNombre"
provides:
  - "reconciliarContrato (async): RUT-exacto intacto + fallback persona-natural via correrPipeline + persona-juridica RUT-only + emision de CandidatoCosechaRut"
  - "CandidatoCosechaRut (tipo): { parlamentarioId, rutHarvested, provenance }"
  - "construirFilasCosecha / runHarvestRut: writer path de cosecha que reusa runBackfillRut"
affects:
  - "packages/dinero/src/ingest-run.ts (await reconciliarContrato async)"
tech-stack:
  added: []
  patterns:
    - "name-link via correrPipeline + data-routing gate del PII (espejo de reconciliar-aporte.ts)"
    - "cosecha de RUT como canal SEPARADO de salida; reuso de runBackfillRut (Don't Hand-Roll)"
key-files:
  created:
    - packages/dinero/src/harvest-rut.ts
    - packages/dinero/src/harvest-rut.test.ts
  modified:
    - packages/dinero/src/reconciliar-contrato.ts
    - packages/dinero/src/reconciliar-contrato.test.ts
    - packages/dinero/src/index.ts
    - packages/dinero/src/ingest-run.ts
decisions:
  - "Persona natural sin match RUT-exacto cruza por NOMBRE via correrPipeline (finalidad del dato); persona juridica conserva RUT-exacto-only (supersede explicito SOLO para persona natural)"
  - "Cosecha de RUT solo en match persona-natural CONFIRMADO, re-validando isRutValido antes de emitir; nunca se fabrica; canal de salida separado de la fila para-escribir"
  - "Escritura remota del RUT cosechado + corrida LIVE = checkpoint de operador (no ejecutado)"
metrics:
  duration: "~1h"
  completed: "2026-06-19"
  tasks: 3
  files: 6
---

# Phase 14 Plan 04: Retrofit "finalidad del dato" de la reconciliacion de contratos Summary

Retrofit de `reconciliar-contrato.ts` bajo el principio de operador "finalidad del dato": un FUNCIONARIO PUBLICO persona-natural se enlaza por el pipeline de identidad confirmado/auditado (RUT-exacto O nombre via `correrPipeline`), cosechando de paso su RUT DV-valido al `rut` de la maestra (IDENT-10), mientras la PII (el `rutProveedor`) JAMAS toca el LLM/prompt y una persona JURIDICA nunca se name-linkea.

## What Was Built

### Task 1 — `reconciliar-contrato.ts` refactor (commit `c4133a5`)
- `reconciliarContrato` ahora es **async** y acepta `provider`/`writer` inyectables en `ReconciliarContratoOpts`, con defaults seguros (`NOOP_WRITER`, `PROVIDER_AUSENTE`) copiados de `reconciliar-aporte.ts`. `LLMProvider` se tipa derivando de `Parameters<typeof correrPipeline>[2]`.
- **Rama RUT-exacto INTACTA**: `matchDeterminista` rama RUT -> `confirmar(id,"determinista")`; RUT invalido -> cuarentena. Sin cambios de semantica (tests originales verdes).
- **Fallback persona-natural NUEVO**: sin match RUT-exacto + `tipoPersona === "natural"` + `proveedorNombre` presente -> `correrPipeline` con SOLO el nombre; `determinista` puebla el FK + emite un `CandidatoCosechaRut`; `probable`/`revision`/`no_confirmado` -> null + cola humana (fail-closed).
- **Persona JURIDICA SIN CAMBIOS**: nunca llama `correrPipeline`, nunca emite cosecha.
- **`CandidatoCosechaRut`** exportado; `cosechas: CandidatoCosechaRut[]` agregado a `ResultadoReconciliacionDinero`. La emision re-valida `isRutValido` antes de empujar (nunca fabrica). `rutHarvested = normRut(c.rutProveedor)`; provenance `origen = "harvest:chilecompra-persona-natural"`, `enlace = c.enlace`, `fecha_captura = c.fecha_captura`.
- Comentario de cabecera LOCKED reescrito: finalidad del dato (persona natural por nombre + cosecha; persona juridica RUT-only) con supersede explicito.

### Task 2 — `harvest-rut.ts` (commit `1d9eaac`)
- `construirFilasCosecha` (pura): `CandidatoCosechaRut[]` -> `FilaRutCruda[]`.
- `runHarvestRut`: delega en `runBackfillRut` (reuso, NO reimplementacion del DV-gate). RUT DV-invalido o sin provenance -> rechazado, nunca escrito; idempotente.
- Comentario de cabecera marca la escritura remota como **checkpoint de operador**.

### Task 3 — barrel + caller (commit `4ea4020`)
- `index.ts` exporta `CandidatoCosechaRut`, `construirFilasCosecha`, `runHarvestRut`; comentario del export actualizado.
- `ingest-run.ts`: `await reconciliarContrato` (ahora async).

## Local Test / Typecheck Results

- `pnpm --filter @obs/dinero typecheck` -> **limpio** (`tsc -b`).
- Suite completa `@obs/dinero` (via `npx vitest run packages/dinero` desde la raiz) -> **82 tests / 11 archivos, todos verdes**, incluyendo:
  - `reconciliar-contrato.test.ts` (10 tests): RUT invalido -> cuarentena; IDENT-10; RUT-exacto unico (sin cosecha); 2+ matches fail-closed; persona-juridica NUNCA name-link (`prompts.length === 0`); persona-natural confirmada -> enlace + cosecha; persona-natural ambigua -> null + sin cosecha; sin provider degrada/determinista resuelve; DATA-ROUTING (RUT nunca en vinculos/colas/prompts, nombre SI).
  - `harvest-rut.test.ts` (5 tests): mapeo puro; cosecha confirmada escrita; DV-invalido rechazado; provenance faltante rechazado; idempotencia.
  - Tests pre-existentes de Phase 14 (parse-chilecompra, writer, connector, ingest-run-servel, reconciliar-aporte, etc.): **sin regresion**.

## Nota sobre el runner de tests

`pnpm --filter @obs/dinero test` (y `pnpm --filter @obs/dinero test reconciliar-contrato`) reportan "No test files found" porque el `include` del `vitest.config.ts` raiz es `packages/**/*.test.ts`, rooteado al cwd del paquete (no a la raiz) — es una condicion **pre-existente** del repo, no introducida por este plan. Los tests se corrieron desde la raiz con `npx vitest run packages/dinero[/<archivo>]`, que resuelve el glob correctamente. No se modifico la config (fuera de alcance del plan; logueado aqui en vez de `deferred-items.md` por ser solo una nota de ejecucion).

## Deviations from Plan

**1. [Rule 3 - Blocking] `await` en `ingest-run.ts`**
- **Found during:** Task 3 typecheck.
- **Issue:** `reconciliarContrato` paso a ser async (cambio de firma exigido por el plan); `ingest-run.ts:190` lo consumia sincrono -> `TS2339: Property 'contratos' does not exist on type 'Promise<...>'`.
- **Fix:** `await reconciliarContrato(...)` (la llamada ya vivia en contexto async dentro de un try).
- **Files modified:** `packages/dinero/src/ingest-run.ts`.
- **Commit:** `4ea4020`.

**2. [Nota de ejecucion] Fixtures de RUT con DV recalculado**
- Las fixtures de los tests nuevos requerian RUTs DV-validos distintivos. `76.543.210-K`, `77.888.999-8`, `98.765.432-1` resultaron DV-invalidos; se recalcularon a `76.543.210-3` (DATA-ROUTING) y `77.888.999-4` (homonimo sin provider) via `isRutValido`. No es una desviacion de diseno, solo correccion de datos de prueba.

No se toco `.planning/ROADMAP.md` (estaba corrupto/restaurado; instruccion explicita de no tocarlo). El paso normal de `roadmap update-plan-progress` se SALTO por esa razon.

## Pending Operator Checkpoint (Task 4 — checkpoint:human-action, gate=blocking, NO ejecutado)

El path de cosecha esta construido y testeado, pero la persistencia DB remota esta gateada por operador (MEMORY: write DB remoto es deuda de operador; solo via `db push --db-url`). Dos acciones de operador, ninguna automatizable:

1. **Escritura remota del RUT cosechado**: correr `runHarvestRut` con el `RutBackfillWriter` real (Supabase, db-url) apuntando a la maestra remota, revisando que cada fila escrita corresponde a un enlace persona-natural CONFIRMADO y que `rechazadas` esta vacio/auditado; confirmar que el `rut` quedo poblado con provenance "harvested from ChileCompra confirmed persona-natural match".
2. **Corrida LIVE**: disparar la reconciliacion persona-natural sobre contratos reales de ChileCompra con el MiniMax provider real (no mock), revisando la cola humana (`identidad_audit`) para los ambiguos y confirmando que ningun RUT aparece en el audit/prompt.

Ambas son fail-closed por diseno: sin la accion de operador, nada se escribe a la maestra remota ni se corre LIVE. El codigo y los tests quedan listos.

**Resume-signal:** "operador: cosecha escrita + LIVE corrido" (o describir lo observado en el log de rechazadas / cola humana).

## Self-Check: PASSED

- Files created/modified verified on disk: `reconciliar-contrato.ts`, `reconciliar-contrato.test.ts`, `harvest-rut.ts`, `harvest-rut.test.ts`, `index.ts`, `ingest-run.ts` — all FOUND.
- Commits verified: `c4133a5`, `1d9eaac`, `4ea4020` — all in `git log`.
- typecheck clean; 82/82 tests green.
