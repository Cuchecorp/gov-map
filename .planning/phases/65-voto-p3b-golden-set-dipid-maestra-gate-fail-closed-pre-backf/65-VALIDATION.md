---
phase: 65
slug: voto-p3b-golden-set-dipid-maestra-gate-fail-closed-pre-backf
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 65 — Validation Strategy

> Per-phase validation contract. This is a defamation-critical data-integrity gate — the tests ARE the deliverable.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Quick run command** | `pnpm --filter @obs/votos test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~60–120 s (100% offline, no DB/network) |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @obs/votos test`
- **After wave:** full suite green.
- **Max feedback latency:** ~120 s.

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| Golden set DIPID→id_maestra derived+validated for the 155 sitting diputados; DIPIDs unique; scoped by `periodo` (recycle trap covered) | VOTO-03 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| Unknown DIPID → `no_confirmado`, `parlamentario_id=null` (fail-closed) via the REAL `reconciliarVotosCamara` | VOTO-03 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| Anti-name-match grep-gate: no `normalizarNombre`/LLM/`adjudic`/`correrPipeline` in `packages/votos/src` vote path (diff-checkable) | VOTO-03 | unit (grep gate) | `pnpm --filter @obs/votos test` | ⬜ pending |
| Vote FK stays `EnlaceConfirmado \| null` branded (raw string does not compile) | VOTO-03 | type (tsc) | `pnpm -r typecheck` / build | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] `packages/votos/src/golden-dipid.ts` — derive + validate golden from `supabase/seeds/parlamentario.seed.json` (avoid a stale frozen artifact).
- [ ] `packages/votos/src/golden-dipid.test.ts` — invariants + fail-closed against the real reconciler + anti-name-match grep-gate.

*Reconciler, periodo scoping, and `EnlaceConfirmado` already exist + tested — no rebuild.*

---

## Manual-Only Verifications

*None — all four success criteria have automated verification (unit + type/grep gate).*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 deps
- [ ] Anti-name-match gate is grep-checkable
- [ ] Fail-closed asserted against the REAL reconciler (not a stub)
- [ ] `nyquist_compliant: true` set when green

**Approval:** pending
