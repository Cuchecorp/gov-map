---
phase: 47-vchart-chart-de-votos-ausencias-del-parlamentario
plan: 02
subsystem: deploy-evidencia
tags: [deploy, cloudflare, smoke, viz, votos, chart, evidencia, arrastre-f38]
requires:
  - "47-01 — chart 'Cuándo votó' (agruparVotosPorTrimestre + votos-chart.tsx) en el árbol"
  - "Fixes F38 commiteados (6fcd678 pluralización + fecha NaN-safe, e28c051 RailSkeleton anti-CLS)"
provides:
  - "PROD redeployado (versión 17affbf3) con el chart 'Cuándo votó' en vivo en la ficha de parlamentario"
  - "Arrastre F38 publicado a PROD en el mismo deploy (RailSkeleton anti-CLS, pluralización, fecha NaN-safe)"
  - "Temp/votos-chart-47-evidencia.png — captura del stacked bar por trimestre en vivo (D1012, 141 votos)"
  - "Temp/reshot-votos.mjs — helper de screenshot same-origin que EXPANDE el disclosure Radix antes del shot"
affects:
  - "Fase 47 lista para checkpoint de fase estándar (VIZ-02 en vivo)"
tech-stack:
  added: []
  patterns:
    - "Deploy patrón caliente: docker-cf-build.sh (OpenNext Linux) → docker cp → wrangler deploy (OAuth host)"
    - "Screenshot iframe SAME-ORIGIN + click del trigger Radix accordion in-process para rasterizar contenido colapsado (forceMount SSR pero visualmente cerrado)"
key-files:
  created:
    - Temp/votos-chart-47-evidencia.png
    - Temp/reshot-votos.mjs
  modified: []
decisions:
  - "Gate verde (712/712 + tsc exit 0) ANTES del deploy (T-47-04): no se desplegó sobre rojo"
  - "El chart vive dentro de un Radix accordion cliente (defaultOpen=false), NO de un searchParam; la evidencia se captura clickeando el trigger 'Ver detalle (141)' dentro del iframe same-origin y dejando que Recharts (ResponsiveContainer) mida y rasterice"
  - "CERO DDL/RPC/dato nuevo: el chart deriva de votos_de_parlamentario ya público; esta fase no aplica 0049 (sigue siendo checkpoint operador de F38, aparte)"
metrics:
  duration_min: 12
  tasks: 3
  files: 2
  completed: "2026-07-08T03:14:00Z"
---

# Phase 47 Plan 02: Deploy + smoke + evidencia del chart "Cuándo votó" Summary

**Gate completo verde (712/712 + tsc), redeploy del frontend a PROD con el patrón caliente (docker-cf-build.sh → docker cp → wrangler, versión `17affbf3`), smoke que confirma el chart "Cuándo votó" en vivo en la ficha de parlamentario, y evidencia visual del stacked bar por trimestre. El redeploy ARRASTRÓ los fixes pendientes de F38 (RailSkeleton anti-CLS, pluralización, fecha NaN-safe) al mismo deploy. Cero DDL/RPC/dependencia nueva.**

## What Was Built

### Task 1 — Gate completo verde ANTES del deploy (verificación, sin commit de código)
- `npx vitest run` desde `app/` → **712/712 verde** (67 files; lockdown-guard 8/8 y banned-vocab por-componente incluidos en la suite). Baseline 690 + 22 nuevos de 47-01 mantenido, nunca menos.
- `npx tsc --noEmit` desde `app/` → **exit 0** (limpio).
- No se tocó el deploy hasta confirmar ambos verdes (T-47-04 mitigado: cero deploy sobre rojo).

### Task 2 — Redeploy caliente a PROD + smoke curl (deploy, sin commit de código)
- **Deploy (patrón caliente 38-03):** build OpenNext en Docker Linux vía `docker-cf-build.sh` (contenedor `obs-cf-build`, `docker rm -f` previo → `docker run`), `docker cp` de `.open-next` al host, `npx wrangler deploy` desde `app/` (OAuth host vivo, `wrangler whoami` OK, MSYS_NO_PATHCONV UNSET para wrangler). **Versión desplegada: `17affbf3-0441-43a0-bc24-753e014d200f` al 100%** (creada 2026-07-08T03:07:48Z, confirmada con `wrangler deployments status`).
- **Smoke (curl PROD `https://observatorio-congreso.thevalis.workers.dev`):** `/`, `/parlamentarios`, `/parlamentario/D1012`, `/proyecto/14309-04`, `/agenda` → **todos 200**.
- **Chart "Cuándo votó" en vivo:** en `/parlamentario/D1012` (parlamentario con votos confirmados) el heading `Cuándo votó` está **presente** (grep count 1, forceMount SSR aunque el detalle arranque colapsado), junto al heading hermano `Cómo votó` (count 1). La caption factual `No representa una tendencia` presente (count 1) y el empty-state `aún no permiten agruparlas` **ausente** (count 0) → `periodos.length > 0`, el chart real renderiza. Cero `internal server error` / `application error`.
- **Arrastre F38 en vivo:** `Invalid Date` **ausente** (count 0, fecha NaN-safe/fechaCortaSegura publicada) y el plural erróneo `1 parlamentarios` **ausente** (count 0, pluralización IN-01 publicada). RailSkeleton es anti-CLS (no siempre visible en HTML estático) — 200 sin regresión de layout basta.

### Task 3 — Evidencia visual del chart en vivo + verificación anti-insinuación (commit 2e7adb8)
- **`Temp/reshot-votos.mjs`** — helper de screenshot same-origin derivado de `Temp/reshot2.mjs` (38-03). DIFERENCIA clave: el chart vive DENTRO del detalle colapsado de Votaciones (Radix Accordion cliente, `forceMount` SSR pero oculto por `data-[state=closed]:hidden`), así que el helper **expande el disclosure** clickeando el trigger `Ver detalle (N)` dentro del `#votos` del iframe (same-origin → `contentDocument` accesible) y deja que Recharts (`ResponsiveContainer`) mida y rasterice antes del shot.
- **`Temp/votos-chart-47-evidencia.png`** (653 KB) — ficha de `Boris Barrera Moreno` (D1012, 141 votos) con el detalle de Votaciones EXPANDIDO mostrando el chart "Cuándo votó" en vivo. Inspección visual confirma:
  - **Stacked bar DISCRETO por trimestre**: eje X con etiquetas `AAAA · Tn` (`2021 · T1`, `2024 · T1`, `2025 · T3`, `2026 · T2`), eje Y numérico (30/60/90/120). Barras apiladas separadas por trimestre — jamás una línea/área.
  - **Leyenda NOUN**: `A favor` / `En contra` / `Abstención` / `Ausente` / `Pareo` (sustantivos, no verbos causales).
  - **Colores semánticos**: verde (a favor), rojo (en contra), ámbar (abstención), slate (ausente) — **CERO petróleo** en las barras (el `--accent-product` queda solo en el CTA "Explorar los 12 cruces", ajeno al chart).
  - **Copy factual**: heading `Cuándo votó` + caption `Cada barra agrupa las votaciones de un trimestre por sentido del voto. No representa una tendencia.`
  - **Anti-insinuación**: cero superlativo / ranking / léxico causal en la superficie; el chart representa el registro entero (global), no una faceta.

## Verification

- `npx vitest run` → 712/712 verde; `npx tsc --noEmit` → exit 0.
- `wrangler deployments status` → `17affbf3` al 100% (2026-07-08T03:07:48Z).
- curl smoke 5 rutas → 200; heading `Cuándo votó` count 1 en `/parlamentario/D1012`; caption factual count 1; empty-state count 0; sin 500.
- Arrastre F38: `Invalid Date` count 0, `1 parlamentarios` count 0.
- `Temp/votos-chart-47-evidencia.png` existe (653 KB); inspección visual confirma stacked-por-trimestre + leyenda NOUN + colores semánticos (no petróleo) + copy factual.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `save_screenshot` resuelve rutas relativas contra el perfil BrowserOS, no el repo**
- **Found during:** Task 3 (captura de evidencia).
- **Issue:** `save_screenshot` con `path: "Temp/..."` reportó `SHOT_OK` pero escribió el archivo bajo `C:\Users\Carlo\AppData\Local\Chromium\User Data\.browseros\Temp\`, no en el repo. El helper `reshot-votos.mjs` no falló, pero el artefacto no quedaba donde el verify lo espera.
- **Fix:** Tras el shot, copiar el PNG desde el directorio del perfil BrowserOS a `Temp/votos-chart-47-evidencia.png` del repo. También usé `format: "jpeg"` (como el reshot2 de 38-03 que sí persistía) en vez de `png`.
- **Files modified:** Temp/votos-chart-47-evidencia.png (copiado al repo).
- **Verification:** `node -e "fs.existsSync(...)"` → exit 0; `git check-ignore` → no ignorado; commiteado en 2e7adb8.

**2. [Rule 3 - Blocking] git-bash mangling de la ruta same-origin del iframe**
- **Found during:** Task 3 (primer intento del helper).
- **Issue:** git-bash convirtió el argumento de ruta `/parlamentario/D1012#votos` en `C:/Program Files/Git/parlamentario/D1012#votos` (POSIX path conversion), rompiendo el `src` del iframe → `contentDocument` null.
- **Fix:** `export MSYS_NO_PATHCONV=1` antes de invocar el helper (mismo gotcha documentado en `reshot2.mjs`).
- **Files modified:** ninguno (invocación, no código).
- **Verification:** segundo run → `inject: ok:https://…/parlamentario/D1012#votos` + `expand: CLICKED:Ver detalle (141)` + `recharts:yes`.

---

**Total deviations:** 2 auto-fixed (2 blocking de tooling/entorno).
**Impact on plan:** Cero cambio en el producto ni scope creep — ambos son ajustes de la mecánica de captura de evidencia. El chart, el deploy y el smoke salieron según lo escrito.

## Threat Flags

None — cero superficie nueva. El chart deriva de `votos_de_parlamentario` ya público (T-47-05 accept: PII-safe, confirmadas). Cero dependencia nueva (T-47-SC accept: Recharts ya instalado). Gate verde antes del deploy (T-47-04 mitigado). El agente NO aplicó DDL alguna (0049 sigue siendo checkpoint operador de F38, fuera de esta fase).

## Notes for Next Plan

- VIZ-02 EN VIVO en PROD (versión `17affbf3`). Los fixes F38 quedaron publicados en el mismo deploy.
- El checkpoint operador de F38 (apply RPC 0049) sigue **pendiente y aparte** — NO es parte de esta fase.
- Fase 47 lista para el checkpoint human-verify de fin de fase (evidencia visual + smoke + deploy ya reunidos).

## Self-Check: PASSED

- Files: 2/2 FOUND (Temp/votos-chart-47-evidencia.png, Temp/reshot-votos.mjs).
- Commits: 1/1 FOUND (2e7adb8).
- Deploy: 17affbf3 al 100% confirmado.
