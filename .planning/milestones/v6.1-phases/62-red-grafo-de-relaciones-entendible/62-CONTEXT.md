# Phase 62: RED — Grafo de relaciones entendible - Context

**Gathered:** 2026-07-09 (diagnóstico en caliente por Fable tras feedback del operador con screenshot)
**Status:** Ready for planning

<domain>
## Phase Boundary

`/red` pasa de franja apiñada ilegible a ego-network comprensible. Solo la superficie /red (componentes `app/components/red/`, página `/red`); cero DDL (las aristas ya existen: 7.394 en `arista`), cero cambios al materializador NET. RED-01/02/03.

</domain>

<decisions>
## Implementation Decisions

### Diagnóstico (verificado 2026-07-09, no re-investigar)
- Síntoma (screenshot del operador): con seed "Jorge Alessandri Vergara" el grafo muestra ~136 nodos apiñados en una franja horizontal; etiquetas ilegibles; el texto promete "su vecindario inmediato" pero el filtro de vecindario NO limita lo que se renderiza (o el subgrafo servido es el grafo entero).
- Causa de layout: `app/components/red/red-graph.tsx` — función `posicion(laneIndex, camara)` (~línea 104-121): rejilla determinista por carril de cámara (`x = col*COL, y = fila*ROW*3 + row*ROW`), diseñada bajo la decisión LOCKED de F18: "NUNCA una simulación de fuerzas" (la proximidad no debe implicar afinidad). La rejilla cumple eso pero es ilegible a escala 136 nodos.
- Datos: 7.394 aristas / tipo `misma contraparte de lobby`; el subgrafo del seed debería ser computable server-side (¿la RPC/función que arma `subgrafo` ya recorta por seed? VERIFICAR en el server component de /red — es el primer paso del plan).

### Diseño objetivo (LOCKED en espíritu)
- **Ego-network real**: servidor entrega SOLO seed + vecinos directos + aristas entre ellos. Tope duro de vecinos renderizados (p.ej. 24) ordenado por criterio NEUTRO Y DECLARADO (alfabético; jamás "peso" sin explicación) + "N vecinos más" honesto con expand o lista.
- **Layout radial ego-céntrico determinista**: seed al centro, vecinos en anillo(s) en orden alfabético horario; cámara distinguible por forma/borde del nodo, no por posición. Cumple F18 (determinista, posición=orden alfabético, cero afinidad) — la leyenda lo dice explícito: "la posición en el anillo es orden alfabético, no cercanía".
- **Sin seed**: nada de grafo completo — estado que orienta: explicación breve + selector de parlamentario prominente (el selector JS-free existente de B20/B21 se conserva/realza).
- **Móvil 390px**: el anillo escala o degrada a lista de vecinos con enlaces (decidir en plan; la lista es aceptable y quizá más honesta en móvil).
- Aristas: al tocar/hover una arista se conserva el detalle hecho+fuente+ventana (patrón existente `arista-hecho.tsx`); si el volumen de aristas seed↔vecinos satura, agregar por par (una línea = N hechos, "ver los N registros").
- Leyenda "Cómo leer este grafo" se REESCRIBE para el layout nuevo (la actual describe la rejilla por cámara).

### Gate (RED-03)
- Loop BrowserOS del patrón F61: capturas antes (ya hay una: el screenshot del operador equivale al "antes"), fixes, deploy (runbook 61-02: node:22-slim, C:/Temp, wrangler global), re-captura desktop+390px con seed y sin seed, lectura fría → "comprensible". Evidencia en `62-*/red-evidence/`.

### Límites duros
- Cero force-simulation / cero implicación de afinidad (F18 LOCKED). Cero DDL. Cero flags. Anti-insinuación intacta (banned-vocab verde). Suite+tsc+build verdes.

### Claude's Discretion
- Radio/anillos, tope exacto de vecinos, forma de distinguir cámaras, si móvil usa anillo reducido o lista.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/components/red/`: red-graph.tsx (isla @xyflow/react 12), nodo-parlamentario.tsx, arista-hecho.tsx, red-graph.test.tsx.
- Server component de /red + selector de semilla JS-free (quick 260702-rbb) + RPC/lectura de aristas (verificar nombre real).
- Patrón BrowserOS: `scripts/bros-cli.mjs` + MCP 127.0.0.1:9200; runbook deploy en 61-02-SUMMARY (archivado en milestones/v6.0-phases/).

### Established Patterns
- Decisión F18: layout determinista sin afinidad; provenance siempre en DOM; grafo vacío = estado honesto.
- Loop F61: captura→lectura fría→fix→deploy→re-captura con veredicto.

### Integration Points
- El link gated "Red" en la ficha de parlamentario pasa seed — el ego-network debe funcionar desde ese entry point también.

</code_context>

<specifics>
## Specific Ideas
- Queja literal del operador: "todo se ve muy confuso". El criterio de cierre es la lectura fría, no la opinión del implementador.
</specifics>

<deferred>
## Deferred Ideas
- Más tipos de relación (co-autoría de mociones ahora que existe proyecto_autor — candidato natural a arista futura, NO en esta fase).
- Caminos de 2+ saltos / exploración libre del grafo.
</deferred>
