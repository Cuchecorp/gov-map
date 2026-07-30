# Phase 127: PANEL-MAT — Materializador 0080 puebla los sujetos - Research

**Researched:** 2026-07-30
**Domain:** PL/pgSQL — `create or replace` del proc `actualidad.materializar_senales()` (migración 0080 aditiva)
**Confidence:** HIGH (todo verificado leyendo el código fuente del repo; cero web research, como mandata el objetivo)

## Summary

Esta fase es 100% codebase-internal. Toda afirmación de abajo está `[VERIFIED: repo]` con archivo y línea; no hay
`[ASSUMED]` de librería ni de versión. La investigación confirma que la Opción A adjudicada es mecánicamente viable
—`create or replace` preserva owner y ACL, la RPC 0066 no cambia— pero destapa **cuatro conflictos duros** que el
planner DEBE resolver antes de escribir tareas, porque tres de ellos rompen el build/verde si se implementa el
CONTEXT.md al pie de la letra:

1. **El pgTAP de 0065 ROMPE con D-07.** `0065_actualidad_senal.test.sql:110-114` afirma que `cobertura_camara` de
   `velocity` **no contiene espacios** (`cobertura_camara !~ '\s'`). La grafía ciudadana `Cámara de Diputados` tiene
   espacios ⇒ ese assert falla el día que 0080 se aplica. No es opcional: hay que editar el test de 0065.
2. **`agenda_sala` rompe la paridad D-06** si sus ítems son ítems-de-tabla: el `conteo` cuenta **sesiones**
   (`count(*) from sesion_sala`, 0065:260-265), no ítems. D-02 pide ítems de tabla. Ambos no pueden ser ciertos.
3. **Campos que NO EXISTEN**: `tramitacion_evento` no tiene `titulo`; `sesion_tabla_item` no tiene `urgencia`;
   `citacion_punto` no tiene `titulo`. D-02 los nombra. El jsonb debe emitir lo que hay o traerlo por join.
4. **La RPC 0066 NO re-emite `origen`/`dataset`/`fecha_captura`/`enlace`** (0066:32-42, 9 columnas exactas). El
   `fuenteLabel`-desde-dato de la fase 128 **no tiene de dónde leer** hoy. Como la firma es intocable (Opción A), la
   única salida es meter la etiqueta de fuente dentro del jsonb.

**Primary recommendation:** Escribir 0080 como copia literal de 0065:88-310 con seis cambios quirúrgicos (una columna
`evidencia` por INSERT positivo) + una función `actualidad.grafia_camara(text)` inmutable usada **dentro del GROUP BY**;
y llevar al gate de Fable, ANTES de codificar, los cuatro conflictos de arriba con la resolución propuesta en
§Open Questions.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `evidencia = {"total": N, "items": [...], "consultado_al": "YYYY-MM-DD"}` por señal positiva. `total` ==
  count(*) del conteo de la fila (paridad obligatoria). Ítems ordenados `order by fecha desc` DENTRO del agg (orden de
  presentación, no cap).
- **D-02:** Unidad por señal = la unidad del conteo (spike E2, LOCKED): urgencias/velocity/archivados/nuevos_ingresos =
  eventos `{boletin,titulo,fecha,enlace,en_corpus,(grado en urgencias),(camara en velocity si aplica)}`;
  `agenda_citacion` = citaciones `{fecha,comision,horario,enlace,puntos:[{boletin,titulo,en_corpus}]}`; `agenda_sala` =
  fila por cámara con ítems de tabla `{boletin,titulo,posicion,(urgencia si la fuente la trae),en_corpus}`.
- **D-03:** CERO cap por recencia (anti-B-01, regla escrita como comentario en la migración): si algún día se cappea,
  por grado + `total` declarado. Los ~95 eventos de urgencias van completos.
- **D-04:** Frescura de fuente SEPARADA del hecho vía clave `consultado_al` (= fecha de la corrida, `current_date` en
  zona del dato) dentro del jsonb — NO columna nueva (la firma/shape de 0066 no cambia), NO `fecha_captura` (vetada
  como frescura visible: 44.847 eventos comparten 2026-07-10). El footer `según fuente al …` de 128 lee: hechos
  pasados → `max(fecha del hecho)` (ya viaja como `fecha_max`); agenda futura → `consultado_al`.
- **D-05:** `left join proyecto p on p.boletin = X` en TODO bloque que emita boletines; ítem SIEMPRE emitido con
  `en_corpus: (p.boletin is not null)`; `titulo`/`enlace` null cuando no está en corpus. JAMÁS inner-join en señales
  cuyo conteo es el evento (el spike midió 20→17 puntos con inner). `BOLETIN_RE` NO es guard (deja pasar `2718-09`).
- **D-06:** Query de paridad conteo↔detalle como pgTAP: para cada señal positiva,
  `conteo == (evidencia->>'total')::int` y `total == jsonb_array_length(evidencia->'items')` (en agenda_citacion la
  unidad es citación — los puntos anidados NO cuentan).
- **D-07:** Normalización en el MATERIALIZADOR (0065:233,261 y todo bloque que emita `cobertura_camara`), no en el
  cliente. Forma ciudadana única: `Cámara de Diputados` / `Senado`. Implementar como expresión CASE single-source
  repetida idéntica (o función SQL inmutable local al schema `actualidad`) — el revisor Fable adjudica la forma final.
  Mapea: `C.Diputados`→`Cámara de Diputados`, `camara`→`Cámara de Diputados`, `senado`→`Senado`, `Senado`→`Senado`.
- **D-08:** `(sin cámara)` se conserva como cobertura para eventos sin cámara (comportamiento actual).
- **D-09:** `supabase/migrations/0080_actualidad_evidencia.sql` — número RESERVADO confirmado (0079 última; 0073/0075
  escritas NO aplicadas JAMÁS se editan). Aditiva: `create or replace function` del proc completo; CERO cambio de
  tabla/RPC/ACL/grants. Header con las reglas: anti-B-01, guard 404, unidad=conteo, supresión `'{}'`.
- **D-10:** Aplicación a PROD por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f` (método
  LOCKED; JAMÁS `db push`; JAMÁS ecoar la URL). Post-aplicación: ejecutar `select actualidad.materializar_senales()`
  una vez y verificar por `psql -tA | tr -d '\r'` (jamás REST, cap 1k) evidencia poblada / supresión `'{}'` /
  paridad / grafía.
- **D-11:** pgTAP `supabase/tests/0080_actualidad_evidencia.test.sql` contra schema aplicado: siembra propia + boletín
  fantasma → `en_corpus:false` con titulo/enlace null; positivas pobladas; supresión `'{}'`; paridad D-06; cuerpo del
  proc sin `partido`/`rut` (el test de 0065 ya muerde). Correr con el runner real (`psql -tA -f`, precedente v4).
- **D-12:** El cron `actualidad-materializar` (7 11,14,17,20 * * 1-5) NO se toca — invoca el proc por nombre, el
  replace es transparente.

### Claude's Discretion

- Forma exacta del CASE de grafía (expresión inline repetida vs función) — la adjudica el revisor Fable en el gate
  de plan.
- Si `velocity` lleva `titulo`/`enlace` por evento vía left join (spike E6 lo muestra) — sí, mismo patrón.

### Deferred Ideas (OUT OF SCOPE)

- Adelgazar los 314,8 KB de evidencia k-means de `agrupacion_materia` (tipo ajeno al proc; el tile muere en 128 — si
  la RPC empieza a pesar, fase futura).
- Cap por grado con `total` declarado — SOLO si una legislatura cargada triplica urgencias (umbral documentado en la
  migración, no implementado).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-01 | Cada tile del panel muestra los sujetos del hecho vía `evidencia` jsonb `{"total": N, "items": [...]}`; supresión conserva `'{}'`; cap por recencia PROHIBIDO sin total | §Mapa exacto de 0065 (los 6 bloques y sus columnas), §Tablas fuente (qué campos existen realmente), §Code Examples (patrón por bloque) |
| PANEL-06 | Grafía de cámara única en el materializador (`0065:233,261`), no en el cliente | §Grafía única: inventario de valores crudos, §Pitfall 1 (colisión de unique key), §Pitfall 2 (el pgTAP de 0065 rompe) |

## Project Constraints (from CLAUDE.md)

Directivas aplicables a esta fase (el resto del stack —Deno, Next.js, cheerio, pgvector— no toca este trabajo):

- **Todo dato lleva fuente, fecha y enlace original; jamás afirmar intención ni causalidad.** El jsonb es
  literalmente el vehículo de esa trazabilidad por ítem.
- **Ingesta/derivados:** `Supabase = derivado reconstruible`. `actualidad_senal` es 100% derivado — re-materializar
  es siempre seguro, no hay que tocar fuentes.
- **GSD workflow enforcement:** ningún edit fuera de `/gsd:execute-phase`.
- **Secrets:** `SUPABASE_DB_URL` se usa **por nombre** (`set -a; source .env; set +a`), su valor JAMÁS se ecoa
  `[VERIFIED: .planning/milestones/v12.0-phases/124-supa-fix.../124-SUPA-FIX.md:38]`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agregación de sujetos por señal | Database (proc PL/pgSQL) | — | SEN-02 LOCKED: CERO agregación on-read. El cron 4×/día es el único momento de agregación. |
| Guard 404 (`en_corpus`) | Database (`left join proyecto` en el proc) | — | Spike E5: en A el guard se escribe una vez por corrida, no por request. |
| Grafía única de cámara | Database (materializador) | — | D-07 explícito: "no en el cliente". PANEL-06. |
| Frescura de fuente (`consultado_al`) | Database (jsonb, `current_date` de la corrida) | — | D-04: NO columna nueva (la firma de 0066 es intocable). |
| Etiqueta de fuente visible (`fuenteLabel`) | **Database (jsonb) — hoy NO existe** | Frontend (128) | La RPC no re-emite `origen`/`dataset` ⇒ ver §Open Question 4. |
| Render/recorte de ítems, copy, links | Frontend (Phase 128) | — | Fuera de esta fase. El jsonb lleva todo; la UI recorta diciendo "y M más" con `total`. |

## Mapa EXACTO de `supabase/migrations/0065_actualidad_senal.sql`

`[VERIFIED: repo, lectura completa del archivo 343 líneas]`

### Envoltura del proc

| Elemento | Línea | Contenido literal relevante |
|----------|-------|------------------------------|
| `create schema if not exists actualidad` | 86 | — |
| Firma del proc | 88-89 | `create or replace function actualidad.materializar_senales() returns void language plpgsql security definer set search_path = '' as $$` |
| Constante stale | 103 | `c_umbral_stale_dias constant int := 7;` |
| Vars | 106-107 | `v_tram_max date; v_cita_max date;` |
| **DELETE acotado** | 111-113 | `delete from public.actualidad_senal where tipo_senal in ('velocity','nuevos_ingresos','urgencias','agenda_citacion','agenda_sala','archivados');` — JAMÁS global; `agrupacion_materia` es del CLI k-means |
| Frescura tramitación | 116-117 | `select max(fecha::date) into v_tram_max from public.tramitacion_evento where fecha <= current_date;` |
| Frescura citación | 118-119 | `select max(fecha::date) into v_cita_max from public.citacion where fecha::date <= current_date;` |
| `end; $$;` | 309-310 | — |
| Bloque cron | 312-332 | guard de versión pg_cron + `perform cron.schedule('actualidad-materializar','7 11,14,17,20 * * 1-5', $cron$ select actualidad.materializar_senales(); $cron$)` |
| Assertion post-cron | 336-342 | falla la migración si el job no quedó en `cron.job` |

**Patrón de cada corrida:** un solo `delete` acotado al inicio (L111-113) seguido de inserts — **NO** hay delete/insert
por bloque. Todo corre en la transacción implícita de la función ⇒ full-rebuild atómico.

**Unique key:** `unique (tipo_senal, cobertura_camara, ventana, cluster_id)` en `0065:69`. Nótese que
`cobertura_camara` es NULLABLE y en Postgres los NULL **no colisionan** en un unique constraint — por eso `urgencias`
y `archivados` (cobertura NULL) conviven sin problema.

### Los 6 bloques positivos (columnas exactas y WHERE)

Los seis INSERT positivos listan **exactamente las mismas 8 columnas**:
`(tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)` — **ninguno lista
`evidencia`** ⇒ cae al `default '{}'::jsonb` de `0065:62`. Esto confirma el spike E1.

| # | Señal | INSERT (líneas) | Gate | WHERE de ventana | `cobertura_camara` emitida | Unidad del `conteo` |
|---|-------|-----------------|------|------------------|---------------------------|---------------------|
| 1 | `velocity` | **127-135** | `if v_tram_max is not null and v_tram_max >= current_date - c_umbral_stale_dias` (L126) | `fecha <= current_date and fecha >= current_date - interval '7 days'` (L133-134) | `coalesce(nullif(regexp_replace(camara,'\s+','','g'),''),'(sin cámara)')` — **grafía defectuosa** | evento de `tramitacion_evento` |
| 2 | `nuevos_ingresos` | **157-169** | ídem (L156) + `if not found` → supresión L170-177 | subquery `group by boletin having min(fecha) >= date '2022-01-01' and min(fecha) >= current_date - interval '7 days'` (L161-168), con `fecha <= current_date` (L164) | literal `'2022-2026 (piso de corpus)'` — **NO es una cámara** | boletín (primer-evento) |
| 3 | `urgencias` | **195-203** | ídem (L194) + `if not found` → supresión L204-210 | `tipo = 'urgencia' and fecha <= current_date and fecha >= current_date - interval '30 days'` (L200-202) | **`null`** (sin corte de cámara, anti-ranking) | evento de `tramitacion_evento` |
| 4 | `agenda_citacion` | **230-237** | `if exists (select 1 from public.citacion where fecha::date >= current_date)` (L228) — WR-05: la PRESENCIA de futuras domina, no la frescura | `where fecha::date >= current_date` (L236) — **date-only, SIN `at time zone`** | **L233**: `coalesce(nullif(regexp_replace(camara,...),''),'(sin cámara)')` sobre `citacion.camara` ∈ {`camara`,`senado`} — **grafía defectuosa** | citación |
| 5 | `agenda_sala` | **258-265** | `if exists (select 1 from public.sesion_sala where fecha::date >= current_date)` (L257) | `where fecha::date >= current_date` (L264) | **L261**: mismo `regexp_replace` sobre `sesion_sala.camara` ∈ {`camara`,`senado`} — **grafía defectuosa** | **sesión** (`count(*) from sesion_sala`) |
| 6 | `archivados` | **285-295** | `if v_tram_max ...` (L284) + `if not found` → supresión L296-302 | `fecha <= current_date and fecha >= current_date - interval '30 days' and (descripcion ilike '%archiv%' or descripcion ilike '%retira%') and descripcion not ilike '%desarchiv%' and descripcion not ilike '%retira y hace presente%'` (L290-294) | **`null`** | evento de `tramitacion_evento` |

**Las dos grafías defectuosas señaladas por PANEL-06 son L233 (`agenda_citacion`) y L261 (`agenda_sala`)**; pero
`velocity` (L130/L135) usa **la misma expresión defectuosa** sobre otro vocabulario (`C.Diputados`), y D-07 dice
"y todo bloque que emita `cobertura_camara`" ⇒ **son tres los sitios a normalizar**, no dos.

### Los bloques de supresión (5 formas, 8 sitios)

Todas las filas de supresión omiten `evidencia` ⇒ conservan `'{}'` **sin tocar nada**. D-09/WR-01 se cumple por
omisión: la instrucción para el ejecutor es **"no agregar `evidencia` a ningún INSERT de supresión"**.

| Señal | Sitios | Causa emitida |
|-------|--------|---------------|
| `velocity` | 138-142 | `'sin datos frescos de esta fuente'` |
| `nuevos_ingresos` | 171-176 (fresca-sin-ingresos) · 180-185 (stale) | `'sin nuevos ingresos fechados en la ventana'` · `'sin datos frescos de esta fuente'` |
| `urgencias` | 205-209 · 212-215 | `'sin urgencias fechadas en la ventana'` · `'sin datos frescos de esta fuente'` |
| `agenda_citacion` | 240-244 · 247-250 | `'sin citaciones agendadas en las fuentes consultadas'` · `'sin datos frescos de esta fuente'` |
| `agenda_sala` | 268-273 | `'sin sesiones agendadas en las fuentes consultadas'` |
| `archivados` | 297-301 · 304-307 | `'sin movimientos de archivo/retiro fechados en la ventana'` · `'sin datos frescos de esta fuente'` |

Nótese que las supresiones de `urgencias`/`archivados`/`agenda_*` (a diferencia de las positivas) **omiten también
`cobertura_camara`** — 6 columnas en vez de 8. No cambiar eso.

## `supabase/migrations/0066_actualidad_rpc.sql` — firma completa

`[VERIFIED: repo, archivo completo 57 líneas]`

```
public.actualidad_senales_panel(p_tipo text default null)
returns table (
  tipo_senal text, ventana text, conteo int, cobertura_camara text,
  materia text, cluster_id int, fecha_max timestamptz,
  supresion_causa text, evidencia jsonb           -- ← 9ª columna, ya presente
)
language sql stable security definer
  set search_path = '' set statement_timeout = '5s'
-- order by s.tipo_senal, s.cobertura_camara nulls last, s.cluster_id nulls last
-- limit 200
-- revoke all ... from public; revoke all ... from anon, authenticated;   (CERO grant)
```

**Columnas de `actualidad_senal` que la RPC NO re-emite** (verificado contra `0065:50-70`):
`id`, **`dataset`**, **`origen`**, **`fecha_captura`**, **`enlace`**.

### Consecuencia para el `fuenteLabel`-desde-dato de la Phase 128 — REPORTADO

`origen` (`'plataforma-tramitacion'` / `'plataforma-agenda'`) y `dataset` (`'tramitacion'` / `'agenda'`) **existen en
la tabla y se escriben por fila**, pero **no llegan al frontend**. Como la firma de 0066 es intocable por adjudicación
del spike (Opción A), la única salida disponible es **meter la etiqueta de fuente dentro del jsonb**. Recomendación
concreta para el planner (a ratificar por Fable):

```jsonb
{"total": N, "items": [...], "consultado_al": "2026-07-30",
 "fuente": {"dataset": "tramitacion", "origen": "plataforma-tramitacion"}}
```

Es aditivo, no toca la firma, y cierra el hueco de 128 antes de que 128 lo descubra. **Sin esto, 128 tendrá que
hardcodear `fuenteLabel` otra vez** — que es exactamente el defecto que el spike §"Queda para el premortem" punto 6
apuntó como pendiente. Coste: ~60 B por señal, despreciable frente a los 39,7 KB.

`consultado_al` (D-04) es igualmente obligatorio: `fecha_captura` no viaja por la RPC, así que **no hay hoy ninguna
forma de que la UI sepa cuándo se consultó la fuente** salvo esta clave del jsonb. D-04 no era solo una preferencia
editorial: es la **única** vía técnica.

## Tablas fuente — columnas REALES (no fabricar campos)

`[VERIFIED: supabase/migrations/0008_tramitacion.sql:19-82, 0010_agenda.sql:19-85]`

| Tabla | Columnas relevantes | Falta lo que D-02 asume |
|-------|--------------------|--------------------------|
| `proyecto` (0008:19-34) | `boletin` **PK**, `boletin_num`, `titulo` **not null**, `iniciativa`, `camara_origen`, `autores text[]`, `materia`, `estado`, `etapa`, `subetapa`, `origen`, `fecha_captura`, `enlace` **not null** | — (es la fuente de `titulo`/`enlace`) |
| `tramitacion_evento` (0008:69-82) | `id`, `boletin` **FK→proyecto**, `fecha timestamptz`, `camara` (nullable, texto libre), `tipo` check ∈ {`tramite`,`urgencia`,`informe`,`oficio`,`votacion`}, `descripcion`, `enlace` (link al documento del evento, nullable), `origen`, `fecha_captura` | **NO tiene `titulo`** ⇒ el `titulo` del ítem viene de `p.titulo` por el left join. Tiene **dos** enlaces posibles: `te.enlace` (documento del evento) y `p.enlace` (ficha del proyecto) — decidir |
| `citacion` (0010:19-33) | `id text` **PK**, `camara` **check ∈ {`camara`,`senado`}**, `comision` not null, `fecha timestamptz`, `horario` (crudo, "10:00 a 12:00"), `sala`, `materia`, `estado`, `semana_iso` not null ("YYYY-Www"), `origen`, `fecha_captura`, `enlace` **not null** | — (D-02 pide fecha/comision/horario/enlace: **los 4 existen**). Bonus disponible: `semana_iso` — lo que 128 necesita para `/agenda?semana=` |
| `citacion_punto` (0010:46-56) | `id`, `citacion_id` FK on delete cascade, `posicion int not null default 0`, `boletin` (**nullable**), `id_proyecto`, `materia`, `tipo_tramite` | **NO tiene `titulo`** ⇒ viene de `p2.titulo` por left join. `materia` es el label crudo disponible |
| `sesion_sala` (0010:59-70) | `id text` **PK**, `camara` **check ∈ {`camara`,`senado`}**, `fecha timestamptz`, `numero`, `hora_inicio`, `tipo`, `origen`, `fecha_captura`, `enlace` **not null** | — (la fila sintética `camara:sesion:2026-W31` tiene `numero`/`tipo`/`hora_inicio` NULL, tal como avisa el CONTEXT §specifics) |
| `sesion_tabla_item` (0010:73-85) | `id`, `sesion_id` FK on delete cascade, `posicion int not null`, `parte_sesion` not null ("ORDEN DEL DÍA"/…), `materia`, `boletin` (**nullable**), `id_proyecto`, `alias`, `quorum` | **NO tiene `urgencia`.** D-02 dice "(urgencia si la fuente la trae)" — **la fuente NO la trae**. Lo análogo disponible es `quorum` (y `parte_sesion`). NO fabricar `urgencia` |

**Índices que la nueva agregación aprovecha:** `tramitacion_evento_boletin_idx (boletin, fecha)` (0008:87),
`citacion_punto_boletin_idx (boletin)` y `sesion_tabla_item_boletin_idx (boletin)` (0010:90-91), `citacion_fecha_idx`
(0010:89). El `left join proyecto` va contra la PK. **No hace falta índice nuevo** — 0080 sigue siendo cero-DDL-de-tabla.

## Grafía única (PANEL-06 / D-07) — inventario de valores crudos

| Bloque | Columna fuente | Dominio real | Tras `regexp_replace(camara,'\s+','','g')` hoy | Grafía ciudadana objetivo |
|--------|----------------|--------------|-----------------------------------------------|---------------------------|
| `velocity` (L130,135) | `tramitacion_evento.camara` (texto libre, nullable) | `C.Diputados`, `C. Diputados`, `Senado`, NULL (2.261 filas, 0065:26) | `C.Diputados`, `Senado`, `(sin cámara)` | `Cámara de Diputados`, `Senado`, `(sin cámara)` |
| `agenda_citacion` (L233) | `citacion.camara` **check ∈ {`camara`,`senado`}** (0010:21) | `camara`, `senado` | `camara`, `senado` | `Cámara de Diputados`, `Senado` |
| `agenda_sala` (L261) | `sesion_sala.camara` **check ∈ {`camara`,`senado`}** (0010:61) | `camara`, `senado` | `camara`, `senado` | `Cámara de Diputados`, `Senado` |
| `nuevos_ingresos` (L159) | literal | `'2022-2026 (piso de corpus)'` | ídem | **NO TOCAR** — no es una cámara |
| `urgencias` / `archivados` | — | `null` | `null` | `null` |

**El check constraint de `citacion.camara`/`sesion_sala.camara` está `[VERIFIED: repo]`** ⇒ el CASE de D-07 cubre el
dominio COMPLETO para agenda (no hay valor sorpresa posible). Para `velocity` el dominio es abierto ⇒ el CASE necesita
un `else` que preserve el valor crudo normalizado (nunca descartar), y el `(sin cámara)` de D-08 se conserva.

Forma recomendada (Claude's discretion, sujeta a Fable): **función inmutable local al schema**, no CASE repetido 3
veces —

```sql
create or replace function actualidad.grafia_camara(p_camara text)
returns text language sql immutable as $$
  select case
    when p_camara is null or btrim(p_camara) = '' then '(sin cámara)'   -- D-08
    when lower(regexp_replace(p_camara, '\s+', '', 'g')) in
         ('c.diputados','camara','cámara','diputados','camaradediputados')
      then 'Cámara de Diputados'
    when lower(regexp_replace(p_camara, '\s+', '', 'g')) in ('senado')
      then 'Senado'
    else regexp_replace(p_camara, '\s+', ' ', 'g')                       -- nunca descartar
  end;
$$;
```

Razones a favor de la función sobre el CASE inline: (a) single-source real (D-07 dice "single-source"; tres copias
idénticas no lo son); (b) el `group by` debe repetir la expresión literalmente y una llamada de función es una
expresión corta e infalsificable; (c) `immutable` la hace indexable/inlineable por el planner. **Contra:** es un
objeto nuevo, y D-09 dice "aditiva: `create or replace function` del proc completo; CERO cambio de
tabla/RPC/ACL/grants" — una función nueva en el schema `actualidad` **no es tabla, ni RPC, ni grant**, y `actualidad`
no está en la allowlist de `lockdown-guard` (esa allowlist cubre `.rpc()` desde `app/`, y nada en `app/` llamará a
`actualidad.grafia_camara`). Riesgo de régimen ≈ 0, pero **es exactamente el tipo de decisión que Fable debe firmar**.

## Riesgos de `create or replace` sobre el proc secdef

| Pregunta | Respuesta | Confianza |
|----------|-----------|-----------|
| ¿`create or replace function` preserva el **owner**? | **Sí.** REPLACE modifica la función existente in-place; `proowner` no cambia. Crítico aquí porque `security definer` ejecuta *como el owner* — si cambiara, el proc perdería acceso a `actualidad_senal` (deny-by-default). | HIGH `[VERIFIED: semántica Postgres + el proc ya se re-crea así en 0065:88]` |
| ¿Preserva la **ACL** (`proacl`)? | **Sí.** REPLACE no resetea privilegios. Como consecuencia: **0080 NO debe declarar grants ni revokes** — hacerlo sería el cambio de ACL que D-09 prohíbe. | HIGH |
| ¿Preserva los `SET` (search_path)? | **NO.** Los `SET` son parte de la definición: si 0080 omite `set search_path = ''`, se **pierde** (vector V8 de inyección de search_path en un secdef). **Restatear literalmente `security definer set search_path = ''`.** | HIGH — *pitfall #1 de la migración* |
| ¿Puede cambiar el tipo de retorno? | No (`42P13`), pero `returns void` no cambia ⇒ **no hace falta `drop`**. Contrastar con 0066 que sí usa `drop function if exists` (0066:29) porque cambia una `returns table`. | HIGH |
| ¿Hay **grants explícitos** sobre `actualidad.materializar_senales` en alguna migración? | **NO.** `grep -rln "materializar_senales\|actualidad_senal" supabase/` devuelve exactamente 4 archivos: `0065_actualidad_senal.sql`, `0066_actualidad_rpc.sql`, `0070_notificacion_envio.sql` (solo una **mención en un comentario**, L16), y `supabase/tests/0065_actualidad_senal.test.sql`. Cero grants que 0080 deba re-declarar. | HIGH `[VERIFIED: grep]` |
| ¿0076/0077/0079 tocan esta función? | **NO** — `grep "actualidad\|materializar"` sobre las tres devuelve vacío (operan sobre RPCs de `public`). | HIGH `[VERIFIED: grep]` |
| ¿El cron se rompe? | **NO** (D-12). `cron.schedule` guarda el **texto SQL** `select actualidad.materializar_senales();` (0065:329), resuelto por nombre en cada corrida. **0080 NO debe re-emitir el bloque `cron.schedule`** — sería un cambio innecesario y `cron.schedule` sobre un jobname existente lo re-escribe (idempotente pero fuera de alcance). | HIGH |

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|----------|--------------|------------------|---------|
| Ordenar ítems dentro del jsonb | `order by` externo + array manipulation | `jsonb_agg(... order by te.fecha desc)` (agg-level ORDER BY) | Es SQL estándar desde 9.0 y es lo que el spike E6 ya escribió. Un `order by` en el `select` externo **no** ordena dentro del agg. |
| "0 ítems" en el sub-agg de puntos | `case when count=0 then '[]'` | `coalesce(jsonb_agg(...), '[]'::jsonb)` | `jsonb_agg` sobre conjunto vacío devuelve **NULL**, no `'[]'` — el `coalesce` del spike E6 (L240) es obligatorio, si no `evidencia->'items'->0->'puntos'` sería `null` y 128 crashearía. |
| Guard de existencia de boletín | validar con `BOLETIN_RE` / regex | `left join public.proyecto p on p.boletin = X` + `en_corpus` | D-05 LOCKED; el spike midió que la regex deja pasar `2718-09`. |
| Fecha del ítem | `fecha at time zone 'America/Santiago'` | `fecha::date` a secas | Gotcha rector v9.0/v12.0: `citacion.fecha`/`sesion_sala.fecha` son **date-only-midnight-UTC = día chileno**; convertir tz fabrica un desfase de un día. 0065:219-220 y 0065:256 lo documentan. |
| Frescura visible | `fecha_captura` | `consultado_al` en el jsonb (D-04) | 44.847 eventos comparten `fecha_captura=2026-07-10` por backfill (0065:26-27). Vetada. |
| Correr el pgTAP | escribir un runner nuevo | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f <test> \| tr -d '\r'` | Precedente v12 verbatim; **no existe** script/npm-target de pgTAP en el repo (verificado: `ls scripts/`, `grep pgtap package.json`). |

## Common Pitfalls

### Pitfall 1 — Normalizar la grafía FUERA del `group by` ⇒ violación de unique key
**Qué sale mal:** si el `select` emite `grafia_camara(camara)` pero el `group by` sigue agrupando por
`regexp_replace(camara,...)`, dos buckets crudos que colapsan a la misma grafía ciudadana (p.ej. `Senado` y `senado`
en `tramitacion_evento`, cuyo dominio es texto libre) producen **dos filas** con el mismo
`(tipo_senal, cobertura_camara, ventana, cluster_id)` ⇒ `23505 duplicate key` y **la migración/corrida entera aborta**
(todo el proc es una transacción).
**Por qué pasa:** Postgres exige que la expresión del select agregado aparezca en el group by; es fácil dejar la vieja.
**Cómo evitarlo:** usar **la misma expresión literal** (idealmente `actualidad.grafia_camara(camara)`) en select,
group by, y —si aplica— en el `jsonb_build_object`. La agregación de `jsonb_agg` debe quedar dentro del mismo grupo.
**Señal temprana:** `select actualidad.grafia_camara(camara), count(*) from tramitacion_evento where fecha >= current_date - 7 group by 1;`
devuelve menos filas que el `regexp_replace` actual ⇒ hubo colapso ⇒ el group by es obligatorio.

### Pitfall 2 — El pgTAP de 0065 rompe con la grafía nueva (BLOQUEANTE)
**Qué sale mal:** `supabase/tests/0065_actualidad_senal.test.sql:110-114` asserta
`bool_and(cobertura_camara !~ '\s')` para `velocity` con el mensaje *"la cobertura_camara de velocity no contiene
espacios internos (normalizada)"*. `Cámara de Diputados` **tiene** espacios ⇒ el test de 0065 pasa a FAIL en cuanto
0080 se aplica. Es un falso rojo de un test correcto para el régimen viejo.
**Además:** el assert de L104-108 (`count(distinct cobertura_camara) = 1` filtrando `~ '[Dd]iputados'`) **sigue verde**
(`Cámara de Diputados` matchea `[Dd]iputados`), así que la protección D2 real no se pierde.
**Cómo evitarlo:** el plan DEBE incluir una tarea explícita de **actualizar `0065_actualidad_senal.test.sql`**
(el archivo de test es editable; la **migración** 0065 no se toca), reemplazando el assert de "sin espacios" por el
assert de la grafía ciudadana: `cobertura_camara = 'Cámara de Diputados'`. Eso **fortalece** el control en vez de
debilitarlo, y `select plan(17)` se mantiene en 17.
**Señal temprana:** correr el pgTAP de 0065 **antes** de aplicar 0080 (baseline verde 17/17) y **después**.

### Pitfall 3 — `jsonb_agg` sobre conjunto vacío devuelve NULL
**Qué sale mal:** `evidencia` quedaría `{"total":0,"items":null}` en vez de `'[]'`, y `jsonb_array_length(null)` es
NULL ⇒ el assert de paridad D-06 no falla, **devuelve NULL** (verde vacuo — el gotcha "cero vacuo" de v12.0).
**Cómo evitarlo:** `coalesce(jsonb_agg(...), '[]'::jsonb)` en TODOS los agregados, incluido el sub-agg de `puntos`.
Y escribir el assert de paridad con `is(...)` sobre valores no-nulos + un control de "no hay señal positiva con
`items` null".

### Pitfall 4 — `having count(*) > 0` + `if not found` con jsonb
**Qué sale mal:** el idiom de 0065 (L169/203/295) usa un agregado global sin GROUP BY más `having count(*) > 0`, y
después `if not found` para emitir la supresión. Añadir `jsonb_agg` **no** cambia esa semántica (el HAVING se evalúa
sobre el mismo grupo), pero si alguien "simplifica" el HAVING mientras edita, la señal emitiría
`conteo=0, causa NULL` = **0-como-hecho prohibido** (WR-01) y el pgTAP de 0065 L172-177 lo caza.
**Cómo evitarlo:** copiar los 6 bloques **literalmente** y añadir SOLO la columna `evidencia` + el left join. Cero
refactor de la lógica de gates.

### Pitfall 5 — El `left join proyecto` multiplica filas en el conteo
**Qué sale mal:** `proyecto.boletin` es **PK** (0008:20) ⇒ el left join es 1:0..1 y **NO** multiplica. Verificado.
Pero el mismo razonamiento **no** aplica a `citacion → citacion_punto` (1:N): si se hiciera un join plano contra
`citacion_punto` en el bloque de `agenda_citacion`, el `count(*)` pasaría de contar citaciones a contar puntos y
divergiría del conteo actual ⇒ el spike E6 usa un **sub-select correlacionado** (L238-243) precisamente por esto.
**Cómo evitarlo:** puntos anidados vía sub-select correlacionado, nunca vía join en el FROM.

### Pitfall 6 — Aplicar sin `PGCLIENTENCODING=UTF8`
**Qué sale mal:** la migración contiene `Cámara`, `(sin cámara)`, `Discusión`. Sin `PGCLIENTENCODING=UTF8` en este
host Windows, las tildes se corrompen y la grafía "única" nace rota, silenciosamente.
**Cómo evitarlo:** el comando D-10 completo, siempre. Y verificar post-apply con `psql -tA | tr -d '\r'` que
`cobertura_camara` contiene literalmente `Cámara de Diputados`.

### Pitfall 7 — `psql -tA` emite CRLF
**Qué sale mal:** todo pipe (`grep -c`, `sort -c`, comparación con `=`) contra la salida de `psql -tA` compara contra
un valor con `\r` invisible al final ⇒ falsos rojos y, peor, falsos verdes.
**Cómo evitarlo:** `| tr -d '\r'` en **todo** pipe `[VERIFIED: 124-SUPA-FIX.md:129]`.

## Code Examples

Patrón por bloque, derivado del spike E6 y corregido con los hallazgos de esta investigación (campos reales,
`coalesce` del agg, grafía en el group by, `consultado_al` + `fuente`).

### Bloque tipo A — evento de `tramitacion_evento` (urgencias; velocity/archivados/nuevos_ingresos análogos)

```sql
-- (3) urgencias — 30d, COMPLETA (anti-B-01: cero cap por recencia).
insert into public.actualidad_senal
  (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, evidencia,
   dataset, origen, fecha_captura)
select 'urgencias', '30d', count(*), null, max(te.fecha),
       jsonb_build_object(
         'total', count(*),
         'consultado_al', current_date,                       -- D-04
         'fuente', jsonb_build_object('dataset','tramitacion',
                                      'origen','plataforma-tramitacion'),
         'items', coalesce(jsonb_agg(                          -- Pitfall 3
           jsonb_build_object(
             'boletin',   te.boletin,
             'titulo',    p.titulo,        -- tramitacion_evento NO tiene titulo
             'grado',     te.descripcion,  -- literal de fuente ("Discusión inmediata")
             'fecha',     te.fecha::date,  -- date-only, SIN at time zone
             'enlace',    p.enlace,
             'en_corpus', (p.boletin is not null))             -- D-05
           order by te.fecha desc), '[]'::jsonb))              -- D-01 orden, no cap
       , 'tramitacion', 'plataforma-tramitacion', now()
  from public.tramitacion_evento te
  left join public.proyecto p on p.boletin = te.boletin        -- 1:0..1 (PK) ⇒ no multiplica
 where te.tipo = 'urgencia'
   and te.fecha <= current_date                                -- D1
   and te.fecha >= current_date - interval '30 days'
 having count(*) > 0;                                          -- idiom 0065:203, no tocar
```

### Bloque tipo B — con `group by` de cámara normalizada (velocity)

```sql
select 'velocity', '7d', count(*),
       actualidad.grafia_camara(te.camara),                    -- D-07 + D-08
       max(te.fecha),
       jsonb_build_object('total', count(*), 'consultado_al', current_date, ...,
         'items', coalesce(jsonb_agg(jsonb_build_object(
             'boletin', te.boletin, 'titulo', p.titulo, 'fecha', te.fecha::date,
             'enlace', p.enlace, 'en_corpus', (p.boletin is not null))
           order by te.fecha desc), '[]'::jsonb)),
       'tramitacion', 'plataforma-tramitacion', now()
  from public.tramitacion_evento te
  left join public.proyecto p on p.boletin = te.boletin
 where te.fecha <= current_date and te.fecha >= current_date - interval '7 days'
 group by actualidad.grafia_camara(te.camara);                 -- MISMA expresión (Pitfall 1)
```

### Bloque tipo C — citación con puntos anidados (sub-select correlacionado)

```sql
select 'agenda_citacion', 'futuras', count(*),
       actualidad.grafia_camara(c.camara), max(c.fecha),
       jsonb_build_object('total', count(*), 'consultado_al', current_date, ...,
         'items', coalesce(jsonb_agg(jsonb_build_object(
             'fecha', c.fecha::date, 'comision', c.comision,
             'horario', c.horario, 'enlace', c.enlace,
             'semana_iso', c.semana_iso,        -- disponible; lo necesita /agenda?semana= en 128
             'puntos', (select coalesce(jsonb_agg(jsonb_build_object(
                          'boletin', cp.boletin, 'titulo', p2.titulo,
                          'materia', cp.materia, 'posicion', cp.posicion,
                          'en_corpus', (p2.boletin is not null))
                        order by cp.posicion), '[]'::jsonb)
                       from public.citacion_punto cp
                       left join public.proyecto p2 on p2.boletin = cp.boletin
                      where cp.citacion_id = c.id and cp.boletin is not null))
           order by c.fecha), '[]'::jsonb)),                   -- Pitfall 5: sub-select, no join
       'agenda', 'plataforma-agenda', now()
  from public.citacion c
 where c.fecha::date >= current_date                           -- date-only = día chileno
 group by actualidad.grafia_camara(c.camara);
```

## Runtime State Inventory

Fase de migración de DB ⇒ inventario obligatorio.

| Categoría | Encontrado | Acción requerida |
|-----------|------------|------------------|
| **Datos almacenados** | `public.actualidad_senal` en PROD: 18 filas (6 temporales + 10 `agrupacion_materia` + …) con `evidencia='{}'` en las 8 filas temporales (spike E2.0). El proc hace `delete` acotado + reinsert ⇒ **NO hay migración de datos**: basta correr el proc una vez tras aplicar. `agrupacion_materia` (314,8 KB) **no se toca** (fuera del delete, 0065:111-113) | **Code-only.** Post-apply: `select actualidad.materializar_senales();` una vez |
| **Config de servicio vivo** | Cron `actualidad-materializar` en `cron.job` (`7 11,14,17,20 * * 1-5`, 0065:326-330). Vive en la DB, **no** en git como estado. Invoca por nombre ⇒ transparente al replace (D-12) | **Ninguna.** NO re-emitir `cron.schedule` en 0080 |
| **Estado registrado en SO** | Ninguno — no hay Task Scheduler ni pm2 involucrado en este proc | Ninguna — verificado: el único scheduler es pg_cron |
| **Secrets / env vars** | `SUPABASE_DB_URL` en `.env` (verificado presente). Sin cambios de nombre | Ninguna. Usar por nombre, jamás ecoar |
| **Artefactos de build** | Ninguno — 0080 no genera artefactos; `app/` no cambia (`SenalRow.evidencia` ya declarado, `panel-actualidad.tsx:44`) | Ninguna |

**Objetos vivos en PROD que 0080 asume:** `actualidad_senal`, `actualidad.materializar_senales`,
`actualidad_senales_panel` — los tres confirmados en `.supabase-ops.yaml` (`live_tables`, `live_rpcs`, bootstrapeado
contra la DB viva 2026-07-29). **0073/0074/0075 están escritas y NO aplicadas** ⇒ 0080 no debe asumir ningún efecto
de ellas (no lo hace: no toca ACL).

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|-------------|---------------|-----------|---------|----------|
| `psql` | apply de 0080 + pgTAP | ✓ (precedente v10-v12 verbatim) | — | ninguno (es el método LOCKED) |
| `SUPABASE_DB_URL` | conexión a PROD | ✓ (`.env`) | — | ninguno |
| pgTAP en PROD | `supabase/tests/0080_*.test.sql` | ✓ (0065 lo usa hoy: `plan()`, `has_table`, `is`, `ok`, `cmp_ok`, `throws_ok`, `finish`) | — | ninguno |
| pg_cron | cron existente | ✓ (0065:319-324 verifica extversion; el job existe) | — | ninguno |
| Runner/script de pgTAP | correr los tests | **✗ NO EXISTE** — `ls scripts/` y `grep pgtap package.json` no devuelven target alguno | — | **`psql -tA -f` a mano** (precedente v4 y v12: `124-SUPA-FIX.md:787-788`) |

**Sin fallback y bloqueante:** ninguna.
**Con fallback:** el runner de pgTAP — se corre a mano, tal como v12.

## Validation Architecture

### Test framework

| Propiedad | Valor |
|-----------|-------|
| Framework | **pgTAP** contra el schema APLICADO (no hay harness JS para SQL) |
| Config file | **ninguno** — no existe runner; invocación directa por `psql` |
| Comando rápido | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0080_actualidad_evidencia.test.sql \| tr -d '\r'` |
| Suite completa (SQL) | los dos tests de esta superficie: `0065_actualidad_senal.test.sql` (regresión, 17 asserts) + `0080_actualidad_evidencia.test.sql` (nuevo) |
| Suite `app/` | `pnpm test` — **no debe cambiar nada** en esta fase (cero archivos en `app/`); correrla igual como control de no-regresión |
| Guards de régimen | script `guards` por nombre explícito (creado en 126-02); el linter anti-insinuación **solo escanea `app/`** ⇒ **0080 no lo dispara** `[VERIFIED: anti-insinuacion-guard.test.ts:323-332, SUPERFICIES_PANEL son 8 rutas `components/*.tsx`]` |

### Mapa Requisito → Test

| Req | Comportamiento | Tipo | Comando automatizado | ¿Existe? |
|-----|----------------|------|----------------------|----------|
| PANEL-01 | Señal positiva ⇒ `evidencia` con `total`+`items` poblados | pgTAP | `psql -tA -f supabase/tests/0080_actualidad_evidencia.test.sql` | ❌ Wave 0 |
| PANEL-01 | Fila de supresión ⇒ `evidencia = '{}'` | pgTAP | ídem | ❌ Wave 0 |
| PANEL-01 (D-06) | Paridad `conteo == total == jsonb_array_length(items)` en toda positiva | pgTAP | ídem | ❌ Wave 0 |
| PANEL-01 (D-03) | Cero cap: ningún `items` truncado respecto de su `total` | pgTAP (es el mismo assert de paridad) | ídem | ❌ Wave 0 |
| PANEL-02/D-05 | Boletín fantasma sembrado ⇒ `en_corpus:false` con `titulo`/`enlace` null | pgTAP | ídem | ❌ Wave 0 |
| PANEL-06/D-07 | `cobertura_camara` ∈ {`Cámara de Diputados`,`Senado`,`(sin cámara)`,`2022-2026 (piso de corpus)`,null} en TODA fila temporal | pgTAP | ídem | ❌ Wave 0 |
| PANEL-06 regresión | 0065 sigue verde con la grafía nueva | pgTAP | `psql -tA -f supabase/tests/0065_actualidad_senal.test.sql` | ⚠️ **existe pero ROMPE** — ver Pitfall 2 |
| D-04 | `consultado_al` presente y == `current_date` en toda positiva | pgTAP | test 0080 | ❌ Wave 0 |
| no-PII | cuerpo del proc sin `partido`/`rut` | pgTAP | 0065 test L78-83 (ya muerde, se hereda gratis) | ✅ |
| D-12 | cron sigue registrado tras el replace | pgTAP | 0065 test L86-88 (ya muerde) | ✅ |

### Verificación manual post-apply (checkpoint de operador, D-10)

Todas con `| tr -d '\r'`; **jamás REST** (cap 1k):

```bash
set -a; source .env; set +a     # SUPABASE_DB_URL por nombre; JAMÁS ecoar

# 0) baseline ANTES de aplicar: 0065 debe estar 17/17 verde
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0065_actualidad_senal.test.sql | tr -d '\r'

# 1) aplicar
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
  -f supabase/migrations/0080_actualidad_evidencia.sql

# 2) materializar una vez
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select actualidad.materializar_senales();" | tr -d '\r'

# 3) evidencia poblada en positivas / '{}' en supresión
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "
select tipo_senal, cobertura_camara, conteo,
       (supresion_causa is not null) as suprimida,
       evidencia = '{}'::jsonb        as vacia,
       jsonb_array_length(evidencia->'items') as n_items,
       octet_length(evidencia::text)  as bytes
  from actualidad_senal
 where tipo_senal <> 'agrupacion_materia'
 order by tipo_senal, cobertura_camara;" | tr -d '\r'

# 4) PARIDAD (D-06) — debe devolver CERO filas
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "
select tipo_senal, cobertura_camara, conteo,
       (evidencia->>'total')::int, jsonb_array_length(evidencia->'items')
  from actualidad_senal
 where tipo_senal <> 'agrupacion_materia' and supresion_causa is null
   and (conteo <> (evidencia->>'total')::int
        or (evidencia->>'total')::int <> jsonb_array_length(evidencia->'items'));" | tr -d '\r'

# 5) GRAFÍA (PANEL-06) — el conjunto debe ser exactamente el esperado
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "
select distinct coalesce(cobertura_camara,'<null>')
  from actualidad_senal where tipo_senal <> 'agrupacion_materia' order by 1;" | tr -d '\r'

# 6) GUARD 404 — cuántos ítems de agenda quedan fuera de corpus (esperado ~10/49)
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "
select s.tipo_senal,
       count(*) filter (where (i->>'en_corpus')::boolean is false) as fuera_corpus,
       count(*) as total
  from actualidad_senal s,
       lateral jsonb_array_elements(s.evidencia->'items') i
 where s.tipo_senal like 'agenda%' group by 1;" | tr -d '\r'

# 7) pgTAP 0080 + regresión 0065 (ambos deben salir verdes)
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0080_actualidad_evidencia.test.sql | tr -d '\r'
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0065_actualidad_senal.test.sql  | tr -d '\r'
```

**Control de ausencia apareado (gotcha v12.0 "cero fuerte vs cero vacuo"):** la query 4 devuelve cero filas tanto si
hay paridad perfecta como si **no hay ninguna fila positiva**. Aparearla siempre con la query 3, que exhibe conteos
positivos. Ídem la query 6: sin el `total`, un `fuera_corpus=0` podría significar "items vacío".

### Gaps de Wave 0

- [ ] `supabase/tests/0080_actualidad_evidencia.test.sql` — cubre PANEL-01, PANEL-02(guard), PANEL-06, D-04, D-06
- [ ] **Edición de `supabase/tests/0065_actualidad_senal.test.sql`** — el assert L110-114 debe pasar de "sin espacios"
      a "grafía ciudadana exacta" (Pitfall 2). **Sin esta tarea el plan produce un rojo garantizado.**
- [ ] Ninguna instalación de framework — pgTAP ya está en PROD

## Security Domain

`security_enforcement` activo. La superficie de esta fase es un proc `security definer` en la DB.

| Categoría ASVS | Aplica | Control estándar |
|----------------|--------|------------------|
| V2 Autenticación | no | El proc lo invoca pg_cron; no hay sesión de usuario |
| V3 Sesiones | no | — |
| V4 Control de acceso | **sí** | `actualidad_senal` deny-by-default (RLS enabled, cero policies, `revoke all from anon, authenticated`, 0065:75-76). 0080 **no cambia ACL**; `create or replace` la preserva. El pgTAP de 0065 L188-193 verifica que anon recibe `42501` |
| V5 Validación de input | **sí (marginal)** | El proc no toma parámetros. La RPC 0066 sí, y es paramétrica (`where p_tipo is null or s.tipo_senal = p_tipo`) — **intocada** |
| V6 Criptografía | no | — |

| Patrón de amenaza | STRIDE | Mitigación estándar |
|-------------------|--------|---------------------|
| **`search_path` hijacking en un SECURITY DEFINER** | Elevation of Privilege | `set search_path = ''` + **todos** los nombres calificados con schema (`public.tramitacion_evento`, no `tramitacion_evento`). Es el riesgo #1 del replace: si 0080 olvida el `SET`, se pierde silenciosamente |
| Fuga de PII vía el jsonb | Information Disclosure | El proc lee solo tablas no-PII (`tramitacion_evento`, `citacion`, `citacion_punto`, `sesion_sala`, `sesion_tabla_item`, `proyecto`). **El jsonb nuevo NO debe traer `proyecto.autores`** (nombres de parlamentarios) ni nada de `parlamentario`. El pgTAP de 0065 solo muerde las palabras `partido`/`rut` ⇒ **no protege contra `autores`**: el plan debe añadir el assert |
| SQL injection | Tampering | Cero SQL dinámico; el proc es SQL estático |
| Crecimiento no acotado del payload | DoS | `limit 200` en la RPC (0066:52) + `statement_timeout='5s'`. 39,7 KB medidos vs 314,8 KB ya en vuelo. Umbral de cap documentado como comentario (D-03), no implementado |

## State of the Art

| Enfoque viejo | Enfoque actual | Cuándo cambió | Impacto |
|---------------|----------------|---------------|---------|
| `evidencia` prometida en el comentario de `0065:47-49` pero nunca escrita | los 6 bloques la pueblan | esta fase (0080) | La promesa D-09 de 0065 por fin se cumple |
| Grafía cruda `C.Diputados` / `camara` / `senado` en `cobertura_camara` | grafía ciudadana única | esta fase | Rompe el assert "sin espacios" de 0065 test (Pitfall 2) |
| Frescura implícita vía `fecha_captura` (que ni siquiera viaja por la RPC) | `consultado_al` explícito en el jsonb | esta fase (D-04) | Habilita el footer `según fuente al …` de 128 |

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|-------|---------|--------------------|
| A1 | Las cifras del spike (95 urgencias / 10-de-49 boletines fuera de corpus / 39,7 KB) siguen vigentes al momento de ejecutar | §Summary, §Validation q6 | Solo afectan los valores esperados de la verificación manual, no el diseño. **Re-medir en el momento del apply** en vez de asertar el número exacto en el pgTAP (los datos de PROD cambian a diario) |
| A2 | El dominio de `tramitacion_evento.camara` en PROD se limita a `C.Diputados` / `C. Diputados` / `Senado` / NULL (de `0065:23-26`) | §Grafía única | Un valor no previsto cae al `else` del CASE y se emite normalizado-pero-crudo. **Mitigado por diseño** (nunca descartar). Verificar con `select distinct camara from tramitacion_evento;` antes de escribir el CASE |
| A3 | `pnpm test` de `app/` sigue verde sin cambios (esta fase no toca `app/`) | §Validation | Bajo — correrla igual como control |

## Open Questions (RESOLVED)

> **Cierre B-1 del plan-checker (2026-07-30):** las 5 preguntas fueron adjudicadas y FIRMADAS por
> el revisor Fable (gate obligatorio del roadmap; veredicto registrado en 127-CONTEXT.md §"Gate de
> Fable — FIRMADO"): (1) agenda_sala = sesiones con ítems anidados bajo `tabla` — FIRMADO;
> (2) sin `urgencia` en ítems de sala — FIRMADO; (3) doble enlace `enlace`+`enlace_evento` —
> FIRMADO (+M1: enlace también en anidados); (4) `fuente:{dataset,origen}`+`consultado_al` en el
> jsonb — FIRMADO (única vía con firma 0066 intocable); (5) función `grafia_camara` inmutable —
> FIRMADO. Blockers de Fable aplicados a los planes: supresión determinista (127-02 asserts 15-16),
> `left join public.proyecto == 6` (127-01), clave `descripcion` no `grado` (127-01).

1. **`agenda_sala`: la unidad del conteo contradice la unidad de D-02 — BLOQUEANTE de diseño**
   - Lo que sabemos: `conteo` = `count(*) from sesion_sala` futuras (0065:260-265) = **sesiones**. D-02 dice que los
     ítems son **ítems de tabla** (`sesion_tabla_item`). D-06 exige `total == jsonb_array_length(items)` y
     `conteo == total`. Con ítems de tabla la paridad se rompe estructuralmente (19 ítems vs 1-2 sesiones, spike E2.1).
   - Lo que no está claro: cuál de los dos LOCKED cede.
   - **Recomendación:** ceder D-02, honrar D-01/D-06 y el precedente de `agenda_citacion`: los ítems son **sesiones**
     `{fecha, camara, numero, hora_inicio, tipo, enlace, items:[{boletin,titulo,materia,posicion,quorum,parte_sesion,en_corpus}]}`
     con los ítems de tabla **anidados** (mismo patrón sub-select correlacionado que `agenda_citacion`). Así la
     paridad vale, la UI recibe todo lo que D-02 quería, y `numero`/`tipo`/`hora_inicio` van tal cual (NULL en la
     fila sintética `camara:sesion:2026-W31`, sin fabricar — CONTEXT §specifics). **Fable debe firmarlo.**

2. **`urgencia` en `sesion_tabla_item` NO EXISTE**
   - D-02 dice "(urgencia si la fuente la trae)". `sesion_tabla_item` tiene `quorum`, `alias`, `materia`,
     `parte_sesion` — **no `urgencia`** (0010:73-85).
   - **Recomendación:** emitir `quorum` y `parte_sesion`; **no fabricar** `urgencia`. La cláusula "si la fuente la
     trae" ya autoriza la omisión — es una confirmación, no un cambio de decisión.

3. **¿`enlace` del ítem = `p.enlace` (ficha del proyecto) o `te.enlace` (documento del evento)?**
   - `tramitacion_evento.enlace` existe (0008:76, "link al documento del evento", nullable). El spike E6 usa
     `p.enlace`. PANEL-02 (fase 128) quiere que el ítem enlace a `/proyecto/{b}#timeline`, un link **interno**
     construido por el helper central — o sea, ni uno ni otro.
   - **Recomendación:** emitir **ambos**: `enlace` = `p.enlace` (externo canónico del proyecto, para `en_corpus:false`
     el null es correcto) y `enlace_evento` = `te.enlace` cuando exista. El link interno lo arma 128 desde `boletin`.
     Coste marginal; evita que 128 tenga que volver a 0080.

4. **`fuenteLabel` desde dato: la RPC no re-emite `origen`/`dataset` — REPORTADO como pide el objetivo**
   - `actualidad_senales_panel` devuelve 9 columnas y ninguna es `origen`/`dataset`/`fecha_captura`/`enlace`
     (0066:32-42). La firma es intocable por Opción A.
   - **Recomendación:** clave `fuente: {dataset, origen}` dentro del jsonb (ver §0066). Sin ella, 128 hardcodea otra
     vez la etiqueta de fuente. **Decisión de Fable**, pero el coste de omitirla se paga en la fase siguiente.

5. **Función `actualidad.grafia_camara()` vs CASE inline ×3** — Claude's discretion (D-07) explícitamente delegada a
   Fable. Argumentos completos en §Grafía única. La función es un objeto nuevo pero no toca tabla/RPC/ACL/grant.

## Sources

### Primarias (HIGH — código del repo, leído completo)
- `supabase/migrations/0065_actualidad_senal.sql` (343 líneas) — el proc, los 6 bloques, las supresiones, el cron
- `supabase/migrations/0066_actualidad_rpc.sql` (57 líneas) — firma exacta de la RPC, 9 columnas
- `supabase/tests/0065_actualidad_senal.test.sql` (198 líneas) — `plan(17)`, siembra, asserts D1/D2/D3/WR-01/WR-02
- `supabase/migrations/0008_tramitacion.sql:19-109` — `proyecto`, `tramitacion_evento`, índices, RLS
- `supabase/migrations/0010_agenda.sql:19-99` — `citacion`, `citacion_punto`, `sesion_sala`, `sesion_tabla_item`
- `.planning/spikes/v13.0-spike-panel-arquitectura.md` — VEREDICTO Opción A, E1-E6
- `.planning/phases/127-.../127-CONTEXT.md` — D-01..D-12
- `.planning/ROADMAP.md:79-90` — 5 criterios de éxito de la fase
- `.planning/REQUIREMENTS.md:14,19` — PANEL-01, PANEL-06
- `.supabase-ops.yaml` — corpus vivo verificado contra PROD 2026-07-29
- `.planning/milestones/v12.0-phases/124-supa-fix.../124-SUPA-FIX.md:38,129,787-788` — runbook psql + `tr -d '\r'`
- `app/lib/anti-insinuacion-guard.test.ts:321-332,877-884` — `SUPERFICIES_PANEL` (solo `.tsx`, no SQL)

### Verificaciones ejecutadas en esta sesión
- `grep -rln "materializar_senales|actualidad_senal" supabase/` → 4 archivos (cero grants externos)
- `grep -n "actualidad|materializar" 0076/0077/0079` → vacío
- `ls supabase/migrations/ | tail` → 0079 es la última ⇒ **0080 libre, confirmado**
- `ls scripts/` + `grep pgtap package.json` → **no existe runner de pgTAP**

### Secundarias / terciarias
Ninguna. Fase codebase-internal por diseño; cero web research (conforme al objetivo).

## Metadata

**Desglose de confianza:**
- Mapa de 0065 / firma de 0066 / columnas de tablas: **HIGH** — lectura directa, líneas citadas
- Semántica de `create or replace` (owner/ACL/SET): **HIGH** — semántica documentada de Postgres, coherente con el uso ya existente en el repo
- Cifras de PROD (95 urgencias, 10/49, 39,7 KB): **MEDIUM** — heredadas del spike de hoy; re-medir al aplicar (A1)
- Pitfall 2 (el test de 0065 rompe): **HIGH** — el assert está citado literal; `Cámara de Diputados` contiene espacios

**Research date:** 2026-07-30
**Valid until:** hasta que cambie `0065`/`0066` o el schema de las 6 tablas fuente (es research de código, no de ecosistema — no caduca por tiempo)
