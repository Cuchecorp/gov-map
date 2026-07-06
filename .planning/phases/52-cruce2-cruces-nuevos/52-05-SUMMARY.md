---
phase: 52-cruce2-cruces-nuevos
plan: 05
subsystem: cruces (@obs/cruces) — corrida LIVE de datos (no-DDL)
tags: [lobby, clasificacion-sector, live-run, materializar-cruces, cruce-senal]
requires:
  - "modo --solo-confirmadas de 52-01 (carga incremental confirmadas-sin-sector)"
  - "cruces.materializar_cruces() en PROD (FULL REBUILD transaccional server-side)"
  - "MINIMAX_API_KEY (lobby) + DEEPSEEK_API_KEY (fichas) + SUPABASE_SECRET_KEY + SUPABASE_DB_URL"
provides:
  - "sector_id poblado en 2715 lobby_contraparte (era 34) + 65/74 proyecto_ficha (era 0)"
  - "cruce_senal re-materializado: 781 señales (era 30), 134 parlamentarios, 13 sectores"
affects:
  - "52-06 (checkpoint operador: apply 0047/0048) — el cruce sector ya está des-raquitizado LIVE"
tech-stack:
  added: []
  patterns:
    - "driver throwaway en dist/ (gitignored) reutiliza internals shipeados (clasificarContraparte/clasificarFicha + SupabaseCrucesWriter) + tolerancia por-fila (retry-once, skip poison) + checkpoint en tmpdir para resume"
    - "materializar_cruces() por psql directo (NUNCA supabase db push) — FULL REBUILD idempotente"
    - "verificación EXCLUSIVAMENTE por psql read-only (cruce_senal es PII_TABLE; jamás .from() desde app/)"
key-files:
  created: []
  modified: []
decisions:
  - "Corrida completada por el driver dist/_live-run.mts (no el CLI): añade tolerancia por-fila + checkpoint en tmpdir; single-pass = cada fila null visitada una vez, poison/abstención NO re-paga MiniMax"
  - "El residuo (2381 confirmadas + 9 fichas sin sector) son ABSTENCIONES del LLM (sector_codigo=null), no filas sin intentar: re-correr el driver dio procesados=0 skip=2381/9 (todas ya en checkpoint) — se acepta como residuo legítimo"
  - "cruce_senal quedó 100% tipo lobby_sector (781); el sector de fichas no genera señal en cruce_senal (alimenta otro cruce fuera de este plan)"
metrics:
  duration: ~15min (verificación + tail + materializar; la corrida masiva la lanzó el agente previo)
  completed: 2026-07-06
  tasks: 2
  files: 0
---

# Phase 52 Plan 05: Corrida LIVE clasificador sectorial + re-materializar cruce_senal Summary

Corrida LIVE de DATOS (no-DDL) que pobló `sector_id` en las contrapartes de lobby confirmadas y en las fichas de proyecto, y luego re-materializó `cruce_senal` por `cruces.materializar_cruces()`. El cruce sector — que ya está LIVE (0042 + Candado B) pero estaba raquítico con 30 señales porque solo 34/17.681 contrapartes tenían sector — ahora rinde **781 señales** cubriendo **134 parlamentarios** y **13 sectores**. Cero cambios de código, cero DDL, cero flag flipeado.

## What Was Done

**Clasificación LIVE (lobby + fichas).** La corrida masiva la lanzó el agente previo con el driver throwaway `dist/_live-run.mts` (gitignored) que reutiliza verbatim los internals shipeados (`clasificarContraparte`/`clasificarFicha` + `SupabaseCrucesWriter` con su RUT-gate + zod-gate + writer service-role), añadiendo tolerancia por-fila (retry-once → skip poison) y checkpoint en `tmpdir` para resume. Al retomar, se **re-corrió el mismo driver** para cerrar la cola:

- `lobby 8` → `2381 filas null cargadas; 5054 ya en checkpoint · DONE procesados=0 ok=0 abst=0 err=0 skip=2381` → **pasada completa**: las 2381 restantes son abstenciones del LLM ya visitadas (no filas sin intentar).
- `fichas 5` → `9 filas null cargadas; 74 ya en checkpoint · DONE procesados=0 skip=9` → **74/74 fichas visitadas**, 65 con sector, 9 abstenidas.

**Materializar.** `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -c "select cruces.materializar_cruces();"` (FULL REBUILD transaccional server-side, idempotente; NUNCA `supabase db push`).

**Verificación** por psql read-only (abajo).

## Conteos Before / After (PROD, psql read-only)

| Métrica | BEFORE (plan-time 2026-07-03) | AFTER (2026-07-06) |
|---|---|---|
| `lobby_contraparte` con sector | 34 | **2 715** |
| `proyecto_ficha` con sector | 0 / 74 | **65 / 74** |
| `cruce_senal` (señales) | 30 | **781** |
| distinct `parlamentario_id` en cruce_senal | 24 | **134** |
| distinct `sector_id` en cruce_senal | 10 | **13** |
| confirmadas-sin-sector (universo pendiente) | 5 062 | **2 381** (abstenciones) |

Todas las 781 señales son `tipo_senal = lobby_sector`.

## Muestra de evidencia (sin PII — parlamentario_id / sector / tipo / conteo)

| parlamentario_id | sector_id | tipo_senal | conteo |
|---|---|---|---|
| D1087 | gremios_trabajadores | lobby_sector | 62 |
| D1174 | mineria_energia | lobby_sector | 53 |
| D1128 | salud | lobby_sector | 40 |
| D1165 | salud | lobby_sector | 32 |
| D1039 | gremios_trabajadores | lobby_sector | 30 |
| D1075 | comercio_industria | lobby_sector | 29 |

## Residuo (documentado, aceptado)

- **2 381** contrapartes confirmadas quedan sin sector: son **abstenciones del LLM** (`sector_codigo=null`), visitadas una vez y marcadas en checkpoint — re-correr el driver dio `procesados=0 skip=2381`, confirmando que no son filas sin intentar. Single-pass por diseño: no se re-paga MiniMax por una abstención. Convergen si se re-corre con un prompt/modelo mejor a futuro (T-52-18: idempotente).
- **9** fichas sin sector: mismo caso (abstención DeepSeek), 74/74 visitadas.
- Filas poison (RUT-gate / zod-gate) se saltan por diseño (T-52-16): abortan la fila con 0/1 llamadas, no contaminan.

## Deviations from Plan

None material. El plan describía la ruta por `clasificar-lobby-cli --solo-confirmadas` (query-filtered `sector_id is null`); la corrida se completó con el driver equivalente `dist/_live-run.mts` que el agente previo eligió por su tolerancia por-fila + checkpoint de resume (evita morir en la primera falla transitoria de MiniMax sobre ~5k filas y no re-paga abstenciones). Mismo writer, mismos gates, misma selección (confirmadas-sin-sector). Sin cambios de código, sin DDL, sin flip de flag.

## Verification

- `count(*) from cruce_senal` = **781** >> 30 ✓ (psql read-only).
- distinct parlamentarios **134** (>24) y sectores **13** (>10) crecen ✓.
- Verificación 100% por psql; CERO `.from(cruce_senal)` desde app/ (T-52-17) ✓.
- `git status` limpio salvo este SUMMARY (driver vive en `dist/` gitignored) ✓.
- CERO DDL, CERO flag `*_PUBLIC_ENABLED` flipeado, CERO grant (T-52-19) ✓.

## Self-Check: PASSED

- FOUND: .planning/phases/52-cruce2-cruces-nuevos/52-05-SUMMARY.md
- Verificado en PROD: cruce_senal=781, con_sector=2715, ficha_con_sector=65 (psql read-only)
