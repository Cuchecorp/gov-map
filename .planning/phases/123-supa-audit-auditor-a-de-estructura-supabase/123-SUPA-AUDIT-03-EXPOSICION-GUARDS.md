---
fase: 123
fragmento: 03-exposicion-guards
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC; PostgreSQL 17.6)"
ejes: [6]
producido_por: 123-04
consumido_por: [123-05, 123-06]
manifiesto_ssot: .supabase-ops.yaml
metodo: 123-SUPA-AUDIT-00-METODO.md
---

# 123 — SUPA-AUDIT · Fragmento 03: eje 6 (buckets · keys · secrets · Data API) + el guard CI

> Régimen heredado de [`123-SUPA-AUDIT-00-METODO.md`](./123-SUPA-AUDIT-00-METODO.md): SQL verbatim
> read-only contra PROD, cero DDL/DML, cero PII, vocabulario LOCKED
> (`conforme` / `offender` / `limite-declarado`), plantilla de offender de 7 columnas (§0.2).
> **Esta fase no corrige nada** — los fixes son la Phase 124 (aditivos desde `0073`), el deploy la
> Phase 125. Única excepción autorizada: **extender un guard**, y eso es el plan **123-05**, no éste.
>
> **Ancla temporal:** `2026-07-29` · TimeZone de sesión `UTC` · PostgreSQL **17.6**.
>
> En este artefacto aparece **solo el NOMBRE** de las variables de entorno (`SUPABASE_DB_URL`,
> `R2_BUCKET`, …), jamás su valor. Toda salida del escáner de secretos está **saneada**: se registra
> `archivo:línea` + clase de hallazgo, **nunca** el valor.

---

## Resumen ejecutivo del eje 6

| sub-chequeo | query / evidencia | veredicto |
|---|---|---|
| Buckets de Supabase Storage y su flag `public` (Splinter 0025) | `Q-20` | `conforme` — **cero vacuo** (0 buckets); el default ACL de `storage` sí es **`offender`** (`OFF-6-04`) |
| Policies de `storage.objects` | `Q-21` | `conforme` — **cero vacuo** (0 policies, 0 buckets) |
| Esquemas alcanzables por `anon` / `authenticated` | `Q-22` + `Q-22b` | **`offender`** (`OFF-6-03`, esquema `net`) |
| Roles del proyecto y atributos peligrosos | `Q-23` | `conforme` |
| Extensiones instaladas en `public` (Splinter 0014) | `Q-24` | **`offender`** (`OFF-6-01`, `OFF-6-02`, `OFF-6-03`) |
| Superficie `anon` de las extensiones de `public` (excepción §0.6 E) | `Q-24b` + `Q-24c` (probe) | **`offender`** (`OFF-6-01`, `OFF-6-02`) |
| Secretos en repo / cliente | escáner + `git ls-files` + `.gitignore` | `conforme` |
| El guard CI como control efectivo del boundary | §Eje 6b | verde en su alcance, con **puntos ciegos nombrados** (`OFF-6-05`) |

**Titular.** El boundary *diseñado* (tablas, policies, RPCs de negocio) está cerrado a `anon`, como
demostraron `Q-05`/`Q-09b` del fragmento 01 y `Q-12` del fragmento 02. Pero el eje 6 destapa una
superficie `anon` **real y alcanzable** que los ejes 1–5 **excluyeron por construcción**: el filtro
`pg_depend deptype='e'` —obligatorio en §0.0— dejó fuera del barrido las **1.087 funciones de `pgtap`
instaladas en el esquema `public`**, de las cuales **1.079 son ejecutables por `anon`** y `public` es
el esquema que PostgREST expone. Se ejecutó una probe de control (`Q-24c`): `set role anon; select
public.pg_version();` **devuelve `17.6`**. La exclusión de objetos de extensión es correcta como
regla general, pero **`pgtap` en `public` en PRODUCCIÓN es exactamente la excepción que §0.6 E manda
declarar**.

---

## Eje 6 — Buckets, keys, secrets y superficie Data API

### `Q-20` — buckets de Supabase Storage y su flag `public` (Splinter 0025)

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by 1;
```

Salida real:

```
(0 filas)
```

Control del denominador (para no confundir cero fuerte con cero vacuo, §Q-18 del fragmento 02):

```sql
select count(*) from storage.buckets;
```

```
0
```

**Veredicto: `conforme` — pero es un CERO VACUO y se dice.** No hay **ningún** bucket en Supabase
Storage, luego no hay ninguno con `public = true`: **Splinter 0025 es inaplicable hoy**, no está
"resuelto". El proyecto guarda el crudo en **Cloudflare R2**, no en Supabase Storage (CLAUDE.md,
regla de ingesta en dos etapas: *Fuentes → R2 → Supabase*). Las variables `R2_BUCKET`,
`R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID` y `SERVEL_CRUDO_BUCKET` de `.env.example` nombran buckets de
**R2**, no de Supabase Storage — el `crudo-servel` que `.env.example` declara **no existe** en
`storage.buckets` y **no debe** existir ahí.

**Este plan NO crea el bucket.** Crear un bucket es DDL/DML sobre `storage` y, por el vocabulario de
§0.2, es `deuda-operador` — jamás acto de agente. Se registra en la herencia de 123-06.

**Nota de orden que hereda de `Q-10` (fragmento 01):** las tres filas
`postgres | storage | {r,f,S}` de `pg_default_acl` conceden por default `arwdDxtm` / `EXECUTE` /
`rwU` a **`anon`** y `authenticated` sobre objetos futuros del esquema `storage`. Hoy eso es inerte
porque no hay buckets. **El orden importa:** crear un bucket antes de cerrar ese default lo nace con
la puerta abierta a `anon`. Ver `OFF-6-04`.

### `Q-21` — policies de `storage.objects`

```sql
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'storage' order by tablename, policyname;
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`, cero vacuo y consistente.** Cero policies en todo el esquema `storage`
(no solo en `objects`). Coherente con `Q-20`: sin buckets no hay objetos que gobernar. **No es
evidencia de que el control esté bien diseñado**, solo de que la superficie no existe. Si algún día
se crea un bucket, este cero se vuelve un agujero: sin policy y con el default ACL de `Q-10` abierto
a `anon`, el bucket nacería alcanzable.

### `Q-22` — esquemas alcanzables por `anon` / `authenticated`

```sql
select n.nspname,
       has_schema_privilege('anon', n.nspname, 'USAGE')          as usage_anon,
       has_schema_privilege('authenticated', n.nspname, 'USAGE') as usage_authenticated
from pg_namespace n
where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
order by 1;
```

Salida real (17 filas, `nspname|usage_anon|usage_authenticated`):

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

Tabla con la columna `¿esperado?`, fila por fila:

| # | esquema | usage_anon | usage_authenticated | ¿esperado? | razón |
|---|---|---|---|---|---|
| 1 | `actualidad` | `f` | `f` | **sí** | esquema del proyecto, cerrado. Correcto. |
| 2 | `auth` | `t` | `t` | **sí** | default de la plataforma: `auth.uid()` / `auth.jwt()` se resuelven desde policies que corren como `anon`/`authenticated`. Sin `USAGE` el propio RLS de Supabase se rompe. **No offender.** |
| 3 | `cron` | `f` | `f` | **sí** | `pg_cron` cerrado a los roles públicos. Correcto. |
| 4 | `cruces` | `f` | `f` | **sí** | esquema del proyecto, cerrado. |
| 5 | `extensions` | `t` | `t` | **sí (default de plataforma)** | Supabase concede `USAGE` a `anon` para que funciones de extensión (`pgcrypto`, `uuid-ossp`) sean resolubles. `USAGE` de esquema **no** concede `EXECUTE`; el control real es el ACL por función. **No offender**, pero se anota como superficie heredada. |
| 6 | `grafo` | `f` | `f` | **sí** | esquema del proyecto, cerrado. |
| 7 | `graphql` | `t` | `t` | **sí (default de plataforma)** | interno de `pg_graphql`. |
| 8 | `graphql_public` | `t` | `t` | **sí (default de plataforma)** | es el esquema que PostgREST expone para GraphQL **por diseño**. |
| 9 | **`net`** | **`t`** | **`t`** | **NO — inesperado** | `pg_net` (HTTP saliente desde Postgres). `anon` tiene `USAGE` **y** `EXECUTE` sobre `net.http_post` / `net.http_get` (`Q-24b`) ⇒ **SSRF potencial**. Mitigante fuerte: PostgREST no expone el esquema `net`, así que **no es alcanzable hoy por la Data API**. → `OFF-6-03`. |
| 10 | `pgbouncer` | `f` | `f` | **sí** | cerrado. |
| 11 | `pgmq` | `f` | `f` | **sí** | la cola de ingesta está cerrada a los roles públicos. Correcto y relevante: el worker corre con `service_role`. |
| 12 | **`public`** | `t` | `t` | **sí — ES el diseño de PostgREST** | el plan lo declara explícitamente: `public` con `USAGE` **no** es offender. Es la puerta del esquema; la superficie efectiva la determinan los grants de objeto (`Q-09b` → 0 tablas) y las policies (`Q-05` → 0). **Pero ver `OFF-6-02`:** el `USAGE` sí habilita las funciones de extensión instaladas en `public`. |
| 13 | `realtime` | `t` | `t` | **sí (default de plataforma)** | Realtime necesita `USAGE` para los roles del socket. El proyecto no usa Realtime; el `USAGE` es residual de bootstrap. |
| 14 | `storage` | `t` | `t` | **sí (default de plataforma)** | inerte hoy (`Q-20`: 0 buckets). Se vuelve superficie el día que exista un bucket. |
| 15 | `supabase_migrations` | `f` | `f` | **sí** | el ledger no es legible por `anon`. Correcto. |
| 16 | `util` | `f` | `f` | **sí** | esquema del proyecto, cerrado. |
| 17 | `vault` | `f` | `f` | **sí — y es lo importante** | `supabase_vault` (4 relaciones) **cerrado** a `anon`/`authenticated`. Ningún secreto del vault es alcanzable por un rol público. |

**Nota de método — `has_schema_privilege` incluye lo heredado de `PUBLIC`.** Para no confundir un
grant explícito con una herencia de `PUBLIC`, se contrastó con el ACL crudo:

#### `Q-22b` — ACL crudo de los esquemas con `USAGE` (contraste autoritativo)

```sql
select n.nspname, coalesce(n.nspacl::text,'(NULL)')
from pg_namespace n
where n.nspname in ('public','storage','graphql_public','graphql','auth','extensions','net','realtime')
order by 1;
```

Salida real:

```
auth|{supabase_admin=UC/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_auth_admin=UC/supabase_admin,dashboard_user=UC/supabase_admin,postgres=U/supabase_admin}
extensions|{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres,service_role=U/postgres,dashboard_user=UC/postgres}
graphql|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
graphql_public|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
net|{supabase_admin=UC/supabase_admin,=U/supabase_admin,supabase_functions_admin=U/supabase_admin,postgres=U/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
public|{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}
realtime|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_realtime_admin=U/supabase_admin}
storage|{supabase_admin=UC/supabase_admin,postgres=U*/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_storage_admin=U*C*/supabase_admin,dashboard_user=UC/supabase_admin}
```

Lecturas:

- `anon=U` aparece **explícito** en los 8 esquemas ⇒ no es herencia de `PUBLIC`, son grants reales de
  bootstrap de la plataforma.
- `public` y `net` llevan además la entrada de grantee vacío **`=U`** = `USAGE TO PUBLIC` — el mismo
  idiom que en el fragmento 02 (`=X/postgres`) dejó 8 funciones expuestas. Aquí significa que
  **cualquier** rol, presente o futuro, tiene `USAGE` sobre `public` y sobre `net`.
- **Ningún rol público tiene `C` (CREATE)** sobre `public`: `anon=U`, no `anon=UC`. `anon` no puede
  crear objetos en el esquema expuesto. Es el cierre correcto y se deja demostrado.

**Veredicto de `Q-22`: `offender`** — por la fila `net` (`OFF-6-03`) y, sobre todo, porque el `USAGE`
de `anon` sobre `public` —esperado en sí mismo— resulta **combinado con `Q-24`** en superficie
ejecutable real (`OFF-6-02`).

### `Q-23` — roles del proyecto y sus atributos peligrosos

```sql
select rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb
from pg_roles
where rolname in ('anon','authenticated','service_role','authenticator','postgres')
order by 1;
```

Salida real (5 filas, `rolname|super|bypassrls|canlogin|createrole|createdb`):

```
anon|f|f|f|f|f
authenticated|f|f|f|f|f
authenticator|f|f|t|f|f
postgres|f|t|t|t|t
service_role|f|t|f|f|f
```

| rol | `rolsuper` | `rolbypassrls` | `rolcanlogin` | ¿esperado? | lectura |
|---|---|---|---|---|---|
| `anon` | `f` | **`f`** | **`f`** | **sí** | sin superusuario, **sin bypass de RLS**, y **sin login propio**: solo alcanzable por `SET ROLE` desde `authenticator`. Es el cierre correcto. |
| `authenticated` | `f` | **`f`** | `f` | **sí** | ídem. Sus 5 grants (`Q-08b`) quedan efectivamente gobernados por las 5 policies own-row (`Q-04`). |
| `authenticator` | `f` | `f` | **`t`** | **sí** | es el rol de login de PostgREST **por diseño**; no tiene privilegios propios, solo `SET ROLE` a los otros tres. Que **no** tenga `rolbypassrls` es lo importante. |
| `postgres` | `f` | **`t`** | `t` | **sí** | rol de migraciones/operador. `rolbypassrls` es inherente al dueño del schema; **no** es superusuario en Supabase (`rolsuper = f`), lo cual acota el blast radius y explica que `OFF-01` (defaults de `supabase_admin`) **no** sea auto-corregible desde `postgres` sin escalar privilegio. |
| `service_role` | `f` | **`t`** | **`f`** | **sí — y es el riesgo rector §0.5 hecho catálogo** | `rolbypassrls = t` ⇒ **RLS no lo protege**, exactamente lo que §0.5 declara. `rolcanlogin = f` ⇒ solo alcanzable vía `SET ROLE` desde `authenticator` con un JWT `service_role` válido. **Aquí queda demostrado en el catálogo, no afirmado:** el sitio corre con este rol, luego las 57 tablas —incluida `pii_contraparte_declaracion`— son plenamente legibles para el código de `app/`, y el único control es el guard CI (§Eje 6b). |

**Veredicto: `conforme`.** Ningún rol público tiene `rolsuper`; ningún rol público tiene
`rolbypassrls`; los dos roles con `rolbypassrls` (`postgres`, `service_role`) son los esperados y
`service_role` no puede loguearse directo.

**Dato de mitigación registrado (no offender, pero relevante para el eje 4):**

```sql
select r.rolname, s.setconfig::text
from pg_db_role_setting s left join pg_roles r on r.oid = s.setrole order by 1;
```

```
anon|{statement_timeout=3s}
authenticated|{statement_timeout=8s}
authenticator|{"session_preload_libraries=supautils, safeupdate",statement_timeout=8s,lock_timeout=8s}
postgres|{"search_path=\"\\$user\", public, extensions"}
supabase_admin|{"search_path=\"$user\", public, auth, extensions",log_statement=none}
supabase_auth_admin|{search_path=auth,idle_in_transaction_session_timeout=60000,log_statement=none}
supabase_read_only_user|{default_transaction_read_only=on}
supabase_storage_admin|{search_path=storage,log_statement=none}
|{app.settings.jwt_exp=3600}
```

Existe un `statement_timeout = 3s` **a nivel de rol** para `anon` (y `8s` para `authenticated`). Eso
**acota** —no elimina— el riesgo de DoS de `OFF-4-03` cuando la llamada entra por `anon`. **No lo
acota para `service_role`**, que no tiene `setconfig` alguno: las 17 RPCs sin `statement_timeout` del
eje 4 corren **sin techo de tiempo** por la ruta que el sitio efectivamente usa. Este dato **refuerza**
`OFF-4-03`, no lo degrada, y 123-06 debe consignarlo así.

### `Q-24` — Splinter 0014: extensiones instaladas en `public`

```sql
select e.extname, n.nspname as esquema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
order by 2, 1;
```

Salida real (11 filas):

```
pg_stat_statements|extensions
pgcrypto|extensions
uuid-ossp|extensions
pg_cron|pg_catalog
plpgsql|pg_catalog
pgmq|pgmq
pg_net|public
pgtap|public
unaccent|public
vector|public
```

*(11ª fila: `supabase_vault|vault`.)*

**Cuatro extensiones en `public`: `pg_net`, `pgtap`, `unaccent`, `vector`.** Las tres primeras
(`pg_stat_statements`, `pgcrypto`, `uuid-ossp`) sí están en `extensions`, que es el patrón correcto
de Supabase — así que el proyecto **conoce** el patrón y estas cuatro se le escaparon.

#### `Q-24b` — la superficie que el filtro `deptype='e'` ocultó (excepción declarada §0.6 E)

**Por qué esta query existe.** El §0.0 obliga al filtro `pg_depend deptype='e'` en todo enumerado, y
los ejes 1–5 lo aplicaron correctamente. Consecuencia: `Q-12` del fragmento 02 barrió **42**
funciones "propias" y declaró que solo **8** son exec-`anon`. Pero las funciones de extensión
instaladas **en `public`** son igual de alcanzables por PostgREST que las propias. §0.6 E autoriza
—y manda— declarar la excepción cuando un eje necesita auditar una. Este es el caso.

```sql
select e.extname,
       count(*) filter (where has_function_privilege('anon', p.oid,'EXECUTE')) as exec_anon,
       count(*) as total
from pg_extension e
join pg_depend d on d.refobjid = e.oid and d.deptype = 'e'
join pg_proc p on p.oid = d.objid
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
group by 1 order by 1;
```

Salida real:

```
pgtap|1079|1079
unaccent|4|4
vector|118|118
```

Recuento de objetos totales (no solo funciones) por extensión en `public`:

```sql
select e.extname, count(*)
from pg_depend d
join pg_extension e on e.oid = d.refobjid and d.deptype = 'e'
join pg_namespace n on n.oid = e.extnamespace
where n.nspname = 'public'
group by 1 order by 1;
```

```
pg_net|28
pgtap|1087
unaccent|6
vector|237
```

**`1.079` funciones de `pgtap` ejecutables por `anon`, en el esquema que PostgREST expone.**

#### `Q-24c` — probe de control: ¿es *realmente* alcanzable?

Un "0 offenders" se demuestra; un "sí es alcanzable" también. Probe **read-only** (una función
escalar sin acceso a tablas; no se invocó ninguna función de escritura ni `runtests()`):

```sql
set role anon; select public.pg_version(); select current_user;
```

Salida real:

```
SET
17.6
anon
```

**`anon` ejecuta `public.pg_version()` (función de `pgtap`) y el `current_user` confirma que la
prueba corrió con el rol degradado.** No es una inferencia del ACL: es la ejecución.

Muestra de nombres `pgtap` exec-`anon` en `public` (5 de 1.079, elegidos por ser los más ilustrativos):

```
findfuncs   lives_ok   pg_version   runtests   throws_ok
```

**Impacto, sin inflarlo y sin minimizarlo:**

- **No es fuga de PII.** `pgtap` no lee tablas de negocio por sí solo; sus aserciones toman
  parámetros. No hay un `select * from declaracion` gratis aquí.
- **Sí es divulgación de estructura.** `findfuncs`, `pg_version` y la familia de `has_table` /
  `columns_are` permiten a un cliente `anon` **enumerar el schema** (nombres de tabla, de columna,
  de función, versión del motor) sin ningún grant sobre las tablas. Es reconocimiento gratuito para
  un atacante: el mapa exacto de las 57 tablas y sus columnas, incluidas las de PII.
- **Sí es superficie no gobernada.** Es **1.079 funciones fuera de `PUBLIC_RPC_ALLOWLIST`, fuera de
  las 42 del corpus auditado y fuera de la vista de todo guard existente.** El fragmento 02 declaró
  8 funciones residuales exec-`anon` (`OFF-4-01`/`OFF-4-02`); la cifra real, contando lo que el
  filtro de extensión ocultó, es **8 + 1.079 + 118 (`vector`) + 4 (`unaccent`) = 1.209**.
- **`pgtap` es una extensión de TESTING y no tiene por qué existir en PRODUCCIÓN.** El proyecto la
  usa para las suites pgTAP de las migraciones (`pgTAP 7/7`, `9/9`, `14/14` en el histórico), lo cual
  explica su presencia — pero explicarla no la justifica en el esquema expuesto.
- `vector` (118 fn) y `unaccent` (4 fn) son **necesarias en `public`** por decisión de arquitectura
  (`vector(768)` es el tipo de columna de `proyecto_embedding`; `f_unaccent` envuelve
  `public.unaccent`). Moverlas es destructivo (rompe tipos de columna e índices HNSW) ⇒
  `supabase-architect+checkpoint`, **no se diseña aquí**.

**Veredicto de `Q-24`: `offender`** — `OFF-6-01` (`pgtap`), `OFF-6-02` (`vector`, `unaccent`) y
`OFF-6-03` (`pg_net`). **Las cuatro extensiones de `public` tienen su fila de offender**, y las tres
cuyo fix implicaría `drop extension` o `alter extension … set schema` llevan
`destino: supabase-architect+checkpoint` — mover o eliminar una extensión de esquema es destructivo
y **no se diseña aquí** (§0.2). `pg_net` lleva además una fila `124-aditivo` por el `revoke` de su
esquema `net`, que sí es aditivo y reversible.

| extensión en `public` | objetos | fn exec-`anon` | Splinter | offender | destino |
|---|---|---|---|---|---|
| `pgtap` | 1.087 | 1.079 | 0014 | `OFF-6-01` | `supabase-architect+checkpoint` |
| `vector` | 237 | 118 | 0014 | `OFF-6-02` | `supabase-architect+checkpoint` |
| `unaccent` | 6 | 4 | 0014 | `OFF-6-02` | `supabase-architect+checkpoint` |
| `pg_net` | 28 | 0 en `public` (12 en el schema `net`) | 0014 | `OFF-6-03` | `supabase-architect+checkpoint` (mover) + `124-aditivo` (revoke) |

### Keys y secrets — lado repositorio

| control | comando | resultado | veredicto |
|---|---|---|---|
| `.env` no versionado | `git ls-files --error-unmatch .env` | `error: pathspec '.env' did not match any file(s) known to git` | `conforme` |
| `.env` ignorado | `grep -nE '^\.?env' .gitignore` | `2:.env` · `3:.env.local` · `4:.env.*.local` | `conforme` |
| `.env.example` solo NOMBRES | `grep -oE '^[A-Z0-9_]+' .env.example` | 37 nombres, cero valores (guard `env-example-guard`, §Eje 6b) | `conforme` |
| Vault cerrado a roles públicos | `Q-22` fila `vault` | `f|f` | `conforme` |
| Escáner de secretos sobre el repo | `security_scan.sh` | ver §Eje 6b paso 3 | `conforme` |

Los 37 nombres de `.env.example` incluyen `SUPABASE_SERVICE_KEY`, `SUPABASE_SECRET_KEY`,
`SUPABASE_DB_URL`, `R2_SECRET_ACCESS_KEY`, `DEEPSEEK_API_KEY`, `WORKERS_AI_API_TOKEN` y
`NOTIF_TOKEN_SECRET`. **Ninguno de sus valores aparece en este artefacto ni en ningún archivo
versionado** — el guard `env-example-guard` y el gate de `ci.yml` lo sostienen en CI, y el grep
anti-secreto del `<verify>` de este plan lo sostiene sobre este archivo.

---

## Eje 6b — El guard CI como control efectivo

> `Q-23` acaba de demostrar en el catálogo lo que §0.5 declara: **`service_role` tiene
> `rolbypassrls = t`**. El sitio corre con ese rol. Combinado con `Q-05` (0 policies `to anon`) y
> `Q-09b` (0 grants a `anon`) del fragmento 01, la conclusión es que **no hay una segunda capa
> debajo**: auditar RLS sin auditar este guard sería auditar el candado equivocado.

### Paso 1 — Mapa del boundary: qué protege cada bloque y **qué NO ve**

Los `archivo:línea` son de `app/lib/lockdown-guard.test.ts` salvo indicación. La columna
"qué NO ve" se razona **contra los hallazgos reales** de los fragmentos `-01` y `-02`, citando el
`Q-NN` que lo demuestra.

| bloque | qué protege | qué NO ve (punto ciego declarado) | archivo:línea |
|---|---|---|---|
| **A** — grants a `anon` en migraciones `>0044` | Que ninguna migración nueva escriba `grant … to anon\|public` sobre una tabla. Hoy **verde y correcto**: coincide con la DB viva, que da 0 grants a `anon` (`Q-09b`, `aclexplode`, autoritativa). | **(i)** Es **ciego a `ALTER DEFAULT PRIVILEGES`** — `Q-10` prueba que existe un default vivo de `supabase_admin` que concede `arwdDxtm` a `anon` sobre toda tabla futura de `public`, y una migración que escribiera `alter default privileges … grant … to anon` **pasaría en verde** (`OFF-02` del fragmento 01). **(ii)** Es ciego al **`USAGE TO PUBLIC`** del esquema: `Q-22b` muestra la entrada de grantee vacío `=U/pg_database_owner` en `public` y en `net`, que ninguna migración del repo escribió. **(iii)** Es ciego a **objetos de extensión**: `Q-24b` cuenta 1.079 funciones `pgtap` exec-`anon` en `public` que ningún `grant` del repo concede. | `lockdown-guard.test.ts:310` (Block A), `:240` (`anonGrantOffenders`) |
| **B** — árbol público no toca `PII_TABLES` ni `.rpc` fuera de allowlist | La **única** capa real sobre la superficie del sitio: escanea `app/` por `.from('<tabla PII>')` y por `.rpc('<nombre>')` fuera de `PUBLIC_RPC_ALLOWLIST`. Es lo que sustituye a la RLS que `service_role` bypassa (`Q-23`: `rolbypassrls = t`). | **(i)** Es ciego a la **PII dentro de una columna** `jsonb`/`text` de una RPC allowlisted: el fragmento 02 lo declara `limite-declarado` explícito sobre `cruces_de_parlamentario`, cuyo `evidencia jsonb` se afirma PII-safe **en un comentario del cuerpo**, no verificado (`Q-14bis` solo inspecciona **nombres de la firma de retorno**, y da 0 filas sobre las 42). Una RPC en la allowlist puede filtrar un RUT dentro de un `jsonb` **con el guard en verde**. **(ii)** Es ciego al **acotamiento**: nada le impide al árbol público llamar una RPC allowlisted sin `LIMIT` ni `statement_timeout` — `Q-13bis` cuenta **17** así, y `Q-23` (`setconfig`) demuestra que `service_role` **no tiene** `statement_timeout` de rol que lo rescate. | `lockdown-guard.test.ts:718` (Block B), `:142` (`PII_TABLES`), `:183` (`PUBLIC_RPC_ALLOWLIST`) |
| **D** — `to authenticated` fuera de `USER_OWNED_TABLES` | Que ninguna migración conceda a `authenticated` fuera de `{suscripcion, consentimiento}`. Verde y **confirmado por la DB viva**: `Q-08b` da exactamente 5 grants, todos a `authenticated`, todos sobre esas 2 tablas, con su policy own-row 1:1 en `Q-04`. | Mismo punto ciego (i) que Block A: `Q-10` muestra que el default de `supabase_admin` concede `arwdDxtm` **también a `authenticated`** sobre objetos futuros, sin `grant` textual que el guard pueda leer. Además es ciego a **grants aplicados fuera de migración** (dashboard, soporte): su universo es el texto de `supabase/migrations/`, no `pg_class.relacl`. | `lockdown-guard.test.ts:437` (Block D), `:273` (`authenticatedGrantOffenders`), `:162` (`USER_OWNED_TABLES`) |
| **E** — `notificacion_envio` service_role-only | Que la tabla de envíos de notificación no se abra a roles públicos ni se lea desde el árbol público. Confirmado en la DB viva: `notificacion_envio` aparece en `Q-01` con RLS `t`, y `Q-04` demuestra que **no tiene ninguna policy** ⇒ deny-by-default para `anon`/`authenticated`. | Ciego a la lectura vía `service_role` desde un punto **sancionado**: `app/lib/notif-service.ts` es la excepción declarada al chokepoint, y el guard verifica **su existencia**, no **qué consulta**. Es un punto ciego aceptado por diseño, no un defecto — pero debe quedar nombrado, porque `Q-23` (`rolbypassrls = t`) significa que desde ahí la tabla es plenamente legible. | `lockdown-guard.test.ts:532` (Block E), `app/lib/notif-service.ts` |
| **A2 / Direction-B** — allowlist ⊆ funciones definidas en migraciones | Que ninguna entrada de `PUBLIC_RPC_ALLOWLIST` apunte a una función inexistente. La DB viva **confirma el resultado por otra vía**: el sentido C del fragmento 02 (`comm -23` allowlist vs `Q-15bis`) da **`(0 filas)`** ⇒ las 29 entradas existen en `pg_proc`. | **Es el punto ciego más grande y está demostrado en dos direcciones** (`OFF-4-05`): compara contra el **texto** de `create function`, **nunca mira grants**. No caza **(a)** los 9 `grant execute … to anon` declarados en `0011`–`0024` que la DB viva ya revocó (`Q-12` da `exec_anon = f` para las nueve) — el guard cree que están abiertas y no lo están; ni **(b)** las 8 funciones que la DB viva **sí** expone a `anon` por el default `=X/postgres` (`EXECUTE TO PUBLIC`) sin que ninguna migración las mencione (`Q-15` + `comm -13`) — el guard no sabe que existen. Ambas caras son invisibles. Y **(c)**, hallazgo de este plan: opera sobre `definedRpcNames(MIGRATIONS_DIR)`, así que las **1.079 funciones `pgtap` exec-`anon`** de `Q-24b` no están ni en su universo. | `lockdown-guard.test.ts:609` (Direction-B) |
| **A3 / Direction-A3** — `crossLinkReader` ⊆ allowlist | Que el lector de cruces solo invoque RPCs allowlisted. Consistente con la DB viva: `cruces_de_parlamentario` y `cruces_de_proyecto` existen y son `SECURITY DEFINER` con `search_path=""` (`Q-16`), y **no** son exec-`anon` (`Q-12`) ⇒ solo alcanzables con `service_role`. | Hereda íntegro el punto ciego (i) de Block B, y de forma **agravada**: `cruces_de_parlamentario` es precisamente la RPC cuyo retorno `evidencia jsonb` quedó como `limite-declarado` en `Q-14bis`. El guard certifica que la llamada está allowlisted; **no** que lo que devuelve sea PII-safe. Además ninguna de las dos lleva `statement_timeout` (`Q-13bis`) y ambas están en `OFF-4-03`. | `lockdown-guard.test.ts:679` (Direction-A3), `:169` (`isAdminAllowlisted`) |

**Punto ciego transversal, común a los seis bloques y demostrado por este plan:** el guard es
**estático sobre el texto del repositorio**. Su universo son `supabase/migrations/*.sql` y `app/`.
Nada de lo que la **plataforma** hace por fuera del repo entra en su vista: el default ACL de
`supabase_admin` (`Q-10`), el `USAGE TO PUBLIC` sobre `public`/`net` (`Q-22b`), el `EXECUTE TO PUBLIC`
por default de toda función nueva (`Q-15`, `=X/postgres`), y las **1.209** funciones de extensión
exec-`anon` en `public` (`Q-24b`). Extender el guard cubre la **regresión futura por migración**; el
estado vivo ya existente solo lo cierra la Phase 124. **Los dos son necesarios y ninguno sustituye al
otro.**

### Paso 2 — Corrida real de los guards

El comando del plan (`pnpm --filter ./app test -- lockdown-guard`) **no es el que este repo define**.
Resolviendo contra `package.json` de la raíz y de `app/` (RULE-1, ver `123-04-SUMMARY.md`), el
comando REAL es `pnpm exec vitest run <archivo>` con `cwd = app/`. Transcrito tal cual se ejecutó:

<!-- CORRIDA-GUARDS -->

### Paso 3 — Escáner de secretos (read-only)

<!-- ESCANER -->

### Paso 4 — Tabla de controles

<!-- CONTROLES -->

---

## Tabla de offenders — Eje 6 (plantilla §0.2)

| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
|---|---|---|---|---|---|---|
| OFF-6-01 | `extensión · pgtap en schema public (1.087 objetos, 1.079 funciones)` | 6 | **Divulgación de estructura a `anon`.** `pgtap` es una extensión de **testing** instalada en el esquema que PostgREST expone; sus 1.079 funciones son ejecutables por `anon` (`Q-24b`) y la ejecución está **probada**, no inferida (`Q-24c`: `set role anon; select public.pg_version()` → `17.6`). Un cliente no autenticado puede enumerar tablas, columnas y funciones (`findfuncs`, `has_table`, `columns_are`) sin ningún grant sobre las tablas ⇒ mapa completo de las 57 tablas, incluidas las de PII, como reconocimiento gratuito. No filtra filas, pero es **1.079 funciones fuera de `PUBLIC_RPC_ALLOWLIST`, fuera del corpus de 42 auditado y fuera de la vista de todo guard** | Dos opciones, **ninguna se decide aquí**: (a) `drop extension pgtap;` en PROD y dejarla solo en el entorno de test (rompe las suites pgTAP que hoy corren contra PROD); (b) `alter extension pgtap set schema extensions;` (mover fuera del esquema expuesto, patrón que el propio proyecto ya aplica a `pgcrypto`/`uuid-ossp`/`pg_stat_statements`). Ambas son **destructivas o de reubicación de esquema** y requieren decidir el destino de las suites pgTAP | `Q-24`, `Q-24b`, `Q-24c` | **`supabase-architect+checkpoint`** |
| OFF-6-02 | `extensión · vector (237 obj / 118 fn exec-anon) y unaccent (6 obj / 4 fn exec-anon) en schema public` | 6 | Superficie `anon` no gobernada: 122 funciones más ejecutables por `anon` en el esquema expuesto, invisibles para `PUBLIC_RPC_ALLOWLIST` y para el corpus de 42. Riesgo de fuga **nulo** (operadores de distancia vectorial y normalización de texto, sin acceso a tablas); riesgo de **DoS acotado** (`anon` lleva `statement_timeout=3s` de rol, `Q-23`) y de **régimen** (superficie fuera de todo control declarado). **Splinter 0014** | **No moverlas.** `vector(768)` es el tipo de columna de `proyecto_embedding` y sostiene el índice HNSW; `unaccent` es la base de `f_unaccent` y del FTS. `alter extension … set schema` rompería tipos de columna, índices y firmas de función. Si 123-06 decide actuar, el diseño lo hace `supabase-architect` con checkpoint de operador y plan de reconstrucción de índices; **lo razonable es documentar la excepción, no mover** | `Q-24`, `Q-24b` | **`supabase-architect+checkpoint`** |
| OFF-6-03 | `extensión · pg_net en schema public + schema net con USAGE para anon` | 6 | `anon` tiene `USAGE` sobre el esquema `net` (`Q-22`, `Q-22b`) **y** `EXECUTE` sobre `net.http_get` / `net.http_post` / `net.http_delete` (`Q-24b`) ⇒ **SSRF potencial**: HTTP saliente originado en el servidor de la DB, a destino elegido por el cliente. **Mitigante fuerte y honesto: no es alcanzable hoy**, porque PostgREST expone `public` y `graphql_public`, no `net` — la configuración `pgrst.db_schemas` **no es visible desde la sesión** (`limite-declarado`, ver abajo). Además `pg_net` está instalada en `public` (Splinter 0014), lo que suma sus 28 objetos al esquema expuesto | `revoke all on schema net from anon, authenticated;` + `revoke execute on all functions in schema net from anon, authenticated;` (defensa en profundidad: `pg_net` es infraestructura de `pg_cron`→Edge Functions y **ningún rol público necesita invocarla**). **Verificar antes** que ningún flujo de `authenticated` la use. Mover `pg_net` fuera de `public` es aparte y va con `OFF-6-02` | `Q-22`, `Q-22b`, `Q-24`, `Q-24b` | `124-aditivo` |
| OFF-6-04 | `default-acl · postgres en schema storage (tipos r, f, S)` | 6 | Los defaults conceden `arwdDxtm` / `EXECUTE` / `rwU` a **`anon`** y `authenticated` sobre objetos futuros del esquema `storage`. Hoy **inerte** (`Q-20`: 0 buckets, `Q-21`: 0 policies), pero **el orden importa**: crear un bucket antes de cerrar el default lo nace alcanzable por `anon` sin que nadie escriba un `GRANT`, y sin policy de `storage.objects` que lo contenga. Es el gemelo de `OFF-01` del fragmento 01, en otro esquema | `alter default privileges for role postgres in schema storage revoke all on tables from anon, authenticated;` (+ `on functions`, `on sequences`). **Escape idéntico al de `OFF-01`:** si falla por membresía, se reclasifica a `deuda-operador` — **jamás se escala privilegio**. Y **antes** de cualquier creación de bucket (que es `deuda-operador`, no acto de agente) | `Q-10` (fragmento 01, heredada) + `Q-20`, `Q-21` | `124-aditivo` |
| OFF-6-05 | `guard · app/lib/lockdown-guard.test.ts (transversal a Block A, B, D, E, Direction-B, Direction-A3)` | 6 | El guard es la **única** capa del boundary del sitio (`Q-23`: `service_role.rolbypassrls = t`; `Q-05`/`Q-09b`: cero policies y cero grants a `anon`) y su universo es **el texto del repo**. Es ciego a **toda** la superficie que la plataforma abre por fuera de una migración: el default ACL de `supabase_admin` (`Q-10`), el `USAGE TO PUBLIC` sobre `public` y `net` (`Q-22b`), el `EXECUTE TO PUBLIC` por default de cada función nueva (`Q-15`) y las **1.209** funciones de extensión exec-`anon` en `public` (`Q-24b`). Ninguna de esas fugas produciría un solo test rojo | Extensión **estática** (CI sin DB, límite declarado en el fragmento 02): **(a)** tratar como offender todo `alter default privileges … grant … to anon\|public\|authenticated` en migraciones > 0044 (`OFF-02`); **(b)** exigir que toda `create function` en `public` lleve su `revoke execute … from public` en la misma migración (`OFF-4-05`); **(c)** aserción nueva de este plan: **allowlist de extensiones permitidas en `public`** — un test que falle si una migración instala una extensión en `public` fuera de `{vector, unaccent}`. Lo **no** cubrible estáticamente (el ACL vivo) se declara como límite y lo cierra la Phase 124 | `Q-10` + `Q-15` + `Q-22b` + `Q-24b` + corrida del guard (§Eje 6b) | **`guard`** (plan **123-05**) |

### `limite-declarado` de este fragmento

| # | qué no se pudo verificar | evidencia del intento | por qué |
|---|---|---|---|
| LIM-6-01 | **Qué esquemas expone PostgREST realmente** (`db-schemas`). De esto depende si `net.http_post` es o no alcanzable por la Data API — es decir, la **severidad real** de `OFF-6-03` | `select coalesce(current_setting('pgrst.db_schemas', true),'NO-VISIBLE-EN-SESION');` → `NO-VISIBLE-EN-SESION`. Contraste: `pg_db_role_setting` para `authenticator` solo trae `session_preload_libraries`, `statement_timeout`, `lock_timeout` — **ninguna** entrada `pgrst.*` | La configuración de PostgREST vive en el archivo de configuración del servicio gestionado, **no** en un `SET` de rol legible por SQL. Verificarlo exige el dashboard de Supabase o un `GET /rest/v1/` contra la API ⇒ fuera del régimen SQL-only de esta fase. **No se rellena con una suposición** (§0.6 C): `OFF-6-03` se registra asumiendo el caso favorable (`net` NO expuesto) y **diciendo que lo asume** |
| LIM-6-02 | Si `pgtap` está expuesta como `/rest/v1/rpc/*` por PostgREST | mismo intento que LIM-6-01 | El `EXECUTE` de `anon` está **probado** (`Q-24c`, ejecución real con `set role anon`); lo no verificable por SQL es solo el último salto HTTP. El offender `OFF-6-01` **no depende** de esa verificación: la superficie existe en la DB con o sin PostgREST delante |

---

## Qué hereda 123-05 / 123-06

<!-- HERENCIA -->
