---
phase: 103-notif-p3a-suscripciones-digest-guards-authenticated-gate-leg
verified: 2026-07-26T12:00:00Z
status: human_needed
score: 20/20 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Operator provisioning — Supabase publishable key + OTP template renders {{ .Token }}"
    expected: "sb_publishable_… created (project bctyygbmqcvizyplktuw); Email provider ON; OTP template renders {{ .Token }} NOT {{ .ConfirmationURL }}; wrangler secret put SUPABASE_PUBLISHABLE_KEY confirmed via wrangler secret list"
    why_human: "Operator-exclusive credential (Supabase dashboard + wrangler secret); agent cannot create keys or touch dashboards"
  - test: "Operator provisioning — Resend verified sending domain + DPA + RESEND_API_KEY"
    expected: "Sending domain verified for the from address; Resend DPA signed (subencargado 21.719); re_… key created; loaded as wrangler secret (deploy) + GH Actions secret (cron); NOTIF_FROM + NOTIF_BASE_URL set"
    why_human: "Operator Resend account + legal DPA sign; agent cannot provision"
  - test: "NOTIF_TOKEN_SECRET set as GitHub Actions secret AND Worker env (same value)"
    expected: "Both digest-daily.yml steps read NOTIF_TOKEN_SECRET; without it seguir() and both CLIs fail-loud. Must be identical value app-side and cron-side for token round-trip"
    why_human: "Operator-exclusive secret provisioning across two runtimes (Worker + GH Actions)"
  - test: "Deploy + flip NOTIF_PUBLIC_ENABLED=true at deploy-time (OR Flag-OFF closure)"
    expected: "OpenNext Docker build + wrangler deploy; /spike-auth absent from build; Camino A + CSP intact; NOTIF_PUBLIC_ENABLED=true set as Worker env var (NOT committed). Deploy travels with Phase 104 per 101-102 pattern — currently Flag-OFF closure executed (feature parked, inert)"
    why_human: "Deploy requires operator credentials + Cloudflare OAuth; flip is a runtime env var act, not a code change"
  - test: "SC2 curl evidence on live deploy (Set-Cookie + session refresh through OpenNext)"
    expected: "97-SPIKE-EVIDENCE curl block (PII-redacted) confirms Set-Cookie + session refresh through the OpenNext pipeline on the live deploy"
    why_human: "Requires a running live deploy; cannot verify statically"
  - test: "BrowserOS DOM check — Seguir button PRESENT when flag ON on both fichas"
    expected: "With NOTIF_PUBLIC_ENABLED=true, the Seguir button renders in the DOM on proyecto/[boletin] and parlamentario/[id]; absent when OFF (verified statically as return null)"
    why_human: "Visual DOM presence on live deploy with flag ON; static test confirms absent-when-OFF only"
  - test: "End-to-end double opt-in loop — manual workflow_dispatch DRY-RUN before LIVE flip"
    expected: "Manual dispatch of digest-daily.yml (run-confirmaciones + run-digest) DRY-RUN proves the double opt-in loop end-to-end (seguir → confirmation email → /confirmar → estado='confirmada' → digest includes user); CR-03 one-click baja stops the whole digest for a multi-sub user"
    why_human: "Requires real inbox / live cron dispatch; INERT behind flag + missing operator secrets today"
  - test: "Real email UAT (confirmation + digest + one-click unsubscribe)"
    expected: "Operator receives a real confirmation email, confirms, receives a digest, and one-click unsubscribe stops the entire mailing"
    why_human: "Requires a real mailbox and provisioned Resend domain/key"
---

# Phase 103: NOTIF P3a (suscripciones + digest + guards + authenticated gate + legal) Verification Report

**Phase Goal:** Introducir el primer dato de usuario del sistema (suscripciones + digest por email) con auth/RLS reales y el lockdown-guard extendido al rol nuevo desde el primer commit — sin que el agujero de `authenticated` llegue a PROD.
**Verified:** 2026-07-26T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is achieved in the codebase. All five NOTIF requirements are satisfied by substantive, wired, tested code. The two remaining classes of work — (1) PROD apply of the migrations and (2) operator provisioning + deploy + flip — are exactly the documented human checkpoints of Plan 05. The migrations were applied to PROD by the agent (authorized this run, evidenced in 103-05-SUMMARY + STATE.md + commit 830a01b with pgTAP 20/20), and the flip resolved via the NOTIF-05 Flag-OFF closure (an explicitly requirement-sanctioned path). Status is `human_needed` because Step 8 produced operator-only verification items (provisioning, SC2 curl, DOM check, real-email UAT) that cannot be verified statically — not because any must-have failed.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | lockdown-guard bites any `to authenticated` grant/policy on a table not in USER_OWNED_TABLES (Block D) | ✓ VERIFIED | `USER_OWNED_TABLES = new Set(["suscripcion","consentimiento"])` + `authenticatedGrantOffenders` positive-allowlist inversion (lockdown-guard.test.ts:162,273); mutation self-check bites proyecto fixture (line 472+); full app suite 1418/1418 green |
| 2 | lockdown-guard bites any `authenticated` grant to notificacion_envio (Block E, service_role-only queue) | ✓ VERIFIED | Explicit test line 487-490 `grant insert on public.notificacion_envio to authenticated` → offender; `USER_OWNED_TABLES.has("notificacion_envio")` asserted false (line 451) |
| 3 | Guard tolerates dedicated notif-service.ts; supabase.ts stays clean of user tables | ✓ VERIFIED | `NOTIF_SERVICE_TS` allowlist path (line 56); supabase.ts `.from()` chokepoint scoped; lockdown-guard green (22/22 per SUMMARY, full suite green here) |
| 4 | NOTIF flag reads NOTIF_PUBLIC_ENABLED with single strict `=== "true"` | ✓ VERIFIED | notif-gate.ts: `return env.NOTIF_PUBLIC_ENABLED === "true"` single chokepoint; anti-flip guard green in full suite |
| 5 | anti-flip guard bites any relaxation + .env.example=true | ✓ VERIFIED | notif-antiflip-guard.test.ts V1a-d/V2a-b + self-check (RED-mutation test line 413-416); no committed `=true` outside test fixtures (Grep) |
| 6 | suscripcion RLS deny-by-default; user A cannot see/delete user B's rows | ✓ VERIFIED | 0069: 3 policies `to authenticated` with `(select auth.uid())=user_id`; pgTAP 0069 uses `set local role authenticated` + `request.jwt.claims` two-user (grep count 4); PROD pgTAP 6/6 per SUMMARY |
| 7 | consentimiento records fecha/version/metodo, owner-scoped RLS insert | ✓ VERIFIED | 0071 present with version_texto/metodo/created_at; insert+select owner-scoped policies; pgTAP 0071 8/8 |
| 8 | notificacion_envio ZERO authenticated grant (service_role-only queue, idempotent cursor) | ✓ VERIFIED | `grep -ci 'to authenticated'` on 0070 non-comment = 0; ultimo_evento_visto cursor column; 0072 partial unique idempotency index |
| 9 | anon has no select on any of the three tables (deny-by-default) | ✓ VERIFIED | 0 matches for `to anon\|to public\|to web_reader` across 0069/0070/0071; pgTAP anon-select false asserts |
| 10 | authenticated user logs in via OTP on /cuenta and sees subscriptions | ✓ VERIFIED | cuenta/actions.ts exports enviarOtp/verificarOtp; cuenta/page.tsx force-dynamic + gated; cuenta.test.tsx green (full suite) |
| 11 | Seguir button toggles a subscription via user-session Server Action (RLS applies) | ✓ VERIFIED | seguir/dejarDeSeguir via createUserClient; user_id from getClaims() server-side; seguir-button.test.tsx green |
| 12 | Seguir button ABSENT from DOM when NOTIF flag OFF | ✓ VERIFIED | seguir-button.tsx line 65 `if (!notifPublicEnabled(process.env)) return null;` (return null, not CSS-hidden); RTL test asserts absence |
| 13 | Double opt-in confirm + unsubscribe work via opaque token WITHOUT login | ✓ VERIFIED | confirmar/baja pages read ?t=, hashToken lookup via notif-service; token round-trip HMAC-derived (CR-01/02 fixed); notificaciones.test.ts green |
| 14 | user_id derived from auth.uid() server-side, never client input | ✓ VERIFIED | getClaims() sub server-derived (actions.ts); Pitfall 5 mitigated |
| 15 | Token lookup uses dedicated notif-service.ts, NOT supabase.ts | ✓ VERIFIED | notif-service.ts is the sole service_role user-table access point; supabase.ts untouched (guard green) |
| 16 | Digest groups novedades per subscription via idempotent cursor (no double-send) | ✓ VERIFIED | digest.ts cursor + 0072 partial unique index + CLI 23505-tolerant insert-or-ignore; digest.test.ts idempotency test green (40 pkg tests) |
| 17 | parlamentario subscription resolves via proyecto_autor (confirmado) → tramitacion_evento | ✓ VERIFIED | digest.ts:210-216 `.eq("estado_vinculo","confirmado")` fail-closed; test asserts non-empty confirmado + zero no_confirmado |
| 18 | Hard 100/day cap; over-cap users queued; email never logged raw / never to R2; RESEND absent ⇒ dry-run | ✓ VERIFIED | HARD_CAP_DIARIO=100; filtrarConNovedades before enforceCap (WR-03); redactEmail everywhere; dry-run test green |
| 19 | Legal dossier 21.719 signoff: approved (operator pre-authorization VERBATIM) | ✓ VERIFIED | docs/legal/103-LEGAL-DOSSIER-NOTIF.md `signoff: approved` + operator-abogado VERBATIM §9; "agente DOCUMENTA, operador AUTORIZA" |
| 20 | Migrations applied to PROD + DEPLOY-RUNBOOK Flag-OFF closure (NOTIF-05 fallback) executable | ✓ VERIFIED | 103-DEPLOY-RUNBOOK §(a-f) ordered; §(f) first-class Flag-OFF closure; PROD apply + pgTAP 20/20 (commit 830a01b, SUMMARY, STATE.md) |

**Score:** 20/20 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/lib/lockdown-guard.test.ts` | Block D/E + self-check + notif-service tolerance | ✓ VERIFIED | Block D/E, USER_OWNED_TABLES, authenticatedGrantOffenders, NOTIF_SERVICE_TS present; first commit 6cf3bbc |
| `app/lib/notif-gate.ts` | notifPublicEnabled chokepoint | ✓ VERIFIED | single strict `=== "true"`, server-only |
| `app/lib/notif-antiflip-guard.test.ts` | 3-vector anti-flip + self-check | ✓ VERIFIED | V1/V2/V3 + RED-mutation self-check green |
| `.env.example` | NOTIF_PUBLIC_ENABLED=false + RESEND_API_KEY= + NOTIF_TOKEN_SECRET= | ✓ VERIFIED | line 95 false, 104 RESEND empty, 116 TOKEN_SECRET empty |
| `supabase/migrations/0069_suscripcion_rls.sql` | suscripcion + RLS auth.uid()=user_id | ✓ VERIFIED | 3 policies + table grant to authenticated (allowlisted); FK auth.users cascade |
| `supabase/migrations/0070_notificacion_envio.sql` | service_role-only queue, zero authenticated grant | ✓ VERIFIED | 0 `to authenticated`; ultimo_evento_visto cursor |
| `supabase/migrations/0071_consentimiento.sql` | consent record 21.719 | ✓ VERIFIED | version_texto/metodo/created_at, owner-scoped |
| `supabase/migrations/0072_notificacion_envio_idempotencia.sql` | partial unique idempotency index (WR-04 fix) | ✓ VERIFIED | applied to PROD per SUMMARY; UTC-day partial unique index |
| `supabase/tests/0069-0071.test.sql` | two-user isolation pgTAP | ✓ VERIFIED | set local role authenticated + jwt claims two-user; PROD 20/20 |
| `app/app/cuenta/{page,actions}.tsx` | OTP + seguir/dejarDeSeguir Server Actions | ✓ VERIFIED | force-dynamic, getClaims server-derived, gated |
| `app/lib/notif-service.ts` | dedicated service_role token-lookup helper | ✓ VERIFIED | buscar*/marcar* incl. marcarBajaUsuario (CR-03) |
| `app/app/notificaciones/token.ts` | HMAC-derived opaque token + hash | ✓ VERIFIED | deriveToken/deriveUserBajaToken/verifyUserBajaToken (timingSafeEqual) |
| `app/app/notificaciones/{confirmar,baja}/page.tsx` | login-less landing, noindex | ✓ VERIFIED | user-level baja token first + legacy fallback |
| `app/components/seguir-button.tsx` | gated (return null when OFF) | ✓ VERIFIED | return null before DOM; mounted both fichas |
| `packages/notificaciones/src/{digest,resend,run-digest-prod-cli,run-confirmaciones-prod-cli}.ts` | EGRESO digest + Resend + CLIs | ✓ VERIFIED | confirmation CLI (WR-05) + digest CLI; user-level baja derive |
| `.github/workflows/digest-daily.yml` | gated cron, EGRESO header, both CLIs, secrets | ✓ VERIFIED | workflow_dispatch only, schedule commented, both steps + NOTIF_TOKEN_SECRET/RESEND_API_KEY |
| `docs/legal/103-LEGAL-DOSSIER-NOTIF.md` | DPA/licitud/ARCO-P/retención signoff approved | ✓ VERIFIED | signoff: approved, operator VERBATIM |
| `103-DEPLOY-RUNBOOK.md` | apply→pgTAP→deploy→flip→checkpoint + Flag-OFF closure | ✓ VERIFIED | §(a-f), §(f) first-class Flag-OFF closure |
| `app/app/spike-auth/` | DELETED | ✓ VERIFIED | directory absent (test ! -d passes) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| lockdown-guard.test.ts | supabase/migrations/*.sql | static scan >0044 for authenticated grants | ✓ WIRED | Block D scans migrations; 0 offenders on real 0069-0072 |
| notif-antiflip-guard.test.ts | notif-gate.ts | RAW_ENV_ALLOWLIST chokepoint scan | ✓ WIRED | only notif-gate.ts reads raw env; V3 green |
| cuenta/actions.ts | suscripcion | createUserClient (RLS applies) | ✓ WIRED | user session client; user_id server-derived |
| seguir-button.tsx | notif-gate.ts | notifPublicEnabled() gate before render | ✓ WIRED | import + return null at line 65 |
| baja/page.tsx | notif-service.ts | user-level token verify → marcarBajaUsuario | ✓ WIRED | verifyUserBajaToken first, legacy per-sub fallback |
| digest.ts | notificacion_envio | cursor read/advance (service_role) | ✓ WIRED | ultimo_evento_visto; 0072 idempotency |
| digest.ts | proyecto_autor | estado_vinculo='confirmado' resolution | ✓ WIRED | fail-closed confirmado filter |
| resend.ts | api.resend.com/emails | fetch POST Bearer + List-Unsubscribe | ✓ WIRED | dry-run when key absent; One-Click header user-level token |
| 0069 → PROD Postgres | schema_migrations | psql --single-transaction (applied) | ✓ WIRED | commit 830a01b, pgTAP 20/20 against applied PROD schema |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| digest.ts computeNovedades | novedades | tramitacion_evento / proyecto_autor real columns (0008/0051) | Yes — real DB queries, no static returns | ✓ FLOWING |
| baja/page.tsx | userId | verifyUserBajaToken(HMAC over user_id) → marcarBajaUsuario DELETE | Yes — self-authenticating token, real DELETE | ✓ FLOWING |
| cuenta/page.tsx | subscriptions | createUserClient RLS-gated select | Yes — user-session query (inert only because flag OFF) | ✓ FLOWING (gated) |

Note: user-facing surfaces are INERT behind the OFF flag, not hollow — the data path is real and tested; exposure is gated by NOTIF-05 deny-by-default, which is the intended state pending operator provisioning.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full app suite (guards + surfaces + tests) | `cd app && pnpm test -- --run` | 107 files / 1418 tests passed | ✓ PASS |
| @obs/notificaciones package (digest/resend/CLIs) | `pnpm --filter @obs/notificaciones test` | 2 files / 40 tests passed | ✓ PASS |
| notif-service marcarBajaUsuario (CR-03) | included above | DELETE scoped by user_id, returns count | ✓ PASS |
| Token round-trip cross-package | included above | hashToken(deriveRawToken)===storedHash frozen | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| pgTAP 0069/0070/0071 against PROD | (operator/agent-run per runbook) | 20/20 ok, 0 not ok (SUMMARY + commit 830a01b) | ✓ documented — re-run is an operator PROD act, evidenced in SUMMARY |

No conventional `scripts/*/tests/probe-*.sh` exist for this phase; verification is via vitest + pgTAP (run above / documented on PROD).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| NOTIF-01 | 02,03,05 | user-owned suscripcion/consentimiento, RLS to authenticated auth.uid()=user_id, deny-by-default | ✓ SATISFIED | 0069/0071 + pgTAP two-user; /cuenta + seguir; PROD applied |
| NOTIF-02 | 01,02 | lockdown-guard extended to authenticated as FIRST commit | ✓ SATISFIED | Block D/E; commit 6cf3bbc is first phase commit (git log) |
| NOTIF-03 | 04,05 | daily digest Resend 100/day, idempotent cursor, EGRESO cron, never instantaneous | ✓ SATISFIED | digest.ts + digest-daily.yml + EGRESO header; scheduled-not-instant copy |
| NOTIF-04 | 02,03,04 | double opt-in, token unsubscribe login-less, preference center, consent record, email PII never to LLM/CI/R2 | ✓ SATISFIED | HMAC token + confirmar/baja + consentimiento + redactEmail |
| NOTIF-05 | 01,03,05 | legal 21.719 checkpoint before exposing email capture; no answer ⇒ flag OFF with handoff, run closes | ✓ SATISFIED | dossier signoff approved; Flag-OFF closure executed; feature parked inert |

All 5 declared requirement IDs accounted for. No orphaned requirements (REQUIREMENTS.md maps exactly NOTIF-01..05 to Phase 103, all present in plan frontmatter).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No unreferenced TBD/FIXME/XXX in phase-modified files; `return null` in seguir-button is the intended gate, not a stub | ℹ️ Info | None |

The `return null` in seguir-button.tsx is the deliberate flag-OFF absence pattern (verified by RTL test), not a hollow stub. Empty-array/null returns in digest paths are cursor/no-news honest degrades, tested. No debt-marker BLOCKERs.

### Human Verification Required

The following 8 items require operator action / a live deploy and cannot be verified statically. None represents a code gap — they are the documented Plan 05 operator checkpoints and the NOTIF-05 provisioning deuda:

1. **Supabase publishable key + OTP `{{ .Token }}` template** — operator dashboard + wrangler secret.
2. **Resend verified domain + DPA + RESEND_API_KEY** — operator Resend account + legal DPA.
3. **NOTIF_TOKEN_SECRET** set (same value) as GH Actions secret AND Worker env — both CLIs + seguir() fail-loud without it.
4. **Deploy + flip NOTIF_PUBLIC_ENABLED=true** (OR keep Flag-OFF closure) — travels with Phase 104 per the 101-102 pattern.
5. **SC2 curl evidence** on the live deploy (Set-Cookie + session refresh).
6. **BrowserOS DOM check** — Seguir button present when flag ON on both fichas.
7. **End-to-end double opt-in DRY-RUN** via manual workflow_dispatch before LIVE flip (prove the loop + CR-03 multi-sub one-click baja).
8. **Real email UAT** — confirmation + digest + one-click unsubscribe.

### Gaps Summary

No gaps block the phase goal. Every observable truth is VERIFIED against substantive, wired, tested code; all 5 NOTIF requirements are satisfied; the lockdown-guard `authenticated` extension landed as the first phase commit (6cf3bbc) — the core "no `authenticated` hole reaches PROD" invariant of the goal. The 9 code-review findings + 3 re-review findings (incl. the CR-01/02 token round-trip and CR-03 multi-sub one-click baja) are all fixed in the committed code and covered by regression tests, verified here by running the full suites (1418 app + 40 package tests green).

The deploy did NOT happen this phase (acceptable deferral — travels with Phase 104, matching the 101-102 pattern), and the flip resolved via the NOTIF-05 Flag-OFF closure, which the requirement text explicitly sanctions ("sin respuesta → feature queda detrás de flag OFF con handoff documentado, la corrida cierra igual"). The migrations ARE applied to PROD (pgTAP 20/20, commit 830a01b). Status is `human_needed` solely because Step 8 surfaced operator-only verification items (provisioning, live-deploy evidence, real-email UAT) — per the decision tree, any non-empty human section forces human_needed even when all truths are VERIFIED.

---

_Verified: 2026-07-26T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
