# Phase 87: BÚSQUEDA P1b — RPC híbrida `buscar_proyectos_hibrido` + rewire - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 8 (2 create SQL, 3 create TS/test, 3 modify TS)
**Analogs found:** 8 / 8 (todos exactos — es una fase de transcripción, no de invención)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0055_busqueda_hibrida.sql` | migration (DDL: extension + config FTS + índice GIN + RPC + ACL) | request-response (RPC de retrieval) | `0049_cruces_de_proyecto.sql` (idiom RPC definer) + `0032_agenda_search.sql` (FTS/GIN) | exact |
| `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` | test (pgTAP post-apply) | transform (assert schema aplicado) | `0045_revoke_public_rpc_gap.test.sql` | exact |
| `app/lib/busqueda-hibrida-gate.ts` | config (flag server-only) | request-response | `app/lib/cruces-gate.ts` | exact |
| `app/lib/busqueda-hibrida-gate.test.ts` | test (unit flag) | transform | `app/lib/cruces-gate.test.ts` | exact |
| `app/lib/buscar.ts` (MODIFY) | service (data-layer server-only) | request-response | self (extender flag + rewire + `detectarBoletin`) | exact |
| `app/lib/lockdown-guard.test.ts` (MODIFY) | test (guard CI allowlist) | transform | self (agregar entry a `PUBLIC_RPC_ALLOWLIST`) | exact |
| `packages/fichas/src/spike/strategies.ts` (MODIFY) | utility (harness runner) | transform | self (`runSemanticOnly` como espejo de `runRpcHibrida`) | exact |
| `packages/fichas/src/spike/retrieval-cli.ts` (MODIFY) | utility (CLI de medición) | batch | self (agregar 4ª columna `rpc-real`) | exact |
| `app/lib/boletin-detector.ts` (create OR reuse spike/boletin.ts) | utility | transform | `packages/fichas/src/spike/boletin.ts::detectarBoletin` | exact |

**Confirmado:** última migración en disco = `0054_leyes_rotacion_estado.sql` → nueva = **`0055`** (RESEARCH Q8, verificado por Glob).

---

## Pattern Assignments

### `supabase/migrations/0055_busqueda_hibrida.sql` (migration, DDL)

Estructura de 5 secciones (RESEARCH línea 124-134). Copia patrones de DOS análogos.

**Análogo A — RPC definer + doble-revoke + CERO grant:** `0049_cruces_de_proyecto.sql:56-115`

Idiom de lockdown post-Camino-A. El `drop function if exists` previo es defensivo (gotcha 42P13). `language sql stable security definer set search_path = ''`. Con `search_path=''` **TODO va schema-qualified** (`public.proyecto`, `public.proyecto_ficha`, y crucialmente la config custom `public.es_unaccent`). El bloque ACL al final:

```sql
-- Source: supabase/migrations/0049_cruces_de_proyecto.sql:55-58,69,114-115
drop function if exists public.cruces_de_proyecto(text);

create or replace function public.cruces_de_proyecto(p_boletin text)
returns table ( ... )
language sql stable security definer set search_path = '' as $$
  ... -- cuerpo 100% schema-qualified: public.proyecto_ficha, public.voto, public.sector
$$;

-- ── ACL determinista (Camino A): doble-revoke, CERO grant ──
revoke all on function public.cruces_de_proyecto(text) from public;
revoke all on function public.cruces_de_proyecto(text) from anon, authenticated;
```

> **Aplicar a 0055:** firma `buscar_proyectos_hibrido(q text, query_embedding vector(768), match_count int default 20)` → returns `table (boletin text, rank int)` (PII-safe: SOLO boletin+rank). Doble-revoke con la firma EXACTA `(text, vector, int)`. CERO grant — `service_role` ejecuta por bypass (NO agregar `grant … to service_role`; es innecesario y contradice el idiom — RESEARCH Pitfall 3).

**Análogo B — FTS spanish + GIN + `websearch_to_tsquery`:** `0032_agenda_search.sql:22-33,56-92`

Template FTS probado. OJO a la diferencia de diseño: 0032 usa **columna generada STORED** con `to_tsvector('spanish'::regconfig, …)` (2-arg literal = IMMUTABLE) porque comision+materia viven en UNA tabla. En 87 el tsv cruza `proyecto`↔`proyecto_ficha` → **columna generada IMPOSIBLE** (RESEARCH Anti-Pattern) → tsv calculado ad-hoc en la query con LEFT JOIN. Reusar de 0032: el idiom `websearch_to_tsquery`, el índice GIN, y `set search_path=''`.

```sql
-- Source: 0032_agenda_search.sql:32-33 (GIN) + :59 (websearch_to_tsquery)
create index if not exists citacion_busqueda_tsv_idx
  on public.citacion using gin (busqueda_tsv);
...
websearch_to_tsquery('spanish', q) as tsq
```

**Config `es_unaccent` + GIN de expresión (SECCIONES 1-3, de RESEARCH Pattern 2 + STACK.md):**

```sql
-- SECCIÓN 1-2: extension + wrapper IMMUTABLE + config accent-insensitive
create extension if not exists unaccent;
create or replace function public.f_unaccent(text)
  returns text language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent', $1) $$;   -- 2-arg = IMMUTABLE (indexable)
create text search configuration public.es_unaccent ( copy = spanish );
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word
  with public.unaccent, spanish_stem;

-- SECCIÓN 3: GIN de expresión sobre el tsv del TÍTULO (peso A = el bug estrella, RETR-02)
create index if not exists idx_proyecto_titulo_fts
  on public.proyecto using gin (to_tsvector('public.es_unaccent', coalesce(titulo, '')));
```

**Cuerpo de la RPC (SECCIÓN 4) — transcripción del SQL ya medido en el spike:** ver RESEARCH Pattern 1 (líneas 141-207). Fuente conceptual = `strategies.ts:45-119` (`FTS_QUERY` + `SEMANTIC_QUERY` + short-circuit boletín). Cambios al portar del spike a la RPC de PROD:
- `unaccent(:q)` ad-hoc → config `public.es_unaccent` (unaccent DENTRO del pipeline, simétrico índice/consulta).
- Short-circuit boletín en SQL: `where q ~ '^\d{3,6}(-\d{1,2})?$' and (p.boletin = q or p.boletin_num = split_part(q,'-','1'))` con `rank 0` = tope absoluto (RETR-01). `boletin_num` YA EXISTE (`text not null`, 0008:20).
- **LEFT JOIN** `public.proyecto_ficha` (NUNCA INNER — preserva los sin-ficha, buscables por título; RESEARCH Pitfall 2).
- Caps de fila desde el día 1: `limit least(match_count, 50) * 2` por rama, `limit least(match_count, 50)` final.
- `language sql` (NO plpgsql) — los caps de fila bastan; `statement_timeout` local = escape-hatch documentado (RESEARCH Pattern 3).

---

### `supabase/tests/post-apply/0055_busqueda_hibrida.test.sql` (test, pgTAP)

**Análogo:** `supabase/tests/post-apply/0045_revoke_public_rpc_gap.test.sql`

Estructura `begin; select plan(N); … select * from finish(); rollback;`. POST-APPLY ONLY (vive fuera del glob regular; operador lo corre a mano tras aplicar, con `psql -tA -f`). El assert clave "PUBLIC sin EXECUTE" usa `aclexplode` (NO `has_function_privilege('public', …)` — public no es rol real):

```sql
-- Source: 0045_revoke_public_rpc_gap.test.sql:16-26
begin;
select plan(5);

-- (b) PUBLIC sin EXECUTE (aclexplode, grantee=0)
select is((select count(*)::int from pg_proc p, aclexplode(p.proacl) a
  where p.oid = 'public.buscar_proyectos_hibrido(text,vector,int)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  0, 'PUBLIC sin EXECUTE en buscar_proyectos_hibrido');

select * from finish();
rollback;
```

> **Asserts requeridos (RESEARCH Wave 0 Gaps):** (a) función existe con firma `(text,vector,int)` — `has_function`; (b) PUBLIC sin EXECUTE (aclexplode arriba); (c) `select 1 from pg_extension where extname='unaccent'`; (d) config `es_unaccent` existe (`pg_ts_config`); (e) short-circuit boletín devuelve el boletín exacto = rank 0.
>
> **Pitfall (RESEARCH #4):** la firma en el `regprocedure` cast DEBE ser EXACTA (`(text,vector,int)`) o lanza "function does not exist" → rollback (visto en 0045:48 con overload fantasma). Verificar contra el `create function` real.

---

### `app/lib/busqueda-hibrida-gate.ts` + `.test.ts` (config flag + test)

**Análogo:** `app/lib/cruces-gate.ts` + `app/lib/cruces-gate.test.ts`

Flag server-only fail-closed. `import "server-only"` (línea 1) impide el bundle del cliente. Var SIN prefijo `NEXT_PUBLIC_`. Solo el literal `"true"` enciende (NO truthiness laxa). `env` inyectado (default `process.env`) para testear offline.

```typescript
// Source: app/lib/cruces-gate.ts:37-41
import "server-only";
export function busquedaHibridaEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.BUSQUEDA_HIBRIDA_ENABLED === "true";
}
```

Test = 5 casos exactos del espejo (`cruces-gate.test.ts:6-24`): ausente→false, `"false"`→false, `"1"`→false, `"TRUE"`→false, `"true"`→true.

> **Diferencia semántica vs cruces:** este flag es INTERNO de camino (routing RPC nueva vs vieja), NO de publicación de datos → NO requiere sign-off legal para flipear; el gate de dominancia (golden live) decide el flip del default (CONTEXT línea 40).

---

### `app/lib/buscar.ts` (MODIFY — service)

**Análogo:** self. Extender el flujo existente (`buscar.ts:177-209`), conservando el contrato (`MatchProyectoRow[]`, embedder inyectable, throw-on-error).

**Rewire por flag** (insertar tras el embed, RESEARCH Code Examples):

```typescript
// Source: espejo de buscar.ts:192-208 + busqueda-hibrida-gate
const sb = createServerSupabase();
if (busquedaHibridaEnabled()) {
  const { data, error } = await sb.rpc("buscar_proyectos_hibrido", {
    q,
    query_embedding: emb.vector,
    match_count: opts.matchCount ?? 20,
  });
  if (error) throw new Error(`buscar_proyectos_hibrido RPC falló: ${error.message}`);
  return (data as MatchProyectoRow[] | null) ?? [];
}
// OFF (default): camino actual match_proyectos, SIN CAMBIOS (buscar.ts:193-208).
```

**Extender `BOLETIN_RE` → `detectarBoletin`** (RETR-01, RESEARCH Pitfall 5). Hoy `BOLETIN_RE = /^\d{3,6}(-\d{1,2})?$/` (`buscar.ts:28`) NO matchea `14.309-04`. Reemplazar el guard `if (BOLETIN_RE.test(q)) redirect(...)` (`buscar.ts:185-187`) por `detectarBoletin(q)` que normaliza el punteado y redirige al boletín full:

```typescript
// Source: espejo de buscar.ts:185-187 + boletin.ts:14-26
const bol = detectarBoletin(q);
if (bol !== null) {
  const full = bol.sufijo !== null ? `${bol.base}-${bol.sufijo}` : bol.base;
  redirect(`/proyecto/${full}`);
}
```

> **Cero cambios a "proyectos similares" (SEM-05):** `match_proyectos` con `excludeBoletin` sigue intacto (RESEARCH — LOCKED).

---

### `app/lib/lockdown-guard.test.ts` (MODIFY — guard CI)

**Análogo:** self. Agregar `"buscar_proyectos_hibrido"` al `PUBLIC_RPC_ALLOWLIST` (`lockdown-guard.test.ts:165-182`) — SIN esto el guard B (`.rpc()` fuera del allowlist) FALLA al recablear buscar.ts.

```typescript
// Source: lockdown-guard.test.ts:165-182 (Set de nombres — solo el NOMBRE, no la firma)
const PUBLIC_RPC_ALLOWLIST = new Set([
  ...
  "buscar_citaciones",
  "buscar_proyectos_hibrido",   // ← AÑADIR (orden alfabético)
  "comparar_declaraciones",
  ...
]);
```

> **Shape del entry:** solo el nombre de la RPC (string), NO la firma (`lockdown-guard.test.ts:378` extrae `.rpc('nombre'`). El guard A (grant-a-anon, línea 236) ya cubrirá 0055 automáticamente — verificar que 0055 NO contiene `grant … to anon/public` (doble-revoke sí, `grant` NO).

---

### `packages/fichas/src/spike/strategies.ts` (MODIFY — harness runner)

**Análogo:** `runSemanticOnly` (`strategies.ts:201-218`). Nueva `runRpcHibrida` = un SELECT sobre la RPC REAL vía `runSql` (psql), vector serializado a param (NUNCA interpolado, V5).

```typescript
// Source: espejo de strategies.ts:107-112 (SEMANTIC_QUERY) + :201-218 (runSemanticOnly)
const RPC_HIBRIDA_QUERY = `
select boletin, rank
from buscar_proyectos_hibrido(:q, :query_embedding::vector, :match_count::int)
order by rank
`.trim();

export async function runRpcHibrida(
  query: string, vector: number[], opts: { runSql: SqlRunner; limit?: number },
): Promise<string[]> {
  const { runSql, limit = 20 } = opts;
  const rows = await runSql(RPC_HIBRIDA_QUERY, {
    q: query,
    query_embedding: `[${vector.join(",")}]`,   // serialización idéntica a runSemanticOnly:208
    match_count: String(limit),
  });
  return rows.map((r) => r[0]!).filter(Boolean);
}
```

> Este runner mide la RPC REAL (no el SQL ad-hoc del spike `runRrf`) → es el instrumento del gate de dominancia de 87.

---

### `packages/fichas/src/spike/retrieval-cli.ts` (MODIFY — CLI)

**Análogo:** self. El CLI ya evalúa 3 estrategias (`retrieval-cli.ts:206-221`: `metricasFts`/`metricasSem`/`metricasRrf` vía `evaluarRetrieval(GOLDEN_SET, …)`). Añadir una 4ª columna `rpc-real` que llame `runRpcHibrida` sobre el MISMO `GOLDEN_SET` congelado, reusando `getCachedEmbeddings` (`:25,197`) y `runSql` intactos.

```typescript
// Source: espejo de retrieval-cli.ts:211-215 (metricasSem)
const metricasRpc = await evaluarRetrieval(GOLDEN_SET, (caso) => {
  const vector = vectorMap.get(caso.query)!;
  return runRpcHibrida(caso.query, vector, { runSql, limit: opts.limit });
});
```

> Import `runRpcHibrida` en la línea 24 (junto a `runFtsOnly, runSemanticOnly, runRrf`). Agregar la columna al reporte markdown.

---

### `app/lib/boletin-detector.ts` (create OR reuse) (utility)

**Análogo:** `packages/fichas/src/spike/boletin.ts::detectarBoletin` (`boletin.ts:14-26`). Ya maneja los 3 formatos + distingue decimal (`3.14`) de boletín (`14.309`). RESEARCH Wave 0 Gap: mover a un módulo compartido consumible por `app/` (o duplicar la lógica en `app/lib/` con su test). El detector es puro/offline → test directo (fuente única #36, espejo de cómo `BOLETIN_RE` se importa de `buscar.ts`).

```typescript
// Source: boletin.ts:14-26 — puro, testeable offline
export function detectarBoletin(q: string): { base: string; sufijo: string | null } | null { … }
```

---

## Shared Patterns

### RPC lockdown post-0044 (definer + search_path='' + doble-revoke + CERO grant)
**Source:** `supabase/migrations/0049_cruces_de_proyecto.sql:56-115`
**Apply to:** la RPC de 0055
- `language sql stable security definer set search_path = ''`
- TODO schema-qualified (incl. `public.es_unaccent` — RESEARCH Pitfall 1)
- `drop function if exists … (firma)` defensivo antes del create (42P13)
- doble-revoke `from public` + `from anon, authenticated`, CERO grant (`service_role` ejecuta por bypass)

### FTS spanish + GIN + websearch_to_tsquery
**Source:** `supabase/migrations/0032_agenda_search.sql:32-33,59`
**Apply to:** SECCIÓN 3 (GIN) + SECCIÓN 4 (rama full_text) de 0055
- `websearch_to_tsquery` SIEMPRE (nunca `to_tsquery` crudo → 500s)
- GIN sobre la expresión tsv del título (peso A caliente)
- LEFT JOIN a `proyecto_ficha` (NO generated column — cruza tablas)

### Flag server-only fail-closed
**Source:** `app/lib/cruces-gate.ts:37-41` + `cruces-gate.test.ts:6-24`
**Apply to:** `busqueda-hibrida-gate.ts` + test
- `import "server-only"`, sin `NEXT_PUBLIC_`, `env.X === "true"` (literal), `env` inyectado, 5 casos de test

### pgTAP post-apply (aclexplode PUBLIC sin EXECUTE)
**Source:** `supabase/tests/post-apply/0045_revoke_public_rpc_gap.test.sql:16-26`
**Apply to:** `0055_busqueda_hibrida.test.sql`
- `begin; plan(N); … finish(); rollback;`
- `aclexplode` con `grantee = 0` para PUBLIC (no `has_function_privilege('public',…)`)
- firma EXACTA en `regprocedure` cast

### Guard CI allowlist (extend, no bypass)
**Source:** `app/lib/lockdown-guard.test.ts:165-182`
**Apply to:** toda RPC nueva consumida por `app/`
- agregar el NOMBRE al `PUBLIC_RPC_ALLOWLIST` (Set); la firma NO
- verificar que la migración nueva NO dispara el guard A (grant-a-anon)

### Serialización de vector como param (V5, nunca interpolado)
**Source:** `strategies.ts:208` (`const vectorStr = ` + backtick + `[${vector.join(",")}]` + backtick)
**Apply to:** `runRpcHibrida` en el harness; en `buscar.ts` es `.rpc()` que parametriza nativamente

### Ledger de aplicación (psql UTF8, NUNCA db push)
**Source:** convención CLAUDE.md + RESEARCH Q8 (patrón 0045/0046/0053/0054)
**Apply to:** aplicar 0055
- `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0055_busqueda_hibrida.sql`
- INSERT en `schema_migrations` versión `0055_busqueda_hibrida`
- correr el pgTAP post-apply a mano tras aplicar
- ADITIVA → NO requiere checkpoint de operador (CONTEXT línea 47)

---

## No Analog Found

Ninguno. Los 8 archivos tienen análogo exacto en el repo. Esta es una fase de **transcripción** (el SQL RRF ya corrió y se midió en el spike 86; el idiom de lockdown ya está en PROD via 0049; el flag/harness/guard son espejos verbatim). No hay que inventar algoritmo — solo portar lo medido a una RPC gobernada.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/post-apply/`, `app/lib/`, `packages/fichas/src/spike/`
**Files scanned:** 9 leídos íntegros (0049, 0032, cruces-gate.ts, cruces-gate.test.ts, buscar.ts, lockdown-guard.test.ts, 0045 post-apply, strategies.ts, boletin.ts) + retrieval-cli.ts (grep) + Glob de migraciones 005*
**Última migración confirmada:** `0054` → nueva `0055`
**Pattern extraction date:** 2026-07-21
