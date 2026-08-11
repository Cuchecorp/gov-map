-- 0088_dead_letter_pii_rut.test.sql — pgTAP: el 7mo valor entra, lo ilegal sigue fuera.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0088_dead_letter_pii_rut.test.sql
begin;
select plan(3);

select lives_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage) values ('t0088-pii', 'pii_rut_en_texto')$$,
  '0088: pii_rut_en_texto inserta'
);
select lives_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage) values ('t0088-viejo', 'parse_fallido')$$,
  '0088: los 6 valores previos siguen legales'
);
select throws_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage) values ('t0088-mal', 'stage_inventado')$$,
  '23514', null, '0088: lo ilegal sigue violando el check'
);

select * from finish();
rollback;
