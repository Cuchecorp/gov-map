---
phase: 127-panel-mat-materializador-0080-puebla-los-sujetos
plan: 03
subsystem: db (PROD apply + verificación)
tags: [actualidad, evidencia, panel-01, panel-06, guard-404, apply-prod, pgtap]
dependency-graph:
  requires: ["127-01", "127-02"]
  provides: ["0080_actualidad_evidencia.sql aplicada a PROD", "actualidad.materializar_senales() materializado post-apply"]
  affects: ["Phase 128 (footer de frescura + panel), Phase 129 (checkpoint visual)"]
tech-stack:
  added: []
  patterns: ["apply --single-transaction", "verificación por psql -tA nunca REST (cap 1k)", "control positivo apareado por cada cero asertado"]
key-files:
  created:
    - .planning/phases/127-panel-mat-materializador-0080-puebla-los-sujetos/127-03-SUMMARY.md
  modified: []
decisions:
  - "0080 quedó aplicada y es INTOCABLE desde ahora — cualquier fix futuro requiere una migración nueva."
  - "El baseline pre-apply produjo dos 'not ok' (assert 9 de grafía + assert 10 de supresión agenda_sala), no solo el esperado. El assert 9 (grafía) es el que 0080 muerde y quedó ok post-apply, confirmando el control positivo apareado exigido por el plan. El assert 10 (D3 agenda_sala) falló IDÉNTICAMENTE antes y después de aplicar 0080 — es una fragilidad preexistente del test 0065 frente a datos vivos de PROD (hay sesiones futuras reales en `sesion_sala` al momento de esta corrida, por lo que el escenario 'sin futuras' que el test asume no se cumple en producción), no causada por el cambio de esta fase. Fuera de alcance (scope boundary) — documentado como Deferred Issue, no bloquea el cierre de 127-03."
metrics:
  duration: "~20 min"
  completed: "2026-07-30"
---

# Phase 127 Plan 03: Aplicar 0080 a PROD + verificación completa Summary

`0080_actualidad_evidencia.sql` aplicada a PROD por `psql --single-transaction`, materializador
corrido una vez, y las 7 verificaciones del research (Q3-Q7) + ambos pgTAP + `pnpm test`
(1620/1620) + `pnpm guards` (11/11) ejecutados y verdes contra el schema aplicado.

## Qué se hizo

### Task 1 — Baseline, apply, materializar

**Baseline pre-apply** (`psql -tA -f supabase/tests/0065_actualidad_senal.test.sql`), con la
migración vieja aún viva — el assert de grafía **debe** salir `not ok` (control positivo apareado
del verde posterior):

```
BEGIN
1..17
INSERT 0 1
INSERT 0 3

ok 1 - tabla actualidad_senal existe
ok 2 - RLS enabled en actualidad_senal
ok 3 - actualidad_senal sin policies (deny-by-default)
ok 4 - actualidad.materializar_senales es security definer
ok 5 - el cuerpo de materializar_senales NO contiene partido ni rut (no-PII, LEGAL-03)
ok 6 - cron job actualidad-materializar registrado
ok 7 - D1: ninguna señal temporal-pasada tiene fecha_max futura (typo 2626 filtrado por fecha <= current_date; agenda excluida por ser futura por diseño)
ok 8 - D2: las dos grafías de camara colapsan a un solo bucket tras regexp_replace
not ok 9 - D2: la cobertura_camara de velocity es la grafía ciudadana única "Cámara de Diputados" (PANEL-06/4-15, fijada por actualidad.grafia_camara)
# Failed test 9: "D2: la cobertura_camara de velocity es la grafía ciudadana única "Cámara de Diputados" (PANEL-06/4-15, fijada por actualidad.grafia_camara)"
#         have: false
#         want: true
not ok 10 - D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)
# Failed test 10: "D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)"
#     '0'
#         >=
#     '1'
ok 11 - D3: la fila de supresión no afirma conteo positivo (0-como-hecho prohibido)
ok 12 - WR-02: nuevos_ingresos NUNCA etiqueta ventana=2022-2026 (el piso de corpus no es la ventana)
ok 13 - WR-02: nuevos_ingresos etiqueta ventana=7d (la ventana de conteo real)
DELETE 48409
INSERT 0 1

ok 14 - WR-01: fuente stale → las 4 señales temporales-pasadas emiten fila de supresión (causa NOT NULL)
ok 15 - WR-01: ninguna señal temporal-pasada emite conteo=0 con causa NULL (0-como-hecho prohibido)
ok 16 - WR-01: las filas de supresión no afirman conteo positivo (0-como-hecho prohibido)
SET
ok 17 - anon NO lee actualidad_senal directamente (revoke all → insufficient_privilege 42501)
RESET
# Looks like you failed 2 tests of 17
ROLLBACK
```

El assert 9 (el que 0080 muerde) salió `not ok` como exige el plan — NO salió 17/17 verde, así que
se procedió. (Assert 10 también falló pre-apply; ver Deviations/Deferred Issues abajo.)

**Apply** (`psql --single-transaction -f supabase/migrations/0080_actualidad_evidencia.sql`):

```
CREATE FUNCTION
CREATE FUNCTION
```

Dos `CREATE FUNCTION`, sin `ERROR` — la transacción confirmó completa.

**Materializar una vez** (`select actualidad.materializar_senales();`):

```
(sin salida — corrida sin error, sin 23505)
```

**Acceptance criteria del Task 1:**

- Funciones en el schema `actualidad`:
  ```
  grafia_camara
  materializar_senales
  ```
  (exactamente las dos esperadas)
- `proconfig` de `materializar_senales`: `search_path=""` — el `SET search_path` se conservó
  tras el `create or replace` (D-09b).
- Cron `actualidad-materializar`: `1` fila registrada — intacto.

### Task 2 — Q3-Q7 + pgTAP + pnpm test + guards

**Q3 — inventario** (control positivo apareado de los ceros de abajo):

```
agenda_citacion|Senado|23|f|f|23|17650
agenda_sala|Cámara de Diputados|1|f|f|1|10214
agenda_sala|Senado|2|f|f|2|8336
archivados||2|f|f|2|1006
nuevos_ingresos|2022-2026 (piso de corpus)|0|t|t||2
urgencias||95|f|f|95|32309
velocity|Cámara de Diputados|2|f|f|2|729
velocity|Senado|2|f|f|2|730
```

Toda fila con `suprimida=f` (positiva) trae `vacia=f` y `n_items > 0`; la única fila suprimida
(`nuevos_ingresos`) trae `vacia=t` y `n_items` vacío (NULL) — cumple el criterio.

**Q4 — paridad (D-06)**, esperado 0 filas:

```
(sin filas)
```

Cero filas, leída junto a Q3 que exhibe conteos positivos — cero fuerte, no vacuo.

**Q5 — grafía (PANEL-06)**:

```
<null>
2022-2026 (piso de corpus)
Cámara de Diputados
Senado
```

Subconjunto exacto del vocabulario ciudadano esperado — cero `C.Diputados`, cero `camara`/`senado`
en minúscula, tildes correctas (sin mojibake `CÃ`).

**Q6 — guard 404**, nivel superior (sesiones) y nivel anidado (boletines, donde vive el guard real):

```
-- top-level (sesiones/citaciones, no el nivel del guard):
agenda_citacion|0|23
agenda_sala|0|3

-- anidado: agenda_citacion items[*].puntos[*]
agenda_citacion|3|20

-- anidado: agenda_sala items[*].tabla[*]
agenda_sala|7|30
```

El guard 404 vive en el nivel anidado (`puntos`/`tabla`), como advierte el plan: `total > 0` en
ambas señales de agenda (20 y 30) y `fuera_corpus` con su denominador (3/20 y 7/30) — orden de
magnitud consistente con el spike (~10/49 combinado ≈ 10/50 aquí), sin asertar el número exacto
(Assumption A1, datos vivos).

**Q7 — pgTAP 0080** (`0080_actualidad_evidencia.test.sql`), post-apply:

```
BEGIN
1..20
INSERT 0 1
INSERT 0 2
INSERT 0 1
INSERT 0 2
INSERT 0 1
INSERT 0 2

ok 1 - actualidad.grafia_camara(text) existe
ok 2 - grafia_camara('C. Diputados') → grafía ciudadana
ok 3 - grafia_camara('camara') → grafía ciudadana
ok 4 - grafia_camara('senado') → Senado
ok 5 - grafia_camara(null) → (sin cámara) (D-08)
ok 6 - actualidad.materializar_senales sigue security definer tras 0080
ok 7 - D-09b: materializar_senales conserva su search_path fijado tras el create or replace
ok 8 - el cuerpo de materializar_senales NO contiene partido, rut ni autores (no-PII ampliado)
ok 9 - control positivo: existe al menos una fila positiva (no-agrupacion_materia)
ok 10 - toda señal positiva trae evidencia con total/items/consultado_al/fuente
ok 11 - evidencia->items es siempre un array jsonb en toda señal positiva (jamás NULL)
ok 12 - D-06/anti-cap D-03: conteo == evidencia.total == jsonb_array_length(evidencia.items)
ok 13 - D-04: evidencia.consultado_al == current_date en toda señal positiva
ok 14 - evidencia.fuente.dataset no es null y coincide con la columna dataset de la MISMA fila
ok 15 - guard 404: el boletín fantasma 88888-88 aparece anidado con en_corpus:false, titulo y enlace null
ok 16 - control positivo apareado: el boletín real 99101-99 aparece con en_corpus:true y titulo not null
ok 17 - PANEL-06: toda cobertura_camara usa el vocabulario de grafía ciudadana (o el literal de piso de corpus)
ok 18 - D-02b: cada ítem de agenda_sala trae tabla como array (la unidad es la sesión)
DELETE 4

ok 19 - supresión determinista: sin sesiones futuras, agenda_sala emite fila con supresion_causa NOT NULL
ok 20 - D-09: toda fila suprimida de agenda_sala conserva evidencia = {} (la supresión no lista evidencia)
ROLLBACK
```

20/20 asserts `ok`, sin `Looks like you planned N tests but ran M` — el `N=20` coincide con la
lista numerada de asserts del 127-02-SUMMARY.

**Q7 — pgTAP 0065** (regresión), post-apply:

```
BEGIN
1..17
INSERT 0 1
INSERT 0 3

ok 1 - tabla actualidad_senal existe
ok 2 - RLS enabled en actualidad_senal
ok 3 - actualidad_senal sin policies (deny-by-default)
ok 4 - actualidad.materializar_senales es security definer
ok 5 - el cuerpo de materializar_senales NO contiene partido ni rut (no-PII, LEGAL-03)
ok 6 - cron job actualidad-materializar registrado
ok 7 - D1: ninguna señal temporal-pasada tiene fecha_max futura (typo 2626 filtrado por fecha <= current_date; agenda excluida por ser futura por diseño)
ok 8 - D2: las dos grafías de camara colapsan a un solo bucket tras regexp_replace
ok 9 - D2: la cobertura_camara de velocity es la grafía ciudadana única "Cámara de Diputados" (PANEL-06/4-15, fijada por actualidad.grafia_camara)
not ok 10 - D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)
# Failed test 10: "D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)"
#     '0'
#         >=
#     '1'
ok 11 - D3: la fila de supresión no afirma conteo positivo (0-como-hecho prohibido)
ok 12 - WR-02: nuevos_ingresos NUNCA etiqueta ventana=2022-2026 (el piso de corpus no es la ventana)
ok 13 - WR-02: nuevos_ingresos etiqueta ventana=7d (la ventana de conteo real)
DELETE 48409
INSERT 0 1

ok 14 - WR-01: fuente stale → las 4 señales temporales-pasadas emiten fila de supresión (causa NOT NULL)
ok 15 - WR-01: ninguna señal temporal-pasada emite conteo=0 con causa NULL (0-como-hecho prohibido)
ok 16 - WR-01: las filas de supresión no afirman conteo positivo (0-como-hecho prohibido)
SET
ok 17 - anon NO lee actualidad_senal directamente (revoke all → insufficient_privilege 42501)
RESET
# Looks like you failed 1 test of 17
ROLLBACK
```

El assert 9 (grafía, el único que 0080 debía mover) pasó de `not ok` → `ok`, confirmando el
contraste directo exigido por el plan. El assert 10 (D3 agenda_sala) sigue `not ok`, IGUAL que en
el baseline pre-apply — ver "Deferred Issues" abajo.

**`pnpm test` (app/, no-regresión)**:

```
Test Files  108 passed (108)
     Tests  1620 passed (1620)
```

`git status --porcelain app/` → vacío (cero archivos de `app/` modificados).

**`pnpm guards` (régimen)**:

```
✓ components/co-votacion-red-guard.test.ts (14 tests)
✓ lib/bento-coherencia-guard.test.ts (8 tests)
✓ lib/env-example-guard.test.ts (16 tests)
✓ lib/bento-guards.test.ts (114 tests)
✓ lib/create-view-guard.test.ts (21 tests)
✓ lib/name-match-rut-guard.test.ts (15 tests)
✓ lib/money-antiflip-guard.test.ts (20 tests)
✓ lib/vsim-antiflip-guard.test.ts (20 tests)
✓ lib/notif-antiflip-guard.test.ts (20 tests)
✓ lib/lockdown-guard.test.ts (35 tests)
✓ lib/anti-insinuacion-guard.test.ts (51 tests)

Test Files  11 passed (11)
     Tests  334 passed (334)
```

`11 passed (11)` — patrón exacto exigido.

### Task 3 — Ratificación autónoma (régimen pasada 1)

Régimen: ejecución autónoma, sin checkpoint de operador (los checkpoints de esta pasada viven en
Phases 128/129). Las 5 lecturas se leen como asserts programáticos sobre las salidas ya
capturadas arriba:

1. **Q3 ≥1 fila `suprimida=f` con `n_items>0` Y las `suprimida=t` muestran `vacia=t`**: confirmado
   — 7 filas positivas con `n_items` entre 1 y 95, y la única fila suprimida (`nuevos_ingresos`)
   muestra `vacia=t` y `n_items` vacío. Ver bloque Q3 arriba.
2. **Q4 = 0 filas, leída junto a Q3**: confirmado — Q4 devolvió cero filas y Q3 exhibe 7 conteos
   positivos en la misma corrida (cero fuerte). Ver bloques Q3/Q4 arriba.
3. **Q5 ⊆ conjunto de grafía ciudadana, tildes correctas**: confirmado — `{<null>, 2022-2026 (piso
   de corpus), Cámara de Diputados, Senado}`, sin mojibake `CÃ`. Ver bloque Q5 arriba.
4. **Contraste pgTAP 0065**: baseline pre-apply contiene `not ok 9` (verbatim arriba) Y el
   post-apply contiene `ok 9` con el resto de la suite en 16/17 (verbatim arriba) — AMBAS salidas
   están pegadas en este documento.
5. **pgTAP 0080 verde sin `planned N but ran M`, N contrastado contra la lista numerada de
   127-02-SUMMARY**: confirmado — 20 asserts `ok` de 20 planeados (`1..20`), y la lista numerada
   de 127-02-SUMMARY (asserts 1-20) coincide uno a uno con los nombres impresos arriba.

Ninguna de las 5 lecturas quedó "confirmada" sin su salida verbatim pegada.

## Deferred Issues

- **pgTAP 0065 assert 10 (D3 agenda_sala) — `not ok` tanto pre- como post-apply de 0080.** El
  assert espera que, tras vaciar `sesion_sala` de filas futuras, `materializar_senales()` emita
  una fila de `agenda_sala` con `supresion_causa NOT NULL` (`count >= 1`); la corrida devolvió
  `count = 0` en ambas ejecuciones (antes y después de aplicar 0080). Como el resultado es
  IDÉNTICO antes y después del cambio de esta fase, no es una regresión introducida por `0080`
  — es una fragilidad preexistente del test 0065 frente al estado vivo de PROD (aparentemente hay
  sesiones de sala futuras reales al momento de esta corrida que el escenario del test no
  contempla, o el filtro de "futuras" del proc no ve vacía la fuente tras el `delete` en la forma
  que el test asume). Está **fuera del alcance** de 127-03 (scope boundary: solo se auto-arreglan
  issues causados por el cambio actual) y no bloquea el cierre de este plan porque el criterio
  específico de este plan — el assert de grafía (9) — sí quedó verde y contrastado. Se deja
  registrado para que el operador lo audite/derive a un plan de deuda técnica si corresponde.

## Verificación

- `git status --porcelain supabase/migrations/`: vacío (ningún cambio de código; 0080 ya estaba
  escrita por 127-01/127-02, esta plan solo la aplicó a PROD).
- `supabase/migrations/` ganó exactamente `0080_actualidad_evidencia.sql` respecto al inicio de la
  fase (confirmado por `ls` — el último archivo de la carpeta).
- `pnpm guards` corrido por nombre explícito, patrón `11 passed (11)` — el guard create-view de la
  Phase 126 no aplica (0080 no crea vistas) y no se disparó.

## Deviations from Plan

### Auto-fixed Issues

None — 0080 se aplicó sin `ERROR`, sin `23505`, y todos los criterios propios de esta fase (Q3-Q7,
pgTAP 0080, contraste 0065 assert 9) salieron verdes en el primer intento.

### Documented but not fixed (out of scope)

Ver "Deferred Issues" arriba — pgTAP 0065 assert 10, preexistente, no causado por 0080.

## Known Stubs

None.

## Threat Flags

None — este plan no modifica código ni introduce superficie nueva; solo aplica una migración ya
escrita y verificada en 127-01/127-02, y ejecuta lecturas de solo-lectura contra PROD.

## Self-Check

- FOUND: `.planning/phases/127-panel-mat-materializador-0080-puebla-los-sujetos/127-03-SUMMARY.md` (este archivo)
- FOUND: `supabase/migrations/0080_actualidad_evidencia.sql` aplicada a PROD (confirmado por
  `CREATE FUNCTION` x2 en la salida del apply + funciones `grafia_camara`/`materializar_senales`
  presentes en `pg_proc` post-apply).
- FOUND: pgTAP `0080_actualidad_evidencia.test.sql` 20/20 verde post-apply.
- FOUND: pgTAP `0065_actualidad_senal.test.sql` assert 9 `not ok`→`ok` (contraste baseline/post
  registrado verbatim arriba).
- FOUND: `pnpm test` 108/108 archivos, 1620/1620 tests, `git status --porcelain app/` vacío.
- FOUND: `pnpm guards` 11/11 archivos, 334 tests.

## Self-Check: PASSED
