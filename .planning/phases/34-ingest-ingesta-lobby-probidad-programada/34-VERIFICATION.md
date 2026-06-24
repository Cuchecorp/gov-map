---
phase: 34-ingest-ingesta-lobby-probidad-programada
verified: 2026-06-24T01:15:00Z
status: human_needed
score: 5/5 in-scope must-haves verified (build + dry-run); LIVE-write clauses of SC1/SC3 routed to human checkpoint (OUT OF SCOPE per phase goal)
overrides_applied: 0
human_verification:
  - test: "Disparar workflow_dispatch de lobby-camara-weekly en el repo destino (Cuchecorp/gov-map) con los secrets cargados"
    expected: "Loguea audiencias=N>0 y escribe lobby_audiencia con estado_vinculo='confirmado' para los matches deterministas (INGEST-01 / SC1 — cláusula LIVE)"
    why_human: "Requiere secrets de operador (SUPABASE_*, R2_*) que NO se transfieren entre repos; el encendido LIVE es checkpoint humano declarado OUT OF SCOPE por el goal de la fase. Verificable solo corriendo el workflow contra PROD."
  - test: "Disparar workflow_dispatch de lobby-leylobby-weekly"
    expected: "Loguea audiencias=N>0 o degrada honesto con LeylobbyBloqueadaError (exit 0) (INGEST-02 / SC2 — cláusula LIVE)"
    why_human: "Requiere secrets de operador + respuesta real de leylobby.gob.cl. La degradación honesta (403/503) solo se observa contra la fuente viva."
  - test: "Disparar workflow_dispatch de probidad-weekly y verificar source_snapshot tras el run"
    expected: "Corre ~155-200 queries SPARQL, loguea declaraciones/confirmados>0, escribe filas declaracion con parlamentario_id no nulo, y source_snapshot tiene UNA fila por run con r2_path poblado (INGEST-03/04 / SC3+SC4 — cláusula LIVE)"
    why_human: "Requiere secrets Supabase + R2 reales; la fila source_snapshot con r2_path solo se materializa en un run LIVE (el dry-run no toca R2/DB por diseño). Checkpoint de operador OUT OF SCOPE."
---

# Phase 34: INGEST — Ingesta lobby + probidad programada — Verification Report

**Phase Goal:** Programar (GitHub Actions) los 3 conectores ETL ya completos (lobby Cámara, LeyLobby, probidad) + cerrar la provenance run-level vía source_snapshot/SnapshotWriter (gap real = SnapshotStore Node-side nuevo). AUTÓNOMO para construir + dry-run; el encendido LIVE es checkpoint humano FUERA DE ALCANCE.
**Verified:** 2026-06-24T01:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The autonomous scope of the phase (build the 3 workflows + close the source_snapshot provenance gap via a Node-side SnapshotStore, all dry-run/test-verifiable without operator secrets) is **fully achieved and verified against the codebase**. Every success criterion's build/dry-run portion is VERIFIED. The LIVE-write clauses embedded in SC1/SC3/SC4 (writing `lobby_audiencia`/`declaracion` rows and the populated `source_snapshot` row to PROD) are explicitly an operator-secrets human checkpoint declared OUT OF SCOPE by the phase goal — they are NOT gaps; they are routed to human verification.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Los 3 workflows existen, son YAML válido (name/jobs, sin tabs), tienen workflow_dispatch + cron en días distintos, concurrency + permissions contents:read | ✓ VERIFIED | `.github/workflows/{lobby-camara,lobby-leylobby,probidad}-weekly.yml`; `yaml.safe_load` OK los 3; no tabs; cron mar/mié/jue (distintos de agenda lun/leyes vie); cada uno con `permissions: contents: read` + `concurrency` group |
| 2 | Ningún `${{ }}` interpolado dentro de un `run:` (solo en `env:`) | ✓ VERIFIED | Parser AST-ish sobre los 3 .yml: CLEAN. Todos los `${{ secrets.* }}` / `${{ github.event.inputs.* }}` viven bajo `env:`; inputs leídos con `$VAR` en el shell (T-34-08 mitigado) |
| 3 | lobby-camara: curl -A 'Bot-Ciudadano/1.0' a /tmp/lobby.html, gate <10KB (10240), CLI con --html-file, assert audiencias>0 | ✓ VERIFIED | lobby-camara-weekly.yml L50-54 (curl+stat+gate), L65 (`--html-file /tmp/lobby.html`), L67 (`grep -qE 'audiencias=[1-9][0-9]*'`) |
| 4 | lobby-leylobby mapea env names divergentes SUPABASE_URL/SUPABASE_SERVICE_KEY y assert acepta degradación honesta | ✓ VERIFIED | leylobby.yml L60-61 (`SUPABASE_URL: ${{ secrets.SUPABASE_API_URL }}`, `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}`), L73 (`audiencias.. OR degradaciones..`). Confirmado load-bearing: ingest-cli.ts L110/L113 lee `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` |
| 5 | probidad-weekly corre run-probidad-todos-cli con los 4 R2_* + Supabase en env, assert declaraciones/confirmados>0, sin sleep | ✓ VERIFIED | probidad.yml L53-60 (Supabase + 4 R2_* en env:), L67 (CLI), L69 (assert), sin comando `sleep` (solo el comentario "NO añadir sleeps") |
| 6 | SupabaseSnapshotStore implementa SnapshotStore hablando con source_snapshot vía supabase-js, exportado desde @obs/ingest | ✓ VERIFIED | snapshot-store-supabase.ts L72 `implements SnapshotStore`, L106 `.from("source_snapshot").insert(row).select("id").single()`; index.ts L42 re-export |
| 7 | 23505 idempotente devuelve id de fila existente; sin fila → Error RETRYABLE (nunca undefined/TypeError) | ✓ VERIFIED | L111-126: SELECT por (source,resource,date_bucket).maybeSingle() → return id; sin fila → throw RETRYABLE nombrando los 3 campos. Test `src/snapshot-store-supabase.test.ts` 4/4 verde |
| 8 | @obs/ingest NO añade @supabase/supabase-js como dep (factory inyectable); service key nunca en mensajes de error | ✓ VERIFIED | package.json deps = {@obs/core, aws4fetch, robots-parser} — sin supabase-js; cliente inyectable (client?/createClient?); grep serviceKey solo en constructor/factory, nunca en throw |
| 9 | run-probidad-todos: bloque R2 Etapa-1 best-effort (try/catch no fatal) + SnapshotWriter.write con 8 columnas NOT NULL, tras marcarIngestado | ✓ VERIFIED | run-probidad-todos.ts L139-173: try/catch que fija r2Path=null y NO re-lanza; putImmutable + write({source,resource,cacheKey,r2Path,contentHash,fingerprint,dateBucket,provenance}); corre tras `marcarIngestado` (L137) |
| 10 | CLI wira R2Store/SnapshotWriter(SupabaseSnapshotStore) desde env con doble candado !dryRun; dry-run no toca R2/DB ni lanza | ✓ VERIFIED | cli.ts L117 (`!dryRun && R2_*`), L128-137 (`!dryRun && SUPABASE_*` → SnapshotWriter(SupabaseSnapshotStore)). Spot-check dry-run: `r2Path=none`, in-memory, exit 0 |
| 11 | pnpm test (root) verde — SC5 | ✓ VERIFIED | root `pnpm test` exit 0; @obs/ingest 63/63, @obs/probidad 46/46, tramitacion 104/104, fichas 66/66, votos 3/3, etc. Cero fallos en la suite completa |
| 12 | CERO migración/DDL nueva; CERO encendido LIVE; CERO toque a MONEY_PUBLIC_ENABLED | ✓ VERIFIED | `git diff 36320bc..HEAD --name-only`: solo 9 archivos (3 workflows + 6 fuente/test); 0 en supabase/migrations/; 0 referencias a MONEY_PUBLIC_ENABLED en los archivos de la fase |

**Score:** 5/5 in-scope must-haves verified (todas las verdades autónomas VERIFIED). Las cláusulas LIVE-write de SC1/SC3/SC4 → human checkpoint (OUT OF SCOPE).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/lobby-camara-weekly.yml` | curl anti-WAF + --html-file + assert audiencias | ✓ VERIFIED | YAML válido, Bot-Ciudadano, 10240, --html-file, workflow_dispatch+cron mar |
| `.github/workflows/lobby-leylobby-weekly.yml` | env names mapeados + assert acepta degradación | ✓ VERIFIED | SUPABASE_URL<-API_URL, degradaciones=, ingest-cli, cron mié |
| `.github/workflows/probidad-weekly.yml` | SPARQL + R2_* + assert declaraciones/confirmados | ✓ VERIFIED | run-probidad-todos-cli, 4 R2_*, declaraciones=, cron jue |
| `packages/ingest/src/snapshot-store-supabase.ts` | SnapshotStore Node-side, 23505 idempotente | ✓ VERIFIED | 131 líneas, implements SnapshotStore, factory inyectable |
| `packages/ingest/src/snapshot-store-supabase.test.ts` | 4 casos (insert/23505-recupera/RETRYABLE/error) | ✓ VERIFIED | 4/4 verde |
| `packages/ingest/src/index.ts` | re-export SupabaseSnapshotStore | ✓ VERIFIED | L42 export |
| `packages/probidad/src/run-probidad-todos.ts` | bloque R2 + SnapshotWriter.write | ✓ VERIFIED | L139-173 best-effort |
| `packages/probidad/src/run-probidad-todos.test.ts` | r2Store throw→r2Path null; write con r2_path | ✓ VERIFIED | parte de los 46/46 verde |
| `packages/probidad/src/run-probidad-todos-cli.ts` | wire R2Store+SnapshotWriter desde env | ✓ VERIFIED | L116-137 doble candado !dryRun |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| lobby-camara-weekly.yml | run-camara-lobby-cli.ts | `tsx ... --html-file` | ✓ WIRED | L65 |
| lobby-leylobby-weekly.yml | ingest-cli.ts | `tsx src/ingest-cli.ts` + env mapeo | ✓ WIRED | L60-61,L70; CLI lee esos env names (ingest-cli.ts L110/L113) |
| probidad-weekly.yml | run-probidad-todos-cli.ts | `tsx src/run-probidad-todos-cli.ts` | ✓ WIRED | L67 |
| snapshot-store-supabase.ts | source_snapshot | `.from('source_snapshot').insert().select('id').single()` | ✓ WIRED | L106 |
| index.ts | snapshot-store-supabase.ts | export | ✓ WIRED | L42 |
| run-probidad-todos.ts | SnapshotWriter.write → source_snapshot | `snapshotWriter.write({...8 cols})` | ✓ WIRED | L157-166 |
| run-probidad-todos-cli.ts | SupabaseSnapshotStore (@obs/ingest) | `new SnapshotWriter(new SupabaseSnapshotStore(...))` | ✓ WIRED | L130-136 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| probidad CLI dry-run no toca R2/DB, imprime r2Path=none | `pnpm exec tsx packages/probidad/src/run-probidad-todos-cli.ts --dry-run --limit 1` | `DRY-RUN (in-memory, no escribe DB)` + `r2Path=none`, exit 0 | ✓ PASS |
| @obs/ingest suite (incl. 4 snapshot-store) | `pnpm --filter @obs/ingest test` | 63 passed | ✓ PASS |
| @obs/probidad suite (incl. R2/best-effort) | `pnpm --filter @obs/probidad test` | 46 passed | ✓ PASS |
| Root full suite (SC5 gate) | `pnpm test` | exit 0, cero fallos | ✓ PASS |
| 3 workflows YAML válido | `yaml.safe_load` x3 | YAML OK x3 | ✓ PASS |
| Sin `${{ }}` en run: | parser AST sobre los 3 .yml | CLEAN x3 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INGEST-01 | 34-03 | lobby-camara-weekly: curl+--html-file+assert audiencias; escribe lobby_audiencia confirmado | ◑ SATISFIED (build/dry-run) · NEEDS HUMAN (LIVE write) | Workflow construido y válido; la escritura confirmada a PROD es checkpoint operador |
| INGEST-02 | 34-03 | lobby-leylobby-weekly: env names + assert degradación | ◑ SATISFIED (build) · NEEDS HUMAN (LIVE) | Workflow construido; degradación honesta solo observable LIVE |
| INGEST-03 | 34-03 | probidad-weekly: SPARQL + assert declaraciones; escribe declaracion con parlamentario_id | ◑ SATISFIED (build) · NEEDS HUMAN (LIVE write) | Workflow construido; escritura a PROD = operador |
| INGEST-04 | 34-01, 34-02 | source_snapshot run-level vía SnapshotWriter (no crudo_r2_key paralelo); paso R2 en run-probidad-todos.ts | ✓ SATISFIED (code) · NEEDS HUMAN (fila LIVE) | SupabaseSnapshotStore + bloque R2 best-effort + wire CLI todos verificados en código y test; la fila poblada con r2_path solo se materializa en run LIVE |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (ninguno) | — | — | — | Sin debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER) reales. Los matches de "TODO" son substring de "todos"/"TODOS" (español, parte del nombre del CLI run-probidad-todos), no markers de deuda. |

### Human Verification Required

Las tres verificaciones LIVE son el checkpoint de operador EXPLÍCITAMENTE declarado OUT OF SCOPE por el goal de la fase ("el encendido LIVE (secrets de operador) es checkpoint humano FUERA DE ALCANCE — NO penalizar"). NO son gaps. Se enumeran porque las cláusulas de escritura a PROD en SC1/SC3/SC4 solo son observables corriendo los workflows contra la fuente y la DB reales con secrets cargados.

1. **lobby-camara-weekly LIVE** — Disparar workflow_dispatch con secrets cargados.
   - Expected: audiencias=N>0 logueado + lobby_audiencia con estado_vinculo='confirmado' para matches deterministas.
2. **lobby-leylobby-weekly LIVE** — Disparar workflow_dispatch.
   - Expected: audiencias=N>0 o degradación honesta LeylobbyBloqueadaError (exit 0).
3. **probidad-weekly LIVE + source_snapshot** — Disparar workflow_dispatch y consultar source_snapshot.
   - Expected: declaraciones/confirmados>0 + filas declaracion con parlamentario_id no nulo + UNA fila source_snapshot por run con r2_path poblado.

### Gaps Summary

No hay gaps bloqueantes. Toda la superficie autónoma de la fase está verificada contra el codebase real (no solo contra el SUMMARY):

- Los 3 workflows existen, parsean como YAML, no tienen tabs, no interpolan `${{ }}` dentro de ningún `run:`, tienen workflow_dispatch + cron en días distintos + concurrency + permissions contents:read, y cada uno aplica la divergencia documentada por fuente (curl anti-WAF, mapeo de env names divergentes, R2_* en env).
- El gap de API real (SnapshotStore Node-side) está cerrado: SupabaseSnapshotStore implementa el contrato, maneja 23505 idempotente, no exporta la service key en errores, no añade @supabase/supabase-js como dependencia de @obs/ingest, y está re-exportado desde el barrel.
- run-probidad-todos.ts persiste el crudo agregado por run y escribe la fila source_snapshot con las 8 columnas NOT NULL, ambos best-effort tras la carga a Supabase; el CLI los wira solo en LIVE (doble candado !dryRun) y el dry-run corre in-memory sin tocar R2/DB (spot-check confirmado).
- pnpm test root verde (exit 0); 63/63 ingest, 46/46 probidad, suite completa sin fallos.
- Cero migración/DDL nueva; cero toque a MONEY_PUBLIC_ENABLED; solo 9 archivos modificados, todos los esperados.

El único motivo por el que el status es `human_needed` y no `passed` es que las cláusulas de escritura LIVE a PROD de SC1/SC3/SC4 requieren el encendido con secrets de operador — un checkpoint humano que el propio goal declara fuera de alcance. Esto NO penaliza la fase: la entrega autónoma está completa.

---
*Verified: 2026-06-24T01:15:00Z*
*Verifier: Claude (gsd-verifier)*
