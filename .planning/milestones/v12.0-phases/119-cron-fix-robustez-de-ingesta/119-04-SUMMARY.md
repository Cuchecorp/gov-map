---
phase: 119-cron-fix-robustez-de-ingesta
plan: 04
subsystem: ingesta
tags: [source_snapshot, provenance, r2, cron, g5]
requires:
  - packages/ingest/src/snapshot.ts (SnapshotWriter.write)
  - packages/ingest/src/snapshot-store-supabase.ts (SupabaseSnapshotStore)
  - packages/tramitacion/src/run-tramitacion-prod-cli.ts:215-224 (plantilla dorada)
provides:
  - agenda / identity / lobby-leylobby escriben fila en source_snapshot
  - RunIngestOpts.snapshotWriter (agenda) y RunIngestLobbyOpts.snapshotWriter
  - buildSnapshotWriter (identity, gateado por credenciales)
affects:
  - packages/agenda/src/run-agenda-prod-cli.ts
  - packages/agenda/src/ingest-run.ts
  - packages/identity/src/seed-cli.ts
  - packages/lobby/src/ingest-cli.ts
  - packages/lobby/src/ingest-run.ts
tech-stack:
  added: []
  patterns: [provenance-fnd-08, best-effort-no-fatal, degradacion-honesta, etapa-1-crudo-primero]
key-files:
  created: []
  modified:
    - packages/agenda/src/run-agenda-prod-cli.ts
    - packages/agenda/src/ingest-run.ts
    - packages/agenda/src/ingest-run.test.ts
    - packages/identity/src/seed-cli.ts
    - packages/identity/src/seed-cli.test.ts
    - packages/lobby/src/ingest-cli.ts
    - packages/lobby/src/ingest-run.ts
    - packages/lobby/src/ingest-run.test.ts
decisions:
  - "`source` = el nombre del CATÁLOGO de freshness (`agenda`, `lobby-leylobby`, `identity`), NO el prefijo de la key de R2 (`camara`, `leylobby`): `r2SnapshotSignal` consulta `where source = '<fuente del catálogo>'`"
  - "`source_snapshot.date_bucket` es una columna DATE — descubierto por corrida LIVE, no por lectura de código; agenda emite el LUNES de la semana ISO"
  - "identity: en GitHub Actions (backup-parlamentario.yml mapea SOLO los R2_*) no hay service key ⇒ writer undefined ⇒ SIN snapshot, declarado en código y en log"
metrics:
  duration: ~75min
  completed: 2026-07-28
requirements: [CRON-02]
---

# Phase 119 Plan 04: G5 — `source_snapshot` en los 3 conectores restantes Summary

Agenda, identity y lobby-leylobby montan `SnapshotWriter` sobre `SupabaseSnapshotStore` y
registran la provenance del crudo que ya depositaban en R2. Verificado contra PROD: `source_snapshot`
pasó de 2 a **3** fuentes con una corrida real de agenda (`agenda|1`), y esa misma corrida
destapó que `date_bucket` es DATE y no texto.

## Qué se hizo

### Task 1 — agenda (commit `dd04382`, fix `4f573f2`)
- `run-agenda-prod-cli.ts`: `snapshotWriter` ensamblado con la plantilla dorada literal de
  `run-tramitacion-prod-cli.ts:215-224`, gateado por `!dryRun && SUPABASE_API_URL && SUPABASE_SECRET_KEY`.
  Se añadió el adaptador `createSupabaseClient` (mismo cast que tramitación).
- `ingest-run.ts`: `snapshotWriter?: Pick<SnapshotWriter,"write">` en `RunIngestOpts`, y escritura
  en los DOS puntos de Etapa 1 — `citaciones-semana` y `tabla-sala` — **solo tras `existed:false`**.
- `cacheKey` reusa la partición semanal de la key de R2 (`agenda:citaciones-semana:2026-W24`),
  de modo que snapshot y objeto comparten identidad (WR-01).
- Try/catch propio por escritura: un fallo loguea `source_snapshot falló (no fatal)` y la Etapa 2
  sigue. 4 tests nuevos (write por recurso, cero writes con `existed:true`, best-effort con conteos
  preservados contra una corrida de control, y ausencia de writer).

### Task 2 — identity (commit `eb93b44`)
- `buildSnapshotWriter(url, serviceKey)` exportado: devuelve `null` sin credenciales.
- La fila (`source: "identity"`, `resource: "parlamentario-seed"`) se escribe DENTRO de la rama
  `existed:false` de la Etapa 1 (que el plan 03 movió antes de la carga), con `contentHash` = sha256
  del MISMO buffer que se subió a R2 (`serializeMaestra(maestra)` cruda).
- **Honestidad declarada en el código y en el log**: `backup-parlamentario.yml:38-42` mapea sólo los
  cuatro `R2_*`; en esa corrida de CI el writer queda `null` y se emite
  `sin credenciales Supabase -> NO se registra fila en source_snapshot (esperado en GitHub Actions...)`.
  La ruta que SÍ registra provenance es la corrida LOCAL del operador con `.env` completo.
  No se fabricó credencial ni se asumió que el cron lo cubriría.
- 5 tests nuevos (incl. `buildSnapshotWriter` null con cada combinación de credencial faltante y
  la ausencia de log fantasma).

### Task 3 — lobby-leylobby (commit `6018f6b`)
- `ingest-cli.ts`: writer ensamblado con las MISMAS variables ya resueltas (`SUPABASE_DB_URL` /
  `SUPABASE_URL` / `SUPABASE_API_URL` y las tres variantes de key), gateado por
  `!dryRun && url && serviceKey`; seam `snapshotWriter` para tests.
- `ingest-run.ts`: fila por recurso nuevo (`resource` = `AA001/2024/p1`), tras el put con
  `existed:false`, best-effort.
- `packages/lobby/src/cursor-leylobby.ts` **sin diff** (materia del plan 06).
- 3 tests nuevos.

## Verificación

| Check | Resultado |
|---|---|
| `pnpm --filter @obs/agenda test` | 123 passed (13 archivos) |
| `pnpm --filter @obs/identity test` | 119 passed (14 archivos) |
| `pnpm --filter @obs/lobby test` | 71 passed (9 archivos) |
| `pnpm test` (suite completa, packages + app) | verde; bloque final 1560 passed / 107 archivos |
| `npx tsc -b` | exit 0 |
| `grep -c SnapshotWriter` agenda-cli / identity / lobby-cli | 3 / 8 / 4 (≥1 cada uno) |
| `git diff packages/lobby/src/cursor-leylobby.ts` | vacío |

### Corrida LIVE acotada contra PROD (sí se hizo)

Dos corridas de `run-agenda-prod-cli` de UNA semana cada una (rate-limit, UA y robots intactos;
el resto del rango por defecto NO se tocó).

`select source, count(*) from source_snapshot group by 1 order by 1;` (psql read-only, URL no impresa):

```
agenda|1
infoprobidad|3
leyes|4380
```

Fila escrita (misma consulta, filtrada a `source='agenda'`):

```
agenda|citaciones-semana|2026-10-05|472448b64101|2026-07-28 18:15:06.042+00
```

El `content_hash` `472448b6…` es el mismo sha que compone la key de R2
`camara/citaciones-semana/2026-W41/472448b6….html` → la fila es **verificable contra el objeto**
(T-119-10), no un dato declarativo.

La segunda corrida también ejercitó el camino negativo real: la tabla de sala dio
`[skip] sin novedades — camara tabla-sala 2026-W31` y **no** escribió snapshot (T-119-12).

**El objetivo "2 → 5 fuentes" NO está cumplido todavía**: hoy son 3. `identity` y `lobby-leylobby`
quedan pendientes de su primera corrida real (identity requiere corrida local del operador con
`--r2`; lobby-leylobby, su cron semanal). Se declara así en vez de darlo por hecho.

## Deviations from Plan

**1. [Rule 1 — Bug] `source_snapshot.date_bucket` es DATE, no texto**
- **Found during:** la corrida LIVE de Task 1 (no era visible leyendo código: §3.1 de 118 listó la
  columna pero no su tipo).
- **Issue:** enviar `"2026-W40"` produjo `invalid input syntax for type date` (22P02). El
  best-effort funcionó exactamente como se diseñó — la ingesta terminó `errores=0` y el crudo
  quedó en R2 — pero NINGUNA fila se habría escrito jamás.
- **Fix:** agenda emite `primerDiaSemanaIso(year, week)` (el lunes UTC de la semana ISO). Sigue
  siendo la misma partición semanal que la key de R2, expresada como fecha real, y el unique
  `(source, resource, date_bucket)` da UNA fila por semana ingerida. Identity (`YYYY-MM-DD` de la
  corrida) y lobby (`ingestadoHasta`) ya emitían fechas válidas — no requirieron cambio.
- **Test de regresión:** `dateBucket` asertado como `/^\d{4}-\d{2}-\d{2}$/` en todas las escrituras.
- **Commit:** `4f573f2`.

**2. [Decisión declarada] `source: "lobby-leylobby"` en vez del `"leylobby"` que pedía el plan**
- El plan Task 3 escribía `source: "leylobby"`, pero su propia Task 1 punto 4 exige que `source`
  coincida con lo que `query-runner.ts:132` consulta, que es el nombre del CATÁLOGO
  (`catalog.ts:375` → `fuente: "lobby-leylobby"`). Con `"leylobby"` la señal `r2Snapshot` seguiría
  diciendo "n/d (sin snapshots)" para siempre. Se aplicó el criterio del punto 4 de forma
  consistente en los tres conectores; el catálogo NO se renombró.
- Consecuencia: el `source` del snapshot difiere del prefijo de la key de R2 (`camara/…`,
  `leylobby/…`). Es deliberado — el `r2_path` completo va en la fila, así que la localización del
  objeto no depende de esa coincidencia.
- `identity` no tiene entrada en el catálogo de freshness (nunca la tuvo): su fila queda escrita y
  consultable, pero NO produce señal de frescura hasta que alguien agregue la entrada. No se agregó
  acá porque el catálogo es materia del plan 02 (G2/G3/G4) y tocarlo sin declarar sería fabricar
  cobertura.

## Hallazgos para el documento de cierre de la fase

- **`identity` fuera del catálogo de freshness.** Ahora registra provenance pero nadie la mira.
  Criterio de cierre sugerido: entrada `identity` en `catalog.ts` con umbral acorde al cron de
  `backup-parlamentario` — o la decisión explícita de dejarla fuera por ser artefacto git-primero.
- **`probidad` escribe `source: "infoprobidad"`** mientras el catálogo la llama `probidad`: el mismo
  desalineamiento que este plan evitó en los tres nuevos, preexistente y NO tocado acá.
- **La verificación de tipos de columna sólo la da la corrida real.** El 22P02 pasó por tests
  verdes, tsc verde y revisión de código. Vale como argumento para que el cierre de fase incluya al
  menos una corrida LIVE por conector tocado, no sólo la suite.

## Self-Check: PASSED

8/8 archivos declarados existen; 4/4 commits declarados (`dd04382`, `eb93b44`, `6018f6b`,
`4f573f2`) existen en el historial.

## Threat Flags

Ninguno. `content_hash` es el sha256 real de los bytes puestos en R2 y coincide con la key
(T-119-10, verificado en PROD); ninguna fila ni log lleva credenciales y `r2_path` es
content-addressed (T-119-11); toda escritura ocurre SOLO tras un `putImmutable` con `existed:false`
(T-119-12, verificado por el caso `tabla-sala` que hizo skip y no registró nada); no se instaló
ningún paquete (T-119-SC); rate-limit, UA y robots intactos en la corrida LIVE.
