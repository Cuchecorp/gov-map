---
phase: 69-dinero-p5a-rut-01-backfill-a-la-maestra-checkpoint-operador
reviewed: 2026-07-14T07:20:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - app/lib/name-match-rut-guard.test.ts
  - packages/dinero/src/name-match-rut-guard.behavior.test.ts
  - packages/freshness/src/catalog.ts
  - packages/freshness/src/query-runner.ts
  - packages/freshness/src/cli.ts
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 69: Code Review Report

**Reviewed:** 2026-07-14T07:20:00Z
**Depth:** deep (cross-file: traced the full name→RUT write chain across `dinero`, `identity`, `adjudication`)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The submitted work is two things: (1) a static "guard-guardian" test that freezes the CR-01 structural cut *"a name-match never writes the maestra's RUT"*, and (2) counts-only coverage SQL for RUT presence across two maestras.

**Coverage SQL (secondary question): clean.** I confirmed every requested property. SQL is 100% static string literals with zero interpolation (`catalog.ts`), `psql` runs via `execFileSync` with argv-separated args (no shell → no injection, no dbUrl/password leak, `query-runner.ts:63`), the CLI renders only `n`/`m`/`pct` and never a `rut` string (`cli.ts` `renderCoberturaRutTabla`), and degradation is honest — `M=0 → pct null` (n/d, not fake 0%) while `0/M` with `M>0 → 0%` (`evaluate.ts:111`). Table/column names (`parlamentario.estado/.rut`, `entidad_tercero.tipo_entidad/.rut`) match the migrations. No findings there beyond one honesty caveat (WR-05).

**The guard (primary question): it works for what it names, but it is evadable, and — more importantly — it advertises a completeness it does not have.** The behavioral companion genuinely exercises `reconciliarContrato` and proves the current cut fail-closed. But the *static* guard freezes only the *current syntactic shape* of that cut. Its two detectors match (A) the literal token `revisionesRut` reaching three hardcoded writer names, and (B) `cosechas.push` domination by an `if (rutMaestra === rutNorm)`. Every finding below is a way a future refactor introduces a real name→RUT write while the guard stays green. A guard with silent false-negatives is worse than none because it converts "we froze the cut" into false confidence — and the stakes here are defamation (false financial attribution) and a PII breach.

The findings are WARNINGs, not BLOCKERs: the code *as it exists today* is correct (behavioral test proves it, and the real write sink `updateRut` is DV/provenance-gated). The defects are in the guard's **durability against the exact refactors it claims to defend against**, which is its entire reason to exist.

## Warnings

### WR-01: Guard variant (A) is defeated by one-hop aliasing of `revisionesRut` — the primary evasion surface

**File:** `app/lib/name-match-rut-guard.test.ts:178-191`
**Issue:** Detector (A) fires only when the *literal token* `revisionesRut` appears inside a writer's argument list (`/(?<![A-Za-z0-9_])revisionesRut(?![A-Za-z0-9_])/`). Any indirection breaks it. All of these route the human-review channel into a writer while the guard stays GREEN:

```ts
const cola = revisionesRut;
await runBackfillRut(cola, writer);                 // renamed binding — token gone

const filas = revisionesRut.map(toFila);
await runHarvestRut(filas, writer);                 // .map — token gone

const merged = [...cosechas, ...revisionesRut];
await runHarvestRut(merged, writer);                // spread — token gone

function escribir(rows) { return runBackfillRut(rows, writer); }
await escribir(revisionesRut);                      // helper indirection — call site not a WRITERS_RUT name
```

The guard's own JSDoc (lines 21-26, 173-177) claims it catches `runHarvestRut(map(revisionesRut), w)` — and it does, because there the token survives inside the arg string. But the moment the value passes through a `const`, a helper, or a `.map` whose result is bound to a new name, the token is gone and the detector is blind. This is a **pure text/regex matcher, not the AST detector the review prompt hypothesized** — it cannot follow data flow.

**Fix:** Acknowledge the limitation explicitly in the file header (this is the honest floor for a text guard), AND strengthen coverage by treating the behavioral companion as the load-bearing guard for data-flow: add behavioral cases that would catch an aliased write (they exercise real return values, so `cosechas.length` regressions surface regardless of how the code is spelled). Optionally, add a *type-level* gate: give `runBackfillRut`/`runHarvestRut`/`updateRut` a branded input type (`CandidatoCosechaRut & { __corroborado: true }`) that `CandidatoRevisionRut` cannot satisfy, so the compiler — not a regex — rejects the aliased path. Add a mutation self-check fixture for at least the `const alias` and `.map` forms and assert the detector's known blind spot (a `it.fails` or a documented "known gap" assertion) so the gap is visible, not silent.

### WR-02: Guard variant (B) only guards `cosechas.push` — any other way of populating `cosechas` evades it

**File:** `app/lib/name-match-rut-guard.test.ts:200-213`
**Issue:** Detector (B) scans for `cosechas.push(` and requires domination by `if (rutMaestra === rutNorm)`. But `cosechas` (the sole input to `runHarvestRut → construirFilasCosecha → runBackfillRut → writer.updateRut`, confirmed in `harvest-rut.ts:31-51`) can be filled without ever calling `.push`:

```ts
cosechas = revisionesRut.map(r => ({ parlamentarioId: r.parlamentarioId, rutHarvested: r.rutCandidato, provenance: r.provenance }));
cosechas.unshift(candidato);
cosechas[i] = candidato;
cosechas.splice(0, 0, candidato);
Array.prototype.push.apply(cosechas, revisionesRut);
return { ...base, cosechas: revisionesRut.map(toCosecha) };   // return-object key, no local `cosechas` at all
```

None contain `cosechas.push`, so (B) never runs and the guard is green while a name-only RUT flows straight to the writer. The mutation self-check (Test 5) only proves (B) catches the *one* shape it was written against (`cosechas.push` outside the `if`), reinforcing the false sense of coverage.

**Fix:** Same as WR-01 — the durable defense is behavioral + type-level, not textual. At minimum, document that (B) is a "shape freeze" of the current single `cosechas.push` and not a completeness guarantee, and add a static assertion that `reconciliar-contrato.ts` contains *exactly one* `cosechas`-mutating construct so a second write path (any spelling) trips the sanity count.

### WR-03: New writer entry points (a raw `.update({rut})` or a newly-named writer fn) are entirely invisible

**File:** `app/lib/name-match-rut-guard.test.ts:145` (`WRITERS_RUT = ["runBackfillRut", "runHarvestRut", "updateRut"]`)
**Issue:** The writer set is a hardcoded allowlist of three names. The **actual DB write sink** is a raw PostgREST call — `packages/identity/src/writer-supabase.ts:128-137`:

```ts
await this.client.from(this.table).update({ rut: fila.rut, origen: ..., fecha_captura: ..., enlace: ... }).eq("id", fila.id)
```

The guard has *no* detector for `.update({ rut: ... })`, `.upsert(... rut ...)`, or `.rpc('resolver_identidad', { ... })`. Today's sink is safe (it only receives DV+provenance-gated `FilaRutEscribir`), but if a future author adds a *second* writer — e.g. `async cosecharRutDirecto()` doing a direct `.from('parlamentario').update({ rut })`, or a new SQL RPC — the guard is structurally blind and stays green. The prompt asked whether this gap is "acknowledged/mitigated": it is **not** — the header prose asserts `cosechas` "is the ÚNICO input of `runHarvestRut/runBackfillRut/updateRut`" as if that were enforced, when the guard only enforces it for those three literal names.

**Fix:** Add a broad detector that flags any `.update(` / `.upsert(` object literal containing a `rut` key, and any `.rpc(` whose arg object contains `rut`, appearing OUTSIDE the corroboration block or outside the DV-gate (`aceptarRutBackfill`). Explicitly document in the header that the guard is an allowlist and that adding a RUT write path REQUIRES updating `WRITERS_RUT` — turn the silent gap into a checklist item.

### WR-04: Guard scope excludes `packages/adjudication` — the human-review resolution path that promotes candidates

**File:** `app/lib/name-match-rut-guard.test.ts:301-316` (scans only `DINERO_SRC` + `IDENTITY_SRC`)
**Issue:** The prompt asked whether the guard scans *all* files where a name→RUT write could originate. It does not. The `revisionesRut` candidates are enqueued via `encolarRevisionRut → writer.enqueueRevision`, and the human resolution that PROMOTES a review case (`RevisionWriter.resolverIdentidad → resolver_identidad` RPC, `packages/adjudication/src/writer-revision.ts:182-210`) lives in `@obs/adjudication`, which is **not walked**. If a refactor ever routed a `rutCandidato` into that resolution path (e.g. added `rut` to the `resolver_identidad` params or to a `vinculo`/`upsertVinculo` write), the guard would never see it. The `app` package itself is also not scanned for a name→RUT write, though that is lower risk given the frontend/pipeline decoupling.

**Fix:** Add `ADJUDICATION_SRC` (and consider `packages/cruces`, which also has a `writer-supabase.ts`) to the walked set in the tree test (line 303). If those packages are deliberately out of scope, state *why* in the header (e.g. "adjudication's jsonb candidatos/salida_modelo are RUT-free by DB minimization — 04-01/04-02") so the exclusion is a documented decision, not an oversight. The `writer-revision.ts` header already asserts minimization; the guard should either enforce it or cite it.

### WR-05: Coverage numerator labels itself "RUT DV-válido" but SQL only checks presence — over-claims validity

**File:** `packages/freshness/src/catalog.ts` (etiqueta `"con RUT DV-válido"`, senal `parl_con_rut`/`ent_con_rut`) and `cli.ts` header `"Cobertura de RUT DV-válido (RUT-01)"`
**Issue:** The numerator SQL is `rut IS NOT NULL AND rut <> ''` — a presence check, not a check-digit (módulo-11) check. The label and section header both say "DV-válido". The header prose does add the caveat that DV-validez "se resuelve en la capa de identidad", but the **column label a reader sees in the table** ("con RUT DV-válido") asserts a stronger fact than the count measures. Given this phase's entire premise is *honest* ceilings ("0% fingido ni 100%"), a label that overstates by counting malformed/garbage RUTs as "DV-válido" is a self-inflicted honesty gap: a DB with N rows of `rut='xxx'` would report "N con RUT DV-válido".

**Fix:** Rename the etiqueta to `"con RUT presente (no vacío)"` and the header to `"Cobertura de RUT presente (RUT-01)"`, keeping the existing caveat line that DV-validez is a sub-ceiling computed in the identity layer. The number stays; only the claim it makes is corrected.

## Info

### IN-01: `env["SUPABASE_DB_URL"]!` non-null assertion can crash with an unhelpful error

**File:** `packages/freshness/src/cli.ts` (`queryCoberturaRut(env["SUPABASE_DB_URL"]!)`)
**Issue:** The `!` assertion assumes `SUPABASE_DB_URL` is present. If it is missing, `psql` is invoked with `undefined` as the connection string, producing an opaque failure that the `psqlFalloLogueado` path reports as generic "auth/DNS/conexión falló" — indistinguishable from a real DB outage. (The existing corpus/voto queries share this pattern, so this is pre-existing, not new-in-phase.)
**Fix:** If not already validated upstream, guard `SUPABASE_DB_URL` once at `main()` entry with a clear message; otherwise leave as-is for consistency with the sibling queries.

### IN-02: Magic column widths duplicated across render helpers

**File:** `packages/freshness/src/cli.ts` (`const cols = { senal: 36, n: 8, m: 9, pct: 6 }` in `renderCoberturaRutTabla`)
**Issue:** Layout constants are re-declared inline, mirroring `renderCoberturaVoto`. Minor duplication; a drift between the two tables' widths would only be a cosmetic misalignment.
**Fix:** Optional — hoist shared column widths to a module constant if these tables are meant to stay visually aligned.

---

## Cross-check against structural claims

No `<structural_findings>` block was provided; the above are all narrative findings from direct code review. I verified the guard's two mutation self-checks (Test 5) do bite the two obvious breaks (confirming the verifier's prior result), and independently constructed the evasion fixtures in WR-01/WR-02 against the detector's actual regex/brace-balance logic to confirm they slip through.

---

_Reviewed: 2026-07-14T07:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
