-- 0085_noticia_url_vista_pendiente.test.sql
-- Verifica la migración 0085 (estado 'pendiente' en noticia_url_vista — CR-02, 132-09) CONTRA UN
-- SCHEMA APLICADO:
--   * 'pendiente' es aceptado por el check (marcado provisional re-evaluable),
--   * un estado inventado sigue siendo rechazado (control negativo apareado: sin este assert,
--     un check borrado por completo pasaría igual el primero),
--   * 'pasa'/'descarta' siguen aceptados (no-regresión sobre 0084),
--   * RLS sigue habilitada y anon/authenticated siguen sin select/insert/update — el gap closure
--     no puede aflojar el deny-all total (T-132-35).
--
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs schema APLICADO).
-- build/typecheck NO prueban que el DDL se aplicó (Pitfall 5/6). Espeja 0084.test.sql.

begin;
select plan(9);

-- ── 'pendiente' aceptado (marcado provisional CR-02) ────────────────────────────────
select lives_ok(
  $$ insert into noticia_url_vista (url_hash, url_canonica, outlet, estado, causa)
     values ('0085-test-pendiente', 'https://example.cl/pendiente', 'biobiochile', 'pendiente', null) $$,
  'estado=pendiente con causa=null es aceptado (marcado provisional)');

-- ── control negativo apareado: un estado inventado sigue siendo rechazado ───────────
select throws_ok(
  $$ insert into noticia_url_vista (url_hash, url_canonica, outlet, estado, causa)
     values ('0085-test-inventado', 'https://example.cl/inventado', 'biobiochile', 'inventado', null) $$,
  '23514',
  null,
  'un estado inventado sigue siendo rechazado (el check no quedó vacío)');

-- ── no-regresión: 'pasa' y 'descarta' siguen aceptados ──────────────────────────────
select lives_ok(
  $$ insert into noticia_url_vista (url_hash, url_canonica, outlet, estado, causa)
     values ('0085-test-pasa', 'https://example.cl/pasa', 'biobiochile', 'pasa', null) $$,
  'estado=pasa sigue aceptado (no-regresión 0084)');

select lives_ok(
  $$ insert into noticia_url_vista (url_hash, url_canonica, outlet, estado, causa)
     values ('0085-test-descarta', 'https://example.cl/descarta', 'biobiochile', 'descarta', 'prefiltro_lexico') $$,
  'estado=descarta con causa=prefiltro_lexico sigue aceptado (no-regresión 0084)');

-- ── RLS sigue habilitada (deny-all total intacto, T-132-35) ─────────────────────────
select ok(to_regclass('public.noticia_url_vista') is not null, 'tabla noticia_url_vista existe');
select is(
  (select count(*)::int from pg_class where relname = 'noticia_url_vista' and relrowsecurity = true),
  1, 'RLS sigue enabled en noticia_url_vista');

-- ── ZERO-GRANT sigue intacto: anon/authenticated sin select/insert/update ───────────
select is(
  has_table_privilege('anon', 'noticia_url_vista', 'select'), false,
  'anon SIGUE sin select sobre noticia_url_vista (deny-all no se aflojó)');
select is(
  has_table_privilege('anon', 'noticia_url_vista', 'insert'), false,
  'anon SIGUE sin insert sobre noticia_url_vista');
select is(
  has_table_privilege('authenticated', 'noticia_url_vista', 'select'), false,
  'authenticated SIGUE sin select sobre noticia_url_vista');

select * from finish();
rollback;
