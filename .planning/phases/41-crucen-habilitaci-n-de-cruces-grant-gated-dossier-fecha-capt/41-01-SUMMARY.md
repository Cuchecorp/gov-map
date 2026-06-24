---
phase: 41-crucen-habilitaci-n-de-cruces-grant-gated-dossier-fecha-capt
plan: 01
subsystem: cruces (RPC + ficha parlamentario)
tags: [crucen-01, wr-02, fecha_captura, deny-by-default, pii-safe, provenance]
requires:
  - "0040_cruces_rpc.sql aplicada en PROD (RPC base sin fecha_captura)"
  - "cruce_senal.fecha_captura (columna de 0039)"
provides:
  - "RPC cruces_de_parlamentario proyecta fecha_captura (nivel señal) — 0041 ESCRITA (apply = operador)"
  - "ProvenanceBadge de cada evidencia usa s.fecha_captura → mata stale-amber falso (WR-02)"
  - "CruceSenalRpcRow.fecha_captura: string"
affects:
  - "app/components/cruces-de-parlamentario.tsx (badge + texto factual de reunión)"
  - "supabase: nueva migración 0041 (no aplicada) + pgTAP 0041"
tech-stack:
  added: []
  patterns:
    - "drop+recreate por returns table modificado (42P13) + doble revoke re-emitido (DEFAULT PRIVILEGES)"
    - "pgTAP proargnames bag_has + array_to_string ordenado (no pg_get_function_result)"
    - "frescura = fecha de materialización del cruce (rebuild diario), no fecha de fuente/reunión"
key-files:
  created:
    - supabase/migrations/0041_cruces_rpc_fecha_captura.sql
    - supabase/tests/0041_cruces_rpc_fecha_captura.test.sql
  modified:
    - app/lib/types.ts
    - app/components/cruces-de-parlamentario.tsx
    - app/components/cruces-de-parlamentario.test.tsx
    - app/app/parlamentario/[id]/page.test.tsx
decisions:
  - "Apply de 0041 a PROD DIFERIDO — checkpoint operador (gate 4); el agente NO ejecutó psql ni tocó schema_migrations en esta corrida."
  - "fecha_captura AL FINAL del returns table (menor churn posicional; el cliente mapea por posición)."
  - "Badge refleja frescura del REBUILD del pipeline (cron '23 3 * * *'), no de la fuente — honest-state R6."
metrics:
  duration: ~9min
  completed: 2026-06-24
---

# Phase 41 Plan 01: CRUCEN-01 (fecha_captura en RPC + componente, fix WR-02) Summary

Proyecta `cruce_senal.fecha_captura` en el RPC `cruces_de_parlamentario` (migración 0041, drop+recreate con doble revoke, deny-by-default intacto) y cablea esa fecha como `capturedAt` del `ProvenanceBadge` por evidencia, matando el stale-amber falso del WR-02 (antes el badge se alimentaba con la fecha de la REUNIÓN). La migración 0041 quedó ESCRITA y commiteada; su aplicación a PROD es checkpoint de operador y quedó DIFERIDA en esta corrida.

## What Shipped

- **`0041_cruces_rpc_fecha_captura.sql`** (ESCRITA, NO aplicada): `drop function if exists public.cruces_de_parlamentario(text)` + `create or replace` con `fecha_captura timestamptz` como ÚLTIMA columna del `returns table`; cuerpo `language sql stable security definer set search_path = ''` que añade `cs.fecha_captura` al select del 0040, join a `sector` por código, order by conteo desc/sector_id asc. Tras el recreate, AMBOS revokes re-emitidos (`from public;` Y `from anon, authenticated;`) — gate 5. CERO `grant ... to anon`. Proyección PII-safe (sin rut/partido/donante_id).
- **`0041_cruces_rpc_fecha_captura.test.sql`** (pgTAP, `plan(4)`): (1) `bag_has` sobre `unnest(proargnames)` → contiene `fecha_captura`; (2) `array_to_string(proargnames,',')` = `p_id,sector_id,sector_etiqueta,tipo_senal,conteo,evidencia,fecha_captura` (orden posicional exacto); (3) `not has_function_privilege('anon', …, 'execute')` (re-revoke regression — gate 5); (4) no-PII (`pg_get_functiondef` con comentarios stripeados `!~* '\y(partido|rut|email|donante_id)\y'`). Idiom `proargnames`, NO `pg_get_function_result`.
- **`app/lib/types.ts`**: `CruceSenalRpcRow.fecha_captura: string` (después de `evidencia`, espejo del orden de columnas) con JSDoc nivel-señal; JSDoc de `CruceEvidenciaItem` actualizado (frescura ya no viene del item; `item.fecha` es solo texto factual de la reunión).
- **`app/components/cruces-de-parlamentario.tsx`**: `import { fechaCorta }`; texto factual plano §9.1-safe `Reunión registrada el {fechaCorta(new Date(item.fecha))}` (sin verbo causal, omitido si `item.fecha` null); `ProvenanceBadge capturedAt={new Date(s.fecha_captura)}`; comentario WR-02 "LIMITACIÓN CONOCIDA" ELIMINADO; comentario nuevo documenta capturedAt = materialización (nivel señal) + nota de honestidad R6 (badge = frescura del rebuild diario, cron `'23 3 * * *'`).
- **`app/components/cruces-de-parlamentario.test.tsx`**: `makeSenal` default + `fecha_captura: new Date().toISOString()`; describe "CrucesView — frescura honesta (CRUCEN-01 / WR-02)" con 3 asserts (no `text-amber-700` falso; "Actualizado" presente y "Sin fecha de actualización" ausente; "Reunión registrada el …" presente cuando `item.fecha` set y ausente cuando null).

## Verification

- `cd app && npx vitest run cruces-de-parlamentario` → 13/13 verde (incl. los 3 asserts de frescura honesta).
- `cd app && npx vitest run` full suite → 298/298 verde, sin regresión.
- `cd app && npx tsc -b` → limpio (exit 0).
- `grep -c "from anon, authenticated" 0041` = 1; `grep -v '^--' 0041 | grep -c "grant execute"` = 0 (gate 5 + deny-by-default).
- `grep -c "LIMITACIÓN CONOCIDA" cruces-de-parlamentario.tsx` = 0; `grep -c "capturedAt={new Date(s.fecha_captura)}"` = 1.
- Todos los archivos LF (sin CRLF).
- pgTAP 0041 NO corrido (requiere PROD aplicado — verificación de operador al aplicar).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture del page-test #cruces ON-path sin `fecha_captura`**
- **Found during:** Task 2 (full-suite run)
- **Issue:** `app/app/parlamentario/[id]/page.test.tsx` mockea el RPC `cruces_de_parlamentario` con una fila que ahora carece de `fecha_captura` → el componente hace `new Date(undefined)` = `RangeError: Invalid time value` al renderizar la ON-path de Candado B.
- **Fix:** añadido `fecha_captura: new Date().toISOString()` al fixture del mock (mirror de la nueva proyección de 0041), con comentario `[Rule 3]`.
- **Files modified:** `app/app/parlamentario/[id]/page.test.tsx`
- **Commit:** 807f08b

## Deferred Apply (CRUCEN-01 — estado EXPLÍCITO)

> **0041 fue ESCRITA y commiteada (ff2dd63). NO fue aplicada a PROD y NO está en `schema_migrations`.** El apply es checkpoint de operador (gate 4 / Task 3, `checkpoint:human-action gate="blocking-human"`), sin autorización explícita en esta corrida → DIFERIDO. El agente NO ejecutó `psql` ni tocó `schema_migrations`.
>
> **Acción de operador pendiente** (resume-signal "pgTAP verde" o "diferido"):
> 1. Extraer `SUPABASE_DB_URL` esquivando BOM U+FEFF; Windows `PGCLIENTENCODING=UTF8`.
> 2. `psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0041_cruces_rpc_fecha_captura.sql` (NUNCA `supabase db push` — la última en PROD es 0040).
> 3. Registrar la fila 0041 en `schema_migrations`.
> 4. `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0041_cruces_rpc_fecha_captura.test.sql` → 4/4.
> 5. Regresión: `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0040_cruces_rpc.test.sql` → sigue verde (anon NO execute).

El pgTAP 0041 NO es corrible ahora (requiere PROD aplicado) — esperado, diferido con el apply.

## Commits

- `ff2dd63` feat(41-01): 0041 (proyecta fecha_captura, drop+recreate, doble revoke, cero grant) + pgTAP
- `807f08b` fix(41-01): badge usa s.fecha_captura (WR-02) + tipo + tests + [Rule 3] fixture page-test

## Known Stubs

None — la rebanada vertical (RPC → tipo → componente → tests) quedó completa. Lo único pendiente es el apply de operador (deny-by-default y gate de presentación OFF siguen intactos; CRUCEN-02/03 son los otros planes de esta fase).

## Self-Check: PASSED

- Artifacts: 5/5 FOUND (0041.sql, 0041.test.sql, types.ts, cruces-de-parlamentario.tsx, .test.tsx).
- Commits: ff2dd63 FOUND, 807f08b FOUND.
