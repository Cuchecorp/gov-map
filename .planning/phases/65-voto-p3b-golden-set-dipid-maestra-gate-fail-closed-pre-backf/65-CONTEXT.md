# Phase 65: VOTO P3b — Golden set DIPID→maestra (gate fail-closed pre-backfill) - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Mode:** Auto-generated (data-integrity/validation phase — discuss skipped; all criteria technical)

<domain>
## Phase Boundary

Construir y validar un golden set DIPID→id_maestra para los ~155 diputados vigentes ANTES de escalar el backfill de votos (Phase 66). El cruce de voto debe ser DIPID-determinista PUNTO: nunca name-match, `normalizarNombre` ni LLM en el camino de votos. Un DIPID fuera de la maestra → `no_confirmado` con `parlamentario_id=null` (jamás atribución a la persona equivocada). El FK del voto se mantiene `EnlaceConfirmado | null` branded (un string crudo no compila). Los componentes `reconciliar-camara.ts::reconciliarVotosCamara` y el branded `EnlaceConfirmado` YA EXISTEN — esta fase construye el golden set + el gate fail-closed, no crea el reconciliador. Trampa cubierta explícitamente: los DIPID se reciclan entre legislaturas.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Fase de datos/validación defamation-critical — decisiones a discreción de Claude guiadas por los success criteria y las reglas rectoras heredadas (PROJECT.md/STATE.md):
- Voto reconciliado por DIPID determinista PUNTO; NUNCA name-match para votos (riesgo #1).
- Fail-closed: DIPID desconocido → `no_confirmado`, `parlamentario_id=null`.
- FK branded `EnlaceConfirmado | null` (type-safe, string crudo no compila).
- Pipeline de identidad confirmado (por nombre, auditado) es para linking general; para VOTOS el cruce es DIPID exacto, no el pipeline de nombre.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. Conocidos que YA EXISTEN:
- `reconciliar-camara.ts::reconciliarVotosCamara` — reconciliación de votos Cámara.
- Branded type `EnlaceConfirmado` — FK type-safe del voto.
- Tabla maestra de identidades (respaldada fuera de Supabase por diseño).
- Fixtures LIVE de Phase 64 (votación detalle con DIPID reales) disponibles para el golden set.

</code_context>

<specifics>
## Specific Ideas

- ~155 diputados vigentes (legislatura 2022-2026 / 2026-2030 según corte).
- DIPID se reciclan entre legislaturas → el golden set debe fijar la legislatura/período.
- Verificable en el diff: ausencia de `normalizarNombre`/LLM/name-match en el camino de votos.

</specifics>

<deferred>
## Deferred Ideas

None — alcance acotado al golden set + gate. El backfill a escala es Phase 66.
</deferred>
