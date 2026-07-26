# Phase 98 — SPIKE FINDINGS: qué señales del panel son honestas

**Fecha:** 2026-07-24
**Requisitos cerrados:** SEN-01 (auditoría `tramitacion_evento` + clasificación por señal), SEN-06 (verdict leyes publicadas).

> **GATE ARTIFACT** — consumido por Phase 99 (materializador `actualidad_senal`), Phase 100 (panel landing) y Phase 102 (similitud de voto). Toda la evidencia numérica vive en [`98-RESEARCH.md`](./98-RESEARCH.md) (auditoría contra la DB viva, query + resultado real por afirmación); este doc es la **decisión accionable** destilada. Cada claim cita su sección/query en 98-RESEARCH. No se re-corre la auditoría.

---

## Sección 1 — Veredicto por señal (contrato para Phase 99)

Una fila por señal candidata del ROADMAP SC1. Los veredictos son los EXACTOS de la tabla SC1 de 98-RESEARCH. La columna "Guarda de supresión" es lo que Phase 99 DEBE aplicar en el materializador — no es opcional.

| Señal | Veredicto | Guarda de supresión que Phase 99 DEBE aplicar | Evidencia (98-RESEARCH) |
|-------|-----------|-----------------------------------------------|-------------------------|
| **velocity** (movimiento reciente por ventana) | **HONESTA** | Filtrar `fecha <= current_date`; normalizar `camara`; si `max(fecha)` de la fuente > umbral stale → "sin datos frescos de esta fuente" (jamás "sin movimiento"); framing "N trámites en 7 días", NUNCA "top/los más" (T-52-13). | SC1 fila velocity (`170` eventos / `33` boletines en 7 días) |
| **nuevos ingresos** (proyectos ingresados en ventana) | **HONESTA-CONDICIONAL** (solo corpus 2022-2026, vía primer-evento por boletín) — **IMPOSIBLE si usa `fecha_captura`** | EXCLUIR boletines cuyo primer-evento es pre-2022 (eventos históricos de proyectos viejos, no ingresos); declarar cobertura "proyectos ingresados 2022-2026"; NUNCA derivar "nuevo" de `proyecto.fecha_captura`. | SC1 fila nuevos-ingresos + SC2 "Fiabilidad del primer-evento" (2026→404, 2025→706, 2024→800, 2023→889, 2022→844; pre-2022 = ≤3/año) |
| **urgencias vivas del Ejecutivo** | **HONESTA** (eventos de urgencia FECHADOS, no "urgencia vigente") | Filtrar `fecha <= current_date`; presentar el HECHO fechado ("urgencia calificada el DD/MM"), jamás juicio ni "urgencia vigente" sin dato de vencimiento; supresión por frescura igual que velocity. | SC1 fila urgencias (`104` en 30 días; `30` en 7 días) + Open Question #2 |
| **agenda próxima** (votaciones/citaciones futuras) | **HONESTA** | `citacion` tiene filas futuras reales → "coming up" honesto; `sesion_sala` sin futuras HOY se **SUPRIME** ("sin sesiones agendadas en las fuentes consultadas"), no se afirma "no hay sesiones"; reusar la lógica tz Chile de `/agenda` (date-only UTC = día chileno, gotcha LOCKED). | SC1 fila agenda (citacion: `278` total / `7` futuras / max `2026-08-05`; sesion_sala: `16` / `0` futuras) |
| **archivados/retirados recientes** | **HONESTA-CON-CAVEAT** | Filtrar por `descripcion` (evento fechado), NO por `proyecto.estado` (fecha = `fecha_captura` mentirosa); distinguir "Desarchivo" y "retira y hace presente" (invierten el sentido) por descripción o la señal editorializa; declarar "movimiento de archivo/retiro" fechado, no "proyectos actualmente archivados". | SC1 fila archivados (`6.137` eventos; "Desarchivo de proyecto" 71, "…retira y hace presente…" 65/62/61) + Open Question #1 |
| **leyes recién publicadas** | **VIABLE — fuente nueva** (no en DB; vía Cámara `leyes_promulgadas.aspx`) | No materializable en Phase 99 con datos actuales; entra por fase futura SEN-06 (dos-etapas Cámara→R2→Supabase). Ver Sección 5. | SC1 fila leyes + SC3 verdict (DB tiene `estado='Publicado'` 339, SIN fecha de publicación fiable) |

**Señal extra observada** (para Phase 99, no pedida): `proyecto.materia` existe como columna `text` (taxonomía oficial) → label factual reusable para "agrupación por materia" (SEN-05). No auditada en profundidad (no es señal temporal), pero confirmada presente en el schema. Ref: 98-RESEARCH SC1 "Señal extra observada".

---

## Sección 2 — Defectos de datos LOCKED para Phase 99

Imperativo. Phase 99 aplica los tres en TODA agregación del materializador (referencia: 98-RESEARCH SC2 "Defectos de datos a manejar en Phase 99"):

1. **Filtrar `fecha <= current_date` en TODO `max(fecha)`/ventana/corte temporal.** Existen 2 filas con `fecha='2626-05-25'` (boletín `18232-25`, tipo tramite/oficio, "Oficio de ley al Ejecutivo" — typo de parseo por `2026`). Sin el filtro, el sitio diría "último movimiento en el año 2626". Query de prueba: `SELECT count(*) FROM tramitacion_evento WHERE fecha > current_date` → `2`.
2. **Normalizar `camara` SIEMPRE antes de agrupar por cámara.** Hay dos grafías vivas: `C.Diputados` (19.813) y `C. Diputados` (5.930). Normalizar por regex `regexp_replace(camara,'\s+','','g')` — regla, NO lista fija (aguanta una tercera grafía si aparece).
3. **`camara=NULL` (2.261 filas) se agrupa como "(sin cámara)" o se excluye de cortes por cámara — NUNCA se reparte** entre cámaras (no inventar atribución).

---

## Sección 3 — Regla anti-ranking cross-cámara (resuelve T-52-13)

**PROHIBIDO cualquier ranking cross-cámara por conteo.** Cámara tiene 25.741 eventos (saneados) vs Senado 20.357 — esa asimetría es de **cobertura / estilo de registro**, NO de actividad institucional comparable. La frescura sí es casi simétrica (Cámara 1 día stale, Senado 2 días — ambas al día, saneadas con `fecha <= current_date` + `camara` normalizada).

- **Framing PERMITIDO:** "N trámites en 7 días", señales POR proyecto / POR tema, o declarar explícitamente la asimetría de cobertura.
- **Framing PROHIBIDO:** "top", "los más", "la cámara más activa", cualquier orden cross-cámara por volumen.

Evidencia: 98-RESEARCH SC2 "Frescura + cobertura por cámara" (tabla saneada) y "Veredicto de sesgo de cámara (Pitfall #2)".

---

## Sección 4 — Regla del reloj (`fecha_captura` JAMÁS es un hecho)

**LOCKED.** `fecha_captura` es la fecha de SCRAPE, no de un hecho legislativo. Prueba concluyente: 44.847 eventos —cubriendo trámites desde 1995— tienen `fecha_captura = 2026-07-10` (backfill masivo; 93% de las filas capturadas el mismo día). Un evento de 1995 tiene `fecha_captura` 2026-07-10. Ref: 98-RESEARCH SC2b "reality check".

- `fecha_captura` se usa **SOLO** para (a) declarar frescura de la fuente ("datos al día DD/MM") y (b) hash-check de ingesta.
- **JAMÁS** como fecha de un hecho legislativo ni como "fecha de ingreso" de un proyecto. `proyecto` NO tiene `fecha_ingreso` ni `fecha_publicacion`.
- Toda señal temporal se ancla a `tramitacion_evento.fecha` (timestamptz, el reloj real del evento).
- **Guarda de supresión (ausencia ≠ hecho):** si `max(fecha)` de una fuente supera el umbral stale → "sin datos frescos de esta fuente", JAMÁS "sin movimiento". La ausencia de filas en una ventana tiene dos causas indistinguibles sin metadato de frescura. Ref: 98-RESEARCH Pitfall #1.

---

## Sección 5 — Verdict SEN-06 (leyes recién publicadas)

**BINARIO.** Ref: 98-RESEARCH SC3 (dos probes curl-first, UA identificatorio, `sleep 3` entre requests, sin ráfagas).

- **BCN `portada_ulp` → NO-VIABLE.** HTTP 200 pero solo 9.771 bytes: shell de Angular SPA (`inline/polyfills/main.*.bundle.js`) con CERO datos de leyes inline, protegido por reCAPTCHA Enterprise. `grep` de `numero|fecha_publicacion|idNorma|json` → 0 matches. Requeriría headless browser (vetado en Edge Functions por CLAUDE.md) o reverse-engineering de una API tras reCAPTCHA. **DESCARTADA con razón.**
- **Cámara `ProyectosDeLey/leyes_promulgadas.aspx` → VIABLE.** HTTP 200, ~3.769.210 bytes (~3.7 MB de HTML server-rendered), ASP.NET WebForms (`x-aspnet-version: 4.0.30319`, `Set-Cookie: ASP.NET_SessionId`). Datos inline: cabeceras "N° Ley", "Fecha Publicación", "Boletín" y filas reales (`Ley N° 21.831 … BOLETIN=17287-14`, etc.). El boletín cross-referencia directo a `proyecto`/`tramitacion_evento` ya en DB. Es exactamente el patrón HTML ASP.NET + cheerio marcado HIGH-confidence en CLAUDE.md.

**VERDICT:** VIABLE vía Cámara `leyes_promulgadas.aspx`, NO vía BCN. Shape del conector futuro (SEN-06, dos-etapas): `fetch` la .aspx → HTML crudo a R2 content-addressed (`camara/leyes_promulgadas/fecha/sha256.html`, `If-None-Match:*`) → Etapa 2 cheerio parsea la tabla (N° Ley, fecha publicación, boletín) → upsert a Supabase ligando por `boletin`. Rate-limit 2-3s, UA identificatorio, hash-check antes de re-descargar; fallback paginación patrón `__VIEWSTATE` GET→POST. **DIFERIDO a fase futura SEN-06 — NO se construye ahora ni en Phase 99.**

---

## Sección 6 — Insumo Phase 102 (similitud de voto)

**Cifra CORREGIDA:** **283.550 votos confirmados / 186 parlamentarios / 4.852 votaciones.** Ref: 98-RESEARCH SC4.

El número del CONTEXT (~548.642) era ERRÓNEO: correspondía al total de la tabla `voto` (confirmado + no_confirmado = 549.739), no a los confirmados. **Phase 102 cita 283.550, NUNCA 548.642.**

- Desglose por `estado_vinculo`: `confirmado` 283.550 · `no_confirmado` 266.189 (total 549.739).
- Distribución de selección (confirmados): `si` 183.399 · `no` 76.389 · `abstencion` 11.631 · `ausente` 11.000 · `pareo` 1.131.
- **Reconciliación fail-closed verificada:** `SELECT count(*) FROM voto WHERE estado_vinculo='confirmado' AND (parlamentario_id IS NULL OR parlamentario_id NOT IN (SELECT id FROM parlamentario))` → `0`. CERO votos confirmados atados a una identidad inexistente/sintética. `parlamentario` tiene exactamente 186 filas (1:1 con los votantes confirmados).
- **Denominador honesto disponible:** las 4.852 votaciones tienen ≥2 votantes confirmados con selección sustantiva (`si/no/abstencion`, excluyendo `ausente/pareo`).

**Veredicto:** VSIM-01 (métrica pairwise "coinciden en N de M votaciones compartidas") es plenamente computable HOY sin ingesta nueva.

---

## Sección 7 — Handoff a downstream

- **A Phase 99 (materializador):** materializa SOLO las señales HONESTAS de la Sección 1, cada una con su guarda de supresión; aplica los 3 defectos LOCKED de la Sección 2 (`fecha <= current_date`, normalizar `camara`, `camara=NULL` no repartido); en "nuevos ingresos" excluye primer-evento pre-2022 y declara cobertura 2022-2026; ancla toda señal temporal a `tramitacion_evento.fecha`, nunca a `fecha_captura` (Sección 4); añadir pgTAP en `supabase/tests/00XX_actualidad_senal.test.sql` (espeja `0039_cruce_senal.test.sql`) que verifique: ninguna fila `fecha>current_date` alimenta una señal, `camara` normalizada, supresión por frescura dispara.
- **A Phase 100 (panel):** muestra la cobertura declarada + framing anti-ranking de la Sección 3 (nunca "top/los más/la cámara más activa"); suprime sub-señales de fuente stale con el copy "sin datos frescos de esta fuente".
- **A Phase 102 (similitud de voto):** cifra base **283.550** confirmados / 186 / 4.852 (Sección 6), NUNCA 548.642; denominador honesto = votaciones sustantivas donde ambos votaron.
- **A fase SEN-06 (leyes publicadas):** shape del conector Cámara `leyes_promulgadas.aspx` (Sección 5), dos-etapas fuente→R2→Supabase, ligando por boletín; BCN descartada.
