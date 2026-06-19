---
phase: 14-money-contratos-chilecompra-por-rut-sub-maestra-de-contratis
plan: 01
subsystem: db
tags: [migration, pgtap, rls, deny-by-default, rpc, security-definer, money, chilecompra]
status: autonomous-complete-checkpoint-pending
requires:
  - parlamentario(id) (FK destino, ya existe)
  - patron 0022_probidad.sql / 0021_lobby.sql (deny-by-default + revoke + RPC security-definer)
provides:
  - tabla contrato (public-read, versionada por (fuente_id, fecha_corte))
  - tabla contratista (sub-maestra deny-by-default + revoke, keyed por rut_proveedor)
  - tabla contratos_ingesta_estado (marcador de 3 estados, public-read)
  - RPC contratos_de_parlamentario(text) security-definer, revoke de public + grant a anon
affects:
  - Plan 02 (writer @obs/dinero upserta por onConflict=(fuente_id, fecha_corte) + marcador)
  - Plan 03 (ficha lee via sb.rpc("contratos_de_parlamentario") + marcador via maybeSingle)
tech-stack:
  added: []
  patterns: [pgTAP contra schema aplicado, RLS deny-by-default + revoke, RPC security-definer]
key-files:
  created:
    - supabase/migrations/0023_dinero.sql
    - supabase/tests/0024_dinero.test.sql
  modified: []
decisions:
  - "licencia default = 'mencion de la fuente' (NUNCA 'CC BY 4.0' de probidad) — atribucion ChileCompra"
  - "RPC NO emite rut_proveedor crudo (OQ3/A4: PII pendiente de sign-off legal F13)"
  - "PK de version (fuente_id, fecha_corte); nunca keyear por parlamentario solo"
  - "sin cron.schedule en la migracion (Open Question 2: ni 0021 ni 0022 lo registraron)"
  - "pgTAP numerado 0024 para evitar colision con 0023_money_gate.test.sql ya existente"
metrics:
  duration: ~25min
  completed: 2026-06-19
  tasks_autonomous: 2
  tasks_pending_checkpoint: 1
  files_created: 2
---

# Phase 14 Plan 01: Migracion 0023_dinero (DB del bloque MONEY-Contratos) Summary

Migracion SQL `0023_dinero.sql` + pgTAP `0024_dinero.test.sql` que establecen el piso de datos de la Fase 14: tabla `contrato` public-read versionada, sub-maestra `contratista` deny-by-default + `revoke all ... from anon, authenticated` (candado de la fase, leccion Phase 11), marcador `contratos_ingesta_estado` de 3 estados, y RPC `contratos_de_parlamentario(text)` security-definer como unico canal publico. Espejo archivo-por-archivo de `0022_probidad.sql` / `0021_lobby.sql`. Las 2 tareas autonomas estan completas y verificadas estructuralmente (greps verdes); el apply al remoto + pgTAP contra el schema aplicado es un **checkpoint de operador BLOQUEANTE pendiente** (Task 3), no ejecutado por el agente.

## What Was Built

### Task 1 — `supabase/migrations/0023_dinero.sql` (commit `367d855`)
- **`contrato`** (public-read, versionada): PK compuesta `(fuente_id, fecha_corte)` — `fuente_id` = codigo unico de la orden de compra ChileCompra; `fecha_corte` = fecha de corte de la consulta por RUT. Nunca keyea por `parlamentario_id` solo (colapsaria ordenes distintas). FK nullable `parlamentario_id references parlamentario(id) on delete set null` + `mencion_proveedor not null` + `estado_vinculo`. Columnas literales VERBATIM (`codigo_orden`, `proveedor_nombre`, `tipo_persona`, `organismo`, `monto` como string, `fecha_oc`). Provenance inline NOT NULL (`origen`, `fecha_captura`, `enlace`). `licencia text not null default 'mencion de la fuente'`. RLS public-read explicito (policy `contrato_public_read` + `grant select ... to anon`). Indice en `parlamentario_id`.
- **`contratista`** (sub-maestra deny-by-default): keyed por `rut_proveedor text primary key` + `nombre`, `tipo_persona`, `codigo_empresa`, provenance inline + `licencia default 'mencion de la fuente'`. `enable row level security` con CERO policies y CERO grant a anon, + `revoke all on contratista from anon, authenticated;` VERBATIM.
- **`contratos_ingesta_estado`** (marcador 3 estados, public-read): `parlamentario_id text primary key references parlamentario(id) on delete cascade`, `ingestado_hasta date`, `fecha_captura`. RLS + policy select + grant a anon.
- **`contratos_de_parlamentario(p_id text)`** (RPC): `language sql stable security definer set search_path = ''`; selecciona SOLO campos source-published + `fecha_corte` (sin `parlamentario_id` interno, sin `rut_proveedor` crudo); `where c.parlamentario_id = p_id order by c.fecha_oc desc`. `revoke execute ... from public` + `grant execute ... to anon` sobre la firma exacta `(text)`.
- Cabecera de comentario documentando: gate de exposicion (Plan 03 lo aplica con `moneyPublicEnabled`), licencia = mencion de la fuente, apply remoto = checkpoint de operador, cron como deuda de operador.

### Task 2 — `supabase/tests/0024_dinero.test.sql` (commit `f8f7125`)
- `begin; select plan(17);` ... `select * from finish; rollback;` — 17 asserts, coincide con el conteo.
- Existencia de las 3 tablas + RLS enabled.
- `contrato` PK = exactamente `(fuente_id, fecha_corte)`.
- `contrato` + `contratos_ingesta_estado` public-read (policy SELECT anon + grant SELECT anon).
- **`contratista` deny-by-default (3 asserts distintos, candado de la fase):** RLS enabled + 0 policies + anon SIN grant SELECT.
- RPC: `has_function(...,ARRAY['text'])`, es security definer, anon TIENE EXECUTE, public NO tiene EXECUTE (revocado).

## Pending Operator Checkpoint (Task 3 — `checkpoint:human-action`, gate=blocking)

**NO ejecutado por el agente** (instruccion explicita: no correr nada contra el remoto, no auto-aprobar). El DDL aun NO se aplico al Postgres remoto — CI no aplica DDL (Pitfall 3: build verde no prueba que el schema corrio).

Pasos del operador (host Windows → git-bash / Bash tool, NO PowerShell; `.env` tiene BOM → pasar `--db-url` explicito):
1. `supabase db push --db-url "$SUPABASE_DB_URL"`
2. `supabase test db --db-url "$SUPABASE_DB_URL"`

Confirmar que `0024_dinero.test.sql` pasa 17/17, en particular los 3 asserts deny-by-default de `contratista` (RLS enabled + 0 policies + anon 0 grant SELECT). Un assert rojo NO es falso positivo de CI — es un hueco real en el DDL.

**Resume signal:** "aplicado, pgTAP 17/17 verde" o describir los asserts en rojo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Conteo de `plan(N)` corregido de 18 a 17**
- **Found during:** Task 2 (al verificar que `plan(N)` coincida con el numero de asserts).
- **Issue:** Escribi `select plan(18)` pero el archivo tiene 17 asserts (off-by-one en mi planificacion del conteo). Un `plan(N)` que no coincide con los asserts hace fallar pgTAP.
- **Fix:** `plan(18)` → `plan(17)`; re-verificado: plan=17, asserts=17, coinciden.
- **Files modified:** supabase/tests/0024_dinero.test.sql
- **Commit:** f8f7125 (corregido antes del commit)

### Nota sobre los greps de "forbidden" (no es deviation)
Los grep de `done` "NO contiene 'CC BY 4.0'" y "NO contiene cron.schedule" matchean 4 y 1 lineas respectivamente, pero TODAS son comentarios (`--`) que documentan el anti-patron ("la licencia es mencion de la fuente, NO CC BY 4.0"; "ni 0021 ni 0022 registraron cron.schedule"). Verificado: ningun `CC BY 4.0` aparece como valor/default y ningun `cron.schedule` como statement ejecutable. Los dos `licencia` columns defaultean a `'mencion de la fuente'`. Misma convencion documental que 0022 uso para sus OQ. La intencion del criterio (sin licencia CC BY, sin cron job) se cumple.

## Local Verification Results

- `0023_dinero.sql` existe, SIN BOM (primeros bytes `2d 2d 20` = `-- `), sin unicode invisible (solo ASCII/UTF-8 plano; acentos via UTF-8, sin comillas tipograficas ni BOM literal).
- `grep -c "create table contrato"` → 2 (`contrato` + `contratos_ingesta_estado`); presentes ademas `contratista`, `create function public.contratos_de_parlamentario`, `revoke all on contratista from anon, authenticated`, `default 'mencion de la fuente'`.
- `0024_dinero.test.sql` existe, SIN BOM; `select plan(17)` coincide con 17 asserts; presentes `has_table('contratista')`, los 3 asserts deny-by-default, y los 4 asserts del RPC (existe + security definer + anon execute + public sin execute).
- Apply remoto + pgTAP verde: **PENDIENTE de operador** (Task 3).

## Threat Surface Mapping (del threat_model del plan)

- T-14-01 (RUT PII en `contratista`): mitigado — `revoke all ... from anon, authenticated` + 0 policies; pgTAP codifica los 3 asserts.
- T-14-02 (RUT crudo via RPC): mitigado — el RPC NO selecciona `rut_proveedor`.
- T-14-03 (RPC security-definer abierto): mitigado — `revoke execute ... from public` + `grant ... to anon`; filtra SOLO `parlamentario_id = p_id`.
- T-14-04 (falso positivo de CI): mitigado por diseno — apply + pgTAP contra schema aplicado = checkpoint de operador (no CI).

Sin superficie de amenaza nueva fuera del `threat_model` del plan.

## Self-Check: PASSED

- FOUND: supabase/migrations/0023_dinero.sql
- FOUND: supabase/tests/0024_dinero.test.sql
- FOUND commit: 367d855 (feat 0023_dinero)
- FOUND commit: f8f7125 (test 0024_dinero)
