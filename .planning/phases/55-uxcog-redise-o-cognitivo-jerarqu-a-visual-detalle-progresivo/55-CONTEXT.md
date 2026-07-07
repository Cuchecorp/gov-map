# Phase 55: UXCOG — Rediseño cognitivo: jerarquía visual + detalle progresivo - Context

**Gathered:** 2026-07-07 (corrección del operador + sketch 001 con ganador elegido por el operador)
**Status:** Ready for planning

<domain>
## Phase Boundary

Rediseñar la ARQUITECTURA DE INFORMACIÓN de las superficies ciudadanas (fichas de parlamentario y proyecto, agenda, /red) según la corrección textual del operador (rechazo del checkpoint T4 de F54): "información no organizada, difícil de leer, mucho texto muy genérico; énfasis UI y UX, usa estrategias visuales; la idea es que sea claro y uno pueda ir aumentando el detalle, viendo cruces; no tanta información; piensa de modo cognitivo". La ESTÉTICA NO cambia (crema + petróleo + civic Cámara/Senado, Phase 19 LOCKED); cambia el DEFAULT de cuánta información se muestra y en qué orden. Ningún dato se pierde: todo sigue accesible vía disclosure. CERO DDL, CERO flags, cero deps nuevas (Radix Accordion/Collapsible y Recharts ya están instalados).

</domain>

<decisions>
## Implementation Decisions

### Patrón ganador (ELEGIDO POR EL OPERADOR — sketch 001, variante B "Informe con rail")
El operador vio 3 variantes interactivas (`.planning/sketches/001-ficha-parlamentario-cognitiva/index.html`, commit f5c078b) y eligió **B: Informe con rail**; luego delegó el resto en autónomo ("continua autonomo desde ahi"). El patrón, tal como está en el sketch:

- **Rail izquierdo sticky** (~210px, `position:sticky`) con: chip de cámara, nombre, período, badge de frescura compacto, y una navegación local con conteos por sección (Votaciones 141 / Lobby 107 / Patrimonio 10 / **Cruces ◆ 12** / Financiamiento —). Scrollspy marca la sección actual (fondo petróleo suave + borde izquierdo petróleo). El caveat anti-causal vive 1× en el rail (cumple la regla 1×/sección global de la página).
- **Cada sección SIEMPRE visible pero SOLO su capa-1**: números grandes en Mono (b-facts: 72 a favor / 66 en contra / 2 abst / 1 ausente / 99,3% asistencia), 1 visual (stacked bar de votos, barras horizontales de materias de lobby, mini-columnas de patrimonio), y botón **"Ver detalle (N)"** que expande el detalle INLINE (no navega, no modal). Colapsado por defecto.
- **Cruces destacados**: la sección Cruces lleva borde petróleo (1.5px), título en petróleo, chips "sector · N reuniones · M votos", botón primario "Explorar los N cruces". Es el único énfasis de color de producto en la página — el destino del drill-down.
- **Financiamiento pendiente**: sección atenuada (opacity ~.6) con texto honesto, presente en el rail con "—".
- En móvil el rail colapsa a una barra superior compacta (nav local horizontal scrolleable o select) — el patrón exacto queda a discreción del planner, sin perder los conteos.

### Aplicación por superficie
- **Ficha parlamentario** (la de mayor deuda: 28.048px lógicos hoy): aplicar el patrón B completo tal como el sketch. Meta: estado por defecto ~5.000px lógicos. Las listas completas (141 votaciones, 107 reuniones, 10 declaraciones, 12 cruces) se muestran truncadas al expandir (~5-10 filas + "ver las N" con paginación o carga incremental client-side de datos YA fetched — sin RPC nueva).
- **Ficha proyecto** (10.391px hoy): mismo rail (secciones: Dónde está / Tramitación / Votaciones / Lobby del período / Idea matriz / Similares). La capa-1 de Tramitación = **stepper visual de etapas** (elevar el "¿Dónde está hoy?" existente) + hitos CLAVE siempre visibles (ingreso, cambios de etapa/comisión, informes, votaciones con desenlace); los trámites repetitivos de urgencia ("Cuenta del Mensaje N que retira y hace presente la urgencia…") se AGRUPAN en 1 línea con conteo ("42 trámites de urgencia · ver todos") — la agrupación es presentacional (el dato ya viene clasificado por tipo/urgencia en las filas existentes; si la heurística de agrupación es ambigua, agrupar solo lo inequívoco).
- **Carril lobby×tramitación** (proyecto): se conserva como sección con capa-1 (conteo + semana) + detalle inline; nombre en texto plano no-enlazado sigue LOCKED (52-03).
- **Agenda** (11.606px hoy): agrupar por día → comisión con jerarquía tipográfica clara; bloques colapsables por día; cross-links a boletín intactos.
- **/red**: vista inicial = **ego-network del seed** (si hay `?seed=`, centrar y hacer zoom al vecindario del nodo, no fitView global de 136 nodos); sin seed, mantener fitView global pero con nota de uso. Solo props/opciones de @xyflow/react ya disponibles (fitView sobre nodos filtrados, `nodes` del vecindario, minZoom) — cero física nueva.
- **Home y /buscar NO se tocan** (F54 los dejó bien; hero LOCKED).

### Reglas transversales (del sketch, obligatorias)
- Capa-1 usa atributos preatentivos: números grandes Mono, color solo semántico (verde favor / rojo contra / ámbar abstención / gris ausente — ya existentes; petróleo SOLO para cruces/acción), chunking ≤7 unidades visibles por sección colapsada.
- El texto por fila se comprime: 1 línea principal + 1 línea meta (fecha · fuente ↗) en Mono pequeño muted. Nada de párrafos de fuente cruda en capa-1.
- Fuente/fecha/enlace NUNCA desaparecen: viven en la línea meta de cada fila y en el badge de frescura por sección.
- Disclosure con Radix (Collapsible/Accordion ya en el repo, patrón F45); scrollspy con IntersectionObserver (cero deps).
- Anti-insinuación intacta: cero vocabulario causal nuevo (negative-match), caveat anti-causal 1× por página/sección según regla vigente, conteos neutros.

### Claude's Discretion
- Mecánica exacta del truncado (5 vs 10 filas iniciales) y de "ver las N" (expandir todo vs paginar).
- Compactación móvil del rail.
- Qué hitos de tramitación cuentan como "clave" (mínimo: ingreso, cambios de etapa, informes de comisión, votaciones, urgencia vigente).
- Microcopy de las notas de uso (factual, es-CL).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/sketches/001-ficha-parlamentario-cognitiva/index.html` — el mockup ganador (variante B) con el CSS de referencia (b-rail, b-sec, b-facts, b-detail) sobre los tokens reales; `themes/default.css` mapea los tokens del sitio.
- Acordeones Radix + resumen 3-estado (F45), chart patrimonio Recharts (F46), stacked bar "Cómo votó" (existente), formatNombre (F54), breadcrumbs server (F53).
- `scripts/rewalk-shot.mjs` + técnica same-origin iframe (54-05-SUMMARY) para la evidencia visual final.
- Deploy: docker-cf-build.sh + wrangler OAuth (autorizado 2026-07-06).

### Established Patterns
- Suite (594/594 al cierre de F54) + tsc -b root + lockdown-guard + banned-vocab negative-match.
- Design system: tokens, Mono cifras, 400/600, min-h-11 targets, mt-12 frontera de carril LOCKED, sin arbitrary values (gotcha 54-04: @theme inline sin doble-hsl).
- Server Components por defecto; los datos de las fichas ya llegan completos al server render — el disclosure es client-side sobre datos ya presentes (Radix), NO lazy-fetch.

### Integration Points
- `app/app/parlamentario/[id]/page.tsx` + componentes de sección (votos, lobby-de-parlamentario, patrimonio, cruces-de-parlamentario).
- `app/app/proyecto/[boletin]/page.tsx` + timeline de tramitación + lobby-en-tramitacion (carril).
- `app/app/agenda/page.tsx`; `app/components/red/red-graph.tsx`.
- Tests RTL por componente + tests de estructura (rail presente, secciones colapsadas por defecto, conteos correctos).

</code_context>

<specifics>
## Specific Ideas

- La métrica de éxito informal del operador: entender la ficha en <5 segundos y "ir aumentando el detalle, viendo cruces". El primer viewport decide.
- Set de demo se recaptura al cierre (técnica same-origin, cap 12.800px lógicos por captura) y se presenta al operador como checkpoint final de fase.

</specifics>

<deferred>
## Deferred Ideas

- Sketch 002/003 como mockups separados — resueltos aplicando el patrón B dentro de esta fase (decisión autónoma autorizada).
- Charts nuevos de votos (F47) y comparativo de ausencias (F49) — fases siguientes, se montan sobre esta estructura.
- Cruces en ficha de proyecto (F38) — hereda el patrón de drill-down de esta fase.
- Restauración de tildes por diccionario (milestone futuro).

</deferred>
