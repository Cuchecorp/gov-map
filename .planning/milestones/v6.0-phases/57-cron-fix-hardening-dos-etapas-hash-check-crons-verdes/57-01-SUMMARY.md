---
phase: 57-cron-fix-hardening-dos-etapas-hash-check-crons-verdes
plan: "01"
subsystem: ingest
tags: [r2, hash-check, dos-etapas, primitivos]
dependency_graph:
  requires: []
  provides: [R2Store.getObject, putImmutable-existed]
  affects: [base-connector, agenda/ingest-run, fichas/texto-fuente, identity/seed-cli, lobby/run-camara-lobby, probidad/run-probidad-todos]
tech_stack:
  added: []
  patterns: [SigV4-via-AwsClient.sign, makeMockFetch-body, destructure-r2Path]
key_files:
  created: []
  modified:
    - packages/ingest/src/r2-store.ts
    - packages/ingest/src/r2-store.test.ts
    - packages/ingest/src/base-connector.ts
    - packages/ingest/src/base-connector.test.ts
    - packages/agenda/src/ingest-run.ts
    - packages/fichas/src/texto-fuente.ts
    - packages/fichas/src/texto-fuente.test.ts
    - packages/identity/src/seed-cli.ts
    - packages/lobby/src/run-camara-lobby.ts
    - packages/probidad/src/run-probidad-todos.ts
decisions:
  - "Opcion A para putImmutable: cambiar tipo de retorno en la firma principal (no overload separado); los callers destructuran { r2Path }"
  - "Callers en otros paquetes actualizados en este plan (no diferidos) para mantener typecheck limpio en un solo commit"
metrics:
  duration: "~15 min"
  completed: "2026-07-08"
  tasks_completed: 2
  files_changed: 10
---

# Phase 57 Plan 01: R2Store.getObject + putImmutable {r2Path, existed} Summary

**One-liner:** `R2Store.getObject` con SigV4 para leer crudo desde R2, y `putImmutable` extiende su retorno a `{ r2Path, existed }` donde 412 mapea a `existed=true` para hash-check en Wave 2.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extender putImmutable + nuevo getObject | 2cf6179 | r2-store.ts + 9 callers actualizados |
| 2 | Tests unitarios getObject + existed | 2cf6179 | r2-store.test.ts |

## Test Results

```
pnpm --filter @obs/ingest test --run
11 test files, 68 tests — all passed
r2-store.test.ts: 10 tests (5 putImmutable, 3 getObject, 2 existed)
pnpm -w typecheck: exit 0 (limpio)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Callers en paquetes externos con tipo incompatible tras cambio de retorno**
- **Found during:** Task 1 (typecheck post-implementacion)
- **Issue:** 6 archivos en `agenda`, `fichas`, `identity`, `lobby`, `probidad` tenian interfaces locales con `Promise<string>` o asignaban el resultado de `putImmutable` directamente a `string`
- **Fix:** Actualizar las interfaces locales (`TablaR2Target`, `TextoR2Target`, inline en `base-connector.ts`) a `Promise<{ r2Path: string; existed: boolean }>` y destructurar `{ r2Path }` en los callers. El plan anticipaba esto y autorizaba hacerlo "en este plan o notar para Plan 02"; se eligio hacerlo aqui para mantener un typecheck limpio en el mismo commit.
- **Files modified:** base-connector.ts, base-connector.test.ts, agenda/ingest-run.ts, fichas/texto-fuente.ts, fichas/texto-fuente.test.ts, identity/seed-cli.ts, lobby/run-camara-lobby.ts, probidad/run-probidad-todos.ts
- **Commit:** 2cf6179

## Known Stubs

None — la implementacion es funcional y sin placeholders.

## Threat Flags

None — getObject firma con AwsClient.sign (T-57-01 mitigado); mensaje de error solo contiene status y r2Path sin credenciales (T-57-02 mitigado, verificado en tests GET 404/500).

## Self-Check: PASSED

- `packages/ingest/src/r2-store.ts` exists with `getObject` method: FOUND
- `packages/ingest/src/r2-store.test.ts` exists with 10 tests: FOUND
- Commit `2cf6179` exists: FOUND
- `pnpm --filter @obs/ingest test --run` exit 0: PASSED
- `pnpm -w typecheck` exit 0: PASSED
