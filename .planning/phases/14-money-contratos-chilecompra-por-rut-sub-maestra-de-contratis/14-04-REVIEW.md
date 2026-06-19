---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
reviewed: 2026-06-19T18:05:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/dinero/src/reconciliar-contrato.ts
  - packages/dinero/src/reconciliar-contrato.test.ts
  - packages/dinero/src/harvest-rut.ts
  - packages/dinero/src/harvest-rut.test.ts
  - packages/dinero/src/index.ts
  - packages/dinero/src/ingest-run.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
resolution:
  fixed_at: 2026-06-19
  fix_commit: 699f5b9
  critical_resolved: 1
  warning_resolved: 4
  info_resolved: 0
  note: >-
    CR-01 + WR-01..04 resolved in commit 699f5b9 (one atomic change to the
    harvest code path). Info items left as-is per scope (critical+warning only),
    though IN-03's namesake-collision test was added as part of the CR-01 fix.
    CR-01 is a logic/design change — human verification of the routing intent
    recommended.
---

# Phase 14 (plan 04): Code Review Report

**Reviewed:** 2026-06-19T18:05:00Z
**Depth:** standard (adversarial on the identity-master write path)
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The retrofit is well-engineered against most of the stated hard rules. I verified, by tracing through the called primitives (`matchDeterminista`, `confirmar`, `isRutValido`, `correrPipeline` + its internal `assertNoRutInLlmInput`, and `runBackfillRut`/`aceptarRutBackfill`), that:

- **Data-routing gate (rule 2) holds.** Only `proveedorNombre` builds the `MencionForanea`; no RUT field is routed. Inside `correrPipeline` the `Mention` is built without `rut` (pipeline.ts:95-99), so even a dirty RUT in the master cannot confirm-by-RUT there, and `assertNoRutInLlmInput` re-checks the exact prompt string (pipeline.ts:152). The DATA-ROUTING test asserts the RUT (formatted and stripped) is absent from `vinculos`, `colas`, and every prompt. Confirmed sound.
- **Persona jurídica unchanged (rule 3).** Step 3 (reconciliar-contrato.ts:215) routes `tipoPersona !== "natural"` straight to `no_confirmado` without touching `correrPipeline`; the test asserts `prompts.length === 0`. The RUT-exact deterministic path is intact for all types and the original Phase 14 RUT-exact tests are unchanged and green.
- **IDENT-12 (rule 4) holds.** The FK is only minted via `confirmar()` on `metodo === "rut"` (step 2) or `pres.tipo === "determinista"` (step 3). `EnlaceConfirmado` is nominally branded with a single legitimate constructor; a raw string cannot populate the FK. Ambiguous → null.
- **Harvest fail-closed plumbing (rule 1) holds at the writer layer.** `runHarvestRut` delegates to `runBackfillRut`, which re-applies the DV-gate and provenance-NOT-NULL check; DV-invalid or empty-provenance rows are rejected to a log and never reach `updateRut`. Tests cover both rejections. Remote write is gated as an operator checkpoint.

The whole package test suite passes (15/15 on the two retrofit files; summary reports 82/82 package-wide).

**However**, the central safety claim of rule 1 / rule 5 — that a confirmed persona-natural name match licenses harvesting `rutProveedor` into the politician's master `rut` — rests on an inference the code does not actually establish, and this is a genuine data-integrity defect against the master identity table. See CR-01. Four warnings and three info items follow.

## Critical Issues

### CR-01: A unique-name match is treated as proof the contractor's RUT IS the politician's RUT — the harvest can write a wrong RUT to the identity master

> **RESOLVED** in commit `699f5b9` (2026-06-19). The name-only harvest path no longer auto-writes the master. The determinista branch now splits into (a) a CORROBORACION channel that emits `CandidatoCosechaRut` ONLY when the master already holds a `rut == normRut(rutProveedor)` (no-op confirmation, never a new RUT — and in the common single-owner case the step-2 RUT-exact match already confirms first), and (b) a REVISION HUMANA channel where a name-derived RUT becomes a `CandidatoRevisionRut` enqueued to the pipeline human-review queue (`enqueueRevision`); a human must confirm the name↔RUT binding before any master write. It is now structurally impossible for the name-only path to reach `runBackfillRut`/`updateRut`. New tests assert: name-only match → review candidate + no cosecha + no master mutation; namesake-collision (RUT differs from master) → no master mutation (rule-5). 84/84 dinero tests green; `tsc -b` clean for `@obs/dinero`. NOTE: this is a logic/design change — human verification of the routing intent is recommended.

**File:** `packages/dinero/src/reconciliar-contrato.ts:248-266` (harvest emission), confirmed against `packages/identity/src/backfill-rut.ts:5-11` and `packages/identity/src/deterministic.ts:107-118`

**Issue:**
The harvest fires whenever `correrPipeline` returns `pres.tipo === "determinista"`. Tracing that branch into the pipeline (`pipeline.ts:100-118`), a `determinista` result for a name-keyed mención means exactly one thing: `matchDeterminista` found that the **contractor's name is unique within (cámara, periodo)** against the master. It establishes a unique *name* coincidence — nothing more. The code then writes `c.rutProveedor` (the ChileCompra contractor's RUT) into that politician's master `rut` field, asserting in comments "el `rutProveedor` DV-valido de ChileCompra ES el RUT del parlamentario enlazado" (reconciliar-contrato.ts:2-4, 91-94).

That equality does not follow from a name match. The DV check (`isRutValido`) only proves the RUT is *structurally well-formed* (módulo-11) — it does not prove ownership. The very primitive this path reuses warns about precisely this: `backfill-rut.ts:8-10` documents Track A (a RUT matched by NAME) as "frágil; un RUT matcheado por NOMBRE es un CANDIDATO, no un HECHO." Here the inference runs the *other* direction (name-match the contractor, then adopt the contractor's RUT as fact for the politician), which is strictly weaker, yet it is promoted directly to a master mutation with `metodo` semantics of "determinista."

Concrete failure: a private contractor who is a genuine homonym-free namesake of a senator (a different person who happens to share `nombre_normalizado` and is the only such name in that cámara+periodo) produces `tipo: "determinista"`, an `EnlaceConfirmado` FK, **and** a `CandidatoCosechaRut` that writes the *private contractor's* RUT onto the *senator's* master record. The DV gate passes (the contractor's RUT is real), provenance is present, so `runBackfillRut` accepts and `updateRut` overwrites the senator's `rut`. This is silent identity-data corruption of the master table — the highest-trust artifact in the system (CLAUDE.md: "tabla maestra de identidades respaldada fuera de Supabase sí o sí"), and it directly contradicts rule 5 ("a non-matching private persona-natural contractor produces NO master mutation").

Note the asymmetry vs. RUT-exact (step 2): there, the RUT *already* lives in the master and the match is on the strong key, so "no hay nada que cosechar" — correctly no harvest. The fallback path inverts the evidence strength (weak key: name) but raises the consequence (writing the hard key: RUT). The branded-FK link (`enlace`) being wrong is recoverable via the human queue; a wrong *RUT written to the master* is a hard-key corruption that subsequent RUT-exact matching will then treat as ground truth, propagating the error.

The operator checkpoint (Task 4) mitigates *blast radius* (no remote write until operator runs it) but does not fix the logic: the candidate set handed to the operator already contains wrong-RUT rows that pass every automated gate, and the operator is told to verify "cada fila escrita corresponde a un enlace persona-natural CONFIRMADO" — which every one of these wrong rows is, by construction. The gate the operator is given cannot distinguish a true harvest from a namesake collision.

**Fix:**
Do not let a name-only `determinista` license a RUT harvest. The harvest must require corroboration that ties the *RUT* (not just the name) to the politician. Minimum viable options, in order of preference:

1. Only harvest when the politician row already carries a RUT and it **equals** `normRut(c.rutProveedor)` — i.e. harvest becomes a no-op confirmation, never a source of new RUTs (this is the only path where the equality is actually established). New RUTs for empty-`rut` rows must come from Track B (curated seed) per `backfill-rut.ts:10-11`, not from a name-keyed contractor match.
2. Or route every name-match-derived RUT candidate to the **human review queue** (not to `runBackfillRut`'s auto-accept path), so a person adjudicates the name↔RUT binding before any master write. Treat it as Track A "candidate," matching the documented trust level.

```ts
// In the determinista branch — gate the harvest on RUT corroboration, not name uniqueness:
case "determinista": {
  enlace = confirmar(pres.parlamentarioId, "determinista");
  estadoVinculo = "confirmado";
  confirmados.add(pres.parlamentarioId);
  const pol = maestra.find((p) => p.id === pres.parlamentarioId);
  const yaTieneRut = pol?.rut != null && pol.rut.trim() !== "";
  // Harvest ONLY confirms an already-present RUT; it NEVER mints a new master RUT
  // from a name-only match (a namesake contractor must not overwrite the master).
  if (yaTieneRut && isRutValido(c.rutProveedor) && normRut(pol!.rut!) === normRut(c.rutProveedor)) {
    cosechas.push({ /* ...as today... */ });
  }
  // else: name match stands as the FK link, but NO RUT is harvested → Track B / human queue.
  break;
}
```

If product intent really is to adopt new RUTs from name matches (the "finalidad del dato" framing), that must be an explicit human-adjudicated step, not an auto-emitted candidate that flows into the backfill writer.

## Warnings

### WR-01: Harvest is emitted with no cámara/periodo corroboration and a senado-only default blocking

> **RESOLVED** in commit `699f5b9`. Before proposing any RUT (corroboration or review candidate), the determinista branch now requires the matched `nombre_normalizado` to be unique across the ENTIRE master (`maestra.filter(p => p.nombre_normalizado === nombre_normalizado).length === 1`), not just within the blocking window. A name that collides with a parlamentario outside the blocking window (e.g. a diputado when blocking on senado) retains the name-confirmed link but proposes NO RUT (neither cosecha nor review).

**File:** `packages/dinero/src/reconciliar-contrato.ts:50-53, 173-176, 224-235`

**Issue:** The default blocking is `senado` / `senado-vigente-2026` (PERIODO/CAMARA_DINERO_DEFAULT). The name match — and therefore the harvest — is scoped to whatever single cámara+periodo the caller passes (one value, not both chambers). A contractor whose name is unique among *senators* but collides with a *diputado* of the same name will still confirm-and-harvest against the senator, because diputados are outside the blocking window. This widens CR-01's namesake-collision surface and means uniqueness is only ever asserted within one chamber, never globally. Even independent of CR-01, the harvest should at minimum require global name-uniqueness across the full master, not per-blocking-window uniqueness.

**Fix:** Before emitting a harvest candidate, verify the matched name is unique across the *entire* master (both cámaras, all live periods), not just within the blocking window; otherwise withhold the harvest and route to human review.

### WR-02: Provenance `origen` is a terse label, not the descriptive provenance the threat model requires

> **RESOLVED** in commit `699f5b9`. `origen` now encodes the trust level: `harvest:chilecompra-persona-natural:rut-corroborado` for the corroboration channel vs `harvest:chilecompra-persona-natural:rut-name-only-pendiente-humano` for the review candidate. The distinction CR-01 turns on (name-only vs rut-corroborated) now travels with the data, not only in a code comment, so a downstream auditor can flag the trust level.

**File:** `packages/dinero/src/reconciliar-contrato.ts:159, 256-263`; required by `14-04-PLAN.md:158, 234, 278`

**Issue:** The plan and threat model (T-14-24) require each harvested row to carry provenance reading "harvested from ChileCompra confirmed persona-natural match" plus source/date, so an operator/auditor can later tell *how* a master RUT was obtained. The code writes `origen: "harvest:chilecompra-persona-natural"` (ORIGEN_COSECHA) and `enlace: c.enlace`. `aceptarRutBackfill` only checks non-empty strings, so this passes the NOT-NULL gate, but it does not record the confirmation method or that the RUT came from a *name-only* match (the exact distinction CR-01 turns on). The "confirmed match" semantics live only in a code comment, not in the stored provenance.

**Fix:** Make `origen` (or an added provenance field) explicitly encode "harvested-via-name-match" vs "harvested-via-rut-exact" and include the contract/order id, so the trust level travels with the data. This is also what lets a downstream auditor flag CR-01-class rows.

### WR-03: `fecha_captura` / `enlace` from the contract are forwarded into harvest provenance without non-empty validation at emission

> **RESOLVED** in commit `699f5b9`. A `provenanceCompleta(c)` gate (mirroring `aceptarRutBackfill`'s NOT-NULL semantics) now runs at emission for BOTH channels: a candidate with empty `enlace`/`fecha_captura` is not emitted, so a legitimate harvest is no longer silently dropped downstream and conflated with a malformed-RUT rejection.

**File:** `packages/dinero/src/reconciliar-contrato.ts:259-263`

**Issue:** `provenance.fecha_captura = c.fecha_captura` and `provenance.enlace = c.enlace` are taken straight from the contract. If either is empty (the `Contrato` zod schema allows `enlace`/`fecha_captura` to be any string, including `""` — model.ts:21-30 uses bare `z.string()`), the candidate is emitted, then silently *rejected* downstream by `aceptarRutBackfill` as `provenance-faltante`. A genuine confirmed harvest would be dropped to the reject log with no signal that it was a data-completeness problem rather than a security rejection, conflating two very different reject reasons in one log. Fail-closed is preserved (nothing wrong is written), but a legitimate harvest is lost silently.

**Fix:** Validate provenance completeness at emission (or assert the contract carries non-empty `enlace`/`fecha_captura` upstream in `parseContratos`), so a dropped harvest is distinguishable from a malformed-RUT rejection.

### WR-04: Defensive `isRutValido` re-check at line 255 is structurally dead and masks the real (missing) guard

> **RESOLVED** in commit `699f5b9`. The silent `if (isRutValido(...))` no-op is removed. A DV-invalid RUT reaching the determinista branch (which step 1 should have quarantined) now `throw`s as a loud invariant violation rather than silently dropping the harvest. The real guard is now ownership/human-confirmation (CR-01), not DV-validity.

**File:** `packages/dinero/src/reconciliar-contrato.ts:255`

**Issue:** The `if (isRutValido(c.rutProveedor))` guard before emitting the harvest can never be false at this point: line 192 already `continue`d on any DV-invalid RUT, and `c.rutProveedor` is not reassigned. The comment calls it "defensivo," but a permanently-true guard gives false reassurance that the harvest is gated on something meaningful when, per CR-01, the missing gate is *ownership*, not *DV-validity*. Re-validating the DV here re-checks the one property that was never in doubt while leaving the property that matters (does this RUT belong to this politician?) unchecked.

**Fix:** Replace the no-op DV re-check with the ownership/corroboration guard from CR-01. If a defensive DV assert is still wanted, make it an `assert`/throw (so a contract with a bad RUT reaching here is a loud bug), not a silent `if` that drops the harvest.

## Info

### IN-01: Two copies of `PERIODO_DINERO_DEFAULT` / `CAMARA_DINERO_DEFAULT` must stay in lockstep by hand

**File:** `packages/dinero/src/reconciliar-contrato.ts:50-53` and `packages/dinero/src/ingest-run.ts:26-27`

**Issue:** The blocking defaults are declared independently in both files; `ingest-run.ts:25` even carries a comment "DEBEN coincidir." A drift between them would silently change which cámara/periodo the harvest and the "consultado" marking key on. Export the constants from one module and import in the other.

### IN-02: `EstadoVinculoContrato` doc for `"no_confirmado"` lists "(incluye ... juridica)" but the type is shared semantics only

**File:** `packages/dinero/src/reconciliar-contrato.ts:85`

**Issue:** Minor doc clarity — the comment folds IDENT-10, 0, 2+, and jurídica into one bucket. Fine functionally, but a reader cannot distinguish "company, deliberately not linked" from "natural person, ambiguous" in the stored state. Consider a distinct marker for jurídica-never-linked vs natural-ambiguous to aid downstream auditing. Not a correctness issue.

### IN-03: Harvest test coverage does not include the namesake-collision scenario

> **ADDRESSED incidentally** by commit `699f5b9` (the CR-01 fix). A namesake-collision test now asserts that a name-unique contractor whose RUT differs from the master produces NO `cosechas` (no master mutation, rule-5), plus a name-only review-candidate test. (Info items were out of the critical+warning fix scope; this one rode along with CR-01.)

**File:** `packages/dinero/src/reconciliar-contrato.test.ts:184-225`

**Issue:** The "fallback persona-natural confirmada" test confirms a harvest fires on a unique name match, but there is no test asserting the *intended* rule-5 invariant: a private contractor who is a name-unique namesake of a politician must NOT mutate the master. Because the current code cannot distinguish that case (CR-01), no test catches it. Once CR-01 is fixed, add a test where the matched politician's master `rut` is empty (or differs) and assert `cosechas` is empty.

---

## Narrative Findings (AI reviewer)

All findings above are narrative (no structural pre-pass was provided). The single Critical (CR-01) is the load-bearing one: the retrofit's data-routing, IDENT-12, jurídica, and writer-layer fail-closed properties are all correctly implemented and tested, but the harvest's core premise — name match ⇒ RUT ownership — is an unproven inference that can write a wrong hard key into the master identity table, which is exactly the over-collection / fabricated-attribution risk rules 1 and 5 exist to prevent. The operator checkpoint limits when this fires but cannot detect it.

---

_Reviewed: 2026-06-19T18:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
