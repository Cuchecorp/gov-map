-- 0071_consentimiento.test.sql
-- Verifica la migración 0071 (consentimiento — RLS user-owned, Ley 21.719) CONTRA UN
-- SCHEMA APLICADO:
--   * `consentimiento` existe con RLS habilitada,
--   * la FORMA del registro legal: columnas version_texto / metodo / created_at (fecha),
--   * AISLAMIENTO DE DOS USUARIOS: A registra su consentimiento y lo ve; B NO lo ve
--     (RLS aisla) — mismo idiom `set local role authenticated` + jwt claims que 0069,
--     NUNCA postgres/service_role (Pitfall 2),
--   * anon SIN select (deny-by-default).
--
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs schema APLICADO).
-- build/typecheck NO prueban que el DDL se aplicó (Pitfall 5/6). Espeja 0069/0065 style.

begin;
select plan(8);

-- ── Estructura: consentimiento existe + RLS habilitada ────────────────────────────
select has_table('public', 'consentimiento', 'tabla consentimiento existe');
select is(
  (select count(*)::int from pg_class where relname = 'consentimiento' and relrowsecurity = true),
  1, 'RLS enabled en consentimiento');

-- ── Forma del registro legal (21.719): version/metodo/fecha ───────────────────────
select has_column('public', 'consentimiento', 'version_texto', 'columna version_texto presente');
select has_column('public', 'consentimiento', 'metodo',        'columna metodo presente');
select has_column('public', 'consentimiento', 'created_at',    'columna created_at (fecha) presente');

-- ── Semilla (owner, bypassa RLS): dos usuarios en auth.users ──────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local');

-- ── Usuario C registra su consentimiento y lo ve ──────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
insert into consentimiento (user_id, version_texto)
  values ('00000000-0000-0000-0000-00000000000c', 'v1-2026-07-26');
select results_eq(
  $$ select count(*)::int from consentimiento $$,
  $$ values (1) $$,
  'C ve su propio consentimiento (auth.uid() = user_id)');

-- ── Usuario D NO ve el consentimiento de C (RLS aisla) ────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is_empty(
  $$ select 1 from consentimiento $$,
  'D NO ve el consentimiento de C (RLS aisla)');

-- ── anon SIN select (deny-by-default) ─────────────────────────────────────────────
reset role;
select is(
  has_table_privilege('anon', 'consentimiento', 'select'),
  false,
  'anon SIN select sobre consentimiento (deny-by-default)');

select * from finish();
rollback;
