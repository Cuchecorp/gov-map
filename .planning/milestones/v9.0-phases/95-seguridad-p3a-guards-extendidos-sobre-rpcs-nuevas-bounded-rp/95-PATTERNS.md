# Phase 95: SEGURIDAD P3a — Guards extendidos sobre RPCs nuevas + bounded RPCs - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 4 (2 migration/pgTAP, 2 guard extensions)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` | migration | CRUD (DDL re-emit) | `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql` | exact |
| `supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql` | test (pgTAP) | request-response | `supabase/tests/post-apply/0057_busqueda_hibrida_statement_timeout.test.sql` | exact |
| `app/lib/lockdown-guard.test.ts` (extend) | test (CI guard) | batch (static scan) | `app/lib/lockdown-guard.test.ts` (existing Block A/B) | self-analog (extend) |
| `app/lib/anti-insinuacion-guard.test.ts` (extend) | test (CI guard) | batch (static scan) | `app/lib/anti-insinuacion-guard.test.ts` (existing, all surface arrays) | self-analog (verify/extend) |

---

## Pattern Assignments

### `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` (migration, DDL re-emit)

**Analog:** `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql`

**Header comment pattern** (lines 1-16 of 0057):
```sql
-- 0064_bounded_rpc_statement_timeout.sql
-- Phase 95 — SC#2 DoS bounding: añade statement_timeout = '5s' a las 10 RPCs de
-- 0060/0061/0063 que tienen LIMIT pero cero statement_timeout.
-- Orden de apply: DESPUÉS de 0063_lobby_menciones_una_fila_por_audiencia.sql
-- Aplicar: PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0064_bounded_rpc_statement_timeout.sql
-- NUNCA supabase db push (drift schema_migrations).
-- Migración ADITIVA: create or replace function (idiom 42P13 — drop explícito previo).
-- Sin backfill, sin DDL destructivo → dentro de la autoridad del agente (precedente 0055-0063).
-- ACL: CERO grant. Doble-revoke al final de cada RPC.
```

**Drop + create-or-replace pattern** (lines 17-28 of 0057 — the exact idiom to replicate per RPC):
```sql
-- Drop previo para allow create-or-replace sin error de tipo (idiom 42P13)
drop function if exists public.<name>(<exact-args>);

create or replace function public.<name>(<exact-args>)
returns table ( <BYTE-IDENTICAL returns table from 0060/0061/0063> )
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'   -- SC#2: day-1 DoS cap
as $$
  <VERBATIM body from 0060/0061/0063 — unchanged>
$$;
```

**CRITICAL — exact args and returns tables per RPC** (from RESEARCH.md §Inventory):
- `parlamentario_publico_v2(text)` → 13 cols (id, nombre, camara, region, distrito, circunscripcion, periodo, origen, fecha_captura, enlace, partido, partido_fecha_captura, partido_origen) — from `0060_bio_partido_publico.sql` lines 51-57
- `parlamentarios_publico_v2()` → 10 cols incl. partido — from 0060
- `militancias_de_parlamentario(text)` → (partido text, desde date, hasta date, es_actual boolean, origen text, fecha_captura timestamptz, enlace text) — from 0060
- `comisiones_de_parlamentario(text)` → (nombre text, camara text, tipo text, cargo text, origen text, fecha_captura timestamptz, enlace text) — from 0060
- `copartidarios_de_parlamentario(text)` → (id text, nombre text, camara text, total_n bigint) — from 0061
- `de_la_misma_zona(text)` → (id text, nombre text, camara text, total_n bigint) — from 0061
- `co_comisionados_de_parlamentario(text)` → (id text, nombre text, camara text, comision_nombre text, total_n bigint) — from 0061
- `coautores_de_parlamentario(text)` → (id text, nombre text, camara text, n_proyectos int, total_n bigint) — from 0061
- `lobby_menciones_de_boletin(text)` → 13 cols (see 0063) — from 0063
- (optional) `match_proyectos` — verify current signature in 0028/0045 before re-emitting

**ACL doble-revoke pattern** (lines 120-124 of 0057 — VERBATIM after each RPC):
```sql
revoke all on function public.<name>(<exact-args>) from public;
revoke all on function public.<name>(<exact-args>) from anon, authenticated;
-- CERO grant: re-emitir uno re-abriría superficie REST no autenticada (guard CI Block-A).
```

**Key distinctions from 0057:**
- 0057 is `language plpgsql`; the 10 target RPCs are `language sql` — keep `language sql`
- Use function-attribute form `set statement_timeout = '5s'` (NOT `set local` inside body) — this lands in `pg_proc.proconfig` which is what pgTAP asserts
- Both `set search_path = ''` and `set statement_timeout = '5s'` are function-storage options on separate lines (matching 0057 lines 27-28)
- 4 cross-links (0061) have `total_n bigint` in returns table — byte-identical copy is REQUIRED or 42P13 aborts the whole `--single-transaction`

---

### `supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql` (pgTAP, post-apply)

**Analog:** `supabase/tests/post-apply/0057_busqueda_hibrida_statement_timeout.test.sql`

**File header pattern** (lines 1-7 of 0057 test):
```sql
-- 0064_bounded_rpc_statement_timeout.test.sql  (POST-APPLY ONLY)
--
-- Verifica SC#2: statement_timeout configurado en las 10 RPCs re-emitidas en 0064.
-- POST-APPLY ONLY: corre DESPUÉS de aplicar 0064 contra PROD.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0064_bounded_rpc_statement_timeout.test.sql
-- Debe reportar N ok, 0 not ok.
```

**plan/finish/rollback wrapper** (from 0057 lines 9-10, 63-64):
```sql
begin;
select plan(N);  -- N = number of asserts (4 per RPC × 10 RPCs = 40, adjust)

-- ... asserts ...

select * from finish();
rollback;
```

**has_function assert** (lines 13-18 of 0057 — per RPC):
```sql
select has_function(
  'public',
  '<name>',
  array['text'],   -- or '{}'::text[] for parlamentarios_publico_v2()
  '<name>(text) existe tras 0064'
);
```

**no-anon-execute assert** (lines 21-30 of 0057 — using aclexplode, NOT has_function_privilege):
```sql
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.oid = 'public.<name>(text)'::regprocedure
     and a.grantee = 0
     and a.privilege_type = 'EXECUTE'),
  0,
  'PUBLIC sin EXECUTE en <name> tras 0064 (SC#2 ACL intacta)'
);
```

Note: use `aclexplode` (not `has_function_privilege('anon',…)`) — this is the idiom verified in 0055/0057; `grantee = 0` = PUBLIC pseudo-role.

**statement_timeout assert** (lines 32-41 of 0057 — VERBATIM per RPC, this is the core SC#2 proof):
```sql
select ok(
  exists(
    select 1
    from pg_proc p
    cross join lateral unnest(p.proconfig) as cfg
    where p.oid = 'public.<name>(text)'::regprocedure
      and cfg like 'statement_timeout=%'
  ),
  'statement_timeout configurado en <name> (SC#2 DoS cap)'
);
```

**PII-safe assert** (from 0055 pgTAP idiom — `pg_get_function_result`):
```sql
select ok(
  pg_get_function_result('public.<name>(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  '<name> no proyecta columnas PII (rut/email/partido_alias)'
);
```

Note: `partido text` is NOT PII per operator decision 2026-07-21 (public elected official). The regex must NOT block `partido` — only `partido_alias`.

**regprocedure cast format** (verified in 0055/0057):
- `parlamentario_publico_v2(text)` → `'public.parlamentario_publico_v2(text)'::regprocedure`
- `parlamentarios_publico_v2()` → `'public.parlamentarios_publico_v2()'::regprocedure` (no args)
- Type spellings: use `text`, `integer` (not `int`); `vector` (unqualified) works in regprocedure

---

### `app/lib/lockdown-guard.test.ts` (extend — add Direction-B assert + mutation self-check)

**Analog:** `app/lib/lockdown-guard.test.ts` itself — Block A `anonGrantOffenders()` function as the pure-detector pattern; Block B as the fs-scan pattern.

**Direction-B assert to add** — allowlist ⊆ defined functions (new Block A2 / separate describe block):

Copy the detector-function-then-assert pattern from `anonGrantOffenders()` (lines 219-227) and `stripSqlComments()` (lines 56-61). The new pure detector:

```typescript
// Pure detector — testeable (used by mutation self-check)
function definedRpcNames(migrationsDir: string): Set<string> {
  const defined = new Set<string>();
  for (const f of readdirSync(migrationsDir).filter(x => x.endsWith(".sql"))) {
    const sql = stripSqlComments(readFileSync(path.join(migrationsDir, f), "utf-8"));
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi)) {
      defined.add(m[1]);
    }
  }
  return defined;
}
```

Scope: repo-wide (ALL migrations, NOT filtered to `>0044`) — `match_proyectos`/`parlamentario_publico`/`parlamentarios_publico` are defined pre-0044 and must still be backed.

**Direction-B it() block pattern** (mirror of the A1/A2 it() shape at lines 246-273):
```typescript
it("toda entrada de PUBLIC_RPC_ALLOWLIST corresponde a una función definida en migraciones (SC#3 Direction-B)", () => {
  const defined = definedRpcNames(MIGRATIONS_DIR);
  const orphans = [...PUBLIC_RPC_ALLOWLIST].filter(n => !defined.has(n));
  expect(
    orphans,
    `Allowlist con entradas sin función en supabase/migrations/ (typo/stale): [${orphans.join(", ")}] — corrige el nombre o elimina la entrada`,
  ).toHaveLength(0);
});
```

**Mutation self-check for Direction-B** (mirror of the `it("BLOQUEA todo grant…")` block at lines 299-346):
```typescript
it("Direction-B self-check: detecta entrada fantasma en allowlist (SC#4)", () => {
  // Allowlist sintético con una entrada inventada, set de funciones definidas vacío
  const ghostAllowlist = new Set(["funcion_fantasma_typo"]);
  const emptyDefined = new Set<string>();
  const orphans = [...ghostAllowlist].filter(n => !emptyDefined.has(n));
  expect(orphans).toHaveLength(1);  // debe detectar la entrada stale
  expect(orphans[0]).toBe("funcion_fantasma_typo");
});
```

**Where to insert:** after the existing Block A describe (line 347) and before Block B describe (line 353). The new describe label: `"(A2) Guard — toda entrada del allowlist existe en migraciones (Direction-B, SC#3)"`.

**Existing patterns to reuse verbatim:**
- `stripSqlComments()` function (lines 56-61) — already in scope, no duplication needed
- `MIGRATIONS_DIR` constant (line 46) — already in scope
- `PUBLIC_RPC_ALLOWLIST` Set (lines 165-192) — already in scope

---

### `app/lib/anti-insinuacion-guard.test.ts` (extend — verify Phase-89 surface; add if missing)

**Analog:** `app/lib/anti-insinuacion-guard.test.ts` itself — `SUPERFICIES_AGENDA` / `SUPERFICIES_PERSONAS` arrays (lines 261-267 / 184-192) as the surface-array pattern; mutation self-check blocks for each surface as the self-check pattern.

**Finding:** Phase-89 deep-link surface is `app/components/validacion-fuente.tsx` (TRACE-01/02/03). The component's copy is factual (Senado link URLs, BCN hash, fetch date) — grep confirmed zero insinuating terms. It is NOT currently in any surface array. However, per CONTEXT: "extender solo si el linter no cubre alguna superficie de P1" — since the content is factual and won't insinuate, adding it is LOW PRIORITY but still warranted as a preventive tripwire (same rationale as SUPERFICIES_HOME).

**Surface array addition pattern** (copy shape from lines 145-148 for SUPERFICIES_HOME):
```typescript
/**
 * Superficies DEEP-LINK (89-03, TRACE-01/02/03). El bloque "Valida este dato en la fuente"
 * de la ficha de proyecto renderiza URLs de fuente oficial (Senado/BCN/R2) + fecha de captura.
 * Copy actual factual (TRACE: URLs reproducibles, fecha, hash) → superficie limpia;
 * tripwire PREVENTIVO para copy futuro. validacion-fuente.tsx es el single-source; también
 * cubre el componente de provenance-badge si rende copy nuevo.
 */
const SUPERFICIES_DEEPLINK: string[] = [
  "components/validacion-fuente.tsx",
  "components/provenance-badge.tsx",
];
```

**How to integrate:** add `...SUPERFICIES_DEEPLINK` to the spread in the main scan loop (line 457):
```typescript
for (const rel of [...SUPERFICIES_VOTO, ...SUPERFICIES_MONEY, ...SUPERFICIES_HOME,
                    ...SUPERFICIES_BUSQUEDA, ...SUPERFICIES_PERSONAS, ...SUPERFICIES_LOBBY,
                    ...SUPERFICIES_AGENDA, ...SUPERFICIES_DEEPLINK]) {
```

**Mutation self-check pattern for new surface** (mirror of existing self-checks after line 515):
```typescript
it("DEEPLINK: detecta insinuación inyectada en fixture de validacion-fuente (SC#4)", () => {
  const fixtureDeepLink = `
    <p>Este dato fue obtenido gracias a la influencia del parlamentario sobre la tramitación.</p>
  `;
  const hits = detectarInsinuaciones(fixtureDeepLink);
  expect(hits).toContain("influencia");
});
```

**No NEGACIONES_LOCKED addition needed** — `validacion-fuente.tsx` copy is factual (URLs, dates, hashes); it does NOT contain any banned term used as a negation.

**Existing patterns to reuse verbatim:**
- `detectarInsinuaciones()` function (lines 417-432) — pure detector, call as-is; no modification
- `stripTsComments()` (lines 76-88) — already in scope via `detectarInsinuaciones`
- `APP_ROOT` anchor on `import.meta.dirname` (line 64) — use this, NOT `process.cwd()` (Pitfall 5, MEMORY v8.1)

---

## Shared Patterns

### Migration apply command (LOCKED — all migrations)
**Source:** `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql` lines 6-7
```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f supabase/migrations/0064_…sql
```
NEVER `supabase db push`. BOM in `.env` → pass `--db-url` explicitly (from MEMORY.md).

### pgTAP runner (LOCKED — post-apply tests)
**Source:** `supabase/tests/post-apply/0057_busqueda_hibrida_statement_timeout.test.sql` line 6
```
PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/post-apply/0064_…test.sql
```
NEVER `supabase test db` (stale headers per MEMORY.md). Run ONLY after the `psql --single-transaction` apply succeeds.

### ACL doble-revoke (LOCKED — every RPC in every migration > 0044)
**Source:** `supabase/migrations/0057_busqueda_hibrida_statement_timeout.sql` lines 120-124
```sql
revoke all on function public.<name>(<exact-args>) from public;
revoke all on function public.<name>(<exact-args>) from anon, authenticated;
```

### Pure-detector + mutation self-check pattern (all guard extensions)
**Source:** `app/lib/lockdown-guard.test.ts` `anonGrantOffenders()` (lines 219-227) + its self-check (lines 299-346); `app/lib/anti-insinuacion-guard.test.ts` `detectarInsinuaciones()` (lines 417-432) + its self-checks (lines 485-530+)

The pattern: (1) extract the detection logic into a pure function that takes a string and returns offenders[], (2) use that function in the real it() scan over disk files, (3) use that SAME function in a mutation self-check it() with an in-memory fixture — never touch real files in the self-check. This ensures the guard bites and is not a green no-op.

### Sanity assert (all guard extensions that scan files)
**Source:** `app/lib/lockdown-guard.test.ts` line 357 + `app/lib/anti-insinuacion-guard.test.ts` line 449-452
Any new scan must have a sanity it() that fails loud if zero files/entries were scanned:
```typescript
it("sanity: definedRpcNames encontró al menos 20 funciones (el glob no está vacío)", () => {
  expect(definedRpcNames(MIGRATIONS_DIR).size).toBeGreaterThan(20);
});
```

---

## No Analog Found

All files have strong analogs. No entries.

---

## Anti-Patterns (verified from RESEARCH.md)

| Anti-Pattern | Risk | Correct Pattern |
|---|---|---|
| `set local statement_timeout` inside function body | NOT in `pg_proc.proconfig` → pgTAP `cfg like 'statement_timeout=%'` fails | Function-attribute `set statement_timeout = '5s'` on the `create or replace` header |
| Changing any returns table in 0064 | 42P13 mid `--single-transaction` → apply aborts | Byte-identical returns tables from 0061/0063 |
| Static bounded-ness assert over ALL `>0044` migrations | Fails on 0048/0049/0050 which legitimately lack timeout | Scope to 0064 specifically OR rely on pgTAP (Claude's discretion — pgTAP is higher-fidelity) |
| `aclexplode` grantee check vs `has_function_privilege('anon',…)` | `has_function_privilege` inconsistent in pgTAP context | `aclexplode(p.proacl) where grantee = 0` (0055 idiom) |
| `process.cwd()` in new guard code | cwd bug (MEMORY v8.1) → scans zero files, passes vacuously | `import.meta.dirname` (anti-insinuacion pattern, line 64) |

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/post-apply/`, `app/lib/`
**Files scanned:** 0057 migration, 0057 pgTAP test, 0055 pgTAP test, lockdown-guard.test.ts (421 lines, full), anti-insinuacion-guard.test.ts (530+ lines, full), 0060 migration (80 lines), `validacion-fuente.tsx` (grep only), `app/proyecto/[boletin]/page.tsx` (grep + partial read)
**Pattern extraction date:** 2026-07-23
