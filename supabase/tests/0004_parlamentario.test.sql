-- 0004_parlamentario.test.sql
-- Verifica la maestra de identidad creada por la migracion 0005.
-- Corre via `psql -tA -f` (vs PROD aplicado) (pgTAP). Espeja el patron de 0001_control_plane.test.sql.

begin;
select plan(25);

-- 2 tablas de la maestra existen.
select has_table('public', 'parlamentario',       'tabla parlamentario existe');
select has_table('public', 'parlamentario_alias', 'tabla parlamentario_alias existe');

-- Columnas criticas de parlamentario.
select has_column('public', 'parlamentario', 'nombre_normalizado', 'parlamentario.nombre_normalizado presente');
select has_column('public', 'parlamentario', 'camara',             'parlamentario.camara presente');
select has_column('public', 'parlamentario', 'periodo',            'parlamentario.periodo presente');
select has_column('public', 'parlamentario', 'estado',             'parlamentario.estado presente');
select has_column('public', 'parlamentario', 'rut',                'parlamentario.rut presente');
select has_column('public', 'parlamentario', 'parlid_senado',      'parlamentario.parlid_senado presente');
select has_column('public', 'parlamentario', 'id_diputado_camara', 'parlamentario.id_diputado_camara presente');
select has_column('public', 'parlamentario', 'origen',             'parlamentario.origen presente (provenance)');
select has_column('public', 'parlamentario', 'fecha_captura',      'parlamentario.fecha_captura presente (provenance)');
select has_column('public', 'parlamentario', 'enlace',             'parlamentario.enlace presente (provenance)');

-- Nullables que la siembra requiere (Pitfall 4): rut, distrito, circunscripcion.
select col_is_null('public', 'parlamentario', 'rut',             'parlamentario.rut es nullable (uso interno, catalogos no lo traen)');
select col_is_null('public', 'parlamentario', 'distrito',        'parlamentario.distrito es nullable');
select col_is_null('public', 'parlamentario', 'circunscripcion', 'parlamentario.circunscripcion es nullable');

-- Default de estado = 'no_confirmado' (compuerta de revision humana, ID-01).
select col_default_is('public', 'parlamentario', 'estado', 'no_confirmado',
  'parlamentario.estado default no_confirmado (nada auto-confirmado)');

-- Check de estado: valor invalido revienta, valor valido vive.
select throws_ok(
  $$ insert into parlamentario (id, nombre_normalizado, camara, periodo, estado, origen, enlace)
     values ('PXXXX', 'test', 'senado', '2022-2026', 'xxx', 'test', 'http://x') $$,
  '23514',
  null,
  'estado invalido viola el check constraint'
);
select lives_ok(
  $$ insert into parlamentario (id, nombre_normalizado, camara, periodo, estado, origen, enlace)
     values ('PVALID', 'test', 'senado', '2022-2026', 'confirmado', 'test', 'http://x') $$,
  'estado valido (confirmado) se inserta'
);

-- Check de camara: valor invalido revienta.
select throws_ok(
  $$ insert into parlamentario (id, nombre_normalizado, camara, periodo, origen, enlace)
     values ('PCAM', 'test', 'congreso', '2022-2026', 'test', 'http://x') $$,
  '23514',
  null,
  'camara invalida viola el check constraint'
);

-- Unicidad natural: dos filas con el mismo parlid_senado revientan (upsert idempotente).
select lives_ok(
  $$ insert into parlamentario (id, nombre_normalizado, camara, periodo, parlid_senado, origen, enlace)
     values ('PSEN1', 'a', 'senado', '2022-2026', 'S100', 'test', 'http://x') $$,
  'primer parlid_senado=S100 se inserta'
);
select throws_ok(
  $$ insert into parlamentario (id, nombre_normalizado, camara, periodo, parlid_senado, origen, enlace)
     values ('PSEN2', 'b', 'senado', '2022-2026', 'S100', 'test', 'http://x') $$,
  '23505',
  null,
  'parlid_senado duplicado viola el unique index parcial'
);

-- RLS deny-by-default: RLS habilitada en ambas tablas.
select is(
  (select count(*)::int from pg_class
     where relname in ('parlamentario', 'parlamentario_alias')
       and relrowsecurity = true),
  2,
  'RLS enabled en parlamentario/parlamentario_alias'
);

-- Sin policies → deny-by-default efectivo (anon nunca lee rut/email).
select is_empty(
  $$ select polname from pg_policy p
     join pg_class c on c.oid = p.polrelid
     where c.relname in ('parlamentario', 'parlamentario_alias') $$,
  'ninguna policy definida en la maestra (deny-by-default)'
);

-- parlamentario_alias: FK a parlamentario y unique (parlamentario_id, alias).
select has_column('public', 'parlamentario_alias', 'parlamentario_id', 'parlamentario_alias.parlamentario_id presente');
select col_is_unique(
  'public', 'parlamentario_alias',
  ARRAY['parlamentario_id', 'alias'],
  'parlamentario_alias unique (parlamentario_id, alias)'
);

select * from finish();
rollback;
