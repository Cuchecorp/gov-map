---
phase: 71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01
plan: 01
subsystem: dinero (ingesta SERVEL)
tags: [servel, r2, dos-etapas, debt-01, money-02, local, from-r2, xlsx]
requires:
  - "@obs/ingest R2Store.putImmutable/getObject + sha256Hex + SnapshotWriter"
  - "packages/dinero/src/parse-servel.ts (HEADER_ROW=4, EXPECTED_HEADERS)"
  - "packages/dinero/src/reconciliar-aporte.ts (cruce por NOMBRE determinista, INTACTO)"
provides:
  - "runIngestServel con Etapa-1-R2-first (.xlsx bytes) + modo LOCAL --from-r2"
  - "TareaEleccion.r2Path (modo LOCAL: operador coloca el .xlsx en R2)"
affects:
  - "packages/dinero/src/ingest-run-servel.ts"
  - "packages/dinero/src/ingest-run-servel.test.ts"
tech-stack:
  added: []
  patterns:
    - "Etapa-1-R2-first: putImmutable ANTES del upsert; put no-412 GATEA (fail-closed)"
    - "modo LOCAL: getObject lee bytes .xlsx del operador, 0 fetch a la fuente"
    - "subirCrudo (Supabase Storage) DEGRADADO a secundario best-effort no-gate"
key-files:
  created: []
  modified:
    - "packages/dinero/src/ingest-run-servel.ts"
    - "packages/dinero/src/ingest-run-servel.test.ts"
decisions:
  - "R2 es la UNICA verdad cruda gateante para SERVEL; subirCrudo (Supabase Storage) degradado a best-effort no-gate DESPUES del put R2"
  - "Cruce candidato->parlamentario por NOMBRE determinista (SERVEL no trae RUT); reconciliar-aporte/model-servel/parse-servel/0024 con git diff VACIO"
  - "En modo LOCAL las anclas de completitud se derivan del crudo (md5/byte-length locales); no hay HEAD del blob"
metrics:
  duration: "~4 min"
  completed: "2026-07-14"
  tasks: 2
  files: 2
---

# Phase 71 Plan 01: SERVEL R2 Two-Stage Wire (Etapa-1-R2-first + LOCAL --from-r2) Summary

Cableó `runIngestServel` para escribir PRIMERO los BYTES del `.xlsx` content-addressed a R2 (Etapa 1) y LUEGO parsear/upsert (Etapa 2), con un modo LOCAL `--from-r2` que lee el `.xlsx` que el operador colocó en R2 sin tocar la fuente — espejo directo de Phase 70 (ChileCompra), adaptado a que el crudo SERVEL son bytes binarios de `.xlsx` (no un envelope JSON) y a que la Etapa 1 en modo LOCAL es un acto humano (colocar el archivo), no un fetch. Funde DEBT-01 para SERVEL y cumple la porción LOCAL de MONEY-02. MONEY sigue gated OFF.

## What Was Built

- **Etapa-1-R2-first (camino NORMAL, fetched):** tras `descargar` + validación de completitud y ANTES del upsert, `putImmutable("servel", eleccion, fecha, sha256(bytes), "xlsx", bytes)`. Un put fallido (no-412) hace `errores.push` + `continue` — sin crudo en R2 NO se escribe el derivado (fail-closed, T-71-02). Un `existed:true` (412) es éxito idempotente → skip de la Etapa 2. Tras el put exitoso, `snapshotWriter.write(...)` best-effort (no fatal).
- **Modo LOCAL / `--from-r2`:** cuando `opts.fromR2` o `tarea.r2Path` aplica, la fuente de bytes es `r2Store.getObject(r2Path)` — NUNCA `conector.descargar`. Las anclas de completitud se derivan del crudo local (md5/byte-length de los bytes leídos); la cuarentena run-level se mantiene intacta. La guarda de frontera acepta `r2Path` como alternativa válida a `url` (una tarea LOCAL con `eleccion`+`r2Path` es válida aunque `url` esté vacío). `--from-r2` sin `r2Store` lanza error de args.
- **`subirCrudo` DEGRADADO:** la subida a Supabase Storage corre DESPUÉS del put R2 exitoso, envuelta en try/catch que solo loguea — su fallo NUNCA gatea ni aborta el upsert. R2 es la única verdad cruda gateante (decisión LOCKED del plan).
- **Fail-soft por elección preservado:** `ServelBloqueadaError`, drift de header (parseAportes THROW) y mismatch de completitud degradan ESA elección con `continue` — la corrida multi-elección no aborta.
- **Cruce por NOMBRE intacto:** el enlace candidato→parlamentario sigue en `reconciliar-aporte.ts` (determinista → FK, resto → `parlamentario_id NULL`), sin cambios.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | RED — fake-R2 wire tests + fixture .xlsx exceljs in-test | `977e242` | packages/dinero/src/ingest-run-servel.test.ts |
| 2 | GREEN — Etapa 1 R2 (.xlsx bytes) + modo LOCAL --from-r2 | `3705e80` | packages/dinero/src/ingest-run-servel.ts |

## Tests Added (6 wire cases, sobre los 10 pre-existentes → 16 en el archivo)

- **A** put-antes-upsert: `putImmutable("servel", ...)` captura un orden monotónico estrictamente menor que la primera `upsertAportes` (orden de captura, no presencia).
- **B** modo LOCAL/`--from-r2` 0-fetch: lee bytes `.xlsx` de `getObject`; el conector LANZA en `descargar` si se toca → prueba 0 fetch. Guard: `fromR2` sin `r2Store` lanza.
- **C** put falla gatea: `putImmutable` que lanza → elección en `errores`, `upsertAportes` NO llamado.
- **D** 412 idempotente: `existed:true` → skip Etapa 2 (0 upsert) en el camino normal.
- **E / E'** fail-soft por elección: elección A cuarentenada por drift (E) o `ServelBloqueadaError` (E') + elección B ok en la misma corrida.
- **F** `eleccion` + `fecha_corte` byte-idénticos tras replay `--from-r2` (no recomputados por el wire).

## Verification

- `pnpm --filter @obs/dinero test` → **136 passed** (16 en ingest-run-servel.test.ts).
- `pnpm --filter @obs/dinero typecheck` (`tsc -b`) → verde.
- `git diff --exit-code -- reconciliar-aporte.ts model-servel.ts parse-servel.ts supabase/migrations/0024_servel.sql` → exit 0 (VACÍO).
- MONEY_PUBLIC_ENABLED sin tocar (permanece OFF). Cero fetch a la fuente / cero write remoto / cero flip.

## Deviations from Plan

None — plan executed exactly as written. `subirCrudo` fue degradado a best-effort no-gate (decisión LOCKED del plan, no una desviación).

## Known Stubs

None. El wire está completo y probado offline. El `.xlsx` real y las credenciales R2 son toil operador-LOCAL (runbook fuera del alcance de este plan); el gate MONEY permanece OFF hasta Phase 73.

## Self-Check: PASSED

- FOUND: 71-01-SUMMARY.md, ingest-run-servel.ts, ingest-run-servel.test.ts
- FOUND commits: 977e242 (test RED), 3705e80 (feat GREEN)
