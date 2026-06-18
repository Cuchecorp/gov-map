---
phase: 04-adjudicacion-identidad-compuerta-humana-golden-set
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - packages/adjudication/src/compuerta.ts
  - packages/adjudication/src/pipeline.ts
  - packages/adjudication/src/candidatos.ts
  - packages/adjudication/src/prompt.ts
  - packages/adjudication/src/tipos.ts
  - packages/adjudication/src/writer-revision.ts
  - packages/adjudication/src/revisor-cli.ts
  - packages/adjudication/src/golden/golden-set.ts
  - packages/adjudication/src/mock-provider.ts
  - packages/adjudication/src/index.ts
  - supabase/migrations/0006_revision_identidad.sql
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the identity adjudication subsystem (existential-risk component #1). The
core fail-closed primitives are largely correct: the `UMBRAL = 0.9` threshold in
`compuerta.ts` uses strict `<` (the 0.90 boundary correctly auto-accepts, 0.8999
goes to review), the gate accumulates ALL failure reasons before deciding, and the
A4 invariant (LLM/auto-accept max `probable`, never `confirmado`) holds across
`pipeline.ts` and `revisor-cli.ts`. Etapa 0 deterministic short-circuits before any
LLM call, and the RUT gate runs on the exact prompt string before `complete`.

However, two CRITICAL defects undermine the deploy gate's integrity and the
audit/correctness guarantees:

1. The migration's append-only enforcement for `identidad_audit` is **bypassable by
   the service role** — the `REVOKE` targets `public` only (not the service role
   that the writer actually uses), and the `INSERT` grant relied upon is never
   verified. More importantly, the same RLS/REVOKE protections are **entirely
   absent for `vinculo_identidad`** — the public-facing fact table — leaving its
   `confirmado` rows mutable/insertable by any role that can reach it.

2. The golden-set precision gate can be **silently defeated** by the mock provider's
   substring keying (`req.user.includes(k)`), and the precision metric does not
   exercise a genuine LLM-produced wrong-match (every `expected:match` case is fed a
   mock that returns the CORRECT id), so the gate cannot actually catch a
   model-driven false positive — it only re-tests the deterministic plumbing.

The narrative findings below detail each, plus warnings around audit linkage
(`vinculo_id` is always `null`), idempotency mismatch in `upsertVinculo`, and
input-validation gaps in the CLI.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `vinculo_identidad` (the public fact table) has NO write-protection or append-only guard; audit `REVOKE` does not bind the service role that writes it

**File:** `supabase/migrations/0006_revision_identidad.sql:82-107`

**Issue:**
The migration's stated threat model (lines 11-19) is that the writer uses the
**service role, which BYPASSES RLS**, so immutability must live in the DB. Two gaps:

1. **`vinculo_identidad` gets only `enable row level security` with no policies
   (deny-by-default for reads) — but ZERO protection against writes.** This is the
   table that holds `estado='confirmado'` rows, the only state that becomes a public
   claim (existential risk #1). RLS does not stop the service role, and there is no
   trigger and no `REVOKE` on this table. Any path holding the service key (or any
   future role granted DML) can silently `UPDATE` a `probable` row to `confirmado`,
   or flip `parlamentario_id` to a wrong person, with no audit trail and no DB
   barrier. The A4 invariant is enforced only in application code
   (`pipeline.ts`/`revisor-cli.ts`), not at the DB — contradicting the migration's
   own Pitfall-4 reasoning ("confiar en que la app nunca actualiza es insuficiente").

2. **`identidad_audit` REVOKE targets the wrong principal.** Line 101 does
   `revoke update, delete, truncate on identidad_audit from public`. The writer
   connects with the **service role**, which is a distinct, superuser-like role that
   bypasses RLS *and* generally owns/has direct grants — `REVOKE ... FROM public`
   does not remove the service role's privileges. The trigger (lines 95-98) is the
   only barrier that actually binds the service role, so the REVOKE provides no
   defense-in-depth against the real writer. Worse, the trigger only covers
   `UPDATE`/`DELETE`, not `TRUNCATE` — and `TRUNCATE` does not fire row-level
   `BEFORE UPDATE OR DELETE` triggers, so a service-role `TRUNCATE identidad_audit`
   wipes the entire non-repudiable audit log unimpeded.

**Fix:**
```sql
-- (a) Protect the public fact table the same way as the audit log.
--     Make confirmado promotion auditable and block silent service-role tampering.
alter table vinculo_identidad force row level security;  -- bind even the owner
-- Add a statement-level TRUNCATE guard on the audit table (row triggers miss TRUNCATE):
create trigger identidad_audit_no_truncate
  before truncate on identidad_audit
  for each statement
  execute function identidad_audit_immutable();
-- (b) REVOKE from the actual writer role, not just public:
revoke update, delete, truncate on identidad_audit from service_role;  -- adjust role name
-- (c) Consider a BEFORE UPDATE trigger on vinculo_identidad that forbids
--     estado: 'probable'|'no_confirmado' -> 'confirmado' unless metodo='humano'/'determinista',
--     enforcing A4 at the DB tier instead of trusting application code alone.
```
Verify in a test that a service-role connection cannot UPDATE/DELETE/TRUNCATE
`identidad_audit` and cannot promote a `vinculo_identidad` row to `confirmado`.

---

### CR-02: Golden-set precision gate cannot detect a model-driven false positive and is defeatable by substring mock keying — it is close to trivially-passing

**File:** `packages/adjudication/src/golden/golden-set.ts:96-98,438-491` and `packages/adjudication/src/mock-provider.ts:31-40`

**Issue:**
The golden set is the deploy gate for existential risk #1 ("an auto-accept of the
wrong id = false positive, weighs maximally in precision"). Two structural problems
mean it does **not** actually exercise wrong-match detection:

1. **No `expected:match` case is ever fed a wrong-id LLM response.** Every
   `expected:{tipo:"match", chosenId:X}` case fixes `llmEsperado = match(X, conf)`
   with the SAME `X`. So in CI the mock always returns the correct id, the compuerta
   passes it, and `afirmoId === expected.chosenId` → `tp`. The `fp` branch at
   line 466 (`afirmoId != null && afirmoId !== expected.chosenId`) is **unreachable
   in CI** because no case supplies a mismatched mock. The precision metric therefore
   only confirms the deterministic plumbing (blocking + threshold) — it cannot fail
   on a genuine model error, which is exactly the failure mode the gate exists to
   catch. A reviewer reading line 489 (`precision = tp+fp===0 ? 1 : ...`) should note
   that with the current fixtures `fp` is structurally 0, so precision is pinned at
   1.0 regardless of compuerta behavior. The gate is effectively a tautology in CI.

2. **Mock keying via `req.user.includes(k)` is order- and substring-fragile.**
   `mock-provider.ts:33` selects the fixture with
   `Object.keys(respuesta).find((k) => req.user.includes(k))` — first substring hit
   wins, over an object whose key order is insertion order. Several golden
   `nombreOriginal` values are substrings of others or collide:
   `"Walker, Matías"` (g12 and g20 — duplicate key, one silently overwrites the
   other in `mockDelGolden`'s map) and the `"Walker ..."` family. If any future case
   adds a `nombreOriginal` that is a prefix/substring of another, the wrong fixture
   is returned and the gate gives a false PASS or FAIL with no error. This is a
   correctness landmine in the one component guarding the existential risk.

**Fix:**
```ts
// (1) Add at least one adversarial fixture where the LLM returns a WRONG id at high
//     confidence, expected to be caught as fp (and assert the gate FAILS on it), or
//     assert in the test that the fp branch is reachable:
{
  id: "g23-wrong-id-highconf",
  categoria: "homonimo",
  mencion: men({ nombreOriginal: "Adversarial, Test", tokens: ["adversarial","test"], ... }),
  maestraRelevante: [ /* contains P00999 (correct) and P00998 */ ],
  llmEsperado: match("P00998", 0.99),     // model picks the WRONG candidate, high conf
  expected: { tipo: "match", chosenId: "P00999" }, // -> must count as fp
}
// And add a unit test asserting evaluarGolden over a deliberately-wrong fixture
// yields precision < PRECISION_MIN (proving the gate can fail).

// (2) Replace fragile substring keying with exact, unambiguous keying:
const clave = Object.keys(this.respuesta).find((k) => req.user.split("\n")[1]?.endsWith(k));
// or key the mock by mencion id rather than nombreOriginal, and reject duplicate keys
// in mockDelGolden() (throw if a nombreOriginal repeats).
```

---

## Warnings

### WR-01: Every audit row is written with `vinculo_id: null`, breaking the non-repudiable link between an audit entry and the vínculo it describes

**File:** `packages/adjudication/src/pipeline.ts:108,130,168,197`

**Issue:**
`identidad_audit.vinculo_id` is the FK that ties a decision record to the
`vinculo_identidad` row it produced (the migration declares it,
`0006:70`). The pipeline `upsertVinculo(...)` then `appendAudit({ vinculo_id: null, ... })`
in all four branches — the audit never references the vínculo. The audit log
becomes a flat list of decisions with no durable join back to the affected fact
row, defeating much of the "procedencia no-repudiable" purpose (ID-08). Because
`upsertVinculo` does not return the row id, there is no way to populate it as
written.

**Fix:** Have `upsertVinculo` return the inserted/updated row id (`.select("id")`)
and pass it into the subsequent `appendAudit({ vinculo_id: id, ... })`. For the
`no_confirmado`/`revision` branches decide explicitly whether a link is expected and
document it; do not silently write `null` everywhere.

---

### WR-02: `upsertVinculo` onConflict key (`"id"`) does not match the table's real uniqueness constraint, so re-running the pipeline inserts duplicate vínculos instead of updating

**File:** `packages/adjudication/src/writer-revision.ts:127-134` and `supabase/migrations/0006_revision_identidad.sql:43-45`

**Issue:**
The vínculo's idempotency key in the DB is the partial unique index on
`(camara, periodo, mencion_normalizada) where parlamentario_id is not null`
(migration lines 43-45). But `upsertVinculo` calls
`.upsert([v], { onConflict: "id" })`. The pipeline never sets `v.id` (it is omitted
in `baseVinculo`), so `id` is always null/absent on the conflict target → the upsert
behaves as a plain INSERT. Re-processing the same mention (idempotent reruns,
retries) creates a SECOND `probable`/`confirmado` row for the same person/mention,
or hits the partial unique index and throws. Either way the "UPSERT for idempotency"
intent is broken, and duplicate `confirmado` rows are an existential-risk surface
(multiple competing public claims for one mention).

**Fix:**
```ts
.upsert([v], { onConflict: "camara,periodo,mencion_normalizada" })
```
and ensure a matching (non-partial, or expression-compatible) unique constraint
exists so PostgREST can use it. Add a test that runs the pipeline twice on the same
mention and asserts a single vínculo row.

---

### WR-03: `revisor-cli` confirm path promotes the vínculo even when `chosen_id` is null, writing `parlamentario_id: null` as `estado='confirmado'`

**File:** `packages/adjudication/src/revisor-cli.ts:92-99,169-173,207-221`

**Issue:**
`confirmar` derives `chosenId = chosenIdDeCaso(caso)`, which returns `null` when the
model output lacks a valid `P\d{5}` id (e.g. the case reached review precisely
because the LLM said `uncertain`/`no_match`, so `chosen_id` is null — the common
case for the human queue). It then calls `resolverYAuditar(..., promoverVinculo:true,
parlamentarioId: chosenId)`. With `chosenId === null` this upserts a
`vinculo_identidad` row with `estado:'confirmado', parlamentario_id:null`. A
"confirmed" link to NOBODY is a corrupt public fact and violates the intent that
`confirm` asserts a real identity. (The DB allows it: `parlamentario_id` is
nullable and the `estado` check permits `confirmado`.)

**Fix:** In `confirmar`, if `chosenIdDeCaso(caso)` is null, throw before any write
("este caso no tiene chosen_id del modelo; use `correct --chosen-id` para fijar el
id"). Only promote to `confirmado` when a concrete `parlamentario_id` is present.

---

### WR-04: `confidence` is silently dropped to `null` in audit for review/no-confirm paths but model DID emit one — and `evidence` array can exceed declared bounds via correct-path

**File:** `packages/adjudication/src/pipeline.ts:129-138`

**Issue:**
The `no_confirmado` (sin-candidatos) branch writes `confidence: null` and
`evidence: []`, which is fine (no LLM ran). But it is reached BEFORE the LLM, so the
`conflicts: ["sin candidatos tras blocking"]` is an app-generated string in a column
documented as model output — mixing provenance semantics. More concretely, the
audit `decision` column is free-text (`0006:73`) and the pipeline writes
`"no_confirmado"`, `"probable"`, `"revision"` while the migration comment enumerates
`match|no_match|uncertain|confirmado|rechazado|corregido`. The written values do not
match the documented vocabulary, so downstream consumers filtering on `decision`
will miss these rows. This is a latent data-quality/consistency bug in the
audit log that the gate does not catch (NoopWriter discards it).

**Fix:** Standardize the `decision` vocabulary between the migration comment and the
pipeline writes (add a CHECK constraint or a shared enum), and separate
model-emitted `conflicts` from app-generated routing reasons (e.g. a distinct
`razones`/`motivo` audit field) so provenance stays clean.

---

### WR-05: RUT leak gate runs only on the user prompt, not the system prompt or candidate-derived fields, and silently trusts that the mención never carries a RUT

**File:** `packages/adjudication/src/pipeline.ts:143-156` and `packages/adjudication/src/prompt.ts:66-91`

**Issue:**
`assertNoRutInLlmInput(userPrompt)` covers the constructed user string, which is
correct for the documented threat (mención.nombreOriginal carrying a RUT). But:
(a) the candidate lines are built from `c.nombres/apellido_*` and `c.region`
(`prompt.ts:71-74`) — if a maestra record's free-text name field ever contains a RUT
(dirty upstream data), it flows into the prompt and the gate would catch it, which
is good — but `c.region` and the system prompt are not re-checked, and more
importantly nothing asserts the candidate objects themselves were RUT-stripped
before reaching here; (b) the gate is the LAST line of defense yet relies on the
regex in `data-routing.ts` which is deliberately broad — a name like a numeric token
could false-positive and block a legitimate adjudication (fail-closed, acceptable)
but there is no test covering a candidate-injected RUT, only a mención-injected one
(`slice.e2e.test.ts:142`).

**Fix:** Run the gate on the full payload actually sent (`system + user`), and add a
test where a CANDIDATE's name field contains a RUT to prove the gate aborts with
`callCount===0` for that vector too. Document that candidate objects must be
RUT-free at the type level (they already lack a `rut` projection in
`CandidatoResumen`, but `Parlamentario` carries `rut` and is passed whole into
`construirPromptAdjudicacion`).

---

### WR-06: `correct`/`confirm` upsert reuses `caso.vinculo_id` as the vínculo `id` but the same onConflict mismatch (WR-02) means a corrected link may not overwrite the original probable row

**File:** `packages/adjudication/src/revisor-cli.ts:209-220`

**Issue:**
`resolverYAuditar` sets `vinculo.id = caso.vinculo_id` only when non-null, then
`upsertVinculo`. Since `upsertVinculo` uses `onConflict:"id"` (WR-02), this path
*does* work when `caso.vinculo_id` is present — but for review cases enqueued from
the compuerta's `revision` branch, `enqueueRevision` is called with NO `vinculo_id`
(`pipeline.ts:182-196` omits it), so `caso.vinculo_id` is null/undefined. The human
correction then inserts a NEW `confirmado` row while the original `probable` row (if
any existed) is never superseded — but in the `revision` branch the pipeline never
created a probable vínculo, so generally there is no stale row. The risk is the
inconsistency: confirm/correct relies on a `vinculo_id` linkage that the enqueue
path never populates, so the human-confirmed `confirmado` row is disconnected from
any prior state and from its own audit (compounding WR-01).

**Fix:** Decide the linkage contract: either `enqueueRevision` should create/reference
a vínculo id up front, or confirm/correct should look up the existing vínculo by
`(camara, periodo, mencion_normalizada)` and update it in place. Align with the WR-02
onConflict fix.

---

## Info

### IN-01: `provider.complete` has no try/catch — a thrown LLM/network error aborts the pipeline with no audit row recording the failed attempt

**File:** `packages/adjudication/src/pipeline.ts:147-156`

**Issue:** Every other decision writes an audit row, but if `provider.complete`
throws (timeout, 5xx, schema repair failure), the mention is left with no vínculo and
no audit entry — an invisible gap in the "audit on every decision" guarantee.
**Fix:** Wrap the LLM call; on failure write an audit row
(`decision:"error", conflicts:[err.message]`) and route the mención to review/retry
rather than dropping it silently.

### IN-02: CLI arg parsing accepts a flag value that is itself a flag (e.g. `--revisor --motivo`)

**File:** `packages/adjudication/src/revisor-cli.ts:239-242`

**Issue:** `flag(nombre)` returns `process.argv[i+1]` unconditionally, so
`confirm 5 --revisor --motivo x` sets `revisor = "--motivo"`. `validarRevisor` only
rejects empty/whitespace, so `"--motivo"` passes and is written as `revisor_id` into
the immutable audit — corrupting traceability.
**Fix:** Reject flag values that start with `--`, or validate `revisor` against an
expected identity format.

### IN-03: `obtenerCaso` uses `.eq("id", id)` + `[0]` instead of `.single()`, masking duplicate-id anomalies

**File:** `packages/adjudication/src/writer-revision.ts:163-173`

**Issue:** `id` is the PK so duplicates can't occur today, but `.select(...).eq(...)`
then `filas[0]` silently returns the first of N; `.maybeSingle()` would surface an
unexpected multi-row condition. Minor robustness.
**Fix:** Use `.eq("id", id).maybeSingle()`.

### IN-04: `chosenIdDeCaso` re-validates `P\d{5}` but the same regex is duplicated as `ID_REGEX` and inside `AdjudicacionSchema` (`prompt.ts:31`) and `provenance` enlace is hardcoded `""`

**File:** `packages/adjudication/src/revisor-cli.ts:33,172` / `packages/adjudication/src/pipeline.ts:65`

**Issue:** The `^P\d{5}$` id format is defined in three places (schema regex, CLI
`ID_REGEX`, the comment in compuerta). Drift between them would weaken validation.
Also `provenance().enlace = ""` is written `not null` to the DB on every vínculo,
making the provenance field uninformative.
**Fix:** Export a single shared `ID_PARLAMENTARIO_REGEX` constant from one module and
reuse it; populate or omit `enlace` meaningfully.

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
