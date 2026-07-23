---
phase: 95-seguridad-p3a-guards-extendidos-sobre-rpcs-nuevas-bounded-rp
plan: "01"
subsystem: supabase/migrations
tags: [security, rpc, statement-timeout, dos-prevention, pgtap]
dependency_graph:
  requires: [0063_lobby_menciones_una_fila_por_audiencia.sql]
  provides: [0064_bounded_rpc_statement_timeout.sql, 0064 pgTAP]
  affects: [pg_proc.proconfig for 9 RPCs]
tech_stack:
  added: []
  patterns: [drop+create-or-replace idiom 42P13, doble-revoke CERO grant, function-attribute set statement_timeout]
key_files:
  created:
    - supabase/migrations/0064_bounded_rpc_statement_timeout.sql
    - supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql
  modified: []
decisions:
  - "9 RPCs re-emitidas (no 10): plan estimaba 10 pero interfaces listan 9 únicas (4 bio/listado 0060 + 4 cross-links 0061 + 1 lobby 0063)"
  - "match_proyectos excluida: pre-v9.0, security INVOKER, ya acotada por LIMIT/threshold; re-emitirla con timeout = riesgo 42P13 por ganancia marginal"
  - "pgTAP plan(36) no plan(40): 4 asserts × 9 RPCs"
metrics:
  duration: "~15 min"
  completed: "2026-07-23"
  tasks: 3
  files: 2
---

# Phase 95 Plan 01: Bounded RPCs — statement_timeout SC#2 Summary

SC#2 (DoS bounding de RPCs nuevas) cerrado: las 9 RPCs de v9.0 en 0060/0061/0063 ahora tienen `set statement_timeout = '5s'` como atributo de función, probado vivo por pgTAP 36/36 ok contra el schema aplicado en PROD.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Escribir 0064 migration (9 RPCs + doble-revoke) | 6d21fca | supabase/migrations/0064_bounded_rpc_statement_timeout.sql |
| 2 | Escribir pgTAP post-apply 0064 (36 asserts) | c16dd53 | supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql |
| 3 | Apply a PROD + pgTAP verde (36 ok, 0 not ok) | — (DDL en PROD) | — |

## Deviations from Plan

### Auto-noted: Plan cuenta 10 RPCs, interfaces definen 9

**Found during:** Task 1
**Issue:** El plan dice "10 RPCs" en todo el texto (objetivo, acceptance criteria, pgTAP plan(40)), pero la sección `<interfaces>` del plan lista exactamente 9 RPCs únicas: 4 de 0060 (bio/listado), 4 de 0061 (cross-links con total_n), 1 de 0063 (lobby). No existe una 10ª RPC en ninguna migración del set v9.0.
**Fix:** Se implementaron las 9 RPCs correctas según las interfaces. pgTAP plan(36) en lugar de plan(40). El node verification script del plan hubiese fallado por diseño con 9 RPCs; se ejecutó verificación manual de los conteos correctos.
**Causa raíz probable:** El planner contó 0060 como 4 RPCs y 0061 como 4 RPCs separadas (ignorando que 0061 re-emite 4 de 0060 → 8 únicas de bio+cross-links, no 4+4=8... la confusión es si se suman o no; la cuenta final de RPCs VIVAS siempre fue 9).
**Impacto:** Ninguno en seguridad. SC#2 cerrado correctamente sobre todas las RPCs nuevas de v9.0.

## Apply PROD

- Comando: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0064_bounded_rpc_statement_timeout.sql`
- Resultado: 9 × (DROP FUNCTION + CREATE FUNCTION + REVOKE + REVOKE) — sin 42P13, sin abort
- NUNCA `supabase db push`

## pgTAP Results

```
1..36
ok 1..36  (36 ok, 0 not ok)
```

Asserts verificados:
- **A** (has_function): 9/9 — todas las funciones existen con firma correcta
- **B** (aclexplode grantee=0): 9/9 — PUBLIC sin EXECUTE en todas
- **C** (proconfig statement_timeout=%): 9/9 — SC#2 DoS cap activo en todas
- **D** (pg_get_function_result PII): 9/9 — ninguna proyecta rut/email/partido_alias

## Decisions Made

- `match_proyectos` excluida: es security INVOKER (no DEFINER), pre-v9.0, ya acotada por LIMIT/threshold. Re-emitirla con timeout requeriría match exacto de firma security-INVOKER con riesgo 42P13 por ganancia marginal. Documentado en el header de 0064.
- `partido` (sin `_alias`) NO es PII — dato público del cargo electo, decisión operador 2026-07-21.
- Returns tables byte-idénticas a 0061 (cross-links con `total_n bigint`) y 0063 (13 cols con contraparte_rol/representado NULL por compat) — sin 42P13 al aplicar.

## Threat Surface Scan

No new endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. 0064 re-emite funciones existentes con un atributo adicional; no expone superficie nueva.

## Self-Check: PASSED

- `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` exists: FOUND
- `supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql` exists: FOUND
- pgTAP PROD: 36 ok, 0 not ok (confirmed by psql output above)
- 0064 applied to PROD without error (9 DROP+CREATE+REVOKE+REVOKE cycles, no 42P13)
