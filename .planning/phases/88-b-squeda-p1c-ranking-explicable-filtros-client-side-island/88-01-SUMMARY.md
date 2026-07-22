---
phase: 88-b-squeda-p1c-ranking-explicable-filtros-client-side-island
plan: "01"
subsystem: buscar
tags: [pure-lib, normalizador, tipos, filt-03]
dependency_graph:
  requires: []
  provides: [estadoBucket, deriveAnio, ETIQUETA_BUCKET, BuscarSliceRow]
  affects: [88-02-island, 88-03-page-wiring]
tech_stack:
  added: []
  patterns: [table-driven-resolver, honest-null, tdd]
key_files:
  created:
    - app/lib/estado-bucket.ts
    - app/lib/estado-bucket.test.ts
  modified:
    - app/lib/types.ts
decisions:
  - "Tabla ordenada terminal-primero: rechazado/archivado/retirado/publicado_ley preceden en_tramitacion para evitar el bug latente de EtapaBadge con textos compuestos"
  - "publicado_ley usa tokens 'public'/'promulg'/'terminada' (no 'ley' solo) para que 'En tramitación … ley' no escale incorrectamente"
  - "BuscarSliceRow usa import() type para EstadoBucket: cero runtime import adicional"
  - "Censo PROD leído con psql read-only el 2026-07-22; 5 estado + 16 etapa valores mapeados"
metrics:
  duration: "~15 min"
  completed: "2026-07-22"
  tasks: 2
  files: 3
---

# Phase 88 Plan 01: estado-bucket + deriveAnio + BuscarSliceRow Summary

Table-driven normalizer de estado texto-libre→bucket enum LOCKED, helper deriveAnio honesto (null nunca fabricado), e interface BuscarSliceRow — contrato serializado que page.tsx pasará al island en plans 02/03.

## What Was Built

**`app/lib/estado-bucket.ts`** — librería pura, sin I/O, sin JSX:
- `EstadoBucket` type (6 valores LOCKED: en_tramitacion, publicado_ley, archivado, rechazado, retirado, sin_dato)
- `estadoBucket(value: string | null): EstadoBucket` — normalizador table-driven, first-match-wins, fallback honest `sin_dato`
- `ETIQUETA_BUCKET` — labels display LOCKED (UI-SPEC §Estado normalizer)
- `deriveAnio(fechaIso: string | null): number | null` — extrae año de ISO con disciplina `^\d{4}$`; JSDoc prohíbe fecha_captura y sufijo de boletín

**`app/lib/estado-bucket.test.ts`** — 25 tests cubriendo:
- Los 6 buckets nominales con valores reales del censo PROD
- Variantes sin_dato (null, vacío, espacios, texto no mapeado)
- Caso compuesto order-matters (tramitación + "ley" → en_tramitacion, NO publicado_ley)
- Insensibilidad a mayúsculas
- deriveAnio: ISO válido, sin TZ, null, vacío, basura, string incompleto

**`app/lib/types.ts`** (modificado) — añade `BuscarSliceRow`:
- Forma serializada camelCase para el island (boletin, titulo, anio, iniciativa, estadoBucket, camaraOrigen, fecha)
- `partido?` opcional para BIO-03 forward-compat
- JSDoc honesto por cada nullable

## Censo PROD (read-only 2026-07-22)

`SELECT DISTINCT estado FROM proyecto`:
- "Archivado" → archivado
- "En tramitación" → en_tramitacion
- "Publicado" → publicado_ley
- "Rechazado" → rechazado
- "Retirado" → retirado

`SELECT DISTINCT etapa FROM proyecto` (16 valores): todos mapeados a en_tramitacion (trámites constitucionales), rechazado (comisiones mixtas por rechazo), publicado_ley (tramitación terminada), archivado.

## Deviations from Plan

None — plan ejecutado exactamente como escrito.

## Threat Flags

Ninguno. Este plan es lógica pura sin red, sin secrets, sin PII. T-88-01 y T-88-03 mitigados con `sin_dato` honesto y JSDoc prohibición.

## Self-Check: PASSED

- `app/lib/estado-bucket.ts` existe con exports correctos
- `app/lib/estado-bucket.test.ts` existe, 25 tests verdes
- `app/lib/types.ts` contiene `BuscarSliceRow` con `partido?` opcional
- Commits: 6792822, 95d1790
- `pnpm exec tsc --noEmit` limpio
- `estado-bucket.ts` no importa React ni Supabase (lib pura verificada)
