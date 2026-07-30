---
fase: 124
plan: 01
offender: OFF-01
eje: 3
query_origen: Q-10
orden_locked: 1
veredicto: DEUDA-OPERADOR
sqlstate: "42501"
migracion: supabase/migrations/0073_default_acl_supabase_admin_public.sql
pgtap: supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql
aplicado_en_prod: false
registrado_en_ledger: false
escalada_de_privilegio: false
fecha: 2026-07-29
---

# 124 · OFF-01 — Resultado adjudicado: **DEUDA-OPERADOR**

`OFF-01` (los tres default ACL del rol `supabase_admin` sobre el esquema `public`, tipos `r`, `f`,
`S`, con `anon` y `authenticated` como grantees) **NO pudo cerrarse desde el rol `postgres`**.

Es **la rama de fallo prevista**, no una sorpresa: `Q-23` ya había establecido que
`pg_roles.rolsuper = f` para `postgres` en Supabase, y `ALTER DEFAULT PRIVILEGES FOR ROLE
supabase_admin` exige membresía en ese rol. El plan lo anticipó y prescribió el escape. **No se
escaló privilegio, y no se tragó en silencio.**

---

## 1. Comando ejecutado

```
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -f supabase/migrations/0073_default_acl_supabase_admin_public.sql
```

`SUPABASE_DB_URL` se usa **por nombre**. Su valor no se ecoa, no se expande y no aparece en ningún
artefacto de esta fase.

## 2. Exit code

```
EXIT=3
```

(`3` = `psql` abortó por `ON_ERROR_STOP=1`. La transacción **no committeó**: el estado de PROD quedó
**idéntico** al de partida.)

## 3. Salida verbatim

`stdout`:

```
DO
```

`stderr` (corrida normal):

```
psql:supabase/migrations/0073_default_acl_supabase_admin_public.sql:82: NOTICE:  PRE-CHECK 0073 OK: 3 tipos de objeto afectados, como Q-10 (r, f, S).
psql:supabase/migrations/0073_default_acl_supabase_admin_public.sql:93: ERROR:  permission denied to change default privileges
```

Segunda corrida con `VERBOSITY=verbose`, **solo** para fijar el `SQLSTATE` en el registro (misma
sentencia, mismo resultado, cero efecto en PROD):

```
DO
psql:supabase/migrations/0073_default_acl_supabase_admin_public.sql:93: ERROR:  42501: permission denied to change default privileges
LOCATION:  ExecAlterDefaultPrivilegesStmt, aclchk.c:1146
EXIT=3
```

**`SQLSTATE 42501` = `insufficient_privilege`.** Es el `SQLSTATE` que el plan nombra como criterio
literal de la rama B. El `LOCATION` (`ExecAlterDefaultPrivilegesStmt`) confirma que el fallo ocurrió
en la sentencia del fix y no en otro punto.

### Lectura de la evidencia

- El **pre-check fail-closed pasó**: encontró exactamente **3** tipos de objeto (`r`, `f`, `S`)
  afectados, es decir, el estado de PROD es **el mismo que auditó `Q-10`** en la Phase 123. La
  migración no se aplicó sobre un supuesto falso; se aplicó sobre el estado correcto y fue el
  privilegio, no el diagnóstico, lo que la detuvo.
- El error se produjo en la **primera** de las tres sentencias `revoke` (línea 93 = `on tables`).
  Las otras dos ni se ejecutaron.
- No hubo commit ⇒ **nada** cambió en PROD. No se registró fila alguna en
  `supabase_migrations.schema_migrations` (`select count(*) … where version='0073'` → `0`), lo cual
  es correcto: el ledger no debe afirmar lo que la DB no tiene.

## 4. pgTAP post-apply — la salida roja **es** la evidencia

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql
```

```
BEGIN
1..4
not ok 1 - (A) OFF-01: cero entradas con grantee anon en el default ACL de supabase_admin sobre public
# Failed test 1: "(A) OFF-01: cero entradas con grantee anon en el default ACL de supabase_admin sobre public"
#         have: 12
#         want: 0
not ok 2 - (B) OFF-01: cero entradas con grantee authenticated en el default ACL de supabase_admin sobre public
# Failed test 2: "(B) OFF-01: cero entradas con grantee authenticated en el default ACL de supabase_admin sobre public"
#         have: 12
#         want: 0
ok 3 - (C) denominador vivo: el default ACL de supabase_admin sobre public sigue existiendo con postgres y service_role como grantees (el cero de A/B es por revoke, no por desaparicion de la fila)
ok 4 - (D) no-regresion: el default ACL de postgres sobre public (huella de 0044) sigue sin anon ni authenticated
# Looks like you failed 2 tests of 4
ROLLBACK
```

**2 ok, 2 not ok.** Los dos `not ok` son la prueba positiva de que `OFF-01` **sigue vivo en PROD**;
los dos `ok` prueban que el test no está midiendo un cero vacuo y que el vecino (`0044`) no se
tocó.

### Sobre el `have: 12` (no es contradicción con las «3 filas» de `Q-10`)

`Q-10` cuenta **filas de `pg_default_acl`** (3: una por tipo de objeto). El test cuenta **entradas
de `aclexplode`**, que expande una fila por *(grantee, privilegio)*. Desglose verificado contra la
DB viva:

| `defaclobjtype` | entradas (anon + authenticated) | lectura |
|---|---|---|
| `r` (tablas) | 16 | `arwdDxtm` = 8 privilegios × 2 roles |
| `f` (funciones) | 2 | `X` = 1 × 2 |
| `S` (secuencias) | 6 | `rwU` = 3 × 2 |
| **total** | **24** | = 12 por rol ⇒ el `have: 12` de (A) y de (B) |

Los números **corroboran exactamente** el ACL transcrito por `Q-10` (`anon=arwdDxtm`, `anon=X`,
`anon=rwU`). Mismo hecho, distinta unidad de conteo.

## 5. Lo que **no** se hizo (T-124-02, elevación de privilegio)

Prohibido por el plan y por la exigencia nº3 del veredicto del gate; se deja constancia explícita:

- ❌ **no** se reintentó la sentencia con otra identidad;
- ❌ **no** se usó `set role`;
- ❌ **no** se envolvió el fix en una función `security definer`;
- ❌ **no** se usó la `service_role` key ni ninguna otra credencial para hacer DDL;
- ❌ **no** se usó el SQL editor del dashboard ni ninguna vía fuera de migración;
- ❌ **no** se alteró ningún rol (`alter role … superuser`, `grant supabase_admin to postgres`, etc.);
- ❌ **no** se debilitó el pre-check ni el post-check para «hacer pasar» la migración.

El único comando repetido fue el **mismo** `psql` con `VERBOSITY=verbose`, para registrar el
`SQLSTATE`. Efecto en PROD: ninguno (misma transacción abortada).

---

## Pasos para el operador

Esta es la deuda que queda abierta. **Zero-credential-value**: aquí no hay ninguna credencial, key,
URL ni valor secreto — solo el `SQL` textual y la identidad requerida.

### Qué hay que ejecutar

Exactamente estas tres sentencias, **sin ninguna otra**:

```sql
alter default privileges for role supabase_admin in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated;
```

### Con qué identidad

`ALTER DEFAULT PRIVILEGES FOR ROLE <rol>` sólo lo puede ejecutar un rol que **sea** `supabase_admin`
o **sea miembro** de él. En Supabase gestionado, `postgres` no lo es (`rolsuper = f`, `Q-23`). Por
tanto hay dos vías, **en este orden de preferencia**:

1. **Soporte de Supabase** (vía recomendada): abrir un ticket desde el proyecto pidiendo la ejecución
   de las tres sentencias de arriba como `supabase_admin`. Justificación a incluir en el ticket, en
   una línea: *«el default ACL de `supabase_admin` sobre `public` concede `arwdDxtm`/`EXECUTE`/`rwU`
   a `anon` y `authenticated`; queremos que todo objeto futuro de `public` nazca cerrado, como ya lo
   están los del rol `postgres`»*. No requiere entregar ninguna credencial.
2. **SQL editor del dashboard**, sólo si el propietario del proyecto confirma que su sesión corre con
   un rol miembro de `supabase_admin`. Si devuelve el mismo `42501`, **no insistir**: la vía es (1).

### Cómo verificar que quedó cerrado

Sin credenciales en el comando (la variable va por nombre):

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/post-apply/0073_default_acl_supabase_admin_public.test.sql
```

Debe pasar de **2 ok / 2 not ok** a **4 ok / 0 not ok**. Ése es el criterio de cierre, y no otro.

### Qué NO hacer

- No conceder `supabase_admin` a `postgres` para forzarlo: eleva permanentemente el blast radius de
  todas las migraciones del proyecto para arreglar un ACL.
- No borrar las filas de `pg_default_acl` a mano.
- No re-aplicar `0073` esperando otro resultado: es determinista mientras la membresía no cambie.
  Cuando la deuda se pague por la vía (1), `0073` queda como el **registro** del fix — el operador
  puede aplicarla entonces (pasará limpia y, si el fix ya lo hizo el soporte, su pre-check abortará
  con `se hallaron 0`, que es el fail-closed funcionando como corresponde).

---

## Corolario operativo que hereda el resto de la Phase 124

Se dice explícitamente en vez de asumirlo:

**El default ACL abierto de `supabase_admin` no llega a materializarse en ningún objeto de esta
fase.** Razón mecánica, no optimismo:

1. Los planes posteriores de 124 (`OFF-6-04`, `OFF-6-03`, `OFF-4-01`, `OFF-4-02`, `OFF-4-03`,
   `OFF-4-04`, `OFF-5-01`) son **`revoke`**, **`alter function … set`** y **`create or replace` de
   funciones ya existentes**. Ninguno crea un objeto nuevo en `public`.
2. Un default ACL sólo actúa en el momento del `CREATE`. Un `create or replace` sobre una función
   preexistente **no** re-aplica los default privileges: conserva el ACL vigente del objeto.
3. Y aunque alguno creara un objeto, lo haría como **`postgres`** (el rol de conexión de las
   migraciones), cuyo default ACL sobre `public` **sí** está cerrado — huella viva de `0044`,
   reverificada por la aserción **(D)** de este mismo pgTAP, hoy, contra PROD.

⇒ **Las waves 2 a 7 pueden arrancar.** El paso 1 del orden LOCKED queda *adjudicado*, no *cerrado*, y
el riesgo residual es **exactamente el que existía antes de la Phase 124**: latente, sobre objetos
*futuros* creados por `supabase_admin`, y no ampliado por nada que esta fase haga.

**Condición dura para el resto de 124 y para cualquier fase futura:** mientras `veredicto` de este
archivo sea `DEUDA-OPERADOR`, **ninguna migración puede crear un objeto nuevo en `public` que no
lleve su `revoke` explícito adjunto en la misma migración**. Si un plan posterior necesitara crear
uno, debe parar y escalar, no improvisar.
