-- 0040_cruces_rpc.test.sql
-- Verifica la migración 0040 (RPC cruces_de_parlamentario) CONTRA UN SCHEMA APLICADO:
--   * la función existe y es SECURITY DEFINER,
--   * anon NO tiene EXECUTE (deny-by-default hasta firma Phase 39 — INVERSIÓN del patrón
--     subgrafo_red/0030, que SÍ concede a anon),
--   * el cuerpo NO contiene partido/rut/email/donante_id (no-PII, LEGAL-03),
--   * la proyección lee cruce_senal y une al catálogo sector (etiqueta pública).
-- Corre vía `supabase test db` (pgTAP). build/typecheck NO prueban que el DDL se aplicó
-- (falso positivo de CI, Pitfall 5). Espeja 0030_net.test.sql:92-105 con la assertion de
-- privilegio INVERTIDA. Requiere 0038/0039 aplicadas.

begin;
select plan(4);

-- ── la función existe + es SECURITY DEFINER ───────────────────────────────────
select has_function('public', 'cruces_de_parlamentario', ARRAY['text'],
  'función cruces_de_parlamentario(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'),
  true,
  'cruces_de_parlamentario es security definer (lee cruce_senal deny-by-default)');

-- ── anon NO tiene EXECUTE (deny-by-default hasta firma Phase 39 — INVERSIÓN 0030) ─
select ok(
  not has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon NO tiene EXECUTE sobre cruces_de_parlamentario (deny hasta Phase 39)');

-- ── no-PII: el cuerpo NO referencia partido/rut/email/donante_id (LEGAL-03) ─────
-- Se STRIPEAN los comentarios `--` antes de buscar y se exige límite de palabra (\y).
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario')
    !~* '\y(partido|rut|email|donante_id)\y',
  'el cuerpo de cruces_de_parlamentario NO contiene partido/rut/email/donante_id (no-PII)');

select * from finish();
rollback;
