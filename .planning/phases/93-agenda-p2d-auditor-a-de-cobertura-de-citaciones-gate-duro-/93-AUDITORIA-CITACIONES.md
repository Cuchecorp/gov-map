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

## 2. Veredictos de endpoints (re-sondeo curl 2026-07-22)

**Protocolo:** curl-first, rate-limit ≥3 s entre hosts distintos (LOCKED — NUNCA ráfagas). UA identificatorio `ObservatorioCongreso360/1.0 (contacto: sanchez.rossi@gmail.com)` para los endpoints públicos; para **Cámara** se usó el **header-set de navegador COMPLETO** que exige el bot-management de Cloudflare (`headers-camara.ts` — el UA simple NO basta en Cámara; ver Corrección #1 abajo). Total: 10 requests.

| # | Endpoint | HTTP | Veredicto | Histórico | Evidencia (muestra recortada) |
|---|----------|------|-----------|-----------|-------------------------------|
| 1 | `web-back.senado.cl/api/commissions_citations?limit=100` (comisiones Senado) | **200** (38 380 B) | **UP** | **NO — forward-only** | 6 días top-level `['22/07/2026','23/07/2026','24/07/2026','03/08/2026','04/08/2026','05/08/2026']`, **todos ≥ hoy (22/07)**; 20 citaciones; incluye `"Comisión Mixta..."`, `"Comisión Especial..."`, `"Zonas Extremas"` |
| 2 | `web-back.senado.cl/api/weekly_table?limit=100` (sala Senado) | **200** (14 445 B) | **UP** | **NO — forward-only** | 2 sesiones: `"Martes 21 de Julio de 2026"`, `"Miércoles 22 de Julio de 2026"`; TABLA con `POSICION`/`MATERIA`/`LINK_PROYECTO` estructurado |
| 3 | `www.senado.cl/appsenado/index.php?mo=comisiones&ac=citacionesComision` (PHP clásico) | **301 → 200** | **PARCIAL / no-usable** | — | 301 a `tramitacion.senado.cl/...`; el destino da 200 pero **0 bytes** (shell vacío que hidrata vía JS/AJAX). NO reemplaza la API backend |
| 4 | `www.camara.cl/legislacion/comisiones/citaciones_semana.aspx?prmSemana=2026-30` (comisiones Cámara, VIGENTE) | **200** (210 981 B) | **UP** | **SÍ** | 4× `article.grid-12.citaciones`; `__VIEWSTATE` presente (no necesario para leer). **Requiere header-set navegador** (Corrección #1) |
| 4b | mismo, `prmSemana=2026-20` (mayo, PASADA) | **200** (214 823 B) | **UP — histórico confirmado** | **SÍ** | 4× `article.citaciones`; fechas reales `"11 DE MAYO"`, `"12 DE MAYO"`, `"13 DE MAYO"`, `"14 DE MAYO"` → **Cámara citaciones tiene histórico por semana ISO** |
| 5 | `www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` (sala Cámara PDF) | **200** (161 347 B) | **UP** | prmId=0 = solo vigente | `content_type: application/pdf`, magic bytes `%PDF-1.7`. Requiere `Referer: .../sala_sesiones/tabla.aspx`. Único artefacto de sala Cámara (no estructurado → DeepSeek) |
| 6 | `opendata.camara.cl/camaradiputados/WServices/WSComisiones.asmx/getComisiones_Vigentes` (path del research) | **302** | **DOWN (mantención)** | — | 302 → `/mantencion.html?aspxerrorpath=...WSComisiones.asmx...` — confirma el hallazgo previo: ese path sigue en mantención |
| 6b | `opendata.camara.cl/wscamaradiputados.asmx/getComisiones_Vigentes` (path alterno) | **200** (1 073 B) | **UP — NUEVO** | — | Devuelve `<Comisiones>...<Comision><ID>411</ID><Nombre>Salud</Nombre>...` XML con datos VIVOS → **existe un endpoint alterno vivo** de comisiones vigentes (Corrección #2) |
| 8 | `tramitacion.senado.cl/wspublico/tramitacion.php?boletin=00000-00` (baseline) | **200** (244 B) | **UP** | — | `"No existe el número..."` con boletín inválido → wspublico del Senado vivo (baseline no-agenda) |

**Correcciones de la sesión (deriva vs el bloque `<interfaces>` del plan / research):**

- **Corrección #1 — path Y headers de Cámara comisiones.** El bloque `<interfaces>` del plan apuntaba a `www.camara.cl/legislacion/sesiones_sala/citaciones_semana.aspx`. Ese path **302→`/error404.aspx`** (no existe). El path REAL que usa el conector (`connector-camara.ts:80`, `BASE=.../legislacion/comisiones`) es `www.camara.cl/legislacion/comisiones/citaciones_semana.aspx` y responde **200**. Además, **hoy un GET con solo UA NO pasó** — devolvió 302; se necesitó el **header-set de navegador completo** (`headers-camara.ts`: `Sec-Ch-Ua*`, `Sec-Fetch-*`, `Accept-Language`, `Upgrade-Insecure-Requests`). Esto **refina** el hallazgo del research "GET simple pasa el WAF con solo UA": HOY el WAF exige el fingerprint de navegador (el conector ya lo envía verbatim — no es un bug, es la política LOCKED anti-Cloudflare). El veredicto UP/histórico se mantiene una vez usado el header-set correcto.
- **Corrección #2 — endpoint alterno vivo de comisiones Cámara (opendata).** El path del research (`/camaradiputados/WServices/WSComisiones.asmx`) sigue **DOWN (302 mantención)** — confirmado. Pero `opendata.camara.cl/wscamaradiputados.asmx/getComisiones_Vigentes` responde **200 con XML `<Comisiones>` vivo**. NO cambia la matriz de citaciones (ese WS lista *comisiones*, no *citaciones con fecha/hora*), pero se anota porque contradice "todo WSComisiones caído": el host ASMX y este método específico están UP.

**Veredicto agregado por celda de ingesta:**

| Celda | Endpoint productivo | Estado | Histórico alcanzable |
|-------|---------------------|--------|----------------------|
| comisiones × Cámara | `citaciones_semana.aspx` (path `/comisiones/`) | **UP** (con header-set navegador) | **SÍ** (cualquier `prmSemana` pasada) |
| comisiones × Senado | `api/commissions_citations` | **UP** | **NO** (forward-only, límite de la fuente) |
| sala × Cámara | `verDoc.aspx?prmId=0` (PDF) | **UP** | **NO** (solo vigente; prmId≠0 fuera de alcance) |
| sala × Senado | `api/weekly_table` | **UP** | **NO** (forward-only, límite de la fuente) |

---

## 3. Hallazgos confirmados / refutados

| # | Hallazgo previo | Veredicto MEDIDO | Evidencia (probe + N de DB) |
|---|-----------------|------------------|-----------------------------|
| **(a)** | Senado comisiones **forward-only** (sin histórico) | **CONFIRMADO** | Probe 1: días top-level `22/07→05/08/2026`, **CERO fechas pasadas** respecto de hoy (22/07); la API no acepta parámetro de fecha histórica. DB: `citacion_senado` acumula 5 semanas (W26–W30) solo porque el cron corrió cada semana, no porque la fuente exponga histórico |
| **(b)** | Cámara **sala thin** (PDF→DeepSeek, ~1 sesión) | **CONFIRMADO** | DB: `sesion_sala_camara=1` (1 sesión / 19 items). Probe 5: solo PDF vigente (`prmId=0`), `application/pdf` `%PDF-1.7`, sin histórico estructurado |
| **(c)** | comisiones **unidas/especiales** presentes por fuente | **CONFIRMADO presentes en Senado** | Probe 1: el JSON contiene `"Comisión Mixta..."` (2 menciones — p.ej. Mixta para Boletín), `"Comisión Especial..."` (4) y `"Zonas Extremas"` (2). **Cámara:** las comisiones unidas/especiales aparecen como **filas normales** dentro de los 4 `article.citaciones` del HTML de `citaciones_semana.aspx` (Probe 4/4b) — no hay endpoint separado; se parsean con `parse-camara-citaciones.ts` como cualquier citación |
| **(NUEVO)** | ¿Cámara citaciones **forward-only**? | **REFUTADO — tiene histórico** | Probe 4b: `prmSemana=2026-20` (mayo) devuelve **200** con días REALES de mayo (`"11 DE MAYO"`…`"14 DE MAYO"`). Cámara citaciones es **navegable por cualquier semana ISO pasada** → **no es forward-only como el Senado**. Implicación: la celda comisiones×Cámara es THIN por sub-ingesta (universo alcanzable), no por límite de la fuente |

**Síntesis para el gate de 94:** las dos celdas Senado son **forward-only por la FUENTE** (honesto: "al día en su ventana", no "incompleto por fallo"). La celda comisiones×Cámara es **THIN pero recuperable** (histórico navegable) → candidata #1 de un backfill acotado (Plan 03). La celda sala×Cámara es **THIN e irrecuperable estructuralmente** (solo PDF vigente).

---

## 4. Frescura — cron `agenda-weekly.yml`

**Verificado:** el archivo **`.github/workflows/agenda-weekly.yml` EXISTE**. NO es un gap de frescura por ausencia.

| Aspecto | Valor medido (verbatim del YAML) |
|---------|----------------------------------|
| **Schedule** | `cron: "0 11 * * 1"` — **lunes 11:00 UTC (~07:00 CL)**, antes de la semana parlamentaria + `workflow_dispatch` manual (inputs `desde`/`hasta` opcionales) |
| **Código que corre** | `pnpm --filter @obs/agenda exec tsx src/run-agenda-prod-cli.ts` — el MISMO CLI de operador (semana actual + próximas 2 por defecto), orden LOCKED de `@obs/ingest` (allowlist→robots→rate-limit 2-3s→fetch), transporte curl anti-WAF para Cámara |
| **Secrets declarados** | `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` (obligatorios); `DEEPSEEK_API_KEY` (gatea la tabla de sala Cámara PDF→DeepSeek; sin él degrada honesto al enlace PDF); `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (etapa 1 = PDF crudo content-addressed) |
| **Señal de frescura asociada** | `packages/freshness/src/catalog.ts:253-260` — `fuente:"agenda"`, `tabla:"citacion"`, `columna:"fecha_captura"`, **umbral 7 días**, `workflowYml:"agenda-weekly.yml"`. La señal degrada honesto (STALE) si `fecha_captura` MAX supera 7 días |

**Gap de frescura declarado (parcial):** el cron **existe y está bien cableado** (schedule + secrets + CLI correcto). El límite es de **naturaleza de la fuente**, no del cron:

- La agenda es **forward-looking**: el `WeekNav` de `/agenda` usa la semana ISO **actual**, así que sin la re-ingesta semanal la semana vigente vuelve a quedar vacía (documentado en el header del YAML). El cron mitiga esto correctamente.
- **NO verificado en esta sesión:** si el cron **efectivamente corrió** en GH Actions con los secrets cargados (requiere acceso al historial de runs de GH — fuera del alcance de la auditoría de código). El **billing de GH Actions** ha sido intermitente en el proyecto (MEMORY: "billing GH bloqueado→ingesta LOCAL"). **Recomendación:** el operador confirme en GH Actions que `agenda-weekly` tiene runs verdes recientes y los 7 secrets cargados; si el billing está bloqueado, la ingesta de agenda es **LOCAL** y el `fecha_captura` MAX puede superar el umbral de 7 días → señal STALE honesta.
- **Cámara comisiones** (histórico): el cron corre solo "semana actual + próximas 2" → **NO hace backfill histórico**. Por eso la celda comisiones×Cámara tiene solo 2 semanas ISO (§1.5). El backfill acotado del histórico Cámara (`--desde`/`--hasta` semanas pasadas) es tarea de **Plan 03** / runbook operador-LOCAL, no del cron semanal.

---

## Apéndice — reproducibilidad

- **Queries psql:** todas verbatim en §1, re-ejecutables con `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "<query>"`. Re-corrida 2026-07-22 = idéntica al research (cero deriva).
- **Probes curl:** re-ejecutables con el UA identificatorio (endpoints públicos) o el header-set de navegador completo (`headers-camara.ts`, obligatorio para `www.camara.cl`). Rate-limit ≥3 s entre hosts. Paths CORREGIDOS en §2 (Cámara comisiones = `/legislacion/comisiones/`, no `/sesiones_sala/`).
- **Ningún número presentado como "cobertura completa":** cada celda de §1.2 declara THIN o AL DÍA-en-su-ventana con justificación.
