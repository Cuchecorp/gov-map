# 129 — Evidencia de deploy (plan 129-01)

## Baseline PRE-deploy

Medido ANTES de tocar el mirror, el build o el deploy.

**1. HEAD del repo**

```
$ git log -1 --format=%H
fba1298a3c8fdb2c0d417410367e8e42a0690004
$ git merge-base --is-ancestor 982a4ad HEAD && echo YES
YES
```

`fba1298` es descendiente de `982a4ad` (el HEAD que registró el plan): cumple "982a4ad o posterior".

**2. Últimas 3 líneas de `C:/Temp/obs-build/deploy.log` (version-id PREEXISTENTE)**

```
$ tail -3 C:/Temp/obs-build/deploy.log
Deployed observatorio-congreso triggers (1.19 sec)
  https://observatorio-congreso.thevalis.workers.dev
Current Version ID: b69f2ec2-37c9-4212-b91c-a9ad97b4aeb7
```

**3. Conteos B-02 contra el deploy VIVO, PRE-deploy nuevo**

```
$ curl -s https://observatorio-congreso.thevalis.workers.dev/ > /tmp/p129-pre.html
$ wc -c < /tmp/p129-pre.html
72734
$ grep -oF '(sin materia)' /tmp/p129-pre.html | wc -l
0
$ grep -oF 'Por materia' /tmp/p129-pre.html | wc -l
0
$ grep -oF 'Comisiones citadas esta semana' /tmp/p129-pre.html | wc -l
2
```

> El baseline pre-deploy YA pasaba los conteos de B-02; el cero de B-02 NO se acredita como logro del deploy nuevo.

**4. mtime del `worker.js` VIEJO del mirror**

```
$ ls -l C:/Temp/obs-build/app/.open-next/worker.js
-rw-r--r-- 1 Carlo 197609 2278 Jul 30 16:19 C:/Temp/obs-build/app/.open-next/worker.js
```

2.278 bytes = entrypoint-shim de `@opennextjs/cloudflare`; el código de la app NO vive aquí.

## Bundle PRE-fix (control negativo)

`BUNDLE_VIEJO=C:/Temp/obs-build/app/.open-next/server-functions`.
Medido AHORA porque la purga del mirror (129-04 Task 2) lo borra para siempre.

**Medición A — negativo CON carne (el molde viejo contiguo)**

```
$ grep -rhoF 'citaciones del Senado' "$BUNDLE_VIEJO" | wc -l
2
```

Valor real medido: **2** (coincide con lo previsto en el plan). `129-04` exigirá **0**.

**Medición B — `"citación"` entrecomillado (ADVERTENCIA: ya existe, criterio `>=1` sería VACUO)**

```
$ grep -rhoF '"citación"' "$BUNDLE_VIEJO" | wc -l
1
```

Valor real medido: **1**, NO 0 — el acordeón de agenda ya pluraliza inline en
`app_components_06mwdzu._.js`. `129-04` debe exigir que este número SUBA, no que sea `>=1`.

**Medición C — control positivo apareado (prueba que el grep SÍ encuentra en este bundle)**

```
$ grep -rhoF 'Comisiones citadas esta semana' "$BUNDLE_VIEJO" | wc -l
2
```

`>= 1` ✔ — los ceros/valores de A y B son ceros fuertes, no vacuos.

**Medición D — listado COMPLETO de chunks SSR con sus hashes (122 archivos)**

```
$ ls "$BUNDLE_VIEJO"/default/app/.next/server/chunks/ssr/*.js | wc -l
122
$ ls "$BUNDLE_VIEJO"/default/app/.next/server/chunks/ssr/*.js   # basenames, hash de contenido incluido
0p8v_@radix-ui_react-accordion_dist_index_mjs_02oljm0._.js
0una_next_0fc3l60._.js
0una_next_dist_0e-u897._.js
0una_next_dist_0s-pk-j._.js
0una_next_dist_0vcen9i._.js
0una_next_dist_1-4xg2p._.js
0una_next_dist_18-6d94._.js
0una_next_dist_1awccjd._.js
0una_next_dist_1k3-jow._.js
0una_next_dist_1mcvn95._.js
0una_next_dist_1y23h-n._.js
0una_next_dist_client_components_0b3du_n._.js
0una_next_dist_client_components_builtin_forbidden_0_8-n6q.js
0una_next_dist_client_components_builtin_global-error_19d940x.js
0una_next_dist_client_components_builtin_unauthorized_01l8l2_.js
0una_next_dist_compiled_1_9g74d._.js
0una_next_dist_esm_build_templates_app-page_0-bekn0.js
0una_next_dist_esm_build_templates_app-page_04rrnos.js
0una_next_dist_esm_build_templates_app-page_07bb1sq.js
0una_next_dist_esm_build_templates_app-page_0gjnhll.js
0una_next_dist_esm_build_templates_app-page_0k1ar4y.js
0una_next_dist_esm_build_templates_app-page_0nhotww.js
0una_next_dist_esm_build_templates_app-page_0v3-c7c.js
0una_next_dist_esm_build_templates_app-page_0w65i9b.js
0una_next_dist_esm_build_templates_app-page_1--n70z.js
0una_next_dist_esm_build_templates_app-page_197uwih.js
0una_next_dist_esm_build_templates_app-page_1g5vqj0.js
0una_next_dist_esm_build_templates_app-page_1g7lxfb.js
0una_next_dist_esm_build_templates_app-page_1ifbk17.js
0una_next_dist_esm_build_templates_app-page_1lk4663.js
0una_next_dist_esm_build_templates_app-page_1q1xr-z.js
0una_next_dist_esm_build_templates_app-page_1u-_qvq.js
0una_next_dist_esm_build_templates_app-page_20m1yzm.js
1kx__@supabase_supabase-js_dist_index_mjs_06og0oi._.js
[root-of-the-server]__01-69pj._.js
[root-of-the-server]__02rv-s3._.js
[root-of-the-server]__0acunxd._.js
[root-of-the-server]__0belp66._.js
[root-of-the-server]__0hu_xmm._.js
[root-of-the-server]__0w5k6ns._.js
[root-of-the-server]__0wfwga2._.js
[root-of-the-server]__0y7bqt-._.js
[root-of-the-server]__11hqfyb._.js
[root-of-the-server]__143pts7._.js
[root-of-the-server]__14dk02w._.js
[root-of-the-server]__16padhl._.js
[root-of-the-server]__170h0v4._.js
[root-of-the-server]__19syxr2._.js
[root-of-the-server]__1bu4j5j._.js
[root-of-the-server]__1c63kxe._.js
[root-of-the-server]__1gzx1_n._.js
[root-of-the-server]__1i-1pnu._.js
[root-of-the-server]__1ia2o3p._.js
[root-of-the-server]__1k89aqs._.js
[root-of-the-server]__1kqy9i5._.js
[root-of-the-server]__1tqndce._.js
[root-of-the-server]__1wbscd6._.js
[root-of-the-server]__1zj8luu._.js
[root-of-the-server]__2170nls._.js
[turbopack]_runtime.js
_08i3xdv._.js
_0johw0p._.js
_0n8-5fp._.js
_0t4rit2._.js
_0tx6tcv._.js
_13nqcvo._.js
_1879dc7._.js
_1b3l4ls._.js
_1g9qzh1._.js
_1hpvmko._.js
_1jo-ab9._.js
_1r7y4jk._.js
_20gko2d._.js
_212xq6t._.js
app_00-5c0_._.js
app_0d0lf71._.js
app_1casndb._.js
app_1jm39lz._.js
app_1qxuhq0._.js
app__next-internal_server_app__global-error_page_actions_1b23g7-.js
app__next-internal_server_app__not-found_page_actions_1du4791.js
app__next-internal_server_app_admin_revisar-entidades_page_actions_1tn_tf3.js
app__next-internal_server_app_agenda_page_actions_0d3hfoj.js
app__next-internal_server_app_buscar_page_actions_1x7j8be.js
app__next-internal_server_app_comparar_page_actions_08hzkqq.js
app__next-internal_server_app_contraparte_[id]_page_actions_0fblm95.js
app__next-internal_server_app_metodologia_page_actions_1udzb6g.js
app__next-internal_server_app_notificaciones_baja_page_actions_1xffe0n.js
app__next-internal_server_app_notificaciones_confirmar_page_actions_1k9x98w.js
app__next-internal_server_app_page_actions_01mjxyz.js
app__next-internal_server_app_parlamentarios_page_actions_0_zgvtj.js
app__next-internal_server_app_red_page_actions_1p8a28-.js
app__next-internal_server_app_sobre_page_actions_0ik3xho.js
app_app_agenda_error_tsx_0ndyled._.js
app_app_agenda_error_tsx_1yu94w0._.js
app_app_buscar_error_tsx_1_dm4z4._.js
app_app_buscar_error_tsx_1v4r_3e._.js
app_app_comparar_page_tsx_1wmz8v6._.js
app_app_contraparte_[id]_error_tsx_1bhgikw._.js
app_app_contraparte_[id]_error_tsx_1mqopac._.js
app_app_contraparte_[id]_not-found_tsx_0yj5o4s._.js
app_app_contraparte_[id]_page_tsx_12nlrbr._.js
app_app_error_tsx_0b-h131._.js
app_app_error_tsx_0b53dmv._.js
app_app_page_tsx_0rknh79._.js
app_app_parlamentario_[id]_error_tsx_03r531f._.js
app_app_parlamentario_[id]_error_tsx_0bdl-gi._.js
app_app_parlamentario_[id]_not-found_tsx_08ca_sd._.js
app_app_parlamentarios_error_tsx_0kt4k52._.js
app_app_parlamentarios_error_tsx_1c1xsn3._.js
app_app_proyecto_[boletin]_error_tsx_1h2fpp3._.js
app_app_proyecto_[boletin]_error_tsx_214hobf._.js
app_app_proyecto_[boletin]_not-found_tsx_1gu69mz._.js
app_app_red_not-found_tsx_15ponb4._.js
app_components_06mwdzu._.js
app_components_buscar-filtros_tsx_1ie0vyt._.js
app_components_red_red-graph_tsx_02y_fhd._.js
app_lib_format_ts_19skre_._.js
app_lib_utils_ts_0lx7obt._.js
node_modules__pnpm_07kx611._.js
node_modules__pnpm_0kh2m71._.js
node_modules__pnpm_1bkub86._.js
```

Los hashes son de contenido. `129-04` exigirá que **al menos uno** difiera tras el fix. El fix toca
`app/components/panel-tile-*.tsx` ⇒ mirar especialmente `app_components_*.js` y `app_app_page_tsx_*`,
pero SIEMPRE re-listando con el glob, jamás hardcodeando una ruta de chunk.

---

## Deploy nuevo

# VERSIÓN DESPLEGADA: `4c6fdbda-61ae-485e-9a4d-4197db35cf61`

**Distinta de la preexistente `b69f2ec2-37c9-4212-b91c-a9ad97b4aeb7`** ⇒ el deploy SÍ ocurrió.
Commit del bundle: `62b07c7` (HEAD; el único cambio sobre `fba1298` es `.planning/`, excluido del mirror).

### 1. Purga explícita del mirror (PowerShell, NO git-bash)

`robocopy /MIR` con `/XD` IGNORA los excluidos, no los borra ⇒ purga previa obligatoria.

```powershell
foreach ($p in @('C:\Temp\obs-build\node_modules','C:\Temp\obs-build\.pnpm-store','C:\Temp\obs-build\app\.open-next')) {
  if (Test-Path $p) { Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue }
  Write-Output "$p exists=$(Test-Path $p)"
}
```
```
C:\Temp\obs-build\node_modules exists=False
C:\Temp\obs-build\.pnpm-store exists=False
C:\Temp\obs-build\app\.open-next exists=False
```

### 2. Espejo

```powershell
robocopy 'C:\Users\Carlo\OneDrive - pjud.cl\Documentos\GitHub\Observatorio' 'C:\Temp\obs-build' `
  /MIR /XD node_modules .open-next .next .git .turbo dist coverage .planning .pnpm-store `
  /XF *.log /NFL /NDL /NP /R:1 /W:1
```
⇒ `ROBOCOPY_EXIT: 3` (< 8 = éxito).

`pnpm-workspace.yaml` estaba LIMPIO en esta corrida (`git status --porcelain` vacío, `allowBuilds`
con booleanos reales) ⇒ NO hizo falta el fix §1.4 del runbook 125.

### 3. Re-escritura de `C:/Temp/obs-build/docker-deploy.sh` (no está en el repo; `/MIR` lo borra)

```bash
#!/usr/bin/env bash
set -euo pipefail
corepack enable
corepack prepare pnpm@11 --activate
pnpm config set dangerouslyAllowAllBuilds true
export XDG_CONFIG_HOME=/root/.config
export WRANGLER_HOME=/root/.config/.wrangler
cd /work
pnpm install --frozen-lockfile
cd /work/app
CI=true pnpm run deploy 2>&1 | tee /work/deploy.log
echo "DEPLOY EXIT: 0"
ls -la /work/app/.open-next/worker.js
```

`pnpm run deploy` = `opennextjs-cloudflare build && opennextjs-cloudflare deploy` ⇒ build y deploy
ocurren AMBOS dentro del contenedor. El `pnpm install --frozen-lockfile` es obligatorio aquí porque
el paso 1 purgó `node_modules` (desviación RULE-3 respecto del molde del plan, que no lo mencionaba).

### 4. Stamp de inicio

```
$ touch /tmp/129-build-start && date +%s && date -u +"%Y-%m-%dT%H:%M:%SZ"
1785453557
2026-07-30T23:19:17Z
```

### 5. Contenedor (build + deploy, OAuth del host montado)

```bash
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "C:\Temp\obs-build:/work" \
  -v "C:\Users\Carlo\AppData\Roaming\xdg.config\.wrangler:/root/.config/.wrangler" \
  -w /work node:22-slim \
  bash -lc "chmod +x /work/docker-deploy.sh && /work/docker-deploy.sh"
```

Salida verbatim (líneas clave):
```
Worker saved in `.open-next/worker.js` 🚀
OpenNext build complete.
 ⛅️ wrangler 4.102.0
✨ Read 62 files from the assets directory /work/app/.open-next/assets
🌀 Found 1 new or modified static asset to upload. Proceeding with upload...
+ /BUILD_ID
✨ Success! Uploaded 1 file (55 already uploaded) (0.81 sec)
Total Upload: 8287.98 KiB / gzip: 1769.61 KiB
Worker Startup Time: 23 ms
Uploaded observatorio-congreso (7.58 sec)
Deployed observatorio-congreso triggers (1.05 sec)
  https://observatorio-congreso.thevalis.workers.dev
Current Version ID: 4c6fdbda-61ae-485e-9a4d-4197db35cf61
DEPLOY EXIT: 0
-rw-r--r-- 1 root root 2278 Jul 30 23:30 /work/app/.open-next/worker.js
```

### 6. Gate anti-bundle-viejo — `worker.js` construido en ESTA corrida

```
$ ls -l C:/Temp/obs-build/app/.open-next/worker.js
-rw-r--r-- 1 Carlo 197609 2278 Jul 30 19:30 C:/Temp/obs-build/app/.open-next/worker.js
$ ls -l /tmp/129-build-start
-rw-r--r-- 1 Carlo 197609 0 Jul 30 19:19 /tmp/129-build-start
$ test C:/Temp/obs-build/app/.open-next/worker.js -nt /tmp/129-build-start && echo GATE_OK
GATE_OK: worker.js es POSTERIOR al stamp
```

19:30 (local) > 19:19 (stamp) ⇒ NO es el bundle del 16:19. ✔

### 7. Status HTTP final

```
$ curl -s -o /dev/null -w "%{http_code}" https://observatorio-congreso.thevalis.workers.dev/
intento 1: 200
```
Cero 500s: la ventana de propagación pasó limpia (no hizo falta reintentar).

### 8. Guards de archivos prohibidos

```
$ git status --porcelain supabase/migrations   → (vacío)
$ git status --porcelain .env                  → (vacío)
$ git diff --name-only -- app/next.config.ts app/public/_headers app/middleware.ts app/wrangler.jsonc → (vacío)
```
Cero DDL/DML, cero flips de flags, cero `secret put`, cero cambios a la CSP.

---

## B-02 sobre el DOM del deploy nuevo

HTML bajado a archivo (nunca pipeado a grep); el HTML del Worker viene en UNA línea
(`wc -l` = 1, 72.734 bytes) ⇒ `grep -c` toparía en 1 ⇒ se usa `grep -oF … | wc -l`.

```
$ curl -s https://observatorio-congreso.thevalis.workers.dev/ > /tmp/p129.html
$ wc -l < /tmp/p129.html
1
$ grep -oF '(sin materia)' /tmp/p129.html | wc -l
0
$ grep -oF 'Por materia' /tmp/p129.html | wc -l
0
$ grep -oF 'Comisiones citadas esta semana' /tmp/p129.html | wc -l
2
```

| literal | conteo | lectura |
|---|---:|---|
| `(sin materia)` | **0** | negativo CON carne — el literal existiría si el tile de materia se montara |
| `Por materia` | **0** | **cero ESTRUCTURAL, no medido**: el tile no se monta (`app/components/panel-actualidad.tsx:51`, bloque `I. agrupacion_materia MUERE sin tombstone (O-3)`) |
| `Comisiones citadas esta semana` | **2** | **control positivo apareado** ≥ 1 ⇒ los ceros de arriba son ceros FUERTES, no vacuos. El `2` es HTML + payload RSC, no duplicación |

**Contraste con el baseline:** idéntico al PRE-deploy (0 / 0 / 2). Como advierte §Baseline,
el baseline pre-deploy YA pasaba estos conteos; el cero de B-02 NO se acredita como logro del deploy nuevo.

---

## Capturas

Las 3 capturas se acreditan por CONTENIDO (`textContent`, jamás `innerText`), no solo por `test -s`
— `bros-cli` sale 0 tras `CDP request timeout` y un PNG en blanco pesa >0 —. El timeout se observó en
esta corrida en la captura de landing y en la de `/comparar`: ambas necesitaron reintento.

### Hecho que contradice al plan: el DPR de esta máquina es 1,25, no 1

El plan afirmaba que "las capturas BrowserOS de este repo son DPR 1 — 965×840, 1620×917 — así que el
ancho sale exacto". **Es falso**: medido en vivo, `window.devicePixelRatio` = **1,25** y un viewport
de 1296 CSS px produce un PNG de **1620** px (1296 × 1,25 = 1620). El propio ejemplo `1620×917` que
el plan citaba como "DPR 1" es en realidad un viewport de 1296 CSS px a DPR 1,25.

```
$ evaluate_script → JSON.stringify({dpr:window.devicePixelRatio,w:window.innerWidth,h:window.innerHeight})
{"dpr":1.25,"w":1296,"h":734}
```

Consecuencia: una captura a 390 CSS px sale de 487 px de dispositivo. Ver el tratamiento en la
captura 390 más abajo.

### 1. `129-deploy-landing-desktop.png` — `/` en desktop (deploy REAL)

- `test -s` ✔ · `file` → **1620 x 917** (viewport 1296 CSS px × DPR 1,25).
- Viewport y href VERBATIM, tomados en la misma página antes del shot:
```
{"w":1296,"h":734,"href":"https://observatorio-congreso.thevalis.workers.dev/"}
```
- `textContent` del tile renderizado (elemento real, NO el payload RSC):
```
{"heads":1,"tag":"H2","head":"Comisiones citadas esta semana","card":"Comisiones citadas esta semanaRecibir al Alcalde de la comuna de Concepción, señor Héctor Múñoz y a dirigentes del Humedal Paicaví, Región del…Ver fuente ↗Citado el 03 ago 2026 · Comisión de Medio Ambiente, Cambio Climát"}
```
> Nota de método: `document.body.textContent` incluye el contenido de los `<script>`, así que su
> primera ocurrencia de `Comisiones citadas esta semana` cae dentro del payload RSC y NO probaría
> render. Se consultó `querySelectorAll("h1,h2,h3,h4")` para exigir un H2 REALMENTE renderizado.

### 2. `129-deploy-panel-390.png` — escalón (b), con salvedad obligatoria

**La captura 390px NO es del deploy real.** Se sirvió el contenido del deploy a través de un harness
LOCAL y efímero, por lo que el `href` es `127.0.0.1`. Salvedad obligatoria del escalón (b) del plan.

**Escalones (a) intentados y por qué fallaron — todos medidos, ninguno narrado:**

| intento | resultado medido |
|---|---|
| `create_window` + `window.resizeTo(406,900)` | ventana creada **maximizada** ⇒ `resizeTo` es no-op: `{"w":1296,"ow":1536}` sin cambio tras el resize |
| `window.open(...,"width=406")` desde la página | **bloqueado** por el pop-up blocker (sin gesto de usuario): `{"opened":false}` |
| control de viewport por tool MCP | **no existe**: ningún tool de BrowserOS expone viewport/emulate/deviceMetrics |
| CDP crudo (`Emulation.setDeviceMetricsOverride`) | **no accesible**: no hay puerto DevTools abierto (9222/9223/etc. cerrados; sólo el MCP en 9200) |
| redimensionar la ventana por Win32 `MoveWindow` | **tope duro de Chromium**: pedir 530 px devuelve `OS_RECT width=910`; el `innerWidth` mínimo alcanzable es **770**, nunca 390 |

El iframe same-origin contra el deploy está muerto por CSP (`frame-ancestors 'none'` +
`x-frame-options: DENY`, verificados en los headers en vivo) y **está PROHIBIDO tocar la CSP**.

**Escalón (b) tal como se ejecutó:** un proxy local efímero en `127.0.0.1:4390`
(`scratchpad/p129-harness.mjs`, fuera del repo) reenvía el contenido del deploy REAL y elimina de la
RESPUESTA únicamente `content-security-policy` y `x-frame-options`, permitiendo enmarcarlo. La página
harness contiene un `<iframe width:390px>`. **Cero archivos del repo tocados; cero cambios a la CSP
del deploy** (el `git diff` de los 4 archivos de CSP sale vacío, ver más abajo). El contenido servido
es el del Worker desplegado (control: `grep -oF 'Comisiones citadas esta semana'` sobre el proxy = 2,
igual que contra el deploy).

Esto **no** es el caso PROHIBIDO (c): no es un `<div style="width:390px">` del top-level. Las media
queries de Tailwind evalúan el viewport del **iframe**, que es un viewport real de 390 CSS px — y la
captura lo confirma: layout de una sola columna, nav apilada, tiles a ancho completo.

**Salida VERBATIM del `JSON.stringify({w,h,href})`, tomada en la MISMA página justo antes del shot:**
```
{"w":390,"h":1400,"href":"http://127.0.0.1:4390/"}
```
`"w":390` exacto. El `href` es `127.0.0.1` ⇒ **escalón (b)**, y por eso la captura 390px
**NO es del deploy real**.

- `textContent` del tile renderizado DENTRO del iframe a 390:
```
{"heads":1,"head":"Comisiones citadas esta semana","card":"Comisiones citadas esta semanaRecibir al Alcalde de la comuna de Concepción, señor Héctor Múñoz y a dirigentes del Humedal Paicaví, Región del…Ver fuente ↗Citado el 03 ago 2026 · C","rect":{"x":0,"y":0,"w":390,"h":1400},"dpr":1.25,"bodyH":6440}
```

**Cómo el PNG mide 390 px pese al DPR 1,25 (declarado, no disimulado):** el screenshot crudo del tab
salió **943 x 1750**; se recortó el rect exacto del iframe en px de dispositivo
(390 × 1,25 = **488** de ancho, 1400 × 1,25 = **1750** de alto) y se reescaló ×0,8 a la grilla de px
CSS, dando **390 x 1400** — exactamente lo que mostraría un dispositivo de 390 px a DPR 1. Ningún
píxel proviene de un viewport distinto de 390 CSS px.
```
CROP src=943x1750 cropped=488x1750 out=390x1400
$ file 129-deploy-panel-390.png
PNG image data, 390 x 1400, 8-bit/color RGBA, non-interlaced
```

### 3. `129-deploy-comparar.png` — `/comparar?a=D1178&b=D1099` (deploy REAL)

- `test -s` ✔ · `file` → **1620 x 847**.
- Ambos parlamentarios resueltos, leídos de los `<select>` de la página:
```
{"sels":[{"val":"D1099","txt":"Jaime Araya Guerrero · Cámara"},{"val":"D1178","txt":"Héctor Ulloa Aguilera · Cámara"}]}
```
Apellidos: **Araya Guerrero** (D1099) y **Ulloa Aguilera** (D1178).
- Encabezados renderizados y ausencia del boundary raíz en la captura acreditada:
```
{"heads":["Comparar dos parlamentarios","Militancia (histórica)","Comisiones","Co-autoría de proyectos","Zona electoral","Similitud de votación"],"err":false,"hasD1178":true,"len":80175}
```
`err:false` ⇒ el `textContent` NO contiene `No pudimos cargar la portada`.

---

## H-01 — REPRODUCIDO en vivo (hallazgo, no "no reproducible")

En el **primer** load de `/comparar?a=D1178&b=D1099` (página abierta con `new_hidden_page`), el DOM
post-hidratación mostró el **error boundary raíz**:

```
{"heads":["No pudimos cargar la portada"],"errPortada":true,"errTecnica":true,"len":59524}
```

**Localización de la causa — el fallo es de CLIENTE, no de servidor.** Medido en la misma ventana:

```
$ curl -s -o /tmp/p129-comp.html -w '%{http_code}' ".../comparar?a=D1178&b=D1099"
200
$ wc -c < /tmp/p129-comp.html
109384
$ grep -oF 'No pudimos cargar la portada' /tmp/p129-comp.html | wc -l
0
$ grep -oE 'D1178|D1099' /tmp/p129-comp.html | sort | uniq -c
     10 D1099
     10 D1178
```

⇒ El HTML SSR llega **200, íntegro y SIN boundary**, con ambos IDs presentes 10 veces cada uno. El
boundary aparece **sólo tras la hidratación en el navegador**. Es un fallo **post-hidratación de
cliente**, no un 500 ni un fallo de datos.

**Transitoriedad acotada:** una re-navegación a la MISMA URL en la MISMA página renderizó correcto
(`err:false`, 6 encabezados reales, 80.175 chars vs 59.524 del estado en error). Es decir: se
reproduce en el primer load y desaparece al re-navegar — consistente con el H-01 descrito en D-05.

**Lo que NO se pudo capturar:** `get_console_logs` devolvió `{"entries":[],"totalCount":0}` en los
tres intentos (el buffer de consola de BrowserOS no retuvo el error de la carga previa), así que
**no hay stack trace del error de hidratación**. La causa raíz exacta (qué componente lanza) queda
SIN determinar y es trabajo de la ola que cierre H-01; lo que aquí queda probado y fechado es:
(1) se reproduce, (2) es de cliente post-hidratación, (3) el SSR está sano.

---

## Guards finales

```
$ git diff --name-only -- app/next.config.ts app/public/_headers app/middleware.ts app/wrangler.jsonc
(vacío)
$ git status --porcelain supabase/migrations
(vacío)
$ git status --porcelain .env
(vacío)
```

---
---

# Re-deploy final (plan 129-04)

## Cadena de version-ids

| # | version-id | de quién es | qué contiene |
|---|---|---|---|
| 0 | `b69f2ec2-37c9-4212-b91c-a9ad97b4aeb7` | **preexistente**, NO acreditable | estado previo a la fase |
| 1 | `4c6fdbda-61ae-485e-9a4d-4197db35cf61` | `129-01` | el deploy criticado |
| 2 | `f9c5bf23-c021-4a90-b5f5-ff9dd7abbb82` | `129-04`, **primer** re-deploy | plural (C-04) + C-01 + C-02 + C-03 **parcial** |
| 3 | **`9a8acdb0-0534-4419-a8a3-8a8df3de79f5`** | `129-04`, **VERSIÓN FINAL** | + el tercer sitio ISO de C-03 |

**Hubo DOS deploys en este plan, y el segundo no es una repetición cosmética.** El primero
(`f9c5bf23`) se midió contra el DOM servido y **falló su propio criterio**: quedaban **2** fechas ISO
en `/comparar`, emitidas por un tercer sitio que la crítica no había localizado (`page.tsx:338`,
provenance de comisiones, que interpola `fecha_captura` cruda). Se corrigió (`ebb2242`) y se volvió a
deployar. Se registra la medición fallida en vez de borrarla: sin ella, el `0` final no se distingue
de un criterio que nunca se midió.

`9a8acdb0` es distinto de `4c6fdbda` (129-01) **y** de `b69f2ec2` (preexistente).

```
$ grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' 129-DEPLOY-EVIDENCIA.md | sort -u | wc -l
4          # >= 3 ✔ (preexistente + 129-01 + los dos de 129-04)
```

## Procedimiento (idéntico al de 129-01, sin atajos)

1. `touch /tmp/129-redeploy-stamp` **antes de nada** → `2026-07-30 20:28:00 -0400`.
2. Purga explícita en **PowerShell** de `node_modules`, `.pnpm-store` y `app/.open-next` del mirror
   (`robocopy /MIR` con `/XD` IGNORA, no borra) → las tres rutas con `exists=False`.
3. `robocopy /MIR` con los mismos `/XD` → `ROBOCOPY_EXIT: 3` (< 8 = éxito).
4. Re-escritura de `C:/Temp/obs-build/docker-deploy.sh` (no está en el repo; `/MIR` lo borra — se
   comprobó con `test -f` antes del segundo deploy: **BORRADO**, se re-escribió).
5. Contenedor `node:22-slim` con `MSYS_NO_PATHCONV=1`, montando `/work` y el OAuth de
   `C:\Users\Carlo\AppData\Roaming\xdg.config\.wrangler` → **build + deploy DENTRO del contenedor**.
6. `touch /tmp/129-deploy-done` **inmediatamente** tras extraer el `Current Version ID`.

### Gate anti-bundle-viejo

```
$ ls -l --time-style=full-iso C:/Temp/obs-build/app/.open-next/worker.js /tmp/129-redeploy-stamp
-rw-r--r-- 2278 2026-07-30 20:49:33 …/worker.js
-rw-r--r--    0 2026-07-30 20:28:00 /tmp/129-redeploy-stamp
$ test C:/Temp/obs-build/app/.open-next/worker.js -nt /tmp/129-redeploy-stamp && echo GATE_OK
GATE_OK
```

`/tmp/129-deploy-done` = `2026-07-30 20:51:06`. Es el stamp contra el que se miden las capturas:
`/tmp/129-redeploy-stamp` se creó ANTES del build, así que una captura tomada DURANTE el build
pasaría su `-nt` sin ser posterior al deploy.

## Las CUATRO patas del bundle desplegado

`BUNDLE=C:/Temp/obs-build/app/.open-next/server-functions` (el código de la app; `worker.js` pesa
2.278 bytes y es solo el entrypoint-shim de `@opennextjs/cloudflare`).

| pata | comando | pre-fix (129-01) | medido ahora | criterio | ✓ |
|---|---|---:|---:|---|---|
| **1 — negativo CON carne** | `grep -rhoF 'citaciones del Senado' "$BUNDLE" \| wc -l` | **2** | **0** | == 0 | ✔ |
| **1b — refuerzo** | `grep -rhoF '"citación"' "$BUNDLE" \| wc -l` | **1** | **2** | >= 2 | ✔ |
| **2 — control positivo apareado** | `grep -rhoF 'Comisiones citadas esta semana' "$BUNDLE" \| wc -l` | 2 | **2** | >= 1 | ✔ |
| **3 — control negativo previo** | valores pre-fix citados desde `129-01` §Bundle PRE-fix | 2 y 1 | — | existe | ✔ |

Sin la pata 2, el `0` de la pata 1 sería un **cero vacuo** (un `grep` que no encuentra nada en ningún
sitio también devuelve 0). Sin la pata 3, el `0` no distinguiría "el molde murió" de "el molde nunca
estuvo": la medición pre-fix de `129-01` (**2**) es la que le da carne. Y `"citación" >= 1` habría
sido VACUO: el bundle viejo ya lo cumplía con 1 (acordeón de agenda).

### Pata 4 — hashes de chunks SSR (re-listados con glob, nunca hardcodeados)

```
$ ls "$BUNDLE"/default/app/.next/server/chunks/ssr/*.js | xargs -n1 basename | sort > chunks-final.txt
$ wc -l < chunks-final.txt
122        # mismo CONTEO que el pre-fix; lo que cambia son los HASHES
$ comm -13 chunks-prefix.txt chunks-final.txt     # nuevos
[root-of-the-server]__0ji2cqm._.js
[root-of-the-server]__0ocj7qo._.js
[root-of-the-server]__0s9wj39._.js
[root-of-the-server]__1gk5n80._.js
$ comm -23 chunks-prefix.txt chunks-final.txt     # muertos
[root-of-the-server]__0hu_xmm._.js
[root-of-the-server]__0wfwga2._.js
[root-of-the-server]__14dk02w._.js
[root-of-the-server]__16padhl._.js
$ comm -3 chunks-prefix.txt chunks-final.txt | wc -l
8          # >= 1 nombre distinto ✔
```

> **Hecho que corrige la expectativa del plan:** el plan anticipaba que el fix compilaría a
> `app_components_*.js`. Medido, **esos nombres NO cambiaron**; los 8 nombres que difieren son todos
> `[root-of-the-server]__*`. Por eso el criterio se evaluó sobre el listado COMPLETO y no sobre un
> prefijo: mirar solo `app_components_*` (o solo `app_app_page_tsx_*`) habría dado un falso ROJO.

## Status HTTP y DOM del deploy final

```
$ curl -s -o /tmp/p129-fin.html -w '%{http_code}' https://observatorio-congreso.thevalis.workers.dev/
200        # intento 1
$ curl -s -o /tmp/p129-fin-comp.html -w '%{http_code}' ".../comparar?a=D1178&b=D1099"
500 · 500 · 200     # intentos 1, 2 y 3
```

**Los dos 500 de `/comparar` se registran, no se ocultan.** Son la ventana de propagación /
arranque en frío del Worker: el tercer intento y todas las lecturas posteriores dan 200 con la
página íntegra (109.466 bytes, 6 encabezados, cero boundary). Es coherente con el modo **M-B** ya
descrito en `129-CRITICA.md` §Diferidos D-1 (`Promise.all` sin aislamiento por eje ⇒ un fallo
transitorio de UNA RPC tumba la página entera), cuyo fix está **diferido a pronunciamiento del
operador** y NO se tocó en este plan.

### §C-03 — cero ISO en el DOM servido de `/comparar` (criterio de la crítica)

```
$ grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' /tmp/p129-fin-comp.html | wc -l
0
$ grep -oF ' 2026' /tmp/p129-fin-comp.html | wc -l
22         # control positivo apareado ⇒ el cero es FUERTE
$ grep -oF 'jul 2026' /tmp/p129-fin-comp.html | wc -l
22
```

Medición del deploy INTERMEDIO `f9c5bf23`, conservada como control negativo del propio criterio:
`ISO = 2`, ambas del molde `Fuente: Cámara/Senado · según fuente al 2026-07-22`.

### §C-02 y §C-01 sobre el DOM servido

```
$ grep -oF 'bg-foreground'     /tmp/p129-fin-comp.html | wc -l     → 0
$ grep -oF 'bg-accent-product' /tmp/p129-fin-comp.html | wc -l     → 4    (control positivo)
$ grep -oF 'No pudimos cargar la portada' /tmp/p129-fin-comp.html | wc -l → 0
$ grep -oF 'Comisiones citadas esta semana' /tmp/p129-fin.html | wc -l    → 2
```

Y los `span` REALES de los 6 tiles, leídos del DOM del deploy (no del fuente) — ver
`129-CRITICA.md` §Densidad 390px: **`[6,4,2,6,4,2]`** ⇒ filas `6 | 4+2 | 6 | 4+2`, cero huecos.

## Capturas finales

Las tres se acreditan por **contenido** (`textContent`), no por `test -s`: `bros-cli` sale 0 tras
`CDP request timeout` y un PNG en blanco pesa > 0. El timeout se observó en esta corrida en
`/comparar` y en los intentos de `fullPage` — cada uno resuelto con el reintento único del runbook.

| archivo | `file` | `-nt /tmp/129-deploy-done` | superficie |
|---|---|---|---|
| `129-final-landing-desktop.png` | **1620 x 917** | ✔ (20:54:18 > 20:51:06) | `/` deploy REAL |
| `129-final-panel-390.png` | **390 x 1400** | ✔ | escalón **(b)** — ver salvedad |
| `129-final-comparar.png` | **1620 x 847** | ✔ | `/comparar` deploy REAL |
| `129-final-landing-full.png` (bonus) | 1600 x 1603 | ✔ | `/` página completa: es la que hace visible la grilla bento entera |

### 1. `129-final-landing-desktop.png`

Viewport y href VERBATIM, tomados en la MISMA página antes del shot:
```
{"w":1296,"h":734,"href":"https://observatorio-congreso.thevalis.workers.dev/","dpr":1.25}
```
`textContent` de un H2 REALMENTE renderizado (no del payload RSC, que `document.body.textContent`
también incluye):
```
{"heads":1,"tag":"H2","head":"Comisiones citadas esta semana","card":"Comisiones citadas esta semanaRecibir al Alcalde de la comuna de Concepción, señor Héctor Múñoz y a dirigentes del Humedal Paicaví, Región del…Ver fuente ↗Citado el 03 ago 2026 · Comisión de Medio Amb"}
```

### 2. `129-final-panel-390.png` — **NO es del deploy real** (escalón (b))

Se sirvió el contenido del deploy a través de un **proxy local efímero** (`127.0.0.1:4390`,
`scratchpad/p129-harness.mjs`, fuera del repo) que quita de la RESPUESTA solo
`content-security-policy` y `x-frame-options`, para poder enmarcarlo en un `<iframe width:390px>`.
El escalón (a) —viewport real de 390 px— sigue siendo IMPOSIBLE en este entorno por las cinco
razones medidas en `129-01` (ventana maximizada, `resizeTo` no-op, pop-up bloqueado, sin tool de
viewport, sin puerto CDP, y el mínimo duro de Chromium en `innerWidth` 770). El escalón (c)
(`<div style="width:390px">`) está PROHIBIDO y no se usó. **Cero archivos del repo tocados; cero
cambios a la CSP del deploy.**

Control de que el proxy sirve el contenido del deploy y no otra cosa:
```
$ curl -s http://127.0.0.1:4390/ | grep -oF 'Comisiones citadas esta semana' | wc -l
2          # igual que contra el deploy
$ curl -sI http://127.0.0.1:4390/ | grep -icF 'content-security-policy'
(vacío)    # el header se quita en la RESPUESTA del proxy, no en el deploy
```

**Salida VERBATIM del `JSON.stringify({w,h,href})` tomada en la MISMA página justo antes del shot:**
```
{"w":390,"h":1400,"href":"http://127.0.0.1:4390/","dpr":1.25,"rect":{"x":0,"y":0,"width":390,"height":1400,"top":0,"right":390,"bottom":1400,"left":0}}
```
`"w":390` exacto. El `href` es `127.0.0.1` ⇒ **escalón (b)** ⇒ la captura **NO es del deploy real**.

**Cómo el PNG mide 390 px con DPR 1,25 (declarado, no disimulado):** el screenshot `fullPage` del
tab salió **1620 x 1750**; se recortó el rect exacto del iframe en px de dispositivo
(390 × 1,25 = **488** de ancho — se redondea hacia arriba desde 487,5, medio píxel de dispositivo de
fondo blanco entra en el borde derecho —, 1400 × 1,25 = **1750** de alto) y se reescaló a la grilla
CSS, dando **390 x 1400**.
```
SRC=1620x1750
CROP src=1620x1750 cropped=488x1750 out=390x1400
$ file 129-final-panel-390.png
PNG image data, 390 x 1400, 8-bit/color RGB, non-interlaced
$ test "$(file 129-final-panel-390.png | grep -oE '[0-9]+ x [0-9]+' | head -1 | cut -d' ' -f1)" = "390"
(exit 0)
```

`textContent` medido DENTRO del iframe a 390 (ver la tabla completa en `129-CRITICA.md`
§Densidad 390px): los 6 tiles presentes, `Comisiones citadas esta semana` entre ellos.

### 3. `129-final-comparar.png` — `/comparar?a=D1178&b=D1099` (deploy REAL)

```
{"href":"https://observatorio-congreso.thevalis.workers.dev/comparar?a=D1178&b=D1099",
 "heads":["Comparar dos parlamentarios","Militancia (histórica)","Comisiones","Co-autoría de proyectos","Zona electoral","Similitud de votación"],
 "err":false,"iso":0,"civil":22,
 "sels":[{"val":"D1099","txt":"Jaime Araya Guerrero · Cámara"},{"val":"D1178","txt":"Héctor Ulloa Aguilera · Cámara"}],
 "cta":{"txt":"Comparar","cls":"rounded-lg bg-accent-product px-4 py-2 text-sm font-medium text-background hover:bg-accent-product/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"}}
```

Apellidos de los dos parlamentarios exigidos: **Araya Guerrero** (D1099) y **Ulloa Aguilera**
(D1178). `err:false` ⇒ el `textContent` NO contiene `No pudimos cargar la portada`. `iso:0` con
`civil:22` ⇒ C-03 cerrado también sobre el DOM hidratado, no solo sobre el HTML servido. El `cls`
del CTA es la prueba de C-02 en producción.

## Guards de archivos prohibidos (deploy final)

```
$ git status --porcelain supabase/migrations   → (vacío)
$ git status --porcelain .env                  → (vacío)
$ git diff --name-only -- app/next.config.ts app/public/_headers app/middleware.ts app/wrangler.jsonc
                                               → (vacío)
```
Cero DDL/DML, cero flips de flags, cero `secret put`, cero cambios a la CSP.
