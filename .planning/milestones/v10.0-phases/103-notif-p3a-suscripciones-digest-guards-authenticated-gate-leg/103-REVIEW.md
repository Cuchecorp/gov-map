---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .env.example
  - .github/workflows/digest-daily.yml
  - app/app/cuenta/actions.ts
  - app/app/cuenta/cuenta.test.tsx
  - app/app/cuenta/page.tsx
  - app/app/notificaciones/baja/page.tsx
  - app/app/notificaciones/confirmar/page.tsx
  - app/app/notificaciones/notificaciones.test.ts
  - app/app/notificaciones/token.ts
  - app/app/parlamentario/[id]/page.tsx
  - app/app/proyecto/[boletin]/page.tsx
  - app/components/seguir-button.test.tsx
  - app/components/seguir-button.tsx
  - app/lib/anti-insinuacion-guard.test.ts
  - app/lib/lockdown-guard.test.ts
  - app/lib/notif-antiflip-guard.test.ts
  - app/lib/notif-gate.ts
  - app/lib/notif-service.ts
  - app/middleware.ts
  - packages/notificaciones/src/digest.test.ts
  - packages/notificaciones/src/digest.ts
  - packages/notificaciones/src/index.ts
  - packages/notificaciones/src/resend.test.ts
  - packages/notificaciones/src/resend.ts
  - packages/notificaciones/src/run-digest-prod-cli.ts
  - supabase/migrations/0069_suscripcion_rls.sql
  - supabase/migrations/0070_notificacion_envio.sql
  - supabase/migrations/0071_consentimiento.sql
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
rereview_iteration_2:
  reviewed: 2026-07-26T00:00:00Z
  depth: standard
  scope: fixed files + new HMAC token-derivation design
  verified_fixed: [CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, IN-01, IN-02, IN-03]
  new_findings:
    critical: 1   # CR-03 — multi-subscription one-click unsubscribe gap, EXPOSED by the WR-01 delete-fix
    warning: 1    # WR-05 — confirmation-email sender still absent; no row can reach estado='confirmada'
    info: 1       # IN-04 — migration/CLI comments say UPSERT; code is insert + catch-23505
    total: 3
  status: all_fixed   # CR-03, WR-05, IN-04 fixed (see Re-Review Resolution below)
rereview_iteration_2_fix:
  fixed_at: 2026-07-26T00:00:00Z
  fixed: 3      # CR-03, WR-05, IN-04
  skipped: 0
  tests: "1418 app (107 files) + 40 packages green; app tsc --noEmit clean; package tsc -b clean; lockdown-guard 22/22"
  fix_commits:
    CR-03: ee1338d
    WR-05: cfa7fd1
    IN-04: e782524
  human_verification_recommended:  # logic paths — confirm before LIVE flip
    - CR-03  # user-level baja token: verify one click stops the whole digest for a multi-sub user
  pending_operator:
    - "Set NOTIF_TOKEN_SECRET / NOTIF_BASE_URL / NOTIF_FROM as GitHub Actions secrets (both digest-daily.yml steps now read them); RESEND_API_KEY still optional (absent => DRY-RUN)"
    - "Validate the confirmation-email step (run-confirmaciones-prod-cli) with a manual workflow_dispatch DRY-RUN before flipping NOTIF_PUBLIC_ENABLED=true, so the double opt-in loop is proven end-to-end"
fix_status: all_fixed
fix_summary:
  fixed: 9      # CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, IN-01, IN-02, IN-03
  skipped: 0
  tests: "1410 app + 219 packages green; tsc -b clean; lockdown-guard 22/22"
  human_verification_recommended:  # logic paths — confirm before LIVE flip
    - WR-02  # confirm-window write-time semantics
    - WR-04  # 0072 date-cast idempotency + 23505 tolerance
  pending_operator:
    - "Apply migration 0072_notificacion_envio_idempotencia.sql to PROD (0070 already applied; de-dup any duplicate 'enviado' rows first if the cron ever ran)"
    - "Set NOTIF_TOKEN_SECRET (same value) in the CRON (GitHub Actions secret) and the Worker env; without it seguir() and the digest CLI fail-loud"
fix_commits:
  CR-01/CR-02: [8543292, d2ffebc]
  WR-01: 1b1b1c7
  WR-02: b5da12d
  WR-03: 623a402
  WR-04: f508509
  IN-03: 7fa4570
---

# Phase 103: Code Review Report

**Reviewed:** 2026-07-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 103 introduces the first user-owned data plane (subscriptions, consent, send-log) plus the email digest EGRESO path. The security substrate is strong: RLS is deny-by-default with two-user pgTAP isolation, the service_role plane is separated into a dedicated `notif-service.ts` module, the NOTIF gate is fail-closed with an anti-flip guard, PII redaction (`redactEmail`) is applied on every logging path, and HTML output is escaped. Input validation and server-derived `user_id` are correct.

However, the review surfaced a **broken opaque-token round-trip that defeats the phase's core legal requirement** (Ley 21.719 one-click unsubscribe): the digest CLI passes the stored *hash* as the *raw* unsubscribe token, so the landing page double-hashes it and every unsubscribe link in every sent email fails to resolve. Compounding this, the raw confirm/baja tokens are generated and immediately discarded at subscription time, so there is no data path by which any email (confirmation or unsubscribe) can ever carry a working raw token. A separate correctness bug prevents a user who unsubscribed via email from ever re-following. These are BLOCKERS for the LIVE flip.

## Critical Issues

### CR-01: Unsubscribe link is unusable — digest CLI sends the token HASH as the raw token

> **FIXED (8543292):** tokens are now derived deterministically — raw = base64url(HMAC-SHA256(NOTIF_TOKEN_SECRET, `${purpose}:${suscripcion_id}`)); the CLI regenerates the raw baja token at send time via `deriveRawToken` (fail-loud without the secret). Round-trip proven: `hashToken(rawBajaInEmail) === storedBajaTokenHash`.

**File:** `packages/notificaciones/src/run-digest-prod-cli.ts:213`
**Issue:** The CLI reads `baja_token_hash` from the DB and passes it verbatim as the raw baja token into `renderDigest`/`enviarDigest`:
```ts
const rawBaja = u.bajaTokenHash ?? ""; // el raw viaja en el link; hash en DB (Plan 03)
```
The unsubscribe URL therefore becomes `/notificaciones/baja?t=<sha256-hash>`. But the landing page hashes the incoming `?t=` again before lookup:
```ts
// app/app/notificaciones/baja/page.tsx:58
const suscripcion = await buscarSuscripcionPorBajaToken(hashToken(raw));
```
So the query filters `baja_token_hash == sha256(<hash>)`, which never matches the stored `baja_token_hash`. **Every one-click unsubscribe link in every email is dead** — a direct violation of the phase's stated Ley 21.719 one-click-unsubscribe obligation and the `List-Unsubscribe` header contract. The inline comment ("el raw viaja en el link; hash en DB") is factually inverted: it is shipping the hash, not the raw.

There is no correct value available to pass here, because the raw baja token was discarded at subscription time (see CR-02). This is not deferrable "Plan 04" work: the CLI ships in this phase and actively emits broken links.

**Fix:** The raw baja token must be recoverable at send time. Either (a) compose and store the unsubscribe URL / raw token at subscription time behind a secret (e.g. encrypted-at-rest column, or a signed HMAC token derived deterministically from a server secret + subscription id so it can be regenerated), or (b) generate the baja token as a keyed value the CLI can reproduce. Whatever the choice, the value placed in `?t=` must hash (via `hashToken`) to the stored `baja_token_hash`. Do NOT pass `baja_token_hash` itself:
```ts
// WRONG — hash != raw
const rawBaja = u.bajaTokenHash ?? "";
// RIGHT (sketch) — regenerate a raw token that hashToken()s to the stored hash,
// e.g. HMAC(secret, suscripcion_id) stored as *_token_hash at insert time.
const rawBaja = deriveRawBajaToken(secret, u.suscripcionId);
```
Add a round-trip test asserting `hashToken(rawBajaInEmail) === storedBajaTokenHash`.

### CR-02: Raw confirm/baja tokens are generated then discarded — double opt-in can never complete

> **FIXED (8543292):** `seguir` now generates the suscripcion id client-side (crypto.randomUUID) and derives both tokens BEFORE the single insert; the DB still stores ONLY the hashes. Both confirm and baja raw tokens are reproducible server-side (same HMAC) by the confirmation-email step and the digest CLI. Subscribe-side round-trip test added.

**File:** `app/app/cuenta/actions.ts:204-218`
**Issue:** `seguir` generates two opaque tokens but persists only their hashes and never captures or forwards the raw values:
```ts
const confirm = generarToken();  // { raw, hash }
const baja = generarToken();
...
.insert({
  ...
  confirm_token_hash: confirm.hash,
  baja_token_hash: baja.hash,
  ...
});
// confirm.raw and baja.raw go out of scope here — lost forever.
```
The raw tokens are the ONLY values that can be placed in an email link (the landing pages hash the incoming `?t=` and match against `*_token_hash`). Because they are neither stored nor emitted anywhere, the confirmation email (which must carry `confirm.raw`) can never be produced, so a subscription can never transition `pendiente -> confirmada` through the documented email flow — and the digest CLI only sends to `estado = 'confirmada'`. The net effect: with the current data model no user can ever legitimately receive a digest, and no unsubscribe link can be minted (root cause of CR-01). The "Plan 04 sends the email" comment does not resolve this: Plan 04 would have no raw token to send.

**Fix:** Persist a recoverable form of the raw tokens or make them deterministically regenerable server-side (keyed HMAC over subscription id, as in CR-01), and thread the raw confirm token into the confirmation-email step. Ensure the same derivation is used by both the email composer and any future `marcarConfirmada` flow. Add a test that a token minted at `seguir` time round-trips through `hashToken` to the stored `confirm_token_hash`.

## Warnings

### WR-01: User who unsubscribed via email can never re-follow (unique-constraint collision)

> **FIXED (1b1b1c7):** `marcarBaja` now DELETEs the row (aligned with UI `dejarDeSeguir`), so baja = row deleted and re-follow is always a clean INSERT. Regression test proves DELETE (not update-to-baja).

**File:** `app/app/cuenta/actions.ts:210-218`, `supabase/migrations/0069_suscripcion_rls.sql:48`
**Issue:** The table has `unique (user_id, tipo, objetivo_id)`. The email one-click path (`marcarBaja`, `notif-service.ts:112`) sets `estado = 'baja'` but leaves the row in place. When that user later clicks "Seguir" again, `seguir` performs a plain `INSERT` (not an upsert), which collides with the surviving `baja` row and fails with the generic "no se pudo completar la acción". Meanwhile the UI shows them as not-following (`.neq("estado","baja")`), so the button is present and clickable but permanently errors. Note the two baja paths are inconsistent: `dejarDeSeguir` (UI) does a `DELETE` (re-follow works), but `marcarBaja` (email) does a state flip (re-follow blocked).
**Fix:** Make `seguir` an upsert on the unique key that resets a `baja` row back to `pendiente` and regenerates tokens/consent, e.g. `.upsert({...}, { onConflict: "user_id,tipo,objetivo_id" })` with an explicit estado reset, or have `seguir` detect an existing `baja` row and update it. Align the two unsubscribe paths on one representation.

### WR-02: Confirmation-window expiry cannot be enforced — no `confirm_expira_at` re-check on the digest path, and expired-but-confirmed rows are indistinguishable

> **FIXED (b5da12d) — human-verify:** `marcarConfirmada` now re-validates the window IN THE WRITE (`confirm_expira_at.gt.now()` or is null) and returns whether a row was confirmed; the confirm page honors that result. Expired token → zero rows → false, regardless of caller. Logic path — confirm semantics before LIVE flip.

**File:** `app/app/notificaciones/confirmar/page.tsx:62-70`, `packages/notificaciones/src/run-digest-prod-cli.ts:90-107`
**Issue:** The confirm landing page correctly refuses to confirm an expired token. But once a row is `confirmada`, nothing re-validates the window, and `leerConfirmadas` selects purely on `estado = 'confirmada'`. That is acceptable by itself; the concern is that the ONLY writer that can set `confirmada` (the email confirm flow) is currently unreachable (CR-02), so any `confirmada` rows in production today could only arrive via manual/service_role writes that bypass the window check — there is no guard that a `confirmada` row actually passed a valid, unexpired confirmation. Combined with CR-01/CR-02 this means the confirmed-set integrity rests entirely on a path that does not work.
**Fix:** After CR-02 is fixed, ensure `marcarConfirmada` (or an equivalent RPC) re-checks `confirm_expira_at > now()` at write time server-side, not only in the page, so the invariant "confirmada implies a valid unexpired confirmation occurred" holds regardless of caller.

### WR-03: Empty digests are sent daily and consume the 100/day hard cap

> **FIXED (623a402):** `filtrarConNovedades` (tested) is applied BEFORE `enforceCap` — a user whose every group is empty gets no email (cap + reputation preserved, cursor not advanced); users with real novedades get cap priority. Empty groups of a non-empty user keep the honest no-news note.

**File:** `packages/notificaciones/src/run-digest-prod-cli.ts:199-224`
**Issue:** Every confirmed user in `aEnviar` is emailed unconditionally, even when all of their groups have zero novedades (`renderDigest` renders "Sin novedades registradas hoy" notes). Each such send still consumes one of the 100/day Resend slots and writes a `notificacion_envio` row. With more than 100 confirmed users, users with genuine novedades can be starved behind no-news sends, and the free-tier cap is burned on empty mails. This also risks spam-folder reputation damage from daily content-free email.
**Fix:** Skip users whose every group is empty (only send when at least one group has `novedades.length > 0`), or apply `enforceCap` after filtering out empty-digest users so real novedades are prioritized. Keep the "no-news note" only for users who have at least one non-empty group.

### WR-04: `notificacion_envio` has no uniqueness/idempotency key — retries can double-insert send rows

> **FIXED (f508509) — human-verify + PENDING PROD APPLY:** new migration **0072** (0070 NOT edited) adds a partial unique index `(user_id, suscripcion_id, UTC-day-of-enviado_at) where estado='enviado'`; the CLI tolerates the 23505 unique_violation on a same-day re-run as an idempotent no-op. **Operator must apply 0072 to PROD** (de-dup existing 'enviado' rows first if the cron ever ran). Logic path — verify date-cast/23505 handling.

**File:** `supabase/migrations/0070_notificacion_envio.sql:37-46`, `packages/notificaciones/src/run-digest-prod-cli.ts:228-236`
**Issue:** The cursor advance inserts a fresh `notificacion_envio` row per group after each successful send, with no unique constraint on `(user_id, suscripcion_id, <day>)` or equivalent. If the workflow is re-dispatched the same day (it is `workflow_dispatch` gated, and `concurrency: cancel-in-progress: false` allows a queued rerun), a user whose novedades already advanced could still be re-processed if a partial failure left some groups unsent, and successful groups get a second row. `leerCursor` tolerates duplicates (it picks max `enviado_at`), so this is not data loss, but the send-log accumulates duplicate "enviado" rows and the design's claimed atomic/idempotent cursor is only idempotent by read-time max, not by construction.
**Fix:** Add a natural idempotency key, e.g. `unique (user_id, suscripcion_id, (enviado_at::date))` or a per-run `run_id`, and upsert instead of insert; or guard the send loop so a group already logged as `enviado` for the day is skipped before re-sending.

## Info

### IN-01: Misleading inline comment on the broken token line

> **FIXED (8543292):** the inverted comment was removed when the broken hash-as-raw line was replaced by `deriveRawToken`.

**File:** `packages/notificaciones/src/run-digest-prod-cli.ts:213`
**Issue:** The comment `// el raw viaja en el link; hash en DB (Plan 03)` asserts the correct invariant while the code does the opposite (ships the hash). Beyond CR-01, the comment will actively mislead the next maintainer into believing the round-trip is sound.
**Fix:** Once CR-01 is fixed, update the comment to describe the actual derivation; until then it should not claim correctness.

### IN-02: `HARD_CAP_DIARIO` constant bypassed by a literal in the log line

> **FIXED (8543292):** the log line now interpolates `HARD_CAP_DIARIO` (imported from `./digest`).

**File:** `packages/notificaciones/src/run-digest-prod-cli.ts:193`
**Issue:** The cap is a named constant (`HARD_CAP_DIARIO = 100`) and `enforceCap` uses it, but the log line hardcodes `${100}`. If the cap ever changes, the log will lie.
**Fix:** Interpolate the constant: `` `digest-prod: cap ${HARD_CAP_DIARIO}/día ...` `` (import it; it is already exported from `./digest`).

### IN-03: `notaSinNovedades` exported/tested but unused by the renderer (duplicated string)

> **FIXED (7fa4570):** `renderDigest` now calls `notaSinNovedades(fecha)` in both the HTML and text branches — single source of truth.

**File:** `packages/notificaciones/src/digest.ts:192-194`, `packages/notificaciones/src/resend.ts:87-89,121-123`
**Issue:** `notaSinNovedades(fecha)` produces the canonical no-news sentence and is unit-tested, but `renderDigest` re-inlines the identical Spanish string in two places rather than calling it. The string is thus duplicated across three sites; a copy edit to one will silently diverge from the tested constant.
**Fix:** Have `renderDigest` call `notaSinNovedades(fecha)` for both the HTML and text branches so the tested function is the single source of truth.

---

_Reviewed: 2026-07-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Re-Review (iteration 2)

**Reviewed:** 2026-07-26T00:00:00Z
**Depth:** standard
**Scope:** the fixed files + the new HMAC-derived token design (per re-review objective — token security, round-trip correctness, WR-01/03/04 semantics, no PII/dry-run regressions).
**Verdict:** ISSUES FOUND. The eight prior findings I could re-verify are genuinely fixed and the new HMAC design is sound, but the WR-01 delete-fix **exposed a live one-click-unsubscribe defect for multi-subscription users (CR-03, BLOCKER)**, and the confirmation-email sender is still absent so no subscription can reach `confirmada` (WR-05).

### Verification of prior fixes

**CR-01 / CR-02 — token round-trip (VERIFIED FIXED).** The new design is cryptographically sound. `deriveToken` (app `token.ts:73-89`) and `deriveRawToken` (`digest.ts:47-59`) are byte-identical: both compute `base64url(HMAC-SHA256(secret, \`${purpose}:${suscripcionId}\`))`, and `hashToken` = `sha256(raw)` hex. Stored `*_token_hash` = `sha256(raw)`; email carries `raw`; landing pages (`baja/page.tsx:58`, `confirmar/page.tsx:59`) apply `hashToken(raw)` and look up by equality → matches. Round-trip holds for **both** confirm and baja. Tests freeze the shared formula (`notificaciones.test.ts:81-86`, `digest.test.ts:245-257`).
- *Forgeability (review dim 1):* `suscripcion_id` is a client-generated UUID and is effectively public, but forging a token requires `HMAC(secret, …)` — an attacker with the UUID but not `NOTIF_TOKEN_SECRET` cannot derive `raw`. Correct. The secret fails loud when absent in all three consumers (`actions.ts:53-62`, `token.ts:78`, `digest.ts:52`, and the CLI exits without sending at `run-digest-prod-cli.ts:148-157`).
- *Timing safety (review dim 1):* there is no JS string comparison of tokens — verification is a Postgres index equality on the sha256 hash, so there is no timing side channel to attack, and enumeration is infeasible (128-bit UUID + secret). No issue.

**WR-02 — confirm-window in the write (VERIFIED FIXED).** `marcarConfirmada` (`notif-service.ts:109-124`) re-checks the window in the UPDATE via `.or(\`confirm_expira_at.gt.${ahora},confirm_expira_at.is.null\`)` and returns `data.length > 0`; the page (`confirmar/page.tsx:71`) honors the write result, closing the read-then-write race. The interpolated ISO timestamp contains no PostgREST `.or()` metacharacters (no comma/paren), so the filter is not injectable. Tests cover the true and zero-row cases (`notif-service.test.ts:99-114`).

**WR-01 — email baja aligned to DELETE (VERIFIED FIXED, but see CR-03).** `marcarBaja` (`notif-service.ts:139-148`) now DELETEs by `id`, matching `dejarDeSeguir`. Re-follow after a single-subscription baja is a clean INSERT. Regression test asserts DELETE, not state-flip (`notif-service.test.ts:85-97`). **However, aligning both paths on "delete one row" created CR-03 below for multi-subscription users.**

**WR-03 — empty digests skipped (VERIFIED FIXED).** `filtrarConNovedades` (`digest.ts:215-219`) is applied BEFORE `enforceCap` (`run-digest-prod-cli.ts:214-226`); users with all-empty groups get no email and their cursor does not advance. Tested (`digest.test.ts:195-215`).

**WR-04 — idempotency (VERIFIED FIXED, with IN-04 caveat).** Migration 0072 adds the partial unique index `(user_id, suscripcion_id, ((enviado_at at time zone 'UTC')::date)) where estado='enviado' and enviado_at is not null`. The UTC date-cast matches the CLI's UTC `enviado_at` (`new Date().toISOString()`), so same-day re-inserts collide. The CLI (`run-digest-prod-cli.ts:266-282`) inserts and tolerates code `23505` as a no-op, which is a correct insert-or-ignore idempotency strategy. The `where estado='enviado'` predicate correctly leaves `pendiente`/`error` rows unconstrained. PROD apply is still pending-operator, as noted.

**IN-01 / IN-02 / IN-03 (VERIFIED FIXED).** The inverted comment is gone; the cap log line interpolates `HARD_CAP_DIARIO` (`run-digest-prod-cli.ts:228`); `renderDigest` calls `notaSinNovedades(fecha)` in both HTML and text branches (`resend.ts:88,122`).

**No PII / dry-run regressions (review dim 5, VERIFIED).** Every send-path log uses `redactEmail`; error logs carry only `{ status, name, code }`; the truncated `u.userId.slice(0,8)` is a UUID prefix, not PII. Dry-run without `RESEND_API_KEY` still short-circuits before `fetch` and is tested to not leak the raw email (`resend.test.ts:24-40`).

### New Findings (introduced or exposed by the fixes)

## Critical Issues (Re-Review)

### CR-03: One-click unsubscribe stops only ONE of a multi-subscription user's targets — WR-01 delete-fix broke the List-Unsubscribe guarantee

**File:** `packages/notificaciones/src/run-digest-prod-cli.ts:185-206,251`, `packages/notificaciones/src/resend.ts:114,164,172`, `app/lib/notif-service.ts:139-148`
**Issue:** The CLI sends **one aggregated digest per user** covering all of that user's confirmed subscriptions (grouped in `porUsuario`), but derives a **single** baja token from only the *first* subscription encountered:
```ts
// run-digest-prod-cli.ts:197
p = { userId: s.user_id, grupos: [], bajaSuscripcionId: s.id }; // only the FIRST id
...
// run-digest-prod-cli.ts:251
const rawBaja = deriveRawToken(tokenSecret, "baja", u.bajaSuscripcionId);
```
That single `rawBaja` populates both the footer "Darte de baja" link and the `List-Unsubscribe` header (`resend.ts:114,164,172`). When the recipient clicks it — or when Gmail/Outlook honors the RFC 8058 one-click header — the landing page calls `marcarBaja(id)`, which after the WR-01 fix **DELETEs exactly that one subscription row** (`notif-service.ts:139-148`). The user's *other* confirmed subscriptions survive, so **the next daily digest still arrives**. This directly violates the phase's stated Ley 21.719 / `List-Unsubscribe=One-Click` obligation: the one-click action must stop the mailing, not silence one of N topics with no way to reach the rest (the footer exposes only the one link).

This is a **regression exposed by the WR-01 fix**: the prior `estado='baja'` flip was also single-row, but the switch to hard-DELETE removes the row entirely and, combined with per-user aggregation, leaves no durable "this user opted out of the digest" signal and no per-group unsubscribe affordance. The digest is one email; unsubscribe must govern that email.

**Fix (choose one, server-verifiable):**
- Make unsubscribe operate at the **digest/user** granularity: derive the baja token from the `user_id` (or a per-user digest id) and have `marcarBaja` remove/suppress *all* of that user's subscriptions (or set a user-level `digest_suppressed` flag the CLI honors), so one click stops the whole mailing. Then keep per-subscription "seguir/dejar de seguir" in the UI only.
- OR render **one unsubscribe link per group** in the footer AND keep the `List-Unsubscribe` header pointed at a token that unsubscribes the entire digest — the header cannot be per-group, so the header must map to a user-level suppression regardless.

Add a test with a two-subscription user asserting that following the `List-Unsubscribe` URL results in zero subsequent digest sends for that user.

## Warnings (Re-Review)

### WR-05: No confirmation-email sender exists — no subscription can reach `estado='confirmada'`, so the digest still sends to nobody

**File:** `app/app/cuenta/actions.ts:227-242` (derives + hashes confirm token, never emits it), whole repo (no confirm-email sender)
**Issue:** The CR-02 fix made the confirm token *derivable* and *round-trippable* (verified), but nothing in the codebase ever emails the raw confirm token to the user. A grep across `packages/notificaciones` and `app/` finds only the `"confirm"` purpose in derivation/tests — no sender composes `/notificaciones/confirmar?t=<raw>`. Since `seguir` creates rows as `pendiente` and `leerConfirmadas` (`run-digest-prod-cli.ts:99-105`) filters `estado='confirmada'`, and the only writer of `confirmada` is `marcarConfirmada` (reachable only from the confirm landing page, which requires the raw token from an email that is never sent), **no subscription can legitimately reach `confirmada`** — so the digest CLI has nothing to send in production. This is the same substantive gap as the original CR-02, now reduced to the missing *send* step. It is explicitly deferred to "Plan 04" in code comments and the whole surface is gated (`NOTIF_PUBLIC_ENABLED=false`), so it is a Warning rather than a fresh Blocker — but the phase cannot deliver a working digest until the confirmation email actually ships.
**Fix:** Add the double-opt-in confirmation-email step (derive `confirm` raw via `deriveToken(secret,'confirm',id)`, email `${baseUrl}/notificaciones/confirmar?t=${raw}`), and add an end-to-end test: `seguir` → confirmation email token → `/confirmar?t=` → `estado='confirmada'` → digest includes the user. Do not flip `NOTIF_PUBLIC_ENABLED=true` before this loop closes, or subscribers will sit in `pendiente` forever and never receive a digest.

## Info (Re-Review)

### IN-04: Migration 0072 and CLI header claim "UPSERT with onConflict"; the code uses `insert` + catch-23505

**File:** `supabase/migrations/0072_notificacion_envio_idempotencia.sql:20-21`, `packages/notificaciones/src/run-digest-prod-cli.ts:19,266-282`
**Issue:** The 0072 comment says "El CLI hace UPSERT con onConflict sobre estas columnas" and the CLI header step 5 says "upsert notificacion_envio", but the implementation calls `.insert(...)` and tolerates `23505` (`if (insErr && code !== "23505") throw`). There is no `.upsert()`/`onConflict` call (verified by grep). The insert-or-ignore behavior is functionally correct and idempotent, so this is documentation drift, not a bug — but a maintainer trusting the comment may expect the row to be *updated* (advancing `ultimo_evento_visto`) on a same-day rerun, whereas it is actually left unchanged. Since the cursor only advances on successful sends and the first same-day insert already recorded the correct `nuevoCur`, leaving it unchanged is fine; the divergence is purely descriptive.
**Fix:** Update the 0072 comment (lines 20-21) and the CLI header (line 19) to say "insert + tolerate 23505 (insert-or-ignore)", or switch to an actual `.upsert(..., { onConflict: 'user_id,suscripcion_id,<day-expr>' })` if update-on-rerun semantics are desired (note: a partial-index expression column cannot be named directly in `onConflict`, which is itself a reason the insert+catch approach was chosen — worth stating in the comment).

---

_Re-Reviewed: 2026-07-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Result: ISSUES FOUND (1 new Critical, 1 new Warning, 1 new Info; all 9 prior findings verified fixed)_

---

## Re-Review Resolution (iteration 2 fixes)

**Fixed at:** 2026-07-26
**Fixer:** Claude (gsd-code-fixer)
**Result:** ALL FIXED — CR-03, WR-05, IN-04 resolved. Test gate GREEN (1418 app tests / 107 files + 40 package tests; app `tsc --noEmit` clean; package `tsc -b` clean; lockdown-guard 22/22).

### CR-03: one-click unsubscribe now suppresses the digest at the USER level (FIXED — commit `ee1338d`)

The digest is one aggregated email per user; the baja token is now derived from the **user_id**, not the first subscription. New self-authenticating token: `base64url(userId + ":" + HMAC-SHA256(secret, "baja-user:" + userId))`.

- `deriveUserBajaToken` added to BOTH `app/app/notificaciones/token.ts` and `packages/notificaciones/src/digest.ts` (byte-identical HMAC formula, frozen by a cross-package round-trip test).
- `verifyUserBajaToken` (app) base64url-decodes the token, splits on the first `:`, re-derives the HMAC over the `user_id` and compares in **constant time** (`crypto.timingSafeEqual`). No DB lookup by token — the token self-authenticates. The `user_id` (a UUID) is not secret, but forging the signature requires `NOTIF_TOKEN_SECRET`.
- `marcarBajaUsuario(userId)` in `notif-service.ts` DELETEs **all** of the user's subscriptions (FK `on delete cascade` clears the send cursors) and returns the deleted count.
- The baja landing (`baja/page.tsx`) tries the user-level token first (the digest links) and falls back to the legacy per-subscription token; the user-level path shows a digest-wide copy. The `List-Unsubscribe` header and footer link now carry the user-level token, so one click (or an RFC 8058 client honoring the header) stops the entire mailing.
- The CLI (`run-digest-prod-cli.ts`) derives the baja token from `u.userId` (the `bajaSuscripcionId`/first-subscription field is gone). The per-subscription `dejarDeSeguir` in `/cuenta` is unchanged.
- **Regression tests:** cross-package round-trip + unforgeability (`digest.test.ts`, `notificaciones.test.ts`); a two-subscription user whose one click deletes all rows — `marcarBajaUsuario` returns 2 (`notif-service.test.ts`).
- *Human verification recommended:* confirm the end-to-end one-click behavior for a real multi-subscription user before the LIVE flip.

### WR-05: the double opt-in confirmation-email sender now ships (FIXED — commit `cfa7fd1`)

The confirm token was derivable but never emailed, so no row could reach `estado='confirmada'`. Added the confirmation EGRESO path:

- `renderConfirmacion(objetivos, confirmUrl)` + `enviarConfirmacion` in `resend.ts` (a shared `postResend` helper now backs both the digest and the confirmation; the confirmation carries **no** `List-Unsubscribe`, since there is no active subscription yet).
- New CLI `run-confirmaciones-prod-cli.ts`: reads `suscripcion estado='pendiente'` within the confirm window (`confirm_expira_at > now()` or null), derives the raw confirm token (`deriveRawToken 'confirm'`, the same HMAC the app used at subscribe time), composes `/notificaciones/confirmar?t=<raw>`, and sends via Resend. Dry-run without `RESEND_API_KEY`, PII-redacted logs, counts toward the 100/day cap (`enforceCap`), fail-loud without `NOTIF_TOKEN_SECRET`.
- `digest-daily.yml` runs the confirmation CLI as a step **before** the digest drain (still `workflow_dispatch` gated); both steps now pass `NOTIF_TOKEN_SECRET` / `NOTIF_BASE_URL` / `NOTIF_FROM`.
- **Tests:** `renderConfirmacion` (CTA + objetivos, no baja link, HTML escape) and `enviarConfirmacion` (dry-run, POST, no `List-Unsubscribe`, 429) in `resend.test.ts`.
- *Do not flip `NOTIF_PUBLIC_ENABLED=true` until a manual `workflow_dispatch` DRY-RUN proves the loop end-to-end.*

### IN-04: insert-or-ignore comment drift corrected (FIXED — commit `e782524`)

The 0072 migration comment and the CLI flow-step 5 claimed "UPSERT with onConflict"; the code actually does `INSERT` + tolerate `23505` (insert-or-ignore). Corrected both comments (0072 lines 19-20, CLI header) to describe the real behavior and to note **why** `onConflict` is not used: the unique index is over an expression column `((enviado_at at time zone 'UTC')::date)` that cannot be named in `onConflict`. **0072 is already applied to PROD — the index/constraint was NOT touched, only the prose.**

---

_Fixed: 2026-07-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 (re-review fixes)_
