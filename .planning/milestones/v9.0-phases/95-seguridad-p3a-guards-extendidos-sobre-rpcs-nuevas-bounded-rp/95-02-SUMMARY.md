---
phase: 95-seguridad-p3a-guards-extendidos-sobre-rpcs-nuevas-bounded-rp
plan: "02"
subsystem: app/lib
tags: [security, ci-guard, lockdown, anti-insinuacion, rpc-allowlist, direction-b]
dependency_graph:
  requires: [95-01-SUMMARY.md]
  provides: [lockdown Direction-B, (A3) crossLinkReader coverage, SUPERFICIES_DEEPLINK 89]
  affects: [app/lib/lockdown-guard.test.ts, app/lib/anti-insinuacion-guard.test.ts]
tech_stack:
  added: []
  patterns: [pure-detector + mutation self-check, Direction-B allowlist ⊆ defined, crossLinkReader literal extraction]
key_files:
  created: []
  modified:
    - app/lib/lockdown-guard.test.ts
    - app/lib/anti-insinuacion-guard.test.ts
decisions:
  - "Regex Direction-B con public. OPCIONAL ((?:public\\.)?): match_proyectos/parlamentario_publico/parlamentarios_publico se definen sin qualifier → regex obligatorio produce 3 falsos orphans y llevaría a relajar el guard"
  - "Scope Direction-B repo-wide (TODAS las migraciones, no filtrado >0044): las 3 RPCs mencionadas son pre-0044 y deben respaldarse"
  - "provenance-badge.tsx incluida en SUPERFICIES_DEEPLINK: el archivo existe — inclusión directa sin existsSync condicional"
  - "No NEGACIONES_LOCKED nueva: validacion-fuente.tsx copy factual (URLs/fecha/hash), sin términos prohibidos ni negaciones"
metrics:
  duration: "~20 min"
  completed: "2026-07-23"
  tasks: 3
  files: 2
---

# Phase 95 Plan 02: Guards extendidos — Direction-B + crossLinkReader + DeepLink 89 Summary

Guards CI extendidos sobre las RPCs y superficies nuevas de P1/P2: Direction-B (allowlist ⊆ definidas, regex public.-opcional) + cobertura del blind-spot crossLinkReader (A3) + superficie deep-link 89 (validacion-fuente) enumerada en el linter anti-insinuación, cada uno con mutation self-check que prueba que el guard muerde.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | lockdown-guard: Direction-B + (A3) crossLinkReader | 5328327 | app/lib/lockdown-guard.test.ts |
| 2 | anti-insinuacion-guard: SUPERFICIES_DEEPLINK (89) + self-check | 7c04c16 | app/lib/anti-insinuacion-guard.test.ts |
| 3 | Suite completa verde + tsc limpio | — (verificación) | — |

## Deviations from Plan

None — plan executed exactly as written. El regex public.-opcional ya estaba documentado en el plan (PLAN.md interfaces §REGEX DIRECTION-B); se aplicó sin desviación.

## Suite Results

- `pnpm exec vitest run lib/lockdown-guard.test.ts`: 14/14 tests verdes (7 anteriores + 7 nuevos: sanity + Direction-B real + Direction-B self-check + cross-link sanity + cross-link real + cross-link self-check).
- `pnpm exec vitest run lib/anti-insinuacion-guard.test.ts`: 27/27 tests verdes (26 anteriores + 1 nuevo: DEEPLINK self-check).
- `pnpm exec tsc --noEmit`: 0 errores.
- `pnpm exec vitest run` (suite completa): 1227/1228 tests verdes. El único fallo es `money-antiflip-guard.test.ts:306` — timeout pre-existente en el test "WR-03: ningún archivo fuente de packages/ nombra MONEY_PUBLIC_ENABLED crudo", no introducido por esta fase (documentado en STATE.md como deuda pre-existente).

## Success Criteria Closed

- **SC#1:** Guards re-corridos y extendidos sobre superficies nuevas — cobertura crossLinkReader (blind-spot Direction-A) + superficie 89 anti-insinuación.
- **SC#3:** Drift bidireccional = 0 — Direction-A existente (servida ⊆ allowlist) + Direction-B nueva (allowlist ⊆ definidas, 0 orphans reales, regex public.-opcional).
- **SC#4:** Mutation self-checks sobre lo nuevo — Direction-B fantasma, cross-link no-listado, deep-link "influencia" — los guards MUERDEN, no pasan por vacío.

## Threat Surface Scan

No new endpoints, auth paths, file access patterns, or schema changes. Plan puro app/lib test files, cero contacto con la DB viva.

## Self-Check: PASSED

- `app/lib/lockdown-guard.test.ts`: FOUND, 14 tests verdes, contiene `(?:public\\.)?` en definedRpcNames
- `app/lib/anti-insinuacion-guard.test.ts`: FOUND, 27 tests verdes, contiene SUPERFICIES_DEEPLINK en el spread del loop
- Commits 5328327 y 7c04c16: FOUND en git log
- Block A y Block B de lockdown-guard intactos (7 tests anteriores siguen verdes)
- Arrays VOTO/MONEY/HOME/BUSQUEDA/PERSONAS/LOBBY/AGENDA de anti-insinuacion-guard intactos
