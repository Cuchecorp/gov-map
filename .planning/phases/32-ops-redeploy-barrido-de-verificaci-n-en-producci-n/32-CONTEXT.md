# Phase 32: OPS — Redeploy + barrido de verificación en producción - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous — deploy + verificación inline)

<domain>
## Phase Boundary

Cerrar el milestone con un redeploy y un barrido de verificación en producción que confirme que
las secciones pobladas (lobby, patrimonio, votaciones, provenance) muestran datos reales y que los
invariantes rectores siguen intactos. Consumidor final de todas las fases de datos.
</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **Redeploy necesario solo para el fix de código de Phase 28** (sourceLabel): la DATA
  (lobby/patrimonio) ya estaba viva en el deploy anterior porque el frontend es SSR/data-driven.
- **Build OpenNext en Docker/Linux** (Windows da EPERM por symlinks); deploy con `wrangler deploy`
  (OAuth ya autenticado, workers:write). Docker run vía PowerShell (Git Bash mangla /host).
</decisions>

<code_context>
## Existing Code Insights

- `docker-cf-build.sh` (build Linux) → `docker cp /build/app/.open-next` → `wrangler deploy`.
- wrangler.jsonc main=.open-next/worker.js, worker=observatorio-congreso.
- El frontend lee de Supabase prod por anon key (RLS public-read) → data-driven sin redeploy.
</code_context>

<specifics>
## Specific Ideas

- Verificar: fuente desconocida→0, lobby="Ley del Lobby", patrimonio="InfoProbidad",
  header="Cámara"/"Senado"; invariantes /red 404, /contraparte 404, noindex, sin partido.
</specifics>

<deferred>
## Deferred Ideas

- Encender MONEY/NET (gated-OFF) → depende de los sign-offs F13/F17 (Phases 30/31, humanos).
</deferred>
