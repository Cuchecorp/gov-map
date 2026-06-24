---
phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default
plan: 04
subsystem: database
tags: [postgres, apply-remoto, pgtap, rls, deny-by-default, pg_cron, cruces, lobby, live, CRUCE-03]

# Dependency graph
requires:
  - phase: 36-01
    provides: "0038/0039/0040 + 3 suites pgTAP (escritas, no aplicadas)"
  - phase: 36-03
    provides: "clasificar-lobby-cli (MiniMax) + writer-supabase service-role + golden gate"
provides:
  - "0038/0039/0040 APLICADAS al Supabase remoto PROD + registradas en schema_migrations"
  - "cruce_senal poblada LIVE (30 señales lobby_sector / 24 parlamentarios distintos / 10 sectores)"
  - "Deny-by-default REAL en el canal de lectura (RPC sin EXECUTE a anon/authenticated)"
affects: [37-superficie-cruces, 39-legal-signoff, 40-rut-aporte]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deny-by-default de FUNCIONES = revoke from public + revoke from anon,authenticated (default privileges de Supabase conceden EXECUTE a anon en cada función nueva de public)"
    - "Apply remoto por psql --db-url --single-transaction -v ON_ERROR_STOP=1 en orden + fila manual en supabase_migrations.schema_migrations (NUNCA db push)"
    - "Golden LIVE gate (cobertura ≥0.7 + cero errores) ANTES de poblar sector_id en PROD"

key-files:
  created:
    - .planning/phases/36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default/36-04-SUMMARY.md
  modified:
    - supabase/migrations/0040_cruces_rpc.sql
    - supabase/tests/0039_cruce_senal.test.sql

key-decisions:
  - "[Rule 2 — seguridad] 0040 debe revocar EXECUTE de anon,authenticated (no solo de public): Supabase concede EXECUTE por DEFAULT PRIVILEGES a anon en cada función nueva — el pgTAP lo cazó en PROD"
  - "[Rule 1 — bug de test] 0039 test plan(11)→plan(10): off-by-one en el conteo (10 asserts reales), no fallo de DDL"
  - "Batch LIVE acotado a 60 contrapartes (34 con sector / 26 abstención) — suficiente para 24 parlamentarios distintos, muy por encima del gate ≥5"

requirements-completed: [CRUCE-01, CRUCE-02, CRUCE-03]

# Metrics
duration: ~25min
completed: 2026-06-24
---

# Phase 36 Plan 04: Apply remoto + corrida LIVE de cruces (CRUCE-03) Summary

**Las tres migraciones de cruces (0038 sector / 0039 cruce_senal + materializar / 0040 RPC) aplicadas al Supabase remoto PROD por `psql --db-url`, registradas en schema_migrations, con pgTAP verde contra el DB aplicado y cero regresión en las 6 suites previas. La corrida LIVE clasificó contrapartes de lobby con MiniMax (golden gate LIVE previo: cobertura 1.000) → pobló `lobby_contraparte.sector_id` → `materializar_cruces()` → `cruce_senal` con 30 señales lobby-puras para 24 parlamentarios distintos (CRUCE-03 ≥5). Deny-by-default confirmado por probe anon-key (tabla y RPC = 42501).**

## Performance
- **Duration:** ~25 min
- **Completed:** 2026-06-24
- **Tasks:** 2 (ambos checkpoint:human-action — ejecutados bajo autorización explícita del operador)
- **Files modified:** 2 (forward-fix de 0040 + plan-count de 0039) + 1 SUMMARY

## Task 1 — Aplicar 0038/0039/0040 al remoto + pgTAP verde

### Apply
- PROD verificado en 0037 antes de aplicar; `sector` y `cruce_senal` no existían; `pgtap` y `pg_cron` instalados.
- Aplicadas EN ORDEN por `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f <mig>` (NUNCA `db push`):
  - **0038**: `CREATE TABLE sector` + `INSERT 0 13` (13 sectores) + policy public-read + grant anon + 3 `ALTER TABLE … ADD sector_id`.
  - **0039**: `CREATE TABLE cruce_senal` + `REVOKE` + 2 índices + `CREATE SCHEMA cruces` + `CREATE FUNCTION materializar_cruces` + 2 `DO` (cron schedule + assertion post-migración).
  - **0040**: `CREATE FUNCTION cruces_de_parlamentario` + `REVOKE`.
- Registradas 3 filas en `supabase_migrations.schema_migrations` (0038/0039/0040) — `INSERT 0 3` verificado.

### pgTAP contra el DB aplicado (verde)
| Suite | Asserts | Resultado |
|-------|---------|-----------|
| 0038_sector | 11/11 | ok |
| 0039_cruce_senal | 10/10 | ok (tras fix plan-count) |
| 0040_cruces_rpc | 4/4 | ok (tras fix revoke anon/authenticated) |

### Cero regresión en suites previas
| Suite | ok | not ok |
|-------|----|--------|
| 0021_lobby | 19 | 0 |
| 0030_net | 17 | 0 |
| 0034_entidad_tercero | 26 | 0 |
| 0035_vinculo_entidad | 18 | 0 |
| 0036_entidad_fk | 15 | 0 |
| 0037_resolver_entidad_audit_fix | 12 | 0 |

### Probe deny-by-default (anon key, REST)
- `GET /rest/v1/cruce_senal` → **401 / 42501** permission denied.
- `POST /rest/v1/rpc/cruces_de_parlamentario` → **401 / 42501** permission denied.
- `GET /rest/v1/sector` (catálogo público) → **200** (correcto, public-read por diseño).

### Cron
- `cron.job` con `cruces-materializar` schedule `23 3 * * *`, count=1.

## Task 2 — Clasificación LIVE + materializar → CRUCE-03

### Golden LIVE gate (compuerta de calidad ANTES de poblar PROD)
- `CRUCES_GOLDEN_LIVE=1` con DeepSeek + MiniMax reales (testTimeout 120s):
  - **cobertura=1.000, correctos=10, noCubiertos=0, errores=0 → gate PASA**.

### Corrida LIVE
- `clasificar-lobby-cli --limite 60` con `--service-key` real (MINIMAX_API_KEY presente) — modo LIVE/dbLoaded=true.
- Resultado: **60 procesados / 34 con sector / 26 abstención** (cobertura muestra 60%).
- De las 34 clasificadas, **32 ligan audiencia confirmada con parlamentario, abarcando 24 parlamentarios distintos**.
- `select cruces.materializar_cruces();` ejecutado (FULL REBUILD).

### CRUCE-03 verificado (cita PROD)
```
 distinct_parls | total_senales
----------------+---------------
             24 |            30
```
**24 parlamentarios distintos ≥ 5** (gate satisfecho con holgura).

Desglose por sector (`select sector_id, count(*) senales, sum(conteo) reuniones from cruce_senal group by 1`):
```
 medio_ambiente       | 8 | 9
 comercio_industria   | 7 | 7
 mineria_energia      | 3 | 3
 vivienda_urbanismo   | 2 | 3
 agricultura_pesca    | 2 | 2
 gremios_trabajadores | 2 | 2
 educacion            | 2 | 2
 salud                | 2 | 2
 banca_finanzas       | 1 | 1
 transporte           | 1 | 1
```

### Evidencia lobby-pura + trazable
- Tipos de item presentes: SOLO `reunion` (cero aporte).
- Items sin `enlace_fuente`: **0**.
- `tipo_senal` presentes: SOLO `lobby_sector`.
- Cada item lleva `enlace_fuente` (ej. `https://www.camara.cl/transparencia/listadodeaudiencias.aspx`) — FND-08.
- Filas con `rut`/`partido` en la evidencia: **0** (no-PII, LEGAL-03).

### Deny-by-default POST-populate (anon key)
- Con datos reales presentes: `cruce_senal` → 401/42501; RPC → 401/42501. CERO grant a anon (Phase 39 lo enciende, no este plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Seguridad/deny-by-default] El RPC concedía EXECUTE a anon/authenticated**
- **Found during:** Task 1 (pgTAP 0040, assert 3 `not ok`).
- **Issue:** 0040 sólo hacía `revoke execute … from public`. Supabase concede EXECUTE por `ALTER DEFAULT PRIVILEGES` a `anon` y `authenticated` sobre CADA función nueva de `public`; el revoke from public no toca esos grants de rol → anon TENÍA EXECUTE (`has_function_privilege('anon', …)` = true). Sin el fix, el canal de lectura habría quedado abierto a pesar del "deny-by-default" del plan (viola T-36-13). Es la misma lección de tablas de Phase 11/0021, ahora aplicada a funciones.
- **Fix:** añadido `revoke execute on function public.cruces_de_parlamentario(text) from anon, authenticated;` al migration (espejo del `revoke all from anon, authenticated` de la tabla en 0039). Aplicado a PROD; re-verificado `anon=false authenticated=false service_role=true`; pgTAP 0040 4/4; probe anon-key 42501.
- **Files modified:** supabase/migrations/0040_cruces_rpc.sql
- **Commit:** 9f3139a

**2. [Rule 1 - Bug de test] 0039 pgTAP plan-count off-by-one**
- **Found during:** Task 1 (pgTAP 0039: "planned 11 tests but ran 10").
- **Issue:** `select plan(11)` pero el archivo tiene 10 aserciones reales (las 10 corrieron y pasaron). Conteo equivocado, no fallo de DDL.
- **Fix:** `plan(11)` → `plan(10)`. Re-corrido: 10/10 ok.
- **Files modified:** supabase/tests/0039_cruce_senal.test.sql
- **Commit:** 9f3139a

**3. [Rule 3 - Blocking de config] Golden LIVE timeout por defecto (5s)**
- **Found during:** Task 2 (golden LIVE).
- **Issue:** el bloque LIVE hace 20 llamadas reales (10 DeepSeek + 10 MiniMax); el testTimeout default de vitest (5000ms) abortaba el gate.
- **Fix:** re-corrido con `--testTimeout=120000` (sólo flag de ejecución, sin tocar código). Gate PASA (cobertura 1.000). No se persiste cambio de config (decisión: el gate LIVE es manual/gated, no CI).
- **Files modified:** ninguno (flag de invocación).

## Threat Flags
Ninguno nuevo. T-36-13 (anon read post-apply) reforzado por el Rule 2 fix; T-36-12 (apply path) ejecutado verbatim; T-36-14 (grant prematuro) respetado (cero grant a anon).

## Self-Check: PASSED
