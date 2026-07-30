---
phase: 124
plan: 01
wave: 1
subsystem: supabase-boundary
tags: [supabase, acl, default-privileges, lockdown, deuda-operador]
requires: []
provides:
  - "OFF-01 adjudicado (DEUDA-OPERADOR) — desbloquea las waves 2-7 de la Phase 124"
  - "supabase/migrations/0073 (escrita, NO aplicada — bloqueada por 42501)"
  - "supabase/tests/post-apply/0073 (corrido contra PROD, evidencia roja transcrita)"
affects:
  - "toda migración futura que cree objetos en public (condición dura heredada)"
tech-stack:
  added: []
  patterns:
    - "pre-check + post-check fail-closed en la misma transacción de la migración"
    - "pgTAP con denominador explícito (anti-cero-vacuo)"
key-files:
  created:
    - supabase/migrations/0073_default_acl_supabase_admin_public.sql
    - supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql
    - .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-01-RESULTADO.md
  modified: []
decisions:
  - "Rama B ejecutada tal como el plan la escribió: 42501 ⇒ DEUDA-OPERADOR, cero escalada de privilegio"
  - "No se registra 0073 en schema_migrations: el ledger no debe afirmar lo que la DB no tiene"
metrics:
  duration: "~35 min"
  completed: 2026-07-29
  tasks: 3
  commits: 3
---

# Phase 124 Plan 01: OFF-01 — default ACL de `supabase_admin` sobre `public` — Summary

Migración `0073` (revoke puro, con pre/post-check fail-closed) y su pgTAP escritos y ejecutados
contra PROD; el fix fue **denegado con `SQLSTATE 42501`** por falta de membresía en `supabase_admin`
— **la rama de fallo que el plan predijo** — y `OFF-01` quedó adjudicado como **`DEUDA-OPERADOR`**
con evidencia roja, pasos de operador zero-credential-value y corolario para las waves siguientes.

## Veredicto tipado

**`veredicto: DEUDA-OPERADOR`** — archivo consumible por las waves 2-7 y por el plan 07:
`.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-01-RESULTADO.md`

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | Migración `0073` — 3 `revoke` + pre-check + post-check | `0da25bf` | escrita, sin BOM, verify PASS |
| 2 | pgTAP post-apply — 4 aserciones (A/B defecto, C denominador, D no-regresión) | `b5b41c7` | escrito, verify PASS |
| 3 | Aplicar a PROD, correr pgTAP, adjudicar | `60cf080` | **DEUDA-OPERADOR** |

## Evidencia

**Pre-check (pasó):** `NOTICE: PRE-CHECK 0073 OK: 3 tipos de objeto afectados, como Q-10 (r, f, S).`
⇒ el estado de PROD es **el mismo que auditó la Phase 123**. El diagnóstico era correcto; fue el
privilegio lo que detuvo el fix, no una divergencia de estado.

**Apply (falló, exit 3, transacción abortada, PROD intacto):**

```
ERROR:  42501: permission denied to change default privileges
LOCATION:  ExecAlterDefaultPrivilegesStmt, aclchk.c:1146
```

**pgTAP post-apply (2 ok / 2 not ok — la salida roja ES la evidencia):**

```
1..4
not ok 1 - (A) … grantee anon …            have: 12  want: 0
not ok 2 - (B) … grantee authenticated …   have: 12  want: 0
ok 3 - (C) denominador vivo …
ok 4 - (D) no-regresion (huella de 0044) …
```

Los dos `ok` importan tanto como los dos `not ok`: **(C)** prueba que el cero esperado no sería un
cero vacuo por desaparición de la fila, y **(D)** reverifica hoy, contra PROD, que el default ACL de
`postgres` sobre `public` sigue cerrado.

**Post-check de estado:** `select count(*) from supabase_migrations.schema_migrations where
version='0073'` → `0`. Correcto: nada se aplicó, nada se registró.

## Desviaciones (RULE-1)

**Una, documentada, no correctiva.** El pgTAP reporta `have: 12` mientras `Q-10` habla de **3
filas**. No es contradicción ni error del test: `Q-10` cuenta filas de `pg_default_acl` (una por tipo
de objeto), y el test cuenta entradas de `aclexplode` (una por *grantee × privilegio*). Verificado
contra la DB viva: `r`=16, `f`=2, `S`=6 → 24 entradas = 12 por rol, que es exactamente
`arwdDxtm`(8) + `X`(1) + `rwU`(3) por rol. **Los números corroboran el ACL transcrito por `Q-10`**;
sólo cambia la unidad de conteo. Queda escrito en el archivo de resultado en vez de ajustar el
número en silencio.

No hubo séptimo blocker de plan. No se tocó ningún archivo fuera de `files_modified`.

## Lo que NO se hizo (T-124-02)

Cero `set role`, cero `security definer` envolvente, cero uso de la service key para DDL, cero
`alter role … superuser`, cero `grant supabase_admin to postgres`, cero dashboard, cero
debilitamiento del pre/post-check para «hacer pasar» la migración. El único comando repetido fue el
mismo `psql` con `VERBOSITY=verbose` para fijar el `SQLSTATE` en el registro — misma transacción
abortada, efecto nulo en PROD.

El valor de `SUPABASE_DB_URL` no aparece en ningún artefacto (verificado con grep sobre el archivo de
resultado → 0 coincidencias de patrones de credencial).

## Qué heredan las waves 2-7

1. **Pueden arrancar.** El paso 1 del orden LOCKED está *adjudicado*, no *cerrado*, y el riesgo
   residual es **exactamente el que existía antes de la Phase 124** — latente, sobre objetos
   *futuros* creados por `supabase_admin`.
2. **El default ACL abierto no se materializa en ningún objeto de esta fase**, por tres razones
   mecánicas (no optimismo): los planes restantes sólo hacen `revoke`, `alter function … set` y
   `create or replace` de funciones existentes; un default ACL sólo actúa en el `CREATE`; y las
   migraciones corren como `postgres`, cuyo default ACL **sí** está cerrado (reverificado hoy por la
   aserción (D)).
3. **Condición dura mientras el veredicto sea `DEUDA-OPERADOR`:** ninguna migración puede crear un
   objeto nuevo en `public` sin su `revoke` explícito adjunto en la misma migración. Si un plan
   posterior lo necesitara, **para y escala**.
4. **Deuda de operador abierta:** ejecutar las tres sentencias `revoke` como `supabase_admin` (vía
   soporte de Supabase, preferente). Criterio de cierre: el mismo pgTAP pasa de 2 ok/2 not ok a
   **4 ok / 0 not ok**.

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit 0 (`set -o pipefail`).
- `npx tsc --noEmit` en `app/` → exit 0.
- Guards de régimen verdes (incluido `(A4)`: un `alter default privileges … revoke` no matchea el
  detector, como el bloque documenta explícitamente).
- `git diff --stat` del plan → exactamente los 3 archivos de `files_modified`.

## Self-Check: PASSED

- `supabase/migrations/0073_default_acl_supabase_admin_public.sql` — FOUND
- `supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql` — FOUND
- `.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-01-RESULTADO.md` — FOUND
- commits `0da25bf`, `b5b41c7`, `60cf080` — FOUND
