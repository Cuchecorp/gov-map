# Phase 98: SEÑALES P1a — SPIKE de datos: qué señales son honestas - Research

**Researched:** 2026-07-24
**Domain:** Auditoría empírica de datos legislativos vivos (Supabase Postgres) — clasificación de honestidad de señales para el panel de actualidad
**Confidence:** HIGH (todas las afirmaciones respaldadas por query + resultado real contra la DB viva `bctyygbmqcvizyplktuw`, sa-east-1, ejecutadas 2026-07-24)

> Este es un SPIKE de datos. Cada veredicto lleva la query que lo prueba y el resultado real. No se materializó nada, no se corrió DDL, todas las queries son read-only.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Señales candidatas a clasificar (SC1):** velocity, nuevos ingresos, urgencias del Ejecutivo, agenda próxima, archivados/retirados, leyes recién publicadas. Cada una honesta / sesgada / imposible CON evidencia (query + conteo real).
- **`fecha_captura` JAMÁS es "fecha de ingreso"** — el backfill masivo la hace mentirosa; el reloj real es `tramitacion_evento`. Si una señal requiere fecha de ingreso y no hay `fecha_ingreso` explícito → condicional/imposible con evidencia.
- **Auditoría de `tramitacion_evento` (SC2, Pitfall #1 y #2):** medir frescura por fuente, cobertura por cámara, declarar sesgo Cámara/Senado por señal. Fuente STALE → SUPRIMIR ("sin datos frescos de esta fuente"), JAMÁS "sin movimiento". Ausencia ≠ hecho. Verificar fiabilidad del primer-evento por boletín como proxy de ingreso.
- **Leyes recién publicadas (SC3):** evaluar BCN `portada_ulp` y/o Cámara `leyes_promulgadas.aspx` con verdict BINARIO. curl-first, rate-limit, NO ráfagas. Solo viabilidad, no ingesta. viable → dos-etapas fuente→R2→Supabase en fase futura (SEN-06); no-viable → DIFERIDA documentada.
- **Similitud de voto computable HOY (SC4, insumo Phase 102):** verificar `voto.estado_vinculo='confirmado'` (~548.642 votos / 186 parlamentarios — VERIFICAR, no asumir); confirmar que la reconciliación NO fabrica votantes (fail-closed); denominador honesto = votaciones sustantivas donde ambos votaron.
- **Restricciones de ejecución:** queries DB SIEMPRE read-only; `set -a; source .env; set +a`; JAMÁS imprimir URL/keys; filtro `pg_depend deptype='e'` en pg_proc/grants; entregable = documento, NO cambios de schema.

### Claude's Discretion
Estructura exacta del documento, qué queries concretas correr, cómo medir frescura (max(fecha) por fuente / histograma). Preferir evidencia numérica reproducible.

### Deferred Ideas (OUT OF SCOPE)
- Materializador `actualidad_senal` + RPCs + cron → Phase 99.
- Construir "leyes publicadas" (ingesta real dos-etapas) → fase futura SEN-06 SOLO si el verdict es viable.
- Similitud de voto con caveat base-alta + flag → Phase 102.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEN-01 | SPIKE-auditoría de `tramitacion_evento` (frescura, cobertura por cámara, fiabilidad de primer-evento por boletín) clasifica CADA señal como honesta/sesgada/imposible; `fecha_captura` JAMÁS = fecha de ingreso | Tabla de clasificación por señal + auditoría de frescura/sesgo + reality-check de `fecha_captura`, todas con query+resultado |
| SEN-06 | Señal "leyes recién publicadas" evaluada empíricamente contra BCN (`portada_ulp`)/Cámara (`leyes_promulgadas.aspx`) — viable → dos-etapas R2; no-viable → diferida documentada | Verdict binario con las dos probes curl-first (BCN no-viable / Cámara viable) |
</phase_requirements>

## Summary

Auditamos la DB viva contra los 4 success criteria. **El reloj real del movimiento es `tramitacion_evento.fecha` (timestamptz); `proyecto` NO tiene columna de fecha de ingreso — solo `fecha_captura`, que es la fecha de scrape y está masivamente concentrada en un backfill del 2026-07-10** (44.847 de ~48k filas). Cualquier señal temporal que use `fecha_captura` como ingreso mentiría; hay que usar `tramitacion_evento`.

La frescura de `tramitacion_evento` es **buena y casi simétrica entre cámaras** (Cámara al 2026-07-23 = 1 día stale; Senado al 2026-07-22 = 2 días) — el temido sesgo de cámara NO se manifiesta en frescura, aunque sí hay dos defectos de datos a manejar: (a) **2 filas con fecha corrupta `2626-05-25`** (typo de parseo por `2026`, boletín 18232-25) que envenenan cualquier `max(fecha)`/ventana si no se filtra `fecha <= current_date`; (b) **la columna `camara` tiene dos grafías** ("C.Diputados" y "C. Diputados") que hay que normalizar antes de agrupar.

La similitud de voto es **computable HOY** pero el número del CONTEXT era una asunción incorrecta: **confirmados = 283.550** (no ~548.642; ese número es el total confirmado+no_confirmado = 549.739), sobre **186 parlamentarios** y **4.852 votaciones**, con **CERO votos confirmados atados a una identidad inexistente** (reconciliación fail-closed verificada). La señal "leyes recién publicadas": **BCN portada_ulp = NO-VIABLE** (SPA Angular con reCAPTCHA, sin datos en el HTML), **Cámara `ProyectosDeLey/leyes_promulgadas.aspx` = VIABLE** (HTML server-rendered con N° Ley + fecha publicación + boletín inline, patrón cheerio ya bendecido en CLAUDE.md).

**Primary recommendation:** Phase 99 debe materializar SOLO las señales clasificadas honestas abajo, cada una con su guarda de supresión (frescura declarada), normalizando `camara` y filtrando `fecha <= current_date`. "Nuevos ingresos" es honesta SOLO para el corpus 2022-2026 vía primer-evento (no vía `fecha_captura`). "Leyes recién publicadas" entra por Cámara en fase futura SEN-06.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auditoría/clasificación de señales | Database (read-only SQL) | — | Toda la evidencia sale de Supabase; el spike NO toca frontend ni fuentes |
| Verdict leyes-publicadas | External source probe (curl) | — | Viabilidad de una fuente futura; una request por candidato, rate-limited |
| Guarda de supresión por frescura | Database (materializador Phase 99) | Frontend (panel Phase 100) | La supresión se decide con `max(fecha)` por fuente en el materializador; el panel muestra la cobertura declarada |

## Standard Stack

No se instalan paquetes en este spike (es auditoría read-only + probe curl). El stack de ingesta futura para SEN-06 ya está fijado en CLAUDE.md (`cheerio` para el HTML ASP.NET de Cámara). No hay `## Package Legitimacy Audit` porque esta fase no instala dependencias.

---

## SC1 — Clasificación por señal (honesta / sesgada / imposible)

Cada veredicto lleva la query exacta y el resultado real (2026-07-24, `current_date` = 2026-07-24).

| Señal | Veredicto | Query de evidencia | Resultado | Guarda de supresión que necesita (Phase 99) |
|-------|-----------|--------------------|-----------|-----------------------------------------------|
| **velocity** (movimiento reciente por ventana) | **HONESTA** | `SELECT count(*) mov, count(DISTINCT boletin) bol FROM tramitacion_evento WHERE fecha BETWEEN current_date-7 AND current_date` | `170` eventos / `33` boletines en 7 días | (1) Filtrar `fecha <= current_date` (mata las 2 filas `2626`). (2) Normalizar `camara`. (3) Supresión si `max(fecha)` de la fuente > umbral stale → mostrar "sin datos frescos de esta fuente", nunca "sin movimiento". (4) Framing "N trámites en 7 días" — NUNCA "top/los más" (lock T-52-13). |
| **nuevos ingresos** (proyectos ingresados en ventana N días) | **HONESTA-CONDICIONAL** (solo corpus 2022-2026, vía primer-evento) — **IMPOSIBLE si se usa `fecha_captura`** | `WITH p AS (SELECT boletin, min(fecha) f1 FROM tramitacion_evento WHERE fecha<=current_date GROUP BY boletin) SELECT date_trunc('year',f1)::date, count(*) FROM p GROUP BY 1 ORDER BY 1 DESC` | 2026→404, 2025→706, 2024→800, 2023→889, 2022→844; pre-2022 = ruido (≤3/año, hasta 2012) | El primer-evento es fiable proxy de ingreso DENTRO del corpus 2022-2026. Guarda: EXCLUIR boletines cuyo primer-evento es pre-2022 (son eventos históricos de proyectos viejos, no ingresos reales). NUNCA derivar "nuevo" de `proyecto.fecha_captura`. Declarar cobertura "proyectos ingresados 2022-2026". |
| **urgencias vivas del Ejecutivo** | **HONESTA** | `SELECT count(*) FROM tramitacion_evento WHERE tipo='urgencia' AND fecha BETWEEN current_date-30 AND current_date` (y `-7`) | `104` urgencias en 30 días; `30` en 7 días | Filtrar `fecha<=current_date`. Presentar el HECHO fechado ("urgencia calificada el DD/MM"), jamás "urgencia de madrugada"/juicio. Supresión por frescura de la fuente igual que velocity. Nota: la señal es de EVENTOS de urgencia (fechados), no de "estado vigente" — no afirmar vigencia sin dato de vencimiento. |
| **agenda próxima** (votaciones/citaciones futuras) | **HONESTA** | `SELECT count(*) total, count(*) FILTER(WHERE fecha>=current_date) futuras, max(fecha)::date FROM citacion` | citacion: `278` total, `7` futuras, max `2026-08-05`; sesion_sala: `16` total, `0` futuras, max `2026-07-22` | Citaciones tienen filas futuras reales (hasta 05-ago) → "coming up" honesto. sesion_sala sin futuras HOY → esa sub-señal se SUPRIME ("sin sesiones de sala agendadas en las fuentes consultadas"), no se afirma "no hay sesiones". Reusar la lógica tz Chile de /agenda (date-only UTC = día chileno, gotcha LOCKED). |
| **archivados/retirados recientes** | **HONESTA-CON-CAVEAT** | `SELECT count(*) FROM tramitacion_evento WHERE (descripcion ILIKE '%archiv%' OR descripcion ILIKE '%retir%') AND fecha<=current_date` | `6.137` eventos fechados; top descripciones incluyen "Archivado" (64), **"Desarchivo de proyecto" (71)** y **"…que retira y hace presente…" (65,62,61…)** | El evento de archivo/retiro TIENE fecha real en `tramitacion_evento` → fechable honestamente. CAVEAT DURO: filtrar por `descripcion`, no por `proyecto.estado` (cuya fecha es `fecha_captura` mentirosa). "Desarchivo" y "retira y hace presente" (retiro procedimental de mensaje, NO abandono) invierten el sentido → el materializador debe distinguir por descripción, o la señal editorializa. Preferir el `estado` como etiqueta de estado actual + el EVENTO fechado como el "cuándo". |
| **leyes recién publicadas** | **VIABLE vía Cámara (fuente nueva, no en DB)** — ver SC3 | — (no está en la DB; requiere ingesta) | La DB tiene `estado='Publicado'` (339 proyectos) pero SIN fecha de publicación fiable (`fecha_captura` = scrape). La fecha real vive en la fuente externa | Entra por Phase futura SEN-06 (dos-etapas Cámara→R2→Supabase). No materializable en Phase 99 con datos actuales. |

### Señal extra observada (para Phase 99, no pedida explícitamente)
- **"agrupación por materia"** (SEN-05, Phase 99): `proyecto.materia` existe como columna text (taxonomía oficial). Es label factual reusable — no auditado en profundidad aquí porque no es una señal temporal, pero confirmado presente en el schema.

---

## SC2 — Auditoría de `tramitacion_evento`: frescura, cobertura y sesgo de cámara

### Schema real (confirma el reloj)
Query: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='tramitacion_evento' AND table_schema='public' ORDER BY ordinal_position`

```
id            bigint       NO
boletin       text         NO
fecha         timestamptz  YES   ← EL RELOJ REAL DEL EVENTO
camara        text         YES
tipo          text         NO    ← tramite|urgencia|votacion|oficio|informe
descripcion   text         YES
enlace        text         YES
origen        text         NO
fecha_captura timestamptz  NO    ← FECHA DE SCRAPE, NO usar como fecha de evento
```
`proyecto` (verificado por query aparte) NO tiene `fecha_ingreso` ni `fecha_publicacion` — solo `fecha_captura`. **Esto es el hecho rector de todo el panel.**

### Frescura + cobertura por cámara (con y sin filtro de fechas corruptas)

Query cruda (revela los defectos):
`SELECT COALESCE(camara,'(null)'), count(*), min(fecha)::date, max(fecha)::date, (current_date-max(fecha)::date) FROM tramitacion_evento GROUP BY camara ORDER BY 2 DESC`

```
Senado        20357   1995-01-17   2026-07-22        (2 días)
C.Diputados   19813   1995-01-10   2626-05-25   ← CORRUPTA
C. Diputados   5930   1995-01-12   2626-05-25   ← CORRUPTA + grafía distinta
(null)         2261   1995-01-10   2026-07-22
```

Query saneada (`fecha <= current_date`, `camara` normalizada por `regexp_replace(camara,'\s+','','g')`):
`SELECT regexp_replace(camara,'\s+','','g'), count(*), max(fecha)::date, (current_date-max(fecha)::date) FROM tramitacion_evento WHERE fecha<=current_date GROUP BY 1 ORDER BY 2 DESC`

```
C.Diputados   25741   2026-07-23   1 día
Senado        20357   2026-07-22   2 días
(null)         2261   2026-07-22   2 días
```

**Veredicto de sesgo de cámara (Pitfall #2):** en FRESCURA el sesgo es prácticamente **nulo** (Cámara 1 día, Senado 2 días — ambas al día). En VOLUMEN Cámara tiene 25.741 vs Senado 20.357 eventos, pero eso NO sostiene un ranking "Cámara más activa" — la diferencia es de cobertura/estilo de registro, no de actividad institucional comparable. **Regla para Phase 99/100: prohibido cualquier ranking cross-cámara por conteo. Señales POR proyecto/POR tema, o declarar la asimetría.** Los 2.261 eventos con `camara=NULL` deben atribuirse o excluirse, no repartirse.

### Distribución por tipo (contexto de qué señales son posibles)
`SELECT tipo, count(*), min(fecha)::date, max(fecha)::date FROM tramitacion_evento GROUP BY tipo ORDER BY 2 DESC`
```
tramite    29558   1995-01-10   2626-05-25 (corrupta)
urgencia    8095   1995-01-10   2026-07-22
votacion    4779   2002-12-18   2026-07-22
oficio      3926   1995-01-12   2626-05-25 (corrupta)
informe     2003   1995-01-11   2026-07-22
```

### Fiabilidad del primer-evento por boletín como proxy de ingreso
`WITH p AS (SELECT boletin, min(fecha) f1 FROM tramitacion_evento WHERE fecha<=current_date GROUP BY boletin) SELECT date_trunc('year',f1)::date, count(*) FROM p GROUP BY 1 ORDER BY 1 DESC LIMIT 12`
```
2026-404  2025-706  2024-800  2023-889  2022-844   ← corpus limpio y denso
2021-3  2020-3  2019-1  2018-1  2016-1  2014-1  2012-1  ← cola de ruido (eventos históricos)
```
**Veredicto:** el primer-evento es un proxy de ingreso **FIABLE dentro de 2022-2026** (curva coherente, cientos/año). Fuera de ese rango hay una cola de <15 boletines totales cuyo primer-evento es un trámite histórico de un proyecto viejo — NO un ingreso. Guarda: la señal "nuevos ingresos" excluye primer-evento pre-2022 y declara cobertura del corpus.

### Defectos de datos a manejar en Phase 99 (LOCKED para el materializador)
1. **2 filas con `fecha='2626-05-25'`** (typo de `2026`), boletín `18232-25`, tipo tramite/oficio, descripción "Oficio de ley al Ejecutivo". Query: `SELECT count(*) FROM tramitacion_evento WHERE fecha>current_date` → `2`. **Todo `max(fecha)`/ventana DEBE filtrar `fecha <= current_date`** o envenena el reloj (haría el sitio decir que el último movimiento fue en el año 2626).
2. **`camara` con dos grafías** ("C.Diputados" 19.813 y "C. Diputados" 5.930). Normalizar SIEMPRE antes de agrupar por cámara.
3. **`camara=NULL` en 2.261 filas.** No inventar cámara; agrupar como "(sin cámara)" o excluir de cortes por cámara.

---

## SC2b — `fecha_captura` reality check (JAMÁS es fecha de ingreso)

`SELECT fecha_captura::date, count(*) FROM tramitacion_evento GROUP BY 1 ORDER BY 2 DESC LIMIT 15`
```
2026-07-10   44847   ← BACKFILL MASIVO (93% de las filas capturadas el mismo día)
2026-07-23    2805
2026-07-09     591
2026-07-17     116
2026-07-03       1
2026-07-22       1
```
**Prueba concluyente:** 44.847 eventos —cubriendo trámites desde 1995— tienen `fecha_captura = 2026-07-10`. La fecha de captura es CUÁNDO SE SCRAPEÓ, no cuándo ocurrió el hecho ni cuándo ingresó el proyecto. Un evento de 1995 tiene `fecha_captura` 2026-07-10. **Regla LOCKED (ya en CONTEXT):** `fecha_captura` se usa SOLO para declarar frescura de la fuente ("datos al día DD/MM") y para hash-check de ingesta; JAMÁS como fecha de un hecho legislativo, NUNCA como "fecha de ingreso" de un proyecto. Toda señal temporal se ancla a `tramitacion_evento.fecha`.

---

## SC3 — Leyes recién publicadas: VERDICT BINARIO

Dos probes curl-first, UA identificatorio, con `sleep 3` entre requests (rate-limit respetado, sin ráfagas).

### Candidato A — BCN `portada_ulp` → **NO-VIABLE**
`curl -A "ObservatorioCongreso360/1.0 (contacto:…; viability-probe)" "https://www.bcn.cl/leychile/Consulta/portada_ulp"`
- HTTP 200, **solo 9.771 bytes**. Tiene `Last-Modified` + `Etag` (bueno para hash-check), pero…
- El HTML es un **shell de Angular SPA** (`inline.*.bundle.js`, `polyfills.*.bundle.js`, `main.*.bundle.js`) — CERO datos de leyes en el HTML.
- Protegida por **reCAPTCHA Enterprise** (`recaptcha/enterprise.js`) → los datos se cargan client-side vía una API que probablemente exige token de captcha.
- `grep` de `numero|fecha_publicacion|idNorma|json|servicios-leychile` en el HTML → **0 matches**.
- **Razón de no-viabilidad:** requeriría ejecución JS (headless browser — vetado por CLAUDE.md en Edge Functions) o reverse-engineering de una API tras reCAPTCHA. Frágil y contra el patrón fetch+cheerio del proyecto.

### Candidato B — Cámara `ProyectosDeLey/leyes_promulgadas.aspx` → **VIABLE**
Primer intento `/legislacion/leyes_promulgadas/leyes_promulgadas.aspx` → 302 a error404 (ruta muerta). Ruta correcta:
`curl … "https://www.camara.cl/legislacion/ProyectosDeLey/leyes_promulgadas.aspx"`
- HTTP **200**, **3.769.210 bytes** (~3.7 MB de HTML server-rendered), ASP.NET WebForms (`x-aspnet-version: 4.0.30319`, `Set-Cookie: ASP.NET_SessionId`).
- Los datos están **inline en el HTML**: `grep` confirma cabeceras "N° Ley", "Fecha Public[ación]", "Boletín" (2×) y filas reales:
  ```
  Ley N° 21.831 … BOLETIN=17287-14
  Ley N° 21.826 … BOLETIN=18230-13
  Ley N° 21.830 … BOLETIN=17117-03
  Ley N° 21.815 … BOLETIN=17724-34
  ```
- Expone **número de ley + fecha de publicación + boletín** (el boletín cross-referencia directo a `proyecto`/`tramitacion_evento` ya en DB).
- **Razón de viabilidad:** es exactamente el patrón HTML ASP.NET que CLAUDE.md marca HIGH-confidence (fetch + cheerio, patrón 2-pasos `__VIEWSTATE` si el paginado lo requiere; la primera página ya trae el lote reciente sin postback).

### VERDICT (SC3 / SEN-06): **VIABLE — vía Cámara `ProyectosDeLey/leyes_promulgadas.aspx`, NO vía BCN.**
- Fuente elegida: **Cámara** (HTML server-rendered, cheerio). BCN portada_ulp queda DESCARTADA (SPA + reCAPTCHA).
- Shape del conector futuro (SEN-06, fase posterior, dos-etapas): `fetch` la .aspx → guardar HTML crudo en R2 content-addressed (`camara/leyes_promulgadas/fecha/sha256.html`, `If-None-Match:*`) → Etapa 2 parsea con cheerio la tabla (N° Ley, fecha publicación, boletín) → upsert a Supabase ligando por `boletin` a `proyecto`. Rate-limit 2-3s, UA identificatorio, hash-check antes de re-descargar. Fallback de paginación: patrón `__VIEWSTATE` GET→POST si hay que ir más atrás que la primera página.
- **NO se ingiere en este spike ni en Phase 99** — es fase futura SEN-06.

---

## SC4 — Similitud de voto computable HOY (insumo Phase 102)

### Corrección al número del CONTEXT
El CONTEXT asumía "~548.642 votos confirmados / 186". **La evidencia lo corrige:** ese número es el TOTAL de la tabla `voto`, no los confirmados.

`SELECT estado_vinculo, count(*) FROM voto GROUP BY 1 ORDER BY 2 DESC`
```
confirmado      283550
no_confirmado   266189      (total tabla = 549739)
```

### Conteo confirmado (la cifra real para Phase 102)
`SELECT count(*), count(DISTINCT parlamentario_id), count(DISTINCT votacion_id) FROM voto WHERE estado_vinculo='confirmado'`
```
confirmados = 283.550   |   parlamentarios distintos = 186   |   votaciones distintas = 4.852
```
Distribución de selección (confirmados):
`si 183399 · no 76389 · abstencion 11631 · ausente 11000 · pareo 1131`

### Fail-closed: la reconciliación NO fabrica votantes ✓
`SELECT count(*) FROM voto WHERE estado_vinculo='confirmado' AND (parlamentario_id IS NULL OR parlamentario_id NOT IN (SELECT id FROM parlamentario))`
```
0   ← CERO votos confirmados atados a una identidad inexistente/sintética
```
La tabla `parlamentario` tiene exactamente **186** filas (`SELECT count(*) FROM parlamentario` → 186) — 1:1 con los votantes confirmados. `parlamentario.id` es `text` (coincide con `voto.parlamentario_id text`). **Confirmado: la reconciliación es fail-closed — no hay votantes sintéticos creando ruido.**

### Denominador honesto disponible ✓
`SELECT count(*) FILTER (WHERE n>=2) FROM (SELECT votacion_id, count(*) n FROM voto WHERE estado_vinculo='confirmado' AND seleccion IN ('si','no','abstencion') GROUP BY votacion_id) x`
```
4852 de 4852 votaciones tienen >=2 votantes confirmados con selección sustantiva
```
**Veredicto SC4:** la métrica pairwise "coinciden en N de M votaciones compartidas" (VSIM-01) es **plenamente computable HOY**. El denominador honesto (votaciones sustantivas donde ambos votaron, `seleccion IN si/no/abstencion`, excluyendo ausente/pareo) está disponible sobre las 4.852 votaciones. Phase 102 puede construir la métrica sin ingesta nueva — pero el número base a citar es **283.550 confirmados / 186 parlamentarios / 4.852 votaciones**, NO 548.642.

---

## Common Pitfalls (heredados, confirmados empíricamente aquí)

### Pitfall 1: "Sin movimiento" ≠ "no se scrapeó" — CONFIRMADO como riesgo vivo
La ausencia de filas en una ventana tiene dos causas indistinguibles sin metadato de frescura. **Prevención empírica:** cada señal se computa solo si `max(fecha_captura)` de su fuente es RECIENTE; si stale → "sin datos frescos de esta fuente", jamás "sin movimiento". La frescura observada hoy (1-2 días) es sana, pero el materializador DEBE re-chequearla cada corrida.

### Pitfall 2: Sesgo de cámara — MEDIDO, hoy bajo en frescura
Frescura casi simétrica (1 vs 2 días). El riesgo real no es frescura sino VOLUMEN (25k vs 20k) presentado como ranking. Prohibido ranking cross-cámara por conteo.

### Pitfall nuevo detectado en este spike: fechas corruptas y grafías dobles
`fecha='2626'` (2 filas) y `camara` con dos grafías. No estaban documentados en PITFALLS.md. **Ambos son LOCKED para el materializador de Phase 99:** filtrar `fecha<=current_date` y normalizar `camara` en TODA agregación.

---

## Validation Architecture

> `nyquist_validation: true` en config.json. Este es un SPIKE de datos (entregable = documento de hallazgos + queries reproducibles), no código de aplicación. La "validación" de un spike es la **reproducibilidad de sus queries** contra la DB viva.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (por paquete `@obs/*` + `app/`) + **pgTAP** (`supabase/tests/*.test.sql`) para lógica DB |
| Config file | `vitest.config.ts` raíz + por paquete; pgTAP corrido vía `psql -f` contra la DB |
| Quick run command | `psql "$SUPABASE_DB_URL" -tA -f <query.sql>` (re-ejecutar cualquier query de evidencia de este doc) |
| Full suite command | `pnpm test` (vitest) — no aplica a este spike (sin código nuevo) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEN-01 | El reloj es `tramitacion_evento.fecha`, no `fecha_captura` | spike-query (reproducible) | `psql "$SUPABASE_DB_URL" -tA -c "SELECT fecha_captura::date, count(*) FROM tramitacion_evento GROUP BY 1 ORDER BY 2 DESC LIMIT 5"` (espera cluster 2026-07-10) | ✅ (query en este doc) |
| SEN-01 | Frescura por cámara ≤ pocos días, saneada | spike-query | `psql … -c "SELECT regexp_replace(camara,'\s+','','g'), max(fecha)::date FROM tramitacion_evento WHERE fecha<=current_date GROUP BY 1"` | ✅ |
| SEN-01 | 2 filas corruptas `fecha>current_date` existen y deben filtrarse | spike-query | `psql … -c "SELECT count(*) FROM tramitacion_evento WHERE fecha>current_date"` (espera 2) | ✅ |
| SEN-06 | Cámara leyes_promulgadas devuelve HTML con datos inline | probe (viability) | `curl -A "<UA>" -sI "https://www.camara.cl/legislacion/ProyectosDeLey/leyes_promulgadas.aspx"` (espera 200 + ASP.NET) | ✅ (probe corrido) |
| SC4/VSIM-01 | 283.550 confirmados / 186 / 4.852; cero fabricados | spike-query | `psql … -c "SELECT count(*), count(DISTINCT parlamentario_id), count(DISTINCT votacion_id) FROM voto WHERE estado_vinculo='confirmado'"` | ✅ |

### Sampling Rate
- **Este spike:** cada afirmación numérica es re-ejecutable con su query — esa es la muestra completa (censo, no muestreo).
- **Phase 99 (materializador):** cuando materialice, añadir pgTAP en `supabase/tests/00XX_actualidad_senal.test.sql` que verifique (a) ninguna fila con `fecha>current_date` alimenta una señal, (b) `camara` normalizada, (c) la supresión por frescura dispara. Espeja `0039_cruce_senal.test.sql`.

### Wave 0 Gaps
- Ninguno para este spike (no produce código). **Para Phase 99:** falta `supabase/tests/00XX_actualidad_senal.test.sql` — crearlo como parte de esa fase, no de esta.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql (Postgres client) | Todas las queries de auditoría | ✓ | — (conecta a Supabase 15+) | — |
| `SUPABASE_DB_URL` en `.env` | Acceso read-only a DB viva | ✓ | — | — |
| curl | Probes de viabilidad BCN/Cámara | ✓ | — | — |

Sin dependencias faltantes. No se instalaron paquetes.

## Security Domain

> `security_enforcement: true`, ASVS L1. Este spike es read-only sobre datos ya públicos y no añade superficie.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | sí (a futuro) | El futuro conector SEN-06 valida el HTML de Cámara con zod (contrato de esquema) antes de upsert — patrón LOCKED del proyecto |
| V6 Cryptography | no | — |
| V2/V3/V4 Auth/Session/Access | no | Spike sin auth; datos públicos oficiales |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fecha corrupta `2626` propagándose a la UI como "último movimiento" | Tampering (de datos upstream) | Filtro `fecha <= current_date` obligatorio en el materializador (Phase 99) |
| `fecha_captura` presentada como hecho legislativo | Falsa afirmación pública (riesgo existencial #1) | Regla LOCKED: `fecha_captura` solo declara frescura, nunca es fecha de hecho |
| Ranking cross-cámara amplificando sesgo de cobertura | Falsa afirmación institucional | Prohibido ranking por conteo cross-cámara (Pitfall #2) |
| Secreto DB filtrado en logs | Information Disclosure | `set -a; source .env; set +a`; jamás echo de URL/keys (cumplido) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | La grafía `camara` seguirá teniendo exactamente dos variantes ("C.Diputados"/"C. Diputados") | SC2 | Bajo — el materializador debe normalizar por regex, no por lista fija, así que aunque aparezca una tercera grafía la normalización aguanta |
| A2 | El primer-evento pre-2022 (≤15 boletines) es ruido histórico, no ingresos reales | SC1/SC2 | Bajo — son <0.4% del corpus; excluirlos no distorsiona "nuevos ingresos 2022-2026" |
| A3 | La primera página de `leyes_promulgadas.aspx` trae el lote reciente sin necesitar postback `__VIEWSTATE` | SC3 | Medio — si el paginado exige postback, el conector SEN-06 necesita el patrón 2-pasos (ya documentado en CLAUDE.md); no bloquea el verdict "viable" |
| A4 | Los eventos con `camara=NULL` (2.261) no sesgan las señales por-proyecto | SC2 | Bajo — las señales honestas (velocity, urgencias) son por-boletín/fecha, no dependen de la cámara |

## Open Questions

1. **Semántica de archivados/retirados** — "Desarchivo" y "retira y hace presente" invierten el sentido del texto.
   - What we know: los eventos están fechados y son ~6.137; el `estado` del proyecto (Archivado 400 / Retirado 34) es separado.
   - What's unclear: si la señal "archivados recientes" debe basarse en el EVENTO (fechado, pero incluye desarchivos) o en el ESTADO (limpio, pero sin fecha real).
   - Recommendation: Phase 99 usa el EVENTO fechado filtrando descripciones que empiecen con "Desarchivo"/"retira y hace presente"; declara la señal como "movimiento de archivo/retiro" fechado, no como "proyectos actualmente archivados".

2. **Estado de urgencia vigente vs evento de urgencia** — la señal honesta es de EVENTOS de urgencia fechados, no de "urgencia vigente hoy" (no hay dato de vencimiento auditado).
   - Recommendation: Phase 99 presenta "se calificó urgencia el DD/MM", no "tiene urgencia vigente", salvo que se audite un campo de vencimiento.

## Sources

### Primary (HIGH confidence)
- DB viva Supabase `bctyygbmqcvizyplktuw` (sa-east-1), queries read-only ejecutadas 2026-07-24 — schema, frescura, conteos de voto, primer-evento (todas reproducibles arriba)
- `curl` probes 2026-07-24: BCN `portada_ulp` (9.771 B, SPA+reCAPTCHA) y Cámara `ProyectosDeLey/leyes_promulgadas.aspx` (3.77 MB, ASP.NET server-rendered con datos inline)
- `CLAUDE.md` — patrón cheerio+VIEWSTATE para ASP.NET WebForms (HIGH), regla dos-etapas, rate-limit
- `.planning/research/PITFALLS.md` — Pitfall #1 (ausencia≠hecho) y #2 (sesgo cámara), confirmados empíricamente

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` / `ARCHITECTURE.md` v10.0 — mapeo de señales candidatas a schema, decisión materializador (contexto)

## Metadata

**Confidence breakdown:**
- Clasificación de señales (SC1): HIGH — cada veredicto con query+resultado real
- Auditoría tramitacion_evento (SC2): HIGH — frescura/cobertura/defectos medidos directamente
- fecha_captura reality check: HIGH — cluster de backfill 44.847/2026-07-10 es prueba concluyente
- Verdict leyes-publicadas (SC3): HIGH — dos probes reales, shape inspeccionado
- Similitud de voto (SC4): HIGH — conteos y fail-closed verificados; corrige el número asumido del CONTEXT

**Research date:** 2026-07-24
**Valid until:** 2026-08-07 (14 días — la frescura de datos y la estructura de fuentes externas pueden cambiar; los defectos estructurales `fecha_captura`/`fecha=2626`/grafía-camara son estables hasta que se corrijan en ingesta)
