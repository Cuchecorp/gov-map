---
phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated
plan: 01
subsystem: frontend-gates
tags: [gate, server-only, fail-closed, anti-insinuacion, doble-candado, SURF-01]
requires:
  - "migraciones 0039/0040 en PROD (Candado A — RPC sin grant anon + RLS deny-by-default sobre cruce_senal)"
provides:
  - "crucesPublicEnabled(env): boolean — Candado B (presentación) del doble candado de exposición de cruces"
affects:
  - "37-03 (página ficha): consumidor único vía crucesPublicEnabled(process.env)"
tech-stack:
  added: []
  patterns:
    - "gate server-only fail-closed (=== \"true\"), espejo byte-a-byte de money-gate/net-gate"
    - "TDD RED→GREEN (test de tabla de verdad primero)"
key-files:
  created:
    - app/lib/cruces-gate.ts
    - app/lib/cruces-gate.test.ts
  modified: []
decisions:
  - "Mirror byte-a-byte de money-gate.ts: solo difieren nombre de función (crucesPublicEnabled), var de entorno (CRUCES_PUBLIC_ENABLED) y docstring (cruces/Phase 39/0039-0040)"
  - "Flag ships OFF — encender es Phase 39 (firma humana exclusiva); un agente NUNCA lo flipea"
metrics:
  duration: ~4min
  completed: 2026-06-24
---

# Phase 37 Plan 01: Gate crucesPublicEnabled (Candado B) Summary

Gate de presentación server-only `crucesPublicEnabled()` — Candado B del doble candado de exposición de cruces — fail-closed (solo el literal `"true"` enciende), espejo byte-a-byte de `money-gate.ts`/`net-gate.ts`, con su tabla de verdad verde (5/5). El flag ships OFF; no tiene consumidor todavía (37-03 lo cablea).

## What Was Built

- **`app/lib/cruces-gate.ts`** (nuevo): `crucesPublicEnabled(env = process.env): boolean` → `return env.CRUCES_PUBLIC_ENABLED === "true"`. `import "server-only";` en línea 1; var SIN prefijo `NEXT_PUBLIC_`; comparación estricta al literal (sin truthiness laxa). El docstring deja explícito el doble candado: Candado A = RPC `cruces_de_parlamentario` SIN grant a anon + RLS deny-by-default sobre `cruce_senal` (migraciones 0039/0040, ya en PROD); Candado B = este gate. Encender requiere `signoff: approved` (Phase 39, firma humana exclusiva) — un agente NUNCA flipea este flag. Chokepoint WR-02: el consumidor único es la página 37-03.
- **`app/lib/cruces-gate.test.ts`** (nuevo): tabla de verdad de 5 casos (espejo de `money-gate.test.ts`): `{}`/`"false"`/`"1"`/`"TRUE"` → `false`; `"true"` → `true`.

## How It Was Verified

- `cd app && npx vitest run cruces-gate` → 5/5 verde, exit 0.
- `git grep -n "NEXT_PUBLIC_" app/lib/cruces-gate.ts` → sin match (exit 1).
- `git status --short` → CERO archivos bajo `supabase/migrations/`, CERO `.env` modificado.

## TDD Gate Compliance

- RED: `test(37-01)` commit `1908e22` — test escrito primero, falló por módulo `./cruces-gate` inexistente (no por aserción — el patrón correcto para un módulo nuevo).
- GREEN: `feat(37-01)` commit `b09d72f` — 5/5 verde.
- REFACTOR: no necesario (el archivo nació como mirror limpio).

## Deviations from Plan

None - plan executed exactly as written.

## Constraints Honored (LOCKED)

- Flag OFF (default). `import "server-only"` línea 1; var `CRUCES_PUBLIC_ENABLED` sin `NEXT_PUBLIC_`; `=== "true"` estricto.
- CERO `.env`/`.env.example` modificado para encender el flag.
- CERO DDL — `supabase/migrations/` intacto.
- Docstring declara: encender = Phase 39 (firma humana); doble candado A (RPC sin grant + RLS 0039) + B (este gate).

## Self-Check: PASSED

- FOUND: app/lib/cruces-gate.ts
- FOUND: app/lib/cruces-gate.test.ts
- FOUND: commit 1908e22 (test/RED)
- FOUND: commit b09d72f (feat/GREEN)
