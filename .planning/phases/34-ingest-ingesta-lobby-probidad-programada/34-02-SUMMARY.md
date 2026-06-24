---
phase: 34-ingest-ingesta-lobby-probidad-programada
plan: 02
subsystem: probidad
tags: [r2, source_snapshot, snapshot-writer, etapa-1, provenance, ingest, probidad]

# Dependency graph
requires:
  - phase: 34-ingest-ingesta-lobby-probidad-programada
    plan: 01
    provides: "SupabaseSnapshotStore (@obs/ingest) con createClient inyectable"
  - phase: 01-foundation
    provides: "R2Store.putImmutable + SnapshotWriter + sha256Hex (@obs/ingest); makeProvenance (@obs/core)"
provides:
  - "run-probidad-todos: paso Etapa-1 R2 (crudo agregado por run) + fila source_snapshot run-level vía SnapshotWriter, best-effort"
  - "run-probidad-todos-cli: ensamblaje de R2Store + SnapshotWriter(SupabaseSnapshotStore) desde env, solo en LIVE"
affects: [probidad-weekly, INGEST-04]

# Tech tracking
tech-stack:
  added: []  # cero dependencias nuevas (T-34-SC); R2Store/SnapshotWriter/sha256Hex ya en @obs/ingest, makeProvenance en @obs/core, createClient ya en @obs/probidad
  patterns:
    - "Etapa-1 R2 best-effort por run: acumular crudos en el loop → un putImmutable + un SnapshotWriter.write tras la carga a Supabase; un throw deja r2Path null y NO aborta"
    - "Provenance run-level: una fila source_snapshot por corrida (no por query) con source_url = endpoint SPARQL representativo"
    - "Adapter de createClient (cast a la factory estructural CreateSupabaseClient) para evitar el TS2589 del builder genérico-profundo de supabase-js vs SupabaseClientLike"

key-files:
  created:
    - packages/probidad/src/run-probidad-todos.test.ts
  modified:
    - packages/probidad/src/run-probidad-todos.ts
    - packages/probidad/src/run-probidad-todos-cli.ts

key-decisions:
  - "Crudo AGREGADO por run (no por query): cada response SPARQL se acumula en un array → un solo r2_path → una sola fila source_snapshot (satisface INGEST-04 'una fila por run con r2_path poblado')"
  - "cacheKey = `infoprobidad:declaraciones:<date>` y fingerprint = sha del crudo agregado: valores simples que pueblan los NOT NULL sin consumidor de drift en esta fase"
  - "source_url run-level = `https://datos.cplt.cl/sparql` (endpoint representativo); el enlace por-declaración vive a nivel de fila (parseDeclaraciones), no en la fila de snapshot"
  - "El bloque R2/snapshot corre DESPUÉS de marcarIngestado: la carga a Supabase ya ocurrió → un fallo de R2 nunca corrompe ni bloquea el derivado (T-34-05)"
  - "createClient inyectado vía adapter tipado (cast aislado) en vez de pasar el createClient crudo: el tipo del builder de supabase-js es estructuralmente incompatible con el SupabaseClientLike narrow de @obs/ingest (TS2589)"

patterns-established:
  - "Mock estructural de R2Store/SnapshotWriter en tests (vi.fn putImmutable/write), sin red ni DB"
  - "Doble candado `!dryRun` + presencia de creds para construir r2Store y snapshotWriter — el dry-run de CI nunca toca R2/DB reales"

requirements-completed: [INGEST-04]

# Metrics
duration: ~14min
completed: 2026-06-24
---

# Phase 34 Plan 02: Probidad Etapa-1 R2 + SnapshotWriter Summary

**`run-probidad-todos` ahora persiste un crudo SPARQL agregado por run a R2 (Etapa 1, content-addressed) y escribe UNA fila `source_snapshot` run-level vía `SnapshotWriter` + el `SupabaseSnapshotStore` del Plan 01 — ambos best-effort (un fallo de R2/snapshot deja `r2Path` null y no aborta la carga a Supabase). El CLI ensambla `R2Store` + `SnapshotWriter` desde env solo en LIVE; el dry-run corre in-memory sin tocar R2/DB.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-06-24
- **Tasks:** 2 (Task 1 vía TDD: test RED → feat GREEN; Task 2 wire CLI)
- **Files modified:** 3 (1 creado, 2 modificados)

## Accomplishments

- **Cierra INGEST-04 para probidad.** Antes, `run-probidad-todos` no escribía crudo a R2 ni provenance a `source_snapshot`. Ahora una corrida LIVE deja UNA fila `source_snapshot` con `r2_path` poblado — la verdad cruda versionada de la Etapa 1 LOCKED.
- **Crudo agregado por run** (decisión LOCKED RESEARCH Open Q1): las N responses SPARQL (una por parlamentario) se acumulan en un array y se persisten como UN objeto R2 → UN `r2_path` → UNA fila `source_snapshot`.
- **8 columnas NOT NULL pobladas:** `source`, `resource`, `cache_key`, `r2_path`, `content_hash`, `fingerprint`, `source_url`, `date_bucket` — verificado por el mock del test.
- **Best-effort verificado:** un `putImmutable` que lanza deja `r2Path` null, NO llama a `snapshotWriter.write`, y la corrida termina normalmente (las declaraciones ya se cargaron a Supabase). Test dedicado lo cubre.
- **CLI LIVE-only:** `R2Store` + `SnapshotWriter(SupabaseSnapshotStore)` se construyen solo con `!dryRun` + creds presentes (doble candado). El dry-run corre in-memory; imprime `r2Path=none`.

## Task Commits

1. **Task 1 (RED): test fallido para Etapa-1 R2 + SnapshotWriter** — `149ef8c` (test)
2. **Task 1 (GREEN): persist crudo a R2 + fila source_snapshot** — `7b8d9d4` (feat)
3. **Task 2: wire R2Store + SupabaseSnapshotStore en el CLI desde env** — `8b7920b` (feat)

_Task 1 es TDD: commit test (RED, 3 tests fallando) → commit feat (GREEN, 46/46 verdes). Sin commit refactor separado._

## Files Created/Modified

- `packages/probidad/src/run-probidad-todos.ts` — `RunProbidadTodosOpts` extendido con `r2Store?` + `snapshotWriter?`; `RunProbidadTodosResult` extendido con `r2Path: string | null`. Acumulación de `crudos[]` en el loop; bloque R2/snapshot best-effort tras `marcarIngestado` (espejo de `run-camara-lobby.ts` L85–105, adaptado HTML→`JSON.stringify(crudos)`, ext `"json"`). Imports de `sha256Hex`/`R2Store`/`SnapshotWriter` (@obs/ingest) y `makeProvenance` (@obs/core).
- `packages/probidad/src/run-probidad-todos.test.ts` — 3 casos: (1) put + write una vez, 8 NOT NULL pobladas, `r2Path` = key; (2) put que lanza → `r2Path` null, write NO llamado, corrida sigue; (3) sin `r2Store` → `r2Path` null, sin regresión. Mocks estructurales `vi.fn`, sin red/DB.
- `packages/probidad/src/run-probidad-todos-cli.ts` — `loadEnv` allowlist + 4 `R2_*`; import de `R2Store`/`SnapshotWriter`/`SupabaseSnapshotStore` + `createClient`; `r2Store` + `snapshotWriter` condicionales (`!dryRun`); adapter `createSupabaseClient`; spread condicional a `runProbidadTodos`; `r2Path=` en el output.

## Decisions Made

- **Crudo agregado por run, no por query.** INGEST-04 pide "una fila por run con `r2_path` poblado". Acumular las responses SPARQL en un array y hacer UN `putImmutable` + UN `write` tras el loop satisface el requisito con un solo `r2_path` representativo.
- **`cacheKey`/`fingerprint` simples.** `cacheKey = infoprobidad:declaraciones:<date>`, `fingerprint = sha` del crudo agregado — valores que pueblan los NOT NULL sin consumidor de drift en esta fase (RESEARCH Pitfall 4 / Open Q2; A2 del Assumptions Log).
- **`source_url` run-level = endpoint SPARQL.** `https://datos.cplt.cl/sparql` es representativo del run; el enlace por-declaración vive a nivel de fila (`parseDeclaraciones({ enlace })`), independiente de la fila de provenance.
- **Adapter de `createClient`** (ver Deviations) — el cast aísla el mismatch de tipos en un solo punto bridge, manteniendo el contrato del Plan 01 (`{ url, serviceKey, createClient }`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapter tipado para `createClient` (TS2589 / mismatch estructural)**
- **Found during:** Task 2 — `tsc --noEmit` tras pasar el `createClient` crudo de `@supabase/supabase-js` a `SupabaseSnapshotStore`.
- **Issue:** El plan/contrato Plan 01 indica pasar `createClient` directo. Pero el tipo de retorno del builder genérico-profundo de supabase-js (`PostgrestBuilder<...>`) es estructuralmente incompatible con el `SupabaseClientLike` narrow de `@obs/ingest` (su `.from().insert().select().single()` espera un `Promise`, no el builder). Esto producía `TS2589: Type instantiation is excessively deep` + `TS2322` en el constructor.
- **Fix:** Se añadió un adapter `const createSupabaseClient: CreateSupabaseClient = (url, key) => createClient(url, key) as unknown as ReturnType<CreateSupabaseClient>;` — cast aislado en un único punto bridge. `SupabaseClientLike` es un supertipo estructural (solo usa `.from(...).insert/select`), así que el cast es seguro en runtime: el cliente real expone esos métodos. `@obs/ingest` queda desacoplado de la lib (T-34-SC) y el contrato del Plan 01 se honra (factory inyectada).
- **Files modified:** packages/probidad/src/run-probidad-todos-cli.ts
- **Verification:** `tsc --noEmit -p tsconfig.json` limpio (exit 0); dry-run imprime `r2Path=none`; 46/46 tests probidad verdes; `pnpm test` root exit 0.
- **Committed in:** `8b7920b` (parte del commit de Task 2).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** El fix preserva el contrato y la semántica (cliente construido server-side con la service key vía la factory inyectada del Plan 01); solo añade un cast tipado en el punto bridge para sortear la profundidad del tipo genérico de supabase-js. Sin scope creep, cero dependencias nuevas.

## Issues Encountered

- **`pnpm --filter @obs/probidad exec tsx ...` cambia el cwd al directorio del paquete**, donde no existe `supabase/seeds/parlamentario.seed.json` (vive en repo root). La verificación del dry-run se corrió desde repo root (`pnpm exec tsx packages/probidad/src/run-probidad-todos-cli.ts`), que es como el workflow `probidad-weekly` lo invoca. Comportamiento pre-existente del CLI (lee el seed desde `process.cwd()`), NO una regresión de este plan.

## User Setup Required

None para validación. El test corre sin red/DB/secrets. Para una corrida LIVE el operador debe tener cargados en env `SUPABASE_API_URL`, `SUPABASE_SECRET_KEY` y los 4 `R2_*` (ya mapeados en el workflow `probidad-weekly` del Plan 03). Cero DDL — `source_snapshot` ya existe (migración 0002).

## Threat Surface Scan

Sin superficie nueva fuera del `<threat_model>` del plan. Los escritores R2/Supabase ya estaban contemplados (T-34-04..07); el adapter de `createClient` no abre superficie (solo un cast de tipo). La service key nunca se interpola en logs/errores.

## Next Phase Readiness

- `run-probidad-todos` queda listo para que `probidad-weekly` (Plan 03) lo invoque en LIVE con los 4 `R2_*` + creds Supabase → una fila `source_snapshot` por corrida.
- INGEST-04 cerrado para probidad. El CLI de Cámara (`run-camara-lobby-cli`) aún descarta `r2Path` (no escribe `source_snapshot`); cerrarlo allí sería trabajo análogo fuera del alcance de este plan.

---
*Phase: 34-ingest-ingesta-lobby-probidad-programada*
*Completed: 2026-06-24*

## Self-Check: PASSED

- FOUND: packages/probidad/src/run-probidad-todos.ts
- FOUND: packages/probidad/src/run-probidad-todos.test.ts (created)
- FOUND: packages/probidad/src/run-probidad-todos-cli.ts
- FOUND commit 149ef8c (test RED)
- FOUND commit 7b8d9d4 (feat GREEN, Task 1)
- FOUND commit 8b7920b (feat, Task 2 CLI wire)
- VERIFIED: `pnpm --filter @obs/probidad test` → 46/46 verdes
- VERIFIED: `tsc --noEmit` limpio (exit 0)
- VERIFIED: dry-run imprime `r2Path=none`, in-memory, sin tocar R2/DB
- VERIFIED: `pnpm test` (root) exit 0 — ACCEPTANCE gate 5 verde
