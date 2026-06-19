---
phase: 10
slug: vote-voto-individual-por-parlamentario-en-la-ficha
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 10 — Validation Strategy

> VOTE individual on the parlamentario ficha. Connector promotion + first /parlamentario/[id] page.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS + RTL for components) + pgTAP (migration 0019) |
| **Quick run command** | `pnpm --filter @obs/votos test` / `pnpm --filter app test` |
| **Full suite command** | `pnpm -w test` |
| **Estimated runtime** | ~30–90 s offline (LIVE ingest + DB-applied pgTAP operator-gated) |

## Sampling Rate

- After every task commit: touched package's vitest
- After the ficha components: RTL render tests
- LIVE connector run + pgTAP against applied 0019: operator-gated (bounded current-legislature run; never fabricate)
- Max feedback latency: ~90 s offline

## Per-Task Verification Map

| Task ID | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|-------------|-----------------|-----------|-------------------|--------|
| votos connector promote | 1 | VOTE-02 | Enriches voto/votacion idempotently by natural key; crosses DIPID→id_diputado_camara via `EnlaceConfirmado` (no LLM); provenance per row | unit (offline fixture) + LIVE-gated | `pnpm --filter @obs/votos test` | ⬜ |
| migration 0019 (ausente + index) | 1 | VOTE-03 | `ausente` in voto.seleccion CHECK; partial index on voto(parlamentario_id); RLS public-read preserved | pgTAP (operator-applied) | pgTAP | ⬜ |
| ficha /parlamentario/[id] VOTE section | 2 | VOTE-03 | 3 honest states from estado_vinculo (confirmado-link / present-unverified IdentityMarker / not-ingested empty); link ONLY if confirmado | RTL render | `pnpm --filter app test` | ⬜ |
| voto×tema facet | 2 | VOTE-04 | Facet by materia (reuse embeddings); NO score, NO affinity language | unit + RTL | app test | ⬜ |
| rebeldías RPC + display | 2 | VOTE-05 | security-definer RPC reads partido internally, emits only public count+list; anon never reads partido; raw count, no judgment | unit + pgTAP | app/votos test | ⬜ |

## Wave 0 Requirements

- [ ] Offline fixture test for the connector (reuse Phase 8 captured XML)
- [ ] RTL tests for the 3 honest states (empty never reads as "clean")
- [ ] pgTAP for 0019 (ausente CHECK, index, anon cannot read partido)
- [ ] Content-gate test/assertion: no affinity/score/causal language in the VOTE section copy (§9.1 of UI-SPEC)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LIVE connector run enriches votes for the current legislature | VOTE-02 | gov WAF, rate-limited, non-deterministic | Bounded run; verify rows have provenance + DIPID cross; never fabricate |
| Migration 0019 applied + pgTAP green | VOTE-03/05 | build/typecheck don't prove DDL applied | Operator applies 0019 (remote push works), runs pgTAP |
| Non-nominal option codes (Abstención/Pareo/Ausente) + DIPID presence | VOTE-03 | Phase 8 only confirmed 1=sí/0=no/4=No Vota; needs LIVE confirmation | Verify LIVE which options carry DIPID; derive "ausente" from the votación roster, never from absence of row; show aggregate-only honestly if an option lacks per-deputy detail |

## Validation Sign-Off

- [ ] Connector enriches idempotently + DIPID cross (offline green, LIVE attempted)
- [ ] 0019 applied + pgTAP green (operator)
- [ ] Ficha shows 3 honest states; link only if confirmado
- [ ] voto×tema facet with no score; rebeldías raw count, partido never anon-readable
- [ ] No affinity/causal language (content gate)
- [ ] `nyquist_compliant: true` at execution

**Approval:** pending
