# Phase 81: BENTO-SHIP — Deploy + verificación visual + gate humano - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — deploy AUTORIZADO (precedente corridas v6/v7)

<domain>
## Phase Boundary

Bento EN VIVO, verificado visualmente contra el mockup, con el gate humano documentado. Tres entregables: (1) deploy Cloudflare vía runbook Docker; (2) verificación BrowserOS sobre el deploy real (home 1200px vs mockup, móvil 390px, 1 ruta interior por tipo, /red getComputedStyle — cierra también el gate visual pendiente de fase 75); (3) checklist de lectura fría formato 68-BROWSEROS-GATE como handoff si el operador no responde. Requirement: BENTO-07.

</domain>

<decisions>
## Implementation Decisions

### Deploy (runbook 61-02 + docs/deploy-cloudflare.md Opción B)
- Build OpenNext en Docker `node:22-slim` (NUNCA alpine — workerd requiere glibc).
- Pre-copiar fuente a `C:/Temp/obs-build` (robocopy/PowerShell — OneDrive+virtiofs es lentísimo).
- `pnpm config set dangerouslyAllowAllBuilds true` ANTES del `pnpm install` en el contenedor (pnpm 11).
- `docker run -w /app` SOLO vía PowerShell (no git-bash); `docker cp` con ruta Windows explícita; MSYS_NO_PATHCONV si git-bash.
- Deploy: wrangler 4 GLOBAL vía `node "C:/Users/Carlo/AppData/Roaming/npm/node_modules/wrangler/bin/wrangler.js" deploy --config wrangler.jsonc` desde `app/` (OAuth local; CI no tiene CLOUDFLARE_API_TOKEN).
- Worker: observatorio-congreso → https://observatorio-congreso.thevalis.workers.dev

### Verificación BrowserOS (la hace el ORQUESTADOR — executors no tienen browseros)
- Home desktop ~1200px lado-a-lado con `.planning/design/bento/home-bento.dc.html`.
- Home móvil 390px (CSS inyectado — gotcha BrowserOS).
- 1 ruta interior por tipo: lista (/parlamentarios), ficha (/parlamentario/S1110 o /proyecto/14309-04), prosa (/sobre).
- /red no-regresión: getComputedStyle sobre .net-* (ancho contenedor, .net-chip font-size 11px) — CIERRA gate visual fase 75.
- Gotcha: save_screenshot en ráfaga tumba CDP → pausas 10-12s + probe al MCP + retry.

### Gate humano
- Checklist formato `68-BROWSEROS-GATE.md` (fase 68). Si el operador no responde en vivo → documentar como handoff con evidencia lista y CERRAR la corrida igual (patrón v7).

### Post-deploy
- Suite verde post-deploy (sanity); HTTP checks (200 + strings clave: kicker "OBSERVATORIO DEL CONGRESO", h1 LOCKED, footer CC BY).
- Tag + push a Cuchecorp/gov-map ocurre en el cierre del milestone (lifecycle), no en esta fase — pero el push de master puede ir aquí si el deploy queda verde.

### Claude's Discretion
- Detalles del script de build; orden de capturas; contenido exacto del gate doc.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker-cf-build.sh` (repo root) + `docs/deploy-cloudflare.md` (Opción B local).
- Runbook probado: `.planning/milestones/v6.0-phases/61-*/61-02-SUMMARY.md` (gotchas alpine/OneDrive/wrangler impostor).
- Formato gate: `.planning/phases/68-*/68-BROWSEROS-GATE.md`.
- Capturas 79 (`captures/`) como referencia de coherencia.

### Integration Points
- app/wrangler.jsonc; worker observatorio-congreso (NO renombrar).

</code_context>

<specifics>
## Specific Ideas

- Estado del repo al entrar: suite 917 app + 1103 packages verde, tsc limpio, HEAD con fases 76-80 completas.
- v7 gates de operador (HANDOFF-v7.0-operator-gates.md) NO se tocan — "Votado esta semana" puede salir vacío-honesto en PROD; eso es CORRECTO.

</specifics>

<deferred>
## Deferred Ideas

- CI deploy (CLOUDFLARE_API_TOKEN en repo) — deuda de operador previa, no de esta corrida.

</deferred>
