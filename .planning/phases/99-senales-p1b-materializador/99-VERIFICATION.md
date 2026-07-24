---
phase: 99-senales-p1b-materializador
verified: 2026-07-24T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirmar que el pg_cron 'actualidad-materializar' realmente dispara en su horario (7 11,14,17,20 * * 1-5) y que el workflow GH Actions 'actualidad-refresh' corre con los secrets SUPABASE_API_URL + SUPABASE_SECRET_KEY cargados"
    expected: "Al menos una corrida programada exitosa de cada writer: el proc re-materializa las 6 señales temporales L-V ×4; el CLI k-means re-escribe agrupacion_materia L-V ×4. Ambos secrets presentes en el repo (reusados de leyes-weekly)."
    why_human: "El disparo en horario del cron y la presencia/validez de los secrets de GH Actions no son verificables por grep ni por inspección estática — requieren observar una ejecución programada real (o el run log de Actions). El apply live-DB, el proc, la RPC, las señales y la supresión YA están verificados en vivo por el orquestador."
---

# Phase 99: Señales P1b — Materializador — Verification Report

**Phase Goal:** Precomputar offline las señales validadas en el SPIKE y servirlas a la landing como filas listas — cero agregación cara on-read en la página más visitada.
**Verified:** 2026-07-24T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `actualidad_senal` = tabla precomputada refrescada por proc full-rebuild (SQL→pg_cron; TS clustering→GH Actions CLI intradía L-V); landing lee vía RPC bounded (LIMIT+statement_timeout+allowlist) | ✓ VERIFIED | 0065 crea la tabla deny-by-default (L50-77: RLS enabled + `revoke all from anon, authenticated`, cero policies, cero grant) + `actualidad.materializar_senales()` full-rebuild (L88-310) + `cron.schedule('actualidad-materializar','7 11,14,17,20 * * 1-5', ...)` (L326-330) con assertion post-migración (L336-342). 0066 crea `actualidad_senales_panel(p_tipo)` security definer, `statement_timeout='5s'`, `limit 200`, doble-revoke (0066 L43-56); registrada en PUBLIC_RPC_ALLOWLIST (lockdown-guard.test.ts:166). GH Actions `actualidad-refresh.yml` corre el CLI k-means intradía L-V (`cron: "0 11,14,17,20 * * 1-5"`, `pnpm --filter @obs/actualidad exec tsx`). LIVE: 0065+0066 aplicadas, RPC devuelve filas filtradas <5s, cron registrado, lockdown-guard 14/14. |
| 2 | Señales validadas mínimas como conteos factuales: velocity ("N trámites en 7 días", nunca top/los más — T-52-13), agenda próxima, urgencias vivas, archivados/retirados; nuevos ingresos solo si el reloj es fiable | ✓ VERIFIED | Proc 0065 emite las 6 señales ancladas a `tramitacion_evento.fecha`/`citacion.fecha` (nunca `fecha_captura`): velocity con framing conteo por cámara normalizada sin order-by-conteo cross-cámara (L127-135); nuevos_ingresos con piso de corpus 2022 (L157-186); urgencias 30d (L195-216); agenda_citacion futuras (L228-251); agenda_sala futuras (L257-274); archivados por descripción excluyendo desarchiv/retira-y-hace-presente (L285-308). LIVE: urgencias 104, velocity C.Diputados 79 / Senado 86 / sin-cámara 5 (normalizado, sin ranking cross-cámara), agenda_citacion 7 futuras, archivados 2. |
| 3 | Toda señal SUPRIMIDA con causa cuando su fuente está stale ("sin datos frescos de esta fuente") — nunca "sin movimiento"; sesgo de cobertura Cámara declarado por señal | ✓ VERIFIED | Supresión-como-fila en cada señal: gate de frescura `v_tram_max >= current_date - c_umbral_stale_dias` con else que inserta `supresion_causa='sin datos frescos de esta fuente'`; velocity/nuevos_ingresos/urgencias/archivados usan `having count(*) > 0` + `if not found` para evitar la fila prohibida `conteo=0 / causa NULL` (WR-01 FIXED, L169-177/L203-210/L295-302). `cobertura_camara` declara el sesgo por fila. LIVE: agenda_sala suprimida ("sin sesiones agendadas..."), nuevos_ingresos suprimida ("sin nuevos ingresos fechados en la ventana"). pgTAP 17/17 incluye las aserciones WR-01 (líneas 151-183: stale→supresión NOT NULL, y NINGUNA fila 0-como-hecho con causa NULL). |
| 4 | Agrupación por tema usa `materia` oficial como label primario (+ k-means seed-fija secundario) — labels JAMÁS por LLM | ✓ VERIFIED | `packages/actualidad/src/kmeans.ts`: Lloyd determinista con mulberry32 seed-fija (`KMEANS_SEED = 0x9e3779b9`), distancia coseno sobre 768d, k en [8,15]; `labelCluster()` = `mode(materia)` factual con desempate alfabético, sin generación de texto (L193-215). `run-actualidad-prod-cli.ts` lee `proyecto_embedding` paginado (.range, cap 1k), corre k-means, y hace delete acotado `.eq("tipo_senal","agrupacion_materia")` + insert una fila por cluster con label mode(materia) — CERO llamada LLM. @obs/actualidad kmeans 7/7 tests deterministas. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0065_actualidad_senal.sql` | tabla + schema actualidad + proc + pg_cron | ✓ VERIFIED | Tabla deny-by-default (RLS + revoke all + cero policies), proc security definer `set search_path=''` con delete ACOTADO a 6 tipos temporales, 3 defectos D1/D2/D3 aplicados, supresión-como-fila, cron registrado + assertion. Aplicado en vivo. |
| `supabase/migrations/0066_actualidad_rpc.sql` | RPC bounded aguja-completa | ✓ VERIFIED | drop-before-create, `language sql stable security definer`, `search_path=''`, `statement_timeout='5s'`, `limit 200`, filtro `p_tipo` paramétrico (sin string-building), doble-revoke, cero grant. Aplicado en vivo. |
| `supabase/tests/0065_actualidad_senal.test.sql` | pgTAP estructural + defectos + supresión | ✓ VERIFIED | `plan(17)`; asserts has_table, RLS, cero policies, prosecdef, no-PII body, cron registrado, anon 42501, D1 (typo 2626 filtrado), D2 (colapso de grafías), D3 (agenda_sala supresión), WR-01 (stale→supresión, no 0-como-hecho). 17/17 verde contra schema aplicado. |
| `packages/actualidad/src/kmeans.ts` | Lloyd determinista + label mode(materia) | ✓ VERIFIED | 215 líneas; mulberry32 seed-fija, coseno, k-means++ init determinista, labelCluster mode(materia) alfabético, sin dependencia externa ni LLM. |
| `packages/actualidad/src/run-actualidad-prod-cli.ts` | CLI service_role writer de agrupacion_materia | ✓ VERIFIED | service_role env-only, loadEnv BOM-safe, lectura paginada .range() cap 1k, delete acotado por tipo_senal, insert una fila por cluster, cero LLM. |
| `packages/actualidad/package.json` | workspace @obs/actualidad | ✓ VERIFIED | `"name": "@obs/actualidad"`; vitest.config propio (evita CI-DARK), tsconfig references. |
| `app/lib/lockdown-guard.test.ts` | entrada actualidad_senales_panel en allowlist | ✓ VERIFIED | `"actualidad_senales_panel"` presente (línea 166, primera alfabéticamente); lockdown-guard 14/14 verde. |
| `.github/workflows/actualidad-refresh.yml` | cron intradía L-V, sin R2 | ✓ VERIFIED | clon de leyes-weekly SIN bloque R2 (cero `R2_`), cron `0 11,14,17,20 * * 1-5`, SHA-pinned actions, `permissions: contents: read`, inputs-by-ENV (K), corre `@obs/actualidad` CLI. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `actualidad.materializar_senales()` | tramitacion_evento / citacion / sesion_sala | insert…select con `fecha <= current_date` + regexp_replace(camara) | ✓ WIRED | D1 en toda agregación; D2 colapsa grafías; D3 `(sin cámara)`. Ancla a evento.fecha, nunca fecha_captura. |
| cron.job | materializar_senales() | cron.schedule intradía L-V | ✓ WIRED | jobname `actualidad-materializar` registrado (assertion post-migración + verificado en vivo). |
| actualidad_senales_panel | actualidad_senal | select … limit 200, statement_timeout 5s | ✓ WIRED | `from public.actualidad_senal s where p_tipo is null or s.tipo_senal = p_tipo`. RPC devuelve filas bounded en vivo. |
| PUBLIC_RPC_ALLOWLIST | actualidad_senales_panel | Set alfabético en lockdown-guard | ✓ WIRED | Presente; guard Direction-B verde. |
| actualidad-refresh.yml | run-actualidad-prod-cli.ts | pnpm --filter @obs/actualidad exec tsx | ✓ WIRED | Step run invoca el CLI con $ARGS de inputs-by-ENV. |
| run-actualidad-prod-cli.ts | proyecto_embedding | .select(boletin, embedding).order().range() paginado | ✓ WIRED | Lectura paginada cap 1k con join a proyecto(materia). |
| run-actualidad-prod-cli.ts | actualidad_senal (agrupacion_materia) | delete acotado + insert por cluster | ✓ WIRED | `.delete().eq("tipo_senal","agrupacion_materia")` disjunto del proc SQL. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| actualidad_senal (via RPC) | filas de señal | proc materializar_senales() sobre tramitacion_evento/citacion/sesion_sala | Sí — LIVE: urgencias 104, velocity 79/86/5, agenda 7, archivados 2 | ✓ FLOWING |
| agrupacion_materia | label materia | proyecto.materia via CLI k-means | Degradación honesta: proyecto.materia NULL en PROD → label '(sin materia)' factual (nunca fabricado); CLI/cron escribe en horario | ⚠️ STATIC (documentado — no es falla de fase) |

**Nota sobre agrupacion_materia:** `proyecto.materia` es NULL en todas las filas PROD (la ingesta nunca la pobló). El label cae a `'(sin materia)'` — un fallback factual, JAMÁS fabricado ni LLM. Esto es degradación honesta y documentada; SEN-05 exige que el label venga de la taxonomía oficial existente y NUNCA de un LLM — el contrato de honestidad se cumple. Poblar `proyecto.materia` es trabajo de ingesta upstream, fuera del alcance de la Fase 99; Phase 100 debe tolerar `'(sin materia)'`.

### Probe Execution

No probe scripts convencionales para esta fase (migración/tooling verificada por pgTAP, no por `scripts/*/tests/probe-*.sh`). La prueba válida es el pgTAP `0065_actualidad_senal.test.sql` corriendo contra el schema APLICADO = 17/17 ok (verificado por el orquestador contra la live-DB).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| pgTAP contra schema aplicado | `psql -tA -f supabase/tests/0065_actualidad_senal.test.sql` | 17/17 ok, 0 not ok (orquestador) | ✓ PASS |
| RPC bounded responde | `select count(*) from actualidad_senales_panel(null)` / `('velocity')` | filas filtradas por tipo, incluye supresion_causa, <5s | ✓ PASS |
| cron registrado | `select jobname from cron.job where jobname='actualidad-materializar'` | 1 fila (7 11,14,17,20 * * 1-5) | ✓ PASS |
| @obs/actualidad determinismo | `pnpm --filter @obs/actualidad test` | 7/7 verde | ✓ PASS |
| lockdown-guard | `pnpm test lockdown-guard` | 14/14 verde | ✓ PASS |
| Full suite + tsc + audit | orquestador | 1252 app + packages verde, tsc limpio, pnpm audit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEN-02 | 99-01, 99-02, 99-04 | Tabla precomputada refrescada offline (SQL→pg_cron; TS→GH Actions L-V); landing lee vía RPC bounded PII-safe allowlisted | ✓ SATISFIED | Truth 1 + artifacts 0065/0066/YAML + allowlist |
| SEN-03 | 99-01 | Supresión con causa cuando fuente stale; sesgo Cámara/Senado declarado por señal | ✓ SATISFIED | Truth 3 + WR-01 fix + pgTAP 17/17 |
| SEN-04 | 99-01 | Señales mínimas factuales (velocity, nuevos ingresos si reloj fiable, urgencias, agenda, archivados) | ✓ SATISFIED | Truth 2 + señales materializadas en vivo |
| SEN-05 | 99-03 | Agrupación por materia oficial + k-means seed-fija secundario; labels JAMÁS LLM | ✓ SATISFIED | Truth 4 + kmeans.ts determinista + label mode(materia) factual (degradación '(sin materia)' documentada) |

No hay requerimientos huérfanos: REQUIREMENTS.md mapea SEN-02..SEN-05 a Phase 99 y los 4 aparecen en los planes.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Sin debt-markers (TBD/FIXME/XXX) en archivos de la fase | ℹ️ Info | Ninguno |
| run-actualidad-prod-cli.ts | 203-208 | `null as string \| null` en payload de insert | ℹ️ Info | No es stub: son columnas legítimamente NULL para agrupacion_materia (ventana/fecha_max/supresion_causa no aplican al clustering); el conteo/materia/cluster_id llevan datos reales. |

Las 5 warnings del code review (WR-01 0-como-hecho, WR-02 mislabel ventana, WR-05 stale-capture falso negativo, WR-03 provenance del umbral, WR-04 order-by label) — las 4 de contrato de honestidad (WR-01/02/03/05) fueron FIXED + re-aplicadas + re-testeadas (17/17); WR-04 es riesgo latente de truncación bajo LIMIT 200 con tabla que hoy es ≪200 filas (info diferido). Verificado en el código actual: WR-01 (having count(*)>0 + if not found suppression), WR-02 (ventana='7d', corpus en cobertura_camara), WR-05 (if exists(future) domina el gate de frescura).

### Human Verification Required

#### 1. Disparo del cron en horario + secrets de GH Actions

**Test:** Confirmar que el pg_cron `actualidad-materializar` dispara en su horario (`7 11,14,17,20 * * 1-5`) y que el workflow `actualidad-refresh` corre en GH Actions con los secrets `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` cargados (reusados de leyes-weekly).
**Expected:** Al menos una corrida programada exitosa de cada writer — el proc re-materializa las 6 señales temporales L-V ×4; el CLI k-means re-escribe la capa `agrupacion_materia` L-V ×4. Ambos secrets presentes y válidos en el repo.
**Why human:** El disparo en horario del cron y la presencia/validez de los secrets de GH Actions no son verificables por grep ni inspección estática — requieren observar una ejecución programada real (o el run log de Actions). El resto de la fase (apply live-DB, proc, RPC, señales, supresión, allowlist) YA está verificado en vivo por el orquestador.

### Gaps Summary

No hay gaps que bloqueen el objetivo. Las 4 verdades observables están VERIFICADAS contra el código y el estado live-DB: la tabla precomputada deny-by-default, el proc full-rebuild con los 3 defectos LOCKED y supresión-como-fila, la RPC bounded allowlisted, y el clustering k-means determinista con label factual. Los 4 warnings de contrato de honestidad del code review fueron corregidos y re-testeados (pgTAP 17/17). La única brecha de datos (`proyecto.materia` NULL → label '(sin materia)') es degradación honesta documentada, no una falla de fase (el contrato prohíbe LLM y fabricación, ambos respetados). El único ítem restante es de verificación de operador: que el cron dispare en horario y que los secrets de GH Actions estén cargados — no verificable estáticamente. Por eso el status es `human_needed`, no `gaps_found`.

---

_Verified: 2026-07-24T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
