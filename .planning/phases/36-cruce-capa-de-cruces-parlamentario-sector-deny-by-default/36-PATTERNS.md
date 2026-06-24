# Phase 36: CRUCE — Capa de cruces parlamentario↔sector (deny-by-default) - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 18 new (3 migrations, 3 pgTAP suites, ~10 `@obs/cruces` src files, 1 package.json + workspace edit)
**Analogs found:** 18 / 18 (every file mirrors a proven in-repo pattern — this is a mirror-existing-patterns phase, NOT greenfield)

This phase has **NO greenfield files**. Every new file copies from an applied/green analog. The one genuine novelty is *scoring semantics* (single-label top-1 + abstention) inside `golden/golden-set.ts`, which mirrors the harness shape of `@obs/fichas` but replaces the substring-F1 body — that is content, not structure.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `supabase/migrations/0038_sector.sql` | migration | CRUD (DDL) | `supabase/migrations/0034_entidad_tercero.sql` + `0021_lobby.sql` public-read | exact (both halves) |
| `supabase/migrations/0039_cruce_senal.sql` | migration + materializer | batch / event-driven (cron) | `supabase/migrations/0030_net.sql` `materializar_aristas` + cron block | exact (structural) |
| `supabase/migrations/0040_cruces_rpc.sql` | route (RPC) | request-response | `0030_net.sql` `subgrafo_red` / `0021_lobby.sql` `lobby_de_parlamentario` | exact (minus 1 line) |
| `supabase/tests/0038_sector.test.sql` | test | — | `supabase/tests/0030_net.test.sql` | exact |
| `supabase/tests/0039_cruce_senal.test.sql` | test | — | `supabase/tests/0030_net.test.sql` (seed + materialize + body regex) | exact |
| `supabase/tests/0040_cruces_rpc.test.sql` | test | — | `0030_net.test.sql` (function-privilege + body regex assertions) | exact (inverted grant) |
| `packages/cruces/package.json` | config | — | `packages/fichas/package.json` | exact |
| `packages/cruces/src/sector.ts` | model (const catalog) | transform | new const; seed source mirrors `0038` `insert into sector` | role-match |
| `packages/cruces/src/model.ts` | model (zod) | transform | `packages/fichas/src/model.ts` (`FichaSchema`) | role-match (NOT FichaSchema content) |
| `packages/cruces/src/prompt.ts` (project) | utility | transform | `packages/fichas/src/prompt.ts` (extraction system prompt) | role-match |
| `packages/cruces/src/prompt-lobby.ts` (contraparte) | utility | transform | `packages/adjudication/src/prompt-entidad.ts` | role-match |
| `packages/cruces/src/clasificar.ts` | service | request-response (LLM) | `packages/adjudication/src/pipeline-entidad.ts` (gate ordering) | exact (gate sequence) |
| `packages/cruces/src/clasificar-fichas-cli.ts` | controller (CLI) | batch | `packages/fichas/src/pipeline-cli.ts` | exact (shape only) |
| `packages/cruces/src/clasificar-lobby-cli.ts` | controller (CLI) | batch | `packages/fichas/src/pipeline-cli.ts` + adjudication gate | exact (shape) |
| `packages/cruces/src/writer-supabase.ts` | service (DB writer) | CRUD | `packages/fichas/src/writer-supabase.ts` | exact |
| `packages/cruces/src/mock-provider.ts` | test util | — | `@obs/fichas` mock-provider (CI, keyed by case id) | role-match |
| `packages/cruces/src/golden/golden-set.ts` | test (golden) | batch | `packages/fichas/src/golden/golden-set.ts` | role-match (scoring REPLACED) |
| `packages/cruces/src/golden/golden-set.test.ts` | test | — | `@obs/fichas` golden-set.test.ts | role-match |

---

## Pattern Assignments

### `supabase/migrations/0038_sector.sql` (migration, DDL)

Two halves with two analogs.

**Half A — `sector` catalog is PUBLIC-READ.** Mirror `0021_lobby.sql:51-56` (`lobby_audiencia` public-read), NOT the deny-by-default revoke:
```sql
-- Source: 0021_lobby.sql:52-56
alter table lobby_audiencia enable row level security;
create policy lobby_audiencia_public_read on lobby_audiencia for select to anon using (true);
grant select on lobby_audiencia to anon;
```
Apply verbatim to `sector` (reference data, no PII). Seed: see Shared Patterns → Sector Catalog Seed. `codigo text primary key` (stable per D-04, never rename).

**Half B — additive `sector_id` columns on 3 tables.** Mirror the additive-ALTER + FK-to-catalog convention. `NULL` = honest no-match (D-05):
```sql
-- Source: additive ALTER + FK convention (mirror 0034/0036 FK style)
alter table proyecto_ficha    add column sector_id text references sector(codigo);
alter table lobby_contraparte add column sector_id text references sector(codigo);
alter table donante           add column sector_id text references sector(codigo);
```

**Migration header convention** (mirror `0030_net.sql:1-20`): top-of-file comment stating what is mirrored, the `psql --db-url` apply path (NEVER `db push` — schema_migrations drift), and pgTAP-as-only-valid-test. Copy that header style.

---

### `supabase/migrations/0039_cruce_senal.sql` (migration + materializer, batch/cron)

**`cruce_senal` table — deny-by-default + explicit revoke.** Mirror `0034_entidad_tercero.sql:71-81` + `0030_net.sql:88-90`:
```sql
-- Source: 0034_entidad_tercero.sql:80 / 0030_net.sql:88-90 (deny-by-default + DEFAULT-PRIVILEGES revoke)
alter table cruce_senal enable row level security;   -- zero policies, intentional
revoke all on cruce_senal from anon, authenticated;
```
Table shape per D-09 (single row per `(parlamentario_id, sector_id, tipo_senal)`, NOT an `arista`). Provenance inline NOT NULL (FND-08, mirror `arista` cols `0030_net.sql:78-82`). `tipo_senal` allow-list CHECK mirrors `arista.tipo` CHECK (`0030_net.sql:69`) — single value in MVP, adding a type = new migration (correct friction). Per RESEARCH Open Question 1, the planner must confirm the shipped token (`'lobby_sector'` recommended, or `'lobby_sector_aporte'` with lobby-only evidence).

**`materializar_cruces()` — security-definer full-rebuild.** EXACT structural mirror of `grafo.materializar_aristas()` (`0030_net.sql:105-147`):
```sql
-- Source: 0030_net.sql:103-106 (schema + security definer + search_path)
create schema if not exists cruces;
create or replace function cruces.materializar_cruces()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- D-11 DEPARTURE: full rebuild (delete-all) instead of arista's `on conflict do nothing`.
  delete from public.cruce_senal;
  insert into public.cruce_senal (...) select ... from public.lobby_audiencia a
    join public.lobby_contraparte c on c.identificador = a.identificador
   where a.estado_vinculo = 'confirmado'
     and a.parlamentario_id is not null
     and c.sector_id is not null
   group by a.parlamentario_id, c.sector_id;
end;
$$;
```
Key copy points from `materializar_aristas`: `security definer set search_path = ''`, schema-qualified `public.*` names, join `lobby_audiencia` ⨝ `lobby_contraparte on identificador` (`0030_net.sql:138`), `where estado_vinculo = 'confirmado'` filter (`0030_net.sql:142`). **DEPARTURE (D-11):** `delete from` full rebuild, NOT `on conflict do nothing` append (lobby evidence must stay current). Evidence is lobby-only (D-10 raw `c.nombre`, no `entidad_id`); NO `partido`/`rut` referenced anywhere in the body (pgTAP asserts this).

**Cron block — copy VERBATIM, change name + offset.** Mirror `0030_net.sql:149-178` (pg_cron version guard + `cron.schedule` + post-migration assertion):
```sql
-- Source: 0030_net.sql:150-178 — copy whole block; change jobname + cron expr only.
perform cron.schedule('cruces-materializar', '23 3 * * *',
  $cron$ select cruces.materializar_cruces(); $cron$);
-- ...then the post-migration `if not exists (... cron.job where jobname = 'cruces-materializar') raise`.
```
Offset `23 3` avoids the `17 3` collision with `net-materializar-aristas` (Claude's discretion, D-44 / A4).

---

### `supabase/migrations/0040_cruces_rpc.sql` (RPC, request-response)

Mirror `subgrafo_red` (`0030_net.sql:186-254`) / `lobby_de_parlamentario` projection discipline, with **the single departure: NO `grant execute to anon`**.

**Projection discipline (PII-safe named columns).** Mirror `subgrafo_red`'s explicit `jsonb_build_object` (`0030_net.sql:224-247`) — NEVER `select *` or `row_to_json` (Pitfall 4). Project only `sector`, `conteo`, `evidencia.items[].enlace`; NEVER `rut`/`partido`/`email`/`donante_id`.

**The ONE departure — keep the revoke, DROP the grant** (`0030_net.sql:253-254`):
```sql
-- Source: 0030_net.sql:253 — KEEP this line:
revoke execute on function public.cruces_de_parlamentario(text) from public;
-- 0030_net.sql:254 — DO NOT COPY this line (deny-by-default until Phase 39 sign-off):
-- grant execute on function public.cruces_de_parlamentario(text) to anon;   ← OMITTED
```
`security definer set search_path = ''` mirror (`0030_net.sql:194`).

---

### `supabase/tests/0039_cruce_senal.test.sql` (pgTAP) — representative test

Mirror `0030_net.test.sql` whole structure: `begin; select plan(N); ... select * from finish(); rollback;` (`:18-19`, `:183-184`).

**Seed → materialize → assert** (mirror `:25-52`): seed `parlamentario` + `lobby_audiencia` (`estado_vinculo='confirmado'`) + `lobby_contraparte` with `sector_id` set directly, then `select cruces.materializar_cruces();`. For CRUCE-03's ≥5-parlamentario path, seed ≥5 distinct confirmed parlamentarios.

**Deny-by-default assertions** (mirror `:67-72`, `:131-140`): zero policies on `cruce_senal`; `throws_ok($$ select ... from cruce_senal $$, '42501', ...)` for `anon` (revoke-all → insufficient_privilege, the strongest guarantee).

**No-PII body regex** (mirror `:100-105`, comment-stripped + word boundary):
```sql
-- Source: 0030_net.test.sql:100-105 — extend the term list per Pitfall 4.
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cruces' and p.proname = 'materializar_cruces')
    !~* '\y(partido|rut)\y',
  'materializar_cruces body never references partido/rut');
```

**security-definer assertion** (mirror `:75-80`): `prosecdef = true`.

### `supabase/tests/0040_cruces_rpc.test.sql`

Same body-regex on `cruces_de_parlamentario` extended to `'\y(partido|rut|email|donante_id)\y'`. **INVERT the grant assertion** from `0030_net.test.sql:92-94`:
```sql
-- Source: INVERSE of 0030_net.test.sql:92-94 — anon must have NO execute (deny until Phase 39).
select ok(
  not has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon has NO execute on cruces_de_parlamentario (deny-by-default until Phase 39)');
```

### `supabase/tests/0038_sector.test.sql`

`sector` public-read (anon SELECT returns rows, mirror inverse of the `throws_ok` pattern → `is_empty`/row-count); `sector_id` columns exist on the 3 tables (`has_column`).

---

### `packages/cruces/package.json` (config)

Mirror `packages/fichas/package.json` verbatim; change `name` → `"@obs/cruces"`. Keep `"type":"module"`, `main`/`types` → `src/index.ts`, scripts `test: vitest run` + `typecheck: tsc -b`, deps `@obs/core`/`@obs/llm`/`@supabase/supabase-js`/`zod`, devDeps `tsx`/`vitest`/`@types/node`. Drop `@obs/ingest`/`@obs/tramitacion`/`unpdf` (not needed). Register in the pnpm workspace (`pnpm-workspace.yaml` — already globs `packages/*`, verify).

---

### `packages/cruces/src/model.ts` (zod) — closed enum, abstention first-class

Mirror the *role* of `packages/fichas/src/model.ts:39-43` (zod contract gate validated by `provider.complete(req, Schema)`), but the content is a closed enum + nullable (abstention), NOT `FichaSchema`:
```typescript
// Source: NEW. Role mirrors FichaSchema; single-label top-1 + abstention (D-05/D-07/D-08).
import { z } from "zod";
import { SECTOR_CODIGOS } from "./sector";
export const ClasificacionSectorSchema = z.object({
  sector_codigo: z.enum(SECTOR_CODIGOS).nullable(),  // null = not-confident (first-class)
});
export type ClasificacionSector = z.infer<typeof ClasificacionSectorSchema>;
```
Keep the `model.ts` doc-comment style (explain why null/abstention is first-class, mirror the SEM-02 honest-degradation note in fichas `model.ts:7-9`).

---

### `packages/cruces/src/clasificar.ts` (service) — gate ordering is load-bearing

Mirror the **gate sequence** of `packages/adjudication/src/pipeline-entidad.ts:24-25` + the Stage-2 ordering described at `:14-16`: `assertNoRutInLlmInput(finalPrompt)` FIRST, then `assertSensitivityAllowed`, then `provider.complete(..., ClasificacionSectorSchema)`:
```typescript
// Source: pipeline-entidad.ts:24-25 import + the Stage-2 gate ordering.
import { assertNoRutInLlmInput, assertSensitivityAllowed } from "@obs/llm";
// ...inside clasificarContraparte (sensitive path):
assertNoRutInLlmInput(system + "\n" + user);          // FIRST — fail-closed, 0 LLM calls if RUT leaks
assertSensitivityAllowed({ sensitivity: "personal" }, provider);
const out = await provider.complete({ ... }, ClasificacionSectorSchema);
```
**Routing split (D-12, the correctness detail):**
- `clasificarFicha` (project text, public): `criticality:"bulk"` + `sensitivity:"public"` → DeepSeek. Mirror `@obs/fichas` extractor's `sensitivity:"public"`.
- `clasificarContraparte` (contraparte, sensitive): `criticality:"critical"` + `sensitivity:"personal"` → MiniMax. `sensitivity:"personal"` is the FND-06-correct label — NEVER `"public"` for contraparte text (MILESTONE §2.1 violation). `Sensitivity` is binary (`"public"|"personal"`); see `data-routing.ts:67`.

---

### `packages/cruces/src/clasificar-fichas-cli.ts` + `clasificar-lobby-cli.ts` (CLI, batch)

Mirror `packages/fichas/src/pipeline-cli.ts` SHAPE — NOT its literal-extraction content:
- `parseArgs(argv)` with `FichasCliArgsError`-style fail-fast validation BEFORE any net/DB (`pipeline-cli.ts:68-118`). Copy the `--service-key` empty-value guard (`:100-110`) — silent degrade-to-dry-run when the operator thinks they're writing is the trap it prevents.
- `decidirDryRun({serviceKey, dryRun})` (`:124-126`): no service key → dry-run with explicit warning, NEVER silent no-write.
- env-driven config (`:149-152`): `SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`DEEPSEEK_API_KEY`/`MINIMAX_API_KEY` — no hardcoded ports/keys.
- `isMain` entry-point guard (`:244-247`) regex'd to the CLI filename + `process.exit` on error.

**Do NOT reuse:** `correrPipeline`, `obtenerTextoFuente`, `SenadoConnector`/R2 wiring, the `--reembed`/`--boletines` fetch flow — those are extraction-specific. The cruces CLIs select rows (`proyecto_ficha` / `lobby_contraparte`), classify via `clasificar.ts`, and UPDATE `sector_id` via the cruces writer. `clasificar-lobby-cli` wires MiniMax + the RUT gate; `clasificar-fichas-cli` wires DeepSeek.

---

### `packages/cruces/src/writer-supabase.ts` (DB writer, CRUD)

Mirror `packages/fichas/src/writer-supabase.ts`:
- `createClient(url, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } })` (`:91-93`).
- service key NEVER interpolated into error messages — only `error.message` from PostgREST (`:104-105`, T-07-06).
- `chunk`/`dedupePorClave` (`:64-81`) for batch UPDATE safety.
- Method shape: `actualizarSectorFicha(boletin, sector_id)` / `actualizarSectorContraparte(identificador, sector_id)` mirror `marcarError`'s `.update(...).eq(...)` (`:125-131`). **This writer NEVER calls the LLM** (D-13 two-stage) — same as fichas writer never calling the extractor.

---

### `packages/cruces/src/golden/golden-set.ts` (golden) — harness mirrored, SCORING REPLACED

Mirror the *structure* of `packages/fichas/src/golden/golden-set.ts`: a `CasoGolden[]` const (~40 cases per D-06), a `GOLDEN_SET_GATE` export, a `MetricasGolden` interface, and an `evaluarGolden(set, ejecutar)` driver (`:459-523`). Keep `normalizarLiteral` (`:62-71`) for input-text hygiene if useful.

**REPLACE the scoring body** (`:476-515`) — this is the one genuinely-new logic. Per D-07/D-08, score single-label top-1 with abstention:
- `expected === actual` (exact code match) → **correct** (covered).
- `actual === null` (abstain) → **not-covered** (lowers coverage), **NEVER an error** (Pitfall 3).
- `actual !== null && actual !== expected` → **misclassification (error)**.
- Gate = "≥7/10 non-null AND zero misclassifications among the non-null" (CRUCE-02). Do NOT copy the `precision ≥0.95 / recall ≥0.80` thresholds or the substring/`claveCuerpo` F1 — those are literal-extraction-specific.

`mock-provider.ts`: keyed by case id (mirror fichas mock), returns a fixed `ClasificacionSector` per case so CI runs network-free; LIVE block swaps in DeepSeek/MiniMax (gated by env, mirror `golden-set.ts:13-15` LIVE note).

---

## Shared Patterns

### Deny-by-default with explicit revoke
**Source:** `0034_entidad_tercero.sql:71-81`, `0030_net.sql:88-90`
**Apply to:** `cruce_senal` (migration 0039). The project grants ALL to anon/authenticated by DEFAULT PRIVILEGES; RLS-without-policy denies ROWS but the PRIVILEGE must be revoked too.
```sql
alter table cruce_senal enable row level security;
revoke all on cruce_senal from anon, authenticated;
```

### Public-read reference data
**Source:** `0021_lobby.sql:52-56`
**Apply to:** `sector` catalog (migration 0038) — the inverse of deny-by-default: `create policy ... for select to anon using (true)` + `grant select to anon`.

### PII gate ordering before any LLM call
**Source:** `packages/llm/src/data-routing.ts:52-72`, used in `pipeline-entidad.ts:14-16,24-25`
**Apply to:** `clasificar.ts` contraparte path, both CLIs. `assertNoRutInLlmInput(finalPrompt)` FIRST (fail-closed, error never leaks the RUT), then `assertSensitivityAllowed({sensitivity:"personal"}, provider)`. Test-enforced (test fails if a RUT reaches the prompt).

### security-definer `search_path=''` derived proc
**Source:** `0030_net.sql:105-106`, `:194`
**Apply to:** `materializar_cruces()` (0039) and `cruces_de_parlamentario` (0040). `security definer set search_path = ''` + schema-qualified `public.*` names so the proc reads deny-by-default tables as owner.

### Cron registration + post-migration assertion
**Source:** `0030_net.sql:149-178`
**Apply to:** 0039. Copy the pg_cron version guard + `cron.schedule(...)` + the `raise exception` if the job did not register. Change jobname → `'cruces-materializar'`, expr → `'23 3 * * *'`.

### CLI dry-run / degrade gating
**Source:** `pipeline-cli.ts:124-126`, `:100-110`, `:244-247`
**Apply to:** both cruces CLIs. No service key → dry-run with explicit warning; `--service-key`/`--limite` empty-value fail-fast; `isMain` entry-point.

### Sector catalog seed (PROPOSAL — operator must confirm, D-03)
**Source:** RESEARCH §Code Examples (Claude-proposed, ~13 sectors). Codes STABLE once live (D-04, never rename). NO catch-all `'otros'` (D-05).
```sql
insert into sector (codigo, etiqueta) values
  ('salud','Salud y farmacéutica'), ('educacion','Educación'),
  ('mineria_energia','Minería y energía'), ('medio_ambiente','Medio ambiente y recursos hídricos'),
  ('trabajo_prevision','Trabajo y previsión social'), ('vivienda_urbanismo','Vivienda, urbanismo y obras públicas'),
  ('transporte','Transporte y telecomunicaciones'), ('agricultura_pesca','Agricultura, pesca y alimentos'),
  ('banca_finanzas','Banca, finanzas y seguros'), ('comercio_industria','Comercio, industria y retail'),
  ('tecnologia','Tecnología y economía digital'), ('seguridad_justicia','Seguridad, justicia y defensa'),
  ('gremios_trabajadores','Gremios, sindicatos y asociaciones');
```

---

## No Analog Found

None. Every file mirrors an applied/green in-repo analog. The only non-mirrored *logic* (not file) is the abstention scoring inside `golden/golden-set.ts`, which reuses the fichas harness shape but is new content — flagged inline above.

---

## Metadata

**Analog search scope:** `supabase/migrations/` (0021, 0030, 0034), `supabase/tests/` (0030), `packages/llm/src/` (data-routing), `packages/fichas/src/` (pipeline-cli, writer-supabase, model, golden, package.json), `packages/adjudication/src/` (pipeline-entidad), `app/lib/` (money-gate).
**Files read (full or targeted):** 11
**Pattern extraction date:** 2026-06-24
