---
phase: 119-cron-fix-robustez-de-ingesta
plan: 03
subsystem: ingesta
tags: [r2, idempotencia, cron, locked-rules, g6]
requires:
  - packages/ingest/src/r2-store.ts (putImmutable → { r2Path, existed })
  - packages/tramitacion/src/ingest-run.ts (plantilla dorada del guard de skip)
provides:
  - agenda/probidad/identity consumen `existed` y emiten `[skip] sin novedades`
  - RunProbidadTodosResult.sinNovedades
  - R2BackupTarget.put → { r2Path, existed }
affects:
  - packages/agenda/src/ingest-run.ts
  - packages/probidad/src/run-probidad-todos.ts
  - packages/identity/src/seed-cli.ts
  - packages/identity/src/backup.ts
tech-stack:
  added: []
  patterns: [hash-check-antes-de-gastar, etapa-1-crudo-primero, degradacion-honesta]
key-files:
  created: []
  modified:
    - packages/agenda/src/ingest-run.ts
    - packages/agenda/src/ingest-run.test.ts
    - packages/probidad/src/run-probidad-todos.ts
    - packages/probidad/src/run-probidad-todos.test.ts
    - packages/identity/src/seed-cli.ts
    - packages/identity/src/seed-cli.test.ts
    - packages/identity/src/backup.ts
decisions:
  - "identity: la Etapa 1 (R2) se movió ANTES de la carga a DB y su contenido es la maestra CRUDA (pre preserve-estado / pre promote) — es el crudo de las fuentes, no el derivado"
  - "identity: exportMaestra ya no hace el put a R2 (r2Enabled:false desde seed-cli) para no subir el mismo objeto dos veces"
  - "probidad: NO se reordenan etapas; el 412 queda consumido y visible, y la reordenación se registra como hallazgo"
metrics:
  duration: ~50min
  completed: 2026-07-28
requirements: [CRON-02]
---

# Phase 119 Plan 03: G6 — `existed` consumido en los 3 conectores Summary

Los tres llamadores de `putImmutable` que descartaban `existed` ahora lo consumen: agenda salta
parseo y extracción DeepSeek, identity salta la carga a DB sin tocar el snapshot git, y probidad
deja el 412 visible declarando por qué su orden de etapas no permite ahorrar trabajo.

## Qué se hizo

### Task 1 — agenda (commits `4355cfa` RED, `4b83627` GREEN)
- **citaciones-semana**: `const { r2Path: key, existed }` + `if (existed) { log("[skip] sin
  novedades — camara citaciones-semana <clave>"); break; }`. Se usa `break` y no `continue`
  porque el `putImmutable` vive dentro del loop de REINTENTOS 403; salir de él deja `html == null`,
  que el guard existente traduce en "pasar a la próxima semana" sin contarla como bloqueada ni
  como error.
- **tabla de sala PDF**: flag `sinNovedadesTabla` ⇒ se omite `extraerTextoTablaPdf` (unpdf) y,
  con ello, la extracción DeepSeek — el gasto más caro de la corrida. Si no hay extracción, la
  degradación honesta al PDF se emite como siempre (nunca filas inventadas).
- **No se tocó** el manejo best-effort de error de R2 (`semanasSinRespaldoR2`): un fallo de R2
  sigue dejando que la Etapa 2 proceda con los bytes en memoria. Sólo el 412 hace skip.
- 6 tests nuevos (los 5 de `<behavior>` + un control de que con `existed:false` la extracción SÍ
  se alcanza, asertado por el log `no es un PDF (magic bytes)` de `parse-camara-tabla`).

### Task 2 — probidad (commits `b295e06` RED, `ca7de60` GREEN)
- `existed` destructurado, `sinNovedades: boolean` añadido a `RunProbidadTodosResult`,
  log `[skip] sin novedades — infoprobidad declaraciones <hasta>`.
- Con `existed:true` NO se re-registra la fila `source_snapshot` (el objeto ya estaba registrado);
  `r2Path` SÍ se sigue exponiendo, porque el 412 es éxito idempotente, no fallo.
- Comentario en el archivo declarando la **divergencia deliberada** respecto de la plantilla
  dorada: acá la Etapa 1 corre DESPUÉS de la carga, así que el skip no ahorra parseo.
- 3 tests nuevos.

### Task 3 — identity (commits `1117834` RED, `e37cf33` GREEN)
- `R2BackupTarget.put` pasa de `Promise<string>` a `Promise<{ r2Path; existed }>`;
  `buildR2Target` devuelve el resultado de `putImmutable` sin descartarlo.
- La Etapa 1 (R2) se **movió antes** de la carga a DB (paso 2c) — es el único modo de que el skip
  salte la carga, que es lo que G6 exige. El contenido content-addressed es
  `serializeMaestra(maestra)` **cruda**, tal como la devolvieron los catálogos, antes de
  `--preserve-estado` (mergea desde un archivo local) y de `--promote` (muta desde la DB): eso
  ES el crudo de la fuente, coherente con la regla LOCKED "crudo PRIMERO en R2".
- La escritura del seed a disco (`FsSeedFileWriter`) queda **fuera** del skip, con cita al
  comentario de `backup-parlamentario.yml:60` en el código: el snapshot que el bot commitea es
  autoritativo y no puede quedarse sin actualizar por un skip de R2.
- `exportMaestra` se invoca con `r2Enabled:false` desde `seed-cli` (el put ya ocurrió en 2c) —
  no se sube dos veces el mismo objeto. `res.r2Ok` ahora viene del put de 2c.
- Seams de inyección (`seeder`, `dbWriter`, `fileWriter`, `r2Target`) añadidos a `SeedCliOptions`
  para poder testear `main()` sin red ni DB. 4 tests nuevos.

## Verificación

| Check | Resultado |
|---|---|
| `pnpm --filter @obs/agenda test` | 119 passed (13 archivos) |
| `pnpm --filter @obs/probidad test` | 49 passed |
| `pnpm --filter @obs/identity test` | 114 passed |
| `pnpm test` (suite completa) | 1560 passed, 107 archivos, 0 fallos |
| `npx tsc -b` | exit 0 |
| `grep -c existed` agenda / probidad / identity | 7 / 4 / 5 (≥4 / ≥2 / ≥2) |
| `grep -c '\[skip\] sin novedades'` agenda | 2 |

Los tests RED se commitearon fallando antes de cada implementación (3, 3 y 4 fallos
respectivamente), y pasan tras el fix — el guard es lo que los hace pasar.

## Deviations from Plan

**1. [Rule 3 — Blocking] `main()` de identity no era testeable**
- **Found during:** Task 3.
- **Issue:** los 4 tests de `<behavior>` exigen ejercitar `main()`, que instanciaba `Fetcher`,
  `runSeeder`, `SupabaseMaestraWriter` y `FsSeedFileWriter` internamente (red + DB reales).
- **Fix:** seams opcionales `seeder` / `dbWriter` / `fileWriter` / `r2Target` en `SeedCliOptions`,
  marcados "SOLO tests"; en producción quedan `undefined` y el camino real no cambia.
- **Commit:** `e37cf33`.

**2. [Decisión de diseño] identity: reordenación de la Etapa 1 (autorizada por el plan)**
- El plan pide explícitamente para identity que "el skip salte la CARGA". Eso es imposible con la
  Etapa 1 corriendo al final, así que se movió antes de la carga. Consecuencias declaradas:
  el objeto R2 pasa a ser la maestra cruda (pre-preserve/pre-promote) en vez del snapshot final, y
  `exportMaestra` ya no hace el put. Es un cambio de contenido del respaldo R2 — el snapshot git
  sigue siendo el artefacto autoritativo (ID-09) y no cambió.

## Hallazgos declarados (para el documento de cierre de la fase)

- **probidad: el orden de etapas está invertido.** `run-probidad-todos.ts` hace la carga a
  Supabase (upserts + `marcarIngestado`) ANTES de persistir el crudo agregado en R2. Mientras siga
  así, el `existed` no puede ahorrar trabajo: las ~N queries SPARQL y todos los upserts ya se
  gastaron cuando llega el 412. Mover la Etapa 1 antes de la carga exigiría acumular el crudo
  completo primero (ya se acumula en `crudos[]`, así que es viable) y luego decidir. **Este plan
  no reordenó etapas por instrucción explícita.** Criterio de cierre sugerido: un plan aparte que
  mueva el put+snapshot antes del `marcarIngestado` y aserte que con `existed:true` no se
  invoca `upsertDeclaraciones`.
- **agenda, tabla de sala:** cuando hay skip, la corrida reporta la degradación honesta
  "tabla no disponible como dato estructurado esta corrida (solo PDF)". Es cierto para *esa
  corrida* (no se extrajo nada), y las filas de la corrida anterior siguen en DB (upsert
  idempotente), pero un lector del reporte podría leerlo como pérdida de cobertura. Si molesta,
  el fix es un motivo distinto para el caso "sin novedades".

## Verificación diferida (no ejecutada)

La corrida local acotada de un conector para ver el `[skip]` en la segunda pasada **no se
ejecutó**: `camara.cl` bloquea el fetch de Node por WAF (gotcha v3.0, sólo curl pasa) y una
corrida real gastaría requests contra la fuente sin aportar más que los tests, que ya asertan la
invariante con el store devolviendo `existed:true`. Queda para la verificación E2E de Phase 125,
donde el cron real produce la segunda corrida consecutiva sin costo adicional.

## Self-Check: PASSED

4/4 archivos declarados existen; 7/7 commits declarados existen en el historial.

## Threat Flags

Ninguno. El skip se dispara SOLO por el 412 de R2 (hash del contenido), nunca por heurísticas de
fecha o tamaño (T-119-07); todo skip emite log (T-119-08); no se tocó rate-limit, UA ni robots
(T-119-09); no se instaló ningún paquete (T-119-SC).
