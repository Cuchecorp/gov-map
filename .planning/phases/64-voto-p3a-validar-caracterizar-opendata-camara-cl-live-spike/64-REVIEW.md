---
phase: 64-voto-p3a-validar-caracterizar-opendata-camara-cl-live-spike
reviewed: 2026-07-13T00:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/tramitacion/src/parse-camara-votacion.ts
  - packages/tramitacion/src/parse-camara-votacion.test.ts
  - packages/votos/src/spike-votacion-detalle.live.test.ts
  - packages/votos/vitest.live.config.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-07-13
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the VOTO P3a SPIKE: the Cámara vote-detail parser (`parse-camara-votacion.ts`),
its unit tests, the gated LIVE probe, and its dedicated vitest config. This is
defamation-critical code (maps government roll-calls to named legislators), so the
vote-code semantics and the `<Pareos>` re-labeling were scrutinized against the stated
stakes.

**Strengths confirmed:**
- The vote-code mapping is genuinely fail-closed: `opcionDeVoto` returns `null` for any
  unknown code + unreadable text, and the caller *skips* that row (line 257) — an
  unreadable code never becomes a real `si`/`no`/`abstencion`. Verified by test
  "fail-closed: código desconocido y texto ilegible → fila omitida".
- Code-2→abstención is mapped by CÓDIGO independent of `#text` (line 359), matching the
  LIVE confirmation and its tests.
- The LIVE probe gate is airtight (defense-in-depth): `vitest.config.ts` both `include`s
  only `*.test.ts` and explicitly `exclude`s `**/*.live.test.ts`, *and* the file wraps in
  `describe.skip` unless `VOTOS_LIVE=1`. It cannot leak into the default CI suite.
- R2 persist is truly content-addressed (`sha256Hex` in the key) and idempotent
  (`If-None-Match: *`, 412 = existed = OK) per `R2Store.putImmutable`. The probe encodes
  the XML to bytes, hashes, and persists STAGE-1 before parsing.

**Key concern:** the `<Pareos>` re-labeling (line 261) is *unconditional* — it overwrites
whatever `opcionDeVoto` returned, including a genuine `si`/`no`/`abstencion`, with no guard
that the row was `ausente`/code-4. The design intent (documented in the doc-comment and
the plan) is that it should ONLY touch rows the roster gave as `ausente`. The code does not
enforce that invariant. See CR-01.

## Critical Issues

### CR-01: `<Pareos>` re-labeling unconditionally overwrites a genuine si/no/abstención vote

**File:** `packages/tramitacion/src/parse-camara-votacion.ts:261`
**Issue:**
```ts
let opcion = opcionDeVoto(voto);
if (opcion == null) continue;
// Pareo derivado de <Pareos>: re-etiqueta la fila (que el roster dio como "ausente" por
// código 4) a "pareo". Solo sobre filas YA presentes; nunca inventa una fila (VOTO-04).
if (pareados.has(diputadoId)) opcion = "pareo";
```
The doc-comment (lines 208-210) and the commit message both state the contract explicitly:
"RE-ETIQUETA a 'pareo' las filas del roster que ya existen para esos DIPID (**sobrescribiendo
el 'ausente' que el código 4 habría dado**)" and "pareo ≠ ausente (VOTO-04)". But the code
overwrites *unconditionally* — it does not check that `opcion === "ausente"` before flipping
to `"pareo"`.

This is the single most defamation-dangerous line in the phase. If any DIPID ever appears in
the `<Pareos>` sibling block AND simultaneously carries a nominal `<Opcion Codigo>` of 0/1/2
in `<Votos>` (a source-side inconsistency, a diputado listed in a pareo who nonetheless cast
a recorded vote, or a future WS shape change), this code silently rewrites a real
`si`/`no`/`abstencion` into `pareo`. That is a verifiable-as-false attribution: "voted YES"
becomes "was paired," which is exactly the misattribution class the phase is meant to prevent.

The current tests do not catch this because the fixture happens to list every pareado as
code-4 "No Vota". Reliance on that source-side coincidence is not fail-closed — the parser
must enforce its own stated invariant.

**Fix:** Guard the flip so it only fires when the roster row was actually `ausente`, and make
a nominal-vote collision loud rather than silent:
```ts
if (pareados.has(diputadoId)) {
  if (opcion === "ausente") {
    opcion = "pareo";
  } else {
    // Contract violation (VOTO-04): a DIPID in <Pareos> also carries a nominal vote.
    // NEVER silently overwrite a real si/no/abstencion. Fail loud so it is investigated,
    // not attributed.
    throw new Error(
      `pareo/voto conflict DIPID=${diputadoId}: en <Pareos> pero roster dio "${opcion}" ` +
        `(no "ausente") — no se re-etiqueta a pareo (VOTO-04, defamation-critical)`,
    );
  }
}
```
(If a throw is too aggressive for the pipeline, at minimum keep the genuine vote and emit a
loud `console.error`/metric — but do NOT overwrite it.)

## Warnings

### WR-01: Duplicate DIPID rows in `<Votos>` are not deduplicated — cross-check can be defeated

**File:** `packages/tramitacion/src/parse-camara-votacion.ts:247-271`
**Issue:** The loop over `<Voto>` pushes one output row per element with no dedup by
`diputadoId`. If the source ever emits the same diputado twice (e.g. a correction row), the
roster produces two rows for one person. The Σ(roster)==Total* cross-check counts *rows*, so
two rows for one diputado inflates a bucket count while the header total counts the person
once — a genuine double-attribution that the cross-check would flag as a mismatch (good) but
that has no explicit handling. For a defamation-critical roster, the same person mapped to two
different opciones is a silent contradiction.
**Fix:** Dedup by `diputadoId` (last-write or first-write, documented), or assert uniqueness
and throw on a repeated DIPID within a single votación so a double row is loud, not merged.

### WR-02: `caracterizarVotacionDetalle` reads only the first `<Votacion>`; `parseCamaraVotoDetalle` reads all

**File:** `packages/tramitacion/src/parse-camara-votacion.ts:293-300` vs `214-221`
**Issue:** The header helper takes `[...][0]` (first votación) while the roster parser
iterates every `<Votacion>`. In the LIVE probe the two are compared against the same
single-votación XML, so today they agree. But if a detalle response ever carries more than one
`<Votacion>`, the cross-check compares the *first* header against the *summed* roster of ALL
votaciones — a false mismatch (or, worse, a false pass if counts happen to align). The
cross-check is the safety net for this whole phase; an asymmetric read weakens it.
**Fix:** Make both operate on the same scope. Either assert the detalle XML contains exactly
one `<Votacion>` (throw otherwise), or have `caracterizarVotacionDetalle` return per-votación
headers keyed by id and cross-check id-by-id.

### WR-03: LIVE-probe `loadEnv` regex silently drops values containing `=`; malformed `.env` fails opaquely

**File:** `packages/votos/src/spike-votacion-detalle.live.test.ts:39-47`
**Issue:** `line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)` captures everything after the first
`=` into group 2, which is correct for values with `=`, but a value that legitimately contains
a leading/trailing quote-mix or an endpoint with query params is only trimmed of one outer
quote pair (`replace(/^['"]|['"]$/g, "")`) — an unmatched quote pair leaves a stray quote in
`R2_ENDPOINT_URL`, which then produces an opaque signing/fetch failure rather than a clear
"bad env" message. Lower stakes (probe-only), but the probe presents itself as "falla RUIDOSO"
on missing creds while a *malformed* cred fails silently downstream.
**Fix:** After the missing-key check, validate the shape of `R2_ENDPOINT_URL` (starts with
`https://`, `new URL()` parses) and fail loud with a clear message before constructing
`R2Store`.

## Info

### IN-01: Cross-check regex in the test can match nested/attributed tags

**File:** `packages/tramitacion/src/parse-camara-votacion.test.ts:210-214`
**Issue:** `totalHeader` uses `new RegExp('<'+tag+'>\\s*(\\d+)\\s*</'+tag+'>')`. It returns the
*first* match in document order. If the header total tag ever appears with attributes
(`<TotalNegativos xsi:nil="true"/>`) or a same-prefixed sibling exists, the regex silently
misses or mis-binds. This is test-only (the production header read is `intOf` via
fast-xml-parser), but the test's whole purpose is to be the loud tripwire — a brittle regex
undermines that.
**Fix:** Read the header with the same `caracterizarVotacionDetalle` parser used by the LIVE
probe rather than a hand-rolled regex, so the test and the production path share one reader.

### IN-02: `total_pareo` on the detalle path reads `TotalPareo`, but the real fixture has no such tag

**File:** `packages/tramitacion/src/parse-camara-votacion.ts:135, 182`
**Issue:** `totalesDesdeDetalle` sets `pareo: intOf(v.TotalPareo)`, but the LIVE real fixture
carries pareos only in the `<Pareos>` sibling block (5 pares = 10 diputados) with no
`<TotalPareo>` header tag, so `total_pareo` resolves to 0 while the roster yields 10 pareo
rows. Not a per-vote attribution bug (pareo is counted apart from the nominal cross-check),
but the persisted `Votacion.total_pareo` will read 0 despite 10 paired diputados — a
misleading aggregate for a ficha. Worth reconciling `total_pareo` against
`caracterizarVotacionDetalle().pareados.length` when the header tag is absent.

### IN-03: `console.log` used for LIVE-probe observability

**File:** `packages/votos/src/spike-votacion-detalle.live.test.ts` (multiple)
**Issue:** The HUNT/observability output uses `console.log`. Acceptable for a deliberate,
gated, hand-run probe (this is the intended reporting surface), but noted for completeness per
the debug-artifact scan. No change required.

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
