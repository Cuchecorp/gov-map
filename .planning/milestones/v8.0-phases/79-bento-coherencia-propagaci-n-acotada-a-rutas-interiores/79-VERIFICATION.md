---
phase: 79-bento-coherencia-propagaci-n-acotada-a-rutas-interiores
verified: 2026-07-15T13:40:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
---

# Phase 79: BENTO-COHERENCIA — Propagación acotada a rutas interiores — Verification Report

**Phase Goal:** Salir de la home no se siente como cambiar de sitio — sin re-layoutear ninguna página interior.
**Verified:** 2026-07-15T13:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | /buscar, /parlamentarios, /agenda, /sobre, /metodologia: contenedor 1120px + `--radius-tile` en tarjetas de primer nivel, sin re-layout | ✓ VERIFIED | Los 5 `<main>` con `max-w-[1120px] mx-auto px-4 md:px-8 py-8 md:py-16` (grep verbatim). SearchResultCard L39 `<Card className="rounded-[var(--radius-tile)]">`; DirectoryRow L34 root `rounded-[var(--radius-tile)]`; boxes empty/error de buscar (L93/105/139), parlamentarios (L128), agenda (L191/199/238-li) todos con radio bento. Cero re-layout: solo swap de clase. |
| 2 | Fichas ×3: solo contenedor + paneles exteriores; interiores byte-idénticos; scroll-mt reconciliado | ✓ VERIFIED | parlamentario/[id] L141, proyecto/[boletin] L65, contraparte/[id] L64 → `max-w-[1120px]`. Cero `scroll-mt-6` en las 2 páginas de ficha con anclas (grep count=0 en producción); globals.css L106 `scroll-margin-top: 5rem` (80px) aplica global. Cero swap de radio en fichas (correcto: únicos rounded-lg = skeletons/aria-hidden). use-scrollspy.test.ts verde (3 tests). |
| 3 | /red excluido documentado; red-graph.test.tsx + .net-chip 11px verdes; guard de exclusión con mutation self-check | ✓ VERIFIED | red/page.tsx L82+L163 ambos `<main className="max-w-3xl">` (no ensanchado). bento-coherencia-guard.test.ts (8 tests) con detector puro + mutation self-check EN MEMORIA por ambos ejes (FIREWALL + EXCLUSION-RED) — verificado que muerde. red/page.test.tsx L224-230 asserta max-w-3xl presente + 1120px ausente. red-graph.test.tsx L672-694 (.net-chip 0.6875rem/11px) verde. Exclusión documentada en 79-03-SUMMARY con racional (layout B 2026-07-13). |
| 4 | Suite completa verde + guard tipográfico; capturas archivadas | ✓ VERIFIED | Suite ejecutada por el verificador: **885 tests / 78 files, 0 fallos** (coincide con SUMMARY 03). globals.test.ts (guard tipográfico) verde (8 tests). money-antiflip-guard verde (20 tests, 201ms — NO timeout en HEAD, contradice SUMMARY 02 pero resuelto). Capturas archivadas: 8 antes + 4 antes-prod + 8 despues + README (verificadas por el orquestador, no repetidas). |
| 5 | card.tsx NO editado (firewall D3) | ✓ VERIFIED | card.tsx L12 conserva `rounded-lg` hardcoded; cero `rounded-[var` (grep). `git log -- card.tsx` → último cambio commit a2d14a5 (Phase 05); ningún commit de fase 79 lo tocó. Guard source-scan lo congela. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/app/buscar/page.tsx` | container 1120px + boxes radio bento | ✓ VERIFIED | L60 max-w-[1120px]; L93/105/139 rounded-[var(--radius-tile)] |
| `app/components/search-result-card.tsx` | Card primer nivel con radio bento | ✓ VERIFIED | L39 `<Card className="rounded-[var(--radius-tile)]">` |
| `app/components/parlamentario-directory-row.tsx` | root con radio bento | ✓ VERIFIED | L34 rounded-[var(--radius-tile)] |
| `app/app/agenda/page.tsx` | li + boxes + container 1120px | ✓ VERIFIED | L76 container; L191/199/238 radio bento |
| `app/app/parlamentario/[id]/page.tsx` | container + scroll-mt reconciliado | ✓ VERIFIED | L141 1120px; 0 scroll-mt-6 |
| `app/app/proyecto/[boletin]/page.tsx` | container + scroll-mt reconciliado | ✓ VERIFIED | L65 1120px; 0 scroll-mt-6; section#cruces = mt-12 |
| `app/app/contraparte/[id]/page.tsx` | container (sin anclas) | ✓ VERIFIED | L64 1120px (origen max-w-3xl) |
| `app/lib/bento-coherencia-guard.test.ts` | guard firewall + exclusión + mutation self-check | ✓ VERIFIED | 8 tests, detector puro, self-check por 2 ejes, readFileSync+process.cwd() |
| `app/app/red/page.test.tsx` | assert no-regresión ancho /red | ✓ VERIFIED | L224-230 |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| buscar/page.tsx | SearchResultCard | call site render tarjeta primer nivel | ✓ WIRED (imported+rendered; radio bento en Card) |
| parlamentarios/page.tsx | ParlamentarioDirectoryRow | root swap a --radius-tile | ✓ WIRED |
| fichas | globals.css scroll-margin-top 5rem | quitar scroll-mt-6 local → aplica global 80px | ✓ WIRED (0 scroll-mt-6 producción; global presente L106) |
| bento-coherencia-guard | card.tsx + red/page.tsx | source-scan que falla ante violación | ✓ WIRED (0 offenders reales, muerde en mutación) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite app completa | `pnpm --filter ./app test -- --run` | 885 passed / 78 files / 0 fail | ✓ PASS |
| Typecheck | `pnpm --filter ./app exec tsc --noEmit` | exit 0 | ✓ PASS |
| Guard bento-coherencia | filtro test bento-coherencia-guard | 8 tests verde (mutation self-check muerde) | ✓ PASS |
| Firewall git-level | `git log -- app/components/ui/card.tsx` | último cambio Phase 05 (a2d14a5), intacto en fase 79 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BENTO-04 | 79-01/02/03 | Rutas interiores reciben coherencia acotada (1120px + --radius-tile en primer nivel) sin re-layout; /red decisión consciente | ✓ SATISFIED | 8 rutas a 1120px + radios de primer nivel; /red excluido documentado; interiores byte-idénticos; suite verde |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (ninguno) | — | — | — | Cero TODO/FIXME/XXX/TBD en producción tocada; cero hex nuevo; guard mutation-tested, no placebo |

### Human Verification Required

Ninguno pendiente en este gate. La verificación de PÍXELES real (getComputedStyle en deploy, incluida la no-regresión de ancho de /red y el offset real de scroll-mt vs header 80px) está formalmente diferida a **Phase 81 (BENTO-07 / gate visual, cierra gate 75)** — declarado en los 3 planes y en las capturas README. Las capturas BrowserOS antes/después por ruta ya fueron archivadas y leídas por el orquestador (8+4+8 PNG + README), por lo que este gate no requiere acción humana adicional a nivel de fase 79.

### Notas de discrepancia (no bloqueantes)

- SUMMARY 79-02 reportó suite "870" con un timeout preexistente de `money-antiflip-guard.test.ts`. En HEAD el verificador observó `money-antiflip-guard` verde (20 tests, 201ms) y suite total **885** — el conteo de SUMMARY 03 (885) es el correcto en HEAD; el timeout de 02 no se reproduce y no afecta el gate.

### Gaps Summary

Sin gaps. El objetivo de fase se cumple observablemente en el código: las 8 rutas interiores comparten el contenedor 1120px de la home y las tarjetas de primer nivel llevan el radio bento, sin re-layout interno (interiores byte-idénticos verificados por ausencia de swaps y por firewall D3 intacto a nivel git y source). /red queda excluido con racional documentado y candado que muerde. Suite 885 verde y tsc limpio.

---

_Verified: 2026-07-15T13:40:00Z_
_Verifier: Claude (gsd-verifier)_
