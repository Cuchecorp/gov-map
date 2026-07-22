-- 0059_bio_comisiones.test.sql
-- Verifica la migración 0059 (bio + comisiones) CONTRA UN SCHEMA APLICADO:
--   * las cuatro tablas existen con RLS habilitada,
--   * las cuatro son DENY-BY-DEFAULT (cero policies + sin grant SELECT a anon),
--   * provenance NOT NULL (origen/fecha_captura/enlace) en las cuatro,
--   * los FKs a parlamentario/comision son nullable donde corresponde.
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- build/typecheck NO prueban que el DDL se aplicó (falso positivo de CI, Pitfall 6).
-- Espeja 0021_lobby.test.sql en su forma deny-by-default.

begin;
select plan(28);

-- ── Las cuatro tablas existen ──────────────────────────────────────────────────
select has_table('public', 'parlamentario_bio',        'tabla parlamentario_bio existe');
select has_table('public', 'parlamentario_militancia', 'tabla parlamentario_militancia existe');
select has_table('public', 'comision',                 'tabla comision existe');
select has_table('public', 'comision_membresia',       'tabla comision_membresia existe');

-- ── RLS habilitada en las cuatro ───────────────────────────────────────────────
select is(
  (select count(*)::int from pg_class where relname = 'parlamentario_bio' and relrowsecurity = true),
  1, 'RLS enabled en parlamentario_bio');
select is(
  (select count(*)::int from pg_class where relname = 'parlamentario_militancia' and relrowsecurity = true),
  1, 'RLS enabled en parlamentario_militancia');
select is(
  (select count(*)::int from pg_class where relname = 'comision' and relrowsecurity = true),
  1, 'RLS enabled en comision');
select is(
  (select count(*)::int from pg_class where relname = 'comision_membresia' and relrowsecurity = true),
  1, 'RLS enabled en comision_membresia');

-- ── DENY-BY-DEFAULT: cero policies en las cuatro ───────────────────────────────
select is(
  (select count(*)::int from pg_policies where tablename = 'parlamentario_bio'),
  0, 'parlamentario_bio sin policies (deny-by-default)');
select is(
  (select count(*)::int from pg_policies where tablename = 'parlamentario_militancia'),
  0, 'parlamentario_militancia sin policies (deny-by-default)');
select is(
  (select count(*)::int from pg_policies where tablename = 'comision'),
  0, 'comision sin policies (deny-by-default)');
select is(
  (select count(*)::int from pg_policies where tablename = 'comision_membresia'),
  0, 'comision_membresia sin policies (deny-by-default)');

-- ── DENY-BY-DEFAULT: anon SIN grant SELECT en las cuatro ───────────────────────
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'parlamentario_bio' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre parlamentario_bio');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'parlamentario_militancia' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre parlamentario_militancia');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'comision' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre comision');
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'comision_membresia' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre comision_membresia');

-- ── Provenance NOT NULL (FND-08) en las cuatro ─────────────────────────────────
select col_not_null('public', 'parlamentario_bio',        'origen',        'parlamentario_bio.origen NOT NULL');
select col_not_null('public', 'parlamentario_bio',        'fecha_captura', 'parlamentario_bio.fecha_captura NOT NULL');
select col_not_null('public', 'parlamentario_bio',        'enlace',        'parlamentario_bio.enlace NOT NULL');
select col_not_null('public', 'parlamentario_militancia', 'origen',        'parlamentario_militancia.origen NOT NULL');
select col_not_null('public', 'parlamentario_militancia', 'enlace',        'parlamentario_militancia.enlace NOT NULL');
select col_not_null('public', 'comision',                 'origen',        'comision.origen NOT NULL');
select col_not_null('public', 'comision',                 'enlace',        'comision.enlace NOT NULL');
select col_not_null('public', 'comision_membresia',       'origen',        'comision_membresia.origen NOT NULL');
select col_not_null('public', 'comision_membresia',       'enlace',        'comision_membresia.enlace NOT NULL');

-- ── Columnas nullables honestas (poblables después / cargo opcional) ───────────
select col_is_null('public', 'parlamentario_bio',  'profesion', 'parlamentario_bio.profesion es nullable (no fabricar)');
select col_is_null('public', 'parlamentario_militancia', 'hasta', 'parlamentario_militancia.hasta es nullable (vigente)');
select col_is_null('public', 'comision_membresia', 'cargo',     'comision_membresia.cargo es nullable');

select * from finish();
rollback;
