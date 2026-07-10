# 63 — Alcance histórico del backfill (decisión + porqué)

**Fecha:** 2026-07-10
**Fuente de enumeración:** `run-enumerar-historico-cli.ts` (WSLegislativo.asmx, `retornarMocionesXAnno` + `retornarMensajesXAnno`), corrido LIVE año por año con UA identificatorio y rate-limit 2-3s.
**Baseline PROD antes del backfill:** `proyecto=156`, `proyecto_ficha=74`, `proyecto_embedding=74`, `sin_ficha=82`.

---

## 1. Volumen real por año (enumeración LIVE)

| Año  | Boletines (mociones + mensajes) | Nota |
|------|--------------------------------:|------|
| 2022 | 846 | año completo |
| 2023 | 890 | año completo (pico) |
| 2024 | 800 | año completo |
| 2025 | 707 | año completo |
| 2026 | 405 | **año en curso** (parcial, hasta 2026-07-10) |
| **Total único 2022→2026** | **3.648** | dedup global entre años |

Listas crudas persistidas en `boletines-historico/<año>.txt` (una por línea) para reanudabilidad.

### Cruce con el corpus actual (156 en PROD)

- **142** de los 156 proyectos ya en PROD caen dentro del rango 2022→2026 (ya ingeridos por el cron/backfills previos).
- **14** son anteriores a 2022 (boletines viejos referenciados por votaciones/citaciones) — quedan tal cual, no se tocan.
- **Net-new a ingerir en 2022→2026: 3.506 boletines.**

> Verificación de un año conocido (A1): el volumen 2022→2026 (~800/año completo) es coherente con la producción legislativa real de la Cámara (mociones + mensajes). Confirma que la enumeración vía `WSLegislativo` (mociones **y** mensajes) cubre ambas iniciativas — no solo mociones — sin agujeros por tipo. El WS de votaciones (anti-patrón conocido) habría devuelto `[]` al enumerar por año; WSLegislativo es la fuente correcta.

---

## 2. Alcance ELEGIDO + el porqué

### Decisión: **período legislativo vigente 2022→2026 completo (3.648 boletines; 3.506 net-new), ingeridos en LOTES POR AÑO, del más reciente al más antiguo.**

**Orden de ejecución:** `2026 → 2025 → 2024 → 2023 → 2022`.

### Porqué de este alcance

1. **Valor para /buscar decrece con la antigüedad.** El usuario busca proyectos vigentes/activos y recientes. Priorizar 2026→2025 primero garantiza que el corpus más consultado esté buscable primero, aunque la corrida completa tarde.

2. **Costo real del backfill = horas, no minutos.** Cada boletín net-new implica: (Etapa-1) fetch tramitación + persistencia R2 content-addressed; (pipeline) fetch del PDF `link_mensaje_mocion` + extracción DeepSeek de idea matriz + embedding Gemini 768. Con rate-limit 2-3s obligatorio (WAF gob), el piso es ~10-15 s/boletín. **3.506 net-new ≈ 12-15 h de corrida LOCAL.** Por eso se corre por AÑO en lotes reanudables (`proyecto_ficha.estado`), no en una sola invocación monolítica.

3. **Por qué NO extender antes de 2022.** El rango candidato del plan era 2022→2026. Extender hacia atrás (2018, 2014…) multiplicaría el costo (~800/año adicional) por proyectos mayoritariamente ya tramitados/archivados, de bajo valor de búsqueda ciudadana. Se documenta como **techo de alcance deliberado**, no como omisión: si en el futuro se quiere el histórico profundo, el mismo CLI (`--desde 2018`) lo enumera y el mismo `run-tramitacion-prod-cli --boletines` lo ingiere — sin re-arquitectura.

4. **Por qué NO acotar por debajo de 2022.** Aunque 3.648 es grande, es el **período legislativo actual** (Congreso 2022-2026): el conjunto mínimo para que "la búsqueda funcione con todos los históricos" en el sentido de la queja del operador (v6.1). Acotar a solo 2025-2026 dejaría fuera la mayoría del período vigente. El equilibrio elegido = período vigente completo, ejecutado por año para no exceder ventanas ni martillar la fuente.

5. **Reanudabilidad como principio.** La Etapa-1 R2 es content-addressed idempotente (`If-None-Match`; existed=true = skip). El pipeline lee `estado='pendiente'`. Si un lote/año falla a mitad, se retoma sin re-descargar lo ya en R2 ni re-procesar lo ya `embebido`. Esto hace segura la corrida por lotes acotados.

### Resumen operativo del alcance

- **Ingerir (tramitación → R2 → proyecto):** los 3.506 net-new de `boletines-historico/_netnew.txt`, en lotes por año.
- **Seed:** `seedFichasPendientes()` sobre TODO proyecto sin ficha (cierra el gap 82 actual + los nuevos históricos) → `count(proyecto)==count(proyecto_ficha)`.
- **Pipeline:** `pipeline-cli --limite N` reanudable hasta agotar `pendiente`; luego `--reembed` para los 8 `v1` stale.
- **Techo honesto declarado (NO reintentar):** 8 RUT-bloqueados (permanente, `assertNoRutInLlmInput` LOCKED), 1 PDF escaneado, ~3-5 sin idea literal / schema-fail (reintento único).

---

## 3. Artefactos generados por Task 1

- `boletines-historico/2026.txt` (405) · `2025.txt` (707) · `2024.txt` (800) · `2023.txt` (890) · `2022.txt` (846)
- `boletines-historico/_netnew.txt` (3.506 net-new, boletines aún no en PROD dentro del rango)
- `boletines-historico/_all_c.txt` (3.648 únicos enumerados, sort C)
- Este documento (`63-ALCANCE-HISTORICO.md`) = decisión + porqué.

_Task 2 ingiere `_netnew.txt` por año-lote (R2 primero) + corre el seed. Task 4 corre el pipeline + reembed y reporta el techo honesto en `63-COBERTURA-REPORTE.md`._
