-- 0019_voto_asistencia_y_ficha.test.sql
-- Verifica la migración 0019 (VOTE-03/04/05) CONTRA UN SCHEMA APLICADO (pgTAP):
--   * el CHECK de voto.seleccion admite 'ausente' y rechaza un valor inválido,
--   * el índice parcial voto_parlamentario_id_idx existe,
--   * los RPCs votos_de_parlamentario y rebeldias_de_parlamentario existen,
--   * anon NO puede leer parlamentario.partido (deny-by-default, LEGAL-03),
--   * anon SÍ tiene EXECUTE sobre ambos RPCs y los invoca sin error.
-- Corre via `supabase test db` (pgTAP). build/typecheck NO prueban el DDL aplicado.
-- Espeja el patrón de 0011/0018 (begin; plan(N); ...; finish(); rollback;).

begin;
select plan(13);

-- ── (a) El CHECK de voto.seleccion admite 'ausente' ───────────────────────────
-- Semilla mínima (owner, bypassa RLS) para insertar un voto con seleccion='ausente'.
insert into proyecto (boletin, boletin_num, titulo, origen, enlace)
  values ('70001-01', '70001', 'Proyecto pgTAP 0019', 'test', 'http://x');
insert into votacion (id, boletin, camara, origen, enlace)
  values ('camara:tap19', '70001-01', 'diputados', 'test', 'http://x');

select lives_ok(
  $$ insert into voto (votacion_id, mencion_nombre, seleccion)
     values ('camara:tap19', 'Diputado Ausente', 'ausente') $$,
  'voto.seleccion admite ''ausente'' (CHECK extendido por 0019)'
);

-- ── El CHECK rechaza un valor inválido (no admite categorías libres) ──────────
select throws_ok(
  $$ insert into voto (votacion_id, mencion_nombre, seleccion)
     values ('camara:tap19', 'Diputado Inválido', 'no_voto') $$,
  '23514',
  null,
  'voto.seleccion rechaza un valor fuera del dominio (CHECK 23514)'
);

-- ── (b) El índice parcial voto_parlamentario_id_idx existe ────────────────────
select isnt_empty(
  $$ select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'voto_parlamentario_id_idx'
        and c.relkind = 'i' $$,
  'índice voto_parlamentario_id_idx existe (query de la ficha, Pitfall 2)'
);
-- y es PARCIAL (tiene predicado where parlamentario_id is not null).
select isnt_empty(
  $$ select 1 from pg_index i
       join pg_class c on c.oid = i.indexrelid
      where c.relname = 'voto_parlamentario_id_idx' and i.indpred is not null $$,
  'voto_parlamentario_id_idx es PARCIAL (indpred presente)'
);

-- ── (c) Ambos RPCs existen con la firma esperada ──────────────────────────────
select has_function('public', 'votos_de_parlamentario',
  ARRAY['text', 'integer', 'integer'],
  'función votos_de_parlamentario(text, int, int) existe');
select has_function('public', 'rebeldias_de_parlamentario',
  ARRAY['text'],
  'función rebeldias_de_parlamentario(text) existe');

-- ── rebeldias_de_parlamentario es SECURITY DEFINER (toca partido internamente) ─
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rebeldias_de_parlamentario'),
  true,
  'rebeldias_de_parlamentario es security definer (lee partido sin abrirlo a anon)'
);

-- ── anon tiene EXECUTE sobre ambos RPCs (grants críticos de la ficha) ─────────
select ok(
  has_function_privilege('anon',
    'public.votos_de_parlamentario(text, integer, integer)', 'execute'),
  'anon tiene EXECUTE sobre votos_de_parlamentario');
select ok(
  has_function_privilege('anon',
    'public.rebeldias_de_parlamentario(text)', 'execute'),
  'anon tiene EXECUTE sobre rebeldias_de_parlamentario');

-- ── parlamentario sigue deny-by-default: anon NO lee partido (LEGAL-03) ────────
-- Semilla de un parlamentario (owner) para probar el deny efectivo a partido.
insert into parlamentario (id, nombre_normalizado, camara, periodo, origen, enlace, partido)
  values ('PTAP19', 'tap diputado', 'diputados', '2022-2026', 'test', 'http://x', 'Partido X');

select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname = 'parlamentario' $$,
  'parlamentario sin policies (partido sigue anon-denied, deny-by-default)'
);

set local role anon;

-- anon NO lee partido (ni ninguna columna de la maestra): RLS deny-by-default.
select is_empty(
  $$ select partido from parlamentario where id = 'PTAP19' $$,
  'anon NO lee parlamentario.partido (afiliación política nunca al público, LEGAL-03)'
);

-- anon SÍ invoca votos_de_parlamentario (grant execute efectivo); 0 filas es correcto
-- (PTAP19 no tiene votos confirmados) — lo que se prueba es que NO lanza permiso denegado.
select lives_ok(
  $$ select * from votos_de_parlamentario('PTAP19', 20, 0) $$,
  'anon SÍ invoca votos_de_parlamentario (grant execute efectivo)'
);

-- anon SÍ invoca rebeldias_de_parlamentario (security definer lee partido internamente).
select lives_ok(
  $$ select * from rebeldias_de_parlamentario('PTAP19') $$,
  'anon SÍ invoca rebeldias_de_parlamentario (security definer, sin exponer partido)'
);

reset role;

select * from finish();
rollback;
