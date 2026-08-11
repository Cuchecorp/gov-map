-- 0086_noticia_dead_letter.test.sql — pgTAP del dead-letter de 134.
--
-- Contrato verificado: existencia, RLS habilitado, CERO policies, CERO privilegios para
-- anon/authenticated, check cerrado de rejection_stage (muerde), check de payload acotado
-- (muerde). Correr contra el schema APLICADO:
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0086_noticia_dead_letter.test.sql
begin;
select plan(13);

-- existencia
select isnt(to_regclass('public.noticia_dead_letter'), null, '0086: tabla noticia_dead_letter existe');

-- RLS habilitado
select is(
  (select relrowsecurity from pg_class where oid = 'public.noticia_dead_letter'::regclass),
  true,
  '0086: RLS habilitado'
);

-- cero policies
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'noticia_dead_letter'),
  0,
  '0086: cero policies (deny-all real)'
);

-- zero-grant anon / authenticated
select is(has_table_privilege('anon', 'public.noticia_dead_letter', 'select'), false, '0086: anon sin SELECT');
select is(has_table_privilege('anon', 'public.noticia_dead_letter', 'insert'), false, '0086: anon sin INSERT');
select is(has_table_privilege('anon', 'public.noticia_dead_letter', 'update'), false, '0086: anon sin UPDATE');
select is(has_table_privilege('anon', 'public.noticia_dead_letter', 'delete'), false, '0086: anon sin DELETE');
select is(has_table_privilege('authenticated', 'public.noticia_dead_letter', 'select'), false, '0086: authenticated sin SELECT');
select is(has_table_privilege('authenticated', 'public.noticia_dead_letter', 'insert'), false, '0086: authenticated sin INSERT');

-- el check de rejection_stage MUERDE (control positivo apareado: legal pasa, ilegal lanza)
select lives_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage) values ('t-legal', 'parse_fallido')$$,
  '0086: stage legal inserta'
);
select throws_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage) values ('t-ilegal', 'stage_inventado')$$,
  '23514',
  null,
  '0086: stage ilegal viola el check'
);

-- el check de payload acotado MUERDE
select lives_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage, payload) values ('t-payload', 'lote_invalido', '{"n": 1}'::jsonb)$$,
  '0086: payload chico inserta'
);
select throws_ok(
  $$insert into public.noticia_dead_letter (url_hash, rejection_stage, payload)
    values ('t-payload-grande', 'lote_invalido', jsonb_build_object('texto', repeat('x', 5000)))$$,
  '23514',
  null,
  '0086: payload > 4000 bytes viola el check'
);

select * from finish();
rollback;
