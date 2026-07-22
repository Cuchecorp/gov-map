---
phase: 89-b-squeda-p1d-deep-links-de-validaci-n-por-bolet-n-gate-browseros
plan: "01"
subsystem: tramitacion
tags: [trace, deep-link, backfill, migration, r2, prmid]
dependency_graph:
  requires: []
  provides: [prm_id_camara columna PROD, backfill CLI LOCAL, parseCamaraLegislativo prmId]
  affects: [proyecto tabla, packages/tramitacion]
tech_stack:
  added: []
  patterns:
    - "dos-etapas R2-first (etapa1 R2 putImmutable → etapa2 UPDATE Supabase)"
    - "CamaraProyectoPar shape con prmId: string | null"
    - "enumerarProyectosConIdXAnno con onXml callback para R2"
key_files:
  created:
    - supabase/migrations/0058_proyecto_prm_id_camara.sql
    - packages/tramitacion/src/run-backfill-prmid-cli.ts
  modified:
    - packages/tramitacion/src/parse-camara-legislativo.ts
    - packages/tramitacion/src/parse-camara-legislativo.test.ts
    - packages/tramitacion/src/connector-camara.ts
decisions:
  - "prmId como string|null en CamaraProyectoPar — null cuando <Id> ausente; fila NO descartada (fail-honest)"
  - "onXml callback en enumerarProyectosConIdXAnno — evita exponer R2Store como dep del connector"
  - "R2 key = camara-legislativo/{anno}-{op}/{fecha}/{sha}.xml — una key por op/año/corrida"
  - "0058 sin grant: hereda grant select de 0008; lockdown-guard Block A no muerde"
  - "UPDATE .eq('boletin') no-upsert: solo toca filas existentes; sin crear proyectos nuevos"
metrics:
  duration: "~25 min"
  completed: "2026-07-22"
  tasks: 2
  files: 5
---

# Phase 89 Plan 01: Migración 0058 + Parser prmId + CLI Backfill Summary

Columna aditiva `proyecto.prm_id_camara` aplicada a PROD con parser que emite `{boletin, prmId}` del XML WSLegislativo, y CLI LOCAL dos-etapas reanudable (R2-first → UPDATE); corrida de validación 2024: 800/800 boletines con prmId, 800/3659 filas PROD pobladas.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migración 0058 + parser emite {boletin, prmId} | 64c86d7 | 0058.sql, parse-camara-legislativo.ts, .test.ts, connector-camara.ts |
| 2 | Conector enumerarProyectosConIdXAnno + CLI backfill LOCAL | 583f214 | connector-camara.ts, run-backfill-prmid-cli.ts |

## What Was Built

### Migración 0058 (aplicada a PROD)
- `alter table public.proyecto add column if not exists prm_id_camara text` — nullable, sin grant.
- Hereda `grant select on proyecto to anon` de 0008 (sin grant nuevo; lockdown-guard Block A verde).
- Comentario documenta el deep-link: `tramitacion.aspx?prmID={prm_id_camara}&prmBOLETIN={boletin}`.
- Ledger reconciliado: `INSERT INTO supabase_migrations.schema_migrations ('0058', ...)`.

### Parser modificado (`parse-camara-legislativo.ts`)
- Nuevo tipo `CamaraProyectoPar { boletin: string; prmId: string | null }`.
- `parseCamaraLegislativo` devuelve `CamaraProyectoPar[]` en lugar de `string[]`.
- `Id: z.string().optional()` añadido al schema — ausente NO descarta la fila (prmId=null).
- Idiom fail-soft (continue en boletin inválido) y dedup (por boletin) preservados INTACTOS.
- 3 tests nuevos verdes: prmId-1 (con Id), prmId-2 (sin Id → null), prmId-3 (boletin inválido → descartado).
- Caller `enumerarProyectosXAnno` actualizado: `for (const par of ...) out.add(par.boletin)`.

### Conector extendido (`connector-camara.ts`)
- Método `enumerarProyectosConIdXAnno(anno, onXml?)` que espeja `enumerarProyectosXAnno` pero:
  - Invoca el callback `onXml(op, xml)` ANTES del parse (para que el CLI persista a R2).
  - Devuelve `CamaraProyectoPar[]` (con prmId).
- Rate-limit LOCKED: `this.fetch` (assertAllowedUrl → robots → rateLimiter 2-3s → fetcher); NUNCA hand-roll.
- WR-04 preservado: si ambas ops fallan → lanza (audible, no silencioso).

### CLI backfill LOCAL (`run-backfill-prmid-cli.ts`)
- Colaboradores `@obs/ingest` verbatim: `new Fetcher()`, `new HostRateLimiter()`, `new RobotsGuard`.
- Etapa 1: R2Store.putImmutable("camara-legislativo", `{anno}-{op}`, fecha, sha, "xml", body) — 412=idempotente.
- Etapa 2: `sb.from("proyecto").update({ prm_id_camara: prmId }).eq("boletin", boletin)` — solo filas existentes, solo prmId != null.
- Flags: `--desde/--hasta` (1990..2100), `--dry-run`. isMain regex del propio archivo.
- Fail-loud: error R2/DB lanza; propaga solo `error.message` (nunca service key).
- Reanudable: R2 412=OK → salta escritura; UPDATE idempotente → misma corrida = no-op.

## Verification Results

- `pnpm --filter ./packages/tramitacion test -- --run`: **171/171 verde**.
- `pnpm --filter ./packages/tramitacion exec tsc --noEmit`: **sin errores**.
- `pnpm --filter ./app test -- --run lockdown-guard`: **1060/1060 verde** (0058 sin grant).
- `\d proyecto` en PROD: columna `prm_id_camara text` presente.
- `select count(*) from pg_policies where tablename='proyecto'`: **0** (ninguna policy nueva).

## Corrida de Validación (2024)

```
backfill-prmid: iniciando años 2024..2024 (rate-limit 2-3s, dos-etapas R2→UPDATE)
backfill-prmid: 2024 → 800 enumerados, 800 con prmId, 800 updated
backfill-prmid: COMPLETADO años 2024..2024 | enumerados=800 conPrmId=800 updated=800 errAnos=0
```

Cobertura post-validación:
```sql
select count(*) filter (where prm_id_camara is not null) as con_prmid, count(*) as total from proyecto;
-- con_prmid=800, total=3659
```

## Comando para Corrida Completa (1990–2023, Reanudable)

```bash
pnpm exec tsx packages/tramitacion/src/run-backfill-prmid-cli.ts --desde 1990 --hasta 2023
```

- Tiempo estimado: ~2-3h (rate-limit 2-3s por fetch, 2 ops × 34 años = 68 fetches + parse + UPDATEs).
- Reanudable: interrumpir y re-correr es seguro (R2 412=idempotente, UPDATE idempotente).
- Verificar cobertura final:
  ```bash
  psql "$SUPABASE_DB_URL" -c "select count(*) filter (where prm_id_camara is not null) as con_prmid, count(*) as total from proyecto;"
  ```

## Deviations from Plan

None — plan ejecutado exactamente como escrito. El checkpoint Task 3 fue resuelto por el orquestador (autorizado como bloque inline): migración aplicada a PROD y corrida de validación completada en esta misma ejecución.

## Known Stubs

Ninguno — `prm_id_camara` es NULL para los 2859 boletines de 1990-2023 (fail-honest declarado), no es un stub: los NULLs son el estado esperado hasta correr la corrida completa.

## Threat Flags

Ninguno — no se introdujeron nuevas superficies no contempladas en el threat model (T-89-01..T-89-SC).

## Self-Check: PASSED

- [x] `supabase/migrations/0058_proyecto_prm_id_camara.sql` — existe
- [x] `packages/tramitacion/src/parse-camara-legislativo.ts` — CamaraProyectoPar exportado
- [x] `packages/tramitacion/src/run-backfill-prmid-cli.ts` — existe
- [x] Commit 64c86d7 — existe
- [x] Commit 583f214 — existe
- [x] Columna prm_id_camara en PROD — verificada vía psql `\d proyecto`
- [x] Cobertura 800/3659 — verificada post-corrida 2024
