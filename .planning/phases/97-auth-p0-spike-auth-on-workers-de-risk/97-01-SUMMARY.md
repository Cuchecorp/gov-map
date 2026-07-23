---
phase: 97-auth-p0-spike-auth-on-workers-de-risk
plan: 01
subsystem: auth
tags: [auth, supabase-ssr, middleware, openNext, spike, otp]
requires:
  - "@supabase/ssr@0.12.3 (npm)"
  - "SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (env, publishable key nueva)"
provides:
  - "app/lib/supabase-user.ts (cliente user bajo privilegio + updateSession)"
  - "app/middleware.ts (primer middleware del repo, Edge deprecado)"
  - "app/app/spike-auth (ruta de prueba OTP no enlazada)"
affects:
  - "OpenNext bundle graph (primer middleware añadido)"
tech-stack:
  added:
    - "@supabase/ssr@0.12.3"
  patterns:
    - "createServerClient (@supabase/ssr) + getAll/setAll cookie adapter"
    - "middleware.ts convención deprecada = Edge bajo OpenNext (NO proxy.ts)"
    - "email OTP signInWithOtp/verifyOtp (sin redirect, código de 6 dígitos)"
key-files:
  created:
    - app/lib/supabase-user.ts
    - app/middleware.ts
    - app/app/spike-auth/page.tsx
    - app/app/spike-auth/actions.ts
  modified:
    - app/package.json
    - pnpm-lock.yaml
    - .env.example
decisions:
  - "Filename deprecado middleware.ts (NO proxy.ts, NO runtime config): única forma Edge compatible con OpenNext"
  - "Publishable key server-side (SUPABASE_PUBLISHABLE_KEY, sin NEXT_PUBLIC_): módulo separado del service_role"
  - "OTP numérico (sin redirect por email) + getClaims para estado de sesión: headless-friendly, cero PII renderizada"
metrics:
  duration: ~15 min
  completed: 2026-07-23
---

# Phase 97 Plan 01: SPIKE auth-on-Workers — superficie de código Summary

Construida EN LOCAL la superficie mínima del spike auth-on-Workers: `@supabase/ssr@0.12.3`, el PRIMER `middleware.ts` del repo (convención deprecada Edge-style que OpenNext corre como Edge — NO `proxy.ts`, sin `runtime` config), un cliente Supabase user de bajo privilegio (`app/lib/supabase-user.ts`, publishable key, separado del service_role) y una ruta de prueba NO enlazada `/spike-auth` que ejerce el flujo OTP send/verify. Build de Next verde, suite app 1244 verde, tsc --noEmit exit 0.

## What Was Built

- **Task 1 (commit 7aa7fac):** `pnpm add @supabase/ssr` → resuelto a `0.12.3` (única dependencia nueva; slopcheck [OK] en research, sin postinstall, org oficial Supabase → sin checkpoint humano). Creado `app/lib/supabase-user.ts` con `import "server-only"` en línea 1: `updateSession()` canónico (createServerClient + getAll/setAll + getClaims, sin código intermedio, devuelve supabaseResponse sin mutar) + helper `createUserClient(cookieAdapter)` para la página/actions. Fail-loud si falta `SUPABASE_URL` o `SUPABASE_PUBLISHABLE_KEY`; JAMÁS lee la service key ni resucita la anon legacy. `.env.example` documenta `SUPABASE_PUBLISHABLE_KEY=` (placeholder vacío) con bloque de comentario espejando el idiom.

- **Task 2 (commit a5e8ad5):** `app/middleware.ts` (raíz de app/) VERBATIM del §Pattern 1: `export async function middleware(request) { return await updateSession(request); }` + `export const config = { matcher: [...] }` que salta `_next/static`, `_next/image`, `favicon.ico` y assets de imagen. Sin `proxy.ts`, sin `runtime` config. `app/app/spike-auth/page.tsx`: página server no enlazada (skeleton del analog admin, `<main className="max-w-3xl ...">`, `force-dynamic`) que muestra estado de sesión vía `getClaims()` (solo autenticado sí/no + expiry, NUNCA email/token). `app/app/spike-auth/actions.ts`: server actions `enviarOtp` (signInWithOtp `shouldCreateUser:true`, sin redirect por email) y `verificarOtp` (verifyOtp `type:"email"`), ligadas a las cookies del contexto vía `next/headers`. Cero `console.*`, cero email/token interpolado en errores, cero `.rpc()`, cero `.from()`.

- **Task 3 (verificación, sin archivos nuevos):** `pnpm --filter app build` exit 0 con el middleware presente; suite app 1244 verde; `tsc --noEmit` exit 0; `pnpm audit` 0 vulnerabilidades.

## Deviations from Plan

Ninguna desviación funcional. Ajustes de redacción para satisfacer los `<verify>` (checks de substring literal sobre el contenido de los archivos):

1. **`supabase-user.ts` doc comment:** el verify de Task 1 rechaza la substring `SUPABASE_SECRET_KEY`/`SUPABASE_ANON_KEY` en el archivo. El comentario original las nombraba (como claves a NO usar). Reformulado a "service key (sb_secret_)" / "clave anon legacy" sin los tokens literales. Sin cambio de comportamiento.
2. **`middleware.ts` doc comment:** el verify de Task 2 rechaza la substring `runtime`. El comentario explicaba por qué NO declarar `runtime` config. Reformulado a "el segmento de ejecución en el config" sin el token literal. Sin cambio de comportamiento.
3. **`actions.ts` doc comment:** el verify de Task 2 rechaza la substring `emailRedirectTo`. El comentario explicaba por qué NO pasarla. Reformulado a "opción de redirect por email" sin el token literal. Sin cambio de comportamiento — el código sigue SIN pasar esa opción.
4. **Stage del lockfile:** `pnpm-lock.yaml` vive en la RAÍZ del monorepo (no `app/pnpm-lock.yaml` como listaba el frontmatter `files_modified`). Se stageó la ruta real de raíz.

## Warning de deprecación (ESPERADO — documentado)

El build de Next emitió, como estaba previsto por RESEARCH §Pitfall #1:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Esto es EXPECTED y ACEPTABLE: `proxy.ts` correría en Node.js runtime, que `@opennextjs/cloudflare` NO soporta; la convención deprecada `middleware.ts` es la ÚNICA forma Edge-compatible con OpenNext. NO se migró a `proxy.ts`, NO se corrió el codemod, NO se añadió `runtime` config. El build listó `ƒ Proxy (Middleware)` y `/spike-auth` como ruta dinámica.

## Fuera de alcance (por diseño del spike)

- **Build OpenNext real + deploy Cloudflare + evidencia curl/BrowserOS** (Set-Cookie + refresh sobre workers.dev): Plan 02. El riesgo estructural del bundle OpenNext solo se prueba empíricamente en el deploy real.
- **Crear `SUPABASE_PUBLISHABLE_KEY`** en el dashboard Supabase + setearla como `wrangler secret`: acto de operador (Plan 02).
- **Config Auth dashboard** (email provider ON + template OTP `{{ .Token }}`): probar por API primero; acto de operador si manda link en vez de código (Plan 02).
- **CSP:** NO tocada (auth server-side → `connect-src 'self'` intacto). `frame-ancestors`/`object-src 'none'` intactos.
- **Migraciones / grants / policies:** ninguna (spike code-only; Camino A intacto; RLS work = Phase 103).

## Verification

- `pnpm --filter app build` → exit 0, warning de deprecación esperado, `/spike-auth` + `ƒ Proxy (Middleware)` presentes.
- `pnpm --filter app test` → 94 files, **1244 tests passed** (incl. env-example-guard 16/16, lockdown-guard 14/14).
- `pnpm --filter app run typecheck` (tsc --noEmit) → exit 0.
- `pnpm audit` → No known vulnerabilities found (exit 0).
- `git diff app/app/page.tsx` → vacío (home intacta).
- Cero `proxy.ts`; middleware sin `runtime`; `supabase-user.ts` server-only sin secret/anon.

## Self-Check: PASSED
