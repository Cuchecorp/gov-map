---
phase: 45-leg-navegaci-n-acordeones-por-carril-resumen-ndice-above-fol
plan: 01
subsystem: frontend-ficha-parlamentario
tags: [ui, radix, accordion, ssr, no-leak, leg-01, leg-03]
requires:
  - "@radix-ui/react-accordion (familia Radix ya instalada: separator/slot/tooltip)"
  - "app/lib/utils.ts (cn)"
provides:
  - "CarrilAccordion: isla cliente Radix que envuelve un Server Component de sección como children, h2 siempre visible, cuerpo colapsable con forceMount"
  - "@radix-ui/react-accordion@1.2.14 en package.json/pnpm-lock.yaml"
  - "keyframes accordion-down/up en globals.css gated por prefers-reduced-motion"
affects:
  - "app/app/parlamentario/[id]/page.tsx (plan futuro 45-02: la página envolverá cada <section> en CarrilAccordion)"
tech-stack:
  added:
    - "@radix-ui/react-accordion@1.2.14"
  patterns:
    - "Radix \"use client\" wrapper + cn (espejo tooltip.tsx/separator.tsx)"
    - "Server Component pasado como children a una isla cliente (no-leak SSR)"
    - "forceMount + data-[state=closed]:hidden = contenido SSR siempre en el HTML"
    - "source-scan negative-grep test (espejo lockdown-guard.test.ts: process.cwd()+path.join)"
key-files:
  created:
    - "app/components/carril-accordion.tsx"
    - "app/components/carril-accordion.test.tsx"
  modified:
    - "app/package.json"
    - "pnpm-lock.yaml"
    - "app/app/globals.css"
decisions:
  - "forceMount (no unmount) para honrar 'SSR intacto': el contenido server-rendered queda en el HTML aunque el carril esté colapsado (Open Q1 RESEARCH → recomendado)"
  - "Animación NO load-bearing: el colapso real lo hace data-[state=closed]:hidden; los keyframes solo corren con prefers-reduced-motion: no-preference (Pitfall 5)"
  - "Chevron glifo Unicode ▾ inline (DESIGN-SYSTEM §5.2), sin nueva icon dep"
  - "El test no-leak usa process.cwd()+path.join (no import.meta.url, que no es file:// en este vitest sobre OneDrive)"
metrics:
  duration: "~18min"
  completed: "2026-06-26"
  tasks: 2
  files: 5
---

# Phase 45 Plan 01: LEG Navegación — CarrilAccordion (isla cliente + dep) Summary

Instala la única dependencia nueva de la fase (`@radix-ui/react-accordion@1.2.14`) y crea `CarrilAccordion`, una isla cliente delgada (Radix `Accordion.Root` single+collapsible, 1 item) que envuelve un Server Component de sección pasado como `children`, con el `<h2>` siempre visible en el header (preserva `h1→h2→h3`) y el cuerpo colapsable con `forceMount` para que el contenido SSR quede en el HTML aunque el carril esté cerrado. El único landmine de la fase —que el wrapper NO debe importar ninguna sección ni el cliente Supabase server-only (no-leak Camino A)— queda aislado y asertado por un grep-test.

## What Was Built

### Task 1 — Dependencia + keyframes (commit `f0b8d25`)
- `pnpm add @radix-ui/react-accordion@1.2.14` (versión exacta; misma org `@radix-ui` ya instalada; slopcheck [OK] en RESEARCH). Aparece en `app/package.json` dependencies y `pnpm-lock.yaml`.
- Keyframes `accordion-down`/`accordion-up` en `app/app/globals.css` usando `var(--radix-accordion-content-height)`, aplicados a `.accordion-content[data-state=open|closed]`, TODO envuelto en `@media (prefers-reduced-motion: no-preference)`. La animación es NO load-bearing: el colapso real lo hace `data-[state=closed]:hidden` en el componente, así que el carril funciona aunque la animación no aplique. NO se agregó `tailwindcss-animate` al config (cambio contenido en globals.css).

### Task 2 — CarrilAccordion (TDD) (commits `dc84834` RED, `670fd44` GREEN)
- `app/components/carril-accordion.tsx`: `"use client"`, `import * as AccordionPrimitive from "@radix-ui/react-accordion"` + `cn` (shape canónico de `tooltip.tsx`/`separator.tsx`). Firma `CarrilAccordion({ titulo, conteo, defaultOpen, children })`. Estructura: `Accordion.Root type="single" collapsible defaultValue={defaultOpen ? "c" : undefined}` → `Item value="c"` → `Header asChild` con `<h2 className="text-xl font-semibold">` que contiene el `Trigger` (`min-h-11` touch-target) con `{titulo}` + span de metadata (`text-muted-foreground font-normal text-sm font-mono`) con `{conteo}` + chevron Unicode `▾` que rota con `group-data-[state=open]:rotate-180`. Cuerpo: `Content forceMount className="accordion-content overflow-hidden data-[state=closed]:hidden pt-4"` con `{children}`.
- `app/components/carril-accordion.test.tsx`: 5 comportamientos RTL — (1) abierto: h2+título y cuerpo en DOM; (2) cerrado: h2 SIGUE visible, cuerpo SIGUE en DOM (forceMount), trigger `aria-expanded="false"`/`data-state="closed"`; (3) click → `aria-expanded`/`data-state` a open (vía `fireEvent`, robusto en jsdom); (4) conteo en el header; (5) no-leak grep del fuente (NO contiene `Section`, `createServerSupabase`, `@/lib/supabase`).

## Verification

- `cd app && pnpm test components/carril-accordion.test.tsx` → **5/5 verde**.
- `cd app && pnpm ls @radix-ui/react-accordion` → **1.2.14**.
- `cd app && pnpm typecheck` → **limpio**.
- `cd app && pnpm test` (suite completa) → **335/335 verde** (incluye `lib/lockdown-guard.test.ts` sin regresión).

## TDD Gate Compliance

- RED commit `dc84834` (`test(...)`): test escrito antes del componente; falló por import inexistente.
- GREEN commit `670fd44` (`feat(...)`): implementación mínima → 5/5 verde.
- REFACTOR: no necesario (componente ya limpio).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] El grep-test no-leak no podía usar `import.meta.url`**
- **Found during:** Task 2 (GREEN).
- **Issue:** `fileURLToPath(new URL("./carril-accordion.tsx", import.meta.url))` lanzó `TypeError: The URL must be of scheme file` — en este vitest (proyecto bajo `OneDrive`, ruta URL-encoded) `import.meta.url` no resuelve a `file://`.
- **Fix:** Reemplazado por `path.join(process.cwd(), "components", "carril-accordion.tsx")`, exactamente el estilo source-scan de `lockdown-guard.test.ts` (que el repo ya usa con éxito).
- **Files modified:** `app/components/carril-accordion.test.tsx`.
- **Commit:** `670fd44`.

**2. [Rule 1 - Bug] Falsos positivos del grep-test en los comentarios del propio componente**
- **Found during:** Task 2 (GREEN).
- **Issue:** El docstring contenía las subcadenas `XSection` (en `<Suspense><XSection/>`) y `@/lib/supabase`, que disparaban el negative-grep aunque no eran imports reales.
- **Fix:** Reescritos los comentarios para no contener esas subcadenas literales (sin cambiar la semántica del contrato). El test no-leak conserva toda su fuerza: detecta cualquier import real de sección o del cliente Supabase.
- **Files modified:** `app/components/carril-accordion.tsx`.
- **Commit:** `670fd44`.

## Known Stubs

Ninguno. `CarrilAccordion` es un componente completo y funcional; aún no tiene consumidor (la página lo cableará en un plan posterior de la fase), lo cual es el diseño esperado de Wave 1 (`affects: page.tsx`).

## Threat Flags

Ninguno nuevo. El componente respeta T-45-01 (no-leak, asertado por el grep-test) y T-45-02 (dep en versión exacta verificada). No introduce endpoints, auth, ni acceso a datos.

## Self-Check: PASSED

- `app/components/carril-accordion.tsx` — FOUND
- `app/components/carril-accordion.test.tsx` — FOUND
- Commit `f0b8d25` (Task 1) — FOUND
- Commit `dc84834` (RED) — FOUND
- Commit `670fd44` (GREEN) — FOUND
