---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 10
subsystem: ingest
tags: [rss, news, rate-limit, cli, r2, outlet-slug, gap-closure]

requires:
  - phase: 132-08
    provides: buildNewsDeps con DailyCache real (CR-01), NewsCacheRequeridaError
  - phase: 132-09
    provides: contarPorCausa exacto, carga-run/writer PROD
provides:
  - Gate cross-host >=minIntervalMs envolviendo el rateLimiter de buildNewsDeps (WR-03)
  - assertFeedUrl invocado en endpoints() del camino real, no solo en su test (WR-07)
  - NewsConnector con feeds inyectables por constructor (WR-01)
  - validateShape acepta EXCLUSIVAMENTE RSS 2.0, Atom <feed> rechazado (WR-14)
  - run-news-cli con --feeds/--dry-run/--etapa1/--etapa2/--from-r2 honestos y fail-closed
    (WR-01/02/06/08/09/10/11, IN-03)
  - R2_PATH_RE derivado de FEEDS validando --from-r2, contenidoHash ya no ""
  - NewsR2RequeridoError lista las variables R2_* faltantes por nombre
  - FeedDef.outlet renombrado a FeedDef.display; noticia.outlet = slug único en código y en PROD
affects: [133, 134, 135, 137]

tech-stack:
  added: []
  patterns:
    - "Gate global cross-host inyectable (sleepFn/nowFn) que ENVUELVE el rateLimiter en vez de reemplazarlo"
    - "Validación cruzada de flags CLI ANTES de tocar red/DB, con excepción explícita para conector inyectado (tests)"
    - "R2_PATH_RE derivado de FEEDS.map(f => f.slug).join('|') — nunca escrito a mano"

key-files:
  created: []
  modified:
    - packages/news/src/connector-news.ts
    - packages/news/src/connector-news.test.ts
    - packages/news/src/run-news-cli.ts
    - packages/news/src/run-news-cli.test.ts
    - packages/news/src/replay.test.ts
    - packages/news/src/feeds.ts

key-decisions:
  - "El gate cross-host vive en connector-news.ts (buildNewsDeps), no en @obs/ingest — D-132-B prohíbe tocar el framework compartido en esta fase"
  - "--dry-run sin --from-r2 lanza SOLO cuando main() va a construir un NewsConnector real (opts.conector == null); con conector inyectado (tests CR-01) la regla no aplica, porque el test double ya controla el efecto"
  - "--etapa2 sin --from-r2 lanza en vez de completar con descargados=0: Etapa 1 nunca corrió, así que 'nada que cargar' es determinista, no un caso runtime a tolerar"
  - "No se agrega un check(outlet in (...)) al schema: el congelamiento correcto vive en feeds.ts (Object.freeze + test); un check en DB obligaría una migración por cada medio nuevo"
  - "Un r2Path/slug que no resuelve contra FEEDS lanza NewsCliArgsError en vez de fabricar un outlet 'desconocido' — dato corrupto es preferible detenerlo, no inventarle un vocabulario"

patterns-established:
  - "Mutación documentada por WR en el SUMMARY: quitar la protección, correr el test target, confirmar FALLA, revertir, confirmar PASA"

requirements-completed: [NEWS-01, NEWS-02]

duration: 55min
completed: 2026-08-05
---

# Phase 132 Plan 10: Gap Closure — régimen de red y honestidad del CLI Summary

**Gate cross-host real en NewsConnector, CLI con flags que dejan de mentir (--feeds/--dry-run/--etapa2/--from-r2), y `noticia.outlet` unificado a slug en código y en las 25+245 filas ya materializadas en PROD.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-05T17:26:00Z (primer test run)
- **Completed:** 2026-08-05T18:20:00Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- **WR-03** cerrado: `buildNewsDeps` envuelve el `rateLimiter` con un gate global (`sleepFn`/`nowFn`
  inyectables) que espera ≥`minIntervalMs` entre requests aunque cambien de host — el "delay entre
  feeds" del SC1 dejó de depender de que 5 hosts distintos coincidieran por accidente.
- **WR-07** cerrado: `assertFeedUrl` se invoca dentro de `endpoints()` en el camino real; un feed
  `http://` lanza antes de generar un `RequestSpec`.
- **WR-01** cerrado en dos capas: `NewsConnector` acepta un subconjunto de `feeds` por constructor,
  y `run-news-cli.ts` pasa `feedsPedidos` directo al constructor — el filtrado posterior de `refs`
  (que pedía los 5 igual y descartaba después) fue eliminado.
- **WR-14** cerrado: `validateShape` exige `<rss>`; un documento Atom (`<feed>`) lanza con un
  mensaje que dice explícitamente "RSS 2.0".
- **WR-02/WR-06/WR-08/WR-09/WR-10/WR-11/IN-03** cerrados en `run-news-cli.ts`: `--etapa1`+`--etapa2`
  mutuamente excluyentes; `--dry-run` sin `--from-r2` (y sin conector de test) lanza en vez de
  seguir golpeando red/R2; `--etapa2` solo sin `--from-r2` lanza (nunca "descargados=0" silencioso);
  cualquier argumento sin `--` (typo) falla cerrado con exit 2; `--from-r2` valida contra
  `R2_PATH_RE` derivado de `FEEDS` y deriva `contenidoHash` del sha capturado (ya no `""`);
  `NewsR2RequeridoError` lista las 4 variables R2 faltantes por nombre; `slugDesdeR2Path` acepta
  `[a-z0-9-]+`; el resumen por causa ya se confirmó correcto (132-09).
- **WR-04** cerrado: `FeedDef.outlet` → `FeedDef.display` (ningún call-site puede confundir nombre
  humano con slug); ambos sitios del CLI pasan `feed.slug` a `parseRss`; PROD actualizado con un
  UPDATE parametrizado de una transacción — 25 filas en `noticia`, 245 en `noticia_url_vista`,
  composición y totales verificados intactos.

## Task Commits

1. **Task 1: NewsConnector — gate cross-host, assertFeedUrl real, feeds inyectables, RSS 2.0** -
   `a254f4f` (feat)
2. **Task 2: run-news-cli — flags honestos** - `d81223a` (feat)
3. **Task 3: outlet = slug (código + PROD)** - `f5e4f29` (feat)

_No hubo commits de plan-metadata separados en este SUMMARY; se documentan aquí antes del commit
final de cierre._

## Files Created/Modified

- `packages/news/src/connector-news.ts` — gate cross-host, `assertFeedUrl` en `endpoints()`,
  `feeds` inyectable por constructor, `validateShape` RSS-2.0-only.
- `packages/news/src/connector-news.test.ts` — 11 tests nuevos (26 totales) cubriendo gate,
  assertFeedUrl, feeds inyectables, contrato RSS 2.0.
- `packages/news/src/run-news-cli.ts` — validación cruzada de flags, `R2_PATH_RE`,
  `NewsR2RequeridoError` con nombres, `slugDesdeR2Path` `[a-z0-9-]+`, `feed.slug` en ambos sitios.
- `packages/news/src/run-news-cli.test.ts` — 19 tests nuevos (32 totales) cubriendo WR-01/02/04/06/
  09/10/11/IN-03.
- `packages/news/src/replay.test.ts` — `R2_PATH` corregido a un sha256 hex de 64 caracteres válido
  (el literal `deadbeef` ya no matchea `R2_PATH_RE`).
- `packages/news/src/feeds.ts` — `FeedDef.outlet` → `FeedDef.display` en los 5 feeds.

## Decisions Made

Ver `key-decisions` en el frontmatter. La más relevante para fases futuras: el gate cross-host
vive en `@obs/news`, no en `@obs/ingest` — cualquier otro conector con múltiples hosts que necesite
el mismo piso deberá replicar el patrón (o esperar a que D-132-B se reabra).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `makeWiredConnector` (run-news-cli.test.ts, wiring de 132-08) hacía timeout tras agregar el gate real**
- **Found during:** Task 1
- **Issue:** El gate cross-host de `buildNewsDeps` (default `minIntervalMs: 2500`, `sleepFn` real)
  ahora espera de verdad entre los 5 feeds cuando no se inyecta `minIntervalMs`. El test
  "control positivo apareado: lookup=false" de 132-08 construye deps reales vía `buildNewsDeps`
  sin overridear `minIntervalMs`, y el timeout de vitest (5s) era menor que los 4×2.5s del gate.
- **Fix:** Se agregó `minIntervalMs: 0` a esa construcción de deps — el test mide el wiring de
  `DailyCache`, no el gate, así que inertizarlo es correcto.
- **Files modified:** `packages/news/src/run-news-cli.test.ts`
- **Verificación:** `pnpm --filter @obs/news test` verde (179 → 181 tests tras Task 3).
- **Committed in:** `a254f4f` (Task 1 commit)

**2. [Rule 1 - Bug] `replay.test.ts` usaba `R2_PATH` con un sha inválido**
- **Found during:** Task 2
- **Issue:** `R2_PATH = "news/rss-latercera/2026-08-05/deadbeef.xml"` — `deadbeef` no es un
  sha256 hex de 64 caracteres; con `R2_PATH_RE` (WR-09) recién agregado, `main({ fromR2: R2_PATH })`
  pasó a lanzar `NewsCliArgsError` en vez de completar el replay que el test SC3 necesita probar.
- **Fix:** `R2_PATH` ahora usa `"deadbeef".repeat(8)` (64 caracteres hex válidos).
- **Files modified:** `packages/news/src/replay.test.ts`
- **Verificación:** `pnpm --filter @obs/news exec vitest run src/replay.test.ts` — 4/4 verdes.
- **Committed in:** `d81223a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, ambos causados por el propio endurecimiento del plan
sobre tests pre-existentes de 132-08/132-07).
**Impact on plan:** Ambos fixes necesarios para que la suite completa del paquete siguiera verde
tras cerrar WR-03/WR-09. Sin scope creep — ningún comportamiento nuevo, solo destrabar tests que el
propio gap-closure volvió obsoletos en su fixture.

## Mutaciones registradas (verificación)

Las 7 mutaciones exigidas por el plan se ejecutaron manualmente (Edit → correr test target →
confirmar FALLA + control positivo sigue PASANDO → revertir → confirmar PASA de nuevo):

| # | WR | Mutación | Test que cae | Control positivo apareado |
|---|----|----------|---------------|----------------------------|
| 1 | WR-03 | `rateLimiter: gatedRateLimiter` → `overrides.rateLimiter ?? rateLimiter` (gate pelado) | "sleepFn 4 veces ≥2000" | "minIntervalMs=0 ⇒ 0 sleepFn, 5 requests" sigue pasando |
| 2 | WR-07 | Quitar `assertFeedUrl(f.url)` de `endpoints()` | "feed http:// lanza" | "5 feeds https ⇒ 5 specs" sigue pasando |
| 3 | WR-01 (connector) | `endpoints()` usa `FEEDS` en vez de `this.feeds` | "1 feed ⇒ endpoints().length===1" | (ambos tests de este describe caen, correcto: la mutación rompe el contrato base) |
| 4 | WR-06 | `if (dryRun && ...)` reemplazado por `if (false)` | "dry-run sin from-r2 lanza" (timeout — intenta red real) | "dry-run con from-r2, 0 fetches" sigue pasando |
| 5 | WR-09 | `if (opts.fromR2 != null && !R2_PATH_RE.test(...))` con `false &&` prefijo | "otra-fuente/... lanza NewsCliArgsError" (cae con error distinto: `fetch prohibido`) | "clave válida ⇒ contenidoHash derivado" sigue pasando |
| 6 | WR-01 (cli) | `new NewsConnector(deps, feedsPedidos)` → `new NewsConnector(deps)` | ambos tests de constructor-args caen | — (mutación rompe el paso del argumento en sí, esperado) |
| 7 | WR-04 | `parseRss(xml, feed.slug)` → `parseRss(xml, feed.display)` en la rama `--from-r2` | "outlet === feed.slug" (recibe "La Tercera" en vez de "latercera") | "caso negativo slugs∩displays=∅" sigue pasando |

Todas revertidas tras confirmar el fallo; el estado final del código es el commiteado.

## Issues Encountered

- **pnpm 11.3.0 en Windows normaliza el exit code de `pnpm --filter <pkg> exec` a `1`** para
  cualquier fallo del proceso hijo, incluso cuando el proceso hijo sale con un código distinto
  (confirmado reproduciendo con `node -e "process.exit(3)"` → pnpm reporta `rc=1`, aunque su propio
  mensaje de error dice `Command failed with exit code 3`). El script de `<verify>` de la Task 2
  exige `rc -eq 2` corriendo exactamente `pnpm --filter @obs/news exec tsx ... -- -dry-run`; bajo
  este pnpm/entorno esa invocación específica devuelve `rc=1`, no `2`. Verificado por separado
  ejecutando `tsx` directamente dentro de `packages/news` (sin el wrapper `--filter`): el proceso
  real sale con **exit 2** y el mensaje `argumento inválido (se esperaba un flag "--..."): -dry-run`
  — el comportamiento del CLI es el correcto y literal que pide el plan; la discrepancia es
  exclusivamente del wrapper `pnpm --filter ... exec` de este entorno, no del código. No es
  auto-fixable (Rule 3, exclusión de package manager) ni una decisión de código: se documenta como
  hallazgo de entorno para que el verificador del plan lo tenga en cuenta.
- `pnpm typecheck` (raíz) verde, `pnpm guards` (raíz + 3 sub-paquetes) 388/388 verde,
  `pnpm --filter @obs/news test` (paquete tocado por este plan) 181/181 verde, y `pnpm test` de
  raíz (todo el monorepo, corrido en background) 1799/1799 verde en 121 archivos — sin
  regresiones fuera de `@obs/news`.

## Known Stubs

Ninguno — no se introdujeron datos vacíos hardcodeados ni placeholders.

## Threat Flags

Ninguno — las 5 mitigaciones del `threat_model` (T-132-36..40) quedaron cubiertas por los cambios
de este plan; no se detectó superficie nueva fuera de lo declarado.

## User Setup Required

None - no external service configuration required. La UPDATE de PROD se ejecutó con
`SUPABASE_DB_URL` ya presente en `.env` del root.

## Next Phase Readiness

- `@obs/news` queda con el régimen de red (SC1) y el contrato de `outlet` (WR-04) cerrados; las
  fases 134/135/137 que hagan joins sobre `noticia.outlet` ya encuentran un solo vocabulario
  (slug) tanto en el código nuevo como en las filas de PROD.
- Deuda documentada, no resuelta acá (fuera de alcance por D-132-B): un feed que no valida su
  `validateShape` sigue abortando la corrida completa vía `BaseConnector.run()` — exigiría tocar
  `@obs/ingest`.
- El discrepancy de exit-code de `pnpm --filter ... exec` en este entorno Windows queda como nota
  para cualquier plan futuro que dependa de exit codes exactos vía ese wrapper.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*

## Self-Check: PASSED

All modified files and task commits (a254f4f, d81223a, f5e4f29) confirmed present via `git log`
and filesystem check.
