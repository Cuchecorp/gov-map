---
phase: 124
plan: 04
wave: 4
subsystem: supabase-boundary
tags: [supabase, dos, statement_timeout, service_role, alter-function, eje-4]
requires: ["124-01", "124-02", "124-03"]
provides:
  - "OFF-4-03 parte de CONFIGURACION CERRADA en PROD — las 17 RPCs tienen statement_timeout=5s"
  - "OFF-4-04 parte de CONFIGURACION CERRADA en PROD — subgrafo_red tiene statement_timeout=5s"
  - "supabase/migrations/0077 (aplicada + registrada en ledger)"
  - "31 de 42 funciones propias de public con techo de tiempo; las 11 restantes enumeradas por nombre y razon"
affects:
  - "124-05: subgrafo_red YA tiene techo de tiempo; 05 aporta la cota de fan-out en el CTE recursivo"
  - "124-06: las 12 sin LIMIT y las 2 con LIMIT-de-parametro YA tienen techo; 06 aporta LIMIT/least() en el cuerpo"
  - "124-07: OFF-4-03 y OFF-4-04 quedan PARCIALES (configuracion cerrada, cuerpo abierto), no cerrados"
  - "La numeracion libre siguiente es 0078"
tech-stack:
  added: []
  patterns:
    - "pre-check fail-closed sobre el CONJUNTO ENUMERADO como lista de regprocedure, nunca sobre el total"
    - "to_regprocedure() (devuelve NULL) en vez de ::regprocedure (lanza) dentro del pre-check, para poder nombrar la funcion ausente"
    - "post-check que asierta el estado resultante + denominador vivo en la misma transaccion"
    - "pgTAP con una asercion NOMBRADA por funcion, no un count agregado"
    - "probe funcional bajo `set role service_role` como control anti-timeout-agresivo"
key-files:
  created:
    - supabase/migrations/0077_statement_timeout_rpcs_no_acotadas.sql
    - supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql
  modified: []
decisions:
  - "Valor 5s replicado del precedente vivo (0064/0066/0067), no inventado"
  - "Probe funcional ampliado de 3 a 5 RPCs (patrimonio, cruces, listado, cohorte-sobre-voto, paginada): las dos mas caras del conjunto — tasa_ausencia_comparada y votos_de_parlamentario — no estaban entre las 3 exigidas y son justo las de mayor riesgo de 57014"
  - "El probe se corrio bajo `set role service_role` y no como postgres: service_role es la ruta que el sitio usa y la unica sin statement_timeout de rol"
metrics:
  duration: "~25 min"
  completed: 2026-07-29
  tasks: 2
  commits: 2
---

# Phase 124 Plan 04: `OFF-4-03` + `OFF-4-04` (configuración) — paso 6 del orden LOCKED — Summary

Migración `0077` **aplicada a PROD con exit 0**: las **18** RPCs de `public` que corrían sin techo de
tiempo por la ruta que el sitio efectivamente usa (`service_role`, sin `statement_timeout` de rol)
pasaron a `statement_timeout = '5s'` por `alter function … set` sobre firma exacta, **sin tocar un
solo cuerpo y sin cambiar una sola firma**. `31/42` funciones propias de `public` llevan ahora techo;
las **11** restantes son las acotadas por construcción, **enumeradas por nombre abajo**.

## Veredicto por offender (tipado, consumible por `124-07` sin re-interpretar)

| Offender | Paso LOCKED | Veredicto | Evidencia |
|---|---|---|---|
| `OFF-4-03` (17 RPCs sin techo) — **parte de configuración** | 6 | **`APLICADO`** | `Q-13bis` re-corrida; pgTAP 1-17 |
| `OFF-4-04` (`subgrafo_red`) — **parte de configuración** | 6 | **`APLICADO`** | `Q-13bis`; pgTAP 18 |
| `OFF-4-03` / `OFF-4-04` — **parte de cuerpo** (`LIMIT` explícito, `least()` sobre parámetro, cota de fan-out) | — | **ABIERTA por diseño** | va en `124-05` (`0078`) y `124-06` (`0079`) |

> **`OFF-4-03` y `OFF-4-04` NO están cerrados** tras esta wave: está cerrada su mitad de
> configuración. `124-07` debe contarlos como **parciales** hasta que 05 y 06 apliquen.

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | `0077` — 18 × `alter function … set statement_timeout = '5s'` + pre/post-check | `2cc4012` | **APLICADO** (exit 0) |
| 2 | pgTAP post-apply (20 asserts) + probe funcional `service_role` | `a0b74c1` | **20 ok / 0 not ok**, cero `57014` |

## La aritmética, verificada contra PROD antes de escribir nada

El plan-checker había corregido el error de encuadre (contar "funciones sin `statement_timeout`" da
**29**, no 18). **`Q-13bis` re-corrida verbatim contra PROD confirma el reparto del plan, exacto:**

| grupo | n | se toca en `0077` |
|---|---|---|
| ya acotadas con `statement_timeout` (`0064`/`0066`/`0067`) | **13** | no |
| acotadas **por construcción** | **11** | no |
| **offenders** (17 de `OFF-4-03` + `subgrafo_red`) | **18** | **sí** |
| **total corpus propio de `public`** | **42** | |

`13 + 18 + 11 = 42`. Medido con el predicado de `Q-13bis` **verbatim** (`prosrc` **o** `proconfig`);
las 13 previas lo llevan todas en `proconfig`, pero el predicado ancho se usó igual para no repetir
el fallo de método.

Las **18** del conjunto coinciden **nombre por nombre** con la enumeración de `OFF-4-03`
(12 sin nada + 3 con techo sin timeout + 2 con `LIMIT` sin techo) y `OFF-4-04`. Ninguna ausente,
ninguna sobrante, ninguna con timeout previo. **Cero discrepancia con el audit en esta wave.**

Las **11 acotadas por construcción** que quedan legítimamente sin techo — listadas para que el
residual no sea mudo (confirmadas por `Q-13bis` post-apply, salida literal):

| función | razón |
|---|---|
| `agregado_por_contraparte_cap()` | constante — devuelve el cap `500` |
| `f_unaccent(text)` | escalar puro, sin acceso a tablas (y ya no exec-`anon` tras `0076`) |
| `resolver_identidad(...)` | admin-write, ruta no pública |
| `resolver_entidad(...)` | admin-write, ruta no pública |
| `entidad_tercero_estado_no_regresa()` | `RETURNS trigger` (1 fila, por PK) |
| `identidad_audit_immutable()` | `RETURNS trigger` |
| `parlamentario_estado_no_regresa()` | `RETURNS trigger` |
| `vinculo_entidad_guarda()` | `RETURNS trigger` |
| `vinculo_entidad_guarda_insert()` | `RETURNS trigger` |
| `vinculo_identidad_guarda()` | `RETURNS trigger` |
| `vinculo_identidad_guarda_insert()` | `RETURNS trigger` |

## Evidencia — el apply

```
NOTICE:  PRE-CHECK 0077 OK: las 18 del conjunto enumerado existen y ninguna tiene
         statement_timeout. Encuadre vivo: 13 con timeout + 18 offenders + 11 acotadas
         por construccion = 42.
DO
ALTER FUNCTION   (× 18)
NOTICE:  POST-CHECK 0077 OK: las 18 con statement_timeout=5s. 31 de 42 funciones propias
         de public con techo; las 11 restantes son las acotadas por construccion.
DO
INSERT 0 1
EXIT=0
```

El pre-check usa `to_regprocedure()` (devuelve `NULL`, no lanza) para poder **nombrar** la función
ausente en el `raise exception` en vez de morir con un `undefined_function` mudo. Asierta tres cosas
sobre el **conjunto**, no sobre el total: (a) las 18 existen, (b) **ninguna** tiene ya
`statement_timeout`, (c) encuadre `13` con timeout y `42` de corpus.

El post-check, en la **misma transacción**, comprueba el **estado resultante** — no la ausencia de
error, que es la lección de la wave 2: `18/18` con `statement_timeout=5s`, total con techo `31`,
corpus todavía `42` (esta migración no crea ni destruye objetos).

Ledger: `select count(*) … where version='0077'` → **1**.

Verificación automatizada del plan (`count = 31` con el predicado `Q-13bis`) → **PASS**.

## Evidencia — pgTAP post-apply (20 ok / 0 not ok)

```
1..20
ok 1  - aportes_de_parlamentario(text) tiene statement_timeout=5s (OFF-4-03)
ok 2  - bienes_de_parlamentario(text) …
ok 3  - comparar_declaraciones(text, date[]) …
ok 4  - contratos_de_parlamentario(text) …
ok 5  - cruces_de_parlamentario(text) …
ok 6  - cruces_de_proyecto(text) …
ok 7  - declaraciones_de_parlamentario(text) …
ok 8  - lobby_de_parlamentario(text) …
ok 9  - lobby_en_tramitacion(text) …
ok 10 - parlamentarios_publico() … (OFF-4-03: barria el directorio entero)
ok 11 - rebeldias_de_parlamentario(text) …
ok 12 - tasa_ausencia_comparada(text) … (OFF-4-03: cohorte completa sobre voto)
ok 13 - agregado_por_contraparte(text) … (cap 500 sin techo de tiempo)
ok 14 - buscar_citaciones(text, integer, text) … (techo 100 sin timeout)
ok 15 - parlamentario_publico(text) … (distinta de parlamentario_publico_v2)
ok 16 - match_proyectos(vector, integer, double precision, text) … (limit match_count)
ok 17 - votos_de_parlamentario(text, integer, integer) … (limit p_limit)
ok 18 - subgrafo_red(...) … (OFF-4-04; la cota de fan-out va en 124-05)
ok 19 - 31 de 42 funciones propias de public con statement_timeout (13 previas + 18 de 0077);
        las 11 restantes son las acotadas por construccion. El fix no creo ni destruyo objetos.
ok 20 - las identity args de match_proyectos/votos_de_parlamentario/subgrafo_red son identicas
        a las capturadas PRE-apply: alter ... set no cambio ninguna firma (cero 42P13, cero drop)
```

Las 18 se asertan **una por una y nombradas** — un único `count = 18` no diría *cuáles*.
La `(19)` lleva el **denominador dentro de la aserción** (`'31/42'` como string único), no como
assert aparte que se pueda leer suelto. La `(20)` compara
`pg_get_function_identity_arguments` contra las cadenas capturadas **antes** del apply por `Q-13bis`,
sobre las 3 firmas no triviales — es la prueba de que `alter … set` no toca la firma.

## Evidencia — probe funcional (el control anti-timeout-agresivo)

Corrido **bajo `set role service_role`**, que es la ruta real del sitio y la única sin
`statement_timeout` de rol. **`5s` no rompe nada**:

```
service_role
bienes_de_parlamentario(D1009)  filas=390
cruces_de_parlamentario(D1009)  filas=12
parlamentarios_publico()        filas=186
tasa_ausencia_comparada(D1009)  filas=1
votos_de_parlamentario(D1009)   filas=20
EXIT=0
```

**Cero `57014` (`query_canceled`).** `parlamentarios_publico()` devolviendo las 186 filas del
directorio completo bien dentro de `5s` es el caso que más importaba: era el ejemplo de barrido
que el audit citó.

## Desviaciones (RULE-1)

**Ninguna sustantiva.** Los conteos vivos (`13 / 11 / 18 / 42`) coinciden **exactamente** con los del
plan corregido, y los 18 nombres coinciden con la enumeración del audit. A diferencia de la wave 3
(donde `Q-15` estaba mal transcrita), aquí `Q-13bis` **se sostiene verbatim contra PROD**.

Una ampliación menor, declarada:

- **El probe funcional se amplió de 3 a 5 RPCs.** El plan pedía "una de patrimonio, una de cruces,
  una de listado". Se añadieron `tasa_ausencia_comparada` (cohorte completa sobre `voto`) y
  `votos_de_parlamentario` (`limit p_limit`) porque son **las dos más caras del conjunto** y las de
  mayor riesgo de `57014` — probar solo las 3 baratas habría dado una falsa tranquilidad. Ampliar la
  cobertura de un control no requiere permiso; reducirla sí.

No se tocó ningún archivo fuera de `files_modified`.

## Lo que NO se hizo

Cero `create`, cero `create or replace`, cero `drop`, cero `grant`, cero `revoke`, cero `set role`
**dentro de la migración**, cero cambio de firma, cero `42P13`, cero re-arma de default privileges,
cero cuerpo de función tocado, cero cota de parámetro añadida (eso es `124-05`/`124-06`), cero
`supabase db push`, cero deploy, cero flags, cero DML, cero PII, cero instalación de paquetes.
El valor de `SUPABASE_DB_URL` no aparece en ningún artefacto. El único `set role` de toda la wave
está en el **probe** (sesión `psql` de solo lectura, fuera de la migración), y es deliberado.

## Qué heredan `124-05`, `124-06` y `124-07`

1. **`subgrafo_red` ya tiene techo de tiempo.** `124-05` NO debe volver a ponérselo: aporta la
   **cota de fan-out** en el CTE recursivo. Si `124-05` re-emite el cuerpo con
   `create or replace`, debe **conservar** el `set statement_timeout = '5s'` en la definición —
   un `create or replace` que omita el `set` **lo borra en silencio**. Ídem `124-06` con las 14 que
   toque.
2. **Ese es el riesgo nº1 de las waves 05/06** y no lo cubre ningún guard: el pgTAP de `0077` corre
   contra el schema aplicado en su momento, no en CI. **`124-05` y `124-06` deben re-correr
   `supabase/tests/post-apply/0077_*.test.sql` DESPUÉS de su propio apply** — si su `create or
   replace` perdió el `set`, la aserción de esa función se pone roja y el `(19)` baja de `31/42`.
   Esto es una obligación heredada, no una sugerencia.
3. **`OFF-4-03` y `OFF-4-04` quedan PARCIALES**, no cerrados. `124-07` los cuenta como
   "configuración `APLICADO` / cuerpo pendiente" hasta que `0078` y `0079` apliquen.
4. **La numeración libre siguiente es `0078`.** `0073` y `0075` siguen escritas pero **NO aplicadas**
   (deuda de operador) y **no** están en `schema_migrations`; `0074`, `0076` y ahora `0077` sí.
5. **Sigue viva la condición dura de la wave 1:** ninguna migración crea un objeto nuevo en `public`
   sin su `revoke` adjunto. `0077` no crea ninguno, así que no aplica aquí — pero `124-05`/`124-06`
   sí re-emiten funciones y **deben llevar su doble-revoke**, o el guard `(A5)` (baseline `[]`
   desde la wave 3) se pondrá rojo.
6. **El valor `5s` es ahora el estándar único del corpus** (31 funciones). Cualquier plan que
   necesite otro valor lo está declarando como decisión de arquitectura, no como ajuste.

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit 0 (`set -o pipefail`). ≥ 1590 ✔
- `pnpm --filter ./app exec tsc --noEmit` → exit **0**.
- `git diff --stat HEAD~2 HEAD` → exactamente los **2** archivos de `files_modified` (+426, −0).
- `git diff --diff-filter=D HEAD~2 HEAD` → **0 borrados**.
- Guard anclado a inicio de sentencia sobre `0077`
  (`^[[:space:]]*(grant|drop|revoke|set[[:space:]]+role|create)\b`) → **0** matches.
- Ambos archivos SQL **sin BOM** (`od -c` → `- -`).
- Untracked/modificados preexistentes (`119-REVIEW.md`, `pnpm-workspace.yaml`) **fuera de alcance**,
  no tocados.

## Self-Check: PASSED

- `supabase/migrations/0077_statement_timeout_rpcs_no_acotadas.sql` — FOUND
- `supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql` — FOUND
- commit `2cc4012` — FOUND
- commit `a0b74c1` — FOUND
- `schema_migrations` version `0077` — FOUND (count = 1)
