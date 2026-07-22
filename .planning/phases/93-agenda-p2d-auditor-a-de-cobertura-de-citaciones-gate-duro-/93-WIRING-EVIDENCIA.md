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

## 1. Capturas /agenda (DOM PROD real)

> Método: `new_hidden_page` (no interfiere con el navegador del operador) → `get_page_content` / `take_snapshot`. Los conteos de días vienen de los triggers de acordeón (`CarrilAccordion`, page.tsx:360), donde el primer día arranca `expanded` y los demás `collapsed` (page.tsx:365 `defaultOpen={index === 0}`).

### Captura 1 — /agenda?semana=2026-W26 (semana PASADA poblada)

**URL:** `…/agenda?semana=2026-W26` · **Nav renderizado:** "Semana 26 · 22 jun–28 jun 2026".

**DOM (snapshot de acordeones de citaciones, verbatim):**
```
[65]  button "Lunes, 22 de junio 12 citaciones" (expanded)
[586] button "Martes, 23 de junio 19 citaciones" (collapsed)
[596] button "Miércoles, 24 de junio 22 citaciones" (collapsed)
```
Suma = **12 + 19 + 22 = 53 citaciones**. Tras expandir Martes 23 ([586]), aparecen **11 links "…Senado—fuente oficial"** (Senado renderiza junto a Cámara). El día abierto muestra 12 chips `Cámara22-jun`.

**Count DB esperado (§0-A):** 53 citaciones W26 (32 Cámara + 21 Senado). **Mostrado:** 53 (12+19+22 en 3 días). **Cámara y Senado ambas presentes.**

**Tabla de sala W26 (DOM, verbatim recortado):** el carril "Senado" renderiza filas (`| 1 | N°18216-05 | Proyecto … reconstrucción … | ORDEN DEL DÍA |`) y "Cámara de Diputadas y Diputados" renderiza una tabla estructurada de 19 filas (`| 0 | N°10986-24 | … monumento … Baldomero Lillo … | TABLA |` … `| 18 | N°13529-34 | … | TABLA |`).

**VEREDICTO:** **WIRING OK.** /agenda muestra citaciones PASADAS de ambas cámaras (agrupadas por día, acordeón) y la tabla de sala histórica. El único gap posible en /agenda es de **DATOS** (semanas no ingeridas), no de wiring.

### Captura 2 — /agenda?semana=2026-W30 (semana VIGENTE, control)

**URL:** `…/agenda?semana=2026-W30` · **Nav:** "Semana 30 · 20 jul–26 jul 2026".

**DOM (acordeones de citaciones, verbatim):**
```
[3478] button "Lunes, 20 de julio 9 citaciones" (expanded)
[3738] button "Martes, 21 de julio 9 citaciones" (collapsed)
[3788] button "Miércoles, 22 de julio 8 citaciones" (collapsed)
[3836] button "Jueves, 23 de julio 1 citación" (collapsed)
[3876] button "Viernes, 24 de julio 1 citación" (collapsed)
```
Suma = **9+9+8+1+1 = 28 citaciones**, TODAS con chip `Senado` (cero chips `Cámara`).

**Count DB esperado (§0-A'):** 28 Senado, 0 Cámara. **Mostrado:** 28 Senado, 0 Cámara. **Concuerda.**

**Tabla de sala W30 (DOM, verbatim):**
```
### Senado
No hay tabla de sala del Senado registrada para esta semana.
### Cámara de Diputadas y Diputados
Cámara: tabla no disponible como dato estructurado
… Consúltalo en el PDF oficial. Ver tabla semanal de sala (PDF oficial de la Cámara) ↗
```

**VEREDICTO:** **WIRING OK.** La ausencia de Cámara en citaciones y la degradación honesta al PDF (Cámara) / "No hay tabla … Senado" son gaps de **DATOS** (Cámara W30 = 0 filas; sala Senado forward-only sin fila esta semana), no de wiring. El carril degrada honesto (no fabrica).

## 2. Capturas ficha de proyecto (DOM PROD real)

### Captura 3 — /proyecto/18193-06 (citación SOLO-PASADA → gap forward-only)

**URL:** `…/proyecto/18193-06`. **DB (§0-B):** 1 citación **2026-07-21** (Senado, "de Economía"), 0 filas en sesion_tabla_item. HOY = 2026-07-22.

**DOM del bloque "¿Dónde está hoy?" (verbatim):**
```
## ¿Dónde está hoy?
Etapa: Primer trámite constitucional (Senado) · En tramitación
Último hito: La Sala acuerda que el proyecto … sea conocido por la Comisión de Economía … — 22 abr 2026
Sin urgencia vigente. según Senado al 21 jul 2026.
```
**"Citado" en TODA la ficha: 0 ocurrencias** (`grep -ic "Citado"` sobre el content completo = 0). La línea "Citado en de Economía el 21-07-2026" NO se renderiza.

**Count DB esperado:** debería mostrar "Citado en de Economía el 21 jul 2026". **Mostrado:** NADA (línea ausente).

**Control positivo (aísla que el gap es el filtro, no el wiring):** `/proyecto/11929-13` (citación HOY 2026-07-22, `fecha >= hoy`) SÍ renderiza verbatim: **"Citado en de Trabajo y Previsión Social el 22 jul 2026."** → el canal citacion_punto→citacion→línea funciona; SOLO las citaciones con `fecha < hoy` se ocultan.

**VEREDICTO:** **GAP DE WIRING — CONFIRMADO con DOM.** Ver §3 gap #1.

### Captura 4 — /proyecto/13665-07 (en sesion_tabla_item, 0 citación → gap sala-en-ficha)

**URL:** `…/proyecto/13665-07`. **DB (§0-C):** en `sesion_tabla_item` del Senado (sesiones W28 2026-07-07 y W29 2026-07-14); 0 citaciones.

**DOM — secciones renderizadas en la ficha (headings verbatim):**
```
## ¿Dónde está hoy?     ## Tramitación     ## Votaciones
## ¿Quién presentó este proyecto?     ## Reuniones de lobby …
## Audiencias de lobby que mencionan este boletín     ## Cruces con el sector …
## Idea matriz     ## Cuerpos legales afectados     ## Proyectos similares
```
Conteos sobre el content completo: **"tabla de sala" = 0, "orden del día" = 0, "Citado" = 0**. NINGUNA sección lee `sesion_tabla_item`.

**Cross-check (la data SÍ existe, solo la ficha no la lee):** `/agenda?semana=2026-W28` (nav "Semana 28 · 6 jul–12 jul 2026") muestra en la tabla de sala del Senado la fila verbatim:
`| 5 | N°13665-07 | Proyecto de ley … trata de personas con fines de adopción ilegal … | ORDEN DEL DÍA |`.

**Count DB esperado en la ficha:** debería declarar "en tabla de sala del Senado (W28/W29)". **Mostrado en la ficha:** NADA. **Mostrado en /agenda:** la fila completa.

**VEREDICTO:** **GAP DE WIRING — CONFIRMADO con DOM.** Ver §3 gap #2.

## 3. Gaps declarados

> Clasificación: **WIRING** = la data está en DB y otra superficie la muestra, pero la ficha del proyecto NO la lee/renderiza. **DATOS** = la data no está ingerida (fuera de alcance de 93, es cobertura).

### Gap #1 — `citacionVigente` forward-only oculta citaciones PASADAS en la ficha — **CONFIRMADO (WIRING)**

- **Sujeto reproducible:** `18193-06` (citación 2026-07-21, Senado "de Economía"). Control positivo: `11929-13` (citación 2026-07-22 = hoy → SÍ aparece).
- **Evidencia DOM:** ficha `…/proyecto/18193-06` → bloque "¿Dónde está hoy?" presente, "Citado" = **0 ocurrencias**. Ficha `…/proyecto/11929-13` → **"Citado en de Trabajo y Previsión Social el 22 jul 2026."** presente.
- **Count DB que debería aparecer:** 1 línea "Citado en de Economía el 21 jul 2026" (la citación existe: `citacion_punto.boletin='18193-06'` → `citacion.fecha='2026-07-21'`).
- **Causa raíz (código):** `app/components/estado-actual-block.tsx:122-129` — `citacionVigente` filtra `x.d.toISOString().slice(0,10) >= hoyChile` (SOLO fecha >= hoy) y toma la más próxima; una citación con `fecha < hoy` se descarta. La línea "Citado en {comisión} el {fecha}" (estado-actual-block.tsx:271-278) desaparece en cuanto la fecha pasa. La query que trae las citaciones (estado-actual-block.tsx:311-315) SÍ trae TODAS (sin filtro de fecha) — el sesgo forward-only vive puramente en el derivador `citacionVigente`.
- **Clasificación:** **WIRING** (la citación está en DB; la ficha la oculta por el filtro; para prensa que revisa un proyecto histórico, esto niega que fue citado).

### Gap #2 — `sesion_tabla_item` NO se lee en la ficha — **CONFIRMADO (WIRING)**

- **Sujeto reproducible:** `13665-07` (en `sesion_tabla_item` del Senado, sesiones W28 2026-07-07 y W29 2026-07-14; 0 citaciones).
- **Evidencia DOM:** ficha `…/proyecto/13665-07` → "tabla de sala"=0, "orden del día"=0 (ninguna sección lo declara). Contraste: `…/agenda?semana=2026-W28` → fila `| 5 | N°13665-07 | … | ORDEN DEL DÍA |` en la tabla de sala del Senado.
- **Count DB que debería aparecer:** al menos 1 declaración "está en la tabla de sala del Senado (W28 y W29)" (2 filas en `sesion_tabla_item` con `boletin='13665-07'`).
- **Causa raíz (código):** `app/components/estado-actual-block.tsx:290-315` — `EstadoActualBlock` lee `proyecto`, `tramitacion_evento` y `citacion_punto×citacion`, pero **NO consulta `sesion_tabla_item`**. No hay ninguna query ni línea de render para la tabla de sala en la ficha (el interface `EstadoActual`, estado-actual-block.tsx:21-45, no tiene campo de sala). Solo `/agenda` (`SalaTableServer`, app/app/agenda/page.tsx:453-564) lee `sesion_tabla_item`.
- **Clasificación:** **WIRING** (la data está en DB y /agenda la muestra; la ficha del proyecto no la lee).

### No-gaps (wiring OK, confirmados con DOM)

- **/agenda muestra citaciones PASADAS de ambas cámaras** (Captura 1, W26 = 53 en 3 días). El hallazgo previo "forward-only del Senado" NO aplica a la vista /agenda de citaciones (navega por `semana_iso`, no por fecha>=hoy). Refuta cualquier sospecha de que /agenda sesgue a futuro.
- **/agenda degrada honesto** cuando falta data (Captura 2, W30: Cámara citaciones ausente sin fabricar; sala Cámara → PDF; sala Senado → "No hay tabla … registrada"). Estos son gaps de **DATOS/cobertura**, no de wiring.

### Nota A3 (research) — resuelta

El research advirtió que el deploy PROD (quick 260722-eia tocó deep-links/urgencia) pudo cambiar el comportamiento. **Observado 2026-07-22 sobre `fa4d4369`:** el token de urgencia 3-estados de 260722-eia SÍ está live ("Sin urgencia vigente. según Senado al 21 jul 2026." en 18193-06), PERO el filtro `citacionVigente` forward-only NO fue tocado — el gap #1 sigue vigente en PROD. Reportado lo OBSERVADO, no lo asumido.

> **Cero fixes propuestos.** Los fixes de UI (leer citaciones pasadas en la ficha + leer `sesion_tabla_item` en la ficha) son Phase 94. Esta fase solo DECLARA la brecha con evidencia DOM reproducible.
