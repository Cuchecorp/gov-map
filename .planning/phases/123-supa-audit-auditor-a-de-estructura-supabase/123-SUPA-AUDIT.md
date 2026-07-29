---
fase: 123
requisito: SUPA-01
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC; PostgreSQL 17.6)"
veredicto_gate: "APROBADO — PASS CON RESERVAS (subagente `supabase-reviewer`); NO autoriza a la Phase 124 a aplicar nada hasta cumplir 3 precondiciones"
fragmentos: [00, 01, 02, 03, 04]
offenders_totales: 13
manifiesto_ssot: .supabase-ops.yaml
---

# 123 — SUPA-AUDIT · Auditoría de estructura Supabase (deliverable de SUPA-01)

> **Artefacto consolidado y auto-contenido.** Toda consulta está **transcrita verbatim** con su
> salida real: este documento se re-ejecuta sin abrir los fragmentos. Los cinco fragmentos
> (`123-SUPA-AUDIT-00`…`-04`) siguen siendo la evidencia de origen; esto es su consolidación.
>
> **El gate de la fase es el veredicto del subagente `supabase-reviewer`**, no una opinión
> consultiva: [`123-SUPA-REVIEWER-VEREDICTO.md`](./123-SUPA-REVIEWER-VEREDICTO.md).

---

## Método y régimen declarados

Copiado de §0.0/§0.0.1 del fragmento rector `123-SUPA-AUDIT-00-METODO.md`.

| Propiedad | Valor |
|-----------|-------|
| Método | **SQL verbatim read-only contra PROD** (`psql`) sobre los catálogos del sistema |
| Acceso a PROD Postgres | solo `SELECT`. **Cero DDL, cero DML**, cero `supabase db push`, cero `db reset` |
| Invocación psql | `set -a; source .env; set +a` y luego `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"` — **jamás se ecoa, expande ni escribe el valor de `SUPABASE_DB_URL`**; aquí aparece solo el **nombre** de la variable |
| Fuente de verdad | la **DB VIVA**, nunca `supabase/migrations` (ver §El ledger miente) |
| Filtro obligatorio | al enumerar objetos, **SIEMPRE** `not exists (select 1 from pg_depend d where d.objid=<oid> and d.deptype='e')` — excluye objetos de extensión. **Excepción invocada en el eje 6** (§0.6 E) |
| Conteo por REST | **prohibido** (PostgREST capa a 1.000 filas). Todo conteo va por `psql -tA` |
| PII | **cero**: nombres de objeto y de columna y agregados; **jamás valores** |
| Requests a fuentes gubernamentales | **cero** ⇒ el rate-limit 2-3 s de CLAUDE.md no aplica a esta fase |
| Flags | **no se tocó ningún `*_PUBLIC_ENABLED`**. Los gates se **observan**, no se cambian |
| Deploy | **no se hace en esta fase** (Phase 125) |
| Fixes | **no se hacen en esta fase** (Phase 124), salvo **extender un guard** (planes 123-05 y 123-06, patrón "guard primero") |
| Instalación de paquetes | **cero** |

**Ancla temporal — ejecutada, no asumida:**

```sql
select now()::date, current_setting('TimeZone'), version();
```

```
2026-07-29|UTC|PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

### Vocabulario LOCKED de veredicto

| veredicto | significado |
|-----------|-------------|
| `conforme` | el eje cumple el régimen — con la **query verbatim** que lo demuestra |
| `offender` | desviación detectada — fila en la tabla de offenders con objeto, riesgo, fix y destino |
| `limite-declarado` | no verificable desde esta fase — **con la evidencia del intento** |

**Regla dura (anti-"todo bien"), verbatim:**

> **"0 offenders" solo vale si la query que lo demuestra está transcrita verbatim. Una sección con
> `conforme` y sin bloque ```sql asociado es INVÁLIDA y el plan 123-06 debe rechazarla.**

**Aplicación de la regla en esta consolidación:** se revisaron los cuatro fragmentos buscando algún
eje `conforme` sin su bloque ```sql. **No se encontró ninguno** — los cinco ceros de los ejes 1-2,
los tres del eje 5 y los siete del eje 6 llegaron todos con su query y su salida. **Nada fue
rechazado**; la regla se evaluó y no se gatilló.

**Vocabulario cerrado de `destino` — cuatro valores, ninguno más:**
`124-aditivo` · `supabase-architect+checkpoint` · `guard` · `deuda-operador`.

### El ledger miente — `schema_migrations` DEMOSTRADO

**`Q-00a` — lo que el ledger DECLARA:**

```sql
select version from supabase_migrations.schema_migrations order by version;
```

Salida real (**55 filas**): `0001`–`0025`, `0032`–`0051`, `0053`–`0058`, `0069`–`0072`.

El repo contiene **70 archivos** (`ls supabase/migrations | sed 's/_.*//' | sort`). **15 migraciones
existen como archivo y NO figuran en el ledger** — `0026`, `0028`, `0030`, `0031`, `0052` y todo el
tramo `0059`–`0068`. Además `0027` y `0029` no existen en ninguna de las dos caras: la numeración del
repo tiene huecos propios, así que "contar archivos" tampoco sirve como control.

**`Q-00c` — prueba de existencia de objeto (la DB viva contradice al ledger):**

```sql
select '0059', to_regclass('public.parlamentario_bio') is not null
union all select '0060', to_regproc('public.parlamentario_publico_v2') is not null
union all select '0061', to_regproc('public.cruces_de_proyecto')       is not null
union all select '0062', to_regproc('public.lobby_menciones_de_boletin') is not null
union all select '0063', to_regproc('public.lobby_menciones_de_boletin') is not null
union all select '0064', exists(select 1 from pg_proc p
                                join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname = 'public'
                                  and p.proname = 'co_comisionados_de_parlamentario'
                                  and array_to_string(p.proconfig, ',') like '%statement_timeout%')
union all select '0065', to_regclass('public.actualidad_senal')          is not null
union all select '0066', to_regproc('public.actualidad_senales_panel')   is not null
union all select '0067', to_regproc('public.militancia_historica_compartida') is not null
union all select '0068', to_regproc('public.coincidencia_votos_par')     is not null
order by 1;
```

Salida real — **las diez dan `t`**:

```
0059|t   0060|t   0061|t   0062|t   0063|t   0064|t   0065|t   0066|t   0067|t   0068|t
```

**Conclusión escrita, verbatim:**

> **Leer los archivos de migración da una foto FALSA. `supabase_migrations.schema_migrations` está
> incompleta y NO es fuente de verdad. La DB viva manda: toda aserción de la Phase 123 se demuestra
> con una consulta a los catálogos de PROD, jamás leyendo `supabase/migrations`.**

**Corolario para la Phase 124:** la numeración de las migraciones de fix arranca en **`0073`**
(siguiente al último **archivo del repo**, no al último del ledger), y ninguna migración de 124 puede
asumir el estado a partir del ledger.

### Riesgo rector que hereda toda la fase (§0.5, verbatim)

> El sitio público lee con **`service_role`** (Camino A, v4.0) ⇒ **RLS no lo protege.** La PII está
> protegida por el **guard CI** (`app/lib/lockdown-guard.test.ts`) que escanea `app/` por `.from` de
> tablas PII y `.rpc` fuera de `PUBLIC_RPC_ALLOWLIST`. **Ese guard es parte del boundary y entra en
> la auditoría (eje 6).**

`Q-23` lo convierte en **hecho de catálogo**: `service_role.rolbypassrls = t`. Ya no es una
afirmación de arquitectura heredada; está en `pg_roles`.

### Corpus auditado

**57 tablas** y **42 funciones** en `public` (filtro `deptype='e'` aplicado, transcrito en
`.supabase-ops.yaml`). Los ejes 1-3 barren las **57/57**; los ejes 4-5 las **42/42**. **Cero
subconjuntos, cero `limite-declarado` por cobertura.**

---

## Eje 1 — Schema

**`Q-01` — inventario de tablas con su estado de RLS:**

```sql
select c.relname,
       c.relrowsecurity   as rls_habilitada,
       c.relforcerowsecurity as rls_forzada,
       (select count(*) from pg_attribute a
         where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as n_columnas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by c.relrowsecurity asc, c.relname;
```

Salida real: **57 filas, todas con `rls_habilitada = t`** (el orden `asc` pondría primero cualquiera
sin RLS; no hay ninguna). Solo **tres** llevan `relforcerowsecurity = t`: `identidad_audit`,
`vinculo_entidad`, `vinculo_identidad` — el núcleo de identidad/auditoría. Su ausencia en las otras
54 **no es offender**: bajo Camino A el sitio va con `service_role`, que bypassa RLS con o sin
`FORCE`; `FORCE` daría falsa sensación de protección sin cambiar el boundary real.

**`Q-02` — offenders directos: tablas SIN RLS:**

```sql
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
```

```
(0 filas)
```

**`Q-03` — vistas y matviews de `public`:**

```sql
select c.relname, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1;
```

```
(0 filas)
```

`public` **no tiene ninguna vista ni matview propia** ⇒ elimina de raíz una clase entera de
superficie y deja el sub-chequeo "vistas secdef" del eje 5 **vacío por construcción**.

**Contraste contra `.supabase-ops.yaml`:** el manifiesto declara **57** tablas; `Q-01` (autoritativa)
da **57**, y los nombres coinciden exactamente. **Cero drift.**

**Veredicto del Eje 1: `conforme`** — 57/57 con RLS, cero vistas, cero drift.

---

## Eje 2 — RLS

**`Q-04` — todas las policies de `public`:**

```sql
select schemaname, tablename, policyname, permissive, roles, cmd,
       (qual is not null) as tiene_using,
       (with_check is not null) as tiene_with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Salida real — **5 filas**:

| tablename | policyname | permissive | roles | cmd | using | with_check |
|---|---|---|---|---|---|---|
| `consentimiento` | `consentimiento_insert_own` | PERMISSIVE | `{authenticated}` | INSERT | `f` | `t` |
| `consentimiento` | `consentimiento_select_own` | PERMISSIVE | `{authenticated}` | SELECT | `t` | `f` |
| `suscripcion` | `suscripcion_delete_own` | PERMISSIVE | `{authenticated}` | DELETE | `t` | `f` |
| `suscripcion` | `suscripcion_insert_own` | PERMISSIVE | `{authenticated}` | INSERT | `f` | `t` |
| `suscripcion` | `suscripcion_select_own` | PERMISSIVE | `{authenticated}` | SELECT | `t` | `f` |

**55 de 57 tablas tienen RLS habilitada y CERO policies** ⇒ deny-by-default absoluto. Las 2 con
policies son exactamente las `USER_OWNED_TABLES` del guard. Cero `FOR ALL`, cero `RESTRICTIVE`.

*El ledger vuelve a mentir:* `grep -l "create policy" supabase/migrations/*.sql` devuelve **20
archivos**; la DB viva tiene **5** (el lockdown `0043`/`0044` dropeó las anteriores).

**`Q-05` — la superficie pública REAL (policies `to anon` / `to public`):**

```sql
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and (roles && array['anon','public']::name[])
order by tablename, policyname;
```

```
(0 filas)
```

**`Q-06` — Splinter 0007: policy sobre tabla con RLS deshabilitada:**

```sql
select p.tablename, p.policyname
from pg_policies p
join pg_class c on c.relname = p.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where p.schemaname = 'public' and c.relrowsecurity = false;
```

```
(0 filas)
```

**`Q-07` — policies permisivas de barra libre:**

```sql
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and qual = 'true';
```

```
(0 filas)
```

**Veredicto del Eje 2: `conforme`** — 5 policies vivas, todas `to authenticated` sobre las 2 tablas
esperadas; superficie `to anon` **vacía**; cero policies inertes; cero `using (true)`.

> **Advertencia no decorativa:** un Eje 2 `conforme` **NO** implica que la superficie esté protegida.
> `Q-04`–`Q-07` demuestran que la Data API con `anon`/`authenticated` está cerrada, y eso es todo lo
> que demuestran. El sitio entra con `service_role`, que bypassa RLS por diseño ⇒ las 57 tablas son
> plenamente legibles por `app/`. **El control efectivo es el guard CI, y con `Q-05`/`Q-09b` en cero
> es la ÚNICA capa: cualquier punto ciego suyo es una fuga sin red debajo.**

---

## Eje 3 — Grants

### Advertencia de método — LOCKED

> `information_schema.role_table_grants` está **filtrada por permisos**. La **evidencia de
> conformidad de este eje es `Q-08b`/`Q-09b`** (`aclexplode` sobre `pg_class.relacl`, catálogo
> autoritativo y no filtrado); `Q-08`/`Q-09` quedan como **contraste**, no como prueba.

**Comprobación del supuesto — ejecutada, no asumida:**

```sql
select current_user,
       (select string_agg(r.rolname, ',')
          from pg_auth_members m join pg_roles r on r.oid = m.roleid
         where m.member = (select oid from pg_roles where rolname = current_user)) as miembro_de;
```

```
postgres|pg_monitor,pg_signal_backend,pg_read_all_data,pg_create_subscription,anon,authenticated,service_role,authenticator,supabase_privileged_role,supabase_realtime_admin
```

La conexión (`postgres`) **sí es miembro** de `anon`/`authenticated` ⇒ en esta corrida la vista
filtrada no ocultó nada. **Esto no degrada la advertencia: la confirma.** La coincidencia es un
accidente del privilegio de esta conexión, no una propiedad de la vista.

**`Q-08b` — grants de tabla a `anon`/`authenticated` (AUTORITATIVA):**

```sql
select c.relname,
       a.grantee::regrole::text as grantee,
       a.privilege_type
from pg_class c
join pg_namespace n on n.oid = c.relnamespace,
     aclexplode(c.relacl) a
where n.nspname = 'public' and c.relkind = 'r'
  and a.grantee::regrole::text in ('anon','authenticated')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 2,1,3;
```

Salida real — **5 filas**: `consentimiento`→`authenticated` (INSERT, SELECT); `suscripcion`→
`authenticated` (DELETE, INSERT, SELECT). **Cero grants a `anon`. Cero `UPDATE`.** Cada privilegio
tiene su policy own-row 1:1 en `Q-04`, sin over-grant huérfano.

**`Q-09b` — offenders de Block A/D sobre el catálogo (AUTORITATIVA):**

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

```
(0 filas)
```

| query | fuente | ¿autoritativa? | filas |
|---|---|---|---|
| `Q-08` | `information_schema.role_table_grants` (filtrada) | **NO** — contraste | 5 |
| `Q-08b` | `aclexplode(pg_class.relacl)` | **SÍ** | 5 |
| `Q-09` | `information_schema.role_table_grants` (filtrada) | **NO** — contraste | 0 |
| `Q-09b` | `aclexplode(pg_class.relacl)` | **SÍ** | 0 |

**`Q-10` — `ALTER DEFAULT PRIVILEGES` vivos (el hallazgo central del eje):**

```sql
select pg_get_userbyid(d.defaclrole) as rol_creador,
       coalesce(n.nspname,'(todos)')  as esquema,
       d.defaclobjtype               as tipo_objeto,
       d.defaclacl::text             as acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1,2,3;
```

Salida real — **30 filas**. Las que importan:

| rol_creador | esquema | tipo | acl | lectura |
|---|---|---|---|---|
| `postgres` | `public` | S/f/r | `{postgres…,service_role…}` | **✅ sin `anon`** — huella de `0044`, viva y correcta |
| **`supabase_admin`** | **`public`** | **r** | `{postgres…,`**`anon=arwdDxtm`**`,`**`authenticated=arwdDxtm`**`,service_role…}` | **🔴 OFFENDER `OFF-01`** |
| **`supabase_admin`** | **`public`** | **f** | `{…,`**`anon=X`**`,authenticated=X,…}` | **🔴 `OFF-01`** (toca los ejes 4-5) |
| **`supabase_admin`** | **`public`** | **S** | `{…,`**`anon=rwU`**`,authenticated=rwU,…}` | **🔴 `OFF-01`** |
| `postgres` | `storage` | r/f/S | `{…,anon=arwdDxtm,authenticated=…}` | **🔴 `OFF-6-04`** (eje 6) |

- **Lo que `0044` SÍ logró:** el default de `postgres` sobre `public` no contiene `anon` ni
  `authenticated`. Como las migraciones se aplican **como `postgres`**, toda tabla del pipeline nace
  sin grants a `anon` — que es lo que `Q-09b` mide y confirma.
- **Lo que `0044` NO cubrió:** un **segundo** juego de defaults, del rol **`supabase_admin`**, sobre
  el **mismo esquema `public`**, concede `arwdDxtm` a `anon` y `authenticated`. Es el bootstrap de
  Supabase; `0044` revocó el de `postgres` y **no tocó éste**.
- **Riesgo: latente, no activo.** `Q-09b` prueba que hoy ninguna tabla lo tiene. Pero cualquier
  objeto futuro creado en `public` por `supabase_admin` nacería **legible por `anon` sin que nadie
  escriba un solo `GRANT`** — una fuga que se abre sola, sin línea de código que la delate.

**`Q-11` — `USAGE` sobre el esquema `public`:**

```sql
select r.rolname, has_schema_privilege(r.rolname, 'public', 'USAGE') as usage_public
from pg_roles r
where r.rolname in ('anon','authenticated','service_role');
```

```
authenticated|t
anon|t
service_role|t
```

**`limite-declarado`, no `offender`.** `anon` tiene la puerta del esquema abierta y la superficie
depende enteramente de los grants de objeto (`Q-09b` → 0) y las policies (`Q-05` → 0) ⇒ **cero acceso
efectivo hoy**. Revocar `USAGE on schema public from anon` es una decisión de arquitectura de la
plataforma (PostgREST resuelve la Data API por ahí), **no un fix aditivo**. El cierre correcto es
mantener `Q-09b` en cero **y cerrar `OFF-01`**, que es lo que puede volverla no-cero sin aviso.

**Veredicto del Eje 3: `offender` — 2 filas** (`OFF-01`, `OFF-02`) + 1 `limite-declarado` (`Q-11`).
El régimen cero-grant está **conforme en el presente** y **abierto en el futuro**.

---

## Eje 4 — RPCs públicas

> **Nota de método pagada en carne propia.** `psql -tA` en este host Windows emite terminadores
> `\r\n`. Una lista así comparada con `comm` contra otra generada por `node`/`sort` produce **cero
> coincidencias** y por tanto **resultados falsos que parecen legítimos**. **Regla heredada,
> verbatim: toda canalización `psql -tA | sort | comm` DEBE interponer `tr -d '\r'`.** `sort -c`
> **NO** protege (una lista CRLF está perfectamente ordenada). El único control que lo caza es un
> caso de control con resultado conocido.
>
> **Ninguna RPC fue INVOCADA** — invocar una de escritura habría sido DML.

**`Q-12` — toda función de `public` con su exposición real por rol:**

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

Salida real — **42 filas**. **Hallazgo rector: ninguna RPC de negocio es ejecutable por `anon`.** Las
34 RPCs de negocio dan `exec_anon = f` **y** `exec_authenticated = f`: solo `service_role`. La
superficie `anon` de `public` se reduce a **8** funciones residuales:

```
entidad_tercero_estado_no_regresa   f_unaccent          identidad_audit_immutable
parlamentario_estado_no_regresa     vinculo_entidad_guarda      vinculo_entidad_guarda_insert
vinculo_identidad_guarda            vinculo_identidad_guarda_insert
```

**La autoritativa contradice al contraste:** las migraciones *declaran* `grant execute … to anon`
para **9** RPCs (`0011`–`0024`), y la DB viva dice `f` para las nueve porque `0044`/`0045` revocaron
después. **Manda `Q-12`.**

**`Q-13bis` — acotamiento de las 42 (barrido completo):**

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

Salida real: exactamente **13** funciones llevan `statement_timeout=5s`; las otras **29** no.

**Nota de método obligatoria:** `tiene_limit` es un **regex sobre `prosrc`** y no matchea
`limit p_limit` / `limit match_count` / `limit <función>()` / `fetch first N rows only`. Por eso
**ninguna** fila se declaró offender sin leer antes `pg_get_functiondef(p.oid)`. La heurística
**falló en 4 casos**, todos rescatados por la revisión manual: `agregado_por_contraparte`
(cap **500**), `match_proyectos` (`limit match_count`), `votos_de_parlamentario` (`limit p_limit`) y
`buscar_citaciones` (techo duro **100**).

**Recuento del eje 4a:** de 42 funciones, **13 bounded** por el patrón completo (0064/0066/0067),
**11 acotadas por construcción** (agregación 1-fila, constante, escalar, 7 triggers, PK, admin-write)
y **18 no-bounded** que van a la tabla de offenders.

**`Q-14bis` — superficie PII sobre las 42 (el cero fuerte):**

```sql
select p.proname, pg_get_function_result(p.oid) as retorno
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_function_result(p.oid) ~* '(rut|email|correo|telefono|donante_id|direccion)'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

```
(0 filas)
```

**Límite declarado:** inspecciona **nombres de columna de la firma de retorno**, no el contenido. Una
RPC que emitiera un RUT dentro de un `evidencia jsonb` **no sería detectada**.
`cruces_de_parlamentario` retorna precisamente un `evidencia jsonb`, declarado PII-safe **en un
comentario del cuerpo** — afirmación del código, no verificación; verificarla exigiría leer filas
(prohibido). Queda como **`limite-declarado`**.

**`Q-15` — funciones realmente ejecutables por `anon`, y su ACL:**

```sql
select p.proname,
       coalesce(array_to_string(p.proacl,' | '),'(NULL = default: EXECUTE TO PUBLIC)') as acl,
       pg_get_function_result(p.oid) as retorno
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

Salida real — las 8, todas con `=X/postgres` (grantee vacío = **`EXECUTE TO PUBLIC`**, el default de
Postgres). **Nunca se les aplicó el `revoke execute … from public`**; el `grep` de contraste por sus
revokes en `supabase/migrations/` da `(0 filas)`.

**Impacto sin inflarlo:** las 7 `RETURNS trigger` **no son invocables** como RPC (PostgREST no las
expone; la invocación directa aborta). **`f_unaccent` sí**: retorna `text`, alcanzable por
`POST /rest/v1/rpc/f_unaccent`. Es escalar `IMMUTABLE STRICT` sin acceso a tablas ⇒ **superficie no
gobernada, no una fuga**.

### Allowlist × DB viva — los tres sentidos

| sentido | n | veredicto |
|---|---|---|
| **A** — allowlisted no exec-`anon` (`comm -23` vs `exec_anon`) | 29 | **`conforme`** — consecuencia **esperada** del cero-grant `>0044`. **NO son huérfanos**: `PUBLIC_RPC_ALLOWLIST` **no gobierna a `anon`**, es la lista de RPCs que el árbol público puede llamar **con `service_role`** (su propio comentario, `:180-182`) |
| **B** — exec-`anon` no allowlisted (`comm -13`) | 8 | **`offender`** — `OFF-4-01` / `OFF-4-02` |
| **C** — allowlisted **sin función viva** (huérfano *real*, `comm -23` vs `todas_fn`) | **0** | **`conforme`** demostrado: las 29 entradas existen en `pg_proc` |

*Leer el sentido A como "29 huérfanos" habría sido una alarma total y **falsa**. Por eso se separó el
sentido C, que es el chequeo semánticamente correcto.*

### Separación LOCKED: seguridad vs exactitud

| condición | qué es | dónde va |
|---|---|---|
| Sin `LIMIT` efectivo **y** sin `statement_timeout` | **seguridad / DoS** | offender del eje 4 |
| Con `LIMIT` pero **sin techo** (`p_limit`, `match_count` a elección del cliente) | **seguridad / DoS** | offender del eje 4 |
| Con `LIMIT` y **default bajo que trunca resultados legítimos** | **exactitud** | **NO es offender**: backlog `B-01` de la Phase 124 |

`votos_de_parlamentario` cae en **dos** casillas: `p_limit` sin techo es `OFF-4-03`; el cap de 1.000
que la superficie aplica es `B-01`. **Son dos arreglos distintos y no deben fundirse.**

**Veredicto del Eje 4: `offender` — 5 filas** (`OFF-4-01`..`OFF-4-05`) + 1 `limite-declarado`.

---

## Eje 5 — `SECURITY DEFINER`

**`Q-16` — toda función secdef y su `search_path`:**

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

Salida real — **28 filas, las 28 con `tiene_search_path = t`**, todas con `search_path=""` (el valor
más estricto) y todas con `owner = postgres`. Recuento de control: `28|42` ⇒ 28 secdef + 14
`SECURITY INVOKER` = 42. **Cuadra con el corpus.**

**`Q-17` — Splinter 0011 (secdef SIN `search_path`):**

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
```

```
(0 filas)
```

**`conforme`, y el cero es FUERTE:** el denominador son **28** funciones secdef reales, enumeradas
por `Q-16`.

**`Q-18` — Splinter 0010 (vistas sin `security_invoker`):**

```sql
select c.relname,
       array_to_string(coalesce(c.reloptions,'{}'), ',') as reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
  and not exists (select 1 from unnest(coalesce(c.reloptions,'{}')) o where o like 'security_invoker=%')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1;
```

```
(0 filas)
```

Control del denominador: `select count(*) … relkind in ('v','m')` → **`0`**.

> **`Q-17` y `Q-18` dan ambas `(0 filas)` y NO significan lo mismo.** `Q-17` = 28 objetos
> inspeccionados, 28 conformes (**cero fuerte**). `Q-18` = 0 objetos inspeccionados (**cero vacuo**).
> Splinter 0010 es **inaplicable hoy**, no "resuelto". **Consecuencia para 124:** cualquier vista
> nueva en `public` nace bajo Splinter 0010 y debe crearse con `with (security_invoker = true)`.

**`Q-19` — Splinter 0028/0029 (secdef ejecutable por `anon`):**

```sql
select p.proname, pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

```
(0 filas)
```

> **Regla escrita: `SECURITY DEFINER` + `anon` ES EL PATRÓN DEL PROYECTO, no un defecto.** Es
> exactamente cómo una RPC PII-safe entrega datos públicos desde una tabla que `anon` no puede leer.
> **`Q-19` no es una tabla de offenders.** Una fila suya es offender **solo si además** falla `Q-17`
> (escalada) **o** `Q-14` (fuga de PII). Aquí las tres están vacías: la condición conjunta no se
> cumple por partida triple.

**Veredicto del Eje 5: `conforme` con 1 offender menor de régimen** (`OFF-5-01`).

**Cero filas con `destino: supabase-architect+checkpoint` en los ejes 4 y 5** — la regla se evaluó y
**no se gatilló**: los 6 offenders son `alter function … set`, `revoke execute` y una extensión de
guard, todos aditivos y reversibles. **Si** la Phase 124 descubriera que acotar `match_proyectos` o
`votos_de_parlamentario` exige **cambiar la firma**, eso sí obliga a `drop function` previo (`42P13`)
y en ese momento pasa a `supabase-architect+checkpoint`.

---

## Eje 6 — Buckets · keys · secrets · superficie Data API · guard CI

**`Q-20` — buckets de Supabase Storage (Splinter 0025):**

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by 1;
```

```
(0 filas)
```

Control del denominador: `select count(*) from storage.buckets;` → **`0`**. **`conforme` — CERO
VACUO y se dice.** El crudo vive en **Cloudflare R2**, no en Supabase Storage. Splinter 0025 es
**inaplicable hoy**, no "resuelto".

**`Q-21` — policies de `storage.objects`:**

```sql
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'storage' order by tablename, policyname;
```

```
(0 filas)
```

**Cero vacuo.** Si algún día se crea un bucket, este cero se vuelve un agujero: sin policy y con el
default ACL de `Q-10` abierto a `anon`, **el bucket nacería alcanzable**.

**`Q-22` — esquemas alcanzables por `anon` / `authenticated`:**

```sql
select n.nspname,
       has_schema_privilege('anon', n.nspname, 'USAGE')          as usage_anon,
       has_schema_privilege('authenticated', n.nspname, 'USAGE') as usage_authenticated
from pg_namespace n
where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
order by 1;
```

Salida real — **17 filas**. Con `USAGE` para `anon`: `auth`, `extensions`, `graphql`,
`graphql_public`, **`net`**, `public`, `realtime`, `storage`. **Cerrados** (`f|f`): `actualidad`,
`cron`, `cruces`, `grafo`, `pgbouncer`, `pgmq`, `supabase_migrations`, `util`, **`vault`**.

La fila **`net`** es la **inesperada** ⇒ `OFF-6-03`. `vault` cerrado es lo importante: **ningún
secreto del vault es alcanzable por un rol público**. `pgmq` cerrado también: la cola de ingesta
corre con `service_role`.

**`Q-22b` — ACL crudo de los esquemas (contraste autoritativo, `has_schema_privilege` incluye lo
heredado de `PUBLIC`):**

```sql
select n.nspname, coalesce(n.nspacl::text,'(NULL)')
from pg_namespace n
where n.nspname in ('public','storage','graphql_public','graphql','auth','extensions','net','realtime')
order by 1;
```

Lecturas de la salida real:

- `anon=U` aparece **explícito** en los 8 esquemas ⇒ no es herencia de `PUBLIC`, son grants reales de
  bootstrap de la plataforma.
- `public` y `net` llevan además la entrada de grantee vacío **`=U`** = `USAGE TO PUBLIC` ⇒
  **cualquier** rol, presente o futuro, tiene `USAGE` sobre ambos.
- **Ningún rol público tiene `C` (CREATE)** sobre `public`: `anon=U`, no `anon=UC`. **Cero fuerte.**

**`Q-23` — roles del proyecto y atributos peligrosos:**

```sql
select rolname, rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb
from pg_roles
where rolname in ('anon','authenticated','service_role','authenticator','postgres')
order by 1;
```

```
anon|f|f|f|f|f
authenticated|f|f|f|f|f
authenticator|f|f|t|f|f
postgres|f|t|t|t|t
service_role|f|t|f|f|f
```

- **`service_role.rolbypassrls = t`** — el §0.5 hecho catálogo. El sitio corre con este rol ⇒ las 57
  tablas son plenamente legibles para `app/`, y **el único control es el guard CI**.
- **`postgres.rolsuper = f`** — no es superusuario en Supabase. Esto **acota el blast radius** y
  explica que `OFF-01` (defaults de `supabase_admin`) **no sea auto-corregible desde `postgres`** sin
  escalar privilegio.
- Ningún rol público tiene `rolsuper` ni `rolbypassrls`; `service_role` no puede loguearse directo.

**Dato de mitigación (refuerza `OFF-4-03`, no lo degrada):**

```sql
select r.rolname, s.setconfig::text
from pg_db_role_setting s left join pg_roles r on r.oid = s.setrole order by 1;
```

`anon|{statement_timeout=3s}` · `authenticated|{statement_timeout=8s}` · **`service_role` no tiene
`setconfig` alguno** ⇒ las 17 RPCs sin `statement_timeout` corren **sin techo de tiempo por la ruta
que el sitio efectivamente usa**.

**`Q-24` — Splinter 0014: extensiones instaladas en `public`:**

```sql
select e.extname, n.nspname as esquema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
order by 2, 1;
```

Salida real (11 filas): en `extensions` → `pg_stat_statements`, `pgcrypto`, `uuid-ossp`; en
`pg_catalog` → `pg_cron`, `plpgsql`; en `pgmq` → `pgmq`; en `vault` → `supabase_vault`; **en
`public` → `pg_net`, `pgtap`, `unaccent`, `vector`**.

*Las tres primeras sí están en `extensions`, el patrón correcto de Supabase — el proyecto **conoce**
el patrón y estas cuatro se le escaparon.*

**`Q-24b` — la superficie que el filtro `deptype='e'` ocultó (excepción declarada §0.6 E):**

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

```
pgtap|1079|1079
unaccent|4|4
vector|118|118
```

**`Q-24c` — probe de control: ¿es *realmente* alcanzable?** (read-only, escalar sin acceso a tablas;
no se invocó ninguna función de escritura ni `runtests()`):

```sql
set role anon; select public.pg_version(); select current_user;
```

```
SET
17.6
anon
```

**No es inferencia de ACL: es la ejecución.** La superficie `anon` real de `public` **no es 8
funciones: es 1.209** (8 propias + 1.079 `pgtap` + 118 `vector` + 4 `unaccent`).

**Impacto, sin inflarlo ni minimizarlo:** no es fuga de PII (`pgtap` no lee tablas de negocio por sí
solo). **Sí es divulgación de estructura** (`findfuncs`, `has_table`, `columns_are` ⇒ mapa exacto de
las 57 tablas y sus columnas, PII incluida). **Sí es superficie no gobernada**: 1.079 funciones fuera
de `PUBLIC_RPC_ALLOWLIST`, fuera del corpus de 42 y fuera de la vista de todo guard. **`pgtap` es una
extensión de TESTING y no tiene por qué existir en PRODUCCIÓN.**

*(El gate **corrige la magnitud en ambas direcciones** — ver §Veredicto del gate: a nivel de Data API
lo realmente invocable son ~33, pero dos de ellas son oráculo de enumeración y `runtests()` es
ejecución no gobernada + DoS, y el mitigante es **frágil y no intencional**.)*

### Keys y secrets — lado repositorio

| control | resultado | veredicto |
|---|---|---|
| `.env` no versionado (`git ls-files --error-unmatch .env`) | `pathspec '.env' did not match any file(s)` | `conforme` |
| `.env` ignorado | `.gitignore:2` `.env` · `:3` `.env.local` · `:4` `.env.*.local` | `conforme` |
| `.env.example` solo NOMBRES | 37 nombres, **cero valores** (guard `env-example-guard`, 16/16) | `conforme` |
| Vault cerrado a roles públicos | `Q-22` fila `vault` → `f|f` | `conforme` |
| Escáner de secretos | 53 hallazgos, **53 falsos positivos clasificados uno a uno**; cero credenciales reales | `conforme` |
| Drift contra el manifiesto | 714 hallazgos, **todos historia congelada o el enunciado de la propia prohibición**; `web_reader` → `0` en `pg_roles` | `conforme` |

**Observación de método (no offender del repo):** los dos escáneres dieron veredicto crudo **ROJO**
(`findings HIGH`, `DRIFT detectado`) y **los 767 hallazgos son falsos positivos**. 51 vienen de
`.pnpm-store/`, que **ni siquiera está versionado**. *Un control que grita siempre deja de ser un
control*: entrena al operador a ignorarlo. El script vive en la skill, fuera del repo ⇒ no se corrige
aquí; entra al `DEBT.md` que exige el gate.

### El guard CI como control efectivo — puntos ciegos declarados

| bloque | qué NO ve (punto ciego, con la Q que lo demuestra) |
|---|---|
| **A** (grants a `anon` >0044) | ciego a `alter default privileges` (`Q-10`), al `USAGE TO PUBLIC` (`Q-22b`) y a objetos de extensión (`Q-24b`) |
| **B** (`PII_TABLES` + allowlist en `app/`) | ciego a la **PII dentro de un `jsonb`** de una RPC allowlisted (`limite-declarado` de `Q-14bis`); ciego al **acotamiento** (17 RPCs sin timeout, `Q-13bis`, y `service_role` sin `setconfig`) |
| **D** (`to authenticated`) | mismo ciego que A; y ciego a grants aplicados **fuera de migración** (dashboard, soporte) |
| **E** (`notificacion_envio`) | ciego a **qué consulta** el punto sancionado `lib/notif-service.ts` (ciego aceptado por diseño, pero nombrado) |
| **Direction-B** (allowlist ⊆ definiciones) | **el más grande**: compara contra el **texto** de `create function`, **nunca mira grants** ⇒ no caza ni los 9 grants ya revocados ni las 8 funciones con `=X/postgres`; y las 1.079 `pgtap` ni están en su universo |
| **Direction-A3** (`crossLinkReader`) | hereda (i) de B **agravado**: certifica que la llamada está allowlisted, **no** que lo que devuelve sea PII-safe |

**Corrida real de los 14 controles: 477 tests verdes, 0 rojos** (+6 skip LIVE-gated por diseño,
`ci.yml:55-58`, con `MockClasificadorProvider` y sin secrets).

> **Lo que esa tabla NO dice, y hay que decirlo:** **ninguno** de los offenders de este eje produciría
> un test rojo — no están escritos en ninguna migración. **Verde no significa cerrado; significa
> *sin regresión detectable por el método del guard*.**

**Veredicto del Eje 6: `offender` — 5 filas** (`OFF-6-01`..`OFF-6-05`) + **2 `limite-declarado`**.

---

## Tabla de offenders

Columnas exactas y en el orden de la plantilla §0.2. **13 filas.**

| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
|---|---|---|---|---|---|---|
| OFF-01 | `default-acl · supabase_admin en schema public (tipos r, f, S)` | 3 | Toda tabla/función/secuencia **futura** creada por `supabase_admin` en `public` nace con `arwdDxtm`/`EXECUTE` para `anon` ⇒ PII legible por un cliente no autenticado vía Data API **sin que exista ningún `GRANT` en el repo que lo delate** (`anon` ya tiene `USAGE`, `Q-11`) | `alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated;` + ídem `on functions` y `on sequences`. **Si falla por falta de membresía, NO se fuerza: se reclasifica a `deuda-operador`** — jamás se escala privilegio | `Q-10` | `124-aditivo` |
| OFF-02 | `guard · app/lib/lockdown-guard.test.ts (Block A/D)` | 3 | El guard solo caza `grant … to anon/authenticated` en el texto; es **ciego a `alter default privileges`**. Una migración futura podría abrir toda tabla futura a `anon` **con el guard en verde** | Aserción por-sentencia que trate como offender cualquier `alter default privileges` con `grant … to anon\|public\|authenticated` en migraciones > 0044 | `Q-10` + corrida del guard | `guard` ✅ **CERRADO (A4)** |
| OFF-4-01 | `función · f_unaccent(text)` | 4 | Invocable por `anon` vía `/rest/v1/rpc/f_unaccent` sin estar gobernada por la allowlist ⇒ superficie de la Data API fuera de todo control declarado (no filtra datos: escalar sin acceso a tablas) | `revoke execute on function public.f_unaccent(text) from public;` (+ `set search_path = ''`, `OFF-5-01`) | `Q-12`, `Q-15` | `124-aditivo` |
| OFF-4-02 | `función · entidad_tercero_estado_no_regresa, identidad_audit_immutable, parlamentario_estado_no_regresa, vinculo_entidad_guarda(_insert), vinculo_identidad_guarda(_insert)` (7, todas `RETURNS trigger`) | 4 | `EXECUTE TO PUBLIC` por default nunca revocado ⇒ superficie residual heredada por `anon`. Hoy **no explotable** (PostgREST no expone funciones trigger), pero **un cambio futuro de tipo de retorno lo volvería explotable en silencio** | `revoke execute on function public.<f>() from public;` para las 7, sobre la firma exacta | `Q-12`, `Q-15` | `124-aditivo` |
| OFF-4-03 | `función · aportes_de_parlamentario, bienes_de_parlamentario, comparar_declaraciones, contratos_de_parlamentario, cruces_de_parlamentario, cruces_de_proyecto, declaraciones_de_parlamentario, lobby_de_parlamentario, lobby_en_tramitacion, parlamentarios_publico, rebeldias_de_parlamentario, tasa_ausencia_comparada` (12 sin `LIMIT` ni timeout) + `agregado_por_contraparte, buscar_citaciones, parlamentario_publico` (3 con techo, sin timeout) + `match_proyectos, votos_de_parlamentario` (2 con `LIMIT` sin techo) | 4 | **DoS**: una petición puede barrer una tabla completa (`parlamentarios_publico` = directorio entero; `tasa_ausencia_comparada` = cohorte de una cámara sobre `voto`) o elegir su propia cardinalidad, **sin corte de tiempo que libere el worker**. `service_role` **no tiene `statement_timeout` de rol** ⇒ la ruta del sitio es la única sin techo | `alter function public.<f>(<args>) set statement_timeout = '5s';` a las 17; **además** cota dura al parámetro (`least(coalesce(match_count,20),100)`, `least(coalesce(p_limit,20),200)`); **además** `LIMIT` explícito en las 12 que no tienen ninguno | `Q-13bis` + revisión manual `pg_get_functiondef` | `124-aditivo` |
| OFF-4-04 | `función · subgrafo_red` | 4 | Walk recursivo con profundidad acotada (clamp 1..2) pero **fan-out por nivel sin cota** y sin `statement_timeout` ⇒ una semilla muy conectada puede materializar un `jsonb` arbitrariamente grande y colgar el worker | `alter function public.subgrafo_red(...) set statement_timeout = '5s';` + cota explícita de nodos/aristas por nivel en el CTE recursivo | `Q-13bis` + revisión manual | `124-aditivo` |
| OFF-4-05 | `guard · Direction-B en app/lib/lockdown-guard.test.ts` | 4 | Verifica que la allowlist tenga función **definida**; **nunca mira grants**. No caza los 9 `grant execute … to anon` ya revocados ni las 8 funciones expuestas por el default `TO PUBLIC` — el defecto exacto que produjo `OFF-4-01`/`OFF-4-02` | Extensión **estática**: exigir que toda `create function` en `public` tenga su `revoke execute … from public`. Un `⊆ allowlist` ingenuo daría **9 falsos positivos** hoy | `Q-15` + `comm -13` + `grep` de contraste | `guard` ✅ **CERRADO (A5)** |
| OFF-5-01 | `función · f_unaccent(text)` | 5 | **No** es secdef (sin escalada) pero es la **única** función de `public` sin `search_path` fijado, en un corpus 100 % `search_path=""`. Riesgo de **régimen**: única grieta, no cubierta por ningún guard | `alter function public.f_unaccent(text) set search_path = '';` (el cuerpo ya califica `public.unaccent` ⇒ inocuo) | `Q-16` (por ausencia) + `Q-13bis` | `124-aditivo` |
| OFF-6-01 | `extensión · pgtap en schema public (1.087 objetos, 1.079 funciones)` | 6 | **Divulgación de estructura a `anon`**, probada por ejecución (`Q-24c`). Un cliente no autenticado enumera tablas, columnas y funciones sin ningún grant ⇒ mapa completo de las 57 tablas, PII incluida. **1.079 funciones fuera de la allowlist, del corpus y de todo guard.** El gate agrava: `runtests()` es **ejecución no gobernada + DoS** y `col_is_null`/`col_not_null` son **oráculo de enumeración** | (a) `drop extension pgtap;` en PROD, o (b) `alter extension pgtap set schema extensions;`. **Ambas destructivas/de reubicación** y exigen decidir antes el destino de las suites pgTAP | `Q-24`, `Q-24b`, `Q-24c` | `supabase-architect+checkpoint` |
| OFF-6-02 | `extensión · vector (237 obj / 118 fn exec-anon) y unaccent (6 obj / 4 fn) en schema public` | 6 | 122 funciones más exec-`anon` en el esquema expuesto, invisibles para la allowlist. Fuga **nula** (operadores de distancia y normalización, sin acceso a tablas); riesgo de **régimen**. Splinter **0014** | **No moverlas.** `vector(768)` es el tipo de columna de `proyecto_embedding` y sostiene el HNSW; `unaccent` es la base de `f_unaccent` y del FTS ⇒ mover rompería tipos, índices y firmas. **Lo razonable es documentar la excepción** (hecho: `PUBLIC_EXTENSION_ALLOWLIST`) | `Q-24`, `Q-24b` | `supabase-architect+checkpoint` |
| OFF-6-03 | `extensión · pg_net en public + schema net con USAGE/EXECUTE para anon` | 6 | `anon` tiene `USAGE` sobre `net` **y** `EXECUTE` sobre `net.http_get`/`http_post` ⇒ **SSRF potencial**. Mitigante hoy: PostgREST no expone `net` (**pero eso es `LIM-6-01`, no verificado**). El gate lo **sube de severidad**: encadenado con `lives_ok` de `pgtap` sería **SSRF real por la Data API**, bloqueado solo por el accidente de que `pgtap` no nombra sus argumentos | `revoke all on schema net from anon, authenticated;` + `revoke execute on all functions in schema net from anon, authenticated;`. Ningún rol público necesita `pg_net` (es infraestructura de `pg_cron`) | `Q-22`, `Q-22b`, `Q-24`, `Q-24b` | `124-aditivo` |
| OFF-6-04 | `default-acl · postgres en schema storage (tipos r, f, S)` | 6 | Concede `arwdDxtm`/`EXECUTE`/`rwU` a `anon` y `authenticated` sobre objetos futuros de `storage`. Hoy **inerte** (0 buckets), pero **el orden importa**: crear un bucket antes de cerrar el default lo nace alcanzable por `anon`, sin policy que lo contenga. Gemelo de `OFF-01` en otro esquema | `alter default privileges for role postgres in schema storage revoke all on tables from anon, authenticated;` (+ `on functions`, `on sequences`). Escape idéntico a `OFF-01`. **Antes** de crear cualquier bucket | `Q-10` + `Q-20`, `Q-21` | `124-aditivo` |
| OFF-6-05 | `guard · app/lib/lockdown-guard.test.ts (transversal)` | 6 | El guard es la **única** capa del boundary del sitio y su universo es **el texto del repo**: ciego a **toda** la superficie que la plataforma abre por fuera de una migración (defaults, `USAGE TO PUBLIC`, `EXECUTE TO PUBLIC`, 1.209 fn de extensión). **Ninguna de esas fugas produciría un test rojo** | Extensión estática: (a) `alter default privileges`; (b) `create function` sin su revoke; (c) **allowlist de extensiones permitidas en `public`**. Lo no cubrible estáticamente se declara como límite y lo cierra la Phase 124 | `Q-10` + `Q-15` + `Q-22b` + `Q-24b` + corrida del guard | `guard` ✅ **CERRADO (A6)** |

### Recuento por destino

| destino | n | offenders |
|---|---|---|
| `124-aditivo` | **7** | `OFF-01`, `OFF-4-01`, `OFF-4-02`, `OFF-4-03`, `OFF-4-04`, `OFF-5-01`, `OFF-6-03`, `OFF-6-04` → *(8 filas; ver nota)* |
| `supabase-architect+checkpoint` | **2** | `OFF-6-01`, `OFF-6-02` |
| `guard` (cerrados en esta fase) | **3** | `OFF-02` (A4), `OFF-4-05` (A5), `OFF-6-05` (A6) |
| `deuda-operador` | **0** offenders | *(la creación de un bucket sería `deuda-operador`, pero no es offender: no existe)* |

> **Corrección aritmética, RULE-1.** El recuento por destino da **8** filas `124-aditivo`
> (`OFF-01`, `OFF-4-01`, `OFF-4-02`, `OFF-4-03`, `OFF-4-04`, `OFF-5-01`, `OFF-6-03`, `OFF-6-04`), no
> 7. **8 + 2 + 3 = 13**, que cuadra con la tabla. Se deja la corrección escrita en vez de reescribir
> el número en silencio.

---

## 0 offenders demostrado

**Regla dura aplicada:** cada afirmación de cero lleva **su query transcrita arriba** y su salida.
Ninguna sección `conforme` llegó sin bloque ```sql; **nada fue rechazado**.

### Eje 1 — Schema

- **Ninguna tabla de `public` sin RLS** → `Q-01`/`Q-02` (arriba) → `(0 filas)`. **CERO FUERTE** —
  denominador **57** tablas enumeradas.
- **Ninguna vista/matview propia en `public`** → `Q-03` → `(0 filas)`. **CERO FUERTE** — el
  denominador es el barrido completo de `relkind in ('v','m')`.
- **Cero drift contra `.supabase-ops.yaml`** → contraste `Q-01` (57) vs manifiesto (57), nombres
  idénticos.

### Eje 2 — RLS

- **Ninguna policy `to anon` / `to public`** → `Q-05` → `(0 filas)`. **CERO FUERTE** — 5 policies
  vivas enumeradas por `Q-04` como denominador.
- **Ninguna policy inerte (Splinter 0007/0013)** → `Q-06` → `(0 filas)`. Consistente con `Q-02`: no
  hay tabla con RLS off donde alojarlas.
- **Ninguna policy `using (true)`** → `Q-07` → `(0 filas)`. **CERO FUERTE** sobre las 5.

### Eje 3 — Grants

- **Ningún grant a `anon`, ni a `authenticated` fuera de `USER_OWNED_TABLES`** → **`Q-09b`**
  (autoritativa, `aclexplode`) → `(0 filas)`. **CERO FUERTE** — 57 tablas × su `relacl`.
- *El mismo hecho vía contraste* → `Q-09` → `(0 filas)`. **No es evidencia por sí sola** (vista
  filtrada por permisos); se registra como confirmación.

### Eje 4 — RPCs

- **Ninguna RPC de negocio ejecutable por `anon`** → `Q-12` → 34/34 con `exec_anon = f`. **CERO
  FUERTE** — denominador 42 funciones.
- **Ninguna función de `public` con PII en la firma de retorno** → `Q-14bis` → `(0 filas)`. **CERO
  FUERTE** — 42 funciones inspeccionadas. *(`Q-14`, filtrada por `exec_anon`, es el mismo cero pero
  **débil**: su denominador son 8; se registra la diferencia.)*
- **Ningún huérfano real de la allowlist** → `Q-15bis` + `comm -23` → `(0 filas)`. **CERO FUERTE** —
  29 entradas contra 42 funciones vivas.

### Eje 5 — `SECURITY DEFINER`

- **Ninguna secdef sin `search_path` (Splinter 0011)** → `Q-17` → `(0 filas)`. **CERO FUERTE** —
  denominador **28** secdef reales enumeradas por `Q-16`.
- **Ninguna vista sin `security_invoker` (Splinter 0010)** → `Q-18` → `(0 filas)`. **CERO VACUO** —
  `select count(*)` de vistas en `public` → **`0`**. **Inaplicable hoy, no "resuelto".**
- **Ninguna secdef ejecutable por `anon` (Splinter 0028/0029)** → `Q-19` → `(0 filas)`. **CERO
  FUERTE** — 28 secdef inspeccionadas.

### Eje 6 — Exposición

- **Ningún bucket de Supabase Storage (⇒ ninguno `public`, Splinter 0025)** → `Q-20` +
  `select count(*)` → `(0 filas)` / `0`. **CERO VACUO** — 0 objetos inspeccionados; el crudo vive en
  R2. **Splinter 0025 inaplicable, no resuelto.**
- **Ninguna policy en el esquema `storage`** → `Q-21` → `(0 filas)`. **CERO VACUO.**
- **Ningún rol público con `rolsuper` o `rolbypassrls`** → `Q-23` → `anon`/`authenticated`/
  `authenticator` = `f|f`. **CERO FUERTE** — 5 roles.
- **Ningún rol público con `CREATE` sobre `public`** → `Q-22b` (`anon=U`, no `anon=UC`). **CERO
  FUERTE.**
- **Ningún secreto real en el repo** → escáner + `git ls-files .env` + `.gitignore` → 53 hallazgos,
  **53 falsos positivos clasificados uno a uno**. **CERO FUERTE.**
- **Ningún drift real** → `check_drift.sh` + `select count(*) from pg_roles where rolname='web_reader'`
  → `0`. **CERO FUERTE.**
- **Ningún control de CI en rojo** → corrida de 14 guards → **477 verdes, 0 rojos**. **CERO FUERTE**
  (+6 skip LIVE-gated declarados).

### `limite-declarado` de la fase

| # | qué no se pudo verificar | evidencia del intento | quién lo cierra |
|---|---|---|---|
| `Q-11` | Si `USAGE` de `anon` sobre `public` debe revocarse | `Q-11` ejecutada (`t` para los tres roles) | decisión de arquitectura de plataforma; el cierre correcto es mantener `Q-09b` en cero y cerrar `OFF-01` |
| eje 4 | **PII dentro de columnas `jsonb`/`text`** de una RPC allowlisted (`cruces_de_parlamentario.evidencia`) | `Q-14bis` inspecciona la firma, no el contenido; verificarlo exigiría **leer filas** (prohibido, cero PII) | Phase 124 / revisión de código |
| LIM-6-01 | **Qué esquemas expone PostgREST** (`pgrst.db_schemas`) ⇒ severidad real de `OFF-6-03` | `select coalesce(current_setting('pgrst.db_schemas', true),'NO-VISIBLE-EN-SESION');` → `NO-VISIBLE-EN-SESION`; `pg_db_role_setting` de `authenticator` sin ninguna entrada `pgrst.*` | **checkpoint de operador** (probe REST con anon key) |
| LIM-6-02 | Si `pgtap` está expuesta como `/rest/v1/rpc/*` | mismo intento | **checkpoint de operador**. `OFF-6-01` **no depende** de ello: la superficie existe en la DB con o sin PostgREST delante |
| LIM-05-01 | El **ACL vivo** del default de `supabase_admin` | no proviene de ninguna migración: es bootstrap de plataforma, no hay texto que leer | `OFF-01` → Phase 124 |
| LIM-05-02 | Las **1.209** funciones de extensión exec-`anon` **ya instaladas** | ninguna se instala desde una migración del repo | `OFF-6-01`/`OFF-6-02` |
| LIM-05-03 | El `USAGE TO PUBLIC` sobre `public` y `net` | catálogo vivo, sin origen en el repo | `OFF-6-03` → Phase 124 |
| LIM-05-04 | El `EXECUTE TO PUBLIC` **ya materializado** sobre las 8 funciones | (A5) impide la regresión y congela la deuda; no revoca nada | `OFF-4-01`/`OFF-4-02` → Phase 124 |

> **Regla rectora:** extender el guard **no cierra** los offenders existentes; **impide la regresión
> futura**. Los dos son necesarios y ninguno sustituye al otro.

---

## Veredicto del gate

Emitido por el subagente **`supabase-reviewer`** — **el veredicto ES el gate de la fase** (decisión
LOCKED del CONTEXT), no una opinión consultiva. Texto íntegro y atribuido en
[`123-SUPA-REVIEWER-VEREDICTO.md`](./123-SUPA-REVIEWER-VEREDICTO.md).

> ## Veredicto global: PASS CON RESERVAS
>
> La Phase 123 pasa el gate como auditoría (el trabajo es real, la evidencia es autoritativa y los
> ceros están calificados), pero no autoriza a la Phase 124 a aplicar nada todavía: hay 3
> precondiciones y 4 huecos, uno de ellos con hallazgo nuevo mío contra la DB viva.
>
> […]
>
> **Nada de lo hallado alcanza el umbral de BLOQUEO del Gate 2 hoy** (RLS 57/57, cero policies
> `to anon`, cero grants a `anon`, 0/28 secdef sin `search_path`, 0 secdef exec-`anon`, cero buckets,
> `.env` no versionado, cero secrets en `cron.job`). El PASS es con reservas por el hueco de
> `PII_TABLES` y por LIM-6-01, no por el estado del boundary diseñado.

**Los cuatro criterios: CUMPLEN.** Cobertura de los seis ejes (barrido completo 42/42 y 57/57);
autoridad de la evidencia (*"lo mejor de la fase"* — `aclexplode` como prueba, `role_table_grants`
como contraste, cero-fuerte vs cero-vacuo aplicado, `Q-24c` por ejecución); clasificación de riesgo
(con una corrección y una precisión); extensión del guard (sonda de mutación *"sí es prueba
suficiente"*, baseline que **muerde en las dos direcciones**, `limite-declarado` *"honestos, no
huecos disfrazados"*, descarte de Direction-C *"bien argumentado"*).

**No hay ningún offender BLOQUEANTE hoy.** Los 13 se confirman; **tres cambian de peso**:

| offender | cambio que impone el gate |
|---|---|
| `OFF-01` | **sube a PRIMERO EN ORDEN** — único mecanismo que reabre el boundary sin línea de código. **Prevención del gate:** `postgres.rolsuper = f` (`Q-23`) ⇒ el `alter default privileges for role supabase_admin` **probablemente falle**; el escape a `deuda-operador` está bien escrito y **124 no puede tragárselo en silencio** |
| `OFF-6-03` | **SUBE de severidad.** Verificado por el gate: `net.http_get`/`http_post` = `EXECUTE` para `anon`. *"Aplíquenlo en 124 sin esperar al architect"* |
| `OFF-6-01` | **magnitud corregida en las dos direcciones** — ver abajo |

### La corrección del gate a `OFF-6-01` (hallazgo del reviewer)

Se registra **sin suavizar**, porque corrige a la fase en ambos sentidos:

- **Sobredimensionado a nivel de Data API.** PostgREST **exige argumentos con nombre**; casi todo
  `pgtap` tiene `proargnames = NULL` ⇒ **no invocable** por `/rest/v1/rpc/`. Lo realmente alcanzable
  son **~33**: 20 de cero argumentos (incl. `pg_version()` y `runtests()`) + 13 con nombre
  (`col_is_null`, `col_not_null`, `diag`, `skip`, `todo`, `finish`, `_prokind`).
- **Subestimado cualitativamente.** De esas 33, **dos importan**: `col_is_null`/`col_not_null` son un
  **oráculo de enumeración de schema** para `anon` (confirman existencia y nulabilidad de
  tabla+columna, **incluidas las de PII**); y **`runtests()` sin argumentos ejecuta como `anon` todo
  lo que matchee `^test` en el `search_path`** — ejecución no gobernada + DoS.
- **Y lo que NO es alcanzable, dicho para no inflarlo:** `lives_ok`/`throws_ok`/`results_eq` ejecutan
  SQL arbitrario del llamador (`prosecdef = f`, exec-`anon` = true) y `anon` tiene `EXECUTE` sobre
  `net.http_post` ⇒ **`lives_ok('select net.http_post(…)')` sería SSRF real por la Data API**.
  **Bloqueado hoy solo por el accidente de que `pgtap` no nombra sus argumentos: un mitigante frágil
  y no intencional.** Refuerza `OFF-6-01` **y** `OFF-6-03`.

### Los 7 huecos del gate — lo que la fase NO auditó y debió auditar

Escritos como tales, **sin suavizar**.

| # | hueco | estado |
|---|---|---|
| **1** | **Completitud de `PII_TABLES` — el hueco grave.** La fase demuestra que el guard es la única capa y audita sus puntos ciegos de plataforma, **pero nunca audita la cobertura de su propia lista de PII contra las 57 tablas**. *"Es el modo de fallo que la fase declara como el más crítico, en el único eje donde no miró. Hallazgo bloqueante para 124."* | ✅ **CERRADO en esta fase** — ver §Cierre del hueco de `PII_TABLES` |
| **2** | **`pgmq`, `pg_cron` y la superficie de jobs.** No auditados. El gate los revisó: 5 jobs activos, todos SQL puro, **cero secrets en `cron.job.command`** — *"Está limpio, pero por suerte, no por auditoría. Debe entrar al régimen."* | 📌 **al régimen** de la próxima auditoría |
| **3** | **Esquemas del proyecto fuera de `public`.** Existe `util.host_throttle` fuera del barrido (RLS on, `anon` sin `USAGE` ⇒ no offender). *"Que dé cero no borra que el universo declarado era incompleto."* | 📌 **al régimen** |
| **4** | **Edge Function `ingest-worker`**: `verify_jwt`, CORS y manejo de secrets **no auditados en ningún eje**, pese a estar en `corpus.live_efs` del manifiesto | 📌 **al régimen** |
| **5** | **`graphql_public` con `EXECUTE` para `anon` sobre `graphql.resolve`**: enumerado en `Q-22` como "default de plataforma" y **despachado**. Segunda superficie de introspección, **no probada** | 📌 **al régimen** |
| **6** | **`LIM-6-01`/`LIM-6-02` siguen abiertos y son resolubles.** El gate intentó cerrarlos: no hay `SUPABASE_ANON_KEY` en `.env` (**buena higiene**) y sin `apikey` PostgREST responde `401`. *"Se resuelve en 60 segundos con la anon key del dashboard."* | ⏸️ **checkpoint de operador** |
| **7** | **Splinter / Database Advisors no corridos** (declarado correctamente en §0.6 B). `0007`/`0010`/`0011`/`0013`/`0014`/`0025`/`0028`/`0029` ya reclamados por SQL; **`0001`/`0003`/`0005`/`0009`/`0020` no los tocó nadie** — deuda, no bloqueo | ⏸️ **checkpoint de operador** |

### Cierre del hueco de `PII_TABLES` (exigencia nº1 del gate — "guard primero")

Único trabajo de corrección que esta fase autorizó, hecho **como extensión de guard, NO como
migración**. `git diff --quiet -- supabase` sale **0**.

**Corpus congelado (query documentada en el propio guard, ejecutada read-only contra PROD):**

```sql
select c.relname, a.attname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
     and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relkind = 'r'
  and a.attname ~* '(rut|email|telefono|direccion)'
  and not exists (select 1 from pg_depend d
                   where d.objid = c.oid and d.deptype = 'e')
order by 1, 2;
```

Salida real — **8 filas** (solo nombres de tabla y columna, **cero valores**):

```
contratista|rut_proveedor                     donante|rut_donante
contrato|rut_proveedor                        entidad_tercero|rut
declaracion_accion_derecho|rut_juridica       parlamentario|email
pii_contraparte_declaracion|rut_contraparte   parlamentario|rut
```

**Cuatro tablas estaban fuera de `PII_TABLES`** — `pii_contraparte_declaracion` (¡literalmente
prefijada `pii_`!), `contratista`, `contrato`, `declaracion_accion_derecho`. Verificado: **ninguna se
referencia hoy desde `app/`** ⇒ no había fuga activa; pero un `.from("pii_contraparte_declaracion")`
habría pasado el guard **en verde** exponiendo RUTs, con RLS bypassada por `service_role`.

| qué se hizo | dónde |
|---|---|
| `PII_TABLES` **+4** | `app/lib/lockdown-guard.test.ts` (`PII_TABLES`) |
| **Aserción de completitud (A7)**: falla si una tabla del corpus congelado no está cubierta | bloque `(A7)`, detector puro `uncoveredPiiTables` |
| **Corpus CONGELADO, no consultado en runtime** — el guard corre en CI **sin acceso a DB**; la query que lo produjo queda documentada en el archivo | `PUBLIC_PII_COLUMN_CATALOG` |
| **Mutation self-check** (en memoria): tabla PII ficticia ⇒ offender; corpus real ⇒ 0; quitar una cobertura existente ⇒ offender (**muerde en las dos direcciones**) | `mutation self-check (A7)` |
| **Mutation probe contra disco**: inyectar `tabla_mutacion_probe` al corpus ⇒ **2 rojos**; restaurar ⇒ **35/35 verde** | ejecutado y verificado |

**Adjudicación escrita de la quinta candidata — `declaracion_bien_inmueble :: es_su_domicilio`:
EXCLUIDA con razón, no omitida en silencio.** Contra el catálogo vivo **no matchea** la clase
`(rut|email|telefono|direccion)` (contiene *domicilio*, no *dirección*) y es un **booleano** de la
declaración de patrimonio: indica si el inmueble declarado es el domicilio del declarante, **no porta
la dirección**. **RULE-1: manda el catálogo.** La adjudicación está escrita **en el propio guard**
(`PII_ADJUDICACION_EXCLUIDA`) con una aserción de que la fila **no** se cuela en el corpus.

| métrica | antes de 123-06 | después |
|---|---|---|
| `lockdown-guard.test.ts` | 31 | **35** |
| suite completa de `app/` | 1586 | **1590** |
| `tsc --noEmit` | exit 0 | **exit 0** |
| `git diff --quiet -- supabase` | 0 | **0** |

---

## Identidad aritmética de la consolidación

Espejo del control de la Phase 122: **cero filas huérfanas, cero filas perdidas.**

```
N_offenders (tabla §Tabla de offenders)  ==  suma de los fragmentos 01 + 02 + 03 + 04
                                  13     ==      2   +   6   +   5   +   0
```

| fragmento | ejes | offenders declarados | cuáles |
|---|---|---|---|
| `-01-SCHEMA-RLS-GRANTS` | 1, 2, 3 | **2** | `OFF-01`, `OFF-02` |
| `-02-RPC-SECDEF` | 4, 5 | **6** | `OFF-4-01`, `OFF-4-02`, `OFF-4-03`, `OFF-4-04`, `OFF-4-05`, `OFF-5-01` |
| `-03-EXPOSICION-GUARDS` | 6 | **5** | `OFF-6-01`, `OFF-6-02`, `OFF-6-03`, `OFF-6-04`, `OFF-6-05` |
| `-04-GUARDS` | 3, 4, 6 | **0 nuevos** | no declara offenders: **cierra** tres (`OFF-02`, `OFF-4-05`, `OFF-6-05`) y añade 4 `limite-declarado` |
| **suma** | | **13** | **= las 13 filas de la tabla** |

**Cuadra.** Los ejes 1 y 2 aportan **0** offenders (con sus cinco ceros demostrados por query), el eje
3 aporta 2, el 4 aporta 5, el 5 aporta 1 y el 6 aporta 5. **2 + 5 + 1 + 5 = 13.** El recuento del gate
—*"Clasificación de los 13 offenders"*— coincide **exactamente** con esta tabla, ítem por ítem.

**Control de destinos:** `124-aditivo` **8** + `supabase-architect+checkpoint` **2** + `guard` **3** +
`deuda-operador` **0** = **13**. Los 3 de `guard` están **cerrados en esta fase** (A4/A5/A6); los 10
restantes son la entrada de la Phase 124.

---

## Backlog de estructura heredado (entrada a la Phase 124)

El ROADMAP de la Phase 124 **no nombra** estos ítems; anclarlos aquí es lo que evita que se pierdan.

| # | ítem | evidencia | por qué exige SQL | forma del fix (aditiva) | destino |
|---|------|-----------|-------------------|-------------------------|---------|
| **B-01** | Cap `p_limit: 1000` en la RPC de votos (`votos_de_parlamentario`) | `D1165` tiene **3.752** votos reales; el deploy muestra **1.000**. La RPC ordena `by fecha desc` ⇒ además **distorsiona la composición** del desglose (no es solo truncar) | el total honesto **no es derivable** del set truncado | **RPC de conteo dedicada** — aguja completa: secdef PII-safe, `search_path=''`, `statement_timeout`, `LIMIT`, doble-revoke, entrada en `PUBLIC_RPC_ALLOWLIST`. **Aditiva**: no altera la RPC existente | `124-aditivo` |
| **B-02** | Tile *Por materia* agrupa **3.100/3.675 (84,4 %)** sin declarar cobertura | fragmento de cruces de la Phase 122 (`122-CRUCES-SQL-04-FIXES.md`) | la RPC hoy **no emite el denominador**; declarar cobertura sin denominador es **fabricarla** | añadir el denominador a la salida de la RPC con **firma v2 paralela** (precedente `0060`): no alterar la firma viva ⇒ evita `42P13` y la re-arma de default privileges | `124-aditivo` |
| **B-03** | Vista nueva en `public` sin `security_invoker` | `Q-18` (cero **vacuo**: 0 vistas hoy) | cualquier vista futura nace bajo Splinter **0010** y no hay guard que lo exija | `create view … with (security_invoker = true)`, y aserción de guard equivalente | `124-aditivo` |

**Separación LOCKED que 124 no debe fundir:** `B-01` es **exactitud**; el `p_limit` sin techo de la
misma función es **seguridad** (`OFF-4-03`). **Dos arreglos distintos.**

> **Nota LOCKED al pie: ninguna migración `0073` se escribe en esta fase.** El precedente de
> `122-05` es explícito — escribir una migración especulativa contra un contrato no adjudicado deja
> una migración huérfana. Verificado: **no existe ningún archivo `supabase/migrations/0073*`**.

### Orden LOCKED de aplicación en la Phase 124 (exigencia nº3 del gate)

**Es orden, no sugerencia.** Load-bearing: invertirlo abre superficie.

| paso | qué | por qué el orden importa |
|---|---|---|
| **1** | **`OFF-01`** — `alter default privileges for role supabase_admin in schema public revoke all …` | **ANTES de toda otra migración.** Es el único mecanismo que reabre el boundary **sin línea de código**. Cualquier objeto creado antes de este paso puede nacer abierto |
| **2** | **`OFF-6-04`** — default ACL de `postgres` en `storage` | **ANTES de crear cualquier bucket** (y crear un bucket es `deuda-operador`, jamás acto de agente) |
| **3** | **`OFF-6-03`** — `revoke` de `net` a roles públicos, **en la misma tanda** | Corta la cadena SSRF **aunque el mitigante de `proargnames` desaparezca**. El gate: *"Aplíquenlo en 124 sin esperar al architect"* |
| **4** | `OFF-4-01` (+ `OFF-5-01`) — `revoke execute … from public` sobre `f_unaccent` + `set search_path=''` | Al aplicarlo, **borrar la entrada de `KNOWN_MISSING_REVOKE_FROM_PUBLIC`** o la suite se pone roja — **eso es el diseño** (exigencia nº4). Enganche mecánico entre fases |
| **5** | `OFF-4-02` — `revoke execute` sobre las 7 funciones trigger | Cierra la superficie residual antes de que un cambio de tipo de retorno la vuelva explotable |
| **6** | `OFF-4-03` + `OFF-4-04` — `statement_timeout` a las 17 + cotas duras de parámetro + `LIMIT` explícito | Si acotar `match_proyectos`/`votos_de_parlamentario` exigiera **cambiar la firma**, el ítem pasa a `supabase-architect+checkpoint` (`drop function` previo, `42P13`) |
| **7** | `B-01`, `B-02`, `B-03` — backlog de estructura heredado | Aditivos, sin bloqueo |
| **—** | `OFF-6-01`, `OFF-6-02` | **NO** entran en esta secuencia: `supabase-architect` + **checkpoint de operador** |

**Escape declarado para los pasos 1 y 2, idéntico y obligatorio:** `postgres.rolsuper = f` (`Q-23`)
⇒ el `alter default privileges for role supabase_admin` **probablemente falle por membresía**. En ese
caso el ítem se **reclasifica a `deuda-operador`** (acto en dashboard/soporte Supabase), **se reporta
explícitamente y JAMÁS se escala privilegio para aplicarlo**. El gate lo exige literalmente: *"exijo
que 124 no lo trague en silencio"*.

### Checkpoints de operador (NO son tarea de agente)

| # | acto | por qué es del operador | qué desbloquea |
|---|---|---|---|
| **OP-1** | **Probe REST con la anon key** (read-only) contra `/rest/v1/rpc/pg_version`, `/rest/v1/rpc/runtests` y `/rest/v1/rpc/col_is_null` | La `SUPABASE_ANON_KEY` **no está en `.env`** (buena higiene); sale del dashboard. Exigencia nº2 del gate | Cierra `LIM-6-01`/`LIM-6-02`. **Si responden 200, `OFF-6-01` deja de ser "divulgación de estructura" y pasa a BLOQUEANTE de Gate 2**: `alter extension pgtap set schema extensions` (o `drop extension` en PROD) con checkpoint, **decidiendo antes el destino de las suites pgTAP** |
| **OP-2** | **Correr los Database Advisors** contra el remoto y reconciliar con el mapeo Splinter de la fase | No invocables por SQL desde esta sesión (§0.6 B). Exigencia nº5 del gate | Abre `DEBT.md` con la deuda **no-bloqueante**: FKs sin índice (**0001**), `auth.*` sin `(select …)` (**0003**), índices sin uso/duplicados (**0005**/**0009**), bloat (**0020**), extensiones en `public` (**0014**, ya con dueño en `OFF-6-02`), el **escáner de secretos que grita 51 falsos positivos desde `.pnpm-store/`** (control que entrena a ignorarlo) y **`B-01`** |
| **OP-3** | Creación de un bucket de Supabase Storage, **si alguna vez se decide usarlo** | DDL/DML sobre `storage` ⇒ `deuda-operador` por vocabulario, jamás acto de agente | **Solo después** de cerrar `OFF-6-04` (paso 2 del orden LOCKED) |
| **OP-4** | Decisión sobre `pgtap` en PROD y el destino de las suites pgTAP | `drop extension` / `alter extension … set schema` son destructivos | `OFF-6-01` (`supabase-architect+checkpoint`) |

**Splinter reclamados por la fase, con hallazgo:** **0014** (4: `OFF-6-01`/`OFF-6-02`/`OFF-6-03`).
**Reclamados sin hallazgo:** **0007**+**0013** (`Q-06`+`Q-02`), **0010** (`Q-03`+`Q-18`, cero
**vacuo**), **0011** (`Q-17`, cero **fuerte** sobre 28), **0025** (`Q-20`, cero **vacuo**),
**0028**/**0029** (`Q-19`). **Sin reclamar (deuda de OP-2):** **0001**, **0003**, **0005**, **0009**,
**0020**.
