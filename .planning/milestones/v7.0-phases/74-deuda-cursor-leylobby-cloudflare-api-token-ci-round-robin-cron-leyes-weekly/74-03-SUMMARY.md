---
phase: 74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly
plan: 03
subsystem: infra
tags: [freshness, cloudflare, ci, secrets, operator-note, min-signal, rotacion, vitest, tdd]

# Dependency graph
requires:
  - phase: 74-02
    provides: cursor de rotación round-robin (leyes_rotacion_estado) cuya cola sin refrescar la señal MIN-edad hace VISIBLE
  - phase: freshness (v6.0)
    provides: catálogo declarativo FuenteConfig + evaluate() puro (stale = null|días>umbral, fail-closed) reusado TAL CUAL por la señal MIN
provides:
  - Nota de operador 74-DEBT-03-CF-TOKEN-OPERATOR-NOTE (DEBT-03: cargar el VALOR del secret en Cuchecorp/gov-map; referencia YAML verificada correcta)
  - Señal de EDAD-MÍNIMA de leyes (leyes-min-edad, MIN(fecha_captura), umbral 45) que revela la dilución/rotación sin regresionar las señales MAX v6.0
  - FuenteConfig.agregado?: "MAX"|"MIN" — campo aditivo (default MAX) que deja todas las entradas existentes idénticas
affects: [pnpm freshness (visibilidad honesta de la cola de proyectos), deploy CI reproducible (secret pendiente de operador)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Señal de frescura por agregado configurable (cfg.agregado ?? MAX) — MIN revela la cola más vieja, MAX el último upsert; ambas coexisten sobre la misma tabla/columna"
    - "Verificación estática de referencia de secret vía grep (0 crons de ingesta) + nota de operador anti-mal-interpretación en vez de cablear el token"

key-files:
  created:
    - .planning/phases/74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly/74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md
  modified:
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/query-runner.ts
    - packages/freshness/src/evaluate.test.ts

key-decisions:
  - "DEBT-03 rector: CLOUDFLARE_API_TOKEN es concern de DEPLOY, no de ingesta. La referencia ya es correcta (deploy-cloudflare.yml); la deuda es de operador (cargar el VALOR en GH settings). NO se cablea el token en crons de ingesta (sería mala interpretación — T-74-10)"
  - "Señal MIN ADITIVA vía FuenteConfig.agregado? (default MAX): un solo campo opcional deja las 8 entradas MAX v6.0 idénticas (todas omiten agregado). queryFreshness usa cfg.agregado ?? MAX"
  - "leyes-min-edad umbral 45d GENEROSO: la rotación cubre la cola en ~6-7 semanas; 45d da margen para una vuelta completa sin declarar stale de más"
  - "evaluate() se reusa TAL CUAL: la fila MIN se evalúa con la misma regla fail-closed (null/ilegible → stale). Cero cambio de lógica en el evaluador"
  - "Agregado del enum cerrado FuenteConfig.agregado (MAX|MIN), NUNCA de input externo → sin superficie de inyección en la SQL (T-68-03 preservado)"

metrics:
  duration: ~20 min
  tasks: 2
  files: 4
  completed: 2026-07-14
---

# Phase 74 Plan 03: DEBT-03 (CF token operator note) + señal MIN-edad de freshness Summary

Cierra DEBT-03 y SC#4 de la fase 74. **DEBT-03 (rector):** verificado que `CLOUDFLARE_API_TOKEN` aparece SOLO en `deploy-cloudflare.yml` (consumido por el job `deploy`) y que NINGÚN cron de ingesta lo referencia (escriben a Supabase+R2, no a Cloudflare) — la deuda real es de operador (cargar el VALOR del secret en Cuchecorp/gov-map), documentada en una nota que explícitamente advierte contra cablear el token en los crons. **SC#4:** añadida una señal de EDAD-MÍNIMA (`leyes-min-edad`, `MIN(fecha_captura)`, umbral 45d) que revela el proyecto más viejo sin refrescar — un solo refresh ya no oculta la dilución de ~3.657 proyectos — SIN regresionar las señales `MAX` v6.0.

## What Was Built

### Task 1 — Verificación de la referencia CF + nota de operador (commit 8da274d)
- **Verificación estática (grep):** `CLOUDFLARE_API_TOKEN` en `.github/workflows/` → EXACTAMENTE `deploy-cloudflare.yml` (verify-gate `grep -rl … | grep -v deploy-cloudflare.yml | wc -l` = 0 → `OK-solo-deploy`). Confirmado que el step "Build + Deploy" lo consume vía `env:`. Confirmado en `leyes-weekly.yml:56-67` que los crons de ingesta sólo llevan `SUPABASE_*` + `R2_*`.
- **`74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md`** (72 líneas): hallazgo rector (CF = deploy, no ingesta), evidencia del grep (1 archivo / 0 crons), paso de operador (GH Settings → Secrets → añadir `CLOUDFLARE_API_TOKEN` "Edit Cloudflare Workers" + `CLOUDFLARE_ACCOUNT_ID`, verificar billing, disparar deploy verde), y la aclaración anti-mal-interpretación explícita (un diff que añada el token a un cron de ingesta = incorrecto). NO contiene ningún valor de secret literal. NINGÚN YAML modificado (git diff de crons + deploy vacío).

### Task 2 (TDD) — Señal de edad-mínima de leyes (RED 4bdeaff → GREEN 80aee6d)
- **RED (4bdeaff):** 7 tests nuevos en `evaluate.test.ts` — forma de la entrada `leyes-min-edad` (MIN, umbral 45), MIN>umbral → stale (dilución visible), cola fresca → no stale, null/ilegible → stale fail-closed, override `FRESHNESS_UMBRAL_LEYES_MIN_EDAD`, y DOS aserciones de NO-REGRESIÓN (leyes sigue MAX/umbral 7; sólo `leyes-min-edad` usa MIN, las 6 fuentes v6.0 conservan `agregado` undefined = MAX). Corrían en rojo.
- **GREEN (80aee6d):**
  - `FuenteConfig.agregado?: "MAX" | "MIN"` (default MAX, documentado como aditivo).
  - Entrada `CATALOG` `leyes-min-edad` (`proyecto.fecha_captura`, `agregado: "MIN"`, umbral 45, `overrideEnv: FRESHNESS_UMBRAL_LEYES_MIN_EDAD`, `workflowYml: leyes-weekly.yml`) con comentario que explica por qué MIN revela la rotación del plan 74-02 y MAX no.
  - `queryFreshness`: `const agregado = cfg.agregado ?? "MAX"; SELECT ${agregado}(${cfg.columna}) …` — cambio quirúrgico; las entradas existentes (todas sin `agregado`) quedan idénticas. El agregado viene del enum cerrado, no de input externo (sin inyección).
  - `evaluate()` NO se tocó: la fila MIN se evalúa con la misma regla stale.

## Verification

- `pnpm --filter @obs/freshness test` → **44 tests verdes** (37 previos + 7 nuevos).
- `pnpm --filter @obs/freshness typecheck` (`tsc -b`) → exit 0.
- `pnpm test` (monorepo) → **819 tests verdes** (74 files) — sin regresión.
- `pnpm freshness` corre y muestra la fila `leyes-min-edad` DISTINTA de `leyes`: `leyes` MAX (último upsert 4d, OK) y `leyes-min-edad` MIN (proyecto más viejo 5d, umbral 45, OK) — dos señales honestas separadas sobre la misma tabla. La señal MIN se pondría STALE si la cola dejara de rotar >45d.
- `grep -rl CLOUDFLARE_API_TOKEN .github/workflows/` → sólo `deploy-cloudflare.yml`; verify-gate `OK-solo-deploy`.
- Nota de operador presente (72 líneas ≥ 20) sin ningún valor de token literal.

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. La entrada `leyes` (MAX) quedó intacta; el evaluador no necesitó extensión (la regla stale genérica cubre MIN sin cambios).

## Authentication Gates

Ninguna en la ejecución del agente. `pnpm freshness` corrió read-only contra la DB (credenciales de `.env` disponibles localmente) y degradó honestamente donde no había datos; no se escribió nada, no se corrió ningún cron LIVE.

## Known Stubs

Ninguno. La señal MIN está totalmente cableada (catálogo + runner + evaluador reusado + tests). La nota de operador es documentación completa del acto humano pendiente.

## Operator Debt / Checkpoint PENDIENTE

**Checkpoint `human-action` (autonomous:false — RECORDED PENDING, NO ejecutado por el agente):**
Cargar el VALOR de `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` en **Cuchecorp/gov-map** → Settings → Secrets and variables → Actions; verificar billing GH activo; disparar `deploy-cloudflare.yml` (workflow_dispatch) → confirmar deploy VERDE (deploy reproducible en CI, sin fallback wrangler local). Detalle en `74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md`. **Resume-signal:** escribir "cargado" (con el resultado del deploy) o describir el fallo (billing/permiso).

Opcional (sobre semanas): observar que la señal `leyes-min-edad` de `pnpm freshness` tiende a la baja a medida que la rotación del cron `leyes-weekly` (plan 74-02) cubre el corpus. Nota: el plan 74-02 dejó la migración 0054 (`leyes_rotacion_estado`) SIN aplicar a PROD (deuda de operador de ese plan).

## Self-Check: PASSED

- Archivos verificados en disco: `74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md`, `catalog.ts`, `query-runner.ts`, `evaluate.test.ts`, `74-03-SUMMARY.md` → todos FOUND.
- Commits verificados en git log: 8da274d (Task 1), 4bdeaff (RED), 80aee6d (GREEN) → todos FOUND.
