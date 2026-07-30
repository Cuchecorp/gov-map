---
fase: 124
plan: 02
offender: OFF-6-03
eje: 6
query_origen: Q-22 + Q-22b + Q-24b
orden_locked: 3
veredicto: DEUDA-OPERADOR
sqlstate: "01006 (WARNING x24, no privileges could be revoked) -> P0001 (post-check fail-closed)"
exit_code: 3
migracion: supabase/migrations/0075_revoke_net_roles_publicos.sql
pgtap: supabase/tests/post-apply/0075_revoke_net_roles_publicos.test.sql
pgtap_resultado: "1 ok / 5 not ok"
aplicado_en_prod: false
registrado_en_ledger: false
escalada_de_privilegio: false
ssrf_sigue_abierta: true
urgencia_op1_op4: ELEVADA
fecha: 2026-07-29
---

# 124 · OFF-6-03 — Resultado adjudicado: **DEUDA-OPERADOR**

El `revoke` de `net` a los roles públicos **no pudo ejecutarse desde el rol `postgres`**. Es **la rama
de fallo que el plan predijo como probable** — ownership de `supabase_admin` sobre `pg_net` — aunque
**se manifestó con un `SQLSTATE` distinto al esperado**. Ver §5: la discriminación de rama exigió un
juicio RULE-1 y se documenta antes que nada, no se disfraza.

**PROD quedó intacto** (`Q-22b` de `net` byte-idéntico al de partida), **no se escaló privilegio**, y
**la ingesta sigue operativa** (5/5 jobs `active`, últimas corridas `succeeded`).

---

## 1. Comando ejecutado

```
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -v VERBOSITY=verbose -f supabase/migrations/0075_revoke_net_roles_publicos.sql
```

`SUPABASE_DB_URL` se usa **por nombre**. Su valor no se ecoa, no se expande y no aparece en ningún
artefacto de esta fase.

## 2. Exit code

```
EXIT=3
```

(`3` = `psql` abortó por `ON_ERROR_STOP=1`. La transacción **no committeó**.)

## 3. Salida verbatim (condensada — los 24 `WARNING` son el mismo, uno por objeto)

```
NOTICE:  00000: PRE-CHECK 0075 OK: 12 de 12 funciones de net tienen EXECUTE para anon, y anon tiene USAGE sobre el esquema (estado auditado).
DO
:118: WARNING:  01006: no privileges could be revoked for "net"
LOCATION:  restrict_and_check_grant, aclchk.c:365
REVOKE
:119: WARNING:  01006: no privileges could be revoked for "net"
REVOKE
:120: WARNING:  01006: no privileges could be revoked for "check_worker_is_up"
:120: WARNING:  01006: no privileges could be revoked for "_await_response"
:120: WARNING:  01006: no privileges could be revoked for "_urlencode_string"
:120: WARNING:  01006: no privileges could be revoked for "_encode_url_with_params_array"
:120: WARNING:  01006: no privileges could be revoked for "worker_restart"
:120: WARNING:  01006: no privileges could be revoked for "wait_until_running"
:120: WARNING:  01006: no privileges could be revoked for "wake"
:120: WARNING:  01006: no privileges could be revoked for "http_get"
:120: WARNING:  01006: no privileges could be revoked for "http_post"
:120: WARNING:  01006: no privileges could be revoked for "http_delete"
:120: WARNING:  01006: no privileges could be revoked for "_http_collect_response"
:120: WARNING:  01006: no privileges could be revoked for "http_collect_response"
REVOKE
:121: [las mismas 12 WARNING 01006, para el revoke `from public`]
REVOKE
:156: ERROR:  P0001: POST-CHECK 0075: anon SIGUE con USAGE sobre net. Se aborta para no committear un cierre falso.
CONTEXT:  PL/pgSQL function inline_code_block line 7 at RAISE
EXIT=3
```

**Las 4 sentencias `revoke` se ejecutaron y las 4 fueron NO-OP.** Postgres no lanza `42501` en un
`REVOKE` que no le corresponde: emite `WARNING 01006 no privileges could be revoked` desde
`restrict_and_check_grant` y **no cambia nada**. El `ERROR` final es **el post-check fail-closed de la
propia migración** haciendo su trabajo: detectó que el revoke no surtió efecto y abortó en vez de
committear un cierre falso.

## 4. Evidencia de la causa raíz — es ownership, no otra cosa

| Hecho | Valor vivo (2026-07-29) |
|---|---|
| Propietario del esquema `net` | `supabase_admin` |
| Propietario de la extensión `pg_net` | `supabase_admin` (`extnamespace = public`) |
| Propietario de `net.http_post` | `supabase_admin` |
| Otorgante de todos los grants de `net` | `supabase_admin` (`=U/supabase_admin`, `anon=U/supabase_admin`, …) |
| `pg_has_role('postgres','supabase_admin','USAGE')` | **`false`** |
| `proacl` de `http_get` / `http_post` | **`NULL`** ⇒ `EXECUTE TO PUBLIC` implícito ⇒ **solo el propietario puede revocarlo** |

Es **exactamente el mismo escape de `OFF-01`**: `postgres` (`rolsuper = f`, `Q-23`) no es ni
propietario ni otorgante, y no es miembro de `supabase_admin`.

**PROD intacto** — `Q-22b` re-corrida después del intento, byte-idéntica a la de partida:

```
net|{supabase_admin=UC/supabase_admin,=U/supabase_admin,supabase_functions_admin=U/supabase_admin,postgres=U/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin}
```

`Q-22` re-corrida: `net|true|true` (sigue igual que en 123). Ledger:
`select count(*) … where version='0075'` → **`0`** — correcto: nada se aplicó, nada se registró.

## 5. Discriminación de rama — juicio RULE-1, declarado

El plan define **rama B** como `exit != 0` con `SQLSTATE 42501` **o mensaje de membresía/ownership
sobre `net`/`pg_net`/`supabase_admin`**, y **rama C** como `exit != 0` por otra causa, *«sintaxis,
pre-check o post-check disparado»* ⇒ PARAR.

Leído literalmente, «post-check disparado» apunta a rama C. **La realidad manda y dice rama B**, por
tres razones mecánicas:

1. El **pre-check pasó** (12 de 12) ⇒ el estado de partida es el auditado. No hubo supuesto falso ni
   divergencia de diagnóstico — el escenario que la rama C existe para atrapar.
2. La causa raíz es **exactamente** la que la rama B nombra: *"mensaje de membresía/ownership sobre
   `net`/`pg_net`/`supabase_admin`"*. Los 24 `WARNING 01006` **son** ese mensaje; sólo que Postgres lo
   emite como *warning* en `REVOKE`, no como `ERROR 42501`. El plan asumió la forma de error del
   `ALTER DEFAULT PRIVILEGES` de `0073`; `REVOKE` tiene otra semántica.
3. El `P0001` no es un fallo del fix: es **el post-check de la migración funcionando como fue
   diseñado**, convirtiendo un no-op silencioso en una transacción abortada. Sin él, esta migración
   habría committeado sin revocar nada y `OFF-6-03` se habría dado por cerrado en falso. **Ése es el
   hallazgo más valioso de la corrida.**

Se adjudica **`DEUDA-OPERADOR`** y **no** se para la fase. Si el orquestador prefiere la lectura
literal (rama C ⇒ PARAR), este archivo contiene todo lo necesario para tomar esa decisión: nada se
aplicó y nada es irreversible.

## 6. pgTAP post-apply — **1 ok / 5 not ok** (la salida roja **es** la evidencia)

```
BEGIN
1..6
not ok 1 - (A) OFF-6-03: anon NO tiene USAGE sobre el esquema net (Q-22 lo hallo en true)
not ok 2 - (B) OFF-6-03: authenticated NO tiene USAGE sobre el esquema net
not ok 3 - (C) OFF-6-03: 0 funciones de net con EXECUTE para anon, sobre un denominador vivo de 12 funciones (cero fuerte, no vacuo)
not ok 4 - (D) OFF-6-03: 0 funciones de net con EXECUTE para authenticated, sobre un denominador vivo de 12 funciones
not ok 5 - (E) OFF-6-03: anon NO puede ejecutar net.http_get ni net.http_post (las dos que el gate verifico) — cadena SSRF cortada en su origen
ok 6 - (F) no-regresion: service_role CONSERVA EXECUTE sobre net.http_post (pg_cron/pg_net siguen operativos)
# Looks like you failed 5 tests of 6
ROLLBACK
```

Los 5 `not ok` prueban que **`OFF-6-03` sigue vivo en PROD**. El `ok 6` prueba que el intento **no
tocó la ingesta**.

## 7. No-regresión operativa (obligatoria tras el intento)

- `cron.job`: **5/5 jobs `active = true`** (`process-ingest-jobs`, `cleanup-net-http`,
  `net-materializar-aristas`, `cruces-materializar`, `actualidad-materializar`).
- `cron.job_run_details` posterior al intento: **8/8 últimas corridas `succeeded`**, ningún fallo por
  privilegio. Nada que reportar.

## 8. Lo que **no** se hizo

Cero `set role`, cero `security definer` envolvente, cero service key para DDL, cero dashboard, cero
`grant supabase_admin to postgres`, cero `alter role`, cero borrado o reubicación de la extensión
(eso es `OFF-6-01`, fuera de esta fase), cero debilitamiento del pre/post-check para «hacer pasar» la
migración, cero reintento con otra identidad. El apply se corrió **una sola vez**.

---

## ⚠️ Consecuencia que esta deuda deja abierta — sin suavizar

**La cadena SSRF sigue abierta.** Con `OFF-6-03` sin cerrar, un cliente `anon` conserva `USAGE` sobre
`net` y `EXECUTE` sobre las **12** funciones, incluidas `http_get`, `http_post`, `http_delete` y
`worker_restart`. El único mitigante vigente es que la familia `lives_ok` de `pgtap` **no nombra sus
argumentos** — un accidente que el gate de la Phase 123 calificó, verbatim, de *«mitigante frágil y no
intencional»*.

⇒ **`OP-1`** (probe REST con anon key: decide si `OFF-6-01` escala a bloqueante) y **`OP-4`** (destino
de `pgtap` y de las suites pgTAP) **SUBEN DE URGENCIA**. No son un pendiente más de la lista: son
**hoy** los dos únicos actos que pueden cerrar o acotar esta superficie. El plan `124-07` debe
emitirlo así, no como línea de backlog.

---

## Pasos para el operador

**Zero-credential-value**: aquí no hay ninguna credencial, key, URL ni valor secreto — sólo el SQL
textual y la identidad requerida.

### Qué hay que ejecutar

Exactamente estas cuatro sentencias, **sin ninguna otra**:

```sql
revoke all     on schema net from anon, authenticated;
revoke usage   on schema net from public;
revoke execute on all functions in schema net from anon, authenticated;
revoke execute on all functions in schema net from public;
```

Las cuatro son necesarias: la segunda y la cuarta cierran el `USAGE`/`EXECUTE` **a `PUBLIC`**
(`=U/supabase_admin` en el `nspacl`, `proacl` NULL en las funciones), que dejaría la puerta abierta a
cualquier rol presente o futuro aunque los dos roles nombrados quedaran revocados.

### Con qué identidad

Como **`supabase_admin`** (propietario del esquema, de la extensión, de las 12 funciones, y otorgante
de todos los grants). En Supabase gestionado, `postgres` no lo es ni es miembro. Dos vías, **en este
orden de preferencia**:

1. **Soporte de Supabase** (vía recomendada): ticket desde el proyecto pidiendo la ejecución de las
   cuatro sentencias como `supabase_admin`. Justificación en una línea: *«el esquema `net` de `pg_net`
   concede `USAGE` a `anon`/`authenticated`/`PUBLIC` y `EXECUTE` sobre sus 12 funciones —incluidas
   `http_post`, `http_delete` y `worker_restart`—; `pg_net` es infraestructura de `pg_cron` y ningún
   rol público lo necesita»*. No requiere entregar ninguna credencial.
2. **SQL editor del dashboard**, sólo si el propietario del proyecto confirma que su sesión corre con
   un rol miembro de `supabase_admin`. Si vuelven a salir los `WARNING 01006` sin efecto, **no
   insistir**: la vía es (1).

Puede ejecutarse junto con la deuda de `OFF-01` (`124-OFF-01-RESULTADO.md`) en el mismo ticket: misma
identidad, mismo motivo.

### Cómo verificar que quedó cerrado

Sin credenciales en el comando (la variable va por nombre):

```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/post-apply/0075_revoke_net_roles_publicos.test.sql
```

Debe pasar de **1 ok / 5 not ok** a **6 ok / 0 not ok**. Ése es el criterio de cierre, y no otro. La
aserción **(F)** debe seguir verde: si se pusiera roja, el revoke habría alcanzado a `service_role` y
habría roto `pg_cron` — eso **no** es el fix.

### Qué NO hacer

- No conceder `supabase_admin` a `postgres` para forzarlo: eleva permanentemente el blast radius de
  todas las migraciones del proyecto.
- No borrar ni reubicar la extensión `pg_net` por cuenta propia: eso es `OFF-6-01`, destino
  `supabase-architect` + checkpoint, y rompería la ingesta si se hace a ciegas.
- No re-aplicar `0075` esperando otro resultado: es determinista mientras el ownership no cambie.
  Cuando la deuda se pague por la vía (1), `0075` queda como el **registro** del fix, y su pre-check
  abortará con *«ya es FALSE»* — que es el fail-closed funcionando como corresponde.
- No quitar `--single-transaction` ni editar `0075` para «capturar la parte aplicable»: no hay parte
  aplicable (las 4 sentencias fueron no-op). Si algún día la hubiera, va en una migración **nueva**
  (`0080`), jamás editando `0075`.
