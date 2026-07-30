---
phase: 127-panel-mat-materializador-0080-puebla-los-sujetos
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - supabase/migrations/0080_actualidad_evidencia.sql
  - supabase/tests/0080_actualidad_evidencia.test.sql
  - supabase/tests/0065_actualidad_senal.test.sql
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: fixed
fixed_at: 2026-07-30
fixed: 12
skipped: 1
fix_migration: supabase/migrations/0081_actualidad_evidencia_fix.sql
fix_applied_to_prod: true
---

# Phase 127: Code Review Report

**Reviewed:** 2026-07-30
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

0080 está APLICADA a PROD e INTOCABLE: los dos BLOCKERs de abajo requieren una migración
**0081** nueva; los WARNINGs de test sí son editables en sitio. La migración cumple lo que su
cabecera promete en el eje que más se auditó (paridad `conteo == total == length(items)`, cero cap
por recencia, supresión con `evidencia='{}'`, `search_path` restatado). Los defectos que encontré
están en los ejes que **ningún assert cubre**: la rama `else` de `grafia_camara` (que puede partir
en dos el conteo de una misma cámara), el filtro `boletin is not null` que **recorta silenciosamente
la lista anidada** de `puntos`/`tabla`, la ausencia de aislamiento frente a corridas solapadas del
proc, y la dependencia de zona horaria de `::date`/`current_date`. El fallo de `0065` assert D3 que
el SUMMARY dejó como "aparentemente" tiene causa exacta y demostrada (ver WR-01).

## Critical Issues

### CR-01: `grafia_camara` puede PARTIR EN DOS el conteo de una misma cámara (defecto clase B-01)

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:67-78` (con efecto en :150, :317, :379)
**Issue:** La whitelist compara `lower(regexp_replace(p_camara,'\s+','','g'))` contra
`('c.diputados','camara','cámara','diputados','camaradediputados')` — la forma **acentuada completa**
`'cámaradediputados'` **NO está en la lista**. Hoy el resultado sale bien por accidente: la rama
`else` devuelve `'Cámara de Diputados'` idéntico a la salida canónica. Pero cualquier variante
decorada o de otra caja que la fuente emita cae al `else` y se convierte en **un bucket propio**:

- `'CÁMARA DE DIPUTADOS'` → `'cámaradediputados'` (no matchea) → `else` → `'CÁMARA DE DIPUTADOS'`
- `'H. Cámara de Diputados'`, `'C. de Diputados'`, `'Cámara de Diputados de Chile'` → idem, cada
  uno su propio bucket.

`velocity` agrupa por esta función ⇒ los eventos se reparten en DOS filas de `actualidad_senal` para
la misma cámara y el panel de la Phase 128 muestra "N trámites en Cámara de Diputados" con N
**menor que la realidad**, con dos filas compitiendo. Ese es exactamente el defecto `B-01` de v12.0
(un número mostrado que no corresponde a la composición real). Agravante secundario: el `else` usa
`regexp_replace(...,'\s+',' ')` **sin `btrim`**, así que `' Senado '` y `'Senado '` producen buckets
distintos entre sí.

Ningún assert cubre la rama `else`: el pgTAP de 0080 (asserts 2-5) sólo prueba 4 entradas que caen
en la whitelist, y el assert de vocabulario (:204-210) es un chequeo del *dato vivo*, no de la
función — pasará hasta el día en que la fuente cambie, y entonces fallará *después* de que el número
ya salió mal al público.

**Fix (migración 0081 nueva — 0080 es intocable):**
```sql
create or replace function actualidad.grafia_camara(p_camara text)
returns text language sql immutable as $$
  with n as (select lower(unaccent_free) as k, btrim(regexp_replace(p_camara,'\s+',' ','g')) as raw
             from (select translate(regexp_replace(coalesce(p_camara,''),'\s+','','g'),
                                    'áéíóúÁÉÍÓÚ','aeiouAEIOU') as unaccent_free) t)
  select case
    when (select raw from n) = '' then '(sin cámara)'
    when (select k from n) ~ 'diputad' then 'Cámara de Diputados'   -- cubre c.diputados, camara(de)diputados, h.camaradediputados…
    when (select k from n) in ('camara') then 'Cámara de Diputados'
    when (select k from n) ~ 'senado'   then 'Senado'
    else (select raw from n)                                        -- nunca descartar, pero SIEMPRE trimmeado
  end;
$$;
```
Y añadir asserts negativos al pgTAP (editable) para las variantes decoradas:
```sql
select is(actualidad.grafia_camara('CÁMARA DE DIPUTADOS'), 'Cámara de Diputados', 'caja alta acentuada colapsa');
select is(actualidad.grafia_camara('H. Cámara de Diputados'), 'Cámara de Diputados', 'prefijo honorífico colapsa');
select is(actualidad.grafia_camara('  Senado  '), 'Senado', 'espacios líder/final no crean bucket nuevo');
```

### CR-02: los sub-selects de `puntos`/`tabla` recortan silenciosamente la lista sin declarar el faltante

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:308-311` y `:370-373`
**Issue:** Ambos sub-selects correlacionados filtran `where cp.boletin is not null` /
`sti.boletin is not null`. `citacion_punto.boletin` y `sesion_tabla_item.boletin` son **nullable por
diseño** (0010_agenda.sql:50, :79) — los puntos de tabla que son materia sin boletín (nombramientos,
cuentas, proyectos que la fuente no boletinó) **desaparecen del jsonb sin dejar rastro**: no hay
`total_puntos`, no hay `omitidos`, no hay flag. La Phase 128 renderizará ese array como "la tabla de
la sesión / el orden del día de la citación" y estará mostrando una lista **incompleta presentada
como completa**.

Esto contradice tres cosas escritas en el propio repo: la cabecera de 0080 (:14-18 "CERO cap … si
algún día hiciera falta cappear … el `total` real declarado aparte"), el guard 404 D-05 (:20-22 "el
ítem se emite SIEMPRE con `en_corpus`; JAMÁS inner join") — el `is not null` **es** un inner join
disfrazado a nivel anidado — y D-02/D-02b del CONTEXT, que especifica `puntos:[{boletin,titulo,en_corpus}]`
sin mención de filtro. El assert de paridad D-06 (:147-153) sólo mide el nivel superior, por eso no
lo detectó; el Q6 del SUMMARY (20 puntos, 30 ítems de tabla) reporta el denominador **ya recortado**.

**Fix (migración 0081):** quitar el filtro y emitir el ítem con `boletin: null` +
`en_corpus: false`, o —si la decisión de producto es no listarlos— declarar el recorte:
```sql
'puntos', (select coalesce(jsonb_agg(...) , '[]'::jsonb) from public.citacion_punto cp
             left join public.proyecto p2 on p2.boletin = cp.boletin
            where cp.citacion_id = c.id),                       -- SIN el is not null
'puntos_total', (select count(*) from public.citacion_punto where citacion_id = c.id)
```
Y añadir al pgTAP un control apareado: sembrar un `citacion_punto` con `boletin = null` y asertar
que aparece en `puntos` (o que `puntos_total` lo declara).

## Warnings

### WR-01: `0065` assert D3 — causa exacta y fix determinista (mismo remedio que 0080)

**File:** `supabase/tests/0065_actualidad_senal.test.sql:118-125`
**Issue:** El SUMMARY 127-03 lo deja como "aparentemente hay sesiones futuras … o el filtro no ve
vacía la fuente". No es ambiguo: el test **nunca borra** `sesion_sala`, siembra cero sesiones y
asume que PROD tampoco tiene ninguna futura. El propio Q3 de 127-03 lo prueba: hay filas positivas
`agenda_sala|Cámara de Diputados|1` y `agenda_sala|Senado|2` ⇒ el `if exists (select 1 from
public.sesion_sala where fecha::date >= current_date)` (0080:344) toma la rama POSITIVA ⇒ jamás se
emite fila con `supresion_causa` ⇒ `count = 0 >= 1` falla. Es determinísticamente rojo mientras
PROD tenga agenda de sala futura, y determinísticamente verde en el fin de semana legislativo —
peor que un rojo estable.

**Fix (test, editable — misma medicina que 0080:226-227):**
```sql
-- ANTES del assert D3: hacer la ausencia GARANTIZADA dentro de la tx (cascadea a
-- sesion_tabla_item y se rollbackea al final).
delete from public.sesion_sala where fecha::date >= current_date;
select actualidad.materializar_senales();
-- recién ahora los dos asserts D3 son deterministas
```
Nota de orden: este `delete` debe ir DESPUÉS de los asserts D1/D2 (que no dependen de sala) y ANTES
del bloque WR-01 que vacía `tramitacion_evento`.

### WR-02: el assert D3 "conteo positivo" pasa vacuamente cuando el assert anterior falla

**File:** `supabase/tests/0065_actualidad_senal.test.sql:127-130`
**Issue:** `sum(conteo)` sobre `agenda_sala` con `supresion_causa is not null` devuelve 0 cuando
**no existe ninguna fila de supresión** (`coalesce(sum,0)`). En la corrida real de 127-03 este
assert salió `ok 11` con cero filas evaluadas — cero vacuo, exactamente el gotcha "cero fuerte vs
cero vacuo" de v12.0, y su verde sirvió para amortiguar la lectura del rojo de arriba. Se arregla
solo con el fix de WR-01 (que garantiza el denominador), pero conviene apearlo explícitamente.
**Fix:** aplicar WR-01 y, además, apear el cero con el control que ya existe (`count(*) >= 1` del
assert anterior) en el mismo bloque, o usar `is((select bool_and(conteo = 0) from … ), true)` que
devuelve NULL≠true cuando no hay filas y por tanto **falla** en vez de pasar vacuamente.

### WR-03: el proc depende de la zona horaria de la sesión — `::date` y `current_date` sin `set timezone`

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:88` (declaración), `:118`, `:283`, `:316`, `:344`, `:378`
**Issue:** El proc fija `search_path = ''` pero **no** fija `timezone`. `citacion.fecha` y
`sesion_sala.fecha` son `timestamptz` con el valor date-only-midnight-UTC (regla LOCKED del
proyecto: "la parte fecha UTC ES el día chileno, jamás convertir tz"). `c.fecha::date` convierte
usando el `TimeZone` de la **sesión que invoca**. Bajo pg_cron (UTC) es correcto; bajo un `psql`
de operador con `PGTZ`/`TimeZone=America/Santiago` —y 127-03 corrió el proc a mano por psql— una
citación de mañana 00:00Z se lee como **hoy**, y el `'fecha'` de cada ítem del jsonb sale con **un
día menos**. La mitigación actual es una nota en prosa (M3, :48-51) que dice "no correr el proc a
mano entre 00:00-04:00 UTC": un control humano donde cabe un `SET`.
**Fix (0081):** `... security definer set search_path = '' set timezone = 'UTC'` — el `SET` por
función es preservado por el propio proc y anula el de la sesión, cerrando el agujero para cron,
psql, y cualquier invocación futura.

### WR-04: `delete` + `insert` sin aislamiento — dos corridas solapadas abortan con `23505`

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:110-113`
**Issue:** El full-rebuild acotado no toma ningún lock explícito. Bajo READ COMMITTED, si la corrida
B empieza mientras A está en vuelo: el `DELETE` de B no ve las filas que A insertó después del
snapshot de B, así que las deja vivas; cuando A commitea y B llega a su `INSERT`, choca contra
`unique (tipo_senal, cobertura_camara, ventana, cluster_id)` (0065:69) → `23505` y **la corrida
entera de B se pierde**. El escenario no es teórico: el cron dispara 4×/día y el régimen de esta
fase incluye materializaciones manuales de operador (127-03 corrió una). No hay pérdida de datos
(la tx aborta), pero sí una materialización silenciosamente fallida.
**Fix (0081):** advisory lock al inicio del proc, antes del `delete`:
```sql
if not pg_try_advisory_xact_lock(hashtext('actualidad.materializar_senales')::bigint) then
  raise notice 'materializar_senales ya está corriendo; se omite esta invocación';
  return;
end if;
```

### WR-05: el guard 404 es estructuralmente inerte en los 4 bloques de tramitación

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:142`, `:185`, `:244`, `:414`
**Issue:** `en_corpus: (p.boletin is not null)` sobre `tramitacion_evento te left join proyecto p`
**no puede ser falso jamás**: `tramitacion_evento.boletin` es `not null references proyecto(boletin)`
(0008_tramitacion.sql:71). Igual `titulo`/`enlace`, que son `not null` en `proyecto`. El Q6 de
127-03 lo confirma (`fuera_corpus = 0` en top-level). No es dato incorrecto, pero es **falsa
tranquilidad documentada**: la cabecera (:20-22) vende el guard 404 como cobertura de "todo bloque
que emita boletines" cuando el único guard con efecto es el anidado (`citacion_punto` /
`sesion_tabla_item`, que sí son nullable y sin FK). Si la Phase 128 usa `en_corpus` como criterio de
"enlazable" confiando en esa cobertura, no está probado en la mitad de las señales.
**Fix:** corregir la prosa en 0081 (o en el SUMMARY de 128) para decir que el guard 404 real vive
sólo en los sub-selects anidados; mantener el left join (es correcto y barato) pero no anunciar una
cobertura que la FK ya garantiza.

### WR-06: el assert de vocabulario de grafía es más estricto que la garantía de la función y no filtra `agrupacion_materia`

**File:** `supabase/tests/0080_actualidad_evidencia.test.sql:204-210`
**Issue:** Dos fragilidades. (a) No filtra `tipo_senal <> 'agrupacion_materia'`, a diferencia de
todos los demás asserts del archivo (:125, :132, :141, :149, :158, :166): si el CLI k-means llegara
a poblar `cobertura_camara`, este test se pone rojo por un tipo que el proc **ni toca**. (b) Asserta
un vocabulario cerrado que la función NO garantiza (la rama `else` de CR-01 deja pasar cualquier
cosa) ⇒ es un canario de datos vivos disfrazado de assert estructural, justo lo que la cabecera del
archivo (:34-35) declara prohibido.
**Fix:** añadir `and tipo_senal <> 'agrupacion_materia'` al `where`, y mover la garantía de
vocabulario a asserts directos sobre `grafia_camara(...)` (los de CR-01), que sí son deterministas.

### WR-07: el pgTAP de 0065 borra 48.409 filas de `tramitacion_evento` en PROD dentro de la tx

**File:** `supabase/tests/0065_actualidad_senal.test.sql:155`
**Issue:** `delete from tramitacion_evento;` (la corrida de 127-03 imprimió `DELETE 48409`). Sí, se
rollbackea. Pero mientras la tx vive, la tabla queda con `RowExclusiveLock` sobre 48k filas: un
upsert del ingestor o del cron de novedades corriendo en paralelo **se bloquea** hasta el rollback,
y cada corrida del test deja ~48k tuplas muertas para el autovacuum. Con el cron a las 11/14/17/20
UTC y tests corridos a mano, la ventana de colisión es real.
**Fix:** acotar el escenario stale sin vaciar la tabla — p. ej. crear el escenario contra una tabla
temporal o filtrar el borrado a los boletines seed y simular la staleness moviendo la ventana; si el
vaciado es inevitable, documentar en la cabecera del test "NO correr en :05-:15 de las horas de
cron" y correrlo contra una base de staging.

## Info

### IN-01: la numeración de asserts en los comentarios de 0080 no coincide con el orden de ejecución

**File:** `supabase/tests/0080_actualidad_evidencia.test.sql:172`, `:188`, `:202`, `:212`, `:229`, `:238`
**Issue:** Los comentarios rotulan `(17)(18)(19)(20)` antes de `(15)(16)`, porque los asserts de
supresión se movieron al final. La salida real de TAP los numera 15-20 en orden de ejecución, así
que el SUMMARY 127-03 (`ok 15 - guard 404`) y el archivo se contradicen al citarse. Fuente de
confusión para el siguiente que lea el fallo.
**Fix:** renumerar los comentarios en orden de ejecución, o eliminar los números y dejar sólo el
nombre del assert.

### IN-02: la columna `enlace` de `actualidad_senal` nunca se puebla

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:129`, `:175`, `:232`, `:286`, `:346`, `:402`
**Issue:** Ningún `INSERT` lista `enlace` (0065:67 la declara nullable). Los enlaces viajan
per-ítem dentro del jsonb, lo cual es correcto, pero la columna queda como campo muerto que la RPC
0066 podría re-emitir siempre NULL.
**Fix:** documentar en 0081 que `enlace` a nivel de fila está deliberadamente vacío (la trazabilidad
es per-ítem), o poblarla con el enlace de portada de la fuente.

### IN-03: orden no determinista en empates dentro de `jsonb_agg`

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:143`, `:186`, `:245`, `:312`, `:374`, `:415`
**Issue:** `order by te.fecha desc` / `order by c.fecha` sobre columnas con muchos empates (las
fechas son date-only) deja el orden de los ítems empatados a merced del plan ⇒ el mismo dato puede
renderizarse en orden distinto entre corridas del cron, y un futuro assert de "primer ítem" sería
flaky.
**Fix:** desempatar con una clave estable, p. ej. `order by te.fecha desc, te.boletin, te.id`.

### IN-04: `grafia_camara` nace con EXECUTE a PUBLIC

**File:** `supabase/migrations/0080_actualidad_evidencia.sql:67`
**Issue:** Documentado y adjudicado (M5, :52-56): riesgo ≈ 0 porque `actualidad` no concede USAGE a
`anon`/`authenticated` y la función es pura. Queda registrado como deuda de higiene, no como hueco:
si algún día se concede USAGE al schema, la función queda expuesta por default.
**Fix:** en la próxima migración que sí toque ACLs (0081+ si corresponde),
`revoke execute on function actualidad.grafia_camara(text) from public;` — no antes, para no violar
la prohibición de cambios de ACL de D-09.

---

## Fixes Applied

**Aplicado:** 2026-07-30 · **12 de 13 findings cerrados, 1 skipped (deliberado)**

`0080` NO se tocó (aplicada e intocable). Todos los fixes de SQL viven en
**`supabase/migrations/0081_actualidad_evidencia_fix.sql`** (aditiva: `create or replace` de las dos
funciones; cero DDL de tabla, cero RPC, cero grant/revoke), APLICADA a PROD en esta misma corrida
por el régimen LOCKED (`psql --single-transaction`, jamás `db push`). Los dos pgTAP sí se editaron
en sitio (son editables; las migraciones `0065`/`0073`/`0075` no se tocaron).

| Finding | Estado | Dónde |
|---|---|---|
| CR-01 grafía parte en dos el conteo | fixed | 0081 + 5 asserts nuevos en pgTAP 0080 |
| CR-02 anidados recortados en silencio | fixed | 0081 + 4 asserts nuevos en pgTAP 0080 |
| WR-01 assert D3 de 0065 no determinista | fixed | pgTAP 0065 |
| WR-02 cero vacuo en D3 | fixed | pgTAP 0065 (`bool_and`) |
| WR-03 proc sin `timezone` fijado | fixed | 0081 |
| WR-04 corridas solapadas → `23505` | fixed | 0081 (advisory lock) |
| WR-05 guard 404 inerte en tramitación | fixed (prosa) | header de 0081 |
| WR-06 assert de vocabulario frágil | fixed | pgTAP 0080 |
| WR-07 delete de 48.409 filas en la tx | fixed | pgTAP 0065 (48.409 → **6**) |
| IN-01 numeración de asserts | fixed | pgTAP 0080 |
| IN-02 columna `enlace` muerta | fixed (documentado) | header de 0081 |
| IN-03 orden no determinista en empates | fixed | 0081 (6 `jsonb_agg`) |
| IN-04 EXECUTE a PUBLIC en `grafia_camara` | **skipped** | ver abajo |

**IN-04 — skipped deliberadamente.** Un `revoke` sería exactamente el cambio de ACL que D-09
prohíbe, y 0081 no toca ACLs por ningún otro motivo. Riesgo ≈ 0 (el schema `actualidad` no concede
USAGE a `anon`/`authenticated` y la función es pura). Queda como deuda de higiene para la primera
migración que sí tenga que tocar ACLs — tal como el propio finding recomienda ("no antes").

**Decisión CR-02 (documentada también en el header de 0081):** se emiten **TODOS** los ítems
anidados, sin filtro. El ítem sin boletín viaja con `boletin`/`titulo`/`enlace` null y
`en_corpus:false` — la misma forma que el ítem fuera-de-corpus, así que 128 no necesita un tercer
caso. Además se añade `puntos_total`/`tabla_total` por citación/sesión. Es lo coherente con D-05
(el `is not null` era un inner join disfrazado), con D-06 (la paridad se mide en el nivel superior:
la unidad es la citación/la sesión, así que emitir más ítems anidados no la altera) y con la
honestidad "N de M" de 128, que necesita el denominador REAL — justo lo que el filtro destruía.

**Decisión WR-04:** advisory lock **bloqueante** (`pg_advisory_xact_lock`), no el `try_ + return`
sugerido: una invocación omitida sería una materialización silenciosamente saltada. El full rebuild
es idempotente ⇒ esperar y reconstruir es el comportamiento honesto.

### Verificación (verbatim de esta corrida)

Aplicación de 0081 a PROD:

```
URL_PRESENTE
CREATE FUNCTION
CREATE FUNCTION
```

`select actualidad.materializar_senales();` → sin error (cero `23505`).

Estado vivo tras re-materializar (`psql -tA | tr -d '\r'`):

```
== V1 grafia unica (tipo|cobertura|conteo|causa) ==
agenda_citacion|Senado|23|-
agenda_sala|Cámara de Diputados|1|-
agenda_sala|Senado|2|-
archivados|<null>|2|-
nuevos_ingresos|2022-2026 (piso de corpus)|0|sin nuevos ingresos fechados en la ventana
urgencias|<null>|95|-
velocity|Cámara de Diputados|2|-
velocity|Senado|2|-
== V2 paridad D-06 (debe ser 0) ==
0
== V3 grafia: buckets fuera del vocabulario (debe ser 0) ==
0
== V4 CR-02 puntos/tabla sin boletin ahora emitidos ==
puntos_sin_boletin=11
tabla_sin_boletin=4
== V5 paridad anidada (debe ser 0|0) ==
0
0
== V6 proconfig del proc ==
search_path="" | TimeZone=UTC
```

**El defecto CR-02 era real y medible: 11 puntos de citación + 4 ítems de tabla que 0080 estaba
ocultando del jsonb** (listas incompletas presentadas como completas). La grafía sigue única (V1:
un solo bucket por cámara; V3 = 0 valores fuera del vocabulario) y la paridad D-06 sigue en 0 filas
divergentes, ahora también en el nivel anidado (V5).

pgTAP `0080` — **31/31** (era `plan(20)`):

```
1..31
ok 6 - CR-01: caja alta acentuada colapsa a la grafía ciudadana (no crea bucket propio)
ok 7 - CR-01: prefijo honorífico colapsa a la grafía ciudadana
ok 8 - CR-01: variante "C. de Diputados" colapsa a la grafía ciudadana
ok 9 - CR-01: espacios líder/final no crean bucket nuevo para Senado
ok 10 - CR-01: la rama else no descarta el valor de fuente, pero lo devuelve trimmeado y sin espacios dobles
ok 13 - WR-03: materializar_senales fija timezone=UTC en su definición (no depende del TimeZone del caller)
ok 14 - WR-04: materializar_senales serializa sus corridas con un advisory lock de transacción
ok 24 - CR-02: el punto SIN boletín se emite (boletin/titulo/enlace null, en_corpus:false), no se recorta
ok 25 - CR-02: en agenda_citacion, puntos_total == jsonb_array_length(puntos) en todo ítem (sin recorte silencioso)
ok 26 - CR-02: el ítem de tabla SIN boletín se emite (boletin/titulo null, en_corpus:false), no se recorta
ok 27 - CR-02: en agenda_sala, tabla_total == jsonb_array_length(tabla) en todo ítem (sin recorte silencioso)
ok 30 - supresión determinista: sin sesiones futuras, agenda_sala emite fila con supresion_causa NOT NULL
ok 31 - D-09: toda fila suprimida de agenda_sala conserva evidencia = {} (la supresión no lista evidencia)
ROLLBACK
```

pgTAP `0065` — **17/17 COMPLETO** (el D3 estaba rojo; ahora es determinista), y el `DELETE` masivo
del escenario stale bajó de **48.409 a 6 filas**:

```
1..17
ok 10 - D3: agenda_sala sin futuras emite fila con supresion_causa (supresión-como-fila, no ausencia)
ok 11 - D3: la fila de supresión no afirma conteo positivo (0-como-hecho prohibido; bool_and mata el cero vacuo)
DELETE 6
ok 14 - WR-01: fuente stale → las 4 señales temporales-pasadas emiten fila de supresión (causa NOT NULL)
ok 17 - anon NO lee actualidad_senal directamente (revoke all → insufficient_privilege 42501)
ROLLBACK
```

Suite de la app (**control**: `app/` no se tocó en esta corrida):

```
 Test Files  108 passed (108)
      Tests  1620 passed (1620)
```

```
$ pnpm guards
 Test Files  11 passed (11)
      Tests  334 passed (334)
```

### Commits

| Commit | Findings |
|---|---|
| `f2a590a` | CR-01, CR-02, WR-03, WR-04, WR-05, IN-02, IN-03 (migración 0081) |
| `8135f0f` | CR-01, CR-02, WR-06, IN-01 (pgTAP 0080: `plan(20)` → `plan(31)`) |
| `1429216` | WR-01, WR-02, WR-07 (pgTAP 0065) |

---

_Reviewed: 2026-07-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-07-30 — Claude (gsd-code-fixer); 0081 aplicada a PROD_
