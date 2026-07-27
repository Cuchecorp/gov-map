# Phase 106 - Plan Check (pre-execution review)

**Verdict:** CONCERNS (proceed after resolving 1 WARNING; no BLOCKERS)
**Checked:** 2026-07-26
**Plans:** 106-01, 106-02, 106-03, 106-04 (4 plans, 3 waves)
**Requirements:** BENCH-01, BENCH-02, BENCH-03 - all covered

---

## Headline: the linchpin holds

Point 1 (fetchFn seam) - VERIFIED REAL. Not a blocker.
Both adapters expose the injection hook the whole instrumentation approach depends on:
- packages/llm/src/providers/deepseek.ts:39-40 - fetchFn?: typeof fetch in DeepSeekProviderOptions, wired at line 55 (fetch: opts.fetchFn) into new OpenAI.
- packages/llm/src/providers/minimax.ts:43-44 - same field, wired at line 59.

The harness can own the openai call and capture usage/latency by injecting instrumentedFetch(fetch, sink) without touching @obs/llm. Plans 106-01 Task 3 and 106-04 Task 2 reference these exact line numbers and use the seam correctly. The load-bearing design decision is sound.

---

## Dimensions

### Requirement coverage - PASS
- BENCH-01 -> 106-01 (metrics/instrument/report) + 106-04 (harness+mock). Covered.
- BENCH-02 -> 106-02 (routing+clasificacion) + 106-03 (juez+extraccion). All 4 golden tasks present. Covered.
- BENCH-03 -> 106-04 (LIVE baseline vs real DeepSeek/MiniMax, endpoint+tarifaFecha stamped). Covered.
Frontmatter requirements fields match roadmap.

### Point 2 - two fail-rate metrics SEPARATE - PASS
106-01 Task 2 defines CallOutcome = clean | structured-output-fail | zod-repaired | zod-terminal and agregarFallos -> { structured_output_fail_rate, zod_fail_rate:{repaired,terminal} } as three distinct numbers + anti-Pitfall-B meta-test. Mapping to validate.ts is FAITHFUL (verified):
- structured-output fail = no usable payload attempt 0 (safeJsonParse undefined / MiniMax toolCall undefined, validate.ts:62-75, minimax.ts:112-115).
- zod-repaired = safeParse fails then reprompt succeeds (validate.ts:101-111, non-terminal).
- zod-terminal = attempts exhausted -> LLMValidationError (validate.ts:107-108).
- clean = validated attempt 0 (validate.ts:104-105).
report.ts carries the fields separately on MetricasModelo. Never folded.

### Point 3 - frozen, zod-validated, no-PII, anti-leakage guard - PASS
- Freeze: guards/freeze.ts node:crypto createHash sha256; casos.freeze.json marker asserted per task in disjuncion.test.ts (static, no net).
- zod-on-load: scorers z.array(...).parse() at load (generalizes cruces:64).
- no-RUT: guards/no-rut.ts RUT_RE + contieneRut over raw bytes.
- disjunction exemplars INT eval = empty is a real vitest test per task; juez also asserts scoring INT calibracion = empty.
- Each task has an isolated adversarial meta-test proving the gate CAN fail (fichas IDS_CASOS_ADVERSARIOS generalized). Not theater.

### Point 4 - CI mock-only, LIVE env-gated, excluded from CI - PASS
106-04 Task 1 MockProvider implements LLMProvider, deterministic, no network (mirrors verified fichas mock-provider). Task 2 baseline.live.test.ts mirrors cruces/fichas (LIVE ? describe : describe.skip) + it.skipIf(!KEY), env LLM_BENCH_LIVE; skipped by default -> no network in CI.

### Point 5 - NO 107 scope crept in - PASS
No Granite/Phi adapters, no Workers AI/OpenRouter/Cloudflare endpoint, no verdict, no new secret. Explicit STOP-and-flag guards (T-106-03/-13, 106-04 Task 2 action). Pricing omits candidate rates. Nada-aprueba-paridad expressible + tested.

### Point 6 - package outside @obs/llm, references not paths - PASS
@obs/llm-bench depends on @obs/llm (workspace:*), never reverse; acceptance asserts @obs/llm UNCHANGED. tsconfig uses references { path ../llm } NOT paths (mirrors verified cruces tsconfig). Root tsconfig gets { path ./packages/llm-bench } appended (root has 14 refs, llm-bench absent -> clean add). pnpm-workspace packages/* covers it; tsconfig.base.json exists; packages/llm-bench is greenfield (verified). SECTOR_CODIGOS exported from @obs/cruces (index.ts:8) - 106-03 dep-or-inline both viable.

### Point 7 - Wave 2 parallel overlap - WARNING (below)

### Scope sanity - PASS
106-01 3t/~11f, 106-02 3t/14f, 106-03 2t/12f, 106-04 2t/6f. Within budget.

### CLAUDE.md compliance - PASS
references not paths, vitest per package, pnpm workspaces, zero new external package, GSD workflow.

### Research resolution - PASS with note
RESEARCH Open Questions not marked (RESOLVED) but all 3 answered inline with recommendations the plans adopt. Cosmetic heading only; not blocking.

---

## Findings

### WARNING 1 - Wave 2 shared write to src/index.ts (barrel collision)
Dimension: cross-plan / dependency_correctness. Severity: WARNING (breaks clean parallel execution; not a goal-failure).

106-02 and 106-03 are both wave:2, both depends_on [106-01], declared parallel. BOTH extend the SAME file packages/llm-bench/src/index.ts:
- 106-02 Task 1 (Export guards from barrel) and Task 3 (Extend the barrel).
- 106-03 Task 1 and Task 2 (Extend the barrel) - both list src/index.ts in <files>.

106-01 barrel re-exports only ./metrics ./pricing ./instrument ./report - it does NOT pre-declare guards or the four task scorers, so both Wave-2 plans genuinely append. Parallel execution -> lost-update / merge conflict on the barrel.

Note: files_modified frontmatter of BOTH plans OMITS src/index.ts, so a frontmatter-only overlap check passes falsely; the collision is only visible in the task <files>.

Fix options (pick one):
1. 106-01 Task 1 pre-writes the barrel with ALL forward re-exports (guards + tasks/*/scorer) as additive stubs; remove src/index.ts from 106-02/03 <files> and change actions to do-NOT-edit-the-barrel. Cleanest, keeps Wave 2 parallel.
2. Serialize: 106-03 depends_on [106-01,106-02] (wave 3). Costs the Wave-2 parallelism.
3. Per-directory barrels; 106-01 root barrel re-exports directories once; Wave 2 writes only its own subdir barrel.
Option 1 preferred.

### Note (not a finding) - ROADMAP Success Criterion #4 (DPA/quantization posture)
SC#4 speaks of the served host. CONTEXT/RESEARCH place served-host quantization/latency in 107 (candidates). 106 baselines only DeepSeek/MiniMax whose trainsOnInputs=false is already runtime-enforced, and records endpoint+tarifaFecha provenance for the incumbents - satisfying the 106-relevant slice. Candidate host posture correctly deferred to 107. No action; flagged so the operator knows SC#4 candidate portion lands in 107.

---

## Bottom line
The instrument is real: fetchFn seam exists, the two fail metrics are separate and faithfully mapped to parseAndValidate, golden discipline (freeze/zod/no-RUT/disjunction/adversarial) enforced by biting CI tests, CI mock-only with LIVE env-gated, no 107 scope leaked, package sits outside @obs/llm via references. Single actionable item: the Wave-2 barrel collision (WARNING 1) - resolve before execution to keep the parallel wave clean.
