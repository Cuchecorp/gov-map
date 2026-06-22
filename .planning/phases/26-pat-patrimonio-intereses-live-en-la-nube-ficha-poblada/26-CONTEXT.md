# Phase 26: PAT — Patrimonio/intereses LIVE en la nube + ficha poblada - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous — corrida LIVE inline)

<domain>
## Phase Boundary

Poblar la sección patrimonio/intereses ejerciendo `@obs/probidad` (InfoProbidad SPARQL) LIVE por
parlamentario y escribiendo las declaraciones VERSIONADAS a la nube, de modo que el ciudadano vea
declaraciones reales con su historial de versiones y fecha de presentación prominente.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **Match TARGETED token-superset:** se consulta por (paterno+materno) de cada parlamentario y se
  confirman SOLO las declaraciones cuyo nombre del declarante CONTIENE todos los tokens del objetivo
  (nombres+paterno+materno). Maneja segundos nombres (declarante superset), apellidos compuestos, y
  distingue hermanos por el primer nombre (JORGE vs FELIPE ALESSANDRI). Determinista, fail-closed.
- **deterministic-only** (sin LLM): la consulta es por persona conocida; el superset es determinista.
- InfoProbidad SPARQL (`datos.cplt.cl`) responde a Node fetch (sin WAF).
</decisions>

<code_context>
## Existing Code Insights

- `@obs/probidad` Phase 12: connector SPARQL + parse + writer versionado (0022) + reconciliarDeclarante
  (fuzzy name, NO sirve por materno-less + camara hardcode → se usa el match objetivo nuevo).
- InfoProbidad devuelve nombres COMPLETOS con segundos nombres ("BORIS ANTHONY BARRERA MORENO").
- bienes/familiares vienen 0 (la query SPARQL trae metadata de declaración: tipo/cargo/organismo/fecha).
</code_context>

<specifics>
## Specific Ideas

- Runner `run-probidad-todos` itera los 186; consulta por paterno+materno; confirma por superset.
- La ficha muestra versiones + fecha de presentación (núcleo del goal); bienes detallados diferidos.
</specifics>

<deferred>
## Deferred Ideas

- Extraer bienes/familiares detallados (requiere ampliar la query SPARQL del connector Phase 12).
</deferred>
