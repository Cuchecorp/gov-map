-- 0087_noticia_etiqueta_llm_ledger.test.sql — pgTAP de la 0087.
--   PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f supabase/tests/0087_noticia_etiqueta_llm_ledger.test.sql
begin;
select plan(12);

-- columnas nuevas de noticia
select has_column('public', 'noticia', 'etiqueta', '0087: noticia.etiqueta existe');
select has_column('public', 'noticia', 'etiqueta_confianza', '0087: noticia.etiqueta_confianza existe');
select has_column('public', 'noticia', 'etiqueta_modelo', '0087: noticia.etiqueta_modelo existe');
select has_column('public', 'noticia', 'clasificada_en', '0087: noticia.clasificada_en existe');

-- los checks MUERDEN (controles positivos apareados)
select lives_ok(
  $$insert into public.noticia (url_hash, url, url_canonica, titular, outlet, r2_path, estado, etiqueta)
    values ('t0087-ok', 'https://x.test/a', 'https://x.test/a', 'T', 'latercera', 'r2/t', 'clasificada', 'no_legislativa')$$,
  '0087: clasificada CON etiqueta legal inserta'
);
select throws_ok(
  $$insert into public.noticia (url_hash, url, url_canonica, titular, outlet, r2_path, estado, etiqueta)
    values ('t0087-e1', 'https://x.test/b', 'https://x.test/b', 'T', 'latercera', 'r2/t', 'pendiente', 'etiqueta_inventada')$$,
  '23514', null, '0087: etiqueta ilegal viola el check'
);
select throws_ok(
  $$insert into public.noticia (url_hash, url, url_canonica, titular, outlet, r2_path, estado)
    values ('t0087-e2', 'https://x.test/c', 'https://x.test/c', 'T', 'latercera', 'r2/t', 'clasificada')$$,
  '23514', null, '0087: clasificada SIN etiqueta viola la coherencia'
);
select throws_ok(
  $$insert into public.noticia (url_hash, url, url_canonica, titular, outlet, r2_path, estado, etiqueta, etiqueta_confianza)
    values ('t0087-e3', 'https://x.test/d', 'https://x.test/d', 'T', 'latercera', 'r2/t', 'clasificada', 'ambiguo', 1.5)$$,
  '23514', null, '0087: confianza fuera de [0,1] viola el check'
);

-- llm_ledger deny-all
select isnt(to_regclass('public.llm_ledger'), null, '0087: llm_ledger existe');
select is(
  (select relrowsecurity from pg_class where oid = 'public.llm_ledger'::regclass),
  true, '0087: llm_ledger RLS habilitado'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'llm_ledger'),
  0, '0087: llm_ledger cero policies'
);
select is(has_table_privilege('anon', 'public.llm_ledger', 'select'), false, '0087: anon sin SELECT en llm_ledger');

select * from finish();
rollback;
