---
phase: 129-panel-diseno-loop-de-diseno-browseros-hasta-que-quede-bien
plan: 01
subsystem: deploy-y-evidencia-visual
tags: [deploy, cloudflare-workers, browseros, panel, b-02, h-01]
requires:
  - "HEAD fba1298 (panel 128 ya en el árbol)"
  - "OAuth wrangler en C:/Users/Carlo/AppData/Roaming/xdg.config/.wrangler"
provides:
  - "Deploy nuevo 4c6fdbda-61ae-485e-9a4d-4197db35cf61 sirviendo HEAD"
  - "129-DEPLOY-EVIDENCIA.md con baseline, bundle pre-fix, B-02 y capturas"
  - "3 PNG del panel bajo assets/"
  - "Control negativo del bundle VIEJO medido antes de la purga (insumo de 129-04)"
affects:
  - "129-02..129-05: todas miden contra 4c6fdbda, no contra b69f2ec2"
tech-stack:
  added: []
  patterns:
    - "deploy build+deploy dentro de node:22-slim con OAuth montado"
    - "harness local de captura por proxy que despoja CSP (sin tocar el repo)"
key-files:
  created:
    - .planning/phases/129-.../129-DEPLOY-EVIDENCIA.md
    - .planning/phases/129-.../assets/129-deploy-landing-desktop.png
    - .planning/phases/129-.../assets/129-deploy-panel-390.png
    - .planning/phases/129-.../assets/129-deploy-comparar.png
  modified: []
decisions:
  - "La captura 390px se tomó por el escalón (b) del plan (harness local); (a) es IMPOSIBLE en esta máquina"
  - "El PNG 390 se produce recortando el rect del iframe y reescalando por el DPR real 1,25"
metrics:
  duration: ~50 min
  completed: 2026-07-30
---

# Phase 129 Plan 01: Deploy nuevo + evidencia visual del panel — Summary

Deploy nuevo del HEAD a Cloudflare (`4c6fdbda-61ae-485e-9a4d-4197db35cf61`, distinto del preexistente
`b69f2ec2`), con baseline pre-deploy registrado para no acreditar falsos logros, B-02 cerrado con cero
fuerte apareado sobre el DOM servido, y las 3 superficies capturadas y acreditadas por contenido.

## Qué se hizo

| Task | Resultado | Commit |
|---|---|---|
| 1 — Baseline PRE-deploy | version-id preexistente, 2 conteos vivos, mtime del worker viejo, 4 mediciones del bundle pre-fix + 122 chunks | `62b07c7` |
| 2 — Deploy nuevo | `4c6fdbda-61ae-485e-9a4d-4197db35cf61`, HTTP 200 al primer intento | `6298c66` |
| 3 — B-02 + capturas | 0 / 0 / 2, 3 PNG acreditados por `textContent` | `b0e37f7` |

## Resultados clave

**Deploy:** `4c6fdbda-61ae-485e-9a4d-4197db35cf61`. Gate anti-bundle-viejo superado: `worker.js`
19:30 > stamp 19:19 ⇒ el bundle desplegado se construyó en esta corrida, no es el del 16:19.

**B-02 (sobre el deploy nuevo):** `(sin materia)` = **0**, `Por materia` = **0** (cero ESTRUCTURAL,
`panel-actualidad.tsx:51`), control positivo `Comisiones citadas esta semana` = **2** ⇒ los ceros son
fuertes, no vacuos. **Idénticos al baseline pre-deploy**: como exige el plan, el cero de B-02 NO se
acredita como logro de este deploy.

**Bundle PRE-fix (insumo de 129-04, medido antes de la purga):** `citaciones del Senado` = **2**,
`"citación"` = **1** (NO 0 — el criterio `>=1` sería vacuo), control positivo = **2**, y el listado
completo de **122** chunks SSR con sus hashes.

**Capturas:** las 3 existen, pasan `test -s` y llevan fragmento `textContent` de contenido real.

## Desviaciones

**1. [Rule 3] Rutas del plan inexistentes.** El plan referenciaba
`104-vsim-p3b-flip-on-deploy-integrado/104-02-PLAN.md`; el directorio real es
`104-cierre-p3b-verificaci-n-e2e-todo-funciona/`. Se usó el runbook equivalente y más reciente
(`125-DEPLOY-RUNBOOK.md`), que documenta verbatim la corrida que produjo un deploy exitoso.

**2. [Rule 3] `pnpm install` faltaba en el molde de `docker-deploy.sh`.** El paso 1 purga
`node_modules`, así que sin `pnpm install --frozen-lockfile` el build no arranca. Añadido al script
del mirror (fuera del repo).

**3. [HECHO QUE CONTRADICE AL PLAN] El DPR de esta máquina es 1,25, no 1.** El plan afirmaba
"las capturas BrowserOS de este repo son DPR 1 … así que el ancho sale exacto". Medido:
`devicePixelRatio` = 1,25; un viewport de 1296 CSS px da un PNG de 1620. El propio ejemplo `1620×917`
que el plan citaba como prueba de DPR 1 es en realidad 1296 CSS px × 1,25. Registrado con su medición.

**4. [Escalón (b), con salvedad] La captura 390px NO es del deploy real.** El escalón (a) es
IMPOSIBLE en esta máquina, y cada intento quedó medido: `create_window` nace maximizada (`resizeTo`
no-op), `window.open` con `width=406` va bloqueado por el pop-up blocker, ningún tool MCP expone
viewport/emulación, no hay puerto CDP crudo abierto, y el `MoveWindow` de Win32 topa en el mínimo
duro de Chromium (910 px de ventana ⇒ `innerWidth` mínimo 770). Se usó el escalón (b): un proxy local
efímero que sirve el contenido del deploy REAL despojando `content-security-policy` y
`x-frame-options` para poder enmarcarlo a 390 px. **Cero archivos del repo tocados, cero cambios a la
CSP** (`git diff` de los 4 archivos de CSP vacío). El `href` pegado es `http://127.0.0.1:4390/` ⇒
escalón (b) por el discriminador del plan, y la salvedad está escrita en la evidencia. NO es el caso
prohibido (c): las media queries evalúan el viewport real del iframe, y la captura muestra el layout
móvil de una columna.

**5. [Método de la captura 390]** Como el DPR es 1,25, el shot crudo salió 943×1750. Se recortó el
rect exacto del iframe (488×1750 px de dispositivo) y se reescaló ×0,8 a px CSS ⇒ **390×1400**
exactos. Declarado explícitamente en la evidencia; ningún píxel viene de un viewport distinto de 390.

## Hallazgo: H-01 REPRODUCIDO (no "no reproducible")

En el **primer** load de `/comparar?a=D1178&b=D1099` el DOM mostró el error boundary raíz
(`No pudimos cargar la portada`). Localización de la causa, con medición:

- El HTML **SSR** llega **200, íntegro y SIN boundary** (109.384 bytes, `D1178` y `D1099` 10 veces
  cada uno, `No pudimos cargar la portada` = 0).
- El boundary aparece **sólo tras la hidratación** ⇒ es un fallo **de cliente post-hidratación**, no
  un 500 ni un fallo de datos.
- Una re-navegación a la misma URL renderiza correcto (6 encabezados reales, 80.175 chars).

**Sin determinar:** el stack trace. `get_console_logs` devolvió `{"entries":[],"totalCount":0}` en
los 3 intentos (el buffer no retuvo el error de la carga previa), así que **qué componente lanza
sigue abierto** y es trabajo de la ola que cierre H-01. La captura acreditada de `/comparar` se tomó
en el estado sano (`err:false`), como exige el criterio.

## Known Stubs

Ninguno introducido: este plan no toca código de la app.

## Self-Check: PASSED

- `129-DEPLOY-EVIDENCIA.md` — FOUND (528 líneas)
- `assets/129-deploy-landing-desktop.png` — FOUND (1620×917)
- `assets/129-deploy-panel-390.png` — FOUND (390×1400)
- `assets/129-deploy-comparar.png` — FOUND (1620×847)
- commits `62b07c7`, `6298c66`, `b0e37f7` — FOUND
- verificación automatizada de Task 3 — **PASS**
