---
phase: 128-panel-ui
plan: 02
subsystem: panel-ui
tags: [contrato-jsonb, parse-defensivo, urgencias, agenda]
dependency-graph:
  requires: []
  provides:
    - "app/lib/panel-evidencia.ts (parseEvidenciaProyectos/Citaciones/Sala, etiquetaFuente, gradoUrgencia, urgenciaVigentePorBoletin)"
    - "app/lib/panel-camara.ts (claseCamara exportada)"
  affects:
    - "128-03 (tile proyectos)"
    - "128-04 (tile citaciones/sala)"
    - "128-06 (panel-actualidad.tsx)"
tech-stack:
  added: []
  patterns:
    - "narrowing por clave sobre jsonb (cero `as`), shape parcial degrada a null/[]"
key-files:
  created:
    - app/lib/panel-evidencia.ts
    - app/lib/panel-evidencia.test.ts
    - app/lib/panel-camara.ts
    - app/lib/panel-camara.test.ts
  modified:
    - app/components/panel-actualidad.tsx
decisions:
  - "etiquetaFuente etiqueta DESDE EL DATO (fuente.dataset), tabla solo de legibilidad para los 2 datasets conocidos (tramitacion/agenda); dataset desconocido se devuelve verbatim — nunca un mapa hardcodeado por tipo_senal"
  - "gradoUrgencia descarta el paréntesis de fecha adjunto al literal de urgencia (semántica no verificada, R7); fallback = literal completo, jamás null"
  - "urgenciaVigentePorBoletin: más reciente por fecha (>=), desempate por orden de aparición — jamás por grado (evita ranking implícito, P7)"
metrics:
  duration: "~35 min"
  completed: "2026-07-30"
---

# Phase 128 Plan 02: Contrato TS del jsonb panel-evidencia Summary

Tipado explícito y parse defensivo del jsonb `actualidad_senal.evidencia` (no homogéneo entre
señales: velocity/urgencias/archivados, agenda_citacion, agenda_sala) + tres derivaciones puras
(etiquetaFuente, gradoUrgencia, cruce L5 urgencia↔boletín por fecha más reciente).

## What Was Built

1. **Task 0 (FIX B-3):** `claseCamara` movida verbatim de `panel-actualidad.tsx` (función privada)
   a `app/lib/panel-camara.ts` (export nombrado), con su comentario de regla A intacto.
   `panel-actualidad.tsx` la importa desde `@/lib/panel-camara`. Test unitario nuevo de 3 casos
   (Cámara, Senado, piso-de-corpus). Esto da dueño de wave 1 a la función que 128-03 y 128-04
   necesitan en paralelo en wave 2, evitando copias divergentes o un ciclo de import.

2. **Task 1:** `app/lib/panel-evidencia.ts` con los tipos del contrato (`FuenteEvidencia`,
   `ItemProyecto`, `PuntoCitacion`, `ItemCitacion`, `ItemTablaSala`, `ItemSesionSala`,
   `Evidencia<T>`) y tres parsers (`parseEvidenciaProyectos`, `parseEvidenciaCitaciones`,
   `parseEvidenciaSala`). Narrowing por clave (`typeof x === "string" ? x : null`, etc.) — cero
   `as` sobre el jsonb. Un shape parcial o `{}` (señal suprimida) degrada a
   `{items:[],total:null,consultado_al:null,fuente:{origen:null,dataset:null}}` sin throw. Un
   ítem no-objeto dentro del array (string/number/null) se descarta sin romper el parse.

3. **Task 2:** `etiquetaFuente`, `gradoUrgencia`, `urgenciaVigentePorBoletin` en el mismo módulo.
   `etiquetaFuente` deriva la etiqueta del dato (`fuente.dataset`), con tabla de legibilidad
   ÚNICAMENTE para los 2 datasets conocidos; cualquier otro se devuelve verbatim. `gradoUrgencia`
   normaliza el literal a uno de los 3 grados conocidos, descartando el paréntesis de fecha
   adjunto (semántica no verificada — R7), con fallback honesto al literal completo.
   `urgenciaVigentePorBoletin` construye el Map del cruce L5 tomando la urgencia de `fecha`
   máxima por boletín (jamás por grado — evita fabricar un ranking implícito, P7).

## Verification

- `pnpm test -- lib/panel-evidencia.test.ts lib/panel-camara.test.ts` — 110 test files, 1674
  tests, todos verdes (incluye la suite completa del repo).
- `pnpm exec tsc -b --pretty false` — compila sin errores.
- `grep -v '^\s*//' lib/panel-evidencia.ts | grep -c ' as Item'` → `0`.
- `grep -c "export function claseCamara" lib/panel-camara.ts` → `1`; `grep -c 'from "@/lib/panel-camara"' components/panel-actualidad.tsx` → `1`.

## Deviations from Plan

None — plan ejecutado exactamente como escrito. El único ítem discrecional (desempate
determinista en fechas iguales dentro de `urgenciaVigentePorBoletin`) se implementó como
"último ítem visto en la fecha máxima gana" (`>=` en la comparación), documentado en el docblock
de la función, tal como pedía el `<behavior>` de Task 2.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: app/lib/panel-evidencia.ts
- FOUND: app/lib/panel-evidencia.test.ts
- FOUND: app/lib/panel-camara.ts
- FOUND: app/lib/panel-camara.test.ts
- FOUND commit: 5182634 (refactor claseCamara)
- FOUND commit: 1fb0cb5 (test RED panel-evidencia)
- FOUND commit: 3047282 (feat panel-evidencia)
