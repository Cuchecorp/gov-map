# Phase 28: PROV — Provenance real de la maestra - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous — diagnóstico inline)

<domain>
## Phase Boundary

Reemplazar "fuente desconocida" en el header de la ficha del parlamentario por la provenance
real de la maestra (fuente oficial + fecha de snapshot + enlace), conforme a la regla rectora
(cada dato lleva fuente/fecha/enlace).
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **Hallazgo:** la provenance de la maestra YA está completa en el remoto (origen/fecha_captura/
  enlace, 186/186, 0 null). El `origen` es CANÓNICO ("diputados"/"senado", fijado por
  `parse-camara`/`seeder` — NO se debe cambiar a "camara"). La memoria "origen nulo" estaba stale.
- **El gap real era de RENDERIZADO:** `sourceLabel("diputados")` no mapeaba a "Cámara" →
  "fuente desconocida"; y el origen de lobby "camara-transparencia-lobby" caía en "InfoProbidad"
  (contiene "transparencia"). Fix: `sourceLabel` (código), NO la data.
</decisions>

<code_context>
## Existing Code Insights

- `parlamentario_publico(p_id)` RPC ya devuelve origen/fecha_captura/enlace.
- `app/lib/types.ts sourceLabel(origen)` mapea origen→etiqueta para el ProvenanceBadge.
- origen canónico de la maestra: "diputados" (parse-camara.ts) / "senado".
</code_context>

<specifics>
## Specific Ideas

- Mapear "diputad" → "Cámara"; mover el chequeo "lobby" antes que "transparencia".
</specifics>

<deferred>
## Deferred Ideas

- Verificación visual del header en prod → Phase 32 (tras redeploy).
</deferred>
