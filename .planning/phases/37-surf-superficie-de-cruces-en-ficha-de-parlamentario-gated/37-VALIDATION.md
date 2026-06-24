---
phase: 37
slug: surf-superficie-de-cruces-en-ficha-de-parlamentario-gated
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `37-RESEARCH.md` §Validation Architecture (framework verified in-repo).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom, globals) + @testing-library/react |
| **Config file** | `app/vitest.config.ts` (`server-only` aliased to empty build; includes `lib/**`, `components/**`, `app/**` `*.test.{ts,tsx}`) |
| **Quick run command** | `cd app && npx vitest run cruces` |
| **Full suite command** | `cd app && npx vitest run` |
| **Estimated runtime** | ~quick: <5s · full: ~20–40s |

Setup `app/vitest.setup.ts` (jest-dom matchers) already wired. CERO new packages.

---

## Sampling Rate

- **After every task commit:** Run `cd app && npx vitest run cruces`
- **After every plan wave:** Run `cd app && npx vitest run` (full suite green)
- **Before `/gsd:verify-work`:** Full suite must be green + `cd app && npx tsc -b` clean
- **Max feedback latency:** <5 seconds (quick) / ~40s (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01 gate | 01 | 1 | SURF-01 | T-37 EoP / Info Disclosure | `crucesPublicEnabled` fail-closed: only `"true"` → true; absent/`""`/`"false"`/`"1"`/`"TRUE"` → false; server-only (no `NEXT_PUBLIC_`) | unit | `cd app && npx vitest run cruces-gate` | ❌ W0 → `app/lib/cruces-gate.test.ts` | ⬜ pending |
| 37-02 view | 02 | 1 | SURF-01 | T-37 Tampering-of-meaning | `CrucesView` pure: empty-honest copy (never "limpio/transparente"); per-evidence `ProvenanceBadge`→`enlace_fuente`; counterparty CRUDE + `IdentityMarker`, never link/RUT; carril aislado (no vote/boletín/causal/affinity/score copy — negative-match `PROHIBIDO` + `PATRON_RUT`); neutral count only | unit (RTL) | `cd app && npx vitest run cruces-de-parlamentario` | ❌ W0 → `app/components/cruces-de-parlamentario.test.tsx` | ⬜ pending |
| 37-03 page | 03 | 2 | SURF-01 | T-37 Info Disclosure (premature exposure) | **Gate OFF (default) ⇒ `<section id="cruces">` ABSENT from rendered HTML + `createServerSupabase` not called**; Gate ON ⇒ section renders without throwing on a normal fixture | integration (SSR) | `cd app && npx vitest run parlamentario` | ❌ W0 → `app/app/parlamentario/[id]/page.test.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The section-absent test (37-03) is the **load-bearing security proof** of Candado B: it must assert the node is ABSENT from the HTML string (not CSS-hidden), mirroring the MONEY gate-wrap pattern. Scaffold adapted from `app/app/red/page.test.tsx` (`vi.mock` + `renderToStaticMarkup`), but asserting ABSENCE of `id="cruces"` rather than `notFound()`.

---

## Wave 0 Requirements

- [ ] `app/lib/cruces-gate.test.ts` — gate truth table (verbatim mirror of `app/lib/money-gate.test.ts`)
- [ ] `app/components/cruces-de-parlamentario.test.tsx` — pure-view: empty-honest + provenance + identity + anti-insinuation inline negative-match (`PROHIBIDO` mirror of lobby + `PATRON_RUT`) + neutral-count (mirror `lobby-de-parlamentario.test.tsx`)
- [ ] `app/app/parlamentario/[id]/page.test.tsx` — **NEW pattern, no existing analog**: section-absent (gate OFF) + section-present (gate ON) via mocked `@/lib/cruces-gate` + `@/lib/supabase` + `renderToStaticMarkup`. Closest scaffold = `app/app/red/page.test.tsx`.

Framework install: none — vitest/RTL already present.

*Note:* There is NO standalone banned-vocabulary linter to extend; the §9.1 obligation is satisfied by the inline `PROHIBIDO` constant in the new component test (established repo convention, per RESEARCH).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live render with gate ON against PROD | SURF-01 | Cannot run automated: RPC has NO anon grant until Phase 39; gate flip is human-exclusive | DEFERRED to Phase 39. Phase 37 proves ON-path only against a mocked RPC fixture (no live DB needed). |

All Phase 37 automated behaviors are covered above. The only manual item is intentionally deferred (it requires the Phase 39 sign-off that this phase must NOT perform).

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (3/3 tasks have automated verify)
- [ ] Wave 0 covers all MISSING references (3 new test files)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 5s (quick)
- [ ] `nyquist_compliant: true` set in frontmatter (set after Wave 0 files exist)

**Approval:** pending
