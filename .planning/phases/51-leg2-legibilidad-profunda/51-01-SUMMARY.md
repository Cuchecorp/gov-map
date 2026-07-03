---
phase: 51-leg2-legibilidad-profunda
plan: 01
subsystem: db-rpc
tags: [rpc, security-definer, pgtap, lockdown-guard, legibilidad, SC5, B5]
requires:
  - "voto.seleccion incluye 'ausente' (0019)"
  - "proyecto.titulo, votacion.etapa (0008)"
  - "rebeldias_de_parlamentario en PUBLIC_RPC_ALLOWLIST (lockdown-guard)"
provides:
  - "RPC rebeldias_de_parlamentario honesto (sin ausencias, con titulo/etapa, dedupe)"
  - "contrato de 7 columnas para el consumidor 51-02"
  - "lockdown-guard refinado: exencion por-sentencia de grant execute sobre RPC allowlisted"
affects:
  - "51-02 (consumidor UI de rebeldias)"
tech-stack:
  added: []
  patterns:
    - "drop+recreate por 42P13 (returns table crece)"
    - "doble revoke all from public + grant execute to anon (ACL determinista)"
    - "exencion de guard por-sentencia (no por-archivo)"
key-files:
  created:
    - "supabase/migrations/0047_rebeldias_honestas.sql"
    - "supabase/tests/0047_rebeldias_honestas.test.sql"
  modified:
    - "app/lib/lockdown-guard.test.ts"
decisions:
  - "Ausencias excluidas del calculo de mayoria Y de la salida (una ausencia no es disidencia)"
  - "titulo por left join (null honesto); etapa desde votacion.etapa"
  - "grant execute a anon = status quo 0019, no nueva superficie; guard lo exime por allowlisted"
metrics:
  duration: "~20min"
  completed: "2026-07-03"
  tasks_completed: 3
  tasks_total: 4
  files: 3
---

# Phase 51 Plan 01: Rebeldías honestas (RPC SC5/B5) Summary

RPC `rebeldias_de_parlamentario` reescrito para medir SOLO disidencia real: excluye ausencias del cálculo de la mayoría de bancada y de la salida, hidrata el título del proyecto vía left join (null honesto), y deduplica por `votacion_id` — más pgTAP acompañante y `lockdown-guard` refinado para eximir por-sentencia el `grant execute` sobre RPCs allowlisted. Único artefacto de base de datos de la fase; el apply remoto queda como checkpoint de operador (Task 4).

## Qué se construyó

**Task 1 — pgTAP 0047 (test-first, Wave 0)** — `supabase/tests/0047_rebeldias_honestas.test.sql`
- `plan(9)`: firma `(text)`, orden posicional exacto de las 7 columnas vía `array_to_string(proargnames, ',')` (idiom 0041, NO `pg_get_function_result`), `security definer`, `search_path=` en `proconfig`, `anon` con EXECUTE (espejo invertido del deny de 0040), no-PII en el returns.
- Asserts de datos con fixture sembrado en transacción (`begin;…;rollback;`): exclusión de ausencias (0 filas para un parlamentario ausente-puro), dedupe por votación (1 fila pese a voto duplicado), título hidratado.
- Corre por `psql -tA -f` FUERA del glob de vitest (convención del proyecto: la suite globea solo `.test.{ts,tsx}`).

**Task 2 — migración 0047 (drop+recreate honesto)** — `supabase/migrations/0047_rebeldias_honestas.sql`
- `drop function if exists rebeldias_de_parlamentario(text);` (42P13: el returns table crece con `titulo`/`etapa`).
- CTE `mayoria` computa `mode() within group` añadiendo `and v.seleccion <> 'ausente'`.
- `select distinct on (v.votacion_id)` + `order by v.votacion_id` para deduplicar.
- WHERE final añade `and v.seleccion <> 'ausente'` (una ausencia PROPIA no es "votó distinto").
- `left join public.proyecto pr on pr.boletin = vo.boletin` para `pr.titulo`; `etapa` desde `vo.etapa`.
- Returns table EXACTO pineado: `votacion_id, boletin, titulo, etapa, fecha, seleccion_propia, mayoria_bancada`.
- Sigue `security definer set search_path = ''`; cierra con `revoke all ... from public;` + `grant execute ... to anon;`. CERO policy, CERO `grant select` sobre `parlamentario` (LEGAL-03).

**Task 3 — lockdown-guard refinado** — `app/lib/lockdown-guard.test.ts`
- Helper `anonGrantOffenders(sql)`: parte el SQL por `;` y exime SOLO `grant execute on function [public.]<name>(...) to anon` cuando `<name>` ∈ `PUBLIC_RPC_ALLOWLIST`. Todo otro grant a anon (`grant select on <tabla>`, `grant all`, o `grant execute` de función no-listada) sigue offender.
- Bloque (A) tests 1 y 3 usan el helper (por-sentencia, no por-archivo).
- Test sintético nuevo: RPC allowlisted PERMITIDO; `grant select on tabla` BLOQUEADO; `grant execute` de función no-listada BLOQUEADO.
- Guard 7/7 → 8/8 verde con 0047 en disco. Suite app/ **413** verde, `tsc -b` limpio.

## Verificación

- `pnpm --dir app test -- --run lockdown-guard`: 8/8 verde (suite completa 413/413).
- `pnpm --dir app exec tsc -b`: exit 0 (limpio).
- Greps de acceptance de Task 1 y Task 2: todos verdes (drop, security definer+search_path, 2× `seleccion <> 'ausente'`, `distinct on`, `left join proyecto`, `titulo text, etapa text`, revoke+grant, 0 `grant select` real).
- pgTAP 0047 contra PROD: **pendiente de operador** (Task 4).

## Deviations from Plan

None — plan ejecutado tal cual. Nota menor: el header del pgTAP se reformuló para no contener el literal prohibido `pg_get_function_result` (evita falso positivo de un grep ingenuo); el idiom prohibido no se usa en ningún assert.

## Task 4 — CHECKPOINT DE OPERADOR (pendiente, deuda de operador)

**NO ejecutado por el agente** (mismo patrón que checkpoints previos 0028/0041). El código y los tests estáticos pasan, pero el RPC vive en Postgres PROD y NO surte efecto hasta que un operador aplique el DDL. `tsc`/`pnpm test` NO prueban que Postgres ejecutó el drop+recreate.

Pasos del operador (convención LOCKED: apply por `psql --db-url`, NUNCA `supabase db push`, NUNCA un agente):
1. `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0047_rebeldias_honestas.sql`
2. `psql "$SUPABASE_DB_URL" -f supabase/tests/0047_rebeldias_honestas.test.sql` (debe salir verde).
3. Verificación de datos real: un parlamentario cuyas disidencias eran todas ausencias (p.ej. Alessandri) debe bajar a 0 rebeldías; otro con disidencia real conserva filas con `titulo` poblado.
4. `insert into supabase_migrations.schema_migrations (version) values ('0047') on conflict do nothing;` (patrón 0041/0046).
5. El deploy Cloudflare (checkpoint separado, fuera de esta fase) es lo que hace visible el cambio en el sitio.

**ACK DE SEGURIDAD (W2 plan-checker):** al firmar, el operador también ratifica el refinamiento del lockdown-guard de la Task 3 (exención por-sentencia SOLO para `grant execute on function` de RPCs en `PUBLIC_RPC_ALLOWLIST`). Si NO lo ratifica → revertir Task 3 y decidir la exención de 0047 con humano, nunca un agente.

## Self-Check: PASSED

- FOUND: supabase/migrations/0047_rebeldias_honestas.sql
- FOUND: supabase/tests/0047_rebeldias_honestas.test.sql
- FOUND: app/lib/lockdown-guard.test.ts (modificado)
- FOUND commit 9be5c0b (Task 1), daadc18 (Task 2), c968499 (Task 3)
