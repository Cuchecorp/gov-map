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

## UPDATE 2 — 2026-07-27: operator provisioned Workers AI token + CLOUDFLARE_ACCOUNT_ID; live probes
All three keys now present in `.env` (`WORKERS_AI_API_TOKEN` len 40, `CLOUDFLARE_ACCOUNT_ID` len 32, `OPENROUTER_API_KEY`). Direct live probes:

- **Workers AI Granite** (`@cf/ibm-granite/granite-4.0-h-micro`, forced tool) → **HTTP 401**.
  Isolation probes: `GET /user/tokens/verify` → **200, status active** (token is REAL); but native
  `POST /accounts/{acct}/ai/run/@cf/...` and `GET /accounts/{acct}/ai/models/search` → **error 10000
  "Authentication error"** (401/403). ⇒ The token authenticates but **lacks the "Workers AI" permission
  scope** on this account. **FIX (operator):** CF dashboard → API Tokens → edit token / new token with the
  "Workers AI" template → add `Account › Workers AI › Read` (+Edit) scoped to this account → paste into `.env`.
  Once fixed, `candidatos.live.test.ts` runs Granite on Workers AI with NO code change and the
  routing/clasificación/extracción veredicto gets REAL numbers.
- **OpenRouter `microsoft/phi-4`** (operator suggestion), forced tool → **HTTP 404 "No endpoints found
  that support tool use."** Confirms phi-4 on OpenRouter has no tool-calling provider. Our `PhiJudge`
  forces `tool_choice` → won't work there. (Also note phi-4 is the 14B, not the 3.84B phi-4-mini specced.)

### Judge (Phi) — remaining options (pick one; pasada-2 decision)
1. **Prompt-forced + zod judge variant** (NO forced `tool_choice`): add a `PhiJudge` mode that requests a
   JSON verdict via prompt + `parseAndValidate` (the SANCTIONED alternative — "response_format json_schema
   JAMÁS asumido → tool_choice OR prompt-forzado+zod"). This makes OpenRouter `microsoft/phi-4` usable as
   the judge TODAY (phi-4 answers, just not via tools). Small, additive code change. RECOMMENDED if a
   tool-calling Phi host isn't wanted.
2. **A tool-calling Phi host:** DeepInfra / Azure AI Foundry serve phi-4-mini — verify tool-calling passes,
   add its baseURL+key. Keeps the judge on forced tool_choice, but needs a new provider/key.
3. **A different small judge already served with tools** (operator call).

### Net state after UPDATE 2
- **Granite responder path (routing/clasificación/extracción):** ONE operator action away (fix the Workers
  AI token permission). No code change.
- **Phi judge path (BENCH-04):** needs option 1/2/3 above.
- A partial veredicto (3 responder tasks real, `juez` pending) is possible as soon as the Workers AI token
  is fixed — enough to gate 109's reversible task (clasificación/routing), which does NOT need the judge.

## Status
- Veredicto: **PENDING-EVIDENCE** (sharper reason: Workers AI token needs the Workers AI permission scope;
  Phi judge needs a tool-calling host OR the prompt-forced+zod variant).
- No fabricated numbers committed. Smoke output discarded as void.
- Buildable deliverables (adapters + machine + guards) remain green and correct — see 107-VERIFICATION (8/8).
