-- 0029_votos_instructivos.test.sql
-- Verifica la migración 0028 (RPC votos_de_parlamentario extendido) CONTRA UN SCHEMA
-- APLICADO (pgTAP):
--   * la función votos_de_parlamentario(text, int, int) existe (firma de params intacta),
--   * sigue siendo security INVOKER (NO definer — toca solo tablas público-read),
--   * su `returns table` INCLUYE las columnas nuevas (titulo, idea_matriz, resultado,
--     total_si, total_no, quorum) además de las existentes (etapa),
--   * anon tiene EXECUTE y lo invoca sin error (devuelve las columnas nuevas pobladas),
--   * anon SIGUE sin poder leer parlamentario.partido directamente (deny-by-default).
-- Corre via `supabase test db` (pgTAP). build/typecheck NO prueban el DDL aplicado.
-- Espeja el patrón de 0019/0027 (begin; plan(N); ...; finish(); rollback;).

begin;
select plan(8);

-- ── La función existe con la FIRMA DE PARÁMETROS intacta (text, int, int) ──────
select has_function('public', 'votos_de_parlamentario',
  ARRAY['text', 'integer', 'integer'],
  'función votos_de_parlamentario(text, int, int) existe (firma de params intacta)');

-- ── Sigue siendo SECURITY INVOKER (no escala privilegios; no lee parlamentario) ─
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'votos_de_parlamentario'),
  false,
  'votos_de_parlamentario es security INVOKER (toca solo tablas público-read)');

-- ── El returns table INCLUYE las columnas nuevas (sustancia + desenlace) ───────
-- proargnames contiene tanto los params IN (p_id/p_limit/p_offset) como las columnas
-- OUT del `returns table`; se afirma que el SET de nombres CONTIENE las columnas clave.
select bag_has(
  $$ select unnest(proargnames)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'votos_de_parlamentario' $$,
  $$ values ('titulo'),('idea_matriz'),('resultado'),
            ('total_si'),('total_no'),('quorum'),('etapa') $$,
  'votos_de_parlamentario emite las columnas nuevas (titulo/idea_matriz/desenlace) + etapa');

-- ── El ORDEN posicional de columnas es exacto (el cliente mapea por posición) ───
-- bag_has (arriba) ignora orden; el contrato de 0028 es: 9 cols existentes, LUEGO las 8
-- nuevas en orden fijo. Un reorder del `returns table` rompería el mapeo posicional del
-- frontend en silencio → se afirma la secuencia completa de proargnames (IN + OUT).
select is(
  (select array_to_string(proargnames, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'votos_de_parlamentario'),
  'p_id,p_limit,p_offset,votacion_id,boletin,fecha,seleccion,etapa,camara,origen,fecha_captura,enlace,titulo,idea_matriz,resultado,total_si,total_no,total_abstencion,total_pareo,quorum',
  'votos_de_parlamentario conserva el orden posicional exacto (9 existentes + 8 nuevas)');

-- ── parlamentario sigue sin policies: partido/rut/email anon-denied (LEGAL-03) ──
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'parlamentario' $$,
  'parlamentario sin policies (partido/rut/email siguen anon-denied)');

-- ── anon tiene EXECUTE sobre el RPC (grant crítico de la ficha) ────────────────
select ok(
  has_function_privilege('anon',
    'public.votos_de_parlamentario(text, integer, integer)', 'execute'),
  'anon tiene EXECUTE sobre votos_de_parlamentario');

-- ── Semilla mínima (owner, bypassa RLS) + invocación efectiva con columnas nuevas ─
-- Un proyecto con idea matriz + una votación con desenlace + un voto confirmado, para
-- comprobar que el RPC POBLA titulo/idea_matriz/resultado y NO descarta la fila.
insert into parlamentario (id, nombre_normalizado, camara, periodo, origen, enlace, partido)
  values ('PTAP29', 'tap diputado votos', 'diputados', '2022-2026', 'test', 'http://x', 'Partido X');
insert into proyecto (boletin, boletin_num, titulo, origen, enlace)
  values ('70029-01', '70029', 'Proyecto pgTAP 0029', 'test', 'http://x');
insert into proyecto_ficha (boletin, idea_matriz, cuerpos_legales, estado, origen, fecha_captura)
  values ('70029-01', 'Idea matriz de prueba del proyecto 0029', '[]'::jsonb, 'embebido', 'test', now());
insert into votacion (id, boletin, camara, origen, enlace, resultado, total_si, total_no, etapa, quorum)
  values ('camara:tap29', '70029-01', 'diputados', 'test', 'http://x', 'Aprobado', 58, 12, 'Primer trámite', 'Simple');
insert into voto (votacion_id, fuente_voter_id, mencion_nombre, seleccion, parlamentario_id, estado_vinculo)
  values ('camara:tap29', 'tap-29', 'Diputado Tap', 'si', 'PTAP29', 'confirmado');

set local role anon;

-- anon NO lee partido directamente (RLS deny-by-default intacto).
select is_empty(
  $$ select partido from parlamentario where id = 'PTAP29' $$,
  'anon NO lee parlamentario.partido directamente (LEGAL-03)');

-- anon SÍ invoca el RPC y obtiene la fila confirmada con SUSTANCIA + DESENLACE poblados.
select results_eq(
  $$ select titulo, idea_matriz, resultado, total_si, total_no
       from votos_de_parlamentario('PTAP29', 50, 0) $$,
  $$ values ('Proyecto pgTAP 0029'::text,
             'Idea matriz de prueba del proyecto 0029'::text,
             'Aprobado'::text, 58, 12) $$,
  'votos_de_parlamentario devuelve titulo+idea_matriz+desenlace para la fila confirmada');

reset role;

select * from finish();
rollback;
