---
phase: 13-compuerta-legal-bloque-money-ley-21-719
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - app/lib/money-gate.ts
  - app/lib/money-gate.test.ts
  - .env.example
  - supabase/tests/0023_money_gate.test.sql
  - docs/legal/13-LEGAL-DOSSIER.md
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
fix_status: critical_warning_resolved
fixed:
  - CR-01
  - WR-01
  - WR-02
fixed_at: 2026-06-19
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 13 ships a security/exposure gate: a fail-closed server-side feature flag
(`MONEY_PUBLIC_ENABLED`), a pgTAP test re-affirming the RLS deny-by-default PII floor, a
`.env.example` entry, and a legal preparation dossier (+ byte-identical copy in `docs/legal/`).

The single most important property — **the flag must fail closed and must not leak to the
browser** — is correctly implemented. `app/lib/money-gate.ts` enables only on the literal
`"true"`, returns `false` for everything else (including `undefined`, `""`, `"false"`, `"1"`,
`"TRUE"`), imports `server-only`, and the var carries no `NEXT_PUBLIC_` prefix. The Vitest suite
covers every meaningful branch. The `.env.example` documentation is accurate and self-consistent.
The dossier scrupulously avoids asserting legal compliance, documents license per-dataset
(ChileCompra = mention-of-source, not CC BY; CC BY = InfoProbidad only), and carries
`signoff: pending`. The two dossier copies are byte-identical.

However, the **pgTAP test (the only artifact that proves "candado A", the data lock) is built on
a false premise**: it asserts that `anon` has zero SELECT grant on its chosen exemplar table
`pii_contraparte_declaracion`, but the migration that created that table (`0018_piso_pii.sql`)
never issued the `revoke all ... from anon, authenticated` that the assertion depends on. This is
a Critical defect — the gate verification is unsound for the very contract it claims to codify.

## Critical Issues

### CR-01: pgTAP exemplar table never received the `revoke` its assertion verifies — RESOLVED

**Status:** RESOLVED (commit `fc4cad1`). Retargeted all three assertions (A.1 RLS-enabled,
A.2 is_empty pg_policy, A.3 anon SELECT-grant=0) from `pii_contraparte_declaracion` to
`lobby_contraparte`, which genuinely carries `revoke all ... from anon, authenticated`
(`0021_lobby.sql:98`). Test-only change — no new MONEY DDL, no alteration of 0018's table
contract. Header rewritten to describe a re-affirmation of the inherited deny-by-default
floor on a table that carries the revoke. Verified locally: `plan(3)` + 3 assertions, all
pointing at `lobby_contraparte`, zero `pii_contraparte_declaracion` references remaining
(pgTAP itself runs against the applied remote DB, operator-gated — not run here).

**File:** `supabase/tests/0023_money_gate.test.sql:36-43`

**Issue:** Assertion A.3 claims to verify the "revoke de default privileges" contract:

```sql
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'pii_contraparte_declaracion'
       and grantee = 'anon'
       and privilege_type = 'SELECT'),
  0,
  'anon SIN grant SELECT sobre pii_contraparte_declaracion (...+ revoke Phase 11)'
);
```

But the table it targets, `pii_contraparte_declaracion`, was created in `0018_piso_pii.sql` with
RLS enabled and **no `revoke`** (verified: zero `revoke` statements in `0018_piso_pii.sql:46-74`;
the migration comment at line 67 only says "intencionalmente NINGÚN `grant select`"). The sibling
migrations `0021_lobby.sql:92-98` and `0022_probidad.sql` explicitly document — and the project
proved in Phase 11 — that this Supabase project grants SELECT to `anon` by **DEFAULT PRIVILEGES**
on every new public table, so RLS-without-policy denies the *rows* but the *privilege* still
exists unless an explicit `revoke` removes it. `lobby_contraparte` and `declaracion_familiar` each
carry that `revoke`; `pii_contraparte_declaracion` does not.

Consequence: when run against the applied schema, assertion A.3 evaluates `anon`'s SELECT grant on
a table that was never revoked → the count is `1`, not `0` → **the test FAILS**, OR (if the
default-privilege grant happens not to apply for an unrelated reason) the test passes only by
accident on a table that does not actually satisfy the deny-by-default-*privilege* contract it is
held up as the exemplar for. Either way the phase's data-lock verification is unsound: it cannot
honestly certify the "money_* must be born revoked" contract while standing on a table that isn't.

The header comment (lines 32-35) actively misrepresents this, asserting the exemplar demonstrates
"el revoke lo cierra" when no revoke exists for this table.

**Fix:** Point the test at a table that genuinely satisfies the full contract, OR add the missing
revoke to the floor. Preferred (matches the documented project convention):

```sql
-- In a new migration (e.g. 0023_money_gate.sql), close the default-privileges hole on the
-- exemplar PII table the same way 0021/0022 do for their deny-by-default tables:
revoke all on pii_contraparte_declaracion from anon, authenticated;
```

Alternatively, retarget assertions A.1–A.3 at `lobby_contraparte` or `declaracion_familiar`, which
already carry the `revoke` and therefore actually pass A.3 — and update the header comment to stop
claiming a revoke exists where it does not. Until one of these is done, do NOT treat a green CI as
evidence the gate floor holds; run `supabase test db` against the applied remote and confirm A.3
passes for real (per the file's own warning that build/typecheck give false positives).

## Warnings

### WR-01: `plan(3)` undercounts the documented intent — no test that any table is actually empty/locked beyond the exemplar — RESOLVED

**Status:** RESOLVED (commit `fc4cad1`, same edit as CR-01). The header no longer claims the
test "CODIFICA EL CONTRATO" for Phases 14-16. It now states plainly that the test RE-AFFIRMS
the inherited deny-by-default floor on `lobby_contraparte` (a table that carries the revoke),
and that the `money_*` contract is enforced by the 14-16 migration tests, not here.

**File:** `supabase/tests/0023_money_gate.test.sql:13`, `:1-7`

**Issue:** The header (lines 4-7) states the test "CODIFICA EL CONTRATO que toda tabla `money_*` de
Phases 14-16 debe satisfacer". But the test only inspects a single pre-existing PII table and
asserts nothing about any `money_*` table (correct — none exist yet) and nothing that would catch a
future `money_*` table being added without the floor. As written it is purely a re-affirmation of
one inherited table, so the contract it claims to enforce for 14-16 is documented in prose only, not
codified. This is acceptable for a Phase-13 floor re-affirmation, but the header oversells it as a
contract-enforcement mechanism it is not. Combined with CR-01 (the one table it does check is the
wrong one), the net verification value is thin.

**Fix:** Either narrow the header comment to state plainly "re-affirms the inherited floor on the
PII exemplar; the `money_*` contract is enforced by the 14-16 migration tests, not here", or add a
forward-looking guard assertion (e.g. fail if any table matching `money\_%` exists with
`relrowsecurity = false` or with an `anon` SELECT grant) so a future regression is actually caught.

### WR-02: `app/lib/money-gate.ts` is unreferenced — gate is verified but never wired to a consumer — RESOLVED

**Status:** RESOLVED (commit `a418988`). Expected/by-design for Phase 13 (the gate is built
ahead of its consumers) — no consumer invented. Documented via a one-line note in the
`money-gate.ts` doc comment ("CHOKEPOINT (WR-02)") recording that the single chokepoint is
effectively enforced when Phase 14 routes all public MONEY paths through
`moneyPublicEnabled(process.env)` (never reading `MONEY_PUBLIC_ENABLED` raw), with the
consumer test added at that time.

**File:** `app/lib/money-gate.ts:24`

**Issue:** `moneyPublicEnabled` is exported and unit-tested but has no caller anywhere in the
codebase (the consuming ficha sections / RPC are Phases 14-16). That is expected by the phase plan,
but it means nothing in this phase exercises the *gating behavior* — only the pure boolean. A
future caller could read `process.env.MONEY_PUBLIC_ENABLED` directly (bypassing the single chokepoint
the dossier promises in §4) and no test would catch it. The risk is drift: the security property
("one chokepoint, default OFF") is asserted in the dossier but not enforced by any lint/test.

**Fix:** Acceptable to defer to Phase 14, but record an explicit follow-up that the MONEY ficha
section and any RPC MUST consume `moneyPublicEnabled(process.env)` and never read the raw env var
— and add the consumer test then. Optionally add a lint rule / grep guard forbidding
`MONEY_PUBLIC_ENABLED` outside `app/lib/money-gate.ts`.

## Info

### IN-01: Comment in `0023_money_gate.test.sql` asserts a revoke that does not exist

**File:** `supabase/tests/0023_money_gate.test.sql:32-35`

**Issue:** "Refuerzo de 0022_probidad.test.sql:59-62: el privilegio TAMPOCO existe ... el revoke lo
cierra" describes a revoke on `pii_contraparte_declaracion` that was never written (see CR-01). The
comment is factually wrong for the chosen table and will mislead the next reader.

**Fix:** Correct the comment when fixing CR-01 (either after adding the revoke, or after retargeting
to `lobby_contraparte`/`declaracion_familiar`).

### IN-02: Env-var naming inconsistency in the repo's Supabase config (pre-existing, surfaced by analog)

**File:** `app/lib/supabase.ts:21-22` vs `.env.example:17-19`

**Issue:** Not introduced by Phase 13, but worth flagging since `money-gate.ts` was modeled on
`supabase.ts`: `supabase.ts` reads `SUPABASE_URL` / `SUPABASE_ANON_KEY`, while `.env.example`
documents `SUPABASE_API_URL` / `SUPABASE_SECRET_KEY`. The names do not line up, so a developer
copying `.env.example` to `.env` would not satisfy `createServerSupabase`'s lookups. `money-gate.ts`
itself is consistent (`MONEY_PUBLIC_ENABLED` matches `.env.example` exactly), so this is
informational context only.

**Fix:** Out of scope for Phase 13; reconcile the Supabase env-var names between `app/lib/supabase.ts`
and `.env.example` in a dedicated cleanup.

### IN-03: Dossier section 6 is an empty "(reservado)" placeholder

**File:** `docs/legal/13-LEGAL-DOSSIER.md:165-168`

**Issue:** Section 6 exists only to preserve numbering, redirecting to section 7. Harmless, but a
reviewer of the dossier (the external lawyer) may pause on an empty section. The prose explains the
choice, so this is cosmetic.

**Fix:** Optional — either fold the base-de-licitud content up into section 6 or renumber so there
is no reserved gap.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
