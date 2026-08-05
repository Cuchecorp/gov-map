---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 07
subsystem: ingest
tags: [live-run, r2, prod, validation, handoff, psql, robots]

requires:
  - phase: 132-06
    provides: "run-news-cli.ts (CLI local Etapa1+Etapa2) + barrel final @obs/news"
provides:
  - "Evidencia real de SC1-SC4 contra R2 + Supabase PROD (no dobles)"
  - "132-VALIDATION.md completada: Per-Task Verification Map (17 filas), Wave 0 y Sign-Off marcados, nyquist_compliant:true"
  - "132-REPORTE-OPERADOR.md: handoff con números reales + D-132-A re-verificado + hallazgo SC2"
affects: []

tech-stack:
  added: []
  patterns:
    - "Idempotencia de source_snapshot vía recuperación de 23505 (source,resource,date_bucket) en SupabaseSnapshotStore — NO vía el [skip] derivado ni vía 412 de R2"

key-files:
  created:
    - .planning/phases/132-news-rss-conector-rss-dos-etapas-locked/132-REPORTE-OPERADOR.md
  modified:
    - .planning/phases/132-news-rss-conector-rss-dos-etapas-locked/132-VALIDATION.md

key-decisions:
  - "N=5 (los 5 feeds vivos congelados en 132-01: biobiochile, cooperativa, latercera, lacuarta, exante); ningún host retirado por A4"
  - "SC2 documentado como NO cumplido literalmente (ver Deviations); no se reintenta el mismo día (regimen v13), se documenta y se recomienda un parche a 132-06/136"

requirements-completed: [NEWS-01, NEWS-02]

duration: ~50min
completed: 2026-08-05
---

# Phase 132 Plan 07: Corrida LIVE de verificación (SC1-SC4) + VALIDATION + REPORTE-OPERADOR Summary

**Corrida real única contra los 5 feeds vivos escribió R2+PROD (245 ítems vistos, 25 cargados, 220 descartados por prefiltro léxico); la re-corrida inmediata reveló que el `[skip]` derivado (D-132-B) nunca puede disparar en producción real porque `cache.hasToday` es el doble no-op de `buildNewsDeps()` — SC2 no se cumple literalmente, documentado como hallazgo sin bloquear el cierre de la fase.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3 completed
- **Files modified:** 2 (1 creado, 1 modificado)

## Accomplishments

- Suite completa verde: `pnpm test` (test=0), `pnpm typecheck` (0), `pnpm guards` (0),
  `pnpm --filter @obs/news test` (0, **123 tests passed** ≥ 85 piso). `@obs/news` presente en el
  log de la raíz (no CI-DARK).
- `132-VALIDATION.md`: Per-Task Verification Map completada con **17 filas** (132-01-T1..T3,
  132-02-T1..T2, 132-03-T1..T2, 132-04-T1..T3, 132-05-T1..T2, 132-06-T1..T2, 132-07-T1..T3), Wave 0
  y Validation Sign-Off marcados, `nyquist_compliant: true` (única ocurrencia literal).
- **Corrida LIVE real** (paso 1, Task 2): `descargados=5 skips=0`, escribió R2 (5 objetos
  content-addressed) + PROD (`source_snapshot` 5 filas, `noticia` 25 filas). Ver §Corrida LIVE
  abajo para los 4 pasos con evidencia completa.
- **Replay `--from-r2` (SC3)** sobre un r2Path real (`news/rss-exante/...`) reprodujo exactamente
  los conteos del feed (`vistos=10 cargados=0`) sin ningún request a los medios — solo
  `r2Store.getObject`.
- **Idempotencia contra PROD** verificada: `select count(*) from noticia` idéntico (25) antes y
  después de repetir el replay `--from-r2` sin `--dry-run` sobre el mismo r2Path (`duplicados=10`,
  `cargados=0`).
- **D-132-A re-verificado hoy**: `news.google.com/robots.txt` (HTTP 200) sigue con
  `Disallow: /` sin `/rss/` en la allowlist; `isAllowed=false` para `/rss/search` bajo el
  `IDENTIFIED_UA`. Documento sin cambios respecto del research.
- `132-REPORTE-OPERADOR.md` escrito con las 6 secciones exigidas (números reales, D-132-A, opciones
  de alcance, qué NO entrega la fase, nota honesta del 412, incidencias de fuentes — 0 en esta
  corrida), sin project-ref ni credenciales (B26 verificado por grep).
- **Hallazgo crítico documentado (no bloqueante):** SC2 ("N líneas `[skip]`, 0 requests HTTP en la
  re-corrida") NO se cumple literalmente con el código actual — ver §Deviations.

## Task Commits

1. **Task 1: Suite completa verde + Per-Task Verification Map** - `3032503` (docs)
2. **Task 2: [CORRIDA LIVE] — sin archivos de código (evidencia va al SUMMARY, según `files_modified` del plan)** - sin commit propio (evidencia documentada aquí)
3. **Task 3: 132-REPORTE-OPERADOR.md** - `882027d` (docs)

## Corrida LIVE — evidencia completa (Task 2)

**N = 5** (`ls packages/news/src/__fixtures__/*.xml | wc -l` = 5 = `FEEDS.length`, verificado por
`packages/news/src/fixtures.test.ts`, 6/6 tests passed). Ningún host retirado por el riesgo A4
(los 5 respondieron 200 tanto en el probe de 132-01 como aquí).

### Paso 1 — Corrida real (Etapa 1 + Etapa 2, `/tmp/132-run1.log`)

```
news-cli: descargados=5 skips=0
carga: vistos=20 nuevos=20 duplicados=0 descartados=20 cargados=0 errores=0
carga: vistos=15 nuevos=15 duplicados=0 descartados=15 cargados=0 errores=0
carga: vistos=100 nuevos=100 duplicados=0 descartados=82 cargados=18 errores=0
carga: vistos=100 nuevos=100 duplicados=0 descartados=93 cargados=7 errores=0
carga: vistos=10 nuevos=10 duplicados=0 descartados=10 cargados=0 errores=0

news-cli LIVE: feeds=5 descargados=5 skips=0 dbLoaded=true | carga: vistos=245 nuevos=245 duplicados=0 descartados=220 cargados=25 errores=0
```

`descargados=5 skips=0` (== N), como exige el plan. Timestamps `fetched_at` de `source_snapshot`
(psql, `tr -d '\r'`):

| slug | fetched_at (UTC) | gap desde el anterior |
|------|-------------------|------------------------|
| rss-biobiochile | 19:44:27.781 | (primero) |
| rss-cooperativa | 19:44:29.639 | 1.858s |
| rss-latercera | 19:44:31.348 | 1.709s |
| rss-lacuarta | 19:44:32.865 | 1.517s |
| rss-exante | 19:44:35.970 | 3.105s |

**Nota honesta sobre el rate-limit cross-host:** 3 de los 4 gaps salieron por debajo de 2s. Root
cause: `HostRateLimiter` (usado por `buildNewsDeps`/`NewsConnector` vía `BaseConnector.run()`,
LOCKED por D-132-B) serializa **por host**; como los 5 feeds son 5 hosts distintos, cada uno es
"el primero" de su propio host y no paga `minDelayMs` (2500ms por defecto). El probe de 132-01
tenía el mismo problema y lo resolvió con un `sleep(3000)` explícito **en el propio script**
(`probe-feeds.ts`, fuera de `@obs/ingest`); `run-news-cli.ts`/`NewsConnector` **no** heredó ese
mismo parche porque delega el loop completo a `BaseConnector.run()` (framework LOCKED, D-132-B
prohíbe tocarlo en esta fase). Impacto real: cada host recibió exactamente **1** request (no hubo
ráfaga contra ningún host individual); el riesgo de DoS al tercero (T-132-19) es bajo pero el
criterio literal "≥2s entre TODOS los requests consecutivos" no se cumplió en 3/4 pares. Se
documenta como hallazgo para una fase futura (parche a `NewsConnector`/`buildNewsDeps` con un
sleep explícito cross-host, análogo al del probe).

### Paso 2 — Re-corrida inmediata `--etapa1` (`/tmp/132-run2.log`)

```
news-cli: descargados=5 skips=0

news-cli LIVE: feeds=5 descargados=5 skips=0 dbLoaded=true
```

**Esperado por el plan:** `descargados=0 skips=5` y 5 líneas `[skip] rss-<slug>`.
**Obtenido:** `descargados=5 skips=0` — **0 líneas `[skip]`**. Ver §Deviations para el análisis
completo. `source_snapshot` no ganó filas nuevas (recuperación idempotente de `23505` en
`SupabaseSnapshotStore`), pero **sí hubo un segundo fetch HTTP real** a los 5 medios.

### Paso 3 — r2Path regex (los 5 slugs vivos)

```
MATCH: news/rss-biobiochile/2026-08-05/343aabc563d2cf686bb55ea7c6c939e655603ada6db7c3a0755646d7c551dbda.xml
MATCH: news/rss-cooperativa/2026-08-05/74e42bafac5b19e12384e7ab12e1da4f71ed4da5e8cabbaede8c29df59dcf4ba.xml
MATCH: news/rss-exante/2026-08-05/cf0867b1ce68aaa5321c752ef925a61f9e9d0caeb0238c869d556de631f1a57b.xml
MATCH: news/rss-lacuarta/2026-08-05/ac6c7aab6a4ce41c99bf17f028c5b18c184567ea4d1a968fc87679a07f2e29bc.xml
MATCH: news/rss-latercera/2026-08-05/292616c04b5ca8d0d7bbaf2e9873bdf5750f1b361c0fac43fe8c8a12b1f9d83f.xml
```

5/5 matchean `^news/rss-(biobiochile|cooperativa|latercera|lacuarta|exante)/\d{4}-\d{2}-\d{2}/[0-9a-f]{64}\.xml$`.

### Paso 4 — Replay `--from-r2` (SC3, `/tmp/132-run4-replay.log`, 0 requests a medios)

```
news-cli: modo --from-r2 → leyendo crudo desde R2 (news/rss-exante/2026-08-05/cf0867b1ce68aaa5321c752ef925a61f9e9d0caeb0238c869d556de631f1a57b.xml)
carga: vistos=10 nuevos=10 duplicados=0 descartados=10 cargados=0 errores=0

news-cli DRY-RUN: feeds=1 descargados=0 skips=0 dbLoaded=false | carga: vistos=10 nuevos=10 duplicados=0 descartados=10 cargados=0 errores=0
```

Reproduce exactamente los conteos de exante del paso 1 (`vistos=10 cargados=0`), sin ninguna línea
de fetch a medios — la única fuente de datos fue `r2Store.getObject`.

### Paso 5 — Conteos PROD (`psql -tA | tr -d '\r'`)

```
noticia total: 25
noticia_url_vista por causa: prefiltro_lexico=220, (pasa)=25   (suma=245=vistos)
noticia por outlet: La Tercera=18, La Cuarta=7
source_snapshot (source=news): 5 filas — rss-biobiochile, rss-cooperativa, rss-exante, rss-lacuarta, rss-latercera, todas date_bucket=2026-08-05
```

`select count(*) from source_snapshot where source='news'` = **5** = N. `prefiltro_lexico` > 0
(descarte observable, SC4).

### Paso 6 — Idempotencia contra PROD (`/tmp/132-run6-idempotencia.log`)

```
before=25
news-cli: modo --from-r2 → leyendo crudo desde R2 (news/rss-exante/...)
carga: vistos=10 nuevos=0 duplicados=10 descartados=0 cargados=0 errores=0
news-cli LIVE: feeds=1 descargados=0 skips=0 dbLoaded=true | carga: vistos=10 nuevos=0 duplicados=10 descartados=0 cargados=0 errores=0
after=25
```

`count(*) from noticia` idéntico (25) antes y después — idempotencia confirmada contra la base
real.

### Presupuesto de red de la fase (declarado, no el nominal 2N+1)

- Probe (132-01 T3): **5** requests.
- Corrida LIVE paso 1 (este plan): **5** requests.
- Re-corrida paso 2 (este plan): **5 requests reales** — el plan esperaba 0 (ver Deviations).
- Replay paso 4 y paso 6 (`--from-r2`): **0** requests (solo R2).
- Re-verificación robots.txt de Google (Task 3): **1** request.
- **Total real de la fase: 5 + 5 + 5 + 0 + 0 + 1 = 16** (no los 11 nominales de `2N+1`). El exceso
  de 5 requests es exactamente la re-corrida del paso 2, documentada como deviation abajo — ningún
  medio devolvió 403/429/5xx en ninguna pasada.

## Deviations from Plan

### Hallazgo NO auto-fixed (Rule 4 — arquitectural, documentado sin bloquear el cierre)

**1. SC2 no se cumple literalmente: `[skip]` derivado nunca dispara en producción real; la
re-corrida ejecutó un segundo fetch real, no 0 requests**

- **Found during:** Task 2, paso 2 (re-corrida inmediata `--etapa1`).
- **Issue:** El `[skip]` derivado (D-132-B, 132-06) compara los slugs pedidos contra los slugs
  presentes en los `SnapshotRef` devueltos por `conector.run()`. Como `buildNewsDeps()` deja
  `cache: { hasToday: async () => false }` (el doble no-op — decisión explícita y documentada en
  `132-06-SUMMARY.md` §Decisions Made, "Cache/drift/hostThrottle no se wirean con implementaciones
  Postgres-backed reales"), `BaseConnector.run()` (línea `if (await this.deps.cache.hasToday(...))
  continue;`) **jamás** entra a esa rama con cache real: siempre hace el fetch completo. Por lo
  tanto `todosRefs` contiene los 5 slugs en CADA corrida, `slugsDescargados` siempre coincide con
  `slugsPedidos`, y el bucle que empuja a `skips` nunca encuentra un slug faltante. El resultado
  observado (`descargados=5 skips=0`, cero líneas `[skip]`) es el comportamiento CORRECTO del
  código tal como está escrito — el bug está en el diseño de 132-06, que asumió (sin wirear) que
  algún componente produciría un cache-hit real.
  Tampoco hay 412 de R2 como sustituto: `putImmutable` calcula sha256 sobre el XML crudo, que
  contiene `<lastBuildDate>`/campos volátiles que cambian entre pasadas — dos fetches del mismo
  feed casi nunca producen el mismo sha256, así que R2 casi nunca devuelve `existed:true`. Esto
  YA estaba anticipado y documentado correctamente en `132-RESEARCH.md` Pitfall 5 (no prometer un
  412 que no ocurre) — lo que NO estaba anticipado es que el `[skip]` derivado tampoco tuviera un
  camino real para disparar.
- **Impacto medido:** el paso 2 hizo un **segundo fetch HTTP real** a los 5 medios (biobiochile,
  cooperativa, latercera, lacuarta, exante) en la misma sesión, ~3 minutos después del primero.
  Los datos en PROD NO se corrompieron: `source_snapshot` recuperó idempotentemente la violación
  `23505` de unicidad `(source, resource, date_bucket)` en `SupabaseSnapshotStore.insertSnapshot`
  (devolvió el `id` de la fila existente, dejando el count en 5, no 10) y `cargar()` deduplicó por
  URL (`noticia` se mantuvo en 25, no creció). Pero el objetivo del paso 2 — demostrar que la
  re-corrida NO vuelve a tocar red — no se cumplió: se gastaron 5 requests HTTP adicionales contra
  medios reales que el plan explícitamente prometía en 0.
- **Por qué NO se auto-arregló (Rule 4, no Rule 1-3):** arreglarlo de raíz exige wirear un
  `DailyCache`/`SnapshotLookup` Postgres-backed real en `buildNewsDeps`/`run-news-cli.ts` (o tocar
  el orden de `BaseConnector.run()` en `@obs/ingest`, EXPRESAMENTE prohibido por D-132-B LOCKED:
  "el framework no se toca en esta fase, la orden es PARAR y escalar"). Es un cambio estructural
  fuera del alcance de `files_modified` de este plan (solo `132-VALIDATION.md` y
  `132-REPORTE-OPERADOR.md`), y la corrida ya se había ejecutado — no había forma de "arreglar
  antes" sin adivinar el resultado antes de correr. Además, PARAR a mitad del paso 2 (después de
  que la red ya había salido) no habría evitado el gasto de red ya hecho; completar los pasos
  restantes (3-6, todos de 0 requests a medios) maximiza la evidencia recogida sin gastar más red.
- **NO se reintentó** la re-corrida ni se corrió una tercera vez (regimen v13: "no reintentes ese
  mismo día").
- **Documentado en:** `132-VALIDATION.md` §Hallazgo 132-07-T2, `132-REPORTE-OPERADOR.md` §5 (nota
  honesta ampliada a incluir este hallazgo), y aquí.
- **Recomendación:** antes de que el cron diario (fase 136) dependa del `[skip]` para no
  re-scrapear cada día, una fase futura debe wirear un `DailyCache` real (o una consulta directa a
  `source_snapshot` por `date_bucket`) en `buildNewsDeps`/`run-news-cli.ts`.

### Hallazgo secundario NO auto-fixed (Rule 4 — mismo patrón que 132-01, framework LOCKED)

**2. Rate-limit cross-host: 3 de 4 gaps entre requests del paso 1 salieron por debajo de 2s**

- **Found during:** Task 2, paso 1.
- **Issue:** `HostRateLimiter` es por-host; con 5 hosts distintos, ninguno paga el `minDelayMs`
  (2500ms) porque cada uno es "el primero" de su propio host dentro de `BaseConnector.run()`
  (mismo patrón exacto que 132-01 Task 3, que lo resolvió con un `sleep(3000)` explícito **fuera**
  del framework, en `probe-feeds.ts`). `NewsConnector`/`run-news-cli.ts` no tiene ese parche
  porque delega el loop completo a `BaseConnector.run()` (LOCKED, D-132-B).
- **Impacto:** cada host recibió exactamente 1 request (no hubo ráfaga contra ningún host
  individual — el riesgo de DoS al tercero, T-132-19, es bajo en términos absolutos), pero el
  criterio literal "≥2s entre TODOS los requests consecutivos" no se cumplió en 3/4 pares
  (1.858s, 1.709s, 1.517s, 3.105s).
- **Por qué NO se auto-arregló:** el mismo motivo que el hallazgo 1 — requeriría tocar
  `NewsConnector`/`buildNewsDeps` con un sleep explícito cross-host análogo al del probe, y la
  corrida ya se había ejecutado antes de detectar el patrón en los timestamps (solo visibles
  post-hoc vía `psql`, no en la salida de la CLI). Documentado como hallazgo para un futuro parche,
  no bloqueante para el cierre de esta fase (ningún host individual recibió más de 1 request).

**Total deviations:** 2 hallazgos NO auto-fixed (ambos Rule 4, arquitecturales, framework LOCKED
por D-132-B), documentados exhaustivamente en `132-VALIDATION.md` y `132-REPORTE-OPERADOR.md`.
**Ningún dato en PROD quedó inconsistente** (idempotencia verificada en el paso 6). El cierre de
la fase no está bloqueado por estos hallazgos (handoff, no gate) — quedan como deuda explícita para
una fase futura (136 o un parche puntual a 132-06).

## Issues Encountered

- Ver §Deviations arriba (los dos hallazgos son los únicos issues de esta ejecución).
- El intento inicial de usar `robots-parser` vía `npm:` (sintaxis Deno) falló bajo Node/tsx
  (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); se corrigió usando el import plano `"robots-parser"` desde
  dentro de `packages/ingest` (que ya lo declara como dependency), ejecutando el script temporal
  desde ese directorio para que la resolución de `node_modules` funcionara. Sin impacto en el
  resultado (mismo `robots-parser@3.0.1`, mismo `IDENTIFIED_UA`).

## User Setup Required

None — la corrida usó `.env` del root (SUPABASE_DB_URL, credenciales R2) ya configurado.

## Next Phase Readiness

- Los N=5 feeds están vivos, en R2 y en PROD (`noticia`/`noticia_url_vista`/`source_snapshot`
  poblados con datos reales).
- `noticia` sigue siendo deny-all (nada del sitio la lee) hasta la fase 137.
- **Deuda explícita para una fase futura (recomendado antes de 136 cron):** wirear un
  `DailyCache`/`SnapshotLookup` Postgres-backed real en `buildNewsDeps`/`run-news-cli.ts` para que
  el `[skip]` derivado funcione de verdad y el cron diario no re-scrapee cada día; considerar
  también un sleep cross-host explícito en `NewsConnector` (mismo patrón que `probe-feeds.ts`) si
  el número de hosts distintos crece.
- `132-REPORTE-OPERADOR.md` queda como handoff para que el operador revise D-132-A y el hallazgo
  SC2 cuando pueda — la fase se cierra sin esperar su respuesta.

---
*Phase: 132-news-rss-conector-rss-dos-etapas-locked*
*Completed: 2026-08-05*

## Self-Check: PASSED
- FOUND: .planning/phases/132-news-rss-conector-rss-dos-etapas-locked/132-VALIDATION.md
- FOUND: .planning/phases/132-news-rss-conector-rss-dos-etapas-locked/132-REPORTE-OPERADOR.md
- FOUND: commit 3032503
- FOUND: commit 882027d
