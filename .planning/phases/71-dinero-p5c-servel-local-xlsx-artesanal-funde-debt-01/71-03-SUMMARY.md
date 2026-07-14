---
phase: 71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01
plan: 03
subsystem: dinero (backfill SERVEL operador-LOCAL) — runbook + checkpoint operador
tags: [servel, runbook, local, from-r2, xlsx, money-02, debt-01, money-gate-off, operator-pending, nombre-no-rut]
requires:
  - "packages/dinero/src/run-servel-local-cli.ts (CLI operador LOCAL --eleccion/--r2-path/--from-r2/--anio, Plan 71-02)"
  - "packages/dinero/src/ingest-run-servel.ts (runIngestServel Etapa-1-R2-first + modo LOCAL, Plan 71-01)"
  - "señal freshness `servel` en packages/freshness/src/catalog.ts (Plan 71-02)"
  - ".planning/phases/70-.../70-BACKFILL-CHILECOMPRA-RUNBOOK.md (patrón hermano espejado)"
provides:
  - "71-BACKFILL-SERVEL-RUNBOOK.md — procedimiento operador-LOCAL end-to-end del backfill SERVEL por elección (Etapa 1 humana → Etapa 2 --from-r2)"
affects:
  - ".planning/phases/71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01/71-BACKFILL-SERVEL-RUNBOOK.md"
tech-stack:
  added: []
  patterns:
    - "runbook operador-LOCAL por elección (SERVEL sin feed → toil manual, NO cron, NO GitHub Actions)"
    - "Etapa 1 = acto humano (obtener + colocar .xlsx en R2 content-addressed servel/<eleccion>/<fecha>/<sha>.xlsx)"
    - "NOMBRE-no-RUT: SERVEL no trae RUT → RUT-01 NO es prerrequisito (a diferencia de ChileCompra)"
key-files:
  created:
    - ".planning/phases/71-dinero-p5c-servel-local-xlsx-artesanal-funde-debt-01/71-BACKFILL-SERVEL-RUNBOOK.md"
  modified: []
decisions:
  - "El runbook espeja 70-BACKFILL-CHILECOMPRA-RUNBOOK.md pero es MÁS simple: SERVEL no depende de RUT-01 (cruce por NOMBRE) ni de ticket/cuota (GET anónimo) → sin sección de universo-de-RUTs ni de partición por cuota"
  - "El .xlsx real + su colocación en R2 es toil operador-LOCAL POR ELECCIÓN: PENDIENTE como checkpoint human-action blocking-human. MONEY-02 NO se cierra aquí; el flip MONEY_PUBLIC_ENABLED es Phase 73"
  - "R2 key verbatim del wire: putImmutable(\"servel\", eleccion, fechaCorte, sha256(bytes), \"xlsx\", bytes) → servel/<eleccion>/<fecha_corte>/<sha>.xlsx"
metrics:
  duration: "~9 min"
  completed: "2026-07-14"
  tasks: 1
  files: 1
---

# Phase 71 Plan 03: Runbook operador-LOCAL del backfill SERVEL + checkpoint operador Summary

Entregó `71-BACKFILL-SERVEL-RUNBOOK.md` — el procedimiento operador-LOCAL end-to-end para poblar el financiamiento electoral de SERVEL **por elección**: cómo obtener el `.xlsx` a mano desde SERVEL (Etapa 1 = acto humano, SERVEL no tiene feed estable), colocarlo en R2 content-addressed bajo `servel/<eleccion>/<fecha_corte>/<sha256>.xlsx`, y correr la Etapa 2 con `run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path>` (lee de R2, 0 fetch a la fuente). Espeja `70-BACKFILL-CHILECOMPRA-RUNBOOK.md` pero es más simple porque SERVEL **no depende de RUT-01** (cruce por NOMBRE determinista, SERVEL no trae RUT) ni de un ticket con cuota (GET anónimo). El agente **NO obtuvo/colocó ningún `.xlsx` real, NO tocó la fuente SERVEL, NO flipeó el gate MONEY**. La obtención+colocación del `.xlsx` es toil operador-LOCAL por elección → registrada como checkpoint PENDIENTE.

## What Was Built

- **`71-BACKFILL-SERVEL-RUNBOOK.md` (255 líneas, 7 secciones)** con los flags REALES del CLI (verbatim de `run-servel-local-cli.ts`: `--eleccion <slug>` obligatorio, `--r2-path`/`--from-r2 <r2Path>` obligatorio alias, `--anio YYYY`, `--dry-run`):
  1. **Contexto** — SERVEL es LOCAL por elección, sin cron, sin feed estable; enlace candidato→parlamentario por NOMBRE determinista; MONEY_PUBLIC_ENABLED OFF hasta Phase 73; NOTA CI (GitHub Actions prohibido, no existe `servel-weekly.yml`).
  2. **Pre-checks** — suite offline verde (dinero 167 / freshness 37 / typecheck), MONEY OFF, `.env R2_*` presente; **explícito: NO se requiere RUT-01** (SERVEL no trae RUT).
  3. **Etapa 1 (acto humano)** — obtener el `.xlsx` a mano, fijar `eleccion`+`fecha_corte`, colocarlo en R2 content-addressed `servel/<eleccion>/<fecha_corte>/<sha256(bytes)>.xlsx` (PUT `If-None-Match:*`; 412=éxito idempotente).
  4. **Etapa 2 (pipeline)** — comando real `run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path> [--anio YYYY]`; verificación del destino en el log; salida esperada (aportes/donantes/parlamentariosMarcados/cuarentena/errores/degradaciones); 0 fetch (conector que LANZA si se toca).
  5. **Fail-soft por elección** — `ServelBloqueadaError`/drift de header (`HEADER_ROW=4`)/mismatch de completitud degradan ESA elección (cuarentena, 0 filas) sin abortar; re-obtener/re-colocar y re-correr solo esa elección.
  6. **Frescura por dato** — `eleccion`+`fecha_corte` visibles ("Financiamiento de la elección X (corte YYYY-MM-DD)"); tras el backfill la señal `servel` en `pnpm freshness` sale de "n/d"/STALE (umbral 365d); GH sigue `n/d` (sin `servel-weekly.yml`).
  7. **Verificación + cierre + rollback + seguridad** — conteos, invariante "0 aportes `no_confirmado` con `parlamentario_id` no-NULL" (cruce por NOMBRE respetado), criterios de cierre, re-ingesta SIEMPRE desde R2 (`--from-r2`, nunca re-tocar SERVEL), operador-LOCAL NO GitHub Actions, gate MONEY intacto.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Escribir 71-BACKFILL-SERVEL-RUNBOOK.md | `1fb79d0` | 71-BACKFILL-SERVEL-RUNBOOK.md |
| 2 | Checkpoint human-action (blocking-human) — entrega del runbook al operador | — (PENDIENTE, no ejecutable por el agente) | — |

## Checkpoint operador (BLOCKING — PENDIENTE, NO ejecutado)

Task 2 es un `checkpoint:human-action gate="blocking-human"`. **NO es ejecutable por el agente** — obtener y colocar el `.xlsx` real de SERVEL es toil operador-LOCAL **por elección**, y el agente NO toca la fuente ni PROD ni el gate. Queda PENDIENTE (igual que 66-02 / 67-02 / 70-03):

Cuando el operador decida poblar SERVEL (por elección):
1. Seguir `71-BACKFILL-SERVEL-RUNBOOK.md`.
2. Obtener el `.xlsx` de financiamiento electoral de una elección desde SERVEL (descarga manual puntual, respetando la fuente).
3. Colocarlo en R2 content-addressed `servel/<eleccion>/<fecha_corte>/<sha256(bytes)>.xlsx` (Etapa 1 = acto humano).
4. Correr `run-servel-local-cli.ts --eleccion <slug> --r2-path <r2Path> [--anio YYYY]` (Etapa 2, lee de R2, 0 fetch).
5. Verificar: aportes/donantes poblados, elección cuarentenada = 0 (o re-colocar el `.xlsx` correcto), `eleccion`+`fecha_corte` visibles, `pnpm freshness` fila `servel` sale de "n/d".

**RECORDATORIO:** `MONEY_PUBLIC_ENABLED` sigue OFF — los aportes existen en la DB pero NO se presentan al público hasta el sign-off legal 21.719 (Phase 73). El backfill NO enciende el flag.

**Resume-signal:** el operador escribe `"runbook recibido"` (o `"backfill corrido"` con los conteos N/D/M por elección) para cerrar la fase; o lista qué falta.

## MONEY-02 status

MONEY-02 SC#1 ("el operador deja el `.xlsx` correcto en R2 y el pipeline re-corre SIN volver a tocar la fuente") tiene ahora sus **tres piezas de software listas y probadas offline**: wire dos-etapas (71-01), CLI/freshness/guard (71-02), runbook operativo (71-03). La **porción operativa LIVE** (colocar el `.xlsx` real + re-correr) es toil operador-LOCAL PENDIENTE. **MONEY-02 NO se cierra aquí** — se cierra cuando el operador corre el backfill LIVE de al menos una elección y reporta cobertura. El gate público sigue detrás del candado B (Phase 73).

## Deviations from Plan

None — plan ejecutado exactamente como está escrito. El runbook se escribió más simple que su hermano ChileCompra por diseño (SERVEL no depende de RUT-01 ni de cuota) — no una desviación, sino la adaptación NOMBRE-no-RUT / GET-anónimo que el plan pide explícitar.

## Known Stubs

None. El runbook está completo (255 líneas, 7 secciones, flags reales). El `.xlsx` real de SERVEL y su colocación en R2 son toil operador-LOCAL PENDIENTE (checkpoint human-action blocking-human, documentado arriba), NO un stub de código: el software está completo y probado offline.

## Threat Flags

Ninguna superficie de seguridad nueva. El runbook es documentación operativa; referencia SOLO nombres de variables de entorno (nunca valores), documenta el gate MONEY OFF (T-71-10), la reconstruibilidad desde R2 (T-71-11) y el cruce por NOMBRE-no-RUT (T-71-12) — las tres mitigaciones del `<threat_model>` del plan.

## Self-Check: PASSED

- FOUND: 71-BACKFILL-SERVEL-RUNBOOK.md (255 líneas), 71-03-SUMMARY.md
- FOUND commit: 1fb79d0 (docs runbook)
- Verificación automatizada del plan: `test -f … && grep -q "run-servel-local-cli" … && echo OK` → OK
- Checkpoint Task 2 registrado como PENDIENTE (no ejecutado); MONEY-02 NO cerrado falsamente
