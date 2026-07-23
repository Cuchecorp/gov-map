---
phase: 87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix
plan: 01
subsystem: database
tags: [postgres, pgvector, fts, rpc, unaccent, rrf, supabase, pgTAP]

requires:
  - phase: 86-spike-retrieval-hibrido
    provides: SQL RRF medido en el spike (estrategias.ts, golden set, métricas 43.8/68.8/53.6)
  - phase: 87-00-research
    provides: schema verificado (proyecto/proyecto_ficha/proyecto_embedding), boletin_num, idiom lockdown

provides:
  - "RPC buscar_proyectos_hibrido(text,vector,int) en PROD — short-circuit boletín rank 0, FTS A/B/C LEFT JOIN proyecto_ficha, semántica HNSW, fusión RRF rrf_k=50"
  - "extension unaccent + config public.es_unaccent (copy=spanish + mapping unaccent) en PROD"
  - "índice GIN expresión sobre tsv del título (idx_proyecto_titulo_fts)"
  - "pgTAP post-apply 5/5 verde contra PROD"
  - "ledger schema_migrations reconciliado con versión 0055"

affects: [87-02-rewire, 87-03-gate, 88-filtros, 89-deep-links]

tech-stack:
  added: [unaccent (pg contrib, ahora creado en PROD), public.es_unaccent (text search config custom)]
  patterns:
    - "operator(public.<=>) para pgvector bajo search_path='' (necesario porque <=> vive en schema public)"
    - "DO $$ ... exception when duplicate_object then null; end $$ para idempotencia de CREATE TEXT SEARCH CONFIGURATION"
    - "RRF fusión full outer join con rrf_k=50, w=1/1, rank int = row_number::int sobre score descendente"

key-files:
  created:
    - supabase/migrations/0055_busqueda_hibrida.sql
    - supabase/tests/post-apply/0055_busqueda_hibrida.test.sql
  modified: []

key-decisions:
  - "operator(public.<=>) obligatorio bajo search_path='': el operador <=> de pgvector no resuelve con search_path vacío sin calificación explícita de schema (auto-fix Rule 1)"
  - "DO-exception guard para CREATE TEXT SEARCH CONFIGURATION (A2 orchestrator): la config no tiene IF NOT EXISTS nativo; el guard lo hace idempotente"
  - "boletín pinneado para pgTAP short-circuit: 15627-12 (boletin_num=15627, verificado en PROD antes de escribir el test)"

patterns-established:
  - "Pattern operator(public.<=>): toda RPC con search_path='' que use pgvector debe usar operator(public.<=>) en lugar de <=>"
  - "Pattern DO-exception para text search config: envolver create text search configuration en DO-exception para idempotencia total"

requirements-completed: [RETR-01, RETR-02, RETR-05]

duration: 35min
completed: 2026-07-22
---

# Phase 87 Plan 01: Migración 0055 buscar_proyectos_hibrido Summary

**RPC híbrida RRF (FTS A/B/C unaccent + semántica HNSW rrf_k=50) con short-circuit boletín rank 0 aplicada a PROD, pgTAP 5/5 verde — arreglo del bug estrella RETR-01/RETR-02**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-22T01:40:00Z
- **Completed:** 2026-07-22T02:15:00Z
- **Tasks:** 2
- **Files modified:** 2 (creados)

## Accomplishments

- Migración 0055 aplicada a PROD vía `PGCLIENTENCODING=UTF8 psql --single-transaction`: extension unaccent, config `public.es_unaccent`, índice GIN del título, RPC `buscar_proyectos_hibrido`, doble-revoke ACL.
- pgTAP post-apply 5/5 ok, 0 not ok contra el schema PROD vivo (has_function, PUBLIC sin EXECUTE, unaccent, es_unaccent, short-circuit 15627-12 rank 0).
- Ledger `supabase_migrations.schema_migrations` reconciliado con versión `0055`.
- Smoke test `buscar_proyectos_hibrido('medio ambiente', vector, 5)` devuelve 5 filas sin error.
- `match_proyectos` (0011) intacta (count en pg_proc = 1, firma sin cambio).

## Task Commits

1. **Task 1: Escribir migración 0055 + pgTAP** - `817988e` (feat)
2. **Task 1 fix: operator(public.<=>) bajo search_path=''** - `2c3b519` (fix)

## Files Created/Modified

- `supabase/migrations/0055_busqueda_hibrida.sql` — migración aditiva: 5 secciones (unaccent, es_unaccent, GIN, RPC RRF, ACL doble-revoke)
- `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` — pgTAP post-apply plan(5)

## Decisions Made

- `operator(public.<=>)` en lugar de `<=>` para la rama semántica: con `search_path=''` el operador pgvector no resuelve sin prefijo de schema.
- DO-exception guard para `CREATE TEXT SEARCH CONFIGURATION`: idempotencia total en re-applies (A2 del plan-checker).
- Boletín `15627-12` pinneado en pgTAP (verificado real en PROD antes de escribir el test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] operator(public.<=>) necesario bajo search_path=''**
- **Found during:** Task 2 (aplicar 0055 a PROD)
- **Issue:** `ERROR: operator does not exist: public.vector <=> public.vector` — el operador `<=>` de pgvector vive en schema `public`; con `set search_path=''` no resuelve sin calificación.
- **Fix:** Reemplazar `e.embedding <=> query_embedding` por `e.embedding operator(public.<=>) query_embedding` en la rama semántica (ORDER BY y row_number OVER).
- **Files modified:** `supabase/migrations/0055_busqueda_hibrida.sql`
- **Verification:** Migración re-aplicada exitosamente (CREATE FUNCTION + REVOKE × 2 sin error); pgTAP 5/5.
- **Committed in:** `2c3b519` (fix separado del feat)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug de resolución de operador pgvector bajo search_path='')
**Impact on plan:** Fix necesario para correctness; no hay scope creep. El patrón `operator(public.<=>)` es el idiom canónico para pgvector bajo search_path vacío.

## Issues Encountered

- `CREATE TEXT SEARCH CONFIGURATION` no tiene `IF NOT EXISTS` nativo — resuelto con el guard DO-exception (A2 orchestrator advisory).
- `<=>` de pgvector no resuelve con `search_path=''` — resuelto con `operator(public.<=>)`.

## Checklist de Seguridad (pre-apply, PASADO)

1. CERO `grant … to anon/public`: PASS
2. `security definer set search_path=''` + todo schema-qualified: PASS
3. `least(match_count,50)` y `*2` por rama: PASS
4. retorno PII-safe `(boletin text, rank int)`: PASS
5. `drop function if exists` con firma exacta antes del create: PASS

## pgTAP Post-Apply (5/5 VERDE)

```
1..5
ok 1 - buscar_proyectos_hibrido(text, vector, int) existe
ok 2 - PUBLIC sin EXECUTE en buscar_proyectos_hibrido (T-87-01)
ok 3 - extension unaccent presente en PROD
ok 4 - text search config es_unaccent existe
ok 5 - short-circuit boletín 15627-12 → rank 0 (RETR-01)
```

## Next Phase Readiness

- Plan 02 (rewire): `buscar_proyectos_hibrido` ya existe en PROD; `buscar.ts` puede cablear el flag `BUSQUEDA_HIBRIDA_ENABLED` y agregar `buscar_proyectos_hibrido` al allowlist del lockdown-guard.
- Plan 03 (gate): la RPC está lista para el gate de dominancia con el golden set.
- `match_proyectos` intacta para "proyectos similares" (SEM-05).

## Threat Surface Scan

No se introdujo superficie nueva no contemplada en el plan. La RPC es PII-safe por construcción (retorna solo boletin+rank), tiene doble-revoke, CERO grant, y lee solo tablas públicas (proyecto/proyecto_ficha/proyecto_embedding). El threat register T-87-01..04 queda implementado.

## Self-Check: PASSED

- `supabase/migrations/0055_busqueda_hibrida.sql`: FOUND (git log 817988e)
- `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql`: FOUND (git log 817988e)
- pgTAP 5/5: PASSED (evidencia arriba)
- `match_proyectos` intacta: VERIFIED (count pg_proc = 1)
- ledger `0055` en schema_migrations: VERIFIED (INSERT 0 1 → versión presente)

---
*Phase: 87-b-squeda-p1b-rpc-h-brida-buscar-proyectos-hibrido-rewire-fix*
*Completed: 2026-07-22*
