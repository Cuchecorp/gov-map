---
phase: 119-cron-fix-robustez-de-ingesta
plan: 02
subsystem: freshness
tags: [cron, freshness, pg_cron, cobertura, honestidad, G3]
requires:
  - "119-01 (catalog.ts con workflowYml nullable + ghRun en el cálculo de stale)"
  - "118-CRON-VERDICTS.md §3.3 (pg_cron vivo, delta CERO) y §4 fila G3"
provides:
  - "señal de frescura propia para actualidad-refresh (W-1 deja de ser punto ciego)"
  - "señal de salud de los 5 jobs de pg_cron con umbral DERIVADO del schedule"
  - "huecos de cobertura W-3/W-7 declarados EN EL CÓDIGO con razón y cita archivo:línea"
affects:
  - "Phase 125 (E2E re-verifica pnpm freshness)"
  - "cierre del milestone v12.0"
tech-stack:
  added: []
  patterns:
    - "umbral derivado del schedule (hueco previsto más largo + gracia) en vez de umbral fijo"
    - "el hueco de cobertura declarado como decisión legible, no como omisión"
key-files:
  created: []
  modified:
    - packages/freshness/src/catalog.ts
    - packages/freshness/src/query-runner.ts
    - packages/freshness/src/evaluate.ts
    - packages/freshness/src/evaluate.test.ts
    - packages/freshness/src/cli.ts
decisions:
  - "PGCRON_JOBS es un array SEPARADO de CATALOG: un job no tiene tabla/columna ni workflow, y su umbral se deriva, no se fija — mismo criterio con que COBERTURA_VOTO_SENALES vive aparte"
  - "umbral = hueco previsto MÁS LARGO + hueco más corto como gracia; el hueco largo evita el falso STALE de cada lunes en los crons L-V, y el margen ADITIVO (no multiplicativo) impide que 3 días de silencio en un job intradía pasen por sanos"
  - "los jobs de pg_cron entran al exit code: mostrarlos sin contarlos dejaría el exit 0 ante una avería"
metrics:
  tasks: 3
  commits: 4
  duration: ~25min
  completed: 2026-07-28
  tests: "packages/freshness 57 → 73; suite app 1560 verde; tsc -b exit 0"
---

# Phase 119 Plan 02: Cobertura del instrumento de frescura — G3 Summary

Cierra G3: el catálogo tenía 9 entradas contra 20 unidades de cron inventariadas por 118, de modo que la avería de varias de ellas no disparaba ninguna señal. Ahora `actualidad-refresh` tiene señal propia, los 5 jobs de `pg_cron` tienen una comprobación distinta de la de tablas, y las dos unidades que se dejan fuera lo están por decisión escrita en el código.

## Qué se hizo

### Task 1 — entrada `actualidad-refresh` (W-1)

`CATALOG` gana una entrada sobre `actualidad_senal.fecha_captura`, umbral 2 días. La columna se verificó por `psql` read-only contra el schema de PROD **antes** de commitear: la refutación A2 de 118 §5 es exactamente que la columna temporal no es uniforme entre tablas — aquí no es `creado_en`. Umbral 2d porque la cadencia es intradía L-V (`0 11,14,17,20 * * 1-5`): más de 2 días sin escritura implica un fin de semana largo *más* al menos una ventana hábil perdida, es decir avería y no calendario.

Señal en vivo (no nula, como exigía el criterio de aceptación):

```
"fuente": "actualidad-refresh", "tabla": "actualidad_senal",
"ultimoUpsert": "2026-07-28 17:07:00.020504+00", "diasDesdeUpsert": 0,
"umbralDias": 2, "stale": false, "ghRun": "success @ 2026-07-28"
```

### Task 2 (TDD) — señal de `pg_cron`

`PGCRON_JOBS` es un array **separado** de `CATALOG` con los 5 jobs, su `jobid`, su schedule esperado (copiado de la migración citada) y su `overrideEnv`. `queryPgCron` corre por el mismo helper `psql` read-only dos consultas: `cron.job` (jobid/jobname/schedule/active) y `max(start_time)` agrupado por jobid de `cron.job_run_details`. **`command` y `return_message` quedan fuera a propósito** (T-119-05: pueden embeber URLs/keys de las llamadas `pg_net`); el instrumento solo observa, nunca programa ni desprograma (T-119-04).

`umbralDesdeSchedule(schedule): number | null` es pura (sin red, sin DB, sin reloj). Enumera las corridas de una semana completa y devuelve **el hueco previsto más largo + el más corto como gracia**, con piso de 0,25 h:

| schedule | hueco máx | gracia | umbral |
|---|---|---|---|
| `30 seconds` | 30 s | 30 s | 0,25 h (piso) |
| `*/15 * * * *` | 15 min | 15 min | 0,5 h |
| `17 3 * * *` | 24 h | 24 h | 48 h |
| `7 11,14,17,20 * * 1-5` | 63 h (vie 20:07 → lun 11:07) | 3 h | 66 h |

Las dos mitades de la regla son deliberadas: usar el hueco **más largo** evita marcar STALE cada lunes por la mañana en los jobs restringidos a días hábiles (una alarma que el operador aprende a ignorar es peor que no tenerla), y sumar un margen **aditivo** en vez de multiplicar impide que 3 días de silencio en un job intradía pasen por sanos. Un schedule que no se sabe leer (o que restringe día del mes/mes) devuelve `null`, que se trata como desconocido ⇒ stale: nunca se inventa un umbral.

Son señal por sí mismos, con motivo propio: `job ausente`, `schedule-drift` (T-119-06: el vivo nunca se adopta en silencio), `inactivo`, `schedule-ilegible`, `sin corridas`, `horas>umbral`. La tabla se renderiza como bloque APPEND —espejo exacto de `renderCoberturaVoto`, sin tocar la tabla de fuentes—, va al `--json` bajo la clave `pgcron` y **entra al exit code**: mostrar los jobs sin contarlos dejaría el exit 0 ante una avería.

### Task 3 — huecos declarados

Bloque `HUECOS DECLARADOS DE COBERTURA` en el JSDoc de cabecera de `catalog.ts`, en presente y sin promesas:

- **W-3 `backup-parlamentario`** queda fuera porque no escribe en Supabase: regenera el snapshot y lo commitea (`backup-parlamentario.yml:60-62`), y la carga a DB se omite por diseño (`:58-59`). Una señal sobre una tabla mediría el trabajo de otro cron — el verde prestado que G4 acaba de erradicar. Su señal autoritativa es la fecha del commit del bot.
- **W-7 `digest-daily`** queda fuera porque NOTIF está parked: `schedule` comentado (`digest-daily.yml:24-25`, estreno gated declarado en `:17`) y `notificacion_envio` con 0 filas. Cubrirlo produciría un STALE permanente que no denuncia avería sino gating.

No se añadió ninguna entrada de `CATALOG` para esas dos unidades, y un test lo congela.

## Verificación

`pnpm freshness` en vivo (bloque nuevo) vs lectura manual `select jobid, max(start_time) from cron.job_run_details group by jobid;` — las cifras cuadran (jobid 1 avanza entre ambas lecturas por correr cada 30 s):

```
Job (pg_cron)              | Schedule              | Última corrida    | Horas | Umbral h | Estado
process-ingest-jobs        | 30 seconds            | 2026-07-28 17:57  | 0.0   | 0.25     | OK
cleanup-net-http           | */15 * * * *          | 2026-07-28 17:45  | 0.2   | 0.5      | OK
net-materializar-aristas   | 17 3 * * *            | 2026-07-28 03:17  | 14.7  | 48       | OK
cruces-materializar        | 23 3 * * *            | 2026-07-28 03:23  | 14.6  | 48       | OK
actualidad-materializar    | 7 11,14,17,20 * * 1-5 | 2026-07-28 17:07  | 0.8   | 66       | OK

lectura manual psql:  1|2026-07-28 17:49:49  2|17:45:00  3|03:17:00  4|03:23:00  5|17:07:00
```

Los 5 `scheduleVivo` coinciden con el esperado del catálogo (delta CERO, coherente con §3.3): ningún drift.

| Check | Resultado |
|-------|-----------|
| `pnpm --filter @obs/freshness test` | 73/73 (57 antes) |
| `pnpm test` (suite completa) | 1560 verde, guards incluidos |
| `tsc -b` | exit 0 |
| `grep -c 'actualidad_senal' catalog.ts` | 4 (≥1) |
| `grep -c 'job_run_details' query-runner.ts` | 3 (≥1) |
| `pnpm freshness --json` clave `pgcron` | presente, 5 jobs con `jobname`/`stale`/`maxStartTime` |
| bloque `HUECOS DECLARADOS DE COBERTURA` | presente (1) |

TDD gate de Task 2: commit `test(...)` RED (`82a07f9`, 12 tests en rojo) → commit `feat(...)` GREEN (`9593aa5`, 72/72). REFACTOR no fue necesario.

## Reglas LOCKED

Este plan solo toca el INSTRUMENTO: cero conector, cero ingesta, cero escritura. Las dos etapas (fuente→R2→Supabase), el hash-check y el rate-limit 2-3 s quedan intactos por no ser tocados. Toda la interacción con PROD fue `psql` read-only (`information_schema`, `cron.job`, `cron.job_run_details`); la `SUPABASE_DB_URL` jamás se imprimió. Ninguna cifra del bloque nuevo es un default silencioso: un job sin corridas sale `n/d` + `stale:true`, jamás `0`. Cero paquetes instalados (T-119-SC).

## Deviations from Plan

Un solo ajuste, dentro de Rule 3 (desbloqueo):

**1. [Rule 3 - Blocker] Un JSDoc con la sintaxis literal de cron cerraba el bloque de comentario**
- **Encontrado en:** Task 2
- **Problema:** el JSDoc de `expandirCampo` enumeraba las formas de campo cron literales; la secuencia comodín-barra cierra el comentario (el gotcha exacto de 102-01) y rompía el parseo.
- **Fix:** las formas se describen en prosa, con nota de por qué.
- **Commit:** `9593aa5`

Nota de diseño, no deviación: el plan permitía poner `umbralDesdeSchedule` en `evaluate.ts` "o módulo hermano". Vive en `evaluate.ts`, junto a la regla fail-closed que reusa.

## Known Stubs

Ninguno. Todo lo que este plan expone está cableado a datos reales de PROD.

## Gaps de 119 que este plan NO cierra

G1, G5, G6, G7, G9 siguen abiertos (otros planes de la fase). G8 y el `GEMINI_API_KEY` de G9 son actos de operador con checkpoint ya emitido en 118. G11 requiere ≥2 semanas de observación. CRON-02 **no** se marca aquí: se marca al cierre de fase.

## Self-Check: PASSED

- `packages/freshness/src/catalog.ts` FOUND (contiene `actualidad_senal`, `PGCRON_JOBS`, `HUECOS DECLARADOS DE COBERTURA`)
- `packages/freshness/src/query-runner.ts` FOUND (contiene `job_run_details`, `queryPgCron`)
- `packages/freshness/src/evaluate.ts` FOUND (contiene `umbralDesdeSchedule`, `evaluatePgCron`)
- `packages/freshness/src/cli.ts` FOUND (contiene `renderPgCron`, clave `pgcron`)
- Commits `fe0aeb9`, `82a07f9`, `9593aa5`, `12c0575` FOUND en `git log`
