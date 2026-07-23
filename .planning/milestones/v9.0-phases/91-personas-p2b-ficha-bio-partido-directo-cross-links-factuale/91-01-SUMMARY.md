---
phase: 91-personas-p2b-ficha-bio-partido-directo-cross-links-factuale
plan: 01
subsystem: database
tags: [postgres, rpc, security-definer, pgtap, pii-minimization, pgvector-adjacent, camino-a]

# Dependency graph
requires:
  - phase: 90-personas-p2a
    provides: "tablas parlamentario_militancia (363) / comision (34) / comision_membresia (386) + parlamentario.partido refrescado 186/186, deny-by-default"
  - phase: 87-busqueda-p1b
    provides: "patrón 0055: drop defensivo + create-or-replace + search_path='' + doble-revoke CERO grant"
provides:
  - "Migración 0060 aplicada a PROD: 8 RPCs security-definer PII-safe (cabecera v2, listado v2, militancias, comisiones, 4 cross-links)"
  - "Partido DIRECTO en cabecera/listado (militancia vigente + fecha_captura + origen) — revierte la retención LEGAL-03 de 0020 por decisión operador 2026-07-21"
  - "Row-types de contrato para los planes de montaje 02/03: ParlamentarioPublicoRow/ListadoRow ampliados + MilitanciaRow/ComisionRow/CrossLinkRow"
  - "8 RPCs nuevas en PUBLIC_RPC_ALLOWLIST (lockdown-guard Block-B)"
affects: [91-02, 91-03, ficha-parlamentario, directorio-parlamentarios, cross-links, FILT-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC v2 paralela (no altera la 0020/0026 in-place): evita 42P13 + re-arma de default privileges; el partido lo emite una firma nueva documentada, no una regresión silenciosa de LEGAL-03"
    - "LEFT JOIN LATERAL limit 1 (es_actual, desde desc) para derivar el partido vigente + su provenance sin N+1"
    - "Cross-links factuales bounded: orden NEUTRAL alfabético por nombre, conteo honesto (n_proyectos) NUNCA como criterio de orden (anti-ranking de afinidad)"

key-files:
  created:
    - supabase/migrations/0060_bio_partido_publico.sql
    - supabase/tests/0060_bio_partido_publico.test.sql
  modified:
    - app/lib/types.ts
    - app/lib/lockdown-guard.test.ts
    - app/components/parlamentario-header.test.tsx

key-decisions:
  - "Firmas v2 paralelas (parlamentario_publico_v2 / parlamentarios_publico_v2) en vez de alterar 0020/0026: menos invasivo, no toca default privileges, 0020 queda intacto para el guard histórico"
  - "El partido se deriva de parlamentario_militancia (es_actual), NO de la columna parlamentario.partido: la militancia trae su propia fecha_captura+origen para el rótulo 'según fuente al [fecha]'"
  - "coautores_de_parlamentario emite n_proyectos (conteo honesto) pero ordena por nombre — ordenar por el conteo sería ranking de afinidad (prohibido)"
  - "de_la_misma_zona: los NULL (distrito/circunscripción ausentes) NUNCA hacen match entre sí"

patterns-established:
  - "RPC v2 super-set: el row-type existente se AMPLÍA (no se duplica) porque page.tsx migrará a la RPC v2; el fixture de test añade los campos nuevos como null"
  - "pgTAP contra schema APLICADO como única prueba válida del DDL (Pitfall 6): 30 ok / 0 not ok"

requirements-completed: [BIO-02, BIO-03, BIO-04]

# Metrics
duration: ~8min
completed: 2026-07-22
---

# Phase 91 Plan 01: Ficha bio + partido directo + cross-links factuales — Canal de datos Summary

**Migración 0060 aplicada a PROD con 8 RPCs security-definer PII-safe que sirven partido DIRECTO (militancia vigente + fuente), militancias, comisiones y 4 cross-links factuales bounded — doble-revoke CERO grant, pgTAP 30/30 verde contra el schema aplicado.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-22T16:18:38Z
- **Completed:** 2026-07-22T16:26:34Z
- **Tasks:** 3
- **Files modified:** 5 (2 creados, 3 modificados)

## Accomplishments
- Migración 0060 con 8 RPCs hardened (`security definer set search_path=''`, doble-revoke CERO grant VERBATIM de 0055): `parlamentario_publico_v2`, `parlamentarios_publico_v2`, `militancias_de_parlamentario`, `comisiones_de_parlamentario` + 4 cross-links (`copartidarios_de_parlamentario`, `de_la_misma_zona`, `co_comisionados_de_parlamentario`, `coautores_de_parlamentario`).
- Partido DIRECTO en cabecera y listado (militancia vigente + `partido_fecha_captura` + `partido_origen`), documentando en la cabecera SQL la reversión operador 2026-07-21 vs la retención LEGAL-03 de 0020.
- Row-types de contrato en `types.ts` (2 ampliados + 3 nuevos) + 8 RPCs en `PUBLIC_RPC_ALLOWLIST` (orden alfabético).
- **0060 APLICADA a PROD** por el agente (DDL aditivo, dentro de autoridad, precedente 0055-0059) + **pgTAP 30 ok / 0 not ok** contra el schema aplicado.

## Task Commits

1. **Task 1: Migración 0060 — RPCs cabecera+militancias+comisiones+listado ampliado** (y las 4 cross-links de Task 2, mismo archivo) — `26ce8e1` (feat)
2. **Task 2: pgTAP + row-types + allowlist** — `fbe9f22` (feat)
3. **Task 3: Aplicar 0060 a PROD + pgTAP contra schema aplicado** — sin commit de código (acto de apply LIVE; resultados documentados aquí)

**Plan metadata:** (final docs commit)

## Files Created/Modified
- `supabase/migrations/0060_bio_partido_publico.sql` — 8 RPCs security-definer, doble-revoke CERO grant, cabecera documenta la reversión operador 2026-07-21.
- `supabase/tests/0060_bio_partido_publico.test.sql` — pgTAP plan(30): firmas existen, security definer, cero grant anon, sin rut/email/partido_alias, partido presente.
- `app/lib/types.ts` — `ParlamentarioPublicoRow`/`ParlamentarioListadoRow` +partido/fecha/origen; nuevos `MilitanciaRow`/`ComisionRow`/`CrossLinkRow`.
- `app/lib/lockdown-guard.test.ts` — +8 RPCs en `PUBLIC_RPC_ALLOWLIST` (alfabético, incluye ambas v2).
- `app/components/parlamentario-header.test.tsx` — fixture +3 campos partido null (compila con el super-set v2).

## Decisions Made
- **Firmas v2 paralelas** en vez de alterar 0020/0026 in-place: evita el gotcha 42P13 (cambiar returns table → drop obligatorio → re-arma default privileges) y deja 0020 intacto, de modo que el guard histórico de LEGAL-03 no aparece violado.
- **Partido desde la militancia vigente** (`parlamentario_militancia` where `es_actual`), no desde `parlamentario.partido`: la militancia trae su propia `fecha_captura`/`origen` para el rótulo "según fuente al [fecha]".
- **Anti-ranking en co-autoría:** `n_proyectos` es dato honesto pero el orden es por nombre, nunca por el conteo (evita ranking de afinidad).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture de test rompía tsc con el super-set v2**
- **Found during:** Task 2 (ampliar `ParlamentarioPublicoRow`)
- **Issue:** `app/components/parlamentario-header.test.tsx` construye un literal `ParlamentarioPublicoRow` sin los 3 campos nuevos → `tsc -b` fallaba (TS2739). Causado directamente por la ampliación del tipo.
- **Fix:** Añadidos `partido: null, partido_fecha_captura: null, partido_origen: null` al fixture BASE (default honesto: sin militancia vigente). El test sigue verde y sus aserciones (partido no renderizado con null) permanecen válidas hasta que el plan de UI 02/03 revisite el montaje del chip.
- **Files modified:** app/components/parlamentario-header.test.tsx
- **Verification:** `tsc -b` exit 0; `pnpm vitest run components/parlamentario-header.test.tsx` 5/5 verde.
- **Committed in:** `fbe9f22` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necesario para compilar el super-set v2. Sin scope creep — el MONTAJE del chip de partido en el header queda explícitamente diferido a los planes de UI 02/03.

## Issues Encountered
None — el apply a PROD y el pgTAP corrieron limpios en el primer intento.

## Verification Results (Task 3 — schema APLICADO)

**pgTAP `supabase/tests/0060_bio_partido_publico.test.sql` contra PROD:** `1..30` → **30 ok / 0 not ok**.

**Verificación funcional (SELECT read-only):**
- `parlamentario_publico_v2('D1074')` → `D1074 | Marisela Santibáñez Novoa | diputados | Independientes | 2026-07-22 13:36:10+00 | camara-bio-diputados` — **partido NO-null**.
- Firma de salida de la RPC v2: `TABLE(id, nombre, camara, region, distrito, circunscripcion, periodo, origen, fecha_captura, enlace, partido, partido_fecha_captura, partido_origen)` — **cero columna rut/email**.
- Smoke-test de las 8 RPCs (id D1074): militancias 6, comisiones 3, co_comisionados 20 (cap), de_la_misma_zona 0 (honesto — sin distrito/circunscripción coincidente), copartidarios 20 (cap), coautores 20 (cap), listado v2 = **186 filas / 186 con partido**. Todos los LIMIT bounded (≤20/≤50) operativos.

## User Setup Required
None — no external service configuration required. La migración 0060 ya fue aplicada a PROD por el agente (DDL aditivo, dentro de autoridad; precedente 0055-0059).

## Next Phase Readiness
- **Contratos listos para el montaje (Plans 02/03):** firmas RPC v2 + row-types congelados; la UI puede leer partido/militancias/comisiones/cross-links sin explorar el schema.
- **Diferido a UI (02/03):** montaje del chip de partido "según fuente al [fecha]" en `ParlamentarioHeader`, sección de militancia histórica (acordeón desde/hasta), bloques de cross-links con leyenda anti-causal, filtro por partido en /parlamentarios (island client-side sobre `parlamentarios_publico_v2`), extensión del linter anti-insinuación a las superficies nuevas.
- **Sin blockers de operador** para este plan.

## Self-Check: PASSED

- Files verified: 0060 migration, 0060 pgTAP test, types.ts, lockdown-guard.test.ts, 91-01-SUMMARY.md — all FOUND.
- Commits verified: `26ce8e1`, `fbe9f22` — all FOUND in git log.

---
*Phase: 91-personas-p2b-ficha-bio-partido-directo-cross-links-factuale*
*Completed: 2026-07-22*
