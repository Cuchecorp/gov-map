---
phase: 54
plan: 01
subsystem: frontend
tags: [display-formatter, ux, anti-insinuacion, identidad]
requires:
  - "app/lib/format.ts (helpers previos: fechaCorta, extractoIdea, conteoVotacion)"
provides:
  - "formatNombre() — helper puro display-only (passthrough Unicode + Title Case por sub-token)"
  - "11 superficies ciudadanas renderizan nombres formateados (case-only)"
affects:
  - "Ficha parlamentario, directorio, ficha proyecto (votos), lobby, cruces, red, agenda, contraparte (gated)"
tech-stack:
  added: []
  patterns:
    - "Passthrough guard Unicode /\\p{Lu}/u (NO ASCII) — cubre Ñ/Á sin A-Z"
    - "Display-only wrap: keys/params/hrefs/comparaciones SIEMPRE usan el string RAW"
key-files:
  created: []
  modified:
    - "app/lib/format.ts"
    - "app/lib/format.test.ts"
    - "app/components/parlamentario-header.tsx"
    - "app/components/parlamentario-directory-row.tsx"
    - "app/components/voto-row.tsx"
    - "app/components/voto-ficha-row.tsx"
    - "app/components/lobby-de-parlamentario.tsx"
    - "app/components/lobby-en-tramitacion.tsx"
    - "app/components/cruces-de-parlamentario.tsx"
    - "app/components/red/nodo-parlamentario.tsx"
    - "app/app/red/page.tsx"
    - "app/app/contraparte/[id]/page.tsx"
    - "app/components/citacion-card.tsx"
    - "app/app/metodologia/page.tsx"
decisions:
  - "Nota de tildes ubicada en /metodologia sección 'Cómo se reporta cada dato' (existe sección de datos ahí; no hizo falta /sobre)"
  - "En superficies con const de nombre compartido (header, nodo, contraparte) se computa nombreDisplay una vez y se reusa en h1/aria/breadcrumb"
metrics:
  duration: "~8 min"
  completed: "2026-07-07"
  tasks: 3
  files: 14
---

# Phase 54 Plan 01: formatNombre + 11 superficies ciudadanas Summary

`formatNombre()` display-only con passthrough guard Unicode (`/\p{Lu}/u`) + Title Case por sub-token, aplicado en los 11 render points ciudadanos del UI-SPEC sin tocar datos, keys, params ni hrefs; el string `nombre_normalizado` sigue siendo la clave de matching y proyección PII-safe.

## What Was Built

- **Task 1 (TDD):** `formatNombre(raw)` en `app/lib/format.ts` junto a `fechaCorta` (helpers previos byte-identical). 14 test cases nuevos: tabla del SPEC + 4 casos de datos reales del censo PROD (`enrique rysselberghe van`, `camara chilena de la construcción`, `fundación mas familia Ñuble`, `kypco spa`) + idempotencia sobre todos. RED (14 fallando) → GREEN (32/32 en el archivo).
- **Task 2 (superficies 1-6):** parlamentario-header (h1 + breadcrumb, string compartido), parlamentario-directory-row, voto-row (ambas ramas, link guard intacto), voto-ficha-row, lobby-de-parlamentario (`:236` solo), lobby-en-tramitacion (texto plano LOCKED 52-03; React key sigue RAW).
- **Task 3 (superficies 7-11 + doc):** cruces-de-parlamentario (IdentityMarker + intro intactos), red/nodo-parlamentario (label + aria-label), red/page (option labels; `value`/`key` intactos), contraparte/[id] (h1 + breadcrumb, gated), citacion-card (invitados), + 1 línea factual de limitación de tildes en `/metodologia`.

## Invariantes anti-insinuación respetadas (HARD)

- Passthrough guard usa `/\p{Lu}/u` — la fila real `"fundación mas familia Ñuble"` (Ñ, cero A-Z) pasa verbatim; un guard ASCII la re-casearía mal.
- NUNCA se agregan tildes, NUNCA se reordenan tokens, NUNCA se normaliza puntuación interior.
- React keys (`lobby-en-tramitacion:237`, option `key={r.id}`), RPC params, hrefs (`/parlamentario/${id}`, `option value={r.id}`) y comparaciones (`estado_vinculo === "confirmado"`) siguen usando el string RAW en las 11 superficies.
- Carril lobby×tramitación sigue texto plano / no-enlazado (LOCKED 52-03) — solo cambia el case.
- Zonas explícitamente NO tocadas: lobby-de-parlamentario `:262-263` (Plan 04), cruces intro `:89-93` (Plan 02), contraparte skeleton `:161-169` (Plan 04), IdentityMarker.

## Verification

- `npx vitest run lib/format.test.ts` → 32/32 verde (incluye todos los casos del behavior + idempotencia).
- Suite completa del app: **579 passed** (baseline 565 + 14 nuevos formatNombre), 52 test files, cero regresión.
- `npx tsc -b` → exit 0 (sin errores de tipo).
- Grep de sanidad: `formatNombre(` NO aparece junto a `key=`, `href=`, `value=` de option ni en params RPC (0 matches).

## Deviations from Plan

None - plan executed exactly as written. La nota de tildes cupo en `/metodologia` (sección "Cómo se reporta cada dato"), sin necesitar `/sobre` como fallback.

## Notas sobre datos reales (passthrough en la práctica)

- `voto.mencion_nombre` y `citacion_invitado.nombre`: 100% pre-caseados → `formatNombre` es no-op passthrough hoy; los tests de esas superficies asertan passthrough y no cambiaron.
- `lobby_contraparte.nombre`: 98.7% passthrough.
- `parlamentario.nombre_normalizado`: 100% minúsculas → superficies 1, 2, 8, 9 (y 6 vía RPC) SÍ transforman. Los fixtures de test existentes ya usaban nombres pre-caseados, por lo que ningún assert se rompió por el cambio de case.

## Self-Check: PASSED

- FOUND: app/lib/format.ts (formatNombre exportado)
- FOUND: app/lib/format.test.ts (14 casos nuevos)
- FOUND commits: c444d83 (test RED), 9c2efca (feat helper), 4c75243 (superficies 1-6), 2bcd92e (superficies 7-11 + metodologia)
