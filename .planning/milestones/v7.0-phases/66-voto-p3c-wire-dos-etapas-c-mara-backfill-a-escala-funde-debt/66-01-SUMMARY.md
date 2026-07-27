---
phase: 66-voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
plan: 01
subsystem: votos
tags: [voto, dos-etapas, r2, from-r2, cobertura, DEBT-01, VOTO-01]
requires:
  - "runIngest r2Store/snapshotWriter/fromR2 (@obs/tramitacion, ya existente)"
  - "R2Store.putImmutable/getObject (@obs/ingest)"
  - "reconciliarVotosCamara DIPID determinista (P65 golden gate verde)"
provides:
  - "runCamaraVotos reenvía r2Store/snapshotWriter/fromR2 a runIngest (Etapa 1 activa para votos)"
  - "run-votos-masivo-cli construye R2Store real de .env + acepta --from-r2 + imprime cobertura"
  - "reportarCobertura: conteo por estado_vinculo + invariante '0 DIPID-maestra no_confirmado'"
affects:
  - "packages/votos (runner + CLI operador + módulo cobertura)"
  - "Wave 2 (operador-LOCAL): el backfill LIVE + write remoto usa este wire (Plan 02)"
tech-stack:
  added:
    - "@supabase/supabase-js@^2.108.2 como dep directa de @obs/votos (ya en el monorepo)"
  patterns:
    - "Replay --from-r2 VERBATIM del envelope shape de ingest-cli.ts, REUSANDO el writer resuelto (W-1)"
    - "Cobertura por head+count (sin materializar filas → sin cap 1k PostgREST)"
    - "Invariante duro DIPID-maestra por .in() en lotes, nunca name-match"
key-files:
  created:
    - packages/votos/src/cobertura.ts
    - packages/votos/src/cobertura.test.ts
  modified:
    - packages/votos/src/run-camara-votos.ts
    - packages/votos/src/run-camara-votos.test.ts
    - packages/votos/src/run-votos-masivo-cli.ts
    - packages/votos/package.json
decisions:
  - "RUTA A (D-WIRE): threadear runCamaraVotos, NO reusar ingest-cli como entry-point de votos"
  - "D-R2-NS: reusar el envelope tramitacion/<boletin> de runIngest (votXml+detalles dentro), sin namespace dedicado"
  - "D-SC4-MET: reportar (a) cobertura absoluta por estado_vinculo + (b) invariante '0 DIPID-maestra no_confirmado'"
  - "W-1: el bloque --from-r2 REUSA el writer ya resuelto (no re-deriva como ingest-cli)"
metrics:
  duration: "~8 min"
  completed: "2026-07-14"
  tasks: 3
  files: 6
---

# Phase 66 Plan 01: Wire dos-etapas Cámara (votos) Summary

Wire de plumbing que hace que la ingesta de votos de la Cámara produzca sus **primeros snapshots R2** (hoy 0): `runCamaraVotos` ahora reenvía `r2Store`/`snapshotWriter`/`fromR2` a `runIngest` (que ya ejecutaba la Etapa 1), el CLI de operador construye un `R2Store` real de `.env` y acepta `--from-r2`, y un nuevo `reportarCobertura` mide `estado_vinculo` + el invariante duro "0 DIPID-maestra no_confirmado". Cero paquetes externos nuevos, cero migraciones, reconciliador/parser/golden intactos.

## What Was Built

**Task 1 (RED, `test(66-01)` `ac7db1a`):** Extendió `run-camara-votos.test.ts` con un `FakeR2Store` (putImmutable/getObject) y un `OrderTrackingWriter` que comparten un contador monotónico:
- **Test A** — la primera `putImmutable` (Etapa 1 R2) precede a la primera `upsertVotos` (Etapa 2 Supabase), por orden de captura (no por presencia). DEBT-01.
- **Test B / B2** — `--from-r2` replay puebla los votos del envelope con conectores spy que **lanzan si se tocan** (0 fetch a la fuente); guard lanza `RunCamaraVotosArgsError` si `fromR2` sin `r2Store`.
- **Test C** — `seleccion='ausente'` (código 4, 0019) se persiste sin descartarse ni coaccionarse. VOTO-01.
- **Test D** — idempotencia por el camino `r2Store` (2ª `putImmutable` = 412 `existed` → runIngest hace skip de la Etapa 2).

**Task 2 (GREEN, `feat(66-01)` `76badba`):** `RunCamaraVotosOpts` ganó `r2Store?`/`snapshotWriter?`/`fromR2?`. El camino normal reenvía `r2Store`/`snapshotWriter` a `runIngest` (spread condicional) → Etapa 1 se ejecuta. El camino `--from-r2` espeja VERBATIM el envelope shape de `ingest-cli.ts` pero **reusa el writer ya resuelto** (W-1) en vez de re-derivarlo. El guard de "corrida acotada" exceptúa `fromR2` (ya acotado por el envelope).

**Task 3 (`feat(66-01)` `31f3267`):** `cobertura.ts` + `cobertura.test.ts` + wire del CLI de operador:
- `reportarCobertura(client, dipidsMaestra)` → `{ porEstado, dipidsMaestraNoConfirmados }`. `porEstado` por head+count por estado (sin materializar filas). El invariante cuenta `no_confirmado` cuyo `fuente_voter_id` está en la maestra vigente (por `.in()` en lotes) — DEBE ser 0. NUNCA name-match.
- `run-votos-masivo-cli.ts` (W-2): construye un `R2Store` real de `.env R2_*` y lo threadea; `--from-r2` reenviado a `runCamaraVotos`; loguea destino LOCAL/REMOTO (Pitfall 5); tras una corrida con writer real imprime la cobertura y alerta ruidoso si el invariante se rompe.

## Verification Results

- `pnpm --filter @obs/votos test` — **26 pass** (run-camara-votos 8, cobertura 4, golden-dipid 14).
- `pnpm --filter @obs/votos typecheck` — **verde** (`tsc -b`).
- `pnpm --filter @obs/tramitacion test` — **147 pass**, sin regresión al reconciliador/parser compartido.
- `git diff` **VACÍO** en `reconciliar-camara.ts`, `parse-camara-votacion.ts`, `golden-dipid.ts`, y `supabase/migrations/*`.
- Grep de aceptación: `r2Store` en RunCamaraVotosOpts y en la llamada a runIngest; `fromR2` con getObject + conectores fake; `--from-r2` reenviado en el CLI; `estado_vinculo` en cobertura.ts; `putImmutable` en el test.

## Plan-Check Warnings Honored (los 3 que son el punto de la fase)

- **W-1** — el bloque `--from-r2` de `runCamaraVotos` REUSA el `writer` resuelto arriba; no re-deriva uno como `ingest-cli.ts`. La copia VERBATIM aplicó solo al envelope+fakes shape.
- **W-2** — `run-votos-masivo-cli.ts` ahora **construye un `R2Store` de `.env R2_*`** y lo threadea; el `--from-r2` ya no es inerte. Acceptance: construcción + threading, no solo grep del flag.
- **W-3** — el camino NORMAL (no replay) threadea `r2Store` real → Etapa 1 se ejecuta; Test A prueba `putImmutable` ANTES del upsert de Supabase por orden de captura.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@obs/votos` no resolvía `@supabase/supabase-js` para el type de `SupabaseClient`**
- **Found during:** Task 3 (typecheck de cobertura.ts)
- **Issue:** `cobertura.ts` importa `type SupabaseClient` de `@supabase/supabase-js`; el paquete llegaba solo transitivamente vía `@obs/tramitacion`, así que `tsc -b` fallaba con TS2307.
- **Fix:** Se añadió `@supabase/supabase-js@^2.108.2` (misma versión pinneada por `@obs/tramitacion`/`@obs/identity`) como dep directa de `@obs/votos` y se regeneró el lockfile OFFLINE (`pnpm install --offline`, 0 descargas — ya cacheado en el store). NO es un paquete externo nuevo: ya vive en el monorepo. No hubo checkpoint de legitimidad (Package Legitimacy no aplica: RESEARCH §Package Legitimacy Audit).
- **Files modified:** packages/votos/package.json, pnpm-lock.yaml
- **Commit:** 31f3267

## Known Stubs

None — el wire threadea símbolos reales; los fakes viven solo en los tests. El backfill LIVE + write remoto (que consume este wire) es Wave 2, operador-LOCAL (Plan 02), fuera de alcance.

## Threat Flags

Ninguno. El wire NO introduce superficie de seguridad nueva: no toca el reconciliador (grep-gate `git diff` vacío), no fabrica endpoints, no toca RUT/PII (votos = DIPID público + nombre público), y `--from-r2` reduce la superficie de red (0 fetch a la fuente en replay). Los mitigate del threat register (T-66-01..04) se preservan.

## Self-Check: PASSED

- FOUND: packages/votos/src/cobertura.ts
- FOUND: packages/votos/src/cobertura.test.ts
- FOUND commit ac7db1a (test RED)
- FOUND commit 76badba (feat wire)
- FOUND commit 31f3267 (feat cobertura + CLI)
