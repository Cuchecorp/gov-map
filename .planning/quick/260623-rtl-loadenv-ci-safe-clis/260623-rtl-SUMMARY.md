---
phase: quick-260623-rtl
plan: 01
subsystem: ingesta-operador
tags: [ci, loadenv, lobby, probidad, github-actions, fase0]
requires: []
provides: ["CI-safe loadEnv en los CLIs flagship de lobby y probidad"]
affects:
  - packages/lobby/src/run-camara-lobby-cli.ts
  - packages/probidad/src/run-probidad-todos-cli.ts
tech-stack:
  added: []
  patterns: ["loadEnv try/catch + process.env overlay con precedencia (espejo de run-agenda-prod-cli)"]
key-files:
  created: []
  modified:
    - packages/lobby/src/run-camara-lobby-cli.ts
    - packages/probidad/src/run-probidad-todos-cli.ts
decisions:
  - "process.env tiene PRECEDENCIA sobre `.env` (el overlay corre DESPUÉS del catch) — CI inyecta secrets en process.env"
  - "Lobby overlay = 6 claves (Supabase + 4 R2); probidad = 2 claves (solo Supabase, no escribe R2)"
metrics:
  duration: ~2min
  completed: 2026-06-24
requirements: [FASE0-1]
---

# Phase quick-260623-rtl Plan 01: CI-safe loadEnv en CLIs flagship Summary

CI-safe `loadEnv` (try/catch alrededor del read de `.env` + overlay `process.env` con precedencia) en `run-camara-lobby-cli.ts` y `run-probidad-todos-cli.ts`, espejando el patrón ya correcto de `run-agenda-prod-cli.ts`, para desbloquear los workflows programados de lobby/probidad de Fase 1 del milestone v4.

## What Was Built

Los dos CLIs de operador llamaban `readFileSync(join(root, ".env"), "utf8")` sin try/catch. En GitHub Actions no existe archivo `.env` y los secrets se inyectan vía `process.env` → el read lanzaba ENOENT y mataba el CLI antes del primer fetch.

Ambas funciones `loadEnv` ahora:
1. Declaran `out` al tope.
2. Envuelven el read BOM-safe + parseo de líneas en un `try`.
3. Capturan con un `catch` vacío + comentario `// Sin \`.env\` (CI): los secrets vienen de process.env (abajo).`.
4. Corren un overlay loop DESPUÉS del catch que aplica `if (process.env[k]) out[k] = process.env[k]!;` — process.env tiene precedencia.

**Claves por archivo:**
- `run-camara-lobby-cli.ts` (6): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL`, `R2_BUCKET` (lobby escribe crudo a R2 en Etapa 1).
- `run-probidad-todos-cli.ts` (2): `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` (probidad solo escribe a Supabase, sin R2).

La JSDoc de `loadEnv` en ambos se actualizó al tono del CLI de agenda (nota del fallback process.env para CI). `cargarMaestra`, `main`, imports y headers de archivo no se tocaron.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Patch loadEnv en run-camara-lobby-cli.ts (CI-safe) | 1844b2f | packages/lobby/src/run-camara-lobby-cli.ts |
| 2 | Patch loadEnv en run-probidad-todos-cli.ts (CI-safe) | 399e3e2 | packages/probidad/src/run-probidad-todos-cli.ts |

## Verification

- `pnpm --filter @obs/lobby test` → 43/43 verde.
- `pnpm --filter @obs/probidad test` → 43/43 verde.
- `pnpm test` (root, acceptance gate) → EXIT=0, sin fallos (lobby 43, probidad 43, tramitacion 104, fichas 66, votos 3, etc.).
- Backwards-compatible: el read de `.env` local sigue intacto dentro del `try`; el overlay solo agrega/sobrescribe cuando la var existe en `process.env`.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: packages/lobby/src/run-camara-lobby-cli.ts (modified, `process.env[k]` present)
- FOUND: packages/probidad/src/run-probidad-todos-cli.ts (modified, `process.env[k]` present)
- FOUND commit: 1844b2f
- FOUND commit: 399e3e2
