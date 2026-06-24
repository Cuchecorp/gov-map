---
phase: 35-ent-resoluci-n-de-identidades-de-terceros
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - supabase/migrations/0034_entidad_tercero.sql
  - supabase/migrations/0035_vinculo_entidad.sql
  - supabase/migrations/0036_entidad_fk.sql
  - packages/identity/src/deterministic-entidad.ts
  - packages/identity/src/enlace-entidad-confirmado.ts
  - packages/identity/src/writer-entidad-supabase.ts
  - packages/identity/src/seeder-entidad.ts
  - packages/identity/src/backup-entidad.ts
  - packages/identity/src/backfill-entidad-cli.ts
  - packages/identity/src/index.ts
  - packages/adjudication/src/prompt-entidad.ts
  - packages/adjudication/src/pipeline-entidad.ts
  - packages/adjudication/src/writer-revision-entidad.ts
  - packages/adjudication/src/revisor-entidad-cli.ts
  - packages/adjudication/src/compuerta-entidad.ts
  - packages/adjudication/src/compuerta.ts
  - packages/adjudication/src/tipos-entidad.ts
  - packages/adjudication/src/index.ts
  - packages/lobby/src/reconciliar-sujeto.ts
  - packages/lobby/src/writer.ts
  - packages/dinero/src/reconciliar-contrato.ts
  - packages/dinero/src/ingest-run.ts
  - packages/dinero/src/writer-supabase.ts
  - packages/dinero/src/writer.ts
  - packages/dinero/src/model.ts
  - app/app/admin/revisar-entidades/page.tsx
  - app/lib/admin-gate.ts
  - app/lib/supabase-admin.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 35 builds the third-party identity subsystem (`entidad_tercero`) mirroring the
parliamentary identity machinery. The security invariants requested in the brief mostly
hold and are well constructed: RLS deny-by-default + explicit `revoke` on all four tables,
the `EnlaceEntidadConfirmado` branded type with a private non-exported symbol, the
`assertNoRutInLlmInput` gate over the exact system+user prompt, the Δ2 juridica-only-RUT
rule (enforced in TS *and* in DB triggers), the anti-demotion RAISE guards, the 10-arg
exact-signature revoke/grant on `resolver_entidad`, and the server-side fail-closed admin
gate. Those are solid.

However there is a **confirmed runtime BLOCKER**: the entity master `upsert` targets an
`ON CONFLICT (tipo_entidad, nombre_normalizado)` key that **does not exist** as a unique
index on `entidad_tercero` — migration 0034 only creates a *partial* unique index on `rut`.
Every seeder/backfill run will throw at the DB. The tests pass only because they mock the
Supabase client and never exercise the constraint. A second BLOCKER concerns the audit
trail being silently dropped on best-effort failure paths. Several warnings cover
fail-open error handling and contract drift between the writer comment and the actual DDL.

## Critical Issues

### CR-01: `upsert` ON CONFLICT key has no matching unique index on `entidad_tercero` — seeder/backfill throws at runtime

**File:** `packages/identity/src/writer-entidad-supabase.ts:52` (and `supabase/migrations/0034_entidad_tercero.sql:47-50`)

**Issue:** `SupabaseEntidadWriter` defaults to `onConflict: "tipo_entidad,nombre_normalizado"`
and `upsert(rows, { onConflict })` (lines 52, 67-69). For PostgREST/Postgres to honor an
`ON CONFLICT`, there must be a **unique index or constraint exactly matching those columns**.
Migration 0034 creates only one unique index on `entidad_tercero`:

```sql
create unique index entidad_tercero_rut_key
  on entidad_tercero (rut) where rut is not null;   -- PARTIAL, on rut only
```

There is **no** unique index on `(tipo_entidad, nombre_normalizado)` in `entidad_tercero`.
(The total index `vinculo_entidad_clave_natural (tipo_entidad, mencion_normalizada)` exists
on a *different* table, `vinculo_entidad`.) So the real upsert will fail with
`there is no unique or exclusion constraint matching the ON CONFLICT specification` (SQLSTATE
42P10). This breaks ENT-05 entirely: `runBackfillEntidad` → `upsertEntidades` → `writer.upsert`
cannot persist a single row. The seeder docstring even claims the key "está respaldada por un
índice único TOTAL en 0034/0035" (`seeder-entidad.ts:14-16`, `writer-entidad-supabase.ts:14-16`)
— that index was never created. The unit test passes only because `fakeClient()`
(`writer-entidad-supabase.test.ts:38-67`) stubs `upsert` to return `{ error: null }` without
touching a database, so the constraint is never validated.

**Fix:** Add the missing TOTAL unique index to 0034 so the documented natural key actually
exists, then keep the writer default in sync:

```sql
-- in 0034_entidad_tercero.sql
create unique index entidad_tercero_clave_natural
  on entidad_tercero (tipo_entidad, nombre_normalizado);
```

(Use a TOTAL — not partial — index, exactly as `vinculo_entidad` does, since PostgREST
`onConflict` cannot target a partial index.) Add a pgTAP assertion in
`0034_entidad_tercero.test.sql` that this index exists and is non-partial, plus a
double-insert `throws_ok('23505')`, so the gap cannot recur. Note this also interacts with
the partial `rut` index: two rows with the same `(tipo_entidad, nombre_normalizado)` but
different RUTs would now collide — confirm that is the intended dedup semantics before
applying.

### CR-02: Audit record silently discarded on best-effort revision enqueue (no audit of name→RUT candidates that fail to enqueue)

**File:** `packages/dinero/src/reconciliar-contrato.ts:474-478`

**Issue:** `encolarRevisionRut` swallows *all* errors from `writer.enqueueRevision` with an
empty catch:

```ts
try {
  await writer.enqueueRevision(caso);
} catch {
  /* best-effort: el candidato ya quedo en revisionesRut para auditoria; no abortar la corrida. */
}
```

The justification ("el candidato ya quedó en `revisionesRut`") only holds for the *in-memory
return value* of the current process run. There is no `appendAudit` on this path and no log,
so if the durable enqueue fails (network blip, RLS, schema drift), the only record of a
name-derived RUT candidate — a privacy-sensitive linking decision under Ley 21.719 — exists
solely in volatile memory and vanishes when the run ends. This is a repudiation / data-loss
gap on exactly the kind of sensitive adjudication the phase is meant to make traceable.
Compounding it, the catch has no `log` call, so the operator gets zero signal that a durable
write was lost.

**Fix:** At minimum log the failure with context; preferably re-raise or accumulate into the
`degradaciones`/`errores` channel so the operator sees that a durable enqueue was lost:

```ts
} catch (err) {
  opts.log?.(
    `reconciliarContrato: enqueueRevision falló para ${candidato.parlamentarioId} ` +
    `(${err instanceof Error ? err.message : String(err)}); candidato solo en memoria`,
  );
}
```

Do not leave a bare `catch {}` on a path that is the audit trail for a sensitive linking
decision.

## Warnings

### WR-01: Pipeline always strips RUT before the deterministic stage — a juridica can never confirm through `correrPipelineEntidad`

**File:** `packages/adjudication/src/pipeline-entidad.ts:107-110`

**Issue:** Etapa 0 builds the `mention` for `matchDeterministaEntidad` from only
`nombreNormalizado` and `tipoEntidad`; `MencionEntidadForanea` (`tipos-entidad.ts:18-25`)
carries no `rut` by design. Consequently, inside the pipeline a `juridica` mention always
returns `juridica-sin-rut` and routes to the unconditional Δ2 `no_confirmado` branch
(lines 136-155) — it can *never* confirm, even when a RUT is available upstream. This is
acceptable *only* because the real RUT-based confirmation for entities happens in the
reconcilers (`resolverContraparte`, `resolverEntidadProveedor`) which pass RUT directly to
`matchDeterministaEntidad`. The risk is silent contract confusion: a future caller that
expects `correrPipelineEntidad` to confirm juridicas by RUT will get fail-closed nulls with
no error. The pipeline doc comments do not state that juridica confirmation is impossible
here by construction.

**Fix:** Document the invariant explicitly at the function contract ("juridica mentions can
only resolve to `no_confirmado` in this pipeline; RUT-confirmation lives in the
reconcilers"), or have the pipeline assert/reject a juridica mention reaching Etapa 0 with a
RUT present so the limitation is loud rather than silent.

### WR-02: `appendAudit`/`enqueueRevision`/`upsert` use `.insert([...]).select()` then ignore the returned data — a silent partial insert is undetectable

**File:** `packages/adjudication/src/writer-revision-entidad.ts:124-132, 194-202`

**Issue:** `enqueueRevision` and `appendAudit` do `.insert([caso]).select()` and only branch
on `error`; they never check that `data` actually contains the inserted row. With PostgREST,
an insert that is silently filtered by RLS (or returns zero rows for another reason) can come
back with `error: null` and `data: []`. For an append-only audit table whose whole purpose is
non-repudiation, "I called insert and got no error" is weaker than "I confirmed a row was
written." The `.select()` is already being paid for; its result is discarded.

**Fix:** Assert the row count: after each insert, `if ((data ?? []).length === 0) throw new
Error(...)`. This turns a silent no-op audit write into a loud failure.

### WR-03: Admin server action accepts caller-supplied `mencionNombre`/`mencionNormalizada` instead of reading them from the case

**File:** `app/app/admin/revisar-entidades/page.tsx:105-128`

**Issue:** `resolverEntidadAdmin` builds the promoted `vinculo` from `input.mencionNombre`,
`input.mencionNormalizada` and `input.chosenId` taken directly from the action input, with
`?? ""` fallbacks. The upsert natural key is `(tipo_entidad, mencion_normalizada)`; if the
caller passes a `mencion_normalizada` that differs from the actual queued case (or an empty
string), the RPC will upsert/overwrite the *wrong* `vinculo_entidad` row, or create a vinculo
keyed on `("natural", "")`. The case id (`input.casoId`) is trusted but the mention fields
that determine which vinculo gets confirmed are not cross-checked against the stored case.
The CLI counterpart (`revisor-entidad-cli.ts:198-219`) correctly derives these from the
fetched `caso`. The admin path should do the same rather than trust the client.

**Fix:** In `resolverEntidadAdmin`, fetch the case server-side (`listarPendientes`/an
`obtenerCaso`) and build the vinculo's `mencion_nombre`/`mencion_normalizada`/`tipo_entidad`
from the stored row, ignoring client-supplied values for those fields. Only `casoId`,
`accion`, `revisor`, and (for correct) `chosenId` should come from the request.

### WR-04: `loadEnv` lets a `.env` file override process.env for some keys but not others — precedence is inconsistent and contradicts the docstring

**File:** `packages/identity/src/backfill-entidad-cli.ts:44-59`

**Issue:** The docstring says `process.env` has PRECEDENCE, but the implementation reads the
`.env` file into `out` first (lines 46-51) for *any* matched `KEY=value`, then overlays only a
fixed allow-list of four keys from `process.env` (lines 55-57). Any key present in `.env` but
not in that allow-list keeps the file value even if `process.env` also sets it — the opposite
of the stated precedence. For a CLI that mixes operator `.env` files with injected secrets
this is a footgun (stale file value silently wins). Also `replace(/^﻿/, "")` only strips a BOM
from the first line, not from a key on a later line if the file has unusual encoding.

**Fix:** Make precedence uniform: build from `.env`, then overlay *every* key found in
`process.env` (`for (const k of Object.keys(process.env)) if (process.env[k]) out[k] =
process.env[k]`), or document that only the allow-listed four keys are honored at all and
ignore the rest of the `.env` parse.

### WR-05: `obtenerCaso` / `listarPendientes` use no `.limit` and `obtenerCaso` ignores extra rows silently

**File:** `packages/adjudication/src/writer-revision-entidad.ts:217-227`

**Issue:** `obtenerCaso(id)` does `.select("*").eq("id", id)` and returns `filas[0] ?? null`.
`id` is the primary key so duplicates are impossible *today*, but the function silently takes
the first of an unbounded result set; if the query were ever pointed at a non-PK column the
behavior would mask multiplicity. More importantly there is no `.maybeSingle()`/`.single()`,
so a DB-side error vs "not found" is only distinguishable by the `error` field, and any
unexpected multi-row return is silently truncated rather than flagged.

**Fix:** Use `.eq("id", id).maybeSingle()` so PostgREST enforces 0-or-1 semantics and a
multi-row anomaly surfaces as an error instead of being silently dropped.

## Info

### IN-01: `resolver_entidad` UPSERT does not refresh `fecha_captura` on conflict

**File:** `supabase/migrations/0036_entidad_fk.sql:75-82`

**Issue:** The `on conflict do update` set-list updates `entidad_tercero_id`, `estado`,
`metodo`, `mencion_nombre`, `origen`, `enlace` but not `fecha_captura`. A re-confirmation of
an existing vinculo therefore keeps the original capture timestamp. This may be intentional
(capture = first-seen) but is worth an explicit decision since the INSERT path coalesces
`fecha_captura` to `now()`.

**Fix:** Decide and comment: either add `fecha_captura = excluded.fecha_captura` to the
update list, or document that `fecha_captura` is first-write-wins on the vinculo.

### IN-02: `contrato` table computes `entidadId` per row but never persists it (only `contratista` gets it)

**File:** `packages/dinero/src/reconciliar-contrato.ts:284, 528` and `packages/dinero/src/writer-supabase.ts:47-68`

**Issue:** `ContratoParaEscribir.entidadId` is computed for every contract row
(`resolverEntidadProveedor`) and threaded through `filaParaEscribir`, but `contratoRoot`
(writer-supabase.ts) does not write it (the `contrato` table has no `entidad_id` column —
correct per 0036, which only adds it to `contratista`). The per-contract `entidadId` is used
only indirectly via `ingest-run.ts:199` (`filas.find(f => f.entidadId != null)`) to populate
the single `Contratista` row. Carrying a computed-but-mostly-discarded field on every contract
is dead-ish weight and slightly misleading. Not a bug, but the data flow would be clearer if
`entidadId` were resolved once per RUT in `ingest-run` rather than per contract row.

**Fix:** Consider resolving the entity FK once per provider (RUT) in `ingest-run` and dropping
`entidadId` from `ContratoParaEscribir`, or add a comment clarifying that the contract-level
field exists only to feed the contratista aggregation.

### IN-03: `runBackfillEntidad` matcher pass drops RUT, so `confirmadas` count is name-only and may understate confirmations

**File:** `packages/identity/src/backfill-entidad-cli.ts:117-121`

**Issue:** The backfill loops `matchDeterministaEntidad(mencion, maestra)` to count
`confirmadas`, but `MentionEntidad.rut` is honored by the matcher only if the caller's
`mencion` objects carry it. The CLI passes `opts.menciones` straight through, so whether RUT
is considered depends entirely on how the operator constructs menciones. The reported count
is fine, but the log line claims "confirmadas (RUT o nombre-por-tipo)" while the seeded rows
are then all forced to `no_confirmado` (`aSeed`, line 97) — i.e. the count is informational
only and never affects what is persisted. Worth a one-line clarification so the operator does
not expect the backfill to persist confirmations.

**Fix:** Clarify in the log/docstring that `confirmadas` is a dry-run diagnostic and the
seeder always persists `no_confirmado` (promotion is a separate explicit step).

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
