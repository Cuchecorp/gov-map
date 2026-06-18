---
phase: 02-capa-de-providers-llm-embeddings
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/llm/src/types.ts
  - packages/llm/src/config.ts
  - packages/llm/src/validate.ts
  - packages/llm/src/router.ts
  - packages/llm/src/json-schema.ts
  - packages/llm/src/data-routing.ts
  - packages/llm/src/providers/deepseek.ts
  - packages/llm/src/providers/minimax.ts
  - packages/llm/src/providers/gemini-embeddings.ts
  - packages/llm/src/index.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: fixed
resolved:
  fixed_at: 2026-06-17
  critical_fixed: [CR-01, CR-02, CR-03]
  warning_fixed: [WR-01, WR-02, WR-03, WR-04, WR-05]
  info_resolved: [IN-02]
  info_deferred: [IN-01, IN-03]
  tests: "68 passed (was 37), 3 skipped; pnpm -w typecheck clean"
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 10
**Status:** fixed (2026-06-17) — 3 Blockers + 5 Warnings resolved; IN-02 resolved as side-effect; IN-01/IN-03 deferred (hardening, non-blocking)

## Summary

Reviewed the pluggable LLM/Embeddings provider layer (`@obs/llm`): zod validation
gate, fail-closed router, data-routing policy, MiniMax tool-calling, DeepSeek
json_object, and Gemini embeddings.

The zod gate (`parseAndValidate`) is genuinely the single authoritative gate and
its repair loop is bounded. Secret handling in the providers is clean (keys only
from constructor options, never logged, never in error messages). L2-normalization
guards against the zero vector.

However, the headline compliance guarantee of this phase is **not actually
enforced in the call path**. The two most important gates documented in
`data-routing.ts` — "RUT must NEVER reach an LLM" and "personal data only to a
non-training tier" — exist as standalone functions that **nothing calls**. A
caller can invoke `provider.complete({ user: "...RUT 12.345.678-9...",
sensitivity: "personal" })` directly and the RUT goes straight to the wire. The
fail-closed property is opt-in, not fail-closed. This is the central defect of
the slice. There is also a RUT regex false-negative class (short-body RUTs) that
would silently leak even if the gate were wired.

## Critical Issues

### CR-01: RUT gate is never wired into the provider call path — RUT reaches the LLM — RESOLVED (commit 0c6d1ce)

> **Resolved:** `assertNoRutInLlmInput(req.user)` + `if (req.system) assertNoRutInLlmInput(req.system)` now run at the top of both `DeepSeekProvider.complete` and `MiniMaxProvider.complete`, before any network call. Provider-level tests assert a RUT in `req.user`/`req.system` throws `RutInLlmInputError` with zero fetches.

**File:** `packages/llm/src/providers/deepseek.ts:55-86`, `packages/llm/src/providers/minimax.ts:59-107`, `packages/llm/src/data-routing.ts:43-47`

**Issue:** `assertNoRutInLlmInput` is documented as a hard, fail-closed guarantee
("`assertNoRutInLlmInput` aborta ANTES de cualquier llamada LLM si detecta uno",
data-routing.ts:7). But neither `DeepSeekProvider.complete` nor
`MiniMaxProvider.complete` ever calls it. A grep of the whole repo shows the
function is referenced only by its own definition and its unit test — no
production call site exists. Any caller passing a `req.user` that contains a RUT
sends it directly to `this.client.chat.completions.create`. The "RUT must NEVER
reach an LLM" invariant is therefore unenforced: it depends on every future
caller remembering to call a helper that the type system does not require. This
is the opposite of fail-closed.

**Fix:** Enforce the gate inside the providers' single entry point so it cannot be
bypassed. In each `complete`:
```ts
import { assertNoRutInLlmInput } from "./../data-routing";

async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
  // Fail-closed: RUT must never cross into a prompt.
  assertNoRutInLlmInput(req.user);
  if (req.system) assertNoRutInLlmInput(req.system);
  // ...rest
}
```
Also assert on every reprompt-bound string if any user-derived text is ever
concatenated into the repair message (here only zod issues are, so the initial
assert suffices). Add a provider-level test proving a RUT in `req.user` throws
`RutInLlmInputError` and emits zero fetches.

### CR-02: Sensitivity gate is not enforced at the provider boundary — personal data can reach a training tier — RESOLVED (commit 0c6d1ce)

> **Resolved:** `assertSensitivityAllowed({ sensitivity: req.sensitivity }, this)` now runs intrinsically inside both providers' `complete()`. Tests force `trainsOnInputs=true` on a provider instance and assert a `personal` request throws `SensitiveRoutingError` with zero fetches. The router-level gate is kept as defense in depth (e2e test).

**File:** `packages/llm/src/providers/deepseek.ts:55`, `packages/llm/src/providers/minimax.ts:59`, `packages/llm/src/data-routing.ts:54-63`, `packages/llm/src/router.ts:41-59`

**Issue:** The sensitivity fail-closed check exists in two places
(`router.selectProvider` and `data-routing.assertSensitivityAllowed`) but both
are advisory: they only fire if a caller routes through `selectProvider` first.
`provider.complete` itself performs no sensitivity check. Because every provider
in the registry currently has `trainsOnInputs = false`, the router gate is also
effectively a no-op today (it can never throw with the shipped config). The
moment a training-tier LLM provider is added (the config comment explicitly
anticipates swapping models), a caller that obtains the provider instance
directly — or registers it under the wrong criticality — sends personal data to a
training tier with nothing stopping it. The guarantee "dato personal NUNCA puede
ir a un provider que entrena" (types.ts:21-22) is not structurally enforced.

**Fix:** Make the sensitivity check intrinsic to the provider, mirroring CR-01:
```ts
async complete<T>(req: CompletionRequest, schema: ZodType<T>): Promise<T> {
  assertSensitivityAllowed({ sensitivity: req.sensitivity }, this);
  // ...
}
```
`this` already exposes `id` and `trainsOnInputs`, satisfying the helper's
contract. This guarantees the gate regardless of how the provider was obtained.
Keep the router check too (defense in depth), but do not rely on it as the sole
gate.

### CR-03: RUT regex false negatives — short-body RUTs and spaced separators leak to the LLM — RESOLVED (commit 93fd590)

> **Resolved:** `RUT_REGEX` broadened to `/\b\d{1,3}(?:\.?\d{3})*\s*-\s*[\dkK]\b/i` (1-8 body digits, optional thousands dots, optional spaces around the hyphen, DV 0-9/K). New fixtures cover `123.456-7`, `12345-6`, `1.234-5`, `123.456-K`, and the spaced forms `12.345.678 - 9`, `7.654.321 -K`, `7654321- K`, each asserting `RutInLlmInputError`. Error message still never exposes the matched RUT.

**File:** `packages/llm/src/data-routing.ts:37`

**Issue:** `RUT_REGEX = /\b\d{1,2}(?:\.\d{3}){2}-[\dkK]\b|\b\d{7,8}-[\dkK]\b/`.
Both alternatives require a body of 7-8 digits:
- Dotted branch: `\d{1,2}` + two `\.\d{3}` groups = 7 or 8 body digits only.
- Plain branch: `\d{7,8}`.

Valid Chilean RUTs with **6-digit (or shorter) bodies** exist (older natural
persons and many companies, e.g. `123.456-7`, `12345-6`, `1.234-5`). None of
these match either branch, so a real RUT passes the gate untouched and reaches
the LLM. Additional miss cases: separators with spaces (`12.345.678 - 9`), and
RUTs written with the DV preceded by no hyphen are out of scope but the
space-around-hyphen form is commonly OCR'd from documents. Because this is the
*deterministic* hard-identifier gate (the whole point is no false negatives),
each miss is a silent compliance breach, not a quality nit.

**Fix:** Broaden the body to 1-8 digits and tolerate optional dot grouping and
spaces around the hyphen, then validate length range explicitly:
```ts
// 1-8 body digits, optional thousands dots, optional spaces around hyphen, DV 0-9/K.
const RUT_REGEX = /\b\d{1,3}(?:\.?\d{3})*\s*-\s*[\dkK]\b/i;
```
Add fixtures for `123.456-7`, `12345-6`, `1.234-5`, and `12.345.678 - 9` to the
test suite, each asserting `RutInLlmInputError`. (Note: a looser regex risks more
false positives, which is the safe direction for a fail-closed identifier gate —
prefer over-blocking to leaking.)

## Warnings

### WR-01: `maxRepairAttempts` / `maxAttempts` accepts unvalidated values; negative yields empty-issue error, no upper clamp — RESOLVED (commit 7e4dd04)

> **Resolved:** Added `clampRepairAttempts()` (range `[0, MAX_REPAIR_ATTEMPTS_CEILING=3]`; undefined→1, negative/NaN→0, fractional truncated) applied at both provider boundaries, and `parseAndValidate` now clamps `maxAttempts` to `>= 0` internally so a negative value runs the initial validation and produces a real-issue error instead of `LLMValidationError([])`. Tests cover negative/NaN/over-ceiling/fractional and the empty-issue regression. (Also fixes IN-02 comment.)

**File:** `packages/llm/src/validate.ts:64-85`, `packages/llm/src/providers/deepseek.ts:77`, `packages/llm/src/providers/minimax.ts:98`

**Issue:** `req.maxRepairAttempts ?? 1` passes through to `maxAttempts` with no
validation. A negative value (e.g. `-1`) makes the `for` loop body never execute
(`0 <= -1` is false), so the function skips both validation and the issue
collection and throws `new LLMValidationError([])` with an **empty issues array** —
a confusing, information-free error that no longer reflects "output failed
validation" because no validation ran. A large value (e.g. from
config/untrusted task metadata) is bounded but permits an arbitrarily long
sequence of paid network round-trips. The loop is bounded (good, not infinite),
but the bound is caller-controlled and unsanitized.

**Fix:** Clamp at the boundary:
```ts
const maxAttempts = Math.max(0, Math.min(req.maxRepairAttempts ?? 1, 3));
```
and in `parseAndValidate` treat `maxAttempts < 0` as `0`. Keep an explicit upper
ceiling so cost cannot be driven up by a bad config value.

### WR-02: MiniMax tool-call parse ignores extra/duplicate tool_calls and wrong function name — RESOLVED (commit 5afaf82)

> **Resolved:** The parser now uses `calls.find((c) => c.type === "function" && c.function.name === TOOL_NAME)` instead of `tool_calls[0]`. A wrong/hallucinated function name (or `emit_result` not in position 0) is matched by name; if absent the result is `undefined` and routed into the repair loop. Tests cover the reordered-call and wrong-name-only cases.

**File:** `packages/llm/src/providers/minimax.ts:86-89`

**Issue:** The parser takes `tool_calls?.[0]` unconditionally and only checks
`toolCall?.type === "function"`. It does **not** verify
`toolCall.function.name === TOOL_NAME`. If the model returns a tool call for a
different (hallucinated) function name, or returns multiple tool_calls where
`[0]` is not `emit_result`, the adapter forwards arguments from the wrong call to
the zod gate. Usually zod rejects it, but a same-shaped payload under a different
function name would be silently accepted as a valid `emit_result`. For the
critical/identity-adjudication tier this is exactly where robustness matters.

**Fix:** Match by name, not position:
```ts
const calls = res.choices[0]?.message?.tool_calls ?? [];
const toolCall = calls.find(
  (c) => c.type === "function" && c.function.name === TOOL_NAME,
);
return toolCall?.type === "function" ? toolCall.function.arguments : undefined;
```

### WR-03: Gemini per-vector dimensionality is never validated — wrong-dims vector persisted as `dims: 768` — RESOLVED (commit 73fc6e7)

> **Resolved:** Added `if (values.length !== EMBEDDING_DIMS) throw ...` before L2-normalizing/stamping `dims: 768`. Tests assert both an over-sized (3072) and truncated (512) vector throw a dim-mismatch error, preventing the FND-07 pgvector(768) corruption.

**File:** `packages/llm/src/providers/gemini-embeddings.ts:103-115`

**Issue:** The response handler checks the batch length matches and that each
`values` is non-empty, but never checks `values.length === EMBEDDING_DIMS`. If
Gemini ignores or mis-handles `outputDimensionality` (API change, error
fallback to 3072, partial truncation), the provider L2-normalizes whatever it
got and stamps it `dims: 768`. The result is a vector whose real length differs
from its recorded `dims`, which corrupts the pgvector index in Fase 7 (insert
into `vector(768)` fails at best, or silently stores a mis-versioned vector at
worst) — the exact FND-07 corruption the versioning was meant to prevent.

**Fix:**
```ts
if (values.length !== EMBEDDING_DIMS) {
  throw new Error(
    `Gemini embedding dim mismatch: expected ${EMBEDDING_DIMS}, got ${values.length}`,
  );
}
```

### WR-04: Empty `texts` array silently returns `[]` without calling the API; no input guard — RESOLVED (commit 73fc6e7)

> **Resolved:** `embed()` now early-returns `[]` on `texts.length === 0` before building/POSTing any request. Test asserts `embed([])` yields `[]` with zero fetches. (Max-batch chunking left as a future hardening, see note below.)

**File:** `packages/llm/src/providers/gemini-embeddings.ts:67-101`

**Issue:** `embed([])` builds `requests: []`, posts an empty batch, and the shape
check `embeddings.length !== texts.length` is `0 !== 0` (passes). Behavior
depends on how Gemini responds to an empty `requests` array (may 400). More
importantly, callers get no signal distinguishing "embedded nothing" from a bug.
Also there is no guard against an oversized batch (Gemini caps batch size); a
large `texts` array will 400 with an opaque error. Not a correctness breach but a
robustness gap on an external boundary.

**Fix:** Early-return on empty input without a network call, and document/enforce
a max batch size:
```ts
if (texts.length === 0) return [];
// optionally: chunk texts into batches of <= MAX_BATCH before posting.
```

### WR-05: `loadRouterConfigFromEnv` ignores its `env` argument — config is hardcoded, not swappable from env — RESOLVED (commit 7ec92e4)

> **Resolved:** The `_env` parameter is now `env` and read for `DEEPSEEK_MODEL`/`DEEPSEEK_BASE_URL`, `MINIMAX_MODEL`/`MINIMAX_BASE_URL`, and `LLM_CRITICAL_PROVIDER`/`LLM_BULK_PROVIDER`, each defaulting to the verified literal. `trainsOnInputs` is deliberately NOT env-configurable (a compliance property, not an operational one) to avoid relaxing the fail-closed gate via a stray env var. New `config.test.ts` covers defaults, overrides, and the non-configurable flag.

**File:** `packages/llm/src/config.ts:36-57`

**Issue:** The function signature and doc comment promise "Arma la RouterConfig
desde el entorno" and the phase's stated criterion is "cambiar de modelo =
cambiar config". But the parameter is `_env` (unused) and every value (models,
baseURLs, criticality mapping) is a hardcoded literal. There is no way to swap a
model or endpoint via environment without editing code, contradicting the
documented swappability contract (FND-06 criterio 2) and the project constraint
that endpoints/models be config-driven. The `_env` underscore hides that the
argument is dead.

**Fix:** Read overridable values from `env` with the literals as defaults, e.g.
`model: env.DEEPSEEK_MODEL ?? "deepseek-v4-flash"`,
`baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"`, and similarly for
the criticality mapping if it should be swappable. Keep keys out of this object
(correctly omitted today).

## Info

### IN-01: `zodToToolSchema` does not set `additionalProperties:false` or guarantee `required` for strict tool-calling — DEFERRED

> **Deferred:** Hardening suggestion, not a bug — the zod gate still rejects bad shapes downstream (the reviewer says so). Out of scope for this Blocker+Warning fix pass; no compliance/correctness impact.

**File:** `packages/llm/src/json-schema.ts:13-18`

**Issue:** Stripping `$schema` is fine, but for forced tool-calling on a
critical-tier model, the derived parameters schema benefits from
`additionalProperties: false` (zod v4 may emit `"additionalProperties": true`/
absent depending on the object mode) so the model cannot smuggle extra fields.
This is a hardening suggestion, not a bug — the zod gate still rejects bad shapes
downstream.

**Fix:** Consider post-processing the JSON schema to force
`additionalProperties: false` on the root object before returning.

### IN-02: Comment claims "Inalcanzable" but the line is reachable with `maxAttempts < 0` — RESOLVED (commit 7e4dd04)

> **Resolved as a side-effect of WR-01:** `maxAttempts` is now clamped to `>= 0`, so the loop always runs attempt 0 and the trailing `throw` is genuinely unreachable. The comment was updated to state why.

**File:** `packages/llm/src/validate.ts:83-84`

**Issue:** The trailing `throw new LLMValidationError([])` is annotated as
unreachable, but as noted in WR-01 it is reached when `maxAttempts < 0`. The
comment is misleading. Resolving WR-01 (clamp to >= 0) makes the comment correct.

**Fix:** Clamp `maxAttempts` to `>= 0` (per WR-01); the comment then holds.

### IN-03: `EmbeddingResult.version` and `EMBEDDING_VERSION` are hardcoded `"v1"` with no link to model identity — DEFERRED

> **Deferred:** Discipline/documentation suggestion (couple version bumps to model/dims). No correctness impact in this phase (single model, single version); revisit when a second embedding model is introduced. Out of scope for the Blocker+Warning pass.

**File:** `packages/llm/src/providers/gemini-embeddings.ts:27,108-114`

**Issue:** Version is a free-standing `"v1"` constant. If the model id changes
but someone forgets to bump `EMBEDDING_VERSION`, two genuinely different vector
spaces share a version tag — the FND-07 corruption case. Minor: consider deriving
or asserting version-to-model coupling, or documenting the bump discipline at the
constant.

**Fix:** Add a comment tying version bumps to model/dims changes, or compute a
composite version key (`${EMBEDDING_MODEL}@${EMBEDDING_DIMS}/v1`).

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
