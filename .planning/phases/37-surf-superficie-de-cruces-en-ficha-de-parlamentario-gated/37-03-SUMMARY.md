---
phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated
plan: 03
subsystem: frontend-ficha-parlamentario
tags: [surf, cruces, gate, candado-b, ficha, anti-insinuacion]
requires:
  - "@/lib/cruces-gate (crucesPublicEnabled — 37-01)"
  - "@/components/cruces-de-parlamentario (CrucesSection — 37-02)"
provides:
  - "Carril gated <section id=cruces> en la ficha del parlamentario (Candado B presentación)"
  - "Test de gate a nivel de sección (ausente OFF / presente ON)"
affects:
  - "app/app/parlamentario/[id]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "gate-wraps-section (espejo MONEY): el gate envuelve la <section> ENTERA incl. <h2>"
    - "Suspense + Skeleton shape-matched para sección async server"
    - "test de RSC async: render directo de CrucesSection para el path ON (Suspense no resuelve en renderToStaticMarkup)"
key-files:
  created:
    - "app/app/parlamentario/[id]/page.test.tsx"
  modified:
    - "app/app/parlamentario/[id]/page.tsx"
decisions:
  - "El path ON de la sección se prueba renderizando CrucesSection directamente (await del RSC async) — renderToStaticMarkup sirve el fallback skeleton, no resuelve hijos async de Suspense; el carril (id=cruces + heading) sí se asierta en el HTML de la página."
metrics:
  duration: ~11min
  completed: 2026-06-24
  tasks: 2
  files: 2
---

# Phase 37 Plan 03: Carril gated #cruces en ficha de parlamentario — Summary

Cableado de la `<section id="cruces" className="mt-12">` como carril hermano en
`app/app/parlamentario/[id]/page.tsx`, envuelta ENTERA (heading incluido) en
`crucesPublicEnabled(process.env)` (espejo exacto del patrón MONEY), con Suspense +
`CrucesSkeleton`, más el test NUEVO de gate a nivel de sección que prueba por
comportamiento Candado B: con el gate OFF (default) el nodo `#cruces` está AUSENTE del
HTML y el RPC de cruces nunca se invoca; con ON el carril está presente y `CrucesSection`
monta sobre un fixture normal sin lanzar. Flag ships OFF; encenderlo es Phase 39.

## What Was Built

### Task 1 — Carril gated `<section id="cruces">` + `CrucesSkeleton` (commit 228d9dd)
- Imports añadidos: `crucesPublicEnabled` desde `@/lib/cruces-gate` y `CrucesSection`
  desde `@/components/cruces-de-parlamentario` (chokepoint WR-02 — NUNCA se lee
  `CRUCES_PUBLIC_ENABLED` crudo).
- `<section id="cruces" className="mt-12">` insertada como carril HERMANO (sibling),
  envuelta ENTERA en `{crucesPublicEnabled(process.env) && ( ... )}` — el gate envuelve
  la `<section>` incluido el `<h2>`; OFF ⇒ nodo ausente del HTML (no se depende de que
  `CrucesSection` retorne null).
- Posición LOCKED: DESPUÉS de `#patrimonio` y ANTES de las secciones MONEY gated
  (`#dinero`/`#financiamiento`), para no leerse como un "score" pegado a `#lobby`.
- `<h2>` factual EXACTO "Cruces con sectores" (sin posesivo, sin juicio).
- `<Suspense fallback={<CrucesSkeleton />}>` envolviendo `<CrucesSection id={id} />`
  (SIN `searchParams` — la sección no pagina).
- `function CrucesSkeleton()` shape-matched a `CrucesView` (intro + ~3 filas), espejo de
  `LobbySkeleton`, con `aria-hidden="true"`.
- NO se añadió bloque honest-state `!crucesPublicEnabled(...)` (fuera de alcance — el
  patrón "pendiente legal" es solo para MONEY). CERO DDL, CERO grant, CERO flip de flag.

### Task 2 — Test de gate a nivel de sección (commit bb4c669)
- `app/app/parlamentario/[id]/page.test.tsx` (nuevo — no existía test de esta página),
  adaptado del scaffold de `app/app/red/page.test.tsx`.
- Mocks: `@/lib/cruces-gate` (gate inyectable, default OFF), `@/lib/supabase`
  (`rpcMock` que tolera la cabecera `parlamentario_publico` con fila mínima vía un
  thenable con `.maybeSingle()`, y devuelve un fixture de 1 fila para
  `cruces_de_parlamentario`), `@/lib/money-gate` (OFF, aísla el carril), `next/navigation`.
- Caso OFF: el HTML renderizado NO contiene `id="cruces"` ni "Cruces con sectores"
  (prueba load-bearing de Candado B) y el RPC `cruces_de_parlamentario` NO se invocó.
- Caso ON (carril presente): el HTML de la página contiene `id="cruces"` y
  "Cruces con sectores".
- Caso ON (monta sin lanzar): `CrucesSection({ id })` se await directamente (el RSC async
  no lo resuelve `renderToStaticMarkup` dentro de Suspense), se renderiza y se asierta la
  `sector_etiqueta` del fixture + que el RPC de cruces se invocó 1 vez.
- Caso ON (resuelve truthy): `ParlamentarioPage(...)` resuelve sin lanzar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test fidelity] Render directo de `CrucesSection` para el path ON**
- **Found during:** Task 2 (primer run del test ON falló).
- **Issue:** El plan pedía asertar la `sector_etiqueta` en el HTML de la página con el
  gate ON. `renderToStaticMarkup` NO resuelve los hijos async de Suspense (Server
  Components) — sirve el fallback `CrucesSkeleton`, así que `sector_etiqueta` nunca
  aparece en el HTML de la página completa.
- **Fix:** El caso ON se desdobla: (a) el HTML de la página asierta el carril presente
  (`id="cruces"` + heading "Cruces con sectores", ambos síncronos fuera de Suspense);
  (b) un caso aparte renderiza `CrucesSection({ id })` directamente (await del RSC) para
  probar que el path ON consume el fixture del RPC y renderiza la `sector_etiqueta` sin
  lanzar. Cubre exactamente la behavior spec del plan sin depender de una capacidad que
  `renderToStaticMarkup` no tiene.
- **Files modified:** app/app/parlamentario/[id]/page.test.tsx
- **Commit:** bb4c669

## Verification

- `cd app && npx tsc -b` → exit 0 (limpio).
- `cd app && npx vitest run parlamentario` → 129 tests verdes (incl. los 3 nuevos de la página).
- `cd app && npx vitest run` (suite completa) → 294 tests verdes (30 archivos), sin regresión.
- `git diff` 37-03 toca SOLO `page.tsx` + `page.test.tsx`; CERO archivos bajo
  `supabase/migrations/`; CERO `grant`; CERO `.env` modificado; el flag ships OFF.

## Known Stubs

None. La sección monta producción real (`CrucesSection` ya construido en 37-02); el
único "no encendido" es el flag, que es intencional por diseño LOCKED (Candado B,
encender = Phase 39 firma humana exclusiva).

## Self-Check: PASSED

- FOUND: app/app/parlamentario/[id]/page.tsx (modificado, contiene `crucesPublicEnabled`)
- FOUND: app/app/parlamentario/[id]/page.test.tsx (creado, contiene `renderToStaticMarkup`)
- FOUND commit 228d9dd (feat — carril gated)
- FOUND commit bb4c669 (test — gate a nivel de sección)
