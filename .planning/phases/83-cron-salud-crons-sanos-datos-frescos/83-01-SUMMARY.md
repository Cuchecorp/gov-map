---
phase: "83"
plan: "01"
subsystem: "ingesta / crons / identidad"
tags: ["cron", "path-fix", "probidad", "roster", "leyes-daily", "RC-1", "RC-2", "RC-3"]
dependency_graph:
  requires: ["Phase 74 (round-robin leyes)", "Phase 57 (probidad cron)", "Phase 56 (lobby-camara WAF)"]
  provides: ["probidad-weekly VERDE", "roster-weekly VERDE", "leyes L-V cadencia", "docs/crons.md"]
  affects: ["parlamentario.fecha_captura", "leyes_rotacion_estado (cadencia)"]
tech_stack:
  added: []
  patterns: ["findWorkspaceRoot replicado localmente (sin dep cruzada)", "SUPABASE_LOCAL_URL mapeo en CI"]
key_files:
  created:
    - ".github/workflows/roster-weekly.yml"
    - "docs/crons.md"
  modified:
    - "packages/probidad/src/run-probidad-todos-cli.ts"
    - "packages/probidad/src/run-probidad-bienes-cli.ts"
    - "packages/lobby/src/run-camara-lobby-cli.ts"
    - ".github/workflows/leyes-weekly.yml"
    - ".github/workflows/roster-weekly.yml"
decisions:
  - "findWorkspaceRoot replicado localmente en probidad y lobby (sin dep cruzada hacia tramitacion)"
  - "roster-weekly estreno con dispatch-only; schedule 0 10 * * 1 comentado hasta validación"
  - "SUPABASE_LOCAL_URL mapeado desde SUPABASE_API_URL en roster-weekly (seed-cli.ts:214)"
  - "leyes_rotacion_estado schema cache fallo = pre-existing infraestructura (no Phase 83)"
metrics:
  duration: "~45 min"
  completed: "2026-07-15"
  tasks_completed: 4
  files_changed: 7
---

# Phase 83 Plan 01: CRON-SALUD Summary

**One-liner:** Tres CLIs reparados con `findWorkspaceRoot` + `probidad-weekly` verde (run 29453065297) + `roster-weekly` verde (run 29453200580) + cadencia leyes L-V + `docs/crons.md` completo.

## What Was Built

### RC-1: Fix path bug — probidad-weekly (DEMO-02a)

`run-probidad-todos-cli.ts:86` y `run-probidad-bienes-cli.ts:37` usaban `process.cwd()` como raíz del workspace. `pnpm --filter @obs/probidad exec` pone el cwd en `packages/probidad/`, no en la raíz — resultado: ENOENT al leer `supabase/seeds/parlamentario.seed.json`. Fix: `findWorkspaceRoot(process.cwd())` (helper replicado localmente, 12 líneas, mismo patrón que `run-tramitacion-prod-cli.ts:180`).

**Evidencia:** probidad-weekly dispatch manual run ID `29453065297` — **VERDE** en 11m37s. Primera vez que `probidad-weekly` pasa en CI desde su creación en 57-03.

### RC-2: Fix path bug latente — lobby-camara (DEMO-02a)

`run-camara-lobby-cli.ts:72` tenía el mismo `process.cwd()`. No se manifestaba porque el gate WAF fallaba antes de llegar al CLI. Fix aplicado igualmente para que el dispatch manual funcione correctamente si el WAF permite.

Schedule mantiene OFF (WAF diagnóstico 2026-06-30 — `docs/runbooks/cron-local-fallback.md`).

### Cadencia diaria leyes (DEMO-02b)

`leyes-weekly.yml`: `0 20 * * 5` (viernes) → `0 20 * * 1-5` (L-V 20:00 UTC). La máquina round-robin Phase 74 (`leyes_rotacion_estado`) ya soporta diario sin cambio de CLI. "Votado esta semana" captura votos del mismo día laboral.

### RC-3: roster-weekly — `parlamentario.fecha_captura` (DEMO-02c)

Workflow nuevo `roster-weekly.yml` que corre `seed:live --preserve-estado` CON `SUPABASE_LOCAL_SERVICE_KEY` (mapeado desde `SUPABASE_SECRET_KEY`) y `SUPABASE_LOCAL_URL` (mapeado desde `SUPABASE_API_URL` — seed-cli.ts:214). Compuerta humana ID-01 intacta: `--preserve-estado` sin `--promote`.

**Evidencia:** roster-weekly dispatch manual run ID `29453200580` — **VERDE**. Output: `seed: maestra real -> 186 filas (31 senadores + 155 diputados)` + `seed: maestra cargada en Supabase LOCAL (***)`. Preservación WR-03 funcionando (múltiples senadores con `confirmado` preservado).

**TODO operador (GATED):** añadir schedule `0 10 * * 1` (lunes 10:00 UTC) en `roster-weekly.yml` solo tras validar que el chip de ficha refleja fecha < 14d en el sitio.

### docs/crons.md (DEMO-02d)

Matriz completa fuente→workflow→cadencia→secrets derivada de `packages/freshness/src/catalog.ts`. Incluye: crons activos, dispatch-only/runbook, backfill manual, fuentes gated (MONEY/SERVEL). Notas de rate-limit, dos etapas, hash-check, guard fail-loud, env divergente lobby-leylobby.

## Commits

| Hash | Tipo | Descripción |
|------|------|-------------|
| `df94e6b` | fix | findWorkspaceRoot en 3 CLIs rotos (RC-1/RC-2) |
| `c82f194` | chore | leyes-weekly cadencia diaria L-V (0 20 * * 1-5) |
| `0f74a29` | feat | roster-weekly workflow nuevo (RC-3) |
| `9cb091a` | docs | docs/crons.md — matriz completa (DEMO-02d) |
| `8e4241b` | fix | roster-weekly — mapear SUPABASE_LOCAL_URL desde SUPABASE_API_URL |

## Validación (Nyquist)

| Check | Estado | Evidencia |
|-------|--------|-----------|
| probidad-weekly dispatch VERDE | VERDE | run 29453065297, 11m37s, `consultados=[1-9]` pasó |
| roster-weekly dispatch VERDE | VERDE | run 29453200580, `maestra real -> 186 filas`, guard pasó |
| @obs/probidad tests | VERDE | 46 tests, 3.01s |
| @obs/lobby tests | VERDE | 68 tests, 3.14s |
| leyes-weekly cadencia actualizada | HECHO | `0 20 * * 1-5` en workflow |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SUPABASE_LOCAL_URL faltaba en roster-weekly**
- **Found during:** Primera corrida de roster-weekly (run 29453071994, exit 1 silencioso)
- **Issue:** seed-cli.ts:214 lee `SUPABASE_LOCAL_URL` (no `SUPABASE_API_URL`) para la URL del endpoint. Sin este mapeo el seeder apuntaba al localhost default `127.0.0.1:54421` → crash silencioso de conexión, output vacío, guard fail-loud disparado correctamente.
- **Fix:** añadir `SUPABASE_LOCAL_URL: ${{ secrets.SUPABASE_API_URL }}` en el workflow.
- **Commit:** `8e4241b`

### Issues Pre-existentes (Out of Scope — no causados por Phase 83)

**leyes-weekly: schema cache stale (`leyes_rotacion_estado`)**

Tres corridas de leyes-weekly el día 2026-07-15 fallaron con `Could not find the table 'public.leyes_rotacion_estado' in the schema cache`. La tabla existe en `0054_leyes_rotacion_estado.sql` y leyes-weekly fue VERDE el 2026-07-10. Causa: PostgREST schema cache stale (Supabase infraestructura). No causado por la Phase 83 — el único cambio fue la expresión cron.

**TODO de operador: recargar schema cache de PostgREST en Supabase dashboard:**
```sql
NOTIFY pgrst, 'reload schema';
```
o via dashboard: Settings → API → "Reload schema cache". Hasta entonces leyes-weekly no puede correr en CI (falla antes de llegar a la lógica del CLI).

## TODO de Operador Pendiente

1. **Validar chip ficha:** verificar que `parlamentario.fecha_captura` refleja fecha < 14d en la ficha de un parlamentario del Senado (chip debe estar verde, no ámbar). URL ejemplo: `/parlamentario/[id]`.

2. **Activar schedule roster-weekly:** una vez validado el chip, descomentar en `.github/workflows/roster-weekly.yml`:
   ```yaml
   schedule:
     - cron: "0 10 * * 1"  # lunes 10:00 UTC
   ```

3. **Recargar schema cache PostgREST** para desbloquear leyes-weekly: `NOTIFY pgrst, 'reload schema'` o desde Supabase dashboard → API → Reload.

4. **Dispatch manual leyes-weekly** tras el reload para confirmar VERDE.

## Self-Check: PASSED

- `df94e6b` existe en git log: FOUND
- `c82f194` existe: FOUND
- `0f74a29` existe: FOUND
- `9cb091a` existe: FOUND
- `8e4241b` existe: FOUND
- `docs/crons.md` creado: FOUND
- `.github/workflows/roster-weekly.yml` creado: FOUND
- probidad-weekly run 29453065297: VERDE (11m37s)
- roster-weekly run 29453200580: VERDE (186 filas, guard pasó)
