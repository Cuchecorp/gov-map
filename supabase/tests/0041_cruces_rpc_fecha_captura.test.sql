-- 0041_cruces_rpc_fecha_captura.test.sql
-- Verifica 0041 (CRUCEN-01: fecha_captura en el RPC) CONTRA SCHEMA APLICADO.
-- Corre vía `psql -tA -f` contra PROD aplicado (Phase 23 pattern), begin;…;rollback;.
begin;
select plan(4);

-- ── el returns table EMITE fecha_captura (set de nombres lo CONTIENE) ──────────
select bag_has(
  $$ select unnest(proargnames)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario' $$,
  $$ values ('fecha_captura') $$,
  'cruces_de_parlamentario emite la columna fecha_captura');

-- ── ORDEN posicional exacto (el cliente mapea por posición; reorder = bug silente) ─
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario'),
  'p_id,sector_id,sector_etiqueta,tipo_senal,conteo,evidencia,fecha_captura',
  'cruces_de_parlamentario conserva el orden posicional exacto (fecha_captura al final)');

-- ── anon SIGUE sin EXECUTE tras drop+recreate (regresión del re-revoke) ────────
-- Si falla: el segundo revoke (from anon, authenticated) no se emitió → leak silencioso.
select ok(
  not has_function_privilege('anon', 'public.cruces_de_parlamentario(text)', 'execute'),
  'anon SIGUE sin EXECUTE sobre cruces_de_parlamentario tras drop+recreate (re-revoke OK)');

-- ── no-PII: el cuerpo NO referencia partido/rut/email/donante_id (LEGAL-03) ─────
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cruces_de_parlamentario')
    !~* '\y(partido|rut|email|donante_id)\y',
  'el cuerpo de cruces_de_parlamentario NO contiene partido/rut/email/donante_id (no-PII)');

select * from finish();
rollback;
