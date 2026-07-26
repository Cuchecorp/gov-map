---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
plan: 04
subsystem: notif-egreso-digest
tags: [egreso, digest, resend, cursor-idempotency, pii-redaction, hard-cap, cron, notif]
requires:
  - "notificacion_envio table (service_role-only queue + ultimo_evento_visto text cursor) — Plan 02"
  - "suscripcion table (estado='confirmada' + baja_token_hash) — Plan 02"
  - "proyecto_autor (parlamentario_id/estado_vinculo) + tramitacion_evento (id/boletin) — 0051/0008"
  - "@obs/actualidad package layout (clone target) + actualidad-refresh.yml (cron clone) + roster-weekly.yml (gated-launch precedent)"
provides:
  - "@obs/notificaciones package (EGRESO pattern — digest engine + Resend send + CLI)"
  - "computeNovedades per subscription type (proyecto->tramitacion_evento; parlamentario->proyecto_autor confirmado fail-closed->tramitacion_evento) with idempotent cursor"
  - "enforceCap 100/day (over-cap queued for tomorrow, cursor un-advanced)"
  - "redactEmail (email NEVER logged raw) + renderDigest (the ONE sanctioned inline-hex email island)"
  - "enviarDigest via global fetch (NO SDK): List-Unsubscribe one-click, dry-run when RESEND_API_KEY absent, 429 retry-after safe"
  - "run-digest-prod-cli.ts EGRESO CLI (service_role, cursor advances atomically only on send success)"
  - "digest-daily.yml cron (dispatch-only launch, EGRESO documented, RESEND_API_KEY secret)"
affects:
  - "Plan 05 (PROD apply 0069-0071; operator loads RESEND_API_KEY secret + verified domain; manual green dry-run then uncomment schedule)"
tech-stack:
  added: []
  patterns:
    - "EGRESO — inverse of ingesta: no source, no R2, no rate-limit, no two-stage; recipient is Resend; only cap = 100/day (code) + PII redaction (logs)"
    - "idempotent cursor: computeNovedades returns only id>cursor; nuevoCursor advances only on send success"
    - "fail-closed parlamentario novedad: proyecto_autor estado_vinculo='confirmado' only (no_confirmado/NULL contribute zero)"
    - "email PII redaction (redactEmail) in every log line; email never written to R2/CI"
    - "gated cron launch (workflow_dispatch only, schedule commented) mirror roster-weekly"
    - "inline-hex email island (each hex mapped to a design token) — the ONE sanctioned exception to the site-wide zero-hex regime"
key-files:
  created:
    - packages/notificaciones/package.json
    - packages/notificaciones/tsconfig.json
    - packages/notificaciones/vitest.config.ts
    - packages/notificaciones/src/index.ts
    - packages/notificaciones/src/digest.ts
    - packages/notificaciones/src/digest.test.ts
    - packages/notificaciones/src/resend.ts
    - packages/notificaciones/src/run-digest-prod-cli.ts
    - packages/notificaciones/src/resend.test.ts
    - .github/workflows/digest-daily.yml
  modified:
    - pnpm-lock.yaml
decisions:
  - "EGRESO is explicitly NOT the two-stage ingesta pattern: documented in digest.ts + resend.ts + run-digest-prod-cli.ts + digest-daily.yml headers. No source is touched, no R2 crudo, no rate-limit 2-3s/host — the recipient is Resend, not a gov WAF. The two-stage rule of CLAUDE.md does NOT apply to outbound email."
  - "Zero new external packages (T-103-SC): send = global fetch (Node 22), no Resend SDK; all deps reused from the monorepo (@supabase/supabase-js already present)."
  - "The cursor (notificacion_envio.ultimo_evento_visto) is text in DB; the CLI stores String(nuevoCursor) and reads it back as Number. computeNovedades keys on the monotonic tramitacion_evento.id."
  - "parlamentario novedad is fail-closed: only proyecto_autor estado_vinculo='confirmado' authorships surface; a no_confirmado/NULL authorship contributes ZERO events (T-103-21). Test asserts both the non-empty confirmado path and the empty no_confirmado path."
  - "Hard-cap 100/day per USER (not per subscription): enforceCap sends up to 100 users, the rest defer to tomorrow with cursor un-advanced (honest degrade, never lost)."
  - "digest-daily.yml ships GATED: workflow_dispatch only, schedule commented (mirror roster-weekly). Operator uncomments the L-V 12:00 UTC cron after a manual green dry-run. RESEND_API_KEY is a NEW operator secret; absent => CLI dry-run."
metrics:
  duration: ~7 min
  completed: 2026-07-26
  tasks: 3
  files: 11
---

# Phase 103 Plan 04: EGRESO — @obs/notificaciones digest + Resend send + digest-daily cron Summary

Built the EGRESO pattern (NOTIF-03/04): the `@obs/notificaciones` package that computes per-subscription novedades via an idempotent cursor, sends the daily digest through Resend (global `fetch`, hard-capped at 100/day, email PII redacted from every log), and the gated `digest-daily.yml` cron. **EGRESO is explicitly documented as NOT the two-stage ingesta pattern** — the inverse: no source to respect, no R2 crudo, no rate-limit, no robots.txt; the recipient is Resend, not a gov WAF, so the CLAUDE.md two-stage rule does not apply. Zero new external packages (send = `fetch`, all deps reused). 22 tests green, `tsc -b` exit 0.

## EGRESO vs the two-stage ingesta (the documented difference)

CLAUDE.md's LOCKED rule is a **two-stage INGESTA**: Fuentes → R2 (crudo inmutable, content-addressed) → Supabase (derivado), with hash-check before download, rate-limit 2-3s/host, User-Agent, robots.txt, daily cache. That rule governs **pulling** data from sources that must be respected.

This plan is **EGRESO** — the inverse. There is no source: the system already holds the novedades (tramitacion_evento) in its own DB. The digest **emits** them to a recipient (Resend, a mail API). Therefore:

| Two-stage ingesta (CLAUDE.md) | EGRESO (this plan) |
|-------------------------------|--------------------|
| Fuentes → R2 crudo → Supabase | Supabase → Resend (outbound) |
| R2 crudo inmutable versioned  | NO R2 write at all |
| rate-limit 2-3s/host, robots.txt | NO rate-limit, NO robots (recipient is a mail API, ~2 req/s Resend default respected via 429 retry-after) |
| hash-check before download | idempotent cursor before send (no double-send) |
| User-Agent identificatorio | List-Unsubscribe one-click header (RFC 8058) |

The single cota is the **hard-cap 100/day (in code)** + **PII redaction** (email never logged raw, never written to R2/CI). This distinction is stated verbatim in the header comment of `digest.ts`, `resend.ts`, `run-digest-prod-cli.ts`, and `digest-daily.yml` (T-103-16 mitigation).

## What was built

### Task 1 — @obs/notificaciones scaffold + digest engine (commit 43eb579)

- **Scaffold** cloning `packages/actualidad/`: `package.json` (name `@obs/notificaciones`, `@supabase/supabase-js ^2.108.2`, dev `@types/node`/`tsx`/`vitest` — NO Resend SDK), `tsconfig.json` + `vitest.config.ts` verbatim (avoid CI-DARK), `src/index.ts` barrel.
- **`digest.ts`**: `computeNovedades(subscription, cursor, db)` dispatching on tipo — `proyecto` reads `tramitacion_evento` `.eq('boletin').gt('id', cursor)` (paginated cap 1k); `parlamentario` FIRST reads `proyecto_autor` `.eq('parlamentario_id').eq('estado_vinculo','confirmado')` → distinct boletines → THEN `tramitacion_evento` `.in('boletin', boletines).gt('id', cursor)`. Real columns from 0008/0051, no invented ones. Plus `nuevoCursor` (max id, advances only on success), `enforceCap` (100/day, over-cap deferred), `redactEmail` (never raw), `notaSinNovedades` (honest no-news). EGRESO header comment.
- **`digest.test.ts`** (14 tests): in-memory fake db — proyecto happy path + idempotent re-run (cursor=max → zero), parlamentario confirmado → NON-EMPTY, no_confirmado → ZERO (fail-closed), mixed confirmado+no_confirmado → only confirmado, cursor advance, 100-cap, redactEmail never raw, honest no-news.

### Task 2 — Resend send (fetch, List-Unsubscribe, dry-run) + EGRESO CLI (commit cbc3604)

- **`resend.ts`**: `enviarDigest` via global `fetch` (NO SDK) POST `https://api.resend.com/emails` with `Authorization: Bearer`, `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers, html+text multipart. RESEND_API_KEY absent ⇒ dry-run (no fetch, honest log). 429 respects `retry-after` (waits, marks reintentable → cursor won't advance, no crash); 5xx reintentable, 4xx not. Destinatario NEVER logged raw (redactEmail). `renderDigest` produces the HTML (the ONE sanctioned inline-hex island — each hex mapped to its design token: `#F9F6F0`→`--background`, `#2A5859`→`--accent-product`, etc.) + plain-text per UI-SPEC S5: per-group heading, factual `descripción · fuente, fecha · Ver en la fuente ↗`, honest no-news note, CC BY 4.0 footer, baja link with raw token; HTML-escapes DB items.
- **`run-digest-prod-cli.ts`**: EGRESO CLI (service_role from SUPABASE_API_URL+SUPABASE_SECRET_KEY, `.env` BOM-safe with process.env precedence). Reads `estado='confirmada'` subscriptions (paginated), reads the per-(user,subscription) cursor from `notificacion_envio`, `computeNovedades`, groups per user, `enforceCap` 100/day, resolves the recipient email via `auth.admin.getUserById` (never logged raw), `enviarDigest`, and on send success inserts `notificacion_envio` (estado='enviado', `ultimo_evento_visto = String(nuevoCursor)`) — cursor advances atomically ONLY on success.
- **`resend.test.ts`** (8 tests): dry-run when key absent (no fetch, no raw email in log), POST shape (url/method/Bearer/List-Unsubscribe one-click/multipart), 429 retry-after reintentable + no raw email, 5xx vs 4xx reintentable, renderDigest groups/no-news/baja-link/HTML-escape.

### Task 3 — digest-daily.yml cron (commit c888d5e)

- Cloned `actualidad-refresh.yml`: `permissions: contents:read`, `concurrency` cancel-in-progress:false, pinned-SHA `checkout`/`pnpm/action-setup`/`setup-node` (node 22, pnpm cache), `pnpm install --frozen-lockfile --ignore-scripts`. **GATED launch** (mirror roster-weekly): `workflow_dispatch` only, `schedule:` block COMMENTED (`cron "0 12 * * 1-5"`, L-V after data crons; operator uncomments after a manual green run). EGRESO header comment. Env `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` + `RESEND_API_KEY` (NEW secret, operator deuda; absent ⇒ dry-run). Runs `pnpm --filter @obs/notificaciones exec tsx src/run-digest-prod-cli.ts`.

## Verification

- `pnpm --filter @obs/notificaciones test` → **2 files, 22 tests passed** (digest 14 + resend 8): per-type novedad, cursor idempotency, fail-closed no_confirmado (non-empty confirmado / zero no_confirmado), 100-cap, PII redaction, dry-run, 429 retry-after, header shape, render.
- `pnpm --filter @obs/notificaciones exec tsc -b` → **exit 0** (no CI-DARK; vitest.config verbatim).
- `git grep -nE "console\.(log|error|warn).*(email|destinatario|\.to)" packages/notificaciones/src` → **no matches** (no raw-email interpolation anywhere).
- `digest-daily.yml`: `workflow_dispatch` present, `# schedule:` commented (gated), `EGRESO` header (4 hits), `RESEND_API_KEY` (env + comment), pinned SHAs, node 22, pnpm cache, runs the CLI.
- Zero new external packages: `pnpm install` reused all deps from the monorepo (T-103-SC).

## Threat register coverage

| Threat ID | Mitigation landed |
|-----------|-------------------|
| T-103-13 (email PII in logs/CI/R2) | `redactEmail` in every log line (digest/resend/CLI); no R2 write in EGRESO; grep confirms no raw-email interpolation; recipient resolved server-side never logged raw |
| T-103-14 (100/day cap → drops/crash) | `enforceCap` hard cap in code; over-cap users deferred with cursor un-advanced (queued, never lost); 429 respects retry-after |
| T-103-15 (double-send on re-run) | idempotent cursor — `computeNovedades` returns only id>cursor; `nuevoCursor` advances atomically only on send success; re-run over sent batch → zero (test asserts) |
| T-103-16 (applying two-stage rule to EGRESO) | EGRESO header in all four files: NO dos-etapas / NO R2 / NO rate-limit gubernamental; no source touched |
| T-103-21 (parlamentario surfaces a no_confirmado authorship) | novedad query filters `estado_vinculo='confirmado'` (fail-closed); test asserts no_confirmado contributes zero |
| T-103-SC (npm/pip installs) | ZERO new external packages; send = `fetch`, all deps reused; no install task |

## EGRESO NOT two-stage — CLAUDE.md difference (as requested)

Documented above under "EGRESO vs the two-stage ingesta" and verbatim in the source/cron headers. In short: CLAUDE.md's two-stage rule governs **pulling from sources** (Fuentes→R2→Supabase, rate-limit, robots.txt, hash-check). This plan **pushes to a recipient** (Supabase→Resend). No source is respected, no R2 crudo is written, no rate-limit/robots applies. The only invariants are the 100/day code cap and PII redaction. This is a NEW pattern, not a violation of the two-stage rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] supabase-js query builder not assignable to `DbLike`**
- **Found during:** Task 2 (`tsc -b` of `run-digest-prod-cli.ts`).
- **Issue:** The real `@supabase/supabase-js` client's `from()` returns a richly-typed `PostgrestQueryBuilder` whose method chain differs from the minimal structural `DbLike`/`QueryLike` interface `computeNovedades` needs → TS2345 when passing `sb` to `computeNovedades`.
- **Fix:** Cast the client to `DbLike` at the call site (`sb as unknown as DbLike`) with an inline comment — the same `as unknown` idiom `run-actualidad-prod-cli.ts` uses for the typed-`never` insert payload. The structural subset is exactly what the engine consumes; the cast isolates it. tsc then exits 0.
- **Files modified:** `packages/notificaciones/src/run-digest-prod-cli.ts` (imported `DbLike`, cast at the `computeNovedades` call).
- **Commit:** cbc3604 (included in Task 2 commit).

**Note (not a deviation): pnpm-lock.yaml updated.** Adding a new workspace package requires updating the lockfile (`pnpm install --no-frozen-lockfile --ignore-scripts`). All deps were reused (0 downloaded/added) — the new package brings zero new external dependencies; the lockfile change only records the `@obs/notificaciones` workspace entry. Committed with Task 1.

## Authentication gates

None hit during execution — the tests inject a fake db / fake fetch; RESEND_API_KEY absent triggers the honest dry-run path. The PRE-EXISTING operator gate (97-02) and the new RESEND_API_KEY provisioning are documented under Deferred.

## Deferred / Notes (operator)

- **Plan 05 applies the migrations + wires the runtime.** 0069/0070/0071 are not yet in PROD; the CLI reads `suscripcion`/`notificacion_envio` which exist only after apply. Until then the digest cron dry-runs to zero rows.
- **RESEND_API_KEY is a NEW operator secret** (deuda). Before the digest can send live the operator must: (1) create a verified sending domain in Resend + a `re_...` API key; (2) `wrangler`/GH `secrets` load `RESEND_API_KEY` into the repo; (3) set `NOTIF_FROM` to the verified `resumen@<domain>` and `NOTIF_BASE_URL` to the deployed site. Absent the key, the CLI degrades to dry-run (safe).
- **Gated cron launch:** ship with `workflow_dispatch` only. The operator runs a manual green DRY-RUN first (no RESEND_API_KEY), confirms it drains cleanly, then uncomments the `schedule:` block (L-V 12:00 UTC) — mirror of roster-weekly's gated pattern.
- **Confirm email (raw token):** Plan 03 stores `baja_token_hash`/`confirm_token_hash` (sha256) in `suscripcion`; the RAW token lives only in the email link. The current CLI passes `baja_token_hash` as the baja link token as a placeholder — the raw-token round-trip (persisting/reading the raw baja token for the email) is completed when the confirmation-email send path is wired against applied schema in Plan 05. The render + header contract (List-Unsubscribe carries the token) is complete and tested.

## Known Stubs

- **run-digest-prod-cli.ts baja-link token:** the CLI currently uses `suscripcion.baja_token_hash` as the `rawBajaToken` argument to `renderDigest`/`enviarDigest`. Per Plan 02/03 the DB stores only the sha256 HASH; the RAW baja token is generated at subscribe time and is not persisted. The link/header wiring, render, and 100/day+cursor+PII machinery are complete and tested; the raw-token propagation into the outbound email is finalized in Plan 05 when the confirmation-email path runs against applied schema (documented in Deferred). This does not block the plan's goal (the EGRESO engine, cap, cursor, PII redaction, and cron are all complete and green); it is an intentional seam resolved by Plan 05.

## Self-Check: PASSED

- packages/notificaciones/package.json — FOUND
- packages/notificaciones/tsconfig.json — FOUND
- packages/notificaciones/vitest.config.ts — FOUND
- packages/notificaciones/src/index.ts — FOUND
- packages/notificaciones/src/digest.ts — FOUND
- packages/notificaciones/src/digest.test.ts — FOUND
- packages/notificaciones/src/resend.ts — FOUND
- packages/notificaciones/src/run-digest-prod-cli.ts — FOUND
- packages/notificaciones/src/resend.test.ts — FOUND
- .github/workflows/digest-daily.yml — FOUND
- commit 43eb579 (Task 1) — FOUND
- commit cbc3604 (Task 2) — FOUND
- commit c888d5e (Task 3) — FOUND
