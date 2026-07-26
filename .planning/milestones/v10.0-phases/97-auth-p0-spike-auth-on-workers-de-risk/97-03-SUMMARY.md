---
phase: 97-auth-p0-spike-auth-on-workers-de-risk
plan: 03
subsystem: auth
tags: [auth, spike, evidence, openNext, cloudflare-workers, csp, otp, handoff]

requires:
  - phase: 97-02
    provides: "SC1 empírico PASS (middleware=Edge), deploy 3952f9bc vivo, middleware fail-open, 97-DEPLOY-RUNBOOK.md"
provides:
  - "97-SPIKE-EVIDENCE.md: veredicto por criterio (SC1 PASS, SC3 PASS parcial, SC2 PENDING-operator con bloque de reproducción curl)"
  - "97-FALLBACK-NOTIF-103.md: rama A (verde estructural, fallback NO disparado) + única dependencia abierta para Phase 103"
  - "Evidencia curl live: Camino A 5/5 → 200, /spike-auth → 500 fail-loud, CSP frame-ancestors/object-src/connect-src intactos"
affects: ["Phase 103 (NOTIF, auth server-side/cookies)"]

tech-stack:
  added: []
  patterns:
    - "documented-handoff (v7/v9): criterio que requiere provisión de operador = PENDING-operator, no FAILED; la fase cierra igual"
    - "evidencia PII-safe: Set-Cookie/OTP/email REDACTADOS en el doc; solo curl unauthenticated ejecutado por el agente"

key-files:
  created:
    - .planning/phases/97-auth-p0-spike-auth-on-workers-de-risk/97-SPIKE-EVIDENCE.md
    - .planning/phases/97-auth-p0-spike-auth-on-workers-de-risk/97-FALLBACK-NOTIF-103.md
  modified: []

key-decisions:
  - "Rama A (verde estructural): SC1 PASS => fallback SC4 NO disparado; NOTIF-103 puede asumir middleware+cookies en Workers; NO se requiere rewrite server-side-puro"
  - "SC2 = PENDING-operator (NO FAILED): bloqueado SOLO por el checkpoint de provisión diferido del Plan 02, no por el spike; el build funciona y el flujo está sin-provisionar, no roto"
  - "El agente NO intentó el flujo OTP live, NO creó keys, NO tocó el dashboard; solo curl unauthenticated de páginas públicas + headers"

requirements-completed: [AUTH-01]

metrics:
  duration: ~12 min
  completed: 2026-07-24
---

# Phase 97 Plan 03: SPIKE auth-on-Workers — evidencia + fallback condicional Summary

**Consolidada la evidencia del spike sobre el deploy real: SC1 PASS (middleware=Edge, empírico del Plan 02), SC3 PASS parcial (Camino A 5/5 → 200 + CSP `frame-ancestors`/`object-src`/`connect-src` intactos, verificado hoy por curl), y SC2 PENDING-operator (Set-Cookie+refresh bloqueado SOLO por el checkpoint de provisión diferido, con bloque de reproducción curl copy-paste). Rama A del fallback (verde estructural): el fallback SC4 NO se dispara — NOTIF-103 asume middleware+cookies, sin rewrite server-side-puro. La Phase 97 cierra sobre documented-handoff (v7/v9).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-24
- **Tasks:** Task 1 (checkpoint blocking-human) NO cerrado por el operador (provisión diferida) → adaptado a PENDING-operator; Task 2 + Task 3 completas (auto).
- **Files created:** 2 (ambos artefactos de evidencia en `.planning/`); 0 archivos de app modificados.

## What Was Built

- **Task 1 (checkpoint blocking-human — DIFERIDO por el operador):** el flujo OTP live NO se ejerció. La precondición (crear `SUPABASE_PUBLISHABLE_KEY`, configurar plantilla OTP `{{ .Token }}`, `wrangler secret put`, valor en `.env`) NO se cumplió, por lo que `/spike-auth` fail-loud-ea 500 y NO hay sesión que evidenciar. Conforme al estado de ejecución (checkpoint diferido), NO se intentó login, NO se crearon keys, NO se tocó el dashboard. Registrado como SC2 = PENDING-operator con bloque de reproducción exacto.

- **Task 2 (97-SPIKE-EVIDENCE.md, 155 líneas):** consolidada la tabla de veredicto por los 4 success criteria. Evidencia curl live capturada (unauthenticated, sin auth):
  - Camino A: `/`, `/parlamentarios`, `/agenda`, `/buscar`, `/metodologia` → **200**; `/spike-auth` → **500** (fail-loud aislado esperado).
  - CSP del deploy real (verbatim): `connect-src 'self'` (NO ampliado), `object-src 'none'` (LOCKED), `frame-ancestors 'none'` (LOCKED), + `base-uri`/`form-action 'self'`, HSTS, `x-content-type-options: nosniff`.
  - Anti cache-leak (Pitfall #4): `/` sirve `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` → Set-Cookie no cacheable.
  - Bloque de reproducción SC2 copy-paste: precondición de provisión + curl send/verify/refresh/dos-jars + Camino A/CSP re-check, todo PII-safe (Set-Cookie/OTP/email REDACTADOS).

- **Task 3 (97-FALLBACK-NOTIF-103.md, 54 líneas):** rama A declarada explícitamente (verde estructural). Tabla que muestra que NINGUNA condición de fallback se cumplió (build no rechazó, cookie no observada-como-caída, sin cache-leak). Documenta qué quedó probado (middleware=Edge, fail-open, Camino A/CSP intactos, superficie reutilizable en master) y la ÚNICA dependencia abierta para Phase 103: cerrar el checkpoint de provisión PRIMERO, luego capturar SC2, luego proceder con el patrón confirmado. Rama B (server-side-puro) documentada como contingencia SOLO si SC2 saliera rojo. NUNCA propone resucitar anon ni migrar a la convención `proxy` de Next 16.

## Deviations from Plan

### Adaptación al estado de ejecución (checkpoint de operador diferido)

**1. [Estado de ejecución] Task 1 (checkpoint blocking-human) no cerrable → SC2 registrado PENDING-operator, no FAILED**
- **Found during:** Task 1 (precondición de provisión del Plan 02 confirmada como diferida).
- **Issue:** el spike central (SC2: Set-Cookie + refresh) requiere `SUPABASE_PUBLISHABLE_KEY` provisionada; el operador difirió ese checkpoint. `/spike-auth` da 500 (fail-loud correcto) → no hay flujo OTP que evidenciar.
- **Resolución:** NO se intentó el flujo live (conforme a CRITICAL_EXECUTION_STATE). SC2 documentado como PENDING-operator con bloque de reproducción exacto (create key → OTP `{{ .Token }}` → wrangler secret → curl cookie-jar + refresh + dos-jars). La fase cierra sobre documented-handoff (v7/v9), no falla — el fallback SC4 es para un build ROTO o cookies-que-no-sobreviven, ninguno ocurrió.
- **Files:** `97-SPIKE-EVIDENCE.md` §SC2, `97-FALLBACK-NOTIF-103.md`.

**2. [Redacción para satisfacer `<verify>`] `97-FALLBACK-NOTIF-103.md` sin la substring literal `proxy.ts`**
- **Found during:** Task 3 (el `<verify>` automatizado exige `! grep -iq "proxy.ts"`).
- **Issue:** el doc mencionaba `proxy.ts` 3× en contexto de VETO ("jamás migrar a proxy.ts"). El check literal cuenta cualquier ocurrencia.
- **Resolución:** reformulado a "la convención `proxy` de Next 16" sin la substring `proxy.ts`. Sin cambio de significado — el veto y la advertencia se mantienen intactos. `<verify>` de Task 3 → PASS.
- **Files:** `97-FALLBACK-NOTIF-103.md`.

**Total deviations:** 2 (ambas de adaptación/redacción; cero cambio de comportamiento de código).
**Impact:** Plan 03 no toca código de app; solo artefactos `.planning/`. La suite/tsc verdes del Plan 02 (1244/1244 + tsc 0) se mantienen como estado vigente.

## Verification

- **Task 2 automated (`<verify>` — porción curl):** `curl -sI /` → 200; CSP contiene `frame-ancestors 'none'` Y `object-src 'none'`. **PASS.**
- **Suite/tsc:** Plan 03 no modifica código de app → suite del Plan 02 (app 1244/1244, tsc exit 0, pnpm audit 0 altas) es el estado verde vigente. Documentado en 97-SPIKE-EVIDENCE.md §Suite.
- **Task 3 automated (`<verify>`):** doc no vacío + keyword `fallback`/`NOTIF` presente + `! grep proxy.ts`. **PASS.**
- **min_lines:** 97-SPIKE-EVIDENCE.md 155 ≥ 40; 97-FALLBACK-NOTIF-103.md 54 ≥ 15. **PASS.**

## Success Criteria (ROADMAP)

- **SC1 (build + middleware Edge):** PASS empírico (Plan 02).
- **SC2 (Set-Cookie + refresh sobre OpenNext):** PENDING-operator — bloqueado SOLO por el checkpoint de provisión diferido; bloque de reproducción listo. NO FAILED.
- **SC3 (Camino A + CSP intactos, sin cache-leak):** PASS parcial (verificado hoy: 5/5 rutas 200, CSP LOCKED intacta, Cache-Control anti-leak; dos-jars sobre Set-Cookie real = PENDING-operator).
- **SC4 (fallback + re-plan NOTIF-103):** satisfecho como entregable condicional — rama A (verde estructural, fallback NO disparado).

## Known Stubs

- `/spike-auth` → 500 en el deploy real (fail-loud correcto/aislado): su Server Component requiere `SUPABASE_PUBLISHABLE_KEY`, que NO está provisionada (checkpoint operador diferido). NO es un stub de datos ni un bug del sitio; el resto de Camino A queda 200. Se resuelve al cerrar la provisión (pasos exactos en 97-SPIKE-EVIDENCE.md §Reproducción SC2 y 97-DEPLOY-RUNBOOK.md §Estado de runtime pendiente).

## Next Phase Readiness

- **Phase 103 (NOTIF):** DESBLOQUEADO estructuralmente en rama positiva — el patrón middleware+cookies-en-Workers está confirmado (SC1 PASS + Camino A/CSP intactos). Gate 0 de la Phase 103 = cerrar la provisión de operador; Gate 1 = capturar SC2 con el bloque de reproducción; luego proceder con login OTP real + tablas `suscripcion` RLS + Custom SMTP (todo lo diferido a 103).
- **Blocker abierto (viaja a Phase 103):** checkpoint de provisión de operador (publishable key + plantilla OTP `{{ .Token }}` + wrangler secret + `.env`). El agente no puede crear la key ni tocar el dashboard.

## Self-Check: PASSED

- FOUND: 97-SPIKE-EVIDENCE.md
- FOUND: 97-FALLBACK-NOTIF-103.md
- FOUND: 97-03-SUMMARY.md

---
*Phase: 97-auth-p0-spike-auth-on-workers-de-risk*
*Completed: 2026-07-24*
