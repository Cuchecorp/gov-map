---
phase: 53-uxnav-auditoria-ux-navegada
plan: 03
subsystem: frontend-navegacion
tags: [breadcrumbs, orientacion, server-component, ux-01, anti-insinuacion]
requires:
  - "53-01 (nav global: patrón HeaderNav + active-state — contexto de orientación)"
provides:
  - "Breadcrumbs: Server Component presentacional puro (props literales, cero JS)"
  - "Breadcrumb montado en las 3 fichas (proyecto, parlamentario, contraparte)"
  - "HeaderSection exportada de /parlamentario/[id] para RTL por comportamiento"
affects:
  - "app/app/proyecto/[boletin]/page.tsx"
  - "app/app/parlamentario/[id]/page.tsx"
  - "app/components/parlamentario-header.tsx"
  - "app/app/contraparte/[id]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Breadcrumb server-only con crumbs literales por página (sin usePathname)"
    - "Separador glifo Unicode / aria-hidden (cero dependencia: sin shadcn breadcrumb/lucide)"
    - "Crumb con nombre desde RPC cacheado (React.cache F52 → cero RPC extra)"
key-files:
  created:
    - "app/components/breadcrumbs.tsx"
    - "app/components/breadcrumbs.test.tsx"
  modified:
    - "app/app/proyecto/[boletin]/page.tsx"
    - "app/app/contraparte/[id]/page.tsx"
    - "app/components/parlamentario-header.tsx"
    - "app/app/parlamentario/[id]/page.tsx"
    - "app/app/parlamentario/[id]/page.test.tsx"
decisions:
  - "Breadcrumb de contraparte montado DENTRO de HeaderSection (donde el nombre existe tras el RPC), no en el body del main — sigue DESPUÉS del gate MONEY notFound() (page-level, primera sentencia): cero fuga de existencia"
  - "Breadcrumb de parlamentario DENTRO de parlamentario-header.tsx (tiene parlamentario.nombre del RPC cacheado): cero RPC extra vs. pasar el nombre por props"
  - "HeaderSection exportada de la page (named export ignorado por el router, espejo de CarrilesSection) para probar el path RPC→header→breadcrumb por comportamiento"
metrics:
  duration: "~6 min"
  completed: "2026-07-07"
  tasks: 3
  files_created: 2
  files_modified: 5
  tests_added: 8
  suite_total: 555
---

# Phase 53 Plan 03: Breadcrumbs server component + montaje en las 3 fichas Summary

Componente `Breadcrumbs` server puro (props literales, cero JS, cero dependencia nueva) montado en las 3 fichas de detalle (proyecto/parlamentario/contraparte) para que toda página anuncie "dónde estás" y ofrezca vuelta a Inicio/sección en 1 click — remedio contratado por 53-UI-SPEC §(b) al gap "no sé dónde estoy" (en `/proyecto/*` y `/contraparte/*` ningún ítem del nav queda activo).

## What Was Built

- **`Breadcrumbs` (`app/components/breadcrumbs.tsx`):** Server Component presentacional puro. `<nav aria-label="Ruta de navegación">` con `<ol>`; cada ítem con `href` → `<Link>` navegable (`min-h-11` touch target), el ítem final sin `href` → `<span aria-current="page">` texto plano; `mono:true` → `font-mono` (boletín). Separador glifo Unicode `/` (`aria-hidden`), N ítems → N-1 separadores. Sin `"use client"`, sin `usePathname` — cada página pasa sus crumbs literales. Nunca un heading.
- **Proyecto (`/proyecto/[boletin]`):** breadcrumb como primer hijo del `<main>`, antes del header en `<Suspense>`. Crumbs `[Inicio /, Proyectos /buscar, Boletín {n} mono]`. El boletín es route param ya validado (BOLETIN_RE) → sin fetch extra. `/buscar` es la superficie de hallazgo (no existe `/proyectos`).
- **Contraparte (`/contraparte/[id]`):** breadcrumb `[Inicio /, {nombre}]` (crumb 2 omitido — no hay ruta de listado) dentro de `HeaderSection`, después del gate MONEY `notFound()` (page-level, primera sentencia) y de las defensas jurídica → sólo se sirve con ruta autorizada + fila válida. Invisible en PROD (gate OFF → 404), future-proof.
- **Parlamentario (`/parlamentario/[id]`):** breadcrumb `[Inicio /, Parlamentarios /parlamentarios, {nombre}]` dentro de `parlamentario-header.tsx` (primer elemento, sobre el h1), usando `parlamentario.nombre` del RPC `parlamentario_publico` cacheado (React.cache F52) → cero RPC extra. Nombre as-shipped (Title Case es F54).

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Breadcrumbs (server puro) + test RTL (TDD) | 58675e8 |
| 2 | Cablear breadcrumb en fichas proyecto y contraparte | 16ce344 |
| 3 | Cablear breadcrumb en ficha parlamentario (RPC cacheado) + extender page test | 005591c |

## Verification

- `pnpm --dir app exec vitest run components/breadcrumbs.test.tsx` → 6 verde (links/current/aria-current/mono/sin-heading/N-1-separadores + caso 1-ítem contraparte)
- `pnpm --dir app exec vitest run app/parlamentario` → page.test.tsx 8 verde (+2 breadcrumb: 3 crumbs correctos + cero RPC extra)
- `pnpm --dir app test -- --run` → **555 passed / 51 files** (incluye lockdown-guard)
- `pnpm --dir app exec tsc -b` → limpio
- `grep Breadcrumbs` presente en las 3 páginas de ficha
- Frontera `mt-12` intacta (git diff no toca ninguna clase `mt-12` ni `<h1>` — sólo comentarios los mencionan); ningún h1 nuevo/re-nivelado

## Deviations from Plan

**1. [Rule 3 - Blocking clarification] Breadcrumb de contraparte montado dentro de HeaderSection, no en el body del main**
- **Found during:** Task 2
- **Issue:** El plan indicaba el punto de inserción `contraparte/[id]/page.tsx:62` (body del `<main>`), pero el `nombre` de la contraparte sólo existe tras el RPC dentro de `HeaderSection` — no está disponible a nivel de page para el crumb `[Inicio, {nombre}]`.
- **Fix:** Montado dentro de `HeaderSection` (donde se resuelve `nombre`), sobre el `<header>`. Sigue DESPUÉS del gate MONEY `notFound()` (page-level, primera sentencia LOCKED) y de las defensas jurídica → cero fuga de existencia (T-53-03-02 respetado). Mismo patrón que parlamentario (Task 3).
- **Files modified:** app/app/contraparte/[id]/page.tsx
- **Commit:** 16ce344

**2. [Rule 2 - Testability] Export de HeaderSection en /parlamentario/[id]/page.tsx**
- **Found during:** Task 3
- **Issue:** El breadcrumb del parlamentario vive dentro de `HeaderSection` (async, tras `<Suspense>`), que `renderToStaticMarkup` no resuelve desde el shell. Para probarlo por comportamiento (no por convención) se necesita montar `HeaderSection` directo.
- **Fix:** `HeaderSection` exportada como named export (ignorado por el router de Next; espejo de `CarrilesSection` ya exportada). El page test la monta y asserta el path RPC→header→breadcrumb.
- **Files modified:** app/app/parlamentario/[id]/page.tsx, app/app/parlamentario/[id]/page.test.tsx
- **Commit:** 005591c

## Anti-insinuación / seguridad

- Breadcrumbs renderiza SOLO labels de ruta + el nombre público shipped (ya visible en el h1): cero PII/partido/foto (Invariant 5, LEGAL-03 intacto).
- Contraparte: crumb tras el gate → sin fuga de existencia; ningún crumb apunta a `/contraparte` desde afuera (T-53-03-03 accept — no se introduce).
- Cero flag flips, cero DDL, cero RPC nueva (Invariant 6). `mt-12` LOCKED intacto (Invariant 1). Camino A intacto.

## Self-Check: PASSED

- `app/components/breadcrumbs.tsx` — FOUND
- `app/components/breadcrumbs.test.tsx` — FOUND
- Commits 58675e8, 16ce344, 005591c — FOUND en git log
