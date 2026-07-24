---
phase: 97-auth-p0-spike-auth-on-workers-de-risk
verified: 2026-07-24T13:20:00Z
status: human_needed
score: 3/4 must-haves verified (SC2 = documented operator handoff)
overrides_applied: 0
human_verification:
  - test: "SC2 — Set-Cookie + refresh de sesión Supabase Auth sobre el deploy real"
    expected: "Tras provisión (publishable key + plantilla OTP {{ .Token }} + wrangler secret), /spike-auth pasa de 500 a 200; verifyOtp emite Set-Cookie sb-<ref>-auth-token; un request posterior tras expiry emite un NUEVO Set-Cookie (refresh sobrevive OpenNext); dos jars distintos nunca comparten sesión y no hay cf-cache-status HIT en respuestas con Set-Cookie."
    why_human: "Requiere actos de operador que el agente no puede ejecutar: crear la publishable key en el dashboard Supabase, configurar la plantilla OTP, cargar el wrangler secret (OAuth) y leer el código OTP de 6 dígitos del email del operador. El checkpoint fue DIFERIDO por el operador (por diseño del contrato de corrida autónoma). Bloque de reproducción copy-paste listo en 97-SPIKE-EVIDENCE.md §Reproducción SC2."
---

# Phase 97: AUTH P0 — SPIKE auth-on-Workers de-risk Verification Report

**Phase Goal:** Confirmar sobre el deploy REAL que OpenNext/Cloudflare sostiene una sesión de Supabase Auth end-to-end ANTES de construir cualquier feature de usuario — el mayor riesgo desconocido de-riskeado temprano, sin bloquear el panel.
**Verified:** 2026-07-24T13:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Este es un SPIKE de de-risk. Su propósito estructural — responder "¿el primer `middleware.ts` del repo sobrevive el pipeline OpenNext y corre como Edge sin romper Camino A ni CSP?" — está RESUELTO EN POSITIVO y verificado contra el código y el deploy real (version `3952f9bc`). El único criterio que no pudo capturarse empíricamente (SC2: Set-Cookie + refresh live) está bloqueado SOLO por un checkpoint de provisión de operador deliberadamente diferido, con bloque de reproducción exacto entregado. Por el patrón documented-handoff (v7/v9), esto es un handoff humano, NO un gap.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| SC1 | Existe un `middleware.ts` mínimo desplegado que corre en OpenNext sin romper el build (Edge-style, NO Node Middleware) | ✓ VERIFIED | `app/middleware.ts` existe (primer middleware del repo, sin `proxy.ts`, sin `runtime` config, matcher salta estáticos). Build OpenNext real (Docker node:22-slim, @opennextjs/cloudflare 1.19.11, Next 16.2.11) emitió el warning de deprecación ESPERADO + `Bundling middleware function` + `ƒ Proxy (Middleware)` + `OpenNext build complete`; señal de fallo `"Node.js middleware is not currently supported"` NO observada. Deploy `3952f9bc` vivo. Evidencia verbatim en 97-DEPLOY-RUNBOOK.md (217 líneas). |
| SC2 | Sobre el deploy real, sesión Supabase Auth (OTP) emite Set-Cookie + refresh sobrevive OpenNext | ? UNCERTAIN → human_needed | Bloqueado SOLO por el checkpoint de provisión diferido (publishable key + plantilla OTP + wrangler secret). El build funciona (SC1 PASS); `/spike-auth` fail-loud-ea 500 porque `SUPABASE_PUBLISHABLE_KEY` no está provisionada — el flujo está SIN provisionar, no roto. Documented-handoff por diseño; bloque de reproducción copy-paste en 97-SPIKE-EVIDENCE.md §Reproducción SC2. NO es un gap. |
| SC3 | El spike NO resucita anon legacy ni toca service_role; Camino A intacto; nuevo acceso bajo privilegio con RLS | ✓ VERIFIED | Código: `app/lib/supabase-user.ts` lee EXCLUSIVAMENTE `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` (grep confirmó cero lecturas de secret/anon; la única mención de `SUPABASE_SECRET_KEY` está en el texto del error fail-loud, no en `process.env`), `import "server-only"` línea 1, módulo separado del service_role. Middleware FAIL-OPEN ante env ausente (líneas 24-26) → Camino A no puede 500. `/spike-auth` gated tras `SPIKE_AUTH_ENABLED` (OFF default, fail-closed) + `noindex` tras el fix CR-01. curl live: `/`,`/parlamentarios`,`/agenda`,`/buscar`,`/metodologia` → 200; CSP `frame-ancestors 'none'` + `object-src 'none'` intactos, `connect-src 'self'` NO ampliado. (dos-jars sobre Set-Cookie real depende de SC2 → pendiente). |
| SC4 | Si el deploy NO sostiene la sesión → fallback honesto + re-plan NOTIF-103 documentado | ✓ VERIFIED (N/A correcto) | El build NO falló (SC1 PASS) → fallback NO disparado. `97-FALLBACK-NOTIF-103.md` (54 líneas) declara rama A explícitamente, tabla mostrando que ninguna condición de fallback se cumplió, qué quedó probado, y la única dependencia abierta (checkpoint de provisión) para Phase 103. NUNCA propone resucitar anon ni la substring `proxy.ts`. |

**Score:** 3/4 truths verified; SC2 = documented operator handoff (human_needed).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/middleware.ts` | Edge-style middleware llamando updateSession con matcher; fail-open | ✓ VERIFIED | Existe; importa `updateSession` de `@/lib/supabase-user`; `export const config` con matcher; fail-open ante env ausente; sin `runtime`, sin `proxy.ts`. |
| `app/lib/supabase-user.ts` | createServerClient publishable + updateSession cookie refresh | ✓ VERIFIED | server-only línea 1; `updateSession` canónico (createServerClient → getClaims sin código intermedio → devuelve supabaseResponse); `createUserClient` helper; fail-loud; cero secret/anon. |
| `app/app/spike-auth/page.tsx` | Página server no enlazada, estado sesión vía getClaims, gated | ✓ VERIFIED | force-dynamic; `notFound()` si `!spikeAuthEnabled`; `robots noindex`; muestra solo "con/sin sesión" + expiry, cero email/token. |
| `app/app/spike-auth/actions.ts` | Server actions OTP send/verify, gated, sin PII leak | ✓ VERIFIED | `signInWithOtp({shouldCreateUser:true})` sin emailRedirectTo; `verifyOtp({type:"email"})`; gate CR-01 primera sentencia; validación WR-01 (email regex+254, OTP 6 dígitos); WR-02 no interpola error de GoTrue; cero `.rpc()`/`.from()`. |
| `app/lib/spike-auth-gate.ts` | Gate fail-closed SPIKE_AUTH_ENABLED | ✓ VERIFIED | server-only; solo literal "true" enciende; espejo de admin/net/money-gate. |
| `.env.example` | SUPABASE_PUBLISHABLE_KEY= + SPIKE_AUTH_ENABLED= placeholders vacíos | ✓ VERIFIED | Ambos presentes con valor vacío (líneas 31, 85); env-example-guard verde. |
| `97-DEPLOY-RUNBOOK.md` | Runbook Docker+wrangler + log del middleware (≥30 líneas) | ✓ VERIFIED | 217 líneas; veredicto empírico verbatim, versión deploy, regresión fail-open documentada. |
| `97-SPIKE-EVIDENCE.md` | Veredicto por criterio + bloque reproducción SC2 (≥40 líneas) | ✓ VERIFIED | 155 líneas; tabla 4 SC + evidencia curl live + reproducción SC2 PII-safe. |
| `97-FALLBACK-NOTIF-103.md` | Rama condicional (≥15 líneas) | ✓ VERIFIED | 54 líneas; rama A + dependencia abierta para 103; sin `proxy.ts`. |
| `app/lib/supabase-user.test.ts` | Cobertura WR-04 (fail-loud + response sin mutar) | ✓ VERIFIED | 4 tests verdes; cubre fail-loud de updateSession/createUserClient + response sin mutar. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `app/middleware.ts` | `app/lib/supabase-user.ts` | `import { updateSession }` | ✓ WIRED | Import presente línea 14; llamado en línea 27 (tras el guard fail-open). |
| `app/lib/supabase-user.ts` | `SUPABASE_PUBLISHABLE_KEY` | createServerClient con publishable key | ✓ WIRED | `process.env.SUPABASE_PUBLISHABLE_KEY` leído en `leerEnv()` (línea 34); pasado a `createServerClient`. |
| `page.tsx` / `actions.ts` | `spike-auth-gate.ts` | `spikeAuthEnabled(process.env)` | ✓ WIRED | Gate como primera sentencia en page y en ambas actions (fail-closed independiente). |
| deploy `3952f9bc` | `Set-Cookie sb-*-auth-token` | getClaims refresca | ⚠ PENDING | Estructuralmente cableado (updateSession → getClaims → setAll → supabaseResponse) pero no ejercido live por falta de provisión (SC2 handoff). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/app/spike-auth/actions.ts` | 96, 126 | `console.error` con status/name (no PII) | ℹ️ Info | Intencional post-WR-02: loguea SOLO campos no-PII (status, name), nunca email/token/mensaje upstream. Cumple Ley 21.719. No es un leak. |

Cero debt markers (TODO/FIXME/XXX) sin referencia formal en los archivos de la fase. Cero stubs de datos. El `/spike-auth` 500 es fail-loud correcto por falta de secret, no un stub.

### Discrepancia menor (no bloqueante)

El contexto crítico afirmó "WR-04 middleware fail-open test added". El test entregado (`app/lib/supabase-user.test.ts`) cubre las invariantes del cliente user (fail-loud + response sin mutar) pero NO existe un `app/middleware.test.ts` que aserte directamente la rama fail-open del middleware (guard `if (!SUPABASE_PUBLISHABLE_KEY...)`). El review WR-04 pedía ambos. La rama fail-open del middleware SÍ fue verificada empíricamente (deploy `3952f9bc` sirve Camino A 200 con el secret ausente), así que la cobertura estructural existe aunque no como unit test. Se anota como deuda menor, no como gap del goal.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| AUTH-01 | 97-01/02/03 | Deploy OpenNext sostiene sesión Supabase Auth end-to-end (primer middleware.ts Edge, @supabase/ssr, Set-Cookie+refresh verificados sobre deploy real) | ◐ SATISFIED (estructural) / SC2 human_needed | La parte estructural (middleware=Edge, build no roto, Camino A/CSP intactos, bajo privilegio) está VERIFIED. La parte "Set-Cookie + refresh verificados sobre deploy real" es el checkpoint de provisión diferido (human_needed). REQUIREMENTS.md lo marca "Complete" — coherente con documented-handoff. |

### Human Verification Required

**1. SC2 — Sesión Supabase Auth end-to-end sobre el deploy real**

**Test:** Cerrar el checkpoint de provisión (crear publishable key `sb_publishable_…` en Supabase dashboard, configurar plantilla OTP `{{ .Token }}`, `wrangler secret put SUPABASE_PUBLISHABLE_KEY`, valor en `.env` local), luego correr el bloque de reproducción curl de 97-SPIKE-EVIDENCE.md §Reproducción SC2 (send → verify → refresh → dos-jars).
**Expected:** `/spike-auth` pasa de 500 a 200; `verifyOtp` emite `Set-Cookie sb-<ref>-auth-token` (HttpOnly; Secure; SameSite=Lax); un request posterior tras expiry emite un NUEVO Set-Cookie (refresh sobrevive OpenNext); jar B vacío nunca recibe la sesión de jar A; sin `cf-cache-status: HIT` en respuestas con Set-Cookie.
**Why human:** Requiere credenciales/actos de operador que el agente no posee (crear key en dashboard, cargar wrangler secret vía OAuth, leer el código OTP del email del operador). Checkpoint DIFERIDO por diseño del contrato de corrida autónoma; documented-handoff (v7/v9) → no falla la fase.

### Gaps Summary

Ningún gap bloqueante. El propósito del spike (de-riskear si el primer middleware sobrevive OpenNext) está resuelto EN POSITIVO y verificado contra código y deploy real: SC1 PASS empírico, SC3 PASS (Camino A + CSP + bajo privilegio + no-resurrección-anon confirmados en código y curl live), SC4 correctamente N/A (build no falló → fallback documentado como no-disparado). SC2 (evidencia live de Set-Cookie + refresh) es un checkpoint de provisión de operador deliberadamente diferido, con bloque de reproducción copy-paste entregado — un handoff humano, no una falla. La fase cierra sobre el patrón documented-handoff establecido en v7/v9. Deuda menor: falta un `middleware.test.ts` directo de la rama fail-open (la rama fue verificada empíricamente en el deploy).

---

_Verified: 2026-07-24T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
