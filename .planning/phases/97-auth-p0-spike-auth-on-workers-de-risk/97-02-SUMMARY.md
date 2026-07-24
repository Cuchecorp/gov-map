---
phase: 97-auth-p0-spike-auth-on-workers-de-risk
plan: 02
subsystem: infra
tags: [auth, openNext, cloudflare-workers, middleware, deploy, supabase-ssr, spike]

requires:
  - phase: 97-01
    provides: "app/middleware.ts (primer middleware, Edge deprecado), app/lib/supabase-user.ts (publishable key), /spike-auth OTP"
provides:
  - "Veredicto EMPÍRICO SC1: el primer middleware.ts sobrevive el build OpenNext como Edge (deprecation warning, NO error Node-middleware)"
  - "Deploy OpenNext REAL a Cloudflare (version 3952f9bc) con el middleware presente; Camino A intacto (home + rutas 200); CSP intacta"
  - "app/middleware.ts fail-open (Rule 1 fix): no tumba Camino A cuando falta el secret del spike"
  - "97-DEPLOY-RUNBOOK.md: runbook reproducible Docker+wrangler + fragmento del log del middleware + regresión documentada"
affects: [97-03, "Phase 103 (NOTIF, auth server-side)"]

tech-stack:
  added: []
  patterns:
    - "middleware.ts deprecado = Edge bajo OpenNext (confirmado EMPÍRICO en deploy real, no asumido)"
    - "Deploy: build+deploy OpenNext DENTRO del contenedor node:22-slim montando el OAuth token del host (el wrapper wrangler del host no tiene opennextjs-cloudflare en PATH)"
    - "middleware con matcher global DEBE ser fail-open ante env ausente (no puede hard-500 Camino A)"

key-files:
  created:
    - .planning/phases/97-auth-p0-spike-auth-on-workers-de-risk/97-DEPLOY-RUNBOOK.md
  modified:
    - app/middleware.ts

key-decisions:
  - "SC1 CERRADO en positivo: middleware.ts corre como Edge en OpenNext 1.19.11 + Next 16.2.11 — NO se dispara el fallback SC4 del Plan 03"
  - "middleware fail-open (NextResponse.next si falta SUPABASE_PUBLISHABLE_KEY/URL): preserva Camino A; supabase-user.ts sigue fail-loud en /spike-auth"
  - "Deploy corre el pnpm run deploy DENTRO del contenedor con el config OAuth del host montado en /root/.config/.wrangler"

patterns-established:
  - "Empírico-sobre-deploy-real: la pregunta estructural del bundle OpenNext solo se responde deployando, no con next build"
  - "Fail-open para middleware de matcher global; fail-loud para el cliente de la ruta de auth"

requirements-completed: [AUTH-01]

duration: ~35min
completed: 2026-07-23
---

# Phase 97 Plan 02: SPIKE auth-on-Workers — deploy OpenNext real Summary

**El primer middleware.ts del repo SOBREVIVE el build OpenNext como Edge (deprecation warning, NO error "Node.js middleware not supported") y el deploy real a Cloudflare (version 3952f9bc) sirve Camino A 200 con la middleware corriendo — SC1 cerrado empíricamente en positivo; el fallback SC4 NO se dispara.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-23T23:55Z
- **Tasks:** 1 auto completada (Task 2) + 1 checkpoint blocking-human ABIERTO (Task 1, operador)
- **Files modified:** 2 (1 nuevo runbook, 1 middleware fix)

## Accomplishments

- **SC1 EMPÍRICO (la pregunta #1 del spike): PASS.** El build OpenNext (Docker `node:22-slim`, `@opennextjs/cloudflare` 1.19.11, Next.js 16.2.11) con el nuevo `middleware.ts` presente emitió el **warning de deprecación ESPERADO** (`⚠ The "middleware" file convention is deprecated`) y lo bundleó como Edge (`Bundling middleware function...`, `ƒ Proxy (Middleware)`), NO el error fatal `"Node.js middleware is not currently supported"`. `OpenNext build complete` + `BUILD EXIT: 0` + `worker.js` emitido. Esto CIERRA la Open Question #1 (Version Trap Next 16 middleware→proxy) en positivo: la convención deprecada `middleware.ts` es Edge-compatible con OpenNext HOY, sin migrar a `proxy.ts`. **NO se dispara el fallback SC4 del Plan 03.**
- **Deploy REAL publicado.** `pnpm run deploy` (OpenNext build+deploy) dentro del contenedor con el OAuth de wrangler del host montado → version `3952f9bc-d817-45f9-a097-66e404983183` en https://observatorio-congreso.thevalis.workers.dev.
- **Camino A intacto verificado sobre el deploy real.** `/`, `/parlamentarios`, `/agenda`, `/buscar`, `/metodologia` → 200 estable. CSP ENFORCED sin cambios: `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` (auth server-side → cero cambio de CSP).
- **97-DEPLOY-RUNBOOK.md** (≥187 líneas): runbook reproducible (robocopy + Docker build + deploy-en-contenedor con OAuth montado), el fragmento verbatim del OpenNext log del middleware, la versión del deploy, la regresión detectada+corregida, y los pasos exactos del operador para Task 1.

## Task Commits

1. **Task 2: Build OpenNext real + deploy + log del middleware** — `0872249` (fix)

**Nota:** Task 1 (checkpoint:human-action blocking-human) NO se cerró — requiere actos del operador (crear publishable key, config Auth Supabase, cargar wrangler secret). Ver §Checkpoint abierto.

## Files Created/Modified

- `.planning/phases/97-.../97-DEPLOY-RUNBOOK.md` (NUEVO) — runbook reproducible + evidencia del log + regresión.
- `app/middleware.ts` (MODIFICADO) — fail-open ante env ausente (Rule 1 fix).

## Decisions Made

- **SC1 cerrado en positivo** — la evidencia del build real desactiva la rama de fallback (SC4) del Plan 03. Plan 03 puede proceder con la evidencia OTP/refresh (no con el fallback honesto).
- **Fail-open para la middleware de matcher global; fail-loud para la ruta de auth** — la middleware que corre en TODA la app no puede hard-500 el sitio cuando el spike no está configurado; el cliente user de `/spike-auth` sí debe fallar fuerte si falta la key.
- **Deploy en contenedor** — el wrapper `wrangler deploy` del host delega a `opennextjs-cloudflare deploy`, que no está en PATH del host (devDependency). Solución: correr `pnpm run deploy` dentro del mismo `node:22-slim` montando el config OAuth del host. Registrado en el runbook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Middleware VERBATIM del Plan 01 tumbaba Camino A (500 global)**
- **Found during:** Task 2 (verificación post-deploy del deploy inicial `694441b7`)
- **Issue:** El matcher de la middleware cubre TODAS las rutas. Con `SUPABASE_PUBLISHABLE_KEY` ausente (el secret es Task 1, aún no cargado), `updateSession()` → `leerEnv()` hace `throw` en cada request; un throw en la middleware Edge hard-500ea el response del sitio ENTERO. `curl -I /` y `/parlamentarios` daban 500 consistente tras propagar. Viola la restricción LOCKED "Camino A intacto" (threat T-97-08).
- **Fix:** `app/middleware.ts` FAIL-OPEN: si falta la publishable key o la URL, retorna `NextResponse.next({ request })` (pasa el request sin refresh) en vez de throw. El cliente user (`supabase-user.ts` / `/spike-auth`) SIGUE fail-loud. Redeploy (`3952f9bc`) → Camino A 200 estable.
- **Files modified:** `app/middleware.ts`
- **Verification:** typecheck exit 0; suite app 1244/1244 verde (incl. lockdown-guard, env-example-guard); post-redeploy `/`+4 rutas 200 estable; `/spike-auth` 500 aislado (espera el secret).
- **Committed in:** `0872249` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug Rule 1)
**Impact on plan:** El fix es CRÍTICO para la restricción LOCKED "Camino A intacto" y el threat T-97-08. Sin scope creep — es el comportamiento correcto para una middleware de matcher global cuando el spike no está configurado. El middleware SIGUE corriendo como Edge en cada request (la evidencia SC1 se mantiene); solo cambia su comportamiento ante env ausente.

## Issues Encountered

- **Propagación de edge de Cloudflare:** tras cada deploy, ~10-30 s de 500 intermitentes (versión vieja vs nueva) antes de estabilizar. Documentado en el runbook. No es un bug del código.
- **`wrangler` sombreado por un paquete Python** en el PATH del equipo; el real es el npm global (`AppData/Roaming/npm/wrangler.cmd`). Invocado por ruta absoluta / dentro del contenedor. Documentado.
- **`opennextjs-cloudflare` no en PATH del host** — resuelto corriendo el deploy dentro del contenedor con el OAuth montado.

## Known Stubs

- `/spike-auth` devuelve 500 en el deploy real porque su Server Component (`createUserClient` → fail-loud) requiere `SUPABASE_PUBLISHABLE_KEY`, que NO está cargado como wrangler secret (es Task 1 = operador). Es un fallo AISLADO y correcto (fail-loud), no un stub de datos ni un bug del sitio. Se resuelve cuando el operador cierra Task 1; entonces `/spike-auth` renderiza y Plan 03 captura la evidencia OTP/refresh.

## User Setup Required

**External services require manual configuration (Task 1 — checkpoint blocking-human ABIERTO).** Ver `97-DEPLOY-RUNBOOK.md` §"Estado de runtime pendiente" para los pasos EXACTOS:
1. Supabase Dashboard → crear la **publishable key** (`sb_publishable_…`) del proyecto `bctyygbmqcvizyplktuw`.
2. Supabase Dashboard → Auth → Email provider ON + plantilla OTP que renderice `{{ .Token }}` (NO `{{ .ConfirmationURL }}`).
3. `wrangler secret put SUPABASE_PUBLISHABLE_KEY` (host, OAuth global) + confirmar con `wrangler secret list`.
4. Poner el valor en el `.env` LOCAL del operador (NO en `.env.example`).

## Next Phase Readiness

- **Plan 03 (evidencia):** DESBLOQUEADO en la rama POSITIVA — SC1 confirmó middleware=Edge, así que Plan 03 ejecuta la captura de evidencia (Set-Cookie + refresh + dos-jarras curl + BrowserOS), NO el fallback SC4. **PRECONDICIÓN:** Task 1 del operador debe cerrarse primero (sin el secret, `/spike-auth` da 500 y no hay flujo OTP que evidenciar).
- **Blocker abierto:** Task 1 (publishable key + config Auth + wrangler secret) = acto del operador. El orquestador tiene MCP BrowserOS + acceso al correo del operador y puede cerrar este gate interactivamente.

## Self-Check: PASSED

- FOUND: 97-DEPLOY-RUNBOOK.md
- FOUND: 97-02-SUMMARY.md
- FOUND: app/middleware.ts (fail-open fix)
- FOUND: commit 0872249

---
*Phase: 97-auth-p0-spike-auth-on-workers-de-risk*
*Completed: 2026-07-23*
