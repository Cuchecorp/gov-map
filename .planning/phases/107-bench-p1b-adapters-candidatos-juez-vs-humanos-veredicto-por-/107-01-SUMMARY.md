---
phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-
plan: 01
subsystem: infra
tags: [llm, granite, phi, workers-ai, openrouter, tool-calling, zod, benchmark, fail-closed]

# Dependency graph
requires:
  - phase: 02
    provides: LLMProvider contract, MiniMaxProvider template, parseAndValidate, zodToToolSchema, data-routing guards
  - phase: 106
    provides: onValidationOutcome observer, PRICING dated table, makeMockFetch helper, llm-bench harness
provides:
  - GraniteProvider (LLMProvider, MiniMax clone, explicit max_tokens, host-agnostic baseURL)
  - JudgeProvider/Verdict/JudgeRequest contract (LOCKED field names) in judge.ts
  - PhiJudge (JudgeProvider, deterministic temp 0, match-by-name, identical fail-closed guards)
  - candidate PRICING rows (granite + phi) dated 2026-07-26
  - 3 empty .env.example placeholders (Workers AI / Cloudflare account / OpenRouter)
affects: [108 TieredProvider wiring, 109 real-task integration, 107-02 veredicto bridge (consumes JudgeRequest)]

# Tech tracking
tech-stack:
  added: []  # ZERO new SDK — openai@5 + zod already present
  patterns:
    - "Candidate LLM adapter = verbatim MiniMax clone (openai@5 + baseURL, forced tool_choice, match-by-name, external parseAndValidate)"
    - "SEPARATE JudgeProvider interface (verdict emitter, not responder) with LOCKED JudgeRequest/Verdict contract"
    - "Explicit max_tokens on Workers AI adapters (default 256 truncates structured output)"
    - "trainsOnInputs = fixed conservative boolean documented as a DPA legal gate, never env-configurable"

key-files:
  created:
    - packages/llm/src/providers/granite.ts
    - packages/llm/src/providers/granite.test.ts
    - packages/llm/src/judge.ts
    - packages/llm/src/providers/phi-judge.ts
    - packages/llm/src/providers/phi-judge.test.ts
  modified:
    - packages/llm/src/index.ts
    - packages/llm-bench/src/pricing.ts
    - .env.example

key-decisions:
  - "GraniteProvider is a verbatim MiniMax clone; only differences: id=granite, Workers AI/OpenRouter baseURL, granite model default, and an EXPLICIT max_tokens=2048 (Workers AI default 256 truncates)"
  - "JudgeProvider lives in a NEW judge.ts, SEPARATE from LLMProvider; JudgeRequest field names (answer, system?, sensitivity?, temperature?, context?) are LOCKED so 107-02/03 compile against a stable contract"
  - "PhiJudge forces temperature 0 (req.temperature ?? 0) for deterministic verdicts and matches tool_call BY NAME (Phi hallucinates function names — load-bearing)"
  - "Both adapters run IDENTICAL fail-closed guards: assertNoRutInLlmInput on user/answer AND system, plus assertSensitivityAllowed — all before any network call"
  - "3 .env.example placeholders are EMPTY (KEY=); env-example-guard stays green (0 offenders); no secret value ever committed"

patterns-established:
  - "Candidate adapter fidelity: clone the incumbent adapter's tool-calling shape verbatim so 'change of model' stays safe (external zod gate, match-by-name)"
  - "Judge is conceptually ESCALATE-ONLY (108 wires composition); 107 only MEASURES capability"

requirements-completed: [TIER-01]

# Metrics
duration: 6min
completed: 2026-07-27
---

# Phase 107 Plan 01: Candidate adapters (GraniteProvider + PhiJudge) Summary

**GraniteProvider (MiniMax clone with explicit max_tokens, host-agnostic Workers AI/OpenRouter baseURL) + a SEPARATE JudgeProvider/Verdict contract with PhiJudge (deterministic, match-by-name), both with identical fail-closed RUT+sensitivity guards, all CI-testable with a fake fetch and zero new SDK.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-27T02:59:49Z
- **Completed:** 2026-07-27T03:05:42Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- GraniteProvider implements LLMProvider as a verbatim MiniMax clone, adding an explicit `max_tokens=2048` (Workers AI default 256 would truncate structured output) and a host-agnostic baseURL (Workers AI primary via ACCOUNT_ID template / OpenRouter fallback).
- New `judge.ts` defines a SEPARATE `JudgeProvider` interface plus `VerdictSchema`/`Verdict` and the LOCKED `JudgeRequest` shape (`answer`, `system?`, `sensitivity?`, `temperature?`, `context?`) so Wave 2 (107-02/03) compiles against a stable contract.
- PhiJudge implements JudgeProvider: forces temperature 0 for deterministic verdicts, matches its tool_call BY NAME (Phi hallucinates function names), validates externally against VerdictSchema, and runs the identical fail-closed guards (RUT on `answer` AND `system`, sensitivity gate).
- Candidate PRICING rows (`@cf/ibm-granite/granite-4.0-h-micro`, `microsoft/phi-4-mini-instruct`) added, dated 2026-07-26 [ASSUMED] MEDIUM; the "candidates NOT listed here" comment replaced since 107 owns them now.
- Three EMPTY `.env.example` placeholders added (`WORKERS_AI_API_TOKEN=`, `CLOUDFLARE_ACCOUNT_ID=`, `OPENROUTER_API_KEY=`); the env-example guard stays green (0 offenders). No secret value committed.

## Task Commits

Each task was committed atomically:

1. **Task 1: GraniteProvider + candidate PRICING** - `5694570` (feat) — RED (test-first, missing module) → GREEN in one commit; test + impl + pricing staged together after verify.
2. **Task 2: JudgeProvider/Verdict/JudgeRequest + PhiJudge + barrel + .env.example** - `37bdb51` (feat) — RED (missing phi-judge module) → GREEN.

_TDD note: RED was verified via the "Cannot find module" failure before each implementation, then GREEN after writing the adapter. Test + implementation committed together per task._

## Files Created/Modified
- `packages/llm/src/providers/granite.ts` - GraniteProvider (LLMProvider, MiniMax clone, explicit max_tokens, host-agnostic baseURL, identical guards).
- `packages/llm/src/providers/granite.test.ts` - Mock-fetch tests: match-by-name, reordered call, all-wrong-name repair→LLMValidationError, RUT-guard bites (user+system), explicit numeric max_tokens assertion, constructor model.
- `packages/llm/src/judge.ts` - SEPARATE JudgeProvider interface + VerdictSchema/Verdict + LOCKED JudgeRequest shape.
- `packages/llm/src/providers/phi-judge.ts` - PhiJudge (JudgeProvider, temp 0 forced, match-by-name, external parseAndValidate vs VerdictSchema, identical guards).
- `packages/llm/src/providers/phi-judge.test.ts` - Mock-fetch tests: Verdict validated, temperature 0 asserted, match-by-name, all-wrong-name repair, malformed→LLMValidationError, RUT-guard bites (answer+system), sensitivity gate.
- `packages/llm/src/index.ts` - Barrel: added `./judge`, `providers/granite`, `providers/phi-judge`.
- `packages/llm-bench/src/pricing.ts` - Candidate rows for granite + phi model ids, dated.
- `.env.example` - 3 empty placeholders for the LIVE candidate credentials (values live in `.env` only).

## Decisions Made
- GraniteProvider mirrors MiniMax's conditional-temperature spread but ALWAYS sends an explicit `max_tokens` (Workers AI truncation pitfall). Chose 2048 as a high-but-bounded ceiling for structured output.
- PhiJudge defaults temperature to 0 but honors an explicit `req.temperature` override (tested), keeping determinism as the default without hard-coding it.
- PhiJudge caps repair attempts internally (`DEFAULT_REPAIR_ATTEMPTS = 1`, clamped) because `JudgeRequest` intentionally does not expose `maxRepairAttempts` — the judge contract stays minimal.

## Deviations from Plan
None - plan executed exactly as written. Guards, match-by-name, explicit max_tokens, temp-0 determinism, LOCKED field names, empty placeholders, and zero new SDK all followed the plan and threat model verbatim.

## Issues Encountered
None. All tests passed on first GREEN run; tsc -b clean for both packages.

## Known Stubs
None that block the plan goal. The `granite.ts` `DEFAULT_BASE_URL` carries a documented `{ACCOUNT_ID}` template placeholder that the LIVE run (Plan 03) replaces via constructor with `CLOUDFLARE_ACCOUNT_ID` from `.env` — this is by design (host-agnostic baseURL), not an unwired stub. The LIVE veredicto numbers are deferred to Plan 03 pending operator credential provision (documented in 107-CONTEXT §credentials).

## User Setup Required
None for this plan (CI-side only, fake fetch). The LIVE veredicto (Plan 03) requires the operator to add three secrets to `.env` (NEVER `.env.example`): `WORKERS_AI_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY`. This is the checkpoint surfaced in 107-CONTEXT; the corrida closes regardless (documented handoff, v7/v9/v10 pattern).

## Next Phase Readiness
- Adapters + judge contract exist and are provably correct with a fake fetch. 107-02 can bridge the veredicto against the LOCKED `JudgeRequest` contract without renaming fields.
- Verification: `pnpm --filter @obs/llm test` (101 passed, 3 skipped), `pnpm --filter @obs/llm-bench test` (106 passed, 1 skipped), `tsc -b` clean for both packages, `env-example-guard` green (16 passed, 0 offenders). No `response_format: json_schema` in either adapter; both use forced tool_choice.

## Self-Check: PASSED

All created files exist (granite.ts, granite.test.ts, judge.ts, phi-judge.ts, phi-judge.test.ts). Both task commits present in git log (5694570, 37bdb51).

---
*Phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-*
*Completed: 2026-07-27*
