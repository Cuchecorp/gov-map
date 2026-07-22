-- 0060_bio_partido_publico.test.sql
-- Verifica la migración 0060 (RPCs públicas de bio + partido + cross-links) CONTRA UN
-- SCHEMA APLICADO:
--   * las 8 RPCs existen con la firma esperada,
--   * las 8 son SECURITY DEFINER (prosecdef),
--   * NINGUNA tiene grant execute a anon (CERO grant, Camino A doble-revoke),
--   * el returns table de las RPCs de cabecera/militancia/listado NO expone rut/email/partido_alias.
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- build/typecheck NO prueban que el DDL se aplicó (falso positivo de CI, Pitfall 6).
-- Espeja 0059_bio_comisiones.test.sql (has_function/is/pg_proc), begin/plan(N)/rollback.

begin;
select plan(30);

-- ── Las 8 RPCs existen (has_function 'public', nombre, ARRAY de tipos de entrada) ──────
select has_function('public', 'parlamentario_publico_v2',        ARRAY['text'], 'parlamentario_publico_v2(text) existe');
select has_function('public', 'militancias_de_parlamentario',    ARRAY['text'], 'militancias_de_parlamentario(text) existe');
select has_function('public', 'comisiones_de_parlamentario',     ARRAY['text'], 'comisiones_de_parlamentario(text) existe');
select has_function('public', 'parlamentarios_publico_v2',       '{}'::text[],  'parlamentarios_publico_v2() existe');
select has_function('public', 'copartidarios_de_parlamentario',  ARRAY['text'], 'copartidarios_de_parlamentario(text) existe');
select has_function('public', 'de_la_misma_zona',                ARRAY['text'], 'de_la_misma_zona(text) existe');
select has_function('public', 'co_comisionados_de_parlamentario',ARRAY['text'], 'co_comisionados_de_parlamentario(text) existe');
select has_function('public', 'coautores_de_parlamentario',      ARRAY['text'], 'coautores_de_parlamentario(text) existe');

-- ── Las 8 son SECURITY DEFINER (pg_proc.prosecdef = true) ──────────────────────────────
select is((select prosecdef from pg_proc where proname = 'parlamentario_publico_v2'),        true, 'parlamentario_publico_v2 es security definer');
select is((select prosecdef from pg_proc where proname = 'militancias_de_parlamentario'),    true, 'militancias_de_parlamentario es security definer');
select is((select prosecdef from pg_proc where proname = 'comisiones_de_parlamentario'),     true, 'comisiones_de_parlamentario es security definer');
select is((select prosecdef from pg_proc where proname = 'parlamentarios_publico_v2'),       true, 'parlamentarios_publico_v2 es security definer');
select is((select prosecdef from pg_proc where proname = 'copartidarios_de_parlamentario'),  true, 'copartidarios_de_parlamentario es security definer');
select is((select prosecdef from pg_proc where proname = 'de_la_misma_zona'),                true, 'de_la_misma_zona es security definer');
select is((select prosecdef from pg_proc where proname = 'co_comisionados_de_parlamentario'),true, 'co_comisionados_de_parlamentario es security definer');
select is((select prosecdef from pg_proc where proname = 'coautores_de_parlamentario'),      true, 'coautores_de_parlamentario es security definer');

-- ── CERO grant execute a anon en las 8 (Camino A doble-revoke, T-91-02) ────────────────
select is(has_function_privilege('anon', 'public.parlamentario_publico_v2(text)',        'execute'), false, 'anon SIN execute sobre parlamentario_publico_v2');
select is(has_function_privilege('anon', 'public.militancias_de_parlamentario(text)',    'execute'), false, 'anon SIN execute sobre militancias_de_parlamentario');
select is(has_function_privilege('anon', 'public.comisiones_de_parlamentario(text)',     'execute'), false, 'anon SIN execute sobre comisiones_de_parlamentario');
select is(has_function_privilege('anon', 'public.parlamentarios_publico_v2()',           'execute'), false, 'anon SIN execute sobre parlamentarios_publico_v2');
select is(has_function_privilege('anon', 'public.copartidarios_de_parlamentario(text)',  'execute'), false, 'anon SIN execute sobre copartidarios_de_parlamentario');
select is(has_function_privilege('anon', 'public.de_la_misma_zona(text)',                'execute'), false, 'anon SIN execute sobre de_la_misma_zona');
select is(has_function_privilege('anon', 'public.co_comisionados_de_parlamentario(text)','execute'), false, 'anon SIN execute sobre co_comisionados_de_parlamentario');
select is(has_function_privilege('anon', 'public.coautores_de_parlamentario(text)',      'execute'), false, 'anon SIN execute sobre coautores_de_parlamentario');

-- ── Cero PII en el returns table (rut/email/partido_alias) ─────────────────────────────
-- pg_get_function_result devuelve la firma de salida; NO debe mencionar columnas sensibles.
select ok(
  pg_get_function_result('public.parlamentario_publico_v2(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'parlamentario_publico_v2 NO emite rut/email/partido_alias');
select ok(
  pg_get_function_result('public.militancias_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'militancias_de_parlamentario NO emite rut/email/partido_alias');
select ok(
  pg_get_function_result('public.parlamentarios_publico_v2()'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'parlamentarios_publico_v2 NO emite rut/email/partido_alias');
select ok(
  pg_get_function_result('public.comisiones_de_parlamentario(text)'::regprocedure) !~* '\y(rut|email|partido_alias)\y',
  'comisiones_de_parlamentario NO emite rut/email/partido_alias');

-- ── El partido SÍ viaja en la cabecera v2 (la reversión operador 2026-07-21 quedó efectiva) ──
select ok(
  pg_get_function_result('public.parlamentario_publico_v2(text)'::regprocedure) ~* '\ypartido\y',
  'parlamentario_publico_v2 SÍ emite partido (reversión operador 2026-07-21)');
select ok(
  pg_get_function_result('public.parlamentarios_publico_v2()'::regprocedure) ~* '\ypartido\y',
  'parlamentarios_publico_v2 SÍ emite partido (listado ampliado)');

select * from finish();
rollback;
