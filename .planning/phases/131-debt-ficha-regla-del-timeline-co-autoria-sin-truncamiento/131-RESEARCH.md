# Phase 131: DEBT-FICHA — Regla del timeline (H-06) + co-autoría v2 (3.3) - Research

**Researched:** 2026-07-30
**Domain:** Codebase interno (Next.js App Router + Supabase/Postgres) + medición read-only contra PROD
**Confidence:** HIGH (todo verificado en el árbol y por `psql -tA` contra PROD; cero web research)

---

## Summary

Las dos deudas quedaron **medidas y explicadas**, no estimadas.

**H-06.** La regla del timeline NO vive en SQL: la página `/proyecto/[boletin]` lee
`tramitacion_evento` con un `.from(...).select("*").eq("boletin",…).order("fecha")` directo
(`app/app/proyecto/[boletin]/page.tsx:459-465`) — **no hay RPC**. Toda la regla de selección vive
en `construirItems()` de `app/components/timeline-view.tsx:139-224`. Reproduje esa regla en SQL
contra PROD y **explica la brecha exactamente**: de los 99 eventos de `14309-04`, **14 quedan
absorbidos en 5 períodos de urgencia colapsados** ⇒ `99 − 14 = 85` líneas `Hito del`. Cierre exacto,
sin residuo.

**Pero apareció un DEFECTO REAL (D-03)**, y es más grave que la brecha: el conteo **no es
determinista**. La consulta ordena sólo por `fecha` y el boletín tiene 99 eventos sobre **48 fechas
distintas** (empates masivos). Como el colapso exige **contigüidad**, el desempate cambia los runs:
medido en PROD, los eventos absorbidos son **14 / 12 / 12 / 16** según el criterio de desempate
(`fecha` sola / `fecha,id desc` / `fecha,descripcion` / `fecha,ctid desc`). Es decir, `85` es un
número que depende del orden físico que Postgres devuelva ese día. La regla escrita **debe declarar
un orden total determinista** (`fecha asc, id asc`) y el `.order()` de la página debe adoptarlo —
fix localizado, cabe en D-03.

**3.3 co-autoría.** La RPC viva es `public.coautores_de_parlamentario(text)`, definición FINAL en
`supabase/migrations/0064_bounded_rpc_statement_timeout.sql:259-291`, con **`limit 20`** (L286) y
`total_n` honesto vía `count(*) over ()`. Medido en PROD: el **máximo real de coautores de un
parlamentario es 101**, y **153 de 180** parlamentarios con autoría confirmada superan el cap de 20
(85 %). El piso de 1.000 de D-05 cubre el universo con **9,9x** de margen bajo el criterio ya escrito
en `0079` ("techo ≥ 4x el máximo medido, nunca menor a 1.000"). Testigo de truncamiento **mucho más
fuerte que el del audit**: `D1178` (Héctor Ulloa Aguilera) × `D1099` (Jaime Araya Guerrero)
**co-firman 92 boletines** y hoy `/comparar` declara *"…no permiten determinar si comparten proyectos
co-firmados"* porque cada uno cae fuera del top-20 alfabético del otro (rango 45/91 y 38/82).

**Primary recommendation:** una migración con **dos piezas** —`coautores_de_parlamentario_v2` (firma
paralela, `limit 1000`, aguja completa de `0079`) y la **regla del timeline como función SQL
`hitos_de_boletin` o como archivo `.sql` documental + test de paridad**— más el cambio del
`.order("fecha")` a orden total determinista. El planner debe elegir explícitamente entre función SQL
y `.sql` documental (ver §Architecture Patterns, Pattern 1).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**H-06 — regla del timeline (DEBT-03)**
- **D-01:** La regla de selección (qué eventos de `tramitacion_evento` se vuelven "Hito del …" en
  la ficha) se ESCRIBE como query SQL con su criterio declarado en comentario (qué tipos entran,
  qué se agrupa, qué se excluye y POR QUÉ) — hoy la regla vive implícita en código TS/SQL disperso.
  Dónde vive la query escrita (view NO — exigiría security_invoker y es superficie nueva; función
  existente/archivo .sql documental + test de paridad) lo adjudica el research según dónde viva hoy
  la selección real.
- **D-02:** La query explica la brecha del testigo: `14309-04` tiene 99 eventos y el render muestra
  85 `Hito del` — la diferencia debe quedar CONTADA por el criterio (p.ej. "14 eventos de tipo X se
  agrupan/excluyen por Y"), no declarada "esperable". Paridad query↔DOM sobre el testigo por conteo
  exacto (gotcha: HTML de 1 línea ⇒ `grep -o | wc -l`; React intercala `<!-- -->` ⇒ extracción
  numérica, no literal con dígitos).
- **D-03:** Si al escribir la regla aparece un DEFECTO real de selección (evento que debería
  mostrarse y no se muestra), se documenta y corrige SOLO si es localizado; si exige rediseño,
  se registra como deuda nueva con evidencia — el criterio de la fase es la regla escrita + paridad.

**3.3 — co-autoría v2 (DEBT-04)**
- **D-04:** RPC `coautores_de_parlamentario` VIVA queda intacta (42P13 re-arma default privileges —
  jamás alterar `returns table`). Se crea firma v2 PARALELA (precedente 0060
  `parlamentario_publico_v2`): emite membresía de par COMPLETA (sin `limit 20` silencioso).
- **D-05:** Aguja completa (regla LOCKED): cero-grant, secdef `search_path=''`,
  `statement_timeout`, LIMIT piso 1.000 declarado (si el universo de coautores de un par supera el
  límite, el copy declara "N de M" — cero truncamiento SILENCIOSO; el research mide el máximo real),
  doble-revoke, `PUBLIC_RPC_ALLOWLIST`, pgTAP contra schema aplicado.
- **D-06:** `/comparar` consume la v2: conteo mostrado == recálculo SQL de PROD (`psql -tA` +
  `tr -d '\r'`); si el render recorta, "N de M" con total honesto. La RPC vieja sigue funcional
  (otros call-sites NO se migran en esta fase salvo que compartan el defecto — research los lista).
- **D-07:** Copy nuevo pasa el linter anti-insinuación (carril RELACIONES ya escanea
  `app/comparar/page.tsx`); cero vocabulario de afinidad; la co-autoría es hecho DECLARADO por
  fuente oficial.

**Régimen**
- **D-08:** Numeración de migración: siguiente número libre al momento de crear (después de 0080
  de 127 y la de 130 si ya existe — coordinar por `ls supabase/migrations`; en worktree paralelo,
  la numeración se resuelve al MERGEAR: si colisiona, renombrar antes de aplicar — las migraciones
  se aplican desde master, jamás desde el worktree).
- **D-09:** Suite + guards de régimen verdes (runner `pnpm guards` de 126 + guard-of-the-guards).

### Claude's Discretion
- Nombre de la v2 (sugerencia: `coautores_de_parlamentario_v2`).
- Forma del test de paridad timeline (unit sobre builder TS vs psql+DOM contra deploy — mínimo el
  unit; el DOM real puede quedar para 138 E2E si el deploy no ocurre en esta fase).

### Deferred Ideas (OUT OF SCOPE)
- Migrar otros call-sites de la RPC vieja de co-autoría (si los hay y no comparten el defecto).
- Rediseño del timeline (solo regla escrita + paridad en esta fase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-03 (H-06) | La regla de selección del timeline queda gobernada por una query escrita (85 `Hito del` vs 99 eventos en `14309-04`), con su criterio declarado. | §H-06: camino del dato completo con líneas exactas; regla reproducida en SQL contra PROD que cierra 99−14=85 EXACTO; desglose de los 5 períodos; defecto de determinismo medido (14/12/12/16) con su fix localizado. |
| DEBT-04 (fila 3.3) | La co-autoría de `/comparar` emite membresía de par (RPC v2 paralela — precedente `0060`, jamás alterar la viva `42P13`), sin truncamiento silencioso a 20. | §3.3: definición viva con línea del `limit 20`; máximo real medido (101) que justifica el piso 1.000 bajo el criterio de `0079`; testigo `D1178×D1099` = 92 boletines hoy invisibles; call-sites listados; aguja completa verbatim. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD enforcement:** cero edición fuera de un comando GSD (`/gsd:execute-phase`).
- **Verificaciones a PROD:** `psql -tA` + `tr -d '\r'` (PostgREST capa a 1.000 filas — conteo por
  REST PROHIBIDO; ver `0079` cabecera y memoria v6.1).
- **Migraciones:** `psql --db-url` explícito, jamás `supabase db push`; la única prueba de que
  Postgres ejecutó el DDL es el **pgTAP contra el schema aplicado**.
- **Camino A:** el sitio lee con `service_role` (bypassa ACL/RLS) ⇒ el guard CI es la única
  protección → toda RPC nueva DEBE entrar a `PUBLIC_RPC_ALLOWLIST` o el guard falla.
- **Fechas:** `tramitacion_evento.fecha` es `timestamptz` **date-only disfrazado** (medianoche UTC).
  **JAMÁS `at time zone 'America/Santiago'`** en ninguna query nueva (correría el día).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regla de selección del timeline (qué es "Hito del") | Frontend Server (RSC) — `construirItems()` en `timeline-view.tsx` | Database (query escrita espejo) | Hoy vive 100 % en TS. La query escrita es el **contrato declarado + oráculo de paridad**, no la fuente ejecutable — moverla a SQL ejecutable rompería `TramitacionStepper` que consume el MISMO constructor. |
| Orden total determinista de eventos | Database (`.order()` de la lectura) | Frontend Server (sort estable) | El empate por `fecha` sólo se puede fijar en el `order by`; el sort JS es estable y **hereda** el orden de entrada. |
| Membresía de par de co-autoría | Database (RPC secdef) | Frontend Server (`interseccionPar`) | Riesgo #1 (ausencia falsa con atribución de fuente) ⇒ el cap debe morir en la DB, no maquillarse en el cliente. |
| Copy de completitud ("N de M") | Frontend Server (`app/comparar/page.tsx`) | — | El total honesto ya viaja en `total_n`; el cliente sólo lo declara. |

---

## Standard Stack

Sin dependencias nuevas. Todo el trabajo cae en el stack ya presente.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL / Supabase | 15+ | RPC secdef `coautores_de_parlamentario_v2` | Precedente `0060`/`0064`/`0079` en el repo `[VERIFIED: repo]` |
| pgTAP | (ya instalado, schema `extensions` tras 123) | Prueba de la migración contra el schema APLICADO | Regla LOCKED del proyecto `[VERIFIED: 0079 cabecera]` |
| Vitest | 3.2.6 (`app/package.json:55`) | Unit de paridad timeline + guards | `[VERIFIED: repo]` |
| Next.js App Router / RSC | 16.x | `/proyecto/[boletin]`, `/comparar` | `[VERIFIED: repo]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Función SQL `hitos_de_boletin(text)` | Archivo `.sql` documental + test de paridad | La función es **superficie nueva** (exige entrada al allowlist + doble-revoke + pgTAP) y hoy **nadie la llamaría** (la página lee la tabla directa). El `.sql` documental no puede ejecutarse desde CI contra PROD sin credenciales. Ver Pattern 1. |
| `create view` | (prohibido) | D-01 lo veta y el guard `create-view-guard.test.ts` de 126 exige `security_invoker` — superficie nueva sin necesidad. |

**Installation:** ninguna.

## Package Legitimacy Audit

**No aplica** — esta fase no instala ningún paquete externo (cero cambios en `package.json` /
`pnpm-lock.yaml`). Slopcheck no corresponde.

---

## H-06 — El camino del dato, con líneas exactas

### 1. Lectura (NO hay RPC)

`app/app/proyecto/[boletin]/page.tsx:451-476` — `TramitacionSection`:

```
L459-465:  sb.from("tramitacion_evento")
             .select("*")
             .eq("boletin", boletin)
             .order("fecha", { ascending: true })
L477:      const eventos = (data as TramitacionEventoRow[]) ?? [];
```

`[VERIFIED: repo]` **No existe ninguna RPC de eventos de tramitación.** La tabla se define en
`supabase/migrations/0008_tramitacion.sql:68-108` (índice `tramitacion_evento_boletin_idx (boletin,
fecha)`; policy `to anon` dropeada en `0044`, lectura vía `service_role`). Consecuencia para D-01: no
hay "función existente" donde alojar la regla — la decisión es función NUEVA vs `.sql` documental.

**Columnas reales de `tramitacion_evento`** `[VERIFIED: PROD information_schema]`:
`id, boletin, fecha, camara, tipo, descripcion, enlace, origen, fecha_captura`.
Hay `id` ⇒ **existe una clave de desempate estable disponible**.

### 2. La regla implícita — `app/components/timeline-view.tsx`

| Pieza | Líneas | Qué hace |
|---|---|---|
| `fechaValida()` | L64-69 | `new Date(raw)` + `fechaPlausible` → `null` si implausible (F-04, typo `2626-05-25`). **No filtra**: sólo afecta orden y rangos. |
| `esEventoUrgencia()` | L76-81 | `tipo === 'urgencia'` **OR** (`tipo === 'tramite'` **AND** `/urgencia/i` en `descripcion`). |
| `esRetiroUrgencia()` | L89-91 | `/retira/i` en `descripcion`. Un retiro **corta el run** y se renderiza normal. |
| `tipoUrgenciaKey()` | L96-103 | `tipo='urgencia'` → `descripcion` cruda en minúscula; `tramite` → captura `/urgencia\s+([^.,;]+)/i`; fallback `"urgencia"`. |
| `construirItems()` | **L139-224** | **LA REGLA**. Sort (implausibles al FINAL, WR-02), luego barrido: colapsa **runs CONTIGUOS** de urgencia-no-retiro con la MISMA `tipoUrgenciaKey` y **longitud ≥ 2** en un `periodo`; todo lo demás es `{kind:"evento"}`. |
| `TimelineView` render | L260-345 | `items.map`: `kind==="evento"` → `<TimelineEvent>`; `kind==="periodo"` colapsado → **una `<li>` de texto** `"Urgencia {tipo}: N eventos …"`; expandido (`?urgencias=uN`) → despliega sus `TimelineEvent`. |
| `"Hito del"` | `app/components/timeline-event.tsx:102` | **Única emisión** del literal en todo el árbol de producción `[VERIFIED: grep repo]`. Uno por `TimelineEvent` renderizado. |

**Nada se excluye del render.** La brecha es 100 % **agrupación**, cero filtrado.

### 3. La brecha 99→85, CONTADA (PROD, `psql -tA | tr -d '\r'`)

```
count(*) tramitacion_evento where boletin='14309-04'  →  99
por tipo: tramite 55 | urgencia 25 | votacion 7 | informe 6 | oficio 6
fechas nulas o implausibles                           →  0
fechas DISTINTAS                                      →  48   ← empates masivos
```

Regla reproducida en SQL (gaps-and-islands sobre `row_number() over (order by fecha asc)`):

| métrica | valor |
|---|---|
| eventos de urgencia colapsables (urgencia y **no** retiro) | **33** |
| eventos de urgencia que son RETIRO (nunca colapsan) | **17** |
| eventos absorbidos en runs de longitud ≥ 2 | **14** |
| períodos generados | **5** |

```
99 eventos − 14 absorbidos = 85 líneas "Hito del"   ✅ cierre EXACTO, residuo 0
```

Los 5 períodos `[VERIFIED: PROD]`:

| tipo (`ukey`) | eventos | desde | hasta |
|---|---|---|---|
| discusión inmediata | 2 | 2021-12-21 | 2022-01-04 |
| suma | 2 | 2026-05-06 | 2026-05-06 |
| suma | 2 | 2026-05-20 | 2026-06-03 |
| suma | 2 | 2026-06-09 | 2026-06-09 |
| suma | 6 | 2026-06-16 | 2026-07-07 |

Los otros `33 − 14 = 19` eventos de urgencia colapsables quedan **aislados** (los 17 retiros les
cortan los runs) y se renderizan como hito normal — por eso 33 urgencias no producen 33 ocultamientos.

### 4. 🔴 DEFECTO REAL encontrado (D-03): el 85 no es determinista

`.order("fecha", {ascending:true})` **sin desempate** + 99 eventos sobre 48 fechas ⇒ el orden dentro
de un empate lo decide Postgres (plan/heap/vacuum), no el código. Y como el colapso exige
**contigüidad**, el desempate **cambia el resultado**. Medido en PROD variando sólo el `order by`:

| orden | eventos absorbidos | `Hito del` resultante |
|---|---|---|
| `fecha asc` (el actual) | **14** | **85** |
| `fecha asc, id desc` | 12 | 87 |
| `fecha asc, descripcion asc` | 12 | 87 |
| `fecha asc, ctid desc` | 16 | 83 |

El sort de `construirItems` (L155-163) es estable (ES2019) ⇒ **hereda** el orden de entrada, no lo
corrige. Conclusión: el número de hitos de la ficha puede cambiar entre deploys/vacuums **sin que
cambie un solo dato**. Esto es exactamente el tipo de defecto que D-03 manda corregir si es
localizado — y **lo es**: añadir `.order("id", {ascending:true})` como segundo criterio en
`page.tsx:465` y declarar ese orden total en la regla escrita. Costo: 1 línea + el mismo desempate
en el SQL de paridad.

**Advertencia al planner:** la regla escrita se debe fijar **sobre el orden nuevo**. Si se escribe la
query con `order by fecha, id` el conteo de referencia deja de ser 85 y pasa a **87** (`fecha asc, id
asc`: medir en el plan; `id desc` dio 12 absorbidos, `id asc` debe medirse explícitamente antes de
hornear ningún número en un test). **No hornear 85 ni 87 sin re-medir** tras fijar el orden.

### 5. `fecha` es date-only disfrazado

`data_type = timestamp with time zone` `[VERIFIED: PROD]`, pero el proyecto tiene LOCKED que el día
publicado vive en la parte **UTC** (`timeline-view.tsx:30-40` documenta el `timeZone:'UTC'` explícito
del formatter; memoria v9.0 gotcha mayor). **Cero `at time zone` en la query nueva.** Para el desglose
por día usar `fecha::date` (que en `timestamptz` usa el `TimeZone` de la sesión — si el plan necesita
la parte día, usar `(fecha at time zone 'UTC')::date`, que es la ÚNICA conversión permitida y
preserva el día publicado). Las agrupaciones de la regla NO necesitan la parte día: operan sobre
orden, no sobre calendario.

---

## 3.3 — Co-autoría: la RPC, su cap y la medición

### 1. Dónde vive y cuál es la definición VIVA

`coautores_de_parlamentario(text)` se re-emite tres veces `[VERIFIED: grep repo]`:

| migración | líneas | qué cambia |
|---|---|---|
| `0060_bio_partido_publico.sql` | 270-300 | primera definición |
| `0061_cross_links_conteo_honesto_orden.sql` | 147-179 | añade `total_n` (conteo honesto pre-cap) + orden |
| **`0064_bounded_rpc_statement_timeout.sql`** | **259-291** | **definición FINAL viva** — añade `set statement_timeout='5s'` |

Firma viva (`0064:261-262`):

```sql
create or replace function public.coautores_de_parlamentario(p_id text)
returns table (id text, nombre text, camara text, n_proyectos int, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
```

**El cap está en `0064:286`: `limit 20`** (orden `order by nombre`). `total_n` sale de
`count(*) over ()` (L275) — el total ES honesto; lo que se pierde es la **membresía**.
Doble-revoke en L290-291. `[VERIFIED: repo]`

*(El `limit 20` de `copartidarios` que menciona el CONTEXT es de otra función; el de coautores es el
de `0064:286`. Ambos son 20.)*

### 2. Medición en PROD `[VERIFIED: psql -tA + tr -d '\r']`

| métrica | valor |
|---|---|
| parlamentarios con autoría confirmada | **180** |
| **máximo de coautores distintos de un parlamentario** | **101** |
| parlamentarios con > 20 coautores (⇒ lista truncada) | **153** (85,0 %) |
| parlamentarios con > 1.000 coautores | **0** |

**Techo derivado bajo el criterio ya escrito en `0079` (≥ 4x el máximo medido, nunca < 1.000):**
`4 × 101 = 404 < 1.000` ⇒ **techo = 1.000** (piso), margen **9,9x**. Coincide con D-05 sin tensión.
Dominio medido: **100 %** (los 180 parlamentarios), no una muestra.

### 3. El testigo del truncamiento

El audit citó `D1165 × S1338` (48 / 21 coautores; SQL dice **0** compartidos, el sitio declara
indeterminación → *falsa indeterminación sobre una ausencia real*). Ese caso **no muestra el daño
máximo**. Encontré uno mucho más fuerte `[VERIFIED: PROD]`:

| par | quiénes | boletines co-firmados | rango alfabético A→B | rango B→A | qué muestra hoy |
|---|---|---|---|---|---|
| **`D1178` × `D1099`** | **Héctor Ulloa Aguilera** × **Jaime Araya Guerrero** | **92** | **45** de 91 | **38** de 82 | *"…no permiten determinar si comparten proyectos co-firmados"* |
| `D1157` × `D1166` | Marlene Pérez Cartes × Natalia Romero Talguia | 79 | 51 de 64 | 54 de 70 | idem |
| `D1178` × `D1077` | Héctor Ulloa Aguilera × — | 74 | 80 de 91 | 22 de 50 | idem |

**Usar `D1178 × D1099` como testigo de la fase**: 92 proyectos co-firmados invisibles hoy, y con la
v2 (`limit 1000`) ambas listas quedan COMPLETAS (91 y 82 < 1.000) ⇒ `interseccionPar` devuelve
`presente` y el copy pasa a *"Comparten 92 proyectos co-firmados"*.

**Propiedad importante para el plan:** con `limit 20` el defecto SOLO puede producir
**`indeterminado`**, nunca un **`ausente` falso**. Razón: `listaCompleta()` (`comparar/page.tsx:586-590`)
declara completa una lista sólo si `length < 20` — y si A tiene < 20 coautores su lista está completa
y **contiene** a B si son coautores. Es la disciplina fail-closed CR-01 funcionando. El fix no
corrige una mentira; **corrige un silencio**.

### 4. Call-sites de la RPC vieja (D-06)

| archivo | línea | uso | ¿comparte el defecto? |
|---|---|---|---|
| `app/app/comparar/page.tsx` | **121** (`getCoautores`), consumido en **401-405** | decide **membresía de par** vía `interseccionPar` | **SÍ — es el defecto.** Migrar a v2. |
| `app/app/parlamentario/[id]/page.tsx` | **201** (`crossLinkReader("coautores_de_parlamentario")`) | lista "top 20 alfabético" + `totalReal(filas)` = `total_n` honesto (`:363-366, 423, 439`) | **NO.** Es el molde WR-01 legítimo (muestra 20 de M declarando M). **Deferred** por CONTEXT. |
| `app/app/comparar/page.test.tsx` | 77, 226, 305, 486 | mocks | actualizar al nombre v2 |
| `app/lib/lockdown-guard.test.ts` | 203 | allowlist | **añadir la v2**, mantener la vieja |

**La RPC vieja queda intacta y funcional** (SC#4): `parlamentario/[id]` la sigue usando.

### 5. Constantes que el plan debe tocar en `/comparar`

```
:578  const CAP_RPC = 20;              // cap de 0061/0067 (militancia + coautoría)
:583  const CAP_RPC_COMISIONES = 50;
:586  listaCompleta()   → filas.length < CAP_RPC
:594  totalHonesto()    → filas[0].total_n
:605  interseccionPar() → presente / ausente / indeterminado
:401  coautPar = interseccionPar(coautA, b, coautB, a)
:432  copy de indeterminación citando CAP_RPC
```

⚠️ **`CAP_RPC` es COMPARTIDO con el eje de militancia histórica** (`:261-283`, RPC `0067`, que sigue
en `limit 20`). Si el plan cambia `CAP_RPC` a 1000 **rompe la disciplina del eje 2 de militancia**
(declararía completas listas truncadas a 20). **Introducir una constante separada**
`CAP_RPC_COAUTORES = 1000` y usarla sólo en el eje 3, dejando `CAP_RPC = 20` para militancia.
Esto es el bug más probable de la fase.

---

## Architecture Patterns

### System Architecture Diagram

```
                 ┌──────────────────────── H-06 ────────────────────────┐
 request /proyecto/[boletin]
        │
        ▼
 TramitacionSection (RSC)  page.tsx:451
        │  sb.from("tramitacion_evento").select("*").eq(boletin)
        │      .order("fecha")            ← 🔴 orden NO total (empates)
        │      .order("id")               ← ✅ fix D-03 (determinismo)
        ▼
 eventos: TramitacionEventoRow[]  (99 para 14309-04)
        │
        ├──► derivarEstadoActual ──► TramitacionStepper (capa-1, mismo constructor)
        │
        ▼
 construirItems()  timeline-view.tsx:139         ┌── REGLA ESCRITA (nueva) ──┐
   sort estable (implausibles al final)          │ archivo .sql con criterio │
   run contiguo urgencia-no-retiro, mismo tipo   │ declarado + query espejo  │
   longitud ≥ 2 ? periodo : evento               │  ← test de PARIDAD →      │
        │                                        └───────────────────────────┘
        ▼
 items ──► kind="evento"  → <TimelineEvent> → "Hito del …"   (85)
       └─► kind="periodo" → 1 <li> "Urgencia X: N eventos"   (5, absorben 14)


                 ┌──────────────────────── 3.3 ─────────────────────────┐
 request /comparar?a=D1178&b=D1099
        │
        ├─► getCoautores(a) ─┐
        ├─► getCoautores(b) ─┤ rpc coautores_de_parlamentario  limit 20  🔴
        │                    │        ▼ (fase 131)
        │                    └─ rpc coautores_de_parlamentario_v2 limit 1000 ✅
        ▼
 interseccionPar(listaA, b, listaB, a)   page.tsx:605
   match en cualquiera de las 2 direcciones → PRESENTE
   alguna lista completa                   → AUSENTE
   ninguna completa                        → INDETERMINADO  ← hoy, con 92 reales
        ▼
 copy: "Comparten 92 proyectos co-firmados."  +  columnas con total_n (N de M)
```

### Pattern 1 — Dónde vive la "query escrita" (adjudicación pedida por D-01)

**Recomendación: archivo `.sql` documental ejecutable + test de paridad TS. NO función SQL nueva.**

Razones, en orden:
1. **No hay consumidor.** La página lee la tabla directa; una función `hitos_de_boletin()` nacería
   sin llamador. Una RPC no invocada es superficie nueva bajo Camino A (service_role la puede
   ejecutar) que exige entrada al allowlist, doble-revoke, `statement_timeout`, LIMIT y pgTAP — todo
   coste, cero uso.
2. **`TramitacionStepper` comparte el constructor** (`timeline-view.tsx:132-137` lo dice explícito:
   "una sola fuente de verdad"). Mover la regla a SQL ejecutable la duplicaría o rompería capa-1.
3. **D-01 veta `create view`** y el guard de 126 (`create-view-guard.test.ts`) muerde igual.

Forma concreta sugerida al planner:

```
supabase/queries/timeline-regla-de-seleccion.sql   ← criterio declarado en comentario + query
app/components/timeline-view.regla.test.ts         ← paridad: fixture ↔ conteo esperado
```

*(Alternativa aceptable: alojar el archivo en `.planning/phases/131-…/131-REGLA-TIMELINE.sql`. El
planner elige; lo que NO es negociable es que la query sea **ejecutable tal cual por `psql`** contra
PROD y que exista un test que la ate al builder TS.)*

⚠️ **Si el planner opta por función SQL igualmente**, entonces aplica la aguja completa de D-05
(cero-grant, secdef `search_path=''`, `statement_timeout`, LIMIT declarado, doble-revoke, allowlist,
pgTAP) — y debe consumirse desde `page.tsx`, o el guard "allowlist sin call-site" no la justifica.

### Pattern 2 — Firma v2 paralela (precedente `0060:44-56`)

```sql
-- Firma NUEVA paralela a 0064 (no altera la viva: cambiar su `returns table` dispararía
-- 42P13 y re-armaría default privileges). Mismas columnas que CrossLinkRow.
drop function if exists public.coautores_de_parlamentario_v2(text);

create or replace function public.coautores_de_parlamentario_v2(p_id text)
returns table (id text, nombre text, camara text, n_proyectos int, total_n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select … count(*) over () as total_n …
  order by nombre
  limit 1000;   -- techo: max medido 101 (100% del dominio, 180 parlamentarios) → piso 1000, 9.9x
$$;

revoke all on function public.coautores_de_parlamentario_v2(text) from public;
revoke all on function public.coautores_de_parlamentario_v2(text) from anon, authenticated;
```

El cuerpo se copia **verbatim** de `0064:263-287` cambiando SOLO el `limit`. Cero drift semántico.

### Pattern 3 — Techo derivado de medición (precedente `0079` cabecera)

La migración debe llevar la tabla `función | clase | máximo medido | techo | margen` con la consulta
de medición y la fecha, tal como `0079:29-42`. **Y debe decir lo que la aserción NO prueba** (`0079`
lo hace: con el techo derivado del máximo, `medido < techo` es tautológico hoy; su valor es cazar
deriva futura). Esa honestidad es parte del estándar del repo.

### Anti-Patterns to Avoid

- **Alterar `coautores_de_parlamentario` viva** → `42P13` + re-arma default privileges = superficie
  REST re-abierta. D-04 lo prohíbe.
- **Subir `CAP_RPC` global a 1000** → rompe la disciplina del eje de militancia histórica (`0067`,
  sigue en 20). Constante separada.
- **Hornear "85" en un test tras cambiar el orden** → el número cambia con el desempate. Re-medir.
- **`at time zone 'America/Santiago'`** sobre `tramitacion_evento.fecha` → corre el día.
- **`create view`** para la regla del timeline → vetado por D-01 y por el guard de 126.
- **Contar `Hito del` con `grep -c`** sobre el HTML del Worker → tope 1 (HTML de 1 línea). Usar
  `grep -o … | wc -l`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decidir membresía de par sobre listas cap-eadas | lógica nueva en el eje 3 | `interseccionPar` / `listaCompleta` / `totalHonesto` ya escritos (`comparar/page.tsx:586-618`) | Ya implementan CR-01 (dos direcciones + fail-closed). Sólo cambian los datos que reciben. |
| Total honesto pre-cap | `count(*)` en un segundo round-trip | `count(*) over ()` → `total_n` (ya en la firma) | Molde WR-01, una sola pasada. |
| Agrupación de urgencias en SQL | re-derivar la heurística | gaps-and-islands sobre `row_number()` (query de §H-06.3, ya validada = 14) | Reproduce el TS al evento exacto. |
| Aguja de RPC nueva | inventar el checklist | copiar `0079` + `0060` verbatim | 7 elementos LOCKED; omitir uno = guard rojo. |

**Key insight:** esta fase no inventa nada. Cada pieza tiene un precedente **escrito y aplicado** en
el repo; el trabajo es transcripción disciplinada + una medición que ya está hecha en este documento.

---

## Runtime State Inventory

Fase de RPC aditiva + cambio de código; no es rename/migración de datos. Aun así, por el régimen:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Ninguno** — la v2 es `stable`, sólo lectura; cero escritura, cero backfill. Verificado: la migración no altera datos. | ninguna |
| Live service config | **Ninguno** — no hay cron nuevo; `grep "cron.schedule"` debe dar 0 en la migración nueva (mismo control que `127-01-PLAN.md:144`). | ninguna |
| OS-registered state | **Ninguno** — verificado: la fase no toca Task Scheduler ni workflows. | ninguna |
| Secrets/env vars | **Ninguno** — sin claves nuevas; `SUPABASE_DB_URL` ya existe en `.env`. | ninguna |
| Build artifacts | **Ninguno de la fase.** Nota: `app/.next/` contiene chunks stale que mencionan `TramitacionStepper` — ruido de build, no estado a migrar. | ninguna |

**Estado vivo relevante que SÍ hay que recordar:** la RPC vieja **queda en PROD** y sigue siendo
llamada por `/parlamentario/[id]`. La migración es **aditiva pura**; no hay rollback de datos.

---

## Common Pitfalls

### Pitfall 1: `CAP_RPC` compartido
**Qué sale mal:** subir `CAP_RPC = 20 → 1000` para el eje de co-autoría también reclasifica como
"completas" las listas de **militancia histórica** (`0067`, sigue en `limit 20`) → `listaCompleta()`
devuelve `true` con 20 filas de 20 → el eje 2 pasa a declarar **AUSENCIA FALSA** con atribución de
fuente. Riesgo #1 del proyecto, introducido por el fix del riesgo #1.
**Cómo evitar:** constante separada `CAP_RPC_COAUTORES = 1000`; `CAP_RPC` intacto.
**Señal temprana:** cualquier diff que toque `:578` sin tocar `:314`/`:283`.

### Pitfall 2: hornear el 85 tras arreglar el orden
**Qué sale mal:** el test de paridad afirma 85 mientras el código ya ordena `fecha,id` (que da otro
número) → falso verde o falso rojo según el día.
**Cómo evitar:** fijar el orden PRIMERO, re-medir en PROD, y hornear ese número **en un solo lugar**
citado por el test y por el `.sql`.
**Señal temprana:** `85` aparece literal en más de un archivo.

### Pitfall 3: contar `Hito del` en el DOM
**Qué sale mal:** el HTML del Worker es **una línea** ⇒ `grep -c` topa en 1 (memoria v12 gotchas).
React intercala `<!-- -->` entre texto y `<span>` ⇒ `grep -F "Hito del 7 jul"` da 0.
**Cómo evitar:** `grep -o 'Hito del' archivo.html | wc -l`; y para fechas, extracción numérica, nunca
literal con dígitos.

### Pitfall 4: `vitest run` con glob
**Qué sale mal:** `vitest run components/*timeline*.test.tsx` sale **0 sin correr nada** (memoria v12).
**Cómo evitar:** nombres explícitos, como hace `package.json:14`.

### Pitfall 5: la migración "aplicada" sin prueba
**Qué sale mal:** `tsc`/build no prueban que Postgres ejecutó el DDL (Pitfall 6 de `0060`).
**Cómo evitar:** pgTAP contra el schema APLICADO (`supabase/migrations/00XX_*.test.sql`, patrón de
`0060/0061/0067/0068`), corrido con `psql -tA -f`.

### Pitfall 6: `pipefail` + `grep -q`
**Qué sale mal:** exit 141 (SIGPIPE) enmascarado como fallo. Memoria v12.
**Cómo evitar:** no encadenar `grep -q` tras un productor largo bajo `set -o pipefail`.

### Pitfall 7: numeración de migración en worktree
**Qué sale mal:** 131 corre en worktree paralelo a 130; ambas reclaman `0081`.
**Cómo evitar (D-08):** `ls supabase/migrations` al MERGEAR; renombrar antes de aplicar; aplicar
SIEMPRE desde master. Estado hoy: **0080 reservada por 127** (`127-01-PLAN.md:8`,
`0080_actualidad_evidencia.sql`), **130 aún sin plan → sin número reclamado**; el último aplicado es
`0079`. **Sin huecos entre 0060 y 0079.** ⇒ 131 debería tomar **0082** asumiendo que 130 toma 0081;
confirmar al mergear.

---

## Code Examples

### Query espejo de la regla (validada contra PROD — da 14 absorbidos / 5 períodos)

```sql
-- REGLA DE SELECCIÓN DEL TIMELINE (espejo de construirItems, timeline-view.tsx:139)
-- ENTRA: todo evento de tramitacion_evento del boletín. NADA se excluye.
-- SE AGRUPA: runs CONTIGUOS (en el orden total declarado) de eventos de urgencia
--   que NO son retiro y comparten tipo normalizado, con longitud >= 2.
-- POR QUÉ: la renovación repetitiva de urgencia enterraba la señal estructural
--   (Pitfall 3 LOCKED). Un retiro NO es una renovación → corta el run.
-- ORDEN TOTAL DECLARADO: (fecha asc, id asc). Sin el desempate por id el resultado
--   NO es determinista: medido 14/12/16 eventos absorbidos según desempate.
-- FECHA: date-only disfrazado de timestamptz. CERO `at time zone 'America/Santiago'`.
with e as (
  select *,
    (tipo = 'urgencia' or (tipo = 'tramite' and descripcion ~* 'urgencia')) as es_urg,
    (descripcion ~* 'retira')                                              as es_retiro,
    lower(trim(case
      when tipo = 'urgencia' then coalesce(descripcion, '')
      else coalesce((regexp_match(coalesce(descripcion,''), 'urgencia\s+([^.,;]+)', 'i'))[1],
                    'urgencia')
    end)) as ukey,
    row_number() over (order by fecha asc, id asc) as rn
  from public.tramitacion_evento
  where boletin = $1
), f as (
  select *, (es_urg and not es_retiro) as colapsable from e
), g as (
  select *, rn - row_number() over (partition by colapsable, ukey order by rn) as grp from f
), runs as (
  select ukey, grp, count(*) as n
  from g where colapsable
  group by ukey, grp
  having count(*) >= 2
)
select (select count(*) from e)                              as eventos_totales,
       coalesce((select sum(n) from runs), 0)                as eventos_absorbidos,
       (select count(*) from runs)                           as periodos,
       (select count(*) from e) - coalesce((select sum(n) from runs), 0) as hitos_del;
```

### Comando de medición (patrón obligatorio del repo)

```bash
set -a && . ./.env && set +a && export PGCLIENTENCODING=UTF8
psql "$SUPABASE_DB_URL" -tA -F'|' -f supabase/queries/timeline-regla-de-seleccion.sql | tr -d '\r'
```

### Copy nuevo del eje 3 (D-07 — cero vocabulario de afinidad)

```tsx
// PRESENTE: hecho declarado por fuente oficial, sin insinuación.
<span className="font-semibold text-accent-product">Comparten {n}</span>{" "}
{n === 1 ? "proyecto co-firmado" : "proyectos co-firmados"}.

// Columna, si la lista v2 llegara al techo (hoy imposible: max 101 < 1000):
`Mostrando ${filas.length} de ${totalHonesto(filas)} co-autores registrados.`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| RPCs sin `statement_timeout` | `set statement_timeout` en toda RPC | `0077` (fase 124) | La v2 lo lleva obligatorio |
| RPCs sin `LIMIT` | techo derivado de medición sobre dominio COMPLETO, piso 1.000 | `0078`/`0079` (fase 124) | Da el criterio exacto para el 1.000 de D-05 |
| `limit 20` de co-autoría como "bounded" | insuficiente: 85 % del universo truncado | medido aquí | Justifica DEBT-04 |
| `.order("fecha")` sin desempate | orden total `(fecha, id)` | propuesto aquí (D-03) | Hace determinista el conteo del timeline |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | El `.sql` documental es mejor sede que una función SQL para la regla del timeline | Pattern 1 | Si el planner quiere una función, aplica la aguja completa; el análisis (sin consumidor + `TramitacionStepper` comparte constructor) es `[VERIFIED: repo]`, la preferencia es juicio. |
| A2 | 130 tomará `0081` ⇒ 131 toma `0082` | Pitfall 7 | 130 aún no tiene plan `[VERIFIED: ls]`. D-08 ya manda resolver al mergear. |
| A3 | `fecha asc, id asc` es el desempate correcto (vs `descripcion`, `fecha_captura`) | §H-06.4 | `id` es la única columna garantizada única `[VERIFIED: schema]`; que sea *semánticamente* el orden de la fuente es asunción. Alternativa defendible: `fecha asc, id asc` igual, porque cualquier orden total fijo mata el no-determinismo — la elección concreta importa menos que su fijeza. |
| A4 | El copy "Comparten N proyectos co-firmados" pasa el linter anti-insinuación | Code Examples | Es el copy **ya vivo** (`comparar/page.tsx:410-420`) `[VERIFIED: repo]`, sólo cambia el valor de N. Riesgo ~0. |

---

## Open Questions (RESOLVED)

> **Cierre B-1 del plan-checker (2026-07-30):** Q1 → RESUELTA: se mide en 131-01 Task 1 con el
> orden total `(fecha asc, id asc)` y se congela en `timeline-14309-04.esperado.json` (sede única;
> W-6: si la ingesta hace crecer el boletín, protocolo de re-medición/re-congelado documentado en
> el verify — jamás re-hornear en silencio). Q2 (paridad DOM) → RESUELTA: unit en 131; DOM real
> delegado a Phase 138 con el número ya congelado (autorizado por CONTEXT §Discretion; anotado en
> ROADMAP §131 SC#1).

1. **¿Qué número exacto de `Hito del` produce `(fecha asc, id asc)`?**
   - Qué sabemos: `fecha` sola → 14 absorbidos (85). `fecha, id desc` → 12 (87). `fecha, ctid desc` → 16 (83).
   - Qué falta: `id asc` no fue medido aisladamente.
   - Recomendación: **primera tarea del plan** — fijar el orden, medir con la query de §Code
     Examples, y hornear ESE número en un solo lugar.

2. **¿El test de paridad query↔DOM llega a correr contra un deploy en esta fase?**
   - Qué sabemos: 138 es la fase de deploy + BrowserOS.
   - Recomendación: en 131 el **unit sobre `construirItems`** (mínimo exigido por la Discretion) +
     la medición `psql`; el DOM real se delega a 138 con el número ya congelado.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `psql` | medición PROD + aplicar migración + pgTAP | ✓ | `/c/Users/Carlo/miniconda3/Library/bin/psql` | — |
| `SUPABASE_DB_URL` | idem | ✓ | en `.env` | — |
| pnpm + vitest 3.2.6 | suite + guards | ✓ | `app/package.json` | — |
| pgTAP en PROD | prueba de la migración | ✓ (schema `extensions` tras 123) | — | — |
| Deploy Worker / BrowserOS | paridad DOM real | ✗ en esta fase | — | unit de paridad; DOM en 138 |

**Missing con fallback:** sólo la verificación DOM real → cubierta por 138.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.6 (`app/package.json:55`) |
| Config file | `app/vitest.config.*` (paquete `app/` ya CI-verde; los paquetes de `packages/*` tienen el suyo) |
| Quick run command | `pnpm --filter ./app exec vitest run components/timeline-view.test.tsx app/comparar/page.test.tsx` |
| Full suite command | `pnpm test` (raíz: `packages/*` + `app/`) |
| Guards runner | `pnpm guards` (raíz `package.json:14` — 17 guards por NOMBRE, jamás glob) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| DEBT-03 | `construirItems` absorbe exactamente K eventos en P períodos sobre el fixture del testigo | unit | `pnpm --filter ./app exec vitest run components/timeline-view.test.tsx` | ✅ (603 líneas, 11 `describe`) — **añadir** el caso de paridad |
| DEBT-03 | la query `.sql` da el MISMO K contra PROD | manual/psql | `psql "$SUPABASE_DB_URL" -tA -f supabase/queries/timeline-regla-de-seleccion.sql \| tr -d '\r'` | ❌ Wave 0 (archivo nuevo) |
| DEBT-03 | el orden de lectura es TOTAL (dos claves) | unit/source-scan | assert de que `page.tsx` encadena dos `.order(` en la lectura de `tramitacion_evento` | ❌ Wave 0 |
| DEBT-04 | la v2 existe, es secdef, `search_path=''`, timeout, `limit 1000`, doble-revoke | pgTAP | `psql "$SUPABASE_DB_URL" -tA -f supabase/migrations/00XX_coautoria_v2.test.sql` | ❌ Wave 0 (patrón `0060/0061/0067/0068.test.sql`) |
| DEBT-04 | `/comparar` muestra `Comparten 92 …` para `D1178×D1099` | unit (mock RPC) | `pnpm --filter ./app exec vitest run app/comparar/page.test.tsx` | ✅ (586 líneas; mocks en L77/226/305/486) — **añadir** el caso |
| DEBT-04 | la v2 está en `PUBLIC_RPC_ALLOWLIST` y existe en migraciones | guard | `pnpm --filter ./app exec vitest run lib/lockdown-guard.test.ts` | ✅ (assert A2 en L622-634; scan de call-sites en L761-785) |
| DEBT-04 | copy nuevo sin vocabulario de afinidad | guard | `pnpm --filter ./app exec vitest run lib/anti-insinuacion-guard.test.ts` | ✅ (`SUPERFICIES_RELACIONES:363-368` ya incluye `app/comparar/page.tsx`) |
| D-09 | régimen completo verde | guard | `pnpm guards` | ✅ |

### Sampling Rate
- **Per task commit:** `pnpm --filter ./app exec vitest run <archivos tocados por nombre>`
- **Per wave merge:** `pnpm --filter ./app test && pnpm guards`
- **Phase gate:** `pnpm test` + `pnpm guards` verdes + pgTAP contra el schema APLICADO, antes de
  `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `supabase/queries/timeline-regla-de-seleccion.sql` — regla escrita, criterio declarado (DEBT-03)
- [ ] `supabase/migrations/00XX_coautoria_v2.test.sql` — pgTAP de la v2 (DEBT-04)
- [ ] Caso de paridad en `components/timeline-view.test.tsx` (DEBT-03)
- [ ] Caso `D1178×D1099` en `app/comparar/page.test.tsx` (DEBT-04)
- [ ] Assert de orden total en la lectura de `tramitacion_evento` (DEBT-03/D-03)

*(Framework install: ninguno — todo existe.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | superficie pública read-only, Camino A |
| V3 Session Management | no | — |
| V4 Access Control | **sí** | Camino A: `service_role` bypassa RLS ⇒ el control real es `PUBLIC_RPC_ALLOWLIST` + doble-revoke. La v2 DEBE entrar al allowlist y llevar `revoke all … from public` + `from anon, authenticated`. |
| V5 Input Validation | **sí** | `p_id text` **parametrizado**, jamás interpolación de string (`0060` cabecera). `PARLAMENTARIO_ID_RE` valida en el borde. |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| SQL injection vía `p_id` | Tampering | función `language sql` con parámetro, `search_path=''`, nombres schema-qualified |
| Escalada por `security definer` | Elevation of Privilege | `set search_path = ''` + sólo tablas no-PII (`proyecto_autor`, `parlamentario`); cero `rut`/`donante_id` proyectado |
| DoS por barrido de tabla | DoS | `statement_timeout='5s'` + `limit 1000` (techo derivado de medición, `0079`) |
| Fuga de PII por columna nueva | Information Disclosure | la v2 emite las MISMAS 5 columnas que la viva; el guard de chokepoint (`lockdown-guard.test.ts:786+`) escanea `rut`/`donante_id` |
| **Ausencia falsa con atribución de fuente** | *(riesgo #1 del proyecto, no-STRIDE)* | `interseccionPar` fail-closed CR-01 + `total_n` honesto — **el objeto mismo de DEBT-04** |

---

## Sources

### Primary (HIGH confidence)
- PROD vía `psql -tA` + `tr -d '\r'` (2026-07-30): conteos de `tramitacion_evento` para `14309-04`,
  desglose por tipo, simulación gaps-and-islands de la regla, sensibilidad al desempate, cardinalidad
  de co-autoría sobre el dominio completo (180 parlamentarios), pares testigo.
- `app/components/timeline-view.tsx` (L1-345), `app/components/timeline-event.tsx:102`,
  `app/app/proyecto/[boletin]/page.tsx:451-500`, `app/app/comparar/page.tsx:117-127, 394-435, 556-618`,
  `app/app/parlamentario/[id]/page.tsx:187-206, 357-440`.
- `supabase/migrations/0008_tramitacion.sql`, `0060:30-56, 270-300`, `0061:147-179`,
  `0064:259-291`, `0079:1-60`.
- `app/lib/lockdown-guard.test.ts:195-225, 600-640, 760-790`; `app/lib/anti-insinuacion-guard.test.ts:363-368`;
  `package.json:13-14`; `app/package.json:10-11`.
- `.planning/milestones/v12.0-MILESTONE-AUDIT.md:298-304` (H-06, fila 3.3);
  `.planning/milestones/v12.0-phases/122-…/122-CRUCES-SQL-01-RELACIONES-COMPARAR.md:361, 1006`
  (testigo original `D1165×S1338`).

### Secondary (MEDIUM confidence)
- Ninguna. **Cero web research** (por mandato del objetivo).

### Tertiary (LOW confidence)
- Ninguna.

---

## Metadata

**Confidence breakdown:**
- Camino del dato H-06: **HIGH** — leído línea por línea; la brecha cierra exacto (99−14=85).
- Defecto de determinismo: **HIGH** — reproducido en PROD con 4 órdenes distintos (14/12/12/16).
- Cardinalidad de co-autoría: **HIGH** — dominio 100 %, no muestra; `psql -tA`.
- Sede de la regla escrita (Pattern 1): **MEDIUM** — el análisis es verificado, la preferencia es juicio (A1).
- Numeración de migración: **MEDIUM** — depende de 130 (A2), D-08 ya lo gobierna.

**Research date:** 2026-07-30
**Valid until:** hasta que 127/130 mergeen (numeración) o cambie `proyecto_autor` — datos de PROD
medidos hoy; re-medir el máximo de coautores si pasan semanas antes de escribir la migración.
