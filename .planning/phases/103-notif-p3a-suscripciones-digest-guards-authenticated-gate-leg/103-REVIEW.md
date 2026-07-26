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
