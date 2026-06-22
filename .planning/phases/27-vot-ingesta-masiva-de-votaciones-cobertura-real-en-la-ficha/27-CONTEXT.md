# Phase 27: VOT — Ingesta masiva de votaciones + cobertura real en la ficha - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous — corrida + spike de enumeración inline)

<domain>
## Phase Boundary

Llevar la cobertura de votaciones de 2 boletines / 10 votaciones a escala de legislatura
ejerciendo `@obs/votos` masivamente desde `opendata.camara.cl`, con cruce determinista DIPID.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **Cruce DIPID determinista** (sin issue de nombre, a diferencia de lobby/probidad).
- **Boletines explícitos vía `--boletines-file`:** el descubrimiento por sesiones devuelve 0
  (el WS no enumera boletines votados); la vía robusta es pasar boletines explícitos.
- Fuente de boletines = los 74 proyectos ya trackeados en `proyecto`.
</decisions>

<code_context>
## Existing Code Insights

- `runCamaraVotos` (@obs/votos) requiere boletines o limite; descubrirBoletines(58)→0.
- `wscamaradiputados.asmx` SOLO tiene `getVotaciones_Boletin` + `getVotacion_Detalle` para votaciones
  — NO hay enumeración bulk (retornarVotacionesX*→500). getSesionDetalle trae FECHAS, no boletines.
- Cruce DIPID→id_diputado_camara determinista (mint EnlaceConfirmado, IDENT-12).
</code_context>

<specifics>
## Specific Ideas

- Runner `run-votos-masivo-cli` (--dry-run, --limit, --boletines-file) escribiendo a prod.
- LIMITACIÓN DE FUENTE: leg 58 (periodo 2026-2030) arrancó 2026-03 → solo 2/74 boletines votados
  (10 votaciones). Sin enumeración bulk, la cobertura está acotada por la fuente, no por el código.
</specifics>

<deferred>
## Deferred Ideas

- Enumeración de boletines votados a escala (requiere otra fuente: portal HTML de votaciones de la
  Cámara, o BCN) — spike futuro.
- Bug del writer `tramitacion_evento` ("ON CONFLICT cannot affect row a second time": dedup intra-lote)
  — afecta 2 boletines a nivel de EVENTOS de tramitación (no votaciones). Deuda técnica v1.0.
</deferred>
