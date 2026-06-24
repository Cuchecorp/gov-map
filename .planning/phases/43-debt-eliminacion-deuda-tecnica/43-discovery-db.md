# 43-discovery-db.md — DB Layer Premortem: Tech Debt Findings
**Scope:** `supabase/migrations/0001–0044`, `supabase/tests/`, `supabase/functions/ingest-worker`
**Date:** 2026-06-24
**Method:** Static SQL analysis only. No PROD connection. Findings marked "needs live PROD check" require operator verification.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 4     |
| Low      | 4     |

---

### DB-01: 8 public-schema RPCs missing `revoke execute from public` — execute gap on fresh DB reset

- **File:** `supabase/migrations/0011_fichas_embeddings.sql:90`, `0019_voto_asistencia_y_ficha.sql:103–104`, `0020_parlamentario_publico.sql:51`, `0026_parlamentarios_publico_listado.sql:53`, `0032_agenda_search.sql` (not present), `0033_agenda_search_camara.sql:73`, `0028_votos_instructivos.sql`
- **Evidence:**
  ```sql
  -- 0011: only grant, no revoke
  grant execute on function match_proyectos(vector, int, float8, text) to anon;

  -- 0019: only grants, no revokes
  grant execute on function votos_de_parlamentario(text, int, int) to anon;
  grant execute on function rebeldias_de_parlamentario(text) to anon;

  -- 0020: only grant, no revoke
  grant execute on function parlamentario_publico(text) to anon;

  -- 0026: only grant, no revoke
  grant execute on function parlamentarios_publico() to anon;

  -- 0033: only grant, no revoke
  grant execute on function public.buscar_citaciones(text, int, text) to anon;
  ```
- **Repro:** On a fresh `supabase db reset` (replays 0001→0044 in order), Supabase's `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` grants `ALL ON ROUTINES TO anon, authenticated` after every new function. Between the migration that creates each function and migration 0044 (which revokes all), `public`/`anon`/`authenticated` already have EXECUTE from default privileges — so the explicit `grant execute to anon` is harmless but the missing `revoke execute from public` is also harmless in practice for the current PROD path (0044 does a catch-all `revoke all on all routines in schema public from anon, authenticated`). **However:** if 0044 is NOT applied (e.g. developer testing environment stopped at 0043), these RPCs are callable by any public/anon caller without restriction. The pattern asymmetry (some RPCs have `revoke from public`, others don't) creates inconsistent security posture that will confuse future maintainers and may bite if 0044 is ever rolled back in part.
  - Contrast: `lobby_de_parlamentario` (0021), `contratos_de_parlamentario` (0023), `aportes_de_parlamentario` (0024), `declaraciones_de_parlamentario` / `comparar_declaraciones` (0022), `bienes_de_parlamentario` / `comparar_declaraciones` (0031), `subgrafo_red` (0030), `agregado_por_contraparte` / `cap` (0025) all have explicit `revoke execute ... from public`. The 8 functions listed above do not.
- **Severity:** high
- **Blast radius:** In a partial rollback (reverse-0044 without re-revoke) or in a developer environment that skips 0044, `rebeldias_de_parlamentario` (security definer reading `parlamentario.partido`) could be callable by unauthenticated users — a LEGAL-03 PII leak. The other RPCs are intentionally public but the asymmetric pattern is the structural risk.
- **Immutable?:** Yes — functions defined in 0011/0019/0020/0026/0028/0033 (applied migrations). Fix = forward migration 0045+.
- **Proposed fix (do NOT apply):**
  ```sql
  -- 0045_revoke_public_rpc_gap.sql
  -- Forward-fix: harmonize deny-by-default on the 8 RPCs that received grant-to-anon
  -- without an explicit revoke-from-public. 0044 already revokes at runtime, but this
  -- closes the gap on fresh DB builds and partial rollback scenarios.
  revoke execute on function public.match_proyectos(vector, int, float8, text) from public;
  revoke execute on function public.votos_de_parlamentario(text, int, int) from public;
  revoke execute on function public.rebeldias_de_parlamentario(text) from public;
  revoke execute on function public.parlamentario_publico(text) from public;
  revoke execute on function public.parlamentarios_publico() from public;
  revoke execute on function public.buscar_citaciones(text, int, text) from public;
  -- Then re-grant to web_reader (already done in 0043, but explicit here for clarity):
  -- No action needed for web_reader — 0043 already grants these by name.
  -- Note: anon was revoked by 0044; web_reader is the new public path.
  ```

---

### DB-02: `0036_entidad_fk.sql` — `vinculo_id` bug in INSERT body; risk on fresh DB build

- **File:** `supabase/migrations/0036_entidad_fk.sql:87–89`
- **Evidence:**
  ```sql
  -- 0036 (IMMUTABLE, already applied to PROD):
  insert into public.identidad_audit
    (vinculo_id, metodo, decision, confidence, modelo_version, revisor_id, evidence, conflicts, tipo_entidad)
  values
    (v_vinculo_id, 'humano', p_decision, ...
  ```
  `v_vinculo_id` is the ID from `vinculo_entidad` (third-party table). `identidad_audit.vinculo_id` has FK → `vinculo_identidad` (parliamentary table). This is a wrong-FK cross-write.
- **Repro:** On `supabase db reset` (replays 0001→0044 in order):
  1. 0036 runs: creates `resolver_entidad` with the buggy INSERT body.
  2. 0037 runs immediately after: `CREATE OR REPLACE` replaces the function body with the correct INSERT to `vinculo_entidad_id`. Also adds `identidad_audit.vinculo_entidad_id` column + CHECK constraint.
  3. **Net result on fresh DB:** 0037 fully overwrites the 0036 function body. The bug function is **never callable** after 0037 runs. The correct column `vinculo_entidad_id` exists. The CHECK `num_nonnulls(vinculo_id, vinculo_entidad_id) <= 1` is in place.
  4. **Residual risk assessment: LOW.** A `db reset` replays sequentially; 0036's buggy body is overwritten by 0037 before any data exists. The only scenario where 0036's bug could fire in a fresh build is if the replay stops mid-stream between 0036 and 0037 — which is an abnormal interrupted state, not a normal reset. The bug is cosmetically present in the 0036 file but operationally neutralized.
- **Severity:** high (the file "lies" and is a maintenance trap for future developers reading 0036 in isolation)
- **Blast radius:** Anyone reading 0036 in isolation (code review, audit, new contributor) will see a cross-FK write and assume a bug. If a schema comparison tool diffs 0036 against PROD, it may flag the column list as inconsistent. No runtime risk on current PROD.
- **Immutable?:** Yes (0036 applied). Cannot edit 0036. 0037 is the forward-fix and is already applied.
- **Proposed fix (do NOT apply):** No new migration needed — 0037 is the authoritative fix. **Recommendation:** Add a comment at the top of `0036_entidad_fk.sql` (but note: applied migrations are immutable; adding a comment is a repo-only cosmetic change, acceptable if tracked). Alternatively, add a pgTAP assertion in the 0037 test that the `vinculo_id` column is NOT being populated by `resolver_entidad` — the current `0037_resolver_entidad_audit_fix.test.sql` should already cover this but worth confirming.

---

### DB-03: `rebeldias_de_parlamentario` — security definer with `grant execute to anon` and no `revoke from public` (PII risk if 0044 rolled back)

- **File:** `supabase/migrations/0019_voto_asistencia_y_ficha.sql:73–98, 104`
- **Evidence:**
  ```sql
  create or replace function rebeldias_de_parlamentario(p_id text)
  ...
  language sql stable security definer set search_path = '' as $$
    with yo as (
      select partido from public.parlamentario where id = p_id
    ), ...
  $$;
  grant execute on function rebeldias_de_parlamentario(text) to anon;
  -- NO: revoke execute on function rebeldias_de_parlamentario(text) from public;
  ```
- **Repro:** This is the most sensitive instance of DB-01. `rebeldias_de_parlamentario` is `security definer` and internally reads `parlamentario.partido` (political affiliation, LEGAL-03 sensitive). It is intentionally granted to `anon` (the output omits `partido`), but there is no `revoke from public`. On a fresh DB build replayed through 0043 (without 0044), `public` (= every role including unauthenticated) can call this function. While the output is safe (no `partido` in the return), the function body READS `partido` with elevated privileges via secdef. If the function body is ever modified in a future migration to accidentally project `partido`, the gap in `revoke from public` means there is no defense-in-depth at the privilege layer.
- **Severity:** high (specific to the secdef+PII access pattern; the current output is safe, but the structural gap is more serious than for invoker functions)
- **Blast radius:** LEGAL-03 violation risk if function output ever changes AND 0044 is partially rolled back. In current PROD with 0044 applied: mitigated. On dev/staging environments that don't apply 0044: `rebeldias_de_parlamentario` callable by anyone.
- **Immutable?:** Yes (0019 applied). Fix = 0045+.
- **Proposed fix (do NOT apply):** Included in DB-01's proposed 0045 migration above.

---

### DB-04: 8 migrations with no test file — schema drift undetected

- **File:** Migrations without any corresponding `.test.sql`:
  - `0009_voto_fuente_voter_id.sql` — no test
  - `0010_agenda.sql` — no test (test 0008 covers agenda schema; overlap unclear)
  - `0013_proyecto_ficha_estado_error.sql` — no test
  - `0014_vinculo_no_confirmado_dedup.sql` — no test
  - `0016_citacion_invitado_calidad.sql` — no test
  - `0017_higiene_seguridad.sql` — no test (patches search_path on trigger functions; partially covered by 0006 test)
  - `0028_votos_instructivos.sql` — test is `0029_votos_instructivos.test.sql` (name mismatch; covers the result)
  - `0031_probidad_bienes_rpc.sql` — no direct test (covered by `0022_probidad.test.sql` partially)
- **Evidence:** `supabase/tests/` directory listing; files 0009, 0010, 0013, 0014, 0016, 0017 have no matching test.
- **Repro:** If any of these migrations drifts (e.g., a constraint added in 0013 is assumed present by later code but the column was renamed), there is no pgTAP guard to catch it. The CI suite would pass silently.
- **Severity:** medium
- **Blast radius:** Silent constraint drift; schema assumptions violated without test failure.
- **Immutable?:** Tests are not migrations — new test files can be added at any time.
- **Proposed fix (do NOT apply):** Add test files `0009_voto_fuente_voter_id.test.sql`, `0010_agenda.test.sql`, `0013_proyecto_ficha_estado_error.test.sql`, `0014_vinculo_no_confirmado_dedup.test.sql`, `0016_citacion_invitado_calidad.test.sql`, `0017_higiene_seguridad.test.sql` with at minimum: column existence checks, constraint checks, and deny-by-default assertions.

---

### DB-05: Stale boilerplate `"Corre vía supabase test db"` in 30+ test files — misleading runner docs

- **File:** Virtually every test in `supabase/tests/` (e.g., `0001_control_plane.test.sql:3`, `0002_orchestration.test.sql:9`, etc.)
- **Evidence:**
  ```sql
  -- Corre via `supabase test db` (pgTAP).
  ```
  The real runner is `psql -tA -f <file>` against applied PROD, as noted in 0041 and 0043 test files and in the CLAUDE.md memory.
- **Repro:** A new contributor reading the header runs `supabase test db` expecting the test to work. It will fail or give misleading results if the local schema (from `db reset`) differs from PROD (e.g., tests that check for seeded PROD data). The discrepancy is cosmetic but has caused confusion before (see MEMORY.md).
- **Severity:** medium
- **Blast radius:** Developer confusion, incorrect test execution, false confidence in CI.
- **Immutable?:** Tests (not migrations) — editable at any time.
- **Proposed fix (do NOT apply):** Mass-update all test file headers to read: `-- Corre vía: psql -tA -f supabase/tests/<file>.sql` against applied PROD schema. Can be done in a single PR without any migration.

---

### DB-06: `0039_cruce_senal.test.sql` — documented off-by-one; `plan(11)` → corrected to `plan(10)`, but comment says "bug del conteo"

- **File:** `supabase/tests/0039_cruce_senal.test.sql:16–18`
- **Evidence:**
  ```sql
  -- 10 aserciones reales en este archivo (el plan(11) original estaba off-by-one — bug del
  -- conteo, no del DDL; corregido en Plan 04 al correr contra el schema aplicado).
  select plan(10);
  ```
- **Repro:** The corrected `plan(10)` is now correct. This is resolved. However, the comment documents a past off-by-one that was fixed — confirming the KNOWN pattern of plan-vs-assert drift. Needs validation that the current count (10 asserts) actually matches.
- **Severity:** low (already fixed; needs live PROD verification)
- **Blast radius:** If plan(10) is still wrong, pgTAP reports "expected N tests, got M" — a noisy false failure, not a security issue.
- **Immutable?:** Test file — editable.
- **Proposed fix (do NOT apply):** Needs live PROD check: run `psql -tA -f supabase/tests/0039_cruce_senal.test.sql` and count actual assertions.

---

### DB-07: `cruces.materializar_cruces()` — no `revoke` on the schema-internal function, callable by any role that can SET SEARCH_PATH to `cruces`

- **File:** `supabase/migrations/0039_cruce_senal.sql:81–122`
- **Evidence:**
  ```sql
  create or replace function cruces.materializar_cruces()
  returns void language plpgsql security definer set search_path = '' as $$
  begin
    delete from public.cruce_senal;
    insert into public.cruce_senal ...
  $$;
  -- No revoke statement follows.
  ```
- **Repro:** `cruces` is a non-public schema. Supabase's `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` only covers the `public` schema — not `cruces`. Therefore, `cruces.materializar_cruces()` does NOT get auto-granted to `anon`/`authenticated` via default privileges (those only apply to the `public` schema). The function is callable only by roles that have EXECUTE on it explicitly, or by the owner (`postgres`/`service_role`). However: there is no explicit `revoke execute on function cruces.materializar_cruces() from public` — by default, Postgres grants EXECUTE to PUBLIC on new functions. This means `anon`/`authenticated` can call this FULL REBUILD procedure (delete + insert on `cruce_senal`) directly.
- **Severity:** medium (the FULL REBUILD is destructive — a malicious anon caller could wipe `cruce_senal` and re-populate with garbage or leave it empty)
- **Blast radius:** Data integrity: `cruce_senal` wiped by unauthenticated caller. Note: `cruce_senal` has RLS enabled + `revoke all on cruce_senal from anon, authenticated` so anon can't read the result, but can trigger the delete+insert (the function bypasses RLS as secdef).
- **Immutable?:** Yes (0039 applied). Fix = 0045+.
- **Proposed fix (do NOT apply):**
  ```sql
  -- In 0045 or a dedicated migration:
  revoke execute on function cruces.materializar_cruces() from public;
  -- grant only to service_role if needed explicitly:
  -- grant execute on function cruces.materializar_cruces() to service_role;
  -- (service_role typically has superuser-like privileges already)
  ```
  Same pattern applies to `grafo.materializar_aristas()` in `0030_net.sql` — needs the same check (see DB-08).

---

### DB-08: `grafo.materializar_aristas()` — no `revoke execute from public` on schema-internal destructor

- **File:** `supabase/migrations/0030_net.sql:105–185`
- **Evidence:**
  ```sql
  create or replace function grafo.materializar_aristas()
  returns void language plpgsql security definer set search_path = '' as $$
  begin
    delete from public.entidad where id not in (...);
    ...
  $$;
  -- No revoke statement.
  ```
- **Repro:** Same as DB-07. `grafo.materializar_aristas()` is a `security definer` function in the non-public `grafo` schema. Postgres default grants EXECUTE to PUBLIC on creation. No explicit revoke. Any `anon`/`authenticated` caller can invoke this function, which deletes and rebuilds the full `entidad`/`arista` graph tables.
- **Severity:** medium
- **Blast radius:** `entidad`/`arista` tables wiped by unauthenticated caller. The graph is rebuildable from source data, but a targeted call during production traffic would cause the NET graph to disappear momentarily.
- **Immutable?:** Yes (0030 applied). Fix = 0045+.
- **Proposed fix (do NOT apply):**
  ```sql
  revoke execute on function grafo.materializar_aristas() from public;
  ```

---

### DB-09: Missing tests for `0031_probidad_bienes_rpc.sql` — `bienes_de_parlamentario` and new `comparar_declaraciones` override not tested independently

- **File:** No `0031_*.test.sql` exists. `supabase/migrations/0031_probidad_bienes_rpc.sql:24–138`
- **Evidence:**
  ```sql
  -- 0031 creates:
  create or replace function public.bienes_de_parlamentario(p_id text) ...
  create or replace function public.comparar_declaraciones(p_id text, fechas date[]) ...
  -- 0022 already defined comparar_declaraciones; 0031 CREATE OR REPLACE overwrites it.
  ```
- **Repro:** `0022_probidad.test.sql` tests `comparar_declaraciones` as defined in 0022. After 0031 overwrites it with a different body (adds bienes data), the 0022 test continues to pass against the 0031 body — but no test verifies the 0031-specific behavior (bienes join, extended return columns). Schema drift in 0031 would go undetected.
- **Severity:** medium
- **Blast radius:** `bienes_de_parlamentario` can silently change behavior without test failure.
- **Immutable?:** Test files — addable at any time.
- **Proposed fix (do NOT apply):** Add `supabase/tests/0031_probidad_bienes_rpc.test.sql` with assertions on `bienes_de_parlamentario` return columns and `comparar_declaraciones` post-0031 behavior.

---

### DB-10: `0036_entidad_fk.sql` file-level lie documented but no test asserts the 0037 override

- **File:** `supabase/tests/0037_resolver_entidad_audit_fix.test.sql`
- **Evidence:** The test exists (`plan(12)`) and covers the audit fix. However, there is no assert that explicitly verifies `identidad_audit.vinculo_id` is NOT written when `resolver_entidad` is called (i.e., that the 0036 buggy path is truly dead). The test likely inserts via the RPC and checks `vinculo_entidad_id` is populated — but a future regression that accidentally brings back `vinculo_id` writes could pass the current test if the check only looks at `vinculo_entidad_id`.
- **Severity:** low
- **Blast radius:** FK violation on `identidad_audit.vinculo_id` if 0036 body ever re-appears (e.g., a bad `CREATE OR REPLACE` in a future migration).
- **Immutable?:** Test file — editable.
- **Proposed fix (do NOT apply):** Add to `0037_resolver_entidad_audit_fix.test.sql`: assert that after calling `resolver_entidad(...)` the resulting `identidad_audit` row has `vinculo_id IS NULL` and `vinculo_entidad_id IS NOT NULL`.

---

## Seed Signal Disposition

**KNOWN SEED: 0036 `vinculo_id` bug** — CONFIRMED neutralized by 0037 on fresh DB build. `CREATE OR REPLACE` in 0037 fully replaces the 0036 body before any data can be written. Residual risk is cosmetic (file lies) and maintenance (future readers confused), not operational. See DB-02 above.

**pgTAP `plan(N)` drift** — One confirmed historical instance in 0039 (off-by-one corrected). All other plan() counts are not statically verifiable without running the tests. Needs live PROD check. See DB-06.

**`vinculo_entidad_clave_natural` unique index** — 0035 created this index. 0036/0037 `on conflict (tipo_entidad, mencion_normalizada)` targets it. Confirmed correct match.

**Deny-by-default gaps in `public` schema RPCs** — The catch-all `revoke all on all routines in schema public from anon, authenticated` in 0044 closes the privilege gap for the public schema at PROD. The structural risk is on non-public schemas (`cruces`, `grafo`) and on dev environments that skip 0044. See DB-01, DB-07, DB-08.
