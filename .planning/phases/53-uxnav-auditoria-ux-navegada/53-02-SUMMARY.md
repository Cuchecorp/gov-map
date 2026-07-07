---
phase: 53-uxnav-auditoria-ux-navegada
plan: 02
subsystem: ui
tags: [nav, header, next, react, rtl, tdd, accessibility]

# Dependency graph
requires:
  - phase: 53-01
    provides: 53-UX-AUDIT F-01 finding + 53-UI-SPEC §(a) nav contract (order + labels + /red)
provides:
  - "HeaderNav con 5 destinos (Buscar · Parlamentarios · Agenda · Red · Sobre) — /red alcanzable en 1 click desde cualquier página"
  - "Test RTL de cobertura del HeaderNav (Wave 0 gap): 5 ítems, hrefs, orden, label 'Sobre', active-state por prefix-match"
affects: [53-03, 53-uxnav Wave 3 (redeploy + re-walkthrough), F54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock inyectable de usePathname (next/navigation) para tests RTL de islas 'use client'"
    - "NAV_ITEMS declarativo: extender la nav sin JS cliente nuevo (static <Link> + flex-wrap CSS collapse)"

key-files:
  created:
    - app/components/header-nav.test.tsx
  modified:
    - app/components/header-nav.tsx

key-decisions:
  - "Label del ítem 4 = 'Red' (nombre de ruta factual), NUNCA 'Red de influencia'/'Conexiones' (banned-vocab, anti-insinuación)"
  - "Acortar ítem 5 a 'Sobre' (de 'Sobre / Metodología') para que 5 ítems quepan en 1 fila de nav a 390px; Metodología sigue en /sobre + footer"
  - "active-state por prefix-match (esActivo) intacto: /parlamentario/[id] NO activa ningún ítem (breadcrumb es el remedio de orientación en fichas, no un ítem nuevo)"

patterns-established:
  - "Mock de usePathname con vi.fn inyectable por test para verificar active-state sin router real"

requirements-completed: [UX-01]

# Metrics
duration: 2min
completed: 2026-07-07
---

# Phase 53 Plan 02: Nav global — ítem Red + orden por journey + label "Sobre" + active-state Summary

**El header global ahora ofrece los 5 destinos del sitio (Buscar · Parlamentarios · Agenda · Red · Sobre) con `/red` alcanzable en 1 click; label "Sobre" acortado para caber en 1 fila a 390px; active-state por prefix-match intacto — cero JS cliente nuevo, cero DDL/flag/RPC.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-07T02:50:43Z
- **Completed:** 2026-07-07T02:52:11Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `/red` (LIVE desde 2026-07-02) deja de ser huérfana del header: entra en posición 4 del nav (F-01 remediado, ROADMAP Phase 53 SC3 "≤2 clicks" → ahora 1 click).
- Label del ítem 5 acortado de "Sobre / Metodología" a "Sobre" para que 5 ítems + wordmark quepan en ≤2 filas (wordmark + 1 fila de nav) a 390px.
- Cobertura de test cerrada (Wave 0 gap de 53-RESEARCH): nuevo `header-nav.test.tsx` con 6 aserciones RTL (5 ítems, hrefs, orden, label "Sobre", active por prefix-match, no-activo en fichas).

## Task Commits

1. **Task 1: Wave 0 — test RTL del HeaderNav (RED)** - `c9edae9` (test)
2. **Task 2: Extender NAV_ITEMS (+Red, label "Sobre") — GREEN** - `88ade37` (feat)

_TDD: RED (test falla contra 4-ítems shipped) → GREEN (5 ítems, test verde). No REFACTOR necesario (cambio mínimo al array + comentario)._

## Files Created/Modified
- `app/components/header-nav.test.tsx` - Test RTL: 6 casos (5 ítems/hrefs/orden, label "Sobre" sin "Metodología", aria-current en /red, no-activo en /parlamentario/D1012, activo por prefix en /parlamentarios/D123). Mockea usePathname inyectable.
- `app/components/header-nav.tsx` - NAV_ITEMS extendido con `{ href: "/red", label: "Red" }` en pos 4 y label 5 acortado a "Sobre"; comentario LOCKED actualizado al 53-UI-SPEC §(a) (re-open autorizado). Todo lo demás byte-idéntico: esActivo, aria-current, min-h-11, underline petróleo activo, flex-wrap.

## Decisions Made
- Label "Red" = nombre de ruta factual (no "Red de influencia"/"Conexiones", banned-vocab / anti-insinuación invariant 2 del UI-SPEC).
- Acortar "Sobre / Metodología" → "Sobre": remedio de mobile fit contratado por 53-UI-SPEC §(a); Metodología sigue alcanzable desde `/sobre` y footer.
- `esActivo` prefix-match NO se toca: las fichas (`/parlamentario/[id]`, `/proyecto/[boletin]`) intencionalmente no activan ningún ítem — su remedio de orientación es el breadcrumb (53-03), no un ítem de nav.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED falló como se esperaba (4 tests contra el shipped 4-ítems); GREEN verde 6/6; `tsc -b` limpio.

## User Setup Required
None - no external service configuration required. Sin redeploy (Wave 3 lo hace).

## Next Phase Readiness
- HeaderNav de 5 ítems listo. Verificación visual before/after (F-01) queda para Wave 3 tras redeploy.
- Suite completa + lockdown-guard se corre en el gate de Wave 3 (no en este plan).
- 53-03 (breadcrumbs, empty-state lines) es independiente de este cambio.

## Self-Check: PASSED
- FOUND: app/components/header-nav.test.tsx
- FOUND: app/components/header-nav.tsx (modified)
- FOUND commit: c9edae9 (test RED)
- FOUND commit: 88ade37 (feat GREEN)

---
*Phase: 53-uxnav-auditoria-ux-navegada*
*Completed: 2026-07-07*
