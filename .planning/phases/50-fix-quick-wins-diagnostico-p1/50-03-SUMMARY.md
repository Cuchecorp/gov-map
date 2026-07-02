---
phase: 50-fix-quick-wins-diagnostico-p1
plan: 03
subsystem: frontend (app/ presentación + error boundaries)
tags: [honest-state, error-boundary, es-CL, anti-insinuacion, camara-chip, autores, B8, B15, B9]
requires:
  - "app/app/parlamentario/[id]/error.tsx (patrón error boundary a espejar)"
  - "ProyectoRow.iniciativa (lib/types.ts)"
provides:
  - "CamaraChip omite null cuando la cámara no aplica (cero 'Cámara origen desconocida' renderizable)"
  - "AutoresList distingue Mensaje del Ejecutivo sin fabricar autores (prop iniciativa)"
  - "4 error.tsx es-CL (proyecto/[boletin], parlamentarios, buscar, agenda) con firma unstable_retry"
affects:
  - "app/components/ficha-header.tsx (pasa iniciativa a AutoresList)"
  - "Plan 50-05 (B7): agenda/error.tsx captura el throw que 50-05 añade a la agenda"
tech-stack:
  added: []
  patterns:
    - "error boundary de este Next: firma { error, unstable_retry } — NO reset"
    - "honest-state sobrio: omitir chip/copy cuando el dato no aplica, nunca fabricar"
key-files:
  created:
    - app/components/camara-chip.test.tsx
    - app/components/autores-list.test.tsx
    - app/app/proyecto/[boletin]/error.tsx
    - app/app/parlamentarios/error.tsx
    - app/app/buscar/error.tsx
    - app/app/agenda/error.tsx
  modified:
    - app/components/camara-chip.tsx
    - app/components/autores-list.tsx
    - app/components/ficha-header.tsx
decisions:
  - "B8: omitir el chip (return null) en vez de degradar a neutro — el dato ausente no se comunica como defecto"
  - "B15: solo iniciativa==='Mensaje' explica el origen; Moción sin autores o iniciativa null (ruta Cámara) sigue 'Autores no informados.' (honesto, no se fabrica)"
  - "B9: firma unstable_retry (NO reset) espejada verbatim de parlamentario/[id]/error.tsx; el error va solo a console.error, nunca al DOM"
metrics:
  duration: ~6min
  completed: 2026-07-02
---

# Phase 50 Plan 03: Fixes de superficie B8/B15/B9 Summary

Omitir el chip-alarma "Cámara origen desconocida" (B8), distinguir Mensaje del Ejecutivo de una Moción sin autores en el copy de autores (B15), y crear los 4 `error.tsx` faltantes espejando el patrón `unstable_retry` existente (B9) — cerrando la paridad de error boundaries en el 100% de las rutas.

## What Was Built

### Task 1 — B8: CamaraChip omite `null` en 'desconocida' (commit 7621f3d)
- `CamaraChip` retorna `null` cuando `classify(camara) === "desconocida"`, antes del render del `<Badge>`. La entrada `desconocida` se eliminó de `STYLES` (el literal "Cámara origen desconocida" ya no existe en el bundle).
- `camaraDotColor` intacto — el dot neutro del timeline sigue degradando a `bg-muted-foreground`.
- Seguro en los 4 call-sites (`timeline-event.tsx:30`, `ficha-header.tsx:23`, `votacion-card.tsx:35`, `parlamentario-header.tsx:42`), todos dentro de `flex flex-wrap gap-2`: omitir no deja hueco.
- Test nuevo `camara-chip.test.tsx` (5 casos): senado→"Senado", diputados→"Cámara", desconocida/null→DOM vacío, negative-match "desconocida".

### Task 2 — B15: AutoresList distingue Mensaje (commit 7f6b4b7)
- Firma nueva `AutoresList({ autores, iniciativa }: { autores: string[]; iniciativa: string | null })`.
- Rama sin autores: `iniciativa === "Mensaje"` → "Iniciativa del Ejecutivo (Mensaje)."; en cualquier otro caso (Moción sin autores, o `iniciativa` null de la ruta Cámara) → "Autores no informados." (honesto, no fabrica).
- `ficha-header.tsx` pasa `iniciativa={proyecto.iniciativa}` (único call-site; verificado por grep).
- Test nuevo `autores-list.test.tsx` (4 casos): Mensaje / Moción / null / con-autores.

### Task 3 — B9: 4 error.tsx nuevos (commit 7f9d77b)
- `proyecto/[boletin]/error.tsx`, `parlamentarios/error.tsx`, `buscar/error.tsx`, `agenda/error.tsx`, espejando VERBATIM `parlamentario/[id]/error.tsx`.
- Cada uno: `"use client"`, firma `{ error, unstable_retry }` (NO `reset` — grep confirma cero `reset` en los 4), `useEffect(() => console.error(error), [error])`, copy es-CL sobrio, botón "Reintentar" → `unstable_retry()`. El `error` va solo a `console.error`; el DOM muestra copy fijo, nunca `error.message`/stack (mitiga T-50-03-ID).
- `<h1>` ajustado por contexto de ruta; `agenda/error.tsx` documenta que captura el `throw` del Plan 50-05 (B7).

## Verification

- `pnpm --filter app test` → **394 verde** (baseline 385 + 5 camara-chip + 4 autores-list).
- `pnpm --filter app exec tsc -b` → **limpio** (exit 0), ningún call-site de AutoresList quedó sin la prop requerida.
- Grep: cero `reset` en los 4 `error.tsx`; cero `Cámara origen desconocida` renderizable.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

Sin nueva superficie: solo `app/**` presentación + boundaries client. Cero RPC nueva, cero `.from()` PII, cero flags/DDL (dispositions T-50-03-CAMA / T-50-03-SC = accept, sin cambio). Los boundaries no filtran `error.message` (T-50-03-ID mitigado).

## Self-Check: PASSED
- Created files present: camara-chip.test.tsx, autores-list.test.tsx, 4× error.tsx — FOUND
- Commits: 7621f3d (B8), 7f6b4b7 (B15), 7f9d77b (B9) — FOUND
