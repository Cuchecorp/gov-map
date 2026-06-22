---
phase: 32-ops-redeploy-barrido-de-verificaci-n-en-producci-n
plan: 01
subsystem: ops
tags: [ops, deploy, cloudflare, opennext, wrangler, verificacion, produccion, invariantes]

# Dependency graph
requires:
  - phase: 25/26/27/28
    provides: "data poblada (lobby/patrimonio/votos) + fix de provenance (sourceLabel)"
  - phase: 23
    provides: "esquema/RPC aplicados al remoto"
provides:
  - "deploy de producción version e4347898 (observatorio-congreso.thevalis.workers.dev)"
  - "verificación en prod: secciones pobladas + provenance correcta + invariantes rectores intactos"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build OpenNext en Docker/Linux (Windows EPERM por symlinks) → docker cp .open-next → wrangler deploy (OAuth ya autenticado)"
    - "Docker run vía PowerShell, NO Git Bash (MSYS mangla /host → 'C:/Program Files/Git/host/...')"
    - "El frontend es SSR/data-driven: la DATA nueva aparece sin redeploy; el redeploy solo aplica cambios de CÓDIGO (Phase 28 sourceLabel)"

key-files:
  created:
    - .planning/phases/32-ops-redeploy-barrido-de-verificaci-n-en-producci-n/32-CONTEXT.md
    - .planning/phases/32-ops-redeploy-barrido-de-verificaci-n-en-producci-n/32-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Redeploy ejecutado: build OpenNext en node:22-bookworm (Docker) vía PowerShell, docker cp del bundle, wrangler deploy → version e4347898"
  - "Verificación passed: las secciones pobladas muestran datos reales con provenance correcta; los invariantes rectores siguen intactos"
  - "MONEY/NET siguen gated-OFF (/red, /contraparte → 404) — correcto: dependen de los sign-offs humanos F13/F17 (Phases 30/31)"

# Metrics
metrics:
  duration: ~20min
  completed: 2026-06-22
---

# Phase 32 Plan 01: OPS — Redeploy + barrido de verificación en producción Summary

Redeploy de producción + barrido de verificación que cierra el frente automatable de v3.0: las
secciones pobladas se ven en vivo con provenance correcta y los invariantes rectores intactos.

## What was done

- **Pre-deploy:** `pnpm --filter app typecheck` limpio + **252 tests verde** (incl. los 6 de PROV-01).
- **Build:** OpenNext en Docker/Linux (`node:22-bookworm`, `docker-cf-build.sh`) vía PowerShell
  (Git Bash manglaba `/host`); `docker cp obs-cf-build:/build/app/.open-next` al host.
- **Deploy:** `wrangler deploy` (OAuth autenticado, workers:write) → **version e4347898**,
  `https://observatorio-congreso.thevalis.workers.dev`.

## Barrido de verificación en prod (PASSED)

Ficha D843 (René García, 338 audiencias) + D1227 + S1320:
- **"fuente desconocida" → 0** (antes 4): el header muestra "Cámara"/"Senado" con fecha + enlace.
- **Lobby → "Ley del Lobby"** (82 en D843): antes mislabeled "InfoProbidad" (fix PROV-01 de orden).
- **Patrimonio → "InfoProbidad"**: declaraciones versionadas visibles.
- **Lobby poblado**: audiencias reales en la ficha (antes vacío).

Invariantes rectores INTACTOS:
- `/red` → **404** (NET gated-OFF) ✓
- `/contraparte/c:…` → **404** (MONEY gated-OFF) ✓
- `noindex`/robots presente en la ficha ✓
- sin fuga de partido/afiliación (0) ✓
- `/`, `/parlamentarios`, `/buscar` → 200 ✓

## Deviations from Plan

- La DATA ya estaba viva pre-deploy (SSR data-driven); el redeploy fue para el fix de código de
  Phase 28. MONEY/NET siguen OFF (correcto, dependen de F13/F17 humanos).

## Self-Check: PASSED
