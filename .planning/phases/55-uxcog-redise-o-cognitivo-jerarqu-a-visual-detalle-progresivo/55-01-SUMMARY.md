---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
plan: 01
subsystem: frontend-ui
tags: [ui, tokens, tailwind-v4, radix, scrollspy, progressive-disclosure, no-leak]
requires:
  - "@radix-ui/react-accordion (ya instalado, F45)"
  - "civic-tokens.css / globals.css @theme inline (patrón identity-warn 54-04)"
provides:
  - "token --accent-product-soft → utilidad plana bg-accent-product-soft"
  - "hook useScrollspy(ids) → id activo (IntersectionObserver, cero deps)"
  - "isla DetalleColapsable (disclosure inverso, default cerrado, forceMount)"
  - "isla FichaRail genérica (header slot + navEntries + caveat + scrollspy)"
affects:
  - "55-02/55-03 (parlamentario) y 55-04 (proyecto) consumen estas 4 primitivas"
tech-stack:
  added: []
  patterns:
    - "Token @theme inline bare-ref (sin doble-hsl, gotcha 54-04)"
    - "Radix single/collapsible + forceMount (analog carril-accordion F45)"
    - "IntersectionObserver rootMargin -20%/-70% para current-section"
    - "Contrato no-leak F45: islas nunca importan *Section ni @/lib/supabase"
key-files:
  created:
    - app/lib/use-scrollspy.ts
    - app/lib/use-scrollspy.test.ts
    - app/components/detalle-colapsable.tsx
    - app/components/detalle-colapsable.test.tsx
    - app/components/ficha-rail.tsx
    - app/components/ficha-rail.test.tsx
  modified:
    - app/app/styles/civic-tokens.css
    - app/app/globals.css
decisions:
  - "Rail sticky top-6 (24px), NO top-16 (GlobalHeader NO-sticky) — UI-SPEC top-16 SUPERSEDED"
  - "--accent-product-soft con patrón identity-warn (hsl completo en :root/.dark, bare-ref en @theme)"
  - "FichaRail recibe caveat como prop (texto LOCKED lo pasa la página) → reutilizable parlamentario+proyecto"
metrics:
  duration: ~10min
  completed: 2026-07-07
  tasks: 3
  files: 8
---

# Phase 55 Plan 01: Primitivas del rediseño cognitivo Summary

Cuatro primitivas compartidas de la variante B "Informe con rail": token `--accent-product-soft` (utilidad plana Tailwind), hook `useScrollspy` (IntersectionObserver cero-deps), isla `DetalleColapsable` (disclosure que colapsa SOLO el detalle, arranca cerrado, forceMount) e isla genérica `FichaRail` (rail sticky con nav gate-aware, scrollspy-active y caveat 1×). Son los contratos que consumen los planes de superficie 55-02/03/04.

## What Was Built

### Task 1 — Token `--accent-product-soft` + hook `useScrollspy` (`a103085`)
- `civic-tokens.css`: `--accent-product-soft` en `:root` (`hsl(183 30% 93%)`) y `.dark` (`hsl(183 30% 18%)`), ambos con `hsl()` completo.
- `globals.css` `@theme inline`: `--color-accent-product-soft: var(--accent-product-soft);` bare-ref (sin wrapper `hsl()` → evita doble-hsl, gotcha 54-04). Genera la utilidad plana `bg-accent-product-soft`, cero arbitrary values.
- `use-scrollspy.ts`: hook `"use client"` cero-deps; un único `IntersectionObserver` (`rootMargin: "-20% 0px -70% 0px"`, threshold 0), devuelve el id de la sección que cruza el tercio superior; cleanup `obs.disconnect()`. Verbatim de 55-RESEARCH.
- Test: mock de `IntersectionObserver` global capturando el callback; `renderHook` + `act` sobre ids conocidos; 3 asserts (default, intersect, menor-top gana).

### Task 2 — Isla `DetalleColapsable` (TDD, RED `c4812a0` → GREEN `d05db5c`)
- Disclosure INVERSO a `CarrilAccordion`: la capa-1 vive fuera; la isla envuelve SOLO el detalle. `defaultOpen=false` por defecto (`defaultValue` = `undefined`).
- Radix `single`+`collapsible`; trigger `min-h-11` con dos spans data-state driven: "Ver detalle ({n})" ↔ "Ocultar detalle". `Content forceMount` + `data-[state=closed]:hidden` (detalle SSR queda en el DOM).
- Test espejo de `carril-accordion.test.tsx`: default-cerrado + forceMount-en-DOM + toggle + defaultOpen + source-scan no-leak (3 patrones).

### Task 3 — Isla `FichaRail` genérica (TDD, RED `f65c25c` → GREEN `7fab803`)
- `"use client"` genérica (parlamentario + proyecto). Props `{ header, navEntries, caveat }`; `RailEntry = { id, label, count?, marker? }`.
- `useScrollspy(navEntries.map(e => e.id))` marca la entrada activa: `bg-accent-product-soft` + borde izq. petróleo 2px + texto petróleo/600 (petróleo reservado a highlight + diamante).
- `◆` antepuesto en la entrada `marker:"diamante"`. Conteo renderizado tal cual llega (server-side, la isla NUNCA deriva). Caveat 1× al pie. Responsive: `< md` barra superior `overflow-x-auto`; `md:sticky md:top-6`. `min-h-11`, `focus-visible` petróleo.
- Test: 7 asserts (link por entrada, conteo honesto, diamante, caveat 1×, scrollspy-active con `useScrollspy` mockeado, header slot, source-scan no-leak).

## Deviations from Plan

None - plan executed exactly as written. (El único ajuste de implementación fue envolver los disparos del mock `IntersectionObserver` en `act()` para que React flushee el `setState` — detalle de test, no del contrato.)

## Verification

- `cd app && npx vitest run` → **608 tests verdes** (baseline 594; +14 nuevos: 3 scrollspy + 4 detalle + 7 rail). Nunca decrece.
- `pnpm typecheck` (root, `tsc -b`) → limpio.
- `cd app && npx vitest run lib/lockdown-guard.test.ts` → verde (8/8).
- CERO deps nuevas, CERO arbitrary color value (`bg-[hsl(var(`), CERO doble-hsl, `min-h-11` en triggers/links, `sticky top-6` (no top-16).

## TDD Gate Compliance

Task 2 y Task 3 (`tdd="true"`): secuencia RED→GREEN respetada en git log — `test(...)` commit (falla import) seguido de `feat(...)` commit (verde). Task 1 no era TDD-flagged (token + hook con test co-commit).

## Self-Check: PASSED

- app/lib/use-scrollspy.ts — FOUND
- app/lib/use-scrollspy.test.ts — FOUND
- app/components/detalle-colapsable.tsx — FOUND
- app/components/detalle-colapsable.test.tsx — FOUND
- app/components/ficha-rail.tsx — FOUND
- app/components/ficha-rail.test.tsx — FOUND
- commits a103085, c4812a0, d05db5c, f65c25c, 7fab803 — FOUND
