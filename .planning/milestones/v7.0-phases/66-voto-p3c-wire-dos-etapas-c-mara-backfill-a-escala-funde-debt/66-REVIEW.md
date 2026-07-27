---
phase: 66-voto-p3c-wire-dos-etapas
reviewed: 2026-07-14T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - packages/votos/src/run-camara-votos.ts
  - packages/votos/src/cobertura.ts
  - packages/votos/src/run-votos-masivo-cli.ts
  - packages/votos/src/run-camara-votos.test.ts
  - packages/votos/src/cobertura.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 66: Code Review Report

**Reviewed:** 2026-07-14
**Depth:** deep (cross-file: run-camara-votos → runIngest → R2Store / reconciliar-camara / golden-dipid)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 66 wires the two-stage (R2 → Supabase) ingest into the Cámara votes runner, adds a `--from-r2`
replay path, an operator CLI that builds `R2Store` from `.env`, and a coverage report with a hard
DIPID-maestra invariant. The `--from-r2` replay path is correct (calls `runIngest` **without** `r2Store`,
so no re-fetch and no unexpected Etapa-1 write) and the credential handling is reasonable (no secret
logging). The PostgREST usage in `cobertura.ts` uses `head+count` and never materializes rows, so the
1k-cap loop concern does not apply.

However, the phase's headline claim — "Etapa 1 primero, luego Etapa 2" (DEBT-01, Test A) — is **not
actually enforced on the failure path**. The R2 write is best-effort in `runIngest`; when it *throws*,
the code swallows the error and proceeds to write individual votes to Supabase anyway. This violates the
LOCKED architectural rule in CLAUDE.md ("todo lo descargado se persiste PRIMERO como crudo inmutable en
R2 ... Supabase = derivado reconstruible"). For a defamation-critical vote-attribution path this is the
exact class of defect the brief warned about, and Test A only proves ordering on the happy path.

The hard invariant in `cobertura.ts` also has a soundness gap: it matches `no_confirmado` rows by
`fuente_voter_id` alone, with no period/cámara scoping — the very DIPID-reuse ("recycle-trap") hazard that
`golden-dipid.ts` and `reconciliar-camara.ts` document. It can both false-positive (a historical DIPID that
legitimately stayed `no_confirmado` but numerically collides with a current DIPID) and mis-describe what it
catches.

## Critical Issues

### CR-01: Supabase vote write proceeds even when the R2 Stage-1 write throws (two-stage integrity violation)

**File:** `packages/tramitacion/src/ingest-run.ts:275-318` (exercised by the P66 wire in
`packages/votos/src/run-camara-votos.ts:239-250`)

**Issue:** The normal path threads `r2Store`/`snapshotWriter` into `runIngest`. Inside `runIngest`, the
Etapa-1 R2 write is wrapped in `try { ... putImmutable ... } catch (err) { log("... Etapa 1 R2 falló (no
fatal) ..."); }` (lines 315-317). On any real R2 error — `R2Store.putImmutable` throws
`R2 PUT ${status}` for every non-412 HTTP status (`r2-store.ts:76-77`), and network faults reject too —
execution falls through to the upsert block (lines 332-345) which calls `upsertVotos(votosBoletin)`. So
**Supabase gets the individual votes even though the immutable raw was never persisted to R2.**

This directly contradicts the LOCKED rule in `CLAUDE.md`: *"todo lo descargado se persiste PRIMERO como
crudo inmutable en R2 ... la carga/parseo a Supabase lee del crudo en R2 ... Supabase = derivado
reconstruible."* If R2 is down or the bucket/creds are wrong, the backfill writes vote attributions that
can never be reconstructed/replayed from R2 (`--from-r2` will `R2 GET 404`), silently breaking the
"reconstruible" guarantee at exactly the scale this phase is built for.

The failure is invisible: only the `2ª put existed` (412) case is a legitimate skip; a genuine *failure*
is logged at the same non-fatal level and the run reports success (`dbLoaded=true`, votos counted). Test A
(`run-camara-votos.test.ts:379-401`) only asserts ordering when `putImmutable` succeeds — there is no test
where `putImmutable` throws and the upsert is asserted **not** to run.

**Fix:** Make the Etapa-1 R2 failure fatal *for that boletín* — skip Etapa 2 (do not upsert votes) and
record it in `errores` so re-running recovers it once R2 is healthy. E.g. in `ingest-run.ts`:

```ts
if (opts.r2Store) {
  try {
    const { r2Path, existed } = await opts.r2Store.putImmutable(/* ... */);
    if (existed) { log(`[skip] sin novedades — tramitacion ${boletinFull}`); continue; }
    log(`tramitacion: crudo en R2 → ${r2Path}`);
    if (opts.snapshotWriter) { /* ... snapshot best-effort ... */ }
  } catch (err) {
    // Etapa-1-primero es LOCKED: si el crudo NO quedó en R2, NO escribimos el derivado.
    errores.push({ boletin: boletinFull, etapa: "r2-etapa1", mensaje: (err as Error).message });
    log(`ingest: ERROR Etapa 1 R2 ${boletinFull} → se OMITE la escritura a Supabase (idempotente al re-correr)`);
    continue;
  }
}
```

Then add a test mirroring Test A where `putImmutable` rejects and assert `writer.upsertVotos` was **not**
called (`upsertVotosTicks.length === 0`) and the boletín appears in `res.errores`. Note the `snapshotWriter`
inner `try/catch` (lines 296-313) is correctly best-effort and should stay non-fatal — only the raw-object
put must gate Etapa 2.

## Warnings

### WR-01: Coverage invariant matches `no_confirmado` by DIPID number alone — false-positive on DIPID reuse

**File:** `packages/votos/src/cobertura.ts:66-84`

**Issue:** `contarDipidsMaestraNoConfirmados` counts `voto` rows with
`estado_vinculo='no_confirmado' AND fuente_voter_id IN (dipidsMaestra)`. There is **no period or
votación scoping**. `golden-dipid.ts:19-23` and `reconciliar-camara.ts:13-20` both explicitly warn that
DIPIDs are *not* globally unique over time (a 2018-2022 DIPID can be reassigned in 2026-2030). If the DB
ever holds historical votes (the phase is explicitly about scaling the backfill and the header comment on
line 6-8 anticipates "periodos históricos → más no_confirmado LEGÍTIMOS"), a historical vote that is
correctly `no_confirmado` but whose `fuente_voter_id` numerically equals a current-period maestra DIPID
will be counted as a violation. The operator then sees `INVARIANTE ROTO` and may treat a correct
fail-closed result as a regression — or worse, "fix" it by force-linking.

**Fix:** Scope the invariant to the vigente period. Either (a) join `voto → votacion` and filter votes to
Leg-58 votaciones, or (b) restrict to votes minted this run/period. If period columns are not available on
`voto`, at minimum document loudly that this invariant is only sound while the DB is single-period, and
gate the operator's `INVARIANTE ROTO` alert on that precondition. Do not present a number that conflates
"maestra DIPID unlinked this period" with "reused DIPID from a past period."

### WR-02: Invariant description overclaims — it does not catch a "name-match regression"

**File:** `packages/votos/src/cobertura.ts:9-16, 36-39, 64` and CLI alert
`packages/votos/src/run-votos-masivo-cli.ts:130-135`

**Issue:** Comments state the invariant "would actually catch a name-match regression." It cannot.
`reconciliarVotosCamara` links purely by DIPID **presence** in the index and never does name-matching
(`reconciliar-camara.ts:72-101`). A name-match regression would manifest as a *false `confirmado`* (a wrong
`parlamentario_id` set from a name), which this invariant — which only counts `no_confirmado` rows — will
never see. The invariant only detects the narrow case where a maestra DIPID's vote came back
`no_confirmado` (e.g. seed drift or index-build bug). That is a useful check, but the documented scope is
wrong and could give false confidence that misattribution-by-name is being guarded here.

**Fix:** Rewrite the comment to state precisely what it detects ("a maestra-vigente DIPID whose vote landed
`no_confirmado` — index/seed drift"). To actually guard against misattribution (`confirmado` pointing at the
wrong person), add a separate check, e.g. count `confirmado` votes whose `parlamentario_id` is not in the
maestra id set.

### WR-03: R2 content-address includes the UTC calendar date → idempotent skip breaks across day boundaries

**File:** `packages/tramitacion/src/ingest-run.ts:280-291`

**Issue:** The R2 key is `tramitacion/${boletinFull}/${today}/${sha}.json` where
`today = new Date().toISOString().slice(0,10)`. `putImmutable` returns `existed=true` (412) only when the
**same key** already exists. Because the date is part of the key, re-running the backfill on a different UTC
day with byte-identical content produces a *new* key → `existed=false` → Etapa 2 re-runs and a fresh
`source_snapshot` row is written. The idempotency test (Test D, `run-camara-votos.test.ts:460-483`) passes
only because the fake ignores the date and keys on `sha` alone, so it does not cover the real key shape.
The upsert itself is idempotent by natural key so no duplicate *votes*, but the "sin novedades → skip"
short-circuit and the snapshot dedup silently stop working across midnight — extra Supabase work and
duplicate `source_snapshot` provenance rows on long/resumed backfills.

**Fix:** Either drop the date from the content-address (content-addressed dedup should be date-independent:
`tramitacion/${boletinFull}/${sha}.json`) or check for the object under any date prefix before writing.
Update the fake `FakeR2Store` to key on the full `r2Path` (not just `sha`) so the test reflects reality.

### WR-04: `--limit` parsing silently accepts garbage and non-integers

**File:** `packages/votos/src/run-votos-masivo-cli.ts:54`

**Issue:** `const limite = Number(flagValue("--limit") ?? "1000")`. `Number("abc")` → `NaN`; `Number("")`
→ `0`; `Number("50.7")` → `50.7`. A `NaN` limite flows into `runCamaraVotos`; `tieneLimite =
opts.limite != null && opts.limite > 0` is `false` for `NaN`, so a typo like `--limit tw0` silently
disables the limit and — if no `--boletines-file` is passed — trips the "corrida no acotada" throw
(acceptable) but the operator gets a misleading error instead of "bad --limit". A fractional value flows
into `boletines.slice(0, 50.7)` which truncates unpredictably. For a WAF-sensitive backfill the limit is a
safety control and should validate.

**Fix:** Parse and validate explicitly:
```ts
const rawLimit = flagValue("--limit");
const limite = rawLimit == null ? 1000 : Number(rawLimit);
if (!Number.isInteger(limite) || limite <= 0) {
  throw new Error(`--limit inválido: '${rawLimit}' (entero > 0)`);
}
```

### WR-05: `--from-r2` replay writes to PROD with no dry-run confirmation and no boletín/period sanity check

**File:** `packages/votos/src/run-votos-masivo-cli.ts:107-115` and
`packages/votos/src/run-camara-votos.ts:184-237`

**Issue:** In `--from-r2` mode the resolved `writer` is reused. If `.env` has `SUPABASE_API_URL` +
`SUPABASE_SECRET_KEY` and `--dry-run` is not passed, the replay writes votes straight to the REMOTO
Supabase from whatever envelope path the operator typed. The envelope's `boletin` is trusted verbatim
(`run-camara-votos.ts:221`) with no validation that it belongs to Leg-58 / the vigente period, and there is
no confirmation step. A wrong/stale `--from-r2` path (e.g. pointing at a historical-period envelope) would
attribute votes from the raw file into PROD. The destination is logged (Pitfall 5, good) but a replay of
attribution data into PROD deserves at least a period cross-check against the maestra.

**Fix:** Before the replay upsert, assert the envelope's boletín/votación period is consistent with the
loaded maestra's vigente period (fail-closed if not), and/or require an explicit confirmation flag for
`--from-r2` writes to a REMOTO writer.

## Info

### IN-01: `SUPABASE_API_URL!` non-null assertions after a guard that also checks `--dry-run`

**File:** `packages/votos/src/run-votos-masivo-cli.ts:124`

**Issue:** `createClient(env.SUPABASE_API_URL!, env.SUPABASE_SECRET_KEY!, ...)` uses `!` inside the
`if (escribeReal)` block. `escribeReal` is only true when both env vars are truthy, so it is safe today,
but the assertion couples correctness to the exact shape of the guard on lines 94-105. If that guard is
edited, the `!` hides a potential undefined. Prefer capturing the validated values into locals when
`escribeReal` is set.

### IN-02: Coverage report's `porEstado` hardcodes only two states

**File:** `packages/votos/src/cobertura.ts:25`

**Issue:** `ESTADOS_VINCULO = ["confirmado", "no_confirmado"]`. If migration 0019/other work introduces a
third `estado_vinculo` (e.g. `probable`), those rows are silently omitted from the coverage totals, making
the report understate the population without any signal. Consider deriving the count via a `group by` or at
least asserting `sum(porEstado) === total voto count`.

### IN-03: Fake R2Store idempotency test diverges from real key shape (masks WR-03)

**File:** `packages/votos/src/run-camara-votos.test.ts:284-297`

**Issue:** `FakeR2Store.putImmutable` computes `existed` from `this.seen.has(sha)` — keyed on `sha` only,
ignoring `source/resource/date`. The real `R2Store` keys on the full path including the calendar date. The
test therefore cannot catch WR-03. Align the fake's dedup key with the real key composition.

---

_Reviewed: 2026-07-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
