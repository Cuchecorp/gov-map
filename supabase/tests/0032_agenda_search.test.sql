-- 0032_agenda_search.test.sql
-- Verifica la migración 0032: columna FTS generada `citacion.busqueda_tsv` + índice GIN +
-- RPC buscar_citaciones(text,int) con grant execute a anon, FTS spanish efectiva, match por
-- boletín, y "sin resultados" honesto ante basura. Corre vía `supabase test db` (pgTAP).

begin;
select plan(11);

-- ── Estructura ───────────────────────────────────────────────────────────────
select has_column('public', 'citacion', 'busqueda_tsv', 'citacion.busqueda_tsv (tsvector FTS) presente');
select is(
  (select format_type(a.atttypid, a.atttypmod)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'citacion' and a.attname = 'busqueda_tsv'),
  'tsvector',
  'citacion.busqueda_tsv es tsvector'
);
select isnt_empty(
  $$ select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relname='citacion_busqueda_tsv_idx' and c.relkind='i' $$,
  'índice GIN citacion_busqueda_tsv_idx existe'
);
-- NOTA: la firma final (tras 0033) es (text, int, text) — se añadió p_camara. Estos tests
-- corren contra el esquema ya migrado, por eso se asierta la firma de 3 args.
select has_function('public', 'buscar_citaciones', ARRAY['text', 'integer', 'text'],
  'función buscar_citaciones(text, int, text) existe');
select ok(
  has_function_privilege('anon', 'public.buscar_citaciones(text, integer, text)', 'execute'),
  'anon tiene EXECUTE sobre buscar_citaciones (grant crítico)'
);

-- ── Semilla mínima (owner) ─────────────────────────────────────────────────────
insert into citacion (id, camara, comision, fecha, horario, materia, semana_iso, origen, enlace)
  values ('test:cit:1', 'senado', 'Comisión de Medio Ambiente y Bienes Nacionales',
          '2026-06-23T10:00:00Z', '10:00 a 12:00', 'Proyecto sobre reciclaje de envases',
          '2026-W26', 'test', 'http://x');
insert into citacion_punto (citacion_id, posicion, boletin, materia)
  values ('test:cit:1', 0, '12345-07', 'Idea matriz del proyecto');
insert into citacion_invitado (citacion_id, nombre, calidad)
  values ('test:cit:1', 'Juana Pérez', 'Subsecretaria');

set local role anon;

-- FTS spanish: una consulta de dominio devuelve la citación.
select isnt_empty(
  $$ select id from public.buscar_citaciones('medio ambiente', 50) $$,
  'anon SÍ invoca buscar_citaciones y FTS spanish matchea "medio ambiente"');

-- Match por materia de un punto (ilike).
select isnt_empty(
  $$ select id from public.buscar_citaciones('reciclaje', 50) $$,
  'buscar_citaciones matchea por materia/punto');

-- Match por nombre de invitado (ilike).
select isnt_empty(
  $$ select id from public.buscar_citaciones('Juana Pérez', 50) $$,
  'buscar_citaciones matchea por nombre de invitado');

-- Atajo boletín exacto NNNNN-NN.
select results_eq(
  $$ select boletin from public.buscar_citaciones('12345-07', 50) $$,
  $$ values ('12345-07'::text) $$,
  'buscar_citaciones matchea por boletín exacto y devuelve el primer boletín');

-- Basura / fuera de dominio → "sin resultados" honesto (no fabrica).
select is_empty(
  $$ select id from public.buscar_citaciones('zxqwlkjhgfd', 50) $$,
  'consulta sin relación devuelve vacío (honesto)');

reset role;

select * from finish();
rollback;
