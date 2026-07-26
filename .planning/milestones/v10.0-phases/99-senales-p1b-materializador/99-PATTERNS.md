# Phase 99: SEÑALES P1b — Materializador `actualidad_senal` + RPCs bounded + cron intradía - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 8 (7 new + 1 modified)
**Analogs found:** 8 / 8 (all exact — RESEARCH.md pre-located every analog with line refs; verified against live code)

Phase 99 invents nothing: it mirrors three in-production patterns (`0039` señal materializada, `0064` bounded RPC, `leyes-weekly` cron CLI) and applies the 3 locked data defects from the SPIKE. Every excerpt below is copy-ready with exact source file + line ranges.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0065_actualidad_senal.sql` (NEW) | migration (table + proc + pg_cron) | batch / event-driven (cron) | `supabase/migrations/0039_cruce_senal.sql` | exact |
| `supabase/migrations/0066_actualidad_rpc.sql` (NEW) | migration (bounded RPC) | request-response (read) | `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` | exact |
| `supabase/tests/0065_actualidad_senal.test.sql` (NEW) | test (pgTAP) | test | `supabase/tests/0039_cruce_senal.test.sql` | exact |
| `app/lib/lockdown-guard.test.ts` (MODIFIED) | test / config (allowlist) | config | itself, L165-192 (`PUBLIC_RPC_ALLOWLIST`) | exact (in-file) |
| `packages/actualidad/src/run-actualidad-prod-cli.ts` (NEW) | CLI (service_role writer) | batch | `packages/tramitacion/src/run-tramitacion-prod-cli.ts` | role-match |
| `packages/actualidad/src/kmeans.ts` (NEW) | utility (clustering) | transform | *no analog* — see §No Analog Found | none |
| `.github/workflows/actualidad-refresh.yml` (NEW) | config (CI cron) | event-driven (schedule) | `.github/workflows/leyes-weekly.yml` | exact (minus R2) |
| `packages/actualidad/package.json` (NEW) + `pnpm-workspace.yaml` (auto) | config | — | any `packages/*/package.json`; workspace glob `packages/*` already matches | exact |

**Migration head verified:** current head is `0064` (ls of `supabase/migrations`). Next numbers are `0065` (table+proc+cron) and `0066` (RPC). Workspace glob `packages/*` in `pnpm-workspace.yaml` picks up `@obs/actualidad` with no manual edit — just add the dir.

---

## Pattern Assignments

### `supabase/migrations/0065_actualidad_senal.sql` (migration — table + full-rebuild proc + pg_cron)

**Analog:** `supabase/migrations/0039_cruce_senal.sql` (read complete, 155 lines)

**A. Deny-by-default table** (0039 L45-69). Copy the RLS-enabled + `revoke all` + provenance-inline shape. `actualidad_senal` differs in columns (see RESEARCH §Code Examples L273-298 for the proposed schema) but the security envelope is byte-identical:

```sql
-- 0039 L62-69 — DENY-BY-DEFAULT envelope to mirror verbatim
alter table cruce_senal enable row level security;
revoke all on cruce_senal from anon, authenticated;
create index cruce_senal_parlamentario_idx on cruce_senal (parlamentario_id);
create index cruce_senal_sector_idx        on cruce_senal (sector_id);
```
For `actualidad_senal`: `enable row level security; revoke all on actualidad_senal from anon, authenticated;` + `create index actualidad_senal_tipo_idx on actualidad_senal (tipo_senal);`. Provenance inline NOT NULL (0039 L54-58: `dataset/origen/fecha_captura/enlace`) — carry over.

**B. Full-rebuild proc, own schema, security definer** (0039 L79-122). This is the exact molde:

```sql
-- 0039 L79-85
create schema if not exists cruces;

create or replace function cruces.materializar_cruces()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- FULL REBUILD transaccional (D-11): borra el estado previo y reconstruye desde los hechos.
  delete from public.cruce_senal;
  ...
```
For 99: `create schema if not exists actualidad;` + `create or replace function actualidad.materializar_senales() returns void language plpgsql security definer set search_path = '' as $$`. **CRITICAL delta (RESEARCH §Cron split L209-214, Pitfall 5):** the `delete` must be scoped to the temporal `tipo_senal` set, NOT a global `delete from public.actualidad_senal` — the CLI owns `'agrupacion_materia'`:
```sql
delete from public.actualidad_senal
 where tipo_senal in ('velocity','nuevos_ingresos','urgencias',
                      'agenda_citacion','agenda_sala','archivados');
```
`set search_path = ''` forces schema-qualified names (`public.tramitacion_evento`). Each `insert … select` applies the 3 locked defects — see §Shared Patterns "Data Defects".

**C. pg_cron schedule + version guard + post-migration assertion** (0039 L124-154). Mirror verbatim, change jobname + expr:

```sql
-- 0039 L127-154 — copy this DO-block pair exactly
do $$
declare v_ext_version text;
begin
  select extversion into v_ext_version from pg_extension where extname = 'pg_cron';
  if v_ext_version is null then
    raise exception 'pg_cron no esta instalado: no se puede programar la materializacion';
  end if;
  perform cron.schedule('cruces-materializar','23 3 * * *',
    $cron$ select cruces.materializar_cruces(); $cron$);
end;
$$;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'cruces-materializar') then
    raise exception 'cron job cruces-materializar no quedo registrado: materializacion no programada';
  end if;
end;
$$;
```
For 99: jobname `'actualidad-materializar'`, expr intradía L-V (RESEARCH suggests `'7 11,14,17,20 * * 1-5'`), body `select actualidad.materializar_senales();`.

**Migration header (0039 L1-15, 0064 L1-7):** open with `-- 0065_actualidad_senal.sql` + the apply-command warning: `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f …` — NUNCA `supabase db push` (drift schema_migrations). Note apply = operator checkpoint (build/typecheck are false positives; only pgTAP vs applied schema proves it).

---

### `supabase/migrations/0066_actualidad_rpc.sql` (migration — bounded read RPC)

**Analog:** `supabase/migrations/0064_bounded_rpc_statement_timeout.sql` (read complete, 386 lines — 9 RPCs, all identical shape)

**Bounded RPC molde** (0064 L27-62, canonical single-RPC example):

```sql
-- 0064 L27-62 — the aguja-completa shape to mirror
drop function if exists public.parlamentario_publico_v2(text);        -- idiom 42P13: drop BEFORE create-or-replace

create or replace function public.parlamentario_publico_v2(p_id text)
returns table ( id text, nombre text, camara text, ... )
language sql stable security definer
  set search_path = ''
  set statement_timeout = '5s'
as $$
  select ...
  from public.parlamentario p
  where p.id = p_id;
$$;

revoke all on function public.parlamentario_publico_v2(text) from public;
revoke all on function public.parlamentario_publico_v2(text) from anon, authenticated;
```

For 99 (RESEARCH §Bounded RPCs L216-224 + §Code Examples L342-362):
```sql
drop function if exists public.actualidad_senales_panel(text);
create or replace function public.actualidad_senales_panel(p_tipo text default null)
returns table (tipo_senal text, ventana text, conteo int, cobertura_camara text,
               materia text, cluster_id int, fecha_max timestamptz,
               supresion_causa text, evidencia jsonb)
language sql stable security definer
  set search_path = '' set statement_timeout = '5s'
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
Non-negotiables copied from 0064: `security definer` + `set search_path=''` + `set statement_timeout='5s'` + explicit `LIMIT` + **double-revoke** (from `public` AND from `anon, authenticated`). ZERO grant. `p_tipo` filter is parametric (`where p_tipo is null or …`) — no SQL string-building (ASVS V5). The RPC MUST then be added to the allowlist (next file), or the guard bites.

---

### `supabase/tests/0065_actualidad_senal.test.sql` (pgTAP)

**Analog:** `supabase/tests/0039_cruce_senal.test.sql` (read complete, 119 lines)

Mirror the structure: `begin; select plan(N); … seed (owner bypasses RLS) … select actualidad.materializar_senales(); … assertions … select * from finish(); rollback;`

**Assertions to copy (0039 L57-116):**
```sql
-- table exists + RLS enabled (0039 L57-60)
select has_table('public', 'actualidad_senal', 'tabla actualidad_senal existe');
select is((select count(*)::int from pg_class where relname='actualidad_senal' and relrowsecurity=true), 1, 'RLS enabled');

-- deny-by-default: zero policies (0039 L63-65)
select is((select count(*)::int from pg_policies where tablename='actualidad_senal'), 0, 'sin policies');

-- proc is security definer (0039 L68-73)
select is((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='actualidad' and p.proname='materializar_senales'), true, 'security definer');

-- no-PII body check (0039 L77-82) — STRIP comments, word-boundary match
select ok((select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
             from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='actualidad' and p.proname='materializar_senales')
          !~* '\y(partido|rut)\y', 'cuerpo NO contiene partido ni rut (no-PII)');

-- cron registered (0039 L105-107)
select is((select count(*)::int from cron.job where jobname='actualidad-materializar'), 1, 'cron registrado');

-- anon denied direct read → 42501 (0039 L110-116)
set local role anon;
select throws_ok($$ select id from actualidad_senal $$, '42501', null, 'anon NO lee directamente');
reset role;
```

**Phase-99-specific assertions (from SPIKE defects, RESEARCH §Validation L427-432):** seed rows that exercise the 3 locked defects and verify they are handled:
- seed a `tramitacion_evento` with `fecha > current_date` (the `2626-05-25` typo) → assert it feeds NO señal (`fecha <= current_date` filter works).
- seed both `camara` spellings (`C.Diputados` / `C. Diputados`) → assert they collapse to one bucket after `regexp_replace(camara,'\s+','','g')`.
- seed a stale source (`max(fecha)` beyond threshold) → assert a suppression row appears with `supresion_causa` (never a 0-as-fact row).

Header note: pgTAP runs `psql -tA -f` against the APPLIED schema; build/typecheck are false positives (0039 L11, Pitfall 5).

---

### `app/lib/lockdown-guard.test.ts` (MODIFIED — add RPC to allowlist)

**Analog:** the file itself, `PUBLIC_RPC_ALLOWLIST` at L165-192 (read).

Insert `"actualidad_senales_panel"` into the alphabetical `Set` (L165-192). It sorts FIRST (before `"agregado_por_contraparte"` at L166):
```ts
const PUBLIC_RPC_ALLOWLIST = new Set([
  "actualidad_senales_panel",       // <-- ADD (Phase 99, first alphabetically)
  "agregado_por_contraparte",
  ...
```
**Why load-bearing (guard L160-227):** under Camino A the public tree reads with `service_role`, which can execute ANY RPC — the DB no longer blocks it, so the guard (Direction-B) FAILS if the web tree calls an RPC outside this list. The separate `anonGrantOffenders` guard (L219-227) means the `0066` migration must NEVER `grant … to anon/public` (double-revoke only). If two RPCs are added, add both entries.

---

### `packages/actualidad/src/run-actualidad-prod-cli.ts` (CLI — service_role writer, k-means layer)

**Analog:** `packages/tramitacion/src/run-tramitacion-prod-cli.ts` (read L1-75)

Copy the connect + BOM-safe env-loading molde:
```ts
// L28-30 imports
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// L49-50 — createClient(url, serviceKey) adapter
const createSupabaseClient = (url, serviceKey) => createClient(url, serviceKey);

// L64-75 -- loadEnv: BOM-safe (strips a leading BOM = U+FEFF), process.env PRECEDES the file (CI injects secrets there)
function loadEnv(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(root, ".env"), "utf8").replace(/^\uFEFF/, ""); // strip leading BOM
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch { /* CI: secrets from process.env */ }
  // then overlay process.env for [SUPABASE_API_URL, SUPABASE_SECRET_KEY]
  ...
}
```
Credentials come from `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` ONLY (never argv). **PostgREST 1k cap:** any read over `proyecto_embedding` must paginate `.select().order().range()` (CLAUDE.md memory: PostgREST caps at 1000 rows). Argv flag helper: `flagValue(name)` (L55-58).

The CLI's job: read embeddings, run k-means (see `kmeans.ts`), full-rebuild ONLY `tipo_senal='agrupacion_materia'` (`delete … where tipo_senal='agrupacion_materia'` + insert one row per cluster) — disjoint from the SQL proc's set (no race).

**Embeddings source** (`0011_fichas_embeddings.sql` L36-45): `proyecto_embedding(boletin PK, embedding vector(768), embedding_model/dims/version)`, public-read (L78/81). Join to `proyecto` by `boletin`. Cosine distance (dot-product on normalized Gemini vectors in TS = `<=>` in SQL). Coverage ~84.6% (15.4% no embedding) → declare cluster coverage.

**Materia label** (`0008_tramitacion.sql` L26): `proyecto.materia text` (official taxonomy). Cluster label = `mode()` of member `materia` (TS: count frequencies, take max; tie → alphabetical, deterministic). JAMÁS LLM.

---

### `.github/workflows/actualidad-refresh.yml` (CI cron — intraday L-V, NO R2)

**Analog:** `.github/workflows/leyes-weekly.yml` (read complete, 76 lines)

Clone the entire scaffold (checkout@v4.3.1 pinned SHA L43, pnpm/action-setup L46, node 22 + pnpm cache L48-52, `pnpm install --frozen-lockfile --ignore-scripts` L56) and change:
1. **cron** L19: `"0 11,14,17,20 * * 1-5"` (intraday L-V; RESEARCH §Cron split L212).
2. **DELETE the R2 env block** (L62-66: `R2_ACCESS_KEY_ID/SECRET/ENDPOINT_URL/BUCKET`) — Phase 99 touches NO sources, so no R2, no rate-limit, no robots.txt. Keep ONLY `SUPABASE_API_URL` + `SUPABASE_SECRET_KEY` (L60-61).
3. **run step** L75: `pnpm --filter @obs/actualidad exec tsx src/run-actualidad-prod-cli.ts $ARGS`.
4. keep `permissions: contents: read` (L31-32), `concurrency` group renamed (L34-36), `workflow_dispatch` inputs (L20-29).

```yaml
# keep this env block ONLY (drop the 4 R2_* lines from L62-66):
env:
  SUPABASE_API_URL: ${{ secrets.SUPABASE_API_URL }}
  SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
```
Note the inputs-by-ENV pattern (L67-70) to avoid shell injection in a step carrying the secret key.

---

## Shared Patterns

### Data Defects (LOCKED — apply in EVERY aggregation of the proc)
**Source:** 98-SPIKE-FINDINGS §2; RESEARCH §Cómputo por señal L190-199.
**Apply to:** every `insert … select` in `actualidad.materializar_senales()`.
```sql
-- 1. kill future-dated typo rows (fecha='2626-05-25') in EVERY window/max:
where fecha <= current_date
-- 2. normalize camara BEFORE grouping (two spellings C.Diputados / C. Diputados):
coalesce(nullif(regexp_replace(camara,'\s+','','g'),''), '(sin cámara)')
-- 3. camara IS NULL (2261 rows) → literal '(sin cámara)', NEVER redistributed
```
Reference velocity insert (RESEARCH §Code Examples L314-322) groups by the normalized+coalesced expression. Clock rule (SPIKE §4): every temporal señal anchors to `tramitacion_evento.fecha`, NEVER `fecha_captura` (fecha_captura = scrape date; 44847 events share `2026-07-10`).

### Suppression-as-row (ausencia ≠ hecho)
**Source:** SPIKE §4; RESEARCH Pitfall 1 L240-243, Anti-Patterns L171.
**Apply to:** every señal in the proc + `agenda_sala` in particular.
When a source's `max(fecha)` exceeds the stale threshold → emit a ROW with `supresion_causa='sin datos frescos de esta fuente'`, never a missing row and never 0-as-fact. `sesion_sala` with zero future rows → row with `supresion_causa='sin sesiones agendadas en las fuentes consultadas'`. (Open Question A5/#2: stale threshold may live only in `pnpm freshness` TS — planner decides hardcode-in-proc vs compute-in-CLI.)

### tz-Chile date-only (agenda "future" cut)
**Source:** `app/lib/dia-calendario.ts` (read complete); RESEARCH Pitfall 6 L265-268.
**Apply to:** `agenda_citacion` / `agenda_sala` inserts.
`citacion.fecha` / `sesion_sala.fecha` are date-only-midnight-UTC = Chilean calendar day. In SQL compare `fecha::date >= current_date` directly — NEVER `at time zone 'America/Santiago'` (retrocedes one day). The contract doc: "la PARTE FECHA UTC … YA ES el día calendario chileno … NO se debe convertir de zona" (L11-13, L40-42).

### Anti-ranking cross-cámara
**Source:** SPIKE §3 (T-52-13); RESEARCH Anti-Patterns L172.
**Apply to:** velocity + any per-cámara señal.
Cámara (25741 ev.) vs Senado (20357) is coverage asymmetry, not activity. Declare `cobertura_camara` per señal; PROHIBIDO `order by conteo` cross-cámara or framing "top/los más/la cámara más activa". Framing = "N trámites en 7 días".

### Migration discipline
**Source:** 0039 L11-15, 0064 L6-7; CLAUDE.md Conventions.
Apply via `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" --single-transaction -f …`; NEVER `db push`. `create or replace function` requires explicit `drop function if exists` first (idiom 42P13). Apply = operator checkpoint (CI can't prove DDL ran).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/actualidad/src/kmeans.ts` | utility | transform | No k-means / clustering code exists in the repo. RESEARCH §Package Legitimacy L98-100 recommends hand-rolling Lloyd k-means (~40 lines) with a fixed-seed PRNG (mulberry32) for byte-reproducible determinism, cosine distance on normalized 768d vectors, k=10 (discretion [8,15]). Label = `mode(materia)`, tie→alphabetical. If a library is chosen instead, mark `[ASSUMED]` + run slopcheck + `checkpoint:human-verify`. Determinism test (`kmeans.test.ts`): same input → same assignment (RESEARCH Pitfall 4 L255-258). Planner should use RESEARCH §Clustering L201-207 as the spec, not a codebase analog. |

The closest existing "clustering over embeddings" reference is `match_proyectos` (`0011` L52-71) — kNN cosine on-read, NOT clustering. It confirms the distance operator (`<=>`) and the `boletin`-keyed embedding table, but is not a copy source for the k-means algorithm.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/tests/`, `app/lib/`, `packages/tramitacion/src/`, `.github/workflows/`
**Files scanned:** 9 (all pre-located by RESEARCH.md with line refs; each read once, non-overlapping ranges)
**Migration head confirmed:** `0064` → next `0065`/`0066`
**Workspace:** `pnpm-workspace.yaml` glob `packages/*` auto-includes `@obs/actualidad`
**Pattern extraction date:** 2026-07-24
