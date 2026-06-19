---
phase: 16-money-agregaci-n-contratos-aportes-por-contraparte
plan: 01
subsystem: db
tags: [migration, pgtap, rpc, security-definer, money, aggregation, pii, contraparte, juridica]
status: autonomous-complete-checkpoint-pending
requirements: [MONEY-05]
requires:
  - public.contrato (0023_dinero.sql, public-read, versionada)
  - public.aporte (0024_servel.sql, public-read, versionada)
  - sub-maestras contratista (0023) + donante (0024) deny-by-default (NO se tocan)
  - patron RPC security-definer *_de_parlamentario (0023/0024)
  - writer-supabase.ts:54 (ya persiste contrato.rut_proveedor -> O1 reconcile)
provides:
  - columna contrato.rut_proveedor (reconciliacion O1, idempotente, sin tabla nueva) + indice
  - RPC agregado_por_contraparte(text) security-definer, juridica-only, prefix-dispatched (c:/d:), revoke de public + grant a anon
  - RPC contrapartes_listado() security-definer, juridica-only, ids prefijados + conteo neutral, revoke de public + grant a anon
  - pgTAP 0026_agregacion.test.sql (16 asserts) contra schema aplicado
affects:
  - Plan 16-02 (ruta /contraparte/[id] gated lee via sb.rpc("agregado_por_contraparte",{p_id}); listado via contrapartes_listado(); esquema de id 'c:<rut_proveedor>' / 'd:<donante_nombre>')
tech-stack:
  added: []
  patterns: [pgTAP contra schema aplicado, RPC security-definer, functiondef introspection PII, UNION ALL prefix-dispatch, jsonb_agg de filas con provenance]
key-files:
  created:
    - supabase/migrations/0025_agregacion.sql
    - supabase/tests/0026_agregacion.test.sql
  modified: []
decisions:
  - "agregado_por_contraparte(text) prefix-dispatched: 'c:<rut_proveedor>' -> faceta contratos; 'd:<donante_nombre>' -> faceta aportes; UNION ALL, cada faceta gated por left(p_id,2)"
  - "filtro PII en la FILA DE HECHO: where tipo_persona = 'juridica' sobre contrato/aporte; el cuerpo NUNCA referencia contratista/donante"
  - "aportes keyean por donante_nombre (la fila de hecho aporte NO tiene la llave sintetica del donante; vive solo en la sub-maestra deny-by-default)"
  - "O1 reconcile: alter table public.contrato add column if not exists rut_proveedor (el writer ya la persiste en writer-supabase.ts:54; 0023 la omitio) + indice contrato_rut_proveedor_idx; SIN tabla nueva"
  - "CONTEO NEUTRAL (count(*)) + filas verbatim como jsonb_agg con provenance por fila; SIN SUM, SIN ::numeric (monto es text verbatim, hoy null en contratos)"
  - "contrapartes_listado() SI se embarco (discrecion O2): juridica-only, ids prefijados + conteo neutral, mismo clause security-definer + revoke/grant"
  - "el RPC NUNCA proyecta donante_id/rut_donante/RUT de donante ni columnas de nombre de las sub-maestras; pgTAP lo asserta via pg_get_functiondef NOT ilike"
  - "sin job pg_cron en la migracion (matview diferida, MVP = RPC runtime; mismo patron que 0021..0024)"
  - "pgTAP numerado 0026 (siguiente libre; 0025_servel.test.sql es el test mas alto existente)"
  - "comentarios referencian las sub-maestras BARE (contratista/donante), NUNCA con prefijo public. (W1: el verify greps ! public.(contratista|donante))"
metrics:
  duration: ~25min
  completed: 2026-06-19
  tasks_autonomous: 2
  tasks_pending_checkpoint: 1
  files_created: 2
---

# Phase 16 Plan 01: Migracion 0025_agregacion (RPC de agregacion por contraparte) Summary

Migracion SQL `0025_agregacion.sql` + pgTAP `0026_agregacion.test.sql`: la mitad DB del slice vertical MONEY-05. Define `agregado_por_contraparte(p_id text)` — un RPC security-definer, juridica-only, que agrega `contrato` y `aporte` por contraparte y es el unico camino publico hacia los datos por contraparte. El RPC filtra `tipo_persona = 'juridica'` sobre la FILA DE HECHO, proyecta UNICAMENTE el nombre publico de la fila de hecho (`contrato.proveedor_nombre` / `aporte.donante_nombre`), NUNCA referencia las sub-maestras `contratista`/`donante`, NUNCA proyecta `donante_id`/`rut_donante`/RUT de donante, y NUNCA suma ni castea montos (conteo neutral; montos verbatim por fila). Reconcilia el hueco de schema O1 (`alter table public.contrato add column if not exists rut_proveedor` — el writer en `writer-supabase.ts:54` ya la persiste pero 0023 la omitio), SIN tablas nuevas. Tambien embarca `contrapartes_listado()` (discrecion O2). Las 2 tareas autonomas estan completas y verificadas estructuralmente (greps verdes, sin BOM, solo ASCII). El apply al remoto + pgTAP contra el schema aplicado es un **checkpoint de operador BLOQUEANTE pendiente** (Task 3), NO ejecutado por el agente.

## What Was Built

### Task 1 — `supabase/tests/0026_agregacion.test.sql` (commit `b1333ee`, TDD RED)

`begin; select plan(16); ... select * from finish(); rollback;` — 16 asserts, escrito ANTES de la migracion (Nyquist: el test es la spec). Cobertura:

- **RPC existencia/grants (4):** `has_function('public','agregado_por_contraparte',ARRAY['text'])`; `prosecdef = true` (security definer); anon TIENE EXECUTE; public NO tiene EXECUTE (revocado).
- **PII via functiondef introspection (5):** `pg_get_functiondef(...)` `ilike '%juridica%'` (positivo, filtra a juridica) + cuatro guardias negativas `not ilike`: `%rut_donante%`, `%donante_id%`, `%contratista.nombre%`, `%donante.nombre%` (Ley 21.719: nunca proyecta RUT/llave de donante ni el nombre interno de las sub-maestras).
- **Reconcile O1 (1):** `contrato` tiene la columna `rut_proveedor` (count de `information_schema.columns` = 1).
- **Deny-by-default REGRESSION para AMBAS sub-maestras (6):** `contratista` y `donante` — RLS enabled (=1 c/u), 0 policies (c/u), anon 0 grant SELECT (c/u). 0025 no debe haber aflojado ninguna.

### Task 2 — `supabase/migrations/0025_agregacion.sql` (commit `dca03d6`, TDD GREEN)

- **Cabecera doc-block** (estilo 0024_servel.sql): ultima migracion aplicada = 0024 / esta es 0025; APLICACION = CHECKPOINT DE OPERADOR + nota del BOM `--db-url`; GATE de exposicion (`moneyPublicEnabled()` default OFF es el candado B, este DDL es el candado A); nota PII (juridica-only, regla rectora dura); nota O1-RESOLUTION (reconcile de `contrato.rut_proveedor`); nota "pgTAP usa el numero libre 0026"; nota "sin pg_cron / matview diferida".
- **(O1) `alter table public.contrato add column if not exists rut_proveedor text;`** + `create index if not exists contrato_rut_proveedor_idx on public.contrato (rut_proveedor);` — reconcilia el schema con el writer ya desplegado. SIN tabla nueva.
- **`agregado_por_contraparte(p_id text)`** — `language sql stable security definer set search_path = ''`. UNION ALL prefix-dispatched de dos facetas, cada referencia de tabla schema-qualified (`public.contrato`/`public.aporte`):
  - **Faceta CONTRATOS** (gated `left(p_id,2) = 'c:'`): `from public.contrato where tipo_persona = 'juridica' and rut_proveedor = substring(p_id from 3)`, agrupada por `proveedor_nombre`, emite `facet='contrato'`, `contraparte_nombre = proveedor_nombre`, `tipo_persona='juridica'`, `conteo = count(*)`, y `filas` = `jsonb_agg` de cada orden (`codigo_orden`, `proveedor_nombre`, `organismo`, `nombre_orden`, `monto` verbatim, `fecha_oc`, + provenance `origen`/`fecha_captura`/`fecha_corte`/`enlace`/`licencia`), ordenadas `fecha_oc desc nulls last, codigo_orden desc`.
  - **Faceta APORTES** (gated `left(p_id,2) = 'd:'`): `from public.aporte where tipo_persona = 'juridica' and donante_nombre = substring(p_id from 3)`, agrupada por `donante_nombre`, emite `facet='aporte'`, `contraparte_nombre = donante_nombre`, `conteo`, y `filas` = `jsonb_agg` (`eleccion`, `candidato_nombre_verbatim`, `donante_nombre`, `monto` verbatim, `fecha_aporte`, `tipo_aporte`, `territorio`, `pacto`, `partido`, + provenance), ordenadas `eleccion desc, fecha_aporte desc nulls last`.
  - `revoke execute ... from public` + `grant execute ... to anon` sobre la firma exacta `(text)`.
- **`contrapartes_listado()`** (discrecion O2 — SI embarcado): `language sql stable security definer set search_path = ''`. UNION ALL juridica-only de contratos (id `'c:'||rut_proveedor`, agrupado por `rut_proveedor, proveedor_nombre`) y aportes (id `'d:'||donante_nombre`, agrupado por `donante_nombre`), cada uno con `facet`, `contraparte_nombre`, `tipo_persona='juridica'`, `conteo` neutral. Mismo `revoke ... from public` + `grant ... to anon`. NO cambia el gate (la pagina sigue 404 con OFF).
- **NO** se agrega policy ni grant a `contratista`/`donante`. **NO** se registra `cron.schedule`. El cuerpo NO referencia `public.contratista`/`public.donante`, NO castea ni suma `monto`.

## Return Shape (para Plan 16-02)

`agregado_por_contraparte(p_id text) returns table (facet text, contraparte_nombre text, tipo_persona text, conteo bigint, filas jsonb)` — una fila por contraparte juridica matcheada (0 o 1 hoy, dado el dispatch por id exacto). `filas` es un array jsonb; cada objeto lleva los campos publicos verbatim de la faceta + `origen`, `fecha_captura`, `fecha_corte`, `enlace`, `licencia`.

`contrapartes_listado() returns table (id text, facet text, contraparte_nombre text, tipo_persona text, conteo bigint)` — una fila por contraparte juridica distinta, con su `id` prefijado.

**Esquema de direccionamiento:** `c:<rut_proveedor>` (contratos) / `d:<donante_nombre>` (aportes). El prefijo lo despacha el RPC (`left(p_id,2)`); el id lo emite `contrapartes_listado()`. La ruta `/contraparte/[id]` del Plan 16-02 debe validar el id con un regex antes de tocar la DB.

**O1 reconciliada:** `contrato.rut_proveedor` ahora existe en el schema (no solo en el writer). Plan 16-02 puede asumirla.

## Pending Operator Checkpoint (Task 3 — `checkpoint:human-action`, gate=blocking)

**NO ejecutado por el agente** (instruccion explicita: no correr nada contra el remoto, no auto-aprobar). El DDL aun NO se aplico al Postgres remoto (sa-east-1) — CI no aplica DDL (Pitfall 2: build verde no prueba que el schema corrio; el RPC y la columna `contrato.rut_proveedor` no existen en produccion hasta que el operador los aplique).

Pasos del operador (host Windows -> git-bash / Bash tool, NO PowerShell; `.env` tiene BOM -> pasar `--db-url` explicito, ver MEMORY env-credentials-reality.md):

1. `supabase db push --db-url "$SUPABASE_DB_URL"` (o `supabase migration up --db-url "$SUPABASE_DB_URL"`).
2. `supabase test db --db-url "$SUPABASE_DB_URL"`.

Confirmar que `0026_agregacion.test.sql` pasa 16/16, en particular: el RPC existe + es security definer + anon EXECUTE + public NO; el `pg_get_functiondef` filtra a juridica y NO contiene `rut_donante`/`donante_id`/`contratista.nombre`/`donante.nombre`; `contrato.rut_proveedor` existe; `contratista` Y `donante` siguen deny-by-default (RLS on, 0 policies, 0 anon SELECT). Sanity opcional: `select * from public.agregado_por_contraparte('c:76123456-7');` retorna 0+ filas sin error; `select has_table_privilege('anon','public.contratista','select');` es false. Un assert rojo NO es falso positivo de CI — es un hueco real; reportarlo.

**Resume signal:** "applied" cuando 0026 pasa 16/16 contra el schema remoto, o pegar los asserts en rojo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentario inline DENTRO del cuerpo del RPC contenia el literal `donante_id` -> habria roto el assert `not ilike '%donante_id%'`**
- **Found during:** Task 2 (verificacion post-Write de los invariantes que el pgTAP introspecciona via `pg_get_functiondef`).
- **Issue:** Un comentario inline en la faceta de aportes decia "La fila de hecho NO tiene donante_id (vive solo en la sub-maestra...)". `pg_get_functiondef` retorna el cuerpo VERBATIM incluidos los comentarios inline, asi que el literal `donante_id` dentro del cuerpo habria hecho FALLAR el assert pgTAP `not ilike '%donante_id%'` (la funcion seria correcta pero el test rojo). Las otras apariciones de `donante_id`/`rut_donante` viven en comentarios de cabecera de archivo y en el doc-block de `contrapartes_listado` — fuera de cualquier cuerpo de funcion, asi que `pg_get_functiondef('agregado_por_contraparte')` no las retorna.
- **Fix:** Reescribi el comentario inline a "la llave sintetica del donante" (sin el literal `donante_id`). Verificado: extraido el cuerpo entre `as $$ ... $$;`, contiene `juridica` y NINGUNO de `rut_donante`/`donante_id`/`contratista.nombre`/`donante.nombre`.
- **Files modified:** supabase/migrations/0025_agregacion.sql
- **Commit:** dca03d6 (corregido antes del commit)

### Decisiones tomadas dentro de la discrecion del plan (no son deviations)
- **`contrapartes_listado()` embarcado (O2 / Task 2 opcional):** el plan lo marca opcional; lo embarque para que Plan 16-02 tenga un camino de listado juridica-only con ids prefijados, sin inventar una tabla de identidad. Mismo clause security-definer + revoke/grant; no cambia el gate.
- **Direccionamiento `c:<rut_proveedor>` / `d:<donante_nombre>`** (Pattern 2 del RESEARCH): los dos keyspaces no-joinables nunca colisionan; el prefijo despacha la faceta. No hay merge cross-source (no existe RUT de donante hoy — correcto, no un gap).
- **Conteo neutral, sin total monetario:** `monto` es text verbatim (null hoy en contratos); el conteo `count(*)` es el agregado seguro ("X aparece N veces"). Cero SUM / cero ::numeric.

## Local Verification Results

- `0025_agregacion.sql` existe, SIN BOM (primeros bytes `2d 2d 20` = `-- `), 0 bytes non-ASCII (solo ASCII plano; sin acentos en SQL, sin comillas tipograficas, sin em-dash, sin BOM, sin unicode invisible).
- Task 2 verify (todos verdes): presentes `add column if not exists rut_proveedor`, `security definer set search_path = ''`, `tipo_persona = 'juridica'`, `revoke execute on function public.agregado_por_contraparte(text) from public`, `grant execute on function public.agregado_por_contraparte(text) to anon`; AUSENTES `public.contratista`/`public.donante` (W1 guard: comentarios referencian las sub-maestras BARE), `sum(`/`::numeric`, `CC BY 4.0`.
- Cuerpo del RPC `agregado_por_contraparte` (extraido entre `as $$ ... $$;`): contiene `juridica`; NO contiene `rut_donante`/`donante_id`/`contratista.nombre`/`donante.nombre` — coincide con lo que el pgTAP asserta via `pg_get_functiondef`.
- `0026_agregacion.test.sql` existe, SIN BOM, 0 bytes non-ASCII; `select plan(16)` coincide con 16 asserts. Task 1 verify verde: `agregado_por_contraparte` presente, `not ilike '%rut_donante%'`, `not ilike '%donante_id%'`, `ilike '%juridica%'` presentes; `CC BY 4.0` ausente.
- TDD gate: `test(16-01)` (b1333ee) precede a `feat(16-01)` (dca03d6) en el log.
- Atribucion: ni "CC BY 4.0" en ninguno de los dos archivos; defaults ChileCompra ("mencion de la fuente") / SERVEL ("terminos por verificar") intactos (no se tocan las tablas de hecho).
- Apply remoto + pgTAP verde: **PENDIENTE de operador** (Task 3).

## Threat Surface Mapping (del threat_model del plan)

- **T-16-01** (proyectar un nombre de persona natural): mitigado — `where tipo_persona = 'juridica'` sobre la fila de hecho; el cuerpo NO referencia contratista/donante; pgTAP `not ilike '%contratista.nombre%'`/`%donante.nombre%`.
- **T-16-02** (leak de RUT/llave sintetica del donante): mitigado — el RPC NO selecciona `rut_donante`/`donante_id` (la fila `aporte` no los tiene); pgTAP `not ilike '%rut_donante%'`/`%donante_id%`.
- **T-16-03** (aflojar grants de las sub-maestras): mitigado — 0025 NO agrega policy/grant a `contratista`/`donante`; pgTAP regresion deny-by-default para ambas (RLS on, 0 policies, 0 anon SELECT).
- **T-16-04** (SQL injection via p_id): mitigado — arg parametrizado `p_id text`; `set search_path = ''`; guardia regex a nivel de ruta queda para Plan 16-02.
- **T-16-05** (exposicion antes del sign-off legal): aceptado por diseno — `moneyPublicEnabled()` default OFF gatea la ruta (Plan 16-02); encender = deuda de operador F13, fuera de scope.
- **T-16-SC** (instalaciones npm/pip/cargo): n/a — la fase instala CERO paquetes; sin superficie de install.

Sin superficie de amenaza nueva fuera del `threat_model` del plan (la migracion no introduce endpoints, auth, ni cambios de schema en frontera de confianza mas alla del RPC ya modelado y la columna `contrato.rut_proveedor` agregada).

## Self-Check: PASSED

- FOUND: supabase/migrations/0025_agregacion.sql
- FOUND: supabase/tests/0026_agregacion.test.sql
- FOUND commit: b1333ee (test 0026_agregacion)
- FOUND commit: dca03d6 (feat 0025_agregacion)
