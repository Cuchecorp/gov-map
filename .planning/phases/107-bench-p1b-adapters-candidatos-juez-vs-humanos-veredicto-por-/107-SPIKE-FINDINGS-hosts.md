# Phase 107 — SPIKE FINDING: host/capability gap for the candidates (2026-07-27)

**Trigger:** operator provisioned `OPENROUTER_API_KEY` (`sk-or-…`, valid) and asked to validate the spike.
The LIVE runner (`candidatos.live.test.ts`) RAN end-to-end against real endpoints (105s, test PASSED
on its provenance/verdict-computed assertions). **But the candidate numbers are MECHANICALLY VOID —
not a quality signal.** Diagnosis below. This is a VALID spike outcome: the instrument caught a
provisioning/capability gap BEFORE any integration (exactly its job). Veredicto stays PENDING-EVIDENCE.

## What ran vs what didn't
- ✅ **Instrument + pipeline validated:** harness drove 4 golden GATE sets, DeepSeek **incumbent** ran
  fine same-run (real deltas), `computarVeredicto` computed all four tasks, telemetry/artifact printed.
  Every machinery piece works against live endpoints.
- ❌ **Both candidates failed to produce usable output** — because the models aren't served with
  tool-calling where we pointed them (our adapters FORCE `tool_choice`). Not model weakness.

## Direct probes (OpenRouter) — root cause
- `POST /chat/completions` `ibm-granite/granite-4.0-h-micro` + forced tool → **HTTP 404**
  "No endpoints found that support tool use."
- `POST /chat/completions` `microsoft/phi-4-mini-instruct` → **HTTP 404** "No endpoints found."
- `GET /models` (342 models) filtered:
  - Granite with `[tools]`: ONLY `ibm-granite/granite-4.1-8b` (an **8B**, not the 3B micro under test).
    `ibm-granite/granite-4.0-h-micro` is listed but **no-tools**.
  - Phi: only `microsoft/phi-4` (14B, **no-tools**) — **no phi-4-mini at all**.

## Host/capability matrix (VERIFIED)
| Candidate | OpenRouter | Workers AI | Viable host |
|-----------|-----------|-----------|-------------|
| **Granite-4.0-H-Micro** (responder, routing/clasificación/extracción) | listed, NO tool-use endpoint ✗ | `@cf/ibm-granite/granite-4.0-h-micro` **WITH function calling** ✓ (CF Workers AI catalog confirmed) | **Workers AI only** |
| **Phi-4-mini** (juez/validator) | not listed (only tool-less `phi-4`) ✗ | no Phi models (only deprecated Phi-2) ✗ | **NONE confirmed** |

## Consequences for the veredicto
1. **`OPENROUTER_API_KEY` alone does NOT unblock the veredicto.** Granite has no tool-use provider on
   OpenRouter; Phi-4-mini isn't on OpenRouter or Workers AI.
2. **Granite path (routing/clasificación/extracción):** provision **`WORKERS_AI_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID`** in `.env`. Then `candidatos.live.test.ts` uses the Workers AI primary
   branch automatically (baseURL `.../accounts/{ACCOUNT_ID}/ai/v1`, model `@cf/ibm-granite/granite-4.0-h-micro`).
   No code change — the runner already selects Workers AI when both keys exist.
3. **Phi judge path (juez / BENCH-04):** needs a host that serves **phi-4-mini with function calling**.
   Neither OpenRouter nor Workers AI does. Options to verify in pasada 2 (research task):
   - **DeepInfra** / **Azure AI Foundry** (both list Phi-4-mini) — confirm tool-calling passes through, add its baseURL/key.
   - OR relax the judge to a prompt-forced + zod path (no forced tool_choice) if a tool-calling host can't be found — but that is a design change (the adapters currently force tool_choice, per the "response_format json_schema JAMÁS asumido" rule; a prompt-forced+zod judge variant is the sanctioned alternative).
   - OR (operator call) pick a different small judge model that IS served with function calling.
4. **Adapter robustness note:** our Granite/Phi adapters force `tool_choice` and match-by-name — correct
   for a tool-calling host, but they surface a host-without-tools as structured-output failures (which is
   what the void smoke showed). That is the fail-closed behavior we want; the fix is the HOST, not the adapter.

## Status
- Veredicto: **PENDING-EVIDENCE** (unchanged status, sharper reason: candidate hosts not yet viable).
- No fabricated numbers committed. Smoke output discarded as void.
- Buildable deliverables (adapters + machine + guards) remain green and correct — see 107-VERIFICATION (8/8).
