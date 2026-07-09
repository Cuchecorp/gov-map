# Phase 61: COMP — Comprensión de visualizaciones (loop BrowserOS) - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Smart discuss autónomo; el operador pidió explícitamente "usar browseros en cada caso para corregir iterando de modo fino".

<domain>
## Phase Boundary

Que las visualizaciones se entiendan a la primera: leyenda "Cómo leer esto" en cruces (anti-causal explícito), títulos orientados a pregunta + leyenda + fuente/fecha en todo chart, y un loop BrowserOS captura→lectura fría→corrección→re-captura sobre las superficies clave (ficha parlamentario, ficha proyecto incl. nueva autoría, /red, charts v5, y el brand de Phase 60). COMP-01/02/03. Incluye los DOS deploys del ciclo (pre-sweep con 59+60, post-fixes).

</domain>

<decisions>
## Implementation Decisions

### Secuencia (LOCKED)
1. **Plan 01 — mejoras code-first** (antes de gastar deploy): leyenda "Cómo leer esto" en la sección de cruces (parlamentario Y proyecto); auditoría estática de charts v5 (patrimonio, votos/trimestre, comparativo ausencias) contra el triple requisito título-pregunta/leyenda-con-unidades/fuente-fecha-al-pie — corregir lo que falte; misma pasada sobre /red (leyenda de qué es nodo/arista ya existe? verificar).
2. **Plan 02 — deploy #1**: build OpenNext en Docker Linux + wrangler local (gotchas MEMORY: docker vía PowerShell, docker cp ruta Windows explícita, MSYS_NO_PATHCONV, jamás build Windows directo). Sube 59 (autoría) + 60 (brand) + plan 01.
3. **Plan 03 — sweep BrowserOS**: lectura fría de cada superficie (desktop + móvil 390px), veredicto de comprensión por superficie, hallazgos P0 (no se entiende/bloquea) y P1 (fricción de comprensión) con screenshot; corregir TODOS los P0/P1 de comprensión (texto/leyenda/título/orden — cambios de copy y presentación, no re-arquitectura); deploy #2; re-captura con veredicto final por superficie. P2+ quedan documentados.

### Leyenda de cruces (COMP-01, contenido LOCKED en espíritu)
- Título de sección orientado a pregunta (p.ej. "¿Con qué sectores se ha reunido y cómo ha votado?" — ajustar al contenido real de la sección).
- Bloque "Cómo leer esto" SIEMPRE visible (no colapsado): (1) qué es una señal = conteo factual de hechos públicos fechados (reuniones de lobby registradas, votos emitidos) agrupados por sector; (2) cómo leer el número (más señales = más actividad registrada, nada más); (3) qué NO afirma: "Un cruce no afirma influencia, motivo ni causalidad; solo muestra hechos públicos que coinciden en un sector, cada uno con su fuente." Vocabulario del DESIGN-SYSTEM (banned-vocab respetado — la propia leyenda usa 'no afirma' como negación explícita, verificar que el linter lo permita; si el linter prohíbe la palabra incluso negada, redactar sin ella: "solo muestra hechos públicos coincidentes, con su fuente").
- ProvenanceBadge/fuente por señal se mantiene.

### Charts (COMP-03)
- Patrón por chart: `<h3>` pregunta ("¿Cuántos bienes declaró por año?", "¿Cuándo votó?", "¿Falta más o menos que la mediana de su cámara?"), leyenda con definición de cada serie y unidad (conteo de ítems, votos por trimestre, puntos porcentuales), pie "Fuente: X · capturado fecha · enlace". Reusar componentes existentes; si ya cumplen, no tocar (verificar antes de editar).

### BrowserOS (COMP-02, mecánica)
- MCP HTTP local `http://127.0.0.1:9200/mcp` vía `scripts/bros-cli.mjs`; páginas ocultas (`new_hidden_page`) para no molestar; screenshots a `.planning/phases/61-*/comp-evidence/` con nombre `<superficie>-<viewport>-<antes|despues>.png`.
- Superficies del barrido (cada una desktop + 390px): home (brand/lockup + favicon check), /parlamentario/[id con datos ricos] (resumen, charts, cruces con leyenda nueva), /proyecto/[boletin moción con autores] (autoría nueva, timeline, votaciones), /proyecto/[mensaje] (línea Ejecutivo), /red (leyenda), /buscar, /agenda.
- "Lectura fría" = el agente describe qué entiende SIN contexto del proyecto y señala qué no se entiende; veredicto por superficie: comprensible / mejorable(P1) / no-se-entiende(P0).
- Si BrowserOS MCP no está corriendo (puerto 9200 muerto), fallback honesto: pedir al operador levantarlo (`! <comando>`) — NO fingir capturas.

### Límites duros
- Cero cambios a RPCs/DDL/flags; cero vocabulario causal nuevo (linter negative-match verde); suite+tsc verdes en cada plan; deploy = wrangler con OAuth local (checkpoint suave: si wrangler no autentica, blocker honesto).

### Claude's Discretion
- Redacción exacta de leyendas/títulos (es-CL sobrio), orden del sweep, elección de IDs/boletines de prueba con datos ricos.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/bros-cli.mjs` + patrón F53 (journeys × 2 viewports, evidencia en phase dir, veredictos).
- CrucesView/CrucesSection (parlamentario), cruces de proyecto (F38/F52), charts v5 (PatrimonioChart, votos/trimestre, comparativo), /red RedGraph, AutoresSection nueva (59), BrandIcon/lockup (60).
- Runbook deploy: Docker Linux + `wrangler deploy` local (memoria: camino-a-post-legacy-cutover, frontend-deploy-cloudflare).

### Established Patterns
- Auditorías UX previas: 53-UX-AUDIT.md formato P0/P1/P2 + evidencia; before/after.
- DESIGN-SYSTEM banned-vocab VALLADO + linter negative-match.

### Integration Points
- Deploy #1 hace visible TODO v6 en PROD; el sweep valida BRAND-02 criterio 3 y AUTOR-02 visual además de COMP.

</code_context>

<specifics>
## Specific Ideas
- El pedido original del operador: "los cruces entre parlamentarios no se entiende" — esa sección es la prueba reina; su lectura fría DEBE salir comprensible.
</specifics>

<deferred>
## Deferred Ideas
- P2+ de pulido visual → backlog.
- Grafo /red móvil rediseño (P1 de F53) sigue diferido salvo que el sweep lo marque P0 de comprensión.
</deferred>
