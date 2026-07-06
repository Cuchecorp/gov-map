---
phase: 52-cruce2-cruces-nuevos
plan: 01
subsystem: cruces (@obs/cruces)
tags: [lobby, clasificacion-sector, cli, incremental, rut-gate]
requires:
  - "clasificar-lobby-cli existente (parseArgs compartido + cargarContrapartes plano)"
  - "schema lobby_contraparte.sector_id (0038) + lobby_audiencia (0021) en PROD"
provides:
  - "modo --solo-confirmadas: carga incremental de contrapartes confirmadas-sin-sector"
  - "cargarContrapartes exportado (testeable)"
affects:
  - "52-05 (corrida LIVE que puebla sector_id de contrapartes usa este modo)"
tech-stack:
  added: []
  patterns:
    - "supabase-js embed !inner para restringir por join (lobby_audiencia!inner)"
    - "is(col,null) como filtro que hace la carga naturalmente incremental/resumible"
key-files:
  created:
    - packages/cruces/src/clasificar-lobby-cli.test.ts
  modified:
    - packages/cruces/src/clasificar-lobby-cli.ts
    - packages/cruces/src/clasificar-fichas-cli.ts
decisions:
  - "El flag es un case booleano en el parser COMPARTIDO (un solo case cubre ambos CLIs); inerte en fichas por comportamiento (fichas clasifica TODAS, decisión LOCKED)"
  - "sector_id is null es load-bearing: hace la corrida incremental — re-correr AVANZA en vez de re-pagar las mismas llamadas MiniMax críticas"
  - "cargarContrapartes se exporta para test directo del query-shape (spy sobre el builder encadenado), en vez de inyectar un client en main()"
metrics:
  duration: ~8min
  completed: 2026-07-06
  tasks: 2
  files: 3
---

# Phase 52 Plan 01: --solo-confirmadas (carga incremental de lobby) Summary

Modo `--solo-confirmadas` en `clasificar-lobby-cli` que carga SOLO contrapartes en audiencia confirmada (`lobby_audiencia!inner` con `estado_vinculo='confirmado'` y `parlamentario_id` no-null) y con `sector_id is null`, haciendo la corrida de etiquetado de sector alto-ROI e incremental sin re-pagar llamadas MiniMax ya realizadas.

## What Was Built

**Task 1 — flag en el parser compartido.** Se añadió `case "--solo-confirmadas"` (booleano, espejo exacto de `--dry-run`) al `parseArgs` de `clasificar-fichas-cli.ts` (el parser que ambos CLIs comparten vía `parseArgsBase`), y el campo opcional `soloConfirmadas?: boolean` a `FichasCliOptions` (inerte en fichas) y a `LobbyCliOptions`. El fail-fast ante flag desconocido queda intacto.

**Task 2 — rama de carga filtrada en `cargarContrapartes`.** Cuando `opts.soloConfirmadas` es true, la carga usa el embed `lobby_audiencia!inner(estado_vinculo, parlamentario_id)` + `.is("sector_id", null)` + `.eq("lobby_audiencia.estado_vinculo", "confirmado")` + `.not("lobby_audiencia.parlamentario_id", "is", null)` + `.limit()`. El escape hatch `opts.filas` (tests) precede a toda query; el early-return dry-run-sin-client queda igual; la carga plana original queda como fallback intacto sin el flag. Mapeo de filas factorizado en `mapearFila` (rol omitido si null), compartido por ambas ramas. `cargarContrapartes` se exportó para el test directo del query-shape.

## Incremental / RUT-gate

- **Incremental:** `sector_id is null` excluye lo ya clasificado → cada corrida clasifica lo pendiente y la siguiente lo omite; re-correr con `--limite` mayor AVANZA (no re-lee desde el tope).
- **RUT-gate intacto:** el loop de clasificación (`main`) sigue corriendo `clasificarContraparte(inputDeFila(fila), provider)` con `assertNoRutInLlmInput` PRIMERO, SIN envolver en try/catch (verificado por grep: los únicos try/catch viven en el entry-point CLI, no en el loop). La carga nueva no toca esa ruta.

## Deviations from Plan

None - plan executed exactly as written. Se factorizó el mapeo repetido en un helper `mapearFila` (mejora de claridad, sin cambio de comportamiento; ambas ramas producían el mismo mapeo).

## Verification

- `pnpm --filter @obs/cruces test -- --run` → 29 passed / 1 skipped (5 test files verde); `clasificar-lobby-cli.test.ts` = 8 tests nuevos (parser 4 + escape hatch 1 + filtro 2 + no-regresión 1).
- `pnpm --filter @obs/cruces exec tsc -b` → limpio (exit 0), sin errores por el campo nuevo.
- grep: `assertNoRutInLlmInput`/`clasificarContraparte` en el loop NO envuelto en try/catch.
- NO se corrió nada LIVE (eso es 52-05); NO se aplicó DDL.

## Commits

- `ffab76a` test(52-01): failing tests (RED) para parser + carga filtrada
- `3bb3c1b` feat(52-01): flag --solo-confirmadas en parser compartido + tipos
- `73be00b` feat(52-01): rama de carga filtrada en cargarContrapartes

## Self-Check: PASSED

- FOUND: packages/cruces/src/clasificar-lobby-cli.test.ts
- FOUND: commits ffab76a, 3bb3c1b, 73be00b
