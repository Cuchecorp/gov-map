---
phase: 124-supa-fix-migraciones-aditivas-a-prod
plan: 06
wave: 6
subsystem: supabase-boundary
tags: [supabase, dos, limit, cardinalidad, create-or-replace, eje-4, rule-1, agregado-vs-filas]
requires: ["124-01", "124-02", "124-03", "124-04", "124-05"]
provides:
  - "OFF-4-03 CERRADO POR COMPLETO — las 12 RPCs sin LIMIT tienen techo de filas medido"
  - "supabase/migrations/0079 (aplicada + registrada en ledger)"
  - "124-CARDINALIDAD-MEDIDA.md — maximo real por RPC sobre el dominio completo + techo + margen"
  - "Precedente: clasificacion FILAS/AGREGADO y asercion por clase (igualdad de VALOR donde count(*) seria vacuo)"
  - "Riesgo n1 heredado cerrado por segunda vez: 12 create or replace conservaron statement_timeout=5s"
affects:
  - "124-07: OFF-4-03 pasa de PARCIAL a APLICADO; eje 4 completo (0077 config + 0078 parametro + 0079 cuerpo)"
  - "124-07: deuda NUEVA — re-medir aportes/contratos el dia del flip MONEY (techo 20000 provisional)"
  - "124-07: 4a correccion del audit registrada (clase AGREGADO mal anticipada para comparar_declaraciones)"
  - "B-01 intacto y sin absorber — sigue fuera de la Phase 124"
  - "La numeracion libre siguiente es 0080"
tech-stack:
  added: []
  patterns:
    - "clasificacion FILAS vs AGREGADO para decidir DONDE va el LIMIT y QUE forma tiene su asercion"
    - "asercion por igualdad de VALOR (hash del dominio completo) cuando la funcion devuelve 1 fila"
    - "LIMIT en un CTE que alimenta agregaciones + order by solo para hacer determinista el recorte"
    - "validacion del cuerpo en transaccion revertida contra PROD ANTES de aplicar (ventana de lock 8 s)"
key-files:
  created:
    - .planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-CARDINALIDAD-MEDIDA.md
    - supabase/migrations/0079_limit_explicito_rpcs.sql
    - supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql
  modified: []
decisions:
  - "11 de las 12 son clase FILAS y solo tasa_ausencia_comparada es AGREGADO: el plan anticipaba comparar_declaraciones como AGREGADO y el functiondef vivo lo desmiente (RULE-1)"
  - "Techo 20000 para aportes/contratos: sus tablas tienen 0 filas por el gate MONEY, la regla >=4x es inaplicable sobre cero; queda deuda de re-medicion post-flip"
  - "El LIMIT de tasa_ausencia_comparada va en el CTE per_parl (la cohorte), no al final: al final no acotaria nada porque la funcion ya devuelve 1 fila"
  - "Se anadio `order by parlamentario_id` dentro de per_parl SOLO para que el recorte sea determinista si algun dia se alcanza; no cambia el resultado (per_parl solo alimenta agregaciones)"
metrics:
  duration: "~50 min"
  completed: 2026-07-29
  tasks: 3
  commits: 3
---

# Phase 124 Plan 06: `OFF-4-03` (las 12 sin `LIMIT`) — techo de filas medido — Summary

Migración `0079` **aplicada a PROD con exit 0**: las **12** RPCs que podían barrer una tabla completa
tienen ahora **`LIMIT` explícito de servidor**, con cada techo derivado de una **medición sobre el
dominio completo** y **cero truncamiento** de resultados legítimos. `0077` sigue **20/20** con su
`(19)` en **31/42**: los doce `create or replace` **conservaron** el `set statement_timeout = '5s'`.

**`OFF-4-03` queda CERRADO por completo** (configuración en `0077`, parámetro en `0078`, cuerpo aquí).

## Veredicto por offender (tipado, consumible por `124-07` sin re-interpretar)

| Offender | Veredicto | Evidencia |
|---|---|---|
| `OFF-4-03` — las **12** sin `LIMIT` alguno | **`APLICADO`** | pgTAP `0079` 1-12 (por invocación) |
| `OFF-4-03` — **en su totalidad** (config + parámetro + cuerpo) | **`APLICADO` — cerrado por completo** | `0077` (20/20) + `0078` (11/11) + `0079` (26/26) |
| `OFF-4-04` (`subgrafo_red`) | **`APLICADO`** (cerrado en la wave 5) | pgTAP `0078` re-corrido: **11/11** |
| `B-01` (exactitud) | **INTACTO, no absorbido** | ningún `order by`/`offset`/default tocado |

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | Medición de cardinalidad de las 12 sobre el dominio completo + adjudicación de techos | `587cda2` | `124-CARDINALIDAD-MEDIDA.md`, 12 filas |
| 2 | `0079` — 12 × `create or replace` con `LIMIT` + 24 revokes + pre/post-check | `8345b4c` | **APLICADA** (exit 0) |
| 3 | pgTAP post-apply, aserción **por clase** | `1fc1940` | **26 ok / 0 not ok** |

---

## La medición que fijó cada techo (con su consulta)

Todo por **`psql -tA`**, **cero conteo por REST** (PostgREST capa a 1.000 y mentiría justo en el rango
que importa). El dominio se barrió **completo**: los **186** parlamentarios y los **3.683** boletines,
no una muestra ni un "peor caso plausible".

| función | clase | máximo medido | dominio | techo | margen |
|---|---|---|---|---|---|
| `aportes_de_parlamentario` | FILAS | **0** (*) | 186 (100%) | 20000 | n/a |
| `bienes_de_parlamentario` | FILAS | **610** | 186 (100%) | 5000 | 8,2× |
| `comparar_declaraciones` | FILAS | **658** | 186 × todas sus fechas | 5000 | 7,6× |
| `contratos_de_parlamentario` | FILAS | **0** (*) | 186 (100%) | 20000 | n/a |
| `cruces_de_parlamentario` | FILAS | **13** | 186 (100%) | 1000 | 76,9× |
| `cruces_de_proyecto` | FILAS | **47** | 3.683 boletines (100%) | 1000 | 21,3× |
| `declaraciones_de_parlamentario` | FILAS | **20** | 186 (100%) | 1000 | 50,0× |
| `lobby_de_parlamentario` | FILAS | **338** | 186 (100%) | 2000 | 5,9× |
| `lobby_en_tramitacion` | FILAS | **219** | 3.683 boletines (100%) | 1000 | 4,6× |
| `parlamentarios_publico` | FILAS | **186** | conteo directo | 1000 | 5,4× |
| `rebeldias_de_parlamentario` | FILAS | **1461** | 186 (100%) | 6000 | 4,1× |
| `tasa_ausencia_comparada` | **AGREGADO** | **155** (cohorte `per_parl`) | ambas cámaras | 1000 | 6,5× |

```sql
-- M-PARL — dominio COMPLETO del argumento p_id
select max(c), count(*) from (
  select (select count(*) from public.<F>(p.id)) c from public.parlamentario p) t;

-- M-BOL — dominio COMPLETO del argumento p_boletin (3.683, no una muestra)
select max(c), count(*) from (
  select (select count(*) from public.<F>(b.boletin)) c from (
    select boletin from public.proyecto
    union select boletin from public.proyecto_ficha
    union select boletin from public.citacion_punto
    union select boletin from public.votacion where boletin is not null) b) t;

-- M-COH — cardinalidad de la SUBCONSULTA acotada de tasa_ausencia_comparada
select max(k) from (
  select p.camara, count(distinct v.parlamentario_id) k
  from public.voto v join public.parlamentario p on p.id = v.parlamentario_id
  where v.estado_vinculo='confirmado' and v.parlamentario_id is not null
  group by p.camara) t;                                          -- 155
```

Corpus al medir: `parlamentario=186`, `proyecto=3675`, `declaracion=1065`, `cruce_senal=781`,
`lobby_audiencia=17762`, `voto=549739`, `citacion_punto=336`, **`aporte=0`**, **`contrato=0`**.

**(*) Los dos ceros no son un dato pequeño: son un gate.** `aporte` y `contrato` están **vacías**
porque MONEY está OFF. `4 × 0 = 0` no es un techo ⇒ se eligió **20.000** y queda **deuda explícita**
de re-medir el día del flip. Las aserciones (1) y (4) del pgTAP son, por lo mismo, **verdes pero
vacuas hoy**, y el test lo dice en su propio mensaje en vez de dejar que alguien las lea como prueba.

## La clasificación FILAS / AGREGADO, que es lo que evita fabricar un `B-01` nuevo

- **FILAS (11)** — el `LIMIT` va en la **consulta terminal**. Aserción: peor caso medido **`<`**
  techo, **invocando**.
- **AGREGADO (1: `tasa_ausencia_comparada`)** — devuelve **1 fila**. Un `LIMIT` al final no acotaría
  nada; va **dentro del CTE `per_parl`**, la cohorte que se calcula sobre las **549.739** filas de
  `voto` (justo lo que el audit describe como *"cohorte de una cámara sobre `voto`"*). Y su aserción
  **no puede ser `count(*)`**: daría **1 pase lo que pase** mientras la **mediana publicada** cambia
  en silencio. Se asierta **igualdad del VALOR devuelto** sobre los **186** sujetos contra la captura
  pre-apply.

```
tasa_ausencia_comparada — hash del valor devuelto, dominio completo (186 sujetos)
  PRE-APPLY  : 266340984d66b98e7f590dd555dd4cfb
  POST-APPLY : 266340984d66b98e7f590dd555dd4cfb   ← IDÉNTICO
```

El `order by v.parlamentario_id` añadido dentro de `per_parl` **no cambia el resultado** (ese CTE solo
alimenta agregaciones): existe únicamente para que, el día que el techo se alcance, el recorte sea
**determinista** en vez de arbitrario.

## Evidencia — validación del cuerpo ANTES de aplicar (precedente wave 5)

Los 12 cuerpos se validaron contra PROD **en transacción revertida** antes del apply real:

```
       f       |            pre             |            post            | veredicto
---------------+----------------------------+----------------------------+-----------
 aportes       | 0                          | 0                          | IGUAL
 bienes        | 610                        | 610                        | IGUAL
 comparar      | 658                        | 658                        | IGUAL
 contratos     | 0                          | 0                          | IGUAL
 cruces_parl   | 13                         | 13                         | IGUAL
 cruces_proy   | 47                         | 47                         | IGUAL
 declaraciones | 20                         | 20                         | IGUAL
 lobby_parl    | 338                        | 338                        | IGUAL
 lobby_tram    | 219                        | 219                        | IGUAL
 parl_publico  | 186                        | 186                        | IGUAL
 rebeldias     | 1461                       | 1461                       | IGUAL
 tasa_D1165    | 29,3752,...,155,diputados  | 29,3752,...,155,diputados  | IGUAL
 tasa_D1176    | 82,3481,...,155,diputados  | 82,3481,...,155,diputados  | IGUAL
 tasa_S1120    | 0,733,...,31,senado        | 0,733,...,31,senado        | IGUAL
 tasa_S1320    | 0,559,...,31,senado        | 0,559,...,31,senado        | IGUAL

 DIFERENTES = 0 | COMPARADAS = 15
ROLLBACK
```

**Nota operativa (RULE-1, ver desviación 2):** el primer intento de esta validación incluía el hash de
los 186 sujetos **dentro** de la transacción y superó los 2 min. Eso significaba mantener locks de DDL
sobre 12 funciones vivas de PROD durante minutos — un riesgo de producción que la validación misma
introducía. Se movió el barrido de 186 al pgTAP (**read-only**, sin DDL) y la ventana de lock quedó en
**8 s**.

## Evidencia — el apply

```
NOTICE:  PRE-CHECK 0079 OK: las 12 existen con firma exacta y con statement_timeout=5s de 0077.
DO
CREATE FUNCTION / REVOKE / REVOKE     (× 12 funciones)
NOTICE:  POST-CHECK 0079 OK: 12 funciones con techo de filas; firmas, security definer,
         search_path, statement_timeout=5s y ACL de service_role intactos; cero exec
         anon/authenticated/public.
DO
INSERT 0 1
EXIT=0
```

Ledger: `select count(*) … where version='0079'` → **1**.

El pre-check exige que `0077` esté aplicada (las 12 con `statement_timeout=5s`). El post-check verifica
el **estado resultante** en la misma transacción — firma, no-duplicación por overload, `statement_timeout`
conservado, `security definer` + `search_path` conservados, cero `EXECUTE` para `anon`/`authenticated`/
`public`, y **positivamente** el `EXECUTE` de `service_role`.

## Evidencia — la re-corrida obligatoria del pgTAP de `0077` (riesgo nº1 heredado)

```
1..20
ok 19 - 31 de 42 funciones propias de public con statement_timeout
ok 20 - las identity args ... son identicas a las capturadas PRE-apply
20 ok / 0 not ok
```

**Los doce `create or replace` conservaron el `set statement_timeout = '5s'`.** El `(19)` sigue en
`31/42`: no se perdió ninguno y no se creó ni destruyó ningún objeto. `0078` re-corrido: **11/11**.

## Evidencia — pgTAP `0079` (26 ok / 0 not ok)

```
1..26
ok 1..11  — [FILAS]    peor caso medido < techo, invocando (1 y 4 declaradas VACUAS hoy)
ok 12     — [AGREGADO] tasa_ausencia_comparada: valor IDENTICO al pre-apply sobre los 186
ok 13..24 — contrato:  identity args + tipo de retorno identicos al pre-apply (las 12)
ok 25     — cero funciones propias de public ejecutables por anon
ok 26     — corpus propio sigue en 42 Y service_role CONSERVA EXECUTE sobre las 12 → '42/12'
```

Ninguna función de clase AGREGADO tiene aserción basada en `count(*)`. PII: **cero** — conteos, hashes
y metadatos de firma.

## Diff del `pg_get_functiondef` vivo antes/después

`diff` completo de los 12 cuerpos: **solo líneas de `limit`** (y el `;` que se desplaza al final del
nuevo `limit`). **Ningún `order by` cambió** — alterarlo cambiaría *qué* filas se devuelven bajo el
nuevo techo, no solo cuántas, y eso sería exactitud, fuera de alcance.

| función | única línea añadida |
|---|---|
| `aportes_de_parlamentario` | `limit 20000;` |
| `bienes_de_parlamentario` | `limit 5000;` |
| `comparar_declaraciones` | `limit 5000;` |
| `contratos_de_parlamentario` | `limit 20000;` |
| `cruces_de_parlamentario` | `limit 1000;` |
| `cruces_de_proyecto` | `limit 1000;` |
| `declaraciones_de_parlamentario` | `limit 1000;` |
| `lobby_de_parlamentario` | `limit 2000;` |
| `lobby_en_tramitacion` | `limit 1000;` |
| `parlamentarios_publico` | `limit 1000;` |
| `rebeldias_de_parlamentario` | `limit 6000;` |
| `tasa_ausencia_comparada` | dentro de `per_parl`: `order by v.parlamentario_id` + `limit 1000` |

## Desviaciones (RULE-1)

**1. [Rule 1] `comparar_declaraciones` es clase FILAS, no AGREGADO.**
- **Encontrado en:** Task 1, leyendo el `pg_get_functiondef` **vivo**.
- **Problema:** el plan la anticipaba entre las funciones "que devuelven agregación o `jsonb`" y por
  tanto candidata a aserción por valor. El cuerpo vivo devuelve
  `TABLE(fecha_presentacion, etiqueta, valor, …)` — un `union all` de 10 ramas con `order by 1 desc, 2`
  terminal, **sin agregación alguna**.
- **Acción:** clasificada **FILAS**; su `LIMIT` va en la consulta terminal y su aserción es `<` estricto.
  El reparto real es **11 FILAS / 1 AGREGADO**, no el que el plan sugería. Registrado en
  `124-CARDINALIDAD-MEDIDA.md` y en la cabecera de `0079`.
- **Nota:** la distinción no se perdió — se aplicó donde de verdad hacía falta
  (`tasa_ausencia_comparada`), que es la única de las 12 donde `count(*)` habría sido vacuo.

**2. [Rule 3] La validación pre-apply se acortó para no sostener locks de DDL sobre PROD.**
- **Problema:** la primera versión metía el barrido de los 186 sujetos **dentro** de la transacción de
  validación (>2 min con 12 funciones bajo lock de DDL) — la validación introducía un riesgo de
  producción mayor que el que estaba verificando.
- **Acción:** dentro de la transacción quedan los 11 conteos de peor caso + **4** sujetos de
  `tasa_ausencia_comparada` (dos por cámara; `mediana_camara` es un valor de cámara, así que un cambio
  de la cohorte aparecería igualmente). El barrido de los **186** se hace en el pgTAP, **read-only y
  sin DDL**. Ventana de lock final: **8 s**.

**3. [Rule 1 — informativa] Techo de `aportes`/`contratos` no derivable de la medición.**
- Sus tablas tienen **0 filas** por el gate MONEY. `>= 4x` es inaplicable sobre cero. Se eligió 20.000
  y se registró la deuda de re-medición; ver §Qué hereda `124-07`.

## Correcciones al audit registradas para `124-07` (no bloqueantes)

Ya van **cuatro** transcripciones del audit/plan que no cuadran contra PROD (`Q-15`, la aritmética de
`0077`, `OFF-5-01`/los techos 100-200, y ahora la clase de `comparar_declaraciones`). **Es un patrón:
el audit se lee como hipótesis a verificar, no como hecho.**

| # | Afirmación | Realidad viva |
|---|---|---|
| 4 | `comparar_declaraciones` (y las "agregado-like") son clase AGREGADO | Devuelve un conjunto sin agregación ⇒ **FILAS**. La única AGREGADO de las 12 es `tasa_ausencia_comparada` |

`Q-13bis` **re-corrida verbatim** post-apply: **las 12 pasan a `tiene_limit = t`**. A diferencia de
`0078` (donde `limit least(...)` daba falso negativo), aquí la heurística sí matchea porque los 12
techos son literales numéricos. `corpus_propio = 42` sin cambios.

## Lo que NO se hizo

Cero `drop`, cero `grant`, cero `set role` (verificado anclado a inicio de sentencia), cero cambio de
firma, cero `42P13`, cero cambio de `order by`/`offset`/defaults, cero toque a `B-01`, cero
`supabase db push`, cero deploy, cero flags, cero DML, cero PII, cero instalación de paquetes.
`SUPABASE_DB_URL` no aparece en ningún artefacto ni se ecoó nunca.

## Qué hereda `124-07`

1. **La numeración libre siguiente es `0080`.** `0073` y `0075` siguen **escritas pero NO aplicadas**
   (deuda de operador), fuera de `schema_migrations`.
2. **`OFF-4-03` pasa de PARCIAL a `APLICADO`.** Con `OFF-4-04` ya cerrado en la wave 5, **el eje 4 está
   completo**: `0077` (tiempo) + `0078` (parámetro) + `0079` (cuerpo).
3. **DEUDA NUEVA — re-medir `aportes`/`contratos` el día del flip MONEY.** Sus techos (20.000) son
   **provisionales**: se fijaron sobre tablas vacías. Si tras el flip el máximo real supera 5.000, hay
   que subir el techo con una migración **nueva** (`0080+`), jamás editando `0079`.
4. **El riesgo nº1 sigue vivo para cualquier wave futura** que re-emita cuerpos: repetir
   `set statement_timeout = '5s'` en cada `create or replace` y **re-correr el pgTAP de `0077`**.
   Aquí funcionó por segunda vez: `20/20`, `(19)` en `31/42`.
5. **`B-01` intacto y declarado**, no absorbido: sigue siendo backlog de **exactitud** fuera de la
   Phase 124.
6. **Precedente reutilizable:** clasificar **FILAS vs AGREGADO** antes de escribir la aserción. Donde la
   función devuelve 1 fila, `count(*)` es una aserción **vacua** y hay que comparar **valor** contra una
   captura pre-apply del **dominio completo**.

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit **0** (`set -o pipefail`). ≥1590 ✔
  (a la primera; sin las 3 *flaky* que vio la wave 5).
- `pnpm --filter ./app exec tsc --noEmit` → exit **0**.
- Verificación automatizada Task 2 (`revokes == 24` y sin `drop function`) → **PASS**
  (`revokes=24 · creates=12 · drop_func=0`).
- Guard anclado a inicio de sentencia (`^[[:space:]]*(grant|drop|set[[:space:]]+role)\b`) sobre `0079`
  y sobre su test → **0** matches.
- Los dos archivos SQL **sin BOM** (`od -c` → `- -`).
- `git diff --stat HEAD~3 HEAD` → exactamente los **3** archivos de `files_modified` (+1182, −0).
- `git diff --diff-filter=D HEAD~3 HEAD` → **0** borrados.
- Untracked/modificados preexistentes (`119-REVIEW.md`, `pnpm-workspace.yaml`, `122-VERIFICATION.md`,
  `123-VERIFICATION.md`) **fuera de alcance**, no tocados.

## Self-Check: PASSED

- `.planning/phases/124-supa-fix-migraciones-aditivas-a-prod/124-CARDINALIDAD-MEDIDA.md` — FOUND
- `supabase/migrations/0079_limit_explicito_rpcs.sql` — FOUND
- `supabase/tests/post-apply/0079_limit_explicito_rpcs.test.sql` — FOUND
- commit `587cda2` — FOUND
- commit `8345b4c` — FOUND
- commit `1fc1940` — FOUND
- `schema_migrations` version `0079` — FOUND (count = 1)
