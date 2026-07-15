---
phase: quick-260715-bvd
plan: 01
subsystem: build/dependencies
tags: [security, dependabot, pnpm, overrides]
requires: []
provides: [DEPABOT-POSTCSS, DEPABOT-UUID, DEPABOT-ESBUILD]
affects: [pnpm-workspace.yaml, pnpm-lock.yaml]
tech-stack:
  added: []
  patterns: ["pnpm overrides en pnpm-workspace.yaml (pnpm 11.x) para fijar transitivas vulnerables"]
key-files:
  created: []
  modified: [pnpm-workspace.yaml, pnpm-lock.yaml]
decisions:
  - "pnpm 11.3.0 YA NO lee `pnpm.overrides` desde package.json → los overrides van en pnpm-workspace.yaml"
  - "override `esbuild: ^0.28.1` consolida además esbuild@0.25.4 (no vulnerable) a una sola versión"
metrics:
  duration: "~10 min"
  completed: 2026-07-15
---

# Quick 260715-bvd: Parchar 3 alertas Dependabot (postcss/uuid/esbuild) Summary

Cerradas las 3 alertas Dependabot de dependencias TRANSITIVAS vía `overrides` en
`pnpm-workspace.yaml`, regenerando el lockfile sin ninguna versión en rango
vulnerable y con la suite completa (packages 1103 + app 820) en verde.

## Qué se hizo

| Dependencia | Antes (vulnerable) | Después (parchado) | Severidad | CVE-clase |
|-------------|--------------------|--------------------|-----------|-----------|
| postcss | 8.4.31 | 8.5.15 (`^8.5.10`) | medium | XSS por `</style>` sin escapar en stringify |
| uuid | 8.3.2 | 11.1.1 (`^11.1.1`) | medium | bounds-check del buffer (exceljs usa `v4()` sin `buf` → path no ejercido) |
| esbuild | 0.27.7 (+0.25.4) | 0.28.1 (`^0.28.1`) | low | lectura arbitraria vía dev-server en Windows |

- **Task 1** — Se añadió el bloque `overrides` con las 3 entradas y se regeneró
  el lock con `pnpm install --lockfile-only`.
- **Task 2** — Verificado por inspección directa que el lock no contiene
  postcss@8.4.31, esbuild@0.27.7 ni uuid@8.3.2 (ni ningún rango pre-parche).
- **Task 3** — `pnpm install` completo + `pnpm test`: 1103 tests de packages
  (incl. `packages/dinero` 167, que ejerce exceljs → uuid@11.1.1) + 820 de app,
  TODO EN VERDE.
- **Task 4** — Commit atómico `72be412` de `pnpm-workspace.yaml` + `pnpm-lock.yaml`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El mecanismo del plan (`pnpm.overrides` en package.json) no funciona en pnpm 11.3.0**
- **Found during:** Task 1
- **Issue:** El plan pedía añadir el bloque `pnpm.overrides` a `package.json` raíz.
  Al correr `pnpm install --lockfile-only`, pnpm 11.3.0 emitió
  `[WARN] The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.overrides"`
  y dejó el lockfile INTACTO (las 3 versiones vulnerables seguían presentes).
- **Fix:** En pnpm 11.x los overrides viven en `pnpm-workspace.yaml`
  (ver https://pnpm.io/settings). Se revirtió `package.json` a su estado
  original y se colocó el bloque `overrides` en `pnpm-workspace.yaml`. La
  segunda pasada de `pnpm install --lockfile-only` NO emitió warning y aplicó
  los overrides correctamente.
- **Files modified:** `pnpm-workspace.yaml` (en vez de `package.json`), `pnpm-lock.yaml`
- **Commit:** 72be412

**2. [Rule 3 - Blocking] Placeholder `allowBuilds:` auto-inyectado por pnpm**
- **Found during:** Task 3 (`pnpm install`)
- **Issue:** Al materializar node_modules, pnpm disparó el gate
  `ERR_PNPM_IGNORED_BUILDS` (esbuild@0.28.1 es una instalación fresca) e
  inyectó un bloque `allowBuilds:` con texto placeholder inválido
  (`esbuild: set this to true or false`) en `pnpm-workspace.yaml`.
- **Fix:** Se eliminó el bloque placeholder. El repo ya gestiona los
  build-scripts vía `onlyBuiltDependencies` (documentado en el propio yaml);
  el gate es informativo (exit 0) y no bloquea `pnpm test` (que corre con
  `verifyDepsBeforeRun: false`). No se dejó el placeholder en el commit.
- **Files modified:** `pnpm-workspace.yaml` (limpieza; no queda residuo)
- **Commit:** 72be412

### Nota sobre `packages/servel`

El plan mencionaba `packages/servel` como consumidor de exceljs → uuid. No existe
tal package: el código SERVEL (`parse-servel.ts`, `ingest-run-servel.test.ts`,
`parse-servel.test.ts`) vive DENTRO de `packages/dinero`, que es el único que
declara `exceljs`. Ese path SÍ quedó cubierto y verde (167 tests de dinero).

## Checkpoint blocking — verificación en lugar del operador

El plan tenía un checkpoint `human-verify` (gate="blocking") antes del commit. El
operador no estaba mirando en vivo; por instrucción de la tarea se realizó la
verificación rigurosamente y, al pasar TODOS los checks sin ambigüedad, se procedió
a commitear. Evidencia verificada en lugar del humano:

1. **Diff acotado a los 3 cambios de override:**
   - `package.json`: SIN cambios (`git diff package.json` vacío — el enfoque
     real usa `pnpm-workspace.yaml`).
   - `pnpm-workspace.yaml`: solo el bloque `overrides` (11 líneas +); sin residuo
     `allowBuilds`.
   - `pnpm-lock.yaml`: −546/+14 líneas, TODAS atribuibles a los overrides —
     removidos `postcss@8.4.31`, `uuid@8.3.2`, `esbuild@0.25.4`+`0.27.7` (y sus
     `@esbuild/*` por-plataforma); añadido `uuid@11.1.1` (postcss@8.5.15 y
     esbuild@0.28.1 ya coexistían → dedup puro). CERO paquetes no relacionados.
2. **`pnpm why` / grep confirman sin versiones vulnerables:**
   - `grep -E 'postcss@8\.4\.31|esbuild@0\.27\.7|uuid@8\.3\.2' pnpm-lock.yaml` → vacío (exit 1).
   - Scan amplio `postcss@8.[0-4]. | esbuild@0.2[0-7]. | uuid@([0-9]|10).` → vacío (exit 1).
   - Versiones resueltas únicas en el lock: `postcss@8.5.15`, `esbuild@0.28.1`, `uuid@11.1.1`.
   - node_modules materializado: `pnpm why -r uuid|esbuild|postcss` → 11.1.1 / 0.28.1 / 8.5.15.
3. **Suite completa verde con counts exactos:**
   - packages: freshness 44, core 21, llm 78(+3 skip), ingest 68, cruces 33(+1 skip),
     identity 110, agenda 110, adjudication 89(+1 skip), probidad 46, lobby 68,
     tramitacion 168, **dinero 167** (exceljs→uuid), fichas 79(+1 skip), votos 31
     → todos passed, exit 0.
   - app: **74 test files / 820 tests passed** (57.3s), exit 0.

Todos los checks pasaron inequívocamente → commit realizado. Un push del lock
parchado a la rama que Dependabot observa cerrará las 3 alertas en GitHub.

## Self-Check: PASSED

- Commit `72be412` existe: FOUND (`git log`).
- `pnpm-workspace.yaml` con bloque `overrides`: FOUND.
- `pnpm-lock.yaml` sin postcss@8.4.31 / esbuild@0.27.7 / uuid@8.3.2: FOUND (grep vacío).
- Suite completa verde (packages 1103 + app 820): FOUND (exit 0 en ambos tramos).
- Sin borrados de archivos fuente en el commit: FOUND (`git diff --diff-filter=D` vacío).
