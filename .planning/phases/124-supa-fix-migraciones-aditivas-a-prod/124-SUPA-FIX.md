---
fase: 124
plan: 07
requisito: SUPA-02
tipo: deliverable-consolidado
regimen: read-only-contra-prod
ancla_temporal: "2026-07-29 · TimeZone=UTC · PostgreSQL 17.6 on aarch64-unknown-linux-gnu"
offenders_totales: 13
cerrado: 6
deuda_operador: 2
diferido: 2
cerrado_en_123: 3
migraciones_aplicadas: ["0074", "0076", "0077", "0078", "0079"]
migraciones_escritas_no_aplicadas: ["0073", "0075"]
handoff: 124-HANDOFF-EXACTITUD.md
fecha: 2026-07-29
---

# Phase 124 · `SUPA-FIX` — deliverable consolidado de `SUPA-02`

Re-corrida del audit de la Phase 123 sobre la DB viva, con **las mismas queries que detectaron cada
offender**, copiadas verbatim del artefacto original. Lo que 124 cerró está **demostrado en cero, con
denominador**. Lo que 124 **no** cerró está demostrado **siguiendo vivo** — porque una deuda que no
se prueba viva es una deuda que se está cerrando en silencio.

Lo que esta fase **no** cierra sale nombrado y con dueño en **[`124-HANDOFF-EXACTITUD.md`](./124-HANDOFF-EXACTITUD.md)**.

---

## Ancla temporal y de entorno

```
select now()::date, current_setting('TimeZone'), version();
-->  2026-07-29|UTC|PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

Todas las salidas de este documento provienen de **esa** corrida, contra PROD, **read-only**.
`SUPABASE_DB_URL` se usa **por nombre** (`set -a; source .env; set +a`); su valor no se ecoa, no se
expande y no aparece en ningún artefacto de esta fase. **Cero PII**: solo nombres de objeto, ACL y
agregados.

---

## §Régimen aplicado

Esta fase (`124-07`) es **read-only contra PROD**: cero DDL, cero DML, **cero migración nueva**, cero
`supabase db push`, cero deploy, cero flip de flag, cero destructivo, cero secreto impreso, cero
instalación de paquetes.

| control | comando | resultado |
|---|---|---|
| cero `db push` / `db reset` **ejecutable** en las migraciones de la fase | `grep -rinE 'db push\|db reset' supabase/migrations/007[3-9]* \| grep -v ':[0-9]*:[[:space:]]*--'` | **0 líneas** |
| — el grep sin filtrar da 4 | `grep -rinE 'db push\|db reset' supabase/migrations/007[3-9]*` | **4 líneas, las 4 son comentarios de prohibición** (ver nota RULE-1 abajo) |
| cero cambio en flags | `git diff --stat -- '*PUBLIC_ENABLED*' '*.env*'` | **0 líneas** |
| cero cambio en `supabase/` en este plan | `git status --short` | solo `.planning/` y modificados preexistentes (`119-REVIEW.md`, `pnpm-workspace.yaml`) |
| suite `app/` | `pnpm --filter ./app test` | **1590 passed / 107 files** ✔ ≥ 1590 |
| typecheck | `pnpm --filter ./app exec tsc --noEmit` | exit **0** |

> **Nota RULE-1 sobre el control `db push`.** El acceptance criterion pedía **0 líneas** al grep
> crudo. La realidad da **4**, y las cuatro son la **prohibición escrita en un comentario** dentro de
> las propias migraciones:
> ```
> supabase/migrations/0076_revoke_execute_public_residual.sql:12:-- NUNCA `supabase db push` (drift de schema_migrations).
> supabase/migrations/0077_statement_timeout_rpcs_no_acotadas.sql:29:-- NUNCA supabase db push (drift de schema_migrations).
> supabase/migrations/0078_cotas_duras_parametro.sql:108:-- NUNCA supabase db push (drift de schema_migrations).
> supabase/migrations/0079_limit_explicito_rpcs.sql:110:-- NUNCA supabase db push (drift de schema_migrations).
> ```
> El control que importa —*"ninguna migración de la fase invoca `db push`"*— **se cumple**: filtrando
> las líneas de comentario el grep da **0**. Se deja escrita la corrección en vez de ajustar el número
> en silencio.

---

## §Migraciones de la fase — estado y pgTAP re-corrido hoy

| migración | offender | aplicada a PROD | en `schema_migrations` | pgTAP re-corrido 2026-07-29 |
|---|---|---|---|---|
| `0073_default_acl_supabase_admin_public.sql` | `OFF-01` | **NO** (`42501`) | **no** | **2 ok / 2 not ok** — los `not ok` son la prueba de que el offender sigue vivo |
| `0074_default_acl_postgres_storage.sql` | `OFF-6-04` | **sí** (exit 0) | **sí** | **4 ok / 0 not ok** |
| `0075_revoke_net_roles_publicos.sql` | `OFF-6-03` | **NO** (`01006` ×24 → post-check `P0001`) | **no** | **1 ok / 5 not ok** — ídem |
| `0076_revoke_execute_public_residual.sql` | `OFF-4-01`, `OFF-4-02`, `OFF-5-01` | **sí** (exit 0) | **sí** | **5 ok / 0 not ok** |
| `0077_statement_timeout_rpcs_no_acotadas.sql` | `OFF-4-03` (config, 18 fn) | **sí** (exit 0) | **sí** | **20 ok / 0 not ok** |
| `0078_cotas_duras_parametro.sql` | `OFF-4-03` (parámetro, 2 fn) + `OFF-4-04` | **sí** (exit 0) | **sí** | **11 ok / 0 not ok** |
| `0079_limit_explicito_rpcs.sql` | `OFF-4-03` (cuerpo, 12 fn) | **sí** (exit 0) | **sí** | **26 ok / 0 not ok** |

Ledger vivo, comprobado hoy:

```sql
select version from supabase_migrations.schema_migrations
where version in ('0073','0074','0075','0076','0077','0078','0079') order by 1;
```

```
0074
0076
0077
0078
0079
```

`0073` y `0075` **no** figuran, y eso es **correcto**: el ledger no debe afirmar lo que la DB no
tiene. Las dos migraciones existen escritas como **registro del fix pendiente**, no como fix aplicado.

Salidas rojas re-corridas hoy, íntegras (son evidencia, no ruido):

```
--- 0073_default_acl_supabase_admin_public   ok=2 notok=2
not ok 1 - (A) OFF-01: cero entradas con grantee anon en el default ACL de supabase_admin sobre public
not ok 2 - (B) OFF-01: cero entradas con grantee authenticated en el default ACL de supabase_admin sobre public

--- 0075_revoke_net_roles_publicos            ok=1 notok=5
not ok 1 - (A) OFF-6-03: anon NO tiene USAGE sobre el esquema net (Q-22 lo hallo en true)
not ok 2 - (B) OFF-6-03: authenticated NO tiene USAGE sobre el esquema net
not ok 3 - (C) OFF-6-03: 0 funciones de net con EXECUTE para anon, sobre un denominador vivo de 12 funciones (cero fuerte, no vacuo)
not ok 4 - (D) OFF-6-03: 0 funciones de net con EXECUTE para authenticated, sobre un denominador vivo de 12 funciones
not ok 5 - (E) OFF-6-03: anon NO puede ejecutar net.http_get ni net.http_post (las dos que el gate verifico) — cadena SSRF cortada en su origen
```

---

## §Re-corrida del audit — las queries originales, verbatim

**Regla que gobierna esta sección** (heredada de `123-SUPA-AUDIT.md` §Método): *"'0 offenders' solo
vale si la query que lo demuestra está transcrita verbatim"*. Cada bloque `sql` de abajo es el bloque
del audit, **copiado, no reescrito**: mismo texto, mismo filtro `deptype = 'e'`, mismo `order by`.
Y **cada cero lleva su denominador**, porque un cero sin denominador es indistinguible de un cero
vacuo.

Nota de método operativa: `psql -tA` emite `\r\n` en este host ⇒ `tr -d '\r'` en **todo** pipe.
`sort -c` no protege contra eso.

---

### `Q-10` — `ALTER DEFAULT PRIVILEGES` vivos → `OFF-01` (deuda) y `OFF-6-04` (cerrado)

```sql
select pg_get_userbyid(d.defaclrole) as rol_creador,
       coalesce(n.nspname,'(todos)')  as esquema,
       d.defaclobjtype               as tipo_objeto,
       d.defaclacl::text             as acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1,2,3;
```

Salida real — **30 filas**, denominador completo. Transcritas las 30:

```
postgres|pgmq|S|{pg_monitor=r/postgres}
postgres|pgmq|r|{pg_monitor=r/postgres}
postgres|public|S|{postgres=rwU/postgres,service_role=rwU/postgres}
postgres|public|f|{postgres=X/postgres,service_role=X/postgres}
postgres|public|r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
postgres|storage|S|{postgres=rwU/postgres,service_role=rwU/postgres}
postgres|storage|f|{postgres=X/postgres,service_role=X/postgres}
postgres|storage|r|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
supabase_admin|cron|S|{postgres=r*w*U*/supabase_admin}
supabase_admin|cron|f|{postgres=X*/supabase_admin}
supabase_admin|cron|r|{postgres=a*r*w*d*D*x*t*m*/supabase_admin}
supabase_admin|extensions|S|{postgres=r*w*U*/supabase_admin}
supabase_admin|extensions|f|{postgres=X*/supabase_admin}
supabase_admin|extensions|r|{postgres=a*r*w*d*D*x*t*m*/supabase_admin}
supabase_admin|graphql|S|{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}
supabase_admin|graphql|f|{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
supabase_admin|graphql|r|{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}
supabase_admin|graphql_public|S|{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}
supabase_admin|graphql_public|f|{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
supabase_admin|graphql_public|r|{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}
supabase_admin|public|S|{postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}
supabase_admin|public|f|{postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}
supabase_admin|public|r|{postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}
supabase_admin|realtime|S|{postgres=rwU/supabase_admin,dashboard_user=rwU/supabase_admin}
supabase_admin|realtime|f|{postgres=X/supabase_admin,dashboard_user=X/supabase_admin}
supabase_admin|realtime|r|{postgres=arwdDxtm/supabase_admin,dashboard_user=arwdDxtm/supabase_admin}
supabase_auth_admin|auth|S|{postgres=rwU/supabase_auth_admin,dashboard_user=rwU/supabase_auth_admin}
supabase_auth_admin|auth|f|{postgres=X/supabase_auth_admin,dashboard_user=X/supabase_auth_admin}
supabase_auth_admin|auth|r|{postgres=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}
```

**`OFF-6-04` — `postgres`/`storage`: CERRADO.** Las 3 filas ya **no** contienen `anon=` ni
`authenticated=`. Comparación literal con el estado de la Phase 123:

| tipo | 123 (offender) | hoy (cerrado) |
|---|---|---|
| `S` | `{postgres=rwU,`**`anon=rwU`**`,`**`authenticated=rwU`**`,service_role=rwU}` | `{postgres=rwU/postgres,service_role=rwU/postgres}` |
| `f` | `{postgres=X,`**`anon=X`**`,`**`authenticated=X`**`,service_role=X}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `r` | `{postgres=arwdDxtm,`**`anon=arwdDxtm`**`,`**`authenticated=arwdDxtm`**`,service_role=arwdDxtm}` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` |

El cero **no es vacuo**: las 3 filas siguen existiendo con `postgres` y `service_role` como grantees
(pgTAP `0074` aserción (C)). Se revocó, no desapareció la fila.

**`OFF-01` — `supabase_admin`/`public`: SIGUE VIVO — es la rama `DEUDA-OPERADOR`, y aquí está la
prueba, no la afirmación.** Las 3 filas conservan `anon=rwU` / `anon=X` / `anon=arwdDxtm` y sus
gemelas de `authenticated`, **byte-idénticas** a las de la Phase 123. `0073` abortó con `42501`
(`permission denied to change default privileges`, `ExecAlterDefaultPrivilegesStmt`) porque
`postgres` no es miembro de `supabase_admin` (`rolsuper = f`, `Q-23`). **No se escaló privilegio.**

**No-regresión de `0044`:** las 3 filas `postgres`/`public` siguen **sin** `anon` ni `authenticated`.
El régimen `>0044` está vivo, y ninguna migración de esta fase lo tocó.

**Deriva de plataforma observada, ajena a 124 (RULE-1, se declara en vez de omitirse):** la fila
`supabase_admin|realtime` pasó de `postgres=U*` (123) a `postgres=U` (hoy) en `Q-22b`, y las filas
`realtime` de `Q-10` no cambiaron. Es esquema de plataforma, fuera del alcance de los ejes auditados,
y **ninguna migración de 124 lo tocó** (`0074`–`0079` solo tocan `public` y `storage`). Se registra
como observación, no como offender.

---

### `Q-22` — esquemas alcanzables por `anon`/`authenticated` → `OFF-6-03` (deuda)

```sql
select n.nspname,
       has_schema_privilege('anon', n.nspname, 'USAGE')          as usage_anon,
       has_schema_privilege('authenticated', n.nspname, 'USAGE') as usage_authenticated
from pg_namespace n
where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
order by 1;
```

Salida real — **17 filas** (denominador completo):

```
actualidad|f|f
auth|t|t
cron|f|f
cruces|f|f
extensions|t|t
grafo|f|f
graphql|t|t
graphql_public|t|t
net|t|t
pgbouncer|f|f
pgmq|f|f
public|t|t
realtime|t|t
storage|t|t
supabase_migrations|f|f
util|f|f
vault|f|f
```

**Fila `net` → `t|t`. `OFF-6-03` SIGUE VIVO.** El resultado esperado para una deuda es exactamente
éste, y se demuestra en vez de asumirse. Sin cambios respecto de la Phase 123: 17 de 17 filas
idénticas.

`vault` sigue en `f|f` (ningún secreto alcanzable por rol público) y `pgmq`/`cron` en `f|f`
(la ingesta sigue cerrada). No hubo regresión.

### `Q-22b` — ACL crudo de los esquemas con `USAGE` (contraste autoritativo)

```sql
select n.nspname, coalesce(n.nspacl::text,'(NULL)')
from pg_namespace n
where n.nspname in ('public','storage','graphql_public','graphql','auth','extensions','net','realtime')
order by 1;
```

Salida real (8 filas):

```
auth|{supabase_admin=UC/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_auth_admin=UC/supabase_admin,dashboard_user=UC/supabase_admin,postgres=U/supabase_admin}
extensions|{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres,service_role=U/postgres,dashboard_user=UC/postgres}
graphql|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
graphql_public|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
net|{supabase_admin=UC/supabase_admin,=U/supabase_admin,supabase_functions_admin=U/supabase_admin,postgres=U/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
public|{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}
realtime|{supabase_admin=UC/supabase_admin,postgres=U/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_realtime_admin=UC/supabase_admin}
storage|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_storage_admin=U*C*/supabase_admin,dashboard_user=UC/supabase_admin}
```

El `nspacl` de `net` conserva **`=U/supabase_admin`** (el `USAGE TO PUBLIC`) **y** `anon=U`. Ambos
siguen ahí. `0075` intentó revocarlos y las 4 sentencias fueron **no-op** (24 × `WARNING 01006`,
*no privileges could be revoked*) porque `supabase_admin` es propietario del esquema, de la extensión
y de las 12 funciones, y `pg_has_role('postgres','supabase_admin','USAGE') = false`.

**El `=U` importa tanto como el `anon=U`:** revocar solo a los dos roles nombrados dejaría la puerta
abierta a cualquier rol presente o futuro. Por eso la deuda son **cuatro** sentencias, no dos.

Cierre correcto, sin cambios: **ningún rol público tiene `C` (CREATE) sobre `public`** — `anon=U`,
no `anon=UC`.

---

### `Q-15` — funciones de `public` ejecutables por `anon` → `OFF-4-01` + `OFF-4-02` (cerrados)

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
group by p.proname
order by 1;
```

Salida real:

```
(0 filas)
```

**Cero FUERTE, denominador = 42.** El denominador lo aporta `Q-12` en la sección siguiente: el corpus
propio de `public` (`deptype <> 'e'`) tiene **42** funciones vivas, y **0 de 42** son ejecutables por
`anon`. En la Phase 123 eran **8 de 42**:

| 123 (8 offenders) | hoy |
|---|---|
| `f_unaccent` (`OFF-4-01`) | revocada |
| `entidad_tercero_estado_no_regresa`, `identidad_audit_immutable`, `parlamentario_estado_no_regresa`, `vinculo_entidad_guarda`, `vinculo_entidad_guarda_insert`, `vinculo_identidad_guarda`, `vinculo_identidad_guarda_insert` (`OFF-4-02`, 7 `RETURNS trigger`) | revocadas |

`f_unaccent` queda ejecutable **solo por su owner (`postgres`) y por `service_role`** — su único
otorgamiento público era `EXECUTE TO PUBLIC` (`=X/postgres`), que desapareció del ACL. **No se emitió
ningún `grant` compensatorio**: no tiene consumidores (verificado por grep en `supabase/` y `app/`
durante la wave 3; el pipeline FTS de `0055` corre sobre la configuración `public.es_unaccent`, no
sobre el wrapper).

---

### `Q-12` — toda función de `public` con su exposición real por rol (el denominador de `Q-15`)

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid)          as args,
       p.prosecdef                                        as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as exec_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as exec_authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as exec_service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by exec_anon desc, p.proname;
```

Salida real, agregada (la salida completa son 42 filas; se transcribe el recuento por columna, que es
lo que el veredicto necesita, sin PII y sin ruido):

```
filas totales (corpus propio de public)        = 42
filas con exec_anon = t                        = 0     <-- eran 8 en la Phase 123
filas con exec_authenticated = t               = 0
filas con exec_service_role = t                = 42
filas con security_definer = t                 = 28
```

**`0/42` exec-`anon`** y **`0/42`** exec-`authenticated`. **`42/42`** conserva `service_role`: el
Camino A sigue intacto, el revoke no alcanzó a la identidad con la que corre el sitio. Y el corpus
sigue en **42**: las migraciones `0076`–`0079` **no crearon ni destruyeron ningún objeto**.

---

### `Q-13bis` — acotamiento de las 42 → `OFF-4-03` + `OFF-4-04` (cerrados)

```sql
select p.proname,
       (lower(p.prosrc) ~ 'limit[[:space:]]+[0-9]')          as tiene_limit,
       (lower(p.prosrc) like '%statement_timeout%'
        or array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout%') as tiene_timeout,
       (lower(p.prosrc) ~ 'limit[[:space:]]+(p_limit|limite|match_count|[0-9])') as limit_amplio,
       array_to_string(coalesce(p.proconfig,'{}'), ',')      as proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by tiene_timeout asc, tiene_limit asc, p.proname;
```

Salida real — **42 filas**, transcritas íntegras:

```
agregado_por_contraparte_cap|f|f|f|search_path=""
entidad_tercero_estado_no_regresa|f|f|f|search_path=""
f_unaccent|f|f|f|search_path=""
identidad_audit_immutable|f|f|f|search_path=""
parlamentario_estado_no_regresa|f|f|f|search_path=""
resolver_entidad|f|f|f|search_path=""
resolver_identidad|f|f|f|search_path=""
vinculo_entidad_guarda|f|f|f|search_path=""
vinculo_entidad_guarda_insert|f|f|f|search_path=""
vinculo_identidad_guarda|f|f|f|search_path=""
vinculo_identidad_guarda_insert|f|f|f|search_path=""
agregado_por_contraparte|f|t|f|search_path="",statement_timeout=5s
coincidencia_votos_par|f|t|f|search_path="",statement_timeout=5s
match_proyectos|f|t|f|statement_timeout=5s
parlamentario_publico|f|t|f|search_path="",statement_timeout=5s
votos_de_parlamentario|f|t|f|statement_timeout=5s
actualidad_senales_panel|t|t|t|search_path="",statement_timeout=5s
aportes_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
bienes_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
buscar_citaciones|t|t|t|search_path="",statement_timeout=5s
buscar_proyectos_hibrido|t|t|t|search_path="",statement_timeout=5s
co_comisionados_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
coautores_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
comisiones_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
comparar_declaraciones|t|t|t|search_path="",statement_timeout=5s
contratos_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
copartidarios_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
cruces_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
cruces_de_proyecto|t|t|t|search_path="",statement_timeout=5s
de_la_misma_zona|t|t|t|search_path="",statement_timeout=5s
declaraciones_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
lobby_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
lobby_en_tramitacion|t|t|t|search_path="",statement_timeout=5s
lobby_menciones_de_boletin|t|t|t|search_path="",statement_timeout=5s
militancia_historica_compartida|t|t|t|search_path="",statement_timeout=5s
militancias_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
parlamentario_publico_v2|t|t|t|search_path="",statement_timeout=5s
parlamentarios_publico|t|t|t|search_path="",statement_timeout=5s
parlamentarios_publico_v2|t|t|t|search_path="",statement_timeout=5s
rebeldias_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
subgrafo_red|t|t|t|search_path="",statement_timeout=5s
tasa_ausencia_comparada|t|t|t|search_path="",statement_timeout=5s
```

Recuento con denominador:

| medida | valor | lectura |
|---|---|---|
| corpus propio de `public` | **42** | sin cambios: `0077`/`0078`/`0079` no crearon ni destruyeron objetos |
| `tiene_timeout = t` | **31 / 42** | 13 previas (`0064`/`0066`/`0067`) + **18** de `0077` |
| `tiene_timeout = f` | **11 / 42** | las **acotadas por construcción**, enumeradas abajo |
| `tiene_limit = t` (heurística) | **26 / 42** | **falso negativo conocido — ver abajo** |

**Las 18 que `0077` acotó** son exactamente las 17 de `OFF-4-03` + `subgrafo_red` de `OFF-4-04`, y
todas aparecen arriba con `tiene_timeout = t`. **Las 11 sin techo de tiempo son legítimas** (escalares,
constantes, `RETURNS trigger`, o rutas admin-write no públicas): `agregado_por_contraparte_cap`,
`f_unaccent`, `resolver_entidad`, `resolver_identidad`, `entidad_tercero_estado_no_regresa`,
`identidad_audit_immutable`, `parlamentario_estado_no_regresa`, `vinculo_entidad_guarda`,
`vinculo_entidad_guarda_insert`, `vinculo_identidad_guarda`, `vinculo_identidad_guarda_insert`.
`13 + 18 + 11 = 42`. Cuadra.

#### El falso negativo de la heurística `tiene_limit` — **no apoyarse en el regex** (igual que en 123)

El audit ya declaró que `Q-13bis` es **heurística sobre `prosrc`** y rescató casos a mano. Hoy el
regex `limit[[:space:]]+[0-9]` **no matchea** una cota que no empieza por dígito. Las **3** funciones
que salen `tiene_limit = f` **teniendo su cota correcta puesta** se verifican leyendo el
`pg_get_functiondef` **vivo**, no el regex:

```
agregado_por_contraparte >>     limit public.agregado_por_contraparte_cap()
match_proyectos          >>   limit least(coalesce(match_count, 20), 4000);   -- OFF-4-03: techo duro del servidor
votos_de_parlamentario   >>   limit least(coalesce(p_limit, 20), 4000) offset p_offset;   -- OFF-4-03: techo duro del servidor
```

Las **2** restantes con `tiene_limit = f` y **sin** `limit` alguno en el cuerpo —
`parlamentario_publico(p_id text)` y `coincidencia_votos_par(p_a text, p_b text)` — **no son
offenders**: resuelven por clave (un sujeto / un par) y no barren tabla. Ambas llevan
`statement_timeout=5s`.

⇒ **cota real 29 / 42** (26 por regex + 3 rescatadas), **11** acotadas por construcción, **2** por
clave. **La verdad la da el pgTAP por invocación, no el regex**: `0078` prueba las cotas de
`match_proyectos`/`votos_de_parlamentario`/`subgrafo_red` **invocándolas** (11 ok), y `0079` prueba
las 12 restantes igual (26 ok). Un lector futuro que lea `tiene_limit=false` para `match_proyectos`
está leyendo el límite del regex, no un defecto.

---

### `Q-16` + `Q-17` — `SECURITY DEFINER` y `search_path` → `OFF-5-01` (cerrado)

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_userbyid(p.proowner)               as owner,
       array_to_string(coalesce(p.proconfig,'{}'), ',') as proconfig,
       exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
         as tiene_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by tiene_search_path asc, p.proname;
```

Salida real, agregada: **28 filas** secdef, **28 con `tiene_search_path = t`**, **0 sin**.

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
```

Salida real:

```
(0 filas)
```

**Cero FUERTE, denominador = 28** (Splinter `0011` sin hallazgos, sin regresión desde 123).

**`OFF-5-01` cerrado**, verificado en la fila de `Q-13bis`:

```
f_unaccent|f|f|f|search_path=""      <-- en 123 la columna proconfig estaba VACIA
```

---

### `Q-19` — control: secdef ejecutable por `anon` (no-regresión)

```sql
select p.proname, pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

Salida real: `(0 filas)` — **cero FUERTE, denominador = 28 secdef** (`Q-16`). Splinter `0028`/`0029`
sin hallazgos. Recordatorio de método del audit: *"`Q-19` no es una tabla de offenders"*; una fila
suya solo sería offender si además fallara `Q-17` o `Q-14`, y ambas están vacías.

### `Q-02` — control: tablas de `public` sin RLS (no-regresión)

```sql
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
```

Salida real: `(0 filas)` — **cero FUERTE, denominador = 57 tablas** de `public`.

### `Q-05` — control: la superficie pública REAL (policies `to anon` / `to public`)

```sql
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and (roles && array['anon','public']::name[])
order by tablename, policyname;
```

Salida real: `(0 filas)`. Ni una sola policy concede algo a `anon` o a `public` sobre ninguna tabla
de `public`. Sin cambios desde 123.

### `Q-09b` — control autoritativo: grants a `anon`/`authenticated` sobre el catálogo (no-regresión)

```sql
select c.relname, a.grantee::regrole::text as grantee, a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace,
     aclexplode(c.relacl) a
where n.nspname = 'public' and c.relkind = 'r'
  and ( a.grantee::regrole::text = 'anon'
     or (a.grantee::regrole::text = 'authenticated'
         and c.relname not in ('suscripcion','consentimiento')) )
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1,2,3;
```

Salida real: `(0 filas)` — **cero FUERTE, denominador = 57 tablas**, sobre el catálogo no filtrado
(`aclexplode`), que es la evidencia autoritativa (no `information_schema`, que filtra por permisos).

**Los cuatro controles de no-regresión (`Q-02`, `Q-05`, `Q-09b`, `Q-19`) siguen en `(0 filas)`: el
trabajo de la Phase 124 no abrió nada nuevo.**

---

## §Veredicto por offender — las 13 filas del audit

**Vocabulario cerrado, cuatro valores y ninguno más:** `CERRADO` · `DEUDA-OPERADOR` · `DIFERIDO` ·
`CERRADO-EN-123`.

**Regla de `CERRADO`, sin excepción:** exige (a) migración aplicada con exit 0, (b) pgTAP verde contra
el schema aplicado, **y** (c) re-corrida verbatim de su query en cero. Faltando una, no es `CERRADO`.

| # | objeto | destino declarado en 123 | **veredicto 124** | evidencia (query verbatim + migración + pgTAP) |
|---|---|---|---|---|
| `OFF-01` | default-acl · `supabase_admin` en `public` (`r`,`f`,`S`) | `124-aditivo` | **`DEUDA-OPERADOR`** | `Q-10`: las 3 filas **conservan** `anon=`/`authenticated=` ⇒ **offender vivo, demostrado**. `0073` **escrita, NO aplicada** (`42501`, `ExecAlterDefaultPrivilegesStmt`). pgTAP `0073` hoy: **2 ok / 2 not ok**. Ledger: ausente. Veredicto copiado de `124-OFF-01-RESULTADO.md` (`veredicto: DEUDA-OPERADOR`) |
| `OFF-02` | guard · `lockdown-guard.test.ts` (Block A/D) | `guard` | **`CERRADO-EN-123`** | aserción `(A4)` del guard, cerrada en la propia Phase 123. Suite verde hoy: 1590 |
| `OFF-4-01` | función · `f_unaccent(text)` exec-`anon` | `124-aditivo` | **`CERRADO`** | (a) `0076` exit 0, ledger `1`; (b) pgTAP `0076` **5 ok / 0 not ok** (asserts (A),(C),(E)); (c) `Q-15` → `(0 filas)` sobre denominador **42** (`Q-12`), era 8/42 |
| `OFF-4-02` | función · las 7 `RETURNS trigger` con `EXECUTE TO PUBLIC` | `124-aditivo` | **`CERRADO`** | (a) `0076` exit 0; (b) pgTAP `0076` (A)/(B); (c) `Q-12` → **0/42** exec-`anon` y **0/42** exec-`authenticated` |
| `OFF-4-03` | función · 12 sin `LIMIT` + 3 con techo sin timeout + 2 con `LIMIT` sin techo (17) | `124-aditivo` | **`CERRADO`** (config + parámetro + cuerpo) | (a) `0077` + `0078` + `0079`, las 3 exit 0 y en ledger; (b) pgTAP **20 ok** + **11 ok** + **26 ok**, todos re-corridos hoy en verde; (c) `Q-13bis` → `tiene_timeout` **31/42** (las 18 acotadas) y cota real **29/42** con las 3 rescatadas por `pg_get_functiondef` |
| `OFF-4-04` | función · `subgrafo_red` (fan-out sin cota) | `124-aditivo` | **`CERRADO`** | (a) `0077` (tiempo) + `0078` (fan-out) exit 0; (b) pgTAP `0078` assert **5** (cota opera **y** el conjunto es idéntico al pre-apply: no recortó el grafo real, 272/272 combinaciones iguales); (c) `Q-13bis`: `subgrafo_red|t|t|t|…statement_timeout=5s` |
| `OFF-4-05` | guard · Direction-B | `guard` | **`CERRADO-EN-123`** | `(A5)` cerrada en 123. **Además, su deuda congelada se PAGÓ en 124-03**: `KNOWN_MISSING_REVOKE_FROM_PUBLIC = []`, con el detector verificado mordiendo antes de vaciarlo. Suite 1590 verde |
| `OFF-5-01` | función · `f_unaccent(text)` sin `search_path` | `124-aditivo` | **`CERRADO`** | (a) `0076` exit 0; (b) pgTAP `0076` assert (D) + control funcional (F) (resuelve `public.unaccent` bajo `search_path` fijado); (c) `Q-13bis`: `f_unaccent|…|search_path=""`; `Q-17` sigue en `(0 filas)` sobre **28** |
| `OFF-6-01` | extensión · `pgtap` en `public` (1.087 objetos) | `supabase-architect+checkpoint` | **`DIFERIDO`** | **Declarado, no aplicado** — es el alcance que el CONTEXT fijó. Destino: `supabase-architect` + **`OP-4`**. Detalle en `124-HANDOFF-EXACTITUD.md` |
| `OFF-6-02` | extensión · `vector` + `unaccent` en `public` | `supabase-architect+checkpoint` | **`DIFERIDO`** | **Declarado, no aplicado.** Destino: `supabase-architect` + **`OP-4`**. La recomendación del audit es **no moverlas** y documentar la excepción (ya hecho: `PUBLIC_EXTENSION_ALLOWLIST`) |
| `OFF-6-03` | extensión · `pg_net` + esquema `net` con `USAGE`/`EXECUTE` para `anon` | `124-aditivo` | **`DEUDA-OPERADOR`** | `Q-22`: fila `net` → **`t\|t`**; `Q-22b`: `nspacl` de `net` **conserva** `=U` y `anon=U` ⇒ **offender vivo, demostrado**. `0075` **escrita, NO aplicada** (24 × `WARNING 01006` no-op → post-check `P0001`). pgTAP `0075` hoy: **1 ok / 5 not ok**. Ledger: ausente. Veredicto copiado de `124-OFF-6-03-RESULTADO.md` |
| `OFF-6-04` | default-acl · `postgres` en `storage` | `124-aditivo` | **`CERRADO`** | (a) `0074` exit 0, ledger `1`; (b) pgTAP `0074` **4 ok / 0 not ok** (incluye (C) denominador vivo y (D) `storage.buckets` sigue en 0); (c) `Q-10`: las 3 filas `postgres`/`storage` **sin** `anon=` ni `authenticated=`. Veredicto copiado de `124-OFF-6-04-RESULTADO.md` (`veredicto: APLICADO`) |
| `OFF-6-05` | guard · transversal | `guard` | **`CERRADO-EN-123`** | `(A6)` cerrada en 123, con su límite declarado (el ACL vivo no es cubrible estáticamente — esa parte la cerró/adjudicó esta fase) |

### Identidad aritmética — espejo del control de 123

```
CERRADO + DEUDA-OPERADOR + DIFERIDO + CERRADO-EN-123 == 13
   6    +       2        +    2     +       3        == 13
```

| veredicto | n | cuáles |
|---|---|---|
| `CERRADO` | **6** | `OFF-4-01`, `OFF-4-02`, `OFF-4-03`, `OFF-4-04`, `OFF-5-01`, `OFF-6-04` |
| `DEUDA-OPERADOR` | **2** | `OFF-01`, `OFF-6-03` |
| `DIFERIDO` | **2** | `OFF-6-01`, `OFF-6-02` |
| `CERRADO-EN-123` | **3** | `OFF-02`, `OFF-4-05`, `OFF-6-05` |
| **suma** | **13** | = las 13 filas de la tabla de offenders del audit |

**Cuadra.** Control cruzado contra el §Recuento por destino de 123 (con su corrección RULE-1
`124-aditivo = 8`, no 7): de esos **8**, seis quedaron `CERRADO` y dos `DEUDA-OPERADOR`;
`supabase-architect+checkpoint` **2** → `DIFERIDO`; `guard` **3** → `CERRADO-EN-123`.
`8 + 2 + 3 = 13`.

---

## §La consecuencia de `OFF-6-03`, sin suavizar

Con `OFF-6-03` abierto, un cliente `anon` conserva **`USAGE` sobre el esquema `net`** y **`EXECUTE`
sobre sus 12 funciones**, incluidas `http_get`, `http_post`, `http_delete` y `worker_restart`. Eso es
una **cadena SSRF** —HTTP saliente originado en el servidor de la DB, con destino elegido por el
cliente— y hoy **sigue abierta**.

Su único mitigante vigente es que PostgREST expone `public` y `graphql_public`, no `net`; y el gate
de la Phase 123 ya demostró que ese mitigante se **puentea** encadenando con `lives_ok` de `pgtap`
(que sí vive en `public` y sí es exec-`anon`). Lo único que hoy impide ese puente es que la familia
`lives_ok` **no nombra sus argumentos** (`proargnames = NULL`) y PostgREST no puede invocarla — un
**accidente** que el gate calificó, verbatim, de *«mitigante frágil y no intencional»*.

**Una seguridad que depende de que una extensión de terceros no ponga nombre a sus parámetros no es
una seguridad: es una coincidencia con fecha de vencimiento.** Un `alter extension pgtap update` que
cambie esas firmas la elimina, sin aviso y sin un solo test rojo.

⇒ **`OP-1` y `OP-4` suben a urgencia ELEVADA.** No son un pendiente más de la lista: son **hoy** los
dos únicos actos que pueden cerrar o acotar esta superficie, y salen así en
[`124-HANDOFF-EXACTITUD.md`](./124-HANDOFF-EXACTITUD.md).

---

## §Las cuatro transcripciones del audit que no cuadraron contra PROD

**Es un patrón, no mala suerte, y el cierre de la fase debe decirlo.** Cuatro veces en seis waves un
número o una clasificación del audit resultó no sostenerse contra la DB viva. Ninguna fue trivial:
**dos de ellas habrían roto producción o el Camino A si se hubieran ejecutado a ciegas.**

| # | wave | afirmación del audit | realidad viva | qué habría pasado de creerle |
|---|---|---|---|---|
| **1** | 03 | `Q-15` transcribe el ACL de las 8 funciones exec-`anon` como **solo** `=X/postgres` | Llevan **además** un grant **explícito** a `service_role` (`service_role=X/postgres`), herencia del `alter default privileges … grant to service_role`, que un `revoke … from public` **no toca** | La aserción (E) del pgTAP habría asertado `service_role = false`, se habría puesto roja, y habría empujado a emitir un `revoke` extra sobre `service_role` — **rompiendo el Camino A** (el sitio ejecuta con `service_role`) |
| **2** | 04 | `OFF-4-03` cuenta **18** funciones a acotar | Contar "funciones sin `statement_timeout`" da **29** (incluye las **11** acotadas por construcción, que no son offenders) | El pre-check fail-closed del plan original habría **abortado siempre**, y la migración no se habría podido aplicar nunca |
| **3** | 05 | `OFF-5-01`: *"`f_unaccent` es la **única** función de `public` sin `search_path`"* | Tras la wave 3 `f_unaccent` ya lo tiene; las que quedan sin él son **`match_proyectos`** y **`votos_de_parlamentario`** — y **no deben recibirlo**: referencian `proyecto_embedding`, `voto`, `votacion`, `proyecto`, `proyecto_ficha` **sin calificar**, y **ninguna es `SECURITY DEFINER`** (sin escalada posible) | Un "arreglo de completitud" bienintencionado (`set search_path=''` a las dos) las habría **roto en runtime** sin ganar ninguna seguridad |
| **4** | 06 | `comparar_declaraciones` clasificada como **AGREGADO** | El `pg_get_functiondef` **vivo** la desmiente: devuelve `TABLE(fecha_presentacion, etiqueta, valor, …)`, un `union all` de 10 ramas **sin agregación alguna** ⇒ es clase **FILAS**. El reparto real es **11 FILAS / 1 AGREGADO** | Su `LIMIT` habría ido en el lugar equivocado y su aserción habría sido por valor donde correspondía por conteo |

**Conclusión que esta fase deja escrita como precedente:**

> **Los números del audit son hipótesis a verificar contra PROD, no hechos.** Toda migración de una
> fase de fix debe (a) llevar **pre-check fail-closed** que asierte el estado de partida **sobre el
> conjunto enumerado**, no sobre un total; (b) **medir** contra la DB viva antes de escribir el valor;
> y (c) **parar y escalar** si la medición contradice al audit, en vez de ajustar el número en
> silencio. Las cuatro veces, ese mecanismo funcionó.

---

## §Los techos prescritos que habrían roto producto

`OFF-4-03` prescribe textualmente `least(coalesce(match_count,20),**100**)` y
`least(coalesce(p_limit,20),**200**)`. **Ambos están por debajo de la demanda de los llamadores
vivos del sitio.** Aplicarlos no habría acotado un abuso: habría roto dos superficies centrales en
silencio.

| función | cota prescrita por el audit | argumento que el sitio pasa **hoy** | efecto de haberla aplicado |
|---|---|---|---|
| `match_proyectos` | **100** | hasta **1001** (`app/app/buscar/page.tsx:27,33,89` — `PAGE_SIZE=20`, `MAX_PAGE=50`, `matchCount = PAGE_SIZE*page+1`) | **`/buscar` roto desde la página 6**: `hayMas` → `false`, los resultados 101-1000 desaparecen |
| `votos_de_parlamentario` | **200** | **1000** en dos llamadores (`app/components/votos-por-parlamentario.tsx:1010`, `app/lib/parlamentario-resumen-conteos.ts:280`) | **1000 → 200 filas** para los **186** parlamentarios (todos con >200 votos): desincroniza el chip "Emitió N votos", el desglose y la asistencia. Y **rebaja** el cap efectivo de 1.000, es decir **empeora `B-01`** en vez de dejarlo intacto |

**El executor paró ANTES de aplicar** y escaló. Adjudicado por el operador: **techo 4000 para ambas**,
criterio **≥4× el argumento máximo del llamador vivo** (1001 / 1000 → 4004 ≈ 4000), el mismo criterio
que el plan ya exigía para `subgrafo_red`, y por encima del máximo real del dato (`max_votos = 3773`,
`sobre_4000 = 0` sobre los 186 parlamentarios; corpus embebido = 3.100).

**Fundamento del techo generoso**, verificado vivo y escrito en la cabecera de `0078`: las 3 funciones
están **cerradas a `anon` y `authenticated`**; el único llamador posible es el servidor del propio
sitio vía `service_role` (Camino A). El techo protege contra un **bug propio**, no contra un atacante
externo. **Lo que cierra el offender es que el `LIMIT` deje de ser ilimitado, no que el número sea
pequeño.** Un techo agresivo compraría poca seguridad a cambio de exactitud real.

Probe de no-regresión de producto, bajo `set role service_role`, post-apply: **cero regresión** —
`votos D1165(1000)=1000`, `match_proyectos(1001)=1001`, y la cota operando en el extremo
(`votos D1165(100000)=3752 ≤ 4000`).

---

## §Las cotas vacuas de `aportes` / `contratos` — deuda declarada

`aportes_de_parlamentario` y `contratos_de_parlamentario` midieron **0** como máximo sobre el dominio
completo (los 186 parlamentarios, 100 % de cobertura). **Ese cero no significa que el dato sea
pequeño: significa que sus tablas están vacías** — `aporte = 0` filas, `contrato = 0` filas — **por
el gate MONEY, que está OFF**.

`4 × 0 = 0` **no es un techo.** Se eligió **20.000 como valor provisional**, declarado como tal, y las
aserciones **(1)** y **(4)** del pgTAP `0079` son hoy **verdes pero VACUAS** — y **el propio mensaje
del test lo dice**, en vez de dejar que un lector futuro las tome por prueba. Es la misma disciplina
de "cero fuerte vs cero vacuo" del audit, aplicada a una cota en vez de a un conteo.

> **DEUDA: re-medir `aportes_de_parlamentario` y `contratos_de_parlamentario` el día del flip de
> MONEY.** Si el máximo real supera 5.000, el techo de 20.000 debe re-derivarse con el criterio ≥4×
> y las dos aserciones dejan de ser vacuas. Destino nombrado en `124-HANDOFF-EXACTITUD.md`.

---

## §La lección mecánica de la fase — vale como precedente del proyecto

**Un `REVOKE` sobre objetos ajenos NO falla.** Postgres no lanza `42501` en un `REVOKE` que no le
corresponde: emite `WARNING 01006 · no privileges could be revoked` desde `restrict_and_check_grant`
(`aclchk.c:365`) y **no cambia nada**. La transacción sigue adelante, el `psql` termina con exit 0, y
la migración committea **sin haber revocado absolutamente nada**.

En `0075` eso ocurrió **24 veces seguidas** — las 4 sentencias contra las 12 funciones y el esquema
`net`, todas no-op. Lo único que impidió registrar `OFF-6-03` como cerrado en falso fue el
**post-check fail-closed dentro de la misma transacción**, que releyó el estado resultante y abortó:

```
ERROR:  P0001: POST-CHECK 0075: anon SIGUE con USAGE sobre net. Se aborta para no committear un cierre falso.
```

> **Precedente LOCKED:** toda migración que contenga un `REVOKE` **debe** llevar un post-check que
> asierte el **estado resultante** —no la ausencia de error— en la misma transacción. Sin él,
> "revoqué" y "no pasó nada" son indistinguibles desde el exit code. Es la diferencia entre un cierre
> real y un cierre falso, y esta fase la vivió en las dos direcciones: `0075` (no-op cazado) y `0076`
> (revoke real, cero `WARNING 01006`, porque ahí `postgres` **sí** era el owner).

Corolario aplicado: los post-checks de `0076`–`0079` asertan positivamente que **`service_role`
conserva `EXECUTE`**, no solo que `anon` no lo tiene. Un revoke que además hubiera alcanzado a
`service_role` habría pasado un post-check "solo-negativo" y habría roto el sitio entero.

---

## §Estado de los 4 criterios de éxito de la fase

| # | criterio | estado | evidencia |
|---|---|---|---|
| 1 | Las migraciones aditivas de los offenders `124-aditivo` están **aplicadas a PROD** o adjudicadas como deuda con evidencia | ✅ **CUMPLIDO** | 5 aplicadas (`0074`, `0076`, `0077`, `0078`, `0079`), en ledger, con pgTAP verde re-corrido hoy; 2 adjudicadas `DEUDA-OPERADOR` (`0073`, `0075`) con `SQLSTATE`, salida verbatim y pgTAP rojo como prueba |
| 2 | **Cero escalada de privilegio, cero destructivo, cero cierre en falso** | ✅ **CUMPLIDO** | Los dos fallos por privilegio se **reportaron**, no se forzaron: cero `set role`, cero `security definer` envolvente, cero service key para DDL, cero dashboard, cero `grant supabase_admin to postgres`. Cero `drop`, cero DML, cero flip de flag, cero deploy. El post-check fail-closed de `0075` impidió el único cierre falso posible |
| 3 | Cada offender de los 8 `124-aditivo` tiene **veredicto escrito** y lo no cerrado sale **nombrado** | ✅ **CUMPLIDO** | §Veredicto por offender (13 filas, vocabulario cerrado, identidad `== 13`) + `124-HANDOFF-EXACTITUD.md` |
| 4 | **La re-corrida del audit de 123 sobre la DB viva da 0 offenders en lo corregido**, con la misma query que los detectó | ✅ **CUMPLIDO** | §Re-corrida del audit: `Q-15` → `(0 filas)`/**42**; `Q-12` → **0/42** exec-`anon`; `Q-17` → `(0 filas)`/**28**; `Q-10` → `postgres`/`storage` limpio; `Q-13bis` → **31/42** con techo. Y lo **no** corregido se demuestra **vivo**: `Q-10` `supabase_admin`/`public` con `anon=`, `Q-22` `net\|t\|t`. Controles `Q-02`/`Q-05`/`Q-09b`/`Q-19` en `(0 filas)`: nada nuevo se abrió |

---

## §Deudas de operador — acumulables en UN solo ticket

**`OFF-01` y `OFF-6-03` se pagan juntas: misma identidad requerida (`supabase_admin`), mismo motivo
(`postgres` no es miembro, `rolsuper = f`), mismo canal.** Son **3 + 4 = 7 sentencias**.

**Zero-credential-value: aquí no hay ninguna credencial, key, URL ni valor secreto — solo SQL textual
y el nombre del rol requerido. El ticket no requiere entregar ninguna credencial a nadie.**

### Qué hay que ejecutar — exactamente estas 7 sentencias, sin ninguna otra

```sql
-- OFF-01 (default ACL de supabase_admin sobre public)
alter default privileges for role supabase_admin in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated;

-- OFF-6-03 (esquema net de pg_net)
revoke all     on schema net from anon, authenticated;
revoke usage   on schema net from public;
revoke execute on all functions in schema net from anon, authenticated;
revoke execute on all functions in schema net from public;
```

Las cuatro de `OFF-6-03` son necesarias: la 2ª y la 4ª cierran el `USAGE`/`EXECUTE` **a `PUBLIC`**
(`=U/supabase_admin` en el `nspacl`, `proacl` `NULL` en las funciones), que dejaría la puerta abierta
a cualquier rol presente o futuro aunque los dos roles nombrados quedaran revocados.

### Con qué identidad, y en qué orden de preferencia

Como **`supabase_admin`** (propietario y otorgante). En Supabase gestionado `postgres` no lo es ni es
miembro.

1. **Soporte de Supabase (vía recomendada).** Un ticket desde el proyecto pidiendo la ejecución de las
   7 sentencias como `supabase_admin`. Justificación, en dos líneas: *«(a) el default ACL de
   `supabase_admin` sobre `public` concede `arwdDxtm`/`EXECUTE`/`rwU` a `anon` y `authenticated`;
   queremos que todo objeto futuro de `public` nazca cerrado, como ya lo están los del rol `postgres`.
   (b) el esquema `net` de `pg_net` concede `USAGE` a `anon`/`authenticated`/`PUBLIC` y `EXECUTE`
   sobre sus 12 funciones —incluidas `http_post`, `http_delete` y `worker_restart`—; `pg_net` es
   infraestructura de `pg_cron` y ningún rol público lo necesita»*.
2. **SQL editor del dashboard**, solo si el propietario del proyecto confirma que su sesión corre con
   un rol miembro de `supabase_admin`. Si devuelve `42501` o vuelven a salir los `WARNING 01006` sin
   efecto, **no insistir**: la vía es (1).

### Cómo verificar que quedó cerrado (la variable va por nombre, sin credenciales en el comando)

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0075_revoke_net_roles_publicos.test.sql
```

`0073` debe pasar de **2 ok / 2 not ok** a **4 ok / 0 not ok**.
`0075` debe pasar de **1 ok / 5 not ok** a **6 ok / 0 not ok**.
Ésos son los criterios de cierre, y no otros. La aserción **(F)** de `0075` (`service_role` conserva
`EXECUTE` sobre `net.http_post`) debe **seguir verde**: si se pusiera roja, el revoke habría alcanzado
a `service_role` y habría roto `pg_cron` — eso **no** es el fix.

### Qué NO hacer

- **No conceder `supabase_admin` a `postgres`** para forzarlo: eleva permanentemente el blast radius
  de **todas** las migraciones del proyecto para arreglar un ACL.
- **No borrar filas de `pg_default_acl` a mano**, ni borrar/reubicar la extensión `pg_net` por cuenta
  propia (eso es `OFF-6-01`/`OFF-6-02`, destino `supabase-architect` + `OP-4`, y a ciegas rompe la
  ingesta).
- **No re-aplicar `0073` ni `0075` esperando otro resultado**: son deterministas mientras la membresía
  y el ownership no cambien. Cuando la deuda se pague por la vía (1), quedan como el **registro** del
  fix y sus pre-checks abortarán con *«se hallaron 0»* / *«ya es FALSE»* — que es el fail-closed
  funcionando como corresponde.
- **No editar `0075` para «capturar la parte aplicable»**: no hay parte aplicable (las 4 sentencias
  fueron no-op). Si algún día la hubiera, va en una migración **nueva** (`0080`), jamás editando
  `0075`.

---

## §Condición dura que 124 deja viva para toda fase futura

Mientras `OFF-01` siga en `DEUDA-OPERADOR`, **ninguna migración puede crear un objeto nuevo en
`public` sin su `revoke` explícito adjunto en la misma migración.** El default ACL abierto de
`supabase_admin` solo actúa en el momento del `CREATE`; un `create or replace` sobre un objeto
preexistente **no** lo re-aplica (por eso `0076`–`0079` no ampliaron la superficie, y `Q-12` sigue en
`0/42`). Si un plan futuro necesita crear un objeto en `public`, **debe parar y escalar, no
improvisar**.

Este enganche ya es **mecánicamente exigible**: con `KNOWN_MISSING_REVOKE_FROM_PUBLIC = []` desde la
wave 3, el guard `(A5)` se pone **rojo** ante la primera `create function` en `public` sin su revoke.

---

## §Handoff

Todo lo que la Phase 124 **no** cierra —`B-01`, `B-02`, `B-03`, `OFF-6-01`, `OFF-6-02`, `OP-1`..`OP-4`
y los 4 huecos "al régimen" del gate— sale **nombrado, con evidencia, con forma de fix aditiva, con
destino y con dueño** en:

**→ [`124-HANDOFF-EXACTITUD.md`](./124-HANDOFF-EXACTITUD.md)**

Un ítem sin destino es un ítem cerrado en silencio, y esta fase lo tiene prohibido.
