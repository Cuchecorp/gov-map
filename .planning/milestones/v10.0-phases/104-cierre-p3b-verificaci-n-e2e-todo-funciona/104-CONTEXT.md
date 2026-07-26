# Phase 104: CIERRE P3b — Verificación E2E "todo funciona" - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Cierre del milestone v10.0: deploy único que arrastra 101+102+103, seguido del inventario E2E que pidió el operador — cada superficie nueva × dato real × BrowserOS sobre el deploy, flags OFF ausentes del DOM, linter verde con vocabulario nuevo, suite + guards verdes. Fase de EJECUCIÓN/verificación: no construye features nuevas; solo fixes emergentes de lo que el E2E encuentre.

</domain>

<decisions>
## Implementation Decisions

### Deploy y flags (Área 1)
- Deploy en 104: SÍ — build OpenNext en Docker Linux + wrangler local (runbook establecido: purgar .pnpm-store del mirror, MSYS_NO_PATHCONV=1, C:/Temp). Arrastra los cambios de 101, 102 y 103 (patrón "viaja con 104").
- **Flip VSIM AUTORIZADO por el operador (2026-07-26, esta corrida):** firmar `docs/legal/102-LEGAL-DOSSIER-VSIM.md` (signoff pending→approved con la autorización verbatim del operador-abogado) y setear `VSIM_PUBLIC_ENABLED=true` como Worker env var en el deploy. El eje "coinciden en N de M votaciones" queda visible en /comparar CON el caveat base-alta obligatorio. `.env.example` NO se toca (anti-flip guard).
- Flag NOTIF: OFF forzoso — la provisión operador (publishable key, Resend) no existe; sin ella el login no funciona. E2E verifica que /cuenta y el botón Seguir están AUSENTES del DOM.
- MONEY: OFF sin cambio (gated legal v7.0).

### Alcance E2E (Área 2 — aceptada completa)
- Inventario completo: cada superficie v10.0 × dato real × BrowserOS sobre el deploy NUEVO:
  - Panel actualidad con señales vivas (cifra voto honesta, jamás "captura" pelado — vocabulario spike-findings-98).
  - Bloque relaciones en ficha parlamentario: conteos honestos verificados contra SQL (truncamiento >20), orden alfabético, jamás ranking.
  - /comparar: 4 ejes + eje VSIM ahora ON con caveat base-alta visible; similitud cuadra contra recálculo SQL (`coincidencia_votos_par`).
  - Flags OFF (NOTIF, MONEY) ausentes del DOM — cero superficie fantasma.
  - Empty states honestos, cero URI-como-partido.
- Cierre de 101-HUMAN-UAT.md (deploy + BrowserOS pendientes de 101) dentro del E2E; actualizar resultados y estado.
- Linter anti-insinuación verde con vocabulario nuevo sobre superficies nuevas (SUPERFICIES_PANEL, similitud, relaciones); suite completa + todos los guards (lockdown authenticated, anti-flip VSIM/NOTIF/MONEY, candados de régimen).

### Claude's Discretion
- Orden del inventario, granularidad de screenshots BrowserOS, cómo registrar evidencia (archivo E2E por superficie vs consolidado), fixes menores emergentes (Rule-1/Rule-3 del executor).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Runbooks de deploy previos (103-DEPLOY-RUNBOOK.md §deploy, memoria: Docker Linux + wrangler, MSYS_NO_PATHCONV=1, purgar .pnpm-store).
- BrowserOS MCP para lectura fría del deploy real (patrón gates 100/92); scripts/bros-cli.mjs.
- pgTAP/SQL de verificación: `coincidencia_votos_par` (0068, pgTAP 14/14), RPCs relaciones (0067), señales (0065/0066).
- 101-HUMAN-UAT.md = lista pendiente que este E2E cierra.
- 103-HUMAN-UAT.md = ítems de provisión operador que NO se cierran aquí (quedan como deuda; el E2E solo verifica DOM-ausente de NOTIF).

### Established Patterns
- Gate BrowserOS por DOM del deploy real (getComputedStyle para cascada CSS; iframe same-origin para móvil 390px).
- Verificación de conteos contra SQL directo (psql .env, PGCLIENTENCODING=UTF8).
- Flip por Worker env var a deploy-time, jamás committeado.

### Integration Points
- Cloudflare Worker observatorio-congreso (wrangler local OAuth).
- Supabase PROD (migraciones 0069-0072 ya aplicadas).
- deploy previo de referencia: 3198e159 (panel, Phase 100).

</code_context>

<specifics>
## Specific Ideas

- El operador pidió literalmente "asegúrate que TODO funciona" — el E2E es inventario exhaustivo, no smoke test.
- Firma VSIM: registrar en el dossier 102 la autorización del operador de esta corrida (mismo patrón que el dossier 103): el agente documenta, el operador autoriza.
- Si el E2E encuentra un defecto que rompa una superficie: fix inmediato + redeploy dentro de la fase (los fixes emergentes son parte del cierre).

</specifics>

<deferred>
## Deferred Ideas

- Provisión NOTIF (publishable key, OTP, Resend, NOTIF_TOKEN_SECRET) — deuda operador en 103-HUMAN-UAT.md; el flip NOTIF NO ocurre en esta fase.
- SEED-001 (capa LLM escalonada Granite/Phi) — plantada para próximo milestone.

</deferred>
