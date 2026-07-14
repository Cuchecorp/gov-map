# Phase 66: VOTO P3c — Wire dos-etapas Cámara + backfill a escala (funde DEBT-01) - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Mode:** Auto-generated (wiring/backfill phase — discuss skipped; decisions locked by PROJECT.md two-stage rule)

<domain>
## Phase Boundary

Poblar el voto individual de Cámara A ESCALA por la ingesta de DOS ETAPAS (fuente→R2→Supabase), re-ejecutables por separado. El mismo wire funde DEBT-01 (dos-etapas / `--from-r2`) para votos Y cumple VOTO-01. Trabajo net-new: `run-camara-votos` enruta por `BaseConnector` (hoy 0 snapshots R2). El modelo `voto` (migración 0019) YA EXISTE. La superficie ciudadana del voto (ficha) es Phase 68 — aquí el foco es que el dato quede poblado, trazable (fuente/fecha/enlace) y consultable. Reconciliación por DIPID determinista usando el golden set + gate fail-closed de Phase 65.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (dentro de reglas LOCKED)
Reglas rectoras NO negociables (CLAUDE.md "Ingesta y Cron — LOCKED", STATE.md):
- **Dos etapas SIEMPRE:** Etapa 1 fuente→R2 (crudo inmutable content-addressed `fuente/recurso/fecha/sha256.ext`, PUT `If-None-Match:*`, 412=éxito idempotente). Etapa 2 R2→Supabase lee del crudo, NUNCA de la fuente. Re-ingesta = `--from-r2` replay.
- **Hash-check ANTES de descargar;** salir temprano si no hay novedades.
- **Rate-limit 2-3s/host, UA identificatorio, robots.txt.** Nunca ráfagas (WAF gubernamental).
- **Backfill masivo = LOCAL** (operador), NO GitHub Actions. Idempotente/reanudable.
- **Paginación PostgREST:** SIEMPRE `.order().range()` (cap 1k por request — gotcha v6.1).
- **Voto por DIPID determinista PUNTO** (Phase 65 golden + fail-closed); un DIPID fuera de maestra → `no_confirmado`/`parlamentario_id=null`. El % confirmado NO baja al escalar.
- Cobertura confirmado/no_confirmado medida y reportada.

</decisions>

<code_context>
## Existing Code Insights

Profundizado en plan-phase research. YA EXISTEN:
- Modelo `voto` (migración 0019).
- `run-camara-votos` runner (a re-enrutar por `BaseConnector` para dos etapas).
- `connector-camara.ts::fetchVotacionDetalle` + `parse-camara-votacion.ts` (corregidos en Phase 64: abstención código 2, pareo desde `<Pareos>`, cross-check ruidoso, fail-loud en conflicto pareo/voto y DIPID duplicado).
- `reconciliar-camara.ts::reconciliarVotosCamara` + `EnlaceConfirmado` branded + golden set (Phase 65).
- Infra R2 dos-etapas: `R2Store.putImmutable`, `sha256Hex`, `BaseConnector`, `Fetcher` (UA), `HostRateLimiter`.

</code_context>

<specifics>
## Specific Ideas

- Flags: `--boletines`/`--limite` para acotar; `--from-r2` para replay Etapa 2 sin tocar la fuente.
- Backfill LOCAL reanudable; paginar PostgREST con `.range()`.
- Medir y reportar cobertura confirmado vs no_confirmado tras el backfill.
- Snapshots R2 hoy en 0 → esta fase produce los primeros para votos.

</specifics>

<deferred>
## Deferred Ideas

- Superficie ciudadana del voto en la ficha (sí/no/abstención/pareo/ausente con fuente/fecha/enlace) → Phase 68.
- Paridad Senado → Phase 67.
</deferred>
