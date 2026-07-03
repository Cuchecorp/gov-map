# Phase 52: CRUCE2 — Cruces nuevos con datos ya disponibles (P3) - Research

**Researched:** 2026-07-03
**Domain:** Codebase-internal (clasificador @obs/cruces + RPC PII-safe Postgres + Next.js RSC + lockdown doctrine)
**Confidence:** HIGH (todo verificado contra código y contra PROD por psql read-only; cero dependencia web)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Corrida del clasificador (SC1)**
- Contrapartes: priorizar las que aparecen en audiencias con `estado_vinculo='confirmado'` (las únicas que generan señal en `materializar_cruces`); correr `clasificar-lobby-cli` en lotes con `--limite` hasta cubrirlas (MiniMax free 45k/sem alcanza). Dry-run primero.
- `proyecto_ficha`: clasificar TODAS las fichas con `clasificar-fichas-cli` (DeepSeek, bulk barato).
- Golden gate LIVE (`CRUCES_GOLDEN_LIVE=1`, cobertura ≥0.7 sobre muestra 10, errores=0) ANTES de la corrida masiva. Al final: `select cruces.materializar_cruces();` por psql + verificación con conteos (señales >>30, distinct parlamentarios/sectores).
- El AGENTE ejecuta la corrida localmente (CLIs vía `node scripts/run-with-env.mjs`, keys de `.env`; escritura de DATOS no-DDL — patrón de corridas LIVE previas lobby/NET/agenda), con conteos before/after en SUMMARY.

**Lobby×tramitación temporal (SC2)**
- Criterio: audiencias de lobby en la MISMA SEMANA ISO en que el boletín fue citado en comisión (`citacion.semana_iso` + `citacion_punto.boletin` × `lobby_audiencia.fecha`) — ventana estrecha y defendible. NO la ventana completa de tramitación.
- Superficie: carril propio `mt-12` en la ficha de PROYECTO. SIN flag nuevo: yuxtaposición de hechos fechados. Negative-match causal obligatorio.
- RPC nueva `lobby_en_tramitacion(p_boletin text)`: SECURITY DEFINER set search_path='', emite SOLO campos públicos, doble revoke + CERO grant (idiom 0047), entra a `PUBLIC_RPC_ALLOWLIST`, pgTAP acompañante. Apply = checkpoint operador. La UI degrada honesta pre-apply.
- Copy: caveat 1×/sección ("coincidencia temporal; no implica relación") + fuente por fila.

**Proyecto→agenda inverso + home (SC3, SC4)**
- SC3: query directa `.from("citacion_punto")` × `citacion` por boletín (tablas no-PII permitidas por el guard) — SIN RPC nueva. Línea del bloque "¿Dónde está hoy?" (F51) cuando hay citación vigente/futura.
- SC4 home: 3 bloques compactos server-rendered bajo el hero — "Votado esta semana", "Urgencias vigentes" (REUSA derivación F51), "Última actualización de datos" (max `fecha_captura` por fuente). Cero JS cliente nuevo, cero carrusel.
- Queries del home: directas `.from()` sobre tablas no-PII con límites acotados + React.cache — cero RPC nueva.
- Home rendering: `export const dynamic = "force-dynamic"`.

**Seguridad, verificación y doctrina (SC5)**
- Migración nueva = 0048, doble revoke sin grant, pgTAP, allowlist actualizada. Apply a PROD = checkpoint operador ACUMULABLE con 0047.
- Escrituras de datos del clasificador permitidas al agente (no-DDL): `sector_id` + rebuild `cruce_senal` vía `materializar_cruces()`. Idempotente.
- NINGÚN flag `*_PUBLIC_ENABLED` se flipea (doctrina LOCKED).
- Verificación SC1: psql read-only contra PROD, pegada en SUMMARY.

### Claude's Discretion
- Microcopy exacto (banned-vocab), layout de los bloques del home, tamaño de lotes del clasificador, orden interno de tareas.
- Forma exacta del retorno de `lobby_en_tramitacion` (columnas/orden) siempre que sea PII-safe y traiga provenance.

### Deferred Ideas (OUT OF SCOPE)
- F47 comparativos de votos y F49 asistencia comparada (fases propias).
- Votación×sector (habilitado por la corrida, superficie es fase futura).
- Tiempos de tramitación por etapa y panorama de urgencias como página propia.
- Lobby×tramitación en la ficha de PARLAMENTARIO (dirección inversa).
- Buscador global unificado.
</user_constraints>

<phase_requirements>
## Phase Requirements

Extiende la familia CRUCE-01..03 de v4 (no hay IDs REQ-XX nuevos formales; los SC del CONTEXT son el contrato).

| SC | Descripción | Research Support |
|----|-------------|------------------|
| SC1 | Clasificador sectorial corrido LIVE (golden gate) sobre contrapartes confirmadas + `proyecto_ficha` → `cruce_senal` re-materializado >>30 señales | §Corrida del clasificador — universo cuantificado (5.062 confirmadas sin sector; 74 fichas); **gap del CLI documentado** |
| SC2 | RPC `lobby_en_tramitacion` + carril en ficha proyecto (semana ISO, cero causal) | §RPC lobby_en_tramitacion — idiom 0047, join shapes, semana ISO |
| SC3 | proyecto→agenda inverso vía `citacion_punto` (sin RPC) | §SC3 estado-actual — extensión de EstadoActualBlock |
| SC4 | módulo actualidad home (3 bloques, force-dynamic) | §Home data — shapes de votacion, fecha_captura por tabla no-PII |
| SC5 | suite/tsc/lockdown verdes; 0048 doble-revoke + pgTAP + allowlist | §Seguridad y pgTAP — 0047 como espejo exacto |
</phase_requirements>

## Summary

Esta fase NO requiere investigación externa: todo el material vive en el código y en PROD, ambos inspeccionados directamente. El hallazgo dominante para el planner es que **la Decisión "priorizar confirmadas, correr en lotes con `--limite` hasta cubrirlas" NO es ejecutable con `clasificar-lobby-cli` tal como está escrito** — `cargarContrapartes` hace un `.from("lobby_contraparte").select(...).limit(limite)` plano: sin filtro a audiencias confirmadas, sin `where sector_id is null`, y **sin offset/paginación**. Consecuencias medidas contra PROD: (a) de las 17.681 contrapartes totales solo **5.094 distintas aparecen en audiencias confirmadas** (las únicas que `materializar_cruces()` cuenta), así que clasificar la tabla entera desperdicia ~71% del gasto MiniMax en filas que jamás generan señal; (b) re-correr con `--limite` mayor NO avanza — cada corrida re-lee desde el tope (los primeros N), de modo que "lotes" no es incremental. **El planner debe incluir una tarea de código que añada al CLI un modo `--solo-confirmadas` (join a `lobby_audiencia` confirmada) + `where sector_id is null`** para que la corrida sea acotada, incremental y de alto-ROI. Sin ese cambio, la única alternativa es `--limite 17681` (17k llamadas MiniMax críticas, ~horas de latencia serial).

Las otras tres superficies son de bajo riesgo y reúso puro: la RPC `lobby_en_tramitacion` (0048) es un espejo mecánico del idiom 0047 (security definer + `search_path=''` + doble revoke + cero grant + allowlist + pgTAP); el bloque SC3 extiende `derivarEstadoActual` con una query `citacion_punto × citacion` sobre tablas no-PII permitidas por el guard; el módulo home son 3 Server Components con `.from()` directo sobre tablas no-PII y `force-dynamic`. La `votacion` ya trae `resultado/total_si/total_no/...` y `conteoVotacion(si,no)` existe en `app/lib/format.ts:96`.

**Primary recommendation:** Añadir al `clasificar-lobby-cli` un filtro de carga `--solo-confirmadas` + `sector_id is null` (tarea de código, con tests), correr golden LIVE → dry-run acotado → corrida LIVE sobre las ~5.062 confirmadas-sin-sector → `materializar_cruces()`; en paralelo espejar 0047 → 0048 para `lobby_en_tramitacion`; extender EstadoActualBlock y el home con lecturas directas no-PII. Migración 0048 = checkpoint operador acumulable con 0047.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Clasificación de sector (LLM) | CLI local Node (@obs/cruces) | Postgres (writer service-role) | Ruta sensible MiniMax + RUT-gate; escritura no-DDL a `sector_id`. El agente la corre localmente (patrón lobby/NET/agenda). |
| Materialización `cruce_senal` | Postgres (`cruces.materializar_cruces()`) | — | FULL REBUILD transaccional server-side; PII table, deny-by-default. |
| Lectura lobby×tramitación | API/Postgres (RPC `lobby_en_tramitacion`) | Frontend RSC (consumo) | `lobby_contraparte`/`parlamentario` son deny-by-default/PII → SOLO vía security-definer RPC allowlisted. |
| Cruce proyecto→agenda (SC3) | Frontend RSC (`.from()` directo) | — | `citacion`/`citacion_punto` son públicas no-PII (0010) → lectura directa permitida por el guard, sin RPC. |
| Módulo actualidad home (SC4) | Frontend RSC (`.from()` directo) | — | `votacion`/`proyecto`/`citacion`/`tramitacion_evento` son no-PII → lectura directa; `force-dynamic`. |
| ACL / deny-by-default | Postgres (0048 doble revoke) + CI guard | pgTAP post-apply | Doctrina Camino A: anon cero grants; el sitio lee con service_role. |

## Standard Stack

Sin dependencias nuevas. Todo el stack ya está en `CLAUDE.md` y en el repo.

### Core (reúso, verificado en repo)
| Asset | Ubicación | Propósito |
|-------|-----------|-----------|
| `clasificar-lobby-cli` | `packages/cruces/src/clasificar-lobby-cli.ts` | Batch etiquetado sector de contrapartes (MiniMax, ruta crítica + RUT-gate) |
| `clasificar-fichas-cli` | `packages/cruces/src/clasificar-fichas-cli.ts` | Batch etiquetado sector de fichas (DeepSeek, bulk) |
| `clasificar.ts` | `packages/cruces/src/clasificar.ts:79` | `clasificarContraparte` corre `assertNoRutInLlmInput` PRIMERO (load-bearing) |
| `SupabaseCrucesWriter` | `packages/cruces/src/writer-supabase.ts` | UPDATE idempotente de `sector_id` (etapa-2 pura, service-role) |
| `cruces.materializar_cruces()` | migración 0039 | FULL REBUILD `cruce_senal` desde audiencias confirmadas con `sector_id` no-null |
| Golden gate | `packages/cruces/src/golden/golden-set.ts:35` (`COBERTURA_MIN=0.7`) | Gate LIVE por `CRUCES_GOLDEN_LIVE==="1"` |
| `run-with-env.mjs` | `scripts/run-with-env.mjs` | Wrapper BOM-safe: carga `.env` → `process.env` → spawn (shell en win32) |
| `EstadoActualBlock` + `urgenciaVigente` | `app/components/estado-actual-block.tsx:43` | Derivación reusable (SC3 citación line + SC4 urgencias) |
| `conteoVotacion(si,no)` | `app/lib/format.ts:96` | Tally en-dash Mono para "Votado esta semana" |
| `fechaCorta`/`relativeTimeEs` | `app/lib/format.ts` | Fechas Mono |

**Installation:** ninguna. Zero new dependency (confirmado por UI-SPEC §Registry Safety).

## Package Legitimacy Audit

No aplica — esta fase NO instala paquetes externos. Todo es reúso de assets ya en el repo (`@obs/cruces`, `@obs/llm`, `@supabase/supabase-js`, componentes `app/`). slopcheck no requerido.

## Architecture Patterns

### System Data Flow (SC1 — corrida del clasificador)

```
                    ┌─────────────── golden LIVE gate (CRUCES_GOLDEN_LIVE=1) ───────────────┐
                    │  cobertura ≥0.7 sobre muestra 10 · errores=0 · testTimeout 120s        │
                    └──────────────────────────────┬───────────────────────────────────────┘
                                                    │ PASA
                                                    ▼
 lobby_contraparte ─(SELECT filtrado)→ clasificar-lobby-cli ─(MiniMax, RUT-gate 1º)→ sector_codigo
   [FILTRO REQUERIDO:                        │                                            │
    join aud. confirmada +                   │ writer service-role (no-DDL)               │
    sector_id is null]                       ▼                                            │
                              lobby_contraparte.sector_id  ◄────────────────────────────┘
                                                    │
 proyecto_ficha ─(SELECT)→ clasificar-fichas-cli ─(DeepSeek bulk)→ proyecto_ficha.sector_id
                                                    │
                                                    ▼
                            psql: select cruces.materializar_cruces();   (FULL REBUILD)
                                                    │
                                                    ▼
                            cruce_senal  (>>30 señales)  ── verificación psql read-only ──► SUMMARY
```

### Pattern 1: Corrida LIVE de datos por el agente (idéntica a 36-04)
**What:** golden LIVE gate → dry-run acotado → corrida LIVE (`--service-key` real) → `materializar_cruces()` por psql → verificación read-only.
**Verificado en:** `36-04-SUMMARY.md` (la corrida original: 60 contrapartes → 34 con sector → 24 parls → 30 señales).
**Comando exacto (36-04 lo hizo así; reproducir):**
```bash
# tsx es devDep de @obs/cruces (NO está en el root). Correr vía el filtro del workspace:
node scripts/run-with-env.mjs pnpm --filter @obs/cruces exec tsx src/clasificar-lobby-cli.ts --limite N --service-key "$SUPABASE_SECRET_KEY" [--dry-run]
node scripts/run-with-env.mjs pnpm --filter @obs/cruces exec tsx src/clasificar-fichas-cli.ts --limite 74 --service-key "$SUPABASE_SECRET_KEY" [--dry-run]
# materializar (psql directo, NUNCA supabase db push):
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -c "select cruces.materializar_cruces();"
```
`[CITED: packages/cruces/package.json — devDeps incluyen tsx; scripts NO exponen bin]`. `[VERIFIED: 36-04-SUMMARY.md]` para el patrón golden→LIVE→materializar→verify.

### Pattern 2: RPC pública nueva PII-safe (idiom 0047, espejo exacto)
**What:** `create or replace function ... returns table(...) language sql stable security definer set search_path = ''` + `revoke all/execute ... from public` + `revoke all/execute ... from anon, authenticated` + **CERO grant** + entrada en `PUBLIC_RPC_ALLOWLIST` (mismo commit) + pgTAP acompañante.
**Verificado en:** `supabase/migrations/0047_rebeldias_honestas.sql` + `supabase/tests/0047_rebeldias_honestas.test.sql`.
**Nota load-bearing:** el drop+recreate re-concede EXECUTE por DEFAULT PRIVILEGES según el rol de aplicación → el doble revoke lo hace determinista. Como `lobby_en_tramitacion` es función NUEVA (no cambia returns table de una existente), NO necesita `drop function` previo — basta `create or replace` + doble revoke.

### Pattern 3: Degrade honesto pre-apply (RPC ausente)
**What:** distinguir PGRST202 / "function does not exist" (→ render null, path 1) de cualquier otro error DB/red (→ throw #34, path 3). Ver §Common Pitfalls.

### Anti-Patterns to Avoid
- **Clasificar la tabla `lobby_contraparte` completa** sin filtrar a confirmadas: ~71% del gasto MiniMax es señal-cero. Verificado: solo 5.094/17.681 distintas están en audiencias confirmadas.
- **Re-correr `--limite` esperando avance incremental:** el CLI re-lee desde el tope (sin offset/`sector_id is null`) → re-clasifica las mismas filas.
- **`.from("cruce_senal")` / `.from("lobby_contraparte")` / `.from("parlamentario")` desde `app/`:** son PII_TABLES; el guard CI falla. Leer solo vía RPC allowlisted; verificar `cruce_senal` por psql, no `.from()`.
- **`supabase db push`** para aplicar 0048: drift de `schema_migrations`. Usar `psql --db-url --single-transaction`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Etiquetado de sector | Prompt/router nuevo | `clasificarContraparte`/`clasificarFicha` (routing + RUT-gate ya construidos) | El orden de gates es load-bearing (RUT primero, luego sensibilidad) |
| UPDATE de `sector_id` | Cliente Supabase ad-hoc | `SupabaseCrucesWriter` (dedupe + chunk + service-role) | Idempotente, no interpola la key en errores |
| Rebuild de señal | INSERT manual | `cruces.materializar_cruces()` por psql | FULL REBUILD transaccional; refleja estado completo |
| Semana ISO en SQL | Cálculo manual de semanas | `to_char(fecha, 'IYYY"-W"IW')` de Postgres | Formato "YYYY-Www" idéntico a `citacion.semana_iso` |
| Derivación de urgencia vigente (home) | Reescribir la lógica presenta/retira | `urgenciaVigente(eventos)` exportada de estado-actual-block | Ya testeada; misma semántica en ficha y home |
| Tally de votación | Formateo manual | `conteoVotacion(si,no)` | En-dash Mono, banned-vocab-safe |

**Key insight:** cada pieza de esta fase ya existe; el trabajo NUEVO real es (1) un filtro de carga en el CLI, (2) una RPC espejo de 0047, (3) tres Server Components de lectura. Cero lógica de dominio nueva.

## Runtime State Inventory

Esta fase **puebla datos** (no renombra), pero mueve estado en PROD que un grep no ve. Inventario:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `lobby_contraparte.sector_id` (34/17.681 poblados hoy; 5.062 confirmadas-sin-sector); `proyecto_ficha.sector_id` (0/74 poblados); `cruce_senal` (30 filas hoy) | Corrida LIVE del clasificador (data write no-DDL) + `materializar_cruces()`. **Idempotente.** |
| Live service config | Cron `cruces-materializar` (`23 3 * * *`) ya registrado (0039) — re-materializa a diario. Tras poblar sector_id, la señal crece sola en la próxima corrida del cron también. | Ninguna — el cron ya existe; la corrida manual adelanta el rebuild. |
| OS-registered state | Ninguno — no hay Task Scheduler/pm2 tocado por esta fase. | None — verificado (fase de datos + UI, sin registro OS). |
| Secrets/env vars | `MINIMAX_API_KEY`, `DEEPSEEK_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `SUPABASE_URL` — todos PRESENTES en `.env` (nombres confirmados, valores no impresos). | None — sin renombre de keys. |
| Build artifacts | Migración 0048 NO aplicada hasta el checkpoint operador → el build de Next lee la RPC ausente. El HTML "horneado" pre-apply debe degradar (render null). | `force-dynamic` en home + degrade honesto path-1 en el carril lobby. |

**Verificación PROD (read-only, 2026-07-03):**
```
contrapartes_total                          17681
contrapartes_con_sector                        34
distinct_contrapartes_en_aud_confirmada      5094   ← universo de alto-ROI
distinct_contrapartes_confirmada_sin_sector  5062   ← lo pendiente por clasificar
cruce_senal_filas                              30
proyecto_ficha_total                           74
proyecto_ficha_con_sector                       0   ← clasificar todas (DeepSeek bulk)
```

## Common Pitfalls

### Pitfall 1: El CLI de lobby no filtra a confirmadas ni es incremental (BLOQUEANTE de SC1)
**What goes wrong:** correr `clasificar-lobby-cli --limite N` clasifica las PRIMERAS N filas de `lobby_contraparte` en orden arbitrario, sin importar si aparecen en una audiencia confirmada ni si ya tienen `sector_id`.
**Why it happens:** `cargarContrapartes` (`clasificar-lobby-cli.ts:88-91`) = `.from("lobby_contraparte").select("identificador, nombre, rol").limit(limite)`. Sin `where sector_id is null`, sin join a `lobby_audiencia`, sin `.range()`/offset.
**Impact medido:** solo 5.094/17.681 distintas están en audiencias confirmadas → clasificar el resto (~12.6k) es señal-cero. Re-correr con `--limite` mayor re-procesa (y re-paga) las mismas filas del tope.
**How to avoid:** **tarea de código** — añadir al CLI un modo (p.ej. `--solo-confirmadas`) que cargue vía un join/RPC `lobby_audiencia (estado_vinculo='confirmado' and parlamentario_id is not null)` ⨝ `lobby_contraparte (sector_id is null)`, distinct por contraparte. Cubre las ~5.062 pendientes en corridas acotadas y resumibles. Alternativa sin código: `--limite 17681` (17k llamadas MiniMax, ~horas serial, ~37% del cupo semanal free) — no recomendada.
**Warning signs:** el conteo `cruce_senal` no sube tras una corrida "grande"; muchas contrapartes clasificadas no aparecen en `materializar_cruces()`.

### Pitfall 2: Semana ISO — desalineación por timezone
**What goes wrong:** `to_char(a.fecha, 'IYYY"-W"IW')` sobre un `timestamptz` usa el timezone de la sesión; si difiere de cómo el conector TS derivó `citacion.semana_iso`, las audiencias cerca del límite de semana (dom/lun) caen en la semana equivocada → coincidencias perdidas o espurias.
**How to avoid:** normalizar explícitamente: `to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW')` para igualar la convención local con que se pobló `citacion.semana_iso`. Documentar el supuesto en la cabecera de 0048. `[ASSUMED]` que el conector usó hora local de Chile — confirmar contra un par (fecha, semana_iso) real en `citacion` durante el plan.
**Warning signs:** una audiencia con fecha de domingo aparece/desaparece de la semana esperada.

### Pitfall 3: RPC ausente pre-apply se traga como error (rompe degrade honesto)
**What goes wrong:** un blanket-catch trata PGRST202 igual que un error de red → o bien 500 o bien banda vacía fabricada.
**Why it happens:** supabase-js v2 devuelve `{ error }` con `error.code === 'PGRST202'` (function not found in schema cache) o mensaje "Could not find the function ... in the schema cache" / "function ... does not exist".
**How to avoid:** en `LobbyEnTramitacionSection`, comprobar `error?.code === 'PGRST202'` (o match del mensaje function-missing) → **return null** (path 1). Cualquier otro `error` → **throw** (path 3, #34). Nunca un catch genérico. Espejo del gate-OFF de MONEY/cruces.
**Warning signs:** el carril muestra "sin coincidencias" en un build donde la RPC no existe (debería estar ausente del HTML).

### Pitfall 4: `.from()` sobre tabla PII dispara el guard CI
**What goes wrong:** leer `fecha_captura` para el bloque home "Última actualización" desde una tabla PII (`donante`, `aporte`, `contrato`, `declaracion*`, `cruce_senal`, `parlamentario`) → `lockdown-guard.test.ts` falla.
**How to avoid:** el bloque 3 del home SOLO puede leer `fecha_captura` de tablas NO-PII: `votacion`, `proyecto`, `proyecto_ficha`, `tramitacion_evento`, `citacion`, `sesion_sala`, `lobby_audiencia` (public-read). Muchas tablas con `fecha_captura` (aporte/contrato/declaracion/donante) son PII → excluidas. Elegir un set no-PII para "fuentes".
**Warning signs:** guard (B) reporta `... -> <tabla_pii>`.

### Pitfall 5: Apply de 0048 por `supabase db push`
**What goes wrong:** drift de `schema_migrations`; falso positivo de CI (tsc/vitest no prueban Postgres).
**How to avoid:** aplicar por `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f supabase/migrations/0048_*.sql` + fila manual en `supabase_migrations.schema_migrations`, y correr el pgTAP `psql -tA -f` contra el schema aplicado. Es checkpoint operador, acumulable con 0047.

## Code Examples

### RPC `lobby_en_tramitacion` — esbozo (espejo idiom 0040/0047, PII-safe)
```sql
-- 0048_lobby_en_tramitacion.sql  (migración NUEVA — create or replace, sin drop)
-- Ancla: la MISMA semana ISO en que una comisión vio el boletín. Yuxtaposición pura.
-- PII-safe: lee parlamentario (deny-by-default) INTERNAMENTE vía security definer,
-- pero emite SOLO nombre + cámara públicos (espejo parlamentario_publico 0020/0026).
create or replace function public.lobby_en_tramitacion(p_boletin text)
returns table (
  parlamentario_nombre text,   -- nombre público del sujeto pasivo confirmado
  camara               text,   -- 'diputados' | 'senadores' (no-PII)
  materia              text,   -- materia pública de la audiencia
  fecha_reunion        timestamptz,
  semana_iso           text,   -- semana coincidente ("YYYY-Www")
  comision             text,   -- comisión que citó el boletín esa semana
  enlace_detalle       text    -- provenance por fila (link "Ver Detalle")
)
language sql stable security definer set search_path = '' as $$
  select
    p.nombre_normalizado,           -- SOLO nombre público (NUNCA rut/partido/email)
    p.camara,
    a.materia,
    a.fecha,
    c.semana_iso,
    c.comision,
    a.enlace_detalle
  from public.citacion c
  join public.citacion_punto cp on cp.citacion_id = c.id
  join public.lobby_audiencia a
    on to_char((a.fecha at time zone 'America/Santiago'), 'IYYY"-W"IW') = c.semana_iso
  join public.parlamentario p on p.id = a.parlamentario_id
  where cp.boletin = p_boletin
    and a.estado_vinculo = 'confirmado'
    and a.parlamentario_id is not null
  order by a.fecha desc nulls last;
$$;

-- ACL determinista (idiom 0047): CERO grant. El sitio lee con service_role (bypassa ACL);
-- anon quedó a cero grants desde 0044. El guard CI bloquea cualquier grant a anon/public.
revoke all on function public.lobby_en_tramitacion(text) from public;
revoke all on function public.lobby_en_tramitacion(text) from anon, authenticated;
```
`[CITED: 0040_cruces_rpc.sql, 0047_rebeldias_honestas.sql, 0020/0026 parlamentario_publico]`. La forma exacta del returns table es Claude's Discretion (CONTEXT); el emitido arriba es PII-safe y con provenance.

### pgTAP 0048 (espejo 0047_*.test.sql)
```sql
-- 0048_lobby_en_tramitacion.test.sql — corre por psql -tA -f contra el schema APLICADO.
-- NO vive en el glob de vitest (.test.ts). Idiom: array_to_string(proargnames,',') posicional.
select plan(N);
select has_function('public','lobby_en_tramitacion', array['text'], '...');
select is( (select array_to_string(proargnames,',') from pg_proc p join pg_namespace n
            on n.oid=p.pronamespace where n.nspname='public' and p.proname='lobby_en_tramitacion'),
           'p_boletin,parlamentario_nombre,camara,materia,fecha_reunion,semana_iso,comision,enlace_detalle',
           'returns table en orden posicional pineado');
select is( (select prosecdef ...), true, 'security definer');
select ok( (select array_to_string(proconfig,',') ...) like '%search_path=%', 'search_path fijado');
select ok( not has_function_privilege('anon','public.lobby_en_tramitacion(text)','execute'),
           'anon NO tiene EXECUTE (Camino A deny)');
-- fixture mínimo (citacion + citacion_punto + lobby_audiencia + parlamentario en la misma
-- semana ISO) → assert de que la coincidencia por semana devuelve la fila esperada.
select * from finish();
```

### Extensión de EstadoActualBlock (SC3)
```ts
// Añadir a EstadoActual: citacionVigente?: { comision: string; fecha: Date }
// Dentro de EstadoActualBlock, en el Promise.all, sumar la query (tablas no-PII, guard OK):
sb.from("citacion_punto")
  .select("citacion:citacion(comision, fecha, semana_iso)")
  .eq("boletin", boletin);
// derivar la citación futura/vigente más cercana (citacion.fecha >= hoy); omitir si none.
// Un error real de lectura → throw (#34); ausencia → línea omitida (mirror omit-when-not-derivable).
```

### Home block "Última actualización" — solo tablas no-PII
```ts
// max(fecha_captura) por fuente, SOLO no-PII (votacion/proyecto/tramitacion_evento/citacion/
// lobby_audiencia/proyecto_ficha). NUNCA aporte/contrato/declaracion*/donante (PII → guard falla).
sb.from("votacion").select("fecha_captura").order("fecha_captura",{ascending:false}).limit(1);
// force-dynamic en app/app/page.tsx; React.cache para deduplicar; .limit() acotado por bloque.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cruces gated tras sign-off legal (Candado A+B) | Cruces sector ya LIVE (0042 + Candado B aplicados) | v4 (2026-06-24) | Esta fase solo puebla datos; NINGÚN flag se flipea |
| Sitio lee con anon/web_reader | Sitio lee con service_role (Camino A); anon REST muerta (401/42501) | 2026-06-26 | PII protegida por guard CI, no por RLS anon; `.from()` PII prohibido en `app/` |
| RPC podía conceder a anon | Camino A: anon cero grants; doble revoke sin grant en toda migración >0044 | 0044+ | 0048 debe ser cero-grant; la exención F51 se revirtió |

**Deprecated/outdated:** `crucesPublicEnabled()` (Candado B) — ya aplicado LIVE; no se toca. `supabase db push` — prohibido (drift).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `citacion.semana_iso` fue derivado con hora local de Chile (America/Santiago) | Pitfall 2 / RPC | Off-by-one en semanas límite → coincidencias perdidas/espurias. Confirmar contra un par (fecha, semana_iso) real en el plan. |
| A2 | supabase-js v2 devuelve `error.code === 'PGRST202'` para función ausente | Pitfall 3 | Degrade honesto path-1 no dispara → 500 pre-apply. Mitigar matcheando también el texto "does not exist"/"schema cache". |
| A3 | `p.nombre_normalizado` es el nombre público correcto a emitir (como parlamentario_publico) | Code example RPC | Emitir columna equivocada. Verificar la proyección exacta de `parlamentario_publico` (0020/0026) al escribir 0048. |
| A4 | La corrida MiniMax de ~5.062 filas cabe en el cupo free (45k/sem) y termina en latencia aceptable serial | SC1 | Si la latencia es prohibitiva (~horas), lotear por sesión o subir concurrencia controlada (respetando rate-limit del provider). |

## Open Questions

1. **¿El CLI se modifica o se corre en bruto?**
   - Lo que sabemos: sin filtro, 71% del gasto es señal-cero y no es incremental.
   - Recomendación: modificar el CLI (tarea de código con tests) — es la opción de alto-ROI y resumible. El planner debe decidir la superficie del flag (`--solo-confirmadas` + `sector_id is null`) vs. una query SQL out-of-band que alimente `--filas`.

2. **Nombre público exacto del parlamentario en la RPC.**
   - Lo que sabemos: `parlamentario` es PII; `parlamentario_publico`/`parlamentarios_publico` (0020/0026) ya definen la proyección PII-safe.
   - Recomendación: copiar la lista de columnas públicas de esos RPCs; emitir solo nombre + cámara.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql | Apply 0048 + materializar + verificación | ✓ | PostgreSQL 17.9 | — |
| MINIMAX_API_KEY | clasificar-lobby-cli (ruta crítica) | ✓ (nombre en `.env`) | — | dry-run degrada sin key (aviso explícito) |
| DEEPSEEK_API_KEY | clasificar-fichas-cli | ✓ | — | dry-run degrada |
| SUPABASE_SECRET_KEY | writer service-role + `createServerSupabase` | ✓ | — | — |
| SUPABASE_DB_URL | psql apply/verify | ✓ (109 chars) | — | — |
| SUPABASE_URL / SUPABASE_API_URL | createClient en CLIs | ✓ (ambos presentes) | — | — |
| tsx | correr los CLIs `.ts` | ✓ (devDep de `@obs/cruces`, NO en root) | — | correr vía `pnpm --filter @obs/cruces exec tsx` |
| pnpm | monorepo runner | ✓ (workspace) | — | — |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** `tsx` no está en el root → invocar por el filtro del workspace (`pnpm --filter @obs/cruces exec tsx src/...`), envuelto en `run-with-env.mjs`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (config en `app/vitest.config.ts`; @obs/cruces tiene su propio `vitest run`) |
| Config file | `app/vitest.config.ts` (guard CI + page tests); `packages/cruces` — `vitest run` |
| Quick run command | `pnpm --filter <pkg> test` |
| Full suite command | `pnpm test` (root) — baseline 497 verde post-F51 |
| tsc | `tsc -b` limpio (usar `references`, no `paths` — GOTCHA phase-43) |

### Phase Requirements → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | CLI carga solo confirmadas-sin-sector | unit | `pnpm --filter @obs/cruces test` | ❌ Wave 0 (nuevo test para el filtro) |
| SC1 | golden gate ≥0.7 | live/manual | `CRUCES_GOLDEN_LIVE=1 ... --testTimeout=120000` | ✅ (golden-set.ts) |
| SC1 | `cruce_senal` >>30 | verificación psql | `psql ... -c "select count(*) from cruce_senal"` | manual (SUMMARY) |
| SC2 | RPC returns table posicional + deny + PII-safe | pgTAP | `psql -tA -f supabase/tests/0048_*.test.sql` (post-apply) | ❌ Wave 0 |
| SC2 | carril degrada null si RPC ausente (PGRST202) | unit RTL | `pnpm --filter app test` | ❌ Wave 0 |
| SC3 | línea citación se omite si no derivable | unit | `pnpm --filter app test` (derivarEstadoActual) | ✅ extender existente |
| SC4 | 3 bloques home degradan independiente | unit RTL | `pnpm --filter app test` | ❌ Wave 0 |
| SC5 | allowlist incluye lobby_en_tramitacion; sin grant anon >0044 | unit | `pnpm --filter app test lockdown-guard` | ✅ (actualizar Set) |

### Sampling Rate
- **Per task commit:** `pnpm --filter <pkg afectado> test`
- **Per wave merge:** `pnpm test` (root, 497 baseline) + `tsc -b`
- **Phase gate:** suite verde + lockdown-guard verde antes de `/gsd:verify-work`. pgTAP 0048 = post-apply operador (fuera del glob vitest).

### Wave 0 Gaps
- [ ] Test unit del nuevo filtro `--solo-confirmadas` en `clasificar-lobby-cli` (carga inyectada + assert de query/filas).
- [ ] `supabase/tests/0048_lobby_en_tramitacion.test.sql` — pgTAP (5 asserts de contrato + fixture de coincidencia por semana).
- [ ] RTL para `LobbyEnTramitacionSection` — 3 paths del degrade (null / sin-coincidencias / throw).
- [ ] RTL para `ActualidadModule` + 3 sub-bloques (empty states independientes).
- [ ] Actualizar `PUBLIC_RPC_ALLOWLIST` (Set en `lockdown-guard.test.ts:165`) con `lobby_en_tramitacion`.
- [ ] Extender el test de `derivarEstadoActual` para la línea de citación.

## Security Domain

`security_enforcement` no está en `false` → incluido.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Sitio público read-only; sin login en superficie de fase |
| V3 Session Management | no | Sin sesión de usuario |
| V4 Access Control | **yes** | Deny-by-default: `cruce_senal`/`lobby_contraparte`/`parlamentario` PII → SOLO vía RPC security-definer allowlisted; anon cero grants (Camino A); guard CI estático + pgTAP post-apply |
| V5 Input Validation | **yes** | `p_boletin` parametrizado por supabase-js `.eq`/RPC arg; `BOLETIN_RE` valida el path; `assertNoRutInLlmInput` sobre el payload al LLM |
| V6 Cryptography | no | Sin cripto nueva; keys en `.env`, nunca interpoladas en logs/errores |
| V7 Data Protection (PII) | **yes** | Ley 21.719: RPC emite solo nombre/cámara públicos; nunca rut/partido/email; LLM nunca recibe RUT (gate primero) |

### Known Threat Patterns for este stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RPC nueva re-abre superficie a anon por DEFAULT PRIVILEGES | Elevation of Privilege | Doble revoke `from public` + `from anon, authenticated`; pgTAP `not has_function_privilege('anon',...)` |
| `.from()` PII directo en `app/` (service_role bypassa RLS) | Information Disclosure | Guard CI (B) escanea `app/` por `.from('<pii>')`; leer vía RPC o verificar por psql |
| RUT de contraparte filtrado al LLM | Information Disclosure | `assertNoRutInLlmInput` PRIMERO en `clasificarContraparte` (0 llamadas si hay RUT) |
| Insinuación causal lobby↔tramitación | Repudiation/Tampering (integridad narrativa) | Caveat obligatorio 1×/sección; carril mt-12 propio, nunca compuesto con voto; banned-vocab negative-match |
| SQL injection vía boletín | Tampering | `BOLETIN_RE` + arg parametrizado; `search_path=''` en la RPC |

## Sources

### Primary (HIGH confidence)
- `packages/cruces/src/clasificar-lobby-cli.ts` / `clasificar-fichas-cli.ts` / `clasificar.ts` / `writer-supabase.ts` — CLIs, carga, gates, writer (leídos completos)
- `supabase/migrations/0039_cruce_senal.sql`, `0040_cruces_rpc.sql`, `0047_rebeldias_honestas.sql`, `0021_lobby.sql`, `0010_agenda.sql`, `0020` — schemas + idiom RPC
- `supabase/tests/0047_rebeldias_honestas.test.sql` — plantilla pgTAP
- `app/components/estado-actual-block.tsx`, `app/app/proyecto/[boletin]/page.tsx`, `app/app/page.tsx` — superficies de integración
- `app/lib/lockdown-guard.test.ts` — PII_TABLES + PUBLIC_RPC_ALLOWLIST + reglas de grant
- `.planning/phases/36-.../36-04-SUMMARY.md` — patrón de corrida LIVE verbatim
- **PROD (psql read-only, 2026-07-03):** conteos de contrapartes/sector/cruce_senal/proyecto_ficha; columnas de `votacion`; tablas con `fecha_captura`
- Env: `.env` (nombres de keys confirmados, valores no leídos); `psql --version` = 17.9

### Secondary (MEDIUM confidence)
- Ninguna — sin búsqueda web (fase codebase-first).

### Tertiary (LOW confidence)
- Ninguna.

## Metadata

**Confidence breakdown:**
- Corrida del clasificador (SC1): HIGH — CLIs leídos completos + universo cuantificado contra PROD. El gap del filtro es un hecho de código, no una hipótesis.
- RPC lobby_en_tramitacion (SC2): HIGH — idiom 0047/0040 verificado; único ASSUMED es la convención de timezone de semana_iso (A1) y el nombre exacto de columna pública (A3).
- Home + SC3 (SC4/SC3): HIGH — shapes de tabla y helpers verificados; force-dynamic es patrón conocido (F50).
- Seguridad/pgTAP (SC5): HIGH — guard y doble-revoke verificados en código + 36-04.

**Research date:** 2026-07-03
**Valid until:** 2026-08-02 (estable; los conteos PROD cambian con cada corrida del cron pero el orden de magnitud y el gap del CLI persisten hasta que se modifique el código)
