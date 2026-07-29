---
fase: 124
plan: 02
offender: OFF-6-04
eje: 6
query_origen: Q-10
orden_locked: 2
veredicto: APLICADO
sqlstate: "00000"
exit_code: 0
migracion: supabase/migrations/0074_default_acl_postgres_storage.sql
pgtap: supabase/tests/post-apply/0074_default_acl_postgres_storage.test.sql
pgtap_resultado: "4 ok / 0 not ok"
aplicado_en_prod: true
registrado_en_ledger: true
escalada_de_privilegio: false
fecha: 2026-07-29
---

# 124 · OFF-6-04 — Resultado adjudicado: **APLICADO**

Los tres default ACL del rol **`postgres`** sobre el esquema **`storage`** (tipos `r`, `f`, `S`, con
`anon` y `authenticated` como grantees) quedaron **revocados en PROD**. El paso 2 del orden LOCKED
está **cerrado**, no adjudicado: `OP-3` (creación del bucket) queda desbloqueado para el operador.

A diferencia de `OFF-01`, aquí el `defaclrole` es `postgres` — la propia identidad de la conexión de
las migraciones — así que hubo ownership y la rama B no se activó.

---

## 1. Comando ejecutado

```
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -v VERBOSITY=verbose -f supabase/migrations/0074_default_acl_postgres_storage.sql
```

`SUPABASE_DB_URL` se usa **por nombre**. Su valor no se ecoa, no se expande y no aparece en ningún
artefacto de esta fase.

## 2. Exit code

```
EXIT=0
```

Rama **A**: la transacción committeó.

## 3. Salida verbatim

```
psql:supabase/migrations/0074_default_acl_postgres_storage.sql:80: NOTICE:  00000: PRE-CHECK 0074 OK: 3 tipos de objeto afectados, como Q-10 (r, f, S).
LOCATION:  exec_stmt_raise, pl_exec.c:3911
DO
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
psql:supabase/migrations/0074_default_acl_postgres_storage.sql:120: NOTICE:  00000: POST-CHECK 0074 OK: 0 entradas anon/authenticated restantes. OFF-6-04 cerrado.
LOCATION:  exec_stmt_raise, pl_exec.c:3911
DO
EXIT=0
```

- **Pre-check fail-closed pasó** con `3` tipos de objeto ⇒ el estado de partida era **exactamente el
  que auditó `Q-10`** en la Phase 123.
- **Post-check en la misma transacción pasó** con `0` entradas restantes ⇒ el revoke surtió efecto
  antes de committear. No se committeó un cierre falso.

## 4. pgTAP post-apply — **4 ok / 0 not ok**

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/post-apply/0074_default_acl_postgres_storage.test.sql
```

```
BEGIN
1..4
ok 1 - (A) OFF-6-04: cero entradas con grantee anon en el default ACL de postgres sobre storage
ok 2 - (B) OFF-6-04: cero entradas con grantee authenticated en el default ACL de postgres sobre storage
ok 3 - (C) denominador vivo: el default ACL de postgres sobre storage sigue existiendo con postgres y service_role como grantees (el cero de A/B es por revoke, no por desaparicion de la fila)
ok 4 - (D) no-regresion del contexto: storage.buckets sigue en 0 (Q-20); esta migracion no crea buckets
ROLLBACK
```

(C) prueba que el cero **no es vacuo**: la fila de `pg_default_acl` sigue viva con `postgres` y
`service_role`. (D) reverifica que la migración no creó bucket alguno.

## 5. `Q-10` re-corrida **verbatim** (la del audit, sin modificar), filtrada a `postgres`/`storage`

```
postgres|storage|S|{postgres=rwU/postgres,service_role=rwU/postgres}
postgres|storage|f|{postgres=X/postgres,service_role=X/postgres}
postgres|storage|r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

**Ninguna de las 3 filas contiene `anon=` ni `authenticated=`.** Antes (Phase 123 y pre-check de hoy):

```
postgres|storage|S|{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}
postgres|storage|f|{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
postgres|storage|r|{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

## 6. Ledger

```
select count(*) from supabase_migrations.schema_migrations where version='0074';  -->  1
```

## 7. Lo que **no** se hizo

Cero `set role`, cero `security definer`, cero uso de la service key, cero dashboard, cero
`alter role`, cero debilitamiento de pre/post-check. Cero `grant`, cero `drop`, cero `create policy`,
cero `insert into storage`, cero bucket, cero policy. La migración es puramente sustractiva.

---

## Consecuencia para el operador (`OP-3`)

**`OP-3` (creación del bucket `crudo-servel`) queda desbloqueado.** El paso 2 del orden LOCKED se
consumó *antes* de que exista bucket alguno, que es justamente la condición que el gate exigía. Un
bucket creado a partir de ahora **no nace con grants a `anon`/`authenticated` por default ACL**.

Advertencia que sigue viva y no la cierra esta migración: `Q-21` da **0 policies** sobre
`storage.objects` (cero vacuo). Al crear el bucket, el operador debe escribir su policy explícita —
el default ACL cerrado evita el grant automático, no sustituye a la RLS.
