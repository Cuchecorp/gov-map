---
phase: 51-leg2-legibilidad-profunda
plan: 07
subsystem: ui
tags: [react, next, ficha-parlamentario, header, resumen, asistencia, legal-03]

# Dependency graph
requires:
  - phase: 45-legibilidad-navegacion
    provides: "ParlamentarioResumen/ResumenView + contarCarriles (React.cache) + 3-estado honesto"
  - phase: 10
    provides: "ParlamentarioHeader (RPC parlamentario_publico, sin PII) + RPC votos_de_parlamentario"
provides:
  - "Header de la ficha muestra 'Período {periodo}' (Mono) cuando el RPC lo trae; omitido si null"
  - "Chip 'Presente en N de M' en el resumen above-fold, derivado de las filas de votos ya cacheadas"
  - "ConteoCarriles +asistencia {presentes,total}|null (honesto, sin fabricar '0 de 0')"
affects: [ficha-parlamentario, legibilidad, futuras-secciones-header]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dato derivado de una lectura ya cacheada (React.cache) — un solo fetch de votos alimenta conteo + asistencia, cero 2do fetch"
    - "Omisión honesta como default: asistencia=null → chip omitido (T-51-22), nunca un conteo fabricado"

key-files:
  created:
    - "app/components/parlamentario-header.test.tsx"
  modified:
    - "app/components/parlamentario-header.tsx"
    - "app/lib/parlamentario-resumen-conteos.ts"
    - "app/components/parlamentario-resumen.tsx"
    - "app/components/parlamentario-resumen.test.tsx"
    - "app/lib/parlamentario-resumen-conteos.test.ts"

key-decisions:
  - "Período renderizado en Geist Mono en línea aparte del join de cargoPartes (UI-SPEC: fechas/IDs en Mono), no como string plano del array"
  - "asistencia derivada de las MISMAS filas de votos_de_parlamentario que contarCarriles ya trae — cero segundo fetch (grep-verificado)"
  - "presente = seleccion !== 'ausente' (regla idéntica a VotosView, sin re-implementar el criterio)"
  - "asistencia como prop OPCIONAL de ResumenView (default null) → callers previos no rompen"

patterns-established:
  - "Chip de hecho neutro above-fold: conteo en Mono, banned-vocab negative-match, jamás ranking/score/juicio"
  - "Enriquecimiento de header restringido a columnas de ParlamentarioPublicoRow (LEGAL-03: nunca partido/rut/email/foto)"

requirements-completed: [LEG2, SC1, SC9]

# Metrics
duration: 12min
completed: 2026-07-03
---

# Phase 51 Plan 07: Enriquecimiento de cabecera/resumen Summary

**Header de la ficha con "Período {periodo}" (Mono, sin PII) + chip "Presente en N de M" en el resumen above-fold, derivado de las filas de votos ya cacheadas sin un segundo fetch.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-03T09:52Z
- **Completed:** 2026-07-03T09:57Z
- **Tasks:** 2
- **Files modified:** 5 (1 creado, 4 modificados)

## Accomplishments
- `ParlamentarioHeader` añade "Período {periodo}" con el valor en Geist Mono cuando el RPC `parlamentario_publico` lo trae; con `periodo=null` se omite la etiqueta entera (honesto, sin "Período " suelto). Sólo columnas públicas — LEGAL-03 intacto.
- `ConteoCarriles` extendido con `asistencia: {presentes,total} | null`, derivado de las MISMAS filas de `votos_de_parlamentario` que `contarCarriles` ya lee (una sola lectura, React.cache). `presente = seleccion !== 'ausente'` (misma regla que `VotosView`).
- El resumen above-fold renderiza un chip conteo neutro "Presente en N de M" (Mono para N/M); sin filas de voto (`asistencia=null`) el chip se omite (T-51-22, nunca "0 de 0" fabricado).
- Suite app/ 476 → 486 verde; `tsc -b` limpio; lockdown-guard verde; cero segundo fetch de votos en el resumen (grep-verificado).

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Task 1: Header período** - `0a2c8fc` (feat)
2. **Task 2: Asistencia derivada + chip "Presente en N de M"** - `651bacf` (feat)

## Files Created/Modified
- `app/components/parlamentario-header.tsx` - cargoPartes + "Período {periodo}" en Mono (omitido si null); docstring LEGAL-03 reforzado
- `app/components/parlamentario-header.test.tsx` (nuevo) - período presente/null + asserts de ausencia de partido/afiliación/rut/email
- `app/lib/parlamentario-resumen-conteos.ts` - tipo `Asistencia`, `ConteoCarriles.asistencia`, derivación desde las filas ya traídas, `conteosDesconocidos().asistencia=null`
- `app/components/parlamentario-resumen.tsx` - `ResumenView` acepta `asistencia?` y renderiza el chip; `ParlamentarioResumen` lo pasa desde `c.asistencia`
- `app/components/parlamentario-resumen.test.tsx` - fixture +asistencia; 4 tests del chip (valor/Mono, null→omitido, default→omitido, banned-vocab)
- `app/lib/parlamentario-resumen-conteos.test.ts` - assert T-51-22: `conteosDesconocidos().asistencia === null`

## Decisions Made
- Período en Mono renderizado en línea aparte del `join(" · ")` de `cargoPartes` (el join produce texto plano; el valor en Mono exige su propio `<span>`). El string `periodo` sigue viviendo en el componente (satisface `contains: periodo`).
- `asistencia` derivada de la lectura de votos existente — NO se añadió ningún `.rpc("votos_de_parlamentario")` nuevo al resumen (acceptance criterion verificado por grep = 0 ocurrencias en `parlamentario-resumen.tsx`).
- `asistencia` es prop OPCIONAL de `ResumenView` (default `null`) para no romper los tests/callers previos de la vista pura.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- El filtro `test -- --run parlamentario-header` de pnpm no acota la suite (corre las 47 test files); los tests nuevos se verifican dentro de la corrida completa (481 → 486 verde). No es un problema del plan, es cómo pnpm reenvía los args a vitest.

## Threat Model Compliance
- **T-51-21 (Information Disclosure, header):** MITIGADO — sólo `region/distrito/circunscripcion/periodo`; test asserta ausencia de partido/afiliación/bancada/rut/email en el DOM.
- **T-51-22 (Repudiation, asistencia sin datos):** MITIGADO — `asistencia=null` sin filas → chip omitido; test lo fija en la vista y en `conteosDesconocidos`.
- **T-51-23 (Repudiation, chip como ranking):** MITIGADO — copy "Presente en N de M" neutro (Mono); banned-vocab negative-match verde.
- **T-51-SC (Tampering, npm installs):** ACCEPTED — cero dependencias nuevas.

## Next Phase Readiness
- Último plan de la Phase 51 (7/7). Suite verde, `tsc -b` limpio, LEGAL-03 intacto, cero DDL/flag/RPC nueva.
- Deploy Cloudflare (build OpenNext Docker Linux + wrangler) = checkpoint operador, como en planes previos de la fase.

---
*Phase: 51-leg2-legibilidad-profunda*
*Completed: 2026-07-03*

## Self-Check: PASSED
- Files created/modified: all FOUND on disk (header + test + conteos + resumen + SUMMARY).
- Commits: `0a2c8fc` (Task 1) and `651bacf` (Task 2) both present in git log.
- Suite app/ 486 verde; `tsc -b` limpio.
