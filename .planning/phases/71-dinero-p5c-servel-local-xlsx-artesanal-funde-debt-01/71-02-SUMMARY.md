---
phase: 71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01
plan: 02
subsystem: dinero (CLI operador LOCAL SERVEL) + freshness (señal servel) + guard frozen
tags: [servel, local, from-r2, freshness, staleness, frozen-guard, money-02, debt-01, money-gate-off]
requires:
  - "packages/dinero/src/ingest-run-servel.ts (runIngestServel con r2Store/fromR2/r2Path, tras Plan 71-01)"
  - "@obs/ingest R2Store (accessKeyId/secretAccessKey/endpoint/bucket)"
  - "packages/freshness/src/catalog.ts (patrón CATALOG + entry chilecompra a espejar)"
  - "packages/freshness/src/evaluate.ts (staleness null→stale, >umbral→stale, override, GH n/d)"
provides:
  - "run-servel-local-cli: entry-point operador LOCAL (--from-r2/--r2-path, 0 fetch)"
  - "señal freshness `servel` (aportes_ingesta_estado.ingestado_hasta, 365d, GH n/d honesto)"
  - "servel-frozen-guard: git-frozen de reconciliar-aporte/model-servel/parse-servel/0024 + MONEY OFF"
affects:
  - "packages/dinero/src/run-servel-local-cli.ts (NUEVO)"
  - "packages/dinero/src/run-servel-local-cli.test.ts (NUEVO)"
  - "packages/freshness/src/catalog.ts (entry servel)"
  - "packages/freshness/src/evaluate.test.ts (casos servel + 'all catalog entries' robusto)"
  - "packages/dinero/src/servel-frozen-guard.test.ts (NUEVO)"
tech-stack:
  added: []
  patterns:
    - "CLI operador LOCAL separado del ingest-cli acotado (precedente run-dinero-masivo-cli Phase 70)"
    - "modo LOCAL = 0 fetch: conector default LANZA en descargar; el fetch al blob JAMÁS ocurre"
    - "guard-como-test: detector puro + mutation self-check en memoria (espejo reconciler-frozen-guard)"
    - "señal freshness LOCAL sin cron → workflowYml inexistente → GH 'n/d' honesto (no error)"
key-files:
  created:
    - "packages/dinero/src/run-servel-local-cli.ts"
    - "packages/dinero/src/run-servel-local-cli.test.ts"
    - "packages/dinero/src/servel-frozen-guard.test.ts"
  modified:
    - "packages/freshness/src/catalog.ts"
    - "packages/freshness/src/evaluate.test.ts"
decisions:
  - "El CLI LOCAL NO importa/instancia el ServelConnector real (Fetcher/RobotsGuard): el default conectorLocalQueLanza() basta y la ausencia deliberada ES la garantía estructural de 0-fetch"
  - "'evaluates all catalog entries' asertado contra CATALOG.length (no un número hardcodeado): el catálogo crece por diseño (chilecompra/servel)"
  - "MONEY gate OFF re-verificado por LECTURA de texto (money-gate.ts vive en app/, otro proyecto vitest; no se importa el módulo server-only) + .env.example=false"
metrics:
  duration: "~11 min"
  completed: "2026-07-14"
  tasks: 2
  files: 5
---

# Phase 71 Plan 02: SERVEL LOCAL CLI + señal freshness servel + guard frozen-servel Summary

Entregó el CLI de operador LOCAL de SERVEL (`run-servel-local-cli` — construye un `R2Store` real de `.env R2_*` y threadea el modo `--from-r2`/`r2Path` a `runIngestServel` del Plan 71-01, SIN tocar la fuente), añadió la señal de staleness `servel` al catálogo de `pnpm freshness` (LOCAL sin cron → `servel-weekly.yml` inexistente → GH "n/d" honesto), y ancló el corte congelado de la fase con un guard que MUERDE si `reconciliar-aporte.ts`/`model-servel.ts`/`parse-servel.ts`/`0024_servel.sql` cambian. `MONEY_PUBLIC_ENABLED` re-verificado OFF. Sin file overlap con Plan 71-01 (Wave 1 paralela). Cero fetch a la fuente, cero write remoto, cero flip.

## What Was Built

- **`run-servel-local-cli.ts` (CLI operador LOCAL):** espejo de `run-dinero-masivo-cli.ts` (Phase 70) adaptado a SERVEL LOCAL. Construye un `R2Store` real de `.env R2_*` (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT_URL`/`R2_BUCKET`), acepta `--eleccion <slug>`, `--r2-path`/`--from-r2 <r2Path>`, `--anio <YYYY>`, `--dry-run`. Construye una `TareaEleccion` con `eleccion`+`r2Path` (SIN `url` — modo LOCAL no fetchea) y threadea `r2Store`/`fromR2`/la tarea a `runIngestServel`. **El conector de fetch NUNCA se toca:** el default `conectorLocalQueLanza()` LANZA si se invoca `descargar` (defensa en profundidad); las importaciones del `ServelConnector` real (Fetcher/RobotsGuard) se OMITEN deliberadamente — esa ausencia ES la garantía estructural de 0-fetch. A diferencia de ChileCompra, SERVEL es GET anónimo sin ticket secreto → no hay `redactarTicket`.
- **Guards del CLI:** `--eleccion` vacío → `ServelLocalArgsError`; `--r2-path`/`--from-r2` vacío → `ServelLocalArgsError`; `--r2-path`/`--from-r2` sin R2 configurado en `.env` → `ServelLocalArgsError` (validación ANTES de red/DB). Log del destino LOCAL ("lee el .xlsx de R2, 0 fetch a la fuente") impreso ANTES de escribir.
- **Señal freshness `servel` (CATALOG):** `{ fuente:"servel", tabla:"aportes_ingesta_estado", columna:"ingestado_hasta", umbralDias:365, overrideEnv:"FRESHNESS_UMBRAL_SERVEL", workflowYml:"servel-weekly.yml" }`. Mismo patrón declarativo que `chilecompra`/`lobby-leylobby`: el marcador de barrido distingue "consultado sin aportes" de "no consultado". Umbral 365d generoso (ciclos electorales bianuales/cuatrienales). `servel-weekly.yml` NO existe ni debe crearse (LOCAL sin cron) → GH "n/d" honesto. Sin barrido corrido, `ingestado_hasta` null HOY → stale (fail-closed).
- **`servel-frozen-guard.test.ts`:** detector puro `detectarDebilitamientosServel` + mutation self-check en memoria (espejo de `reconciler-frozen-guard.test.ts`, Phase 70). Congela 4 firmas LOCKED: (1) cruce por NOMBRE solo confirma en determinista + donante nunca al pipeline (reconciliar-aporte); (2) `monto` string VERBATIM + `rutDonante` NULLABLE (model-servel — SERVEL no trae RUT); (3) gate de header en `HEADER_ROW = 4` + `EXPECTED_HEADERS` + THROW de drift (parse-servel); (4) header + tabla `aportes_ingesta_estado(ingestado_hasta)` (0024). Re-verifica MONEY OFF por lectura de texto (`=== "true"` fail-closed, sin `Boolean` laxo) + `.env.example` = false.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | CLI operador LOCAL run-servel-local-cli + threading a runIngestServel (TDD RED→GREEN) | `04c9ddd` | run-servel-local-cli.ts, run-servel-local-cli.test.ts |
| 2 | Señal freshness servel en CATALOG + guard frozen-servel + MONEY OFF | `1e55bbd` | catalog.ts, evaluate.test.ts, servel-frozen-guard.test.ts |

## Tests Added

- **run-servel-local-cli.test.ts (13):** parseArgs (`--eleccion`/`--r2-path`/`--from-r2` alias/`--anio`/`--dry-run` + guards); main: (a) R2Store de `.env` (r2Activo), (b) threading de tarea LOCAL `eleccion`+`r2Path` SIN `url` + `--from-r2`, (c) log destino LOCAL/R2, (d) guard `--r2-path` sin R2 lanza, (e) 0 llamadas a `descargar`, (e') end-to-end con runIngestServel real → 0 fetch, más guards de `--eleccion`/`--r2-path` vacíos.
- **evaluate.test.ts (+6 servel):** entrada existe (tabla/columna/365d/override/workflowYml), null→stale, >365→stale, <365→fresh, override baja umbral, GH "n/d". Más "all catalog entries" hecho robusto a `CATALOG.length`.
- **servel-frozen-guard.test.ts (18):** guard estático (sanity + 0 debilitamientos), firmas LOCKED explícitas (4), mutation self-check (base válida + 8 mutaciones que MUERDEN), sin falsos positivos (JSDoc-como-contraejemplo), MONEY OFF (2).

## Verification

- `pnpm --filter @obs/dinero test` → **167 passed** (136 base + 13 CLI + 18 frozen-guard).
- `pnpm --filter @obs/freshness test` → **37 passed** (incl. 6 casos servel).
- `pnpm --filter @obs/dinero typecheck` + `pnpm --filter @obs/freshness typecheck` + root `tsc -b` → verde.
- `git diff --exit-code -- reconciliar-aporte.ts model-servel.ts parse-servel.ts 0024_servel.sql app/lib/money-gate.ts` → exit 0 (VACÍO).
- `pnpm freshness` → la fila `servel` figura: Último upsert `—`, Umbral `365`, GH `n/d`, Estado `STALE` (null = stale honesto). (El exit≠0 del CLI es preexistente: reporta ≠0 si CUALQUIER fuente está STALE; `lobby-leylobby` ya estaba STALE antes de este plan — fuera de alcance.)
- MONEY_PUBLIC_ENABLED sin tocar (permanece OFF). Cero fetch a la fuente / cero write remoto / cero flip.

## Deviations from Plan

**1. [Rule 1 - Bug] `evaluate.test.ts` "evaluates all 7 catalog entries" rompía al crecer el catálogo**
- **Found during:** Task 2 (al añadir el entry `servel`, CATALOG pasó de 7 a 8 entradas).
- **Issue:** El test asertaba una longitud HARDCODEADA de 7 (`expect(results).toHaveLength(7)`), que se desactualiza cada vez que se registra una fuente nueva — el mismo problema latente que tuvo `chilecompra`.
- **Fix:** Asertar contra `CATALOG.length` (una fila por fuente registrada, robusto al crecimiento por diseño). Comportamiento intacto (todas frescas con 1 día).
- **Files modified:** packages/freshness/src/evaluate.test.ts
- **Commit:** `1e55bbd`

Fuera de eso, el plan se ejecutó exactamente como está escrito. La OMISIÓN de las importaciones del `ServelConnector` real en el CLI LOCAL (vs. el patrón de `ingest-cli-servel.ts`) es una decisión de diseño alineada con el corte 0-fetch del plan, no una desviación.

## Known Stubs

None. El CLI, la señal freshness y el guard están completos y probados offline. El `.xlsx` real de SERVEL y las credenciales R2 son toil operador-LOCAL (runbook = Plan 71-03, fuera de alcance); el gate MONEY permanece OFF hasta Phase 73. La cobertura SERVEL es honestamente `—`/STALE HOY (sin barrido corrido).

## Threat Flags

Ninguna superficie de seguridad nueva fuera del `<threat_model>` del plan. El CLI LOCAL construye un `R2Store` de `.env` (mismo patrón que run-dinero-masivo-cli/run-votos-masivo-cli) y lee de R2; no abre endpoints ni rutas públicas nuevas. MONEY sigue detrás del candado B OFF.

## Self-Check: PASSED

- FOUND: 71-02-SUMMARY.md, run-servel-local-cli.ts, run-servel-local-cli.test.ts, servel-frozen-guard.test.ts, catalog.ts (entry servel), evaluate.test.ts
- FOUND commits: 04c9ddd (feat CLI), 1e55bbd (test freshness+guard)
- FROZEN git diff VACÍO (exit 0) sobre las 4 firmas LOCKED + money-gate.ts
