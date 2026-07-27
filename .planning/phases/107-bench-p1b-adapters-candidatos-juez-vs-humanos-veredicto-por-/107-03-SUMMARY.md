---
phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-
plan: 03
subsystem: infra
tags: [llm-bench, veredicto, live-gated, granite, phi, workers-ai, openrouter, deepseek-incumbent, pending-evidence, checkpoint]

# Dependency graph
requires:
  - phase: 107-01
    provides: GraniteProvider + PhiJudge real adapters (host-agnostic baseURL, instrumentedFetch-injectable)
  - phase: 107-02
    provides: computarVeredicto (pure ε-gated + es-CL hard veto) + medirJuezVsHumano (PhiJudge->JuzgarFn)
  - phase: 106
    provides: correrHarness driver, instrumentedFetch, DeepSeekProvider incumbent, baseline.live.test.ts split pattern
provides:
  - candidatos.live.test.ts (single env-gated LIVE veredicto runner; skips in CI; same-run DeepSeek incumbent; PhiJudge-vs-human; per-task Veredicto)
  - operator README section + 107-OPERATOR-HANDOFF.md (exact keys + run command + pending-evidence interpretation)
  - VEREDICTO status = PENDING-EVIDENCE (valid milestone outcome; live numbers deferred to operator provision)
affects: [108 TieredProvider wiring (gated on green veredicto), 109 real-task integration]

# Tech tracking
tech-stack:
  added: []  # ZERO new SDK/package
  patterns:
    - "Single env-gated LIVE runner mirrors baseline.live.test.ts split: (LIVE ? describe : describe.skip) + it.skipIf(ALL keys)"
    - "it.skipIf predicate requires DEEPSEEK_API_KEY (incumbent) AND a candidate key (Workers AI OR OpenRouter) — incumbent ALWAYS available when candidate fires (WARNING-1 pinned baseline)"
    - "Same-run incumbent: DeepSeek re-run in the SAME block with the SAME limitePorTarea cap → apples-to-apples, never a stale committed artifact"
    - "Asserts provenance (https endpoint + dated tarifa) + that the Veredicto was COMPUTED (all TaskIds present, valid estado) — NEVER that anything approved"
    - "pending-evidence is a VALID, non-failing milestone outcome (v7/v9/v10 documented-handoff pattern)"

key-files:
  created:
    - packages/llm-bench/src/candidatos.live.test.ts
    - .planning/phases/107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-/107-OPERATOR-HANDOFF.md
  modified:
    - packages/llm-bench/README.md

key-decisions:
  - "Candidate credentials verified ABSENT from .env (WORKERS_AI_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / OPENROUTER_API_KEY); DEEPSEEK_API_KEY (incumbent) present → VEREDICTO is PENDING-EVIDENCE; agent never loaded a secret value nor ran any LIVE network call"
  - "The checkpoint:human-action was surfaced once (2026-07-26 per 107-CONTEXT) and remains unprovisioned → phase closes honestly on the documented handoff"
  - "Granite host selection is by-key-present at runtime: Workers AI primary (WORKERS_AI_API_TOKEN + CLOUDFLARE_ACCOUNT_ID → @cf/ibm-granite/granite-4.0-h-micro) or OpenRouter fallback (OPENROUTER_API_KEY → ibm-granite/granite-4.0-h-micro via baseURL-swap)"
  - "PhiJudge (BENCH-04) lives ONLY on OpenRouter → its measurement is guarded on OPENROUTER_API_KEY; without it the block still runs candidate+incumbent+veredicto and leaves the judge pending-evidence"
  - "The test asserts provenance + verdict-COMPUTED (all TaskIds present with a valid estado), NEVER approval — a 'nada aprueba / pending-evidence' run PASSES"

requirements-completed: [BENCH-04, BENCH-05]

# Metrics
duration: 9min
completed: 2026-07-27
---

# Phase 107 Plan 03: VEREDICTO LIVE runner + operator handoff (PENDING-EVIDENCE) Summary

**A single env-gated LIVE test that (when the operator provisions the three candidate keys) runs the real Granite candidate + a SAME-RUN DeepSeek incumbent through the 106 harness + the real PhiJudge-vs-human measurement and computes the definitive per-task VEREDICTO — skipped in CI, no network; the candidate keys are absent from `.env`, so the phase closes honestly on a documented handoff with the veredicto marked PENDING-EVIDENCE.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-07-27
- **Tasks:** 1 auto (Task 1) + 1 checkpoint:human-action surfaced (unprovisioned)
- **Files:** 3 (2 created, 1 modified)

## Accomplishments

- **candidatos.live.test.ts (BENCH-04 + BENCH-05):** the SINGLE deferred LIVE run, cloning the `baseline.live.test.ts` LIVE/CI split EXACTLY (`const LIVE = process.env.LLM_BENCH_LIVE === "1"; (LIVE ? describe : describe.skip)(...)` + one `it.skipIf`). The predicate requires `DEEPSEEK_API_KEY` (incumbent) AND a candidate key (`WORKERS_AI_API_TOKEN`+`CLOUDFLARE_ACCOUNT_ID` OR `OPENROUTER_API_KEY`) — the incumbent is ALWAYS available when the candidate fires (WARNING-1, no unspecified incumbent path). When provisioned it: (a) instantiates the real `GraniteProvider` (Workers AI primary via ACCOUNT_ID template baseURL / OpenRouter fallback, picked by key-present) with `instrumentedFetch` and runs `correrHarness` → candidate `MetricasModelo`; (b) RE-RUNS the real `DeepSeekProvider` in the SAME block with the SAME `limitePorTarea` cap → pinned incumbent baseline (apples-to-apples, not a stale artifact); (c) instantiates the real `PhiJudge` (OpenRouter) and calls `medirJuezVsHumano(phiJudge)` → judge-vs-human `MetricasJuez`; (d) calls `computarVeredicto(candidato, incumbente)` and prints the definitive per-task `Veredicto` (JSON + legible tables). It ASSERTS ONLY provenance (https endpoint + dated tarifa) and that the verdict was COMPUTED (every TaskId present with a valid `EstadoTarea`) — NEVER that anything approved.
- **Operator README section (§2b):** appended to `packages/llm-bench/README.md` — the three exact candidate keys + where to get them, that `DEEPSEEK_API_KEY` (already in `.env`) is ALSO required for the same-run incumbent, the exact run command (bash + PowerShell), the smoke-cap vs full-run flag (`LLM_BENCH_LIMIT`), the empty-`.env.example`-placeholder discipline, and the LOCKED interpretation (pending-evidence is valid; es-CL `negacion.accuracy` hard veto; Ollama-local numbers don't transfer).
- **107-OPERATOR-HANDOFF.md:** the documented handoff that lets the milestone close honestly — pending-evidence status, what's READY (adapters + veredicto machine + runner all green via mock), what's BLOCKED (the live numbers), the verified-absent key table, the provision + run instructions, and the resume-signal ("corrido" / "diferido").

## Task Commits

1. **Task 1: env-gated LIVE candidate veredicto runner + operator README + handoff** — `d388855` (feat). No TDD (LIVE integration test that skips in CI by design; verified via skip-clean + full-suite green + tsc).

## Files Created/Modified

- `packages/llm-bench/src/candidatos.live.test.ts` — the single env-gated LIVE veredicto runner (created).
- `packages/llm-bench/README.md` — new §2b documenting the candidate veredicto run (modified).
- `.planning/phases/107-*/107-OPERATOR-HANDOFF.md` — pending-evidence handoff doc (created).

## VEREDICTO: PENDING-EVIDENCE (valid milestone outcome — LOCKED)

The definitive per-task VEREDICTO is **PENDING-EVIDENCE**. Per 107-CONTEXT §credentials (LOCKED) and the v7/v9/v10 documented-handoff pattern, this is a VALID, non-failing milestone outcome — NOT a gap or a failure. No veredicto numbers were fabricated.

- **Why:** the three candidate credentials are ABSENT from `.env` (verified 2026-07-27, no values printed): `WORKERS_AI_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY` are absent-or-empty; `DEEPSEEK_API_KEY` (incumbent) is present.
- **Checkpoint status:** the `checkpoint:human-action` (Task 0 of the plan) was surfaced once (2026-07-26 per 107-CONTEXT) and remains UNPROVISIONED. The agent did NOT load a secret value, did NOT run any LIVE network call, did NOT touch the provider quota.
- **Resolution path:** the operator adds the three keys to `.env` (never `.env.example`) and runs `LLM_BENCH_LIVE=1 pnpm --filter @obs/llm-bench exec vitest run src/candidatos.live.test.ts`. Full instructions in `107-OPERATOR-HANDOFF.md` and README §2b.

## Deviations from Plan

None — plan executed exactly as written. Task 1 built the env-gated runner + README + handoff; the checkpoint:human-action was surfaced and left unprovisioned per the LOCKED pending-evidence rule. No fabricated numbers, no live network, no new secret loaded, adjudication untouched.

## Threat Model Compliance

- **T-107-08 (Information Disclosure, candidate keys):** keys read from env only; `.env.example` placeholders stay empty (verified untouched by this plan); `instrumentedFetch` logs latency+tokens only; the test never prints keys/URLs. Agent never loaded a value.
- **T-107-09 (DoS, quota burn in CI):** `LLM_BENCH_LIVE` gate + `it.skipIf` (DEEPSEEK + candidate) → CI never touches network. Verified: candidatos.live.test.ts SKIPS (1 skipped) and full `@obs/llm-bench` suite stays green with no live call. Smoke cap by default on both candidate and incumbent.
- **T-107-10 (Spoofing, non-served/stale-baseline numbers):** the verdict is computed against a SAME-RUN incumbent (not a committed artifact) and only against the served endpoint; endpoint provenance asserted (`incumbente.endpoint === https://api.deepseek.com`); README + handoff state Ollama-local numbers don't transfer.
- **T-107-SC (Tampering, installs):** ZERO new packages; no install task.

## Issues Encountered

None. The candidate keys were verified absent up front (confirming the plan's premise), so the LIVE path was never attempted. The runner skips cleanly and CI stays green.

## Known Stubs

None that block the plan goal. The LIVE veredicto NUMBERS are PENDING-EVIDENCE by design (operator credential provision) — this is the documented, valid milestone outcome, not an unwired stub. The runner is fully wired and will produce the definitive verdict the moment the operator provisions and runs it.

## Verification

- `cd packages/llm-bench && pnpm exec vitest run src/candidatos.live.test.ts` → 1 skipped (describe.skip, no network, no keys).
- `cd packages/llm-bench && pnpm exec vitest run` → 124 passed, 3 skipped (baseline.live + candidatos.live + the LIVE juez block); 13 files passed, 2 skipped. CI green.
- `cd packages/llm-bench && pnpm exec tsc -b` → exit 0.
- `.env.example` unchanged by this plan (`git diff --name-only -- .env.example` empty).
- Candidate keys verified absent-or-empty in `.env`; `DEEPSEEK_API_KEY` present (no values printed).

## Self-Check: PASSED

(Filled after file/commit verification below.)

---
*Phase: 107-bench-p1b-adapters-candidatos-juez-vs-humanos-veredicto-por-*
*Completed: 2026-07-27*
