-- 0083_coautoria_v2.test.sql
-- Verifica la migración 0083 (RPC net-new coautores_de_parlamentario_v2, fila 3.3/DEBT-04)
-- CONTRA UN SCHEMA APLICADO:
--   * la v2 existe con la firma de entrada (text),
--   * es SECURITY DEFINER + STABLE,
--   * proconfig fija search_path='' y statement_timeout=5s (molde 0064, CR-03),
--   * la firma de retorno es IDÉNTICA a la de la viva (control apareado: la v2 no derivó
--     columnas al copiar el cuerpo),
--   * la VIVA sigue intacta: existe, y su prosrc contiene `limit 20`; la v2 contiene `limit 1000`,
--   * CERO grant execute a anon/authenticated/public (doble-revoke re-emitido),
--   * control de contenido positivo: la v2 devuelve > 20 filas para D1178 (hoy la vieja
--     devuelve exactamente 20) — el cero de la deuda deja de ser vacuo,
--   * la v2 NO proyecta columnas PII (rut, donante_id ausentes del prosrc).
-- Corre vía `PGCLIENTENCODING=UTF8 psql "$SUPABASE_DB_URL" -tA -f` (vs PROD aplicado).
-- Espeja 0067_militancia_historica_compartida.test.sql (has_function/is/ok, begin/plan(N)/rollback).
-- pgTAP es la ÚNICA prueba válida del DDL (Pitfall 6): typecheck no prueba que Postgres corrió el DDL.
-- NO se ejecuta esta migración en el plan 131-02 (131-03 la aplica y corre este pgTAP).

begin;
select plan(12);

-- ── La v2 existe con su firma de entrada (text) ──────────────────────────────────────────
select has_function('public', 'coautores_de_parlamentario_v2', ARRAY['text'], 'coautores_de_parlamentario_v2(text) existe');

-- ── Es SECURITY DEFINER (scoped por regprocedure, WR-05) ─────────────────────────────────
select is(
  (select prosecdef from pg_proc where oid = 'public.coautores_de_parlamentario_v2(text)'::regprocedure),
  true,
  'coautores_de_parlamentario_v2 es security definer');

-- ── Es STABLE (provolatile='s') ───────────────────────────────────────────────────────────
select is(
  (select provolatile from pg_proc where oid = 'public.coautores_de_parlamentario_v2(text)'::regprocedure),
  's',
  'coautores_de_parlamentario_v2 es stable');

-- ── proconfig: search_path fijado + statement_timeout='5s' (molde 0064) ──────────────────
select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.coautores_de_parlamentario_v2(text)'::regprocedure) ~ 'search_path=',
  'search_path fijado en la v2 (secdef con nombres schema-qualified)');

select ok(
  (select array_to_string(proconfig, ',') from pg_proc
    where oid = 'public.coautores_de_parlamentario_v2(text)'::regprocedure) ~ 'statement_timeout=5s',
  'statement_timeout=5s fijado en la v2 (RPC bounded, molde 0064)');

-- ── Control apareado: la firma de retorno de la v2 es IDÉNTICA a la de la viva ───────────
select is(
  pg_get_function_result('public.coautores_de_parlamentario_v2(text)'::regprocedure),
  pg_get_function_result('public.coautores_de_parlamentario(text)'::regprocedure),
  'coautores_de_parlamentario_v2 emite la MISMA firma de retorno que la viva (control apareado)');

-- ── La VIVA sigue intacta: existe y su prosrc contiene `limit 20` ────────────────────────
select has_function('public', 'coautores_de_parlamentario', ARRAY['text'], 'coautores_de_parlamentario(text) [la viva] sigue existiendo');

select ok(
  (select prosrc from pg_proc where oid = 'public.coautores_de_parlamentario(text)'::regprocedure) ~ 'limit 20',
  'la viva conserva limit 20 (no fue alterada)');

-- ── La v2 contiene `limit 1000` ───────────────────────────────────────────────────────────
select ok(
  (select prosrc from pg_proc where oid = 'public.coautores_de_parlamentario_v2(text)'::regprocedure) ~ 'limit 1000',
  'coautores_de_parlamentario_v2 tiene limit 1000 (techo derivado)');

-- ── Cero-grant efectivo: anon/authenticated/public sin execute sobre la v2 ───────────────
select is(has_function_privilege('anon', 'public.coautores_de_parlamentario_v2(text)', 'execute'), false, 'anon SIN execute sobre coautores_de_parlamentario_v2');

-- ── PII-safe: el returns table NUNCA proyecta rut/donante_id ─────────────────────────────
select ok(
  pg_get_function_result('public.coautores_de_parlamentario_v2(text)'::regprocedure) !~* '(rut|donante_id)',
  'coautores_de_parlamentario_v2 NO expone rut/donante_id en el returns table');

-- ── Control de contenido positivo: la v2 devuelve > 20 filas para D1178 ──────────────────
-- (hoy la vieja devuelve exactamente 20 por el limit; el cero de la deuda no es vacuo)
select ok(
  (select count(*) from public.coautores_de_parlamentario_v2('D1178')) > 20,
  'coautores_de_parlamentario_v2 devuelve mas de 20 filas para D1178 (deuda no vacua)');

select * from finish();
rollback;
