---
phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default
plan: 01
subsystem: database
tags: [postgres, pgtap, rls, deny-by-default, pg_cron, sector, cruces, lobby, jsonb]

# Dependency graph
requires:
  - phase: 35-ent
    provides: "maestra de terceros + reconciliadores que cablean lobby_contraparte (fuente de sector_id)"
  - phase: 11-lobby
    provides: "lobby_audiencia (public-read) + lobby_contraparte (deny-by-default) — fuentes del materializador"
  - phase: 18-net
    provides: "patrón 0030_net.sql (tabla deny-by-default + proc security-definer + cron + RPC) espejado verbatim"
provides:
  - "Catálogo sector (13 macro-sectores, public-read) + columnas sector_id en proyecto_ficha/lobby_contraparte/donante"
  - "Tabla cruce_senal deny-by-default + cruces.materializar_cruces() (full rebuild) + cron cruces-materializar"
  - "RPC cruces_de_parlamentario PII-safe SIN grant a anon (deny-by-default hasta firma Phase 39)"
  - "6 archivos SQL (3 migraciones 0038/0039/0040 + 3 pgTAP) — NO aplicados (apply = Plan 04 BLOCKING)"
affects: [36-02-clasificador, 36-03, 36-04-apply-remoto, 37-superficie-cruces, 39-legal-signoff, 40-rut-aporte]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token de señal lobby-pura ('lobby_sector') con allow-list CHECK; 'lobby_sector_aporte' reservado a Phase 40"
    - "Materializador FULL REBUILD (delete-all + re-insert) — DEPARTURE D-11 vs on-conflict de NET"
    - "Catálogo de taxonomía con codigo como clave estable (D-04) + NULL como honest no-match (D-05, sin catch-all)"
    - "RPC con KEEP revoke from public + DROP grant to anon (deny-by-default en canal de lectura hasta sign-off)"

key-files:
  created:
    - supabase/migrations/0038_sector.sql
    - supabase/migrations/0039_cruce_senal.sql
    - supabase/migrations/0040_cruces_rpc.sql
    - supabase/tests/0038_sector.test.sql
    - supabase/tests/0039_cruce_senal.test.sql
    - supabase/tests/0040_cruces_rpc.test.sql
  modified: []

key-decisions:
  - "[Task 1 — OPERADOR LOCKED] Sectores = A1 (13 macro-sectores; codigo = clave estable D-04; sin catch-all otros D-05)"
  - "[Task 1 — OPERADOR LOCKED] Token de señal MVP = B1 'lobby_sector' (lobby-pura; reserva lobby_sector_aporte a Phase 40)"
  - "Materializador full-rebuild transaccional (D-11) en vez de on-conflict (la señal es un agregado conteo+evidencia)"
  - "cruce_senal y RPC deny-by-default (Candado A); apply al remoto diferido a Plan 04 (BLOCKING)"

patterns-established:
  - "Señal de cruces lobby-pura materializada como agregado (conteo + evidencia jsonb con items[].enlace_fuente)"
  - "Canal de lectura SIN grant a anon hasta sign-off legal — deny-by-default también en el RPC"

requirements-completed: [CRUCE-01, CRUCE-03]

# Metrics
duration: ~14min
completed: 2026-06-24
---

# Phase 36 Plan 01: Capa de cruces parlamentario↔sector (deny-by-default) Summary

**Tres migraciones DDL (0038 catálogo sector public-read + sector_id en 3 tablas / 0039 cruce_senal deny-by-default + materializar_cruces full-rebuild + cron / 0040 RPC cruces_de_parlamentario PII-safe sin grant a anon) y sus tres suites pgTAP, espejando verbatim 0030_net.sql / 0021_lobby.sql / 0034_entidad_tercero.sql — escritas y commiteadas, NO aplicadas (apply = Plan 04).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-24 (Phase 36 execution)
- **Completed:** 2026-06-24
- **Tasks:** 4 (Task 1 = operator decision RESOLVED a priori; Tasks 2-4 ejecutadas)
- **Files modified:** 6 creados

## Accomplishments
- **Catálogo sector public-read** (0038): 13 macro-sectores confirmados (A1) con codigo = clave estable (D-04), sin catch-all 'otros' (D-05); RLS on + policy select to anon + grant select to anon (espejo lobby_audiencia/0021). Tres ALTER aditivos `sector_id text references sector(codigo)` sobre proyecto_ficha, lobby_contraparte, donante (NULL = honest no-match).
- **Señal de cruces deny-by-default** (0039): tabla cruce_senal (forma D-09) con RLS on + cero policies + revoke all from anon,authenticated; CHECK `tipo_senal in ('lobby_sector')` (B1). `cruces.materializar_cruces()` security definer set search_path='' con FULL REBUILD (delete-all + re-insert, D-11); join lobby_audiencia⨝lobby_contraparte por identificador; evidencia jsonb con nombre crudo (D-10) + enlace de fuente; cuerpo sin partido/rut. Cron `cruces-materializar '23 3 * * *'` (offset de net) + assertion post-migración.
- **RPC PII-safe sin grant a anon** (0040): cruces_de_parlamentario(text) security definer, proyección named-column (sector_id, etiqueta, tipo_senal, conteo, evidencia), KEEP revoke from public + DROP grant to anon (deny-by-default hasta firma Phase 39). Cuerpo sin partido/rut/email/donante_id.
- **3 suites pgTAP** afirman: sector public-read + 3 columnas + FK; cruce_senal deny-by-default (throws_ok 42501 anon) + prosecdef + body no-PII + ≥5 parlamentarios + evidencia trazable + cron; RPC not has_function_privilege(anon) + prosecdef + body no-PII.

## Task Commits

1. **Task 1: Confirmar catálogo de sectores + token de señal** — RESUELTO por operador a priori (A1 + B1); registrado en decisiones (sin commit propio).
2. **Task 2: Migración 0038 — catálogo sector + columnas sector_id** — `b63696c` (feat)
3. **Task 3: Migración 0039 — cruce_senal + materializar_cruces + cron** — `d796944` (feat)
4. **Task 4: Migración 0040 — RPC cruces_de_parlamentario sin grant a anon** — `02fbccf` (feat)

**Plan metadata:** (final docs commit — este SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `supabase/migrations/0038_sector.sql` - Catálogo sector public-read (13 sectores A1) + 3 columnas sector_id aditivas
- `supabase/migrations/0039_cruce_senal.sql` - Tabla cruce_senal deny-by-default + materializar_cruces() full-rebuild + cron
- `supabase/migrations/0040_cruces_rpc.sql` - RPC cruces_de_parlamentario PII-safe SIN grant a anon
- `supabase/tests/0038_sector.test.sql` - pgTAP: public-read + 3 columnas + FK + cero 'otros' (11 asserts)
- `supabase/tests/0039_cruce_senal.test.sql` - pgTAP: deny-by-default + body no-PII + ≥5 parlamentarios + cron (11 asserts)
- `supabase/tests/0040_cruces_rpc.test.sql` - pgTAP: not has_function_privilege(anon) + body no-PII (4 asserts)

## Decisions Made

### Decisiones de operador LOCKED (Task 1 — resueltas a priori)
- **Sectores (Decisión A) = A1**: aceptar los 13 macro-sectores propuestos. `codigo` = clave estable (D-04, nunca renombrar/borrar); sin catch-all 'otros' (D-05). Usados verbatim en el seed de 0038 y como fuente única de SECTOR_CODIGOS para Plan 02:
  `salud`, `educacion`, `mineria_energia`, `medio_ambiente`, `trabajo_prevision`, `vivienda_urbanismo`, `transporte`, `agricultura_pesca`, `banca_finanzas`, `comercio_industria`, `tecnologia`, `seguridad_justicia`, `gremios_trabajadores`.
- **Token de señal (Decisión B) = B1**: `tipo_senal = 'lobby_sector'` (lobby-pura). Usado verbatim en el CHECK de 0039 (`tipo_senal in ('lobby_sector')`) y en el INSERT del materializador. `'lobby_sector_aporte'` RESERVADO para Phase 40 (no usado aquí).

### Decisiones de implementación
- Materializador FULL REBUILD (delete-all + re-insert) en vez del on-conflict-do-nothing de 0030_net.sql — DEPARTURE D-11 documentada en el header: la señal es un agregado (conteo + evidencia jsonb) que debe reflejar el estado actual completo en cada corrida.
- Cron offset `'23 3 * * *'` para evitar colisión con `'17 3'` de net-materializar-aristas.
- Schema propio `cruces` para los internals (no reusar `net` de pg_net ni `grafo` de NET).
- RPC con KEEP revoke from public + DROP grant to anon (la ONE departure vs subgrafo_red/lobby_de_parlamentario, que sí conceden a anon) — Candado A del doble candado de cruces, deny-by-default hasta sign-off Phase 39.

## Deviations from Plan

None - plan executed exactly as written. Task 1 (checkpoint de operador) fue resuelto a priori por el operador (A1 + B1); las Tasks 2-4 usaron esos valores verbatim. Todos los greps de verify verdes.

## Issues Encountered
None. Las tres tablas objetivo (proyecto_ficha en 0011, lobby_contraparte en 0021, donante en 0024) se verificaron antes de escribir los ALTER. Numeración 0038/0039/0040 correcta (PROD actual = 0037).

## User Setup Required
None - no external service configuration required en este plan.

## Next Phase Readiness
- **Plan 02/03 (clasificador):** SECTOR_CODIGOS = los 13 códigos de 0038 (clave estable). El clasificador etiqueta `sector_id` sobre proyecto_ficha/lobby_contraparte/donante; el golden se construye contra esta taxonomía.
- **Plan 04 (apply remoto — BLOCKING):** aplicar 0038→0039→0040 por `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f <mig>` (NUNCA `supabase db push` — PROD ≤0037) + registrar en schema_migrations + correr pgTAP 0038/0039/0040 sin regresión + probe deny-by-default con anon key (`select * from cruce_senal` → permission denied). Esquivar BOM U+FEFF.
- **GATE legal (Phase 39):** el RPC cruces_de_parlamentario y el gate de presentación siguen deny-by-default/OFF hasta la firma humana exclusiva.

## Self-Check: PASSED

- 6 archivos SQL + SUMMARY.md verificados en disco (FOUND).
- Commits b63696c / d796944 / 02fbccf verificados en git log (FOUND).

---
*Phase: 36-cruce-capa-de-cruces-parlamentario-sector-deny-by-default*
*Completed: 2026-06-24*
