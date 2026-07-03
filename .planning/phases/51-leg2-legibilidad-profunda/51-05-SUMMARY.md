---
phase: 51-leg2-legibilidad-profunda
plan: 05
subsystem: frontend-ficha-proyecto
tags: [legibilidad, timeline, provenance, rsc, anti-insinuacion]
requires:
  - "app/lib/format.ts (relativeTimeEs, fechaCorta, esStale)"
  - "app/components/provenance-badge.tsx"
  - "app/lib/types.ts (ProyectoRow, TramitacionEventoRow)"
provides:
  - "EstadoActualBlock '¿Dónde está hoy?' (RSC + derivarEstadoActual puro)"
  - "TimelineView de dos niveles (esEventoUrgencia/paresDeUrgencia)"
  - "1 ProvenanceBadge por sección timeline (SC7)"
affects:
  - "app/app/proyecto/[boletin]/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Omisión honesta (espejo seriePatrimonio): línea ausente si no derivable"
    - "Colapso conservador server-driven (?urgencias) — sólo pares de urgencia"
    - "1 badge/heading + link por dato (SC7)"
key-files:
  created:
    - "app/components/estado-actual-block.tsx"
    - "app/components/estado-actual-block.test.tsx"
    - "app/components/timeline-view.test.tsx"
  modified:
    - "app/components/timeline-view.tsx"
    - "app/components/timeline-event.tsx"
    - "app/app/proyecto/[boletin]/page.tsx"
decisions:
  - "El ProvenanceBadge de sección se computa en TimelineSection (page.tsx) con el fecha_captura más reciente; el heading migra a TimelineSection para acompañarlo"
  - "EstadoActualBlock lee proyecto+eventos por su cuenta (RSC autocontenido), throw en error DB (#34); bloque sin líneas derivables → null (no fabrica)"
  - "id de período de urgencia = 'u{ordinal}' server-derivado; ?urgencias se compara por igualdad (T-51-17), nunca se interpola en SQL"
metrics:
  duration: ~35min
  completed: 2026-07-03
---

# Phase 51 Plan 05: "¿Dónde está hoy?" + timeline dos niveles Summary

Ficha de proyecto que abre con un bloque de estado actual derivado honestamente y un timeline que mantiene todo hito estructural visible mientras colapsa sólo los pares repetitivos de urgencia, con un único ProvenanceBadge por sección.

## What Was Built

**Task 1 — EstadoActualBlock "¿Dónde está hoy?" (SC2):**
- `derivarEstadoActual(proyecto, eventos)` puro y exportado → hasta 3 líneas (etapa/estado, último hito, urgencia vigente). Cada línea OPCIONAL: se omite cuando el dato no es derivable (espejo de `seriePatrimonio` que excluye el punto cuando el año no parsea). Nunca fabrica ni usa "—" como dato (T-51-14).
- Urgencia vigente = último "hace presente … urgencia {tipo}" sin un "retira … urgencia" posterior (recorrido cronológico); si no hay ninguna, se omite (no hay campo `urgencia_actual` en la tabla).
- `"hace N días"` vía `relativeTimeEs` + fecha absoluta (no hand-roll).
- `EstadoActualBlock` es Server Component (sin "use client"); lee `proyecto`+`tramitacion_evento`, LANZA ante error real de DB/red (#34). Cableado como PRIMER elemento tras el header, antes de `#idea-matriz`.

**Task 2 — Timeline dos niveles + 1 ProvenanceBadge/heading (SC2/SC7):**
- `esEventoUrgencia(e)` + `paresDeUrgencia(eventos)` exportados; heurística CONSERVADORA (Pitfall 3): sólo colapsa runs contiguos de eventos-urgencia del mismo tipo con longitud ≥ 2. Informe/oficio/votación/cambio de trámite quedan SIEMPRE visibles (T-51-15).
- Cada período colapsado → "Urgencia {tipo} renovada {N} veces entre {mesX} y {mesY} — ver todas.", expandible server-driven vía `?urgencias=<id>` (T-51-17: id `u{ordinal}` derivado por la vista, comparado por igualdad).
- SC7: `ProvenanceBadge` por evento RETIRADO (timeline-event.tsx); UN badge en el heading de la sección timeline (page.tsx, `fecha_captura` más reciente + `esStale`/14d). Cada evento CONSERVA su link "Ver fuente oficial ↗".

## Verification

- `pnpm --dir app test` → **471 passed** (448 baseline + 23 nuevos), 45 archivos, cero regresión.
- `pnpm --dir app exec tsc -b` → limpio (exit 0).
- Tests nuevos: `estado-actual-block.test.tsx` (derivación a/b/c + omisión honesta + banned-vocab + source-scan no-"use client"/throw/orden en page) y `timeline-view.test.tsx` (fixture mixto: hitos no colapsan, par sí; expand `?urgencias=u1`; 0 badge/evento + N links; source-scan 1 badge en page / 0 en timeline-event).
- Lockdown-guard 8/8 verde (cero DDL/grant/flag tocado).

## Deviations from Plan

### Auto-fixed / implementation choices

**1. [Rule 3 - Blocking] ProvenanceBadge de sección renderizado en `TimelineSection` con heading migrado.**
- **Found during:** Task 2.
- **Issue:** El plan pide "UN ProvenanceBadge en el heading de la sección timeline (en page.tsx)". El heading `<h2>Tramitación</h2>` vivía fuera del `<Suspense>`/`TimelineSection`, pero el badge necesita el `fecha_captura` de los eventos (que sólo existe dentro de `TimelineSection`).
- **Fix:** Se movió el `<h2>` al interior de `TimelineSection`, junto al `ProvenanceBadge` (computado del evento con captura más reciente). Sigue en page.tsx (TimelineSection es parte de page.tsx). El fallback de skeleton ya no muestra el heading durante la carga (cambio menor de UX).
- **Files:** `app/app/proyecto/[boletin]/page.tsx`.
- **Commit:** b213757.

**2. EstadoActualBlock NO importa `esEventoUrgencia` de timeline-view.**
- El plan sugería reusar el criterio del Task 2. Para mantener el Task 1 autocontenido e independiente, la derivación de urgencia vigente del bloque usa su propia detección enfocada en la semántica presenta/retira (más específica que `esEventoUrgencia`). Cero acoplamiento cruzado entre los dos archivos nuevos.

## Threat Register Coverage

- **T-51-14** (dato falso): mitigado — omisión honesta línea-a-línea; error DB → throw.
- **T-51-15** (señal perdida): mitigado — heurística conservadora; test con fixture mixto prueba que informe/votación siguen visibles.
- **T-51-16** (trazabilidad perdida): mitigado — link "Ver fuente oficial ↗" por evento conservado; el badge se movió, no se eliminó.
- **T-51-17** (injection ?urgencias): mitigado — id normalizado a `u{ordinal}` conocido, comparado por igualdad; nunca SQL crudo.

## Known Stubs

Ninguno.

## Self-Check: PASSED
- FOUND: app/components/estado-actual-block.tsx
- FOUND: app/components/timeline-view.test.tsx
- FOUND commit b736603 (Task 1)
- FOUND commit b213757 (Task 2)
