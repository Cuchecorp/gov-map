# Phase 93: AGENDA P2d — AUDITORÍA de cobertura de citaciones (GATE duro de 94) - Research

**Researched:** 2026-07-22
**Domain:** Auditoría de cobertura (discovery + medición) de agenda legislativa: citaciones de comisiones y tabla de sala, {Cámara, Senado}. NO ingesta net-new ni UI.
**Confidence:** HIGH (todos los endpoints y counts medidos EN VIVO esta sesión; 11 requests curl + 6 queries psql contra PROD)

## Summary

Esta fase es una **auditoría medible**, no un build. El código de ingesta (`packages/agenda`) ya cubre las 4 celdas de la matriz `{sala, comisiones} × {Cámara, Senado}` con conectores probados. La medición de esta sesión CONFIRMA los 3 hallazgos previos y refina uno importante: **Cámara citaciones SÍ tiene histórico por semana ISO** (no es forward-only como el Senado). El trabajo de la fase es: (1) medir M (universo) por celda con un sondeo acotado en vivo — YA HECHO en gran parte aquí; (2) medir N por celda con psql — YA HECHO aquí; (3) auditar el wiring frontend con BrowserOS sobre PROD; (4) declarar la cobertura parcial honesta como insumo del gate de 94.

**Hallazgo rector de wiring (nuevo, no medido en vivo aún — pendiente BrowserOS):** la ficha de proyecto (`estado-actual-block.tsx:116-137`) deriva `citacionVigente` con un filtro **forward-only** (`futuras = citaciones.filter(fecha >= hoy)`) — una citación PASADA de un proyecto NO se muestra en su ficha aunque esté en DB. Esto, sumado al forward-only del Senado, explica el reporte del operador de "citaciones mal wired". La /agenda por semana SÍ muestra pasadas y futuras (navega por `semana_iso`), pero la ficha sesga a futuro.

**Primary recommendation:** No escribir schema ni conectores nuevos. La fase produce `93-AUDITORIA-CITACIONES.md` con la matriz N/M (los números ya están medidos abajo), la confirmación de los 3 hallazgos, los gaps de wiring con evidencia DOM de BrowserOS, y la DECLARACIÓN de cobertura parcial. Un backfill ACOTADO de Cámara citaciones (histórico disponible, curl pasa el WAF con GET) es el único candidato de ingesta, y aún así opcional para la auditoría — su función es subir N para las celdas medibles.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Matriz de auditoría (medir, no asumir):** Celdas `{sala, comisiones} × {Cámara, Senado}`. Por celda: universo M (medido en vivo curl-first), N en DB (medido por psql), N/M declarado con fechas de rango.
- **Estado DB HOY (medido 2026-07-22 en CONTEXT):** citacion=138, citacion_punto con boletín=133, sesion_tabla_item=46 — thin; el universo real se mide en esta fase.
- **Hallazgos previos a CONFIRMAR o refutar:** (a) Senado comisiones forward-only (sin histórico); (b) Cámara sala thin (PDF→DeepSeek); (c) comisiones unidas/especiales presentes o ausentes por fuente.
- **Wiring frontend:** medir con BrowserOS sobre PROD qué renderizan /agenda y la ficha del proyecto vs los counts de DB; declarar gaps concretos con evidencia DOM.
- **Endpoints candidatos (curl-first, WAF, rate-limit 2-3s, UA identificatorio):** Senado PHP clásico `?mo=comisiones&ac=citacionesComision`; Cámara `citaciones_semana.aspx?prmSemana=AAAA-NN` + `getComisiones_Vigentes` (opendata); Senado portal Next.js `__NEXT_DATA__` como fallback. Cada endpoint: veredicto UP/DOWN/parcial con evidencia + histórico sí/no.
- **Backfill (dos-etapas LOCKED):** lo faltante se ingiere fuente→R2→Supabase con `--from-r2` replay; hash-check antes de descargar; NUNCA ráfagas. Corrida ACOTADA por el agente; backfill masivo histórico = runbook operador-LOCAL. Reusar conectores existentes; schema nuevo SOLO si aditivo e imprescindible.
- **Salida:** `93-AUDITORIA-CITACIONES.md`: matriz N/M por celda con fechas, veredicto por endpoint, confirmación/refutación de los 3 hallazgos, gaps de wiring con evidencia BrowserOS, DECLARACIÓN de cobertura parcial (nunca presentada como completa).
- **Esta fase NO toca UI** (regla LOCKED "antes de tocar UI"). Los fixes van en 94.

### Claude's Discretion
- Rango exacto del backfill acotado del agente.
- Forma de la evidencia (tablas del reporte).
- Si el freshness CLI gana señales nuevas de citaciones aquí o en 94.

### Deferred Ideas (OUT OF SCOPE)
- Backfill histórico masivo completo (runbook operador-LOCAL).
- Ingesta de actas/resultados de comisiones — v10.
- Fixes de UI (94).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CIT-01 | Auditar cobertura de citaciones (medir N/M por celda antes de tocar UI); declarar cobertura parcial con evidencia | Todos los endpoints medidos en vivo (§ Sondeo Empírico); N por celda medido por psql (§ Métricas DB); wiring frontend mapeado (§ Wiring Frontend) — la fase compone estos hallazgos en `93-AUDITORIA-CITACIONES.md` |
</phase_requirements>

## Sondeo Empírico de Endpoints (EN VIVO, 2026-07-22)

**Protocolo:** curl-first, UA `ObservatorioCongreso360/1.0 (contacto: sanchez.rossi@gmail.com)`, rate-limit ≥3s entre hosts distintos. 11 requests totales.

| # | Endpoint | HTTP | Veredicto | Histórico | Notas |
|---|----------|------|-----------|-----------|-------|
| 1 | `web-back.senado.cl/api/commissions_citations?limit=100` | 200 | **UP** | **NO (forward-only)** `[VERIFIED: curl]` | 6 días, rango 22/07→05/08/2026, 20 citaciones; incluye "Comisión Mixta para Boletín N°..." y "Comisión Especial de Zonas Extremas" |
| 2 | `web-back.senado.cl/api/weekly_table?limit=100` (sala Senado) | 200 | **UP** | **NO (forward-only)** `[VERIFIED: curl]` | 3 sesiones (21-22/07/2026); TABLA con POSICION/MATERIA/BOLETIN estructurado |
| 3 | `www.senado.cl/appsenado/index.php?mo=comisiones&ac=citacionesComision` | 301→200 | **PARCIAL / no-usable** `[VERIFIED: curl]` | — | 301 a `tramitacion.senado.cl/...`; el destino da 200 pero **0 bytes** (shell vacío que hidrata vía JS/AJAX). NO reemplaza la API backend. `wspublico/citaciones.php` = 404 |
| 4 | `www.camara.cl/.../citaciones_semana.aspx?prmSemana=2026-30` (vigente) | 200 | **UP** `[VERIFIED: curl]` | **SÍ** | 210KB HTML; 4× `article.grid-12.citaciones`, `class="fecha"` es-CL. **GET simple pasa el WAF con solo UA** (no requiere ViewState POST). `__VIEWSTATE` presente pero no necesario para leer |
| 4b | mismo, `prmSemana=2026-20` (mayo, PASADA) | 200 | **UP — histórico confirmado** `[VERIFIED: curl]` | **SÍ** | 214KB, 4 días de mayo con fechas reales → **Cámara citaciones tiene histórico por semana ISO** (refuta "todo forward-only") |
| 5 | `www.camara.cl/verDoc.aspx?prmId=0&prmTipo=TABLASEMANAL` (sala Cámara PDF) | 200 | **UP** `[VERIFIED: curl]` | prmId=0 = vigente | `application/pdf`, `%PDF-1.7`, 161KB. Requiere `Referer: .../sala_sesiones/tabla.aspx`. Único artefacto de sala Cámara (no estructurado → DeepSeek) |
| 6 | `opendata.camara.cl/.../WSComisiones.asmx/getComisiones_Vigentes` | 302 | **DOWN (mantención)** `[VERIFIED: curl]` | — | 302 → `/mantencion.html` — confirma el hallazgo previo: WSComisiones sigue en mantención |
| 7 | `opendata.camara.cl/wscamaradiputados.asmx` (WSDL host) | 200 | **host UP** `[VERIFIED: curl]` | — | El host ASMX responde (WSDL disco); solo el PATH WSComisiones está caído. doGet.asmx JSON sigue vivo para votos (Phase 64) |
| 8 | `tramitacion.senado.cl/wspublico/tramitacion.php` (baseline) | 200 | **UP** `[VERIFIED: curl]` | — | Responde ("No existe el número..." con boletín inválido) → wspublico del Senado vivo (baseline no-agenda) |

**Fallback Senado Next.js `__NEXT_DATA__`:** NO sondeado explícitamente esta sesión (la API backend está UP → innecesario). Sigue documentado en `connector-senado.ts:70` (`fetchVia_NextData`), buildId autodetectado, NUNCA hardcodeado. Solo se activaría si `web-back.senado.cl` cae.

## Métricas DB — N por Celda (psql PROD, 2026-07-22)

Queries verbatim (ejecutar con `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c`).

### Matriz principal N/M

| Celda | N (DB) | M (universo hoy) | Rango DB (fecha) | Fuente M | Veredicto cobertura |
|-------|--------|------------------|------------------|----------|---------------------|
| **comisiones × Cámara** | **34 citaciones** | histórico completo por semana (∞ semanas navegables); ~20-40/semana | 2026-06-22 → 2026-07-07 | citaciones_semana.aspx (UP, histórico) | **THIN** — solo 2 semanas ISO capturadas; universo histórico enorme sin ingerir |
| **comisiones × Senado** | **104 citaciones** | 20 en la ventana forward de hoy (22/07→05/08) | 2026-06-23 → 2026-07-24 | commissions_citations (UP, forward-only) | **AL DÍA en su ventana** — 5 semanas ISO; sin histórico posible por la fuente |
| **sala × Cámara** | **1 sesión / 19 items** | 1 PDF/semana (verDoc prmId=0, solo vigente) | 2026-06-22 | verDoc PDF→DeepSeek (UP) | **THIN** — 1 sola sesión ingerida; sin histórico estructurado (solo PDF vigente) |
| **sala × Senado** | **11 sesiones / 27 items** | 3 sesiones en ventana forward de hoy | 2026-06-23 → 2026-07-15 | weekly_table (UP, forward-only) | **AL DÍA en su ventana** — sin histórico posible por la fuente |

**Query matriz principal (verbatim):**
```sql
select 'citacion_'||camara, count(*), min(fecha)::date, max(fecha)::date from citacion group by camara
union all
select 'sesion_sala_'||camara, count(*), min(fecha)::date, max(fecha)::date from sesion_sala group by camara
order by 1;
```
Resultado medido: `citacion_camara|34|2026-06-22|2026-07-07`, `citacion_senado|104|2026-06-23|2026-07-24`, `sesion_sala_camara|1|2026-06-22|2026-06-22`, `sesion_sala_senado|11|2026-06-23|2026-07-15`.

### Boletines (cruce a la ficha) por celda

| Celda | Puntos/Items | Con boletín | % cruzable |
|-------|--------------|-------------|-----------|
| citacion_punto × Cámara | 35 | 35 | 100% |
| citacion_punto × Senado | 139 | 98 | ~71% |
| sesion_tabla_item × Senado | 27 | 22 | ~81% |
| sesion_tabla_item × Cámara | 19 | 15 | ~79% |

**Query verbatim:**
```sql
select c.camara, count(*) puntos, count(cp.boletin) con_boletin
from citacion_punto cp join citacion c on c.id=cp.citacion_id group by c.camara;
select s.camara, count(*) items, count(sti.boletin) con_boletin
from sesion_tabla_item sti join sesion_sala s on s.id=sti.sesion_id group by s.camara;
```
Nota: los totales de puntos (35+139=174) difieren del CONTEXT (133 con boletín) porque el CONTEXT contaba solo con-boletín en un snapshot anterior; el count VIVO de hoy es 35+98=133 con boletín. Consistente.

### Estado de cancelación/reagendo poblado (insumo del modelado honesto de 94)

| Celda | Total | Con `estado` no-null | % |
|-------|-------|----------------------|---|
| Cámara | 34 | 3 | ~9% |
| Senado | 104 | 6 | ~6% |

**Query verbatim:**
```sql
select camara, count(*) total, count(estado) con_estado from citacion group by camara;
```
**Implicación para 94:** la mayoría de citaciones NO tienen estado de cancelación poblado. `SIN_EFECTO=1` del Senado se mapea a `estado="Sin efecto"` (parse-senado-citaciones.ts:96,132); Cámara lo lee de `<p style="color:red">` (parse-camara-citaciones.ts:197). El bajo % es porque la mayoría de citaciones NO fueron canceladas (dato honesto), no un bug — pero 94 debe declarar que "estado ausente ≠ vigente confirmado" (no fabricar vigencia).

### Semanas ISO distintas cubiertas

| Celda | Semanas ISO distintas |
|-------|----------------------|
| citacion × Cámara | 2 |
| citacion × Senado | 5 |

## Confirmación/Refutación de Hallazgos Previos

| # | Hallazgo previo | Veredicto MEDIDO | Evidencia |
|---|-----------------|------------------|-----------|
| (a) | Senado comisiones forward-only (sin histórico) | **CONFIRMADO** | Probe 1: rango 22/07→05/08/2026, sin fechas pasadas; API no acepta parámetro de fecha histórica |
| (b) | Cámara sala thin (PDF→DeepSeek, ~1 sesión) | **CONFIRMADO** | DB: `sesion_sala_camara=1`; Probe 5: solo PDF vigente (prmId=0), sin histórico estructurado |
| (c) | comisiones unidas/especiales presentes por fuente | **CONFIRMADO presentes en Senado** | Probe 1: "Comisión Mixta para Boletín N°18216-05", "Comisión Especial de Zonas Extremas". Cámara: verificar en el HTML de 94 (comisiones unidas aparecen como filas normales en citaciones_semana) |
| (NUEVO) | ¿Cámara citaciones forward-only? | **REFUTADO — tiene histórico** | Probe 4b: `prmSemana=2026-20` (mayo) devuelve 200 con días reales. Cámara citaciones es navegable por cualquier semana ISO pasada |

## Wiring Frontend — Mapa de Riesgo (a confirmar con BrowserOS)

Análisis del código (evidencia estática; el gate de la fase es CONFIRMAR con DOM en PROD).

### /agenda (`app/app/agenda/page.tsx`)
- **Citaciones** (`CitacionesSection`, línea 277): lee `citacion` filtrado por `semana_iso` exacto (`.eq("semana_iso", key)`), ambas cámaras, agrupa por día. **Muestra pasadas y futuras** de la semana navegada. WIRING OK conceptualmente; el gap es de DATOS (solo 2 semanas Cámara ingeridas → semanas vacías fuera de rango muestran "No hay citaciones").
- **Tabla de sala** (`SalaTableServer`, línea 453): rango semi-abierto `[lunes, lunes+1)`. Senado `mode=available`; Cámara degrada al PDF si 0 filas. Distingue "fuera de ventana forward Senado" (línea 494-513) — WIRING OK. Gap = DATOS (1 sesión Cámara, forward-only Senado).

### Ficha de proyecto (`app/components/estado-actual-block.tsx`)
- **`citacionVigente`** (línea 116-137): query `citacion_punto → citacion` por boletín (línea 312), luego **filtra SOLO futuras** (`futuras = citaciones.filter(c => fecha >= hoy)`, línea 122) y toma la más próxima. **GAP DE WIRING CONFIRMABLE:** una citación PASADA de ese proyecto NO se renderiza en su ficha aunque esté en DB. La línea "Citado en {comision} el {fecha}" (línea 271) desaparece en cuanto la fecha pasa. Para prensa que revisa un proyecto histórico, esto oculta que fue citado. **Es candidato #1 del reporte de wiring del operador.**
- **sesion_tabla_item NO se lee en la ficha:** la ficha no muestra "está en la tabla de sala de esta semana". Solo /agenda lo muestra. Gap de wiring: un proyecto en tabla de sala no lo declara su ficha.

### Evidencia BrowserOS a capturar (plan de 94, DECLARAR aquí)
1. /agenda semana vigente (2026-W30): ¿render de citaciones Cámara+Senado? Contra DB (Cámara W30 = 0 filas → esperado "No hay"; Senado sí).
2. /agenda semana pasada con datos (ej. 2026-W26): ¿muestra las 34 Cámara / 104 Senado ingeridas?
3. Ficha de un proyecto con citación PASADA en DB: ¿aparece "Citado en..."? (esperado: NO, por el filtro forward-only) → declarar como gap.
4. Ficha de un proyecto en sesion_tabla_item: ¿lo declara? (esperado: NO) → declarar como gap.

## Inventario de Conectores `packages/agenda` (celda → archivo)

| Celda de la matriz | Conector (fetch) | Parser | CLI |
|--------------------|------------------|--------|-----|
| comisiones × Cámara | `connector-camara.ts:75` `CitacionesCamaraConnector.fetchSemana` (curl transport, WAF) | `parse-camara-citaciones.ts` (cheerio, `article.citaciones`) | `run-agenda-prod-cli.ts` (`--desde/--hasta` semanas ISO) |
| comisiones × Senado | `connector-senado.ts:55` `fetchCitaciones` (`commissions_citations`, fetch nativo) | `parse-senado-citaciones.ts` (JSON, forward-only) | mismo CLI |
| sala × Senado | `connector-senado.ts:60` `fetchTablaSala` (`weekly_table`) | `parse-senado-tabla.ts` (JSON) | mismo CLI |
| sala × Cámara | `connector-camara.ts:126` `fetchTablaSalaPdf` (verDoc PDF, Referer) | `parse-camara-tabla.ts` (unpdf → DeepSeek `json_object` + zod) | mismo CLI (gateado por `DEEPSEEK_API_KEY`) |

**CLI de operador:** `tsx packages/agenda/src/run-agenda-prod-cli.ts [--dry-run] [--solo-senado] [--desde YYYY-Www] [--hasta YYYY-Www]`. Default: semana actual + próximas 2. Credenciales solo de `.env`. Idempotente (upsert por clave natural). Orquestación en `ingest-run.ts`.

**Reuso para backfill acotado:** el CLI YA acepta `--desde`/`--hasta` de semanas ISO pasadas → un backfill acotado de Cámara citaciones histórico es `--desde 2026-W20 --hasta 2026-W29 --solo-senado`(NO, quitar solo-senado) — el conector Cámara con curl pasa el WAF (Probe 4b confirma histórico disponible). **NOTA:** `ingest-run.ts` no expone hoy R2 para las citaciones de Cámara (solo para la tabla PDF, `TablaR2Target`); un backfill dos-etapas puro para citaciones Cámara exigiría threadear R2 al paso 1 (extensión menor). Para la AUDITORÍA basta el fetch directo (medir M); para el WRITE dos-etapas LOCKED, ver Riesgos.

## Cómo Estimar M (universo) sin Crawl Masivo

- **comisiones × Cámara:** M = ilimitado histórico. Estimar M-por-semana con la semana vigente + 2 pasadas (Probe 4/4b ya dan la forma). No hay endpoint de "conteo total"; el universo es "toda semana ISO desde el inicio del período legislativo". Declarar M como "histórico completo navegable, ~20-40 citaciones/semana; ingerido: 2 semanas".
- **comisiones × Senado:** M = la ventana forward-only de hoy (20 citaciones, 22/07→05/08). No hay universo histórico por la fuente. M = "solo lo que la API expone hoy hacia adelante".
- **sala × Senado:** M = ventana forward (3 sesiones). Igual: sin histórico.
- **sala × Cámara:** M = 1 PDF vigente/semana. Histórico de PDFs requeriría enumerar `prmId` (no `prmId=0`) — fuera de alcance; declarar M = "solo la semana vigente vía prmId=0".

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|--------------|------|---------|
| Semana ISO / enumeración | aritmética de fechas naïf | `semana-iso.ts` (`isoWeekOf`, `enumerarSemanas`, `prmSemanaParam`) | ISO-8601 anclado al jueves, años de 53 semanas, ya probado |
| Parse HTML Cámara | regex sobre HTML | `parse-camara-citaciones.ts` (cheerio, shape validado LIVE hoy) | El HTML matchea `article.grid-12.citaciones` exacto |
| Parse JSON Senado | acceso directo | `parse-senado-citaciones.ts` / `parse-senado-tabla.ts` (zod por fila) | Descarta drift, no fabrica |
| Query DB counts | ORM ad-hoc | psql `-tA` directo con las queries verbatim de este doc | Reproducible, verbatim en el reporte |
| Auditoría wiring | inspección manual de screenshots | BrowserOS MCP + `scripts/bros-cli.mjs` | Evidencia DOM real del deploy PROD (lección: cascada solo cazable en deploy real) |

## Runtime State Inventory

Fase de AUDITORÍA (no rename/refactor), pero mide estado runtime por diseño:

| Categoría | Encontrado | Acción |
|-----------|-----------|--------|
| Stored data | `citacion` (138), `citacion_punto` (174), `sesion_sala` (12), `sesion_tabla_item` (46) en PROD | Medir N (HECHO por psql) |
| Live service config | crons: `agenda-weekly.yml` referido en `freshness/catalog.ts:259` (existencia TBD; señal fuente=agenda umbral 7d) | Verificar si el cron existe/corre (auditoría de frescura) |
| OS-registered state | Ninguno — sin tareas OS que embeban citaciones | None |
| Secrets/env vars | `DEEPSEEK_API_KEY` (gatea sala Cámara), `R2_*`, `SUPABASE_*` en `.env` | None (solo lectura) |
| Build artifacts | `packages/agenda/dist/` compilado | None (auditoría no toca build) |

## Common Pitfalls

### Pitfall 1: Confundir "forward-only de la fuente" con "bug de ingesta"
**Qué:** El Senado (comisiones y sala) NO expone histórico — es la FUENTE, no el conector. Declarar la cobertura Senado como "al día en su ventana" (honesto), NO "incompleta por fallo".
**Detección:** Probe 1/2 confirman rango forward-only.

### Pitfall 2: El WAF de Cámara NO bloqueó curl hoy (GET simple)
**Qué:** `citaciones_semana.aspx` respondió 200 con solo UA — sin ViewState POST. PERO el `verDoc.aspx` PDF SÍ exige `Referer` (Probe 5). No asumir uniformidad; el conector ya distingue (`transport-curl` para Cámara, `Referer` para verDoc).
**Detección:** ambos probes UP esta sesión; si en 94/backfill un 403 aparece, `ingest-run.ts` ya degrada honesto (backoff → marca no disponible, no aborta).

### Pitfall 3: El filtro forward-only de la ficha oculta citaciones pasadas
**Qué:** `citacionVigente` (estado-actual-block.tsx:122) solo muestra `fecha >= hoy`. Un proyecto citado la semana pasada NO lo declara su ficha. Es el gap de wiring #1 del operador. NO se arregla aquí (es 94), pero se DECLARA con evidencia BrowserOS.

### Pitfall 4: PostgREST cap 1k al medir en el frontend
**Qué:** las lecturas del frontend van paginadas; la auditoría de N usa psql directo (sin cap). No medir N vía REST del sitio (subestimaría).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cámara `citaciones_semana.aspx` mantiene histórico "ilimitado" hacia atrás | Sondeo 4b | Solo probé W20 (mayo); semanas más antiguas podrían dar vacío/403. Bajo riesgo: la auditoría acota el rango declarado |
| A2 | El cron `agenda-weekly.yml` existe y corre | Runtime State | Referido en catalog.ts pero no verifiqué el archivo YAML ni su ejecución en GH. Verificar en la fase |
| A3 | El gap forward-only de la ficha se confirmará con BrowserOS | Wiring | Si el deploy PROD ya arregló esto (quick 260722-eia tocó deep-links), el gap podría ser distinto. BrowserOS lo dirime |
| A4 | M Cámara comisiones ≈ 20-40/semana | Estimar M | Estimación de 2 semanas sondeadas; el reporte lo declara como estimación, no censo |

## Open Questions

1. **¿Existe y corre el cron `agenda-weekly.yml`?**
   - Sabemos: `catalog.ts:259` lo referencia como workflowYml.
   - No claro: si el archivo existe en `.github/workflows/` y si tiene los secrets (DEEPSEEK/R2/SUPABASE).
   - Recomendación: verificar el YAML en la fase; si falta, es un gap de frescura a declarar.

2. **¿El backfill acotado de Cámara histórico debe escribir a PROD o solo medir M?**
   - Sabemos: CONTEXT permite corrida ACOTADA por el agente; masivo = operador-LOCAL.
   - No claro: si el WRITE dos-etapas de citaciones Cámara requiere threadear R2 (hoy `ingest-run.ts` solo pone la tabla PDF en R2, no las citaciones).
   - Recomendación: para la AUDITORÍA, medir M con fetch directo (sin write); dejar el WRITE histórico como runbook operador-LOCAL (espeja 66/67/70). El agente puede correr un rango chico (ej. 3-4 semanas) con write si el planner decide subir N de la celda Cámara.

## Environment Availability

| Dependencia | Requerido por | Disponible | Versión | Fallback |
|-------------|---------------|-----------|---------|----------|
| curl | sondeo endpoints | ✓ | sistema | — |
| psql | medir N en PROD | ✓ | en PATH | — |
| BrowserOS MCP + `scripts/bros-cli.mjs` | auditoría wiring PROD | ✓ (usado en 68/89/91/92) | — | screenshots manuales |
| `SUPABASE_DB_URL` (.env) | psql a PROD | ✓ (presente) | — | — |
| DEEPSEEK_API_KEY | (solo si se re-ingesta sala Cámara) | ✓ (.env) | — | degrada honesto al PDF |
| R2_* | (solo si backfill dos-etapas write) | ✓ (.env) | — | — |

Sin dependencias bloqueantes. Todo lo necesario para la auditoría está disponible y ya se ejercitó esta sesión.

## Validation Architecture

Fase de auditoría (produce un `.md`, no código de producto). La validación es la **reproducibilidad de las mediciones**:
- Las queries psql son verbatim y re-ejecutables (§ Métricas DB).
- Los probes curl son re-ejecutables con el UA declarado.
- El gate de 94 consume `93-AUDITORIA-CITACIONES.md`; su "test" es que las cifras N/M concuerden con una re-corrida de las queries.
- No se agrega test de vitest nuevo (no hay código de producto net-new). Si el planner decide un backfill con write, ese sí reusa la suite de `packages/agenda` existente (parsers ya cubiertos).

## Sources

### Primary (HIGH confidence)
- Sondeo EN VIVO curl 2026-07-22 — 11 requests, todos los veredictos de la tabla de endpoints
- Queries psql PROD 2026-07-22 — todas las cifras N/M
- `packages/agenda/src/*` — conectores, parsers, CLI (rutas:líneas citadas)
- `app/app/agenda/page.tsx`, `app/components/estado-actual-block.tsx` — wiring frontend
- `supabase/migrations/0010_agenda.sql` — modelo (genérico, no requiere schema nuevo)

### Secondary (MEDIUM confidence)
- `packages/freshness/src/catalog.ts` — señal agenda existente (cron referido, no verificado)
- CONTEXT.md + STATE.md — decisiones LOCKED y reporte del operador

## Metadata

**Confidence breakdown:**
- Endpoints (M / veredictos): HIGH — medidos en vivo esta sesión
- N por celda: HIGH — psql PROD directo
- Wiring frontend: MEDIUM-HIGH — análisis de código sólido; confirmación DOM pendiente de BrowserOS (por diseño de la fase)
- Cron/frescura: MEDIUM — referido, no verificado el YAML

**Research date:** 2026-07-22
**Valid until:** ~7 días (fuentes gubernamentales cambian; las ventanas forward-only se desplazan diariamente)
