-- 0067_militancia_historica_compartida.test.sql
-- Verifica la migración 0067 (RPC net-new militancia histórica compartida, REL-04)
-- CONTRA UN SCHEMA APLICADO:
--   * la RPC existe con la firma de entrada (text),
--   * es SECURITY DEFINER (secdef alias-keyed, molde 0061; subquery scoped por
--     regprocedure — WR-05: un `proname` a secas erroraría ante un overload),
--   * anon Y authenticated NO recuperaron grant execute (DOBLE-revoke completo
--     re-emitido tras el DROP — WR-05: el leg authenticated quedaba sin testear),
--   * proconfig fija search_path='' y statement_timeout=5s (molde 0064, CR-03),
--   * emite `total_n` en su returns table (conteo honesto antes del cap),
--   * NO filtra rut/email/partido_alias (interno) — emite SOLO id/nombre/camara/total_n.
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- Espeja 0061_cross_links_conteo_honesto_orden.test.sql (has_function/is/ok, begin/plan(N)/rollback).
-- pgTAP es la ÚNICA prueba válida del DDL (Pitfall 6): typecheck no prueba que Postgres corrió el DDL.

begin;
select plan(9);

-- ── La RPC existe con su firma de entrada (text) ─────────────────────────────────────────
select has_function('public', 'militancia_historica_compartida', ARRAY['text'], 'militancia_historica_compartida(text) existe');

-- ── Es SECURITY DEFINER (molde 0061; scoped por regprocedure, WR-05) ─────────────────────
select is(
  (select prosecdef from pg_proc where oid = 'public.militancia_historica_compartida(text)'::regprocedure),
  true,
  'militancia_historica_compartida es security definer');

-- ── CERO grant execute a anon tras el DROP+recreate (doble-revoke re-emitido) ────────────
select is(has_function_privilege('anon', 'public.militancia_historica_compartida(text)', 'execute'), false, 'anon SIN execute sobre militancia_historica_compartida');

-- ── CERO grant execute a authenticated (2º leg del doble-revoke, WR-05) ──────────────────
select is(has_function_privilege('authenticated', 'public.militancia_historica_compartida(text)', 'execute'), false, 'authenticated SIN execute sobre militancia_historica_compartida');

-- ── proconfig: search_path fijado ('' schema-qualified, molde secdef) ────────────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.militancia_historica_compartida(text)'::regprocedure) ~ 'search_path=',
  'search_path fijado en la función (secdef con nombres schema-qualified)');

-- ── proconfig: statement_timeout='5s' (molde 0064, CR-03 — cota DoS día-1) ───────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.militancia_historica_compartida(text)'::regprocedure) ~ 'statement_timeout=5s',
  'statement_timeout=5s fijado en la función (RPC bounded, molde 0064)');

-- ── Emite `total_n` (conteo honesto antes del cap, molde WR-01) ──────────────────────────
select ok(
  pg_get_function_result('public.militancia_historica_compartida(text)'::regprocedure) ~* '\ytotal_n\y',
  'militancia_historica_compartida emite total_n (conteo honesto)');

-- ── PII-safe: el returns table NUNCA proyecta rut/email/partido_alias ────────────────────
select ok(
  pg_get_function_result('public.militancia_historica_compartida(text)'::regprocedure) !~* '(rut|email|partido_alias)',
  'militancia_historica_compartida NO expone rut/email/partido_alias en el returns table');

-- ── Emite EXACTAMENTE id/nombre/camara/total_n (mismo contrato PII-safe que 0061) ─────────
select is(
  pg_get_function_result('public.militancia_historica_compartida(text)'::regprocedure),
  'TABLE(id text, nombre text, camara text, total_n bigint)',
  'militancia_historica_compartida emite SOLO id/nombre/camara/total_n');

select * from finish();
rollback;
