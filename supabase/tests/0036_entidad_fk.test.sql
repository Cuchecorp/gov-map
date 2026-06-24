-- 0036_entidad_fk.test.sql
-- Verifica los FK/columnas (Δ3) y el RPC transaccional resolver_entidad (migracion 0036,
-- ENT-03/ENT-04). Espeja 0015_resolver_identidad.test.sql + 0024_dinero.test.sql (anon-no-execute).
--   (a) Δ3: FK lobby_contraparte.contraparte_id → entidad_tercero; columna contratista.entidad_id
--       (con FK); columna identidad_audit.tipo_entidad.
--   (b) resolver_entidad existe con la firma de 10 params; anon/authenticated/public NO la ejecutan.
--   (c) caso transaccional: confirm promueve el vinculo + audit; re-resolver un caso ya resuelto LANZA.

begin;
select plan(15);

-- ── (a) Δ3 FK / columnas ──
-- FK lobby_contraparte.contraparte_id → entidad_tercero.
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f'
      and src.relname = 'lobby_contraparte'
      and tgt.relname = 'entidad_tercero'),
  1, 'lobby_contraparte tiene FK a entidad_tercero (contraparte_id formalizado)');

-- columna contratista.entidad_id existe y es FK a entidad_tercero.
select has_column('public', 'contratista', 'entidad_id', 'contratista.entidad_id presente (columna nueva)');
select is(
  (select count(*)::int
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
    where con.contype = 'f'
      and src.relname = 'contratista'
      and tgt.relname = 'entidad_tercero'),
  1, 'contratista.entidad_id es FK a entidad_tercero');

-- columna identidad_audit.tipo_entidad existe (Δ1 en el audit reusado).
select has_column('public', 'identidad_audit', 'tipo_entidad', 'identidad_audit.tipo_entidad presente (Δ1, audit reusado)');

-- ── (b) RPC resolver_entidad: existe (10 params), anon/authenticated/public NO la ejecutan ──
select has_function('public', 'resolver_entidad',
  ARRAY['bigint', 'text', 'text', 'text', 'timestamp with time zone', 'boolean', 'jsonb', 'text', 'text', 'text'],
  'funcion resolver_entidad(10 params) existe');
select ok(
  not has_function_privilege('anon',
    'public.resolver_entidad(bigint,text,text,text,timestamp with time zone,boolean,jsonb,text,text,text)', 'execute'),
  'anon NO puede ejecutar resolver_entidad (deny-by-default)');
select ok(
  not has_function_privilege('authenticated',
    'public.resolver_entidad(bigint,text,text,text,timestamp with time zone,boolean,jsonb,text,text,text)', 'execute'),
  'authenticated NO puede ejecutar resolver_entidad');
select ok(
  not has_function_privilege('public',
    'public.resolver_entidad(bigint,text,text,text,timestamp with time zone,boolean,jsonb,text,text,text)', 'execute'),
  'public NO puede ejecutar resolver_entidad');

-- ── (c) caso transaccional: confirm promueve + audit; re-resolver LANZA ──
insert into entidad_tercero (id, nombre_normalizado, tipo_entidad, origen, enlace)
  values ('E0R001', 'rpc resolver uno', 'natural', 'test', 'http://x');
insert into revision_entidad (id, mencion_nombre, mencion_normalizada, tipo_entidad, estado, modelo_version)
  overriding system value
  values (910001, 'Rpc Uno', 'rpc uno', 'natural', 'pendiente', 'minimax-mock');

select isnt(
  (select resolver_entidad(910001, 'confirmado', 'ana', null, now(), true,
    jsonb_build_object('mencion_nombre', 'Rpc Uno', 'mencion_normalizada', 'rpc uno',
      'tipo_entidad', 'natural', 'entidad_tercero_id', 'E0R001',
      'estado', 'confirmado', 'metodo', 'humano', 'origen', 'lobby', 'enlace', ''),
    'confirmado', 'minimax-mock', 'natural')),
  null,
  'confirm devuelve el id del vinculo promovido');
select is(
  (select estado from revision_entidad where id = 910001), 'confirmado',
  'el caso quedo resuelto a confirmado');
select is(
  (select estado from vinculo_entidad where tipo_entidad = 'natural' and mencion_normalizada = 'rpc uno'),
  'confirmado', 'vinculo creado en estado confirmado (humano)');
select is(
  (select entidad_tercero_id from vinculo_entidad where tipo_entidad = 'natural' and mencion_normalizada = 'rpc uno'),
  'E0R001', 'el vinculo apunta a la entidad del chosen_id');
select is(
  (select count(*)::int from identidad_audit
     where decision = 'confirmado' and revisor_id = 'ana' and tipo_entidad = 'natural'),
  1, 'audit humano confirmado escrito con tipo_entidad poblado');

-- re-resolver el MISMO caso (ya 'confirmado') LANZA y no deja colaterales (rollback total).
select throws_ok(
  $$ select resolver_entidad(910001, 'rechazado', 'beto', 'x', now(), false, null, 'rechazado', null, 'natural') $$,
  'P0002', null,
  're-resolver un caso ya resuelto LANZA (no_data_found, atomico)');
select is(
  (select count(*)::int from identidad_audit where revisor_id = 'beto'),
  0, 'el intento fallido no dejo audit colateral (rollback total)');

select * from finish();
rollback;
