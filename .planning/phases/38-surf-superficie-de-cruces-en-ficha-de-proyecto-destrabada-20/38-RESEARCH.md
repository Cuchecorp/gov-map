# Phase 38: SURF — cruces_de_proyecto RPC + CrucesSection en ficha de proyecto - Research

**Researched:** 2026-07-07
**Domain:** Postgres security-definer RPC (idiom post-Camino A) + Next.js 16 server-component carril con degrade honesto — sobre datos REALES de PROD (verificados read-only)
**Confidence:** HIGH (todo lo load-bearing verificado con psql contra PROD)

## Summary

Este es un fase de **DDL + frontend** que espeja idioms ya en el repo (RPC `lobby_en_tramitacion`/0048, componente `LobbyEnTramitacionSection`), **sin dependencias nuevas, sin tokens nuevos, sin gramática visual nueva** (UI-SPEC §Component Inventory). La incógnita crítica —¿existe un mapeo boletín→sector?— quedó **RESUELTA contra PROD**: la columna `proyecto_ficha.sector_id` está poblada (65/74 fichas), un sector único por proyecto, materializada por el clasificador (Plan 02/03). La RPC `cruces_de_proyecto(boletin)` es por tanto construible sobre datos reales sin fabricar ninguna relación: `boletín → proyecto_ficha.sector_id → cruce_senal (mismo sector) ∩ parlamentarios con voto 'si' confirmado en votaciones del boletín`.

**Hallazgo demo LOAD-BEARING:** el boletín demo históricamente citado **14782-13 (sala cuna) NO tiene fila en `proyecto_ficha`** → sin sector → la RPC devuelve **0 filas** (empty honesto, no filas). Solo **2 boletines en todo PROD producen filas** con la ruta recomendada: **`14309-04` (educación → 47 parlamentarios, 144 reuniones)** y `18296-05` (banca_finanzas → 30 parlamentarios, 61 reuniones). La demo con filas DEBE usar **`14309-04`** (filas reales verificadas: emilia schneider 13, gonzalo winter 12, diego schalper 12).

**Primary recommendation:** Construir `cruces_de_proyecto(boletin)` como `security definer` espejo de 0048 (doble revoke, cero grant, add a `PUBLIC_RPC_ALLOWLIST`), con la ruta de sector vía `proyecto_ficha.sector_id` (Alternativa B — ya materializada, cero fabricación). El copy usa "sector {etiqueta}" solo cuando la ficha tiene sector; degrada honesto (empty) cuando no. Demo = **14309-04**. Escribir la migración `0049`, escribir su pgTAP post-apply, **NUNCA aplicar a PROD** (checkpoint operador).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **RPC `cruces_de_proyecto(boletin text)`**: espejo del idiom 0047/0048 (F52): `security definer`, `set search_path=''`, **doble revoke** (anon + authenticated), **CERO grant** (el sitio lee con service_role), agregada a la allowlist del lockdown-guard, pgTAP verificando contrato de columnas + deny de anon.
- **Contenido**: por sector del proyecto (mapeo sector existente de `cruce_senal`/materias), parlamentarios con voto A FAVOR en votaciones del boletín ∩ reuniones de lobby del sector — proyección PII-safe (nombre_normalizado/id vía `parlamentario_publico`), conteos neutros, `fecha_captura` para frescura (lección WR-02/F41).
- **La migración se ESCRIBE y committea; aplicarla a PROD es checkpoint de operador** (patrón 52-06). El agente JAMÁS la aplica.
- **CrucesSection**: se monta como sección del rail de proyecto (entrada "Cruces" en `ProyectoRail.navEntries`), capa-1 estilo F55 (marco petróleo, chips, trigger primary "Explorar los N cruces" vía `DetalleColapsable triggerVariant="primary"`).
- **Degrade honesto pre-apply**: RPC ausente → PGRST202 → sección devuelve null/no se monta (patrón 52-03). El deploy del código puede preceder al apply de la DDL.
- Nombres con `formatNombre` (F54); **nombre como LINK a `/parlamentario/[id]`** (el sujeto ES el parlamentario público — el texto-plano LOCKED de 52-03 aplica a CONTRAPARTES de lobby, no a parlamentarios).
- Caveat anti-causal **exactamente 1×/sección**; copy factual sin verbo causal (negative-match en tests); conteo neutro sin ranking.
- Gate `crucesPublicEnabled()` **ya está ON en PROD** desde 2026-07-02 — **NO se toca ningún flag**.
- Suite completa (baseline 670) + tsc + lockdown-guard + banned-vocab verdes; pgTAP para la RPC (runner `psql -tA -f` local; si no aplica pre-apply, escribir para post-apply siguiendo 0048).
- Redeploy al cierre (docker + wrangler); smoke; checkpoint final presenta (a) migración lista con comando exacto, (b) sección degradando honesta en PROD pre-apply.

### Claude's Discretion
- Shape exacto de la RPC (columnas) siguiendo el análogo `cruces_de_parlamentario` (0040/0041) y datos reales de `cruce_senal`.
- Umbral de truncado del detalle y microcopy factual.
- Si el mapeo proyecto→sector no existe, degradar honesto y documentar el límite — NUNCA fabricar la relación. **(Resuelto: SÍ existe vía `proyecto_ficha.sector_id`.)**
- Placement DOM del carril (documentado): después de `#lobby-tramitacion`, antes de `#idea-matriz` (UI-SPEC §Layout).

### Deferred Ideas (OUT OF SCOPE)
- Encendido de MONEY (gated F39/F40); cruces por aportes (requiere RUT).
- F48 (autores de proyecto) sigue gated por datos.
- Fusión `lobby_sector_aporte` (reservada Phase 40, gated RUT-01).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SURF-02 | En la ficha de un proyecto, ver qué parlamentarios que votaron a favor se reunieron con el sector del proyecto — con fuente, fecha y cero insinuación | Ruta de datos verificada contra PROD: `proyecto_ficha.sector_id` (65/74 poblado) ∩ `cruce_senal` (781 filas, tipo `lobby_sector`) ∩ votos 'si' confirmados. Idiom RPC = espejo 0048. Componente = espejo `LobbyEnTramitacionSection` con degrade PGRST202. Demo con filas = 14309-04. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Join sector×voto×lobby (PII-safe) | Database (RPC security definer) | — | Lee `parlamentario` (deny-by-default, PII) internamente; solo el owner puede. Emite derivado público. Nunca en el cliente. |
| Lectura de la RPC | API/Backend (Next server component) | — | `createServerSupabase()` (service_role) server-only; nunca toca el navegador (contrato no-leak F45). |
| Degrade honesto (PGRST202→null) | API/Backend (server component) | — | La decisión ausente/empty/error vive en el Server Component, no en el cliente. |
| Render capa-1/2/3 + link parlamentario | Frontend Server (SSR) | Browser (disclosure toggle) | Vista pura server-rendered; el único island cliente es `DetalleColapsable` (toggle sobre datos ya fetcheados). |
| Gate de presentación | Frontend Server (SSR) | — | `crucesPublicEnabled()` server-only envuelve `<section>` + rail entry. |

## User Constraints — Data Reality (verificado contra PROD, read-only 2026-07-07)

> Todos los conteos siguientes fueron obtenidos con `psql -tA` (SELECT-only) contra la DB de PROD (`SUPABASE_DB_URL`). Ninguna DDL/DML ejecutada.

### 1. Schema real de `cruce_senal` + camino voto `[VERIFIED: psql PROD]`
- `cruce_senal`: **781 filas**, 134 parlamentarios distintos, **13 sectores**, `tipo_senal` **único valor `'lobby_sector'`**, `fecha_captura` = `2026-07-07 03:23:00+00` (fresco, rebuild diario cron `23 3 * * *`).
- Columnas (de 0039): `id, parlamentario_id, sector_id, tipo_senal, conteo, evidencia jsonb, dataset, origen, fecha_captura, enlace`. `evidencia` = `{conteo, items[]}`; cada item `{tipo:'reunion', fecha, contraparte_nombre_crudo, audiencia_id, enlace_fuente}`.
- **Camino boletín → voto por parlamentario**: `votacion (id, boletin, camara, etapa, fecha)` ⨝ `voto (parlamentario_id, votacion_id, seleccion, estado_vinculo)`. **`seleccion='si'` = a favor** (valores reales: `si` 12636, `no` 7972, `ausente` 546, `abstencion` 425, `pareo` 23). Filtrar `estado_vinculo='confirmado'` (mismo predicado que 0048/0019) y `parlamentario_id is not null`.

### 2. Mapeo boletín → sector: **EXISTE** (Alternativa B recomendada) `[VERIFIED: psql PROD]`
- **`proyecto_ficha.sector_id` está POBLADO: 65/74 fichas tienen sector** (9 null = honest no-match, D-05). Clasificado por materia (Plan 02/03), FK a `sector(codigo)`, **UN sector por proyecto**.
- Distribución real: seguridad_justicia 29, trabajo_prevision 6, transporte 5, salud 5, tecnologia 4, vivienda_urbanismo 3, educacion 3, comercio_industria 3, mineria_energia 2, banca_finanzas 2, agricultura_pesca 2, medio_ambiente 1, (null) 9.

  **Alternativas evaluadas (honestas):**
  | Alt | Ruta | Veredicto |
  |-----|------|-----------|
  | **(B) sector vía materia clasificada** | `proyecto_ficha.sector_id` (ya materializado) | **RECOMENDADA** — cero fabricación, un sector por proyecto, 65/74 cobertura, join trivial. Es exactamente el sector que `cruce_senal` usa (misma taxonomía `sector(codigo)`). |
  | (A) sector vía comisión que vio el proyecto | `citacion_punto.boletin` → `citacion.comision` → mapear comisión→sector | Requiere un mapeo comisión→sector que **NO existe** en el schema; fabricaría una relación. Descartada. |
  | (C) degradar alcance (voto ∩ cruce sin afirmar sector) | juntar todos los cruces del parlamentario sin filtrar por sector del proyecto | Cambia el copy a "cruces del parlamentario" (no del sector del proyecto) — pierde el valor SURF-02 y difumina la yuxtaposición. Innecesaria dado que (B) existe. Descartada. |

  **Recomendación con evidencia:** Alternativa **B**. La RPC filtra `cruce_senal.sector_id = proyecto_ficha.sector_id`. Cuando `proyecto_ficha` no existe o `sector_id is null`, la RPC devuelve **0 filas** (empty honesto) — NUNCA se inventa sector.

### 3. Demo boletín — conteo real de filas `[VERIFIED: psql PROD]`
- **`14782-13` (sala cuna, votación Sí:24): NO tiene fila en `proyecto_ficha`** → sin sector → **RPC = 0 filas** (empty honesto). (Sí existe en `proyecto`; solo 11 de los 24 'si' son confirmados — el resto Senado por-nombre.) **No sirve como demo-con-filas.**
- **Simulación completa de la RPC sobre TODO PROD** (ruta B): solo **2 boletines producen filas**:
  - **`14309-04` (educación) → 47 parlamentarios con cruce, 144 reuniones** — *"Establece un sistema de subvenciones para la modalidad educativa de re…"*. Filas reales: emilia schneider (13), gonzalo winter (12), diego schalper (12). **← DEMO recomendada.**
  - `18296-05` (banca_finanzas) → 30 parlamentarios, 61 reuniones — *"Autoriza mayor endeudamiento del gobierno central durante el año 2026"*.
- **Límite de cobertura (documentar honesto):** solo **25 boletines** en PROD tienen algún voto 'si' *confirmado*, y solo **2** de esos tienen `sector_id`. La mayoría de las fichas renderizará **empty honesto** o degrade. Es esperado y honesto (votaciones Senado por-nombre no confirmadas + fichas sin sector clasificado). NO es un bug.

### 4. `parlamentario_publico` — proyección PII-safe `[VERIFIED: psql PROD + 0020]`
- `parlamentario` tiene `id` (ej. `D1133`) y `nombre_normalizado` (ej. `irarrazaval juan`), `camara`. La RPC 0020 `parlamentario_publico(p_id)` emite `id, nombre, camara, region, distrito, circunscripcion, periodo, origen, fecha_captura, enlace` — nunca `rut/partido/email`.
- **Patrón recomendado (espejo 0048):** NO llamar a `parlamentario_publico` desde dentro; la RPC `cruces_de_proyecto` (security definer) **lee `public.parlamentario` INTERNAMENTE** y emite `parlamentario_id` (= `p.id`, para el link `/parlamentario/[id]`) + `nombre_normalizado`. JAMÁS `rut/partido/email` en el `returns table` (pgTAP lo asserta, espejo 0048 assert 6).

### 5. Idiom exacto post-Camino A `[VERIFIED: 0047/0048 + lockdown-guard.test.ts]`
- `security definer set search_path = ''`, todos los nombres calificados con schema (`public.…`).
- Cambiar `returns table` de función existente = `42P13` → `drop function if exists` previo (no aplica: la RPC es NUEVA — pero incluir el drop es idiom defensivo).
- **DOBLE revoke tras el create** (los DEFAULT PRIVILEGES del rol de aplicación re-conceden EXECUTE a anon/authenticated sobre cada función nueva):
  ```
  revoke all on function public.cruces_de_proyecto(text) from public;
  revoke all on function public.cruces_de_proyecto(text) from anon, authenticated;
  ```
  **CERO grant a anon** (el guard falla ante cualquier `grant … to anon/public` en migraciones >0044).
- **Allowlist:** agregar `'cruces_de_proyecto'` a `PUBLIC_RPC_ALLOWLIST` en `app/lib/lockdown-guard.test.ts:165` (Set alfabético). Sin esto, el guard B falla al invocar la RPC desde el árbol público.
- **`cruce_senal` es tabla PII** (`PII_TABLES` en lockdown-guard.test.ts:133): el árbol público NO puede `.from('cruce_senal')` — solo vía la RPC. La nueva RPC es el único canal.
- **pgTAP:** escribir `supabase/tests/0049_cruces_de_proyecto.test.sql` espejo de `0048_lobby_en_tramitacion.test.sql` (fuera del glob vitest — `.test.sql`, no `.test.ts`; lo corre el operador con `psql -tA -f` el día del apply). Asserts: (1) has_function `(text)`, (2) `array_to_string(proargnames,',')` = orden posicional pineado, (3) `prosecdef=true`, (4) `proconfig like '%search_path=%'`, (5) `not has_function_privilege('anon', …)`, (6) `proargnames !~* '\y(partido|rut|email)\y'`, (7-N) fixture mínimo con rollback (NO depender de datos PROD — usar boletín/parlamentario/votación/cruce sembrados en la transacción).

### 6. Frontend: shape que la página ya tiene vs la RPC `[VERIFIED: page.tsx + lobby-en-tramitacion.tsx]`
- La página `app/app/proyecto/[boletin]/page.tsx` ya lee `votacion` (VotacionesSection:401) y `proyecto`/`proyecto_ficha` (cacheado). **NO tiene el cruce sector×voto×lobby** — eso lo trae la RPC nueva.
- **Precedente PGRST202 degrade — file/line:** `app/components/lobby-en-tramitacion.tsx:260` (`if (error?.code === "PGRST202") return null;`). **Este es el patrón a copiar** (NO el de `cruces-de-parlamentario.tsx`, que lanza en todo error porque está gated OFF; SURF está gated ON y DEBE degradar honesto). Tres caminos: PGRST202→null, otro error→throw (#34), data (0 filas → empty honesto dentro de la vista).

## Standard Stack

Sin dependencias nuevas (UI-SPEC §Design System: "New deps: NONE"). Todo el idiom vive en el repo.

| Asset | Ubicación | Rol en Phase 38 |
|-------|-----------|-----------------|
| RPC idiom (security definer, doble revoke) | `supabase/migrations/0048_lobby_en_tramitacion.sql` | Espejo directo para `0049_cruces_de_proyecto.sql` |
| pgTAP idiom | `supabase/tests/0048_lobby_en_tramitacion.test.sql` | Espejo para `0049_*.test.sql` (post-apply) |
| Server component + degrade PGRST202 | `app/components/lobby-en-tramitacion.tsx` | Espejo para `CrucesSection` de proyecto |
| Evidence render (evidencia.items[] + ProvenanceBadge) | `app/components/cruces-de-parlamentario.tsx` | Referencia para capa-2 (items de evidencia) |
| Capa-1 marco petróleo | `app/components/capa1/cruces-capa1.tsx` | Referencia visual (frame + chips) |
| `DetalleColapsable triggerVariant="primary"` | `app/components/detalle-colapsable.tsx` | Trigger "Explorar los N cruces" |
| `formatNombre` | `app/lib/format.ts` (F54) | Re-casea el nombre renderizado |
| `ProvenanceBadge` | `app/components/provenance-badge.tsx` | Fuente·fecha·enlace por evidencia |
| `crucesPublicEnabled()` | `app/lib/cruces-gate.ts` | Gate (ya ON — no se toca) |
| Row types | `app/lib/types.ts` (`CruceSenalRpcRow`, `CruceEvidenciaItem` :311-353) | Base para el nuevo tipo `CruceProyectoRow` |

**Installation:** N/A — zero new packages.

## Architecture Patterns

### System Architecture Diagram

```
/proyecto/[boletin] page (server)
        │
        │ crucesPublicEnabled(process.env)  ── OFF → <section> se omite (ya ON en PROD)
        ▼
  <section id="cruces" className="mt-12 scroll-mt-6">   ← frontier LOCKED, persiste aun con null
        │
        ▼
  <CrucesSection boletin>  (Server Component)
        │  createServerSupabase() [service_role, server-only]
        ▼
  sb.rpc("cruces_de_proyecto", { p_boletin })
        │
        ├── error.code === "PGRST202"  → return null      (degrade pre-apply; wrapper mt-12 persiste)
        ├── otro error                 → throw → error.tsx (#34, nunca degradado a empty)
        └── data (0..N filas)
              ▼
        <CrucesView rows>  (PURA — RTL con fixtures)
              │  h2 "Cruces con el sector del proyecto" + caveat 1× (DENTRO del componente)
              ├── rows.length === 0 → empty honesto ("sin registros", nunca "limpio")
              └── rows.length > 0
                    ├── capa-1: marco petróleo + "{N} parlamentarios" + DetalleColapsable primary
                    └── capa-2: por parlamentario → LINK /parlamentario/[id] (formatNombre)
                                + "Votó a favor de este proyecto" (línea SEPARADA)
                                + "{n} reuniones con gestores del sector {etiqueta}" (conteo neutro)
                                + evidencia.items[] → ProvenanceBadge (fuente·fecha·enlace)

  ── DB (RPC security definer, set search_path='') ──────────────────────────────
   proyecto_ficha.sector_id  ─┐
                              ├─(sector único del proyecto)
   votacion ⨝ voto            │   seleccion='si' AND estado_vinculo='confirmado'
     WHERE boletin, si-conf  ─┤   → set de parlamentario_id "a favor"
                              ▼
   cruce_senal  WHERE sector_id = <sector> AND parlamentario_id IN <a favor>
        ⨝ sector (etiqueta pública)  ⨝ parlamentario (nombre_normalizado, INTERNO)
        → una fila por parlamentario coincidente
```

### Recommended RPC shape (Discretion — one row per parlamentario)

Como un proyecto tiene **un** sector, `cruce_senal` ya está agregado por `(parlamentario, sector)` → filtrar por el sector del proyecto y por los votantes a-favor da **exactamente una fila por parlamentario coincidente**. Shape recomendado:

```
create or replace function public.cruces_de_proyecto(p_boletin text)
returns table (
  parlamentario_id   text,         -- p.id → link /parlamentario/[id]
  nombre_normalizado text,         -- proyección pública (nunca rut/partido/email)
  sector_id          text,
  sector_etiqueta    text,         -- catálogo público sector.etiqueta
  tipo_senal         text,         -- 'lobby_sector' (degradar honesto otro valor)
  conteo             int,          -- reuniones (conteo neutro)
  evidencia          jsonb,        -- {conteo, items[]} PII-safe de cruce_senal
  fecha_captura      timestamptz   -- frescura del rebuild (WR-02/F41)
)
language sql stable security definer set search_path = '' as $$
  with sec as (
    select sector_id from public.proyecto_ficha
    where boletin = p_boletin and sector_id is not null
  ),
  afavor as (
    select distinct v.parlamentario_id
    from public.voto v
    join public.votacion vo on vo.id = v.votacion_id
    where vo.boletin = p_boletin
      and v.seleccion = 'si'
      and v.estado_vinculo = 'confirmado'
      and v.parlamentario_id is not null
  )
  select cs.parlamentario_id, p.nombre_normalizado, cs.sector_id, s.etiqueta,
         cs.tipo_senal, cs.conteo, cs.evidencia, cs.fecha_captura
  from public.cruce_senal cs
  join sec on cs.sector_id = sec.sector_id
  join afavor a on a.parlamentario_id = cs.parlamentario_id
  join public.sector s on s.codigo = cs.sector_id
  join public.parlamentario p on p.id = cs.parlamentario_id
  order by cs.conteo desc, p.nombre_normalizado asc;
$$;
```

> **Provenance de este SQL:** `[ASSUMED]` como *propuesta* de shape — el planner/executor lo ajusta. Los **predicados de datos** (`seleccion='si'`, `estado_vinculo='confirmado'`, `proyecto_ficha.sector_id`, join keys) están `[VERIFIED: psql PROD]` (la simulación con exactamente este join produjo 47 filas para 14309-04). El ACL idiom está `[VERIFIED: 0048]`.

### Anti-Patterns to Avoid
- **Fabricar boletín→sector vía comisión** cuando no hay mapeo comisión→sector. Usar `proyecto_ficha.sector_id` (existe) o degradar a empty.
- **Copiar el degrade de `cruces-de-parlamentario.tsx`** (lanza en todo error): SURF está gated ON → usar el de `lobby-en-tramitacion.tsx` (PGRST202→null).
- **`grant … to anon`** en la migración → rompe lockdown-guard bloque A. Solo doble revoke, cero grant.
- **`.from('cruce_senal')`** desde el árbol público → rompe lockdown-guard bloque B (tabla PII). Solo vía la RPC.
- **Componer voto + reunión en una sola frase causal** o en un mismo `<li>/<article>` (anti-insinuación §9.1). Líneas separadas.
- **Contar `si` sin `estado_vinculo='confirmado'`** → arrastraría votos Senado por-nombre no confirmados (inflaría/fabricaría intersección).
- **Fecha del badge = fecha de la reunión** (WR-02): usar `fecha_captura` (nivel señal) para la frescura; `item.fecha` es solo texto factual.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Degrade RPC-ausente | try/catch por regex de mensaje | `error?.code === "PGRST202"` (lobby-en-tramitacion.tsx:260) | Un regex tragaría errores reales de schema (WR-01) |
| Proyección PII-safe | `.from('parlamentario').select('nombre')` | RPC security definer que emite `nombre_normalizado` | `parlamentario` es deny-by-default + PII_TABLE; el guard falla |
| Toggle capa-2 | nuevo componente cliente + fetch | `DetalleColapsable triggerVariant="primary" forceMount` sobre datos ya fetcheados | Cero lazy-fetch, cero RPC extra (UI-SPEC §Progressive disclosure) |
| Nombre display | lowercasing/titlecasing manual | `formatNombre` (F54) | Re-casea sin tocar la key React (nombre raw) |
| Provenance por fila | badge ad-hoc | `ProvenanceBadge` (fuente·fecha·enlace) | Idiom del repo, Mono/muted |

**Key insight:** El 100% de esta fase es composición de idioms existentes. El riesgo NO es técnico — es de **honestidad de datos** (cobertura baja, demo correcto, cero fabricación de sector) y **anti-insinuación** (copy sin causalidad, caveat 1×, PII-safe).

## Runtime State Inventory

> No es un rename/refactor, pero la RPC toca estado materializado. Inventario relevante:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `cruce_senal` (781 filas, rebuild diario cron `23 3 * * *`); `proyecto_ficha.sector_id` (65/74 poblado). La RPC solo LEE. | Ninguna — no muta datos. |
| Live service config | Ninguno — no crea cron ni cambia el existente. | None — verificado: la migración es solo `create function` + revokes. |
| OS-registered state | Ninguno. | None. |
| Secrets/env vars | `CRUCES_PUBLIC_ENABLED=true` (ya ON en PROD desde 2026-07-02). **NO se toca.** | None — el gate se consume, no se define. |
| Build artifacts | Ninguno. | None. |

**El apply de la DDL a PROD es estado NO alcanzado por deploy de código** → checkpoint operador (patrón 52-06). El agente escribe `0049_*.sql` + committea; el operador aplica con `psql --db-url --single-transaction`.

## Common Pitfalls

### Pitfall 1: Demo boletín sin sector → 0 filas
**What goes wrong:** Usar 14782-13 como demo-con-filas → renderiza empty (no tiene `proyecto_ficha`).
**How to avoid:** Demo = **14309-04** (47 parlamentarios, verificado). Documentar en el checkpoint que 14782-13 demuestra el **empty honesto**, no las filas.
**Warning signs:** La ficha demo muestra "sin registros" cuando se esperaban filas.

### Pitfall 2: pgTAP con datos PROD (semana 2091 gotcha, F52)
**What goes wrong:** Asserts que dependen de datos reales de PROD arrastran filas ajenas y flakean.
**How to avoid:** Sembrar fixture mínimo dentro de `begin;…;rollback;` (boletín BTEST, parlamentario PTEST, votación con voto 'si' confirmado, cruce_senal del sector). Espejo exacto de 0048 fixture. Nunca `select … from cruces_de_proyecto('14309-04')` en el assert.

### Pitfall 3: falso positivo de CI (build ≠ Postgres ejecutó el DDL)
**What goes wrong:** tsc/vitest verdes NO prueban que la RPC existe en PROD (falso positivo conocido, cabecera 0028/0047/0048).
**How to avoid:** La única prueba válida es el pgTAP post-apply corriendo contra el schema aplicado. El código degrada honesto (PGRST202) para que el build pase pre-apply.

### Pitfall 4: fecha_captura para frescura (WR-02/F41)
**What goes wrong:** Usar `item.fecha` (fecha de reunión, antigua) como capturedAt del badge → stale-amber falso.
**How to avoid:** `ProvenanceBadge.capturedAt = new Date(row.fecha_captura)` (nivel señal, proyectada por el RPC). `item.fecha` es solo texto factual "Reunión registrada el …".

### Pitfall 5: nunca aplicar a PROD
**What goes wrong:** El agente ejecuta la migración → viola el checkpoint operador.
**How to avoid:** Escribir `0049_*.sql` + pgTAP, committear, presentar el comando exacto en el checkpoint. JAMÁS `psql -f` de escritura ni `supabase db push`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x (`app/vitest.config.ts`) + RTL para componentes; pgTAP (psql) para DDL |
| Config file | `app/vitest.config.ts` |
| Quick run command | `cd app && pnpm test` (`vitest run`) |
| Full suite command | `cd app && pnpm test && pnpm exec tsc -b` (baseline **670** tests + tsc) |
| pgTAP runner | `psql -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql <db-url>` (operador, post-apply) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SURF-02 | RPC existe, security definer, doble-revoke deny anon, sin PII en returns | pgTAP (post-apply) | `psql -tA -f supabase/tests/0049_cruces_de_proyecto.test.sql` | ❌ Wave 0 |
| SURF-02 | RPC filtra sector del proyecto ∩ votos 'si' confirmados (fixture) | pgTAP (post-apply) | idem, asserts de datos con fixture rollback | ❌ Wave 0 |
| SURF-02 | CrucesView pura: filas → capa-1/2, 0 filas → empty honesto, nombre linkeado | RTL unit | `cd app && pnpm test cruces-de-proyecto` | ❌ Wave 0 |
| SURF-02 | CrucesSection degrada PGRST202→null, throw en otro error | RTL unit (mock rpc) | `cd app && pnpm test cruces-de-proyecto` | ❌ Wave 0 |
| SURF-02 | Banned-vocab: cero léxico causal en strings nuevos | vitest (negative-match) | `cd app && pnpm test` (test del componente) | ❌ Wave 0 |
| SURF-02 | `cruces_de_proyecto` en PUBLIC_RPC_ALLOWLIST; sin grant anon en >0044 | vitest (lockdown-guard) | `cd app && pnpm test lockdown-guard` | ✅ existe (extender allowlist) |
| SURF-02 | Página monta `#cruces` tras `#lobby-tramitacion`, rail entry "Cruces ◆" | RTL (page.test.tsx) | `cd app && pnpm test proyecto` | ✅ existe (extender) |

### Sampling Rate
- **Per task commit:** `cd app && pnpm test <archivo tocado>`
- **Per wave merge:** `cd app && pnpm test && pnpm exec tsc -b` (suite 670 + tsc + lockdown-guard + banned-vocab)
- **Phase gate:** suite completa verde + pgTAP escrito (corrido por operador post-apply) antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `supabase/migrations/0049_cruces_de_proyecto.sql` — la RPC (SURF-02)
- [ ] `supabase/tests/0049_cruces_de_proyecto.test.sql` — pgTAP post-apply (espejo 0048), fixture rollback
- [ ] `app/components/cruces-de-proyecto.tsx` — Section + View pura (espejo lobby-en-tramitacion.tsx)
- [ ] `app/components/cruces-de-proyecto.test.tsx` — RTL (capa-1/2, empty, degrade, banned-vocab)
- [ ] `app/lib/types.ts` — tipo `CruceProyectoRow` (PII-safe)
- [ ] Extender `app/lib/lockdown-guard.test.ts:165` — add `'cruces_de_proyecto'` a PUBLIC_RPC_ALLOWLIST
- [ ] Extender `app/app/proyecto/[boletin]/page.tsx` — `<section id="cruces">` + rail entry `{ id:"cruces", label:"Cruces", marker:"◆", accent:true }`
- [ ] Posible extensión de `FichaRail`/`RailEntry` para marker/accent (UI-SPEC §Rail entry) sin filtrar petróleo a otras entradas

## Security Domain

> `security_enforcement` no está en `.planning/config.json` como false → enabled. Esta fase ES seguridad-crítica (superficie pública PII-adjacente).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | RPC `security definer` + doble revoke + cero grant (Camino A); `cruce_senal`/`parlamentario` deny-by-default; lockdown-guard CI |
| V5 Input Validation | yes | `BOLETIN_RE` valida el path param antes de tocar DB (page.tsx:50); supabase-js parametriza `p_boletin` |
| V6 Cryptography | no | — |
| V8 Data Protection (PII) | yes | Ley 21.719: returns table nunca emite `rut/partido/email`; pgTAP assert 6; proyección `nombre_normalizado` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuga de PII (partido/rut) por la RPC | Information Disclosure | `returns table` solo derivado público; pgTAP `proargnames !~* '\y(partido\|rut\|email)\y'` |
| Re-exposición anon por DEFAULT PRIVILEGES | Elevation of Privilege | Doble revoke explícito (from public + from anon/authenticated); guard CI bloque A |
| Acceso directo a tabla PII desde el árbol público | Information Disclosure | `cruce_senal` en PII_TABLES; guard CI bloque B (solo vía RPC allowlisted) |
| Insinuación causal (daño reputacional) | — (legal/ético) | Caveat 1×; banned-vocab negative-match; conteo neutro; líneas separadas voto/reunión |
| Path injection en boletín | Tampering | `BOLETIN_RE.test(boletin)` → notFound (page.tsx:50) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RPC con `grant execute to anon` (0019/0020/0040) | Cero grant, sitio lee con service_role (Camino A) | 0044 aplicada (2026-06-26) | La nueva RPC NO lleva grant; el guard bloquea grants >0044 |
| Degrade por regex de mensaje | `error.code === "PGRST202"` exacto | WR-01 (F52) | Copiar lobby-en-tramitacion.tsx, no un try/catch amplio |
| Contraparte de lobby = texto plano no-enlazado (52-03) | Parlamentario público = LINK (52-03 aplica solo a contrapartes) | UI-SPEC §Departure | El sujeto de esta sección SÍ se enlaza a /parlamentario/[id] |

**Deprecated/outdated:**
- Usar 14782-13 como demo-con-filas: obsoleto (no tiene sector). Demo = 14309-04.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El shape propuesto de la RPC (8 columnas, una fila por parlamentario) es óptimo | RPC shape | Bajo — el planner puede ajustar columnas; los predicados de datos están verificados |
| A2 | `estado_vinculo='confirmado'` es el predicado correcto para "voto real del parlamentario" | Data reality #1 | Bajo — mismo predicado que 0048/0019 (idiom LOCKED del repo) |
| A3 | La cobertura baja (2 boletines con filas) es estado honesto esperado, no un dato faltante a ingerir en esta fase | Data reality #3 | Medio — si el operador espera más cobertura, es trabajo de ingesta (fuera de SURF-02); documentado como límite honesto |
| A4 | 47 filas para 14309-04 es aceptable para la demo (capa-2 truncada por discreción) | Demo | Bajo — el umbral de truncado es discreción de Claude (UI-SPEC) |

**Nota:** Los conteos de datos (781 cruce_senal, 65/74 sector, 47 filas demo, seleccion='si') están `[VERIFIED: psql PROD]`, no asumidos.

## Open Questions

1. **¿La demo debe mostrar filas o el empty honesto?**
   - Qué sabemos: 14309-04 da 47 filas; 14782-13 da empty (sin sector).
   - Recomendación: mostrar **14309-04** para las filas; opcionalmente 14782-13 para demostrar el empty honesto. El checkpoint final presenta ambas superficies.

2. **¿Extender `RailEntry` con `marker`/`accent`?**
   - Qué sabemos: la entrada "Cruces ◆" pide un marker petróleo (UI-SPEC §Rail entry); el rail actual (`page.tsx:199`) usa entries planas `{id,label,count}`.
   - Recomendación: el planner añade un prop mínimo `marker?`/`accent?` a `RailEntry` sin filtrar petróleo a las otras entradas (discreción documentada en UI-SPEC).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| psql | Aplicar/probar DDL (operador) | ✓ | miniconda `psql` | — |
| PROD DB (SUPABASE_DB_URL) | Research read-only + apply operador | ✓ | Postgres 15 (Supabase) | — |
| docker + wrangler | Deploy final (patrón caliente) | ✓ | Docker 24+ | Build en Linux/Docker (Windows worker roto — lección) |
| pgTAP | Correr `0049_*.test.sql` post-apply | ✓ (PROD tiene la extensión, usada por 0048) | — | — |

**Missing dependencies with no fallback:** ninguna.

## Sources

### Primary (HIGH confidence)
- `psql` read-only contra PROD (`SUPABASE_DB_URL`), 2026-07-07 — todos los conteos de datos (cruce_senal 781, proyecto_ficha.sector_id 65/74, demo 14309-04 = 47 filas, seleccion values, cobertura 25→2 boletines)
- `supabase/migrations/0048_lobby_en_tramitacion.sql` + `0047_rebeldias_honestas.sql` — idiom RPC post-Camino A (doble revoke, cero grant, security definer)
- `supabase/migrations/0039_cruce_senal.sql` + `0038_sector.sql` — schema cruce_senal + sector + proyecto_ficha.sector_id
- `supabase/tests/0048_lobby_en_tramitacion.test.sql` — idiom pgTAP (post-apply, fixture rollback, asserts de contrato/PII)
- `app/components/lobby-en-tramitacion.tsx:260` — precedente degrade PGRST202→null
- `app/components/cruces-de-parlamentario.tsx` — render evidencia.items[] + ProvenanceBadge
- `app/lib/lockdown-guard.test.ts:133,165` — PII_TABLES + PUBLIC_RPC_ALLOWLIST
- `app/app/proyecto/[boletin]/page.tsx` — mount point, rail, section pattern
- `app/lib/cruces-gate.ts` — gate `crucesPublicEnabled()` (ya ON)
- `docs/legal/SIGNOFF-senales-voto.md` — sign-off firmado, condiciones anti-insinuación
- `38-CONTEXT.md` + `38-UI-SPEC.md` — decisiones LOCKED + contrato visual aprobado

### Secondary (MEDIUM confidence)
- `app/lib/types.ts:311-353` — tipos `CruceSenalRpcRow`/`CruceEvidenciaItem` (base para el nuevo tipo)

## Metadata

**Confidence breakdown:**
- Data reality (sector mapping, demo, counts): **HIGH** — verificado con psql contra PROD
- RPC idiom (security/ACL/pgTAP): **HIGH** — espejo verbatim de 0047/0048 aplicados
- Frontend degrade + wiring: **HIGH** — espejo de lobby-en-tramitacion.tsx + UI-SPEC aprobado
- RPC shape exacto (columnas): **MEDIUM** — propuesto; predicados verificados, columnas ajustables por el planner

**Research date:** 2026-07-07
**Valid until:** 2026-07-14 (los conteos de PROD cambian con el rebuild diario del cron; el idiom es estable)
