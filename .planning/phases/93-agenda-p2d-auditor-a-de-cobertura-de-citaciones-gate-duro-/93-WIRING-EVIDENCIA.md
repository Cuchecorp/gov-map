# Phase 93 — Evidencia de WIRING frontend de citaciones (BrowserOS sobre PROD)

**Fecha:** 2026-07-22
**Deploy PROD auditado:** `fa4d4369` (STATE) — base `https://observatorio-congreso.thevalis.workers.dev`
**Método:** DOM real (get_page_content / search_dom / get_page_links) sobre el deploy REAL, no análisis de código. Los sujetos son deterministas (elegidos por psql, § 0). `save_screenshot` puede fallar por CDP timeout → DOM primario.
**Alcance:** SOLO auditoría. Cero fixes de UI, cero writes al sitio. Los fixes son Phase 94.

> Regla LOCKED de la fase: esta fase NO toca UI. Aquí se DECLARA la brecha con evidencia; 94 la arregla.

---

## 0. Sujetos de prueba (deterministas, elegidos por psql PROD 2026-07-22)

**Ancla temporal:** `now()::date = 2026-07-22`, semana ISO vigente = **2026-W30**. El filtro `citacionVigente` (estado-actual-block.tsx:122-128) compara `fecha >= hoyChile` con `hoyChile = 2026-07-22` (día calendario Chile).

Queries verbatim re-ejecutables con `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "..."`.

### Sujeto A — semana pasada POBLADA (prueba /agenda histórico)

**`2026-W26`** — la semana ISO pasada con más citaciones en DB.

```sql
select semana_iso, count(*) from citacion where fecha < now() group by semana_iso order by 2 desc limit 5;
-- 2026-W26|53   2026-W28|32   2026-W30|26   2026-W29|23   2026-W27|2
select semana_iso, camara, count(*), min(fecha)::date, max(fecha)::date
  from citacion where semana_iso in ('2026-W26') group by semana_iso, camara order by 2;
-- 2026-W26|camara|32|2026-06-22|2026-06-24
-- 2026-W26|senado|21|2026-06-23|2026-06-24
```

- **Esperado en DB para W26:** 53 citaciones (32 Cámara + 21 Senado), fechas 22–24 junio 2026, agrupadas por día.
- **URL PROD a visitar:** `https://observatorio-congreso.thevalis.workers.dev/agenda?semana=2026-W26`

### Sujeto A' — semana VIGENTE (control)

**`2026-W30`** — 26 citaciones, TODAS Senado (Cámara W30 = 0 filas → esperado "No hay citaciones … Cámara" en su carril, gap de DATOS conocido, no wiring).

```sql
select camara, count(*) from citacion where semana_iso='2026-W30' group by camara;
-- senado|28   (26 con fecha en la ventana; Cámara ausente)
```

- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/agenda?semana=2026-W30`

### Sujeto B — boletín con citación SOLO-PASADA (prueba gap forward-only de la ficha)

**`18193-06`** — su ÚNICA citación es el **2026-07-21** (senado, "de Economía"), estrictamente ANTERIOR a hoy. Existe como proyecto. CERO filas en `sesion_tabla_item` → aísla el gap forward-only sin confundir con el gap de sala.

```sql
select cp.boletin, max(c.fecha)::date, count(*)
  from citacion_punto cp join citacion c on c.id=cp.citacion_id
  where cp.boletin is not null group by cp.boletin
  having max(c.fecha) < date '2026-07-22' order by 2 desc limit 10;
-- 18193-06|2026-07-21|1 (de Economía) ...
select c.camara, c.comision, c.fecha::date, c.semana_iso
  from citacion_punto cp join citacion c on c.id=cp.citacion_id where cp.boletin='18193-06';
-- senado|de Economía|2026-07-21|2026-W30
select count(*) from sesion_tabla_item where boletin='18193-06';  -- 0
select boletin, etapa, estado from proyecto where boletin='18193-06';
-- 18193-06|Primer trámite constitucional (Senado)|En tramitación
```

- **Esperado en DB:** 1 citación pasada (2026-07-21, Comisión de Economía del Senado).
- **Hipótesis (gap #1):** la ficha NO mostrará "Citado en … de Economía el 21-07-2026" porque `citacionVigente` filtra `fecha >= hoy` (2026-07-22 > 2026-07-21).
- **URL PROD:** `https://observatorio-congreso.thevalis.workers.dev/proyecto/18193-06`

### Sujeto C — boletín en sesion_tabla_item SIN citación (prueba gap sala-en-la-ficha)

**`13665-07`** — presente en la tabla de sala del Senado (sesiones 2026-07-07 = W28 y 2026-07-14 = W29), es proyecto, y tiene **0 citaciones** → aísla el gap "sesion_tabla_item no se lee en la ficha" sin confundir con citaciones.

```sql
select s.camara, s.fecha::date, to_char(s.fecha,'IYYY-"W"IW')
  from sesion_tabla_item sti join sesion_sala s on s.id=sti.sesion_id where sti.boletin='13665-07';
-- senado|2026-07-07|2026-W28
-- senado|2026-07-14|2026-W29
select count(*) from citacion_punto cp where cp.boletin='13665-07';  -- 0
select boletin, etapa, estado from proyecto where boletin='13665-07';
-- 13665-07|Primer trámite constitucional (Senado)|En tramitación
```

- **Esperado en DB:** el proyecto está en la tabla de sala del Senado (W28 y W29). Sin citaciones.
- **Hipótesis (gap #2):** la ficha NO declarará "está en la tabla de sala" (la ficha no lee `sesion_tabla_item`). Solo `/agenda?semana=2026-W28|2026-W29` lo muestra.
- **URLs PROD:** ficha `…/proyecto/13665-07` · sala `…/agenda?semana=2026-W29`

### Sujeto D (bonus, gap #1 con cruce) — `18337-12`

En sesion_tabla_item (W29) Y con citación. Es proyecto. Útil para ver si la ficha declara ALGO de agenda (esperado: no la tabla de sala; depende de si su citación es futura). Secundario a B/C.

---

<!-- Task 2 (BrowserOS): secciones 1-3 se llenan con DOM PROD real. -->
