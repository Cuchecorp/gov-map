---
phase: 11
slug: int-lobby-reuniones-de-lobby-sub-maestra-de-contrapartes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 11 — Validation Strategy

> INT Lobby: @obs/lobby connector + counterpart sub-master + lobby section on /parlamentario/[id]. First multi-dataset section — sets the anti-insinuation pattern.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS + RTL) + pgTAP (migration ≥0021) |
| **Quick run command** | `pnpm --filter @obs/lobby test` / `pnpm --filter app test` |
| **Full suite command** | `pnpm -w test` |
| **Estimated runtime** | ~30–90 s offline (LIVE crawl + DB-applied pgTAP operator-gated) |

## Sampling Rate

- After every task commit: touched package's vitest
- After ficha section: RTL render tests (incl. anti-insinuation lane + honest empty states)
- LIVE crawl + pgTAP against applied migration: operator-gated; bounded run; never fabricate
- Max feedback latency: ~90 s offline

## Per-Task Verification Map

| Task ID | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|-------------|-----------------|-----------|-------------------|--------|
| migration ≥0021 (lobby_audiencia + lobby_contraparte) | 1 | INT-01 | lobby_audiencia public-read; lobby_contraparte deny-by-default (mirror 0018); provenance NOT NULL; sujeto-pasivo FK only via EnlaceConfirmado | pgTAP (operator-applied) | pgTAP | ⬜ |
| @obs/lobby connector + parser + writer | 1 | INT-01 | cheerio over /instituciones/{CODE}/audiencias/{year}; key by Identificador; reuse @obs/ingest LOCKED order; idempotent natural key; blocking drift; never fabricate | unit (fixture) + LIVE-gated | `pnpm --filter @obs/lobby test` | ⬜ |
| sujeto-pasivo reconciliation + sub-master | 1 | INT-01/02 | sujeto pasivo crosses via correrPipeline; FK only determinista/confirmado; identidad_audit row each; counterpart raw text, contraparte_id NULL | unit | lobby/adjudication test | ⬜ |
| lobby section on /parlamentario/[id] | 2 | INT-02 | own lane (no vote+lobby composed unit); counterpart raw text, link only if confirmado; 3 honest empty states; ProvenanceBadge; no causal/affinity language | RTL render | `pnpm --filter app test` | ⬜ |

## Wave 0 Requirements

- [ ] Offline fixture (captured leylobby audiencia HTML) for the parser
- [ ] RTL tests: anti-insinuation lane (no lobby+vote composed unit), 3 honest empty states, counterpart-not-linked-unless-confirmed
- [ ] pgTAP: lobby_contraparte anon-denied; lobby_audiencia public-read; FK guard
- [ ] Content-gate assertion: no causal/affinity/conflict-flag language in the lobby section

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LIVE bounded crawl of leylobby for sitting parliamentarians | INT-01 | gov site, rate-limited, paginated; non-deterministic | Bounded run; verify provenance + Identificador key; degrade to fixture if unreachable; never fabricate |
| Migration applied + pgTAP green | INT-01/02 | build/typecheck don't prove DDL applied | Operator applies migration (remote reachable), runs pgTAP |
| Congress institution code(s) + counterpart column layout | INT-01 | verified on a non-congress page; needs confirmation on a congress audiencia page | Confirm Cámara/Senado institution codes + the attendee table layout LIVE |

## Validation Sign-Off

- [ ] Connector ingests + sub-master built; idempotent; never fabricates
- [ ] Migration applied + pgTAP green (operator); counterpart anon-denied
- [ ] Meeting→parlamentario link only determinista/confirmado + identidad_audit
- [ ] Lobby section own lane, no composed unit, honest empties, no causal language
- [ ] `nyquist_compliant: true` at execution

**Approval:** pending
