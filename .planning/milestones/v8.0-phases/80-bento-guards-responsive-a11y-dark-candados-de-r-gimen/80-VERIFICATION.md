---
phase: 80-bento-guards-responsive-a11y-dark-candados-de-r-gimen
verified: 2026-07-15T18:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Contraste AA real (≥4.5:1 body en tile accent) y contraste ≥3:1 de la barra cívica dark confirmados por medición visual"
    addressed_in: "Phase 81"
    evidence: "Phase 81 goal: 'Bento EN VIVO, verificado visualmente contra el mockup' + BENTO-07 (verificación visual BrowserOS). jsdom no computa contraste; tokens dark marcados PROVISIONALES pendientes de 81 en civic-tokens.css."
  - truth: "Sticky header verificado en móvil (CSS 390px inyectado, gotcha BrowserOS)"
    addressed_in: "Phase 81"
    evidence: "SC#1 sub-item de verificación visual móvil; Phase 81 = deploy + verificación visual BrowserOS (BENTO-07)."
---

# Phase 80: BENTO-GUARDS — Responsive + a11y + dark + candados de régimen — Verification Report

**Phase Goal:** El bento no se degrada en móvil, en dark, ni con el tiempo.
**Verified:** 2026-07-15T18:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

Verificación goal-backward, code-level sobre master HEAD (commits `32d34a7`, `7ddf021`, `2d575a8`, `f6be820` presentes; working tree limpio). Todos los checks corridos por el verificador, NO confiando en SUMMARY.

### Observable Truths

| # | Truth (roadmap SC + plan must-haves) | Status | Evidence |
|---|---|---|---|
| 1 | ≤md el grid colapsa a 1 columna con orden DOM fijo; landmarks (un main, secciones con heading); aria-label del form | ✓ VERIFIED | `page.test.tsx:270-381` describe BENTO-05: (a) grid `.grid-cols-1.md:grid-cols-6` + assert ningún `col-span` sin prefijo `md:`; (b) orden DOM vía hrefs LOCKED `/sobre`<`/buscar`<`/parlamentarios`<`/agenda` + `compareDocumentPosition` h1→/sobre; (c) `querySelectorAll("main")` length 1 + nav aria-label; (e) section hero con h1 + h2 "¿Cómo leer esto?". Suite corrida: 909/909 verde |
| 2 | A11y: aria-label form búsqueda; focus-visible + touch target 44px en tiles-link; contraste AA accent por tokens+test | ✓ VERIFIED | `search-box.tsx:91` `aria-label="Buscar proyectos de ley"` en `<form role="search">`; `page.test.tsx:351` `getByRole("search",{name:/buscar/i})`. `bento-tile.tsx:24` `focus-visible:ring-2 ... min-h-11`; `bento-tile.test.tsx:83-91` asserts. Accent: `bento-tile.tsx:30` `text-accent-product-foreground` (doc ≥7:1) + `bento-tile.test.tsx:45-48` assert token |
| 3 | Dark: barra cívica theme-aware; par dark `.dark` de --camara/--senado con `hsl()` wrapper (NO triplet crudo); marcado provisional-81 | ✓ VERIFIED | `civic-tokens.css:46-47` `--camara: hsl(213 90% 62%); --senado: hsl(355 70% 62%);` en bloque `.dark` — wrapper `hsl()` conservado literalmente; comentario 37-45 marca PROVISIONAL pendiente Phase 81 y "NO se afirma cumplimiento WCAG". Consumidor `actualidad-module.tsx:170-173` `bg-[var(--camara)]`/`bg-[var(--senado)]` |
| 4 | Candados: cero-hex (5 superficies) + tipografía whitelist (13) con mutation self-check REAL; brand-icon default currentColor | ✓ VERIFIED | `bento-guards.test.ts` (19 tests verde): cero-hex escanea 5 superficies incl. `brand-icon.tsx`; whitelist tipográfica 13 valores. Mutation self-check REAL confirmado por probe en vivo: detector caza `#2A5859` mutado, ignora hex-en-comentario ([]), caza `text-[17px]` ad-hoc, permite `text-[13px]` sancionado + `[var(--radius-tile)]`. `brand-icon.tsx:23` `color = "currentColor"`, cero hex en el archivo (incl. JSDoc) |
| 5 | Linter anti-insinuación cubre copy home (SUPERFICIES_HOME); suite verde (~840+) + tsc limpio | ✓ VERIFIED | `anti-insinuacion-guard.test.ts:138-141` `SUPERFICIES_HOME=[app/page.tsx, components/actualidad-module.tsx]`; línea 294 bucle `[...SUPERFICIES_VOTO,...SUPERFICIES_MONEY,...SUPERFICIES_HOME]` — WIRED. 18 tests verde. Suite completa 909/909 verde (verificador la corrió); `tsc --noEmit` exit 0 |

**Score:** 5/5 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Contraste AA real medido (accent body ≥4.5:1) + ratio ≥3:1 barra cívica dark | Phase 81 | Phase 81 goal = verificación visual BrowserOS; jsdom no computa contraste; tokens dark PROVISIONALES documentados en civic-tokens.css |
| 2 | Sticky header en móvil (CSS 390px, BrowserOS) | Phase 81 | Sub-item visual de SC#1; Phase 81 = deploy + verificación visual (BENTO-07) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `app/components/search-box.tsx` | aria-label en form role=search | ✓ VERIFIED | línea 91, wired al test (d) |
| `app/components/brand-icon.tsx` | default currentColor, sin hex | ✓ VERIFIED | línea 23; grep `#2A5859` = 0 en el archivo; cubierto por guard cero-hex |
| `app/app/styles/civic-tokens.css` | par dark --camara/--senado con hsl() | ✓ VERIFIED | líneas 46-47, wrapper conservado, comentario provisional-81 |
| `app/app/page.test.tsx` | asserts colapso/orden/landmarks/form | ✓ VERIFIED | describe BENTO-05 líneas 270-381, 5 grupos de asserts, pasa |
| `app/components/actualidad-module.tsx` | barra cívica usa civic tokens | ✓ VERIFIED | líneas 170-173, `bg-[var(--camara)]`/`bg-[var(--senado)]` |
| `app/lib/bento-guards.test.ts` | 2 guards + detector puro + mutation self-check | ✓ VERIFIED | creado, 320 líneas, 19 tests, mordida probada en vivo |
| `app/lib/anti-insinuacion-guard.test.ts` | SUPERFICIES_HOME en bucle de scan | ✓ VERIFIED | línea 138 def + línea 294 wired al loop |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `page.test.tsx` | `page.tsx (Home)` | `render(<Home/>)` + getByRole/querySelectorAll | ✓ WIRED |
| `actualidad-module.tsx` | `civic-tokens.css --camara/--senado` | `bg-[var(--camara)]/bg-[var(--senado)]` barra 3px | ✓ WIRED |
| `bento-guards.test.ts` | bento surfaces + brand-icon.tsx | `readFileSync + process.cwd()` detector puro | ✓ WIRED |
| `anti-insinuacion-guard.test.ts` | `page.tsx + actualidad-module.tsx` | `...SUPERFICIES_HOME` en el bucle | ✓ WIRED (línea 294) |

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Suite fase (guards + linter + page) | `pnpm test -- --run bento-guards anti-insinuacion page.test` | 79 files / 909 tests passed | ✓ PASS |
| TypeScript type check | `pnpm exec tsc --noEmit` | exit 0, sin output | ✓ PASS |
| Mutation self-check cero-hex muerde | node probe: `detectarHexHardcodeado("#2A5859")` | `['#2A5859']`; comentario→`[]` | ✓ PASS |
| Mutation self-check tipografía muerde | node probe: `text-[17px]`→offender; `text-[13px]`/`var(--)`→[] | correcto | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| BENTO-05 | 80-01 | Responsive (colapso ≤md), a11y (focus/contraste/44px/landmarks), par dark | ✓ SATISFIED | Truths 1-3; visual de contraste diferido a 81 (jsdom-limit) |
| BENTO-06 | 80-02 | Candados verdes y mordiendo (cero-hex + tipografía + anti-insinuación home) | ✓ SATISFIED | Truths 4-5; mordida probada en vivo |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | Ningún debt-marker (TBD/FIXME/XXX) sin referencia en archivos modificados | ℹ️ Info | Valores dark provisionales están documentados como diferidos a Phase 81 (no son stubs bloqueantes); guards no son no-ops (mordida verificada) |

### Human Verification Required

Ninguna requerida para cerrar Phase 80. Los ítems visuales (contraste AA medido, sticky header móvil, paridad mockup) son el objeto explícito de Phase 81 (BENTO-07, verificación visual BrowserOS) y NO gatean la meta de Phase 80 ("no se degrada" a nivel estructural/token/candado), que es verificable code-level y está verificada.

### Gaps Summary

Sin gaps. La meta de Phase 80 — el bento no se degrada en móvil (colapso ≤md fijado por test), en dark (par dark con hsl() wrapper), ni con el tiempo (3 candados de régimen con mutation self-check REAL) — está lograda a nivel de código. Los 5 success criteria del roadmap se satisfacen; los aspectos que jsdom no puede medir (ratio de contraste, sticky en 390px) están correctamente diferidos a Phase 81 por diseño y documentados como provisionales, sin afirmar cumplimiento WCAG. Suite 909/909 verde y tsc limpio confirmados por el verificador (no por SUMMARY).

---

_Verified: 2026-07-15T18:35:00Z_
_Verifier: Claude (gsd-verifier)_
