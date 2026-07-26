# 97-FALLBACK-NOTIF-103 — rama condicional + dependencia para Phase 103

**Escrito:** 2026-07-24
**Plan:** 97-03 (Wave 3) — satisface SC4 como entregable condicional
**Deploy de referencia:** version `3952f9bc` en https://observatorio-congreso.thevalis.workers.dev

---

## RAMA TOMADA: A — spike verde estructural (fallback NO requerido)

El fallback SC4 (rewrite server-side-puro para NOTIF-103) **NO se dispara.** Justificación por veredicto:

| Condición del fallback (rama B) | ¿Ocurrió? | Evidencia |
|---------------------------------|-----------|-----------|
| El build OpenNext RECHAZÓ el middleware (error "Node.js middleware not supported") | **NO** | SC1 PASS empírico: warning de deprecación + `Bundling middleware function` + `OpenNext build complete`; deploy `3952f9bc` vivo. Ver 97-DEPLOY-RUNBOOK.md §VEREDICTO EMPÍRICO y 97-SPIKE-EVIDENCE.md §SC1. La convención deprecada `middleware.ts` corre como Edge; NO se migró a la convención `proxy` de Next 16 (que correría en Node y OpenNext rechaza). |
| La cookie/refresh NO sobrevivió OpenNext | **NO OBSERVADO** | El flujo end-to-end no se ejerció (checkpoint de provisión diferido). NO hubo evidencia de que la cookie se caiga; simplemente el flujo está SIN PROVISIONAR, no roto. SC2 = PENDING-operator, no FAILED. |
| Hubo cache-leak entre usuarios | **NO** | `/` sirve `Cache-Control: private, no-cache, no-store` (force-dynamic) → Set-Cookie no cacheable; test dos-jars queda como paso PENDING-operator, no como fallo. |

Como ninguna condición de fallback se cumplió, **NOTIF-103 puede asumir el modelo middleware + cookies en Workers** (convención deprecada `middleware.ts` = Edge bajo OpenNext, `@supabase/ssr` `updateSession()` con publishable key de bajo privilegio). NO se necesita re-arquitectura server-side-pura.

---

## Qué quedó PROBADO por este spike (para que Phase 103 NO re-verifique)

1. **El primer `middleware.ts` del repo sobrevive el build OpenNext y corre como Edge** — sin migrar a la convención `proxy` de Next 16, sin codemod, sin `runtime` config. (SC1, empírico sobre el deploy real.)
2. **El middleware de matcher global es fail-open ante env ausente** (`NextResponse.next` si falta `SUPABASE_PUBLISHABLE_KEY`/`URL`) → NO puede tumbar Camino A. El cliente user de la ruta de auth (`supabase-user.ts`) SIGUE fail-loud. Este es el patrón correcto para NOTIF-103.
3. **Camino A + CSP intactos con el middleware presente** — `frame-ancestors 'none'` + `object-src 'none'` preservados; `connect-src 'self'` NO ampliado porque la auth es 100% server-side (cero cliente-navegador Supabase → cero cambio CSP). Phase 103 debe mantener este invariante.
4. **Superficie de código reutilizable, ya en master:** `app/lib/supabase-user.ts` (updateSession + createUserClient, publishable key, SEPARADO del service_role), `app/middleware.ts` (Edge, fail-open), `app/app/spike-auth/*` (patrón OTP send/verify de referencia).

---

## ÚNICA dependencia abierta para NOTIF-103

**Cerrar PRIMERO el checkpoint de provisión diferido** (Plan 02 Task 1), luego proceder con el patrón de middleware confirmado. La pipeline de auth está estructuralmente confirmada (middleware corre como Edge, Camino A/CSP intactos), pero la **evidencia end-to-end de sesión (Set-Cookie + refresh sobre OpenNext, SC2) queda PENDING** hasta que exista `SUPABASE_PUBLISHABLE_KEY`.

**Secuencia recomendada para Phase 103 (NOTIF):**
1. **Gate 0 — cerrar la provisión** (operador): crear publishable key `sb_publishable_…`, configurar plantilla OTP `{{ .Token }}`, `wrangler secret put SUPABASE_PUBLISHABLE_KEY`, valor en `.env` local. Pasos exactos en 97-DEPLOY-RUNBOOK.md §"Estado de runtime pendiente" y 97-SPIKE-EVIDENCE.md §Reproducción SC2.
2. **Gate 1 — capturar la evidencia SC2** (una sentada): correr el bloque curl de reproducción de 97-SPIKE-EVIDENCE.md (send/verify/refresh/dos-jars). Registrar el veredicto REDACTADO.
   - Si SC2 sale **verde** → proceder con NOTIF-103 sobre el patrón middleware + cookies confirmado (login OTP real, tablas `suscripcion` con RLS, Custom SMTP/Resend, UI de perfil — todo lo diferido a 103).
   - Si SC2 saliera **rojo** (cookie no emitida / refresh no sobrevive / cache HIT / CSP bloqueó) → recién ENTONCES activar el diseño server-side-puro (Route Handlers validan el OTP, `service_role` escribe con el `auth.uid()` derivado server-side, sin depender del refresh-de-cookie-en-Workers). Ese pivote se documentaría aquí como rama B. **JAMÁS** resucitar la anon legacy ni migrar a la convención `proxy` de Next 16 como "arreglo" — ambos están vetados por CONTEXT y por la evidencia SC1.

---

## Qué se conserva vs qué se retira

- **Se conserva** (ya en master, base de NOTIF-103): `app/middleware.ts` (Edge fail-open), `app/lib/supabase-user.ts`, la convención `middleware.ts` deprecada, el patrón OTP de `app/app/spike-auth/actions.ts`.
- **Se retira/marca** al llegar a 103: `/spike-auth` es una ruta de PRUEBA no enlazada; NOTIF-103 la reemplaza por el login real y puede eliminarla o dejarla gated. No es superficie de producto.
- **NO se toca:** el plano `service_role`, la home, los guards (lockdown/anti-insinuación), la CSP LOCKED.

---

## Nota de cierre

Rama A (verde estructural). El propósito de la fase — de-riskear auth-on-Workers ANTES de construir NOTIF — se cumplió: el riesgo #1 (¿el middleware rompe el build OpenNext?) quedó resuelto en positivo empíricamente, y Camino A/CSP se preservan. El único trabajo residual es un checkpoint de provisión de operador (no de código), con pasos exactos entregados. La Phase 97 cierra sobre el patrón documented-handoff (v7/v9).
