-- post-apply test para 0046_drop_web_reader.sql
-- Correr DESPUES de aplicar 0046 contra PROD:
--   psql "$DATABASE_URL" -tA -f supabase/tests/post-apply/0046_drop_web_reader.test.sql
-- Verifica que web_reader y sus artefactos (_wr policies, membresia) desaparecieron.

begin;
select plan(3);

select ok(
  not exists (select 1 from pg_roles where rolname = 'web_reader'),
  'rol web_reader fue eliminado'
);

select is(
  (select count(*)::int from pg_policies
   where policyname like '%\_public\_read\_wr' escape '\'),
  0,
  'no quedan policies *_public_read_wr (las 26 paralelas a web_reader)'
);

select is(
  (select count(*)::int
   from pg_auth_members m
   join pg_roles parent on parent.oid = m.roleid
   where parent.rolname = 'web_reader'),
  0,
  'no quedan membresias hacia web_reader'
);

select * from finish();
rollback;
