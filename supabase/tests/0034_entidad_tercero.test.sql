-- 0034_entidad_tercero.test.sql
-- Verifica la maestra de terceros creada por la migracion 0034 (ENT-01).
-- Corre via pgTAP (`psql --db-url -f`). Espeja 0004_parlamentario.test.sql + 0012.
-- pgTAP corre como superuser local (peor caso): si la coercion/RLS aplica aqui, aplica
-- tambien al service role que BYPASSA RLS.

begin;
select plan(22);

-- 2 tablas de la maestra existen.
select has_table('public', 'entidad_tercero',       'tabla entidad_tercero existe');
select has_table('public', 'entidad_tercero_alias', 'tabla entidad_tercero_alias existe');

-- Columnas criticas (incl. Δ1 tipo_entidad).
select has_column('public', 'entidad_tercero', 'nombre_normalizado', 'entidad_tercero.nombre_normalizado presente');
select has_column('public', 'entidad_tercero', 'tipo_entidad',       'entidad_tercero.tipo_entidad presente (Δ1 discriminador)');
select has_column('public', 'entidad_tercero', 'rut',                'entidad_tercero.rut presente');
select has_column('public', 'entidad_tercero', 'estado',             'entidad_tercero.estado presente');
select has_column('public', 'entidad_tercero', 'origen',             'entidad_tercero.origen presente (provenance)');
select has_column('public', 'entidad_tercero', 'fecha_captura',      'entidad_tercero.fecha_captura presente (provenance)');
select has_column('public', 'entidad_tercero', 'enlace',             'entidad_tercero.enlace presente (provenance)');

-- rut NULLABLE (lobby no lo trae; proveedores si).
select col_is_null('public', 'entidad_tercero', 'rut', 'entidad_tercero.rut es nullable (uso interno)');

-- Default de estado = 'no_confirmado' (compuerta; nada auto-confirmado por DDL).
select col_default_is('public', 'entidad_tercero', 'estado', 'no_confirmado',
  'entidad_tercero.estado default no_confirmado (nada auto-confirmado)');

-- Sequence del id estable existe.
select has_sequence('public', 'entidad_id_seq', 'entidad_id_seq existe (id estable por DB, no logica TS)');

-- Δ1 Check de tipo_entidad: valor invalido revienta; valido vive.
select throws_ok(
  $$ insert into entidad_tercero (nombre_normalizado, tipo_entidad, estado, origen, enlace)
     values ('test', 'persona', 'no_confirmado', 'test', 'http://x') $$,
  '23514', null,
  'tipo_entidad invalido viola el check (solo natural|juridica)');
select lives_ok(
  $$ insert into entidad_tercero (nombre_normalizado, tipo_entidad, estado, origen, enlace)
     values ('test juridica', 'juridica', 'no_confirmado', 'test', 'http://x') $$,
  'tipo_entidad valido (juridica) se inserta; id default por sequence');

-- Check de estado: valor invalido revienta.
select throws_ok(
  $$ insert into entidad_tercero (nombre_normalizado, tipo_entidad, estado, origen, enlace)
     values ('test', 'natural', 'xxx', 'test', 'http://x') $$,
  '23514', null,
  'estado invalido viola el check constraint');

-- Clave natural: dos filas con el mismo rut revientan (indice unico parcial).
select lives_ok(
  $$ insert into entidad_tercero (id, nombre_normalizado, tipo_entidad, rut, origen, enlace)
     values ('E90001', 'rut uno', 'juridica', '76000000-0', 'test', 'http://x') $$,
  'primer rut=76000000-0 se inserta');
select throws_ok(
  $$ insert into entidad_tercero (id, nombre_normalizado, tipo_entidad, rut, origen, enlace)
     values ('E90002', 'rut dos', 'juridica', '76000000-0', 'test', 'http://x') $$,
  '23505', null,
  'rut duplicado viola el unique index parcial');

-- RLS deny-by-default: RLS habilitada en ambas tablas.
select is(
  (select count(*)::int from pg_class
     where relname in ('entidad_tercero', 'entidad_tercero_alias')
       and relrowsecurity = true),
  2, 'RLS enabled en entidad_tercero/entidad_tercero_alias');

-- Sin policies → deny-by-default efectivo.
select is(
  (select count(*)::int from pg_policies
     where tablename in ('entidad_tercero', 'entidad_tercero_alias')),
  0, 'ninguna policy definida en la maestra (deny-by-default)');

-- anon NO tiene grant SELECT (revoke explicito — PII interna, leccion Phase 11).
select is(
  (select count(*)::int from information_schema.role_table_grants
     where table_name = 'entidad_tercero' and grantee = 'anon' and privilege_type = 'SELECT'),
  0, 'anon NO tiene grant SELECT sobre entidad_tercero (revoke explicito)');

-- Δ1 Trigger de COERCION presente (espejo 0012, NO RAISE).
select has_trigger('public', 'entidad_tercero', 'entidad_tercero_estado_no_regresa',
  'trigger entidad_tercero_estado_no_regresa definido (coercion silenciosa)');

-- La coercion preserva 'confirmado' frente a un UPDATE degradante (NO aborta el lote).
insert into entidad_tercero (id, nombre_normalizado, tipo_entidad, estado, origen, enlace)
  values ('E90003', 'coercion test', 'natural', 'confirmado', 'test', 'http://x');
update entidad_tercero set estado = 'no_confirmado' where id = 'E90003';
select is(
  (select estado from entidad_tercero where id = 'E90003'),
  'confirmado',
  'la confirmacion previa se PRESERVA frente al upsert masivo (coercion silenciosa)');

select * from finish();
rollback;
