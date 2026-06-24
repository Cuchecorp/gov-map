---
phase: 41
slug: crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `41-RESEARCH.md` §Validation Architecture (framework verified in-repo; adversarially hardened by 2 Opus validators).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend framework** | vitest (jsdom, globals) + @testing-library/react |
| **Frontend config** | `app/vitest.config.ts` (`server-only` aliased empty; includes `lib/**`, `components/**`, `app/**` `*.test.{ts,tsx}`) |
| **DB framework** | pgTAP, run by `psql -tA -f <test>.sql` against APPLIED PROD (Phase 23 pattern), `begin;…;rollback;` |
| **Frontend quick run** | `cd app && npx vitest run cruces` |
| **Frontend full suite** | `cd app && npx vitest run` |
| **Typecheck** | `cd app && npx tsc -b` |
| **Estimated runtime** | frontend quick <5s · full ~20–40s · pgTAP per-file <2s |

CERO new packages. **DDL apply + pgTAP run are operator checkpoints** (build/typecheck do NOT prove Postgres executed the migration — false-positive risk; the only valid proof is pgTAP vs applied PROD).

---

## Sampling Rate

- **After every frontend task commit:** `cd app && npx vitest run cruces`
- **After every plan wave:** `cd app && npx vitest run` (full green) + `npx tsc -b` clean
- **After operator applies 0041:** `psql -tA -f supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` (4/4) + regression of `0040_cruces_rpc.test.sql` (4/4, anon-deny intact)
- **Max feedback latency:** <5s (frontend quick)

---

## Per-Task Verification Map

| Task | Deliverable | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File | Status |
|------|------|------|-------------|-----------------|-----------|-------------------|------|--------|
| 41-01 migration | CRUCEN-01 | 1 | CRUCEN-01 | `0041` adds `fecha_captura` LAST via drop+recreate; **re-revoke from public AND anon,authenticated** (deny-by-default intact); no grant; PII-safe | pgTAP | `psql -tA -f supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` | ❌ W0 → `supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` | ⬜ pending |
| 41-01 component | CRUCEN-01 | 1 | CRUCEN-01 | badge `capturedAt = s.fecha_captura` ⇒ no false stale-amber; meeting date as plain factual text (no causal verb, §9.1 intact); WR-02 comment removed | unit (RTL) | `cd app && npx vitest run cruces-de-parlamentario` | ⚠️ extend `app/components/cruces-de-parlamentario.test.tsx` | ⬜ pending |
| 41-01 types | CRUCEN-01 | 1 | CRUCEN-01 | `fecha_captura: string` on `CruceSenalRpcRow` compiles through component | typecheck | `cd app && npx tsc -b` | `app/lib/types.ts` | ⬜ pending |
| 41-02 grant gated | CRUCEN-02 | 1 | CRUCEN-02 | `0042` written, **NOT applied**; fail-loud precondition if applied before 0041; guard = existing `0040` assert #3 (anon NO execute) UNCHANGED; ignition proof in `post-apply/` | pgTAP (existing guard) + manual | `psql -tA -f supabase/tests/0040_cruces_rpc.test.sql` (anon-deny still green) | ❌ W0 → `supabase/migrations/0042_cruces_grant_anon.sql` + `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql` | ⬜ pending |
| 41-03 dossier | CRUCEN-03 | 1 | CRUCEN-03 | `41-LEGAL-DOSSIER-CRUCES.md` ×2 identical, `signoff: pending`, CRUCES-specific (intra-block sector-aggregation, no NET-isms), defers to asesor, never signed | grep + review | `grep "signoff:" docs/legal/41-LEGAL-DOSSIER-CRUCES.md` → `pending` | ❌ W0 → `docs/legal/41-LEGAL-DOSSIER-CRUCES.md` + phase-dir twin | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Load-bearing proofs:**
- The **41-01 pgTAP re-revoke assert** (anon NO execute after drop+recreate) is the only guard catching a silently-omitted second `revoke` (Supabase DEFAULT-PRIVILEGES re-grant). Gate #5.
- The **41-02 existing-0040-assert-#3** doubling as the no-premature-apply guard. It must stay a HARD assertion — Sonnet's conditional-on-schema_migrations variant was REJECTED (security regression).
- The **41-01 RTL stale-amber assert** proves WR-02 actually fixed (fresh capture ⇒ no `text-amber-700`).

---

## Wave 0 Requirements

- [ ] `supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` — plan(4): fecha_captura emitted (`bag_has` on `proargnames`) + exact positional order (`array_to_string`) + anon NO execute + no-PII. **Idiom = `0029_votos_instructivos.test.sql:32-49`, NOT `pg_get_function_result` regex.**
- [ ] `supabase/migrations/0042_cruces_grant_anon.sql` — fail-loud precondition `do $$` + single `grant … to anon`; LOUD no-apply header. Written, **not applied**.
- [ ] `supabase/tests/post-apply/0042_cruces_grant_anon.test.sql` — anon HAS execute + still security definer. Out of suite glob; run ONLY post-apply.
- [ ] `docs/legal/41-LEGAL-DOSSIER-CRUCES.md` + `.planning/phases/41-crucen-…/41-LEGAL-DOSSIER.md` — identical, `signoff: pending`, CRUCES-specific.
- [ ] Extend `app/components/cruces-de-parlamentario.test.tsx` — `makeSenal` gets `fecha_captura`; new fresh-badge/no-amber + meeting-date-text asserts.

Framework install: none.

---

## Manual-Only / Operator Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Apply `0041` to PROD + run its pgTAP | DDL apply = operator checkpoint (never `db push`); pgTAP needs applied schema | `psql "$DATABASE_URL" --single-transaction -f supabase/migrations/0041_…sql` + `schema_migrations` row (UTF8/heredoc on Windows) → `psql -tA -f supabase/tests/0041_…test.sql` (4/4). Agent does NOT apply unless operator authorizes in-run. |
| Apply `0042` + run post-apply pgTAP + flip flag | **GATE: post-sign-off, human/operator only** | DEFERRED to ignition day: sign dossier → apply 0042 → `post-apply/0042` test (anon HAS execute) → flip `CRUCES_PUBLIC_ENABLED`. NONE done in this phase. |
| Sign the dossier | **GATE: human-exclusive (Phase 39)** | DEFERRED. Dossier born `pending`; agent NEVER sets `signoff: approved`. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies / explicit operator-checkpoint
- [ ] Sampling continuity: no 3 consecutive tasks without verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, `psql -f`)
- [ ] Deny-by-default guard (0040 assert #3) left UNCHANGED
- [ ] `nyquist_compliant: true` set after Wave 0 files exist

**Approval:** pending
