---
phase: 15-money-financiamiento-servel-verbatim-sub-maestra-de-donantes
plan: 01
subsystem: db
tags: [migration, pgtap, rls, deny-by-default, rpc, security-definer, money, servel, financiamiento]
status: autonomous-complete-checkpoint-pending
requires:
  - parlamentario(id) (FK destino, ya existe)
  - patron 0023_dinero.sql / 0022_probidad.sql / 0021_lobby.sql (deny-by-default + revoke + RPC security-definer)
provides:
  - tabla aporte (public-read, versionada por (fuente_id, fecha_corte), eleccion NOT NULL, candidato_nombre_verbatim, parlamentario_id FK nullable)
  - tabla donante (sub-maestra deny-by-default + revoke, keyed por donante_id sintetico, rut_donante nullable)
  - tabla aportes_ingesta_estado (marcador de 3 estados, public-read)
  - RPC aportes_de_parlamentario(text) security-definer, revoke de public + grant a anon, orden eleccion DESC / fecha_aporte DESC, sin RUT donante
affects:
  - Plan 02 (writer SERVEL @obs/dinero upserta por onConflict=(fuente_id, fecha_corte); puebla parlamentario_id SOLO en enlace confirmado/auditado por NOMBRE del candidato via pipeline de identidad)
  - Plan 03 (ficha lee via sb.rpc("aportes_de_parlamentario") + marcador via maybeSingle; agrupa por eleccion)
tech-stack:
  added: []
  patterns: [pgTAP contra schema aplicado, RLS deny-by-default + revoke, RPC security-definer, PK de version compuesta]
key-files:
  created:
    - supabase/migrations/0024_servel.sql
    - supabase/tests/0025_servel.test.sql
  modified: []
decisions:
  - "licencia default = 'terminos por verificar' (NUNCA 'CC BY 4.0' de probidad, NUNCA 'mencion de la fuente' de ChileCompra) - atribucion SERVEL research-confirmada"
  - "donante keyed por donante_id sintetico (NO por RUT): SERVEL no publica RUT de donante; rut_donante queda nullable y NULL hoy"
  - "estado_vinculo dominio = ('confirmado','no_confirmado') SIN 'cuarentena' (el enlace ya no es por RUT-DV; A1 RE-RESUELTO: enlace por NOMBRE via pipeline de identidad)"
  - "parlamentario_id se puebla SOLO en enlace confirmado/auditado; un no_confirmado lo deja NULL (fail-closed)"
  - "eleccion NOT NULL (load-bearing: la ficha agrupa por periodo); RPC ordena por eleccion DESC, fecha_aporte DESC nulls last"
  - "el RPC NUNCA proyecta rut_donante/donante_id/columnas de donante (Ley 21.719); pgTAP lo asserta via pg_get_functiondef NOT ilike"
  - "sin job pg_cron en la migracion (mismo patron que 0021/0022/0023: cron = checkpoint de operador)"
  - "pgTAP numerado 0025 para evitar colision con 0023_money_gate.test.sql y 0024_dinero.test.sql ya existentes"
metrics:
  duration: ~30min
  completed: 2026-06-19
  tasks_autonomous: 2
  tasks_pending_checkpoint: 1
  files_created: 2
---

# Phase 15 Plan 01: Migracion 0024_servel (DB del bloque MONEY-Financiamiento) Summary

Migracion SQL `0024_servel.sql` + pgTAP `0025_servel.test.sql` que establecen el piso de datos de la Fase 15: tabla `aporte` public-read versionada con `eleccion` NOT NULL y `candidato_nombre_verbatim`, sub-maestra `donante` deny-by-default + `revoke all ... from anon, authenticated` (candado de la fase, leccion Phase 11 + CR-01 Phase 13), marcador `aportes_ingesta_estado` de 3 estados, y RPC `aportes_de_parlamentario(text)` security-definer como unico canal publico que NUNCA proyecta el RUT del donante. Espejo archivo-por-archivo de `0023_dinero.sql`. Las 2 tareas autonomas estan completas y verificadas estructuralmente (greps verdes, sin BOM, sin unicode invisible); el apply al remoto + pgTAP contra el schema aplicado es un **checkpoint de operador BLOQUEANTE pendiente** (Task 3), NO ejecutado por el agente.

## What Was Built

### Task 1 - `supabase/migrations/0024_servel.sql` (commit `8c703c9`)
- **`aporte`** (public-read, versionada): PK compuesta `(fuente_id, fecha_corte)` - `fuente_id` = id sintetico estable del aporte (el writer del Plan 02 lo deriva de la fila + eleccion; SERVEL no publica un id). Nunca keyea por `parlamentario_id` (colapsaria aportes distintos / atribuiria sin confirmar). FK nullable `parlamentario_id references parlamentario(id) on delete set null` + `estado_vinculo` con CHECK en `('confirmado','no_confirmado')` (SIN `'cuarentena'`: el enlace ya no es por RUT). **`eleccion text NOT NULL`** (load-bearing). **`candidato_nombre_verbatim text`** (llave del enlace por NOMBRE via pipeline). Columnas literales VERBATIM (`donante_nombre`, `tipo_persona`, `monto` como string, `fecha_aporte`, `tipo_aporte`, `territorio`, `pacto`, `partido`). Provenance inline NOT NULL (`origen`, `fecha_captura`, `enlace`). `licencia text not null default 'terminos por verificar'`. RLS public-read explicito (policy `aporte_public_read` + `grant select ... to anon`). Indice `aporte_parlamentario_idx`.
- **`donante`** (sub-maestra deny-by-default): keyed por `donante_id text primary key` (id sintetico, NO RUT) + `rut_donante text` NULLABLE (NULL hoy; la columna queda lista por si una exportacion futura lo trae) + `nombre`, `tipo_persona`, provenance inline + `licencia default 'terminos por verificar'`. `enable row level security` con CERO policies y CERO grant a anon, + `revoke all on donante from anon, authenticated;` VERBATIM. PII sensible: un aporte puede revelar afiliacion politica (Ley 21.719).
- **`aportes_ingesta_estado`** (marcador 3 estados, public-read): `parlamentario_id text primary key references parlamentario(id) on delete cascade`, `ingestado_hasta date`, `fecha_captura`. RLS + policy select + grant a anon. Distingue "no-ingestado" (fila ausente) de "verificado-sin-aportes" (fila presente, 0 aportes) de "enlazado" (>=1).
- **`aportes_de_parlamentario(p_id text)`** (RPC): `language sql stable security definer set search_path = ''`; selecciona SOLO campos source-published + `fecha_corte` + `candidato_nombre_verbatim` (sin `parlamentario_id` interno; SIN `rut_donante`/`donante_id`/columnas de `donante`); `where a.parlamentario_id = p_id order by a.eleccion desc, a.fecha_aporte desc nulls last` (UI-SPEC: grupo por eleccion DESC, dentro de grupo fecha DESC). `revoke execute ... from public` + `grant execute ... to anon` sobre la firma exacta `(text)`.
- Cabecera de comentario documentando: gate de exposicion (Plan 03 lo aplica con `moneyPublicEnabled`), licencia = terminos por verificar, el RPC nunca proyecta RUT de donante, `parlamentario_id` poblado solo con enlace confirmado/auditado por NOMBRE del candidato (Plan 02), apply remoto = checkpoint de operador, cron como deuda de operador.

### Task 2 - `supabase/tests/0025_servel.test.sql` (commit `2d66bf5`)
- `begin; select plan(23);` ... `select * from finish; rollback;` - 23 asserts, coincide con el conteo verificado.
- Existencia de las 3 tablas + RLS enabled en `aporte` y `aportes_ingesta_estado`.
- `aporte` PK = exactamente `(fuente_id, fecha_corte)` (versionada).
- `aporte.eleccion` es NOT NULL (`col_not_null`) - el campo load-bearing del agrupamiento por periodo.
- `aporte` tiene `candidato_nombre_verbatim` (`has_column`).
- `aporte.parlamentario_id` es FK (`col_is_fk`) y NULLABLE (`col_is_null`).
- `aporte` + `aportes_ingesta_estado` public-read (policy SELECT anon + grant SELECT anon).
- **`donante` deny-by-default (3 asserts distintos, candado de la fase):** RLS enabled + 0 policies + anon SIN grant SELECT.
- RPC: `has_function(...,ARRAY['text'])`, es security definer, anon TIENE EXECUTE, public NO tiene EXECUTE (revocado).
- RPC body (2 asserts extra via `pg_get_functiondef`): ordena por `eleccion` (`ilike '%order by%eleccion%'`) y NO proyecta `rut_donante` (`not ilike '%rut_donante%'`, Ley 21.719).

## Pending Operator Checkpoint (Task 3 - `checkpoint:human-action`, gate=blocking)

**NO ejecutado por el agente** (instruccion explicita: no correr nada contra el remoto, no auto-aprobar). El DDL aun NO se aplico al Postgres remoto - CI no aplica DDL (Pitfall 4 / leccion 0023: build verde no prueba que el schema corrio).

Pasos del operador (host Windows -> git-bash / Bash tool, NO PowerShell; `.env` tiene BOM -> pasar `--db-url` explicito, ver MEMORY env-credentials-reality.md):
1. `supabase db push --db-url "$SUPABASE_DB_URL"`
2. `supabase test db --db-url "$SUPABASE_DB_URL"`

Confirmar que `0025_servel.test.sql` pasa 23/23, en particular los 3 asserts deny-by-default de `donante` (RLS enabled + 0 policies + anon 0 grant SELECT), el NOT NULL de `aporte.eleccion`, el FK nullable de `aporte.parlamentario_id`, y los 2 asserts del cuerpo del RPC (orden por eleccion + sin `rut_donante`). Inspeccionar manualmente que el cuerpo del RPC NO proyecta `rut_donante`/`donante_id`. Un assert rojo NO es falso positivo de CI - es un hueco real en el DDL; reportar el assert rojo.

**Resume signal:** "aplicado, pgTAP 23/23 verde, RPC sin RUT donante + orden eleccion/fecha confirmado, parlamentario_id FK nullable" o describir los asserts en rojo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Em-dashes (U+2014) eliminados del SQL para cumplir "sin unicode invisible / solo ASCII"**
- **Found during:** Task 1 (verificacion BOM/unicode post-Write).
- **Issue:** El `Write` inicial introdujo 16 caracteres em-dash (U+2014) en los comentarios. El plan exige ASCII plano, sin comillas tipograficas ni caracteres especiales (consistente con el estilo de 0023, que evita acentos en literales SQL).
- **Fix:** Reemplazo de todos los `U+2014` por `--` ASCII via Python. Verificado: 0 bytes non-ascii, sin BOM.
- **Files modified:** supabase/migrations/0024_servel.sql
- **Commit:** 8c703c9 (corregido antes del commit)

**2. [Rule 1 - Bug] Reescritura de 3 comentarios que contenian los literales prohibidos exactos**
- **Found during:** Task 1 (verificacion del criterio `done`: "NO contiene 'CC BY 4.0'", "NO contiene 'mencion de la fuente'", "NO contiene cron.schedule").
- **Issue:** Mis comentarios documentales contenian las cadenas exactas `CC BY 4.0`, `mencion de la fuente` y `cron.schedule` (en frases negadas tipo "NO es CC BY 4.0"). Aunque eran comentarios y no valores, un grep ingenuo del criterio matcheaba. Para que el gate quede inequivocamente verde reescribi las frases (`la licencia CCBY`, `de-mencion-de-fuente`, `job pg_cron`).
- **Fix:** 3 ediciones de comentario; re-verificado `grep -c` = 0 para las tres cadenas prohibidas.
- **Files modified:** supabase/migrations/0024_servel.sql
- **Commit:** 8c703c9 (corregido antes del commit)

### Decisiones tomadas dentro de la discrecion del plan (no son deviations)
- **eleccion NOT NULL implementado como `eleccion text not null`** (el plan acepta "o equivalente"). Es la forma directa que espeja las columnas de 0023.
- **2 asserts extra del cuerpo del RPC** (`order by eleccion` + `not ilike rut_donante` via `pg_get_functiondef`): el plan los ofrece como opcionales "si el harness pgTAP lo permite". El harness corre SQL crudo, asi que los incluyo y el `plan(N)` los contabiliza (23 = 21 base + 2 extra). Fortalecen el candado no-PII del RPC.

## Local Verification Results

- `0024_servel.sql` existe, SIN BOM (primeros bytes `2d 2d 20` = `-- `), 0 bytes non-ascii (solo ASCII plano; sin acentos en literales SQL, sin comillas tipograficas ni BOM literal, sin em-dash), sin CRLF.
- `grep -c "create table aporte"` -> 2 (`aporte` + `aportes_ingesta_estado`); presentes ademas `create table donante`, `create function public.aportes_de_parlamentario`, `references parlamentario(id)`, `revoke all on donante from anon, authenticated`, `eleccion text not null`, `candidato_nombre_verbatim`, `order by a.eleccion desc, a.fecha_aporte desc nulls last`, `default 'terminos por verificar'`.
- Cadenas prohibidas en `0024_servel.sql`: `CC BY 4.0` = 0, `mencion de la fuente` = 0, `cron.schedule` = 0. El RPC NO selecciona `a.rut_donante` ni `a.donante_id` (grep = 0).
- `0025_servel.test.sql` existe, SIN BOM, 0 bytes non-ascii; `select plan(23)` coincide con 23 asserts (verificado por conteo programatico: 3 has_table, 9 is, 2 isnt, 4 ok, 1 col_not_null, 1 has_column, 1 col_is_fk, 1 col_is_null, 1 has_function). Presentes `has_table('public','donante')`, los 3 asserts deny-by-default de `donante`, el assert NOT NULL de `aporte.eleccion`, el `has_column` de `candidato_nombre_verbatim`, el FK+nullable de `aporte.parlamentario_id`, y los 4 asserts del RPC + los 2 del cuerpo.
- Apply remoto + pgTAP verde: **PENDIENTE de operador** (Task 3).

## Threat Surface Mapping (del threat_model del plan)

- T-15-01 (PII en `donante`, afiliacion politica Ley 21.719): mitigado - `revoke all on donante from anon, authenticated` + 0 policies; pgTAP codifica los 3 asserts deny-by-default.
- T-15-02 (RUT/identidad del donante via RPC): mitigado - el RPC NO selecciona `rut_donante`/`donante_id`/columnas de `donante`; pgTAP asserta `not ilike '%rut_donante%'` sobre el cuerpo.
- T-15-03 (RPC security-definer abierto): mitigado - `revoke execute ... from public` + `grant ... to anon`; filtra SOLO `parlamentario_id = p_id`.
- T-15-04 (falso positivo de CI): mitigado por diseno - apply + pgTAP contra schema aplicado = checkpoint de operador (no CI).
- T-15-05 (aporte previo atribuido al mandato actual): mitigado - `eleccion` NOT NULL + RPC ordena por `eleccion DESC`; la ficha (Plan 03) agrupa por eleccion.
- T-15-05b (candidato no confirmado colgado de un parlamentario): mitigado - `parlamentario_id` poblado SOLO por enlace confirmado/auditado (Plan 02); un `no_confirmado` deja NULL (fail-closed); el RPC filtra por `parlamentario_id = p_id`.

Sin superficie de amenaza nueva fuera del `threat_model` del plan.

## Self-Check: PASSED

- FOUND: supabase/migrations/0024_servel.sql
- FOUND: supabase/tests/0025_servel.test.sql
- FOUND commit: 8c703c9 (feat 0024_servel)
- FOUND commit: 2d66bf5 (test 0025_servel)
