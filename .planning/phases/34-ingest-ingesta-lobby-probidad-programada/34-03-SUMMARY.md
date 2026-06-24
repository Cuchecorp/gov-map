---
phase: 34-ingest-ingesta-lobby-probidad-programada
plan: 03
subsystem: infra
tags: [github-actions, ci, lobby, probidad, scheduled-ingest, curl-anti-waf, pnpm, tsx]

# Dependency graph
requires:
  - phase: 33
    provides: "CLIs ETL CI-safe (loadEnv con precedencia process.env, sin .env en CI)"
  - phase: 34-02
    provides: "wire R2/SnapshotWriter en probidad (R2_* habilitan provenance source_snapshot)"
provides:
  - "Workflow lobby-camara-weekly (INGEST-01): curl anti-WAF + --html-file + assert audiencias>0"
  - "Workflow lobby-leylobby-weekly (INGEST-02): env names divergentes mapeados + assert acepta degradacion honesta"
  - "Workflow probidad-weekly (INGEST-03): SPARQL + 4 R2_* en env + assert declaraciones/confirmados>0"
affects: [operator-secrets-setup, cuchecorp-gov-map-transfer, ingest-cadence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Secrets->env:, inputs leidos con $VAR (nunca ${{ }} interpolado en run: con secrets) — mitiga command injection T-34-08"
    - "curl anti-WAF (UA Bot-Ciudadano/1.0) + gate <10KB + CLI --html-file para Camara"
    - "concurrency group + cron en dia distinto por workflow para no solapar runs"
    - "assert que acepta degradacion honesta (audiencias>0 OR degradaciones>0)"

key-files:
  created:
    - .github/workflows/lobby-camara-weekly.yml
    - .github/workflows/lobby-leylobby-weekly.yml
    - .github/workflows/probidad-weekly.yml
  modified: []

key-decisions:
  - "Cron: lobby-camara martes, lobby-leylobby miercoles, probidad jueves (distintos de agenda lun / leyes vie)"
  - "leylobby mapea SUPABASE_URL<-SUPABASE_API_URL y SUPABASE_SERVICE_KEY<-SUPABASE_SECRET_KEY (env names que el CLI ingest-cli.ts realmente lee)"
  - "probidad pasa los 4 R2_* en env: para habilitar el wire de provenance source_snapshot del Plan 02"

patterns-established:
  - "Inputs de workflow_dispatch por env:, leidos con $VAR en run: — nunca interpolar ${{ }} en shell con secrets"
  - "assert no estricto para fuentes con degradacion honesta documentada"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03]

# Metrics
duration: 2min
completed: 2026-06-24
---

# Phase 34 Plan 03: Workflows programados lobby + probidad Summary

**Tres workflows de GitHub Actions (martes/miercoles/jueves) que ponen en cadencia semanal los CLIs ETL ya completos: lobby-camara (curl anti-WAF + --html-file), lobby-leylobby (env names divergentes + assert que tolera degradacion) y probidad (SPARQL + R2_* de provenance), validables por workflow_dispatch sin encender LIVE.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-24T00:52:53Z
- **Completed:** 2026-06-24T00:55:06Z
- **Tasks:** 3
- **Files modified:** 3 (creados)

## Accomplishments
- `lobby-camara-weekly.yml`: descarga el crudo de camara.cl via `curl -A 'Bot-Ciudadano/1.0'` a `/tmp/lobby.html`, falla si <10KB (WAF), corre el CLI con `--html-file` y asserta `audiencias=N>0`.
- `lobby-leylobby-weekly.yml`: mapea los env names DIVERGENTES (`SUPABASE_URL`<-`SUPABASE_API_URL`, `SUPABASE_SERVICE_KEY`<-`SUPABASE_SECRET_KEY`) que `ingest-cli.ts` realmente lee, con inputs `institucion`/`anio` por env:, y assert que acepta `audiencias>0` OR `degradaciones>0` (LeylobbyBloqueadaError = exit 0).
- `probidad-weekly.yml`: corre `run-probidad-todos-cli` (SPARQL datos.cplt.cl) con Supabase + los 4 R2_* en env:, sin `sleep` (el HostRateLimiter del conector aplica el rate-limit), y assert `declaraciones>0` OR `confirmados>0`.
- Los 3 con `workflow_dispatch` + cron en dia distinto + `concurrency` group `cancel-in-progress: false` + `permissions: contents: read`.

## Task Commits

Each task was committed atomically:

1. **Task 1: lobby-camara-weekly.yml (INGEST-01)** - `d369f7d` (feat)
2. **Task 2: lobby-leylobby-weekly.yml (INGEST-02)** - `5518f3b` (feat)
3. **Task 3: probidad-weekly.yml (INGEST-03)** - `6cdd7ce` (feat)

## Files Created/Modified
- `.github/workflows/lobby-camara-weekly.yml` - INGEST-01: curl anti-WAF + gate 10240 + `--html-file /tmp/lobby.html` + assert audiencias; cron martes 11:00 UTC.
- `.github/workflows/lobby-leylobby-weekly.yml` - INGEST-02: run directo, env names divergentes mapeados, assert acepta degradacion honesta; cron miercoles 11:00 UTC.
- `.github/workflows/probidad-weekly.yml` - INGEST-03: SPARQL + 4 R2_* en env, assert declaraciones/confirmados; cron jueves 11:00 UTC.

## Decisions Made
- **Cron por dia distinto:** lobby-camara mar / leylobby mie / probidad jue, separados de agenda(lun) y leyes(vie) — evita runs solapados contra las mismas fuentes/DB (espeja sugerencia RESEARCH §Findings 3, Assumption A4: cosmetico, operador ajusta).
- **Mapeo de env names en leylobby:** `ingest-cli.ts` lee `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` (NO los `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY` de Camara/probidad). Sin el mapeo el CLI degrada a dry-run silencioso — se mapean ambos en `env:` (Pitfall 3).
- **Assert no estricto en leylobby:** acepta `audiencias>0` OR `degradaciones>0` porque `LeylobbyBloqueadaError` (403/503) es exit 0 correcto (Pitfall 2).
- **R2_* opcionales en probidad:** se pasan en env: para habilitar la fila `source_snapshot`; sin ellos el bloque R2 queda best-effort/no-op y la carga a Supabase procede igual.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- El verify portable de Task 1 usa `grep -qP "\t"` para detectar tabs; en este entorno (Windows/git-bash) `grep -P` emitio "supports only unibyte and UTF-8 locales". La cadena de verify imprimio `OK` igual; se re-verifico la ausencia de tabs con `grep -q "$(printf '\t')"` -> `NO_TABS` en los 3 archivos. Sin impacto en el contenido del workflow.
- El check ad-hoc `grep -q "sleep"` en probidad dio `HAS_SLEEP`, pero la unica coincidencia es el comentario "NO añadir sleeps en CI" (linea 8); no hay ningun comando `sleep` en ningun `run:`. Confirmado con Grep.

## Security
- **T-34-08 (command injection):** verificado cross-cutting — todas las ocurrencias de `${{ }}` en los 3 .yml son comentarios de cabecera o lineas `KEY: ${{ ... }}` bajo `env:`; NINGUNA dentro de un `run:`. Inputs (`institucion`/`anio`/`limite`) pasan por env: y se leen con `$VAR`.
- **T-34-SC (supply chain):** `pnpm install --frozen-lockfile --ignore-scripts` en los 3; cero paquetes nuevos.
- **T-34-09 (secrets en logs):** solo `echo "$OUT"` (output del CLI); nunca `echo` de un secret.

## User Setup Required
**External services require manual configuration (checkpoint de operador, OUT OF SCOPE de este plan).** Encender LIVE requiere que el operador cargue en el repo destino (Cuchecorp/gov-map) los secrets: `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Los secrets NO se transfieren entre repos (ver MEMORY crons-y-transfer). Validacion final = `workflow_dispatch` dry-run. Ninguna tarea de este plan encendio LIVE ni requirio secrets reales.

## Next Phase Readiness
- Los 3 workflows existen, son YAML valido y estan en cadencia semanal sin solaparse con agenda/leyes ni entre si.
- Listos para validacion por `workflow_dispatch` dry-run (checkpoint de operador).
- INGEST-01..03 cubiertos por estos .yml; INGEST-04 (wire R2/SnapshotWriter en probidad) corresponde a otro plan de la fase.

## Self-Check: PASSED

- FOUND: .github/workflows/lobby-camara-weekly.yml
- FOUND: .github/workflows/lobby-leylobby-weekly.yml
- FOUND: .github/workflows/probidad-weekly.yml
- FOUND: .planning/phases/34-ingest-ingesta-lobby-probidad-programada/34-03-SUMMARY.md
- FOUND commit: d369f7d (Task 1)
- FOUND commit: 5518f3b (Task 2)
- FOUND commit: 6cdd7ce (Task 3)

---
*Phase: 34-ingest-ingesta-lobby-probidad-programada*
*Completed: 2026-06-24*
