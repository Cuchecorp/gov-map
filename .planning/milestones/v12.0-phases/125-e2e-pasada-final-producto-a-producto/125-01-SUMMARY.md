---
phase: 125
plan: 01
subsystem: deploy
tags: [deploy, cloudflare, opennext, docker, e2e, v12.0]
requires:
  - "HEAD de master con los fixes commiteados de 114 / 117 / 122"
  - "Docker Desktop + OAuth de wrangler del host"
provides:
  - "VERSIÓN DESPLEGADA 0ea5d97f-a172-436e-aad0-add95940ee0e — precondición bloqueante de 125-02…07"
  - "125-DEPLOY-RUNBOOK.md: secuencia verbatim + gate con números + smoke con antes/después"
affects:
  - "Worker observatorio-congreso (PROD)"
tech-stack:
  added: []
  patterns:
    - "Build OpenNext en Docker node:22-slim; deploy en el MISMO contenedor con el OAuth del host montado"
    - "Restaurar archivos de HEAD dentro del mirror (no en el repo) para que el bundle sea HEAD sin tocar el working tree del operador"
    - "grep -o | wc -l obligatorio sobre el HTML del Worker: es una sola línea, grep -c no cuenta ocurrencias"
key-files:
  created:
    - .planning/phases/125-e2e-pasada-final-producto-a-producto/125-DEPLOY-RUNBOOK.md
  modified: []
decisions:
  - "El marcador `Actualizado hace` es un control INERTE (ya era 0 pre-deploy); el discriminante real del fix de 117 es `Actualizado` 318→0 junto a `según fuente al ` 0→32"
  - "pnpm-workspace.yaml sucio se corrige SOLO en el mirror (git show HEAD:… > mirror), jamás revirtiendo el working tree del operador"
metrics:
  duration: "~50 min"
  completed: 2026-07-29
  tasks: 3
  commits: 1
---

# Phase 125 Plan 01: Deploy agrupado v12.0 a Cloudflare Summary

Deploy agrupado de los fixes ya commiteados de 114 (links internos), 117 (fechas) y 122 (lobby capa-1
+ cobertura) al Worker de PROD, con gate pre-deploy numérico y los tres fixes probados por contenido
del DOM — no por disponibilidad.

## VERSIÓN DESPLEGADA

**`0ea5d97f-a172-436e-aad0-add95940ee0e`** · 2026-07-29T21:26Z · bundle = HEAD `b4882e9`

Éste es el uuid que los planes **125-02 … 125-07** deben leer como precondición. Antes de este deploy
cualquier recorrido medía el sitio viejo.

## Qué se hizo

### Task 1 — Gate pre-deploy (antes de construir)

| check | exit | número |
|---|:--:|---|
| `pnpm --filter ./app exec tsc --noEmit` | 0 | sin diagnósticos |
| `pnpm -r exec tsc -b` | 0 | sin diagnósticos |
| `pnpm --filter ./app exec vitest run` | 0 | **1590/1590** en 107 archivos |
| `pnpm test` (root) | 0 | 18 paquetes verdes + app 107 archivos |
| 14 guards de régimen | 0 | **172 tests**, 14/14 nombrados uno por uno |

Higiene del bundle: `git diff --name-only HEAD -- app/ packages/ supabase/` → **vacío**. Los únicos
no-commiteados eran artefactos `.planning/` + `pnpm-workspace.yaml`. **Nada nuevo entró.**

**Sobre el conteo 1590:** el CONTEXT citaba 1577 (línea base de 122). 123 y 124 añadieron tests
después ⇒ 1590. El criterio del plan (≥ 1590) se cumple **exactamente**, sin ajuste a la baja.

### Task 2 — Build + deploy

Secuencia pagada de v10.0, sin variantes inventadas: robocopy a `C:\Temp\obs-build` (exit 3) → purga
de `.pnpm-store` → re-escritura de los dos helper scripts → build en `node:22-slim`
(**`BUILD EXIT: 0`**, `worker.js` 2278 bytes) → deploy en el mismo contenedor con el OAuth del host
montado en `/root/.config/.wrangler`.

Los 3 gotchas: `.pnpm-store` **re-confirmado** (estaba presente, se purgó); helper scripts borrados por
`/MIR` **re-confirmado**; wrangler sombreado **evadido por diseño** (nunca se invocó el del host).

**Flags — cero flips.** `wrangler secret list` (sólo nombres): `CRUCES`/`NET`/`VSIM` presentes;
`MONEY_PUBLIC_ENABLED` y `NOTIF_PUBLIC_ENABLED` **ausentes = OFF**. Cero `secret put`.

### Task 3 — Smoke post-deploy

10/10 rutas en **200**. Propagación limpia: se esperaron 30 s y **no hubo 500 intermitentes**, así que
no hizo falta re-comprobar.

Los tres fixes, con el PRE-deploy capturado **antes** de desplegar (antes/después medido, no recordado):

| fase | marcador | PRE | POST |
|---|---|---:|---:|
| 117 | `según fuente al ` en `/proyecto/14309-04` | 0 | **32** |
| 117 | `Actualizado` (idiom viejo) | **318** | **0** |
| 122 | `3,8` en `/proyecto/14309-04` | 0 | **2** |
| 114 | `href="/proyecto/` en `/parlamentario/D1165` | — | **23** |
| 114 | `<section id="votos" class="mt-12">` (ancla `4.1-A3-votos`) | — | presente |

La línea de 122 salió verbatim con **`3,8 %`** y **`29 jul 2026`**, exactamente lo que
`122-CRUCES-SQL.md` predijo ⇒ la cifra horneada `COBERTURA_MENCIONES_LOBBY` **sigue vigente**, no hay
que actualizarla.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docker Desktop estaba apagado**
- **Found during:** Task 2 (precondición)
- **Issue:** `docker ps` → `failed to connect to the docker API at npipe:… the daemon is running`
- **Fix:** se lanzó Docker Desktop; `docker info` → ServerVersion **29.5.2**. Cero cambios de config.
- **Commit:** `b113cfc` (documentado en runbook §2.0)

**2. [Rule 3 - Blocking] `pnpm-workspace.yaml` sucio con placeholders de pnpm 11**
- **Found during:** Task 1 (higiene del bundle)
- **Issue:** el working tree tenía `allowBuilds: {'@google/genai': set this to true or false, …}` —
  string inválido donde se espera booleano. `robocopy /MIR` espeja el **working tree**, no HEAD, así
  que ese archivo habría viajado al contenedor y roto `pnpm install --frozen-lockfile`. Además
  contradice la restricción rectora "el bundle es HEAD".
- **Fix (no destructivo):** **no** se revirtió el repo del operador. Se restauró la versión de HEAD
  **sólo dentro del mirror**: `git show HEAD:pnpm-workspace.yaml > C:/Temp/obs-build/pnpm-workspace.yaml`.
  El contenedor construye el par consistente manifest↔lockfile de HEAD; el working tree queda intacto.
- **Commit:** `b113cfc` (documentado en runbook §1.4)

### Hallazgos de método (registrados para las waves siguientes)

**3. `grep -c` es inservible sobre el HTML del Worker.** El DOM viene en **una sola línea**
(1.242.030 bytes, `wc -l` = 1) ⇒ `grep -c` devuelve como máximo 1. Todas las cifras del runbook usan
`grep -o … | wc -l`. Los planes 02-07 deben hacer lo mismo o sus conteos serán falsos.

**4. `Actualizado hace` es un control INERTE.** El criterio del plan pedía 0 y da 0, pero **ya era 0
pre-deploy**: el build viejo renderizaba `Actualizado <fecha absoluta>`, no `Actualizado hace`. El
discriminante real es `Actualizado` 318→0 + `según fuente al ` 0→32. Se documenta para que las waves
2-4 no confíen en un marcador que no distingue nada.

**5. Los guards `integ-scope` y `provider-guard` no viven en `app/lib`** sino en `packages/llm/src`:
el glob `lib/*guard*.test.ts` del plan no los alcanza. Se corrieron por separado (6 tests) y quedan
cubiertos por `pnpm test`. Registrado para que no se lea como guard faltante.

## Deuda que este plan NO cierra

- `SUPABASE_PUBLISHABLE_KEY` sigue ausente del Worker (deuda de operador desde 97/103). Sin efecto en
  Camino A.
- Los 2 ítems humanos post-deploy heredados de 122 (`/parlamentario/S1338` con dos ausencias; la
  cobertura antes del conteo) se verificaron sólo en la parte que este plan exigía; su cierre formal es
  de los planes 02-07.
- Re-lectura de las 82 filas de cruces y verificación exhaustiva de links: planes 05 y 06.

## Known Stubs

Ninguno. Este plan no escribió código: sólo un artefacto de documentación.

## Threat Flags

Ninguno. Cero superficie nueva: no se creó endpoint, ruta de auth, acceso a archivos ni cambio de
schema. `SUPABASE_DB_URL` nunca se expandió ni se ecoó; de `wrangler secret list` se leyeron **sólo
nombres**, ningún valor; cero PII; cero DDL/DML; cero `secret put`.

## Self-Check: PASSED

- `125-DEPLOY-RUNBOOK.md` existe (372 líneas) — FOUND
- `grep -c "VERSIÓN DESPLEGADA"` → 2 (encabezado §2 + tabla de cierre §4) — FOUND
- Commit `b113cfc` en el log, 1 archivo, 372 inserciones, **cero borrados** — FOUND
- `git diff --name-only HEAD -- app/ packages/ supabase/` → vacío tras el commit — FOUND
- uuid desplegado presente y real: `0ea5d97f-a172-436e-aad0-add95940ee0e` — FOUND
