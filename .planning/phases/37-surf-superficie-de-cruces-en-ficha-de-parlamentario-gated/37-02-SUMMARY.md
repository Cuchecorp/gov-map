---
phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated
plan: 02
subsystem: ui
tags: [react, nextjs, server-component, rtl, vitest, provenance, anti-insinuacion, gated]

# Dependency graph
requires:
  - phase: 36-cruce
    provides: "RPC cruces_de_parlamentario (0040) + materializador cruce_senal (0039) en PROD, deny-by-default"
  - phase: 37-01
    provides: "gate de presentación crucesPublicEnabled() (Candado B, OFF) — consumido por la página en 37-03"
provides:
  - "CrucesView puro (testeable con RTL) que renderiza señales factuales de cruce parlamentario↔sector con provenance inline"
  - "CrucesSection async Server Component que lee el RPC cruces_de_parlamentario con manejo de error #34"
  - "Tipos CruceSenalRpcRow / CruceEvidencia / CruceEvidenciaItem (forma exacta del jsonb 0039/0040) en app/lib/types.ts"
affects: [37-03, 39-firma-legal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PURE-view + Server-Component split (espejo de lobby-de-parlamentario.tsx)"
    - "Valla anti-insinuación §9.1 como negative-match inline (PROHIBIDO + PATRON_RUT) en el test"
    - "ProvenanceBadge alimentado por evidencia divergente (sin fecha_captura/origen): capturedAt=item.fecha, sourceName=sourceLabel('lobby'), sourceUrl=item.enlace_fuente"

key-files:
  created:
    - app/components/cruces-de-parlamentario.tsx
    - app/components/cruces-de-parlamentario.test.tsx
  modified:
    - app/lib/types.ts

key-decisions:
  - "Sin paginación: pocas señales por parlamentario → renderizar todas (CrucesViewData = { id, cruces })"
  - "tipo_senal desconocido degrada honesto ('N registros en el sector X') sin fabricar verbo de reunión, sin lanzar"
  - "Empty honesto: 'No se registran cruces de sector ... con los datos actuales' — nunca limpio/transparente"

patterns-established:
  - "Pattern 1: componente de sección de ficha gated = espejo de lobby adaptado al RPC, sin use client, error real → throw (#34)"
  - "Pattern 2: provenance por evidencia cuando el item NO trae fecha_captura/origen (Pitfall 1) → fecha + sourceLabel('lobby') + enlace_fuente"

requirements-completed: [SURF-01]

# Metrics
duration: 18min
completed: 2026-06-24
---

# Phase 37 Plan 02: CrucesView + CrucesSection (gated, OFF) Summary

**Componente factual de cruces parlamentario↔sector (CrucesView puro + CrucesSection Server Component) espejo de lobby, con provenance inline por evidencia, contraparte cruda + IdentityMarker sin RUT, y la frontera anti-insinuación §9.1 vallada por negative-match — construido pero NO encendido (RPC sin grant + gate OFF hasta Phase 39).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-24T16:35:00Z
- **Completed:** 2026-06-24T16:53:00Z
- **Tasks:** 2 (Task 2 con ciclo TDD RED→GREEN)
- **Files modified:** 3 (1 modificado, 2 creados)

## Accomplishments
- Tipos del RPC `cruces_de_parlamentario` (0040) en `types.ts` con la forma EXACTA del jsonb 0039: `CruceSenalRpcRow` / `CruceEvidencia` / `CruceEvidenciaItem` — el item NO trae `fecha_captura` ni `origen` (Pitfall 1 documentado en el comentario PII-safe).
- `CrucesView` puro: intro honesta, empty honesto (cero cruces ≠ "limpio/transparente"), encabezado factual con conteo NEUTRO ("N reuniones con gestores del sector {etiqueta}") como único agregado, contraparte CRUDA + `IdentityMarker` (nunca enlazada, nunca RUT), y un `ProvenanceBadge` por item de evidencia (`enlace_fuente` + `sourceLabel("lobby")` + `fecha`).
- `CrucesSection` async Server Component que llama `sb.rpc("cruces_de_parlamentario", { p_id: id })` y hace `if (error) throw` (#34: error real de DB/red NUNCA degrada a "sin cruces").
- Test RTL (9 casos): carril aislado (sin href `^/proyecto/`/`^/parlamentario/`, sin copy de voto/boletín), negative-match `PROHIBIDO` + `PATRON_RUT` inline, contraparte cruda + identidad, empty honesto, conteo neutro factual, degradación de `tipo_senal` desconocido, provenance por item, y guarda de item sin fecha/enlace (Pitfall 2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Tipos del RPC de cruces en types.ts** - `8cbd5e6` (feat)
2. **Task 2 (RED): test fallido de CrucesView** - `49123c4` (test)
3. **Task 2 (GREEN): CrucesView + CrucesSection** - `83de6c0` (feat)

**Plan metadata:** (este commit) (docs: complete plan)

_Note: Task 2 fue TDD — test (RED) → feat (GREEN); sin refactor (código limpio al primer GREEN)._

## Files Created/Modified
- `app/lib/types.ts` - Añadidas 3 interfaces (`CruceSenalRpcRow`, `CruceEvidencia`, `CruceEvidenciaItem`) con la forma del RPC 0040 / jsonb 0039; comentario PII-safe LOCKED + Pitfall 1.
- `app/components/cruces-de-parlamentario.tsx` - `CrucesView` puro + `CrucesSection` Server Component + `ContraparteCruda` + `encabezadoSenal` (sin `"use client"`, sin lectura del flag, sin grant/DDL).
- `app/components/cruces-de-parlamentario.test.tsx` - 9 tests RTL del `CrucesView` puro con `PROHIBIDO` + `PATRON_RUT` inline.

## Decisions Made
- **Sin paginación** (discreción del plan/CONTEXT): pocas señales por parlamentario → se renderizan todas; `CrucesViewData = { id, cruces }`.
- **Degradación honesta de `tipo_senal`**: para cualquier valor distinto de `'lobby_sector'`, encabezado neutro "N registros en el sector {etiqueta}" — sin fabricar verbo de reunión, sin lanzar.
- **Texto del empty/encabezado** elegido dentro de las reglas factuales §9.1 (Claude's Discretion del CONTEXT).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. El ciclo TDD corrió limpio (RED por módulo inexistente → GREEN al primer intento). `tsc -b` y `vitest run cruces-de-parlamentario` (9/9) verdes.

## Known Stubs
None. El componente está completo y funcional; su no-activación es intencional y por diseño (RPC sin grant a anon + gate `crucesPublicEnabled()` OFF), no un stub — se enciende en Phase 39 (firma legal humana). El cableado en la página vive en Plan 37-03.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `CrucesSection` listo para que Plan 37-03 lo monte detrás del gate `crucesPublicEnabled(process.env)` como `<section id="cruces" className="mt-12">` hermana en `app/app/parlamentario/[id]/page.tsx`.
- CERO DDL, CERO grant, CERO lectura/flip de `CRUCES_PUBLIC_ENABLED` — los candados de Phase 39 intactos.
- El path del RPC en `CrucesSection` solo se ejercita en prod cuando gate ON + grant existan (ambos Phase 39).

## Self-Check: PASSED
- FOUND: app/lib/types.ts
- FOUND: app/components/cruces-de-parlamentario.tsx
- FOUND: app/components/cruces-de-parlamentario.test.tsx
- FOUND commit: 8cbd5e6 (feat types)
- FOUND commit: 49123c4 (test RED)
- FOUND commit: 83de6c0 (feat GREEN)

---
*Phase: 37-surf-superficie-de-cruces-en-ficha-de-parlamentario-gated*
*Completed: 2026-06-24*
