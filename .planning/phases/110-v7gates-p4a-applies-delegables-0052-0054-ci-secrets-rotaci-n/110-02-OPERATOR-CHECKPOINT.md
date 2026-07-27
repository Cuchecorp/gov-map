# 110-02 — Operator checkpoint: CI secrets + DB password rotation B26

**Phase:** 110 · **Plan:** 110-02 · **Requirement:** V7-07 · **Gate:** blocking-human
**Date prepared:** 2026-07-27 (agent DOCUMENTS + verifies; operator LOADS values + rotates)

This document references only secret **NAMES**, never values. The agent has no dashboard access and never loads a secret value nor rotates a credential (rotating live breaks active psql connections). Two independent operator acts — do both, then resume.

---

## (A) SC2 — CI secrets for the deploy workflow

The deploy workflow YAML reference is **already correct** (DEBT-03) — only the secret VALUES are missing:

```
.github/workflows/deploy-cloudflare.yml:59   CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
.github/workflows/deploy-cloudflare.yml:60   CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Operator steps (in the deployed mirror repo **Cuchecorp/gov-map**, NOT this workspace):

1. **Cuchecorp/gov-map → Settings → Secrets and variables → Actions → New repository secret.**
2. Add `CLOUDFLARE_API_TOKEN` = a Cloudflare API token with permission **"Edit Cloudflare Workers"** (Cloudflare Dashboard → My Profile → API Tokens).
3. Add `CLOUDFLARE_ACCOUNT_ID` = the account id (the endpoint id, `10fb709d…`).
4. **Verify GitHub Actions billing is active** for the repo/org (GitHub → Settings → Billing). Without active billing the deploy workflow will not run.

> The agent surfaces only the NAMES above. Do not paste any value into this file, a commit, or a chat.

## (B) SC3 — Rotate the exposed DB password B26

Blast radius (verified, note 75): the password lives **only** in `SUPABASE_DB_URL`. CI crons + the deployed site authenticate with `SUPABASE_SECRET_KEY` (service_role, REST) + `SUPABASE_API_URL` — **independent credentials, unaffected** by this rotation. Rotation is a **local operator event**, not a production event.

Operator steps (verbatim intent from note 75):

1. **Rotate** — Supabase **Dashboard → Settings → Database → Reset database password**. Generate the new password, copy the new connection string.
2. **Re-load local** — paste the new `SUPABASE_DB_URL` into the local `.env` (that variable ONLY). `.env` is gitignored → **NEVER** commit the new password.
3. **Check the deployed mirror (Q1)** — in **Cuchecorp/gov-map → Settings → Secrets and variables → Actions**, look for any `*_DB_URL` secret (e.g. `SUPABASE_DB_URL`). If one feeds a DDL cron, refresh it. Safe default: assume none exists; verify at rotation time. (Grep over `.github/workflows/` in this repo = **0** hits for `SUPABASE_DB_URL`, confirmed 2026-07-27.)
4. **Confirm OLD password invalid** — with the old url: `PGCLIENTENCODING=UTF8 psql "<old-url>" -c "select 1;"` → **must fail with an auth error**.
5. **Confirm NEW password works** — `DB_URL=$(node -e "require('dotenv').config(); console.log(process.env.SUPABASE_DB_URL)"); PGCLIENTENCODING=UTF8 psql "$DB_URL" -c "select 1;"` → returns `1`.
6. **Confirm no CI/site impact** — CI crons + the deployed site stay **green** (service_role REST — should not move).

### Anti-misinterpretation warnings (Pitfall 2)

- Do **NOT** re-load `SUPABASE_SECRET_KEY` / `SUPABASE_API_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_JWT_SECRET` as part of this rotation — independent credentials, not affected. Only `SUPABASE_DB_URL` changes.
- Do **NOT** commit the new `SUPABASE_DB_URL` (`.env` gitignored).
- Do **NOT** delegate rotation to the agent/CI (no dashboard access; live rotation breaks active connections).

---

## RESUME SIGNAL

When both acts are done, type **"cargado y rotado"** with results:
- (A) `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` loaded as GH secrets; GH Actions billing active.
- (B) old url fails auth; new url returns `1`; CI crons + site green.

Or describe the blocker. The agent then runs its post-verification (Task 3): `gh secret list` (names only, if authed) + optional new-url liveness check via local `.env` (never printing the value).
