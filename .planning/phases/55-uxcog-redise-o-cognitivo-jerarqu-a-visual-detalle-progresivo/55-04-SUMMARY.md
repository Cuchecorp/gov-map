---
phase: 55-uxcog-redise-o-cognitivo-jerarqu-a-visual-detalle-progresivo
plan: 04
subsystem: frontend-ui
tags: [ui, proyecto, rail, stepper, progressive-disclosure, urgencia-agrupada, anti-insinuacion]
requires:
  - "FichaRail / DetalleColapsable / token bg-accent-product-soft (55-01)"
  - "timeline-view.tsx (agrupación de urgencia) + estado-actual-block.tsx (derivadores)"
provides:
  - "TramitacionStepper — capa-1 visual de tramitación (hitos clave + urgencia agrupada)"
  - "página /proyecto/[boletin] con rail sticky (6 secciones) + stepper + timeline colapsado"
  - "leerProyecto React.cache (dedup rail/header/stepper)"
  - "exports construirItems/fechaValida/TimelineItem desde timeline-view (fuente única de agrupación)"
affects:
  - "F38 (cruces en proyecto) hereda el patrón drill-down; F47/F49 se montan sobre esta estructura"
tech-stack:
  added: []
  patterns:
    - "Capa-1 pura reusando construirItems (una sola heurística de agrupación)"
    - "Rail server-wrapper (ProyectoRail) → FichaRail client con header ReactNode + navEntries serializadas"
    - "Disclosure inverso: capa-1 fuera, timeline completo dentro de DetalleColapsable (default cerrado)"
key-files:
  created:
    - app/components/capa1/tramitacion-stepper.tsx
    - app/components/capa1/tramitacion-stepper.test.tsx
    - app/app/proyecto/[boletin]/page.test.tsx
  modified:
    - app/components/timeline-view.tsx
    - app/app/proyecto/[boletin]/page.tsx
decisions:
  - "#estado (EstadoActualBlock, textual) y #timeline (stepper visual) son entradas de rail distintas; el stepper ELEVA el '¿Dónde está hoy?' mostrando etapa/urgencia + hitos clave, sin duplicar el bloque completo"
  - "La línea agrupada 'ver todos' salta al detalle (#timeline) donde el mecanismo ?urgencias sigue operando; capa-1 no reimplementa el expand server"
  - "Conteo del rail: sólo votaciones (read barato/honesto head:true); lobby omitido (RPC 0048 gated → omisión honesta, no fabricar dígito)"
  - "leerProyecto cacheado reemplaza la lectura inline de FichaSection y alimenta rail+stepper (una consulta por render)"
metrics:
  duration: ~20min
  completed: 2026-07-07
  tasks: 2
  files: 5
---

# Phase 55 Plan 04: Ficha de proyecto — rail + stepper + detalle progresivo Summary

La ficha de proyecto (antes 10.391px de scroll plano) se recompone con la variante B "Informe con rail": rail sticky de 6 secciones (Dónde está / Tramitación / Votaciones / Lobby del período / Idea matriz / Similares), la capa-1 de Tramitación es un **stepper visual de etapas** que eleva el "¿Dónde está hoy?" existente con los hitos CLAVE siempre visibles y las corridas repetitivas de urgencia agrupadas en una línea neutra ("{N} trámites de urgencia · ver todos"), y la **tramitación completa vive colapsada** en un `DetalleColapsable` (ningún hito se pierde). Reusa verbatim la agrupación de urgencia de `timeline-view.tsx` y los derivadores de `estado-actual-block.tsx` — cero heurística nueva.

## What Was Built

### Task 1 — TramitacionStepper capa-1 (TDD RED `6030825` → GREEN `44b91c2`)
- **`timeline-view.tsx`**: exports aditivos (sin cambio de lógica) de `construirItems`, `fechaValida` y el tipo `TimelineItem` — una sola fuente de verdad de la agrupación de urgencia repetitiva ≥2. Los tests existentes de timeline-view siguen verdes.
- **`capa1/tramitacion-stepper.tsx`**: vista PURA que recibe `eventos` + `estado` (derivado). Encabezado que ELEVA el "¿Dónde está hoy?" (etapa actual + urgencia vigente, cada línea omitida si no es derivable). Stepper de hitos clave (dot + descripción + fecha Mono), etapa actual destacada de forma sobria (peso + punto lleno neutro, **NO petróleo**). Corridas de urgencia repetitivas → 1 línea "{N} trámites de urgencia · ver todos" (copy LOCKED neutro; "ver todos" = afordance de drill-down al `#timeline`). Omisión honesta de fechas vía `fechaValida` reusado (nunca "ene 1970").
- **Test**: hitos clave visibles, agrupación con copy LOCKED + link, omisión honesta (fecha inválida sin 1970), elevación de estado, empty-state honesto, negative-match banned-vocab, source-scan no-leak (vista pura, cero supabase/Section).

### Task 2 — Recomposición de `page.tsx` + `page.test.tsx` (`7f0f18f`)
- **Layout**: `max-w-5xl` + grid `md:grid-cols-[13rem_1fr] gap-8 items-start`; rail sticky en la 1ª columna, contenido en la 2ª. `< md` el rail colapsa a barra superior (lo resuelve FichaRail).
- **`ProyectoRail`** (server, exportado): lee la cabecera del proyecto (cacheada) + conteo honesto de votaciones (`head:true`, #34 lanza ante error) y arma las 6 `RailEntry` con anclas `#estado/#timeline/#votaciones/#lobby-tramitacion/#idea-matriz/#similares`. Header ReactNode server (título + boletín Mono + estado); caveat anti-causal 1×. Sin carriles gated en proyecto → 6 entradas siempre presentes.
- **`TramitacionSection`** (exportada): capa-1 `<TramitacionStepper>` SIEMPRE visible (eleva el EstadoActual derivado) + capa-2 `<DetalleColapsable n={nEventos}>` con el `<TimelineView>` completo dentro (default cerrado; el mecanismo server `?urgencias=<id>` sigue operando). Conserva el único `ProvenanceBadge` de sección (SC7).
- **`leerProyecto`** React.cache: dedup entre FichaSection (cabecera/404), ProyectoRail (rail) y TramitacionSection (etapa/estado del stepper) — una consulta por render.
- Cada sección = `<section id className="mt-12 scroll-mt-6">` hermana (frontera anti-insinuación LOCKED). Nombre lobby×tramitación PLANO no-enlazado (52-03) conservado dentro de `LobbyEnTramitacionSection`. Orden load-bearing `BOLETIN_RE → searchParams` intacto; Breadcrumbs (F53) preservado.
- **Test**: shell (grid + 6 ids + mt-12/scroll-mt-6 + breadcrumb), rail (6 anclas + caveat 1× + conteo 3), TramitacionSection (stepper capa-1 + "Ver detalle (4)" + TimelineView dentro con enlaces de fuente), banned-vocab negative-match, source-scan (lobby plano, orden load-bearing, stepper fuera del disclosure).

## Deviations from Plan

Ninguna deviación de comportamiento. Aclaraciones de implementación (dentro del alcance del plan):

- **Conteo del rail acotado a votaciones**: el plan pide "conteos donde apliquen (votaciones N, lobby N)". Se implementa el conteo de votaciones (read barato `head:true`, honesto); el conteo de lobby se OMITE porque su fuente es el RPC 0048 (gated/degradable a null) — contar ahí arriesgaría fabricar un dígito. Omisión honesta (Pattern C: nunca fabricar un conteo). El rail muestra las 6 entradas; sólo votaciones lleva conteo.
- **`estado-actual-block.tsx` no se modificó** (aunque figuraba en los files de Task 1): el stepper REUSA sus derivadores/tipo ya exportados (`derivarEstadoActual`, `EstadoActual`) — no requirió cambios. Su test sigue verde.
- **[Rule 3 - Blocking] docstring del stepper reescrito**: la primera redacción mencionaba literalmente `@/lib/supabase` en un comentario, disparando el source-scan no-leak (regex sobre el archivo). Reescrito sin el token literal — el contrato (vista pura, cero lectura de DB) se mantiene. Commit `44b91c2`.

## Verification

- `cd app && npx vitest run` → **660 tests verdes** (baseline 643; +17: 8 stepper + 9 page). Nunca decrece.
- `pnpm typecheck` (root, `tsc -b`) → limpio.
- `cd app && npx vitest run lib/lockdown-guard.test.ts` → **8/8** verde (Camino A intacto: cero RPC nueva/DDL/flag).
- banned-vocab negative-match verde (suite completa). CERO deps nuevas, CERO token de color arbitrario, petróleo reservado (drill-down "ver todos"), mt-12 frontera intacta, nombre lobby plano (52-03).

## TDD Gate Compliance

Task 1 (`tdd="true"`): secuencia RED→GREEN en git log — `test(55-04)` (`6030825`, falla import) seguido de `feat(55-04)` (`44b91c2`, verde). Task 2 no era TDD-flagged (test co-entregado con la recomposición).

## Self-Check: PASSED

- app/components/capa1/tramitacion-stepper.tsx — FOUND
- app/components/capa1/tramitacion-stepper.test.tsx — FOUND
- app/app/proyecto/[boletin]/page.test.tsx — FOUND
- app/components/timeline-view.tsx — FOUND (exports aditivos)
- app/app/proyecto/[boletin]/page.tsx — FOUND (recompuesto)
- commits 6030825, 44b91c2, 7f0f18f — FOUND
