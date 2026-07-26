---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
plan: 05
subsystem: notif-phase-close-legal-apply-flip
tags: [21719, legal-dossier, signoff, prod-apply, pgtap, deploy-runbook, flag-off-closure, notif-05, operator-checkpoint]
requires:
  - "migrations 0069/0070/0071 + pgTAP written & scratch-validated (Plan 02)"
  - "notif-gate.ts chokepoint + notif-antiflip guard + .env.example=false (Plan 01)"
  - "user surfaces (/cuenta OTP, SeguirButton gated, confirmar/baja) — Plan 03"
  - "@obs/notificaciones EGRESO digest + digest-daily.yml gated cron (Plan 04)"
  - "operator (abogado) pre-authorization of legal checkpoint 21.719 (run invocation 2026-07-26)"
provides:
  - "docs/legal/103-LEGAL-DOSSIER-NOTIF.md (DPA Resend / licitud consentimiento / ARCO-P / retención, signoff: approved)"
  - "103-DEPLOY-RUNBOOK.md (ordered apply→pgTAP→deploy→flip→operator-checkpoint + first-class Flag-OFF closure §f)"
  - "0069/0070/0071 APPLIED to PROD + post-apply pgTAP 20/20 green against applied schema"
  - "Flag-OFF closure (NOTIF-05) EXECUTED: flag OFF, feature parked, cero captura de email, deuda operador recorded"
affects:
  - "phase 103 close — NOTIF feature shipped & inert; flip pending operator provisioning"
  - "operator deuda: publishable key + Resend verified domain/DPA + RESEND_API_KEY, then flip NOTIF_PUBLIC_ENABLED=true"
tech-stack:
  added: []
  patterns:
    - "legal dossier signoff: approved via operator pre-authorization (agent documents, operator authorizes)"
    - "PROD apply via psql --single-transaction (never supabase db push); pgTAP against APPLIED schema (Pitfall 6)"
    - "deploy-time flag flip (Worker env var), never committed; .env.example stays false (anti-flip guard green)"
    - "Flag-OFF closure (NOTIF-05): when provisioning blocks the flip, park the feature inert — migrations kept, cron dry-run, zero capture"
key-files:
  created:
    - docs/legal/103-LEGAL-DOSSIER-NOTIF.md
    - .planning/phases/103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg/103-DEPLOY-RUNBOOK.md
  modified: []
decisions:
  - "Legal signoff: approved recorded via operator's VERBATIM pre-authorization ('autorizo desde ya el checkpoint legal (soy abogado)', 2026-07-26). Agent DOCUMENTS the personal-data risk surface (Ley 21.719); operator (abogado) AUTHORIZES — agent never self-signs."
  - "PROD apply of 0069/0070/0071 EXECUTED by the agent (authorized this run): additive, deny-by-default RLS. psql --single-transaction, order 0069→0070→0071 (0070 FK→suscripcion). schema_migrations tracking resumed at 0069 (direct applies 0059-0068 had left the trace at 0058)."
  - "post-apply pgTAP 20/20 (6/6/8) green against the APPLIED PROD schema (pgtap 1.3.3), each wrapped BEGIN/ROLLBACK (zero residue). RLS user-A-no-ve-B holds on PROD; notificacion_envio zero grant to authenticated; anon no select."
  - "Task 3 (operator provisioning + deploy + flip + SC2) resolved via the Flag-OFF closure (NOTIF-05 §f): SUPABASE_PUBLISHABLE_KEY and RESEND_API_KEY are absent from .env (operator-exclusive acts). Flag left OFF (no Worker env var set), feature parked (migrations applied & inert, cron dry-run), zero email captured or sent. Phase closes cleanly."
  - "anti-flip invariant preserved: .env.example stays NOTIF_PUBLIC_ENABLED=false; no NOTIF_PUBLIC_ENABLED=true committed in any env/code file; notif-antiflip-guard 20/20 green post-apply."
metrics:
  duration: ~40 min
  completed: 2026-07-26
  tasks: 3
  files: 2
---

# Phase 103 Plan 05: Legal dossier 21.719 + PROD apply + Flag-OFF closure (phase close) Summary

Closed Phase 103: wrote the **21.719 legal dossier** (DPA Resend / consent licitud / ARCO-P / retention) with the operator-abogado's **VERBATIM pre-authorization** recorded as `signoff: approved`; wrote the **103-DEPLOY-RUNBOOK** with the ordered apply→pgTAP→deploy→flip→operator-checkpoint sequence AND a first-class **Flag-OFF closure (NOTIF-05)**; **applied migrations 0069/0070/0071 to PROD** (authorized this run) with **post-apply pgTAP 20/20 green** against the applied schema; and — because the operator-exclusive credentials (publishable key + Resend domain/API key) are absent — **executed the Flag-OFF closure**: the flag stays OFF, the feature is parked inert (migrations kept, cron dry-run), and **no email is ever captured or sent**. The phase ships complete and inert; the flip is a documented operator deuda.

## What was built

### Task 1 — Legal dossier 21.719 + DEPLOY-RUNBOOK (commit 9493481)

- **`docs/legal/103-LEGAL-DOSSIER-NOTIF.md`** (clone of 102-VSIM structure): covers (1) qué dato se captura (only the email + subscription relation + consent record; zero RUT/sensitive); (2) **base de licitud** = consent (double opt-in, append-only `consentimiento` record with version/method/date); (3) **DPA / subencargado Resend** (data processor; minimization of the egreso; PII redaction in logs; international-transfer + DPA to validate before live send); (4) **ARCO-P** (unsubscribe one-click login-less via opaque token + `List-Unsubscribe` header; preference center in `/cuenta`; deletion via `ON DELETE CASCADE` from `auth.users`); (5) **retención** (consent append-only as probatory record; bounded purge of the envío queue); (6) **signoff: approved** with the operator's VERBATIM pre-authorization. Explicitly states **the agent DOCUMENTS, the operator (abogado) AUTHORIZES** — the agent never self-signs.
- **`103-DEPLOY-RUNBOOK.md`** with ordered sections (a) apply 0069→0070→0071; (b) post-apply pgTAP + lockdown-guard; (c) deploy (OpenNext Docker + wrangler, mirror 97); (d) flip `NOTIF_PUBLIC_ENABLED=true` as a Worker env var (never committed); (e) operator checkpoint (publishable key + OTP template + SC2 curl evidence + Resend domain/API key); **(f) Flag-OFF closure (NOTIF-05 fallback)** — first-class & executable: flag stays OFF, feature parked (migrations kept, cron dry-run), what gets documented, the deuda entry with the single flip command, and legal consistency.

### Task 2 — Apply 0069/0070/0071 to PROD + post-apply pgTAP (commit 830a01b)

- **Applied to PROD** (Postgres 17.6, ref `bctyygbmqcvizyplktuw`) in order via `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f …` — each EXIT 0. `0070` after `0069` (FK `suscripcion_id → suscripcion`). All three tables present with `relrowsecurity=t`. `schema_migrations` rows 0069/0070/0071 inserted (`on conflict do nothing`; direct applies 0059-0068 had left the tracking at 0058 — resumed here).
- **Post-apply pgTAP against the APPLIED PROD schema** (pgtap 1.3.3), each wrapped BEGIN/ROLLBACK (zero residue): **0069 = 6/6**, **0070 = 6/6**, **0071 = 8/8** → **20/20 ok, 0 not ok**. Proves on PROD: user-A-no-ve-B (RLS isolates, T-103-04); B cannot delete A's row (T-103-05); `notificacion_envio` zero grant to `authenticated` (queue service_role-only, T-103-06); anon no select (deny-by-default, T-103-07); two-user consent isolation.
- **lockdown-guard 22/22 + notif-antiflip-guard 20/20** green post-apply (Block D accepts the allowlisted `to authenticated` on suscripcion/consentimiento; Block E confirms notificacion_envio zero grant; `.env.example` stays false).

### Task 3 — Operator provisioning + deploy + flip (RESOLVED via Flag-OFF closure NOTIF-05)

Task 3 is a `checkpoint:human-action` requiring operator-exclusive credentials. Verified absent:
- `SUPABASE_PUBLISHABLE_KEY` — not in `.env` (count 0). Must be created in the Supabase dashboard.
- `RESEND_API_KEY` — not in `.env` (count 0). Requires a verified Resend sending domain + signed DPA + key.

Per the run's authorization (§f) and the DEPLOY-RUNBOOK, executed the **Flag-OFF closure (NOTIF-05)**:
- **Flag stays OFF:** no Worker env var `NOTIF_PUBLIC_ENABLED` set (deny-by-default holds); the "Seguir" button is absent from the DOM (gate-before-render); `/cuenta` + subscription surfaces gated OFF. **No user data is captured because nothing is exposed.**
- **Feature parked, not reverted:** migrations stay applied (additive, deny-by-default, safe at rest & inert until the flip); `digest-daily` cron stays dispatch-only + dry-run (`RESEND_API_KEY` absent ⇒ no send). No emails collected or sent. No rollback.
- **Documented:** missing credentials + date (2026-07-26) recorded in the runbook §(f) "RESULTADO DE ESTA CORRIDA".
- **Anti-flip invariant preserved:** `.env.example` stays `NOTIF_PUBLIC_ENABLED=false`; no `NOTIF_PUBLIC_ENABLED=true` committed in any env/code file; notif-antiflip-guard 20/20 green.

## Verification

- Task 1 automated check: `signoff` count 7 in dossier; `Flag-OFF closure` count 5 in runbook → PASS.
- Task 2: 0069/0070/0071 applied to PROD EXIT 0; three tables present RLS-enabled; **pgTAP 20/20 ok, 0 not ok** against applied schema; lockdown 22/22 + notif-antiflip 20/20 green.
- Task 3: credentials confirmed absent (`SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY` = 0 in `.env`); `.env.example` = `NOTIF_PUBLIC_ENABLED=false`; no committed `=true` flag; Flag-OFF closure executed and documented.

## Threat register coverage

| Threat ID | Mitigation landed |
|-----------|-------------------|
| T-103-17 (flag flipped without legal signoff) | dossier `signoff: approved` recorded (operator pre-authorization) BEFORE any flip; flip is deploy-time + gated on provisioning |
| T-103-18 (committed .env.example=true) | flip is Worker env var only; `.env.example` stays false; anti-flip guard 20/20 green |
| T-103-19 (RLS fails silently on PROD apply) | post-apply pgTAP against the APPLIED PROD schema — 20/20, two-user isolation holds (Pitfall 6) |
| T-103-20 (OTP renders ConfirmationURL not Token) | operator checkpoint §(e) verifies `{{ .Token }}` template + SC2 evidence (deuda; flag OFF until then) |
| T-103-24 (email capture exposed before provisioning complete) | **Flag-OFF closure (NOTIF-05) executed** — flag OFF until publishable key + Resend domain/key ready; feature parked, zero capture |
| T-103-SC (npm/pip/cargo installs) | ZERO new external packages this plan (docs + apply only) |

## Deviations from Plan

None — plan executed as written. Task 2 (a `checkpoint:human-verify`) was executed by the agent per the run's explicit PROD-apply authorization (agent holds the DB URL); Task 3 (a `checkpoint:human-action`) resolved via the plan's own Flag-OFF closure fallback because the operator-exclusive credentials are absent. Both outcomes are the plan's documented paths.

## Deferred / Notes — OPERATOR DEUDA (flip NOTIF ON)

The feature is **shipped & inert**. To flip NOTIF ON, the operator must provide (all operator-exclusive; the agent cannot create keys or touch dashboards):

1. **Supabase publishable key + OTP template:** create `sb_publishable_…` (project `bctyygbmqcvizyplktuw`); confirm Email provider ON + OTP template renders `{{ .Token }}` (NOT `{{ .ConfirmationURL }}`); `wrangler secret put SUPABASE_PUBLISHABLE_KEY` + value in local `.env` (never `.env.example`). *(This also carries the pre-existing 97-02 gate.)*
2. **Resend verified domain + DPA + API key:** verify a sending domain for the `from` address; sign/confirm the Resend DPA (subencargado 21.719) + validate the international transfer; create `RESEND_API_KEY` (`re_…`); load as wrangler secret (deploy) + GH secret (cron); set `NOTIF_FROM=resumen@<domain>` + `NOTIF_BASE_URL`.
3. **Deploy** (OpenNext Docker + wrangler, per runbook §c). Confirm `/spike-auth` absent; Camino A + CSP intact.
4. **Flip — the ONE command** (after deploy with secrets loaded): `wrangler secret put NOTIF_PUBLIC_ENABLED` (value `true`) → redeploy/propagate. **No `.env.example` change is ever required.**
5. **SC2 evidence:** run the 97-SPIKE-EVIDENCE curl block (PII-redacted) confirming Set-Cookie + session refresh on the live deploy. BrowserOS: "Seguir" button PRESENT on both fichas when flag ON. Then uncomment the `schedule:` block of `digest-daily.yml`.

Until the flip: no email is captured or sent; ARCO-P surfaces are dormant; the dossier's `signoff: approved` is unconditional but the flip was not exercised this run.

## Known Stubs

None new. (The Plan 04 raw-baja-token seam — the CLI passing `baja_token_hash` as the baja link token — remains as documented in 103-04-SUMMARY; it is finalized when the confirmation-email send path runs live, which is gated behind the same operator provisioning as the flip. It does not block this plan's goal: the schema is applied, the legal gate is signed, and the feature is correctly parked.)

## Self-Check: PASSED

- docs/legal/103-LEGAL-DOSSIER-NOTIF.md — FOUND
- .planning/phases/103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg/103-DEPLOY-RUNBOOK.md — FOUND
- commit 9493481 (Task 1 dossier + runbook) — FOUND
- commit 830a01b (Task 2 PROD apply + pgTAP evidence) — FOUND
- PROD: suscripcion / notificacion_envio / consentimiento present with RLS enabled — CONFIRMED (psql)
- post-apply pgTAP 20/20 ok against applied schema — CONFIRMED
