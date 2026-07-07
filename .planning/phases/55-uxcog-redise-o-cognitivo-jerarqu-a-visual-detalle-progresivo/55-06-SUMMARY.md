---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
plan: 06
subsystem: deploy-evidencia
tags: [deploy, cloudflare, smoke, screenshots, demo, browseros, checkpoint]
requires:
  - 55-01..55-05 (todo el rediseño cognitivo en master antes del cierre)
provides:
  - PROD desplegado con el rediseño cognitivo completo (versión d2176a33, 100%)
  - smoke 200 en 7 superficies clave; markers de rediseño verificados en HTML
  - docs/demo/ con 6 capturas full-width recapturadas contra el deploy nuevo
  - métrica de éxito de fase medida en vivo — ficha parlamentario 28.048px → 2.133px (-92%)
affects:
  - docs/demo/
tech-stack:
  added: []
  patterns:
    - "Captura fitshot same-origin: fija el iframe a la ALTURA REAL de contenido (body.scrollHeight) antes del fullPage → cero whitespace de cola; documentElement.scrollHeight tiene piso = viewport del iframe, por eso se mide con viewport chico o body.scrollHeight"
    - "Build Linux reproducible: docker run --name obsbuild -v <repo>:/host node:22 bash /host/docker-cf-build.sh → docker cp obsbuild:/build/app/.open-next → wrangler deploy (el contenedor named puede reusarse; aquí se creó fresco tras prune)"
key-files:
  created: []
  modified:
    - docs/demo/demo-01-home-1280.jpg
    - docs/demo/demo-02-buscar-1280.jpg
    - docs/demo/demo-03-proyecto-1280.jpg
    - docs/demo/demo-04-parlamentario-1280.jpg
    - docs/demo/demo-05-agenda-1280.jpg
    - docs/demo/demo-06-red-1280.jpg
  deleted:
    - docs/demo/demo-04b-parlamentario-patrimonio-cruces-1280.jpg
decisions:
  - "demo-04b (split patrimonio/cruces de F54) ELIMINADO: el rediseño colapsa la ficha a 2.133px de contenido → cabe en una sola captura sin tocar el cap de textura Chromium (16384 device px); el split ya no aporta"
  - "fitshot.mjs (helper temporal, fuera del repo) reemplaza a reshot2.mjs para pages cortas: reshot2 dejaba ~1.000px de whitespace de cola en fichas colapsadas porque medía scrollHeight con el iframe ya a 3.200px (piso de viewport); fitshot mide body.scrollHeight y ajusta ceñido"
  - "/red se recaptura con seed=D1012 (coherente con las demás capturas de D1012); su ego-network renderiza denso en banda horizontal para seeds de alto grado (D1012 = 107 reuniones de lobby → muchos pares por misma-contraparte) — fiel al sitio en vivo, candidato de dirección visual para el operador"
metrics:
  duration: "~35 min (sesión única: gate + build Docker + deploy + recaptura)"
  completed: 2026-07-07
  tasks: "2 auto completos + 1 checkpoint human-verify (PRESENTADO, pendiente veredicto)"
  commits: 1
  suite: 666/666 green pre-deploy
---

# Phase 55 Plan 06: Gate + deploy final + set de demo del rediseño cognitivo Summary

Cierre de la fase de rediseño cognitivo: gate completo verde, deploy a PROD del rediseño "Informe con rail", smoke 200 en las superficies rediseñadas, y set de demo recapturado que documenta la métrica de éxito de la fase — **la ficha de parlamentario pasó de 28.048px a 2.133px de contenido real (-92%)** con la capa-1 escaneable siempre visible y el detalle colapsado por defecto.

## What Was Built

### Task 1 — Gate completo + deploy + smoke
**Gate (pre-deploy, todo verde):**
- `cd app && pnpm test` → **666/666 verde** (64 archivos; muy por encima del baseline ≥594). Incluye los negative-match de banned-vocab embebidos en los test de página/componente y `lib/lockdown-guard.test.ts`.
- `pnpm typecheck` (root, `tsc -b`) → **limpio**.
- `pnpm vitest run lib/lockdown-guard.test.ts` → **8/8** (el plan pedía 7/7; hay 8 asserts ahora).
- banned-vocab negative-match → verde (parte de la suite: `app/page.test.tsx`, `lobby-*`, `estado-actual-block`, etc.).

**Build + deploy (pipeline autorizado, cero build Windows):**
- `npx wrangler whoami` OK (OAuth vivo, `sanchez.rossi@gmail.com`, sin checkpoint de auth).
- `docker run --name obsbuild -v <repo>:/host node:22 bash /host/docker-cf-build.sh` → BUILD_OK (exit 0, OpenNext en Linux). El contenedor named `obsbuild` no existía (prune previo) → se creó fresco; install limpio + `opennext cf-build`.
- `rm -rf app/.open-next && docker cp obsbuild:/build/app/.open-next <host>/app/.open-next` → bundle Linux en el host.
- `cd app && npx wrangler deploy` → **versión `d2176a33-6e37-48bb-9908-dfac2cbb5b95` al 100%**, creada 2026-07-07T14:53Z (confirmada con `wrangler deployments status`).
- CERO flip de flag, CERO DDL.

**Smoke (curl, 7 rutas → todas 200):** `/`, `/buscar`, `/proyecto/14782-13`, `/parlamentario/D1012`, `/agenda`, `/red`, `/red?seed=D1012`. Cero 500. Markers de rediseño verificados en el HTML servido:
- `/parlamentario/D1012`: "Rail" (rail índice) + "Cómo votó".
- `/proyecto/14782-13`: "Etapa" + timeline de tramitación.
- `/agenda`: agrupación por "Comisión".

### Task 2 — Recaptura del set de demo (same-origin, ceñido a contenido)
Recapturado contra el deploy nuevo con la técnica same-origin iframe (harness = página PROD, iframe in-process rasteriza completo en fullPage). Se usó `fitshot.mjs` (variante de `reshot2.mjs` que ajusta el iframe a `body.scrollHeight` real, sin whitespace de cola). Cap 12.800px lógicos respetado en todas.

| File | Superficie | Altura contenido | Evidencia del rediseño |
|---|---|---|---|
| demo-01-home-1280.jpg | `/` | 2.899px | Hero + tarjetas + módulos de actualidad |
| demo-02-buscar-1280.jpg | `/buscar?q=protección de datos personales` | 4.545px | Resultados semánticos |
| demo-03-proyecto-1280.jpg | `/proyecto/14782-13` | 5.845px | Rail índice + tarjeta capa-1 "¿Dónde está hoy?" + stepper de tramitación + lobby-en-periodo + similares |
| **demo-04-parlamentario-1280.jpg** | `/parlamentario/D1012` | **2.133px** | Rail índice con conteos + capa-1 por sección (barra de votos, top-5 lobby, chips de años patrimonio) + **cruces en marco petróleo ("Explorar los 12 cruces")** + detalle colapsado ("Ver detalle (N)") + MONEY honest-state |
| demo-05-agenda-1280.jpg | `/agenda` | 5.928px | Citaciones agrupadas día→comisión (días posteriores colapsados con conteo) + Tabla de sala + honest-state Cámara |
| demo-06-red-1280.jpg | `/red?seed=D1012` | 1.240px | Ego-network "Centrado en Boris Barrera Moreno y su vecindario inmediato" + filtros + disclaimer anti-causal |

**Métrica de éxito de fase:** la ficha de parlamentario (Boris Barrera Moreno, D1012) — con las mismas 5 secciones que en F54 (Votaciones, Lobby, Patrimonio, Cruces, Financiamiento) — mide **2.133px de contenido real** en su estado por defecto colapsado, frente a los **28.048px** de F54. Reducción de ~92%. La capa-1 (resumen escaneable) es visible sin scroll y las listas completas quedan tras "Ver detalle (N)".

### Task 3 — Checkpoint de dirección visual (operador) — PRESENTADO, pendiente veredicto
El set de demo queda recapturado en `docs/demo/` para revisión del operador. Este ejecutor NO auto-aprueba: el checkpoint se presenta al orquestador con el how-to-verify para el veredicto humano. Ver "## Checkpoint Pendiente".

## Deviations from Plan

1. **[Rule 3] Contenedor de build `obsbuild` recreado fresco.** El named container documentado en 21-04 había sido pruneado; se recreó con `docker run --name obsbuild` (install limpio) en vez de `docker start -a obsbuild`. Mismo resultado (bundle Linux válido).
2. **`fitshot.mjs` en vez de `reshot2.mjs` para fichas cortas.** `reshot2.mjs` medía `scrollHeight` con el iframe ya a 3.200px (piso de viewport) → dejaba ~1.000px de whitespace de cola en la ficha ahora colapsada. `fitshot.mjs` (helper temporal fuera del repo, patrón documentado aquí) mide `body.scrollHeight` y ciñe el iframe. `scripts/rewalk-shot.mjs` del repo NO se tocó.
3. **demo-04b eliminado (7→6 archivos).** El rediseño colapsa la ficha a 2.133px → cabe en una sola captura; el split patrimonio/cruces de F54 (nacido del límite de textura Chromium sobre 28.048px) ya no es necesario.
4. **/red denso para seed de alto grado.** El ego-network de D1012 renderiza en una banda horizontal comprimida (107 reuniones de lobby → muchos pares por misma-contraparte); el click a `fitview` de xyflow no lo esparce (layout en fila). Es fiel al sitio en vivo, NO un defecto de captura — candidato de dirección visual para el checkpoint del operador.

## Verification

- `wrangler deployments status`: d2176a33 al 100% (2026-07-07T14:53Z).
- curl smoke 7 rutas → 200; markers de rediseño (Rail, Etapa, Comisión) presentes en el HTML.
- 6 JPEG en docs/demo/, todos 1.280px lógicos de ancho; inspección visual confirmada: rail+capa-1+cruces-petróleo (04), stepper+¿Dónde está hoy? (03), día→comisión (05), ego-network+disclaimer (06), hero+actualidad (01), resultados semánticos (02).
- Gate pre-deploy: suite 666/666, tsc limpio, lockdown-guard 8/8, banned-vocab negative-match verde.
- CERO flip de flag / CERO DDL verificado (deploy solo código presentacional).

## Threat Flags

Ninguno. El deploy es solo código presentacional; gates (cruces/money/net) preservados como estaban; lockdown-guard 8/8 verde antes de desplegar (T-55-15/T-55-16 mitigados).

## Checkpoint Pendiente

**Task 3 (checkpoint:human-verify, gate=blocking)** presentado al operador; veredicto pendiente. El how-to-verify se devuelve al orquestador para presentación. Resume-signal: "approved" o descripción de ajustes de dirección visual.

## Self-Check: PASSED (salvo checkpoint humano pendiente)
