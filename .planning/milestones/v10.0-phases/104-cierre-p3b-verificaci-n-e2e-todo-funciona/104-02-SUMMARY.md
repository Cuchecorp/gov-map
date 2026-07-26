---
phase: 104
plan: "02"
status: complete
completed: 2026-07-26
requirements: [E2E-01]
key-files:
  created:
    - .planning/phases/104-cierre-p3b-verificaci-n-e2e-todo-funciona/104-DEPLOY-RUNBOOK.md
  modified:
    - app/app/cuenta/page.tsx
    - app/app/cuenta/actions.ts
---

# 104-02 SUMMARY — Deploy v10.0 (arrastra 101+102+103) + flip VSIM ON

**Nota de cierre:** el executor original fue cortado por límite de sesión a mitad del plan; el orquestador cerró manualmente (safe-resume §manual closeout) verificando el estado real por filesystem/wrangler/curl.

## Qué pasó

1. **Deploy #1 `027efdf6`** (16:50:19Z, ejecutado por el executor antes del corte): build OpenNext en Docker `node:22-slim` sobre mirror C:\Temp\obs-build. Fix de build en el camino: `382b274` (CONSENT_VERSION fuera del módulo "use server" — OpenNext rechaza exports no-async).
2. **Flip VSIM** `b8449d8c` (16:50:44Z): `wrangler secret put VSIM_PUBLIC_ENABLED=true`. Confirmado en `wrangler secret list`. `.env.example` intacto; anti-flip guard verde. Dossier firmado en 104-01.
3. **Defecto post-deploy detectado por el orquestador:** `/cuenta` 500 — `createUserClient` (fail-loud sin SUPABASE_PUBLISHABLE_KEY) se instanciaba ANTES del gate NOTIF. Fix `e7d588a`: gate-primero, flag OFF renderiza copy "no disponible" sin cliente. Tests cuenta 9/9, suite app 1418/1418, tsc limpio.
4. **Deploy #2 `3cd2511d`** (final): build + deploy containerizados de nuevo con el fix.

## Verificación final (sobre `3cd2511d`)

- `/cuenta` 200 gated (era 500) · Camino A 5/5 en 200 · `/spike-auth` 404 · CSP enforced + HSTS.
- Eje VSIM VIVO en /comparar (D1170/D1165: "Coinciden en 3655 de 3672") con caveat base-alta.
- "Seguir" 0 ocurrencias (NOTIF OFF DOM-ausente); MONEY ausente.

## Deviations

- Corte de sesión mid-plan → cierre manual por orquestador (Rule: safe-resume, spot-check por wrangler deployments + git log).
- Fix emergente `e7d588a` (Rule 1: bug real bloqueando acceptance criterion "cuenta 404-or-gated").

## Estado flags Worker

VSIM=true (autorizado+firmado) · NOTIF=ausente/OFF (provisión pendiente, 103-HUMAN-UAT) · MONEY OFF.
