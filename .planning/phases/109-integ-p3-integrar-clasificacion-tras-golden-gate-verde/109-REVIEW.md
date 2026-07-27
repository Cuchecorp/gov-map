---
phase: 109-integ-p3-integrar-clasificacion-tras-golden-gate-verde
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - packages/cruces/src/clasificar-fichas-cli.ts
  - packages/cruces/src/clasificar-fichas-cli.test.ts
  - packages/llm/src/provider-guard.test.ts
  - packages/llm/src/integ-scope-guard.test.ts
  - packages/cruces/src/shadow-eval.test.ts
  - packages/cruces/src/drift-canary.test.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 109: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 109 wires the `TieredProvider` (Granite→DeepSeek) escalera into the public
classification CLI (`clasificar-fichas-cli.ts`) behind an env gate, with a five-layer
safety net (provider-guard, integ-scope-guard, golden CI gate, shadow-eval, drift canary).

**All LOCKED invariants hold.** I verified each against the code and against the wider
repo (grep across the whole tree):

- **Default = incumbent, byte-identical:** `resolverProvider` returns `DeepSeekProvider`
  whenever `env.CLASIFICACION_ESCALERA !== "1"` (line 208). The `TieredProvider` is not
  even instantiated in the default path. The load-bearing Test 1 asserts both
  `toBeInstanceOf(DeepSeekProvider)` AND `not.toBeInstanceOf(TieredProvider)` — it bites
  non-vacuously (a regression that built the ladder would flip both assertions).
- **Agent did NOT promote:** `CLASIFICACION_ESCALERA=1` appears nowhere in committed
  code or CI. The only occurrence is `CLASIFICACION_ESCALERA=` (empty) in `.env.example`
  with an explicit "el agente NUNCA setea esta variable" comment. CI (`ci.yml`) sets no
  such env and adds no secrets.
- **Guards bite non-vacuously:** provider-guard enumerates the 4 real LLM providers
  (deepseek/minimax/granite/phi-judge; gemini-embeddings excluded), has a length-≥4 floor
  (Test 3) so a broken glob can't false-green, and a mutation self-check (Test 2). All 5
  provider files genuinely contain both assert strings (verified: 23 occurrences across
  5 files). integ-scope-guard asserts `clasificar-lobby-cli.ts` and `pipeline-cli.ts` do
  NOT contain `TieredProvider`, with a mutation self-check whose synthetic-source strings
  are real code literals, not comments.
- **Golden CI gate permanent:** `ci.yml` runs `@obs/llm` and `@obs/cruces` vitest suites
  offline (no secrets); the golden gate (`golden-set.test.ts`) runs with
  `MockClasificadorProvider` and the `CRUCES_GOLDEN_LIVE` block skips cleanly.
- **Shadow-eval + drift LIVE-gated:** both use `(LIVE ? describe : describe.skip)` +
  `it.skipIf(!keys)`, keyed on env vars CI never sets. Rate-limit 2.5s between calls.
  Shadow observes only (no DB persist, no productive-output change). Drift canary
  invalidates on model mismatch. No keys, tokens, or credentialed URLs are printed
  (drift prints only `baseURL` which contains the account-id, see WR-03).
- **RUT never crosses to LLM / no json_schema assumed:** `clasificar.ts` runs
  `assertNoRutInLlmInput` before any LLM call; `GraniteProvider` uses forced `tool_choice`,
  never `response_format: json_schema`.

No Critical findings. The Warnings below are robustness/quality issues that do not
violate the LOCKED invariants but should be addressed.

## Warnings

### WR-01: `createClient` can be called with empty URL in dry-run-with-key path

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:271-275`
**Issue:** In the dry-run branch, when `opts.filas === undefined && serviceKey.length > 0`,
the code builds a Supabase client with `createClient(url, serviceKey, ...)`. But `url`
is `opts.url ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL ?? ""` (line 248)
— it can be the empty string. `createClient("", key)` throws `supabaseUrl is required`
(or constructs an invalid client), turning a "just report coverage" dry-run into a hard
crash. The non-dry LIVE branch (line 278) has the identical exposure but there at least a
missing URL is a genuine misconfiguration; in dry-run the operator reasonably expects
no-DB-crash behavior. There is a fail-fast guard for a missing `--service-key` but none
for a missing URL.
**Fix:** Guard the URL before constructing the client, mirroring the service-key fail-fast:
```typescript
if (dryRun) {
  // ...
  if (opts.filas === undefined && serviceKey.length > 0) {
    if (url.length === 0) {
      log("cruces-fichas: SUPABASE_URL ausente → dry-run sin lectura DB (solo filas inyectadas)");
    } else {
      client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    }
  }
}
```
And symmetrically fail-fast in the LIVE branch: `if (url.length === 0) throw new Error(...)`.

### WR-02: Coverage denominator can silently understate the gate when abstentions cluster early

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:298,306-307`
**Issue:** `coberturaMuestra = asignadosMuestra / tamMuestra` where
`tamMuestra = Math.min(filas.length, 10)` and `asignadosMuestra` counts assignments among
the first 10 rows. This is arithmetically fine, but the sample is the *first 10 rows in
DB order* (`.limit(limite)` with no `.order()` on line 168), so the coverage number the
operator reads for the CRUCE-02 ≥70% gate is order-dependent and non-deterministic across
runs (PostgREST does not guarantee row order without `ORDER BY`). Two runs over the same
data can report different coverage. This is a gate-reporting reliability issue, not just
style.
**Fix:** Add a deterministic order to the query so the gate sample is stable:
```typescript
.select("boletin, idea_matriz, proyecto:proyecto(titulo, materia)")
.order("boletin", { ascending: true })
.limit(limite);
```

### WR-03: Drift-canary and resolver interpolate account-id into a URL that is later logged

**File:** `packages/cruces/src/drift-canary.test.ts:112-118`; `packages/cruces/src/clasificar-fichas-cli.ts:228-229`
**Issue:** `CLOUDFLARE_ACCOUNT_ID` is a tenant identifier that is embedded into `baseURL`
(`.../accounts/${accountId}/ai/v1`). The drift canary's success path prints
`endpoint : ${baseURL}` to console.log (line 116), which includes the account-id. This
is not an API key (the `Authorization: Bearer` token is never printed — good), but the
account-id is a semi-sensitive credential-adjacent identifier. The review brief calls out
"NO keys/credentialed URLs printed"; a URL containing the account-id is credential-adjacent.
It only runs LIVE (never in CI), so blast radius is an operator's local console/log file,
but log files get pasted into tickets.
**Fix:** Redact the account-id in the provenance print, e.g. log the host only
(`api.cloudflare.com/.../ai/v1`) or mask: `baseURL.replace(accountId, "***")`. Apply the
same masking anywhere the tiered resolver logs its provider choice if `baseURL` is ever
added to that log line.

### WR-04: provider-guard uses substring `.includes()` — a provider mentioning the guards only in a comment false-greens

**File:** `packages/llm/src/provider-guard.test.ts:23-28`
**Issue:** `esProviderSinGuard` returns "has guard" if the source string merely *contains*
`assertNoRutInLlmInput` and `assertSensitivityAllowed` anywhere — including inside a
comment, a docstring, or a dead/commented-out line. A future provider could carry a
comment like `// TODO wire assertNoRutInLlmInput / assertSensitivityAllowed` and pass the
guard while making zero actual calls. The guard is prospective and this is exactly the
false-green it is meant to prevent. The mutation self-check (Test 2) does not cover this
case — its "con guards" contraexample uses real call syntax, so it never exercises the
comment-only path.
**Fix:** Tighten the predicate to require call syntax, e.g.
`source.includes("assertNoRutInLlmInput(")` and `source.includes("assertSensitivityAllowed(")`
(note the open paren), and add a mutation self-check whose synthetic source has the strings
only in a comment and asserts it IS flagged as offender:
```typescript
const soloEnComentario = `// assertNoRutInLlmInput assertSensitivityAllowed\nexport class P {}`;
expect(esProviderSinGuard(soloEnComentario)).toBe(true);
```

## Info

### IN-01: `costPerToken` magic numbers are undocumented in provenance

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:233,237`
**Issue:** `costPerToken: 0.00000000125` and `0.00000014` are labeled "informativo —
telemetría" but there's no source/date for these tariffs. If Workers AI / DeepSeek pricing
changes, telemetry silently drifts. Not a correctness bug (values are informational only).
**Fix:** Add a comment citing the pricing source and date, or hoist to named constants
`GRANITE_COST_PER_TOKEN` / `DEEPSEEK_COST_PER_TOKEN` near the tariff-pinned drift date.

### IN-02: integ-scope-guard relies on `readFileSync` throwing if a guarded file is renamed

**File:** `packages/llm/src/integ-scope-guard.test.ts:34-47`
**Issue:** The guard reads `clasificar-lobby-cli.ts` and `pipeline-cli.ts` by hardcoded
path. If either is renamed/moved, `readFileSync` throws and the test errors red — which is
acceptable fail-safe behavior, but the failure message ("ENOENT") won't explain that the
guard's target moved. Both files currently exist (verified).
**Fix (optional):** Wrap with an existence check that emits a clear message:
`existsSync(path) || throw new Error("guard target moved — update integ-scope-guard")`.

### IN-03: `MUESTRA_GATE` duplicated as literal `10` in golden-set assertions and CLI

**File:** `packages/cruces/src/clasificar-fichas-cli.ts:26`; `packages/cruces/src/golden/golden-set.test.ts:56`
**Issue:** The gate sample size `10` is a named constant `MUESTRA_GATE` in the CLI but a
bare literal in `golden-set.test.ts` (`expect(GOLDEN_SET_GATE.length).toBe(10)`) and in the
shadow-eval comments ("10 casos"). Low-risk duplication; if the gate size ever changes, the
literals must be updated in lockstep.
**Fix:** Export `MUESTRA_GATE` (or reuse `GOLDEN_SET_GATE.length`) so there is one source of truth.

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
