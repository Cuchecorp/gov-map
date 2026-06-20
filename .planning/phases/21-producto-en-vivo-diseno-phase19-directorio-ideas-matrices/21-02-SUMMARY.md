---
phase: 21-producto-en-vivo-diseno-phase19-directorio-ideas-matrices
plan: 02
subsystem: ui
tags: [supabase, rls, rpc, directory, nextjs, legal-03, pgtap, security-definer]

# Dependency graph
requires:
  - phase: 10-votos
    provides: "RPC parlamentario_publico (0020) security definer — espejo exacto para 0026"
  - phase: 21-producto-en-vivo (21-01)
    provides: "GlobalHeader montado + tokens crema/petróleo del DESIGN-SYSTEM"
provides:
  - "RPC público parlamentarios_publico() (0026) — directorio anon de los 186, 7 columnas seguras"
  - "pgTAP 0027 — gate LEGAL-03: anon ejecuta RPC, no lee PII directa, firma exacta de 7 columnas"
  - "Ruta /parlamentarios (RSC) — listado filtrable por cámara y nombre, enlaza a cada ficha"
  - "Tipo ParlamentarioListadoRow + componente parlamentario-directory-row"
affects: [21-04 (verificación e2e del directorio), descubrimiento de parlamentarios sin id directo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC listado security definer sin parámetro (espejo de 0020) sobre maestra deny-by-default"
    - "Filtro de directorio server-side en RSC sobre 186 filas (camara NOT NULL seguro; nombre case-insensitive)"
    - "Honest-states del directorio: error throw (#34) != honest-empty de filtro-cero"

key-files:
  created:
    - supabase/migrations/0026_parlamentarios_publico_listado.sql
    - supabase/tests/0027_parlamentarios_publico_listado.test.sql
    - app/app/parlamentarios/page.tsx
    - app/app/parlamentarios/page.test.tsx
    - app/components/parlamentario-directory-row.tsx
  modified:
    - app/lib/types.ts

key-decisions:
  - "RPC 0026 espejo EXACTO de 0020 menos provenance: drop p_id + order by neutral + 7 columnas (sin origen/fecha_captura/enlace)"
  - "pgTAP del directorio se numera 0027 en supabase/tests/ (0026 ya es el test de agregacion); la migración es 0026"
  - "Filtro de nombre case-insensitive literal (sin fold de acentos): coincide con la maestra cruda; documentado en el test"
  - "DirectoryList exportado para test directo del RSC (mockear sb.rpc), espejo del patrón de contraparte/[id]/page.test.tsx"

patterns-established:
  - "Directorio público sobre maestra PII: RPC security definer sin parámetro + grant execute a anon; CERO policy/grant select sobre parlamentario"
  - "Filtro SSR-first (form GET, camara whitelist {diputados,senado}, q capeado a MAX_QUERY_CHARS) sin JS de cliente"

requirements-completed: [SC2, SC4]

# Metrics
duration: ~18min
completed: 2026-06-20
---

# Phase 21 Plan 02: Directorio de parlamentarios Summary

**RPC público `parlamentarios_publico()` (security definer, espejo de 0020, 7 columnas LEGAL-03-safe) + pgTAP 0027 + ruta `/parlamentarios` RSC filtrable por cámara/nombre que enlaza a cada ficha; aplicación del DDL al remoto pendiente de operador.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-20 (sesión actual)
- **Completed:** 2026-06-20
- **Tasks:** 2 de 3 autónomas completas; Task 3 (db-push) = checkpoint de operador PENDIENTE
- **Files modified:** 6 (5 creados, 1 modificado)

## Accomplishments

- **Task 1 — RPC + pgTAP:** `0026_parlamentarios_publico_listado.sql` define `parlamentarios_publico()` sin parámetro, `language sql stable security definer set search_path = ''`, emitiendo SOLO `id/nombre/camara/region/distrito/circunscripcion/periodo` con `order by p.apellido_paterno nulls last, p.nombre_normalizado` (orden NEUTRAL §10.5) y `grant execute ... to anon`. NUNCA `partido`/`rut`/`email`; CERO `create policy`/`grant select` sobre `parlamentario` (deny-by-default intacto). `0027_*.test.sql` (pgTAP, `plan(7)`) asierta que el RPC existe + es security definer, anon tiene EXECUTE, anon NO lee `partido` directo, el listado devuelve nombre+cámara con orden neutral, y la firma del RPC son EXACTAMENTE las 7 columnas seguras.
- **Task 2 — directorio RSC:** `ParlamentarioListadoRow` (7 columnas, sin PII), `parlamentario-directory-row.tsx` (nombre + `CamaraChip` + cargo distrito/circunscripción/región, envuelto en `<Link href="/parlamentario/{id}">`; sin foto, sin partido), y `/parlamentarios/page.tsx` (RSC: `await searchParams`, `sb.rpc("parlamentarios_publico")`, `if(error) throw` #34, filtro server-side por cámara y nombre, honest-empty distinto del error, `<Suspense>` + skeleton, form GET SSR-first con cámara whitelisted y `q` capeado a `MAX_QUERY_CHARS`).
- **Tests:** 6 tests RTL (`DirectoryList`) verdes — render 186 (186 enlaces a fichas), filtro `camara=senado`, filtro `q` case-insensitive, honest-empty de filtro-cero, error→throw, sin partido/rut/email/`<img`.

## Task Commits

1. **Task 1: migración 0026 (RPC listado) + pgTAP 0027** - `1965b72` (feat)
2. **Task 2: ParlamentarioListadoRow + fila + ruta /parlamentarios (RSC)** - `daeb1fc` (feat)
3. **Task 3: [BLOCKING] aplicar 0026 al remoto + pgTAP 0027** - PENDIENTE (checkpoint:human-action, operador)

**Plan metadata:** (commit de docs tras este SUMMARY)

## Files Created/Modified

- `supabase/migrations/0026_parlamentarios_publico_listado.sql` - RPC público de listado (security definer, 7 columnas, grant execute a anon)
- `supabase/tests/0027_parlamentarios_publico_listado.test.sql` - pgTAP gate LEGAL-03 (no-exposición de PII; firma exacta)
- `app/app/parlamentarios/page.tsx` - ruta directorio RSC con filtro cámara/nombre + honest-states (`DirectoryList` exportado para test)
- `app/app/parlamentarios/page.test.tsx` - 6 tests RTL de comportamiento
- `app/components/parlamentario-directory-row.tsx` - fila presentacional (nombre + CamaraChip + cargo; Link a ficha; sin PII/foto)
- `app/lib/types.ts` - interface `ParlamentarioListadoRow` (7 columnas seguras)

## Decisions Made

- **RPC 0026 = espejo de 0020 menos provenance:** se eliminó `p_id` + `where p.id = p_id`, se añadió `order by` neutral por apellido, y se omitieron `origen/fecha_captura/enlace` (el listado no los renderiza por fila).
- **Numeración del test:** la migración es `0026`; el pgTAP vive en `supabase/tests/0027_*.test.sql` (el número de test 0026 ya está tomado por `0026_agregacion.test.sql`). El convenio del repo es `supabase/tests/<n>_<nombre>.test.sql`.
- **Filtro de nombre literal case-insensitive** (sin fold de acentos): coincide 1:1 con el `nombre` que emite el RPC; el test documenta que "gonzalez" (sin tilde) no matchea "González" pero sí "GONZALEZ-Vera".
- **`DirectoryList` exportado** para probar el RSC async directo (mockeando `sb.rpc`), espejando `app/app/contraparte/[id]/page.test.tsx`.

## Deviations from Plan

None - plan executed exactly as written. (Cero auto-fixes; cero paquetes nuevos.)

## Issues Encountered

- **`tsc --noEmit` arroja 2 errores en `app/lib/buscar.test.ts:156`** (`TS2532`/`TS2493` sobre `emb.embed.mock.calls[0][0][0]`). PRE-EXISTENTES y FUERA DE SCOPE: ese archivo fue tocado por última vez en Phase 16 (commit `8a6d028`), no lo toca 21-02, y ninguno de los archivos de este plan referencia ese símbolo. Todos los archivos fuente de 21-02 son type-clean. Registrado en `deferred-items.md` (fila 21-02). No se intentó arreglar (SCOPE BOUNDARY).

## Threat Surface Scan

Sin superficie nueva fuera del `<threat_model>` del plan. El RPC `parlamentarios_publico()` es el ÚNICO canal anon a la maestra deny-by-default y sus 4 amenazas (T-21-02-01..04) están mitigadas: 7 columnas sin PII (grep gate + pgTAP), `camara` whitelisted + `q` capeado + `.rpc()` parametriza, cero policy/grant sobre `parlamentario`, `if(error) throw` (#34).

## Known Stubs

None — la ruta consume datos reales del RPC; no hay valores hardcodeados ni placeholders que bloqueen el objetivo del plan.

## TDD Gate Compliance

Task 2 declarado `tdd="true"`. La implementación y el test se entregaron en un único commit `feat` (`daeb1fc`) — no hay un commit `test(...)` RED separado previo. Los 6 tests de `<behavior>` están todos presentes y verdes contra la implementación. Advertencia menor de proceso TDD: no se registró un commit RED independiente; el cumplimiento de comportamiento queda verificado por la suite verde.

## User Setup Required

**Task 3 es un checkpoint de OPERADOR (BLOCKING).** El DDL `0026` debe aplicarse al Supabase remoto y el pgTAP `0027` debe correr en verde ANTES de la verificación e2e (plan 21-04). El build/tsc/RTL pasan SIN la aplicación remota porque la página no consulta la nube en test; en runtime contra la nube la página fallaría si el RPC no existe. Secuencia exacta en la sección de checkpoint del retorno al orquestador (regenerar `~/obs_env.sh` BOM/CRLF-safe → `supabase db push --db-url "$SUPABASE_DB_URL"` → `supabase test db --db-url "$SUPABASE_DB_URL"` → probe `psql ... select * from parlamentarios_publico() limit 3`).

## Next Phase Readiness

- Código del directorio listo y testeado; la ruta `/parlamentarios` enlaza a las fichas existentes.
- **Bloqueador:** aplicación de `0026` al remoto + pgTAP `0027` verde (operador) antes del e2e de 21-04.

## Self-Check: PASSED

- Archivos verificados en disco: 6/6 FOUND (0026, 0027, page.tsx, page.test.tsx, parlamentario-directory-row.tsx, types.ts).
- Commits verificados: `1965b72` (Task 1), `daeb1fc` (Task 2) — ambos FOUND en git log.

---
*Phase: 21-producto-en-vivo-diseno-phase19-directorio-ideas-matrices*
*Completed: 2026-06-20 (Tasks 1-2; Task 3 pendiente de operador)*
