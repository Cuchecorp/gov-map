---
phase: 50-fix-quick-wins-diagnostico-p1
plan: 01
subsystem: app/lib (helpers de formateo puros)
tags: [format, frescura, honest-state, wave-1, interface-first]
requirements: [B6, B12, B17]
dependency_graph:
  requires: []
  provides:
    - "esStale con umbral 14 días retro-compatible (default propaga a ~12 consumidores de ProvenanceBadge)"
    - "capitalizarPrimera (helper puro es-CL)"
    - "fechaCortaSegura (guard ISO WR-03 que degrada a copy honesto)"
  affects:
    - "Plan 50-05 (wave 2): aplica capitalizarPrimera en agenda/page.tsx y fechaCortaSegura en patrimonio-de-parlamentario.tsx"
    - "Todos los componentes que usan ProvenanceBadge (umbral de amber cambia de 48h a 14d sin tocar call-sites)"
tech_stack:
  added: []
  patterns:
    - "Firma retro-compatible por tercer parámetro opcional con default (esStale)"
    - "Guard ISO (slice + regex antes de new Date) que DEGRADA a fallback honesto en vez de EXCLUIR la fila (variante de WR-03)"
key_files:
  created: []
  modified:
    - app/lib/format.ts
    - app/lib/format.test.ts
    - app/components/provenance-badge.test.tsx
decisions:
  - "esStale suma un tercer parámetro opcional staleAfterMs (default 14d) en vez de cambiar la firma → el único call-site provenance-badge.tsx:33 esStale(capturedAt) compila intacto y el nuevo default propaga a todos los consumidores."
  - "fechaCortaSegura DEGRADA a 'fecha no informada' (copy honesto) en lugar de EXCLUIR la fila como el guard del chart de patrimonio (:130-137), porque las superficies destino (VersionRow, vista detalle) sí muestran la fila."
  - "capitalizarPrimera conserva la coma del locale es-CL; solución mínima (solo capitalización, NO normaliza el resto del formato) — evita el text-transform:capitalize de Tailwind que capitaliza cada palabra."
metrics:
  duration: ~10min
  tasks: 2
  files: 3
  completed: 2026-07-02
---

# Phase 50 Plan 01: Helpers de formateo (capa de contratos wave 1) Summary

Capa interface-first de la Phase 50: fija `esStale` (umbral por cadence de ingesta, 14 días) y agrega `capitalizarPrimera` + `fechaCortaSegura` como helpers puros exportados en `app/lib/format.ts`, con sus tests unitarios y el fixture dependiente del umbral actualizado. Los helpers B12/B17 se APLICAN en componentes en el Plan 50-05; B6 propaga solo con el cambio de default.

## What Was Built

### Task 1 — B6: esStale umbral 48h → 14 días (retro-compatible) — commit 5a780f5
- `STALE_THRESHOLD_MS` pasa de `48 * 60 * 60 * 1000` a `14 * 24 * 60 * 60 * 1000`, con docstring que explica el porqué: ingesta semanal ⇒ 2× cadence = margen honesto; 48h fijas dejaban el badge en ámbar permanente (falso positivo de frescura, diagnóstico B6).
- `esStale` gana un tercer parámetro opcional `staleAfterMs: number = STALE_THRESHOLD_MS`, manteniendo `capturedAt` como primer parámetro y `now` como segundo. El único call-site (`provenance-badge.tsx:33`, `esStale(capturedAt)`) compila sin cambios.
- `format.test.ts`: el caso `">48h → true"` (49h) se reescribió a dos casos `≤14d → false` (13 días) y `>14d → true` (15 días); el caso reciente (47h) queda verde.
- `provenance-badge.test.tsx`: fixture stale 72h → 15 días.
- **`app/components/provenance-badge.tsx` NO fue modificado** (git diff --stat vacío verificado antes del commit).

### Task 2 — B12/B17: capitalizarPrimera + fechaCortaSegura + tests — commit 3b745f9
- `capitalizarPrimera(s: string): string` — `s.charAt(0).toUpperCase() + s.slice(1)`. Docstring es-CL espejando `extractoIdea`/`conteoVotacion`; explica por qué NO usar `capitalize` de Tailwind.
- `fechaCortaSegura(raw: string | null, fallback = "fecha no informada"): string` — espeja el guard WR-03 (`slice(0,10)` + regex `^\d{4}-\d{2}-\d{2}$` antes de `new Date`), pero DEGRADA a `fallback` en vez de excluir la fila; reutiliza `fechaCorta` para el caso válido. NUNCA puede retornar "Invalid Date" (test cubre mes inválido `2024-13-99` → fallback).
- `format.test.ts`: 7 tests nuevos cubriendo los 6 comportamientos del `<behavior>` + un caso extra anti-"Invalid Date".

## Verification

- `pnpm --filter app test -- lib/format.test.ts components/provenance-badge.test.tsx` → verde (suite completa 385/385 tras Task 2; format.test.ts 18 tests).
- `pnpm --filter app exec tsc -b` → limpio (exit 0).
- `git diff app/components/provenance-badge.tsx` → vacío (solo el test cambió, no la fuente).
- Suite app/ pasó de baseline 377 a 385 (+8 tests nuevos de helpers; +1 test extra anti-"Invalid Date" sobre los 6 comportamientos, y el split de esStale a 3 casos).

## Deviations from Plan

None — plan ejecutado exactamente como fue escrito. Cero RPC, cero `.from()` PII, cero cambios de flags/DDL (Camino A intacto).

## Threat Model Compliance

- **T-50-01-INT** (integridad de frescura): mitigado — umbral por cadence (14d) refleja la ingesta semanal real; tests fijan ≤14d→false / >14d→true.
- **T-50-01-AV** (Invalid Date): mitigado — `fechaCortaSegura` valida ISO por regex antes de `new Date` y degrada a copy honesto; test cubre null/""/no-ISO/mes-inválido.
- **T-50-01-CAMA** / **T-50-01-SC**: aceptados sin superficie nueva (plan puramente `lib/*`+tests; sin packages instalados).

## Known Stubs

Ninguno. `capitalizarPrimera` y `fechaCortaSegura` son helpers puros completos; su cableado en componentes es trabajo explícito del Plan 50-05 (wave 2), no un stub.

## Self-Check: PASSED
- FOUND: app/lib/format.ts (esStale 14d + capitalizarPrimera + fechaCortaSegura)
- FOUND: app/lib/format.test.ts (18 tests)
- FOUND: app/components/provenance-badge.test.tsx (fixture 15 días)
- FOUND commit: 5a780f5 (Task 1)
- FOUND commit: 3b745f9 (Task 2)
