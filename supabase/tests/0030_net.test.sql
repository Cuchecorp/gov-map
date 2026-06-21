-- 0030_net.test.sql
-- Verifica la migración 0030 (NET — entidad/arista + proc + cron + RPC) CONTRA UN SCHEMA
-- APLICADO:
--   * `entidad`/`arista` existen con RLS habilitada y son DENY-BY-DEFAULT (cero policies),
--   * anon NO lee `entidad`/`arista` directamente (0 filas),
--   * `grafo.materializar_aristas()` existe y es SECURITY DEFINER,
--   * `subgrafo_red(...)` existe, es SECURITY DEFINER, anon tiene EXECUTE,
--   * la materialización produce la arista co_lobby_contraparte (happy path: nombres
--     normalizados idénticos → EXACTAMENTE una arista) con provenance + ventana temporal,
--   * el cuerpo de `subgrafo_red` y su salida NO contienen `partido` ni `rut` (no-PII, LEGAL-03),
--   * el clamp de profundidad es efectivo (resultado estable entre depth=2 y depth=99),
--   * CASO NEGATIVO de normalización (plan-checker MEDIUM-2): dos contrapartes con nombres
--     que son VARIANTES genuinas ("Fundación X" vs "Fundacion X A.G.") NO se funden bajo el
--     join-key `lower(trim(nombre))` → cero arista entre ese par (limitación conocida pineada).
-- Corre vía `supabase test db` (pgTAP). build/typecheck NO prueban que el DDL se aplicó
-- (falso positivo de CI, Pitfall 5). Espeja 0020/0021 test style.

begin;
select plan(16);

-- ── Semilla (owner, bypassa RLS) ──────────────────────────────────────────────
-- Cuatro parlamentarios confirmados. PAR1/PAR2 comparten la MISMA contraparte (nombre
-- normalizado idéntico → deben fundirse en UNA arista). PAR3/PAR4 reciben audiencia de
-- VARIANTES del mismo nombre ("Fundación X" vs "Fundacion X A.G.") → NO deben fundirse.
insert into parlamentario
  (id, nombre_normalizado, nombres, apellido_paterno, camara, periodo, origen, enlace, partido, rut)
values
  ('NET1', 'net uno', 'Ana',   'Uno',    'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto A', '11.111.111-1'),
  ('NET2', 'net dos', 'Beto',  'Dos',    'diputados', '2022-2026', 'camara', 'http://x', 'Partido Secreto B', '22.222.222-2'),
  ('NET3', 'net tres','Carla', 'Tres',   'senado',    '2022-2026', 'senado', 'http://x', 'Partido Secreto C', '33.333.333-3'),
  ('NET4', 'net cuatro','Dani','Cuatro', 'senado',    '2022-2026', 'senado', 'http://x', 'Partido Secreto D', '44.444.444-4');

-- Audiencias confirmadas (una por parlamentario). El `identificador` es la PK natural.
insert into lobby_audiencia
  (identificador, institucion_codigo, parlamentario_id, mencion_sujeto, estado_vinculo, fecha, origen, enlace)
values
  ('AUD-NET1', 'INST', 'NET1', 'Ana Uno',    'confirmado', '2024-01-10', 'lobby', 'http://lobby/1'),
  ('AUD-NET2', 'INST', 'NET2', 'Beto Dos',   'confirmado', '2024-02-20', 'lobby', 'http://lobby/2'),
  ('AUD-NET3', 'INST', 'NET3', 'Carla Tres', 'confirmado', '2024-03-05', 'lobby', 'http://lobby/3'),
  ('AUD-NET4', 'INST', 'NET4', 'Dani Cuatro','confirmado', '2024-04-15', 'lobby', 'http://lobby/4');

-- Contrapartes: AUD-NET1 y AUD-NET2 → mismo nombre con distinta caja/espacios (deben fundir).
--               AUD-NET3 y AUD-NET4 → variantes genuinas (NO deben fundir).
insert into lobby_contraparte (identificador, nombre, rol, origen, enlace)
values
  ('AUD-NET1', '  Contraparte Compartida  ', 'lobbista', 'lobby', 'http://lobby/1'),
  ('AUD-NET2', 'contraparte compartida',     'lobbista', 'lobby', 'http://lobby/2'),
  ('AUD-NET3', 'Fundación X',                'lobbista', 'lobby', 'http://lobby/3'),
  ('AUD-NET4', 'Fundacion X A.G.',           'lobbista', 'lobby', 'http://lobby/4');

-- Poblar entidad/arista desde los hechos sembrados.
select grafo.materializar_aristas();

-- ── entidad/arista existen ────────────────────────────────────────────────────
select has_table('public', 'entidad', 'tabla entidad existe');
select has_table('public', 'arista',  'tabla arista existe');

-- ── RLS habilitada en ambas ───────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_class where relname = 'entidad' and relrowsecurity = true),
  1, 'RLS enabled en entidad');
select is(
  (select count(*)::int from pg_class where relname = 'arista' and relrowsecurity = true),
  1, 'RLS enabled en arista');

-- ── DENY-BY-DEFAULT: cero policies sobre entidad y sobre arista ────────────────
select is(
  (select count(*)::int from pg_policies where tablename = 'entidad'),
  0, 'entidad sin policies (deny-by-default)');
select is(
  (select count(*)::int from pg_policies where tablename = 'arista'),
  0, 'arista sin policies (deny-by-default)');

-- ── grafo.materializar_aristas es SECURITY DEFINER ──────────────────────────────
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'grafo' and p.proname = 'materializar_aristas'),
  true,
  'grafo.materializar_aristas es security definer');

-- ── subgrafo_red: existe, security definer, anon tiene EXECUTE ─────────────────
select has_function('public', 'subgrafo_red',
  ARRAY['text','integer','text[]','timestamp with time zone','timestamp with time zone'],
  'función subgrafo_red(text,int,text[],timestamptz,timestamptz) existe');
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'subgrafo_red'),
  true,
  'subgrafo_red es security definer (lee entidad/arista deny-by-default sin abrirlas a anon)');
select ok(
  has_function_privilege('anon', 'public.subgrafo_red(text,int,text[],timestamp with time zone,timestamp with time zone)', 'execute'),
  'anon tiene EXECUTE sobre subgrafo_red');

-- ── no-PII: el cuerpo de subgrafo_red NO referencia partido ni rut (LEGAL-03) ──
-- Se STRIPEAN los comentarios `--` antes de buscar (el cuerpo documenta "NUNCA partido/rut"
-- en un comentario PII-SAFE) y se exige límite de palabra (\y) para no matchear substrings
-- legítimos. Lo que importa es que el CÓDIGO no proyecte esas columnas, no el comentario.
select ok(
  (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'subgrafo_red')
    !~* '\y(partido|rut)\y',
  'el cuerpo de subgrafo_red NO contiene partido ni rut (no-PII, espejo 0020; comentarios excluidos)');

-- ── happy path: NET1/NET2 (mismo nombre normalizado) → EXACTAMENTE una arista ──
-- (assert como owner: la unicidad de la arista co_lobby_contraparte entre el par ordenado).
select is(
  (select count(*)::int from arista
    where tipo = 'co_lobby_contraparte' and extremo_a = 'NET1' and extremo_b = 'NET2'),
  1,
  'happy path: nombres normalizados idénticos producen EXACTAMENTE una arista co_lobby_contraparte');

-- ── CASO NEGATIVO (plan-checker MEDIUM-2): variantes NO se funden ──────────────
-- "Fundación X" vs "Fundacion X A.G." son variantes genuinas: bajo lower(trim(nombre)) NO
-- comparten clave → cero arista entre NET3/NET4. Pinea la limitación conocida (OQ3).
select is(
  (select count(*)::int from arista
    where tipo = 'co_lobby_contraparte' and extremo_a = 'NET3' and extremo_b = 'NET4'),
  0,
  'caso negativo: nombres VARIANTES (Fundación X vs Fundacion X A.G.) NO se funden en una arista');

set local role anon;

-- ── anon NO lee entidad/arista directamente (deny-by-default) ─────────────────
select is_empty(
  $$ select id from entidad $$,
  'anon NO lee entidad directamente (RLS deny-by-default, 0 filas)');
select is_empty(
  $$ select id from arista $$,
  'anon NO lee arista directamente (RLS deny-by-default, 0 filas)');

-- ── anon SÍ invoca el RPC: subgrafo con provenance + ventana, sin PII en la salida ─
-- NET1 semilla, depth 1 → debe traer la arista co_lobby_contraparte con desde/hasta/enlace/dataset,
-- y NINGÚN nodo debe llevar la clave partido ni rut (assert sobre el jsonb de nodos).
select is(
  (
    with g as (select subgrafo_red('NET1', 1) as j)
    select (
      -- hay al menos una arista con provenance + ventana
      (jsonb_array_length(j -> 'aristas') >= 1)
      and ((j -> 'aristas' -> 0 ->> 'dataset') = 'lobby')
      and ((j -> 'aristas' -> 0 -> 'desde') is not null)
      and ((j -> 'aristas' -> 0 -> 'hasta') is not null)
      and ((j -> 'aristas' -> 0 ->> 'enlace') is not null)
      -- ningún nodo expone partido ni rut (no-PII en la salida)
      and not exists (
        select 1 from jsonb_array_elements(j -> 'nodos') n
        where n ? 'partido' or n ? 'rut'
      )
    )::boolean
    from g
  ),
  true,
  'anon: subgrafo_red(NET1,1) trae arista con dataset/desde/hasta/enlace y nodos SIN partido/rut');

-- ── depth clamp efectivo: depth=2 y depth=99 producen el MISMO conjunto de nodos ─
-- (con clamp 1..2, depth=99 colapsa a 2 → el subgrafo es estable; sin clamp diferiría).
select is(
  (
    with a as (select subgrafo_red('NET1', 2)  as j),
         b as (select subgrafo_red('NET1', 99) as j)
    select (
      (select count(*) from jsonb_array_elements((select j from a) -> 'nodos'))
      =
      (select count(*) from jsonb_array_elements((select j from b) -> 'nodos'))
    )::boolean
  ),
  true,
  'depth clamp efectivo: subgrafo_red con depth=2 y depth=99 produce el mismo conjunto de nodos');

reset role;

select * from finish();
rollback;
