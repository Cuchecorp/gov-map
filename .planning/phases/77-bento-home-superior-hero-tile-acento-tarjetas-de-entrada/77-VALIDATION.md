---
phase: 77
slug: bento-home-superior-hero-tile-acento-tarjetas-de-entrada
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
---

# Phase 77 — Validation Strategy

> Derived from 77-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react (jsdom) |
| **Config file** | `app/vitest.config.ts` |
| **Quick run command** | `pnpm --filter ./app test -- --run page` (o `search-box` / `components/bento`) |
| **Full suite command** | `pnpm --filter ./app test -- --run` + `pnpm --filter ./app exec tsc --noEmit` |
| **Estimated runtime** | ~35-55 s (full app) |

---

## Sampling Rate

- **After every task commit:** targeted `--run page` / `--run search-box` / `--run components/bento`
- **After every plan wave:** full app suite + tsc
- **Before `/gsd:verify-work`:** full suite green + anti-insinuación green
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|------|-------------|----------|-----------|-------------------|-------------|--------|
| Hero copy LOCKED | BENTO-02 | kicker + h1 + cursiva + trust line byte-identical | unit | `pnpm --filter ./app test -- --run page` | ✅ migrar `page.test.tsx` | ⬜ |
| SearchBox hero restyle | BENTO-02 | `h-[52px]` + `rounded-[var(--radius-control)]` + botón petróleo; /buscar aislado | unit | `pnpm --filter ./app test -- --run search-box page` | ✅ | ⬜ |
| Accent tile | BENTO-02 | href /sobre, copy fórmula /sobre (NO mockup), CTA, hover, foreground token, BrandIcon currentColor | unit | `pnpm --filter ./app test -- --run page` | ✅ añadir | ⬜ |
| Entry tiles | BENTO-02 | 3 links hrefs + copy verbatim + diamante + → aria-hidden | unit | `pnpm --filter ./app test -- --run page` | ✅ migrar Contract-2 | ⬜ |
| Grid/collapse | BENTO-02 | 5 hijos BentoTile spans 4/2/2/2/2, orden DOM | unit | `pnpm --filter ./app test -- --run page` | ✅ añadir | ⬜ |
| Retained | BENTO-02 | ActualidadModule montado bajo el grid; force-dynamic exportado | unit | `pnpm --filter ./app test -- --run page` | ✅ añadir | ⬜ |
| Token wiring | BENTO-02 | `--accent-product-foreground` en :root + .dark + tailwind.config colors | source-scan | `pnpm --filter ./app test -- --run globals` | ⚠️ W0 extender `globals.test.ts` | ⬜ |
| Anti-insinuación | invariante 2 | suite verde (home fuera de scope; fórmula /sobre igual) | unit | `pnpm --filter ./app test -- --run anti-insinuacion` | ✅ sin cambio | ⬜ |
| No regressions | BENTO-02 | suite completa verde + tsc limpio | suite | full | ✅ | ⬜ |

---

## Wave 0 Requirements

- [ ] Migrar `app/app/page.test.tsx` (Contract-2 nav→grid links; LOCKED strings byte-identical; nuevas asserts spans/kicker/accent/retained)
- [ ] Extender `app/app/globals.test.ts` — `--accent-product-foreground` en :root y .dark
- [ ] Framework install: none

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Layout visual del grid (spans reales, colapso) | BENTO-02 | jsdom no ve layout | BrowserOS deploy real — Phase 79/81 |
| Contraste AA real del tile accent | invariante 7 | jsdom no computa color | getComputedStyle en deploy — Phase 81 |
