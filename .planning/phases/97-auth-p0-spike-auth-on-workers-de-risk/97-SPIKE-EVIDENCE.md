# 97-SPIKE-EVIDENCE — auth-on-Workers: veredicto por criterio

**Capturado:** 2026-07-24
**Plan:** 97-03 (Wave 3)
**Deploy real:** https://observatorio-congreso.thevalis.workers.dev — version `3952f9bc-d817-45f9-a097-66e404983183` (fail-open, del Plan 02)
**Supabase ref:** `bctyygbmqcvizyplktuw` (sa-east-1)
**Objeto del spike (AUTH-01):** ¿el pipeline OpenNext → Cloudflare Workers sostiene una sesión Supabase Auth (primer `middleware.ts` del repo, Edge-style) end-to-end — build + Set-Cookie + refresh — sin romper Camino A ni CSP?

> **PII (T-97-11):** este documento NUNCA contiene el email del operador, el código OTP ni fragmentos de token. Los `Set-Cookie` de la evidencia futura se registran REDACTADOS (`sb-<ref>-auth-token=<REDACTED>`). Emails de prueba = SOLO direcciones del operador.

---

## Tabla de veredicto por los 4 success criteria del ROADMAP

| SC | Criterio | Veredicto | Evidencia |
|----|----------|-----------|-----------|
| **SC1** | Adding el primer `middleware.ts` NO rompe el build OpenNext; corre como Edge (NO error "Node.js middleware not supported") | **PASS (empírico)** | Build OpenNext Docker `node:22-slim`, `@opennextjs/cloudflare` 1.19.11, Next 16.2.11: warning de deprecación ESPERADO + `Bundling middleware function` + `ƒ Proxy (Middleware)` + `OpenNext build complete`. Deploy `3952f9bc` publicado. Ver 97-DEPLOY-RUNBOOK.md §VEREDICTO EMPÍRICO (log verbatim). |
| **SC2** | `verifyOtp` emite `Set-Cookie sb-*-auth-token` Y el refresh emite un NUEVO Set-Cookie tras expiry, sobreviviendo OpenNext | **PENDING-operator** | NO es un fallo del spike. El build funciona (SC1 PASS) y la ruta `/spike-auth` fail-loud-ea 500 SOLO porque `SUPABASE_PUBLISHABLE_KEY` no está provisionada (checkpoint operador diferido). El flujo OTP no está configurado, no está roto. Bloque de reproducción copy-paste abajo (§Reproducción SC2). |
| **SC3** | Camino A 200 + CSP con `frame-ancestors 'none'` + `object-src 'none'` intactos; sin cache-leak de Set-Cookie | **PASS (parcial, verificado hoy)** | curl live: `/`,`/parlamentarios`,`/agenda`,`/buscar`,`/metodologia` → 200; CSP intacta (abajo); `/` sirve `Cache-Control: private, no-cache, no-store` (anti-Pitfall #4). La parte "dos-jars sobre Set-Cookie real" queda PENDING-operator (depende del flujo OTP vivo). |
| **SC4** | Si el spike falla: fallback honesto + re-plan NOTIF-103 server-side | **NO DISPARADO** | El build NO falló (SC1 PASS). `97-FALLBACK-NOTIF-103.md` documenta rama A (verde estructural): NO se requiere rewrite server-side-puro; la única dependencia abierta es cerrar el checkpoint de provisión. |

---

## SC1 — build OpenNext + middleware Edge: PASS (empírico)

Cerrado en el Plan 02 sobre el deploy real. Señal de ÉXITO observada (log verbatim en 97-DEPLOY-RUNBOOK.md líneas 31-39):

```
Next.js version : 16.2.11
@opennextjs/cloudflare version: 1.19.11
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
ƒ Proxy (Middleware)
Bundling middleware function...
OpenNext build complete.
```

Señal de FALLO buscada y **NO** observada: `"Node.js middleware is not currently supported"` / `proxy.ts` / throw por `runtime`. → La convención deprecada `middleware.ts` es Edge-compatible con OpenNext HOY. **Open Question #1 (Version Trap) cerrada en positivo. El fallback SC4 NO se dispara.**

---

## SC3 — Camino A + CSP intactos: PASS (parcial, verificado 2026-07-24)

### Camino A (sin auth — curl -o /dev/null -w "%{http_code}")

```
GET /              -> 200 OK   (home intacta; force-dynamic)
GET /parlamentarios -> 200 OK
GET /agenda         -> 200 OK
GET /buscar         -> 200 OK
GET /metodologia    -> 200 OK
GET /spike-auth     -> 500      (ESPERADO: fail-loud aislado — falta la publishable key, ver SC2)
```

El matcher de la middleware NO rompió ninguna ruta existente. El `/spike-auth` 500 es un fallo AISLADO y CORRECTO (fail-loud del cliente user cuando falta el secret), NO una caída del sitio: el resto de Camino A queda 200. El plano `service_role` no se tocó; ninguna migración/grant; la anon legacy sigue muerta.

### CSP del deploy real (`curl -sI /` → header content-security-policy, verbatim)

```
default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none';
frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

- `frame-ancestors 'none'` — **PRESENTE (LOCKED, intacto)**
- `object-src 'none'` — **PRESENTE (LOCKED, intacto)**
- `connect-src 'self'` — **NO ampliado.** El spike hace toda la auth server-side (Route Handler/Server Action + middleware), el navegador NUNCA llama a Supabase directo → cero cambio de CSP (evita Pitfall #3). Confirmado también en el código: `app/next.config.ts` líneas 38-40.
- Otros headers del deploy: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `x-content-type-options: nosniff`.

### Anti cache-leak (Pitfall #4, T-97-10) — postura verificable hoy

`/` sirve `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (force-dynamic) — un Set-Cookie sobre estas rutas NO es cacheable por el CDN. La verificación empírica final de "dos jars nunca comparten cookie + sin cf-cache-status HIT en respuestas con Set-Cookie" requiere el flujo OTP vivo → **PENDING-operator** (§Reproducción SC2, paso dos-jars).

---

## SC2 — Set-Cookie + refresh sobre OpenNext: PENDING-operator

**Estado:** el checkpoint humano del Plan 02 (Task 1) fue DIFERIDO por el operador. En consecuencia:
- `SUPABASE_PUBLISHABLE_KEY` NO existe (ni en `.env` ni como wrangler secret).
- La plantilla OTP de Supabase Auth NO fue confirmada como `{{ .Token }}`.
- `/spike-auth` fail-loud-ea 500 → NO hay flujo OTP que evidenciar.

**Esto NO es un fallo del spike.** El build funciona (SC1 PASS) y el middleware corre como Edge; lo único que falta es estado de runtime que el agente NO puede crear (crear key en dashboard, configurar plantilla, cargar secret, leer el email del operador). El fallback SC4 es para un build ROTO o cookies-que-no-sobreviven — ninguno de los dos ocurrió.

### Reproducción SC2 — cerrar en una sola sentada tras provisión

**Precondición del operador (cierra el checkpoint diferido):**
1. Supabase Dashboard → Project Settings → API Keys → crear/copiar la **publishable key** (`sb_publishable_…`) del proyecto `bctyygbmqcvizyplktuw`. NO la anon legacy (muerta), NO la secret.
2. Supabase Dashboard → Authentication → Providers → **Email ON**. Email Templates → plantilla OTP → confirmar que renderiza `{{ .Token }}` (código numérico), NO `{{ .ConfirmationURL }}` (si manda un LINK, la plantilla quedó mal → corregir a `{{ .Token }}`).
3. Cargar el secret en el Worker (host, wrangler global OAuth):
   ```
   wrangler secret put SUPABASE_PUBLISHABLE_KEY   # pegar el valor sb_publishable_...
   wrangler secret list                            # confirmar que aparece
   ```
4. Poner el valor también en el `.env` LOCAL del operador (NO en `.env.example`).

Tras esto, `/spike-auth` debe pasar de 500 a 200 (`curl -sI .../spike-auth` → `HTTP/1.1 200`).

**Comandos de evidencia (adaptar el endpoint a la forma real de las server actions de `app/app/spike-auth/actions.ts`; emails = SOLO del operador; SMTP interno = 2/hora):**

```bash
BASE=https://observatorio-congreso.thevalis.workers.dev
OP_EMAIL='<email-del-operador>'   # NUNCA loguear/redactar en el doc

# (0) sanity: la ruta ya renderiza
curl -sI "$BASE/spike-auth" | grep -i '^HTTP'          # esperar 200

# (1) SEND — dispara el OTP al email del operador (jar A)
curl -i -c jarA.txt -X POST "$BASE/spike-auth" \
  --data-urlencode "email=$OP_EMAIL" --data-urlencode "intent=send"
#   el operador lee el CÓDIGO de 6 dígitos de SU email (si llega un LINK => plantilla mala, ver precondición #2)

# (2) VERIFY — canjea el código por sesión; DEBE traer Set-Cookie sb-<ref>-auth-token
curl -i -c jarA.txt -b jarA.txt -X POST "$BASE/spike-auth" \
  --data-urlencode "email=$OP_EMAIL" --data-urlencode "token=<CODIGO_6_DIGITOS>" --data-urlencode "intent=verify"
#   ASSERT: la respuesta trae  Set-Cookie: sb-<ref>-auth-token(.0/.1)=...; HttpOnly; Secure; SameSite=Lax; Path=/
#   (registrar en este doc como  Set-Cookie: sb-<ref>-auth-token=<REDACTED>; HttpOnly; Secure; SameSite=Lax  — SIN el valor)

# (3) REFRESH — tras expiry del access token, request con jar A (NO requiere nuevo OTP)
#     (usar un access token de vida corta en el proyecto, o esperar la expiración)
curl -i -b jarA.txt -c jarA.txt "$BASE/spike-auth"
#   ASSERT (CRITERIO CENTRAL SC2): la respuesta emite un NUEVO Set-Cookie sb-<ref>-auth-token
#   => el refresh SOBREVIVE el pipeline OpenNext → Workers.

# (4) DOS-JARS (anti cache-leak, Pitfall #4 / T-97-10) — jar B VACÍO
curl -i -c jarB.txt "$BASE/spike-auth" | grep -iE 'set-cookie|cf-cache-status'
#   ASSERT: jar B NUNCA recibe la cookie de jar A; en respuestas con Set-Cookie, cf-cache-status != HIT.

# (5) Camino A + CSP siguen intactos con el secret cargado
for p in "" parlamentarios agenda buscar metodologia; do
  curl -s -o /dev/null -w "/$p -> %{http_code}\n" "$BASE/$p"; done     # todos 200
curl -sI "$BASE/" | grep -i 'content-security-policy'                   # frame-ancestors 'none' + object-src 'none'
```

**Opcional BrowserOS:** navegar `/spike-auth` en el deploy real, confirmar en DOM/console que el estado de sesión se refleja y que NO hay `Refused to connect … CSP` (solo relevante si algún día se usara cliente de navegador — hoy es todo server-side).

**Al cerrarse el checkpoint, registrar aquí:** veredicto SC2 = "cookie+refresh OK" (con los Set-Cookie REDACTADOS) o "falló en <paso>" (cookie no emitida / refresh no sobrevive / cache HIT / CSP bloqueó). Un veredicto negativo activaría entonces la rama B de `97-FALLBACK-NOTIF-103.md`.

---

## Suite + tsc (local, del árbol actual)

- Plan 01 dejó: `pnpm --filter app test` → 1244 tests passed (incl. `env-example-guard` 16/16, `lockdown-guard` 14/14); `tsc --noEmit` exit 0; `pnpm audit` 0 vulnerabilidades.
- Plan 02 (fix fail-open) re-verificó: suite app 1244/1244 verde + typecheck exit 0.
- Plan 03 NO modifica código de app (solo artefactos de evidencia `.planning/…`), así que la suite del Plan 02 se mantiene como el estado verde vigente; ver §Deviations del 97-03-SUMMARY.md.

---

## Resumen del veredicto

- **SC1 PASS** (empírico): middleware = Edge, build OpenNext verde, deploy vivo.
- **SC3 PASS parcial** (hoy): Camino A 200 + CSP `frame-ancestors`/`object-src` intactos + `connect-src` sin ampliar + Cache-Control anti-leak.
- **SC2 PENDING-operator**: bloqueado SOLO por el checkpoint de provisión diferido; NO por el spike. Bloque de reproducción listo para cerrarlo en una sentada.
- **SC4 NO disparado**: el build funciona → sin fallback. Ver `97-FALLBACK-NOTIF-103.md`.

La Phase 97 cierra sobre el patrón documented-handoff (v7/v9): el riesgo estructural de auth-on-Workers quedó DE-RISKEADO (build + Edge + Camino A + CSP confirmados); la evidencia end-to-end de sesión es el único ítem que espera al operador, con pasos exactos para cerrarlo.
