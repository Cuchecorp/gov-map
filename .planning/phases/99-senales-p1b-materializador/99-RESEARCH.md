# Phase 99: SEÑALES P1b — Materializador `actualidad_senal` + RPCs bounded + cron intradía - Research

**Researched:** 2026-07-24
**Domain:** Postgres materialización full-rebuild + bounded RPCs security-definer + k-means determinista sobre embeddings 768d + scheduler intradía (pg_cron SQL / GH Actions TS)
**Confidence:** HIGH (todos los patrones a espejar leídos en código vivo del repo; cero net-new de librería)

## Summary

Phase 99 no inventa nada — **espeja al pie de la letra tres patrones ya en producción** y aplica los defectos de datos que el SPIKE (Phase 98) cerró como contrato. Los patrones son: (1) `cruce_senal` + `cruces.materializar_cruces()` (migración `0039`) para la tabla precomputada deny-by-default + proc full-rebuild transaccional invocado por pg_cron; (2) las 9 RPCs bounded de `0064` para las RPCs de lectura del panel (security-definer, `set search_path=''`, `set statement_timeout='5s'`, `LIMIT`, doble-revoke, alta en `PUBLIC_RPC_ALLOWLIST`); (3) `leyes-weekly.yml` + `run-tramitacion-prod-cli.ts` para el CLI/YAML de refresh intradía L-V (clonado SIN R2, sin rate-limit, porque NO toca fuentes).

El único cómputo que sale del molde 0039 SQL-puro es el **clustering k-means** sobre `proyecto_embedding.embedding vector(768)` (migración `0011`, ya existe con índice HNSW cosine). La recomendación es hacerlo en **TS en el CLI** (`@obs/actualidad`, corrido por el nuevo GH Actions), no en SQL puro, porque el label del cluster = `mode()` de `proyecto.materia` es trivial en TS y el proyecto ya tiene el molde CLI→service_role. El proc SQL de pg_cron escribe todas las señales temporales (velocity/urgencias/agenda/archivados/nuevos-ingresos); el CLI escribe la capa `cluster_id` sobre las MISMAS filas — se componen sin race porque cada uno escribe columnas/tipos_señal distintos y el CLI corre DESPUÉS del proc (o el CLW hace su propio full-rebuild del tipo_señal `agrupacion_materia`).

**Primary recommendation:** Migración `0065_actualidad_senal.sql` = tabla + proc `actualidad.materializar_senales()` (espejo 0039, aplica los 3 defectos LOCKED) + pg_cron intradía; migración `0066_actualidad_rpc.sql` = 1-2 RPCs bounded (espejo 0064) + alta en allowlist; CLI TS `@obs/actualidad` para k-means seed-fija (k=10, label=`mode(materia)`); pgTAP `0065_actualidad_senal.test.sql` espejo `0039_cruce_senal.test.sql`. NO flipea ningún flag de régimen.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cómputo de señales temporales (velocity, urgencias, agenda, archivados, nuevos-ingresos) | Database (proc SQL `security definer`) | pg_cron scheduler | 100% SQL sobre datos ya en Supabase; espejo exacto `cruces.materializar_cruces()`/0039 |
| Clustering k-means + label factual | GH Actions CLI (TS, `@obs/actualidad`) | Database (escribe filas `tipo_senal='agrupacion_materia'`) | Lógica de centroides/asignación se expresa mejor en TS; label = `mode(materia)` en TS; corre offline sin `statement_timeout` |
| Lectura del panel | Database (RPC bounded security-definer) | Frontend (Phase 100, server-only service_role) | La landing lee filas ya materializadas → RPC trivialmente < 5s; espejo 0064 |
| Scheduling | pg_cron (proc SQL) + GH Actions cron (CLI TS) | — | Precedente dual: 0039 usa pg_cron; leyes-weekly usa GH Actions |
| Supresión por frescura | Database (columna en la fila, no ausencia) | Frontend (declara la causa) | Ausencia ≠ hecho: la supresión es una FILA con `supresion_causa`, no una fila faltante |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Señales a materializar (98-SPIKE §1 — contrato):** SOLO las HONESTAS, cada una con su guarda de supresión:
- **velocity** (HONESTA): "N trámites en 7 días", nunca "top/los más".
- **nuevos ingresos** (HONESTA-CONDICIONAL): vía primer-evento por boletín, EXCLUIR primer-evento pre-2022, declarar cobertura "2022-2026"; JAMÁS derivar de `fecha_captura`.
- **urgencias vivas** (HONESTA): evento de urgencia FECHADO, nunca "urgencia vigente" ni juicio.
- **agenda próxima** (HONESTA): `citacion` filas futuras reales; `sesion_sala` sin futuras → SUPRIMIR. Reusar lógica tz Chile de `/agenda` (date-only UTC = día chileno — jamás convertir tz).
- **archivados/retirados** (HONESTA-CON-CAVEAT): filtrar por `descripcion` fechada, NO por `proyecto.estado`; distinguir "Desarchivo"/"retira y hace presente" (invierten sentido).
- **agrupación por materia** (SEN-05): `proyecto.materia` (text, taxonomía oficial) = label PRIMARIO; k-means seed-fija sobre embeddings = capa SECUNDARIA. Labels JAMÁS LLM.

**Defectos de datos LOCKED (aplicar en TODA agregación):**
1. Filtrar `fecha <= current_date` en TODO max(fecha)/ventana (mata 2 filas `fecha='2626-05-25'`).
2. Normalizar `camara` por regex `regexp_replace(camara,'\s+','','g')` antes de agrupar.
3. `camara IS NULL` (2.261 filas) → "(sin cámara)" o excluido de cortes por cámara; NUNCA repartido.

**Regla del reloj + supresión:** ancla a `tramitacion_evento.fecha`, nunca `fecha_captura`. Supresión por frescura = fila con causa, jamás "sin movimiento". PROHIBIDO ranking cross-cámara por conteo (T-52-13).

**Arquitectura:** `actualidad_senal` = TABLA precomputada (NO matview). Proc full-rebuild espejo `materializar_cruces()`/0039. SQL puro → pg_cron; clustering TS → CLI GH Actions intradía L-V (clona leyes-weekly SIN R2, NO toca fuentes → sin rate-limit). RPCs = aguja completa >0064 (cero-grant + security-definer PII-safe + `PUBLIC_RPC_ALLOWLIST` + `LIMIT` + `statement_timeout 5s`). Migraciones por `PGCLIENTENCODING=UTF8 psql --single-transaction -f` (NUNCA `db push`). pgTAP espejo `0039_cruce_senal.test.sql`.

### Claude's Discretion

Nº de migración exacto, esquema fino de columnas, k de k-means (research recomienda 8-15), nombre del CLI/YAML, forma exacta de las RPCs. **Preferir espejar 0039/0064 al pie de la letra.**

### Deferred Ideas (OUT OF SCOPE)

- Landing panel / BentoGrid / benchmark BrowserOS → Phase 100.
- Ingesta leyes publicadas (conector Cámara dos-etapas) → SEN-06 futuro.
- Similitud de voto → Phase 102.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEN-02 | Señales en tabla precomputada (`actualidad_senal`, espejo `cruce_senal`/0039) refrescada offline; landing lee vía RPC bounded PII-safe allowlisted | §Standard Stack (0039 tabla+proc), §Code Examples (DDL + proc), §Pattern RPC bounded (0064), §Cron split |
| SEN-03 | Toda señal se suprime (con causa) cuando su fuente está stale; sesgo Cámara/Senado declarado por señal | §Suppression-as-row pattern, columnas `supresion_causa`+`cobertura_camara`+`fecha_max`, §Pitfalls P1/P2 |
| SEN-04 | Señales factuales mínimas (velocity, nuevos-ingresos, urgencias, agenda, archivados) | §Cómputo por señal en SQL (cada una con su guarda) |
| SEN-05 | Agrupación por materia (label primario `materia`) + k-means seed-fija sobre embeddings (capa secundaria) — labels JAMÁS LLM | §Clustering determinista, §Don't Hand-Roll (mode() no LLM) |

## Standard Stack

### Core (todo ya presente — cero instalación net-new)

| Componente | Ubicación real | Purpose | Por qué es el estándar del repo |
|------------|----------------|---------|--------------------------------|
| Patrón tabla-señal deny-by-default | `supabase/migrations/0039_cruce_senal.sql` L45-69 | Molde de `actualidad_senal` (RLS enabled + cero policies + `revoke all from anon, authenticated` + índices) | Precedente directo de "señal materializada" (0039/0030) |
| Patrón proc full-rebuild | `supabase/migrations/0039_cruce_senal.sql` L79-122 | `actualidad.materializar_senales()` — `security definer set search_path=''`, `delete from` + `insert` transaccional | D-11: full rebuild da conteos coherentes por corrida |
| Patrón cron pg_cron | `0039_cruce_senal.sql` L124-154 | `cron.schedule` + guard de versión pg_cron + assertion post-migración | Espejo verbatim; falla la migración si el job no queda registrado |
| Patrón RPC bounded | `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` (9 RPCs) | RPC de lectura del panel: `language sql stable security definer set search_path='' set statement_timeout='5s'` + `LIMIT` + doble-revoke | Key decision v9.0 "aguja completa" |
| `PUBLIC_RPC_ALLOWLIST` | `app/lib/lockdown-guard.test.ts` L165-192 | Registro de la RPC nueva (Set alfabético) | Guard Direction-B FALLA si el árbol web llama una RPC fuera de la lista |
| Embeddings 768d | `supabase/migrations/0011_fichas_embeddings.sql` L37-50 | `proyecto_embedding(boletin PK, embedding vector(768), model/dims/version)` + índice HNSW `vector_cosine_ops` | Base del clustering; join key = `boletin` (NO por evento) |
| Columna materia | `supabase/migrations/0008_tramitacion.sql` L26 (`proyecto.materia text`) | Label PRIMARIO factual del cluster (taxonomía oficial) | Label = dato de fuente, no interpretación |
| Patrón CLI prod | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` L28-70 | Molde del CLI `@obs/actualidad`: `createClient(url, serviceKey)`, `loadEnv` BOM-safe con precedencia `process.env` | Todos los crons TS del repo lo siguen |
| Patrón cron YAML | `.github/workflows/leyes-weekly.yml` | Molde de `actualidad-refresh.yml`: checkout/pnpm/node22/`install --ignore-scripts`/`pnpm --filter @obs/actualidad exec tsx …` | Repo público = minutos ilimitados |
| tz-Chile date-only | `app/lib/dia-calendario.ts` L34-43 | Contrato agenda: `citacion.fecha`/`sesion_sala.fecha` = medianoche UTC = día chileno; **NO convertir tz** | El corte "futuro" de agenda en SQL usa `>= current_date` sobre la parte fecha, sin aritmética de zona |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| k-means en TS (CLI) | k-means SQL puro (Lloyd con `<=>`) en el proc | SQL-puro cabría en pg_cron (100% dentro de 0039) pero el `mode(materia)` + iteración de centroides es verboso y frágil en plpgsql; TS es más legible y el molde CLI ya existe. **[ASSUMED]** k-means SQL es expresable pero no lo recomiendo. |
| Tabla precomputada | Materialized view + `REFRESH` | RECHAZADA por CONTEXT: `REFRESH` no-concurrente toma `ACCESS EXCLUSIVE` → bloquea la landing (página más visitada). Sin precedente en repo. |
| RPC de lectura | `.from("actualidad_senal")` server-side directo | La tabla es deny-by-default → service_role la lee, pero la CONTEXT pide "aguja completa" RPC bounded. Preferir RPC (auditable, allowlisted). |
| k=10 | k∈[8,15] | Discreción; k más alto = clusters más finos pero label `mode` menos representativo. **[ASSUMED]** k=10 razonable para ~decenas/cientos de PLs con movimiento reciente; el planner puede fijar tras un conteo real. |

**Installation:** Ninguna dependencia npm net-new. `@obs/actualidad` es un workspace nuevo que reusa `@supabase/supabase-js` (ya presente). Migraciones vía:
```bash
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0065_actualidad_senal.sql
```

## Package Legitimacy Audit

No aplica plenamente — **esta fase no instala ningún paquete externo net-new**. El CLI `@obs/actualidad` reusa `@supabase/supabase-js` (v2, ya en el lockfile, verificado en `run-tramitacion-prod-cli.ts` L30) y `tsx` (ya usado por todos los crons). k-means se implementa a mano (~30 líneas TS) o con la librería que el planner elija; si se elige una librería de k-means, correr slopcheck antes.

**Recomendación:** implementar k-means Lloyd a mano (seed-fija con PRNG determinista tipo mulberry32) — evita una dependencia y garantiza reproducibilidad byte-a-byte. Es ~40 líneas. Si el planner prefiere librería, marcarla `[ASSUMED]` y gate con `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
   pg_cron          │  actualidad.materializar_senales()          │
   (intradía L-V) ─▶│  (SQL puro, security definer, FULL REBUILD  │
                    │   del set de tipos_señal temporales)         │
                    │  lee: tramitacion_evento / citacion /        │
                    │       sesion_sala / proyecto                 │
                    │  aplica: fecha<=current_date, camara regex,  │
                    │          camara NULL guard, supresión-frescura│
                    └───────────────────┬─────────────────────────┘
                                        │ escribe (delete+insert)
                                        ▼
   GH Actions       ┌─────────────────────────────────────────────┐
   actualidad-      │            actualidad_senal (tabla)          │
   refresh.yml   ──▶│  deny-by-default (RLS enabled, cero policies,│
   (intradía L-V)   │   revoke all anon/authenticated)             │
   @obs/actualidad  │  filas: tipo_senal + ventana + conteo +      │
   CLI (TS)         │  cobertura_camara + fecha_max + cluster_id + │
   k-means seed-fija│  supresion_causa + evidencia jsonb + prov.   │
   escribe tipo_    └───────────────────┬─────────────────────────┘
   señal='agrupacion│                    │ lee (select … limit N)
   _materia'        │                    ▼
   (label=mode      │  RPC bounded actualidad_senales_panel()      │
    materia)        │  security definer, statement_timeout 5s,     │
                    │  LIMIT, en PUBLIC_RPC_ALLOWLIST              │
                    └───────────────────┬─────────────────────────┘
                                        │ .rpc() service_role (Camino A)
                                        ▼
                         Phase 100 landing (server-only) — NO en esta fase
```

Nota: el proc pg_cron y el CLI escriben tipos_señal DISJUNTOS (el proc: velocity/urgencias/agenda/archivados/nuevos-ingresos; el CLI: `agrupacion_materia`). No compiten por las mismas filas. Ver §Cron split.

### Recommended Project Structure (deltas)
```
supabase/migrations/
├── 0065_actualidad_senal.sql       # tabla + proc materializador + pg_cron (espeja 0039)
└── 0066_actualidad_rpc.sql         # RPC(s) bounded del panel (espeja 0064)
supabase/tests/
└── 0065_actualidad_senal.test.sql  # pgTAP (espeja 0039_cruce_senal.test.sql)
packages/actualidad/                # workspace @obs/actualidad
├── package.json                    # name "@obs/actualidad", dep @supabase/supabase-js
└── src/
    ├── kmeans.ts                    # Lloyd seed-fija determinista + label mode(materia)
    └── run-actualidad-prod-cli.ts   # espeja run-tramitacion-prod-cli.ts (loadEnv, createClient)
.github/workflows/
└── actualidad-refresh.yml          # clona leyes-weekly.yml SIN R2, cron "0 11,14,17,20 * * 1-5"
app/lib/
└── lockdown-guard.test.ts          # MODIFICADO — añadir RPC nueva a PUBLIC_RPC_ALLOWLIST
```

### Pattern 1: Tabla precomputada deny-by-default (espejo 0039)
**What:** Tabla `actualidad_senal` con RLS enabled, cero policies, `revoke all from anon, authenticated`. service_role (owner) bypassa RLS para escribir; la RPC security-definer la lee.
**When to use:** Toda señal materializada. LOCKED por CONTEXT.
**Example:** Ver §Code Examples (DDL propuesto).

### Pattern 2: Proc full-rebuild transaccional (espejo 0039 L79-122)
**What:** `create or replace function actualidad.materializar_senales() returns void language plpgsql security definer set search_path = ''` con `delete from public.actualidad_senal where tipo_senal in (…temporales…);` seguido de N `insert … select` (uno por señal). Schema propio `actualidad` para internals.
**When to use:** El proc de pg_cron. `set search_path=''` obliga a calificar `public.tramitacion_evento` etc.

### Pattern 3: RPC bounded aguja-completa (espejo 0064)
**What:** `create or replace function public.actualidad_senales_panel(p_tipo text default null) returns table(...) language sql stable security definer set search_path='' set statement_timeout='5s' as $$ select … from public.actualidad_senal … order by … limit 200; $$;` + `revoke all … from public; revoke all … from anon, authenticated;` + alta en `PUBLIC_RPC_ALLOWLIST`.
**When to use:** Lectura del panel. Precedido de `drop function if exists` (idiom 42P13).

### Anti-Patterns to Avoid
- **Emitir señal negativa como afirmación** ("sin movimiento"): la ausencia de filas es indistinguible de "no se scrapeó". Emitir SIEMPRE una fila con `supresion_causa` cuando `fecha_max` de la fuente supera el umbral stale.
- **Ranking cross-cámara por conteo:** Cámara (25.741 ev.) vs Senado (20.357) es asimetría de cobertura, no de actividad (T-52-13). Declarar cobertura por señal, jamás ordenar.
- **Label de cluster por LLM:** editorializa por construcción. Label = `mode(proyecto.materia)` SQL/TS, JAMÁS texto generado.
- **`db push`:** drift de `schema_migrations`. Solo `psql --single-transaction`.
- **`grant … to public/authenticated` en la migración:** dispara `lockdown-guard`. Toda RPC nueva es cero-grant + doble-revoke.
- **Convertir tz de `citacion.fecha`:** fabrica el día anterior. Usar la parte fecha UTC directa (dia-calendario.ts). En SQL: comparar `citacion.fecha::date >= current_date` sin `at time zone`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Etiqueta del cluster | Llamada a LLM para "nombrar el tema" | `mode()` de `proyecto.materia` (SQL) o moda en TS | LLM editorializa (riesgo existencial #2); materia es taxonomía oficial factual |
| Full-rebuild de señales | UPSERT por conflicto acumulativo | `delete` + `insert` transaccional (D-11 de 0039) | Conteos/evidencia deben reflejar el estado ACTUAL completo, no acumulado parcial |
| Corte "futuro" de agenda | Aritmética de zona `at time zone 'America/Santiago'` | `citacion.fecha::date >= current_date` (date-only-midnight-UTC = día chileno) | Convertir tz retrocede un día (dia-calendario.ts contrato LOCKED) |
| Scheduler | Broker/cola nuevo | pg_cron (SQL) + GH Actions (TS) — ambos ya presentes | CONTEXT prohíbe infra nueva |
| Similitud entre proyectos | kNN HNSW on-read | Clustering offline en el CLI escribiendo `cluster_id` | On-read choca con `statement_timeout 5s` (Pitfall 9) |

**Key insight:** El proyecto ya resolvió "señal materializada por cron" (0039) y "RPC bounded" (0064) y "clustering sobre embeddings" (0011 `match_proyectos`). Phase 99 es composición de esos tres, no invención.

## Cómputo por señal en SQL (proc `actualidad.materializar_senales()`)

Cada `insert … select` aplica los 3 defectos LOCKED. Guía para el planner (NO copiar ciego — verificar nombres de columna contra el schema aplicado):

- **velocity:** `select count(*) filter (...) , count(distinct boletin) from public.tramitacion_evento where fecha <= current_date and fecha >= current_date - interval '7 days'` → agrupar POR cámara normalizada `regexp_replace(camara,'\s+','','g')` con `camara is null` como `'(sin cámara)'`. `conteo` + `cobertura_camara`. NUNCA "top".
- **nuevos ingresos:** primer-evento por boletín = `select boletin, min(fecha) as primer from public.tramitacion_evento where fecha <= current_date group by boletin having min(fecha) >= '2022-01-01' and min(fecha) >= current_date - interval '7 days'`. EXCLUIR `min(fecha) < 2022` (eventos históricos, no ingresos). `cobertura = '2022-2026'`. JAMÁS `fecha_captura`.
- **urgencias vivas:** `where tipo='urgencia' and fecha <= current_date and fecha >= current_date - interval '30 days'`. Fila con el HECHO fechado (`descripcion` + `fecha`), nunca "vigente".
- **agenda próxima:** `select … from public.citacion where fecha::date >= current_date` (date-only, sin tz). Si `select count(*) from public.sesion_sala where fecha::date >= current_date` = 0 → escribir fila `tipo_senal='agenda_sala'` con `supresion_causa='sin sesiones agendadas en las fuentes consultadas'`.
- **archivados/retirados:** `where descripcion ilike '%archiv%' or descripcion ilike '%retira%'` con `fecha <= current_date`, y **excluir** `descripcion ilike '%desarchiv%'` y `ilike '%retira y hace presente%'` (invierten sentido) — o marcarlas con su sentido literal. NO `proyecto.estado`. Framing "movimiento de archivo/retiro fechado".
- **supresión-frescura (transversal):** por cada fuente, computar `max(fecha_captura)`; si supera el umbral stale de `pnpm freshness` → NO emitir la señal positiva, emitir fila con `supresion_causa='sin datos frescos de esta fuente'`.

## Clustering determinista (CLI TS `@obs/actualidad`)

- **Input:** `proyecto_embedding.embedding vector(768)` JOIN `proyecto` por `boletin`, filtrado a los boletines con movimiento reciente (los que velocity ya identificó). Leer vía service_role (`.from("proyecto_embedding").select("boletin, embedding")` — la tabla es public-read; ver 0011 L80-86).
- **Algoritmo:** Lloyd k-means, **seed fija** (PRNG determinista para init de centroides — p.ej. k-means++ con semilla constante, o init a los primeros k por orden de boletín). k=10 (discreción, [8,15]). Distancia coseno (consistente con cómo se generaron los embeddings Gemini — `<=>` en SQL, dot-product normalizado en TS).
- **Label = moda factual:** por cluster, `mode()` de `proyecto.materia` (la materia más frecuente). En TS: contar frecuencias, tomar la máxima; empate → orden alfabético (determinista). JAMÁS LLM.
- **Escritura:** el CLI hace full-rebuild de su tipo_señal: `delete … where tipo_senal='agrupacion_materia'` + `insert` una fila por cluster con `cluster_id`, `conteo` (boletines en el cluster), label en un campo (reusar columna o `evidencia jsonb`), provenance. Idempotente y reproducible.
- **Reproducibilidad:** con seed fija + input estable → misma asignación cada corrida. Documentar la seed como constante.

## Cron split — pg_cron vs GH Actions sin race

- **pg_cron** (dentro de 0065): `cron.schedule('actualidad-materializar', '<expr>', $$ select actualidad.materializar_senales(); $$)`. Escribe SOLO los tipos_señal temporales. Sub-segundo (agregado sobre datos ya en DB).
- **GH Actions** `actualidad-refresh.yml`: `cron: "0 11,14,17,20 * * 1-5"`, corre `@obs/actualidad` CLI que escribe SOLO `tipo_senal='agrupacion_materia'`.
- **Sin race:** los dos escriben conjuntos DISJUNTOS de `tipo_senal` con full-rebuild acotado a su propio tipo (`delete … where tipo_senal in (...)`), no `delete from actualidad_senal` global. Un `unique(tipo_senal, cluster_id, ventana, camara)` o similar evita duplicados. Si el planner prefiere simplicidad, el CLI puede llamar al proc SQL primero y luego escribir su capa — pero mantener los deletes acotados por tipo es más robusto ante corridas solapadas.
- **NO toca fuentes** → sin rate-limit 2-3s, sin R2, sin robots.txt. El YAML clona leyes-weekly PERO borra el bloque R2 (env `R2_*`) y deja solo `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY`.

## Bounded RPC(s) del panel

Mínimo **una** RPC: `public.actualidad_senales_panel(p_tipo text default null)` que retorna las filas de `actualidad_senal` (todas o filtradas por tipo), `order by … limit 200`. Firma sugerida:
```
returns table(tipo_senal text, ventana text, conteo int, cobertura_camara text,
              materia text, cluster_id int, fecha_max timestamptz,
              supresion_causa text, evidencia jsonb)
```
`language sql stable security definer set search_path='' set statement_timeout='5s'`, `LIMIT` explícito, doble-revoke, alta en `PUBLIC_RPC_ALLOWLIST` (Set alfabético en `lockdown-guard.test.ts` L165 — insertar `"actualidad_senales_panel"` en orden). El planner puede partir en 2 RPCs (una por señales temporales, otra por clusters) si conviene a Phase 100; ambas siguen el mismo molde.

## Runtime State Inventory

Phase 99 es **aditiva** (nueva tabla + proc + RPC + cron + CLI) — no renombra ni migra estado existente. Inventario:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Ninguna migración de datos: `actualidad_senal` es tabla NUEVA, poblada por el materializador. Lee de `tramitacion_evento`/`citacion`/`sesion_sala`/`proyecto`/`proyecto_embedding` existentes. | Ninguna migración de datos; solo `create table` + primer rebuild |
| Live service config | pg_cron gana un job nuevo `actualidad-materializar` (registrado por la migración, verificado por assertion). GH Actions gana `actualidad-refresh.yml`. Ninguno modifica jobs existentes. | Verificar el nuevo job en `cron.job` post-apply (pgTAP) |
| OS-registered state | None — verificado: no hay Task Scheduler/pm2/systemd involucrado (crons son pg_cron interno + GH Actions). | None |
| Secrets/env vars | El CLI nuevo reusa `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` (ya en secrets de repo, usados por leyes-weekly). Sin R2. Sin secret nuevo. | Ninguno — secrets existentes |
| Build artifacts | Workspace `@obs/actualidad` nuevo → `pnpm install` regenera lockfile. Sin egg-info/binarios. | `pnpm install --frozen-lockfile` en CI; asegurar el paquete en `pnpm-workspace.yaml` |

## Common Pitfalls

### Pitfall 1: Señal negativa por cobertura parcial (P1 del research)
**What goes wrong:** La ausencia de filas en una ventana se lee como "sin movimiento" cuando fue "no se scrapeó".
**How to avoid:** Toda señal cruza `fecha_captura` de su fuente contra el umbral stale; si stale → fila con `supresion_causa`, nunca 0-como-hecho. La supresión es una FILA, no una fila faltante.
**Warning signs:** pgTAP que inyecta fuente stale y espera 0 filas positivas (debe disparar supresión).

### Pitfall 2: `fecha='2626-05-25'` envenena max(fecha)/ventanas
**What goes wrong:** 2 filas con typo de parseo (2626) dicen "último movimiento en 2626".
**How to avoid:** `where fecha <= current_date` en TODA agregación temporal. LOCKED.
**Warning signs:** pgTAP: sembrar fila `fecha > current_date`, verificar que NO alimenta ninguna señal.

### Pitfall 3: `camara` con dos grafías + NULL
**What goes wrong:** `C.Diputados` (19.813) y `C. Diputados` (5.930) se cuentan como cámaras distintas; 2.261 NULL se reparten inventando atribución.
**How to avoid:** `regexp_replace(camara,'\s+','','g')` antes de agrupar; `camara is null` → `'(sin cámara)'` explícito, nunca repartido.
**Warning signs:** pgTAP: sembrar ambas grafías, verificar que colapsan a una.

### Pitfall 4: k-means no determinista
**What goes wrong:** init aleatorio de centroides → clusters distintos cada corrida → label inestable.
**How to avoid:** seed fija (PRNG determinista), input ordenado por boletín, empates de `mode(materia)` resueltos alfabéticamente.
**Warning signs:** dos corridas con el mismo input dan asignaciones distintas.

### Pitfall 5: Race entre pg_cron y GH Actions
**What goes wrong:** `delete from actualidad_senal` global en ambos → uno borra el trabajo del otro.
**How to avoid:** cada uno hace `delete … where tipo_senal in (su-conjunto)` acotado; conjuntos disjuntos.
**Warning signs:** filas de clusters desaparecen tras una corrida del proc SQL.

### Pitfall 6: tz de agenda
**What goes wrong:** `citacion.fecha at time zone 'America/Santiago'` retrocede el día publicado.
**How to avoid:** comparar `citacion.fecha::date >= current_date` directo (date-only-midnight-UTC = día chileno, dia-calendario.ts LOCKED).
**Warning signs:** una citación del lunes aparece como domingo.

## Code Examples

### DDL propuesto de `actualidad_senal` (espejo 0039 L45-69)
```sql
-- Source: espejo supabase/migrations/0039_cruce_senal.sql L45-69
create table actualidad_senal (
  id               bigint generated always as identity primary key,
  tipo_senal       text not null check (tipo_senal in
                     ('velocity','nuevos_ingresos','urgencias','agenda_citacion',
                      'agenda_sala','archivados','agrupacion_materia')),
  ventana          text,                       -- p.ej. '7d', '30d', '2022-2026'
  conteo           int  not null default 0,
  cobertura_camara text,                       -- normalizada; '(sin cámara)' | 'diputados' | 'senado' | 'ambas'
  materia          text,                       -- label factual (clusters) / null
  cluster_id       int,                        -- solo agrupacion_materia
  fecha_max        timestamptz,                -- max(tramitacion_evento.fecha) de la fuente (reloj real)
  supresion_causa  text,                       -- NULL = señal activa; texto = suprimida con causa
  evidencia        jsonb not null default '{}'::jsonb,  -- items crudos con enlace de fuente (D-09)
  -- provenance inline NOT NULL (FND-08)
  dataset          text not null,
  origen           text not null,
  fecha_captura    timestamptz not null default now(),
  enlace           text,
  unique (tipo_senal, cobertura_camara, ventana, cluster_id)
);
alter table actualidad_senal enable row level security;
revoke all on actualidad_senal from anon, authenticated;
create index actualidad_senal_tipo_idx on actualidad_senal (tipo_senal);
```

### Proc + cron (espejo 0039 L79-154) — esqueleto
```sql
-- Source: espejo supabase/migrations/0039_cruce_senal.sql L79-154
create schema if not exists actualidad;

create or replace function actualidad.materializar_senales()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- FULL REBUILD acotado a los tipos temporales (el CLI maneja 'agrupacion_materia')
  delete from public.actualidad_senal
   where tipo_senal in ('velocity','nuevos_ingresos','urgencias',
                        'agenda_citacion','agenda_sala','archivados');

  -- velocity (aplica los 3 defectos LOCKED) — ejemplo de UN insert
  insert into public.actualidad_senal
    (tipo_senal, ventana, conteo, cobertura_camara, fecha_max, dataset, origen, fecha_captura)
  select 'velocity', '7d', count(*),
         coalesce(nullif(regexp_replace(camara,'\s+','','g'),''), '(sin cámara)'),
         max(fecha), 'tramitacion', 'plataforma', now()
    from public.tramitacion_evento
   where fecha <= current_date
     and fecha >= current_date - interval '7 days'
   group by coalesce(nullif(regexp_replace(camara,'\s+','','g'),''), '(sin cámara)');

  -- … (nuevos_ingresos, urgencias, agenda_*, archivados, supresión-frescura) …
end;
$$;

do $$ declare v text; begin
  select extversion into v from pg_extension where extname='pg_cron';
  if v is null then raise exception 'pg_cron no instalado'; end if;
  perform cron.schedule('actualidad-materializar','7 11,14,17,20 * * 1-5',
    $cron$ select actualidad.materializar_senales(); $cron$);
end $$;
do $$ begin
  if not exists (select 1 from cron.job where jobname='actualidad-materializar')
  then raise exception 'cron actualidad-materializar no registrado'; end if;
end $$;
```

### RPC bounded (espejo 0064 L27-62)
```sql
-- Source: espejo supabase/migrations/0064_bounded_rpc_statement_timeout.sql L27-62
drop function if exists public.actualidad_senales_panel(text);
create or replace function public.actualidad_senales_panel(p_tipo text default null)
returns table (tipo_senal text, ventana text, conteo int, cobertura_camara text,
               materia text, cluster_id int, fecha_max timestamptz,
               supresion_causa text, evidencia jsonb)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select s.tipo_senal, s.ventana, s.conteo, s.cobertura_camara,
         s.materia, s.cluster_id, s.fecha_max, s.supresion_causa, s.evidencia
  from public.actualidad_senal s
  where p_tipo is null or s.tipo_senal = p_tipo
  order by s.tipo_senal, s.cobertura_camara nulls last, s.cluster_id nulls last
  limit 200;
$$;
revoke all on function public.actualidad_senales_panel(text) from public;
revoke all on function public.actualidad_senales_panel(text) from anon, authenticated;
```
Luego: añadir `"actualidad_senales_panel"` a `PUBLIC_RPC_ALLOWLIST` en `app/lib/lockdown-guard.test.ts` (Set alfabético, tras `"actualidad…"` — es la primera entrada, va al inicio).

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Señal on-read (`actualidad-module.tsx` `.from()` en vivo) | Tabla precomputada + RPC bounded | v10.0 (esta fase) | Agregaciones caras salen del request de la landing |
| RPC sin timeout | `set statement_timeout='5s'` | 0064 (v9.0) | DoS bounding; toda RPC nueva lo hereda |

**Deprecated/outdated:** `fecha_captura` como fecha de hecho (98-SPIKE §4 — 44.847 eventos con `fecha_captura=2026-07-10` por backfill). Solo frescura + hash-check.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | k-means en TS (CLI) es preferible a SQL puro | Standard Stack / Alternatives | Si el planner prefiere pg_cron 100%, k-means SQL es viable pero verboso — bajo riesgo, es discreción LOCKED |
| A2 | k=10 razonable | Alternatives | Label `mode` menos representativo si k mal elegido; el planner debe contar los PLs con movimiento reciente antes de fijar k |
| A3 | Implementar k-means a mano (sin librería) | Package Legitimacy Audit | Si se elige librería, gate slopcheck + checkpoint |
| A4 | `sesion_sala` es el nombre de tabla de sesiones de sala | Cómputo por señal | Verificar nombre exacto contra schema aplicado (el SPIKE cita `sesion_sala`; migración 0010 usa `sesion_tabla_item`/`sesion_sala` — confirmar) |
| A5 | Umbral stale de `pnpm freshness` es reusable por fuente en SQL | Cómputo/supresión | Si el umbral vive solo en TS, el proc SQL necesita el valor hardcodeado o el CLI computa la supresión |
| A6 | Nombres de columna (`descripcion`, `tipo`, `camara`) en `tramitacion_evento` | Cómputo por señal | Verificados contra 0008 L68-82 — `tipo` es CHECK (tramite/urgencia/informe/oficio/votacion), `descripcion` nullable |

## Open Questions

1. **¿`sesion_sala` existe como tabla con columna `fecha`?**
   - What we know: 98-SPIKE §1 la cita (`16` filas / `0` futuras); 0010_agenda.sql define tablas de agenda.
   - What's unclear: nombre exacto de la tabla de sesiones de sala vs `sesion_tabla_item`.
   - Recommendation: el planner/executor verifica contra el schema aplicado antes de escribir el insert de `agenda_sala`.

2. **¿El umbral de staleness por fuente está accesible en SQL o solo en `pnpm freshness` (TS)?**
   - What we know: `pnpm freshness` existe (memoria v6.0) con umbral por fuente.
   - What's unclear: si el valor es consultable desde el proc SQL.
   - Recommendation: si no, hardcodear el umbral en el proc (documentado) o mover el cómputo de supresión al CLI.

3. **¿1 RPC o 2 para el panel?**
   - What we know: Phase 100 (panel) es el consumidor; CONTEXT da discreción.
   - Recommendation: 1 RPC con `p_tipo` filtrable cubre; partir en 2 solo si Phase 100 lo pide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pg_cron | proc scheduler | ✓ (usado por 0030/0039) | instalado en Supabase Pro | — (assertion falla la migración si ausente) |
| pgvector | embeddings 768d | ✓ (0011 HNSW) | 0.8.x | — |
| `proyecto_embedding` poblada | clustering | ✓ (v6.1, 768d) | — | Cobertura ~84.6% (15.4% sin embedding) → clusters sobre subset con embedding; declarar cobertura |
| GH Actions | CLI cron | ✓ (leyes-weekly etc.) | — | pg_cron+pg_net si se quisiera todo en Supabase (no recomendado) |
| `@supabase/supabase-js` | CLI | ✓ (lockfile) | v2 | — |

**Missing dependencies with no fallback:** Ninguna.
**Missing dependencies with fallback:** Embeddings faltantes (15.4%) → clustering declara su cobertura; no bloquea.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (SQL) | pgTAP — `supabase/tests/00XX_*.test.sql`, corrido `psql -tA -f` contra schema APLICADO |
| Framework (TS) | vitest — `app/vitest.config.ts` + por-package |
| Config file | `app/vitest.config.ts` (frontend/guards); pgTAP sin config (plan()/finish()) |
| Quick run command | `pnpm --filter @obs/actualidad test` (CLI k-means unit) |
| Full suite command | `pnpm test` (app 1252+ + packages) + `pnpm typecheck` + `pnpm audit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEN-02 | `actualidad_senal` existe, RLS enabled, deny-by-default, anon 42501 | pgTAP | `psql -tA -f supabase/tests/0065_actualidad_senal.test.sql` | ❌ Wave 0 |
| SEN-02 | proc `actualidad.materializar_senales()` es security definer | pgTAP | idem | ❌ Wave 0 |
| SEN-02 | RPC `actualidad_senales_panel` en PUBLIC_RPC_ALLOWLIST | vitest (guard) | `pnpm --filter app test lockdown-guard` | ✅ (guard existe; se extiende) |
| SEN-02 | cron `actualidad-materializar` registrado | pgTAP | idem | ❌ Wave 0 |
| SEN-03 | fuente stale → fila con supresion_causa (no 0-como-hecho) | pgTAP | idem | ❌ Wave 0 |
| SEN-04 | fila `fecha>current_date` NO alimenta señal; `camara` normalizada colapsa grafías | pgTAP | idem | ❌ Wave 0 |
| SEN-05 | k-means determinista (misma entrada → misma asignación); label=mode(materia) no LLM | vitest | `pnpm --filter @obs/actualidad test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter <pkg> test` + el pgTAP relevante contra el schema aplicado.
- **Per wave merge:** `pnpm test` + `pnpm typecheck`.
- **Phase gate:** suite completa verde + pgTAP verde contra PROD aplicado + `pnpm audit` 0 antes de `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `supabase/tests/0065_actualidad_senal.test.sql` — espeja `0039_cruce_senal.test.sql`; cubre SEN-02/03/04 (tabla+RLS+42501+security-definer+cron+defectos+supresión)
- [ ] `packages/actualidad/src/kmeans.test.ts` — determinismo + label mode(materia), cubre SEN-05
- [ ] `packages/actualidad/package.json` + entrada en `pnpm-workspace.yaml`
- [ ] Extensión de `app/lib/lockdown-guard.test.ts` — RPC nueva en allowlist (test ya existe, solo se añade la entrada)

## Security Domain

`security_enforcement` implícito (no `false` en config). Esta fase toca el régimen de seguridad LOCKED del repo.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | RPC security-definer + `PUBLIC_RPC_ALLOWLIST` (guard Direction-B); tabla deny-by-default + `revoke all` |
| V5 Input Validation | yes | RPC recibe `p_tipo text` — el `where p_tipo is null or tipo_senal=p_tipo` es paramétrico (sin SQL string-building); CHECK constraint en `tipo_senal` |
| V6 Cryptography | no | Sin secretos nuevos; embeddings/señales son datos derivados no-PII |
| V2/V3 Auth/Session | no | Esta fase NO toca auth (rol `authenticated` = Phase 103); service_role solo |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DoS por agregación cara on-read | DoS | Precomputar offline + RPC `statement_timeout='5s'` + `LIMIT` (0064) |
| Fuga PII por RPC nueva | Info Disclosure | `actualidad_senal` es no-PII por construcción (deriva de tramitacion/proyecto/citacion — sin rut/email/partido); el proc NO referencia tablas PII. pgTAP verifica el cuerpo (espejo test 0039 L75-82: `!~* '\y(partido|rut)\y'`) |
| Re-apertura REST vía grant | Elevation | Cero-grant + doble-revoke; `lockdown-guard` muerde `grant … to anon/public` >0064 |
| Afirmación falsa (señal negativa) | Tampering (de la verdad) | Supresión-como-fila con `supresion_causa`; jamás ausencia-como-hecho |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0039_cruce_senal.sql` (leído completo) — tabla deny-by-default + proc full-rebuild + pg_cron + assertion. **Patrón espejo directo.**
- `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` (leído completo) — 9 RPCs bounded, idiom drop+create-or-replace, security-definer + search_path + statement_timeout + doble-revoke.
- `supabase/tests/0039_cruce_senal.test.sql` (leído completo) — plan()/finish(), has_table, RLS enabled, cero policies, security-definer, no-PII body check, cron registrado, anon 42501.
- `app/lib/lockdown-guard.test.ts` L160-227 (leído) — `PUBLIC_RPC_ALLOWLIST` (Set), `anonGrantOffenders` regex (solo anon|public).
- `supabase/migrations/0011_fichas_embeddings.sql` L36-86 (leído) — `proyecto_embedding vector(768)` PK boletin + HNSW cosine + `match_proyectos`.
- `supabase/migrations/0008_tramitacion.sql` L18-100 (leído) — `proyecto.materia`, `tramitacion_evento` (tipo CHECK, descripcion, camara, fecha).
- `app/lib/dia-calendario.ts` (leído completo) — contrato tz date-only-midnight-UTC = día chileno; NO convertir tz.
- `app/components/actualidad-module.tsx` (leído completo) — molde "en las fuentes consultadas", `throw` no `?? []` (#34), `inicioSemanaIso` tz Chile, FUENTES_FRESCURA no-PII.
- `.github/workflows/leyes-weekly.yml` (leído completo) — molde YAML: cron L-V, workflow_dispatch, node22, `install --ignore-scripts`, `pnpm --filter @obs/… exec tsx`.
- `packages/tramitacion/src/run-tramitacion-prod-cli.ts` L1-70 (leído) — molde CLI: createClient(url, serviceKey), loadEnv BOM-safe.
- `.planning/phases/98-senales-p1a-spike-de-datos/98-SPIKE-FINDINGS.md` (leído completo) — el gate: veredictos por señal, 3 defectos, regla del reloj, anti-ranking.
- `.planning/research/{ARCHITECTURE,STACK,PITFALLS}.md` (leídos) — decisiones v10.0.

### Secondary (MEDIUM confidence)
- `.planning/config.json` — nyquist_validation: true; commit_docs: true.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos los patrones leídos en código vivo, cero net-new.
- Architecture (proc/RPC/cron split): HIGH — espejo directo de 0039/0064/leyes-weekly.
- Clustering: MEDIUM/HIGH — algoritmo k-means es estándar; la elección TS-vs-SQL es discreción; embeddings existen y son consultables.
- Pitfalls: HIGH — derivados del SPIKE (auditoría contra DB viva) y del research v10.0.

**Research date:** 2026-07-24
**Valid until:** 2026-08-23 (30 días — patrones internos estables; migración set 0064 es el head actual)
