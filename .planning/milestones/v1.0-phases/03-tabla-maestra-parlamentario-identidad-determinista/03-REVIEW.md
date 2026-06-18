---
phase: 03-tabla-maestra-parlamentario-identidad-determinista
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/identity/src/deterministic.ts
  - packages/identity/src/parse-senado.ts
  - packages/identity/src/parse-camara.ts
  - packages/identity/src/seeder.ts
  - packages/identity/src/backup.ts
  - packages/identity/src/writer-supabase.ts
  - packages/identity/src/writer-fs.ts
  - packages/identity/src/seed-cli.ts
  - packages/identity/src/index.ts
  - supabase/migrations/0005_parlamentario.sql
  - .github/workflows/backup-parlamentario.yml
  - packages/core/src/nombre.ts
  - packages/core/src/parlamentario.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: fixed
fixed_at: 2026-06-18
fixed:
  critical: 3
  warning: 6
  info: 3
deferred:
  info: 1   # IN-04 (RUT mod-11): utilidad isRutValido añadida + testeada, no cableada al matcher (catálogos sin RUT esta fase)
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 13 (11 in scope + 2 cross-referenced dependencies in @obs/core)
**Status:** issues_found

## Summary

The identity master-table subsystem is well-architected for its existential-risk
mandate: `matchDeterminista` is genuinely fail-closed (every confirm branch requires
`=== 1`), the seeder never auto-confirms, the migration enables RLS deny-by-default,
and `writer-supabase` uses the PostgREST query builder (no raw SQL interpolation, so
no SQL injection surface). Backup determinism and `--preserve-estado` are correctly
designed in principle.

However, the review surfaced three Critical defects that break the core guarantees:

1. **`promoteToConfirmado` promotes far more rows than the reviewed batch** — it
   filters by `parlid_senado` / `id_diputado_camara` IN-lists but ignores `estado`,
   `periodo`, and any per-row promotion decision. A `--promote` run blanket-confirms
   every current row, and `seed-cli` then force-writes `estado="confirmado"` onto the
   *entire in-memory maestra* regardless of what the DB update actually touched. This
   defeats the human-gate (ID-01): a homonym left `no_confirmado` by the matcher gets
   published as `confirmado`.
2. **Invalid / malformed militancia dates silently become "vigente"** — `new Date()`
   on a malformed `FechaInicio`/`FechaTermino` yields `Invalid Date`, whose comparisons
   are always `false`, so the date-range guard can misclassify which party is current,
   producing a wrong party assignment (the exact T-03 risk called out for Cámara).
3. **`id` fallback `"?"` collapses distinct rows to one `id`** — when `PARLID` / `Id`
   is missing, every such row gets `id="S?"` / `"D?"`, which then collide on the upsert
   primary key and cause data loss (silent overwrite of one parliamentarian by another).

Warnings cover a false-unique-match risk in name normalization, the `--r2` flag the
workflow passes but the CLI never parses (R2 backup leg is dead), `preserveEstado`
losing a human `confirmado` whenever the catalog rotates the natural-key id, and a
few robustness gaps in the parsers.

---

## Critical Issues

### CR-01: `promoteToConfirmado` confirms unreviewed rows; `--promote` then force-confirms the entire maestra

> **RESOLVED (3c85d91, fb2e8fb).** Promotion is now PRINCIPLED. `promoteToConfirmado(ids)`
> takes an explicit allow-list and updates by the stable PK `id` only (empty list = no-op,
> never "promote all"). seed-cli builds that allow-list from two explicit sources:
> (a) `vigentesDeCatalogo` — the seed-from-authoritative-vigentes-catalog rule (every row whose
> `origen` is `senado`/`diputados` is a confirmed current member by definition), and
> (b) matcher-confirmed ids from `reconciliarMaestra` (only `Resolution.estado === "confirmado"`;
> homónimo/no_confirmado never enter). The blanket `for (row) row.estado = "confirmado"` is gone —
> only allow-listed ids are set in memory. Covered by writer-supabase.test.ts + seeder.test.ts.

**File:** `packages/identity/src/writer-supabase.ts:83-115` and `packages/identity/src/seed-cli.ts:148-155`

**Issue:** This is the #1 existential-risk path — auto-promoting an ambiguous/homonym
match to `confirmado`.

1. `promoteToConfirmado` builds `senadoIds` / `camaraIds` from *all* rows passed in and
   runs `UPDATE ... SET estado='confirmado' WHERE parlid_senado IN (...)` with **no
   filter on the matcher result**. It promotes every row in the batch, including rows
   the fail-closed matcher left `no_confirmado` (homonyms, sin-candidato). The matcher's
   `Resolution` is never consulted here — `seeder.ts:88-99` even discards the
   `matchDeterminista` return value entirely.
2. Worse, `seed-cli.ts:150-151` then does `for (const row of maestra) row.estado =
   "confirmado";` — it overwrites the in-memory estado of **every** row unconditionally,
   independent of how many rows the DB `UPDATE` actually matched. The snapshot exported
   to git therefore marks the entire maestra `confirmado`, including homonyms.

The human gate (ID-01) is supposed to confirm *specific* reviewed identities. As written,
a single `--promote` invocation publishes every current parliamentarian as a confirmed
identity — exactly the false-credible-claim failure the subsystem exists to prevent.

**Fix:** Promotion must be scoped to the rows a human actually approved AND must respect
the matcher. Pass only confirmed-by-review ids, and never blanket-write estado:
```ts
// writer-supabase.ts — only promote rows whose matcher Resolution was 'confirmado'
async promoteToConfirmado(rows: Parlamentario[]) {
  const promovibles = rows.filter((r) => r.estado === "confirmado"); // set by matcher, not by CLI
  // ...build ids from `promovibles` only...
}

// seed-cli.ts — do NOT force estado on the whole maestra.
// Reflect only the rows the matcher confirmed; leave the rest no_confirmado.
```
At minimum, gate the loop: only set `confirmado` on rows the matcher returned
`confirmado` for, and have `--promote` accept an explicit allow-list of ids from the
operator rather than promoting the full live batch.

### CR-02: Malformed militancia dates become "vigente" → wrong party assignment

> **RESOLVED (cb52da9).** `parseFecha` now fails closed: an unparseable date throws
> `FechaInvalidaError` (never returns an `Invalid Date` that silently passes range checks).
> `parseCamara` catches it per-diputado, sets `partido=null`, and logs — one bad date no longer
> picks a wrong (former) party nor kills the whole run. Tested in parse-camara.test.ts.

**File:** `packages/identity/src/parse-camara.ts:59-84`

**Issue:** `partidoVigente` parses dates with `new Date(String(...))`. An unparseable
date string yields `Invalid Date`, and **every** comparison against `Invalid Date`
(`<=`, `>=`) returns `false`. Trace:
- A militancia with a malformed `FechaInicio` → `ini = Invalid Date` → `ini <= corte`
  is `false` → `tras = (ini == null || false) = false` → that militancia is skipped.
- A militancia with a malformed `FechaTermino` → `fin = Invalid Date` → `fin >= corte`
  is `false` → `antes = false` → skipped, even if it is the genuinely current party.

So a malformed date on the *correct* current militancia silently drops it, and
`.find()` falls through to the next range-satisfying (possibly *former*) party — a
wrong party assignment with no error. The header comment claims robustness against
Pitfall 5 but the failure mode is silent misclassification, not a throw.

**Fix:** Validate parsed dates and fail closed (party = null) on any unparseable date
rather than silently treating it as out-of-range:
```ts
function parseFecha(v: string | null | undefined): Date | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`militancia: fecha inválida "${s}"`); // fail-closed, no silent guess
  }
  return d;
}
```
Apply to both `FechaInicio` and `fechaTerminoOf`. If a throw is too strict for the
seeder, return `null` party for that diputado and log it, but never let an invalid
date silently pick a different party.

### CR-03: Missing PARLID/Id collapses rows to a single `id` and overwrites on upsert

> **RESOLVED (cb52da9).** A row without `PARLID`/`Id` now throws (`senador sin PARLID` /
> `diputado sin Id`) — the `"S?"`/`"D?"` fallback is gone, so no two keyless rows can collide on
> the upsert PK. Tested in parse-senado.test.ts / parse-camara.test.ts.

**File:** `packages/identity/src/parse-senado.ts:85` and `packages/identity/src/parse-camara.ts:135`

**Issue:** `id: \`S${str(s.PARLID) ?? "?"}\`` (and `\`D${str(d.Id) ?? "?"}\``). When the
catalog omits or empties `PARLID`/`Id`, `str(...)` returns `null` and the id becomes the
constant `"S?"` / `"D?"`. Two such rows produce **identical ids**. Because the
Supabase writer upserts on the primary key `id` (`writer-supabase.ts:72`,
`onConflict:"id"`), the second `"S?"` row silently overwrites the first — data loss,
and a row whose `parlid_senado` is null also escapes the partial unique index
(`migration 0005:45-50` only enforces uniqueness `where parlid_senado is not null`),
so nothing in the DB catches the collision either. The id is also nonsensical
(`"S?"`), violating the "id derived from a stable natural key" invariant the writer's
header depends on for idempotency.

**Fix:** A row without a natural key cannot have a stable id and must not be seeded.
Fail closed:
```ts
const parlid = str(s.PARLID);
if (parlid == null) {
  throw new Error("senador sin PARLID — no se puede derivar id estable");
}
const row: Parlamentario = { id: `S${parlid}`, /* ... */ parlid_senado: parlid, /* ... */ };
```
Same for `parse-camara.ts` with `d.Id`. Skipping (with a logged warning) is also
acceptable, but emitting an id of `"S?"` is not.

---

## Warnings

### WR-01: Name normalization drops apellido materno from the key → false unique-match risk

> **RESOLVED (3c85d91).** `normalizarNombre` now also emits `clave_estricta` (paterno + materno +
> nombres). `matchDeterminista` uses it as a tiebreak: when the materno-less `nombre_normalizado`
> yields 2+ candidates AND the mention + all candidates expose `clave_estricta`, it refines by the
> strict key. This can only confirm FEWER (never more) — true homonyms (same strict key) and any
> candidate missing the strict key stay fail-closed. The materno-less key is preserved for
> cross-source (votación) convergence in Phase 4. Tested in nombre.test.ts + deterministic.test.ts.

**File:** `packages/core/src/nombre.ts:55-93` (consumed by `parse-senado.ts:78`, `parse-camara.ts:128`)

**Issue:** `nombre_normalizado` is built from paterno + nombres only (materno is captured
as alias, line 90-93). This is deliberate (catalog↔votación convergence), but it widens
the collision surface for `matchDeterminista`'s `porNombre.length === 1` confirm branch
(`deterministic.ts:64`). Two distinct people sharing paterno + given names but differing
only in materno (common in Chile, e.g. "Juan Pérez González" vs "Juan Pérez Soto") collapse
to the same `nombre_normalizado`. Within the same (cámara, periodo) that yields
`length === 2` → fail-closed `homonimo` (safe). But the danger is the inverse: if one of
the pair is filtered out upstream (e.g. CR-03 drops a row, or a parse error), the survivor
becomes a *false unique match* and is eligible for confirmation under a name that is not
uniquely his. The matcher cannot see the materno that would distinguish them.

**Fix:** For the master-table self-match the materno IS available — use a stricter key
(paterno + materno + nombres) for the catalog-internal uniqueness check, reserving the
materno-less key only for cross-source (votación) reconciliation in Phase 4. At minimum,
document that confirm-by-nombre is only sound while both homonyms are present in the batch.

### WR-02: Workflow passes `--r2` but the CLI never parses it — R2 backup leg is dead, and the env secrets are wired to a no-op

> **RESOLVED (fb2e8fb, 963ad88).** seed-cli now parses `--r2` and threads `r2Enabled` through
> `exportMaestra`. `buildR2Target()` constructs the R2 target from env ONLY if all 4 credentials
> are present, else returns null and logs an explicit no-op (R2 gated on credential presence, so
> the leg is never masked as functional when it isn't). Tested in seed-cli.test.ts.

**File:** `.github/workflows/backup-parlamentario.yml:78` and `packages/identity/src/seed-cli.ts:182,200-207`

**Issue:** The workflow's gated R2 step runs `seed:live -- --preserve-estado --r2`, but
`seed-cli.ts` only parses `--promote` and `--preserve-estado` (lines 205-206) and
hardcodes `exportMaestra(..., { r2Enabled: false })` (line 182). The `--r2` flag is
silently ignored, so even when R2 secrets are present the snapshot is never uploaded to
R2 — the second ID-09 destination never closes. The step "succeeds" while doing nothing,
which is worse than failing: it gives false confidence that the R2 backup leg works.

**Fix:** Parse `--r2` and thread it through:
```ts
const r2 = process.argv.includes("--r2");
// ...
const res = await exportMaestra(maestra, {
  writer: fsWriter,
  r2Enabled: r2,
  r2: r2 ? buildR2Target() : undefined,
});
```
Until R2 is actually wired, remove the `--r2` invocation from the workflow so it does not
masquerade as functional.

### WR-03: `preserveEstado` loses a human `confirmado` whenever the natural-key id rotates

> **RESOLVED (fb2e8fb).** `readEstadoSnapshot` now builds two indices: by `id` AND by a stable
> identity signature (`camara|periodo|nombre_normalizado`). The preserve loop falls back to the
> signature when the `id` lookup misses (natural-key rotation), and logs a WARN whenever it is
> repairing a `confirmado` that a re-seed had dropped. Tested in seed-cli.test.ts.

**File:** `packages/identity/src/seed-cli.ts:166-177`

**Issue:** `--preserve-estado` merges prior estado by `row.id` (line 170-171). The id is
`S{parlid_senado}` / `D{id_diputado_camara}`. If the upstream catalog ever reissues a
parliamentarian under a different PARLID/Id (re-registration, data correction), the new
row gets a new id, `prev.get(row.id)` misses, and a previously human-`confirmado`
identity silently reverts to `no_confirmado` in the regenerated snapshot — exactly the
silent-revert the flag exists to prevent. The preservation key is too brittle to be the
sole guard for the human gate.

**Fix:** Also fall back to matching prior estado by a stable identity signature
(e.g. `camara + periodo + nombre_normalizado`) when the id lookup misses, and log any
row that drops from `confirmado` to `no_confirmado` so CI surfaces it rather than
committing the regression silently.

### WR-04: `partidoVigente` returns the FIRST range-satisfying militancia, not the most recent

> **RESOLVED (cb52da9).** `partidoVigente` now filters ALL militancias covering `corte` and picks
> the one with the latest `FechaInicio` (a militancia with no FechaInicio sorts oldest), instead of
> the first encountered — recency, not XML order, decides the party. Tested in parse-camara.test.ts.

**File:** `packages/identity/src/parse-camara.ts:75-83`

**Issue:** `.find()` returns the first militancia whose `[FechaInicio, FechaTermino]`
covers `corte`. If a diputado has overlapping militancias covering the cut date (data
entry overlap, or two open-ended `FechaTermino=nil` rows), the array order — not recency
— decides the party. XML element order is not guaranteed to be chronological, so the
assigned party can be the stale one.

**Fix:** Among all militancias covering `corte`, select the one with the latest
`FechaInicio` (deterministic tie-break), instead of the first encountered:
```ts
const candidatas = militancias.filter(cubre(corte));
const activa = candidatas.sort((a, b) => fechaInicio(b) - fechaInicio(a))[0];
```

### WR-05: `<senador>`/`<Diputado>` collapsing — a single-element catalog and a parse failure are indistinguishable

> **RESOLVED (cb52da9).** Both parsers now throw if the final parsed count is implausibly low
> (`< 10`), so a malformed/error response (HTML-with-200, renamed wrapper) fails the run instead of
> committing an empty/shrunk snapshot. Tested in parse-senado.test.ts / parse-camara.test.ts.

**File:** `packages/identity/src/parse-senado.ts:69-71` and `packages/identity/src/parse-camara.ts:111-113`

**Issue:** `[].concat(doc.senadores?.senador ?? [])` normalizes the single-vs-array shape,
which is correct, but there is no sanity check on the resulting count. If the upstream XML
shape changes (e.g. wrapper renamed, or an HTML error page returned with 200), `doc.senadores`
is `undefined`, the array is empty, and `parseSenado` returns `[]` with no error. A seeder
run that produces zero senadores then upserts nothing and exports an empty/half snapshot,
silently wiping or shrinking the maestra on the next backup commit.

**Fix:** Add a floor check (the live capture is ~50 senadores / 155 diputados). Throw if the
parsed count is implausibly low (e.g. `< 10`), so a malformed/error response fails the run
instead of committing an empty snapshot:
```ts
if (senadores.length === 0) throw new Error("parseSenado: 0 senadores — XML inesperado");
```

### WR-06: `email`/`partido` and free-text fields flow into the snapshot without length/shape bounds

> **RESOLVED (cc26744).** `ParlamentarioSeedSchema` now validates email shape (`""`/null allowed,
> any non-empty value must match an email regex) and applies `.max()` bounds to all free-text
> fields. The existing 186-row snapshot still passes the tightened schema (verified). Tested in
> parlamentario.test.ts.

**File:** `packages/core/src/parlamentario.ts:82-102` (schema) consumed by both parsers

**Issue:** `ParlamentarioSeedSchema` validates nullability but not content. `email` is
`z.string().nullable()` with no `.email()` check; `nombres`/`apellido_*` have no max length.
An upstream field stuffed with arbitrary content (e.g. a CURRICULUM blob mis-mapped, or a
hostile/garbled `EMAIL`) passes validation and lands in the committed snapshot and DB. Not a
direct injection (PostgREST parametrizes; JSON.stringify escapes), but it weakens the
"contract gate" the schema is advertised to be.

**Fix:** Tighten the schema: `email: z.string().email().nullable()`, and add reasonable
`.max()` bounds on the free-text fields so malformed source data is rejected at the gate.

---

## Info

### IN-01: `matchDeterminista` result discarded in the seeder

> **RESOLVED (3c85d91).** The dead in-loop call is removed. `reconciliarMaestra` now runs the
> matcher per row and RETURNS a `Map<id, Resolution>` audit, which seed-cli consults to gate the
> matcher-confirmed promotion source (b). The Resolution is no longer thrown away.

**File:** `packages/identity/src/seeder.ts:88-99`

**Issue:** The loop calls `matchDeterminista(...)` but ignores its return value, then
hardcodes `row.estado = "no_confirmado"`. The comment claims it "registra el resultado para
auditoría" but nothing is recorded. The call is currently a no-op (and feeds CR-01, since the
Resolution that *should* gate promotion is thrown away).

**Fix:** Either capture the Resolution into an audit log keyed by `row.id`, or remove the
dead call and document that promotion is fully deferred to the operator step.

### IN-02: `findWorkspaceRoot` fallback can silently write the snapshot to the wrong directory

> **RESOLVED (fb2e8fb).** `findWorkspaceRoot` now throws when `pnpm-workspace.yaml` is not found,
> instead of returning the package cwd — a misconfiguration fails loudly. Tested in seed-cli.test.ts.

**File:** `packages/identity/src/seed-cli.ts:38-46`

**Issue:** If `pnpm-workspace.yaml` is never found, the loop returns `start` (the package
cwd), so `exportMaestra` writes `packages/identity/supabase/seeds/...` instead of the repo
root — a snapshot in the wrong place that git would not pick up for the ID-09 commit. The
fallback masks a misconfiguration.

**Fix:** Throw on fallback rather than returning a wrong-but-plausible path, or assert the
resolved root contains the expected `supabase/seeds` ancestor.

### IN-03: Empty-catch swallows snapshot-corruption signal in `readEstadoSnapshot`

> **RESOLVED (fb2e8fb).** The empty catch now logs a WARN naming the path and the parse error, so a
> corrupt snapshot is visible in CI rather than silently degrading the human-gate preservation.
> Tested in seed-cli.test.ts.

**File:** `packages/identity/src/seed-cli.ts:72-75`

**Issue:** A corrupt committed snapshot is swallowed (`catch {}`) and treated as "preserve
nothing," which then lets `--preserve-estado` quietly drop all human confirmations on the
next run. Acceptable as designed, but the corruption is invisible.

**Fix:** Log a warning in the catch so a corrupt snapshot is visible in CI output rather than
silently degrading the human-gate preservation.

### IN-04: `normRut` does not validate RUT structure before comparison

> **DEFERRED — partial (3c85d91).** Added and tested `isRutValido` (modulo-11 DV check), exported
> for Phase 4. NOT wired into `matchDeterminista`'s RUT branch this phase: the catalogs carry no RUT
> (the branch is inactive today) and enabling it would change the semantics of existing RUT tests
> that use mod-11-invalid fixtures. The matcher documents the deferral; it is activated when RUTs
> become a real match source (InfoProbidad, Phase 4).

**File:** `packages/identity/src/deterministic.ts:37-39`

**Issue:** `normRut` strips and lowercases but does not validate the DV or structure.
Garbage like `"---"` normalizes to `""`; a mention RUT of `""` would, after the
`trim() !== ""` guard at line 48, be skipped (safe today). Low risk because catalogs carry
no RUT, but when RUTs arrive from InfoProbidad (Phase 4) an unvalidated RUT could match the
wrong record if two malformed RUTs normalize identically.

**Fix:** Add a structural RUT validity check (modulo-11 DV) before using a RUT as a match key,
and treat invalid RUTs as "no RUT" (fall through to the name branch).

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
