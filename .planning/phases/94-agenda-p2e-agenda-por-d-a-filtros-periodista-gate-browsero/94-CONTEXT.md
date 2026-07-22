# Phase 94: AGENDA P2e — /agenda por día + filtros periodista + gate BrowserOS - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommendations auto-accepted per run directive)

<domain>
## Phase Boundary

Entregar /agenda navegable POR DÍA (tz America/Santiago) con filtros de periodista, estados de cancelación honestos y cobertura parcial DECLARADA — solo después de la auditoría 93 (gate PASSED), reusando el modelo existente (citacion/citacion_punto/sesion_sala/sesion_tabla_item/buscar_citaciones). Incluye los FIXES de los 2 gaps de wiring confirmados en 93 (reporte operador 2026-07-22): citaciones pasadas y tabla de sala en la ficha del proyecto. Gate BrowserOS "comprensible" (LOCKED). Requirements: CIT-02, CIT-03, CIT-04, CIT-05.

</domain>

<decisions>
## Implementation Decisions

### Estructura por día (CIT-02)
- Agrupación POR DÍA calendario en tz **America/Santiago** — REGLA LOCKED: jamás agrupar por UTC (una citación de las 21:00 de Chile no puede caer en el día siguiente). Usar Intl/date-fns-tz o el helper existente del repo si lo hay (el patrón `at time zone 'America/Santiago'` ya existe server-side en 0048).
- Dentro de cada día: Cámara vs Senado y sala vs comisiones distinguidas (chips/secciones — el UI-SPEC define).
- Unidad de carga: semana ISO (modelo existente, `?semana=YYYY-Www` ya funciona); "esta semana" = default; navegación semana anterior/siguiente se mantiene.

### Filtros periodista (CIT-03) — island client-side
- Island `agenda-filtros` (contrato FichaRail: JAMÁS toca Supabase; recibe slice serializado): filtro por cámara, por comisión (facetas de lo cargado), por rango de fechas dentro de lo cargado, por boletín mencionado (input con el detector de boletín existente), vista "esta semana".
- Counts honestos "de estos N" (patrón 88/91); facetas vacías deshabilitadas; bucket "Sin dato" donde aplique.
- La búsqueda FTS `buscar_citaciones` existente se mantiene (no se reemplaza).

### Honestidad (CIT-05)
- Canceladas/reagendadas: `citacion.estado` SIEMPRE visible cuando existe ("Suspendida"/"Sin efecto" con estilo sobrio no-alarmista); regla LOCKED de la auditoría: "estado ausente ≠ vigente confirmado" — copy explícito en la leyenda de cobertura.
- Banner de cobertura DECLARADA (insumo §7+§8 de 93-AUDITORIA-CITACIONES.md): comisiones Cámara desde 2026-W20 (parcial, THIN), comisiones Senado forward-only desde su ventana, sala Cámara 2 sesiones (W26/W30, 41 items), sala Senado forward-only. Nunca presentar el calendario como completo. Las cifras del banner NO se hardcodean como verdades eternas: derivar dinámicamente lo derivable (min/max de DB) y declarar lo estructural (forward-only de la fuente).

### Fixes de wiring (gaps 93 — reporte operador, CIT-04)
- Gap #1: `estado-actual-block.tsx:122` — citaciones PASADAS visibles en la ficha del proyecto: mantener la vigente/próxima como principal, y mostrar honesto el historial ("Citado el {fecha} en {comisión}" marcado como pasado) — sin fabricar vigencia.
- Gap #2: la ficha del proyecto lee `sesion_tabla_item` — "En tabla de sala ({cámara}) del {fecha}" con link a /agenda de esa semana; count honesto si aparece en varias.
- Cross-link comisión→membresía (CIT-04): donde /agenda muestra una comisión con página propia de membresía (datos de 90), enlazar de forma factual si es barato — si no, diferir declarándolo.

### Operación
- Deploy Cloudflare al cierre + gate BrowserOS "comprensible" (criterio de éxito LOCKED): cold-read de /agenda — ¿se entiende qué pasa esta semana, qué está cancelado, qué cobertura falta? Evidencia DOM (precedente CDP-timeout).
- Suite verde por plan; linter anti-insinuación cubre superficies nuevas si hay copy nuevo; sin RPC nueva prevista (lecturas existentes) — si aparece una, aguja completa (allowlist+pgTAP+revoke).

### Claude's Discretion
- Diseño visual del día-header y las distinciones (UI-SPEC).
- Si el rango de fechas del filtro es slider/inputs.
- Forma exacta del banner de cobertura.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- app/app/agenda/page.tsx (lee citacion+invitados+puntos por semana; `?semana=` funciona — evidencia 93-02: W26 renderizó 53 citaciones pasadas).
- Datos post-93: citacion camara=164 (W20..W28+), senado=114; sesion_sala 2 Cámara (19+22 items) + 11 Senado (27 items); % cancelación ~6-9%.
- buscar_citaciones FTS (0032/0033); boletin-detector (86/89); islands buscar-filtros/parlamentarios-filtro (patrón); banner/leyendas plantillas 91/92.
- 93-WIRING-EVIDENCIA.md: sujetos reproducibles (18193-06 citación pasada, 13665-07 en tabla W28, 11929-13 control).
- comision/comision_membresia pobladas (90) para CIT-04.

### Established Patterns
- tz America/Santiago server-side: 0048:119 `at time zone`.
- Counts honestos, empty states, leyendas 1× por sección, NEGACIONES_LOCKED si el copy niega términos prohibidos.
- Deploy Docker runbook + BrowserOS DOM-first.

### Integration Points
- El banner de cobertura consume §7+§8 de 93-AUDITORIA-CITACIONES.md.
- Los fixes de ficha tocan estado-actual-block.tsx (compartido con 88-89) — cuidar tests existentes.

</code_context>

<specifics>
## Specific Ideas

- Día-header estilo "Lunes 22 de julio" con count del día; días sin actividad declarados ("Sin actividad registrada" vs "sin datos" según cobertura).
- Sujetos de validación BrowserOS: /agenda?semana=2026-W26 (histórico), semana vigente, ficha 18193-06 (citación pasada visible), ficha 13665-07 (tabla de sala visible).

</specifics>

<deferred>
## Deferred Ideas

- Alertas/suscripción por comisión o boletín — v10.
- Página propia por comisión (más allá del cross-link factual) — v9.x/v10.
- Ingesta de actas/resultados — v10.

</deferred>
