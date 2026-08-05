-- 0084_noticia.test.sql
-- Verifica la migración 0084 (noticia, noticia_url_vista — Etapa 2 de NEWS-RSS) CONTRA UN
-- SCHEMA APLICADO:
--   * ambas tablas existen con RLS habilitada,
--   * INVARIANTE ZERO-GRANT (T-132-04): ni `anon` ni `authenticated` tienen select/insert/update
--     sobre ninguna de las dos tablas — deny-all total, sin lectores hasta la Phase 137 (D-12).
--     Se prueba con `has_table_privilege(<rol>, ..., <priv>) = false` (idiom 0068/0070).
--   * deny-by-default TOTAL: cero policies (ni siquiera para authenticated).
--
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs schema APLICADO).
-- build/typecheck NO prueban que el DDL se aplicó (Pitfall 5/6). Espeja 0070 style.

begin;
select plan(16);

-- ── Estructura: ambas tablas existen + RLS habilitada ──────────────────────────────
select ok(to_regclass('public.noticia') is not null, 'tabla noticia existe');
select ok(to_regclass('public.noticia_url_vista') is not null, 'tabla noticia_url_vista existe');
select is(
  (select count(*)::int from pg_class where relname = 'noticia' and relrowsecurity = true),
  1, 'RLS enabled en noticia');
select is(
  (select count(*)::int from pg_class where relname = 'noticia_url_vista' and relrowsecurity = true),
  1, 'RLS enabled en noticia_url_vista');

-- ── ZERO-GRANT: anon SIN select/insert/update sobre noticia (T-132-04) ─────────────
select is(
  has_table_privilege('anon', 'noticia', 'select'), false,
  'anon SIN select sobre noticia (deny-all total, D-12)');
select is(
  has_table_privilege('anon', 'noticia', 'insert'), false,
  'anon SIN insert sobre noticia');
select is(
  has_table_privilege('anon', 'noticia', 'update'), false,
  'anon SIN update sobre noticia');

-- ── ZERO-GRANT: anon SIN select/insert/update sobre noticia_url_vista ──────────────
select is(
  has_table_privilege('anon', 'noticia_url_vista', 'select'), false,
  'anon SIN select sobre noticia_url_vista');
select is(
  has_table_privilege('anon', 'noticia_url_vista', 'insert'), false,
  'anon SIN insert sobre noticia_url_vista');
select is(
  has_table_privilege('anon', 'noticia_url_vista', 'update'), false,
  'anon SIN update sobre noticia_url_vista');

-- ── ZERO-GRANT: authenticated SIN select/insert/update sobre noticia ───────────────
select is(
  has_table_privilege('authenticated', 'noticia', 'select'), false,
  'authenticated SIN select sobre noticia (deny-all total, D-12)');
select is(
  has_table_privilege('authenticated', 'noticia', 'insert'), false,
  'authenticated SIN insert sobre noticia');
select is(
  has_table_privilege('authenticated', 'noticia', 'update'), false,
  'authenticated SIN update sobre noticia');

-- ── ZERO-GRANT: authenticated SIN select/insert/update sobre noticia_url_vista ─────
select is(
  has_table_privilege('authenticated', 'noticia_url_vista', 'select'), false,
  'authenticated SIN select sobre noticia_url_vista');
select is(
  has_table_privilege('authenticated', 'noticia_url_vista', 'insert'), false,
  'authenticated SIN insert sobre noticia_url_vista');
select is(
  has_table_privilege('authenticated', 'noticia_url_vista', 'update'), false,
  'authenticated SIN update sobre noticia_url_vista');

select * from finish();
rollback;
