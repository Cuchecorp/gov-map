---
phase: 68
slug: voto-p3e-superficies-de-voto-linter-anti-insinuacion-cobertura-gate-browseros
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 68 — Validation Strategy

> Anti-insinuation is the load-bearing property. The linter + prune are the tests; the BrowserOS cold-read is the closing operator gate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (+ React Testing Library for components) |
| **Quick run (app)** | `pnpm --filter ./app test` |
| **Freshness** | `pnpm --filter @obs/freshness test` + `pnpm freshness` |
| **Full suite** | `pnpm test` |
| **Guard model** | mirror `app/lib/lockdown-guard.test.ts` (walks source, `stripTsComments`, asserts 0 offenders) |
| **BrowserOS cold-read (operator)** | comprehension verdict "comprensible" |

---

## Sampling Rate

- After every task commit: `pnpm --filter ./app test`.
- After wave: `pnpm test` + `pnpm freshness`.
- Before verify: full suite green + anti-insinuation guard green + prune grep clean.

---

## Per-Task Verification Map

| Assertion | Requirement | Test Type | Command | Status |
|-----------|-------------|-----------|---------|--------|
| Individual vote history mounted on ficha (por sesión/proyecto, enlace a votación + proyecto); never "alineamiento/rebeldía" | VOTO-02 | component (RTL) | `pnpm --filter ./app test` | ⬜ pending |
| Anti-insinuation legend + inline provenance on every vote surface; pareo/ausente in NEUTRAL slate, never fused with "en contra" | VOTO-04 | component (RTL) | `pnpm --filter ./app test` | ⬜ pending |
| Anti-insinuation linter (new `*.test.ts` reusing `stripTsComments`) scans vote components + app; blocks "rebeldía/disciplina/alineamiento/vota como/mediana de su cámara/similar a" | VOTO-04 | guard test | `pnpm --filter ./app test` | ⬜ pending |
| PRUNE verified: no "Votó distinto a su bancada" render, no chamber-median comparison; `ausencias-contexto.tsx` deleted; RPCs dropped from PUBLIC_RPC_ALLOWLIST | VOTO-04 | guard/grep + RTL | `git grep` + `pnpm --filter ./app test` | ⬜ pending |
| Vote coverage declared N/M + ceiling-by-cause in UI AND `pnpm freshness` (`COBERTURA_VOTO_SENALES`, both chambers); probable/no_confirmado NOT shown as attributed | VOTO-05 | unit + build | `pnpm --filter @obs/freshness test` + `pnpm freshness` | ⬜ pending |
| BrowserOS cold-read verdict "comprensible" | VOTO-05 | operator (manual) | BrowserOS CDP | ⬜ pending (operator) |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

- [ ] New `app/lib/anti-insinuacion-guard.test.ts` (term blocklist, `stripTsComments`, asserts 0 offenders across app + vote components).
- [ ] RTL tests for the mounted vote surfaces (legend present, neutral-slate for pareo/ausente, provenance inline, links present, no forbidden surfaces).
- [ ] `packages/freshness` cobertura-voto test (`COBERTURA_VOTO_SENALES` evaluate).
- [ ] Delete `ausencias-contexto.tsx` + its test.

*Existing: vote components, `votos_de_parlamentario` RPC, ficha page, lockdown-guard pattern, freshness catalog pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BrowserOS cold-read = "comprensible" | VOTO-05 | Comprehension is a human/agent visual judgment on the deployed surface | Run the BrowserOS CDP cold-read on the parlamentario ficha vote section; verdict must be "comprensible". Per project memory: CDP timeout → reopen page, sleep 8-10s; do NOT fake captures if MCP down. |

---

## Validation Sign-Off

- [ ] Anti-insinuation guard green + would FAIL on an injected banned term (mutation-check)
- [ ] Prune grep clean; ausencias-contexto deleted; allowlist hardened
- [ ] Neutral-slate rule for pareo/ausente asserted (color/token, not fused with "no")
- [ ] Coverage declared in UI + freshness
- [ ] BrowserOS "comprensible" (operator)
- [ ] `nyquist_compliant: true` when green

**Approval:** pending
