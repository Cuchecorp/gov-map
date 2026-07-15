---
phase: "82"
plan: "01"
subsystem: "frontend/home"
tags: [copy, mockup, anti-insinuacion, hero, accent-tile, actualidad]
dependency_graph:
  requires: [77-02, 78-01, 80-01]
  provides: [DEMO-01]
  affects: [app/app/page.tsx, app/components/search-box.tsx, app/components/actualidad-module.tsx]
tech_stack:
  added: []
  patterns: [verbatim-mockup-copy, linter-safe-variant]
key_files:
  modified:
    - app/app/page.tsx
    - app/components/search-box.tsx
    - app/components/actualidad-module.tsx
    - app/app/page.test.tsx
    - app/components/search-box.test.tsx
    - app/components/actualidad-module.test.tsx
decisions:
  - "h1 del mockup adoptado verbatim: 'Busca cualquier proyecto de ley por tema o número de boletín' (anula h1 Phase 77-02)"
  - "Cursiva 'Con la fuente a la vista.', subtítulo y trust line retirados del hero (no presentes en mockup; trust line conservada en footer)"
  - "Botón hero: 'Buscar proyectos' → 'Buscar'; aria-label del form intacto ('Buscar proyectos de ley')"
  - "Accent tile: 'Segunda frase del mockup' era PROHIBIDA por linter; variante linter-safe adoptada: 'La coincidencia temporal no implica relación: analiza cada dato con cuidado.'"
  - "Actualidad: 'Ver fuente oficial ↗' → 'Fuente ↗' (texto del mockup)"
metrics:
  duration: "~8 min"
  completed: "2026-07-15"
  tasks_completed: 1
  files_changed: 6
---

# Phase 82 Plan 01: DEMO-COPY Textos del mockup en la home — Summary

Textos del mockup adoptados en la home verbatim según decisión del operador (2026-07-15), sin tocar layout/clases. Suite 918 verde, tsc limpio, anti-insinuación verde.

## What Was Built

- **Hero (page.tsx):** h1 nuevo del mockup. Cursiva `<em>`, párrafo subtítulo y trust line del hero retirados. Margen ajustado de `mt-10` a `mt-8` para compensar el espacio liberado.
- **SearchBox (search-box.tsx):** Botón hero: `"Buscar proyectos"` → `"Buscar"`. Placeholder hero actualizado al texto del mockup. `aria-label` del `<form>` intacto.
- **Accent tile (page.tsx):** Primera frase del mockup adoptada. Segunda frase del mockup era bloqueada por linter ("correlaciones"); variante linter-safe: `"La coincidencia temporal no implica relación: analiza cada dato con cuidado."` — verificada contra los 201 términos del guard, cero hits.
- **Actualidad (actualidad-module.tsx):** Label enlace: `"Ver fuente oficial ↗"` → `"Fuente ↗"`.
- **Tests:** page.test.tsx, search-box.test.tsx, actualidad-module.test.tsx actualizados al nuevo copy LOCKED. Decisión operador anotada en comentarios.

## Deviations from Plan

None — plan ejecutado exactamente como especificado.

## Verification

- Suite: 918/918 tests verde (sin regresiones)
- tsc: limpio (0 errores)
- Anti-insinuación guard (`lib/anti-insinuacion-guard.test.ts`): 18/18 verde — incluye SUPERFICIES_HOME que escanea `app/page.tsx` y `components/actualidad-module.tsx`
- Variante linter-safe del tile verde verificada: "La coincidencia temporal no implica relación" no contiene ningún término de los 201 prohibidos

## Self-Check: PASSED

- `app/app/page.tsx`: modificado (confirmado)
- `app/components/search-box.tsx`: modificado (confirmado)
- `app/components/actualidad-module.tsx`: modificado (confirmado)
- Commit `fcf2287` existe en git log
