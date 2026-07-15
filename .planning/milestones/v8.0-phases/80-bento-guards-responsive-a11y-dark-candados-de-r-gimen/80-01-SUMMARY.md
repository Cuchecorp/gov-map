---
phase: 80-bento-guards-responsive-a11y-dark-candados-de-r-gimen
plan: 01
subsystem: ui
tags: [a11y, aria, dark-mode, css-tokens, bento, responsive, testing, vitest, rtl]

requires:
  - phase: 77-78-bento-layout
    provides: SearchBox, BrandIcon, ActualidadModule, BentoGrid, page.tsx composition
  - phase: 76-bento-tile
    provides: BentoTile span system (md:col-span-N classes)

provides:
  - aria-label en form role=search de SearchBox (BENTO-05 Pitfall 2)
  - BrandIcon con default currentColor (sin hex literal, deuda 77-UI-REVIEW resuelta)
  - Par dark de --camara/--senado con hsl() wrapper conservado en civic-tokens.css (PROVISIONAL pendiente Phase 81)
  - describe BENTO-05 en page.test.tsx: 5 asserts estructurales jsdom-safe de colapso/orden/landmarks/form

affects:
  - 80-02-PLAN (guard cero-hex ahora cubre brand-icon.tsx — el default hex fue eliminado, candado puede correr verde)
  - Phase 81 (verificación visual de contraste dark ≥3:1 de la barra cívica; valores provisionales documentados)

tech-stack:
  added: []
  patterns:
    - "civic-tokens.css: par dark siempre con hsl() wrapper horneado en el valor (consumidor usa bg-[var(--token)] sin hsl())"
    - "Tests estructurales de colapso: asertar clases (toHaveClass) NUNCA píxeles (getComputedStyle=0 en jsdom)"
    - "Orden DOM de tiles ancla a hrefs LOCKED (compareDocumentPosition) cuando componentes async están mockeados a null"
    - "form role=search + aria-label da nombre único al landmark search (ARIA authoring practice)"

key-files:
  created: []
  modified:
    - app/components/search-box.tsx
    - app/components/brand-icon.tsx
    - app/app/styles/civic-tokens.css
    - app/app/page.test.tsx

key-decisions:
  - "Decisión dark barra cívica: añadir par --camara/--senado en .dark con hsl() wrapper conservado (213 90% 62% / 355 70% 62%), mismos hues que light con L elevada para fondo oscuro. Valores PROVISIONALES — ratio real ≥3:1 (WCAG 1.4.11) pendiente de verificación visual en Phase 81 (BrowserOS). NO se afirma cumplimiento WCAG en esta ola."
  - "BrandIcon default → currentColor: seguro porque ambos callers (page.tsx y global-header.tsx) pasan color explícito. Eliminar hex de JSDoc también alinea con disciplina cero-hex del milestone."
  - "Tests de actualidad mockeada a null: (b) orden DOM ancla a hrefs LOCKED vía compareDocumentPosition; (e) asertan secciones presentes en page.tsx (hero section, /sobre h2) — NO los headings de los componentes mockeados. Documentado en comentario del test."

patterns-established:
  - "Patrón civic token dark: hsl() horneado en el valor, NUNCA triplet crudo — el consumidor usa bg-[var(--token)] sin envolver."
  - "Test de colapso jsdom: querySelectorAll('[class*=col-span]') + regex para descartar md:col-span-N válidos."

requirements-completed: [BENTO-05]

duration: 25min
completed: 2026-07-15
---

# Phase 80 Plan 01: A11y + dark fixes + test estructural de home

**aria-label en SearchBox, BrandIcon→currentColor, par dark cívico provisional, y 5 asserts BENTO-05 jsdom-safe que fijan colapso/orden/landmarks/form de la home**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-15T17:14:00Z
- **Completed:** 2026-07-15T17:39:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- SearchBox: `aria-label="Buscar proyectos de ley"` en el `<form role="search">` — el landmark search ahora tiene nombre único (BENTO-05 Pitfall 2 resuelto).
- BrandIcon: default `color` cambiado de `"#2A5859"` a `"currentColor"` y JSDoc actualizado sin mencionar el hex (deuda 77-UI-REVIEW resuelta; el archivo queda sin literales hex, listo para el guard cero-hex de 80-02).
- civic-tokens.css: par `.dark` para `--camara`/`--senado` con valores `hsl(213 90% 62%)` / `hsl(355 70% 62%)`, hsl() wrapper conservado — la barra cívica 3px de `actualidad-module.tsx` ahora tiene colores en dark mode. Valores marcados como PROVISIONALES pendientes de Phase 81.
- page.test.tsx: describe-block "BENTO-05 — colapso/orden/landmarks (estructural, jsdom-safe)" con 5 asserts nuevos. Suite: 885 → 890 tests, todos verdes. tsc limpio.

## Task Commits

1. **Task 1: A11y + candado fixes** - `32d34a7` (fix)
2. **Task 2: Test estructural de home BENTO-05** - `7ddf021` (test)

**Plan metadata:** ver commit de docs a continuación

## Files Created/Modified

- `app/components/search-box.tsx` — añade `aria-label="Buscar proyectos de ley"` al `<form role="search">`
- `app/components/brand-icon.tsx` — default color `"#2A5859"` → `"currentColor"`; JSDoc actualizado sin hex
- `app/app/styles/civic-tokens.css` — bloque `.dark` con `--camara: hsl(213 90% 62%)` y `--senado: hsl(355 70% 62%)` + comentario PROVISIONAL
- `app/app/page.test.tsx` — describe BENTO-05 con 5 asserts estructurales jsdom-safe

## Decisions Made

**Decisión de dark para la barra cívica (BENTO-05, Pitfall 1 — A1):**

La barra cívica 3px de `actualidad-module.tsx` usaba `bg-[var(--camara)]`/`bg-[var(--senado)]`, cuyos tokens NO tenían par `.dark` en `civic-tokens.css` (solo `--camara-muted`/`--senado-muted` sí lo tenían). Decisión conservadora: añadir el par dark con los MISMOS hues 213/355, L elevada (62%) para separarse del fondo dark card (222 24% 12%).

CRÍTICO conservado: los civic tokens de este archivo llevan el `hsl()` HORNEADO en el valor (`--camara: hsl(213 94% 38%)`), y los consumidores usan `bg-[var(--camara)]` sin envolver en hsl(). El par dark conserva exactamente el mismo patrón: `--camara: hsl(213 90% 62%)` — nunca triplet crudo.

Consumidores de `--camara`/`--senado` inspeccionados (grep `var\(--camara\)|var\(--senado\)`): único consumidor confirmado es `actualidad-module.tsx` (la barra 3px). El par dark mejora la coherencia sin regresar ningún otro consumidor identificado.

Los valores son PROVISIONALES: jsdom no computa contraste, el ratio real ≥3:1 (WCAG 1.4.11 non-text) queda pendiente de verificación visual en Phase 81 (BrowserOS). El comentario CSS y este SUMMARY lo documentan explícitamente. NO se afirma cumplimiento WCAG.

**Vía elegida para (b) y (e) del test estructural:**

`VotadoEstaSemana`/`UrgenciasVigentes`/`UltimaActualizacion` están mockeados a `() => null` en `page.test.tsx`. Los `<h2>` internos de actualidad NO renderizan en jsdom. Los wrappers `<Suspense>` de React no producen elementos DOM. Por tanto:

- **(b) orden DOM**: ancla a hrefs LOCKED (`/sobre` → `/buscar` → `/parlamentarios` → `/agenda`) vía `compareDocumentPosition` para verificar que el h1 del hero precede al link `/sobre`. El orden de los tiles de actualidad está garantizado por posición en el JSX de page.tsx (orden DOM = orden visual al colapsar) y se documenta en comentario del test.
- **(e) secciones**: asertan la `<section>` hero (BentoTile asChild con h1) y el tile `/sobre` con h2 "¿Cómo leer esto?" — ambos en page.tsx, no mockeados. Los headings de actualidad se documentan como NO asequibles bajo los mocks actuales.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — plan 80-01 no introduce stubs; los valores dark de civic-tokens.css son provisionales por diseño (documentados como pendientes de Phase 81, no como stubs que bloqueen el objetivo del plan).

## Threat Flags

None — no se introducen nuevas superficies de red, auth paths, ni acceso a datos. Cambios son presentación/a11y/tests únicamente.

## Self-Check: PASSED

- `app/components/search-box.tsx` — FOUND (aria-label en form)
- `app/components/brand-icon.tsx` — FOUND (currentColor, sin #2A5859)
- `app/app/styles/civic-tokens.css` — FOUND (par dark --camara/--senado con hsl())
- `app/app/page.test.tsx` — FOUND (describe BENTO-05, 5 asserts)
- Commit `32d34a7` — FOUND
- Commit `7ddf021` — FOUND
- Suite: 890 tests passed (base 885 + 5 nuevos)
- tsc: limpio

## Next Phase Readiness

- Plan 80-02 (guard cero-hex / candados de régimen): puede correr inmediatamente. `brand-icon.tsx` ya no tiene hex literal — el guard cero-hex que cubre este archivo quedará verde.
- Phase 81 (verificación visual): la barra cívica dark tiene valores provisionales documentados; Phase 81 debe verificar contraste ≥3:1 en BrowserOS y ajustar si el ratio no se cumple.

---
*Phase: 80-bento-guards-responsive-a11y-dark-candados-de-r-gimen*
*Completed: 2026-07-15*
