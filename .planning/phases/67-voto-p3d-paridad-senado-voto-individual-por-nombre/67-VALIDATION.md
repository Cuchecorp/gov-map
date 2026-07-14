---
phase: 67
slug: voto-p3d-paridad-senado-voto-individual-por-nombre
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 67 — Validation Strategy

> The Senate path is already wired; the deliverable is the `--from-r2` envelope fix + fail-closed proof. LIVE backfill is operator-LOCAL.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Quick run** | `pnpm --filter @obs/votos test` + `pnpm --filter @obs/tramitacion test` |
| **Typecheck** | `tsc -b` |
| **LIVE backfill (operator-LOCAL)** | Senate `votaciones.php` via the two-stage runner (rate-limit 2-3s) |

---

## Sampling Rate

- After every task commit: touched-package test + typecheck.
- After wave: both suites green.
- Max feedback latency: ~120 s (offline).

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| Senate votes populate via `votaciones.php` through the two-stage wire (fixture-driven) | VOTO-01 | unit | `pnpm --filter @obs/tramitacion test` | ⬜ pending |
| `--from-r2` replay reconstructs Senate votes (envelope carries `votXmlSenado`; today it's dropped) | VOTO-01 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| Ambiguous/heuristic Senate name → `probable`/`no_confirmado`, `fuente_voter_id=seq:<n>`, NEVER a fabricated `EnlaceConfirmado` | VOTO-01 | unit | `pnpm --filter @obs/tramitacion test` | ⬜ pending |
| Deterministic UNIQUE Senate name in maestra+period → `confirmado` PRESERVED (VOTO-03 parity — not degraded) | VOTO-01 | unit (existing) | `pnpm --filter @obs/tramitacion test` | ⬜ pending |
| No Senate provider → `runIngest` degrades fail-closed (`PROVIDER_DEGRADA_FAIL_CLOSED`); invents no votes | VOTO-01 | unit | `pnpm --filter @obs/tramitacion test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] Non-empty Senate fixture in `run-camara-votos.test.ts` (today `fakeSenado` returns empty `<Votaciones>`).
- [ ] `--from-r2` test with `votXmlSenado` in the R2 envelope (covers the replay fix).

*connector-senado, reconciliar-senado, runIngest Senate step, seq: identifier, fail-closed sentinel all already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| At-scale LIVE Senate backfill populates real votes | VOTO-01 SC#1 | Operator-LOCAL; hits government source; PROD write | Operator runs the Senate two-stage backfill LOCAL, rate-limit 2-3s, then `--from-r2` replay + coverage. |
| LIVE `<SELECCION>` tokens confirmed (A4 residual, like Phase 64 Cámara) | VOTO-01 | `mapSeleccion` matches by prefix + silently omits unknown tokens; never confirmed live | Operator captures a live `votaciones.php` response; fix `mapSeleccion` to fail LOUD on unknown token rather than silently omit. |

---

## Validation Sign-Off

- [ ] `--from-r2` Senate replay proven (envelope fix)
- [ ] Ambiguous→probable + deterministic-unique→confirmado both asserted (no regression)
- [ ] Fail-closed proven
- [ ] Operator-LOCAL backfill + SELECCION-token SPIKE documented
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
