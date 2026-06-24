# Phase 43 — DEBT-LEDGER

**Date:** 2026-06-24
**Method:** Premortem swarm (6 Sonnet, 1/dimension) → adversarial Opus 1-by-1 validation → FIX-NOW only.
**Baseline (must stay green between every fix):** app 316/316 · `tsc -b` clean · packages all green (752).

Detail per finding: `43-discovery-{dim}.md` (evidence) + `43-validation-{dim}.md` (Opus verdict).

## Disposition summary

| Verdict | Count | Meaning |
|---------|-------|---------|
| **FIX-NOW** (applied this phase) | 24 | Safe, autonomous, provably green. Atomic commits below. |
| **CHECKPOINT-OPERADOR** | 9 | Artifact WRITTEN by agent; apply/decision = operator. |
| **WON'T-FIX / FALSE-POSITIVE / RESOLVED** | 22 | Intentional, immutable, already-guarded, or refuted. |
| **FOLD-INTO-CLOSURE** | 5 | ROADMAP/STATE status fixes done in the DEBT-04 closure commit. |

The "nada por sentado" payoff: the two discovery *criticals* both fell to validation — **PKG-01** (agenda onConflict) was a FALSE-POSITIVE (migration 0016 added the 3-col unique index; the discovery "fix" would have *caused* the crash) and **TEST-02** (CI quality gate) is a real gap but operator-gated (CI minutes). Plus 9 more false-positives caught.

---

## A. FIX-NOW (applied — atomic commits, suite green between each)

### Code — silent-failure & safety hygiene (app/)
- **APP-01** `app/lib/supabase-admin.ts:21` reads `SUPABASE_SERVICE_KEY`; `.env` only sets `SUPABASE_SECRET_KEY` (sole value-bearing name; repo already flags this in RUNBOOK). **Fix:** read `SUPABASE_SECRET_KEY`, drop duplicate `.env.example` entry, add `supabase-admin.test.ts` (stub `server-only`). Latent (admin gated OFF) — no behavior change to a live surface.
- **APP-02** `app/app/proyecto/[boletin]/page.tsx` `leerFicha` swallows `error` → fabricates "no data". **Fix:** destructure+throw (matches the `#34` honest-error its 3 siblings already apply) + test.
- **APP-03a** `app/app/buscar/page.tsx:92` hydration swallows error → false "Sin resultados". **Fix:** destructure+throw + test.
- **APP-03b** `app/components/votos-por-parlamentario.tsx:663` materia hydration swallows error. **Fix:** **log-and-continue (NOT throw)** — secondary enrichment must not 500 a page that already has real votes (Opus correction) + test.
- **APP-05** `app/components/lobby-de-parlamentario.tsx:280` non-null `!` on Map lookup. **Fix:** `.filter()` — output-identical hardening.
- **APP-08** `app/app/buscar/page.tsx:64` bare `catch{}` no logging. **Fix:** `catch (err) { console.error(...) }` — additive observability, identical UI.

### Code — observability hygiene (packages/)
- **PKG-02** `packages/dinero/src/reconciliar-contrato.ts:474` bare catch swallows `enqueueRevision` failure. **Fix:** `console.error` (observability only, candidate already in returned audit array — NOT a re-throw) + a throwing-writer test (currently uncovered).
- **PKG-08** `packages/agenda/src/writer-supabase.ts:8` comment documents wrong onConflict. **Fix:** correct the comment to match the live 3-col key (0016). Doc-only.
- **PKG-11** `packages/cruces/src/sector.ts:43` `SECTOR_CODIGOS` hand-synced to `SECTOR_CATALOGO`. **Fix:** a drift-guard **test** (the `.map()` derive trips `z.enum`'s literal-tuple requirement → not tsc-clean) + correct the false "Derivada" comment.
- **PKG-13** `packages/llm/src/validate.ts:62` `safeJsonParse` swallows parse error. **Fix:** `console.warn` with first chars of raw (observability only; NOT added to reprompt) + keep behavior.

### Tests / CI hygiene (provably green now)
- **TEST-01** root `package.json` `test` excludes `app/`. **Fix:** append `&& pnpm --filter ./app test` (or `-r` incl app) — both suites already green.
- **TEST-03** `packages/votos/vitest.config.ts` includes `*.live.test.ts`. **Fix:** `exclude: ["**/*.live.test.ts"]`.
- **TEST-04** `packages/cruces/src/writer-supabase.ts` untested. **Fix:** new mock-based test (mirror `fichas/writer-supabase.test.ts`; real tables = `proyecto_ficha`+`lobby_contraparte`).
- **TEST-05** `packages/dinero/src/ingest-run.ts` untested. **Fix:** new test for degradation/quarantine paths (mirror `ingest-run-servel.test.ts`); degrade to DEFERRED if happy-path fixture proves fragile.
- **TEST-08** `app/lib/admin-gate.ts` untested. **Fix:** new 5-case truth-table test (clone money/net/cruces-gate test).
- **TEST-08b** `app/lib/utils.ts` `safeExternalHref` (XSS guard) untested. **Fix:** new pure-function test.
- **TEST-09** orphan root `vitest.config.ts`. **Fix:** header comment clarifying it's not used by `pnpm test`.
- **TEST-10** `packages/core/src/provenance.test.ts` real `Date.now()` window. **Fix:** widen to `before-1 / after+1` ms — deterministic, no SUT change.

### Config / deps / build hygiene
- **CFG-01** `.claude/` not ignored. **Fix:** add to `.gitignore` (confidentiality).
- **CFG-02/03/04/05** `.env.example` missing `SUPABASE_ANON_KEY`, `PUBLIC_INDEXABLE`, `SUPABASE_LOCAL_*`, `SUPABASE_URL` (alias), `SUPABASE_DB_URL`. **Fix:** add empty placeholders + notes (no secret values; vars confirmed read by code).
- **CFG-06** root `tsconfig.json` references omit lobby/probidad/dinero/fichas/cruces → not typechecked by `tsc -b`. **Fix:** add the 5 references (Opus verified each builds EXIT 0 standalone; re-run `tsc -b` after). Top functional finding.
- **CFG-07** `tsconfig.base.json` `paths` drift (missing @obs/* aliases). **Fix:** add missing paths (additive; resolution already works via refs, so low-impact alignment).
- **CFG-10** `docker-cf-build.sh` `--no-frozen-lockfile` + `|| echo` mask. **Fix:** align to CI (`--frozen-lockfile --ignore-scripts`, drop the mask). Operator-only build script.
- **CFG-14** `pnpm-workspace.yaml` `openai@6.44.0` pin without rationale. **Fix:** add dated comment.

### Docs hygiene
- **DB-05** 25 pgTAP files carry stale `-- Corre vía supabase test db` header. **Fix:** replace with `-- Corre vía: psql -tA -f …` (pure text, no migration).
- **PLAN-08** 4 stale HANDOFFs for closed phases. **Fix:** prepend `<!-- COMPLETED: <date> -->` header (no move/delete → MEMORY.md pointers intact).

---

## B. CHECKPOINT-OPERADOR (artifact written; apply/decision = operator)

- **DB-01 + DB-03 + DB-07 + DB-08** → **migration `0045_revoke_public_rpc_gap.sql` WRITTEN** (revoke-execute-from-public on 6 public RPCs + 2 schema materializers) + pgTAP `0045_*.test.sql`. Safe no-op on current PROD (0044 already revoked anon; owner/cron/service_role/web_reader retain execute); hardens fresh-reset/partial-rollback + the `cruces`/`grafo` schemas that 0044's public-only ADP doesn't cover. **Apply = operator** (`psql --single-transaction` + schema_migrations; NEVER `db push`). **Guardrail recorded:** any future `grant usage on schema cruces|grafo to anon` MUST pair with these revokes.
- **TEST-02** CI quality-gate workflow (`ci.yml`) — spends GitHub Actions minutes (operator minimizes them) + needs branch-protection; no auto-deploy exists to protect. Operator decision.
- **TEST-07** pgTAP-in-CI (Postgres service container + pg_prove) — non-trivial infra + Actions minutes. Bundle with TEST-02.
- **CFG-08** `app/tsconfig.json` target ES2017→ES2022 — SWC owns the deployed transpile; proving green needs a Linux Docker app build. Not autonomously provable.
- **CFG-09** Deno `zod@3`→`zod@4` in `supabase/functions/deno.json` — touches the deployed ingest-worker runtime; needs Deno verify + redeploy (gated). **Guardrail:** if shared `@obs/*` zod schemas adopt v4-only API, the Edge Function breaks silently — track.
- **CFG-11** real linter (ESLint) over `packages/**` — adoption decision (unknown red surface + CI minutes). Faking it with `|| true` rejected as theater.
- **CFG-13** `backfill.yml` `--no-check` removal — likely reds the Deno workflow (sloppy-imports); CI change, bundle with CFG-09.
- **DB-04 (0013/0014/0017) + DB-09 (0031)** coverage pgTAP — agent cannot execute pgTAP (no PROD), so writing them risks shipping an unverified test that reds the operator's green pgTAP run. **DEFERRED to operator** as a write+run coverage task (genuine gaps: 0013 estado_error, 0014 dedup, 0017 search_path hardening, 0031 bienes_de_parlamentario).
- **PLAN-06** `docs/legal/17-LEGAL-DOSSIER-NET.md` front-matter is `signoff: approved` but the §8 body prose still says `pending` — internal contradiction in a SIGNED artifact. Never silently edit a signed dossier body → operator reconciles. (ROADMAP side folded into closure.)
- **PLAN-13** MEMORY.md uses absolute OneDrive paths — memory lives outside the repo; agent never edits user memory silently. Operator/owner note.

---

## C. WON'T-FIX / FALSE-POSITIVE / RESOLVED (with reason)

| ID | Verdict | Reason |
|----|---------|--------|
| **PKG-01** | FALSE-POSITIVE | Migration `0016` DROPs the 2-col key and ADDs `unique(citacion_id,nombre,calidad)`; writer matches live schema. Discovery only read `0010`. Its "fix" would have caused the 42P10 it predicted. |
| **APP-04** | WON'T-FIX (defer) | 1000-row cap needs a new count RPC (PROD migration) + page rework; latent, no parlamentario near cap. Re-architecture. |
| **APP-06** | WON'T-FIX | Works as designed AND already covered by `source-label.test.ts` (tests the exact ordering case). |
| **APP-07** | WON'T-FIX | Correct `React.cache` per-request pattern; moving it regresses dedupe. Not debt. |
| **APP-11** | WON'T-FIX | Intentional in-process token cache; 5-min post-rotation window is operational/self-healing. |
| **APP-12** | WON'T-FIX | `VotoFichaMencion` IS consumed by an exported production component; "move to fixtures" would break a real import. |
| **PKG-03** | WON'T-FIX | `LEGISLATURA_VIGENTE=58` real but a 2030 fuse; runtime-query fix = behavior change + network dep, own phase. |
| **PKG-04** | FALSE-POSITIVE | `proveedorAusente` guard re-throws with a real provider — correct. |
| **PKG-05** | WON'T-FIX | Shallow copy-paste; extracting a helper couples intentionally-divergent compliance paths. |
| **PKG-06** | WON'T-FIX | SDK default = 2 retries; MiniMax "non-standard 429" unverified; retry = behavior change. |
| **PKG-07** | FALSE-POSITIVE | Already logs `console.warn`; proposed exitCode/R2 regresses the FND-04 contract. |
| **PKG-09** | FALSE-POSITIVE | Both writers check `{error}` + throw; `.select()` forces execution. |
| **PKG-10** | WON'T-FIX (autonomous) | Real LOW; row-count check needs a `.select()` wire change → deferred coverage task, not a silent fix. |
| **PKG-12** | WON'T-FIX | Intentional polymorphic `decodeJson` contract; Zod gate at callers is the guard. |
| **DB-02** | WON'T-FIX | Immutable 0036; bug fully overwritten by 0037 on sequential replay; already test-guarded (0037 test #9). |
| **DB-06** | RESOLVED | `plan(10)` statically == 10 asserts; discovery undercounted (missed `cmp_ok`). Not a live-check item. |
| **DB-10** | RESOLVED | `0037` test assert #9 already locks `vinculo_id IS NULL` — the guard discovery proposed already exists. |
| **CFG-12** | WON'T-FIX | Recursive `.gitignore` globs already cover `packages/*/dist` + `*.tsbuildinfo`. Non-issue. |
| **TEST-06** | WON'T-FIX | Proposed Supabase smoke is mock-heavy/low-value (re-tests the SDK); JWT mint already tested; true boundary is pgTAP. |
| **PLAN-05** | WON'T-FIX | Twin dossiers byte-identical (diff confirmed); one-sided comment touches a signed twin + breaks parity. Ledger note only. |
| **PLAN-07** | FALSE-POSITIVE | 0039 CHECK allows only `'lobby_sector'`; docs consistent. |
| **PLAN-09** | FALSE-POSITIVE | Phase 43 detail block exists (ROADMAP 1004–1021); discovery read only the summary line. |
| **PLAN-10/11/12** | WON'T-FIX | Docs current: TRANSFER/deploy reference correct source repo; RUNBOOK is post-validation (includes DEFAULT_ACL reversal, view audit, 4 curl probes, fail-closed, admin exclusion); DECISION doc dated 06-23 marked ABIERTA. |
| **PLAN-14** | WON'T-FIX | In-progress phase bootstrap — expected state. |

---

## D. FOLD-INTO-CLOSURE (done in the DEBT-04 STATE/ROADMAP commit)

- **PLAN-01** ROADMAP 14-01/14-02 `[ ]`→`[x]` (phase completed).
- **PLAN-02** Phase 17 `[ ]` → built + sign-off now approved.
- **PLAN-03** Add a tracked DEBT-LEDGER cross-ref for the admin env mismatch (code fix = APP-01).
- **PLAN-04** Milestone headers `📋 planned` → `🚧`/`✅` for v2.0/v3.0/v4.0.
- **PLAN-06 (ROADMAP side)** ROADMAP/Phase 31 F17 `pending` → `approved` (dossier body reconciliation = operator, item B).

---

---

## E. Execution outcome (final, 2026-06-24)

**Baseline → final:** app **316 → 341** green (+25 new tests); `tsc -b` clean throughout; packages all green and **dinero un-darkened (0 → 97 tests now actually run)**. Root `pnpm test` now green end-to-end (packages incl. dinero + app). Zero regression — the only red during execution (LOCKDOWN-04 guard tripped by 0045) was caught by the full-suite gate and fixed before closure.

**21 atomic fix commits** (each suite-green):

| Commit | Findings |
|--------|----------|
| `59907f6` | CFG-01 gitignore `.claude/` |
| `1811a65` | CFG-02/03/04/05 `.env.example` |
| `8e22ea7` | CFG-06 tsconfig refs (CFG-07 rejected — see below) |
| `61a4e8a` | CFG-14 openai pin comment |
| `9a779a8` | APP-01 admin key fallback union + test |
| `5355549` | APP-02 leerFicha honest error + test |
| `602b2eb` | APP-03a + APP-08 buscar honest error + log + test |
| `8d5e295` | APP-03b votos materia log-and-continue |
| `31cac2e` | APP-05 lobby filter (no `!`) |
| `aeab365` | PKG-02 enqueue log + test **+ TEST-11 dinero un-dark** |
| `f88a6cb` | PKG-08 agenda comment |
| `ec6db78` | PKG-11 sector drift-guard + TEST-04 cruces writer test |
| `16c70dc` | PKG-13 safeJsonParse log |
| `15405da` | TEST-10 provenance timer window |
| `7ca1a88` | TEST-01 + TEST-09 root test runs app |
| `c737d17` | TEST-03 votos live-probe excluded |
| `2e7ed79` | TEST-08 admin-gate + TEST-08b safeExternalHref tests |
| `5d5c5e7` | DB-05 25 pgTAP headers |
| `23b2df5` | PLAN-08 4 HANDOFF COMPLETED markers |
| `60a8590` | DB-01/03/07/08 → migration 0045 (WRITTEN, not applied) + post-apply pgTAP |
| `9a348c2` | LOCKDOWN-04 guard updated for 0045 |

**Reclassifications discovered DURING execution (the value of provable-green gating):**
- **CFG-07** (add `@obs/*` paths to tsconfig.base.json): validator graded FIX-NOW "low-impact" → **execution proved it HARMFUL**: mapping the aliases to `src/` overrides the pnpm-workspace `.d.ts` resolution and drags cross-package source into each project's `rootDir` → `tsc -b` went red. **Reclassified WON'T-FIX**; only CFG-06 (project references) shipped. Lesson: project references, not path aliases, are the typecheck mechanism here.
- **CFG-10** (docker-cf-build.sh frozen-lockfile): needs a Linux Docker build to prove green (Windows builds 500) → **CHECKPOINT-OPERADOR** (could not verify autonomously).
- **TEST-05** (dinero ingest-run.ts test): **DEFERRED** per the plan-checker's fragility escape-hatch — the dinero-un-dark win (TEST-11) delivered the larger coverage gain.
- **TEST-11** (NEW, swarm missed it): `packages/dinero` had no own `vitest.config.ts` — the only package without one — so its 11 test files (95 tests) never ran. Added the config → all green. Surfaced while wiring the PKG-02 test.

**Final tallies:** FIX-NOW applied **24** (incl. TEST-11; CFG-07 dropped, TEST-05 deferred) · CHECKPOINT-OPERADOR **11** (added CFG-10; the 0045 apply) · WON'T-FIX/false-positive/resolved **23** (added CFG-07) · FOLD-INTO-CLOSURE **5** (done in the closure commit).

## F. Operator checkpoints (nothing applied to PROD by the agent)

1. **Apply migration 0045** (DB-01/03/07/08 hardening) — order `0043 → deploy03 → 0044 → 0045`, `psql --single-transaction` + schema_migrations row, then run `supabase/tests/post-apply/0045_revoke_public_rpc_gap.test.sql`. NEVER `db push`. (Independent of the Phase 42 cutover; safe no-op on current PROD.)
2. **CI quality gate** (TEST-02 `ci.yml` + TEST-07 pgTAP-in-CI) — operator decision on Actions minutes / branch-protection. `pnpm test` + `tsc -b` are now the ready commands.
3. **CFG-08** app tsconfig ES2017→ES2022, **CFG-09/CFG-13** Deno zod@4 + `--no-check`, **CFG-10** docker frozen-lockfile, **CFG-11** real linter for packages/* — each needs a build/runtime verification the agent can't run.
4. **DB-04/DB-09** coverage pgTAP (0013/0014/0017 + 0031 bienes) — write+run against PROD (agent can't execute pgTAP).
5. **PLAN-06** reconcile the `17-LEGAL-DOSSIER-NET.md` §8 body (`pending`) vs its `approved` front-matter — never silently edit a signed dossier. **PLAN-13** MEMORY.md absolute paths — memory is outside the repo.
6. **Pre-existing (NOT this phase):** Phase 42 cutover; flag flips; cron secrets.

*Phase 43 closed 2026-06-24. The validated plan (sections A–D) + this outcome (E–F) are the authoritative ledger.*
