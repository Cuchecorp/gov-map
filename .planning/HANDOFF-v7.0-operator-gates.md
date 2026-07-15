# v7.0 — Operator/Human Gate Checklist (autonomous run 64–75 COMPLETE)

**Generated:** 2026-07-15
**State:** All 12 phases (64–75) are CODE-COMPLETE + verified (full app suite 820/820; per-package suites green). The milestone is **not shipped** until the human/operator gates below are done. Nothing here is agent-executable — each is deliberately gated (dashboard access, legal sign-off, secret values, LIVE WAF/PROD, or a real-deploy visual read).

The milestone was NOT archived (no `complete-milestone`/`cleanup`) precisely because these gates are open. Run them, then re-run `/gsd:audit-milestone` → `/gsd:complete-milestone v7.0` when ready.

---

## HARD gates (the 2 designed human checkpoints)

- [ ] **RUT-01 write (Phase 69)** — populate the maestra RUT (Track B curated seed + Track A SERVEL corroboration) and run the remote write via db-url. Runbook: `69-BACKFILL-RUT-RUNBOOK.md`. Blocks ALL money DATA (contracts/aportes render `null`/empty until this lands). Guard now COMPILER-enforced (`FilaRutCorroborada`): a name-match can't write a RUT.
- [ ] **MONEY legal flip (Phase 73)** — obtain the 21.719 legal sign-off, set `signoff: approved` in `docs/legal/13-LEGAL-DOSSIER.md`, then flip `MONEY_PUBLIC_ENABLED=true` in prod. The anti-flip CI guard (now enforces SOLE enabling path) blocks any agent from doing this.

## Operator-LOCAL backfills (data population)

- [ ] **Cámara vote backfill (Phase 66)** — `66-BACKFILL-RUNBOOK.md` (LIVE, `VOTOS_LIVE=1`, rate-limit 2-3s, resumable). Endpoint confirmed UP at scale (Phase 64).
- [ ] **Senado vote backfill (Phase 67)** — `67-BACKFILL-SENADO-RUNBOOK.md` + confirm the LIVE `<SELECCION>` token set (unknown tokens now fail LOUD in `errores`).
- [ ] **ChileCompra crawl (Phase 70)** — `70-BACKFILL-CHILECOMPRA-RUNBOOK.md` (needs RUT-01 first; quota 10k/day non-modifiable; `MERCADOPUBLICO_TICKET`). OCDS monthly bulk parser deferred to v2.
- [ ] **SERVEL .xlsx (Phase 71)** — `71-BACKFILL-SERVEL-RUNBOOK.md` (obtain + place the .xlsx in R2 per election; `--from-r2` replays Stage 2).

## Migration applies (DDL to PROD, `psql --single-transaction`, NOT `db push`)

- [ ] **0052** — `cruce_senal` `lobby_sector_aporte` structural stub (Phase 72). `72-APPLY-RUNBOOK.md`. Empty-honest until a company→sector edge exists (deferred substance of MONEY-03).
- [ ] **0053** — leylobby cursor marker (Phase 74). Without it, `lobby-leylobby-weekly` fail-loud.
- [ ] **0054** — leyes rotation marker (Phase 74). Without it, `leyes-weekly` fail-loud (correct).

## CI / secrets / crons (Phase 74)

- [ ] **Load `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`** in Cuchecorp/gov-map GH settings (`74-DEBT-03-CF-TOKEN-OPERATOR-NOTE.md`). The YAML reference is already correct; only the deploy workflow needs it (ingesta crons don't). Verify GH billing.
- [ ] Observe successive `leyes-weekly` runs: `leyes-min-edad` freshness should trend down as round-robin covers the 3.657 corpus.

## Comprehension / visual (BrowserOS + real deploy)

- [ ] **BrowserOS "comprensible" cold-read — votes (Phase 68)** — `68-BROWSEROS-GATE.md`. Needs the vote backfills + a deploy.
- [ ] **BrowserOS "comprensible" cold-read — MONEY (Phase 73)** — gated-preview (flag ON only local), per the UI-SPEC 6-pillar rubric.
- [ ] **`/red` visual non-regression (Phase 75)** — real-deploy `getComputedStyle`/visual check that the `.net-*` typography swap didn't move the radial F18 / layout-B geometry (jsdom can't see it; swap was pixel-identical).

## Operational (Phase 75)

- [ ] **Rotate the Supabase DB password (B26)** — `75-DB-PASSWORD-ROTATION-OPERATOR-NOTE.md`. Blast radius: only `SUPABASE_DB_URL` (0 workflows reference it; CI/site keep running on the service_role key). Re-load the new credential in local `.env` + check Cuchecorp/gov-map for any `*_DB_URL` secret.

---

## What the autonomous run shipped (code, all gated/fail-closed)

- **VOTO (64–68):** endpoint validated LIVE + vote semantics fixed-by-test (abstención code 2, pareo from `<Pareos>`, cross-check fail-loud, per-vote diagnostics); golden DIPID→maestra gate (compiler + mutation-tested); two-stage R2 wire for Cámara + Senado (`--from-r2`, R2-fail gates the write); citizen vote surfaces with the anti-insinuation legend + neutral-slate pareo/ausente + the anti-insinuation linter + honest coverage (freshness N/M).
- **DINERO (69–73):** RUT backfill mechanism + compiler-enforced name-match≠write-RUT guard + honest coverage; ChileCompra + SERVEL two-stage wires (RUT-exact / name-deterministic fail-closed, monto VERBATIM, ticket redacted); `cruce_senal` additive stub; all MONEY surfaces mounted behind the fail-closed gate with provenance + legend + the extended linter + the anti-flip guard (SOLE-enabling-path enforced) + the legal dossier.
- **DEUDA (74–75):** leylobby incremental cursor; fixed the hidden ~1k PostgREST cap + round-robin rotation over the 3.657 corpus; freshness MIN-age signal; CF-token CI reference verified; pixel-preserving `.net-*` typography alignment.

**Code-review caught (and fixed) 4 issues the verifiers missed** — all defamation/legal-critical: pareo/vote-conflict silent misattribution (P64), R2-failure-doesn't-gate-Supabase-write (P66, shared `runIngest`), the RUT guard being regex-evadable → replaced with a compiler brand (P69), and the anti-flip guard allowing an additive `|| preview` bypass (P73).
