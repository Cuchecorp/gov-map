# Phase 12: INT Patrimonio/Intereses — Declaraciones con historial y comparación - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

El ciudadano ve las declaraciones de patrimonio e intereses de un parlamentario, su historial de versiones y una comparación en el tiempo — literal, fechada y atribuida (CC BY 4.0), SIN ningún veredicto de enriquecimiento ni de conflicto. Entrega: conector `@obs/probidad` (InfoProbidad) + sección de declaraciones en `/parlamentario/[id]` con historial + comparación lado-a-lado. Reusa el patrón anti-insinuación de carril propio de Phase 11. NO toca dinero (SERVEL/ChileCompra, Phases 14-16) ni grafo (18).

</domain>

<decisions>
## Implementation Decisions

### INT Patrimonio/Intereses
- **Acceso a InfoProbidad:** CSV catalogs preferente + SPARQL (`datos.cplt.cl/sparql`) para estructura; reusa `@obs/ingest` en el orden LOCKED (research v2.0: InfoProbidad accesible, CC BY 4.0). La atribución CC BY 4.0 debe ser VISIBLE, incluso en vistas derivadas (comparación).
- **Extracción del contenido:** si la declaración viene estructurada (CSV/SPARQL) → parsear literal con zod, SIN LLM. Si requiere LLM (PDF/texto libre) → pasar OBLIGATORIO por la compuerta `data-routing` de `@obs/llm` (tier sin entrenamiento, `assertNoRutInLlmInput`/`assertSensitivityAllowed`; ningún RUT/PII al LLM). Extracción LITERAL, nunca interpreta ni concluye.
- **Modelo historial de versiones:** cada versión = fila fechada por fecha de presentación; la fecha se muestra prominente con badge de frescura (ámbar si está vieja). NUNCA una declaración vieja se presenta como estado actual. Drift de esta fuente PII es BLOQUEANTE (cuarentena la corrida, no degrada en silencio).
- **Comparación lado-a-lado:** solo datos, lado a lado en el tiempo; CERO campo de veredicto "enriquecimiento"/"conflicto de interés"/delta calculado-con-juicio. Carril propio (patrón anti-insinuación Phase 11); el gate de contenido cubre TAMBIÉN la vista derivada de comparación (lección `representado`/prosa no gobernada de Phase 11 UI-review).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@obs/lobby` (Phase 11) — patrón de conector + sub-maestra + sección de ficha en carril propio; espejo cercano. Reusar su estructura.
- `@obs/fichas` (v1.0) — extracción literal vía DeepSeek con golden gate de fidelidad; patrón de extracción LITERAL ya probado (idea matriz/cuerpos legales). Reusar para extracción si hace falta LLM.
- `@obs/llm` data-routing (`assertNoRutInLlmInput`/`assertSensitivityAllowed`, extendido en Phase 9 con `assertPiiDocumentSafeForLlm`) — compuerta OBLIGATORIA para PII.
- Piso RLS/PII Phase 9 (0018 convención deny-by-default) — la declaración con datos sensibles reusa la convención; columnas PII ocultas a anon. ⚠️ Deuda LEGAL-03: tablas PII legacy necesitan `revoke` explícito de anon (defensa en profundidad) — aplicar el mismo `revoke` a las tablas nuevas de esta fase.
- Ficha `/parlamentario/[id]` (Phase 10/11) shell apilable + ProvenanceBadge (frescura ámbar ya existe) + el patrón de carril propio + content-gate test.
- `@obs/ingest` LOCKED; CSV parsing / SPARQL.

### Established Patterns
- Extracción literal con golden gate de fidelidad (precision ≥0.95 bloquea CI) — `@obs/fichas` v1.0.
- Conectores reusan `@obs/ingest`; writer idempotente por clave natural; drift bloqueante para PII; corrida LIVE acotada, no fabrica.
- Server Components, anon, RLS public-read en lo público; PII oculta a anon + revoke explícito.
- Migración numerada (última 0021).

### Integration Points
- Nueva migración (≥0022): tabla(s) de declaración (patrimonio/intereses) versionada por fecha de presentación, RLS (público lo no-sensible + revoke anon en PII), provenance + atribución CC BY 4.0.
- Nueva `<section>` en `/parlamentario/[id]` (carril propio) + vista de comparación.
- Cruce del declarante a la maestra vía `correrPipeline` (solo determinista/confirmado, `EnlaceConfirmado`).

</code_context>

<specifics>
## Specific Ideas

- "Sin veredicto" es LOCKED: la comparación muestra los datos lado a lado; el ciudadano saca sus conclusiones; el sistema NUNCA dice "aumentó/enriqueció/conflicto". El gate de contenido (§9.1) se extiende a la vista de comparación.
- Frescura prominente: una declaración vieja JAMÁS se lee como el estado actual (badge ámbar, fecha de presentación visible).
- Atribución CC BY 4.0 visible siempre, incluido en derivados.
- Corrida LIVE acotada; si InfoProbidad no es alcanzable, degradar a fixture + human_verification, sin fabricar declaraciones.

</specifics>

<deferred>
## Deferred Ideas

- Dinero (SERVEL/ChileCompra) → Phases 14-16.
- Grafo NET → Phase 18.
- Cruces inter-bloque (patrimonio junto a voto/dinero) → diferido por regla anti-insinuación + legal.
- Compuerta legal de exposición pública del bloque → Phase 13 (siguiente; fuera de este rango --to 12).
</deferred>
