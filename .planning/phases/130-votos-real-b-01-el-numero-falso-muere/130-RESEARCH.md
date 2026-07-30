# Phase 130: VOTOS-REAL — B-01: el número falso muere - Research

**Researched:** 2026-07-30
**Domain:** Postgres/pgTAP (RPC agregada con aguja completa) + Next.js Server Components (chip/capa-1/sección)
**Confidence:** HIGH (todo verificado: código leído con líneas exactas + PROD medido por `psql -tA`)
**Modo:** codebase-internal + PROD read-only. Cero web research (por mandato).

## Summary

B-01 no es un bug de cálculo: es un bug de **universo**. Chip, capa-1 y `VotosSection` derivan
TODOS sus números —total, desglose por selección, asistencia, nº de proyectos, chart por
trimestre— de las MISMAS 1.000 filas que devuelve `votos_de_parlamentario(p_id, 1000, 0)`, cuyo
`order by vo.fecha desc nulls last` selecciona **el año más reciente** del registro. Para el
testigo `D1165` (Agustín Romero) eso significa mostrar `1000` donde hay **3.752**, y una
composición sesgada: `ausente` pasa de 0,77% real a 2,70% mostrado (asistencia 99,2% real vs
**97,3% mostrado**), `abstención` de 4,56% real a 2,20% mostrado, y proyectos distintos de 555 a
**191**. El clamp `least(coalesce(p_limit,20),4000)` que puso `0078` es seguridad (DoS), no
exactitud — el propio archivo lo declara (`0078` líneas 83-88).

El fix decidido (D-01/D-03): una RPC **aditiva y agregada** que agrupe por `seleccion` sobre el
universo COMPLETO, dejando `votos_de_parlamentario` intacta como carril del listado. Verificado en
PROD que el universo es limpio para agregar: los `left join proyecto` / `left join proyecto_ficha`
de la RPC vieja **no producen fan-out** (cero boletines duplicados en ambas tablas), y `voto` no
tiene filas duplicadas por (parlamentario, votación) para el testigo → `count(*)` sobre
`voto ⋈ votacion` reproduce byte-a-byte la cardinalidad que el listado pagina.

El molde de "aguja completa" existe verbatim y es reciente: `0068_coincidencia_votos_par.sql`
(RPC nueva, agregada, sobre `public.voto`) — mismo shape que necesita 130. Copiarlo.

**Primary recommendation:** RPC `public.votos_conteo_de_parlamentario(p_id text)` agregada por
`seleccion` (5 filas máx., `limit 1000` trivialmente holgado), molde 0068 literal, migración
**`0081`** (0080 es de Phase 127), pgTAP espejo de `0068_*.test.sql`, y un único punto de consumo:
`contarCarriles` en `app/lib/parlamentario-resumen-conteos.ts` — de ahí ya cuelgan chip, capa-1 y
`Ver detalle (N)`. `VotosSection` recibe los conteos reales por prop en el mismo commit.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** RPC ADITIVA de conteo AGRUPADO — no un total pelado: devuelve las agrupaciones que la
  UI desglosa (dimensión exacta la mapea el research desde `VotosSection`/chip) + permite derivar
  el total por suma. Así chip Y composición salen del SQL sobre TODAS las filas — el desglose deja
  de derivar de un `order by fecha desc limit 1000` (raíz de B-01).
- **D-02:** Aguja completa OBLIGATORIA (regla LOCKED "RPC pública nueva"): cero-grant, secdef
  `search_path=''`, `statement_timeout`, LIMIT piso 1.000 (sobre filas agrupadas — trivialmente
  holgado), doble-revoke, alta en `PUBLIC_RPC_ALLOWLIST` del lockdown-guard, pgTAP contra schema
  aplicado. PII-safe: la RPC agrega, jamás emite fila individual con identidad+voto fuera del carril
  existente.
- **D-03:** La RPC existente `votos_de_parlamentario` (p_limit 1000) queda INTACTA y sigue
  sirviendo el listado de detalle — firma viva jamás se altera (42P13). El comentario WR-03 del
  código (parlamentario-resumen-conteos.ts:271-277) prescribe exactamente esto.
- **D-04:** Chip del índice above-fold y `VotosSection` cambian en el MISMO commit/deploy: ambos
  leen el conteo real de la RPC nueva; el listado de detalle puede seguir capado a 1000 filas
  mostradas PERO todo número visible es el real y si el render recorta declara "N de M" honesto.
- **D-05:** Test que MUERDE si el cap vuelve a gobernar el número visible (criterio 4): assert de
  que el conteo mostrado NO proviene de `length` del listado capado (forma exacta la decide el
  plan: p.ej. mock de RPC de conteo vs listado con valores distintos → la UI muestra el del conteo).
- **D-06:** Verificación E2E contra PROD por `psql -tA | tr -d '\r'`: número mostrado == recálculo
  SQL verbatim (jamás REST, cap 1k de PostgREST). Sujetos testigo: la ficha con 3.752 y al menos
  otra de la clase afectada (71/186).
- **D-07:** Migración con el siguiente número LIBRE tras 0080 (verificar por `ls supabase/migrations`
  al ejecutar — 130 corre en paralelo con 127 que consume 0080; coordinar numeración al momento de
  crear el archivo, LOCKED: 0080 es de 127). Aplicación psql --single-transaction.
- **D-08:** Guard create-view de 126 vigila; la RPC nueva no crea views. El lockdown-guard L626/L773
  exige: entrada en allowlist correspondiente a función definida en migraciones + todo `.rpc()`
  literal allowlisted.

### Claude's Discretion

- Nombre de la RPC (sugerencia: `votos_conteo_de_parlamentario`).
- Si el desglose agrupa por uno o dos niveles (lo decide el shape actual de VotosSection).

### Deferred Ideas (OUT OF SCOPE)

- Paginación real del listado de votos (>1000 filas navegables) — fuera de DEBT-01.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción (REQUIREMENTS.md L36) | Research Support |
|----|-------------|------------------|
| DEBT-01 🔴 (B-01) | Las fichas muestran el conteo REAL de votos (3.752, no `Ver detalle (1000)`) con composición no distorsionada, en las 71/186 fichas afectadas: RPC de conteo dedicada ADITIVA con aguja completa (cero-grant, secdef PII-safe `search_path=''`, `statement_timeout`, LIMIT piso 1000, doble-revoke, `PUBLIC_RPC_ALLOWLIST`, pgTAP contra schema aplicado) + cambio SIMULTÁNEO de chip y `VotosSection`. Un clamp de seguridad NO es un fix de exactitud. | §Mapa del defecto (call-sites exactos), §RPC vigente (SQL base verbatim), §Molde aguja completa (0068), §Medición PROD (testigo D1165 = 3.752; clase = 71/186; composición cap vs real), §Numeración 0081, §Validation Architecture |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement**: nada de edits fuera de un comando GSD.
- **Ingesta 2 etapas / rate-limit**: no aplica a esta fase (cero red a fuentes externas).
- **Secrets en `.env`**: `SUPABASE_DB_URL` vive en `.env` (con BOM potencial — ver Pitfall 5).
  **JAMÁS ecoar la URL** en logs/commits.
- Migraciones **por `psql` directo**, nunca `supabase db push` (drift de `schema_migrations`) —
  precedente 0060/0061/0067/0068.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Conteo total + desglose por `seleccion` sobre TODAS las filas | Database (RPC agregada) | — | Es un `group by` sobre 283.550 filas; la app jamás debe materializarlas. La raíz de B-01 fue justamente hacerlo en JS sobre un `limit`. |
| Listado paginado de votaciones (detalle) | Database (`votos_de_parlamentario`) | Frontend server (paginación por arcos) | Carril existente, INTACTO (D-03). |
| Chip / capa-1 / `Ver detalle (N)` | Frontend server (`contarCarriles`, React.cache) | — | Único productor de conteos de ficha; server-only con service_role (Camino A). |
| Composición mostrada en `VotosSection` "Cómo votó" | Frontend server (prop desde `contarCarriles`) | — | Hoy la deriva localmente de filas capadas → debe recibirla, no recalcularla. |
| Facetas (materia), chart por trimestre, nº proyectos | Frontend server sobre filas capadas | — | **Siguen capados** — fuera de alcance salvo el rótulo honesto (ver Open Question OQ-1). |

---

## Mapa del defecto (líneas exactas, verificadas)

### 1. El productor único: `app/lib/parlamentario-resumen-conteos.ts`

| Líneas | Qué hace | Rol en B-01 |
|--------|----------|-------------|
| L104-111 | `export function resumirVotos(rows: {seleccion:string}[]): VotosBreakdown` — cuenta por `seleccion` en JS | Composición distorsionada (opera sobre las filas capadas) |
| L262 | `export const contarCarriles = cache(async (id) => ...)` | Productor único; React.cache dedup por request |
| L271-277 | Comentario **WR-03** que prescribe el fix (RPC de conteo dedicado, "cambiarlo en AMBOS lados a la vez") | Documenta la deuda; el plan debe REEMPLAZARLO, no dejarlo |
| **L279-283** | `await sb.rpc("votos_de_parlamentario", { p_id: id, p_limit: 1000, p_offset: 0 })` | **LA RAÍZ** |
| L288-289 | `const votosRows = (votosData ?? []); const votosTotal = votosRows.length;` | **El número falso** = `.length` de filas capadas |
| L290 | `const votos = derivarEstado({ total: votosTotal, ingestado: true })` | Alimenta `CarrilEstado.n` → `Ver detalle (N)` y el chip |
| L294 | `const votosBreakdown = resumirVotos(votosRows)` | Desglose distorsionado |
| L299-305 | `asistencia = { presentes: votosRows.filter(v => v.seleccion !== "ausente").length, total: votosTotal }` | Porcentaje de asistencia distorsionado (97,3% vs 99,2% real) |
| L434-435 | retorno `{ asistencia, votosBreakdown, ... }` | |
| L459-462 | fallback seguro (`contarCarrilesSeguro`): `asistencia: null`, breakdown en ceros | Debe seguir honesto si la RPC nueva falla |

### 2. Call-sites del número visible (todos cuelgan de `contarCarrilesSeguro`)

| Archivo:línea | Superficie | Qué muestra |
|---|---|---|
| `app/app/parlamentario/[id]/page.tsx:574` | ficha | `const conteos = await contarCarrilesSeguro(id)` |
| `app/app/parlamentario/[id]/page.tsx:586` | header de carril | `<CarrilHeader titulo="Votaciones" conteo={conteoLabel(conteos.votos)} />` |
| `app/app/parlamentario/[id]/page.tsx:89-99` | — | `conteoLabel()`: `case "dato": return String(estado.n)` |
| `app/app/parlamentario/[id]/page.tsx:591-593` | disclosure | `{conteos.votos.tipo === "dato" && <DetalleColapsable n={conteos.votos.n}>` → **`Ver detalle (1000)`** |
| `app/app/parlamentario/[id]/page.tsx:526` | índice above-fold | `const conteos = await contarCarrilesSeguro(id)` |
| `app/components/parlamentario-resumen.tsx:172` + `:128` | chip índice | `construirChips(c)` → `{ href:"#votos", label:"Votaciones", estado: c.votos }` |
| `app/app/parlamentario/[id]/page.tsx:587-589` | capa-1 | `<VotosCapa1 breakdown={conteos.votosBreakdown} asistencia={conteos.asistencia} />` |
| `app/components/capa1/votos-capa1.tsx:73-79` | capa-1 | suma de `breakdown` = `totalBarra`; `asistPct = presentes/total` |

**Consecuencia de arquitectura:** basta cambiar `contarCarriles` (un solo `sb.rpc`) para que chip +
capa-1 + `Ver detalle (N)` queden reales **simultáneamente** (D-04 satisfecho por construcción).

### 3. `VotosSection` — el segundo lado (mismo cap, fetch propio)

`app/components/votos-por-parlamentario.tsx`:

| Líneas | Qué |
|---|---|
| **L1008-1012** | `await sb.rpc("votos_de_parlamentario", { p_id: id, p_limit: 1000, p_offset: 0 })` — **segundo fetch capado** |
| L1030-1035 | hidratación de `materia` por `.from("proyecto").in("boletin", boletines)` — degradación honesta si falla |
| L1053-1058 | `derivarVotosViewData({ todasConMateria, materiaActiva, page, votosVer })` |
| L891-975 | función PURA de derivación (testeable) |
| L925-935 | **conteos por `seleccion`** sobre `conteoSet` (filtrado por materia si hay tema activo — invariante WR-01) |
| L949-950 | `const totalVotos = conteoSet.length` — **el total mostrado en la sección** |
| L953 | `totalProyectos = new Set(todasConMateria.map(v => v.boletin)).size` — también capado |
| L958 | `periodos = agruparVotosPorTrimestre(todasConMateria)` — chart también capado |
| L611-627 / L635 | render: `totalConteos = SELECCION_ORDEN.reduce(...)`, barra apilada, `Emitió {totalConteos} votos registrados.` |
| L639-641 | `ausentes = conteos.ausente; presentes = totalConteos - ausentes` |
| L718-724 | `Presente en {presentes} de {totalConteos} votaciones · Ausente en {ausentes}.` |

### 4. Dimensión del desglose — RESPUESTA A LA PREGUNTA DE D-01

**Una sola dimensión: `seleccion`**, dominio cerrado de 5 valores, con orden LOCKED
`SELECCION_ORDEN = ORDEN_BARRA = ['si','no','abstencion','pareo','ausente']`
(`app/components/capa1/votos-capa1.tsx:40-46`; espejo en `votos-por-parlamentario.tsx`).

Todo lo demás es **derivado** de esos 5 números:
- total = suma de los 5
- `ausentes` = `seleccion='ausente'`; `presentes` = total − ausentes; asistencia % = presentes/total

**NO hay segundo nivel necesario.** El agrupamiento por trimestre (chart) y por materia (faceta)
existen, pero: (a) el chart es sobre `todasConMateria` (filas), no un agregado que la RPC de conteo
deba servir; (b) la faceta por materia exige `proyecto.materia`, otro join, y su alcance es el
listado. **Recomendación: RPC de UN nivel (`seleccion` → `n`), 5 filas.** Sencilla, agregada,
PII-safe, y suficiente para chip + capa-1 + "Cómo votó" + asistencia.

⚠️ **Sutileza WR-01 (`votos-por-parlamentario.tsx` L925-931):** cuando hay `?materia=` activo, el
desglose de la sección se recalcula sobre el subconjunto filtrado. La RPC nueva devuelve el
**global**. El plan debe conservar el comportamiento: RPC global cuando `materiaActiva === null`;
con tema activo, el desglose sigue siendo el del subconjunto (que además ya es honesto porque el
rótulo dice el tema). Alternativa: dejar el desglose filtrado como está y usar la RPC solo para el
caso global. **Esta es la única bifurcación de diseño real de la fase.**

---

## RPC vigente `votos_de_parlamentario` — el universo a espejar

**Definición viva** = `supabase/migrations/0078_cotas_duras_parametro.sql` L184-206 (transcripción
del `pg_get_functiondef` vivo; 0019 la creó, 0028 la extendió con DROP+recreate, 0077 le puso
`statement_timeout`, 0078 el techo duro).

```
CREATE OR REPLACE FUNCTION public.votos_de_parlamentario(p_id text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(votacion_id text, boletin text, fecha timestamptz, seleccion text, etapa text, camara text,
               origen text, fecha_captura timestamptz, enlace text, titulo text, idea_matriz text,
               resultado text, total_si integer, total_no integer, total_abstencion integer,
               total_pareo integer, quorum text)
 LANGUAGE sql STABLE
 SET statement_timeout TO '5s'
AS $function$
  select ...
  from voto v
  join votacion vo on vo.id = v.votacion_id
  left join proyecto pr on pr.boletin = vo.boletin
  left join proyecto_ficha pf on pf.boletin = vo.boletin
  where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
  order by vo.fecha desc nulls last
  limit least(coalesce(p_limit, 20), 4000) offset p_offset;
$function$;

revoke execute on function public.votos_de_parlamentario(text, integer, integer) from public;
revoke execute on function public.votos_de_parlamentario(text, integer, integer) from anon, authenticated;
```

**Notas de auditoría (VERIFICADAS leyendo el archivo):**
- **NO es `security definer`** y **NO tiene `search_path=''`** — es `language sql STABLE` (invoker).
  Toca solo tablas público-read (`voto`, `votacion`, `proyecto`, `proyecto_ficha`). La RPC NUEVA
  sí debe ser secdef + `search_path=''` (D-02, molde 0068).
- **PII:** el `returns table` **no** proyecta `parlamentario` en absoluto — ni nombre, ni rut, ni
  partido. Emite `seleccion` individual por votación **para un `p_id` ya conocido por el llamador**.
  Es el carril sancionado (LEGAL-03, declarado en 0019/0028). La RPC nueva es estrictamente MENOS
  expuesta: solo agregados.
- **ACL vigente:** `anon`/`authenticated`/`public` SIN execute (doble-revoke en 0078 L208-209). El
  único llamador es el servidor del sitio vía `service_role` (Camino A, 0044).

### SQL base EXACTO que la RPC de conteo debe usar (mismo universo)

```sql
from public.voto v
join public.votacion vo on vo.id = v.votacion_id
where v.parlamentario_id = p_id and v.estado_vinculo = 'confirmado'
group by v.seleccion
```

**Los `left join proyecto` / `left join proyecto_ficha` deben OMITIRSE.** Verificado en PROD
que no cambian la cardinalidad (cero boletines duplicados en ambas tablas — ver §Medición A), pero
incluirlos añadiría dos joins innecesarios y crearía una dependencia de que esa unicidad se
mantenga. **Omitirlos es equivalente hoy y más robusto.**

⚠️ Sin embargo: **el plan DEBE incluir un assert de equivalencia** (pgTAP y/o query de verificación)
`count(*) con-los-left-join == count(*) sin-ellos` para el testigo, porque si mañana `proyecto`
admite boletines duplicados el listado y el conteo divergirían silenciosamente.

`join votacion` sí es obligatorio: es lo que define el universo del listado (un `voto` con
`votacion_id` huérfano quedaría fuera del listado y debe quedar fuera del conteo). Verificado: cero
filas confirmadas con `vo.fecha is null`.

---

## Molde "aguja completa" — precedente a copiar VERBATIM

**Fuente canónica: `supabase/migrations/0068_coincidencia_votos_par.sql` L36-85** (RPC nueva,
agregada, sobre `public.voto` — el análogo más cercano que existe). Estructura literal:

```sql
-- ── ACL (Camino A, post-0044): CERO grant ────────────────────────────────────────
-- El sitio ejecuta con service_role (bypassa ACL/RLS). Doble-revoke explícito VERBATIM
-- de 0067 para limpiar los DEFAULT PRIVILEGES que Postgres re-concede sobre funciones
-- nuevas de `public`. NUNCA re-emitir grant.

drop function if exists public.<nombre>(text);              -- L48: idiom 42P13

create or replace function public.<nombre>(p_id text)        -- L50
returns table (seleccion text, n bigint)                     -- L51: SOLO agregados
language sql stable security definer                         -- L52
  set search_path = ''                                       -- L53
  set statement_timeout = '5s'                               -- L54
as $$
  ... nombres SCHEMA-QUALIFIED obligatorios (public.voto, public.votacion) ...
  limit 1000;                                                -- piso LOCKED (D-02)
$$;

revoke all on function public.<nombre>(text) from public;              -- L84
revoke all on function public.<nombre>(text) from anon, authenticated; -- L85
```

Elementos LOCKED del molde, uno por uno:

| Elemento | Línea en 0068 | Por qué |
|---|---|---|
| `drop function if exists` antes | L48 | `create or replace` que cambia `returns table` da `42P13` |
| `security definer` | L52 | molde 0064/0067; el pgTAP lo asserta |
| `set search_path = ''` | L53 | obliga a schema-qualify TODO (`public.voto`, no `voto`) |
| `set statement_timeout = '5s'` | L54 | cota DoS; **un `create or replace` que lo omita lo BORRA en silencio** (riesgo Nº1 documentado en 0078 L93-96) |
| `limit` explícito | (0079 impone la regla) | piso 1000; sobre 5 filas agrupadas es trivial |
| doble-revoke (`public` + `anon, authenticated`) | L84-85 | `anon` es miembro implícito de `public`; el guard A5 exige el revoke en el MISMO archivo |
| pgTAP contra schema APLICADO | `supabase/tests/0068_*.test.sql` | "pgTAP es la ÚNICA prueba válida del DDL (Pitfall 6)" |

**Molde pgTAP: `supabase/tests/0068_coincidencia_votos_par.test.sql`** (14 asserts,
`begin; select plan(N); ... rollback;`). Asserts obligatorios a espejar:
1. `has_function('public','<nombre>',ARRAY['text'], ...)`
2. `prosecdef = true` — **scoped por `::regprocedure`**, nunca por `proname` a secas (WR-05: rompe con overloads)
3. `has_function_privilege('anon', 'public.<nombre>(text)', 'execute') = false`
4. `has_function_privilege('authenticated', ..., 'execute') = false` (2º leg del doble-revoke)
5. `proconfig` contiene `search_path=` **y** `statement_timeout=5s`
6. shape del `returns table` = exactamente las columnas agregadas (cero `seleccion` cruda por votación con identidad)
7. **Assert de PARIDAD sobre fixture:** suma de la RPC == `count(*)` del universo del listado

### `PUBLIC_RPC_ALLOWLIST` — `app/lib/lockdown-guard.test.ts`

**Formato de entrada** (L195-224, orden alfabético, con comentario `// ← NEW` cuando la función es
nueva y aún no consumida en otros planes):

```ts
const PUBLIC_RPC_ALLOWLIST = new Set([
  "actualidad_senales_panel",
  ...
  "votos_conteo_de_parlamentario", // ← NEW (debe existir en supabase/migrations/0081_*.sql — consumida en Plan NN)
  "votos_de_parlamentario",
]);
```
(alfabéticamente `votos_conteo_de_parlamentario` va **antes** de `votos_de_parlamentario`.)

**Los 2 asserts que disparará:**

| Assert | Línea | Qué exige | Cómo se satisface |
|---|---|---|---|
| A2 — "toda entrada de PUBLIC_RPC_ALLOWLIST corresponde a una función definida en migraciones" | **L626** (test), detector `definedRpcNames` L613 + `RPC_DEF_REGEX` L609-610 | El nombre debe matchear `/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi` en algún `.sql` de `supabase/migrations/` **tras stripear comentarios** | La migración 0081 con `create or replace function public.votos_conteo_de_parlamentario(...)` |
| A5 — "ningun archivo del arbol publico invoca un `.rpc()` fuera del allowlist PII-safe" | **L761** (dentro del bloque L750-790) | Todo literal `.rpc("nombre"` en el árbol público debe estar en el Set. Patrón `/\.rpc\(\s*['"`]([a-zA-Z_][\w]*)['"`]/g`, scan multilínea sobre contenido completo con comentarios TS stripeados | El nombre **debe ser un literal string**, no una variable/template — el guard no resuelve indirecciones |

⚠️ **Orden de trabajo obligatorio:** escribir la migración ANTES de añadir la entrada al allowlist,
o A2 se pone roja. Y añadir la entrada al allowlist ANTES (o en el mismo commit que) el `.rpc()` en
el código, o A5 se pone roja. **Un solo commit con los tres, o migración → allowlist → call-site.**

---

## Medición PROD (read-only, `psql -tA -f` + `tr -d '\r'`, 2026-07-30)

> Ninguna de estas cifras vino de REST (PostgREST capa a 1.000 filas y mentiría exactamente en el
> rango que importa). Todas por `psql -tA` contra PROD. `SUPABASE_DB_URL` jamás ecoada.

### A. Universo y salubridad del join

| Métrica | Valor |
|---|---|
| `voto` con `estado_vinculo='confirmado'` (total) | **283.550** ✅ coincide con la cifra de referencia de CONTEXT |
| Parlamentarios con ≥1 voto confirmado | **186** |
| Parlamentarios con **>1000** votos confirmados | **71** ✅ **la clase afectada es exactamente 71/186** (verbatim del audit v12) |
| Boletines duplicados en `proyecto` | **0** → los `left join` de la RPC vieja **no hacen fan-out** |
| Boletines duplicados en `proyecto_ficha` | **0** → idem |
| Filas confirmadas con `votacion.fecha IS NULL` | **0** → el `nulls last` del order by es inerte hoy |
| Duplicados (votacion_id, parlamentario) para D1165 | **0** → `count(*)` == `count(distinct votacion_id)` |

### B. Rango de la clase afectada (los 71)

| Métrica | Valor |
|---|---|
| Mínimo de votos confirmados dentro de la clase | **1.222** |
| Máximo | **3.773** (`D1170`) |
| Promedio | **3.341** |

⇒ Hoy **las 71 fichas muestran `1000`**, y el valor real medio es 3,3× mayor. La ficha más
distorsionada exhibe un error de **−73,5%**.

### C. Ficha testigo — `D1165` (Agustín Romero) = **3.752** ✅

Ruta: `/parlamentario/D1165`. Es la misma ficha que el audit v12 sondeó en el deploy vivo
(`v12.0-MILESTONE-AUDIT.md` L39, L43-44: "el DOM vivo dice `Ver detalle (1000)`").

Composición replicando la RPC verbatim (`join votacion`, `left join proyecto`, `left join
proyecto_ficha`, `order by vo.fecha desc nulls last limit 1000`) vs el universo completo:

| `seleccion` | **CAP-1000 (lo que el sitio muestra HOY)** | % mostrado | **TODO (la verdad)** | % real | Δ |
|---|---|---|---|---|---|
| si | 469 | 46,90% | **1.764** | 47,02% | +0,12 pp |
| no | 466 | 46,60% | **1.772** | 47,23% | +0,63 pp |
| abstencion | 22 | 2,20% | **171** | 4,56% | **+2,36 pp (×2,07)** |
| pareo | 16 | 1,60% | **16** | 0,43% | −1,17 pp |
| ausente | 27 | 2,70% | **29** | 0,77% | **−1,93 pp (÷3,49)** |
| **TOTAL** | **1.000** | | **3.752** | | **+2.752** |
| proyectos distintos (`totalProyectos`) | **191** | | **555** | | **+364** |
| asistencia mostrada (capa-1, es-CL 1 dec.) | **97,3 %** | | **99,2 %** | | −1,9 pp |
| ventana temporal cubierta | 2025-05-12 → 2026-07-22 | | 2022-03-22 → 2026-07-22 | | falta **3 años** |

**El sesgo tiene mecánica clara:** el `order by fecha desc` recorta al último año, donde este
parlamentario acumuló casi todas sus ausencias (27 de 29) y casi ninguna abstención (22 de 171).
No es truncamiento neutro — es **selección temporal**, exactamente lo que `0079` L83-88 declaró
fuera de su alcance.

### D. Segundo testigo — `D1170` (Luis Sánchez) = **3.773** (el máximo de la clase)

| `seleccion` | CAP-1000 | TODO |
|---|---|---|
| si | 471 | **1.779** |
| no | 487 | **1.797** |
| abstencion | 26 | **181** |
| pareo | 15 | **15** |
| ausente | 1 | **1** |
| **TOTAL** | **1.000** | **3.773** |

Distorsión de `abstencion`: 2,60% mostrado vs 4,80% real (×1,85). Confirma que el patrón no es
idiosincrático de D1165.

**Tercer sujeto disponible si el plan quiere un tercero:** `D1012` (Boris Barrera) = **3.736**.

---

## Standard Stack

Cero dependencias nuevas. Todo el trabajo usa lo ya instalado.

| Componente | Versión/Ubicación | Rol en 130 |
|---|---|---|
| Postgres (Supabase) | 15+ | RPC agregada |
| pgTAP | ya instalado (`supabase/tests/`) | prueba del DDL contra schema aplicado |
| `psql` | CLI local | aplicación (`--single-transaction`) + verificación |
| vitest | `app/` (`pnpm --filter ./app test`) | tests de UI + lockdown-guard |
| Next.js 16 / React 19.2 Server Components | `app/` | superficie |

**Sin instalación. Sin Package Legitimacy Audit** (esta fase no instala ningún paquete externo).

---

## Architecture Patterns

### Flujo de datos — ANTES (defectuoso)

```
                    ┌─ contarCarriles()  ──rpc(votos_de_parlamentario, p_limit:1000)──┐
/parlamentario/[id] │   (React.cache)                                                  │
                    │      │                                                    ┌──────▼──────┐
                    │      ├─ .length ────────────► chip "Votaciones (1000)"    │ PROD: 3.752 │
                    │      ├─ resumirVotos() ─────► VotosCapa1 (barra + 97,3%)  │  filas      │
                    │      └─ derivarEstado() ────► DetalleColapsable "Ver detalle (1000)"
                    │                                                            └─────────────┘
                    └─ VotosSection ────rpc(votos_de_parlamentario, p_limit:1000)── (2º fetch,
                           └─ derivarVotosViewData() ─► "Emitió 1000 votos registrados."   mismo cap)
```

### Flujo de datos — DESPUÉS (recomendado)

```
                    ┌─ contarCarriles()  ──rpc(votos_conteo_de_parlamentario)──► GROUP BY seleccion
/parlamentario/[id] │   (React.cache)         (5 filas: si/no/abstencion/pareo/ausente sobre 3.752)
                    │      │
                    │      ├─ suma ───────────────► chip "Votaciones (3.752)"
                    │      ├─ breakdown REAL ─────► VotosCapa1 (barra + 99,2%)
                    │      └─ derivarEstado() ────► DetalleColapsable "Ver detalle (3.752)"
                    │
                    └─ VotosSection ──rpc(votos_de_parlamentario, p_limit:1000)──► SOLO el listado
                           │                                                        (arcos, faceta, chart)
                           └─ conteos/total RECIBIDOS por prop desde contarCarriles
                              └─ si filas mostradas < total → rótulo honesto "N de M"
```

**Patrón clave: un solo productor de verdad numérica.** `contarCarriles` ya es `React.cache` y ya
lo consumen todas las superficies; `VotosSection` debe **recibir** los conteos, no recalcularlos.
Esto hace que D-04 ("mismo commit, cero desincronización") sea estructural, no una promesa.

### Anti-patrones a evitar

- **Subir `p_limit` a 4000.** Es exactamente el clamp-como-fix que el criterio 4 prohíbe: el techo
  duro de `0078` es 4.000 y el máximo real de la clase es 3.773 — "funcionaría hoy" y mentiría el
  día que alguien supere 4.000. Además duplicaría el payload del Server Component ×3,7.
- **Añadir un `count(*) over()` a `votos_de_parlamentario`.** Cambia el `returns table` de una
  firma VIVA → `42P13` + DROP + re-arma de default privileges. D-03 lo prohíbe explícitamente.
- **RPC que devuelva un total pelado (`bigint`).** D-01 lo prohíbe: el desglose seguiría saliendo
  de las filas capadas y B-01 quedaría medio arreglado (número real, composición falsa).
- **`create or replace` omitiendo `set statement_timeout`.** Lo borra en silencio (0078 L93-96).
- **Verificar por REST/PostgREST.** Capa a 1.000 — mentiría justo en el rango de la clase afectada.
- **Recalcular el desglose en JS a partir de filas.** Es la raíz del bug.

---

## Don't Hand-Roll

| Problema | No construir | Usar en su lugar | Por qué |
|---|---|---|---|
| Conteo total sobre 283k filas | paginación en JS con N llamadas `p_offset` | `group by` en la RPC | 4 round-trips de 1.000 filas por ficha; el gotcha del cap 1k de PostgREST reaparecería |
| Aguja de seguridad de la RPC | escribir el molde de memoria | copiar `0068_coincidencia_votos_par.sql` L48-85 literal | un `set` omitido se borra en silencio y el pgTAP de otra migración se pone rojo |
| pgTAP de la RPC | asserts nuevos | espejar `supabase/tests/0068_*.test.sql` (14 asserts) | ya cubre secdef/proconfig/doble-revoke/shape con los idioms correctos (`::regprocedure`) |
| Formateo de miles es-CL | `String(n)` o `toLocaleString()` ad-hoc | revisar el formateador existente (`pctFormatter` en `votos-capa1.tsx` L60-63 usa `Intl.NumberFormat("es-CL")`) | `Ver detalle (3752)` vs `(3.752)` es una decisión de copy; el DESIGN-SYSTEM y el linter anti-insinuación de 126 mandan |

**Key insight:** el 90% del valor de esta fase es *borrar* código (el `resumirVotos` sobre filas
capadas, el `.length`), no escribirlo.

---

## Common Pitfalls

### Pitfall 1: el clamp disfrazado de fix
**Qué pasa:** subir `p_limit` a 4000 hace que el testigo muestre 3.752 y "pasa" el criterio 2.
**Por qué:** es la trampa exacta que documenta el gotcha v12 §9 ("clamp de seguridad ≠ fix de
exactitud") y que `0079` L83-88 declaró fuera de alcance.
**Cómo evitar:** criterio 4 exige un test que muerda. Forma sugerida (D-05): mockear
`votos_conteo_de_parlamentario` → 3.752 y `votos_de_parlamentario` → 3 filas; assert de que el DOM
dice `3.752` (o `3752`) y **`not.toContain("(3)")`**. Si alguien revierte al `.length`, el test da 3.
**Señal de alarma:** cualquier diff que toque `p_limit` en vez de añadir un `.rpc()` nuevo.

### Pitfall 2: el guard de allowlist muerde por orden de commits
**Qué pasa:** añadir el `.rpc("votos_conteo_de_parlamentario")` sin la entrada en el Set (A5 roja),
o la entrada sin la migración (A2 roja).
**Cómo evitar:** migración → allowlist → call-site, en ese orden, idealmente en un solo commit.
**Señal:** `Allowlist con entradas sin función en supabase/migrations/` o
`RPC no-allowlisted invocado desde el arbol publico`.

### Pitfall 3: `search_path=''` y los nombres sin calificar
**Qué pasa:** con `set search_path = ''`, `from voto` da `relation "voto" does not exist` **en
runtime**, no al crear la función.
**Cómo evitar:** `public.voto`, `public.votacion`. 0068 L59-77 lo hace literal.
**Señal:** la migración aplica verde y la ficha tira 500.

### Pitfall 4: el `create or replace` que borra cláusulas
**Qué pasa:** re-emitir la función sin `set statement_timeout='5s'` la deja sin cota y rompe el
post-apply `0077_*.test.sql` (debe seguir 20/20).
**Cómo evitar:** post-check en la propia migración verificando `proconfig` (patrón 0078 L327-341).

### Pitfall 5: `.env` con BOM y CRLF de Windows
**Qué pasa:** `SUPABASE_DB_URL` puede traer BOM (documentado en el header de 0028) y `psql -tA` en
Windows emite CRLF (gotcha v12: "`psql -tA` emite CRLF, `sort -c` no protege").
**Cómo evitar:** `| tr -d '\r'` SIEMPRE en la salida; strip de BOM/comillas al leer la variable.
Y `PGCLIENTENCODING=UTF8` para SELECTs con tildes (gotcha histórico).
**Nunca:** ecoar la URL.

### Pitfall 6: React intercala `<!-- -->` en el HTML SSR
**Qué pasa:** `expect(html).toContain("Ver detalle (3.752)")` falla porque React inserta
`<!-- -->` entre texto y expresión (gotcha v12).
**Cómo evitar:** assert sobre `textContent` del nodo, o sobre el número solo. Precedente que ya
funciona: `app/app/parlamentario/[id]/page.test.tsx:430` `expect(html).toContain("Ver detalle (3)")`.
**Y:** `Suspense` esconde contenido en `<div hidden id="S:N">` — `VotosSection` va dentro de un
`<Suspense>` (`page.tsx` L594). El chip y el `Ver detalle (N)` NO (vienen de `contarCarriles`
fuera del boundary) → assertear sobre esos es más robusto.

### Pitfall 7: `derivarVotosViewData` con desglose filtrado por materia
**Qué pasa:** si el plan sustituye ciegamente `conteos` por los de la RPC global, con `?materia=X`
activo la sección mostraría el desglose global bajo un rótulo de tema — rompe WR-01
(`votos-por-parlamentario.tsx` L925-931) y fabrica una falsedad NUEVA para arreglar una vieja.
**Cómo evitar:** usar la RPC solo cuando `materiaActiva === null`; con tema activo, conservar el
cálculo sobre el subconjunto filtrado (y su rótulo).

### Pitfall 8: los otros números de la sección siguen capados
`totalProyectos` (L953: 191 vs 555 reales) y el chart `periodos` (L958: solo el último año) siguen
derivando de las 1.000 filas. **Están fuera del texto de DEBT-01** pero son la misma falsedad de
clase. Ver OQ-1 — el plan debe DECIDIR explícitamente y dejarlo escrito, no ignorarlo.

---

## Code Examples

### Migración (esqueleto, molde 0068 verbatim)

```sql
-- 0081_votos_conteo_de_parlamentario.sql
-- ADITIVA. NO toca votos_de_parlamentario (firma viva — 42P13, D-03).
-- ACL (Camino A, post-0044): CERO grant. Doble-revoke explícito al final.
-- Molde 0068 COMPLETO: security definer, search_path='' con nombres schema-qualified,
-- statement_timeout='5s', limit explícito. Cero rut/email/nombre en el returns table.

drop function if exists public.votos_conteo_de_parlamentario(text);

create or replace function public.votos_conteo_de_parlamentario(p_id text)
returns table (seleccion text, n bigint)
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  -- MISMO UNIVERSO que votos_de_parlamentario (0078 L191-205): join a votacion,
  -- estado_vinculo='confirmado'. Los left join a proyecto/proyecto_ficha se OMITEN:
  -- medido 2026-07-30 que no cambian la cardinalidad (cero boletines duplicados).
  select v.seleccion, count(*) as n
  from public.voto v
  join public.votacion vo on vo.id = v.votacion_id
  where v.parlamentario_id = p_id
    and v.estado_vinculo = 'confirmado'
  group by v.seleccion
  limit 1000;   -- piso LOCKED del régimen; el dominio real de `seleccion` es 5 valores
$$;

revoke all on function public.votos_conteo_de_parlamentario(text) from public;
revoke all on function public.votos_conteo_de_parlamentario(text) from anon, authenticated;
```

### Consumo en `contarCarriles` (reemplaza L279-294)

```ts
const { data: conteoData, error: conteoError } = await sb.rpc(
  "votos_conteo_de_parlamentario",
  { p_id: id },
);
if (conteoError) {
  throw new Error(`votos_conteo_de_parlamentario falló para ${id}: ${conteoError.message}`);
}
// 5 filas máx. (dominio cerrado de `seleccion`); una selección sin filas simplemente no viene.
const votosBreakdown = agregarConteo(
  (conteoData as { seleccion: string; n: number }[] | null) ?? [],
);
const votosTotal = ORDEN.reduce((s, k) => s + votosBreakdown[k], 0);
```

⚠️ `count(*)` en Postgres es `bigint` → supabase-js lo entrega como **`number`** (los valores caben
de sobra), pero el tipo generado puede decir `number`. Verificar en `app/lib/types.ts` (§L301
documenta la fila de la RPC vieja — añadir el tipo de la nueva ahí, mismo lugar).

---

## Runtime State Inventory

*(Fase de cambio de código + una migración aditiva; se completa igual por disciplina.)*

| Categoría | Encontrado | Acción |
|---|---|---|
| Stored data | **Ninguno.** No hay backfill ni migración de datos: `voto`/`votacion` no se tocan. La RPC es de solo lectura. | Ninguna |
| Live service config | **Ninguna.** Cero crons nuevos, cero workflows n8n, cero Edge Functions. | Ninguna |
| OS-registered state | **Ninguno** — verificado: la fase no registra tareas ni procesos. | Ninguna |
| Secrets / env vars | **Ninguno nuevo.** Solo lectura de `SUPABASE_DB_URL` (ya existente) para aplicar/verificar. | Ninguna |
| Build artifacts | Deploy de Cloudflare Workers (OpenNext) requerido para que el fix sea visible; el criterio 2 exige verificación contra el **deploy real**. Build en **Docker Linux** (gotcha rector: build en Windows produce worker roto 500). | Re-deploy |

---

## Environment Availability

| Dependencia | Requerida por | Disponible | Versión | Fallback |
|---|---|---|---|---|
| `psql` | aplicar migración + verificación PROD | ✓ | verificado funcionando contra PROD hoy | — |
| `SUPABASE_DB_URL` (`.env`) | idem | ✓ | — | — |
| pgTAP en PROD | prueba del DDL | ✓ | 51 archivos `supabase/tests/` en uso; `pgtap` vive en `public` (deuda conocida OFF-6-01, no bloquea) | — |
| `pnpm` + vitest | suite `app/` | ✓ | — | — |
| Docker (build OpenNext Linux) | deploy | ✓ (usado en milestones previos) | — | ninguno — build en Windows produce worker roto |

**Sin dependencias faltantes.**

---

## Validation Architecture

### Test Framework

| Propiedad | Valor |
|---|---|
| Framework unit/UI | vitest (`app/package.json:10` → `"test": "vitest run"`) |
| Framework DDL | pgTAP (`supabase/tests/*.test.sql`) — única prueba válida del DDL (Pitfall 6) |
| Quick run | `pnpm --filter ./app test <archivo>` |
| Full suite | `pnpm test` (raíz: `pnpm -r --filter "./packages/*" test && pnpm --filter ./app test`) |
| Typecheck | `pnpm typecheck` (raíz, `tsc -b`) |

⚠️ **Gotcha v12 crítico:** `vitest run lib/*guard*.test.ts` **sale 0 sin correr nada** si el glob no
matchea. Correr siempre por **nombre explícito de archivo**, jamás por glob, y verificar el conteo
de tests en la salida.

### Phase Requirements → Test Map

| Criterio | Comportamiento | Tipo | Comando automatizado | ¿Existe? |
|---|---|---|---|---|
| SC1 | RPC existe con aguja completa (secdef, search_path='', timeout, doble-revoke, shape agregado) | pgTAP contra PROD | `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0081_votos_conteo_de_parlamentario.test.sql \| tr -d '\r'` | ❌ Wave 0 |
| SC1 | Entrada en allowlist ↔ función en migraciones (A2 L626) | unit | `pnpm --filter ./app test lib/lockdown-guard.test.ts` | ✅ existe |
| SC1 | Todo `.rpc()` allowlisted (A5 L761) | unit | idem | ✅ existe |
| SC1 | Regresión: `0077`/`0078`/`0079` siguen verdes tras aplicar | pgTAP | `psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0077_statement_timeout_rpcs_no_acotadas.test.sql` (debe seguir 20/20) + `0078_*` + `0079_*` | ✅ existen |
| SC2 | Chip + `Ver detalle (N)` + capa-1 muestran el conteo de la RPC nueva | unit SSR | `pnpm --filter ./app test app/parlamentario/\[id\]/page.test.tsx` | ✅ existe (añadir caso; mock por nombre en L101) |
| SC2 | Número mostrado == recálculo SQL | E2E manual/PROD | `psql -tA` (query §D-06 abajo) + fetch del deploy | ❌ Wave final |
| SC3 | Composición == desglose real (paridad) | unit | `pnpm --filter ./app test lib/parlamentario-resumen-conteos.test.ts` | ✅ existe (mock por nombre, L308-320) |
| SC3 | Paridad suma(RPC) == count(universo) sobre fixture | pgTAP | dentro del `.test.sql` nuevo | ❌ Wave 0 |
| SC4 | Test que MUERDE si el cap vuelve a gobernar | unit | mock conteo=3752 / listado=3 filas → assert `3.752` **y** `not.toContain` del 3 | ❌ Wave 0 |

### Sampling Rate

- **Por commit de tarea:** `pnpm --filter ./app test <archivo tocado>` + `pnpm typecheck`
- **Por merge de wave:** `pnpm test` completo (raíz) + los 3 pgTAP post-apply de regresión
- **Phase gate:** suite completa verde + pgTAP nuevo verde contra PROD aplicado + verificación D-06

### Comandos exactos de verificación PROD (read-only)

Preámbulo LOCKED en todo comando (nunca ecoar la URL):

```bash
DBURL=$(grep '^SUPABASE_DB_URL=' .env | sed 's/^SUPABASE_DB_URL=//' | tr -d '\r"' | sed 's/^\xef\xbb\xbf//')
```

**V-1 — total real del testigo (debe dar 3752):**
```bash
psql "$DBURL" -tA -c "select count(*) from voto v join votacion vo on vo.id=v.votacion_id where v.parlamentario_id='D1165' and v.estado_vinculo='confirmado';" | tr -d '\r'
```

**V-2 — desglose real del testigo (si 1764 / no 1772 / abstencion 171 / pareo 16 / ausente 29):**
```bash
psql "$DBURL" -tA -c "select v.seleccion, count(*) from voto v join votacion vo on vo.id=v.votacion_id where v.parlamentario_id='D1165' and v.estado_vinculo='confirmado' group by 1 order by 1;" | tr -d '\r'
```

**V-3 — la RPC nueva devuelve exactamente lo mismo (paridad, post-apply):**
```bash
psql "$DBURL" -tA -c "select seleccion, n from public.votos_conteo_de_parlamentario('D1165') order by 1;" | tr -d '\r'
psql "$DBURL" -tA -c "select sum(n) from public.votos_conteo_de_parlamentario('D1165');" | tr -d '\r'   # 3752
```

**V-4 — paridad RPC-conteo ↔ universo del listado, para TODA la clase afectada (control fuerte):**
```bash
psql "$DBURL" -tA -c "
with real as (select parlamentario_id, count(*) n from voto v join votacion vo on vo.id=v.votacion_id where v.estado_vinculo='confirmado' group by 1)
select count(*) from real r
where r.n <> (select coalesce(sum(n),0) from public.votos_conteo_de_parlamentario(r.parlamentario_id));" | tr -d '\r'
# DEBE dar 0 sobre los 186 — cero fuerte, no vacuo (hay 186 sujetos, no una lista vacía)
```

**V-5 — ACL: cero execute para anon/authenticated/public:**
```bash
psql "$DBURL" -tA -c "select has_function_privilege('anon','public.votos_conteo_de_parlamentario(text)','execute'), has_function_privilege('authenticated','public.votos_conteo_de_parlamentario(text)','execute'), has_function_privilege('service_role','public.votos_conteo_de_parlamentario(text)','execute');" | tr -d '\r'
# esperado: f|f|t
```

**V-6 — proconfig (secdef + search_path + timeout preservados):**
```bash
psql "$DBURL" -tA -c "select prosecdef, proconfig from pg_proc where oid='public.votos_conteo_de_parlamentario(text)'::regprocedure;" | tr -d '\r'
# esperado: t|{search_path=,statement_timeout=5s}
```

**V-7 — E2E sobre el deploy real (criterio 2, D-06):** extraer el DOM de
`/parlamentario/D1165` y `/parlamentario/D1170` y confirmar que el `Ver detalle (…)` y el chip
dicen **3.752** / **3.773**, jamás `1000`. El precedente v12 hizo esto con BrowserOS/fetch del
deploy; el gotcha `bros-cli sale 0 tras CDP timeout` obliga a validar que hubo HTML real, no un
exit-0 vacío.

### Wave 0 Gaps

- [ ] `supabase/migrations/0081_votos_conteo_de_parlamentario.sql` — cubre SC1
- [ ] `supabase/tests/0081_votos_conteo_de_parlamentario.test.sql` — pgTAP, espejo de `0068_*.test.sql` (14 asserts), cubre SC1+SC3
- [ ] Caso nuevo en `app/lib/parlamentario-resumen-conteos.test.ts` — mock de la RPC nueva (el fake devuelve `{data:[],error:null}` para nombres no registrados en `rpcResponses`, L19 → **un caso sin registrar daría un breakdown en ceros silencioso**: registrar explícitamente)
- [ ] Test que MUERDE (SC4) — mock divergente conteo vs listado
- [ ] Entrada `"votos_conteo_de_parlamentario"` en `PUBLIC_RPC_ALLOWLIST` (`lockdown-guard.test.ts` L195-224)
- [ ] Tipo de la fila en `app/lib/types.ts` (junto a L301)

*Framework: ya instalado, sin gaps de infraestructura.*

---

## Security Domain

### Categorías ASVS aplicables

| Categoría ASVS | Aplica | Control estándar en esta fase |
|---|---|---|
| V2 Authentication | no | superficie pública sin auth; el sitio lee con `service_role` server-only (Camino A) |
| V3 Session Management | no | — |
| V4 Access Control | **sí** | Doble-revoke (`from public` + `from anon, authenticated`); el guard A5 del lockdown es la barrera REAL bajo Camino A (service_role bypassa ACL/RLS) |
| V5 Input Validation | **sí** | `p_id text` **parametrizado** — jamás interpolado (precedente T-51-05); `search_path=''` obliga a schema-qualify |
| V6 Cryptography | no | — |
| V13/DoS (fuera de ASVS-core, régimen propio) | **sí** | `statement_timeout='5s'` + `limit 1000` (0064/0077/0078/0079) |

### Patrones de amenaza para este stack

| Patrón | STRIDE | Mitigación estándar |
|---|---|---|
| SQL injection vía `p_id` | Tampering | parámetro tipado en función SQL; cero `format()`/concatenación |
| Privilege escalation por `security definer` sin `search_path` | Elevation of Privilege | `set search_path = ''` + nombres schema-qualified (0068 L53) |
| Superficie REST re-abierta por DEFAULT PRIVILEGES | Information Disclosure | doble-revoke en el MISMO archivo (guard A5 lo exige) |
| DoS por table scan sobre 283.550 filas de `voto` | Denial of Service | `statement_timeout='5s'` + índice existente sobre `voto.parlamentario_id` (**verificar en el plan**: el `group by` sobre 3.7k filas de un parlamentario es trivial, pero confirmar el índice) |
| **Fuga de PII** | Information Disclosure | El `returns table` es `(seleccion text, n bigint)` — **cero identidad, cero rut/email/partido, cero fila individual**. Estrictamente menos expuesto que `votos_de_parlamentario`. Gate LEGAL-03 satisfecho por construcción. |

---

## State of the Art (evolución interna del defecto)

| Antes | Ahora | Cuándo | Impacto |
|---|---|---|---|
| `votos_de_parlamentario` sin cota de filas | `limit least(coalesce(p_limit,20),4000)` | `0078` (Phase 124) | Seguridad cerrada; **B-01 sigue vivo** (0079 L83-88 lo declara fuera de alcance) |
| RPC sin `statement_timeout` | `SET statement_timeout TO '5s'` | `0077` | Cota DoS; un `create or replace` descuidado la borra |
| RPCs con grant a `anon` (0019 L103, 0028 L73) | ACL cero-grant, service_role únicamente | `0043`/`0044` (Camino A) | La barrera es el guard CI, no la DB |
| Deuda declarada 3 veces sin arreglar (122 → 123 `B-01` → 124 §1 → 125 §3) | Phase 130 | ahora | El milestone v12 cerró en `tech_debt` por esto (audit §1) |

**Obsoleto / no usar:**
- `grant execute … to anon` sobre RPCs (0019 L103, 0028 L73): revertido por Camino A. **Jamás re-emitir.**
- `supabase db push`: drift de `schema_migrations`. Siempre `psql --single-transaction --db-url`.

---

## Assumptions Log

| # | Claim | Sección | Riesgo si es falso |
|---|---|---|---|
| A1 | El nombre `votos_conteo_de_parlamentario` es aceptable (es la sugerencia de CONTEXT, discreción de Claude) | Code Examples | Cosmético; renombrar antes de escribir la migración |
| A2 | La UI debe seguir mostrando el desglose **filtrado** cuando hay `?materia=` activo (WR-01 preservado) | Pitfall 7 | Si el operador prefiere global siempre, el rótulo debe cambiar |
| A3 | Existe un índice sobre `voto.parlamentario_id` que hace el `group by` barato | Security Domain | Sin índice, seq scan sobre 283k filas por render; el `statement_timeout=5s` lo cortaría. **Verificar con `\d voto` antes de aplicar** |
| A4 | El formateo de miles (`3.752` vs `3752`) lo gobierna el DESIGN-SYSTEM/linter de 126 | Don't Hand-Roll | Discrepancia de copy; el guard de 126 lo cazaría |
| A5 | `count(*)::bigint` llega a supabase-js como `number` sin pérdida | Code Examples | Valores < 4.000; sin riesgo práctico |

*(Nada de compliance/retención/seguridad se asumió: todo lo de la aguja se leyó de las migraciones.)*

---

## Open Questions

1. **OQ-1 — ¿`totalProyectos` y el chart por trimestre entran en alcance?**
   - Qué sabemos: ambos derivan de las mismas 1.000 filas (`votos-por-parlamentario.tsx` L953,
     L958). Medido: 191 proyectos mostrados vs **555** reales para D1165; el chart cubre solo
     2025-05 → 2026-07 de un registro que arranca en **2022-03**.
   - Qué no está claro: DEBT-01 habla de "el conteo REAL de votos … con composición no
     distorsionada". "Composición" es inequívocamente el desglose por `seleccion`. Los otros dos
     son la misma clase de falsedad pero no están nombrados.
   - Recomendación: **NO ampliar alcance** (la fase es paralelizable y acotada), pero el plan DEBE
     dejar el rótulo honesto sobre lo que sigue capado (D-04 ya lo exige: "si el render recorta
     declara N de M honesto") y **registrar la deuda residual por escrito** en el SUMMARY, para que
     el audit de v13 no la re-descubra como hallazgo nuevo. Un `Ver detalle (3.752)` que abra una
     sección diciendo "555 proyectos" y muestre 191 sería un B-01 nuevo.

2. **OQ-2 — ¿Se corrige el `resumirVotos` exportado o se conserva?**
   - `resumirVotos` (L104-111) es una función pura exportada y testeada. Si el breakdown pasa a
     venir de SQL, queda huérfana.
   - Recomendación: **eliminarla junto con sus tests** (cero código muerto que invite a revertir) o
     re-propositarla como el agregador `filas RPC → VotosBreakdown`. La segunda opción conserva la
     cobertura y el nombre.

3. **OQ-3 — Numeración: ¿0081 o 0080?**
   - Verificado hoy: `supabase/migrations/` termina en **`0079_limit_explicito_rpcs.sql`**;
     **0080 NO existe todavía**. D-07 la reserva LOCKED para Phase 127.
   - Recomendación: **0081**, y `ls supabase/migrations | tail -3` **inmediatamente antes** de crear
     el archivo. Si 127 aún no la creó, 0081 igual (no rellenar el hueco).

---

## Numeración de migración (confirmado)

```
$ ls supabase/migrations | tail -3
0077_statement_timeout_rpcs_no_acotadas.sql
0078_cotas_duras_parametro.sql
0079_limit_explicito_rpcs.sql
```

- **0080 — NO existe** (reservada LOCKED para Phase 127, que corre en paralelo).
- **0081 — LIBRE.** Es el número de Phase 130.
- Aplicación: `psql "$DBURL" --single-transaction -f supabase/migrations/0081_*.sql`
  (nunca `supabase db push`).

---

## Sources

### Primarias (HIGH — código y PROD leídos en esta sesión)
- `app/lib/parlamentario-resumen-conteos.ts` — L104-111, L262, L271-305, L434-435, L459-462
- `app/components/votos-por-parlamentario.tsx` — L611-641, L718-724, L891-975, L1006-1058
- `app/app/parlamentario/[id]/page.tsx` — L89-99, L526, L574, L584-601
- `app/components/parlamentario-resumen.tsx` — L128, L172
- `app/components/capa1/votos-capa1.tsx` — L23-63, L73-79
- `app/lib/lockdown-guard.test.ts` — L195-224 (allowlist), L609-632 (A2), L750-784 (A5)
- `supabase/migrations/0028_votos_instructivos.sql` — L30-73 (DROP+recreate, gate LEGAL-03)
- `supabase/migrations/0068_coincidencia_votos_par.sql` — L36-85 (**molde de la aguja completa**)
- `supabase/migrations/0078_cotas_duras_parametro.sql` — L83-105, L178-209 (**definición viva**), L327-393
- `supabase/migrations/0079_limit_explicito_rpcs.sql` — L20-88 (criterio de techos; B-01 fuera de alcance)
- `supabase/tests/0068_coincidencia_votos_par.test.sql` — L1-40 (**molde pgTAP**)
- `.planning/ROADMAP.md` §Phase 130 L137-149 · `.planning/REQUIREMENTS.md` L36 · `.planning/config.json` (`nyquist_validation: true`)
- `.planning/milestones/v12.0-MILESTONE-AUDIT.md` — L39, L43-44, L77-88, L159 (B-01 original)
- **PROD (psql -tA, read-only, 2026-07-30)** — 283.550 confirmados · 71/186 clase afectada ·
  D1165=3.752 (Agustín Romero) · D1170=3.773 · D1012=3.736 · composición cap-1000 vs completa ·
  cero fan-out en los left join · cero duplicados por (parl, votación) · cero `fecha` nula

### Secundarias (MEDIUM)
- MEMORY.md — gotchas v12 (§9 clamp ≠ fix; `vitest` con glob sale 0; React `<!-- -->`;
  Suspense `<div hidden>`; `psql -tA` CRLF; control de ausencia exige control positivo apareado)

### Terciarias (LOW)
- Ninguna. **Cero web research** (por mandato del scope).

---

## Metadata

**Desglose de confianza:**
- Mapa del defecto: **HIGH** — líneas leídas una por una, no inferidas
- RPC vigente y su universo: **HIGH** — `0078` transcribe el `pg_get_functiondef` vivo; PROD confirma cardinalidad
- Molde aguja completa: **HIGH** — `0068` leído íntegro; `0064`/`0067`/`0077`/`0079` corroboran
- Medición PROD: **HIGH** — `psql -tA`, jamás REST; cifra de control (283.550) coincide con CONTEXT
- Alcance de `totalProyectos`/chart: **MEDIUM** — medido, pero la decisión de alcance es del operador (OQ-1)
- Índice sobre `voto.parlamentario_id`: **LOW** — asumido (A3), verificar antes de aplicar

**Research date:** 2026-07-30
**Valid until:** 2026-08-29 (codebase-internal; se invalida si 127 aterriza `0080` alterando la
numeración o si alguien toca `votos_de_parlamentario`)

---

*Phase: 130-VOTOS-REAL — B-01: el número falso muere*
