-- 0027_parlamentarios_publico_listado.test.sql
-- Verifica la migración 0026 (directorio público) CONTRA UN SCHEMA APLICADO:
--   * el RPC parlamentarios_publico() existe y es SECURITY DEFINER,
--   * anon tiene EXECUTE y lo invoca sin error,
--   * el RPC lista a los parlamentarios (nombre/cámara) para anon,
--   * el RPC NO incluye partido/rut/email en su salida (LEGAL-03),
--   * anon SIGUE sin poder leer partido directamente (deny-by-default intacto).
-- Corre via `psql -tA -f` (vs PROD aplicado) (pgTAP). Espeja 0020_parlamentario_publico.test.sql.

begin;
select plan(7);

-- ── Semilla de dos parlamentarios (owner, bypassa RLS) ────────────────────────
insert into parlamentario
  (id, nombre_normalizado, nombres, apellido_paterno, camara, periodo, region, origen, enlace, partido, rut, email)
  values
  ('PTAP26A', 'tap diputado listado', 'Juana', 'Pérez', 'diputados', '2022-2026', 'Región X',
   'camara', 'http://x', 'Partido Secreto', '11.111.111-1', 'secreto@example.cl'),
  ('PTAP26B', 'tap senador listado', 'Pedro', 'Acuña', 'senado', '2022-2030', 'Región Y',
   'senado', 'http://y', 'Otro Partido', '22.222.222-2', 'oculto@example.cl');

-- ── El RPC existe con la firma esperada (sin parámetro) y es SECURITY DEFINER ──
select has_function('public', 'parlamentarios_publico', ARRAY[]::text[],
  'función parlamentarios_publico() existe (sin parámetro)');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'parlamentarios_publico'),
  true,
  'parlamentarios_publico es security definer (lee la maestra sin abrirla a anon)');

-- ── anon tiene EXECUTE sobre el RPC ────────────────────────────────────────────
select ok(
  has_function_privilege('anon', 'public.parlamentarios_publico()', 'execute'),
  'anon tiene EXECUTE sobre parlamentarios_publico');

-- ── parlamentario sigue sin policies: partido/rut/email anon-denied ────────────
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'parlamentario' $$,
  'parlamentario sin policies (partido/rut/email siguen anon-denied)');

set local role anon;

-- anon NO lee la maestra directamente (RLS deny-by-default).
select is_empty(
  $$ select partido from parlamentario where id = 'PTAP26A' $$,
  'anon NO lee parlamentario.partido directamente (LEGAL-03)');

-- anon SÍ invoca el RPC y obtiene el listado (nombre compuesto + cámara) de las
-- filas sembradas, con el orden NEUTRAL por apellido (Acuña antes que Pérez).
select results_eq(
  $$ select nombre, camara from parlamentarios_publico()
       where id in ('PTAP26A', 'PTAP26B') $$,
  $$ values ('Pedro Acuña'::text, 'senado'::text),
            ('Juana Pérez'::text, 'diputados'::text) $$,
  'parlamentarios_publico lista nombre+cámara públicos para anon (orden neutral)');

reset role;

-- la salida del RPC NO expone partido/rut/email: la lista de columnas devueltas
-- es EXACTAMENTE las 7 públicas (sin afiliación ni PII dura, sin provenance).
select bag_eq(
  -- el RPC no tiene parámetros IN: todos los proargnames son columnas OUT (table),
  -- con proargmodes = {t,...,t} (NO null — `returns table` siempre fija modos).
  $$ select unnest(proargnames)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'parlamentarios_publico' $$,
  $$ values ('id'),('nombre'),('camara'),('region'),('distrito'),
            ('circunscripcion'),('periodo') $$,
  'parlamentarios_publico emite EXACTAMENTE 7 columnas seguras (sin partido/rut/email)');

select * from finish();
rollback;
