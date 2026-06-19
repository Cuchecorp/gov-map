---
phase: 12
slug: int-patrimonio-intereses-declaraciones-con-historial-y-comparacion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 12 — Validation Strategy

> INT Patrimonio/Intereses: @obs/probidad connector (InfoProbidad SPARQL, structured → no LLM) + versioned declarations + history/comparison section. Content is structured (no LLM); comparison has ZERO verdict field.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS + RTL) + pgTAP (migration ≥0022) |
| **Quick run command** | `pnpm --filter @obs/probidad test` / `pnpm --filter app test` |
| **Full suite command** | `pnpm -w test` |
| **Estimated runtime** | ~30–90 s offline (LIVE SPARQL + DB-applied pgTAP operator-gated) |

## Sampling Rate

- After every task commit: touched package's vitest
- After ficha section: RTL render tests (history + comparison + content gate)
- LIVE SPARQL run + pgTAP against applied migration: operator-gated; bounded; never fabricate
- Max feedback latency: ~90 s offline

## Per-Task Verification Map

| Task ID | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|-------------|-----------------|-----------|-------------------|--------|
| migration ≥0022 (declaracion versioned) | 1 | INT-03/04 | versioned by (fuente_id, fecha_presentacion), never overwrite; publishable fields public-read; family/PII deny-by-default + EXPLICIT revoke anon; CC BY 4.0 + provenance per row | pgTAP (operator-applied) | pgTAP | ⬜ |
| @obs/probidad connector (SPARQL parse, zod, no LLM) | 1 | INT-03 | literal structured parse; CC BY 4.0 attribution per row; reuse @obs/ingest LOCKED; blocking drift; never fabricate | unit (fixture) + LIVE-gated | `pnpm --filter @obs/probidad test` | ⬜ |
| declarante reconciliation + versioned writer | 1 | INT-03/04 | declarante crosses name-only via correrPipeline; FK only determinista/confirmado (EnlaceConfirmado) + identidad_audit; writer never overwrites a version | unit | probidad/adjudication test | ⬜ |
| ficha section: history + comparison | 2 | INT-04/05 | version history dated (prominent fecha + amber freshness; old never shown as current); side-by-side comparison with ZERO verdict/delta field; CC BY 4.0 visible incl. derived view; own lane | RTL render | `pnpm --filter app test` | ⬜ |

## Wave 0 Requirements

- [ ] Offline fixture (captured InfoProbidad SPARQL response) for the parser
- [ ] RTL tests: version history (old ≠ current), comparison side-by-side, §9.1 ZERO-verdict gate over BOTH the list and the comparison view, CC BY 4.0 caption present, no RUT/family
- [ ] pgTAP: family/PII columns anon-denied (RLS + explicit revoke); publishable fields public-read; version-key uniqueness

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LIVE bounded SPARQL run for sitting parliamentarians | INT-03 | gov endpoint, rate-limited; non-deterministic | Bounded per-name run; verify CC BY 4.0 + fechaDeclaracion; degrade to fixture if unreachable; never fabricate |
| Migration applied + pgTAP green | INT-03/04 | build/typecheck don't prove DDL applied | Operator applies migration (remote reachable), runs pgTAP |
| Asset sub-entity leaf properties + tipoDeclaracion labels | INT-03 | leaf properties to enumerate at plan/exec time (research OQ 2-3) | Enumerate one instance per asset class via SPARQL; store raw URI if no label; never fabricate |

## Validation Sign-Off

- [ ] Connector literal-parses structured declarations (no LLM); CC BY 4.0 per row; never fabricates
- [ ] Migration applied + pgTAP green (operator); family/PII anon-denied + explicit revoke
- [ ] Version history dated; old never shown as current; declarante link only determinista/confirmado
- [ ] Comparison side-by-side with ZERO verdict field; content gate covers comparison; CC BY 4.0 in derived view
- [ ] Blocking drift; `nyquist_compliant: true` at execution

**Approval:** pending
