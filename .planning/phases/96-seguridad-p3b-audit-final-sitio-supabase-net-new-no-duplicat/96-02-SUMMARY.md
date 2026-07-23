---
phase: 96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat
plan: "02"
subsystem: database-security-audit
tags: [security, database, supabase, rls, allowlist, pgvector, audit, golden-gate]
requirements_completed: [SEC-03]
dependency_graph:
  requires: [96-01]
  provides: [96-AUDIT-DB-VIVA.md]
  affects: [96-03-PLAN.md (operator-handoff)]
tech_stack:
  patterns: [psql-read-only-idiom, pg-depend-filter, golden-gate-verification]
key_files:
  created:
    - .planning/phases/96-seguridad-p3b-audit-final-sitio-supabase-net-new-no-duplicat/96-AUDIT-DB-VIVA.md
  modified: []
decisions:
  - "pgvector 0.8.0 vivo, >=0.8.2 no disponible en plataforma Supabase gestionada: handoff de operador (platform upgrade), NO alter extension"
  - "CVE-2026-3172 exposición práctica baja: 0 funciones anon-executable confirmadas con filtro pg_depend"
  - "Allowlist 26 en sync con 25 secdef vivos: 2 inertes-por-diseño (68-03) documentadas, cero drift no-explicado"
metrics:
  duration: "~15 min"
  completed: 2026-07-23
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 96 Plan 02: DB Viva Audit Summary

**One-liner:** Auditoría read-only de PROD contra pg_proc/pg_class/pg_policy con filtro pg_depend: 0 offenders de app en los 4 checks, allowlist en sync (2 secdef inertes-por-diseño documentadas), pgvector 0.8.0 → handoff operador, golden gates de identidad verdes (1263 tests, 0 fallos).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Grants/RLS/allowlist sobre la DB VIVA | e9a5e97 | 96-AUDIT-DB-VIVA.md (checks 1-3+Splinter) |
| 2 | pgvector version + golden gates de identidad | 0828bb3 | 96-AUDIT-DB-VIVA.md (secciones 4-5) |

## Audit Results

### 4 Checks de App (con filtro pg_depend deptype='e')

| Check | Resultado | Estado |
|-------|-----------|--------|
| Funciones public EXECUTABLE por anon | 0 | VERDE |
| Tablas de app con grant a anon/authenticated | 0 | VERDE |
| Tablas public con RLS deshabilitada | 0 | VERDE |
| Policies `to anon` en public | 0 | VERDE |

Sin filtro pg_depend el ruido pgTAP daría 1201 funciones + 28 grants — todos falsos positivos de pgTAP.

### Allowlist Drift

25 secdef vivos de app cruzados contra 26 entradas de PUBLIC_RPC_ALLOWLIST:
- 23 en allowlist Y secdef vivas: OK
- 2 en allowlist pero INVOKER (`buscar_citaciones`, `match_proyectos`): OK, legítimas
- 2 secdef vivas NO en allowlist (`rebeldias_de_parlamentario`, `tasa_ausencia_comparada`): inertes-por-diseño (68-03, carril de voto podado), anon-executable=0

Cero drift no-explicado.

### Splinter

- search_path: todas las 25 secdef usan `search_path=""` (bloqueado, patrón seguro)
- Tablas sin PK: 0

### pgvector

- Versión viva: 0.8.0
- default_version disponible: 0.8.0 (plataforma gestionada topa aquí)
- CVE-2026-3172: gap real pero exposición práctica baja (0 funciones anon-executable)
- Acción: **handoff de operador** — platform upgrade en Supabase dashboard. Cero DDL.

### Golden Gates

`pnpm -r --filter "./packages/*" test`: **150 test files / 1263 tests verdes / 0 fallos / 7 skipped deliberados**

| Golden Gate | Tests Verdes |
|-------------|-------------|
| packages/adjudication (golden-set identidad) | 89 |
| packages/cruces (golden-set cruces) | 33 |
| packages/votos (gate DIPID determinista) | 14 de 31 total votos |
| Resto de packages (tramitacion/dinero/lobby/etc.) | 1087 |

## Deviations from Plan

None — plan executed exactly as written. Las queries verbatim del research se re-corrieron contra PROD y los resultados coincidieron con lo esperado (0/0/0/0 checks de app, 25 secdef, 0.8.0 pgvector).

La query Splinter de search_path que el plan mencionaba resultó en que el chequeo con `@> ARRAY['search_path=public']` devuelve las 25 funciones (porque usan `search_path=""`, no `search_path=public`). Se verificó el valor real de `proconfig` y se confirmó que `search_path=""` ES el patrón seguro recomendado — se documentó como VERDE con la explicación en el reporte, no como offender.

## Known Stubs

Ninguno. El reporte de auditoría refleja el estado real de la DB viva.

## Threat Flags

Ninguno — no se introdujeron nuevas superficies de red, endpoints ni cambios de schema. Plan puramente documental/audit.

## Self-Check: PASSED

- 96-AUDIT-DB-VIVA.md existe: FOUND
- Commit e9a5e97 existe: FOUND
- Commit 0828bb3 existe: FOUND
- grep pg_depend en 96-AUDIT-DB-VIVA.md: 10 ocurrencias
- grep postgresql:// (connection string): 0 — OK
