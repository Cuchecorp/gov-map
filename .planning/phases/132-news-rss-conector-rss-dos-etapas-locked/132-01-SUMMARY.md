---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 01
subsystem: infra
tags: [vitest, workspace, rss, allowlist, ssrf, ingest, fetcher, robots, rate-limiter]

requires: []
provides:
  - "@obs/news paquete linkeado al workspace, no CI-DARK, con tsconfig references + typecheck verde"
  - "FEEDS congelado (5 medios directos, D-132-A) + NEWS_HOSTS derivado"
  - "allowlist-news.ts scoped (extraHosts) que NUNCA toca DEFAULT_ALLOWED_SUFFIXES"
  - "5 fixtures XML reales capturados con el Fetcher del framework (riesgo A4 descartado)"
affects: [132-02, 132-04, 132-05, 132-06, 132-07]

tech-stack:
  added: []
  patterns:
    - "allowlist scoped por extraHosts (patrón allowlistConServel de packages/dinero)"
    - "src/index.ts placeholder para satisfacer TS18003 en composite:true hasta que 132-06 lo reemplace"
    - "sleep explícito de 3s entre requests EN SERIE del probe cuando los hosts difieren (HostRateLimiter solo serializa por-host)"

key-files:
  created:
    - packages/news/package.json
    - packages/news/tsconfig.json
    - packages/news/vitest.config.ts
    - packages/news/src/index.ts
    - packages/news/src/feeds.ts
    - packages/news/src/feeds.test.ts
    - packages/news/src/allowlist-news.ts
    - packages/news/src/allowlist-news.test.ts
    - packages/news/src/probe-feeds.ts
    - packages/news/src/fixtures.test.ts
    - packages/news/src/__fixtures__/biobiochile.xml
    - packages/news/src/__fixtures__/cooperativa.xml
    - packages/news/src/__fixtures__/latercera.xml
    - packages/news/src/__fixtures__/lacuarta.xml
    - packages/news/src/__fixtures__/exante.xml
  modified:
    - tsconfig.json

key-decisions:
  - "El comando literal del plan para verificar el link del workspace (`node -e \"import('@obs/ingest')...\"`) no puede correr con node plano: @obs/ingest resuelve por imports TS extensionless que solo tsx puede resolver. Se corrió con `tsx -e` en su lugar (mismo paquete devDependency que ya existe en el package.json planeado); no afecta el criterio (probar que el symlink resuelve de verdad)."
  - "latercera.xml y lacuarta.xml (100 <item> cada uno, >300KB) se recortaron a los primeros 20 <item> conservando <channel> y metadatos, según la regla F-9 del plan."
  - "El probe agrega un sleep(3000) explícito EN SERIE entre cada request, además del HostRateLimiter: HostRateLimiter solo serializa por-host, y los 5 feeds son 5 hosts distintos — sin el sleep explícito los requests habrían salido con <1s entre sí (verificado y corregido en la primera corrida)."

requirements-completed: [NEWS-01, NEWS-02]

duration: 55min
completed: 2026-08-05
---

# Phase 132 Plan 01: Scaffold @obs/news + feeds congelados + probe A4 Summary

**Paquete @obs/news linkeado al workspace (no CI-DARK), 5 feeds de prensa congelados
(D-132-A) con allowlist scoped, y riesgo A4 descartado con los 5 fixtures XML reales
capturados por el Fetcher de Node del framework.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-05T08:40:00Z (aprox.)
- **Completed:** 2026-08-05T08:51:00Z
- **Tasks:** 3/3
- **Files modified:** 15 creados, 1 modificado (tsconfig.json raíz)

## Accomplishments

- `@obs/news` existe, resuelve en `node_modules` vía pnpm workspace, y `pnpm typecheck`
  (raíz, `tsc -b`) sale 0 con el nuevo reference.
- Anti-CI-DARK probado por falla inducida: con un test que falla a propósito dentro de
  `packages/news`, `pnpm test` de la RAÍZ sale 1; sin él, sale 0 — el paquete SÍ es
  recorrido por la suite raíz.
- `FEEDS` (5 medios: biobiochile, cooperativa, latercera, lacuarta, exante) congelado con
  `Object.freeze`, con 19 tests, incluida la aserción anti-Google por comportamiento
  (D-132-A: Google News RSS Search descartado — `news.google.com/robots.txt` prohíbe `/rss/`).
- `allowlist-news.ts` scoped por `extraHosts`; nunca toca `DEFAULT_ALLOWED_SUFFIXES`.
  Probado que el default de `@obs/ingest` NO cubre los 5 hosts, que un host arbitrario y
  `news.google.com` son rechazados, y que `http://` es rechazado (aserción https explícita).
- **Riesgo A4 (WAF podría bloquear al Fetcher de Node) DESCARTADO**: los 5 feeds
  respondieron HTTP 200 al `Fetcher` real de `@obs/ingest` en la corrida LIVE, con
  RobotsGuard verificando robots.txt antes de cada fetch y ≥3s entre requests consecutivos
  (incluso entre hosts distintos).

## Task Commits

1. **Task 1: Scaffold del paquete @obs/news linkeado al workspace y NO CI-DARK** - `f8b9acc` (feat)
2. **Task 2: feeds.ts congelado (5 medios, D-132-A) + allowlist scoped con test** - `1d6cedd` (feat)
3. **Task 3: [RIESGO A4] Probe con Fetcher REAL de Node + captura de los 5 fixtures** - `9c099fe` (feat)

## Files Created/Modified

- `packages/news/package.json` — workspace package `@obs/news`, deps `@obs/core`, `@obs/ingest`, `fast-xml-parser`, `zod`, `@supabase/supabase-js`
- `packages/news/tsconfig.json` — composite, references a `../core` y `../ingest`, sin `paths`
- `packages/news/vitest.config.ts` — analog literal de tramitacion, `passWithNoTests: true`
- `packages/news/src/index.ts` — barrel PLACEHOLDER (reemplazado por 132-06)
- `packages/news/src/feeds.ts` — `FEEDS` (5 entradas Object.freeze) + `NEWS_HOSTS`
- `packages/news/src/feeds.test.ts` — 10 tests, congela URLs/hosts + aserción anti-Google
- `packages/news/src/allowlist-news.ts` — `allowlistNews()` + `assertFeedUrl()` (https forzado)
- `packages/news/src/allowlist-news.test.ts` — 9 tests: 5 hosts pasan, default no cubre, host arbitrario/google rechazado, http rechazado
- `packages/news/src/probe-feeds.ts` — script LOCAL de probe (RobotsGuard + HostRateLimiter + Fetcher reales, sleep explícito 3s)
- `packages/news/src/fixtures.test.ts` — 6 tests: FEEDS.length === n fixtures, 1 por slug
- `packages/news/src/__fixtures__/*.xml` — 5 XML crudos reales (latercera/lacuarta recortados a 20 items, F-9)
- `tsconfig.json` (raíz) — agregado `{ "path": "./packages/news" }`

## Decisions Made

- **Comando de verificación del symlink corregido (no arquitectural):** el `<automated>` de
  T1 pedía `node -e "import('@obs/ingest')..."`. `@obs/ingest` (y todos los paquetes TS del
  monorepo) exportan `src/index.ts` sin extensión en los imports internos
  (`from "./base-connector"`), que **node plano no puede resolver** vía ESM (requiere
  extensión explícita o un loader). Se corrió el mismo chequeo con `tsx -e` (mismo
  `devDependency` ya declarado en el `package.json` del plan) — prueba exactamente lo
  mismo (que el symlink resuelve un export real de `@obs/ingest`), solo con el runtime
  correcto para TS extensionless. No es una decisión arquitectónica: es la corrección de
  un comando de verificación que no podía ejecutarse tal como estaba escrito.
- **Rate-limit del probe: sleep explícito además de HostRateLimiter.** `HostRateLimiter`
  solo serializa requests al MISMO host; los 5 feeds son 5 hosts distintos, así que sin un
  delay adicional los 5 requests habrían salido con <1s entre sí (violando el régimen
  ≥3s "EN SERIE" de CLAUDE.md/132-01-PLAN.md). Se agregó `sleep(3000)` entre cada request
  del loop del probe (verificado: la primera corrida sin el sleep mostró gaps de ~50-600ms
  entre hosts distintos; corregido y re-corrido con gaps de ~3.0-3.2s).
- **Fixtures >300KB recortados (F-9):** `latercera.xml` (557KB) y `lacuarta.xml` (567KB)
  traían 100 `<item>` cada uno; se recortaron a los primeros 20 conservando `<channel>` y
  metadatos, quedando en 101KB y 133KB respectivamente. `biobiochile` (180KB, 20 items),
  `cooperativa` (46KB, 15 items) y `exante` (79KB, 10 items) se commitearon enteros, sin
  recortar.

## Riesgo A4 — Veredicto

**Fetcher de Node: OK para los 5 feeds.** Corrida LIVE única, 2026-08-05, en serie con
≥3s entre requests (incluso cross-host):

| slug | status | bytes (crudo) | sha256(8) | nItems | timestamp |
|------|--------|---------------:|-----------|-------:|-----------|
| biobiochile | 200 | 180685 | 814edbbe | 20 | 2026-08-05T12:49:31.044Z → 31.197Z |
| cooperativa | 200 | 46905 | cdd8910f | 15 | 2026-08-05T12:49:34.199Z → 34.257Z |
| latercera | 200 | 557375 (crudo, recortado a 101148 en fixture) | ddfdca12 | 100 | 2026-08-05T12:49:37.258Z → 37.339Z |
| lacuarta | 200 | 566790 (crudo, recortado a 133013 en fixture) | 5ff2478f | 100 | 2026-08-05T12:49:40.352Z → 40.431Z |
| exante | 200 | 79609 | c5994d70 | 10 | 2026-08-05T12:49:43.441Z → 44.533Z |

Delay observado entre `req-start` consecutivos: 31.044→34.199 (3.155s), 34.199→37.258
(3.059s), 37.258→40.352 (3.094s), 40.352→43.441 (3.089s). Todos ≥3s.

5/5 feeds vivos. Ningún host devolvió 403/406/429/5xx. Ningún fixture contiene
`<!DOCTYPE html`. No se aplicó la rama de fallo (piso duro 3 feeds no se activó).

## Anti-CI-DARK (T1) — evidencia por SUMMARY (no re-derivable por comando)

- Con `packages/news/src/__cidark.test.ts` conteniendo `expect(1).toBe(2)`: `pnpm test`
  (raíz) → **exit 1** (falla en `@obs/news`, el resto de paquetes siguió corriendo verde).
- Borrado el archivo: `pnpm --filter @obs/news test` → **exit 0**, `No test files found`
  (esperado en ese punto de T1, antes de que Task 2/3 agregaran tests reales).

## Mutaciones registradas (Task 2, anti-vacuo)

Las 4 mutaciones exigidas por el plan se ejecutaron y revirtieron; todas hicieron caer el
test correspondiente:

1. Cambiar una letra en la URL de `latercera` (`.com` → `.cx`) → `feeds.test.ts`: 2 tests
   caen (`latercera — URL exacta`, `NEWS_HOSTS — los 5 hosts exactos`). Revertido.
2. Quitar `NEWS_HOSTS` del merge en `allowlistNews` → `allowlist-news.test.ts`: 5 tests
   caen (los 5 `assertFeedUrl` por slug). Revertido.
3. Quitar la aserción `https:` en `assertFeedUrl` → `allowlist-news.test.ts`: 1 test cae
   (caso `http://www.latercera.com/...`). Revertido.
4. Agregar una 6ª entrada a `FEEDS` con host `news.google.com` → `feeds.test.ts`: 4 tests
   caen (`tiene exactamente 5 entradas`, `NEWS_HOSTS — los 5 hosts exactos`, las 2
   aserciones anti-Google). Revertido.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comando de verificación del symlink corregido: `tsx` en vez de `node` plano**
- **Found during:** Task 1
- **Issue:** El `<automated>` del plan usa `pnpm --filter @obs/news exec node -e "import('@obs/ingest')..."`. Falla con `ERR_MODULE_NOT_FOUND` porque `@obs/ingest/src/index.ts` importa módulos internos sin extensión (`from "./base-connector"`), que node plano no resuelve vía ESM nativo (afecta a TODOS los paquetes TS-fuente del monorepo, no solo a `@obs/news`).
- **Fix:** Se corrió el mismo chequeo con `tsx -e` (ya declarado como devDependency en el `package.json` planeado para T1) en vez de `node -e`. Prueba exactamente lo mismo: que el symlink del workspace resuelve un export real (`assertAllowedUrl`) de `@obs/ingest`.
- **Files modified:** ninguno (solo el comando de verificación ad-hoc, no forma parte del `<automated>` comprometido en el commit)
- **Verification:** `pnpm --filter @obs/news exec tsx -e "import('@obs/ingest').then(m=>{if(typeof m.assertAllowedUrl!=='function')process.exit(1);console.log('OK')})"` → imprime `OK`
- **Committed in:** f8b9acc (parte del commit de Task 1; el `<automated>` real del plan, que solo verifica `pnpm typecheck` y artefactos, sí se corrió y pasó tal cual)

**2. [Rule 2 - Missing Critical] Sleep explícito de 3s entre requests del probe (Task 3)**
- **Found during:** Task 3
- **Issue:** La primera corrida del probe mostró gaps de 50-600ms entre requests a hosts DISTINTOS (`HostRateLimiter` solo serializa por-host — el régimen ≥3s "EN SERIE" del plan/CLAUDE.md exige el delay entre TODOS los requests consecutivos del probe, no solo entre requests al mismo host).
- **Fix:** Se agregó `sleep(3000)` explícito antes de cada request del loop (excepto el primero), además de seguir llamando a `HostRateLimiter.wait(host)`.
- **Files modified:** packages/news/src/probe-feeds.ts
- **Verification:** re-corrida con gaps de 3.05-3.16s entre `req-start` consecutivos (ver tabla arriba); fixtures regenerados desde cero con esta corrida corregida (la primera corrida, sin el sleep, no se commiteó — se sobrescribió antes del commit único de Task 3).
- **Committed in:** 9c099fe (Task 3)

---

**Total deviations:** 2 auto-fixed (1 blocking - comando de verificación, 1 missing critical - rate-limit del probe)
**Impact on plan:** Ninguno de los dos afecta el alcance ni los artefactos entregables del plan. El primero es una corrección de comando de diagnóstico (no forma parte del `<automated>` comprometido). El segundo es una corrección de correctitud del régimen de ingesta respetuosa (LOCKED en CLAUDE.md) antes de que el probe tocara red por segunda vez — sin él, la primera corrida ya había violado el rate-limit contra 5 hosts de prensa reales.

## Issues Encountered

- Ninguno adicional a los documentados arriba. `pnpm install` requirió ~57s (933 paquetes
  nuevos por el symlink de `@obs/news`); sin incidentes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `@obs/news` está scaffolded, linkeado, sin `paths` prohibidos, y `pnpm typecheck` sale 0.
- Los 5 fixtures XML reales quedan disponibles para 132-02 (parser), 132-04 (conector),
  132-05 y 132-06 (barrel final que reemplaza el placeholder `src/index.ts`).
- `allowlistNews`/`assertFeedUrl`/`FEEDS`/`NEWS_HOSTS` son la base congelada que 132-02/04
  deben reusar sin reescribir su propia allowlist.
- Ningún blocker: los 5 medios están vivos y accesibles al Fetcher real (A4 descartado,
  no hay reducción del set de fuentes que arrastrar a `132-REPORTE-OPERADOR.md`).

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*
