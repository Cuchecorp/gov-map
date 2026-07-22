# 93 — AUDITORÍA de cobertura de citaciones (gate duro de 94)

**Fase:** 93-agenda-p2d-auditor-a-de-cobertura-de-citaciones-gate-duro-
**Re-medición:** 2026-07-22 (Plan 01)
**Fuente de las cifras DB:** psql `-tA` directo contra PROD (`$SUPABASE_DB_URL` de `.env`, `PGCLIENTENCODING=UTF8`). NUNCA vía REST del sitio (cap 1k PostgREST subestimaría — Pitfall 4 del research).
**Principio rector:** **cobertura parcial declarada, NUNCA presentada como completa.** Cada celda declara THIN o AL DÍA-en-su-ventana con justificación; ningún número se presenta como "cobertura completa". "Estado ausente ≠ vigente confirmado" (no se fabrica vigencia).

> Este reporte compone las secciones **medibles** (matriz N/M, veredictos de endpoints, hallazgos confirmados/refutados, estado de cancelación, frescura). El wiring frontend con evidencia BrowserOS lo escribe **Plan 02**; la DECLARACIÓN de cobertura + el backfill acotado los cierra **Plan 03**.

---

## 1. Matriz N/M por celda

Re-medición 2026-07-22 con `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"`. **Las 4 celdas re-corrieron idénticas al research 2026-07-22 — CERO deriva** (mismo día; las ventanas forward-only aún no se habían desplazado respecto de la sesión de research).

### 1.1 Matriz principal N + rango de fecha

Query verbatim que produjo cada N y cada rango:

```sql
select 'citacion_'||camara, count(*), min(fecha)::date, max(fecha)::date from citacion group by camara
union all
select 'sesion_sala_'||camara, count(*), min(fecha)::date, max(fecha)::date from sesion_sala group by camara
order by 1;
```

Resultado RE-MEDIDO (verbatim, 2026-07-22):

```
citacion_camara|34|2026-06-22|2026-07-07
citacion_senado|104|2026-06-23|2026-07-24
sesion_sala_camara|1|2026-06-22|2026-06-22
sesion_sala_senado|11|2026-06-23|2026-07-15
```

### 1.2 Matriz N/M — las 4 celdas {sala, comisiones} × {Cámara, Senado}

| Celda | N (DB) | M (universo hoy) | Rango DB (min→max fecha) | Fuente M | Veredicto cobertura |
|-------|--------|------------------|--------------------------|----------|---------------------|
| **comisiones × Cámara** | **34 citaciones** | histórico completo navegable por semana ISO (∞ semanas desde el inicio del período); ~20–40 citaciones/semana (estimación de 2 semanas sondeadas, no censo — Assumption A4 del research) | 2026-06-22 → 2026-07-07 | `citaciones_semana.aspx?prmSemana=AAAA-NN` (UP, **histórico confirmado** — Probe 4b) | **THIN** — solo **2 semanas ISO** capturadas (W26=32, W28=2); el universo histórico navegable NO está ingerido |
| **comisiones × Senado** | **104 citaciones** | ventana **forward-only** de hoy (~20 citaciones, 22/07→05/08); sin universo histórico por la fuente | 2026-06-23 → 2026-07-24 | `web-back.senado.cl/api/commissions_citations` (UP, **forward-only** — Probe 1) | **AL DÍA en su ventana** — 5 semanas ISO acumuladas (W26–W30); sin histórico *posible* por la fuente (no es un bug de ingesta) |
| **sala × Cámara** | **1 sesión / 19 items** | 1 PDF vigente/semana (`verDoc prmId=0`, solo la semana en curso); histórico de PDFs exigiría enumerar `prmId≠0` (fuera de alcance) | 2026-06-22 (única sesión) | `verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` → DeepSeek (UP, solo vigente — Probe 5) | **THIN** — 1 sola sesión ingerida; sin histórico estructurado (solo el PDF vigente, no estructurado → DeepSeek) |
| **sala × Senado** | **11 sesiones / 27 items** | ventana **forward-only** de hoy (~3 sesiones en curso); sin histórico por la fuente | 2026-06-23 → 2026-07-15 | `web-back.senado.cl/api/weekly_table` (UP, **forward-only** — Probe 2) | **AL DÍA en su ventana** — sin histórico *posible* por la fuente |

**Lectura honesta:** las dos celdas **Cámara** (comisiones y sala) son **THIN** por sub-ingesta (el universo existe y es alcanzable — Cámara tiene histórico); las dos celdas **Senado** están **AL DÍA en su ventana** — su límite es la FUENTE (forward-only), NO el conector (Pitfall 1: no confundir forward-only de la fuente con bug de ingesta).

### 1.3 % cruzable a boletín (cruce a la ficha del proyecto)

Query verbatim:

```sql
select c.camara, count(*) puntos, count(cp.boletin) con_boletin from citacion_punto cp join citacion c on c.id=cp.citacion_id group by c.camara;
select s.camara, count(*) items, count(sti.boletin) con_boletin from sesion_tabla_item sti join sesion_sala s on s.id=sti.sesion_id group by s.camara;
```

Resultado RE-MEDIDO (verbatim, 2026-07-22):

```
-- citacion_punto por camara:
camara|35|35
senado|139|98
-- sesion_tabla_item por camara:
senado|27|22
camara|19|15
```

| Celda | Puntos/Items | Con boletín | % cruzable a ficha |
|-------|--------------|-------------|--------------------|
| citacion_punto × Cámara | 35 | 35 | **100 %** |
| citacion_punto × Senado | 139 | 98 | **~71 %** |
| sesion_tabla_item × Cámara | 19 | 15 | **~79 %** |
| sesion_tabla_item × Senado | 27 | 22 | **~81 %** |

Nota (consistencia con el CONTEXT): total de puntos con-boletín = 35 (Cámara) + 98 (Senado) = **133**, idéntico al `citacion_punto con boletín=133` del CONTEXT. Los ~29 % de puntos Senado sin boletín son citaciones de comisión sin proyecto asociado en el punto (audiencias, cuenta), no un fallo de parseo.

### 1.4 Estado de cancelación/reagendo poblado

Query verbatim:

```sql
select camara, count(*) total, count(estado) con_estado from citacion group by camara;
```

Resultado RE-MEDIDO (verbatim, 2026-07-22):

```
camara|34|3
senado|104|6
```

| Celda | Total | Con `estado` no-null | % con estado poblado |
|-------|-------|----------------------|----------------------|
| Cámara | 34 | 3 | **~9 %** |
| Senado | 104 | 6 | **~6 %** |

**Implicación para 94 (modelado honesto):** la mayoría de citaciones **NO** tienen estado de cancelación poblado. El bajo % es porque la mayoría de citaciones **no fueron canceladas** (dato honesto), NO un bug de ingesta. `SIN_EFECTO=1` del Senado se mapea a `estado="Sin efecto"` (`parse-senado-citaciones.ts:96,132`); Cámara lo lee de `<p style="color:red">` (`parse-camara-citaciones.ts:197`). **94 DEBE declarar que "estado ausente ≠ vigente confirmado"** — no fabricar vigencia a partir de la ausencia de una marca de cancelación.

### 1.5 Semanas ISO distintas cubiertas

Query verbatim:

```sql
select camara, count(distinct semana_iso) from citacion group by camara;
```

Resultado RE-MEDIDO (verbatim, 2026-07-22):

```
camara|2
senado|5
```

| Celda | Semanas ISO distintas | Cuáles (verbatim) |
|-------|----------------------|-------------------|
| citacion × Cámara | **2** | W26 (32 citaciones), W28 (2) |
| citacion × Senado | **5** | W26 (21), W27 (2), W28 (30), W29 (23), W30 (28) |

Query de detalle (verbatim, para reproducir el desglose por semana):

```sql
select camara, semana_iso, count(*) from citacion group by camara, semana_iso order by camara, semana_iso;
```

**Lectura:** Cámara tiene un hueco entre W26 y W28 (W27 vacía) y solo 2 semanas — coherente con el veredicto THIN. Senado cubre 5 semanas contiguas (su ventana forward acumulada de las corridas del cron).

---
