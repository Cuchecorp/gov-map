-- 0070_notificacion_envio.test.sql
-- Verifica la migración 0070 (notificacion_envio — cola service_role-only) CONTRA UN
-- SCHEMA APLICADO:
--   * `notificacion_envio` existe con RLS habilitada,
--   * el cursor idempotente `ultimo_evento_visto` está presente,
--   * INVARIANTE ZERO-GRANT (el corazón de NOTIF-02, T-103-06): `authenticated` NO
--     tiene select/insert/update sobre la cola — es service_role-only. Se prueba con
--     `has_table_privilege('authenticated', ..., <priv>) = false` (idiom 0068).
--   * deny-by-default TOTAL: cero policies (ni siquiera para authenticated).
--
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs schema APLICADO).
-- build/typecheck NO prueban que el DDL se aplicó (Pitfall 5/6). Espeja 0065/0068 style.

begin;
select plan(6);

-- ── Estructura: notificacion_envio existe + RLS habilitada ────────────────────────
select has_table('public', 'notificacion_envio', 'tabla notificacion_envio existe');
select is(
  (select count(*)::int from pg_class where relname = 'notificacion_envio' and relrowsecurity = true),
  1, 'RLS enabled en notificacion_envio');

-- ── Cursor idempotente presente ───────────────────────────────────────────────────
select has_column('public', 'notificacion_envio', 'ultimo_evento_visto',
  'columna ultimo_evento_visto (cursor idempotente) presente');

-- ── ZERO-GRANT: authenticated SIN select/insert/update (cola service_role-only) ───
select is(
  has_table_privilege('authenticated', 'notificacion_envio', 'select'),
  false,
  'authenticated SIN select sobre notificacion_envio (cola service_role-only, T-103-06)');
select is(
  has_table_privilege('authenticated', 'notificacion_envio', 'insert'),
  false,
  'authenticated SIN insert sobre notificacion_envio');
select is(
  has_table_privilege('authenticated', 'notificacion_envio', 'update'),
  false,
  'authenticated SIN update sobre notificacion_envio');

select * from finish();
rollback;
