# Phase 35: ENT — Resolución de identidades de terceros - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 24 (3 migraciones + 3 .test.sql + 9 nuevos TS + 4 nuevos TS adjudication + 2 modificados + 1 UI)
**Analogs found:** 22 / 24 con analog directo; 2 greenfield parcial (UI admin, EnlaceEntidadConfirmado)

> **Cómo leer este mapa.** Phase 35 es **mayoritariamente ESPEJO MECÁNICO** del subsistema de identidad de `parlamentario`. Cada archivo lleva una etiqueta:
> - **[ESPEJO]** — copiar estructura del analog 1:1, renombrando `parlamentario`→`entidad_tercero`, `identidad`→`entidad`. Sin lógica nueva.
> - **[ESPEJO + Δ]** — copiar el analog E INYECTAR la(s) pieza(s) de lógica nueva marcada(s) `Δ`.
> - **[NUEVO]** — sin analog reusable; copiar solo el *patrón*, no el tipo/símbolo.
>
> Todas las referencias a línea fueron **verificadas contra el código real esta sesión** (no son del RESEARCH sin chequear).

---

## Las 3 piezas de LÓGICA NUEVA (Δ) — destiladas

Estas tres son el corazón de la fase. Todo lo demás es andamiaje espejado.

| Δ | Qué | Dónde se inyecta | Regla LOCKED |
|---|-----|------------------|--------------|
| **Δ1 — `tipo_entidad`** discriminador `'natural'\|'juridica'` | Columna nueva en la maestra + campo en la mención; gobierna toda la ramificación | `0034` (columna+CHECK), `deterministic-entidad.ts` (parámetro), `pipeline-entidad.ts`, `vinculo_entidad`/`revision_entidad` (clave de blocking), `identidad_audit.tipo_entidad` (0036) | No existe en `parlamentario` |
| **Δ2 — jurídica SOLO RUT, nunca LLM** | Si `tipo_entidad==='juridica'`: solo la rama RUT confirma; sin RUT/RUT no único → `no_confirmado` directo, sin rama nombre y **sin nunca llegar al LLM** | `matchDeterministaEntidad` (corta antes de la rama nombre) + `pipeline-entidad.ts` (salta Etapa 2 LLM completa) | LOCKED. LeyLobby no publica RUT → mayoría de gestores `no_confirmado` (degradación honesta) |
| **Δ3 — cablear el FK que hoy queda NULL** | `lobby_contraparte.contraparte_id` y `contratista.entidad_id` (nuevo) se pueblan al confirmar | `reconciliar-sujeto.ts` L133-142, `reconciliar-contrato.ts`, `0036` (FK+columna) | Hoy NULL por diseño (Pitfall 4 de lobby) |

Adicional NUEVO (no es lógica de dominio sino tipo): **`EnlaceEntidadConfirmado`** branded type propio (el de parlamentario NO es reusable — símbolo privado).

---

## File Classification

| New/Modified File | Etiqueta | Role | Data Flow | Closest Analog | Match |
|-------------------|----------|------|-----------|----------------|-------|
| `supabase/migrations/0034_entidad_tercero.sql` | [ESPEJO + Δ1] | migration (DDL maestra) | CRUD/schema | `0005_parlamentario.sql` (+ trigger de `0012`) | exact |
| `supabase/migrations/0035_vinculo_entidad.sql` | [ESPEJO + Δ1] | migration (cola+vínculo) | event-driven | `0006_revision_identidad.sql` (+ guardas `0007`) | exact |
| `supabase/migrations/0036_entidad_fk.sql` | [ESPEJO + Δ1/Δ3] | migration (FK+RPC) | request-response | `0007`+`0015_resolver_identidad_rpc.sql` | exact |
| `supabase/tests/0034_*.test.sql` | [ESPEJO] | test (pgTAP) | — | `0005_*.test.sql` | exact |
| `supabase/tests/0035_*.test.sql` | [ESPEJO] | test (pgTAP) | — | `0006_*.test.sql` | exact |
| `supabase/tests/0036_*.test.sql` | [ESPEJO] | test (pgTAP) | — | `0015_resolver_identidad.test.sql` | exact |
| `packages/identity/src/deterministic-entidad.ts` | [ESPEJO + Δ1/Δ2] | utility (matcher puro) | transform | `deterministic.ts` | exact |
| `packages/identity/src/enlace-entidad-confirmado.ts` | [NUEVO] | model (branded type) | — | `enlace-confirmado.ts` (patrón, NO el tipo) | role-match |
| `packages/identity/src/writer-entidad-supabase.ts` | [ESPEJO] | service (DB writer) | CRUD | `writer-supabase.ts` | exact |
| `packages/identity/src/seeder-entidad.ts` | [ESPEJO] | service (idempotent upsert) | batch | `seeder.ts` | exact |
| `packages/identity/src/backfill-entidad-cli.ts` | [ESPEJO] | utility (CLI LOCAL) | batch | `seeder.ts` + CLIs `run-*-cli.ts` | role-match |
| `packages/identity/src/backup-entidad.ts` (export JSON) | [NUEVO] | service (custodia) | file-I/O | `backup.ts` (patrón, NO el tipo `Parlamentario`) | role-match |
| `packages/adjudication/src/pipeline-entidad.ts` | [ESPEJO + Δ1/Δ2] | service (orquestador LLM) | event-driven | `pipeline.ts` | exact |
| `packages/adjudication/src/prompt-entidad.ts` | [ESPEJO + Δ1] | utility (prompt+schema) | transform | `prompt.ts` | exact |
| `packages/adjudication/src/writer-revision-entidad.ts` | [ESPEJO] | service (cola+RPC) | request-response | `writer-revision.ts` | exact |
| `packages/adjudication/src/revisor-entidad-cli.ts` | [ESPEJO] | utility (CLI revisor) | request-response | `revisor-cli.ts` | exact |
| `packages/lobby/src/reconciliar-sujeto.ts` | [MODIFICAR Δ3] | service (reconciliador) | transform | self (L133-142) | — |
| `packages/dinero/src/reconciliar-contrato.ts` | [MODIFICAR Δ3] | service (reconciliador) | transform | self (L234-451) | — |
| `app/app/admin/revisar-entidades/page.tsx` | [NUEVO] | component (server page) | request-response | `revisor-cli.ts` (lógica) + `app/app/*/page.tsx` (forma RSC) | partial |

> **`compuerta.ts` se REUSA tal cual** (UMBRAL 0.9 estricto) — no se crea `compuerta-entidad.ts`. La compuerta opera sobre el `Adjudicacion` schema; si `prompt-entidad.ts` reusa la misma forma de salida (`decision/chosen_id/confidence/evidence/conflicts`), `aplicarCompuerta` sirve sin cambios. El único cambio en `prompt-entidad.ts` es el regex de `chosen_id` (`/^P\d{5}$/` → `/^E\d{5}$/`).

---

## Pattern Assignments

### `0034_entidad_tercero.sql` [ESPEJO + Δ1] (migration, maestra)

**Analog:** `supabase/migrations/0005_parlamentario.sql` (65 líneas, leído completo)

**Estructura a espejar** (0005 L17-64):
- `create table entidad_tercero ( id text primary key, ... )` — espejo de L17-42.
- **Δ1 columna NUEVA:** `tipo_entidad text not null check (tipo_entidad in ('natural','juridica'))` — no existe en 0005. Es el discriminador de toda la fase.
- `nombre_normalizado text not null` (clave de blocking; fold vía `normalizarNombre` de `@obs/core`) — espejo L19.
- `rut text` **NULLABLE** — mismo patrón que `parlamentario.rut` (L30: nullable, uso interno).
- `estado text not null default 'no_confirmado' check (estado in ('confirmado','probable','no_confirmado'))` — **VERBATIM** de L33-34. El default `no_confirmado` es la compuerta DDL.
- Provenance inline NOT NULL: `origen text not null`, `fecha_captura timestamptz not null default now()`, `enlace text not null` — **VERBATIM** L38-41.
- **Claves naturales = índices únicos PARCIALES** `where ... is not null` — espejo L44-50; p.ej. único parcial sobre `rut` donde no nulo.
- **Sequence para id estable (LOCKED, decisión Claude):** `create sequence entidad_id_seq;` + id `'E' || lpad(nextval('entidad_id_seq')::text, 5, '0')` (resuelto en DDL default o en TS leyendo `nextval`). En `parlamentario` el id se derivaba en TS (`P00001`); aquí viene de la sequence.

**Tabla alias** (espejo VERBATIM de 0005 L52-58):
```sql
create table entidad_tercero_alias (
  id                bigint generated always as identity primary key,
  entidad_tercero_id text not null references entidad_tercero(id) on delete cascade,
  alias             text not null,
  origen            text,
  unique (entidad_tercero_id, alias)
);
```

**RLS deny-by-default** (0005 L60-64 + lección Phase 11):
```sql
alter table entidad_tercero enable row level security;
alter table entidad_tercero_alias enable row level security;
revoke all on entidad_tercero from anon, authenticated;          -- maestra es PII interna
revoke all on entidad_tercero_alias from anon, authenticated;
```
> NOTA: 0005 NO incluye el `revoke all` (es anterior a la lección Phase 11); pero `lobby_contraparte` (0021 L98) y `contratista` (0023 L127) SÍ. Copiar el `revoke all` de esos (sub-maestras de terceros), no la omisión de 0005.

**Δ1 Trigger anti-regresión de estado (COERCIÓN silenciosa, Pitfall 4):** espejo de `parlamentario_estado_no_regresa` (`0012_parlamentario_estado_guarda.sql` L23-41) como `entidad_tercero_estado_no_regresa`. BEFORE UPDATE que hace `new.estado := old.estado` **silencioso (NO RAISE)** cuando un `confirmado` intentaría degradarse — porque el upsert del backfill es masivo y un RAISE abortaría el lote. `set search_path = ''`.

---

### `0035_vinculo_entidad.sql` [ESPEJO + Δ1] (migration, cola+vínculo+guardas)

**Analog:** `0006_revision_identidad.sql` (108 líneas) + `0007_identidad_guardas.sql` (158 líneas)

**`vinculo_entidad`** (espejo de `vinculo_identidad`, 0006 L22-39):
- `id bigint generated always as identity primary key`, `mencion_nombre text not null`, `mencion_normalizada text not null`.
- **Δ1:** en lugar de `camara`/`periodo` (blocking de parlamentario), usar `tipo_entidad` + (decisión del planner) scope de fuente como clave de blocking. **Ver Open Question 1 abajo.**
- `entidad_tercero_id text references entidad_tercero(id)` NULLABLE.
- `estado` y `metodo text not null check (metodo in ('determinista','llm','humano'))` — **VERBATIM**.
- **Δ Pitfall 6 — índice único TOTAL (NO parcial):** la clave natural debe tener índice único **TOTAL** (no `where ... is not null`), porque PostgREST `.upsert(onConflict:...)` no puede targetear un parcial. 0006 usaba parcial; 0014 lo hizo total — **crear TOTAL desde el inicio en 0035**. De esto depende ENT-05 ("2ª corrida = 0 nuevos").

**`revision_entidad`** (espejo de `revision_identidad`, 0006 L48-65):
- `id`, `vinculo_id bigint references vinculo_entidad(id)` nullable, `mencion_nombre`, `mencion_normalizada`, claves de blocking.
- `candidatos jsonb not null default '[]'::jsonb` — **SIN rut** (minimización aguas arriba).
- `salida_modelo jsonb`, `modelo_version text`, `estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','rechazado','corregido'))`, `revisor_id`, `motivo`, `created_at`, `resolved_at`.

**`identidad_audit` — REUSAR, no recrear** (A3, KEY NOTE del objetivo): NO crear `entidad_audit`. La columna `identidad_audit.tipo_entidad text` se añade en **0036**. Las guardas de inmutabilidad de `identidad_audit` (0006 L85-101 BEFORE UPDATE/DELETE; 0007 L125-141 BEFORE TRUNCATE + revoke service_role) **ya protegen** las filas de terceros — **no recrear**.

**Δ Guarda anti-demotion del vínculo (RAISE, Pitfall 4):** espejo de `vinculo_identidad_guarda` (0007 L34-113) como dos triggers (`vinculo_entidad_guarda` BEFORE UPDATE + `vinculo_entidad_guarda_insert` BEFORE INSERT):
1. Fila YA `confirmado` no puede degradarse ni reapuntar su `entidad_tercero_id` → **RAISE** (es un hecho público individual; semántica OPUESTA a la coerción silenciosa de la maestra — no confundir).
2. Promoción A `confirmado` solo por `metodo in ('humano','determinista')` y con `entidad_tercero_id` not null.
3. `force row level security` (0007 L117).
4. **Δ2 opcional (defensa en profundidad, ver Open Question 2):** impedir confirmar `tipo_entidad='juridica'` por método que no sea RUT determinista — coherente con `aporte_parlamentario_solo_confirmado` (0024 L112-113).

---

### `0036_entidad_fk.sql` [ESPEJO + Δ1/Δ3] (migration, FK + columna + RPC)

**Analog:** `0015_resolver_identidad_rpc.sql` (108 líneas) para el RPC; `0007`/`0012` para guardas.

**Δ3 — FK y columnas que cablean los reconciliadores:**
```sql
-- formalizar el FK que hoy NO existe (lobby_contraparte.contraparte_id es text nullable sin FK, 0021 L75)
alter table lobby_contraparte
  add constraint lobby_contraparte_contraparte_id_fkey
  foreign key (contraparte_id) references entidad_tercero(id);
-- columna NUEVA en contratista (0023 L103-114 NO la tiene; PK es rut_proveedor)
alter table contratista add column entidad_id text references entidad_tercero(id);
-- Δ1 columna nueva en el audit reusado
alter table identidad_audit add column tipo_entidad text;
```
> `donante.entidad_id` se **DIFIERE a Phase 36** (A2; el objetivo solo lista lobby_contraparte+contratista). Columnas de `donante` reportadas abajo por si el planner decide adelantarlo.

**RPC `resolver_entidad`** — espejo casi total de `resolver_identidad`. Firma real verificada (0015 L20-30):
```sql
-- ANALOG (0015):
resolver_identidad(p_caso_id bigint, p_estado text, p_revisor text, p_motivo text,
  p_resolved_at timestamptz, p_promover boolean, p_vinculo jsonb, p_decision text,
  p_modelo_version text) returns bigint  language plpgsql set search_path = ''
-- NUEVO (0036) — añade p_tipo_entidad (10º param) para poblar identidad_audit.tipo_entidad:
resolver_entidad(p_caso_id bigint, p_estado text, p_revisor text, p_motivo text,
  p_resolved_at timestamptz, p_promover boolean, p_vinculo jsonb, p_decision text,
  p_modelo_version text, p_tipo_entidad text) returns bigint
```
**Cuerpo** (espejo 0015 L39-80): (1) UPDATE `revision_entidad` guardado contra `estado='pendiente'`, 0 filas → `RAISE no_data_found` (rollback total); (2) si `p_promover`, UPSERT `vinculo_entidad` `on conflict (<clave natural de terceros>)`; (3) INSERT `identidad_audit` con `metodo='humano'` + `tipo_entidad = p_tipo_entidad`.

**Δ Pitfall 5 — grants con firma EXACTA:** al añadir el 10º parámetro, **TODOS** los `revoke execute`/`grant execute` deben listar los 10 tipos (0015 L88-105 los repite por sobrecarga). Olvidar uno deja la función grantable a public:
```sql
revoke execute on function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text) from public, anon, authenticated;
grant  execute on function public.resolver_entidad(bigint,text,text,text,timestamptz,boolean,jsonb,text,text,text) to service_role;
```
pgTAP DEBE verificar que `anon` NO puede ejecutarla.

---

### `deterministic-entidad.ts` [ESPEJO + Δ1/Δ2] (utility, matcher puro)

**Analog:** `packages/identity/src/deterministic.ts` (139 líneas, leído completo). Función PURA, fail-closed, sin LLM/red/DB.

**Reusables TAL CUAL** (NO reimplementar — exportados del barrel): `normRut(rut)` (L52-54), `isRutValido(rut)` DV módulo-11 (L63-78).

**Rama RUT a espejar** (L98-105): RUT exacto → `normRut` → filtra maestra, `length===1` → `confirmado metodo:'rut'`. 2+/0 → cae.

**Δ2 — LÓGICA NUEVA (la pieza crítica de ENT-02):**
```ts
// firma sugerida (espeja matchDeterminista(mention, maestra) L92):
export function matchDeterministaEntidad(
  mention: { rut?: string; nombreNormalizado: string; tipoEntidad: "natural" | "juridica" },
  maestra: EntidadTerceroRow[],
): ResolutionEntidad
```
1. **Rama jurídica (LOCKED):** si `tipoEntidad === 'juridica'` → intentar SOLO la rama RUT. Sin RUT o RUT no único → `no_confirmado` **directo**, sin intentar la rama nombre y sin nunca habilitar el LLM aguas arriba.
2. **Rama natural:** RUT-único O **nombre-único-por-tipo** confirman. El "nombre único" se calcula **por `tipo_entidad`** (Δ1), no por cámara/periodo. El desempate por clave estricta/materno (0005 L120-132) es **N/A para terceros** — omitir.
3. **Fail-closed** (espejo L135-138): homónimo (2+) o sin candidato (0) → `no_confirmado`.

**Tipo `Resolution`** (espejo L44-46): `{ estado:'confirmado'; metodo:'rut'|'nombre'; id }` | `{ estado:'no_confirmado'; razon }`.

**Tests ≥10 (criterio ENT-02):** RUT-único confirma; RUT 2+/0 fail-closed; nombre-único-por-tipo confirma; **jurídica-sin-RUT siempre no_confirmado**; **jurídica-con-nombre-único NO confirma** (Δ2, regla nueva); natural-homónimo no_confirmado.

---

### `enlace-entidad-confirmado.ts` [NUEVO] (model, branded type)

**Analog:** `enlace-confirmado.ts` (71 líneas, leído completo) — **patrón, NO el tipo** (Pitfall 1).

**Por qué NUEVO y no reuso:** `EnlaceConfirmado` tiene `readonly parlamentarioId: string` (L38) y su `unique symbol ENLACE_CONFIRMADO` (L27) es **PRIVADO al módulo, NUNCA exportado** (grep-gate lo rechaza fuera de tests). No se puede reusar para terceros sin renombrar el campo.

**Construir** `EnlaceEntidadConfirmado` espejando L27-71, cambiando:
```ts
declare const ENLACE_ENTIDAD_CONFIRMADO: unique symbol;   // NUEVO símbolo privado propio
export interface EnlaceEntidadConfirmado {
  readonly entidadTerceroId: string;                       // antes: parlamentarioId
  readonly metodo: "determinista" | "humano";
  readonly [ENLACE_ENTIDAD_CONFIRMADO]: true;
}
export function confirmarEntidad(                          // antes: confirmar()
  entidadTerceroId: string,
  metodo: "determinista" | "humano" = "determinista",
): EnlaceEntidadConfirmado { /* misma construcción branded que L69-70 */ }
```
**Mantener el mismo grep-gate** (no exportar el símbolo; `confirmarEntidad(` no debe aparecer en writers/parsers).

---

### `pipeline-entidad.ts` [ESPEJO + Δ1/Δ2] (service, orquestador LLM)

**Analog:** `packages/adjudication/src/pipeline.ts` (`correrPipeline`, L88-219, leído completo).

**Etapas a espejar:**
- **Etapa 0 DETERMINISTA** (L94-119): `matchDeterministaEntidad` confirmado → `upsertVinculo` `metodo:'determinista'` + `appendAudit`, RETORNA. NO toca LLM.
- **Δ2 — NUEVA, antes de Etapa 1/2:** si `tipoEntidad === 'juridica'` → `no_confirmado` directo + audit, RETORNA. **Una jurídica NUNCA alcanza `construirPromptEntidad` ni el LLM.**
- **Etapa 1 BLOCKING** (L121-143): 0 candidatos → no_confirmado + audit (`metodo:'determinista'`, NO 'llm' — L124-125), RETORNA.
- **Etapa 2 LLM** (L145-164) — solo persona natural homónima:
```ts
const userPrompt = construirPromptEntidad(mencion, candidatos);
assertNoRutInLlmInput(`${SYSTEM_ADJUDICACION_ENTIDAD}\n${userPrompt}`);  // sobre system+user EXACTO
assertSensitivityAllowed({ sensitivity: "personal" }, provider);
const llm = await provider.complete({ system, user: userPrompt,
  criticality: "critical", sensitivity: "personal", temperature: 0 }, AdjudicacionEntidadSchema);
```
- **Etapa 3 COMPUERTA** (L166-218): `aplicarCompuerta` (REUSAR `compuerta.ts`). `auto-aceptar` → `probable metodo:'llm'` (NUNCA confirmado, A4); `revision` → `enqueueRevision` pendiente + audit con `vinculo_id: null` (L209).

---

### `prompt-entidad.ts` [ESPEJO + Δ1] (utility, prompt + schema zod)

**Analog:** `prompt.ts` (L26-91, leído completo).

- **Δ1 schema:** copiar `AdjudicacionSchema` (L26-39) cambiando **solo** `chosen_id` regex `/^P\d{5}$/` (L31) → `/^E\d{5}$/` (formato id de entidad, A1). Mantener `decision/confidence/evidence/conflicts` idénticos → **`aplicarCompuerta` sirve sin cambios**.
- **Reescribir `SYSTEM_ADJUDICACION`** (L48-58) para terceros: donantes/proveedores/gestores de lobby (personas naturales homónimas), no parlamentarios. Mantener las reglas anti-causalidad/anti-invención.
- `construirPromptEntidad` espeja `construirPromptAdjudicacion` (L66-91) — **SIN RUT** en el user (el gate lo enforce, pero el prompt no debe contenerlo por construcción).

---

### `writer-revision-entidad.ts` [ESPEJO] (service, cola + RPC)

**Analog:** `writer-revision.ts` (L127-276, `RevisionWriter`).

- `upsertVinculoEntidad` espeja `upsertVinculo` (L160-170): `.upsert([v], { onConflict: "<clave natural de terceros>" })` — la clave debe coincidir con el índice único TOTAL de 0035 (Pitfall 6).
- `resolverEntidad` espeja `resolverIdentidad` (L182-210): llama `.rpc("resolver_entidad", { p_caso_id, p_estado, p_revisor, p_motivo, p_resolved_at, p_promover, p_vinculo, p_decision, p_modelo_version, p_tipo_entidad })` — **añadir `p_tipo_entidad`** al objeto del RPC.

---

### `revisor-entidad-cli.ts` [ESPEJO] (utility, CLI revisor humano)

**Analog:** `revisor-cli.ts` (L1-60). Subcomandos `list/show/confirm/reject/correct` sobre `revision_entidad` vía `RevisionEntidadWriter.resolverEntidad()`. La promoción humana mintea `confirmarEntidad(..., "humano")`.

---

### `seeder-entidad.ts` / `writer-entidad-supabase.ts` / `backfill-entidad-cli.ts` [ESPEJO] (services, backfill)

**Analogs:** `seeder.ts` (L1-66, idempotencia por clave natural), `writer-supabase.ts` (L52-144, upsert/promote/updateRut).
- Idempotencia por clave natural → ENT-05 "2ª corrida = 0 nuevos".
- `backfill-entidad-cli.ts`: CLI **LOCAL** (operador, NO CI), idempotente/reanudable. Reusar env vars existentes (`SUPABASE_URL` + service key). Patrón de loadEnv: ver `run-agenda-prod-cli.ts` (try/catch + fallback `process.env`).

---

### `backup-entidad.ts` [NUEVO] (service, custodia JSON)

**Analog:** `backup.ts` (Pitfall 2) — **patrón, NO el tipo**. `exportMaestra(maestra: Parlamentario[], ...)` (L84) y `SEED_PATH = "supabase/seeds/parlamentario.seed.json"` (L20) están tipados a `Parlamentario`. Crear export análogo para `entidad_tercero`: nuevo `SEED_PATH = "supabase/seeds/entidad_tercero.seed.json"`, ordenado por `id`, claves alfabéticas, **determinista byte-a-byte** (diff estable en git). Reusar el patrón (writer inyectable, R2 gated por `r2Enabled` default false), no el tipo.

---

### `reconciliar-sujeto.ts` [MODIFICAR Δ3] (lobby)

**Sitio exacto (verificado):** `contrapartesDe()` L133-142 hardcodea `contraparteId: null` en cada contraparte. La interfaz `ContraparteParaEscribir` (L70-76) ya tiene `contraparteId: string | null` (L75) — **nota: es `string | null` crudo, NO `EnlaceEntidadConfirmado | null`**; el sujeto pasivo SÍ usa el branded `enlace: EnlaceConfirmado | null` (L86). El cambio Δ3: correr `matchDeterministaEntidad`/`pipeline-entidad` sobre cada contraparte y poblar `contraparteId` (idealmente re-tipar a `EnlaceEntidadConfirmado | null`) cuando confirme. **El sujeto pasivo (parlamentario) NO cambia.**

---

### `reconciliar-contrato.ts` [MODIFICAR Δ3] (dinero)

**Estado actual:** el proveedor SÍ se reconcilia contra `parlamentario` (fiscalización, L268-391) — **NO cambia**. Falta: `contratista.entidad_id` no existe (0023 L103-114, PK `rut_proveedor`, sin `entidad_id`). Δ3: **0036 añade la columna** y el reconciliador la puebla resolviendo el proveedor contra `entidad_tercero` (RUT exacto para jurídicas; RUT o nombre para naturales). Preservar la disciplina de data-routing existente (L417-444): el RUT crudo viaja por canal de auditoría interno, NUNCA al LLM ni al jsonb de `revision_*`.

---

### `app/app/admin/revisar-entidades/page.tsx` [NUEVO] (component, server page protegida)

**Analog:** NO existe `app/app/admin/` (verificado — greenfield). Dos referencias parciales:
- **Lógica/contrato:** `revisor-cli.ts` (subcomandos list/show/confirm/reject/correct → la página es su equivalente web sobre `revision_entidad`).
- **Forma RSC:** las páginas server existentes `app/app/parlamentario/[id]/page.tsx`, `app/app/red/page.tsx` (Server Components, lectura vía RPC). Para una página **protegida server-side** sin analog admin directo: página server simple que (1) chequea autorización server-side, (2) lista `revision_entidad` `pendiente` vía service-role, (3) resuelve vía RPC `resolver_entidad`. **No requiere UI-SPEC formal** (discreción Claude, KEY NOTE objetivo). El gate humano LOCKED: ningún dudoso se auto-confirma.

---

## Shared Patterns

### Gate RUT al LLM (REUSAR, no reimplementar)
**Source:** `packages/llm/src/data-routing.ts` L46-56, `assertNoRutInLlmInput` (regex `RUT_REGEX` L46, deliberadamente amplio/fail-closed).
**Apply to:** `pipeline-entidad.ts` (Etapa 2, solo persona natural). También `assertSensitivityAllowed` (L63-72), `assertPiiDocumentSafeForLlm` (L90-96).
```ts
assertNoRutInLlmInput(`${SYSTEM_ADJUDICACION_ENTIDAD}\n${userPrompt}`); // 0 llamadas LLM si un RUT se cuela
```
> El archivo prohíbe explícitamente reimplementar el regex (lección "Don't Hand-Roll" L86-88).

### Normalización de nombre
**Source:** `normalizarNombre` de `@obs/core` (usado por `reconciliar-sujeto.ts` L189).
**Apply to:** `nombre_normalizado` de la maestra, `mencion_normalizada` de los vínculos, la clave de blocking.

### RLS deny-by-default + revoke (las 3 tablas nuevas)
**Source:** `lobby_contraparte` (0021 L90-98), `contratista` (0023 L119-127) — sub-maestras de terceros con la lección Phase 11.
**Apply to:** `entidad_tercero`, `entidad_tercero_alias`, `vinculo_entidad`, `revision_entidad`.
```sql
alter table <t> enable row level security;   -- SIN policies
revoke all on <t> from anon, authenticated;  -- cierra el hueco de default privileges
```

### Inmutabilidad del audit (YA existe — reusar `identidad_audit`)
**Source:** trigger BEFORE UPDATE/DELETE (0006 L85-101) + BEFORE TRUNCATE + revoke service_role (0007 L125-141).
**Apply to:** ninguna acción — al reusar `identidad_audit` (con columna `tipo_entidad`), estas guardas YA cubren las filas de terceros. **No recrear.**

### Resolución atómica caso→vínculo→audit
**Source:** RPC `resolver_identidad` (0015) — la razón literal de su existencia es evitar huérfanos sin transacción.
**Apply to:** `resolver_entidad` (0036), consumido por `writer-revision-entidad.ts`.

### Compuerta UMBRAL (REUSAR `compuerta.ts`)
**Source:** `compuerta.ts` L24 `const UMBRAL = 0.9;` comparación **ESTRICTA `<`** (confidence===0.90 PASA; 0.8999 → revisión, L44).
**Apply to:** `pipeline-entidad.ts` Etapa 3. Test del borde exacto MANDATORIO. BUG existencial si se invierte a `>` o relaja a `<=`.

---

## Columnas de las tablas TARGET (reportadas para el planner)

**`lobby_contraparte`** (0021 L64-82) — MODIFICAR (FK):
| Columna | Tipo | Nota |
|---------|------|------|
| `id` | bigint identity PK | |
| `identificador` | text not null FK→lobby_audiencia | |
| `nombre` | text not null | crudo del tercero |
| `rol` | text not null default '' | |
| `representado_text` | text | nullable |
| **`contraparte_id`** | **text nullable, default NULL** | **HOY sin FK; 0036 añade FK→entidad_tercero(id)** |
| `origen`/`fecha_captura`/`enlace` | provenance NOT NULL | |
| unique | `(identificador, nombre, rol)` | clave natural |

**`contratista`** (0023 L103-114) — MODIFICAR (columna nueva):
| Columna | Tipo | Nota |
|---------|------|------|
| `rut_proveedor` | text PRIMARY KEY | DV-validado por el writer |
| `nombre` | text | interno, nunca público |
| `tipo_persona` | text | `'natural'\|'juridica'` ← alimenta `tipo_entidad` |
| `codigo_empresa` | text | |
| `origen`/`fecha_captura`/`enlace` | provenance NOT NULL | |
| `licencia` | text default 'mencion de la fuente' | |
| **`entidad_id`** | **NO EXISTE** | **0036 añade `text references entidad_tercero(id)`** |

**`donante`** (0024 L132-143) — REFERENCIA (fuera de scope 35, A2; diferir a Phase 36):
| Columna | Tipo | Nota |
|---------|------|------|
| `donante_id` | text PRIMARY KEY | id sintético (writer lo deriva de nombre+tipo) |
| `rut_donante` | text NULLABLE | SERVEL no lo trae hoy |
| `nombre` | text | interno |
| `tipo_persona` | text | `'natural'\|'juridica'` |
| `origen`/`fecha_captura`/`enlace` | provenance NOT NULL | |
| `licencia` | text default 'terminos por verificar' | |
| **`entidad_id`** | **NO EXISTE** | diferido a Phase 36 (CRUCE-01 añade `sector_id` ahí) |

---

## Firmas exactas (verificadas, para espejar)

```ts
// matcher analog (deterministic.ts L92):
matchDeterminista(mention: Mention, maestra: MaestraRow[]): Resolution
//   Resolution = { estado:'confirmado'; metodo:'rut'|'nombre'|'nombre-estricto'; id } | { estado:'no_confirmado'; razon:'homonimo'|'sin-candidato' }
//   utilidades reusables: normRut(rut: string): string ; isRutValido(rut: string): boolean

// pipeline analog (pipeline.ts L88):
correrPipeline(mencion: MencionForanea, maestra: Parlamentario[], provider: LLMProvider, writer: PipelineWriter): Promise<ResultadoPipeline>

// gate (data-routing.ts L52):
assertNoRutInLlmInput(text: string): void   // lanza RutInLlmInputError, 0 llamadas LLM

// writer RPC analog (writer-revision.ts L182):
resolverIdentidad(params: { casoId, estado, revisor, motivo, resolvedAt, promover, vinculo, decision, modeloVersion }): Promise<number|null>
//   → .rpc("resolver_identidad", { p_caso_id, p_estado, p_revisor, p_motivo, p_resolved_at, p_promover, p_vinculo, p_decision, p_modelo_version })

// branded type analog (enlace-confirmado.ts L36/L59):
interface EnlaceConfirmado { readonly parlamentarioId: string; readonly metodo: "determinista"|"humano"; readonly [ENLACE_CONFIRMADO]: true }
confirmar(parlamentarioId: string, metodo?: "determinista"|"humano"): EnlaceConfirmado

// schema analog (prompt.ts L26): chosen_id regex /^P\d{5}$/  → cambiar a /^E\d{5}$/
```

```sql
-- RPC analog (0015 L20):
resolver_identidad(p_caso_id bigint, p_estado text, p_revisor text, p_motivo text,
  p_resolved_at timestamptz, p_promover boolean, p_vinculo jsonb, p_decision text,
  p_modelo_version text) returns bigint  -- language plpgsql set search_path=''
```

---

## No Analog Found / Partial

| File | Role | Por qué | Qué usar |
|------|------|---------|----------|
| `app/app/admin/revisar-entidades/page.tsx` | server page admin | No existe `app/app/admin/` | Lógica de `revisor-cli.ts` + forma RSC de `app/app/*/page.tsx`; página server protegida simple |
| `enlace-entidad-confirmado.ts` | branded type | `EnlaceConfirmado` es parlamentario-específico (símbolo privado, campo `parlamentarioId`) | Copiar el PATRÓN de `enlace-confirmado.ts`, símbolo y campo nuevos |
| `backup-entidad.ts` | custodia JSON | `backup.ts` tipado a `Parlamentario[]` | Copiar el PATRÓN, nuevo `SEED_PATH`, tipo `EntidadTercero` |

---

## Open Questions (decisión del planner)

1. **Clave natural del upsert de `vinculo_entidad`** (A4, MEDIUM). Parlamentario usa `(camara, periodo, mencion_normalizada)` con índice único TOTAL (0014). Terceros no tienen cámara/periodo → candidato `(tipo_entidad, mencion_normalizada)` o `(tipo_entidad, mencion_normalizada, scope_fuente)`. **El planner define la clave en 0035 y crea el índice único TOTAL** (no parcial, Pitfall 6). Esta clave debe coincidir byte a byte con el `onConflict` de `writer-revision-entidad.ts` y el `on conflict` del RPC.

2. **¿Guarda en DB para jurídica-no-RUT (Δ2 en el esquema)?** El matcher TS lo enforce (obligatorio, ENT-02). Defensa en profundidad: añadir CHECK/guard en `vinculo_entidad_guarda` que impida confirmar `tipo_entidad='juridica'` por método ≠ RUT. Coherente con la filosofía "regla verdadera en el esquema aunque el writer regrese" (0024 L104-113). Discrecional pero recomendado.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/`, `packages/{identity,adjudication,lobby,dinero,llm,core}/src/`, `app/app/`
**Files read (verificados línea a línea):** 0005, 0021 (L60-98), 0023 (L100-127), 0024 (L130-156), `deterministic.ts`, `enlace-confirmado.ts`, `reconciliar-sujeto.ts` (L60-149), `pipeline.ts` (L88-219), `data-routing.ts` (L44-96), `writer-revision.ts` (L155-214), `prompt.ts` (L26-91), `compuerta.ts` (L1-45)
**Pattern extraction date:** 2026-06-23
