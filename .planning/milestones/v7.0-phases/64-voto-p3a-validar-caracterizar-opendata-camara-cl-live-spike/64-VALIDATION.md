---
phase: 64
slug: voto-p3a-validar-caracterizar-opendata-camara-cl-live-spike
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 64 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/tramitacion/` + `packages/votos/` vitest configs (per-package) |
| **Quick run command** | `pnpm --filter @obs/tramitacion test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~60–120 seconds (default glob; `.live.test.ts` excluded) |
| **LIVE probe (gated)** | `VOTOS_LIVE=1 pnpm --filter @obs/votos test run-camara-votos.live` |

---

## Sampling Rate

- **After every task commit:** Run quick command for the touched package.
- **After every plan wave:** Run full suite.
- **Before verify:** Full suite green; the gated LIVE probe run at least once with fixture persisted to R2.
- **Max feedback latency:** ~120 seconds (default suite; LIVE probe out-of-band).

---

## Per-Task Verification Map

> Filled by planner. Core assertions this SPIKE must sample:

| Assertion | Requirement | Test Type | Automated Command | Status |
|-----------|-------------|-----------|-------------------|--------|
| `OpcionVoto Valor → Selección` fixed by test (1→sí, 0→no, 2→abstención, 4→ausente) verified against LIVE fixture | VOTO-05 | unit (fixture) | `pnpm --filter @obs/tramitacion test` | ⬜ pending |
| Voto-a-voto sum == `TotalAfirmativos/TotalNegativos/TotalAbstenciones`; mismatch fails LOUD (zod gate) | VOTO-05 | unit (fixture) | `pnpm --filter @obs/tramitacion test` | ⬜ pending |
| Raw LIVE `getVotacion_Detalle` persisted to R2 as authoritative fixture (content-addressed) | VOTO-05 | gated LIVE | `VOTOS_LIVE=1 pnpm --filter @obs/votos test` | ⬜ pending |
| Pareo / Dispensado codes resolved code-first / `#text`-fallback / fail-closed — never fabricated | VOTO-05 | unit + LIVE hunt | `pnpm --filter @obs/tramitacion test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Correct file paths in plans: connector/parser live in `packages/tramitacion/` (`connector-camara.ts::fetchVotacionDetalle`, `parse-camara-votacion.ts::parseCamaraVotoDetalle` + `opcionDeVoto`), NOT `packages/votos/`.
- [ ] Authoritative LIVE fixture(s) checked into the repo/R2 for deterministic replay of the mapping + totals cross-check test.

*Existing infrastructure (R2Store.putImmutable, sha256Hex, IDENTIFIED_UA Fetcher, HostRateLimiter, `.live.test.ts` gated harness) covers the rest.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pareo code (`3` assumed by roster fixture) confirmed against a real pareo votación | VOTO-05 | Pareo is rare; may not appear in sampled votaciones | Scope the LIVE probe to hunt a votación with a pareo; record raw response to R2; if none found in window, document as unresolved-but-fail-closed. |

*If no pareo observed live, the code stays fail-closed (never fabricated) and the gap is recorded for a follow-up probe.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
