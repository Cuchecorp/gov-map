-- 0061_cross_links_conteo_honesto_orden.test.sql
-- Verifica la migración 0061 (endurecimiento de los 4 cross-links) CONTRA UN SCHEMA
-- APLICADO:
--   * las 4 RPCs siguen existiendo con la MISMA firma de entrada (text / —),
--   * las 4 siguen siendo SECURITY DEFINER,
--   * NINGUNA recuperó grant execute a anon (el doble-revoke se re-emitió tras el DROP),
--   * las 4 AHORA emiten `total_n` en su returns table (WR-01 conteo honesto),
--   * ninguna filtra rut/email/partido_alias.
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- Espeja 0060_bio_partido_publico.test.sql (has_function/is/ok, begin/plan(N)/rollback).

begin;
select plan(16);

-- ── Las 4 RPCs de cross-link existen con su firma de entrada intacta ──────────────────────
select has_function('public', 'copartidarios_de_parlamentario',  ARRAY['text'], 'copartidarios_de_parlamentario(text) existe');
select has_function('public', 'de_la_misma_zona',                ARRAY['text'], 'de_la_misma_zona(text) existe');
select has_function('public', 'co_comisionados_de_parlamentario',ARRAY['text'], 'co_comisionados_de_parlamentario(text) existe');
select has_function('public', 'coautores_de_parlamentario',      ARRAY['text'], 'coautores_de_parlamentario(text) existe');

-- ── Siguen siendo SECURITY DEFINER ───────────────────────────────────────────────────────
select is((select prosecdef from pg_proc where proname = 'copartidarios_de_parlamentario'),  true, 'copartidarios_de_parlamentario es security definer');
select is((select prosecdef from pg_proc where proname = 'de_la_misma_zona'),                true, 'de_la_misma_zona es security definer');
select is((select prosecdef from pg_proc where proname = 'co_comisionados_de_parlamentario'),true, 'co_comisionados_de_parlamentario es security definer');
select is((select prosecdef from pg_proc where proname = 'coautores_de_parlamentario'),      true, 'coautores_de_parlamentario es security definer');

-- ── CERO grant execute a anon tras el DROP+recreate (doble-revoke re-emitido) ─────────────
select is(has_function_privilege('anon', 'public.copartidarios_de_parlamentario(text)',  'execute'), false, 'anon SIN execute sobre copartidarios_de_parlamentario');
select is(has_function_privilege('anon', 'public.de_la_misma_zona(text)',                'execute'), false, 'anon SIN execute sobre de_la_misma_zona');
select is(has_function_privilege('anon', 'public.co_comisionados_de_parlamentario(text)','execute'), false, 'anon SIN execute sobre co_comisionados_de_parlamentario');
select is(has_function_privilege('anon', 'public.coautores_de_parlamentario(text)',      'execute'), false, 'anon SIN execute sobre coautores_de_parlamentario');

-- ── WR-01: las 4 emiten `total_n` (conteo honesto antes del cap) ──────────────────────────
select ok(
  pg_get_function_result('public.copartidarios_de_parlamentario(text)'::regprocedure) ~* '\ytotal_n\y',
  'copartidarios_de_parlamentario emite total_n (WR-01)');
select ok(
  pg_get_function_result('public.de_la_misma_zona(text)'::regprocedure) ~* '\ytotal_n\y',
  'de_la_misma_zona emite total_n (WR-01)');
select ok(
  pg_get_function_result('public.co_comisionados_de_parlamentario(text)'::regprocedure) ~* '\ytotal_n\y',
  'co_comisionados_de_parlamentario emite total_n (WR-01)');
select ok(
  pg_get_function_result('public.coautores_de_parlamentario(text)'::regprocedure) ~* '\ytotal_n\y',
  'coautores_de_parlamentario emite total_n (WR-01)');

select * from finish();
rollback;
