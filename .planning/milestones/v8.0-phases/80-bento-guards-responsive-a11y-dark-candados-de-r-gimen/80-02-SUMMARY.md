---
phase: 80-bento-guards-responsive-a11y-dark-candados-de-r-gimen
plan: 02
subsystem: ui
tags: [guards, testing, vitest, bento, design-tokens, anti-insinuacion, a11y]

requires:
  - phase: 80-01
    provides: brand-icon.tsx con currentColor (sin hex), civic-tokens.css dark, aria-label SearchBox

provides:
  - candado cero-hex sobre superficies bento incl. brand-icon.tsx (BENTO-06)
  - guard tipográfico con whitelist dura de 13 off-steps sancionados (BENTO-06)
  - linter anti-insinuación extendido a SUPERFICIES_HOME (page.tsx + actualidad-module.tsx)

affects:
  - Phase 81 (verificación visual): los guards validan source-level; el gate visual de contraste sigue pendiente en 81

tech-stack:
  added: []
  patterns:
    - "Guard source-scan: detector puro (fn sobre string en memoria) + describe (A) archivos reales + describe (B) mutation self-check — molde bento-coherencia-guard"
    - "stripTsComments reusado verbatim de anti-insinuacion-guard (WR-05): evita falsos positivos por hex/términos en JSDoc/comentarios"
    - "Whitelist dura documentada con razón por entrada (patrón DEBT-05): off-steps intencionales del mockup, no magic numbers"

key-files:
  created:
    - app/lib/bento-guards.test.ts
  modified:
    - app/lib/anti-insinuacion-guard.test.ts

key-decisions:
  - "brand-icon.tsx entra SOLO en el scan cero-hex, NO en el tipográfico: el SVG usa width/height como props numéricas JSX (no utilidades Tailwind), no genera ruido tipográfico ni aporta cobertura real en ese guard."
  - "Whitelist de 13 arbitrary values sancionados (enumeración exacta del research §Pattern 2): text-[11px]/[13px]/[15px], tracking-[0.08em], gap-[14px], gap-x-[22px], px-[9px], py-[18px], w-[3px], rounded-[2px], h-[52px], w-[1120px], max-w-[1120px]. [var(--…)] siempre permitido (tokens, no magic numbers)."
  - "SUPERFICIES_HOME=['app/page.tsx','components/actualidad-module.tsx'] añadido al bucle [...SUPERFICIES_VOTO,...SUPERFICIES_MONEY,...SUPERFICIES_HOME] sin duplicar el detector de 201 términos ni el mutation self-check existente."

metrics:
  duration: 18min
  completed: 2026-07-15
---

# Phase 80 Plan 02: Candados de régimen bento (BENTO-06)

**Guard cero-hex (incl. brand-icon.tsx) + guard tipográfico whitelisted + linter anti-insinuación extendido a home — los 3 verdes sobre archivos reales y mordiendo por mutation self-check**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-15T17:45:00Z
- **Completed:** 2026-07-15T18:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 creado, 1 extendido in-place)

## Accomplishments

- `app/lib/bento-guards.test.ts` creado (319 líneas): 2 guards con detector puro y mutation self-check.
  - Guard cero-hex: escanea 5 superficies (bento-grid, bento-tile, page.tsx, actualidad-module, brand-icon). 0 offenders sobre archivos reales. brand-icon.tsx protegido: el fix currentColor de 80-01 queda custodiado.
  - Guard tipográfico: whitelist dura de 13 off-steps sancionados; [var(--…)] siempre permitido. 0 offenders sobre 4 superficies (sin brand-icon, ver decisión). mutation self-check demuestra mordida ante text-[17px], gap-[99px], text-[12px] ad-hoc.
- `app/lib/anti-insinuacion-guard.test.ts` extendido: SUPERFICIES_HOME añadida; bucle escanea ahora `[...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME]`. Copy de home verde inmediato (A2 confirmado: fórmula /sobre sin idioms prohibidos).
- Suite: 890 (base post-80-01) → 909 tests, todos verdes. tsc limpio.

## Task Commits

1. **Task 1: bento-guards.test.ts** - `2d575a8` (test)
2. **Task 2: SUPERFICIES_HOME en anti-insinuacion-guard** - `f6be820` (test)

## Files Created/Modified

- `app/lib/bento-guards.test.ts` — creado (2 guards: cero-hex + tipografía; detector puro + archivos reales + mutation self-check por guard)
- `app/lib/anti-insinuacion-guard.test.ts` — SUPERFICIES_HOME añadido + bucle extendido a `[...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME]`

## Arbitrary Values — Reconciliación de Whitelist

La whitelist de 13 valores coincide exactamente con la enumeración del research §Pattern 2 (grep previo). No se encontraron valores reales que difieran de la tabla. El paso "(A) 0 offenders" verde sobre los archivos reales confirma la reconciliación.

Nota: `h-[52px]` y `w-[1120px]` de la whitelist aparecen en `components/search-box.tsx` y `app/layout.tsx` respectivamente — archivos que NO están en las superficies escaneadas por el guard tipográfico (el guard escanea solo las superficies bento enumeradas). Se incluyen en la whitelist como documentación de los off-steps del diseño, aunque el scan actual no los ejercita directamente. Si se añaden search-box o layout al scope del guard en una fase futura, ya están cubiertos.

## Scope brand-icon.tsx

`brand-icon.tsx` está en el scan **cero-hex únicamente**. Razón: el SVG usa `width`/`height` como props JSX numéricas y `stroke`/`fill` como atributos SVG, no utilidades Tailwind `(text|gap|…)-[…]`. El regex del guard tipográfico no los captura, así que no genera ruido, pero tampoco aporta cobertura real en ese guard. La protección relevante para brand-icon es el candado cero-hex que custodia el fix `currentColor` de 80-01.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — cambios son tests únicamente; cero superficies de red, auth, datos.

## Self-Check: PASSED

- `app/lib/bento-guards.test.ts` — FOUND (319 líneas, 2 guards, detectarHexHardcodeado presente)
- `app/lib/anti-insinuacion-guard.test.ts` — FOUND (SUPERFICIES_HOME en el bucle de scan)
- Commit `2d575a8` — FOUND
- Commit `f6be820` — FOUND
- Suite: 909 tests passed (890 base + 19 nuevos)
- tsc: limpio
