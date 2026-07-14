---
phase: 66
slug: voto-p3c-wire-dos-etapas-c-mara-backfill-a-escala-funde-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 66 — Validation Strategy

> The code wire is fully verifiable offline; the at-scale LIVE backfill + PROD write are operator-LOCAL (documented, not CI-run).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Quick run command** | `pnpm --filter @obs/votos test` |
| **Full suite command** | `pnpm test` |
| **Typecheck** | `pnpm -r typecheck` / `tsc -b` |
| **LIVE backfill (operator-LOCAL)** | `VOTOS_LIVE=1 ... run-votos-masivo --boletines-file <f> --limite N` (rate-limit 2-3s) |
| **Replay Stage 2** | `... run-camara-votos --from-r2` (no source touch) |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @obs/votos test` + typecheck.
- **After wave:** full suite green.
- **Max feedback latency:** ~120 s (offline).

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| Vote runner forwards `r2Store`/`snapshotWriter`/`fromR2` to `runIngest` → Stage-1 content-addressed R2 write happens FIRST (asserted with a fake R2Store capturing `putImmutable`) | VOTO-01, DEBT-01 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| `--from-r2` replays Stage 2 from R2 without any source fetch (Fetcher not called) — mirrors `ingest-cli.ts` | DEBT-01 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| Vote upsert idempotent on `(votacion_id, fuente_voter_id)` — re-run is a no-op | VOTO-01 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| Coverage report: `group by estado_vinculo` + invariant "0 golden DIPIDs left no_confirmado" (% can't drop — no name-match) | VOTO-01 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |
| `--boletines`/`--limite` bound the run; PostgREST reads paginate via `.order().range()` (1k cap) | VOTO-01 | unit | `pnpm --filter @obs/votos test` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] Fake/spy `R2Store` capturing `putImmutable` calls for the Stage-1-first + `--from-r2`-replay tests (no live R2 needed).

*runIngest, R2Store, BaseConnector, Fetcher, HostRateLimiter, the voto model (0019), reconciler + golden set all already exist + tested — no rebuild.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| At-scale LIVE backfill populates real votes with confirmado% not dropping | VOTO-01 SC#3/4 | Backfill masivo = LOCAL operador (CLAUDE.md); hits government WAF; needs PROD write | Operator runs `run-votos-masivo --boletines-file <f> --limite N` LOCAL with rate-limit 2-3s, then the coverage report; resumable via natural-key upsert. |

---

## Validation Sign-Off

- [ ] Stage-1-first proven with a fake R2Store (not live R2)
- [ ] `--from-r2` proven to skip the source fetch
- [ ] Idempotency + pagination + coverage-invariant unit-covered
- [ ] Operator-LOCAL backfill documented as the manual step
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
