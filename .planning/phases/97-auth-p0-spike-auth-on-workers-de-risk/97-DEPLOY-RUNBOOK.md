# 97-DEPLOY-RUNBOOK — SPIKE auth-on-Workers: build OpenNext real + deploy

**Ejecutado:** 2026-07-23
**Plan:** 97-02 (Wave 2)
**Deploy version id (FINAL, fail-open):** `3952f9bc-d817-45f9-a097-66e404983183`
**Deploy version id (inicial, PRE-fix):** `694441b7-8df4-4bd5-ab01-b4c30fa25680` (superado — ver §Regresión)
**URL:** https://observatorio-congreso.thevalis.workers.dev
**Supabase ref:** `bctyygbmqcvizyplktuw` (sa-east-1)

> Runbook REPRODUCIBLE del build OpenNext en Docker + deploy wrangler global.
> NO seguir `docs/deploy-cloudflare.md` (STALE, era anon-key). Fuente del runbook:
> 97-PATTERNS.md §Deploy runbook + CLAUDE.md Conventions + MEMORY v6.0/61-02.

---

## VEREDICTO EMPÍRICO (SC1 — la pregunta #1 del spike)

**El primer `middleware.ts` del repo SOBREVIVE el build OpenNext y corre como Edge.**

Estado: **PASS.** El build OpenNext (Docker `node:22-slim`, `@opennextjs/cloudflare` 1.19.11,
Next.js 16.2.11) emitió el **warning de deprecación ESPERADO** — NO el error fatal
`"Node.js middleware is not currently supported"`. La middleware se bundleó como función
Edge y el Worker se publicó (home 200, Camino A intacto).

Esto CIERRA la Open Question #1 (Pitfall #1, la "Version Trap" Next 16 middleware→proxy):
la convención deprecada `middleware.ts` es Edge-compatible con OpenNext HOY, sin migrar a
`proxy.ts`, sin codemod, sin `runtime` config. **NO se dispara el fallback SC4 (Plan 03).**

### Fragmento del OpenNext build log (verbatim, líneas relevantes)

```
9:  Next.js version : 16.2.11
10: @opennextjs/cloudflare version: 1.19.11
26: ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
    Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
64: ƒ Proxy (Middleware)                          <- la middleware aparece en la route table
74: Bundling middleware function...                <- OpenNext la bundlea como Edge
84: OpenNext build complete.                       <- BUILD EXIT: 0
```

- Señal de ÉXITO observada: warning de deprecación + `Bundling middleware function...` +
  `ƒ Proxy (Middleware)` + `OpenNext build complete` + `worker.js` (2278 bytes) emitido.
- Señal de FALLO buscada y NO observada: `"Node.js middleware is not currently supported"`
  / `"switch to Edge Middleware"` / aparición de `proxy.ts` / throw por `runtime`.

Log completo del build residente en `C:/Temp/obs-build/opennext-build.log` durante la corrida.

---

## Runbook reproducible (comandos exactos ejecutados)

### 0. Precondición
- Docker Desktop corriendo (`docker ps` OK). Docker 29.5.2.
- wrangler GLOBAL autenticado por OAuth: `wrangler whoami` → `sanchez.rossi@gmail.com`,
  scope `workers (write)`. Config en `C:\Users\Carlo\AppData\Roaming\xdg.config\.wrangler`.
  NOTA: en este equipo hay un paquete Python `wrangler` que sombrea el PATH; el wrangler REAL
  es el npm global en `C:\Users\Carlo\AppData\Roaming\npm\wrangler.cmd` (v4.109.0). Se invocó
  por ruta absoluta / dentro del contenedor.

### 1. Limpiar residuo y espejar el repo a un path sin locks (PowerShell, NO git-bash)
```powershell
# Borrar residuo benigno del build anterior si existe (C:/Temp/obs-build/node_modules).
Remove-Item -Recurse -Force 'C:/Temp/obs-build/node_modules'   # si estaba locked, tras reboot

# robocopy /MIR excluyendo node_modules, .open-next, .next, .git (evita locks OneDrive/Windows).
robocopy 'C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio' 'C:\Temp\obs-build' `
  /MIR /XD node_modules .open-next .next .git .turbo dist coverage /XF *.log /NFL /NDL /NP /R:1 /W:1
# exit code < 8 = éxito (3 = archivos copiados + extras).
```

### 2. Build OpenNext DENTRO de Docker `node:22-slim` (NUNCA Windows/alpine — symlink EPERM)
Script montado `C:\Temp\obs-build\docker-build.sh`:
```bash
corepack enable && corepack prepare pnpm@11 --activate
pnpm config set dangerouslyAllowAllBuilds true     # pnpm 11 bloquea postinstall por defecto
cd /work && pnpm install --frozen-lockfile
cd /work/app && pnpm run cf-build 2>&1 | tee /work/opennext-build.log   # = opennextjs-cloudflare build
```
Invocación (PowerShell — MSYS_NO_PATHCONV no necesario fuera de git-bash):
```powershell
docker run --rm -v "C:\Temp\obs-build:/work" -w /work node:22-slim `
  bash -lc "chmod +x /work/docker-build.sh && /work/docker-build.sh"
# => BUILD EXIT: 0 ; worker.js emitido en /work/app/.open-next/worker.js
```

### 3. Deploy: build+deploy OpenNext dentro del contenedor, montando el OAuth token del host
El wrapper `wrangler deploy` del host detecta el proyecto OpenNext y delega a
`opennextjs-cloudflare deploy`, que NO está en el PATH del host (es devDependency). Solución:
correr `pnpm run deploy` dentro del MISMO contenedor `node:22-slim`, montando el config OAuth
de wrangler del host para que el deploy sea no-interactivo.

Script `C:\Temp\obs-build\docker-deploy.sh`:
```bash
corepack enable && corepack prepare pnpm@11 --activate
pnpm config set dangerouslyAllowAllBuilds true
export XDG_CONFIG_HOME=/root/.config
export WRANGLER_HOME=/root/.config/.wrangler
cd /work/app && CI=true pnpm run deploy 2>&1 | tee /work/deploy.log   # build && opennextjs-cloudflare deploy
```
Invocación:
```powershell
docker run --rm `
  -v "C:\Temp\obs-build:/work" `
  -v "C:\Users\Carlo\AppData\Roaming\xdg.config\.wrangler:/root/.config/.wrangler" `
  -w /work node:22-slim `
  bash -lc "chmod +x /work/docker-deploy.sh && /work/docker-deploy.sh"
```

Salida del deploy (verbatim, líneas clave):
```
OpenNext build complete.
🌀 Found 4 new or modified static assets to upload. Proceeding with upload...
✨ Success! Uploaded 4 files (52 already uploaded)
Uploaded observatorio-congreso (9.39 sec)
Deployed observatorio-congreso triggers (0.98 sec)
  https://observatorio-congreso.thevalis.workers.dev
Current Version ID: 694441b7-8df4-4bd5-ab01-b4c30fa25680
```
Bindings del Worker: `WORKER_SELF_REFERENCE` (self), `ASSETS`. Startup 24 ms.

### 4. Verificación post-deploy (curl sobre el deploy real — FINAL, fail-open)
```
curl -sI .../                -> HTTP/1.1 200 OK   (Camino A intacto)
curl -sI .../parlamentarios  -> HTTP/1.1 200 OK
curl -sI .../agenda          -> HTTP/1.1 200 OK
curl -sI .../buscar          -> HTTP/1.1 200 OK
curl -sI .../metodologia     -> HTTP/1.1 200 OK
curl -sI .../spike-auth      -> HTTP/1.1 500      (ESPERADO: falta el secret — ver §Estado runtime)
```
CSP en el response de `/` (ENFORCED, sin cambios — auth es server-side):
```
connect-src 'self'           (NO ampliado — no hay cliente browser Supabase)
object-src 'none'            (LOCKED, intacto)
frame-ancestors 'none'       (LOCKED, intacto)
```

---

## REGRESIÓN detectada y CORREGIDA (deviation Rule 1 — bug)

El deploy INICIAL (`694441b7…`) con la middleware VERBATIM del Plan 01 tumbó Camino A:
tras propagar al edge, `curl -I /` y `/parlamentarios` daban **HTTP 500** consistente.

**Causa raíz:** el matcher de la middleware cubre TODAS las rutas de la app. Con
`SUPABASE_PUBLISHABLE_KEY` ausente (el secret es Task 1, aún no cargado), `updateSession()`
→ `leerEnv()` hace `throw` en CADA request; un throw en la middleware Edge hard-500ea el
response del sitio ENTERO. Esto viola la restricción LOCKED "Camino A intacto" (T-97-08).

**Fix (`app/middleware.ts`, este plan):** hacer la middleware FAIL-OPEN. Si falta la
publishable key o la URL, retorna `NextResponse.next({ request })` (pasa el request sin tocar,
sin refresh de sesión) en vez de throw. Cuando el operador cargue el secret (Task 1), el guard
deja de aplicar y `updateSession()` corre normal (refresh + Set-Cookie). El cliente user de la
ruta de auth (`supabase-user.ts` / `/spike-auth`) SIGUE siendo fail-loud — allí la key SÍ debe
existir; por eso `/spike-auth` da 500 (correcto/aislado) mientras el resto del sitio queda 200.

**Redeploy** (`3952f9bc…`): tras propagar, `/`, `/parlamentarios`, `/agenda`, `/buscar`,
`/metodologia` → 200 estable. La middleware sigue corriendo en cada request matcheado (Edge),
pero ya no puede tumbar Camino A cuando el spike no está configurado.

NOTA de propagación: Cloudflare tarda ~10-30 s en propagar la versión nueva a todo el edge;
durante ese lapso se observaron 500 intermitentes (versión vieja crashing vs nueva fail-open).
Estabiliza a 200 tras la propagación.

---

## Estado de runtime pendiente (Task 1 = OPERADOR, blocking-human)

El build/deploy están verdes y el middleware corre en el edge. Lo ÚNICO que falta para que
`/spike-auth` renderice (y para la evidencia OTP/refresh del Plan 03) es el estado de runtime
que Claude NO puede crear:

1. **`SUPABASE_PUBLISHABLE_KEY` NO está en `.env` ni como wrangler secret.** Confirmado:
   `.env` tiene `SUPABASE_URL` y `SUPABASE_SECRET_KEY` pero NO `SUPABASE_PUBLISHABLE_KEY`.
   - `/spike-auth` da **500** porque su Server Component llama `createUserClient()` →
     `leerEnv()` hace fail-loud throw (falta la publishable key) → el render lanza. Es el
     comportamiento CORRECTO/esperado y AISLADO a esa ruta (fail-loud), NO un bug del sitio.
   - La middleware (matcher cubre TODAS las rutas) es FAIL-OPEN por el fix de este plan: con
     la key ausente PASA el request sin tocar → `/`, `/parlamentarios`, etc. siguen 200. La
     middleware EXISTE y corre en cada request matcheado (Edge); su ausencia-de-config NO
     tumba Camino A. Cuando el secret esté cargado, correrá `updateSession()` (refresh real).

2. **Config Supabase Auth (provider Email + plantilla OTP `{{ .Token }}`):** NO verificable por
   API sin la publishable key. Probe hecho: `GET {SUPABASE_URL}/auth/v1/settings` sin apikey →
   `401`. Requiere la key primero (Task 1) para poder probar por curl.

### Pasos EXACTOS del operador (cierra Task 1)
1. Supabase Dashboard → Project Settings → API Keys → crear/copiar la **publishable key**
   (`sb_publishable_…`) del proyecto `bctyygbmqcvizyplktuw`. NO es la anon legacy (muerta) ni
   la secret.
2. Supabase Dashboard → Authentication → Providers → confirmar **Email ON**. Email Templates →
   plantilla Magic Link/OTP → confirmar que renderiza `{{ .Token }}` (código numérico), NO
   `{{ .ConfirmationURL }}` (si manda link, cambiar la plantilla).
3. Cargar el secret en el Worker (host, wrangler global OAuth):
   ```
   wrangler secret put SUPABASE_PUBLISHABLE_KEY   # pegar el valor sb_publishable_...
   wrangler secret list                            # confirmar que aparece
   ```
4. Poner el valor también en el `.env` LOCAL del operador (NO en `.env.example`, que queda
   vacío) para pruebas curl locales.
   Emails de prueba = SOLO direcciones del operador. Rate limit SMTP interno = 2/hora.

Tras cargar el secret + redeploy (o el secret aplica al Worker vivo sin rebuild): `/spike-auth`
renderiza y el Plan 03 puede capturar Set-Cookie + refresh (curl dos-jarras + BrowserOS).

---

## Residuo benigno
`C:/Temp/obs-build/node_modules` (lock del contenedor Linux, sin secrets). Borrar tras reboot
si Windows lo mantiene locked. No contiene credenciales.

## Notas de seguridad (threat register 97-02)
- T-97-06 (DoS build): mitigado — log leído, veredicto Edge OK, no se shippeó auth rota.
- T-97-07 (EoP secret): el secret a cargar es la publishable (bajo privilegio), NUNCA la
  service ni la anon; vive en el Worker, no en `wrangler.jsonc` ni en git.
- T-97-08 (ID Camino A): `curl -I /` 200 confirma home intacta; deploy no toca el plano
  service_role; cero migración/grant.
- T-97-09 (PII OTP): sin emails procesados por el agente; plantilla `{{ .Token }}` numérica.
