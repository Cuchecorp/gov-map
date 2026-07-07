---
phase: 53-uxnav-auditoria-ux-navegada
plan: 05
subsystem: ops
tags: [redeploy, no-regression-gate, browseros, re-walkthrough, before-after, ux-audit, cloudflare, wrangler]

# Dependency graph
requires:
  - phase: 53-02
    provides: header-nav Red item + "Sobre" label
  - phase: 53-03
    provides: Breadcrumbs server component wired into proyecto/parlamentario/contraparte fichas
  - phase: 53-04
    provides: continuation lines on flagged empty states
  - phase: 53-01
    provides: 53-UX-AUDIT.md with 3 P0 + archived before-screenshots
provides:
  - PROD re-desplegado con los 3 fixes P0 (wrangler version 7b35b99e)
  - Re-walkthrough before/after por P0 contra el PROD re-desplegado (6 after-screenshots)
  - 53-UX-AUDIT.md CERRADO (P0 3/3 resueltos, veredicto 3 criterios orientación desktop+móvil)
  - scripts/rewalk-shot.mjs (helper harness iframe reutilizable)
affects: [Phase-54, ROADMAP-Phase-53-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No-regression gate ANTES del deploy: suite completa + tsc -b + lockdown-guard + diff-scan (sin DDL/flag/mt-12/frame-headers)"
    - "Redeploy PROD: docker-cf-build.sh (build Linux node:22, MSYS_NO_PATHCONV=1) → docker cp (OneDrive sync lag → poll hasta LANDED) → cd app && npx wrangler deploy (OAuth)"
    - "Re-walkthrough harness iframe (Pista B) vía scripts/rewalk-shot.mjs: inject iframe width exacto → sleep SSR+hidratación → save_screenshot fullPage jpeg; móvil 390 = evidencia canónica (desktop 1280 recorta al viewport del padre 772px)"
    - "Empty-state /buscar reproducible determinísticamente vía page alto (&page=50 → slice vacío → rama 'Sin resultados')"

key-files:
  created:
    - scripts/rewalk-shot.mjs
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/fix-F01-after-390.jpg
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/fix-F01-after-1280.jpg
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/fix-F02-after-proyecto-390.jpg
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/fix-F02-after-proyecto-1280.jpg
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/fix-F02-after-parlamentario-390.jpg
    - .planning/phases/53-uxnav-auditoria-ux-navegada/ux-evidence/fix-F03-after-390.jpg
  modified:
    - .planning/phases/53-uxnav-auditoria-ux-navegada/53-UX-AUDIT.md

key-decisions:
  - "F-03 empty-state disparado con &page=50 (slice de página vacío) porque la búsqueda semántica siempre devuelve vecinos → una query 'sin match' no vacía el estado; el page-alto es determinista y honesto (es una página realmente vacía)"
  - "Móvil 390 declarado evidencia canónica: el harness iframe recorta el fullPage al ancho del viewport del padre (772px CSS) → los shots 1280 confirman layout desktop pero el 390 muestra los 3 fixes completos sin recorte"
  - "F-03 before = ausencia de línea verificada por código + test (resultados-error.test.tsx), no screenshot dedicado: el empty-state no era reproducible en vivo en Plan 01 y el estado defectuoso desapareció con el deploy"

requirements-completed: [UX-01]

# Metrics
duration: ~30min
completed: 2026-07-06
---

# Phase 53 Plan 05: Gate no-regresión + redeploy PROD + re-walkthrough Summary

**Suite 563/563 + tsc + lockdown-guard verdes ANTES del redeploy; PROD re-desplegado a `7b35b99e` con los 3 fixes de orientación; re-walkthrough before/after demuestra cada P0 resuelto (nav Red, breadcrumbs, línea de continuación) desktop+móvil, cerrando 53-UX-AUDIT.md con P0 3/3.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-06
- **Tasks:** 3
- **Files:** 1 modified (audit report) + 7 created (6 screenshots + 1 helper)

## Accomplishments

- **Task 1 — Gate no-regresión (verde ANTES del deploy):** `pnpm --dir app test -- --run` → **563/563 tests verdes (52 files)**, incluye `lockdown-guard` (8 tests, escaneo `.from()` PII + `.rpc` no-allowlisted) y banned-vocab negative-match; `tsc -b` limpio. Diff de la fase (19 archivos, +562/-14) verificado: **CERO** migración/DDL en `supabase/`, **CERO** flip de flags `*_PUBLIC_ENABLED`, **CERO** `X-Frame-Options`/CSP frame-ancestors (Assumption A4 — PROD sigue frameable), y **CERO** movimiento de fronteras `mt-12` (las únicas coincidencias son comentarios que confirman que `mt-12` NO se mueve).
- **Task 2 — Redeploy PROD:** `npx wrangler whoami` autenticado (OAuth vigente, sin auth gate). Build Linux vía `docker-cf-build.sh` (node:22, `MSYS_NO_PATHCONV=1` para la ruta `/host`) → `BUILD_OK` → `docker cp` del `.open-next` → `cd app && npx wrangler deploy`. **Nueva versión: `7b35b99e-7347-4d46-8231-8bb0a78b0429`**. Smoke curl post-deploy: `/`, `/buscar`, `/proyecto/14309-04`, `/parlamentario/D1012`, `/red?seed=D1012`, `/agenda` → **200**; `/red` sirve con `force-dynamic` (no 500 con el flag ON). HTML servido confirma nav con `href="/red">Red` + "Sobre" y breadcrumbs en ambas fichas.
- **Task 3 — Re-walkthrough before/after + cierre:** 6 after-screenshots capturados con el harness iframe (Pista B) contra el PROD re-desplegado; Pista A (consola directa) sobre las rutas fixeadas → consola limpia salvo los 2 warnings woff2 baseline (F-05 P2); ningún link nuevo (nav Red, breadcrumbs, continuation) renderiza 404. Sección Re-walkthrough de `53-UX-AUDIT.md` llena con tabla Fix·Ruta·Before·After·Estado + veredicto de los 3 criterios de orientación (desktop+móvil) + **Cierre P0 3/3 RESUELTOS**.

## Task Commits

1. **Task 1: Gate no-regresión** — verificación, sin cambio de archivo (suite 563 + tsc + guard verdes; diff limpio).
2. **Task 2: Redeploy PROD `7b35b99e`** — anotación de versión foldada en el commit de docs de Task 3 (deploy es acción externa, no artefacto de repo).
3. **Task 3: Re-walkthrough + cierre 53-UX-AUDIT** — `637b734` (docs)

## Verificación before/after por P0

| Fix | Before (ee6b7544) | After (7b35b99e) | Estado |
|-----|-------------------|-------------------|--------|
| **F-01** nav Red + "Sobre" | `j1-01-home-390.jpg` (4 ítems, sin Red) | `fix-F01-after-390.jpg` (Buscar·Parlamentarios·Agenda·**Red** + **Sobre**), `fix-F01-after-1280.jpg` | resuelto |
| **F-02** breadcrumbs proyecto | `j2-03-proyecto-1280.jpg` (sin breadcrumb) | `fix-F02-after-proyecto-{390,1280}.jpg` (`Inicio / Proyectos / Boletín 14309-04`) | resuelto |
| **F-02** breadcrumbs parlamentario | `j3-02-parlamentario-390.jpg` (sin breadcrumb) | `fix-F02-after-parlamentario-390.jpg` (`Inicio / Parlamentarios / Boris Barrera Moreno`) | resuelto |
| **F-03** línea de continuación | (código+test; empty-state no reproducible en vivo Plan 01) | `fix-F03-after-390.jpg` ("Sin resultados" + `la agenda legislativa de la semana →`) | resuelto |

## Decisions Made

- **F-03 empty-state via `&page=50`.** La búsqueda semántica devuelve siempre los k vecinos más cercanos → una query "gibberish" (`zzxqnomatchqx`) NO vacía el estado (devolvió 20+ resultados). El disparo determinista es un número de página alto: `pageSlice.length === 0` → rama "Sin resultados" (`buscar/page.tsx:80`). Es una página realmente vacía, honesta.
- **Móvil 390 = evidencia canónica.** El harness envuelve PROD en un iframe dentro de una página oculta de 772px CSS; el `save_screenshot fullPage` recorta el ancho al viewport del padre (≈965px de imagen, no los 1280 completos). Por eso el 390 (que cabe entero) es la prueba principal de los 3 fixes; el 1280 confirma el layout desktop (breadcrumb/nav a la izquierda, visibles pese al recorte).
- **F-03 before documentado, no screenshot.** El estado defectuoso (empty-state sin línea) nunca tuvo shot dedicado en Plan 01 (no era reproducible en vivo, doc. §F-03) y desapareció con el deploy; el before queda evidenciado por el código `buscar/page.tsx:80-90` y el test `resultados-error.test.tsx`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MSYS path-conversion mangló rutas POSIX en git bash**
- **Found during:** Task 2 (docker run `/host/...`) y Task 3 (route `/` del harness → `C:/Program Files/Git/`).
- **Issue:** git bash convierte argumentos que empiezan con `/` a rutas Windows, rompiendo `docker run bash /host/docker-cf-build.sh` y el `f.src` del iframe.
- **Fix:** `export MSYS_NO_PATHCONV=1` (gotcha ya conocido en memoria del proyecto).

**2. [Rule 3 - Blocking] `save_screenshot` reporta SHOT_OK pero el archivo aparece con lag (OneDrive sync)**
- **Found during:** Task 3 (fix-F02-after-proyecto-1280.jpg no aparecía tras SHOT_OK).
- **Issue:** El directorio vive en OneDrive; el archivo se escribe pero queda brevemente indisponible al `ls`/`stat` inmediato.
- **Fix:** Poll post-escritura (`for i in $(seq 1 8); do [ -s "$OUT" ] && break; sleep 2; done`) en el helper flow. No es un fallo de captura.

**3. [Rule 1 - Bug] Primer intento de F-03 salió en blanco (Suspense streaming)**
- **Found during:** Task 3 (fix-F03-after-390.jpg de 28KB, blanco).
- **Issue:** `/buscar` usa Suspense streaming (embed+rpc ~6-9s); el `sleep 7000ms` del harness capturó antes del paint.
- **Fix:** recaptura con `wait=14000ms` → estado "Sin resultados" + línea de continuación pintados (77KB). El resto de rutas (SSR directo) no lo necesitaba.

**Total deviations:** 3 auto-fixed (Rule 3 ×2 tooling/entorno, Rule 1 ×1 timing de captura). Ningún cambio de código de aplicación en este plan (docs + evidencia + helper de tooling).

## Threat register outcome

- **T-53-05-01 (EoP, wrangler deploy):** mitigado — deploy autorizado 2026-07-06; OAuth vigente (`whoami` OK), sin login autónomo, sin auth gate necesario.
- **T-53-05-02 (Tampering, regresión):** mitigado — gate suite+tsc+guard verde ANTES del deploy; smoke curl 200 en rutas clave; diff sin DDL/flag/mt-12.
- **T-53-05-03 (DoS, frame-headers):** mitigado — verificado que el deploy NO añade X-Frame-Options/CSP frame-ancestors; PROD sigue frameable (el harness funcionó post-deploy).

## Issues Encountered

- El grafo `/red` móvil (F-04, P1) y los warnings woff2 (F-05, P2) siguen presentes por diseño → diferidos a Phase 54 (fuera del contrato de orientación de esta fase).
- Tabs pre-existentes en BrowserOS (lacuarta RSS, bcn leychile, mockup) predatan esta sesión; solo se cerraron las 2 páginas ocultas abiertas por este plan (harness + Pista A).

## User Setup Required

None — deploy completado con OAuth vigente del operador. No hay deuda de operador nueva en este plan.

## Next Phase Readiness

- **ROADMAP Phase 53 Success Criteria 2 y 4 satisfechos:** todos los P0 corregidos con suite verde + redeploy; re-walkthrough demuestra cada fix before/after; cero regresión (anti-insinuación, lockdown-guard, tsc, mt-12, gates intactos).
- **53-UX-AUDIT.md CERRADO** (P0 3/3). Backlog a Phase 54: F-04 (grafo móvil P1), F-05 (woff2 P2). Gated: F-06 (cross-link contraparte, MONEY gate).
- Fase 53 lista para verifier / cierre de fase.

---
*Phase: 53-uxnav-auditoria-ux-navegada*
*Completed: 2026-07-06*

## Self-Check: PASSED
- FOUND: .planning/phases/53-uxnav-auditoria-ux-navegada/53-05-SUMMARY.md
- FOUND: .planning/phases/53-uxnav-auditoria-ux-navegada/53-UX-AUDIT.md (Re-walkthrough + Cierre)
- FOUND: ux-evidence/fix-F0{1,2,3}-after-*.jpg (6 screenshots)
- FOUND: scripts/rewalk-shot.mjs
- FOUND commit: 637b734 (Task 3 — re-walkthrough + cierre)
- Redeploy version live: 7b35b99e (smoke 200 en rutas clave)
