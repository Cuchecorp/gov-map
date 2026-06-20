---
phase: 21-producto-en-vivo-diseno-phase19-directorio-ideas-matrices
plan: 01
subsystem: ui
tags: [frontend, design-tokens, nextjs, tailwind, react, app-router]

# Dependency graph
requires:
  - phase: 19-producto-dise-o-brief-y-cierre-de-dise-o-del-frontend
    provides: DESIGN-SYSTEM.md §1.1 (tokens crema/petróleo LOCKED) + 19-UI-SPEC.md §11.0 (GlobalHeader spec) + landing.html mockup
  - phase: 20-deploy-carga-de-datos-preview-privado-gov-map-com
    provides: sitio EN VIVO (Worker) + layout.tsx con generateMetadata noindex (Phase 20, LOCKED)
provides:
  - "globals.css extendido a la paleta crema/petróleo (sin romper Slate ni civic-tokens)"
  - "--accent-product como token + utilidad Tailwind addressable"
  - "GlobalHeader server-first persistente montado en layout.tsx (nav a Buscar/Parlamentarios/Agenda/Sobre)"
  - "HeaderNav island ('use client') con subrayado de ítem activo vía usePathname"
affects: [21-02-directorio-parlamentarios, 21-03, 21-04-verificacion-visual-e2e, futuras superficies del producto Phase 19]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header server-only + island hijo para el único concern de cliente (usePathname active-state)"
    - "EXTENDER tokens (override de surface/text/border) sin reemplazar el baseline Slate de shadcn"
    - "Token de producto (--accent-product) mapeado como utilidad Tailwind separada, sin pisar --accent"

key-files:
  created:
    - app/components/global-header.tsx
    - app/components/header-nav.tsx
  modified:
    - app/app/globals.css
    - app/tailwind.config.ts
    - app/app/layout.tsx

key-decisions:
  - "GlobalHeader es Server Component; el active-underline (que necesita usePathname, Client-only en Next 16) se aísla en HeaderNav island — el <header> queda server-only"
  - "--accent-product mapeado como utilidad Tailwind (text-/decoration-accent-product) porque bg-background/text-foreground/ring no cubren el subrayado petróleo del ítem activo; NO reemplaza --accent (shadcn lo consume)"
  - "destructive retune incluido (0 72% 42% light / 0 62% 45% dark) per DESIGN-SYSTEM §1.1: producto read-only, token sin uso, bajo riesgo"
  - "Nav sin menú-hamburguesa JS: links siempre visibles con colapso CSS (flex-wrap); el island existe sólo por usePathname, no por un toggle móvil"

patterns-established:
  - "Server header + client island split (espejo de página server + SearchBox island del repo)"
  - "esActivo(pathname, href): activo si exacto o subárbol (href + '/') — soporta /parlamentarios/D123"

requirements-completed: [SC1, SC4]

# Metrics
duration: 8min
completed: 2026-06-20
---

# Phase 21 Plan 01: Wiring del diseño Phase 19 (tokens crema/petróleo + GlobalHeader) Summary

**Tokens de globals.css extendidos a crema hsl(40 33% 97%) + petróleo --accent-product hsl(183 38% 26%) sobre el baseline Slate, y un GlobalHeader server-first persistente (wordmark + nav a Buscar/Parlamentarios/Agenda/Sobre) montado en layout.tsx, con un island HeaderNav que subraya el ítem activo vía usePathname.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20T18:49:00Z (approx)
- **Completed:** 2026-06-20T18:57:14Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `globals.css` extendido VERBATIM a la paleta crema/petróleo (DESIGN-SYSTEM §1.1, LOCKED): override de `--background`/`--card`/`--muted`/`--muted-foreground`/`--border`/`--foreground` + retune `--ring` + nueva `--accent-product`, en `:root` y `.dark`. Baseline Slate (`--primary`/`--secondary`/`--radius`/`--popover`/`--input`) intacto.
- `civic-tokens.css` confirmado INTACTO (git diff vacío) — los colores Cámara/Senado de identidad de dato no cambian.
- `--accent-product` mapeado como utilidad Tailwind addressable para el subrayado petróleo del header.
- `GlobalHeader` server-first creado y montado en `layout.tsx` antes de `{children}`, persistente en todas las rutas, con nav a `/buscar`, `/parlamentarios`, `/agenda`, `/sobre` (touch targets ≥44px, sin auth, sin foto, sin partido).
- `HeaderNav` island (`"use client"`) aísla el único concern de cliente: el active-underline vía `usePathname` (Client-only en Next 16).
- `generateMetadata` (toggle noindex Phase 20) y el shell `<html>` quedan sin cambios (diff de layout.tsx = solo import + render del header).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extender los tokens de diseño en globals.css (crema + petróleo)** - `e91e92f` (feat)
2. **Task 2: Crear GlobalHeader server-first y montarlo en layout.tsx** - `734e991` (feat)

**Plan metadata:** (este commit de docs)

## Files Created/Modified

- `app/app/globals.css` - Tokens crema/petróleo extendidos sobre el baseline Slate (`:root` + `.dark`); `--accent-product` añadido; `@import` de civic-tokens intacto.
- `app/tailwind.config.ts` - `accent-product` mapeado como color utility (`hsl(var(--accent-product))`) para el subrayado del ítem activo.
- `app/components/global-header.tsx` - Server Component `<header>` (wordmark→/, fondo crema, `border-b`, ~56px, `px-4 md:px-8`) que renderiza `<HeaderNav/>`.
- `app/components/header-nav.tsx` - Island `"use client"` con los 4 `<Link>`s y el subrayado petróleo del ítem activo derivado de `usePathname`.
- `app/app/layout.tsx` - Import + render de `<GlobalHeader/>` dentro de `<body>` antes de `{children}`; `generateMetadata` sin tocar.

## Decisions Made

- **GlobalHeader server + HeaderNav island:** el header se mantiene Server Component (sin `"use client"` en la primera línea, per acceptance criteria). El subrayado del ítem activo requiere `usePathname`, que Next 16 expone SOLO en Client Components (confirmado en `node_modules/next/dist/docs/.../use-pathname.md`: "Reading the current URL from a Server Component is not supported"). Se aísla en un sub-árbol `"use client"` hijo, mismo split server-page + island del repo.
- **`--accent-product` como utilidad Tailwind separada:** se mapeó porque `bg-background`/`text-foreground`/`ring` no cubren el subrayado petróleo; se mantiene aparte de `--accent` (que shadcn consume), sin hardcodear hex.
- **Sin menú-hamburguesa JS:** los links siempre son visibles y colapsan por CSS (`flex-wrap`); el island existe únicamente por `usePathname`, no por un toggle móvil — solución sin JS preferida per el plan.
- **destructive retune incluido:** opcional y de bajo riesgo per DESIGN-SYSTEM §1.1 (producto read-only, token sin uso).

## Deviations from Plan

None - plan executed exactly as written.

(Nota: la creación de `app/tailwind.config.ts` con el mapping de `accent-product` está explícitamente contemplada por el `<action>` de Task 1 — "Mapear `--accent-product` como utilidad Tailwind addressable si `tailwind.config.ts` lo requiere para el header" — no es una desviación.)

## Issues Encountered

- **`tsc --noEmit` reporta 2 errores en `app/lib/buscar.test.ts:156`** (`TS2532` + `TS2493`). PRE-EXISTENTES y FUERA DE ALCANCE: ese archivo fue tocado por última vez en Phase 16 (commit `8a6d028`), no por este plan. Cero errores de tipo en cualquier archivo de 21-01 (verificado por grep sobre la salida de tsc). Registrado en `deferred-items.md` per la regla de SCOPE BOUNDARY; no se corrige aquí.

## Threat Surface

- `T-21-01-01` (Information Disclosure, global-header/header-nav): mitigado — ambos componentes sólo renderizan `<Link>`s estáticos y estado de UI local; el island no recibe props sensibles (sin env/keys).
- Sin nueva superficie de seguridad fuera del threat model del plan.

## User Setup Required

None - no external service configuration required. (La verificación visual e2e en producción vs mockup ocurre en el plan 21-04, no requiere setup aquí.)

## Next Phase Readiness

- El producto EN VIVO ahora renderiza la paleta Phase 19 y tiene navegación global persistente — habilita el descubrimiento del directorio `/parlamentarios` (plan 21-02) y de `/buscar` desde cualquier ruta.
- `--accent-product` disponible como utilidad Tailwind para futuras superficies del producto.
- Pendiente (planes posteriores de Phase 21): RPC `0026` + ruta `/parlamentarios` (21-02), wiring `link_mensaje_mocion` (SC3), verificación visual e2e (21-04). Las rutas `/agenda` y `/sobre` referenciadas por la nav deben existir/crearse en planes posteriores (los Links son honestos: apuntan a las superficies del producto Phase 19).

## Self-Check: PASSED

- Files: global-header.tsx, header-nav.tsx, globals.css, tailwind.config.ts, layout.tsx — all FOUND.
- Commits: `e91e92f`, `734e991` — both FOUND in git log.
- civic-tokens.css: git diff VACÍO (intacto).
- tsc: cero errores nuevos en archivos de 21-01 (2 errores pre-existentes en buscar.test.ts deferred).

---
*Phase: 21-producto-en-vivo-diseno-phase19-directorio-ideas-matrices*
*Completed: 2026-06-20*
