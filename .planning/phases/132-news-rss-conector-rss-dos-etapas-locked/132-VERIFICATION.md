---
phase: 132-news-rss-conector-rss-dos-etapas-locked
verified: 2026-08-05T22:10:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "SC2 — hash-check ANTES de descargar: una re-corrida sin novedades sale temprano con `[skip]` y cero re-descarga"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification: []
---

# Phase 132: NEWS-RSS — Conector RSS dos-etapas LOCKED — Verification Report (RE-VERIFICACIÓN)

**Phase Goal:** El RSS de prensa fluye fuente→R2 crudo→Supabase cerrando los 4 huecos de régimen de Is Chile Safe (robots.txt, delay, crudo no guardado, content-addressing incompleto) — ninguno se hereda.
**Verified:** 2026-08-05 (ronda 2, tras planes de cierre 132-08..11)
**Status:** passed
**Re-verification:** Sí — tras gap closure (previo: `gaps_found` 3/4)

## Goal Achievement

### Observable Truths (SC1-SC4 del ROADMAP §Phase 132)

| # | Truth | Status | Evidence (comando ejecutado por el verificador) |
|---|-------|--------|--------------------------------------------------|
| 1 | SC1 — robots.txt ANTES de cada host, rate-limit 2-3 s/host, UA identificatorio, sin ráfagas; delay entre feeds observable | ✓ VERIFIED | Orden LOCKED intacto en `base-connector.ts:118-140` (cache→robots→hostThrottle→rateLimiter→fetch, `host` derivado de `new URL(spec.url).host`). El warning cross-host de la ronda 1 quedó **cerrado en código**: `gateRateLimiter()` (`connector-news.ts:150-175`) impone `minIntervalMs` GLOBAL entre requests además del `HostRateLimiter` por host, y `buildNewsDeps` lo envuelve siempre (línea 216-221). Test apareado real: `connector-news.test.ts:321,355` — "5 endpoints de 5 hosts distintos ⇒ `sleepFn` 4 veces con valor ≥2000 y `rateLimiter.wait` sigue por host". |
| 2 | SC2 — RSS crudo content-addressed en R2 (`If-None-Match: *`, 412 = éxito) **con hash-check ANTES de descargar; re-corrida sale temprano con `[skip]` y cero re-descarga** | ✓ VERIFIED | **Re-ejecutado en vivo por el verificador, no tomado del SUMMARY:** `npx tsx src/run-news-cli.ts --etapa1 --feeds exante,latercera` ⇒ `[skip] rss-latercera (cache-hit del día)` / `[skip] rss-exante (cache-hit del día)` / `news-cli: descargados=0 skips=2` — **0 requests HTTP** contra los medios. Camino de PRODUCCIÓN confirmado por lectura: `buildNewsDeps` ya NO tiene doble no-op; `cache = new DailyCache(new SupabaseSnapshotLookup(supabase))` (`connector-news.ts:223-230`) y **lanza `NewsCacheRequeridaError` si no hay cache ni supabase** (fail-closed, no degrada). `run-news-cli.ts:386-387` pasa `supabase:{url,serviceKey}` desde env. `SupabaseSnapshotLookup.hasSnapshot` (`snapshot-lookup-supabase.ts:51-64`) consulta `source_snapshot` por `(source,resource,date_bucket)` y **lanza ante error de PostgREST** en vez de devolver `false` silencioso. Content-addressing: los 5 `r2_path` de PROD matchean `news/rss-<slug>/2026-08-05/<64-hex>.xml`. |
| 3 | SC3 — El parseo/carga lee SIEMPRE desde R2; replay `--from-r2` reproduce la carga sin tocar la red | ✓ VERIFIED | **Re-ejecutado por el verificador tras los cambios de 132-10/11:** `--dry-run --from-r2 news/rss-exante/2026-08-05/cf0867b1…57b.xml` ⇒ `carga: vistos=10 nuevos=10 duplicados=0 descartados=10 cargados=0 errores=0`, idéntico a la ronda 1 ⇒ sin regresión. `replay.test.ts` 4/4. Además el CLI ahora **valida el patrón del r2Path** (WR-09): una clave truncada falló ruidosamente en mi primer intento. |
| 4 | SC4 — N medios directos (N=`FEEDS.length`≥3, nominal 5) + pre-filtro léxico determinista con conteo de descartes observable | ✓ VERIFIED | `feeds.ts`: 5 feeds con `slug` + `display` separados. PROD (`psql -tA \| tr -d '\r'`): `noticia`=25 (`lacuarta` 7 + `latercera` 18, **outlet = slug**, no display); `noticia_url_vista`=245 con partición coherente `descarta/prefiltro_lexico`=220 + `pasa/(null)`=25, **0 filas `pendiente` colgadas**; `outlet` del ledger también en slug (biobiochile 20, cooperativa 15, exante 10, lacuarta 100, latercera 100 = 245); `source_snapshot(source='news')`=5=N. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/news/` | Paquete no CI-DARK | ✓ VERIFIED | `pnpm --filter @obs/news test` ⇒ **206 passed / 12 files** (era 123/10; piso 85). |
| `packages/news/src/snapshot-lookup-supabase.ts` | `SnapshotLookup` real contra `source_snapshot` | ✓ VERIFIED | Existe, implementa `hasSnapshot`, sin project-ref hardcodeado, sin degradación a `false`. Suite propia `snapshot-lookup-supabase.test.ts`. |
| `packages/news/src/connector-news.ts` | `buildNewsDeps` sin doble no-op + gate cross-host | ✓ VERIFIED (era ⚠️ HOLLOW) | `NewsCacheRequeridaError` fail-closed; `gateRateLimiter`; `validateShape` RSS-2.0-only. |
| `packages/news/src/run-news-cli.ts` | Flags honestos + cache real | ✓ VERIFIED | `--feeds` viaja al constructor del conector (WR-01); `--etapa1`/`--etapa2` mutuamente excluyentes (WR-02); `--dry-run` sin `--from-r2` LANZA (WR-06); argumento inválido lanza (WR-08); `--from-r2` validado (WR-09). |
| `supabase/migrations/0085_…pendiente.sql` + test pgTAP | Estado `pendiente` aplicado a PROD | ✓ VERIFIED | PROD: `noticia_url_vista_estado_check = estado in ('pasa','descarta','pendiente')`, índice `noticia_url_vista_estado_idx` presente, ledger `supabase_migrations.schema_migrations` con `0085` al tope. **pgTAP corrido por el verificador contra PROD: 9/9 ok** (incluye el control negativo "un estado inventado sigue rechazado" ⇒ el check no quedó vacío, y 3 no-regresiones de RLS deny-all). |
| `packages/news/src/carga-run.ts` | Ledger sin causa final prematura (CR-02) | ✓ VERIFIED | Marca `estado:'pendiente', causa:null` ANTES de evaluar (línea 113-122); promueve a `descarta/prefiltro_lexico` o a `pasa` SOLO tras resolver el destino (líneas 136-152, 188-194); fallo ⇒ queda `pendiente` re-evaluable + `errores[]`. `urlsYaVistas` filtra a `estado in ('pasa','descarta')` (`writer-supabase.ts:120-133`) ⇒ los `pendiente` sí se re-evalúan. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `run-news-cli` | cache diaria real | `buildNewsDeps({supabase}) → DailyCache → SupabaseSnapshotLookup → source_snapshot` | ✓ WIRED (era ✗ NOT_WIRED) | Probado en vivo: `descargados=0 skips=2`. |
| `BaseConnector` | early-exit | `if (await cache.hasToday(...)) continue` | ✓ WIRED | Ahora alcanzable: `date_bucket=2026-08-05` presente para los 5 recursos. |
| `carga-run` | ledger | `writer.marcarVistas` provisional → promoción | ✓ WIRED | CR-02 cerrado. |
| Resto de links de la ronda 1 (robots, rate-limit, R2, snapshot, `--from-r2`) | — | — | ✓ WIRED | Sin regresión (re-probados vía suite + corridas). |

### Régimen (D-132-B / B26)

| Control | Comando | Resultado | Status |
|---------|---------|-----------|--------|
| `@obs/ingest` intacto | `git diff --name-only 7b188f3..HEAD -- packages/ingest/` | **0 archivos** | ✓ PASS |
| Superficie del cierre | `git diff --name-only 7b188f3..HEAD` | solo `.planning/`, `packages/news/src/`, `supabase/migrations|tests/0085` | ✓ PASS |
| B26 sin secretos | grep de project-ref / `service_role_key` / `eyJhbGciOi` sobre todos los archivos tocados | 0 matches | ✓ PASS |
| Marcadores de deuda | grep `TBD\|FIXME\|XXX\|HACK\|TODO` en `packages/news/src/*.ts` + `0085.sql` | 0 reales (único match = "TODO" español = "todo") | ✓ PASS |

### Behavioral Spot-Checks (ejecutados por el verificador)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite del paquete | `pnpm --filter @obs/news test` | 206 passed / 12 files | ✓ PASS |
| Typecheck monorepo | `pnpm typecheck` | exit 0 | ✓ PASS |
| Guards de régimen | `pnpm guards` | exit 0 (7 passed) | ✓ PASS |
| **SC2 early-exit LIVE** | `tsx run-news-cli.ts --etapa1 --feeds exante,latercera` | `[skip]` ×2, `descargados=0 skips=2`, 0 requests | ✓ PASS |
| SC3 replay sin red | `tsx run-news-cli.ts --dry-run --from-r2 <path>` | `vistos=10 descartados=10 cargados=0` | ✓ PASS |
| pgTAP 0085 contra PROD | `psql -tA -f supabase/tests/0085_…test.sql` | 9/9 ok | ✓ PASS |
| Conteos PROD | `psql -tA \| tr -d '\r'` | noticia=25 (outlet=slug), vista=245 = 220 + 25, 0 `pendiente`, snapshot=5 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NEWS-01 | 132-01..11 | Dos etapas LOCKED: robots + rate-limit + UA + crudo content-addressed a R2 → parseo SIEMPRE desde R2. Hash-check antes de descargar. | ✓ SATISFIED (era ⚠️ PARCIAL) | La cláusula "hash-check antes de descargar" quedó probada en vivo (0 requests en la re-corrida). |
| NEWS-02 | 132-01, 04, 07, 10 | 5 medios directos (N≥3) + pre-filtro léxico determinista antes de gastar LLM | ✓ SATISFIED | N=5 congelado; 220 descartes léxicos trazables; `outlet` ahora slug estable. |

Sin requisitos huérfanos.

### Estado de los hallazgos del 132-REVIEW.md

**Cerrados y verificados por comando/código:** CR-01 (132-08), CR-02 + migración 0085 aplicada (132-09), WR-01, WR-02, WR-03, WR-04 (outlet=slug en código y en PROD, 25+245 filas migradas), WR-05 (`contarPorCausa` con count exacto), WR-06, WR-07 (`assertFeedUrl` en el camino real), WR-08, WR-09, WR-10, WR-11, WR-12, WR-13, WR-14 (`validateShape` exige `<rss>`; Atom lanza — test `connector-news.test.ts:410`), WR-15 (suite de `SupabaseNewsWriter`), WR-17 (`despojarHtml` en `descripcion`), IN-01, IN-03, IN-04, IN-06.

**Diferidos CON razón escrita (aceptable):**

| Hallazgo | Razón escrita | Dónde |
|----------|---------------|-------|
| WR-16 (2-3 round-trips por ítem; ledger y `noticia` pueden divergir) | "la pérdida de dato la cierra CR-02 en este plan; lo que queda es rendimiento, no corrección" | `132-09-SUMMARY.md:25,131` (§Deferred con razón) |
| IN-05 (`canonicalizarUrl` elimina `ref`/`source`) | "invalidaría el `url_hash` de las 245 filas ya en el ledger sin un caso real de colisión observado" | `132-09-SUMMARY.md:26,134` |

**Ninguno se difirió en silencio.** Sí hay una **inconsistencia documental menor (ℹ️ Info, no gap):** `132-11-SUMMARY.md:121` afirma "WR-14 queda diferido con razón dura (exige tocar `@obs/ingest`)", pero WR-14 **ya había sido cerrado en `132-10`** y el código lo confirma (`connector-news.ts:95-99` rechaza Atom, con test apareado). La afirmación del SUMMARY es obsoleta, no una omisión real.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Doble no-op de producción (blocker de la ronda 1) | ✓ ELIMINADO | Reemplazado por fail-closed `NewsCacheRequeridaError`. |
| `132-11-SUMMARY.md` | 121 | Afirmación obsoleta sobre WR-14 | ℹ️ Info | Documental; el código dice lo contrario y es lo verificado. |

### Human Verification Required

Ninguna. El único item asíncrono es la adjudicación D-132-A del operador (Google News descartado por robots.txt), que es decisión de handoff, no gate técnico.

### Gaps Summary

Sin gaps. El único hueco de la ronda 1 —hueco #4 de Is Chile Safe: hash-check/early-exit antes de descargar— está cerrado en el camino de PRODUCCIÓN, no solo en tests: `buildNewsDeps` construye un `DailyCache` respaldado en `source_snapshot` vía `SupabaseSnapshotLookup`, **lanza en vez de degradar** si le faltan credenciales, y la re-corrida que yo mismo ejecuté salió con `[skip]` ×2 y cero requests HTTP. El régimen quedó intacto (`packages/ingest/` con 0 archivos tocados desde el review) y la superficie del cierre es exactamente `packages/news/src/` + la migración 0085, que está aplicada a PROD y probada con pgTAP 9/9 contra el schema aplicado, incluyendo un control negativo que demuestra que el check no quedó vacío.

## Historial

**Ronda 1 — 2026-08-05T19:05:00Z — `gaps_found`, score 3/4.**
Gap único: *"SC2 — hash-check ANTES de descargar"* en estado `partial`. La mitad content-addressing estaba verificada (5 objetos en R2 con `If-None-Match: *` y 412=existed), pero la mitad early-exit no existía en producción: `buildNewsDeps()` entregaba `cache: { dailyKey: async () => "", hasToday: async () => false }` como default de **producción** y ningún caller lo sobrescribía, así que la rama de cache-hit de `BaseConnector.run()` era inalcanzable y el `[skip]` derivado de 132-06 no tenía camino para dispararse. Medido en vivo entonces: la re-corrida gastó **5 requests HTTP** contra medios reales donde el plan prometía 0. Artefactos señalados: `connector-news.ts:115-118` (doble no-op) y `run-news-cli.ts:~314` (`buildNewsDeps` sin `cache`). Warning no bloqueante registrado: rate-limit sin gate cross-host (gaps de 1.858/1.709/1.517 s entre feeds de hosts distintos). Ambos quedaron cerrados por los planes 132-08 (cache real) y 132-10 (gate cross-host).

---

_Verified: 2026-08-05 (ronda 2)_
_Verifier: Claude (gsd-verifier)_
