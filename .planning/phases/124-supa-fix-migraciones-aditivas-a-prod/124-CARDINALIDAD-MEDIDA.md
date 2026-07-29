# 124-06 — Cardinalidad MEDIDA de las 12 RPCs sin `LIMIT` (`OFF-4-03`, tramo de cuerpo)

**Fecha de medición:** 2026-07-29 · **Contra:** PROD, `psql -tA` · **Conteo por REST: CERO**
(el audit lo prohíbe: PostgREST capa a 1.000 filas y mentiría justo en el rango que importa).

Este archivo es la **justificación de cada techo** de `supabase/migrations/0079_limit_explicito_rpcs.sql`.
Ningún número de esa migración se eligió a ojo: cada uno sale de una consulta re-ejecutable escrita aquí.

---

## Regla de adjudicación y su límite declarado

**Criterio:** `techo >= 4 x maximo_medido` **y** `techo >= 1000`.

**Lo que la aserción NO prueba (dicho antes de venderla):** con el techo derivado del máximo medido,
la aserción `medido < techo` **no puede fallar hoy** — es tautológica por construcción. Su valor real
es cazar **deriva futura** (el día que la ingesta acerque los datos al techo) y detectar un techo mal
transcrito entre este archivo y la migración. **Lo que de verdad protege contra el truncamiento es que
el máximo se midió sobre el DOMINIO COMPLETO**, no sobre un "peor caso plausible" elegido a ojo. Por eso
la medición es la tarea; la aserción es el centinela.

**Fundamento del techo generoso** (heredado de `124-05`, verificado vivo también aquí): las 12 están
**cerradas** a `anon`, `authenticated` y `public` (`has_function_privilege` → `f|f|f`), y abiertas solo a
`service_role` (`t`). El único llamador posible es el servidor del propio sitio (Camino A, `0044`). El
techo protege contra un **bug propio**, no contra un atacante externo ⇒ un techo agresivo compraría poca
seguridad a cambio de exactitud real. **Lo que cierra el offender es que el `LIMIT` deje de ser
inexistente, no que el número sea pequeño.**

**Separación LOCKED:** esto es **SEGURIDAD** (DoS). `B-01` (el cap de 1.000 que trunca y distorsiona la
composición de los votos) es **EXACTITUD** y sigue **fuera** de la Phase 124. No se absorbe aquí.

---

## Clasificación FILAS / AGREGADO (determina la forma de la aserción en el pgTAP)

- **FILAS** — la función devuelve un conjunto; el `LIMIT` va en su **consulta terminal**. Aserción:
  conteo devuelto **estrictamente menor** que el techo.
- **AGREGADO** — la función devuelve 1 fila / un `jsonb` compuesto; el `LIMIT` va **dentro de una
  subconsulta**. Un `count(*)` daría **1 pase lo que pase** ⇒ la aserción sería **vacua justo donde el
  `LIMIT` es peligroso**. Aserción: **igualdad del VALOR devuelto** contra la captura pre-apply.

> **Corrección `RULE-1` al enunciado del plan:** el plan anticipaba `comparar_declaraciones` como posible
> clase AGREGADO. El `pg_get_functiondef` **vivo** la desmiente: devuelve
> `TABLE(fecha_presentacion date, etiqueta text, valor text, …)` — un `union all` de 10 ramas con
> `order by 1 desc, 2` terminal, **sin agregación**. Es **FILAS**. Igual para `cruces_de_*`. La única
> función realmente AGREGADO de las 12 es **`tasa_ausencia_comparada`**.

---

## Tabla de medición — 12 filas

| # | función · firma identity | clase | consulta de medición | dominio barrido | máximo medido | techo | margen | justificación |
|---|---|---|---|---|---|---|---|---|
| 1 | `aportes_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **0** | **20000** | n/a | `public.aporte` = **0 filas** (MONEY gated OFF). `4x0` es inaplicable ⇒ techo generoso + re-medición obligatoria post-flip (ver §Deriva) |
| 2 | `bienes_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **610** (`S1120`) | **5000** | 8,2× | `union all` de 6 ramas de declaración; 610 es el declarante más voluminoso del corpus |
| 3 | `comparar_declaraciones(p_id text, fechas date[])` | FILAS | `M-CMP` | 186 × **todas** sus fechas de declaración | **658** (`S1120`) | **5000** | 7,6× | peor caso real = comparar **todas** las declaraciones del sujeto a la vez, no un par |
| 4 | `contratos_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **0** | **20000** | n/a | `public.contrato` = **0 filas** (MONEY gated OFF). Igual que (1) |
| 5 | `cruces_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **13** (`D1075`) | **1000** | 76,9× | acotada por el catálogo de sectores; el piso de 1.000 domina |
| 6 | `cruces_de_proyecto(p_boletin text)` | FILAS | `M-BOL` | **3.683** boletines (unión de `proyecto` ∪ `proyecto_ficha` ∪ `citacion_punto` ∪ `votacion`) | **47** (`14309-04`) | **1000** | 21,3× | 1 fila por parlamentario a-favor × sector; el piso de 1.000 domina |
| 7 | `declaraciones_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **20** (`S1320`) | **1000** | 50,0× | 1 fila por declaración presentada; el piso de 1.000 domina |
| 8 | `lobby_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **338** (`D843`) | **2000** | 5,9× | audiencias × contrapartes (`left join`); crece con la ingesta de lobby |
| 9 | `lobby_en_tramitacion(p_boletin text)` | FILAS | `M-BOL` | **3.683** boletines (100%) | **219** (`17337-07`) | **1000** | 4,6× | `select distinct` de audiencias × semana ISO coincidente |
| 10 | `parlamentarios_publico()` | FILAS | `M-DIR` | sin argumento ⇒ conteo directo | **186** | **1000** | 5,4× | el directorio entero. 1.000 cubre >5 legislaturas de roster |
| 11 | `rebeldias_de_parlamentario(p_id text)` | FILAS | `M-PARL` | 186 parlamentarios (100%) | **1461** (`D1176`) | **6000** | 4,1× | el máximo más alto de las 12; `>= 4 x 1461 = 5844` ⇒ **6000** |
| 12 | `tasa_ausencia_comparada(p_parlamentario_id text)` | **AGREGADO** | `M-COH` | ambas cámaras (100%) | **155** filas de `per_parl` | **1000** | 6,5× | el conjunto grande es la **cohorte** `per_parl`, no el retorno (1 fila) |

---

## Consultas de medición (re-ejecutables, verbatim)

```sql
-- M-PARL — dominio COMPLETO del argumento p_id: los 186 parlamentarios, uno por uno.
select max(c), count(*) from (
  select (select count(*) from public.<F>(p.id)) c from public.parlamentario p) t;
-- resultados 2026-07-29:
--   aportes=0/186  bienes=610/186  contratos=0/186  cruces_de_parlamentario=13/186
--   declaraciones=20/186  lobby_de_parlamentario=338/186  rebeldias=1461/186

-- M-CMP — comparar_declaraciones en su peor caso REAL: todas las fechas del sujeto a la vez.
select max(c), count(*) from (
  select (select count(*) from public.comparar_declaraciones(p.id,
            coalesce((select array_agg(distinct d.fecha_presentacion)
                      from public.declaracion d where d.parlamentario_id = p.id),
                     '{}'::date[]))) c
  from public.parlamentario p) t;                                  -- 658 / 186

-- M-BOL — dominio COMPLETO del argumento p_boletin (3.683 boletines, no una muestra).
select max(c), count(*) from (
  select (select count(*) from public.<F>(b.boletin)) c from (
    select boletin from public.proyecto
    union select boletin from public.proyecto_ficha
    union select boletin from public.citacion_punto
    union select boletin from public.votacion where boletin is not null) b) t;
-- cruces_de_proyecto = 47 / 3683      lobby_en_tramitacion = 219 / 3683

-- M-DIR — parlamentarios_publico no tiene argumento discriminante: el máximo es el conteo directo.
select count(*) from public.parlamentarios_publico();              -- 186

-- M-COH — tasa_ausencia_comparada: cardinalidad de la SUBCONSULTA acotada (`per_parl`),
--          que es 1 fila por parlamentario de la cámara del sujeto con votos confirmados.
select max(k) from (
  select p.camara, count(distinct v.parlamentario_id) k
  from public.voto v join public.parlamentario p on p.id = v.parlamentario_id
  where v.estado_vinculo = 'confirmado' and v.parlamentario_id is not null
  group by p.camara) t;                                            -- 155
```

Tamaños del corpus al momento de medir: `parlamentario=186`, `proyecto=3675`, `declaracion=1065`,
`cruce_senal=781`, `lobby_audiencia=17762`, `voto=549739`, `citacion_punto=336`,
**`aporte=0`**, **`contrato=0`**.

---

## Captura PRE-APPLY de la única función AGREGADO

`tasa_ausencia_comparada` devuelve **1 fila**; un `count(*)` post-apply daría `1` aunque el `LIMIT`
alterara la mediana. La aserción es por **VALOR**, sobre el **dominio completo** (los 186 sujetos):

```sql
select md5(string_agg(fila, '|' order by fila)) from (
  select p.id || '>' || coalesce((
     select r.n_ausencias||','||r.m_votaciones||','||r.tasa_propia||','||
            r.mediana_camara||','||r.k_parlamentarios||','||r.camara
     from public.tasa_ausencia_comparada(p.id) r), 'EMPTY') as fila
  from public.parlamentario p) s;
```

**Valor PRE-APPLY (2026-07-29): `266340984d66b98e7f590dd555dd4cfb`** — abarca los 186 sujetos, no una
muestra. Si el `LIMIT` de `per_parl` recortara la cohorte, la **mediana** cambiaría y este hash
cambiaría. Es la única aserción de las 12 con poder de caza real sobre el modo de fallo `B-01`.

Peor caso legible (**solo conteos, cero PII**): `n=1 · m=3773 · k=155 · cámara=diputados`.

---

## Deriva declarada — lo que `124-07` hereda como pendiente de re-medir

**`aportes_de_parlamentario` y `contratos_de_parlamentario` midieron `0` porque sus tablas están
vacías por el gate MONEY, no porque el dato sea pequeño.** La regla `>= 4x` es **inaplicable** sobre un
máximo de cero: `4 x 0 = 0` no es un techo, y cualquier número sería igual de arbitrario. Se eligió
**20.000** — 20× el piso obligatorio y del orden de magnitud de un historial de órdenes de compra del
Estado en torno a un sujeto durante un período completo.

⇒ **Obligación para el día del flip MONEY:** re-correr `M-PARL` sobre `aporte` y `contrato` ya poblados
y, si el máximo real superara `20000/4 = 5000`, subir el techo con una migración **nueva**. Registrado
como deuda en el SUMMARY de `124-06` para que `124-07` lo transporte al backlog.

Las aserciones (1) y (4) del pgTAP de `0079` son, por esta misma razón, **verdes pero vacías hoy**
(`0 < 20000`): están escritas para que el día que haya datos empiecen a medir de verdad. Se dice aquí
en vez de dejar que alguien las lea como prueba de algo.

---

## PII: cero

Este archivo contiene **conteos**, **identificadores públicos de parlamentario/boletín** (los mismos que
viajan en las URLs del sitio y que el pgTAP de `0078` ya usa) y **nombres de función**. No contiene
ningún RUT, ningún nombre de persona, ningún email, ninguna fila de datos.

Verificable: `grep -iE '[0-9]{7,8}-[0-9kK]'` → 0 líneas (patrón RUT) · búsqueda del carácter arroba
(indicador de email) → 0 líneas. La línea que enuncia el criterio no se auto-cuenta: por eso el
carácter no se transcribe aquí.
