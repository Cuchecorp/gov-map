---
phase: 76
slug: bento-base-primitivas-bento-chrome-global
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 76 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 76-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + jsdom + @testing-library/react (`app/vitest.config.ts`) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test -- --run components/bento` |
| **Full suite command** | `pnpm --filter ./app test -- --run` + `pnpm --filter ./app exec tsc --noEmit` |
| **Estimated runtime** | ~55 s (full app suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter ./app test -- --run components/bento` (quick)
- **After every plan wave:** Run `pnpm --filter ./app test -- --run` (full app suite)
- **Before `/gsd:verify-work`:** Full suite green (app 820+ + packages 1103) + `tsc --noEmit` limpio
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC1 tokens radio | TBD | 1 | BENTO-01 | — | N/A | source-scan | `pnpm --filter ./app test -- --run globals` | ❌ W0 (`app/app/globals.test.ts`) | ⬜ pending |
| SC2 BentoGrid | TBD | 1 | BENTO-01 | — | N/A | unit (RTL) | `pnpm --filter ./app test -- --run components/bento` | ❌ W0 (`bento-grid.test.tsx`) | ⬜ pending |
| SC2 BentoTile | TBD | 1 | BENTO-01 | — | N/A | unit (RTL) | `pnpm --filter ./app test -- --run components/bento` | ❌ W0 (`bento-tile.test.tsx`) | ⬜ pending |
| SC3 header sticky | TBD | 1-2 | BENTO-01 | — | gate `netPublicEnabled` intacto (fail-closed) | source-scan + RTL | `pnpm --filter ./app test -- --run global-header header-nav` | 🔶 extender `global-header.test.ts` | ⬜ pending |
| SC4 footer | TBD | 2 | BENTO-01 | — | N/A | source-scan | `pnpm --filter ./app test -- --run layout` | 🔶 extender `layout.test.tsx` | ⬜ pending |
| SC5 no-layout-interno | TBD | 2 | BENTO-01 | — | N/A | source-scan + diff review | `pnpm --filter ./app test -- --run layout` | 🔶 assert no-`<main>`-global | ⬜ pending |
| SC6 suite+guards | TBD | final | BENTO-01 | — | anti-insinuación + guard tipográfico verdes SIN cambio | full suite | `pnpm --filter ./app test -- --run` + `tsc --noEmit` | ✅ existen | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/app/globals.test.ts` — tokens `--radius-tile`/`--radius-control` presentes, `--radius: 0.5rem` intacto, `scroll-margin-top` global presente (SC1, SC3)
- [ ] `app/components/bento/bento-grid.test.tsx` — clases grid (`md:grid-cols-6`, `gap-[14px]`), orden DOM (SC2)
- [ ] `app/components/bento/bento-tile.test.tsx` — variants default/accent por token, span, focus-visible, min-h-11, cero hex (soft) (SC2)
- [ ] Extender `app/components/global-header.test.ts` — `sticky`/`top-0`/`max-w-[1120px]` (SC3)
- [ ] Extender `app/app/layout.test.tsx` — footer sin `bg-muted/40`, `max-w-[1120px]`, strings CC BY LOCKED, no-`<main>`-en-layout (SC4, SC5)
- Framework install: none — vitest+RTL ya presentes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Grid/píxel real (sticky no tapa anchors, ancho visual) | BENTO-01 | jsdom no ve layout (lección v6.1) | Gate visual BrowserOS en deploy real — Phase 79/81 |
| `/red` sin regresión visual | invariante 4 | jsdom no ve cascada CSS | getComputedStyle en deploy — Phase 79/81 |
