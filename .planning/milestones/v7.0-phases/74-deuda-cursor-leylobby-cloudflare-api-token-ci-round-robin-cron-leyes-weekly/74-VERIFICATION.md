---
phase: 74-deuda-cursor-leylobby-cloudflare-api-token-ci-round-robin-cron-leyes-weekly
verified: 2026-07-15T04:00:00Z
status: human_needed
score: 4/4 must-haves verified (code deltas); 3 operator acts pending
overrides_applied: 0
human_verification:
  - test: "Aplicar migración 0053 (leylobby_cursor_estado) a PROD via psql --single-transaction (NUNCA supabase db push)"
    expected: "Tabla creada en remoto con RLS deny-by-default; sin ella leerCursor lanza en la primera corrida LIVE del cron lobby-leylobby-weekly"
    why_human: "Apply a remoto/PROD es acto de operador (autonomous:false); el agente solo validó local en rollback"
  - test: "Aplicar migración 0054 (leyes_rotacion_estado) a PROD via psql --single-transaction (NUNCA supabase db push)"
    expected: "Tabla singleton creada en remoto con RLS deny-by-default; sin ella boletinesARefrescar LANZA (fail-loud) en la próxima corrida real de leyes-weekly"
    why_human: "Apply a remoto/PROD es acto de operador (autonomous:false); el agente solo validó local en rollback"
  - test: "Cargar el VALOR de CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID en Cuchecorp/gov-map Settings→Secrets, verificar billing GH activo, disparar deploy-cloudflare.yml (workflow_dispatch)"
    expected: "Deploy corre VERDE en CI (reproducible, sin fallback wrangler local). Los crons de ingesta corren verdes independientemente (no requieren el token)"
    why_human: "Cargar el secret y observar el run en GH Actions requiere acceso a GH settings y credenciales de operador (autonomous:false)"
  - test: "Observar (sobre ~6-7 semanas) que la señal leyes-min-edad de `pnpm freshness` tiende a la baja a medida que la rotación round-robin cubre el corpus, y que los crons de novedades corren verdes en GH Actions"
    expected: "El proyecto más viejo entra en umbral (45d) tras una vuelta completa de rotación; ningún proyecto queda indefinidamente sin refrescar"
    why_human: "Comportamiento longitudinal en producción; requiere corridas LIVE reales del cron a lo largo de semanas"
---

# Phase 74: DEUDA — Cursor leylobby + `CLOUDFLARE_API_TOKEN` CI + round-robin cron leyes-weekly — Verification Report

**Phase Goal:** Cerrar la deuda de ingesta independiente de P3/P5 — que los crons corran verdes y la frescura no se diluya.
**Verified:** 2026-07-15T04:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Todos los deltas de código (los artefactos que el agente CONTROLA) están VERIFIED con evidencia
en el codebase, tests verdes y validación de migraciones contra Postgres local. Los TRES actos
de operador declarados (autonomous:false) — apply de 0053/0054 a PROD y carga del VALOR del
CF token + deploy verde — permanecen PENDIENTES y son la razón del estado `human_needed`. El
código no puede "encender" estos por sí mismo; el fail-loud garantiza que un apply faltante se
vea (el cron sale != 0), no un no-op verde silencioso.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | El conector leylobby usa cursor incremental — no re-scrapea todo el histórico | ✓ VERIFIED | `cursor-leylobby.ts`: `avanzarCursor` (pagina+1 / anio-1 al agotar, tope anioMin 2015), `deriveTarea` (una página), `cursorInicial`. Wire en `ingest-cli.ts:207-257`: lee cursor antes / avanza después de corrida exitosa; override y dry-run NO tocan el cursor. R2 hash-check (`ingest-run.ts:146` `[skip] sin novedades`) INTACTO (archivo no tocado en fase 74; último commit f1a5f7f=fase 57). Tests: lobby 68 verdes incl. avance/no-avance/degradada/override/dry-run. |
| 2 | `CLOUDFLARE_API_TOKEN` cargado en CI → crons de novedades verdes | ✓ VERIFIED (referencia) / operator (valor) | `grep CLOUDFLARE_API_TOKEN .github/workflows/` = SOLO `deploy-cloudflare.yml` (líneas 10, 59). Job `deploy` lo consume via `env:`. Los 6 crons de ingesta NO lo referencian (solo `SUPABASE_*`+`R2_*`+`DEEPSEEK`) — corren verdes sin él. Nota de operador de 72 líneas documenta la carga del VALOR (acto humano). El VALOR en GH settings = operator (human_needed). |
| 3 | El cron leyes-weekly rota round-robin sobre el corpus 3.657 (lotes acotados) → ningún proyecto indefinidamente sin refrescar; MONEY/SERVEL excluidos | ✓ VERIFIED | `rotacion-leyes.ts`: `leerCorpusPaginado` (.order('boletin').range() loop hasta filas<PAGE=1000) resuelve cap 1k; `seleccionarRotado` (agenda-prioridad + cola rotada wrap-around) + `avanzarOffset` mod. Wire en `run-tramitacion-prod-cli.ts:104-177`: lee offset, selecciona, upserta id=1. Tests: corpus 2500 filas/3 páginas; cobertura round-robin cubre 25/25 en N corridas; MONEY/SERVEL grep `.from(contrato\|aporte\|servel\|chilecompra)` = false; fail-loud `rejects.toThrow`. |
| 4 | `pnpm freshness` refleja la rotación (señal MIN-edad) sin regresionar los conectores MAX v6.0 | ✓ VERIFIED | `catalog.ts`: entrada `leyes-min-edad` (proyecto.fecha_captura, `agregado:"MIN"`, umbral 45, override env). `query-runner.ts:137` `const agregado = cfg.agregado ?? "MAX"` — enum cerrado, sin inyección. NO-REGRESIÓN afirmada por test: `leyes` conserva agregado undefined=MAX/umbral 7; SOLO `leyes-min-edad` usa MIN (`CATALOG.filter(agregado==="MIN")===["leyes-min-edad"]`). MIN>umbral→stale (dilución visible); un solo refresh no la pone verde. Tests: freshness 44 verdes. |

**Score:** 4/4 truths verified at code level. (SC#2/#4 tienen una cola de operador para verse en LIVE.)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/0053_leylobby_cursor_estado.sql` | Tabla marcador cursor, RLS deny-by-default | ✓ VERIFIED | PK `institucion_codigo`, `anio`/`pagina`/`fecha_captura`, `enable row level security`, sin policy/grant anon. Validado local (rollback): RLS=true, 0 policies, anon sin DML. |
| `packages/lobby/src/cursor-leylobby.ts` | Lógica pura de avance | ✓ VERIFIED | 95 líneas, pura (sin red/DB), avanzarCursor/deriveTarea/cursorInicial. WIRED en ingest-cli. |
| `packages/lobby/src/cursor-leylobby.test.ts` | Prueba avance/no-avance | ✓ VERIFIED | Casos de avance, retroceso año, no-avance degradada, piso anioMin, deriveTarea, primera corrida. |
| `supabase/migrations/0054_leyes_rotacion_estado.sql` | Tabla singleton, RLS deny-by-default | ✓ VERIFIED | `id int pk default 1 check(id=1)`, `offset_rotacion check>=0`, RLS sin policy/grant. Validado local: check(id=1) rechaza id=2, check offset rechaza -5, upsert onConflict id ok, RLS=true, 0 policies, anon sin DML. |
| `packages/tramitacion/src/rotacion-leyes.ts` | Selección round-robin pura + paginado | ✓ VERIFIED | 173 líneas, WIRED en run-tramitacion-prod-cli. |
| `packages/tramitacion/src/rotacion-leyes.test.ts` | Rotación + paginación >1k con fake Supabase | ✓ VERIFIED | 2500 filas/3 páginas, wrap-around, cobertura N-corridas, exclusión MONEY/SERVEL, fail-loud. |
| `.../74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md` | Nota de operador | ✓ VERIFIED | 72 líneas; hallazgo rector (CF=deploy no ingesta), evidencia grep, paso operador, aviso anti-mal-interpretación. Sin ningún valor de secret literal. |
| `packages/freshness/src/catalog.ts` | Señal edad-mínima MIN sin tocar MAX | ✓ VERIFIED | contiene `leyes-min-edad` con agregado MIN; entradas MAX v6.0 idénticas. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `ingest-cli.ts` | `leylobby_cursor_estado` | leerCursor antes / avanzarCursor después | ✓ WIRED | `usaCursor = !overrideExplicito && !dryRun`; leerCursor→deriveTarea; tras `res.audiencias>0`→avanzarCursor+persiste. |
| `writer-supabase.ts` | `leylobby_cursor_estado` | upsert leerCursor/avanzarCursor | ✓ WIRED | onConflict institucion_codigo (per SUMMARY 74-01 + test wiring). |
| `run-tramitacion-prod-cli.ts` | `proyecto` (corpus completo) | `.order('boletin').range()` loop | ✓ WIRED | `leerCorpusPaginado(sb, "proyecto")` línea 134. |
| `run-tramitacion-prod-cli.ts` | `leyes_rotacion_estado` | leer offset antes + upsert después | ✓ WIRED | select offset id=1 (maybeSingle) → seleccionarRotado → upsert id=1 onConflict id (líneas 137-169). |
| `query-runner.ts` | `proyecto` (MIN fecha_captura) | `SELECT MIN(...)` | ✓ WIRED | `SELECT ${agregado}(${cfg.columna})` con agregado="MIN" para leyes-min-edad. |
| `evaluate.ts` | señal edad-mínima | evaluación MIN reusa regla stale | ✓ WIRED | evaluate() reusado tal cual (null/días>umbral→stale); test confirma stale en 60d>45. |

### Migration Validation (local Postgres 127.0.0.1:54322, rollback — nada persistido)

| Check | Result |
| ----- | ------ |
| 0053 PK | `institucion_codigo` ✓ |
| 0054 singleton `check(id=1)` | id=2 RECHAZADO ✓ |
| 0054 `check(offset>=0)` | offset=-5 RECHAZADO ✓ |
| 0054 upsert onConflict id | UPSERT_OK=10 ✓ |
| RLS 0053 / 0054 | true / true ✓ |
| Policies (ambas tablas) | 0 (deny-by-default) ✓ |
| anon DML grants (SELECT/INSERT/UPDATE/DELETE) | NONE (sin PII/superficie) ✓ |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Suite lobby (cursor) | `pnpm --filter @obs/lobby test` | 68 passed (9 files) | ✓ PASS |
| Suite tramitacion (rotación/paginado) | `pnpm --filter @obs/tramitacion test` | 168 passed (18 files) | ✓ PASS |
| Suite freshness (MIN/MAX) | `pnpm --filter @obs/freshness test` | 44 passed (1 file) | ✓ PASS |
| Corpus >1000 (cap 1k resuelto) | rotacion-leyes.test.ts | 2500 filas / 3 páginas, toHaveLength(2500) | ✓ PASS |
| Round-robin cubre todo el corpus | rotacion-leyes.test.ts | 25/25 boletines en N corridas | ✓ PASS |
| MONEY/SERVEL excluidos | rotacion-leyes.test.ts grep `.from(...)` | contrato/aporte/servel/chilecompra = false | ✓ PASS |
| fail-loud lectura | rotacion-leyes.test.ts | rejects.toThrow | ✓ PASS |
| MIN revela dilución / no regresiona MAX | evaluate.test.ts | MIN 60d>45→stale; leyes MAX umbral 7 intacto | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DEBT-02 | 74-01 | leylobby cursor incremental (no re-scrape histórico) | ✓ SATISFIED (code) | cursor-leylobby.ts + wire + 0053 + hash-check intacto |
| DEBT-03 | 74-03 | CLOUDFLARE_API_TOKEN cargado en CI → crons verdes | ✓ SATISFIED (referencia) / operator (valor) | referencia correcta solo en deploy-cloudflare.yml; nota de operador; carga del valor = human_needed |
| DEBT-04 | 74-02 | leyes-weekly rota round-robin sobre 3.657 (no diluir frescura) | ✓ SATISFIED (code) | rotacion-leyes.ts + wire + 0054 + señal MIN |

No orphaned requirements: REQUIREMENTS.md mapea DEBT-02/03/04 a Phase 74, todas reclamadas por un plan.

### Anti-Patterns Found

Ninguno. Grep de `TBD|FIXME|XXX|HACK|PLACEHOLDER` en los 8 archivos modificados de la fase = 0.
Sin retornos vacíos que fluyan a UI (los CLIs son server-side; el fail-loud LANZA en vez de
devolver [] silencioso). Los 7 commits declarados existen en git.

### Human Verification Required

Ver frontmatter `human_verification`. Resumen:
1. **Apply 0053 a PROD** (operator, psql --single-transaction) — sin él el cron lobby-leylobby lanza en la 1a corrida.
2. **Apply 0054 a PROD** (operator, psql --single-transaction) — sin él boletinesARefrescar LANZA (fail-loud correcto).
3. **Cargar VALOR CF token + CLOUDFLARE_ACCOUNT_ID en Cuchecorp/gov-map + deploy verde** (operator checkpoint, plan 74-03).
4. **Observación longitudinal** (semanas): señal leyes-min-edad baja al rotar; crons de novedades verdes en GH Actions.

### Gaps Summary

No hay gaps de código: los cuatro Success Criteria están verificados en el codebase con tests
verdes y validación de migraciones contra Postgres local (RLS deny-by-default, sin PII, singleton
correcto). El fail-loud está preservado en ambos CLIs, el hash-check R2 intacto (sin re-scrape),
la exclusión MONEY/SERVEL probada, y la señal MIN de frescura es aditiva (MAX v6.0 sin regresión).

El estado es `human_needed` — NO `passed` — porque tres actos de operador (autonomous:false)
quedan pendientes por diseño: apply de las migraciones 0053/0054 a PROD y la carga del VALOR del
CF token + deploy verde. Estos no son fallos de implementación; son el límite entre lo que el
agente controla (código + validación local) y lo que requiere credenciales/acceso de operador.
El código está construido para que la ausencia de un apply se vea (fail-loud, cron sale != 0),
no para degradar a un verde silencioso.

---

_Verified: 2026-07-15T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
