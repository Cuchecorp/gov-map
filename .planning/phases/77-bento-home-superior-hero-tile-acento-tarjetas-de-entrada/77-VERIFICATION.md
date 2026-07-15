---
phase: 77-bento-home-superior-hero-tile-acento-tarjetas-de-entrada
verified: 2026-07-15T11:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  # No previous VERIFICATION.md — initial verification
gaps: []
human_verification:
  # None BLOCK the phase goal (all code-level truths verified). Visual layout /
  # collapse / AA-contrast are explicitly DEFERRED to Phase 79/81 by design
  # (77-VALIDATION.md §Manual-Only). Not phase-77 gaps.
---

# Phase 77: BENTO-HOME-SUPERIOR Verification Report

**Phase Goal:** La mitad superior de la home es el bento del mockup, con el copy firmado intacto.
**Verified:** 2026-07-15T11:40:00Z (master HEAD `55d1bd8`)
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Home renderiza BentoGrid: hero span-4 (kicker mono uppercase + h1 LOCKED + cursiva + SearchBox hero 52px/`--radius-control` botón petróleo + pills 44px radio 999px) + trust line LOCKED | ✓ VERIFIED | `page.tsx:70` `<BentoGrid>`; `:72` hero `span={4}`; `:75-77` kicker `font-mono … uppercase OBSERVATORIO DEL CONGRESO`; `:81` h1 LOCKED; `:82-84` `<em italic text-accent-product>Con la fuente a la vista.`; `:94` `SearchBox variant="hero"`; `search-box.tsx:117,127` input+botón `h-[52px] rounded-[var(--radius-control)]`, botón `bg-accent-product font-semibold text-background`; `:144` pills `min-h-11 rounded-full`; `page.tsx:98-101` trust line LOCKED verbatim |
| 2 | Tile accent span-2 "¿Cómo leer esto?": variante accent, BrandIcon claro (currentColor), copy fórmula /sobre (NO mockup), CTA "Ver metodología →" a /sobre | ✓ VERIFIED | `page.tsx:108` `variant="accent" span={2}`; `:109` `Link href="/sobre"`; `:110` `BrandIcon color="currentColor"`; `:112` h2 `text-accent-product-foreground ¿Cómo leer esto?`; `:115-119` cuerpo = fórmula /sobre ("nunca se inventa"), sin "correlaciones/irregularidades"; `:121-126` CTA "Ver metodología →" (`→` en `<span aria-hidden pl-1>`) |
| 3 | 3 tarjetas entrada span-2: diamante + →, copy/destinos actuales sin cambio | ✓ VERIFIED | `page.tsx:131-163` map `ENTRY_CARDS`; cada tile `variant="default" span={2}` → `Link href={card.href}`; `:136-154` SVG single-diamond `currentColor aria-hidden text-accent-product`; `:155-157` `→` `aria-hidden pl-1`; `ENTRY_CARDS` (`:40-63`) hrefs `/buscar,/parlamentarios,/agenda` + copy verbatim |
| 4 | Hero server component; SearchBox único island; force-dynamic conservado; ActualidadModule montado | ✓ VERIFIED | `page.tsx` sin `"use client"` (Server Component); `:14` `export const dynamic = "force-dynamic"`; `:172` `<ActualidadModule />`; SearchBox es la única isla `"use client"` (`search-box.tsx:1`); BentoGrid/BentoTile/BrandIcon/ActualidadModule todos Server Components |
| 5 | Tests home actualizados; suite verde (862); anti-insinuación verde | ✓ VERIFIED | `page.test.tsx` migrado (kicker/accent/hrefs/spans/force-dynamic + BANNED_VOCAB `correlaci\|irregularidad`); suite ejecutada: **862 passed (77 files)**; `anti-insinuacion-guard.test.ts` 18 passed; `tsc --noEmit` EXIT 0 |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/app/globals.css` | `--accent-product-foreground: 183 30% 96%` + `--bento-accent-fill: 183 38% 26%` en :root Y .dark (dark-stable) | ✓ VERIFIED | Lines 39-40 (:root) + 67-68 (.dark), valores idénticos |
| `app/tailwind.config.ts` | ambos tokens en colors via `hsl(var(...))` | ✓ VERIFIED | Lines 48, 50 mirror del idiom accent-product |
| `app/components/bento/bento-tile.tsx` | accent = fill dark-stable + foreground token + hover; sin text-primary-foreground | ✓ VERIFIED | Line 30 `bg-bento-accent-fill text-accent-product-foreground hover:bg-bento-accent-fill/90` |
| `app/components/search-box.tsx` | hero 52px+radius-control; /buscar default aislado | ✓ VERIFIED | `:117,127` hero; `:118,128` default byte-identical `h-12` sin radius |
| `app/app/page.tsx` | Bento composition 5 tiles + force-dynamic + ActualidadModule | ✓ VERIFIED | Ver truths 1-4 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| accent BentoTile variant | `--accent-product-foreground` / `--bento-accent-fill` | Tailwind utils desde colors map | ✓ WIRED | Tokens en globals.css :root+.dark, registrados en tailwind.config.ts, consumidos por `text-accent-product-foreground`/`bg-bento-accent-fill` en cva |
| SearchBox hero | `--radius-control` | `rounded-[var(--radius-control)]` | ✓ WIRED | Solo rama isHero; nunca bare `[--radius-control]` |
| page.tsx tiles | BentoGrid/BentoTile (Phase 76) | asChild wrapping single section/Link | ✓ WIRED | Imports `:5-6`; 5 tiles montados |
| page.tsx accent tile | `/sobre` | Link href + CTA | ✓ WIRED | `:109` `href="/sobre"` |
| page.tsx | ActualidadModule + force-dynamic | mount below grid + export | ✓ WIRED | `:14`, `:172` |
| /buscar | SearchBox default | `initialQuery` sin variant | ✓ WIRED | `buscar/page.tsx:62` `<SearchBox initialQuery={q} />` — h-12 intacto |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full app suite | `pnpm --filter ./app test -- --run` | 862 passed / 77 files | ✓ PASS |
| Type gate | `pnpm --filter ./app exec tsc --noEmit` | EXIT 0 | ✓ PASS |
| Anti-insinuación | included in suite (`anti-insinuacion-guard.test.ts`) | 18 passed | ✓ PASS |
| Zero-hex / bare-var page.tsx | grep `#hex` / `[--` | 0 matches | ✓ PASS |
| Zero-hex / bare-var search-box.tsx | grep `#hex` / `[--` | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BENTO-02 | 77-01, 77-02 | Mitad superior home = bento (hero span-4, tile acento span-2, 3 entradas span-2) | ✓ SATISFIED | Truths 1-5 verified; page.tsx renders the full upper-half bento |

### Anti-Patterns Found

None. No `TBD/FIXME/XXX` debt markers in modified files; no stubs (all 5 tiles link to real routes); no hardcoded empty data; no `#` hex; no bare `[--token]`.

### Human Verification Required

None gate this phase. By design (77-VALIDATION.md §Manual-Only), the **real layout/collapse** and **AA-contrast** of the accent tile are jsdom-invisible and DEFERRED to Phase 79/81 (BrowserOS deploy gate). These are not Phase-77 gaps — Phase 77's contract is the code-level composition, all of which is verified.

### Gaps Summary

No gaps. All 5 success criteria are observably true in the codebase at master HEAD.

**Note on goal wording:** The ROADMAP goal says "el bento del mockup", but the accent-tile copy deliberately adopts the /sobre "El principio" formula and BANS the mockup's "correlaciones/irregularidades" string. This is NOT a deviation — SC2 and REQUIREMENTS BENTO-02 explicitly require "copy alineado a /sobre", and the anti-insinuación invariant forbids the mockup string. Layout/spans follow the mockup; the signed copy is preserved intact per the goal's "con el copy firmado intacto" clause. Fully consistent.

---

_Verified: 2026-07-15T11:40:00Z_
_Verifier: Claude (gsd-verifier)_
