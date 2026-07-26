-- 0069_suscripcion_rls.test.sql
-- Verifica la migración 0069 (suscripcion + RLS user-owned) CONTRA UN SCHEMA APLICADO:
--   * `suscripcion` existe con RLS habilitada,
--   * AISLAMIENTO DE DOS USUARIOS (el corazón de NOTIF-01): el usuario A ve SOLO su
--     propia suscripción; el usuario B NO la ve ni la puede borrar (RLS aisla). Se
--     prueba con `set local role authenticated` + `set local request.jwt.claims`
--     (dos `sub` distintos) — el idiom real de auth.uid() bajo RLS, NO postgres/
--     service_role (que bypassa RLS → green no-op, Pitfall 2).
--   * anon NO tiene select (deny-by-default).
--
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs schema APLICADO).
-- build/typecheck NO prueban que el DDL se aplicó (Pitfall 5/6). Espeja 0065 style.
-- El apply a PROD es Plan 05; este test corre pre-apply contra un scratch DB local.

begin;
select plan(6);

-- ── Estructura: suscripcion existe + RLS habilitada ───────────────────────────────
select has_table('public', 'suscripcion', 'tabla suscripcion existe');
select is(
  (select count(*)::int from pg_class where relname = 'suscripcion' and relrowsecurity = true),
  1, 'RLS enabled en suscripcion');

-- ── Semilla (owner, bypassa RLS): dos usuarios en auth.users ──────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- ── Usuario A crea su suscripción y la ve (auth.uid() = user_id) ──────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
insert into suscripcion (user_id, tipo, objetivo_id)
  values ('00000000-0000-0000-0000-00000000000a', 'proyecto', '14309-04');
select results_eq(
  $$ select count(*)::int from suscripcion $$,
  $$ values (1) $$,
  'A ve su propia suscripcion (auth.uid() = user_id)');

-- ── Usuario B NO ve la suscripción de A (RLS aisla — Information Disclosure) ───────
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is_empty(
  $$ select 1 from suscripcion $$,
  'B NO ve la suscripcion de A (RLS aisla, T-103-04)');

-- ── Usuario B NO puede borrar la fila de A (Tampering — el delete no toca nada) ───
select is_empty(
  $$ delete from suscripcion returning 1 $$,
  'B NO puede borrar la suscripcion de A (delete owner-scoped, T-103-05)');

-- ── anon SIN select (deny-by-default) ─────────────────────────────────────────────
reset role;
select is(
  has_table_privilege('anon', 'suscripcion', 'select'),
  false,
  'anon SIN select sobre suscripcion (deny-by-default, T-103-07)');

select * from finish();
rollback;
