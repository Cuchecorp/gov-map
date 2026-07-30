---
phase: 124
plan: 02
wave: 2
subsystem: supabase-boundary
tags: [supabase, acl, default-privileges, pg_net, ssrf, storage, deuda-operador]
requires: ["124-01"]
provides:
  - "OFF-6-04 CERRADO en PROD (veredicto APLICADO) — desbloquea OP-3 (creación de bucket)"
  - "OFF-6-03 adjudicado (DEUDA-OPERADOR) — cadena SSRF sigue abierta ⇒ OP-1/OP-4 con urgencia ELEVADA"
  - "supabase/migrations/0074 (aplicada + registrada en ledger)"
  - "supabase/migrations/0075 (escrita, NO aplicada — no-op por ownership de supabase_admin)"
affects:
  - "OP-3: el bucket ya no nacería con grants a anon/authenticated por default ACL"
  - "124-07: debe emitir OP-1/OP-4 como urgencia elevada, no como línea de backlog"
tech-stack:
  added: []
  patterns:
    - "post-check fail-closed que convierte un REVOKE no-op silencioso en transacción abortada"
    - "pgTAP con denominador explícito (anti-cero-vacuo) + aserción de no-regresión de la ingesta"
key-files:
  created:
    - supabase/migrations/0074_default_acl_postgres_storage.sql
    - supabase/migrations/0075_revoke_net_roles_publicos.sql
    - supabase/tests/post-apply/0074_default_acl_postgres_storage.test.sql
    - supabase/tests/post-apply/0075_revoke_net_roles_publicos.test.sql
    - .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-6-04-RESULTADO.md
    - .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-6-03-RESULTADO.md
  modified: []
decisions:
  - "OFF-6-04 aplicado a PROD: el defaclrole es postgres (identidad de la conexión) ⇒ hubo ownership"
  - "OFF-6-03 adjudicado rama B (DEUDA-OPERADOR) pese a que el error final fue P0001 del post-check: la causa raíz es ownership de supabase_admin, declarado como juicio RULE-1"
  - "No se registra 0075 en schema_migrations: el ledger no debe afirmar lo que la DB no tiene"
metrics:
  duration: "~40 min"
  completed: 2026-07-29
  tasks: 2
  commits: 2
---

# Phase 124 Plan 02: `OFF-6-04` + `OFF-6-03` — pasos 2 y 3 del orden LOCKED — Summary

`OFF-6-04` (default ACL de `postgres` sobre `storage`) quedó **cerrado en PROD** con pgTAP 4 ok/0 not
ok; `OFF-6-03` (revoke de `net` a los roles públicos, **12 funciones**) **no pudo ejecutarse desde
`postgres`** —`net`, `pg_net` y las 12 funciones son de `supabase_admin`— y quedó adjudicado como
**`DEUDA-OPERADOR`**, con la consecuencia dicha sin suavizar: **la cadena SSRF sigue abierta**.

## Veredicto por offender (tipado, consumible por `124-07` sin re-interpretar)

| Offender | Paso LOCKED | Veredicto | Archivo |
|---|---|---|---|
| `OFF-6-04` | 2 | **`APLICADO`** | `124-OFF-6-04-RESULTADO.md` |
| `OFF-6-03` | 3 | **`DEUDA-OPERADOR`** | `124-OFF-6-03-RESULTADO.md` |

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | `0074` + pgTAP — default ACL `postgres`/`storage` | `8638f62` | **APLICADO** (exit 0, 4 ok) |
| 2 | `0075` + pgTAP — revoke de `net` a roles públicos | `af970a1` | **DEUDA-OPERADOR** (exit 3, 1 ok/5 not ok) |

## Evidencia — `OFF-6-04` (APLICADO)

Pre-check: `PRE-CHECK 0074 OK: 3 tipos de objeto afectados, como Q-10 (r, f, S).`
Post-check: `POST-CHECK 0074 OK: 0 entradas anon/authenticated restantes.` · `EXIT=0`

pgTAP contra el schema aplicado — **4 ok / 0 not ok**:

```
1..4
ok 1 - (A) OFF-6-04: cero entradas con grantee anon en el default ACL de postgres sobre storage
ok 2 - (B) OFF-6-04: cero entradas con grantee authenticated en el default ACL de postgres sobre storage
ok 3 - (C) denominador vivo: … sigue existiendo con postgres y service_role como grantees …
ok 4 - (D) no-regresion del contexto: storage.buckets sigue en 0 (Q-20) …
```

`Q-10` re-corrida **verbatim** (antes → después), filtrada a `postgres|storage`:

```
ANTES:  postgres|storage|r|{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
DESPUÉS: postgres|storage|r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

(idem `f` y `S`.) Ledger: `version='0074'` → **1**.

## Evidencia — `OFF-6-03` (DEUDA-OPERADOR)

Pre-check pasó: `12 de 12 funciones de net tienen EXECUTE para anon`. Las 4 sentencias `revoke` se
ejecutaron y **las 4 fueron no-op**: 24 × `WARNING 01006 no privileges could be revoked`
(`restrict_and_check_grant`). El `ERROR P0001` final es el **post-check fail-closed de la propia
migración** abortando la transacción. `EXIT=3`, **PROD intacto** (`Q-22b` de `net` byte-idéntico),
ledger `version='0075'` → **0**.

Causa raíz, verificada: `nspowner(net)` = `supabase_admin`; `extowner(pg_net)` = `supabase_admin`;
`proowner(net.http_post)` = `supabase_admin`; todos los grants con otorgante `/supabase_admin`;
`proacl` NULL en `http_get`/`http_post` (⇒ `EXECUTE TO PUBLIC` implícito, sólo revocable por el
propietario); `pg_has_role('postgres','supabase_admin','USAGE')` = **false**.

pgTAP — **1 ok / 5 not ok** (los `not ok` son la evidencia; el `ok 6` prueba que no se tocó la
ingesta). `Q-22` sigue en `net|true|true`; `Q-22b` conserva `=U` y `anon=U`.

No-regresión operativa: **5/5 jobs de `cron.job` `active = true`**; `cron.job_run_details` posterior
al intento, 8/8 `succeeded`, ningún fallo por privilegio.

## Desviaciones (RULE-1)

**Una, declarada, no correctiva: la discriminación de rama de `0075`.** El plan esperaba
`SQLSTATE 42501` para la rama B, pero `REVOKE` **no** lanza `42501` cuando el ejecutor no es
propietario ni otorgante: emite `WARNING 01006` y no cambia nada. El `ERROR` final fue el `P0001` del
post-check, que en la letra del plan apunta a rama C (PARAR). Se adjudicó **rama B** porque (1) el
pre-check pasó ⇒ no hubo supuesto falso, que es lo que la rama C atrapa; (2) la causa raíz es
literalmente la que la rama B nombra —ownership de `supabase_admin` sobre `net`/`pg_net`—; y (3) el
`P0001` no es un fallo del fix sino el post-check funcionando: sin él, `0075` habría committeado sin
revocar nada y `OFF-6-03` se habría dado por cerrado **en falso**. Razonamiento completo en §5 de
`124-OFF-6-03-RESULTADO.md`. Nada se aplicó y nada es irreversible: si el orquestador prefiere la
lectura literal, tiene todo para decidirlo.

No hubo otras desviaciones. No se tocó ningún archivo fuera de `files_modified`.

## Lo que NO se hizo

Cero `set role`, cero `security definer`, cero service key para DDL, cero dashboard, cero
`grant supabase_admin to postgres`, cero borrado/reubicación de `pg_net` (eso es `OFF-6-01`, fuera de
fase), cero debilitamiento de pre/post-checks, cero reintento con otra identidad, cero bucket, cero
policy, cero deploy, cero flags, cero PII. El valor de `SUPABASE_DB_URL` no aparece en ningún
artefacto.

## Qué heredan las waves 3-7

1. **El orden LOCKED está consumado**: paso 1 `adjudicado` (`OFF-01`, deuda), paso 2 **cerrado**
   (`OFF-6-04`), paso 3 `adjudicado` (`OFF-6-03`, deuda). Las waves 3-7 pueden arrancar.
2. **Sigue viva la condición dura heredada de la wave 1**: ninguna migración crea un objeto nuevo en
   `public` sin su `revoke` adjunto en la misma migración. Si un plan lo necesitara: **parar y
   escalar**. (Las waves 3-7 son `revoke`, `alter function … set` y `create or replace` — no debería
   activarse.)
3. **Lección mecánica para las waves de `revoke` (3-7):** un `REVOKE` sobre objetos que no son de
   `postgres` **no falla, no-opea con `WARNING 01006`**. El post-check fail-closed dentro de la misma
   transacción no es una formalidad: es lo único que separa un cierre real de un cierre falso.
   Toda migración `revoke` de esta fase debe llevarlo.
4. **`OP-1` y `OP-4` suben de urgencia** (probe REST con anon key; destino de `pgtap`). Con
   `OFF-6-03` abierto, un cliente `anon` conserva `USAGE` sobre `net` y `EXECUTE` sobre sus 12
   funciones (incl. `http_post`, `http_delete`, `worker_restart`); el único mitigante es que `pgtap`
   no nombra sus argumentos — *"frágil y no intencional"* según el gate. **`124-07` debe emitirlo
   así, no como línea de backlog.**
5. **`OP-3` desbloqueado**: el bucket ya puede crearse sin nacer alcanzable. Recordatorio que el
   default ACL no cubre: `Q-21` da 0 policies — el operador debe escribir la RLS del bucket.
6. **Deuda de operador acumulable en un solo ticket**: `OFF-01` (3 sentencias) + `OFF-6-03` (4
   sentencias), misma identidad `supabase_admin`, mismo motivo.

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit 0 (`set -o pipefail`).
- `npx tsc --noEmit` en `app/` → exit 0.
- `git diff --stat HEAD~2 HEAD` → exactamente los **6** archivos de `files_modified`.
- `grep -riE 'db push|db reset|drop extension|alter extension' supabase/migrations/007[45]*` → **0**.
- Guards anclados a inicio de sentencia sobre `0074`/`0075` → **0** matches de
  `grant|drop|create policy|insert|set role`.

## Self-Check: PASSED

- `supabase/migrations/0074_default_acl_postgres_storage.sql` — FOUND
- `supabase/migrations/0075_revoke_net_roles_publicos.sql` — FOUND
- `supabase/tests/post-apply/0074_default_acl_postgres_storage.test.sql` — FOUND
- `supabase/tests/post-apply/0075_revoke_net_roles_publicos.test.sql` — FOUND
- `.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-6-04-RESULTADO.md` — FOUND
- `.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-OFF-6-03-RESULTADO.md` — FOUND
- commits `8638f62`, `af970a1` — FOUND
