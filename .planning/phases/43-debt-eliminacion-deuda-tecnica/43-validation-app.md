# 43-validation-app — Adversarial Tech-Debt Validation (Opus, 1-by-1): `app/` frontend

Validator: Opus. Date: 2026-06-24. Method: re-read every file:line claimed by `43-discovery-app.md`; trust nothing.
Gates honored: NO PROD apply, NO deploy, NO `*_PUBLIC_ENABLED` flip. Any FIX-NOW must keep suite (≥316; counted ~338 `it/test` invocations) green + `tsc -b` clean and never change a shipped feature's behavior without a protecting test.

---

## APP-01 — `SUPABASE_SERVICE_KEY` vs `SUPABASE_SECRET_KEY` (admin client)

**RECONCILIATION (APP vs CONFIG, demanded by brief): RESOLVED — both partially right; the APP agent's *direction* wins.**

Hard evidence re-read:
- `app/lib/supabase-admin.ts:20-21` reads `process.env.SUPABASE_URL` + `process.env.SUPABASE_SERVICE_KEY`.
- `.env` (real file) line 13: `SUPABASE_SECRET_KEY=sb_secret_...` is SET. **`SUPABASE_SERVICE_KEY` is NOT present in `.env` at all.**
- `.env.example` does list BOTH: `SUPABASE_SECRET_KEY=` (line 18, the service/secret key, "bypasa RLS" per lines 22/41) AND `SUPABASE_SERVICE_KEY=` (line 67, documented lines 56-66 as the var the admin surface reads). So CONFIG is correct that `.env.example` intentionally lists two names — but they are **the same role** (service_role key), not two distinct roles. The doc block at line 63-67 even says "the admin surface reads/writes with the SERVICE key via `app/lib/supabase-admin.ts`" — i.e. `SUPABASE_SERVICE_KEY` is meant to hold the *same* service_role value that `SUPABASE_SECRET_KEY` already holds.
- Repo-wide naming is genuinely divergent (this is the root cause): Cámara/probidad/app-public CLIs read `SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`; lobby/money/tramitación CLIs read `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`. The GH workflows bridge it explicitly: `lobby-leylobby-weekly.yml:57-63` maps `SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}` and comments "ENV NAMES DIVERGENTES."
- The repo ALREADY recognizes this as a bug, not a feature: `docs/RUNBOOK-lockdown-cutover.md:200-203` — "`createAdminSupabase()` usa `SUPABASE_SERVICE_KEY`, pero `.env` define `SUPABASE_SECRET_KEY` → el cliente admin está mis-wired hoy y gated OFF … ese bug es deuda separada." `43-discovery-planning.md:73-77` concurs.
- App-internal convention: app modules read `SUPABASE_URL` (not `SUPABASE_API_URL`): `supabase.ts:34`, `web-reader-jwt.ts:98`, `.dev.vars.example:10`. So the admin client's `SUPABASE_URL` half is consistent with the app; only the key half (`SUPABASE_SERVICE_KEY`) diverges from the one name that actually carries a value in `.env` (`SUPABASE_SECRET_KEY`).

- **REAL** (`app/lib/supabase-admin.ts:21`). Not a false positive. CONFIG's "two distinct roles" framing is wrong — they're one role under two names; the operator would have to duplicate the same secret into a second var.
- **Root cause:** repo-wide env-name divergence (`SECRET_KEY` vs `SERVICE_KEY` for the one service_role value), never reconciled in the app surface. The admin file picked the worker-side name; `.env` only carries the Cámara-side name.
- **What breaks if left alone:** the moment `ADMIN_REVISION_ENABLED=true` is flipped in prod with only `SUPABASE_SECRET_KEY` set (the canonical value-bearing name), `createAdminSupabase()` throws "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY" → `/admin/revisar-entidades` 500s on first use. Currently MASKED because the gate is OFF (404 before the client is built). Latent, not live.
- **What breaks if touched (rename read → `SUPABASE_SECRET_KEY`):** nothing live — gate is OFF, no current request path builds this client. The app deploy already expects the operator to provide secrets; aligning to `SUPABASE_SECRET_KEY` matches the only name with a value in `.env`.
- **Protecting test:** NONE. `app/app/admin/revisar-entidades/page.test.tsx` fully mocks `createAdminSupabase` (lines 41-44) → the env read is never exercised. No `supabase-admin.test.ts` exists.
- **VERDICT: FIX-NOW** (latent-but-confirmed, one-line, no live behavior change, gated OFF). Pair with a new unit test so the rename is locked.

**Exact minimal change:**
- `app/lib/supabase-admin.ts:21`
  - before: `  const serviceKey = process.env.SUPABASE_SERVICE_KEY;`
  - after:  `  const serviceKey = process.env.SUPABASE_SECRET_KEY;`
- Also update the two human-facing strings for consistency (no behavior change):
  - line 15 docstring `SUPABASE_SERVICE_KEY` → `SUPABASE_SECRET_KEY`
  - line 25 error message `SUPABASE_SERVICE_KEY` → `SUPABASE_SECRET_KEY`
- `.env.example`: remove the duplicate `SUPABASE_SERVICE_KEY=` (line 67) and its block (56-66 keep the *gate* note for `ADMIN_REVISION_ENABLED`, but repoint the SERVICE-key sentence to "uses `SUPABASE_SECRET_KEY` (the service_role key already defined above) via `app/lib/supabase-admin.ts`"). This kills the "duplicate the same secret under a second name" trap.
- `docs/RUNBOOK-lockdown-cutover.md:200-203`: update the exclusion note to "fixed in Phase 43" (doc-only; optional, not gating).

**Protecting test (new — `app/lib/supabase-admin.test.ts`):**
```ts
// mock @supabase/supabase-js createClient to capture (url, key); set/unset env.
it("createAdminSupabase lee SUPABASE_SECRET_KEY (no SUPABASE_SERVICE_KEY)", () => {
  process.env.SUPABASE_URL = "https://ref.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  delete process.env.SUPABASE_SERVICE_KEY;
  createAdminSupabase();
  expect(createClientMock).toHaveBeenCalledWith("https://ref.supabase.co", "sb_secret_test", expect.anything());
});
it("sin SUPABASE_SECRET_KEY → throw fail-closed", () => { /* delete both, expect throw */ });
```
Note: `import "server-only"` at line 1 makes this module hard to import under vitest unless `server-only` is stubbed in the test setup — check `vitest.config.ts`/setup; if not stubbed, either add a `vi.mock("server-only", () => ({}))` at the top of the test (mirrors how the page test sidesteps it by mocking the module) or test via a thin importable seam. This is the one wrinkle that could push APP-01's *test* to need a setup tweak; the rename itself stays trivial.

---

## APP-02 — `leerFicha` swallows DB errors (fabricates "no data")

- **REAL** (`app/app/proyecto/[boletin]/page.tsx:84-94`). Re-read: `const { data } = await sb.from("proyecto_ficha")...maybeSingle()` — `error` is NOT destructured; `return data ?? null`.
- **Root cause:** inconsistent application of the project's #34 honest-error principle. The SAME file applies #34 correctly three times in sibling functions: `FichaSection` (133-135), `TimelineSection` (155-159), `VotacionesSection` (176-180) all do `const { data, error } = ...; if (error) throw`. `leerFicha` (the cached helper feeding `#idea-matriz` + `#cuerpos-legales`) was missed.
- **What breaks if left alone:** a transient `proyecto_ficha` error renders "Idea matriz no disponible aún" + empty cuerpos legales — fabricating the honest "not yet available" state from a failure. React.cache means the `null` is shared across both sections in that render.
- **What breaks if touched (add `if (error) throw`):** behavior CHANGES on the error path — a DB error now surfaces the Next error boundary instead of a silent "no data". This is exactly the documented #34 contract and matches the three siblings, so it is the *correct* behavior. BUT it is a behavior change to a shipped page (`/proyecto/[boletin]`), and there is NO test on this page.
- **Protecting test:** NONE (`app/app/proyecto/**` has no `.test.*`). Per the gate, a behavior change to a shipped feature requires a new test.
- **VERDICT: FIX-NOW (test-first).** Safe and correct, but MUST ship with a new test or it violates the gate.

**Exact minimal change** (`page.tsx:84-93`):
```ts
const leerFicha = cache(
  async (boletin: string): Promise<ProyectoFichaRow | null> => {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("proyecto_ficha")
      .select("*")
      .eq("boletin", boletin)
      .maybeSingle<ProyectoFichaRow>();
    if (error) {
      throw new Error(`No se pudo leer la ficha de ${boletin}: ${error.message}`);
    }
    return data ?? null;
  },
);
```
**Test (new — `app/app/proyecto/[boletin]/page.test.tsx`):** mock `createServerSupabase` to return `{ data: null, error: { message: "boom" } }` from `maybeSingle`, render `IdeaMatrizSection` (or call `leerFicha`), assert it rejects/throws `/boom/` (mirror of `listarPendientes` "error real → THROW" test). Add a happy-path: `error:null, data:null` → renders "no disponible" (locks that empty ≠ error).

---

## APP-03 — `proyecto` hydration swallows DB errors (`/buscar` + `VotosSection`)

- **REAL, both sites.**
  - (a) `app/app/buscar/page.tsx:92-95`: `const { data: proyectos } = await sb.from("proyecto").select("*").in("boletin", boletines)` — `error` not destructured.
  - (b) `app/components/votos-por-parlamentario.tsx:663-666`: `const { data: proyectos } = await sb.from("proyecto").select("boletin, materia").in("boletin", boletines)` — `error` not destructured.
- **Root cause:** same #34 inconsistency. Note (b) sits **right next to** correctly-handled calls: the `votos_de_parlamentario` RPC just above (646-655) and `rebeldias_de_parlamentario` just below (679-687) BOTH destructure `error` and throw. The materia hydration in between is the lone omission.
- **What breaks if left alone:** (a) a transient error → `[]` → `/buscar` shows "Sin resultados" for a valid query (kNN already returned neighbors, so this is a fabricated empty). (b) materia map stays empty → all materia chips vanish / votes show null materia. Both silent.
- **What breaks if touched:** error path now throws → Next error boundary. (a) is a clean throw. (b) is more consequential: throwing on the *materia* hydration would take down the WHOLE votos section over a secondary enrichment query. The materia is explicitly "enrichment, never fabricated" — arguably a *degraded-but-honest* empty-materia is acceptable there, whereas an empty *search* is not. This asymmetry matters.
- **Protecting test:** (a) NONE (no buscar/page test). (b) `votos-por-parlamentario.test.tsx` tests `derivarVotosViewData`/`VotosView` (pure) but NOT the `VotosSection` data fetch → the materia hydration path is untested.
- **VERDICT:**
  - (a) `/buscar` hydration: **FIX-NOW (test-first)** — throw on error is correct (empty search ≠ fabricated). Needs a new buscar/page test.
  - (b) `VotosSection` materia hydration: **FIX-NOW (test-first), but throw is the WRONG fix.** Recommend log-and-continue (honest empty materia is a documented degraded state for this *secondary* query; a transient materia error should not 500 the entire votos page that already has real votes). Minimal: `const { data: proyectos, error } = ...; if (error) console.error("VotosSection materia hydration failed:", error);` then proceed. This preserves shipped behavior (votes still render) while removing the silent swallow. If the reviewer prefers strict #34 parity (throw), that is defensible too but degrades resilience of a shipped page — either way a new test is required.

**Change (a)** (`buscar/page.tsx:92-95`): destructure `error`, `if (error) throw new Error("buscar: hidratación de proyectos falló: " + error.message)`.
**Change (b)** (`votos-por-parlamentario.tsx:663`): destructure `error`, `if (error) console.error(...)` (log-and-continue) — NOT throw.
**Tests:** (a) new buscar/page test: kNN mock returns neighbors, hydration mock returns `{data:null,error}` → expect throw. (b) extend votos test with a `VotosSection`-level mock asserting votes still render when materia hydration errors (and a `console.error` spy fires).

> Severity note: discovery rated APP-03 "high" uniformly. Site (b) is lower-stakes than (a) because it degrades a secondary enrichment, not the primary result — and throwing there would *regress* resilience. Discovery slightly overstated (b).

---

## APP-04 — `VotosSection` fetches up to 1000 votes in one RPC (truncation + memory)

- **REAL as described** (`votos-por-parlamentario.tsx:646-649`, `p_limit: 1000`), and the line-643 comment "Para volúmenes grandes, mover a un RPC de conteo" confirms it is a known, deliberately-deferred design. NOTE: this is NOT an error-swallow — `todasError` IS checked (650-655). Discovery correctly scoped it as a scale/truncation issue.
- **Root cause:** intentional MVP simplification — aggregate stats (asistencia totals) are computed client-side over a single capped fetch instead of a dedicated count RPC + server-paginated data fetch.
- **What breaks if left alone:** a parlamentario with >1000 confirmed votes silently truncates with no honest-state indicator (violates #34 in spirit), plus per-request SSR memory for active senators. Today: not triggered (votaciones coverage is ~2 boletines per MEMORY; no senator is near 1000 confirmed votes), so it is a *future* cliff, not a live defect.
- **What breaks if touched:** the proposed fix = add a count RPC + true server pagination. That is a new RPC (DB migration → PROD apply) and a rework of `VotosSection`'s data flow and the totals derivation. That is re-architecture touching a shipped feature and the database — squarely outside "hygiene."
- **Protecting test:** partial — `derivarVotosViewData` pagination is tested (pure), but no test asserts truncation honesty or count correctness.
- **VERDICT: WON'T-FIX (deferred).** Requires a new count RPC (PROD migration/apply → CHECKPOINT territory) and behavior rework of a shipped page; benefit is latent (no current parlamentario approaches the cap). Re-architecture, not hygiene. Track in the debt ledger. *Cheap optional mitigation that IS hygiene:* if `todas.length === 1000`, render an honest "mostrando los 1000 más recientes" notice — but even that is a shipped-UI change needing a test; defer with the rest.

---

## APP-05 — non-null assertion `!` on Map lookup in `agruparAudiencias`

- **REAL** (`lobby-de-parlamentario.tsx:280`: `return orden.map((id) => porId.get(id)!);`). Re-read the loop (250-281): every `id` pushed to `orden` (267) is set in `porId` (266) in the same branch → the invariant holds by construction TODAY. The `!` is currently sound.
- **Root cause:** a non-null assertion encoding a construction invariant that isn't enforced by the type system — fragile to future refactors that filter `orden` independently.
- **What breaks if left alone:** nothing today. Latent: a future refactor could let `orden` contain an id absent from `porId`, and `!` would yield `undefined` items → `LobbyView` `.map()` crash → 500 on the ficha.
- **What breaks if touched (filter fix):** the proposed `...filter((a): a is LobbyAudienciaRow => a !== undefined)` produces an IDENTICAL result today (no undefined exists), so zero behavior change on every real input. Pure defensive hygiene.
- **Protecting test:** NONE — `agruparAudiencias` is `export`ed (247) but `lobby-de-parlamentario.test.tsx` has no reference to it. The component-level lobby tests exercise it only indirectly.
- **VERDICT: FIX-NOW.** Behavior-preserving refactor (provably identical output today). Since the function is exported and currently untested, add a tiny unit test to lock the grouping/order so the refactor is green-proven.

**Change** (`lobby-de-parlamentario.tsx:280`):
- before: `  return orden.map((id) => porId.get(id)!);`
- after:  `  return orden.map((id) => porId.get(id)).filter((a): a is LobbyAudienciaRow => a !== undefined);`
**Test (new, in `lobby-de-parlamentario.test.tsx`):** call `agruparAudiencias` with two filas sharing an `identificador` (one with contraparte, one null-contraparte) + a second audiencia → assert 2 grouped audiencias in insertion order, contrapartes merged, null-contraparte not fabricated. This locks both the invariant and the refactor.

---

## APP-06 — `sourceLabel` substring ordering (lobby before transparencia)

- **REAL but already mitigated AND already protected.** Re-read `types.ts:570-587`: `if (o.includes("lobby"))` precedes the `transparencia` branch, with a comment documenting exactly why (`"camara-transparencia-lobby"` contains "transparencia").
- **Discovery error:** it claims `source-label.test.ts` "should exist but was not found in the glob." **It exists** — `app/lib/source-label.test.ts`, and it tests the precise adversarial case at lines 18-21: `sourceLabel("camara-transparencia-lobby")` → `"Ley del Lobby"`, plus probidad, diputados, senado, and null fallback.
- **Root cause:** substring matching is order-dependent by nature. Genuinely fragile to a *new* origen that contains both tokens in a new combination — but that is a hypothetical future ingestion string, not present debt.
- **What breaks if left alone:** nothing today (every current origen is covered + tested). A future origen like `"senado-lobby-transparencia"` would resolve to "Ley del Lobby" — correct-by-order, which is the intended precedence anyway.
- **What breaks if touched (enum/prefix map):** rewriting to an exact/prefix map is a redesign of a working, tested function; risk of regressing the documented precedence for no current benefit.
- **Protecting test:** EXISTS and covers the ordering case.
- **VERDICT: WON'T-FIX (working as designed, protected; re-architecture without benefit).** Discovery understated that the test already exists; the only residual hygiene would be *adding* a test the moment a new ambiguous origen is introduced — defer to that future ingestion phase, not now.

---

## APP-07 — `leerFicha` module-scope `React.cache`

- **FALSE-POSITIVE (as a defect).** Re-read `page.tsx:1` (`import { Suspense, cache } from "react"`) and `:84`. This is `React.cache`, which is request-scoped within a render tree — module-level `const` declaration is the *documented, correct* usage pattern. Discovery's own text concedes "The pattern is correct for current use" and "Not currently exploitable."
- **Root cause:** none — no defect. The "risk" is a hypothetical of someone in the future importing `leerFicha` into a Route Handler outside a render tree, which does not exist in the repo.
- **What breaks if left alone:** nothing. `leerFicha` is only consumed by Server Components in this file.
- **What breaks if touched:** moving it inside the component would DEFEAT the cross-section dedupe (the whole point of #33: `IdeaMatrizSection`, `CuerposLegalesSection`, and `VotacionesSection` share one query). A net regression.
- **Protecting test:** N/A.
- **VERDICT: WON'T-FIX.** Not debt. At most a one-line clarifying comment ("React.cache is request-scoped; only call within a render tree") — optional, non-gating, no code change.

---

## APP-08 — `buscarProyectos` catch swallows error with no logging

- **REAL** (`buscar/page.tsx:64`: `} catch {` — no binding, no log). The generic error UI is rendered but the error object is discarded. Confirmed.
- **Root cause:** observability gap. The catch correctly distinguishes "error" from "empty/degraded" (good — comment at 65), but emits nothing to server logs, so a missing `GEMINI_API_KEY`, a Gemini 429, an RPC timeout, and a genuine bug are indistinguishable in prod.
- **What breaks if left alone:** search can be silently broken in prod with zero signal in Cloudflare logs.
- **What breaks if touched (add `catch (err) { console.error(...) }`):** ZERO user-visible behavior change — the same error UI still renders; only a `console.error` is added. This is NOT a behavior change to the shipped feature (UI identical); it is additive observability.
- **Protecting test:** `lib/buscar.test.ts` tests `buscarProyectos` itself; the page's catch is untested, but since the UI output is unchanged, no behavior contract is altered. A spy test is nice-to-have, not gate-required.
- **VERDICT: FIX-NOW.** Pure additive hygiene (logging only), no behavior change. Test optional.

**Change** (`buscar/page.tsx:64`):
- before: `  } catch {`
- after:  `  } catch (err) {` ... add as first line of the block: `    console.error("buscarProyectos failed:", err);`
**Test (optional):** spy `console.error`, make `buscarProyectos` reject, render `Resultados`, assert the error UI renders AND `console.error` was called once. Keeps the existing "error ≠ empty" contract intact.

---

## APP-09 — seed knob (SERVICE vs SECRET) "VERIFIED FALSE"

- This is the discovery agent's own seed-verification note, not a separate finding. It correctly confirms the mismatch is real (= APP-01). **Subsumed by APP-01.** No independent verdict. (Its phrasing "VERIFIED FALSE" refers to the *seed hypothesis being a false-OK*, i.e. the debt is real — consistent with my APP-01 FIX-NOW.)

---

## APP-10 — duplicate of APP-03(a)

- Discovery itself marks this "Already documented in APP-03. No separate entry needed." Re-read confirms `buscar/page.tsx:92-95` is the same line as APP-03(a). **Subsumed by APP-03(a); no separate verdict.**

---

## APP-11 — `web-reader-jwt.ts` module-level cache (5-min 401 window on JWT rotation)

- **REAL but benign / operational, not a code defect** (`web-reader-jwt.ts:70`: `let _cache = null`). Re-read 69-102: the singleton is the intended in-process token cache; on Cloudflare isolates it is effectively per-isolate. The only real risk is the documented 5-minute (TTL) stale-token window after a JWT-secret rotation.
- **Root cause:** by design — an in-process cache with a 300s TTL inherently can serve a token signed by a just-rotated secret until expiry.
- **What breaks if left alone:** after a (rare, operator-initiated) `SUPABASE_JWT_SECRET` rotation, up to ~5 min of 401s on read paths; self-healing on cache expiry. No data loss.
- **What breaks if touched:** any "fix" (invalidate-on-rotation) needs a rotation signal the process doesn't have, or a cache-bust mechanism — added complexity for a self-healing, operator-rare event. Discovery's own "fix" is "restart the process on rotation" = an operator runbook note, not code.
- **Protecting test:** `web-reader-jwt.test.ts` exists and covers minting/expiry; the cache TTL behavior is testable but no rotation test is warranted.
- **VERDICT: WON'T-FIX (intentional; operational).** Optionally add a one-line code comment documenting the 5-min grace window post-rotation, and a line in the cutover runbook ("rotate JWT secret → redeploy/restart to flush the token cache"). Non-gating.

---

## APP-12 — `VotoFichaMencion` "dead/test-only" type

- **REAL but OVERSTATED by discovery.** Re-read: the *type* `VotoFichaMencion` (`types.ts:186`) is consumed by a **production component** `VotoFichaMencionRow` (`voto-ficha-row.tsx:155`, exported, imported at line 13 of a non-test `.tsx`). So it is NOT a "dead export" in the type sense. However, grepping production render paths (`VotoFichaMencionRow` excluding tests) shows the *component* is exported but **never rendered** anywhere in the app — only `votos-por-parlamentario.test.tsx` renders it. So: the type is live (referenced by an exported component); the component is ready-but-unwired for the not-yet-shipped state-(b) "mención no confirmada" rendering path. The JSDoc (180-184) explicitly says the confirmed RPC doesn't emit these and the component "la soporta" for future probable/no_confirmado mentions.
- **Root cause:** forward-looking infrastructure for an unshipped feature (state-(b) identity-marked mentions), kept green by tests.
- **What breaks if left alone:** nothing — zero runtime impact. Mild maintenance confusion only.
- **What breaks if touched (move type to test fixtures):** would BREAK the production import in `voto-ficha-row.tsx:13` — the type is genuinely imported by shipped code. The discovery's "move to test/fixtures/types.ts" fix is WRONG: it would require also moving/deleting `VotoFichaMencionRow`, which is intentional pre-built infra.
- **Protecting test:** `votos-por-parlamentario.test.tsx` (lines 4, 46-47, 100+, 290+) exercises `VotoFichaMencionRow` with `VotoFichaMencion` fixtures — the type/component ARE under test.
- **VERDICT: WON'T-FIX (intentional forward infra; discovery's proposed move is unsafe).** At most: tighten the JSDoc to read "type consumed by `VotoFichaMencionRow` (exported, not yet wired into any render path); kept for the unshipped state-(b) mention rendering." Doc-only, optional, non-gating. Discovery overstated "dead."

---

## Summary

| ID | Verdict | One-line reason |
|----|---------|-----------------|
| APP-01 | **FIX-NOW** (test-first) | Real env-name mismatch; rename read `SUPABASE_SERVICE_KEY`→`SUPABASE_SECRET_KEY` (the only value-bearing name); gated OFF so no live change; add `supabase-admin.test.ts`. CONFIG's "two roles" framing rejected. |
| APP-02 | **FIX-NOW** (test-first) | `leerFicha` omits #34 error-throw its 3 siblings apply; add `if(error) throw` + new proyecto/page test. |
| APP-03a | **FIX-NOW** (test-first) | `/buscar` hydration swallows error → fabricated "Sin resultados"; throw + new buscar/page test. |
| APP-03b | **FIX-NOW** (test-first) | Votos materia hydration swallows error; fix = LOG-and-continue (NOT throw — secondary enrichment shouldn't 500 the page); new test. |
| APP-04 | **WON'T-FIX** (deferred) | 1000-row cap fix needs a new count RPC (PROD migration) + rework of a shipped page; latent cliff, no current parlamentario near cap. |
| APP-05 | **FIX-NOW** | `!` invariant holds today; filter replacement is output-identical (pure hygiene); add unit test for `agruparAudiencias`. |
| APP-06 | **WON'T-FIX** | Working as designed AND already protected by `source-label.test.ts` (discovery wrongly said the test is missing). |
| APP-07 | **WON'T-FIX** | Not debt — `React.cache` module-const is the correct request-scoped pattern; moving it would regress the cross-section dedupe. |
| APP-08 | **FIX-NOW** | Additive logging only (`catch (err){console.error}`); identical UI → no shipped-behavior change. |
| APP-09 | — | Seed note, subsumed by APP-01. |
| APP-10 | — | Duplicate of APP-03a. |
| APP-11 | **WON'T-FIX** | Intentional in-process token cache; 5-min stale window post-rotation is operational (restart/redeploy), self-healing. |
| APP-12 | **WON'T-FIX** | Type IS consumed by exported `VotoFichaMencionRow` (forward infra, under test); discovery overstated "dead" and its "move" fix would break a real import. |

**Net actionable for Phase 43 (autonomous, hygiene, test-first where shipped behavior changes):** APP-01, APP-02, APP-03a, APP-03b, APP-05, APP-08 = **6 FIX-NOW**. Deferred/intentional: APP-04, APP-06, APP-07, APP-11, APP-12 = **5 WON'T-FIX**. APP-09/APP-10 are non-findings (subsumed).

Discovery accuracy notes: APP-06 understated (claimed missing test that exists → near false-positive). APP-12 overstated ("dead" — actually live-typed forward infra). APP-03 slightly overstated site (b) (throw would regress resilience). APP-04 is real but mis-scoped as "hygiene" — it's a deferred re-architecture. APP-07 is a non-defect by discovery's own admission.
