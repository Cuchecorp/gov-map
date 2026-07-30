---
phase: 125-e2e-pasada-final-producto-a-producto
plan: 01
fecha: 2026-07-29
worker: observatorio-congreso
url: https://observatorio-congreso.thevalis.workers.dev
supabase_ref: bctyygbmqcvizyplktuw
---

# 125-DEPLOY-RUNBOOK — Deploy agrupado v12.0 (fixes de 114 + 117 + 122)

Runbook **verbatim** de la corrida. Este archivo es la **precondición bloqueante** de los planes
125-02 … 125-07: sin el id de versión de §2, esas waves medirían el sitio viejo.

El bundle agrupa **solo commits ya en HEAD** de las fases 114 (links internos), 117 (fechas) y
122 (lobby capa-1 + cobertura). **Nada nuevo entra** (decisión LOCKED de `125-CONTEXT.md`).

---

## §1 Gate pre-deploy

Ejecutado desde la raíz del repo con `set -o pipefail`, **antes** de construir el bundle.

**HEAD al momento del gate:** `b4882e9` — `docs(125): apply plan-checker B4 — precondicion de frescura en wave 2`

| # | check | comando | exit | resultado observado |
|---|-------|---------|:----:|---------------------|
| 1 | typecheck app | `pnpm --filter ./app exec tsc --noEmit` | **0** | sin diagnósticos |
| 2 | typecheck workspace | `pnpm -r exec tsc -b` | **0** | sin diagnósticos |
| 3 | suite `app/` | `pnpm --filter ./app exec vitest run` | **0** | **1590 passed / 1590** en **107** archivos · duración 46,13 s |
| 4 | suite root (packages + app) | `pnpm test` | **0** | ver §1.3 (desglose por paquete) |
| 5 | guards de régimen `app/lib` | `pnpm --filter ./app exec vitest run lib/*guard*.test.ts lib/*gate*.test.ts` | **0** | **166 passed** en **12** archivos |
| 6 | guards de régimen `packages/llm` | `pnpm --filter ./packages/llm exec vitest run src/integ-scope-guard.test.ts src/provider-guard.test.ts` | **0** | **6 passed** en **2** archivos |

### §1.1 Conteo de la suite `app/` — 1590, con el commit que explica el salto

| medición | valor | procedencia |
|---|---:|---|
| cierre de **117** (`117-DISPOSICION.md` §3) | 1543 | línea base de la fase de fechas |
| verificación de **122** (`122-VERIFICATION.md`, spot-check del verificador) | 1577 | la cifra citada en `125-CONTEXT.md` §Established Patterns |
| **este gate (125-01)** | **1590** | 123 y 124 añadieron tests después de 122 |

El criterio del plan (**≥ 1590**) se cumple **exactamente**. `1577` no era un techo sino la línea
base previa a 123/124: el delta `1577 → 1590` (**+13**) corresponde a los tests que aterrizaron con
las fases 123 (auditoría de estructura Supabase) y 124 (migraciones aditivas a PROD), commits
`338ffa4` y anteriores del árbol de 124. **Cero ajuste del criterio a la baja.**

### §1.2 Los 14 guards de régimen, uno por uno

Nombrados individualmente, con su conteo. Ninguno se declara "verde" sin número.

| # | guard | archivo | tests | estado |
|---|-------|---------|------:|:------:|
| 1 | anti-insinuación | `app/lib/anti-insinuacion-guard.test.ts` | 42 | ✓ |
| 2 | money-antiflip | `app/lib/money-antiflip-guard.test.ts` | 20 | ✓ |
| 3 | lockdown | `app/lib/lockdown-guard.test.ts` | 35 | ✓ |
| 4 | bento-coherencia | `app/lib/bento-coherencia-guard.test.ts` | 8 | ✓ |
| 5 | name-match-rut | `app/lib/name-match-rut-guard.test.ts` | 15 | ✓ |
| 6 | env-example | `app/lib/env-example-guard.test.ts` | 16 | ✓ |
| 7 | integ-scope | `packages/llm/src/integ-scope-guard.test.ts` | 3 | ✓ |
| 8 | provider-guard | `packages/llm/src/provider-guard.test.ts` | 3 | ✓ |
| 9 | cruces-gate | `app/lib/cruces-gate.test.ts` | 5 | ✓ |
| 10 | vsim-gate | `app/lib/vsim-gate.test.ts` | 5 | ✓ |
| 11 | net-gate | `app/lib/net-gate.test.ts` | 5 | ✓ |
| 12 | busqueda-hibrida-gate | `app/lib/busqueda-hibrida-gate.test.ts` | 5 | ✓ |
| 13 | admin-gate | `app/lib/admin-gate.test.ts` | 5 | ✓ |
| 14 | money-gate | `app/lib/money-gate.test.ts` | 5 | ✓ |

**Total: 172 tests de régimen, 14/14 verdes.** Nota de alcance: los guards 7 y 8 **no** viven en
`app/lib` (el glob del plan no los alcanza) sino en `packages/llm/src`; se corrieron por separado
(check 6 de §1) y quedan cubiertos además por el `pnpm test` de raíz. Se registra la divergencia de
ruta para que no se lea como guard faltante.

### §1.3 Higiene de alcance del bundle — nada nuevo entra

| check | comando | resultado |
|---|---|---|
| código sin cambios respecto a HEAD | `git diff --name-only HEAD -- app/ packages/ supabase/` | **salida vacía** ✓ |
| no-commiteados | `git status --porcelain` | 5 entradas, **todas admisibles** (ver tabla) |
| ningún commit reciente toca un flag | `git log --oneline -30 --name-only \| grep -iE "\.env\|wrangler\.jsonc\|gate"` | **salida vacía** ✓ |

Entradas no-commiteadas y su disposición:

| archivo | disposición |
|---|---|
| `.planning/phases/119-cron-fix-robustez-de-ingesta/119-REVIEW.md` | artefacto `.planning/` — admisible |
| `.planning/phases/122-…/122-VERIFICATION.md` | artefacto `.planning/` — admisible |
| `.planning/phases/123-…/123-VERIFICATION.md` | artefacto `.planning/` — admisible |
| `.planning/phases/124-…/124-VERIFICATION.md` | artefacto `.planning/` — admisible |
| `pnpm-workspace.yaml` | admisible por el plan, pero **no viaja al bundle** — ver §1.4 |

**Cero archivos bajo `app/`, `packages/` o `supabase/` modificados** ⇒ el bundle es exactamente HEAD.

### §1.4 Desviación RULE-3 — `pnpm-workspace.yaml` sucio con placeholders de pnpm

**Encontrado:** el working tree tenía `pnpm-workspace.yaml` modificado con valores placeholder que
pnpm 11 escribe cuando no puede resolver `allowBuilds` de forma no-interactiva:

```diff
 allowBuilds:
+  '@google/genai': set this to true or false
+  esbuild: set this to true or false
   protobufjs: true
+  unrs-resolver: set this to true or false
+  workerd: set this to true or false
```

**Por qué bloquea:** `robocopy /MIR` espeja el **working tree**, no HEAD. Ese archivo habría viajado
al mirror y `pnpm install --frozen-lockfile` dentro del contenedor habría leído
`set this to true or false` como valor de `allowBuilds` — string inválido donde se espera booleano.
Además contradice la restricción rectora del plan: el bundle debe ser HEAD.

**Fix (no destructivo):** **no** se revirtió el archivo del repo del operador. Se restauró la versión
de HEAD **solo dentro del mirror**, tras el espejo:

```bash
git show HEAD:pnpm-workspace.yaml > C:/Temp/obs-build/pnpm-workspace.yaml
```

Así el contenedor construye el par consistente `pnpm-workspace.yaml`↔`pnpm-lock.yaml` de HEAD, y el
working tree del operador queda intacto. Registrado como desviación RULE-3 (issue bloqueante).

**Cero DDL/DML. `SUPABASE_DB_URL` jamás expandida ni ecoada. Cero `secret put`.**

---

## §2 Build OpenNext en Docker + deploy

# VERSIÓN DESPLEGADA: `0ea5d97f-a172-436e-aad0-add95940ee0e`

**Desplegado:** 2026-07-29T21:26Z (UTC) · **Worker:** `observatorio-congreso`
**URL:** https://observatorio-congreso.thevalis.workers.dev
**Commit del bundle:** `b4882e9` (HEAD, sin modificaciones bajo `app/` ni `packages/`)

> Éste es el uuid que los planes **125-02 … 125-07** deben leer como precondición.

### §2.0 Precondición — Docker no estaba corriendo (desviación RULE-3)

`docker ps` falló al primer intento:

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine;
check if the path is correct and if the daemon is running
```

Docker Desktop se lanzó (`Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'`) y el
daemon quedó disponible: `docker info --format {{.ServerVersion}}` → **29.5.2**. No se cambió ninguna
configuración de Docker. Registrado como desviación RULE-3 (issue bloqueante de entorno).

### §2.1 Secuencia ejecutada

**1. Espejo** (PowerShell, NO git-bash):

```powershell
robocopy 'C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio' 'C:\Temp\obs-build' `
  /MIR /XD node_modules .open-next .next .git .turbo dist coverage /XF *.log /NFL /NDL /NP /R:1 /W:1
```
⇒ `ROBOCOPY_EXIT: 3` (< 8 = éxito: archivos copiados + extras eliminados).

**2. Purga de `.pnpm-store` del mirror** — estaba PRESENTE y se borró:
`Remove-Item -Recurse -Force 'C:\Temp\obs-build\.pnpm-store'` ⇒ re-test `Test-Path` → `False`.

**3. Restauración de `pnpm-workspace.yaml` de HEAD en el mirror** (fix §1.4):
`git show HEAD:pnpm-workspace.yaml > C:/Temp/obs-build/pnpm-workspace.yaml` ⇒ el tail del mirror
vuelve a ser `allowBuilds:` / `protobufjs: true`, sin placeholders.

**4. Re-escritura de los helper scripts TRAS el espejo** (`/MIR` los borra — no están en el repo):

`C:\Temp\obs-build\docker-build.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
corepack enable && corepack prepare pnpm@11 --activate
pnpm config set dangerouslyAllowAllBuilds true
cd /work && pnpm install --frozen-lockfile
cd /work/app && pnpm run cf-build 2>&1 | tee /work/opennext-build.log
echo "BUILD EXIT: 0"
ls -la /work/app/.open-next/worker.js
```

`C:\Temp\obs-build\docker-deploy.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
corepack enable && corepack prepare pnpm@11 --activate
pnpm config set dangerouslyAllowAllBuilds true
export XDG_CONFIG_HOME=/root/.config
export WRANGLER_HOME=/root/.config/.wrangler
cd /work/app && CI=true pnpm run deploy 2>&1 | tee /work/deploy.log
echo "DEPLOY EXIT: 0"
```

**5. Build** (`MSYS_NO_PATHCONV=1`, `node:22-slim`, nunca Windows ni alpine):

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "C:\Temp\obs-build:/work" -w /work node:22-slim \
  bash -lc "chmod +x /work/docker-build.sh && /work/docker-build.sh"
```

Salida (verbatim, líneas clave):
```
ƒ Proxy (Middleware)
Bundling middleware function...
Bundling static assets...
Bundling cache assets...
Building server function: default...
Applying code patches: 3.839s
Worker saved in `.open-next/worker.js` 🚀
OpenNext build complete.
BUILD EXIT: 0
-rw-r--r-- 1 root root 2278 Jul 29 21:22 /work/app/.open-next/worker.js
```
⇒ **`BUILD EXIT: 0`** y **`worker.js` emitido** (2278 bytes) en `/work/app/.open-next/worker.js`. ✓

**6. Deploy** (mismo contenedor, OAuth del host montado en `/root/.config/.wrangler`):

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "C:\Temp\obs-build:/work" \
  -v "C:\Users\Carlo\AppData\Roaming\xdg.config\.wrangler:/root/.config/.wrangler" \
  -w /work node:22-slim \
  bash -lc "chmod +x /work/docker-deploy.sh && /work/docker-deploy.sh"
```

Salida (verbatim, líneas clave):
```
⛅️ wrangler 4.102.0
✨ Read 62 files from the assets directory /work/app/.open-next/assets
🌀 Found 7 new or modified static assets to upload. Proceeding with upload...
✨ Success! Uploaded 7 files (49 already uploaded) (1.02 sec)
Total Upload: 8256.87 KiB / gzip: 1762.02 KiB
Worker Startup Time: 25 ms
Uploaded observatorio-congreso (7.81 sec)
Deployed observatorio-congreso triggers (0.90 sec)
  https://observatorio-congreso.thevalis.workers.dev
Current Version ID: 0ea5d97f-a172-436e-aad0-add95940ee0e
DEPLOY EXIT: 0
```

Bindings del Worker: `WORKER_SELF_REFERENCE` (self), `ASSETS`. Startup 25 ms.

### §2.2 Los 3 gotchas — disposición

| gotcha | estado en esta corrida |
|---|---|
| `.pnpm-store` viaja al mirror y revienta el build | **RE-CONFIRMADO**: estaba presente en `C:\Temp\obs-build` y se purgó antes de construir |
| `/MIR` borra los helper scripts (no están en el repo) | **RE-CONFIRMADO**: ambos scripts hubo que re-escribirlos tras el espejo |
| `wrangler` del host sombreado por paquete Python | **EVADIDO por diseño**: no se invocó el wrangler del host; build **y** deploy corrieron dentro del contenedor con `pnpm run deploy` (el wrangler usado es el del workspace, v4.102.0). `opennextjs-cloudflare` tampoco está en el PATH del host, así que ésta es la única ruta viable |

Gotcha adicional pagado aquí: **Docker Desktop estaba apagado** (§2.0) y **`pnpm-workspace.yaml` sucio**
con placeholders de pnpm 11 (§1.4).

### §2.3 Flags — cero flips

`wrangler secret list` (lectura, **sólo nombres**; ningún valor se imprimió ni se conoce):

| secret / flag | estado |
|---|---|
| `CRUCES_PUBLIC_ENABLED` | presente (ON, desde v4.0) |
| `NET_PUBLIC_ENABLED` | presente (ON, desde v5.0) |
| `VSIM_PUBLIC_ENABLED` | presente (ON, desde v10.0) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` | presentes (runtime, no son flags) |
| `MONEY_PUBLIC_ENABLED` | **AUSENTE = OFF** ✓ |
| `NOTIF_PUBLIC_ENABLED` | **AUSENTE = OFF** ✓ |

**Cero `wrangler secret put` en toda la corrida.** MONEY y NOTIF siguen OFF, como exige el CONTEXT.
Nota: `SUPABASE_PUBLISHABLE_KEY` sigue ausente (deuda de operador viva desde 97/103), sin efecto en
Camino A.

---

## §3 Smoke post-deploy

Propagación: se esperaron **30 s** antes del primer `curl`. **No se observó ningún 500 intermitente**
en esta corrida — la ventana de propagación pasó limpia, así que no hubo que re-comprobar nada.
Requests **secuenciales, 1 s entre cada uno**, con User-Agent identificatorio.

### §3.1 Códigos HTTP — 10/10 en 200

| # | ruta | código |
|---|---|---:|
| 1 | `/` | **200** |
| 2 | `/parlamentarios` | **200** |
| 3 | `/agenda` | **200** |
| 4 | `/buscar` | **200** |
| 5 | `/metodologia` | **200** |
| 6 | `/sobre` | **200** |
| 7 | `/comparar` | **200** |
| 8 | `/red` | **200** |
| 9 | `/parlamentario/D1165` | **200** |
| 10 | `/proyecto/14309-04` | **200** |

### §3.2 Prueba de que el bundle es el NUEVO — antes/después medido

**Nota de método (gotcha):** `grep -c` cuenta **líneas**, y el HTML del Worker es **una sola línea**
(1.242.030 bytes, `wc -l` = 1) ⇒ `grep -c` devuelve como máximo 1 y es inservible para contar
ocurrencias. Todas las cifras de abajo usan **`grep -o … | wc -l`**. El DOM PRE-deploy se capturó
**antes** de desplegar, de modo que el antes/después es medido, no recordado.

| fase | marcador | PRE-deploy | POST-deploy | veredicto |
|---|---|---:|---:|:---:|
| **117** | `según fuente al ` en `/proyecto/14309-04` | **0** | **32** | ✓ llegó |
| **117** | `Actualizado` (idiom viejo) en `/proyecto/14309-04` | **318** | **0** | ✓ desapareció |
| **117** | `Actualizado hace` | 0 | **0** | ✓ (ver nota) |
| **122** | `3,8` en `/proyecto/14309-04` | **0** | **2** | ✓ llegó |
| **114** | `href="/proyecto/` en `/parlamentario/D1165` | 1 (línea) | **23** | ✓ ≥ 1 |
| **114** | `<section id="votos">` en `/parlamentario/D1165` | presente | **presente** | ✓ ancla viva |

**Nota honesta sobre `Actualizado hace`:** el criterio del plan pedía **0**, y da **0** — pero ese
marcador **no discrimina**, porque ya era 0 **antes** del deploy: el build viejo renderizaba
`Actualizado <fecha absoluta>` (p. ej. `Actualizado ",\"09 jul 2026\"`), no `Actualizado hace`. El
discriminante real del fix de 117 es el par **`Actualizado` 318 → 0** y **`según fuente al ` 0 → 32**,
que sí prueba el reemplazo del idiom. Se registra para que 125-02…07 no confíen en un control inerte.

### §3.3 Fragmentos DOM verbatim (recortados)

**117 — idiom LOCKED `según fuente al ` (F-01), con el `<!-- -->` de React intercalado:**
```
según fuente al <!-- -->09 jul 2026</span><spa
```

**122 — línea de cobertura lobby↔PL (fila 5.12), con `3,8 %` y `29 jul 2026`:**
```html
<p class="...text-sm text-muted-foreground mb-4">195 de las 5.106 audiencias registradas con
parlamentario identificado y materia publicada citan el número de un boletín en su materia
(3,8 %), según fuente al 29 jul 2026. Este recuento cubre solo esa parte …
```
Coincide con lo que `122-CRUCES-SQL.md` predijo para el deploy (`3,8 %` **y** `29 jul 2026`), y con
`Q-74` re-verificado contra PROD (`5106|195|82|3.82`). La cifra horneada **sigue vigente**: no hay que
actualizar `COBERTURA_MENCIONES_LOBBY`.

**114 — links internos vivos en `/parlamentario/D1165` (23 ocurrencias, muestra de 6 distintas):**
```
href="/proyecto/10986-24
href="/proyecto/14767-03
href="/proyecto/14838-03
href="/proyecto/15258-25
href="/proyecto/15773-11
href="/proyecto/15936-18
```

**114 — ancla del rail, fila `4.1-A3-votos` de `114-ANCLAS.md`:**
```html
<section id="votos" class="mt-12"
```
Byte-idéntica a la columna «existe» del artefacto. Las 4 anclas del rail de ficha están presentes,
1 vez cada una: `votos`, `lobby`, `patrimonio`, `cruces`.

⇒ Los **tres** fixes se prueban por **contenido**, ninguno por mera disponibilidad. La verificación
exhaustiva de links sigue siendo el **Plan 05**; la re-lectura de las 82 filas de cruces, el **Plan 06**.

---

## §4 Cierre

| criterio del plan | resultado |
|---|---|
| Gate pre-deploy (suite + tsc + 14 guards) **antes** de construir | ✓ §1 — con números, cero adjetivos |
| Suite `app/` ≥ 1590 | ✓ **1590/1590** exacto, 107 archivos |
| `git diff HEAD -- app/ packages/ supabase/` vacío | ✓ el bundle es HEAD `b4882e9` |
| `BUILD EXIT: 0` + `worker.js` | ✓ 2278 bytes |
| `VERSIÓN DESPLEGADA` con uuid real | ✓ `0ea5d97f-a172-436e-aad0-add95940ee0e` |
| 10/10 rutas en 200 | ✓ §3.1 |
| 3 marcadores DOM de 114/117/122 | ✓ §3.2/§3.3, con antes/después medido |
| Cero flips de flags · cero `secret put` | ✓ §2.3 — MONEY y NOTIF siguen OFF |
| Cero DDL/DML · cero PII · cero secretos impresos | ✓ sólo nombres de secrets; `SUPABASE_DB_URL` nunca expandida |

**Residuo benigno:** `C:\Temp\obs-build\node_modules` y `.open-next` (artefactos del contenedor Linux).
Sin credenciales. Borrables tras reboot si Windows los mantiene locked.

**Desbloqueado:** los planes **125-02 … 125-07** pueden correr contra
`0ea5d97f-a172-436e-aad0-add95940ee0e`, que ya sirve el código de HEAD.
