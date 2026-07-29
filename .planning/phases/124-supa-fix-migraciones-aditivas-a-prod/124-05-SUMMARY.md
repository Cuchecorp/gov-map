---
phase: 124-supa-fix-migraciones-aditivas-a-prod
plan: 05
wave: 5
subsystem: supabase-boundary
tags: [supabase, dos, cota-cardinalidad, create-or-replace, cte-recursivo, eje-4, rule-1]
requires: ["124-01", "124-02", "124-03", "124-04"]
provides:
  - "OFF-4-03 parte de CUERPO CERRADA para las 2 funciones con LIMIT de parametro (techo duro 4000)"
  - "OFF-4-04 CERRADO por completo — cota de fan-out por nivel + statement_timeout de 0077"
  - "supabase/migrations/0078 (aplicada + registrada en ledger)"
  - "Precedente: cota de fan-out en rama recursiva via cross join lateral (Postgres prohibe LIMIT sobre el termino recursivo)"
  - "Correccion adjudicada del audit: techo 4000, no 100/200"
affects:
  - "124-06: las 12 sin LIMIT heredan el criterio >=4x medido y la obligacion de repetir `set statement_timeout` en cada create or replace"
  - "124-07: OFF-4-03 sigue PARCIAL (faltan las 12 de 0079); OFF-4-04 ya es APLICADO"
  - "124-07: 3 correcciones del audit registradas (valores 100/200, OFF-5-01, heuristica tiene_limit de Q-13bis)"
  - "B-01 intacto y sin absorber — sigue fuera de la Phase 124"
  - "La numeracion libre siguiente es 0079"
tech-stack:
  added: []
  patterns:
    - "cota de fan-out por nivel dentro de `cross join lateral (... order by <pk> limit N)` en la rama recursiva"
    - "cota derivada de MEDICION sobre el dominio completo (criterio >=4x el maximo real), escrita con su consulta en la cabecera"
    - "validacion del cuerpo en transaccion revertida contra PROD ANTES de escribir la migracion"
    - "comparacion pre/post POR CONJUNTO (elementos ordenados), no por md5 del texto crudo, cuando el orden de jsonb_agg no es determinista"
    - "post-check que asierta positivamente el EXECUTE de service_role, no solo la ausencia de anon"
key-files:
  created:
    - supabase/migrations/0078_cotas_duras_parametro.sql
    - supabase/tests/post-apply/0078_cotas_duras_parametro.test.sql
  modified: []
decisions:
  - "Techo 4000 (no 100/200 del audit): los valores prescritos estaban por debajo de la demanda viva y habrian roto /buscar y la ficha de parlamentario en silencio"
  - "Criterio >=4x el argumento maximo del llamador vivo, el mismo que el plan exige para subgrafo_red"
  - "NO se anade search_path='' a match_proyectos ni votos_de_parlamentario: sus cuerpos referencian tablas sin calificar y no son SECURITY DEFINER"
  - "Cota de subgrafo_red via cross join lateral: Postgres prohibe ORDER BY/LIMIT sobre el termino recursivo, pero los admite dentro de una lateral"
metrics:
  duration: "~55 min (incl. bloqueo + adjudicacion del operador)"
  completed: 2026-07-29
  tasks: 2
  commits: 2
---

# Phase 124 Plan 05: `OFF-4-03` (cuerpo) + `OFF-4-04` — cotas duras de parámetro — Summary

Migración `0078` **aplicada a PROD con exit 0**: las 3 funciones que dejaban la cardinalidad en
manos del llamador (`match_proyectos`, `votos_de_parlamentario`) o del grafo (`subgrafo_red`)
tienen ahora **techo duro de cardinalidad**, sin cambiar una sola firma y **sin regresión de
producto**. `0077` sigue **20/20** con su `(19)` en `31/42`: los tres `create or replace`
**conservaron** el `set statement_timeout = '5s'` — el riesgo nº1 heredado de la wave 4, cerrado.

## Veredicto por offender (tipado, consumible por `124-07` sin re-interpretar)

| Offender | Veredicto | Evidencia |
|---|---|---|
| `OFF-4-03` — **parte de cuerpo**, las 2 con `LIMIT` de parámetro | **`APLICADO`** | pgTAP `0078` 1-4 (por invocación) |
| `OFF-4-03` — las **12** sin `LIMIT` alguno | **ABIERTA por diseño** | va en `124-06` (`0079`) |
| `OFF-4-04` (`subgrafo_red`) | **`APLICADO` — cerrado por completo** | configuración en `0077`; fan-out en `0078`; pgTAP `0078` 5 |
| `B-01` (exactitud) | **INTACTO, no absorbido** | `order by`, `offset` y default (20) sin cambios; probe de producto byte-idéntico |

> `OFF-4-03` **sigue parcial** tras esta wave (faltan las 12 de `0079`). `OFF-4-04` ya **no** lo está.

## Qué se hizo

| # | Tarea | Commit | Resultado |
|---|---|---|---|
| 1 | `0078` — 3 × `create or replace` con cota + 6 revokes + pre/post-check | `c7c54aa` | **APLICADA** (exit 0) |
| 2 | pgTAP post-apply (11 asserts, cotas probadas **invocando**) | `93a038c` | **11 ok / 0 not ok** |

---

## El bloqueo: los dos valores del audit estaban por debajo de la demanda viva

**Paré antes de aplicar.** Los valores que `OFF-4-03` prescribe textualmente
(`least(coalesce(match_count,20),**100**)` y `least(coalesce(p_limit,20),**200**)`) resultaron
estar **por debajo del argumento que los llamadores del sitio pasan hoy**. Aplicarlos no habría
acotado un abuso: habría roto dos superficies centrales en silencio.

| función | cota prescrita | argumento vivo | efecto de haber aplicado |
|---|---|---|---|
| `match_proyectos` | 100 | hasta **1001** (`app/app/buscar/page.tsx:27,33,89` — `PAGE_SIZE=20`, `MAX_PAGE=50`, `matchCount = PAGE_SIZE*page+1`) | **/buscar roto desde la página 6**: `hayMas` → `false`, resultados 101-1000 desaparecen |
| `votos_de_parlamentario` | 200 | **1000** en dos llamadores (`app/components/votos-por-parlamentario.tsx:1010`, `app/lib/parlamentario-resumen-conteos.ts:280`) | **1000 → 200 filas** para los **186** parlamentarios (todos >200 votos); desincroniza chip "Emitió N votos", desglose y asistencia |

Chocaba de frente con dos cláusulas vinculantes del propio plan: `must_haves.truths` #4 (*"el cap de
1.000 … NO se tocó"* — un techo de 200 **rebaja** el cap efectivo de la superficie y por tanto funde
y **empeora** `B-01`) y el acceptance criterion de Task 2 (*"devuelve el **mismo** número de filas
que antes del apply"* — con 200 falla **por construcción**). El plan era internamente inconsistente
en este punto.

**Adjudicación del operador: techo 4000 para ambas.** Criterio ≥4× el argumento máximo del llamador
vivo (1001 / 1000 → 4004 ≈ 4000), el mismo que el plan ya exige para `subgrafo_red`, y por encima
del máximo real del dato. Se prefirió la holgura sobre el mínimo que preserva (1100/1000) porque sin
holgura cualquier crecimiento del corpus se convertiría en truncamiento silencioso — justo el modo
de fallo que se está cerrando.

**Fundamento del techo generoso** (verificado vivo, escrito en la cabecera de `0078`): las 3
funciones están cerradas a `anon` y `authenticated` (`anon=false authenticated=false public=false
service_role=true`). El único llamador posible es el servidor del propio sitio vía `service_role`
(Camino A, `0044`). El techo protege contra un **bug propio**, no contra un atacante externo; un
techo agresivo compraría poca seguridad a cambio de exactitud real. Lo que cierra el offender es que
el `LIMIT` **deje de ser ilimitado**, no que el número sea pequeño.

## La medición que fijó cada cota (con su consulta)

Todas las cotas se **midieron** contra PROD sobre el **dominio completo**; ninguna se inventó.

**Demanda de cardinalidad (techo 4000):**

```sql
select count(*) as parlamentarios, max(c) as max_votos,
       count(*) filter (where c > 4000) as sobre_4000
from (select parlamentario_id, count(*) c from public.voto
      where estado_vinculo='confirmado' group by 1) t;
-- parlamentarios=186  max_votos=3773  p99=3752  avg=1524  sobre_200=186  sobre_1000=71  sobre_4000=0
select count(*) from public.proyecto_embedding;   -- 3100 (corpus embebido completo)
```

`sobre_4000 = 0` es la prueba de que 4000 **no trunca a nadie hoy**.

**Fan-out de `subgrafo_red` (dominio completo: 136 semillas × profundidades 1 y 2):**

```sql
-- grado (fan-out) por nodo
select max(g) from (select nodo, count(*) g from
  (select extremo_a nodo from public.arista union all select extremo_b from public.arista) x
  group by nodo) t;                                              -- grado_max = 391
-- tamano del jsonb devuelto
select max(jsonb_array_length(public.subgrafo_red(e.id,2)->'nodos')),
       max(jsonb_array_length(public.subgrafo_red(e.id,2)->'aristas'))
from public.entidad e;                                           -- 134 nodos / 7394 aristas
```

Corpus: `aristas_total=7394`, `entidades_total=136`, `max_bytes=2.471.525`, semilla de fan-out
máximo `D1009` (grado 391).

| cota | máximo medido | criterio ≥4× | valor elegido |
|---|---|---|---|
| fan-out **por nodo** (rama recursiva) | 391 | 1564 | **2000** |
| **nodos** materializados | 134 | 536 | **1000** |
| **aristas** materializadas | 7394 | 29576 | **40000** |

## Evidencia — el apply

```
NOTICE:  PRE-CHECK 0078 OK: las 3 existen con firma exacta y con statement_timeout=5s de 0077.
DO
CREATE FUNCTION / REVOKE / REVOKE     (× 3 funciones)
NOTICE:  POST-CHECK 0078 OK: 3 funciones con cota dura de cardinalidad; firmas, security definer,
         search_path, statement_timeout=5s y ACL de service_role intactos; cero exec
         anon/authenticated/public.
DO
INSERT 0 1
EXIT=0
```

El pre-check exige que `0077` esté aplicada (las 3 con `statement_timeout=5s`): sin él, este
`create or replace` reintroduciría el timeout "por casualidad" y se perdería la trazabilidad del
paso previo. El post-check verifica el **estado resultante** en la misma transacción — firma, no
duplicación por overload, `statement_timeout` conservado, `security definer` + `search_path` de
`subgrafo_red`, ausencia de secdef en las otras dos, cero `EXECUTE` para `anon`/`authenticated`/
`public`, y **positivamente** el `EXECUTE` de `service_role`.

Ledger: `select count(*) … where version='0078'` → **1**.

## Evidencia — el cuerpo validado ANTES de escribir la migración

El cuerpo de `subgrafo_red` se validó contra PROD **en transacción revertida** antes de escribir
nada. Comparación **por conjunto** sobre las **272** combinaciones (136 semillas × profundidades
1 y 2):

```
PRE  max_nodos=134 max_aristas=7394 filas=272
COMPARADAS=272 | iguales_nodos=272 | iguales_aristas=272 | DIFERENTES=0
ROLLBACK
```

**La cota no recorta el grafo real en ninguna semilla, a ninguna profundidad.**

Detalle técnico que vale como precedente: Postgres **prohíbe** `ORDER BY`/`LIMIT` sobre el término
recursivo de un CTE, así que la cota de fan-out **por nivel** no puede escribirse como un `limit` en
la rama recursiva. Sí los admite **dentro de una `cross join lateral`**, y la referencia recursiva
sigue en el nivel superior (`from walk w`), que es lo que la restricción exige. Es la única forma de
acotar el fan-out por nodo sin cambiar la semántica.

## Evidencia — pgTAP `0078` (11 ok / 0 not ok)

```
1..11
ok 1  - match_proyectos con match_count=100000 (absurdo) devuelve <= 4000 filas: el LIMIT ya no lo
        elige el llamador (OFF-4-03)
ok 2  - match_proyectos con match_count=null devuelve <= 20 (coalesce): un LIMIT NULL ya no
        significa "sin limite"
ok 3  - votos_de_parlamentario con p_limit=100000 (absurdo) devuelve <= 4000 filas (OFF-4-03)
ok 4  - votos_de_parlamentario con p_limit=null devuelve <= 20 (coalesce)
ok 5  - subgrafo_red(D1009,2): nodos <= 1000 y aristas <= 40000 (la cota opera) Y el conjunto es
        IDENTICO al capturado pre-apply (la cota NO recorto el grafo real) — OFF-4-04
ok 6  - match_proyectos conserva firma identity y tipo de retorno identicos al pre-apply
ok 7  - votos_de_parlamentario conserva firma identity y tipo de retorno identicos al pre-apply
ok 8  - subgrafo_red conserva firma identity y tipo de retorno identicos al pre-apply
ok 9  - ninguna de las 3 es ejecutable por anon: el create or replace no re-abrio EXECUTE por
        default ACL
ok 10 - ninguna de las 3 es ejecutable por authenticated
ok 11 - service_role CONSERVA EXECUTE sobre las 3 (Camino A)
```

Las (1)-(5) prueban la cota **invocando**, no leyendo `prosrc`. PII: **cero** — solo conteos y
metadatos de firma.

## Evidencia — la re-corrida obligatoria del pgTAP de `0077` (riesgo nº1 heredado)

```
1..20
ok 16 - match_proyectos(...) tiene statement_timeout=5s
ok 17 - votos_de_parlamentario(...) tiene statement_timeout=5s
ok 18 - subgrafo_red(...) tiene statement_timeout=5s
ok 19 - 31 de 42 funciones propias de public con statement_timeout
ok 20 - las identity args ... son identicas a las capturadas PRE-apply
20 ok / 0 not ok
```

**Los tres `create or replace` conservaron el `set statement_timeout = '5s'`.** El `(19)` sigue en
`31/42`: no se perdió ninguno y no se creó ni destruyó ningún objeto.

## Evidencia — probe de no-regresión de producto (bajo `set role service_role`)

Con los argumentos que el sitio pasa **hoy**, el resultado es **idéntico** al pre-apply:

```
rol=service_role
votos D1165(1000)=1000            [PRE=1000]
votos D1009(1000)=1000            [PRE=1000]
votos D1165(default)=20           [PRE=20]
match_proyectos(1001)=1001        [PRE=1001]
match_proyectos(21)=21            [PRE=21]
match_proyectos(5 similares)=5    [PRE=5]
-- la cota opera en el extremo:
votos D1165(100000)=3752          [<=4000; PRE=3752 sin techo]
subgrafo_red D1009 d2 bytes=2471525  [identico al PRE]
```

**Cero regresión de producto.** Es el criterio que el techo 4000 vino a satisfacer y que 200 habría
violado.

## Diff del `pg_get_functiondef` vivo antes/después

Solo las líneas de cota, como exige el acceptance criterion:

| función | única línea cambiada |
|---|---|
| `match_proyectos` | `limit match_count;` → `limit least(coalesce(match_count, 20), 4000);` |
| `votos_de_parlamentario` | `limit p_limit offset p_offset;` → `limit least(coalesce(p_limit, 20), 4000) offset p_offset;` |
| `subgrafo_red` | rama recursiva → `cross join lateral (… order by a.id limit 2000)`; `nodos` → `order by node_id limit 1000`; `aristas` → `order by a.id limit 40000` |

En `votos_de_parlamentario` el `order by vo.fecha desc nulls last`, el `offset` y el default `20`
quedan **sin tocar**: eso es `B-01`.

## Desviaciones (RULE-1)

**1. [Rule 4 → adjudicación del operador] Techo 4000 en vez de 100/200.**
- **Encontrado en:** Task 1, antes de aplicar.
- **Problema:** los valores prescritos por el audit estaban por debajo de la demanda viva de los
  llamadores; aplicarlos habría roto `/buscar` y la ficha de parlamentario, violando el
  `must_haves.truths` #4 y el acceptance criterion de Task 2 del propio plan.
- **Acción:** se **paró antes de aplicar** y se escaló. El operador adjudicó **4000** para ambas,
  con el criterio ≥4× ya vigente en el plan.
- **Archivos:** `supabase/migrations/0078_cotas_duras_parametro.sql` (cabecera + 2 líneas de `limit`).
- **Commit:** `c7c54aa`.

**2. [Rule 1] Aserción (5)(b) comparada por CONJUNTO, no por `md5` del texto crudo.**
- **Problema:** el plan pedía *"jsonb **idéntico** al capturado pre-apply"*. El `order by` que hace
  determinista la cota cambia el **orden** de `jsonb_agg`, así que el `md5` del texto crudo
  diferiría aunque el contenido fuese idéntico. Más aún: el orden pre-apply era **no
  determinista** — `D1009` y `D1075` a profundidad 2 producían hashes de texto **distintos** del
  **mismo** conjunto de 134 nodos / 7394 aristas.
- **Acción:** comparar elementos **ordenados** (`string_agg(x::text,'|' order by x::text)`).
  Comparar el texto crudo habría medido el bug de no-determinismo, no el fix.
- **Aprobado por el operador.** Commit `93a038c`.

**3. [Rule 1] NO se añadió `search_path=''` a `match_proyectos` ni a `votos_de_parlamentario`.**
- **Razón:** sus cuerpos referencian `proyecto_embedding`, `voto`, `votacion`, `proyecto` y
  `proyecto_ficha` **sin calificar**; con `search_path=''` se romperían. Ninguna es
  `SECURITY DEFINER`, así que no hay escalada. Escrito en la cabecera de `0078` para que nadie lo
  "arregle" después.

**4. [Rule 1 — informativa] Las 3 fallas de la primera corrida de la suite fueron *flaky*.**
- Timeouts de tests que escanean archivos, bajo la carga de las corridas `psql` concurrentes
  (`environment 530s`). Corrida limpia: **1590/1590, exit 0**. Ningún cambio de código.

## Correcciones al audit registradas para `124-07` (no bloqueantes)

**Tres transcripciones falladas ya (`Q-15`, la aritmética de `0077`, y ahora estas): es un patrón,
no mala suerte.** El audit debe leerse como hipótesis a verificar contra PROD, no como hecho.

| # | Afirmación del audit | Realidad viva |
|---|---|---|
| 1 | `OFF-4-03` prescribe techos **100** y **200** | Ambos **por debajo** de la demanda viva (1001 / 1000). Adjudicado **4000** |
| 2 | `OFF-5-01`: *"`f_unaccent` es la **única** función de `public` sin `search_path`"* | `f_unaccent` **ya lo tiene** (wave previa). Las que quedan son `match_proyectos` y `votos_de_parlamentario` — y **no deben** recibirlo (ver desviación 3). Consulta: corpus propio (`deptype<>'e'`) = 42, `propias_SIN_search_path: match_proyectos, votos_de_parlamentario` |
| 3 | La heurística `tiene_limit` de `Q-13bis` (`limit[[:space:]]+[0-9]`) | **No matchea `limit least(...)`**. Tras `0078`, `match_proyectos` y `votos_de_parlamentario` siguen dando `tiene_limit=false` **siendo su cota correcta**. Es el mismo falso negativo que el audit ya documenta en su "nota de método"; `124-06`/`124-07` **no** deben leerlo como cota ausente. La verdad la da el pgTAP por invocación |

`Q-13bis` re-corrida verbatim post-apply: `corpus_propio=42 | con_timeout=31` — sin cambios, la
migración no creó ni destruyó objetos.

## Lo que NO se hizo

Cero `drop`, cero `grant`, cero `set role` **dentro de la migración**, cero cambio de firma, cero
`42P13`, cero re-arma de default privileges, cero cambio del default de parámetro, cero cambio de
`order by`/`offset`, cero toque a `B-01`, cero `supabase db push`, cero deploy, cero flags, cero
DML, cero PII, cero instalación de paquetes. `SUPABASE_DB_URL` no aparece en ningún artefacto. El
único `set role` de la wave está en el **probe** (sesión `psql` de solo lectura, fuera de la
migración) y es deliberado.

## Qué heredan `124-06` y `124-07`

1. **La numeración libre siguiente es `0079`.** `0073` y `0075` siguen escritas pero **NO aplicadas**
   (deuda de operador) y no están en `schema_migrations`.
2. **El riesgo nº1 sigue vivo para `124-06`:** cada `create or replace` debe **repetir** el
   `set statement_timeout = '5s'` o lo borra en silencio, y **debe re-correr
   `supabase/tests/post-apply/0077_*.test.sql`** tras su apply. Aquí funcionó: `20/20`, `(19)` en
   `31/42`.
3. **Criterio de cota establecido:** medir sobre el dominio completo, elegir **≥4× el máximo real**,
   y escribir la consulta de medición en la cabecera. Y **verificar la demanda del llamador vivo**
   antes de fijar un techo — es lo que evitó romper dos superficies aquí.
4. **`OFF-4-03` sigue PARCIAL** (faltan las 12 sin `LIMIT`, van en `0079`). **`OFF-4-04` está
   CERRADO.**
5. **`B-01` intacto y declarado**, no absorbido: sigue siendo backlog de **exactitud** fuera de la
   Phase 124.
6. **Precedente técnico reutilizable:** cota de fan-out en CTE recursivo vía `cross join lateral`.

## Línea base de regresión

- `pnpm --filter ./app test` → **1590 passed / 107 files**, exit **0** (`set -o pipefail`). ≥1590 ✔
- `pnpm --filter ./app exec tsc --noEmit` → exit **0**.
- Verificación automatizada Task 1 (`revokes == 6` y sin `drop function`) → **PASS**.
- Guard anclado a inicio de sentencia sobre `0078`
  (`^[[:space:]]*(grant|drop|set[[:space:]]+role)\b`) → **0** matches.
- `git diff --stat HEAD~2 HEAD` → exactamente los **2** archivos de `files_modified` (+542, −0).
- `git diff --diff-filter=D HEAD~2 HEAD` → **0** borrados.
- Ambos archivos SQL **sin BOM** (`od -c` → `- -`).
- Untracked/modificados preexistentes (`119-REVIEW.md`, `pnpm-workspace.yaml`, `122-VERIFICATION.md`,
  `123-VERIFICATION.md`) **fuera de alcance**, no tocados.

## Self-Check: PASSED

- `supabase/migrations/0078_cotas_duras_parametro.sql` — FOUND
- `supabase/tests/post-apply/0078_cotas_duras_parametro.test.sql` — FOUND
- commit `c7c54aa` — FOUND
- commit `93a038c` — FOUND
- `schema_migrations` version `0078` — FOUND (count = 1)
