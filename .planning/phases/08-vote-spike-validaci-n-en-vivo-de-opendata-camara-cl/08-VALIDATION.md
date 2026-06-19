---
phase: 8
slug: vote-spike-validaci-n-en-vivo-de-opendata-camara-cl
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This is a confirm-or-replan SPIKE: the "validation" is the spike itself (a LIVE-gated test asserting the source shape), plus offline assertions over the captured fixture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace standard) |
| **Config file** | existing workspace vitest config |
| **Quick run command** | `pnpm --filter @obs/votos test` (new spike package) or the spike test file path |
| **Full suite command** | `pnpm -w test` |
| **Estimated runtime** | ~5–15 s offline (LIVE run gated, separate) |

---

## Sampling Rate

- **After every task commit:** Run the spike test (offline assertions over the captured/real fixture)
- **LIVE confirmation:** one gated run (e.g. `VOTE_SPIKE_LIVE=1`) hitting `opendata.camara.cl` with the LOCKED 2–3s delay — not part of the default suite (does not burn the WAF on CI)
- **Before verification:** offline suite green + LIVE run executed once with its FINDINGS + binary decision recorded
- **Max feedback latency:** ~15 s (offline)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | VOTE-01 | — / — | Spike parses live `getVotacion_Detalle` XML; `Diputado/DIPID` + `Opcion` non-null; totals reconcile (nominal si/no); DIPID maps to `id_diputado_camara` in `parlamentario.seed.json` | integration (LIVE-gated) + unit (offline fixture) | spike test file (offline) + `VOTE_SPIKE_LIVE=1` (live) | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | VOTE-01 | — / — | FINDINGS + binary decision (confirmar/replanificar) recorded in 08-SUMMARY.md and STATE.md decisions | manual+doc | n/a (doc assertion) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Spike test file (LIVE-gated) — asserts the source shape and the DIPID → `id_diputado_camara` mapping
- [ ] Reuse existing `@obs/ingest` (assertAllowedUrl → robots → rateLimiter.wait → fetcher.get) and `fast-xml-parser@5` — no new packages
- [ ] Reuse the captured real fixture from v1.0 Phase 5 (`camara-votacion-detalle-real.xml`, vote 88813) for the offline half

*Existing infrastructure (vitest, @obs/ingest, fast-xml-parser, parlamentario.seed.json) covers all phase requirements — Wave 0 is thin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LIVE run actually reaches `opendata.camara.cl` behind the WAF and returns non-null per-deputy votes today | VOTE-01 | Hitting a government endpoint live is non-deterministic and rate-limited; cannot run on default CI | Run the spike with `VOTE_SPIKE_LIVE=1`, observe the run returns ≥1 votación detalle with populated `Diputado`+`Opcion`, totals reconcile, and record the binary decision |

*The binary confirm/replan decision is a documented outcome, recorded in 08-SUMMARY.md + STATE.md.*

---

## Validation Sign-Off

- [ ] Spike test exists (offline + LIVE-gated)
- [ ] LIVE run executed once; FINDINGS captured
- [ ] Binary decision (confirmar/replanificar) recorded in STATE.md decisions
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter at execution

**Approval:** pending
