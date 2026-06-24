---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 02
subsystem: "@obs/identity — núcleo TS puro del matcher de terceros"
tags: [identity, entity-resolution, fail-closed, branded-type, idempotent-backfill, ENT-02, ENT-05]
requires:
  - "packages/identity/src/deterministic.ts (normRut — reusado, DV módulo-11 no reimplementado)"
  - "packages/identity/src/enlace-confirmado.ts (PATRÓN del branded type, no el tipo)"
  - "packages/identity/src/seeder.ts / writer-supabase.ts / backup.ts (moldes de espejo)"
provides:
  - "matchDeterministaEntidad (fail-closed, Δ1 unicidad-por-tipo + Δ2 jurídica-solo-RUT)"
  - "EnlaceEntidadConfirmado branded + confirmarEntidad factory (FK tipado de terceros)"
  - "upsertEntidades / SupabaseEntidadWriter (seeder idempotente, nunca auto-confirma)"
  - "exportMaestraEntidad (custodia JSON determinista byte-a-byte)"
  - "runBackfillEntidad (CLI LOCAL: matcher → seeder → custodia)"
affects:
  - "Plan 03 (pipeline-entidad): consume matchDeterministaEntidad + razón juridica-sin-rut para saltar el LLM"
  - "Plan 04 (reconciliadores): tipan el FK de tercero como EnlaceEntidadConfirmado | null"
tech-stack:
  added: []
  patterns:
    - "branded type con unique symbol privado propio (no exportado, grep-gate)"
    - "matcher puro fail-closed con rama discriminada por tipo_entidad"
    - "idempotencia por clave natural en el upsert (2ª corrida = 0 nuevos)"
    - "export JSON determinista (orden por id + claves alfabéticas) para custodia en git"
    - "loadEnv BOM-safe con precedencia process.env (CLI LOCAL de operador)"
key-files:
  created:
    - packages/identity/src/deterministic-entidad.ts
    - packages/identity/src/deterministic-entidad.test.ts
    - packages/identity/src/enlace-entidad-confirmado.ts
    - packages/identity/src/enlace-entidad-confirmado.test-d.ts
    - packages/identity/src/seeder-entidad.ts
    - packages/identity/src/seeder-entidad.test.ts
    - packages/identity/src/writer-entidad-supabase.ts
    - packages/identity/src/writer-entidad-supabase.test.ts
    - packages/identity/src/backup-entidad.ts
    - packages/identity/src/backup-entidad.test.ts
    - packages/identity/src/backfill-entidad-cli.ts
  modified:
    - packages/identity/src/index.ts
decisions:
  - "EntidadTerceroRow/EntidadTercero/EntidadTerceroSeed se definen LOCALMENTE en @obs/identity (el tipo no existe aún en @obs/core; las migraciones 0034-0036 de Plan 01 todavía no se aplican). Subconjunto serializable alineado a las columnas planificadas de entidad_tercero."
  - "Clave natural del upsert = (tipo_entidad, nombre_normalizado) por defecto, alineada con la decisión LOCKED de Plan 01 (índice único TOTAL). RUT cuando no nulo se usa como clave de match preferente en el matcher."
  - "backup-entidad exporta SEED_PATH como SEED_PATH_ENTIDAD desde el barrel para no chocar con el SEED_PATH de parlamentario; SeedFileWriter/R2BackupTarget de terceros NO se re-exportan (estructuralmente idénticos a los de backup.ts; FsSeedFileWriter es compatible)."
  - "El plan pedía `pnpm build`; el paquete @obs/identity no tiene script build — el gate de compilación real es `typecheck` (tsc -b), que pasa limpio."
metrics:
  duration: ~10min
  completed: 2026-06-23
---

# Phase 35 Plan 02: Núcleo TS puro del matcher de terceros — Summary

Matcher determinista fail-closed de terceros (`matchDeterministaEntidad`) con la regla LOCKED jurídica-solo-RUT (Δ2) y unicidad-por-tipo (Δ1), branded type propio `EnlaceEntidadConfirmado`, seeder idempotente que nunca auto-confirma, export JSON determinista de custodia y CLI de backfill LOCAL — los CONTRATOS que Plan 03 (pipeline LLM) y Plan 04 (reconciliadores) implementan contra.

## What Was Built

- **Task 1 — matcher + branded type (66f4840):** `matchDeterministaEntidad` puro fail-closed. Rama jurídica PRIMERO (Δ2): `tipo_entidad === 'juridica'` solo confirma por RUT exacto único; sin RUT o RUT no único → `no_confirmado` razón `'juridica-sin-rut'` directo, sin tocar la rama nombre y sin habilitar el LLM aguas arriba. Rama natural: RUT-único o nombre-único-POR-TIPO (Δ1). Reusa `normRut` de `deterministic.ts` (no reimplementa el DV módulo-11). `EnlaceEntidadConfirmado` con `unique symbol` privado propio + factory `confirmarEntidad`; un string crudo al FK es error de compilación (test-d gate). 13 tests verdes (≥10), incluido el caso crítico jurídica-sin-rut y la unicidad-por-tipo.
- **Task 2 — seeder + writer (c804342):** `seeder-entidad` upsert idempotente por clave natural → ENT-05 "2ª corrida = 0 entidades nuevas"; `prepararSeed` fuerza `estado='no_confirmado'` (el seeder NUNCA auto-confirma). `SupabaseEntidadWriter` espeja `writer-supabase`: upsert por `(tipo_entidad, nombre_normalizado)`, `promoteToConfirmado` solo vía allow-list principiada, `[]` = no-op. 9 tests verdes.
- **Task 3 — custodia + backfill CLI (8db5673):** `exportMaestraEntidad` determinista byte-a-byte → `supabase/seeds/entidad_tercero.seed.json` (orden por id, claves alfabéticas, R2 gated default false). `backfill-entidad-cli` LOCAL idempotente/reanudable: `loadEnv` BOM-safe con fallback `process.env`, encadena matcher → seeder → custodia; `buildWriterFromEnv` cae a modo solo-custodia sin credenciales. 6 tests backup verdes.

## Verification

- `pnpm --filter @obs/identity test` → 110/110 verde (14 archivos), incluyendo `deterministic-entidad` (13), `seeder-entidad` (4, doble-corrida idempotente), `writer-entidad-supabase` (5, no-auto-confirma), `backup-entidad` (6, determinismo/orden/round-trip).
- `pnpm --filter @obs/identity typecheck` (tsc -b) → limpio. Compila el `enlace-entidad-confirmado.test-d.ts` (cada `@ts-expect-error` es un gate: string crudo / objeto-imitación al FK no compilan; el valor de la factory sí).
- grep-gate: `ENLACE_ENTIDAD_CONFIRMADO` NO aparece exportado en `index.ts` (0 ocurrencias).

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 3 - Blocking] El plan especifica `pnpm --filter @obs/identity build`; el paquete no tiene script `build`.**
- **Found during:** Task 3 verificación.
- **Issue:** `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` — `@obs/identity` solo define `test`, `typecheck` y `seed:live`.
- **Fix:** Usado `typecheck` (tsc -b) como gate de compilación equivalente (es lo que el resto del repo usa para verificar que el paquete compila). Pasa limpio.
- **Files modified:** ninguno (decisión de verificación).

**2. [Rule 3 - Blocking] El tipo `EntidadTercero*` no existe aún en `@obs/core`.**
- **Found during:** Task 1.
- **Issue:** Las migraciones 0034-0036 (Plan 01) no están aplicadas y `@obs/core` no expone un tipo de entidad de tercero.
- **Fix:** Definidos `EntidadTerceroRow` (matcher), `EntidadTerceroSeed` (seeder) y `EntidadTercero` (custodia) localmente en `@obs/identity`, como subconjuntos serializables alineados a las columnas planificadas de `entidad_tercero` (id, nombre_normalizado, tipo_entidad, rut nullable, estado, provenance). Coherente con la nota del RESEARCH/PATTERNS de que estos archivos copian el patrón, no un tipo central.
- **Files modified:** deterministic-entidad.ts, seeder-entidad.ts, backup-entidad.ts.

**3. [Rule 3 - Blocking] Colisión de nombres en el barrel (`SEED_PATH`, `SeedFileWriter`, `R2BackupTarget`).**
- **Found during:** Task 3 export.
- **Issue:** `backup.ts` ya exporta esos símbolos desde `index.ts`.
- **Fix:** Re-exportado `SEED_PATH` de terceros como `SEED_PATH_ENTIDAD`; `SeedFileWriter`/`R2BackupTarget` de terceros NO se re-exportan (son estructuralmente idénticos a los de `backup.ts`; `FsSeedFileWriter` es estructuralmente compatible). Los símbolos públicos nuevos (`exportMaestraEntidad`, `serializeMaestraEntidad`, `EntidadTercero`, `runBackfillEntidad`, etc.) salen con nombres distintos.
- **Files modified:** index.ts.

## Threat Surface

Las mitigaciones del threat register del plan quedaron implementadas en código:
- **T-35-06** (jurídica por nombre): `matchDeterministaEntidad` corta antes de la rama nombre para jurídicas → `juridica-sin-rut`; test #8 lo asierta.
- **T-35-07** (string crudo en el FK): `EnlaceEntidadConfirmado` branded, símbolo privado no exportado, test-d falla si un string crudo compila.
- **T-35-08** (DV mal validado): reusa `normRut` de `deterministic.ts`, no reimplementa el módulo-11.
- **T-35-09** (backfill duplica en 2ª corrida): idempotencia por clave natural; test de doble corrida = 0 nuevos.
- **T-35-SC** (deps npm nuevas): cero paquetes nuevos (todo con deps existentes de `@obs/identity`).

No se introdujo superficie de seguridad nueva fuera del threat_model (sin endpoints, sin DDL aplicado, sin canales públicos — todo TS puro consumido por Planes 03/04).

## Known Stubs

Ninguno que impida la meta del plan. `backfill-entidad-cli` no auto-dispara una corrida LIVE (entry-point solo reporta el modo de credenciales) por diseño: la fuente real de menciones la cabla Plan 04 y el operador ejercita el CLI; el núcleo idempotente (`runBackfillEntidad`) está testeado vía Task 2/3 y es inyectable.

## Self-Check: PASSED

- Archivos creados verificados en disco (11 nuevos + index.ts modificado).
- Commits verificados: 66f4840 (Task 1), c804342 (Task 2), 8db5673 (Task 3).
