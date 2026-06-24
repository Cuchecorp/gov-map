# Phase 35: ENT — Resolución de identidades de terceros — Research

**Researched:** 2026-06-23
**Domain:** Espejo del subsistema de identidad de `parlamentario` para una maestra nueva `entidad_tercero`
**Confidence:** HIGH (todo verificado contra el código real del repo; cero survey de dominio externo)

## Summary

El subsistema de identidad de `parlamentario` ya existe completo y probado: tres migraciones de DDL (0005 maestra + 0006 vínculo/cola/audit + 0007 guardas + 0012 anti-regresión + 0015 RPC transaccional) y dos paquetes TS (`@obs/identity` puro, `@obs/adjudication` con LLM+cola). Phase 35 es **mayoritariamente espejo mecánico** de ese andamiaje hacia una maestra de terceros (donantes/proveedores con RUT + gestores/contrapartes de lobby), con **tres piezas de lógica nueva**: (1) la regla "persona jurídica → SOLO RUT exacto, nunca LLM"; (2) el discriminador `tipo_entidad` ('natural'|'juridica') que `matchDeterministaEntidad` necesita; (3) cablear los reconciliadores que HOY dejan el FK NULL por diseño (`lobby_contraparte.contraparte_id`, `contratista.entidad_id`).

`entidad_tercero` **no existe todavía** (verificado: ningún `create table entidad_tercero` en `supabase/migrations/`; última migración aplicada = 0033). Las nuevas son 0034/0035/0036.

**Primary recommendation:** Copiar archivo-por-archivo 0005→0034, 0006→0035, 0007+0012+0015→0036 (DDL) y `deterministic.ts`/`pipeline.ts`/`prompt.ts`/`writer-supabase.ts`/`writer-revision.ts`/`revisor-cli.ts`/`backup.ts` a sus análogos `-entidad`, inyectando en cada uno el discriminador `tipo_entidad` y la rama jurídica-solo-RUT. NO inventar abstracciones nuevas: el FK branded `EnlaceConfirmado` y `backup.ts` son **parlamentario-específicos** y necesitan análogos nuevos (ver Pitfalls).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENT-01 | Maestra `entidad_tercero` + `entidad_tercero_alias` + `entidad_id_seq` + trigger anti-demotion + `vinculo_entidad`/`revision_entidad`, RLS deny-by-default, pgTAP | Molde exacto: 0005/0006/0007/0012 (firmas y columnas reportadas abajo) |
| ENT-02 | `matchDeterministaEntidad`: RUT-único o nombre-único-por-tipo; jurídica SOLO RUT; natural LLM solo homónimos; `assertNoRutInLlmInput` | Molde: `deterministic.ts` L92-139 + regla nueva jurídica; gate ya en `pipeline.ts` L152 |
| ENT-03 | `reconciliar-sujeto.ts`→`contraparte_id`; `reconciliar-contrato.ts`→`contratista.entidad_id`; RPC `resolver_entidad` | Sitios exactos del FK-NULL reportados; RPC molde 0015 |
| ENT-04 | Dudosos → `revision_entidad` `pendiente`; revisor humano vía RPC; UI admin `revisar-entidades` | Molde: cola `revision_identidad` + `revisor-cli.ts` + RPC 0015 |
| ENT-05 | Backfill LOCAL idempotente/reanudable; export JSON custodia | Molde: `seeder.ts` (idempotencia por clave natural) + `backup.ts` |
</phase_requirements>

## User Constraints (LOCKED, de CLAUDE.md + MILESTONE + ROADMAP)

### Locked Decisions
- **DDL SOLO por** `psql "$SUPABASE_DB_URL" --single-transaction` + fila en `schema_migrations`. **NUNCA** `supabase db push`. Última aplicada 0033 → nuevas 0034/0035/0036.
- **pgTAP es la ÚNICA prueba válida** para las migraciones (build/typecheck dan falso positivo; Postgres no ejecutó el DDL). Espejar los `.test.sql` existentes.
- **APLICAR a PROD = checkpoint de OPERADOR.** El plan entrega migraciones + pgTAP listas; el apply remoto es needs-human.
- **Personas jurídicas: NUNCA LLM.** Identidad solo por RUT exacto; nombre-sin-RUT de jurídica → siempre `no_confirmado` (fail-closed). LeyLobby no publica RUT de contraparte → la mayoría de gestores quedan `no_confirmado` (degradación honesta).
- **RUT NUNCA cruza al LLM** (`assertNoRutInLlmInput`, fail-closed antes de `complete()`).
- **ID estable** vía `nextval('entidad_id_seq')` (no lógica TS frágil). Custodia: export a JSON fuera de Supabase.
- **deny-by-default REAL** = RLS-on + cero policies + `revoke all from anon, authenticated` (las 3 tablas nuevas). Para `identidad_audit`/`vinculo`: además trigger de inmutabilidad + `force row level security`.
- **Backfill = LOCAL** (operador), NO CI; idempotente/reanudable.
- **Matches dudosos** pasan por cola humana `revision_entidad` (needs-human-checkpoint). El agente NO auto-confirma dudosos.

### Claude's Discretion
- Forma exacta de las columnas de `entidad_tercero` (campos mínimos: id estable, nombre normalizado, tipo_entidad, rut nullable, estado, alias, provenance).
- Estructura interna de `pipeline-entidad.ts` mientras respete las etapas 0→3 y la rama jurídica.
- UI admin: página server-side simple protegida (NO requiere UI-SPEC formal).

### Deferred Ideas (OUT OF SCOPE)
- Cosecha de RUT a la maestra de terceros (eso es RUT-01, Phase 40).
- ChileCompra/SERVEL a escala (Phase 40).
- Exponer `entidad_id`/RUT en RPCs públicos (minimización; los reconciliadores escriben el FK pero los RPC públicos jamás lo proyectan).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|------------|-------------|-----------|-----------|
| Maestra `entidad_tercero` + sequence + guardas | Database (DDL 0034/0035/0036) | — | El ID estable y la inmutabilidad viven en Postgres (no en TS frágil) |
| Matcher determinista (RUT/nombre/tipo) | TS puro (`@obs/identity`) | — | Función pura fail-closed, sin red/DB, espejo de `deterministic.ts` |
| Adjudicación LLM (solo persona natural homónima) | TS (`@obs/adjudication`) + LLM | DB (cola) | Gate RUT + sensitivity antes de `complete()`; nunca para jurídicas |
| Promoción a confirmado (dudosos) | Humano vía RPC `resolver_entidad` | DB (transacción) | needs-human-checkpoint; el RPC es atómico (UPDATE+UPSERT+audit) |
| Escritura del FK en reconciliadores | TS (`@obs/lobby`, `@obs/dinero`) | — | Hoy dejan NULL; el cambio es poblar con `EnlaceEntidadConfirmado` |
| Custodia (export JSON) | TS + filesystem (LOCAL) | R2 (gated) | Espejo de `backup.ts`; git es autoritativo |

---

## 1. Molde de la maestra (0005 → 0034) — espejo mecánico + columna `tipo_entidad` nueva

**Fuente:** `supabase/migrations/0005_parlamentario.sql` (65 líneas).

Estructura a espejar para `entidad_tercero`:
- **PK `id text`** estable. En `parlamentario` el id se deriva en TS (`S{parlid}`/`D{idDiputado}`). **LÓGICA NUEVA (LOCKED):** aquí el id viene de `nextval('entidad_id_seq')` — crear la sequence en esta migración. Sugerido: `create sequence entidad_id_seq;` y un default tipo `'E' || lpad(nextval(...)::text, 5, '0')` o resolverlo en TS leyendo `nextval`.
- `nombre_normalizado text not null` (clave de blocking; fold de acentos vía `normalizarNombre` de `@obs/core`).
- **`tipo_entidad text not null check (tipo_entidad in ('natural','juridica'))` — COLUMNA NUEVA.** Es el discriminador que gobierna la rama jurídica-solo-RUT. No existe en `parlamentario`.
- `rut text` **NULLABLE** (las contrapartes de lobby no traen RUT; los proveedores sí). Mismo patrón que `parlamentario.rut` (L30: nullable, uso interno).
- `estado text not null default 'no_confirmado' check (estado in ('confirmado','probable','no_confirmado'))` — VERBATIM de 0005 L33-34. El default `no_confirmado` es la compuerta: nada se auto-confirma por DDL.
- Provenance inline NOT NULL: `origen`, `fecha_captura timestamptz default now()`, `enlace` — VERBATIM de 0005 L38-41.
- **Claves naturales** vía índices únicos PARCIALES `where ... is not null` (espejo de 0005 L45-50): para terceros, p.ej. único parcial sobre `rut` (donde no nulo) — un RUT identifica unívocamente a una entidad.
- **`entidad_tercero_alias`** = espejo VERBATIM de `parlamentario_alias` (0005 L52-58): `id bigint generated always as identity primary key`, `entidad_tercero_id text references entidad_tercero(id) on delete cascade`, `alias text not null`, `origen text`, `unique (entidad_tercero_id, alias)`.
- **RLS deny-by-default** (0005 L63-64): `alter table entidad_tercero enable row level security;` SIN policies + (de 0023/0024 lección Phase 11) **`revoke all on entidad_tercero from anon, authenticated;`** — la maestra es PII interna, nunca public-read.

**Anti-regresión de estado (0012 → incluir en 0034 o 0036):** `parlamentario_estado_no_regresa()` (0012 L23-41) es un trigger BEFORE UPDATE que COERCIONA silenciosamente `confirmado`→cualquier-otro de vuelta a `confirmado` (NO RAISE, para no abortar el upsert masivo del backfill). Espejar como `entidad_tercero_estado_no_regresa`. `set search_path = ''`.

---

## 2. Molde de la cola + vínculo + audit (0006 → 0035) y guardas (0007)

**Fuente:** `supabase/migrations/0006_revision_identidad.sql` (108 líneas) + `0007_identidad_guardas.sql` (158 líneas).

Tres tablas a espejar:

**`vinculo_entidad`** (espejo de `vinculo_identidad`, 0006 L22-39):
- `id bigint generated always as identity primary key`
- `mencion_nombre text not null`, `mencion_normalizada text not null`
- En lugar de `camara`/`periodo` (claves de blocking de parlamentario), usar las claves de blocking de terceros — **DECISIÓN DE DISEÑO:** `tipo_entidad` + posiblemente un scope de fuente. Conservar `mencion_normalizada` como clave del upsert idempotente.
- `entidad_tercero_id text references entidad_tercero(id)` NULLABLE (no_confirmado puede no tener id).
- `estado text not null default 'no_confirmado' check (...)` — VERBATIM.
- `metodo text not null check (metodo in ('determinista','llm','humano'))` — VERBATIM.
- Provenance inline NOT NULL.
- **Índice único parcial** sobre la clave natural `where entidad_tercero_id is not null` (0006 L43-45). NOTA: 0014 lo convirtió en índice único TOTAL para que PostgREST pudiera targetear `onConflict` — replicar esa decisión (índice único total sobre la clave natural) para que `upsertVinculo` con `onConflict` funcione (ver `writer-revision.ts` L163).

**`revision_entidad`** (espejo de `revision_identidad`, 0006 L48-65):
- `id bigint generated always as identity primary key`, `vinculo_id bigint references vinculo_entidad(id)` nullable.
- `mencion_nombre`, `mencion_normalizada`, claves de blocking, `region text`.
- `candidatos jsonb not null default '[]'::jsonb` — **SIN rut (minimización aguas arriba)**.
- `salida_modelo jsonb`, `modelo_version text`.
- `estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','rechazado','corregido'))`.
- `revisor_id text`, `motivo text`, `created_at`, `resolved_at`.

**`identidad_audit` — REUSAR la tabla existente con columna nueva `tipo_entidad`.** El KEY NOTE del objetivo dice: "columna `identidad_audit.tipo_entidad`" en 0036. Es decir, NO crear `entidad_audit` separada; **añadir `tipo_entidad text` a `identidad_audit`** para que las decisiones de terceros compartan el log no-repudiable. Verificar que el CHECK de `decision` (0007 L153-157: `confirmado|no_confirmado|probable|revision|rechazado|corregido`) sigue cubriendo el vocabulario de terceros (sí lo cubre — es el mismo).

**Inmutabilidad de `identidad_audit`** ya está (0006 L85-101 trigger BEFORE UPDATE OR DELETE → RAISE + REVOKE; 0007 L125-128 trigger BEFORE TRUNCATE; 0007 L135-141 revoke a service_role). Como se reusa la tabla, **no hay que recrear estas guardas** — ya protegen las filas de terceros. (Esto es ESPEJO REUSADO, no espejo nuevo.)

**Guarda anti-demotion del vínculo (0007 L34-113 → espejo para `vinculo_entidad`):** dos triggers (`vinculo_entidad_guarda` BEFORE UPDATE + `vinculo_entidad_guarda_insert` BEFORE INSERT) que:
1. Una fila YA `confirmado` no puede degradarse ni reapuntar su `entidad_tercero_id` (L44-57).
2. Promoción A `confirmado` solo por `metodo in ('humano','determinista')` y con `entidad_tercero_id` no nulo (L62-75).
3. `force row level security` (L117) en `vinculo_entidad`.

**REGLA NUEVA EN LA GUARDA (jurídica):** El CHECK de promoción debe además, si se quiere defensa-en-DB, impedir confirmar una entidad `tipo_entidad='juridica'` por método que no sea RUT determinista. Esto es opcional en DB (el matcher TS ya lo enforce fail-closed), pero coherente con la postura "regla verdadera en el esquema aunque el writer regrese" (ver el CHECK `aporte_parlamentario_solo_confirmado` de 0024 L112-113 como precedente de esa filosofía).

---

## 3. RPC transaccional (0015 → `resolver_entidad` en 0036)

**Fuente:** `supabase/migrations/0015_resolver_identidad_rpc.sql` (108 líneas). Espejo mecánico casi total.

Firma real de `resolver_identidad` (0015 L20-30):
```
resolver_identidad(p_caso_id bigint, p_estado text, p_revisor text, p_motivo text,
  p_resolved_at timestamptz, p_promover boolean, p_vinculo jsonb, p_decision text,
  p_modelo_version text) returns bigint
language plpgsql set search_path = ''
```
Cuerpo: (1) UPDATE `revision_identidad` guardado contra `estado='pendiente'`, 0 filas → RAISE `no_data_found` → rollback total (L39-49); (2) si `p_promover`, UPSERT en `vinculo_identidad` por clave natural `on conflict (camara, periodo, mencion_normalizada)` (L52-70); (3) INSERT en `identidad_audit` metodo='humano' (L74-80). Grants: `revoke execute ... from public/anon/authenticated`, `grant execute ... to service_role` (L87-108).

**Para `resolver_entidad`:** misma estructura, cambiando `revision_identidad`→`revision_entidad`, `vinculo_identidad`→`vinculo_entidad`, la clave del `on conflict` a la clave natural de terceros, y añadiendo `p_tipo_entidad text` al INSERT del audit (para poblar la columna nueva `identidad_audit.tipo_entidad`). Conservar `set search_path = ''` con todo calificado `public.`. Conservar el bloque de grants idéntico (revoke public/anon/authenticated, grant service_role) sobre la **firma exacta** (el `revoke`/`grant` debe listar todos los tipos de parámetros, ver L88-105 — un error común es olvidar un tipo y dejar la función grantable).

Consumido desde TS por `RevisionWriter.resolverIdentidad()` (`writer-revision.ts` L182-210) vía `.rpc("resolver_identidad", {...})`. El análogo `RevisionEntidadWriter.resolverEntidad()` llamará `.rpc("resolver_entidad", {...})`.

---

## 4. `matchDeterminista` (deterministic.ts) → `matchDeterministaEntidad` — ESPEJO + LÓGICA NUEVA

**Fuente:** `packages/identity/src/deterministic.ts` L92-139. Función PURA, fail-closed, sin LLM/red/DB.

Lógica actual de confirmación (`=== 1` en cada rama, todo lo demás → `no_confirmado`):
1. **RUT exacto único** (L98-105): `mention.rut` no vacío → `normRut` → filtra maestra por `normRut(p.rut) === objetivo`; `length === 1` → `confirmado metodo='rut'`. 2+ o 0 → cae a nombre.
2. **Nombre único por (cámara, periodo)** (L108-116): filtra por `camara`+`periodo`+`nombre_normalizado`; `length === 1` → `confirmado metodo='nombre'`.
3. **Desempate por clave estricta** (homónimos, L120-132) — específico de parlamentario (materno); probablemente N/A para terceros.
4. **Fail-closed** (L135-138): homónimo (2+) o sin-candidato (0) → `no_confirmado`.

Utilidades exportadas reusables tal cual: `normRut(rut)` (L52-54), `isRutValido(rut)` DV módulo-11 (L63-78). Ambas en el barrel `index.ts` L3.

**LÓGICA NUEVA para `matchDeterministaEntidad`:**
- La maestra y la mención llevan `tipo_entidad`. El "nombre único" se calcula **por tipo** (nombre-único-por-tipo), no por cámara/periodo.
- **Rama jurídica (LOCKED):** si `tipo_entidad === 'juridica'`, SOLO la rama RUT puede confirmar. Si no hay RUT (o RUT no único) → `no_confirmado` directo, **sin siquiera intentar la rama nombre y sin nunca llegar al LLM**. Esto es el corazón de ENT-02: "nombre-sin-RUT de jurídica → siempre no_confirmado".
- **Rama natural:** RUT-único O nombre-único-por-tipo confirman determinísticamente; ambigüedad → `no_confirmado` y (en el pipeline) elegible para LLM solo si es homónimo persona-natural.
- ≥10 tests (criterio ENT-02): cubrir RUT-único confirma, RUT 2+/0 fail-closed, nombre-único-por-tipo confirma, jurídica-sin-RUT siempre no_confirmado, jurídica-con-nombre-único NO confirma (regla nueva), natural-homónimo no_confirmado.

**Tipo `Resolution` (L44-46):** discriminado `confirmado{metodo,id}` | `no_confirmado{razon}`. El método de terceros podría añadir `metodo: 'rut'|'nombre'`.

---

## 5. Pipeline de adjudicación + `assertNoRutInLlmInput` + compuerta UMBRAL

**Fuentes:** `packages/adjudication/src/pipeline.ts` (`correrPipeline`, L88-219), `prompt.ts`, `compuerta.ts`, `packages/llm/src/data-routing.ts`.

**`assertNoRutInLlmInput` vive en `packages/llm/src/data-routing.ts` L52-56** (NO en adjudication). Regex `RUT_REGEX` L46 deliberadamente amplio (fail-closed, sobre-bloquea). También exporta `assertSensitivityAllowed` (L63-72) y `assertPiiDocumentSafeForLlm` (L90-96). Reusables tal cual — NO reimplementar el regex (lección "Don't Hand-Roll" documentada en el propio archivo L86-88).

**Cómo el pipeline aplica el gate** (`pipeline.ts` L145-153):
```ts
const userPrompt = construirPromptAdjudicacion(mencion, candidatos);
assertNoRutInLlmInput(`${SYSTEM_ADJUDICACION}\n${userPrompt}`); // sobre system+user EXACTO
assertSensitivityAllowed({ sensitivity: "personal" }, provider);
```
Lanza con **0 llamadas LLM** si un RUT se cuela (criterio ENT-02: "el test falla si un RUT se cuela al prompt"). El `complete()` corre con `criticality:'critical'`, `sensitivity:'personal'`, `temperature:0` (L155-164).

**Etapas de `correrPipeline`** (a espejar en `pipeline-entidad.ts`):
- Etapa 0 DETERMINISTA (L94-119): `matchDeterminista` confirmado → `upsertVinculo` confirmado metodo='determinista' + audit, RETORNA. NO toca LLM.
- Etapa 1 BLOCKING (L121-143): 0 candidatos → no_confirmado + audit, RETORNA. NO toca LLM.
- Etapa 2 LLM (L145-164): gate RUT + sensitivity → `provider.complete(req, AdjudicacionSchema)`.
- Etapa 3 COMPUERTA (L166-218): `auto-aceptar` → `probable` metodo='llm' (NUNCA confirmado, A4); `revision` → `enqueueRevision` pendiente + audit con `vinculo_id: null`.

**Compuerta UMBRAL** (`compuerta.ts` L24): `const UMBRAL = 0.9;` comparación **ESTRICTA `<`** (confidence===0.90 PASA → auto-aceptar; 0.8999 → revisión). BUG existencial si se invierte a `>` o relaja a `<=` (L5-13). Test del borde exacto MANDATORIO. `aplicarCompuerta` acumula TODAS las razones (no corto-circuita) y solo da `auto-aceptar` con lista vacía.

**LÓGICA NUEVA para `pipeline-entidad.ts`:** ANTES de la Etapa 2, si `tipo_entidad === 'juridica'`, **saltar el LLM por completo** → `no_confirmado` directo. Una jurídica nunca alcanza `construirPromptEntidad`. El `prompt-entidad.ts` con `assertNoRutInLlmInput` solo se invoca para persona-natural homónima. El `SYSTEM_ADJUDICACION` (prompt.ts L48-58) debe reescribirse para terceros (donantes/proveedores/gestores, no parlamentarios) — el `chosen_id` regex `/^P\d{5}$/` (prompt.ts L30, AdjudicacionSchema) debe cambiar al formato del id de entidad (p.ej. `/^E\d{5}$/`).

---

## 6. Reconciliadores: dónde el FK queda NULL hoy (ENT-03)

### `packages/lobby/src/reconciliar-sujeto.ts`
- **El sujeto pasivo (el parlamentario) SÍ se reconcilia** vía `correrPipeline` → `EnlaceConfirmado` (L218-224). Eso NO cambia.
- **Las CONTRAPARTES (terceros) quedan `contraparteId: null` SIEMPRE** — `contrapartesDe()` L133-142 hardcodea `contraparteId: null`. Comentario L73-76 lo documenta como Pitfall 4. **ESTE es el sitio a cambiar (ENT-03):** correr `matchDeterministaEntidad`/`pipeline-entidad` sobre cada contraparte y poblar `contraparteId` cuando confirme. La interfaz `ContraparteParaEscribir` (L70-76) ya tiene el campo `contraparteId: string | null`.
- Tabla destino `lobby_contraparte` (0021 L64-82): columna **`contraparte_id text` nullable, default NULL** (L75), uso interno, NO es FK a parlamentario. **0036 debe formalizar el FK** `contraparte_id → entidad_tercero(id)`. Hoy no hay FK declarado.

### `packages/dinero/src/reconciliar-contrato.ts`
- **El proveedor SÍ se reconcilia contra `parlamentario`** (feature de fiscalización, RUT-exacto o nombre persona-natural, L268-391). Eso NO cambia.
- Lo que falta: **`contratista.entidad_id` no existe como columna** y nada lo escribe. `contratista` (0023 L103-114) tiene PK `rut_proveedor` pero **ninguna columna `entidad_id`**. **0036 debe añadir `entidad_id text references entidad_tercero(id)` a `contratista`** y el reconciliador debe poblarlo resolviendo el proveedor contra `entidad_tercero` (por RUT exacto para jurídicas; RUT o nombre para naturales).
- Cuidado data-routing (ya correcto, L417-444): el RUT crudo NUNCA va al LLM ni a la cola `revision_*` jsonb; viaja por canal de auditoría interno. Replicar esa disciplina para terceros.

### `donante` (0024 L132-143)
- PK `donante_id text` (id sintético), `rut_donante text NULLABLE`, `tipo_persona`. **No tiene `entidad_id`.** El objetivo de Phase 35 NO lista `donante.entidad_id` explícitamente en 0036 (solo lobby_contraparte y contratista). El cruce de donantes por sector vive en Phase 36 (CRUCE-01 añade `sector_id` a `donante`). Para Phase 35, dejar `donante` fuera salvo que el plan decida añadir `entidad_id` por consistencia (DISCRECIÓN — recomendado diferir a Phase 36 para no inflar el scope).

---

## Don't Hand-Roll

| Problema | NO construir | Usar | Por qué |
|----------|--------------|------|---------|
| Detección de RUT en prompts | Regex propio | `assertNoRutInLlmInput` (`@obs/llm`, data-routing.ts L52) | Ya fail-closed, amplio, probado; el propio archivo prohíbe reimplementar |
| Validación DV de RUT | Algoritmo módulo-11 a mano | `isRutValido` / `normRut` (`@obs/identity` L52-78) | Exportados, probados |
| Normalización de nombre (fold acentos/tokens) | `.toLowerCase().normalize()` ad-hoc | `normalizarNombre` de `@obs/core` | Usado por todos los reconciliadores (ver reconciliar-sujeto L189) |
| Resolución atómica caso→vínculo→audit | 3 llamadas PostgREST | RPC `resolver_entidad` (espejo 0015) | Sin transacción quedan huérfanos (la razón literal de 0015) |
| FK confirmado tipado | `string \| null` crudo | Análogo branded de `EnlaceConfirmado` | Un string crudo publicaría un match equivocado (ver Pitfall 1) |
| Inmutabilidad del audit | "la app nunca hace UPDATE" | Trigger + REVOKE en DB (ya existe en `identidad_audit`) | El service_role bypassa RLS; solo el trigger lo detiene (0007 L23-26) |

---

## Common Pitfalls

### Pitfall 1: `EnlaceConfirmado` es parlamentario-específico — necesita un análogo nuevo
`packages/identity/src/enlace-confirmado.ts` L36-43: el branded type tiene **`readonly parlamentarioId: string`** y `confirmar()` (L59-71) mintea `{ parlamentarioId, metodo }`. El `unique symbol` `ENLACE_CONFIRMADO` es PRIVADO al módulo y **NUNCA se exporta** (L17-22, hay un grep-gate que rechaza casts fuera de tests). **NO se puede reusar para terceros** sin renombrar el campo. **Lógica nueva:** crear `EnlaceEntidadConfirmado` con `readonly entidadTerceroId: string` + factory `confirmarEntidad()` propia, con su propio `unique symbol` privado. Los reconciliadores tiparán el FK de tercero como `EnlaceEntidadConfirmado | null`. Mantener el mismo grep-gate (no exportar el símbolo).

### Pitfall 2: `backup.ts` está tipado a `Parlamentario`, no es genérico
`packages/identity/src/backup.ts`: `exportMaestra(maestra: Parlamentario[], ...)` (L84), `SEED_PATH = "supabase/seeds/parlamentario.seed.json"` (L20), `ordenarFilas`/`withSortedKeys` operan sobre `Parlamentario`. **Lógica nueva:** un export análogo para `entidad_tercero` (nuevo `SEED_PATH` `entidad_tercero.seed.json`, ordenado por `id`, claves alfabéticas, determinista byte-a-byte para diff estable en git). Reusar el patrón (writer inyectable, R2 gated por `r2Enabled` default false), no el tipo.

### Pitfall 3: No hay `entidad_tercero` parcial preexistente
Verificado: cero `create table entidad_tercero` en migraciones. No hay deuda parcial que migrar — es greenfield para las 3 tablas. (Lo que SÍ existe y se MODIFICA: `lobby_contraparte.contraparte_id` ya está como columna nullable sin FK; `contratista`/`donante` existen sin `entidad_id`.)

### Pitfall 4: La guarda anti-regresión de estado COERCIONA, no lanza
`parlamentario_estado_no_regresa` (0012) hace `new.estado := old.estado` silencioso (NO RAISE) porque el upsert del backfill es MASIVO y un RAISE abortaría el lote. PERO `vinculo_identidad_guarda` (0007) SÍ hace RAISE (es un hecho público individual). **Espejar cada uno con su semántica correcta:** `entidad_tercero` → coerción silenciosa; `vinculo_entidad` → RAISE. Confundirlos rompe el backfill o debilita la guarda.

### Pitfall 5: El `revoke`/`grant` del RPC debe listar la firma EXACTA
0015 L88-105: cada `revoke execute`/`grant execute` repite los 9 tipos de parámetros. Si `resolver_entidad` añade `p_tipo_entidad text` (10º), TODOS los revoke/grant deben listar los 10 tipos o el grant apunta a otra sobrecarga y la función queda grantable a public. pgTAP debe verificar que anon NO puede ejecutarla.

### Pitfall 6: Idempotencia del upsert necesita índice único TOTAL, no parcial
`writer-revision.ts` L160-170 usa `.upsert(..., { onConflict: "camara,periodo,mencion_normalizada" })`. PostgREST NO puede targetear un índice PARCIAL por lista de columnas. 0006 tenía índice parcial; 0014 lo hizo TOTAL. Para `vinculo_entidad`, crear el índice único TOTAL sobre la clave natural desde el inicio (en 0035), no parcial, o `upsertVinculoEntidad` fallará. Criterio ENT-05 "2ª corrida = 0 nuevos" depende de esto.

---

## Runtime State Inventory

| Categoría | Hallado | Acción |
|-----------|---------|--------|
| Stored data | `lobby_contraparte.contraparte_id` hoy SIEMPRE NULL (poblado en 0 filas); `contratista` sin `entidad_id`; `entidad_tercero` no existe | Migración (FK + columna) + re-reconciliación (escribe FK donde confirme) — son DOS tareas distintas: code edit (escribir FK nuevo) + data backfill (poblar terceros existentes) |
| Live service config | Ninguno — todo el estado vive en Supabase + seed JSON en git. No hay n8n/Datadog/Task Scheduler para este subsistema (verificado: el subsistema de identidad es DB+TS puro) | None |
| OS-registered state | Ninguno — el backfill es un CLI LOCAL invocado por el operador (no cron, no Task Scheduler). | None |
| Secrets/env vars | `SUPABASE_DB_URL` (DDL), `SUPABASE_URL`+service key (writers), MiniMax/`MINIMAX_*` (LLM solo persona natural). Nombres sin cambios. | None (reusar los existentes) |
| Build artifacts | Nuevos archivos TS en `@obs/identity` y `@obs/adjudication` → `pnpm -r build`; nuevo seed JSON `supabase/seeds/entidad_tercero.seed.json` | `pnpm install`/build tras añadir archivos |

---

## Code Examples (firmas reales para espejar)

**Trigger de inmutabilidad reusado (NO recrear) — `identidad_audit` ya protege terceros:**
```sql
-- 0006 L85-98 + 0007 L125-141: trigger BEFORE UPDATE OR DELETE + BEFORE TRUNCATE + revoke service_role.
-- Al reusar identidad_audit (con columna nueva tipo_entidad), estas guardas YA cubren las filas de terceros.
```

**Guarda anti-demotion a espejar (RAISE para el vínculo):**
```sql
-- espejo de vinculo_identidad_guarda (0007 L34-84): si old.estado='confirmado' y new.estado<>'confirmado' -> RAISE;
-- si new.estado='confirmado' y old<>'confirmado' -> exigir metodo in ('humano','determinista') y entidad_tercero_id not null.
```

**RPC transaccional a espejar (firma):**
```sql
-- resolver_entidad(p_caso_id bigint, p_estado text, p_revisor text, p_motivo text,
--   p_resolved_at timestamptz, p_promover boolean, p_vinculo jsonb, p_decision text,
--   p_modelo_version text, p_tipo_entidad text) returns bigint
-- language plpgsql set search_path = '' ; revoke from public/anon/authenticated ; grant to service_role
```

**Gate RUT en el pipeline (reusar tal cual):**
```ts
// pipeline-entidad.ts, solo para persona natural (jurídica nunca llega aquí):
const userPrompt = construirPromptEntidad(mencion, candidatos);
assertNoRutInLlmInput(`${SYSTEM_ADJUDICACION_ENTIDAD}\n${userPrompt}`);
assertSensitivityAllowed({ sensitivity: "personal" }, provider);
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (TS, `pnpm test` / `pnpm -r test`) + pgTAP (SQL migraciones) |
| Config | `vitest` por paquete; pgTAP corre vía `psql --db-url` contra schema aplicado |
| Quick run | `pnpm --filter @obs/identity test` / `pnpm --filter @obs/adjudication test` |
| Full suite | `pnpm -r test` (TS) + correr los `.test.sql` vía pgTAP |

### Requirements → Test Map
| Req | Behavior | Test | Command | Exists? |
|-----|----------|------|---------|---------|
| ENT-01 | 3 tablas + sequence + guardas + RLS deny | pgTAP | `0034/0035/0036_*.test.sql` (espejo de 0004/0005/0006_*.test.sql) | ❌ Wave 0 |
| ENT-02 | matcher fail-closed + jurídica-solo-RUT (≥10) | unit | `pnpm --filter @obs/identity test deterministic-entidad` | ❌ Wave 0 |
| ENT-02 | RUT nunca al prompt | unit | test que pasa un RUT y espera `RutInLlmInputError` | ❌ Wave 0 |
| ENT-03 | reconciliadores escriben FK | unit | `reconciliar-sujeto`/`reconciliar-contrato` tests (espía writer) | parcial (existen tests; añadir casos FK) |
| ENT-04 | dudosos→cola, RPC promueve | unit+pgTAP | `revisor-entidad-cli` test + `resolver_entidad` pgTAP (espejo 0015_resolver_identidad.test.sql) | ❌ Wave 0 |
| ENT-05 | backfill idempotente 2ª=0; export JSON | unit | test de doble corrida (espejo seeder.test.ts) + backup-entidad test | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `supabase/migrations/0034_entidad_tercero.sql` + `supabase/tests/0034_entidad_tercero.test.sql`
- [ ] `supabase/migrations/0035_vinculo_entidad.sql` + `0035_*.test.sql`
- [ ] `supabase/migrations/0036_entidad_fk.sql` (FK + columna + RPC) + `0036_*.test.sql` (espejo de `0015_resolver_identidad.test.sql`)
- [ ] `deterministic-entidad.ts` + `.test.ts` (≥10 casos, incl. jurídica-solo-RUT)
- [ ] `pipeline-entidad.ts` / `prompt-entidad.ts` / `writer-revision-entidad.ts` / `revisor-entidad-cli.ts` + tests
- [ ] `seeder-entidad.ts` / `writer-entidad-supabase.ts` / `backfill-entidad-cli.ts` + tests
- [ ] análogo de `enlace-confirmado.ts` (`EnlaceEntidadConfirmado`) + `.test-d.ts` + grep-gate
- [ ] análogo de `backup.ts` para `entidad_tercero` + test determinismo

## Security Domain

### Applicable ASVS Categories
| Category | Applies | Control |
|----------|---------|---------|
| V4 Access Control | yes | RLS deny-by-default + `revoke all from anon,authenticated` en las 3 tablas; RPC `resolver_entidad` solo service_role |
| V5 Input Validation | yes | zod `AdjudicacionSchema` (chosen_id regex), CHECK constraints en `estado`/`tipo_entidad`/`metodo` |
| V6 Cryptography | no | sin cripto nueva |
| V8 Data Protection (PII) | yes | Ley 21.719: RUT nunca al LLM (`assertNoRutInLlmInput`); jsonb de cola sin RUT; RPCs públicos jamás proyectan `entidad_id`/RUT |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Match equivocado publicado como hecho (jurídica por nombre) | Spoofing/Tampering | Fail-closed: jurídica SOLO RUT exacto; nunca LLM; FK branded |
| service_role degrada/reapunta un vínculo confirmado | Tampering | Trigger `vinculo_entidad_guarda` RAISE (el control vinculante, no la RLS) |
| RUT filtrado a un prompt LLM | Information Disclosure | `assertNoRutInLlmInput` antes de `complete()`, 0 llamadas si detecta |
| anon lee la maestra de terceros (PII) | Info Disclosure | RLS-on + cero policies + revoke; pgTAP lo codifica |
| Borrado del audit log | Repudiation | `identidad_audit` reusado: trigger BEFORE UPDATE/DELETE/TRUNCATE + revoke (ya existe) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El id estable usa `'E'+lpad(nextval,5)` o similar; el formato exacto del prefijo es discrecional | §1 | Bajo — solo afecta el regex `chosen_id` del prompt y los seeds; ajustable |
| A2 | `donante.entidad_id` se DIFIERE a Phase 36 (objetivo solo lista lobby_contraparte+contratista en 0036) | §6 | Medio — si el plan lo necesita en 35, añadir columna; barato |
| A3 | `identidad_audit` se REUSA con columna `tipo_entidad` (no se crea `entidad_audit` separada) | §2 | Bajo — el KEY NOTE del objetivo lo dice explícito ("columna identidad_audit.tipo_entidad") |
| A4 | Las claves de blocking de `vinculo_entidad`/`revision_entidad` son `tipo_entidad`+`mencion_normalizada` (no camara/periodo) | §2 | Medio — el planner debe confirmar el scope de unicidad del upsert |

## Open Questions

1. **¿Qué clave natural usa el upsert de `vinculo_entidad`?**
   - Sabemos: parlamentario usa `(camara, periodo, mencion_normalizada)` con índice único TOTAL (0014).
   - No claro: terceros no tienen cámara/periodo. Candidato: `(tipo_entidad, mencion_normalizada)` o un scope de fuente.
   - Recomendación: el planner define la clave en 0035 y crea el índice único TOTAL (no parcial) acorde — Pitfall 6.

2. **¿La guarda en DB debe impedir confirmar jurídica por no-RUT, o basta el matcher TS?**
   - Sabemos: la filosofía del proyecto es "regla verdadera en el esquema aunque el writer regrese" (0024 L104-113).
   - Recomendación: enforce en el matcher TS (obligatorio, ENT-02) Y añadir un CHECK/guard en DB como defensa en profundidad (discrecional pero coherente).

## Sources

### Primary (HIGH — código real del repo, verificado esta sesión)
- `supabase/migrations/0005_parlamentario.sql` — maestra + alias + RLS deny (molde 0034)
- `supabase/migrations/0006_revision_identidad.sql` — vínculo + cola + audit (molde 0035)
- `supabase/migrations/0007_identidad_guardas.sql` — guardas RAISE + inmutabilidad audit
- `supabase/migrations/0012_parlamentario_estado_guarda.sql` — anti-regresión coerción silenciosa
- `supabase/migrations/0015_resolver_identidad_rpc.sql` — RPC transaccional (molde `resolver_entidad`)
- `supabase/migrations/0021_lobby.sql` L64-98 — `lobby_contraparte.contraparte_id` nullable sin FK
- `supabase/migrations/0023_dinero.sql` L103-127 — `contratista` deny-by-default sin `entidad_id`
- `supabase/migrations/0024_servel.sql` L132-156 — `donante` (referencia, fuera de scope 35)
- `packages/identity/src/deterministic.ts` L52-139 — matcher fail-closed + normRut/isRutValido
- `packages/identity/src/enlace-confirmado.ts` L27-71 — branded type parlamentario-específico
- `packages/identity/src/backup.ts` L20-113 — export JSON tipado a Parlamentario
- `packages/identity/src/writer-supabase.ts` L52-144 — upsert/promote/updateRut
- `packages/identity/src/seeder.ts` L1-66 — idempotencia por clave natural
- `packages/adjudication/src/pipeline.ts` L88-219 — etapas 0-3 + gate RUT
- `packages/adjudication/src/prompt.ts` L26-91 — AdjudicacionSchema + SYSTEM prompt
- `packages/adjudication/src/compuerta.ts` L24-40 — UMBRAL 0.9 estricto
- `packages/adjudication/src/writer-revision.ts` L127-276 — RevisionWriter + resolverIdentidad RPC
- `packages/adjudication/src/revisor-cli.ts` L1-60 — subcomandos list/show/confirm/reject/correct
- `packages/llm/src/data-routing.ts` L46-96 — assertNoRutInLlmInput + sensitivity gates
- `packages/lobby/src/reconciliar-sujeto.ts` L133-142 — contraparteId hardcodeado null
- `packages/dinero/src/reconciliar-contrato.ts` L234-451 — proveedor; sin entidad_id
- `.planning/MILESTONE-v4-cruces.md` §1.2 / `.planning/REQUIREMENTS.md` ENT-01..05 / `.planning/ROADMAP.md` Phase 35

## Metadata

**Confidence breakdown:**
- Molde DDL (0034/0035/0036): HIGH — leídas las 5 migraciones molde línea por línea
- Matcher + pipeline + gate: HIGH — código real, firmas exactas
- Sitios FK-NULL en reconciliadores: HIGH — líneas exactas identificadas
- Clave natural de `vinculo_entidad`: MEDIUM — requiere decisión del planner (Open Question 1)

**Research date:** 2026-06-23
**Valid until:** estable (código interno del repo; no depende de versiones externas)
