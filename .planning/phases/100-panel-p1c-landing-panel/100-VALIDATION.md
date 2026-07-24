---
phase: 100
slug: panel-p1c-landing-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 100 — Validation Strategy

> Frontend phase. Validation = vitest guards (anti-insinuacion SUPERFICIES_PANEL, bento cero-hex/tipografía, lockdown allowlist), component tests for tile/suppression rendering, + BrowserOS cold-read gate on real deploy (acceptance criterion #4).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library (app) |
| **Config file** | app/vitest.config.ts |
| **Quick run command** | `pnpm --filter app test` |
| **Full suite command** | `pnpm test && pnpm -r exec tsc --noEmit` |
| **Estimated runtime** | ~120s |

---

## Sampling Rate

- **Wave 0 (before any copy):** SUPERFICIES_PANEL added to anti-insinuacion + bento guards; run guards red→green.
- **After each tile:** component test (count framing, fuente+fecha, suppression renders causa).
- **After deploy:** BrowserOS cold-read gate at 390px on workers.dev (getComputedStyle candados).
- **Before close:** full suite + tsc + audit 0; linter green with new vocab.

---

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|-------------|-----------------|-----------|-------------------|--------|
| (planner completes) | PANEL-01 | panel reemplaza bento; candados intactos; SUPERFICIES_PANEL first | guard vitest | anti-insinuacion + bento guards | ⬜ pending |
| (planner completes) | PANEL-02 | fuente+fecha + estado vacío honesto; URL intacta; precomputado | component test | tile render + suppression | ⬜ pending |
| (planner completes) | PANEL-03 | benchmark documentado | manual/BrowserOS | benchmark doc + captures | ⬜ pending |
| (planner completes) | PANEL-04 | lectura fría "comprensible" deploy real | manual/BrowserOS | cold-read gate getComputedStyle | ⬜ pending |

---

## Wave 0 Requirements

Add `SUPERFICIES_PANEL` to `app/lib/anti-insinuacion-guard.test.ts` scan loop + bento-guards (cero-hex, tipografía) BEFORE writing any panel copy. New denylist timing-editorial terms ("último momento","exprés","revivido","de madrugada","zombie").

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Benchmark senado.cl/camara.cl documented | PANEL-03 | requires BrowserOS capture of gov portals | bros-cli screenshots + design critique doc (avoid dense ASP.NET tables; surpass editorial) |
| Cold-read "comprensible" on real deploy | PANEL-04 | requires BrowserOS on workers.dev deploy | bros-cli at 390px, getComputedStyle candados, verdict comprensible for periodista/tramitador/ciudadano |
| Candados verified in deploy (not just local) | PANEL-01 | CSS cascade only cazable in real deploy | getComputedStyle on deployed page (cero-hex, typography, [var] resolved) |
