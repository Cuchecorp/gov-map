# Phase 64: VOTO P3a — Validar/caracterizar `opendata.camara.cl` LIVE (SPIKE) - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Mode:** Auto-generated (investigation SPIKE — discuss skipped)

<domain>
## Phase Boundary

SPIKE bloqueante: confirmar la forma VIVA del endpoint `getVotacion_Detalle` de `opendata.camara.cl` antes de cablear producción. Guardar respuesta cruda LIVE en R2 como fixture autoritativo, fijar por test el mapeo `OpcionVoto Valor → Selección` (incl. Abstención/Pareo/Dispensado verificados contra la fuente, NO asumidos), y cross-check voto-a-voto == totales del boletín con gate zod fail-ruidoso. Si el endpoint NO está UP a escala, registrar fallback honesto (agregados `getVotaciones_Boletin`) + re-plan del bloque VOTO. Los componentes `connector-camara.ts::fetchVotacionDetalle` y `parse-camara-votacion.ts` YA EXISTEN — esta fase valida su semántica LIVE, no crea conector.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Fase de investigación/validación — todas las decisiones de implementación quedan a discreción de Claude, guiadas por los success criteria del ROADMAP, las convenciones del codebase (ingesta dos-etapas fuente→R2→Supabase, rate-limit 2-3s, zod como compuerta), y el hallazgo rector v7.0 (código P3 ya existe → validar/wire, no crear). Reglas duras heredadas:
- Rate-limit 2-3s/host, User-Agent identificatorio, respeto robots.txt.
- Crudo LIVE → R2 primero (content-addressed), fixture autoritativo.
- Mismatch de totales = fallo RUIDOSO (zod), nunca silencioso.
- Códigos Abstención/Pareo/Dispensado: NUNCA confirmados live → fijar con test explícito contra la fuente.
- Fallback documentado si el endpoint no escala; no fabricar semántica.

</decisions>

<code_context>
## Existing Code Insights

Contexto de código se profundiza en plan-phase research. Componentes conocidos que YA EXISTEN:
- `packages/votos/` — código de P3 desde v2.0
- `connector-camara.ts::fetchVotacionDetalle` — fetch del detalle de votación
- `parse-camara-votacion.ts` — parseo de la votación
- Patrón de ingesta dos-etapas (fuente→R2→Supabase) documentado en CLAUDE.md/PROJECT.md

</code_context>

<specifics>
## Specific Ideas

- Endpoint objetivo: `getVotacion_Detalle` de `opendata.camara.cl` (dos namespaces a caracterizar).
- Mapeo a fijar: `OpcionVoto Valor → Selección` (1→sí, 0→no) + Abstención/Pareo/Dispensado.
- Cross-check: suma voto-a-voto == `TotalSi/TotalNo/…` del boletín.
- Fallback: agregados `getVotaciones_Boletin`.

</specifics>

<deferred>
## Deferred Ideas

None — SPIKE de investigación, alcance acotado a validar el endpoint LIVE.

</deferred>
