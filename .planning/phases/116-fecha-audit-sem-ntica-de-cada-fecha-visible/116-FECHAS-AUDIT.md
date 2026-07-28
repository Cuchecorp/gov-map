---
phase: 116
titulo: Auditoría semántica de fechas
requirement: FECHA-01
consumido_por: [117, 125]
regimen: solo-lectura
ancla_temporal: 2026-07-28
timezone_del_servidor_prod: UTC
gates_observados:
  # Copiados de 113-INVENTARIO.md §5. La observación es HEREDADA del 2026-07-27;
  # esta fase NO tocó ningún flag para re-observarlos.
  fuente: "113-INVENTARIO.md §5"
  fecha_de_esa_observacion: 2026-07-27
  heredada: true
  MONEY: "OFF — /contraparte/[id] 404ea entera; contrato y aporte con 0 filas en PROD"
  NOTIF: "OFF — /cuenta inerte; suscripcion y consentimiento con 0 filas en PROD"
  CRUCES: "ON — superficie viva desde v4.0"
  VSIM: "ON — dossier firmado en v10.0"
fuentes:
  - 116-FORMATTERS.md
  - 116-PARCIAL-A.md
  - 116-PARCIAL-B.md
  - 113-INVENTARIO.md
---

# 116-FECHAS-AUDIT — Auditoría semántica de cada fecha visible

Artefacto rector de la Phase 116. Consolida el veredicto de código de los planes 01/02/03 y lo
**cruza contra el dato real de PROD**. **Régimen: SOLO LECTURA.** Cero DDL, cero DML, cero flag
tocado, cero cambio en `app/` ni en `packages/`. Todo fix va a Phase 117.

---

## 2. Cruce contra el dato real de PROD

### 2.0 Régimen de la consulta

- Invocación verbatim, una sola vez por lote:

  ```bash
  set -a; source .env; set +a
  PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"
  ```

- El valor de `SUPABASE_DB_URL` **jamás se imprime ni se escribe** en este archivo ni en ningún otro.
- **Cero DDL, cero DML**: todas las sentencias de esta sección son `SELECT`.
- **Todo conteo va por `psql -tA`**, nunca por REST (cap PostgREST de 1.000 filas).
- **Pitfall 8 (113 §1.4):** PROD tiene fechas corruptas en el futuro. Toda consulta de verificación
  del pasado filtra `fecha <= current_date`. Las consultas que auditan el futuro lo hacen
  explícitamente (`fecha > current_date`) y se declaran como tales — ver `### 2.6`.
- **Cero PII**: sobre `suscripcion`, `consentimiento`, `declaracion` y `contrato` solo se consultó
  `count(*)` y metadatos de columna. Cero `email`, cero `user_id`, cero RUT, cero monto individual.
- **Ancla temporal:** `select now()::date` ⇒ `2026-07-28`.
- **Zona horaria del servidor PROD:** `select current_setting('TimeZone')` ⇒ `UTC`. Esto es
  load-bearing para todo el veredicto de capa: los formatters sin `timeZone` explícita heredan UTC.
- **Cero requests a fuentes gubernamentales.** No se usó `curl` contra el deploy (refuerzo opcional
  del plan, no ejecutado); el mínimo obligatorio DB→código sí está completo. Declarado en `## 6.`.

### 2.1 Hallazgo estructural del cruce: el patrón "date-only disfrazado de `timestamptz`"

Este es el resultado que **reordena** los veredictos de los parciales A y B, y por eso se declara
antes de la tabla.

Los parciales dedujeron del schema que `votacion.fecha`, `tramitacion_evento.fecha` y
`lobby_audiencia.fecha` son `timestamptz` y concluyeron un "hallazgo de DÍA" masivo. PROD dice otra
cosa: **la mayoría de esas filas no lleva hora real**.

| columna | tipo real (PROD) | filas a medianoche UTC | filas con hora | total (`fecha <= current_date`) |
|---|---|---|---|---|
| `votacion.fecha` | `timestamp with time zone` | 1.049 | 3.806 | 4.855 |
| `tramitacion_evento.fecha` | `timestamp with time zone` | 44.569 | 3.797 | 48.366 |
| `lobby_audiencia.fecha` | `timestamp with time zone` | 0 (todas a las 04:00 UTC o más) | 17.762 | 17.762 |
| `citacion.fecha` | `timestamp with time zone` | 272 | 0 | 272 |
| `sesion_sala.fecha` | `timestamp with time zone` | 16 | 0 | 16 |
| `declaracion.fecha_presentacion` | `date` | n/a (tipo `date`) | n/a | 6 (sujeto D1165) |
| `parlamentario_militancia.desde` / `.hasta` | `date` | n/a (tipo `date`) | n/a | 2 (sujeto D1165) |

Query verbatim del patrón horario (repetida por tabla):

```sql
select count(*) filter (where fecha::time = '00:00:00') as medianoche_utc,
       count(*) filter (where fecha::time <> '00:00:00') as con_hora,
       count(*) as total
from votacion where fecha <= current_date;
```

**Cuantificación del corrimiento de día** (query verbatim):

```sql
select count(*) filter (where (fecha at time zone 'UTC')::date
                          <> (fecha at time zone 'America/Santiago')::date) as drift,
       count(*) as total
from votacion where fecha <= current_date;
```

| columna | `drift` bruto | de ese drift, filas **con hora real** | lectura |
|---|---|---|---|
| `votacion.fecha` | 1.076 / 4.855 | **27** | 1.049 del drift son las filas a medianoche UTC: convertirlas a Chile **fabricaría el día anterior**. Solo **27 filas** (0,56 %) son votaciones nocturnas reales cuyo día visible hoy corre |
| `tramitacion_evento.fecha` | 44.596 / 48.366 | **27** | idéntico patrón: 44.569 son medianoche UTC (date-only disfrazada) |
| `lobby_audiencia.fecha` | **0** / 17.762 | 0 | las audiencias se almacenan a las 04:00 UTC (= 00:00 en Chile). El día UTC **coincide siempre** con el día chileno |
| `citacion.fecha` | 272 / 272 | 0 | 100 % medianoche UTC ⇒ el contrato date-only LOCKED está confirmado por el dato |
| `sesion_sala.fecha` | 16 / 16 | 0 | idem |
| `cruce_senal.evidencia->'items'[].fecha` | **0** / 2.713 ítems | 0 | hereda `lobby_audiencia.fecha` (mismas 04:00 UTC). **Resuelve el `pendiente de confirmar por SQL` de `116-PARCIAL-A.md` §A.2.1** |

Query verbatim del último caso:

```sql
select count(*) as n_items,
       count(*) filter (where (e->>'fecha')::timestamptz::date
                          <> ((e->>'fecha')::timestamptz at time zone 'America/Santiago')::date) as drift
from cruce_senal cs, lateral jsonb_array_elements(cs.evidencia->'items') e
where e ? 'fecha' and coalesce(e->>'fecha','') <> '';
```

**Consecuencias para los veredictos heredados:**

1. El "hallazgo de DÍA" de **E-002 / E-020 / E-041 / E-053 / E-044** (`lobby_audiencia.fecha` y su
   derivada en `cruce_senal`) **NO se materializa en PROD**: drift = 0 sobre 17.762 + 2.713 filas.
   Se degrada de hallazgo a **riesgo latente de capa** (`fechaCorta` sin `timeZone`).
2. El "hallazgo de DÍA" de **E-001 / E-056 / E-008** (`votacion.fecha`) **sí existe pero es acotado**:
   **27 filas**, todas votaciones que cruzaron la medianoche UTC. Ejemplo verificable
   (`boletin` 16330-05, `2023-11-17 00:14:41+00`): el sitio muestra `17 nov 2023`, el día chileno del
   hecho fue el **16 de noviembre de 2023**.
3. El mismo caso aplica a **E-010 / E-032 / E-038 / E-045** (`tramitacion_evento.fecha`): 27 filas.
4. **Convertir de zona estas columnas sería PEOR que no hacerlo**: rompería las 44.569 + 1.049 filas
   almacenadas a medianoche UTC (regla LOCKED 3). El fix de 117 **no** es "aplicar `America/Santiago`";
   es distinguir por presencia de hora, o normalizar el dato en ingesta.

### 2.2 Tabla de cruce por superficie

Columnas: `superficie (ruta) | sujeto | fecha auditada | query verbatim | valor observado en PROD |
lo que el formatter renderiza | etiqueta que el sitio afirma | ¿coincide la semántica?`

| superficie (ruta) | sujeto | fecha auditada (columna/RPC) | query verbatim | valor observado en PROD | lo que el formatter renderiza | etiqueta que el sitio afirma | ¿coincide la semántica? |
|---|---|---|---|---|---|---|---|
| `/parlamentario/[id]` | **D1165** (113 §1) | `votacion.fecha` vía `voto` | `select count(*), min(v.fecha)::text, max(v.fecha)::text, max(v.fecha_captura)::text from voto vo join votacion v on v.id=vo.votacion_id where vo.parlamentario_id='D1165' and v.fecha <= current_date;` | `3752 \| 2022-03-22 13:16:49+00 \| 2026-07-22 19:18:29+00 \| 2026-07-27 21:38:09.718+00` | `fechaCortaSegura` ⇒ `22 jul 2026` (día UTC) | `(sin rótulo)` — la fecha va sola en `font-mono` (`votos-por-parlamentario.tsx:528`) | **sí** para este sujeto: las 3.752 votaciones de D1165 no incluyen ninguna de las 27 nocturnas. La ausencia de rótulo es debilidad de copy, no de dato |
| `/parlamentario/[id]` | **D1165** | `votacion.fecha_captura` (badge) | misma query, columna 4 | `2026-07-27 21:38:09.718+00` | `relativeTimeEs` ⇒ `Actualizado hace 1 día` | `Actualizado {…}` (`provenance-badge.tsx:90`) | **no** — la captura del 27-jul describe cuándo miramos, no cuándo se votó (el hecho más reciente es del 22-jul). Distancia real observada: **5 días**. Hallazgo F-01 |
| `/parlamentario/[id]` | **D1165** | `lobby_audiencia.fecha` | `select count(*), max(fecha)::text, max(fecha_captura)::text, count(*) filter (where (fecha at time zone 'UTC')::date <> (fecha at time zone 'America/Santiago')::date) as drift from lobby_audiencia where parlamentario_id='D1165' and fecha <= current_date;` | `112 \| 2026-06-12 04:00:00+00 \| 2026-06-22 19:17:48.929+00 \| 0` | `fechaCorta` ⇒ `12 jun 2026` | `(sin rótulo)` (`lobby-de-parlamentario.tsx:441`) | **sí** — drift 0/112. El 04:00 UTC es medianoche chilena: el día UTC ES el día del hecho. El hallazgo de DÍA que dedujo el parcial A **queda refutado por el dato** |
| `/parlamentario/[id]` | **D1165** | `declaracion.fecha_presentacion` (`date`) | `select count(*), max(fecha_presentacion)::text, max(fecha_captura)::text from declaracion where parlamentario_id='D1165' and fecha_presentacion <= current_date;` | `6 \| 2026-03-31 \| 2026-07-23 12:29:45.683+00` | `fechaCortaSegura` ⇒ `31 mar 2026` | `Presentada el {fecha}` | **sí** — tipo `date` puro, rótulo explícito del hecho. Sin hallazgo |
| `/parlamentario/[id]` | **D1165** | `parlamentario_militancia.desde` / `.hasta` (`date`) | `select desde::text, coalesce(hasta::text,'NULL-vigente') from parlamentario_militancia where parlamentario_id='D1165' order by desde;` | `2022-03-11 \| 2026-03-10` y `2026-03-11 \| 2030-03-10` | `fechaCorta` ⇒ `11 mar 2022 – 10 mar 2026` | `{desde} – {hasta}` / `{desde} – vigente` | **sí** — tipo `date`. **Nota:** ninguna de las 2 militancias tiene `hasta` NULL, así que la rama honesta `vigente` no se ejercita con este sujeto; el `hasta` de la vigente es una fecha **futura** (2030-03-10), correcta por ser el término del período |
| `/parlamentario/[id]` | **D1165** | `cruce_senal.fecha_captura` | `select count(*), min(fecha_captura)::text, max(fecha_captura)::text from cruce_senal where parlamentario_id='D1165';` | `11 \| 2026-07-28 03:23:00.035505+00 \| 2026-07-28 03:23:00.035505+00` | `relativeTimeEs` ⇒ `Actualizado hace 10 h` | `Actualizado {…}` | **no** — min = max al microsegundo: es el `now()` de un **FULL REBUILD** del pipeline, no de la fuente. El badge dice "actualizado hace 10 h" de un cruce cuya reunión ocurrió el 2025-04-10. Hallazgo F-02 |
| `/parlamentario/[id]` | **D1165** | `cruce_senal.evidencia->'items'[].fecha` (hecho) | ver query de `### 2.1` (último bloque) | `2713 ítems \| drift 0`; muestra `"2025-04-10T04:00:00+00:00"` | `fechaCorta` ⇒ `10 abr 2025` | `Reunión registrada el {fecha}` | **sí** — hereda las 04:00 UTC de lobby. Resuelve el `pendiente` de A.2.1 |
| `/parlamentario/[id]` | **D1165** | `parlamentario.fecha_captura` (header) | `select id, fecha_captura::text from parlamentario where id in ('D1165','S1338') order by id;` | `D1165 \| 2026-07-22 13:36:10.214+00` | `relativeTimeEs` ⇒ `Actualizado hace 6 días` | `Actualizado {…}` (`parlamentario-header.tsx:116`) | **no** — mismo idiom no aprobado del chokepoint. Hallazgo F-01 |
| `/parlamentario/[id]` | **S1338** (senador, estados vacíos) | conteo por bloque | `select (select count(*) from voto vo join votacion v on v.id=vo.votacion_id where vo.parlamentario_id='S1338' and v.fecha<=current_date) as votos, (select count(*) from lobby_audiencia where parlamentario_id='S1338' and fecha<=current_date) as lobby, (select count(*) from declaracion where parlamentario_id='S1338') as declaraciones, (select count(*) from cruce_senal where parlamentario_id='S1338') as cruces, (select count(*) from parlamentario_militancia where parlamentario_id='S1338') as militancias;` | `949 \| 0 \| 9 \| 0 \| 1` | bloques `lobby` y `cruces`: **cero fecha renderizada** (empty-state) | empty-state honesto, sin fecha fabricada | **sí** — la degradación no inventa fecha. Coincide con 113 §1 (PK `'S1338'`, jamás `1338`) |
| `/parlamentario/[id]` | **S1338** | `parlamentario.fecha_captura` | misma query que la fila 8 | `S1338 \| 2026-07-27 00:10:53.196+00` | `relativeTimeEs` ⇒ `Actualizado hace 1 día` | `Actualizado {…}` | **no** — hallazgo F-01, idéntico a D1165 |
| `/proyecto/[boletin]` | **14309-04** (bicameral) | `tramitacion_evento.fecha` + `.fecha_captura` | `select (select count(*) from tramitacion_evento where boletin='14309-04' and fecha<=current_date), (select max(fecha)::text from tramitacion_evento where boletin='14309-04' and fecha<=current_date), (select max(fecha_captura)::text from tramitacion_evento where boletin='14309-04');` | `99 \| 2026-07-07 00:00:00+00 \| 2026-07-09 04:37:00.302+00` | hecho: `fechaCorta` ⇒ `7 jul 2026`; badge: `relativeTimeEs(max(fecha_captura))` | hecho `(sin rótulo)`; badge `Actualizado {…}` junto a `<h2>Tramitación</h2>` | hecho **sí** (93/99 a medianoche UTC, 0 drift real); badge **no** — es un **MAX de capturas** del set: hallazgo F-03 |
| `/proyecto/[boletin]` | **14309-04** | `votacion.fecha` / `.fecha_captura` | `select count(*), max(fecha)::text, max(fecha_captura)::text from votacion where boletin='14309-04' and fecha<=current_date;` (+ query de drift de `### 2.1` filtrada por boletín) | `7 \| 2026-05-11 19:21:07+00 \| 2026-07-09 04:37:00.302+00`; **drift real = 0** | `fechaCorta` ⇒ `11 may 2026` | `(sin rótulo)` (`votacion-card.tsx:39`) | **sí** para este sujeto — 0 de sus 7 votaciones cae en las 27 nocturnas |
| `/proyecto/[boletin]` | **14309-04** | `source_snapshot.fetched_at` | `select count(*) from source_snapshot where resource like '%14309-04%';` | **`0` filas — este boletín no tiene snapshot en `source_snapshot`** | el bloque "Respaldo R2" **no se renderiza** | ninguna | **sí — degradación honesta**: sin snapshot no hay fecha que mostrar y el componente omite el bloque. Causa declarada, no sustituida por otro sujeto |
| `/proyecto/[boletin]` | **14309-04** | `proyecto.fecha_captura` (header + validación) | `select fecha_captura::text from proyecto where boletin='14309-04';` | `2026-07-09 04:36:36.089+00` | `formatFechaCaptura` (`timeZone: America/Santiago`) ⇒ `9 jul 2026` | `según fuente al {fecha}` (`validacion-fuente.tsx:140`) | **sí** — único emisor del carril proyecto con el idiom aprobado. `timestamptz` real ⇒ convertir a Chile es correcto. Sin hallazgo |
| `/proyecto/[boletin]` | **17870-05** (solo-Senado) | `tramitacion_evento.fecha` | `select count(*), max(fecha)::text from tramitacion_evento where boletin='17870-05' and fecha<=current_date;` + `select boletin, count(*) filter (where fecha::time='00:00:00'), count(*) from tramitacion_evento where boletin in ('14309-04','17870-05') and fecha<=current_date group by boletin;` | `355 \| 2026-01-05 00:00:00+00`; patrón `245` a medianoche de `355` | `fechaCorta` ⇒ `5 ene 2026` | `Último hito: {descripcion} — {fecha}` (`estado-actual-block.tsx:397`) | **sí** — rótulo explícito del hecho; 0 drift real en el sujeto |
| `/proyecto/[boletin]` | **17870-05** | `votacion.fecha` (256 votaciones) | `select count(*), max(fecha)::text from votacion where boletin='17870-05' and fecha<=current_date;` | `256 \| 2025-11-26 20:32:50+00` | `fechaCorta` ⇒ `26 nov 2025` | `(sin rótulo)` | **sí** — drift real 0/256 (query de `### 2.1` filtrada por boletín) |
| `/proyecto/[boletin]` | **17870-05** | `proyecto.prm_id_camara` (control del sujeto) + `.fecha_captura` | `select boletin, prm_id_camara is null as sin_prm, camara_origen from proyecto where boletin in ('14309-04','17870-05');` y `select fecha_captura::text from proyecto where boletin='17870-05';` | `17870-05 \| t \| C.Diputados`; captura `2026-07-10 08:48:50.781+00` | `formatFechaCaptura` ⇒ `10 jul 2026` | `según fuente al {fecha}` | **sí** — el sujeto es el solo-Senado esperado por 113 §1 (`prm_id_camara IS NULL`) |
| `/proyecto/[boletin]` | **17870-05** | `source_snapshot.fetched_at` | `select resource, count(*), max(fetched_at)::text from source_snapshot where resource like '%17870-05%' group by resource;` | `17870-05 \| 1 \| 2026-07-10 08:54:26.531+00` | `formatFetchedAt` ⇒ `10 jul 2026` | `Respaldo del {fecha} · hash {…}` + `Esto decía la fuente ese día.` | **sí** — equivalente aprobado del idiom: declara el scraping como scraping. Sin hallazgo |
| `/proyecto/[boletin]` | **14309-04** / **17870-05** | fecha de urgencia (`estado-actual-block.tsx:429`) | `select max(fecha_captura)::text from tramitacion_evento where boletin='14309-04';` | `2026-07-09 04:37:00.302+00` | `fechaCorta(urgenciaFuente.fechaCaptura)` | `según {fuente} al {fecha}.` | **sí** — **contraejemplo CONFIRMADO**: el idiom aprobado ya está en producción. Único matiz: es un MAX del set (mismo eje que F-03) |
| `/agenda` | **2026-W26** (sujeto nuevo: semana ISO con más citaciones con `fecha <= current_date`; desempate por `semana_iso desc`) | `citacion.fecha` | `select semana_iso, count(*) as n, min(fecha)::text, max(fecha)::text, count(*) filter (where fecha::time='00:00:00') as medianoche_utc from citacion where fecha <= current_date group by semana_iso order by n desc, semana_iso desc limit 3;` | `2026-W26 \| 53 \| 2026-06-22 00:00:00+00 \| 2026-06-24 00:00:00+00 \| 53` | `dayLabelCitacion` ⇒ `Lunes 22 de junio` | `{dayLabel}` como cabecera de día | **sí** — **el tipo de columna es `timestamp with time zone`, pero el 100 % de los valores está a medianoche UTC**: es date-only de facto. `diaCalendarioCitacion` (`toISOString().slice(0,10)`) devuelve exactamente el día publicado. Regla LOCKED 3 confirmada por el dato |
| `/agenda` | **2026-W26** | `citacion.fecha_captura` / `sesion_sala.fecha_captura` | `select count(*) filter (where fecha::time='00:00:00'), count(*), count(*) filter (where (fecha at time zone 'UTC')::date <> (fecha at time zone 'America/Santiago')::date) from sesion_sala where fecha <= current_date;` | `sesion_sala: 16 \| 16 \| 16` (100 % medianoche UTC) | `relativeTimeEs` vía badge | `Actualizado {…}` | **no** — idiom no aprobado del chokepoint. Hallazgo F-01 |
| `/` (home) | panel de actualidad | `actualidad_senal.fecha_max` por tipo | `select tipo_senal, count(*), max(fecha_max)::text, max(fecha_captura)::text, count(*) filter (where fecha_max::time='00:00:00') from actualidad_senal group by tipo_senal order by 1;` | `agenda_citacion 1 \| 2026-08-10 …` (1/1 medianoche); `agenda_sala 1 \| 2026-08-05 …` (1/1); `agrupacion_materia 10 \| (fecha_max NULL) \| 0`; `archivados 1 \| 2026-07-06` (1/1); `nuevos_ingresos 1 \| 2026-07-27` (1/1); `urgencias 1 \| 2026-07-22` (1/1); `velocity 3 \| 2026-07-27` (3/3) | `agenda_*` ⇒ `diaCalendarioCitacion` (ISO `2026-08-10`); resto ⇒ `fechaCorta`; `agrupacion_materia` ⇒ rótulo **omitido** (`fecha_max` NULL) | `{rotulo}` dentro del tile | **sí** en el ruteo: cero señal `agenda_*` cae en `fechaCorta`. **Hallazgo de dato:** **todas** las señales, no solo las `agenda_*`, tienen `fecha_max` a medianoche UTC ⇒ el ruteo por tipo es correcto pero la rama `fechaCorta` está formateando date-only de facto (riesgo latente). El `null` de `agrupacion_materia` se omite honestamente |
| `/buscar` | `q = "educación"` (determinista, acotado a `titulo ilike`) | `proyecto.fecha_captura` que alimenta `RPC:match_proyectos` / `RPC:buscar_proyectos_hibrido` | `select count(*), min(fecha_captura)::text, max(fecha_captura)::text from proyecto where titulo ilike '%educación%';` | `134 \| 2026-07-09 04:41:15.331+00 \| 2026-07-10 18:34:34.404+00` | `relativeTimeEs` ⇒ `Actualizado 9 jul 2026` (≥7 d ⇒ delega en `fechaCorta`) | `Actualizado {…}` en cada `SearchResultCard` | **no** — idiom no aprobado. Hallazgo F-01. Además el chip `anio` de `search-result-card.tsx:71` **no recibe valor de ningún call-site de producción** ⇒ inerte (F-08) |
| `/comparar` | par **D1165** + **D1012** (113 §5) | `coincidencia_votos_par.fecha_captura_max` | `select count(*) as votaciones_compartidas, max(v.fecha_captura)::text as fecha_captura_max, max(v.fecha)::text as fecha_hecho_max from votacion v where v.id in (select vo.votacion_id from voto vo where vo.parlamentario_id='D1165') and v.id in (select vo.votacion_id from voto vo where vo.parlamentario_id='D1012');` | `3692 \| 2026-07-27 21:38:09.718+00 \| 2026-07-22 19:18:29+00` | `String(...).slice(0,10)` ⇒ `2026-07-27` | `Fuente: votaciones de Cámara y Senado · según fuente al {fecha}.` | **sí** — **confirmado por SQL que `fecha_captura_max` es un MAX de fechas de CAPTURA, no de votación**: 2026-07-27 (captura) ≠ 2026-07-22 (último hecho). Y el copy usa el idiom aprobado. Sin hallazgo |
| `/contraparte/[id]` | **no elegible** (113 §1 sujeto E) | `contrato.fecha_oc`, `contrato.fecha_corte`, `aporte.fecha_aporte`, `aporte.fecha_corte`, `*_ingesta_estado.ingestado_hasta` | `select 'contrato' t, count(*) from contrato union all select 'aporte', count(*) from aporte;` | `contrato \| 0` y `aporte \| 0` | ninguna — la ruta **404ea entera** con MONEY OFF (`contraparte/[id]/page.tsx:50-51`) | ninguna | **degradación honesta declarada**: `0 filas — contrato y aporte vacíos en PROD`. El veredicto de **E-013, E-014, E-015, E-016, E-060** queda **respaldado solo por código**. Verificado **sin tocar ningún flag** y sin pedir la ruta al deploy. Límite registrado en `## 6.` |
| `/cuenta` | gate NOTIF OFF | `suscripcion.created_at`, `consentimiento.created_at` — **solo TIPO y conteo agregado** | `select table_name\|\|'.'\|\|column_name\|\|' = '\|\|data_type from information_schema.columns where table_schema='public' and (table_name,column_name) in (('suscripcion','created_at'),('consentimiento','created_at'));` y `select 'suscripcion' t, count(*) from suscripcion union all select 'consentimiento', count(*) from consentimiento;` | tipos: ambos `timestamp with time zone`; conteos: `suscripcion \| 0`, `consentimiento \| 0` | `fechaCorta` local de `/cuenta` (`timeZone: America/Santiago`, locale `en-CA`) | `Consentimiento registrado el {fecha}` / `Suscrito el {fecha}` | **sí** por tipo — `timestamptz` real de un acto del propio usuario ⇒ convertir a Chile es correcto. **Cero PII consultada**: no se seleccionó `email`, `user_id` ni valor de fila alguno. Sin filas que cruzar; veredicto respaldado por código + tipo |

### 2.3 Cierre del cruce

- Superficies obligatorias del plan: **10**. Superficies con al menos una fila: **10**. Omitidas: **0**.
- Filas de cruce: **26**. Filas con valor `—` sin causa declarada: **0**.
- Sujetos de 113 §1 reutilizados: **D1165, S1338, 14309-04, 17870-05** y el par **D1165 + D1012**.
- Sujeto nuevo elegido (solo donde 113 no fijó uno): **`/agenda` ⇒ semana ISO `2026-W26`**, criterio
  determinista `order by count(*) desc, semana_iso desc`.
- Sujeto declarado **no elegible**: `/contraparte/[id]` (113 §1 sujeto E) — 0 filas en PROD.
- Queries que devolvieron `0 filas`: **3** (`source_snapshot` de 14309-04; `contrato`/`aporte`;
  `suscripcion`/`consentimiento`). Las tres se registran con su causa; **ninguna** se sustituyó por
  otro sujeto.

### 2.4 Veredictos de los parciales que el cruce MODIFICA

| veredicto heredado | fuente | qué dice PROD | resolución |
|---|---|---|---|
| `lobby_audiencia.fecha` ⇒ "hallazgo de DÍA" | `116-PARCIAL-A.md` §A.2.1 (E-002) y `116-PARCIAL-B.md` §B.0 (E-020, E-041) | drift **0 / 17.762** — todas las filas a las 04:00 UTC = 00:00 Chile | **degradado a riesgo latente de capa**. No es hallazgo de dato; el copy sin rótulo sí sigue siendo hallazgo aparte (F-06) |
| `cruces_de_parlamentario.fecha` ⇒ `pendiente de confirmar por SQL` | `116-PARCIAL-A.md` §A.2.1 última fila | `evidencia->'items'[].fecha`: 2.713 ítems, drift **0**; hereda lobby | **RESUELTO: cumple.** Cero conversión de zona, cero corrimiento |
| `votacion.fecha` ⇒ "hallazgo de DÍA" (magnitud desconocida) | `116-PARCIAL-A.md` §A.2.1 (E-001), `116-PARCIAL-B.md` (E-056) | drift real acotado a **27 filas** de 4.855 | **CONFIRMADO y cuantificado** ⇒ F-05 |
| `tramitacion_evento.fecha` ⇒ ambigüedad de DÍA | `116-PARCIAL-B.md` §B.0 | 44.569 / 48.366 a medianoche UTC; drift real **27** | **CONFIRMADO y cuantificado** ⇒ F-05. Con la advertencia dura de que convertir a Chile rompería 44.569 filas |
| `page.tsx:504` ⇐ `source_snapshot.fecha_captura` | `116-FORMATTERS.md` §2.2 fila 1 | el `reduce` de `page.tsx:492-497` corre sobre `TramitacionEventoRow[]`; además `source_snapshot` **no tiene columna `proyecto_id`** ni `fecha_captura` (solo `fetched_at`), así que la atribución era imposible | **atribución corregida a `tabla.tramitacion_evento.fecha_captura`**, según `116-PARCIAL-B.md` nota ¹. Ver `### 1.2` |
| `lobby_en_tramitacion` lee `.fecha` | `116-03-PLAN.md` `<interfaces>` | el código lee `row.fecha_reunion` (`lobby-en-tramitacion.tsx:123`) | **corregido**: la columna es `lobby_en_tramitacion.fecha_reunion`. Ver `### 1.2` |

### 2.5 Verificación de higiene de esta sección

| compuerta | comando | resultado |
|---|---|---|
| cero credenciales | `grep -cE 'postgres(ql)?://' 116-FECHAS-AUDIT.md` | `0` |
| cero RUT | `grep -cE '[0-9]{7,8}-[0-9kK]' 116-FECHAS-AUDIT.md` | `0` (los boletines `14309-04` / `17870-05` tienen 5 dígitos ⇒ no matchean) |
| cero email de persona natural | `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' 116-FECHAS-AUDIT.md \| sort -u` | sin match |
| cero código de producto tocado | `git status --porcelain app/ packages/` | vacío |
| cero flag movido | `git diff --quiet -- .env .env.example` | limpio |

### 2.6 Fechas futuras encontradas (Pitfall 8)

Query verbatim (auditoría explícita del futuro, complementaria al filtro `fecha <= current_date`):

```sql
select 'tramitacion_evento' t, count(*) from tramitacion_evento where fecha > current_date
union all select 'votacion', count(*) from votacion where fecha > current_date
union all select 'citacion', count(*) from citacion where fecha > current_date
union all select 'lobby_audiencia', count(*) from lobby_audiencia where fecha > current_date;
```

| tabla | filas con `fecha > current_date` | ¿corrupta o legítima? |
|---|---|---|
| `citacion` | 17 | **legítimas** — `select min(fecha)::text, max(fecha)::text, count(*) from citacion where fecha > current_date;` ⇒ `2026-08-03 … \| 2026-08-10 … \| 17`, semanas `2026-W32` y `2026-W33`. `/agenda` **debe** mostrar el futuro: es su función. Filtrarlas sería el bug |
| `tramitacion_evento` | 2 | **CORRUPTAS** — `select boletin, fecha::text from tramitacion_evento where fecha > current_date order by fecha desc limit 5;` ⇒ 2 filas del boletín `18232-25` con fecha `2626-05-25 00:00:00+00`. Es el Pitfall 8 canónico. **Y SÍ es visible**: `tramitacion_evento` alimenta el timeline, el stepper y `estado-actual-block`, ninguno de los cuales filtra por `fecha <= current_date` ⇒ hallazgo **F-04** |
| `votacion` | 0 | — |
| `lobby_audiencia` | 0 | — |
