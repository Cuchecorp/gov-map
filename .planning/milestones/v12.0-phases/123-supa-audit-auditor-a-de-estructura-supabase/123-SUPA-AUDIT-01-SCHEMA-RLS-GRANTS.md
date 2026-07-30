---
fase: 123
fragmento: 01-schema-rls-grants
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC; PostgreSQL 17.6)"
ejes: [1, 2, 3]
producido_por: 123-02
consumido_por: [123-04, 123-05, 123-06]
metodo: 123-SUPA-AUDIT-00-METODO.md
---

# 123 — SUPA-AUDIT · Fragmento 01: ejes 1-3 (Schema · RLS · Grants)

> Recalcula los ejes 1, 2 y 3 contra la **DB VIVA de PROD**, bajo el régimen del fragmento rector
> [`123-SUPA-AUDIT-00-METODO.md`](./123-SUPA-AUDIT-00-METODO.md) (§0.0 régimen, §0.1 vocabulario,
> §0.2 plantilla de offender, §0.4 el ledger miente, §0.5 riesgo rector).
>
> **Ancla temporal:** `2026-07-29` · TimeZone de sesión `UTC` · PostgreSQL **17.6**.
> Todo veredicto de este fragmento es **a esta fecha y contra esta versión de motor**.
>
> **Régimen:** solo `SELECT`. Cero DDL/DML/`db push`/deploy/flags. Cero PII (solo nombres de
> relación y de columna). Filtro `not exists (pg_depend … deptype='e')` en todo enumerado de
> objetos. Invocación: `set -a; source .env; set +a` + `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"`
> — en este artefacto aparece solo el **nombre** de la variable, jamás su valor.
> **Esta fase no corrige nada**: los fixes son la Phase 124.

---

## Resumen ejecutivo de los tres ejes

| eje | tema | veredicto | evidencia |
|-----|------|-----------|-----------|
| 1 | Schema — toda tabla de `public` con RLS | `conforme` | `Q-01` (57/57 con `relrowsecurity = t`), `Q-02` → `(0 filas)` |
| 2 | RLS — policies reales y superficie `to anon` | `conforme` | `Q-04` (5 policies), `Q-05` → `(0 filas)`, `Q-06` → `(0 filas)`, `Q-07` → `(0 filas)` |
| 3 | Grants — cero-grant a `anon`/`authenticated` + `ALTER DEFAULT PRIVILEGES` | **`offender`** (2 filas) | `Q-08b`/`Q-09b` (autoritativas) `conformes`; **`Q-10` destapa el default ACL de `supabase_admin` en `public`** |

**Titular:** el boundary de tablas está **cerrado en el presente** (cero grants a `anon`, cero
policies `to anon`, 57/57 con RLS y deny-by-default) pero **abierto en el futuro**: un
`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public` vivo concede `arwdDxtm` a `anon`
y a `authenticated` sobre **toda tabla futura** que ese rol cree en `public`. Ver `OFF-01`/`OFF-02`.

---

## Eje 1 — Schema

Objetivo: enumerar **toda** tabla ordinaria de `public` con su estado de RLS y demostrar —no
afirmar— que ninguna queda sin RLS.

### `Q-01` — inventario de tablas con su estado de RLS

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

Salida real — **57 filas, transcritas completas** (el orden `relrowsecurity asc` pondría primero
cualquier tabla sin RLS; no hay ninguna, así que el listado sale alfabético):

| # | tabla | rls_habilitada | rls_forzada | n_columnas |
|---|-------|----------------|-------------|------------|
| 1 | `actualidad_senal` | `t` | `f` | 14 |
| 2 | `aporte` | `t` | `f` | 18 |
| 3 | `aportes_ingesta_estado` | `t` | `f` | 3 |
| 4 | `arista` | `t` | `f` | 13 |
| 5 | `citacion` | `t` | `f` | 13 |
| 6 | `citacion_invitado` | `t` | `f` | 4 |
| 7 | `citacion_punto` | `t` | `f` | 7 |
| 8 | `comision` | `t` | `f` | 7 |
| 9 | `comision_membresia` | `t` | `f` | 7 |
| 10 | `consentimiento` | `t` | `f` | 5 |
| 11 | `contratista` | `t` | `f` | 9 |
| 12 | `contrato` | `t` | `f` | 17 |
| 13 | `contratos_ingesta_estado` | `t` | `f` | 3 |
| 14 | `cruce_senal` | `t` | `f` | 10 |
| 15 | `declaracion` | `t` | `f` | 12 |
| 16 | `declaracion_accion_derecho` | `t` | `f` | 12 |
| 17 | `declaracion_actividad` | `t` | `f` | 11 |
| 18 | `declaracion_bien_inmueble` | `t` | `f` | 13 |
| 19 | `declaracion_bien_mueble` | `t` | `f` | 15 |
| 20 | `declaracion_familiar` | `t` | `f` | 8 |
| 21 | `declaracion_pasivo` | `t` | `f` | 10 |
| 22 | `declaracion_valor` | `t` | `f` | 14 |
| 23 | `donante` | `t` | `f` | 9 |
| 24 | `drift_alert` | `t` | `f` | 8 |
| 25 | `entidad` | `t` | `f` | 4 |
| 26 | `entidad_tercero` | `t` | `f` | 8 |
| 27 | `entidad_tercero_alias` | `t` | `f` | 4 |
| 28 | `identidad_audit` | `t` | **`t`** | 12 |
| 29 | `ingest_run` | `t` | `f` | 7 |
| 30 | `leyes_rotacion_estado` | `t` | `f` | 4 |
| 31 | `leylobby_cursor_estado` | `t` | `f` | 4 |
| 32 | `lobby_audiencia` | `t` | `f` | 12 |
| 33 | `lobby_contraparte` | `t` | `f` | 10 |
| 34 | `lobby_ingesta_estado` | `t` | `f` | 3 |
| 35 | `notificacion_envio` | `t` | `f` | 7 |
| 36 | `parlamentario` | `t` | `f` | 19 |
| 37 | `parlamentario_alias` | `t` | `f` | 4 |
| 38 | `parlamentario_bio` | `t` | `f` | 9 |
| 39 | `parlamentario_militancia` | `t` | `f` | 10 |
| 40 | `pii_contraparte_declaracion` | `t` | `f` | 9 |
| 41 | `probidad_ingesta_estado` | `t` | `f` | 3 |
| 42 | `proyecto` | `t` | `f` | 14 |
| 43 | `proyecto_autor` | `t` | `f` | 10 |
| 44 | `proyecto_embedding` | `t` | `f` | 5 |
| 45 | `proyecto_ficha` | `t` | `f` | 9 |
| 46 | `revision_entidad` | `t` | `f` | 13 |
| 47 | `revision_identidad` | `t` | `f` | 15 |
| 48 | `sector` | `t` | `f` | 2 |
| 49 | `sesion_sala` | `t` | `f` | 9 |
| 50 | `sesion_tabla_item` | `t` | `f` | 9 |
| 51 | `source_snapshot` | `t` | `f` | 11 |
| 52 | `suscripcion` | `t` | `f` | 9 |
| 53 | `tramitacion_evento` | `t` | `f` | 9 |
| 54 | `vinculo_entidad` | `t` | **`t`** | 10 |
| 55 | `vinculo_identidad` | `t` | **`t`** | 11 |
| 56 | `votacion` | `t` | `f` | 15 |
| 57 | `voto` | `t` | `f` | 8 |

**Nota sobre `relforcerowsecurity`.** Solo tres tablas la llevan: `identidad_audit`,
`vinculo_entidad`, `vinculo_identidad` — las tres del núcleo de identidad/auditoría. `FORCE` hace
que la RLS aplique **también al dueño de la tabla**; es el refuerzo correcto para una bitácora
inmutable y para los vínculos adjudicados. Su ausencia en las otras 54 **no es un offender**: bajo
Camino A el sitio va con `service_role`, que **bypassa RLS con o sin `FORCE`** (§0.5) — `FORCE` no
cambiaría el boundary real, solo daría falsa sensación de protección. Veredicto de este punto:
`conforme` (comportamiento intencional, documentado, no una omisión).

### `Q-02` — offenders directos: tablas SIN RLS

```sql
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`.** Las **57** tablas ordinarias de `public` tienen `relrowsecurity = true`.
El "0 offenders" queda demostrado por `Q-02`, no afirmado (§0.1, regla dura).

### `Q-03` — vistas y matviews de `public`

```sql
select c.relname, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1;
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`.** `public` **no tiene ninguna vista ni matview propia**. Esto elimina de
raíz una clase entera de superficie: las vistas no tienen RLS propia (heredan del subyacente y, si
son `SECURITY DEFINER`, la bypassan — Splinter **0010**), y aquí no hay ninguna que declarar como
alcanzable desde la Data API.

**Consecuencia para 123-03 (eje 5):** el sub-chequeo "vistas `SECURITY DEFINER`" del eje 5 queda
**vacío por construcción** en `public`. La superficie secdef restante es **solo funcional**
(las 42 funciones del corpus), no vistas. 123-03 puede citar `Q-03` para cerrarlo sin re-consultar.

### Contraste contra `.supabase-ops.yaml`

| fuente | qué declara | tablas |
|--------|-------------|--------|
| `corpus.live_tables` de `.supabase-ops.yaml` (bootstrapeado en 123-01) | manifiesto SSoT del preflight | **57** |
| `Q-01` (**autoritativa**, DB viva, filtro `deptype='e'`) | catálogo `pg_class` | **57** |

**Cero drift.** El manifiesto coincide **exactamente** con la DB viva a la fecha del ancla, tanto en
recuento como en los nombres (los 57 nombres del `.supabase-ops.yaml` son los mismos 57 de la tabla
de `Q-01`). No hay fila de offender por este contraste.

### Veredicto del Eje 1

`conforme` — 57/57 tablas con RLS habilitada (`Q-02` vacía), cero vistas/matviews (`Q-03` vacía),
cero drift contra el manifiesto.

---

## Eje 2 — RLS

Objetivo: enumerar las policies **reales** (las que existen en la DB, no las que los archivos de
migración sugieren) y aislar la superficie pública real.

### `Q-04` — todas las policies de `public`

```sql
select schemaname, tablename, policyname, permissive, roles, cmd,
       (qual is not null) as tiene_using,
       (with_check is not null) as tiene_with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Salida real — **5 filas, completas**:

| schemaname | tablename | policyname | permissive | roles | cmd | tiene_using | tiene_with_check |
|------------|-----------|------------|------------|-------|-----|-------------|------------------|
| `public` | `consentimiento` | `consentimiento_insert_own` | PERMISSIVE | `{authenticated}` | INSERT | `f` | `t` |
| `public` | `consentimiento` | `consentimiento_select_own` | PERMISSIVE | `{authenticated}` | SELECT | `t` | `f` |
| `public` | `suscripcion` | `suscripcion_delete_own` | PERMISSIVE | `{authenticated}` | DELETE | `t` | `f` |
| `public` | `suscripcion` | `suscripcion_insert_own` | PERMISSIVE | `{authenticated}` | INSERT | `f` | `t` |
| `public` | `suscripcion` | `suscripcion_select_own` | PERMISSIVE | `{authenticated}` | SELECT | `t` | `f` |

Lecturas del resultado:

1. **55 de las 57 tablas tienen RLS habilitada y CERO policies** ⇒ **deny-by-default absoluto** para
   `anon` y `authenticated`. Es el estado deseado del régimen `>0044`: RLS on + sin policy = nadie
   pasa (salvo `service_role`, que bypassa — §0.5).
2. Las **únicas 2 tablas con policies** son las de-usuario: `suscripcion` y `consentimiento`,
   exactamente las `USER_OWNED_TABLES` del guard Block D. La forma es la correcta:
   `SELECT`/`DELETE` con `USING` y `INSERT` con `WITH CHECK` (own-row), sin ninguna policy `ALL`.
3. **Cero policies `FOR ALL`** y cero `RESTRICTIVE` — todas `PERMISSIVE` sobre un universo mínimo.

**El ledger vuelve a mentir (contraste, §0.4).** `grep -l "create policy" supabase/migrations/*.sql`
devuelve **20 archivos** (`0008`, `0010`, `0011`, `0018`–`0024`, `0026`, `0028`, `0038`, `0043`,
`0047`–`0050`, `0069`, `0071`). Leer el repo sugeriría **decenas** de policies vivas. La DB viva
tiene **5**: el lockdown `0043`/`0044` dropeó las anteriores. **La evidencia de existencia es `Q-04`,
no el `grep`** — el `grep` solo sirvió para identificar la migración de origen de las 5 supervivientes.

### `Q-05` — la superficie pública REAL (policies `to anon` / `to public`)

```sql
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and (roles && array['anon','public']::name[])
order by tablename, policyname;
```

Salida real:

```
(0 filas)
```

| tablename | policyname | roles | cmd | ¿esperada? |
|-----------|------------|-------|-----|------------|
| *(0 filas)* | — | — | — | — |

**Veredicto: `conforme`, y más fuerte de lo que el plan anticipaba.** La superficie pública real
—que la lección v4.0 identifica como "las policies `to anon`, NO los grants por default"— está
**VACÍA**. No hay una sola policy que conceda algo a `anon` o a `public` sobre ninguna tabla de
`public`. Cruzado con `Q-09b` (cero grants a `anon`) y `Q-11` (`anon` sí tiene `USAGE` sobre el
esquema), el resultado es que **`anon` tiene la puerta del esquema abierta y ni una sola tabla que
leer** — coherente con el estado documentado desde el cutover de Camino A (REST anónima muerta).

Trazabilidad de las 5 policies que **sí** existen (columna `¿esperada?` de `Q-04`, con la migración
de origen identificada por `grep`, pero cuya **existencia** la prueba `Q-04` contra la DB):

| policy | tablename | roles | ¿esperada? | migración de origen (contraste) |
|--------|-----------|-------|------------|--------------------------------|
| `suscripcion_select_own` | `suscripcion` | `{authenticated}` | **sí** — tabla de-usuario, own-row | `0069_suscripcion_rls.sql:56` |
| `suscripcion_insert_own` | `suscripcion` | `{authenticated}` | **sí** | `0069_suscripcion_rls.sql:62` |
| `suscripcion_delete_own` | `suscripcion` | `{authenticated}` | **sí** | `0069_suscripcion_rls.sql:68` |
| `consentimiento_insert_own` | `consentimiento` | `{authenticated}` | **sí** | `0071_consentimiento.sql:45` |
| `consentimiento_select_own` | `consentimiento` | `{authenticated}` | **sí** | `0071_consentimiento.sql:51` |

Ninguna es `to anon` ⇒ **ninguna fila de `Q-05` cruza al eje 6 (plan 123-04)**: no hay superficie
`anon` vía policy que el guard CI deba cubrir. Lo que 123-04 sí hereda está en "Qué hereda 123-04/05/06".

### `Q-06` — Splinter 0007: policy sobre tabla con RLS deshabilitada

```sql
select p.tablename, p.policyname
from pg_policies p
join pg_class c on c.relname = p.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where p.schemaname = 'public' and c.relrowsecurity = false;
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`.** Cero policies inertes (policy definida sobre tabla con RLS off, que da
falsa sensación de protección). Consistente con `Q-02`: no hay tabla con RLS off donde alojarlas.
Splinter **0007** y **0013** quedan **reclamados y sin hallazgos** por `Q-06` + `Q-02`.

### `Q-07` — policies permisivas de barra libre (`using (true)`)

```sql
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and qual = 'true';
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`.** Ninguna de las 5 policies vivas usa `using (true)`. Las tres con `USING`
(`*_select_own`, `suscripcion_delete_own`) llevan predicado own-row real, no una constante.

### Riesgo rector aplicado al Eje 2 (§0.5, verbatim)

> El sitio público lee con **`service_role`** (Camino A, v4.0) ⇒ **RLS no lo protege.** La PII está
> protegida por el **guard CI** (`app/lib/lockdown-guard.test.ts`) que escanea `app/` por `.from` de
> tablas PII y `.rpc` fuera de `PUBLIC_RPC_ALLOWLIST`. **Ese guard es parte del boundary y entra en
> la auditoría (eje 6, plan 123-04).**

Dicho sin rodeos y con el resultado de este eje en la mano: **un Eje 2 `conforme` NO implica que la
superficie esté protegida.** `Q-04`–`Q-07` demuestran que la Data API con `anon`/`authenticated`
está cerrada, y eso es todo lo que demuestran. El sitio no entra por esa puerta: entra con
`service_role`, que **bypassa RLS por diseño**, así que las 57 tablas —incluida
`pii_contraparte_declaracion` y toda la familia `declaracion_*`— son **plenamente legibles** por el
código de `app/`. El control efectivo sobre esa superficie **no es RLS: es el guard CI**. Los ejes 2
y 6 miden cosas distintas y **ninguno sustituye al otro**.

**Corolario, dado que `Q-05` salió vacía:** con cero policies `to anon` y cero grants a `anon`
(`Q-09b`), el guard CI no es *una* capa del boundary público — es **la única**. Cualquier punto
ciego suyo es una fuga sin red de contención debajo. Eso sube la criticidad del eje 6 (123-04).

### Veredicto del Eje 2

`conforme` — 5 policies vivas, todas `to authenticated` sobre las 2 tablas de-usuario esperadas;
superficie `to anon` **vacía** (`Q-05`); cero policies inertes (`Q-06`); cero `using (true)` (`Q-07`).
Cero offenders. **Con la advertencia rector de arriba, que no es decorativa.**

---

## Eje 3 — Grants

Objetivo: demostrar el régimen **cero-grant** a `anon`/`authenticated` sobre tablas (`>0044`) y
verificar que ningún `ALTER DEFAULT PRIVILEGES` re-abre lo revocado.

### ADVERTENCIA DE MÉTODO — LOCKED (transcrita verbatim del plan 123-02)

> `information_schema.role_table_grants` está **filtrada por permisos**: solo muestra los grants en
> los que el usuario de la conexión es grantor, grantee o miembro del rol grantee. Si el rol de
> conexión no es miembro de `anon`/`authenticated`, `Q-09` puede devolver `(0 filas)` **sin probar
> nada** — un falso negativo en el eje más caliente del boundary. Por eso la **evidencia de
> conformidad de este eje es `Q-08b`/`Q-09b` (`aclexplode` sobre `pg_class.relacl`, catálogo
> autoritativo y no filtrado)**; `Q-08`/`Q-09` quedan como **contraste**, no como prueba.

**Comprobación del supuesto de la advertencia (ejecutada, no asumida):**

```sql
select current_user,
       (select string_agg(r.rolname, ',')
          from pg_auth_members m join pg_roles r on r.oid = m.roleid
         where m.member = (select oid from pg_roles where rolname = current_user)) as miembro_de;
```

Salida real:

```
postgres|pg_monitor,pg_signal_backend,pg_read_all_data,pg_create_subscription,anon,authenticated,service_role,authenticator,supabase_privileged_role,supabase_realtime_admin
```

El rol de conexión (`postgres`) **sí es miembro de `anon` y de `authenticated`** ⇒ en **esta**
corrida la vista filtrada **no** ocultó nada, y por eso `Q-08` coincide exacto con `Q-08b` y `Q-09`
con `Q-09b`. **Esto no degrada la advertencia: la confirma.** La coincidencia es un accidente del
privilegio de esta conexión, no una propiedad de la vista. Bajo otra credencial (p. ej. un rol de
CI con menos membresías) `Q-08`/`Q-09` devolverían `(0 filas)` engañosas. **La evidencia que sostiene
el veredicto sigue siendo `Q-08b`/`Q-09b`**; `Q-08`/`Q-09` se conservan como contraste y como
demostración de que el hueco de método existe aunque hoy no se haya materializado.

### `Q-08` — grants de tabla a `anon`/`authenticated` (CONTRASTE, vista filtrada)

```sql
select c.relname, g.grantee, g.privilege_type
from information_schema.role_table_grants g
join pg_class c on c.relname = g.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where g.table_schema = 'public'
  and g.grantee in ('anon','authenticated')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by g.grantee, c.relname, g.privilege_type;
```

Salida real — 5 filas:

| relname | grantee | privilege_type |
|---------|---------|----------------|
| `consentimiento` | `authenticated` | INSERT |
| `consentimiento` | `authenticated` | SELECT |
| `suscripcion` | `authenticated` | DELETE |
| `suscripcion` | `authenticated` | INSERT |
| `suscripcion` | `authenticated` | SELECT |

### `Q-08b` — grants de tabla a `anon`/`authenticated` (**AUTORITATIVA**, catálogo)

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

Salida real — 5 filas:

| relname | grantee | privilege_type |
|---------|---------|----------------|
| `consentimiento` | `authenticated` | INSERT |
| `consentimiento` | `authenticated` | SELECT |
| `suscripcion` | `authenticated` | DELETE |
| `suscripcion` | `authenticated` | INSERT |
| `suscripcion` | `authenticated` | SELECT |

**Veredicto: `conforme`.** Sobre las 57 tablas de `public`, los **únicos** grants vivos a
`anon`/`authenticated` son **5**, todos a `authenticated`, todos sobre las 2 tablas de
`USER_OWNED_TABLES`, y **cada privilegio tiene su policy own-row correspondiente en `Q-04`** (grant y
policy encajan 1:1, sin over-grant huérfano: `SELECT`+`INSERT`+`DELETE` en `suscripcion`,
`SELECT`+`INSERT` en `consentimiento`). **Cero grants a `anon`. Cero `UPDATE` en ambas.**

### `Q-09b` — offenders de Block A/D sobre el catálogo (**AUTORITATIVA**)

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

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`, sostenido por el catálogo no filtrado.** El régimen cero-grant `>0044`
se cumple en la DB viva: ningún grant a `anon`, y ningún grant a `authenticated` fuera de
`USER_OWNED_TABLES = {suscripcion, consentimiento}`.

### `Q-09` — mismos offenders vía la vista filtrada (CONTRASTE, **no es la evidencia**)

```sql
select c.relname, g.grantee, g.privilege_type
from information_schema.role_table_grants g
join pg_class c on c.relname = g.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where g.table_schema = 'public'
  and ( g.grantee = 'anon'
     or (g.grantee = 'authenticated' and c.relname not in ('suscripcion','consentimiento')) )
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1,2,3;
```

Salida real:

```
(0 filas)
```

Coincide con `Q-09b`, **pero por sí sola esta salida no vale como evidencia** (§ advertencia de
método). Se registra como confirmación, no como prueba.

### Tabla de autoridad de las cuatro queries de grants

| query | fuente | ¿autoritativa? | filas |
|-------|--------|----------------|-------|
| `Q-08` | `information_schema.role_table_grants` (**vista filtrada por permisos**) | **NO** — contraste | 5 |
| `Q-08b` | `aclexplode(pg_class.relacl)` (**catálogo, no filtrado**) | **SÍ** | 5 |
| `Q-09` | `information_schema.role_table_grants` (**vista filtrada por permisos**) | **NO** — contraste | 0 |
| `Q-09b` | `aclexplode(pg_class.relacl)` (**catálogo, no filtrado**) | **SÍ** | 0 |

**Ningún veredicto `conforme` de este eje se apoya en `Q-08`/`Q-09`.** El `conforme` del régimen
cero-grant lo sostiene `Q-09b` (0 filas del catálogo). En esta corrida vista y catálogo coincidieron;
si hubieran divergido, **la verdad sería `Q-09b`** y la divergencia se registraría como nota de
método.

### `Q-10` — `ALTER DEFAULT PRIVILEGES` vivos

```sql
select pg_get_userbyid(d.defaclrole) as rol_creador,
       coalesce(n.nspname,'(todos)')  as esquema,
       d.defaclobjtype               as tipo_objeto,
       d.defaclacl::text             as acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1,2,3;
```

Salida real — 30 filas (`r` = tables, `f` = functions, `S` = sequences):

| rol_creador | esquema | tipo | acl | lectura |
|-------------|---------|------|-----|---------|
| `postgres` | `pgmq` | S | `{pg_monitor=r/postgres}` | ok |
| `postgres` | `pgmq` | r | `{pg_monitor=r/postgres}` | ok |
| `postgres` | `public` | S | `{postgres=rwU/postgres,service_role=rwU/postgres}` | **✅ sin `anon`** — huella de `0044` |
| `postgres` | `public` | f | `{postgres=X/postgres,service_role=X/postgres}` | **✅ sin `anon`** — huella de `0044` |
| `postgres` | `public` | r | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` | **✅ sin `anon`** — huella de `0044` |
| `postgres` | `storage` | S | `{postgres=rwU,anon=rwU,authenticated=rwU,service_role=rwU}` | schema `storage`, fuera de alcance (§0.6 D) → eje 6 |
| `postgres` | `storage` | f | `{postgres=X,anon=X,authenticated=X,service_role=X}` | ídem → eje 6 |
| `postgres` | `storage` | r | `{postgres=arwdDxtm,anon=arwdDxtm,authenticated=arwdDxtm,service_role=arwdDxtm}` | ídem → eje 6 |
| `supabase_admin` | `cron` | S/f/r | `{postgres=…*/supabase_admin}` | fuera de alcance |
| `supabase_admin` | `extensions` | S/f/r | `{postgres=…*/supabase_admin}` | fuera de alcance |
| `supabase_admin` | `graphql` | S/f/r | `{postgres,anon,authenticated,service_role}` | fuera de alcance |
| `supabase_admin` | `graphql_public` | S/f/r | `{postgres,anon,authenticated,service_role}` | fuera de alcance |
| **`supabase_admin`** | **`public`** | **S** | `{postgres=rwU/supabase_admin,`**`anon=rwU`**`,`**`authenticated=rwU`**`,service_role=rwU}` | **🔴 OFFENDER** |
| **`supabase_admin`** | **`public`** | **f** | `{postgres=X/supabase_admin,`**`anon=X`**`,`**`authenticated=X`**`,service_role=X}` | **🔴 OFFENDER** |
| **`supabase_admin`** | **`public`** | **r** | `{postgres=arwdDxtm/supabase_admin,`**`anon=arwdDxtm`**`,`**`authenticated=arwdDxtm`**`,service_role=arwdDxtm}` | **🔴 OFFENDER** |
| `supabase_admin` | `realtime` | S/f/r | `{postgres,dashboard_user}` | fuera de alcance |
| `supabase_auth_admin` | `auth` | S/f/r | `{postgres,dashboard_user}` | fuera de alcance |

**Veredicto: `offender`.** Y es el hallazgo central de este fragmento, así que conviene decirlo con
precisión:

- **Lo que `0044` SÍ logró:** las tres filas `postgres | public | {S,f,r}` no contienen `anon` ni
  `authenticated`. El `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` del régimen `>0044` está **vivo y
  correcto**. Como las migraciones del proyecto se aplican como `postgres`
  (`psql "$SUPABASE_DB_URL" --single-transaction -f`), toda tabla creada por el pipeline nace sin
  grants a `anon` — que es exactamente lo que `Q-09b` mide y confirma.
- **Lo que `0044` NO cubrió:** existe un segundo juego de defaults, del rol **`supabase_admin`**,
  sobre el **mismo esquema `public`**, que concede `arwdDxtm` (**todos** los privilegios de tabla) a
  **`anon`** y a `authenticated`, más `EXECUTE` sobre funciones y `rwU` sobre secuencias. Es el
  default de bootstrap de Supabase; `0044` revocó el de `postgres` y **no tocó éste**.
- **Riesgo real:** es **latente, no activo**. `Q-09b` prueba que **hoy** ninguna tabla de `public`
  tiene ese grant, porque ninguna fue creada por `supabase_admin`. Pero **cualquier** objeto futuro
  creado en `public` por `supabase_admin` (o por un flujo que corra bajo ese rol) nacería **legible
  por `anon` vía Data API sin que nadie escriba un solo `GRANT`** — y `Q-11` confirma que `anon`
  tiene `USAGE` sobre `public`, así que el grant sería inmediatamente alcanzable. Es una fuga que se
  abre sola, silenciosa, sin línea de código que la delate.
- **La fila `f` (funciones) importa además para 123-03:** el default concede `EXECUTE` a `anon` sobre
  funciones futuras de `public` creadas por `supabase_admin`. Eso toca directamente los ejes 4 y 5.

**No se corrige aquí** (régimen §0.6 A). Se registra como `OFF-01` con `destino: 124-aditivo`.

### `Q-11` — `USAGE` sobre el esquema `public`

```sql
select r.rolname, has_schema_privilege(r.rolname, 'public', 'USAGE') as usage_public
from pg_roles r
where r.rolname in ('anon','authenticated','service_role');
```

Salida real — 3 filas:

| rolname | usage_public |
|---------|--------------|
| `authenticated` | `t` |
| `anon` | `t` |
| `service_role` | `t` |

**Veredicto: `limite-declarado`** (no `offender`). `anon` **sí** tiene `USAGE` sobre `public`, así
que la puerta del esquema está abierta y **la superficie depende enteramente de los grants de
objeto** (`Q-09b` → 0) **y de las policies** (`Q-05` → 0). Hoy eso da **cero acceso efectivo**.

Se declara `limite-declarado` en vez de `offender` porque **revocar `USAGE on schema public from
anon` es una decisión de arquitectura de la plataforma, no un fix aditivo**: PostgREST resuelve la
Data API a través de ese `USAGE`, y quitarlo afectaría también a la ejecución de RPCs y al
comportamiento de `authenticated` (que sí necesita el esquema para sus 2 tablas). **No se diseña
aquí.** Queda como observación para 123-06: el cierre correcto no es revocar `USAGE`, es mantener
`Q-09b` en cero **y cerrar `OFF-01`**, que es lo que puede volverla no-cero sin aviso.

### Contraste: guard estático vs DB viva

Corrida real del guard (`app/lib/lockdown-guard.test.ts`, ancla `2026-07-29`):

```
$ pnpm exec vitest run lib/lockdown-guard.test.ts        # cwd = app/
 ✓ lib/lockdown-guard.test.ts (22 tests) 107ms
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

*(Suite completa de `app` en la misma sesión: **107 archivos / 1577 tests, todos verdes** — el guard
no está verde por aislamiento.)*

| fuente | qué mira | offenders |
|--------|----------|-----------|
| `lockdown-guard.test.ts` Block A/D | **texto** de `supabase/migrations/*.sql` con nº > 0044 (`anonGrantOffenders` :240 busca `grant … to anon\|public`; `authenticatedGrantOffenders` :273 busca `grant … to authenticated` / `create policy … to authenticated` con tabla fuera de `USER_OWNED_TABLES` :162) | **0** (22/22 verde) |
| `Q-09b` (`aclexplode`, **autoritativa**) | **la DB viva** (catálogo `pg_class.relacl`, no filtrado) | **0** `(0 filas)` |
| `Q-09` (`role_table_grants`, contraste) | la DB viva, **vista filtrada por permisos** | **0** `(0 filas)` |

**Resultado del contraste en Block A/D: SIN punto ciego.** El guard estático dice 0 y la DB viva
autoritativa dice 0 — **coinciden**. No hay divergencia guard-vs-DB en el eje que el plan anticipaba
como caliente.

**Pero el contraste destapa un punto ciego DISTINTO, de cobertura.** El guard escanea texto SQL
buscando la palabra `grant`. `Q-10` demuestra que la superficie a `anon` **también puede abrirse sin
un solo `GRANT` en el texto**, vía `ALTER DEFAULT PRIVILEGES`. El guard **no tiene ninguna aserción**
sobre `alter default privileges`: una migración futura que escribiera
`alter default privileges in schema public grant select on tables to anon` **pasaría el guard verde**
y abriría toda tabla futura. Eso se registra como `OFF-02` con `destino: guard` ⇒ lo cierra el plan
**123-05**, en esta misma fase, antes de que 124 toque nada (patrón "guard primero").

Límite honesto de ese fix: el guard es **estático sobre archivos del repo** y por diseño no puede
ver el ACL vivo de `supabase_admin` (que no proviene de ninguna migración del proyecto, sino del
bootstrap de la plataforma). Extender el guard cubre la **regresión futura por migración**; el ACL
vivo ya existente lo cierra `OFF-01` en 124. Los dos son necesarios y ninguno sustituye al otro.

### Veredicto del Eje 3

`offender` — **2 filas**. El régimen cero-grant está **demostrado conforme en el presente**
(`Q-08b`/`Q-09b`, catálogo autoritativo) y **el guard estático coincide con la DB viva** en Block
A/D. La desviación no está en los grants existentes sino en los **defaults**: `ALTER DEFAULT
PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public` sigue concediendo todo a `anon`/`authenticated`
sobre objetos futuros (`OFF-01`), y el guard no vigila esa clase de sentencia (`OFF-02`).

---

## Tabla de offenders (plantilla §0.2)

| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
|---|------------------------|-----|--------|---------------|-----------------------------|---------|
| OFF-01 | `default-acl · supabase_admin en schema public (tipos r, f, S)` | 3 | Toda tabla/función/secuencia **futura** creada por `supabase_admin` en `public` nace con `arwdDxtm`/`EXECUTE` para `anon` ⇒ PII legible por un cliente no autenticado vía Data API sin que exista ningún `GRANT` en el repo que lo delate (`anon` ya tiene `USAGE` sobre el esquema, `Q-11`) | `alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated;` + idéntico para `on functions` y `on sequences`. **Si la ejecución falla por falta de membresía en `supabase_admin`, el ítem NO se fuerza: se reclasifica a `deuda-operador`** (acto en dashboard/soporte Supabase), nunca se escala privilegio para aplicarlo | `Q-10` | `124-aditivo` |
| OFF-02 | `guard · app/lib/lockdown-guard.test.ts (Block A/D)` | 3 | El guard solo caza `grant … to anon/authenticated` en el texto de las migraciones; es **ciego a `alter default privileges`**. Una migración futura podría abrir toda tabla futura a `anon` **con el guard en verde** ⇒ regresión del boundary sin señal en CI | Extender el guard con una aserción por-sentencia que trate como offender cualquier `alter default privileges` que contenga `grant … to anon\|public\|authenticated` en migraciones > 0044 (mismo idiom por-`;` de `anonGrantOffenders`, sobre el SQL ya stripeado y en minúscula). Límite declarado: el guard es estático sobre el repo y **no** puede ver el ACL vivo de `supabase_admin` — esa parte la cierra `OFF-01` | `Q-10` + corrida del guard | `guard` |

**Cero offenders en los ejes 1 y 2.** Demostrado por `Q-02`, `Q-03`, `Q-05`, `Q-06` y `Q-07`, todas
transcritas arriba con su salida `(0 filas)` junto a la query (§0.1, regla dura).

---

## "0 offenders" demostrados en este fragmento

| afirmación | query que la demuestra | salida |
|------------|------------------------|--------|
| Ninguna tabla de `public` sin RLS | `Q-02` | `(0 filas)` |
| Ninguna vista/matview propia en `public` | `Q-03` | `(0 filas)` |
| Ninguna policy `to anon` / `to public` | `Q-05` | `(0 filas)` |
| Ninguna policy inerte (Splinter 0007/0013) | `Q-06` | `(0 filas)` |
| Ninguna policy `using (true)` | `Q-07` | `(0 filas)` |
| Ningún grant a `anon`, ni a `authenticated` fuera de `USER_OWNED_TABLES` | **`Q-09b`** (autoritativa) | `(0 filas)` |
| — el mismo hecho, vía contraste | `Q-09` (no evidencia por sí sola) | `(0 filas)` |

---

## Qué hereda 123-04 / 123-05 / 123-06

**123-03 (ejes 4-5, RPCs y `SECURITY DEFINER`)** — aunque no es consumidor declarado de este
fragmento, dos resultados le aplican directamente:
- `Q-03` = `(0 filas)` ⇒ **no hay vistas en `public`**, luego el sub-chequeo "vistas `SECURITY
  DEFINER`" (Splinter **0010**) del eje 5 está **vacío por construcción**; puede cerrarse citando
  `Q-03` sin re-consultar.
- La fila `f` de `OFF-01` concede `EXECUTE` por default a `anon` sobre **funciones futuras** creadas
  por `supabase_admin` en `public` ⇒ el eje 4 debe enumerar el `proacl` **vivo** de las 42 funciones,
  no confiar en el default.

**123-04 (eje 6, buckets/keys/superficie Data API + guard CI)**:
1. **El guard CI es la ÚNICA capa del boundary público.** `Q-05` (0 policies `to anon`) + `Q-09b`
   (0 grants a `anon`) demuestran que no hay una segunda red debajo. Todo punto ciego del guard es
   una fuga directa. Auditar el eje 6 con esa criticidad.
2. **`Q-05` no aporta filas que cruzar**: no existe superficie `anon` vía policy que el guard deba
   cubrir. Lo que el guard debe cubrir es el acceso `service_role` desde `app/`.
3. **Las tres filas `postgres | storage | {r,f,S}` de `Q-10`** conceden `arwdDxtm`/`EXECUTE`/`rwU` a
   `anon` y `authenticated` por default en el esquema **`storage`**. Este fragmento las declara
   **fuera de alcance** (§0.6 D: se audita `public`) y **las entrega al eje 6**, que sí audita
   `storage.buckets`. Se cruzan con el hallazgo de 123-01 (`storage.buckets` **vacío** en PROD): hoy
   no hay bucket que exponer, pero el default está abierto — **el orden importa**, crear un bucket
   antes de cerrar ese default lo nace público.
4. **`Q-11`:** `anon` tiene `USAGE` sobre `public` (`t`). Registrado como `limite-declarado`, no
   como offender; 123-06 decide si escala.

**123-05 (extensión de guards)**:
- **`OFF-02` es su entrada**: extender `lockdown-guard.test.ts` para tratar como offender un
  `alter default privileges … grant … to anon|public|authenticated` en migraciones > 0044. Es la
  única corrección que esta fase autoriza (patrón "guard primero"), y debe quedar hecha **antes** de
  que 124 aplique `OFF-01`.
- Baseline de partida: **22/22 verde** hoy. La extensión debe seguir en verde contra el repo actual
  (ninguna migración existente usa ese idiom).

**123-06 (consolidación y veredicto de `supabase-reviewer`)**:
- Ejes 1 y 2 entran como **`conforme` con evidencia completa**; eje 3 entra como **`offender` (2
  filas)** más un **`limite-declarado`** (`Q-11`, `USAGE` de `anon` sobre `public`).
- **Splinter reclamados sin hallazgo por este fragmento:** **0007** (policy con RLS off) y **0013**
  (RLS off en tabla expuesta) vía `Q-06` + `Q-02`. **0010** (`security_definer_view`) queda
  reclamado sin hallazgo **en `public`** vía `Q-03` (cero vistas), pero su cierre formal es de
  123-03.
- **Nota de método a preservar en el veredicto:** la coincidencia `Q-08`≡`Q-08b` y `Q-09`≡`Q-09b` se
  debe a que la conexión corrió como `postgres`, **miembro** de `anon`/`authenticated`. Bajo otra
  credencial la vista filtrada mentiría. El régimen de evidencia `aclexplode`-primero debe
  mantenerse en toda re-auditoría futura.
