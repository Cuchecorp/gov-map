---
phase: 132-news-rss-conector-rss-dos-etapas-locked
plan: 08
subsystem: news-ingesta
tags: [gap-closure, cache-diaria, source_snapshot, CR-01, SC2]
dependency-graph:
  requires: [packages/ingest/src/cache.ts (SnapshotLookup, DailyCache), packages/news/src/connector-news.ts, packages/news/src/run-news-cli.ts]
  provides: [SupabaseSnapshotLookup, "DailyCache real cableado en buildNewsDeps/CLI"]
  affects: [packages/news/src/connector-news.ts, packages/news/src/run-news-cli.ts, packages/news/src/index.ts]
tech-stack:
  added: []
  patterns: ["SnapshotLookup respaldado en Postgres (espejo de SupabaseSnapshotStore/SupabaseNewsWriter)"]
key-files:
  created:
    - packages/news/src/snapshot-lookup-supabase.ts
    - packages/news/src/snapshot-lookup-supabase.test.ts
  modified:
    - packages/news/src/connector-news.ts
    - packages/news/src/connector-news.test.ts
    - packages/news/src/run-news-cli.ts
    - packages/news/src/run-news-cli.test.ts
    - packages/news/src/index.ts
decisions:
  - "El SnapshotLookup real vive en packages/news, NO en @obs/ingest (D-132-B respetado; ConnectorDeps.cache es el punto de inyección)."
  - "buildNewsDeps LANZA NewsCacheRequeridaError si no recibe cache ni supabase — el default de producción ya no puede ser un no-op silencioso (T-132-27)."
  - "Error de PostgREST en hasSnapshot LANZA, nunca degrada a false (T-132-28, mismo criterio que el fallo duro sin R2)."
metrics:
  duration: "~55 min"
  completed: 2026-08-05
---

# Phase 132 Plan 08: Cierre de GAP-SC2/CR-01 — DailyCache real Summary

Un-liner: `SupabaseSnapshotLookup` respaldado en `source_snapshot` reemplaza el doble no-op de producción de `buildNewsDeps`, cableado en `connector-news.ts`/`run-news-cli.ts`, con evidencia empírica (`[skip] x5`, cero requests HTTP, `source_snapshot` invariante) de que la re-corrida del mismo día ya no re-descarga los 5 medios.

## Qué se hizo

**Task 1** — `SupabaseSnapshotLookup` (packages/news/src/snapshot-lookup-supabase.ts): implementación real de `SnapshotLookup` (@obs/ingest) contra `source_snapshot`, consultando `.eq("source",...).eq("resource",...).eq("date_bucket",...)`. Error de PostgREST LANZA (nunca degrada a `false`, T-132-28). Service key nunca se interpola en mensajes de error (T-132-29). 5 tests (hit/miss/error/3-filtros-exactos/no-leak-de-key).

**Task 2** — Cableado en producción: `connector-news.ts` mató el doble no-op de `cache` (`hasToday: async () => false`) y ahora exige `overrides.cache` o `supabase: { url, serviceKey }`, lanzando `NewsCacheRequeridaError` si no recibe ninguno. `run-news-cli.ts` pasa las credenciales Supabase ya resueltas (líneas 222-223) a `buildNewsDeps` como `supabase`. `index.ts` exporta `SupabaseSnapshotLookup` y `NewsCacheRequeridaError`. 10 tests nuevos en `run-news-cli.test.ts`/`connector-news.test.ts` (par apareado de early-exit real vía `buildNewsDeps({ supabase })` con doble estructural del cliente supabase-js — mide el WIRING real, no un atajo con `cache` override directo).

**Task 3** — Evidencia empírica contra PROD: Caso A (el date-bucket de hoy, `2026-08-05`, ya tenía las 5 filas de la corrida LIVE de 132-07) → **0 requests HTTP gastados**. Una sola corrida del CLI real bastó como evidencia.

## Corrida de evidencia (Task 3) — Caso A (0 requests)

Date-bucket UTC actual: `2026-08-05` (idéntico al de la corrida LIVE de 132-07). `source_snapshot` ya tenía 5 filas para `(source='news', date_bucket=2026-08-05)` — no fue necesario gastar presupuesto de red: el early-exit se evidenció con **una sola corrida**.

Conteos ANTES (vía psql, `$SUPABASE_DB_URL`, `tr -d '\r'`):
```
count=5 | max(fetched_at)=2026-08-05 19:44:35.97+00
```

Comando: `pnpm --filter @obs/news exec tsx src/run-news-cli.ts -- --etapa1`

Log literal de la corrida (`/tmp/132-08-evidencia.log`):
```
[skip] rss-biobiochile (cache-hit del día)
[skip] rss-cooperativa (cache-hit del día)
[skip] rss-latercera (cache-hit del día)
[skip] rss-lacuarta (cache-hit del día)
[skip] rss-exante (cache-hit del día)
news-cli: descargados=0 skips=5

news-cli LIVE: feeds=5 descargados=0 skips=5 dbLoaded=true
```

Conteos DESPUÉS (mismo query):
```
count=5 | max(fetched_at)=2026-08-05 19:44:35.97+00
```

**Idénticos antes/después** — `fetched_at` invariante confirma que `BaseConnector.run()` jamás llegó a `snapshot.write` para ninguno de los 5 feeds: el early-exit ocurrió en `DailyCache.hasToday` → `SupabaseSnapshotLookup.hasSnapshot` → `true` para los 5, exactamente como predice el wiring de Task 2.

**Presupuesto de red gastado: 0 de 5 (Caso A).**

## Mutaciones registradas

**Task 1 (snapshot-lookup-supabase.ts):**
1. `throw` del branch de error → `return false`: el test de error (`error de PostgREST ⇒ LANZA...`) **FALLÓ** junto con el test de "service key nunca aparece" (que depende de que se lance). Los tests hit/miss (`data:{id:1}`/`data:null`) **siguieron PASANDO**. Revertido.
2. Quitar `.eq("date_bucket", dateBucket)`: el test que assert los 3 filtros exactos **FALLÓ** (solo 2 entradas en `eqCalls` en vez de 3). Revertido.

**Task 2 (connector-news.ts / snapshot-lookup-supabase.ts):**
1. Restaurar `cache = overrides.cache ?? { dailyKey: async()=>"", hasToday: async()=>false }` como default único (ignorando `supabase`): el caso `lookup=true` (esperado: 0 fetches, 5 `[skip]`) **FALLÓ** (`fetcherCalls` tuvo 5 en vez de 0). El control positivo (`lookup=false`, 5 fetches) **siguió PASANDO**. Revertido.
2. Fijar `.eq("resource", "rss-latercera")` para todos los calls: el assert de los 5 `resource` distintos (`new Set(...).size === 5`) **FALLÓ** (`size=1`). Revertido.

## Verificación

- `pnpm --filter @obs/news exec vitest run src/snapshot-lookup-supabase.test.ts` → 5 passed.
- `pnpm --filter @obs/news exec vitest run src/run-news-cli.test.ts src/connector-news.test.ts` → 31 passed (≥30).
- `pnpm --filter @obs/news test` → **133 passed / 11 files** (baseline 123 + 10 nuevos; piso 127 superado).
- `pnpm typecheck` → exit 0.
- `grep -c "hasToday: async () => false" packages/news/src/connector-news.ts` → 0.
- `grep -c "DailyCache" packages/news/src/connector-news.ts` → 5. `grep -c "SupabaseSnapshotLookup"` → 3.
- `grep -c 'vi.stubGlobal("fetch"' packages/news/src/run-news-cli.test.ts` → 1.
- `@obs/ingest` intacto: `BASE=7b188f3; git diff --name-only "$BASE"..HEAD | grep -c '^packages/ingest/'` → **0**. Diff acumulado desde BASE tocó solo `packages/news/src/*` (7 archivos: connector-news.ts, connector-news.test.ts, run-news-cli.ts, run-news-cli.test.ts, index.ts, snapshot-lookup-supabase.ts, snapshot-lookup-supabase.test.ts).
- `grep -Eic "supabase\.co|eyJ[A-Za-z0-9]"` sobre `snapshot-lookup-supabase.ts` y sobre este SUMMARY → 0 (B26).

## Deviations from Plan

None — plan ejecutado exactamente como está escrito. La única decisión de diseño no explicitada literalmente en el plan fue widen `BuildNewsDepsOptions.supabase` para aceptar un `client` inyectable opcional (Rule 1/2, necesario para que el test de wiring del par apareado pudiera ejercitar el camino REAL de `buildNewsDeps({ supabase })` —no un atajo con `cache` override directo— sin tocar red; sin esto, la mutación rectora de CR-01 no habría podido hacer caer el test de la forma que el plan exige).

## Self-Check

- `packages/news/src/snapshot-lookup-supabase.ts` → FOUND
- `packages/news/src/snapshot-lookup-supabase.test.ts` → FOUND
- Commit `aa526bf` (Task 1) → FOUND en `git log`
- Commit `53171f7` (Task 2) → FOUND en `git log`
- `/tmp/132-08-evidencia.log` (Task 3, evidencia) → contenido citado arriba, 5 líneas `[skip]` + resumen `descargados=0 skips=5`

## Self-Check: PASSED
