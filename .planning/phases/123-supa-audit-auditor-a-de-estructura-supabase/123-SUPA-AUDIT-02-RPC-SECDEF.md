---
fase: 123
fragmento: 02-rpc-secdef
estado: borrador
fecha: 2026-07-29
ancla_temporal: "2026-07-29 (select now()::date contra PROD; TimeZone de sesión = UTC; PostgreSQL 17.6)"
ejes: [4, 5]
producido_por: 123-03
consumido_por: [123-05, 123-06]
manifiesto_ssot: .supabase-ops.yaml
---

# 123 — SUPA-AUDIT · Fragmento 02: RPCs públicas (eje 4) y `SECURITY DEFINER` (eje 5)

> Régimen heredado de [`123-SUPA-AUDIT-00-METODO.md`](./123-SUPA-AUDIT-00-METODO.md): SQL verbatim
> read-only contra PROD, cero DDL/DML, cero PII, filtro `pg_depend deptype='e'` **siempre**,
> vocabulario de veredicto LOCKED (`conforme` / `offender` / `limite-declarado`), plantilla de
> offender de 7 columnas (§0.2). **Esta fase no corrige nada** — los fixes son la Phase 124
> (aditivos desde `0073`), el deploy la Phase 125.
>
> **Ninguna RPC fue INVOCADA.** Se inspeccionó el catálogo (`pg_proc`, `pg_class`), nunca se ejecutó
> el cuerpo de una función: invocar una RPC de escritura (`resolver_identidad`, `resolver_entidad`)
> habría sido DML (mitigación de T-123-12).

**Corpus barrido:** las **42** funciones de `public` del §0.3 — el barrido es completo, no un
subconjunto, así que no hay `limite-declarado` por cobertura.

---

## 0. Nota de método pagada en carne propia: `psql` emite CRLF en este host

Antes de cualquier resultado, un gotcha que **invalidó silenciosamente** el primer intento del eje 4b
y que todo fragmento futuro de esta fase debe respetar.

`psql -tA` en este host Windows emite terminadores **`\r\n`**, no `\n`. Un archivo así, comparado con
`comm` contra una lista generada por `node`/`sort` (terminadores `\n`), produce **cero coincidencias**
y por tanto **resultados falsos que parecen legítimos**: cada línea `nombre\r` es distinta de
`nombre`.

Evidencia del diagnóstico:

```bash
head -1 /tmp/todas_fn.txt | od -c | head -3
```

```
0000000   a   c   t   u   a   l   i   d   a   d   _   s   e   n   a   l
0000020   e   s   _   p   a   n   e   l  \r  \n
0000032
```

**Cómo se detectó:** la comparación de control «allowlist vs. TODAS las funciones vivas» devolvió las
**29** entradas de la allowlist como huérfanas — imposible, porque `cruces_de_parlamentario` y
compañía existen y fueron enumeradas por `Q-12` tres pasos antes. Un resultado imposible delató la
contaminación; un resultado meramente *inesperado* no lo habría hecho.

**Regla que hereda el resto de la fase, verbatim:**

> **Toda canalización `psql -tA | sort | comm` DEBE interponer `tr -d '\r'` inmediatamente después de
> `psql`.** `sort -c` **NO** protege contra esto: una lista CRLF está perfectamente ordenada y pasa
> el chequeo. El único control que lo caza es un caso de control con resultado conocido.

Todas las salidas de `comm` de este fragmento se produjeron **con** `tr -d '\r'`. Ver desviación
RULE-1 nº 1 en `123-03-SUMMARY.md`.

---

## Eje 4 — RPCs públicas

### 4a Inventario y acotamiento

#### `Q-12` — toda función de `public` con su exposición real por rol

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid)          as args,
       p.prosecdef                                        as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as exec_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as exec_authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as exec_service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by exec_anon desc, p.proname;
```

Salida real (42 filas, `proname|args|secdef|anon|authenticated|service_role`):

```
entidad_tercero_estado_no_regresa||f|t|t|t
f_unaccent|text|f|t|t|t
identidad_audit_immutable||f|t|t|t
parlamentario_estado_no_regresa||f|t|t|t
vinculo_entidad_guarda||f|t|t|t
vinculo_entidad_guarda_insert||f|t|t|t
vinculo_identidad_guarda||f|t|t|t
vinculo_identidad_guarda_insert||f|t|t|t
actualidad_senales_panel|p_tipo text|t|f|f|t
agregado_por_contraparte|p_id text|t|f|f|t
agregado_por_contraparte_cap||f|f|f|t
aportes_de_parlamentario|p_id text|t|f|f|t
bienes_de_parlamentario|p_id text|t|f|f|t
buscar_citaciones|q text, limite integer, p_camara text|f|f|f|t
buscar_proyectos_hibrido|q text, query_embedding vector, match_count integer|t|f|f|t
co_comisionados_de_parlamentario|p_id text|t|f|f|t
coautores_de_parlamentario|p_id text|t|f|f|t
coincidencia_votos_par|p_a text, p_b text|t|f|f|t
comisiones_de_parlamentario|p_id text|t|f|f|t
comparar_declaraciones|p_id text, fechas date[]|t|f|f|t
contratos_de_parlamentario|p_id text|t|f|f|t
copartidarios_de_parlamentario|p_id text|t|f|f|t
cruces_de_parlamentario|p_id text|t|f|f|t
cruces_de_proyecto|p_boletin text|t|f|f|t
de_la_misma_zona|p_id text|t|f|f|t
declaraciones_de_parlamentario|p_id text|t|f|f|t
lobby_de_parlamentario|p_id text|t|f|f|t
lobby_en_tramitacion|p_boletin text|t|f|f|t
lobby_menciones_de_boletin|p_boletin text|t|f|f|t
match_proyectos|query_embedding vector, match_count integer, match_threshold double precision, exclude_boletin text|f|f|f|t
militancia_historica_compartida|p_id text|t|f|f|t
militancias_de_parlamentario|p_id text|t|f|f|t
parlamentario_publico|p_id text|t|f|f|t
parlamentario_publico_v2|p_id text|t|f|f|t
parlamentarios_publico||t|f|f|t
parlamentarios_publico_v2||t|f|f|t
rebeldias_de_parlamentario|p_id text|t|f|f|t
resolver_entidad|p_caso_id bigint, p_estado text, p_revisor text, p_motivo text, p_resolved_at timestamp with time zone, p_promover boolean, p_vinculo jsonb, p_decision text, p_modelo_version text, p_tipo_entidad text|f|f|f|t
resolver_identidad|p_caso_id bigint, p_estado text, p_revisor text, p_motivo text, p_resolved_at timestamp with time zone, p_promover boolean, p_vinculo jsonb, p_decision text, p_modelo_version text|f|f|f|t
subgrafo_red|p_id text, p_depth integer, p_tipos text[], p_desde timestamp with time zone, p_hasta timestamp with time zone|t|f|f|t
tasa_ausencia_comparada|p_parlamentario_id text|t|f|f|t
votos_de_parlamentario|p_id text, p_limit integer, p_offset integer|f|f|f|t
```

#### Hallazgo rector del eje 4: **ninguna RPC de negocio es ejecutable por `anon`**

Las 34 RPCs de negocio dan `exec_anon = f` **y** `exec_authenticated = f`: solo `service_role`.
El régimen `>0044` (doble-revoke, Camino A) está **efectivamente aplicado en la DB viva**. La
superficie `anon` de la Data API sobre `public` se reduce a **8** funciones, todas residuales.

Esto es **evidencia autoritativa que contradice a la evidencia de contraste**: las migraciones
*declaran* `grant execute … to anon` para al menos 9 de esas RPCs —

```bash
grep -rniE "grant +execute" supabase/migrations/ | grep -i anon
```

```
0011_fichas_embeddings.sql:90:grant execute on function match_proyectos(vector, int, float8, text) to anon;
0019_voto_asistencia_y_ficha.sql:103:grant execute on function votos_de_parlamentario(text, int, int) to anon;
0019_voto_asistencia_y_ficha.sql:104:grant execute on function rebeldias_de_parlamentario(text) to anon;
0020_parlamentario_publico.sql:51:grant execute on function parlamentario_publico(text) to anon;
0021_lobby.sql:125:grant execute on function public.lobby_de_parlamentario(text) to anon;
0022_probidad.sql:302:grant execute on function public.declaraciones_de_parlamentario(text) to anon;
0022_probidad.sql:354:grant execute on function public.comparar_declaraciones(text, date[]) to anon;
0023_dinero.sql:167:grant execute on function public.contratos_de_parlamentario(text) to anon;
0024_servel.sql:199:grant execute on function public.aportes_de_parlamentario(text) to anon;
```

— y la DB viva dice `f` para las nueve, porque `0044`/`0045` revocaron después. **Manda la
autoritativa** (§0.1 contrato 3): la superficie real es la de `Q-12`, no la de los `grant` de los
archivos. Es el mismo gotcha del §0.4 aplicado a grants en vez de a objetos, y tiene consecuencia
directa sobre el diseño del guard (§4b).

#### `Q-13` — acotamiento de cada función expuesta a `anon`

```sql
select p.proname,
       (lower(p.prosrc) ~ 'limit[[:space:]]+[0-9]')          as tiene_limit,
       (lower(p.prosrc) like '%statement_timeout%'
        or array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout%') as tiene_timeout,
       array_to_string(coalesce(p.proconfig,'{}'), ',')      as proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by tiene_limit asc, tiene_timeout asc, p.proname;
```

Salida real (8 filas):

```
entidad_tercero_estado_no_regresa|f|f|search_path=""
f_unaccent|f|f|
identidad_audit_immutable|f|f|search_path=""
parlamentario_estado_no_regresa|f|f|search_path=""
vinculo_entidad_guarda|f|f|search_path=""
vinculo_entidad_guarda_insert|f|f|search_path=""
vinculo_identidad_guarda|f|f|search_path=""
vinculo_identidad_guarda_insert|f|f|search_path=""
```

**`Q-13` tal como el plan la escribió resultó casi vacía de contenido**, porque su filtro es
`exec_anon` y `exec_anon` es prácticamente cero. Auditar solo `anon` habría declarado el eje 4
`conforme` sobre 8 funciones triviales y dejado 34 RPCs sin mirar — precisamente las que el sitio
llama. Por eso se añadió `Q-13bis` (desviación RULE-1 nº 2), que barre las 42 y **es la tabla que
sostiene el veredicto del eje 4**.

#### `Q-13bis` — acotamiento de **las 42** (barrido completo del corpus)

```sql
select p.proname,
       (lower(p.prosrc) ~ 'limit[[:space:]]+[0-9]')          as tiene_limit,
       (lower(p.prosrc) like '%statement_timeout%'
        or array_to_string(coalesce(p.proconfig,'{}'), ',') like '%statement_timeout%') as tiene_timeout,
       (lower(p.prosrc) ~ 'limit[[:space:]]+(p_limit|limite|match_count|[0-9])') as limit_amplio,
       array_to_string(coalesce(p.proconfig,'{}'), ',')      as proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by tiene_timeout asc, tiene_limit asc, p.proname;
```

Salida real (42 filas, `proname|tiene_limit|tiene_timeout|limit_amplio|proconfig`):

```
agregado_por_contraparte|f|f|f|search_path=""
agregado_por_contraparte_cap|f|f|f|search_path=""
aportes_de_parlamentario|f|f|f|search_path=""
bienes_de_parlamentario|f|f|f|search_path=""
comparar_declaraciones|f|f|f|search_path=""
contratos_de_parlamentario|f|f|f|search_path=""
cruces_de_parlamentario|f|f|f|search_path=""
cruces_de_proyecto|f|f|f|search_path=""
declaraciones_de_parlamentario|f|f|f|search_path=""
entidad_tercero_estado_no_regresa|f|f|f|search_path=""
f_unaccent|f|f|f|
identidad_audit_immutable|f|f|f|search_path=""
lobby_de_parlamentario|f|f|f|search_path=""
lobby_en_tramitacion|f|f|f|search_path=""
match_proyectos|f|f|t|
parlamentario_estado_no_regresa|f|f|f|search_path=""
parlamentario_publico|f|f|f|search_path=""
parlamentarios_publico|f|f|f|search_path=""
rebeldias_de_parlamentario|f|f|f|search_path=""
resolver_entidad|f|f|f|search_path=""
resolver_identidad|f|f|f|search_path=""
subgrafo_red|f|f|f|search_path=""
tasa_ausencia_comparada|f|f|f|search_path=""
vinculo_entidad_guarda|f|f|f|search_path=""
vinculo_entidad_guarda_insert|f|f|f|search_path=""
vinculo_identidad_guarda|f|f|f|search_path=""
vinculo_identidad_guarda_insert|f|f|f|search_path=""
votos_de_parlamentario|f|f|t|
buscar_citaciones|t|f|t|search_path=""
coincidencia_votos_par|f|t|f|search_path="",statement_timeout=5s
actualidad_senales_panel|t|t|t|search_path="",statement_timeout=5s
buscar_proyectos_hibrido|t|t|t|search_path="",statement_timeout=5s
co_comisionados_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
coautores_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
comisiones_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
copartidarios_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
de_la_misma_zona|t|t|t|search_path="",statement_timeout=5s
lobby_menciones_de_boletin|t|t|t|search_path="",statement_timeout=5s
militancia_historica_compartida|t|t|t|search_path="",statement_timeout=5s
militancias_de_parlamentario|t|t|t|search_path="",statement_timeout=5s
parlamentario_publico_v2|t|t|t|search_path="",statement_timeout=5s
parlamentarios_publico_v2|t|t|t|search_path="",statement_timeout=5s
```

**Confirma el hallazgo heredado de 123-01:** exactamente **13** funciones llevan
`statement_timeout=5s`; las otras **29** no. `cruces_de_parlamentario` **no** lo lleva, tal como
123-01 corrigió por RULE-1.

#### Nota de método obligatoria: `Q-13` es heurística sobre `prosrc`

`tiene_limit` es un regex sobre el cuerpo (`limit <dígito>`). **No matchea** `fetch first N rows only`
ni `limit p_limit` / `limit match_count` / `limit greatest(…)`. Por eso **ninguna** fila
`tiene_limit = false` se declaró offender sin leer antes `pg_get_functiondef(p.oid)`. La revisión
manual se ejecutó con:

```sql
select p.proname,
       p.prorettype::regtype::text as rettype,
       p.proretset as devuelve_conjunto,
       (lower(pg_get_functiondef(p.oid)) like '%limit%') as menciona_limit,
       coalesce(substring(regexp_replace(lower(pg_get_functiondef(p.oid)),'\s+',' ','g')
                from 'limit [^;]{0,60}'),'(sin limit)') as clausula
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not (lower(p.prosrc) ~ 'limit[[:space:]]+[0-9]')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

Salida real (28 filas, `proname|rettype|devuelve_conjunto|menciona_limit|clausula`):

```
agregado_por_contraparte|record|t|t|limit public.agregado_por_contraparte_cap() ) sub group by sub.pro
agregado_por_contraparte_cap|integer|f|f|(sin limit)
aportes_de_parlamentario|record|t|f|(sin limit)
bienes_de_parlamentario|record|t|f|(sin limit)
coincidencia_votos_par|record|t|f|(sin limit)
comparar_declaraciones|record|t|f|(sin limit)
contratos_de_parlamentario|record|t|f|(sin limit)
cruces_de_parlamentario|record|t|f|(sin limit)
cruces_de_proyecto|record|t|f|(sin limit)
declaraciones_de_parlamentario|record|t|f|(sin limit)
entidad_tercero_estado_no_regresa|trigger|f|f|(sin limit)
f_unaccent|text|f|f|(sin limit)
identidad_audit_immutable|trigger|f|f|(sin limit)
lobby_de_parlamentario|record|t|f|(sin limit)
lobby_en_tramitacion|record|t|f|(sin limit)
match_proyectos|record|t|t|limit match_count
parlamentario_estado_no_regresa|trigger|f|f|(sin limit)
parlamentario_publico|record|t|f|(sin limit)
parlamentarios_publico|record|t|f|(sin limit)
rebeldias_de_parlamentario|record|t|f|(sin limit)
resolver_entidad|bigint|f|f|(sin limit)
resolver_identidad|bigint|f|f|(sin limit)
subgrafo_red|jsonb|f|f|(sin limit)
tasa_ausencia_comparada|record|t|f|(sin limit)
vinculo_entidad_guarda|trigger|f|f|(sin limit)
vinculo_entidad_guarda_insert|trigger|f|f|(sin limit)
vinculo_identidad_guarda|trigger|f|f|(sin limit)
vinculo_identidad_guarda_insert|trigger|f|f|(sin limit)
```

La heurística **falló en 4 casos** (todos rescatados por la revisión manual): `agregado_por_contraparte`
(`limit public.agregado_por_contraparte_cap()` ⇒ cap **500**), `match_proyectos` (`limit match_count`),
`votos_de_parlamentario` (`limit p_limit`) y `buscar_citaciones`
(`limit greatest(1, least(coalesce(limite,50),100))` ⇒ techo duro **100**).

#### Tabla de acotamiento con `bounded` derivada y `nota` de revisión manual

`bounded := LIMIT efectivo AND statement_timeout`. Filas ordenadas por veredicto.

| función | tiene_limit (regex) | LIMIT efectivo (manual) | timeout | **bounded** | nota de la revisión manual (`pg_get_functiondef`) |
|---|---|---|---|---|---|
| `actualidad_senales_panel` | t | t | t | **sí** | patrón 0066 completo |
| `buscar_proyectos_hibrido` | t | t | t | **sí** | patrón 0066 completo |
| `co_comisionados_de_parlamentario` | t | t | t | **sí** | 0064 |
| `coautores_de_parlamentario` | t | t | t | **sí** | 0064 |
| `comisiones_de_parlamentario` | t | t | t | **sí** | 0064 |
| `copartidarios_de_parlamentario` | t | t | t | **sí** | 0064 |
| `de_la_misma_zona` | t | t | t | **sí** | 0064 |
| `lobby_menciones_de_boletin` | t | t | t | **sí** | 0062/0063 |
| `militancia_historica_compartida` | t | t | t | **sí** | 0067 |
| `militancias_de_parlamentario` | t | t | t | **sí** | 0064 |
| `parlamentario_publico_v2` | t | t | t | **sí** | 0060/0064 |
| `parlamentarios_publico_v2` | t | t | t | **sí** | 0060/0064 |
| `coincidencia_votos_par` | f | n/a | t | **sí** | **rescatada**: agregación pura (`count(*) …`), retorna **exactamente 1 fila**. Un `LIMIT` sería decorativo; el `statement_timeout=5s` acota el costo del scan sobre `voto`. Cardinalidad acotada por construcción ⇒ **no offender**. |
| `agregado_por_contraparte_cap` | f | n/a | f | **sí** | **rescatada**: `select 500;` — constante `IMMUTABLE`, sin acceso a tablas. Cardinalidad 1, costo O(1) ⇒ **no offender**. |
| `f_unaccent` | f | n/a | f | **sí** (cardinalidad) | **rescatada**: escalar `IMMUTABLE STRICT` sobre `unaccent`, sin acceso a tablas. No es DoS por cardinalidad. Offender por **otra** razón (exposición a `anon`, §4b · OFF-4-01). |
| `entidad_tercero_estado_no_regresa`, `identidad_audit_immutable`, `parlamentario_estado_no_regresa`, `vinculo_entidad_guarda`, `vinculo_entidad_guarda_insert`, `vinculo_identidad_guarda`, `vinculo_identidad_guarda_insert` | f | n/a | f | n/a | **rescatadas**: `RETURNS trigger`. No son RPC: invocarlas directamente aborta (`can only be called as a trigger`) y PostgREST no las expone como `/rpc/*`. **No offender de acotamiento**; sí de exposición residual (§4b · OFF-4-02). |
| `resolver_entidad`, `resolver_identidad` | f | n/a | f | n/a | **rescatadas**: RPCs de **escritura** admin, `RETURNS bigint`, solo `service_role`, fuera de la allowlist pública (correcto: el guard falla si `app/` las llama). Cardinalidad 1. **No offender de acotamiento.** |
| `subgrafo_red` | f | **sí (por clamp)** | **f** | **no** | **rescatada parcialmente**: el walk recursivo lleva clamp explícito de profundidad `least(greatest(coalesce(p_depth,1),1),2)` ⇒ no hay walk unbounded. Pero el **fan-out por nivel no está acotado** y **no hay `statement_timeout`** ⇒ **offender OFF-4-04**. |
| `buscar_citaciones` | t | **sí (techo 100)** | **f** | **no** | `limit greatest(1, least(coalesce(limite,50),100))` — techo duro 100, no manipulable por el cliente. Falta **solo** el `statement_timeout` (el cuerpo hace `ts_rank` + dos `exists` correlacionados + `ilike '%…%'`) ⇒ **offender OFF-4-03**. |
| `match_proyectos` | f | **sí (`match_count`)** | **f** | **no** | `limit match_count` (default 20) — **sin techo**: el cliente puede pedir `match_count` arbitrario sobre un índice HNSW. Sin timeout ⇒ **offender OFF-4-03**. Además **sin `search_path`** y **no** `SECURITY DEFINER` (ver eje 5). |
| `votos_de_parlamentario` | f | **sí (`p_limit`)** | **f** | **no** | `limit p_limit offset p_offset` (default 20) — sin techo. Sin timeout ⇒ **offender OFF-4-03**. El cap de 1.000 que trunca es problema de **exactitud**, no de seguridad → `B-01` de la Phase 124 (ver §4c). |
| `agregado_por_contraparte` | f | **sí (cap 500)** | **f** | **no** | `limit public.agregado_por_contraparte_cap()` = 500, techo duro. Falta **solo** el timeout ⇒ **offender OFF-4-03**. |
| `aportes_de_parlamentario`, `bienes_de_parlamentario`, `comparar_declaraciones`, `contratos_de_parlamentario`, `cruces_de_parlamentario`, `cruces_de_proyecto`, `declaraciones_de_parlamentario`, `lobby_de_parlamentario`, `lobby_en_tramitacion`, `parlamentarios_publico`, `rebeldias_de_parlamentario`, `tasa_ausencia_comparada` | f | **NO** | **f** | **no** | **sin `LIMIT` de ninguna forma y sin `statement_timeout`**: set-returning, sin techo de filas ni de tiempo. El peor grupo ⇒ **offender OFF-4-03**. `parlamentarios_publico` retorna el **directorio completo** sin filtro. `tasa_ausencia_comparada` recorre la cohorte de una cámara entera sobre `voto`. |
| `parlamentario_publico` | f | **sí (clave primaria)** | **f** | **casi** | **rescatada**: `where p.id = p_id` sobre la PK de `parlamentario` ⇒ **máximo 1 fila** por construcción. Sin timeout, pero el costo es una búsqueda por índice. **Riesgo residual mínimo**; se lista en OFF-4-03 con prioridad baja por consistencia del régimen, no por riesgo real. |

**Recuento del eje 4a:** de 42 funciones, **13 bounded** por el patrón completo (0064/0066/0067),
**11 acotadas por construcción** (agregación 1-fila, constante, escalar, triggers, PK, admin-write) y
**18 no-bounded** que van a la tabla de offenders.

#### `Q-14` — superficie PII de las RPCs expuestas a `anon`

```sql
select p.proname, pg_get_function_result(p.oid) as retorno
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and pg_get_function_result(p.oid) ~* '(rut|email|correo|telefono|donante_id|direccion)'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`** — pero con la advertencia de que este cero es **débil**: filtra por
`exec_anon`, que ya vale `f` para las 34 RPCs de negocio. Por eso se ejecutó también `Q-14bis`.

#### `Q-14bis` — superficie PII sobre **las 42** (el cero fuerte)

Justificación: el sitio lee con `service_role` (§0.5), así que una firma con PII sería filtrable por
la superficie del sitio aunque `anon` no la alcance.

```sql
select p.proname, pg_get_function_result(p.oid) as retorno
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_function_result(p.oid) ~* '(rut|email|correo|telefono|donante_id|direccion)'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme`.** **Ninguna** de las 42 funciones de `public` nombra `rut`, `email`,
`correo`, `telefono`, `donante_id` ni `direccion` en su firma de retorno. El diseño PII-safe de las
RPCs (0021–0024) se sostiene contra la DB viva.

**Límite declarado de `Q-14`/`Q-14bis`:** ambas inspeccionan **nombres de columna de la firma de
retorno**, no el contenido. Una RPC que emitiera un RUT dentro de una columna `evidencia jsonb` o
`materia text` **no sería detectada**. `cruces_de_parlamentario` retorna precisamente un
`evidencia jsonb`; su comentario en el cuerpo declara «PII-safe (nombre crudo + enlace_fuente; sin
rut, sin donante_id)», pero eso es una **afirmación del código**, no una verificación — y verificarla
exigiría leer filas, prohibido por el régimen (cero PII). Queda como **`limite-declarado`**, herencia
para 123-04 (eje 6, superficie Data API) y para la Phase 124.

---

### 4b Allowlist × DB viva (ambos sentidos)

#### Paso 1 — extraer `PUBLIC_RPC_ALLOWLIST` sin transcribirla a mano

```bash
node -e "const s=require('fs').readFileSync('app/lib/lockdown-guard.test.ts','utf8');const m=s.slice(s.indexOf('PUBLIC_RPC_ALLOWLIST'));const b=m.slice(m.indexOf('['),m.indexOf(']')+1);console.log([...b.matchAll(/[\"'\`]([a-z0-9_]+)[\"'\`]/g)].map(x=>x[1]).sort().join('\n'))" | sort -u > /tmp/allowlist.txt
wc -l < /tmp/allowlist.txt
```

```
29
```

Contenido (29 nombres):

```
actualidad_senales_panel          agregado_por_contraparte          aportes_de_parlamentario
bienes_de_parlamentario           buscar_citaciones                 buscar_proyectos_hibrido
co_comisionados_de_parlamentario  coautores_de_parlamentario        coincidencia_votos_par
comisiones_de_parlamentario       comparar_declaraciones            contratos_de_parlamentario
copartidarios_de_parlamentario    cruces_de_parlamentario           cruces_de_proyecto
de_la_misma_zona                  declaraciones_de_parlamentario    lobby_de_parlamentario
lobby_en_tramitacion              lobby_menciones_de_boletin        match_proyectos
militancia_historica_compartida   militancias_de_parlamentario      parlamentario_publico
parlamentario_publico_v2          parlamentarios_publico            parlamentarios_publico_v2
subgrafo_red                      votos_de_parlamentario
```

#### Paso 2 — funciones realmente ejecutables por `anon` en la DB viva

`Q-15`

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
group by p.proname
order by 1;
```

```bash
set -a; source .env; set +a
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<Q-15>" | tr -d '\r' | sort -u > /tmp/exec_anon.txt
wc -l < /tmp/exec_anon.txt
```

```
8
```

`Q-15bis` — lista de control **todas** las funciones vivas (necesaria para el sentido «huérfano
real», ver más abajo):

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
group by p.proname order by 1;
```

```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<Q-15bis>" | tr -d '\r' | sort -u > /tmp/todas_fn.txt
wc -l < /tmp/todas_fn.txt
```

```
42
```

#### Paso 3 — los dos sentidos, con `comm`

Verificación de orden previa (`comm` exige entrada ordenada):

```bash
sort -c /tmp/allowlist.txt && sort -c /tmp/exec_anon.txt && sort -c /tmp/todas_fn.txt && echo "las tres ORDENADAS"
```

```
las tres ORDENADAS
```

> **`sort -c` NO es suficiente.** Las tres listas pasaron `sort -c` también en el intento
> contaminado por CRLF (§0) y los `comm` salieron falsos igualmente. El control que sí protege es el
> tercer `comm` con resultado conocido.

**Sentido A — `comm -23`: allowlisted que la DB viva NO expone a `anon`**

```bash
comm -23 /tmp/allowlist.txt /tmp/exec_anon.txt
```

```
actualidad_senales_panel          agregado_por_contraparte          aportes_de_parlamentario
bienes_de_parlamentario           buscar_citaciones                 buscar_proyectos_hibrido
co_comisionados_de_parlamentario  coautores_de_parlamentario        coincidencia_votos_par
comisiones_de_parlamentario       comparar_declaraciones            contratos_de_parlamentario
copartidarios_de_parlamentario    cruces_de_parlamentario           cruces_de_proyecto
de_la_misma_zona                  declaraciones_de_parlamentario    lobby_de_parlamentario
lobby_en_tramitacion              lobby_menciones_de_boletin        match_proyectos
militancia_historica_compartida   militancias_de_parlamentario      parlamentario_publico
parlamentario_publico_v2          parlamentarios_publico            parlamentarios_publico_v2
subgrafo_red                      votos_de_parlamentario
```

(29 nombres — la allowlist entera.)

**Sentido B — `comm -13`: la DB expone a `anon` y el guard no los conoce**

```bash
comm -13 /tmp/allowlist.txt /tmp/exec_anon.txt
```

```
entidad_tercero_estado_no_regresa
f_unaccent
identidad_audit_immutable
parlamentario_estado_no_regresa
vinculo_entidad_guarda
vinculo_entidad_guarda_insert
vinculo_identidad_guarda
vinculo_identidad_guarda_insert
```

**Sentido C — `comm -23` contra `todas_fn`: allowlisted SIN función viva (el huérfano *real*)**

```bash
comm -23 /tmp/allowlist.txt /tmp/todas_fn.txt
```

```
(0 filas)
```

#### Interpretación — y por qué el sentido A **no** es una lista de huérfanos

El plan definía el sentido A como «HUÉRFANOS: allowlisted que NO existe/expone la DB viva». Aplicado
literalmente da **29 de 29**, lo que leído como huérfanos sería una alarma total y **falsa**. La causa
es que `PUBLIC_RPC_ALLOWLIST` **no gobierna a `anon`**. Lo dice su propio comentario en
`app/lib/lockdown-guard.test.ts:180-182`:

> `// publico es service_role -> puede EJECUTAR cualquier RPC, incluso admin/write`
> `// (resolver_entidad, materializadores). La DB ya no lo bloquea, asi que el guard`
> `// FALLA si el arbol publico llama un RPC fuera de esta lista. Mantener en sync.`

La allowlist es la lista de RPCs que el árbol público puede llamar **con `service_role`**. Que
ninguna sea exec-`anon` **es el régimen `>0044` funcionando**, no un defecto. Por eso se separó el
sentido A (informativo) del sentido C (`existencia`), que es el chequeo de huérfano semánticamente
correcto — y **da 0**. Ver desviación RULE-1 nº 3.

| sentido | n | nombres | veredicto |
|---|---|---|---|
| **A** — allowlisted no exec-`anon` (`comm -23` vs `exec_anon`) | 29 | las 29 de la allowlist | **`conforme`** — consecuencia **esperada** del cero-grant `>0044`; el sitio las llama con `service_role`. No es huérfandad. |
| **B** — exec-`anon` no allowlisted (`comm -13`) | 8 | `entidad_tercero_estado_no_regresa`, `f_unaccent`, `identidad_audit_immutable`, `parlamentario_estado_no_regresa`, `vinculo_entidad_guarda`, `vinculo_entidad_guarda_insert`, `vinculo_identidad_guarda`, `vinculo_identidad_guarda_insert` | **`offender`** — OFF-4-01 / OFF-4-02 |
| **C** — allowlisted sin función viva, *huérfano real* (`comm -23` vs `todas_fn`) | **0** | — | **`conforme`** — demostrado por la salida vacía de `Q-15bis`+`comm`, no afirmado. Las 29 entradas existen en la DB viva. |

#### Por qué las 8 del sentido B están expuestas

```sql
select p.proname,
       coalesce(array_to_string(p.proacl,' | '),'(NULL = default: EXECUTE TO PUBLIC)') as acl,
       pg_get_function_result(p.oid) as retorno
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

Salida real:

```
entidad_tercero_estado_no_regresa|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
f_unaccent|=X/postgres | postgres=X/postgres | service_role=X/postgres|text
identidad_audit_immutable|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
parlamentario_estado_no_regresa|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_entidad_guarda|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_entidad_guarda_insert|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_identidad_guarda|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
vinculo_identidad_guarda_insert|=X/postgres | postgres=X/postgres | service_role=X/postgres|trigger
```

La entrada **`=X/postgres`** (grantee vacío) es `EXECUTE TO **PUBLIC**` — el default de Postgres para
toda función nueva. `anon` lo hereda por ser miembro de `PUBLIC`. **Nunca se les aplicó el
`revoke execute … from public`** del patrón "aguja completa". Confirmado también por contraste: no
existe ningún revoke para ellas en las migraciones

```bash
grep -rniE "revoke +(all|execute).*(f_unaccent|guarda|no_regresa|audit_immutable)" supabase/migrations/
```

```
(0 filas)
```

**Impacto real, sin inflarlo:** las 7 `RETURNS trigger` **no son invocables** como RPC (PostgREST no
las expone; una invocación directa aborta con `can only be called as a trigger`). El riesgo es
**latente y de régimen**, no explotable hoy. **`f_unaccent`** sí es invocable: retorna `text` y es
alcanzable por `POST /rest/v1/rpc/f_unaccent` con `anon`. Es un escalar `IMMUTABLE STRICT` sin acceso
a tablas ⇒ **no filtra datos**; es superficie no gobernada, no una fuga.

#### Contraste obligatorio con el guard — y el punto ciego para 123-05

- **Direction-B de hoy** (`app/lib/lockdown-guard.test.ts:614`) compara `PUBLIC_RPC_ALLOWLIST` contra
  `definedRpcNames(MIGRATIONS_DIR)` — es decir, contra el **texto de los archivos de migración**, vía
  el regex `create (or replace )?function (public.)?(\w+)`. Es una comprobación de **un solo
  sentido**: *toda entrada de la allowlist tiene una función definida en algún `.sql`*.
- **Esta auditoría** compara contra la **DB viva** (`pg_proc` + `has_function_privilege`).
- **Los dos conjuntos difieren, y difieren de forma consecuente**: las migraciones declaran
  `grant execute … to anon` para 9 RPCs que la DB viva **no** expone a `anon` (revocadas por
  `0044`/`0045`), y la DB viva expone a `anon` 8 funciones que **ninguna** migración menciona en un
  `grant` (llegaron por el default `TO PUBLIC`). **Ambas caras del punto ciego son invisibles para
  Direction-B**, que solo mira definiciones, nunca grants. ⇒ **OFF-4-05, `destino: guard`**, lo cierra
  el plan **123-05**.

**Límite que 123-05 debe respetar, declarado aquí:** el guard corre en **CI sin acceso a la DB**, así
que la extensión tiene que ser **estática sobre el texto de las migraciones**, no una consulta. Y no
puede ser un simple «`grant execute … to anon` declarado ⊆ allowlist», porque eso **fallaría hoy con
9 falsos positivos**: esos grants existen en los archivos y fueron **revocados después** por
`0044`/`0045`. Una extensión estática correcta debe **plegar la secuencia grant/revoke en orden de
número de migración** y evaluar el estado **final** declarado, o bien limitarse a lo que sí es
estáticamente decidible sin ambigüedad: **exigir que toda `create function` en `public` vaya
acompañada de su `revoke execute … from public`** — que es exactamente el defecto que dejó pasar a
las 8 del sentido B. El diseño fino queda para 123-05; aquí se deja escrito el requisito y la trampa.

#### Fuera de la allowlist y fuera de `anon` — sin veredicto de offender

`rebeldias_de_parlamentario` y `tasa_ausencia_comparada` **existen**, son `SECURITY DEFINER` con
`search_path`, **no** son exec-`anon` y **no** están en `PUBLIC_RPC_ALLOWLIST`. Eso es coherente: si
el árbol público las llamara, Direction-A las haría fallar. No son offender del eje 4. Se registran
porque 123-04 (eje 6) debe confirmar si `app/` las invoca; si lo hace, el guard ya está rojo y el
hallazgo es de 123-04, no de aquí.

---

### 4c Separación LOCKED: seguridad (`no-bounded`) vs exactitud (`p_limit` que trunca)

Regla escrita para que ningún lector futuro las confunda:

| condición | qué es | dónde va |
|---|---|---|
| Sin `LIMIT` efectivo **y** sin `statement_timeout` | **seguridad / DoS** — una petición puede barrer una tabla entera o colgar un worker | **offender del eje 4**, tabla de abajo |
| Con `LIMIT` efectivo pero **sin techo** (`p_limit`, `match_count` a elección del cliente) | **seguridad / DoS** — el cliente elige la cardinalidad | **offender del eje 4** |
| Con `LIMIT` y **default bajo que trunca resultados legítimos** (p. ej. el cap de 1.000 en votos) | **exactitud** — el dato mostrado es incompleto y el sitio no lo declara | **NO es offender de seguridad**: backlog de la **Phase 124** como **`B-01`** (`D1165` muestra 1.000 sobre 3.752 reales), anclado en **123-06** |

`votos_de_parlamentario` cae en **dos** casillas a la vez: `p_limit` sin techo es offender de
seguridad (OFF-4-03), y el cap de 1.000 que la superficie aplica es `B-01` de exactitud. Son dos
arreglos distintos y no deben fundirse en uno.

---

### 4d Tabla de offenders — Eje 4

| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
|---|---|---|---|---|---|---|
| OFF-4-01 | `función · f_unaccent` | 4 | invocable por `anon` vía `/rest/v1/rpc/f_unaccent` sin estar gobernada por la allowlist ⇒ superficie de la Data API fuera de todo control declarado (no filtra datos: escalar sin acceso a tablas) | `revoke execute on function public.f_unaccent(text) from public;` (+ `set search_path = ''`, ver OFF-5-01) | `Q-12`, `Q-15` | `124-aditivo` |
| OFF-4-02 | `función · entidad_tercero_estado_no_regresa`, `identidad_audit_immutable`, `parlamentario_estado_no_regresa`, `vinculo_entidad_guarda`, `vinculo_entidad_guarda_insert`, `vinculo_identidad_guarda`, `vinculo_identidad_guarda_insert` (7, todas `RETURNS trigger`) | 4 | `EXECUTE TO PUBLIC` por default nunca revocado ⇒ superficie residual heredada por `anon`; hoy **no explotable** (PostgREST no expone funciones trigger y la invocación directa aborta), pero es una desviación del régimen `>0044` que un cambio futuro de tipo de retorno volvería explotable en silencio | `revoke execute on function public.<f>() from public;` para las 7, sobre la firma exacta | `Q-12`, `Q-15` | `124-aditivo` |
| OFF-4-03 | `función · aportes_de_parlamentario`, `bienes_de_parlamentario`, `comparar_declaraciones`, `contratos_de_parlamentario`, `cruces_de_parlamentario`, `cruces_de_proyecto`, `declaraciones_de_parlamentario`, `lobby_de_parlamentario`, `lobby_en_tramitacion`, `parlamentarios_publico`, `rebeldias_de_parlamentario`, `tasa_ausencia_comparada` (12, **sin `LIMIT` y sin timeout**) + `agregado_por_contraparte`, `buscar_citaciones`, `parlamentario_publico` (3, con techo pero **sin timeout**) + `match_proyectos`, `votos_de_parlamentario` (2, **`LIMIT` sin techo y sin timeout**) | 4 | DoS: una petición puede barrer una tabla completa (`parlamentarios_publico` = directorio entero; `tasa_ausencia_comparada` = cohorte de una cámara sobre `voto`) o elegir su propia cardinalidad (`p_limit`/`match_count` sin cota), sin ningún corte de tiempo que libere el worker | extender el patrón de `0064`: `alter function public.<f>(<args>) set statement_timeout = '5s';` a las 17; **además** cota dura al parámetro en `match_proyectos` (`least(coalesce(match_count,20),100)`) y `votos_de_parlamentario` (`least(coalesce(p_limit,20),200)`); **además** `LIMIT` explícito en las 12 que no tienen ninguno | `Q-13bis` + revisión manual `pg_get_functiondef` | `124-aditivo` |
| OFF-4-04 | `función · subgrafo_red` | 4 | walk recursivo con profundidad acotada (clamp 1..2) pero **fan-out por nivel sin cota** y sin `statement_timeout` ⇒ una semilla muy conectada puede materializar un `jsonb` arbitrariamente grande y colgar el worker | `alter function public.subgrafo_red(...) set statement_timeout = '5s';` + cota explícita de nodos/aristas por nivel dentro del CTE recursivo | `Q-13bis` + revisión manual | `124-aditivo` |
| OFF-4-05 | `guard · Direction-B en app/lib/lockdown-guard.test.ts:614` | 4 | punto ciego: el guard solo verifica que la allowlist tenga función **definida** en las migraciones; **nunca mira grants**. No caza (a) los 9 `grant execute … to anon` declarados en 0011–0024 ya revocados por 0044/0045, ni (b) las 8 funciones expuestas por el default `TO PUBLIC` sin revoke — el defecto que produjo OFF-4-01 y OFF-4-02 | extensión **estática** (CI sin DB): exigir que toda `create function` en `public` tenga su `revoke execute … from public` en la misma migración; y si se compara grants contra la allowlist, **plegar grant/revoke en orden de migración** (un chequeo ingenuo da 9 falsos positivos hoy) | `Q-15` + `comm -13` + `grep` de contraste sobre `supabase/migrations/` | **`guard`** (plan **123-05**) |

**Veredicto del eje 4: `offender`** — 5 filas, ninguna destructiva. `Q-14`/`Q-14bis` (PII) y el
sentido C de la allowlist (huérfanos reales) quedan **`conforme` demostrado con query**. La firma de
retorno `evidencia jsonb` de `cruces_de_parlamentario` queda **`limite-declarado`**.

---

## Eje 5 — SECURITY DEFINER

### `Q-16` — toda función secdef y su `search_path`

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_userbyid(p.proowner)               as owner,
       array_to_string(coalesce(p.proconfig,'{}'), ',') as proconfig,
       exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
         as tiene_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by tiene_search_path asc, p.proname;
```

Salida real (**28 filas**, `proname|args|owner|proconfig|tiene_search_path`):

```
actualidad_senales_panel|p_tipo text|postgres|search_path="",statement_timeout=5s|t
agregado_por_contraparte|p_id text|postgres|search_path=""|t
aportes_de_parlamentario|p_id text|postgres|search_path=""|t
bienes_de_parlamentario|p_id text|postgres|search_path=""|t
buscar_proyectos_hibrido|q text, query_embedding vector, match_count integer|postgres|search_path="",statement_timeout=5s|t
co_comisionados_de_parlamentario|p_id text|postgres|search_path="",statement_timeout=5s|t
coautores_de_parlamentario|p_id text|postgres|search_path="",statement_timeout=5s|t
coincidencia_votos_par|p_a text, p_b text|postgres|search_path="",statement_timeout=5s|t
comisiones_de_parlamentario|p_id text|postgres|search_path="",statement_timeout=5s|t
comparar_declaraciones|p_id text, fechas date[]|postgres|search_path=""|t
contratos_de_parlamentario|p_id text|postgres|search_path=""|t
copartidarios_de_parlamentario|p_id text|postgres|search_path="",statement_timeout=5s|t
cruces_de_parlamentario|p_id text|postgres|search_path=""|t
cruces_de_proyecto|p_boletin text|postgres|search_path=""|t
de_la_misma_zona|p_id text|postgres|search_path="",statement_timeout=5s|t
declaraciones_de_parlamentario|p_id text|postgres|search_path=""|t
lobby_de_parlamentario|p_id text|postgres|search_path=""|t
lobby_en_tramitacion|p_boletin text|postgres|search_path=""|t
lobby_menciones_de_boletin|p_boletin text|postgres|search_path="",statement_timeout=5s|t
militancia_historica_compartida|p_id text|postgres|search_path="",statement_timeout=5s|t
militancias_de_parlamentario|p_id text|postgres|search_path="",statement_timeout=5s|t
parlamentario_publico|p_id text|postgres|search_path=""|t
parlamentario_publico_v2|p_id text|postgres|search_path="",statement_timeout=5s|t
parlamentarios_publico||postgres|search_path=""|t
parlamentarios_publico_v2||postgres|search_path="",statement_timeout=5s|t
rebeldias_de_parlamentario|p_id text|postgres|search_path=""|t
subgrafo_red|p_id text, p_depth integer, p_tipos text[], p_desde timestamp with time zone, p_hasta timestamp with time zone|postgres|search_path=""|t
tasa_ausencia_comparada|p_parlamentario_id text|postgres|search_path=""|t
```

**Las 28 dan `tiene_search_path = t`**, todas con `search_path=""` (el valor vacío, el más estricto:
obliga a calificar todo objeto con su schema) y todas con `owner = postgres`.

Recuento de control:

```sql
select count(*) filter (where p.prosecdef) as secdef, count(*) as total
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
```

```
28|42
```

⇒ 28 secdef + 14 `SECURITY INVOKER` = 42. Cuadra con el corpus del §0.3.

### `Q-17` — offenders Splinter **0011** (secdef SIN `search_path`)

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
```

Salida real:

```
(0 filas)
```

**Veredicto: `conforme` — 0 offenders, demostrado por la query, no afirmado.** Ninguna función
`SECURITY DEFINER` de `public` tiene `search_path` mutable. Splinter **0011** limpio. El cero **no es
vacuo**: el denominador son 28 funciones secdef reales, enumeradas por `Q-16`.

### `Q-18` — Splinter **0010**: vistas sin `security_invoker`

```sql
select c.relname,
       array_to_string(coalesce(c.reloptions,'{}'), ',') as reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
  and not exists (select 1 from unnest(coalesce(c.reloptions,'{}')) o where o like 'security_invoker=%')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
order by 1;
```

Salida real:

```
(0 filas)
```

**Este cero SÍ es vacuo, y se dice.** Control del denominador:

```sql
select count(*) as vistas_en_public
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');
```

```
0
```

**Veredicto: `conforme` por ausencia de superficie.** No hay **ninguna** vista ni vista
materializada en `public` (filtro de extensión aplicado). Splinter **0010** es inaplicable hoy. La
arquitectura expone datos por **funciones**, no por vistas — coherente con el patrón RPC PII-safe.
**Consecuencia para la Phase 124:** cualquier vista nueva en `public` nace bajo Splinter 0010 y debe
crearse con `with (security_invoker = true)`; hoy no hay guard que lo exija.

> **Nota de método (anti-"todo bien"):** `Q-17` y `Q-18` dan ambas `(0 filas)`, pero **no significan
> lo mismo**. `Q-17` = 28 objetos inspeccionados, 28 conformes (cero **fuerte**). `Q-18` = 0 objetos
> inspeccionados (cero **vacuo**). Un fragmento que reportara ambos como "0 offenders" sin el
> recuento del denominador estaría ocultando la diferencia. 123-06 debe leerlos distinto.

### `Q-19` — Splinter **0028/0029**: secdef ejecutable por `anon`

```sql
select p.proname, pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
```

Salida real:

```
(0 filas)
```

| función | owner | ¿esperado? | veredicto |
|---|---|---|---|
| *(ninguna)* | — | — | **`conforme`** — cero secdef alcanzable por `anon`. Las 28 secdef son `owner = postgres` (máximo blast radius) pero **ninguna** expuesta a `anon`; solo `service_role` las alcanza. Las 8 funciones exec-`anon` de `Q-15` son todas `prosecdef = f` (ver `Q-12`), así que ni siquiera corren con privilegios del dueño. |

### Regla escrita: `SECURITY DEFINER` + `anon` **es el patrón del proyecto**, no un defecto

Para que ningún auditor futuro lea `Q-19` como una lista de defectos:

> Una función `SECURITY DEFINER` ejecutable por `anon` **es el mecanismo de diseño** de este proyecto:
> es exactamente cómo una RPC PII-safe entrega datos públicos desde una tabla que `anon` no puede
> leer (RLS deny-by-default + grant solo a la función). Las migraciones `0020`–`0024` la construyen
> deliberadamente. **`Q-19` no es una tabla de offenders.**
>
> Una fila de `Q-19` es offender **solo si además** falla `Q-17` (secdef sin `search_path` ⇒
> escalada, Splinter 0011) **o** `Q-14` (la firma emite PII ⇒ fuga). En esta corrida `Q-19` está
> vacía y `Q-17`/`Q-14` también, así que la condición conjunta no se cumple por partida triple.

### Tabla de offenders — Eje 5

| # | objeto (tipo · nombre) | eje | riesgo | fix propuesto | query que lo detectó (Q-NN) | destino |
|---|---|---|---|---|---|---|
| OFF-5-01 | `función · f_unaccent(text)` | 5 | **no** es `SECURITY DEFINER` (corre como invoker ⇒ sin escalada) pero es la **única** función de `public` sin `search_path` fijado — `proconfig` vacío en `Q-13bis` — y su cuerpo llama `public.unaccent(...)`. Con el schema calificado el secuestro de resolución no aplica hoy; el riesgo es de **régimen**: es la única grieta en un corpus 100 % `search_path=""` y no está cubierta por ningún guard | `alter function public.f_unaccent(text) set search_path = '';` (el cuerpo ya califica `public.unaccent`, así que el cambio es inocuo) | `Q-16` (por ausencia) + `Q-13bis` (`proconfig` vacío) | `124-aditivo` |

**Veredicto del eje 5: `conforme` con 1 offender menor de régimen (OFF-5-01).** Splinter **0011**:
0 offenders **demostrado** sobre 28 secdef. Splinter **0010**: inaplicable (0 vistas), declarado
vacuo. Splinter **0028/0029**: 0 secdef alcanzable por `anon`.

**Ningún offender de este fragmento exige DROP, cambio de tipo ni backfill** ⇒ **cero filas con
`destino: supabase-architect+checkpoint`** en los ejes 4 y 5. Se deja constancia explícita de que la
regla se evaluó y no se gatilló: los 6 offenders son `alter function … set`, `revoke execute` y una
extensión de guard — todos aditivos y reversibles. Si la Phase 124 descubriera que acotar
`match_proyectos` o `votos_de_parlamentario` exige **cambiar la firma** (añadir/quitar parámetros),
eso **sí** obliga a `drop function` previo (`42P13`, gotcha v4.0) y en ese momento pasa a
`destino: supabase-architect+checkpoint` — no se diseña aquí.

---

## Resumen de veredictos

| eje | sub-chequeo | query | veredicto |
|---|---|---|---|
| 4 | inventario de exposición por rol (42 fn) | `Q-12` | `conforme` (0 RPC de negocio exec-`anon`) |
| 4 | acotamiento (bounded) | `Q-13`, `Q-13bis` + revisión manual | **`offender`** (OFF-4-03, OFF-4-04) |
| 4 | PII en firma de retorno, `anon` | `Q-14` | `conforme` (0 filas, cero débil) |
| 4 | PII en firma de retorno, las 42 | `Q-14bis` | `conforme` (0 filas, cero fuerte) |
| 4 | PII dentro de columnas `jsonb`/`text` | — | **`limite-declarado`** (exigiría leer filas) |
| 4 | allowlist → huérfano real | `Q-15bis` + `comm -23` | `conforme` (0 filas) |
| 4 | allowlist → expuestos no-allowlisted | `Q-15` + `comm -13` | **`offender`** (OFF-4-01, OFF-4-02) |
| 4 | punto ciego del guard Direction-B | `Q-15` + contraste `grep` | **`offender`** (OFF-4-05, `destino: guard`) |
| 5 | secdef sin `search_path` (Splinter 0011) | `Q-17` | `conforme` (0 de 28, cero **fuerte**) |
| 5 | vistas sin `security_invoker` (Splinter 0010) | `Q-18` | `conforme` **vacuo** (0 vistas en `public`) |
| 5 | secdef exec-`anon` (Splinter 0028/0029) | `Q-19` | `conforme` (0 filas) |
| 5 | `search_path` en el corpus completo | `Q-16` + `Q-13bis` | **`offender`** menor (OFF-5-01) |

**6 offenders**: OFF-4-01..05, OFF-5-01 — **5 `124-aditivo`**, **1 `guard`** (123-05), **0
`supabase-architect+checkpoint`**, **0 `deuda-operador`**.
