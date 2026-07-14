# Phase 72: DINERO P5d — Extender materializador `cruce_senal` con `lobby_sector_aporte` - Research

**Researched:** 2026-07-14
**Domain:** PostgreSQL DDL aditiva + materializador de señales (plpgsql) sobre Supabase; capa de cruces parlamentario↔sector; régimen MONEY gated + anti-insinuación
**Confidence:** HIGH (todo verificado leyendo las migraciones aplicadas 0023/0024/0025/0034/0035/0036/0038/0039/0040 y el linter 68 en el repo)

## Summary

El token `lobby_sector_aporte` está reservado **solo en comentarios** de la migración 0039 — **NO** está en el `CHECK (tipo_senal in ('lobby_sector'))`. La afirmación de CONTEXT/ROADMAP de que "el token ya está RESERVADO en el CHECK/enum" es incorrecta [VERIFIED: `supabase/migrations/0039_cruce_senal.sql:50`]. Por tanto la migración aditiva **sí** debe alterar el CHECK para admitir `'lobby_sector_aporte'`, además de añadir la rama del insert. El materializador `cruces.materializar_cruces()` es efectivamente un FULL REBUILD transaccional (`delete from public.cruce_senal;` seguido de `insert ... select`), y la nueva rama es un segundo `insert into public.cruce_senal ... select` dentro de la misma función, después del insert lobby-puro existente.

**El hallazgo bloqueante de planificación:** MONEY-03 pide contar, por parlamentario, aportes/contratos **por SECTOR vía RUT de empresas ligadas**. Pero en el esquema actual **NINGUNA tabla de dinero tiene `sector_id`**: la migración 0038 añadió `sector_id` solo a `proyecto_ficha`, `lobby_contraparte` y `donante`; y el único clasificador que existe (`packages/cruces`) puebla `sector_id` **solo** en `proyecto_ficha` y `lobby_contraparte` — **nunca** en `donante`, y `contratista`/`contrato`/`aporte`/`entidad_tercero` **no tienen columna de sector en absoluto** [VERIFIED: 0038 líneas 68-70; `packages/cruces/src/writer-supabase.ts:95,112`]. No existe hoy un camino de join "empresa ligada por RUT → sector". Esto NO es "solo añadir una rama de insert": el planner debe resolver de dónde sale el sector para el dinero (Open Question 1, BLOQUEANTE de diseño).

El lado bueno: la señal debe rendir **VACÍO HONESTO** hoy, y lo hará por dos razones independientes que ya son verdad en PROD — (a) RUT-01 está a **0% de cobertura** (69-02: `parl 0/186=0%, entidades 0=n/d`), y (b) los backfills de ChileCompra/SERVEL son deuda de operador pendiente, así que `contrato`/`aporte` están ~vacíos [VERIFIED: STATE.md:90,110,111]. Cualquier rama que se escriba producirá 0 filas hasta que el operador aplique RUT-01 + backfills. Eso satisface el criterio "sin RUT → vacío honesto, no falso" por construcción, siempre que la rama JOIN-ee contra el RUT/entidad y no fabrique por nombre.

**Primary recommendation:** Escribir la migración `0052_cruce_senal_lobby_sector_aporte.sql` que (1) `ALTER TABLE ... DROP/ADD CONSTRAINT` para ampliar el CHECK a `('lobby_sector','lobby_sector_aporte')`, y (2) `CREATE OR REPLACE FUNCTION cruces.materializar_cruces()` re-emitiendo el cuerpo completo (mismo `delete from` + insert lobby existente) **más** una segunda rama insert para `lobby_sector_aporte`. La rama de aporte debe unir el hecho de dinero al RUT/entidad y al sector por una vía **determinista RUT-exacta**, rindiendo 0 filas cuando no hay RUT/sector. **PERO** el planner debe primero resolver Open Question 1 (de dónde sale el sector del dinero) antes de escribir el SQL de la rama — hoy no hay tal columna.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extender allow-list del token `tipo_senal` | Database (DDL / CHECK) | — | El CHECK es la allow-list LOCKED; ampliarla es DDL aditivo |
| Materializar señal aporte×sector (FULL REBUILD) | Database (plpgsql `cruces.materializar_cruces`) | pg_cron (invocación diaria, ya programada) | Es un agregado derivado de hechos; vive como proc security-definer, no en el frontend/conector |
| Origen del `sector` del dinero (NO EXISTE hoy) | Database (schema) + Conector (clasificador) | — | Requiere decisión: nueva columna + clasificador, o vía puente existente. GAP real |
| Vínculo empresa↔RUT↔parlamentario | Database (FKs `contrato.parlamentario_id`, `contratista.entidad_id`) + Conector (reconciliadores) | — | Ya existe: enlace RUT-exacto determinista (Phase 70/reconciliar-contrato) |
| Vacío honesto sin RUT | Database (JOIN por RUT/entidad ⇒ 0 filas) | — | Fail-closed nace de que el JOIN no matchea sin RUT presente |
| Anti-insinuación de la etiqueta | Revisión manual (SQL) + linter TS (Phase 68, solo escanea TSX de superficies) | Phase 73 (superficies MONEY) | El linter 68 NO escanea SQL; la señal SQL es factual-count por diseño, la etiqueta ciudadana la valida el linter en Phase 73 |
| Gate MONEY (no presentar) | Frontend (`moneyPublicEnabled`) + `crucesPublicEnabled` | Guard CI anti-flip (Phase 73) | La señal se materializa OFF-line; nunca se presenta hasta el flip legal |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Anti-insinuación / anti-causalidad (rector):** la señal es un CONTEO FACTUAL con evidencia jsonb (enlaces a la fuente). NUNCA un score de correlación, NUNCA afirmación causal. PROHIBIDO en la señal y su etiqueta: "financió su voto", "a cambio de", "por eso votó", cualquier insinuación de causa/intención. Descriptivo: "N aportes del sector X a empresas ligadas por RUT (con enlaces de fuente)".
- **Migración aditiva + FULL REBUILD:** aditiva (nuevo valor en el CHECK del token + nueva rama del insert); NO altera señales existentes. Materializador transaccional FULL REBUILD (mismo patrón de 0039). Idempotente.
- **Depende de RUT (fail-closed):** solo cuenta parlamentarios con RUT PRESENTE (vía empresas ligadas por RUT — ChileCompra/aporte por RUT). Sin RUT → vacío honesto (0 filas), nunca falso por nombre. SERVEL (por nombre) no aporta RUT — su inclusión, si aplica, respeta el determinista fail-closed.
- **Gate MONEY:** bajo `MONEY_PUBLIC_ENABLED` OFF; la señal existe materializada pero no se presenta hasta el flip legal (Phase 73). Guard anti-flip.

### Claude's Discretion
Detalles SQL de la rama aditiva dentro de las reglas; reusar el patrón de `cruces.materializar_cruces()` (0039) y el token reservado.

### Deferred Ideas (OUT OF SCOPE)
- Superficies MONEY + flip legal → Phase 73 (acto humano).
- Cruce dinero × voto × timeline (MONEYX-01), co-votación → v2 (máquina de sospechas, diferido).
- Aplicar la migración a PROD = acto controlado (db push / operador), no necesariamente esta corrida; el agente escribe + valida la migración.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MONEY-03 | Los cruces dinero × sector aparecen como conteos factuales en `cruce_senal` (materializador extendido con `lobby_sector_aporte`) — nunca un score de correlación, nunca "financió su voto". | Patrón exacto de la rama de insert (Code Examples §1), lugar de inserción en `cruces.materializar_cruces()`, ampliación del CHECK, evidencia jsonb PII-safe. **BLOQUEANTE:** el join hecho-dinero→sector→RUT no existe hoy (Open Question 1). |

## Project Constraints (from CLAUDE.md)

- **Ingesta dos etapas (LOCKED):** no aplica directamente aquí (esta fase es DDL + materializador, no ingesta), pero el materializador es un derivado reconstruible desde datos ya en Supabase (misma filosofía).
- **Migraciones = checkpoint de operador:** `tsc`/`pnpm test` NO prueban que Postgres ejecutó el DDL (falso positivo de CI, repetido en 0023/0038/0039/0049). La única prueba válida es el pgTAP corriendo contra el schema APLICADO. Aplicar por `psql --db-url` DIRECTO, **NUNCA** `supabase db push` (drift `schema_migrations`). BOM UTF-8 en `.env` rompe el CLI → pasar `--db-url` explícito. `PGCLIENTENCODING=UTF8` en Windows. La aplicación al remoto es acto de operador (deferido, ver CONTEXT).
- **GSD workflow enforcement:** no editar fuera de un comando GSD.
- **Anti-causalidad como principio rector del proyecto:** cada dato con fuente/fecha/enlace, sin afirmar intención ni causalidad.

## Standard Stack

Sin dependencias externas nuevas. La fase es SQL puro (una migración) + un test pgTAP + (posiblemente) un fixture. Todo el "stack" ya está en el repo.

| Componente | Ubicación / patrón | Propósito | Por qué |
|------------|--------------------|-----------|---------|
| Migración SQL aditiva | `supabase/migrations/0052_*.sql` (siguiente número libre; 0051 es la más alta) | `ALTER` del CHECK + `CREATE OR REPLACE FUNCTION` | Espejo de 0039/0049 |
| Test pgTAP | `supabase/tests/0052_*.test.sql` | Verificar rama nueva contra schema aplicado | Espejo de `0039_cruce_senal.test.sql` |
| `pg_cron` | ya programado (`cruces-materializar`, `'23 3 * * *'`) | Invoca la función diaria | No se re-programa: `CREATE OR REPLACE` de la función lo hereda |

### Version verification
No aplica (sin paquetes nuevos). Postgres 15+ / pgvector no relevantes a esta fase.

## Package Legitimacy Audit

No aplica — esta fase **no instala paquetes externos**. Es DDL + pgTAP dentro del repo. (Ningún `npm install`, `pip install` ni `cargo add`.)

## Architecture Patterns

### System Architecture Diagram

```
                          FUENTES (ya ingeridas a Supabase, deny-by-default)
                          ┌─────────────────────────────────────────────┐
                          │ contrato (rut_proveedor, parlamentario_id)   │  ChileCompra (Phase 70)
                          │ contratista (rut_proveedor PK, entidad_id)   │
                          │ aporte (donante_nombre, parlamentario_id)    │  SERVEL (Phase 71, SIN RUT)
                          │ donante (donante_id PK, sector_id, rut null) │
                          │ entidad_tercero (id, rut, tipo_entidad)      │  maestra terceros (Phase 69/RUT-01)
                          │ sector (codigo, etiqueta)                    │  catálogo (0038)
                          └───────────────────────┬─────────────────────┘
                                                  │
                                   (JOIN por RUT + sector — HOY NO EXISTE la arista sector↔dinero)
                                                  │
                          cruces.materializar_cruces()  ◄── pg_cron '23 3 * * *' (ya programado)
                          ┌───────────────────────┴─────────────────────┐
                          │ 1. delete from public.cruce_senal;  (FULL REBUILD)          │
                          │ 2. insert ... 'lobby_sector'   (EXISTENTE, no tocar la lógica)│
                          │ 3. insert ... 'lobby_sector_aporte'  ◄── NUEVA RAMA (Phase 72)│
                          └───────────────────────┬─────────────────────┘
                                                  ▼
                          cruce_senal (deny-by-default; unique(parlamentario_id,sector_id,tipo_senal))
                                                  │
                          cruces_de_parlamentario(p_id)  (0040, RPC genérico por tipo_senal;
                                                  │        SIN grant a anon hasta sign-off)
                                                  ▼
                          Superficies MONEY  ── gated por crucesPublicEnabled()/moneyPublicEnabled() (Phase 73)
```

**Nota clave:** `cruces_de_parlamentario` (0040) NO filtra por `tipo_senal` — proyecta cualquier fila de `cruce_senal` de ese parlamentario. Por tanto, una vez materializada la señal `lobby_sector_aporte`, fluye automáticamente por ese RPC (gated OFF). Phase 72 no necesita tocar 0040; Phase 73 sí decidirá cómo presentar el nuevo `tipo_senal` y bajo qué etiqueta.

### Pattern 1: Migración aditiva del CHECK (drop + add constraint)
**What:** El CHECK del token es un constraint inline sin nombre en 0039; para ampliarlo hay que localizar su nombre generado o recrearlo. Postgres nombra los CHECK inline como `<tabla>_<col>_check` → `cruce_senal_tipo_senal_check`.
**When to use:** Siempre que se amplíe un allow-list CHECK aditivamente.
**Example:**
```sql
-- Fuente: patrón estándar Postgres 15 (drop+add constraint es transaccional en la misma migración)
alter table public.cruce_senal
  drop constraint cruce_senal_tipo_senal_check;
alter table public.cruce_senal
  add constraint cruce_senal_tipo_senal_check
  check (tipo_senal in ('lobby_sector', 'lobby_sector_aporte'));
```
[VERIFIED: nombre del constraint por convención Postgres; el CHECK inline actual está en 0039:50, sin nombre explícito → Postgres genera `cruce_senal_tipo_senal_check`]. **Pitfall:** confirmar el nombre real contra el schema aplicado (`\d cruce_senal` o `select conname from pg_constraint where conrelid='public.cruce_senal'::regclass and contype='c'`) antes de escribir el `drop constraint`; si un forward-fix previo lo renombró, el drop fallaría.

### Pattern 2: Segunda rama de insert en el FULL REBUILD
**What:** La función `cruces.materializar_cruces()` se re-emite completa con `CREATE OR REPLACE`. El `delete from public.cruce_senal;` (línea 85) sigue siendo el único delete. La rama lobby existente (líneas 91-120) se conserva **byte-idéntica**. La rama aporte es un segundo `insert into public.cruce_senal (...) select ...` después.
**When to use:** Este es el patrón LOCKED de la fase.
**Anti-Pattern:** NO añadir un segundo `delete`. NO usar `on conflict` (el rebuild es delete-all + reinsert, D-11); pero como ambas ramas insertan y existe `unique (parlamentario_id, sector_id, tipo_senal)`, un parlamentario puede tener AMBAS señales para el mismo sector (distinto `tipo_senal`) sin colisión — el unique las distingue por `tipo_senal`. Verificar que la rama aporte no duplique filas por parlamentario+sector+tipo (usar `group by parlamentario_id, sector_id`).

### Anti-Patterns to Avoid
- **Name-match para el vínculo dinero→parlamentario:** PROHIBIDO (riesgo #1). El insert debe unir por `contrato.parlamentario_id`/`aporte.parlamentario_id` **solo cuando `estado_vinculo='confirmado'`** (fail-closed, IDENT-12; espejo de 0049 que exige `estado_vinculo='confirmado'` + `parlamentario_id is not null`).
- **Fabricar sector:** si no hay sector clasificado para la empresa, la fila NO entra (0038 D-05: NULL = honest no-match, sin catch-all 'otros'). Espejo de 0049 (boletín sin ficha/sector → CTE vacío → 0 filas).
- **Referenciar `partido`/`rut` en el cuerpo de la función:** el pgTAP de 0039 introspecciona el cuerpo con `pg_get_functiondef` y falla si aparece `\y(partido|rut)\y` (no-PII, LEGAL-03). La nueva rama NO puede mencionar `rut` como texto — un problema si el JOIN necesita `entidad_tercero.rut`. **Ver Pitfall 3.**
- **Sumar/castear `monto`:** `monto` es `text` VERBATIM (hoy null en contratos). El CONTEO es `count(*)` de hechos, jamás una suma de dinero.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vínculo empresa→parlamentario | Un match por nombre de proveedor | `contrato.parlamentario_id` / `aporte.parlamentario_id` ya reconciliado por RUT-exacto (Phase 70) + `estado_vinculo='confirmado'` | El reconciliador (reconciliar-contrato.ts) ya hace el enlace RUT-exacto fail-closed; re-hacerlo en SQL reintroduce el riesgo #1 |
| Rebuild idempotente | Lógica de upsert/merge manual | El patrón `delete from` + `insert ... select` existente | 0039 ya lo estableció; el unique constraint garantiza idempotencia |
| Programación del cron | Nuevo `cron.schedule` | El job `cruces-materializar` ya existente | `CREATE OR REPLACE` de la función lo hereda; un segundo schedule duplicaría corridas |
| RPC de lectura | Nuevo RPC para el token aporte | `cruces_de_parlamentario` (0040) ya es genérico por `tipo_senal` | Ya proyecta cualquier `cruce_senal`; Phase 73 lo consume gated |

**Key insight:** Toda la infraestructura (tabla, cron, RPC, reconciliación RUT) existe. Lo net-new es (a) el CHECK ampliado, (b) la rama del insert, y (c) **la arista sector↔dinero que hoy no existe** (el verdadero trabajo de diseño).

## Runtime State Inventory

> Fase de extensión de schema/materializador (no rename, pero toca estado materializado). Inventario de qué estado runtime queda afectado:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `cruce_senal` en PROD tiene hoy filas `lobby_sector` (de lobby). Un FULL REBUILD las **borra y reconstruye** en cada corrida — la primera corrida tras aplicar la nueva función re-materializa lobby + intenta aporte. | Verificar que la rama lobby se conserva byte-idéntica para NO perder señal existente. El rebuild las repone. |
| Live service config | `pg_cron` job `cruces-materializar` (`'23 3 * * *'`) ya registrado en `cron.job`. NO se re-programa. | Ninguna — `CREATE OR REPLACE` de la función es transparente al cron. |
| OS-registered state | Ninguno — no hay estado OS. Verificado: la fase es DDL en Supabase remoto. | Ninguna. |
| Secrets/env vars | `MONEY_PUBLIC_ENABLED` (OFF) y `CRUCES_PUBLIC_ENABLED` (ON en PROD desde 2026-07-02) gobiernan presentación, no materialización. La señal se materializa OFF-line independientemente del flag. | Ninguna en Phase 72; el flip es Phase 73. |
| Build artifacts | Ninguno — no hay paquete que reinstalar. El pgTAP corre contra el schema aplicado. | Ninguna. |

**Nada material que migrar de datos:** la señal aporte nace vacía (RUT 0% + dinero no backfilleado). El primer rebuild con datos reales ocurre cuando el operador aplique RUT-01 + backfills (deuda pendiente).

## Common Pitfalls

### Pitfall 1: Asumir que el token ya está en el CHECK
**What goes wrong:** El insert de `'lobby_sector_aporte'` falla con `23514 check_violation` porque el CHECK actual solo admite `'lobby_sector'`.
**Why it happens:** CONTEXT.md y ROADMAP afirman "token ya RESERVADO en 0039"; pero en 0039 la reserva es **solo un comentario** (líneas 22-24, 49), el CHECK real es `check (tipo_senal in ('lobby_sector'))` (línea 50).
**How to avoid:** La migración DEBE ampliar el CHECK (Pattern 1) antes/junto con la rama del insert. Verificado leyendo 0039:50 y confirmando que 0040/0041/0049 no lo alteraron.
**Warning signs:** El pgTAP falla al llamar `cruces.materializar_cruces()` con `23514`.

### Pitfall 2 (BLOQUEANTE): No existe la arista sector↔dinero
**What goes wrong:** No hay forma en el schema actual de mapear un contrato/aporte a un `sector`. `contrato`/`aporte`/`contratista`/`entidad_tercero` no tienen `sector_id`; `donante.sector_id` existe pero NUNCA se puebla (el clasificador solo toca `proyecto_ficha` y `lobby_contraparte`).
**Why it happens:** 0038 añadió `sector_id` solo a 3 tablas y el clasificador (packages/cruces) solo clasifica fichas y contrapartes de lobby. `donante.entidad_id` fue explícitamente DIFERIDO (0036:9).
**How to avoid:** El planner debe decidir la vía de sector para el dinero ANTES de escribir la rama (Open Question 1). Opciones plausibles — todas requieren diseño, ninguna es "solo un insert".
**Warning signs:** La rama del insert no tiene ninguna columna de sector válida a la que unir; el `select` no compila o siempre da 0 filas por razón equivocada (no por falta de RUT, sino por falta de arista).

### Pitfall 3: El pgTAP no-PII prohíbe la palabra `rut` en el cuerpo de la función
**What goes wrong:** Si la rama aporte hace `join public.entidad_tercero e on e.rut = ...` o `contrato.rut_proveedor`, el cuerpo contendrá el token `rut` y el aserto de 0039 (`... !~* '\y(partido|rut)\y'`) fallaría — o el planner reusaría el mismo aserto en el test 0052.
**Why it happens:** 0039 impuso que el cuerpo del materializador NO mencione `partido`/`rut` (LEGAL-03). Pero el vínculo por RUT necesita esas columnas.
**How to avoid:** Dos caminos: (a) unir por `parlamentario_id` ya reconciliado (NO por rut crudo en el cuerpo) — el enlace RUT-exacto ya vive en `contrato.parlamentario_id`/`aporte.parlamentario_id`, así el cuerpo NUNCA menciona `rut`; el "vía RUT" se satisface porque ese FK solo se pobló por RUT-exacto aguas arriba (contratos) / por nombre confirmado (aportes). (b) Si el sector viene de una columna con "rut" en el nombre (`contrato.rut_proveedor`), el aserto no-PII debe reconsiderarse para el token aporte. **Recomendación:** camino (a) — unir por `parlamentario_id` confirmado, evitar `rut` en el cuerpo, y la evidencia jsonb lleva `codigo_orden`/`enlace`, nunca RUT. Esto además mantiene la evidencia PII-safe como en 0040 (sin rut/donante_id).
**Warning signs:** El pgTAP no-PII rompe; o la evidencia jsonb contiene un RUT.

### Pitfall 4: El rebuild borra la señal lobby si la rama existente se altera
**What goes wrong:** Al re-emitir la función con `CREATE OR REPLACE`, si el insert lobby se modifica u omite, se pierde la señal lobby-pura tras el próximo rebuild.
**How to avoid:** Copiar la rama lobby (0039:91-120) **verbatim**; añadir la rama aporte a continuación. El pgTAP debe seguir verificando `>=5 parlamentarios lobby_sector` (aserto existente) además de las aserciones nuevas del token aporte.

### Pitfall 5: Aplicar por `supabase db push`
**What goes wrong:** Drift de `schema_migrations` en el remoto → re-aplica/salta migraciones.
**How to avoid:** `psql --db-url` DIRECTO, `--single-transaction`, `PGCLIENTENCODING=UTF8`, esquivar el BOM del `.env`. Patrón repetido en 0023/0038/0039/0049. Aplicación = acto de operador (deferido, no necesariamente esta corrida).

## Code Examples

### 1. La rama nueva del insert (esqueleto — pendiente de resolver Open Question 1 sobre el sector)
```sql
-- Fuente: patrón derivado de cruces.materializar_cruces (0039:91-120) + join
--   confirmado-solo de cruces_de_proyecto (0049:80-103). SECTOR = placeholder hasta OQ1.
-- Rama APORTE: cuenta, por (parlamentario CONFIRMADO, sector de la empresa ligada),
--   los aportes/contratos, con evidencia jsonb PII-safe (enlace de fuente, SIN rut).
insert into public.cruce_senal
  (parlamentario_id, sector_id, tipo_senal, conteo, evidencia,
   dataset, origen, fecha_captura, enlace)
select
  a.parlamentario_id,
  <SECTOR_DE_LA_EMPRESA>,               -- ⚠ OQ1: hoy NO existe columna de sector en dinero
  'lobby_sector_aporte',
  count(*),
  jsonb_build_object(
    'conteo', count(*),
    'items', jsonb_agg(
      jsonb_build_object(
        'tipo', 'aporte',                -- o 'contrato'
        'fecha', a.fecha_aporte,
        'monto_verbatim', a.monto,       -- text VERBATIM, jamás sumado/casteado
        'fuente_id', a.fuente_id,
        'enlace_fuente', a.enlace        -- trazabilidad D-09; SIN rut/donante_id (PII-safe)
      ) order by a.fecha_aporte desc nulls last
    )
  ),
  'servel',                              -- o 'chilecompra'
  min(a.origen),
  now(),
  min(a.enlace)
from public.aporte a
-- JOIN al sector de la empresa ligada por RUT — LA ARISTA QUE FALTA (OQ1)
where a.estado_vinculo = 'confirmado'    -- fail-closed: solo confirmados (IDENT-12)
  and a.parlamentario_id is not null
  -- and <sector no nulo>                -- sin sector → no entra (0038 D-05, sin catch-all)
group by a.parlamentario_id, <SECTOR_DE_LA_EMPRESA>;
```

### 2. Aserciones pgTAP nuevas (espejo de 0039_cruce_senal.test.sql)
```sql
-- Fuente: 0039_cruce_senal.test.sql (patrón begin/plan/seed/materializar/assert/rollback).
-- (a) El CHECK admite el token nuevo (insert directo NO viola 23514):
select lives_ok(
  $$ insert into cruce_senal (parlamentario_id, sector_id, tipo_senal, conteo, evidencia,
       dataset, origen, fecha_captura, enlace)
     values ('CR1','salud','lobby_sector_aporte',1,'{"conteo":1,"items":[]}'::jsonb,
       'servel','servel', now(), 'http://x') $$,
  'el CHECK admite tipo_senal lobby_sector_aporte');
-- (b) Con datos sembrados (aporte confirmado + empresa con sector), la rama produce filas:
select cmp_ok(
  (select count(*)::int from cruce_senal where tipo_senal='lobby_sector_aporte'),
  '>=', 1, 'materializar produce señal lobby_sector_aporte con datos');
-- (c) VACÍO HONESTO: sin RUT/vínculo confirmado, 0 filas de aporte (no falso):
--    (sembrar aporte con estado_vinculo='no_confirmado' → NO debe aparecer)
select is(
  (select count(*)::int from cruce_senal
    where tipo_senal='lobby_sector_aporte' and parlamentario_id='CR_NOCONF'),
  0, 'aporte no_confirmado NO cuelga de un parlamentario (fail-closed)');
-- (d) evidencia PII-safe: NO contiene rut ni donante_id:
select ok(
  (select bool_and( (evidencia)::text !~* '\y(rut|donante_id)\y' )
     from cruce_senal where tipo_senal='lobby_sector_aporte'),
  'la evidencia de aporte es PII-safe (sin rut/donante_id)');
-- (e) el aserto no-PII del CUERPO de la función se conserva (sin partido/rut):
--    reusar el aserto de 0039 con \y(partido|rut)\y — depende de resolver Pitfall 3.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Señal lobby-pura única (`lobby_sector`) | Multi-token en `cruce_senal` (añadir `lobby_sector_aporte`) | Phase 72 (esta) | Segunda rama en el mismo proc rebuild |
| `contrato` sin `rut_proveedor` | `contrato.rut_proveedor` (0025) | 0025 | Existe la llave RUT del proveedor para contratos |
| `donante.entidad_id` planeado | DIFERIDO (0036:9) | 0036 | Aportes NO tienen puente a `entidad_tercero`; su llave pública es `donante_nombre` |

**Deprecated/outdated:**
- La afirmación "token reservado en el CHECK/enum" (CONTEXT/ROADMAP): **falso**, es solo comentario. El CHECK debe ampliarse.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El constraint CHECK se llama `cruce_senal_tipo_senal_check` (convención Postgres para CHECK inline) | Pattern 1 | Si un forward-fix lo renombró, el `drop constraint` falla → verificar con `pg_constraint` contra el schema aplicado antes de escribir |
| A2 | `cruces_de_parlamentario` (0040) proyectará el token nuevo sin cambios (es genérico por `tipo_senal`) | Diagram | Bajo — leído en 0040; pero Phase 73 debe decidir la etiqueta/orden de presentación (0040 ordena `by conteo desc` — potencial insinuación de ranking a revisar en 73) |
| A3 | El insert por `aporte.parlamentario_id`/`contrato.parlamentario_id` confirmado satisface "vía RUT" sin mencionar `rut` en el cuerpo | Pitfall 3 | Medio — para contratos el FK sí nace de RUT-exacto (correcto); para aportes el FK nace de nombre confirmado (SERVEL sin RUT). Si el planner exige literal "vía RUT de empresas ligadas", los aportes SERVEL podrían quedar EXCLUIDOS de esta señal (solo ChileCompra-por-RUT entra). **Decisión de diseño (OQ2).** |

## Open Questions

1. **BLOQUEANTE — ¿De dónde sale el `sector` del dinero?** (Pitfall 2)
   - What we know: NINGUNA tabla de dinero tiene `sector_id` poblado. `donante.sector_id` existe pero está vacío (sin clasificador). `contratista`/`entidad_tercero` no tienen columna de sector. El sector solo vive en `lobby_contraparte` y `proyecto_ficha`.
   - What's unclear: la vía canónica empresa→sector. Opciones a evaluar por el planner:
     - (a) **Puente por nombre de empresa a `lobby_contraparte.sector_id`** (la empresa que aportó/contrató también aparece como contraparte de lobby ya clasificada). Riesgo: match por nombre crudo, frágil; NO es "vía RUT".
     - (b) **Añadir + poblar `sector_id` en la tabla de dinero** (nueva columna en `contrato`/`aporte` o en `entidad_tercero`/`contratista`) + extender el clasificador `packages/cruces` para clasificar empresas de dinero. Es trabajo real, probablemente fuera del alcance "aditivo" de Phase 72.
     - (c) **Puente por RUT `contrato.rut_proveedor` → `entidad_tercero.rut` → (columna de sector nueva en entidad_tercero)**. Requiere columna nueva + clasificación de terceros.
   - Recommendation: Escalar a discuss-phase/operador. La opción más honesta con "vía RUT" es (c) pero excede lo aditivo. La opción mínima que rinde vacío-honesto-hoy sin fabricar es escribir la rama con un JOIN a la arista que se decida, aceptando 0 filas hasta que exista clasificación de sector para dinero. **El planner NO puede escribir el SQL final sin esta decisión.**

2. **¿Entra SERVEL en esta señal, o solo ChileCompra-por-RUT?** (A3)
   - What we know: SERVEL no trae RUT (enlace por nombre confirmado). CONTEXT dice "SERVEL (por nombre) no aporta RUT — su inclusión, si aplica, respeta el determinista fail-closed."
   - What's unclear: si la señal `lobby_sector_aporte` cuenta solo contratos (por RUT) o también aportes (por nombre confirmado). El token dice "aporte" (SERVEL), pero el criterio dice "vía RUT de empresas ligadas".
   - Recommendation: Decisión de operador. Interpretación literal del token (`aporte`) sugiere SERVEL; interpretación literal del criterio ("vía RUT") sugiere ChileCompra. Probable respuesta: la señal cubre ambos frentes de dinero por sector, pero cada uno respeta su enlace fail-closed (contratos por RUT-exacto, aportes por nombre confirmado determinista). Confirmar.

3. **¿El aserto no-PII del cuerpo (0039) se reusa en el test 0052?** (Pitfall 3)
   - Recommendation: Sí, si se sigue el camino (a) de unir por `parlamentario_id` (el cuerpo no menciona `rut`). Verificar que ninguna columna del `select` ni del `join` tenga `rut`/`partido` como token literal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL remoto (Supabase) | Aplicar migración + pgTAP | ✓ (remoto sa-east-1) | 15+ | — (aplicación = operador, deferido) |
| `pg_cron` | job `cruces-materializar` ya programado | ✓ | — | — |
| `psql` local | Aplicar por `--db-url` + correr pgTAP | ✓ (patrón repetido 0018-0051) | — | — |
| pgTAP (extensión) | Correr los tests | ✓ (usado en todos los `*.test.sql`) | — | — |

**Missing dependencies with no fallback:** Ninguna para la parte offline (escribir migración + test + fixture). La APLICACIÓN al remoto es checkpoint de operador (deferido por diseño, ver CONTEXT deferred).

**Datos:** RUT-01 (0% cobertura) + backfills ChileCompra/SERVEL están PENDIENTES de operador → la señal rinde vacío honesto hoy. Eso es CORRECTO por requisito, no un blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **pgTAP** (SQL, contra schema aplicado) para el DDL/materializador; **vitest** (app/packages) solo si se toca TS (no previsto en Phase 72) |
| Config file | `supabase/tests/*.test.sql` (sin config; se corren por `psql -tA -f`); `app/vitest.config.ts` (no relevante aquí) |
| Quick run command | `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0052_*.test.sql` (contra schema aplicado) |
| Full suite command | Root: `pnpm test` (vitest app+packages) — NO cubre el DDL; el pgTAP es su propio carril de operador |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MONEY-03 | El CHECK admite `lobby_sector_aporte` | pgTAP `lives_ok(insert ...)` | `psql --db-url -tA -f supabase/tests/0052_*.test.sql` | ❌ Wave 0 |
| MONEY-03 | El materializador produce la señal con datos sembrados (conteo + evidencia jsonb con enlace) | pgTAP `cmp_ok >= 1` + `is(evidencia->items->0->>'enlace_fuente')` | idem | ❌ Wave 0 |
| MONEY-03 | Vacío honesto: aporte `no_confirmado` NO cuelga (fail-closed) | pgTAP `is(count=0)` | idem | ❌ Wave 0 |
| MONEY-03 | Evidencia PII-safe (sin rut/donante_id) + cuerpo no-PII (sin partido/rut) | pgTAP `ok(text !~* '\y(rut|donante_id)\y')` + aserto de cuerpo | idem | ❌ Wave 0 |
| MONEY-03 | La señal lobby existente NO se pierde tras el rebuild | pgTAP `cmp_ok(lobby_sector >= 5)` (reusar aserto de 0039) | idem | ❌ Wave 0 |
| MONEY-03 (anti-insinuación) | La etiqueta/copy ciudadano no insinúa causa | **Phase 73** (linter vitest sobre superficies MONEY TSX) | — (el linter 68 NO escanea SQL) | N/A aquí |

### Sampling Rate
- **Per task commit:** `pnpm test` (root — verifica que TS/guards siguen verdes; el DDL no rompe la suite TS).
- **Per wave merge:** el pgTAP `0052_*.test.sql` contra un schema aplicado (o local con las migraciones aplicadas hasta 0052).
- **Phase gate:** pgTAP verde + suite TS verde antes de `/gsd:verify-work`. La APLICACIÓN a PROD es checkpoint de operador (deferido).

### Wave 0 Gaps
- [ ] `supabase/migrations/0052_cruce_senal_lobby_sector_aporte.sql` — la migración (CHECK + rama insert). **Bloqueada por Open Question 1.**
- [ ] `supabase/tests/0052_cruce_senal_lobby_sector_aporte.test.sql` — pgTAP (espejo de `0039_cruce_senal.test.sql`: begin/plan/seed/materializar/assert/rollback) cubriendo MONEY-03.
- [ ] Fixture de siembra en el propio test: aporte/contrato confirmado + empresa con sector + un caso `no_confirmado` (para el aserto de vacío honesto).
- Framework install: **ninguno** (pgTAP ya en uso; vitest ya en uso).

## Security Domain

> `security_enforcement` no está explícitamente `false` en config → incluido. Esta fase toca datos PII (dinero/RUT) bajo Ley 21.719.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (DDL server-side; sin auth de usuario) |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | `cruce_senal` deny-by-default (RLS on, cero policies, `revoke all from anon,authenticated`); el RPC 0040 sin grant a anon; la nueva señal hereda el candado. NO añadir policies/grants. |
| V5 Input Validation | **yes** | El CHECK ampliado es la allow-list del token; `estado_vinculo='confirmado'` filtra fail-closed. |
| V6 Cryptography | no | — |
| V9 Data Protection / Privacy (Ley 21.719) | **yes** | Evidencia jsonb PII-safe (sin rut/donante_id, nombre crudo de empresa juridica solamente); cuerpo del proc sin `partido`/`rut` (aserto pgTAP 0039); vínculo por RUT-exacto/nombre-confirmado, NUNCA name-match laxo; MONEY gated OFF hasta sign-off legal. |

### Known Threat Patterns for {plpgsql materializer + PII money data}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuga de RUT/donante_id en la evidencia jsonb | Information Disclosure | Evidencia lleva solo `codigo_orden`/`fuente_id`/`enlace`/`monto verbatim`; pgTAP verifica ausencia de rut/donante_id |
| Atribución falsa (aporte/contrato colgado de un parlamentario por nombre) | Tampering / Repudiation | `estado_vinculo='confirmado'` + `parlamentario_id is not null` (fail-closed, espejo aporte_parlamentario_solo_confirmado 0024 + cruces_de_proyecto 0049) |
| Presentar la señal antes del sign-off legal | Elevation (de exposición) | Doble candado: RLS deny-by-default + RPC sin grant + `moneyPublicEnabled`/`crucesPublicEnabled` OFF; flip = acto humano Phase 73 con guard CI anti-flip |
| Insinuación causal en la etiqueta ("financió su voto") | (Reputacional/legal) | Señal = conteo factual por diseño; etiqueta ciudadana validada por el linter 68 en Phase 73 (el linter ya incluye "financió su voto"/"a cambio de" en TERMINOS_PROHIBIDOS) |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0039_cruce_senal.sql` — tabla `cruce_senal`, CHECK real `('lobby_sector')`, `cruces.materializar_cruces()` FULL REBUILD, cron. **Fuente central.**
- `supabase/tests/0039_cruce_senal.test.sql` — patrón pgTAP (seed/materializar/assert no-PII/rollback) a espejar.
- `supabase/migrations/0038_sector.sql` — catálogo `sector` + `sector_id` SOLO en proyecto_ficha/lobby_contraparte/donante (no en dinero).
- `supabase/migrations/0023_dinero.sql` / `0024_servel.sql` / `0025_agregacion.sql` — `contrato`/`contratista`/`aporte`/`donante`, llaves (rut_proveedor por RUT, donante_nombre por nombre), sin sector.
- `supabase/migrations/0034_entidad_tercero.sql` / `0035_vinculo_entidad.sql` / `0036_entidad_fk.sql` — maestra terceros por RUT, `contratista.entidad_id`, `donante.entidad_id` DIFERIDO.
- `supabase/migrations/0040_cruces_rpc.sql` — RPC de lectura genérico por `tipo_senal`, deny-by-default.
- `supabase/migrations/0049_cruces_de_proyecto.sql` — patrón de join confirmado-solo + orden neutro anti-insinuación.
- `app/lib/anti-insinuacion-guard.test.ts` — el linter 68 escanea SOLO TSX de superficies de voto (lista dura `SUPERFICIES_VOTO`), NO SQL; ya incluye "financió su voto"/"a cambio de".
- `app/lib/money-gate.ts` — `moneyPublicEnabled` fail-closed (`=== "true"`).
- `packages/cruces/src/writer-supabase.ts` — el clasificador solo puebla `sector_id` en proyecto_ficha/lobby_contraparte.
- `.planning/STATE.md` — RUT-01 0% cobertura; backfills dinero pendientes de operador; MONEY OFF.
- `.planning/REQUIREMENTS.md` — texto MONEY-03; MONEY-01/02 Complete.

### Secondary (MEDIUM confidence)
- Convención Postgres para nombre de CHECK inline (`<tabla>_<col>_check`) — estándar, pero verificar contra schema aplicado (A1).

### Tertiary (LOW confidence)
- Ninguna — todo verificado en el repo.

## Metadata

**Confidence breakdown:**
- Estructura del materializador y lugar de la rama: HIGH — leído verbatim en 0039.
- Ampliación del CHECK necesaria: HIGH — el CHECK real solo admite `lobby_sector` (contradice CONTEXT/ROADMAP).
- Patrón pgTAP: HIGH — espejo directo de 0039 test.
- Vacío honesto por falta de RUT/datos: HIGH — confirmado por STATE.md (0% RUT, backfills pendientes).
- Arista sector↔dinero: HIGH que NO EXISTE; el diseño de cómo crearla es OPEN (bloqueante).
- Alcance SERVEL vs ChileCompra en la señal: MEDIUM — decisión de operador (OQ2).

**Research date:** 2026-07-14
**Valid until:** ~2026-08-13 (schema estable; re-verificar solo si migraciones 0052+ cambian antes de planificar)

## RESEARCH COMPLETE

**Phase:** 72 - DINERO P5d — Extender materializador `cruce_senal` con `lobby_sector_aporte`
**Confidence:** HIGH (con UNA Open Question bloqueante de diseño)

### Key Findings
- El token `lobby_sector_aporte` NO está en el CHECK de 0039 — solo en comentarios. La migración aditiva DEBE ampliar `check (tipo_senal in ('lobby_sector','lobby_sector_aporte'))` (contradice CONTEXT/ROADMAP).
- El materializador es FULL REBUILD real (`delete from public.cruce_senal;` + `insert...select`). La rama nueva es un segundo `insert into public.cruce_senal ... select` tras el insert lobby (conservado verbatim). El cron y el RPC 0040 (genérico por `tipo_senal`) ya lo heredan — no se tocan.
- **BLOQUEANTE (Open Question 1):** NINGUNA tabla de dinero tiene `sector_id` poblado. 0038 puso sector solo en proyecto_ficha/lobby_contraparte/donante, y el clasificador solo llena proyecto_ficha/lobby_contraparte. No existe hoy la arista "empresa ligada por RUT → sector". El planner debe decidir la vía antes de escribir el SQL.
- Vacío honesto YA es cierto: RUT-01 a 0% + backfills dinero pendientes de operador ⇒ 0 filas. La rama debe unir por `parlamentario_id` confirmado (fail-closed), sin mencionar `rut` en el cuerpo (aserto no-PII de 0039), evidencia jsonb sin rut/donante_id.
- El linter anti-insinuación (Phase 68) escanea SOLO TSX de superficies de voto (lista dura), NO SQL. La etiqueta ciudadana la valida Phase 73; la señal SQL es factual-count por diseño.

### File Created
`.planning/phases/72-dinero-p5d-extender-materializador-cruce-senal-con-lobby-sector-aporte/72-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Sin paquetes; todo el patrón (migración/pgTAP/cron/RPC) existe en el repo |
| Architecture | HIGH | Estructura del materializador y candados leídos verbatim; arista sector↔dinero confirmada AUSENTE |
| Pitfalls | HIGH | CHECK no ampliado, no-PII en el cuerpo, rebuild borra lobby si se altera — todos verificados |

### Open Questions
1. **BLOQUEANTE:** ¿De dónde sale el `sector` del dinero? (no hay columna hoy — 3 opciones de diseño, escalar a operador/discuss)
2. ¿Entra SERVEL (por nombre) o solo ChileCompra (por RUT) en la señal? (interpretación del token vs criterio)
3. ¿Se reusa el aserto no-PII del cuerpo en el test 0052? (sí, si se une por parlamentario_id)

### Ready for Planning
Research completo. **Advertencia al planner:** NO se puede escribir el SQL final de la rama sin resolver Open Question 1 (arista sector↔dinero). Todo lo demás (ampliar CHECK, estructura del rebuild, pgTAP, fail-closed, PII-safe) está especificado y listo.
