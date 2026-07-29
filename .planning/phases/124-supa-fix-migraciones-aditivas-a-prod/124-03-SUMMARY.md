---
phase: 124
plan: 03
wave: 3
subsystem: supabase-boundary
tags: [supabase, acl, execute-to-public, search_path, lockdown-guard, deuda-pagada]
requires: ["124-01", "124-02"]
provides:
  - "OFF-4-01 CERRADO en PROD (veredicto APLICADO) — f_unaccent ya no es alcanzable por POST /rest/v1/rpc/"
  - "OFF-4-02 CERRADO en PROD (veredicto APLICADO) — las 7 fn RETURNS trigger sin EXECUTE TO PUBLIC"
  - "OFF-5-01 CERRADO en PROD (veredicto APLICADO) — corpus de public 100% con search_path fijado"
  - "supabase/migrations/0076 (aplicada + registrada en ledger)"
  - "KNOWN_MISSING_REVOKE_FROM_PUBLIC = [] — deuda del guard PAGADA y escrita"
affects:
  - "124-04..07: la superficie exec-anon de public es 0/42; cualquier regresion futura es net-new"
  - "124-07: OFF-4-01/02/05 y OFF-5-01 salen de la lista de offenders abiertos"
  - "Q-15 del audit queda corregida: el ACL de las 8 NO era solo `=X/postgres`"
tech-stack:
  added: []
  patterns:
    - "pre-check fail-closed que asierta el CONJUNTO de nombres, no solo el conteo"
    - "post-check fail-closed que comprueba el ACL resultante + denominador vivo"
    - "pgTAP con denominador declarado DENTRO de la asercion (no como assert aparte)"
    - "linea base de busqueda capturada PRE-apply y comparada por IGUALDAD post-apply"
key-files:
  created:
    - supabase/migrations/0076_revoke_execute_public_residual.sql
    - supabase/tests/post-apply/0076_revoke_execute_public_residual.test.sql
  modified:
    - app/lib/lockdown-guard.test.ts
decisions:
  - "Asercion (E) del pgTAP corregida por RULE-1: las 8 funciones tienen grant EXPLICITO a service_role, asi que tras el revoke service_role conserva EXECUTE (true, no false). (E) asierta lo que si es verdad y si importa: el grantee PUBLIC (aclexplode grantee=0) desaparecio del ACL"
  - "No se emite ningun grant compensatorio ni ningun revoke extra sobre service_role: el plan lo prohibe y el estado resultante es el correcto (Camino A)"
  - "KNOWN_MISSING_REVOKE_FROM_PUBLIC se vacia CON la historia del pago reescrita en su comentario, no como array vacio mudo"
metrics:
  duration: "~35 min"
  completed: 2026-07-29
  tasks: 3
  commits: 3
---

# Phase 124 Plan 03: `OFF-4-01` + `OFF-4-02` + `OFF-5-01` — pasos 4 y 5 del orden LOCKED — Summary

Migración `0076` **aplicada a PROD con exit 0 y sin un solo `WARNING 01006`**: la superficie
residual de **8 funciones propias de `public` ejecutables por `anon` bajó a 0/42**, `f_unaccent`
quedó con `search_path=""` cerrando la única grieta de un corpus 28/28, y la deuda congelada en
`KNOWN_MISSING_REVOKE_FROM_PUBLIC` **se pagó y quedó escrita**. La búsqueda híbrida es
**byte-idéntica** contra una línea base capturada antes del apply.

## Veredicto por offender (tipado, consumible por `124-07` sin re-interpretar)

| Offender | Paso LOCKED | Veredicto | Evidencia |
|---|---|---|---|
| `OFF-4-01` (`f_unaccent` exec-anon) | 4 | **`APLICADO`** | `Q-15` → 0 filas; pgTAP (C) |
| `OFF-5-01` (`f_unaccent` sin `search_path`) | 4 | **`APLICADO`** | `proconfig = search_path=""`; pgTAP (D) |
| `OFF-4-02` (7 fn `RETURNS trigger`) | 5 | **`APLICADO`** | `Q-12` → 0/42; pgTAP (A)/(B) |
| `OFF-4-05` (guard A5) | — | **deuda PAGADA** | baseline `[]`, suite 1590 verde |

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | `0076` — doble-revoke × 8 + `set search_path` + pre/post-check | `e538bdf` | **APLICADO** (exit 0) |
| 2 | pgTAP post-apply (5 asserts + control funcional `(F)`) | `d809360` | **5 ok / 0 not ok** |
| 3 | Pagar la deuda del guard `(A5)` | `4d4ce57` | baseline `[]`, suite verde |

## Evidencia — el apply

Pre-check (asierta el **conjunto de nombres**, no solo el conteo):

```
NOTICE:  PRE-CHECK 0076 OK: 8 de 42 funciones propias de public son exec-anon, exactamente las de Q-15.
```

18 × `REVOKE` + 1 × `ALTER FUNCTION`, y:

```
NOTICE:  POST-CHECK 0076 OK: 0 de 42 funciones propias de public son exec-anon/authenticated; f_unaccent tiene search_path fijado.
EXIT=0
```

**Cero `WARNING 01006`** — a diferencia de `0075` (wave 2), aquí `postgres` **sí** es el owner de las
8 funciones, así que los `revoke` fueron reales, no no-ops. El post-check fail-closed lo demuestra
comprobando el **ACL resultante**, no que los comandos "no dieran error".

Ledger: `select count(*) … where version='0076'` → **1**.

## Evidencia — queries del audit re-corridas verbatim

`Q-15` (funciones exec-`anon` + su ACL) — **antes → después**:

```
ANTES (8 filas):
entidad_tercero_estado_no_regresa|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
f_unaccent                       |=X/postgres | postgres=X/postgres | service_role=X/postgres|text
identidad_audit_immutable        |=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
parlamentario_estado_no_regresa  |=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_entidad_guarda           |=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_entidad_guarda_insert    |=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_identidad_guarda         |=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_identidad_guarda_insert  |=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger

DESPUES: (0 filas)
```

`Q-12` (exposición real por rol, denominador declarado): **`8/42` → `0/42`** con `exec_anon = t`.

`Q-17` (Splinter 0011, secdef sin `search_path`): sigue en **`(0 filas)`**, cero fuerte sobre 28.

`f_unaccent(text)` — `proconfig | prosecdef | exec_service_role | proacl`:

```
ANTES:   (vacio) | f | t | =X/postgres | postgres=X/postgres | service_role=X/postgres
DESPUES: search_path="" | f | t | postgres=X/postgres | service_role=X/postgres
```

El grantee vacío (`=X` = `EXECUTE TO PUBLIC`) **desapareció**. Eso es exactamente el defecto.

## Evidencia — pgTAP post-apply (5 ok / 0 not ok)

```
1..5
ok 1 - (A) OFF-4-01/02: cero funciones propias de public ejecutables por anon (Q-12/Q-15; eran 8 de 42), con denominador vivo declarado
ok 2 - (B) cero funciones propias de public ejecutables por authenticated
ok 3 - (C) OFF-4-01: public.f_unaccent(text) ya NO es ejecutable por anon via POST /rest/v1/rpc/
ok 4 - (D) OFF-5-01: public.f_unaccent(text) tiene search_path en proconfig (unica grieta del corpus, cerrada)
ok 5 - (E) el otorgamiento a PUBLIC desaparecio del ACL de f_unaccent; el residual queda adjudicado a {postgres owner, service_role}, sin grant compensatorio
NOTICE:  (F) OK: f_unaccent resuelve public.unaccent bajo search_path fijado -> Bioxido de Acido en Nunoa
```

`(F)` es el control funcional fail-loud: construye la cadena con tildes por **codepoint** (`chr(243)`,
`chr(193)`, `chr(209)`, `chr(241)`) para que el resultado no dependa de la codificación del archivo
ni del cliente, y prueba que `set search_path = ''` **no rompió** la resolución de `public.unaccent`
dentro del cuerpo del wrapper.

## Evidencia — línea base de la búsqueda híbrida (igualdad, no `> 0`)

Capturada **antes** del apply y re-corrida **después**, sobre 3 términos fijos, con embedding
determinista (`select embedding from proyecto_embedding order by boletin limit 1`) para que la rama
kNN sea reproducible. Conteo + top-5 `boletin|rank`:

| término | conteo | top-5 (antes = después) |
|---|---|---|
| `salud` | 20 | `10986-24, 17375-11, 17147-11, 17354-37, 16640-24` |
| `educacion` | 20 | `10986-24, 15806-04, 18352-04, 17354-37, 16640-24` |
| `medio ambiente` | 20 | `10986-24, 17472-16, 16665-12, 17354-37, 16640-24` |

`diff` pre/post → **idéntico**. Confirma la premisa corregida por el plan-checker: `f_unaccent` no
participa del pipeline FTS (`0055` corre sobre la configuración `public.es_unaccent`).

## El pago del enganche del guard

Antes de tocar nada se **verificó que el guard mordía**, no se asumió:

```
- [ "0055_busqueda_hibrida.sql: f_unaccent" ]
+ []
   ❯ lib/lockdown-guard.test.ts:1143  → 1 failed
```

El detector `(A5)` dejó de reportar el offender en cuanto `0076` apareció con su
`revoke execute on function public.f_unaccent(text) from public`, y la comparación **por igualdad**
se puso roja. **Eso era el diseño** (exigencia nº4 del gate de la Phase 123).

Pago: `KNOWN_MISSING_REVOKE_FROM_PUBLIC: string[] = []` **con su comentario reescrito**, no borrado —
registra qué era la deuda, quién la pagó (`0076`), con qué evidencia (`Q-12` 8/42 → 0/42; pgTAP 5 ok)
y que *"vacía es el estado CORRECTO, no el estado por defecto: si algún día vuelve a tener entradas,
es deuda nueva y debe llevar su propia historia escrita"*.

`git diff` no-comentario del archivo = **4 líneas**, solo la constante:

```
-const KNOWN_MISSING_REVOKE_FROM_PUBLIC = [
-  "0055_busqueda_hibrida.sql: f_unaccent",
-];
+const KNOWN_MISSING_REVOKE_FROM_PUBLIC: string[] = [];
```

`toEqual` intacto (`:1156`), `arrayContaining` en el bloque `(A5)` = **0**. Detector, `A4`, `A6`,
`A7`, `PII_TABLES`, `PUBLIC_RPC_ALLOWLIST`, `PUBLIC_EXTENSION_ALLOWLIST`: **sin tocar**.

## Desviaciones (RULE-1)

**Una, sustantiva, declarada antes de aplicar: el ACL de las 8 no era el que decía `Q-15`.**

El audit transcribió el ACL de las 8 como `=X/postgres`, y sobre esa lectura el plan construyó la
aserción **(E)**: *"su único otorgamiento era `EXECUTE TO PUBLIC` ⇒ tras el revoke, `service_role` =
**false**"*. La captura del ACL vivo contra PROD **antes** del apply lo refuta: las 8 llevan además un
grant **explícito** a `service_role` (`service_role=X/postgres`, herencia del
`alter default privileges for role postgres in schema public … grant to service_role`), que un
`revoke … from public` **no toca**.

Consecuencia y qué se hizo:

- El **fix no cambió**: los mismos 18 `revoke` + el `alter function`. `anon`/`authenticated` no tenían
  grant explícito, así que el revoke-from-public los deja en cero — que es el objetivo del offender.
- **(E) se reescribió** para asertar lo que sí es verdad y sí importa: que el grantee `PUBLIC`
  (`aclexplode` `grantee = 0`) **desapareció** del ACL, dejando el residual adjudicado a
  `{postgres owner, service_role}`. Asertar `service_role = false` habría dado rojo y habría empujado
  a emitir un `revoke` extra sobre `service_role` que **el plan prohíbe explícitamente** — y que
  habría roto el Camino A (el sitio ejecuta con `service_role`).
- **No** se emitió ningún `grant` compensatorio.
- La corrección queda escrita en la cabecera del pgTAP y en la del `0076`, no ajustada en silencio.
  **`Q-15` del audit queda corregida para las waves 4-7.**

No hubo otras desviaciones. No se tocó ningún archivo fuera de `files_modified`.

## Lo que NO se hizo

Cero `drop`, cero `create or replace`, cero cambio de tipo de retorno, cero `grant`, cero `set role`,
cero `security definer` nuevo, cero `supabase db push`, cero revoke sobre `postgres` o `service_role`,
cero relajación del detector `(A5)`, cero cambio de `toEqual` a subconjunto, cero deploy, cero flags,
cero DML, cero PII. El valor de `SUPABASE_DB_URL` no aparece en ningún artefacto.

## Qué heredan las waves 4-7

1. **Los pasos 4 y 5 del orden LOCKED están CERRADOS, no adjudicados.** Es la primera wave de la fase
   que cierra offenders de verdad en PROD (paso 1 y 3 son deuda de operador; el 2 se cerró en la 2).
2. **`Q-15` del audit está corregida:** el ACL de las funciones de `public` incluye un grant
   **explícito** a `service_role` además del `EXECUTE TO PUBLIC`. Cualquier plan que razone sobre
   "quién queda con EXECUTE tras un revoke-from-public" debe partir de este hecho, no de la
   transcripción abreviada del audit.
3. **La lección de la wave 2 se confirma por contraste:** aquí no hubo `WARNING 01006` porque
   `postgres` **es** el owner. El post-check fail-closed sigue siendo obligatorio en toda migración
   `revoke` de la fase: es lo único que distingue "revoqué" de "no pasó nada".
4. **Sigue viva la condición dura de la wave 1:** ninguna migración crea un objeto nuevo en `public`
   sin su `revoke` adjunto en la misma migración. Ahora además es **mecánicamente exigible**: con la
   baseline en `[]`, el guard `(A5)` se pone rojo ante la primera función de `public` sin revoke.
5. **La numeración libre siguiente es `0077`.** `0073` y `0075` están escritas pero **NO aplicadas**
   (deuda de operador) y **no** están en `schema_migrations`; `0074` y `0076` sí.
6. **Si una wave posterior necesitara `f_unaccent` desde `anon`**: no la re-abra — el consumidor
   correcto es `service_role`, que la conserva.

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit 0 (`set -o pipefail`).
- `pnpm --filter ./app exec tsc --noEmit` → exit **0**.
- `git diff --stat HEAD~3 HEAD` → exactamente los **3** archivos de `files_modified`.
- `git diff --diff-filter=D HEAD~3 HEAD` → **0 borrados**.
- Guard anclado a inicio de sentencia sobre `0076`
  (`^[[:space:]]*(grant|drop|set[[:space:]]+role|create[[:space:]]+or[[:space:]]+replace)\b`) → **0**
  matches.
- Ambos archivos SQL **sin BOM** (`od -c` → `- -`).
- Untracked preexistentes (`122-VERIFICATION.md`, `123-VERIFICATION.md`) **fuera de alcance**, no
  tocados.

## Self-Check: PASSED

- `supabase/migrations/0076_revoke_execute_public_residual.sql` — FOUND
- `supabase/tests/post-apply/0076_revoke_execute_public_residual.test.sql` — FOUND
- `app/lib/lockdown-guard.test.ts` — FOUND (modificado)
- commits `e538bdf`, `d809360`, `4d4ce57` — FOUND
