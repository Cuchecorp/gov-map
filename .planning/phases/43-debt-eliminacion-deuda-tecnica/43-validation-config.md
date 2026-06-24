# Adversarial Validation: Deps / Config / Build / Tooling — Phase 43

Validator: Opus (adversarial, 1-by-1). Date: 2026-06-24.
Method: every finding re-verified at file:line; build claims re-run (`tsc -b`).
Gates honored: no PROD apply, no deploy, no cron/secret enable, no real secret printed, `tsc -b` kept green.

**Baseline established:** `npx tsc -b` at repo root → **EXIT 0** (clean) at validation time.

---

## CFG-01: `.claude/` not in `.gitignore`

- **REAL.** Re-read `.gitignore` (31 lines): no `.claude/` entry. `git status --short` → `?? .claude/`; `git check-ignore .claude` → not ignored.
- **Root cause:** `.gitignore` was authored before the Claude harness wrote `.claude/` (memory, transcripts, scheduled_tasks.lock, settings with personal paths).
- **What breaks:** If left — a `git add -A`/`git add .` stages the entire `.claude/` (session history, local operator paths, hooks/skills config) and a push leaks it. Currently untracked, so no leak *yet*. If touched (add the ignore line) — nothing breaks.
- **Protecting mechanism:** None. Only operator discipline (avoiding `git add -A`) stands between this and a leak.
- **Severity check:** Discovery says "high". Agree it is the **highest-value** config finding: it's the only one with a confidentiality blast radius, and the fix is a one-line, zero-risk hygiene change. "high" is fair given leak potential, though note exposure requires an explicit careless `add` (not automatic).
- **VERDICT: FIX-NOW.**
- **Exact change** — `.gitignore`, in the "Editor / OS" block:
  ```
  # Editor / OS
  .DS_Store
  Thumbs.db
  *.log
  ```
  →
  ```
  # Editor / OS
  .DS_Store
  Thumbs.db
  *.log

  # Claude Code harness (memoria, transcripciones, settings locales) — NUNCA commitear
  .claude/
  ```

---

## CFG-02: `SUPABASE_ANON_KEY` and `PUBLIC_INDEXABLE` missing from `.env.example`

- **REAL** (both vars), but **framing partially FALSE**.
  - `app/lib/supabase.ts:34-35` reads `SUPABASE_URL` + `SUPABASE_ANON_KEY` inside `createServerSupabase()` and **throws** if either is absent (lines 37-42).
  - `app/app/layout.tsx:22` reads `PUBLIC_INDEXABLE === "true"`.
  - Neither is in `.env.example`. Confirmed.
- **Correction to discovery:** The discovery claims the anon key powers a "cliente Supabase en el browser" that "falla silenciosamente en producción." That is **inaccurate** — `createServerSupabase()` is a *server-side* client (it mints a web_reader JWT via `accessToken`, per LOCKDOWN). And it does NOT fail silently: it throws a descriptive error. So blast radius is "server SSR Supabase reads throw at boot," not "browser fails silently." The finding (missing doc) stands; the rationale is overstated.
- **Secret check:** `SUPABASE_ANON_KEY` is the public anon key (does NOT bypass RLS) — safe to list as an empty placeholder. `PUBLIC_INDEXABLE` is a boolean feature flag, not a secret. No secret VALUE is added. Safe.
- **Protecting mechanism:** Runtime throw (for anon key) — so a misconfigured deploy fails loud, not silent. The *doc gap* itself has no mechanism.
- **Severity check:** "high" → downgrade to **medium**. It's doc hygiene; the code already fails loud.
- **VERDICT: FIX-NOW** (doc-only, no code change, no secret value).
- **Exact change** — append to `.env.example` `# --- Supabase ---` block:
  ```
  # Clave anon (publica) del proyecto Supabase: sigue siendo el `apikey` de Kong.
  # Safe en server (NO bypasa RLS). La leen createServerSupabase()/supabase-admin.
  SUPABASE_ANON_KEY=
  ```
  and under a new `# --- Frontend ---` block:
  ```
  # Controla <meta name="robots"> en app/app/layout.tsx: solo "true" = indexable;
  # cualquier otro valor (o ausente) => noindex (fail-closed).
  PUBLIC_INDEXABLE=false
  ```

---

## CFG-03: `SUPABASE_LOCAL_URL` / `SUPABASE_LOCAL_SERVICE_KEY` missing from `.env.example`

- **REAL.** Grep confirms ≥7 CLIs read them: `agenda/ingest-cli.ts:139-140`, `tramitacion/ingest-cli.ts:155-156`, `identity/seed-cli.ts:213,215`, `adjudication/revisor-cli.ts:257`, `votos/run-camara-votos.ts:143-144`, `dinero/ingest-cli-servel.ts:111`, `probidad/ingest-cli.ts:97`, `lobby/ingest-cli.ts:114`. None in `.env.example`.
- **Root cause:** Dev-local override vars added incrementally per package; never back-documented.
- **What breaks:** If left — a new contributor running CLIs against `supabase start` doesn't know the override exists; CLIs fall back to PROD URL/key (the discovery's PROD-contamination concern is plausible: many use `?? process.env.SUPABASE_API_URL`/`SUPABASE_SECRET_KEY`). If touched — doc only, nothing breaks.
- **Protecting mechanism:** None (defaulting logic silently picks PROD when local override absent).
- **Severity check:** "medium" fair.
- **VERDICT: FIX-NOW** (doc-only). No secret value (`SUPABASE_LOCAL_SERVICE_KEY=` left empty; local service key is a throwaway dev key, but still leave empty).
- **Exact change** — append a section to `.env.example`:
  ```
  # --- Dev local (Supabase CLI: `supabase start`) ---
  # Override opcional: si se setean, los CLIs de ingesta apuntan al stack LOCAL en
  # vez de SUPABASE_API_URL/SUPABASE_SECRET_KEY. Dejar VACIO en operacion normal.
  SUPABASE_LOCAL_URL=http://localhost:54321
  SUPABASE_LOCAL_SERVICE_KEY=
  ```

---

## CFG-04: `SUPABASE_URL` (alias) missing from `.env.example`

- **REAL.** `app/lib/supabase.ts:34`, `app/lib/supabase-admin.ts:20`, `app/lib/web-reader-jwt.ts:98` read `SUPABASE_URL`. Many CLIs do `... ?? process.env.SUPABASE_URL ?? process.env.SUPABASE_API_URL` (`fichas/pipeline-cli.ts:150`, `cruces/clasificar-*-cli.ts`, `dinero`, `lobby`, `probidad`). `.env.example` only has `SUPABASE_API_URL` (line 19).
- **Root cause:** Two names for the same value (`SUPABASE_URL` ≡ `SUPABASE_API_URL`) accreted across frontend (uses `SUPABASE_URL`) and ingest (`SUPABASE_API_URL`). Genuine alias proliferation.
- **What breaks:** If left — an operator who sets only `SUPABASE_API_URL` (as `.env.example` dictates) leaves `SUPABASE_URL` undefined → `app/lib/supabase.ts` **throws** (fail-loud, not silent) and `web-reader-jwt.ts` gets `""`. The frontend PROD surface (admin + web_reader JWT) needs `SUPABASE_URL`. Real gap. If touched — doc only.
- **Protecting mechanism:** Throw in `createServerSupabase()` catches the frontend case loudly; CLIs fall through to `SUPABASE_API_URL` so they're covered. So the only *uncovered* consumer is the frontend, which fails loud.
- **Severity check:** "medium" fair. Note the *better* fix (code standardization on one name) is out of hygiene scope and risks touching the deployed frontend → keep to the doc fix now.
- **VERDICT: FIX-NOW** (doc-only; add the alias var + note). Do NOT refactor code names in this phase.
- **Exact change** — in `.env.example` `# --- Supabase ---`, after `SUPABASE_API_URL=`:
  ```
  # Alias canonico de SUPABASE_API_URL (mismo valor: https://<ref>.supabase.co).
  # El frontend (supabase.ts, supabase-admin.ts, web-reader-jwt.ts) lee SUPABASE_URL;
  # los CLIs de ingesta leen SUPABASE_API_URL. Setear AMBAS al mismo valor.
  SUPABASE_URL=
  ```

---

## CFG-05: `SUPABASE_DB_URL` missing from `.env.example`

- **REAL.** `lobby/ingest-cli.ts:110`, `dinero/ingest-cli.ts:99`, `dinero/ingest-cli-servel.ts:107`, `probidad/ingest-cli.ts:93` all read `process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_URL ?? ""`. Also referenced in `docs/RUNBOOK-lockdown-cutover.md`. Not in `.env.example`.
- **Root cause:** Direct-Postgres connection string (distinct from REST API URL) needed by `pg`-based bulk/DDL CLIs; never documented.
- **What breaks:** If left — these CLIs fall back to `SUPABASE_URL` (a REST endpoint), which is NOT a valid Postgres DSN → the `pg` client fails to connect. The discovery's "fallback incorrecto" is correct. If touched — doc only.
- **Protecting mechanism:** None benign — fallback to a non-DSN just fails at connect time (loud-ish, but confusing).
- **Severity check:** "medium" fair.
- **VERDICT: FIX-NOW** (doc-only; contains a secret-bearing URL format but the placeholder is empty — no real value).
- **Exact change** — append to `.env.example` `# --- Supabase ---`:
  ```
  # URL DIRECTA de Postgres (no la REST API). La usan los CLIs de lobby/dinero/probidad
  # para bulk/DDL via `pg`. Dashboard -> Settings -> Database -> Connection string.
  # Formato: postgresql://postgres:<password>@<host>:5432/postgres
  SUPABASE_DB_URL=
  ```

---

## CFG-06: Root `tsconfig.json` references omit lobby/probidad/dinero/fichas/cruces

- **REAL.** Re-read `tsconfig.json:3-12`: references = core, ingest, llm, identity, adjudication, tramitacion, agenda, votos (8). Missing: lobby, probidad, dinero, fichas, cruces (5). Confirmed none of the 8 transitively reference the 5 (references point "down" to core/ingest/llm/identity/etc., never to these 5) → `tsc -b` at root genuinely never builds them.
- **CRUX — does adding them keep `tsc -b` green?** I built each missing package standalone:
  - `tsc -b packages/lobby` → EXIT 0
  - `tsc -b packages/probidad` → EXIT 0
  - `tsc -b packages/dinero` → EXIT 0
  - `tsc -b packages/fichas` → EXIT 0
  - `tsc -b packages/cruces` → EXIT 0
  All five are `composite: true` and compile clean today (they're just not wired into the root graph). **Therefore adding the 5 references will keep root `tsc -b` green** — no hidden type errors are being masked.
- **Root cause:** New packages added without updating the root reference list. Pure omission.
- **What breaks:** If left — a refactor of a type exported by `@obs/core`/`@obs/llm` could break these 5 consumers and `pnpm typecheck` (root `tsc -b`) would NOT catch it. (Note: package-level `pnpm -r test` and standalone builds *would* — so the hole is narrower than "invisible," but root typecheck is the canonical gate and is blind here.) If touched — green confirmed.
- **Protecting mechanism:** Currently only standalone/per-package builds; root `tsc -b` does not protect these.
- **Severity check:** Discovery calls this "high" and it is arguably **the single most important config finding** functionally (it's the one that lets real type debt accumulate undetected across 5 production packages including embeddings/cruces/dinero). I concur it's the top *functional* finding (CFG-01 is the top *confidentiality* finding).
- **VERDICT: FIX-NOW** — but executor MUST re-run `tsc -b` after the edit and confirm EXIT 0. I verified green at validation time; if a concurrent change turns it red, escalate (do not silence).
- **Exact change** — `tsconfig.json` references array:
  ```json
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/ingest" },
    { "path": "./packages/llm" },
    { "path": "./packages/identity" },
    { "path": "./packages/adjudication" },
    { "path": "./packages/tramitacion" },
    { "path": "./packages/agenda" },
    { "path": "./packages/votos" },
    { "path": "./packages/lobby" },
    { "path": "./packages/probidad" },
    { "path": "./packages/dinero" },
    { "path": "./packages/fichas" },
    { "path": "./packages/cruces" }
  ]
  ```

---

## CFG-07: `tsconfig.base.json` `paths` missing `@obs/llm`/`votos`/`lobby`/`probidad`/`fichas`/`cruces`

- **REAL but LOW-IMPACT / partly mis-stated.** Re-read `tsconfig.base.json:16-31`: paths map core, ingest, identity, adjudication, dinero, tramitacion, agenda. Missing: llm, votos, lobby, probidad, fichas, cruces. (`dinero` IS in paths but was NOT in root references — the inconsistency the discovery flags; CFG-06's fix resolves the references side.)
- **Correction to discovery:** Discovery claims missing paths cause "module not found" failures. **Disproven by the green baseline:** `@obs/llm` is imported by cruces/fichas/adjudication (grep confirms 15+ imports) and root `tsc -b` is **EXIT 0**. Cross-package resolution happens via **project references** (each package references `../llm` etc.), NOT via base `paths`. The `paths` map is an editor/IDE convenience and a fallback for non-`-b` invocations — it is not on the build's critical path. So this does NOT break the build today.
- **Root cause:** `paths` map drifted out of sync with the reference graph as packages were added.
- **What breaks:** If left — IDE "go to definition"/resolution for the 6 unmapped aliases may degrade in some tooling contexts; a future `tsc` (non-`-b`) invocation relying on paths could miss them. No current build breakage. If touched — additive only; no risk.
- **Protecting mechanism:** Project references protect the build; paths are unguarded but also not load-bearing.
- **Severity check:** Discovery "medium" → downgrade to **low**. This is consistency hygiene, not a build hole.
- **VERDICT: FIX-NOW** (additive, zero-risk; align paths to the reference graph). Re-run `tsc -b` to confirm still green (expected: unchanged EXIT 0).
- **Exact change** — `tsconfig.base.json` `paths`, add (keeping existing entries):
  ```json
  "@obs/llm": ["./packages/llm/src/index.ts"],
  "@obs/llm/*": ["./packages/llm/src/*"],
  "@obs/votos": ["./packages/votos/src/index.ts"],
  "@obs/votos/*": ["./packages/votos/src/*"],
  "@obs/lobby": ["./packages/lobby/src/index.ts"],
  "@obs/lobby/*": ["./packages/lobby/src/*"],
  "@obs/probidad": ["./packages/probidad/src/index.ts"],
  "@obs/probidad/*": ["./packages/probidad/src/*"],
  "@obs/fichas": ["./packages/fichas/src/index.ts"],
  "@obs/fichas/*": ["./packages/fichas/src/*"],
  "@obs/cruces": ["./packages/cruces/src/index.ts"],
  "@obs/cruces/*": ["./packages/cruces/src/*"]
  ```
  (Verify each package exposes `src/index.ts`; cruces/fichas/llm do per their tsconfig `include`.)

---

## CFG-08: `app/tsconfig.json` `target: ES2017` vs base `ES2022`

- **REAL.** `app/tsconfig.json:3` = `"target": "ES2017"`, `lib: ["dom","dom.iterable","esnext"]`. `tsconfig.base.json:3` = `ES2022`. App does NOT extend base (standalone Next.js config). Confirmed.
- **Root cause:** Default target emitted by `create-next-app` (historically ES2017), never bumped.
- **What breaks / nuance:** `app/tsconfig.json` has `"noEmit": true` and Next.js 16 uses **its own toolchain (SWC/Turbopack + OpenNext)** for the actual transpile — the TS `target` here governs *type-checking lib assumptions and what TS would downlevel*, but Next's bundler, not `tsc`, produces the deployed Worker bundle. So the runtime-breakage story ("structuredClone eliminated") is weaker than discovery implies: Next/SWC targets its own baseline irrespective of this `target`. The real effect is: TS's `target: ES2017` + `lib: esnext` is an **incoherent pairing** (lib promises ESNext APIs, target says ES2017) and understates the safe API floor for editors/typecheck.
- **What breaks if touched:** Bumping `target` to `ES2022` is a type-check-surface change. It will not alter the deployed bundle (SWC owns that), and Cloudflare Workers (V8) fully supports ES2022. Risk is low but it IS a build-config change to the deployed app → must be proven green via `tsc -p app` (or `next build` typecheck) and the app test suite before trusting.
- **Protecting mechanism:** `next build` typecheck + app vitest suite. Not unit-test-provable alone (needs the app build).
- **Severity check:** Discovery "medium" → I'd call it **low** (cosmetic/coherence; no proven runtime impact given SWC owns transpile).
- **VERDICT: CHECKPOINT-OPERADOR.** Reason: it's a build-config change to the **deployed frontend** whose safety can only be *proven* by running the app build (`next build` / OpenNext cf-build), which per repo history must run in Linux/Docker (Windows 500s) — beyond an autonomous unit-test gate. Conservative call. If the operator wants it as FIX-NOW, the gate is: change `target` to `ES2022`, align `lib` to `["ES2022","dom","dom.iterable"]`, run the Docker cf-build + app tests, confirm green. Not autonomous-safe in this environment.

---

## CFG-09: Deno `deno.json` zod@3 vs Node packages zod@4

- **REAL.** `supabase/functions/deno.json:14` = `"zod": "npm:zod@3"`. Node packages = `^4.4.3`. Confirmed. The Edge Function imports `@obs/core` and `@obs/ingest` source directly (`deno.json:7-10`), so any zod schema authored with v4 semantics in those packages would be parsed by the Deno function under v3.
- **Root cause:** Deno function pinned zod@3 at creation; Node side later bumped to v4; never reconciled.
- **What breaks:** If the shared schemas in `@obs/core`/`@obs/ingest` use v4-only API/behavior, the Deno worker validates differently than Node intends (v4 changed `.parse`/error shapes/`.brand`/`.pipe`). Potential silent mis-validation of ingest payloads → bad data to R2/Supabase. Real, but **contingent** on whether the shared schemas actually use divergent APIs (not verified here — would require auditing every shared zod schema against v3↔v4 deltas).
- **What breaks if touched:** Bumping the function to `npm:zod@4` is a **runtime-behavior change to a deployed Edge Function** (the ingest-worker). Must be verified under Deno (`deno check` / the `deno test` task) and **redeployed** to take effect. Not autonomous.
- **Protecting mechanism:** `deno.json` test task runs `--no-check` (see CFG-13) → type drift is NOT caught. So nothing currently guards this.
- **Severity check:** Discovery "high." Plausible *if* schemas diverge; but it touches a deployed function and the impact is unproven. Severity "high" only conditionally.
- **VERDICT: CHECKPOINT-OPERADOR.** Touches the deployed ingest-worker runtime + requires Deno verification + redeploy (gates forbid deploy here). Operator should: bump to `npm:zod@4`, run `deno check ingest-worker/`, run the worker test task *with* type-check, redeploy. Out of autonomous hygiene scope.

---

## CFG-10: `docker-cf-build.sh` `--no-frozen-lockfile` + ignored exit code

- **REAL.** `docker-cf-build.sh:18`: `pnpm install --no-frozen-lockfile || echo "...continuing..."`. CI (`deploy-cloudflare.yml`) uses `--frozen-lockfile --ignore-scripts`. Confirmed divergence.
- **Root cause / nuance:** The `|| echo` and `--no-frozen-lockfile` were deliberate workarounds for the pnpm 11 `ERR_PNPM_IGNORED_BUILDS` gate (see the inline comment and `pnpm-workspace.yaml` notes). It's not pure sloppiness — but `pnpm-workspace.yaml` now lists `onlyBuiltDependencies` so the ignored-builds gate should no longer fire, making the `|| echo` masking *obsolete* and `--no-frozen-lockfile` an unnecessary drift risk.
- **What breaks:** If left — a local Docker build can resolve newer-than-lockfile versions and the `|| echo` swallows genuine install failures → "works in CI, differs locally" or a broken bundle that *looks* like it installed. If touched (→ `--frozen-lockfile --ignore-scripts`, drop `||`) — risk: if the ignored-builds gate or some install error DOES still fire, the local Docker build fails loudly. That's the *desired* behavior, but it could surprise the operator mid-deploy. Since this script is a **local/operator build tool** (not CI, not runtime), failing loud is correct and contained.
- **Protecting mechanism:** None — the `||` is specifically defeating the only signal.
- **Severity check:** "medium" fair (build-reproducibility, operator-only).
- **VERDICT: FIX-NOW** — but with a verification caveat: align to CI semantics. Because the only way to *prove* it doesn't break the operator's Docker build is to run that Docker build (Linux, not available autonomously here), I classify the *edit* as FIX-NOW (it matches the already-working CI invocation) but flag that the operator should run one `docker-cf-build.sh` after to confirm. Low risk because CI already proves `--frozen-lockfile --ignore-scripts` installs cleanly with the current lockfile + `onlyBuiltDependencies`.
- **Exact change** — `docker-cf-build.sh:17-18`:
  ```bash
  echo "[docker-build] pnpm install (frozen, ignore-scripts — alineado con CI)…"
  pnpm install --frozen-lockfile --ignore-scripts
  ```
  (removes `--no-frozen-lockfile` and the `|| echo` mask; `--ignore-scripts` sidesteps the build-scripts gate exactly as CI does. The subsequent `pnpm rebuild esbuild workerd` line already handles native deps.)

---

## CFG-11: Root `package.json` `scripts.lint` is a placeholder

- **REAL.** `package.json:11` = `"lint": "echo \"(lint placeholder — configurar en fase posterior)\""`. `app/package.json` has real `eslint`; the 13 backend packages have no lint. No CI workflow runs lint. Confirmed.
- **Root cause:** Linter adoption deferred ("configurar en fase posterior" — explicit intent).
- **What breaks:** If left — backend packages accrue lint-class issues (unused imports, implicit `any` is already caught by `strict`, etc.) undetected. If touched (add a real flat-config ESLint over `packages/**`) — risk: a fresh ESLint run on 13 never-linted packages will almost certainly surface dozens-to-hundreds of findings; wiring it as a blocking `lint` script/CI step would turn the tree "red" and is a non-trivial adoption effort (rule selection, autofix, baseline). That is a **tooling-adoption decision**, not contained hygiene.
- **Protecting mechanism:** TS `strict` (already on) covers the highest-value subset (no implicit any, unused locals if `noUnusedLocals` were on — it's not). ESLint would add stylistic/import rules.
- **Severity check:** "medium" fair as debt; but the *fix* is a project decision, not a safe one-shot.
- **VERDICT: CHECKPOINT-OPERADOR.** Per 43-CONTEXT ("el validador decide"): introducing a real linter across 13 packages is a tooling-adoption decision with unknown red-surface and CI-minutes implications — not autonomous FIX-NOW. Recommend operator scope a follow-up: add flat config, run once to size the backlog, decide baseline vs. fix-all, then wire CI. (A *contained* FIX-NOW alternative — replacing the echo with `eslint packages/**/*.ts` but `|| true` — would be theater and is NOT recommended; either adopt it for real or leave the honest placeholder.)

---

## CFG-12: `.gitignore` `*.tsbuildinfo` / `dist/` recursive-glob coverage

- **REAL finding, but the risk is ALREADY MITIGATED (effectively a non-issue).** `.gitignore:21-22` = `dist/` and `*.tsbuildinfo`. Git applies non-anchored patterns recursively → `git check-ignore packages/core/tsconfig.tsbuildinfo` → **matches** (verified). `git ls-files packages/*/dist` → empty (verified by discovery). So artifacts are correctly ignored and untracked despite existing on disk.
- **Root cause:** None — the glob works as intended. The "finding" is a clarity preference.
- **What breaks:** Nothing currently. The proposed explicit `packages/*/dist/` lines are redundant with the working recursive glob.
- **Protecting mechanism:** The existing globs already protect.
- **Severity check:** Discovery "low" — agree, and arguably **FALSE-POSITIVE-as-debt**: there's no actual debt, just an optional readability tweak.
- **VERDICT: WON'T-FIX.** The recursive glob already covers `packages/*/dist` and `*.tsbuildinfo`; adding explicit duplicates is noise, not hygiene. Leave as-is. (If the operator wants belt-and-suspenders clarity it's harmless, but it fixes nothing — so not recommended.)

---

## CFG-13: `backfill.yml` runs Deno with `--no-check`

- **REAL.** `.github/workflows/backfill.yml:50-53`: `deno run --allow-env --allow-net --unstable-sloppy-imports --no-check ingest-worker/backfill.ts`. `--no-check` disables type-checking. Confirmed. (Same `--no-check` pattern also in `deno.json` test task line 4.)
- **Root cause:** `--no-check` + `--unstable-sloppy-imports` were used to make the Deno↔monorepo-source imports run without a full Deno type-check pass (the shared TS packages aren't authored for Deno's checker, e.g. extensionless imports).
- **What breaks:** If left — a type error in `backfill.ts` (rate-limit/R2-write logic) ships unchecked. Currently low-stakes (M1 DummyConnector, not real sources) but the pattern is the template for real backfills. If touched (remove `--no-check`) — **likely turns the workflow red**: the shared `@obs/*` source imported via `sloppy-imports` would now be type-checked by Deno, which historically surfaces resolution/type issues the Node `tsc` config tolerates. Making the check pass requires real work on `deno.json` + possibly the imported source. Not a clean one-liner.
- **What breaks if touched, deeper:** This is the *same class* of risk as CFG-09 — it touches a deployed/CI Deno surface whose green-ness can only be proven by running Deno's checker against the monorepo source, which may cascade.
- **Protecting mechanism:** None today (that's the finding). Node-side `tsc -b` does NOT cover `backfill.ts` (it's under `supabase/functions`, outside the package graph).
- **Severity check:** "low" fair (DummyConnector, gated).
- **VERDICT: CHECKPOINT-OPERADOR.** Removing `--no-check` needs Deno type-check reconciliation against the shared source (uncertain red surface) + is a CI-workflow change. Not autonomous-safe. Bundle with CFG-09 (both are "Deno type-safety reconciliation" debt) for an operator-scoped follow-up.

---

## CFG-14: `minimumReleaseAgeExclude: openai@6.44.0` — undated exception

- **REAL.** `pnpm-workspace.yaml:22-23` pins `openai@6.44.0` as a minimum-release-age exclusion with no comment/date. Confirmed.
- **Root cause:** A one-off to install `openai@6.44.0` before the default maturity window elapsed; the rationale wasn't recorded.
- **What breaks:** If left — purely a maintenance smell: the exact-version exclusion won't auto-cover a future `6.44.1` security bump, and nobody remembers why it's there. No build/runtime impact. If touched (add a dated comment) — zero risk.
- **Protecting mechanism:** None needed.
- **Severity check:** "low" fair.
- **VERDICT: FIX-NOW** (trivial: add a dated rationale comment; optionally note the removal condition). Do NOT remove the exclusion blindly — verify the package age first; safest now is to document.
- **Exact change** — `pnpm-workspace.yaml`:
  ```yaml
  # Excepcion puntual: permite instalar openai@6.44.0 antes del minimumReleaseAge
  # por defecto (7d). Anadida 2026-06-24. Revisar y REMOVER cuando 6.44.0 supere los
  # 7 dias publicada o cuando se bumpee openai (entonces re-evaluar la nueva version).
  minimumReleaseAgeExclude:
    - openai@6.44.0
  ```

---

## Reconciliation of encargo seeds

- **CFG-01 severity "high":** confirmed top *confidentiality* finding; fix is trivial. Endorsed.
- **CFG-06 "most important config finding":** confirmed top *functional* finding (5 prod packages invisible to the canonical typecheck gate). Verified the fix stays green (all 5 build EXIT 0 standalone). Endorsed as FIX-NOW with a mandatory post-edit `tsc -b` re-check.
- **CFG-02/03/04/05** are all safe doc-only FIX-NOWs; every var was re-confirmed read by code; no secret VALUE added; `SUPABASE_ANON_KEY` is the public anon key (RLS-safe). CFG-02's "browser client / silent fail" rationale was corrected (server-side client, fails loud).
- **CFG-08/09/11/13** are NOT clean autonomous fixes (deployed-frontend build / deployed Deno runtime / linter adoption / Deno type-check reconciliation) → CHECKPOINT-OPERADOR.
- **CFG-12** is effectively a non-issue (recursive glob already works) → WON'T-FIX.

**`tsc -b` baseline re-confirmed EXIT 0; no edits were applied during validation (validation-only per gates).**
