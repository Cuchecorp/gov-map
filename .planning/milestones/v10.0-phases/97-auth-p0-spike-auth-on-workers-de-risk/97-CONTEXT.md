# Phase 97: AUTH P0 — SPIKE auth-on-Workers de-risk - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Mode:** Autonomous (infrastructure spike — smart discuss minimal context)

<domain>
## Phase Boundary

SPIKE de de-risk: confirmar sobre el deploy REAL (OpenNext/Cloudflare Workers) que una sesión Supabase Auth end-to-end se sostiene ANTES de construir cualquier feature de usuario. Entrega: primer `middleware.ts` del repo (Edge-style clásico, NO Node Middleware 15.2+ — OpenNext no lo soporta), `@supabase/ssr`, `lib/supabase-user.ts`, y evidencia (BrowserOS/curl) de que `Set-Cookie` + refresh de sesión sobreviven el pipeline OpenNext en el deploy real.

NO construye UI de usuario. NO gatea 98-102 (el panel de datos no depende del resultado). Si el spike FALLA → registrar fallback honesto + re-plan documentado del bloque NOTIF (Phase 103, server-side puro); la fase cierra igual.

</domain>

<decisions>
## Implementation Decisions

### Restricciones LOCKED (del prompt v10.0 + ROADMAP)
- Middleware Edge-style clásico (`middleware.ts` raíz con `matcher`), JAMÁS Node Middleware 15.2+ (caveat OpenNext verificado en research).
- El spike NO resucita la anon key legacy muerta (Camino A intacto) ni toca el plano service_role del sitio existente. El acceso nuevo del navegador = publishable key nueva de bajo privilegio con RLS (o server-side).
- Verificación sobre DEPLOY REAL, no local — el middleware nuevo es EL riesgo del build OpenNext. Runbook deploy: Docker `node:22-slim`, robocopy a `C:/Temp/obs-build`, wrangler global OAuth, pnpm 11 `dangerouslyAllowAllBuilds true` (milestones/v6.0-phases/61-*/61-02-SUMMARY.md).
- Auth method: magic-link/OTP por email (base para 103). El SMTP interno de Supabase (2 emails/hora) basta para el SPIKE (volumen = operador probando); Custom SMTP/Resend es de 103.
- Emails de prueba = SOLO direcciones del operador/test propias, jamás terceros.
- CSP ENFORCED en PROD: si Supabase Auth necesita un origen en connect-src, ajuste MÍNIMO documentado; jamás quitar frame-ancestors/object-src.

### Claude's Discretion
Todo lo demás (estructura del matcher, página de prueba del spike, cómo evidenciar el refresh, ruta de prueba oculta vs flag) queda a discreción — fase de infraestructura pura. Preferir superficie mínima: una ruta de prueba no enlazada es aceptable; no tocar navegación ni home.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- El sitio HOY corre 100% service_role server-side (Camino A, post-cutover 2026-06-26); NO existe `middleware.ts` — este es el primero.
- `@supabase/supabase-js` v2 ya en el repo; `@supabase/ssr` es dependencia nueva.
- Guards existentes que muerden: lockdown (PUBLIC_RPC_ALLOWLIST + Direction-B + crossLinkReader), PII-guard, env-example. El spike añade env vars nuevas → actualizar `.env.example` o el guard falla.

### Established Patterns
- Deploy: build OpenNext en Docker node:22-slim (NUNCA alpine/Windows), robocopy C:/Temp/obs-build, wrangler global.
- Suite al inicio: app 1243 + packages 1263 verdes + tsc --noEmit + pnpm audit 0. Cada plan la deja verde.
- Home usa `force-dynamic` — no romper.

### Integration Points
- `app/` (Next.js App Router, OpenNext → Cloudflare Workers): `middleware.ts` en la raíz de la app.
- Supabase ref `bctyygbmqcvizyplktuw` (sa-east-1). Auth config (magic link) vía dashboard — si requiere acción de operador (habilitar provider email), documentarlo como paso; probar primero por API.
- PROD: https://observatorio-congreso.thevalis.workers.dev

</code_context>

<specifics>
## Specific Ideas

- Success criteria del ROADMAP son el contrato: (1) middleware desplegado sin romper build; (2) Set-Cookie + refresh sobreviven OpenNext en deploy real con evidencia; (3) Camino A intacto; (4) fallback honesto documentado si falla.
- Evidencia esperada: curl/BrowserOS mostrando cookies `sb-*` emitidas y sesión refrescada tras expiry del access token (o `refresh_token` intercambiado), sobre el dominio workers.dev.

</specifics>

<deferred>
## Deferred Ideas

- UI de login real, perfil de usuario, tablas `suscripcion` con RLS → Phase 103.
- Custom SMTP (Resend) para auth-emails → Phase 103.

</deferred>
