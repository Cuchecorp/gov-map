---
phase: 67-voto-p3d-paridad-senado-voto-individual-por-nombre
reviewed: 2026-07-14T05:10:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - packages/tramitacion/src/ingest-run.ts
  - packages/tramitacion/src/ingest-cli.ts
  - packages/votos/src/run-camara-votos.ts
  - packages/votos/src/run-camara-votos.test.ts
  - packages/tramitacion/src/parse-senado-votacion.ts
  - packages/tramitacion/src/parse-senado-votacion.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 67: Code Review Report

**Reviewed:** 2026-07-14T05:10:00Z
**Depth:** deep (cross-file: envelope → 3 sites → runIngest step 4 → parse → reconcile → writer key)
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 67 wires the Senate raw `votaciones.php` (`votXmlSenado`) into the shared R2 envelope so `--from-r2` replay can reconstruct Senate votes, and flips `mapSeleccion` from silent-omit to fail-loud on an unknown `<SELECCION>` token. This is defamation-critical code (individual Senate vote attribution).

The four adversarial focus areas came out mostly clean:

- **Attribution (Focus 4):** SAFE. The IDENT-12 guard in `reconciliar-senado.ts` is untouched across both commits (`git diff` empty, confirmed). Only `tipo === "determinista"` (unique name) mints an `EnlaceConfirmado`; homonym/absent → `probable`/`no_confirmado` with `parlamentario_id = null`. No path lets an ambiguous name-match produce `confirmado`.
- **seq collision (Focus 4):** NOT A BUG. The voto natural key is `(votacion_id, fuente_voter_id)` and `votacion_id` already encodes `boletin:fecha:disc`. `seq:<n>` is positional *within one votación*, so it cannot double-attribute across boletines or across votaciones.
- **3-site consistency (Focus 1):** the three `fetchVotaciones()` fakes serve identical `envelope.votXmlSenado ?? ""`. No site serves Cámara's `votXml` on the Senate path.
- **Backward-compat (Focus 2):** confirmed no null/undefined deref — missing field → `?? ""` → `parseSenadoVotaciones("")` → `asArray(undefined)` → `[]`. Test H covers it.

Two WARNINGs remain: (1) the fail-loud on one bad token silently drops **every other valid Senate vote in the same boletín** from the roll-call — a strictly *larger* coverage gap than the single silent omission it replaces, on the exact surface (roll-call completeness) the change claims to protect; (2) the comment/plan claim that the fail-loud "mirrors Cámara" is false — Cámara still silently omits illegible tokens, so the two chambers now diverge, and a real LIVE Senate token variant will zero out a whole boletín while the equivalent Cámara variant would not.

## Warnings

### WR-01: Fail-loud on one unknown `<SELECCION>` token discards ALL valid Senate votes for the entire boletín

**File:** `packages/tramitacion/src/parse-senado-votacion.ts:86-89` (throw site) + `packages/tramitacion/src/ingest-run.ts:234-253` (catch scope)

**Issue:**
`mapSeleccion` now throws from inside the `.forEach` loop in `parseSenadoVotaciones` (line 211). That throw propagates out of `parseSenadoVotaciones` *before* `return out` (line 218) — so every `VotacionSenado` already accumulated in `out`, plus every valid `VOTO` in the current and subsequent votaciones, is discarded. In `runIngest` step 4 the throw is caught by the boletín-level try/catch (lines 234-253), which pushes one aggregate `errores` entry (`etapa: "senado-votaciones"`) and leaves `votosBoletin` with **zero** Senate votes for that boletín. The upsert then runs (line 371) with only Cámara votes.

Net effect: a single unrecognized token in a single `<VOTO>` deletes the *entire* Senate roll-call for that boletín from the DB. The commit message and plan (67-01-PLAN.md:88-92) justify the change as fixing a "coverage lie" where "one person who voted disappears from the roll-call" — but the fix replaces one disappeared vote with *N-1 disappeared valid votes* plus the bad one. On a defamation-critical roll-call, silently showing an incomplete Senate tally (e.g. 20 of 43 senators, because senator #21 had a novel token) is a worse and less visible failure than omitting one row: the aggregate `errores` entry does not tell a reader that the roll-call they are viewing is truncated, and the DB row for the votación (with `total_si`/`total_no`) still upserts, so the UI can render a totals bar with no individual votes behind it.

Note the asymmetry with the votación header: `parseSenadoVotaciones` still `out.push`es the `Votacion` (totals) at line 216 for votaciones parsed *before* the throw, but for the votación *containing* the bad token, the throw happens mid-forEach so neither its `Votacion` nor its votes reach `out`. Behavior is order-dependent and hard to reason about.

**Fix:** Fail loud without collateral loss — catch per-vote (or per-votación) so unknown tokens are recorded individually while valid votes survive. E.g. collect unknown-token occurrences into a returned diagnostics list instead of throwing across the whole parse:

```ts
// in parseSenadoVotaciones, per-VOTO:
let seleccion: Seleccion | null;
try {
  seleccion = mapSeleccion(txt(voto.SELECCION));
} catch (err) {
  // record the unrecognized token WITHOUT dropping the rest of the roll-call
  tokensDesconocidos.push({ mencionNombre, token: txt(voto.SELECCION) ?? "", votoSeq: idx });
  return; // this ONE vote is flagged; siblings survive
}
if (seleccion == null) return; // caso (a): vacío/ausente
votos.push({ mencionNombre, seleccion, votoSeq: idx });
```

Then surface `tokensDesconocidos` up to `runIngest.errores` (one entry per bad token, with the mención) so the signal is per-person, not per-boletín. This preserves the D-A4 intent (unknown token is VISIBLE, never silently coerced) while eliminating the whole-boletín roll-call wipe. If a hard stop is genuinely wanted, it must at minimum gate the votación's totals row too, so a totals bar is never upserted without its individual votes.

### WR-02: "Mirrors Cámara" claim is false — the two chambers now diverge on unknown-token handling

**File:** `packages/tramitacion/src/parse-senado-votacion.ts:64-75` (doc + throw) vs `packages/tramitacion/src/parse-camara-votacion.ts:370,393,395` (Cámara `opcionDeVoto`)

**Issue:**
The pre-change docstring said Senate "espeja la Cámara (`opcionDeVoto` devuelve null y el caller OMITE el voto)". After this phase, Cámara's `opcionDeVoto` still `return null` for an unknown/illegible option (parse-camara-votacion.ts:370, 393, 395), and its caller silently `continue`s (parse-camara-votacion.ts:270). Senate now *throws*. The two roll-call parsers are no longer symmetric on the same class of input (a novel option token). Because the Senate `<SELECCION>` token vocabulary is explicitly *unconfirmed at this phase* (docstring lines 73-75: "los tokens reales... no están confirmados"; STRIDE T-67-04 defers the LIVE spike to operator/Plan 02), the very first LIVE backfill is the most likely moment to hit an unrecognized-but-legitimate token — and per WR-01 that will zero a boletín's Senate roll-call, while the identical situation on the Cámara side degrades gracefully. This is a latent production hazard sitting behind an offline-green test suite that only exercises the synthetic token `"A FAVOR"`/`"1"`.

**Fix:** Resolve together with WR-01 (per-vote diagnostics, no whole-boletín loss) so both chambers degrade the same way on an unknown token. Update the docstring: it currently asserts WR-03 "espeja la Cámara" language that is no longer accurate. If the deliberate decision is that Senate must fail louder than Cámara, state that divergence explicitly and justify why the roll-call totals row is still allowed to upsert without its votes.

## Info

### IN-01: Envelope shape change forces a one-time re-upsert of every existing R2 snapshot (idempotency skip defeated once)

**File:** `packages/tramitacion/src/ingest-run.ts:290-322`

**Issue:** The R2 key is `tramitacion/{boletin}/{today}/{sha}.json` where `sha = sha256Hex(JSON.stringify(envelope))` (r2-store.ts:64, ingest-run.ts:291-292). Adding the `votXmlSenado` property changes `JSON.stringify(envelope)` → changes the sha → changes the key. So the `If-None-Match: *` → 412 (`existed=true`) skip that P66 relied on will miss on the first post-deploy run for each boletín, and Etapa 2 will re-run. This is **not** a correctness break: (a) the key already includes `today`, so keys rotate daily regardless of the schema change; (b) upserts are idempotent by natural key, so re-processing does not duplicate rows. Worth noting only so the operator expects a one-time "no skips" run after deploy. It does **not** cause a re-download of source data — this code always fetches from the source before building the envelope (there is no pre-fetch hash-check in this path), so Focus 1's "re-download" concern does not materialize here.

**Fix:** None required. Optionally document in the backfill runbook that the first run after the 67 deploy will re-write Etapa 2 for all boletines (expected, harmless).

### IN-02: `votXmlSenado` typed as `string | null` at write, but `string | null | undefined` at every read — mixed optionality

**File:** `packages/tramitacion/src/ingest-run.ts:290` vs `run-camara-votos.ts:198`, `ingest-cli.ts:232`, `run-camara-votos.test.ts:263`

**Issue:** The writer always emits `votXmlSenado: votXmlSenadoCrudo` (a `string | null`, never absent), while the three reader-side inline `Envelope` types declare it `votXmlSenado?: string | null`. The optionality only matters for pre-67 (P66) envelopes that lack the field — which is exactly the retro-compat contract and is handled by `?? ""`. This is consistent and safe, just slightly asymmetric. The `Envelope` shape is redeclared inline in four places (ingest-run, ingest-cli, run-camara-votos, and the test), so a future field addition must be synced across all four again (this phase demonstrates that maintenance cost — it touched three of the four plus a fifth site).

**Fix:** Extract a single shared `TramitacionEnvelope` type (e.g. in `@obs/tramitacion`) and import it at all read/write sites, so the envelope contract has one source of truth and future additions cannot drift between the writer and the three fake-connector consumers.

### IN-03: `mapSeleccion` prefix matching remains greedy — a real token like "No vota" maps to `no`

**File:** `packages/tramitacion/src/parse-senado-votacion.ts:81-84`

**Issue:** Not introduced by this phase, but adjacent and now load-bearing given the fail-loud policy: matching is by `startsWith`. `"No vota"` (absence) would match `v.startsWith("no")` → `no`, and `"Sin voto"`/`"Ausente"` would fall through to the throw. Because the Senate token vocabulary is unconfirmed (per the docstring's own gated-risk note), the prefix heuristic could *mis-map* a real absence token to a counted `no` (a false attributed vote) rather than throwing — the more dangerous failure mode for defamation-critical attribution. The fail-loud only fires when the prefix table misses entirely; a token that *collides* on a prefix is silently mis-classified, not thrown.

**Fix:** When the LIVE token spike (Plan 02) lands, replace prefix matching with an exact allowlist of confirmed tokens, so an unexpected `"No vota"`-style token throws (per D-A4) instead of being coerced to a counted `no`. Until then, note this residual mis-map risk in the runbook alongside the existing unknown-token risk.

---

_Reviewed: 2026-07-14T05:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
