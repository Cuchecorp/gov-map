---
phase: 132-news-rss-conector-rss-dos-etapas-locked
verified: 2026-08-05T19:05:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
gaps:
  - truth: "SC2 — hash-check ANTES de descargar: una re-corrida sin novedades sale temprano con `[skip]` y cero re-descarga"
    status: partial
    reason: "La mitad content-addressing del SC2 está VERIFICADA (5 objetos `news/rss-<slug>/YYYY-MM-DD/<sha256>.xml` en R2, `If-None-Match: *` + 412=existed en `r2-store.ts`). La mitad hash-check/early-exit NO existe en el pipeline real: `buildNewsDeps()` deja `cache.hasToday` como doble no-op (`async () => false`) y NINGÚN caller de la CLI lo sobrescribe, así que `BaseConnector.run()` (línea `if (await this.deps.cache.hasToday(...)) continue;`) jamás toma la rama de cache-hit y el `[skip]` derivado de 132-06 no tiene camino para dispararse. Confirmado por código Y por la corrida LIVE (paso 2: `descargados=5 skips=0`, 5 fetch HTTP reales donde el plan prometía 0)."
    artifacts:
      - path: "packages/news/src/connector-news.ts"
        issue: "línea 115-118: `cache: overrides.cache ?? { dailyKey: async () => \"\", hasToday: async () => false }` — el default de producción es el doble no-op"
      - path: "packages/news/src/run-news-cli.ts"
        issue: "`buildNewsDeps({...})` (línea ~314) nunca pasa `cache`; el bucle de `[skip]` (línea ~356-365) deriva de `refs` que siempre trae los N slugs"
    missing:
      - "Wire de un `DailyCache`/`SnapshotLookup` real respaldado en `source_snapshot` (consulta por `source='news'` + `resource` + `date_bucket = hoy`) dentro de `packages/news` — NO requiere tocar `@obs/ingest` (D-132-B se respeta: `ConnectorDeps.cache` es un punto de inyección del framework, no una modificación)"
      - "Pasar ese cache en `buildNewsDeps()` (default de producción) y/o desde `run-news-cli.ts`"
      - "Test que pruebe el early-exit con el cache REAL (no el doble): segunda corrida ⇒ `descargados=0 skips=N` y `fetcher.get` 0 veces; con mutación que demuestre que el test cae"
      - "Nota: el 412 de R2 NO es sustituto — el sha256 se calcula sobre el XML crudo con `<lastBuildDate>` volátil (ya anticipado en 132-RESEARCH Pitfall 5)"
human_verification: []
---

# Phase 132: NEWS-RSS — Conector RSS dos-etapas LOCKED — Verification Report

**Phase Goal:** El RSS de prensa fluye fuente→R2 crudo→Supabase cerrando los 4 huecos de régimen de Is Chile Safe (robots.txt, delay, crudo no guardado, content-addressing incompleto) — ninguno se hereda.
**Verified:** 2026-08-05
**Status:** gaps_found
**Re-verification:** No — verificación inicial

## Goal Achievement

### Observable Truths (SC1-SC4 del ROADMAP §Phase 132)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 — robots.txt ANTES de cada host, rate-limit 2-3 s/host, UA identificatorio, sin ráfagas; delay entre feeds observable | ✓ VERIFIED (con warning) | `base-connector.ts:118-140`: orden LOCKED cache→robots→hostThrottle→rateLimiter.wait(host)→fetch, con `host` derivado de `new URL(spec.url).host` (no spoofeable). `buildNewsDeps` inyecta `RobotsGuard` **con la allowlist scoped** (Pitfall 1 cerrado) y `HostRateLimiter({minDelayMs: 2500})`. UA LOCKED en `fetcher.ts:102` y `robots.ts:115`. Corrida LIVE: 1 request por host, gaps 1.858/1.709/1.517/3.105 s. Ver warning abajo. |
| 2 | SC2 — RSS crudo content-addressed en R2 (`If-None-Match: *`, 412 = éxito) **con hash-check ANTES de descargar; re-corrida sale temprano con `[skip]` y cero re-descarga** | ✗ FAILED (parcial) | Content-addressing VERIFICADO por comando contra PROD: los 5 `r2_path` de `source_snapshot` matchean `news/rss-<slug>/2026-08-05/<64-hex>.xml`; `r2-store.ts:71,76-79` pone `If-None-Match: *` y trata 412 como `existed=true`. **Early-exit NO existe:** `cache.hasToday` es no-op en `buildNewsDeps` y la CLI no lo sobrescribe (grep: las únicas `hasToday` reales son dobles de test). La corrida LIVE lo confirmó empíricamente (`descargados=5 skips=0` en la re-corrida; 5 requests HTTP donde el plan prometía 0). |
| 3 | SC3 — El parseo/carga lee SIEMPRE desde R2; replay `--from-r2` reproduce la carga sin tocar la red | ✓ VERIFIED | **Re-ejecutado por el verificador, no tomado del SUMMARY:** `tsx src/run-news-cli.ts --dry-run --from-r2 news/rss-exante/...cf0867b1...xml` ⇒ `carga: vistos=10 nuevos=10 duplicados=0 descartados=10 cargados=0 errores=0` — reproduce exactamente los conteos de exante del paso 1, única fuente `r2Store.getObject` (`run-news-cli.ts:272-301`, rama que no invoca `run()`). `replay.test.ts` 4/4 verde. |
| 4 | SC4 — N medios directos (N=`FEEDS.length`≥3, nominal 5) + pre-filtro léxico determinista con conteo de descartes observable | ✓ VERIFIED | `feeds.ts`: 5 feeds (biobiochile, cooperativa, latercera, lacuarta, exante) + 5 fixtures, congelado por `fixtures.test.ts`. PROD (`psql -tA \| tr -d '\r'`): `noticia_url_vista` 245 filas = `prefiltro_lexico` **220** + `(pasa)` **25**; `noticia` 25 (La Tercera 18, La Cuarta 7); `source_snapshot(source='news')` = 5 = N. Descarte observable y no vacuo. |

**Score:** 3/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/news/` (23 .ts, 2977 líneas) | Paquete no CI-DARK | ✓ VERIFIED | `pnpm --filter @obs/news test` ⇒ **123 passed / 10 files** (piso 85). `pnpm typecheck`=0, `pnpm guards`=0 (verificado por el verificador). |
| `packages/news/src/connector-news.ts` | NewsConnector con 3 hooks + `buildNewsDeps` | ⚠️ HOLLOW (parcial) | Hooks y allowlist correctos; `cache` default es no-op ⇒ el gate pre-descarga del framework queda muerto en producción. |
| `packages/news/src/run-news-cli.ts` | CLI Etapa1/Etapa2/`--from-r2`, R2 obligatorio | ✓ VERIFIED | Tri-estado `r2Store` (null/undefined/inyectado), fallo duro sin R2 fuera de dry-run; rama `--from-r2` sin red (ejercitada en vivo). |
| `supabase/migrations/0084_noticia.sql` + `supabase/tests/0084_noticia.test.sql` | Tablas + RLS deny-all, aplicada a PROD | ✓ VERIFIED | pgTAP corrido por el verificador contra PROD: **16/16 ok** (RLS enabled en ambas tablas; anon y authenticated sin select/insert/update). `pg_class.relrowsecurity('noticia')='t'`. |
| `132-REPORTE-OPERADOR.md` | Handoff con números reales, sin secretos | ✓ VERIFIED | Existe; B26 sin project-ref/credenciales. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `NewsConnector` | robots.txt del host | `RobotsGuard.isAllowed` en `BaseConnector.run()` paso 2 | ✓ WIRED | Allowlist scoped inyectada en el guard (si no, todo saldría `[skip]` silencioso). |
| `NewsConnector` | rate-limit por host | `HostRateLimiter.wait(host)` paso 3b, `minIntervalMs=2500` | ✓ WIRED | Por host; ver warning cross-host. |
| `BaseConnector` | R2 crudo | `r2.putImmutable(source,resource,date,sha,ext,body)` | ✓ WIRED | 5 objetos reales en R2 con path content-addressed. |
| `BaseConnector` | `source_snapshot` | `snapshot.write(...)` | ✓ WIRED | 5 filas PROD con `r2_path` + `content_hash`. |
| `run-news-cli` | cache diaria (`hasToday`) | `buildNewsDeps().cache` | ✗ NOT_WIRED | Doble no-op; ningún caller inyecta implementación real ⇒ SC2 falla. |
| `run-news-cli --from-r2` | Etapa 2 | `r2Store.getObject` únicamente | ✓ WIRED | Verificado en vivo. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|----------|------|--------|--------------------|--------|
| `noticia` (PROD) | 25 filas, 2 outlets | `cargar()` ← parse-rss ← R2 crudo | Sí (datos reales de La Tercera/La Cuarta) | ✓ FLOWING |
| `noticia_url_vista` | 245 filas, 220 `prefiltro_lexico` | `writer.marcarVistas` antes del reject (orden LOCKED) | Sí | ✓ FLOWING |
| `[skip]` derivado (CLI) | `skips[]` siempre vacío | `refs` de `run()` con cache no-op | **No** — el array nunca puede poblarse en producción | ✗ DISCONNECTED |

### Behavioral Spot-Checks (ejecutados por el verificador)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite del paquete | `pnpm --filter @obs/news test` | 123 passed / 10 files | ✓ PASS |
| Typecheck monorepo | `pnpm typecheck` | exit 0 | ✓ PASS |
| Guards de régimen | `pnpm guards` | exit 0 (7 passed en el último bloque) | ✓ PASS |
| Replay sin red (SC3) | `tsx run-news-cli.ts --dry-run --from-r2 news/rss-exante/...` | `vistos=10 descartados=10 cargados=0` | ✓ PASS |
| pgTAP 0084 contra PROD | `psql -tA -f supabase/tests/0084_noticia.test.sql` | 16/16 ok | ✓ PASS |
| Conteos PROD | `psql -tA \| tr -d '\r'` | noticia=25, vista=245 (220 prefiltro + 25 pasa), snapshot=5 | ✓ PASS |
| `[skip]` en re-corrida | (no re-ejecutado — presupuesto de red; evidencia de código concluyente) | `hasToday` no-op ⇒ imposible | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NEWS-01 | 132-01..07 | Dos etapas LOCKED: robots + rate-limit + UA + crudo content-addressed a R2 → parseo SIEMPRE desde R2. **Hash-check antes de descargar.** | ⚠️ PARCIAL | Todo verificado salvo la cláusula "hash-check antes de descargar" (misma raíz que el gap SC2). |
| NEWS-02 | 132-01, 04, 07 | 5 medios directos (cláusula N≥3) + pre-filtro léxico determinista antes de gastar LLM | ✓ SATISFIED | N=5 congelado; 220 descartes léxicos observables en PROD; Google News descartado por robots.txt (D-132-A, re-verificado). |

Sin requisitos huérfanos: REQUIREMENTS.md mapea NEWS-01 y NEWS-02 a la fase 132 y ambos aparecen en los planes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/news/src/connector-news.ts` | 115-118 | Doble no-op (`async () => false`) como default de **producción**, no de test | 🛑 Blocker | Anula el gate de cache-hit del framework ⇒ SC2 falso. |
| — | — | TODO/FIXME/TBD/XXX/HACK en `packages/news/src/*.ts` | ℹ️ Info | **0 marcadores de deuda** (los matches son la palabra española "TODOS"). |

**Warning (no blocker) — rate-limit cross-host:** con 5 hosts distintos, cada uno es "el primero" de su propio host y no paga `minDelayMs` ⇒ 3 de 4 gaps de la corrida LIVE quedaron bajo 2 s (1.858 / 1.709 / 1.517 s). **SC1 se sostiene literalmente**: el criterio es "rate-limit 2-3 s/**host**" y cada host recibió exactamente 1 request; la ráfaga de "9 requests" de Is Chile Safe sigue siendo imposible por construcción, y el delay entre feeds fue observable y no nulo. Queda como deuda de robustez: si algún día dos feeds comparten host, o si N crece, conviene un sleep cross-host explícito en `NewsConnector` (mismo patrón que `probe-feeds.ts`).

### Human Verification Required

Ninguna. La corrida LIVE es artefacto de handoff (`132-REPORTE-OPERADOR.md`), no gate; la adjudicación D-132-A del operador es asíncrona por diseño.

### Gaps Summary

La fase entrega de verdad 3 de sus 4 criterios, y lo entregado resiste el spot-check independiente: la migración 0084 está aplicada con RLS deny-all real (16/16 pgTAP contra PROD), los 5 crudos están en R2 con path content-addressed, PROD tiene 25 noticias y 220 descartes léxicos trazables, y el replay `--from-r2` lo re-ejecuté yo mismo con conteos idénticos a los del SUMMARY.

El único gap es real y está probado por código, no solo por el log de la corrida: **el hueco #4 de Is Chile Safe (hash-check/early-exit antes de descargar) no se cerró**. `buildNewsDeps()` entrega un `cache.hasToday` no-op como default de producción y ningún caller lo sobrescribe, así que la rama de cache-hit de `BaseConnector.run()` es inalcanzable y el `[skip]` derivado de 132-06 no tiene camino para dispararse. La consecuencia se midió en vivo: la re-corrida gastó 5 requests HTTP contra medios reales donde el plan prometía 0. El SUMMARY lo documenta con honestidad ejemplar y lo clasifica como handoff no bloqueante; desde la verificación goal-backward, sin embargo, ese hueco es exactamente uno de los cuatro que el goal de la fase declara cerrar ("ninguno se hereda"), y la fase 136 (cron diario L-V) depende de él para no re-scrapear los 5 medios cada día. Por eso queda como `gaps_found` y no como deuda diferida.

El fix no requiere tocar `@obs/ingest` ni violar D-132-B: `ConnectorDeps.cache` es un punto de inyección del framework, y basta una implementación respaldada en `source_snapshot` (`source='news'` + `resource` + `date_bucket = hoy`) dentro de `packages/news`, con su test de early-exit y la mutación que demuestre que el test cae.

---

_Verified: 2026-08-05_
_Verifier: Claude (gsd-verifier)_
