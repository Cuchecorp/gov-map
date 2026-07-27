---
phase: 73
slug: dinero-p5e-superficies-money-gated-off-linter-gate-legal-humano
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 73 — Validation Strategy

> Surfaces already exist + are already gated. Deltas: MONEY legend, linter extension, anti-flip route guard, dossier completion. All offline-testable; the flip + BrowserOS cold-read are operator-exclusive.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ RTL) |
| **Quick run** | `pnpm --filter ./app test` |
| **Guards** | anti-insinuacion-guard, lockdown-guard, money-antiflip-guard (new) |
| **Typecheck** | `tsc -b` |
| **BrowserOS gated-preview (operator)** | comprehension verdict "comprensible" |

---

## Sampling Rate

- After every task commit: `pnpm --filter ./app test`.
- Before verify: all guards green (incl. mutation self-checks) + gate proven OFF-by-default.

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| Every MONEY surface renders ONLY via `moneyPublicEnabled(process.env)` (fail-closed `=== "true"`, OFF default); NO route reads raw `process.env.MONEY_PUBLIC_ENABLED` (new route guard walks app/, fails if it appears outside money-gate.ts) | MONEY-05 | guard | `pnpm --filter ./app test` | ⬜ pending |
| Each money surface: inline provenance (fuente/fecha/enlace + monto VERBATIM) + `LEYENDA_ANTI_INSINUACION_MONEY` (single-source constant); "empresa ligada" only on RUT-exact ("Enlazado por RUT"), SERVEL by-name ("Asociado por nombre confirmado") — never conflated | MONEY-04 | RTL | `pnpm --filter ./app test` | ⬜ pending |
| Anti-insinuation linter EXTENDED to MONEY surfaces: blocks "empresa ligada a"/"financió"/"a cambio de" etc.; the MONEY legend added to NEGACIONES_LOCKED (no false-positive); "Enlazado por RUT" (fact) does NOT trip; mutation self-check bites | MONEY-04 | guard | `pnpm --filter ./app test` | ⬜ pending |
| Anti-flip guard: an agent commit cannot flip the default/flag to "true" nor relax `=== "true"`; mutation self-check proves it bites | MONEY-05 | guard | `pnpm --filter ./app test` | ⬜ pending |
| Legal dossier `docs/legal/13-LEGAL-DOSSIER.md` completed for human review; flip gated by `signoff: approved` (agent leaves it `pending`, never signs/flips) | MONEY-05 | doc + gate | grep signoff | ⬜ pending |
| Freshness declared per datum (election/cut-date, contract date) — never old-as-current | MONEY-04 | RTL | `pnpm --filter ./app test` | ⬜ pending |
| BrowserOS "comprensible" gated-preview verdict on MONEY surfaces | MONEY-04 | operator | BrowserOS CDP | ⬜ pending (operator) |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] `app/lib/money-antiflip-guard.test.ts` (new) — the no-raw-env-in-route guard + flip/relax mutation self-check.
- [ ] `LEYENDA_ANTI_INSINUACION_MONEY` constant (single source, mirror `LEYENDA_ANTI_INSINUACION`).

*Existing (extend, not create): the 4 money surfaces + their `*.test.tsx`, `money-gate.ts`, `anti-insinuacion-guard.test.ts`, `docs/legal/13-LEGAL-DOSSIER.md`, provenance-badge, the RUT-vs-name copy.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The FLIP (encendido MONEY) | MONEY-05 | Human-exclusive legal act; requires `signoff: approved` in dossier 13 (21.719); operator provides | Operator reviews the dossier, obtains legal sign-off, sets `signoff: approved`, flips `MONEY_PUBLIC_ENABLED=true` in prod. NOT this run. |
| BrowserOS "comprensible" cold-read (gated-preview) | MONEY-04 | Needs local/operator preview with flag ON + data (operator backfills); comprehension is a human/agent visual judgment | Operator runs the BrowserOS CDP cold-read on the MONEY surfaces in gated-preview; verdict "comprensible". |

---

## Validation Sign-Off

- [ ] Gate OFF-by-default proven; no raw env in any route (guard bites)
- [ ] MONEY legend single-source + rendered on every surface; RUT-vs-name never conflated
- [ ] Linter extended to MONEY (bites on injected causal term; legend + "Enlazado por RUT" don't false-positive)
- [ ] Anti-flip guard bites on flip/relax mutation
- [ ] Dossier 13 completed, left `signoff: pending`; flip deferred to human
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
