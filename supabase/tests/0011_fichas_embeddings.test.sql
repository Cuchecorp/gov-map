-- 0011_fichas_embeddings.test.sql
-- Verifica la migración 0011: proyecto_ficha + proyecto_embedding(vector(768)) + índice HNSW +
-- RPC match_proyectos (con grant execute a anon) + RLS público-read en ambas tablas, SIN exponer
-- datos personales. Corre via `supabase test db` (pgTAP).

begin;
select plan(20);

-- ── Existencia de las 2 tablas ───────────────────────────────────────────────
select has_table('public', 'proyecto_ficha',      'tabla proyecto_ficha existe');
select has_table('public', 'proyecto_embedding',  'tabla proyecto_embedding existe');

-- ── Columnas clave ───────────────────────────────────────────────────────────
select has_column('public', 'proyecto_ficha', 'idea_matriz',      'proyecto_ficha.idea_matriz presente');
select has_column('public', 'proyecto_ficha', 'cuerpos_legales',  'proyecto_ficha.cuerpos_legales presente');
select has_column('public', 'proyecto_ficha', 'origen',           'proyecto_ficha.origen presente (provenance)');
select has_column('public', 'proyecto_embedding', 'embedding',         'proyecto_embedding.embedding presente');
select has_column('public', 'proyecto_embedding', 'embedding_model',   'proyecto_embedding.embedding_model presente (FND-07)');
select has_column('public', 'proyecto_embedding', 'embedding_version', 'proyecto_embedding.embedding_version presente (FND-07)');

-- ── La columna embedding es vector(768) ──────────────────────────────────────
select is(
  (select format_type(a.atttypid, a.atttypmod)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'proyecto_embedding'
      and a.attname = 'embedding'),
  'vector(768)',
  'proyecto_embedding.embedding es vector(768)'
);

-- ── Índice HNSW existe sobre proyecto_embedding ──────────────────────────────
select isnt_empty(
  $$ select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'proyecto_embedding_hnsw' and c.relkind = 'i' $$,
  'índice proyecto_embedding_hnsw existe (HNSW)'
);
-- y usa el método de acceso hnsw.
select is(
  (select am.amname from pg_class c
     join pg_am am on am.oid = c.relam
    where c.relname = 'proyecto_embedding_hnsw'),
  'hnsw',
  'proyecto_embedding_hnsw usa el access method hnsw'
);

-- ── La función match_proyectos existe ────────────────────────────────────────
select has_function('public', 'match_proyectos',
  ARRAY['vector', 'integer', 'double precision', 'text'],
  'función match_proyectos(vector, int, float8, text) existe');

-- ── anon tiene EXECUTE sobre match_proyectos (Pitfall 2 / T-07-04) ────────────
select ok(
  has_function_privilege('anon',
    'public.match_proyectos(vector, integer, double precision, text)', 'execute'),
  'anon tiene EXECUTE sobre match_proyectos (grant crítico)'
);

-- ── RLS habilitada en ambas tablas ───────────────────────────────────────────
select is(
  (select count(*)::int from pg_class
     where relname in ('proyecto_ficha', 'proyecto_embedding')
       and relrowsecurity = true),
  2,
  'RLS enabled en proyecto_ficha y proyecto_embedding'
);

-- ── Policies public_read presentes ───────────────────────────────────────────
select isnt_empty(
  $$ select 1 from pg_policies where schemaname='public' and tablename='proyecto_ficha'
       and policyname='proyecto_ficha_public_read' $$,
  'policy proyecto_ficha_public_read presente');
select isnt_empty(
  $$ select 1 from pg_policies where schemaname='public' and tablename='proyecto_embedding'
       and policyname='proyecto_embedding_public_read' $$,
  'policy proyecto_embedding_public_read presente');

-- ── Semilla mínima como owner + RLS público-read EFECTIVA como anon ──────────
insert into proyecto (boletin, boletin_num, titulo, origen, enlace)
  values ('99999-99', '99999', 'Proyecto semilla', 'test', 'http://x');
insert into proyecto_ficha (boletin, idea_matriz, origen)
  values ('99999-99', 'objeto literal de prueba', 'test');
insert into proyecto_embedding (boletin, embedding, embedding_model, embedding_dims, embedding_version)
  values ('99999-99', array_fill(0::float4, array[768])::vector, 'gemini-embedding-001', 768, 'v1');

set local role anon;

select isnt_empty(
  $$ select 1 from proyecto_ficha where boletin = '99999-99' $$,
  'anon SÍ lee proyecto_ficha (policy public_read)');
select isnt_empty(
  $$ select 1 from proyecto_embedding where boletin = '99999-99' $$,
  'anon SÍ lee proyecto_embedding (policy public_read)');

-- anon puede invocar el RPC (smoke: no lanza permiso denegado con el rol anon).
select isnt_empty(
  $$ select boletin from match_proyectos(
       (select array_fill(0::float4, array[768])::vector), 5, 0.0, null) $$,
  'anon SÍ invoca match_proyectos (grant execute efectivo)');

-- Guarda de identidad: anon NO lee la maestra (rut nunca al público).
select is_empty(
  $$ select rut from parlamentario $$,
  'anon NO lee parlamentario.rut (deny-by-default intacto, T-07-03)');

reset role;

select * from finish();
rollback;
