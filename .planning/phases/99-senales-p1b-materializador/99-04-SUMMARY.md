---
phase: 99-senales-p1b-materializador
plan: 04
subsystem: ci-cron
tags: [github-actions, pg_cron, kmeans, actualidad_senal, apply-checkpoint, psql, pgtap, no-r2]

# Dependency graph
requires:
  - phase: 99-01
    provides: "migración 0065 (tabla actualidad_senal deny-by-default + proc materializar_senales + pg_cron) + pgTAP 0065 plan(12)"
  - phase: 99-02
    provides: "migración 0066 (RPC bounded actualidad_senales_panel) + allowlist entry"
  - phase: 99-03
    provides: "@obs/actualidad + run-actualidad-prod-cli.ts (writer service_role de agrupacion_materia, flags --dry-run/--k)"
  - phase: 74-02 (leyes-weekly.yml)
    provides: "molde de cron GH Actions: scaffold seguro (SHA-pinned checkout, ignore-scripts, inputs-by-ENV anti-inyección)"
provides:
  - "cron GH Actions actualidad-refresh.yml (intradía L-V, corre el CLI k-means, SIN R2)"
  - "runbook ready-to-run del apply 0065/0066 a PROD + pgTAP (delegado al orquestador)"
affects: [phase-100-panel-landing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cron de clustering SIN R2: clona el scaffold seguro de leyes-weekly pero BORRA el bloque R2 (Etapa 1 crudo) porque Phase 99 no toca fuentes — lee embeddings de la propia DB, escribe actualidad_senal. Sin rate-limit, sin robots.txt."
    - "dos writers en cadencia paralela (pg_cron actualidad-materializar + GH Actions actualidad-refresh) escriben conjuntos DISJUNTOS de tipo_senal → sin race (delete acotado por tipo)"
    - "apply live-DB ADITIVO delegado al orquestador (tiene .env DB access): el agente prepara el bloque exacto psql --single-transaction + pgTAP, NO toca PROD, NO bloquea en checkpoint humano"

key-files:
  created:
    - ".github/workflows/actualidad-refresh.yml"
  modified: []

key-decisions:
  - "El input workflow_dispatch se renombró de leyes-weekly (limite/boletines) a `k` (nº de clusters), el único flag operacional del CLI k-means. El patrón inputs-by-ENV se preserva VERBATIM (K por ENV, nunca interpolado en el shell del step que carga el secret)."
  - "run step NO pasa --dry-run → el cron ESCRIBE a PROD (LIVE por default en el CLI de 99-03). El --dry-run es solo para validación local."
  - "cron '0 11,14,17,20 * * 1-5' (offset :00) vs pg_cron '7 11,14,17,20 * * 1-5' (offset :07 de 0065): las 4 ventanas hábiles coinciden en hora pero los dos writers son disjuntos por tipo_senal → el offset :07 del pg_cron es holgura, no exclusión mutua obligatoria."
  - "Task 2 (apply live-DB) DELEGADO al orquestador: es aditivo (tabla+proc+RPC+cron nuevos), NO flipea flag de régimen, NO resucita anon key → fuera de la lista de gates prohibidos. El agente NO aplicó a PROD ni bloqueó en human-verify; entregó el bloque de comandos ready-to-run."

patterns-established:
  - "Cron-de-derivado-interno (sin fuentes): cuando el trabajo recurrente sólo lee/escribe la propia DB (no scraping), el YAML clona el scaffold seguro pero DROPEA R2/rate-limit/robots — reusando sólo los secrets Supabase."

requirements-completed: [SEN-02, SEN-05]

# Metrics
duration: 6min
completed: 2026-07-24
---

# Phase 99 Plan 04: actualidad-refresh cron + apply checkpoint Summary

**Cron GH Actions `actualidad-refresh.yml` (clon del scaffold seguro de `leyes-weekly` SIN el bloque R2 — Phase 99 no toca fuentes, sin rate-limit/robots.txt — intradía L-V que corre el CLI k-means `@obs/actualidad`), y el bloque ready-to-run del apply live-DB ADITIVO de 0065/0066 + pgTAP, DELEGADO al orquestador (que tiene .env DB access): el agente NO tocó PROD ni bloqueó en checkpoint humano.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-07-24
- **Tasks:** 2 (Task 1 autónomo; Task 2 apply delegado al orquestador)
- **Files modified:** 1 (creado)

## Accomplishments

- **`actualidad-refresh.yml`** — clon del scaffold seguro de `leyes-weekly.yml`:
  - **Scaffold preservado:** `actions/checkout@…v4.3.1` SHA-pinned, `pnpm/action-setup@…v4.4.0`, `actions/setup-node@…v4.4.0` node 22 + cache pnpm, `pnpm install --frozen-lockfile --ignore-scripts` (gate pnpm 11), `permissions: contents: read`, `concurrency` con `cancel-in-progress: false`, `workflow_dispatch` con input por ENV (anti-inyección).
  - **Delta 1 — nombre + concurrency:** `name: actualidad-refresh`, `concurrency.group: actualidad-refresh`.
  - **Delta 2 — cron intradía L-V:** `"0 11,14,17,20 * * 1-5"` (4 corridas hábiles/día).
  - **Delta 3 — bloque R2 BORRADO:** las 4 líneas `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT_URL`/`R2_BUCKET` eliminadas. El env block deja SOLO `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`. Phase 99 no toca fuentes gubernamentales → sin R2 (Etapa 1 crudo), sin rate-limit, sin robots.txt.
  - **Delta 4 — run step:** `pnpm --filter @obs/actualidad exec tsx src/run-actualidad-prod-cli.ts $ARGS`. El input `k` (nº de clusters) fluye por ENV (`K: ${{ github.event.inputs.k }}`) y se convierte a `--k $K` sólo si está presente — mismo patrón inputs-by-ENV que evita inyección de shell en el step que lleva `SUPABASE_SECRET_KEY`.
  - **NO pasa `--dry-run`** → el cron ESCRIBE la capa `agrupacion_materia` a PROD (LIVE por default en el CLI de 99-03).
- **Verify block del plan PASA:** `test -f` ✓, `grep actualidad-refresh` ✓, `grep @obs/actualidad` ✓, `grep 1-5` ✓, `! grep -i R2_` ✓ (cero env R2).

## Task Commits

1. **Task 1: actualidad-refresh.yml (clon leyes-weekly sin R2)** — `8eb9dd1` (feat)
2. **Task 2: apply live-DB 0065/0066 + pgTAP** — DELEGADO al orquestador (ver bloque ready-to-run abajo). El agente NO tocó PROD.

## Task 2 — Apply live-DB ADITIVO (DELEGADO al orquestador)

**Naturaleza del write (por qué NO es un gate humano):** el apply crea objetos NUEVOS (tabla `actualidad_senal`, schema `actualidad`, proc `materializar_senales()`, RPC `actualidad_senales_panel`, cron `actualidad-materializar`). NO flipea ningún flag de régimen (MONEY/NET/CRUCES intactos), NO resucita ninguna anon key (doble-revoke, cero grant), NO ensancha la superficie anon/authenticated. Es aditivo puro → fuera de la lista de gates prohibidos. El orquestador (con acceso a `.env` → `$SUPABASE_DB_URL`) lo ejecuta. El agente NO aplicó a PROD ni bloqueó en `checkpoint:human-verify`.

**Disciplina de apply (LOCKED, precedente 0055-0064):** SOLO `psql --single-transaction`, NUNCA `supabase db push` (drift `schema_migrations`). Orden LOCKED: 0065 PRIMERO (crea la tabla), luego 0066 (la RPC lee la tabla). `PGCLIENTENCODING=UTF8` (el BOM del `.env` rompe el CLI). NUNCA imprimir la URL.

### Bloque ready-to-run (orquestador)

```bash
# 1) Aplicar 0065 (schema actualidad + tabla + proc + pg_cron) — PRIMERO.
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
  -f supabase/migrations/0065_actualidad_senal.sql

# 2) Aplicar 0066 (RPC bounded + doble-revoke) — DESPUÉS de 0065.
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction \
  -f supabase/migrations/0066_actualidad_rpc.sql

# 3) pgTAP contra el schema APLICADO — plan(12): esperar 12 ok / 0 not ok.
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -f supabase/tests/0065_actualidad_senal.test.sql

# 4) Verificar el cron registrado (esperar 1 fila).
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select jobname from cron.job where jobname='actualidad-materializar';"

# 5) Correr el proc y ver conteos por tipo_senal (materialización real de las 6 señales temporales).
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select actualidad.materializar_senales();"
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select tipo_senal, cobertura_camara, conteo, supresion_causa
        from public.actualidad_senal
       order by tipo_senal, cobertura_camara nulls last;"

# 6) Probar la RPC bounded (< 5s, <= 200 filas).
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select count(*) from public.actualidad_senales_panel(null);"
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA \
  -c "select count(*) from public.actualidad_senales_panel('velocity');"

# 7) (Opcional) poblar la capa agrupacion_materia LIVE — o dejar que el cron GH Actions lo haga.
#    pnpm --filter @obs/actualidad exec tsx src/run-actualidad-prod-cli.ts
#    (requiere SUPABASE_API_URL + SUPABASE_SECRET_KEY en env; escribe tipo_senal='agrupacion_materia').
```

**Resultado esperado a reportar por el orquestador:** pgTAP 12/12 ok (0 not ok); cron `actualidad-materializar` registrado (1 fila); conteos por `tipo_senal` tras la primera corrida del proc (velocity por cámara, nuevos_ingresos, urgencias, agenda_citacion, agenda_sala — con supresión-como-fila donde no haya futuras, archivados); RPC `actualidad_senales_panel(null)` responde bounded; ningún flag de régimen flipeado.

**Nota de dato (heredada de 99-03, NO bug):** `proyecto.materia` es NULL en las 3.659 filas de PROD → la capa `agrupacion_materia` (paso 7) etiquetará honestamente `'(sin materia)'` hasta que el conector de ingesta pueble la columna. Los clusters agrupan por cercanía semántica (correcto); sólo el label degrada.

## Files Created/Modified

- `.github/workflows/actualidad-refresh.yml` (creado) — cron intradía L-V del CLI k-means, clon del scaffold seguro de `leyes-weekly` SIN el bloque R2; solo secrets Supabase.

## Decisions Made

- **Input renombrado a `k`:** el CLI de 99-03 sólo acepta `--dry-run` y `--k N`. `--dry-run` NO se expone en el cron (el cron debe escribir). Se expone `k` (nº de clusters) como único input operacional, por ENV, para preservar el patrón anti-inyección. Los inputs `limite`/`boletines` de leyes-weekly no aplican (no hay corpus de boletines a rotar aquí).
- **cron LIVE (sin --dry-run):** el CLI escribe por default; el cron omite `--dry-run` deliberadamente para que las corridas hábiles refresquen la capa `agrupacion_materia` en PROD.
- **R2 borrado, no comentado:** el bloque R2 se ELIMINA (no se deja comentado) porque Phase 99 estructuralmente no tiene Etapa 1 de crudo — un R2 comentado invitaría a re-habilitarlo por error. Sólo un comentario explica por qué no hay R2.
- **Task 2 delegado, no bloqueado:** por directiva del orquestador, el apply aditivo (sin flip de régimen, sin anon key) sale de la lista de gates prohibidos. En vez de emitir `checkpoint:human-verify` y detenerme, preparé el bloque ready-to-run y marqué Task 2 como delegado. El agente NO tocó PROD.

## Deviations from Plan

- **[Directiva del orquestador] Task 2 re-clasificado de `checkpoint:human-verify` (blocking) a "apply delegado al orquestador".** El plan lo escribió como checkpoint operador (`autonomous:false`), pero el orquestador confirmó que el apply es aditivo puro (tabla+proc+RPC+cron nuevos), no flipea flag de régimen ni resucita anon key → fuera de la lista forbidden-gate, y que el orquestador tiene el acceso `.env` DB para aplicarlo. Acción: NO intenté el apply a PROD, NO emití un human-block; en su lugar escribí el bloque de comandos exacto (apply 0065→0066 + pgTAP + verificaciones) para que el orquestador lo corra tras mi retorno. Esto satisface el `<done>` del plan (runbook + comandos listos) sin write del agente.

## Threat Model Compliance

- **T-99-14 (Tampering, apply por db push / drift) — mitigate:** el bloque ready-to-run usa SOLO `psql --single-transaction`; el comentario y el header de ambas migraciones prohíben `db push`. Precedente 0055-0064.
- **T-99-15 (EoP, migración ensancha lockdown) — mitigate:** 0065/0066 son aditivas cero-grant (deny-by-default + doble-revoke); NO flipean flag de régimen; no ensanchan superficie anon/authenticated. Confirmado en 99-01/99-02.
- **T-99-16 (Info Disclosure, secrets en GH Actions) — accept:** `actualidad-refresh.yml` reusa SOLO `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` (ya cargados por leyes-weekly), sin secret nuevo, sin R2. Input `k` por ENV evita inyección.
- **T-99-SC (Tampering, npm/pnpm installs) — mitigate:** cero paquete net-new; `pnpm install --frozen-lockfile --ignore-scripts`. Sin tabla de legitimidad porque no hay install nuevo (99-RESEARCH: N/A).

## Known Stubs

Ninguno en el YAML. La capa `agrupacion_materia` mostrará `materia='(sin materia)'` hasta que se pueble `proyecto.materia` (deuda de ingesta heredada de 99-03, documentada, NO bug — el label es honesto).

## User Setup Required

Ninguno net-new en este plan. El cron `actualidad-refresh.yml` reusa los secrets `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` ya presentes en el repo (usados por `leyes-weekly`). **El apply live-DB de 0065/0066 lo ejecuta el orquestador** con el bloque ready-to-run de arriba (acceso `.env` → `$SUPABASE_DB_URL`); no es un acto de operador humano nuevo.

## Next Phase Readiness

- **Phase 100 (panel landing):** tras el apply del orquestador, la superficie está viva en PROD — la landing consume `actualidad_senales_panel(p_tipo)` con service_role (Camino A). El pg_cron `actualidad-materializar` refresca las 6 señales temporales (L-V ×4) y el GH Actions `actualidad-refresh` refresca la capa `agrupacion_materia` (L-V ×4). El panel debe tolerar `materia='(sin materia)'` hasta poblar la columna.

## Self-Check: PASSED

- FOUND: .github/workflows/actualidad-refresh.yml
- FOUND: supabase/migrations/0065_actualidad_senal.sql (target del bloque apply)
- FOUND: supabase/migrations/0066_actualidad_rpc.sql (target del bloque apply)
- FOUND: supabase/tests/0065_actualidad_senal.test.sql (plan(12), target del pgTAP)
- FOUND commit 8eb9dd1 (feat, Task 1)
- Task 2: apply delegado al orquestador (sin write del agente por diseño) — runbook escrito

---
*Phase: 99-senales-p1b-materializador*
*Completed: 2026-07-24*
