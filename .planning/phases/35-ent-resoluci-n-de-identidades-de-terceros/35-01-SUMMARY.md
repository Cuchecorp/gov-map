---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
plan: 01
subsystem: identidad-terceros-db
status: checkpoint-pending
tags: [ddl, migration, pgtap, rls, entity-resolution, terceros]
requires: [parlamentario, vinculo_identidad, identidad_audit, lobby_contraparte, contratista]
provides: [entidad_tercero, entidad_tercero_alias, entidad_id_seq, vinculo_entidad, revision_entidad, resolver_entidad, identidad_audit.tipo_entidad]
affects: [lobby_contraparte, contratista, identidad_audit]
tech-stack:
  added: []
  patterns: [rls-deny-by-default, trigger-coercion-silenciosa, trigger-raise-anti-demotion, indice-unico-total-onconflict, rpc-transaccional-firma-exacta, defensa-en-db]
key-files:
  created:
    - supabase/migrations/0034_entidad_tercero.sql
    - supabase/migrations/0035_vinculo_entidad.sql
    - supabase/migrations/0036_entidad_fk.sql
    - supabase/tests/0034_entidad_tercero.test.sql
    - supabase/tests/0035_vinculo_entidad.test.sql
    - supabase/tests/0036_entidad_fk.test.sql
  modified: []
decisions:
  - "id estable por sequence DB (entidad_id_seq, 'E00001'), no logica TS (LOCKED)"
  - "clave natural de vinculo_entidad = (tipo_entidad, mencion_normalizada), indice unico TOTAL (Open Question 1 resuelta)"
  - "Δ2 defensa-en-DB incluida: juridica solo confirma por metodo determinista, RAISE en la guarda (Open Question 2 resuelta)"
  - "identidad_audit se REUSA con columna tipo_entidad (no se crea entidad_audit; A3)"
  - "donante.entidad_id DIFERIDO a Phase 36 (A2)"
metrics:
  duration: ~14min
  tasks_completed: 3
  tasks_total: 4
  files: 6
  completed_date: 2026-06-24
---

# Phase 35 Plan 01: Maestra de terceros (entidad_tercero) — Summary

DDL + pgTAP del subsistema de identidad de terceros (entidad_tercero) ESPEJANDO el de parlamentario (0005/0006/0007/0012/0015) con las tres piezas nuevas Δ1 (discriminador tipo_entidad), Δ2 (defensa-en-DB juridica-solo-RUT-determinista) y Δ3 (cablear los FK lobby_contraparte/contratista). Tareas 1-3 (3 migraciones + 3 pgTAP) escritas, verificadas localmente por grep y commiteadas. Task 4 = checkpoint de OPERADOR (apply remoto PROD) — NO ejecutado por el agente.

## Estado: CHECKPOINT PENDIENTE (Task 4 = human-action, gate=blocking-human)

Las migraciones 0034/0035/0036 + sus pgTAP estan listas y verificadas localmente. NO aplicadas al remoto PROD por el agente (la ultima migracion en PROD sigue siendo 0033). El apply al remoto es checkpoint de operador, LOCKED: DDL SOLO por `psql --single-transaction`, NUNCA `supabase db push`.

## Tareas completadas

| Task | Nombre | Commit | Archivos |
| ---- | ------ | ------ | -------- |
| 1 | 0034 entidad_tercero maestra + alias + sequence + trigger COERCION + RLS deny | f12691b | supabase/migrations/0034_entidad_tercero.sql, supabase/tests/0034_entidad_tercero.test.sql |
| 2 | 0035 vinculo_entidad + revision_entidad + guardas RAISE + Δ2 + indice unico TOTAL | 80ac800 | supabase/migrations/0035_vinculo_entidad.sql, supabase/tests/0035_vinculo_entidad.test.sql |
| 3 | 0036 FK lobby/contratista + identidad_audit.tipo_entidad + RPC resolver_entidad | 80bbc9d | supabase/migrations/0036_entidad_fk.sql, supabase/tests/0036_entidad_fk.test.sql |
| 4 | CHECKPOINT OPERADOR — aplicar 0034/0035/0036 al remoto PROD + pgTAP verde | — | (pendiente, no ejecutado por el agente) |

## Que se construyo

**0034 entidad_tercero** (maestra): `entidad_id_seq` (id estable `'E'||lpad(nextval,5)`), columna Δ1 `tipo_entidad` CHECK ('natural'|'juridica'), `rut` nullable, `estado` default 'no_confirmado', provenance NOT NULL, indice unico parcial sobre rut, `entidad_tercero_alias` (espejo VERBATIM 0005), RLS deny-by-default + revoke anon/authenticated en ambas tablas, trigger `entidad_tercero_estado_no_regresa` COERCION silenciosa (espejo 0012, NO RAISE).

**0035 vinculo_entidad + revision_entidad**: `vinculo_entidad` con Δ1 tipo_entidad como clave de blocking; indice unico **TOTAL** `vinculo_entidad_clave_natural (tipo_entidad, mencion_normalizada)` (Pitfall 6); `revision_entidad` cola humana (candidatos jsonb SIN rut); guardas RAISE espejo 0007 (no degradar/reapuntar confirmado, promover solo humano/determinista con entidad); Δ2 defensa-en-DB (juridica solo confirma por determinista, RAISE); force RLS + deny-by-default + revoke en ambas. identidad_audit se REUSA (no se recrean sus guardas).

**0036 FK + RPC**: Δ3 FK `lobby_contraparte.contraparte_id -> entidad_tercero(id)`, columna `contratista.entidad_id`, columna `identidad_audit.tipo_entidad`; RPC `resolver_entidad` (10 params, +p_tipo_entidad) transaccional espejo 0015; `on conflict (tipo_entidad, mencion_normalizada)` coincide byte-a-byte con el indice de 0035; grants firma-exacta de 10 tipos (revoke public/anon/authenticated, grant service_role — Pitfall 5).

## Verificacion local (greps por task)

- Task 1: `create table entidad_tercero`=2, `tipo_entidad in ('natural','juridica')`=1, `revoke all on entidad_tercero ... from anon, authenticated`=1, `create sequence entidad_id_seq`=1. VERDE.
- Task 2: `create table vinculo_entidad`=1, `create table revision_entidad`=1, `vinculo_entidad_clave_natural`=1, `force row level security`=2, `raise`=8. VERDE.
- Task 3: `references entidad_tercero(id)`=2, `add column tipo_entidad text`=1, `function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text)`=4, `on conflict (tipo_entidad, mencion_normalizada)`=2. VERDE.
- Invariante cross-cutting: la clave natural `(tipo_entidad, mencion_normalizada)` aparece IDENTICA en el indice unico TOTAL de 0035 (L50) y el on conflict del RPC de 0036 (L75).

> NOTA: pgTAP es la UNICA prueba valida de las migraciones (build/typecheck dan falso positivo; Postgres no ejecuto el DDL). Los pgTAP corren en el checkpoint de operador contra el schema aplicado. La verificacion del agente es por grep estructural, como manda el plan.

## Decisiones (Open Questions resueltas)

- **Open Question 1 (clave natural):** `(tipo_entidad, mencion_normalizada)` con indice unico TOTAL (no parcial), coincidente byte-a-byte con el onConflict del writer (Plan 03) y el on conflict del RPC. De esto depende ENT-05 "2da corrida = 0 nuevos".
- **Open Question 2 (defensa-en-DB juridica):** INCLUIDA. La guarda RAISE impide confirmar `tipo_entidad='juridica'` por metodo != determinista (defensa en profundidad coherente con 0024).
- **A3:** identidad_audit se reusa con columna `tipo_entidad` (no se crea entidad_audit).
- **A2:** donante.entidad_id se difiere a Phase 36 (no se anade en 0036).

## Deviations from Plan

None - plan ejecutado exactamente como fue escrito. Ajustes de formato menores (espaciado del CHECK de tipo_entidad y de la firma del RPC) para que coincidan byte-a-byte con los greps de verificacion del plan; no cambian la semantica SQL.

## Known Stubs

None. Las 6 piezas DDL/pgTAP estan completas; el unico estado "pendiente" es el apply remoto, que por diseno LOCKED es checkpoint de operador (no un stub de codigo).

## CHECKPOINT REACHED

**Type:** human-action (gate=blocking-human)
**Plan:** 35-01
**Progress:** 3/4 tasks complete

### Checkpoint Details — Task 4: aplicar 0034/0035/0036 al remoto PROD

El agente NO aplica DDL al remoto. El operador, como needs-human:

1. Extraer `SUPABASE_DB_URL` (esquivar BOM U+FEFF si aplica, helper de Phases 9-12).
2. Aplicar en orden, cada una en su propia transaccion atomica (NUNCA `supabase db push`):
   - `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0034_entidad_tercero.sql`
   - `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0035_vinculo_entidad.sql`
   - `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0036_entidad_fk.sql`
3. Registrar las 3 filas (0034/0035/0036) en schema_migrations (patron de applies previos).
4. Correr los 3 pgTAP contra el schema aplicado:
   - `psql "$SUPABASE_DB_URL" -f supabase/tests/0034_entidad_tercero.test.sql`
   - `psql "$SUPABASE_DB_URL" -f supabase/tests/0035_vinculo_entidad.test.sql`
   - `psql "$SUPABASE_DB_URL" -f supabase/tests/0036_entidad_fk.test.sql`
   Confirmar 0 fallos en los tres + sin regresion en 0018/0021/0022/0023/0024 si se corren.
5. Probe deny-by-default: con la anon key, `select * from entidad_tercero limit 1` debe dar permission denied.

### Awaiting

Operador escribe "pgTAP verde" cuando las 3 migraciones esten aplicadas + pgTAP 0034/0035/0036 sin fallos + probe anon permission-denied confirmado. Si algo falla, describir el error.

## Self-Check: PASSED

- Archivos creados (7/7): 3 migraciones + 3 pgTAP + SUMMARY — todos FOUND en disco.
- Commits (3/3): f12691b, 80ac800, 80bbc9d — todos FOUND en git log.
