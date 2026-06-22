---
phase: 23-ops-aplicar-migraciones-remotas-pendientes-pgtap-verde
plan: 01
subsystem: ops
tags: [supabase, remoto, psql, db-url, pgtap, rpc, migraciones, 0026, 0028, 0030, net, votos-instructivos, parlamentarios-publico]

# Dependency graph
requires:
  - phase: 22 (v2.0)
    provides: "migraciones 0026/0028/0030 escritas en supabase/migrations; pgTAP 0027/0029/0030 escritos"
provides:
  - "remoto sa-east-1 con 0026/0028/0030 APLICADAS y verificadas por introspección"
  - "pgTAP verde contra el schema aplicado: 0027 (7/7), 0029 (8/8), 0030 (17/17)"
  - "RPC públicas probadas en vivo como anon: parlamentarios_publico()=186, votos_de_parlamentario=17 cols, subgrafo_red(NET1,1) no-null"
  - "fix del test 0030_net.test.sql (aserción correcta de deny-by-default + plan count)"
affects: [Phase 24-28 (data visible), Phase 32 (verificación final)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aplicar/verificar DDL remoto por psql --db-url DIRECTO (BOM en .env → extraer URL con node), NUNCA supabase db push (drift schema_migrations ≤0025)"
    - "pgTAP contra remoto con psql -tA -f (pgtap ya instalado); RPC probadas con set role anon (canal público real)"
    - "Deny-by-default con revoke all from anon → un SELECT directo de anon LANZA 42501 (insufficient_privilege), no devuelve 0 filas → la aserción correcta es throws_ok(42501), no is_empty"

key-files:
  created:
    - .planning/phases/23-ops-aplicar-migraciones-remotas-pendientes-pgtap-verde/23-CONTEXT.md
    - .planning/phases/23-ops-aplicar-migraciones-remotas-pendientes-pgtap-verde/23-SUMMARY.md
  modified:
    - supabase/tests/0030_net.test.sql
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Las tres migraciones ya estaban aplicadas al remoto (verificado por to_regprocedure/to_regclass/information_schema): Phase 23 fue verificación + corrección de test, no aplicación de DDL nuevo"
  - "Bug latente en 0030_net.test.sql: las dos aserciones de deny-by-default usaban is_empty (asume RLS-filtra-a-vacío), pero el piso real es revoke all from anon → anon recibe permission denied (42501) que abortaba la transacción. Corregido a throws_ok('42501') — la garantía más fuerte. Mismo patrón que el retarget de 0023 (money gate)"
  - "Plan count off-by-one preexistente en 0030: se corrían 17 aserciones con plan(16). Corregido a plan(17)"
  - "subgrafo_red existe con firma completa (text,integer,text[],timestamptz,timestamptz) y es invocable por anon devolviendo no-null; entidad/arista vacías (0 filas) es el estado correcto: aún no hay lobby confirmado que materialice aristas (se resuelve en Phase 25)"

# Metrics
metrics:
  duration: ~15min
  completed: 2026-06-22
---

# Phase 23 Plan 01: OPS — Aplicar migraciones remotas pendientes + pgTAP verde Summary

Precondición dura de v3.0: confirmar que el Supabase remoto (sa-east-1) tiene las
migraciones 0026/0028/0030 aplicadas, dejar el pgTAP verde sin regresión y probar las
RPC públicas en vivo. La investigación inline reveló que las tres migraciones YA
estaban aplicadas al remoto; el único trabajo de código fue corregir un bug latente
en el test pgTAP de NET.

## What was verified / built

- **Introspección del remoto** (vía `psql --db-url`, URL extraída de `.env` con strip de BOM):
  - `0026` → `public.parlamentarios_publico()` existe ✓
  - `0028` → `public.votos_de_parlamentario(text,int,int)` existe con el `returns table` de
    **17 columnas** (9 originales + titulo, idea_matriz, resultado, total_si, total_no,
    total_abstencion, total_pareo, quorum) ✓
  - `0030` → schema `grafo` ✓, tablas `entidad`/`arista` ✓ (RLS on + revoke all from anon),
    `grafo.materializar_aristas()` ✓, `subgrafo_red(text,integer,text[],timestamptz,timestamptz)` ✓
- **pgTAP verde** contra el schema aplicado:
  - `0027_parlamentarios_publico_listado.test.sql` → **7/7**
  - `0029_votos_instructivos.test.sql` → **8/8**
  - `0030_net.test.sql` → **17/17** (tras el fix)
- **RPC probadas EN VIVO como `anon`**:
  - `parlamentarios_publico()` → **186** filas
  - `votos_de_parlamentario` → 17 columnas
  - `subgrafo_red('NET1',1)` → no-null (canal público funciona; entidad/arista directos
    deniegan a anon con 42501, correcto)

## Fix aplicado (deviación: bug latente encontrado)

`supabase/tests/0030_net.test.sql`:
1. Las dos aserciones "anon NO lee entidad/arista directamente" usaban `is_empty(...)`,
   que ejecuta el query como anon y —al haber `revoke all from anon`— recibe
   `permission denied` (SQLSTATE 42501), abortando la transacción y tumbando el resto del
   archivo. Corregidas a `throws_ok($$...$$, '42501', null, ...)` — la aserción correcta
   para deny-by-default por revoke (la garantía más fuerte). Espeja el patrón del retarget
   de `0023_money_gate.test.sql`.
2. `plan(16)` → `plan(17)`: el archivo siempre corrió 17 aserciones (off-by-one preexistente).

## Sign-off / operador

Ninguno pendiente — fase de verificación OPS completada autónomamente. El estado de
`entidad`/`arista` vacías es correcto y se resolverá cuando Phase 25 adjudique identidad
de lobby (materializa aristas).

## Self-Check: PASSED
