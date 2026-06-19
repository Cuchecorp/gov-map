-- 0020_parlamentario_publico.test.sql
-- Verifica la migración 0020 (cabecera pública de la ficha) CONTRA UN SCHEMA APLICADO:
--   * el RPC parlamentario_publico(text) existe y es SECURITY DEFINER,
--   * anon tiene EXECUTE y lo invoca sin error,
--   * el RPC devuelve el nombre/cámara de un parlamentario existente,
--   * el RPC NO incluye partido/rut/email en su salida (LEGAL-03),
--   * anon SIGUE sin poder leer partido directamente (deny-by-default intacto).
-- Corre via `supabase test db` (pgTAP). Espeja 0019_voto_asistencia_y_ficha.test.sql.

begin;
select plan(7);

-- ── Semilla de un parlamentario (owner, bypassa RLS) ──────────────────────────
insert into parlamentario
  (id, nombre_normalizado, nombres, apellido_paterno, camara, periodo, region, origen, enlace, partido, rut, email)
  values
  ('PTAP20', 'tap diputado publico', 'Juana', 'Pérez', 'diputados', '2022-2026', 'Región X',
   'camara', 'http://x', 'Partido Secreto', '11.111.111-1', 'secreto@example.cl');

-- ── El RPC existe con la firma esperada y es SECURITY DEFINER ──────────────────
select has_function('public', 'parlamentario_publico', ARRAY['text'],
  'función parlamentario_publico(text) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'parlamentario_publico'),
  true,
  'parlamentario_publico es security definer (lee la maestra sin abrirla a anon)');

-- ── anon tiene EXECUTE sobre el RPC ────────────────────────────────────────────
select ok(
  has_function_privilege('anon', 'public.parlamentario_publico(text)', 'execute'),
  'anon tiene EXECUTE sobre parlamentario_publico');

-- ── parlamentario sigue sin policies: partido/rut/email anon-denied ────────────
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'parlamentario' $$,
  'parlamentario sin policies (partido/rut/email siguen anon-denied)');

set local role anon;

-- anon NO lee la maestra directamente (RLS deny-by-default).
select is_empty(
  $$ select partido from parlamentario where id = 'PTAP20' $$,
  'anon NO lee parlamentario.partido directamente (LEGAL-03)');

-- anon SÍ invoca el RPC y obtiene la cabecera pública (nombre compuesto + cámara).
select results_eq(
  $$ select nombre, camara from parlamentario_publico('PTAP20') $$,
  $$ values ('Juana Pérez'::text, 'diputados'::text) $$,
  'parlamentario_publico devuelve nombre+cámara públicos para anon');

-- la salida del RPC NO expone partido/rut/email: la lista de columnas devueltas
-- es exactamente la pública (sin afiliación ni PII dura).
select bag_eq(
  $$ select unnest(proargnames)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'parlamentario_publico'
        and proargmodes is null $$,  -- todos OUT (table) cuando no hay modos mixtos
  $$ values ('id'),('nombre'),('camara'),('region'),('distrito'),
            ('circunscripcion'),('periodo'),('origen'),('fecha_captura'),('enlace') $$,
  'parlamentario_publico NO emite partido/rut/email (solo columnas públicas)');

reset role;

select * from finish();
rollback;
