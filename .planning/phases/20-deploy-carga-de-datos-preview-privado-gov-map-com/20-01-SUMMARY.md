---
phase: 20
plan: 01
subsystem: ingesta-identidad
tags: [deploy, ingesta, maestra, identidad, cloud, supabase, r2]
requires:
  - "20-CONTEXT.md (runbook: credenciales cloud, gotcha seed-cli LOCAL-default)"
  - ".env con SUPABASE_API_URL + SUPABASE_SECRET_KEY (cloud) — BOM removido"
  - "packages/identity/src/seed-cli.ts (seeder LIVE Senado+Cámara)"
provides:
  - "parlamentario (cloud) poblado: 186 filas, 100% estado=confirmado"
  - "supabase/seeds/parlamentario.seed.json refrescado (snapshot autoritativo, 118336 bytes)"
  - "crudo de catálogos persistido en R2 (etapa 1 regla LOCKED dos-etapas)"
affects:
  - "Desbloquea el orden FK: 20-02 (tramitación), 20-04 (votos/lobby/patrimonio) ya pueden cruzar identidad determinista"
tech-stack:
  added: []
  patterns:
    - "seed-cli escribe a la NUBE sobreescribiendo SUPABASE_LOCAL_URL/SUPABASE_LOCAL_SERVICE_KEY con los canales cloud (seeder no acepta --url)"
    - "Carga de .env BOM/CRLF-safe vía ~/obs_env.sh (single-quoted exports) — tsx/pnpm no auto-cargan .env"
key-files:
  created:
    - ".planning/phases/20-deploy-carga-de-datos-preview-privado-gov-map-com/20-01-SUMMARY.md"
  modified:
    - "supabase/seeds/parlamentario.seed.json (snapshot regenerado por la corrida)"
decisions:
  - "BOM re-aparecido en .env (re-agregado al editar en Windows) → removido in-place; regla NO-BOM de CLAUDE.md/CONTEXT"
  - "--promote aplicado: 186/186 confirmado (catálogo-vigentes=186, match-confirmado=186); ningún blanket-confirm de ambiguos"
  - "--r2 incluido: crudo persistido a R2 (token Read&Write OK) honrando la etapa 1 de la regla LOCKED"
metrics:
  duration: "~1 min (corrida) "
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 20 Plan 01: Carga de la maestra a la nube — Summary

La tabla `parlamentario` del Supabase de la NUBE (`bctyygbmqcvizyplktuw`) quedó poblada con la maestra real: **186 filas (31 senadores + 155 diputados), 100 % en estado `confirmado`**. Esto cierra el primer eslabón del orden FK obligatorio — los conectores posteriores ya pueden cruzar identidad determinista en vez de degradar a `no_confirmado`.

## What was built

- **seed-cli apuntado a la nube.** `seed-cli` lee su destino de `SUPABASE_LOCAL_URL`/`SUPABASE_LOCAL_SERVICE_KEY` (default `127.0.0.1:54421`) y no acepta flag de URL. Se sobreescribieron ambos canales con `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` (cloud) para esa corrida. Log final: `seed OK: total=186 senadores=31 diputados=155 dbLoaded=true promoted={"promovidos":186} r2Ok=true`, exit 0.
- **Verificación psql contra el cloud (pooler sa-east-1):** `select count(*) from parlamentario` → **186**; group-by por estado → `confirmado | 186`.
- **Snapshot + R2.** Snapshot git regenerado (`supabase/seeds/parlamentario.seed.json`, 118 KB) y crudo persistido en R2 (`--r2`, etapa 1 de la regla LOCKED de dos etapas).

## Deviations / notes

- **Gotcha resuelto:** `.env` traía BOM de nuevo (re-agregado al editar en Windows para meter el anon key) — removido in-place. Además es CRLF; la carga al shell se hace vía `~/obs_env.sh` (exports single-quoted, BOM/CRLF-safe) porque ni tsx ni pnpm auto-cargan `.env`.
- El log etiqueta el destino como "Supabase LOCAL" — es solo el nombre de la variable; la URL impresa es la del cloud y `dbLoaded=true` lo confirma.

## Self-Check: PASSED

- [x] `parlamentario` (cloud) count > 0 (186) verificado con psql
- [x] Filas en `confirmado` (186/186) — gate de identidad listo para tramitación
- [x] Snapshot autoritativo presente; crudo a R2
