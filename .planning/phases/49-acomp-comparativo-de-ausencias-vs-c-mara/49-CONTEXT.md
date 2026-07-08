# Phase 49: ACOMP — Comparativo de ausencias vs cámara - Context

**Gathered:** 2026-07-07 (auto-generado en corrida autónoma autorizada — ROADMAP §49 + patrones F38/F47/F55)
**Status:** Ready for planning

<domain>
## Phase Boundary

Contexto factual para la asistencia en la ficha de parlamentario: junto a las ausencias propias, la referencia de su cámara — "ausente en N de M votaciones (X%); mediana de su cámara: Y%" — vía RPC nueva `tasa_ausencia_comparada` (security definer, PII-safe, idiom 0047/0049, allowlist). Datos ya ingestados (546 ausencias / 18.700 votos — gate CUMPLIDO 2026-07-02). ESTRICTAMENTE factual-comparativo: números y mediana, sin adjetivos, sin ranking nominal ("top ausentes" PROHIBIDO), sin porcentaje-como-veredicto; caveat de cobertura (el universo es lo ingestado, no la historia completa).
</domain>

<decisions>
## Implementation Decisions

### RPC `tasa_ausencia_comparada(p_parlamentario_id text)` (idiom 0049 verbatim)
- `security definer set search_path=''`, doble revoke (public + anon/authenticated), CERO grant, allowlist lockdown-guard, pgTAP con fixture rollback (deny anon, no-PII, contrato de columnas, caso positivo + negativo).
- Emite: tasa propia (ausencias N / votaciones M del parlamentario), mediana de su cámara (sobre parlamentarios de la MISMA cámara con ≥1 voto en el universo ingestado), universo explícito (N/M propios + conteo de parlamentarios en la mediana), y fecha_captura/frescura si el dato lo permite.
- Migración `0050_tasa_ausencia_comparada.sql` ESCRITA + committeada + pgTAP; **apply = checkpoint operador** (se presenta JUNTO al apply pendiente de 0049 — un solo checkpoint con ambas).
- El research verifica contra PROD (read-only psql) el shape real: de dónde salen ausencias (seleccion='ausente'? tabla voto), la cámara del parlamentario, y los números reales de D1012 para la evidencia.

### UI (hereda F55/F47)
- Vive en la sección Votaciones de la ficha: 1-2 líneas factuales bajo las cifras de capa-1 O al tope del detalle junto al chart F47 — decidir por UI-SPEC con el criterio de F47 (capa-1 no pierde escaneabilidad; si es UNA línea corta de texto factual, puede ir en capa-1; si lleva visual, va al detalle).
- **Degrade honesto pre-apply**: RPC ausente (PGRST202) → el comparativo NO se muestra (la capa-1 actual queda intacta); error real → throw (#34). El deploy puede preceder al apply.
- Copy contract estricto: "Ausente en {N} de {M} votaciones ({X}%)" + "Mediana de su cámara: {Y}% ({K} parlamentarios)" + caveat de cobertura "Sobre las votaciones ingestadas por este observatorio, no la historia completa." — cero adjetivos, negative-match extendido (top/más ausente/peor/mejor asistencia PROHIBIDOS).

### Gate y cierre
- Suite (baseline 712) + tsc + lockdown-guard + banned-vocab. Redeploy final + smoke (degrade honesto verificado pre-apply). Checkpoint final ÚNICO consolidado: apply 0049 + 0050 + pgTAPs + veredicto visual de ambas superficies.

### Claude's Discretion
- Shape final de columnas de la RPC; redondeo del %; ubicación exacta (capa-1 línea vs detalle) según el UI-SPEC; microcopy factual.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `0049_cruces_de_proyecto.sql` + su pgTAP (idiom EXACTO, committeado hoy — espejo directo para 0050).
- F47: sub-bloque "Cuándo votó" en el detalle de votaciones (punto de montaje hermano); `VotosCapa1`; `votosBreakdown` (asistencia ya calculada en capa-1 — el comparativo AÑADE la mediana de cámara).
- Degrade PGRST202 (lobby-en-tramitacion.tsx / cruces-de-proyecto.tsx), ProvenanceBadge, allowlist en lockdown-guard.test.ts.

### Established Patterns
- Deploy caliente (38-03/47-02-SUMMARY); psql read-only para research; suite+guards; NUNCA aplicar DDL (checkpoint).

### Integration Points
- `supabase/migrations/0050_*.sql`, `supabase/tests/0050_*.test.sql`, `app/lib/types.ts`, `app/lib/lockdown-guard.test.ts`, componente de sección votaciones / `votos-capa1.tsx`, page parlamentario, tests RTL.
</code_context>

<specifics>
## Specific Ideas
- Requirement: VIZ-03. El valor: contexto honesto — un 0,7% de ausencia no dice nada sin la mediana de la cámara.
</specifics>

<deferred>
## Deferred Ideas
- Ranking/tabla de asistencia por cámara (PROHIBIDO por diseño anti-insinuación, no solo deferred).
- Comparativos por comisión o período legislativo.
</deferred>
