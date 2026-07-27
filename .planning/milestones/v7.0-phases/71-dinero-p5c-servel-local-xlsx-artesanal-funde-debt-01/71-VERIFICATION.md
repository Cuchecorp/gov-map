---
phase: 71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01
verified: 2026-07-14T05:30:00Z
status: human_needed
score: 4/4 must-haves verified (wire+guards); operator .xlsx toil pending
overrides_applied: 0
human_verification:
  - test: "Operador obtiene el .xlsx de financiamiento de UNA elección desde SERVEL y lo coloca en R2 content-addressed (servel/<eleccion>/<fecha_corte>/<sha256>.xlsx), luego corre `run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path>`"
    expected: "Aportes/donantes poblados en Supabase (flag OFF); elección cuarentenada=0; `eleccion`+`fecha_corte` visibles por dato; fila `servel` en `pnpm freshness` sale de 'n/d'/STALE; 0 fetch a la fuente en Etapa 2"
    why_human: "Etapa 1 = acto humano (SERVEL no tiene feed estable ni API amable; descarga manual del .xlsx). Requiere credenciales R2 reales + una elección concreta. El agente no toca la fuente ni PROD. Checkpoint blocking-human 71-03 Task 2 (PENDIENTE)."
  - test: "Con los aportes SERVEL en DB y MONEY_PUBLIC_ENABLED=true (sign-off legal 21.719, Phase 73), confirmar que la ficha pública muestra los aportes con fuente/fecha/enlace/elección y no expone RUT de donantes"
    expected: "SERVEL aportes visibles con procedencia por dato; donante como PII deny-by-default; nunca dato viejo presentado como actual (fecha_corte + elección visibles)"
    why_human: "Presentación pública real gated por Phase 73 (flip MONEY, acto humano con sign-off legal); no verificable programáticamente en este corte con el flag OFF."
---

# Phase 71: DINERO P5c — SERVEL LOCAL (.xlsx artesanal, funde DEBT-01) Verification Report

**Phase Goal:** Poblar el financiamiento electoral declarado (aportes/gastos) de SERVEL — conector artesanal frágil, LOCAL por elección, con frescura declarada. **Nota rectora del ROADMAP:** SERVEL NO trae RUT — el enlace candidato→parlamentario es por NOMBRE determinista (IDENT-12 fail-closed). El plan honra "nunca falso por nombre" con el cruce por NOMBRE existente, NO añadiendo un RUT inexistente.
**Verified:** 2026-07-14T05:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | La ingesta escribe PRIMERO los bytes del .xlsx content-addressed a R2 (Etapa 1) y LUEGO parsea/upsert (Etapa 2), re-ejecutables por separado | ✓ VERIFIED | `ingest-run-servel.ts:246-300` `putImmutable("servel", eleccion, fecha, sha, "xlsx", bytes)` ANTES del bloque upsert (línea 316-341). Test A (`ingest-run-servel.test.ts:362-381`) asserta orden de captura estricto: `putOrders[0] < upsertOrders[0]` vía reloj monotónico compartido (orden, no presencia). R2 path `^servel/diputado-2025/.*\.xlsx$`. |
| 2 | Un fallo del put R2 (no-412) GATEA el upsert de ESA elección — nunca derivado sin crudo | ✓ VERIFIED | `ingest-run-servel.ts:260-272` catch del putImmutable → `errores.push` + `continue` (Etapa 2 omitida). Test C (`:416-431`) con FakeR2Store("throw") → `writer.upsertOrders.length === 0`, `aportes === 0`. |
| 3 | `--from-r2` lee los bytes del .xlsx del operador en R2 y corre parse→reconcilia→upsert SIN tocar el blob (0 fetch) | ✓ VERIFIED | `ingest-run-servel.ts:167-178` rama `esLocal` → `getObject(r2PathTarea)`, NUNCA `descargar`. Test B (`:383-402`) con `conectorQueLanza()` (throw si se toca) + R2 seedeado → `aportes===1`, `getObjectCalls>0`. Guard B (`:404-414`): `fromR2` sin `r2Store` lanza. CLI default `conectorLocalQueLanza()` (`run-servel-local-cli.ts:138-146`) refuerza. |
| 4 | El cruce candidato→parlamentario es por NOMBRE determinista: solo `determinista` mintea FK, resto → NULL | ✓ VERIFIED | `reconciliar-aporte.ts` INTACTO (git diff vacío). Frozen guard LOCKED-1 (`servel-frozen-guard.test.ts:80-121`) exige `case "determinista"` como única rama que setea `estadoVinculo="confirmado"` + `confirmar(...)` + llave `candidatoNombreVerbatim`, prohíbe donante al pipeline. `model-servel.ts:70` `rutDonante: string \| null`; `ingest-run-servel.ts:330` `rutDonante: null`. |
| 5 | ServelBloqueadaError y la cuarentena de drift degradan ESA elección sin abortar (fail-soft) | ✓ VERIFIED | `ingest-run-servel.ts:186-199` (bloqueada→degradación+continue), `:210-219` (drift header→cuarentena+continue), `:228-237` (completitud→cuarentena+continue). Tests E/E' (`:453-514`): elección A cuarentenada/bloqueada + elección B OK en la MISMA corrida. |
| 6 | eleccion + fecha_corte visibles por dato, sobreviven verbatim el replay | ✓ VERIFIED | `model-servel.ts:106` `eleccion: string` (NON-NULL, `:138` min 1), `:104` `fechaCorte: string`, `:80` `enlace`, `:79` `fecha_captura`. Test F (`:516-537`): tras replay `--from-r2`, `fila.eleccion === "DIPUTADO - DISTRITO 1 - 2025"` + `fila.fecha_corte === "2026-06-19"` (no recomputados). |

**Score:** 6/6 supporting truths verified at the wire/guard level.

**Success-Criteria mapping (ROADMAP contract):**

| SC | Statement | Status | Note |
| -- | --------- | ------ | ---- |
| SC#1 | Operador deja el .xlsx en R2, pipeline re-corre SIN tocar la fuente (dos etapas, LOCAL, no cron) | ⚠ WIRE VERIFIED / operator toil | Wire+CLI+runbook completos y probados offline; colocar el .xlsx real = checkpoint blocking-human (→ human_needed). |
| SC#2 | Detrás del flag OFF, existen aportes/gastos SERVEL asociados con fuente/fecha/enlace | ⚠ WIRE+GATE VERIFIED / data = operator | Aporte lleva `enlace`/`fecha_captura`/`fechaCorte`/`eleccion`; MONEY OFF confirmado; enlace por NOMBRE (no RUT, per Nota rectora). Datos reales = backfill operador. |
| SC#3 | Fecha de corte + qué elección/período cubre el dato están VISIBLES por dato | ✓ VERIFIED | `eleccion` (NON-NULL) + `fechaCorte` por fila; test F prueba verbatim tras replay. |
| SC#4 | ServelBloqueadaError degrada ESA elección sin abortar; SERVEL en `pnpm freshness` con staleness | ✓ VERIFIED | Fail-soft (tests E/E'); `catalog.ts:299-305` entry servel (365d, override, servel-weekly.yml); 6 casos freshness (null→stale, >365→stale, <365→fresh, override, GH n/d). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/dinero/src/ingest-run-servel.ts` | runIngestServel con r2Store/snapshotWriter/fromR2 + modo LOCAL (r2Path) | ✓ VERIFIED | `putImmutable` presente (línea 252), `getObject` (169), modo LOCAL, fail-soft, RUT null. 368 líneas, substantivo, wired al CLI. |
| `packages/dinero/src/ingest-run-servel.test.ts` | Tests fake-R2 (put-antes-upsert, from-r2 0-fetch, put-falla-gatea, 412, fail-soft, verbatim) + fixture .xlsx | ✓ VERIFIED | 16 tests (10 pre + 6 wire A/B/C/D/E/E'/F). FakeR2Store + MonotonicClock reales. |
| `packages/dinero/src/run-servel-local-cli.ts` | Entry-point operador LOCAL --from-r2/--r2-path, 0 fetch | ✓ VERIFIED | R2Store de .env, tarea LOCAL sin url, `conectorLocalQueLanza()` default, guards de args. 277 líneas. |
| `packages/dinero/src/servel-frozen-guard.test.ts` | git-frozen de reconciliar/model/parse/0024 + MONEY OFF | ✓ VERIFIED | 18 tests: detector puro + 8 mutaciones que MUERDEN + base válida (no falso-positivo) + JSDoc contraejemplo + MONEY OFF (2). |
| `packages/freshness/src/catalog.ts` | Señal servel (aportes_ingesta_estado.ingestado_hasta, 365d, GH n/d) | ✓ VERIFIED | Entry `:299-305` con umbral 365, override FRESHNESS_UMBRAL_SERVEL, workflowYml servel-weekly.yml (inexistente → GH n/d honesto). |
| `71-BACKFILL-SERVEL-RUNBOOK.md` | Procedimiento operador-LOCAL por elección con flags reales | ✓ VERIFIED | 255 líneas, 6 refs a `run-servel-local-cli`, flags verbatim, Etapa 1 humana + Etapa 2 --from-r2. |
| FROZEN: reconciliar-aporte.ts / model-servel.ts / parse-servel.ts / 0024_servel.sql | git diff VACÍO | ✓ VERIFIED | `git diff --stat HEAD` exit 0 (vacío). Último commit que los tocó = 065886f/9545e45 (Phase 15/16), NO Phase 71. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| ingest-run-servel.ts | r2Store.putImmutable | Etapa 1 R2 (bytes .xlsx) antes de parse/upsert | ✓ WIRED | `putImmutable("servel", ...)` línea 252, dentro de `if (opts.r2Store && !esLocal)` ANTES del upsert (316). |
| ingest-run-servel.ts | r2Store.getObject | modo LOCAL --from-r2 lee bytes .xlsx | ✓ WIRED | `getObject(r2PathTarea)` línea 169, rama `esLocal`. |
| run-servel-local-cli.ts | runIngestServel | threadea tarea LOCAL + fromR2 + r2Store | ✓ WIRED | `runIngest({... r2Store, fromR2: r2Path ...})` línea 228-238. |
| catalog.ts servel | evaluate.ts | staleness sobre ingestado_hasta | ✓ WIRED | 6 casos en evaluate.test.ts prueban el flujo (null/400/200/override/n/d). |

### Data-Flow Trace (Level 4)

No aplica al corte de código (no hay superficie de render dinámico en esta fase; MONEY OFF). El dato real (aportes SERVEL) fluye solo tras el backfill operador-LOCAL → capturado como human_verification. El wire prueba el flujo bytes-R2 → parse → reconcilia(NOMBRE) → upsert con FakeR2Store/InMemoryWriter (tests A-F).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Suite dinero (wire + CLI + frozen guard) | `pnpm --filter @obs/dinero test` | 167 passed (18 files); ingest-run-servel 16, run-servel-local-cli 13, servel-frozen-guard 18 | ✓ PASS |
| Suite freshness (señal servel) | `pnpm --filter @obs/freshness test` | 37 passed (incl. 6 casos servel) | ✓ PASS |
| Frozen files sin cambios | `git diff --stat HEAD -- reconciliar-aporte/model-servel/parse-servel/0024` | exit 0 (vacío) | ✓ PASS |
| MONEY gate fail-closed | lectura `app/lib/money-gate.ts` + `.env.example` | `=== "true"` estricto; `.env.example` `MONEY_PUBLIC_ENABLED=false` | ✓ PASS |

### Probe Execution

No hay probes `scripts/*/tests/probe-*.sh` declarados para esta fase (fase de wire/tests con suites vitest, no migración con probes). Las suites vitest son la verificación runnable — ejecutadas arriba (167 + 37 passed).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| MONEY-02 | 71-01/02/03 | Financiamiento electoral SERVEL poblado LOCAL por elección con frescura | ⚠ SOFTWARE SATISFIED / LIVE pending | Tres piezas de SW listas y probadas (wire/CLI/freshness/guard/runbook). Cierre real = backfill operador de ≥1 elección (human_needed). No se cierra falsamente. |
| DEBT-01 (parcial servel) | 71-01/02 | Dos-etapas R2 + `--from-r2` para SERVEL | ✓ SATISFIED | Etapa-1-R2-first + modo LOCAL --from-r2 cableados y probados (tests A-F). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (ninguno) | — | — | — | Scan de TBD/FIXME/XXX/PLACEHOLDER/stub-returns sobre ingest-run-servel.ts, run-servel-local-cli.ts, catalog.ts → 0 hits. Sin debt markers. |

### Human Verification Required

**1. Backfill operador-LOCAL de al menos una elección (checkpoint blocking-human)**

- **Test:** Obtener el .xlsx de financiamiento de una elección desde SERVEL, colocarlo en R2 content-addressed `servel/<eleccion>/<fecha_corte>/<sha256>.xlsx`, correr `run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path>`.
- **Expected:** Aportes/donantes poblados (flag OFF); cuarentena=0; `eleccion`+`fecha_corte` visibles por dato; fila `servel` en `pnpm freshness` sale de 'n/d'/STALE; 0 fetch a la fuente en Etapa 2.
- **Why human:** Etapa 1 es acto humano (SERVEL sin feed estable; descarga manual). Requiere credenciales R2 + elección concreta. El agente no toca fuente/PROD. Checkpoint 71-03 Task 2 PENDIENTE.

**2. Presentación pública tras el flip MONEY (Phase 73)**

- **Test:** Con aportes en DB y `MONEY_PUBLIC_ENABLED=true` (sign-off legal 21.719), confirmar ficha pública muestra aportes con fuente/fecha/enlace/elección, sin exponer RUT de donantes.
- **Expected:** Aportes visibles con procedencia por dato; donante PII deny-by-default; nunca dato viejo como actual.
- **Why human:** Gated por Phase 73 (flip = acto humano con sign-off legal); no verificable con flag OFF.

### Gaps Summary

**No hay gaps de software.** El corte de código de Phase 71 está completo, substantivo y wired:

- El wire dos-etapas (Etapa-1-R2-first + `--from-r2` LOCAL) está probado adversarialmente: (A) put captura orden estricto < upsert vía reloj monotónico; (B) LOCAL lee de `getObject` con un conector que LANZA si se toca (0 fetch probado); (C) put-fail GATEA (upsertOrders===0); (D) 412 idempotente; (E/E') fail-soft por elección; (F) eleccion+fecha_corte verbatim tras replay.
- El enlace es por NOMBRE determinista fail-closed (no RUT forzado) — coherente con la Nota rectora del ROADMAP; el texto "por RUT" en el goal/SC está explícitamente reinterpretado por esa nota (SERVEL no publica RUT). NO es un gap: el frozen guard congela `rutDonante: string \| null` y prohíbe fabricar un RUT.
- Frozen files (reconciliar-aporte/model-servel/parse-servel/0024) con git diff VACÍO; el frozen guard MUERDE ante 8 mutaciones (probado en memoria).
- MONEY_PUBLIC_ENABLED OFF (fail-closed `=== "true"`, `.env.example=false`).
- Freshness `servel` presente con staleness honesta (null→stale HOY, 365d, GH n/d sin cron).
- Suites verdes: dinero 167 / freshness 37.

**Status = human_needed** (no gaps_found) porque las dos únicas piezas no automatizables son toil operador-LOCAL: (1) obtener+colocar el .xlsx real por elección (Etapa 1 = acto humano; SERVEL sin feed) y (2) la presentación pública tras el flip MONEY de Phase 73. Ambas están correctamente registradas como checkpoints pendientes; MONEY-02 NO se cierra falsamente. Esto es exactamente el resultado esperado: el wire + guards son sólidos, el toil del .xlsx es del operador.

---

_Verified: 2026-07-14T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
